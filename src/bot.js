// ---------- BotSigma: a playtest bot that plays with the same inputs a human uses ----------
// It only touches Input (held keys, mouse position, clicks, key presses). It never teleports or edits the
// world directly. Knowledge of the map (where trees/ores/altars are) is read from the world, like a player
// with a good memory of the minimap. Run with index.html?bot (optionally &turbo=16), or press F8 in-game.
const Bot = {
  active: false, turbo: 8, wantsDraw: false, t: 0, logLines: [], milestones: {}, stuck: 0, lastPos: null,
  task: null, goal: '', plan: [], base: null, deaths: 0, errors: 0,

  // ================= control surface (inputs only) =================
  resetInputs() {
    for (const k of ['a', 'd', ' ', 's', 'Shift']) Input.keys[k] = false;
    Input.mDown = false;
  },
  // Direct walking must not step off a cliff (the game hurts above 25 tiles of fall): A* moves that intend to drop set allowDrop
  hold(k) {
    if ((k === 'a' || k === 'd') && !this.allowDrop) {
      const p = G.player;
      if (this.cliffAhead(k === 'd' ? 1 : -1)) return;   // (also in the air: a hop plus a held key carries us a dozen tiles)
    }
    Input.keys[k] = true;
  },
  // hold a direction in a fight: never closer than 5 tiles to an open end (a hit knocks us ~4 tiles)
  holdSafe(k) { const d = k === 'd' ? 1 : -1, e = this.edgeDist(d); if (e < 12 && e < 6) return; this.hold(k); },
  cliffAhead(dir) {
    // would the body, one tile further along, have nothing to stand on within a safe fall? (partial support from one column is fine)
    const p = G.player, w = G.world;
    const fy = Math.floor((p.y + p.h - 1) / TS);
    const cx = p.cx + dir * 16, c0 = Math.floor((cx - 9) / TS), c1 = Math.floor((cx + 9) / TS);
    for (let x = c0; x <= c1; x++) {
      for (let y = fy + 1; y <= fy + 14; y++) { const t = w.tile(x, y); if ((t && TILES[t].solid) || t === T.PLATFORM || (w.liq(x, y) > 100 && w.ltype[w.idx(x, y)] === 0)) return false; if (w.liq(x, y) > 20 && w.ltype[w.idx(x, y)] === 1) return true; /* lava is a cliff */ }
    }
    return true;
  },
  // the game only jumps on a fresh key press (jumpHeld): after landing the key must be up for one tick or a held ' ' never jumps again
  jump() { const p = G.player; if (p.onGround && p.jumpHeld) return; Input.keys[' '] = true; },
  // key times in game time (ms at 60 fps), not wall-clock: the 6-7 emote checks how close two presses were, and at turbo speed
  // real time would make the game depend on how fast the machine is (non-reproducible runs)
  press(k) { if (!Input.keys[k]) { Input.pressed[k] = true; Input.lastKeyTime[k] = G.tick * 1000 / 60; } },
  aimWorld(x, y) { Input.mx = x - G.camX; Input.my = y - G.camY; },
  aimTile(tx, ty) { this.aimWorld(tx * TS + 8, ty * TS + 8); },
  clickHold() { Input.mDown = true; if (!this.wasDown) Input.mClick = true; },
  clickOnce() { Input.mDown = true; Input.mClick = true; },
  uiClick(x, y, right) { Input.mx = x; Input.my = y; if (right) Input.rClick = true; else { Input.mClick = true; Input.mDown = true; } this.wantsDraw = true; },
  rightClickWorld(tx, ty) { this.aimTile(tx, ty); Input.rClick = true; },
  selectSlot(i) { if (i >= 0 && i < 10) { (this.slotUsed = this.slotUsed || [])[i] = G.tick; if (G.player.sel !== i) this.press(String((i + 1) % 10)); } },

  log(msg) {
    const w = G.world, line = '[' + (G.clockString ? G.clockString() : '') + ' d' + (w ? w.day : 0) + '] ' + msg;
    this.logLines.push(line); if (this.logLines.length > 400) this.logLines.shift();
    if (this.verbose) console.log('BOT ' + line);
  },
  milestone(name) { if (!this.milestones[name]) { this.milestones[name] = G.tick; this.log('MILESTONE: ' + name); G.chat('[bot] milestone: ' + name, '#9aff9a'); } },

  start(turbo) {
    this.instantDone = 0; this.taskAge = 1; this.restTicks = 0; this.resting = false; this.fleeing = false;
    this.active = true; this.turbo = turbo || this.turbo; this.task = null; this.plan = []; this.stuck = 0;
    this.base = this.base || [G.world.spawnX, G.world.spawnY];
    this.log('BotSigma locked in. turbo ' + this.turbo + 'x');
    G.chat('[bot] BotSigma is playing (F8 stop, F9 speed)', '#9aff9a');
  },
  stop() { this.active = false; this.resetInputs(); G.chat('[bot] stopped', '#9aff9a'); },

  // ================= helpers: inventory / world knowledge =================
  p() { return G.player; },
  count(id) { const p = this.p(); return invCount(p.inv, id) + (p.mouseItem && p.mouseItem.id === id ? p.mouseItem.count : 0); },
  has(id, n = 1) { return this.count(id) >= n; },
  slotOf(pred) { return this.p().inv.findIndex(s => s && pred(ITEMS[s.id], s)); },
  bestSlot(key) { let bi = -1, bv = 0; this.p().inv.forEach((s, i) => { const v = s && ITEMS[s.id][key]; if (v && v > bv) { bv = v; bi = i; } }); return bi; },
  bestWeaponSlot(enemy) {
    let bi = -1, bv = 0;
    const def = enemy ? (enemy.def && enemy.def.defense || enemy.defense || 0) : 0;
    this.p().inv.forEach((s, i) => {
      if (!s) return; const it = ITEMS[s.id];
      if (!it.damage || it.ammoType || it.consumable || it.pick || it.axe || it.hammer) return;
      if (it.ammo && this.p().findAmmo(it.ammo) < 0) return;
      if (it.mana && this.p().mana < it.mana) return;
      // damage that actually lands (defense soaks half of it), per second
      let dmg = it.damage;
      if (it.ammo) dmg += ITEMS[this.p().inv[this.p().findAmmo(it.ammo)].id].damage || 0;
      const melee = (it.use === 'swing' || it.use === 'thrust') && !it.shoot;   // a sword that fires a projectile (The 67) reaches like a gun
      // a plain sword can't reach something hovering well above us
      const high = enemy && enemy.cy < this.p().cy - 90 && (enemy.noGravity || (enemy.def && enemy.def.noGravity) || enemy.boss);
      // expected damage that lands: measured hit rates are ~0.9 for swings / The 67 and ~0.4 for arrows and throws on a moving boss.
      // The 67: 20% of its hits land as exactly 67, ignoring defense
      const landed = expectedHit(Object.assign({}, it, { damage: dmg }), def);
      const v = landed * 60 / (it.useAnim || it.useTime) * (melee ? (high ? 0.12 : 0.9) : it.sixSeven ? 0.9 : 0.4) + (melee ? 2 : 0);
      if (v > bv) { bv = v; bi = i; }
    });
    return bi;
  },
  feet() { const p = this.p(); return [Math.floor(p.cx / TS), Math.floor((p.y + p.h - 1) / TS)]; },
  nearestTile(pred, radiusX, radiusY, from) {
    const w = G.world, [fx, fy] = from || this.feet();
    let best = null, bd = 1e9;
    for (let y = Math.max(1, fy - radiusY); y < Math.min(w.h - 1, fy + radiusY); y++) for (let x = Math.max(1, fx - radiusX); x < Math.min(w.w - 1, fx + radiusX); x++) {
      if (!pred(w.tile(x, y), x, y)) continue;
      const d = Math.abs(x - fx) + Math.abs(y - fy) * 1.2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  },
  // choose a mining target by estimated effort, not just distance: tunnelling through rock is slow, caves are free, big veins pay off
  pickMineTarget(ok, w, fx, fy, want) {
    const cands = [];
    const scan = (rx, ry) => {
      for (let y = Math.max(1, fy - ry); y < Math.min(w.h - 1, fy + ry); y++) for (let x = Math.max(1, fx - rx); x < Math.min(w.w - 1, fx + rx); x++) {
        const t = w.tile(x, y);
        if (!want(t)) continue;
        const d = Math.abs(x - fx) + Math.abs(y - fy) * 1.2;
        if (cands.length < 14 || d < cands[cands.length - 1].d) {
          if (!ok(t, x, y)) continue;
          cands.push({ x, y, d }); cands.sort((a, b) => a.d - b.d); if (cands.length > 14) cands.pop();
        }
      }
    };
    scan(90, 70);
    if (!cands.length) scan(400, 250);
    if (!cands.length) return null;
    let best = null, bs = Infinity;
    for (const c of cands) {
      // solid cells along the straight line from us to it (what we'd have to dig), and neighbouring ore (vein size)
      let solid = 0; const n = Math.max(Math.abs(c.x - fx), Math.abs(c.y - fy));
      for (let i = 1; i < n; i++) { const x = Math.round(fx + (c.x - fx) * i / n), y = Math.round(fy + (c.y - fy) * i / n); if (w.solid(x, y)) solid++; }
      let vein = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if ((i || j) && want(w.tile(c.x + i, c.y + j))) vein++;
      // ore with lava right above or beside it (hellstone mostly) spills it on us the moment it breaks: last resort only
      let lava = 0; for (let j = -2; j <= 1; j++) for (let i = -1; i <= 1; i++) if (w.liq(c.x + i, c.y + j) > 20 && w.ltype[w.idx(c.x + i, c.y + j)] === 1) lava++;
      const score = c.d + solid * 2.5 - vein * 2 + (lava ? 80 + lava * 10 : 0);
      if (score < bs) { bs = score; best = [c.x, c.y]; }
    }
    return best;
  },
  // the house shell (walls, floor, roof) is never dug; the interior is not protected: a block left in there (a pillar the
  // builder stood on) made the inside of the house impassable for the planner, stations included
  isProtected(x, y) {
    const h = this.houseSpot;
    if (!(h && this.milestones.house)) return false;
    if (!(x >= h[0] && x <= h[0] + 10 && y >= h[1] - 6 && y <= h[1])) return false;
    return x === h[0] || x === h[0] + 10 || y === h[1] - 6 || y === h[1];
  },
  // the yard around the house: digging shafts/pits right beside the walls cuts the house off, so A* pays extra to dig there
  inYard(x, y) {
    const h = this.houseSpot;
    return !!(h && this.milestones.house && x >= h[0] - 12 && x <= h[0] + 22 && y >= h[1] - 12 && y <= h[1] + 10);
  },
  // is there a drop-off within n tiles on either side (the Ohio islands/bridges)? hops and chases are not worth it there
  nearEdge(n) { const p = G.player, w = G.world, fy = Math.floor((p.y + p.h - 1) / TS), fx = Math.floor(p.cx / TS); for (const d of [-1, 1]) for (let k = 0; k <= n; k++) { let ground = false; for (let y = fy + 1; y <= fy + 14 && !ground; y++) if (w.solid(fx + d * k, y)) ground = true; if (!ground) return true; } return false; },
  // standing on something with nothing but air under it (a bridge/island over the Ohio void)
  floating() { const w = G.world, [fx, fy] = this.feet(); for (let j = 2; j <= 10; j++) if (w.solid(fx, fy + j) || w.solid(fx + 1, fy + j)) return false; return true; },
  // tiles of floor left in direction dir from where we stand (stops at the first gap), capped at 12
  // (a step down of 1-2 tiles is still floor: counting it as an edge froze the bot on every bumpy surface fight)
  edgeDist(dir) {
    const w = G.world, [fx, fy] = this.feet(), floor = x => w.solid(x, fy + 1) || w.solid(x, fy + 2) || w.solid(x, fy + 3);
    let n = 0; while (n < 12 && (floor(fx + dir * (n + 1)) || floor(fx + dir * (n + 1) + 1))) n++; return n;
  },
  // enemies spawn up to ~75 tiles beside / ~32 rows above or below us, and any spawn point inside the Backrooms room is a
  // Smiler (flies through rock, 34 damage): mining next to that room got the bot killed by Smilers on the surface
  nearBackrooms(x, y) { const b = G.world.backrooms; return !!b && x > b.x0 - 75 && x < b.x0 + b.w + 75 && y > b.y0 - 34 && y < b.y0 + b.h + 34; },
  // is (x, y) a floor tile we stand on with a deep drop under it? (mining it dropped the bot 36 tiles down a shaft, twice)
  floorOverDrop(x, y) {
    const p = this.p(), w = G.world, fy = Math.floor((p.y + p.h - 1) / TS);
    if (y !== fy + 1 || x < Math.floor(p.x / TS) - 1 || x > Math.floor((p.x + p.w - 1) / TS) + 1) return false;
    let k = 1; while (k < 12 && !w.solid(x, y + k) && w.liq(x, y + k) < 100) k++;
    return k >= 12;
  },
  // can we keep running this way without dropping more than 4 tiles in the next few columns?
  dropAhead(dir, cols = 3) {
    const w = G.world, [fx, fy] = this.feet();
    for (let i = 1; i <= cols; i++) { let ok = false; for (let j = -3; j <= 4; j++) if (w.solid(fx + dir * i, fy + 1 + j) && !w.solid(fx + dir * i, fy + j)) { ok = true; break; } if (!ok) return true; }
    return false;
  },
  nearLava(x, y) { const w = G.world; for (let j = -2; j <= 1; j++) for (let i = -1; i <= 1; i++) if (w.liq(x + i, y + j) > 20 && w.ltype[w.idx(x + i, y + j)] === 1) return true; return false; },

  // ================= main tick =================
  tick() {
    if (!this.active || !G.world) return;
    this.tickMain();
    if (!this.p().dead && !G.inBackrooms(this.p())) { this.closeDoorBehind(); this.noclipGuard(); }
  },
  // a door we walked through stays open (zombies walk in at night): close it behind us like a player would
  closeDoorBehind() {
    const d = this.doorOpened, p = this.p(), w = G.world;
    if (!d || this.uiBusy || UI.invOpen || Input.rClick || Input.mClick || Input.mDown) return;   // (never move the aim of a held swing/dig onto the door)
    if (!TILES[w.tile(d[0], d[1])]?.door) { this.doorOpened = null; return; }
    const dx = Math.abs(p.cx - (d[0] * TS + 8)) / TS;
    if (dx > 6) { this.doorOpened = null; return; }
    if (dx < 1.8 || w.tile(d[0], d[1]) !== T.DOOR_OPEN) return;
    const [ox, oy] = w.objOrigin(d[0], d[1]);
    if (G.npcs.some(n => !n.dead && rectsOverlap({ x: ox * TS, y: oy * TS, w: TS, h: 3 * TS }, n))) return;
    if (!p.inReach(d[0], d[1])) return;
    this.rightClickWorld(d[0], d[1]);
    this.doorOpened = null;
  },
  // the glitch block floats at jump height near spawn (and the house): touching it noclips us into the Backrooms (Smilers,
  // Partygoers, a long walk back). The planner never routes through it, but fight hops, step-up hops and unstick jumps did.
  noclipGuard() {
    const w = G.world, nc = w.noclipAt, p = this.p();
    if (!nc || w.tile(nc[0], nc[1]) !== T.NOCLIP) return;
    const bx0 = nc[0] * TS, bx1 = bx0 + TS, by0 = nc[1] * TS, by1 = by0 + TS, bcx = bx0 + 8;
    if (Math.abs(p.cx - bcx) > 160 || Math.abs(p.cy - (by0 + 8)) > 180) return;
    const awayKey = p.cx < bcx ? 'a' : 'd', towardKey = awayKey === 'a' ? 'd' : 'a';
    const below = by1 <= p.y + 4 && p.y - by1 < 8 * TS;          // it hangs above us within a jump
    // the body's horizontal span now and ~20 ticks ahead at the current speed (a running jump covers 3-4 tiles)
    const span = (dx) => p.x + dx - 6 < bx1 && p.x + p.w + dx + 6 > bx0;
    const ahead = span(0) || span(p.vx * 20) || span(p.vx * 10);
    if (below && ahead) {
      Input.keys[' '] = false;
      if (!p.onGround && p.vy < 0) { Input.keys[towardKey] = false; Input.keys[awayKey] = true; }   // already rising: drift out from under it
      this.why = 'noclip-guard';
    }
    // level with it (on a hill, a pillar): don't walk into it
    if (p.y < by1 + 4 && p.y + p.h > by0 - 4 && Math.abs(p.cx - bcx) < p.w / 2 + 8 + Math.max(10, Math.abs(p.vx) * 10)) { Input.keys[towardKey] = false; this.why = 'noclip-guard'; }
  },
  tickMain() {
    const p = this.p();
    this.t++;
    TerraJev.tickLogging();
    this.wasDown = Input.mDown;
    this.allowDrop = false;
    this.resetInputs();
    if (Input.typing) Input.typing = null;
    if (!UI.invOpen && !this.uiBusy) UI.mouseOverUI = false; // the flag is only refreshed on draw, which turbo skips
    this.why = '';
    if (p.dead) { this.task = null; this.nav = null; this.plan = []; if (!this.deadLogged) { this.deaths++; (this.deathLog = this.deathLog || []).push(G.tick + ' ' + G.clockString() + ' ' + G.deathCause);
      this.registerDeath(G.deathCause); this.log('died of ' + G.deathCause + ' at ' + this.feet() + ' depth ' + (this.feet()[1] - G.world.worldSurface) + ' lifeMax ' + p.lifeMax + ' def ' + p.calc.defense + ' near: ' + G.npcs.filter(n => !n.friendly && !n.town && dist(n.cx, n.cy, p.cx, p.cy) < 400).map(n => n.name).slice(0, 5).join(',') + ' task: ' + (this.lastGoal || this.goal)); this.deadLogged = true; } return; }
    this.deadLogged = false;
    if (this.prevLife && p.life < this.prevLife) this.hurtAt = G.tick;
    TerraJev.recentHurt = (TerraJev.recentHurt || 0) * 0.99 + Math.max(0, (this.prevLife || p.life) - p.life);
    this.prevLife = p.life;
    // close menus the bot didn't open
    if (UI.talk) UI.closeTalk();
    if (G.victory) G.victory = null;
    // stuck detection
    const pos = Math.round(p.x) + ',' + Math.round(p.y);
    if (pos === this.lastPos && !UI.invOpen && !(p.itemAnim > 0)) this.stuck++; else this.stuck = Math.max(0, this.stuck - 2);
    this.lastPos = pos;
    // stall detector: hardly moved for 3000 ticks (and not deliberately waiting) = something the planner doesn't understand; brute-force out of it
    const an = this.anchor;
    // standing still on purpose (hiding at night, resting) must not count toward the stall detector or the task watchdog:
    // both used to fire at dawn after a night in the house and brute-forced the bot out of a perfectly good task
    const idle = /^(hiding|resting|waiting)/.test(this.goal || '');
    if (idle) { this.progAt = G.tick; }
    if (!an || idle || Math.abs(p.x - an.x) > 48 || Math.abs(p.y - an.y) > 48) this.anchor = { x: p.x, y: p.y, t: G.tick };
    else if (G.tick - an.t > 3000 && !/^(hiding|resting|waiting)/.test(this.goal || '') && !(this.onPerch() && G.npcs.some(n => n.boss)) && !(this.unstick && this.unstick.until > G.tick)) {
      const [sx, sy] = this.feet();
      this.log('stalled 3000 ticks at ' + sx + ',' + sy + ' (' + this.goal + '): brute-force unstick, clearing bans/cooldowns');
      this.unstick = { until: G.tick + 500, dir: Math.random() < 0.5 ? -1 : 1 };
      this.cooldowns = {}; Nav.bans.clear(); this.badTiles = new Set(); this.avoidZone = null; this.task = null; this.nav = null; this.hb = null; this.uiBusy = false;
      this.anchor = { x: p.x, y: p.y, t: G.tick };
      this.stalls = (this.stalls || 0) + 1;
    }
    if (this.unstick && this.unstick.until > G.tick && !UI.invOpen) { this.bruteForce(); return; }
    // survival reflexes
    // long fall in progress (the game hurts above 25 tiles): drop a block right under our feet; it lands us and resets the fall
    if (!p.onGround && p.vy > 4 && p.fallStart != null && (p.y - p.fallStart) / TS > 14 && !UI.invOpen) {
      const w = G.world, fy2 = Math.floor((p.y + p.h) / TS);
      // a deadly fall outranks the reservation: use any block
      let bs = this.spareBlockSlot(false); if (bs < 0) bs = this.slotOf(it => ['dirt_block', 'stone_block', 'clay_block', 'mud_block', 'sand_block', 'ash_block'].includes(it.id));
      if (bs >= 0 && bs <= 9) {
        const col = Math.floor(p.cx / TS);
        for (const cy of [fy2 + 1, fy2 + 2]) {
          if (w.tile(col, cy) === 0 && (w.solid(col - 1, cy) || w.solid(col + 1, cy) || w.solid(col, cy + 1) || w.solid(col, cy - 1))) { this.selectSlot(bs); this.aimTile(col, cy); if (p.itemAnim === 0) this.clickOnce(); this.why = 'catch-fall'; break; }
        }
      }
    }
    if (p.life < p.lifeMax * 0.4 && !p.buffs.potion_sickness && p.inv.some(s => s && ITEMS[s.id].heal && ITEMS[s.id].potion)) this.press('h');
    if (p.lavaWet || p.buffs.on_fire) { this.jump(); }
    if (p.breath < 80) this.jump();
    // finish an in-progress hotbar move before doing anything else (it's a multi-click UI action)
    if (this.hb) { this.why = 'hotbar'; this.ensureHotbar(this.hb.from, this.hb.to); return; }
    // never leave the inventory open with something on the cursor (clicking the world would throw it)
    if (UI.invOpen && !this.uiBusy) {
      this.why = 'close-inventory';
      if (p.mouseItem) { const e = p.inv.findIndex((s, k) => k >= 10 && !s); const [x, y] = this.slotPos(e >= 0 ? e : 49); this.uiClick(x, y); return; }
      this.press('Escape'); return;
    }
    // lost in Level 0? head for the EXIT sign
    if (G.inBackrooms(p) && !this.uiBusy) {
      const ex = this.nearestTile(t => t === T.EXIT_SIGN, 200, 60);
      const enemy = this.findEnemy();
      if (enemy && dist(enemy.cx, enemy.cy, p.cx, p.cy) < 120) { this.combat(enemy, false); return; }
      if (ex) { this.goal = 'escaping the Backrooms (EXIT sign)'; if (this.moveTo(ex[0], ex[1], 0) === 'fail') this.stuck = 0; return; }
    }
    // pick what to do
    if (!this.uiBusy) {
      const wall = G.npcs.find(n => n.type === 'wall_of_flesh' && !n.dead);
      if (wall) { this.why = 'wall'; this.wallFight(wall); return; }
      if (this.needDecision()) this.decideAct();
    }
    // watchdog: abandon tasks that make no progress (no movement, no inventory change)
    const sig = Math.round(p.x / 48) + ',' + Math.round(p.y / 48) + '|' + p.inv.reduce((n, s) => n + (s ? s.count : 0), 0);
    if (sig !== this.progSig) { this.progSig = sig; this.progAt = G.tick; }
    if (this.task && G.tick - this.progAt > 2400 && !/^(hiding|resting|waiting|going down to Ohio)/.test(this.goal || '') && !(this.act && this.act.kind === 'hell' && G.tick - this.progAt < 9000)) {   // the Ohio trip has its own failure handling   // standing still is the point of these
      this.log('watchdog: abandoning "' + this.goal + '" (no progress)');
      this.cooldowns = this.cooldowns || {}; this.cooldowns[this.lastTaskId || this.goal] = G.tick + 3600;
      this.task = null; this.nav = null; this.progAt = G.tick; this.watchdogs = (this.watchdogs || 0) + 1;
      this.setAct({ id: 'explore', kind: 'explore' }, this.taskExplore(), []);
    }
    if (!this.task || this.task.done) this.decideAct();
    this.why = 'task:' + this.goal; this.lastGoal = this.goal;
    if (this.task) {
      try { this.task.step(); } catch (e) { this.errors++; this.log('task error ' + e.message); this.task = null; }
      // a task that is already finished the tick it was picked means the planner and the task disagree: don't spin on it
      if (this.task && this.task.done && this.taskAge === 0) {
        if (++this.instantDone > 8) {
          this.instantDone = 0;
          const key = this.goal.split(' ').slice(0, 2).join(' ');
          this.log('task loop on "' + this.goal + '": cooling it down');
          this.cooldowns = this.cooldowns || {}; this.cooldowns[key] = G.tick + 3600;
          this.setAct({ id: 'explore', kind: 'explore' }, this.taskExplore(), []);
        }
      } else if (this.task && !this.task.done) this.instantDone = 0;
      if (this.task) this.taskAge++;
    }
  },

  // ================= TerraJev: ONE question — "given what the SDK sees, what do you do?" =================
  // Every candidate is a concrete action a skill can carry out right now: fight THIS enemy, mine THAT ore, craft X,
  // summon boss Y, go home... The skills own the details (weapon, hotbar, aiming, dodging, pathing, digging);
  // housekeeping (equipping upgrades, clearing junk) is a reflex, not a decision.
  // weak hoppers (green/blue slimes: a few life per hit) come to us on their own; chasing every one across the map ate a third of
  // day 1. They count as foes only once they are close.
  biting(n) { const p = this.p(); return dist(n.cx, n.cy, p.cx, p.cy) < 56 && G.tick - (this.hurtAt || -1e9) < 90; },
  nuisance(n) { const p = this.p(); return !n.boss && n.def.ai === 'slime' && Math.max(1, n.damage - p.calc.defense * 0.5) <= p.lifeMax * 0.1; },
  foesNear() {
    const p = this.p(); this.ignore = this.ignore || {};
    // an 'unreachable' enemy that is right on top of us while we're getting hurt is reachable after all (ignoring it let it
    // chew on us); one that merely sits close (a slime in a hole under the floor) stays ignored
    return G.npcs.filter(n => !n.friendly && !n.town && !n.dead && n.alpha >= 0.5 && !n.def.critter && !(this.ignore[n.uid] > G.tick && !this.biting(n)) &&
      !(this.nuisance(n) && dist(n.cx, n.cy, p.cx, p.cy) > 80) &&
      (n.boss ? dist(n.cx, n.cy, p.cx, p.cy) < 900 : dist(n.cx, n.cy, p.cx, p.cy) < 300 && lineOfSight(G.world, p.cx, p.cy, n.cx, n.cy)))
      .sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || dist(a.cx, a.cy, p.cx, p.cy) - dist(b.cx, b.cy, p.cx, p.cy)).slice(0, 4);
  },
  // re-ask when the action ends, a new enemy shows up, after a big hit, every second in combat, every 30 s otherwise
  needDecision() {
    const A = this.act, p = this.p();
    if (!A || !this.task || this.task.done) return true;
    if (this.foesNear().some(n => !A.seen.has(n.uid))) return true;
    if (p.life < A.life - p.lifeMax * 0.15) return true;
    if (['hell', 'boss', 'brainrot'].includes(A.kind)) return false;   // long trips stay committed (enemies and big hits still interrupt above)
    // an aura crystal comes within 30 tiles while we're busy with something else: think again (teacherPick grabs it)
    // (once per crystal: a re-decision restarts the current task, so it must not fire again while we can't or won't go)
    if (A.kind !== 'crystal' && G.tick % 60 === 0 && p.lifeMax < 400 && p.life >= p.lifeMax * 0.6 && !(this.cooldowns && this.cooldowns.crystal > G.tick)) {
      const c = this.findCrystal(), [fx, fy] = this.feet();
      if (c && Math.abs(c[0] - fx) + Math.abs(c[1] - fy) <= 30 && this.crystalPinged !== c[0] + ',' + c[1]) { this.crystalPinged = c[0] + ',' + c[1]; return true; }
    }
    return G.tick - A.at >= (ACT_COMBAT.includes(A.kind) ? 60 : 1800);
  },
  decideAct() {
    const p = this.p(), foes = this.foesNear();
    this.uiBusy = false;
    if (this.houseValid() && this.houseFinished) this.milestone('house');
    // reflexes: nothing to decide about these
    if (!foes.length) {
      const up = this.equipUpgrade();
      if (up) { this.setAct({ id: 'equip:' + up, kind: 'reflex' }, this.taskEquip(up), foes); return; }
      // a crafting station sitting in the inventory (its placing got interrupted by a fight) goes up at the base right away
      const cd = this.cooldowns = this.cooldowns || {};
      if (this.base && this.houseSpot) for (const [st, item] of [['furnace', 'furnace'], ['anvil', 'iron_anvil']]) {
        if (!this.has(item) || this.stationPlaced(st) || cd['place:' + item] > G.tick) continue;
        cd['place:' + item] = G.tick + 1500;
        this.setAct({ id: 'place:' + item, kind: 'reflex' }, this.taskCraftAtBase([item, 0, 'placeonly']), foes); return;
      }
      // wood runs everything (house, platforms, arenas, perches): by day on the surface, top it up before it runs out
      if (this.houseFinished && !G.isNight() && this.count('wood') - this.reserved('wood') < 50 && this.feet()[1] < G.world.worldSurface + 5 && !(cd.wood > G.tick)) {
        cd.wood = G.tick + 6000;
        this.setAct({ id: 'chop:stock', kind: 'reflex' }, this.taskChop(this.count('wood') + 70), foes); return;
      }
      // keep ~30 wood platforms on hand (15 wood, crafted by hand on the spot): pillars, arenas, perches
      if (this.houseFinished && this.count('wood_platform') < 12 && this.count('wood') - this.reserved('wood') >= 25 && !(cd.plat > G.tick)) {
        cd.plat = G.tick + 3000;
        this.setAct({ id: 'craft:platforms', kind: 'reflex' }, this.taskCraftAtBase(['wood_platform', 15]), foes); return;
      }
      const kit = this.earlyWeaponTask();
      if (kit) { this.setAct({ id: 'kit:iron_broadsword', kind: 'reflex' }, kit, foes); return; }
      if (p.inv.slice(10).filter(s => !s).length < 4 && !(this.cooldowns && this.cooldowns.trash > G.tick)) { (this.cooldowns = this.cooldowns || {}).trash = G.tick + 1800; this.setAct({ id: 'trash', kind: 'reflex' }, this.taskTrash(), foes); return; }
    }
    const forced = this.survivalReflex(foes);
    if (forced === 'flee' && (!this.act || this.act.id !== 'flee')) { this.log('reflex: low life, retreating home'); this.setAct({ id: 'flee', kind: 'flee' }, this.skillFlee(), foes); return; }
    if (forced && this.act && this.act.id === forced) return;
    const cands = this.actionCandidates(foes);
    this.plan = this.planFrontier(cands);
    const state = jevStateFeatures(this, foes[0] || null);
    const cur = this.act && this.task && !this.task.done ? this.act.id : null;
    const teacher = this.teacherPick(cands, foes);
    TerraJev.closeWindows();
    const ans = TerraJev.decide({ id: 'act', state, teacher, candidates: cands.map(c => ({ id: c.id, group: c.kind, features: jevActFeatures(this, c, cur) })) });
    const pick = cands[ans.idx];
    this.choiceSrc = ans.src;
    // same action as now: keep its progress. An interrupted task is parked and resumed if it's picked again soon.
    if (pick.id === cur) { this.act.at = G.tick; this.act.life = p.life; this.act.probs = ans.probabilities; foes.forEach(n => this.act.seen.add(n.uid)); return; }
    if (cur && this.task && !this.task.done && !ACT_COMBAT.includes(this.act.kind)) (this.parked = this.parked || {})[cur] = { task: this.task, at: G.tick };
    const parked = this.parked && this.parked[pick.id];
    let task = parked && !parked.task.done && G.tick - parked.at < 3000 ? parked.task : null;
    if (this.parked) delete this.parked[pick.id];
    if (!task) { if (pick.item) this.commit(pick.item, pick.qty || 1); task = pick.make(); }
    (this.taskHist = this.taskHist || {})[pick.id] = G.tick;
    this.lastTaskId = pick.id;
    this.setAct(pick, task || this.taskExplore(), foes, ans.probabilities);
  },
  // The starting shortsword lands 1-2 damage on armored early mobs (zombies, Skibidi Toilets: 0.25 kills per fight in
  // tests/mobfight.js, with ~95 damage taken). Once the anvil stands, 24 iron ore buy an iron broadsword (all fights won,
  // half the time): a reflex, done before the plan's next item, as long as nothing better is in the bag.
  earlyWeaponTask() {
    const cd = this.cooldowns = this.cooldowns || {}, p = this.p();
    if (cd.kit > G.tick || !this.houseFinished || !this.base || p.life < p.lifeMax * 0.6 || !this.stationPlaced('anvil')) return null;
    const best = Math.max(0, ...p.inv.map(s => { const it = s && ITEMS[s.id]; return it && it.damage && !it.ammoType && !it.consumable && !it.pick && !it.axe && !it.hammer ? (it.sixSeven ? 67 : it.damage) : 0; }));
    if (best >= 10 || this.owns('iron_broadsword')) return null;
    const step = this.resolve('iron_broadsword', 1);
    if (!step || !this.stepFeasible(step, SDK.obs().inv.pick.power)) return null;
    cd.kit = G.tick + 300;
    this.commit('iron_broadsword', 1);
    return this.taskForStep(step);
  },
  setAct(c, task, foes, probs) {
    this.act = { id: c.id, kind: c.kind, at: G.tick, life: this.p().life, probs: probs || null, seen: new Set(foes.map(n => n.uid)) };
    this.task = task; this.nav = null; this.taskAge = 0;
  },
  actionCandidates(foes) {
    const p = this.p(), out = [];
    const potions = p.inv.some(s => s && ITEMS[s.id].heal && ITEMS[s.id].potion) && !p.buffs.potion_sickness;
    const ranged = this.rangedSlot() >= 0;
    const boss = foes.find(n => n.boss);
    const [fx0, fy0] = this.feet(), canFlee = this.base && !boss && Math.abs(fx0 - this.base[0]) + Math.abs(fy0 - this.base[1]) > 6;
    for (const n of foes) {
      // the combat simulator gates fights: only winnable ones are offered (unless it's a boss, we're cornered, or can't run)
      const odds = this.fightOdds(n), close = dist(n.cx, n.cy, p.cx, p.cy) < 50;
      if (!(odds.ok || n.boss || close || !canFlee || (this.fledFrom && this.fledFrom[n.uid] >= 2))) continue;
      out.push({ id: 'fight:' + n.uid, kind: 'fight', enemy: n, odds: odds.margin, make: () => this.skillFight(n, false) });
      if (ranged) out.push({ id: 'kite:' + n.uid, kind: 'kite', enemy: n, odds: odds.margin, make: () => this.skillFight(n, true) });
    }
    if (potions && p.life < p.lifeMax * 0.7) out.push({ id: 'heal', kind: 'heal', make: () => this.skillHeal() });
    if (boss) return out;   // a boss fight is not the time to chop trees
    const [fx, fy] = this.feet(), home = this.base;
    const dHome = home ? Math.abs(fx - home[0]) + Math.abs(fy - home[1]) : 0;
    if (foes.length && home && dHome > 6) out.push({ id: 'flee', kind: 'flee', dist: dHome, make: () => this.skillFlee() });
    if (!foes.length && p.life < p.lifeMax * 0.9 && (!home || dHome < 15)) out.push({ id: 'rest', kind: 'rest', make: () => this.skillRest() });   // rest at home only
    if (G.isNight() && this.houseValid() && fy < G.world.worldSurface + 5 && home && !(this.hell && this.hell.ph && this.hell.ph !== 'prep')) out.push({ id: 'shelter', kind: 'shelter', dist: dHome, make: () => this.skillShelter() });
    return out.concat(this.taskCandidates());
  },
  rangedSlot() {
    const p = this.p(); let bi = -1, bv = 0;
    // anything that hits from a distance (bows, throws, and swords that fire a projectile), ranked by damage that lands
    p.inv.forEach((s, i) => { if (!s) return; const it = ITEMS[s.id]; if (!it.damage || it.ammoType || it.consumable || it.pick || it.axe || it.hammer) return; if (!(it.use === 'shoot' || it.shoot)) return; if (it.ammo && p.findAmmo(it.ammo) < 0) return; if (it.mana && p.mana < it.mana) return;
      const v = (it.sixSeven ? expectedHit(it) * 0.9 : it.damage * 0.4) * 60 / (it.useAnim || it.useTime); if (v > bv) { bv = v; bi = i; } });
    return bi;
  },

  // ================= combat skills =================
  skillFight(n, kite) {
    const self = this;
    return { step() {
      const p = self.p();
      if (n.dead || !G.npcs.includes(n) || dist(n.cx, n.cy, p.cx, p.cy) > (n.boss ? 1400 : 600) || (self.ignore[n.uid] > G.tick && !self.biting(n))) { this.done = true; return; }
      self.combat(n, kite);
    } };
  },
  combat(n, kite) {
    const p = this.p();
    // give up on enemies we can't actually reach/hurt (stuck behind walls, hopping away forever)
    this.fights = this.fights || {}; this.ignore = this.ignore || {};
    const f = this.fights[n.uid] || (this.fights[n.uid] = { since: G.tick, life: n.life });
    if (n.life < f.life) { f.life = n.life; f.since = G.tick; }
    if (G.tick - f.since > (n.boss ? 3600 : 480)) { this.ignore[n.uid] = G.tick + 3600; delete this.fights[n.uid]; this.log('ignoring ' + n.name + ' (unreachable)'); return; }
    if (G.tick % 600 === 0) for (const k in this.fights) if (!G.npcs.some(m => m.uid == k)) delete this.fights[k];
    // weapon: the skill picks it (best damage that lands; ranged when kiting)
    let ws = kite ? this.rangedSlot() : -1;
    if (ws < 0) ws = this.bestWeaponSlot(n);
    if (ws < 0) return;
    if (ws > 9) { this.ensureHotbar(ws); return; }
    this.selectSlot(ws);
    const it = ITEMS[p.inv[ws].id], melee = (it.use === 'swing' || it.use === 'thrust') && !it.shoot;
    const dx = n.cx - p.cx, dy = n.cy - p.cy, d = Math.hypot(dx, dy), toward = dx > 0 ? 'd' : 'a', away = dx > 0 ? 'a' : 'd';
    const tile = () => this.moveTo(Math.floor(n.cx / TS), Math.floor((n.y + n.h - 1) / TS), 1);
    // on our arena strip or Tung's perch, small fry is shot from where we stand: chasing it walks us off the edge
    const anchored = !melee && n.type !== 'eye_of_cthulhu' && n.type !== 'tung_sahur' && (this.onArena() || this.onPerch());
    if (anchored) this.why = 'anchored';
    else if (n.type === 'tung_sahur' && !melee) this.tungDance(n, dx, d, toward, away);
    else if (n.type === 'eye_of_cthulhu' && !melee && !this.noEyeDance) this.eyeDance(n);
    else if (melee) {
      if (n.boss && Math.abs(dx) < 40 && Math.abs(dy) < 60) this.holdSafe(G.tick % 160 < 80 ? away : toward);   // don't stand inside a boss
      else if (Math.abs(dx) > 26 || Math.abs(dy) > 50) { if (Math.abs(dy) > 90 || this.stuck > 20 || d > 260) tile(); else this.holdSafe(toward); }
      if (dy < -30 && Math.abs(dx) < 140) this.jump();
    } else {
      const want = kite ? 230 : 170;
      if (d < want - 70) this.holdSafe(away);
      else if (d > want + 200 || !lineOfSight(G.world, p.cx, p.cy, n.cx, n.cy)) { if (d > 400 || this.stuck > 20) tile(); else this.holdSafe(toward); }
      if (n.boss && (G.tick % 90 < 12 || G.projectiles.some(q => q.hostile && !q.dead && dist(q.cx, q.cy, p.cx, p.cy) < 120))) this.jump();
    }
    if (p.collidedX && p.onGround && !(this.perch && /^(tung-(perch|ledge)|eye-dodge|anchored)/.test(this.why))) this.jump();   // never hop the perch fence
    // aim (lead moving targets with projectiles) and attack when it can land
    let ax = n.cx, ay = n.cy;
    if (!melee && it.use !== 'throw') { const sp = it.shootSpeed || 8, t = Math.min(45, d / sp); ax += (n.vx || 0) * t; ay += (n.vy || 0) * t - d * 0.015; }
    this.aimWorld(ax, ay);
    if (melee ? d < 90 : d < 520) { if (it.autoReuse) this.clickHold(); else if (p.itemAnim === 0) this.clickOnce(); }
    this.goal = (kite ? 'kiting ' : 'fighting ') + n.name;
  },
  // Tung Tung Tung Sahur only hurts up close (bat swing, 45) or with ground shockwaves after a leap and lobbed logs:
  // keep 220-340 px away shooting The 67's homing 6s and 7s, hop every shockwave, keep moving while logs are in the air,
  // and when cornered slip under it while it is in the air
  tungDance(n, dx, d, toward, away) {
    const p = this.p(), adx = Math.abs(dx), dirAway = away === 'd' ? 1 : -1;
    if (this.onPerch()) { this.why = 'tung-perch'; return; }   // out of reach: stand still and shoot
    // knocked along the ledge / back onto the pillar top: walk back out to the spot
    if (this.perch && p.onGround) {
      const pr = this.perch, [fx, fy] = this.feet(), [sx] = this.perchSpot();
      if (Math.abs(fy - pr[1]) <= 1 && (fx - pr[0]) * pr[3] >= 0 && (sx - fx) * pr[3] > 0) { this.hold(pr[3] > 0 ? 'd' : 'a'); this.why = 'tung-ledge'; return; }
    }
    const wave = G.projectiles.find(q => q.type === 'tung_wave' && !q.dead && Math.abs(q.cx - p.cx) < 110 && Math.sign(q.vx) === Math.sign(p.cx - q.cx));
    const log = G.projectiles.some(q => q.type === 'tung_log' && !q.dead && Math.abs(q.cx - p.cx) < 120);
    const cornered = this.dropAhead(dirAway) || (p.collidedX && p.onGround && this.lastDanceKey === away);
    let key;
    if (cornered && !n.onGround && n.state === 'leap') key = toward;          // run under it while it flies over
    else if (cornered) key = adx > 160 ? null : toward;                         // back to the wall: hold, then slip past
    else if (adx < 220 || n.state === 'leap' || n.state === 'swing') key = away;
    else if (adx > 340) key = toward;
    else if (log) key = G.tick % 80 < 40 ? away : toward;
    if (key && !(key === toward && this.dropAhead(-dirAway))) { this.hold(key); this.lastDanceKey = key; }
    if (wave || (adx < 120 && n.state === 'swing')) this.jump();
    this.why = 'tung-dance';
  },
  // The Eye of Ohio's dash is ballistic, and the next one aims at wherever we stand when it starts (7-10 px/tick; running takes
  // ~40 ticks to reach 3 px/tick, so a late sidestep never works). So, like a player who knows the pattern: every 4 ticks try
  // 45 short plans (run left/right/stand still, maybe turn around after 12 or 30 ticks, maybe jump after 0/8/16/26 ticks)
  // 100 ticks ahead against a copy of its AI on flat ground, and follow the one that stays clear by the widest margin.
  // An offline model of exactly this (tools/jev/eyesim.py) took plain strafing from ~5 (phase 1) / ~10 (phase 2) contact
  // hits per 1000 ticks to 0, on arenas from 20 to 56 tiles wide.
  EYE_PLANS: (() => { const o = []; for (const d of [-1, 1, 0]) for (const s of [999, 12, 30]) for (const j of [-1, 0, 8, 16, 26]) o.push([d, s, j]); return o; })(),
  eyeDance(n) {
    const p = this.p(), [fx, fy] = this.feet();
    let A = this.eyeArena;
    // on (or jumping over) the arena strip: its floor and ends; knocked off it: the ground here, +-28 tiles
    const ar = this.arena && fx >= this.arena.x0 - 4 && fx <= this.arena.x1 + 4 && fy <= this.arena.floor - 1 ? this.arena : null;
    if (A && A.uid === n.uid && !!A.onArena !== !!ar) A = null;
    if (!A || A.uid !== n.uid) {
      A = this.eyeArena = ar ? { uid: n.uid, x0: ar.x0 * TS, x1: ar.x1 * TS, floor: ar.floor * TS } : { uid: n.uid, x0: (fx - 28) * TS, x1: (fx + 28) * TS, floor: null };
      A.dir = 1; A.plan = null; A.onArena = !!ar;
    }
    if (p.onGround && !A.onArena) A.floor = p.y + p.h;   // uneven ground: the model's floor is where we last stood
    if (!A.plan || A.t >= 4) {
      const floor = A.floor != null ? A.floor : p.y + p.h;
      let best = null;
      for (const pl of this.EYE_PLANS) {
        const r = this.eyeSim(p, n, pl, 100, floor, A.x0, A.x1 + TS);   // the arena's ends are walls in the model
        const sc = r.sep - (pl[2] >= 0 ? 0.5 : 0) - (pl[0] !== A.dir ? 1 : 0) - (pl[1] !== 999 ? 0.3 : 0);
        if (!best || sc > best.sc) best = { sc, pl };
      }
      A.plan = best.pl; A.t = 0;
      if (best.pl[0]) A.dir = best.pl[0];
    }
    const [d1, sAt, jAt] = A.plan, t = A.t++;
    const d = t < sAt ? d1 : -d1;
    // never run (or jump) past an end: past the far one is the fence and a fall, past the near one the open pillar side
    const pastEnd = d > 0 ? p.cx > A.x1 + TS - 14 : d < 0 ? p.cx < A.x0 + 14 : false;
    if (d && !pastEnd) this.hold(d > 0 ? 'd' : 'a');
    if (pastEnd && Math.abs(p.vx) > 0.5) this.hold(p.vx > 0 ? 'a' : 'd');
    if (jAt >= 0 && !pastEnd && t >= jAt && t < jAt + 16) Input.keys[' '] = true;   // held like the plan simulated it (fresh press, then full height)
    this.why = 'eye-dodge ' + (d > 0 ? 'R' : d < 0 ? 'L' : '-') + (jAt >= 0 ? ' j' + jAt : '');
  },
  // one plan against a copy of the Eye AI (keep in step with bosses.js eye() and the movement in player.js), flat floor at `floor`:
  // returns the closest gap between the two boxes (negative = hit; earlier hits score worse) and where we end up
  eyeSim(p0, n, [d1, sAt, jAt], look, floor, wx0, wx1) {
    const ms = p0.calc.moveSpeed || 1, mx = 3 * ms, acc = 0.08 * ms, slow = 0.2 * ms, PW = p0.w, PH = p0.h, EW = n.w, EH = n.h;
    let x = p0.x, y = p0.y, vx = p0.vx, vy = p0.vy, jump = p0.jump || 0, held = !!p0.jumpHeld, ground = p0.onGround;
    let ex = n.x, ey = n.y, evx = n.vx, evy = n.vy, st = n.ai[2] === 1 ? 'spin' : n.state, a1 = n.ai[1], dashes = n.dashes || 0, ph2 = n.ai[2] >= 2;
    let minSep = 1e9;
    for (let t = 0; t < look; t++) {
      const d = t < sAt ? d1 : -d1, J = jAt >= 0 && t >= jAt && t < jAt + 16;
      if (d < 0) { if (vx > -mx) { if (vx > slow) vx -= slow; vx -= acc; if (vx < -mx) vx = -mx; } }
      else if (d > 0) { if (vx < mx) { if (vx < -slow) vx += slow; vx += acc; if (vx > mx) vx = mx; } }
      else { const s = ground ? slow : slow * 0.5; vx = vx > s ? vx - s : vx < -s ? vx + s : 0; }
      if (J) { if (jump > 0) { vy = -5.01; jump--; } else if (!held && ground) { vy = -5.01; jump = 15; } held = true; } else { jump = 0; held = false; }
      vy = Math.min(vy + 0.4, 10); x += vx; y += vy;
      if (x < wx0) { x = wx0; vx = 0; } else if (x + PW > wx1) { x = wx1 - PW; vx = 0; }
      if (y + PH >= floor) { y = floor - PH; vy = 0; ground = true; } else ground = false;
      const pcx = x + PW / 2, pcy = y + PH / 2;
      // the Eye
      if (st === 'spin') { evx *= 0.95; evy *= 0.95; ex += evx; ey += evy; if (++a1 >= 120) { st = 'hover'; a1 = 0; ph2 = true; } }
      else if (st === 'hover') {
        const spd = ph2 ? 8 : 6, ea = ph2 ? 0.2 : 0.15;
        evx += clamp(pcx - (ex + EW / 2), -1, 1) * ea; evy += clamp(pcy - 230 - (ey + EH / 2), -1, 1) * ea;
        const v = Math.hypot(evx, evy); if (v > spd) { evx *= spd / v; evy *= spd / v; }
        ex += evx; ey += evy;
        if (++a1 > (ph2 ? 120 : 280)) { st = 'dash'; a1 = 0; dashes = 0; }
      } else {
        if (a1 === 0) { const a = Math.atan2(pcy - (ey + EH / 2), pcx - (ex + EW / 2)), sp = ph2 ? 10 : 7; evx = Math.cos(a) * sp; evy = Math.sin(a) * sp; }
        a1++; ex += evx; ey += evy;
        if (a1 > 40) { evx *= 0.95; evy *= 0.95; }
        if (a1 > (ph2 ? 55 : 70)) { a1 = 0; if (++dashes >= (ph2 ? 5 : 3)) st = 'hover'; }
      }
      const sep = Math.max(Math.abs(pcx - (ex + EW / 2)) - (PW + EW) / 2, Math.abs(pcy - (ey + EH / 2)) - (PH + EH) / 2);
      if (sep < minSep) minSep = sep;
      if (sep < 0) return { sep: sep - (look - t), cx: pcx };
    }
    return { sep: Math.min(minSep, 40), cx: x + PW / 2 };
  },
  skillHeal() { const self = this; return { step() { self.press('h'); self.goal = 'drinking a potion'; this.done = true; } }; },
  skillFlee() {
    const self = this, t0 = G.tick;
    return { step() {
      const p = self.p();
      self.goal = 'retreating home (' + Math.round(p.life) + '/' + p.lifeMax + ')';
      const r = self.moveTo(self.base[0], self.base[1], 1);
      const close = self.foesNear().find(n => Math.abs(n.cx - p.cx) < 36 && Math.abs(n.cy - p.cy) < 40);
      if (close && (r === 'fail' || true)) self.combat(close, false);
      if (r === true || r === 'fail' || G.tick - t0 > 1200) this.done = true;
    } };
  },
  skillRest() {
    const self = this, t0 = G.tick;
    return { step() {
      const p = self.p(); self.goal = 'resting (' + Math.round(p.life) + '/' + p.lifeMax + ')';
      // rest inside the house when there is one (flyers and hoppers can't get in), not on the doorstep
      if (self.houseValid() && self.base) { const r = self.moveTo(self.base[0], self.base[1], 1); if (r !== true && r !== 'fail') return; }
      if (p.life >= p.lifeMax * 0.95 || G.tick - t0 > 4000) this.done = true;
    } };
  },
  skillShelter() {
    const self = this, t0 = G.tick;
    let sub = null, lastTry = -1e9;
    return { step() {
      const p = self.p();
      // the stations stand in the house: a night indoors is a good time to smelt and craft what we're working toward
      if (sub && !sub.done) { self.goal = 'hiding in the house (night), ' + (sub.label || 'crafting'); sub.step(); if (!sub.done) return; }
      self.goal = 'hiding in the house (night)';
      const r = self.moveTo(self.base[0], self.base[1], 1); if (r === true) self.aimWorld(p.cx + 200, p.cy);
      if (r === true && G.tick - lastTry > 600) { lastTry = G.tick; sub = self.indoorCraft(); if (sub) return; }
      if (!G.isNight() || G.tick - t0 > 3000 || r === 'fail') this.done = true;
    } };
  },
  // the next step toward the item we're committed to, if it is a craft at a station inside the house
  indoorCraft() {
    const c = this.committed; if (!c || !this.houseSpot) return null;
    const step = this.resolve(c.item, c.qty || 1);
    if (!step || !(step.craft || (step.station && this.has(STATION_ITEM[step.station])))) return null;
    if (step.craft) {
      const r = RECIPES.find(q => q.out === step.craft);
      if (r && r.station && !this.inHouse(t => TILES[t] && (TILES[t].station === r.station || (r.station === 'furnace' && t === T.HELLFORGE)))) return null;
    }
    const task = this.taskForStep(step);
    if (task) task.label = 'crafting ' + ITEMS[step.craft || STATION_ITEM[step.station]].name;
    return task;
  },

  // Dying over and over in the same place means the plan walks into the same trap each respawn: stay out of that area for a while
  registerDeath(cause) {
    const [fx, fy] = this.feet(), now = G.tick;
    const hist = this.deathHist = (this.deathHist || []).filter(d => now - d.t < 9000);
    hist.push({ t: now, cause: String(cause).split(':')[0], x: fx, y: fy });
    const near = hist.filter(d => Math.abs(d.x - fx) < 60 && Math.abs(d.y - fy) < 60);
    if (near.length >= 3) {
      const [bx, by] = this.base || [fx, fy];
      if (Math.abs(fx - bx) < 40 && Math.abs(fy - by) < 30) return;      // dying at home isn't about the route
      this.avoidZone = { x: fx, y: fy, r: 30, until: now + 25000 };
      const key = this.lastGoal ? this.lastGoal.split(' ').slice(0, 2).join(' ') : null;
      if (key) { this.cooldowns = this.cooldowns || {}; this.cooldowns[key] = now + 12000; }
      this.log('death loop (' + near.length + 'x ' + hist[hist.length - 1].cause + ' near ' + fx + ',' + fy + '): avoiding the area, cooling down "' + key + '"');
      this.deathHist = [];
    }
  },

  // blunt escape: run one way, hop, and chew through whatever is in front of us (ore, dirt, stone) with the best pickaxe
  bruteForce() {
    const p = this.p(), w = G.world, u = this.unstick, [fx, fy] = this.feet();
    this.goal = 'unsticking';
    if ((u.until - G.tick) % 140 === 0 && Math.random() < 0.4) u.dir = -u.dir;
    const ahead = fx + u.dir * 2;
    const s = this.bestSlot('pick');
    if (s >= 0 && s <= 9) this.selectSlot(s);
    // dig the column ahead at head and feet height (and above, to open a way up)
    const targets = [[ahead, fy], [ahead, fy - 1], [fx + u.dir, fy - 1], [fx + u.dir, fy - 3], [fx, fy - 3]];
    // only what our pickaxe can actually break (Brainrot stone needs 65, orbs need a hammer): swinging at the rest never ends
    const pow = s >= 0 ? ITEMS[p.inv[s].id].pick || 0 : 0;
    const t = targets.find(([x, y]) => { const q = w.tile(x, y), td = TILES[q]; return q && td.solid && !td.unbreakable && !td.needHammer && td.minPick <= pow && !Bot.isProtected(x, y); });
    if (t && s >= 0 && s <= 9) { this.aimTile(t[0], t[1]); this.clickHold(); this.hold(u.dir > 0 ? 'd' : 'a'); if (G.tick % 24 < 3 || p.collidedX) this.jump(); return; }
    // walled in by stone we can't break (a Brainrot pit): pillar straight up out of it
    const hard = targets.some(([x, y]) => { const q = w.tile(x, y); return q && TILES[q].solid && TILES[q].minPick > pow; });
    const bs = hard ? this.spareBlockSlot(true) : -1;
    if (bs >= 0) {
      if (bs > 9) { this.ensureHotbar(bs); return; }
      this.selectSlot(bs); this.goal = 'pillaring out of a pit';
      const col = Math.floor(p.cx / TS), row = Math.floor((p.y + p.h - 1) / TS) + 1;
      if (p.onGround) this.jump(); else if (p.vy >= -1 && !w.solid(col, row)) { this.aimTile(col, row); this.clickOnce(); }
      return;
    }
    this.hold(u.dir > 0 ? 'd' : 'a');
    if (G.tick % 24 < 3 || p.collidedX) this.jump();
  },

  // ================= combat =================
  findEnemy() {
    const p = this.p();
    let best = null, bd = 1e9;
    this.ignore = this.ignore || {};
    for (const n of G.npcs) {
      if (n.friendly || n.town || n.dead || n.alpha < 0.5 || n.def.critter) continue;
      if (this.ignore[n.uid] > G.tick) continue;
      const d = dist(n.cx, n.cy, p.cx, p.cy);
      const range = n.boss ? 900 : 260;
      if (d < range && d < bd && (n.boss || lineOfSight(G.world, p.cx, p.cy, n.cx, n.cy))) { bd = d; best = n; }
    }
    // a boss fight is about the boss: ignore its minions' chatter unless one is right on top of us
    const boss = G.npcs.find(n => n.boss && !n.dead && !(this.ignore[n.uid] > G.tick));
    if (boss && best && !best.boss && bd > 55) return boss;
    return best;
  },
  equipUpgrade() {
    const p = this.p();
    for (const s of p.inv) {
      if (!s) continue; const it = ITEMS[s.id];
      if (this.cooldowns && this.cooldowns['equip:' + s.id] > G.tick) continue;
      if (it.armor) { const k = { head: 0, body: 1, legs: 2 }[it.armor], cur = p.armor[k]; if ((it.defense || 0) > (cur ? ITEMS[cur.id].defense || 0 : 0)) return s.id; }
      else if (it.acc) { if (!p.acc.some(a => a && a.id === s.id) && p.acc.some(a => !a)) return s.id; }
      else if (it.lifeCrystal) { if (p.lifeMax < 400) return s.id; }
      else if (it.manaCrystal) { if (p.manaMaxBase < 200) return s.id; }
    }
    return null;
  },
  taskCandidates() {
    const p = this.p(), w = G.world, out = [];
    const add = (id, kind, make, extra = {}) => out.push(Object.assign({ id, kind, make }, extra));
    const tree = this.nearestTile((t, x, y) => t === T.TREE && w.treeType(x, y) === TREE_BASE, 140, 40);
    if (tree) add('chop', 'chop', () => this.taskChop(this.count('wood') + 40), { value: Math.min(this.count('wood'), 200) / 100, dist: Math.abs(tree[0] - this.feet()[0]) });
    if (!this.houseValid() || !this.houseFinished) { this.pickHouseSite(); add('build', 'build', () => this.taskBuildHouse(), { ready: (n => n ? Math.min(1, this.count('wood') / n) : 1)(this.houseWoodNeed()) }); }
    add('stone', 'stone', () => { const want = this.count('stone_block') + 30; return this.taskMine('stone', () => this.count('stone_block') >= want); }, { value: Math.min(this.count('stone_block'), 200) / 100 });
    const pickPow = Math.max(0, ...p.inv.map(s => s ? ITEMS[s.id].pick || 0 : 0));
    for (const [ore, tileName] of Object.entries(ORE_TILE)) {
      const tile = T[tileName], td = TILES[tile];
      if (!td || td.minPick > pickPow) continue;
      const near = this.nearestTile(t => t === tile, 90, 80);
      if (!near) continue;
      add('ore:' + ore, 'ore', () => { const want = this.count(ore) + 15; return this.taskMine('ore', () => this.count(ore) >= want, [tile]); }, { value: Math.log1p(ITEMS[ore].value || 1) / 8, dist: Math.abs(near[0] - this.feet()[0]) + Math.abs(near[1] - this.feet()[1]), needs: Math.min(this.count(ore), 200) / 100 });
    }
    // craftable goals: gear, stations, ammo, consumables, summons (the skill resolves missing ingredients itself)
    for (const [id, qty] of JEV_GOALS) {
      if (!ITEMS[id] || !RECIPES.some(r => r.out === id)) continue;
      const it = ITEMS[id];
      if (id === 'furnace' && this.stationPlaced('furnace')) continue;
      if (id === 'iron_anvil' && this.stationPlaced('anvil')) continue;
      if (id === 'hellforge' && this.stationPlaced('hellforge')) continue;
      if (it.pick && this.hasBetterPick(it.pick)) continue;
      if (it.armor) { const k = { head: 0, body: 1, legs: 2 }[it.armor], cur = p.armor[k]; if (cur && (ITEMS[cur.id].defense || 0) >= (it.defense || 0)) continue; }
      if (it.summon && w.flags[it.summon]) continue;
      if (this.owns(id, qty)) continue;
      const step = this.resolve(id, qty);
      if (!step || !this.stepFeasible(step, pickPow)) continue;   // action masking: only goals whose next step is doable now
      const needs = this.rawNeeds(id, qty);
      const total = Object.values(needs).reduce((a, b) => a + b, 0) || 1;
      const have = Object.entries(needs).reduce((a, [k, v]) => a + Math.min(v, this.count(k)), 0);
      const curDmg = Math.max(0, ...p.inv.map(s => s && ITEMS[s.id].damage && !ITEMS[s.id].ammoType ? expectedHit(ITEMS[s.id]) : 0));
      add('craft:' + id, 'craft', () => this.taskForStep(this.resolve(id, qty)), {
        item: id, qty, value: Math.log1p(it.value || 1) / 12, def: (it.defense || 0) / 10,
        dmg: it.damage && !it.ammoType ? Math.max(0, expectedHit(it) - curDmg) / 30 : 0,
        pickGain: it.pick ? (it.pick - pickPow) / 20 : 0, ready: have / total, needs: Math.log1p(total) / 6,
      });
    }
    // skip obsolete tiers: per gear slot only the strongest piece that can be worked on now stays on the menu
    // (copper armor makes wood armor pointless; going straight for gold skips copper/iron/silver when gold is reachable)
    const slotOf = id => { const it = ITEMS[id]; if (it.armor) return 'armor:' + it.armor; if (it.pick && /_pickaxe$/.test(id)) return 'pick'; if (/_broadsword$/.test(id)) return 'sword'; if (/_bow$/.test(id)) return 'bow'; return null; };
    const power = id => { const it = ITEMS[id]; return it.armor ? it.defense || 0 : it.pick ? it.pick : expectedHit(it) * 60 / Math.max(6, it.useAnim || it.useTime); };
    const bestIn = {};
    for (const c of out) if (c.kind === 'craft') { const k = slotOf(c.item); if (k && (!bestIn[k] || power(c.item) > power(bestIn[k]))) bestIn[k] = c.item; }
    for (let i = out.length - 1; i >= 0; i--) { const c = out[i]; if (c.kind !== 'craft') continue; const k = slotOf(c.item); if (k && bestIn[k] !== c.item) out.splice(i, 1); }
    if (p.lifeMax < 400) { const c = this.findCrystal(); if (c) add('crystal', 'crystal', () => this.taskBreakAt(c, 'aura crystal', 'pick'), { dist: Math.abs(c[0] - this.feet()[0]) + Math.abs(c[1] - this.feet()[1]) }); }
    for (const key of Object.keys(BOSS_SUMMON)) {
      if (w.flags[key] || !this.houseValid()) continue;
      const B = BOSS_SUMMON[key], needs = this.rawNeeds(B.item, 1);
      const total = Object.values(needs).reduce((a, b) => a + b, 0) || 1, have = this.has(B.item) ? total : Object.entries(needs).reduce((a, [k, v]) => a + Math.min(v, this.count(k)), 0);
      if (this.has(B.item) && !this.bossReady(key)) continue;   // readiness gate: holding the summon isn't enough
      // a night boss with nothing to do by day (summon in hand, or lenses that only drop at night) is not an option until dusk
      if (B.night && !G.isNight() && this.ticksToNight() > 2500 && (this.has(B.item) || (key === 'eye_of_cthulhu' && this.count('lens') < 6))) continue;
      add('boss:' + key, 'boss', () => this.taskBoss(key), { ready: have / total, boss: key, value: BOSS_TYPES[key].life / 4000 });
    }
    const bn = w.flags.eye_of_cthulhu && this.brainrotWants().length ? this.brainrotNeeds() : null;   // (materials in hand: the crafts take over)
    if (bn && (this.count('rotten_chunk') < bn.chunks || this.count('demonite_ore') < bn.ore)) add('brainrot', 'brainrot', () => this.taskBrainrot(), { ready: Math.min(1, this.count('rotten_chunk') / 6) });
    if (this.hasBetterPick(65) && !w.flags.wall_of_flesh) add('hell', 'hell', () => this.taskHell(), { ready: Math.min(1, p.lifeMax / 300) });
    add('explore', 'explore', () => this.taskExplore());
    if (this.base) add('home', 'home', () => this.taskGoHome(), { dist: Math.abs(this.base[0] - this.feet()[0]) + Math.abs(this.base[1] - this.feet()[1]) });
    // the cooldown memory: drop candidates that just failed (unless that leaves nothing)
    const fresh = out.filter(c => !(this.cooldowns && this.cooldowns[c.id] > G.tick));
    return fresh.length ? fresh : out;
  },
  // can the next step of a goal actually be done right now with what we have / know?
  stepFeasible(step, pickPow, depth = 0) {
    if (!step || depth > 3) return false;
    if (step.craft) return true;
    if (step.station) { const it = STATION_ITEM[step.station]; if (this.has(it)) return true; return this.stepFeasible(this.resolve(it, 1), pickPow, depth + 1); }
    if (step.gather) {
      const id = step.gather;
      if (id === 'wood' || id === 'stone_block' || id === 'dirt_block') return true;
      if (ORE_TILE[id]) { const td = TILES[T[ORE_TILE[id]]]; const known = SDK.obs().near.ores && SDK.obs().near.ores[id]; return td.minPick <= pickPow && !!known; }
      return false; // monster drops (gel, lens, chunks, boss loot), obsidian... come from the boss/biome skills
    }
    return false;
  },
  // aura crystals sit in the underground/caverns, usually far outside the local scan: remember every one on the map
  // (rescanned every 3000 ticks) and go for the nearest one that hasn't failed before
  findCrystal() {
    const w = G.world;
    if (!this.crystals || G.tick - this.crystals.at > 3000) {
      const list = [];
      for (let y = w.worldSurface; y < w.hellLayer; y++) for (let x = 1; x < w.w - 1; x++)
        if (w.tile(x, y) === T.LIFE_CRYSTAL && w.tile(x - 1, y) !== T.LIFE_CRYSTAL && w.tile(x, y - 1) !== T.LIFE_CRYSTAL) list.push([x, y]);
      this.crystals = { at: G.tick, list };
    }
    const [fx, fy] = this.feet();
    let best = null, bd = 1e9;
    for (const c of this.crystals.list) {
      if (w.tile(c[0], c[1]) !== T.LIFE_CRYSTAL || this.crystalBad(c)) continue;
      const b = w.backrooms; if (b && c[0] >= b.x0 - 3 && c[0] <= b.x0 + b.w + 3 && c[1] >= b.y0 - 3 && c[1] <= b.y0 + b.h + 3) continue;   // in (or in the walls of) the Backrooms room
      const d = Math.abs(c[0] - fx) + Math.abs(c[1] - fy) * 1.5;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },
  taskGoHome() {
    const self = this;
    this.goal = 'going home';
    return { step() { const r = self.moveTo(self.base[0], self.base[1], 1); if (r === true || r === 'fail') this.done = true; } };
  },
  hasBetterPick(n) { return this.p().inv.some(s => s && (ITEMS[s.id].pick || 0) >= n); },
  hasStation(st) {
    const [bx, by] = this.base || this.feet();
    return !!this.nearestTile(t => TILES[t] && TILES[t].station === st, 12, 8, [bx, by]) || this.has({ furnace: 'furnace', anvil: 'iron_anvil', work_bench: 'work_bench' }[st]);
  },
  stationPlaced(st) { const [bx, by] = this.base; return !!this.nearestTile(t => TILES[t] && (TILES[t].station === st || (st === 'furnace' && t === T.HELLFORGE)), 14, 8, [bx, by]); },
  houseValid() { return G.npcs.some(n => n.type === 'guide' && n.home) || (this.houseSpot && checkRoom(G.world, this.houseSpot[0] + 5, this.houseSpot[1] - 2).ok); },
  // ================= movement =================
  // moveTo / followPath live in botnav.js (A* pathfinding)
  dig(tx, ty) {
    const w = G.world, t = TILES[w.tile(tx, ty)];
    if (!t) return;
    // detect tiles that never break (protected by an object on top, unbreakable, ...)
    const key = tx + ',' + ty;
    if (this.digKey !== key) { this.digKey = key; this.digTicks = 0; }
    if (++this.digTicks > 300) { this.badTiles = this.badTiles || new Set(); this.badTiles.add(key); this.log('cannot dig ' + t.name + ' at ' + key + ', skipping'); this.digTicks = 0; return 'fail'; }
    const kind = t.tree || t.cactus ? 'axe' : 'pick';
    const s = this.bestSlot(kind);
    this.dbg = 'dig ' + key + ' ' + t.name + ' slot ' + s + ' digTicks ' + this.digTicks;
    if (s < 0) return;
    if (s > 9) { this.ensureHotbar(s); return; }
    if (t.minPick > (ITEMS[this.p().inv[s].id].pick || 999) && kind === 'pick') { this.stuck += 30; return; }
    this.selectSlot(s);
    this.aimTile(tx, ty);
    this.clickHold();
  },

  // ================= UI helpers (clicks on the real inventory UI) =================
  slotPos(i) { return [20 + (i % 10) * (SLOT + GAP) + SLOT / 2, 22 + Math.floor(i / 10) * (SLOT + GAP) + SLOT / 2]; },
  // move an inventory item into hotbar slot 9 (swap) using mouse clicks
  ensureHotbar(i, target) {
    const p = this.p();
    if (target == null) target = p.inv[i] ? SDK.hotbarSlotFor(p.inv[i].id) : 9; // each kind of item has its own home slot
    this.uiBusy = true;
    const st = this.hb || (this.hb = { step: 0, from: i, to: target });
    if (st.step === 0) { if (!UI.invOpen) this.press('Escape'); st.step = 1; return; }
    if (st.step === 1) { if (!UI.invOpen) { this.press('Escape'); return; } const [x, y] = this.slotPos(st.from); this.uiClick(x, y); st.step = 2; return; }
    if (st.step === 2) { const [x, y] = this.slotPos(st.to); this.uiClick(x, y); st.step = 3; return; }
    if (st.step === 3) { if (p.mouseItem) { const [x, y] = this.slotPos(st.from); this.uiClick(x, y); } st.step = 4; return; }
    if (st.step === 4) { if (UI.invOpen) this.press('Escape'); this.hb = null; this.uiBusy = false; }
  },

  // ================= tasks =================
  // each task: { step(), done }
  taskChop(target) {
    const self = this;
    this.goal = 'chopping trees (' + this.count('wood') + '/' + target + ' wood)';
    let tree = null;
    return {
      step() {
        if (self.count('wood') >= target) { this.done = true; return; }
        if (this.plant) { const r = self.plantAcorn(this.plant); if (r === 'fail') (self.badAcorn = self.badAcorn || new Set()).add(this.plant.join(',')); if (r !== false) this.plant = null; return; }
        if (!tree || G.world.tile(tree[0], tree[1]) !== T.TREE) {
          const isBase = (t, x, y) => t === T.TREE && G.world.treeType(x, y) === TREE_BASE && !self.nearLava(x, y);
          tree = self.nearestTile(isBase, 40, 20);
          // no tree close by: an acorn grows one on the spot (felled trees drop 1-2 acorns, so this keeps itself going)
          if (!tree && self.has('acorn')) { const sp = self.acornSpot(); if (sp) { this.plant = sp; return; } }
          if (!tree) tree = self.nearestTile(isBase, 140, 40);
          if (!tree) { self.log('no trees nearby, exploring'); this.done = true; self.task = self.taskExplore(); return; }
        }
        const [tx, ty] = tree;
        const side = self.feet()[0] <= tx ? tx - 1 : tx + 1;
        const r = self.moveTo(side, ty, 1);
        if (r === 'fail') { tree = null; return; }
        if (r) { self.selectSlot(self.bestSlot('axe')); self.aimTile(tx, ty); self.clickHold(); self.goal = 'chopping (' + self.count('wood') + '/' + target + ')'; }
      },
    };
  },
  // a grass cell on the surface within 16 tiles with room for a tree (no tree within 2 columns, open above)
  acornSpot() {
    const w = G.world, [fx] = this.feet();
    for (let d = 3; d <= 16; d++) for (const x of [fx + d, fx - d]) {
      const y = topSolid(w, x) - 1;
      if (y < 5 || w.tile(x, y) || !(w.tile(x, y + 1) === T.GRASS || w.tile(x, y + 1) === T.CORRUPT_GRASS || w.tile(x, y + 1) === T.SNOW)) continue;
      if ([-2, -1, 1, 2].some(i => w.tile(x + i, y) === T.TREE) || (this.badAcorn && this.badAcorn.has(x + ',' + y))) continue;
      if (this.base && Math.abs(x - this.base[0]) < 8) continue;   // not in the yard
      let open = true; for (let j = 1; j <= 10 && open; j++) if (w.tile(x, y - j)) open = false;
      if (open) return [x, y];
    }
    return null;
  },
  // walk next to the spot and place an acorn on it: true once a tree stands there, 'fail' when it won't take
  plantAcorn(sp) {
    const w = G.world, [x, y] = sp;
    if (w.tile(x, y) === T.TREE) return true;
    if (w.tile(x, y)) return 'fail';
    const r = this.moveTo(x + (this.feet()[0] < x ? -2 : 2), y, 1);
    if (r === 'fail') return 'fail';
    if (!r && !this.p().inReach(x, y)) return false;
    const s = this.slotOf(it => it.id === 'acorn');
    if (s < 0) return 'fail';
    if (s > 9) { this.ensureHotbar(s); return false; }
    this.selectSlot(s); this.aimTile(x, y); if (this.p().itemAnim === 0) this.clickOnce();
    sp.tries = (sp.tries || 0) + 1;
    return sp.tries > 60 ? 'fail' : false;
  },
  taskBreakAt(pos, label, tool) {
    const self = this;
    this.goal = 'going for ' + label;
    return {
      step() {
        const [tx, ty] = pos, w = G.world;
        if (!w.tile(tx, ty)) { this.done = true; self.log('got ' + label); return; }
        const r = self.moveTo(tx, ty + 1, 3);
        if (r === 'fail') { this.done = true; self.log('could not reach ' + label); self.badCrystals = self.badCrystals || new Set(); self.badCrystals.add(tx + ',' + ty); return; }
        if (r || self.p().inReach(tx, ty)) {
          const s = self.bestSlot(tool || 'pick'); if (s > 9) { self.ensureHotbar(s); return; }
          self.selectSlot(s); self.aimTile(tx, ty); self.clickHold();
        }
      },
    };
  },
  taskTrash() {
    const self = this;
    const junk = ['dirt_block', 'sand_block', 'clay_block', 'mud_block', 'ash_block', 'snow_block', 'ice_block', 'ebonstone_block', 'cobweb', 'mushroom', 'acorn', 'daybloom', 'blinkroot', 'cactus', 'sandstone_block', 'ebonsand_block', 'wallpaper_block', 'carpet_block', 'granite', 'marble', 'meme67_block', 'bone', 'stone_block', 'glass', 'gel', 'lens'];
    const keep = { dirt_block: 60, stone_block: 60, gel: 99, lens: 6, bone: 7, glass: 10, acorn: 30 };   // acorns grow trees on the spot
    if (this.hell && this.hell.x0) Object.assign(keep, { dirt_block: 400, stone_block: 700, ash_block: 300 });   // the Wall runway is ~450 blocks
    this.goal = 'cleaning inventory';
    let step = 0;
    return {
      step() {
        self.uiBusy = true;
        const p = self.p();
        if (step === 0) { if (!UI.invOpen) self.press('Escape'); step = 1; return; }
        // shift-click (trash) the first junk stack beyond what we keep, then gear we've outgrown
        let i = p.inv.findIndex((s, k) => k >= 10 && s && junk.includes(s.id) && invCount(p.inv, s.id) > (keep[s.id] || 0));
        if (i < 0) i = p.inv.findIndex((s, k) => k >= 10 && s && self.obsolete(s.id));
        if (i < 0 || step > 40) { if (UI.invOpen) self.press('Escape'); this.done = true; self.uiBusy = false; return; }
        Input.keys.Shift = true; Input.shift = true;
        const [x, y] = self.slotPos(i); self.uiClick(x, y);
        step++;
      },
    };
  },
  // gear that can only take up a slot now: a weapon other than The 67 once we have it (it's best in slot up to the Wall), else one
  // weaker than our best; a tool tier below our best of its kind; armor no better than what we wear; arrows with no bow kept.
  // Nothing a planned craft has reserved.
  obsolete(id) {
    const it = ITEMS[id], p = this.p();
    if (!it || this.reserved(id) > 0 || it.consumable || it.ammoType && id !== 'wooden_arrow') return false;
    const inv = p.inv.filter(Boolean).map(s => s.id);
    if (it.pick || it.axe || it.hammer) {
      const k = it.pick ? 'pick' : it.axe ? 'axe' : 'hammer';
      return inv.some(o => o !== id && (ITEMS[o][k] || 0) > (it[k] || 0) && !!ITEMS[o].pick === !!it.pick);
    }
    if (it.armor) { const cur = p.armor[{ head: 0, body: 1, legs: 2 }[it.armor]]; return !!cur && (ITEMS[cur.id].defense || 0) >= (it.defense || 0); }
    const power = o => { const q = ITEMS[o]; return expectedHit(q) * 60 / Math.max(6, q.useAnim || q.useTime); };
    if (id === 'wooden_arrow') return this.owns('the_67') && !inv.some(o => ITEMS[o].ammo === 'arrow' && !this.obsolete(o));
    if (it.damage && !it.ammoType && it.use) {
      if (id === 'the_67') return false;
      if (this.owns('the_67')) return true;
      return inv.some(o => o !== id && ITEMS[o].damage && !ITEMS[o].ammoType && !ITEMS[o].pick && !ITEMS[o].axe && !ITEMS[o].hammer && !ITEMS[o].consumable && power(o) > power(id) * 1.2);
    }
    return false;
  },
  // equip / use an item, tracked by id (its slot is looked up live every step, so it can't loop on a stale slot)
  taskEquip(id) {
    const self = this, it = ITEMS[id], start = SDK.count(id);
    this.goal = 'equipping ' + it.name;
    let step = 0, tries = 0;
    return {
      step() {
        const i = SDK.slotOf(id);
        // gone (used up / equipped) or not worth it anymore: done
        if (i < 0 || SDK.count(id) < start || ++tries > 120) { if (tries > 120) { self.log('could not equip ' + it.name + ', cooling down'); (self.cooldowns = self.cooldowns || {})['equip:' + id] = G.tick + 6000; } if (UI.invOpen && !self.hb) self.press('Escape'); this.done = true; self.uiBusy = false; return; }
        if (it.lifeCrystal || it.manaCrystal) {
          if ((it.lifeCrystal && self.p().lifeMax >= 400) || (it.manaCrystal && self.p().manaMaxBase >= 200)) { this.done = true; return; }
          if (i > 9) { self.ensureHotbar(i); return; }
          self.uiBusy = false;
          if (UI.invOpen) { self.press('Escape'); return; }
          self.selectSlot(i); if (self.p().sel === i && self.p().itemAnim === 0) self.clickOnce();
          return;
        }
        self.uiBusy = true;
        if (step === 0) { if (!UI.invOpen) self.press('Escape'); step = 1; return; }
        if (step === 1) { const [x, y] = self.slotPos(i); self.uiClick(x, y, true); step = 2; return; }
        if (UI.invOpen) self.press('Escape');
        self.log('equipped ' + it.name); this.done = true; self.uiBusy = false;
      },
    };
  },
  // craft an item by clicking its recipe in the crafting list, then drop it into the inventory
  taskCraftAtBase(order) {
    const self = this;
    const [id, times, afterArg] = order;
    const after = afterArg === 'placeonly' ? 'place' : afterArg;
    const r = RECIPES.find(r => r.out === id);
    this.goal = 'crafting ' + ITEMS[id].name;
    let phase = r && !r.station && !after && times ? 'open' : 'go', clicks = 0, waited = 0;   // hand recipes: craft right here
    return {
      step() {
        const p = self.p();
        if (phase === 'go') {
          let target = self.base;
          if (r.station === 'altar') { const a = self.nearestTile(t => t === T.ALTAR, 300, 250); if (!a) { this.done = true; self.log('no altar found'); return; } target = [a[0] + 1, a[1] + 1]; }
          else if (r.station) { const st = self.nearestTile(t => TILES[t] && (TILES[t].station === r.station || (r.station === 'furnace' && t === T.HELLFORGE)), 14, 8, self.base); if (st) target = [st[0], st[1] + (TILES[G.world.tile(st[0], st[1])].multi[1] - 1 - (G.world.frame(st[0], st[1]) >> 4))]; }
          const res = self.moveTo(target[0], target[1], 2);
          if (res === 'fail') { this.done = true; self.log('could not reach crafting station for ' + id); self.fail(id); return; }
          if (res) phase = times ? 'open' : 'place'; // times 0: the item is already in the inventory, just place it
          return;
        }
        self.uiBusy = true;
        if (phase === 'open') { if (!UI.invOpen) self.press('Escape'); phase = 'click'; return; }
        if (phase === 'click') {
          self.wantsDraw = true;
          const slot = (UI.recipeSlots || []).find(s => s.out === id);
          if (!slot) {
            const idx = UI.recipes.findIndex(q => q.out === id);
            if (idx < 0 || ++waited > 40) { if (++waited > 20) { this.done = true; self.log('recipe not available: ' + id); self.fail(id); self.press('Escape'); self.uiBusy = false; } return; }
            // scroll the crafting list with the mouse wheel until the recipe is visible
            const rs = UI.recipeSlots || {};
            Input.mx = (rs.x0 || 20) + 10; Input.my = (rs.y0 || 300) + 10;
            Input.wheel = idx < (UI.craftScroll || 0) * 10 ? -1 : 1;
            return;
          }
          if (p.mouseItem && p.mouseItem.id !== id) { phase = 'drop'; return; }
          self.uiClick(slot.x, slot.y);
          clicks++;
          if (clicks >= times || !UI.canCraft(r, UI.stationsNear(), p.inv)) phase = 'drop';
          return;
        }
        if (phase === 'drop') {
          if (p.mouseItem) {
            const empty = p.inv.findIndex((s, k) => k >= 10 && (!s || (s.id === p.mouseItem.id && s.count < maxStack(s.id))));
            const [x, y] = self.slotPos(empty >= 0 ? empty : 49);
            self.uiClick(x, y);
            return;
          }
          self.press('Escape'); phase = after === 'place' ? 'place' : 'finish';
          self.log('crafted ' + ITEMS[id].name + (clicks > 1 ? ' x' + clicks : ''));
          if (id === 'work_bench') self.milestone('work bench');
          if (id === 'furnace') self.milestone('furnace');
          if (id === 'iron_anvil') self.milestone('anvil');
          if (id.endsWith('_pickaxe') || id === 'the_67' || id.endsWith('_bow') || id.endsWith('_chainmail') || id.endsWith('_greaves') || id.endsWith('_helmet') || id === 'nightmare_pickaxe' || id === 'hellforge') self.milestone(id);
          if (id === 'suspicious_looking_eye') self.milestone('suspicious eye');
          return;
        }
        if (phase === 'place') {
          self.uiBusy = false;
          const s = p.inv.findIndex(x => x && x.id === id);
          if (s < 0) { this.done = true; return; }
          if (s > 9) { self.ensureHotbar(s); return; }
          self.selectSlot(s);
          // find a spot next to us, else anywhere around the base
          const spot = self.stationSpot(id) || self.findPlacementNear(id) || self.findSpotAroundBase(id);
          if (!spot) { this.done = true; self.log('no room to place ' + id); return; }
          if (!p.inReach(spot[0], spot[1])) { if (self.moveTo(spot[0], spot[1], 2) === 'fail') waited += 100; if (++waited > 600) this.done = true; return; }
          self.aimTile(spot[0], spot[1]); self.clickOnce();
          if (++waited > 600) this.done = true;
          if (!self.has(id)) { self.log('placed ' + ITEMS[id].name); this.done = true; }
          return;
        }
        this.done = true; self.uiBusy = false;
      },
    };
  },
  // remember recipes that keep failing so the planner moves on instead of looping
  blocked(id) { const b = this.fails && this.fails[id]; return b && b.n >= 3 && G.tick - b.t < 60 * 60 * 3; },
  fail(id) { this.fails = this.fails || {}; const b = this.fails[id] || (this.fails[id] = { n: 0, t: 0 }); b.n++; b.t = G.tick; if (b.n === 3) this.log('giving up on ' + id + ' for a while'); },
  taskPlaceItem(id, near) {
    const self = this;
    this.goal = 'placing ' + ITEMS[id].name;
    let tries = 0;
    return {
      step() {
        if (!self.has(id)) { this.done = true; return; }
        const r = self.moveTo(near[0], near[1], 2);
        if (r === 'fail') { this.done = true; self.fail('place_' + id); return; }
        if (!r) return;
        const s = self.slotOf(it => it.id === id);
        if (s > 9) { self.ensureHotbar(s); return; }
        self.selectSlot(s);
        const spot = self.stationSpot(id) || self.findPlacementNear(id) || self.findSpotAroundBase(id);
        if (!spot || ++tries > 400) { this.done = true; self.fail('place_' + id); self.log('no room to place ' + id); return; }
        if (!self.p().inReach(spot[0], spot[1])) { if (self.moveTo(spot[0], spot[1], 2) === 'fail') tries += 100; return; }
        self.aimTile(spot[0], spot[1]); self.clickOnce();
      },
    };
  },
  // crafting stations go on the house floor when they fit: crafting then happens indoors (also at night), not on the roof
  // where 'nearest free spot around the base' used to put the furnace
  stationSpot(id) {
    const t = ITEMS[id].place;
    if (!this.houseSpot || !TILES[t] || !TILES[t].station || !this.houseValid()) return null;
    return this.houseFurnSpot(id, this.houseSpot[0] + (id === 'furnace' ? 5 : 2));
  },
  // best spot around the base (outside the house) where an object fits
  onDoorstep(ox, oy, td) {
    const h = this.houseSpot; if (!h) return false;
    const mw = td.multi ? td.multi[0] : 1, mh = td.multi ? td.multi[1] : 1;
    return ox + mw - 1 >= h[0] - 5 && ox <= h[0] + 1 && oy + mh - 1 >= h[1] - 5;
  },
  findSpotAroundBase(id) {
    const w = G.world, t = ITEMS[id].place, td = TILES[t];
    const [bx, by] = this.base;
    let best = null, bd = 1e9;
    for (let y = by - 10; y <= by + 6; y++) for (let x = bx - 16; x <= bx + 16; x++) {
      const ox = x - (td.multi ? Math.floor((td.multi[0] - 1) / 2) : 0), oy = y - (td.multi ? td.multi[1] - 1 : 0);
      if (!w.canPlaceObject(ox, oy, t)) continue;
      // keep the doorstep free: the whole footprint, not just the click point
      if (this.onDoorstep(ox, oy, td)) continue;
      const d = Math.abs(x - bx) + Math.abs(y - by) * 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  },
  findPlacementNear(id) {
    const p = this.p(), w = G.world, t = ITEMS[id].place;
    const [fx, fy] = this.feet();
    for (let r = 1; r < 6; r++) for (const dx of [r, -r]) {
      const x = fx + dx, y = fy;
      const td = TILES[t];
      const ox = x - (td.multi ? Math.floor((td.multi[0] - 1) / 2) : 0), oy = y - (td.multi ? td.multi[1] - 1 : 0);
      if (p.inReach(x, y) && w.canPlaceObject(ox, oy, t) && !this.onDoorstep(ox, oy, td)) return [x, y];
    }
    return null;
  },
  // mine: go to the nearest reachable stone/ore (pathfinding digs the tunnel), grab anything useful in reach
  taskMine(what, doneFn, tiles) {
    const self = this;
    this.goal = 'mining ' + what;
    let target = null, since = 0, bestD = Infinity, lastStep = 0;
    // a target we gave up on is skipped as a mining target for a while (it used to go into badTiles, which also made those
    // 25 cells impassable for the planner, forever)
    const bad = (x, y) => (self.badTiles && self.badTiles.has(x + ',' + y)) || (self.badMine && self.badMine.get(x + ',' + y) > G.tick);
    const markBad = (t) => { const m = self.badMine = self.badMine || new Map(); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) m.set((t[0] + i) + ',' + (t[1] + j), G.tick + 20000); };
    return {
      step() {
        if (doneFn()) {
          // finish the vein we are standing at (a few more swings now beat a whole trip back for the next item)
          const p0 = self.p();
          const more = tiles && (this.extra = (this.extra || 0) + 1) < 900 && self.nearestTile((t, x, y) => tiles.includes(t) && p0.inReach(x, y) && !self.isProtected(x, y) && !self.floorOverDrop(x, y) && !(self.badTiles && self.badTiles.has(x + ',' + y)), 7, 6);
          if (more && self.dig(more[0], more[1]) !== 'fail') { self.goal = 'mining ' + TILES[tiles[0]].name; return; }
          this.done = true; return;
        }
        // parked for a fight / a night / a rest: the give-up clock only counts time spent actually trying
        if (G.tick - lastStep > 30) { since = G.tick; bestD = Infinity; }
        lastStep = G.tick;
        const w = G.world, p = self.p();
        const [fx, fy] = self.feet();
        const pick = self.bestSlot('pick'), power = pick >= 0 ? ITEMS[p.inv[pick].id].pick : 0;
        const want = tiles ? (t => tiles.includes(t) && TILES[t].minPick <= power) : what === 'stone' ? (t => t === T.STONE) : (t => (TILES[t] && TILES[t].ore && TILES[t].minPick <= power && t !== T.HELLSTONE) || t === T.LIFE_CRYSTAL);
        const ok = (t, x, y) => want(t) && !self.nearLava(x, y) && !self.isProtected(x, y) && !bad(x, y) && !self.nearBackrooms(x, y) && Nav.cellCost(x, y) < Infinity;
        const near = self.nearestTile((t, x, y) => ok(t, x, y) && p.inReach(x, y) && !self.floorOverDrop(x, y), 7, 6);
        self.dbg = 'mine near=' + near + ' target=' + target;
        if (near) { if (self.dig(near[0], near[1]) === 'fail') markBad(near); self.goal = 'mining ' + TILES[w.tile(near[0], near[1])].name; since = G.tick; return; }
        if (!target || (!target.synthetic && !want(w.tile(target[0], target[1])))) {
          target = self.pickMineTarget(ok, w, fx, fy, want);
          if (!target) { // nothing known nearby: head deeper, away from the house
            const depth = what === 'stone' ? w.worldSurface + 12 : w.rockLayer + 15;
            const side = self.houseSpot && Math.abs(fx - self.houseSpot[0]) < 20 ? (fx < self.houseSpot[0] + 5 ? -25 : 25) : (Math.random() < 0.5 ? -30 : 30);
            target = [fx + side, Math.max(fy + 15, depth)]; target.synthetic = true; // wander target: keep it until reached, don't re-pick every tick
            if (self.nearBackrooms(target[0], target[1])) { const b = G.world.backrooms; target[0] = fx < b.x0 + b.w / 2 ? b.x0 - 80 : b.x0 + b.w + 80; }
          }
          since = G.tick; bestD = Infinity;
          self.log('mining toward ' + target);
        }
        const d = Math.abs(fx - target[0]) + Math.abs(fy - target[1]);
        if (d < bestD - 1) { bestD = d; since = G.tick; }
        const r = self.moveTo(target[0], target[1] + 1, 3);
        if (r === 'fail' || G.tick - since > 1500) { self.log('giving up on target ' + target); markBad(target); target = null; }
        else if (r === true) target = null;
      },
    };
  },
  taskBuildHouse() {
    const self = this;
    this.goal = 'building a house';
    const w = G.world;
    this.pickHouseSite();
    const [hx, fy] = this.houseSpot, plan = this.housePlan();
    const needs = { wood_wall: 50, wooden_door: 1, work_bench: 1, wooden_chair: 1 };
    let i = 0;
    return {
      unreach: 0,
      step() {
        const p = self.p();
        while (i < plan.length && self.planStepDone(plan[i])) i++;
        if (i >= plan.length) {
          // a last look over the whole plan: later steps (pillars to reach the roof) can undo earlier ones (the cleared interior)
          const j = plan.findIndex(st => !self.planStepDone(st) && st[0] !== 'block' && st[0] !== 'furn');
          if (j >= 0 && (this.rescans = (this.rescans || 0) + 1) <= 2) { i = j; return; }
          this.done = true; self.houseFinished = true; self.log('house finished'); return;
        }
        // clearing, the shell and the door cut need no station; walls and furniture need the work bench, which goes to its
        // planned spot inside the house (placed 'wherever there is room' it used to land in a wall column or on the chair's
        // spot, and the house then looped on a step it could never finish)
        let cur = plan[i];
        if (cur[0] === 'wall' || cur[0] === 'furn') {
          if (!self.houseBench()) {
            if (!self.has('work_bench')) {
              if (self.count('wood') < 10) { self.task = self.taskChop(self.count('wood') + 40); return; }
              self.task = self.taskCraftAtBase(['work_bench', 1]); return;
            }
            cur = plan.find(q => q[3] === 'work_bench');
          }
          // craft prerequisites first (at the bench: not before it stands)
          if (cur[3] !== 'work_bench') for (const [id, n] of Object.entries(needs)) {
            const placed = id === 'work_bench' ? !!self.houseBench() : id === 'wooden_door' ? [0, 1, 2].some(j => TILES[w.tile(hx, fy - 1 - j)]?.door) : id === 'wooden_chair' ? !!self.inHouse(t => t === T.CHAIR) : false;
            if (!placed && self.count(id) < (id === 'wood_wall' ? Math.min(n, 4) : 1) && !(id === 'wood_wall' && i >= plan.findIndex(q => q[0] === 'furn'))) {
              if (id === 'work_bench') continue;
              if (self.count('wood') < 12) { self.task = self.taskChop(self.count('wood') + 40); return; }
              if (self.blocked(id)) continue;
              self.task = self.taskCraftAtBase([id, id === 'wood_wall' ? 12 : 1]); return;
            }
          }
        }
        let [op, x, y, item] = cur;
        // furniture: any free floor spot inside the room will do (the planned one first)
        if (op === 'furn' && item !== 'wooden_door' && item !== 'torch') { const s = self.houseFurnSpot(item, x); if (s) [x, y] = s; }
        self.goal = 'building a house (' + i + '/' + plan.length + ': ' + op + ' ' + (item || '') + ' @' + x + ',' + y + ' ' + (TILES[w.tile(x, y)]?.name || 'air') + ')';
        // stand inside the house footprint near the target (outside it for the doorstep: from inside, its far end is out of reach
        // and the bot stood there forever until the watchdog fired)
        const standX = x >= hx && x <= hx + 10 ? clamp(x, hx + 2, hx + 8) : x < hx ? Math.min(x + 2, hx - 1) : Math.max(x - 2, hx + 11);
        let standY = fy - 1; while (standY > fy - 4 && (w.solid(standX, standY) || w.solid(standX + 1, standY) || w.solid(standX, standY - 1))) standY--;
        if (!p.inReach(x, y) || Math.abs(self.feet()[0] - standX) > 4) {
          const r = self.moveTo(standX, standY, 1);
          if (r === 'fail' || (r === true && !p.inReach(x, y) && ++this.unreach > 60)) { this.unreach = 0; this.fails = (this.fails || 0) + 1; if (this.fails > 5 || r === true) { this.fails = 0; self.log('house: skipping ' + op + ' ' + x + ',' + y + ' (unreachable)'); i++; } }
          return;
        }
        this.unreach = 0;
        this.fails = 0;
        if (op === 'clear' || op === 'dig') { self.dig(x, y); return; }
        const id = op === 'block' ? 'wood' : op === 'wall' ? 'wood_wall' : item;
        const s = self.slotOf(it => it.id === id);
        if (s < 0) { if (id === 'wood') { self.task = self.taskChop(self.count('wood') + 30); } else self.task = self.taskCraftAtBase([id, id === 'wood_wall' ? 12 : 1]); return; }
        if (s > 9) { self.ensureHotbar(s); return; }
        self.selectSlot(s);
        if (op === 'block' && p.overlapsTile(x, y)) { self.hold(x > self.feet()[0] ? 'a' : 'd'); return; }
        // furniture (or a pot) standing where a wall/floor block goes: break it first, it is placed again inside later
        const occ = w.tile(x, y);
        if (op === 'block' && occ && !TILES[occ].solid && !TILES[occ].cut) { self.dig(x, y); return; }
        self.aimTile(x, y); self.clickOnce();
        if (this.triesI !== i) { this.triesI = i; this.tries = 0; }
        if (++this.tries > 120) { this.tries = 0; self.log('house: giving up on ' + op + ' ' + x + ',' + y); i++; }
      },
    };
  },
  pickHouseSite() {
    const w = G.world;
    if (this.houseSpot) return;
    // find flat-ish ground near spawn, ideally right around it: we respawn at the spawn point, so with the house built over it
    // every respawn lands inside (a spawn point in the door column respawned us on the roof or held the door open at night)
    const nc = w.noclipAt;
    for (let d = 0; d < 80 && !this.houseSpot; d++) for (const s of [1, -1]) {
      const x0 = w.spawnX - 5 + d * s;
      const ys = []; for (let i = 0; i < 11; i++) ys.push(topSolid(w, x0 + i));
      if (ys.some(y => y < 0)) continue;
      // the Backrooms glitch block floats at jump height: never build (or jump around) under it
      if (nc && nc[0] >= x0 - 5 && nc[0] <= x0 + 14 && nc[1] >= Math.min(...ys) - 14) continue;
      if (Math.max(...ys) - Math.min(...ys) <= 3 && !ys.some((y, i) => w.liq(x0 + i, y - 1))) { this.houseSpot = [x0, Math.max(...ys)]; break; }
    }
    if (!this.houseSpot) this.houseSpot = [w.spawnX + 3, topSolid(w, w.spawnX + 3)];
    this.base = [this.houseSpot[0] + 5, this.houseSpot[1] - 1];
    this.log('house site at ' + this.houseSpot);
  },
  // the build order: [op, x, y, item]
  housePlan() {
    const [hx, fy] = this.houseSpot;
    // plan: [op, x, y, item]
    const plan = [];
    for (let y = fy - 7; y <= fy - 1; y++) for (let x = hx; x <= hx + 10; x++) plan.push(['clear', x, y]);
    // a doorstep: clear two columns outside the door so the house can actually be left
    for (let y = fy - 4; y <= fy - 1; y++) for (let x = hx - 3; x <= hx - 1; x++) plan.push(['clear', x, y]);
    for (let x = hx; x <= hx + 10; x++) plan.push(['block', x, fy]);
    for (let y = fy - 1; y >= fy - 6; y--) { plan.push(['block', hx, y, y >= fy - 3 ? 'doorcell' : undefined]); plan.push(['block', hx + 10, y]); }
    for (let x = hx; x <= hx + 10; x++) plan.push(['block', x, fy - 6]);
    // the door opening is cut out of the finished wall (a block needs a neighbour to attach to)
    for (let y = fy - 3; y <= fy - 1; y++) plan.push(['dig', hx, y]);
    for (let y = fy - 5; y <= fy - 1; y++) for (let x = hx + 1; x <= hx + 9; x++) plan.push(['wall', x, y]);
    for (let y = fy - 3; y <= fy - 1; y++) plan.push(['wall', hx, y]);
    // bench and chair at the far end: the 5 columns by the door stay free for the furnace (3) and the anvil (2)
    plan.push(['furn', hx, fy - 1, 'wooden_door'], ['furn', hx + 8, fy - 1, 'work_bench'], ['furn', hx + 7, fy - 1, 'wooden_chair'], ['furn', hx + 5, fy - 4, 'torch']);
    // the doorstep must be walkable: floor in front of the door and nothing solid at body height (the terrain bump the first clear pass missed)
    for (let x = hx - 1; x >= hx - 3; x--) plan.push(['block', x, fy]);
    for (let x = hx - 1; x >= hx - 3; x--) for (let y = fy - 1; y >= fy - 4; y--) plan.push(['dig', x, y]);
    return plan;
  },
  // wood the rest of the house still needs (blocks, bench, door, chair, walls): the build action is 'ready' once we carry it
  houseWoodNeed() {
    if (!this.houseSpot) return 90;
    const plan = this.housePlan(); let n = 0;
    for (const st of plan) if (!this.planStepDone(st)) n += st[0] === 'block' ? 1 : st[0] === 'wall' ? 0.25 : st[0] === 'furn' ? ({ work_bench: 10, wooden_door: 6, wooden_chair: 4 }[st[3]] || 0) : 0;
    for (const id of ['work_bench', 'wooden_door', 'wooden_chair']) if (this.has(id)) n -= { work_bench: 10, wooden_door: 6, wooden_chair: 4 }[id];
    return Math.max(0, Math.ceil(n - this.count('wood_wall') / 4));
  },
  planStepDone([op, x, y, item]) {
    const w = G.world, t = w.tile(x, y), td = TILES[t];
    if (this.badTiles && this.badTiles.has(x + ',' + y)) return true;
    if (op === 'clear') return !t || (td && (td.cut || td.door || td.torch || (td.multi && !td.solid) || t === T.WOOD));   // furniture and stations stay
    if (op === 'dig') return !t || (td && td.door);
    // the door cells are filled only to hold up the wall above them while it is built, and cut open later: once the frame
    // above stands, an open door cell is fine (a restarted build used to fill the doorway in again and re-dig it)
    if (op === 'block' && item === 'doorcell' && !(td && td.solid) && this.houseSpot) return w.solid(x, this.houseSpot[1] - 4) && w.solid(x, this.houseSpot[1] - 6);
    if (op === 'block') return td && td.solid && !td.door ? true : (td && td.door);
    if (op === 'wall') return w.wall(x, y) !== 0 || (td && td.door);
    if (op === 'furn') { const want = ITEMS[item].place; return t === want || (want === T.DOOR_CLOSED && td && td.door) || ((want === T.WORKBENCH || want === T.CHAIR) && !!this.inHouse(q => q === want)); }
    return true;
  },
  // the first tile inside the house room matching pred (furniture can stand anywhere in it)
  inHouse(pred) {
    const h = this.houseSpot; if (!h) return null;
    const w = G.world;
    for (let y = h[1] - 5; y <= h[1] - 1; y++) for (let x = h[0] + 1; x <= h[0] + 9; x++) if (pred(w.tile(x, y))) return [x, y];
    return null;
  },
  houseBench() { return this.houseSpot ? this.inHouse(t => t === T.WORKBENCH) : this.nearestTile(t => t === T.WORKBENCH, 10, 6, this.base); },
  // a click tile for `item` on the house floor: the planned column if it fits, else the nearest free one (never right inside the door)
  houseFurnSpot(item, prefX) {
    const h = this.houseSpot, w = G.world, t = ITEMS[item].place, td = TILES[t];
    const mw = td.multi ? td.multi[0] : 1, mh = td.multi ? td.multi[1] : 1, y = h[1] - 1;
    const xs = []; for (let x = h[0] + 2; x <= h[0] + 9; x++) xs.push(x);
    xs.sort((a, b) => Math.abs(a - prefX) - Math.abs(b - prefX));
    for (const x of xs) {
      const ox = x - Math.floor((mw - 1) / 2), oy = y - (mh - 1);
      if (ox < h[0] + 2 || ox + mw - 1 > h[0] + 9) continue;
      if (w.canPlaceObject(ox, oy, t)) return [x, y];
    }
    return null;
  },
  // ================= bosses: the end goal (King Skibidi, Eye of Ohio, Tung Tung Tung Sahur, then the Wall in Ohio) =================
  // get the summon item (craft it, or farm the monster drop it is missing), go home, summon it, and let the tactic layer fight
  taskBoss(key) {
    const self = this, w = G.world, B = BOSS_SUMMON[key], name = BOSS_TYPES[key].name;
    this.goal = 'preparing for ' + name;
    let sub = null, wander = 0;
    return {
      step() {
        const p = self.p(), [fx, fy] = self.feet();
        if (w.flags[key]) { this.done = true; return; }
        if (G.npcs.some(n => n.boss)) { self.goal = 'boss fight: ' + name; this.done = true; return; }   // the boss shows up as a fight option
        if (sub && !sub.done) { sub.step(); return; }
        const home = self.base || self.houseSpot || self.feet();
        const nightOk = !B.night || G.isNight();
        if (self.has(B.item)) {
          // summon at home on the surface, healthy: not wherever we happen to be standing
          if (!nightOk) {
            if (self.ticksToNight() > 2500) { this.done = true; return; }   // a whole day ahead: go do something useful first
            self.goal = 'waiting for night to summon ' + name; self.moveTo(home[0] - 6, home[1], 3); return;
          }
          // every boss comes to wherever we are: get to the surface right here (Tung's perch gets built next to us)
          if (fy > topSolid(w, fx) + 3 && !(self.perch && (self.perch.kind === 'arena') === (key === 'eye_of_cthulhu') && Math.abs(fx - self.perch[0]) <= (self.perch.len || self.LEDGE) + 1)) { self.goal = 'climbing to the surface to summon ' + name; if (self.moveTo(fx, topSolid(w, fx) - 1, 3) === 'fail') self.moveTo(home[0] - 6, home[1], 3); return; }
          if (p.life < p.lifeMax * 0.85) { self.goal = 'healing up before ' + name; return; }
          if (!self.bossReady(key)) { self.log('not ready for ' + name + ' yet'); this.done = true; return; }
          // The Eye: like a player, fight it from a long flat strip of wood platforms ~8 tiles over the ground. Running on flat
          // footing is what lets eyeDance's dash planner work (its model assumes a flat floor), zombies and toilets can't reach it,
          // and the Eye's dashes and our shots pass through platforms.
          if (key === 'eye_of_cthulhu' && !(self.arenaFailed && G.tick - self.arenaFailed < 20000)) {
            const L = self.ARENA_LEN;
            if (self.perch && (self.perch.kind !== 'arena' || (Math.abs(fx - self.perch[0]) > 80 && !self.onArena()))) self.perch = null;
            const want = L + 14;   // the strip plus a platform pillar up to it (blocks do the pillar if wood is short)
            if (!self.perch && self.count('wood_platform') < want && self.count('wood') >= 1 && !this.crafted) {
              this.crafted = true;
              sub = self.taskCraftAtBase(['wood_platform', Math.min(self.count('wood'), Math.ceil((want - self.count('wood_platform')) / 2))]); return;
            }
            if (!self.perch && self.count('wood_platform') < L) {
              const need = Math.ceil((L - self.count('wood_platform')) / 2);
              if ((this.chops = (this.chops || 0) + 1) <= 2) { sub = self.taskChop(need + 5); return; }   // 15 wood buys the whole strip
              self.log('not enough wood for an arena, fighting on the ground'); self.arenaFailed = G.tick;
            } else {
              const site = self.perch || self.eyeArenaSite([fx, fy]);
              if (!site) { self.log('no arena site here, fighting on the ground'); self.arenaFailed = G.tick; }
              else {
                self.perch = site;
                const pr0 = self.perch, trees = pr0.cleared ? [] : self.arenaTrees(pr0[0], pr0[2], pr0[1], pr0[3], L);   // (once building, our own pillar is in the way)
                if (!trees) { self.log('arena site got blocked, picking another'); self.perch = null; return; }
                if (trees.length) {   // fell the trees in the way, nearest first, standing beside the trunk
                  const [tx, ty] = trees.sort((a, b) => Math.abs(a[0] - fx) - Math.abs(b[0] - fx))[0];
                  self.goal = 'clearing trees for the ' + name + ' arena';
                  const side = fx <= tx ? tx - 1 : tx + 1, r = self.moveTo(side, ty, 1);
                  if (r === 'fail') { self.log('cannot reach a tree in the arena, fighting on the ground'); self.perch = null; self.arenaFailed = G.tick; return; }
                  if (r || self.p().inReach(tx, ty)) { const ax = self.bestSlot('axe'); if (ax > 9) { self.ensureHotbar(ax); return; } self.selectSlot(ax); self.aimTile(tx, ty); self.clickHold(); }
                  return;
                }
                pr0.cleared = true;
                const r = self.climbPerch();
                if (r === 'fail') { self.log('arena build failed, fighting on the ground'); self.perch = null; self.arenaFailed = G.tick; return; }
                if (r !== true) { self.goal = 'building an arena for ' + name; return; }
                const pr = self.perch, far = pr[0] + pr[3] * (pr.len - 2), near = pr[0] + pr[3] * 3;
                self.arena = { x0: Math.min(near, far), x1: Math.max(near, far), floor: pr[1] + 1 };
              }
            }
          }
          // Tung only reaches ~12 tiles up (leap), its shockwaves run along the ground and its logs arc ~8 tiles high:
          // fight it from a 25-tile pillar next to the house, like a human would
          if (key === 'tung_sahur') {
            if (!self.perch && self.count('wood_platform') < self.LEDGE && self.count('wood') >= 5) { sub = self.taskCraftAtBase(['wood_platform', Math.ceil((self.LEDGE - self.count('wood_platform')) / 2)]); return; }
            if (self.perch && ((Math.abs(fx - self.perch[0]) > 80 && !self.onPerch()) || self.perch.kind === 'arena')) self.perch = null;   // an old perch far away (or the Eye's low arena): build a new one here
            const perch = self.perch || (self.count('wood_platform') >= self.LEDGE && self.spareBlocks() - self.count('wood') >= self.PERCH_H + 2 ? self.tungPerch([fx, fy]) : null);
            const climbed = perch ? self.climbPerch() : true;   // true once on the spot with the fence up
            if (perch && climbed !== true) { self.goal = 'building a perch for ' + name; if (climbed === 'fail') { self.log('no perch for ' + name + ', fighting on the ground'); self.perch = null; self.perchFailed = G.tick; } return; }
          }
          const s = SDK.slotOf(B.item);
          if (s > 9) { self.ensureHotbar(s); return; }
          if (this.summonedAt && G.tick - this.summonedAt < 300) return;   // the item takes a moment to be used and the boss to appear
          self.selectSlot(s); self.clickOnce(); this.summonedAt = G.tick; self.log('summoning ' + name); self.milestone('summoned ' + key.replace(/_/g, ' '));
          return;
        }
        // natural spawns: the Eye and Tung come by themselves at night once life >= 200 — wait for them at home
        // (natural spawns need 200 life AND 10 defense and come 1 night in 3: farming the summon is the reliable way)
        const step = self.resolve(B.item, 1), pickPow = SDK.obs().inv.pick.power;
        if (step && self.stepFeasible(step, pickPow)) { self.commit(B.item, 1); sub = self.taskForStep(step); if (sub) return; }
        // the missing ingredient is a monster drop: go where that monster lives
        const need = Object.entries(self.rawNeeds(B.item, 1)).find(([id, n]) => self.count(id) < n);
        const drop = need ? need[0] : null, farm = BOSS_FARM[drop];
        if (!farm) { sub = self.taskExplore(); return; }
        self.goal = 'farming ' + drop.replace(/_/g, ' ') + ' for ' + name + ' (' + self.count(drop) + '/' + need[1] + ')';
        // no drop in 8000 ticks: this spot/plan isn't working, let the planner do something else for a while
        if (this.dropN !== self.count(drop)) { this.dropN = self.count(drop); this.dropAt = G.tick; }
        else if (G.tick - this.dropAt > 8000) { self.log('no ' + drop + ' in 8000 ticks, trying something else'); (self.cooldowns = self.cooldowns || {})['boss:' + key] = G.tick + 6000; this.done = true; return; }
        if (farm === 'night' && !G.isNight()) {
          if (self.ticksToNight() > 2500) { this.done = true; return; }
          self.goal = 'waiting for night (' + drop + ' drops at night)'; self.moveTo(home[0] - 6, home[1], 3); return;
        }
        const deep = farm === 'caverns';
        if (deep) {
          // roam the caverns (A* digs its own tunnels), meeting skeletons; move on when the area stops spawning
          const crowdD = G.npcs.filter(n => !n.friendly && !n.boss && !n.town && !n.dead && Math.abs(n.cx - self.p().cx) < 1600 && Math.abs(n.cy - self.p().cy) < 1000).length;
          this.clogD = crowdD >= 8 ? (this.clogD || 0) + 1 : 0;
          if (!this.deepT || this.clogD > 900 || (this.deepFails || 0) > 2) {
            const clogged = this.clogD > 900;
            this.clogD = 0; this.deepFails = 0; this.deepSide = -(this.deepSide || 1);
            const x0 = this.lastDeepX || home[0];
            if (clogged) self.log('cavern farm clogged (' + crowdD + ' monsters), moving 150 tiles over');
            // clogged: far enough that the stuck monsters despawn (150+ tiles); otherwise roam nearby
            this.deepT = [clamp(x0 + this.deepSide * (clogged ? 150 : randInt(25, 45)), 60, w.w - 60), clamp(w.rockLayer + randInt(15, 45), w.rockLayer + 5, w.hellLayer - 30)];
          }
          // a bone carrier on screen (skeletons, miners spawn in side caves and rarely find us): go get it, digging if needed
          const P = self.p(), prey = drop === 'bone' && G.npcs.filter(n => (n.type === 'skeleton' || n.type === 'undead_miner') && !n.dead && Math.abs(n.cx - P.cx) < 1000 && Math.abs(n.cy - P.cy) < 640 && !(self.ignore && self.ignore[n.uid] > G.tick))
            .sort((a, b) => dist(a.cx, a.cy, P.cx, P.cy) - dist(b.cx, b.cy, P.cx, P.cy))[0];
          if (prey && this.preyId === prey.uid && G.tick - this.preySince > 900) { (self.ignore = self.ignore || {})[prey.uid] = G.tick + 3600; this.preyId = null; return; }   // can't get to it
          if (prey) {
            if (this.preyId !== prey.uid) { this.preyId = prey.uid; this.preySince = G.tick; }
            self.goal = 'hunting ' + prey.name + ' for bones (' + self.count('bone') + '/' + need[1] + ')';
            const r = self.moveTo(Math.floor(prey.cx / TS), Math.floor((prey.y + prey.h - 1) / TS), 2);
            if (r === 'fail') (self.ignore = self.ignore || {})[prey.uid] = G.tick + 1800;
            return;
          }
          const r = self.moveTo(this.deepT[0], this.deepT[1], 4);
          if (r === 'fail') this.deepFails = (this.deepFails || 0) + 1;
          if (r === true) { this.lastDeepX = this.deepT[0]; this.deepT = null; }
          return;
        }
        // surface drops (gel by day, lenses at night): town NPCs cut spawns 3x within 60 tiles, so farm ~90 tiles out
        if (!this.farmX || this.farmFails > 2) {
          this.farmFails = 0; this.farmSide = -(this.farmSide || 1);
          this.farmX = clamp(home[0] + this.farmSide * 90, 60, w.w - 60);
        }
        // the spawn cap counts every hostile within 100x62 tiles (cave monsters far below included) and they only despawn
        // 150+ tiles away: a clogged area never spawns another Side-Eye, so move the farm 160 tiles over
        const crowd = G.npcs.filter(n => !n.friendly && !n.boss && !n.town && !n.dead && Math.abs(n.cx - p.cx) < 1600 && Math.abs(n.cy - p.cy) < 1000).length;
        this.clog = crowd >= (G.isNight() ? 6 : 4) ? (this.clog || 0) + 1 : 0;
        if (this.clog > 900) { this.clog = 0; this.farmX = clamp(this.farmX + this.farmSide * 160, 60, w.w - 60); if (this.farmX <= 60 || this.farmX >= w.w - 60) this.farmSide = -this.farmSide; self.log('farm area clogged (' + crowd + ' monsters), moving to x=' + this.farmX); }
        const fxT = this.farmX + (Math.floor(G.tick / 600) % 2 ? 12 : -12);
        const r = self.moveTo(fxT, topSolid(w, fxT) - 1, 3);
        if (r === 'fail') this.farmFails = (this.farmFails || 0) + 1;
      },
    };
  },
  // Perch for Tung: a 32-tile dirt pillar next to the house with an 8-tile wood-platform ledge out to one side. Tung's leap (even
  // launched off a hop against the pillar) tops out ~24 tiles up; standing near the end of the ledge there is only air (and a
  // platform, which projectiles pass through) between us and Tung, so The 67's shots go straight down into it.
  PERCH_H: 32, LEDGE: 8,
  tungPerch(home) {
    if (this.perchFailed && G.tick - this.perchFailed < 20000) return null;
    if (this.perch) return this.perch;
    const w = G.world;
    for (const dx of [-12, 12, -18, 18, -24, 24, -8, 8]) {
      const x = home[0] + dx, gy = topSolid(w, x) - 1;
      if (Math.abs(gy - home[1]) > 12) continue;
      for (const dir of [dx < 0 ? -1 : 1, dx < 0 ? 1 : -1]) if (this.perchOpen(x, gy, dir)) return (this.perch = [x, gy - this.PERCH_H, gy, dir]);   // [pillar column, standing row on top, ground row, ledge direction]
    }
    return null;
  },
  // Eye arena: a pillar up to `stand` and a strip of ARENA_LEN platforms along row stand+1, 7+ rows over the highest ground under it
  // (ground mobs can't jump that high) and at most 20 over the lowest (a knock off the edge must not be a deadly fall)
  ARENA_LEN: 30,
  eyeArenaSite(at) {
    const w = G.world, L = this.ARENA_LEN;
    let best = null;
    for (const off of [0, -12, 12, -24, 24, -40, 40, -60, 60]) for (const dir of [1, -1]) {
      const x = at[0] + off, gy = topSolid(w, x) - 1;
      if (gy < 5 || Math.abs(gy - at[1]) > 30) continue;
      let hi = 1e9, lo = -1e9;
      for (let i = 0; i <= L + 1; i++) { const t = topSolid(w, x + dir * i); if (t < 0) { hi = -1; break; } hi = Math.min(hi, t); lo = Math.max(lo, t); }
      if (hi < 0) continue;   // water under it
      const stand = hi - 9;   // feet row; platforms on stand+1, 7 clear rows above the highest ground
      if (lo - stand > 21 || gy - stand < 4) continue;
      const trees = this.arenaTrees(x, gy, stand, dir, L);
      if (!trees) continue;
      const cost = trees.length * 3 + Math.abs(off) / 12;
      if (!best || cost < best.cost) { const pr = [x, stand, gy, dir]; pr.len = L; pr.kind = 'arena'; best = { cost, pr }; }
    }
    return best && best.pr;
  },
  // what stands where the pillar, the strip and its headroom go: null if anything but trees (and low plants), else the trees to
  // fell first (their lowest trunk cell; chopping it brings the whole tree down and pays for the platforms)
  arenaTrees(x, gy, stand, dir, L) {
    const w = G.world, trees = new Map();
    const cell = (cx, y) => {
      const t = w.tile(cx, y); if (!t) return true;
      if (t === T.TREE) { let b = y; while (w.tile(cx, b + 1) === T.TREE) b++; trees.set(cx, [cx, b]); return true; }
      return !!(TILES[t].cut && y > stand + 1);
    };
    for (let y = stand - 3; y <= gy; y++) if (!cell(x, y)) return null;   // the pillar column
    // the strip and its headroom (one row of slack below: the pillar can top out a row lower, and the strip comes with it)
    for (let i = 1; i <= L + 1; i++) for (let y = stand - 4; y <= stand + 2; y++) if (!cell(x + dir * i, y)) return null;
    return [...trees.values()];
  },
  onArena() { const pr = this.perch; if (!pr || pr.kind !== 'arena') return false; const [fx, fy] = this.feet(); return fy === pr[1] && (fx - pr[0]) * pr[3] >= 0 && (fx - pr[0]) * pr[3] <= pr.len; },
  // open sky over the pillar column (nothing at all in it) and the ledge (plants are fine low down)
  perchOpen(x, gy, dir) {
    const w = G.world;
    for (let i = -1; i <= this.LEDGE + 1; i++) for (let y = gy - this.PERCH_H - 4; y <= (i <= 1 ? gy : gy - 6); y++) {
      const t = w.tile(x + dir * i, y);
      if (t && !(TILES[t].cut && i !== 0)) return false;
    }
    return true;
  },
  perchSpot() { const pr = this.perch; return [pr[0] + pr[3] * ((pr.len || this.LEDGE) - 1), pr[1]]; },
  // walk to the pillar column and pillar straight up (jump, drop a block under our feet as they clear the next cell),
  // then lay the platform ledge (each one attaches to the last) and walk out to the spot one short of its end
  perchFail(why) { this.log('perch: ' + why); return 'fail'; },
  climbPerch() {
    const pr = this.perch, p = this.p(), w = G.world, [fx, fy] = this.feet(), dir = pr[3];
    if (this.onPerch()) {
      if (Math.abs(p.vx) > 0.4) this.hold(p.vx > 0 ? 'a' : 'd');
      // a 2-block fence past the spot: night flyers' knockback must not throw us off the end of the ledge
      const [sx, sy] = this.perchSpot(), fxc = sx + dir;
      for (const fy2 of [sy, sy - 1]) if (!w.tile(fxc, fy2) && !pr.noFence) {
        const bs = this.spareBlockSlot(false);
        if (bs < 0 || (this.fenceTries = (this.fenceTries || 0) + 1) > 240) { pr.noFence = true; break; }
        if (bs > 9) { this.ensureHotbar(bs); return false; }
        this.selectSlot(bs); this.aimTile(fxc, fy2); if (p.itemAnim === 0) this.clickOnce();
        return false;
      }
      return true;
    }
    const onTop = fy <= pr[1] + 1 && p.onGround && fy >= pr[1] - 1 && Math.abs(fx - pr[0]) <= (pr.len || this.LEDGE);
    if (onTop) {
      if (fx === pr[0] && fy !== pr[1] && w.tile(pr[0] + dir, pr[1] + 1) !== T.PLATFORM) { pr[1] = fy; return false; }   // the pillar top is where we stand
      const row = pr[1] + 1;
      // ledge: the first missing platform cell, placed from where we stand
      let k = 1; while (k <= (pr.len || this.LEDGE) && w.tile(pr[0] + dir * k, row) === T.PLATFORM) k++;
      if (k <= (pr.len || this.LEDGE)) {
        // an arena strip that's 20+ long is plenty (the dash dodge works on 20 tiles): stop there rather than fail
        const shortOk = pr.kind === 'arena' && k - 1 >= 20, cut = () => { pr.len = k - 1; this.log('arena strip ends at ' + (k - 1) + ' platforms'); return false; };
        if (!this.has('wood_platform')) return shortOk ? cut() : this.perchFail('out of platforms');
        const s = this.slotOf(it => it.id === 'wood_platform');
        if (s > 9) { this.ensureHotbar(s); return false; }
        this.selectSlot(s);
        const out = (pr[0] + dir * k - fx) * dir;   // build reach is ~5 tiles: walk out along the platforms already down
        if (out > 3) { this.hold(dir > 0 ? 'd' : 'a'); return false; }
        if (Math.abs(p.vx) > 0.4) this.hold(p.vx > 0 ? 'a' : 'd');
        this.aimTile(pr[0] + dir * k, row); if (p.itemAnim === 0) this.clickOnce();
        if (!this.perchPlace || this.perchPlace.k !== k) this.perchPlace = { k, at: G.tick };
        else if (G.tick - this.perchPlace.at > 300) return shortOk ? cut() : this.perchFail('platform ' + k + ' would not place');
        return false;
      }
      const [sx] = this.perchSpot();
      if (fx !== sx) this.hold(sx > fx ? 'd' : 'a');
      return false;
    }
    // the pillar from an earlier attempt is still standing: pillar up again right beside it (away from the ledge)
    if (w.solid(pr[0], pr[2]) && w.solid(pr[0], pr[1] + 1) && !pr.climb) pr.climb = pr[0] - dir;   // (a platform pillar is a ladder: we just jump up it)
    const cc = pr.climb != null ? pr.climb : pr[0];
    if (pr.climb != null && fx === cc && fy <= pr[1] + 1 && p.onGround) { this.hold(dir > 0 ? 'd' : 'a'); return false; }   // up: step over onto the old pillar
    if (fx !== cc) {
      if (fy < pr[2] - 8 && p.onGround && pr.kind !== 'arena') return this.perchFail('up on the wrong column ' + fx + ',' + fy);   // up in the air on the wrong column
      // standing right next to the spot on the same ground: the pillar can just as well go here
      const openHere = pr.kind === 'arena' ? (t => t && !t.length)(this.arenaTrees(fx, fy, pr[1], pr[3], pr.len)) : this.perchOpen(fx, fy, pr[3]);
      if (pr.climb == null && Math.abs(fx - pr[0]) <= 3 && Math.abs(fy - pr[2]) <= 2 && p.onGround && openHere) { pr[0] = fx; pr[2] = fy; if (pr.kind !== 'arena') pr[1] = fy - this.PERCH_H; }
      else { const r = this.moveTo(cc, pr[2], 0); return r === 'fail' ? this.perchFail('cannot walk to the pillar spot') : false; }   // exactly there (tolerance 1 "arrives" next to it and never climbs)
    }
    // the arena's pillar is platforms when there are enough left for the strip too (no dirt to dig back out), else blocks
    const ledgeLeft = (pr.len || this.LEDGE) - [...Array(pr.len || this.LEDGE)].filter((_, i) => w.tile(pr[0] + dir * (i + 1), pr[1] + 1) === T.PLATFORM).length;
    // (not Tung's perch: Tung lands on any platform on the way up and leaps again, so its pillar stays solid blocks)
    const plat = pr.kind === 'arena' && this.count('wood_platform') >= ledgeLeft + Math.max(0, fy - pr[1]) + 2;
    const bs = plat ? this.slotOf(it => it.id === 'wood_platform') : this.spareBlockSlot(false);
    if (bs < 0) return this.perchFail('out of blocks (' + this.spareBlocks() + ' spare)');
    if (bs > 9) { this.ensureHotbar(bs); return false; }
    this.selectSlot(bs);
    // the cell on top of the stack under us (blocks or platforms); place it once our feet have cleared it
    const col = Math.floor(p.cx / TS), under = y => w.solid(col, y) || w.tile(col, y) === T.PLATFORM;
    let top = Math.floor((p.y + p.h - 1) / TS) + 1; while (top < pr[2] + 2 && !under(top)) top++;
    const cell = top - 1;
    const occ = w.tile(col, cell);
    if (occ && !TILES[occ].solid && occ !== T.PLATFORM) { if (this.dig(col, cell) === 'fail') return this.perchFail('cannot clear ' + TILES[occ].name); return false; }   // grass, a sapling...
    if (p.onGround) this.jump();
    else if (p.y + p.h <= cell * TS - 1 && !w.tile(col, cell)) { this.aimTile(col, cell); this.clickOnce(); }
    return false;
  },
  onPerch() { if (!this.perch) return false; const [sx, sy] = this.perchSpot(), [fx, fy] = this.feet(); return Math.abs(fx - sx) <= 1 && fy >= sy - 4 && fy <= sy + 1; },
  ticksToNight() { const w = G.world; return w.dayTime ? DAY_LEN - w.time : 0; },
  taskEye() { return this.taskBoss('eye_of_cthulhu'); },
  // what the Brainrot still owes us: the nightmare pickaxe (Ohio's hellstone), then the Brainrot armor set while we're below the
  // Wall's defense gate (The 67 stays the weapon: Light's Bane / the Brainrot bow land far less)
  SHADOW_SET: ['shadow_helmet', 'shadow_scalemail', 'shadow_greaves'],
  brainrotWants() {
    const p = this.p(), out = [];
    if (!this.hasBetterPick(65)) out.push('nightmare_pickaxe');
    if (p.calc.defense < BOSS_READY.wall_of_flesh.def) for (const id of this.SHADOW_SET) {
      const cur = p.armor[{ head: 0, body: 1, legs: 2 }[ITEMS[id].armor]];
      if (!this.owns(id) && (cur ? ITEMS[cur.id].defense || 0 : 0) < ITEMS[id].defense) out.push(id);
    }
    return out;
  },
  brainrotNeeds() {
    const acc = {};
    for (const id of this.brainrotWants()) this.rawNeeds(id, 1, acc);
    return { chunks: acc.rotten_chunk || 0, ore: acc.demonite_ore || 0 };
  },
  taskBrainrot() {
    const self = this, w = G.world;
    const N = this.brainrotNeeds();
    this.goal = 'farming Brainrot (chunks ' + this.count('rotten_chunk') + '/' + N.chunks + ', ore ' + this.count('demonite_ore') + '/' + N.ore + ')';
    return {
      step() {
        const n = self.brainrotNeeds();   // shrinks as bars and pieces get made
        const chunksOk = self.count('rotten_chunk') >= n.chunks, oreOk = self.count('demonite_ore') >= n.ore;
        if (!self.brainrotWants().length || (chunksOk && oreOk)) { this.done = true; return; }
        if (!chunksOk) {
          // Doomscrollers get stuck in the chasms below (out of sight, never dying) and fill the spawn cap, so no new ones come:
          // go down to them like a player would (the digging A*, to the floor under one), give up on one after 900 ticks
          const P = self.p(), ign = self.ignore = self.ignore || {};
          const prey = G.npcs.filter(m => m.type === 'eater_of_souls' && !m.dead && Math.abs(m.cx - P.cx) < 1600 && Math.abs(m.cy - P.cy) < 1000 && !(ign[m.uid] > G.tick))
            .sort((a, b) => dist(a.cx, a.cy, P.cx, P.cy) - dist(b.cx, b.cy, P.cx, P.cy))[0];
          self.goal = 'hunting Doomscrollers for chunks (' + self.count('rotten_chunk') + '/' + n.chunks + ')';
          if (prey) {
            if (this.preyId !== prey.uid) { this.preyId = prey.uid; this.preySince = G.tick; }
            if (G.tick - this.preySince > 900) { ign[prey.uid] = G.tick + 3600; this.preyId = null; return; }
            const px = Math.floor(prey.cx / TS); let py = Math.floor(prey.cy / TS); while (py < w.h - 1 && !w.solid(px, py + 1) && py - Math.floor(prey.cy / TS) < 12) py++;
            if (self.moveTo(px, py, 3) === 'fail') ign[prey.uid] = G.tick + 1800;
            return;
          }
          const bx = w.biomes.rotX; self.moveTo(bx + (Math.floor(self.t / 900) % 2 ? 20 : -20), topSolid(w, bx) - 1, 4); return;
        }
        if (!this.sub || this.sub.done) this.sub = self.taskMine('ore', () => self.count('demonite_ore') >= self.brainrotNeeds().ore, [T.DEMONITE]);
        this.sub.step();
      },
    };
  },
  // ---- Wall of Brainrot arena ----
  // Ohio's cavern is a floorless void over a lava sea, the Wall sweeps the whole world at 1.3..3.9 px/tick, and Ohio's flyers ignore
  // walls (so a rock tunnel is a death trap: nothing there can be shot). A human lands on one of the floating ash islands, lays a long
  // block bridge along its row, then drops the doll off the island's edge into the lava and retreats along the bridge, shooting.
  blockCount() { return ['stone_block', 'ash_block', 'dirt_block', 'mud_block', 'clay_block', 'sand_block'].reduce((n, id) => n + this.count(id), 0); },
  // a floating platform >= 6 wide in the cavern with lava under the side the doll is dropped to and open runway on the other side
  findIsland(fx) {
    const w = G.world, lava = (x, y) => w.liq(x, y) > 100 && w.ltype[w.idx(x, y)] === 1;
    const lavaBelow = (x, y) => { for (let j = y + 1; j < w.h - 1; j++) { if (w.solid(x, j)) return false; if (lava(x, j)) return true; } return false; };
    const stand = (x, y) => { if (!w.solid(x, y + 1) || !w.solid(x + 1, y + 1)) return false; for (let j = 0; j < 3; j++) if (w.solid(x, y - j) || w.solid(x + 1, y - j)) return false; return true; };
    let best = null;
    for (let y = w.hellLayer + 20; y <= w.hellLayer + 50; y++) {
      for (let x = 20; x < w.w - 22;) {
        if (!stand(x, y)) { x++; continue; }
        let x1 = x; while (stand(x1 + 1, y)) x1++;
        if (x1 - x >= 5) {
          let west = 0, east = 0;
          for (let k = 3; k <= 9; k++) { if (lavaBelow(x - k, y)) west++; if (lavaBelow(x1 + 2 + k, y)) east++; }
          for (const dir of [1, -1]) {
            const lv = dir > 0 ? west : east, room = dir > 0 ? w.w - 40 - x1 : x - 40;
            if (lv < 6 || room < 300) continue;
            // standing column for the throw (the island edge the doll leaves from) and where the bridge ends
            const col = dir > 0 ? x + 1 : x1, xEnd = col + dir * Math.min(room - 10, 320);
            const cost = Math.abs(col - fx) + (y - w.hellLayer) * 0.5;
            if (!best || cost < best.cost) best = { x0: x, x1, y, dir, col, xEnd, cost };
          }
        }
        x = x1 + 1;
      }
    }
    return best;
  },
  // lay a straight 1-block-wide runway along row Y heading `dir`: clear the way, keep two floor cells placed ahead while walking; true at xt
  lineStep(dir, Y, xt) {
    const w = G.world, p = this.p(), [fx, fy] = this.feet();
    if (dir * (fx - xt) >= 0) return true;
    if (fy !== Y) { const r = this.moveTo(fx, Y, 0); return r === 'fail' ? 'off' : false; }
    for (const c of [fx + dir, fx + 2 * dir]) for (const r of [Y, Y - 1, Y - 2]) {
      if (w.solid(c, r)) { if (this.dig(c, r) === 'fail') return 'bad'; return false; }
    }
    const need = [fx + dir, fx + 2 * dir, fx + 3 * dir].find(c => !w.solid(c, Y + 1));
    if (need !== undefined) {
      const bs = this.spareBlockSlot(false);
      if (bs < 0) return 'noblocks';
      if (bs > 9) { this.ensureHotbar(bs); return false; }
      this.selectSlot(bs);
      const occ = w.tile(need, Y + 1);
      if (occ && !TILES[occ].solid && !TILES[occ].cut) { this.dig(need, Y + 1); return false; }
      this.aimTile(need, Y + 1);
      if (p.itemAnim === 0) this.clickOnce();
      if (need === fx + dir) { if (Math.abs(p.vx) > 0.6) this.hold(p.vx > 0 ? 'a' : 'd'); return false; }   // no floor right ahead: wait for it
    }
    this.hold(dir > 0 ? 'd' : 'a');
    return false;
  },
  // stand in column `col` (cx in its middle) on row Y; true when there
  alignAt(col, Y) {
    const p = this.p(), [fx, fy] = this.feet();
    if (Math.abs(fx - col) > 3 || fy !== Y) { const r = this.moveTo(col, Y, 2); return r === 'fail' ? 'fail' : false; }
    const mid = col * TS + 8;
    if (fx === col && Math.abs(p.cx - mid) < 5 && Math.abs(p.vx) < 0.3) return true;
    this.hold(p.cx < mid ? 'd' : 'a');
    return false;
  },
  taskHell() {
    const self = this, w = G.world;
    this.goal = 'going to Ohio';
    let huntT = 0, throwTries = 0, sub = null, bridgeFails = 0;
    const H = this.hell = this.hell || {};
    const fail = (t, why) => { self.log('Ohio plan failed: ' + why); H.fails = (H.fails || 0) + 1; t.done = true; self.cooldowns = self.cooldowns || {}; self.cooldowns['going to'] = G.tick + 9000; if (H.fails >= 3) { delete H.x0; H.fails = 0; } };
    return {
      step() {
        const p = self.p(), [fx, fy] = self.feet();
        if (w.flags.wall_of_flesh) { this.done = true; return; }
        // Ohio chews through ~0.1 life/tick and only 0.2/s regenerates while being hit: work in sorties, heal at home in between
        if (p.life < p.lifeMax * 0.5 && H.ph !== 'prep') H.healing = true;
        if (H.healing) {
          if (p.life >= p.lifeMax * 0.92) H.healing = false;
          else {
            const bx = self.base[0], by = self.base[1];
            if (Math.abs(fx - bx) < 10 && Math.abs(fy - by) < 8) { self.goal = 'resting at home before going back to Ohio'; return; }
            self.goal = 'leaving Ohio to heal (' + Math.round(p.life) + '/' + p.lifeMax + ')'; self.moveTo(bx, by, 2); return;
          }
        }
        if (!H.x0) {
          const isl = self.findIsland(fx);
          if (!isl) return fail(this, 'no island');
          Object.assign(H, isl, { ph: 'prep' });
          self.log('Ohio plan: island ' + isl.x0 + '-' + isl.x1 + '@' + isl.y + ', stand at ' + isl.col + ', bridge ' + (isl.dir > 0 ? 'east' : 'west') + ' to ' + isl.xEnd);
        }
        const dir = H.dir;
        // 1) enough blocks for the whole runway
        if (H.ph === 'prep') {
          if (self.blockCount() >= Math.abs(H.xEnd - H.col) + 60) H.ph = 'descend';
          else { sub = sub || self.taskMine('stone', () => self.blockCount() >= Math.abs(H.xEnd - H.col) + 120); sub.step(); if (sub.done) sub = null; self.goal = 'mining blocks for the Wall bridge'; return; }
        }
        // 2) down to the island (shaft from the surface, then a drop onto it)
        if (H.ph === 'descend') {
          self.goal = 'going to Ohio';
          if (fy === H.y && Math.abs(fx - H.col) <= 2) { H.ph = 'bridge'; self.milestone('reached Ohio'); }
          else {
            // the whole route is too long for one plan: go down in legs of ~45 tiles (the planner handles drops and digging)
            if (!this.leg) {   // fixed until reached or failed
              let lx = H.col + (this.legShift || 0); const ly = Math.min(H.y, fy + 45), b = w.backrooms;
              // the Backrooms are a real room underground: entering it means the EXIT sign teleports us back up. Go around it.
              if (b && fy < b.y0 + b.h + 4 && ly > b.y0 - 6 && lx > b.x0 - 8 && lx < b.x0 + b.w + 8) lx = Math.abs(fx - (b.x0 - 10)) < Math.abs(fx - (b.x0 + b.w + 10)) ? b.x0 - 10 : b.x0 + b.w + 10;
              this.leg = [lx, ly];
            }
            const [legX, legY] = this.leg;
            const r = self.moveTo(legX, legY, legY === H.y ? 1 : 6);
            if (r === true) { this.legFails = 0; this.leg = null; if (legY === H.y) { H.ph = 'bridge'; self.milestone('reached Ohio'); } }
            else if (r === 'fail') {
              this.leg = null; this.legFails = (this.legFails || 0) + 1; this.legShift = [0, 12, -12, 24, -24][this.legFails % 5];
              if (this.legFails > 10) return fail(this, 'cannot reach the island');
            }
            self.goal = 'going down to Ohio (' + (H.y - fy) + ' tiles to go)';
            return;
          }
        }
        // 3) the runway: hop along in 24-tile legs, the nav lays a block under the front foot wherever there is none
        if (H.ph === 'bridge') {
          self.goal = 'bridging the Wall runway';
          if (dir * (fx - H.xEnd) >= -2) { H.ph = 'wait'; self.milestone('Wall runway built'); }
          else {
            if (self.blockCount() < 30) { sub = sub || self.taskMine('stone', () => self.blockCount() >= 200); sub.step(); if (sub.done) sub = null; self.goal = 'mining blocks for the Wall bridge'; return; }
            if (Math.abs(fy - H.y) > 6) { self.goal = 'going back down to the Wall runway'; const r0 = self.moveTo(H.col, H.y, 1); if (r0 === 'fail' && ++bridgeFails > 40) return fail(this, 'cannot get back to the island'); return; }
            const r = self.lineStep(dir, H.y, H.xEnd);
            if (r === 'noblocks') { sub = sub || self.taskMine('stone', () => self.blockCount() >= 200); sub.step(); if (sub.done) sub = null; self.goal = 'mining blocks for the Wall bridge'; return; }
            if (r === 'off' || r === 'bad') { if (++bridgeFails > 40) return fail(this, 'runway ' + r + ' at ' + fx); }
            return;
          }
        }
        // 4) back at the island's edge: wait for a Voodoo Ohio Demon's doll, then drop it off the edge into the lava
        if (self.has('guide_voodoo_doll')) {
          if (!self.readyForWall()) { self.goal = 'got the voodoo doll, but not ready for the Wall (' + self.wallReadiness() + ')'; this.done = true; self.cooldowns = self.cooldowns || {}; self.cooldowns['got the'] = G.tick + 20000; return; }
          if (!G.npcs.some(n => n.type === 'guide' && !n.dead)) { self.goal = 'no Guide alive: waiting at home'; self.moveTo(self.base[0], self.base[1], 2); return; }
          self.goal = 'throwing the voodoo doll into lava';
          const a = self.alignAt(H.col, H.y);
          if (a === 'fail') return fail(this, 'cannot reach the throwing spot');
          if (a !== true) return;
          const s = self.slotOf(it => it.id === 'guide_voodoo_doll'); if (s > 9) { self.ensureHotbar(s); return; }
          self.selectSlot(s);
          self.aimWorld(p.cx - dir * 100, p.cy);
          if (p.dir !== -dir) { Input.keys[dir > 0 ? 'a' : 'd'] = true; return; }
          if (++throwTries > 3) { self.press('t'); self.milestone('threw the voodoo doll'); self.log('threw the voodoo doll off the island at ' + H.col); throwTries = 0; }
          return;
        }
        if (!G.npcs.some(n => n.type === 'guide' && !n.dead)) { self.goal = 'no Guide alive: demons carry no dolls, waiting at home'; self.moveTo(self.base[0], self.base[1], 2); return; }
        self.goal = 'hunting Voodoo Ohio Demons';
        // stay on the island: Ohio's flyers come to us in the open, and the patrol keeps the progress watchdog fed
        if (G.tick - huntT > 600) { huntT = G.tick; this.patrol = H.col + dir * (Math.floor(G.tick / 600) % 2 ? 4 : 0); }
        const r = self.alignAt(this.patrol || H.col, H.y);
        if (r === 'fail') huntT = 0;
      },
    };
  },
  // the Wall: stay ahead of its face, keep firing The 67 at it, hop over eye lasers
  wallFight(n) {
    const p = this.p(), dir = n.ai[3] || 1;
    const edge = dir > 0 ? n.x + n.w : n.x, gap = dir * (p.cx - edge);
    const s = this.slotOf(it => it.id === 'the_67');
    this.goal = 'fighting the Wall of Brainrot (gap ' + Math.round(gap) + ', ' + Math.round(n.life) + '/' + n.lifeMax + ')';
    if (s >= 0 && s <= 9) this.selectSlot(s); else if (s > 9) { this.ensureHotbar(s); return; }
    this.aimWorld(n.cx, n.cy);
    if (gap > -40 && gap < 780 && p.itemAnim === 0) this.clickOnce();
    // laser dodge: a laser is a 4px band at our chest height; being airborne when it passes clears it
    let hop = false;
    for (const pr of G.projectiles || []) {
      if (pr.type !== 'eye_laser' || pr.dead) continue;
      const dx = dir * (p.cx - pr.cx);
      if (dx > 0 && dx < 110 && Math.abs(pr.cy - p.cy) < 40) hop = true;
    }
    if (hop && p.onGround) this.jump();
    if (gap < 300) { this.hold(dir > 0 ? 'd' : 'a'); this.why = 'wall-retreat'; }
  },
  // would a human attempt the Wall of Brainrot now? (it kills the Guide and chases you across the whole underworld)
  wallReadiness() { const p = this.p(); return 'life ' + p.lifeMax + ' def ' + p.calc.defense + ' the_67 ' + this.owns('the_67') + ' arrows ' + this.count('wooden_arrow'); },
  readyForWall() { const p = this.p(); return p.lifeMax >= 200 && p.calc.defense >= 10 && this.owns('the_67') && this.has('guide_voodoo_doll') ; },
  // the deepest ore the plan still needs that the local scan doesn't know about (gold before silver before iron)
  oreWanted() {
    const known = SDK.obs().near.ores || {}, items = [this.committed && this.committed.item, 'the_67', 'slime_crown'].filter(id => id && !this.owns(id));
    for (const ore of ['gold_ore', 'silver_ore', 'iron_ore', 'copper_ore']) {
      if (known[ore]) continue;
      if (items.some(id => (this.rawNeeds(id, 1)[ore] || 0) > this.count(ore))) return ore;
    }
    return null;
  },
  taskExplore() {
    const self = this;
    this.goal = 'exploring';
    let target = null;
    return {
      step() {
        if (!target) {
          const [fx, fy] = self.feet(), w = G.world, ore = self.oreWanted();
          // an ore the plan needs and the scan can't see: head into the layer it generates in (worldgen.js), not a random nearby spot
          const band = { gold_ore: [w.rockLayer + 15, w.rockLayer + 70], silver_ore: [w.rockLayer, w.rockLayer + 50], iron_ore: [w.worldSurface + 10, w.rockLayer + 30], copper_ore: [w.worldSurface, w.rockLayer] }[ore];
          const ty = band ? (fy < band[0] || fy > band[1] ? randInt(band[0], band[1]) : fy + randInt(-8, 8)) : fy + randInt(-10, 30);
          target = [clamp(fx + randInt(-80, 80), 50, w.w - 50), clamp(ty, 50, w.h - 20)];
          if (ore) self.goal = 'exploring for ' + ore.replace('_ore', '');
        }
        const r = self.moveTo(target[0], target[1], 3);
        if (r) { this.done = true; }
      },
    };
  },
};
