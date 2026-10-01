const run = require('./harness');
const { applyStage } = require('./stagelib');
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, 'eyefight');
  console.log(await page.evaluate(() => { const p = G.player; const boss = { cx: p.cx, cy: p.cy - 250, def: { defense: 12 }, boss: true }; return JSON.stringify({ ws: Bot.bestWeaponSlot(boss), inv: p.inv.map((s, i) => s ? i + ':' + s.id : null).filter(Boolean), ammo: p.findAmmo('arrow'), bow: ITEMS.gold_bow }); }));
});
