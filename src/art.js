// ---------- image loading, tile atlases, procedural meme sprites ----------
const IMG = {};          // key -> Image | Canvas
const TILE_ATLAS = [];   // tile id -> canvas (16 masks x 2 variants of 16x16)
const WALL_TEX = [];     // wall id -> canvas 48x48 (3x3 repeating)
const SPRITE_CACHE = {}; // misc generated frames

function loadAssets(onProgress) {
  const keys = Object.keys(ASSET_SRC).filter(k => !k.startsWith('sfx/'));
  let done = 0;
  return Promise.all(keys.map(k => new Promise(res => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; done++; onProgress && onProgress(done / keys.length); res(); };
    im.onerror = () => { console.warn('failed image', k); done++; res(); };
    im.src = ASSET_SRC[k];
  }))).then(() => {
    generateSprites();
    buildTileAtlases();
    PlayerSprites.init();
  });
}

function getImg(key) { return IMG[key] || IMG['gen/missing']; }

// --- pixel-art pipeline: draw with primitives at low res, threshold alpha, add outline, upscale x2 ---
function pixelArt(w, h, draw, opts = {}) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  draw(ctx, w, h);
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] > 110 ? 255 : 0;
  if (opts.outline !== false) {
    const oc = opts.outline || [20, 16, 24];
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (copy[i + 3]) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && copy[(yy * w + xx) * 4 + 3];
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) { d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255; }
    }
  }
  ctx.putImageData(id, 0, 0);
  const s = opts.scale || 2;
  const out = makeCanvas(w * s, h * s);
  out.getContext('2d').drawImage(c, 0, 0, w * s, h * s);
  return out;
}

function crop(img, sx, sy, sw, sh, scale = 1) {
  const c = makeCanvas(sw * scale, sh * scale);
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
  return c;
}

// recolor an image by hue rotation / tint via pixel manipulation
function recolor(img, fn) {
  const c = makeCanvas(img.width, img.height), ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const r = fn(d[i], d[i + 1], d[i + 2]); d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; }
  ctx.putImageData(id, 0, 0);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function ellipse(ctx, x, y, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }

// tiny 3x5 pixel font for "67" etc
const PIXFONT = {
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '!': ['1', '1', '1', '0', '1'], 'W': ['10001', '10001', '10101', '11011', '10001'], 'L': ['100', '100', '100', '100', '111'],
};
function pixText(ctx, str, x, y, col, s = 1) {
  ctx.fillStyle = col;
  for (const ch of str) {
    const g = PIXFONT[ch]; if (!g) { x += 4 * s; continue; }
    for (let r = 0; r < g.length; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === '1') ctx.fillRect(x + q * s, y + r * s, s, s);
    x += (g[0].length + 1) * s;
  }
}

