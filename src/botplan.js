// boss summons: the item, whether it needs night, whether the boss also comes by itself at night (life >= 200)
const BOSS_SUMMON = {
  king_slime: { item: 'slime_crown', night: false, natural: false },
  eye_of_cthulhu: { item: 'suspicious_looking_eye', night: true, natural: true },
  tung_sahur: { item: 'kentongan', night: true, natural: true },
};
// where the monster drops for those summons come from
const BOSS_FARM = { gel: 'surface', lens: 'night', bone: 'caverns' };
// ---------- BotSigma progression planner ----------
// A recipe-driven shopping list: walk the wanted items in priority order; for the first one we don't own, resolve it down
// the recipe tree to the first thing that is actually missing (craft it, or gather the raw material) and return a task for that.
// This replaces the old hard-coded "smelt everything, then craft whatever there is enough of" ladder, which hoarded 500+ copper bars
// while never finishing a single armor set.
const RAW_ITEMS = new Set(['wood', 'stone_block', 'dirt_block', 'copper_ore', 'iron_ore', 'silver_ore', 'gold_ore', 'demonite_ore', 'hellstone', 'obsidian', 'gel', 'lens', 'rotten_chunk', 'fallen_star', 'sand_block', 'clay_block', 'bone']);
const ORE_TILE = { copper_ore: 'COPPER', iron_ore: 'IRON', silver_ore: 'SILVER', gold_ore: 'GOLD', demonite_ore: 'DEMONITE', hellstone: 'HELLSTONE' };
// Goal catalog for TerraJev's `task` question: things worth crafting (no ordering — the model decides what to go for)
const JEV_GOALS = [
  ['furnace', 1], ['iron_anvil', 1], ['torch', 30], ['wooden_arrow', 300], ['lesser_healing_potion', 5], ['mana_crystal', 1],
  ['copper_pickaxe', 1], ['iron_pickaxe', 1], ['silver_pickaxe', 1], ['gold_pickaxe', 1], ['nightmare_pickaxe', 1], ['molten_pickaxe', 1],
  ['copper_broadsword', 1], ['iron_broadsword', 1], ['silver_broadsword', 1], ['gold_broadsword', 1], ['wood_helmet', 1], ['wood_greaves', 1],
  ['the_67', 1], ['gold_bow', 1], ['iron_bow', 1], ['demon_bow', 1], ['molten_fury', 1], ['lights_bane', 1], ['fiery_greatsword', 1], ['nights_edge', 1],
  ['copper_helmet', 1], ['copper_chainmail', 1], ['copper_greaves', 1], ['iron_helmet', 1], ['iron_chainmail', 1], ['iron_greaves', 1],
  ['silver_helmet', 1], ['silver_chainmail', 1], ['silver_greaves', 1], ['gold_helmet', 1], ['gold_chainmail', 1], ['gold_greaves', 1],
  ['shadow_helmet', 1], ['shadow_scalemail', 1], ['shadow_greaves', 1], ['molten_helmet', 1], ['molten_breastplate', 1], ['molten_greaves', 1],
  ['suspicious_looking_eye', 1], ['kentongan', 1], ['hellforge', 1], ['grappling_hook', 1], ['empty_bucket', 1],
];
const STATION_ITEM = { work_bench: 'work_bench', furnace: 'furnace', anvil: 'iron_anvil', hellforge: 'hellforge' };

