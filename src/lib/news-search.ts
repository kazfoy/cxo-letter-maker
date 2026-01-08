import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { sanitizeForPrompt } from '@/lib/prompt-sanitizer';

type NewsSearchItem = {
  title?: string;
  snippet?: string;
  link?: string;
};

const NOISE_PATTERNS = [
  /一覧/,
  /まとめ/,
  /アーカイブ/,
  /バックナンバー/,
  /ニュースリリース/,
  /プレスリリース一覧/,
  /プレスリリース/,
  /お知らせ一覧/,
  /お知らせ/,
  /ニュース一覧/,
  /記事一覧/,
  /トピックス一覧/,
  /新着/,
  /更新履歴/,
  /イベント一覧/,
  /カテゴリ/,
  /タグ/,
  /サイトマップ/,
];

let googleProvider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleProvider() {
  if (googleProvider) return googleProvider;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set!');
  }

  googleProvider = createGoogleGenerativeAI({ apiKey });
  return googleProvider;
}

function isNoiseText(text: string): boolean {
  const normalized = text.replace(/\s+/g, '');
  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isNoiseItem(item: NewsSearchItem): boolean {
  const combined = `${item.title || ''} ${item.snippet || ''}`;
  return isNoiseText(combined);
}

function buildQuery(companyName: string): string {
  const exclusions = [
    '一覧',
    'まとめ',
    'アーカイブ',
    'リスト',
    'ニュース一覧',
    'プレスリリース一覧',
    'お知らせ一覧',
    'バックナンバー',
    'サイトマップ',
  ];
  const excludeQuery = exclusions.map((keyword) => `-${keyword}`).join(' ');
  return `${companyName} 最新 ニュース プレスリリース ${excludeQuery}`;
}

function normalizeFactLines(text: string): string {
  const cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
  if (!cleaned) return '';

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•\s]+/, ''))
    .filter((line) => !isNoiseText(line))
    .map((line) => (line.startsWith('・') ? line : `・${line}`));

  return lines.join('\n');
}

export async function searchNewsFacts(companyName: string): Promise<string> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) {
    throw new Error('Search configuration is missing');
  }

  const query = buildQuery(companyName);
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(
    query
  )}&num=8&lr=lang_ja`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Search API failed with status ${res.status}`);
  }

  const json = await res.json();
  const items: NewsSearchItem[] = Array.isArray(json.items) ? json.items : [];
  const filteredItems = items.filter((item) => !isNoiseItem(item));

  if (filteredItems.length === 0) {
    return '';
  }

  const candidatesText = filteredItems
    .map((item) => {
      const title = item.title || '';
      const snippet = item.snippet || '';
      const link = item.link || '';
      return `タイトル: ${title}\n概要: ${snippet}\nURL: ${link}`;
    })
    .join('\n\n')
    .substring(0, 4000);

  const google = getGoogleProvider();
  const model = google('gemini-2.0-flash');

  const safeCompanyName = sanitizeForPrompt(companyName, 200);
  const safeCandidates = sanitizeForPrompt(candidatesText, 4000);

  const extractPrompt = `あなたは企業ニュースのファクト抽出担当です。以下の検索結果から、具体的な事実のみを抽出してください。

【対象企業】
${safeCompanyName}

【検索結果（タイトル/概要/URL）】
${safeCandidates}

【抽出する内容】
- 具体的な取り組み（新規事業、提携、投資、事業拡大など）
- 数値（売上、成長率、調達額、出荷数、導入社数など）
- 新商品・新サービス名

【禁止事項】
- 「一覧」「まとめ」「アーカイブ」「お知らせ」などのメタ情報
- 「〜のお知らせ一覧です」のような説明文
- 根拠が曖昧な推測

【出力形式】
- 1行につき1ファクト
- 箇条書き（「・」から始める）
- ファクトが無い場合は空文字で返す
`;

  const result = await generateText({
    model,
    prompt: extractPrompt,
  });

  return normalizeFactLines(result.text);
}
