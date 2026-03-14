import type { SelectedFact } from '@/types/analysis';
import { CATEGORY_PRIORITY, CXO_KEYWORDS_PRIVATE, CXO_KEYWORDS_PUBLIC } from './constants';

export function getCxoKeywords(isPublicSector: boolean): string[] {
  return isPublicSector ? CXO_KEYWORDS_PUBLIC : CXO_KEYWORDS_PRIVATE;
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const keywords: string[] = [];
  const japaneseMatches = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{2,}/g);
  if (japaneseMatches) keywords.push(...japaneseMatches);
  const englishMatches = text.match(/[A-Za-z]{3,}/g);
  if (englishMatches) keywords.push(...englishMatches);
  return keywords;
}

export function calculateRelevanceScore(
  content: string,
  category: SelectedFact['category'],
  targetPosition?: string,
  productStrength?: string,
  targetChallenges?: string,
  isPublicSector: boolean = false,
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  const basePriority = CATEGORY_PRIORITY[category];
  score += (6 - basePriority) * 10;
  reasons.push(`カテゴリ優先度: ${category}`);

  const cxoKeywords = getCxoKeywords(isPublicSector);
  const cxoKeywordHits = cxoKeywords.filter((keyword) => content.includes(keyword));
  if (cxoKeywordHits.length > 0) {
    score += cxoKeywordHits.length * 15;
    reasons.push(`CxO視点キーワード: ${cxoKeywordHits.join(', ')}`);
  }

  if (targetPosition) {
    const positionKeywords = extractKeywords(targetPosition);
    const positionHits = positionKeywords.filter((keyword) =>
      content.toLowerCase().includes(keyword.toLowerCase()),
    );
    if (positionHits.length > 0) {
      score += 20;
      reasons.push(`役職関連: ${positionHits.join(', ')}`);
    }
  }

  const productKeywords = extractKeywords(productStrength || '');
  const challengeKeywords = extractKeywords(targetChallenges || '');
  const allMatchKeywords = [...productKeywords, ...challengeKeywords];
  const matchedKeywords = allMatchKeywords.filter((keyword) =>
    content.toLowerCase().includes(keyword.toLowerCase()),
  );
  if (matchedKeywords.length > 0) {
    score += 20;
    reasons.push(`商材接続: ${matchedKeywords.join(', ')}`);
  }

  if (/[\d,]+/.test(content)) {
    score += 10;
    reasons.push('具体的な数値を含む');
  }

  return {
    score: Math.min(100, score),
    reason: reasons.join(' / '),
  };
}

export function generateQuoteKey(content: string, category: SelectedFact['category']): string {
  switch (category) {
    case 'numbers': {
      const numberMatch = content.match(/[\d,]+/);
      if (numberMatch) return numberMatch[0].replace(/,/g, '');
      return content.substring(0, 20);
    }
    case 'properNouns':
      return content.substring(0, 30);
    case 'recentMoves': {
      const yearMatch = content.match(/\d{4}年/);
      if (yearMatch) return yearMatch[0];
      const actionKeywords = ['提携', 'M&A', '買収', '合併', 'リリース', '発表', '開始', '設立'];
      for (const keyword of actionKeywords) {
        if (content.includes(keyword)) return keyword;
      }
      return content.substring(0, 15);
    }
    case 'companyDirection': {
      const directionKeywords = [
        'カーボンニュートラル', 'DX', 'デジタル', 'サステナビリティ',
        'グローバル', 'ESG', '経営', 'ビジョン', '中期経営', '成長戦略',
      ];
      for (const keyword of directionKeywords) {
        if (content.includes(keyword)) return keyword;
      }
      return content.substring(0, 15);
    }
    case 'hiringTrends': {
      const jobKeywords = ['経営企画', '管理', 'DX', '人事', '財務', 'IT', 'エンジニア', '営業'];
      for (const keyword of jobKeywords) {
        if (content.includes(keyword)) return keyword;
      }
      return content.substring(0, 15);
    }
    default:
      return content.substring(0, 20);
  }
}
