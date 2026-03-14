/**
 * ファクト選定ロジック
 *
 * 抽出された全ファクトから、レター生成に最適な2-3個を選定
 * Phase 6: ストーリー整合性・鮮度フィルタ・ブリッジ理由生成
 */

import type {
  ExtractedFacts,
  SelectedFact,
  InformationSource,
} from '@/types/analysis';

import { FACT_SHORTAGE_THRESHOLD } from './constants';
import { containsNgKeyword, normalizeFactItem, parseDateFromFact, isMidTermPlan, filterByFreshness, detectCelebration } from './filters';
import { calculateRelevanceScore, generateQuoteKey } from './scoring';
import { assignTopicTags, generateBridgeReason, calculateBridgeConfidence } from './bridge';
import { detectPublicSector } from './detectors';
import { generateFallbackFacts } from './fallback';
import type { FactSelectionResult, NormalizedFact } from './types';

// Re-export public API
export { isPublicSectorOrg, isStartupCompany, detectCelebrationFromFacts } from './detectors';
export { generateFallbackFacts } from './fallback';
export type { FactSelectionResult } from './types';

/**
 * レター生成に最適なファクトを選定
 */
export function selectFactsForLetter(
  extractedFacts: ExtractedFacts | undefined,
  targetPosition?: string,
  productStrength?: string,
  targetChallenges?: string,
  proposalTheme?: string,
  confidenceThreshold: number = 60,
  options?: { industry?: string; companyName?: string },
): FactSelectionResult {
  if (!extractedFacts) {
    const fallbackFacts = generateFallbackFacts(options?.industry, options?.companyName);
    return { factsForLetter: fallbackFacts, rejectedFacts: [], usedFallback: true };
  }

  const normalizedFacts: NormalizedFact[] = [];

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
      const normalized = normalizeFactItem(item);
      const { content, sourceUrl, sourceTitle, sourceCategory } = normalized;
      if (containsNgKeyword(content)) continue;
      const { date, isUndated } = parseDateFromFact(content);
      const midTermPlan = isMidTermPlan(content);
      normalizedFacts.push({ content, category, sourceUrl, sourceTitle, sourceCategory, date, isUndated, isMidTermPlan: midTermPlan });
    }
  }

  const freshFacts = filterByFreshness(normalizedFacts);
  const isPublic = detectPublicSector(options?.industry, options?.companyName);

  const allFacts: SelectedFact[] = [];

  for (const fact of freshFacts) {
    const { content, category, sourceUrl, sourceTitle, sourceCategory, date, isUndated, isMidTermPlan: midTermPlan } = fact;
    let { score, reason } = calculateRelevanceScore(content, category, targetPosition, productStrength, targetChallenges, isPublic);

    if (category === 'recentMoves' && isUndated) {
      score -= 15;
      reason += ' / 日付不明により減点';
    }

    const topicTags = assignTopicTags(content);
    const bridgeReason = generateBridgeReason(content, topicTags, proposalTheme);
    const confidence = calculateBridgeConfidence(content, topicTags, proposalTheme);
    const publishedAt = date ? `${date.getFullYear()}年${date.getMonth() + 1}月` : undefined;
    const celebration = detectCelebration(content);

    allFacts.push({
      content, category, relevanceScore: Math.max(0, score), reason,
      quoteKey: generateQuoteKey(content, category), topicTags, bridgeReason,
      confidence, publishedAt, isMidTermPlan: midTermPlan,
      sourceUrl, sourceTitle, sourceCategory, celebration,
    });
  }

  allFacts.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const confidentFacts = allFacts.filter((f) => f.confidence >= confidenceThreshold);

  const factsForLetter: SelectedFact[] = [];
  const rejectedFacts: SelectedFact[] = [];
  const usedCategories = new Set<SelectedFact['category']>();

  // 1. Pick one per category from confident facts
  for (const fact of confidentFacts) {
    if (factsForLetter.length >= 5) break;
    if (!usedCategories.has(fact.category)) {
      factsForLetter.push(fact);
      usedCategories.add(fact.category);
    }
  }

  // 2. Fill from confident facts
  for (const fact of confidentFacts) {
    if (factsForLetter.length >= 5) break;
    if (!factsForLetter.includes(fact)) {
      factsForLetter.push(fact);
    }
  }

  // 3. Fill from all facts
  if (factsForLetter.length < 5) {
    for (const fact of allFacts) {
      if (factsForLetter.length >= 5) break;
      if (!factsForLetter.includes(fact)) {
        factsForLetter.push(fact);
      }
    }
  }

  // 4. Fallback if still short
  let usedFallback = false;
  if (factsForLetter.length < FACT_SHORTAGE_THRESHOLD) {
    const fallbackFacts = generateFallbackFacts(options?.industry, options?.companyName);
    for (const fallback of fallbackFacts) {
      if (factsForLetter.length >= FACT_SHORTAGE_THRESHOLD) break;
      factsForLetter.push(fallback);
      usedFallback = true;
    }
  }

  // 5. Remaining → rejected
  for (const fact of allFacts) {
    if (!factsForLetter.includes(fact)) {
      rejectedFacts.push(fact);
    }
  }

  return { factsForLetter, rejectedFacts, usedFallback };
}

/**
 * InformationSourceにextractedFactsを追加
 */
export function enrichSourcesWithFacts(
  sources: InformationSource[],
  selectedFacts: SelectedFact[],
): InformationSource[] {
  const factsByUrl = new Map<string, string[]>();

  for (const fact of selectedFacts) {
    if (fact.sourceUrl) {
      const existing = factsByUrl.get(fact.sourceUrl) || [];
      existing.push(fact.content);
      factsByUrl.set(fact.sourceUrl, existing);
    }
  }

  return sources.map((source) => ({
    ...source,
    extractedFacts: factsByUrl.get(source.url) || [],
  }));
}
