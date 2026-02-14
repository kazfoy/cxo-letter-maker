/**
 * ファクト選定ロジック
 *
 * 抽出された全ファクトから、レター生成に最適な2-3個を選定
 * Phase 6: ストーリー整合性・鮮度フィルタ・ブリッジ理由生成
 */

import type {
  ExtractedFacts,
  ExtractedFactItem,
  SelectedFact,
  TopicTag,
  SourceCategory,
} from '@/types/analysis';

// NGキーワード（レターに不適切なファクト）
const NG_KEYWORDS = [
  '多様性表彰',
  'ワールドプレミア',
  '製品発表会',
  '株主優待',
  '優待',
  '配当',
  '決算説明会',
  '株主総会',
  '授賞式',
  '受賞',
  'アワード',
];

// カテゴリごとの基本優先度（数値が低いほど優先）
const CATEGORY_PRIORITY: Record<SelectedFact['category'], number> = {
  recentMoves: 1,      // 最近の動き（最優先）
  companyDirection: 2, // 会社の方向性
  numbers: 3,          // 数値情報
  hiringTrends: 4,     // 採用動向
  properNouns: 5,      // 固有名詞（接続しにくい）
};

// CxO視点のキーワード（これらを含むファクトは優先）
const CXO_KEYWORDS = [
  'ガバナンス',
  '経営',
  '管理',
  '統制',
  '監査',
  'コンプライアンス',
  '組織',
  '人権',
  'グローバル',
  'サステナビリティ',
  'ESG',
  'カーボンニュートラル',
  'DX',
  'デジタル',
  '業務改革',
  'BPR',
  'リスク',
  '内部統制',
  // 公共機関・自治体向け
  '行政改革',
  '住民サービス',
  '官民連携',
  'デジタル庁',
  '自治体DX',
  '電子行政',
  'スマートシティ',
  '公共調達',
  '行政手続',
  'マイナンバー',
];

// Phase 6: トピックタグのキーワードマッピング
const TOPIC_TAG_KEYWORDS: Record<TopicTag, string[]> = {
  governance: ['ガバナンス', '内部統制', '取締役会', '監査', '統制'],
  compliance: ['コンプライアンス', '法令遵守', '規制', '適正', '不正防止'],
  supply_chain: ['サプライチェーン', '調達', '物流', 'SCM', '供給'],
  finance_ops: ['財務', '経理', '会計', '決算', '予算', '連結'],
  digital_transformation: ['DX', 'デジタル', 'IT', 'AI', 'クラウド', '自動化', 'RPA', '自治体DX', 'デジタル庁', '電子行政', 'スマートシティ'],
  sustainability: ['サステナビリティ', 'ESG', 'カーボンニュートラル', '脱炭素', '環境', 'SDGs'],
  global_expansion: ['グローバル', '海外', '国際', '進出', '越境'],
  hr_organization: ['人事', '組織', '採用', '人材', 'タレント', '働き方'],
  risk_management: ['リスク', 'BCP', '危機管理', 'セキュリティ', '情報管理'],
  growth_strategy: ['成長', 'M&A', '新規事業', '投資', '戦略', '行政改革', '官民連携', '公共調達'],
  other: [],
};

/**
 * ファクトアイテムを正規化（string | ExtractedFactItem を統一形式に）
 */
function normalizeFactItem(
  item: string | ExtractedFactItem,
  fallbackSourceUrl?: string
): {
  content: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceCategory?: SourceCategory;
} {
  if (typeof item === 'string') {
    return { content: item, sourceUrl: fallbackSourceUrl };
  }
  return {
    content: item.content,
    sourceUrl: item.sourceUrl || fallbackSourceUrl,
    sourceTitle: item.sourceTitle,
    sourceCategory: item.sourceCategory,
  };
}

/**
 * ファクト内容から日付を抽出
 */
function parseDateFromFact(content: string): { date: Date | null; isUndated: boolean } {
  // パターン: 2024年4月, 2024/4, 2024-04, 令和6年
  const patterns = [
    /(\d{4})年(\d{1,2})月/,   // 2024年4月
    /(\d{4})\/(\d{1,2})/,     // 2024/4
    /(\d{4})-(\d{1,2})/,      // 2024-04
    /(\d{4})年/,               // 2024年（月なし）
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = match[2] ? parseInt(match[2], 10) - 1 : 0; // JS monthは0-indexed
      if (year >= 2000 && year <= 2100) {
        return { date: new Date(year, month, 1), isUndated: false };
      }
    }
  }

  // 令和パターン
  const reiwaMach = content.match(/令和(\d+)年/);
  if (reiwaMach) {
    const year = 2018 + parseInt(reiwaMach[1], 10);
    return { date: new Date(year, 0, 1), isUndated: false };
  }

  return { date: null, isUndated: true };
}

