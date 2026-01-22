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
  source: z.string().nullish(),
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
  date: z.string().nullish(),
  source_url: z.string().nullish(),
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
  company_name: z.string().nullish(),
  person_name: z.string().nullish(),
  person_position: z.string().nullish(),
  industry: z.string().nullish(),
  company_size: z.string().nullish(),
  recent_events: z.array(z.string()).nullish(),
});

/**
 * 情報ソースカテゴリスキーマ
 * (ExtractedFactItemSchema, SelectedFactSchema より先に定義)
 */
export const SourceCategorySchema = z.enum([
  'corporate',  // 企業情報 (/about, /company)
  'news',       // ニュース (/news, /press)
  'recruit',    // 採用 (/recruit, /careers)
  'ir',         // IR情報
  'product',    // 製品・サービス
  'other'       // その他
]);

export type SourceCategory = z.infer<typeof SourceCategorySchema>;

/**
 * トピックタグスキーマ（ファクト分類用）
 */
export const TopicTagSchema = z.enum([
  'governance',        // ガバナンス・内部統制
  'compliance',        // コンプライアンス
  'supply_chain',      // サプライチェーン
  'finance_ops',       // 財務・経理
  'digital_transformation', // DX
  'sustainability',    // ESG・サステナビリティ
  'global_expansion',  // グローバル展開
  'hr_organization',   // 人事・組織
  'risk_management',   // リスク管理
  'growth_strategy',   // 成長戦略
  'other'
]);

export type TopicTag = z.infer<typeof TopicTagSchema>;

/**
 * 個別ファクトアイテム（sourceUrl付き）
 */
export const ExtractedFactItemSchema = z.object({
  content: z.string(),
  sourceUrl: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceCategory: SourceCategorySchema.optional(),
});

export type ExtractedFactItem = z.infer<typeof ExtractedFactItemSchema>;

/**
 * Phase 5: 抽出ファクトスキーマ（サブルート探索から取得）
 * 後方互換性のため、string | ExtractedFactItem の union を許容
 */
export const ExtractedFactsSchema = z.object({
  numbers: z.array(z.union([z.string(), ExtractedFactItemSchema])),        // 数字（人数、拠点数、年数、売上など）
  properNouns: z.array(z.union([z.string(), ExtractedFactItemSchema])),    // 固有名詞（製品名、拠点名、サービス名）
  recentMoves: z.array(z.union([z.string(), ExtractedFactItemSchema])),    // 最近の動き（提携、新商品等）
  hiringTrends: z.array(z.union([z.string(), ExtractedFactItemSchema])),   // 採用動向
  companyDirection: z.array(z.union([z.string(), ExtractedFactItemSchema])), // 会社の方向性（ビジョン、重点領域）
});

export type ExtractedFacts = z.infer<typeof ExtractedFactsSchema>;

/**
 * 選定ファクトスキーマ（生成に使用するファクト）
 */
export const SelectedFactSchema = z.object({
  content: z.string(),
  category: z.enum(['recentMoves', 'companyDirection', 'numbers', 'hiringTrends', 'properNouns']),
  relevanceScore: z.number().min(0).max(100),
  reason: z.string(),
  quoteKey: z.string(),  // 本文引用チェック用キー
  // Phase 6: ストーリー整合性・鮮度・ソース粒度改善
  topicTags: z.array(TopicTagSchema).default([]),
  bridgeReason: z.string().optional(),  // ファクト→提案テーマへの接続理由
  confidence: z.number().min(0).max(100).default(50),  // ブリッジ信頼度
  publishedAt: z.string().optional(),  // 抽出された日付文字列
  isMidTermPlan: z.boolean().default(false),  // 中期経営計画フラグ
  sourceUrl: z.string().optional(),  // ページ単位の出典URL
  sourceTitle: z.string().optional(),  // 出典ページタイトル
  sourceCategory: SourceCategorySchema.optional(),  // 出典カテゴリ
});

export type SelectedFact = z.infer<typeof SelectedFactSchema>;

/**
 * 情報ソーススキーマ
 */
export const InformationSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  category: SourceCategorySchema,
  isPrimary: z.boolean().default(false),
});

export type InformationSource = z.infer<typeof InformationSourceSchema>;

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
  // Phase 5: 抽出されたファクト（サブルート探索から）
  extracted_facts: ExtractedFactsSchema.optional(),
  // Phase 5: 情報ソース（参照元URL一覧）
  sources: z.array(InformationSourceSchema).optional(),
  // 分析対象のURL
  target_url: z.string().optional(),
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
