// ---------- projectiles ----------
// kind: 'arrow' (rotates w/ velocity, gravity after a delay), 'boomerang', 'thrown', 'explosive', 'magic', 'custom'
const PROJ = {
  arrow: { img: 'items/Wooden_Arrow', w: 10, h: 10, kind: 'arrow', rotOff: Math.PI / 2 },
  flaming_arrow: { img: 'items/Flaming_Arrow', w: 10, h: 10, kind: 'arrow', rotOff: Math.PI / 2, fire: true, light: [0.9, 0.6, 0.3] },
  unholy_arrow: { img: 'items/Unholy_Arrow', w: 10, h: 10, kind: 'arrow', rotOff: Math.PI / 2, pierce: 3, light: [0.5, 0.2, 0.6] },
  hellfire_arrow: { img: 'items/Hellfire_Arrow', w: 10, h: 10, kind: 'arrow', rotOff: Math.PI / 2, explode: 2, fire: true, light: [1, 0.5, 0.2] },
  bullet: { w: 6, h: 6, kind: 'bullet', color: '#ffe27a', light: [0.4, 0.35, 0.1] },
  boomerang: { img: 'items/Enchanted_Boomerang', w: 20, h: 20, kind: 'boomerang', range: 32, light: [0.3, 0.3, 0.6] },
  wooden_boomerang: { img: 'items/Wooden_Boomerang', w: 18, h: 18, kind: 'boomerang', range: 22 },
  plunger: { img: 'gen/item_plunger', w: 20, h: 20, kind: 'boomerang', range: 26 },
  flail: { img: "items/Ball_O'_Hurt", w: 22, h: 22, kind: 'boomerang', range: 20, chain: true },
  shuriken: { img: 'items/Shuriken', w: 14, h: 14, kind: 'thrown', spin: 0.4, grav: 0.2, gravDelay: 15, drop: 'shuriken', dropChance: 0.5 },
  throwing_knife: { img: 'items/Throwing_Knife', w: 12, h: 12, kind: 'thrown', rotVel: true, rotOff: Math.PI / 4, grav: 0.2, gravDelay: 15, drop: 'throwing_knife', dropChance: 0.5 },
  bomb: { img: 'items/Bomb', w: 16, h: 16, kind: 'explosive', fuse: 180, radius: 4, destroy: true, damage: 100, bounce: 0.5 },
  grenade: { img: 'items/Grenade', w: 14, h: 14, kind: 'explosive', fuse: 180, radius: 3, destroy: false, bounce: 0.6 },
  dynamite: { img: 'items/Dynamite', w: 14, h: 14, kind: 'explosive', fuse: 300, radius: 8, destroy: true, damage: 200, bounce: 0.3 },
  starfury_star: { img: 'items/Fallen_Star', w: 18, h: 18, kind: 'magic', spin: 0.3, pierce: 2, passTiles: true, life: 120, light: [0.9, 0.9, 0.4], trail: '#fff27a' },
  spark: { w: 6, h: 6, kind: 'magic', color: '#ffb84a', grav: 0.08, life: 40, fire: true, light: [0.9, 0.6, 0.2], trail: '#ffb84a' },
  vilethorn: { w: 10, h: 10, kind: 'magic', color: '#9a5ac8', life: 18, pierce: 5, light: [0.4, 0.1, 0.5], trail: '#8a4ab8' },
  water_bolt: { w: 12, h: 12, kind: 'magic', color: '#4a9aff', life: 400, bounces: 5, pierce: 4, light: [0.2, 0.4, 0.9], trail: '#6ab4ff' },
  magic_missile: { w: 12, h: 12, kind: 'magic', color: '#6ae0ff', life: 300, cursor: true, light: [0.3, 0.6, 1], trail: '#9aeeff' },
  flamelash: { w: 14, h: 14, kind: 'magic', color: '#ff7a1a', life: 300, cursor: true, fire: true, light: [1, 0.5, 0.15], trail: '#ffb84a' },
  demon_scythe: { img: 'gen/scythe', w: 30, h: 30, kind: 'magic', spin: 0.5, accel: 1.08, maxSpeed: 16, life: 120, pierce: 6, passTiles: true, light: [0.6, 0.2, 0.9] },
  sixseven: { w: 20, h: 26, kind: 'magic', spin: 0.25, life: 90, pierce: 3, home: true, light: [1, 0.85, 0.2], trail: '#ffd23a' },
  // hostile
  fireball: { w: 14, h: 14, kind: 'magic', color: '#ff6a1a', life: 200, light: [1, 0.5, 0.1], trail: '#ff9a3a', fire: true },
  scythe: { img: 'gen/scythe', w: 26, h: 26, kind: 'magic', spin: 0.5, accel: 1.05, maxSpeed: 9, life: 200, passTiles: true, light: [0.5, 0.2, 0.8] },
  feather: { w: 8, h: 8, kind: 'magic', color: '#7aa8ff', life: 160 },
  sand_ball: { img: 'items/Sand_Block', w: 12, h: 12, kind: 'thrown', grav: 0.25, gravDelay: 0 },
  croc_bomb: { img: 'items/Bomb', w: 14, h: 14, kind: 'explosive', fuse: 999, radius: 3, destroy: false, explodeOnContact: true, damage: 30 },
  eye_laser: { w: 16, h: 4, kind: 'magic', color: '#ff3a3a', life: 200, passTiles: true, light: [0.8, 0.1, 0.1], stretch: true },
  tung_wave: { w: 26, h: 26, kind: 'custom', life: 70, passTiles: true, color: '#c99a62' },
  tung_log: { img: 'gen/item_kentongan', w: 18, h: 18, kind: 'thrown', spin: 0.3, grav: 0.3, gravDelay: 0 },
};

