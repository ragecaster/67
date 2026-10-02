# Terrari67: Handoff

This is a Terraria clone with Gen Z / Gen Alpha brainrot memes. It runs in the browser with plain JS and a canvas, and there's no build step. It's live at https://ragecaster.github.io/67/ (GitHub Pages deploys from `main`, root).
Watch the playtest bot at https://ragecaster.github.io/67/?bot&turbo=4. In the game, F8 toggles the bot and F9 cycles its speed from 1x to 64x.

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

## Session 3b: goal "TerraJev kills all 3 bosses (King, Eye, Tung) within 200k ticks" — NOT met

Baselines measured at 200k ticks (`tests/jeveval.js`): teacher/rules: evalA 1 boss (King @126k), evalB 2 (Tung @139k, King @187k), evalC 0; jev (built-in weights): evalA 0 bosses, score -1 (worse than the rules; it picked from the model 818 times vs 1 teacher fallback). No torch in the sandbox, so `tools/jev/loop.sh` training could not be run.

Where the ticks go (`tests/bosstime.js 200000 evalA teacher`): The 67 only at ~57k (anvil @29k, gold+silver mining after), 140 life ~72k, so most of night 1 (54k–86k) is gone before the bot can fight; bone farming for Tung's Kentongan ate ~50k ticks (7 bones should need ~7 skeleton kills; spawn rate in the cavern is ~1/95 ticks, so the farm/hunt logic is the problem, see `tests/_bonebench.js`); a night was also lost to the Backrooms noclip block. Only two nights fit in 200k (54k–86k, 140k–173k), so Eye and Tung must each get one, King by day.

Next steps: (1) make The 67 (or a cheaper dps≥60 weapon) arrive by ~40k; (2) fix bone/lens farming throughput; (3) avoid the noclip block; (4) then make jev >= teacher (raise `TerraJev.confidence`/fall back to rules until a retrained model beats the incumbent). Wall of Brainrot work is on hold (see the Ohio section: runway ~50/320 tiles after 150k ticks, premature Wall summons).

### Session 3b findings (TerraJev 3-boss goal, still NOT met; best so far 2 bosses on one seed at 200k)
Fixes made (all pushed): bone farm gives up on unreachable skeletons after 700 ticks and farms in the biggest open cavern (`Bot.openCave`; bench `tests/_bonebench.js`, `_bonecave.js`: 0 → 1–7 bones per 30k ticks); house builder breaks furniture standing in a wall/floor block cell (evalC house was stuck 140k ticks, now 7–42k; `_housebench.js`); lens farming counts as night work in `nightBoss` (botrules.js; `_lensbench.js` cannot judge it because it starts without a furnace/anvil so the plan is crafting, not the Eye).
Measured: the Eye fight itself is easy (`_bossbench.js eye_of_cthulhu e67|n140`: WIN in ~17 s taking 67–99 dmg). Teacher 200k results after fixes: evalA 1 boss (King @109–116k), evalB 0, evalC 2 (Tung @131k, King @184k). Eye is summoned only at ~150–157k and then dies/fails in the real surface night fight (zombies and Side-Eyes around). Biggest remaining sinks: The 67 arrives at 57–62k (anvil @29–34k, then gold+silver mining), only two nights fit in 200k (54–86k, 140–173k), bones for Tung still ~25k ticks, night deaths on the surface at 100 life. To hit 3 bosses the whole pipeline has to move ~2x earlier: get The 67 by ~40k, farm lenses+bones in the first night, fight Eye then Tung on night 1, King by day 2.
