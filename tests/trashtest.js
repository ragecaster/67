// Full inventory of outgrown gear: does the bot shift-click it to the trash and keep The 67 / the best tools?
const run = require('./harness');
const { applyStage } = require('./stagelib');
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, 'gold');
  const r = await page.evaluate(() => {
    const p = G.player;
    for (const id of ['the_67', 'copper_pickaxe', 'iron_broadsword', 'copper_broadsword', 'gold_bow', 'iron_bow', 'copper_helmet', 'copper_greaves', 'tung_bat', 'copper_axe']) invAdd(p.inv, id, 1);
    invAdd(p.inv, 'wooden_arrow', 400);
    const fill = Object.keys(ITEMS).filter(id => ITEMS[id].place && !ITEMS[id].damage && Bot.count(id) === 0);
    for (const id of fill) { if (p.inv.slice(10).filter(s => !s).length <= 2) break; invAdd(p.inv, id, 3); }
    const before = p.inv.slice(10).filter(s => !s).length, trashed = [];
    const q0 = UI.quickMove.bind(UI); UI.quickMove = (arr, i) => { if (arr[i]) trashed.push(arr[i].id); return q0(arr, i); };
    for (let i = 0; i < 3000; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); }
    const has = id => Bot.count(id);
    return { freeBefore: before, freeAfter: p.inv.slice(10).filter(s => !s).length, trashed, keeps: { the_67: has('the_67'), gold_pickaxe: has('gold_pickaxe'), copper_pickaxe: has('copper_pickaxe'), gold_bow: has('gold_bow'), arrows: has('wooden_arrow') } };
  });
  console.log(JSON.stringify(r));
});
