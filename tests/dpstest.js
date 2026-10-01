// Controlled DPS test: spawn a boss above the bot at night with no other mobs, hold a chosen weapon via Bot.fight, report damage dealt.
// usage: node dpstest.js <weaponId> [bossType] [ticks]
const run = require('./harness');
const { applyStage } = require('./stagelib');
const WEAPON = process.argv[2] || 'gold_bow', BOSS = process.argv[3] || 'eye_of_cthulhu', TICKS = +process.argv[4] || 1800;
run(async (page) => {
  await page.newGame('bot67');
  await applyStage(page, 'eyefight');
  await page.evaluate((g) => { window.__god = g; }, !!process.env.GOD);
  const out = await page.evaluate(([WEAPON, BOSS, TICKS]) => {
    const p = G.player, w = G.world;
    G.godMode = !!window.__god;
    // keep only the chosen weapon so the bot has no choice
    for (let i = 0; i < p.inv.length; i++) { const s = p.inv[i]; if (s && ITEMS[s.id].damage && !ITEMS[s.id].pick && !ITEMS[s.id].axe && s.id !== WEAPON && s.id !== 'wooden_arrow' && !ITEMS[s.id].ammoType) p.inv[i] = null; }
    w.dayTime = false;
    const boss = G.spawnNPC(BOSS, p.cx + (BOSS === 'tung_sahur' ? 350 : 0), p.cy - (BOSS === 'tung_sahur' ? 60 : 250));
    let shots = 0; const orig = G.spawnProjectile.bind(G);
    G.spawnProjectile = (...a) => { if (a[6] === p || (a[7] && a[7].owner === p)) shots++; else if (a[6] === p) shots++; return orig(...a); };
    const o = []; let t0 = boss.life; Bot.start(1); Bot.task = { step() {}, done: false };
    for (let i = 0; i < TICKS; i++) {
      w.dayTime = false;
      G.npcs = G.npcs.filter(n => n.boss || n.town || n.friendly);   // no other mobs
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || i % 1200 === 0) G.draw(); Input.endFrame();
      if (i % 300 === 299) o.push(`t=${i + 1} me ${Math.round(p.life)}/${p.lifeMax} boss ${Math.round(boss.life)}/${boss.lifeMax} dealt ${Math.round(t0 - boss.life)} shots ${shots} held ${(p.inv[p.sel] || {}).id} arrows ${Bot.count('wooden_arrow')} boss@${Math.round(boss.cx - p.cx)},${Math.round(boss.cy - p.cy)} st ${boss.state} goal ${Bot.goal} why ${Bot.why} projs ${G.projectiles.length} ui ${UI.invOpen} hb ${JSON.stringify(Bot.hb)}`);
    }
    return o;
  }, [WEAPON, BOSS, TICKS]);
  console.log(out.join('\n'));
});
