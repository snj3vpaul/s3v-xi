#!/usr/bin/env bash
# Run from the root of the s3v-xi repo AFTER copying the RSFC League files in.
# Deletes every tracked file that is not part of RSFC League (the old cricket
# app, Supabase login, tournaments, predictor league), then shows what changed.
set -euo pipefail
NEW_FILES_LIST="${1:-.rsfc-files}"
if [ ! -f "$NEW_FILES_LIST" ]; then
  echo "Missing $NEW_FILES_LIST (it ships in the RSFC League zip)." >&2; exit 1
fi
git ls-files | while read -r f; do
  if ! grep -qxF "$f" "$NEW_FILES_LIST"; then git rm -q -- "$f"; echo "removed  $f"; fi
done
git rm -qf --ignore-unmatch -- "$NEW_FILES_LIST"; rm -f "$NEW_FILES_LIST"
echo "Done. Review with 'git status', then commit."