/**
 * 中期経営計画かどうかを判定
 */
function isMidTermPlan(content: string): boolean {
  const markers = ['[中計]', '中期経営計画', '中期計画', '長期ビジョン', '経営計画'];
  return markers.some(marker => content.includes(marker));
}

/**
 * トピックタグを割り当て
 */
function assignTopicTags(content: string): TopicTag[] {
  const tags: TopicTag[] = [];
  const contentLower = content.toLowerCase();

  for (const [tag, keywords] of Object.entries(TOPIC_TAG_KEYWORDS) as [TopicTag, string[]][]) {
    if (tag === 'other') continue;
    if (keywords.some(kw => contentLower.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) {
    tags.push('other');
  }

  return tags;
}

/**
 * ブリッジ理由を生成（ファクト→提案テーマへの接続説明）
 */
function generateBridgeReason(
  content: string,
  topicTags: TopicTag[],
  proposalTheme?: string
): string {
  // トピックタグに基づくデフォルトのブリッジ理由
  const tagReasons: Partial<Record<TopicTag, string>> = {
    governance: '経営体制の強化に関連',
    compliance: 'コンプライアンス体制の整備に関連',
    supply_chain: 'サプライチェーン最適化に関連',
    finance_ops: '財務・経理業務の効率化に関連',
    digital_transformation: 'デジタル変革の推進に関連',
    sustainability: 'サステナビリティ経営に関連',
    global_expansion: 'グローバル展開の課題に関連',
    hr_organization: '組織・人材戦略に関連',
    risk_management: 'リスク管理体制の強化に関連',
    growth_strategy: '成長戦略の実現に関連',
  };

  // 提案テーマがある場合はそれに基づく理由を生成
  if (proposalTheme) {
    return `「${content.substring(0, 30)}...」の取り組みは、${proposalTheme}に貢献可能`;
  }

  // トピックタグに基づく理由
  const primaryTag = topicTags[0];
  if (primaryTag && tagReasons[primaryTag]) {
    return tagReasons[primaryTag]!;
  }

  return '経営課題の解決に関連';
}

/**
 * ブリッジ信頼度を計算
 */
function calculateBridgeConfidence(
  content: string,
  topicTags: TopicTag[],
  proposalTheme?: string
): number {
  let confidence = 50; // ベース

  // トピックタグが明確（other以外）なら+15
  if (topicTags.length > 0 && topicTags[0] !== 'other') {
    confidence += 15;
  }

  // 複数のタグがあれば+10（関連性が高い）
  if (topicTags.length >= 2) {
    confidence += 10;
  }

  // 提案テーマとの一致があれば+20
  if (proposalTheme) {
    const themeLower = proposalTheme.toLowerCase();
    const contentLower = content.toLowerCase();
    if (contentLower.includes(themeLower) || themeLower.includes(contentLower.substring(0, 20))) {
      confidence += 20;
    }
  }

  // 具体的な数字を含む場合+10
  if (/[\d,]+[%％万億件社名]/.test(content)) {
    confidence += 10;
  }

  return Math.min(100, confidence);
}

/**
 * 鮮度フィルタ（1年超の古いファクトを除外、中計は例外）
 */
function filterByFreshness<T extends {
  isMidTermPlan: boolean;
  date: Date | null;
}>(
  facts: T[],
  maxAgeDays: number = 365
): T[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  return facts.filter(fact => {
    // 中計は常に許可
    if (fact.isMidTermPlan) return true;

    // 日付がある場合、cutoffより新しいもののみ許可
    if (fact.date && fact.date < cutoff) return false;

    return true;
  });
}

/**
 * quoteKeyを生成
 *
 * @param content - ファクトの内容
 * @param category - カテゴリ
 * @returns quoteKey（本文引用チェック用）
 */
function generateQuoteKey(content: string, category: SelectedFact['category']): string {
  switch (category) {
    case 'numbers': {
      // 数字部分を抽出（コンマを含む数字も対応）
      const numberMatch = content.match(/[\d,]+/);
      if (numberMatch) {
        return numberMatch[0].replace(/,/g, '');
      }
      // 数字がない場合は先頭20文字
      return content.substring(0, 20);
    }
    case 'properNouns': {
      // 固有名詞そのまま（最大30文字）
      return content.substring(0, 30);
    }
    case 'recentMoves': {
      // 日付または短いキーワード
      const yearMatch = content.match(/\d{4}年/);
      if (yearMatch) {
        return yearMatch[0];
      }
      // 業務提携、M&A等のキーワードを探す
      const actionKeywords = ['提携', 'M&A', '買収', '合併', 'リリース', '発表', '開始', '設立'];
      for (const keyword of actionKeywords) {
        if (content.includes(keyword)) {
          return keyword;
        }
      }
      // デフォルトは先頭15文字
      return content.substring(0, 15);
    }
    case 'companyDirection': {
      // 重要キーワードを探す
      const directionKeywords = [
        'カーボンニュートラル',
        'DX',
        'デジタル',
        'サステナビリティ',
        'グローバル',
        'ESG',
        '経営',
        'ビジョン',
        '中期経営',
        '成長戦略',
      ];
      for (const keyword of directionKeywords) {
        if (content.includes(keyword)) {
          return keyword;
        }
      }
      return content.substring(0, 15);
    }
    case 'hiringTrends': {
      // 職種キーワード
      const jobKeywords = ['経営企画', '管理', 'DX', '人事', '財務', 'IT', 'エンジニア', '営業'];
      for (const keyword of jobKeywords) {
        if (content.includes(keyword)) {
          return keyword;
        }
      }
      return content.substring(0, 15);
    }
    default:
      return content.substring(0, 20);
  }
}

/**
 * ファクトの関連度スコアを計算
 */
function calculateRelevanceScore(
  content: string,
  category: SelectedFact['category'],
  targetPosition?: string,
  productStrength?: string,
  targetChallenges?: string
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // 1. カテゴリによる基本スコア（優先度が高いほどスコアが高い）
  const basePriority = CATEGORY_PRIORITY[category];
  score += (6 - basePriority) * 10; // recentMoves: 50, companyDirection: 40, numbers: 30, hiringTrends: 20, properNouns: 10
  reasons.push(`カテゴリ優先度: ${category}`);

  // 2. CxO視点キーワードボーナス
  const cxoKeywordHits = CXO_KEYWORDS.filter(keyword =>
    content.includes(keyword)
  );
  if (cxoKeywordHits.length > 0) {
    score += cxoKeywordHits.length * 15;
    reasons.push(`CxO視点キーワード: ${cxoKeywordHits.join(', ')}`);
  }

  // 3. 役職に関連するキーワードボーナス
  if (targetPosition) {
    const positionKeywords = extractKeywords(targetPosition);
    const positionHits = positionKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword.toLowerCase())
    );
    if (positionHits.length > 0) {
      score += 20;
      reasons.push(`役職関連: ${positionHits.join(', ')}`);
    }
  }

  // 4. 商材接続スコア（productStrength/targetChallengesとのマッチング）
  const productKeywords = extractKeywords(productStrength || '');
  const challengeKeywords = extractKeywords(targetChallenges || '');
  const allMatchKeywords = [...productKeywords, ...challengeKeywords];

  const matchedKeywords = allMatchKeywords.filter(keyword =>
    content.toLowerCase().includes(keyword.toLowerCase())
  );
  if (matchedKeywords.length > 0) {
    score += 20;
    reasons.push(`商材接続: ${matchedKeywords.join(', ')}`);
  }

  // 5. 具体性ボーナス（数字を含む場合）
  if (/[\d,]+/.test(content)) {
    score += 10;
    reasons.push('具体的な数値を含む');
  }

  return {
    score: Math.min(100, score),
    reason: reasons.join(' / '),
  };
}

