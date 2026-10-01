// usage: node planlog.js <ticks> [seed]: runs the bot and dumps the last A* plans (what is it replanning for?)
const run = require('./harness');
run(async (page) => {
  await page.newGame(process.argv[3] || 'bot67');
  await page.evaluate(() => { Bot.start(1); });
  await page.evaluate((n) => { for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); } }, +process.argv[2] || 8000);
  console.log((await page.evaluate(() => Bot.planLog.slice(-45))).join('\n'));
});
