/**
 * セキュアロギングユーティリティ
 * 本番環境では機密情報をログに出力しない
 */

const isDevelopment = process.env.NODE_ENV === 'development';

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
function maskSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const masked = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['password', 'token', 'apiKey', 'api_key', 'secret', 'credentials', 'user_metadata', 'app_metadata'];

  for (const key in masked) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      masked[key] = '***REDACTED***';
    } else if (key === 'email' && typeof masked[key] === 'string') {
      masked[key] = maskEmail(masked[key]);
    } else if (key === 'id' && typeof masked[key] === 'string' && masked[key].includes('-')) {
      masked[key] = maskUserId(masked[key]);
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

/**
 * 開発環境でのみログを出力
 */
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  error: (...args: any[]) => {
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

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * 機密情報をマスクしてログ出力
   */
  logSecure: (message: string, data?: any) => {
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
  errorSecure: (message: string, error?: any) => {
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
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
};
