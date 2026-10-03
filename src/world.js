// ---------- world storage + tile manipulation ----------
// frames[] meaning: multi-tile objects store (fx | fy<<4) = offset from origin (top-left).
// trees store type (0 trunk, 1 top, 2 branch L, 3 branch R, 4 base) | style<<4 (0 forest,1 snow,2 brainrot)
const TREE_TRUNK = 0, TREE_TOP = 1, TREE_BL = 2, TREE_BR = 3, TREE_BASE = 4;

class World {
  constructor(w, h, seed, name) {
    this.w = w; this.h = h; this.seed = seed; this.name = name;
    const n = w * h;
    this.tiles = new Uint8Array(n);
    this.walls = new Uint8Array(n);
    this.frames = new Uint8Array(n);
    this.liquid = new Uint8Array(n);   // 0..255 amount
    this.ltype = new Uint8Array(n);    // 0 water, 1 lava
    this.explored = new Uint8Array(n); // map fog of war
    this.chests = {};                  // "x,y" of origin -> array of 40 slots
    this.damage = new Map();           // tile index -> {d, t}
    this.surface = new Int16Array(w);
    this.worldSurface = Math.floor(h * 0.3);
    this.rockLayer = Math.floor(h * 0.4);
    this.hellLayer = h - 100;
    this.spawnX = w >> 1; this.spawnY = 100;
    this.time = 13500;  // ticks since 4:30am (Terraria: day = 54000 ticks, night = 32400)
    this.dayTime = true;
    this.day = 0;
    this.flags = { king_slime: false, eye_of_cthulhu: false, tung_sahur: false, wall_of_flesh: false, hardmode: false, bloodMoon: false, merchantShown: false };
    this.townNPCs = [];                // saved town npc records
    this.mapDirty = true;
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : T.STONE; }
  wall(x, y) { return this.inb(x, y) ? this.walls[y * this.w + x] : 0; }
  frame(x, y) { return this.inb(x, y) ? this.frames[y * this.w + x] : 0; }
  liq(x, y) { return this.inb(x, y) ? this.liquid[y * this.w + x] : 0; }
  solid(x, y) { if (!this.inb(x, y)) return true; return TILES[this.tiles[y * this.w + x]]?.solid || false; }
  isPlatform(x, y) { return this.inb(x, y) && this.tiles[y * this.w + x] === T.PLATFORM; }
  empty(x, y) { return this.inb(x, y) && this.tiles[y * this.w + x] === 0; }
  setTile(x, y, id, frame = 0) {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x;
    this.tiles[i] = id; this.frames[i] = frame;
    if (id && TILES[id].solid) this.liquid[i] = 0;
    this.mapDirty = true;
    if (typeof onTileChanged === 'function') onTileChanged(x, y);
    if (Net.active && !Net.applying && G.world === this) Net.queueTile(x, y);
  }
  setWall(x, y, id) {
    if (!this.inb(x, y)) return;
    this.walls[y * this.w + x] = id; this.mapDirty = true;
    if (Net.active && !Net.applying && G.world === this) Net.queueTile(x, y);
  }

