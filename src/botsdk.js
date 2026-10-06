// ---------- Bot SDK: one structured observation of the bot's world, refreshed every tick ----------
// Everything the bot decides with (TerraJev features, task candidates) and every skill reads this instead of
// remembering slot numbers or re-scanning ad hoc. Items are always referred to by id; their slot is looked up live.
const SDK = {
  _t: -1, _o: null, _scanT: -1e9, _scan: null,

  obs() {
    if (this._t === G.tick && this._o) return this._o;
    this._t = G.tick;
    return (this._o = this.build());
  },

  // ---------- inventory (by item id, live) ----------
  slotOf(id) { const p = G.player; return p.inv.findIndex(s => s && s.id === id); },
  count(id) { const p = G.player; let n = 0; for (const s of p.inv) if (s && s.id === id) n += s.count; if (p.mouseItem && p.mouseItem.id === id) n += p.mouseItem.count; return n; },
  equipped(id) { const p = G.player; return p.armor.some(a => a && a.id === id) || p.acc.some(a => a && a.id === id); },

  // fixed hotbar loadout: each kind of item has its own home slot, so items stop fighting over one slot
  LOADOUT: ['melee', 'pick', 'axe', 'ranged', 'torch', 'block', 'potion', 'tool', 'consumable', 'spare'],
  kindOf(id) {
    const it = ITEMS[id]; if (!it) return 'spare';
    if (it.pick) return 'pick';
    if (it.axe || it.hammer) return it.axe && !it.pick ? 'axe' : 'tool';
    if (id === 'torch') return 'torch';
    if (it.heal && it.potion) return 'potion';
    if (it.damage && !it.ammoType && !it.consumable) return (it.use === 'shoot' || it.use === 'throw' || (it.shoot && it.use !== 'swing')) ? 'ranged' : 'melee';
    if (['dirt_block', 'stone_block', 'ash_block', 'mud_block', 'clay_block', 'sand_block', 'snow_block', 'wood'].includes(id)) return 'block';
    if (it.place != null || it.placeWall != null) return 'spare';
    if (it.summon || it.consumable || it.use) return 'consumable';
    return 'spare';
  },
  // core kinds (weapon, pick, axe, torch, blocks, potions) own a slot; everything else shares the remaining slots,
  // replacing the least recently used one, so one key doesn't cycle through every item the bot needs
  CORE: ['melee', 'pick', 'axe', 'ranged', 'torch', 'block', 'potion'],
  hotbarSlotFor(id) {
    const k = this.kindOf(id), home = this.CORE.indexOf(k);
    if (home >= 0) return home;
    const p = G.player, used = Bot.slotUsed || [];
    const free = [], kept = new Set();
    for (let i = 0; i < 10; i++) { const s = p.inv[i]; if (!s) return i; const sk = this.kindOf(s.id); if (this.CORE.indexOf(sk) === i) kept.add(sk); } // an empty hotbar slot: take it
    for (let i = 0; i < 10; i++) {
      const sk = this.kindOf(p.inv[i].id);
      if (this.CORE.includes(sk) && (this.CORE.indexOf(sk) === i || !kept.has(sk))) { kept.add(sk); continue; } // one item of each core kind stays
      free.push(i);
    }
    if (!free.length) return 9;
    return free.sort((a, b) => (used[a] || 0) - (used[b] || 0))[0];
  },

  // ---------- the observation ----------
  build() {
    const p = G.player, w = G.world, bot = Bot;
    const fx = Math.floor(p.cx / TS), fy = Math.floor((p.y + p.h - 1) / TS);
    const zone = G.inBackrooms(p) ? 'backrooms' : fy < w.worldSurface ? 'surface' : fy < w.rockLayer ? 'underground' : fy < w.hellLayer ? 'caverns' : 'ohio';
    // inventory summary
    const counts = {}, where = {};
    p.inv.forEach((s, i) => { if (!s) return; counts[s.id] = (counts[s.id] || 0) + s.count; if (where[s.id] == null) where[s.id] = i; });
    const best = key => { let bi = -1, bv = 0; p.inv.forEach((s, i) => { const v = s && ITEMS[s.id][key]; if (v && v > bv) { bv = v; bi = i; } }); return { slot: bi, power: bv, id: bi >= 0 ? p.inv[bi].id : null }; };
    let melee = { slot: -1, dmg: 0, id: null }, ranged = { slot: -1, dmg: 0, id: null };
    p.inv.forEach((s, i) => {
      if (!s) return; const it = ITEMS[s.id];
      if (!it.damage || it.ammoType || it.consumable || it.pick || it.axe || it.hammer) return;
      const k = this.kindOf(s.id), d = expectedHit(it);
      if (k === 'ranged' && !(it.ammo && p.findAmmo(it.ammo) < 0) && d > ranged.dmg) ranged = { slot: i, dmg: d, id: s.id };
      if (k === 'melee' && d > melee.dmg) melee = { slot: i, dmg: d, id: s.id };
    });
    const potions = p.inv.reduce((n, s) => n + (s && ITEMS[s.id].heal && ITEMS[s.id].potion ? s.count : 0), 0);
    // expensive world scans are cached for 120 ticks
    if (G.tick - this._scanT > 120 || !this._scan || Math.abs(this._scan.at[0] - fx) > 20 || Math.abs(this._scan.at[1] - fy) > 20) {
      this._scanT = G.tick;
      const nearest = (pred, rx, ry) => bot.nearestTile(pred, rx, ry);
      const ores = {};   // (ore by the Backrooms is never mined, so it isn't 'known' either)
      for (const [oid, tn] of Object.entries(typeof ORE_TILE !== 'undefined' ? ORE_TILE : {})) { const t = T[tn]; const c = nearest((tt, x, y) => tt === t && !bot.nearBackrooms(x, y), 90, 80); if (c) ores[oid] = { x: c[0], y: c[1], d: Math.abs(c[0] - fx) + Math.abs(c[1] - fy) }; }
      const tree = nearest((t, x, y) => t === T.TREE && w.treeType(x, y) === TREE_BASE, 140, 40);
      const crystal = nearest(t => t === T.LIFE_CRYSTAL, 120, 90);
      const altar = nearest(t => t === T.ALTAR, 300, 250);
      const chest = nearest(t => t === T.CHEST, 60, 40);
      let lava = 0, water = 0;
      for (let y = fy - 6; y <= fy + 6; y++) for (let x = fx - 6; x <= fx + 6; x++) { const l = w.liq(x, y); if (l > 30) { if (w.ltype[w.idx(x, y)] === 1) lava++; else water++; } }
      this._scan = { at: [fx, fy], ores, tree: tree && { x: tree[0], y: tree[1], d: Math.abs(tree[0] - fx) + Math.abs(tree[1] - fy) }, crystal: crystal && { x: crystal[0], y: crystal[1], d: Math.abs(crystal[0] - fx) + Math.abs(crystal[1] - fy) }, altar: altar && { x: altar[0], y: altar[1] }, chest: chest && { x: chest[0], y: chest[1] }, lava, water };
    }
    const enemies = G.npcs.filter(n => !n.friendly && !n.town && !n.dead && n.alpha > 0.5 && !n.def.critter && dist(n.cx, n.cy, p.cx, p.cy) < 600)
      .map(n => ({ uid: n.uid, name: n.name, dx: Math.round((n.cx - p.cx) / TS), dy: Math.round((n.cy - p.cy) / TS), d: Math.round(dist(n.cx, n.cy, p.cx, p.cy) / TS), life: Math.round(n.life), lifeMax: n.lifeMax, boss: !!n.boss, flying: !!(n.def.noGravity || ['flyer', 'bat', 'smiler'].includes(n.def.ai)) }))
      .sort((a, b) => a.d - b.d);
    const stations = {};
    if (bot.base) for (const st of ['work_bench', 'furnace', 'anvil', 'hellforge']) stations[st] = bot.stationPlaced(st);
    return {
      tick: G.tick,
      self: { x: fx, y: fy, life: Math.round(p.life), lifeMax: p.lifeMax, mana: p.mana, manaMax: p.manaMax, def: p.calc.defense, onGround: p.onGround, wet: !!p.wet, lava: !!p.lavaWet, zone, biome: G.biomeAt(fx), night: G.isNight(), clock: G.clockString(), buffs: Object.keys(p.buffs) },
      inv: {
        counts, where, free: p.inv.slice(10).filter(s => !s).length, cursor: p.mouseItem ? p.mouseItem.id : null,
        hotbar: p.inv.slice(0, 10).map(s => (s ? s.id : null)), selected: p.inv[p.sel] ? p.inv[p.sel].id : null,
        armor: p.armor.map(a => (a ? a.id : null)), acc: p.acc.filter(Boolean).map(a => a.id),
        pick: best('pick'), axe: best('axe'), hammer: best('hammer'), melee, ranged, potions,
        torches: counts.torch || 0, spareBlocks: bot.spareBlocks ? bot.spareBlocks() : 0,
      },
      near: Object.assign({ enemies }, this._scan),
      base: { spot: bot.houseSpot || null, at: bot.base || null, valid: bot.base ? bot.houseValid() : false, finished: !!bot.houseFinished, stations, dist: bot.base ? Math.abs(bot.base[0] - fx) + Math.abs(bot.base[1] - fy) : 999 },
      memory: { task: bot.lastTaskId || null, goal: bot.goal, committed: bot.committed ? { item: bot.committed.item, needs: bot.committed.needs } : null, cooling: Object.keys(bot.cooldowns || {}).filter(k => bot.cooldowns[k] > G.tick) },
      progress: { milestones: Object.keys(bot.milestones || {}), bosses: Object.entries(w.flags).filter(([k, v]) => v && ['king_slime', 'eye_of_cthulhu', 'tung_sahur', 'wall_of_flesh'].includes(k)).map(([k]) => k), day: w.day },
    };
  },

  // compact numeric view of the observation, appended to TerraJev's state features
  features() {
    const o = this.obs(), i = o.inv, s = o.self, b = o.base, n = o.near;
    const ore = id => (n.ores && n.ores[id] ? Math.min(n.ores[id].d, 200) / 100 : 2.5);
    return [
      i.pick.power / 100, i.axe.power / 100, Math.min(i.melee.dmg, 100) / 50, Math.min(i.ranged.dmg, 100) / 50, i.ranged.slot >= 0 ? 1 : 0,
      Math.min(i.potions, 10) / 5, Math.min(i.torches, 50) / 25, Math.min(i.spareBlocks, 300) / 100, i.free / 40,
      i.armor.filter(Boolean).length / 3, i.acc.length / 5, s.def / 30,
      b.valid ? 1 : 0, b.finished ? 1 : 0, b.stations.furnace ? 1 : 0, b.stations.anvil ? 1 : 0, b.stations.hellforge ? 1 : 0, Math.min(b.dist, 300) / 100,
      ore('copper_ore'), ore('iron_ore'), ore('silver_ore'), ore('gold_ore'), ore('demonite_ore'), ore('hellstone'),
      n.tree ? Math.min(n.tree.d, 200) / 100 : 2.5, n.crystal ? Math.min(n.crystal.d, 200) / 100 : 2.5, Math.min(n.lava, 20) / 10, Math.min(n.water, 20) / 10,
      Math.min(o.progress.milestones.length, 20) / 10, o.progress.bosses.length / 4,
      Math.min(Math.log1p(i.counts.wood || 0), 6) / 3, Math.min(Math.log1p(i.counts.stone_block || 0), 6) / 3,
    ]; // 32
  },

  // one-line summaries for the HUD "bot vision" panel (F7)
  summary() {
    const o = this.obs(), i = o.inv, s = o.self;
    const top = Object.entries(i.counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => v + ' ' + k.replace(/_/g, ' ')).join(', ');
    const ores = Object.entries(o.near.ores || {}).map(([k, v]) => k.replace('_ore', '') + ' ' + v.d + 't').join(', ') || 'none known';
    const en = o.near.enemies.slice(0, 4).map(e => e.name + ' ' + e.d + 't' + (e.boss ? ' BOSS' : '')).join(', ') || 'none';
    return [
      `pos ${s.x},${s.y} · ${s.zone} (${s.biome}) · ${s.clock}${s.night ? ' night' : ''} · life ${s.life}/${s.lifeMax} · def ${s.def}`,
      `hotbar: ${i.hotbar.map((h, k) => ((k + 1) % 10) + ':' + (h ? h.replace(/_/g, ' ') : '-')).join(' ')}`,
      `armor: ${i.armor.map(a => a || '-').join(', ')} · acc: ${i.acc.join(', ') || '-'} · pick ${i.pick.power}% · free slots ${i.free}`,
      `has: ${top}`,
      `near: enemies ${en} · ores ${ores} · tree ${o.near.tree ? o.near.tree.d + 't' : '-'} · crystal ${o.near.crystal ? o.near.crystal.d + 't' : '-'}`,
      `base: ${o.base.valid ? 'house ok' : 'no house'}${o.base.finished ? ' (finished)' : ''} · stations ${Object.entries(o.base.stations).filter(([, v]) => v).map(([k]) => k).join(', ') || '-'} · ${o.base.dist}t away`,
      `memory: task ${o.memory.task || '-'} · committed ${o.memory.committed ? o.memory.committed.item : '-'} · cooling ${o.memory.cooling.join(', ') || '-'}`,
    ];
  },
};
