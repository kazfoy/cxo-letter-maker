import type {
  ExtractedFacts,
  SelectedFact,
  SourceCategory,
} from '@/types/analysis';

export interface NormalizedFact {
  content: string;
  category: SelectedFact['category'];
  sourceUrl?: string;
  sourceTitle?: string;
  sourceCategory?: SourceCategory;
  date: Date | null;
  isUndated: boolean;
  isMidTermPlan: boolean;
}

export interface FactSelectionResult {
  factsForLetter: SelectedFact[];
  rejectedFacts: SelectedFact[];
  usedFallback: boolean;
}

export interface FactSelectionOptions {
  industry?: string;
  companyName?: string;
}

export type { ExtractedFacts, SelectedFact };