function generateSprites() {
  IMG['gen/missing'] = pixelArt(8, 8, ctx => { rect(ctx, 0, 0, 8, 8, '#f0f'); rect(ctx, 0, 0, 4, 4, '#000'); rect(ctx, 4, 4, 4, 4, '#000'); }, { outline: false });

  // brainrot grass = grass sheet shifted to purple
  IMG['gen/corrupt_grass'] = recolor(IMG['tiles/Grass_Block_(placed)'], (r, g, b) => g > r + 10 && g > b ? [Math.min(255, g * 0.75 + 40), g * 0.55, Math.min(255, g * 0.95 + 30)] : [r, g, b]);

  // 67 block: golden 3x3 block sheet with 6/7 glyphs
  IMG['gen/meme67'] = (() => {
    const c = makeCanvas(48, 48), ctx = c.getContext('2d');
    for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
      const x = tx * 16, y = ty * 16;
      rect(ctx, x, y, 16, 16, '#e0a81c');
      rect(ctx, x + 2, y + 2, 12, 12, '#f5c842');
      pixText(ctx, (tx + ty) % 2 ? '7' : '6', x + 6, y + 5, '#a8620c', 1);
      if (ty === 0) rect(ctx, x, y, 16, 2, '#fff1a8');
      if (tx === 0) rect(ctx, x, y, 2, 16, '#ffe27a');
      if (ty === 2) rect(ctx, x, y + 14, 16, 2, '#8c5410');
      if (tx === 2) rect(ctx, x + 14, y, 2, 16, '#9c6414');
    }
    return c;
  })();
  IMG['gen/item_meme67'] = crop(IMG['gen/meme67'], 16, 16, 16, 16);

  // doors
  const doorImg = IMG['tiles/Wooden_Door_(placed)'];
  IMG['gen/door_closed'] = (() => { const c = makeCanvas(16, 48); c.getContext('2d').drawImage(doorImg, 6, 0, 16, 48, 0, 0, 16, 48); return c; })();
  IMG['gen/door_open'] = (() => {
    const c = makeCanvas(16, 48), ctx = c.getContext('2d');
    rect(ctx, 0, 0, 6, 48, '#3b2718'); rect(ctx, 1, 1, 4, 46, '#8d6b47'); rect(ctx, 2, 2, 2, 44, '#a47c52');
    rect(ctx, 1, 22, 4, 3, '#5a5a5a');
    return c;
  })();
  IMG['gen/pot'] = crop(IMG['tiles/Forest_Pots'], 0, 0, 25, 26);
  IMG['gen/pot_variants'] = [0, 1, 2, 3].map(i => crop(IMG['tiles/Forest_Pots'], i * 25 + (i > 1 ? 1 : 0), 0, 25, 26));
  IMG['gen/cobweb'] = crop(IMG['tiles/Cobweb_(placed)'], 16, 16, 16, 16);
  const sun = IMG['tiles/Sunflower_(placed)'];
  IMG['gen/sunflower'] = crop(sun, 0, 0, 30, 66);

  // tree parts from the wiki Tree.png
  const tree = IMG['tiles/Tree'];
  IMG['gen/tree_top'] = crop(tree, 0, 0, 76, 62);
  IMG['gen/tree_trunk'] = crop(tree, 30, 64, 16, 16);
  IMG['gen/tree_trunk2'] = crop(tree, 30, 116, 16, 8);
  IMG['gen/tree_branch_l'] = crop(tree, 0, 70, 30, 28);
  IMG['gen/tree_branch_r'] = crop(tree, 46, 88, 30, 28);
  IMG['gen/tree_base'] = crop(tree, 14, 124, 48, 18);
  // snow + brainrot tree variants
  const snowify = (r, g, b) => g > r + 10 ? [200 + g * 0.2, 225 + g * 0.1, 235] : [r, g, b];
  const rotify = (r, g, b) => g > r + 10 ? [g * 0.7 + 30, g * 0.4, g * 0.9 + 20] : [r * 0.8, g * 0.7, b * 0.9];
  for (const [suffix, fn] of [['snow', snowify], ['rot', rotify]]) {
    for (const part of ['tree_top', 'tree_branch_l', 'tree_branch_r']) IMG['gen/' + part + '_' + suffix] = recolor(IMG['gen/' + part], fn);
  }
  IMG['gen/cactus_tex'] = crop(IMG['tiles/Cactus_(placed)'], 16, 16, 16, 16);
  IMG['gen/cactus_top'] = crop(IMG['tiles/Cactus_(placed)'], 16, 0, 16, 16);

  genMemeSprites();
  genItemIcons();
  genBackrooms();
}

