// how many ticks until the house milestone on a seed (no bosses): node _housebench.js seed [maxTicks]
const run = require('./harness');
const [SEED, T] = [process.argv[2] || 'evalC', +(process.argv[3] || 60000)];
run(async (page) => {
  await page.newGame(SEED);
  console.log(SEED, await page.evaluate((T) => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < T; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); if (Bot.milestones.house) return 'house at ' + G.tick + ' deaths ' + Bot.deaths; }
    return 'NO HOUSE by ' + T + ' deaths ' + Bot.deaths + ' goal ' + Bot.goal;
  }, T));
});
