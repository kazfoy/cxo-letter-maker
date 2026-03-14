/**
 * Supabase テーブル型拡張
 *
 * supabase gen types が使えない環境でも型安全にアクセスするための定義
 * url_analysis_cache テーブル等、自動生成に含まれないテーブルの型を定義
 */

export interface UrlAnalysisCacheRow {
  url_hash: string;
  url: string;
  data: unknown;
  expires_at: string;
  created_at?: string;
}

/**
 * 型安全なSupabaseクエリのためのヘルパー
 * from('url_analysis_cache') の戻り値を正しく型付けする
 */
export interface UrlAnalysisCacheTable {
  Row: UrlAnalysisCacheRow;
  Insert: UrlAnalysisCacheRow;
  Update: Partial<UrlAnalysisCacheRow>;
}

// =============================================================================
// Team関連テーブル型定義
// =============================================================================

export interface TeamRow {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  max_seats: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface TeamInvitationRow {
  id: string;
  team_id: string;
  email: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired';
  token: string;
  expires_at: string;
  created_at: string;
}

export interface SharedTemplateRow {
  id: string;
  team_id: string;
  created_by: string;
  name: string;
  sender_info: Record<string, unknown>;
  template_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
