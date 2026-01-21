/**
 * アプリケーション全体で使用する定数・テキストリソース
 */

// フォームのラベル
export const FORM_LABELS = {
  sales: {
    title: '手紙の情報を入力',
    submit: '手紙を作成する',
    companyInfo: '差出人（自社）情報',
    targetInfo: 'ターゲット情報',
    letterStructure: 'CxOレター構成（5要素）',
    stepInput: 'ステップ入力',
    freeformInput: 'まとめて入力',
  },
  event: {
    title: 'イベント招待状の情報を入力',
    submit: 'イベント招待状を作成する',
    companyInfo: '差出人（自社）情報',
    targetInfo: 'ターゲット情報',
    eventInfo: 'イベント情報',
    stepInput: 'ステップ入力（詳細）',
    freeformInput: 'まとめて入力',
  },
};

// フィールドラベル
export const FIELD_LABELS = {
  myCompanyName: '会社名',
  myDepartment: '部署名',
  myName: '氏名',
  myServiceDescription: '自社サービスの概要',
  companyName: '企業名',
  department: '部署名',
  position: '役職',
  name: '氏名',
  background: '1. 背景・フック',
  problem: '2. 課題の指摘',
  solution: '3. 解決策の提示',
  caseStudy: '4. 事例・実績',
  offer: '5. オファー',
  freeformInput: '手紙の内容をまとめて入力',
  eventUrl: 'イベントURL',
  eventName: 'イベント名',
  eventDateTime: '開催日時・場所',
  eventSpeakers: '主要登壇者/ゲスト',
  invitationReason: '招待の背景（Why You?）',
  simpleCompanyName: '1. ターゲット企業名',
  simpleServiceDescription: '2. 自社サービス名・概要',
  simpleRequirement: '3. 伝えたい要件（任意）',
  productStrength: '商材の強み',
  targetChallenges: 'ターゲットの課題',
};

// CTA選択肢
export const CTA_OPTIONS = {
  schedule_url: {
    label: '日程調整URLあり',
    template: 'ご都合の良い日程をこちらからお選びください',
  },
  date_text: {
    label: '候補日時をテキストで提示',
    template: '以下の日程でご都合はいかがでしょうか。\n・{date1}\n・{date2}\n・{date3}',
  },
  contact_only: {
    label: '電話またはメールのみ',
    template: 'お電話またはメールにてお気軽にご連絡ください',
  },
} as const;

export type CtaType = keyof typeof CTA_OPTIONS

// ボタンテキスト
export const BUTTON_TEXTS = {
  reset: 'リセット',
  sample: 'サンプルを入力',
  aiAssist: 'AIアシスト',
  ownHp: '自社HP/資料から入力',
  ownHpShort: 'HPから入力',
  targetHp: '相手HP/記事から入力',
  autoAnalyze: '自動解析',
  analyzing: '解析中...',
  structureSuggestion: '構成案を相談する',
  generating: '作成中...',
  generationComplete: '作成完了！',
  selectSuggestion: '選択',
  close: '閉じる',
};

// メッセージ
export const MESSAGES = {
  errors: {
    aiAssistRequired: 'AIアシストを使用するには、企業名と自社サービスの概要を入力してください。',
    aiAssistFailed: 'AIアシストに失敗しました。',
    structureSuggestionRequired: '構成案を提案するには、企業名と自社サービスの概要を入力してください。',
    sourceAnalysisFailed: 'ソース解析に失敗しました。',
    eventUrlRequired: 'イベントURLを入力してください。',
    eventUrlAnalysisFailed: 'イベントURL解析に失敗しました。',
    letterGenerationFailed: '手紙の生成に失敗しました。',
    genericError: 'エラーが発生しました',
    retryMessage: 'もう一度お試しください。',
    checkUrlMessage: 'URLを確認して、もう一度お試しください。',
  },
  info: {
    simpleMode: '最小限の情報でお試しいただけます。AIが自動的に補完して手紙を作成します。',
    eventFreeformMode: '最小限の情報でイベント招待状を作成できます。AIがイベント情報を解析し、招待の必然性を構成します。',
    freeformHelp: '箇条書き、メモ、既存の文章など、どんな形式でもOKです。AIが自動的にCxOレターの形式に整形します。',
    simpleRequirementHelp: '手紙の目的を一言で記入してください（例: 「アポを取りたい」「サービス紹介」）',
    eventUrlHelp: 'イベントのURLを入力して「自動解析」をクリックすると、イベント名・日時・登壇者が自動入力されます',
    invitationMemoHelp: '招待したい背景や理由を自由に記入してください。AIが招待状の「Why You?」部分を構成します。',
    aiThinking: 'AIが候補を考えています...',
  },
  modal: {
    aiAssistTitle: 'AIアシスト - 候補を選択',
    candidatePrefix: '候補',
  },
};

// タブ・モード切り替えのラベル
export const TAB_LABELS = {
  simpleMode: 'かんたんモード',
  detailedMode: '詳細モード',
  stepInput: 'ステップ入力',
  freeformInput: 'まとめて入力',
  stepInputDetailed: 'ステップ入力（詳細）',
};

// アイコン
export const ICONS = {
  sample: '',
  aiAssist: '',
  ownHp: '',
  targetHp: '',
  submit: '',
  checkmark: '✓',
  close: '✕',
};

// 必須マーク
export const REQUIRED_MARK = '*';

// 外部リンク
export const EXTERNAL_LINKS = {
  support: 'https://forms.gle/eRc3L6aGr65b5CVM8',
  termsOfService: '/terms',
  privacyPolicy: '/privacy',
};

// ナビゲーション
export const NAVIGATION = {
  dashboard: {
    path: '/dashboard',
    label: 'ダッシュボード',
    icon: 'home',
  },
  newLetter: {
    path: '/new',
    label: '新規作成',
    icon: 'plus',
  },
  bulkGenerate: {
    path: '/bulk',
    label: '一括作成',
    icon: 'upload',
  },
  history: {
    path: '/dashboard/history',
    label: '履歴',
    icon: 'clock',
  },
  settings: {
    path: '/dashboard/settings',
    label: '設定',
    icon: 'settings',
  },
  support: {
    path: EXTERNAL_LINKS.support,
    label: 'お問い合わせ',
    icon: 'help',
    external: true,
  },
};
