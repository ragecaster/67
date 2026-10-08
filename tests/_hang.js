// Finds where the game hangs: runs a seed in small chunks; a chunk that takes over LIMIT s gets paused through the DevTools
// protocol and the JS call stack is printed. usage: node _hang.js <seed> [maxTicks] [chunk]   env: PRE, LIMIT (60)
const run = require('./harness');
const [SEED, MAX, CH] = [process.argv[2] || 'evalC', +process.argv[3] || 432000, +process.argv[4] || 600];
run(async (page) => {
  await page.newGame(SEED);
  await page.evaluate(() => { TerraJev.mode = 'teacher'; TerraJev.epsilon = 0; TerraJev.sample = false; Bot.start(1); });
  if (process.env.PRE) await page.evaluate((src) => eval(src), process.env.PRE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Debugger.enable');
  let paused = null; cdp.on('Debugger.paused', (e) => { paused = e; });
  for (let t = 0; t < MAX; t += CH) {
    const timer = setTimeout(() => { cdp.send('Debugger.pause').catch(() => {}); }, (+process.env.LIMIT || 60) * 1000);
    const pr = page.evaluate((n) => { for (let i = 0; i < n; i++) { Bot.wantsDraw = false; G.update(); if (Bot.wantsDraw || G.tick % 1200 === 0) G.draw(); Input.endFrame(); } return G.tick; }, CH);
    const res = await Promise.race([pr, new Promise(r => { const iv = setInterval(() => { if (paused) { clearInterval(iv); r('PAUSED'); } }, 200); })]);
    clearTimeout(timer);
    if (res === 'PAUSED') {
      console.log('HANG near tick', t, 'stack:');
      for (const f of paused.callFrames.slice(0, 25)) console.log('  ' + f.functionName + ' ' + f.url.split('/').pop() + ':' + (f.location.lineNumber + 1));
      const ev = async (expr) => { try { const r = await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: paused.callFrames[0].callFrameId, expression: expr, returnByValue: true }); return JSON.stringify(r.result.value); } catch (e) { return 'ERR ' + e.message; } };
      console.log('  tick', await ev('G.tick'), 'goal', await ev('Bot.goal'), 'feet', await ev('Bot.feet()'), 'H', await ev('JSON.stringify(Bot.hell)'));
      process.exit(0);
    }
    if (t % 24000 === 0) console.log('t=' + res);
  }
});
