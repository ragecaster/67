// ---------- Terraria-style player sprites ----------
// The wiki's Hairstyle_N renders are full default characters (2x pixel art, facing right). Every body part uses
// a fixed palette except the hair, so we classify pixels into parts and recolor them with the player's colors,
// keeping Terraria's shading (per-pixel luminance relative to each part's base tone).
const PART_PALETTE = {
  skin: [[235, 115, 83], [190, 93, 67], [255, 125, 90], [215, 105, 76], [50, 25, 18]],
  eyeWhite: [[241, 241, 241]],
  eyes: [[74, 64, 53]],
  under: [[119, 134, 160], [147, 166, 198], [31, 35, 42]],
  shirt: [[144, 136, 115], [161, 152, 129], [130, 123, 104], [75, 71, 60], [102, 96, 81], [86, 82, 69], [126, 118, 100], [54, 51, 43], [175, 165, 140], [34, 32, 27]],
  pants: [[110, 99, 75], [190, 171, 130], [227, 205, 156], [148, 133, 102], [50, 45, 34]],
  shoes: [[69, 45, 26], [104, 68, 39], [154, 101, 58]],
};
const PART_BASE = { skin: [235, 115, 83], eyes: [74, 64, 53], under: [147, 166, 198], shirt: [161, 152, 129], pants: [190, 171, 130], shoes: [154, 101, 58], hair: [160, 67, 41] };
const PART_IDS = { hair: 1, skin: 2, eyeWhite: 3, eyes: 4, under: 5, shirt: 6, pants: 7, shoes: 8 };
const HAIR_COUNT = 165;
const PlayerSprites = {
  parsed: [], cache: new Map(), ready: false,
  lum(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; },
  init() {
    const lookup = new Map();
    for (const [part, cols] of Object.entries(PART_PALETTE)) for (const c of cols) lookup.set((c[0] << 16) | (c[1] << 8) | c[2], PART_IDS[part]);
    for (let i = 1; i <= HAIR_COUNT; i++) {
      const img = IMG['hair/Hairstyle_' + i];
      if (!img) continue;
      const w = img.width, h = img.height;
      const c = makeCanvas(w, h), ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      const part = new Uint8Array(w * h), lum = new Float32Array(w * h);
      let ex = -1, ey = -1, minX = w, maxX = 0, legTop = h;
      for (let k = 0; k < w * h; k++) {
        if (d[k * 4 + 3] < 128) continue;
        const rgb = (d[k * 4] << 16) | (d[k * 4 + 1] << 8) | d[k * 4 + 2];
        const p = lookup.get(rgb) || PART_IDS.hair;
        part[k] = p;
        lum[k] = this.lum([d[k * 4], d[k * 4 + 1], d[k * 4 + 2]]);
        const x = k % w, y = (k / w) | 0;
        if (p === PART_IDS.eyeWhite && ex < 0) { ex = x; ey = y; }
        if (p === PART_IDS.pants) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); legTop = Math.min(legTop, y); }
      }
      if (ex < 0) continue;
      this.parsed[i - 1] = { w, h, part, lum, ex, ey, bodyCX: (minX + maxX + 1) / 2, legTop };
    }
    this.ready = this.parsed.length > 0;
  },
  // build a recolored canvas for a look + armor combination; variant: 0 full, 1 without front arm
  // frame: 0 idle, 1-4 walk, 5 jump
  get(look, armorIds, frame, noFrontArm) {
    const hs = clamp(look.hairStyle | 0, 0, HAIR_COUNT - 1);
    const P = this.parsed[hs] || this.parsed[0];
    const key = [hs, look.hair, look.skin, look.eyes, look.shirt, look.under, look.pants, look.shoes, armorIds.join('/'), frame, noFrontArm ? 1 : 0].join('|');
    let c = this.cache.get(key);
    if (c) return [c, P];
    if (this.cache.size > 400) this.cache.clear();
    const [head, body, legs] = armorIds.map(id => id && ITEMS[id] ? ARMOR_COLORS[ITEMS[id].set] : null);
    const colors = {
      1: hexToRgb(look.hair), 2: hexToRgb(look.skin), 4: hexToRgb(look.eyes || '#3a5ad5'),
      5: hexToRgb(body ? body[1] : look.under), 6: hexToRgb(body ? body[0] : look.shirt),
      7: hexToRgb(legs ? legs[0] : look.pants), 8: hexToRgb(legs ? legs[1] : (look.shoes || '#5a3a22')),
    };
    const baseL = { 1: this.lum(PART_BASE.hair), 2: this.lum(PART_BASE.skin), 4: this.lum(PART_BASE.eyes), 5: this.lum(PART_BASE.under), 6: this.lum(PART_BASE.shirt), 7: this.lum(PART_BASE.pants), 8: this.lum(PART_BASE.shoes) };
    const W = P.w + 8, H = P.h + 4; // padding for leg shifts / bob
    c = makeCanvas(W, H);
    const ctx = c.getContext('2d'), id = ctx.createImageData(W, H), o = id.data;
    // walk cycle: offsets for back (left) leg and front (right) leg, and upper-body bob
    const walk = [[0, 0, 0], [-2, 2, -2], [0, 0, 0], [2, -2, -2], [0, 0, 0], [-4, 4, 0]][frame] || [0, 0, 0];
    const split = P.ex; // legs split at the eye column
    const armX0 = P.ex + 6, armY0 = P.ey + 8, armY1 = P.legTop;
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      const k = y * P.w + x, part = P.part[k];
      if (!part) continue;
      if (head && part === 1) continue; // helmets replace hair
      if (noFrontArm && x >= armX0 && y >= armY0 && y < armY1) continue;
      let dx = 4, dy = 4;
      if (y >= P.legTop) dx += x < split ? walk[0] : walk[1];
      else dy += walk[2];
      const tx = x + dx, ty = y + dy - 4;
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      let r, g, b;
      if (part === 3) { r = g = b = 241; }
      else {
        const col = colors[part], f = P.lum[k] / baseL[part];
        r = col[0] * f; g = col[1] * f; b = col[2] * f;
      }
      const q = (ty * W + tx) * 4;
      o[q] = clamp(r, 0, 255); o[q + 1] = clamp(g, 0, 255); o[q + 2] = clamp(b, 0, 255); o[q + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    if (head) {
      // Terraria-style helmet: rounded cap over the skull with a visor slit
      const hx = P.ex + 4 - 12, hy = P.ey - 14;
      ctx.fillStyle = head[1]; roundRect(ctx, hx, hy, 18, 16, 5); ctx.fill();
      ctx.fillStyle = head[0]; roundRect(ctx, hx + 2, hy + 2, 14, 11, 4); ctx.fill();
      ctx.fillStyle = shade(head[0], 40); ctx.fillRect(hx + 4, hy + 3, 6, 2);
      ctx.fillStyle = head[1]; ctx.fillRect(hx + 8, hy + 12, 10, 3);
      ctx.fillStyle = '#111'; ctx.fillRect(hx + 10, hy + 13, 6, 1);
    }
    this.cache.set(key, c);
    return [c, P];
  },
};

