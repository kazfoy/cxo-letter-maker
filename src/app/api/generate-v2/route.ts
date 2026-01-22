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
  calculateEventQualityScore,
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
  type Citation,
} from '@/types/generate-v2';

export const maxDuration = 60;

/**
 * Event招待状モード専用の追加指示を構築
 */
function buildEventModeInstructions(
  overrides: UserOverrides | undefined,
  sender: SenderInfo
): string {
  const eventName = overrides?.event_name || '（未指定）';
  const eventDateTime = overrides?.event_datetime || '（未指定）';
  const eventSpeakers = overrides?.event_speakers || '（未指定）';
  const eventPosition = overrides?.event_position;

  // 立ち位置テキスト（デフォルト: 協賛）
  const positionText = {
    sponsor: `弊社（${sender.company_name}）は本イベントの協賛企業として参加しております`,
    speaker: `弊社（${sender.company_name}）は本イベントに登壇企業として参加しております`,
    case_provider: `弊社（${sender.company_name}）は本イベントにて導入事例をご紹介させていただきます`,
  }[eventPosition ?? 'sponsor'];

  return `
【イベント招待状モード - 絶対ルール（厳守）】

■ ルールa: 無根拠診断の禁止
以下のパターンは使用禁止:
- NG: 「貴社では〇〇が課題と推察いたします」
- NG: 「御社では〇〇という状況が存在すると考えます」
- NG: 「貴社におかれましても〇〇ではないでしょうか」
- NG: 「確信しております」「間違いございません」

代わりに「質問型」を使用:
- OK: 「多くの企業で論点となっている〇〇について、御社でも優先度が上がっているか伺えればと存じます」
- OK: 「業界各社で〇〇への対応が進む中、御社のご状況をお聞かせいただけますでしょうか」

■ ルールb: セミナー価値は"持ち帰り"を最低3点、具体で記載
以下のような具体的なベネフィットを3つ以上明記すること:
- チェックリスト（例: 〇〇対応の自己診断シート）
- 標準プロセスの型（例: 〇〇導入の5ステップフレームワーク）
- 監査観点整理（例: 〇〇監査で指摘されやすいポイント一覧）
- ベンチマークデータ（例: 同業他社との比較指標）
- テンプレート/ひな形（例: 〇〇用のドキュメントテンプレート）

■ ルールc: 立ち位置を1行で明確化
本文冒頭近く（最初の2段落以内）に以下を1行で明記:
「${positionText}」

■ ルールd: CTAは2択のみ（参加 or 資料）
- OK: 「ご参加をご検討いただければ幸いです」
- OK: 「ご都合が合わない場合は資料をお送りいたします」
- NG: 「ぜひ一度15分お時間をいただき」← 面談要求禁止
- NG: 「資料送付と合わせてお打ち合わせの機会を」← 二重CTA禁止

■ ルールe: 文章は短め（5段落以内、300-450文字）
- 全体を5段落以内に収める
- 各段落は2-3文を目安
- 総文字数: 300-450文字

【イベント情報】
イベント名: ${eventName}
開催日時: ${eventDateTime}
登壇者: ${eventSpeakers}
立ち位置: ${positionText}
`;
}

/**
 * 生成プロンプトを構築
 */
