/**
 * URL分析の共通処理
 *
 * analyze-input と generate-v2 の両方から利用
 */

import { generateJson, TEMPERATURE } from '@/lib/gemini';
import { safeFetch } from '@/lib/url-validator';
import { devLog } from '@/lib/logger';
import {
  type ExtractedFacts,
  type ExtractedFactItem,
  type InformationSource,
  type SourceCategory,
} from '@/types/analysis';
import { z } from 'zod';

// サブルート候補（優先度順）- 末尾スラッシュありなし両方試行
const SUB_ROUTE_CANDIDATES_BASE = [
  // ニュース・プレスリリース系（最優先）
  'news', 'newsroom', 'topics', 'press', 'release', 'news/press',
  // IR系（深いページ含む）
  'ir', 'investor', 'investors', 'ir/news', 'ir/library', 'ir/management',
  // サステナビリティ
  'sustainability', 'esg', 'csr',
  // レポート
  'report', 'annual-report',
  // 企業情報
  'about', 'about-us', 'company', 'corporate', 'profile',
  // サービス・製品
  'service', 'services', 'product', 'products', 'solution', 'solutions',
  // 採用
  'recruit', 'careers', 'jobs',
  // 業界固有
  'mobility',
];
// 末尾スラッシュありなし両方を生成
const SUB_ROUTE_CANDIDATES = SUB_ROUTE_CANDIDATES_BASE.flatMap(p => [`/${p}/`, `/${p}`]);
const MAX_PAGES = 8;  // Phase 6: IR/ニュース系を優先しつつコスト保護
const MAX_ARTICLES_PER_LISTING = 2;  // 一覧ページから取得する記事数

/**
 * 一覧ページ判定用パターン
 */
const LISTING_PAGE_PATTERNS = [
  /\/news\/?$/i,
  /\/newsroom\/?$/i,
  /\/topics\/?$/i,
  /\/press\/?$/i,
  /\/release\/?$/i,
  /\/news\/press\/?$/i,
  /\/ir\/?$/i,
  /\/ir\/news\/?$/i,
  /\/ir\/library\/?$/i,
  /\/investor\/?$/i,
];

/**
 * 記事リンクとして無視するパターン
 */
const IGNORE_LINK_PATTERNS = [
  /^#/,                    // アンカーリンク
  /^javascript:/i,         // JavaScriptリンク
  /^mailto:/i,             // メールリンク
  /^tel:/i,                // 電話リンク
  /\.(pdf|jpg|jpeg|png|gif|svg|mp4|mp3)$/i,  // ファイル直リンク
  /\/(en|zh|ko|de|fr|es)\//i,  // 他言語ページ（日本語サイト想定）
  /\/page\/\d+/i,          // ページネーション
  /\/category\//i,         // カテゴリページ
  /\/tag\//i,              // タグページ
  /\/archive\//i,          // アーカイブページ
];

/**
 * HTMLから記事リンクを抽出
 * @param html ページHTML
 * @param baseUrl ベースURL（相対リンク解決用）
 * @returns 記事URL配列（最新順を想定）
 */
function extractArticleLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seenUrls = new Set<string>();

  try {
    const parsedBaseUrl = new URL(baseUrl);
    const origin = parsedBaseUrl.origin;
    const basePath = parsedBaseUrl.pathname;

    // aタグからhref抽出（正規表現でシンプルに）
    const linkMatches = html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi);

    for (const match of linkMatches) {
      const href = match[1];

      // 無視パターンにマッチしたらスキップ
      if (IGNORE_LINK_PATTERNS.some(p => p.test(href))) {
        continue;
      }

      // 相対URLを絶対URLに変換
      let absoluteUrl: string;
      try {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          absoluteUrl = href;
        } else if (href.startsWith('/')) {
          absoluteUrl = `${origin}${href}`;
        } else {
          // 相対パス
          const baseDirPath = basePath.endsWith('/') ? basePath : basePath.substring(0, basePath.lastIndexOf('/') + 1);
          absoluteUrl = `${origin}${baseDirPath}${href}`;
        }

        // 同一ドメインのみ
        const linkUrl = new URL(absoluteUrl);
        if (linkUrl.origin !== origin) {
          continue;
        }

        // 一覧ページ自身は除外
        if (linkUrl.pathname === basePath || linkUrl.pathname === basePath.replace(/\/$/, '')) {
          continue;
        }

        // 一覧ページより深い階層の記事ページのみ（記事は通常サブディレクトリ）
        const basePathClean = basePath.replace(/\/$/, '');
        if (!linkUrl.pathname.startsWith(basePathClean + '/')) {
          continue;
        }

        // パスが一覧ページと同じ（末尾スラッシュ違いのみ）なら除外
        if (linkUrl.pathname.replace(/\/$/, '') === basePathClean) {
          continue;
        }

        // 正規化（重複排除）
        const normalized = normalizeUrl(absoluteUrl);
        if (seenUrls.has(normalized)) {
          continue;
        }
        seenUrls.add(normalized);

        links.push(absoluteUrl);
      } catch {
        // URL解析失敗はスキップ
        continue;
      }
    }
  } catch (error) {
    devLog.warn('Failed to extract article links:', error);
  }

  // 最初に出現したリンクが最新と想定（多くのニュースサイトの構造）
  return links.slice(0, 10);  // 最大10件まで候補として返す
}

/**
 * 一覧ページかどうか判定
 */
function isListingPage(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    return LISTING_PAGE_PATTERNS.some(p => p.test(pathname));
  } catch {
    return false;
  }
}
const FETCH_TIMEOUT = 15000;
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * HTMLからページタイトルを抽出
 */
function extractTitleFromHtml(html: string): string | undefined {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    // HTMLエンティティをデコードし、余分な空白を除去
    return titleMatch[1]
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // 長すぎるタイトルは切り詰め
  }
  return undefined;
}

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

interface FetchResult {
  content: string;
  title?: string;
}

interface FetchResultWithHtml extends FetchResult {
  html: string;
}

/**
 * ページコンテンツを安全に取得（タイトル付き）
 */
async function fetchPageContent(url: string): Promise<FetchResult | null> {
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

    if (!response.ok) return null;
    const html = await response.text();
    const title = extractTitleFromHtml(html);
    const content = extractTextFromHtml(html).substring(0, 8000);
    return { content, title };
  } catch {
    return null;
  }
}

/**
 * ページコンテンツを安全に取得（HTML付き - 記事リンク抽出用）
 */
