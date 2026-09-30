// ---------- Terraria-style colored lighting (4-directional sweep propagation) ----------
const Light = {
  x0: 0, y0: 0, w: 0, h: 0, r: null, g: null, b: null, dec: null, canvas: null, ctx: null, img: null,
  sky: [1, 1, 1], ambientBoost: 0,
  ensure(w, h) {
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h;
    const n = w * h;
    this.r = new Float32Array(n); this.g = new Float32Array(n); this.b = new Float32Array(n);
    this.decR = new Float32Array(n); this.decG = new Float32Array(n); this.decB = new Float32Array(n);
    this.canvas = makeCanvas(w, h); this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
  },
  // compute light for tile rect [tx0,ty0]..[tx1,ty1] (+margin), with dynamic point lights [{x,y,r,g,b}] in pixels
  compute(world, tx0, ty0, tx1, ty1, dyn) {
    const M = 18;
    const x0 = Math.max(0, tx0 - M), y0 = Math.max(0, ty0 - M);
    const x1 = Math.min(world.w - 1, tx1 + M), y1 = Math.min(world.h - 1, ty1 + M);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    this.ensure(w, h);
    this.x0 = x0; this.y0 = y0;
    const { r, g, b, decR, decG, decB } = this;
    const [sr, sg, sb] = this.sky;
    const WS = world.worldSurface, HL = world.hellLayer, W_ = world.w;
    const amb = this.ambientBoost;
    for (let y = 0; y < h; y++) {
      const wy = y + y0;
      let row = wy * W_ + x0;
      for (let x = 0; x < w; x++, row++) {
        const k = y * w + x;
        const t = world.tiles[row], td = TILES[t];
        const solid = td && td.solid && !td.transparent;
        let lr = amb, lg = amb, lb = amb;
        if (!solid && world.walls[row] === 0 && wy < WS) { lr = sr; lg = sg; lb = sb; }
        else if (!solid && wy < WS + 2 && world.walls[row] !== 0 && wy < world.surface[x + x0] + 2) { lr = sr * 0.7; lg = sg * 0.7; lb = sb * 0.7; } // walls near surface still get a little
        if (td && td.light && !(td.flicker && (world.frames[row] === 1 || flickerOff(x + x0, wy)))) { const L = td.light; if (L[0] > lr) lr = L[0]; if (L[1] > lg) lg = L[1]; if (L[2] > lb) lb = L[2]; }
        const liq = world.liquid[row];
        if (liq && world.ltype[row] === 1) { lr = Math.max(lr, 0.95); lg = Math.max(lg, 0.45); lb = Math.max(lb, 0.15); }
        if (wy >= HL && !solid) { lr = Math.max(lr, 0.32); lg = Math.max(lg, 0.16); lb = Math.max(lb, 0.08); }
        r[k] = lr; g[k] = lg; b[k] = lb;
        if (solid) { decR[k] = 0.6; decG[k] = 0.6; decB[k] = 0.6; }
        else if (liq > 128 && world.ltype[row] === 0) { decR[k] = 0.8; decG[k] = 0.87; decB[k] = 0.92; }
        else { decR[k] = 0.91; decG[k] = 0.91; decB[k] = 0.91; }
      }
    }
    for (const L of dyn) {
      const lx = Math.floor(L.x / TS) - x0, ly = Math.floor(L.y / TS) - y0;
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
      const k = ly * w + lx;
      if (L.r > r[k]) r[k] = L.r; if (L.g > g[k]) g[k] = L.g; if (L.b > b[k]) b[k] = L.b;
    }
    for (let pass = 0; pass < 2; pass++) {
      this.sweep(r, decR, w, h); this.sweep(g, decG, w, h); this.sweep(b, decB, w, h);
    }
  },
  sweep(L, D, w, h) {
    // horizontal
    for (let y = 0; y < h; y++) {
      let base = y * w, cur = 0;
      for (let x = 0; x < w; x++) { const k = base + x; if (L[k] < cur) L[k] = cur; cur = L[k] * D[k]; }
      cur = 0;
      for (let x = w - 1; x >= 0; x--) { const k = base + x; if (L[k] < cur) L[k] = cur; cur = L[k] * D[k]; }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      let cur = 0;
      for (let y = 0; y < h; y++) { const k = y * w + x; if (L[k] < cur) L[k] = cur; cur = L[k] * D[k]; }
      cur = 0;
      for (let y = h - 1; y >= 0; y--) { const k = y * w + x; if (L[k] < cur) L[k] = cur; cur = L[k] * D[k]; }
    }
  },
  at(tx, ty) {
    const x = tx - this.x0, y = ty - this.y0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    const k = y * this.w + x;
    return Math.max(this.r[k], this.g[k], this.b[k]);
  },
  // draw the light map over the world with multiply blending
  draw(ctx, camX, camY) {
    const d = this.img.data, n = this.w * this.h;
    const { r, g, b } = this;
    for (let k = 0, p = 0; k < n; k++, p += 4) {
      d[p] = r[k] >= 1 ? 255 : r[k] * 255; d[p + 1] = g[k] >= 1 ? 255 : g[k] * 255; d[p + 2] = b[k] >= 1 ? 255 : b[k] * 255; d[p + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = SETTINGS.smoothLight;
    ctx.drawImage(this.canvas, Math.round(this.x0 * TS - camX), Math.round(this.y0 * TS - camY), this.w * TS, this.h * TS);
    ctx.restore();
  },
};
