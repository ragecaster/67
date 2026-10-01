// Test-only inventory shortcuts so later bot stages can be exercised without playing the early game.
// usage: await applyStage(page, 'iron'|'gold'|'lenses'|'demon'|'hell')
async function applyStage(page, STAGE) {
  await page.evaluate((stage) => {
    const p = G.player;
    const give = (id, n = 1) => invAdd(p.inv, id, n);
    give('wood', 150); give('stone_block', 100); give('torch', 40); give('dirt_block', 150); give('lesser_healing_potion', 8);
    if (stage !== 'iron' && stage !== 'eyefight') { for (const id of ['iron_pickaxe', 'iron_broadsword']) give(id); p.armor[0] = { id: 'iron_helmet', count: 1 }; p.armor[1] = { id: 'iron_chainmail', count: 1 }; p.armor[2] = { id: 'iron_greaves', count: 1 }; }
    if (stage === 'gold' || stage === 'lenses' || stage === 'demon' || stage === 'hell') { give('gold_pickaxe'); give('gold_broadsword'); p.lifeMax = 200; p.life = 200; }
    if (stage === 'lenses' || stage === 'demon' || stage === 'hell') give('lens', 6);
    if (stage === 'eyefight') { for (const id of ['iron_pickaxe', 'gold_broadsword', 'gold_bow', 'suspicious_looking_eye']) give(id); give('wooden_arrow', 999); p.armor[0] = { id: 'gold_helmet', count: 1 }; p.armor[1] = { id: 'gold_chainmail', count: 1 }; p.armor[2] = { id: 'gold_greaves', count: 1 }; p.lifeMax = 300; p.life = 300; }
    if (stage === 'demon' || stage === 'hell') {
      G.world.flags.eye_of_cthulhu = true; give('iron_bar', 40); give('gold_bow'); give('wooden_arrow', 999);
      p.armor[0] = { id: 'gold_helmet', count: 1 }; p.armor[1] = { id: 'gold_chainmail', count: 1 }; p.armor[2] = { id: 'gold_greaves', count: 1 }; p.lifeMax = 300; p.life = 300;
    }
    if (stage === 'hell') { give('nightmare_pickaxe'); give('demonite_bar', 12); p.lifeMax = 300; p.life = 300; }
    Bot.start(1); Bot.verbose = false; window.__seen = 0;
  }, STAGE);
}
module.exports = { applyStage };
