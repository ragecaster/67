// Bone farming bench: daytime, The 67, 140 life, kentongan wood in hand; the bot is pushed onto the Tung task (bones from the caverns).
// usage: node _bonebench.js [seed] [ticks]
const run = require('./harness');
const [SEED, TICKS] = [process.argv[2] || 'evalB', +(process.argv[3] || 30000)];
run(async (page) => {
  await page.newGame(SEED);
  const r = await page.evaluate(([T]) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    const p = G.player; p.lifeMax = 140; p.life = 140;
    invAdd(p.inv, 'the_67', 1); invAdd(p.inv, 'dirt_block', 100); invAdd(p.inv, 'iron_pickaxe', 1);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    Bot.base = Bot.feet(); Bot.houseSpot = Bot.feet(); Bot.houseValid = () => true;
    G.world.dayTime = true; G.world.time = 0; invAdd(p.inv, 'wood', 40);
    const tp = Bot.teacherPick.bind(Bot); Bot.teacherPick = (c, f) => f.length || !c.some(x => x.id === 'boss:tung_sahur') ? tp(c, f) : 'boss:tung_sahur';
    const spawn0 = G.spawnNPC.bind(G); const S = { eyes: 0, spawns: 0, eyeKills: 0, goals: {} };
    G.spawnNPC = (type, x, y) => { const n = spawn0(type, x, y); S.spawns++; if (type === 'skeleton' || type === 'undead_miner') S.eyes++; return n; };
    const seen = new Set();
    for (let i = 0; i < T; i++) {
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw) G.draw(); Input.endFrame();
      for (const n of G.npcs) if ((n.type === 'skeleton' || n.type === 'undead_miner') && n.dead && !seen.has(n.uid)) { seen.add(n.uid); if (n.life <= 0) S.eyeKills++; }
      if (i % 50 === 0) { const g = (Bot.goal || '-').replace(/\d+/g, '#').split(' ').slice(0, 3).join(' '); S.goals[g] = (S.goals[g] || 0) + 50; }
      if (Bot.count('bone') >= 7 && !S.at6) S.at6 = i;
    }
    return { ...S, bone: Bot.count('bone'), kentongan: Bot.has('kentongan'), deaths: Bot.deaths, crowdEnd: G.npcs.filter(n => !n.friendly && !n.town && !n.dead).length };
  }, [TICKS]);
  r.goals = Object.entries(r.goals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(SEED, JSON.stringify(r));
});