// Draw a player (or player-like preview) with Terraria sprites. Returns false if sprites aren't available.
function drawPlayerSprite(ctx, p, sx, sy, opts = {}) {
  if (!PlayerSprites.ready) return false;
  const armor = (opts.armor || p.armor || []).map(a => a ? a.id : null);
  while (armor.length < 3) armor.push(null);
  const walking = p.onGround && Math.abs(p.vx) > 0.1;
  const airborne = p.onGround === false && !opts.preview;
  let frame = 0;
  if (airborne) frame = 5;
  else if (walking) frame = 1 + (Math.floor(p.walkFrame * 1.3) % 4);
  const using = p.itemAnim > 0 && p.useItem && p.useItem.use !== 'consume';
  const held = p.heldItem && p.heldItem();
  const armBusy = using || p.emote > 0 || (held && (held.holdLight || held.id === 'umbrella'));
  const [c, P] = PlayerSprites.get(p.look, armor, frame, armBusy);
  const dir = p.dir || 1;
  const cx = sx + p.w / 2, bottom = sy + p.h;
  ctx.save();
  if (p.hurtFlash > 0) ctx.filter = 'sepia(1) saturate(4) hue-rotate(-40deg)';
  ctx.translate(Math.round(cx), 0);
  if (dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(c, Math.round(-(P.bodyCX + 4)), Math.round(bottom - P.h - 2));
  ctx.restore();
  if (armBusy) {
    const bc = armor[1] ? ARMOR_COLORS[ITEMS[armor[1]].set] : null;
    drawFrontArm(ctx, p, sx, sy, bc, walking, walking ? Math.sin(p.walkFrame * 1.3) : 0, airborne, p.hurtFlash > 0, true);
  }
  return true;
}
