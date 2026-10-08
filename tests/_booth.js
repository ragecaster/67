// The Backrooms entrance on the surface: where it is, a screenshot, and a right-click into it.
const run = require('./harness');
run(async (page) => {
  for (const seed of (process.env.SEEDS || 'evalA,evalB,evalC,evalD,evalE,evalF').split(',')) {
    await page.newGame(seed);
    const r = await page.evaluate(() => {
      const w = G.world, d = w.backroomsDoor, p = G.player;
      if (!d) return 'no booth';
      p.x = (d.x0 - 3) * TS; p.y = d.y * TS - p.h; p.vx = p.vy = 0; G.snapCamera();
      for (let i = 0; i < 30; i++) G.update(); G.draw();
      return 'booth ' + JSON.stringify(d) + ' spawn ' + w.spawnX + ' hinted ' + !!G.backroomsHinted;
    });
    console.log(seed, r);
    if (seed === (process.env.SHOT || 'evalA')) await page.screenshot({ path: process.env.OUT || 'booth.png' });
    // walk straight into the doorway: no teleport; right-click it: Level 0
    console.log(await page.evaluate(() => {
      const w = G.world, d = w.backroomsDoor, p = G.player; if (!d) return '';
      p.x = d.px * TS; p.y = d.y * TS - p.h; for (let i = 0; i < 10; i++) G.update();
      const touched = G.inBackrooms(p);
      p.x = (d.px - 2) * TS; p.y = d.y * TS - p.h; G.update();
      const cam = G.camera || G.cam; Input.mx = (d.px * TS + 8) - (G.camX != null ? G.camX : 0); 
      G.interact = G.interact; const mxw = G.mouseWorldX; G.mouseWorldX = () => d.px * TS + 8; const myw = G.mouseWorldY; G.mouseWorldY = () => (d.y - 2) * TS + 8;
      G.interact(); G.mouseWorldX = mxw; G.mouseWorldY = myw;
      return '   walk-in teleports: ' + touched + ', right-click: in Level 0 = ' + G.inBackrooms(p);
    }));
  }
});
