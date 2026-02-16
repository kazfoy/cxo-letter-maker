/**
 * レター関連の型定義
 */

import type { InformationSource } from './analysis';
import type { Citation } from './generate-v2';

// レターのモード（セールスレター / イベント招待状）
export type LetterMode = 'sales' | 'event';

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
  targetUrl?: string; // 相手企業URL（V2分析用）

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
  eventPosition?: 'sponsor' | 'speaker' | 'case_provider';

  // かんたんモード用フィールド
  simpleRequirement?: string;

  // 検索結果（ニュース統合）
  searchResults?: string;

  // Phase 5: 追加フィールド
  productStrength?: string;     // 商材の強み
  targetChallenges?: string;    // ターゲットの課題

  // CxO個人情報・共通接点
  cxoInsight?: string;          // CxO個人の発信情報（SNS投稿、講演、著書等）
  mutualConnection?: string;    // 共通の知人・過去の接点
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
  /** V2生成の情報ソース（暫定: inputs jsonb 内に _sources として保存） */
  sources?: InformationSource[];
  /** V2生成のcitation（暫定: inputs jsonb 内に _citations として保存） */
  citations?: Citation[];
}

// AI提案データ構造
export interface AISuggestion {
  suggestions: string[];
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
