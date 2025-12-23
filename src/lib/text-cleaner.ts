/**
 * AI生成テキストのクリーニングユーティリティ
 * Markdownコードブロックや不要なフォーマットを削除
 */

/**
 * AIレスポンスから不要なMarkdownコードブロック記号を削除
 * @param text - クリーニング対象のテキスト
 * @returns クリーニング済みのテキスト
 */
export function cleanAIResponse(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove markdown code blocks (```text, ```markdown, ``` at start/end)
  // Pattern 1: ```markdown\n or ```text\n at the start
  cleaned = cleaned.replace(/^```(?:markdown|text|json)?\s*\n/i, '');

  // Pattern 2: \n``` at the end
  cleaned = cleaned.replace(/\n```\s*$/i, '');

  // Pattern 3: Remaining ``` anywhere (aggressive cleanup)
  cleaned = cleaned.replace(/```(?:markdown|text|json)?/gi, '');

  // Trim extra whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * JSONパース用のクリーニング（メール生成などで使用）
 * @param text - クリーニング対象のテキスト
 * @returns クリーニング済みのテキスト
 */
export function cleanJSONResponse(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove markdown code blocks specifically for JSON
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    cleaned = match[1];
  }

  cleaned = cleaned.trim();
  return cleaned;
}
