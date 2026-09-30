// ---------- world rendering ----------
const Render = {
  hills: null,
  init() {
    // parallax hill silhouettes (generated once)
    const n = makeNoise(67);
    this.hills = [0, 1, 2].map(layer => {
      const w = 2048, h = 400, c = makeCanvas(w, h), ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const f = x / w * Math.PI * 2;
        // periodic noise so it tiles horizontally
        const y = 180 - layer * 40 + Math.sin(f * (2 + layer)) * 40 + Math.sin(f * (5 + layer * 2) + layer) * 18 + n.n1(Math.cos(f) * 3 + layer * 10) * 30;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      // little trees on top of the far layers
      if (layer < 2) {
        for (let x = 0; x < w; x += 18 + ((x * 7) % 23)) {
          const f = x / w * Math.PI * 2;
          const y = 180 - layer * 40 + Math.sin(f * (2 + layer)) * 40 + Math.sin(f * (5 + layer * 2) + layer) * 18 + n.n1(Math.cos(f) * 3 + layer * 10) * 30;
          ctx.fillRect(x, y - 26, 3, 26); ctx.beginPath(); ctx.arc(x + 1.5, y - 30, 10, 0, Math.PI * 2); ctx.fill();
        }
      }
      return c;
    });
    this.stars = Array.from({ length: 140 }, () => [Math.random(), Math.random() * 0.7, Math.random() * 1.5 + 0.5]);
    this.clouds = Array.from({ length: 10 }, () => ({ x: Math.random() * 3000, y: Math.random() * 180 + 20, s: Math.random() * 0.5 + 0.6, v: Math.random() * 0.3 + 0.1 }));
    this.tinted = {};
  },
  tintedHill(layer, color) {
    const k = layer + color;
    if (this.tinted[k]) return this.tinted[k];
    const src = this.hills[layer], c = makeCanvas(src.width, src.height), ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
    if (Object.keys(this.tinted).length > 60) this.tinted = {};
    return (this.tinted[k] = c);
  },

  // ---------- sky / background ----------
  drawBackground(ctx, world, camX, camY, vw, vh) {
    const dl = G.daylight(), time = world.time;
    const blood = world.flags.bloodMoon && !world.dayTime;
    const top = blood ? mixColor([40, 5, 10], [20, 60, 140], dl) : mixColor([6, 10, 30], [74, 128, 225], dl);
    const bot = blood ? mixColor([110, 20, 20], [150, 200, 255], dl) : mixColor([20, 30, 60], [160, 205, 255], dl);
    // dusk/dawn warmth
    const warm = world.dayTime ? Math.max(0, 1 - Math.min(time, 54000 - time) / 5000) : 0;
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(mixColor(bot, [255, 150, 90], warm * 0.6)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    const surfY = world.worldSurface * TS;
    // stars
    if (dl < 0.6) {
      ctx.fillStyle = '#fff';
      for (const [sx, sy, s] of this.stars) {
        ctx.globalAlpha = (1 - dl / 0.6) * (0.5 + 0.5 * Math.sin(G.tick * 0.03 + sx * 50));
        ctx.fillRect(Math.floor(sx * vw), Math.floor(sy * vh), s, s);
      }
      ctx.globalAlpha = 1;
    }
    // sun / moon
    const p = world.dayTime ? time / 54000 : time / 32400;
    const bx = p * (vw + 100) - 50, by = vh * 0.55 - Math.sin(p * Math.PI) * vh * 0.45;
    if (world.dayTime) {
      ctx.fillStyle = 'rgba(255,240,150,0.25)'; ctx.beginPath(); ctx.arc(bx, by, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = blood ? '#ff5050' : '#e8ecff'; ctx.beginPath(); ctx.arc(bx, by, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blood ? '#a02020' : '#c4c9e0'; ctx.beginPath(); ctx.arc(bx - 6, by - 4, 5, 0, Math.PI * 2); ctx.arc(bx + 7, by + 6, 4, 0, Math.PI * 2); ctx.fill();
      // the moon has a 67 on it during the Ohio moon. obviously.
      if (blood) { ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 14px ' + UI_FONT; ctx.textAlign = 'center'; ctx.fillText('67', bx, by + 5); }
    }
    // clouds
    for (const c of this.clouds) {
      c.x += c.v * 0.3;
      const x = ((c.x - camX * 0.05) % (vw + 400) + vw + 400) % (vw + 400) - 200;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + dl * 0.5})`;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + i * 28 * c.s, c.y + Math.sin(i) * 6, 30 * c.s, 16 * c.s, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // parallax hills, colored by biome under the camera
    const biome = G.biomeAt(Math.floor((camX + vw / 2) / TS));
    const pal = { forest: ['#4c8f5a', '#3a7548', '#2c5c38'], desert: ['#d8b870', '#c49c50', '#a8803c'], snow: ['#cfdde8', '#b0c4d4', '#93aabc'], brainrot: ['#7a5a9a', '#5f4580', '#4a3466'], ocean: ['#5aa0c8', '#4a88b0', '#3a7098'] }[biome] || ['#4c8f5a', '#3a7548', '#2c5c38'];
    const horizon = surfY - camY;
    for (let layer = 0; layer < 3; layer++) {
      const col = rgb(mixColor(hexToRgb(pal[layer]), [10, 15, 30], (1 - dl) * 0.75));
      const img = this.tintedHill(layer, col);
      const par = 0.1 + layer * 0.12;
      const ox = -((camX * par) % img.width);
      const y = horizon * (0.35 + layer * 0.2) + 60 - layer * 20 - img.height * 0.4;
      for (let x = ox - img.width; x < vw; x += img.width) ctx.drawImage(img, Math.round(x), Math.round(y));
      // fill below the hill
      ctx.fillStyle = col; ctx.fillRect(0, Math.round(y + img.height - 1), vw, vh);
    }
    // underground backdrop
    const ugY = surfY - camY;
    if (ugY < vh) {
      const rockY = world.rockLayer * TS - camY, hellY = world.hellLayer * TS - camY;
      const dirtBg = '#2a1c12', rockBg = '#1d1b1f', hellBg = '#2a0c06';
      ctx.fillStyle = dirtBg; ctx.fillRect(0, Math.max(0, ugY), vw, vh);
      if (rockY < vh) { ctx.fillStyle = rockBg; ctx.fillRect(0, Math.max(0, rockY), vw, vh); }
      if (hellY < vh) {
        const hg = ctx.createLinearGradient(0, hellY, 0, hellY + 400);
        hg.addColorStop(0, '#1a0804'); hg.addColorStop(1, hellBg);
        ctx.fillStyle = hg; ctx.fillRect(0, Math.max(0, hellY), vw, vh);
      }
      // cave pattern using wall textures, darkened
      const tex = WALL_TEX[W.STONE], dtex = WALL_TEX[W.DIRT];
      if (tex) {
        ctx.globalAlpha = 0.28;
        const par = 0.6;
        const ox = -((camX * par) % 48), oy = -((camY * par) % 48);
        for (let y = oy - 48; y < vh; y += 48) {
          const worldY = camY + y;
          if (worldY < surfY) continue;
          const t = worldY < world.rockLayer * TS ? dtex : worldY < world.hellLayer * TS ? tex : null;
          if (!t) continue;
          for (let x = ox - 48; x < vw; x += 48) ctx.drawImage(t, Math.round(x), Math.round(y));
        }
        ctx.globalAlpha = 1;
      }
    }
  },

  // ---------- tiles ----------
  drawWorld(ctx, world, camX, camY, vw, vh) {
    const tx0 = Math.max(0, Math.floor(camX / TS) - 4), ty0 = Math.max(0, Math.floor(camY / TS) - 4);
    const tx1 = Math.min(world.w - 1, Math.floor((camX + vw) / TS) + 4), ty1 = Math.min(world.h - 1, Math.floor((camY + vh) / TS) + 5);
    const W_ = world.w, tiles = world.tiles, walls = world.walls;
    // walls
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const w = walls[y * W_ + x];
        if (!w) continue;
        const t = tiles[y * W_ + x];
        if (t && TILES[t].block && !TILES[t].transparent) continue;
        const tex = WALL_TEX[w];
        if (tex) ctx.drawImage(tex, (x % 3) * 16, (y % 3) * 16, 16, 16, x * TS - camX, y * TS - camY, 16, 16);
      }
    }
    // background objects (trees, furniture, plants) then blocks
    const spel = G.player && G.player.buffs.spelunker;
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * W_ + x, t = tiles[i];
        if (!t) continue;
        const td = TILES[t];
        if (td.block) continue;
        this.drawObjectTile(ctx, world, x, y, t, td, camX, camY);
      }
    }
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * W_ + x, t = tiles[i];
        if (!t) continue;
        const td = TILES[t];
        if (!td.block) continue;
        const atlas = TILE_ATLAS[t];
        if (!atlas) continue;
        const ex = (xx, yy) => { const n = world.tile(xx, yy); return !(n && TILES[n].block); };
        const m = (ex(x, y - 1) ? 1 : 0) | (ex(x + 1, y) ? 2 : 0) | (ex(x, y + 1) ? 4 : 0) | (ex(x - 1, y) ? 8 : 0);
        const v = ((x * 7 + y * 13) ^ (x >> 2)) & 1;
        ctx.drawImage(atlas, m * 16, v * 16, 16, 16, x * TS - camX, y * TS - camY, 16, 16);
        const dmg = world.damage.get(i);
        if (dmg) this.drawCracks(ctx, x * TS - camX, y * TS - camY, dmg.d / td.hp);
      }
    }
    // liquids
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * W_ + x, l = world.liquid[i];
        if (!l) continue;
        const lava = world.ltype[i] === 1;
        const above = y > 0 && world.liquid[i - W_] > 0;
        const h = above ? 16 : Math.max(2, Math.round(l / 255 * 16));
        const sx = x * TS - camX, sy = y * TS - camY + 16 - h;
        ctx.fillStyle = lava ? 'rgba(255,96,20,0.92)' : 'rgba(40,110,225,0.55)';
        ctx.fillRect(sx, sy, 16, h);
        if (!above) {
          ctx.fillStyle = lava ? 'rgba(255,200,80,0.9)' : 'rgba(160,210,255,0.6)';
          ctx.fillRect(sx, sy, 16, 2);
        }
      }
    }
    return [tx0, ty0, tx1, ty1];
  },
  drawCracks(ctx, x, y, f) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    const n = Math.ceil(f * 4);
    const segs = [[2, 3, 8, 8], [8, 8, 13, 5], [8, 8, 6, 14], [8, 8, 14, 12]];
    for (let k = 0; k < n; k++) { const s = segs[k]; ctx.moveTo(x + s[0], y + s[1]); ctx.lineTo(x + s[2], y + s[3]); }
    ctx.stroke();
  },
  drawObjectTile(ctx, world, x, y, t, td, camX, camY) {
    const sx = x * TS - camX, sy = y * TS - camY;
    const f = world.frames[y * world.w + x];
    if (td.tree) {
      const type = f & 15, style = f >> 4;
      const suf = style === 1 ? '_snow' : style === 2 ? '_rot' : '';
      const trunk = getImg('gen/tree_trunk');
      ctx.drawImage(trunk, sx, sy);
      if (type === TREE_BASE) { const b = getImg('gen/tree_base'); ctx.drawImage(b, sx + 8 - b.width / 2, sy + 16 - b.height); }
      else if (type === TREE_BL) { const b = getImg('gen/tree_branch_l' + suf); ctx.drawImage(b, sx - b.width + 4, sy - 6); }
      else if (type === TREE_BR) { const b = getImg('gen/tree_branch_r' + suf); ctx.drawImage(b, sx + 12, sy - 6); }
      else if (type === TREE_TOP) { const c = getImg('gen/tree_top' + suf); ctx.drawImage(c, sx + 8 - c.width / 2, sy - c.height + 8); }
      const dmg = world.damage.get(y * world.w + x);
      if (dmg) this.drawCracks(ctx, sx, sy, dmg.d / td.hp);
      return;
    }
    if (td.cactus) {
      const img = getImg(f === 1 ? 'gen/cactus_top' : 'gen/cactus_tex');
      ctx.drawImage(img, 2, 0, 12, 16, sx + 2, sy, 12, 16);
      return;
    }
    if (t === T.PLATFORM) {
      ctx.fillStyle = '#6e4a2c'; ctx.fillRect(sx, sy, 16, 6);
      ctx.fillStyle = '#b3804f'; ctx.fillRect(sx, sy, 16, 4);
      ctx.fillStyle = '#d6a36c'; ctx.fillRect(sx, sy, 16, 1);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(sx + 7, sy, 1, 5);
      return;
    }
    if (t === T.TORCH) {
      const onWall = !world.solid(x, y + 1) && (world.solid(x - 1, y) || world.solid(x + 1, y));
      ctx.save(); ctx.translate(sx + 8, sy + 14);
      if (onWall) ctx.rotate(world.solid(x - 1, y) ? 0.35 : -0.35);
      ctx.fillStyle = '#6e4a2c'; ctx.fillRect(-1, -8, 3, 9);
      const fl = Math.sin(G.tick * 0.4 + x) * 1;
      ctx.fillStyle = '#ff9a1a'; ctx.fillRect(-2, -13 + fl * 0.5, 5, 5);
      ctx.fillStyle = '#fff27a'; ctx.fillRect(-1, -12 + fl * 0.5, 3, 3);
      ctx.restore();
      return;
    }
    if (t === T.PLANT) {
      ctx.fillStyle = world.tile(x, y + 1) === T.CORRUPT_GRASS ? '#9a7ac0' : '#2fae4f';
      const k = f & 3;
      ctx.fillRect(sx + 3, sy + 8 - k, 2, 8 + k); ctx.fillRect(sx + 7, sy + 5, 2, 11); ctx.fillRect(sx + 11, sy + 9 + k, 2, 7 - k);
      if (k === 2) { ctx.fillStyle = '#ff6ec7'; ctx.fillRect(sx + 6, sy + 3, 4, 3); }
      if (k === 3) { ctx.fillStyle = '#fff27a'; ctx.fillRect(sx + 10, sy + 7, 4, 3); }
      return;
    }
    if (td.multi) {
      if ((f & 15) !== 0 || (f >> 4) !== 0) return; // only draw at origin
      const [w, h] = td.multi;
      let key = td.sprite;
      if (t === T.POT) key = null;
      let img = key ? getImg(key) : IMG['gen/pot_variants'][(x * 3 + y) % 4];
      if (t === T.SUNFLOWER) img = getImg('gen/sunflower');
      const flip = td.flip && world.isFlipped(x, y);
      ctx.save();
      const cx = sx + w * 8, by = sy + h * 16;
      ctx.translate(cx, by);
      if (flip) ctx.scale(-1, 1);
      let dw = img.width, dh = img.height;
      if (t === T.DOOR_CLOSED || t === T.DOOR_OPEN) { dw = 16; dh = 48; }
      ctx.drawImage(img, Math.round(-dw / 2), -dh, dw, dh);
      ctx.restore();
      if (t === T.LIFE_CRYSTAL || t === T.SHADOW_ORB) {
        const pulse = 0.2 + 0.15 * Math.sin(G.tick * 0.08);
        ctx.fillStyle = t === T.LIFE_CRYSTAL ? `rgba(255,100,160,${pulse})` : `rgba(180,100,255,${pulse})`;
        ctx.beginPath(); ctx.arc(cx, by - h * 8, 14, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    if (td.sprite) {
      const img = getImg(td.sprite);
      const s = Math.min(1, 16 / img.width, 20 / img.height);
      ctx.drawImage(img, Math.round(sx + 8 - img.width * s / 2), Math.round(sy + 16 - img.height * s), img.width * s, img.height * s);
      if (t === T.CANDLE) { ctx.fillStyle = '#fff27a'; ctx.fillRect(sx + 7, sy + 2 + Math.sin(G.tick * 0.3), 2, 3); }
    }
  },

  // spelunker: outline ores / treasures
  drawSpelunker(ctx, world, camX, camY, r) {
    const [tx0, ty0, tx1, ty1] = r;
    ctx.strokeStyle = 'rgba(255,230,120,0.85)'; ctx.lineWidth = 1;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const td = TILES[world.tile(x, y)];
      if (td && (td.ore || td.chest || td.id === T.LIFE_CRYSTAL || td.pot)) { ctx.strokeRect(x * TS - camX + 0.5, y * TS - camY + 0.5, 15, 15); }
    }
  },
};
function mixColor(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
