// ---------- NPC definitions, AI and combat ----------
// kb: knockback resistance multiplier (Terraria knockBackResist: 1 = full knockback, 0 = immune)
const NPC_TYPES = {
  green_slime: { name: 'Skibidi Slime', img: 'npcs/Green_Slime', w: 32, h: 22, life: 14, damage: 6, defense: 0, kb: 1, ai: 'slime', value: 25, drops: [['gel', 1, 1, 2]], tint: null },
  blue_slime: { name: 'Blue Rizz Slime', img: 'npcs/Blue_Slime', w: 32, h: 22, life: 25, damage: 7, defense: 2, kb: 1, ai: 'slime', value: 25, drops: [['gel', 1, 1, 3]] },
  red_slime: { name: 'Crashout Slime', img: 'npcs/Red_Slime', w: 32, h: 22, life: 35, damage: 12, defense: 4, kb: 0.9, ai: 'slime', value: 50, drops: [['gel', 1, 2, 4]] },
  purple_slime: { name: 'Delulu Slime', img: 'npcs/Purple_Slime', w: 32, h: 22, life: 40, damage: 12, defense: 6, kb: 0.9, ai: 'slime', value: 80, drops: [['gel', 1, 2, 4]] },
  yellow_slime: { name: 'Six-Seven Slime', img: 'npcs/Yellow_Slime', w: 32, h: 22, life: 67, damage: 15, defense: 7, kb: 0.8, ai: 'slime', value: 607, drops: [['meme67_block', 1, 67, 67], ['gel', 1, 6, 7]], overlay: 'gen/text67', rare: true },
  mother_slime: { name: 'Mother Slime (Mid)', img: 'npcs/Mother_Slime', w: 44, h: 30, life: 90, damage: 20, defense: 7, kb: 0.5, ai: 'slime', value: 150, drops: [['gel', 1, 3, 6]], splitInto: 'blue_slime' },
  pinky: { name: 'Pinky (Rare Rizz)', img: 'npcs/Pinky', w: 19, h: 13, life: 150, damage: 5, defense: 5, kb: 1.4, ai: 'slime', value: 10000, drops: [['gel', 1, 5, 10]], rare: true },
  lava_slime: { name: 'Ohio Slime', img: 'npcs/Lava_Slime', w: 32, h: 22, life: 50, damage: 15, defense: 10, kb: 0.9, ai: 'slime', value: 125, drops: [['gel', 1, 2, 4]], lavaImmune: true, leavesLava: true, onHitFire: true },
  zombie: { name: 'NPC Zombie', img: 'npcs/Zombie', w: 22, h: 44, life: 45, damage: 14, defense: 6, kb: 0.5, ai: 'fighter', speed: 1, value: 60, drops: [['shackle', 0.02, 1, 1]], chatter: 'zombie', sound: 'zombie' },
  demon_eye: { name: 'Side-Eye', img: 'npcs/Demon_Eye', w: 30, h: 22, life: 60, damage: 18, defense: 2, kb: 0.8, ai: 'flyer', speed: 4, value: 75, drops: [['lens', 0.33, 1, 1]], rotate: true },
  cave_bat: { name: 'Crashout Bat', img: 'npcs/Cave_Bat', w: 22, h: 18, life: 16, damage: 13, defense: 2, kb: 0.8, ai: 'bat', speed: 3.5, value: 90, drops: [] },
  skeleton: { name: 'Mewing Skeleton', img: 'npcs/Skeleton', w: 22, h: 44, life: 60, damage: 20, defense: 8, kb: 0.5, ai: 'fighter', speed: 1.3, value: 130, drops: [['bone', 0.5, 1, 3], ['hook', 0.04, 1, 1]] },
  undead_miner: { name: 'Unc Miner', img: 'npcs/Undead_Miner', w: 22, h: 44, life: 70, damage: 22, defense: 9, kb: 0.5, ai: 'fighter', speed: 1.1, value: 200, drops: [['bomb', 0.5, 1, 5], ['bone', 0.3, 1, 2]] },
  fire_imp: { name: 'Ohio Imp', img: 'npcs/Fire_Imp', w: 28, h: 40, life: 70, damage: 20, defense: 16, kb: 0.5, ai: 'caster', value: 300, drops: [['obsidian', 0.4, 1, 3]], lavaImmune: true },
  demon: { name: 'Ohio Demon', img: 'npcs/Demon', w: 48, h: 40, life: 120, damage: 32, defense: 8, kb: 0.8, ai: 'demon', value: 300, drops: [['demon_scythe', 0.03, 1, 1]], lavaImmune: true },
  voodoo_demon: { name: 'Voodoo Ohio Demon', img: 'npcs/Voodoo_Demon', w: 48, h: 48, life: 140, damage: 32, defense: 8, kb: 0.8, ai: 'demon', value: 300, drops: [['guide_voodoo_doll', 1, 1, 1], ['demon_scythe', 0.03, 1, 1]], lavaImmune: true },
  hellbat: { name: 'Ohio Bat', img: 'npcs/Hellbat', w: 22, h: 18, life: 35, damage: 21, defense: 8, kb: 0.8, ai: 'bat', speed: 4, value: 150, drops: [], lavaImmune: true, onHitFire: true },
  eater_of_souls: { name: 'Doomscroller', img: 'npcs/Eater_of_Souls', w: 30, h: 30, life: 40, damage: 22, defense: 8, kb: 0.8, ai: 'flyer', speed: 3.5, value: 90, drops: [['rotten_chunk', 0.4, 1, 2]], rotate: true, rotOff: Math.PI / 2 },
  harpy: { name: 'Glazing Harpy', img: 'npcs/Harpy', w: 40, h: 36, life: 40, damage: 25, defense: 8, kb: 0.7, ai: 'harpy', speed: 3, value: 200, drops: [['lucky_horseshoe', 0.05, 1, 1]] },
  shark: { name: 'Tralalero Tralala', img: 'npcs/Shark', w: 90, h: 34, life: 300, damage: 40, defense: 2, kb: 0.4, ai: 'tralalero', value: 400, drops: [['hermes_boots', 0.12, 1, 1], ['cooked_fish', 0.5, 1, 2]], chatter: 'tralalero' },
  goblin_thief: { name: 'Fanum', img: 'npcs/Goblin_Thief', w: 24, h: 40, life: 80, damage: 20, defense: 6, kb: 0.6, ai: 'fighter', speed: 2.2, value: 200, drops: [['dubai_chocolate', 0.1, 1, 1], ['labubu', 0.01, 1, 1]], thief: true, chatter: 'fanum' },
  antlion: { name: 'Lirili Larila', img: 'npcs/Antlion', w: 30, h: 30, life: 45, damage: 10, defense: 10, kb: 0, ai: 'antlion', value: 100, drops: [['cactus', 0.5, 2, 6]] },
  vulture: { name: 'Lowkey Vulture', img: 'npcs/Vulture', w: 34, h: 32, life: 40, damage: 15, defense: 4, kb: 0.8, ai: 'flyer', speed: 3, value: 60, drops: [] },
  crab: { name: 'Crab Rave Crab', img: 'npcs/Crab', w: 30, h: 22, life: 40, damage: 20, defense: 10, kb: 0.5, ai: 'fighter', speed: 0.8, value: 100, drops: [] },
  skibidi_toilet: { name: 'Skibidi Toilet', img: 'gen/skibidi_0', frames: ['gen/skibidi_0', 'gen/skibidi_1'], w: 30, h: 44, life: 70, damage: 22, defense: 6, kb: 0.6, ai: 'skibidi', value: 150, drops: [['skibidi_plunger', 0.06, 1, 1], ['gel', 0.5, 1, 3]], chatter: 'skibidi' },
  ballerina: { name: 'Ballerina Cappuccina', img: 'gen/ballerina_0', frames: ['gen/ballerina_0', 'gen/ballerina_1', 'gen/ballerina_2', 'gen/ballerina_3'], w: 26, h: 62, life: 90, damage: 24, defense: 8, kb: 0.5, ai: 'fighter', speed: 2.6, value: 200, drops: [['cappuccino', 0.35, 1, 2]], chatter: 'ballerina', spin: true },
  bombardiro: { name: 'Bombardiro Crocodilo', img: 'gen/bombardiro_0', frames: ['gen/bombardiro_0', 'gen/bombardiro_1'], w: 80, h: 36, life: 120, damage: 30, defense: 10, kb: 0.3, ai: 'bombardiro', value: 400, drops: [['bomb', 1, 3, 8], ['starfury', 0.08, 1, 1]], chatter: 'bombardiro', noGravity: true, noTileCollide: true },
  servant: { name: 'Side-Eye Servant', img: 'npcs/Servant_of_Cthulhu', w: 20, h: 20, life: 8, damage: 12, defense: 0, kb: 1, ai: 'flyer', speed: 5, value: 0, drops: [['heart', 0.5, 1, 1]], rotate: true, noTileCollide: true },
  hungry: { name: 'The Hungry (Big Back)', img: 'npcs/The_Hungry', w: 30, h: 30, life: 240, damage: 30, defense: 10, kb: 0.2, ai: 'hungry', value: 0, drops: [['heart', 0.5, 1, 1]], noGravity: true, noTileCollide: true, lavaImmune: true, rotate: true },
  // the backrooms
  smiler: { name: 'Smiler', img: 'gen/smiler_0', frames: ['gen/smiler_0', 'gen/smiler_1'], w: 30, h: 30, life: 120, damage: 34, defense: 10, kb: 0.4, ai: 'smiler', speed: 2.2, value: 800, drops: [['almond_water', 0.5, 1, 2]], noTileCollide: true, glow: [0.35, 0.33, 0.25] },
  partygoer: { name: 'Partygoer =)', img: 'gen/partygoer_0', frames: ['gen/partygoer_0', 'gen/partygoer_1'], w: 26, h: 50, life: 150, damage: 30, defense: 12, kb: 0.4, ai: 'fighter', speed: 2.6, value: 900, drops: [['almond_water', 0.35, 1, 1], ['liminal_blade', 0.04, 1, 1]], chatter: 'partygoer' },
  // critters
  bunny: { name: 'Bunny (+1 aura)', img: 'npcs/Bunny', w: 18, h: 20, life: 5, damage: 0, defense: 0, kb: 1, ai: 'critter', value: 0, drops: [], friendly: true, critter: true },
  bird: { name: 'Bird', img: 'npcs/Bird', w: 16, h: 14, life: 5, damage: 0, defense: 0, kb: 1, ai: 'critter', value: 0, drops: [], friendly: true, critter: true },
  labubu_pet: { name: 'Labubu', img: 'gen/labubu_0', frames: ['gen/labubu_0', 'gen/labubu_1'], w: 20, h: 24, life: 1, damage: 0, defense: 0, kb: 0, ai: 'pet', value: 0, drops: [], friendly: true, pet: true, dontTakeDamage: true },
  // town npcs (key must match MEME.npc)
  guide: { name: 'The Rizzler', img: 'npcs/Guide', w: 20, h: 44, life: 250, damage: 10, defense: 15, kb: 0.5, ai: 'town', town: true, friendly: true, value: 0, drops: [] },
  merchant: { name: 'Unc', img: 'npcs/Merchant', w: 22, h: 44, life: 250, damage: 10, defense: 15, kb: 0.5, ai: 'town', town: true, friendly: true, value: 0, drops: [] },
  nurse: { name: 'Nurse Glaze', img: 'npcs/Nurse', w: 22, h: 44, life: 250, damage: 10, defense: 15, kb: 0.5, ai: 'town', town: true, friendly: true, value: 0, drops: [] },
  demolitionist: { name: 'Bombardiro Jr.', img: 'npcs/Demolitionist', w: 26, h: 40, life: 250, damage: 10, defense: 15, kb: 0.5, ai: 'town', town: true, friendly: true, value: 0, drops: [] },
  arms_dealer: { name: 'Sigma Dealer', img: 'npcs/Arms_Dealer', w: 22, h: 44, life: 250, damage: 10, defense: 15, kb: 0.5, ai: 'town', town: true, friendly: true, value: 0, drops: [] },
  dryad: { name: 'Delulu Dryad', img: 'npcs/Dryad', w: 22, h: 44, life: 250, damage: 10, defense: 15, kb: 0.5, ai: 'town', town: true, friendly: true, value: 0, drops: [] },
};

