/**
 * 品質ゲート: レター出力の機械的品質検証
 *
 * AI採点の前に、明確にNGな出力を高速で弾く
 */

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
  // （これはオプショナル - 情報が十分なら不要）

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