/**
 * テキストからキーワードを抽出
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];

  // 日本語と英語の単語を抽出
  const keywords: string[] = [];

  // 日本語キーワード（2文字以上の連続）
  const japaneseMatches = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{2,}/g);
  if (japaneseMatches) {
    keywords.push(...japaneseMatches);
  }

  // 英語キーワード（3文字以上）
  const englishMatches = text.match(/[A-Za-z]{3,}/g);
  if (englishMatches) {
    keywords.push(...englishMatches);
  }

  return keywords;
}

/**
 * NGキーワードを含むかチェック
 */
function containsNgKeyword(content: string): boolean {
  return NG_KEYWORDS.some(keyword => content.includes(keyword));
}

export interface FactSelectionResult {
  factsForLetter: SelectedFact[];
  rejectedFacts: SelectedFact[];
  /** ファクトが不足しており、フォールバックファクトで補強された場合 true */
  usedFallback: boolean;
}

// ファクト不足の閾値（これ未満の場合フォールバックを使用）
const FACT_SHORTAGE_THRESHOLD = 3;

/**
 * 業界情報に基づくフォールバックファクトを生成
 *
 * URL解析でファクトが十分に取得できなかった場合に、
 * 業界一般のトレンドを補助的に提供する。
 */
function generateFallbackFacts(
  industry?: string,
  companyName?: string
): SelectedFact[] {
  const fallbacks: SelectedFact[] = [];

  // 公共機関・自治体向けフォールバック
  const publicSectorKeywords = [
    '自治体', '市役所', '県庁', '省', '庁', '公共', '行政', '官公庁',
    '地方公共団体', '独立行政法人', '公社', '公団',
  ];
  const isPublicSector = publicSectorKeywords.some(
    kw => (industry || '').includes(kw) || (companyName || '').includes(kw)
  );

  if (isPublicSector) {
    fallbacks.push(
      {
        content: 'デジタル庁の推進する自治体DX推進計画に基づき、全国の自治体で行政手続のオンライン化が加速',
        category: 'companyDirection',
        relevanceScore: 35,
        reason: 'フォールバック: 公共機関向け業界トレンド',
        quoteKey: '自治体DX',
        topicTags: ['digital_transformation'],
        bridgeReason: '行政デジタル化の推進に関連',
        confidence: 40,
        isMidTermPlan: false,
      },
      {
        content: '総務省が推進する自治体情報システムの標準化・共通化の期限（2025年度末）に向けた対応が本格化',
        category: 'recentMoves',
        relevanceScore: 30,
        reason: 'フォールバック: 公共機関向け業界トレンド',
        quoteKey: '標準化',
        topicTags: ['digital_transformation', 'governance'],
        bridgeReason: '行政システム標準化への対応に関連',
        confidence: 40,
        isMidTermPlan: false,
      }
    );
  } else {
    // 民間企業向け汎用フォールバック
    fallbacks.push(
      {
        content: '帝国データバンクの調査によると、企業の約7割がDX推進を経営課題と認識（2024年調査）',
        category: 'companyDirection',
        relevanceScore: 25,
        reason: 'フォールバック: 業界一般トレンド（DX）',
        quoteKey: 'DX推進',
        topicTags: ['digital_transformation'],
        bridgeReason: '業界全体のデジタル変革トレンドに関連',
        confidence: 35,
        isMidTermPlan: false,
      },
      {
        content: '経済産業省「DXレポート」が指摘する2025年の崖への対応として、基幹システム刷新が業界共通の課題に',
        category: 'companyDirection',
        relevanceScore: 20,
        reason: 'フォールバック: 業界一般トレンド（2025年の崖）',
        quoteKey: '2025年の崖',
        topicTags: ['digital_transformation', 'risk_management'],
        bridgeReason: 'レガシーシステムのリスク対応に関連',
        confidence: 35,
        isMidTermPlan: false,
      }
    );
  }

  return fallbacks;
}

