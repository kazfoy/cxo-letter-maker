/**
 * Error utility functions for type-safe error handling
 */

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '不明なエラー';
}

/**
 * Get error details for logging
 */
export function getErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
} {
  if (isError(error)) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  return {
    message: String(error),
  };
}

/** エラーの種別（リカバリーアクション選定用） */
export type ErrorKind = 'network' | 'url_not_found' | 'url_blocked' | 'timeout' | 'rate_limit' | 'server' | 'unknown';

export interface UserFriendlyError {
  message: string;
  kind: ErrorKind;
}

/**
 * 技術的エラーメッセージをユーザー向けメッセージに変換
 */
export function getUserFriendlyError(error: unknown, context: 'analysis' | 'generation' = 'generation'): UserFriendlyError {
  const raw = getErrorMessage(error).toLowerCase();

  // ネットワーク/通信エラー
  if (raw.includes('fetch') || raw.includes('network') || raw.includes('econnrefused') || raw.includes('dns')) {
    return {
      message: '通信エラーが発生しました。ネットワーク接続を確認して、もう一度お試しください。',
      kind: 'network',
    };
  }

  // タイムアウト
  if (raw.includes('timeout') || raw.includes('timed out') || raw.includes('aborted')) {
    return {
      message: context === 'analysis'
        ? 'URLの読み込みに時間がかかりすぎました。URLを確認するか、URLなしでお試しください。'
        : '処理に時間がかかりすぎました。もう一度お試しください。',
      kind: 'timeout',
    };
  }

  // 404 / URL not found
  if (raw.includes('404') || raw.includes('not found') || raw.includes('見つかりません')) {
    return {
      message: '指定されたURLのページが見つかりませんでした。URLを確認してください。',
      kind: 'url_not_found',
    };
  }

  // 403 / blocked
  if (raw.includes('403') || raw.includes('forbidden') || raw.includes('blocked') || raw.includes('アクセスが拒否')) {
    return {
      message: 'URLへのアクセスが制限されています。別のURLをお試しください。',
      kind: 'url_blocked',
    };
  }

  // Rate limit (429 is usually handled separately, but as fallback)
  if (raw.includes('429') || raw.includes('rate limit') || raw.includes('too many')) {
    return {
      message: '利用が集中しています。少し時間をおいてからお試しください。',
      kind: 'rate_limit',
    };
  }

  // Server error (5xx)
  if (raw.includes('500') || raw.includes('502') || raw.includes('503') || raw.includes('server') || raw.includes('internal')) {
    return {
      message: 'サーバーで一時的なエラーが発生しました。しばらく待ってからお試しください。',
      kind: 'server',
    };
  }

  // URL facts empty (legacy, should be rare now)
  if (raw.includes('url_facts_empty') || raw.includes('根拠を抽出できません')) {
    return {
      message: 'URLから情報を取得できませんでした。別のURLを試すか、URLなしで生成できます。',
      kind: 'url_not_found',
    };
  }

  // Generic fallback
  return {
    message: context === 'analysis'
      ? '分析中にエラーが発生しました。入力内容を確認して、もう一度お試しください。'
      : '生成中にエラーが発生しました。もう一度お試しください。',
    kind: 'unknown',
  };
}