class Projectile {
  constructor(type, x, y, vx, vy, damage, kb, owner, opts = {}) {
    const d = PROJ[type];
    this.type = type; this.d = d;
    this.w = d.w; this.h = d.h;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = vx; this.vy = vy; this.damage = damage; this.kb = kb; this.owner = owner;
    this.hostile = !!opts.hostile;
    this.pierce = d.pierce || 1;
    this.life = d.life || 600; this.age = 0;
    this.rot = Math.atan2(vy, vx); this.hit = {};
    this.opts = opts;
    this.bounces = d.bounces || 0;
    this.fuse = d.fuse || 0;
    this.returning = false;
    this.glyph = opts.glyph;
    this.grav = opts.gravity != null ? opts.gravity : d.grav || 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(world) {
    const d = this.d;
    this.age++;
    if (--this.life <= 0) { this.kill(world); return; }
    if (d.trail && this.age % 2 === 0) spawnDust(this.cx, this.cy, d.trail, 1, 0.3, { grav: 0, life: 15, size: 3 });
    if (d.light) G.addGlow(this.cx, this.cy, d.light);
    switch (d.kind) {
      case 'arrow':
        if (this.age > 15) this.vy = Math.min(this.vy + 0.1, 12);
        this.rot = Math.atan2(this.vy, this.vx);
        this.moveTile(world, false);
        break;
      case 'bullet': this.rot = Math.atan2(this.vy, this.vx); this.moveTile(world, false); break;
      case 'thrown':
        if (this.age > (d.gravDelay || 0)) this.vy = Math.min(this.vy + this.grav, 12);
        if (d.spin) this.rot += d.spin * sign(this.vx || 1); else this.rot = Math.atan2(this.vy, this.vx);
        this.moveTile(world, false);
        break;
      case 'boomerang': {
        this.rot += 0.4;
        const o = this.owner;
        if (!this.returning && this.age > d.range) this.returning = true;
        if (this.returning) {
          const dx = o.cx - this.cx, dy = o.cy - this.cy, dd = Math.hypot(dx, dy) || 1;
          this.vx = lerp(this.vx, dx / dd * 12, 0.15); this.vy = lerp(this.vy, dy / dd * 12, 0.15);
          this.x += this.vx; this.y += this.vy;
          if (dd < 24) { this.dead = true; return; }
        } else {
          this.x += this.vx; this.y += this.vy;
          if (rectHitsSolid(world, this.x, this.y, this.w, this.h)) { this.returning = true; playSound('dig', 0.4); }
        }
        break;
      }
      case 'explosive': {
        this.vy = Math.min(this.vy + (this.grav || 0.2), 12);
        this.rot += this.vx * 0.05;
        const ovx = this.vx, ovy = this.vy;
        moveEntity(this, world, { stepUp: false });
        if (this.collidedX) this.vx = -ovx * (d.bounce || 0.4);
        if (this.collidedY) { this.vy = -ovy * (d.bounce || 0.4); this.vx *= 0.8; if (Math.abs(this.vy) < 1) this.vy = 0; }
        if (d.explodeOnContact && (this.collidedX || this.collidedY)) { this.explode(world); return; }
        if (--this.fuse <= 0) { this.explode(world); return; }
        if (this.age % 3 === 0) spawnDust(this.cx, this.y, '#ffcf4a', 1, 0.5, { up: 1, life: 10 });
        break;
      }
      case 'magic': {
        if (d.accel) { const v = Math.hypot(this.vx, this.vy); if (v < d.maxSpeed) { this.vx *= d.accel; this.vy *= d.accel; } }
        if (d.spin) this.rot += d.spin; else this.rot = Math.atan2(this.vy, this.vx);
        if (d.cursor && this.owner === G.player && Input.mDown) {
          const mx = G.mouseWorldX(), my = G.mouseWorldY();
          const dx = mx - this.cx, dy = my - this.cy, dd = Math.hypot(dx, dy) || 1;
          const sp = 8;
          this.vx = lerp(this.vx, dx / dd * sp, 0.12); this.vy = lerp(this.vy, dy / dd * sp, 0.12);
        }
        if (d.home) {
          let best = null, bd = 400;
          for (const n of G.npcs) { if (n.friendly || n.dead) continue; const dd = dist(n.cx, n.cy, this.cx, this.cy); if (dd < bd) { bd = dd; best = n; } }
          if (best) { const a = Math.atan2(best.cy - this.cy, best.cx - this.cx), sp = Math.hypot(this.vx, this.vy); this.vx = lerp(this.vx, Math.cos(a) * sp, 0.08); this.vy = lerp(this.vy, Math.sin(a) * sp, 0.08); }
        }
        if (this.grav) this.vy += this.grav;
        if (d.passTiles) { this.x += this.vx; this.y += this.vy; if (this.type === 'starfury_star' && this.cy > this.opts.targetY && rectHitsSolid(world, this.x, this.y, this.w, this.h)) this.kill(world); }
        else this.moveTile(world, !!this.bounces);
        break;
      }
      case 'custom':
        if (this.type === 'tung_wave') {
          this.x += this.vx;
          // hug the ground
          const tx = Math.floor(this.cx / TS);
          let ty = Math.floor((this.y + this.h) / TS);
          if (world.solid(tx, ty - 1)) { this.kill(world); return; }
          if (!world.solid(tx, ty)) this.y += 4;
          if (this.age % 2 === 0) spawnDust(this.cx, this.y + this.h, '#c99a62', 2, 1.5, { up: 2 });
        }
        break;
    }
    // hit detection
    if (this.hostile) {
      const p = G.player;
      if (!p.dead && rectsOverlap(this, p)) {
        if (this.d.kind === 'explosive') { this.explode(world); return; }
        if (p.hurt(this.damage, this.vx > 0 ? 1 : -1, this.owner, 'enemy')) {
          if (this.d.fire) p.addBuff('on_fire', 180);
          if (!this.d.passTiles || this.type === 'eye_laser' || this.type === 'tung_wave') this.dead = this.type !== 'tung_wave';
        }
      }
    } else if (this.damage > 0 && !this.visualOnly) {
      for (const n of G.npcs) {
        if (n.friendly || n.dead || this.hit[n.uid] > 0) continue;
        if (rectsOverlap(this, n)) {
          this.hit[n.uid] = 20;
          const dmg = this.type === 'sixseven' ? 67 : this.damage;
          n.takeDamage(dmg, this.kb, this.vx > 0 ? 1 : -1, this.owner.calc ? this.owner.calc.crit : 4, this.type === 'sixseven');
          if (this.d.fire) n.buffs.on_fire = 240;
          if (this.d.explode) { this.explode(world); return; }
          if (this.d.kind === 'boomerang') { this.returning = true; continue; }
          if (--this.pierce <= 0) { this.kill(world, true); return; }
        }
      }
      for (const k in this.hit) if (--this.hit[k] < 0) delete this.hit[k];
    }
  }
  moveTile(world, bounce) {
    const nx = this.x + this.vx, ny = this.y + this.vy;
    // sub-step for fast projectiles
    const steps = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) / 6));
    for (let s = 1; s <= steps; s++) {
      const px = lerp(this.x, nx, s / steps), py = lerp(this.y, ny, s / steps);
      if (rectHitsSolid(world, px, py, this.w, this.h)) {
        if (bounce && this.bounces > 0) {
          this.bounces--;
          if (rectHitsSolid(world, px, this.y, this.w, this.h)) this.vx = -this.vx;
          if (rectHitsSolid(world, this.x, py, this.w, this.h)) this.vy = -this.vy;
          playSound('item10', 0.3);
          return;
        }
        this.x = lerp(this.x, nx, (s - 1) / steps); this.y = lerp(this.y, ny, (s - 1) / steps);
        this.kill(world);
        return;
      }
    }
    this.x = nx; this.y = ny;
    // cut plants
    const t = TILES[world.tile(Math.floor(this.cx / TS), Math.floor(this.cy / TS))];
    if (t && t.cut && !this.hostile) world.breakTile(Math.floor(this.cx / TS), Math.floor(this.cy / TS), false);
  }
  kill(world, hitEnemy) {
    if (this.dead) return;
    this.dead = true;
    const d = this.d;
    if (d.explode) { this.explode(world); return; }
    if (d.kind === 'explosive') { this.explode(world); return; }
    if (!this.visualOnly && d.drop && !hitEnemy && Math.random() < d.dropChance) G.dropItem(this.cx, this.cy, d.drop, 1);
    if (!this.visualOnly && this.type === 'arrow' && !hitEnemy && Math.random() < 0.5) G.dropItem(this.cx, this.cy, 'wooden_arrow', 1);
    spawnDust(this.cx, this.cy, d.color || d.trail || '#bbbbbb', 4, 1.5);
    if (d.kind === 'arrow' || d.kind === 'bullet' || d.kind === 'thrown') playSound('dig', 0.3);
  }
  explode(world) {
    this.dead = true;
    const d = this.d;
    const r = d.radius || 2;
    explosion(world, this.cx, this.cy, r, d.damage || this.damage || 60, !!d.destroy, this.hostile, this.owner, this.visualOnly);
  }
  draw(ctx, camX, camY) {
    const d = this.d;
    const x = Math.round(this.cx - camX), y = Math.round(this.cy - camY);
    if (this.type === 'sixseven') {
      const img = getImg(this.glyph === 7 ? 'gen/proj_7' : 'gen/proj_6');
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(this.rot) * 0.4); ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
      return;
    }
    if (d.img) {
      const img = getImg(d.img);
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.rot + (d.rotOff || 0));
      const s = d.kind === 'thrown' || d.kind === 'explosive' || d.kind === 'boomerang' ? Math.min(1, 22 / Math.max(img.width, img.height)) : 1;
      ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
      ctx.restore();
      if (d.chain && this.owner) { ctx.strokeStyle = '#6b4a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.owner.cx - camX, this.owner.cy - camY); ctx.lineTo(x, y); ctx.stroke(); }
      return;
    }
    if (d.stretch) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.rot);
      ctx.fillStyle = d.color; ctx.fillRect(-12, -2, 24, 4); ctx.fillStyle = '#ffd0d0'; ctx.fillRect(-10, -1, 20, 2);
      ctx.restore(); return;
    }
    if (this.type === 'tung_wave') {
      ctx.fillStyle = '#c99a62'; ctx.fillRect(x - 10, y - 12 + Math.sin(this.age) * 3, 20, 24);
      ctx.fillStyle = '#e8c898'; ctx.fillRect(x - 6, y - 16 + Math.sin(this.age) * 3, 12, 6);
      return;
    }
    ctx.fillStyle = d.color || '#fff';
    ctx.beginPath(); ctx.arc(x, y, this.w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(x, y, this.w / 5, 0, Math.PI * 2); ctx.fill();
  }
}