/**
 * レター生成に最適なファクトを選定
 *
 * @param extractedFacts - 抽出されたファクト
 * @param targetPosition - ターゲットの役職
 * @param productStrength - 商材の強み
 * @param targetChallenges - ターゲットの課題
 * @param proposalTheme - 提案テーマ（ブリッジ理由生成用）
 * @param confidenceThreshold - 信頼度閾値（デフォルト60）
 * @param options - 追加オプション（業界名、企業名など、フォールバック用）
 * @returns 選定されたファクトと却下されたファクト
 */
export function selectFactsForLetter(
  extractedFacts: ExtractedFacts | undefined,
  targetPosition?: string,
  productStrength?: string,
  targetChallenges?: string,
  proposalTheme?: string,
  confidenceThreshold: number = 60,
  options?: { industry?: string; companyName?: string }
): FactSelectionResult {
  if (!extractedFacts) {
    // ファクト未取得でもフォールバックで生成を試みる
    const fallbackFacts = generateFallbackFacts(
      options?.industry,
      options?.companyName
    );
    return { factsForLetter: fallbackFacts, rejectedFacts: [], usedFallback: true };
  }

  // 中間データ構造（正規化＋日付解析＋中計判定）
  interface NormalizedFact {
    content: string;
    category: SelectedFact['category'];
    sourceUrl?: string;
    sourceTitle?: string;
    sourceCategory?: SourceCategory;
    date: Date | null;
    isUndated: boolean;
    isMidTermPlan: boolean;
  }

  const normalizedFacts: NormalizedFact[] = [];

  // 全カテゴリからファクトを収集
  const categories: Array<{ key: keyof ExtractedFacts; category: SelectedFact['category'] }> = [
    { key: 'recentMoves', category: 'recentMoves' },
    { key: 'companyDirection', category: 'companyDirection' },
    { key: 'numbers', category: 'numbers' },
    { key: 'hiringTrends', category: 'hiringTrends' },
    { key: 'properNouns', category: 'properNouns' },
  ];

  for (const { key, category } of categories) {
    const facts = extractedFacts[key] || [];
    for (const item of facts) {
      // 正規化
      const normalized = normalizeFactItem(item);
      const { content, sourceUrl, sourceTitle, sourceCategory } = normalized;

      // NGキーワードチェック
      if (containsNgKeyword(content)) {
        continue;
      }

      // 日付解析
      const { date, isUndated } = parseDateFromFact(content);

      // 中計判定
      const midTermPlan = isMidTermPlan(content);

      normalizedFacts.push({
        content,
        category,
        sourceUrl,
        sourceTitle,
        sourceCategory,
        date,
        isUndated,
        isMidTermPlan: midTermPlan,
      });
    }
  }

  // 鮮度フィルタ（1年超の古いファクトを除外、中計は例外）
  const freshFacts = filterByFreshness(normalizedFacts);

  // スコアリング＆SelectedFact変換
  const allFacts: SelectedFact[] = [];

  for (const fact of freshFacts) {
    const { content, category, sourceUrl, sourceTitle, sourceCategory, date, isUndated, isMidTermPlan: midTermPlan } = fact;

    // 基本スコア計算
    let { score, reason } = calculateRelevanceScore(
      content,
      category,
      targetPosition,
      productStrength,
      targetChallenges
    );

    // 日付不明のrecentMovesは優先度-15
    if (category === 'recentMoves' && isUndated) {
      score -= 15;
      reason += ' / 日付不明により減点';
    }

    // トピックタグ割り当て
    const topicTags = assignTopicTags(content);

    // ブリッジ理由生成
    const bridgeReason = generateBridgeReason(content, topicTags, proposalTheme);

    // ブリッジ信頼度計算
    const confidence = calculateBridgeConfidence(content, topicTags, proposalTheme);

    // 日付文字列（あれば）
    const publishedAt = date ? `${date.getFullYear()}年${date.getMonth() + 1}月` : undefined;

    allFacts.push({
      content,
      category,
      relevanceScore: Math.max(0, score),
      reason,
      quoteKey: generateQuoteKey(content, category),
      topicTags,
      bridgeReason,
      confidence,
      publishedAt,
      isMidTermPlan: midTermPlan,
      sourceUrl,
      sourceTitle,
      sourceCategory,
    });
  }

  // スコア順にソート
  allFacts.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // 信頼度閾値によるフィルタリング
  const confidentFacts = allFacts.filter(f => f.confidence >= confidenceThreshold);

  // 上位3件を選定（信頼度閾値を満たすもの優先、異なるカテゴリから選ぶことを優先）
  const factsForLetter: SelectedFact[] = [];
  const rejectedFacts: SelectedFact[] = [];
  const usedCategories = new Set<SelectedFact['category']>();

  // 1. 信頼度閾値を満たすファクトから、各カテゴリで最高スコアを1つずつ選ぶ
  for (const fact of confidentFacts) {
    if (factsForLetter.length >= 3) break;

    if (!usedCategories.has(fact.category)) {
      factsForLetter.push(fact);
      usedCategories.add(fact.category);
    }
  }

  // 2. まだ3件未満なら、信頼度閾値を満たすファクトからスコア順に追加
  for (const fact of confidentFacts) {
    if (factsForLetter.length >= 3) break;

    if (!factsForLetter.includes(fact)) {
      factsForLetter.push(fact);
    }
  }

  // 3. それでも3件未満なら、全ファクトからスコア順に追加（信頼度は低いが使う）
  if (factsForLetter.length < 3) {
    for (const fact of allFacts) {
      if (factsForLetter.length >= 3) break;

      if (!factsForLetter.includes(fact)) {
        factsForLetter.push(fact);
      }
    }
  }

  // 4. ファクト不足時のフォールバック: 業界一般トレンドで補強
  let usedFallback = false;
  if (factsForLetter.length < FACT_SHORTAGE_THRESHOLD) {
    const fallbackFacts = generateFallbackFacts(
      options?.industry,
      options?.companyName
    );
    for (const fallback of fallbackFacts) {
      if (factsForLetter.length >= FACT_SHORTAGE_THRESHOLD) break;
      factsForLetter.push(fallback);
      usedFallback = true;
    }
  }

  // 5. 残りは却下リストへ
  for (const fact of allFacts) {
    if (!factsForLetter.includes(fact)) {
      rejectedFacts.push(fact);
    }
  }

  return { factsForLetter, rejectedFacts, usedFallback };
}
