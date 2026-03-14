import type { SelectedFact, TopicTag } from '@/types/analysis';

export const NG_KEYWORDS = [
  '多様性表彰',
  'ワールドプレミア',
  '製品発表会',
  '株主優待',
  '優待',
  '配当',
  '決算説明会',
  '株主総会',
  '授賞式',
];

export const CATEGORY_PRIORITY: Record<SelectedFact['category'], number> = {
  recentMoves: 1,
  companyDirection: 2,
  numbers: 3,
  hiringTrends: 4,
  properNouns: 5,
};

export const CXO_KEYWORDS_PRIVATE = [
  'ガバナンス', '経営', '管理', '統制', '監査', 'コンプライアンス',
  '組織', '人権', 'グローバル', 'サステナビリティ', 'ESG',
  'カーボンニュートラル', 'DX', 'デジタル', '業務改革', 'BPR',
  'リスク', '内部統制',
];

export const CXO_KEYWORDS_PUBLIC = [
  '行政改革', '住民サービス', '官民連携', 'デジタル庁', '自治体DX',
  '電子行政', 'スマートシティ', '公共調達', '行政手続', 'マイナンバー',
  'ガバナンス', '統制', 'DX', 'デジタル', 'リスク',
];

export const PUBLIC_SECTOR_DETECT_KEYWORDS = [
  '省', '庁', '府', '自治体', '市役所', '区役所', '町役場', '村役場',
  '県庁', '都庁', '道庁', '官公庁', '独立行政法人', '公社', '公団',
  '機構', '財団法人', '社団法人', '公共', '行政',
];

export const PUBLIC_SECTOR_URL_PATTERNS = [
  /\.go\.jp/i, /\.lg\.jp/i, /\.ac\.jp/i, /\.ed\.jp/i,
];

export const PUBLIC_SECTOR_NAME_KEYWORDS = [
  '省', '庁', '府', '大学', '学園', '市', '区', '町', '村', '県',
  '都', '道', '国立', '公立', '学校法人',
];

export const STARTUP_URL_KEYWORDS = [
  'startup', 'ventures', 'labs', 'inc', 'io',
];

export const STARTUP_CONTENT_KEYWORDS = [
  'シリーズA', 'シリーズB', 'シリーズC', 'シードラウンド',
  '資金調達', 'IPO準備', '上場準備',
  'ベンチャー', 'スタートアップ',
  'プレシリーズ', 'エンジェル投資',
];

export const CELEBRATION_PATTERNS: { pattern: RegExp; type: SelectedFact['celebration'] }[] = [
  { pattern: /上場|IPO|東証|マザーズ|グロース市場|プライム市場|スタンダード市場/, type: 'listing' },
  { pattern: /受賞|アワード|表彰|グランプリ|最優秀/, type: 'award' },
  { pattern: /(\d+)\s*周年/, type: 'anniversary' },
  { pattern: /新社長|社長就任|CEO就任|代表取締役.*就任/, type: 'appointment' },
  { pattern: /過去最高益|増収増益|最高売上|過去最高/, type: 'record' },
];

export const CELEBRATION_TEXT: Record<NonNullable<SelectedFact['celebration']>, string> = {
  listing: 'ご上場',
  award: 'ご受賞',
  anniversary: '周年',
  appointment: 'ご就任',
  record: '過去最高益のご達成',
};

export const TOPIC_TAG_KEYWORDS: Record<TopicTag, string[]> = {
  governance: ['ガバナンス', '内部統制', '取締役会', '監査', '統制'],
  compliance: ['コンプライアンス', '法令遵守', '規制', '適正', '不正防止'],
  supply_chain: ['サプライチェーン', '調達', '物流', 'SCM', '供給'],
  finance_ops: ['財務', '経理', '会計', '決算', '予算', '連結'],
  digital_transformation: ['DX', 'デジタル', 'IT', 'AI', 'クラウド', '自動化', 'RPA'],
  sustainability: ['サステナビリティ', 'ESG', 'カーボンニュートラル', '脱炭素', '環境', 'SDGs'],
  global_expansion: ['グローバル', '海外', '国際', '進出', '越境'],
  hr_organization: ['人事', '組織', '採用', '人材', 'タレント', '働き方'],
  risk_management: ['リスク', 'BCP', '危機管理', 'セキュリティ', '情報管理'],
  growth_strategy: ['成長', 'M&A', '新規事業', '投資', '戦略'],
  other: [],
};

export const FACT_SHORTAGE_THRESHOLD = 5;
