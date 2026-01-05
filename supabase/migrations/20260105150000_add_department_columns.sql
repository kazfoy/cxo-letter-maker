-- Add department columns to letters table
ALTER TABLE letters ADD COLUMN IF NOT EXISTS sender_department TEXT;
ALTER TABLE letters ADD COLUMN IF NOT EXISTS recipient_department TEXT;

-- Create sender_infos table if it doesn't exist (as requested by user)
-- Assuming it links to a user (profile)
CREATE TABLE IF NOT EXISTS sender_infos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    company_name TEXT,
    department TEXT, -- New column
    position TEXT,
    name TEXT,
    service_description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- If table already existed but missing department, add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sender_infos' AND column_name = 'department') THEN
        ALTER TABLE sender_infos ADD COLUMN department TEXT;
    END IF;
END $$;

-- Enable RLS for sender_infos
ALTER TABLE sender_infos ENABLE ROW LEVEL SECURITY;

-- Policy for sender_infos (view own)
DROP POLICY IF EXISTS "Users can view own sender_infos" ON sender_infos;
CREATE POLICY "Users can view own sender_infos" ON sender_infos
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for sender_infos (insert own)
DROP POLICY IF EXISTS "Users can insert own sender_infos" ON sender_infos;
CREATE POLICY "Users can insert own sender_infos" ON sender_infos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for sender_infos (update own)
DROP POLICY IF EXISTS "Users can update own sender_infos" ON sender_infos;
CREATE POLICY "Users can update own sender_infos" ON sender_infos
    FOR UPDATE USING (auth.uid() = user_id);

-- Also add department to profiles specifically to support the current "default" behavior logic if needed (optional but good for consistency if we move to sender_infos later)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