// ================== meme monsters ==================
function genMemeSprites() {
  // Skibidi Toilet — 2 frames (mouth open/closed)
  for (let f = 0; f < 2; f++) {
    IMG['gen/skibidi_' + f] = pixelArt(18, 24, ctx => {
      // tank
      rect(ctx, 0, 3, 6, 12, '#e8eef2'); rect(ctx, 0, 2, 7, 2, '#cfd8de'); rect(ctx, 4, 4, 2, 10, '#c3ccd3');
      // bowl
      ellipse(ctx, 11, 15, 7, 3, '#f4f8fa');
      rect(ctx, 5, 15, 12, 4, '#e8eef2');
      rect(ctx, 7, 18, 8, 3, '#dfe6ea');
      rect(ctx, 6, 21, 10, 3, '#cfd8de');
      // head poking out
      const hy = f ? 1 : 2;
      ellipse(ctx, 11, 8 + hy, 5, 5.5, '#e0ac82');
      rect(ctx, 6, 2 + hy, 10, 3, '#3b2a20'); ellipse(ctx, 11, 3.5 + hy, 5, 2.4, '#3b2a20');
      rect(ctx, 9, 7 + hy, 2, 2, '#fff'); rect(ctx, 13, 7 + hy, 2, 2, '#fff');
      rect(ctx, 10, 7 + hy, 1, 1, '#000'); rect(ctx, 14, 7 + hy, 1, 1, '#000');
      rect(ctx, 9, 5 + hy + 1, 3, 1, '#3b2a20'); rect(ctx, 13, 5 + hy + 1, 3, 1, '#3b2a20');
      if (f) { rect(ctx, 10, 11 + hy, 5, 2, '#6b1d1d'); rect(ctx, 11, 11 + hy, 3, 1, '#ffffff'); } else rect(ctx, 10, 11 + hy, 5, 1, '#6b1d1d');
      // rim shadow in front of neck
      rect(ctx, 5, 13, 13, 2, '#dfe6ea'); rect(ctx, 6, 14, 11, 1, '#6aa0c8');
    });
  }
  // Tung Tung Tung Sahur — boss, wooden kentongan log with a bat. frames: 0 idle, 1 bat raised, 2 bat slam
  for (let f = 0; f < 3; f++) {
    IMG['gen/tung_' + f] = pixelArt(34, 50, ctx => {
      // legs
      rect(ctx, 11, 38, 3, 10, '#b98a55'); rect(ctx, 19, 38, 3, 10, '#b98a55');
      rect(ctx, 9, 47, 6, 3, '#6e4b2a'); rect(ctx, 18, 47, 6, 3, '#6e4b2a');
      // body log
      roundRect(ctx, 7, 4, 20, 36, 6); ctx.fillStyle = '#c99a62'; ctx.fill();
      rect(ctx, 9, 8, 2, 28, '#b3844f'); rect(ctx, 22, 10, 2, 24, '#b3844f'); rect(ctx, 15, 30, 5, 2, '#b3844f');
      ellipse(ctx, 17, 5, 10, 3, '#dcb27a');
      // face
      ellipse(ctx, 13, 15, 3, 3.3, '#fff'); ellipse(ctx, 21, 15, 3, 3.3, '#fff');
      rect(ctx, 13, 15, 2, 2, '#000'); rect(ctx, 21, 15, 2, 2, '#000');
      rect(ctx, 10, 10, 5, 1, '#5b3a1e'); rect(ctx, 19, 10, 5, 1, '#5b3a1e');
      rect(ctx, 14, 23, 7, f === 2 ? 3 : 2, '#4a2a14');
      // arms + bat
      rect(ctx, 3, 18, 5, 2, '#b98a55');
      if (f === 0) { rect(ctx, 26, 18, 5, 2, '#b98a55'); ctx.save(); ctx.translate(31, 19); ctx.rotate(-0.3); rect(ctx, -1, -18, 3, 20, '#e2c089'); rect(ctx, -2, -20, 5, 7, '#e8c898'); ctx.restore(); }
      if (f === 1) { rect(ctx, 26, 12, 2, 8, '#b98a55'); ctx.save(); ctx.translate(27, 11); ctx.rotate(-1.2); rect(ctx, -1, -18, 3, 20, '#e2c089'); rect(ctx, -2, -20, 5, 7, '#e8c898'); ctx.restore(); }
      if (f === 2) { rect(ctx, 26, 20, 5, 2, '#b98a55'); ctx.save(); ctx.translate(30, 21); ctx.rotate(0.9); rect(ctx, -1, -18, 3, 20, '#e2c089'); rect(ctx, -2, -20, 5, 7, '#e8c898'); ctx.restore(); }
    });
  }
  // Bombardiro Crocodilo — croc-headed bomber, 2 frames of propeller
  for (let f = 0; f < 2; f++) {
    IMG['gen/bombardiro_' + f] = pixelArt(46, 22, ctx => {
      rect(ctx, 6, 8, 26, 7, '#6f7d58'); ellipse(ctx, 8, 11.5, 4, 3.5, '#6f7d58');
      rect(ctx, 0, 4, 5, 6, '#5d6a49'); // tail fin
      rect(ctx, 12, 3, 12, 3, '#56633f'); rect(ctx, 12, 15, 12, 3, '#56633f'); // wings
      // croc head
      rect(ctx, 30, 7, 10, 8, '#4f8a3a'); rect(ctx, 38, 9, 7, 3, '#4f8a3a'); rect(ctx, 38, 12, 7, 3, '#3f7430');
      for (let i = 0; i < 3; i++) rect(ctx, 39 + i * 2, 12, 1, 1, '#fff');
      rect(ctx, 33, 7, 3, 3, '#ffe94d'); rect(ctx, 34, 8, 1, 2, '#000');
      rect(ctx, 30, 5, 3, 2, '#4f8a3a');
      // bombs under wing
      ellipse(ctx, 16, 19, 2.5, 1.6, '#333'); ellipse(ctx, 22, 19, 2.5, 1.6, '#333');
      // propeller
      rect(ctx, 44, 11, 1, 1, '#999');
      if (f) rect(ctx, 44, 5, 2, 12, '#cfcfcf'); else rect(ctx, 44, 9, 2, 5, '#cfcfcf');
      rect(ctx, 18, 9, 4, 2, '#a8c4e0'); // cockpit
    });
  }
  // Ballerina Cappuccina — cup head, pink tutu; 4 spin frames
  for (let f = 0; f < 4; f++) {
    IMG['gen/ballerina_' + f] = pixelArt(20, 34, ctx => {
      const sq = [1, 0.6, 0.2, 0.6][f];
      // legs
      rect(ctx, 9, 22, 2, 10, '#f2cda6'); rect(ctx, 8, 31, 4, 2, '#f7a8c8');
      if (f % 2) rect(ctx, 11, 23, 6, 2, '#f2cda6');
      // tutu
      ellipse(ctx, 10, 21, 8 * (0.6 + sq * 0.4), 3, '#ff9ccc'); ellipse(ctx, 10, 20, 6 * (0.6 + sq * 0.4), 2, '#ffc2df');
      // torso & arms
      rect(ctx, 8, 14, 4, 6, '#ffb0d4');
      rect(ctx, 3, 12 + (f % 2), 5, 1, '#f2cda6'); rect(ctx, 12, 12 - (f % 2), 5, 1, '#f2cda6');
      // cup head
      rect(ctx, 4, 3, 12, 10, '#f8f4ee'); rect(ctx, 5, 12, 10, 2, '#e7e0d6');
      ellipse(ctx, 10, 3, 6, 1.8, '#8b5a33'); ellipse(ctx, 10, 3, 3.5, 1, '#e8d2b0');
      rect(ctx, 16, 5, 2, 5, '#f8f4ee'); rect(ctx, 17, 6, 1, 3, '#fff0');
      rect(ctx, 7, 7, 1, 2, '#222'); rect(ctx, 12, 7, 1, 2, '#222'); rect(ctx, 9, 10, 2, 1, '#c55');
    });
  }
  // Labubu pet — 2 frames
  for (let f = 0; f < 2; f++) {
    IMG['gen/labubu_' + f] = pixelArt(14, 18, ctx => {
      rect(ctx, 3, 0, 2, 6, '#8a5a3b'); rect(ctx, 9, 0, 2, 6, '#8a5a3b'); rect(ctx, 3, 1, 1, 4, '#f3b0b8'); rect(ctx, 10, 1, 1, 4, '#f3b0b8');
      ellipse(ctx, 7, 8, 5.5, 4.5, '#8a5a3b');
      ellipse(ctx, 7, 9, 4, 3, '#f7dcc6');
      rect(ctx, 4, 7, 2, 2, '#000'); rect(ctx, 8, 7, 2, 2, '#000'); rect(ctx, 4, 7, 1, 1, '#fff'); rect(ctx, 8, 7, 1, 1, '#fff');
      rect(ctx, 4, 10, 6, 2, '#fff'); for (let i = 0; i < 3; i++) rect(ctx, 4 + i * 2, 11, 1, 1, '#caa');
      rect(ctx, 4, 12, 6, 4, '#8a5a3b');
      rect(ctx, 3 + (f ? 1 : 0), 16, 2, 2, '#6e452c'); rect(ctx, 9 - (f ? 1 : 0), 16, 2, 2, '#6e452c');
    });
  }
  // Tralalero sneakers overlay (drawn below the shark sprite)
  IMG['gen/sneakers'] = pixelArt(12, 5, ctx => {
    rect(ctx, 0, 1, 6, 3, '#3a7bd5'); rect(ctx, 0, 3, 7, 2, '#fff'); rect(ctx, 2, 2, 3, 1, '#fff');
  });
  // Six-Seven slime face overlay
  IMG['gen/text67'] = pixelArt(9, 7, ctx => { pixText(ctx, '67', 1, 1, '#ffffff', 1); }, { outline: [60, 30, 0] });
  // 6-7 hand emote (two open palms)
  IMG['gen/hands'] = pixelArt(22, 10, ctx => {
    for (const x of [1, 13]) { rect(ctx, x, 3, 8, 6, '#f0c39a'); for (let i = 0; i < 4; i++) rect(ctx, x + i * 2, 0, 1, 4, '#f0c39a'); rect(ctx, x + 8, 5, 2, 2, '#f0c39a'); }
  });
  // Wall of Brainrot overlay emojis (brain)
  IMG['gen/brain'] = pixelArt(16, 12, ctx => {
    ellipse(ctx, 8, 6, 7.5, 5.5, '#f09ab8'); ctx.strokeStyle = '#c85a82'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(8, 11); ctx.moveTo(3, 4); ctx.quadraticCurveTo(6, 6, 3, 8); ctx.moveTo(13, 4); ctx.quadraticCurveTo(10, 6, 13, 8); ctx.stroke();
  });
  // demon scythe projectile (the wiki item icon is the spell tome)
  IMG['gen/scythe'] = pixelArt(16, 16, ctx => {
    ctx.fillStyle = '#b36bff'; ctx.beginPath(); ctx.arc(8, 8, 7, 0, Math.PI * 1.5); ctx.arc(10, 6, 5, Math.PI * 1.5, 0, true); ctx.fill();
    ctx.fillStyle = '#e8c8ff'; ctx.fillRect(3, 8, 2, 2);
  }, { outline: [60, 10, 90] });
  // sixseven projectiles
  IMG['gen/proj_6'] = pixelArt(7, 9, ctx => pixText(ctx, '6', 2, 2, '#ffd23a', 1), { outline: [120, 40, 0] });
  IMG['gen/proj_7'] = pixelArt(7, 9, ctx => pixText(ctx, '7', 2, 2, '#ffd23a', 1), { outline: [120, 40, 0] });
}

