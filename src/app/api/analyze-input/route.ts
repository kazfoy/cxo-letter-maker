/**
 * /api/analyze-input
 *
 * 入力（URL/PDF/メモ）から、生成に使える材料を「推測なし」で正規化JSONに落とす
 */

import { NextResponse } from 'next/server';
import { apiGuard } from '@/lib/api-guard';
import { generateJson } from '@/lib/gemini';
import { safeFetch } from '@/lib/url-validator';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';
import { devLog } from '@/lib/logger';
import { extractFactsFromUrl, extractTextFromHtml } from '@/lib/urlAnalysis';
import {
  AnalyzeInputRequestSchema,
  AnalysisResultSchema,
  type AnalysisResult,
  type ExtractedFacts,
  type InformationSource,
} from '@/types/analysis';

export const maxDuration = 60;

/**
 * 安全なデフォルト分析結果を生成
 */
function createSafeDefaultResult(errorMessage: string): AnalysisResult {
  return {
    facts: {},
    signals: [],
    recent_news: [],
    proof_points: [],
    hypotheses: {
      timing_reason: '情報不足のため特定できません',
      challenge_hypothesis: '情報不足のため特定できません',
      value_proposition: '情報不足のため特定できません',
      cta_suggestion: '15分だけ情報交換させていただけますか',
    },
    missing_info: [
      {
        field: 'target_url',
        priority: 'high',
        suggestion: 'ターゲット企業のURLを入力してください',
      },
      {
        field: 'user_notes',
        priority: 'high',
        suggestion: '企業の課題や背景情報を入力してください',
      },
    ],
    risk_flags: [
      {
        type: 'missing_info',
        message: errorMessage,
        severity: 'high',
      },
    ],
  };
}

export async function POST(request: Request) {
  return await apiGuard(
    request,
    AnalyzeInputRequestSchema,
    async (data, _user) => {
      const { target_url, pdf_text, user_notes, sender_info } = data;

      let extractedContent = '';
      const riskFlags: { type: string; message: string; severity: string }[] = [];

      // Phase 5: 抽出ファクトとソースを保持
      let extractedFacts: ExtractedFacts | null = null;
      let extractedSources: InformationSource[] = [];

      // 1. URL解析
      if (target_url) {
        try {
          devLog.log('Fetching URL:', target_url);
          const response = await safeFetch(
            target_url,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CxOLetterMaker/1.0)',
                Accept: 'text/html,application/xhtml+xml',
              },
            },
            15000, // 15秒タイムアウト
            5 * 1024 * 1024 // 5MB制限
          );

          const html = await response.text();
          const mainText = extractTextFromHtml(html).substring(0, 8000);

          if (mainText.length > 100) {
            extractedContent += `【URL情報】\n${mainText}\n\n`;
          } else {
            riskFlags.push({
              type: 'missing_info',
              message: 'URLからテキストを十分に取得できませんでした',
              severity: 'medium',
            });
          }

          // Phase 5: サブルート探索でファクト抽出（並列実行）
          const factResult = await extractFactsFromUrl(target_url);
          if (factResult) {
            extractedFacts = factResult.facts;
            extractedSources = factResult.sources;
          }
        } catch (error) {
          devLog.warn('URL extraction failed:', error);
          riskFlags.push({
            type: 'missing_info',
            message: `URL解析失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'high',
          });
        }
      }

      // 2. PDF テキスト追加
      if (pdf_text) {
        extractedContent += `【PDF情報】\n${pdf_text.substring(0, 5000)}\n\n`;
      }

      // 3. ユーザーメモ追加（最優先）
      if (user_notes) {
        extractedContent += `【ユーザーメモ】\n${user_notes}\n\n`;
      }

      // 入力が何もない場合
      if (!extractedContent.trim()) {
        devLog.warn('No input content provided');
        return NextResponse.json({
          success: true,
          data: createSafeDefaultResult('入力情報がありません'),
        });
      }

      // 4. Gemini分析
      const analysisPrompt = `あなたは企業分析とセールスレター戦略の専門家です。
以下の情報を分析し、CxO向けセールスレターの構成に必要な情報を抽出してください。

【重要ルール】
- 入力情報から読み取れた事実のみを抽出する
- 推測は hypotheses（仮説）として明示する
- 確認できない情報は missing_info に記載する
- 架空の数字や事例は絶対に作成しない

【収集した情報】
${sanitizeForPrompt(extractedContent, 8000)}

${sender_info ? `【送り手情報】\n会社名: ${sanitizeForPrompt(sender_info.company_name, 200)}\nサービス: ${sanitizeForPrompt(sender_info.service_description, 1000)}` : ''}

【出力形式】
以下のJSON形式で出力してください：
{
  "facts": {
    "company_name": "企業名（見つかれば）",
    "person_name": "担当者名（見つかれば）",
    "person_position": "役職（見つかれば）",
    "industry": "業界（見つかれば）",
    "company_size": "企業規模（見つかれば）",
    "recent_events": ["最近の出来事1", "最近の出来事2"]
  },
  "signals": [
    { "type": "growth|challenge|transformation|compliance|competition", "description": "経営シグナルの説明", "confidence": "high|medium|low" }
  ],
  "recent_news": [
    { "headline": "ニュース見出し", "summary": "要約", "date": "日付", "source_url": "URL" }
  ],
  "proof_points": [
    { "type": "numeric|case_study|news|inference", "content": "証拠の内容", "source": "出典", "confidence": "high|medium|low" }
  ],
  "hypotheses": {
    "timing_reason": "なぜ今連絡するのか（仮説）",
    "challenge_hypothesis": "経営課題の仮説",
    "value_proposition": "提供価値の仮説",
    "cta_suggestion": "軽量CTA提案"
  },
  "missing_info": [
    { "field": "フィールド名", "priority": "high|medium|low", "suggestion": "入力の提案" }
  ],
  "risk_flags": [
    { "type": "missing_info|stale_data|unverified|competitor_mention", "message": "警告メッセージ", "severity": "high|medium|low" }
  ]
}`;

      try {
        const result = await generateJson({
          prompt: analysisPrompt,
          schema: AnalysisResultSchema,
          maxRetries: 1,
        });

        // URL解析で発生したリスクフラグを追加
        if (riskFlags.length > 0) {
          result.risk_flags = [
            ...result.risk_flags,
            ...riskFlags.map(rf => ({
              type: rf.type as 'missing_info' | 'stale_data' | 'unverified' | 'competitor_mention',
              message: rf.message,
              severity: rf.severity as 'high' | 'medium' | 'low',
            })),
          ];
        }

        // Phase 5: 抽出ファクトとソースを追加
        if (extractedFacts) {
          result.extracted_facts = extractedFacts;
        }
        if (extractedSources.length > 0) {
          result.sources = extractedSources;
        }

        // target_url を追加（V2生成でhasTargetUrl判定に使用）
        if (target_url) {
          result.target_url = target_url;
        }

        devLog.log('Analysis completed successfully');
        return NextResponse.json({
          success: true,
          data: result,
        });
      } catch (error) {
        devLog.error('Analysis failed:', error);
        // AI分析が失敗しても安全なデフォルトを返す
        return NextResponse.json({
          success: true,
          data: createSafeDefaultResult('AI分析に失敗しました。入力内容を確認してください。'),
        });
      }
    },
    {
      requireAuth: false,
      rateLimit: { windowMs: 60000, maxRequests: 10 },
    }
  );
}
