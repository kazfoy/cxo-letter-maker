/**
 * URL解決ユーティリティ
 *
 * formDataからtargetUrlを解決するロジックを統一
 */

import type { LetterFormData } from '@/types/letter';

/**
 * テキストから最初のURLを抽出する
 */
export function extractFirstUrl(text?: string): string | undefined {
  if (!text) return undefined;
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlPattern);
  return matches?.[0];
}

/**
 * formDataからtargetUrlを解決する
 * 優先順位:
 * 1. formData.targetUrl（明示的に入力されたURL）
 * 2. formData.eventUrl（イベントモードのイベントURL）
 * 3. extractFirstUrl(formData.freeformInput)（自由入力から抽出）
 */
export function resolveTargetUrl(formData: LetterFormData): string | undefined {
  // 1. 明示的なtargetUrl
  const explicitUrl = formData.targetUrl?.trim();
  if (explicitUrl) return explicitUrl;

  // 2. イベントURL（Eventモード用）
  const eventUrl = formData.eventUrl?.trim();
  if (eventUrl) return eventUrl;

  // 3. freeformInputから抽出
  const extractedUrl = extractFirstUrl(formData.freeformInput);
  if (extractedUrl) return extractedUrl;

  return undefined;
}
