#!/bin/sh
# TerraJev improvement loop with a promotion gate (one world at a time, laptop-friendly):
#   collect one rollout with the current model (+15% exploration; the scripted teacher covers what the model doesn't know)
#   -> train a candidate on ALL rollouts so far (imitate the teacher + do more of what turned out well), starting from the incumbent
#   -> evaluate the candidate greedily on fixed seeds -> promote it only if it beats the incumbent's score
# usage: tools/jev/loop.sh <rounds> <ticks per rollout> [first round number]
cd "$(dirname "$0")/../.."
ROUNDS=${1:-4}; TICKS=${2:-150000}; START=${3:-1}
EVAL_SEEDS=${EVAL_SEEDS:-"evalA evalB evalC"}; EVAL_TICKS=${EVAL_TICKS:-80000}
export CHROME_PATH=${CHROME_PATH:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell}
D=tools/jev/data; ROOT=$(pwd)

score() { # $1 = teacher|jev, $2 = weights file (optional) -> summed score over the eval seeds
  tot=0
  for s in $EVAL_SEEDS; do
    v=$(cd tests && node jeveval.js $EVAL_TICKS $1 $s $2 2>&1 | tee -a "$ROOT/$D/eval.log" | awk '/^SCORE/ {print $2}')
    tot=$((tot + ${v:-0}))
  done
  echo $tot
}

if [ ! -f $D/incumbent.score ]; then
  if grep -q '"act"' src/terrajev_weights.js; then score jev > $D/incumbent.score; else score teacher > $D/incumbent.score; fi
fi
echo "=== incumbent score $(cat $D/incumbent.score)"
r=$START
while [ $r -lt $((START + ROUNDS)) ]; do
  echo "=== round $r: collecting $(date +%H:%M:%S)"
  (cd tests && node jevcollect.js $TICKS r${r}a 0.15 ../$D/r${r}_a.jsonl 0 > ../$D/r${r}_a.log 2>&1)
  grep -h "^t=" $D/r${r}_a.log | tail -2
  echo "=== round $r: training $(date +%H:%M:%S)"
  tools/jev/.venv/bin/python tools/jev/train_terrajev.py $D/r*_a.jsonl --resume --pt tools/jev/cand_act.pt --out tools/jev/cand_weights.js 2>&1 | grep -v Warning
  if grep -q '"act"' tools/jev/cand_weights.js; then
    cs=$(score jev "$ROOT/tools/jev/cand_weights.js"); inc=$(cat $D/incumbent.score)
    if [ "$cs" -gt "$inc" ]; then
      cp tools/jev/cand_weights.js src/terrajev_weights.js; cp tools/jev/cand_act.pt tools/jev/terrajev_act.pt; echo $cs > $D/incumbent.score
      echo "=== round $r: PROMOTED candidate ($cs > $inc)"
    else
      echo "=== round $r: kept incumbent (candidate $cs <= $inc)"
    fi
  fi
  r=$((r + 1))
done
echo "=== done $(date +%H:%M:%S)"