let npcUid = 1;
class NPC {
  constructor(type, x, y) {
    const d = NPC_TYPES[type] || BOSS_TYPES[type];
    this.uid = npcUid++;
    this.type = type; this.def = d;
    Object.assign(this, { name: d.name, w: d.w, h: d.h, life: d.life, lifeMax: d.life, damage: d.damage, defense: d.defense, kbResist: d.kb });
    this.friendly = !!d.friendly; this.town = !!d.town; this.boss = !!d.boss;
    this.x = x - this.w / 2; this.y = y - this.h;
    this.vx = 0; this.vy = 0; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.ai = [0, 0, 0, 0]; this.timer = 0; this.frame = 0; this.rot = 0;
    this.immune = {}; this.hitFlash = 0; this.onGround = false; this.dead = false; this.alpha = 1;
    this.chatCd = randInt(200, 900);
    this.buffs = {};
    if (G.world && G.world.flags.hardmode && !this.town && !this.friendly && !this.boss) { this.life = this.lifeMax = Math.round(this.lifeMax * 2); this.damage = Math.round(this.damage * 2); this.defense += 10; }
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  immuneTo(swingId) { return this.immune['s' + swingId] > 0 || this.def.dontTakeDamage; }
  hitBy(swingId, dmg, kb, dir, critChance, item) {
    this.immune['s' + swingId] = 60;
    const six = item && item.sixSeven && Math.random() < item.sixSeven;
    this.takeDamage(six ? 67 : dmg, kb, dir, critChance, six, item);
    if (item && item.onHit === 'fire') this.buffs.on_fire = 240;
    if (item && item.onHit === 'tung') { Synth.tung(0.5); combatText(this.cx, this.y - 10, 'TUNG!', '#e8c898', { life: 30 }); }
    if (item && item.onHit === 'liminal' && !this.boss && !Net.isClient && Math.random() < 0.25 && !this.dead) {
      spawnDust(this.cx, this.cy, '#ff00ff', 12, 2);
      const ox = this.x, oy = this.y;
      for (let k = 0; k < 20; k++) { const nx = this.x + randRange(-300, 300), ny = this.y + randRange(-200, 200); if (!rectHitsSolid(G.world, nx, ny, this.w, this.h)) { this.x = nx; this.y = ny; break; } }
      if (this.x !== ox || this.y !== oy) combatText(this.cx, this.y - 10, 'noclipped', '#ff66ff', { life: 45 });
    }
  }
  takeDamage(dmg, kb = 0, dir = 0, critChance = 4, fixed = false, item = null) {
    if (this.dead || this.def.dontTakeDamage) return 0;
    if (this.town && !G.allowTownDamage) { return 0; }
    let final, crit = false;
    if (fixed) final = Math.round(dmg);
    else {
      crit = Math.random() * 100 < critChance;
      final = Math.max(1, Math.round(dmg * randRange(0.85, 1.15) - this.defense * 0.5));
      if (crit) final *= 2;
    }
    // multiplayer client: the host owns npc health; show feedback locally and report the hit
    if (Net.isClient && this.netUid != null) {
      G.player.addAura(this.boss ? 0.25 : 0.6);
      Net.out({ t: 'hit', u: this.netUid, d: final, kb: kb * (crit ? 1.4 : 1), dir });
      this.hitFlash = 8;
      if (final === 67) G.sixSevenHit(this.cx, this.y);
      else combatText(this.cx, this.y, final, crit ? '#ff8a1a' : '#ffa23a', { big: crit });
      playSound(this.boss && this.def.hitSound ? this.def.hitSound : 'npc_hit', 0.6);
      spawnDust(this.cx, this.cy, this.def.blood || (this.type.includes('slime') ? '#6ecb5a' : '#b01010'), 4, 2);
      return final;
    }
    if (!G.suppress67 && G.player) G.player.addAura(this.boss ? 0.25 : 0.6);
    if (!G.suppress67 && typeof TerraJev !== 'undefined') { TerraJev.counters.dmgDealt += final; if (this.boss || (this.def && this.def.boss)) TerraJev.counters.bossDealt += final; }
    this.life -= final;
    this.hitFlash = 8;
    if (final === 67 && !G.suppress67) G.sixSevenHit(this.cx, this.y);
    else combatText(this.cx, this.y, final, crit ? '#ff8a1a' : '#ffa23a', { big: crit });
    playSound(this.boss && this.def.hitSound ? this.def.hitSound : 'npc_hit', 0.6);
    spawnDust(this.cx, this.cy, this.def.blood || (this.type.includes('slime') ? '#6ecb5a' : '#b01010'), 4, 2);
    if (kb && this.kbResist > 0) {
      const k = kb * this.kbResist * (crit ? 1.4 : 1);
      this.vx = dir * k * 0.9;
      if (!this.def.noGravity) this.vy = Math.min(this.vy, -k * 0.45);
      else this.vy -= k * 0.2;
    }
    if (this.life <= 0) this.die();
    else if (this.def.chatter && Math.random() < 0.25) this.say();
    return final;
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.life = 0;
    playSound(this.def.deathSound || 'npc_killed', 0.8);
    for (let i = 0; i < 18; i++) spawnDust(this.cx, this.cy, this.def.blood || (this.type.includes('slime') ? '#6ecb5a' : '#8a1010'), 1, 3, { life: 50 });
    if (this.town) { G.townNPCDied(this); return; }
    if (this.def.critter) { if (this.type === 'bunny') combatText(this.cx, this.y, '-1000 aura', '#ff5a5a', { big: true }); return; }
    if (this.def.pet) return;
    G.player.stats.kills++;
    // drops
    for (const [id, ch, a, b] of this.def.drops || []) {
      if (Math.random() < ch) G.dropItem(this.cx, this.cy, id, randInt(a, b));
    }
    if (this.def.value) {
      let v = Math.round(this.def.value * randRange(0.8, 1.2));
      if (this.stolen) v += this.stolen;
      for (const [id, n] of coinsFor(v)) G.dropItem(this.cx, this.cy, id, n);
      if (v >= 100 && Math.random() < 0.15) combatText(this.cx, this.y - 20, '+' + v + ' aura', '#ffd23a', { life: 50 });
    }
    // hearts / stars (Terraria: drop hearts if player is hurt)
    const p = G.player;
    if (!this.boss && p.life < p.lifeMax && Math.random() < 0.18) G.dropItem(this.cx, this.cy, 'heart', 1);
    if (!this.boss && p.mana < p.manaMax && Math.random() < 0.1 && p.heldItem()?.dmgType === 'magic') G.dropItem(this.cx, this.cy, 'mana_star', 1);
    if (this.def.splitInto) for (let i = 0; i < randInt(2, 3); i++) { const n = G.spawnNPC(this.def.splitInto, this.cx + randRange(-10, 10), this.y + this.h); n.vy = -4; n.vx = randRange(-3, 3); }
    if (this.def.leavesLava) { const tx = Math.floor(this.cx / TS), ty = Math.floor(this.cy / TS); const w = G.world; if (w.inb(tx, ty) && !w.solid(tx, ty)) { const i = w.idx(tx, ty); w.liquid[i] = 180; w.ltype[i] = 1; Liquid.wake(w, tx, ty); } }
    if (this.type === 'skibidi_toilet') G.achieve('slayer');
    if (this.boss || this.def.onDeath) (this.def.onDeath || (() => { }))(this);
  }
  say(line) {
    const pool = MEME.enemyChatter[this.def.chatter];
    if (!pool && !line) return;
    this.speech = line || pick(pool); this.speechT = 120;
  }

  update(world) {
    if (this.hitFlash > 0) this.hitFlash--;
    for (const k in this.immune) if (--this.immune[k] <= 0) delete this.immune[k];
    if (this.speechT > 0) this.speechT--;
    if (this.buffs.on_fire) { this.buffs.on_fire--; if (G.tick % 30 === 0) { this.takeDamage(4, 0, 0, 0, true); } if (G.tick % 3 === 0) spawnDust(this.cx + randRange(-8, 8), this.cy, '#ff7a1a', 1, 0.5, { up: 1, grav: -0.05 }); }
    const d = this.def;
    const p = G.player;                                   // local player: contact damage
    const target = d.pet ? p : G.nearestPlayer(this);      // AI chases the closest player
    const style = d.ai;
    const fn = NPC_AI[style];
    if (fn) fn(this, world, target);
    // chatter
    if (d.chatter && --this.chatCd <= 0) { this.chatCd = randInt(400, 1200); if (dist(this.cx, this.cy, target.cx, target.cy) < 500) { this.say(); if (d.chatter === 'skibidi') Synth.skibidi(0.25); if (d.sound) playSound(d.sound, 0.4); } }
    // lava damage
    if (this.lavaWet && !d.lavaImmune && G.tick % 30 === 0) this.takeDamage(50, 0, 0, 0, true);
    // contact damage
    if (!this.friendly && this.damage > 0 && !p.dead && this.alpha > 0.5) {
      if (rectsOverlap(this, p)) {
        const hit = p.hurt(this.damage, this.cx < p.cx ? 1 : -1, this, 'enemy');
        if (hit) {
          if (d.onHitFire && !p.calc.fx.fireBlockImmune) p.addBuff('on_fire', 180);
          if (d.thief) this.steal(p);
          if (this.boss && d.onPlayerHit) d.onPlayerHit(this, p);
        }
      }
    }
    // despawn when far away
    if (!this.town && !this.boss && !d.pet) {
      const far = Math.abs(this.cx - target.cx) > 2400 || Math.abs(this.cy - target.cy) > 1600;
      if (far) this.despawn = (this.despawn || 0) + 1; else this.despawn = 0;
      if (this.despawn > 120) this.dead = true, this.silentRemove = true;
    }
  }
  steal(p) {
    const money = invMoney(p.inv);
    if (money <= 0) return;
    const amt = Math.max(1, Math.floor(money * 0.1));
    invSpend(p.inv, amt);
    this.stolen = (this.stolen || 0) + amt;
    combatText(p.cx, p.y - 20, 'FANUM TAX! -' + formatAura(amt), '#ff5a5a', { big: true, life: 90 });
    this.say(pick(MEME.enemyChatter.fanum));
    G.achieve('fanum');
    playSound('coins', 0.6);
  }
  draw(ctx, camX, camY) {
    const d = this.def;
    if (d.drawCustom) { d.drawCustom(this, ctx, camX, camY); return; }
    let key = d.img;
    if (d.frames) key = d.frames[Math.floor(this.frame) % d.frames.length];
    const img = getImg(key);
    const sx = Math.round(this.cx - camX), sy = Math.round(this.y + this.h - camY);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(sx, sy - this.h / 2);
    if (d.rotate) ctx.rotate(this.rot + (d.rotOff || 0));
    let flip = this.dir < 0;
    if (d.rotate && Math.cos(this.rot) < 0) { ctx.scale(1, -1); flip = false; }
    // default sprite facing: most Terraria enemies face left in the wiki art
    const facesRight = d.facesRight || d.frames;
    if ((flip && facesRight) || (!flip && !facesRight && !d.rotate)) ctx.scale(-1, 1);
    let sq = 1, st = 1;
    if (d.ai === 'slime' || d.ai === 'skibidi') { const t = this.ai[1]; if (!this.onGround) { sq = 0.9; st = 1.12; } else if (t > 0 && t < 12) { sq = 1.15; st = 0.85; } }
    const dw = img.width * sq * (d.scale || 1), dh = img.height * st * (d.scale || 1);
    if (d.tintRGB) ctx.filter = d.tintRGB;
    ctx.drawImage(img, -dw / 2, this.h / 2 - dh + (d.yOff || 0), dw, dh);
    if (d.overlay) { const o = getImg(d.overlay); ctx.drawImage(o, -o.width / 2, this.h / 2 - dh * 0.65 - o.height / 2); }
    if (this.type === 'shark') { const sn = getImg('gen/sneakers'); for (let i = 0; i < 3; i++) ctx.drawImage(sn, -30 + i * 20, this.h / 2 - 4 + (this.onGround ? Math.sin(this.frame * 2 + i) * 2 : 0)); }
    ctx.filter = 'none';
    if (this.hitFlash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,60,60,0.45)'; ctx.fillRect(-dw / 2, this.h / 2 - dh, dw, dh); }
    ctx.restore();
    if (this.speechT > 0 && this.speech) drawSpeech(ctx, this.speech, sx, sy - this.h - 8);
    if (this.town && this.emote > 0) { this.emote--; const hi = getImg('gen/hands'); ctx.drawImage(hi, sx - hi.width / 2, sy - this.h - 26 + Math.sin(this.emote * 0.5) * 5); }
    // health bar (Terraria shows it under damaged enemies)
    if (!this.boss && !this.friendly && this.life < this.lifeMax) drawHealthBar(ctx, sx, sy + 6, this.life / this.lifeMax);
  }
}
function drawHealthBar(ctx, x, y, f) {
  const w = 30;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = f > 0.6 ? '#3ce03c' : f > 0.3 ? '#e0d03c' : '#e03c3c';
  ctx.fillRect(x - w / 2, y, w * f, 4);
}
function drawSpeech(ctx, text, x, y) {
  ctx.save();
  ctx.font = 'bold 13px ' + UI_FONT;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - 22, w, 20, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 8);
  ctx.restore();
}

