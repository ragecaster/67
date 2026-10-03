// Shopping through the real UI: walk to the Merchant, talk, open the shop, buy N rope, stow the stack.
const run = require('./harness');
run(async (page) => {
  await page.newGame('bot67');
  const r = await page.evaluate(() => {
    TerraJev.mode = 'teacher'; Bot.start(1);
    for (let i = 0; i < 3; i++) { G.update(); Input.endFrame(); }
    const p = G.player; invAdd(p.inv, 'silver_coin', 20);
    const m = G.spawnNPC('merchant', p.cx + 120, p.y); m.name = 'Unc the Merchant'; m.shortName = 'Unc';
    const before = invMoney(p.inv);
    Bot.task = Bot.taskBuy('rope', 60); Bot.act = { id: 'test', kind: 'reflex', at: G.tick, life: p.life, seen: new Set() }; Bot.needDecision = () => false;
    const dbg = []; const ct = UI.closeTalk.bind(UI); UI.closeTalk = () => { if (UI.talk && dbg.length < 40) dbg.push('closeTalk at ' + G.tick + ' ' + new Error().stack.split('\n').slice(2, 6).map(l => l.trim().split(' ')[1]).join(' < ')); return ct(); }; const ia = G.interact.bind(G); let called = 0; G.interact = () => { called++; return ia(); };
    let t = 0; for (; t < 3000 && !Bot.task.done; t++) { Bot.wantsDraw = false; G.update(); if (false) dbg.push([t, Math.round(G.mouseWorldX()), Math.round(G.mouseWorldY()), Input.rClick, UI.mouseOverUI, !!UI.talk, called, Math.round(m.x), Math.round(m.y), Math.round(dist(m.cx, m.cy, p.cx, p.cy))].join(' ')); if (Bot.wantsDraw) G.draw(); Input.endFrame(); }
    return { ticks: t, rope: Bot.count('rope'), spent: before - invMoney(p.inv), expect: 60 * buyPrice('rope'), mouse: p.mouseItem, shopOpen: !!UI.shop, invOpen: UI.invOpen, log: Bot.logLines.slice(-3), dbg };
  });
  console.log(JSON.stringify(r));
});
