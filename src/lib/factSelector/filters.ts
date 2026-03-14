import type { ExtractedFactItem, SelectedFact, SourceCategory } from '@/types/analysis';
import { NG_KEYWORDS, CELEBRATION_PATTERNS } from './constants';

export function containsNgKeyword(content: string): boolean {
  return NG_KEYWORDS.some((keyword) => content.includes(keyword));
}

export function normalizeFactItem(
  item: string | ExtractedFactItem,
  fallbackSourceUrl?: string,
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

export function parseDateFromFact(content: string): { date: Date | null; isUndated: boolean } {
  const patterns = [
    /(\d{4})年(\d{1,2})月/,
    /(\d{4})\/(\d{1,2})/,
    /(\d{4})-(\d{1,2})/,
    /(\d{4})年/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = match[2] ? parseInt(match[2], 10) - 1 : 0;
      if (year >= 2000 && year <= 2100) {
        return { date: new Date(year, month, 1), isUndated: false };
      }
    }
  }

  const reiwaMach = content.match(/令和(\d+)年/);
  if (reiwaMach) {
    const year = 2018 + parseInt(reiwaMach[1], 10);
    return { date: new Date(year, 0, 1), isUndated: false };
  }

  return { date: null, isUndated: true };
}

export function isMidTermPlan(content: string): boolean {
  const markers = ['[中計]', '中期経営計画', '中期計画', '長期ビジョン', '経営計画'];
  return markers.some((marker) => content.includes(marker));
}

export function filterByFreshness<T extends { isMidTermPlan: boolean; date: Date | null }>(
  facts: T[],
  maxAgeDays: number = 365,
): T[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  return facts.filter((fact) => {
    if (fact.isMidTermPlan) return true;
    if (fact.date && fact.date < cutoff) return false;
    return true;
  });
}

export function detectCelebration(content: string): SelectedFact['celebration'] | undefined {
  for (const { pattern, type } of CELEBRATION_PATTERNS) {
    if (pattern.test(content)) {
      return type;
    }
  }
  return undefined;
}
