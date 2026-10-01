#!/bin/sh
# TerraJev self-improvement loop: collect rollouts with the current models (+ exploration) -> train all questions -> repeat.
# usage: tools/jev/loop.sh <rounds> <ticks per world> [first round number]
cd "$(dirname "$0")/../.."
ROUNDS=${1:-4}; TICKS=${2:-200000}; START=${3:-1}
export CHROME_PATH=${CHROME_PATH:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell}
r=$START
while [ $r -lt $((START + ROUNDS)) ]; do
  echo "=== round $r: collecting $(date +%H:%M:%S)"
  for s in $(echo a b c d e f | cut -d" " -f1-${WORLDS:-1}); do
    (cd tests && node jevcollect.js $TICKS r${r}$s 0.15 ../tools/jev/data/r${r}_$s.jsonl 1 > ../tools/jev/data/r${r}_$s.log 2>&1) &
  done
  wait
  grep -h "^t=" tools/jev/data/r${r}_*.log | tail -6
  echo "=== round $r: training $(date +%H:%M:%S)"
  # train on the last 3 rounds (on-policy-ish), resuming the previous networks
  FILES=$(ls tools/jev/data/r*_?.jsonl | awk -F'[r_]' -v r=$r '{ if ($0 ~ /\/r[0-9]+_/) print }' | tail -18)
  tools/jev/.venv/bin/python tools/jev/train_terrajev.py $FILES --resume --epochs 25 2>&1 | grep -v Warning
  r=$((r + 1))
done
echo "=== done $(date +%H:%M:%S)"
