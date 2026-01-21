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
import {
  AnalyzeInputRequestSchema,
  AnalysisResultSchema,
  ExtractedFactsSchema,
  type AnalysisResult,
  type ExtractedFacts,
} from '@/types/analysis';

export const maxDuration = 60;

/**
 * HTMLからテキストを抽出する（シンプル実装）
 */
function extractTextFromHtml(html: string): string {
  // script, style タグを除去
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

  // 全てのHTMLタグを除去
  text = text.replace(/<[^>]+>/g, ' ');

  // HTMLエンティティをデコード
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  // 連続する空白を単一スペースに
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}

// Phase 5: サブルート候補
const SUB_ROUTE_CANDIDATES = ['/about', '/company', '/recruit', '/careers', '/news', '/press', '/ir', '/service', '/product'];
const MAX_PAGES = 4;
const FETCH_TIMEOUT = 10000;
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Phase 5: サブルートURLを生成
 */
function buildSubRouteUrls(baseUrl: string): string[] {
  try {
    const parsedUrl = new URL(baseUrl);
    const origin = parsedUrl.origin;
    return SUB_ROUTE_CANDIDATES.map(path => `${origin}${path}`);
  } catch {
    return [];
  }
}

/**
 * Phase 5: ページコンテンツを安全に取得
 */
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const response = await safeFetch(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CxOLetterMaker/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      FETCH_TIMEOUT,
      MAX_SIZE
    );

    if (!response.ok) return null;
    const html = await response.text();
    return extractTextFromHtml(html).substring(0, 8000);
  } catch {
    return null;
  }
}

/**
 * Phase 5: ファクト抽出プロンプト
 */
function buildFactExtractionPrompt(combinedText: string): string {
  return `あなたはビジネスインテリジェンスの専門家です。以下の企業Webページのテキストから、セールスレター作成に有用なファクトを抽出してください。

【Webページのテキスト】
${combinedText.substring(0, 12000)}

【抽出する情報（各カテゴリ最大5件）】

1. numbers（数値情報）:
   - 従業員数、拠点数、設立年数、売上高、成長率など
   - 例: "従業員1,500名", "全国32拠点", "創業50年"

2. properNouns（固有名詞）:
   - 製品名、サービス名、ブランド名、主要取引先など
   - 例: "〇〇システム", "△△サービス"

3. recentMoves（最近の動き）:
   - 業務提携、M&A、新サービスリリース、資金調達など
   - 例: "2024年に〇〇社と業務提携"

4. hiringTrends（採用動向）:
   - 積極採用中の職種、採用人数など
   - 例: "エンジニア積極採用中"

5. companyDirection（会社の方向性）:
   - ビジョン、ミッション、重点領域など
   - 例: "AI活用を推進"

【重要な指示】
- 具体的な情報のみ抽出（曖昧な表現は除外）
- 情報が見つからないカテゴリは空配列[]を返す
- 嘘や推測は絶対に含めない

【出力形式】
JSON形式のみ：
{
  "numbers": [],
  "properNouns": [],
  "recentMoves": [],
  "hiringTrends": [],
  "companyDirection": []
}`;
}

/**
 * Phase 5: サブルート探索でファクトを抽出
 */
async function extractFactsFromUrl(baseUrl: string): Promise<ExtractedFacts | null> {
  try {
    devLog.log('Starting enhanced URL analysis:', baseUrl);

    // トップページを取得
    const topPageContent = await fetchPageContent(baseUrl);
    if (!topPageContent || topPageContent.length < 50) {
      return null;
    }

    // サブルートを並列取得
    const subRouteUrls = buildSubRouteUrls(baseUrl);
    const subRouteResults = await Promise.allSettled(
      subRouteUrls.map(subUrl => fetchPageContent(subUrl))
    );

    // 成功したページを収集
    const successfulContents: string[] = [topPageContent];
    for (const result of subRouteResults) {
      if (result.status === 'fulfilled' && result.value) {
        successfulContents.push(result.value);
        if (successfulContents.length >= MAX_PAGES) break;
      }
    }

    devLog.log(`Fetched ${successfulContents.length} pages for fact extraction`);

    // 全テキストを結合
    const combinedText = successfulContents.join('\n\n---\n\n');

    // Geminiでファクト抽出
    const extractedFacts = await generateJson({
      prompt: buildFactExtractionPrompt(combinedText),
      schema: ExtractedFactsSchema,
      maxRetries: 1,
    });

    const totalFactCount = Object.values(extractedFacts).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    devLog.log(`Extracted ${totalFactCount} facts`);

    return extractedFacts;
  } catch (error) {
    devLog.warn('Fact extraction failed:', error);
    return null;
  }
}

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

      // Phase 5: 抽出ファクトを保持
      let extractedFacts: ExtractedFacts | null = null;

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
          extractedFacts = await extractFactsFromUrl(target_url);
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

        // Phase 5: 抽出ファクトを追加
        if (extractedFacts) {
          result.extracted_facts = extractedFacts;
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
