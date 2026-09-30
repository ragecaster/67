// ---------- persistence (IndexedDB: typed arrays are stored natively) ----------
const Save = {
  db: null, mem: { players: {}, worlds: {} },
  open() {
    return new Promise(res => {
      try {
        const req = indexedDB.open('terrari67', 1);
        req.onupgradeneeded = () => { const db = req.result; db.createObjectStore('players'); db.createObjectStore('worlds'); db.createObjectStore('meta'); };
        req.onsuccess = () => { this.db = req.result; res(); };
        req.onerror = () => { console.warn('IndexedDB unavailable, saves are in-memory only'); res(); };
      } catch (e) { res(); }
    });
  },
  _tx(store, mode, fn) {
    if (!this.db) return Promise.resolve(fn(null));
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, mode), st = tx.objectStore(store);
      const r = fn(st);
      tx.oncomplete = () => res(r && r.result !== undefined ? r.result : r);
      tx.onerror = () => rej(tx.error);
    });
  },
  put(store, key, val) { if (!this.db) { this.mem[store][key] = val; return Promise.resolve(); } return this._tx(store, 'readwrite', st => st.put(val, key)); },
  get(store, key) {
    if (!this.db) return Promise.resolve(this.mem[store][key]);
    return new Promise(res => { const tx = this.db.transaction(store, 'readonly'); const r = tx.objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
  },
  del(store, key) { if (!this.db) { delete this.mem[store][key]; return Promise.resolve(); } return this._tx(store, 'readwrite', st => st.delete(key)); },
  list(store) {
    if (!this.db) return Promise.resolve(Object.values(this.mem[store]).map(v => v.summary || v));
    return new Promise(res => {
      const out = [];
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push(c.value.summary ? Object.assign({ key: c.key }, c.value.summary) : Object.assign({ key: c.key }, c.value)); c.continue(); } else res(out); };
      req.onerror = () => res(out);
    });
  },

  // ----- players -----
  serializePlayer(p) {
    return {
      name: p.name, look: p.look, difficulty: p.difficulty, lifeMax: p.lifeMax, life: p.life, manaMaxBase: p.manaMaxBase,
      inv: p.inv, armor: p.armor, acc: p.acc, piggy: p.piggy, trash: p.trash, achievements: p.achievements, stats: p.stats,
      beds: p.beds || {}, pet: !!p.buffs.labubu, created: p.created || Date.now(), played: Date.now(),
    };
  },
  loadPlayer(d) {
    const p = new Player(d.name, d.look, d.difficulty);
    Object.assign(p, { lifeMax: d.lifeMax, life: d.life || d.lifeMax, manaMaxBase: d.manaMaxBase, inv: d.inv, armor: d.armor, acc: d.acc, piggy: d.piggy || new Array(40).fill(null), trash: d.trash, achievements: d.achievements || {}, stats: d.stats || p.stats, beds: d.beds || {}, created: d.created });
    if (d.pet) p.buffs.labubu = 1;
    return p;
  },
  savePlayer(p) { return this.put('players', p.name, this.serializePlayer(p)); },

  // ----- worlds -----
  serializeWorld(w) {
    return {
      summary: { name: w.name, size: w.w + 'x' + w.h, seed: w.seedStr, hardmode: w.flags.hardmode, played: Date.now(), day: w.day },
      meta: {
        name: w.name, seed: w.seed, seedStr: w.seedStr, w: w.w, h: w.h, worldSurface: w.worldSurface, rockLayer: w.rockLayer, hellLayer: w.hellLayer,
        spawnX: w.spawnX, spawnY: w.spawnY, time: w.time, dayTime: w.dayTime, day: w.day, flags: w.flags, biomes: w.biomes,
      },
      tiles: w.tiles, walls: w.walls, frames: w.frames, liquid: w.liquid, ltype: w.ltype, explored: w.explored, surface: w.surface,
      chests: w.chests, flipMap: w.flipMap || {},
      townNPCs: G.npcs.filter(n => n.town).map(n => ({ type: n.type, name: n.name, shortName: n.shortName, home: n.home, x: n.x, y: n.y, life: n.life })),
    };
  },
  loadWorld(d) {
    const m = d.meta;
    const w = new World(m.w, m.h, m.seed, m.name);
    Object.assign(w, { seedStr: m.seedStr, worldSurface: m.worldSurface, rockLayer: m.rockLayer, hellLayer: m.hellLayer, spawnX: m.spawnX, spawnY: m.spawnY, time: m.time, dayTime: m.dayTime, day: m.day, flags: Object.assign(w.flags, m.flags), biomes: m.biomes });
    w.tiles = d.tiles; w.walls = d.walls; w.frames = d.frames; w.liquid = d.liquid; w.ltype = d.ltype; w.explored = d.explored; w.surface = d.surface;
    w.chests = d.chests || {}; w.flipMap = d.flipMap || {};
    w.townNPCs = d.townNPCs || [];
    return w;
  },
  saveWorld(w) { return this.put('worlds', w.name, this.serializeWorld(w)); },
};
