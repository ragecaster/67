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
      if (p.onGround && this.cliffAhead(k === 'd' ? 1 : -1)) return;
    }
    Input.keys[k] = true;
  },
  cliffAhead(dir) {
    // would the body, one tile further along, have nothing to stand on within a safe fall? (partial support from one column is fine)
    const p = G.player, w = G.world;
    const fy = Math.floor((p.y + p.h - 1) / TS);
    const cx = p.cx + dir * 16, c0 = Math.floor((cx - 9) / TS), c1 = Math.floor((cx + 9) / TS);
    for (let x = c0; x <= c1; x++) {
      for (let y = fy + 1; y <= fy + 14; y++) { const t = w.tile(x, y); if ((t && TILES[t].solid) || t === T.PLATFORM || w.liq(x, y) > 100) return false; }
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
  nearLava(x, y) { const w = G.world; for (let j = -2; j <= 1; j++) for (let i = -1; i <= 1; i++) if (w.liq(x + i, y + j) > 20 && w.ltype[w.idx(x + i, y + j)] === 1) return true; return false; },

  // ================= main tick =================
  tick() {
    if (!this.active || !G.world) return;
    const p = this.p();
    this.t++;
    this.wasDown = Input.mDown;
    this.allowDrop = false;
    this.resetInputs();
    if (Input.typing) Input.typing = null;
    if (!UI.invOpen && !this.uiBusy) UI.mouseOverUI = false; // the flag is only refreshed on draw, which turbo skips
    this.why = '';
    if (p.dead) { this.task = null; this.nav = null; this.plan = []; if (!this.deadLogged) { this.deaths++; (this.deathLog = this.deathLog || []).push(G.tick + ' ' + G.clockString() + ' ' + G.deathCause); this.log('died of ' + G.deathCause + ' at ' + this.feet() + ' depth ' + (this.feet()[1] - G.world.worldSurface) + ' lifeMax ' + p.lifeMax + ' def ' + p.calc.defense + ' near: ' + G.npcs.filter(n => !n.friendly && !n.town && dist(n.cx, n.cy, p.cx, p.cy) < 400).map(n => n.name).slice(0, 5).join(',') + ' task: ' + (this.lastGoal || this.goal)); this.deadLogged = true; } return; }
    this.deadLogged = false;
    // close menus the bot didn't open
    if (UI.talk) UI.closeTalk();
    if (G.victory) G.victory = null;
    // stuck detection
    const pos = Math.round(p.x) + ',' + Math.round(p.y);
    if (pos === this.lastPos && !UI.invOpen && !(p.itemAnim > 0)) this.stuck++; else this.stuck = Math.max(0, this.stuck - 2);
    this.lastPos = pos;
    // survival reflexes
    if (p.life < p.lifeMax * 0.45 && !p.buffs.potion_sickness && p.inv.some(s => s && ITEMS[s.id].heal && ITEMS[s.id].potion)) this.press('h');
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
      const enemy = this.findEnemy();
      if (enemy) {
        // badly hurt: run for the house instead of trading blows (resting is nearly free for a turbo bot, dying is not)
        const lowLife = p.life < p.lifeMax * (this.fleeing ? 0.7 : 0.33);
        this.fleeing = lowLife && !p.buffs.him;
        if (this.fleeing && !enemy.boss && this.houseSpot) {
          this.why = 'flee'; this.goal = 'retreating (' + Math.round(p.life) + '/' + p.lifeMax + ')';
          const dx = enemy.cx - p.cx;
          const r = this.moveTo(this.base[0], this.base[1], 1);
          // cornered (adjacent): swing at it rather than getting hit in the back
          if (r === 'fail' || (Math.abs(dx) < 36 && Math.abs(enemy.cy - p.cy) < 40)) { this.fight(enemy); }
          return;
        }
        this.why = 'fight'; this.fight(enemy); return;
      }
      // nothing around and hurt: stand still and regenerate
      if (p.life < p.lifeMax * (this.resting ? 0.9 : 0.6) && !p.dead && this.restTicks < 4000) {
        this.resting = true; this.restTicks++; this.why = 'rest'; this.goal = 'resting (' + Math.round(p.life) + '/' + p.lifeMax + ')';
        return;
      }
      this.resting = false; this.restTicks = 0;
      if (this.shouldShelter()) { this.why = 'shelter'; this.goal = 'hiding in the house (night)'; const r = this.moveTo(this.base[0], this.base[1], 1); if (r === true) { this.aimWorld(p.cx + 200, p.cy); } return; }
    }
    // watchdog: abandon tasks that make no progress (no movement, no inventory change)
    const sig = Math.round(p.x / 48) + ',' + Math.round(p.y / 48) + '|' + p.inv.reduce((n, s) => n + (s ? s.count : 0), 0);
    if (sig !== this.progSig) { this.progSig = sig; this.progAt = G.tick; }
    if (this.task && G.tick - this.progAt > 2400) {
      this.log('watchdog: abandoning "' + this.goal + '" (no progress)');
      this.cooldowns = this.cooldowns || {}; this.cooldowns[this.goal.split(' ').slice(0, 2).join(' ')] = G.tick + 3600;
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

  // ================= combat =================
  shouldShelter() {
    const p = this.p();
    // mining happens underground where night makes little difference: don't idle in the house all night for it
    if (/^(mining|crafting|farming)/.test(this.goal || '')) return false;
    return G.isNight() && this.houseValid() && !p.armor.some(a => a) && p.lifeMax < 200 && this.feet()[1] < G.world.worldSurface + 5 && !G.npcs.some(n => n.boss);
  },
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
    // while a boss is up, pick the weapon for the boss (servants/minions die to anything) so we don't swap back and forth
    const boss = G.npcs.find(m => m.boss && !m.dead);
    let ws = this.bestWeaponSlot(boss || n);
    if (ws < 0) return;
    // don't flip-flop between weapons every few ticks: keep the current one unless the new one is clearly better
    const curS = p.sel, cur = p.inv[curS];
    if (cur && curS !== ws && ITEMS[cur.id].damage && !ITEMS[cur.id].pick && !ITEMS[cur.id].axe && G.tick - (this.weaponSwitchAt || 0) < 120) ws = curS;
    else if (ws !== curS) this.weaponSwitchAt = G.tick;
    if (ws > 9) { this.ensureHotbar(ws); return; }
    this.selectSlot(ws);
    const it = ITEMS[p.inv[ws].id];
    const melee = it.use === 'swing' || it.use === 'thrust';
    const dx = n.cx - p.cx, dy = n.cy - p.cy, adx = Math.abs(dx), dist = Math.hypot(dx, dy);
    // --- movement ---
    let dodged = false;
    if (n.boss) dodged = this.dodgeBoss(n);
    if (!dodged) {
      if (melee) {
        const want = n.boss ? 60 : 34;
        if (adx > want + 40 && !n.boss) this.moveTo(Math.floor(n.cx / TS), Math.floor((n.y + n.h - 1) / TS), 1);
        else if (adx > want) this.hold(dx > 0 ? 'd' : 'a');
      } else {
        // ranged: stay 140-280 px away, retreat when it closes in
        if (dist < 140) this.hold(dx > 0 ? 'a' : 'd');
        else if (dist > 280 && !n.boss) this.hold(dx > 0 ? 'd' : 'a');
        else if (n.boss && adx > 220) this.hold(dx > 0 ? 'd' : 'a');
      }
    }
    // hop up at something standing above us (melee), or over a wall; never bunny-hop while shooting a hovering boss
    if ((melee && n.cy < p.y - 10 && adx < 150 && !(n.boss && n.noGravity)) || (p.collidedX && p.onGround)) this.jump();
    // --- aim (lead moving targets with projectiles) and attack ---
    let ax = n.cx, ay = n.cy;
    if (!melee && it.use !== 'throw') {
      const sp = it.shootSpeed || 8, t = Math.min(45, dist / sp);
      ax += (n.vx || 0) * t; ay += (n.vy || 0) * t - dist * 0.015;
    }
    this.aimWorld(ax, ay);
    // only auto-reuse weapons repeat while the button is held; everything else needs a fresh click each use
    if (it.autoReuse) this.clickHold();
    else if (p.itemAnim === 0) this.clickOnce();
    this.goal = 'fighting ' + n.name;
  },
  // sidestep a boss's telegraphed charge; returns true when we are dodging this tick
  dodgeBoss(n) {
    const p = this.p();
    const rx = p.cx - n.cx, ry = p.cy - n.cy, r = Math.hypot(rx, ry);
    const vx = n.vx || 0, vy = n.vy || 0, v = Math.hypot(vx, vy);
    if (n.def && n.def.ai === 'eye' && n.state === 'dash' && v > 3 && r < 420) {
      const ux = vx / v, uy = vy / v;
      const along = rx * ux + ry * uy;        // >0: it is heading toward us
      const cross = rx * uy - ry * ux;        // sideways offset from its line
      // rx/ry point from the boss to us: along > 0 means we are in front of the charge; sidestep until we are clear of its line
      if (along > 0 && Math.abs(cross) < 110) {
        if (Math.abs(uy) < 0.35) { this.jump(); return true; } // flat charge: hop over it
        // pick a side once per charge (re-deciding every tick makes us shuffle in place) and keep running that way
        if (!(this.dodgeUntil > G.tick)) { this.dodgeSign = cross === 0 ? (Math.random() < 0.5 ? 1 : -1) : (cross * uy >= 0 ? 1 : -1); this.dodgeUntil = G.tick + 35; }
        this.hold(this.dodgeSign > 0 ? 'd' : 'a');
        return true;
      }
    }
    // keep out of melee range of anything big that walks at us
    if (n.def && n.def.ai === 'tung' && r < 130) { this.hold(rx > 0 ? 'd' : 'a'); if (n.state === 'leap') this.jump(); return true; }
    return false;
  },

  // ================= task planner =================
  nextTask() {
    const p = this.p(), w = G.world;
    this.uiBusy = false;
    // inventory housekeeping
    if (p.inv.slice(10).filter(s => !s).length < 3) return this.taskTrash();
    // equip anything better
    const eq = this.findUpgradeToEquip();
    if (eq >= 0) return this.taskEquip(eq);
    const houseOk = this.houseValid();
    if (!this.milestones.wood && this.count('wood') < 90 && !houseOk) return this.taskChop(90);
    if (this.count('wood') >= 90) this.milestone('wood');
    // a valid room isn't a finished house: the door, bench, chair and a walkable doorstep come after the walls
    if (!houseOk || !this.houseFinished) return this.taskBuildHouse();
    this.milestone('house');
    // misc crafts (torches, mana crystals, glass, hellforge...) then the tier ladder (stations -> iron -> crystals -> gold)
    const craftList = this.wantedCrafts().filter(o => !this.blocked(o[0]));
    if (craftList.length) return this.taskCraftAtBase(craftList[0]);
    const prog = this.progressionTask();
    if (prog) return prog;
    if (!w.flags.eye_of_cthulhu) return this.taskEye();
    if (!this.hasBetterPick(65)) return this.taskBrainrot();
    if (!w.flags.wall_of_flesh) return this.taskHell();
    return this.taskExplore();
  },
  hasBetterPick(n) { return this.p().inv.some(s => s && (ITEMS[s.id].pick || 0) >= n); },
  hasStation(st) {
    const [bx, by] = this.base || this.feet();
    return !!this.nearestTile(t => TILES[t] && TILES[t].station === st, 12, 8, [bx, by]) || this.has({ furnace: 'furnace', anvil: 'iron_anvil', work_bench: 'work_bench' }[st]);
  },
  wantedCrafts() {
    const out = [], c = id => this.count(id), p = this.p();
    const ownsPick = n => this.hasBetterPick(n);
    if (this.stationPlaced('furnace') && c('demonite_ore') >= 12) out.push(['demonite_bar', Math.floor(c('demonite_ore') / 3)]);
    if (this.stationPlaced('furnace') && c('sand_block') >= 20 && c('glass') < 4) out.push(['glass', 4]);
    if (this.stationPlaced('anvil')) {
      if (c('demonite_bar') >= 12 && c('rotten_chunk') >= 6 && !ownsPick(65)) out.push(['nightmare_pickaxe', 1]);
      if (c('hellstone') >= 3 * 20 && c('obsidian') >= 20 && !this.stationPlaced('hellforge')) out.push(['hellforge', 1, 'place']);
    }
    if (this.stationPlaced('hellforge') && c('hellstone') >= 3 && c('obsidian') >= 1) out.push(['hellstone_bar', Math.min(Math.floor(c('hellstone') / 3), c('obsidian'))]);
    if (this.stationPlaced('anvil') && c('hellstone_bar') >= 20 && !ownsPick(100)) out.push(['molten_pickaxe', 1]);
    if (this.stationPlaced('anvil') && c('hellstone_bar') >= 20 && !this.has('fiery_greatsword')) out.push(['fiery_greatsword', 1]);
    if (c('fallen_star') >= 5 && p.manaMaxBase < 100) out.push(['mana_crystal', 1]);
    if (c('gel') >= 2 && c('wood') > 20 && c('torch') < 20) out.push(['torch', 5]);
    if (c('lens') >= 6 && !this.has('suspicious_looking_eye') && !G.world.flags.eye_of_cthulhu) out.push(['suspicious_looking_eye', 1, 'altar']);
    return out.filter(o => ITEMS[o[0]] && RECIPES.some(r => r.out === o[0]));
  },
  stationPlaced(st) { const [bx, by] = this.base; return !!this.nearestTile(t => TILES[t] && (TILES[t].station === st || (st === 'furnace' && t === T.HELLFORGE)), 14, 8, [bx, by]); },
  houseValid() { return G.npcs.some(n => n.type === 'guide' && n.home) || (this.houseSpot && checkRoom(G.world, this.houseSpot[0] + 5, this.houseSpot[1] - 2).ok); },
  findUpgradeToEquip() {
    const p = this.p();
    return p.inv.findIndex(s => {
      if (!s) return false; const it = ITEMS[s.id];
      if (it.armor) { const k = { head: 0, body: 1, legs: 2 }[it.armor]; const cur = p.armor[k]; return !cur || ITEMS[cur.id].defense < it.defense; }
      if (it.acc) return !p.acc.some(a => a && a.id === s.id) && p.acc.some(a => !a);
      if (it.lifeCrystal && p.lifeMax < 400) return true;
      if (it.manaCrystal && p.manaMaxBase < 200) return true;
      return false;
    });
  },

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
  ensureHotbar(i, target = 9) {
    const p = this.p();
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
  taskEquip(i) {
    const self = this, it = ITEMS[this.p().inv[i].id];
    this.goal = 'equipping ' + it.name;
    let step = 0;
    return {
      step() {
        self.uiBusy = true;
        if (it.lifeCrystal || it.manaCrystal) {
          if (i > 9) { self.ensureHotbar(i); if (!self.hb) i = 9; return; }
          self.selectSlot(i); self.clickOnce(); this.done = true; self.uiBusy = false; return;
        }
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
          if (id.endsWith('_pickaxe')) self.milestone(id);
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
          if (G.isNight() && !G.npcs.some(n => n.boss)) {
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
        else { if (!this.sub || this.sub.done) this.sub = self.taskMine('ore', () => G.isNight()); this.sub.step(); }
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
  taskHell() {
    const self = this, w = G.world;
    this.goal = 'going to Ohio';
    return {
      step() {
        const [fx, fy] = self.feet();
        if (w.flags.wall_of_flesh) { this.done = true; return; }
        if (fy < w.hellLayer + 5) { const r = self.moveTo(fx + 4, w.hellLayer + 20, 2); if (r === 'fail') this.done = true; return; }
        self.milestone('reached Ohio');
        // mine hellstone + obsidian, look for a voodoo doll, throw it in lava
        if (self.has('guide_voodoo_doll')) {
          const lava = self.nearestTile((t, x, y) => w.liq(x, y) > 200 && w.ltype[w.idx(x, y)] === 1, 40, 20);
          if (lava) {
            const r = self.moveTo(lava[0] - 3, lava[1] - 1, 3);
            if (r) { const s = self.slotOf(it => it.id === 'guide_voodoo_doll'); if (s > 9) { self.ensureHotbar(s); return; } self.selectSlot(s); self.press('t'); self.milestone('threw the voodoo doll'); }
            return;
          }
        }
        if (!this.sub || this.sub.done) this.sub = self.taskMine('ore', () => false);
        this.sub.step();
      },
    };
  },
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
