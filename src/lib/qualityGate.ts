/**
 * 品質ゲート: レター出力の機械的品質検証
 *
 * AI採点の前に、明確にNGな出力を高速で弾く
 */

import type { SelectedFact } from '@/types/analysis';
import type { Citation } from '@/types/generate-v2';

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
  mode: 'draft' | 'complete' | 'event' | 'consulting';
  minChars?: number;
  maxChars?: number;
  hasProofPoints?: boolean;
  hasRecentNews?: boolean;
  missingInfoHighCount?: number;
  eventPosition?: string;  // Event mode 用
}

/**
 * 禁止ワードリスト
 */
/**
 * 禁止ワード（完全一致）
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
 * 禁止パターン（正規表現）
 * 抽象的・テンプレ的な表現を検出
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  // 抽象的な時代背景フレーズ
  { pattern: /急速に変化する/, label: '急速に変化する' },
  { pattern: /ますます重要性を増/, label: 'ますます重要性を増す' },
  { pattern: /近年の(?:市場|業界|環境|動向|トレンド|情勢|潮流)/, label: '近年の（一般論）' },
  { pattern: /昨今の/, label: '昨今の' },
  { pattern: /目まぐるしく変化/, label: '目まぐるしく変化' },
  { pattern: /激変する.*環境/, label: '激変する環境' },
  // 具体性のない断言
  { pattern: /大きな成果/, label: '大きな成果' },
  { pattern: /飛躍的な.*向上/, label: '飛躍的な向上' },
  { pattern: /劇的に.*改善/, label: '劇的に改善' },
  { pattern: /圧倒的な/, label: '圧倒的な' },
  // 一般論の埋め草
  { pattern: /言うまでもなく/, label: '言うまでもなく' },
  { pattern: /ご存知の通り/, label: 'ご存知の通り' },
  { pattern: /周知の事実/, label: '周知の事実' },
];

/**
 * Completeモード専用禁止ワード（推察・想定・断定診断）
 */
const COMPLETE_MODE_FORBIDDEN_WORDS = [
  // 推察・想定系（CxOの防御反応を誘発）
  '推察します',
  '推察いたします',
  'と推察',
  '想定されます',
  'と想定',
  '存じます',
  // 断定診断系
  '統一されておらず',
  'が残存',
  '残存している',
  'が課題となる',
  '課題が生じて',
  // 数値プレースホルダー
  '〇週間',
  '〇名',
  '〇社',
];

/**
 * Consultingモード専用禁止ワード
 */
const CONSULTING_MODE_FORBIDDEN_WORDS = [
  '推察します',
  '確信しております',
  '言われています',
  '一般に言われて',
  'と言われて',
];

/**
 * Consultingモード専用: citation/注釈混入パターン
 */
const CONSULTING_CITATION_PATTERNS = [
  /\[citation[:：]?[^\]]*\]/gi,
  /【citation[:：]?[^】]*】/gi,
  /citation/i,
  /\[出典[:：]?[^\]]*\]/gi,
  /【出典[:：]?[^】]*】/gi,
  /\[\d+\]/,
];

/**
 * Consultingモード専用: CTA二重取りパターン
 */
const CONSULTING_DUAL_CTA_COMBINATIONS = [
  { a: /資料をお送り|資料だけ/, b: /15分|お時間.*いただ|面談/ },
];

/**
 * Consultingモード専用: 課題断定パターン
 */
const CONSULTING_ASSERTIVE_DIAGNOSIS_PATTERNS = [
  /(?:貴社|御社)では.{1,30}が課題/,
  /(?:貴社|御社)では.{1,30}が問題/,
  /(?:貴社|御社).{1,20}(?:に違いない|に間違いない)/,
];

/**
 * テンプレ語リスト（一般論の兆候、ユーザー入力に明示されていない限り減点）
 */
const TEMPLATE_PHRASES = [
  'CASE',
  '急務',
  '喫緊',
  '待ったなし',
  '100年に一度',
  'MaaS',
  'DX推進',
  'デジタル変革',
];

