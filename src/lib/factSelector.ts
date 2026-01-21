/**
 * ファクト選定ロジック
 *
 * 抽出された全ファクトから、レター生成に最適な2-3個を選定
 */

import type { ExtractedFacts, SelectedFact } from '@/types/analysis';

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
];

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
}

/**
 * レター生成に最適なファクトを選定
 *
 * @param extractedFacts - 抽出されたファクト
 * @param targetPosition - ターゲットの役職
 * @param productStrength - 商材の強み
 * @param targetChallenges - ターゲットの課題
 * @returns 選定されたファクトと却下されたファクト
 */
export function selectFactsForLetter(
  extractedFacts: ExtractedFacts | undefined,
  targetPosition?: string,
  productStrength?: string,
  targetChallenges?: string
): FactSelectionResult {
  if (!extractedFacts) {
    return { factsForLetter: [], rejectedFacts: [] };
  }

  const allFacts: SelectedFact[] = [];

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
    for (const content of facts) {
      // NGキーワードチェック
      if (containsNgKeyword(content)) {
        continue;
      }

      const { score, reason } = calculateRelevanceScore(
        content,
        category,
        targetPosition,
        productStrength,
        targetChallenges
      );

      allFacts.push({
        content,
        category,
        relevanceScore: score,
        reason,
        quoteKey: generateQuoteKey(content, category),
      });
    }
  }

  // スコア順にソート
  allFacts.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // 上位3件を選定（ただし、異なるカテゴリから選ぶことを優先）
  const factsForLetter: SelectedFact[] = [];
  const rejectedFacts: SelectedFact[] = [];
  const usedCategories = new Set<SelectedFact['category']>();

  // 1. 各カテゴリから最高スコアのファクトを1つずつ選ぶ（最大3件）
  for (const fact of allFacts) {
    if (factsForLetter.length >= 3) break;

    if (!usedCategories.has(fact.category)) {
      factsForLetter.push(fact);
      usedCategories.add(fact.category);
    }
  }

  // 2. まだ3件未満なら、スコア順に追加
  for (const fact of allFacts) {
    if (factsForLetter.length >= 3) break;

    if (!factsForLetter.includes(fact)) {
      factsForLetter.push(fact);
    }
  }

  // 3. 残りは却下リストへ
  for (const fact of allFacts) {
    if (!factsForLetter.includes(fact)) {
      rejectedFacts.push(fact);
    }
  }

  return { factsForLetter, rejectedFacts };
}
