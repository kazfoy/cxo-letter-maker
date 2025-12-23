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
