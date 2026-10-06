# Terrari67: Handoff

This is a Terraria clone with Gen Z / Gen Alpha brainrot memes. It runs in the browser with plain JS and a canvas, and there's no build step. It's live at https://ragecaster.github.io/67/ (GitHub Pages deploys from `main`, root).
Watch the playtest bot at https://ragecaster.github.io/67/?bot&turbo=4. In the game, F8 toggles the bot and F9 cycles its speed from 1x to 64x.

## Session 8: Terraria spawn rates, fall damage, early-game stalls (read this first)

**Game changes**
- Spawning (`G.spawnLimits` / `G.spawnEnemies` in game.js) now follows Terraria's source (wiki "NPC spawning", 1.4.5): one 1-in-rate roll per tick (it was 4-in-rate). Rate/cap per zone: surface day 600/5, night 360/6, blood moon 108/10 (surface only), underground 300/8, caverns 240/9, underworld 600/10. A thin crowd spawns faster (×0.6..0.9 under 20..80% of the cap). Everything not yet despawned (2400×1600 px) counts toward the cap. In Ohio, with a player killing everything in range, spawns went from 36/min to 8/min (`tests/_spawnbench.js`).
- Fall damage: the rocket boots restart the fall every tick they fire, and the umbrella while it's open (Terraria). A boot-braked 60-tile drop went from 333 damage to 67.

