#!/bin/sh
# Publish a QA run dir to the orphan `qa-evidence` branch so screenshots and
# reports are linkable from GitHub issues (public repo → raw URLs render
# inline). Uses a temporary worktree so the main working tree is untouched.
# Usage: pnpm qa:publish-evidence qa/runs/<run-id>
set -e

cd "$(dirname "$0")/../.."

BRANCH=qa-evidence
RUN_DIR=$1

if [ -z "$RUN_DIR" ] || [ ! -d "$RUN_DIR" ]; then
  echo "qa:publish-evidence — usage: pnpm qa:publish-evidence qa/runs/<run-id> (dir must exist)" >&2
  exit 1
fi

for f in report.md findings.json; do
  if [ ! -f "$RUN_DIR/$f" ]; then
    echo "qa:publish-evidence — $RUN_DIR/$f missing; run the validator first" >&2
    exit 1
  fi
done

RUN_ID=$(basename "$RUN_DIR")
SLUG=$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
WT=$(mktemp -d)/wt

cleanup() {
  git worktree remove --force "$WT" 2>/dev/null || true
}
trap cleanup EXIT

git fetch origin "$BRANCH" 2>/dev/null || true

if git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
  git worktree add -B "$BRANCH" "$WT" "origin/$BRANCH" --quiet
else
  # First publish: create the orphan branch (no shared history with main).
  # Drop any local leftover from a failed earlier attempt — worktree remove
  # keeps the branch, and checkout --orphan dies on an existing one.
  git branch -D "$BRANCH" 2>/dev/null || true
  git worktree add --detach "$WT" --quiet
  git -C "$WT" checkout --orphan "$BRANCH" --quiet
  git -C "$WT" rm -rf --quiet . 2>/dev/null || true
fi

mkdir -p "$WT/$RUN_ID"
cp -R "$RUN_DIR"/. "$WT/$RUN_ID/"

git -C "$WT" add -A
if git -C "$WT" diff --cached --quiet; then
  echo "qa:publish-evidence — nothing new to publish for $RUN_ID" >&2
else
  git -C "$WT" commit --quiet -m "qa: publish run $RUN_ID"
  git -C "$WT" push --quiet origin "$BRANCH"
fi

echo "https://raw.githubusercontent.com/$SLUG/$BRANCH/$RUN_ID/"
