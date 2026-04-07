#!/usr/bin/env bash
# When `supabase db push` fails with "relation already exists", the remote database
# was created outside the migration tracker (manual SQL / Dashboard). This script
# marks each migration in supabase/migrations/ as *already applied* without running it,
# so future `db push` only runs *new* files.
#
# Run ONLY after your remote schema matches what those migrations would create, OR
# after you have applied any missing deltas manually (e.g. paste
# supabase/migrations/20260421000000_repair_cache_and_saved_headlines.sql in SQL Editor).
#
# Usage: from repo root, `./scripts/supabase-mark-migrations-applied.sh`
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

shopt -s nullglob
files=(supabase/migrations/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migrations found under supabase/migrations/"
  exit 1
fi

IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | sort))
for f in "${sorted[@]}"; do
  base=$(basename "$f" .sql)
  ver="${base%%_*}"
  if [[ ! "$ver" =~ ^[0-9]{14}$ ]]; then
    echo "Skip (unexpected name): $f"
    continue
  fi
  echo "supabase migration repair $ver --status applied"
  supabase migration repair "$ver" --status applied
done

echo "Done. Run: supabase db push  (should report nothing pending if versions match)."
