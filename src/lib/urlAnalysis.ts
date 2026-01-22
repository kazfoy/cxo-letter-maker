/**
 * URL分析の共通処理
 *
 * analyze-input と generate-v2 の両方から利用
 */

import { generateJson } from '@/lib/gemini';
import { safeFetch } from '@/lib/url-validator';
import { devLog } from '@/lib/logger';
import {
  type ExtractedFacts,
  type ExtractedFactItem,
  type InformationSource,
  type SourceCategory,
} from '@/types/analysis';
import { z } from 'zod';

// サブルート候補（優先度順）
const SUB_ROUTE_CANDIDATES = [
  '/news', '/newsroom', '/topics', '/press', '/release',  // ニュース系（最優先）
  '/sustainability', '/esg', '/csr',                       // サステナビリティ
  '/ir', '/investor', '/investors',                        // IR
  '/report', '/annual-report',                             // レポート
  '/about', '/about-us', '/company', '/corporate', '/profile',  // 企業情報
  '/recruit', '/careers', '/jobs',                         // 採用
  '/service', '/services', '/product', '/products', '/solution', '/solutions',  // サービス
  '/mobility',  // 自動車業界向け
];
const MAX_PAGES = 6;  // Phase 6: コスト保護しつつ粒度向上
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
 * 言語プレフィックス（/jp/, /en/, /ja/など）を保持
 */
