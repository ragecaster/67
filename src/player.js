// ---------- the player ----------
const ARMOR_COLORS = { wood: ['#a3774a', '#7d5634'], copper: ['#d0803e', '#96521f'], iron: ['#9aa0a7', '#6a6f75'], silver: ['#d3dbe0', '#98a3aa'], gold: ['#f0cc4f', '#b8901f'], shadow: ['#6b5890', '#3e3056'], molten: ['#d9562a', '#8a2a12'] };
const BUFFS = {
  well_fed: { name: 'Bussin (Well Fed)', img: 'buffs/Well_Fed', tip: 'Minor improvements to all stats' },
  swiftness: { name: 'Zoomies', img: 'buffs/Swiftness', tip: '25% increased movement speed' },
  ironskin: { name: 'Sigma Skin', img: 'buffs/Ironskin', tip: 'Increase defense by 8' },
  regeneration: { name: 'Mewing', img: 'buffs/Regeneration', tip: 'Provides life regeneration' },
  obsidian_skin: { name: 'Ohio Skin', img: 'buffs/Obsidian_Skin', tip: 'Immune to lava' },
  battle: { name: 'Rage Baited', img: 'buffs/Happy!', tip: 'Increased enemy spawn rate' },
  spelunker: { name: 'Sus Detector', img: 'buffs/Happy!', tip: 'Shows the location of treasure and ore' },
  night_owl: { name: 'No Sleep Gang', img: 'buffs/Happy!', tip: 'Increased night vision' },
  potion_sickness: { name: 'Copium Overdose', img: 'buffs/Potion_Sickness', tip: 'Cannot consume anymore healing items', debuff: true },
  mana_sickness: { name: 'Mewing Fatigue', img: 'buffs/Mana_Sickness', tip: 'Magic damage reduced', debuff: true },
  on_fire: { name: 'On Fire! (Crashing Out)', img: 'buffs/On_Fire!', tip: 'Slowly losing life', debuff: true },
  poisoned: { name: 'Poisoned', img: 'buffs/Poisoned', tip: 'Slowly losing life', debuff: true },
  bleeding: { name: 'Bleeding', img: 'buffs/Bleeding', tip: 'Cannot regenerate life', debuff: true },
  aura: { name: 'Aura Farming', img: 'buffs/Happy!', tip: '+6% damage, +7% movement speed. You are him.' },
  labubu: { name: 'Labubu', img: 'gen/item_labubu', tip: 'A Labubu is following you. Secret pull.' },
  cozy: { name: 'Cozy Fire', img: 'buffs/Cozy_Fire', tip: 'Life regen is slightly increased' },
  happy: { name: 'Vibing', img: 'buffs/Happy!', tip: 'Sunflower nearby: movement speed up' },
};