// ================== meme item icons ==================
function genItemIcons() {
  IMG['gen/item_67'] = pixelArt(16, 16, ctx => {
    // blade formed like a "6" hilt and "7" blade
    ctx.save(); ctx.translate(8, 8); ctx.rotate(-Math.PI / 4); ctx.translate(-8, -8);
    rect(ctx, 7, 0, 3, 10, '#ffd23a'); rect(ctx, 8, 0, 1, 10, '#fff4b0');
    rect(ctx, 4, 10, 9, 2, '#b8741a'); rect(ctx, 7, 12, 3, 4, '#6b3f16');
    ctx.restore();
    pixText(ctx, '67', 0, 10, '#ff4d6d', 1);
  });
  IMG['gen/item_tung_bat'] = pixelArt(16, 16, ctx => {
    ctx.save(); ctx.translate(8, 8); ctx.rotate(-Math.PI / 4); ctx.translate(-8, -8);
    rect(ctx, 7, 7, 2, 9, '#c9a066'); rect(ctx, 6, 0, 4, 9, '#e8c898'); rect(ctx, 6, 14, 4, 2, '#8a6034');
    ctx.restore();
  });
  IMG['gen/item_plunger'] = pixelArt(16, 16, ctx => {
    ctx.save(); ctx.translate(8, 8); ctx.rotate(-Math.PI / 4); ctx.translate(-8, -8);
    rect(ctx, 7, 4, 2, 12, '#b0703a'); ellipse(ctx, 8, 3, 5, 3, '#c0282e'); rect(ctx, 3, 3, 10, 2, '#9c1d22');
    ctx.restore();
  });
  IMG['gen/item_kentongan'] = pixelArt(12, 16, ctx => {
    roundRect(ctx, 2, 1, 8, 14, 3); ctx.fillStyle = '#c99a62'; ctx.fill();
    rect(ctx, 5, 4, 2, 8, '#3b2412'); rect(ctx, 3, 2, 1, 11, '#b3844f');
    rect(ctx, 5, 0, 2, 2, '#6e4b2a');
  });
  IMG['gen/item_dubai'] = pixelArt(16, 12, ctx => {
    rect(ctx, 1, 2, 14, 8, '#5a3420'); rect(ctx, 2, 3, 12, 6, '#6e4128');
    for (let i = 0; i < 3; i++) rect(ctx, 3 + i * 4, 4, 3, 4, '#7b4a2e');
    rect(ctx, 10, 1, 5, 9, '#8fbf4a'); rect(ctx, 11, 2, 3, 7, '#b5d96a');
    rect(ctx, 1, 2, 5, 8, '#d4af37');
  });
  IMG['gen/item_sahur'] = pixelArt(14, 12, ctx => {
    ellipse(ctx, 7, 8, 6, 3.5, '#c3874a'); rect(ctx, 1, 5, 12, 3, '#e8d4b0');
    for (let i = 0; i < 4; i++) ellipse(ctx, 3 + i * 2.7, 4.5, 1.4, 1.1, '#6b3417');
  });
  IMG['gen/item_cappuccino'] = pixelArt(14, 14, ctx => {
    rect(ctx, 2, 4, 9, 9, '#f8f4ee'); ellipse(ctx, 6.5, 4, 4.5, 1.5, '#8b5a33'); ellipse(ctx, 6.5, 4, 2.5, 0.8, '#e8d2b0');
    rect(ctx, 11, 6, 2, 4, '#f8f4ee'); rect(ctx, 0, 13, 13, 1, '#ddd');
  });
  IMG['gen/item_labubu'] = pixelArt(14, 16, ctx => {
    rect(ctx, 1, 5, 12, 11, '#f7c8d8'); rect(ctx, 1, 5, 12, 2, '#e89ab8');
    rect(ctx, 4, 0, 2, 5, '#8a5a3b'); rect(ctx, 8, 0, 2, 5, '#8a5a3b');
    ellipse(ctx, 7, 10, 3.5, 3, '#8a5a3b'); rect(ctx, 5, 9, 1, 1, '#000'); rect(ctx, 8, 9, 1, 1, '#000'); rect(ctx, 5, 11, 4, 1, '#fff');
  });
}

