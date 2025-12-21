/**
 * API エラーコードの定義
 */
export const ErrorCodes = {
  // 入力エラー
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_URL_FORMAT: 'INVALID_URL_FORMAT',

  // スクレイピング・解析エラー
  SCRAPING_FAILED: 'SCRAPING_FAILED',
  URL_NOT_ACCESSIBLE: 'URL_NOT_ACCESSIBLE',
  CONTENT_NOT_FOUND: 'CONTENT_NOT_FOUND',
  PDF_PARSE_FAILED: 'PDF_PARSE_FAILED',
  PDF_PASSWORD_PROTECTED: 'PDF_PASSWORD_PROTECTED',
  ALL_SOURCES_FAILED: 'ALL_SOURCES_FAILED',

  // AI処理エラー
  AI_EXTRACTION_FAILED: 'AI_EXTRACTION_FAILED',
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_RESPONSE_INVALID: 'AI_RESPONSE_INVALID',

  // その他
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * 構造化されたエラーレスポンス
 */
export interface ApiError {
  error: true;
  code: ErrorCode;
  message: string;
  suggestion?: string;
  details?: any;
}

/**
 * エラーメッセージとサジェスチョンのマッピング
 */
const errorMessages: Record<ErrorCode, { message: string; suggestion: string }> = {
  [ErrorCodes.INVALID_INPUT]: {
    message: '入力形式が正しくありません。',
    suggestion: '入力内容を確認して、もう一度お試しください。',
  },
  [ErrorCodes.MISSING_REQUIRED_FIELD]: {
    message: '必須項目が入力されていません。',
    suggestion: 'すべての必須項目を入力してください。',
  },
  [ErrorCodes.INVALID_URL_FORMAT]: {
    message: 'URL形式が正しくありません。',
    suggestion: '正しいURL（https://...）を入力してください。',
  },
  [ErrorCodes.SCRAPING_FAILED]: {
    message: 'URLの読み込みに失敗しました。',
    suggestion: '『会社概要』『IR情報』『代表メッセージ』などの情報が多いページを指定してください。',
  },
  [ErrorCodes.URL_NOT_ACCESSIBLE]: {
    message: 'URLにアクセスできませんでした。',
    suggestion: 'トップページではなく『会社概要ページ』などの公開されているページを指定してください。',
  },
  [ErrorCodes.CONTENT_NOT_FOUND]: {
    message: '十分な情報が見つかりませんでした。',
    suggestion: 'トップページではなく『会社概要』『代表メッセージ』『IR情報』などのページを指定してください。',
  },
  [ErrorCodes.PDF_PARSE_FAILED]: {
    message: 'PDFの読み込みに失敗しました。',
    suggestion: 'PDFファイルが破損していないか確認してください。または、テキストをコピーして貼り付けてください。',
  },
  [ErrorCodes.PDF_PASSWORD_PROTECTED]: {
    message: 'パスワードで保護されたPDFは読み込めません。',
    suggestion: 'PDFのロックを解除してから再度お試しください。または、テキストをコピーして貼り付けてください。',
  },
  [ErrorCodes.ALL_SOURCES_FAILED]: {
    message: '情報の取得に失敗しました。',
    suggestion: 'トップページではなく『会社概要』『IR情報』『代表メッセージ』などの情報が多いページを指定してください。',
  },
  [ErrorCodes.AI_EXTRACTION_FAILED]: {
    message: 'AI解析に失敗しました。',
    suggestion: 'もう一度お試しいただくか、入力内容を見直してください。',
  },
  [ErrorCodes.AI_GENERATION_FAILED]: {
    message: '手紙の生成に失敗しました。',
    suggestion: 'しばらく待ってから再度お試しください。',
  },
  [ErrorCodes.AI_RESPONSE_INVALID]: {
    message: 'AIの応答形式が正しくありません。',
    suggestion: 'もう一度お試しください。問題が続く場合は管理者にお問い合わせください。',
  },
  [ErrorCodes.INTERNAL_ERROR]: {
    message: 'サーバーエラーが発生しました。',
    suggestion: 'しばらく待ってから再度お試しください。',
  },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    message: 'リクエストが多すぎます。',
    suggestion: 'しばらく待ってから再度お試しください。',
  },
};

/**
 * 構造化されたエラーレスポンスを作成
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  customSuggestion?: string,
  details?: any
): ApiError {
  const defaultError = errorMessages[code];

  return {
    error: true,
    code,
    message: customMessage || defaultError.message,
    suggestion: customSuggestion || defaultError.suggestion,
    ...(details && { details }),
  };
}

/**
 * HTTPステータスコードを取得
 */
export function getHttpStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCodes.INVALID_INPUT:
    case ErrorCodes.MISSING_REQUIRED_FIELD:
    case ErrorCodes.INVALID_URL_FORMAT:
      return 400; // Bad Request

    case ErrorCodes.RATE_LIMIT_EXCEEDED:
      return 429; // Too Many Requests

    case ErrorCodes.SCRAPING_FAILED:
    case ErrorCodes.URL_NOT_ACCESSIBLE:
    case ErrorCodes.CONTENT_NOT_FOUND:
    case ErrorCodes.PDF_PARSE_FAILED:
    case ErrorCodes.PDF_PASSWORD_PROTECTED:
    case ErrorCodes.ALL_SOURCES_FAILED:
    case ErrorCodes.AI_EXTRACTION_FAILED:
    case ErrorCodes.AI_GENERATION_FAILED:
    case ErrorCodes.AI_RESPONSE_INVALID:
    case ErrorCodes.INTERNAL_ERROR:
    default:
      return 500; // Internal Server Error
  }
}
