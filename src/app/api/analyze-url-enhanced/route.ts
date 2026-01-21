/**
 * /api/analyze-url-enhanced
 *
 * Phase 5: サブルート探索によるファクト抽出強化API
 * トップページ + サブルート候補（about, company, recruit等）を並列取得し、
 * 複数ページからファクトを抽出する
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { safeFetch } from '@/lib/url-validator';
import { devLog } from '@/lib/logger';
import { ExtractedFactsSchema, type ExtractedFacts } from '@/types/analysis';

export const maxDuration = 60;

// サブルート候補
const SUB_ROUTE_CANDIDATES = ['/about', '/company', '/recruit', '/careers', '/news', '/press', '/ir', '/service', '/product'];
const MAX_PAGES = 4;
const FETCH_TIMEOUT = 10000; // 10秒
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;
let googleProvider: GoogleProvider | null = null;

function getGoogleProvider(): GoogleProvider {
  if (googleProvider) return googleProvider;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set!');
  }

  googleProvider = createGoogleGenerativeAI({
    apiKey: apiKey,
  });
  return googleProvider;
}

// 入力スキーマ定義
const AnalyzeUrlEnhancedSchema = z.object({
  url: z.string().url('有効なURLを入力してください'),
});

/**
 * HTMLからテキストを抽出
 */
function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  // 不要な要素を削除
  $('script').remove();
  $('style').remove();
  $('nav').remove();
  $('footer').remove();
  $('iframe').remove();
  $('noscript').remove();

  // メインコンテンツを抽出
  let mainText = '';
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main', '#main', 'body'];

  for (const selector of mainSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      mainText = element.text();
      break;
    }
  }

  // テキストをクリーンアップ
  return mainText
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000); // サブルート探索のため上限を増やす
}

