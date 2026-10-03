// ---------- housing, town NPC arrival, shops ----------
const FANUM_TAX = 1.067;

// Terraria-like room check: flood fill air from (x,y); must be enclosed, fully backed by player-placed walls,
// and contain a light source, a table-like surface, a chair and a door (or platform) in its boundary.
function checkRoom(world, sx, sy) {
  const seen = new Set();
  const stack = [[sx, sy]];
  let light = false, table = false, chair = false, door = false, count = 0;
  const bound = [];
  while (stack.length) {
    const [x, y] = stack.pop();
    const key = y * world.w + x;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!world.inb(x, y)) return { ok: false, reason: 'This is not a valid house (not enclosed).' };
    const t = world.tile(x, y), td = TILES[t];
    const isBoundary = (td && td.solid) || t === T.PLATFORM || (td && td.door);
    if (isBoundary) {
      if ((td && td.door) || t === T.PLATFORM) door = true;
      continue;
    }
    count++;
    if (count > 750) return { ok: false, reason: 'This room is too big. (Unc does not need a mansion.)' };
    const wd = WALLS[world.wall(x, y)];
    if (!wd || wd.natural) return { ok: false, reason: 'This house is missing a wall. (Placed walls only!)' };
    if (td) { if (td.housingLight || td.light) light = true; if (td.table) table = true; if (td.chair) chair = true; }
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  if (count < 30) return { ok: false, reason: 'This house is too small. It is giving closet.' };
  if (!light) return { ok: false, reason: 'This house needs a light source.' };
  if (!table) return { ok: false, reason: 'This house needs a table or work bench.' };
  if (!chair) return { ok: false, reason: 'This house needs a chair (a Skibidi Toilet counts).' };
  if (!door) return { ok: false, reason: 'This house needs a door.' };
  return { ok: true, count };
}

const TOWN_ORDER = ['guide', 'merchant', 'nurse', 'demolitionist', 'arms_dealer', 'dryad'];
function townWants(key, world, p) {
  const has = k => G.npcs.some(n => n.type === k);
  switch (key) {
    case 'guide': return true;
    case 'merchant': return invMoney(p.inv) >= 5000;
    case 'nurse': return has('merchant') && p.lifeMax > 100;
    case 'demolitionist': return has('merchant') && p.inv.some(s => s && ['bomb', 'grenade', 'dynamite'].includes(s.id));
    case 'arms_dealer': return p.inv.some(s => s && (ITEMS[s.id].ammoType === 'bullet' || ITEMS[s.id].ammo === 'bullet'));
    case 'dryad': return world.flags.king_slime || world.flags.eye_of_cthulhu || world.flags.tung_sahur;
  }
  return false;
}

// periodic town update: move homeless NPCs into valid rooms, spawn new arrivals
function townTick(world, p) {
  const homes = findHouses(world, p);
  // homeless residents move in
  for (const n of G.npcs) {
    if (!n.town || n.home) continue;
    const h = homes.find(h => !G.npcs.some(o => o.home && o.home[0] === h[0] && o.home[1] === h[1]));
    if (h) { n.home = h; G.announce(n.name + ' moved into a house. ' + pick(['W landlord.', 'Rent is due in aura.', 'Certified crib.']), '#32ff82'); G.achieve('home'); }
  }
  // arrivals
  for (const key of TOWN_ORDER) {
    if (G.npcs.some(n => n.type === key)) continue;
    if (key === 'guide') {
      if (G.guideRespawn > 0) continue;
      spawnTownNPC(key, world, null);
      continue;
    }
    if (!townWants(key, world, p)) continue;
    const h = homes.find(h => !G.npcs.some(o => o.home && o.home[0] === h[0] && o.home[1] === h[1]));
    if (!h) continue;
    spawnTownNPC(key, world, h);
    G.announce(MEME.npc[key].arrive || (NPC_TYPES[key].name + ' has arrived!'), '#32ff82');
    break;
  }
}
function spawnTownNPC(key, world, home) {
  const x = home ? home[0] * TS + 8 : world.spawnX * TS + 8;
  const y = home ? (home[1] + 1) * TS : (world.spawnY + 1) * TS;
  const n = G.spawnNPC(key, x, y);
  n.home = home;
  n.name = pick(MEME.npc[key].names) + ' the ' + MEME.npc[key].name.replace(/^The /, '');
  n.shortName = MEME.npc[key].name;
  return n;
}
function findHouses(world, p) {
  const out = [];
  const seenRooms = [];
  // look for houses around every player in the session
  const cells = [];
  for (const pl of G.players) {
    const px = Math.floor(pl.cx / TS), py = Math.floor(pl.cy / TS);
    for (let y = py - 45; y < py + 45; y++) for (let x = px - 70; x < px + 70; x++) cells.push(x, y);
  }
  for (let k = 0; k < cells.length; k += 2) {
    const x = cells[k], y = cells[k + 1];
    const t = TILES[world.tile(x, y)];
    if (!t || !t.chair) continue;
    // stand above floor: use the tile of the chair's top
    const [ox, oy] = world.objOrigin(x, y);
    if (seenRooms.some(r => r[0] === ox && r[1] === oy)) continue;
    seenRooms.push([ox, oy]);
    const res = checkRoom(world, ox, oy);
    if (res.ok) out.push([ox, oy + 1]);
  }
  return out;
}

