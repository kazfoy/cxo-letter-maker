/**
 * 品質ゲート: レター出力の機械的品質検証
 *
 * AI採点の前に、明確にNGな出力を高速で弾く
 */

import type { SelectedFact } from '@/types/analysis';

/**
 * 証拠ポイントの型
 */
export interface ProofPoint {
  type: 'numeric' | 'case_study' | 'news' | 'inference';
  content: string;
  source?: string;
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * 品質検証結果
 */
export interface QualityResult {
  ok: boolean;
  reasons: string[];
}

/**
 * 検証オプション
 */
export interface ValidateOptions {
  mode: 'draft' | 'complete';
  minChars?: number;
  maxChars?: number;
  hasProofPoints?: boolean;
  hasRecentNews?: boolean;
  missingInfoHighCount?: number;
}

/**
 * 禁止ワードリスト
 */
const FORBIDDEN_WORDS = [
  // プレースホルダー系
  '〇〇',
  '●●',
  'XX',
  'xx',
  '△△',
  '□□',
  // 運用視点（CxO不適）
  '業務効率化',
  'コスト削減',
  '作業時間短縮',
  '人件費削減',
  // 儀礼的フレーズ
  '感銘を受けました',
  'ご活躍を拝見',
  '拝察',
  '幸いです',
  // 曖昧表現
  '大幅に削減',
  '多くの企業様',
  '業界トップクラス',
  '御社も例外ではない',
  '例外ではありません',
];

/**
 * プレースホルダーパターン（Completeモードで禁止）
 */
const PLACEHOLDER_PATTERNS = [
  /【要確認[:：].*?】/g,
  /\[要確認[:：].*?\]/g,
];

/**
 * ニュースアサーションパターン
 */
const NEWS_ASSERTION_PATTERNS = [
  /先日.*発表/,
  /最近.*報道/,
  /〜によると/,
  /と報じられ/,
  /が明らかに/,
];

/**
 * レター出力の品質検証
 *
 * @param body - レター本文
 * @param proofPoints - 使用可能な証拠ポイント
 * @param options - 検証オプション
 * @returns 検証結果
 */
export function validateLetterOutput(
  body: string,
  proofPoints: ProofPoint[],
  options: ValidateOptions
): QualityResult {
  const reasons: string[] = [];
  const {
    mode,
    minChars = 250,
    maxChars = 650,
    hasProofPoints = proofPoints.length > 0,
    hasRecentNews = false,
    missingInfoHighCount = 0,
  } = options;

  // 1. 文字数チェック
  const charCount = body.length;
  if (charCount < minChars) {
    reasons.push(`文字数が少なすぎます（${charCount}文字/${minChars}文字以上必要）`);
  }
  if (charCount > maxChars) {
    reasons.push(`文字数が多すぎます（${charCount}文字/${maxChars}文字以内）`);
  }

  // 2. 禁止ワードチェック
  for (const word of FORBIDDEN_WORDS) {
    if (body.includes(word)) {
      reasons.push(`禁止ワード「${word}」が含まれています`);
    }
  }

  // 3. プレースホルダーチェック
  if (mode === 'complete') {
    // Completeモードではプレースホルダー禁止
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const matches = body.match(pattern);
      if (matches && matches.length > 0) {
        reasons.push(`Completeモードでプレースホルダー「${matches[0]}」が残っています`);
        break;
      }
    }
  }

  // 4. 数字使用チェック（proof_pointsが空なのに数字を使っている）
  if (!hasProofPoints) {
    // 数字 + 単位のパターン
    const numericPattern = /\d+[%％万億件社名時間日週月年]/;
    if (numericPattern.test(body)) {
      reasons.push('証拠ポイントがないのに具体的な数値が使用されています（架空の数字の疑い）');
    }
  }

  // 5. ニュースアサーションチェック（recent_newsが空なのにニュース断定）
  if (!hasRecentNews) {
    for (const pattern of NEWS_ASSERTION_PATTERNS) {
      if (pattern.test(body)) {
        reasons.push('最新ニュース情報がないのにニュースを断定的に引用しています');
        break;
      }
    }
  }