// ================== the backrooms ==================
// 3x3 "placed" sheet: every cell gets the base texture; border cells get outlines on their outer sides
function blockSheet(base, edge, light) {
  const c = makeCanvas(48, 48), ctx = c.getContext('2d');
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
    const x = tx * 16, y = ty * 16;
    base(ctx, x, y);
    ctx.fillStyle = edge;
    if (ty === 0) { ctx.fillRect(x, y, 16, 2); ctx.fillStyle = light; ctx.fillRect(x, y + 2, 16, 2); ctx.fillStyle = edge; }
    if (ty === 2) ctx.fillRect(x, y + 14, 16, 2);
    if (tx === 0) ctx.fillRect(x, y, 2, 16);
    if (tx === 2) ctx.fillRect(x + 14, y, 2, 16);
  }
  return c;
}
function genBackrooms() {
  const rng = makeRng(67);
  IMG['gen/wallpaper'] = blockSheet((ctx, x, y) => {
    rect(ctx, x, y, 16, 16, '#d8c36a');
    for (let i = 0; i < 16; i += 4) rect(ctx, x + i + 1, y, 2, 16, '#cdb65c');
    for (let k = 0; k < 4; k++) rect(ctx, x + Math.floor(rng() * 14), y + Math.floor(rng() * 14), 2, 2, '#e6d487');
    if (rng() < 0.3) rect(ctx, x + Math.floor(rng() * 12), y + 10 + Math.floor(rng() * 4), 4, 2, '#b39e4c'); // stains
  }, '#6e6028', '#eadb95');
  IMG['gen/carpet'] = blockSheet((ctx, x, y) => {
    rect(ctx, x, y, 16, 16, '#8f7a3c');
    for (let k = 0; k < 14; k++) rect(ctx, x + Math.floor(rng() * 16), y + Math.floor(rng() * 16), 2, 2, rng() < 0.5 ? '#7d6a32' : '#a08a48');
    if (rng() < 0.25) rect(ctx, x + 3, y + 5, 7, 4, '#6f6230'); // damp patch
  }, '#4a3f1c', '#a8925a');
  // wall sheet is 64x64 like the wiki's (the center 48x48 gets used)
  IMG['gen/wallpaper_wall'] = (() => {
    const c = makeCanvas(64, 64), ctx = c.getContext('2d');
    rect(ctx, 0, 0, 64, 64, '#a8963e');
    for (let i = 0; i < 64; i += 6) rect(ctx, i, 0, 2, 64, '#9c8a36');
    for (let k = 0; k < 40; k++) rect(ctx, Math.floor(rng() * 62), Math.floor(rng() * 62), 2, 2, rng() < 0.5 ? '#b5a24a' : '#8f7e30');
    rect(ctx, 0, 52, 64, 3, '#8a7a34'); // baseboard line
    return c;
  })();
  IMG['gen/fluorescent'] = pixelArt(8, 3, ctx => { rect(ctx, 0, 0, 8, 3, '#d9d9d9'); rect(ctx, 1, 1, 6, 1, '#fffbe0'); }, { outline: [90, 90, 90] });
  IMG['gen/item_fluorescent'] = pixelArt(12, 6, ctx => { rect(ctx, 0, 1, 12, 4, '#d9d9d9'); rect(ctx, 1, 2, 10, 2, '#fffbe0'); });
  IMG['gen/item_wallpaper'] = crop(IMG['gen/wallpaper'], 16, 16, 16, 16);
  IMG['gen/item_carpet'] = crop(IMG['gen/carpet'], 16, 16, 16, 16);
  IMG['gen/item_wallpaper_wall'] = crop(IMG['gen/wallpaper_wall'], 20, 20, 16, 16);
  IMG['gen/item_almond'] = pixelArt(10, 15, ctx => {
    rect(ctx, 3, 0, 4, 3, '#e8e8e8'); rect(ctx, 2, 3, 6, 11, '#f4efe2'); rect(ctx, 3, 6, 4, 5, '#d8c9a0');
    rect(ctx, 3, 7, 4, 1, '#8a6a3a'); rect(ctx, 3, 4, 1, 9, '#ffffff');
  });
  IMG['gen/item_liminal'] = pixelArt(16, 16, ctx => {
    ctx.save(); ctx.translate(8, 8); ctx.rotate(-Math.PI / 4); ctx.translate(-8, -8);
    rect(ctx, 7, 0, 3, 11, '#e6d487'); rect(ctx, 8, 0, 1, 11, '#fffbe0'); rect(ctx, 4, 11, 9, 2, '#6e6028'); rect(ctx, 7, 13, 3, 3, '#8f7a3c');
    ctx.restore();
  });
  // Smiler: only its eyes and grin are visible in the dark
  for (let f = 0; f < 2; f++) IMG['gen/smiler_' + f] = pixelArt(20, 20, ctx => {
    ellipse(ctx, 10, 10, 9, 9, 'rgba(10,8,12,0.9)');
    rect(ctx, 5, 6, 3, 2 + f, '#fffbe0'); rect(ctx, 12, 6, 3, 2 + f, '#fffbe0');
    ctx.fillStyle = '#fffbe0'; for (let i = 0; i < 9; i++) ctx.fillRect(5 + i, 12 + Math.round(Math.sin(i / 8 * Math.PI) * 2), 1, 2);
    for (let i = 0; i < 4; i++) rect(ctx, 6 + i * 2, 13 + Math.round(Math.sin(i / 3 * Math.PI) * 2), 1, 1, '#1a1a1a');
  }, { outline: [0, 0, 0] });
  // Partygoer: yellow humanoid with a smiley face "=)"
  for (let f = 0; f < 2; f++) IMG['gen/partygoer_' + f] = pixelArt(16, 26, ctx => {
    ellipse(ctx, 8, 6, 6, 6, '#f5d33a');
    rect(ctx, 5, 4, 2, 2, '#111'); rect(ctx, 10, 4, 2, 2, '#111');
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(8, 6, 3.5, 0.3, Math.PI - 0.3); ctx.stroke();
    rect(ctx, 5, 12, 6, 7, '#f5d33a');
    rect(ctx, 2 + f, 12, 3, 6, '#f5d33a'); rect(ctx, 11 - f, 12, 3, 6, '#f5d33a');
    rect(ctx, 5 + f, 19, 2, 7, '#f5d33a'); rect(ctx, 9 - f, 19, 2, 7, '#f5d33a');
    rect(ctx, 4, 0, 8, 2, '#ff4d6d'); rect(ctx, 7, -2, 2, 2, '#ffd23a'); // party hat
  }, { outline: [60, 40, 0] });
  // missing-texture noclip block
  IMG['gen/noclip'] = (() => { const c = makeCanvas(16, 16), x = c.getContext('2d'); rect(x, 0, 0, 16, 16, '#000'); rect(x, 0, 0, 8, 8, '#ff00ff'); rect(x, 8, 8, 8, 8, '#ff00ff'); return c; })();
  IMG['gen/exit_sign'] = pixelArt(16, 8, ctx => { rect(ctx, 0, 0, 16, 8, '#0a4a1a'); ctx.fillStyle = '#3aff6a'; ctx.font = 'bold 7px monospace'; ctx.fillText('EXIT', 1, 7); });
}

