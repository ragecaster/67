// The Wall plan's late phases without the long digging: the hell elevator shaft and the Wall tunnel are carved into the
// world (as Bot.digShaft / Bot.digTunnel leave them), then the bot runs taskHell from the chute on: rope down to the
// island, the doll hunt, the throw, the climb back up into the tunnel and the fight.
// usage: node tunnelflow.js [ticks] [every]   env: SEED, PH (start phase, default chute), DOLL=1 (start with the doll),
//        SWIFT=1 (a cappuccino in the bag), KILLAT=<tick> (die once there: the respawn path), GOD=1
const run = require('./harness');
const { applyStage } = require('./stagelib');
const TICKS = +process.argv[2] || 60000, EVERY = +process.argv[3] || 2000;
run(async (page) => {
  await page.newGame(process.env.SEED || 'bot67');
  await applyStage(page, 'hell');
  const env = { PH: process.env.PH || 'chute', DOLL: !!process.env.DOLL, SWIFT: !!process.env.SWIFT, KILLAT: +process.env.KILLAT || 0, GOD: !!process.env.GOD };
  console.log(await page.evaluate((env) => {
    const w = G.world, p = G.player;
    for (const k of ['king_slime', 'eye_of_cthulhu', 'tung_sahur']) w.flags[k] = true;
    const H = Bot.findIsland(Bot.feet()[0]);
    if (!H) return 'no site';
    Bot.hell = H; Object.assign(H, { ph: env.PH, top: topSolid(w, H.sx), bot: H.F - 1 });
    const F = H.F, dir = H.dir, sx = H.sx;
    // the shaft: 2 wide, a rung every 15 rows
    for (let y = H.top; y <= F - 1; y++) for (const x of [sx, sx + 1]) { w.setTile(x, y, 0); w.liquid[w.idx(x, y)] = 0; }
    for (let y = H.top + 18; y < F - 3; y += 15) for (const x of [sx, sx + 1]) w.setTile(x, y, T.PLATFORM);
    // the tunnel (with the nook past the chute) as digTunnel leaves it
    const a = dir > 0 ? sx - 2 : sx + 4, b = H.xEnd;
    for (let x = Math.min(a, b); x <= Math.max(a, b); x++) {
      for (let y = F - 3; y <= F + 4; y++) { w.setTile(x, y, 0); w.liquid[w.idx(x, y)] = 0; }
      w.setTile(x, F, T.PLATFORM);
    }
    Bot.milestones.house = 1;
    G.spawnNPC('guide', Bot.base ? Bot.base[0] * TS : p.cx, ((Bot.base && Bot.base[1]) || 150) * TS - 40);
    invAdd(p.inv, 'rope', 80); invAdd(p.inv, 'wood_platform', 60); invAdd(p.inv, 'healing_potion', 10);
    if (env.DOLL) invAdd(p.inv, 'guide_voodoo_doll', 1);
    if (env.SWIFT) invAdd(p.inv, 'cappuccino', 2);
    if (env.GOD) G.godMode = true;
    p.x = (sx + 1) * TS - p.w / 2; p.y = F * TS - p.h; p.vx = p.vy = 0; G.snapCamera && G.snapCamera();
    Bot.task = null; window.__site = JSON.stringify(H);
    return 'site ' + window.__site;
  }, env));
  let killed = false;
  for (let done = 0; done < TICKS; done += EVERY) {
    const s = await page.evaluate(([n, KILLAT]) => {
      const o = [];
      for (let i = 0; i < n; i++) {
        if (!G.player.dead && (!Bot.task || Bot.task.done) && !Bot.uiBusy && !G.world.flags.wall_of_flesh) { Bot.task = Bot.taskHell(); Bot.taskAge = 1; }
        if (KILLAT && G.tick >= KILLAT && !window.__killed) { window.__killed = 1; G.player.kill('enemy', null); o.push('KILLED at ' + G.tick); }
        Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
        if (G.world.flags.wall_of_flesh) break;
      }
      const p = G.player, nl = Bot.logLines.slice(window.__seen || 0); window.__seen = Bot.logLines.length;
      const wall = G.npcs.find(n => n.type === 'wall_of_flesh');
      return { t: G.tick, goal: Bot.goal, feet: Bot.feet(), ph: Bot.hell && Bot.hell.ph, why: Bot.why, dbg: Bot.dbg, life: Math.round(p.life), wall: wall ? Math.round(wall.life) + ' x=' + Math.round(wall.x / TS) : '', won: G.world.flags.wall_of_flesh, logs: nl.slice(-8).concat(o), doll: Bot.count('guide_voodoo_doll'), deaths: Bot.deaths, swift: !!p.buffs.swiftness };
    }, [EVERY, env.KILLAT]);
    console.log(`t=${s.t} [${s.ph}] ${s.goal} | feet ${s.feet} life ${s.life} why ${s.why} dbg ${(s.dbg || '').slice(0, 60)} wall[${s.wall}] doll ${s.doll} swift ${s.swift} deaths ${s.deaths}`);
    for (const l of s.logs) console.log('   > ' + l);
    if (s.won) { console.log('WALL DEFEATED at ' + s.t); break; }
  }
});
