"""Zero-shot sanity probes: does NanoJev pick the obvious action in clear-cut Terraria situations?"""
import sys, json
sys.path.insert(0, 'tools/jev')
from jev_server import Engine
e = Engine('mps', 'fp16')
Q = {"action": {"type": "choice", "instructions": "You control the player in a 2D survival game. Pick the best action right now.",
     "criteria": {"fight": "Attack the nearest enemy with the held weapon.",
                  "retreat": "Run away from enemies toward the house.",
                  "heal": "Drink a healing potion to restore life.",
                  "continue": "Ignore enemies and keep doing the current task."}}}
cases = [
  ("obvious heal", "Life 18/200 (very low). Two enemies adjacent. Inventory has 3 healing potions. Weapon: sword.", "heal"),
  ("obvious continue", "Life 200/200. No enemies anywhere nearby. Current task: mining iron ore 2 tiles away.", "continue"),
  ("obvious fight", "Life 190/200. One weak slime 1 tile away attacking you. Weapon: strong sword. Current task: chopping trees.", "fight"),
  ("obvious retreat", "Life 40/200. No healing potions. A boss and five enemies are closing in. House is 10 tiles left.", "retreat"),
  ("no potions low life, enemy far", "Life 50/200. No potions. Enemy 30 tiles away, not approaching. Current task: walking home.", "continue"),
]
ok = 0
for name, state, want in cases:
    r = e.decide(state, Q)["answers"]["action"]
    p = {k: round(v, 2) for k, v in r["probabilities"].items()}
    ok += r["choice"] == want
    print(f"{name:32s} want={want:9s} got={r['choice']:9s} {p}")
print(f"{ok}/{len(cases)} correct")
