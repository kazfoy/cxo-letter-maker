/**
 * /api/generate-v2
 *
 * 分析結果を材料に、推測なしでCxO向けレターを生成する
 * Self-Correction: qualityGate → 詳細スコア → リライトのループ
 */

import { NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { generateJson } from '@/lib/gemini';
import {
  validateLetterOutput,
  calculateDetailedScore,
  type ProofPoint,
} from '@/lib/qualityGate';
import { selectFactsForLetter } from '@/lib/factSelector';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';
import type { AnalysisResult, SelectedFact } from '@/types/analysis';
import {
  GenerateV2RequestSchema,
  GenerateV2OutputSchema,
  type SenderInfo,
  type UserOverrides,
  type GenerateV2Output,
  type Quality,
} from '@/types/generate-v2';

export const maxDuration = 60;

/**
 * 生成プロンプトを構築
 */
function buildGenerationPrompt(
  analysis: AnalysisResult,
  overrides: UserOverrides | undefined,
  sender: SenderInfo,
  mode: 'draft' | 'complete',
  format: 'letter' | 'email',
  factsForLetter: SelectedFact[] = [],
  improvementPoints?: string[]
): string {
  const companyName = overrides?.company_name || analysis.facts.company_name || '';
  const personName = overrides?.person_name || analysis.facts.person_name || '';
  const personPosition = overrides?.person_position || analysis.facts.person_position || '';

  const modeInstruction = mode === 'draft'
    ? '【下書きモード】情報が不足している箇所は【要確認: 〇〇】の形式でプレースホルダーを使用してください。推測で情報を埋めないでください。'
    : '【完成モード】すべての情報を具体的に記載してください。プレースホルダー（【要確認:】、〇〇、●●など）は使用禁止です。';

  // リライト時の改善指示
  let retryInstruction = '';
  if (improvementPoints && improvementPoints.length > 0) {
    retryInstruction = `\n\n【リライト注意】前回の生成は品質基準を満たしませんでした。以下の点を改善してください：
${improvementPoints.map(p => `- ${p}`).join('\n')}`;
  }

  // 使用可能な証拠をリスト化
  const proofPointsList = analysis.proof_points.length > 0
    ? analysis.proof_points.map(p => `- [${p.type}] ${p.content} (確度: ${p.confidence})`).join('\n')
    : '（証拠ポイントなし - 下書きモードではプレースホルダーを使用）';

  const newsList = analysis.recent_news.length > 0
    ? analysis.recent_news.map(n => `- ${n.headline}: ${n.summary}`).join('\n')
    : '（最新ニュースなし）';

  const signalsList = analysis.signals.length > 0
    ? analysis.signals.map(s => `- ${s.description} (${s.type}, 確度: ${s.confidence})`).join('\n')
    : '（経営シグナルなし）';

  // Phase 5: 抽出ファクトの整形
  const extractedFacts = analysis.extracted_facts;
  const hasExtractedFacts = extractedFacts &&
    Object.values(extractedFacts).some(arr => arr.length > 0);

  let extractedFactsList = '';
  if (hasExtractedFacts) {
    const factItems: string[] = [];
    if (extractedFacts.numbers.length > 0) {
      factItems.push(`- 数値情報: ${extractedFacts.numbers.join(', ')}`);
    }
    if (extractedFacts.properNouns.length > 0) {
      factItems.push(`- 固有名詞: ${extractedFacts.properNouns.join(', ')}`);
    }
    if (extractedFacts.recentMoves.length > 0) {
      factItems.push(`- 最近の動き: ${extractedFacts.recentMoves.join(', ')}`);
    }
    if (extractedFacts.hiringTrends.length > 0) {
      factItems.push(`- 採用動向: ${extractedFacts.hiringTrends.join(', ')}`);
    }
    if (extractedFacts.companyDirection.length > 0) {
      factItems.push(`- 会社の方向性: ${extractedFacts.companyDirection.join(', ')}`);
    }
    extractedFactsList = factItems.join('\n');
  }

  // 選定ファクトの必須引用指示
  let factsForLetterInstruction = '';
  if (factsForLetter.length > 0) {
    const factsList = factsForLetter.map(f => `- [${f.category}] ${f.quoteKey}: ${f.content}`).join('\n');
    factsForLetterInstruction = `\n\n【必須引用ファクト（フックで必ず1つ以上使用）】
${factsList}

【一般論禁止ルール（厳守）】
以下の表現は使用禁止:
- 「CASE」「MaaS」「100年に一度の変革」
- 「急務」「喫緊」「待ったなし」
- 「多くの企業では」「一般的に」「近年では」「業界では」
- 「DX推進」「デジタル変革」（具体的な取り組み引用なしの場合）

違反した場合、品質スコアを強制的に80未満にし、リライトを要求します。

【冒頭ファクト引用ルール】
targetUrl がある場合、冒頭200文字以内に factsForLetter の quoteKey を必ず1つ以上含めること。`;
  }

  // ファクトがない場合のフォールバック指示
  const noFactsInstruction = !hasExtractedFacts && factsForLetter.length === 0
    ? '\n\n【ファクト不足時の対応】\n- 具体的なファクトが取得できなかったため、業界一般の課題と仮説で構成してください\n- 「〜ではないでしょうか」「〜と推察します」等の可能性表現を使用\n- 架空の数字・固有名詞・実績は絶対に生成しない\n- 「推測」「想像」「おそらく」等の曖昧ワードは本文に出さない'
    : '';

  // 冒頭の宛名フォーマット
  const recipientFormat = personName
    ? `${companyName} ${personPosition} ${personName}様`
    : companyName
    ? `${companyName} ${personPosition || 'ご担当者'}様`
    : '';

  return `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
以下の分析結果を基に、${format === 'email' ? 'メール' : '手紙'}を作成してください。

${modeInstruction}${retryInstruction}${factsForLetterInstruction}${noFactsInstruction}

【絶対ルール】
1. 架空の数字・社名・実績は禁止。proof_points / recent_news / extracted_facts にあるものだけ使用可能
2. 仮説は「〜ではないでしょうか」「〜と推察します」のような可能性表現のみ使用
3. 冒頭の儀礼的褒め言葉（「ご活躍を拝見」「感銘を受けました」等）は禁止
4. 「業務効率化」「コスト削減」ではなく「ガバナンス強化」「経営スピード向上」「リスク低減」の視点
5. 文字数: 350-500文字（一画面で読める長さ）
6. CTAは軽量に（「15分だけ」「情報交換として」）- URLなしでも成立させる

【文体ルール（電報調禁止）】
7. すべての文は「です」「ます」「でしょうか」「ください」で終える。体言止め禁止
   - NG: 「期待。」「可能。」「必要。」「重要。」
   - OK: 「期待しております。」「可能です。」「必要と考えます。」
8. 冒頭は「${recipientFormat || '【企業名】【役職】【氏名】様'}」で始める
9. 一般論（「多くの企業では」「一般的に」「近年では」）は、factsForLetterのファクトを引用した後にのみ使用可

【文章構造（5要素必須）】
1. フック: ${factsForLetter.length > 0 ? 'factsForLetterから1つ以上を必ず引用' : '相手企業への関心を示す'}
2. 課題仮説: 役職に寄せる（経営企画なら管理、統制、意思決定スピード等）
3. 解決策: 提供価値を1-2文で簡潔に
4. 実績/根拠: 具体的な数字や事例
5. CTA: 「15分だけ」等の軽量オファー

【ターゲット情報】
企業名: ${sanitizeForPrompt(companyName, 200) || '（未指定）'}
担当者名: ${sanitizeForPrompt(personName, 100) || '（未指定）'}
役職: ${sanitizeForPrompt(personPosition, 100) || '（未指定）'}
業界: ${analysis.facts.industry || '（未指定）'}

【経営シグナル（仮説）】
${signalsList}

【活用できる証拠】
${proofPointsList}

【最新ニュース】
${newsList}

${hasExtractedFacts ? `【抽出ファクト（Webサイトから取得）】
${extractedFactsList}` : ''}

【提案された構成】
- タイミングの理由: ${analysis.hypotheses.timing_reason}
- 課題仮説: ${analysis.hypotheses.challenge_hypothesis}
- 提供価値: ${analysis.hypotheses.value_proposition}
- CTA提案: ${analysis.hypotheses.cta_suggestion}

【差出人情報】
企業名: ${sanitizeForPrompt(sender.company_name, 200)}
部署: ${sanitizeForPrompt(sender.department || '', 200)}
氏名: ${sanitizeForPrompt(sender.name, 100)}
サービス: ${sanitizeForPrompt(sender.service_description, 1000)}

${overrides?.additional_context ? `【追加コンテキスト】\n${sanitizeForPrompt(overrides.additional_context, 1000)}` : ''}

【出力形式】
以下のJSON形式で出力してください：
{
  "subjects": ["件名候補1（25文字目安、抽象語禁止）", "件名候補2", "件名候補3", "件名候補4", "件名候補5"],
  "body": "本文テキスト（350-500文字）",
  "rationale": [
    { "type": "timing", "content": "今連絡する理由" },
    { "type": "evidence", "content": "使用した証拠" },
    { "type": "value", "content": "提供価値" }
  ],
  "variations": {
    "standard": "王道パターン（業界トレンド仮説リード）",
    "emotional": "熱意パターン（具体的成功事例リード）",
    "consultative": "課題解決パターン（リスク・規制観点リード）"
  }
}`;
}

/**
 * ProofPointを変換
 */
function convertToQualityGateProofPoints(analysisProofPoints: AnalysisResult['proof_points']): ProofPoint[] {
  return analysisProofPoints.map(p => ({
    type: p.type,
    content: p.content,
    source: p.source,
    confidence: p.confidence,
  }));
}

export async function POST(request: Request) {
  return await apiGuard(
    request,
    GenerateV2RequestSchema,
    async (data, _user) => {
      const { analysis_result, user_overrides, sender_info, mode, output_format } = data;

      const maxAttempts = 2; // 最大2回（初稿 + 1回リライト）
      let bestResult: GenerateV2Output | null = null;
      let bestQuality: Quality = {
        score: null,
        passed: false,
        issues: [],
        evaluation_comment: 'Not evaluated',
      };
      let improvementPoints: string[] = [];

      const proofPoints = convertToQualityGateProofPoints(analysis_result.proof_points);

      // ファクト選定
      const targetPosition = user_overrides?.person_position || analysis_result.facts.person_position;
      const productStrength = sender_info.service_description;
      const { factsForLetter } = selectFactsForLetter(
        analysis_result.extracted_facts,
        targetPosition,
        productStrength
      );

      devLog.log(`Selected ${factsForLetter.length} facts for letter`);

      // targetUrl あり && factsForLetter 空 → 422 URL_FACTS_EMPTY
      const hasTargetUrl = Boolean(user_overrides?.target_url || analysis_result.target_url);
      if (hasTargetUrl && factsForLetter.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'URL_FACTS_EMPTY',
          message: 'URLからファクトを抽出できませんでした。再分析または別URLを試してください。',
        }, { status: 422 });
      }

      // ファクトの数値/固有名詞有無を判定
      const hasFactNumbers = factsForLetter.some(f => f.category === 'numbers') ||
        (analysis_result.extracted_facts?.numbers?.length ?? 0) > 0;
      const hasProperNouns = factsForLetter.some(f => f.category === 'properNouns') ||
        (analysis_result.extracted_facts?.properNouns?.length ?? 0) > 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        devLog.log(`Generation attempt ${attempt}/${maxAttempts}`);

        try {
          // 1. プロンプト構築
          const prompt = buildGenerationPrompt(
            analysis_result,
            user_overrides,
            sender_info,
            mode,
            output_format,
            factsForLetter,
            attempt > 1 ? improvementPoints : undefined
          );

          // 2. 生成
          const result = await generateJson({
            prompt,
            schema: GenerateV2OutputSchema,
            maxRetries: 1,
          });

          // 3. qualityGate 検証
          const validation = validateLetterOutput(result.body, proofPoints, {
            mode,
            hasProofPoints: analysis_result.proof_points.length > 0,
            hasRecentNews: analysis_result.recent_news.length > 0,
          });

          // 4. 詳細スコア計算（factsForLetter を使用）
          // userInput はユーザーが入力した追加コンテキスト
          const userInput = user_overrides?.additional_context || '';
          const detailedScore = calculateDetailedScore(
            result.body,
            hasFactNumbers,
            hasProperNouns,
            factsForLetter,
            hasTargetUrl,
            userInput
          );
          devLog.log(`Detailed score: ${detailedScore.total}, breakdown:`, detailedScore.breakdown);

          // 品質OK（80点以上）または最終試行
          if (detailedScore.total >= 80 || attempt === maxAttempts) {
            devLog.log(`Returning result (score: ${detailedScore.total}, attempt: ${attempt})`);
            return NextResponse.json({
              success: true,
              data: {
                subjects: result.subjects,
                body: result.body,
                rationale: result.rationale,
                quality: {
                  score: detailedScore.total,
                  passed: detailedScore.total >= 80 && validation.ok,
                  issues: [...validation.reasons, ...detailedScore.suggestions],
                  evaluation_comment: `Detailed score: ${detailedScore.total}/100 (${Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ')})`,
                },
                variations: result.variations,
                // 追加フィールド
                sources: analysis_result.sources || [],
                factsForLetter: factsForLetter,
              },
            });
          }

          // リライト用改善ポイント収集
          improvementPoints = detailedScore.suggestions;
          if (validation.reasons.length > 0) {
            improvementPoints = [...improvementPoints, ...validation.reasons.slice(0, 2)];
          }
          improvementPoints = improvementPoints.slice(0, 3); // 最大3つ

          // 次の試行のために結果を保存
          bestResult = result;
          bestQuality = {
            score: detailedScore.total,
            passed: false,
            issues: [...validation.reasons, ...detailedScore.suggestions],
            evaluation_comment: `Attempt ${attempt} - score ${detailedScore.total}/100, retrying`,
          };

        } catch (error) {
          devLog.error(`Generation attempt ${attempt} failed:`, error);
          if (attempt === maxAttempts) {
            // 最終試行も失敗した場合
            if (bestResult) {
              // 前の試行の結果があれば返却
              return NextResponse.json({
                success: true,
                data: {
                  subjects: bestResult.subjects,
                  body: bestResult.body,
                  rationale: bestResult.rationale,
                  quality: bestQuality,
                  variations: bestResult.variations,
                  sources: analysis_result.sources || [],
                  factsForLetter: factsForLetter,
                },
              });
            }
            // 結果がない場合はエラー
            return NextResponse.json(
              { success: false, error: '生成に失敗しました', code: 'GENERATION_FAILED' },
              { status: 500 }
            );
          }
        }
      }

      // ここには到達しないはず
      return NextResponse.json(
        { success: false, error: '生成に失敗しました', code: 'GENERATION_FAILED' },
        { status: 500 }
      );
    },
    {
      requireAuth: false,
      rateLimit: { windowMs: 60000, maxRequests: 20 },
    }
  );
}
