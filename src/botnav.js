// ---------- BotSigma navigation: A* over the tile grid for a 2-wide, 3-tall Terraria body ----------
// Node (x, y): the player's two columns are x and x+1, feet row is y (body rows y-2..y).
// Moves: walk, step up, jump up (<=4), drop (safe heights), dig through, dig down, pillar up, swim, doors.
const NO_SPACE = [Infinity, null], FREE_SPACE = [0, null];
const c0free = (nav, x, y) => nav.space(x, y)[0] === 0;
// grappling hook throws the planner tries: straight up, fanned over the upper half, and almost level both ways (gaps)
const HOOK_RAYS = [-90, -75, -105, -60, -120, -45, -135, -30, -150, -15, -165, -4, -176];
const Nav = {
  // execution failures: a move (type@x,y) that the follower couldn't carry out for 300 ticks is banned for a while so the next plan routes differently
  bans: new Map(),
  ban(x, y, t) { this.bans.set(x + ',' + y + ',' + t, G.tick + 8000); },
  banned(x, y, t) { if (!this.bans.size) return false; const e = this.bans.get(x + ',' + y + ',' + t); return e !== undefined && e > G.tick; },
  // ----- cell queries -----
  pickPower() { const p = G.player; return Math.max(0, ...p.inv.map(s => s ? ITEMS[s.id].pick || 0 : 0)); },
  lava(x, y) { const w = G.world; return w.inb(x, y) && w.liquid[w.idx(x, y)] > 20 && w.ltype[w.idx(x, y)] === 1; },
  nearLava(x, y) { for (let j = -2; j <= 1; j++) for (let i = -1; i <= 1; i++) if (this.lava(x + i, y + j)) return true; return false; },
  // 0 = free, >0 = dig cost, Infinity = impassable
  cellCost(x, y) {
    const w = G.world;
    if (!w.inb(x, y)) return Infinity;
    // per-plan memo (stamp array avoids clearing): the world doesn't change during one A* run
    const i = y * w.w + x;
    if (!this.cc || this.cc.length !== w.w * w.h) { this.cc = new Float32Array(w.w * w.h); this.cs = new Uint32Array(w.w * w.h); }
    if (this.cs[i] === this.stamp) return this.cc[i];
    const c = this.cellCostRaw(x, y);
    if (this.noMemo) return c;
    this.cc[i] = c; this.cs[i] = this.stamp;
    return c;
  },
  cellCostRaw(x, y) {
    const w = G.world;
    if (this.lava(x, y)) return Infinity;
    const az = Bot.avoidZone; if (az && az.until > G.tick && Math.abs(x - az.x) < az.r && Math.abs(y - az.y) < az.r) return Infinity; // see Bot.registerDeath
    // the Backrooms room is a real room underground: walking or digging into it is the same as noclipping in (Smilers,
    // Partygoers, a long way out). Never route through it from outside (from inside, the way out is allowed).
    const b = w.backrooms;
    if (b && this.avoidBackrooms && x >= b.x0 - 1 && x <= b.x0 + b.w && y >= b.y0 - 1 && y <= b.y0 + b.h) return Infinity;
    const t = w.tile(x, y);
    if (!t) return 0;
    const td = TILES[t];
    if (td.noclip && !this.allowNoclip) return Infinity; // don't wander into the Backrooms by accident
    // (non-solid too: a pillar breaks the furniture in its cells first, and a full chest never breaks; the same pillar plan came
    // back every 300 ticks, evalD)
    if (Bot.badTiles && Bot.badTiles.has(x + ',' + y)) return Infinity; // a tile we already failed to break
    if (!td.solid) return td.web ? 1 : 0;
    if (td.door) return 1; // we open doors
    if (td.unbreakable || td.multi || td.chest) return Infinity;
    if (Bot.isProtected(x, y)) return Infinity; // never dig through our own house
    if (td.minPick > this.power) return Infinity;
    // Ohiostone spills lava half the time it breaks: a path never digs through it (only the Ohio-armor mining does, from above)
    if (t === T.HELLSTONE) return Infinity;
    // blocks holding up objects/trees can't be mined
    const above = TILES[w.tile(x, y - 1)];
    if (above && ((above.multi && !above.door) || above.tree || above.cactus)) return Infinity;
    if (this.nearLava(x, y)) return Infinity;
    return 3 + td.hp / Math.max(20, this.power) * 1.5 + (Bot.inYard(x, y) ? 40 : 0);
  },
  standable(x, y) {
    const w = G.world;
    const s = (i) => { const t = w.tile(i, y + 1); return TILES[t]?.solid || t === T.PLATFORM; };
    return s(x) || s(x + 1);
  },
  // an airborne arrival (drop / leap / jump) on a node that only one column supports, next to a deep shaft, overshoots into
  // the shaft once in a while (a 44-tile fall at spawn killed evalF four times in a row): such landings are not offered
  safeLanding(x, y) {
    const w = G.world;
    for (const c of [x, x + 1]) {
      const t = w.tile(c, y + 1); if ((TILES[t] && TILES[t].solid) || t === T.PLATFORM) continue;
      let k = 1; while (k < 20 && !w.solid(c, y + k) && w.liq(c, y + k) < 100) k++;
      if (k >= 20) return false;
    }
    return true;
  },
  wet(x, y) { const w = G.world; return w.liq(x, y) > 100 || w.liq(x + 1, y) > 100 || w.liq(x, y - 1) > 100; },
  // cost to have the body at (x,y) with the given extra rows; returns [cost, digList]
  space(x, y, rowsUp = 2, rowsDown = 0) {
    let cost = 0, digs = null;
    for (let yy = y - rowsUp; yy <= y + rowsDown; yy++) for (let xx = x; xx <= x + 1; xx++) {
      const c = this.cellCost(xx, yy);
      if (c === Infinity) return NO_SPACE;
      if (c > 1) { cost += c; (digs || (digs = [])).push([xx, yy]); }
      else cost += c;
    }
    return digs ? [cost, digs] : (cost === 0 ? FREE_SPACE : [cost, null]);
  },

  // ----- grappling hook -----
  // Where a hook thrown from node (x, y) takes us: the first solid / platform / tree cell along each ray within the hook's
  // reach (~18 tiles) is the anchor; the pull (11 px/tick) stops ~16 px short of it and we hang there. The 20x42 body needs
  // open air all along the way (a corner stalls the pull) and at the hang point. [[hangNodeX, hangNodeY, anchorX, anchorY, px]]
  hookArrivals(x, y) {
    const w = G.world, key = y * w.w + x;
    if (!this.hkMemo || this.hkStamp !== this.stamp) { this.hkMemo = new Map(); this.hkStamp = this.stamp; }
    let out = this.hkMemo.get(key);
    if (out) return out;
    out = [];
    const cx0 = x * TS + 16, cy0 = (y + 1) * TS - 21, nc = w.noclipAt && w.tile(w.noclipAt[0], w.noclipAt[1]) === T.NOCLIP ? w.noclipAt : null;
    const grab = (tx, ty) => { const t = w.tile(tx, ty); return !!t && (TILES[t].solid || t === T.PLATFORM || !!TILES[t].tree); };
    const hits = (cx, cy) => { const x0 = Math.floor((cx - 10) / TS), x1 = Math.floor((cx + 9.9) / TS), y0 = Math.floor((cy - 21) / TS), y1 = Math.floor((cy + 20.9) / TS); for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (w.solid(tx, ty)) return true; return false; };
    const seen = new Set();
    for (const deg of HOOK_RAYS) {
      const a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
      let ax = -1, ay = -1, L = 0;
      for (let s = 12; s <= 288; s += 4) {
        const tx = Math.floor((cx0 + ux * s) / TS), ty = Math.floor((cy0 + uy * s) / TS);
        if (!w.inb(tx, ty)) break;
        if (grab(tx, ty)) { ax = tx; ay = ty; L = s; break; }
      }
      if (ax < 0 || L < 64 || seen.has(ax + ',' + ay)) continue;
      seen.add(ax + ',' + ay);
      // the pull, like the game does it: 11 px/tick at the anchor, axis by axis against the tiles, until within 20 px or stuck
      const px = ax * TS + 8, py = ay * TS + 8;
      let cx = cx0, cy = cy0;
      for (let i = 0; i < 40; i++) {
        const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
        if (d <= 20) break;
        const vx = dx / d * 11, vy = dy / d * 11;
        let moved = false;
        if (!hits(cx + vx, cy)) { cx += vx; moved = true; }
        if (!hits(cx, cy + vy)) { cy += vy; moved = true; }
        if (!moved) break;
        if (nc && Math.abs(cx - (nc[0] * TS + 8)) < 10 + 8 + 2 && Math.abs(cy - (nc[1] * TS + 8)) < 21 + 8 + 2) { cx = -1e9; break; }
      }
      if (cx < -1e8) continue;   // (the pull drags the body through the glitch block: straight into the Backrooms, evalA ~50 times)
      const nx = Math.round((cx - 16) / TS), ny = Math.floor((cy + 20) / TS);
      if (Math.abs(nx - x) + Math.abs(ny - y) < 3 || this.space(nx, ny)[0] !== 0) continue;
      out.push([nx, ny, ax, ay, Math.hypot(cx - cx0, cy - cy0)]);
    }
    this.hkMemo.set(key, out);
    return out;
  },

  // ----- A* -----
  plan(sx, sy, goalFn, heur, maxNodes = 16000, Wt) {
    this.stamp = (this.stamp || 0) + 1;
    this.power = this.pickPower();
    this.blocks = Bot.spareBlocks(false) + Math.max(0, Bot.count('wood_platform') - Bot.PLATFORM_KEEP); // only blocks we may spend (not the ones reserved for the current goal); platforms pillar too
    this.avoidBackrooms = !G.inBackrooms(G.player);
    this.hookOk = G.player.hasHook();
    const w = G.world, WW = w.w, N = WW * w.h;
    if (!this.gA || this.gA.length !== N) { this.gA = new Float64Array(N); this.gS = new Uint32Array(N); this.fromA = new Int32Array(N); this.mvA = new Uint8Array(N); this.fallA = new Uint8Array(N); this.vertA = new Uint8Array(N); }
    const gA = this.gA, gS = this.gS, fromA = this.fromA, mvA = this.mvA, fallA = this.fallA, vertA = this.vertA, stamp = this.stamp;
    const MV = ['walk', 'up', 'drop', 'jump', 'down', 'fall', 'swim', 'pillar', 'leap', 'bridge', 'hook'], PILLAR = 7, FALL = 5, BRIDGE = 9, HOOK = 10;
    const digMap = new Map(), hookMap = new Map();
    const key = (x, y) => y * WW + x;
    // binary min-heap of [f, cost, x, y]
    const heap = [];
    const hpush = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (heap[pi][0] <= e[0]) break; heap[i] = heap[pi]; i = pi; } heap[i] = e; };
    const hpop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; const n = heap.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
    const W = Wt || this.W || 2.5; // weighted A*: greedy toward the goal (dig costs make the plain heuristic far too optimistic)
    hpush([heur(sx, sy) * W, 0, sx, sy]);
    const open = heap;
    const hung = G.player.hook && G.player.hook.state === 'latched';   // hanging from the hook already: the next throw starts here
    gA[key(sx, sy)] = 0; gS[key(sx, sy)] = stamp; fromA[key(sx, sy)] = -1; mvA[key(sx, sy)] = hung ? HOOK : 0; fallA[key(sx, sy)] = 0; vertA[key(sx, sy)] = 0;
    let expanded = 0, best = null, bestH = Infinity;
    const push = (x, y, cost, prevK, move) => {
      if (this.bans.size && this.banned(x, y, move.t)) return;
      const k = key(x, y);
      if (gS[k] === stamp && gA[k] <= cost) return;
      // rows fallen since we last stood on something (the game hurts above 25): mid-air drop/fall chains must not exceed ~22
      const dy = y - Math.floor(prevK / WW);
      let fall = dy > 0 && !(move.t === 'down') ? fallA[prevK] + dy : 0;
      if (fall > 0 && this.standable(x, y)) fall = 0;
      if (fall > 22) return;
      // never dig/descend more than ~15 rows in a straight vertical line: a stair-step stops an accidental fall (the game hurts above 25 tiles)
      // (a platform under us is a catch point: a ladder of them can be walked down rung by rung, any length)
      const onPlat = G.world.tile(x, y + 1) === T.PLATFORM || G.world.tile(x + 1, y + 1) === T.PLATFORM;
      const vert = dy > 0 && !onPlat ? vertA[prevK] + dy : 0;
      if (vert > 15) return;
      gA[k] = cost; gS[k] = stamp; fromA[k] = prevK; mvA[k] = MV.indexOf(move.t);
      fallA[k] = fall; vertA[k] = vert;
      if (move.digs) digMap.set(k, move.digs); else digMap.delete(k);
      if (move.ax != null) hookMap.set(k, [move.ax, move.ay]); else hookMap.delete(k);
      hpush([cost + heur(x, y) * W, cost, x, y]);
    };
    while (open.length && expanded < maxNodes) {
      const [f, cost, x, y] = hpop();
      const k = key(x, y);
      if (cost > gA[k]) continue;
      expanded++;
      const h = heur(x, y);
      if (h < bestH) { bestH = h; best = k; }
      if (goalFn(x, y)) { best = k; break; }
      const inWater = this.wet(x, y);
      for (const dx of [-1, 1]) {
        // walk (with digging)
        let [c, d] = this.space(x + dx, y);
        if (c < Infinity && (this.standable(x + dx, y) || inWater)) push(x + dx, y, cost + 1 + c, k, { t: 'walk', digs: d });
        // step up 1 (needs head room above us too)
        [c, d] = this.space(x + dx, y - 1, 2, 0);
        const [hc, hd] = this.space(x, y - 3, 0, 0);
        if (c < Infinity && hc < Infinity && (this.standable(x + dx, y - 1) || inWater)) push(x + dx, y - 1, cost + 1.5 + c + hc, k, { t: 'up', digs: hd ? (d ? hd.concat(d) : hd) : d });
        // drop off a ledge (no digging, up to a safe height)
        const [c0] = this.space(x + dx, y);
        if (c0 === 0 && !this.standable(x + dx, y)) {
          for (let k2 = 1; k2 <= 18; k2++) {
            const [cc] = this.space(x + dx, y + k2, 0, 0);
            if (cc !== 0) break;
            if (this.wet(x + dx, y + k2) || (this.standable(x + dx, y + k2) && this.safeLanding(x + dx, y + k2))) { push(x + dx, y + k2, cost + 1 + k2 * 0.3, k, { t: 'drop', digs: [] }); break; }
            if (this.standable(x + dx, y + k2)) break;
          }
        }
        // jump up 2..4 onto a ledge (column above us must be clear)
        for (let j = 2; j <= 3; j++) {
          const [col] = this.space(x, y - 3, j - 1, 0); // rows y-2-j .. y-3: the air we rise through
          if (col !== 0) break;
          const [tc] = this.space(x + dx, y - j);
          if (tc === 0 && this.standable(x + dx, y - j)) { if (this.safeLanding(x + dx, y - j)) push(x + dx, y - j, cost + 1 + j * 1.2, k, { t: 'jump', digs: [] }); break; }
        }
      }
      // leap across a 1-3 tile gap at the same height (run + jump): the intermediate cells must be free air
      for (const dx of [-1, 1]) {
        if (!this.standable(x, y) || (c0free(this, x + dx, y) && this.standable(x + dx, y))) continue;
        for (let L = 2; L <= 4; L++) {
          const [cl] = this.space(x + dx * L, y);
          if (cl !== 0) break;
          // the arc needs headroom above the gap
          if (this.space(x + dx * Math.max(1, L - 1), y - 3, 1, 0)[0] !== 0) break;
          if (this.standable(x + dx * L, y)) { if (this.safeLanding(x + dx * L, y)) push(x + dx * L, y, cost + 2 + L * 0.8, k, { t: 'leap', digs: null }); break; }
        }
      }
      // bridge: lay a block under the front foot to cross a gap or lava (chains: the block we just laid is the floor now)
      if (this.blocks > 3 && (this.standable(x, y) || mvA[k] === BRIDGE)) {
        for (const dx of [-1, 1]) {
          if (this.standable(x + dx, y)) continue;                        // plain walking already works there
          const [cb] = this.space(x + dx, y);
          if (cb !== 0) continue;                                          // body cells must be free (and never lava)
          // the cell the block goes into must not be solid already and must have a neighbour to attach to (the floor we stand on)
          push(x + dx, y, cost + (this.BRIDGE_COST || 5), k, { t: 'bridge', digs: null });
        }
      }
      // dig straight down one row
      {
        const [c, d] = this.space(x, y + 1, 0, 0);
        if (c < Infinity && c > 0) push(x, y + 1, cost + 1 + c, k, { t: 'down', digs: d });
        else if (c === 0 && !this.standable(x, y)) push(x, y + 1, cost + 0.5 + (fallA[k] > 8 ? 2 : 0), k, { t: 'fall', digs: [] });
        // standing on platforms only (no solid floor under us): hold S and drop through them, like a player
        else if (c === 0 && !w.solid(x, y + 1) && !w.solid(x + 1, y + 1)) push(x, y + 1, cost + 0.6, k, { t: 'fall', digs: [] });
      }
      // the grappling hook: from the ground, or chained from where the last throw left us hanging (up a shaft, over a gap)
      if (this.hookOk && (this.standable(x, y) || mvA[k] === HOOK)) {
        for (const [hx, hy, ax, ay, len] of this.hookArrivals(x, y)) push(hx, hy, cost + 3 + len / TS * 0.35, k, { t: 'hook', digs: null, ax, ay });
      }
      // climb straight up: swim, or pillar with blocks
      {
        const [c, d] = this.space(x, y - 3, 0, 0);
        if (c < Infinity && inWater) push(x, y - 1, cost + 1.5 + c, k, { t: 'swim', digs: d });
        // a pillar can chain in open air: the block we placed for the previous step is what we stand on now
        else if (c < Infinity && this.blocks > 3 && (this.standable(x, y) || mvA[k] === PILLAR)) push(x, y - 1, cost + (Nav.pillarCost || 4) + c, k, { t: 'pillar', digs: d });
      }
    }
    if (best == null) return null;
    // rebuild
    const path = [];
    let k = best;
    while (fromA[k] !== -1 && gS[k] === stamp) { const hk = hookMap.get(k); path.push({ x: k % WW, y: Math.floor(k / WW), move: { t: MV[mvA[k]], digs: digMap.get(k) || [], ax: hk && hk[0], ay: hk && hk[1] } }); k = fromA[k]; }
    path.reverse();
    return { path, reached: goalFn(best % WW, Math.floor(best / WW)), expanded };
  },

  // height of the ground in column x (cached per plan stamp); columns we can't read (water) count as the world surface
  surfAt(x) {
    if (!this.surfC || this.surfStamp !== this.stamp) { this.surfC = new Map(); this.surfRaw = new Map(); this.surfStamp = this.stamp; }
    let v = this.surfC.get(x);
    if (v === undefined) {
      // highest ground within a few columns: a vertical shaft we dug (open to the sky, bottom deep down) is not 'the surface'
      v = 1e9; for (let i = x - 4; i <= x + 5; i++) v = Math.min(v, this.rawSurf(i));
      this.surfC.set(x, v);
    }
    return v;
  },
  // first solid tile from the sky (liquids are ignored: a puddle must not turn a column into 'surface = the cave layer')
  rawSurf(x) {
    let v = this.surfRaw.get(x);
    if (v === undefined) {
      const w = G.world; v = w.h - 2;
      for (let y = 5; y < w.h - 1; y++) { const t = w.tile(x, y); if (t && TILES[t].solid) { v = y; break; } }
      this.surfRaw.set(x, v);
    }
    return v;
  },
  // ----- player <-> node -----
  nodeOf(p) { return [Math.round((p.cx - 16) / TS), Math.floor((p.y + p.h - 1) / TS)]; },
};

