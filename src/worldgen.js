// ---------- Terraria-style world generation (as a generator so the UI can show progress) ----------
const WORLD_SIZES = { small: [2100, 700], medium: [3200, 900], large: [4200, 1200] };

function* generateWorld(name, seedStr, size = 'small') {
  const [w, h] = WORLD_SIZES[size] || WORLD_SIZES.small;
  const seed = /^\d+$/.test(seedStr) ? (parseInt(seedStr) >>> 0) : hashString(seedStr || String(Math.random()));
  const rng = makeRng(seed);
  const noise = makeNoise(seed ^ 0x5eed);
  const world = new World(w, h, seed, name);
  world.seedStr = seedStr;
  const meme67 = seedStr === '67' || seedStr === '6-7' || seedStr === 'sixseven';
  const R = (a, b) => randInt(a, b, rng);
  const msg = i => MEME.worldgen[i % MEME.worldgen.length];

  // ---------------- terrain ----------------
  yield [msg(0), 0.02];
  const base = Math.floor(h * 0.26);
  const ocean = 110;
  const seaLevel = base + 6;
  for (let x = 0; x < w; x++) {
    let s = base + noise.fbm1(x / 180, 3) * 30 + noise.fbm1(x / 45 + 100, 3) * 9 + noise.n1(x / 9 + 50) * 1.5;
    // mountains
    const m = noise.n1(x / 400 + 999);
    if (m > 0.35) s -= (m - 0.35) * 70;
    const edge = Math.min(x, w - 1 - x);
    if (edge < ocean) {
      const t = edge / ocean, st = t * t * (3 - 2 * t);
      s = lerp(seaLevel + 38, s, st);
    }
    world.surface[x] = Math.round(s);
  }
  let maxSurf = 0;
  for (let x = ocean; x < w - ocean; x++) maxSurf = Math.max(maxSurf, world.surface[x]);
  world.worldSurface = maxSurf + 6;
  world.rockLayer = world.worldSurface + Math.floor(h * 0.09);
  world.hellLayer = h - 100;
  const WS = world.worldSurface, RL = world.rockLayer, HL = world.hellLayer;

  for (let x = 0; x < w; x++) {
    const s = world.surface[x];
    const rockLine = RL + Math.round(noise.n1(x / 30 + 7) * 6);
    for (let y = s; y < h; y++) {
      const i = y * w + x;
      world.tiles[i] = y < rockLine ? T.DIRT : T.STONE;
      if (y > s + 2 && y < RL + 4) world.walls[i] = W.DIRT;
    }
  }
  // stone lumps in dirt, dirt lumps in stone
  yield [msg(2), 0.08];
  for (let k = 0; k < w * h / 1400; k++) {
    const x = R(0, w - 1), y = R(WS - 20, RL);
    tileRunner(world, rng, x, y, R(2, 6), R(4, 16), T.STONE, t => t === T.DIRT);
  }
  yield [msg(3), 0.12];
  for (let k = 0; k < w * h / 1600; k++) {
    const x = R(0, w - 1), y = R(RL, HL - 10);
    tileRunner(world, rng, x, y, R(2, 7), R(6, 20), T.DIRT, t => t === T.STONE);
  }
  // clay & sand pockets
  for (let k = 0; k < w * h / 9000; k++) {
    tileRunner(world, rng, R(0, w - 1), R(WS - 10, RL + 30), R(2, 5), R(5, 12), T.CLAY, t => t === T.DIRT || t === T.STONE);
    tileRunner(world, rng, R(0, w - 1), R(WS, HL - 40), R(2, 6), R(5, 14), T.SAND, t => t === T.DIRT || t === T.STONE);
  }

  // ---------------- biomes ----------------
  yield [msg(1), 0.16];
  const spawn = w >> 1;
  const leftSide = rng() < 0.5;
  const snowX = leftSide ? R(Math.floor(w * 0.18), Math.floor(w * 0.28)) : R(Math.floor(w * 0.72), Math.floor(w * 0.82));
  const desertX = leftSide ? R(Math.floor(w * 0.66), Math.floor(w * 0.76)) : R(Math.floor(w * 0.24), Math.floor(w * 0.34));
  const rotX = leftSide ? R(Math.floor(w * 0.33), Math.floor(w * 0.40)) : R(Math.floor(w * 0.60), Math.floor(w * 0.67));
  world.biomes = { snowX, desertX, rotX };
  // oceans: sand beaches
  for (let x = 0; x < w; x++) {
    const edge = Math.min(x, w - 1 - x);
    if (edge < ocean + 20) {
      const depth = 10 + Math.floor((ocean + 20 - edge) * 0.25);
      for (let y = world.surface[x]; y < world.surface[x] + depth; y++) { world.tiles[y * w + x] = T.SAND; world.walls[y * w + x] = 0; }
    }
  }
  // desert
  const dW = R(90, 130);
  for (let x = desertX - dW; x < desertX + dW; x++) {
    const edgeFade = Math.min(x - (desertX - dW), desertX + dW - x);
    const depth = Math.min(40, edgeFade * 0.8) + noise.n1(x / 10) * 4;
    for (let y = world.surface[x]; y < world.surface[x] + depth; y++) {
      const i = y * w + x;
      world.tiles[i] = y > world.surface[x] + depth * 0.55 ? T.SANDSTONE : T.SAND;
      world.walls[i] = 0;
    }
  }
  // snow
  const sW = R(100, 140);
  for (let x = snowX - sW; x < snowX + sW; x++) {
    const edgeFade = Math.min(x - (snowX - sW), snowX + sW - x);
    const deep = RL + 60 + Math.min(40, edgeFade);
    for (let y = world.surface[x]; y < Math.min(HL - 30, deep); y++) {
      const i = y * w + x, t = world.tiles[i];
      if (t === T.DIRT) world.tiles[i] = y < WS + 10 || rng() < 0.5 ? T.SNOW : T.ICE;
      else if (t === T.STONE || t === T.CLAY || t === T.SAND) world.tiles[i] = T.ICE;
    }
  }

  // ---------------- caves ----------------
  yield [msg(4), 0.22];
  for (let k = 0; k < w * h / 4600; k++) {
    const x = R(0, w - 1), y = R(WS + 5, HL - 15);
    wormTunnel(world, rng, x, y, R(40, 180), rng() * 1.8 + 1.3);
  }
  yield [msg(5), 0.28];
  for (let k = 0; k < w * h / 16000; k++) {
    const x = R(0, w - 1), y = R(RL, HL - 25);
    tileRunner(world, rng, x, y, R(7, 14), R(25, 60), 0, t => t !== 0);
  }
  // a few surface cave entrances
  for (let k = 0; k < w / 250; k++) {
    let x = R(ocean + 30, w - ocean - 30);
    if (Math.abs(x - spawn) < 60) continue;
    wormTunnel(world, rng, x, world.surface[x] - 2, R(60, 140), 1.8, Math.PI / 2);
  }

  // ---------------- ores ----------------
  yield [msg(6), 0.34];
  const ore = (tile, count, yMin, yMax, sMin, sMax) => {
    for (let k = 0; k < count; k++) tileRunner(world, rng, R(0, w - 1), R(yMin, yMax), rng() * (sMax - sMin) + sMin, R(3, 8), tile, t => t === T.DIRT || t === T.STONE || t === T.SNOW || t === T.ICE || t === T.CLAY);
  };
  const area = w * h / 1000;
  ore(T.COPPER, area * 0.3, WS - 10, RL + 60, 1.5, 3.5);
  ore(T.COPPER, area * 0.12, RL, HL - 20, 2, 4);
  yield [msg(7), 0.38];
  ore(T.IRON, area * 0.2, WS, RL + 80, 1.5, 3.5);
  ore(T.IRON, area * 0.12, RL, HL - 20, 2, 4);
  yield [msg(8), 0.42];
  ore(T.SILVER, area * 0.14, RL - 20, HL - 20, 2, 4);
  yield [msg(9), 0.46];
  ore(T.GOLD, area * 0.1, RL, HL - 10, 2, 4);
  // a bit of brainrot ore near the brainrot biome depths (Terraria places some demonite)
  for (let k = 0; k < 14; k++) tileRunner(world, rng, rotX + R(-80, 80), R(RL, HL - 30), R(2, 4), R(3, 6), T.DEMONITE, t => t === T.STONE);

  // ---------------- the underworld: Ohio ----------------
  yield [msg(10), 0.5];
  for (let x = 0; x < w; x++) {
    const top = HL + Math.round(noise.n1(x / 25 + 300) * 5);
    const mid = h - 56 + noise.fbm1(x / 60 + 40, 3) * 8;
    const half = 22 + noise.fbm1(x / 35 + 90, 3) * 10;
    for (let y = top - 6; y < h; y++) {
      const i = y * w + x;
      world.walls[i] = 0;
      if (y < top) { if (rng() < (y - top + 6) / 6) world.tiles[i] = T.ASH; continue; }
      if (Math.abs(y - mid) < half && y > top + 3) world.tiles[i] = 0;
      else world.tiles[i] = T.ASH;
      if (y >= h - 12 && world.tiles[i] === 0) world.tiles[i] = T.ASH;
    }
    // lava on the cavern floor
    let fy = Math.floor(mid + half) - 1;
    while (fy > HL && world.tiles[fy * w + x] !== 0) fy--;
  }
  yield [msg(11), 0.55];
  for (let k = 0; k < w / 5; k++) tileRunner(world, rng, R(0, w - 1), R(HL + 5, h - 8), R(2, 5), R(4, 10), T.HELLSTONE, t => t === T.ASH);
  // obsidian crust near the underworld ceiling
  for (let k = 0; k < w / 30; k++) tileRunner(world, rng, R(0, w - 1), R(HL - 8, HL + 4), R(2, 4), R(3, 8), T.OBSIDIAN, t => t === T.ASH || t === T.STONE);
  // lava lakes
  for (let x = 0; x < w; x++) {
    // find the first floor below the cavern
    for (let y = h - 14; y > HL; y--) {
      const i = y * w + x;
      if (world.tiles[i] === 0 && world.tiles[i + w] !== 0) {
        const lavaTop = h - 33 + Math.round(noise.n1(x / 50 + 12) * 5);
        let yy = y;
        while (yy >= lavaTop && world.tiles[yy * w + x] === 0) { world.liquid[yy * w + x] = 255; world.ltype[yy * w + x] = 1; yy--; }
        break;
      }
    }
  }
  // ruined Ohio houses with hellforges
  yield [msg(22), 0.6];
  for (let k = 0, placed = 0; k < 400 && placed < Math.floor(w / 180); k++) {
    const x = R(80, w - 80);
    let y = h - 56 + Math.round(noise.fbm1(x / 60 + 40, 3) * 8);
    if (buildOhioHouse(world, rng, x, y)) placed++;
  }

  // ---------------- brainrot biome ----------------
  yield [msg(14), 0.64];
  const rW = R(70, 100);
  Object.assign(world.biomes, { dW, sW, rW, ocean });
  for (let x = rotX - rW; x < rotX + rW; x++) {
    const edgeFade = Math.min(x - (rotX - rW), rotX + rW - x);
    const deep = world.surface[x] + 40 + Math.min(60, edgeFade * 1.5);
    for (let y = world.surface[x]; y < deep; y++) {
      const i = y * w + x, t = world.tiles[i];
      if (t === T.STONE) world.tiles[i] = T.EBONSTONE;
      else if (t === T.SAND) world.tiles[i] = T.EBONSAND;
      if (world.walls[i] === W.DIRT && rng() < 0.4) world.walls[i] = W.EBONSTONE;
    }
  }
  // chasms
  const chasms = R(3, 5);
  for (let c = 0; c < chasms; c++) {
    let x = rotX - rW + 15 + Math.floor((c + 0.5) * (rW * 2 - 30) / chasms) + R(-6, 6);
    let y = world.surface[x] - 3;
    const depth = R(60, 110);
    let width = R(3, 5);
    for (let d = 0; d < depth; d++) {
      x += R(-1, 1) * (rng() < 0.3 ? 1 : 0);
      const ww = width + Math.round(Math.sin(d / 7) * 1.5);
      for (let i = -ww - 4; i <= ww + 4; i++) {
        const xx = x + i, yy = y + d;
        if (!world.inb(xx, yy)) continue;
        const idx = yy * w + xx;
        if (Math.abs(i) <= ww) { world.tiles[idx] = 0; if (d > 8) world.walls[idx] = W.EBONSTONE; }
        else if (world.tiles[idx] && d > 3) world.tiles[idx] = T.EBONSTONE;
      }
    }
    // brainrot orb + altar at the bottom
    const by = y + depth;
    carveRoom(world, x - 5, by - 4, 11, 6, W.EBONSTONE);
    for (let i = -7; i <= 7; i++) for (let j = 2; j <= 5; j++) if (world.inb(x + i, by + j)) world.tiles[(by + j) * w + x + i] = T.EBONSTONE;
    if (world.canPlaceObject(x - 1, by, T.SHADOW_ORB)) world.placeObject(x - 1, by, T.SHADOW_ORB);
    if (world.canPlaceObject(x + 2, by, T.ALTAR)) world.placeObject(x + 2, by, T.ALTAR);
    else if (world.canPlaceObject(x - 5, by, T.ALTAR)) world.placeObject(x - 5, by, T.ALTAR);
  }

  // ---------------- liquids ----------------
  yield [msg(12), 0.68];
  // oceans
  for (let x = 0; x < w; x++) {
    const edge = Math.min(x, w - 1 - x);
    if (edge >= ocean) continue;
    for (let y = seaLevel; y < h && world.tiles[y * w + x] === 0; y++) { world.liquid[y * w + x] = 255; world.ltype[y * w + x] = 0; }
  }
  // surface lakes
  for (let k = 0; k < w / 500; k++) {
    const x = R(ocean + 60, w - ocean - 60);
    if (Math.abs(x - spawn) < 80 || Math.abs(x - desertX) < 140) continue;
    const r = R(8, 16), d = R(4, 8);
    const s = world.surface[x];
    for (let i = -r; i <= r; i++) {
      const dd = Math.round(d * Math.sqrt(1 - (i * i) / (r * r)));
      for (let j = 0; j < dd; j++) {
        const xx = x + i, yy = s + j;
        world.tiles[yy * w + xx] = 0; world.walls[yy * w + xx] = 0;
        world.liquid[yy * w + xx] = 255; world.ltype[yy * w + xx] = 0;
      }
      for (let j = dd; j < dd + 2; j++) if (world.tiles[(s + j) * w + x + i] === T.DIRT) world.tiles[(s + j) * w + x + i] = T.SAND;
    }
  }
  yield [msg(13), 0.72];
  for (let k = 0, pools = 0; k < 40000 && pools < w * h / 9000; k++) {
    const x = R(0, w - 1), y = R(WS, HL - 20);
    if (world.tiles[y * w + x] !== 0) continue;
    const lava = y > RL + (HL - RL) * 0.45 && rng() < 0.45;
    fillPool(world, x, y, R(20, 260), lava ? 1 : 0);
    pools++;
  }

  // ---------------- the backrooms (Level 0) ----------------
  yield ['Noclipping out of reality (Level 0)', 0.74];
  buildBackrooms(world, rng);

  // ---------------- surface grass & plants ----------------
  yield [msg(15), 0.76];
  for (let x = 0; x < w; x++) {
    for (let y = Math.max(1, world.surface[x] - 60); y < RL; y++) {
      const i = y * w + x;
      if (world.tiles[i] !== T.DIRT) continue;
      const air = world.tiles[i - w] === 0 || world.tiles[i - 1] === 0 || world.tiles[i + 1] === 0 || world.tiles[i + w] === 0;
      if (!air) continue;
      if (y > WS + 3 && world.walls[i - w]) continue; // underground caves with walls stay dirt
      if (world.liquid[i - w]) continue;
      const inRot = Math.abs(x - rotX) < rW;
      world.tiles[i] = inRot ? T.CORRUPT_GRASS : T.GRASS;
    }
  }
  // snow surface: grass-less; ensure top is snow
  // trees + plants
  yield [msg(15), 0.8];
  for (let x = 4; x < w - 4; x++) {
    const y = topSolid(world, x);
    if (y < 0) continue;
    const g = world.tile(x, y);
    if ((g === T.GRASS || g === T.CORRUPT_GRASS || g === T.SNOW) && world.liq(x, y - 1) === 0) {
      if (rng() < 0.16 && world.growTree(x, y, rng, 7, 17)) { x += 2; continue; }
      if (g !== T.SNOW) {
        const r = rng();
        if (r < 0.55) world.setTile(x, y - 1, T.PLANT, R(0, 3));
        else if (r < 0.575) world.setTile(x, y - 1, T.MUSHROOM);
        else if (r < 0.595 && g === T.GRASS) world.setTile(x, y - 1, T.DAYBLOOM);
        else if (r < 0.605 && g === T.GRASS && world.canPlaceObject(x, y - 4, T.SUNFLOWER)) world.placeObject(x, y - 4, T.SUNFLOWER);
      }
    }
    if (g === T.SAND && Math.abs(x - desertX) < dW && rng() < 0.05) growCactus(world, rng, x, y);
  }
  // underground plants
  for (let k = 0; k < w * h / 1800; k++) {
    const x = R(1, w - 2), y = R(WS, HL - 5);
    if (world.tile(x, y) === 0 && world.solid(x, y + 1) && world.liq(x, y) === 0) {
      const f = world.tile(x, y + 1);
      if ((f === T.DIRT || f === T.STONE) && rng() < 0.2) world.setTile(x, y, T.BLINKROOT);
      else if (f === T.DIRT || f === T.STONE) world.setTile(x, y, T.MUSHROOM);
    }
    // cobwebs near ceilings
    if (world.tile(x, y) === 0 && y < RL + 40 && world.solid(x, y - 1)) {
      for (let j = 0; j < 3; j++) for (let i = -2; i <= 2; i++) if (world.empty(x + i, y + j) && rng() < 0.6) world.setTile(x + i, y + j, T.COBWEB);
    }
  }

  // ---------------- treasure ----------------
  yield [msg(17), 0.84];
  let crystals = 0;
  for (let k = 0; k < 20000 && crystals < w / 28; k++) {
    const x = R(20, w - 20), y = R(WS + 20, HL - 10);
    if (tryPlaceOnFloor(world, x, y, T.LIFE_CRYSTAL)) crystals++;
  }
  yield [msg(19), 0.86];
  let pots = 0;
  for (let k = 0; k < 60000 && pots < w / 4; k++) {
    const x = R(20, w - 20), y = R(WS + 5, h - 15);
    if (tryPlaceOnFloor(world, x, y, T.POT)) pots++;
  }
  yield [msg(18), 0.88];
  // underground cabins
  let cabins = 0;
  for (let k = 0; k < 3000 && cabins < w / 110; k++) {
    const x = R(60, w - 60), y = R(WS + 15, HL - 40);
    if (buildCabin(world, rng, x, y)) cabins++;
  }
  // loose chests in caves
  let chests = 0;
  for (let k = 0; k < 20000 && chests < w / 70; k++) {
    const x = R(20, w - 20), y = R(WS + 10, HL - 5);
    if (tryPlaceOnFloor(world, x, y, T.CHEST)) { fillChest(world, x, y, rng); chests++; }
  }
  // underworld chests
  for (let k = 0, c = 0; k < 4000 && c < w / 300; k++) {
    const x = R(20, w - 20), y = R(HL + 5, h - 15);
    if (tryPlaceOnFloor(world, x, y, T.CHEST)) { fillChest(world, x, y, rng, 'ohio'); c++; }
  }
  // demon altars across the underground
  yield [msg(20), 0.9];
  for (let k = 0, c = 0; k < 20000 && c < w / 180; k++) {
    const x = R(20, w - 20), y = R(RL, HL - 10);
    if (tryPlaceOnFloor(world, x, y, T.ALTAR)) c++;
  }
  // the monument of 67
  yield [msg(21), 0.92];
  build67Monument(world, rng, desertX + R(-30, 30), meme67);
  if (meme67) for (let k = 0; k < 67; k++) build67Monument(world, rng, R(ocean + 20, w - ocean - 20), false, true);

  // ---------------- spawn ----------------
  yield [msg(24), 0.95];
  let sx = spawn;
  for (let tries = 0; tries < 200; tries++) {
    const y = topSolid(world, sx);
    if (y > 0 && world.liq(sx, y - 1) === 0 && world.tile(sx, y - 1) !== T.TREE) break;
    sx++;
  }
  world.spawnX = sx;
  world.spawnY = topSolid(world, sx) - 1;
  // clear trees right at spawn
  for (let x = sx - 3; x <= sx + 3; x++) for (let y = world.spawnY - 20; y <= world.spawnY; y++) if (world.tile(x, y) === T.TREE || world.tile(x, y) === T.COBWEB) world.setTile(x, y, 0);

  yield [msg(25), 0.97];
  settleLiquidsQuick(world);
  // obsidian where lava meets water
  for (let i = w; i < w * h - w; i++) {
    if (world.liquid[i] && world.ltype[i] === 1) {
      for (const n of [i - 1, i + 1, i - w, i + w]) if (world.liquid[n] && world.ltype[n] === 0) { world.tiles[i] = T.OBSIDIAN; world.liquid[i] = 0; break; }
    }
  }
  // the glitch: a missing-texture block floating near the surface that noclips you into Level 0
  for (let k = 0; k < 400; k++) {
    const x = world.spawnX + (rng() < 0.5 ? -1 : 1) * R(50, 140);
    const y = topSolid(world, x);
    if (y > 5 && world.liq(x, y - 1) === 0 && world.empty(x, y - 2) && world.empty(x, y - 3)) { world.setTile(x, y - 3, T.NOCLIP); world.noclipAt = [x, y - 3]; break; }
  }
  world.time = 13500; world.dayTime = true;
  yield [msg(26), 1];
  return world;
}

