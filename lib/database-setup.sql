-- ============================================================
-- Gyaan Mitra — Supabase Database Setup
-- Run all of these in the Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- NOTE for Himanshu:
-- 1. Go to Supabase Dashboard → Authentication → Providers
-- 2. Make sure "Email" provider is enabled
-- 3. Optionally disable "Confirm email" for faster testing
-- 4. Then run this SQL in the SQL Editor

-- Run this if saved_content table already exists:
-- ALTER TABLE saved_content ADD COLUMN IF NOT EXISTS linked_id uuid;

-- ── Profiles table ──────────────────────────────────────────
-- Stores additional user data beyond what auth.users provides
CREATE TABLE IF NOT EXISTS profiles (
  id uuid references auth.users primary key,
  full_name text,
  email text,
  subscription_tier text default 'free',
  created_at timestamptz default now()
);

-- ── Usage tracking table ─────────────────────────────────────
-- Tracks AI generation usage per user per month
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  feature_used text,        -- 'lesson-plan' | 'worksheet' | 'exam-paper'
  month_year text,          -- e.g. '2026-05'
  created_at timestamptz default now()
);

-- ── Saved content table ──────────────────────────────────────
-- Stores generated content that users choose to save
-- content_type: 'lesson-plan' | 'worksheet' | 'question-paper' | 'answer-key'
-- linked_id: for answer-key records, points to the parent question-paper record
CREATE TABLE IF NOT EXISTS saved_content (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  content_type text,
  title text,
  input_data jsonb,
  output_content text,
  linked_id uuid,
  created_at timestamptz default now()
);

-- Contact form submissions (already in use)
CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid default gen_random_uuid() primary key,
  name text,
  email text,
  message text,
  created_at timestamptz default now()
);

-- ── Enable Row Level Security ────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_content ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage"
  ON usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own content"
  ON saved_content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content"
  ON saved_content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own content"
  ON saved_content FOR DELETE USING (auth.uid() = user_id);

-- ── Auto-create profile on signup ────────────────────────────
-- This function runs automatically when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