function buildSubRouteUrls(baseUrl: string): string[] {
  try {
    const parsedUrl = new URL(baseUrl);
    const origin = parsedUrl.origin;
    const pathname = parsedUrl.pathname;

    // 言語プレフィックスを検出（/jp/, /en/, /ja/, /us/, /de/ など）
    const langPrefixMatch = pathname.match(/^\/([a-z]{2})\/?$/i) ||
                            pathname.match(/^\/([a-z]{2})\//i);
    const langPrefix = langPrefixMatch ? `/${langPrefixMatch[1]}` : '';

    // 言語プレフィックス付きでサブルートを生成
    const urls: string[] = [];
    for (const path of SUB_ROUTE_CANDIDATES) {
      // 言語プレフィックスありのパス
      if (langPrefix) {
        urls.push(`${origin}${langPrefix}${path}`);
      }
      // 言語プレフィックスなしのパス（フォールバック）
      urls.push(`${origin}${path}`);
    }

    return urls;
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
 * ファクト抽出プロンプト（ページ単位）
 */
function buildFactExtractionPrompt(pageText: string, pageUrl?: string): string {
  const urlInfo = pageUrl ? `\n【ページURL】${pageUrl}` : '';
  return `あなたはビジネスインテリジェンスの専門家です。以下の企業Webページのテキストから、セールスレター作成に有用なファクトを抽出してください。
${urlInfo}
【Webページのテキスト】
${pageText.substring(0, 12000)}

【抽出する情報（各カテゴリ最大5件）】

1. numbers（数値情報）:
   - 従業員数、拠点数、設立年数、売上高、成長率など
   - 例: "従業員1,500名", "全国32拠点", "創業50年"

2. properNouns（固有名詞）:
   - 製品名、サービス名、ブランド名、主要取引先など
   - 例: "〇〇システム", "△△サービス"

3. recentMoves（最近の動き）:
   - 業務提携、M&A、新サービスリリース、資金調達など
   - **必ず日付を含める**（例: "2024年4月に〇〇社と業務提携"）
   - 日付が不明な場合は除外

4. hiringTrends（採用動向）:
   - 積極採用中の職種、採用人数など
   - 例: "エンジニア積極採用中"

5. companyDirection（会社の方向性）:
   - ビジョン、ミッション、重点領域など
   - **中期経営計画は "[中計]" プレフィックスを付与**（例: "[中計] 2030年にカーボンニュートラル達成"）
   - 例: "AI活用を推進"

【重要な指示】
- 具体的な情報のみ抽出（曖昧な表現は除外）
- 情報が見つからないカテゴリは空配列[]を返す
- 嘘や推測は絶対に含めない
- recentMovesは日付必須（日付なしは除外）
- 中期経営計画・中計・長期ビジョンは [中計] プレフィックス必須

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

/**
 * ページ単位ファクト抽出結果
 */
interface PageFactResult {
  pageUrl: string;
  pageTitle?: string;
  pageCategory: SourceCategory;
  facts: ExtractedFacts;
}

/**
 * シンプルな文字列配列のファクトスキーマ（ページ単位抽出用）
 */
const SimpleExtractedFactsSchema = z.object({
  numbers: z.array(z.string()),
  properNouns: z.array(z.string()),
  recentMoves: z.array(z.string()),
  hiringTrends: z.array(z.string()),
  companyDirection: z.array(z.string()),
});

/**
 * ページ単位でファクトを抽出
 */
async function extractFactsFromPage(
  content: string,
  pageUrl: string,
  pageTitle?: string
): Promise<PageFactResult | null> {
  try {
    const prompt = buildFactExtractionPrompt(content, pageUrl);
    const facts = await generateJson({
      prompt,
      schema: SimpleExtractedFactsSchema,
      maxRetries: 1,
    });

    return {
      pageUrl,
      pageTitle,
      pageCategory: detectCategory(pageUrl),
      facts: facts as ExtractedFacts,
    };
  } catch (error) {
    devLog.warn(`Failed to extract facts from ${pageUrl}:`, error);
    return null;
  }
}

/**
 * 複数ページの結果をマージ（各factにsourceUrl付与）
 */
function mergePageResults(pageResults: PageFactResult[]): ExtractedFacts {
  const merged: ExtractedFacts = {
    numbers: [],
    properNouns: [],
    recentMoves: [],
    hiringTrends: [],
    companyDirection: [],
  };

  for (const pageResult of pageResults) {
    const { pageUrl, pageTitle, pageCategory, facts } = pageResult;

    // 各カテゴリのファクトにsourceUrl情報を付与
    for (const num of facts.numbers) {
      const content = typeof num === 'string' ? num : num.content;
      merged.numbers.push({
        content,
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        sourceCategory: pageCategory,
      } as ExtractedFactItem);
    }

    for (const noun of facts.properNouns) {
      const content = typeof noun === 'string' ? noun : noun.content;
      merged.properNouns.push({
        content,
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        sourceCategory: pageCategory,
      } as ExtractedFactItem);
    }

    for (const move of facts.recentMoves) {
      const content = typeof move === 'string' ? move : move.content;
      merged.recentMoves.push({
        content,
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        sourceCategory: pageCategory,
      } as ExtractedFactItem);
    }

    for (const trend of facts.hiringTrends) {
      const content = typeof trend === 'string' ? trend : trend.content;
      merged.hiringTrends.push({
        content,
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        sourceCategory: pageCategory,
      } as ExtractedFactItem);
    }

    for (const dir of facts.companyDirection) {
      const content = typeof dir === 'string' ? dir : dir.content;
      merged.companyDirection.push({
        content,
        sourceUrl: pageUrl,
        sourceTitle: pageTitle,
        sourceCategory: pageCategory,
      } as ExtractedFactItem);
    }
  }

  return merged;
}

export interface FactExtractionResult {
  facts: ExtractedFacts;
  sources: InformationSource[];
}

/**
 * サブルート探索でファクトを抽出（ページ単位）
 */
export async function extractFactsFromUrl(baseUrl: string): Promise<FactExtractionResult | null> {
  try {
    devLog.log('Starting page-level URL analysis:', baseUrl);

    // ソース追跡用Map
    const sourceMap = new Map<string, InformationSource>();
    const pageContents: Array<{ url: string; content: string; title?: string }> = [];

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

    // トップページを追加
    const normalizedBaseUrl = normalizeUrl(baseUrl);
    pageContents.push({ url: baseUrl, content: topPageContent, title: hostname });
    sourceMap.set(normalizedBaseUrl, {
      url: baseUrl,
      title: hostname,
      category: detectCategory(baseUrl),
      isPrimary: false,
    });

    // サブルートを並列取得
    const subRouteUrls = buildSubRouteUrls(baseUrl);
    const subRouteResults = await Promise.allSettled(
      subRouteUrls.map(async (subUrl) => {
        const content = await fetchPageContent(subUrl);
        return { url: subUrl, content };
      })
    );

    // 成功したページを収集（MAX_PAGES件まで）
    for (const settled of subRouteResults) {
      if (pageContents.length >= MAX_PAGES) break;

      if (settled.status === 'fulfilled' && settled.value.content) {
        const { url: subUrl, content } = settled.value;
        const normalizedSubUrl = normalizeUrl(subUrl);

        // 重複排除
        if (!sourceMap.has(normalizedSubUrl)) {
          // URLパスからfallback titleを生成
          let fallbackTitle: string | undefined;
          try {
            const urlObj = new URL(subUrl);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            fallbackTitle = pathParts.length > 0 ? pathParts[pathParts.length - 1] : undefined;
          } catch { /* ignore */ }

          pageContents.push({ url: subUrl, content, title: fallbackTitle });
          sourceMap.set(normalizedSubUrl, {
            url: subUrl,
            title: fallbackTitle,
            category: detectCategory(subUrl),
            isPrimary: false,
          });
        }
      }
    }

    devLog.log(`Fetched ${pageContents.length} pages for fact extraction`);

    // ページ単位でファクト抽出（並列実行）
    const pageFactPromises = pageContents.map(({ url, content, title }) =>
      extractFactsFromPage(content, url, title)
    );
    const pageFactResults = await Promise.allSettled(pageFactPromises);

    // 成功した結果を収集
    const successfulResults: PageFactResult[] = [];
    for (const result of pageFactResults) {
      if (result.status === 'fulfilled' && result.value) {
        successfulResults.push(result.value);
      }
    }

    if (successfulResults.length === 0) {
      devLog.warn('No facts extracted from any page');
      return null;
    }

    // マージ（各factにsourceUrl付与）
    const mergedFacts = mergePageResults(successfulResults);

    const totalFactCount = Object.values(mergedFacts).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    devLog.log(`Extracted ${totalFactCount} facts from ${successfulResults.length} pages`);

    // 優先順位付けしてisPrimaryを設定
    const rawSources = Array.from(sourceMap.values());
    const sources = prioritizeSources(rawSources);

    return {
      facts: mergedFacts,
      sources,
    };
  } catch (error) {
    devLog.warn('Fact extraction failed:', error);
    return null;
  }
}
