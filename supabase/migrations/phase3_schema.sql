-- Phase 3 Schema Extension: Plans & Batch Generation
-- 2025-12-21

-- 1. Extend profiles table for Plan Management
-- Add 'plan' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan') THEN
        ALTER TABLE public.profiles ADD COLUMN plan text NOT NULL DEFAULT 'free';
    END IF;
END $$;

-- Add 'usage_limit_daily' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'usage_limit_daily') THEN
        ALTER TABLE public.profiles ADD COLUMN usage_limit_daily integer NOT NULL DEFAULT 5;
    END IF;
END $$;


-- 2. Extend letters table for Batch Generation & Variations
-- Add 'batch_id' column for grouping CSV batch generation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'batch_id') THEN
        ALTER TABLE public.letters ADD COLUMN batch_id uuid;
        -- Create index for faster lookup by batch_id
        CREATE INDEX IF NOT EXISTS idx_letters_batch_id ON public.letters(batch_id);
    END IF;
END $$;

-- Add 'variations' column for storing multiple AI generation options
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'variations') THEN
        ALTER TABLE public.letters ADD COLUMN variations jsonb;
    END IF;
END $$;

-- Add 'source_urls' column for storing reference URLs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'source_urls') THEN
        ALTER TABLE public.letters ADD COLUMN source_urls text[];
    END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.plan IS 'User subscription plan (free, pro, etc.)';
COMMENT ON COLUMN public.profiles.usage_limit_daily IS 'Daily generation limit for the user';
COMMENT ON COLUMN public.letters.batch_id IS 'ID to group letters generated in a single batch (e.g. from CSV)';
COMMENT ON COLUMN public.letters.variations IS 'JSONB array storing multiple variations of the generated content';
COMMENT ON COLUMN public.letters.source_urls IS 'Array of URLs used as source material for the letter';

-- 3. Additional Extensions (Requested on 2025-12-22)
-- Add 'stripe_customer_id' to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;
    END IF;
END $$;

-- Add 'subscription_status' to profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_status text;
    END IF;
END $$;

-- Add 'email_content' to letters
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'email_content') THEN
        ALTER TABLE public.letters ADD COLUMN email_content jsonb;
    END IF;
END $$;

-- Comments for new columns
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe Customer ID for payment processing';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Current subscription status (active, canceled, past_due, etc.)';
COMMENT ON COLUMN public.letters.email_content IS 'Structured email content (subject, body, etc.) generated for the letter';
