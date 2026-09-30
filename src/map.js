// ---------- world map (fog of war), minimap and fullscreen map ----------
const WorldMap = {
  canvas: null, ctx: null, img: null, world: null, dirty: false, open: false, zoom: 1, panX: 0, panY: 0, dragging: null,
  init(world) {
    this.world = world;
    this.canvas = makeCanvas(world.w, world.h);
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(world.w, world.h);
    this.colorCache = {};
    for (let i = 0; i < world.w * world.h; i++) if (world.explored[i]) this.paint(i);
    this.ctx.putImageData(this.img, 0, 0);
  },
  colorOf(i) {
    const w = this.world, t = w.tiles[i];
    if (t && TILES[t].mapColor) return TILES[t].mapColor;
    if (w.liquid[i] > 30) return w.ltype[i] ? '#ff6a1a' : '#2f6fd0';
    if (w.walls[i]) return WALLS[w.walls[i]].mapColor;
    const y = (i / w.w) | 0;
    if (y < w.worldSurface) return '#84aee8';
    if (y < w.rockLayer) return '#3a2a1c';
    if (y < w.hellLayer) return '#26222a';
    return '#3a100a';
  },
  paint(i) {
    const c = this.colorOf(i);
    let rgbv = this.colorCache[c];
    if (!rgbv) rgbv = this.colorCache[c] = hexToRgb(c);
    const p = i * 4, d = this.img.data;
    d[p] = rgbv[0]; d[p + 1] = rgbv[1]; d[p + 2] = rgbv[2]; d[p + 3] = 255;
  },
  // reveal tiles that are lit in the current light region
  reveal() {
    const w = this.world, L = Light;
    let changed = false;
    for (let y = 0; y < L.h; y += 1) {
      const wy = y + L.y0;
      for (let x = 0; x < L.w; x += 1) {
        const k = y * L.w + x;
        if (L.r[k] + L.g[k] + L.b[k] < 0.12) continue;
        const i = wy * w.w + x + L.x0;
        if (!w.explored[i]) { w.explored[i] = 1; this.paint(i); changed = true; }
      }
    }
    if (changed) this.dirty = true;
  },
  tileChanged(x, y) {
    const i = y * this.world.w + x;
    if (this.world.explored[i]) { this.paint(i); this.dirty = true; }
  },
  flush() { if (this.dirty) { this.ctx.putImageData(this.img, 0, 0); this.dirty = false; } },

  drawMini(ctx, x, y, w, h) {
    this.flush();
    const p = G.player, s = 2;
    const sx = Math.floor(p.cx / TS - w / s / 2), sy = Math.floor(p.cy / TS - h / s / 2);
    ctx.save();
    ctx.fillStyle = '#0a0f1e'; ctx.fillRect(x, y, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, sx, sy, w / s, h / s, x, y, w, h);
    // npcs + player
    for (const n of G.npcs) {
      if (!(n.town || n.boss)) continue;
      const nx = x + (n.cx / TS - sx) * s, ny = y + (n.cy / TS - sy) * s;
      if (nx < x || ny < y || nx > x + w || ny > y + h) continue;
      ctx.fillStyle = n.boss ? '#ff3a3a' : '#32ff82'; ctx.fillRect(nx - 2, ny - 2, 5, 5);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w / 2 - 3, y + h / 2 - 3, 6, 6);
    ctx.fillStyle = p.look.hair; ctx.fillRect(x + w / 2 - 2, y + h / 2 - 2, 4, 4);
    ctx.strokeStyle = '#c8a24a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.restore();
  },
  drawFull(ctx, vw, vh) {
    this.flush();
    const w = this.world;
    ctx.fillStyle = 'rgba(5,8,20,0.92)'; ctx.fillRect(0, 0, vw, vh);
    const baseScale = Math.min(vw / w.w, vh / w.h) * 0.95;
    const s = baseScale * this.zoom;
    // center on player by default
    if (this.panX == null || isNaN(this.panX)) { this.panX = 0; this.panY = 0; }
    const cx = vw / 2 - (G.player.cx / TS) * s + this.panX, cy = vh / 2 - (G.player.cy / TS) * s + this.panY;
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(this.canvas, cx, cy, w.w * s, w.h * s);
    ctx.imageSmoothingEnabled = false;
    for (const n of G.npcs) {
      if (!(n.town || n.boss)) continue;
      ctx.fillStyle = n.boss ? '#ff3a3a' : '#32ff82';
      ctx.fillRect(cx + n.cx / TS * s - 3, cy + n.cy / TS * s - 3, 7, 7);
      txt(ctx, n.shortName || n.name, cx + n.cx / TS * s, cy + n.cy / TS * s - 6, '#fff', 11, 'center');
    }
    const px = cx + G.player.cx / TS * s, py = cy + G.player.cy / TS * s;
    ctx.fillStyle = '#fff'; ctx.fillRect(px - 4, py - 4, 9, 9); ctx.fillStyle = G.player.look.hair; ctx.fillRect(px - 3, py - 3, 7, 7);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(cx + w.spawnX * s - 2, cy + w.spawnY * s - 2, 5, 5);
    txt(ctx, 'World Map — ' + w.name + '   (M to close, scroll to zoom, drag to pan)', vw / 2, 26, '#ffd23a', 16, 'center');
    // input
    if (Input.wheel) { this.zoom = clamp(this.zoom * (Input.wheel < 0 ? 1.25 : 0.8), 0.5, 12); }
    if (Input.mClick) this.dragging = [Input.mx - this.panX, Input.my - this.panY];
    if (Input.mDown && this.dragging) { this.panX = Input.mx - this.dragging[0]; this.panY = Input.my - this.dragging[1]; }
    if (!Input.mDown) this.dragging = null;
  },
};
function onTileChanged(x, y) {
  if (WorldMap.world === G.world && WorldMap.canvas) WorldMap.tileChanged(x, y);
}