async function fetchPageContentWithHtml(url: string): Promise<FetchResultWithHtml | null> {
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

    if (!response.ok) return null;
    const html = await response.text();
    const title = extractTitleFromHtml(html);
    const content = extractTextFromHtml(html).substring(0, 8000);
    return { content, title, html };
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
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();

    // 言語プレフィックスを除去してからマッチング（/jp/, /en/ など）
    const pathWithoutLang = pathname.replace(/^\/[a-z]{2}(\/|$)/i, '/');

    // トップページ（/または空）の場合は corporate
    if (pathWithoutLang === '/' || pathWithoutLang === '') return 'corporate';

    if (pathWithoutLang.includes('/about') || pathWithoutLang.includes('/company') || pathWithoutLang.includes('/corporate') || pathWithoutLang.includes('/profile')) return 'corporate';
    if (pathWithoutLang.includes('/news') || pathWithoutLang.includes('/press') || pathWithoutLang.includes('/release') || pathWithoutLang.includes('/newsroom') || pathWithoutLang.includes('/topics')) return 'news';
    if (pathWithoutLang.includes('/recruit') || pathWithoutLang.includes('/careers') || pathWithoutLang.includes('/job')) return 'recruit';
    if (pathWithoutLang.includes('/ir') || pathWithoutLang.includes('/investor')) return 'ir';
    if (pathWithoutLang.includes('/product') || pathWithoutLang.includes('/service') || pathWithoutLang.includes('/solution') || pathWithoutLang.includes('/mobility')) return 'product';
    if (pathWithoutLang.includes('/sustainability') || pathWithoutLang.includes('/esg') || pathWithoutLang.includes('/csr')) return 'corporate';
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
      temperature: TEMPERATURE.analysis,
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
 * 一覧ページから記事を取得して処理
 */
async function fetchArticlesFromListingPage(
  listingUrl: string,
  listingHtml: string,
  sourceMap: Map<string, InformationSource>,
  maxArticles: number = MAX_ARTICLES_PER_LISTING
): Promise<Array<{ url: string; content: string; title?: string }>> {
  const articleLinks = extractArticleLinks(listingHtml, listingUrl);
  devLog.log(`Found ${articleLinks.length} article links in listing page: ${listingUrl}`);

  if (articleLinks.length === 0) {
    return [];
  }

  // 最大maxArticles件の記事を並列取得
  const targetLinks = articleLinks.slice(0, maxArticles);
  const articleResults = await Promise.allSettled(
    targetLinks.map(async (articleUrl) => {
      const result = await fetchPageContent(articleUrl);
      if (result) {
        devLog.log(`✓ Fetched article: ${articleUrl} (${result.content.length} chars, title: ${result.title || 'none'})`);
      }
      return { url: articleUrl, result };
    })
  );

  const articles: Array<{ url: string; content: string; title?: string }> = [];

  for (const settled of articleResults) {
    if (settled.status === 'fulfilled' && settled.value.result) {
      const { url: articleUrl, result } = settled.value;
      const normalizedArticleUrl = normalizeUrl(articleUrl);

      // 重複排除
      if (!sourceMap.has(normalizedArticleUrl)) {
        const articleTitle = result.title;
        articles.push({ url: articleUrl, content: result.content, title: articleTitle });
        sourceMap.set(normalizedArticleUrl, {
          url: articleUrl,
          title: articleTitle,
          category: detectCategory(articleUrl),
          isPrimary: false,
        });
      }
    }
  }

  return articles;
}

/**
 * サブルート探索でファクトを抽出（ページ単位）
 * 一覧ページからは個別記事も取得
 */
export async function extractFactsFromUrl(baseUrl: string): Promise<FactExtractionResult | null> {
  try {
    devLog.log('Starting page-level URL analysis:', baseUrl);

    // ソース追跡用Map
    const sourceMap = new Map<string, InformationSource>();
    const pageContents: Array<{ url: string; content: string; title?: string }> = [];
    // 一覧ページのHTML保持（記事リンク抽出用）
    const listingPagesHtml: Array<{ url: string; html: string }> = [];

    // トップページを取得
    const topPageResult = await fetchPageContent(baseUrl);
    if (!topPageResult || topPageResult.content.length < 50) {
      return null;
    }

    // タイトル優先順位: 抽出タイトル > hostname
    let hostname: string | undefined;
    try {
      hostname = new URL(baseUrl).hostname;
    } catch {
      hostname = undefined;
    }
    const topPageTitle = topPageResult.title || hostname;

    // トップページを追加
    const normalizedBaseUrl = normalizeUrl(baseUrl);
    pageContents.push({ url: baseUrl, content: topPageResult.content, title: topPageTitle });
    sourceMap.set(normalizedBaseUrl, {
      url: baseUrl,
      title: topPageTitle,
      category: detectCategory(baseUrl),
      isPrimary: false,
    });

    // サブルートを並列取得（HTMLも保持）
    const subRouteUrls = buildSubRouteUrls(baseUrl);
    devLog.log(`Trying ${subRouteUrls.length} sub-route URLs:`, subRouteUrls.slice(0, 10));

    const subRouteResults = await Promise.allSettled(
      subRouteUrls.map(async (subUrl) => {
        const result = await fetchPageContentWithHtml(subUrl);
        if (result) {
          devLog.log(`✓ Successfully fetched: ${subUrl} (${result.content.length} chars, title: ${result.title || 'none'})`);
        }
        return { url: subUrl, result };
      })
    );

    // 成功したページを収集（カテゴリ別に振り分け）
    const highPriorityPages: Array<{ url: string; result: FetchResultWithHtml }> = []; // news, ir
    const normalPages: Array<{ url: string; result: FetchResultWithHtml }> = [];

    for (const settled of subRouteResults) {
      if (settled.status === 'fulfilled' && settled.value.result) {
        const { url: subUrl, result } = settled.value;
        const normalizedSubUrl = normalizeUrl(subUrl);

        if (!sourceMap.has(normalizedSubUrl)) {
          const category = detectCategory(subUrl);
          if (category === 'news' || category === 'ir') {
            highPriorityPages.push({ url: subUrl, result });
          } else {
            normalPages.push({ url: subUrl, result });
          }
        }
      }
    }

    // 高優先度ページを先に処理し、残り枠で通常ページを処理
    const orderedPages = [...highPriorityPages, ...normalPages];

    for (const { url: subUrl, result } of orderedPages) {
      if (pageContents.length >= MAX_PAGES) break;

      const normalizedSubUrl = normalizeUrl(subUrl);
      if (sourceMap.has(normalizedSubUrl)) continue;

      // タイトル優先順位: 抽出タイトル > URLパスから生成
      let fallbackTitle: string | undefined;
      try {
        const urlObj = new URL(subUrl);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        fallbackTitle = pathParts.length > 0 ? pathParts[pathParts.length - 1] : undefined;
      } catch { /* ignore */ }

      const pageTitle = result.title || fallbackTitle;

      // 一覧ページの場合はHTMLを保持（後で記事取得に使用）
      if (isListingPage(subUrl)) {
        listingPagesHtml.push({ url: subUrl, html: result.html });
        sourceMap.set(normalizedSubUrl, {
          url: subUrl,
          title: pageTitle,
          category: detectCategory(subUrl),
          isPrimary: false,
        });
      } else {
        pageContents.push({ url: subUrl, content: result.content, title: pageTitle });
        sourceMap.set(normalizedSubUrl, {
          url: subUrl,
          title: pageTitle,
          category: detectCategory(subUrl),
          isPrimary: false,
        });
      }
    }

    // 一覧ページから個別記事を取得
    for (const listingPage of listingPagesHtml) {
      if (pageContents.length >= MAX_PAGES) break;

      const articles = await fetchArticlesFromListingPage(
        listingPage.url,
        listingPage.html,
        sourceMap,
        Math.min(MAX_ARTICLES_PER_LISTING, MAX_PAGES - pageContents.length)
      );

      // 記事をファクト抽出対象に追加
      for (const article of articles) {
        if (pageContents.length >= MAX_PAGES) break;
        pageContents.push(article);
      }
    }

    devLog.log(`Fetched ${pageContents.length} pages for fact extraction (including ${listingPagesHtml.length} listing pages crawled for articles)`);

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

    // ファクトが実際に抽出されたソースのみをフィルタリング
    const factsSourceUrls = new Set<string>();
    const allFacts = [
      ...mergedFacts.numbers,
      ...mergedFacts.properNouns,
      ...mergedFacts.recentMoves,
      ...mergedFacts.hiringTrends,
      ...mergedFacts.companyDirection,
    ];
    for (const fact of allFacts) {
      if (typeof fact !== 'string' && fact.sourceUrl) {
        factsSourceUrls.add(normalizeUrl(fact.sourceUrl));
      }
    }

    // ファクトが抽出されたソースのみを優先
    const sourcesWithFacts = Array.from(sourceMap.values()).filter(s =>
      factsSourceUrls.has(normalizeUrl(s.url))
    );

    // ファクトがあるソースを優先、なければ全ソース
    const sourcesToPrioritize = sourcesWithFacts.length > 0 ? sourcesWithFacts : Array.from(sourceMap.values());
    const sources = prioritizeSources(sourcesToPrioritize);

    devLog.log(`Final sources (${sources.length}):`, sources.map(s => ({
      url: s.url,
      category: s.category,
      title: s.title,
      isPrimary: s.isPrimary,
    })));

    return {
      facts: mergedFacts,
      sources,
    };
  } catch (error) {
    devLog.warn('Fact extraction failed:', error);
    return null;
  }
}
