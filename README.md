# TERRARI67

A Terraria clone with Gen Z / Gen Alpha brainrot memes baked in: 6-7, Skibidi Toilets,
Italian brainrot (Tung Tung Tung Sahur, Tralalero Tralala, Bombardiro Crocodilo, Ballerina Cappuccina),
Ohio, Fanum tax, rizz, sigma, mewing, aura, Labubu and Dubai chocolate.

It runs in the browser with plain JS and a canvas. There is no build step.

## Play online (GitHub Pages)

Host the repo with GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
Then anyone can play at `https://<you>.github.io/<repo>/`, and multiplayer works from there too.

The Terraria sprites, sounds and music are **not** in this repo. On a player's first visit, their browser
downloads the sprites and sounds (~5 MB) straight from the Terraria Wiki and caches them. After that it
loads instantly. Music streams from the wiki.

## Play locally / offline (optional)

```sh
git clone <this repo> && cd terraria67
python3 tools/setup.py        # downloads everything incl. music (~80 MB) for offline play; needs python3 + curl
```

## Play

- **Mac/Linux:** `./play.sh` serves the game at http://localhost:6767 and opens it. It runs setup first if the assets are missing.
- **Windows:** double-click `play.bat`.
- Or just open `index.html` in Chrome, Edge or Firefox. Without setup, it downloads the assets from the wiki on first launch.

Click once on the title screen to enable audio. Browsers block sound until you interact.

## Multiplayer

Play with friends over the internet. Nobody runs a server or opens ports.

1. **Host:** Title → **Multiplayer → Host & Play** → pick a character and a world. A **room code** such as `SIGMA4267` shows up on the right side of the screen. Click it to copy it and send it to your friend.
2. **Friend:** Title → **Multiplayer → Join Game** → pick a character → type the code → **Join**. The world downloads in a few seconds.
3. Press **Enter** to chat. Typing "67" in chat does the 6-7.

How it works: like Terraria, the host owns the world. The host runs enemies, bosses, drops, liquids, time and events, and saves the world. Each player owns their own character, which is saved on their own computer and can be taken to other worlds.
Players connect peer-to-peer over WebRTC (PeerJS). The free PeerJS server is only used to find each other.
A few very strict networks (some school or office Wi-Fi) block peer-to-peer connections. If joining hangs at "Connecting...", try a different network or a phone hotspot.

## Controls (Terraria defaults)

| Key | Action |
| --- | --- |
| A / D (or arrows) | Move |
| Space | Jump (hold for higher). Double jump and rocket boots too |
| S | Drop through platforms |
| Mouse left | Use item: mine, chop, swing, shoot, place |
| Mouse right | Interact: doors, chests, beds, talk to NPCs. In inventory: equip or split stacks |
| Esc (or I) | Inventory, crafting and equipment |
| 1–0 / wheel | Hotbar |
| E | Grappling hook (the Rizz Hook) |
| Enter | Chat (multiplayer) |
| M | World map |
| H | Quick heal |
| T | Drop held item |
| + / - | Zoom |
| F5 | Save |
| **6 + 7 together** | **The 6-7.** Gives the "Aura Farming" buff (+6% damage, +7% speed) and makes nearby NPCs join in |

Inventory tips: shift-click moves items to or from an open chest, sells in shops, or trashes otherwise.
Crafted items land on your cursor, as in Terraria.

## Progression (end-to-end)

1. Chop trees and craft a **Work Bench** (10 wood). Build a house with walls, a door, a light, a table and a chair or a Skibidi Toilet. **The Rizzler** (the Guide) moves in. Use the inventory's **Housing?** button to check a room.
2. Mine **Copium → Ironic → Sigma → Rizzium** ore (copper → iron → silver → gold). Smelt the ore at a Furnace and craft gear at an Ironic Anvil.
3. More NPCs arrive as you progress: **Unc** (merchant; needs 50 silver aura), **Nurse Glaze**, **Bombardiro Jr.**, **Sigma Dealer**, **Delulu Dryad**. Every shop price includes a 6.7% Fanum tax.
4. Optional: **King Skibidi**, summoned with the Skibidi Crown (20 gel + 7 Rizzium bars).
5. **Eye of Ohio**: collect 6 lenses from Side-Eyes at night, craft a Suspicious Side-Eye at a Brainrot Altar, then use it at night. It drops **Brainrot Ore**.
6. Get Doomscroll Chunks from Doomscrollers in the purple Brainrot biome. Brainrot Ore plus chunks makes the **Brainrot Pickaxe**, which can mine Ohiostone.
7. **Tung Tung Tung Sahur**: craft the Sahur Kentongan (20 wood + 7 bones) and use it at night. He also shows up on his own at 3 AM. He drops the Tung Bat.
8. Dig down to **Ohio**, the underworld. Mine Ohiostone and smelt Ohio Bars (3 Ohiostone + 1 obsidian) at an **Ohioforge**, found in the ruined Ohio houses. Craft Ohio (molten) gear.
9. Kill a **Voodoo Ohio Demon** to get a Rizzler Voodoo Doll. Throw it into Ohio's lava while the Rizzler is alive.
10. Beat the **Wall of Brainrot** to win. The victory screen appears and the world switches to **Hard Mogged** mode. You can keep playing afterwards.

## Meme highlights

- Hitting an enemy for exactly **67** damage triggers a vine boom, confetti, "SIX SEVEN" and 67 copper aura.
- **The Six Seven** sword (6 Rizzium + 7 Sigma bars) always deals 67 damage and fires 6s and 7s.
- The rare **Six-Seven Slime** (1 in 67 cavern spawns) drops 67 of the glowing 67 Block.
- At 6:07 PM, everybody does the 6-7. A **67 monument** stands in every desert. The world seed `67` builds 67 extra monuments.
- **Skibidi Toilets** hop around at night. **Fanum** (the goblin thief) steals 10% of your aura. **Tralalero Tralala** is a shark in Nike sneakers that also runs on land.
- **Bombardiro Crocodilo** bombs you from the sky. **Ballerina Cappuccina** pirouettes through the caverns. A **Labubu** pet can come from pots, the Dryad or chests.
- Currency is **aura**. Death messages and loading text are full of brainrot, and a fake "stream chat" reacts to your big plays.
- There is an optional TTS "brainrot voice" that says *six seven!* out loud. You can turn it off in Settings.

## Credits

Terraria © Re-Logic. Tile, item, NPC and buff sprites, sound effects and music come from the
[Terraria Wiki](https://terraria.fandom.com). They are **not** included in this repository.
Either the game downloads them into the player's browser on first launch (`src/assets_remote.js`),
or `tools/setup.py` downloads them to your computer and packs them into `src/assets_data.js`, which is git-ignored.
The list of files is in `tools/manifest.txt`. This is a personal, non-commercial fan project.
The meme monsters are drawn procedurally in `src/art.js`.
Multiplayer uses [PeerJS](https://peerjs.com) (MIT, vendored in `vendor/`).

## Code map

`src/worldgen.js` world generation · `src/world.js` tiles and objects · `src/physics.js` collision and liquids ·
`src/lighting.js` colored light · `src/player.js` · `src/npc.js` enemies and AI · `src/bosses.js` ·
`src/projectiles.js` · `src/town.js` housing and shops · `src/ui.js` · `src/menu.js` · `src/game.js` main loop ·
`src/net.js` multiplayer · `src/data_*.js` tiles, items, recipes and meme text.
