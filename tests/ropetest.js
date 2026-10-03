// Rope: placing (hang + extend), climbing up/down, letting go, and grabbing it mid-fall (no fall damage).
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    const w = G.world, p = G.player, out = {};
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    const x = Math.floor(p.cx / TS) + 6, top = topSolid(w, x);
    // a 40-row open shaft with a stone ceiling block to hang the rope from
    for (let y = top - 45; y < top; y++) for (let xx = x - 2; xx <= x + 2; xx++) w.setTile(xx, y, 0);
    w.setTile(x, top - 46, T.STONE);
    out.hangOk = w.placeTile(x, top - 45, T.ROPE);
    out.floatFails = !w.placeTile(x + 2, top - 30, T.ROPE);
    for (let i = 0; i < 44; i++) w.placeTile(x, top - 45, T.ROPE);   // clicking the rope extends its bottom
    let len = 0; for (let y = top - 45; w.tile(x, y) === T.ROPE; y++) len++;
    out.ropeLen = len;
    const tick = (keys, n) => { for (let i = 0; i < n; i++) { for (const k of keys) Input.keys[k] = true; G.update(); Input.endFrame(); for (const k of keys) Input.keys[k] = false; } };
    // stand at the bottom next to the rope, grab it (W) and climb
    p.x = x * TS + 8 - p.w / 2; p.y = top * TS - p.h - 0.5; p.vx = p.vy = 0; tick([], 10);
    const y0 = p.y; tick(['w'], 120); out.climbedRows = Math.round((y0 - p.y) / TS); out.onRope = !!p.onRope;
    tick([], 60); out.holdsStill = Math.abs(p.vy) < 0.01 && p.onRope;
    tick(['s'], 40); out.slidRows = Math.round((p.y - (y0 - out.climbedRows * TS)) / TS);
    tick([' '], 1); out.letGo = !p.onRope;
    // free fall from 40 rows up past a rope, grabbing it near the bottom
    p.onRope = false; p.x = x * TS + 8 - p.w / 2; p.y = (top - 45) * TS; p.vx = p.vy = 0; p.life = p.lifeMax; p.fallStart = null;
    for (let i = 0; i < 400 && !p.onGround; i++) { const near = p.y + p.h > (top - 6) * TS; if (near) Input.keys.w = true; G.update(); Input.endFrame(); Input.keys.w = false; if (p.onRope) break; }
    out.caughtOnRope = !!p.onRope; tick(['s'], 200); out.landedLife = Math.round(p.life) + '/' + p.lifeMax;
    // the same fall without grabbing: hurts
    p.onRope = false; p.x = (x + 2) * TS; p.y = (top - 45) * TS; p.vx = p.vy = 0; p.life = p.lifeMax; p.fallStart = null; p.immune = 0;
    for (let i = 0; i < 400 && !(p.onGround && i > 5); i++) { G.update(); Input.endFrame(); }
    out.noRopeLife = Math.round(p.life) + '/' + p.lifeMax;
    out.merchantSellsRope = SHOPS.merchant().includes('rope');
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
});
