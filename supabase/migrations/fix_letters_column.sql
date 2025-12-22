-- Fix missing columns for Batch Generation
-- 2025-12-22

-- Add 'company_name' (Required for Bulk Gen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'company_name') THEN
        ALTER TABLE public.letters ADD COLUMN company_name text;
    END IF;
END $$;

-- Add 'mode' (sales/event)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'mode') THEN
        ALTER TABLE public.letters ADD COLUMN mode text DEFAULT 'sales';
    END IF;
END $$;

-- Add 'model_name' (To track AI model used)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'model_name') THEN
        ALTER TABLE public.letters ADD COLUMN model_name text;
    END IF;
END $$;

COMMENT ON COLUMN public.letters.company_name IS 'Target company name for the letter';
COMMENT ON COLUMN public.letters.mode IS 'Generation mode: sales or event';
COMMENT ON COLUMN public.letters.model_name IS 'AI Model used for generation';
