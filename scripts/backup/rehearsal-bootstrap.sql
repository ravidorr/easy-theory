-- Minimal stand-ins for the Supabase pieces the migrations rely on.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(job text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
