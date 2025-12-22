-- Create user_assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user_assets', 'user_assets', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'user_assets' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Policy: Allow users to view their own assets
CREATE POLICY "Users can view their own assets"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'user_assets' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Policy: Allow users to delete their own assets
CREATE POLICY "Users can delete their own assets"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'user_assets' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Add reference_docs column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reference_docs jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.reference_docs IS 'List of reference PDF documents (path, name) uploaded by the user';
