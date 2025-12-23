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
  myName: string;
  myServiceDescription: string;

  // ターゲット情報
  companyName: string;
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
  };
  error?: string;
  message?: string;
  suggestion?: string;
}

// APIエラーレスポンス
export interface ApiErrorResponse {
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  suggestion?: string;
}
