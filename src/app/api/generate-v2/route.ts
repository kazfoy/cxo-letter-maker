/**
 * /api/generate-v2
 *
 * 分析結果を材料に、推測なしでCxO向けレターを生成する
 * Self-Correction: qualityGate → AI採点 → 再生成のループ
 */

import { NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { generateJson, scoreLetterWithAI } from '@/lib/gemini';
import { validateLetterOutput, calculateQualityScore, type ProofPoint } from '@/lib/qualityGate';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';
import type { AnalysisResult } from '@/types/analysis';
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
  isRetry: boolean = false
): string {
  const companyName = overrides?.company_name || analysis.facts.company_name || '';
  const personName = overrides?.person_name || analysis.facts.person_name || '';
  const personPosition = overrides?.person_position || analysis.facts.person_position || '';

  const modeInstruction = mode === 'draft'
    ? '【下書きモード】情報が不足している箇所は【要確認: 〇〇】の形式でプレースホルダーを使用してください。推測で情報を埋めないでください。'
    : '【完成モード】すべての情報を具体的に記載してください。プレースホルダー（【要確認:】、〇〇、●●など）は使用禁止です。';

  const retryInstruction = isRetry
    ? '\n\n【リトライ注意】前回の生成は品質基準を満たしませんでした。以下の点に特に注意してください：\n- 具体的な数値や事例を必ず含める\n- CxO視点（ガバナンス、リスク、経営スピード）で記述する\n- 350-500文字の範囲内で簡潔にまとめる'
    : '';

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

  return `あなたは大手企業のCxO（経営層）から数多くの面談を獲得してきたトップセールスです。
以下の分析結果を基に、${format === 'email' ? 'メール' : '手紙'}を作成してください。

${modeInstruction}${retryInstruction}

【絶対ルール】
1. 架空の数字・社名・実績は禁止。proof_points / recent_news / facts にあるものだけ使用可能
2. 仮説は「〜ではないでしょうか」「〜と推察します」のような可能性表現のみ使用
3. 冒頭の儀礼的褒め言葉（「ご活躍を拝見」「感銘を受けました」等）は禁止
4. 「業務効率化」「コスト削減」ではなく「ガバナンス強化」「経営スピード向上」「リスク低減」の視点
5. 文字数: 350-500文字（一画面で読める長さ）
6. CTAは軽量に（「15分だけ」「情報交換として」）

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

      const maxAttempts = 3;
      let bestResult: GenerateV2Output | null = null;
      let bestQuality: Quality = {
        score: null,
        passed: false,
        issues: [],
        evaluation_comment: 'Not evaluated',
      };

      const proofPoints = convertToQualityGateProofPoints(analysis_result.proof_points);

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
            attempt > 1
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

          if (validation.ok) {
            // 品質OK - AI採点をスキップして即返却（速度優先）
            devLog.log('Quality gate passed, returning result');
            return NextResponse.json({
              success: true,
              data: {
                subjects: result.subjects,
                body: result.body,
                rationale: result.rationale,
                quality: {
                  score: null,
                  passed: true,
                  issues: [],
                  evaluation_comment: 'qualityGate passed, scoring skipped for speed',
                },
                variations: result.variations,
              },
            });
          }

          // 4. 品質NG - 機械スコア計算
          const machineScore = calculateQualityScore(result.body, proofPoints, mode);
          devLog.log(`Machine score: ${machineScore}, issues: ${validation.reasons.join(', ')}`);

          // 80点以上なら許容
          if (machineScore >= 80) {
            devLog.log('Machine score >= 80, returning result');
            return NextResponse.json({
              success: true,
              data: {
                subjects: result.subjects,
                body: result.body,
                rationale: result.rationale,
                quality: {
                  score: machineScore,
                  passed: true,
                  issues: validation.reasons,
                  evaluation_comment: `Machine score: ${machineScore}/100`,
                },
                variations: result.variations,
              },
            });
          }

          // 5. 最終試行またはスコアが60以上ならAI採点
          if (attempt === maxAttempts || machineScore >= 60) {
            try {
              const aiScore = await scoreLetterWithAI(result.body, mode);
              devLog.log(`AI score: ${aiScore.total}`);

              if (aiScore.total >= 80 || attempt === maxAttempts) {
                return NextResponse.json({
                  success: true,
                  data: {
                    subjects: result.subjects,
                    body: result.body,
                    rationale: result.rationale,
                    quality: {
                      score: aiScore.total,
                      passed: aiScore.total >= 80,
                      issues: validation.reasons,
                      evaluation_comment: aiScore.comment,
                    },
                    variations: result.variations,
                  },
                });
              }
            } catch (scoreError) {
              devLog.warn('AI scoring failed:', scoreError);
              // AI採点失敗時は機械スコアで返却
              if (attempt === maxAttempts) {
                return NextResponse.json({
                  success: true,
                  data: {
                    subjects: result.subjects,
                    body: result.body,
                    rationale: result.rationale,
                    quality: {
                      score: machineScore,
                      passed: machineScore >= 70,
                      issues: validation.reasons,
                      evaluation_comment: 'AI scoring failed, using machine score',
                    },
                    variations: result.variations,
                  },
                });
              }
            }
          }

          // 次の試行のために結果を保存
          bestResult = result;
          bestQuality = {
            score: machineScore,
            passed: false,
            issues: validation.reasons,
            evaluation_comment: `Attempt ${attempt} - score too low, retrying`,
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