/**
 * URLからコンテンツを安全に取得
 */
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const response = await safeFetch(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      FETCH_TIMEOUT,
      MAX_SIZE
    );

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractTextFromHtml(html);
  } catch (error) {
    devLog.log(`Failed to fetch ${url}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * 同一ドメインのサブルートURLを生成
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
 * ファクト抽出プロンプト
 */
function buildFactExtractionPrompt(combinedText: string): string {
  return `あなたはビジネスインテリジェンスの専門家です。以下の企業Webページのテキストから、セールスレター作成に有用なファクトを抽出してください。

【Webページのテキスト】
${combinedText}

【抽出する情報（各カテゴリ最大5件）】

1. numbers（数値情報）:
   - 従業員数、拠点数、設立年数、売上高、成長率など
   - 例: "従業員1,500名", "全国32拠点", "創業50年", "売上高300億円"

2. properNouns（固有名詞）:
   - 製品名、サービス名、ブランド名、主要取引先、使用技術など
   - 例: "〇〇システム", "△△サービス", "AWS", "Salesforce"

3. recentMoves（最近の動き）:
   - 業務提携、M&A、新サービスリリース、資金調達、受賞など
   - 例: "2024年に〇〇社と業務提携", "新サービス「△△」をリリース"

4. hiringTrends（採用動向）:
   - 積極採用中の職種、採用人数、求める人材像など
   - 例: "エンジニア積極採用中", "年間100名採用", "グローバル人材を募集"

5. companyDirection（会社の方向性）:
   - ビジョン、ミッション、重点領域、DX推進、新規事業など
   - 例: "2030年までにカーボンニュートラル達成", "AI活用を推進", "アジア展開強化"

【重要な指示】
- 具体的な情報のみ抽出（曖昧な表現は除外）
- 各カテゴリは配列形式で出力
- 情報が見つからないカテゴリは空配列[]を返す
- 嘘や推測は絶対に含めない

【出力形式】
JSON形式のみを出力してください（Markdownのコードブロックは不要）：
{
  "numbers": ["数値情報1", "数値情報2"],
  "properNouns": ["固有名詞1", "固有名詞2"],
  "recentMoves": ["最近の動き1", "最近の動き2"],
  "hiringTrends": ["採用動向1", "採用動向2"],
  "companyDirection": ["会社の方向性1", "会社の方向性2"]
}`;
}

export async function POST(request: Request) {
  return await apiGuard(
    request,
    AnalyzeUrlEnhancedSchema,
    async (data, _user) => {
      try {
        const { url } = data;

        // API Key事前チェック
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) {
          devLog.error('API Key missing for analyze-url-enhanced');
          return NextResponse.json(
            { error: 'AIサービスの設定が不足しています。管理者にお問い合わせください。' },
            { status: 503 }
          );
        }

        // 1. トップページを取得
        devLog.log('Fetching top page:', url);
        const topPageContent = await fetchPageContent(url);

        if (!topPageContent || topPageContent.length < 50) {
          return NextResponse.json(
            { error: '有効なコンテンツを抽出できませんでした' },
            { status: 400 }
          );
        }

        // 2. サブルートURLを生成し並列取得
        const subRouteUrls = buildSubRouteUrls(url);
        devLog.log('Fetching sub-routes:', subRouteUrls.slice(0, 5).join(', '));

        const subRouteResults = await Promise.allSettled(
          subRouteUrls.map(subUrl => fetchPageContent(subUrl))
        );

        // 成功したページのコンテンツを収集
        const successfulContents: string[] = [topPageContent];

        for (const result of subRouteResults) {
          if (result.status === 'fulfilled' && result.value) {
            successfulContents.push(result.value);
            if (successfulContents.length >= MAX_PAGES) break;
          }
        }

        devLog.log(`Successfully fetched ${successfulContents.length} pages`);

        // 3. 全テキストを結合（重複を除去しつつ文字数制限）
        const combinedText = successfulContents
          .map((content, i) => `--- ページ${i + 1} ---\n${content}`)
          .join('\n\n')
          .substring(0, 15000); // Geminiへの入力制限

        // 4. Geminiでファクト抽出
        const google = getGoogleProvider();
        const model = google('gemini-2.0-flash');

        const result = await generateText({
          model: model,
          prompt: buildFactExtractionPrompt(combinedText),
        });

        const responseText = result.text.trim();

        // JSONパース
        const cleanedText = responseText
          .replace(/^```json\s*/, '')
          .replace(/^```\s*/, '')
          .replace(/```$/, '')
          .trim();

        let extractedFacts: ExtractedFacts;
        try {
          const parsed = JSON.parse(cleanedText);
          extractedFacts = ExtractedFactsSchema.parse(parsed);
        } catch (e) {
          devLog.error('JSON Parse Error:', e instanceof Error ? e.message : String(e));
          devLog.error('Raw AI Response:', cleanedText.substring(0, 500));

          // パースエラー時は空のファクトを返す
          extractedFacts = {
            numbers: [],
            properNouns: [],
            recentMoves: [],
            hiringTrends: [],
            companyDirection: [],
          };
        }

        // ファクト数を計算
        const totalFactCount = Object.values(extractedFacts).reduce(
          (sum, arr) => sum + arr.length,
          0
        );

        devLog.log(`Extracted ${totalFactCount} facts from ${successfulContents.length} pages`);

        return NextResponse.json({
          success: true,
          facts: extractedFacts,
          metadata: {
            pagesAnalyzed: successfulContents.length,
            totalFactCount,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        devLog.error('Enhanced URL analysis error:', errorMessage);

        if (errorMessage.includes('API Key') || errorMessage.includes('GOOGLE')) {
          return NextResponse.json(
            { error: 'AIサービスの設定に問題があります。管理者にお問い合わせください。' },
            { status: 503 }
          );
        }

        return NextResponse.json(
          { error: `URL解析に失敗しました: ${errorMessage}` },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: false,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10,
      },
    }
  );
}
