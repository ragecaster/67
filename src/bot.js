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
  press(k) { if (!Input.keys[k]) { Input.pressed[k] = true; Input.lastKeyTime[k] = performance.now(); } },
  aimWorld(x, y) { Input.mx = x - G.camX; Input.my = y - G.camY; },
  aimTile(tx, ty) { this.aimWorld(tx * TS + 8, ty * TS + 8); },
  clickHold() { Input.mDown = true; if (!this.wasDown) Input.mClick = true; },
  clickOnce() { Input.mDown = true; Input.mClick = true; },
  uiClick(x, y, right) { Input.mx = x; Input.my = y; if (right) Input.rClick = true; else { Input.mClick = true; Input.mDown = true; } this.wantsDraw = true; },
  rightClickWorld(tx, ty) { this.aimTile(tx, ty); Input.rClick = true; },
  selectSlot(i) { if (i >= 0 && i < 10 && G.player.sel !== i) this.press(String((i + 1) % 10)); },

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
      const melee = it.use === 'swing' || it.use === 'thrust';
      // a sword can't reach something hovering well above us
      const high = enemy && enemy.cy < this.p().cy - 90 && (enemy.noGravity || (enemy.def && enemy.def.noGravity) || enemy.boss);
      // bosses: shooting from range beats trading blows (and doesn't flip-flop with every dash)
      const v = Math.max(1, dmg - def * 0.5) * 60 / (it.useAnim || it.useTime) * (melee && high ? 0.12 : 1) * (!melee && enemy && enemy.boss ? 1.6 : 1) + (melee ? 2 : 0);
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
      const score = c.d + solid * 2.5 - vein * 2;
      if (score < bs) { bs = score; best = [c.x, c.y]; }
    }
    return best;
  },
  isProtected(x, y) {
    const h = this.houseSpot;
    if (!(h && this.milestones.house)) return false;
    return x >= h[0] && x <= h[0] + 10 && y >= h[1] - 6 && y <= h[1];
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
  edgeDist(dir) { const w = G.world, [fx, fy] = this.feet(); let n = 0; while (n < 12 && (w.solid(fx + dir * (n + 1), fy + 1) || w.solid(fx + dir * (n + 1) + 1, fy + 1))) n++; return n; },
  nearLava(x, y) { const w = G.world; for (let j = -2; j <= 1; j++) for (let i = -1; i <= 1; i++) if (w.liq(x + i, y + j) > 20 && w.ltype[w.idx(x + i, y + j)] === 1) return true; return false; },

  // ================= main tick =================
  tick() {
    if (!this.active || !G.world) return;
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
    if (!an || Math.abs(p.x - an.x) > 48 || Math.abs(p.y - an.y) > 48) this.anchor = { x: p.x, y: p.y, t: G.tick };
    else if (G.tick - an.t > 3000 && !/^(hiding|resting|waiting)/.test(this.goal || '') && !(this.unstick && this.unstick.until > G.tick)) {
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
    if (p.life < p.lifeMax * (TerraJev.ready ? 0.2 : 0.45) && !p.buffs.potion_sickness && p.inv.some(s => s && ITEMS[s.id].heal && ITEMS[s.id].potion)) this.press('h');
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
      if (enemy && dist(enemy.cx, enemy.cy, p.cx, p.cy) < 120) { this.fight(enemy); return; }
      if (ex) { this.goal = 'escaping the Backrooms (EXIT sign)'; if (this.moveTo(ex[0], ex[1], 0) === 'fail') this.stuck = 0; return; }
    }
    // pick what to do
    if (!this.uiBusy) {
      const wall = G.npcs.find(n => n.type === 'wall_of_flesh' && !n.dead);
      if (wall) { this.why = 'wall'; this.wallFight(wall); return; }
      if (this.tactics()) return;
    }
    // watchdog: abandon tasks that make no progress (no movement, no inventory change)
    const sig = Math.round(p.x / 48) + ',' + Math.round(p.y / 48) + '|' + p.inv.reduce((n, s) => n + (s ? s.count : 0), 0);
    if (sig !== this.progSig) { this.progSig = sig; this.progAt = G.tick; }
    if (this.task && G.tick - this.progAt > 2400) {
      this.log('watchdog: abandoning "' + this.goal + '" (no progress)');
      this.cooldowns = this.cooldowns || {}; this.cooldowns[this.lastTaskId || this.goal] = G.tick + 3600;
      this.task = null; this.nav = null; this.progAt = G.tick; this.watchdogs = (this.watchdogs || 0) + 1;
      this.task = this.taskExplore();
    }
    if (!this.task || this.task.done) {
      this.task = this.nextTask(); this.nav = null; this.taskAge = 0;
      const key = this.goal.split(' ').slice(0, 2).join(' ');
      if (this.cooldowns && this.cooldowns[key] > G.tick) { this.log('skipping "' + key + '" (cooling down)'); this.task = this.taskExplore(); }
    }
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
          this.task = this.taskExplore();
        }
      } else if (this.task && !this.task.done) this.instantDone = 0;
      if (this.task) this.taskAge++;
    }
  },

  // ================= TerraJev tactics: one typed decision instead of an if-chain =================
  // returns true when the chosen tactic used this tick (the task does not run)
  tactics() {
    const p = this.p();
    const enemy = this.findEnemy();
    const potions = p.inv.some(s => s && ITEMS[s.id].heal && ITEMS[s.id].potion) && !p.buffs.potion_sickness;
    const ranged = p.inv.some(s => s && ITEMS[s.id].damage && (ITEMS[s.id].use === 'shoot' || ITEMS[s.id].shoot) && !(ITEMS[s.id].ammo && p.findAmmo(ITEMS[s.id].ammo) < 0));
    const hurt = p.life < p.lifeMax * 0.95;
    const hostilesNear = G.npcs.some(n => !n.friendly && !n.town && !n.dead && dist(n.cx, n.cy, p.cx, p.cy) < 450) || G.projectiles.some(q => q.hostile && !q.dead && dist(q.cx, q.cy, p.cx, p.cy) < 300);
    const opts = [];
    if (enemy) {
      opts.push('fight');
      if (ranged) opts.push('kite');
      if (this.houseSpot && !enemy.boss) opts.push('flee');
      if (potions && hurt) opts.push('heal');
      if (!enemy.boss) opts.push('ignore');
    } else {
      if (hurt && !(hostilesNear && p.y / TS > G.world.hellLayer)) opts.push('rest');
      if (potions && p.life < p.lifeMax * 0.7) opts.push('heal');
      if (G.isNight() && this.houseValid() && this.feet()[1] < G.world.worldSurface + 5 && !G.npcs.some(n => n.boss)) opts.push('shelter');
      opts.push('continue');
    }
    if (opts.length === 1 && opts[0] === 'continue') { this.tactic = null; this.resting = false; this.restTicks = 0; return false; }
    // ask again every 15 ticks, when the target changes, or after a big hit
    const T = this.tactic, lifeDrop = T ? T.life - p.life : 0;
    if (!T || G.tick - T.at >= 15 || T.enemy !== (enemy && enemy.uid) || lifeDrop > p.lifeMax * 0.1 || !opts.includes(T.choice)) {
      const state = jevStateFeatures(this, enemy);
      const ans = TerraJev.decide({ id: 'tactic', state, candidates: opts.map(o => ({ id: o, features: jevCandFeatures(this, o, enemy) })) });
      this.tactic = { choice: ans.choice, at: G.tick, enemy: enemy && enemy.uid, life: p.life, probs: ans.probabilities };
    }
    const c = this.tactic.choice;
    this.why = 'jev:' + c;
    switch (c) {
      case 'fight': this.resting = false; this.fight(enemy); return true;
      case 'kite': {
        this.resting = false; this.fight(enemy);
        const away = enemy.cx > p.cx ? 'a' : 'd';
        if (dist(enemy.cx, enemy.cy, p.cx, p.cy) < 200) { Input.keys.a = Input.keys.d = false; this.holdSafe(away); }
        this.goal = 'kiting ' + enemy.name; return true;
      }
      case 'flee': {
        this.goal = 'retreating (' + Math.round(p.life) + '/' + p.lifeMax + ')';
        const r = this.moveTo(this.base[0], this.base[1], 1);
        if (enemy && (r === 'fail' || (Math.abs(enemy.cx - p.cx) < 36 && Math.abs(enemy.cy - p.cy) < 40))) this.fight(enemy);
        return true;
      }
      case 'heal': this.press('h'); if (enemy) { this.fight(enemy); return true; } return false;
      case 'rest': this.resting = true; this.restTicks = (this.restTicks || 0) + 1; this.goal = 'resting (' + Math.round(p.life) + '/' + p.lifeMax + ')'; if (this.restTicks > 4000) { this.tactic = null; return false; } return true;
      case 'shelter': { this.goal = 'hiding in the house (night)'; const r = this.moveTo(this.base[0], this.base[1], 1); if (r === true) this.aimWorld(p.cx + 200, p.cy); return true; }
      default: this.resting = false; this.restTicks = 0; return false; // ignore / continue: let the task run
    }
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
    const t = targets.find(([x, y]) => { const q = w.tile(x, y); return q && TILES[q].solid && !TILES[q].unbreakable && !Bot.isProtected(x, y); });
    if (t && s >= 0 && s <= 9) { this.aimTile(t[0], t[1]); this.clickHold(); }
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
  fight(n) {
    const p = this.p();
    // give up on enemies we can't actually reach/hurt (stuck behind walls, hopping away forever)
    this.fights = this.fights || {};
    const f = this.fights[n.uid] || (this.fights[n.uid] = { since: G.tick, life: n.life });
    if (n.life < f.life) { f.life = n.life; f.since = G.tick; }
    if (G.tick - f.since > (n.boss ? 3600 : 480)) { this.ignore[n.uid] = G.tick + 3600; delete this.fights[n.uid]; this.log('ignoring ' + n.name + ' (unreachable)'); return; }
    if (G.tick % 600 === 0) for (const k in this.fights) if (!G.npcs.some(m => m.uid == k)) delete this.fights[k];
    const T = this.fightT || (this.fightT = {});
    // ---- target: which enemy? (TerraJev 'target', re-asked every 30 ticks) ----
    const foes = G.npcs.filter(m => !m.friendly && !m.town && !m.dead && m.alpha >= 0.5 && !m.def.critter && !(this.ignore[m.uid] > G.tick) && dist(m.cx, m.cy, p.cx, p.cy) < (m.boss ? 900 : 350))
      .sort((x, y) => dist(x.cx, x.cy, p.cx, p.cy) - dist(y.cx, y.cy, p.cx, p.cy)).slice(0, 6);
    if (!foes.includes(n)) foes.push(n);
    if (!T.target || T.target.dead || !foes.includes(T.target) || G.tick - T.tAt >= 30) {
      if (foes.length > 1) {
        const ans = TerraJev.decide({ id: 'target', state: jevStateFeatures(this, n), candidates: foes.map(m => ({ id: 'npc' + m.uid, features: jevTargetFeatures(this, m, T.target) })) });
        T.target = foes[ans.idx];
      } else T.target = n;
      T.tAt = G.tick;
    }
    const tgt = T.target;
    // ---- weapon: which one? (TerraJev 'weapon', re-asked every 60 ticks or on a new target) ----
    const slots = [];
    p.inv.forEach((s2, i) => { if (!s2) return; const it2 = ITEMS[s2.id]; if (!it2.damage || it2.ammoType || it2.consumable || it2.pick || it2.axe || it2.hammer) return; if (it2.ammo && p.findAmmo(it2.ammo) < 0) return; if (it2.mana && p.mana < it2.mana) return; slots.push(i); });
    if (!slots.length) return;
    slots.sort((x, y) => (ITEMS[p.inv[y].id].damage || 0) - (ITEMS[p.inv[x].id].damage || 0));
    if (slots.length > 6) slots.length = 6;
    if (T.ws == null || !slots.includes(T.ws) || G.tick - T.wAt >= 60 || T.wTarget !== tgt.uid) {
      const ans = TerraJev.decide({ id: 'weapon', state: jevStateFeatures(this, tgt), candidates: slots.map(i => ({ id: p.inv[i].id, features: jevWeaponFeatures(this, i, tgt) })) });
      T.ws = slots[ans.idx]; T.wAt = G.tick; T.wTarget = tgt.uid;
    }
    const ws = T.ws;
    if (ws > 9) { this.ensureHotbar(ws); return; }
    this.selectSlot(ws);
    const it = ITEMS[p.inv[ws].id];
    // ---- control: raw inputs every 4 ticks (TerraJev 'control': move L/-/R x jump x attack, or path to the target) ----
    if (!T.ctrl || G.tick - T.cAt >= 4 || T.cTarget !== tgt.uid) {
      const ans = TerraJev.decide({ id: 'control', state: jevStateFeatures(this, tgt), candidates: JEV_CONTROLS.map(c => ({ id: c.id, features: jevControlFeatures(this, c, tgt, it) })) });
      T.ctrl = JEV_CONTROLS[ans.idx]; T.cAt = G.tick; T.cTarget = tgt.uid;
    }
    const c = T.ctrl;
    if (c.path) this.moveTo(Math.floor(tgt.cx / TS), Math.floor((tgt.y + tgt.h - 1) / TS), 1);
    else if (c.m) this.holdSafe(c.m > 0 ? 'd' : 'a');   // the cliff/edge guard stays in code ("authorise in code")
    if (c.j) this.jump();
    // aim (lead moving targets with projectiles); attack only when the model says so
    const melee = (it.use === 'swing' || it.use === 'thrust') && !it.shoot;
    const dx = tgt.cx - p.cx, dy = tgt.cy - p.cy, d = Math.hypot(dx, dy);
    let ax = tgt.cx, ay = tgt.cy;
    if (!melee && it.use !== 'throw') { const sp = it.shootSpeed || 8, t = Math.min(45, d / sp); ax += (tgt.vx || 0) * t; ay += (tgt.vy || 0) * t - d * 0.015; }
    this.aimWorld(ax, ay);
    if (c.a) { if (it.autoReuse) this.clickHold(); else if (p.itemAnim === 0) this.clickOnce(); }
    this.goal = 'fighting ' + tgt.name;
  },
  // ================= task choice: TerraJev picks the next skill =================
  // Candidates are the skills that make sense right now (masked); TerraJev returns a probability for each.
  nextTask() {
    const p = this.p();
    this.uiBusy = false;
    if (this.houseValid() && this.houseFinished) this.milestone('house');
    const cands = this.taskCandidates();
    if (!cands.length) return this.taskExplore();
    const state = jevStateFeatures(this, null);
    const ans = TerraJev.decide({ id: 'task', state, candidates: cands.map(c => ({ id: c.id, features: c.f })) });
    const pick = cands[ans.idx];
    this.taskChoice = { id: pick.id, at: G.tick, probs: ans.probabilities };
    this.lastTaskId = pick.id;
    (this.taskHist = this.taskHist || {})[pick.id] = G.tick;
    if (pick.item) this.commit(pick.item, pick.qty || 1);
    const t = pick.make();
    return t || this.taskExplore();
  },
  taskCandidates() {
    const p = this.p(), w = G.world, out = [];
    const KINDS = ['trash', 'equip', 'chop', 'build', 'stone', 'ore', 'craft', 'crystal', 'eye', 'brainrot', 'hell', 'explore', 'home'];
    const add = (id, kind, make, extra = {}) => {
      const f = KINDS.map(k => (k === kind ? 1 : 0));
      const last = this.taskHist && this.taskHist[id];
      const cool = this.cooldowns && this.cooldowns[id] > G.tick ? 1 : 0;
      f.push(extra.value || 0, extra.def || 0, extra.dmg || 0, extra.pickGain || 0, extra.ready == null ? 1 : extra.ready, extra.needs || 0,
        extra.dist == null ? 0 : Math.min(extra.dist, 300) / 100, this.lastTaskId === id ? 1 : 0, cool, last ? Math.min(G.tick - last, 6000) / 3000 : 2);
      out.push(Object.assign({ id, kind, make, f }, extra));
    };
    const freeSlots = p.inv.slice(10).filter(s => !s).length;
    if (freeSlots < 6) add('trash', 'trash', () => this.taskTrash(), { value: (6 - freeSlots) / 6 });
    // equipment upgrades in the inventory
    p.inv.forEach((s, i) => {
      if (!s) return; const it = ITEMS[s.id];
      let gain = 0;
      if (it.armor) { const k = { head: 0, body: 1, legs: 2 }[it.armor], cur = p.armor[k]; gain = (it.defense || 0) - (cur ? ITEMS[cur.id].defense || 0 : 0); if (gain <= 0) return; }
      else if (it.acc) { if (p.acc.some(a => a && a.id === s.id) || !p.acc.some(a => !a)) return; gain = 1; }
      else if (it.lifeCrystal) { if (p.lifeMax >= 400) return; gain = 2; }
      else if (it.manaCrystal) { if (p.manaMaxBase >= 200) return; gain = 1; }
      else return;
      if (out.some(c => c.id === 'equip:' + s.id)) return;
      add('equip:' + s.id, 'equip', () => this.taskEquip(s.id), { def: gain / 10 });
    });
    const tree = this.nearestTile((t, x, y) => t === T.TREE && w.treeType(x, y) === TREE_BASE, 140, 40);
    if (tree) add('chop', 'chop', () => this.taskChop(this.count('wood') + 40), { value: Math.min(this.count('wood'), 200) / 100, dist: Math.abs(tree[0] - this.feet()[0]) });
    if (!this.houseValid() || !this.houseFinished) add('build', 'build', () => this.taskBuildHouse(), { ready: Math.min(1, this.count('wood') / 90) });
    add('stone', 'stone', () => this.taskMine('stone', () => this.count('stone_block') >= Math.min(9999, this.count('stone_block') + 30)), { value: Math.min(this.count('stone_block'), 200) / 100 });
    const pickPow = Math.max(0, ...p.inv.map(s => s ? ITEMS[s.id].pick || 0 : 0));
    for (const [ore, tileName] of Object.entries(ORE_TILE)) {
      const tile = T[tileName], td = TILES[tile];
      if (!td || td.minPick > pickPow) continue;
      const near = this.nearestTile(t => t === tile, 90, 80);
      if (!near) continue;
      add('ore:' + ore, 'ore', () => this.taskMine('ore', () => this.count(ore) >= this.count(ore) + 15, [tile]), { value: Math.log1p(ITEMS[ore].value || 1) / 8, dist: Math.abs(near[0] - this.feet()[0]) + Math.abs(near[1] - this.feet()[1]), needs: Math.min(this.count(ore), 200) / 100 });
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
      const curDmg = Math.max(0, ...p.inv.map(s => s && ITEMS[s.id].damage && !ITEMS[s.id].ammoType ? (ITEMS[s.id].fixedDamage ? 67 : ITEMS[s.id].damage) : 0));
      add('craft:' + id, 'craft', () => this.taskForStep(this.resolve(id, qty)), {
        item: id, qty, value: Math.log1p(it.value || 1) / 12, def: (it.defense || 0) / 10,
        dmg: it.damage && !it.ammoType ? Math.max(0, (it.fixedDamage ? 67 : it.damage) - curDmg) / 30 : 0,
        pickGain: it.pick ? (it.pick - pickPow) / 20 : 0, ready: have / total, needs: Math.log1p(total) / 6,
      });
    }
    if (p.lifeMax < 400) { const c = this.nearestTile(t => t === T.LIFE_CRYSTAL, 120, 90); if (c && !this.crystalBad(c)) add('crystal', 'crystal', () => this.taskBreakAt(c, 'aura crystal', 'pick'), { dist: Math.abs(c[0] - this.feet()[0]) + Math.abs(c[1] - this.feet()[1]) }); }
    if (!w.flags.eye_of_cthulhu && this.houseValid()) add('eye', 'eye', () => this.taskEye(), { ready: Math.min(1, this.count('lens') / 6) });
    if (w.flags.eye_of_cthulhu && !this.hasBetterPick(65)) add('brainrot', 'brainrot', () => this.taskBrainrot(), { ready: Math.min(1, this.count('rotten_chunk') / 6) });
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
        if (!tree || G.world.tile(tree[0], tree[1]) !== T.TREE) {
          tree = self.nearestTile((t, x, y) => t === T.TREE && G.world.treeType(x, y) === TREE_BASE && !self.nearLava(x, y), 140, 40);
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
    const keep = { dirt_block: 60, stone_block: 60, gel: 99, lens: 6, bone: 7, glass: 10 };
    if (this.hell && this.hell.x0) Object.assign(keep, { dirt_block: 400, stone_block: 700, ash_block: 300 });   // the Wall runway is ~450 blocks
    this.goal = 'cleaning inventory';
    let step = 0;
    return {
      step() {
        self.uiBusy = true;
        const p = self.p();
        if (step === 0) { if (!UI.invOpen) self.press('Escape'); step = 1; return; }
        // shift-click (trash) the first junk stack beyond what we keep
        const i = p.inv.findIndex((s, k) => k >= 10 && s && junk.includes(s.id) && invCount(p.inv, s.id) > (keep[s.id] || 0));
        if (i < 0 || step > 40) { if (UI.invOpen) self.press('Escape'); this.done = true; self.uiBusy = false; return; }
        Input.keys.Shift = true; Input.shift = true;
        const [x, y] = self.slotPos(i); self.uiClick(x, y);
        step++;
      },
    };
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
        if (i < 0 || SDK.count(id) < start || ++tries > 120) { if (UI.invOpen && !self.hb) self.press('Escape'); this.done = true; self.uiBusy = false; return; }
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
    let phase = 'go', clicks = 0, waited = 0;
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
          const spot = self.findPlacementNear(id) || self.findSpotAroundBase(id);
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
        const spot = self.findPlacementNear(id) || self.findSpotAroundBase(id);
        if (!spot || ++tries > 400) { this.done = true; self.fail('place_' + id); self.log('no room to place ' + id); return; }
        if (!self.p().inReach(spot[0], spot[1])) { if (self.moveTo(spot[0], spot[1], 2) === 'fail') tries += 100; return; }
        self.aimTile(spot[0], spot[1]); self.clickOnce();
      },
    };
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
    let target = null, since = 0, bestD = Infinity;
    const bad = (x, y) => self.badTiles && self.badTiles.has(x + ',' + y);
    const markBad = (t) => { self.badTiles = self.badTiles || new Set(); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) self.badTiles.add((t[0] + i) + ',' + (t[1] + j)); };
    return {
      step() {
        if (doneFn()) { this.done = true; return; }
        const w = G.world, p = self.p();
        const [fx, fy] = self.feet();
        const pick = self.bestSlot('pick'), power = pick >= 0 ? ITEMS[p.inv[pick].id].pick : 0;
        const want = tiles ? (t => tiles.includes(t) && TILES[t].minPick <= power) : what === 'stone' ? (t => t === T.STONE) : (t => (TILES[t] && TILES[t].ore && TILES[t].minPick <= power && t !== T.HELLSTONE) || t === T.LIFE_CRYSTAL);
        const ok = (t, x, y) => want(t) && !self.nearLava(x, y) && !self.isProtected(x, y) && !bad(x, y) && Nav.cellCost(x, y) < Infinity;
        const near = self.nearestTile((t, x, y) => ok(t, x, y) && p.inReach(x, y), 7, 6);
        self.dbg = 'mine near=' + near + ' target=' + target;
        if (near) { if (self.dig(near[0], near[1]) === 'fail') markBad(near); self.goal = 'mining ' + TILES[w.tile(near[0], near[1])].name; since = G.tick; return; }
        if (!target || (!target.synthetic && !want(w.tile(target[0], target[1])))) {
          target = self.pickMineTarget(ok, w, fx, fy, want);
          if (!target) { // nothing known nearby: head deeper, away from the house
            const depth = what === 'stone' ? w.worldSurface + 12 : w.rockLayer + 15;
            const side = self.houseSpot && Math.abs(fx - self.houseSpot[0]) < 20 ? (fx < self.houseSpot[0] + 5 ? -25 : 25) : (Math.random() < 0.5 ? -30 : 30);
            target = [fx + side, Math.max(fy + 15, depth)]; target.synthetic = true; // wander target: keep it until reached, don't re-pick every tick
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
    if (!this.houseSpot) {
      // find flat-ish ground near spawn
      for (let d = 0; d < 80 && !this.houseSpot; d++) for (const s of [1, -1]) {
        const x0 = w.spawnX + d * s;
        const ys = []; for (let i = 0; i < 11; i++) ys.push(topSolid(w, x0 + i));
        if (ys.some(y => y < 0)) continue;
        if (Math.max(...ys) - Math.min(...ys) <= 3 && !ys.some((y, i) => w.liq(x0 + i, y - 1))) { this.houseSpot = [x0, Math.max(...ys)]; break; }
      }
      if (!this.houseSpot) this.houseSpot = [w.spawnX + 3, topSolid(w, w.spawnX + 3)];
      this.base = [this.houseSpot[0] + 5, this.houseSpot[1] - 1];
      this.log('house site at ' + this.houseSpot);
    }
    const [hx, fy] = this.houseSpot;
    // plan: [op, x, y, item]
    const plan = [];
    for (let y = fy - 7; y <= fy - 1; y++) for (let x = hx; x <= hx + 10; x++) plan.push(['clear', x, y]);
    // a doorstep: clear two columns outside the door so the house can actually be left
    for (let y = fy - 4; y <= fy - 1; y++) for (let x = hx - 3; x <= hx - 1; x++) plan.push(['clear', x, y]);
    for (let x = hx; x <= hx + 10; x++) plan.push(['block', x, fy]);
    for (let y = fy - 1; y >= fy - 6; y--) { plan.push(['block', hx, y]); plan.push(['block', hx + 10, y]); }
    for (let x = hx; x <= hx + 10; x++) plan.push(['block', x, fy - 6]);
    // the door opening is cut out of the finished wall (a block needs a neighbour to attach to)
    for (let y = fy - 3; y <= fy - 1; y++) plan.push(['dig', hx, y]);
    for (let y = fy - 5; y <= fy - 1; y++) for (let x = hx + 1; x <= hx + 9; x++) plan.push(['wall', x, y]);
    for (let y = fy - 3; y <= fy - 1; y++) plan.push(['wall', hx, y]);
    plan.push(['furn', hx, fy - 1, 'wooden_door'], ['furn', hx + 3, fy - 1, 'work_bench'], ['furn', hx + 7, fy - 1, 'wooden_chair'], ['furn', hx + 5, fy - 4, 'torch']);
    // the doorstep must be walkable: floor in front of the door and nothing solid at body height (the terrain bump the first clear pass missed)
    for (let x = hx - 1; x >= hx - 3; x--) plan.push(['block', x, fy]);
    for (let x = hx - 1; x >= hx - 3; x--) for (let y = fy - 1; y >= fy - 4; y--) plan.push(['dig', x, y]);
    const needs = { wood_wall: 50, wooden_door: 1, work_bench: 1, wooden_chair: 1 };
    let i = 0;
    return {
      step() {
        const p = self.p();
        while (i < plan.length && self.planStepDone(plan[i])) i++;
        if (i >= plan.length) { this.done = true; self.houseFinished = true; self.log('house finished'); return; }
        // clearing needs no tools; everything after it needs a work bench standing at the base
        if (plan[i][0] !== 'clear') {
          if (!self.nearestTile(t => t === T.WORKBENCH, 10, 6, self.base)) {
            if (self.has('work_bench')) { self.task = self.taskPlaceItem('work_bench', self.base); return; }
            if (self.count('wood') < 10) { self.task = self.taskChop(self.count('wood') + 40); return; }
            self.task = self.taskCraftAtBase(['work_bench', 1, 'place']); return;
          }
          // craft prerequisites first
          for (const [id, n] of Object.entries(needs)) {
            const placed = id === 'work_bench' ? !!self.nearestTile(t => t === T.WORKBENCH, 12, 8, self.base) : id === 'wooden_door' ? [0, 1, 2].some(j => TILES[w.tile(hx, fy - 1 - j)]?.door) : id === 'wooden_chair' ? w.tile(hx + 7, fy - 1) === T.CHAIR : false;
            if (!placed && self.count(id) < (id === 'wood_wall' ? Math.min(n, 4) : 1) && !(id === 'wood_wall' && i >= plan.findIndex(q => q[0] === 'furn'))) {
              if (id === 'work_bench') continue;
              if (self.count('wood') < 12) { self.task = self.taskChop(self.count('wood') + 40); return; }
              if (self.blocked(id)) continue;
              self.task = self.taskCraftAtBase([id, id === 'wood_wall' ? 12 : 1]); return;
            }
          }
        }
        const [op, x, y, item] = plan[i];
        self.goal = 'building a house (' + i + '/' + plan.length + ': ' + op + ' ' + (item || '') + ' @' + x + ',' + y + ' ' + (TILES[w.tile(x, y)]?.name || 'air') + ')';
        // stand inside the house footprint near the target
        const standX = clamp(x, hx + 2, hx + 8);
        let standY = fy - 1; while (standY > fy - 4 && (w.solid(standX, standY) || w.solid(standX + 1, standY) || w.solid(standX, standY - 1))) standY--;
        if (!p.inReach(x, y) || Math.abs(self.feet()[0] - standX) > 4) {
          const r = self.moveTo(standX, standY, 1);
          if (r === 'fail') { this.fails = (this.fails || 0) + 1; if (this.fails > 5) { this.fails = 0; self.log('house: skipping ' + op + ' ' + x + ',' + y + ' (unreachable)'); i++; } }
          return;
        }
        this.fails = 0;
        if (op === 'clear' || op === 'dig') { self.dig(x, y); return; }
        const id = op === 'block' ? 'wood' : op === 'wall' ? 'wood_wall' : item;
        const s = self.slotOf(it => it.id === id);
        if (s < 0) { if (id === 'wood') { self.task = self.taskChop(self.count('wood') + 30); } else self.task = self.taskCraftAtBase([id, 1]); return; }
        if (s > 9) { self.ensureHotbar(s); return; }
        self.selectSlot(s);
        if (op === 'block' && p.overlapsTile(x, y)) { self.hold(x > self.feet()[0] ? 'a' : 'd'); return; }
        self.aimTile(x, y); self.clickOnce();
        if (this.triesI !== i) { this.triesI = i; this.tries = 0; }
        if (++this.tries > 120) { this.tries = 0; self.log('house: giving up on ' + op + ' ' + x + ',' + y); i++; }
      },
    };
  },
  planStepDone([op, x, y, item]) {
    const w = G.world, t = w.tile(x, y), td = TILES[t];
    if (this.badTiles && this.badTiles.has(x + ',' + y)) return true;
    if (op === 'clear') return !t || (td && (td.cut || td.door || td.torch || td.chair || t === T.WORKBENCH || t === T.WOOD));
    if (op === 'dig') return !t || (td && td.door);
    if (op === 'block') return td && td.solid && !td.door ? true : (td && td.door);
    if (op === 'wall') return w.wall(x, y) !== 0 || (td && td.door);
    if (op === 'furn') { const want = ITEMS[item].place; return t === want || (want === T.DOOR_CLOSED && td && td.door) || [-1, 0, 1].some(d => w.tile(x + d, y) === want && want === T.WORKBENCH); }
    return true;
  },
  taskEye() {
    const self = this, w = G.world;
    this.goal = 'preparing for the Eye of Ohio (' + this.count('lens') + '/6 lenses)';
    return {
      step() {
        const p = self.p();
        if (w.flags.eye_of_cthulhu) { this.done = true; return; }
        if (self.has('suspicious_looking_eye')) {
          const [fx0, fy0] = self.feet();
          // summon it at home, on the surface, healthy: not wherever we happen to be standing
          if (G.isNight() && !G.npcs.some(n => n.boss) && (Math.abs(fx0 - self.base[0]) > 25 || Math.abs(fy0 - self.base[1]) > 12)) { self.goal = 'heading home to summon the Eye'; self.moveTo(self.base[0] - 6, self.base[1], 3); return; }
          if (G.isNight() && !G.npcs.some(n => n.boss) && p.life >= p.lifeMax * 0.85) {
            const s = self.slotOf(it => it.id === 'suspicious_looking_eye');
            if (s > 9) { self.ensureHotbar(s); return; }
            if (this.summonedAt && G.tick - this.summonedAt < 300) return; // the item takes a moment to be used up and the boss to appear
            self.selectSlot(s); self.clickOnce(); this.summonedAt = G.tick; self.log('summoning the Eye of Ohio'); self.milestone('eye summoned');
          } else self.moveTo(self.base[0], self.base[1], 2);
          return;
        }
        if (self.count('lens') >= 6) { self.task = self.taskCraftAtBase(['suspicious_looking_eye', 1, 'altar']); return; }
        // hunt demon eyes on the surface at night; otherwise mine
        if (G.isNight()) { if (self.feet()[1] > w.worldSurface) self.moveTo(self.base[0], self.base[1], 3); else self.hold(Math.floor(self.t / 600) % 2 ? 'a' : 'd'); }
        else {
          // daytime: nothing useful to mine for this goal; wait at the house for dusk (the lens-droppers only spawn at night)
          self.goal = 'waiting for night at the house (' + self.count('lens') + '/6 lenses)';
          self.moveTo(self.base[0] - 6, self.base[1], 3);
        }
      },
    };
  },
  taskBrainrot() {
    const self = this, w = G.world;
    this.goal = 'farming Brainrot (chunks ' + this.count('rotten_chunk') + '/6, bars ' + this.count('demonite_bar') + '/12)';
    return {
      step() {
        if (self.hasBetterPick(65)) { this.done = true; return; }
        if (self.count('rotten_chunk') >= 6 && self.count('demonite_ore') + self.count('demonite_bar') * 3 >= 36) { this.done = true; return; }
        if (self.count('rotten_chunk') < 6) { const bx = w.biomes.rotX; self.moveTo(bx + (Math.floor(self.t / 900) % 2 ? 20 : -20), topSolid(w, bx) - 1, 4); self.goal = 'hunting Doomscrollers for chunks'; return; }
        if (!this.sub || this.sub.done) this.sub = self.taskMine('ore', () => self.count('demonite_ore') + self.count('demonite_bar') * 3 >= 36, [T.DEMONITE]);
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
          const r = self.moveTo(H.col, H.y, 1);
          if (r === true || (fy === H.y && Math.abs(fx - H.col) <= 2)) { H.ph = 'bridge'; self.milestone('reached Ohio'); }
          else { if (r === 'fail') { this.fails = (this.fails || 0) + 1; if (this.fails > 3) return fail(this, 'cannot reach the island'); } return; }
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
  taskExplore() {
    const self = this;
    this.goal = 'exploring';
    let target = null;
    return {
      step() {
        if (!target) { const [fx, fy] = self.feet(); target = [clamp(fx + randInt(-80, 80), 50, G.world.w - 50), clamp(fy + randInt(-10, 30), 50, G.world.h - 20)]; }
        const r = self.moveTo(target[0], target[1], 3);
        if (r) { this.done = true; }
      },
    };
  },
};