**Bot fixes** (found with `tests/_stuckscan.js`, which flags long underground stretches in a small box and long "N to go" counts that don't move, and dumps a trace with `OUT=`)
- `oreWanted` summed: 39 gold covered The 67 (24) and the crown (28) one at a time, so "no ore wanted", and the expedition's explore wandered the surface for ~140k ticks (evalB, "gold 13 to go"). The 67 now comes at 107k instead of 255k there.
- Ore next to the Backrooms (never mined) no longer counts as seen/known (expedition, its done-check, SDK `near.ores`), and explore targets skip that margin.
- `groundY(x)`: `topSolid` returns −1 for a lake column, and "climb to the surface" planned to row −2, 720 ms of A* every 25 ticks (evalF froze for minutes, at real speed it's a hang).
- Smaller loops: a full chest in a pillar's cell (badTiles now apply to non-solid cells too), an unreachable altar retried every 240 ticks (now goes to `badAltars`), Brainrot offered with a pickaxe that can't mine demonite (task loop).
- The farm clog checks use the game's cap (`G.spawnLimits`), and the Doomscroller hunt looks as far out as the cap counts.

**Measured** (`NEED=4 TRIPS=1 node tests/bosstime.js 400000 <seed> teacher`, evalA–F)

| Code | Boss kills | Deaths | Dolls thrown | Wall |
|---|---|---|---|---|
| main @7ee9ad1 | 16/24 | 89 | 1 (evalF) | lost |
| + spawn rates only | 15/24 | 42 | 1 (evalC) | lost |
| + bot fixes | 17/24 (5 seeds with 3) | 56 | 2 (evalC, evalF) | both lost within ~1,300 ticks of the throw |

- Monster-drop farming is the new bottleneck: lenses, chunks and bones take 2–3× longer (the Eye comes at 230–400k).
- Wall pipeline A/B (`tests/tunnelflow.js`, new `NOARMOR=1` and `PRE=`; the old spawn rules can be swapped in through `G.spawnLimits`): with the new rates the bot lasts about twice as long in Ohio before its first death (2.5–4.2k ticks vs 1.3–2.0k), but 0/12 runs got a doll before dying, and gold armor (def 16) didn't change that. The usual death: hurt on the rope, healing in the tunnel with Imps and Ohio Slimes following it in. Respawn rides down tunnelflow's carved shaft die of falls on evalD/E (same on main; a test-carving artifact or a ride bug, not checked).
- Open: the Wall still needs a different Ohio wait (fight back while healing, or kill the followers before healing) and/or defense (the Wall's def gate is 0 on purpose, see Session 7).

**Later in session 8: the hellbridge and Ohio armor (owner's requests)**
- Game:
  - **The Wall's Horrified/Tongue/despawn now follow Terraria.**
    - Horrified: within 50 tiles above Ohio and 120 tiles of the Wall.
    - The Tongue: grabs a Horrified player who gets 2.5+ tiles behind it or climbs out of the zone, and pulls through blocks at 11 px/tick until the player is in its mouth. Past 187.5 tiles it kills instantly.
    - Despawn: 4 s after everyone near it is dead.
    - World edge: only Horrified players die.
    - Before this, a respawned player was dragged back down (the "teleport" the owner saw, and evalF's 30 deaths in a row).
  - Ohio Demons collide with blocks (Terraria); they used to fly through rock.
- Bot (`taskHell`): the default site is now a **hellbridge** (`findBridge`).
  - The site: an ash island with lava under the doll side and a mostly open runway row on the other side. A 600/520/450 platform runway is laid by `lineStep` with wood platforms. The tunnel plan is the fallback.
  - The `molten` phase runs after the shaft. It mines Ohiostone (only 2+ rows below the feet, never in its own columns) and obsidian from the ceiling slab around the shaft. It plugs lava in reach and the shaft's hole, then goes home for the Ohioforge, bars and set, and wears it. After 8 deaths it skips the armor.
  - The pathfinder never digs through Ohiostone.
  - `shaftDown` drops rung to rung to the last rung over the ceiling.
  - `taskForStep` places a station's own station (the anvil before the Ohioforge).
- Tests:
  - `tests/hellbridge.js` (runway laid, doll thrown): Ohio armor plus a 600 runway won 12/12 (lowest life 245–367 of 400). No armor plus a 600 runway won 6/6. A 360 runway always ran out under the bot.
  - `tests/moltenflow.js` (shaft carved, armor phase from home): evalA made the full set (def 25) by about 59k ticks with 9 deaths. The other seeds died 17–35 times, mostly to lava, Imps and Demons. A gold set (def 16) didn't fix that.
- **Natural runs (`bridge1`, 400k ticks): no doll throw on any seed** (the tunnel plan threw 2).
  - The armor phase is a death loop in the ceiling (evalF: 8 deaths, then gave up).
  - The unarmored runway build is a second death loop (Demons, Imps).
  - **Then (owner):**
    - **Obsidian Rose** ("Ohio Rose"): an accessory that cuts lava contact from 80 to 35 damage and On Fire! from 7 s to 3.5 s. Ohio Imps drop it 1 in 20 (wiki; tested 192/4000).
    - **Ohio Skull:** the bot now crafts one. It mines its 20 obsidian first, stopping on the last rung over row 600 so it stays in the cavern zone, then goes home to the furnace and wears it before mining any Ohiostone. Ohiostone contact burns (20 damage every 20 ticks, logged as "lava") were most of the "lava" deaths. With the skull on, evalA mined 96 Ohiostone without a death.
    - The skull no longer stops On Fire! from Ohio Bat and Ohio Slime hits (Terraria: fire blocks only).
    - **The Ohioforge replaces the furnace** (owner's call): the bot picks up the house's furnace for the recipe, and the forge goes on the furnace's spot (`stationSpot`).
    - Fixes: the shaft is sealed a few rows under the bot while it mines, `H.atStop` keeps the shaft-stop state, deaths count toward the armor cap only below row 540, and a failed obsidian target writes off a whole vein (`badRadius`).
    - More fixes: the miner gathers all of both materials before going home (it used to stop at the first one met), the give-up count resets on progress, and the bot waits to pick up the broken furnace (it used to craft a second one).
    - `tests/moltenflow.js` (stations at home), latest: evalA and evalD made the skull, the Ohioforge (from the furnace) and the full set, at 26 defense with 2 deaths each (83–112k ticks). evalC made the skull, then stalled on Ohiostone (12 deaths). evalF can't reach any obsidian near its shaft (one vein next to lava).
    - Natural runs (`bridge5`, 400k ticks): the Wall prep starts after the nightmare pickaxe (230–350k), so no seed finishes the armor in time. evalC was mining Ohiostone with the skull on, evalD was making the skull, evalF went unarmored. The early game has to get faster for the 324k goal.
  - **Open:** the bot needs to survive Ohio before it has Ohio armor. Options: an Obsidian Skin potion (lava immunity, Terraria's answer; needs blinkroot), a starter armor set before Ohio, better fighting in tunnels (Imps teleport in), or a game change.

## Session 7: priorities, grappling hook, and the Wall pipeline

Goal (still open): all 4 bosses in under 324k ticks. Status on evalA–F with `NEED=4 TRIPS=1 node tests/bosstime.js 330000 <seed> teacher`:
- All six seeds usually kill King, Eye and Tung. The best seed (evalF) has all three by 154k, the Wall tunnel dug by 249k, and the doll thrown at 259–308k.
- No seed has beaten the Wall within 324k. The real fight is lost to the Wall's eye lasers (`passTiles`: they hit through the tunnel rock from spawn), to Ohio's imps and demons following the bot into the tunnel, and to one 50-HP lesser potion per fight (potion sickness lasts 3600 ticks).

**Test infrastructure**
- Headless runs are deterministic: the harness seeds `Math.random` per `newGame` and stops the page's rAF loop (`REALTIME=1` turns it back on). A seed always replays the same way, but a small code change reshuffles whole runs, so judge changes on all 6 seeds.
- `bosstime.js PRE='...'` evaluates setup code for A/B runs.
- Wall fight tests: `tests/tunnelwall.js` with `KNOBS` (ARMOR, SWIFT, POTID, ...), `HOOK=1`, and `FROW=0 PLAT=1 TRENCH=4 POTS=20 LIFE=360`.
- Other new tests: `tests/hookbrake.js` (rungless shaft) and `tests/hooknav.js`.

**What was added this session** (see `git log`)
- Night priorities: underground jobs get finished at night; night bosses get a dusk lead that counts the walk back to the arena, and are never summoned within 7000 ticks of dawn.
- The grappling hook is crafted and used in A* hook moves (with bans on short or missed hooks), and it brakes falls (`hookBrake`) and rescues the bot when it falls toward lava.
- Navigation: the climb back to the surface uses A* weight 1.2, so the bot walks out of caves instead of digging up.
- The inventory cleanup no longer throws away whole stacks of kept items such as bones and lenses.
- `?bot` runs teacher mode by default; `&mode=jev` selects the old, stale model.
- Wall pipeline:
  - The nightmare pickaxe is required, because the tunnel rows are Ohiostone (minPick 65).
  - The tunnel is 400 columns, falling back to 300 when the site is short.
  - The shaft is lined with blocks through caves, and a stuck shaft re-sites the plan.
  - Rope is bought early, the second house is searched for out to 60 tiles, and the elevator is placed near home.
  - Wall prep runs while waiting for night; the life gate is 300 and is checked only after the tunnel is dug.
  - Fight tactics: a 50–100 px gap, widening to 90–150 below 60% life; the bot heals in the tunnel when hurt on the rope, and no longer jumps just because it is on fire.

**Measured** (isolated tunnel fights, 360 life, 20 lesser potions, 7 seeds)

| Setup | Wins | Notes |
|---|---|---|
| Bare | 3/7 | |
| Iron armor | 5/7 | |
| Grappling hook | 6/7 | |
| Swiftness | 7/7 | needs up to 600 columns |
| Iron + swiftness | 7/7 | |
| Iron + hook | 6/7 | |

The real fight is harsher than these tests (Ohio monsters, lasers before the Wall reaches the tunnel).

**Tried and reverted**
- Early nightmare pickaxe as a plan step.
- Sheltering at night before getting The 67.
- A 2-row trench.
- A taller tunnel with laser hops.
- Constant hook dashes.
- Hook hunting as a gate.
- Using Him-mode emotes.
- A retry after losing the Wall at life 200.
- Saved patches, not applied: `tools/jev/patches/wall_fight_experiments.patch` (clear Ohio flyers before the throw, shoot imps first, wait 25 columns in) and `iron_armor_filler.patch` (iron armor in the idle hours, untested).

**Open question for the owner:** may the game be rebalanced? Options: the Merchant sells 100-HP Healing Potions, lasers stop at rock, or potion sickness is shorter. Without a rebalance, the Wall needs a bigger redesign.

## Session 6: the Wall of Brainrot from a tunnel

Goal: all 4 bosses in under 324k ticks. The first three come in at 225–330k on evalA–F (`s6a`), so the Wall still needs a working plan, and the early game needs to get faster.

**The Wall plan** (`taskHell` with `H.tunnel`; `findIsland` now also needs a feasible tunnel):
1. Chop wood and craft about 340 wood platforms (`platforms` phase).
2. Buy rope and potions from the Merchant.
3. Dig the hell elevator shaft, stopping at row hellLayer−1 (599).
4. `digTunnel`: 300 columns from the shaft, heading away from the island's lava side.
   - Body rows 597–599, so the bot's centre stays in the **cavern** spawn zone, not Ohio's.
   - Wood-platform floor on row 600.
   - 4-row open **trench** (601–604) under the floor. The Wall's hitbox never rises above row 600, and The 67's homing shots dive into the floor over solid rock; over the trench they hit. A 6-row trench deals more damage, but 604 is the bot's reach limit.
5. `digChute`: a 3-wide chute from the floor into the void. The rope hangs from the rung at (sx+1, 600+1) down to the island; the bot digs while hanging on it and never free-falls.
6. Hang on the rope about 9 rows under the void's ceiling (`hangRow`) and shoot demons; Voodoo Demon dolls fall into the pickup magnet within about 1,000 ticks.
7. `ropeThrow`: drink a cappuccino (`drinkSpeed`) and throw the doll sideways into the lava. If it lands on the island, the bot picks it up and throws from the island's edge instead.
8. `toTunnel`: climb the rope, jump through the rung, and fight from the tunnel (`wallFight`, 50–100 px gap, level aim).

**Measured** (`tests/tunnelwall.js` carves the tunnel; `tests/tunneldig.js`; `tests/tunnelflow.js` carves shaft+tunnel and runs the late phases):
- Fight with a 6-row trench: wins about 15/16 with gold armour, 300 life, no potions.
- With the 4-row trench, a **speed buff is needed**: gold + Zoomies/cappuccino 8/8, iron + 200 life + Zoomies 4/4, no armour 5/8. Without a buff the late phase is lost, because the Wall outruns 3 px/tick below about 35% of its life. Shadow armour (+15% speed) gets 8/8 but costs 35 rotten chunks.
- A long-range or upward aim, or a tunnel at rows 600–602 or 611–613 (Ohio zone), all lose.
- Digging is limited by pickaxe speed: about 150 ticks per column, so about 45k ticks for the tunnel. The shaft takes about 19k ticks.
- Full flow on bot67 (`helldbg.js`): the shaft and tunnel get dug.
- Latest `tunnelflow` run: the rope throw summoned the Wall and the bot climbed into the tunnel, but it died with the Wall at **252/8000**.

**Open problems:**
- Ohio is deadly while hanging and waiting: Ohio Demons kill in about 1,000 ticks, and lava from killed Ohio Slimes collects on the island.
- After a failed fight, the bot dies again and again until the Wall reaches the world's edge.
- Cappuccinos need to be kept and not trashed. Ballerinas drop them in the cavern zone, which the tunnel dig passes through.
- Overall time: the Wall pipeline is about 70k+ ticks, so it has to run on day 2–3 between boss nights, and the early game needs to get faster.
- With `GIVE=cappuccino` at the start, `helldbg` on bot67 gets stuck building the house (not yet understood; the same build with drawing on works).

## Session 5: the owner's gameplay feedback

The owner watched the bot and asked for player-like play. Here is what each request led to. Everything is committed on local `main` (not pushed).

- **Eye of Ohio arena and dodging** (`eyeDance`, `eyeSim`, `eyeArenaSite`, `arenaTrees`; the arena branch is in `taskBoss`):
  - Before summoning, the bot fells any trees in the way. It then builds a pillar plus a 30-platform strip about 8 tiles over the ground (20+ platforms is accepted if the strip gets cut short).
  - During the fight it replans every 4 ticks: 45 short move/jump plans, each simulated 100 ticks ahead against a copy of the Eye AI. Keep `eyeSim` in step with `bosses.js eye()`.
  - The offline model is `tools/jev/eyesim.py`: 0 dash hits per 1000 ticks, against ~5–10 for plain strafing.
  - Bench (`ARENA=1 REPS=n SEED=… node tests/_bossbench.js eye_of_cthulhu n140`): 18/18 wins on 9 worlds, ~40 damage per fight, 0–2 boss hits. Before: 1/10 wins at 100 life, 100–150 damage.
  - On the arena or perch, small mobs are shot from where the bot stands (`anchored`): chasing them walked it off the edge.
- **Platforms instead of dirt:**
  - Navigation pillars use wood platforms first (`climbSlot`). A platform pillar works as a ladder afterwards.
  - The bot keeps 10 platforms in reserve (`PLATFORM_KEEP`) and about 30 crafted.
  - **Tung's perch stays solid blocks**, because Tung lands on platforms and leaps again.
  - Perch and arena pillars walk to the exact column (tolerance 1 left the bot standing beside it forever).
- **Crystals:** any aura crystal within 40 tiles is taken whatever the plan is, with a one-time re-decision when one comes within 30 tiles.
- **The 67 is best in slot through the Wall.** The Wall gate is now dps 80, there are no arrows unless a bow is the weapon, and no Ohio/hellstone gear is in `PLAN_*` or `JEV_GOALS` (that's why the bot was mining Hellstone in lava). Demonite goes to the Nightmare pickaxe, then Brainrot (shadow) armor while defense is below 16 (`brainrotWants`, `brainrotNeeds`).
  - The chunk farm now hunts Doomscrollers stuck in the chasms; they fill the spawn cap. It's still slow, about 1 chunk per 3k ticks.
- **Inventory:** when the bag is full, the bot shift-click-trashes outgrown gear (`obsolete()`; `tests/trashtest.js`). Game fix: clicking the trash slot with a held item now deletes the old trash item (it used to swap).
- **Wood:** a reflex chops when wood is under 50 by day. `taskChop` plants acorns, which grow a tree instantly, when no tree is within 40 tiles (`tests/acorntest.js`). Acorns are kept (30).
- **Not done:**
  - Ohio descent and lava safety beyond avoiding lava-adjacent ore.
  - The owner's ideas for Ohio: clear room left/right so demons come into the open, dig a drain pocket under hellstone, use platforms over lava.
  - Tung remains the weakest fight (~3/8 first-fight wins at 140 life on the bench, the same as before).
- **Sky arena** (`fightArenaSite`, `skyArena`, `taskAwaitBoss`, `bossWarning`, `toSkyArena`):
  - One per world, kept in `Bot.fightArena`: a 24-platform strip 20 tiles over clear ground, 40–120 tiles from the house.
  - It's reached by a wood-platform ladder that is re-laid wherever a rung is missing; never dirt.
  - A 2-platform apron sits past the ladder top; the far end has a fence.
  - Both the Eye and Tung are fought there:
    - the Eye with the dash planner along the strip;
    - Tung summoned from the strip's middle, because it spawns ~22 tiles to a side and drifts ~5, which puts both spawn points past the ends.
  - Natural spawns: on the game's warnings (Eye: "evil presence", 30 s; Tung: the Sahur call at 25200) the bot heads up and waits in the middle, fighting anything that shows up.
  - Bench: summoned 12/12 (`_bossbench.js`); natural with warning, Eye 4/4 and Tung 3/4 (`tests/skyreturn.js`, `WARN=1`).
  - Gotcha: the nav node is the left column of the 2-wide body (`nodeOf`), while `feet()` is the centre column. Walking 'to column c' must target node c-1, and the last tile is walked by hand.
- **Platform ladders** are sparse (a rung every ~5 rows where it can anchor, `tests/climbtest.js`), and the bot drops through platforms with S (A* drop-through move). Rows supported by platforms reset the vertical-descent limit, and S is released before 18 rows of free fall.
- **Bench caveat:** the bench is not run-to-run deterministic. Compare over several seeds and runs, never a single run.
- **Boss rush, rules, 330k ticks, 6 seeds** (outputs in `tools/jev/data/rush/`):
  - HEAD `b5b`: 11 bosses, 3/3 on 2 seeds (302k, 313k), 2 Eye kills.
  - `s5c`: 11 bosses, 2 seeds (190k, 236k), 4 Eye kills.
  - Final `s5d`: 10 bosses, 2 seeds (233k, 319k), 4 Eye kills.
  - The Eye kill rate doubled and completions come sooner. The overall rate is unchanged within the noise; Tung and slow gold for The 67 are the bottlenecks now.
  - The retrained TerraJev weights from session 4 are still uncommitted and not evaluated.

## Session 4 stop point: the boss rush

**Active goal from the owner:** TerraJev (the learned policy, `TerraJev.mode = 'jev'`, falling back to the rules when its confidence is below 0.3) kills **King Skibidi, the Eye of Ohio and Tung Tung Tung Sahur within 1.5 h of real-time play = 324,000 ticks** (60 ticks/s). The first target was 1 h (216k ticks); the owner relaxed it. One day/night cycle is 86,400 ticks and the game starts at 13,500 ticks into day 0, so the nights fall at 40.5–72.9k, 127–159k, 213–246k and 300–332k. The Eye and Tung can only be summoned at night.

**Where it stands:**
- The scripted rules (`TerraJev.mode='teacher'`) kill all 3 within 330k ticks on **2 of 6 eval seeds** (evalF at 221.7k, evalA at 319.0k; run `u2`) and on 2 of 8 training worlds. King dies on every seed.
- TerraJev was retrained by imitation (pure BC) on 8 teacher rollouts (12.5k decisions, 96% agreement). The weights are **installed in `src/terrajev_weights.js` and `tools/jev/terrajev_act.pt` but not committed**, and **not evaluated yet** (the eval was stopped right after it started). Next step:
  `cd tests && for s in evalA evalB evalC evalD evalE evalF; do node bosstime.js 330000 $s jev ../tools/jev/cand_weights.js > ../tools/jev/data/rush/j1_$s.txt 2>&1 & done`
  The goal is met when TerraJev's `BOSSES 3 ... third=<tick>` comes in under 324000.
- Everything is committed on local `main` and **nothing is pushed** (the owner said to ask before pushing; Pages deploys from `main`). The owner's own commit "lol idk" also lives on `main`.

**Environment (after a reboot, `/tmp` is wiped):**
- `export NODE_PATH=/Users/allison/.npm/_npx/e41f203b7505f1fb/node_modules CHROME_PATH=$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`
- Python: `tools/jev/.venv/bin/python`.
- Local game: `python3 -m http.server 6767` from the repo root, then http://localhost:6767/?bot&turbo=8.
- Scratch outputs live in `tools/jev/data/rush/` (git-ignored).
- The machine has 8 cores; about 12 headless browsers in parallel is the practical limit.

**Tools added this session (all in `tests/` unless noted):**
- `bosstime.js <ticks> <seed> teacher|jev [weights]`: boss kill ticks, ticks per plan step and per on-screen goal, events.
- `jevprofile.js`: on-screen time shares.
- `_bossbench.js <boss> <loadout>`: one boss fight with a fixed loadout. Loadouts: e67, n100, n140, n100p, c100… Tung goes through the real perch task; set `TRACE=<n>` for a per-n-tick trace.
- `_lensbench.js` and `_bonebench.js`: farming rates.
- `jevcollect.js`: `MODE=teacher` records the rules' play for imitation.
- `jeveval.js`: the score now adds up to +20 per boss for killing it early.
- `tools/jev/analyze.py`: where the rollout reward goes, per action kind.
- Debug scripts in `tools/jev/data/rush/` (git-ignored):
  - `dbg_plan.js <ticks> <seed> <every>`: planner state, candidates, cooldowns.
  - `dbg_boss.js <seed> <t0> <t1>`: boss fight trace.
  - `dbg_lens.js`: nearby monsters, lenses and bones.
  - `dbg_fights.js`: per-fight stats.

**What changed (and why):**
- **The 67 was nerfed at the owner's request:** 20 damage with a 20% chance per hit to land exactly 67 (`sixSeven: 0.2`). Use `expectedHit(it, def)` (in `data_items.js`) for any damage estimate; `fixedDamage` is gone.
- **Boss gate (`BOSS_READY`, `bossReady`, botrules.js):** The 67 (weapon dps ≥ 60) plus `effLife()` ≥ 140 for King and the Eye. `effLife` is max life + 12 per potion, up to 4 potions. Defense and armor don't matter and the copper pick is enough. These numbers come from benches: with The 67 and no armor, King kills a 100-life player and 140 life wins; the Eye barely wins at 100. `bossSim` misjudges The 67's piercing shots and is no longer used.
- **`nextBoss()`:**
  - If a summon in hand works right now, use it.
  - At night with The 67: the Eye, then Tung, then King.
  - By day: Tung's bones first, then King. Night bosses with nothing to do by day are hidden from the candidates, and the plan hunts life crystals instead ("more max life (waiting for night)").
- **The plan pursues only The 67 as the boss weapon.** A silver broadsword crafted on the way ate its silver.
- **`teacherPick`:** no hiding at night while ore, crystal, craft or boss work is on the plan (underground spawns don't change at night). It drinks potions during boss fights.
- **Tung (`taskBoss` → `tungPerch` / `climbPerch` / `onPerch` / `tungDance`, bot.js):**
  - The bot pillars 32 tiles up next to wherever it is on the surface, lays an 8-platform wood ledge (projectiles pass through platforms), stands one tile short of the end, and builds a 2-block fence past it so night flyers can't knock it off.
  - Tung's leap can't reach that height. Bench result: Tung dead in about 28 s with 0 damage taken.
  - The stall detector and the hop-on-bump both skip while perched. On the ground, `tungDance` kites as a fallback.
- **The Eye and King are summoned on the surface wherever the bot is**, not at home.
- **Farming (in `taskBoss`):**
  - Surface drops (gel, lenses) are farmed about 90 tiles from town, because town NPCs cut spawns 3×.
  - The spawn cap counts every hostile within 100×62 tiles, including cave monsters far below, and those only despawn 150+ tiles away. So the farm moves 160 tiles when 6+ monsters clog it.
  - Bones: the bot roams the caverns with the digging A*, hunts visible skeletons and undead miners (giving up on one after 900 ticks), and relocates 150 tiles when clogged.
  - Any farm with no drop in 8000 ticks steps aside for 6000 ticks.
- **Other fixes:**
  - Explore heads into the depth band of the ore the plan is missing (`oreWanted`).
  - The explore fallback only counts ores the plan actually needs (it used to mine copper forever).
  - Hand recipes (wood platforms) are crafted in place.
  - Only the best feasible gear tier per slot is offered as a craft candidate (the owner asked to skip obsolete tiers).
  - `bruteForce` (unstick) never swings at stone its pickaxe can't break; in Brainrot pits it pillars out instead.
- **Early game (subagent branch, merged into main):** the house goes up in 2–5k ticks (it used to take up to 200k), stations are inside the house, mining is safer, there are fewer deaths, and smelting is batched.

**Known remaining bottlenecks (biggest first):**
1. Getting The 67 takes 60k–200k ticks on some worlds: 24 gold + 28 silver ore, gold only below the rock layer, and crafting means walking home. Making the resolver gather everything first was tried and reverted (it stalled when the second ore wasn't visible yet).
2. Lens farming at night is slow or variable on some worlds; the bench near a town-less home gets 6 lenses in 5–12k ticks.
3. Fights in general take 25–45% of all ticks (hundreds of short, interrupted fights).
4. Run-to-run variance is large, so always compare on all 6 eval seeds (evalA–F).

**Ideas the owner mentioned:** rush the best gear you can mine and skip intermediate tiers (done for the boss path and the craft menu). The owner also watches the bot live and likes it.

## Current focus: the playtest bot (`src/bot.js`, `src/botnav.js`, `src/botplan.js`)

The owner asked for a bot that plays through the whole game **using only the same inputs a human uses**: held keys, mouse position, clicks, key presses and inventory UI clicks. It must not teleport or edit the world. The point is to find bugs, and it runs fast via turbo.

### State at the end of the second session
It now plays the early and middle game on its own, in long headless runs (600k+ ticks): wood → valid house (door, bench, chair, walkable doorstep) → furnace/anvil → iron pickaxe → **The 67** (67 damage for 6 gold + 7 silver bars: by far the best early weapon, it cut the death rate from ~25 to ~14 per 600k ticks) → iron armor → gold bow + arrows → aura (life) crystals → gold pickaxe → gold armor, with gear, def 17–19 and 200 life by ~300k ticks. It then hunts lenses at night, crafts and summons the Eye of Ohio at home, and kills it. **A single natural run (`node tests/botrun.js 700000 bot67 50000`, ~60 min wall) ended with `eye_of_cthulhu` and `tung_sahur` both defeated** (it picked up the Tung Bat, healing potions and Sahur snacks) and the bot hunting Doomscrollers for the Brainrot pickaxe; 20 deaths in 700k ticks, none of them a stall. After the Eye: the Brainrot pickaxe and the Ohio descent/doll throw (`taskHell`: descend → hunt demons → throw doll; it reached the underworld cavern and threw a doll in `FORCE=taskHell GIVE=guide_voodoo_doll node tests/stage.js hell`) were only exercised in stages, never in one continuous run; the Wall of Brainrot is out of reach (see below). It still dies ~every 40k ticks underground and is flaky: every long run so far found a new stall within a few hundred thousand ticks (each fixed, see below); a stall detector now breaks the remaining ones by brute force.

### What changed in session 2 (root causes found, so they don't come back)
- **House builder** (`taskBuildHouse`): per-step try counter never reset (every second plan step was skipped); the work bench landed on a grass bump and "can't mine a block under an object" froze the clear step; the door gap was built first so nothing could attach above it; a *valid room is not a finished house* (door/bench/chair/doorstep come after) → `Bot.houseFinished`. Stations are no longer placed on the doorstep (footprint check, `onDoorstep`). The doorstep and the ground in front of the door are dug/filled at the end.
- **Stale `UI.mouseOverUI`**: the flag is only refreshed on draw, which turbo skips, so placing/digging silently did nothing. `Bot.tick` resets it.
- **Jump needs a fresh key press** (`Player.jumpHeld`). Holding space after landing never jumps again: use `Bot.jump()`, never `hold(' ')`.
- **Navigation** (`botnav.js`): typed-array A* with a per-plan cell-cost memo (Float64 costs! Float32 rounding broke the stale-entry check), dig-aware heuristic (up costs 6/row, down 2/row; the plain 1.3/row floods every cavern), distance-scaled node budget (up to 300k, doubles after a partial plan), a hierarchical "ascend to open sky at the goal's ground level" stage for far goals deep underground, chained pillars in open air, `leap` over 1–3 tile gaps, fall/vertical-run limits (the game hurts above 25 tiles; stair-step instead of a 50-deep shaft), `Bot.badTiles` and the death-loop `avoidZone` honoured by `cellCost`, replan storms throttled (moving goals replan at most every 25 ticks; same plan repeated >3× backs off). The yard around the house costs +40 per dug tile, the house box is Infinity.
- **Pillar** (`followPath`): place the block as soon as the feet clear the target cell (a held jump rises 6 tiles = out of build reach), in a body column that has something solid below (the game only places a block next to another tile), breaking furniture standing in the cell first.
- **Direct walking is cliff-safe** (`Bot.hold` → `cliffAhead`): the body one tile ahead must have ground within 14 rows. A* moves that intend to leave the ground set `allowDrop`.
- **Progression planner** (`botplan.js`): recipe-driven. `wantSegments()` is the ordered shopping list (stations → iron tier → ammo → crystals → gold tier); `resolve(item, qty)` walks the recipe tree to the first missing thing; `taskForStep` turns it into craft/gather tasks. This replaced the old hard-coded ladder that hoarded 500 copper bars and never finished an armor set. Armor comes before weapons.
- **Mining** (`taskMine`): `tiles` argument targets one ore (iron for iron, gold for gold, demonite for the Brainrot pickaxe); `pickMineTarget` scores candidates by distance + solid cells to dig − vein size; wander targets are kept until reached.
- **Combat**: weapon chosen against the target's defense and reach (a sword can't hit a boss hovering 230 px up), ranged preferred against bosses, no weapon flip-flopping; bows only fire on a fresh click (`autoReuse` is false); aim leads moving targets; boss targeting ignores minions unless one is adjacent; Eye-of-Ohio dash dodging (`dodgeBoss`, side chosen once per charge); flee to the house below ~3 enemy hits of life, rest to ~90% afterwards (resting is nearly free for a turbo bot, dying is not); death-cause logging (`Bot.deathLog`) and death-loop breaker (`registerDeath`).
- Task-loop guard: a task that is already `done` the tick it was created 8× in a row is put on cooldown (this was an infinite 0-tick loop in one run).

### Architecture
- `Bot.tick()` runs at the start of `G.update()` when `Bot.active`. Every tick it resets inputs, then sets `Input.keys`, `Input.mx/my`, `mDown/mClick/rClick` and `Input.pressed[...]`.
- Priority order inside `tick()`: an in-progress hotbar move (`this.hb`) → close the inventory if it's open → escape the Backrooms → fight / flee / rest → shelter at night (not while mining/crafting) → watchdog → the current task.
- Tasks are objects with `step()` and `done`: `taskChop`, `taskBuildHouse`, `taskCraftAtBase`, `taskMine`, `taskPlaceItem`, `taskEquip`, `taskTrash`, `taskBreakAt`, `taskEye`, `taskBrainrot`, `taskHell`, `taskExplore`. `nextTask()` → misc crafts → `progressionTask()` (botplan.js) → Eye → Brainrot → Hell.
- UI clicks use real UI geometry: `Bot.slotPos(i)` and `UI.recipeSlots`. UI clicks set `Bot.wantsDraw` so the turbo loop draws that tick (the immediate-mode UI handles clicks while drawing).
- The turbo loop is in `G.init`'s frame loop: when `Bot.active`, it runs `Bot.turbo` updates per animation frame.
- **Navigation**: a node is `(x, y)`: the body occupies columns x and x+1 and rows y-2..y (**the player is 20 px wide, so it needs 2-wide tunnels**). Moves: walk, up, jump 2–3, drop (≤18), dig down, fall, swim, pillar, leap, bridge (block under the front foot over a gap/lava). `Bot.moveTo(tx, ty, tol)` returns `true`, `false` or `'fail'`; `followPath()` resyncs to the path, digs blockers, walks/jumps.
- Watchdog: no position/inventory change for 2400 ticks → abandon the task, cool its goal key down.

### Known bot problems (next steps, roughly in order)
1. **Ohio + the Wall: designed and mostly working, not yet proven end to end in one natural run.** `taskHell` (src/bot.js) is a phase machine kept in `Bot.hell`: `prep` (≥~380 blocks; `taskTrash` keeps them) → `descend` (A* digs a shaft and drops onto a floating ash *island* found by `findIsland`: ≥6 wide, row ≈ hellLayer+40, lava under the doll-drop side, ≥300 tiles of room on the other side) → `bridge` (`lineStep`: a straight 1-wide block runway, 320 tiles, floor cells placed two ahead) → `wait` (patrol the island edge, kill demons for a doll, throw it off the edge into the lava; needs Guide alive, `readyForWall()` = lifeMax≥200, def≥10, owns The 67). The Wall is then handled by `Bot.wallFight` (hooked at the top of the enemy section of `tick`): stay ahead of its face, fire The 67 (homing 6s/7s, ~220 hp/s), hop eye lasers, retreat along the runway. **Verified**: with a pre-laid runway (`tests/wallrun.js`) the Wall dies in ~2000 ticks (it travels ~280 tiles). **Not verified**: finishing the runway under Ohio's mob soup (demons/bats/imps; ~0.1 life/tick, regen only 0.2/s while being hit). Mitigations in: no fight movement within 5 tiles of an open end (`holdSafe`, `edgeDist`), no hops near edges (`nearEdge`), `hold()` guards in the air, rock-solid brake in the bridge executor, sortie healing (below 50% life it goes home, heals to 92%, returns; ascending is a 450-row pillar, ~5000 ticks). Known hazards: a Voodoo demon dying over lava drops its doll into the lava and summons the Wall prematurely (death unless a runway is behind you; the Wall then chases through respawns until the world edge); a rock tunnel was tried and is a trap (Ohio flyers ignore tiles and projectiles die on rock). Debug tools: `helldbg.js` (full flow, snapshots via CAPTURE/CAPAT/RESTORE), `islandfight.js` (replay a snapshot; GOD/NOMOB/TRACK/RING/FINE), `wallrun.js`, `islands.js`, `navprobe.js`.
2. **Wall follow-ups.** Healing potions (gel+mushroom+bottle) and lifeMax 400 (ladder cap raised to 400) would raise survival a lot; bridging speed is ~17 ticks/tile; shorter runway (~300) is enough.

3. **Deaths.** ~1 per 40k ticks once it has The 67 and armor (skeletons, bats, Ballerina, falls into the Brainrot chasms). Unplanned falls (knockback off a pillar, walking into a pit) are the worst. Ideas: craft healing potions (bottle station + gel + mushrooms), more aura crystals before going deep (the ladder stops at 200 max life, the game allows 400), avoid pillaring in wide open chasms, sleep-in-house nights.
4. **Execution mismatches** keep producing stalls (a jump that is 1 tile off, furniture in the way, a chair in the pillar cell...). Generic defenses now: moves that don't make progress for 300 ticks are banned for 8000 ticks (`Nav.ban`), 3000 ticks without leaving a 3-tile box triggers `bruteForce()` (run, hop, chew through whatever is ahead), same plan repeated → back off, deaths in the same place → `avoidZone`. When a new stall shows up: snapshot it (`until.js` with `SNAP=`), then `goto.js`/`replay.js` it.
5. Tung Tung Sahur spawns at 3 AM on its own once `lifeMax >= 200`; the bot only has generic ranged kiting for it. The Eye fight is still long (≈30k ticks, ~1000 arrows without The 67).
6. Mining trips are long (deep ore, 190-row pillar climbs ≈ 10k ticks) and ore is hoarded when waiting for night (it now waits at the house instead). A hellevator/rope would help.
7. The house builder still assumes fairly flat ground (it levels only by clearing above and filling the floor row).

### Headless tooling (all in `tests/`, deterministic: seeded RNG, draws tied to `G.tick`)
```sh
cd tests && npm install && npx playwright install chromium   # once
# assets: without src/assets_data.js (git-ignored) the harness runs with placeholder sprites (NO_ASSETS mode) – fine for bot work.
# With real assets: python3 tools/setup.py (downloads ~80 MB from the Terraria wiki)
node botrun.js 500000 bot67 50000      # full natural run; samples + DEATHS + last log; SNAPEND=/tmp/x.json saves the final situation
node until.js "<log text>|js:<expr>" 100000 bot67 14   # run until a log line / JS condition, dump ASCII map + plan probes; SNAP=/tmp/x.json, STAGE=eyefight
node replay.js /tmp/x.json 3000 300    # thaw a snapshot and let the bot play on (per-sample goal/position/nav)
node replay2.js / replay3.js           # per-tick trace / map dump after a snapshot
node goto.js /tmp/x.json X Y 3000 2    # thaw + walk to a tile with the real Bot.tick loop (nav debugging)
node homewalk.js                       # scenario: after the house is built, walk home from 6 surface offsets
node navtest.js 6 5 [k]                # random cave starts → walk home (k: trace one start)
node navfar.js / navperf.js            # A* heuristic/budget experiments and timings
node minebench.js IRON 40000 gold      # mining throughput benchmark
node stage.js eyefight 60000 10000     # start from a mid-game inventory (test shortcut only); FORCE=taskEye forces a task
node fightlog.js eyefight 200000       # boss-fight telemetry (START=/STEP= env to zoom in)
node dpstest.js gold_bow eye_of_cthulhu 2400   # controlled DPS test
node speed.js / planlog.js             # ms per 2000 ticks / last A* plans (replan storms show up here)
node t9.js / mp2.js                    # item-use crash test / two-browser multiplayer sync test
```
Set `CHROME_PATH=/path/to/chrome` if Playwright's bundled browser isn't available (the harness also tries `/opt/pw-browsers/chromium-1194`). Never `pkill -f` something whose name appears in your own shell command line (it kills the shell). `tests/harness.js` mutes audio and turns off TTS, because the game's TTS "six seven" voice plays through the speakers otherwise. **Debugging trap:** test drivers that bypass `Bot.tick` (calling `moveTo`/`dig` directly with `G.update`) miss the hotbar/mouseOverUI handling and produce phantom bugs (the "chair can't be broken", "block can't be placed" ones). Drive the bot through `Bot.tick` with a pseudo-task, as `goto.js` does now.

## Game overview (what already exists)
- **Assets**: Terraria sprites, sounds and music come from the Terraria Wiki (Fandom mirror) and are **not committed**. On GitHub Pages, `src/assets_remote.js` downloads them into the browser and caches them in IndexedDB. It needs `referrerPolicy: 'no-referrer'` because Fandom rejects hotlinks. Locally, `tools/setup.py` builds `src/assets_data.js`. The list is `tools/manifest.txt` → `src/asset_manifest.js`.
- **Core**: `world.js` (tiles, multi-tile objects, trees), `worldgen.js` (terrain, biomes, caves, ores, Ohio/underworld, brainrot chasms, Backrooms Level 0, 67 monuments, noclip glitch block), `physics.js` (collision and liquids), `lighting.js`, `render.js`, `player.js`, `playersprite.js` (real Terraria renders recolored per body part, all 165 hairstyles), `npc.js`, `bosses.js` (King Skibidi, Eye of Ohio, Tung Tung Tung Sahur, Wall of Brainrot), `projectiles.js`, `town.js` (housing, NPC arrivals, shops with a 6.7% Fanum tax), `ui.js`, `menu.js` (Terraria-style character creator), `save.js` (IndexedDB), `net.js` (PeerJS multiplayer: the host is authoritative, room codes).
- **Features added last session**: smart cursor (Ctrl toggles, orange outline) and auto-select (hold Shift); Backrooms Level 0 (the glitch block near spawn noclips you in, Smilers and Partygoers, Almond Water, Liminal Blade, a 60 Hz hum and yellow VHS tint); aura meter → HIM MODE ("YOU ARE LITERALLY HIM RN").
- **Conventions**: classic `<script>` tags with globals (no modules), load order in `index.html`, immediate-mode UI (clicks handled during draw). Input lifecycle: `Input.afterUpdate/restoreForUI/endFrame` in the game loop.

## Owner preferences / context
- Hobby project. The owner wants lots of meme content while keeping the Terraria feel. They like watching the bot on the live site.
- The owner edited the README themselves ("claude lied to u guys lol oops"). Leave their README text alone unless asked.
- Commits go straight to `main` (Pages deploys from it). Don't force-push; pull or rebase first because the owner sometimes edits on GitHub.

## Session 3 stop point (read this first)

**Status of the long-term goal (Ohio descent + Wall of Brainrot): NOT achieved in a natural run.** Pushed on `claude/compassionate-bardeen-an4rat`.

What is proven:
- Natural runs reach and defeat the Eye of Ohio and Tung Tung Tung Sahur (earlier session).
- `taskHell` now descends to a floating ash island, lays a straight runway (`lineStep`), waits for a Voodoo doll and throws it (see section above). Each piece works in isolation.
- The Wall fight works: `tests/wallrun.js` (runway written into the world as a TEST shortcut) kills the Wall in ~2000 ticks, bot life 300 -> ~135.

What is not proven / known blockers, most important first:
1. **Finishing the 320-tile runway alive.** Ohio mobs deal ~0.1 life/tick, regen is 0.2/s while being hit. Deaths cost ~10k ticks (descent), ascent is a 450-row pillar (~5k ticks). Sortie healing exists but is untested over a full run.
2. **Premature Wall.** A Voodoo demon killed over the void drops its doll into lava, summoning the Wall with no runway behind you; it then pulls and kills the bot through respawns until it reaches the world edge (~15 deaths, ~20k+ ticks). Ideas: stand on a 3+ wide platform while hunting, keep the doll-hunt for after the runway, pick dolls up, or fight the premature Wall on whatever runway exists.
3. **Last fix not yet verified:** after a death in the `bridge` phase the bot used to try laying the runway from wherever it respawned (stuck 40k ticks in the shaft); now it first goes back to the island. A new run (`node tests/helldbg.js 1500000 10000 > /tmp/log`) was just started and killed at the hard stop, so this is unverified.
4. Potions (gel+mushroom+bottle) and life crystals up to 400 (planner cap raised to 400) would raise survival; not tested.

How to continue: `cd tests; node helldbg.js <ticks> <every>` runs the whole flow (house -> Ohio -> runway), `CAPTURE=1` writes snapshots `/tmp/hell_<phase>.json`, `RESTORE=file` resumes one; `islandfight.js <snapshot>` replays the island with env GOD/NOMOB/TRACK/RING/FINE; `wallrun.js` tests the Wall fight. Run long jobs in the background and poll with short reads (blocking waits looked like a hang to the user).

## Next step idea: a Jev-style decision model for a better bot

Jev (Open-Jev / NanoJev / AgentJev on Hugging Face; I could not fetch them: the sandbox blocks huggingface.co and the clone was denied by the permission classifier) is a typed-decision model: one program state plus a typed question (choice / score / yes-no) in, a calibrated probability distribution out of a single forward pass, nothing generated, so no malformed output. NanoJev (0.6B) already returns action distributions for Maze/Snake/ViZDoom. That matches this bot's shape well:

- Keep the hand-written layers that are reliable: A* nav, executors (dig, pillar, bridge, lineStep), crafting UI clicks. Replace the brittle *if-chains* in `nextTask`, `fight`, `taskHell`, flee/rest with a decision call every 10-30 ticks.
- State summary as text: depth, life/max, nearby enemies (type, distance, dy), floor/edge distances left and right, held item, inventory flags (has doll, blocks), current phase.
- Questions with fixed options, e.g. fight/ranged-hold position/retreat-from-edge/heal-at-home/continue-task; "is it safe to place the next block?" (yes/no); "which of these 4 tasks next?".
- The model returns probabilities; take argmax (or sample with temperature) and let the existing executors do it. Log (state, options, choice, outcome) to build a dataset: death causes, edge falls and premature Wall are exactly the cases where a learned policy should beat the thresholds.
- Training signal: this bot already produces cheap, deterministic rollouts (headless, ~1000 ticks/s, snapshots), so fine-tune on rollouts that survived/succeeded, or use the model only as a critic ("will this sortie end in death?") first.
- Practical first step: define the state/options schema in JS, run the existing rule policy through it and log it (no model yet), then plug a model behind the same interface. Needs the weights locally (`hf download aimeigaoshou/agent-jev`, or NanoJev) and a small Python bridge to the headless browser.
