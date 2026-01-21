/**
 * URL分析の共通処理
 *
 * analyze-input と generate-v2 の両方から利用
 */

import { generateJson } from '@/lib/gemini';
import { safeFetch } from '@/lib/url-validator';
import { devLog } from '@/lib/logger';
import {
  ExtractedFactsSchema,
  type ExtractedFacts,
  type InformationSource,
} from '@/types/analysis';

// サブルート候補
const SUB_ROUTE_CANDIDATES = ['/about', '/company', '/recruit', '/careers', '/news', '/press', '/ir', '/service', '/product'];
const MAX_PAGES = 4;
const FETCH_TIMEOUT = 10000;
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * HTMLからテキストを抽出する（シンプル実装）
 */
export function extractTextFromHtml(html: string): string {
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

/**
 * サブルートURLを生成
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
 * ページコンテンツを安全に取得
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
 * ファクト抽出プロンプト
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
 * URL正規化（重複排除用）
 * - search/hash除去
 * - 末尾スラッシュ除去
 * - /index.html, /index.htm除去
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname
      .replace(/\/index\.html?$/i, '')
      .replace(/\/+$/, '');
    if (!pathname) pathname = '';
    return `${parsed.origin}${pathname}`;
  } catch {
    return url;
  }
}

/**
 * パスからカテゴリを推定
 */
function detectCategory(url: string): InformationSource['category'] {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.includes('/about') || pathname.includes('/company') || pathname.includes('/corporate')) return 'corporate';
    if (pathname.includes('/news') || pathname.includes('/press') || pathname.includes('/release')) return 'news';
    if (pathname.includes('/recruit') || pathname.includes('/careers') || pathname.includes('/job')) return 'recruit';
    if (pathname.includes('/ir') || pathname.includes('/investor')) return 'ir';
    if (pathname.includes('/product') || pathname.includes('/service') || pathname.includes('/solution')) return 'product';
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * カテゴリ優先順位（小さいほど優先）
 */
const CATEGORY_PRIORITY: Record<InformationSource['category'], number> = {
  news: 0,
  ir: 1,
  recruit: 2,
  corporate: 3,
  product: 4,
  other: 5,
};

/**
 * ソースを優先順位でソートし、isPrimaryを設定
 */
function prioritizeSources(sources: InformationSource[]): InformationSource[] {
  const sorted = [...sources].sort((a, b) => {
    const catDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (catDiff !== 0) return catDiff;
    const aHasTitle = a.title ? 0 : 1;
    const bHasTitle = b.title ? 0 : 1;
    if (aHasTitle !== bHasTitle) return aHasTitle - bHasTitle;
    return a.url.length - b.url.length;
  });
  return sorted.slice(0, 8).map((source, index) => ({
    ...source,
    isPrimary: index < 3,
  }));
}

export interface FactExtractionResult {
  facts: ExtractedFacts;
  sources: InformationSource[];
}

/**
 * サブルート探索でファクトを抽出
 */
export async function extractFactsFromUrl(baseUrl: string): Promise<FactExtractionResult | null> {
  try {
    devLog.log('Starting enhanced URL analysis:', baseUrl);

    // ソース追跡用Map（isPrimaryは後でprioritizeSourcesで設定）
    const sourceMap = new Map<string, InformationSource>();

    // トップページを取得
    const topPageContent = await fetchPageContent(baseUrl);
    if (!topPageContent || topPageContent.length < 50) {
      return null;
    }

    // hostnameをfallback titleとして取得
    let hostname: string | undefined;
    try {
      hostname = new URL(baseUrl).hostname;
    } catch {
      hostname = undefined;
    }

    // トップページをソースに追加
    const normalizedBaseUrl = normalizeUrl(baseUrl);
    sourceMap.set(normalizedBaseUrl, {
      url: baseUrl,
      title: hostname,
      category: detectCategory(baseUrl),
      isPrimary: false, // 後で設定
    });

    // サブルートを並列取得
    const subRouteUrls = buildSubRouteUrls(baseUrl);
    const subRouteResults = await Promise.allSettled(
      subRouteUrls.map(async (subUrl) => {
        const content = await fetchPageContent(subUrl);
        return { url: subUrl, content };
      })
    );

    // 成功したページを収集
    const successfulContents: string[] = [topPageContent];
    for (const settled of subRouteResults) {
      if (settled.status === 'fulfilled' && settled.value.content) {
        const { url: subUrl, content } = settled.value;
        successfulContents.push(content);

        // ソースを追跡（重複排除、最大8件）
        const normalizedSubUrl = normalizeUrl(subUrl);
        if (!sourceMap.has(normalizedSubUrl) && sourceMap.size < 8) {
          sourceMap.set(normalizedSubUrl, {
            url: subUrl,
            title: undefined,
            category: detectCategory(subUrl),
            isPrimary: false, // 後で設定
          });
        }

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
    devLog.log(`Extracted ${totalFactCount} facts from ${sourceMap.size} sources`);

    // 優先順位付けしてisPrimaryを設定
    const rawSources = Array.from(sourceMap.values());
    const sources = prioritizeSources(rawSources);

    return {
      facts: extractedFacts,
      sources,
    };
  } catch (error) {
    devLog.warn('Fact extraction failed:', error);
    return null;
  }
}
