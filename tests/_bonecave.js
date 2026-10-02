// where would bones be easy? score cavern-layer standable spots by open space around them, drop the bot at the best one (TEST shortcut) and run the bone farm
const run = require('./harness');
const [SEED, TICKS, PICK] = [process.argv[2] || 'evalB', +(process.argv[3] || 20000), +(process.argv[4] || 0)];
run(async (page) => {
  await page.newGame(SEED);
  const r = await page.evaluate(([T, PICK]) => {
    const w = G.world, cands = [];
    for (let y = w.rockLayer + 10; y < w.hellLayer - 25; y += 3) for (let x = 40; x < w.w - 40; x += 3) {
      if (!w.solid(x, y + 1) || w.solid(x, y) || w.solid(x, y - 1) || w.solid(x, y - 2)) continue;
      let open = 0; for (let j = -12; j <= 6; j += 2) for (let i = -30; i <= 30; i += 3) if (!w.solid(x + i, y + j)) open++;
      cands.push({ x, y, open, d: Math.abs(x - w.spawnX) });
    }
    cands.sort((a, b) => b.open - a.open);
    const best = cands.slice(0, 40).sort((a, b) => a.d - b.d)[PICK] || cands[0];
    TerraJev.mode = 'teacher'; Bot.start(1);
    const p = G.player; p.lifeMax = 140; p.life = 140;
    invAdd(p.inv, 'the_67', 1); invAdd(p.inv, 'dirt_block', 100); invAdd(p.inv, 'iron_pickaxe', 1); invAdd(p.inv, 'wood', 40);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    Bot.base = [w.spawnX, w.spawnY]; Bot.houseSpot = Bot.base; Bot.houseValid = () => true;
    p.x = best.x * TS; p.y = (best.y + 1) * TS - p.h; p.vx = p.vy = 0; G.snapCamera();
    G.world.dayTime = true; G.world.time = 0;
    const tp = Bot.teacherPick.bind(Bot); Bot.teacherPick = (c, f) => f.length || !c.some(x => x.id === 'boss:tung_sahur') ? tp(c, f) : 'boss:tung_sahur';
    let at = null;
    for (let i = 0; i < T; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame(); if (Bot.count('bone') >= 7 && at === null) at = i; }
    return { best, spot: best.x + ',' + best.y, bone: Bot.count('bone'), at, deaths: Bot.deaths, goal: Bot.goal };
  }, [TICKS, PICK]);
  console.log(SEED, JSON.stringify(r));
});
