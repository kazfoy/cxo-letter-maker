/**
 * セキュアロギングユーティリティ
 * 本番環境では機密情報をログに出力しない
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/** ログ引数として許容する型 */
type LogArg = string | number | boolean | null | undefined | unknown;

/** マスク対象となるオブジェクト型 */
type MaskableObject = Record<string, unknown>;

/**
 * メールアドレスをマスクする
 * 例: test@example.com -> t***@e***.com
 */
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';

  const [local, domain] = parts;
  const maskedLocal = local.length > 1 ? `${local[0]}***` : '***';
  const maskedDomain = domain.length > 1 ? `${domain[0]}***.${domain.split('.').pop()}` : '***';

  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * ユーザーIDをマスクする
 * 例: 123e4567-e89b-12d3-a456-426614174000 -> 123e****-****-****-****-********4000
 */
function maskUserId(userId: string): string {
  if (userId.length < 8) return '***';
  return `${userId.substring(0, 4)}****-****-****-****-********${userId.substring(userId.length - 4)}`;
}

/**
 * オブジェクトから機密情報をマスクする
 */
function maskSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  // 配列の場合は各要素を再帰的にマスク
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  const masked: MaskableObject = { ...(data as MaskableObject) };
  const sensitiveKeys = ['password', 'token', 'apiKey', 'api_key', 'secret', 'credentials', 'user_metadata', 'app_metadata'];

  for (const key in masked) {
    const value = masked[key];
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      masked[key] = '***REDACTED***';
    } else if (key === 'email' && typeof value === 'string') {
      masked[key] = maskEmail(value);
    } else if (key === 'id' && typeof value === 'string' && value.includes('-')) {
      masked[key] = maskUserId(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    }
  }

  return masked;
}

/**
 * 開発環境でのみログを出力
 */
export const logger = {
  log: (...args: LogArg[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  error: (...args: LogArg[]) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // 本番環境ではエラーメッセージのみ出力（スタックトレースは除外）
      const sanitized = args.map(arg => {
        if (arg instanceof Error) {
          return `Error: ${arg.message}`;
        }
        if (typeof arg === 'object') {
          return maskSensitiveData(arg);
        }
        return arg;
      });
      console.error(...sanitized);
    }
  },

  warn: (...args: LogArg[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * 機密情報をマスクしてログ出力
   */
  logSecure: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.log(message, data);
    } else {
      if (data) {
        console.log(message, maskSensitiveData(data));
      } else {
        console.log(message);
      }
    }
  },

  /**
   * エラーを安全にログ出力
   */
  errorSecure: (message: string, error?: unknown) => {
    if (isDevelopment) {
      console.error(message, error);
    } else {
      if (error instanceof Error) {
        console.error(message, `Error: ${error.message}`);
      } else if (error) {
        console.error(message, maskSensitiveData(error));
      } else {
        console.error(message);
      }
    }
  },
};

/**
 * API開発用ログ（本番環境では出力しない）
 */
export const devLog = {
  log: (...args: LogArg[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: LogArg[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  warn: (...args: LogArg[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
};
