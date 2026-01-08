/**
 * レター関連の型定義
 */

// レターのモード（セールスレター or イベント招待状）
export type LetterMode = 'sales' | 'event';

// レターの入力複雑度（かんたん or 詳細）
export type InputComplexity = 'simple' | 'detailed';

// レターのステータス
export type LetterStatus = 'draft' | 'generated' | 'sent' | 'replied' | 'meeting_set' | 'failed' | 'archived';

// レターフォームのデータ構造
export interface LetterFormData {
  // 自社情報
  myCompanyName: string;
  myDepartment?: string;
  myName: string;
  myServiceDescription: string;

  // ターゲット情報
  companyName: string;
  department?: string;
  position: string;
  name: string;

  // セールスレター用フィールド
  background: string;
  problem: string;
  solution: string;
  caseStudy: string;
  offer: string;
  freeformInput?: string; // まとめて入力用

  // イベント招待モード用フィールド
  eventUrl?: string;
  eventName?: string;
  eventDateTime?: string;
  eventSpeakers?: string;
  invitationReason?: string;

  // かんたんモード用フィールド
  simpleRequirement?: string;

  // 検索結果（ニュース統合）
  searchResults?: string;
}

// レターの履歴データ構造（クライアント用 - キャメルケース）
export interface LetterHistory {
  id: string;
  createdAt: string;
  targetCompany: string;
  targetName: string;
  content: string;
  isPinned?: boolean;
  mode?: LetterMode;
  status?: LetterStatus;
  inputs: LetterFormData;
  batchId?: string;
  emailContent?: { subject: string; body: string };
}

// AI提案データ構造
export interface AISuggestion {
  suggestions: string[];
}

// API生成レスポンス
export interface GenerateResponse {

  letter?: string;
  variations?: {
    standard: string;
    emotional: string;
    consultative: string;
  };
  email?: {
    subject: string;
    body: string;
  };
  error?: string;
  message?: string;
  suggestion?: string;
}

// レター構成案の構造
export interface LetterStructure {
  background: string;
  problem: string;
  solution: string;
  caseStudy: string;
  offer: string;
}

// 解析フェーズ（SSE進捗表示用）
export type AnalysisPhase = 'connecting' | 'extracting' | 'searching' | 'generating' | 'complete';

// 業界タイプ
export type Industry = 'it' | 'manufacturing' | 'service' | 'finance' | 'retail' | 'generic';

// ソース解析レスポンス
export interface AnalyzeSourceResponse {
  data?: {
    companyName?: string;
    personName?: string;
    personPosition?: string;
    summary?: string;
    context?: string;
    eventName?: string;
    eventDateTime?: string;
    eventSpeakers?: string;
    letterStructure?: LetterStructure;
  };
  error?: string;
  message?: string;
  suggestion?: string;
}

// SSEイベントデータ
export interface SSEEvent {
  phase?: AnalysisPhase;
  message?: string;
  data?: AnalyzeSourceResponse['data'];
  error?: string;
}

// APIエラーレスポンス
export interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  suggestion?: string;
}