/**
 * 電報調検出パターン（体言止め）
 * 文末が名詞や形容詞の連体形で終わる電報的表現を検出
 */
const TELEGRAM_PATTERNS = [
  /期待。/,
  /可能。/,
  /必要。/,
  /重要。/,
  /課題。/,
  /状況。/,
  /実現。/,
  /成功。/,
  /提案。/,
  /機会。/,
  /展開。/,
  /強化。/,
  /推進。/,
  /対応。/,
];

/**
 * プレースホルダーパターン（Completeモードで禁止）
 */
const PLACEHOLDER_PATTERNS = [
  /【要確認[:：].*?】/g,
  /\[要確認[:：].*?\]/g,
];

/**
 * 無根拠診断パターン（全モード共通）
 * 「推察します」を相手企業診断に使う場合に検出
 */
const UNFOUNDED_DIAGNOSIS_PATTERNS = [
  /(?:貴社|御社)では.{1,30}(?:と推察|と存じ|と思われ|と考えます)/,
  /(?:貴社|御社).{1,20}(?:が課題|が問題|にお悩み)(?:だと|である|と)(?:推察|存じ|思われ)/,
  /(?:確信しております|間違いございません|間違いなく)/,
  // 断定診断パターン（相手の内部事情を決めつけ）
  /(?:貴社|御社).{1,30}(?:統一されておらず|されていない|が残存|残っており)/,
  /(?:貴社|御社).{1,30}(?:に課題が生じている|が生じている|を要する)/,
  /(?:貴社|御社).{1,30}(?:といった状況|という状況|も想定されます)/,
];

/**
 * 宛名の二重表現パターン
 */
const SALUTATION_REDUNDANCY_PATTERNS = [
  /ご担当者.*?様/,  // 「ご担当者 田中様」など
  /ご担当.*?[様殿]/,
];

/**
 * Event招待状専用: 無根拠診断パターン
 */
const EVENT_BASELESS_DIAGNOSIS_PATTERNS = [
  /貴社では.{1,30}(?:推察|存じ|考えます|思われます)/,
  /御社では.{1,30}(?:推察|存じ|考えます|思われます)/,
  /貴社.{1,20}(?:が課題|が問題|が存在)/,
  /御社.{1,20}(?:が課題|が問題|が存在)/,
  /〜と(?:推察|存じ|考え(?:ます|ております))/,
  /貴社におかれましても.{1,20}ではないでしょうか/,
];

/**
 * Event招待状専用: 強断言パターン
 */
const EVENT_STRONG_ASSERTION_PATTERNS = [
  /確信しております/,
  /間違いございません/,
  /間違いなく/,
  /必ずや.{1,20}いただけ/,
  /貢献できる/,
  /実現できる/,
  /達成できる/,
];

/**
 * Event招待状専用: 抽象的な価値表現
 * 具体的な持ち帰り3点を促すために検出
 */
const EVENT_ABSTRACT_VALUE_PATTERNS = [
  /最新事例やノウハウ/,
  /事例やノウハウ/,
  /様々な事例/,
  /豊富な事例/,
  /有益な情報/,
];

/**
 * Event招待状専用: CTA二重取りパターン
 */
const EVENT_DUAL_CTA_COMBINATIONS = [
  { a: /資料/, b: /15分|お時間.*いただ|面談|打ち合わせ/ },
  { a: /ご参加/, b: /お時間.*いただ|面談/ },
];

/**
 * Event招待状専用: 冷開拓NG挨拶
 * 関係性がない相手に「平素より」は違和感
 */
const EVENT_COLD_OUTREACH_NG_GREETINGS = [
  /平素より.*お世話/,
  /いつも.*お世話/,
  /日頃より.*お世話/,
];

/**
 * Event招待状専用: 立ち位置矛盾パターン
 * 「協賛企業として参加」+「開催」は矛盾
 */
const EVENT_POSITION_CONFUSION_PATTERNS = [
  { role: /協賛企業として/, action: /開催いたします|主催/ },
  { role: /後援として/, action: /開催いたします|主催/ },
];

