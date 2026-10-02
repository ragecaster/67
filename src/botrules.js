// ---------- BotSigma rules: the parts strong game bots keep in code ----------
// 1. survival: a quick combat simulator decides which fights are winnable (SparCraft/FAP-style), plus hard reflexes
// 2. progression: a tech-tree plan toward the next boss (what to craft/mine next), with boss readiness gates
// 3. a scripted teacher that picks a sensible action; TerraJev imitates it, then learns to beat it, and falls back to it when unsure
const BOSS_ORDER = ['king_slime', 'eye_of_cthulhu', 'tung_sahur', 'wall_of_flesh'];
// what "ready" means for each boss: max life, defense, weapon damage/second, healing potions, arrows (if we use a bow)
const BOSS_READY = {
// The first three are measured (tests/_bossbench.js n100/n140/c100): with The 67 and no armor, King and the Eye cost ~100-130 life
// (King kills a 100-life player, 140 = two aura crystals wins both); Tung is fought from a perch it can't reach.
// So the gate is The 67 + two crystals, not armor (a full iron set is ~75 bars and cost most of an hour).
  king_slime: { lifeMax: 140, def: 0, dps: 60, potions: 0, pick: 35 },
  eye_of_cthulhu: { lifeMax: 140, def: 0, dps: 60, potions: 0, pick: 35 },
  tung_sahur: { lifeMax: 100, def: 0, dps: 60, potions: 0, pick: 35 },   // copper mines everything up to gold
  // The 67 is best in slot up to the Wall (its homing 6s and 7s land ~220/s there; Night's Edge is melee only and costs a hellstone
  // sword + Tung's bat; Brainrot/Ohio bows land far less): the gate is The 67, and demonite goes into armor and the pickaxe
  wall_of_flesh: { lifeMax: 300, def: 16, dps: 80, potions: 10, pick: 65, arrows: 300 },
};
// upgrade paths the plan walks (cheapest first)
// No Ohio (hellstone) gear: the Wall is the last boss, The 67 + Brainrot armor clear its gate, and hellstone sits in lava under
// Ohio's flyers (the owner watched the bot burn and stall there mining it for a sword it didn't need)
const PLAN_WEAPONS = ['the_67', 'lights_bane', 'gold_broadsword', 'silver_broadsword', 'iron_broadsword', 'copper_broadsword', 'gold_bow', 'iron_bow', 'demon_bow'];  // best first: the plan takes the first one it can make progress on
const PLAN_PICKS = ['iron_pickaxe', 'silver_pickaxe', 'gold_pickaxe', 'nightmare_pickaxe'];
const PLAN_ARMOR = ['wood_helmet', 'wood_greaves', 'copper_helmet', 'copper_chainmail', 'copper_greaves', 'iron_helmet', 'iron_chainmail', 'iron_greaves',
  'silver_helmet', 'silver_chainmail', 'silver_greaves', 'gold_helmet', 'gold_chainmail', 'gold_greaves', 'shadow_helmet', 'shadow_scalemail', 'shadow_greaves'];