  // 6. Draftモードで情報不足なのにプレースホルダーがない
  if (mode === 'draft' && missingInfoHighCount > 0) {
    const confirmationMatches = body.match(/【要確認[：:]/g);
    if (!confirmationMatches || confirmationMatches.length === 0) {
      reasons.push('Draftモードで情報不足があるのにプレースホルダー【要確認:】がありません');
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

/**
 * 品質スコアを計算（100点満点）
 *
 * AI採点をスキップする場合のフォールバック用
 *
 * @param body - レター本文
 * @param proofPoints - 証拠ポイント
 * @param mode - 生成モード
 * @returns スコア (0-100)
 */
export function calculateQualityScore(
  body: string,
  proofPoints: ProofPoint[],
  mode: 'draft' | 'complete'
): number {
  let score = 100;

  // 1. 文字数 (20点)
  const charCount = body.length;
  if (charCount < 300 || charCount > 550) score -= 10;
  if (charCount < 250 || charCount > 650) score -= 10;

  // 2. CxO視座 (20点)
  const operationalWords = ['業務効率化', 'コスト削減', '作業時間', '手作業', '人件費'];
  const executiveWords = ['ガバナンス', '経営スピード', 'リスク', '統制', '監査', '競争優位', 'コンプライアンス'];
  const hasOperational = operationalWords.some(w => body.includes(w));
  const hasExecutive = executiveWords.some(w => body.includes(w));
  if (hasOperational && !hasExecutive) score -= 15;
  if (!hasExecutive) score -= 5;

  // 3. 具体性 (20点)
  const hasNumbers = /\d+[%％万億件社名時間日週月年]/.test(body);
  const hasCompanyExample = /[A-Z社様].*では/.test(body) || /同業界の.*では/.test(body) || /[A-Z]社様/.test(body);
  if (!hasNumbers && proofPoints.length > 0) score -= 10;
  if (!hasCompanyExample) score -= 10;

  // 4. 構成 (20点)
  const hasTimingReason = /なぜ.*今|今回.*理由|このタイミング/.test(body);
  const hasHypothesis = /ではないでしょうか|と推察|課題をお持ち|懸念されている/.test(body);
  if (!hasTimingReason) score -= 10;
  if (!hasHypothesis) score -= 10;

  // 5. プレースホルダー (20点) - Completeモードのみ
  if (mode === 'complete') {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(body)) {
        score -= 20;
        break;
      }
    }
  }

  return Math.max(0, score);
}

/**
 * 禁止ワードを取得（テスト用）
 */
export function getForbiddenWords(): string[] {
  return [...FORBIDDEN_WORDS];
}

/**
 * Phase 5: 詳細品質スコア
 */
export interface DetailedQualityScore {
  total: number;  // 0-100
  breakdown: {
    specificity: number;         // 具体性（ファクト有無）0-20
    empathy: number;             // 共感性（相手文脈）0-20
    ctaClarity: number;          // CTAの明確さ 0-20
    fiveElementsComplete: number; // 5要素構造の充足 0-20
    noNgExpressions: number;     // NG表現（過剰・失礼）0-20
  };
  suggestions: string[];  // 改善ポイント（最大3つ）
}

/**
 * 詳細品質スコアを計算（5軸のルールベース評価）
 *
 * @param body - レター本文
 * @param hasFactNumbers - 数値ファクトがあるかどうか
 * @param hasProperNouns - 固有名詞があるかどうか
 * @param factsForLetter - 選定されたファクト（quoteKeyによる引用チェック用）
 * @returns 詳細品質スコア
 */
export function calculateDetailedScore(
  body: string,
  hasFactNumbers: boolean = false,
  hasProperNouns: boolean = false,
  factsForLetter?: SelectedFact[]
): DetailedQualityScore {
  const suggestions: string[] = [];

  // 1. 具体性 (0-20)
  let specificity = 0;
  // 数値ファクト有り +10
  if (hasFactNumbers || /\d+[%％万億件社名時間日週月年]/g.test(body)) {
    specificity += 10;
  } else {
    suggestions.push('具体的な数値を含めるとより説得力が増します');
  }
  // 固有名詞有り +10
  if (hasProperNouns || /「.+?」/.test(body) || /[A-Z社様].*では/.test(body)) {
    specificity += 10;
  } else if (suggestions.length < 3) {
    suggestions.push('製品名やサービス名などの固有名詞を含めると信頼性が向上します');
  }

  // factsForLetter 引用チェック
  if (factsForLetter && factsForLetter.length > 0) {
    // フックでファクト引用チェック（冒頭200文字以内）
    const hookText = body.substring(0, 200);
    const hookHasFact = factsForLetter.some(f => hookText.includes(f.quoteKey));

    // 全文でのファクト引用数
    const factQuoteCount = factsForLetter.filter(f => body.includes(f.quoteKey)).length;

    // factsForLetter が 2 個以上あるのに引用が 0 なら減点
    if (factsForLetter.length >= 2 && factQuoteCount === 0) {
      specificity -= 10;
      if (suggestions.length < 3) {
        suggestions.push('抽出されたファクトを本文で引用してください');
      }
    }

    // フックにファクトがない場合は減点
    if (!hookHasFact && factQuoteCount > 0) {
      specificity -= 5;
      if (suggestions.length < 3) {
        suggestions.push('冒頭のフックでファクトを引用すると導入が強くなります');
      }
    }
  }

  // 具体性の最低値は0
  specificity = Math.max(0, specificity);

  // 2. 共感性 (0-20)
  let empathy = 0;
  // 相手の文脈への言及チェック
  const empathyPatterns = [
    /御社.*では/,
    /貴社.*では/,
    /〜と伺って/,
    /〜と拝見/,
    /お取り組み/,
    /ご注力/,
    /ご状況/,
    /課題.*お持ち/,
    /お悩み/,
    /ではないでしょうか/,
    /と推察/,
  ];
  const empathyHits = empathyPatterns.filter(p => p.test(body)).length;
  if (empathyHits >= 2) {
    empathy = 20;
  } else if (empathyHits === 1) {
    empathy = 10;
  } else {
    if (suggestions.length < 3) {
      suggestions.push('相手企業の状況や課題への言及を加えると共感が生まれます');
    }
  }

  // 3. CTAの明確さ (0-20)
  let ctaClarity = 0;
  const ctaPatterns = [
    /ご検討.*いただけ/,
    /お時間.*いただけ/,
    /ご連絡.*いただけ/,
    /\d+分/,
    /情報交換/,
    /ご相談/,
    /お打ち合わせ/,
    /ご都合.*お聞かせ/,
    /日程調整/,
    /ご返信/,
  ];
  const ctaHits = ctaPatterns.filter(p => p.test(body)).length;
  if (ctaHits >= 2) {
    ctaClarity = 20;
  } else if (ctaHits === 1) {
    ctaClarity = 15;
  } else {
    if (suggestions.length < 3) {
      suggestions.push('明確なアクション（面談依頼、返信依頼等）を提示しましょう');
    }
  }

  // 4. 5要素構造の充足 (0-20)
  // 各要素の存在をチェック
  let fiveElementsComplete = 0;
  const fiveElements = {
    background: /なぜ.*今|このたび|背景|ご連絡.*理由/.test(body),
    problem: /課題|お悩み|懸念|リスク/.test(body),
    solution: /解決|支援|サポート|提供|ご提案/.test(body),
    caseStudy: /導入.*事例|実績|%削減|%向上|[A-Z]社様/.test(body),
    offer: /お時間|ご相談|ご検討|面談/.test(body),
  };
  const elementCount = Object.values(fiveElements).filter(Boolean).length;
  fiveElementsComplete = elementCount * 4; // 各要素4点

  // 5. NG表現チェック (0-20, 減点方式)
  let noNgExpressions = 20;

  // 儀礼的フレーズ（各-7点）
  const ceremonialPhrases = ['感銘を受けました', 'ご活躍を拝見', '拝察', '幸いです'];
  const ceremonialCount = ceremonialPhrases.filter(p => body.includes(p)).length;
  noNgExpressions -= ceremonialCount * 7;

  // 過剰断定（各-7点）
  const overassertivePhrases = ['必ず', '絶対に', '間違いなく', '確実に'];
  const overassertiveCount = overassertivePhrases.filter(p => body.includes(p)).length;
  noNgExpressions -= overassertiveCount * 7;

  // 運用視点のワード（各-5点）
  const operationalWords = ['業務効率化', 'コスト削減', '作業時間短縮', '人件費削減'];
  const operationalCount = operationalWords.filter(p => body.includes(p)).length;
  noNgExpressions -= operationalCount * 5;

  // 一般論検出と減点（ファクトがある場合ほど減点を強める）
  const generalStatementPatterns = [
    /多くの企業では/,
    /一般的に/,
    /近年では/,
  ];
  const generalCount = generalStatementPatterns.filter(p => p.test(body)).length;
  if (generalCount > 0) {
    // ファクトがあるのに一般論を使う場合は強く減点
    const penalty = factsForLetter?.length
      ? generalCount * 7  // ファクトありで一般論は -7/回
      : generalCount * 3; // ファクトなしでも -3/回
    noNgExpressions -= penalty;
    if (suggestions.length < 3 && factsForLetter?.length) {
      suggestions.push('一般論ではなく、抽出したファクトを使用してください');
    }
  }

  // 最低0点
  noNgExpressions = Math.max(0, noNgExpressions);

  // 合計スコア
  const total = specificity + empathy + ctaClarity + fiveElementsComplete + noNgExpressions;

  return {
    total,
    breakdown: {
      specificity,
      empathy,
      ctaClarity,
      fiveElementsComplete,
      noNgExpressions,
    },
    suggestions: suggestions.slice(0, 3),
  };
}
