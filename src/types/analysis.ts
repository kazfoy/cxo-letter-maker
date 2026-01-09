/**
 * 分析結果の型定義
 * analyze-input API と generate-v2 API で使用
 */

import { z } from 'zod';

/**
 * 証拠ポイントスキーマ
 */
export const ProofPointSchema = z.object({
  type: z.enum(['numeric', 'case_study', 'news', 'inference']),
  content: z.string().min(1),
  source: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

/**
 * リスクフラグスキーマ
 */
export const RiskFlagSchema = z.object({
  type: z.enum(['missing_info', 'stale_data', 'unverified', 'competitor_mention']),
  message: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
});

/**
 * 経営シグナルスキーマ
 */
export const SignalSchema = z.object({
  type: z.enum(['growth', 'challenge', 'transformation', 'compliance', 'competition']),
  description: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
});

/**
 * ニュースアイテムスキーマ
 */
export const NewsItemSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  date: z.string().optional(),
  source_url: z.string().optional(),
});

/**
 * 不足情報スキーマ
 */
export const MissingInfoSchema = z.object({
  field: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  suggestion: z.string(),
});

/**
 * 仮説スキーマ
 */
export const HypothesesSchema = z.object({
  timing_reason: z.string(),
  challenge_hypothesis: z.string(),
  value_proposition: z.string(),
  cta_suggestion: z.string(),
});

/**
 * ファクトスキーマ
 */
export const FactsSchema = z.object({
  company_name: z.string().optional(),
  person_name: z.string().optional(),
  person_position: z.string().optional(),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  recent_events: z.array(z.string()).optional(),
});

/**
 * 分析結果スキーマ
 */
export const AnalysisResultSchema = z.object({
  facts: FactsSchema,
  signals: z.array(SignalSchema),
  recent_news: z.array(NewsItemSchema),
  proof_points: z.array(ProofPointSchema),
  hypotheses: HypothesesSchema,
  missing_info: z.array(MissingInfoSchema),
  risk_flags: z.array(RiskFlagSchema),
});

// 型エクスポート
export type ProofPoint = z.infer<typeof ProofPointSchema>;
export type RiskFlag = z.infer<typeof RiskFlagSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type MissingInfo = z.infer<typeof MissingInfoSchema>;
export type Hypotheses = z.infer<typeof HypothesesSchema>;
export type Facts = z.infer<typeof FactsSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * analyze-input API のリクエストスキーマ
 */
export const AnalyzeInputRequestSchema = z.object({
  target_url: z.string().url().optional(),
  pdf_text: z.string().max(10000).optional(),
  user_notes: z.string().max(5000).optional(),
  sender_info: z.object({
    company_name: z.string(),
    service_description: z.string(),
  }).optional(),
});

export type AnalyzeInputRequest = z.infer<typeof AnalyzeInputRequestSchema>;

/**
 * analyze-input API のレスポンス型
 */
export interface AnalyzeInputResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
  code?: string;
}
