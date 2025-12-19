-- CxO Letter Maker - Supabase Schema
-- This schema defines the letters table for storing user-generated sales letters

-- Create letters table
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Letter metadata
  target_company text not null,
  target_name text not null,
  content text not null,
  is_pinned boolean default false not null,
  mode text check (mode in ('sales', 'event')) default 'sales' not null,
  status text check (status in ('draft', 'generated', 'sent', 'replied', 'meeting_set')) default 'generated' not null,

  -- Form inputs stored as JSONB for flexibility
  inputs jsonb not null
);

-- Create index on user_id for faster queries
create index letters_user_id_idx on public.letters(user_id);

-- Create index on created_at for sorting
create index letters_created_at_idx on public.letters(created_at desc);

-- Create index on is_pinned for filtering pinned items
create index letters_is_pinned_idx on public.letters(is_pinned);

-- Create index on status for filtering by status
create index letters_status_idx on public.letters(status);

-- Enable Row Level Security
alter table public.letters enable row level security;

-- Create policy: Users can only see their own letters
create policy "Users can view their own letters"
  on public.letters
  for select
  using (auth.uid() = user_id);

-- Create policy: Users can insert their own letters
create policy "Users can insert their own letters"
  on public.letters
  for insert
  with check (auth.uid() = user_id);

-- Create policy: Users can update their own letters
create policy "Users can update their own letters"
  on public.letters
  for update
  using (auth.uid() = user_id);

-- Create policy: Users can delete their own letters
create policy "Users can delete their own letters"
  on public.letters
  for delete
  using (auth.uid() = user_id);

-- Create function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_letters_updated_at
  before update on public.letters
  for each row
  execute function public.update_updated_at_column();

-- ============================================================
-- Profiles Table
-- ============================================================

-- Create profiles table for user settings and default values
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Default sender information
  company_name text,
  user_name text,
  service_description text,
  company_url text,

  -- Additional profile data
  email text
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Create policies for profiles
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Create trigger to automatically update updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

-- Function to create profile automatically on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
