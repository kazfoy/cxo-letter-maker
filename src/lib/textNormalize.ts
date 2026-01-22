/**
 * 手紙本文の改行を正規化する
 * - 段落区切りは「空行1つ」（\n\n）に統一
 * - 空白のみの行も空行として扱う
 */
export function normalizeLetterText(text: string | undefined | null): string {
  if (!text) return '';

  return text
    .replace(/\r\n/g, '\n')           // 1) CRLFをLFに統一
    .replace(/[ \t]+\n/g, '\n')        // 2) 改行前の空白を削除（空白のみの行対策）
    .replace(/[ \t]+$/gm, '')          // 3) 行末の不要スペース削除
    .replace(/\n{3,}/g, '\n\n')        // 4) 連続空行は最大1つ
    .trim();                           // 5) 先頭/末尾の空白行削除
}