function explosion(world, x, y, radius, damage, destroy, hostile, owner, visualOnly) {
  playSound('explode', 1);
  G.shake = Math.max(G.shake || 0, radius * 3);
  for (let i = 0; i < radius * 12; i++) spawnDust(x, y, pick(['#ffcf4a', '#ff7a1a', '#555555', '#888888']), 1, radius * 1.2, { life: randInt(20, 50), size: randInt(3, 6), grav: 0.02 });
  G.addGlow(x, y, [1, 0.7, 0.3], 30);
  if (visualOnly) return; // another player's explosive: they handle damage + tile destruction
  const R = radius * TS;
  // damage entities
  const p = G.player;
  if (!p.dead && dist(x, y, p.cx, p.cy) < R + 10) p.hurt(hostile ? damage : Math.round(damage * 0.5), p.cx < x ? -1 : 1, owner, 'enemy');
  if (!hostile) for (const n of G.npcs) if (!n.friendly && !n.dead && dist(x, y, n.cx, n.cy) < R + n.w / 2) n.takeDamage(damage, 8, n.cx < x ? -1 : 1, 4);
  if (destroy) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    for (let j = -radius; j <= radius; j++) for (let i = -radius; i <= radius; i++) {
      if (i * i + j * j > radius * radius) continue;
      const xx = tx + i, yy = ty + j;
      const t = TILES[world.tile(xx, yy)];
      if (!t || !world.tile(xx, yy)) { if (world.wall(xx, yy) && WALLS[world.wall(xx, yy)] && !WALLS[world.wall(xx, yy)].natural && Math.random() < 0.3) { } continue; }
      if (t.unbreakable || t.chest || (t.minPick > 65) || t.id === T.ALTAR) continue;
      if (t.id === T.EBONSTONE || t.id === T.HELLSTONE || t.id === T.DEMONITE || t.id === T.OBSIDIAN) { if (!G.world.flags.eye_of_cthulhu) continue; }
      world.breakTile(xx, yy, false);
    }
  }
}
