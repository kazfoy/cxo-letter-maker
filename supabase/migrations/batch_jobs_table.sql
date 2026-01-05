-- Batch Jobs Table for tracking batch generation status
-- This enables the cancel feature

CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'running', -- running, completed, cancelled, failed
  total_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Function to atomically increment job counts
-- This is safer than select-then-update for concurrent processes
CREATE OR REPLACE FUNCTION public.increment_batch_job_count(job_id uuid, column_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE public.batch_jobs SET %I = %I + 1, updated_at = now() WHERE id = $1', column_name, column_name)
  USING job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own batch jobs
CREATE POLICY "Users can view own batch jobs" ON public.batch_jobs 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own batch jobs" ON public.batch_jobs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch jobs" ON public.batch_jobs 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON public.batch_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON public.batch_jobs(status);

-- Comments
COMMENT ON TABLE public.batch_jobs IS 'Tracks batch generation jobs for progress and cancellation';
COMMENT ON COLUMN public.batch_jobs.status IS 'Job status: running, completed, cancelled, failed';
