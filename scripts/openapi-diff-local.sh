#!/usr/bin/env bash
# Local helper to run OpenAPI diff between the current branch and a base ref.
# Before first use, run: chmod +x scripts/openapi-diff-local.sh
# Usage: scripts/openapi-diff-local.sh [base-ref]
# Default base ref: main
set -euo pipefail

BASE_REF="${1:-main}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HEAD_SPEC="/tmp/spec-head.yaml"
BASE_SPEC="/tmp/spec-base.yaml"
DIFF_OUT="/tmp/openapi-diff.md"
BREAKING_OUT="/tmp/openapi-breaking.md"

cd "$ROOT"

ORIGINAL_REF="$(git rev-parse --abbrev-ref HEAD)"
if [ "$ORIGINAL_REF" = "HEAD" ]; then
  ORIGINAL_REF="$(git rev-parse HEAD)"
fi

cleanup() {
  if git stash list | grep -q "openapi-diff-local"; then
    git stash pop >/dev/null 2>&1 || true
  fi
  if [ "$(git rev-parse --abbrev-ref HEAD)" != "$ORIGINAL_REF" ]; then
    git checkout "$ORIGINAL_REF" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "[1/5] Generating spec for the current branch ($ORIGINAL_REF)"
npx tsx scripts/export-openapi.ts
cp openapi/spec.yaml "$HEAD_SPEC"

STASHED=0
if [ -n "$(git status --porcelain)" ]; then
  echo "[2/5] Stashing local changes"
  git stash push -u -m "openapi-diff-local" >/dev/null
  STASHED=1
else
  echo "[2/5] No local changes to stash"
fi

echo "[3/5] Checking out base ref ($BASE_REF) and generating base spec"
git fetch origin "$BASE_REF" --depth=1 >/dev/null 2>&1 || true
git checkout "$BASE_REF" >/dev/null
npx tsx scripts/export-openapi.ts
cp openapi/spec.yaml "$BASE_SPEC"

echo "[4/5] Restoring original branch"
git checkout "$ORIGINAL_REF" >/dev/null
if [ "$STASHED" -eq 1 ]; then
  git stash pop >/dev/null 2>&1 || true
fi

echo "[5/5] Running oasdiff in container"
docker run --rm \
  -v /tmp:/specs \
  tufin/oasdiff:latest diff \
  /specs/spec-base.yaml /specs/spec-head.yaml \
  -f markdown > "$DIFF_OUT" || true

set +e
docker run --rm \
  -v /tmp:/specs \
  tufin/oasdiff:latest breaking \
  /specs/spec-base.yaml /specs/spec-head.yaml \
  -f markdown > "$BREAKING_OUT"
BREAKING_EXIT=$?
set -e

echo ""
echo "============================================"
echo "OpenAPI diff summary ($BASE_REF -> $ORIGINAL_REF)"
echo "============================================"
echo ""
if [ -s "$DIFF_OUT" ]; then
  echo "Differences:"
  cat "$DIFF_OUT"
else
  echo "No differences between specs."
fi
echo ""
if [ -s "$BREAKING_OUT" ]; then
  echo "Breaking changes:"
  cat "$BREAKING_OUT"
  echo ""
  echo "To bypass the gate in CI, add [allow-breaking] to the commit message."
else
  echo "No breaking changes detected."
fi

exit "$BREAKING_EXIT"
