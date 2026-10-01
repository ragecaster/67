// replay a snapshot with the bot forced into taskHell, printing a fight sample every STEP ticks
const run = require('./harness');
const { capture } = require('./snaplib');
const { restore } = require('./snaplib');
const FILE = process.argv[2], MAX = +process.argv[3] || 3000, STEP = +process.argv[4] || 60;
run(async (page) => {
  await page.newGame('bot67');
  await restore(page, FILE);
  const CAPX = +process.env.CAPX || 0;
  let captured = false;
  const out = await page.evaluate(([MAX, STEP, process_env_god, FINE, NOMOB, CAPX, XEND, process_ring, TRACK]) => {
    window.__g = 1; const o = []; const ring = []; const k0 = G.player.stats.kills; let dmg = 0, prevLife = G.player.life; const dmgBy = {}; const seen = new Map(); if (XEND) Bot.hell.xEnd = XEND; if (process_env_god) G.godMode = true;
    for (let i = 0; i < MAX; i++) {
      if ((!Bot.task || Bot.task.done || !Bot.task.isHell) && !Bot.uiBusy && !Bot.hb) { Bot.task = Bot.taskHell(); Bot.task.isHell = true; Bot.taskAge = 1; }
      if (NOMOB) G.npcs = G.npcs.filter(n => n.friendly || n.town || n.type === 'guide');
      Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame();
      const p = G.player;
      if (TRACK) { if (p.life < prevLife) { dmg += prevLife - p.life; const src = G.deathCause; } p.life = p.lifeMax; prevLife = p.life; }
      if (process_ring) { ring.push(`${i} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} vx=${p.vx.toFixed(1)} vy=${p.vy.toFixed(1)} g=${p.onGround} life=${Math.round(p.life)} keys=${Object.keys(Input.keys).filter(k=>Input.keys[k]).join('')} why=${Bot.why.slice(0,24)} near=${G.npcs.filter(n => !n.friendly && !n.town && Math.hypot(n.cx - p.cx, n.cy - p.cy) < 200).map(n => n.name.split(' ').pop() + '@' + Math.round(n.cx - p.cx) + ',' + Math.round(n.cy - p.cy)).join(' ')}`); if (ring.length > 150) ring.shift(); if (Bot.feet()[1] >= 646 && Bot.hell && Bot.hell.ph === 'bridge') { o.push(...ring); o.push('FELL'); break; } }
      if (FINE && i < FINE) { const nn = Bot.nav && Bot.nav.path[Bot.nav.i]; o.push(`${i} t924=${G.world.tile(924,641)} t923=${G.world.tile(923,641)} cursor=${Math.floor(G.mouseWorldX()/16)},${Math.floor(G.mouseWorldY()/16)} x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} vx=${p.vx.toFixed(2)} vy=${p.vy.toFixed(2)} g=${p.onGround} held=${(p.inv[p.sel]||{}).id} keys=${Object.keys(Input.keys).filter(k=>Input.keys[k]).join('')} mclick=${Input.mClick} anim=${p.itemAnim} nav=${nn ? nn.move.t + '@' + nn.x + ',' + nn.y : '-'} why=${Bot.why}`); }
      if (!FINE && (i % STEP === 0 || p.dead)) {
        const foes = G.npcs.filter(n => !n.friendly && !n.town && Math.hypot(n.cx - p.cx, n.cy - p.cy) < 500).map(n => n.name.split(' ').pop() + ':' + Math.round(n.life) + '@' + Math.round(n.cx - p.cx) + ',' + Math.round(n.cy - p.cy));
        o.push(`${i} life ${Math.round(p.life)} @${Bot.feet()} ${Bot.goal.slice(0, 30)} why ${Bot.why} held ${(p.inv[p.sel] || {}).id} g=${p.onGround} | ${foes.join(' ')} | pr ${G.projectiles.filter(q => q.hostile).length} | nav ${Bot.nav && Bot.nav.path.length ? Bot.nav.i + '/' + Bot.nav.path.length + ' ' + (Bot.nav.path[Bot.nav.i] ? Bot.nav.path[Bot.nav.i].move.t + '@' + Bot.nav.path[Bot.nav.i].x + ',' + Bot.nav.path[Bot.nav.i].y : '-') : 'none'} H=${Bot.hell && Bot.hell.ph}`);
      }
      if (p.dead) { o.push('DEAD ' + G.deathCause); break; }
      if (CAPX && Bot.feet()[0] <= CAPX) { o.push('REACHED ' + Bot.feet()); window.__capNow = true; break; }
    }
    o.push('damage taken ' + Math.round(dmg) + ' in ' + MAX + ' ticks; kills ' + (G.player.stats.kills - k0));
    return o;
  }, [MAX, STEP, !!process.env.GOD, +process.env.FINE || 0, !!process.env.NOMOB, CAPX, +process.env.XEND || 0, !!process.env.RING, !!process.env.TRACK]);
  if (CAPX) { await capture(page, '/tmp/island_cap.json'); console.log('captured at x<=' + CAPX); }
  console.log(out.join('\n'));
});
