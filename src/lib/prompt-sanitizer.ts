/**
 * プロンプトサニタイザー（プロンプトインジェクション対策）
 * ユーザー入力をAIプロンプトに安全に埋め込むための処理
 */

/**
 * プロンプトインジェクション対策のための入力サニタイズ
 *
 * @param input ユーザー入力文字列
 * @param maxLength 最大文字数（デフォルト: 5000）
 * @returns サニタイズされた文字列
 */
export function sanitizeForPrompt(input: string, maxLength: number = 5000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // 1. 文字数制限
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // 2. 制御文字の削除（改行、タブは保持）
  // null文字、垂直タブ、フォームフィード、その他の制御文字を削除
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 3. プロンプト区切り文字のエスケープ
  // AIプロンプトで使用される区切り文字を無害化
  sanitized = sanitized
    .replace(/```/g, '` ` `')     // コードブロック区切り
    .replace(/---/g, '- - -')     // 区切り線
    .replace(/===/g, '= = =');    // 区切り線

  // 4. 連続する改行の制限（最大3つまで）
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');

  // 5. プロンプトインジェクションを示唆するパターンの検出と無害化
  // "Ignore previous instructions" などの典型的なインジェクション試行
  const injectionPatterns = [
    /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|context)/gi,
    /forget\s+(everything|all|previous|above)/gi,
    /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /new\s+instructions?:/gi,
    /system\s+(prompt|role|message|instructions?):/gi,
    /you\s+are\s+now\s+(a|an)\s+/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, (match) => {
      // マッチした文字列をスペースで区切って無害化
      return match.split('').join(' ');
    });
  }

  // 6. 先頭と末尾の空白文字を削除
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * 複数の入力をまとめてサニタイズ
 *
 * @param inputs 入力オブジェクト（キー: フィールド名、値: 入力文字列）
 * @param maxLength 各フィールドの最大文字数
 * @returns サニタイズされた入力オブジェクト
 */
export function sanitizeMultipleInputs(
  inputs: Record<string, string | undefined>,
  maxLength: number = 5000
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (value !== undefined && value !== null) {
      sanitized[key] = sanitizeForPrompt(value, maxLength);
    } else {
      sanitized[key] = '';
    }
  }

  return sanitized;
}

/**
 * プロンプトテンプレート用の安全な文字列置換
 * テンプレート内のプレースホルダーを安全に置換
 *
 * @param template プロンプトテンプレート
 * @param replacements 置換する値のマップ
 * @returns 置換後のプロンプト
 */
export function safePromptReplace(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(replacements)) {
    const sanitizedValue = sanitizeForPrompt(value);
    const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(placeholder, sanitizedValue);
  }

  return result;
}

/**
 * URLが安全かどうかを簡易チェック
 * プロンプトに埋め込むURLの検証用
 *
 * @param url URL文字列
 * @returns 安全な場合true
 */
export function isSafeUrlForPrompt(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // HTTPSまたはHTTPのみ許可
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return false;
    }

    // データURLやJavaScript URLを拒否
    if (url.toLowerCase().startsWith('data:') || url.toLowerCase().startsWith('javascript:')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * プロンプトインジェクションの試行を検出
 * ログ記録や監視用
 *
 * @param input ユーザー入力
 * @returns インジェクション試行が検出された場合true
 */
export function detectInjectionAttempt(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // プロンプトインジェクションを示唆するパターン
  const suspiciousPatterns = [
    /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all|previous|above)/i,
    /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?)/i,
    /new\s+instructions?:/i,
    /system\s+(prompt|role|message|instructions?):/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /reset\s+(your|the)\s+(instructions?|context|memory)/i,
    /override\s+(previous|all|system)\s+(instructions?|rules?|settings?)/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(input)) {
      return true;
    }
  }

  // 異常に長い連続する特殊文字のチェック
  if (/[`\-=]{10,}/.test(input)) {
    return true;
  }

  return false;
}
