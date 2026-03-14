-- Phase 2: Team Tables Migration
-- 2026-03-14

-- =============================================================================
-- 1. teams テーブル
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'team',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    max_seats INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON public.teams(owner_id);

COMMENT ON TABLE public.teams IS 'チーム管理テーブル';
COMMENT ON COLUMN public.teams.plan IS 'チームプラン (team, business)';
COMMENT ON COLUMN public.teams.max_seats IS 'チームの最大席数';

-- =============================================================================
-- 2. team_members テーブル
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

COMMENT ON TABLE public.team_members IS 'チームメンバー管理テーブル';

-- =============================================================================
-- 3. team_invitations テーブル
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON public.team_invitations(team_id);

COMMENT ON TABLE public.team_invitations IS 'チーム招待管理テーブル';

-- =============================================================================
-- 4. shared_templates テーブル
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.shared_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sender_info JSONB NOT NULL DEFAULT '{}',
    template_config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_templates_team_id ON public.shared_templates(team_id);

COMMENT ON TABLE public.shared_templates IS 'チーム共有テンプレート';

-- =============================================================================
-- 5. profiles に team_id カラム追加
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'team_id') THEN
        ALTER TABLE public.profiles ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.team_id IS 'ユーザーが所属するチームID';

-- =============================================================================
-- 6. updated_at 自動更新トリガー
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'teams_updated_at') THEN
        CREATE TRIGGER teams_updated_at
            BEFORE UPDATE ON public.teams
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'shared_templates_updated_at') THEN
        CREATE TRIGGER shared_templates_updated_at
            BEFORE UPDATE ON public.shared_templates
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- =============================================================================
-- 7. RLS ポリシー
-- =============================================================================

-- teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_can_view_team"
    ON public.teams FOR SELECT
    USING (
        id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    );

CREATE POLICY "owner_can_update_team"
    ON public.teams FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "authenticated_can_create_team"
    ON public.teams FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_can_view_members"
    ON public.team_members FOR SELECT
    USING (
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    );

CREATE POLICY "admin_can_manage_members"
    ON public.team_members FOR ALL
    USING (
        team_id IN (
            SELECT team_id FROM public.team_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- team_invitations
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_can_manage_invitations"
    ON public.team_invitations FOR ALL
    USING (
        team_id IN (
            SELECT team_id FROM public.team_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "invited_user_can_view_invitation"
    ON public.team_invitations FOR SELECT
    USING (true);  -- トークンベースの認証のため、SELECT は公開

-- shared_templates
ALTER TABLE public.shared_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_can_view_templates"
    ON public.shared_templates FOR SELECT
    USING (
        team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
    );

CREATE POLICY "creator_or_admin_can_manage_templates"
    ON public.shared_templates FOR ALL
    USING (
        created_by = auth.uid()
        OR team_id IN (
            SELECT team_id FROM public.team_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
