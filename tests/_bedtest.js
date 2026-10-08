// The bed by a far hell elevator: from wood, 2 iron bars and cobwebs (or GIVE_BED=1) to a spawn point by the shaft's mouth.
const run = require('./harness');
run(async (page) => {
  await page.newGame(process.env.SEED || 'evalE');
  console.log(await page.evaluate(([giveBed, webs]) => {
    const w = G.world, p = G.player;
    Bot.start(1); Bot.WALL_FIRST = true;
    invAdd(p.inv, 'gold_pickaxe', 1); invAdd(p.inv, 'the_67', 1); invAdd(p.inv, 'wood', 200); invAdd(p.inv, 'iron_bar', 4); invAdd(p.inv, 'wood_platform', 300);
    if (webs) invAdd(p.inv, 'cobweb', webs);
    if (giveBed) invAdd(p.inv, 'bed', 1);
    p.lifeMax = p.life = 400;
    Bot.base = Bot.feet();
    for (const id of ['work_bench']) { const sp = Bot.findSpotAroundBase(id), t = ITEMS[id].place, td = TILES[t]; if (sp) w.placeObject(sp[0] - (td.multi ? Math.floor((td.multi[0] - 1) / 2) : 0), sp[1] - (td.multi ? td.multi[1] - 1 : 0), t); }
    Bot.houseSpot = Bot.feet(); Bot.houseValid = () => true; Bot.houseFinished = true; Bot.milestones.house = 1;
    let B = null; for (const L of [600, 520, 450]) { Bot.BRIDGE_LEN = L; B = Bot.findBridge(Bot.base[0]); if (B) { B.len = L; break; } }
    Bot.hell = Object.assign({}, B, { bridge: true, ph: 'ride', top: topSolid(w, B.sx), R: B.y - 20, moltenSkip: true });
    Bot.needDecision = () => false;
    let t = 0; Bot.task = null; const o = ['site sx ' + B.sx + ' base ' + Bot.base[0]];
    for (; t < 60000; t++) {
      if (!G.player.dead && (!Bot.task || Bot.task.done) && !Bot.uiBusy) { Bot.task = Bot.taskHell(); Bot.act = { id: 'hell', kind: 'hell' }; }
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      if (t % 3000 === 0) o.push(t + ' ' + Bot.goal + ' @' + Bot.feet() + ' webs ' + Bot.count('cobweb') + ' silk ' + Bot.count('silk'));
      if (p.bedX != null) break;
      if (Bot.hell.noBed) break;
    }
    o.push('done t=' + t + ' bed ' + p.bedX + ',' + p.bedY + ' noBed ' + Bot.hell.noBed + ' deaths ' + Bot.deaths);
    return o.concat(Bot.logLines.filter(l => /bed|loom|sawmill|silk|commit/i.test(l)).slice(-12)).join('\n');
  }, [!!process.env.GIVE_BED, +process.env.WEBS || 0]));
});
