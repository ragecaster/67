# Terrari67: Handoff

This is a Terraria clone with Gen Z / Gen Alpha brainrot memes. It runs in the browser with plain JS and a canvas, and there's no build step. It's live at https://ragecaster.github.io/67/ (GitHub Pages deploys from `main`, root).
Watch the playtest bot at https://ragecaster.github.io/67/?bot&turbo=4. In the game, F8 toggles the bot and F9 cycles its speed from 1x to 64x.

## Current focus: the playtest bot (`src/bot.js`, `src/botnav.js`, `src/botplan.js`)

The owner asked for a bot that plays through the whole game **using only the same inputs a human uses**: held keys, mouse position, clicks, key presses and inventory UI clicks. It must not teleport or edit the world. The point is to find bugs, and it runs fast via turbo.

### State at the end of the second session
It now plays the early and middle game on its own, in long headless runs (600k+ ticks): wood → valid house (door, bench, chair, walkable doorstep) → furnace/anvil → iron pickaxe → **The 67** (67 damage for 6 gold + 7 silver bars: by far the best early weapon, it cut the death rate from ~25 to ~14 per 600k ticks) → iron armor → gold bow + arrows → aura (life) crystals → gold pickaxe → gold armor, with gear, def 17–19 and 200 life by ~300k ticks. It then hunts lenses at night, crafts and summons the Eye of Ohio at home, and kills it (seen twice in replays from a 600k-tick snapshot, and in `FORCE=taskEye node tests/fightlog.js eyefight`). After the Eye: the Brainrot part (`taskBrainrot`) and the Ohio descent were only exercised in stages, never in one continuous run; the Wall of Brainrot is out of reach (see below). It still dies ~every 40k ticks underground and is flaky: every long run so far found a new stall within a few hundred thousand ticks (each fixed, see below); a stall detector now breaks the remaining ones by brute force.

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
1. **Ohio (the underworld) can't be entered.** The bot reaches the hell layer boundary (`reached Ohio` milestone in stages) but A* treats everything within 2 rows of lava as Infinity, and the top of the underworld is a solid ash/obsidian shelf with lava lakes right under it, so `taskHell` stalls at ~y=605 (x≈1199–1250 on the test seed). Needed: a deliberate "dig down into the underworld" routine (check what is below before the last cell, use the new `bridge` move over lava with blocks, obsidian-skin potion), then hunt Voodoo Ohio Demons (they only spawn while the Guide lives). `taskHell` already has: descend → hunt → `readyForWall()` check → throw the doll (`'t'` key toward lava) but has never completed. Fall back: `cliffAhead` now counts lava as a cliff.
2. **The Wall of Brainrot is out of reach.** 8000 HP, def 12, contact damage 50 along its whole body, eye lasers, advances 1.3–3.9 px/tick, and reaching the world edge kills you. The 67 does ~61 per hit (≈130 hits) but only from inside its contact damage; bows do ~10 per arrow. It needs a real strategy (explosives, a long prepared bridge, molten/demonite gear first) and the Brainrot pickaxe → hellforge → molten gear chain in `wantedCrafts()` has never run.
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