// ---------- shops ----------
const SHOPS = {
  merchant: () => ['rope', 'torch', 'lesser_healing_potion', 'lesser_mana_potion', 'wooden_arrow', 'shuriken', 'throwing_knife', 'empty_bucket', 'piggy_bank', 'copper_pickaxe', 'copper_axe', 'glowstick', 'dubai_chocolate', 'bottle', 'wooden_bow'].concat(G.world.flags.eye_of_cthulhu ? ['rocket_boots'] : []),
  arms_dealer: () => ['musket_ball', 'flintlock_pistol', 'minishark'],
  demolitionist: () => ['bomb', 'grenade', 'dynamite'],
  dryad: () => ['acorn', 'daybloom', 'sunflower', 'vile_powder', 'labubu', 'mushroom'],
};
const SHOP_PRICE_OVERRIDE = { rope: 10, torch: 50, wooden_arrow: 5, musket_ball: 7, daybloom: 200, acorn: 10, mushroom: 250, labubu: 67000, piggy_bank: 10000, bottle: 20, glowstick: 10, lesser_healing_potion: 300, lesser_mana_potion: 250, dubai_chocolate: 2500, bomb: 300, grenade: 75, dynamite: 2000, rocket_boots: 50000 };
function buyPrice(id) { const base = SHOP_PRICE_OVERRIDE[id] != null ? SHOP_PRICE_OVERRIDE[id] : Math.max(1, ITEMS[id].value); return Math.ceil(base * FANUM_TAX); }
function sellPrice(id) { return Math.floor((ITEMS[id].value || 0) / 5); }

function nurseCost(p) {
  const missing = p.lifeMax - p.life;
  let debuffs = Object.keys(p.buffs).filter(b => BUFFS[b] && BUFFS[b].debuff && b !== 'potion_sickness').length;
  return Math.ceil(missing * 6.7 + debuffs * 100);
}

function npcGreeting(n, p) {
  const m = MEME.npc[n.type];
  let line = fmtMeme(pick(m.lines), { p: p.name });
  if (n.type === 'guide') {
    // progression hint
    const f = G.world.flags;
    const hints = [];
    if (!p.inv.some(s => s && s.id === 'work_bench') && !G.nearTile(p, T.WORKBENCH, 12)) hints.push('First things first: chop trees and craft a Work Bench (10 wood). Grindset starts now.');
    else if (!f.eye_of_cthulhu && invCount(p.inv, 'lens') < 6) hints.push('Side-Eyes come out at night. Collect 6 lenses and craft a Suspicious Side-Eye at a Brainrot Altar.');
    else if (!f.eye_of_cthulhu) hints.push('You have 6 lenses. Find a Brainrot Altar (purple, underground), craft the Suspicious Side-Eye, and use it at night.');
    else if (!p.inv.some(s => s && ['nightmare_pickaxe', 'molten_pickaxe'].includes(s.id))) hints.push('Smelt Brainrot Ore into bars and make a Brainrot Pickaxe. You will need Doomscroll Chunks from the purple biome.');
    else if (!f.tung_sahur) hints.push('Tung Tung Tung Sahur can be summoned with a Sahur Kentongan (20 wood + 7 bones). Beat him for the Tung Bat.');
    else if (!p.inv.some(s => s && s.id.startsWith('molten'))) hints.push('Dig all the way down to Ohio. Mine Ohiostone and smelt Ohio Bars at an Ohioforge. You need obsidian too (water + lava).');
    else if (!f.wall_of_flesh) hints.push('Ohio Demons with voodoo dolls live in Ohio. Throw a Rizzler Voodoo Doll into lava to summon the Wall of Brainrot. I will not survive. It is fine. Probably.');
    else hints.push('You beat the Wall of Brainrot. You are officially him. The world is Hard Mogged now.');
    if (Math.random() < 0.6) line = hints[0];
  }
  if (n.type === 'nurse') {
    const c = nurseCost(p);
    if (c <= 0) line = "You're at full health. Stop glazing yourself and go fight something.";
  }
  return line;
}
