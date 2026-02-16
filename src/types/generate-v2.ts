/**
 * generate-v2 API の型定義
 */

import { z } from 'zod';
import { AnalysisResultSchema } from './analysis';

/**
 * 差出人情報スキーマ
 */
export const SenderInfoSchema = z.object({
  company_name: z.string().min(1),
  department: z.string().optional(),
  name: z.string().min(1),
  service_description: z.string().min(1),
});

/**
 * Event立ち位置の型
 */
export const EventPositionEnum = z.enum(['sponsor', 'speaker', 'case_provider']);
export type EventPosition = z.infer<typeof EventPositionEnum>;

/**
 * ユーザー上書きスキーマ
 */
export const UserOverridesSchema = z.object({
  company_name: z.string().optional(),
  person_name: z.string().optional(),
  person_position: z.string().optional(),
  additional_context: z.string().optional(),
  custom_proof_points: z.array(z.string()).optional(),
  target_url: z.string().optional(),
  // Event専用フィールド
  event_name: z.string().optional(),
  event_datetime: z.string().optional(),
  event_speakers: z.string().optional(),
  event_position: EventPositionEnum.optional(),
  // CxO個人情報・共通接点
  cxo_insight: z.string().optional(),
  mutual_connection: z.string().optional(),
});

/**
 * 生成リクエストスキーマ
 */
export const GenerateV2RequestSchema = z.object({
  analysis_result: AnalysisResultSchema,
  user_overrides: UserOverridesSchema.optional(),
  sender_info: SenderInfoSchema,
  mode: z.enum(['draft', 'complete', 'event']),
  output_format: z.enum(['letter', 'email']),
  is_sample: z.boolean().optional(),
});

/**
 * 根拠スキーマ
 */
export const RationaleSchema = z.object({
  type: z.string(),
  content: z.string(),
});

/**
 * 品質情報スキーマ
 */
export const QualitySchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  passed: z.boolean(),
  issues: z.array(z.string()),
  evaluation_comment: z.string().optional(),
});

/**
 * バリエーションスキーマ
 */
export const VariationsSchema = z.object({
  standard: z.string(),
  emotional: z.string(),
  consultative: z.string(),
});

/**
 * Citation（本文使用箇所）スキーマ
 */
export const CitationSchema = z.object({
  sentence: z.string(),           // 本文の対象文（短く、最大50文字）
  quoteKey: z.string(),           // factsForLetter の quoteKey
  sourceUrl: z.string().optional(),
  sourceTitle: z.string().optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

/**
 * 生成レスポンススキーマ（AI出力用）
 */
export const GenerateV2OutputSchema = z.object({
  subjects: z.array(z.string()).min(1).max(5),
  body: z.string(),
  rationale: z.array(RationaleSchema).min(1).max(3),
  variations: VariationsSchema.optional(),
  citations: z.array(CitationSchema).optional(),  // Phase 6: 本文での引用箇所
});

/**
 * 完全なレスポンススキーマ
 */
export const GenerateV2ResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    subjects: z.array(z.string()),
    body: z.string(),
    rationale: z.array(RationaleSchema),
    quality: QualitySchema,
    variations: VariationsSchema.optional(),
  }).optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});

// 型エクスポート
export type SenderInfo = z.infer<typeof SenderInfoSchema>;
export type UserOverrides = z.infer<typeof UserOverridesSchema>;
export type GenerateV2Request = z.infer<typeof GenerateV2RequestSchema>;
export type Rationale = z.infer<typeof RationaleSchema>;
export type Quality = z.infer<typeof QualitySchema>;
export type Variations = z.infer<typeof VariationsSchema>;
export type GenerateV2Output = z.infer<typeof GenerateV2OutputSchema>;
export type GenerateV2Response = z.infer<typeof GenerateV2ResponseSchema>;

/**
 * Phase 5: 詳細品質スコアスキーマ（5軸分解）
 */
export const DetailedQualityBreakdownSchema = z.object({
  specificity: z.number().min(0).max(20),         // 具体性（ファクト有無）
  empathy: z.number().min(0).max(20),             // 共感性（相手文脈）
  ctaClarity: z.number().min(0).max(20),          // CTAの明確さ
  fiveElementsComplete: z.number().min(0).max(20), // 5要素構造の充足
  noNgExpressions: z.number().min(0).max(20),     // NG表現（過剰・失礼）
});

export const DetailedQualitySchema = z.object({
  total: z.number().min(0).max(100),
  breakdown: DetailedQualityBreakdownSchema,
  suggestions: z.array(z.string()).max(3),
});

export type DetailedQualityBreakdown = z.infer<typeof DetailedQualityBreakdownSchema>;
export type DetailedQuality = z.infer<typeof DetailedQualitySchema>;
