// dump a small map + player box after N ticks from a snapshot: node replay3.js <snap> <ticks>
const run = require('./harness');
const { restore } = require('./snaplib');
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, process.argv[2]);
  
  const out = await page.evaluate((n) => {
    for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
    const w = G.world, p = G.player, o = [];
    o.push('player x ' + p.x.toFixed(1) + '..' + (p.x + p.w).toFixed(1) + ' y ' + p.y.toFixed(1) + '..' + (p.y + p.h).toFixed(1) + ' tiles x ' + Math.floor(p.x / TS) + '..' + Math.floor((p.x + p.w - 0.01) / TS) + ' rows ' + Math.floor(p.y / TS) + '..' + Math.floor((p.y + p.h - 0.01) / TS) + ' vy ' + p.vy + ' ground ' + p.onGround + ' h ' + p.h);
    const x0 = Math.floor(p.x / TS) - 4, y0 = Math.floor(p.y / TS) - 5;
    for (let y = y0; y <= y0 + 10; y++) { let s = ''; for (let x = x0; x <= x0 + 9; x++) { const t = w.tile(x, y); s += (t ? String(t).padStart(3) : '  .') + ' '; } o.push(s + ' row ' + y); }
    o.push('cols from ' + x0);
    o.push((Bot.planLog || []).slice(-6).join('\n')); o.push('dbg: ' + Bot.dbg + ' why=' + Bot.why + ' hb=' + JSON.stringify(Bot.hb) + ' uiBusy=' + Bot.uiBusy + ' invOpen=' + UI.invOpen + ' mouseItem=' + JSON.stringify(G.player.mouseItem) + ' task=' + (Bot.task ? Object.keys(Bot.task) : null)); o.push('keys: ' + JSON.stringify(Object.entries(Input.keys).filter(([k, v]) => v)) + ' goal ' + Bot.goal);
    return o;
  }, +process.argv[3]);
  console.log(out.join('\n'));
});
