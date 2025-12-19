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

  -- Form inputs stored as JSONB for flexibility
  inputs jsonb not null
);

-- Create index on user_id for faster queries
create index letters_user_id_idx on public.letters(user_id);

-- Create index on created_at for sorting
create index letters_created_at_idx on public.letters(created_at desc);

-- Create index on is_pinned for filtering pinned items
create index letters_is_pinned_idx on public.letters(is_pinned);

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
