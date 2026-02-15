/**
 * Gemini API 共通ヘルパー
 *
 * getGoogleProvider(): プロバイダーのシングルトン取得
 * generateJson(): JSON出力 + Zodバリデーション付き生成
 * generateWithFallback(): フォールバック付きテキスト生成
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { z } from 'zod';
import { devLog } from './logger';
import { getGeminiApiKey } from './env';

// ─── モデル定数（一元管理） ───
/** デフォルトモデル（テキスト生成・JSON生成共通） */
export const MODEL_DEFAULT = 'gemini-2.5-flash';
/** フォールバックモデル（プライマリ失敗時に使用、コスト削減） */
export const MODEL_FALLBACK = 'gemini-2.0-flash-lite';

// ─── 用途別 temperature 設定 ───
export const TEMPERATURE = {
  /** URL分析・ファクト抽出（再現性重視） */
  analysis: 0.1,
  /** レター生成（多様性） */
  generation: 0.7,
  /** qualityGateスコアリング（完全再現） */
  scoring: 0.0,
} as const;

// Provider type
type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;

// Singleton instance
let googleProvider: GoogleProvider | null = null;

/**
 * Google Generative AI プロバイダーのシングルトン取得
 */
export function getGoogleProvider(): GoogleProvider {
  if (googleProvider) return googleProvider;

  const apiKey = getGeminiApiKey();

  googleProvider = createGoogleGenerativeAI({ apiKey });
  return googleProvider;
}

/**
 * generateJson のオプション
 */
export interface GenerateJsonOptions<T extends z.ZodType> {
  /** 使用するモデル名（デフォルト: MODEL_DEFAULT） */
  modelName?: string;
  /** プロンプト */
  prompt: string;
  /** 出力のZodスキーマ */
  schema: T;
  /** 最大リトライ回数（デフォルト: 1） */
  maxRetries?: number;
  /** 生成温度（0.0-2.0、用途別に TEMPERATURE 定数から指定推奨） */
  temperature?: number;
}

/**
 * JSON文字列をレスポンスから抽出する
 * - ```json ... ``` ブロックを除去
 * - 最初の { から最後の } までを抽出
 */
export function extractJsonFromResponse(text: string): string {
  // Remove markdown code blocks
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // Find the first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || firstBrace > lastBrace) {
    throw new Error('No valid JSON object found in response');
  }

  return cleaned.substring(firstBrace, lastBrace + 1);
}

/**
 * JSON出力 + Zodバリデーション付き生成
 *
 * @example
 * const result = await generateJson({
 *   prompt: 'Generate a user object',
 *   schema: z.object({ name: z.string(), age: z.number() }),
 * });
 */
// ─── リトライ戦略定数 ───
/** API エラー時のリトライ待機ベース（ms） */
const RETRY_DELAY_MS = 2000;

/** リトライ可能な API エラーかどうかを判定 */
function isRetryableApiError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('rate_limit') ||
    msg.includes('timeout') ||
    msg.includes('ECONNRESET') ||
    msg.includes('fetch failed')
  );
}

/** JSON パース / Zod バリデーションエラーかどうかを判定 */
function isParseOrValidationError(error: unknown): boolean {
  if (error instanceof z.ZodError) return true;
  const msg = (error as Error)?.message || '';
  return (
    msg.includes('JSON') ||
    msg.includes('No valid JSON object') ||
    msg.includes('Unexpected token')
  );
}

/**
 * JSON出力 + Zodバリデーション付き生成（リトライ強化版）
 *
 * リトライ戦略:
 * - パース/バリデーションエラー → 即座にリトライ（厳格プロンプト付加）
 * - リトライ可能 API エラー → 指数バックオフ後にリトライ
 * - 最終リトライ → フォールバックモデル（MODEL_FALLBACK）に切り替え
 * - 非リトライ可能エラー → 即座に失敗
 *
 * @example
 * const result = await generateJson({
 *   prompt: 'Generate a user object',
 *   schema: z.object({ name: z.string(), age: z.number() }),
 * });
 */
