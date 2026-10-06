// Spawn-rate bench: an invulnerable, idle player parked in a zone; counts hostile spawns per minute and the crowd size.
// SLAY=1 kills every hostile that comes within 30 tiles (a player actively fighting); OLD=1 runs HEAD's spawnEnemies.
// usage: node tests/_spawnbench.js <hell|cavern|night|day> [minutes] [seed]
const run = require('./harness');
const ZONE = process.argv[2] || 'hell', MIN = +process.argv[3] || 10, SEED = process.argv[4] || 'bot67';
const old = process.env.OLD ? (() => { const s = require('child_process').execSync('git show HEAD:src/game.js', { cwd: __dirname + '/..' }).toString();
  const a = s.indexOf('  spawnEnemies(p) {'), b = s.indexOf('  chooseSpawn('); return s.slice(a, b).trim().replace(/^spawnEnemies\(p\)/, 'function (p)').replace(/,$/, ''); })() : '';
run(async (page) => {
  await page.newGame(SEED);
  const r = await page.evaluate(([ZONE, MIN, old, SLAY]) => {
    if (old) G.spawnEnemies = eval('(' + old + ')');
    const w = G.world, p = G.player; G.godMode = true;
    const y0 = ZONE === 'hell' ? w.hellLayer + 5 : ZONE === 'cavern' ? Math.floor((w.rockLayer + w.hellLayer) / 2) : 0;
    let spot = null;
    for (let dx = 0; dx < w.w / 2 && !spot; dx++) for (const x of [Math.floor(w.w / 2) + dx, Math.floor(w.w / 2) - dx]) {
      for (let y = y0; y < (ZONE === 'hell' ? w.h - 5 : ZONE === 'cavern' ? w.hellLayer - 5 : w.worldSurface - 1); y++)
        if (!w.solid(x, y) && !w.solid(x, y - 1) && !w.solid(x, y - 2) && w.solid(x, y + 1) && !w.liq(x, y)) { spot = [x, y]; break; }
      if (spot) break;
    }
    const place = () => { p.x = spot[0] * TS; p.y = (spot[1] + 1) * TS - p.h; p.vx = p.vy = 0; p.life = p.lifeMax; };
    place();
    const seen = new Set(G.npcs), hostile = n => !n.friendly && !n.town && !n.boss && !n.dead;
    let spawns = 0, sum = 0, peak = 0, samples = 0; const types = {};
    for (let t = 0; t < MIN * 3600; t++) {
      if (ZONE === 'night' || ZONE === 'day') { w.dayTime = ZONE === 'day'; w.flags.bloodMoon = false; }
      place(); G.update(); Input.endFrame();
      for (const n of G.npcs) if (!seen.has(n)) { seen.add(n); if (hostile(n)) { spawns++; types[n.type] = (types[n.type] || 0) + 1; } }
      if (SLAY) for (const n of G.npcs) if (hostile(n) && Math.hypot(n.cx - p.cx, n.cy - p.cy) < 30 * TS) { n.dead = true; n.silentRemove = true; }
      if (t % 60 === 0) { const c = G.npcs.filter(n => hostile(n) && Math.abs(n.cx - p.cx) < 1000 && Math.abs(n.cy - p.cy) < 700).length; sum += c; peak = Math.max(peak, c); samples++; }
    }
    return { spot, perMin: (spawns / MIN).toFixed(1), avgNear: (sum / samples).toFixed(1), peakNear: peak, types };
  }, [ZONE, MIN, old, !!process.env.SLAY]);
  console.log(`${process.env.OLD ? 'OLD' : 'NEW'} ${ZONE}${process.env.SLAY ? ' slay' : ' idle'}: ${r.perMin} spawns/min, on/near screen avg ${r.avgNear} peak ${r.peakNear} | ${JSON.stringify(r.types)}`);
});
