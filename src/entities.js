// ---------- dropped items, dust particles, floating combat text, inventory helpers ----------

// ===== inventory helpers (an inventory is an array of {id,count}|null) =====
function maxStack(id) { return ITEMS[id] ? ITEMS[id].stack : 1; }
function invAdd(inv, id, count, from = 0, to = inv.length) {
  // merge into existing stacks first, then empty slots. returns leftover
  const ms = maxStack(id);
  for (let i = from; i < to && count > 0; i++) {
    const s = inv[i];
    if (s && s.id === id && s.count < ms) { const n = Math.min(count, ms - s.count); s.count += n; count -= n; }
  }
  for (let i = from; i < to && count > 0; i++) {
    if (!inv[i]) { const n = Math.min(count, ms); inv[i] = { id, count: n }; count -= n; }
  }
  return count;
}
function invCount(inv, id) { let n = 0; for (const s of inv) if (s && s.id === id) n += s.count; return n; }
function invRemove(inv, id, count) {
  for (let i = inv.length - 1; i >= 0 && count > 0; i--) {
    const s = inv[i];
    if (s && s.id === id) { const n = Math.min(count, s.count); s.count -= n; count -= n; if (!s.count) inv[i] = null; }
  }
  return count === 0;
}
const COINS = ['copper_coin', 'silver_coin', 'gold_coin', 'platinum_coin'];
const COIN_VAL = [1, 100, 10000, 1000000];
function invMoney(inv) { let n = 0; for (const s of inv) if (s && ITEMS[s.id]?.coin) n += ITEMS[s.id].coin * s.count; return n; }
// convert a copper amount into coin stacks
function coinsFor(amount) {
  const out = [];
  for (let i = 3; i >= 0; i--) { const n = Math.floor(amount / COIN_VAL[i]); if (n > 0) { out.push([COINS[i], n]); amount -= n * COIN_VAL[i]; } }
  return out;
}
function invAddMoney(inv, amount) {
  // pull all coins out, add, and re-insert compactly (Terraria auto-combines 100 coins)
  let total = invMoney(inv) + amount;
  for (let i = 0; i < inv.length; i++) if (inv[i] && ITEMS[inv[i].id]?.coin) inv[i] = null;
  let left = 0;
  for (const [id, n] of coinsFor(total)) left += invAdd(inv, id, n) * ITEMS[id].coin;
  return left;
}
function invSpend(inv, amount) {
  const have = invMoney(inv);
  if (have < amount) return false;
  for (let i = 0; i < inv.length; i++) if (inv[i] && ITEMS[inv[i].id]?.coin) inv[i] = null;
  for (const [id, n] of coinsFor(have - amount)) invAdd(inv, id, n);
  return true;
}

// ===== dropped items =====
class ItemDrop {
  constructor(x, y, id, count) {
    const img = getImg(ITEMS[id]?.img || 'gen/missing');
    this.w = Math.min(24, img.width); this.h = Math.min(24, img.height);
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.id = id; this.count = count;
    this.vx = randRange(-2, 2); this.vy = randRange(-3, -1);
    this.noGrab = 25; this.life = 60 * 60 * 5; this.onGround = false;
    this.fallenStar = false;
  }
  update(world, player) {
    this.life--;
    if (this.noGrab > 0) this.noGrab--;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const d = dist(cx, cy, px, py);
    const grab = player.dead ? 0 : (ITEMS[this.id]?.coin ? 5 * TS : 42 + 32);
    if (this.noGrab <= 0 && d < grab && player.canHold(this.id, this.count) && !(this.pendingPick && G.tick - this.pendingPick < 60)) {
      // magnet
      const s = 6;
      this.vx = lerp(this.vx, (px - cx) / d * s, 0.25);
      this.vy = lerp(this.vy, (py - cy) / d * s, 0.25);
      this.x += this.vx; this.y += this.vy;
      if (d < 20) { if (Net.isClient) Net.requestPickup(this); else player.pickup(this); return; }
      return;
    }
    if (this.fallenStar && !this.onGround) {
      this.vy = Math.min(this.vy + 0.2, 12);
      if (Math.random() < 0.6) spawnDust(cx, cy, '#fff27a', 1, 1);
    } else {
      this.vy = Math.min(this.vy + 0.1, 7);
    }
    this.vx *= this.onGround ? 0.85 : 0.98;
    moveEntity(this, world, { stepUp: false });
    if (this.wet) { this.vy *= 0.9; this.vx *= 0.9; }
    if (this.lavaWet && !['obsidian', 'hellstone', 'hellstone_bar'].includes(this.id)) {
      if (this.id === 'guide_voodoo_doll' && !Net.isClient) G.voodooInLava(this);
      this.life = 0; spawnDust(cx, cy, '#ff7a1a', 6, 2);
    }
  }
  draw(ctx, camX, camY) {
    const img = getImg(ITEMS[this.id]?.img);
    const bob = this.fallenStar ? Math.sin(G.tick * 0.2) * 2 : 0;
    const sc = Math.min(1, 24 / Math.max(img.width, img.height));
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, Math.round(this.x + this.w / 2 - dw / 2 - camX), Math.round(this.y + this.h - dh - camY + bob), dw, dh);
    if (ITEMS[this.id]?.rare >= 2 || this.fallenStar) G.addGlow(this.x + this.w / 2, this.y + this.h / 2, this.fallenStar ? [0.9, 0.9, 0.5] : [0.3, 0.3, 0.3]);
  }
}

// ===== dust particles =====
const particles = [];
function spawnDust(x, y, color, n = 4, speed = 1.5, opts = {}) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 1500) particles.shift();
    particles.push({
      x, y, vx: randRange(-speed, speed) + (opts.vx || 0), vy: randRange(-speed, speed) - (opts.up || 0) + (opts.vy || 0),
      life: opts.life || randInt(20, 40), color, size: opts.size || randInt(2, 4), grav: opts.grav != null ? opts.grav : 0.1, glow: opts.glow,
    });
  }
}
function spawnTileDust(tx, ty, id, n) {
  const col = TILES[id]?.mapColor || '#888';
  spawnDust(tx * TS + 8, ty * TS + 8, col, n, 1.5);
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.97;
    if (--p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles(ctx, camX, camY) {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 15);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ===== floating combat text =====
const combatTexts = [];
function combatText(x, y, text, color, opts = {}) {
  combatTexts.push({ x, y, text: String(text), color, life: opts.life || 60, max: opts.life || 60, vy: opts.vy || -2, big: opts.big, rot: opts.big ? randRange(-0.2, 0.2) : 0 });
  if (combatTexts.length > 120) combatTexts.shift();
}
function updateCombatTexts() {
  for (let i = combatTexts.length - 1; i >= 0; i--) {
    const t = combatTexts[i];
    t.y += t.vy; t.vy *= 0.92;
    if (--t.life <= 0) combatTexts.splice(i, 1);
  }
}
function drawCombatTexts(ctx, camX, camY) {
  for (const t of combatTexts) {
    const a = Math.min(1, t.life / 20);
    const scale = t.big ? 1 + Math.max(0, (t.life - t.max + 10) / 10) * 0.8 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(Math.round(t.x - camX), Math.round(t.y - camY));
    ctx.rotate(t.rot);
    ctx.scale(scale, scale);
    ctx.font = (t.big ? 'bold 26px ' : 'bold 16px ') + UI_FONT;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color; ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}
const UI_FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
