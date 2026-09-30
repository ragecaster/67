// ---------- tile collision for entities + liquid simulation ----------

// Move an axis-aligned entity through the tile grid (Terraria-like: x then y, 1-tile auto step-up, platforms)
function moveEntity(e, world, opts = {}) {
  const fallThrough = !!opts.fallThrough, stepUp = opts.stepUp !== false;
  const wasOnGround = e.onGround;
  e.collidedX = false; e.collidedY = false; e.onGround = false;
  // ---- X ----
  if (e.vx !== 0) {
    let nx = e.x + e.vx;
    const y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - 0.01) / TS);
    const tx = e.vx > 0 ? Math.floor((nx + e.w - 0.01) / TS) : Math.floor(nx / TS);
    let blockedRow = -1, blocked = false;
    for (let ty = y0; ty <= y1; ty++) if (world.solid(tx, ty)) { blocked = true; if (blockedRow < 0) blockedRow = ty; }
    if (blocked) {
      // step up: only the lowest row is blocked, entity on ground, space above
      let stepped = false;
      if (stepUp && wasOnGround && blockedRow === y1) {
        const lift = e.y + e.h - y1 * TS;
        if (lift <= TS + 0.1) {
          const ny = e.y - lift;
          const yy0 = Math.floor(ny / TS), yy1 = Math.floor((ny + e.h - 0.01) / TS);
          const x0 = Math.floor(Math.min(e.x, nx) / TS), x1 = Math.floor((Math.max(e.x, nx) + e.w - 0.01) / TS);
          let free = true;
          for (let ty = yy0; ty <= yy1 && free; ty++) for (let xx = x0; xx <= x1; xx++) if (world.solid(xx, ty)) { free = false; break; }
          if (free) { e.y = ny; e.x = nx; stepped = true; e.stepOffset = (e.stepOffset || 0) + lift; }
        }
      }
      if (!stepped) {
        e.x = e.vx > 0 ? tx * TS - e.w : (tx + 1) * TS;
        e.vx = 0; e.collidedX = true;
      }
    } else e.x = nx;
  }
  // ---- Y ----
  let ny = e.y + e.vy;
  const x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - 0.01) / TS);
  if (e.vy > 0) {
    const ty = Math.floor((ny + e.h - 0.01) / TS);
    const oldBottom = e.y + e.h;
    for (let tx = x0; tx <= x1; tx++) {
      if (world.solid(tx, ty) || (!fallThrough && world.isPlatform(tx, ty) && oldBottom <= ty * TS + 0.5)) {
        ny = ty * TS - e.h; e.vy = 0; e.onGround = true; e.collidedY = true; break;
      }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(ny / TS);
    for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty)) { ny = (ty + 1) * TS; e.vy = 0; e.collidedY = true; break; }
  }
  e.y = ny;
  if (!e.onGround && e.vy >= 0) {
    const ty = Math.floor((e.y + e.h + 0.5) / TS);
    if (Math.abs(e.y + e.h - ty * TS) < 0.6) for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty) || (!fallThrough && world.isPlatform(tx, ty))) { e.onGround = true; break; }
  }
  // world bounds
  if (e.x < 0) { e.x = 0; e.vx = 0; }
  if (e.x + e.w > world.w * TS) { e.x = world.w * TS - e.w; e.vx = 0; }
  if (e.y < 0) { e.y = 0; e.vy = 0; }
  if (e.y + e.h > world.h * TS) { e.y = world.h * TS - e.h; e.vy = 0; e.onGround = true; }
  // liquids
  e.wet = false; e.lavaWet = false; e.inWeb = false;
  const yy0 = Math.floor(e.y / TS), yy1 = Math.floor((e.y + e.h - 1) / TS);
  for (let ty = yy0; ty <= yy1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const i = world.idx(tx, ty);
    if (!world.inb(tx, ty)) continue;
    const l = world.liquid[i];
    if (l > 40) {
      // only count if liquid surface is above the entity's bottom part
      const surf = (ty + 1) * TS - l / 255 * TS;
      if (surf < e.y + e.h - 4) { if (world.ltype[i] === 1) e.lavaWet = true; else e.wet = true; }
    }
    if (world.tiles[i] === T.COBWEB) e.inWeb = true;
  }
}

function rectHitsSolid(world, x, y, w, h) {
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.01) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.01) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty)) return true;
  return false;
}

