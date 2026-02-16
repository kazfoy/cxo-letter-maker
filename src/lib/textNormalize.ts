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

  const normalized = stripCitationMarkers(text)    // 0) citationマーカー除去
    .replace(/\r\n/g, '\n')           // 1) CRLFをLFに統一
    .replace(/[ \t]+\n/g, '\n')        // 2) 改行前の空白を削除（空白のみの行対策）
    .replace(/[ \t]+$/gm, '')          // 3) 行末の不要スペース削除
    .replace(/\n{3,}/g, '\n\n')        // 4) 連続空行は最大1つ
    .trim();                           // 5) 先頭/末尾の空白行削除

  // 6) 段落が不足している場合に自動分割（最終防衛ライン）
  return ensureParagraphStructure(normalized);
}

/**
 * 段落が不足している場合にセマンティック境界で自動分割する
 * サンプルデータやGeminiが改行なしで返したケースへの最終防衛ライン
 */
export function ensureParagraphStructure(text: string): string {
  if (!text || text.length < 100) return text;

  const existingParagraphs = text.split(/\n\n+/).filter(p => p.trim());
  if (existingParagraphs.length >= 3) return text;

  // 宛名行を分離
  let body = text;
  let salutation = '';
  const salutationMatch = body.match(/^(.+?様)\s*/);
  if (salutationMatch && salutationMatch[0].length < 80) {
    salutation = salutationMatch[1];
    body = body.slice(salutationMatch[0].length);
  }

  // 署名行を分離（末尾の「会社名\n担当者名」パターン）
  let signature = '';
  const sigPatterns = [
    /((?:株式会社|一般社団法人|合同会社)[^\n。、]*\n[^\n。、]+)$/,
    /((?:株式会社|一般社団法人|合同会社)[^\n。、]+)$/,
  ];
  for (const sigPattern of sigPatterns) {
    const sigMatch = body.match(sigPattern);
    if (sigMatch && sigMatch[0].length < 100) {
      signature = sigMatch[1];
      body = body.slice(0, body.length - sigMatch[0].length).trim();
      break;
    }
  }

  // 本文を転換語パターンで複数箇所分割
  const transitionPatterns = [
    /(?=株式会社ネクサスソリューションズは)/,
    /(?=弊社は)/,
    /(?=弊社の)/,
    /(?=つきましては)/,
    /(?=ぜひ)/,
    /(?=来週)/,
    /(?=今月)/,
    /(?=まず)/,
    /(?=具体的には)/,
    /(?=特に、)/,
  ];

  const positions: number[] = [];
  for (const pattern of transitionPatterns) {
    const match = body.match(pattern);
    if (match && match.index && match.index > 30) {
      const tooClose = positions.some(pos => Math.abs(pos - match.index!) < 30);
      if (!tooClose) positions.push(match.index);
    }
  }

  if (positions.length > 0) {
    positions.sort((a, b) => a - b);
    const parts: string[] = [];
    let lastPos = 0;
    for (const pos of positions) {
      const segment = body.slice(lastPos, pos).trim();
      if (segment) parts.push(segment);
      lastPos = pos;
    }
    const lastSegment = body.slice(lastPos).trim();
    if (lastSegment) parts.push(lastSegment);
    body = parts.filter(p => p.length > 0).join('\n\n');
  }

  const result = [salutation, body, signature]
    .filter(p => p.length > 0)
    .join('\n\n');

  return result;
}
