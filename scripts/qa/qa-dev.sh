#!/bin/sh
# QA dev server: loads .env.qa into the shell (shell env beats .env.local in
# Next.js, and .env.local points at production) and starts Next on port 3100
# so it never collides with the regular `pnpm dev` on 3000. See qa/SETUP.md.
set -e

cd "$(dirname "$0")/../.."

if [ ! -f .env.qa ]; then
  echo "qa:dev — .env.qa missing. See qa/SETUP.md" >&2
  exit 1
fi

set -a
. ./.env.qa
set +a

if [ "$QA_ENV" != "1" ]; then
  echo "qa:dev — .env.qa must set QA_ENV=1" >&2
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "qa:dev — NEXT_PUBLIC_SUPABASE_URL missing from .env.qa" >&2
  exit 1
fi

PROD_URL=$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' .env.local 2>/dev/null | cut -d= -f2-)
if [ -n "$PROD_URL" ] && [ "$PROD_URL" = "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "qa:dev — refusing to start: .env.qa points at the same Supabase project as .env.local (production)" >&2
  exit 1
fi

exec pnpm exec next dev -p 3100