function buildGenerationPrompt(
  analysis: AnalysisResult,
  overrides: UserOverrides | undefined,
  sender: SenderInfo,
  mode: 'draft' | 'complete' | 'event',
  format: 'letter' | 'email',
  factsForLetter: SelectedFact[] = [],
  improvementPoints?: string[],
  hasTargetUrl: boolean = false
): string {
  const companyName = overrides?.company_name || analysis.facts.company_name || '';
  const personName = overrides?.person_name || analysis.facts.person_name || '';
  const personPosition = overrides?.person_position || analysis.facts.person_position || '';

  let modeInstruction: string;
  let eventModeInstructions = '';

  if (mode === 'draft') {
    modeInstruction = '【下書きモード】情報が不足している箇所は【要確認: 〇〇】の形式でプレースホルダーを使用してください。推測で情報を埋めないでください。';
  } else if (mode === 'event') {
    modeInstruction = '【イベント招待状モード】イベントへの招待状を作成してください。';
    eventModeInstructions = buildEventModeInstructions(overrides, sender);
  } else {
    modeInstruction = '【完成モード】すべての情報を具体的に記載してください。プレースホルダー（【要確認:】、〇〇、●●など）は使用禁止です。';
  }

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
    // 新形式（ExtractedFactItem）に対応
    const formatFactArray = (arr: Array<string | { content: string }>) =>
      arr.map(f => typeof f === 'string' ? f : f.content).join(', ');

    if (extractedFacts.numbers.length > 0) {
      factItems.push(`- 数値情報: ${formatFactArray(extractedFacts.numbers)}`);
    }
    if (extractedFacts.properNouns.length > 0) {
      factItems.push(`- 固有名詞: ${formatFactArray(extractedFacts.properNouns)}`);
    }
    if (extractedFacts.recentMoves.length > 0) {
      factItems.push(`- 最近の動き: ${formatFactArray(extractedFacts.recentMoves)}`);
    }
    if (extractedFacts.hiringTrends.length > 0) {
      factItems.push(`- 採用動向: ${formatFactArray(extractedFacts.hiringTrends)}`);
    }
    if (extractedFacts.companyDirection.length > 0) {
      factItems.push(`- 会社の方向性: ${formatFactArray(extractedFacts.companyDirection)}`);
    }
    extractedFactsList = factItems.join('\n');
  }

  // Phase 6: ブリッジ構造指示（ファクトがある場合）
  let bridgeInstruction = '';
  if (factsForLetter.length > 0) {
    const bridgeReasons = factsForLetter
      .filter(f => f.bridgeReason)
      .map(f => `- ${f.quoteKey}: ${f.bridgeReason}`)
      .join('\n');

    bridgeInstruction = `\n\n【ブリッジ構造（必須）】
冒頭200文字以内に以下の流れを必ず含めること：
1. フック: ファクト引用（「貴社が〜」「〜を拝見し」）
2. ブリッジ文: ファクトと提案テーマをつなぐ1文
3. 仮説: 「〜ではないでしょうか」で提示

参考ブリッジ理由:
${bridgeReasons || '（ブリッジ理由なし）'}`;
  }

  // 選定ファクトの必須引用指示（Phase 6強化版）
  let factsForLetterInstruction = '';
  if (factsForLetter.length > 0) {
    const factsList = factsForLetter.map(f =>
      `- [${f.category}] ${f.quoteKey}: ${f.content}${f.sourceUrl ? ` (出典: ${f.sourceUrl})` : ''}`
    ).join('\n');
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

  // Phase 6: エビデンス必須ルール
  const evidenceRule = `\n\n【エビデンス必須ルール】
1. 数字: factsForLetter / proof_points に存在するもののみ使用可能
2. 企業事例: proof_points type=case_study に存在するもののみ使用可能
3. 断定禁止: 「〜が課題です」→「〜ではないでしょうか」の仮説形式に
4. ニュース: recent_news が空なら時事ネタ禁止`;

  // Phase 6: 仮説モード（URL未指定 or ファクト空の場合）
  let hypothesisModeInstruction = '';
  if (!hasTargetUrl || factsForLetter.length === 0) {
    hypothesisModeInstruction = `\n\n【仮説モード】（URL未指定またはファクト空のため適用）
- 具体的な数字・固有名詞は使用禁止（「〇〇」等のプレースホルダーも不可）
- すべての課題・状況は「〜ではないでしょうか」「〜と推察します」で終える
- 「御社では〜が課題です」のような断定は禁止
- 業界一般の傾向を根拠にする場合は「〜業界では〜という傾向があると聞きます」の形式`;
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

  // Phase 6: citations出力指示
  const citationInstruction = factsForLetter.length > 0
    ? `\n\n【citations出力ルール】
- bodyの中でfactsForLetterを引用した文ごとにcitationを出力
- sentenceは引用を含む1文（最大50文字、省略は「...」）
- quoteKeyはfactsForLetterのquoteKeyと一致させる

【重要：本文内citation禁止（厳守）】
- body本文に「[citation:...]」「【citation:...】」「[出典:...]」「(citation:...)」などのマーカーは絶対に入れないこと
- 出典表示はcitationsフィールドのみで行い、body本文は読者がそのまま読める自然な文章にすること
- 違反するとリライト対象になります`
    : '';

  return `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
以下の分析結果を基に、${format === 'email' ? 'メール' : '手紙'}を作成してください。

${modeInstruction}${eventModeInstructions}${retryInstruction}${bridgeInstruction}${factsForLetterInstruction}${evidenceRule}${hypothesisModeInstruction}${noFactsInstruction}${citationInstruction}

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
  }${factsForLetter.length > 0 ? `,
  "citations": [
    {
      "sentence": "〜を拝見しました...",
      "quoteKey": "factsForLetterのquoteKey"
    }
  ]` : ''}
}`;
}

/**
 * ProofPointを変換
 */
function convertToQualityGateProofPoints(analysisProofPoints: AnalysisResult['proof_points']): ProofPoint[] {
  return analysisProofPoints.map(p => ({
    type: p.type,
    content: p.content,
    source: p.source ?? undefined,
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
      const targetPosition = user_overrides?.person_position || (analysis_result.facts.person_position ?? undefined);
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
            attempt > 1 ? improvementPoints : undefined,
            hasTargetUrl
          );

          // 2. 生成
          const result = await generateJson({
            prompt,
            schema: GenerateV2OutputSchema,
            maxRetries: 1,
          });

          // 3. qualityGate 検証
          // eventモードはプレースホルダー禁止なのでcomplete扱い
          const validationMode = mode === 'event' ? 'complete' : mode;
          const validation = validateLetterOutput(result.body, proofPoints, {
            mode: validationMode,
            hasProofPoints: analysis_result.proof_points.length > 0,
            hasRecentNews: analysis_result.recent_news.length > 0,
            eventPosition: user_overrides?.event_position,
          });

          // 4. 詳細スコア計算（factsForLetter を使用）
          // eventモードはEvent専用スコア、それ以外は従来の詳細スコア
          let detailedScore: { total: number; suggestions: string[]; breakdown?: Record<string, number> };

          if (mode === 'event') {
            const eventScore = calculateEventQualityScore(
              result.body,
              user_overrides?.event_position
            );
            detailedScore = {
              total: eventScore.total,
              suggestions: eventScore.issues,
              breakdown: eventScore.penalties as unknown as Record<string, number>,
            };
            devLog.log(`Event quality score: ${eventScore.total}, penalties:`, eventScore.penalties);
          } else {
            // userInput はユーザーが入力した追加コンテキスト
            const userInput = user_overrides?.additional_context || '';
            const standardScore = calculateDetailedScore(
              result.body,
              hasFactNumbers,
              hasProperNouns,
              factsForLetter,
              hasTargetUrl,
              userInput
            );
            detailedScore = {
              total: standardScore.total,
              suggestions: standardScore.suggestions,
              breakdown: standardScore.breakdown as unknown as Record<string, number>,
            };
            devLog.log(`Detailed score: ${standardScore.total}, breakdown:`, standardScore.breakdown);
          }

          // 品質OK（80点以上）または最終試行
          if (detailedScore.total >= 80 || attempt === maxAttempts) {
            devLog.log(`Returning result (score: ${detailedScore.total}, attempt: ${attempt})`);

            // Phase 6: citationsを整形（sourceUrlをfactsForLetterから必ず補完）
            const citations: Citation[] = (result.citations || []).map(c => {
              const matchingFact = factsForLetter.find(f => f.quoteKey === c.quoteKey);
              return {
                sentence: c.sentence,
                quoteKey: c.quoteKey,
                // sourceUrlは必ずfactsForLetterから取得（空ならmatchingFactから補完）
                sourceUrl: c.sourceUrl || matchingFact?.sourceUrl || undefined,
                sourceTitle: c.sourceTitle || matchingFact?.sourceTitle || undefined,
              };
            });

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
                  evaluation_comment: mode === 'event'
                    ? `Event quality score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`
                    : `Detailed score: ${detailedScore.total}/100 (${detailedScore.breakdown ? Object.entries(detailedScore.breakdown).map(([k, v]) => `${k}:${v}`).join(', ') : ''})`,
                },
                variations: result.variations,
                // 追加フィールド
                sources: analysis_result.sources || [],
                factsForLetter: factsForLetter,
                citations,  // Phase 6: citations追加
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
              // Phase 6: citationsを整形（sourceUrlをfactsForLetterから必ず補完）
              const citations: Citation[] = (bestResult.citations || []).map(c => {
                const matchingFact = factsForLetter.find(f => f.quoteKey === c.quoteKey);
                return {
                  sentence: c.sentence,
                  quoteKey: c.quoteKey,
                  sourceUrl: c.sourceUrl || matchingFact?.sourceUrl || undefined,
                  sourceTitle: c.sourceTitle || matchingFact?.sourceTitle || undefined,
                };
              });

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
                  citations,  // Phase 6: citations追加
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
