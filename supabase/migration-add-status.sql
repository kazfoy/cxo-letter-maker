-- Migration: Add status column to letters table
-- This adds CRM-style status tracking to letters

-- Add status column with check constraint
ALTER TABLE public.letters
ADD COLUMN IF NOT EXISTS status text
CHECK (status IN ('draft', 'generated', 'sent', 'replied', 'meeting_set'))
DEFAULT 'generated' NOT NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS letters_status_idx ON public.letters(status);

-- Update existing records to have 'generated' status
UPDATE public.letters
SET status = 'generated'
WHERE status IS NULL;
