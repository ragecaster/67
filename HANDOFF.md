# Terrari67: Handoff

This is a Terraria clone with Gen Z / Gen Alpha brainrot memes. It runs in the browser with plain JS and a canvas, and there's no build step. It's live at https://ragecaster.github.io/67/ (GitHub Pages deploys from `main`, root).
Watch the playtest bot at https://ragecaster.github.io/67/?bot&turbo=4. In the game, F8 toggles the bot and F9 cycles its speed from 1x to 64x.

## Current focus: the playtest bot (`src/bot.js`, `src/botnav.js`)

The owner asked for a bot that plays through the whole game **using only the same inputs a human uses**: held keys, mouse position, clicks, key presses and inventory UI clicks. It must not teleport or edit the world. The point is to find bugs, and it runs fast via turbo.
Current state: it's **not good enough yet**. The owner's words were "it keeps getting stuck in a cave … this aint it". Continue here first.

### What works
- Chops trees, crafts a Work Bench **by clicking the recipe in the real crafting UI**, places it, then crafts walls, a door and a chair and builds a valid house. The Guide moves in.
- Mines stone and copper ore and crafts a Furnace.
- Fights enemies and gives up on ones it can't reach. Shelters in the house at night while it has no armor. Escapes the Backrooms by walking to the EXIT sign.
- Status banner in the HUD shows its goal and milestones. `Bot.logLines` holds a readable log.

### Architecture
- `Bot.tick()` runs at the start of `G.update()` when `Bot.active`. Every tick it resets inputs, then sets `Input.keys`, `Input.mx/my`, `mDown/mClick/rClick` and `Input.pressed[...]`.
- Priority order inside `tick()`: an in-progress hotbar move (`this.hb`) → close the inventory if it's open → escape the Backrooms → fight the nearest enemy → shelter at night → watchdog → the current task.
- Tasks are objects with `step()` and `done`, made by `taskChop`, `taskBuildHouse`, `taskCraftAtBase`, `taskMine`, `taskPlaceItem`, `taskEquip`, `taskTrash`, `taskEye`, `taskBrainrot`, `taskHell` and `taskExplore`. `nextTask()` is the progression planner.
- UI clicks use real UI geometry: `Bot.slotPos(i)` for inventory slots and `UI.recipeSlots` (filled by `UI.drawCrafting`) for recipe positions. UI clicks set `Bot.wantsDraw` so the turbo loop draws that tick. The immediate-mode UI handles clicks while drawing, so a click only counts if a draw happens.
- The turbo loop is in `G.init`'s frame loop: when `Bot.active`, it runs `Bot.turbo` updates per animation frame.
- **Navigation (`botnav.js`)**: weighted A* with a binary heap. A node is `(x, y)`: the body occupies columns x and x+1 and rows y-2..y. **The player is 20 px wide, so it needs 2-wide tunnels.** That was the original stuck-in-caves bug.
  - Moves: walk, step up, jump up 2–4, drop, dig down, fall, swim and pillar (place blocks under itself). Dig costs come from `Nav.cellCost`: Infinity for lava-adjacent, unbreakable, too-hard, protected (house) and tiles holding up objects.
  - `Bot.moveTo(tx, ty, tol)` plans with a cooldown and caching and returns `true`, `false` or `'fail'`. `followPath()` resyncs to the nearest path node, digs the blocking cells, then walks or jumps.
- Watchdog: if position and inventory size don't change for 2400 ticks, it abandons the task and puts that goal key on cooldown.