// ================= AI styles =================
const NPC_AI = {
  slime(n, world, p) {
    const d = n.def;
    n.vy = Math.min(n.vy + 0.3, 10);
    if (n.onGround) {
      n.vx *= 0.8;
      n.ai[1]++;
      const wait = d.rare ? 40 : 60;
      if (n.ai[1] > wait + (n.ai[2] % 3 === 2 ? 20 : 0)) {
        n.ai[1] = 0; n.ai[2]++;
        const target = !p.dead && Math.abs(p.cx - n.cx) < 900 && (G.isNight() || n.type !== 'green_slime' || n.life < n.lifeMax || Math.abs(p.cx - n.cx) < 300);
        if (target) n.dir = p.cx < n.cx ? -1 : 1;
        const big = n.ai[2] % 3 === 2;
        n.vy = big ? -8 : -5.5;
        n.vx = n.dir * (big ? 3 : 2.2);
      }
    }
    moveEntity(n, world, { stepUp: false });
    if (n.collidedX) n.dir = -n.dir;
    if (n.wet && !d.lavaImmune) n.vy = Math.max(n.vy - 0.4, -3);
  },
  skibidi(n, world, p) {
    // hops aggressively toward the player like a slime, but faster, singing
    n.vy = Math.min(n.vy + 0.35, 10);
    n.frame += 0.15;
    if (n.onGround) {
      n.vx *= 0.7; n.ai[1]++;
      if (n.ai[1] > 25) {
        n.ai[1] = 0; n.dir = p.cx < n.cx ? -1 : 1;
        n.vy = randRange(-6.5, -4.5); n.vx = n.dir * randRange(2.5, 3.5);
      }
    }
    moveEntity(n, world, { stepUp: false });
  },
  fighter(n, world, p) {
    const d = n.def;
    const target = !p.dead;
    // zombies wander off during the day
    const flee = n.type === 'zombie' && !G.isNight() && n.cy < world.worldSurface * TS;
    if (target && !flee) n.dir = p.cx < n.cx ? -1 : 1;
    const spd = d.speed || 1;
    if (Math.abs(n.vx) < spd || sign(n.vx) !== n.dir) n.vx += n.dir * 0.07 * (d.spin ? 3 : 1);
    if (Math.abs(n.vx) > spd) n.vx = sign(n.vx) * spd;
    n.vy = Math.min(n.vy + 0.4, 10);
    if (n.onGround && n.collidedXLast) { n.vy = -6.5; n.ai[3]++; if (n.ai[3] > 5) { n.dir = -n.dir; n.vx = n.dir; n.ai[3] = 0; } }
    // jump over gaps / at player above
    if (n.onGround && target && p.y + p.h < n.y - 40 && Math.abs(p.cx - n.cx) < 80 && Math.random() < 0.02) n.vy = -7;
    moveEntity(n, world, { stepUp: true });
    n.collidedXLast = n.collidedX;
    if (!n.collidedX) n.ai[3] = Math.max(0, n.ai[3] - 0.02);
    n.frame += Math.abs(n.vx) * 0.1 + (d.spin ? 0.3 : 0);
    if (n.wet) n.vy = Math.max(n.vy - 0.25, -2);
  },
  flyer(n, world, p) {
    const d = n.def, spd = d.speed || 4;
    let tx = p.cx, ty = p.cy;
    const flee = !G.isNight() && (n.type === 'demon_eye') && n.cy < world.worldSurface * TS;
    if (flee || p.dead) { tx = n.cx + n.dir * 200; ty = n.cy - 300; }
    const dx = tx - n.cx, dy = ty - n.cy, dd = Math.hypot(dx, dy) || 1;
    const acc = n.type === 'servant' ? 0.12 : 0.07;
    n.vx += dx / dd * acc * spd / 4 * 1.5; n.vy += dy / dd * acc * spd / 4 * 1.5;
    const v = Math.hypot(n.vx, n.vy);
    if (v > spd) { n.vx *= spd / v; n.vy *= spd / v; }
    if (d.noTileCollide) { n.x += n.vx; n.y += n.vy; }
    else {
      moveEntity(n, world, { stepUp: false });
      if (n.collidedX) n.vx = -n.vx * 0.7 || (Math.random() - 0.5);
      if (n.collidedY) n.vy = -n.vy * 0.7 || (Math.random() - 0.5);
    }
    n.dir = n.vx < 0 ? -1 : 1;
    n.rot = Math.atan2(n.vy, n.vx) + Math.PI;
    if (n.wet) n.vy -= 0.1;
  },
  bat(n, world, p) {
    const spd = n.def.speed || 3.5;
    n.ai[0]++;
    if (n.ai[0] % 20 === 0) { n.ai[1] = randRange(-1, 1); n.ai[2] = randRange(-1, 1); }
    const dx = p.cx - n.cx, dy = p.cy - n.cy, dd = Math.hypot(dx, dy) || 1;
    n.vx += dx / dd * 0.12 + n.ai[1] * 0.15; n.vy += dy / dd * 0.12 + n.ai[2] * 0.15;
    const v = Math.hypot(n.vx, n.vy); if (v > spd) { n.vx *= spd / v; n.vy *= spd / v; }
    moveEntity(n, world, { stepUp: false });
    if (n.collidedX) n.vx = -n.vx; if (n.collidedY) n.vy = -n.vy;
    n.dir = n.vx < 0 ? -1 : 1;
  },
  caster(n, world, p) {
    // stands still, teleports near the player, lobs fireballs
    n.vy = Math.min(n.vy + 0.3, 8); n.vx *= 0.9;
    moveEntity(n, world);
    n.dir = p.cx < n.cx ? -1 : 1;
    n.ai[0]++;
    if (n.ai[0] % 100 === 60 && !p.dead && lineOfSight(world, n.cx, n.cy, p.cx, p.cy)) {
      const a = Math.atan2(p.cy - n.cy, p.cx - n.cx);
      G.spawnProjectile('fireball', n.cx, n.cy, Math.cos(a) * 5, Math.sin(a) * 5, 20, 0, n, { hostile: true });
      playSound('fire', 0.4);
    }
    if (n.ai[0] > 400) {
      n.ai[0] = 0;
      for (let k = 0; k < 40; k++) {
        const tx = Math.floor(p.cx / TS) + randInt(-15, 15), ty = Math.floor(p.cy / TS) + randInt(-10, 10);
        if (!world.solid(tx, ty) && !world.solid(tx, ty - 1) && !world.solid(tx, ty - 2) && world.solid(tx, ty + 1) && Math.abs(tx * TS - p.cx) > 80) {
          spawnDust(n.cx, n.cy, '#ff7a1a', 12, 2);
          n.x = tx * TS + 8 - n.w / 2; n.y = (ty + 1) * TS - n.h; n.vx = 0; n.vy = 0;
          spawnDust(n.cx, n.cy, '#ff7a1a', 12, 2);
          break;
        }
      }
    }
  },
  demon(n, world, p) {
    n.ai[0]++;
    const tx = p.cx + Math.cos(n.ai[0] / 60) * 150, ty = p.cy - 120 + Math.sin(n.ai[0] / 40) * 40;
    n.vx += clamp((tx - n.cx) * 0.002, -0.12, 0.12); n.vy += clamp((ty - n.cy) * 0.002, -0.12, 0.12);
    n.vx *= 0.98; n.vy *= 0.98;
    n.x += n.vx; n.y += n.vy;
    n.dir = p.cx < n.cx ? -1 : 1;
    if (n.ai[0] % 180 === 0 && !p.dead) {
      for (let k = -1; k <= 1; k++) {
        const a = Math.atan2(p.cy - n.cy, p.cx - n.cx) + k * 0.25;
        G.spawnProjectile('scythe', n.cx, n.cy, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 30, 0, n, { hostile: true });
      }
      playSound('magic', 0.4);
    }
  },
  harpy(n, world, p) {
    NPC_AI.flyer(n, world, p);
    n.rot = 0;
    n.ai[0]++;
    if (n.ai[0] % 120 === 0 && !p.dead) {
      const a = Math.atan2(p.cy - n.cy, p.cx - n.cx);
      G.spawnProjectile('feather', n.cx, n.cy, Math.cos(a) * 7, Math.sin(a) * 7, 20, 0, n, { hostile: true });
    }
  },
  tralalero(n, world, p) {
    n.frame += 0.2;
    if (n.wet) {
      const dx = p.cx - n.cx, dy = p.cy - n.cy, dd = Math.hypot(dx, dy) || 1;
      if (p.wet) { n.vx += dx / dd * 0.2; n.vy += dy / dd * 0.2; }
      else { n.vx += n.dir * 0.1; n.vy += Math.sin(n.frame * 0.3) * 0.05; }
      const v = Math.hypot(n.vx, n.vy); if (v > 5) { n.vx *= 5 / v; n.vy *= 5 / v; }
      moveEntity(n, world, { stepUp: false });
      if (n.collidedX) { n.dir = -n.dir; n.vx = -n.vx; }
      // don't leave water upwards
      const tx = Math.floor(n.cx / TS), ty = Math.floor(n.y / TS);
      if (world.liq(tx, ty) < 30 && n.vy < 0) n.vy += 0.5;
    } else {
      // running on land in its Nike sneakers
      n.dir = p.cx < n.cx ? -1 : 1;
      n.vx = clamp(n.vx + n.dir * 0.12, -3.5, 3.5);
      n.vy = Math.min(n.vy + 0.4, 10);
      moveEntity(n, world, { stepUp: true });
      if (n.onGround && n.collidedX) n.vy = -7;
      if (n.onGround && Math.random() < 0.01) n.vy = -6;
    }
    if (Math.abs(n.vx) > 0.05) n.dir = sign(n.vx);
  },
  antlion(n, world, p) {
    n.vy = Math.min(n.vy + 0.4, 8); n.vx = 0;
    moveEntity(n, world);
    n.ai[0]++;
    n.dir = p.cx < n.cx ? -1 : 1;
    if (n.ai[0] % 90 === 0 && !p.dead && Math.abs(p.cx - n.cx) < 500) {
      const dx = p.cx - n.cx;
      G.spawnProjectile('sand_ball', n.cx, n.y, dx / 60, -8, 14, 0, n, { hostile: true, gravity: 0.25 });
    }
  },
  bombardiro(n, world, p) {
    n.frame += 0.5;
    if (!n.ai[1]) { n.ai[1] = p.cx < n.cx ? -1 : 1; }
    const altitude = p.cy - 260;
    n.vx = lerp(n.vx, n.ai[1] * 3.2, 0.05);
    n.vy = lerp(n.vy, (altitude - n.cy) * 0.02, 0.1);
    n.x += n.vx; n.y += n.vy;
    n.dir = sign(n.vx) || 1;
    if (Math.abs(n.cx - p.cx) > 900) { n.ai[1] = -n.ai[1] * (n.cx < p.cx ? -1 : 1) * (n.ai[1] > 0 ? 1 : 1); n.ai[1] = n.cx < p.cx ? 1 : -1; }
    n.ai[0]++;
    if (Math.abs(n.cx - p.cx) < 200 && n.ai[0] % 35 === 0) {
      G.spawnProjectile('croc_bomb', n.cx, n.y + n.h, n.vx * 0.5, 1, 30, 0, n, { hostile: true, gravity: 0.2 });
      if (Math.random() < 0.3) n.say();
    }
  },
  hungry(n, world, p) {
    const wall = G.npcs.find(b => b.type === 'wall_of_flesh');
    if (!wall) { n.die(); return; }
    const ax = wall.cx + wall.def.faceDir(wall) * 40, ay = wall.cy + n.ai[1];
    n.ai[0]++;
    const reach = 90 + Math.sin(n.ai[0] / 20 + n.uid) * 30;
    const dx = p.cx - ax, dy = p.cy - ay, dd = Math.hypot(dx, dy) || 1;
    const txp = ax + dx / dd * Math.min(reach, dd), typ = ay + dy / dd * Math.min(reach, dd);
    n.x += (txp - n.cx) * 0.08; n.y += (typ - n.cy) * 0.08;
    n.rot = Math.atan2(n.cy - ay, n.cx - ax) + Math.PI;
    n.anchor = [ax, ay];
  },
  // Smilers drift toward you in the dark and back off from bright light
  smiler(n, world, p) {
    n.frame += 0.05;
    const lit = Light.at(Math.floor(n.cx / TS), Math.floor(n.cy / TS));
    const dx = p.cx - n.cx, dy = p.cy - n.cy, dd = Math.hypot(dx, dy) || 1;
    const spd = lit > 0.55 ? -1.2 : (n.def.speed || 2.2) * (dd > 300 ? 1.6 : 1);
    n.vx = lerp(n.vx, dx / dd * spd, 0.05); n.vy = lerp(n.vy, dy / dd * spd, 0.05);
    n.x += n.vx; n.y += n.vy;
    n.alpha = lit > 0.55 ? 0.35 : 1;
    n.dir = dx < 0 ? -1 : 1;
    if (Math.random() < 0.002) n.say(pick([':)', '...', 'why are you in the light', 'come here :)']));
  },
  critter(n, world, p) {
    n.vy = Math.min(n.vy + 0.3, 8);
    n.ai[0]--;
    if (n.ai[0] <= 0) { n.ai[0] = randInt(60, 200); n.ai[1] = Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
    if (dist(n.cx, n.cy, p.cx, p.cy) < 100) n.ai[1] = n.cx < p.cx ? -1 : 1;
    n.vx = n.ai[1] * (n.type === 'bird' ? 2 : 1.5);
    if (n.ai[1]) n.dir = n.ai[1];
    if (n.type === 'bird' && n.ai[1] && !n.onGround) n.vy = Math.max(n.vy - 0.5, -2);
    if (n.onGround && n.ai[1] && (n.collidedX || Math.random() < 0.02)) n.vy = -4;
    moveEntity(n, world);
  },
  pet(n, world, p) {
    n.frame += Math.abs(n.vx) * 0.12;
    const dx = p.cx - p.dir * 30 - n.cx, dy = p.y + p.h - (n.y + n.h);
    if (Math.abs(dx) > 600 || Math.abs(dy) > 400) { n.x = p.cx - n.w / 2; n.y = p.y + p.h - n.h; n.vx = 0; n.vy = 0; }
    if (Math.abs(dx) > 20) n.vx = clamp(n.vx + sign(dx) * 0.3, -6, 6); else n.vx *= 0.8;
    n.vy = Math.min(n.vy + 0.4, 10);
    moveEntity(n, world);
    if (n.onGround && (n.collidedX || dy < -40)) n.vy = -7.5;
    if (Math.abs(n.vx) > 0.2) n.dir = sign(n.vx);
    if (Math.random() < 0.002) { n.speech = pick(['labubu!', 'secret pull fr', 'ヽ(•‿•)ノ', 'teehee']); n.speechT = 90; }
  },
  town(n, world, p) {
    // wander around home, open doors, face the player when close
    n.vy = Math.min(n.vy + 0.4, 10);
    const home = n.home;
    n.ai[0]--;
    if (n.talking) { n.vx = 0; n.dir = p.cx < n.cx ? -1 : 1; }
    else if (n.ai[0] <= 0) {
      n.ai[0] = randInt(100, 400);
      n.ai[1] = Math.random() < 0.45 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      if (home && (!G.isDay() || Math.abs(n.cx / TS - home[0]) > 12)) n.ai[1] = sign(home[0] * TS + 8 - n.cx);
      if (home && !G.isDay() && Math.abs(n.cx / TS - home[0]) < 2) n.ai[1] = 0;
    }
    if (!n.talking) {
      n.vx = n.ai[1] * 0.9;
      if (n.ai[1]) n.dir = n.ai[1];
    }
    // doors
    const ahead = Math.floor((n.cx + n.dir * (n.w / 2 + 4)) / TS), ty = Math.floor((n.y + n.h - 8) / TS);
    if (n.ai[1] && world.tile(ahead, ty) === T.DOOR_CLOSED) { world.toggleDoor(ahead, ty); n.openedDoor = [ahead, ty, 60]; }
    if (n.openedDoor) { n.openedDoor[2]--; if (n.openedDoor[2] <= 0) { const [dx, dy] = n.openedDoor; if (world.tile(dx, dy) === T.DOOR_OPEN && !rectsOverlap({ x: dx * TS, y: (dy - 2) * TS, w: TS, h: 3 * TS }, n)) world.toggleDoor(dx, dy); n.openedDoor = null; } }
    moveEntity(n, world);
    if (n.collidedX && n.onGround) { if (Math.random() < 0.5) n.vy = -5.5; else { n.ai[1] = -n.ai[1]; } }
    n.frame += Math.abs(n.vx) * 0.1;
    if (n.lavaWet) n.takeDamage(20);
  },
};
