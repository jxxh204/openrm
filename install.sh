#!/usr/bin/env bash
# mrm-agents-public 설치 — 에이전트/스킬을 Claude Code 전역 위치에 복사.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST_A="${CLAUDE_HOME:-$HOME/.claude}/agents"
DEST_S="${CLAUDE_HOME:-$HOME/.claude}/skills"

mkdir -p "$DEST_A" "$DEST_S"

echo "→ 에이전트 → $DEST_A"
cp -v "$HERE"/agents/*.md "$DEST_A"/

echo "→ 스킬 → $DEST_S"
for d in "$HERE"/skills/*/; do
  cp -Rv "$d" "$DEST_S"/
done

echo "✅ 완료. 에이전트 $(ls "$HERE"/agents | wc -l | tr -d ' ')개 · 스킬 $(ls "$HERE"/skills | wc -l | tr -d ' ')개 설치."
echo "   Claude Code 재시작 후 /agents · /skills 로 확인하세요."