Object.assign(Bot, {
  // ================= survival =================
  weaponDps(n) {
    const p = this.p(), ws = this.bestWeaponSlot(n || null);
    if (ws < 0) return { dps: 0, melee: true };
    const it = ITEMS[p.inv[ws].id];
    let dmg = it.damage;
    if (it.ammo) { const a = p.findAmmo(it.ammo); if (a >= 0) dmg += ITEMS[p.inv[a].id].damage || 0; }
    dmg = n ? expectedHit(Object.assign({}, it, { damage: dmg }), n.defense || 0) : expectedHit(Object.assign({}, it, { damage: dmg }));
    const melee = (it.use === 'swing' || it.use === 'thrust') && !it.shoot;
    return { dps: dmg * 60 / Math.max(6, it.useAnim || it.useTime), melee };
  },
  // a back-of-the-envelope fight simulation: time to kill vs. damage we'd soak meanwhile (potions included)
  fightOdds(n) {
    const p = this.p(), w = this.weaponDps(n);
    if (!w.dps) return { ok: false, margin: -1 };
    const hit = w.melee ? 0.7 : 0.5, tKill = n.life / (w.dps * hit);                       // seconds
    let incoming = 0;
    for (const m of G.npcs) {
      if (m.friendly || m.town || m.dead || m.def.critter || dist(m.cx, m.cy, n.cx, n.cy) > 300) continue;
      incoming += Math.max(1, m.damage - p.calc.defense * 0.5) * (m.boss ? 1.0 : 0.4);       // hits per second (i-frames + knockback keep it low)
    }
    const potions = this.potionCount();
    const heal = potions && !p.buffs.potion_sickness ? 50 * Math.min(potions, 1 + Math.floor(tKill / 60)) : 0;
    const margin = (p.life + heal - incoming * tKill) / p.lifeMax;
    return { ok: margin > 0.15, margin, tKill };
  },
  // max life plus what carried potions add over a boss fight (bench: 100 life + 5 potions beats King like 140 life does)
  effLife() { return this.p().lifeMax + 12 * Math.min(this.potionCount(), 4); },
  potionCount() { return this.p().inv.reduce((n, s) => n + (s && ITEMS[s.id].heal && ITEMS[s.id].potion ? s.count : 0), 0); },
  // reflexes the model is never asked about
  survivalReflex(foes) {
    const p = this.p(), boss = foes.some(n => n.boss);
    if (boss || !this.base) return null;
    const [fx, fy] = this.feet(), dHome = Math.abs(fx - this.base[0]) + Math.abs(fy - this.base[1]);
    // in Ohio home is ~470 tiles up through lava: potions (the 40% reflex) are the way out, not running
    if (fy > G.world.hellLayer - 20 && this.potionCount() > 0) return null;
    if (p.life < p.lifeMax * 0.35 && dHome > 6) return 'flee';     // badly hurt away from home: go home, enemies or not
    return null;
  },

  // ================= progression plan =================
  nextBoss() {
    const w = G.world, left = BOSS_ORDER.filter(k => !w.flags[k] && k !== 'wall_of_flesh');
    if (!left.length) return w.flags.wall_of_flesh ? null : 'wall_of_flesh';
    const night = G.isNight(), armed = this.weaponDps(null).dps >= BOSS_READY.king_slime.dps;
    // a summon in hand that works right now
    const now = left.find(k => this.has(BOSS_SUMMON[k].item) && (!BOSS_SUMMON[k].night || night) && this.bossReady(k));
    if (now) return now;
    // night: the Eye's lenses only drop now (if we can fight), then Tung's bones; day: King (gel + gold), then the night bosses' materials
    // By day: Tung's bones first (the summon must be ready for the one night that fits in an hour; King can wait for day 3),
    // then King; a night boss whose summon is already in hand has nothing left to do by day. The Eye by day only crafts its summon.
    if (night && armed) return ['eye_of_cthulhu', 'tung_sahur', 'king_slime'].find(k => left.includes(k));
    const dayable = k => !(BOSS_SUMMON[k].night && this.has(BOSS_SUMMON[k].item)) && (k !== 'eye_of_cthulhu' || this.count('lens') >= 6);
    return ['tung_sahur', 'king_slime', 'eye_of_cthulhu'].find(k => left.includes(k) && dayable(k)) || left[0];
  },
  // boss fight simulator, calibrated on measured fights (tests/_bossbench.js): we land ~0.9 of melee / ~0.4 of ranged damage,
  // and take ~0.25 contact hits per second
  bossSim(key) {
    const B = BOSS_TYPES[key], p = this.p();
    if (!B) return { ok: true, margin: 1 };
    const fake = { life: B.life, defense: B.defense || 0, def: B, boss: true, cy: p.cy, cx: p.cx };
    const ws = this.bestWeaponSlot(fake);
    if (ws < 0) return { ok: false, margin: -9 };
    const it = ITEMS[p.inv[ws].id], melee = (it.use === 'swing' || it.use === 'thrust') && !it.shoot;
    let dmg = it.damage;
    if (it.ammo) { const a = p.findAmmo(it.ammo); if (a >= 0) dmg += ITEMS[p.inv[a].id].damage || 0; }
    dmg = expectedHit(Object.assign({}, it, { damage: dmg }), B.defense || 0);
    const eff = dmg * 60 / Math.max(6, it.useAnim || it.useTime) * (melee || it.sixSeven ? 0.9 : 0.4);
    const reach = key === 'tung_sahur' ? 0.15 : 1;   // fought from the perch (taskBoss): only stray logs land
    const tKill = B.life / eff, incoming = Math.max(1, B.damage - p.calc.defense * 0.5) * 0.25 * reach;
    const heal = 50 * Math.min(this.potionCount(), 1 + Math.floor(tKill / 60));
    const margin = (p.lifeMax + heal - incoming * tKill) / p.lifeMax;
    return { ok: margin > 0.3, margin, tKill };
  },
  bossReady(key) {
    const R = BOSS_READY[key]; if (!R) return true;
    const p = this.p();
    if (this.effLife() < R.lifeMax || p.calc.defense < R.def) return false;
    if (this.weaponDps(null).dps < R.dps) return false;   // measured: weapon + life are what decide these fights (bossSim misjudges The 67's piercing shots)
    // potions are on the plan, but not a hard gate: the recipe needs gel, mushrooms and glass, which may simply not be around
    if (key === 'wall_of_flesh') return this.readyForWall ? this.readyForWall() : true;
    return true;
  },
  // the first unmet requirement for the next boss, as a predicate over candidates (which actions advance it)
  planFrontier(cands) {
    const p = this.p(), key = this.nextBoss();
    if (!key) return { label: 'game beaten', test: () => false };
    const R = BOSS_READY[key], dps = this.weaponDps(null).dps, pick = SDK.obs().inv.pick.power;
    const byId = id => cands.some(c => c.id === id);
    const craftsOf = list => list.filter(id => byId('craft:' + id));
    // gathering that feeds a craft goal counts as on-plan too
    const feeding = item => {
      const needs = this.rawNeeds(item, 1), ids = new Set();
      for (const [id, n] of Object.entries(needs)) if (this.count(id) < n) {
        if (id === 'wood') ids.add('chop'); else if (id === 'stone_block') ids.add('stone'); else if (ORE_TILE[id]) ids.add('ore:' + id);
      }
      return ids;
    };
    const reqs = [];
    if (!this.houseValid() || !this.houseFinished) reqs.push({ label: 'build a house', ids: new Set(['build', 'chop']) });
    for (const st of ['furnace', 'iron_anvil']) if (!this.stationPlaced(st === 'iron_anvil' ? 'anvil' : st)) reqs.push({ label: 'place ' + st, item: st });
    if (pick < R.pick) for (const id of PLAN_PICKS) if ((ITEMS[id] && ITEMS[id].pick || 0) > pick) reqs.push({ label: 'better pickaxe', item: id });
    // the nightmare pickaxe (and shadow armor) needs rotten chunks + demonite from the Brainrot biome: that skill farms both
    if (pick < 65 && R.pick >= 65) reqs.push({ label: 'farm the Brainrot for a nightmare pickaxe', ids: new Set(['brainrot', 'craft:nightmare_pickaxe']) });
    const losing = dps < R.dps;
    // The 67 is the only weapon that meets the boss gate: don't spend its silver/gold on a stopgap sword on the way
    if (losing && !this.owns('the_67')) reqs.push({ label: 'better weapon', item: 'the_67' });
    else if (losing) for (const id of PLAN_WEAPONS) { const it = ITEMS[id]; if (it && expectedHit(it) * 60 / Math.max(6, it.useAnim || it.useTime) > dps * 1.15) reqs.push({ label: 'better weapon', item: id }); }
    // below the Wall's defense gate after the Eye: the Brainrot set (its chunks only drop from Doomscrollers, so the farm skill gets them)
    if (p.calc.defense < R.def && G.world.flags.eye_of_cthulhu && this.brainrotWants().some(id => id.startsWith('shadow_')))
      reqs.push({ label: 'Brainrot armor', ids: new Set(['brainrot', ...this.SHADOW_SET.map(id => 'craft:' + id), 'craft:demonite_bar']) });
    if (p.calc.defense < R.def) for (const id of PLAN_ARMOR) {
      const it = ITEMS[id]; if (!it || !it.armor) continue;
      const cur = p.armor[{ head: 0, body: 1, legs: 2 }[it.armor]];
      if ((it.defense || 0) > (cur ? ITEMS[cur.id].defense || 0 : 0)) reqs.push({ label: 'more defense', item: id });
    }
    if (this.effLife() < R.lifeMax) reqs.push({ label: 'more max life', ids: new Set(['crystal', 'explore']) });
    if (this.potionCount() < R.potions) reqs.push({ label: 'healing potions', item: 'lesser_healing_potion' });
    // arrows only for a bow we'd actually fight with (The 67 counts as ranged, it fires 6s and 7s, but needs no ammo)
    const rs = this.rangedSlot();
    if (R.arrows && rs >= 0 && ITEMS[p.inv[rs].id].ammo === 'arrow' && this.count('wooden_arrow') < R.arrows) reqs.push({ label: 'arrows', item: 'wooden_arrow' });
    // the summon item itself (and its ingredients) before the fight
    const S = BOSS_SUMMON[key];
    if (S && !this.has(S.item)) reqs.push({ label: 'summon item', item: S.item });
    reqs.push({ label: 'fight ' + BOSS_TYPES[key].name, ids: new Set(key === 'wall_of_flesh' ? ['hell'] : ['boss:' + key]) });
    // the first requirement some candidate can actually advance
    for (const r of reqs) {
      const ids = r.ids || new Set(['craft:' + r.item, ...feeding(r.item)]);
      if (r.item && !byId('craft:' + r.item) && ![...ids].some(byId)) continue;
      if ([...ids].some(byId)) return { label: r.label + (r.item ? ' (' + r.item.replace(/_/g, ' ') + ')' : ''), boss: key, test: c => ids.has(c.id) };
    }
    // waiting for night (the boss's own option is hidden by day): extra life makes every fight shorter
    if (byId('crystal') && this.p().lifeMax < 400) return { label: 'more max life (waiting for night)', boss: key, test: c => c.id === 'crystal' };
    // nothing actionable: explore, or mine an ore the plan actually needs (not whatever copper is closest)
    const wanted = new Set(['gold_ore', 'silver_ore', 'iron_ore', 'copper_ore'].filter(ore => [this.committed && this.committed.item, 'the_67', S && S.item].some(id => id && !this.owns(id) && (this.rawNeeds(id, 1)[ore] || 0) > this.count(ore))));
    return { label: 'explore for ' + BOSS_TYPES[key].name + ' materials', boss: key, test: c => c.id === 'explore' || (c.kind === 'ore' && wanted.has(c.id.slice(4))) };
  },

  // ================= the scripted teacher =================
  teacherPick(cands, foes) {
    const p = this.p(), has = id => cands.find(c => c.id === id);
    const boss = foes.find(n => n.boss);
    if (boss) {   // use whichever weapon lands more: kite only when the best weapon is a ranged one
      if (has('heal') && p.life < p.lifeMax * 0.5) return 'heal';
      const ws = this.bestWeaponSlot(boss), it = ws >= 0 ? ITEMS[p.inv[ws].id] : null;
      const ranged = it && !(it.use === 'swing' || it.use === 'thrust');
      return ((ranged && has('kite:' + boss.uid)) || has('fight:' + boss.uid) || has('kite:' + boss.uid) || cands[0]).id;
    }
    const life = p.life / p.lifeMax;
    if (has('heal') && life < 0.5) return 'heal';
    if (foes.length && (dist(foes[0].cx, foes[0].cy, p.cx, p.cy) < 200 || this.fightOdds(foes[0]).ok)) {
      const n = foes[0], odds = this.fightOdds(n), d = dist(n.cx, n.cy, p.cx, p.cy);
      const fled = (this.fledFrom && this.fledFrom[n.uid]) || 0;
      const flying = n.def.noGravity || ['flyer', 'bat', 'smiler'].includes(n.def.ai);
      if (odds.ok || d < 50 || fled >= 2) { const c = (flying && has('kite:' + n.uid)) || has('fight:' + n.uid) || has('kite:' + n.uid); if (c) return c.id; }
      if (has('flee') && d < 200) { (this.fledFrom = this.fledFrom || {})[n.uid] = fled + 1; return 'flee'; }   // far away: carry on, don't run from shadows
      const any = cands.find(c => c.kind === 'fight' || c.kind === 'kite'); if (any) return any.id;
    }
    // resume a committed long trip (Ohio, a boss, the Brainrot) after a fight instead of re-planning from scratch
    const parkedTrip = this.parked && Object.keys(this.parked).find(id => /^(hell|boss:|brainrot)/.test(id) && has(id) && !this.parked[id].task.done);
    if (parkedTrip && life >= 0.6) return parkedTrip;
    if (life < 0.6 && has('rest')) return 'rest';
    if (life < 0.6 && has('home')) return 'home';              // don't sit around hurt in a cave: heal at the house
    // an aura crystal close by is always worth the detour (+20 max life for a few hundred ticks): grab the ones we pass on the
    // way, instead of only once the plan reaches "more max life" (that used to be after The 67, walking past crystals all along)
    const cr = has('crystal');
    if (cr && cr.dist <= 40 && life >= 0.6) return 'crystal';
    const plan = this.plan || this.planFrontier(cands);
    const nightBoss = plan.boss && BOSS_SUMMON[plan.boss] && BOSS_SUMMON[plan.boss].night && plan.label.startsWith('fight');
    // concrete on-plan actions beat wandering: explore only when nothing on the plan is actionable
    let on = cands.filter(c => plan.test(c));
    // night only matters on the surface: mining, crystals and crafting at the base carry on (underground spawns don't change at night)
    const nightWork = on.some(c => ['ore', 'stone', 'crystal', 'craft', 'boss', 'brainrot'].includes(c.kind));
    if (has('shelter') && !nightBoss && !nightWork) return 'shelter';
    if (nightWork && G.isNight()) on = on.filter(c => !['chop', 'build', 'explore'].includes(c.kind));
    if (on.some(c => c.id !== 'explore')) on = on.filter(c => c.id !== 'explore');
    if (on.length) return on.sort((a, b) => (b.ready == null ? 1 : b.ready) - (a.ready == null ? 1 : a.ready) || (a.dist || 0) - (b.dist || 0))[0].id;
    if (has('chop') && this.count('wood') < 60) return 'chop';
    return (has('explore') || cands[cands.length - 1]).id;
  },
});
