import type { ExtractedFacts, SelectedFact } from '@/types/analysis';
import {
  PUBLIC_SECTOR_DETECT_KEYWORDS,
  PUBLIC_SECTOR_URL_PATTERNS,
  PUBLIC_SECTOR_NAME_KEYWORDS,
  STARTUP_URL_KEYWORDS,
  STARTUP_CONTENT_KEYWORDS,
  CELEBRATION_TEXT,
} from './constants';

export function detectPublicSector(industry?: string, companyName?: string): boolean {
  const combined = `${industry || ''} ${companyName || ''}`;
  return PUBLIC_SECTOR_DETECT_KEYWORDS.some((kw) => combined.includes(kw));
}

export function isPublicSectorOrg(options: {
  targetUrl?: string;
  companyName?: string;
  industry?: string;
}): boolean {
  if (options.targetUrl) {
    if (PUBLIC_SECTOR_URL_PATTERNS.some((p) => p.test(options.targetUrl!))) {
      return true;
    }
  }
  if (options.companyName) {
    if (PUBLIC_SECTOR_NAME_KEYWORDS.some((kw) => options.companyName!.includes(kw))) {
      return true;
    }
  }
  return detectPublicSector(options.industry, options.companyName);
}

export function isStartupCompany(options: {
  targetUrl?: string;
  companyName?: string;
  industry?: string;
  extractedFacts?: ExtractedFacts;
}): boolean {
  if (options.targetUrl) {
    const urlLower = options.targetUrl.toLowerCase();
    if (STARTUP_URL_KEYWORDS.some((kw) => urlLower.includes(kw))) {
      return true;
    }
  }

  const combined = `${options.companyName || ''} ${options.industry || ''}`;
  if (STARTUP_CONTENT_KEYWORDS.some((kw) => combined.includes(kw))) {
    return true;
  }

  if (options.extractedFacts) {
    const allFactContents = [
      ...(options.extractedFacts.recentMoves || []),
      ...(options.extractedFacts.companyDirection || []),
      ...(options.extractedFacts.numbers || []),
    ]
      .map((f) => (typeof f === 'string' ? f : f.content))
      .join(' ');

    if (STARTUP_CONTENT_KEYWORDS.some((kw) => allFactContents.includes(kw))) {
      return true;
    }

    const employeeMatch = allFactContents.match(/従業員[数：:]\s*(\d+)/);
    if (employeeMatch && parseInt(employeeMatch[1], 10) <= 100) {
      return true;
    }
  }

  return false;
}

export function detectCelebrationFromFacts(
  factsForLetter: SelectedFact[],
): { hasCelebration: boolean; celebrationText: string; celebrationType?: SelectedFact['celebration'] } {
  const celebrationFact = factsForLetter.find((f) => f.celebration);
  if (!celebrationFact || !celebrationFact.celebration) {
    return { hasCelebration: false, celebrationText: '' };
  }

  const baseText = CELEBRATION_TEXT[celebrationFact.celebration];

  if (celebrationFact.celebration === 'anniversary') {
    const match = celebrationFact.content.match(/(\d+)\s*周年/);
    if (match) {
      return {
        hasCelebration: true,
        celebrationText: `${match[1]}周年`,
        celebrationType: 'anniversary',
      };
    }
  }

  return {
    hasCelebration: true,
    celebrationText: baseText,
    celebrationType: celebrationFact.celebration,
  };
}