// ---- helpers ----
function topSolid(world, x) {
  for (let y = 5; y < world.h - 1; y++) { const t = world.tile(x, y); if (t && TILES[t].solid) return y; if (world.liq(x, y) > 0) return -1; }
  return -1;
}

// Terraria's TileRunner: a wandering blob that replaces tiles
function tileRunner(world, rng, x, y, strength, steps, tile, filter) {
  let vx = rng() * 2 - 1, vy = rng() * 2 - 1;
  let s = strength;
  for (let k = 0; k < steps && s > 0.5; k++) {
    const r = Math.ceil(s);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (i * i + j * j > s * s * (0.7 + rng() * 0.5)) continue;
      const xx = Math.round(x + i), yy = Math.round(y + j);
      if (!world.inb(xx, yy)) continue;
      const idx = yy * world.w + xx;
      if (filter(world.tiles[idx])) { world.tiles[idx] = tile; if (tile === 0) world.liquid[idx] = 0; }
    }
    x += vx; y += vy;
    vx = clamp(vx + (rng() - 0.5) * 0.6, -1, 1); vy = clamp(vy + (rng() - 0.5) * 0.6, -1, 1);
    s -= strength / steps * 0.5;
  }
}
function wormTunnel(world, rng, x, y, len, radius, dir) {
  let a = dir != null ? dir : rng() * Math.PI * 2;
  for (let k = 0; k < len; k++) {
    const r = radius + Math.sin(k / 6) * 0.6;
    const ri = Math.ceil(r);
    for (let j = -ri; j <= ri; j++) for (let i = -ri; i <= ri; i++) {
      if (i * i + j * j > r * r) continue;
      const xx = Math.round(x + i), yy = Math.round(y + j);
      if (!world.inb(xx, yy) || yy < 5 || yy >= world.hellLayer - 4) continue;
      world.tiles[yy * world.w + xx] = 0;
    }
    x += Math.cos(a) * 1.2; y += Math.sin(a) * 0.9;
    a += (rng() - 0.5) * 0.5;
    if (dir != null) a = lerp(a, dir, 0.08);
  }
}
function carveRoom(world, x, y, w, h, wall) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (world.inb(x + i, y + j)) { const idx = (y + j) * world.w + x + i; world.tiles[idx] = 0; world.liquid[idx] = 0; if (wall) world.walls[idx] = wall; }
}
function tryPlaceOnFloor(world, x, y, id) {
  const t = TILES[id];
  const b = world.backrooms;
  if (b && x >= b.x0 - 3 && x < b.x0 + b.w + 3 && y >= b.y0 - 3 && y < b.y0 + b.h + 3) return false; // Level 0 has its own loot
  const [w, h] = t.multi || [1, 1];
  // drop to floor
  let yy = y;
  while (yy < world.h - 2 && world.tile(x, yy + h) === 0 && world.tile(x, yy) === 0) yy++;
  if (!world.canPlaceObject(x, yy, id)) return false;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (world.liq(x + i, yy + j) > 0) return false;
  for (let i = 0; i < w; i++) if (!TILES[world.tile(x + i, yy + h)]?.block) return false;
  world.placeObject(x, yy, id);
  if (id === T.CHEST) world.lastChest = [x, yy];
  return true;
}
function growCactus(world, rng, x, y) {
  const h = randInt(3, 6, rng);
  for (let j = 1; j <= h; j++) if (!world.empty(x, y - j)) return;
  for (let j = 1; j <= h; j++) world.setTile(x, y - j, T.CACTUS, j === h ? 1 : 0);
}
// pre-settled pool filling (bottom-up, stops when leaking)
function fillPool(world, x, y, maxCells, type) {
  if (world.tile(x, y) !== 0) return;
  while (y < world.h - 2 && world.tile(x, y + 1) === 0) y++;
  let cells = 0;
  for (let level = y; level > y - 30 && cells < maxCells; level--) {
    if (world.tile(x, level) !== 0) break;
    let l = x, r = x;
    while (l > 0 && world.tile(l - 1, level) === 0) l--;
    while (r < world.w - 1 && world.tile(r + 1, level) === 0) r++;
    if (r - l > 60) break;
    let leak = false;
    for (let i = l; i <= r; i++) if (world.tile(i, level + 1) === 0 && !world.liq(i, level + 1)) { leak = true; break; }
    if (leak) break;
    for (let i = l; i <= r; i++) { const idx = level * world.w + i; world.liquid[idx] = 255; world.ltype[idx] = type; cells++; }
  }
}
function settleLiquidsQuick(world) {
  // remove liquid floating over air (from carving after pools), a few passes
  for (let pass = 0; pass < 3; pass++) {
    for (let y = world.h - 2; y > 0; y--) for (let x = 0; x < world.w; x++) {
      const i = y * world.w + x;
      if (!world.liquid[i]) continue;
      if (TILES[world.tiles[i]]?.solid) { world.liquid[i] = 0; continue; }
      const b = i + world.w;
      if (world.tiles[b] === 0 && world.liquid[b] < 255) { const mv = Math.min(world.liquid[i], 255 - world.liquid[b]); world.liquid[b] += mv; world.ltype[b] = world.ltype[i]; world.liquid[i] -= mv; }
    }
  }
}
function buildCabin(world, rng, x, y) {
  const w = randInt(9, 14, rng), h = randInt(6, 8, rng);
  // must be mostly underground (solid ratio)
  let solid = 0;
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (world.solid(x + i, y + j)) solid++;
  if (solid < (w + 2) * (h + 2) * 0.5) return false;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
    const idx = world.idx(x + i, y + j);
    world.tiles[idx] = edge ? (rng() < 0.9 ? T.WOOD : 0) : 0;
    world.walls[idx] = W.WOOD;
    world.liquid[idx] = 0;
  }
  // door gaps
  world.tiles[world.idx(x, y + h - 2)] = 0; world.tiles[world.idx(x, y + h - 3)] = 0; world.tiles[world.idx(x, y + h - 4)] = 0;
  world.placeObject(x, y + h - 4, T.DOOR_CLOSED);
  const cx = x + randInt(2, w - 4, rng);
  if (world.canPlaceObject(cx, y + h - 3, T.CHEST)) { world.placeObject(cx, y + h - 3, T.CHEST); fillChest(world, cx, y + h - 3, rng); }
  if (world.canPlaceObject(x + w - 3, y + h - 3, T.CHAIR)) world.placeObject(x + w - 3, y + h - 3, T.CHAIR);
  if (world.empty(x + w - 2, y + 2)) world.setTile(x + w - 2, y + 1, T.TORCH);
  return true;
}
function buildOhioHouse(world, rng, x, y) {
  const w = randInt(12, 20, rng), h = randInt(7, 9, rng);
  y = Math.floor(y) - Math.floor(h / 2);
  if (y < world.hellLayer + 5 || y + h > world.h - 14) return false;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const edge = j === 0 || j === h - 1 || ((i === 0 || i === w - 1) && j < h - 4);
    const idx = world.idx(x + i, y + j);
    world.tiles[idx] = edge ? (rng() < 0.85 ? T.HELLSTONE_BRICK : T.OBSIDIAN) : 0;
    world.walls[idx] = rng() < 0.85 ? W.HELLSTONE_BRICK : 0;
    world.liquid[idx] = 0;
  }
  const fx = x + randInt(2, w - 5, rng);
  if (world.canPlaceObject(fx, y + h - 3, T.HELLFORGE)) world.placeObject(fx, y + h - 3, T.HELLFORGE);
  const cx = x + randInt(2, w - 4, rng);
  if (world.canPlaceObject(cx, y + h - 3, T.CHEST)) { world.placeObject(cx, y + h - 3, T.CHEST); fillChest(world, cx, y + h - 3, rng, 'ohio'); }
  return true;
}
function buildBackrooms(world, rng) {
  const W_ = 150, LV = 5, LH = 9, H_ = LV * LH + 1;
  const y0 = world.rockLayer + 25;
  if (y0 + H_ >= world.hellLayer - 8) return;
  const x0 = randInt(Math.floor(world.w * 0.2), Math.floor(world.w * 0.8) - W_, rng);
  const R = (a, b) => randInt(a, b, rng);
  const set = (x, y, t, fr = 0) => { const i = world.idx(x, y); world.tiles[i] = t; world.frames[i] = fr; world.liquid[i] = 0; };
  // shell
  for (let y = y0 - 2; y < y0 + H_ + 2; y++) for (let x = x0 - 2; x < x0 + W_ + 2; x++) { set(x, y, T.WALLPAPER); world.walls[world.idx(x, y)] = W.WALLPAPER; }
  for (let lv = 0; lv < LV; lv++) {
    const cy = y0 + lv * LH;
    for (let x = x0; x < x0 + W_; x++) {
      set(x, cy, T.WALLPAPER);
      for (let y = cy + 1; y < cy + LH - 1; y++) set(x, y, 0);
      set(x, cy + LH - 1, T.CARPET);
    }
    // partitions with doorways (a maze of rooms)
    let x = x0 + R(6, 12);
    while (x < x0 + W_ - 4) {
      const door = rng() < 0.75;
      for (let y = cy + 1; y < cy + LH - 1; y++) if (!(door && y >= cy + LH - 5)) set(x, y, T.WALLPAPER);
      if (rng() < 0.3) for (let y = cy + 1; y < cy + LH - 1; y++) if (!(door && y >= cy + LH - 5)) set(x + 1, y, T.WALLPAPER);
      x += R(7, 16);
    }
    // holes down to the next level
    if (lv < LV - 1) for (let k = 0; k < R(3, 5); k++) { const hx = x0 + R(4, W_ - 8); for (let i = 0; i < 3; i++) { set(hx + i, cy + LH - 1, 0); set(hx + i, cy + LH, 0); } }
    // fluorescent lights (some broken => dark spots where Smilers hide)
    for (let lx = x0 + 2; lx < x0 + W_ - 2; lx += R(4, 7)) if (world.tile(lx, cy + 1) === 0) set(lx, cy + 1, T.FLUORESCENT, rng() < 0.22 ? 1 : 0);
  }
  // loot
  for (let k = 0; k < 9; k++) {
    const lv = R(0, LV - 1), cy = y0 + lv * LH, cx = x0 + R(3, W_ - 6);
    if (world.canPlaceObject(cx, cy + LH - 3, T.CHEST)) {
      world.placeObject(cx, cy + LH - 3, T.CHEST);
      const inv = world.chests[cx + ',' + (cy + LH - 3)];
      let s = 0;
      inv[s++] = { id: 'almond_water', count: R(2, 5) };
      if (rng() < 0.35) inv[s++] = { id: 'liminal_blade', count: 1 };
      if (rng() < 0.5) inv[s++] = { id: 'fluorescent_light', count: R(3, 8) };
      if (rng() < 0.3) inv[s++] = { id: 'labubu', count: 1 };
      inv[s++] = { id: 'wallpaper_block', count: R(20, 67) };
      inv[s++] = { id: 'gold_coin', count: R(1, 3) };
    }
  }
  // the exit (bottom level, far from the entry)
  const ex = x0 + (rng() < 0.5 ? R(4, 20) : R(W_ - 24, W_ - 6)), ey = y0 + (LV - 1) * LH + LH - 3;
  set(ex, ey, T.EXIT_SIGN);
  world.backrooms = { x0: x0 - 2, y0: y0 - 2, w: W_ + 4, h: H_ + 4, entry: [x0 + W_ - ex + x0 > x0 + W_ / 2 ? x0 + W_ - 10 : x0 + 10, y0 + LH - 2] };
}
function build67Monument(world, rng, x, withChest, tiny) {
  const s = tiny ? 1 : 2;
  const gw = 3 * s, gh = 5 * s;
  const y0 = topSolid(world, x);
  if (y0 < 0) return;
  const top = y0 - gh;
  let ox = x;
  for (const ch of '67') {
    const g = PIXFONT[ch];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === '1') {
      for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) {
        const tx = ox + q * s + a, ty = top + r * s + b;
        if (world.inb(tx, ty)) { world.tiles[world.idx(tx, ty)] = T.MEME67; world.liquid[world.idx(tx, ty)] = 0; }
      }
    }
    ox += gw + s;
  }
  if (withChest) {
    const cx = ox + 1;
    const cy = topSolid(world, cx) - 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (world.tile(cx + i, cy + j) && !TILES[world.tile(cx + i, cy + j)].solid) world.setTile(cx + i, cy + j, 0);
    if (world.canPlaceObject(cx, cy, T.CHEST)) {
      world.placeObject(cx, cy, T.CHEST);
      const inv = world.chests[cx + ',' + cy];
      inv[0] = { id: 'meme67_block', count: 67 };
      inv[1] = { id: 'dubai_chocolate', count: 6 };
      inv[2] = { id: 'silver_coin', count: 67 };
      inv[3] = { id: 'lesser_healing_potion', count: 7 };
    }
  }
}
function fillChest(world, x, y, rng, kind) {
  const inv = world.chests[x + ',' + y];
  if (!inv) return;
  const deep = y > world.rockLayer;
  if (!kind) kind = deep ? 'gold' : 'wood';
  let slot = 0;
  const put = (id, n) => { if (slot < 40) inv[slot++] = { id, count: n }; };
  const R = (a, b) => randInt(a, b, rng);
  const tables = {
    wood: ['spear', 'wooden_boomerang', 'umbrella', 'aglet', 'wand_of_sparking', 'hermes_boots', 'cloud_in_a_bottle'],
    gold: ['band_of_regeneration', 'magic_mirror', 'cloud_in_a_bottle', 'hermes_boots', 'enchanted_boomerang', 'magic_mirror', 'feral_claws', 'water_bolt', 'magic_missile', 'lucky_horseshoe'],
    ohio: ['flamelash', 'demon_scythe', 'cobalt_shield', 'obsidian_skull', 'rocket_boots'],
  };
  put(pick(tables[kind], rng), 1);
  if (rng() < 0.02) put('labubu', 1);
  if (rng() < 0.15) put('dubai_chocolate', R(1, 2));
  const bars = kind === 'wood' ? ['copper_bar', 'iron_bar'] : kind === 'gold' ? ['silver_bar', 'gold_bar', 'iron_bar'] : ['hellstone_bar', 'gold_bar'];
  if (rng() < 0.5) put(pick(bars, rng), R(3, 10));
  if (rng() < 0.5) put(kind === 'ohio' ? 'obsidian_skin_potion' : pick(['ironskin_potion', 'regeneration_potion', 'swiftness_potion', 'night_owl_potion', 'spelunker_potion', 'battle_potion'], rng), R(1, 2));
  if (rng() < 0.6) put('lesser_healing_potion', R(3, 5));
  if (rng() < 0.4) put(kind === 'wood' ? 'wooden_arrow' : pick(['flaming_arrow', 'wooden_arrow'], rng), R(25, 50));
  if (rng() < 0.5) put('torch', R(10, 20));
  if (rng() < 0.3) put(pick(['shuriken', 'throwing_knife', 'bomb', 'glowstick'], rng), R(10, 25));
  if (rng() < 0.3) put('recall_potion', R(1, 3));
  put('silver_coin', R(kind === 'wood' ? 1 : 5, kind === 'ohio' ? 90 : 40));
}