### Known bot problems (next steps, roughly in order)
1. **Long-distance returns fail.** When it wanders ~100 tiles away or deep underground, getting back to base often fails. The house task then marches through its plan without building. Ideas: use hierarchical waypoints (plan to an intermediate point every 30–40 tiles); raise `maxNodes` for far goals; remember the tunnel it dug on the way down and follow it back; build a "hellevator" (a 2-wide vertical shaft next to the base) early and always use it.
2. Planning takes ~80–100 ms when the goal is unreachable (mid-air targets use the whole 16k node budget). Validate goals: snap them to a standable node near the target before planning.
3. `taskMine` target choice: prefer targets next to existing caves or air, and blacklist more aggressively.
4. The progression after the furnace (bars → anvil → pickaxes and armor → life crystals → lenses → Eye of Ohio → Brainrot pickaxe → Ohio/hell → voodoo doll → Wall of Brainrot) is written but **barely exercised**. Expect bugs there.
5. Combat is basic. Bosses need kiting and the bot needs potions (it presses H below 45% life).
6. The house builder assumes fairly flat ground. It now clears a doorstep, but it could still level the ground first.

### How to run the bot headless (the fast feedback loop)
```sh
cd tests && npm install && npx playwright install chromium   # once
# assets: the game needs src/assets_data.js (git-ignored). From the repo root:
python3 tools/setup.py        # downloads the Terraria wiki assets (~80 MB incl. music), packs them
cd tests
node botrun.js 60000 bot67 6000   # ticks, world seed, sample interval -> status + bot log each sample, botrun.png at the end
node navtest.js                   # isolated navigation test: random cave starts, try to path home
node navperf.js                   # A* planning time
node t9.js                        # every usable item gets used (catches crashes)
node mp2.js                       # two browsers: host + join, checks tiles/drops/damage/chat/bosses sync
```
Set `CHROME_PATH=/path/to/chrome` if Playwright's bundled browser isn't available. `tests/harness.js` gives you `page.newGame(seed)` and `page.ticks(n)`. It mutes audio and turns off TTS, because the game's TTS "six seven" voice plays through the speakers otherwise.

## Game overview (what already exists)
- **Assets**: Terraria sprites, sounds and music come from the Terraria Wiki (Fandom mirror) and are **not committed**. On GitHub Pages, `src/assets_remote.js` downloads them into the browser and caches them in IndexedDB. It needs `referrerPolicy: 'no-referrer'` because Fandom rejects hotlinks. Locally, `tools/setup.py` builds `src/assets_data.js`. The list is `tools/manifest.txt` → `src/asset_manifest.js`.
- **Core**: `world.js` (tiles, multi-tile objects, trees), `worldgen.js` (terrain, biomes, caves, ores, Ohio/underworld, brainrot chasms, Backrooms Level 0, 67 monuments, noclip glitch block), `physics.js` (collision and liquids), `lighting.js`, `render.js`, `player.js`, `playersprite.js` (real Terraria renders recolored per body part, all 165 hairstyles), `npc.js`, `bosses.js` (King Skibidi, Eye of Ohio, Tung Tung Tung Sahur, Wall of Brainrot), `projectiles.js`, `town.js` (housing, NPC arrivals, shops with a 6.7% Fanum tax), `ui.js`, `menu.js` (Terraria-style character creator), `save.js` (IndexedDB), `net.js` (PeerJS multiplayer: the host is authoritative, room codes).
- **Features added last session**: smart cursor (Ctrl toggles, orange outline) and auto-select (hold Shift); Backrooms Level 0 (the glitch block near spawn noclips you in, Smilers and Partygoers, Almond Water, Liminal Blade, a 60 Hz hum and yellow VHS tint); aura meter → HIM MODE ("YOU ARE LITERALLY HIM RN").
- **Conventions**: classic `<script>` tags with globals (no modules), load order in `index.html`, immediate-mode UI (clicks handled during draw). Input lifecycle: `Input.afterUpdate/restoreForUI/endFrame` in the game loop.

## Owner preferences / context
- Hobby project. The owner wants lots of meme content while keeping the Terraria feel. They like watching the bot on the live site.
- The owner edited the README themselves ("claude lied to u guys lol oops"). Leave their README text alone unless asked.
- Commits go straight to `main` (Pages deploys from it). Don't force-push; pull or rebase first because the owner sometimes edits on GitHub.
