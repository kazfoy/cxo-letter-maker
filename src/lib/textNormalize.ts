/**
 * Citationマーカーパターン
 * 本文に混入した[citation:...]などのプレースホルダーを除去
 */
const CITATION_PATTERNS = [
  /\[citation[:：][^\]]*\]/gi,
  /【citation[:：][^】]*】/gi,
  /\[出典[:：][^\]]*\]/gi,
  /【出典[:：][^】]*】/gi,
  /\(citation[:：][^)]*\)/gi,
  /\[citations?[:：][^\]]*\]/gi,
];

/**
 * 本文からcitationマーカーを除去する
 */
export function stripCitationMarkers(text: string): string {
  if (!text) return '';
  let result = text;
  for (const pattern of CITATION_PATTERNS) {
    result = result.replace(pattern, '');
  }
  // 複数空白を1つに
  return result.replace(/  +/g, ' ');
}

/**
 * 本文にcitationマーカーが含まれているかチェック
 */
export function hasCitationMarkers(text: string): boolean {
  if (!text) return false;
  return CITATION_PATTERNS.some(p => p.test(text));
}

/**
 * 手紙本文の改行を正規化する
 * - citationマーカーを除去
 * - 段落区切りは「空行1つ」（\n\n）に統一
 * - 空白のみの行も空行として扱う
 */
export function normalizeLetterText(text: string | undefined | null): string {
  if (!text) return '';

  return stripCitationMarkers(text)    // 0) citationマーカー除去
    .replace(/\r\n/g, '\n')           // 1) CRLFをLFに統一
    .replace(/[ \t]+\n/g, '\n')        // 2) 改行前の空白を削除（空白のみの行対策）
    .replace(/[ \t]+$/gm, '')          // 3) 行末の不要スペース削除
    .replace(/\n{3,}/g, '\n\n')        // 4) 連続空行は最大1つ
    .trim();                           // 5) 先頭/末尾の空白行削除
}
