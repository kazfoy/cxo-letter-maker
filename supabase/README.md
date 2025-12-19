# Supabase Setup

This directory contains the database schema for the CxO Letter Maker application.

## Setup Instructions

1. Go to your Supabase project dashboard: https://app.supabase.com/project/byecumqbmdwvwaeouhoh

2. Navigate to the SQL Editor

3. Copy and paste the contents of `schema.sql` into the SQL Editor

4. Click "Run" to execute the schema

## What This Creates

- **letters table**: Stores user-generated sales letters with the following fields:
  - `id`: Unique identifier for each letter
  - `user_id`: Reference to the authenticated user
  - `created_at`: Timestamp when the letter was created
  - `updated_at`: Timestamp when the letter was last updated
  - `target_company`: Name of the target company
  - `target_name`: Name of the recipient
  - `content`: The generated letter content
  - `is_pinned`: Whether the letter is pinned
  - `mode`: Letter mode (sales or event)
  - `inputs`: JSONB field storing all form inputs

- **Indexes**: For optimized queries on user_id, created_at, and is_pinned

- **Row Level Security (RLS)**: Ensures users can only access their own letters

- **Policies**: Automatically manage permissions for select, insert, update, and delete operations

- **Trigger**: Automatically updates the `updated_at` timestamp on record updates
