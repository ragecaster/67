// ---------- BotSigma progression planner ----------
// A recipe-driven shopping list: walk the wanted items in priority order; for the first one we don't own, resolve it down
// the recipe tree to the first thing that is actually missing (craft it, or gather the raw material) and return a task for that.
// This replaces the old hard-coded "smelt everything, then craft whatever there is enough of" ladder, which hoarded 500+ copper bars
// while never finishing a single armor set.
const RAW_ITEMS = new Set(['wood', 'stone_block', 'dirt_block', 'copper_ore', 'iron_ore', 'silver_ore', 'gold_ore', 'demonite_ore', 'hellstone', 'obsidian', 'gel', 'lens', 'rotten_chunk', 'fallen_star', 'sand_block', 'clay_block', 'bone']);
const ORE_TILE = { copper_ore: 'COPPER', iron_ore: 'IRON', silver_ore: 'SILVER', gold_ore: 'GOLD', demonite_ore: 'DEMONITE', hellstone: 'HELLSTONE' };
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
      return this.taskCraftAtBase([step.craft, step.times, placeable ? 'place' : undefined]);
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
  // The ordered list of things a player wants, as [item, qty]. Segments stop the list early (e.g. "iron tier first").
  wantSegments() {
    // armor before weapons: most early deaths are the bot trading blows with nothing on.
    // The 67 (67 damage for 6 gold + 7 silver bars) outclasses every tiered broadsword, so those are skipped entirely.
    const armor = (k) => [[k + '_chainmail', 1], [k + '_greaves', 1], [k + '_helmet', 1]];
    return [
      { name: 'stations', want: [['furnace', 1], ['iron_anvil', 1]] },
      { name: 'pick', want: [['iron_pickaxe', 1]] },
      { name: 'the67', want: [['the_67', 1]] },
      { name: 'iron', want: armor('iron') },
      { name: 'bow', want: [['gold_bow', 1], ['wooden_arrow', 300]] },
      { name: 'crystals', special: 'crystals' },
      { name: 'gold', want: [['gold_pickaxe', 1]].concat(armor('gold')) },
    ];
  },
  // first actionable task of the ladder (null when the whole ladder is done / nothing actionable)
  progressionTask() {
    const p = this.p();
    for (const seg of this.wantSegments()) {
      if (seg.special === 'crystals') {
        if (p.lifeMax < 200) { const c = this.nearestTile(t => t === T.LIFE_CRYSTAL, 120, 90); if (c && !this.crystalBad(c)) return this.taskBreakAt(c, 'aura crystal', 'pick'); }
        continue;
      }
      for (const [id, qty] of seg.want) {
        if (!ITEMS[id] || !RECIPES.some(r => r.out === id)) continue;
        // placed stations count as owned
        if (id === 'furnace' && this.stationPlaced('furnace')) continue;
        if (id === 'iron_anvil' && this.stationPlaced('anvil')) continue;
        if (this.blocked(id)) continue;
        // a pickaxe of a lower tier than one we own is pointless
        const pk = ITEMS[id].pick; if (pk && this.hasBetterPick(pk)) continue;
        const step = this.resolve(id, qty);
        if (!step) continue;
        const t = this.taskForStep(step);
        if (t) { this.planWhy = id + ' <- ' + JSON.stringify(step); return t; }
      }
    }
    return null;
  },
  crystalBad(c) { return !!(this.badCrystals && this.badCrystals.has(c[0] + ',' + c[1])); },
});