Object.assign(Bot, {
  // do we own this (inventory, cursor, worn armor/accessories)?
  owns(id, n = 1) {
    const p = this.p();
    let c = this.count(id);
    for (const a of p.armor) if (a && a.id === id) c++;
    for (const a of p.acc) if (a && a.id === id) c++;
    return c >= n;
  },
  // Resolve `qty` of item `id` to the next missing thing. null = we have it. {craft, times, after} | {gather, qty} | {skip}
  resolve(id, qty = 1, depth = 0) {
    if (depth > 6) return { skip: id };
    const have = id === 'wood' || RAW_ITEMS.has(id) || !ITEMS[id].armor ? this.count(id) : (this.owns(id) ? qty : 0);
    if (have >= qty) return null;
    const r = RECIPES.find(q => q.out === id);
    if (RAW_ITEMS.has(id) || !r) return { gather: id, qty: qty - have };
    const times = Math.ceil((qty - have) / r.n);
    for (const [ing, n] of r.ing) {
      const sub = this.resolve(ing, n * times, depth + 1);
      if (sub) return sub;
    }
    // the station this recipe needs must already be standing at the base
    if (r.station && STATION_ITEM[r.station] && r.station !== 'work_bench' && !this.stationPlaced(r.station)) {
      return { station: r.station };
    }
    return { craft: id, times };
  },
  // turn a resolved step into a task (or null when the step can't be acted on yet)
  taskForStep(step) {
    const p = this.p();
    if (step.station) {
      const item = STATION_ITEM[step.station];
      if (this.has(item)) return this.taskCraftAtBase([item, 0, 'placeonly']);
      const s2 = this.resolve(item, 1);
      return s2 && !s2.station ? this.taskForStep(s2) : null;
    }
    if (step.craft) {
      const placeable = ITEMS[step.craft].place && TILES[ITEMS[step.craft].place] && TILES[ITEMS[step.craft].place].station;
      // at the furnace anyway: smelt all the ore of that kind we carry (one trip home instead of one per item)
      let times = step.times;
      const r = RECIPES.find(q => q.out === step.craft);
      if (r && r.station === 'furnace' && r.ing.length === 1 && ORE_TILE[r.ing[0][0]]) times = Math.max(times, Math.floor(this.count(r.ing[0][0]) / r.ing[0][1]));
      return this.taskCraftAtBase([step.craft, times, placeable ? 'place' : undefined]);
    }
    const id = step.gather, have = this.count(id);
    if (id === 'wood') return this.taskChop(have + Math.max(20, step.qty));
    if (id === 'stone_block') return this.taskMine('stone', () => this.count('stone_block') >= have + step.qty);
    if (ORE_TILE[id]) {
      const tile = T[ORE_TILE[id]];
      return this.taskMine('ore', () => this.count(id) >= have + step.qty, [tile]);
    }
    return null; // gel / lens / chunks: dropped by monsters, picked up along the way
  },
  // ---- goal memory: what are we working toward, and which raw materials does it still need? ----
  // Those materials are reserved: navigation (pillars, bridges, fall catches) may only spend blocks above the reservation,
  // so the 20 stone for a furnace doesn't get stacked into a pillar on the walk home.
  rawNeeds(id, qty, acc = {}, depth = 0) {
    if (depth > 6 || qty <= 0) return acc;
    const r = RECIPES.find(q => q.out === id);
    if (RAW_ITEMS.has(id) || !r) { acc[id] = (acc[id] || 0) + qty; return acc; }
    const have = Math.min(qty, this.count(id)), need = qty - have;
    if (need <= 0) return acc;
    const times = Math.ceil(need / r.n);
    for (const [ing, n] of r.ing) this.rawNeeds(ing, n * times, acc, depth + 1);
    return acc;
  },
  commit(id, qty) {
    const c = this.committed;
    if (!c || c.item !== id || G.tick - c.at > 600) {
      const needs = this.rawNeeds(id, qty);
      if (!c || c.item !== id) this.log('committing to ' + ITEMS[id].name + ' (reserving ' + Object.entries(needs).map(([k, v]) => v + ' ' + k).join(', ') + ')');
      this.committed = { item: id, qty, needs, at: G.tick };
    }
  },
  reserved(id) {
    let n = 0;
    const c = this.committed;
    if (c && c.needs[id]) n += c.needs[id];
    if (this.hell && this.hell.x0 && ['stone_block', 'dirt_block', 'ash_block'].includes(id)) n += 0; // the runway itself is what blocks are for
    return n;
  },
  // a hotbar/inventory slot holding a building block we can afford to spend (cheap blocks first, wood last)
  spareBlockSlot(allowWood = true) {
    const order = ['dirt_block', 'ash_block', 'mud_block', 'sand_block', 'clay_block', 'snow_block', 'stone_block'].concat(allowWood ? ['wood'] : []);
    for (const id of order) {
      if (this.count(id) - this.reserved(id) <= 0) continue;
      const s = this.slotOf(it => it.id === id);
      if (s >= 0) return s;
    }
    return -1;
  },
  // what to pillar up with: wood platforms first (a platform pillar is a ladder afterwards: jump up through it, land on a higher
  // rung; nothing to dig out of the way later), then spare blocks
  PLATFORM_KEEP: 10,
  climbSlot() {
    if (this.count('wood_platform') - this.reserved('wood_platform') > this.PLATFORM_KEEP) {   // the last 10 are for Tung's ledge / the arena const s = this.slotOf(it => it.id === 'wood_platform'); if (s >= 0) return s; }
    return this.spareBlockSlot(true);
  },
  spareBlocks() { return ['dirt_block', 'ash_block', 'mud_block', 'sand_block', 'clay_block', 'snow_block', 'stone_block', 'wood'].reduce((n, id) => n + Math.max(0, this.count(id) - this.reserved(id)), 0); },
  crystalBad(c) { return !!(this.badCrystals && this.badCrystals.has(c[0] + ',' + c[1])); },
});
