// ---------- main game object ----------
const DAY_LEN = 54000, NIGHT_LEN = 32400;
const CHAT_NAMES = ['xX_sigma_Xx', 'skibidi_rizzler', 'fanum_fan', 'ohio_native', 'mewing_mike', 'sixseven67', 'tralalero_trala', 'gyatt_gamer', 'unc_status', 'aura_farmer', 'delulu_dan', 'labubu_lover'];

const G = {
  state: 'loading', canvas: null, ctx: null, viewW: 1280, viewH: 720, zoom: 1,
  world: null, player: null, npcs: [], projectiles: [], items: [], glows: [], tick: 0,
  camX: 0, camY: 0, shake: 0, ui: UI, fps: 60, victory: null, godMode: false, remotes: {},
  get players() { return [this.player, ...Object.values(this.remotes)]; },

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.init(this.canvas);
    const bar = document.getElementById('loadbar'), label = document.getElementById('loadtext');
    const progress = f => { if (bar) bar.style.width = Math.round(f * 100) + '%'; };
    prepareAssets(progress, msg => { if (label) label.textContent = msg; })
      .then(() => { if (label) label.textContent = 'TERRARI67 — loading brainrot...'; progress(0); return Promise.all([Save.open(), loadAssets(progress)]); })
      .then(() => {
        Render.init();
        document.getElementById('loading').style.display = 'none';
        Menu.open();
        this.state = 'menu';
        const qs = new URLSearchParams(location.search);
        // ?bot plays by the rules (the tuned planner); ?bot&mode=jev lets the trained TerraJev model decide (it was trained on
        // an older planner and still hides in the house all night)
        if (qs.has('bot')) TerraJev.mode = qs.get('mode') || 'teacher';
        if (qs.has('bot')) Menu.startBotRun(qs.get('seed') || 'bot67', parseInt(qs.get('turbo') || '8'), qs.get('size') || 'small');
      })
      .catch(e => {
        console.error(e);
        document.getElementById('loading').innerHTML = '<div>Could not download the game assets from the Terraria Wiki.</div><div style="font-size:15px;font-weight:normal;max-width:600px;text-align:center">Check your internet connection and reload. Playing offline? Run <code>python3 tools/setup.py</code> in the game folder once, then open index.html.<br>(' + e.message + ')</div>';
      });
    let last = performance.now(), acc = 0, frames = 0, fpsT = last;
    const loop = now => {
      requestAnimationFrame(loop);
      acc += Math.min(100, now - last); last = now;
      if (Bot.active && this.state === 'play') {
        // turbo: run several game ticks per frame; draw when the bot needs the UI (clicks) and at the end
        for (let s = 0; s < Bot.turbo; s++) {
          Bot.wantsDraw = false;
          this.update();
          if (Bot.wantsDraw || s === Bot.turbo - 1) this.draw();
          Input.endFrame();
        }
        acc = 0; frames++;
        if (now - fpsT > 1000) { this.fps = frames; frames = 0; fpsT = now; }
        return;
      }
      let steps = 0;
      while (acc >= 1000 / 60 && steps < 4) {
        this.update(); acc -= 1000 / 60;
        if (steps === 0) Input.afterUpdate(); // later sub-steps must not replay the same clicks/keys
        steps++;
      }
      if (steps >= 4) acc = 0;
      if (steps > 0) { Input.restoreForUI(); this.draw(); Input.endFrame(); }
      else { const saved = Input.hideClicks(); this.draw(); Input.unhideClicks(saved); } // events wait for the next update
      frames++;
      if (now - fpsT > 1000) { this.fps = frames; frames = 0; fpsT = now; }
    };
    requestAnimationFrame(loop);
  },
  resize() {
    const z = SETTINGS.zoom || clamp(Math.round(window.innerWidth / 1500 * 4) / 4, 1, 2.5);
    this.zoom = z;
    this.canvas.width = Math.floor(window.innerWidth / z);
    this.canvas.height = Math.floor(window.innerHeight / z);
    this.viewW = this.canvas.width; this.viewH = this.canvas.height;
    this.ctx.imageSmoothingEnabled = false;
  },
  mouseWorldX() { return this.camX + Input.mx; },
  mouseWorldY() { return this.camY + Input.my; },

  // ---------- game start / end ----------
  start(player, world, opts = {}) {
    this.world = world; this.player = player;
    this.npcs = []; this.projectiles = []; this.items = []; particles.length = 0; combatTexts.length = 0;
    this.victory = null; this.pet = null; this.guideRespawn = 0; this.tick = 0; this.eyeTimer = 0; this.tungTimer = 0; this.saveTimer = 0;
    UI.reset();
    Liquid.active.clear();
    WorldMap.init(world);
    // bed
    player.beds = player.beds || {};
    const bed = player.beds[world.name];
    if (bed) { player.bedX = bed[0]; player.bedY = bed[1]; } else { player.bedX = null; player.bedY = null; }
    player.resetTransient();
    player.spawn(world);
    player.life = Math.max(player.life, Math.min(player.lifeMax, 100));
    // town npcs (clients get npcs from the host instead)
    if (!opts.client) for (const t of world.townNPCs || []) {
      const n = this.spawnNPC(t.type, t.x + NPC_TYPES[t.type].w / 2, t.y + NPC_TYPES[t.type].h);
      n.home = t.home; n.name = t.name; n.shortName = t.shortName; n.life = t.life || n.lifeMax;
    }
    if (!opts.client && !this.npcs.some(n => n.type === 'guide') && !world.flags.guideDead) spawnTownNPC('guide', world, null);
    if (player.buffs.labubu) this.spawnPet();
    // wake all liquids near spawn
    this.state = 'play';
    this.snapCamera();
    this.chat('Welcome to ' + world.name + ', ' + player.name + '! ' + pick(MEME.splashes), '#ffd23a');
    this.chat('Esc: inventory · E: grapple · M: map · H: quick heal · Enter: chat · press 6+7 together for the 6-7', '#9ad7ff');
    speak(pick(['six seven', 'skibidi', 'lock in']), 1.1, 1.3);
  },
  async save(silent) {
    if (!this.world) return;
    const p = this.player;
    if (Net.isClient) { // clients only keep their character; the world belongs to the host
      p.beds = p.beds || {};
      if (p.bedX != null) p.beds[this.world.name] = [p.bedX, p.bedY];
      await Save.savePlayer(p);
      if (!silent) this.chat('Character saved. (The host saves the world.)', '#9aff9a');
      return;
    }
    p.beds = p.beds || {};
    if (p.bedX != null) p.beds[this.world.name] = [p.bedX, p.bedY];
    this.world.townNPCs = this.npcs.filter(n => n.town);
    try {
      await Save.saveWorld(this.world);
      await Save.savePlayer(p);
      if (!silent) this.chat('Game saved. Aura preserved.', '#9aff9a');
    } catch (e) { console.error(e); this.chat('Save failed: ' + e, '#ff5a5a'); }
  },
  async saveAndExit() {
    this.state = 'saving';
    await this.save(true);
    Net.leave(false);
    this.remotes = {};
    Audio67.playMusic('Title_Screen');
    this.world = null;
    this.state = 'menu';
    Menu.open();
  },

  // ---------- helpers exposed to other modules ----------
  isDay() { return this.world.dayTime; },
  isNight() { return !this.world.dayTime; },
  daylight() {
    const w = this.world;
    if (!w) return 1;
    if (w.dayTime) return clamp(Math.min(w.time, DAY_LEN - w.time) / 4500, 0, 1) * 0.75 + 0.25;
    return clamp(0.25 - Math.min(w.time, NIGHT_LEN - w.time) / 4500, 0, 0.25);
  },
  clockString() {
    const w = this.world;
    let hours = w.dayTime ? 4.5 + w.time / 3600 : 19.5 + w.time / 3600;
    hours %= 24;
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  },
  biomeAt(x) {
    const w = this.world, b = w.biomes || {};
    if (x < (b.ocean || 110) || x > w.w - (b.ocean || 110)) return 'ocean';
    if (Math.abs(x - b.rotX) < (b.rW || 90)) return 'brainrot';
    if (Math.abs(x - b.desertX) < (b.dW || 110)) return 'desert';
    if (Math.abs(x - b.snowX) < (b.sW || 120)) return 'snow';
    return 'forest';
  },
  nearTile(p, id, r) {
    const w = this.world, tx = Math.floor(p.cx / TS), ty = Math.floor(p.cy / TS);
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (w.tile(x, y) === id) return true;
    return false;
  },
  dropItem(x, y, id, count) {
    if (!ITEMS[id] || count <= 0) return [];
    if (Net.isClient) { Net.out({ t: 'drop', x: Math.round(x), y: Math.round(y), id, c: count }); return []; }
    // split coins / big stacks
    const out = [];
    while (count > 0) {
      const n = Math.min(count, ITEMS[id].stack);
      const d = new ItemDrop(x, y, id, n);
      d.iid = Net.itemUid++;
      this.items.push(d); out.push(d);
      count -= n;
    }
    // (announced to clients after this tick so callers can still tweak velocity)
    return out;
  },
  // throw an item into the world with a given velocity (T key, dropping the cursor item)
  throwItem(x, y, id, count, vx, vy, noGrab = 90) {
    if (Net.isClient) { Net.out({ t: 'drop', x: Math.round(x), y: Math.round(y), id, c: count, vx, vy, ng: noGrab }); return; }
    for (const d of this.dropItem(x, y, id, count)) { d.vx = vx; d.vy = vy; d.noGrab = noGrab; }
  },
  spawnNPC(type, x, y) { const n = new NPC(type, x, y); this.npcs.push(n); return n; },
  spawnProjectile(type, x, y, vx, vy, dmg, kb, owner, opts) {
    const p = new Projectile(type, x, y, vx, vy, dmg, kb, owner, opts || {});
    this.projectiles.push(p);
    // share with other players: our own shots (as visuals) and, on the host, enemy shots
    if (Net.active && !(opts && opts.remote) && (owner === this.player || (p.hostile && Net.isHost))) Net.sendProj(p);
    return p;
  },
  popText(x, y, text, color, life) { combatText(x, y, text, color, { life: life || 60 }); },
  addGlow(x, y, c, strength) { this.glows.push({ x, y, r: c[0], g: c[1], b: c[2] }); },
  chat(msg, color) { UI.chat(msg, color); },
  // chat line everyone in the session sees
  announce(msg, color) { UI.chat(msg, color); if (Net.active) Net.out({ t: 'chat', msg, color }); },
  sendChat(text) {
    text = (text || '').trim();
    if (!text) return;
    const msg = '<' + this.player.name + '> ' + text;
    this.announce(msg, '#ffffff');
    if (/\b(6\s*-?\s*7|67|six\s*seven)\b/i.test(text)) this.player.doSixSeven();
  },
  nearestPlayer(e) {
    let best = this.player, bd = Infinity;
    for (const p of this.players) {
      if (p.dead) continue;
      const d = Math.abs(p.cx - e.cx) + Math.abs(p.cy - e.cy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  },
  // damage a player from host-side boss logic (remote players get told over the network)
  hurtPlayer(p, dmg, dir, src) {
    if (p.remote) { const conn = Net.conns.find(c => c.peer === p.pid); if (conn && !p.dead) Net.send(conn, { t: 'hurt', d: dmg, dir, src: src ? src.name : '' }); return; }
    p.hurt(dmg, dir, src, 'enemy');
  },
  chatReact() {
    if (Math.random() < 0.7) this.chat('[chat] ' + pick(CHAT_NAMES) + ': ' + pick(MEME.chatReactions), '#b08aff');
  },
  pickupText(idOrValue, coin, count) {
    if (coin) {
      const ex = UI.pickups.find(u => u.coin);
      const v = (ex ? ex.value : 0) + idOrValue;
      if (ex) { ex.value = v; ex.text = '+' + formatAura(v); ex.t = 90; }
      else UI.pickups.push({ coin: true, value: v, text: '+' + formatAura(v), color: '#ffd23a', t: 90 });
      return;
    }
    const it = ITEMS[idOrValue];
    const ex = UI.pickups.find(u => u.id === idOrValue);
    if (ex) { ex.count += count; ex.text = it.name + (ex.count > 1 ? ' (' + ex.count + ')' : ''); ex.t = 90; }
    else UI.pickups.push({ id: idOrValue, count, text: it.name + (count > 1 ? ' (' + count + ')' : ''), color: RARE_COLORS[it.rare || 0], t: 90 });
    if (UI.pickups.length > 6) UI.pickups.shift();
  },
  achieve(key) {
    const p = this.player;
    if (!p || p.achievements[key]) return;
    const a = MEME.achievements[key];
    if (!a) return;
    p.achievements[key] = Date.now();
    UI.achievementQueue.push({ title: a[0], desc: a[1], t: 240 });
    Synth.achievement();
  },
  sixSevenHit(x, y) {
    combatText(x, y - 10, '67!!', '#ffd23a', { big: true, life: 100 });
    combatText(x, y - 40, pick(MEME.sixSevenShouts), '#ff4d6d', { big: true, life: 100 });
    Synth.vine_boom(); speak('six seven!', 1.2, 1.4);
    for (let i = 0; i < 50; i++) spawnDust(x, y, pick(['#ffd23a', '#ff4d6d', '#4dd2ff', '#7dff6b', '#ffffff']), 1, 4, { up: 2, life: 70, size: 3 });
    this.achieve('six_seven');
    this.player.stats.sixSevens++;
    this.player.addAura(15);
    this.dropItem(x, y, 'copper_coin', 67);
    this.chatReact();
  },
  potLoot(x, y, ty) {
    const w = this.world, p = this.player;
    const r = Math.random();
    if (Math.random() < 1 / 200) { this.dropItem(x, y, 'labubu', 1); this.chat('A Labubu fell out of the pot. SECRET PULL!', '#ff96ff'); return; }
    if (r < 0.05) this.dropItem(x, y, pick(['swiftness_potion', 'ironskin_potion', 'regeneration_potion', 'night_owl_potion', 'spelunker_potion', 'recall_potion']), 1);
    else if (r < 0.35 && p.life < p.lifeMax) this.dropItem(x, y, 'heart', 1);
    else if (r < 0.5) this.dropItem(x, y, ty > w.hellLayer ? 'hellfire_arrow' : ty > w.rockLayer ? 'flaming_arrow' : 'wooden_arrow', randInt(10, 20));
    else if (r < 0.62) this.dropItem(x, y, 'torch', randInt(4, 12));
    else if (r < 0.72) this.dropItem(x, y, 'lesser_healing_potion', 1);
    else if (r < 0.8) this.dropItem(x, y, ty > w.rockLayer ? 'bomb' : 'shuriken', randInt(2, 8));
    else if (r < 0.85) this.dropItem(x, y, 'dubai_chocolate', 1);
    const depthMult = ty > w.hellLayer ? 8 : ty > w.rockLayer ? 3 : 1;
    for (const [id, n] of coinsFor(Math.round(randRange(20, 120) * depthMult))) this.dropItem(x, y, id, n);
  },
  orbLoot(x, y) {
    this.dropItem(x, y, pick(['vilethorn', 'ball_o_hurt', 'band_of_starpower', 'demon_bow']), 1);
    this.dropItem(x, y, 'rotten_chunk', randInt(3, 8));
    this.world.orbsBroken = (this.world.orbsBroken || 0) + 1;
    this.chat(pick(['A brainrot orb has been smashed. The scroll deepens.', 'Brainrot Orb smashed! +500 aura.', 'Your brain feels... rottener.']), '#af4bff');
    playSound('shatter');
  },
  liquidWake(x, y) { Liquid.wake(this.world, x, y); },
  sandFall(x, y) {
    const w = this.world;
    let yy = y;
    const t = w.tile(x, y);
    while (yy < w.h - 1 && (w.tile(x, yy + 1) === 0 || TILES[w.tile(x, yy + 1)].cut)) yy++;
    if (yy !== y) {
      w.setTile(x, y, 0); w.setTile(x, yy, t);
      if (TILES[w.tile(x, y - 1)]?.falls) this.sandFall(x, y - 1);
      Liquid.wake(w, x, yy);
    }
  },
  npcBlocksTile(tx, ty) {
    const r = { x: tx * TS, y: ty * TS, w: TS, h: TS };
    return this.npcs.some(n => !n.friendly && !n.noGravityCheck && rectsOverlap(r, n) && !n.def.noTileCollide);
  },
  spawnPet() { if (this.pet && !this.pet.dead) return; this.pet = this.spawnNPC('labubu_pet', this.player.cx, this.player.y + this.player.h); this.pet.localOnly = true; },
  removePet() { if (this.pet) { this.pet.dead = true; this.pet.silentRemove = true; this.pet = null; } },
  townNPCDied(n) {
    const msg = n.type === 'guide' ? n.name + ' got cooked. (Nooo, the Rizzler!)' : n.name + ' was slain...';
    this.announce(msg, '#e1453a');
    if (n.type === 'guide') this.guideRespawn = 60 * 60 * 2;
  },
  voodooInLava(drop, nearPlayer) {
    const w = this.world;
    if (Net.isClient) { Net.out({ t: 'voodoo', x: Math.round(drop.x), y: Math.round(drop.y) }); return; }
    const who = nearPlayer || this.player;
    const guide = this.npcs.find(n => n.type === 'guide' && !n.dead);
    if (!guide) { this.chat('The voodoo doll burns... but the Rizzler is not here. Nothing happens.', '#af4bff'); return; }
    if (drop.y / TS < w.hellLayer - 10) return;
    if (this.npcs.some(n => n.type === 'wall_of_flesh')) return;
    G.allowTownDamage = true; guide.takeDamage(99999, 0, 0, 0, true); G.allowTownDamage = false;
    const wall = this.spawnNPC('wall_of_flesh', drop.x, (w.h - 40) * TS);
    // start at the edge of the screen, away from the player, moving toward them
    const dirToPlayer = who.cx > drop.x ? 1 : -1;
    wall.x = who.cx - dirToPlayer * (this.viewW / 2 + 150) - wall.w / 2;
    wall.x = clamp(wall.x, 10, w.w * TS - wall.w - 10);
    wall.ai[3] = dirToPlayer;
    wall.y = who.cy - wall.h / 2;
    bossAwoken('wall_of_flesh');
    this.announce('Skibidi Ohio Rizz Gyatt Fanum Tax Sigma... (the brainrot is here)', '#af4bff');
  },
  trySummon(type, p) {
    if (this.npcs.some(n => n.type === type)) return false;
    if ((type === 'eye_of_cthulhu' || type === 'tung_sahur') && this.isDay()) { this.chat('Nothing happens. It needs to be night. (skill issue)', '#aab'); return false; }
    if (Net.isClient) { Net.out({ t: 'summon', type }); return true; }
    this.summonBoss(type);
    return true;
  },
  summonBoss(type, near) {
    const p = near || this.player;
    let x = p.cx + (Math.random() < 0.5 ? -1 : 1) * 600, y = p.cy - 400;
    if (type === 'king_slime') { x = p.cx + (Math.random() < 0.5 ? -1 : 1) * 250; y = p.cy - 300; }
    if (type === 'tung_sahur') { x = p.cx + (Math.random() < 0.5 ? -1 : 1) * 350; y = p.cy - 200; }
    // find open air for the boss hitbox (bosses that walk would get stuck in rock otherwise)
    const d = NPC_TYPES[type];
    const spot = this.findAirSpot(x, y, d.w, d.h);
    if (spot) { x = spot[0]; y = spot[1]; }
    const b = this.spawnNPC(type, x, y);
    if (type === 'tung_sahur') { Synth.tung(1); setTimeout(() => Synth.tung(1), 600); }
    bossAwoken(type);
    return b;
  },

  // search outward for a spot where a w*h box (bottom-center at x,y) fits in open air
  findAirSpot(x, y, w, h) {
    const W_ = this.world;
    for (let r = 0; r < 40; r++) {
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const cx = x + Math.cos(a) * r * TS, cy = y + Math.sin(a) * r * TS;
        if (cy - h < 0 || cy > W_.h * TS) continue;
        if (!rectHitsSolid(W_, cx - w / 2, cy - h, w, h)) return [cx, cy];
      }
    }
    return null;
  },

  // ---------- the backrooms ----------
  inBackrooms(e) {
    const b = this.world && this.world.backrooms;
    if (!b) return false;
    const tx = e.cx / TS, ty = e.cy / TS;
    return tx >= b.x0 && tx < b.x0 + b.w && ty >= b.y0 && ty < b.y0 + b.h;
  },
  // the glitch doorway (right-clicked): into Level 0
  enterBackrooms(p) {
    const b = this.world.backrooms;
    if (!b || p.dead) return;
    glitchBurst(p);
    p.x = b.entry[0] * TS; p.y = (b.entry[1] + 1) * TS - p.h; p.vx = 0; p.vy = 0; p.fallStart = null; p.hook = null;
    this.snapCamera();
    this.chat('You noclipped out of reality. Welcome to Level 0.', '#e6d487');
    this.chat('Find the EXIT sign. Drink Almond Water. Avoid the Smilers. =)', '#e6d487');
    this.achieve('noclip'); speak('you noclipped out of reality', 1, 0.8);
  },
  // walking up to the wallpaper room for the first time: say what the doorway is
  backroomsHint(p) {
    const d = this.world.backroomsDoor;
    if (!d || this.backroomsHinted || p.dead) return;
    const tx = p.cx / TS, ty = p.cy / TS;
    if (tx > d.x0 - 4 && tx < d.x1 + 4 && ty > d.y - 12 && ty < d.y + 2) { this.backroomsHinted = true; this.chat('The fluorescent lights hum. The wall at the back is... not rendering right. (Right-click it to noclip.)', '#e6d487'); }
  },
  checkNoclip(p) {
    const w = this.world, b = w.backrooms;
    if (p.dead || !b) return;
    const x0 = Math.floor(p.x / TS), x1 = Math.floor((p.x + p.w - 1) / TS), y0 = Math.floor(p.y / TS), y1 = Math.floor((p.y + p.h - 1) / TS);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = w.tile(x, y);
      if (t === T.EXIT_SIGN) {
        glitchBurst(p);
        p.spawn(w); p.life = Math.max(p.life, 1);
        this.snapCamera();
        this.chat('You found the EXIT. That is... very rare. Welcome back to reality (Ohio).', '#3aff6a');
        this.achieve('exit');
        return;
      }
    }
  },
  updateBackroomsAmbience() {
    const inside = this.inBackrooms(this.player);
    if (inside !== this.wasInBackrooms) {
      this.wasInBackrooms = inside;
      if (inside) Hum.start(); else Hum.stop();
    }
    if (inside && Math.random() < 1 / 2400) this.chat(pick(['You hear the fluorescent lights buzzing.', 'The carpet is moist. Why is it moist.', 'It feels like someone is watching you. =)', 'You have been walking for hours. Or minutes. Hard to tell.', 'The wallpaper is the same yellow. Always the same yellow.', 'Distant footsteps. Not yours.']), '#e6d487');
  },

  // ---------- update ----------
  update() {
    if (this.state === 'menu' || this.state === 'gen') { Menu.update(); Audio67.updateMusic(); return; }
    if (this.state !== 'play') return;
    const w = this.world, p = this.player;
    if (Bot.active) Bot.tick();
    this.handleKeys();
    // single player pauses in menus; multiplayer never pauses (like Terraria)
    const paused = !Net.active && (UI.settingsOpen || this.victory);
    if (paused) { Audio67.updateMusic(); return; }
    const client = Net.isClient;
    this.tick++;
    this.glows = [];
    this.updateTime();
    p.update(w);
    this.checkNoclip(p); this.backroomsHint(p);
    this.updateBackroomsAmbience();
    if (this.himBanner > 0) this.himBanner--;
    Net.updateRemotes();
    if (client) Net.clientNPCs(w, p);
    else for (const n of this.npcs) n.update(w);
    for (const pr of this.projectiles) pr.update(w);
    for (const it of this.items) it.update(w, p);
    this.npcs = this.npcs.filter(n => !n.dead);
    this.projectiles = this.projectiles.filter(pr => !pr.dead);
    if (this.items.length > 400) for (let i = 0; i < this.items.length - 400; i++) this.items[i].life = 0;
    if (Net.isHost) {
      const gone = [];
      for (const it of this.items) { if (it.life <= 0) gone.push(it.iid); else if (!it.announced) { it.announced = true; Net.announceItem(it); } }
      if (gone.length) Net.broadcast({ t: 'itemGone', a: gone });
    }
    this.items = this.items.filter(it => it.life > 0);
    if (!Net.active) this.mergeItems();
    if (client) Liquid.active.clear();
    else if (this.tick % 2 === 0) Liquid.step(w, this.tick);
    if (!Net.isHost) Liquid.changed.clear();
    updateParticles();
    updateCombatTexts();
    if (!client) {
      for (const pl of this.players) this.spawnEnemies(pl);
      if (this.tick % 600 === 0) townTick(w, p);
      if (this.guideRespawn > 0) this.guideRespawn--;
    }
    Net.tick();
    // tile damage decay
    if (this.tick % 30 === 0) for (const [k, v] of w.damage) { v.t += 30; if (v.t > 300) w.damage.delete(k); }
    // close shop when far from the shopkeeper / inventory closed
    if (UI.shop && (!UI.invOpen || UI.shop.npc.dead || dist(UI.shop.npc.cx, UI.shop.npc.cy, p.cx, p.cy) > 300)) UI.shop = null;
    // close chest when far
    if (UI.chest && UI.chest.pos && dist(p.cx, p.cy, UI.chest.pos[0] * TS, UI.chest.pos[1] * TS) > 7 * TS) { UI.chest = null; playSound('menu_close', 0.5); }
    if (UI.chest && UI.chest.pos && !TILES[w.tile(UI.chest.pos[0], UI.chest.pos[1])]?.chest && !TILES[w.tile(UI.chest.pos[0], UI.chest.pos[1])]?.piggy) UI.chest = null;
    this.updateCamera();
    this.updateMusic();
    if (SETTINGS.autosave && ++this.saveTimer > 60 * 60 * 5) { this.saveTimer = 0; this.save(); }
    if (this.hardcoreDeath) { this.hardcoreDeath = false; setTimeout(() => { Save.del('players', p.name); this.chat('Your hardcore character has been deleted. It is so over.', '#ff5a5a'); setTimeout(() => this.saveAndExit(), 3000); }, 100); }
  },
  mergeItems() {
    if (this.tick % 20) return;
    const its = this.items;
    for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) {
      const a = its[i], b = its[j];
      if (a.life <= 0 || b.life <= 0 || a.id !== b.id || a.fallenStar || b.fallenStar) continue;
      if (Math.abs(a.x - b.x) < 24 && Math.abs(a.y - b.y) < 24 && a.count + b.count <= maxStack(a.id)) { a.count += b.count; b.life = 0; }
    }
  },
  handleKeys() {
    const p = this.player;
    if (Input.typing) return;
    if (Input.hit('Escape')) {
      if (WorldMap.open) WorldMap.open = false;
      else if (UI.settingsOpen) UI.settingsOpen = false;
      else if (UI.talk) UI.closeTalk();
      else if (UI.chest) { UI.chest = null; UI.invOpen = false; playSound('menu_close'); }
      else { UI.invOpen = !UI.invOpen; UI.shop = UI.invOpen ? UI.shop : null; playSound(UI.invOpen ? 'menu_open' : 'menu_close'); }
    }
    if (Input.hit('i')) { UI.invOpen = !UI.invOpen; playSound(UI.invOpen ? 'menu_open' : 'menu_close'); }
    if (Input.hit('m')) { WorldMap.open = !WorldMap.open; WorldMap.panX = 0; WorldMap.panY = 0; WorldMap.zoom = 1; }
    for (let i = 0; i < 10; i++) if (Input.hit(String((i + 1) % 10)) && p.itemAnim === 0) p.sel = i;
    if (Input.wheel && !UI.invOpen && !WorldMap.open && p.itemAnim === 0) { p.sel = (p.sel + Input.wheel + 10) % 10; }
    if (Input.hit('h')) this.quickHeal();
    if (Input.hit('t')) { const s = p.held(); if (s) { this.throwItem(p.cx + p.dir * 16, p.cy - 10, s.id, s.count, p.dir * 4, -1); p.inv[p.sel] = null; } }
    if (Input.hit('Enter')) { Input.typing = { text: '', max: 120, onDone: t => this.sendChat(t), onCancel: () => { } }; UI.chatOpen = true; }
    if (Input.hit('=') || Input.hit('+')) { SETTINGS.zoom = clamp((SETTINGS.zoom || this.zoom) + 0.25, 1, 3); saveSettings(); this.resize(); }
    if (Input.hit('-')) { SETTINGS.zoom = clamp((SETTINGS.zoom || this.zoom) - 0.25, 1, 3); saveSettings(); this.resize(); }
    if (Input.hit('F5')) this.save();
    if (Input.hit('F7')) Bot.vision = !Bot.vision;
    if (Input.hit('F8')) { if (Bot.active) Bot.stop(); else Bot.start(); }
    if (Input.hit('F9') && Bot.active) { const sp = [1, 2, 4, 8, 16, 32, 64]; Bot.turbo = sp[(sp.indexOf(Bot.turbo) + 1) % sp.length]; }
    // right-click interactions
    if (Input.rClick && !UI.mouseOverUI && !WorldMap.open && !p.dead) this.interact();
  },
  quickHeal() {
    const p = this.player;
    if (p.buffs.potion_sickness) return;
    let best = -1, bh = 0;
    p.inv.forEach((s, i) => { if (s && ITEMS[s.id].heal && ITEMS[s.id].potion && ITEMS[s.id].heal > bh) { bh = ITEMS[s.id].heal; best = i; } });
    if (best < 0) return;
    const old = p.sel; p.sel = best; p.consume(this.world, ITEMS[p.inv[best].id]); p.sel = old;
  },
  interact() {
    const p = this.player, w = this.world;
    const mx = this.mouseWorldX(), my = this.mouseWorldY();
    // talk to town npc
    for (const n of this.npcs) {
      if (!n.town) continue;
      if (mx > n.x - 4 && mx < n.x + n.w + 4 && my > n.y - 4 && my < n.y + n.h + 4 && dist(n.cx, n.cy, p.cx, p.cy) < 200) { UI.openTalk(n); return; }
    }
    const tx = Math.floor(mx / TS), ty = Math.floor(my / TS);
    if (!p.inReach(tx, ty, 1)) return;
    const t = TILES[w.tile(tx, ty)];
    if (!t) return;
    if (t.door) { w.toggleDoor(tx, ty); return; }
    if (t.noclip) { this.enterBackrooms(p); return; }
    if (t.chest) {
      const [ox, oy] = w.objOrigin(tx, ty);
      const inv = w.chests[ox + ',' + oy] || (w.chests[ox + ',' + oy] = new Array(40).fill(null));
      UI.chest = { inv, title: 'Chest', pos: [ox, oy] }; UI.invOpen = true; UI.shop = null; UI.closeTalk();
      playSound('menu_open');
      return;
    }
    if (t.piggy) {
      const [ox, oy] = w.objOrigin(tx, ty);
      UI.chest = { inv: p.piggy, title: 'Fanum Tax Bank', pos: [ox, oy] }; UI.invOpen = true;
      playSound('menu_open');
      return;
    }
    if (t.bed) {
      const [ox, oy] = w.objOrigin(tx, ty);
      p.bedX = ox; p.bedY = oy;
      this.chat('Spawn point set! (Sleep is for the weak, but respawning is for everyone.)', '#9aff9a');
      return;
    }
    if (t.id === T.TOILET) { Synth.skibidi(0.8); combatText(tx * TS + 8, ty * TS - 10, 'skibidi dop dop yes yes', '#ffffff', { life: 60 }); return; }
  },

  // ---------- time / events ----------
  updateTime() {
    const w = this.world, p = this.player;
    w.time++;
    if (Net.isClient) {
      if (w.dayTime && w.time >= DAY_LEN) { w.dayTime = false; w.time = 0; }
      else if (!w.dayTime && w.time >= NIGHT_LEN) { w.dayTime = true; w.time = 0; w.day++; }
      this.updateSky();
      return;
    }
    // 6:07 PM
    if (w.dayTime && w.time === 49020) { this.announce(MEME.events.sixSevenTime, '#ffd23a'); Synth.six_seven(); speak('six seven', 1.2, 1.4); for (const n of this.npcs) if (n.town) n.emote = 120; }
    if (w.dayTime && w.time >= DAY_LEN) {
      w.dayTime = false; w.time = 0;
      // night begins
      w.flags.bloodMoon = w.day > 0 && Math.random() < 1 / 9;
      if (w.flags.bloodMoon) { this.announce(MEME.events.bloodMoon, '#ff3a3a'); speak('only in ohio', 1, 0.8); }
      if (!w.flags.eye_of_cthulhu && p.lifeMax >= 200 && p.calc.defense >= 10 && Math.random() < 1 / 3 && !this.npcs.some(n => n.boss)) {
        this.announce('You feel an evil presence watching you... (side-eye incoming)', '#af4bff');
        this.eyeTimer = 60 * 30;
      }
      if (!w.flags.tung_sahur && p.lifeMax >= 200 && Math.random() < 0.5) this.tungTimer = 1;
    }
    if (!w.dayTime) {
      if (this.eyeTimer > 0 && --this.eyeTimer === 0 && !p.dead) this.summonBoss('eye_of_cthulhu', pick(this.players.filter(q => !q.dead)) || p);
      if (this.tungTimer && w.time === 25200) this.announce(MEME.events.sahurWarning, '#e8c898'), Synth.tung(0.5);
      if (this.tungTimer && w.time === 27000 && !p.dead && !this.npcs.some(n => n.boss)) { this.tungTimer = 0; this.summonBoss('tung_sahur', pick(this.players.filter(q => !q.dead)) || p); }
      // fallen stars
      if (Math.random() < 1 / 1500) {
        const sx = p.cx + randRange(-1200, 1200);
        const d = new ItemDrop(sx, Math.max(40, p.cy - 900), 'fallen_star', 1);
        d.fallenStar = true; d.vx = randRange(-2, 2); d.vy = 6; d.noGrab = 10; d.iid = Net.itemUid++;
        this.items.push(d);
        playSound('item9', 0.3);
      }
      if (w.time >= NIGHT_LEN) {
        w.dayTime = true; w.time = 0; w.day++;
        w.flags.bloodMoon = false;
        this.items = this.items.filter(i => !(i.fallenStar && !i.onGround) && !(i.id === 'fallen_star' && i.fallenStar));
        this.announce(MEME.events.dawn, '#ffd23a');
        if (this.guideRespawn > 0) this.guideRespawn = 0;
      }
    }
    this.updateSky();
  },
  updateSky() {
    const w = this.world, p = this.player;
    // light / ambient
    const dl = this.daylight();
    Light.sky = w.flags.bloodMoon && !w.dayTime ? [0.35, 0.12, 0.12] : [lerp(0.16, 1, dl), lerp(0.18, 1, dl), lerp(0.3, 1, dl)];
    Light.ambientBoost = p.buffs.night_owl ? 0.18 : 0;
  },

  // ---------- enemy spawning (Terraria-style rates/limits) ----------
  // spawn rate and cap around a player: { zone, rate (1 in rate per tick), max, hostile (what counts toward max) }
  spawnLimits(p) {
    const w = this.world;
    const pty = Math.floor(p.cy / TS);
    const night = !w.dayTime, blood = night && w.flags.bloodMoon;
    const zone = pty < w.worldSurface ? 'surface' : pty < w.rockLayer ? 'underground' : pty < w.hellLayer ? 'cavern' : 'hell';
    // Terraria (wiki "NPC spawning", 1.4.5 source): one 1-in-spawnRate roll per tick; base 1/600, max 5;
    // surface night 1/360 & 6, blood moon 1/108 & 10, underground 1/300 & 8, caverns 1/240 & 9, underworld 1/600 & 10
    let rate = 600, max = 5;
    if (zone === 'surface' && night) { rate = 360; max = 6; }
    if (zone === 'underground') { rate = 300; max = 8; }
    if (zone === 'cavern') { rate = 240; max = 9; }
    if (zone === 'hell') { rate = 600; max = 10; }
    if (blood && zone === 'surface') { rate = 108; max = 10; }
    if (p.buffs.battle) { rate *= 0.5; max *= 2; }
    const towns = this.npcs.filter(n => n.town && dist(n.cx, n.cy, p.cx, p.cy) < 60 * TS).length;
    if (towns >= 2 && zone === 'surface') { rate *= 3; max = Math.max(2, max - 3); }
    if (this.npcs.some(n => n.boss)) { rate *= 2; }
    // count everything that hasn't despawned yet (NPC.update drops them past 2400 x 1600 px), so off-screen ones still fill the cap
    const hostile = this.npcs.filter(n => !n.friendly && !n.boss && !n.town && !n.dead && Math.abs(n.cx - p.cx) < 2400 && Math.abs(n.cy - p.cy) < 1600).length;
    // a thin crowd spawns faster: ×0.6 under 20% of the cap, ×0.7 under 40%, ×0.8 under 60%, ×0.9 under 80%
    const fill = hostile / max;
    rate *= fill < 0.2 ? 0.6 : fill < 0.4 ? 0.7 : fill < 0.6 ? 0.8 : fill < 0.8 ? 0.9 : 1;
    return { zone, night, blood, rate: Math.floor(rate), max, hostile };
  },
  spawnEnemies(p) {
    const w = this.world;
    if (p.dead) return;
    const ptx = Math.floor(p.cx / TS), pty = Math.floor(p.cy / TS);
    const { zone, night, blood, rate, max, hostile } = this.spawnLimits(p);
    if (hostile >= max || Math.random() * rate >= 1) return;
    // pick a spot just off-screen
    const vw = p === this.player ? this.viewW : 1600, vh = p === this.player ? this.viewH : 900;
    const halfW = Math.ceil(vw / TS / 2) + 3, halfH = Math.ceil(vh / TS / 2) + 3;
    for (let tries = 0; tries < 20; tries++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = ptx + side * randInt(halfW, halfW + 25);
      const ty = pty + randInt(-halfH, halfH);
      if (!w.inb(tx, ty) || tx < 5 || tx > w.w - 5) continue;
      const type = this.chooseSpawn(tx, ty, zone, night, blood, p);
      if (!type) return;
      const d = NPC_TYPES[type];
      const flying = ['flyer', 'bat', 'demon', 'harpy', 'bombardiro', 'smiler'].includes(d.ai);
      if (flying) {
        if (w.solid(tx, ty) || w.solid(tx + 1, ty) || w.liq(tx, ty) > 0) continue;
        if (type === 'bombardiro') { this.spawnNPC(type, tx * TS, (pty - 18) * TS).ai[1] = -side; return; }
        this.spawnNPC(type, tx * TS + 8, (ty + 1) * TS);
        return;
      }
      // ground spawn: find floor
      for (let y = ty - 10; y < ty + 15; y++) {
        if (w.solid(tx, y) || !w.solid(tx, y + 1)) continue;
        const needH = Math.ceil(d.h / TS);
        let ok = true;
        for (let j = 0; j < needH; j++) if (w.solid(tx, y - j) || w.solid(tx + 1, y - j)) ok = false;
        const water = w.liq(tx, y) > 100 && w.ltype[w.idx(tx, y)] === 0;
        if (type === 'shark' ? !water : (w.liq(tx, y) > 0)) ok = false;
        const wl = WALLS[w.wall(tx, y)];
        if (wl && !wl.natural) ok = false;
        if (type !== 'partygoer' && w.wall(tx, y) === W.WALLPAPER) ok = false;
        if (!ok) continue;
        this.spawnNPC(type, tx * TS + 8, (y + 1) * TS);
        return;
      }
    }
  },
  chooseSpawn(tx, ty, zone, night, blood, p) {
    const w = this.world;
    const b = w.backrooms;
    if (b && tx >= b.x0 && tx < b.x0 + b.w && ty >= b.y0 && ty < b.y0 + b.h) return Math.random() < 0.55 ? 'smiler' : 'partygoer';
    const biome = this.biomeAt(tx);
    const r = Math.random();
    if (zone === 'surface') {
      if (biome === 'ocean') {
        const x = tx, y = ty;
        if (w.liq(x, y) > 100 || r < 0.4) return 'shark';
        return 'crab';
      }
      if (p.cy / TS < w.worldSurface * 0.35 && r < 0.5) return 'harpy';
      if (biome === 'brainrot' && r < 0.6) return 'eater_of_souls';
      if (!night) {
        if (w.flags.eye_of_cthulhu && r < 0.05) return 'bombardiro';
        if (biome === 'desert') return r < 0.5 ? 'antlion' : r < 0.8 ? 'vulture' : 'green_slime';
        if (r < 0.12) return pick(['bunny', 'bunny', 'bird']);
        if (r < 0.14 && w.flags.king_slime) return 'pinky';
        return r < 0.7 ? 'green_slime' : 'blue_slime';
      }
      if (blood) return pick(['zombie', 'zombie', 'skibidi_toilet', 'skibidi_toilet', 'demon_eye', 'goblin_thief']);
      return r < 0.42 ? 'zombie' : r < 0.72 ? 'demon_eye' : 'skibidi_toilet';
    }
    if (zone === 'underground') {
      if (r < 0.28) return 'blue_slime';
      if (r < 0.5) return 'red_slime';
      if (r < 0.68) return 'cave_bat';
      if (r < 0.78) return 'goblin_thief';
      if (r < 0.9) return 'skeleton';
      if (r < 0.95) return 'mother_slime';
      if (r < 0.96) return 'pinky';
      return 'yellow_slime';
    }
    if (zone === 'cavern') {
      if (r < 1 / 67) return 'yellow_slime';
      if (r < 0.27) return 'skeleton';
      if (r < 0.36) return 'undead_miner';
      if (r < 0.54) return 'cave_bat';
      if (r < 0.64) return 'red_slime';
      if (r < 0.72) return 'purple_slime';
      if (r < 0.85) return 'ballerina';
      if (r < 0.92) return 'goblin_thief';
      if (r < 0.97) return 'mother_slime';
      return 'pinky';
    }
    // Ohio (underworld)
    const guideAlive = this.npcs.some(n => n.type === 'guide');
    if (r < 0.3) return 'fire_imp';
    if (r < 0.6) return 'hellbat';
    if (r < 0.82) return 'lava_slime';
    if (r < 0.94 || !guideAlive) return 'demon';
    return 'voodoo_demon';
  },

  // ---------- camera / music ----------
  snapCamera() { const p = this.player; this.camX = p.cx - this.viewW / 2; this.camY = p.cy - this.viewH / 2; this.clampCam(); },
  clampCam() {
    const w = this.world;
    this.camX = clamp(this.camX, 0, w.w * TS - this.viewW);
    this.camY = clamp(this.camY, 0, w.h * TS - this.viewH);
  },
  updateCamera() {
    const p = this.player;
    const tx = p.cx - this.viewW / 2, ty = p.cy + p.stepOffset - this.viewH / 2;
    this.camX = lerp(this.camX, tx, 0.25); this.camY = lerp(this.camY, ty, 0.25);
    if (Math.abs(this.camX - tx) > 800 || Math.abs(this.camY - ty) > 800) { this.camX = tx; this.camY = ty; }
    this.clampCam();
    if (this.shake > 0) { this.camX += randRange(-this.shake, this.shake) * 0.5; this.camY += randRange(-this.shake, this.shake) * 0.5; this.shake *= 0.9; if (this.shake < 0.5) this.shake = 0; }
    this.camX = Math.round(this.camX); this.camY = Math.round(this.camY);
  },
  updateMusic() {
    const w = this.world, p = this.player;
    const boss = this.npcs.find(n => n.boss);
    let track;
    const ty = p.cy / TS, biome = this.biomeAt(Math.floor(p.cx / TS));
    if (this.inBackrooms(p) && !boss) track = null;
    else if (boss) track = boss.def.music;
    else if (ty >= w.hellLayer - 10) track = 'Underworld';
    else if (ty >= w.worldSurface) track = biome === 'brainrot' ? 'Underground_Corruption' : 'Underground';
    else if (w.flags.bloodMoon && !w.dayTime) track = 'Eerie';
    else if (biome === 'brainrot') track = 'Corruption';
    else if (!w.dayTime) track = 'Overworld_Night';
    else if (biome === 'desert') track = 'Desert';
    else if (biome === 'snow') track = 'Snow';
    else if (biome === 'ocean') track = 'Ocean_Day';
    else track = 'Overworld_Day';
    if (Audio67.targetTrack !== track) Audio67.playMusic(track);
    Audio67.updateMusic();
  },

  // ---------- draw ----------
  draw() {
    const ctx = this.ctx, vw = this.viewW, vh = this.viewH;
    ctx.imageSmoothingEnabled = false;
    if (this.state === 'loading') return;
    if (this.state === 'menu' || this.state === 'gen' || this.state === 'saving') {
      Menu.draw(ctx, vw, vh);
      if (this.state === 'saving') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, vw, vh); txt(ctx, 'Saving... (preserving aura)', vw / 2, vh / 2, '#fff', 24, 'center'); }
      this.drawCursor(ctx);
      return;
    }
    if (this.state !== 'play') return;
    const w = this.world, p = this.player, camX = this.camX, camY = this.camY;
    Render.drawBackground(ctx, w, camX, camY, vw, vh);
    const range = Render.drawWorld(ctx, w, camX, camY, vw, vh);
    // entities
    for (const it of this.items) it.draw(ctx, camX, camY);
    for (const n of this.npcs) if (n.type !== 'wall_of_flesh') n.draw(ctx, camX, camY);
    for (const rp of Object.values(this.remotes)) rp.draw(ctx, camX, camY);
    p.draw(ctx, camX, camY);
    for (const pr of this.projectiles) pr.draw(ctx, camX, camY);
    drawParticles(ctx, camX, camY);
    for (const n of this.npcs) if (n.type === 'wall_of_flesh') n.draw(ctx, camX, camY);
    // lighting
    const dyn = this.glows.slice();
    const held = p.heldItem();
    if (held && held.holdLight && !p.dead) dyn.push({ x: p.cx + p.dir * 8, y: p.y + 10, r: held.holdLight[0], g: held.holdLight[1], b: held.holdLight[2] });
    if (p.buffs.aura) dyn.push({ x: p.cx, y: p.cy, r: 0.5, g: 0.45, b: 0.15 });
    if (p.buffs.him) dyn.push({ x: p.cx, y: p.cy, r: 1, g: 0.85, b: 0.35 });
    for (const n of this.npcs) if (n.def.glow) dyn.push({ x: n.cx, y: n.cy, r: n.def.glow[0], g: n.def.glow[1], b: n.def.glow[2] });
    for (const n of this.npcs) if (n.type === 'lava_slime' || n.type === 'fire_imp' || n.type === 'hellbat' || n.buffs.on_fire) dyn.push({ x: n.cx, y: n.cy, r: 0.8, g: 0.4, b: 0.1 });
    if (p.buffs.on_fire) dyn.push({ x: p.cx, y: p.cy, r: 0.8, g: 0.4, b: 0.1 });
    // the player always has a faint light so they can see themselves (Terraria does this too)
    dyn.push({ x: p.cx, y: p.cy, r: 0.12, g: 0.12, b: 0.14 });
    Light.compute(w, range[0], range[1], range[2], range[3], dyn);
    Light.draw(ctx, camX, camY);
    if (p.buffs.spelunker) Render.drawSpelunker(ctx, w, camX, camY, range);
    if (this.tick % 6 === 0) WorldMap.reveal();
    drawCombatTexts(ctx, camX, camY);
    // name tags + off-screen arrows for other players
    for (const rp of Object.values(this.remotes)) {
      const x = rp.cx - camX, y = rp.y - camY - 10;
      if (x > -20 && x < vw + 20 && y > -40 && y < vh + 40) txt(ctx, rp.name + (rp.dead ? ' (cooked)' : ''), x, y, rp.dead ? '#ff8a8a' : '#9ad7ff', 12, 'center');
      else {
        const a = Math.atan2(rp.cy - p.cy, rp.cx - p.cx);
        const ax = clamp(vw / 2 + Math.cos(a) * vw, 30, vw - 30), ay = clamp(vh / 2 + Math.sin(a) * vh, 60, vh - 60);
        txt(ctx, rp.name + ' ' + Math.round(dist(rp.cx, rp.cy, p.cx, p.cy) / TS) + "'", ax, ay, '#9ad7ff', 11, 'center');
      }
    }
    // the backrooms: mono-yellow haze + VHS grain
    if (this.inBackrooms(p)) {
      ctx.fillStyle = 'rgba(230,200,90,0.10)'; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let y = (this.tick * 2) % 4; y < vh; y += 4) ctx.fillRect(0, y, vw, 1);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'; ctx.fillRect(Math.random() * vw, Math.random() * vh, 2, 2); }
      if (this.tick % 240 < 3) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, randRange(0, vh), vw, randRange(4, 30)); }
    }
    // HIM MODE: golden vignette + banner
    if (p.buffs.him) {
      const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      g.addColorStop(0, 'rgba(255,210,58,0)'); g.addColorStop(1, `rgba(255,190,40,${0.22 + Math.sin(this.tick * 0.1) * 0.06})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    }
    if (this.himBanner > 0) {
      const a = Math.min(1, this.himBanner / 30), s = 1 + Math.max(0, (this.himBanner - 150) / 30) * 0.6;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(vw / 2, vh * 0.3); ctx.scale(s, s); ctx.rotate(Math.sin(this.tick * 0.2) * 0.03);
      txt(ctx, 'YOU ARE LITERALLY HIM RN', 0, 0, '#ffd23a', 40, 'center');
      ctx.restore();
    }
    // blood moon tint
    if (w.flags.bloodMoon && !w.dayTime) { ctx.fillStyle = 'rgba(120,0,0,0.08)'; ctx.fillRect(0, 0, vw, vh); }
    if (WorldMap.open) { WorldMap.drawFull(ctx, vw, vh); UI.beginFrame(); UI.addRect(0, 0, vw, vh); }
    else UI.draw(ctx, vw, vh);
    this.drawCursor(ctx);
  },
  drawCursor(ctx) {
    const x = Input.mx, y = Input.my;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#1a0a0a'; ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(14, 5); ctx.lineTo(6, 7); ctx.lineTo(4, 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6a3a'; ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(11, 5); ctx.lineTo(5, 6); ctx.lineTo(4, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  showVictory() { if (Net.isHost) Net.broadcast({ t: 'victory' }); this.victory = { t: 0 }; Synth.vine_boom(); speak('six seven! you beat the game!', 1.1, 1.3); },
};
window.addEventListener('load', () => G.init());
