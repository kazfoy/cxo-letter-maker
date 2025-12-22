-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- 1. View own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- 2. Update own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 3. Insert own profile (required for signup trigger if not handled by function, or direct insert)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Letters Policies
-- 1. View own letters
CREATE POLICY "Users can view own letters" 
ON public.letters FOR SELECT 
USING (auth.uid() = user_id);

-- 2. Insert own letters
CREATE POLICY "Users can insert own letters" 
ON public.letters FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Update own letters
CREATE POLICY "Users can update own letters" 
ON public.letters FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Delete own letters
CREATE POLICY "Users can delete own letters" 
ON public.letters FOR DELETE 
USING (auth.uid() = user_id);
