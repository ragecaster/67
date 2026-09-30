// ---------- BotSigma navigation: A* over the tile grid for a 2-wide, 3-tall Terraria body ----------
// Node (x, y): the player's two columns are x and x+1, feet row is y (body rows y-2..y).
// Moves: walk, step up, jump up (<=4), drop (safe heights), dig through, dig down, pillar up, swim, doors.
const Nav = {
  // ----- cell queries -----
  pickPower() { const p = G.player; return Math.max(0, ...p.inv.map(s => s ? ITEMS[s.id].pick || 0 : 0)); },
  lava(x, y) { const w = G.world; return w.inb(x, y) && w.liquid[w.idx(x, y)] > 20 && w.ltype[w.idx(x, y)] === 1; },
  nearLava(x, y) { for (let j = -2; j <= 1; j++) for (let i = -1; i <= 1; i++) if (this.lava(x + i, y + j)) return true; return false; },
  // 0 = free, >0 = dig cost, Infinity = impassable
  cellCost(x, y) {
    const w = G.world;
    if (!w.inb(x, y)) return Infinity;
    if (this.lava(x, y)) return Infinity;
    const t = w.tile(x, y);
    if (!t) return 0;
    const td = TILES[t];
    if (td.noclip && !this.allowNoclip) return Infinity; // don't wander into the Backrooms by accident
    if (!td.solid) return td.web ? 1 : 0;
    if (td.door) return 1; // we open doors
    if (td.unbreakable || td.multi || td.chest) return Infinity;
    if (Bot.isProtected(x, y)) return Infinity; // never dig through our own house
    if (td.minPick > this.power) return Infinity;
    // blocks holding up objects/trees can't be mined
    const above = TILES[w.tile(x, y - 1)];
    if (above && ((above.multi && !above.door) || above.tree || above.cactus)) return Infinity;
    if (this.nearLava(x, y)) return Infinity;
    return 3 + td.hp / Math.max(20, this.power) * 1.5;
  },
  standable(x, y) {
    const w = G.world;
    const s = (i) => { const t = w.tile(i, y + 1); return TILES[t]?.solid || t === T.PLATFORM; };
    return s(x) || s(x + 1);
  },
  wet(x, y) { const w = G.world; return w.liq(x, y) > 100 || w.liq(x + 1, y) > 100 || w.liq(x, y - 1) > 100; },
  // cost to have the body at (x,y) with the given extra rows; returns [cost, digList]
  space(x, y, rowsUp = 2, rowsDown = 0) {
    let cost = 0; const digs = [];
    for (let yy = y - rowsUp; yy <= y + rowsDown; yy++) for (let xx = x; xx <= x + 1; xx++) {
      const c = this.cellCost(xx, yy);
      if (c === Infinity) return [Infinity, null];
      if (c > 1) { cost += c; digs.push([xx, yy]); }
      else cost += c;
    }
    return [cost, digs];
  },

  // ----- A* -----
  plan(sx, sy, goalFn, heur, maxNodes = 16000) {
    this.power = this.pickPower();
    this.blocks = G.player.inv.reduce((n, s) => n + (s && ['dirt_block', 'stone_block', 'wood', 'mud_block', 'clay_block', 'sand_block', 'ash_block'].includes(s.id) ? s.count : 0), 0);
    const key = (x, y) => y * 65536 + x;
    // binary min-heap of [f, cost, x, y]
    const heap = [];
    const hpush = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (heap[pi][0] <= e[0]) break; heap[i] = heap[pi]; i = pi; } heap[i] = e; };
    const hpop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; const n = heap.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[i] = heap[c]; i = c; } heap[i] = last; } return top; };
    const W = 2.5; // weighted A*: greedy toward the goal (dig costs make the plain heuristic far too optimistic)
    hpush([heur(sx, sy) * W, 0, sx, sy]);
    const open = heap;
    const g = new Map([[key(sx, sy), 0]]), from = new Map();
    let expanded = 0, best = null, bestH = Infinity;
    const push = (x, y, cost, prevK, move) => {
      const k = key(x, y);
      if (g.has(k) && g.get(k) <= cost) return;
      g.set(k, cost); from.set(k, [prevK, move]);
      hpush([cost + heur(x, y) * W, cost, x, y]);
    };
    while (open.length && expanded < maxNodes) {
      const [f, cost, x, y] = hpop();
      const k = key(x, y);
      if (cost > g.get(k)) continue;
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
        if (c < Infinity && hc < Infinity && (this.standable(x + dx, y - 1) || inWater)) push(x + dx, y - 1, cost + 1.5 + c + hc, k, { t: 'up', digs: hd.concat(d) });
        // drop off a ledge (no digging, up to a safe height)
        const [c0] = this.space(x + dx, y);
        if (c0 === 0 && !this.standable(x + dx, y)) {
          for (let k2 = 1; k2 <= 18; k2++) {
            const [cc] = this.space(x + dx, y + k2, 0, 0);
            if (cc !== 0) break;
            if (this.standable(x + dx, y + k2) || this.wet(x + dx, y + k2)) { push(x + dx, y + k2, cost + 1 + k2 * 0.3, k, { t: 'drop', digs: [] }); break; }
          }
        }
        // jump up 2..4 onto a ledge (column above us must be clear)
        for (let j = 2; j <= 4; j++) {
          const [col] = this.space(x, y - 3, j - 1, 0); // rows y-2-j .. y-3: the air we rise through
          if (col !== 0) break;
          const [tc] = this.space(x + dx, y - j);
          if (tc === 0 && this.standable(x + dx, y - j)) { push(x + dx, y - j, cost + 1 + j * 1.2, k, { t: 'jump', digs: [] }); break; }
        }
      }
      // dig straight down one row
      {
        const [c, d] = this.space(x, y + 1, 0, 0);
        if (c < Infinity && c > 0) push(x, y + 1, cost + 1 + c, k, { t: 'down', digs: d });
        else if (c === 0 && !this.standable(x, y)) push(x, y + 1, cost + 0.5, k, { t: 'fall', digs: [] });
      }
      // climb straight up: swim, or pillar with blocks
      {
        const [c, d] = this.space(x, y - 3, 0, 0);
        if (c < Infinity && inWater) push(x, y - 1, cost + 1.5 + c, k, { t: 'swim', digs: d });
        else if (c < Infinity && this.blocks > 3 && this.standable(x, y)) push(x, y - 1, cost + 4 + c, k, { t: 'pillar', digs: d });
      }
    }
    if (best == null) return null;
    // rebuild
    const path = [];
    let k = best;
    while (from.has(k)) { const [pk, move] = from.get(k); path.push({ x: k % 65536, y: Math.floor(k / 65536), move }); k = pk; }
    path.reverse();
    return { path, reached: goalFn(best % 65536, Math.floor(best / 65536)), expanded };
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
    const ng = this.nav;
    const needPlan = !ng || Math.abs(ng.tx - tx) > 2 || Math.abs(ng.ty - ty) > 2 || ng.tol !== tol || ng.replan || (G.tick - ng.at > 900);
    if (needPlan) {
      if (ng && ng.cooldown > G.tick && Math.abs(ng.tx - tx) <= 2 && Math.abs(ng.ty - ty) <= 2) { this.nav.replan = false; }
      else {
        const heur = (x, y) => Math.abs(x + 0.5 - tx) + Math.abs(y - ty) * 1.3;
        const res = Nav.plan(nx, ny, goalFn, heur);
        this.navFails = res && res.path.length ? 0 : (this.navFails || 0) + 1;
        if (!res || !res.path.length) { this.nav = { tx, ty, tol, at: G.tick, path: [], i: 0, cooldown: G.tick + 60 }; if (this.navFails > 3) { this.navFails = 0; return 'fail'; } return false; }
        this.nav = { tx, ty, tol, at: G.tick, path: res.path, i: 0, partial: !res.reached, lastProgress: G.tick, cooldown: G.tick + 30 };
      }
    }
    return this.followPath();
  },
  followPath() {
    const p = G.player, w = G.world, nav = this.nav;
    if (!nav || !nav.path.length) return false;
    const [nx, ny] = Nav.nodeOf(p);
    const settled = p.onGround || p.wet;
    // a path that doesn't start next to us is stale (respawned, knocked back, fell): plan again
    if (nav.i === 0 && settled && (Math.abs(nav.path[0].x - nx) > 2 || Math.abs(nav.path[0].y - ny) > 5)) { nav.replan = true; nav.cooldown = 0; return false; }
    // resync: find where we are on the path (we may have skipped ahead or fallen off)
    let found = -1;
    for (let j = Math.max(0, nav.i - 2); j < Math.min(nav.path.length, nav.i + 8); j++) {
      const q = nav.path[j];
      if (Math.abs(p.cx - (q.x * TS + 16)) < 9 && q.y === ny) found = j;
    }
    if (found >= nav.i - 1 && found >= 0 && settled) { if (found + 1 > nav.i) nav.lastProgress = G.tick; nav.i = found + 1; }
    else if (found < 0 && settled && nav.i > 0) {
      const prev = nav.path[nav.i - 1];
      if (!prev || Math.abs(p.cx - (prev.x * TS + 16)) > 20 || prev.y !== ny) { nav.offPath = (nav.offPath || 0) + 1; if (nav.offPath > 20) { nav.replan = true; nav.cooldown = 0; return false; } }
    }
    if (nav.i >= nav.path.length) { nav.replan = true; nav.cooldown = 0; return nav.partial ? false : false; }
    if (G.tick - nav.lastProgress > 300) { nav.replan = true; nav.cooldown = 0; this.stuckReplans = (this.stuckReplans || 0) + 1; if (this.stuckReplans > 5) { this.stuckReplans = 0; return 'fail'; } return false; }
    const n = nav.path[nav.i], m = n.move;
    // 1) dig whatever blocks the next step
    for (const [dx, dy] of m.digs || []) {
      const t = w.tile(dx, dy);
      if (t && TILES[t].solid) {
        if (TILES[t].door) { if (t === T.DOOR_CLOSED) this.rightClickWorld(dx, dy); continue; }
        if (!p.inReach(dx, dy)) break;
        if (this.dig(dx, dy) === 'fail') { nav.replan = true; nav.cooldown = 0; }
        return false;
      }
    }
    for (let j = 0; j < 3; j++) for (const xx of [n.x, n.x + 1]) if (w.tile(xx, n.y - j) === T.DOOR_CLOSED) { this.rightClickWorld(xx, n.y - j); return false; }
    // 2) move the body there
    const targetCx = n.x * TS + 16, dxp = targetCx - p.cx;
    if (m.t === 'pillar') {
      if (Math.abs(dxp) > 5) { this.hold(dxp > 0 ? 'd' : 'a'); return false; }
      const bs = this.slotOf(it => ['dirt_block', 'stone_block', 'wood', 'mud_block', 'clay_block', 'sand_block', 'ash_block'].includes(it.id));
      if (bs < 0) { nav.replan = true; return false; }
      if (bs > 9) { this.ensureHotbar(bs); return false; }
      this.selectSlot(bs);
      if (p.onGround) this.hold(' ');
      else if (p.vy > -1 && p.y + p.h < (n.y + 1) * TS - 1) { this.aimTile(Math.floor(p.cx / TS), n.y + 1); this.clickOnce(); }
      else this.hold(' ');
      return false;
    }
    if (Math.abs(dxp) > 2) this.hold(dxp > 0 ? 'd' : 'a');
    if (n.y < ny || m.t === 'jump' || m.t === 'swim') {
      if (p.onGround || p.wet || p.vy < 0) this.hold(' ');
    }
    // walking into a wall we expected to step up: hop
    if (p.collidedX && p.onGround) this.hold(' ');
    return false;
  },
});