// ================== block framing ==================
// Build a 16-mask x 2-variant atlas from a 48x48 "placed" 3x3 sheet by recombining 8x8 quadrants.
// mask bits: 1=top exposed, 2=right exposed, 4=bottom exposed, 8=left exposed
function buildTileAtlases() {
  for (const t of TILES) {
    if (!t || !t.block) continue;
    const sheet = IMG[t.img];
    if (!sheet) { console.warn('no sheet', t.img); continue; }
    TILE_ATLAS[t.id] = buildSimpleAtlas(sheet);
  }
  for (const w of WALLS) {
    if (!w) continue;
    const sheet = IMG[w.img];
    WALL_TEX[w.id] = crop(sheet, 8, 8, 48, 48);
  }
}

// variant row 1 differs only for the fully-interior tile (mirrored) to break up repetition
function buildSimpleAtlas(sheet) {
  const atlas = makeCanvas(16 * 16, 32), ctx = atlas.getContext('2d');
  for (let v = 0; v < 2; v++) {
    for (let m = 0; m < 16; m++) {
      const top = m & 1, right = m & 2, bot = m & 4, left = m & 8;
      const dx = m * 16, dy = v * 16;
      const q = (qx, qy, col, row) => {
        const sx = col * 16 + qx * 8, sy = row * 16 + qy * 8;
        ctx.drawImage(sheet, sx, sy, 8, 8, dx + qx * 8, dy + qy * 8, 8, 8);
      };
      if (v === 1 && m === 0) {
        // mirrored interior for variety
        ctx.save(); ctx.translate(dx + 16, dy); ctx.scale(-1, 1); ctx.drawImage(sheet, 16, 16, 16, 16, 0, 0, 16, 16); ctx.restore();
        continue;
      }
      q(0, 0, left ? 0 : 1, top ? 0 : 1);
      q(1, 0, right ? 2 : 1, top ? 0 : 1);
      q(0, 1, left ? 0 : 1, bot ? 2 : 1);
      q(1, 1, right ? 2 : 1, bot ? 2 : 1);
    }
  }
  return atlas;
}