export async function generateJson<T extends z.ZodType>(
  options: GenerateJsonOptions<T>
): Promise<z.infer<T>> {
  const {
    modelName = MODEL_DEFAULT,
    prompt,
    schema,
    maxRetries = 1,
    temperature,
  } = options;

  const google = getGoogleProvider();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 最終リトライで前回が API エラーなら フォールバックモデルに切り替え
      const useFallback = attempt > 0
        && attempt === maxRetries
        && lastError !== null
        && isRetryableApiError(lastError)
        && modelName !== MODEL_FALLBACK;
      const currentModelName = useFallback ? MODEL_FALLBACK : modelName;
      const model = google(currentModelName);

      if (useFallback) {
        devLog.warn(`[generateJson] Final retry: switching to fallback model (${MODEL_FALLBACK})`);
      }

      // On retry, add stricter instruction
      const finalPrompt = attempt > 0
        ? `${prompt}\n\n【重要】前回の出力に問題がありました。スキーマに厳密に従ったJSON形式で出力してください。余計なテキストは含めないでください。`
        : prompt;

      const result = await generateText({
        model,
        prompt: finalPrompt,
        ...(temperature !== undefined && { temperature }),
      });

      // Extract JSON from response
      const jsonString = extractJsonFromResponse(result.text);

      // Parse JSON
      const parsed = JSON.parse(jsonString);

      // Validate with Zod
      const validated = schema.parse(parsed);

      return validated;

    } catch (error) {
      lastError = error as Error;
      devLog.warn(`[generateJson] Attempt ${attempt + 1} failed (model=${modelName}):`, {
        error: lastError.message,
        responseLength: 'text' in (error as Record<string, unknown>) ? String((error as Record<string, unknown>).text).length : 'N/A',
        promptHead: prompt.substring(0, 120),
      });

      if (attempt >= maxRetries) {
        break;
      }

      // エラー種別に応じたリトライ判定
      const isParse = isParseOrValidationError(error);
      const isApiRetryable = isRetryableApiError(lastError);

      if (!isParse && !isApiRetryable) {
        // 非リトライ可能エラー（認証エラー、不正入力等）→ 即座に失敗
        devLog.warn('[generateJson] Non-retryable error, stopping retries.');
        break;
      }

      // API エラーの場合は指数バックオフ
      if (isApiRetryable) {
        const delay = RETRY_DELAY_MS * (attempt + 1);
        devLog.log(`[generateJson] Retryable API error, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error(`generateJson failed after ${maxRetries + 1} attempts (model=${modelName})`);
}

/**
 * フォールバック付きテキスト生成
 *
 * プライマリモデルで失敗した場合、MODEL_FALLBACK にフォールバック
 */
export async function generateWithFallback(
  prompt: string,
  primaryModelName: string = MODEL_DEFAULT,
  temperature?: number
): Promise<string> {
  const google = getGoogleProvider();
  const primaryModel = google(primaryModelName);
  const fallbackModel = google(MODEL_FALLBACK);

  try {
    const result = await generateText({
      model: primaryModel,
      prompt: prompt,
      ...(temperature !== undefined && { temperature }),
    });
    return result.text;
  } catch (error) {
    devLog.warn(`[generateWithFallback] Primary model ${primaryModelName} failed, trying fallback (${MODEL_FALLBACK})...`, error);

    try {
      const result = await generateText({
        model: fallbackModel,
        prompt: prompt,
        ...(temperature !== undefined && { temperature }),
      });
      return result.text;
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
}

/**
 * AI採点用ヘルパー（100点満点、5軸各20点）
 */
export interface QualityScoreResult {
  total: number;
  axes: {
    specificity: number;      // 具体性
    credibility: number;      // 信頼性
    executivePerspective: number; // 経営視点
    conciseness: number;      // 簡潔性
    cta: number;              // CTA
  };
  comment: string;
}

const QualityScoreSchema = z.object({
  total: z.number().min(0).max(100),
  axes: z.object({
    specificity: z.number().min(0).max(20),
    credibility: z.number().min(0).max(20),
    executivePerspective: z.number().min(0).max(20),
    conciseness: z.number().min(0).max(20),
    cta: z.number().min(0).max(20),
  }),
  comment: z.string(),
});

/**
 * AI採点を実行
 */
export async function scoreLetterWithAI(
  body: string,
  mode: 'draft' | 'complete'
): Promise<QualityScoreResult> {
  const prompt = `あなたはCxO向けセールスレターの品質評価エキスパートです。
以下のレターを5つの軸で採点してください。各軸は0-20点、合計100点満点です。

【採点軸】
1. 具体性 (specificity): 具体的な数値、事例、固有名詞が含まれているか
2. 信頼性 (credibility): 出典が明確な情報に基づいているか
3. 経営視点 (executivePerspective): CxOの関心事（ガバナンス、リスク、競争優位）に言及しているか
4. 簡潔性 (conciseness): 350-500文字で要点がまとまっているか
5. CTA (cta): 軽量で応じやすいCTAになっているか

【モード】${mode === 'draft' ? '下書き（プレースホルダー許容）' : '完成版（プレースホルダー禁止）'}

【レター本文】
${body}

【出力形式】
以下のJSON形式で出力してください：
{
  "total": 合計点,
  "axes": {
    "specificity": 点数,
    "credibility": 点数,
    "executivePerspective": 点数,
    "conciseness": 点数,
    "cta": 点数
  },
  "comment": "改善点や評価コメント（1-2文）"
}`;

  return generateJson({
    prompt,
    schema: QualityScoreSchema,
    maxRetries: 1,
    temperature: TEMPERATURE.scoring,
  });
}
