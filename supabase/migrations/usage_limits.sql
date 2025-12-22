-- Add daily_usage_count and last_usage_date to profiles table
-- Created: 2025-12-22

-- Add 'daily_usage_count' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'daily_usage_count') THEN
        ALTER TABLE public.profiles ADD COLUMN daily_usage_count integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add 'last_usage_date' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_usage_date') THEN
        ALTER TABLE public.profiles ADD COLUMN last_usage_date date DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Comments
COMMENT ON COLUMN public.profiles.daily_usage_count IS 'Number of generations performed today';
COMMENT ON COLUMN public.profiles.last_usage_date IS 'Date of the last generation usage';
