// ---------- core helpers shared by every module ----------
const TS = 16; // tile size in world pixels (Terraria uses 16)

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sign(v) { return v < 0 ? -1 : v > 0 ? 1 : 0; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function pick(arr, r = Math.random) { return arr[Math.floor(r() * arr.length)]; }
function randRange(a, b, r = Math.random) { return a + (b - a) * r(); }
function randInt(a, b, r = Math.random) { return a + Math.floor((b - a + 1) * r()); }
function chance(p, r = Math.random) { return r() < p; }

// seeded RNG (mulberry32)
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 1D/2D value noise with smooth interpolation, seeded
function makeNoise(seed) {
  const rng = makeRng(seed);
  const perm = new Uint16Array(512), grad = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; grad[i] = rng() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const fade = t => t * t * (3 - 2 * t);
  function n1(x) {
    const xi = Math.floor(x), xf = x - xi;
    const a = grad[perm[xi & 255]], b = grad[perm[(xi + 1) & 255]];
    return lerp(a, b, fade(xf));
  }
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (i, j) => grad[perm[(perm[i & 255] + j) & 255]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  }
  function fbm1(x, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += n1(x * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; }
  function fbm2(x, y, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; }
  return { n1, n2, fbm1, fbm2 };
}

// format Terraria-style coin values; here currency is "Aura"
function formatAura(copper) {
  copper = Math.floor(copper);
  const p = Math.floor(copper / 1000000), g = Math.floor(copper / 10000) % 100, s = Math.floor(copper / 100) % 100, c = copper % 100;
  const parts = [];
  if (p) parts.push(p + ' platinum');
  if (g) parts.push(g + ' gold');
  if (s) parts.push(s + ' silver');
  if (c || !parts.length) parts.push(c + ' copper');
  return parts.join(' ') + ' aura';
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}

// word-wrap text for canvas UI
function wrapText(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

// color helpers for the character creator
function normHex(hex) { hex = String(hex || '#000'); return hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex; }
function hexToHsl(hex) {
  const n = parseInt(normHex(hex).slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
}