/**
 * Event招待状専用: 登壇者未確定パターン
 */
const EVENT_UNCONFIRMED_SPEAKER_PATTERNS = [
  /（予定）/,
  /\(予定\)/,
  /（調整中）/,
  /\(調整中\)/,
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

  // 2. 禁止ワードチェック（完全一致）
  for (const word of FORBIDDEN_WORDS) {
    if (body.includes(word)) {
      reasons.push(`禁止ワード「${word}」が含まれています`);
    }
  }

  // 2b. 禁止パターンチェック（正規表現）
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(body)) {
      reasons.push(`禁止パターン「${label}」が含まれています`);
    }
  }

  // 3. プレースホルダーチェック
  if (mode === 'complete' || mode === 'consulting') {
    // Complete/Consultingモードではプレースホルダー禁止
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const matches = body.match(pattern);
      if (matches && matches.length > 0) {
        reasons.push(`${mode}モードでプレースホルダー「${matches[0]}」が残っています`);
        break;
      }
    }
    // Completeモード専用禁止ワードチェック
    if (mode === 'complete') {
      for (const word of COMPLETE_MODE_FORBIDDEN_WORDS) {
        if (body.includes(word)) {
          reasons.push(`Completeモードで禁止表現「${word}」が含まれています`);
        }
      }
    }
    // Consultingモード専用禁止ワードチェック
    if (mode === 'consulting') {
      for (const word of CONSULTING_MODE_FORBIDDEN_WORDS) {
        if (body.includes(word)) {
          reasons.push(`Consultingモードで禁止表現「${word}」が含まれています`);
        }
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

  // 7. 電報調（体言止め）チェック
  const telegramHits = TELEGRAM_PATTERNS.filter(p => p.test(body));
  if (telegramHits.length >= 2) {
    reasons.push('電報調の文章（体言止め）が複数含まれています。「です・ます」で終える文体にしてください');
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
 * 禁止パターンを取得（テスト用）
 */
export function getForbiddenPatterns(): { pattern: RegExp; label: string }[] {
  return [...FORBIDDEN_PATTERNS];
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
 * @param hasTargetUrl - targetURLが指定されているか（ファクト引用必須化の判定用）
 * @param userInput - ユーザー入力（テンプレ語許可の判定用）
 * @returns 詳細品質スコア
 */
export function calculateDetailedScore(
  body: string,
  hasFactNumbers: boolean = false,
  hasProperNouns: boolean = false,
  factsForLetter?: SelectedFact[],
  hasTargetUrl: boolean = false,
  userInput?: string
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

  // フック（冒頭200文字）に固有情報がない場合の減点
  const hookText = body.substring(0, 200);
  const hasSpecificHook = factsForLetter?.some(f => hookText.includes(f.quoteKey)) ||
    /\d{4}年|\d+月|\d+日|第\d+期/.test(hookText);  // 日付・期など固有情報

  if (!hasSpecificHook && factsForLetter && factsForLetter.length > 0) {
    specificity -= 5;
    if (suggestions.length < 3) {
      suggestions.push('冒頭に固有の日付・数字・キーワードを含め、なぜ「今」「この企業に」連絡したか明確化してください');
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
    /ご検討中/,
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

  // 電報調（体言止め）検出（各-5点）
  const telegramCount = TELEGRAM_PATTERNS.filter(p => p.test(body)).length;
  if (telegramCount > 0) {
    noNgExpressions -= telegramCount * 5;
    if (suggestions.length < 3) {
      suggestions.push('体言止めを避け、「です・ます」で文を終えてください');
    }
  }

  // 無根拠診断検出（各-10点、上限-20点）
  const unfoundedHits = UNFOUNDED_DIAGNOSIS_PATTERNS.filter(p => p.test(body));
  if (unfoundedHits.length > 0) {
    noNgExpressions -= Math.min(unfoundedHits.length * 10, 20);
    if (suggestions.length < 3) {
      suggestions.push('相手企業の状況を断定せず、一般論型（「一般に〜が論点になりやすい」）に置き換えてください');
    }
  }

  // 宛名二重表現検出（-5点）
  const salutationRedundancy = SALUTATION_REDUNDANCY_PATTERNS.some(p => p.test(body));
  if (salutationRedundancy) {
    noNgExpressions -= 5;
    if (suggestions.length < 3) {
      suggestions.push('宛名が二重です。「田中様」または「ご担当者様」のどちらかに統一してください');
    }
  }

  // 一般論検出と減点（URLあり && ファクトがある場合のみ減点）
  // 仮説モード（URL未指定 or ファクト空）では一般論は許容される
  if (hasTargetUrl && factsForLetter && factsForLetter.length > 0) {
    const generalStatementPatterns = [
      /多くの企業では/,
      /一般的に/,
      /近年では/,
    ];
    const generalCount = generalStatementPatterns.filter(p => p.test(body)).length;
    if (generalCount > 0) {
      noNgExpressions -= generalCount * 7;
      if (suggestions.length < 3) {
        suggestions.push('一般論ではなく、抽出したファクトを使用してください');
      }
    }
  }

  // 最低0点
  noNgExpressions = Math.max(0, noNgExpressions);

  // 合計スコア
  let total = specificity + empathy + ctaClarity + fiveElementsComplete + noNgExpressions;
  const issues: string[] = [];

  // 6. テンプレ語検出（ユーザー入力に明示されていない限り減点）
  const templateHits = TEMPLATE_PHRASES.filter(phrase => body.includes(phrase));
  const templateWithoutUserEvidence = templateHits.filter(phrase => {
    // ユーザー入力に含まれている場合は許可
    const allowedByUser = userInput?.includes(phrase);
    return !allowedByUser;
  });

  if (templateWithoutUserEvidence.length > 0) {
    total = Math.min(total, 75);
    issues.push(`テンプレ語使用: ${templateWithoutUserEvidence.join(', ')}`);
  }

  // 7. targetUrl あり時の冒頭ファクト引用必須化（quoteKey ベース）
  if (hasTargetUrl && factsForLetter && factsForLetter.length > 0) {
    const opening = body.slice(0, 200);
    const hasQuoteKeyInOpening = factsForLetter.some(f =>
      f.quoteKey && opening.includes(f.quoteKey)
    );

    if (!hasQuoteKeyInOpening) {
      total = Math.min(total, 75);
      issues.push('冒頭にファクト引用（quoteKey）がありません');
    }
  }

  // 8. 本文citation混入検出（Phase 6強化）
  const CITATION_IN_BODY_PATTERNS = [
    /\[citation[:：][^\]]*\]/gi,
    /【citation[:：][^】]*】/gi,
    /\[出典[:：][^\]]*\]/gi,
    /【出典[:：][^】]*】/gi,
    /\(citation[:：][^)]*\)/gi,
  ];

  const hasCitationInBody = CITATION_IN_BODY_PATTERNS.some(p => p.test(body));
  if (hasCitationInBody) {
    total = Math.min(total, 75);
    issues.push('本文に[citation:...]マーカーが混入しています（除去が必要）');
  }

  return {
    total,
    breakdown: {
      specificity,
      empathy,
      ctaClarity,
      fiveElementsComplete,
      noNgExpressions,
    },
    suggestions: [...suggestions.slice(0, 3), ...issues],
  };
}

/**
 * Phase 6: ブリッジ構造検出
 *
 * 冒頭200文字以内に「フック→ブリッジ→仮説」の流れがあるかチェック
 */
export interface BridgeDetectionResult {
  hasBridge: boolean;
  bridgeQuality: 'strong' | 'weak' | 'missing';
  details: {
    hasHook: boolean;     // ファクト引用あり
    hasBridgeText: boolean; // 接続文あり
    hasHypothesis: boolean; // 仮説表現あり
  };
}

export function detectBridgeStructure(
  body: string,
  factsForLetter: SelectedFact[]
): BridgeDetectionResult {
  const opening = body.slice(0, 200);

  // フック検出（ファクト引用）
  const hasHook = factsForLetter.length > 0 &&
    factsForLetter.some(f => opening.includes(f.quoteKey));

  // ブリッジ文検出（接続表現）
  const bridgePatterns = [
    /拝見し/,
    /伺い/,
    /お聞きし/,
    /ご注力/,
    /お取り組み/,
    /に関連して/,
    /に際して/,
    /を踏まえ/,
  ];
  const hasBridgeText = bridgePatterns.some(p => p.test(opening));

  // 仮説表現検出
  const hypothesisPatterns = [
    /ではないでしょうか/,
    /と推察/,
    /かと存じます/,
    /のではないかと/,
    /かもしれません/,
  ];
  const hasHypothesis = hypothesisPatterns.some(p => p.test(opening));

  // 品質判定
  let bridgeQuality: 'strong' | 'weak' | 'missing';
  if (hasHook && hasBridgeText && hasHypothesis) {
    bridgeQuality = 'strong';
  } else if (hasHook || (hasBridgeText && hasHypothesis)) {
    bridgeQuality = 'weak';
  } else {
    bridgeQuality = 'missing';
  }

  return {
    hasBridge: bridgeQuality !== 'missing',
    bridgeQuality,
    details: {
      hasHook,
      hasBridgeText,
      hasHypothesis,
    },
  };
}

/**
 * Phase 6: 根拠なき断定検出
 *
 * body内で、factsForLetter/proofPointsに無い数字や断定表現を検出
 */
export interface BaselessAssertionResult {
  issues: string[];
  penalty: number;
}

export function detectBaselessAssertions(
  body: string,
  factsForLetter: SelectedFact[],
  proofPoints: ProofPoint[],
  hasTargetUrl: boolean
): BaselessAssertionResult {
  const issues: string[] = [];
  let penalty = 0;

  // 1. 数値断定検出（factsForLetterに無い数字）
  const numbersInBody = body.match(/\d+[%％万億件社名時間日週月年拠点]/g) || [];
  const allowedNumbers = new Set<string>();

  // factsForLetterから許可された数字を収集
  for (const fact of factsForLetter) {
    const nums = fact.content.match(/\d+/g) || [];
    nums.forEach(n => allowedNumbers.add(n));
  }

  // proofPointsからも許可された数字を収集
  for (const pp of proofPoints) {
    const nums = pp.content.match(/\d+/g) || [];
    nums.forEach(n => allowedNumbers.add(n));
  }

  // 許可されていない数字を検出
  for (const num of numbersInBody) {
    const digitMatch = num.match(/\d+/);
    if (digitMatch && !allowedNumbers.has(digitMatch[0])) {
      // ただし、15分、30分などのCTA用数字は除外
      if (!['15', '30', '20', '10'].includes(digitMatch[0])) {
        issues.push(`根拠なき数値: ${num}`);
        penalty += 10;
      }
    }
  }

  // 2. 決めつけ表現検出
  const assertivePatterns = [
    { pattern: /御社では.{1,20}が課題です/, penalty: 7, desc: '決めつけ表現' },
    { pattern: /貴社では.{1,20}が問題/, penalty: 7, desc: '決めつけ表現' },
    { pattern: /明らかに.{1,20}です/, penalty: 5, desc: '過剰断定' },
    { pattern: /間違いなく/, penalty: 5, desc: '過剰断定' },
    { pattern: /確実に.{1,20}です/, penalty: 5, desc: '過剰断定' },
  ];

  for (const { pattern, penalty: p, desc } of assertivePatterns) {
    if (pattern.test(body)) {
      issues.push(desc);
      penalty += p;
    }
  }

  // 3. 根拠なきニュース引用（recent_newsが空の場合は別途チェック済みなのでここでは追加のみ）
  // URLありでファクトがあるのに、ファクトに無いニュースを言及している場合
  if (hasTargetUrl && factsForLetter.length > 0) {
    const newsPatterns = [
      /先日.{1,30}発表/,
      /報道によると/,
      /〜と発表/,
    ];
    for (const pattern of newsPatterns) {
      if (pattern.test(body)) {
        // factsForLetterに該当するニュースがあるかチェック
        const hasMatchingFact = factsForLetter.some(f =>
          f.category === 'recentMoves' && body.includes(f.quoteKey)
        );
        if (!hasMatchingFact) {
          issues.push('根拠なきニュース引用');
          penalty += 10;
          break;
        }
      }
    }
  }

  return { issues, penalty };
}

/**
 * Phase 6: ソース出典検証
 *
 * factsForLetterにsourceUrlが付いているか、citationsが適切かチェック
 */
export interface SourceAttributionResult {
  issues: string[];
  penalty: number;
}

export function validateSourceAttribution(
  factsForLetter: SelectedFact[],
  citations: Citation[],
  hasTargetUrl: boolean
): SourceAttributionResult {
  if (!hasTargetUrl) {
    return { issues: [], penalty: 0 };
  }

  const issues: string[] = [];
  let penalty = 0;

  // 1. factsForLetterにsourceUrlが無い場合
  const factsWithoutSource = factsForLetter.filter(f => !f.sourceUrl);
  if (factsWithoutSource.length > 0) {
    issues.push(`${factsWithoutSource.length}件のファクトに出典URLがありません`);
    penalty += factsWithoutSource.length * 3;
  }

  // 2. citationsが空の場合（factを使ったのにcitation無し）
  if (factsForLetter.length > 0 && citations.length === 0) {
    issues.push('本文でのファクト使用箇所が特定されていません');
    penalty += 5;
  }

  return { issues, penalty };
}

/**
 * Phase 6: ブリッジ品質によるスコア上限設定
 */
export function applyBridgeQualityLimit(
  score: number,
  bridgeQuality: 'strong' | 'weak' | 'missing'
): number {
  switch (bridgeQuality) {
    case 'missing':
      return Math.min(score, 75);
    case 'weak':
      return Math.min(score, 85);
    case 'strong':
    default:
      return score;
  }
}

/**
 * 無根拠診断使用時のスコア上限設定
 */
export function applyUnfoundedDiagnosisLimit(
  score: number,
  body: string
): { score: number; limited: boolean } {
  const hasUnfounded = UNFOUNDED_DIAGNOSIS_PATTERNS.some(p => p.test(body));
  if (hasUnfounded) {
    return { score: Math.min(score, 80), limited: true };
  }
  return { score, limited: false };
}

/**
 * Event招待状専用: 品質スコア
 */
export interface EventQualityScore {
  total: number;
  penalties: {
    baselessDiagnosis: number;
    strongAssertion: number;
    dualCta: number;
    missingTakeaways: number;
    missingPosition: number;
    tooLong: number;
    coldOutreachGreeting: number;
    positionConfusion: number;
    unconfirmedSpeaker: number;
    missingSelfIntro: number;
    abstractValue: number;
  };
  issues: string[];
}

/**
 * Event招待状専用: 品質スコア計算
 *
 * @param body - レター本文
 * @param eventPosition - イベントへの立ち位置（sponsor/speaker/case_provider）
 * @returns Event専用品質スコア
 */
export function calculateEventQualityScore(
  body: string,
  eventPosition?: string
): EventQualityScore {
  const issues: string[] = [];
  const penalties = {
    baselessDiagnosis: 0,
    strongAssertion: 0,
    dualCta: 0,
    missingTakeaways: 0,
    missingPosition: 0,
    tooLong: 0,
    coldOutreachGreeting: 0,
    positionConfusion: 0,
    unconfirmedSpeaker: 0,
    missingSelfIntro: 0,
    abstractValue: 0,
  };

  // 1. 無根拠診断検出 (-15点/件、上限-30点)
  const baselessHits = EVENT_BASELESS_DIAGNOSIS_PATTERNS.filter(p => p.test(body));
  if (baselessHits.length > 0) {
    penalties.baselessDiagnosis = Math.min(baselessHits.length * 15, 30);
    issues.push(`無根拠診断表現が${baselessHits.length}件検出。質問型に書き換えてください`);
  }

  // 2. 強断言検出 (-10点/件、上限-20点)
  const strongHits = EVENT_STRONG_ASSERTION_PATTERNS.filter(p => p.test(body));
  if (strongHits.length > 0) {
    penalties.strongAssertion = Math.min(strongHits.length * 10, 20);
    issues.push(`強断言表現が${strongHits.length}件検出されました`);
  }

  // 3. CTA二重取り検出 (-20点)
  for (const { a, b } of EVENT_DUAL_CTA_COMBINATIONS) {
    if (a.test(body) && b.test(body)) {
      penalties.dualCta = 20;
      issues.push('CTAが二重です（参加 or 資料の2択にしてください）');
      break;
    }
  }

  // 4. 持ち帰りベネフィット不足 (-15点)
  const takeawayPatterns = [
    /チェックリスト/,
    /フレームワーク|標準プロセス|の型/,
    /監査観点|指摘.*ポイント/,
    /ベンチマーク|比較.*データ/,
    /ノウハウ|手法|メソッド/,
    /テンプレート|ひな形/,
  ];
  const takeawayCount = takeawayPatterns.filter(p => p.test(body)).length;
  if (takeawayCount < 2) {
    penalties.missingTakeaways = 15;
    issues.push('セミナーの持ち帰りベネフィットを3点以上具体的に記載してください');
  }

  // 5. 立ち位置不明記 (-10点)
  const positionPatterns = [/協賛/, /登壇/, /事例.*提供/, /主催/, /共催/];
  const hasPosition = positionPatterns.some(p => p.test(body)) || Boolean(eventPosition);
  if (!hasPosition) {
    penalties.missingPosition = 10;
    issues.push('イベントへの立ち位置（協賛/登壇/事例提供）を明記してください');
  }

  // 6. 文章過長 (-10点)
  const paragraphCount = body.split(/\n\n+/).filter(p => p.trim()).length;
  if (paragraphCount > 5 || body.length > 500) {
    penalties.tooLong = 10;
    issues.push('文章が長すぎます。5段落以内、450文字以内に収めてください');
  }

  // 7. 冷開拓NG挨拶検出 (-10点)
  const coldGreetingHit = EVENT_COLD_OUTREACH_NG_GREETINGS.some(p => p.test(body));
  if (coldGreetingHit) {
    penalties.coldOutreachGreeting = 10;
    issues.push('冷開拓では「平素より」ではなく「突然のご連絡失礼いたします」を使用してください');
  }

  // 8. 立ち位置矛盾検出 (-15点)
  for (const { role, action } of EVENT_POSITION_CONFUSION_PATTERNS) {
    if (role.test(body) && action.test(body)) {
      penalties.positionConfusion = 15;
      issues.push('立ち位置が矛盾しています（協賛なら「開催」ではなく主催者を明記）');
      break;
    }
  }

  // 9. 登壇者未確定検出 (-5点)
  const unconfirmedHit = EVENT_UNCONFIRMED_SPEAKER_PATTERNS.some(p => p.test(body));
  if (unconfirmedHit) {
    penalties.unconfirmedSpeaker = 5;
    issues.push('「（予定）」は信頼を削ります。役職名でぼかすか確定後に送付してください');
  }

  // 10. 自己紹介欠落検出 (-10点)
  // 「突然のご連絡」の後に会社名・名前がない場合
  const hasColdGreeting = /突然のご連絡/.test(body);
  const hasSelfIntro = /です。|と申します|の[^\s]+です/.test(body.substring(0, 100));
  if (hasColdGreeting && !hasSelfIntro) {
    penalties.missingSelfIntro = 10;
    issues.push('「突然のご連絡」の後に会社名・名前を名乗ってください（例: 株式会社〇〇の〇〇です）');
  }

  // 11. 抽象的な価値表現検出 (-5点)
  const abstractHit = EVENT_ABSTRACT_VALUE_PATTERNS.some(p => p.test(body));
  if (abstractHit) {
    penalties.abstractValue = 5;
    issues.push('「最新事例やノウハウ」は抽象的です。具体的な持ち帰り3点を明記してください');
  }

  const totalPenalty = Object.values(penalties).reduce((a, b) => a + b, 0);
  return {
    total: Math.max(0, 100 - totalPenalty),
    penalties,
    issues,
  };
}

/**
 * Consulting（相談型レター）専用: 品質スコア
 */
export interface ConsultingQualityScore {
  total: number;
  penalties: {
    forbiddenWords: number;
    citationInBody: number;
    dualCta: number;
    assertiveDiagnosis: number;
    tooShort: number;
    tooLong: number;
    missingPublicFact: number;
    missingTwoChoiceCta: number;
  };
  issues: string[];
}

/**
 * Consulting（相談型レター）専用: 品質スコア計算
 */
export function calculateConsultingQualityScore(
  body: string,
): ConsultingQualityScore {
  const issues: string[] = [];
  const penalties = {
    forbiddenWords: 0,
    citationInBody: 0,
    dualCta: 0,
    assertiveDiagnosis: 0,
    tooShort: 0,
    tooLong: 0,
    missingPublicFact: 0,
    missingTwoChoiceCta: 0,
  };

  // 1. 禁止ワード検出 (-10点/件、上限-30点)
  const forbiddenHits = CONSULTING_MODE_FORBIDDEN_WORDS.filter(w => body.includes(w));
  if (forbiddenHits.length > 0) {
    penalties.forbiddenWords = Math.min(forbiddenHits.length * 10, 30);
    issues.push(`禁止表現が${forbiddenHits.length}件: ${forbiddenHits.join(', ')}`);
  }

  // 2. citation/注釈混入検出 (-25点、スコア強制75未満)
  const hasCitation = CONSULTING_CITATION_PATTERNS.some(p => p.test(body));
  if (hasCitation) {
    penalties.citationInBody = 25;
    issues.push('本文にcitation/注釈マーカーが混入しています（除去が必要）');
  }

  // 3. CTA二重取り検出 (-15点)
  for (const { a, b } of CONSULTING_DUAL_CTA_COMBINATIONS) {
    if (a.test(body) && b.test(body)) {
      penalties.dualCta = 15;
      issues.push('CTAが二重です（「15分相談」か「資料だけ」の2択にしてください）');
      break;
    }
  }

  // 4. 課題断定検出 (-15点/件、上限-30点)
  const assertiveHits = CONSULTING_ASSERTIVE_DIAGNOSIS_PATTERNS.filter(p => p.test(body));
  if (assertiveHits.length > 0) {
    penalties.assertiveDiagnosis = Math.min(assertiveHits.length * 15, 30);
    issues.push(`課題断定表現が${assertiveHits.length}件検出。質問形に書き換えてください`);
  }

  // 5. 文字数チェック
  const charCount = body.length;
  if (charCount < 700) {
    penalties.tooShort = 15;
    issues.push(`文字数が少なすぎます（${charCount}文字/700文字以上必要）`);
  }
  if (charCount > 900) {
    penalties.tooLong = 10;
    issues.push(`文字数が多すぎます（${charCount}文字/900文字以内）`);
  }

  // 6. 2択CTA検出（「1.」と「2.」のパターン）
  const hasTwoChoiceCta = /[1１][\.\．\)）]/.test(body) && /[2２][\.\．\)）]/.test(body);
  if (!hasTwoChoiceCta) {
    penalties.missingTwoChoiceCta = 10;
    issues.push('2択CTAが検出されませんでした（例: 1. 15分相談 / 2. 資料希望）');
  }

  const totalPenalty = Object.values(penalties).reduce((a, b) => a + b, 0);
  return {
    total: Math.max(0, 100 - totalPenalty),
    penalties,
    issues,
  };
}
