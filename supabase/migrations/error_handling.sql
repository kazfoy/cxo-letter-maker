-- Add error handling columns for batch generation
-- 2025-12-22

-- Add 'error_message' column to store error details when generation fails
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'letters' AND column_name = 'error_message') THEN
        ALTER TABLE public.letters ADD COLUMN error_message text;
    END IF;
END $$;

COMMENT ON COLUMN public.letters.error_message IS 'Error message if generation or save failed';
