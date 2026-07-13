-- Migration 005: add Arabic content columns
-- Run in the Supabase SQL editor.

-- topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS name_ar        TEXT;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS description_ar TEXT;

-- questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_ar    TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_a_ar    TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_b_ar    TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_c_ar    TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS option_d_ar    TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_ar TEXT;

-- signs
ALTER TABLE signs ADD COLUMN IF NOT EXISTS name_ar    TEXT;
ALTER TABLE signs ADD COLUMN IF NOT EXISTS meaning_ar TEXT;