class Player {
  constructor(name, look, difficulty = 0) {
    this.name = name || 'Sigma';
    this.look = look || randomLook();
    this.difficulty = difficulty;
    this.w = 20; this.h = 42;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.dir = 1; this.onGround = false;
    this.lifeMax = 100; this.life = 100; this.manaMaxBase = 20; this.mana = 20;
    this.inv = new Array(50).fill(null);
    this.armor = [null, null, null];
    this.acc = [null, null, null, null, null];
    this.piggy = new Array(40).fill(null);
    this.trash = null; this.mouseItem = null; this.sel = 0;
    this.buffs = {};
    this.bedX = null; this.bedY = null;
    this.achievements = {};
    this.stats = { kills: 0, deaths: 0, sixSevens: 0 };
    this.resetTransient();
    // starting gear (Terraria 1.4: copper shortsword, pickaxe, axe)
    this.inv[0] = { id: 'copper_shortsword', count: 1 };
    this.inv[1] = { id: 'copper_pickaxe', count: 1 };
    this.inv[2] = { id: 'copper_axe', count: 1 };
    this.inv[3] = { id: 'torch', count: 10 };
  }
  resetTransient() {
    this.jump = 0; this.jumpHeld = false; this.canDouble = false; this.rocketTime = 0;
    this.itemAnim = 0; this.itemAnimMax = 0; this.itemTimer = 0; this.useItem = null; this.useAngle = 0; this.swingId = 0;
    this.immune = 0; this.dead = false; this.respawn = 0; this.regenTimer = 0; this.regenAcc = 0; this.manaAcc = 0; this.manaDelay = 0;
    this.fallStart = null; this.walkFrame = 0; this.hurtFlash = 0; this.hook = null; this.emote = 0; this.emoteCd = 0; this.lavaTime = 0;
    this.breath = 200; this.fireTick = 0; this.stepOffset = 0;
    this.calc = { defense: 0, moveSpeed: 1, meleeSpeed: 1, dmg: 1, meleeDmg: 1, crit: 4, manaMax: 20, fx: {} };
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get manaMax() { return this.calc.manaMax; }
  held() { return this.inv[this.sel]; }
  heldItem() { const s = this.held(); return s ? ITEMS[s.id] : null; }

  // ---------- stats from gear/buffs ----------
  updateStats() {
    const c = { defense: 0, moveSpeed: 1, meleeSpeed: 1, dmg: 1, meleeDmg: 1, crit: 4, manaMax: this.manaMaxBase, lifeRegen: 0, fx: {} };
    const sets = {};
    for (const s of this.armor) if (s) { const it = ITEMS[s.id]; c.defense += it.defense || 0; if (it.crit) c.crit += it.crit; if (it.meleeDmg) c.meleeDmg += it.meleeDmg; sets[it.set] = (sets[it.set] || 0) + 1; }
    for (const [set, n] of Object.entries(sets)) if (n === 3) {
      const b = SET_BONUS[set]; c.setBonus = b.text;
      if (b.def) c.defense += b.def; if (b.moveSpeed) c.moveSpeed += b.moveSpeed; if (b.meleeDmg) c.meleeDmg += b.meleeDmg; if (b.fireImmune) c.fx.fireBlockImmune = true;
    }
    for (const s of this.acc) if (s) {
      const fx = ITEMS[s.id].fx || {};
      for (const [k, v] of Object.entries(fx)) {
        if (k === 'defense') c.defense += v; else if (k === 'moveSpeed') c.moveSpeed += v; else if (k === 'meleeSpeed') c.meleeSpeed += v;
        else if (k === 'maxMana') c.manaMax += v; else if (k === 'lifeRegen') c.lifeRegen += v; else c.fx[k] = v;
      }
    }
    const b = this.buffs;
    if (b.well_fed) { c.defense += 2; c.moveSpeed += 0.05; c.meleeSpeed += 0.05; c.dmg += 0.05; c.crit += 2; c.lifeRegen += 0.5; }
    if (b.swiftness) c.moveSpeed += 0.25;
    if (b.ironskin) c.defense += 8;
    if (b.regeneration) c.lifeRegen += 2;
    if (b.aura) { c.dmg += 0.06; c.moveSpeed += 0.07; }
    if (b.cozy) c.lifeRegen += 0.5;
    if (b.happy) c.moveSpeed += 0.1;
    const h = this.heldItem();
    if (h && h.id === 'umbrella') c.fx.slowFall = true;
    this.calc = c;
    if (this.mana > c.manaMax) this.mana = c.manaMax;
  }

  // ---------- per tick ----------
  update(world) {
    if (this.dead) {
      if (--this.respawn <= 0) this.spawn(world);
      return;
    }
    this.updateStats();
    this.updateBuffs();
    const fx = this.calc.fx;
    const ui = G.ui;
    const typing = !!Input.typing || ui.chatOpen;
    const L = !typing && (Input.down('a') || Input.down('ArrowLeft'));
    const Rt = !typing && (Input.down('d') || Input.down('ArrowRight'));
    const J = !typing && Input.down(' ');
    const D = !typing && (Input.down('s') || Input.down('ArrowDown'));

    // ---- grappling hook ----
    if (!typing && Input.hit('e')) this.throwHook();
    if (this.hook) this.updateHook(world, J);

    // ---- horizontal (Terraria: maxRunSpeed 3, runAcceleration .08, runSlowdown .2) ----
    let maxSpd = 3 * this.calc.moveSpeed, acc = 0.08 * this.calc.moveSpeed, slow = 0.2 * this.calc.moveSpeed;
    let grav = 0.4, maxFall = 10, jumpSpeed = 5.01;
    const ice = TILES[world.tile(Math.floor(this.cx / TS), Math.floor((this.y + this.h + 2) / TS))]?.slippery;
    if (ice) slow *= 0.15;
    if (this.wet) { maxSpd *= 0.5; acc *= 0.5; grav = 0.2; maxFall = 5; }
    if (this.inWeb) { maxSpd *= 0.2; maxFall = 1; this.vy *= 0.5; }
    if (fx.slowFall && this.vy > 0 && !D) maxFall = 2;
    const busy = this.itemAnim > 0 && this.useItem && (this.useItem.use === 'swing' || this.useItem.use === 'thrust');
    if (L && !Rt) {
      if (this.vx > -maxSpd) { if (this.vx > slow) this.vx -= slow; this.vx -= acc; if (this.vx < -maxSpd) this.vx = -maxSpd; }
      else if (fx.sprint && this.onGround && this.vx > -fx.sprint * this.calc.moveSpeed) { this.vx -= acc * 0.2; spawnDust(this.cx, this.y + this.h, '#ffffff', 1, 0.3, { life: 12 }); }
      if (!busy) this.dir = -1;
    } else if (Rt && !L) {
      if (this.vx < maxSpd) { if (this.vx < -slow) this.vx += slow; this.vx += acc; if (this.vx > maxSpd) this.vx = maxSpd; }
      else if (fx.sprint && this.onGround && this.vx < fx.sprint * this.calc.moveSpeed) { this.vx += acc * 0.2; spawnDust(this.cx, this.y + this.h, '#ffffff', 1, 0.3, { life: 12 }); }
      if (!busy) this.dir = 1;
    } else {
      const s = this.onGround ? slow : slow * 0.5;
      if (this.vx > s) this.vx -= s; else if (this.vx < -s) this.vx += s; else this.vx = 0;
    }
    if (Math.abs(this.vx) > maxSpd && !(fx.sprint && (L || Rt))) this.vx *= 0.97;

    // ---- jumping (jumpHeight 15 ticks at -5.01) ----
    if (this.hook && this.hook.state === 'latched') { /* handled by hook */ }
    else {
      if (J) {
        if (this.jump > 0) {
          if (this.vy === 0 && !this.wet) this.jump = 0;
          else { this.vy = -jumpSpeed; this.jump--; }
        } else if (!this.jumpHeld) {
          if (this.onGround || this.wet) { this.vy = -jumpSpeed; this.jump = this.wet ? 8 : 15; this.canDouble = !!fx.doubleJump; playSound('jump', 0.3); this.fallStart = null; }
          else if (this.canDouble) {
            this.canDouble = false; this.vy = -jumpSpeed; this.jump = 12;
            for (let i = 0; i < 12; i++) spawnDust(this.cx, this.y + this.h, '#e8f4ff', 1, 1.5, { grav: 0, life: 25, size: 4 });
            combatText(this.cx, this.y - 10, pick(['delulu!', 'solulu!', 'yeet']), '#cfe8ff', { life: 40 });
          }
        } else if (fx.rocket && this.rocketTime > 0 && !this.onGround) {
          this.vy = Math.max(this.vy - 0.55, -6); this.rocketTime--;
          spawnDust(this.cx - this.dir * 4, this.y + this.h, pick(['#ffcf4a', '#ff7a1a', '#ffffff']), 2, 0.8, { vy: 2, grav: 0, life: 15 });
          if (G.tick % 12 === 0) playSound('item13', 0.25);
        }
        this.jumpHeld = true;
      } else { this.jump = 0; this.jumpHeld = false; }
      if (this.onGround) { this.rocketTime = fx.rocket || 0; this.canDouble = !!fx.doubleJump; }
      this.vy += grav;
      if (this.vy > maxFall) this.vy = maxFall;
    }

    // ---- move ----
    const wasOnGround = this.onGround;
    const oy = this.y;
    moveEntity(this, world, { fallThrough: D });
    // camera smoothing for step-ups
    if (this.stepOffset > 0) this.stepOffset = Math.max(0, this.stepOffset - 2);

    // ---- fall damage ----
    if (!this.onGround && this.vy > 0 && this.fallStart == null) this.fallStart = this.y;
    if (this.vy < 0 || this.wet || (this.hook && this.hook.state === 'latched')) this.fallStart = null;
    if (this.onGround && this.fallStart != null) {
      const tiles = (this.y - this.fallStart) / TS;
      if (tiles > 25 && !fx.noFallDmg) this.hurt(Math.floor((tiles - 25) * 10), 0, null, 'fall', true);
      this.fallStart = null;
    }
    if (this.onGround && !wasOnGround) this.stepOffset = 0;

    // ---- lava / hazards ----
    if (this.lavaWet) {
      if (!this.buffs.obsidian_skin) { this.hurt(80, 0, null, 'lava', true); this.addBuff('on_fire', 7 * 60); }
    }
    if (!fx.fireBlockImmune && G.tick % 20 === 0) {
      const tx0 = Math.floor((this.x - 1) / TS), tx1 = Math.floor((this.x + this.w + 1) / TS), ty0 = Math.floor(this.y / TS), ty1 = Math.floor((this.y + this.h + 1) / TS);
      outer: for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (world.tile(tx, ty) === T.HELLSTONE) { this.hurt(20, 0, null, 'lava', true); this.addBuff('on_fire', 3 * 60); break outer; }
    }
    // breath
    const headT = world.liq(Math.floor(this.cx / TS), Math.floor((this.y + 8) / TS));
    if (headT > 128 && world.ltype[world.idx(Math.floor(this.cx / TS), Math.floor((this.y + 8) / TS))] === 0) {
      this.breath--; if (this.breath < 0 && G.tick % 10 === 0) this.hurt(2, 0, null, 'drown', true);
    } else this.breath = Math.min(200, this.breath + 3);
    if (this.wet && !this.wasWet) { playSound('splash', 0.5); spawnDust(this.cx, this.y + this.h, '#6fa8ff', 10, 2, { up: 2 }); }
    this.wasWet = this.wet;

    // ---- regen ----
    this.regenTimer++;
    if (this.immune > 0) this.immune--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    let regen = this.buffs.bleeding ? 0 : (this.regenTimer > 480 ? 1 : 0.2) + (this.regenTimer > 1800 ? 1.5 : 0) + this.calc.lifeRegen;
    if (Math.abs(this.vx) < 0.1 && this.onGround && this.regenTimer > 300) regen *= 1.5;
    if (this.buffs.on_fire) regen -= 4;
    if (this.buffs.poisoned) regen -= 2;
    this.regenAcc += regen / 60;
    if (this.regenAcc >= 1) { const n = Math.floor(this.regenAcc); this.regenAcc -= n; this.life = Math.min(this.lifeMax, this.life + n); }
    if (this.regenAcc <= -1) { const n = Math.floor(-this.regenAcc); this.regenAcc += n; this.life -= n; combatText(this.cx, this.y, n, '#ff5a5a', { life: 30 }); if (this.life <= 0) this.kill(this.buffs.on_fire ? 'lava' : 'generic'); }
    if (this.manaDelay > 0) this.manaDelay--;
    else if (this.mana < this.manaMax) {
      this.manaAcc += (this.manaMax / 7 + 1) / 60 * (Math.abs(this.vx) < 0.1 ? 1.6 : 1);
      if (this.manaAcc >= 1) { const n = Math.floor(this.manaAcc); this.manaAcc -= n; this.mana = Math.min(this.manaMax, this.mana + n); }
    }

    // ---- 6-7 emote ----
    if (this.emoteCd > 0) this.emoteCd--;
    if (this.emote > 0) this.emote--;
    const t6 = Input.lastKeyTime['6'] || 0, t7 = Input.lastKeyTime['7'] || 0;
    if (!typing && (Input.hit('6') || Input.hit('7')) && Math.abs(t6 - t7) < 280 && t6 && t7) this.doSixSeven();

    // ---- item use ----
    this.updateItemUse(world);
    // walking animation
    if (this.onGround && Math.abs(this.vx) > 0.1) this.walkFrame += Math.abs(this.vx) * 0.12; else if (this.onGround) this.walkFrame = 0;
  }

  updateBuffs() {
    for (const k in this.buffs) {
      if (k === 'labubu') continue; // toggled pet
      if (--this.buffs[k] <= 0) delete this.buffs[k];
    }
    // environment buffs
    if (G.tick % 60 === 0) {
      const near = (id, r) => G.nearTile(this, id, r);
      if (near(T.SUNFLOWER, 20)) this.buffs.happy = 70;
      if (near(T.HELLFORGE, 10) || near(T.FURNACE, 6)) this.buffs.cozy = 70;
    }
  }
  addBuff(name, ticks) { this.buffs[name] = Math.max(this.buffs[name] || 0, ticks); }

  doSixSeven() {
    if (this.emoteCd > 0) return;
    this.emote = 90; this.emoteCd = 60 * 6;
    this.stats.sixSevens++;
    const shout = pick(MEME.sixSevenShouts);
    combatText(this.cx, this.y - 20, shout, '#ffd23a', { big: true, life: 90 });
    Synth.six_seven(); speak('six seven!', 1.2, 1.4);
    this.addBuff('aura', 67 * 60);
    for (let i = 0; i < 30; i++) spawnDust(this.cx, this.y, pick(['#ffd23a', '#ff4d6d', '#4dd2ff', '#7dff6b', '#ffffff']), 1, 3, { up: 2, life: 60, size: 3 });
    G.achieve('six_seven_emote');
    G.chatReact();
    // nearby town NPCs join in
    for (const n of G.npcs) if (n.town && dist(n.x, n.y, this.x, this.y) < 400) { n.emote = 90; combatText(n.x + n.w / 2, n.y - 16, pick(['six seven', '67!', 'SIX SEVEN']), '#ffd23a', { life: 70 }); }
  }

  // ---------- items ----------
  inReach(tx, ty, extra = 0) {
    const reach = 5 + extra;
    const px0 = Math.floor(this.x / TS) - reach, px1 = Math.floor((this.x + this.w) / TS) + reach;
    const py0 = Math.floor(this.y / TS) - reach + 1, py1 = Math.floor((this.y + this.h) / TS) + reach - 1;
    return tx >= px0 && tx <= px1 && ty >= py0 && ty <= py1;
  }
  updateItemUse(world) {
    const ui = G.ui;
    if (this.itemAnim > 0) {
      this.itemAnim--;
      if (this.itemTimer > 0) this.itemTimer--;
      const it = this.useItem;
      // melee hit detection while animating
      if (it && (it.use === 'swing' || it.use === 'thrust') && it.damage && !it.noMelee) this.meleeHits(it);
      // tools repeat
      if (it && (it.pick || it.axe || it.hammer) && this.itemTimer === 0 && Input.mDown && !ui.mouseOverUI && !ui.inventoryDrag) {
        this.useTool(world, it); this.itemTimer = Math.max(1, Math.round(it.useTime / this.calc.meleeSpeed));
      }
      if (this.itemAnim === 0) {
        if (it && it.recall) this.teleportHome(world);
        this.useItem = null;
      }
      return;
    }
    const s = this.held();
    if (!s || this.mouseItem || G.ui.blockWorldClick) return;
    const it = ITEMS[s.id];
    const wantUse = Input.mDown && !ui.mouseOverUI && (Input.mClick || it.autoReuse || it.pick || it.axe || it.hammer);
    if (!wantUse) return;
    this.startUse(world, s, it);
  }
  startUse(world, s, it) {
    if (!it.use && !it.pick && !it.axe && !it.hammer) return;
    const mx = G.mouseWorldX(), my = G.mouseWorldY();
    const tx = Math.floor(mx / TS), ty = Math.floor(my / TS);
    let spd = it.dmgType === 'melee' ? this.calc.meleeSpeed : 1;
    const useTime = Math.max(2, Math.round(it.useTime / spd)), useAnim = Math.max(2, Math.round(it.useAnim / spd));
    let ok = true;
    switch (it.use) {
      case 'place': {
        if (!this.inReach(tx, ty)) return;
        if (TILES[it.place]?.solid && this.overlapsTile(tx, ty)) return;
        if (G.npcBlocksTile(tx, ty)) return;
        if (!world.placeTile(tx, ty, it.place)) return;
        playSound('place', 0.6);
        this.consumeHeld(1);
        if (it.id === 'toilet') { Synth.skibidi(0.6); combatText(tx * TS + 8, ty * TS - 10, 'skibidi!', '#ffffff', { life: 40 }); }
        break;
      }
      case 'placeWall': {
        if (!this.inReach(tx, ty)) return;
        if (world.wall(tx, ty) || (world.tile(tx, ty) && TILES[world.tile(tx, ty)].solid)) return;
        if (!(world.wall(tx - 1, ty) || world.wall(tx + 1, ty) || world.wall(tx, ty - 1) || world.wall(tx, ty + 1) || world.tile(tx - 1, ty) || world.tile(tx + 1, ty) || world.tile(tx, ty + 1) || world.tile(tx, ty - 1))) return;
        world.setWall(tx, ty, it.placeWall); playSound('place', 0.5);
        this.consumeHeld(1);
        break;
      }
      case 'consume': ok = this.consume(world, it); if (!ok) return; break;
      case 'shoot': case 'throw': ok = this.shoot(world, it, mx, my); if (!ok) return; break;
      case 'bucket': {
        if (!this.inReach(tx, ty)) return;
        const i = world.idx(tx, ty);
        if (world.liquid[i] < 200) return;
        const lt = world.ltype[i];
        world.liquid[i] = 0; Liquid.wake(world, tx, ty); Net.sendLiquid(i);
        this.consumeHeld(1);
        const left = invAdd(this.inv, lt ? 'lava_bucket' : 'water_bucket', 1);
        if (left) G.dropItem(this.cx, this.cy, lt ? 'lava_bucket' : 'water_bucket', 1);
        playSound('splash', 0.5);
        break;
      }
      case 'pour': {
        if (!this.inReach(tx, ty)) return;
        if (world.solid(tx, ty) || world.liq(tx, ty) > 100) return;
        const i = world.idx(tx, ty);
        world.liquid[i] = 255; world.ltype[i] = it.liquid; Liquid.wake(world, tx, ty); Net.sendLiquid(i);
        this.consumeHeld(1); invAdd(this.inv, 'empty_bucket', 1);
        playSound('splash', 0.5);
        break;
      }
      case 'use': {
        if (it.pet) {
          if (this.buffs.labubu) { delete this.buffs.labubu; G.removePet(); }
          else { this.buffs.labubu = 1; G.spawnPet(); G.achieve('labubu'); speak('labubu!', 1.1, 1.6); }
        }
        if (it.recall) { playSound('mirror'); }
        break;
      }
    }
    this.useItem = it; this.itemAnim = useAnim; this.itemAnimMax = useAnim; this.itemTimer = 0; this.swingId++;
    this.useAngle = Math.atan2(my - this.cy, mx - this.cx);
    if (it.use === 'swing' || it.use === 'thrust' || it.pick || it.axe || it.hammer) {
      this.dir = mx < this.cx ? -1 : 1;
      if (it.use === 'swing') playSound('swing', 0.6);
    }
    if (it.pick || it.axe || it.hammer) { this.useTool(world, it); this.itemTimer = useTime; }
  }
  overlapsTile(tx, ty) {
    const r = { x: tx * TS, y: ty * TS, w: TS, h: TS };
    return rectsOverlap(r, this);
  }
  consumeHeld(n) {
    const s = this.inv[this.sel];
    if (!s) return;
    s.count -= n; if (s.count <= 0) this.inv[this.sel] = null;
  }
  consume(world, it) {
    if (it.potion && this.buffs.potion_sickness) return false;
    if (it.summon) { if (!G.trySummon(it.summon, this)) return false; }
    if (it.lifeCrystal) { if (this.lifeMax >= 400) return false; this.lifeMax += 20; this.life += 20; combatText(this.cx, this.y, '+1000 aura', '#ff6fa8', { big: true }); playSound('crystal'); G.achieve('heart_breaker'); }
    if (it.manaCrystal) { if (this.manaMaxBase >= 200) return false; this.manaMaxBase += 20; this.mana += 20; playSound('crystal'); }
    if (it.heal) { this.heal(it.heal); if (it.potion) this.addBuff('potion_sickness', 60 * 60); }
    if (it.healMana) { this.mana = Math.min(this.manaMax, this.mana + it.healMana); combatText(this.cx, this.y, it.healMana, '#5a8cff'); this.addBuff('mana_sickness', 5 * 60); }
    if (it.buff) { this.addBuff(it.buff[0], it.buff[1] * 60); }
    if (it.recall) { this.teleportHome(world); }
    playSound(it.buff && it.buff[0] === 'well_fed' ? 'eat' : 'potion');
    this.consumeHeld(1);
    return true;
  }
  heal(n) {
    const h = Math.min(n, this.lifeMax - this.life);
    this.life += h;
    combatText(this.cx, this.y, n, '#64ff64');
  }
  findAmmo(type) {
    // Terraria prefers ammo slots; we just search the inventory from the end
    for (let i = 0; i < this.inv.length; i++) { const s = this.inv[i]; if (s && ITEMS[s.id].ammoType === type) return i; }
    return -1;
  }
  shoot(world, it, mx, my) {
    let dmg = it.damage, proj = it.shoot, speed = it.shootSpeed || 8, kb = it.kb || 0;
    if (it.mana) {
      if (this.mana < it.mana) { return false; }
      this.mana -= it.mana; this.manaDelay = 60;
    }
    if (it.ammo) {
      const ai = this.findAmmo(it.ammo);
      if (ai < 0) return false;
      const am = ITEMS[this.inv[ai].id];
      dmg += am.damage; proj = am.proj;
      if (it.arrowFire && proj === 'arrow') proj = 'flaming_arrow';
      if (!(it.ammoSave && Math.random() < it.ammoSave)) { this.inv[ai].count--; if (!this.inv[ai].count) this.inv[ai] = null; }
      playSound(it.ammo === 'bullet' ? 'gun' : 'bow', 0.6);
    } else if (it.dmgType === 'magic') playSound('magic', 0.5);
    else playSound('throw', 0.6);
    if (it.use === 'throw' && ITEMS[it.id].consumable) this.consumeHeld(1);
    const ang = Math.atan2(my - this.cy, mx - this.cx);
    this.dir = mx < this.cx ? -1 : 1;
    if (proj === 'boomerang' || proj === 'wooden_boomerang' || proj === 'plunger' || proj === 'flail') {
      if (G.projectiles.some(p => p.owner === this && p.type === proj)) return false;
    }
    G.spawnProjectile(proj, this.cx, this.cy - 4, Math.cos(ang) * speed, Math.sin(ang) * speed, this.finalDamage(it, dmg), kb, this, { targetX: mx, targetY: my });
    return true;
  }
  finalDamage(it, base) {
    let m = this.calc.dmg;
    if (it.dmgType === 'melee') m += this.calc.meleeDmg - 1;
    if (it.dmgType === 'magic' && this.buffs.mana_sickness) m -= 0.2;
    return base * m;
  }
  useTool(world, it) {
    const mx = G.mouseWorldX(), my = G.mouseWorldY();
    let tx = Math.floor(mx / TS), ty = Math.floor(my / TS);
    if (!this.inReach(tx, ty)) return;
    const t = world.tile(tx, ty), td = TILES[t];
    if (it.axe && td && (td.tree || td.cactus)) { world.hitTile(tx, ty, it.axe, 'axe'); return; }
    if (it.hammer && td && td.needHammer) { world.hitTile(tx, ty, it.hammer, 'hammer'); return; }
    if (it.pick && t && !(td.tree || td.cactus)) { world.hitTile(tx, ty, it.pick, 'pick'); return; }
    if (it.axe && td && td.anyTool && !it.pick) { world.hitTile(tx, ty, it.axe, 'axe'); return; }
    if (it.hammer && (!t || !td.solid) && world.wall(tx, ty)) { world.hitWall(tx, ty, it.hammer); return; }
  }
  // ---------- melee ----------
  swingProgress() { return 1 - this.itemAnim / this.itemAnimMax; }
  itemAngle() {
    const it = this.useItem;
    if (!it) return 0;
    const p = this.swingProgress();
    if (it.use === 'thrust') return this.useAngle;
    // swing from up-behind to down-front
    const a = lerp(-2.4, 0.9, p);
    return this.dir > 0 ? a : Math.PI - a;
  }
  handPos() { return [this.cx + this.dir * 2, this.y + 20]; }
  meleeHits(it) {
    const img = getImg(it.img);
    const len = Math.hypot(img.width, img.height) * (it.scale || 1) * (it.use === 'thrust' ? 1 : 1);
    const [hx, hy] = this.handPos();
    const a = this.itemAngle();
    let ext = 0;
    if (it.use === 'thrust') ext = Math.sin(this.swingProgress() * Math.PI) * (it.reach || 18);
    const pts = [];
    for (const f of [0.35, 0.7, 1]) pts.push([hx + Math.cos(a) * (len * f + ext), hy + Math.sin(a) * (len * f + ext)]);
    for (const n of G.npcs) {
      if (n.friendly || n.dead || n.immuneTo(this.swingId)) continue;
      for (const [px, py] of pts) {
        if (px > n.x - 6 && px < n.x + n.w + 6 && py > n.y - 6 && py < n.y + n.h + 6) {
          const dmg = this.finalDamage(it, it.damage);
          n.hitBy(this.swingId, it.fixedDamage ? 67 : dmg, it.kb, this.cx < n.x + n.w / 2 ? 1 : -1, this.calc.crit, it);
          if (it.shoot === 'starfury_star') { }
          break;
        }
      }
    }
    // cut grass/pots with a swing
    for (const [px, py] of pts) {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      const t = TILES[G.world.tile(tx, ty)];
      if (t && t.cut) G.world.breakTile(tx, ty, true);
    }
    // swing projectiles (starfury / the 67)
    if (it.shoot && this.itemAnim === this.itemAnimMax - 1) {
      const mx = G.mouseWorldX(), my = G.mouseWorldY();
      if (it.shoot === 'starfury_star') {
        const sx = mx + randRange(-100, 100), sy = this.y - 600;
        const ang = Math.atan2(my - sy, mx - sx);
        G.spawnProjectile('starfury_star', sx, sy, Math.cos(ang) * 16, Math.sin(ang) * 16, this.finalDamage(it, it.damage), 3, this);
        playSound('item9', 0.5);
      } else if (it.shoot === 'sixseven') {
        const ang = Math.atan2(my - this.cy, mx - this.cx);
        G.spawnProjectile('sixseven', this.cx, this.cy, Math.cos(ang) * it.shootSpeed, Math.sin(ang) * it.shootSpeed, 67, 4, this, { glyph: this.swingId % 2 ? 7 : 6 });
      }
    }
  }
  // ---------- damage ----------
  hurt(dmg, kbDir, source, cause = 'enemy', ignoreDefense = false) {
    if (this.dead || this.immune > 0 || G.godMode) return false;
    let d = ignoreDefense ? dmg : Math.max(1, Math.round(dmg - this.calc.defense * 0.5));
    if (!ignoreDefense) d = Math.max(1, Math.round(d * randRange(0.85, 1.15)));
    this.life -= d;
    this.regenTimer = 0;
    this.immune = 40; this.hurtFlash = 10;
    combatText(this.cx, this.y, d, '#ff5a5a');
    playSound('player_hit', 0.8);
    spawnDust(this.cx, this.cy, '#b01010', 8, 2);
    if (kbDir && !this.calc.fx.noKnockback) { this.vx = kbDir * 4.5; this.vy = -3.5; }
    if (this.hook) this.hook = null;
    if (this.life <= 0) this.kill(cause, source);
    return true;
  }
  kill(cause, source) {
    if (this.dead) return;
    this.life = 0; this.dead = true;
    this.stats.deaths++;
    playSound('player_killed');
    for (let i = 0; i < 40; i++) spawnDust(this.cx, this.cy, '#b01010', 1, 4, { life: 60 });
    const pool = MEME.deaths[cause === 'enemy' && source ? 'enemy' : cause] || MEME.deaths.generic;
    const msg = fmtMeme(pick(pool), { p: this.name, e: source ? source.name : 'something' });
    G.announce(msg, '#e1453a');
    G.deathMessage = pick(MEME.deathScreen);
    G.deathTip = pick(MEME.respawnTips);
    G.achieve('cooked');
    const bossAlive = G.npcs.some(n => n.boss);
    this.respawn = bossAlive ? 60 * 15 : 60 * 6;
    // softcore: drop half the coins; mediumcore: drop everything
    const money = invMoney(this.inv);
    if (this.difficulty === 0 && money > 0) {
      const lost = Math.floor(money / 2);
      invSpend(this.inv, lost);
      for (const [id, n] of coinsFor(lost)) G.dropItem(this.cx, this.cy, id, n);
      if (lost) G.chat('You dropped ' + formatAura(lost) + '. Fanum taxed by death.', '#e1453a');
    } else if (this.difficulty >= 1) {
      for (let i = 0; i < this.inv.length; i++) if (this.inv[i]) { G.dropItem(this.cx, this.cy, this.inv[i].id, this.inv[i].count); this.inv[i] = null; }
    }
    // tombstone
    const tx = Math.floor(this.cx / TS), ty = Math.floor(this.cy / TS);
    for (let dy = 0; dy < 20; dy++) {
      if (G.world.canPlaceObject(tx, ty + dy, T.TOMBSTONE)) { G.world.placeObject(tx, ty + dy, T.TOMBSTONE); break; }
    }
    this.hook = null;
    if (this.difficulty === 2) G.hardcoreDeath = true;
  }
  spawn(world) {
    this.dead = false;
    this.life = Math.max(this.life, Math.floor(this.lifeMax)); this.mana = this.manaMax;
    let sx = world.spawnX, sy = world.spawnY;
    if (this.bedX != null && world.tile(this.bedX, this.bedY) === T.BED) { sx = this.bedX + 1; sy = this.bedY - 1; }
    else if (this.bedX != null) { G.chat('Your bed is gone. Spawn reset. (Bro got evicted.)', '#ffd23a'); this.bedX = null; }
    // find standing space
    let y = sy;
    for (let k = 0; k < 60 && rectHitsSolid(world, sx * TS + 8 - this.w / 2, (y + 1) * TS - this.h, this.w, this.h); k++) y--;
    this.x = sx * TS + 8 - this.w / 2; this.y = (y + 1) * TS - this.h;
    this.vx = 0; this.vy = 0; this.immune = 120; this.fallStart = null; this.hook = null;
    this.buffs = this.buffs.labubu ? { labubu: 1 } : {};
  }
  teleportHome(world) {
    for (let i = 0; i < 30; i++) spawnDust(this.cx, this.cy, '#9ad7ff', 1, 3, { grav: 0 });
    const hp = this.life;
    this.spawn(world);
    this.life = hp; this.immune = 30;
    for (let i = 0; i < 30; i++) spawnDust(this.cx, this.cy, '#9ad7ff', 1, 3, { grav: 0 });
    playSound('mirror');
  }
  // ---------- pickups ----------
  canHold(id, count) {
    const it = ITEMS[id];
    if (!it) return false;
    if (it.pickupHeal || it.pickupMana || it.coin) return true;
    for (const s of this.inv) if (!s || (s.id === id && s.count < it.stack)) return true;
    return false;
  }
  pickup(drop) {
    const left = this.receiveItem(drop.id, drop.count);
    if (left > 0) { drop.count = left; drop.noGrab = 60; }
    else drop.life = 0;
  }
  // add an item to this player (from a drop or a multiplayer pickup grant); returns what didn't fit
  receiveItem(id, count) {
    const it = ITEMS[id];
    if (!it) return 0;
    if (it.pickupHeal) { this.heal(it.pickupHeal); playSound('grab', 0.5); return 0; }
    if (it.pickupMana) { this.mana = Math.min(this.manaMax, this.mana + it.pickupMana); combatText(this.cx, this.y, it.pickupMana, '#5a8cff'); playSound('grab', 0.5); return 0; }
    if (it.coin) {
      invAddMoney(this.inv, it.coin * count);
      playSound('coins', 0.5);
      G.pickupText(it.coin * count, true);
      if (invMoney(this.inv) >= 10000) G.achieve('rich');
      return 0;
    }
    const left = invAdd(this.inv, id, count, 0, 50);
    if (count - left > 0) G.pickupText(id, false, count - left);
    playSound('grab', 0.6);
    if (left > 0 && Net.isClient) { G.throwItem(this.cx, this.cy, id, left, 0, -2, 60); return 0; }
    return left;
  }

  // ---------- grappling hook ----------
  hasHook() { return this.inv.some(s => s && ITEMS[s.id].hook); }
  throwHook() {
    if (!this.hasHook()) return;
    if (this.hook && this.hook.state !== 'retract') return;
    const mx = G.mouseWorldX(), my = G.mouseWorldY();
    const a = Math.atan2(my - this.cy, mx - this.cx);
    this.hook = { x: this.cx, y: this.cy, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, state: 'fly' };
    playSound('item10', 0.4);
  }
  updateHook(world, J) {
    const h = this.hook;
    if (h.state === 'fly') {
      for (let s = 0; s < 3; s++) {
        h.x += h.vx / 3; h.y += h.vy / 3;
        const tx = Math.floor(h.x / TS), ty = Math.floor(h.y / TS);
        if (world.solid(tx, ty) || world.isPlatform(tx, ty) || TILES[world.tile(tx, ty)]?.tree) { h.state = 'latched'; playSound('tink', 0.4); this.jump = 0; break; }
      }
      if (dist(h.x, h.y, this.cx, this.cy) > 300) h.state = 'retract';
    } else if (h.state === 'latched') {
      const tx = Math.floor(h.x / TS), ty = Math.floor(h.y / TS);
      if (!(world.solid(tx, ty) || world.isPlatform(tx, ty) || TILES[world.tile(tx, ty)]?.tree)) { h.state = 'retract'; return; }
      const d = dist(h.x, h.y, this.cx, this.cy);
      if (d > 20) { this.vx = (h.x - this.cx) / d * 11; this.vy = (h.y - this.cy) / d * 11; }
      else { this.vx = 0; this.vy = 0; }
      this.canDouble = !!this.calc.fx.doubleJump; this.rocketTime = this.calc.fx.rocket || 0;
      if (J && !this.jumpHeld) { this.hook = null; this.vy = -5.01; this.jump = 10; this.jumpHeld = true; }
    } else {
      const d = dist(h.x, h.y, this.cx, this.cy);
      h.x += (this.cx - h.x) / d * 16; h.y += (this.cy - h.y) / d * 16;
      if (d < 20) this.hook = null;
    }
  }

  // ---------- drawing ----------
  draw(ctx, camX, camY) {
    if (this.dead) return;
    if (this.immune > 0 && this.immune % 8 < 4 && this.hurtFlash <= 0 && this.immune < 110) ctx.globalAlpha = 0.5;
    // hook chain
    if (this.hook) {
      ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(this.cx - camX, this.cy - camY); ctx.lineTo(this.hook.x - camX, this.hook.y - camY); ctx.stroke(); ctx.setLineDash([]);
      const img = getImg('items/Grappling_Hook');
      ctx.drawImage(img, this.hook.x - camX - 8, this.hook.y - camY - 8, 16, 16);
    }
    drawHumanoid(ctx, this, Math.round(this.x - camX), Math.round(this.y - camY + this.stepOffset));
    ctx.globalAlpha = 1;
    if (this.emote > 0) {
      const img = getImg('gen/hands');
      const bob = Math.sin(this.emote * 0.5) * 6;
      ctx.drawImage(img, Math.round(this.cx - camX - img.width / 2), Math.round(this.y - camY - 28 + bob));
    }
  }
}

function randomLook() {
  const hairs = ['#5a3a1e', '#1b1b1b', '#e2c16b', '#b5462c', '#8e5b37', '#ff6ec7', '#6ecbff', '#ffffff'];
  const skins = ['#f0c39a', '#d9a066', '#b87945', '#8a5a33', '#5e3a1f', '#ffd8b8'];
  const shirts = ['#3a7bd5', '#d53a3a', '#3ad56a', '#d5a53a', '#7b3ad5', '#222222', '#ffffff', '#ff8ac5'];
  const pants = ['#3b3b6e', '#5a4632', '#2e2e2e', '#6e3b3b', '#2f5a3a'];
  return { hair: pick(hairs), hairStyle: randInt(0, 3), skin: pick(skins), eyes: pick(['#3a5ad5', '#3a8a3a', '#6b4020', '#222']), shirt: pick(shirts), under: pick(shirts), pants: pick(pants), shoes: '#3a2a1a' };
}

// Terraria-proportioned humanoid drawn from rects (2px art pixels). Used by the player & previews.
function drawHumanoid(ctx, p, sx, sy, opts = {}) {
  const look = p.look, S = 2, dir = p.dir || 1;
  const armor = opts.armor || p.armor || [];
  const head = armor[0] && ITEMS[armor[0].id], body = armor[1] && ITEMS[armor[1].id], legs = armor[2] && ITEMS[armor[2].id];
  const hc = head ? ARMOR_COLORS[head.set] : null, bc = body ? ARMOR_COLORS[body.set] : null, lc = legs ? ARMOR_COLORS[legs.set] : null;
  const walking = p.onGround && Math.abs(p.vx) > 0.1;
  const airborne = p.onGround === false && !opts.preview;
  const f = walking ? Math.sin(p.walkFrame * 1.3) : 0;
  const flash = p.hurtFlash > 0;
  ctx.save();
  ctx.translate(sx + p.w / 2, sy);
  ctx.scale(dir, 1);
  ctx.translate(-10, 0);
  const R = (x, y, w, h, c) => { ctx.fillStyle = flash ? '#ff7070' : c; ctx.fillRect(x * S, y * S, w * S, h * S); };
  const skin = look.skin;
  // back arm
  const backSwing = walking ? -f * 2 : 0;
  R(3 - (backSwing > 0 ? 1 : 0), 9 + (airborne ? -1 : 0), 2, 5, bc ? bc[1] : shade(look.shirt, -30));
  R(3 - (backSwing > 0 ? 1 : 0), 14 + (airborne ? -1 : 0), 2, 1, skin);
  // legs
  const legA = airborne ? 1 : Math.round(f * 2), legB = airborne ? -1 : -Math.round(f * 2);
  const pc = lc ? lc[0] : look.pants, pc2 = lc ? lc[1] : shade(look.pants, -25);
  R(3 + legB, 15, 2, 4, pc2); R(3 + legB, 19, 3, 2, lc ? lc[1] : look.shoes);
  R(5 + legA, 15, 2, 4, pc); R(5 + legA, 19, 3, 2, lc ? lc[1] : look.shoes);
  R(3, 14, 5, 2, pc);
  // torso
  R(3, 8, 5, 7, bc ? bc[0] : look.shirt);
  R(5, 8, 2, 6, bc ? bc[1] : look.under);
  if (bc) { R(3, 11, 5, 1, bc[1]); }
  // head
  R(3, 1, 6, 7, skin);
  R(8, 4, 1, 2, skin);
  R(6, 4, 1, 1, '#ffffff'); R(7, 4, 1, 1, look.eyes);
  R(6, 6, 2, 1, shade(skin, -35));
  if (hc) {
    R(2, 0, 8, 4, hc[0]); R(2, 4, 2, 3, hc[0]); R(5, 3, 5, 1, hc[1]);
  } else {
    const hs = look.hairStyle;
    R(3, 0, 6, 2, look.hair); R(2, 1, 2, 5 + (hs === 1 ? 3 : 0), look.hair); R(4, 2, 2, 1, look.hair);
    if (hs === 2) { R(5, -1, 4, 1, look.hair); R(8, 1, 2, 2, look.hair); }
    if (hs === 3) { R(2, 6, 2, 4, look.hair); R(8, 1, 1, 2, look.hair); }
  }
  ctx.restore();
  // front arm + held item (in world coords, handles mirroring itself)
  drawFrontArm(ctx, p, sx, sy, bc, walking, f, airborne, flash);
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function drawFrontArm(ctx, p, sx, sy, bc, walking, f, airborne, flash) {
  const dir = p.dir || 1;
  const sleeve = flash ? '#ff7070' : (bc ? bc[0] : p.look.shirt), skin = flash ? '#ff7070' : p.look.skin;
  const shoulderX = sx + p.w / 2 + dir * 1, shoulderY = sy + 18;
  let armAng = Math.PI / 2 + (walking ? f * 0.5 : 0) * dir;
  if (airborne) armAng = Math.PI / 2 - 0.9 * dir;
  const it = p.useItem;
  const using = p.itemAnim > 0 && it;
  const held = p.heldItem && p.heldItem();
  if (p.emote > 0) armAng = -Math.PI / 2 + Math.sin(p.emote * 0.5) * 0.6;
  let drawHeld = null;
  if (using) {
    if (it.use === 'swing' || it.pick || it.axe || it.hammer || it.use === 'throw' && !it.consumable) armAng = p.itemAngle();
    else if (it.use === 'thrust' || it.use === 'shoot' || it.use === 'throw') armAng = p.useAngle;
    else armAng = -Math.PI / 2 + 0.4 * dir;
    drawHeld = it;
  } else if (held && (held.holdLight || held.id === 'umbrella')) { armAng = -Math.PI / 2 + 0.9 * dir; drawHeld = held; }
  // draw item behind hand
  if (drawHeld && (drawHeld.use !== 'consume')) drawHeldItem(ctx, p, drawHeld, shoulderX, shoulderY, armAng);
  ctx.save();
  ctx.translate(shoulderX, shoulderY);
  ctx.rotate(armAng - Math.PI / 2);
  ctx.fillStyle = sleeve; ctx.fillRect(-2, -1, 4, 7);
  ctx.fillStyle = skin; ctx.fillRect(-2, 6, 4, 4);
  ctx.restore();
  if (drawHeld && drawHeld.use === 'consume') {
    const img = getImg(drawHeld.img);
    ctx.drawImage(img, Math.round(shoulderX + dir * 6 - img.width / 2), Math.round(shoulderY - 14 - img.height / 2));
  }
}
function drawHeldItem(ctx, p, it, shx, shy, armAng) {
  const img = getImg(it.img);
  const dir = p.dir || 1;
  const sc = it.scale || 1;
  const hx = shx + Math.cos(armAng) * 9, hy = shy + Math.sin(armAng) * 9;
  ctx.save();
  ctx.translate(hx, hy);
  if (it.use === 'shoot' || (it.use === 'throw' && !(it.shoot === 'boomerang'))) {
    // bows/guns/wands point at the target
    ctx.rotate(armAng);
    if (Math.cos(armAng) < 0) ctx.scale(1, -1);
    const isGun = it.ammo === 'bullet';
    const isWand = it.dmgType === 'magic' && !isGun;
    if (isWand) { ctx.rotate(Math.PI / 4); ctx.drawImage(img, -2, -img.height + 2); }
    else ctx.drawImage(img, isGun ? -4 : -img.width / 2 + 4, -img.height / 2);
  } else if (it.use === 'thrust') {
    const ext = Math.sin(p.swingProgress() * Math.PI) * (it.reach || 18);
    ctx.rotate(armAng + Math.PI / 4);
    ctx.drawImage(img, -4 + ext * 0.7, -img.height + 4 - ext * 0.7, img.width * sc, img.height * sc);
  } else if (it.holdLight || it.id === 'umbrella') {
    ctx.drawImage(img, -img.width / 2, -img.height + 4);
  } else {
    // swung items: sprite points up-right; rotate so blade follows arm
    ctx.rotate(armAng + Math.PI / 4);
    if (dir < 0) { ctx.scale(1, -1); ctx.rotate(Math.PI / 2); }
    ctx.drawImage(img, -4, -img.height * sc + 4, img.width * sc, img.height * sc);
  }
  ctx.restore();
}