// ---------- path following ----------
Object.assign(Bot, {
  // moveTo(tx, ty, tol): get the feet within `tol` tiles of (tx, ty). true = arrived, 'fail' = no route
  moveTo(tx, ty, tol = 1) {
    const p = G.player;
    const [nx, ny] = Nav.nodeOf(p);
    const goalFn = (x, y) => Math.abs(x + 0.5 - tx) <= tol + 0.5 && Math.abs(y - ty) <= Math.max(1, tol);
    if (goalFn(nx, ny) && (p.onGround || p.wet)) { this.nav = null; return true; }
    if (goalFn(nx, ny) && p.hook && p.hook.state === 'latched') { this.jump(); return false; }   // got there hanging from the hook: let go
    const ng = this.nav;
    const moved = !ng || Math.abs(ng.tx - tx) > 2 || Math.abs(ng.ty - ty) > 2 || ng.tol !== tol;
    // a moving goal (chasing an enemy) must not trigger a full A* every tick
    // (an empty plan is retried once its cooldown is over: it used to sit there for 900 ticks)
    const needPlan = !ng || (moved && (G.tick - ng.at >= 25 || Math.abs(ng.tx - tx) + Math.abs(ng.ty - ty) > 12)) || ng.replan || (G.tick - ng.at > 900) || (!ng.path.length && G.tick >= (ng.cooldown || 0));
    if (needPlan) {
      if (ng && ng.cooldown > G.tick && Math.abs(ng.tx - tx) <= 2 && Math.abs(ng.ty - ty) <= 2) { this.nav.replan = false; }
      else {
        // far goals (the way home from deep caves) need far more than 16k nodes: dig-through-rock detours are expensive to prove
        const far = Math.abs(nx - tx) + Math.abs(ny - ty) * 1.3;
        // dig-aware: climbing through rock costs ~6/row, dropping ~2/row (a plain 1.3/row heuristic makes A* flood every cavern first)
        let heur = (x, y) => Math.abs(x + 0.5 - tx) + (y > ty ? (y - ty) * 6 : (ty - y) * 2), gf = goalFn, budget = Math.min(220000, Math.max(16000, Math.round(far * 1100))), stage = 'direct';
        // hierarchical: from deep underground to a near-surface goal, first just get UP to the surface (a vertical-only heuristic
        // is far less misleading than the straight-line one), then walk the rest on open ground
        const sa = Nav.surfAt(nx), st = Nav.surfAt(Math.round(tx));
        // (not while a direct plan to this same goal is being followed: from the surface it may well lead through a cave, and
        // "ascend" from inside that cave sent us back up to where the direct plan started, over and over: evalE ~150k ticks)
        const dg = this.directGoal, directLock = dg && dg.key === tx + ',' + ty && G.tick - dg.at < (Nav.DIRECT_LOCK != null ? Nav.DIRECT_LOCK : 6000);
        if (ny - sa > 22 && ty - st < 14 && far > 45 && !directLock) {
          // reach open sky at roughly the target's ground level (not the bottom of some shaft we dug)
          const ref = Nav.rawSurf(Math.round(tx));
          gf = (x, y) => y <= ref + 6 && Nav.rawSurf(x) > y && Nav.rawSurf(x + 1) > y;
          heur = (x, y) => Math.max(0, y - ref) * 6 + Math.abs(x + 0.5 - tx) * 0.5;
          budget = 120000; stage = 'ascend';
        }
        // deep below the surface the true route is far longer than the straight line; and a plan that ran out of budget last time must get more
        if (ny - sa > 12) budget = Math.max(budget, 90000);
        const gkey = tx + ',' + ty, lastB = this.lastBudget && this.lastBudget.key === gkey && this.lastBudget.partial ? this.lastBudget.n * 2 : 0;
        budget = Math.min(300000, Math.max(budget, lastB));
        // safety valve: the same plan over and over within a few ticks means the follower keeps rejecting it; back off instead of burning the CPU
        const pk = nx + ',' + ny + '>' + tx + ',' + ty;
        if (this.lastPk === pk && G.tick - this.lastPkAt < 45) { this.pkRepeat = (this.pkRepeat || 0) + 1; } else this.pkRepeat = 0;
        this.lastPk = pk; this.lastPkAt = G.tick;
        if (this.pkRepeat > 3) { this.pkRepeat = 0; this.nav = { tx, ty, tol, at: G.tick, path: [], i: 0, cooldown: G.tick + 90 }; this.replanStorms = (this.replanStorms || 0) + 1; return false; }
        const t0 = performance.now();
        const res = Nav.plan(nx, ny, gf, heur, budget, stage === 'ascend' ? (Nav.ascendW || 1.2) : undefined);
        this.lastBudget = { key: gkey, n: budget, partial: !res || !res.reached };
        const dt = performance.now() - t0; this.planMs = (this.planMs || 0) + dt; this.planCount = (this.planCount || 0) + 1;
        const gk = (this.goal || '').split(' ').slice(0, 2).join(' '), pb = this.planBy || (this.planBy = {}); (pb[gk] || (pb[gk] = [0, 0]))[0] += dt; pb[gk][1]++;
        (this.planLog || (this.planLog = [])).push(G.tick + ' ' + (this.goal || '').slice(0, 24) + ' from ' + nx + ',' + ny + ' to ' + tx + ',' + ty + ' tol' + tol + ' ' + stage + ' len' + (res ? res.path.length : -1) + (res && !res.reached ? ' PARTIAL' : '') + ' why=' + this.replanWhy + ' exp' + (res ? res.expanded : 0) + ' ' + Math.round(dt) + 'ms'); if (this.planLog.length > 60) this.planLog.shift();
        this.navFails = res && res.path.length ? 0 : (this.navFails || 0) + 1;
        // (an empty plan to the same goal again and again: back off 60, 120, 240 ... up to 1920 ticks. A 580-column goal with
        // no route used the whole 300k-node budget, ~900 ms of A*, every 60 ticks on evalO: a one-second freeze each second)
        const emptyPlan = !res || !res.path.length || (!res.reached && res.path.length <= 1);
        if (emptyPlan) { const E = this.emptyPlans || (this.emptyPlans = {}); E[gkey] = (E[gkey] && G.tick - E[gkey].at < 4000 ? E[gkey].n + 1 : 0); E[gkey] = { n: E[gkey], at: G.tick }; }
        else if (this.emptyPlans) delete this.emptyPlans[gkey];
        const backoff = emptyPlan ? 60 * Math.pow(2, Math.min(5, this.emptyPlans[gkey].n)) : 0;
        if (!res || !res.path.length) { this.nav = { tx, ty, tol, at: G.tick, path: [], i: 0, cooldown: G.tick + backoff }; if (this.navFails > 3) { this.navFails = 0; return 'fail'; } return false; }
        this.nav = { tx, ty, tol, at: G.tick, stage, path: res.path, i: 0, partial: !res.reached, lastProgress: G.tick, cooldown: G.tick + Math.max(30, backoff) };
        if (stage === 'direct' && !directLock && res.path.some(n => n.y > Nav.surfAt(n.x) + 22)) this.directGoal = { key: tx + ',' + ty, at: G.tick };
      }
    }
    return this.followPath();
  },
  followPath() {
    const p = G.player, w = G.world, nav = this.nav;
    if (!nav || !nav.path.length) return false;
    const [nx, ny] = Nav.nodeOf(p);
    const latched = !!(p.hook && p.hook.state === 'latched');
    this.latchT = latched ? (this.latchT || 0) + 1 : 0;
    const hanging = latched && this.latchT > 3 && Math.abs(p.vx) + Math.abs(p.vy) < 0.5;   // (the tick it latches we haven't moved yet)
    const settled = p.onGround || p.wet || hanging;
    // a path that doesn't start next to us is stale (respawned, knocked back, fell): plan again
    const hk0 = nav.path[0].move.t === 'hook';   // (a hook step lands up to ~18 tiles off)
    if (nav.i === 0 && settled && (Math.abs(nav.path[0].x - nx) > (hk0 ? 19 : 5) || nav.path[0].y - ny > 20 || ny - nav.path[0].y > (hk0 ? 19 : 5))) { nav.replan = true; nav.cooldown = 0; this.replanWhy = 'stale-start'; return false; }
    // resync: find where we are on the path (we may have skipped ahead or fallen off)
    let found = -1;
    for (let j = Math.max(0, nav.i - 2); j < Math.min(nav.path.length, nav.i + 8); j++) {
      const q = nav.path[j];
      // (< 8 px: exactly the band in which nodeOf() puts us on that node; with 9 the bot could count a step as done that
      // nodeOf() never agreed with, and stood still between 'path-end' and a 1-step replan forever)
      if (Math.abs(p.cx - (q.x * TS + 16)) < 8 && q.y === ny) found = j;
    }
    if (found >= nav.i - 1 && found >= 0 && settled) { if (found + 1 > nav.i) nav.lastProgress = G.tick; nav.i = found + 1; }
    else if (found < 0 && settled && nav.i > 0) {
      const prev = nav.path[nav.i - 1];
      if (!prev || Math.abs(p.cx - (prev.x * TS + 16)) > 20 || prev.y !== ny) { nav.offPath = (nav.offPath || 0) + 1; if (nav.offPath > 20) {
        // knocked off a chain of hook moves (a throw in mid-air missed, back down where we started): don't plan the same chain
        // again (evalD hooked up and fell back down for thousands of ticks, replanning the same pair of hooks)
        const cur = nav.path[nav.i]; if (cur && cur.move.t === 'hook') Nav.ban(cur.x, cur.y, 'hook');
        nav.replan = true; nav.cooldown = 0; this.replanWhy = 'offpath'; return false; } }
    }
    if (nav.i >= nav.path.length) { nav.replan = true; nav.cooldown = 0; this.replanWhy = 'path-end'; return false; }
    if (G.tick - nav.lastProgress > 300) { const bm = nav.path[nav.i]; if (bm) Nav.ban(bm.x, bm.y, bm.move.t); nav.replan = true; nav.cooldown = 0; this.replanWhy = 'no-progress'; this.stuckReplans = (this.stuckReplans || 0) + 1; if (this.stuckReplans > 5) { this.stuckReplans = 0; return 'fail'; } return false; }
    const n = nav.path[nav.i], m = n.move;
    // the grappling hook: throw it at the anchor, ride the pull, hang; then on to the next step (which lets go)
    if (m.t === 'hook') {
      const h = p.hook;
      if (h && h.state === 'latched') {
        // still hanging from the last step's hook (the game throws no second one while one holds): let go, throw in mid-air
        if (this.hookFor !== n) { this.jump(); return false; }
        if (Math.abs(Math.floor(h.x / TS) - m.ax) > 1 || Math.abs(Math.floor(h.y / TS) - m.ay) > 1) { this.jump(); Nav.ban(n.x, n.y, 'hook'); nav.replan = true; nav.cooldown = 0; this.replanWhy = 'hook-wrong'; return false; }
        // stopped at the anchor, or stuck on a corner on the way (no movement for a while): the next step starts from here
        const moved = this.hookPos ? Math.abs(p.x - this.hookPos[0]) + Math.abs(p.y - this.hookPos[1]) : 99; this.hookPos = [p.x, p.y];
        this.hookStall = moved < 0.3 ? (this.hookStall || 0) + 1 : 0;
        if (hanging || this.hookStall > 6) {
          this.hookThrows = 0; nav.lastProgress = G.tick;
          if (hanging && Math.abs(p.cx - (n.x * TS + 16)) < 14 && Math.abs(ny - n.y) <= 1) nav.i++;
          // (banned: the hook caught a tile short of the planned anchor and the same plan came back every time, hook up, fall,
          // hook up, for 130k ticks next to the house)
          else { Nav.ban(n.x, n.y, 'hook'); nav.replan = true; nav.cooldown = 0; this.replanWhy = 'hook-short'; }
        }
        return false;
      }
      if (h && this.hookFor === n) return false;   // flying out
      if (h) return false;   // reeling back in
      this.hookPos = null; this.hookFor = n;
      this.aimWorld(m.ax * TS + 8, m.ay * TS + 8); this.press('e');
      if ((this.hookThrows = (this.hookThrows || 0) + 1) > 6) { this.hookThrows = 0; Nav.ban(n.x, n.y, 'hook'); nav.replan = true; nav.cooldown = 0; this.replanWhy = 'hook-miss'; }
      return false;
    }
    // any other step while hanging from the hook: let go first (a jump), the move's own keys do the rest
    if (p.hook && p.hook.state === 'latched') this.jump();
    // 1) dig whatever blocks the next step
    for (const [dx, dy] of m.digs || []) {
      const t = w.tile(dx, dy);
      if (t && TILES[t].solid) {
        if (TILES[t].door) { if (t === T.DOOR_CLOSED) { this.rightClickWorld(dx, dy); this.doorOpened = [dx, dy]; } continue; }
        if (!p.inReach(dx, dy)) break;
        if (this.dig(dx, dy) === 'fail') { nav.replan = true; nav.cooldown = 0; this.replanWhy = 'dig-fail'; }
        return false;
      }
    }
    for (let j = 0; j < 3; j++) for (const xx of [n.x, n.x + 1]) if (w.tile(xx, n.y - j) === T.DOOR_CLOSED) { this.rightClickWorld(xx, n.y - j); this.doorOpened = [xx, n.y - j]; return false; }
    // 2) move the body there
    const targetCx = n.x * TS + 16, dxp = targetCx - p.cx;
    // moves that deliberately leave the ground (drop/fall/leap/jump) may walk off an edge; plain walks may not
    this.allowDrop = m.t === 'bridge' || m.t === 'drop' || m.t === 'fall' || m.t === 'leap' || m.t === 'jump' || m.t === 'swim' || m.t === 'down' || m.t === 'pillar' || m.t === 'up';
    if (m.t === 'pillar') {
      if (Math.abs(dxp) > 5) { this.hold(dxp > 0 ? 'd' : 'a'); return false; }
      const row = n.y + 1, cands = [Math.floor(p.cx / TS), Math.floor((p.x + 1) / TS), Math.floor((p.x + p.w - 1) / TS)];
      // the game only lets a block attach to a neighbour: use the body column that has something solid right below the target cell
      let col = this.pillarCol;
      if (col === undefined || !(cands.includes(col) && (w.solid(col, row + 1) || w.tile(col, row + 1) === T.PLATFORM))) {
        col = cands.find(c => w.solid(c, row + 1) || w.tile(c, row + 1) === T.PLATFORM);
        if (col === undefined) col = cands.find(c => w.solid(c - 1, row) || w.solid(c + 1, row)); // or a wall beside it
        if (col === undefined) col = cands[0];
      }
      this.pillarCol = col;
      const bsP = this.climbSlot(), plat = bsP >= 0 && p.inv[bsP] && p.inv[bsP].id === 'wood_platform';
      // furniture/objects standing in the cell (a chair, a pot...) block placement: break them first, while we still stand there
      const occ = w.tile(col, row);
      if (occ && !TILES[occ].solid && !TILES[occ].cut) { if (this.dig(col, row) === 'fail') { nav.replan = true; this.replanWhy = 'pillar-blocked'; } return false; }
      const bs = bsP; // platforms first; never the blocks reserved for the current goal, never wood blocks
      if (bs < 0) { nav.replan = true; this.replanWhy = 'no-blocks'; this.wantPlatforms = G.tick; return false; }
      if (bs > 9) { this.ensureHotbar(bs); return false; }
      this.selectSlot(bs);
      if (p.onGround) { this.jump(); return false; }
      // platforms make a sparse ladder: a held jump lifts the feet ~6 rows, so one rung near the top of each jump is enough
      // (a rung needs something to attach to: a tile beside/above it or a background wall, which shafts and caves have;
      // in open air each one has to sit on the last, so there we fall back to one per row)
      if (plat) {
        let top = n.y; for (let j = nav.i + 1; j < nav.path.length && nav.path[j].move.t === 'pillar' && nav.path[j].x === n.x; j++) top = nav.path[j].y;
        const r = Math.ceil((p.y + p.h) / TS), anchored = (cx, cy) => w.tile(cx - 1, cy) || w.tile(cx + 1, cy) || w.tile(cx, cy - 1) || w.tile(cx, cy + 1) || w.wall(cx, cy);
        if (r > top && r <= row && !w.tile(col, r) && anchored(col, r) && (p.vy > -0.8 || r === top + 1)) { this.aimTile(col, r); this.clickOnce(); return false; }
        if (p.vy < -0.8 || anchored(col, Math.max(top + 1, r))) { this.jump(); return false; }   // still rising: keep the key held
      }
      // blocks (or nothing to anchor a rung to): one per row, placed as soon as our feet clear the target cell
      if (p.y + p.h < (n.y + 1) * TS - 2) { this.aimTile(col, row); this.clickOnce(); }
      else this.jump();
      return false;
    }
    if (m.t === 'bridge') {
      // fill every missing floor cell under the next node's two body columns, nearest to where we stand first (each one attaches to the last)
      const dir = n.x > nx ? 1 : -1, row = n.y + 1;
      const cols = dir > 0 ? [n.x, n.x + 1] : [n.x + 1, n.x];
      const col = cols.find(c => !(w.tile(c, row) && (TILES[w.tile(c, row)].solid || w.tile(c, row) === T.PLATFORM)));
      if (col !== undefined) {
        const bs = this.climbSlot();   // platforms first (walkable, and nothing to dig back out), never wood blocks
        if (bs < 0) { nav.replan = true; this.replanWhy = 'no-blocks'; this.wantPlatforms = G.tick; return false; }
        if (bs > 9) { this.ensureHotbar(bs); return false; }
        this.selectSlot(bs);
        this.aimTile(col, row);
        // brake while the block goes in: we must not slide off the edge first
        if (Math.abs(p.vx) > 0.6) this.hold(p.vx > 0 ? 'a' : 'd');
        if (p.itemAnim === 0) this.clickOnce();
        return false;
      }
    }
    if (Math.abs(dxp) > 2) this.hold(dxp > 0 ? 'd' : 'a');
    // dropping onto a node: momentum carries ~3 px/tick, so brake once above it instead of sailing past the ledge
    else if ((m.t === 'drop' || m.t === 'fall') && Math.abs(p.vx) > 0.8) Input.keys[p.vx > 0 ? 'a' : 'd'] = true;
    // falling down past platforms (our own ladders, arenas): hold S until the feet reach the node we're going to
    // (let go before 18 rows of free fall so the next rung catches us: the game hurts above 25)
    const fallen = p.fallStart != null ? (p.y - p.fallStart) / TS : 0;
    if (m.t === 'fall' && Math.floor((p.y + p.h - 1) / TS) < n.y && fallen < 18) Input.keys.s = true;
    if (n.y < ny || m.t === 'jump' || m.t === 'swim' || m.t === 'leap') {
      if (p.onGround || p.wet || p.vy < 0) this.jump();
    }
    // walking into a wall we expected to step up: hop
    if (p.collidedX && p.onGround) this.jump();
    return false;
  },
});