// line of sight between two points (tile raycast)
function lineOfSight(world, ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by), steps = Math.ceil(d / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (world.solid(Math.floor(lerp(ax, bx, t) / TS), Math.floor(lerp(ay, by, t) / TS))) return false;
  }
  return true;
}

// ================= liquid simulation =================
const Liquid = {
  active: new Set(),
  changed: new Set(), // cells whose liquid changed this tick (host sends these to clients)
  wake(world, x, y) {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const xx = x + i, yy = y + j;
      if (world.inb(xx, yy) && world.liquid[world.idx(xx, yy)] > 0) this.active.add(world.idx(xx, yy));
    }
  },
  step(world, tick) {
    if (!this.active.size) return;
    const list = Array.from(this.active);
    this.active.clear();
    // bottom-up order improves falling
    list.sort((a, b) => b - a);
    let budget = 6000;
    const W_ = world.w;
    for (const i of list) {
      if (budget-- <= 0) { this.active.add(i); continue; }
      let a = world.liquid[i];
      if (!a) continue;
      const type = world.ltype[i];
      if (type === 1 && tick % 3) { this.active.add(i); continue; } // lava is slow
      const x = i % W_, y = (i / W_) | 0;
      if (TILES[world.tiles[i]]?.solid) { world.liquid[i] = 0; continue; }
      // down
      if (y < world.h - 1) {
        const b = i + W_;
        if (!TILES[world.tiles[b]]?.solid) {
          const bl = world.liquid[b];
          if (bl && world.ltype[b] !== type) { this.mix(world, b, x, y + 1, i); continue; }
          if (bl < 255) {
            const mv = Math.min(a, 255 - bl);
            world.liquid[b] = bl + mv; world.ltype[b] = type; world.liquid[i] = a - mv; a -= mv;
            this.changed.add(b); this.changed.add(i);
            this.active.add(b); if (a > 0) this.active.add(i);
            this.wakeAround(world, x, y);
            if (!a) continue;
          }
        }
      }
      // sideways
      const l = i - 1, r = i + 1;
      const canL = x > 0 && !TILES[world.tiles[l]]?.solid, canR = x < W_ - 1 && !TILES[world.tiles[r]]?.solid;
      let total = a, n = 1;
      if (canL) { if (world.liquid[l] && world.ltype[l] !== type) { this.mix(world, l, x - 1, y, i); continue; } total += world.liquid[l]; n++; }
      if (canR) { if (world.liquid[r] && world.ltype[r] !== type) { this.mix(world, r, x + 1, y, i); continue; } total += world.liquid[r]; n++; }
      if (n > 1) {
        const avg = Math.floor(total / n);
        const rem = total - avg * n;
        let changed = false;
        if (canL && Math.abs(world.liquid[l] - avg) > 1) { world.liquid[l] = avg; world.ltype[l] = type; this.active.add(l); changed = true; }
        if (canR && Math.abs(world.liquid[r] - avg) > 1) { world.liquid[r] = avg; world.ltype[r] = type; this.active.add(r); changed = true; }
        if (changed) {
          world.liquid[i] = avg + rem;
          this.active.add(i);
          this.changed.add(i); if (canL) this.changed.add(l); if (canR) this.changed.add(r);
        }
      }
      if (world.liquid[i] > 0 && world.liquid[i] < 4) {
        // evaporate tiny puddles that can't move
        const below = i + W_;
        if (y >= world.h - 1 || TILES[world.tiles[below]]?.solid || world.liquid[below] >= 250) { world.liquid[i] = 0; this.changed.add(i); }
      }
    }
  },
  wakeAround(world, x, y) {
    if (y > 0) { const u = world.idx(x, y - 1); if (world.liquid[u]) this.active.add(u); }
    if (x > 0) { const l = world.idx(x - 1, y); if (world.liquid[l]) this.active.add(l); }
    if (x < world.w - 1) { const r = world.idx(x + 1, y); if (world.liquid[r]) this.active.add(r); }
  },
  // lava + water -> obsidian
  mix(world, target, tx, ty, src) {
    world.liquid[target] = 0; world.liquid[src] = Math.max(0, world.liquid[src] - 64);
    this.changed.add(target); this.changed.add(src);
    world.setTile(tx, ty, T.OBSIDIAN);
    playSound('lava_hiss');
    this.active.add(src);
  },
};