  // ----- multi-tile objects -----
  objOrigin(x, y) {
    const id = this.tile(x, y), t = TILES[id];
    if (!t || !t.multi) return [x, y];
    const f = this.frame(x, y);
    return [x - (f & 15), y - (f >> 4)];
  }
  canPlaceObject(x, y, id) {
    const t = TILES[id];
    const [w, h] = t.multi || [1, 1];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inb(tx, ty)) return false;
      const cur = this.tile(tx, ty);
      if (cur !== 0 && !(TILES[cur].cut)) return false;
      if (this.liq(tx, ty) > 60 && this.ltype[this.idx(tx, ty)] === 1) return false;
    }
    if (t.torch) return this.solid(x, y + 1) || this.solid(x - 1, y) || this.solid(x + 1, y) || this.wall(x, y) > 0;
    if (id === T.PLATFORM) return true;
    // needs solid (or platform/table top) floor under whole width
    for (let i = 0; i < w; i++) {
      const b = this.tile(x + i, y + h);
      if (!(TILES[b]?.solid || b === T.PLATFORM || (TILES[b]?.table && id !== T.TABLE && (id === T.CANDLE || id === T.BOTTLE)))) return false;
    }
    return true;
  }
  placeObject(x, y, id, flip = 0) {
    const t = TILES[id];
    const [w, h] = t.multi || [1, 1];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setTile(x + i, y + j, id, t.multi ? (i | (j << 4)) : flip);
    if (t.chest && !this.chests[x + ',' + y]) this.chests[x + ',' + y] = new Array(40).fill(null);
    if (flip && t.multi) this.flipMap = this.flipMap || {}, this.flipMap[x + ',' + y] = 1;
  }
  isFlipped(ox, oy) { return !!(this.flipMap && this.flipMap[ox + ',' + oy]); }
  removeObject(x, y, drop = true) {
    const id = this.tile(x, y), t = TILES[id];
    const [ox, oy] = this.objOrigin(x, y);
    const [w, h] = t.multi || [1, 1];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.tile(ox + i, oy + j) === id || (t.door && TILES[this.tile(ox + i, oy + j)]?.door)) this.setTile(ox + i, oy + j, 0, 0);
    if (this.flipMap) delete this.flipMap[ox + ',' + oy];
    if (drop && t.drop) G.dropItem((ox + w / 2) * TS, (oy + h / 2) * TS, t.drop, 1);
    return [ox, oy, w, h];
  }

  // ----- trees -----
  treeType(x, y) { return this.frame(x, y) & 15; }
  treeStyle(x, y) { return this.frame(x, y) >> 4; }
  growTree(x, y, rng = Math.random, minH = 6, maxH = 16) {
    // (x,y) = the ground block under the tree
    const ground = this.tile(x, y);
    if (!(ground === T.GRASS || ground === T.CORRUPT_GRASS || ground === T.SNOW)) return false;
    const style = ground === T.SNOW ? 1 : ground === T.CORRUPT_GRASS ? 2 : 0;
    const h = randInt(minH, maxH, rng);
    for (let j = 1; j <= h + 3; j++) if (!this.empty(x, y - j) && this.tile(x, y - j) !== T.PLANT) return false;
    if (this.tile(x - 1, y - 1) === T.TREE || this.tile(x + 1, y - 1) === T.TREE || this.tile(x - 2, y - 1) === T.TREE || this.tile(x + 2, y - 1) === T.TREE) return false;
    for (let j = 1; j <= h; j++) {
      let type = TREE_TRUNK;
      if (j === 1) type = TREE_BASE;
      else if (j === h) type = TREE_TOP;
      else if (j > 2 && j < h - 1 && rng() < 0.18) type = rng() < 0.5 ? TREE_BL : TREE_BR;
      this.setTile(x, y - j, T.TREE, type | (style << 4));
    }
    return true;
  }
  // chop tree from (x,y) upwards; returns # wood
  chopTree(x, y) {
    let top = y;
    while (this.tile(x, top - 1) === T.TREE) top--;
    let n = 0, hadTop = false;
    for (let j = y; j >= top; j--) {
      if (this.treeType(x, j) === TREE_TOP) hadTop = true;
      this.setTile(x, j, 0); n++;
    }
    // if we chopped the base, remove anything under
    const wood = n + (hadTop ? 2 : 0);
    G.dropItem(x * TS + 8, (y - 1) * TS, 'wood', wood);
    if (hadTop && Math.random() < 0.7) G.dropItem(x * TS + 8, top * TS, 'acorn', randInt(1, 2));
    return wood;
  }

  // ----- breaking / placing via player -----
  // returns true if the tile broke
  hitTile(x, y, power, toolKind) {
    const id = this.tile(x, y);
    if (!id) return false;
    const t = TILES[id];
    if (t.unbreakable) return false;
    if (t.tree || t.cactus) { if (toolKind !== 'axe') return false; }
    else if (t.needHammer) { if (toolKind !== 'hammer') return false; }
    else if (toolKind === 'axe' || toolKind === 'hammer') { if (!t.anyTool) return false; }
    else if (toolKind === 'pick' && t.minPick > power) { G.popText(x * TS + 8, y * TS, 'Needs a stronger pickaxe (' + t.minPick + '%)', '#ff8080', 60); return false; }
    // cannot mine blocks directly below a chest/tree etc.
    if (t.solid && (TILES[this.tile(x, y - 1)]?.multi && !TILES[this.tile(x, y - 1)]?.door) && this.tile(x, y - 1) !== id) return false;
    if (t.solid && this.tile(x, y - 1) === T.TREE) return false;
    const i = this.idx(x, y);
    const hp = t.hp;
    let dmg = t.anyTool && !t.tree ? hp : power * (hp <= 50 ? 2 : 1);
    if (t.pot || t.orb) dmg = hp;
    const cur = this.damage.get(i) || { d: 0, t: 0 };
    cur.d += dmg; cur.t = 0;
    playTileSound(t);
    spawnTileDust(x, y, id, 3);
    if (cur.d >= hp) {
      this.damage.delete(i);
      this.breakTile(x, y, true);
      return true;
    }
    this.damage.set(i, cur);
    return false;
  }
  breakTile(x, y, byPlayer) {
    const id = this.tile(x, y);
    if (!id) return;
    const t = TILES[id];
    spawnTileDust(x, y, id, 8);
    if (t.tree) {
      const wood = this.chopTree(x, y);
      if (byPlayer) G.achieve('timber');
      return;
    }
    if (t.cactus) {
      let top = y; while (this.tile(x, top - 1) === T.CACTUS) top--;
      let n = 0; for (let j = y; j >= top; j--) { this.setTile(x, j, 0); n++; }
      G.dropItem(x * TS + 8, y * TS, 'cactus', n);
      return;
    }
    if (t.chest) {
      const [ox, oy] = this.objOrigin(x, y);
      const inv = this.chests[ox + ',' + oy];
      if (inv && inv.some(s => s)) { G.popText(x * TS, y * TS, 'Chest is not empty', '#ff8080'); return; }
      delete this.chests[ox + ',' + oy];
    }
    if (t.pot) { const [ox, oy] = this.removeObject(x, y, false); G.potLoot((ox + 1) * TS, (oy + 1) * TS, oy); playSound('shatter'); return; }
    if (t.orb) { const [ox, oy] = this.removeObject(x, y, false); G.orbLoot((ox + 1) * TS, (oy + 1) * TS); return; }
    if (t.multi) { this.removeObject(x, y, true); return; }
    this.setTile(x, y, 0, 0);
    if (t.drop) {
      G.dropItem(x * TS + 8, y * TS + 8, t.drop, 1);
    }
    if (byPlayer && t.ore) G.achieve('ooo_shiny');
    if (id === T.HELLSTONE && Math.random() < 0.5) { const i = this.idx(x, y); this.liquid[i] = 110; this.ltype[i] = 1; G.liquidWake(x, y); Net.sendLiquid(i); }
    // things resting on top fall off
    this.checkSupport(x, y - 1);
    this.checkSupport(x - 1, y); this.checkSupport(x + 1, y);
    this.checkSupport(x, y + 1);
    if (TILES[this.tile(x, y - 1)]?.falls) G.sandFall(x, y - 1);
    G.liquidWake(x, y);
  }
  // remove objects that lost their anchor
  checkSupport(x, y) {
    const id = this.tile(x, y);
    if (!id) return;
    const t = TILES[id];
    if (t.tree) { if (this.treeType(x, y) === TREE_BASE && !this.solid(x, y + 1)) this.breakTile(x, y, false); return; }
    if (t.cactus) { if (!this.solid(x, y + 1) && this.tile(x, y + 1) !== T.CACTUS) this.breakTile(x, y, false); return; }
    if (t.torch) { if (!(this.solid(x, y + 1) || this.solid(x - 1, y) || this.solid(x + 1, y) || this.wall(x, y))) this.breakTile(x, y, false); return; }
    if (t.plant || t.cut || (id === T.CANDLE || id === T.BOTTLE)) {
      const b = this.tile(x, y + 1);
      if (!(TILES[b]?.solid || TILES[b]?.table)) this.breakTile(x, y, false);
      return;
    }
    if (t.multi) {
      const [ox, oy] = this.objOrigin(x, y);
      const [w, h] = t.multi;
      let ok = false;
      for (let i = 0; i < w; i++) { const b = this.tile(ox + i, oy + h); if (TILES[b]?.solid || b === T.PLATFORM) ok = true; }
      if (t.door) ok = this.solid(ox, oy - 1) || this.solid(ox, oy + h);
      if (!ok && !t.unbreakable) this.breakTile(ox, oy, false);
    }
  }
  placeTile(x, y, id) {
    const t = TILES[id];
    if (t.multi || t.torch || id === T.CANDLE || id === T.BOTTLE || id === T.MUSHROOM) {
      let ox = x, oy = y;
      if (t.multi) { ox = x - Math.floor((t.multi[0] - 1) / 2); oy = y - (t.multi[1] - 1); }
      if (!this.canPlaceObject(ox, oy, id)) return false;
      this.placeObject(ox, oy, id, t.flip && G.player && G.player.dir < 0 ? 1 : 0);
      return true;
    }
    if (id === T.TREE) { // acorn
      if (!this.empty(x, y)) return false;
      const g = this.tile(x, y + 1);
      if (!(g === T.GRASS || g === T.CORRUPT_GRASS || g === T.SNOW)) return false;
      return this.growTree(x, y + 1, Math.random, 5, 10);
    }
    // rope: clicking a rope adds to its bottom end; a new one hangs from a block or rope right above it
    if (id === T.ROPE) {
      if (this.tile(x, y) === T.ROPE) { while (this.tile(x, y) === T.ROPE && y < this.h - 1) y++; }
      const c = this.tile(x, y), above = this.tile(x, y - 1);
      if ((c && !TILES[c].cut) || !(above === T.ROPE || TILES[above]?.solid || above === T.PLATFORM)) return false;
      if (c) this.setTile(x, y, 0);
      this.setTile(x, y, T.ROPE);
      return true;
    }
    const cur = this.tile(x, y);
    if (cur && !TILES[cur].cut) return false;
    // need an adjacent tile or wall to attach to
    if (!(this.tile(x - 1, y) || this.tile(x + 1, y) || this.tile(x, y - 1) || this.tile(x, y + 1) || this.wall(x, y))) return false;
    if (cur) this.setTile(x, y, 0);
    this.setTile(x, y, id);
    if (t.falls) G.sandFall(x, y);
    return true;
  }
  toggleDoor(x, y) {
    const id = this.tile(x, y);
    if (!TILES[id]?.door) return false;
    const [ox, oy] = this.objOrigin(x, y);
    const nid = id === T.DOOR_CLOSED ? T.DOOR_OPEN : T.DOOR_CLOSED;
    if (nid === T.DOOR_CLOSED) {
      // don't close on entities
      const r = { x: ox * TS, y: oy * TS, w: TS, h: 3 * TS };
      if (G.player && rectsOverlap(r, G.player)) return false;
    }
    for (let j = 0; j < 3; j++) this.setTile(ox, oy + j, nid, j << 4);
    playSound(nid === T.DOOR_OPEN ? 'door_open' : 'door_close');
    return true;
  }
  // mining walls with a hammer
  hitWall(x, y, power) {
    const w = this.wall(x, y);
    if (!w) return false;
    // walls can only be hammered if exposed (an adjacent tile has no wall or tile is air)
    if (this.tile(x, y) && TILES[this.tile(x, y)].solid) return false;
    const i = this.idx(x, y);
    const cur = this.damage.get(-1 - i) || { d: 0, t: 0 };
    cur.d += power; cur.t = 0;
    playSound('dig');
    if (cur.d >= 70) {
      this.damage.delete(-1 - i);
      this.setWall(x, y, 0);
      const wd = WALLS[w];
      if (wd.drop) G.dropItem(x * TS + 8, y * TS + 8, wd.drop, 1);
      spawnTileDust(x, y, T.DIRT, 5);
      return true;
    }
    this.damage.set(-1 - i, cur);
    return false;
  }
}
