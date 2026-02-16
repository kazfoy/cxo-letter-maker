/**
 * person_nameのバリデーション
 * 記事タイトル・見出し等が混入していないかチェックし、不正な場合は空文字を返す
 */
export function sanitizePersonName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  // 10文字超は人名として不自然（日本語人名2-6文字、外国人カタカナ名8文字程度）
  if (trimmed.length > 10) return '';
  // 記事タイトル的なキーワードを含む場合はNG
  const titleKeywords = [
    // 動詞句パターン
    'が発表', 'を発表', 'に就任', 'が開始', 'を開始', 'が決定', 'を決定',
    'が導入', 'を導入', 'が実現', 'を実施', 'を買収', 'と合併', 'が上場',
    'が語る', 'が明かす', 'を開設', 'が提携', 'が統合', 'が成長',
    // 時期表現
    '年度', '四半期',
    // 役職+新
    '新CEO', '新CTO', '新CIO', '新COO', '新CFO', '新社長', '新会長',
    // 記事ジャンル
    '速報', '独占', '最新', '特集', '解説', '分析', 'インタビュー',
    // 助詞パターン（人名には含まれない）
    'について', 'における', 'に向けた', 'の戦略', 'の挑戦',
  ];
  if (titleKeywords.some(kw => trimmed.includes(kw))) return '';
  // 「」や（）を含む（見出し的）
  if (/[「」『』（）()]/.test(trimmed)) return '';
  // 句読点を含む
  if (/[。、！？!?]/.test(trimmed)) return '';
  return trimmed;
}
