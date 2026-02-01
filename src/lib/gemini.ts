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

// ─── モデル定数（一元管理） ───
/** デフォルトモデル（テキスト生成・JSON生成共通） */
export const MODEL_DEFAULT = 'gemini-2.5-flash';
/** フォールバックモデル（プライマリ失敗時に使用） */
export const MODEL_FALLBACK = 'gemini-2.5-flash';

// Provider type
type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;

// Singleton instance
let googleProvider: GoogleProvider | null = null;

/**
 * Google Generative AI プロバイダーのシングルトン取得
 */
export function getGoogleProvider(): GoogleProvider {
  if (googleProvider) return googleProvider;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[CRITICAL ERROR] APIキーが設定されていません！.envファイルを確認してください。');
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set!');
  }

  googleProvider = createGoogleGenerativeAI({
    apiKey: apiKey,
  });
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
export async function generateJson<T extends z.ZodType>(
  options: GenerateJsonOptions<T>
): Promise<z.infer<T>> {
  const {
    modelName = MODEL_DEFAULT,
    prompt,
    schema,
    maxRetries = 1
  } = options;

  const google = getGoogleProvider();
  const model = google(modelName);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // On retry, add stricter instruction
      const finalPrompt = attempt > 0
        ? `${prompt}\n\n【重要】前回の出力に問題がありました。スキーマに厳密に従ったJSON形式で出力してください。余計なテキストは含めないでください。`
        : prompt;

      const result = await generateText({
        model,
        prompt: finalPrompt,
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
  primaryModelName: string = MODEL_DEFAULT
): Promise<string> {
  const google = getGoogleProvider();
  const primaryModel = google(primaryModelName);
  const fallbackModel = google(MODEL_FALLBACK);

  try {
    const result = await generateText({
      model: primaryModel,
      prompt: prompt,
    });
    return result.text;
  } catch (error) {
    devLog.warn(`[generateWithFallback] Primary model ${primaryModelName} failed, trying fallback (${MODEL_FALLBACK})...`, error);

    try {
      const result = await generateText({
        model: fallbackModel,
        prompt: prompt,
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
  });
}
