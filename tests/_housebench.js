// how many ticks until the house milestone on a seed (no bosses): node _housebench.js seed [maxTicks]
const run = require('./harness');
const [SEED, T] = [process.argv[2] || 'evalC', +(process.argv[3] || 60000)];
run(async (page) => {
  const V = !!process.env.V;
  await page.newGame(SEED);
  console.log(SEED, await page.evaluate(([T, process_v]) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < T; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); if (i % 3000 === 0 && process_v) (window.__o = window.__o || []).push(G.tick + ' ' + Bot.goal.slice(0, 80) + ' ' + Bot.feet());
      if (Bot.milestones.house) return (window.__o || []).join('\n') + '\n' + 'house at ' + G.tick + ' deaths ' + Bot.deaths; }
    return 'NO HOUSE by ' + T + ' deaths ' + Bot.deaths + ' goal ' + Bot.goal;
  }, [T, V]));
});
