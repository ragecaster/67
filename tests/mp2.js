const { chromium } = require('playwright');
const exe = process.env.CHROME_PATH || undefined;
(async () => {
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const errors = [];
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(tag + ' PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    page.on('console', m => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
    await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
    await page.waitForFunction(() => typeof G !== 'undefined' && G.state === 'menu', null, { timeout: 30000 });
    await page.evaluate(() => { SETTINGS.tts = false; SETTINGS.sfx = 0; SETTINGS.music = 0; });
    return page;
  };
  const host = await mk('HOST'), client = await mk('CLIENT');
  await host.evaluate(() => {
    const it = generateWorld('MP World', '4242', 'small'); let r; while (!(r = it.next()).done) {}
    G.start(new Player('HostSigma', null, 0), r.value); Net.host();
  });
  await host.waitForFunction(() => Net.code, null, { timeout: 30000 });
  const code = await host.evaluate(() => Net.code);
  console.log('room code', code);
  const t0 = Date.now();
  await client.evaluate((code) => { Net.join(code, new Player('ClientRizz', null, 0), () => {}); }, code);
  for (let i = 0; i < 12; i++) { await client.waitForTimeout(2500); console.log(await client.evaluate(() => ({ status: Net.status, peerOpen: Net.peer && Net.peer.open, id: Net.peer && Net.peer.id, connOpen: Net.hostConn && Net.hostConn.open, ice: Net.hostConn && Net.hostConn.peerConnection && Net.hostConn.peerConnection.iceConnectionState })), await host.evaluate(() => ({ conns: Net.conns.length, pcs: Net.peer && Object.keys(Net.peer.connections).length }))); if (await client.evaluate(() => G.state === "play")) break; }
  try { await client.waitForFunction(() => G.state === 'play' && Net.isClient, null, { timeout: 60000 }); }
  catch (e) { console.log('join failed; status:', await client.evaluate(() => Net.status)); console.log(errors.join('\n')); await browser.close(); return; }
  console.log('joined in', Date.now() - t0, 'ms');
  await client.waitForTimeout(1500);
  console.log('client sees', await client.evaluate(() => ({ world: G.world.name, remotes: Object.values(G.remotes).map(r => r.name), npcs: G.npcs.map(n => n.type), tilesMatch: G.world.tiles.length })));
  console.log('host sees', await host.evaluate(() => ({ remotes: Object.values(G.remotes).map(r => [r.name, r.x | 0, r.y | 0]) })));
  // tile sync: client breaks the block under itself
  const tile = await client.evaluate(() => { const p = G.player; const x = p.cx / TS | 0, y = ((p.y + p.h) / TS | 0); let yy = y; while (!TILES[G.world.tile(x, yy)]?.block) yy++; const before = G.world.tile(x, yy); G.world.breakTile(x, yy, true); return [x, yy, before, G.world.tile(x, yy)]; return [x, y, before, G.world.tile(x, y)]; });
  await client.waitForTimeout(800);
  console.log('client broke', tile, 'host now has', await host.evaluate(([x, y]) => G.world.tile(x, y), tile));
  // drop sync: the dirt dropped on the client should exist on host & be picked up by the client
  await client.waitForTimeout(1500);
  console.log('client dirt', await client.evaluate(() => invCount(G.player.inv, 'dirt_block') + invCount(G.player.inv, 'stone_block')), 'host items', await host.evaluate(() => G.items.length));
  // npc sync + damage: host spawns a slime next to the client player
  await host.evaluate(() => { const rp = Object.values(G.remotes)[0]; const n = G.spawnNPC('blue_slime', rp.cx + 60, rp.y + rp.h); n.testSlime = true; window.__uid = n.uid; });
  await client.waitForTimeout(800);
  const uid = await host.evaluate(() => window.__uid);
  const cs = await client.evaluate((uid) => { const n = G.npcs.find(n => n.netUid === uid); if (!n) return 'no slime'; n.takeDamage(10, 3, 1, 0, true); return [n.netUid, n.life]; }, uid);
  await client.waitForTimeout(800);
  console.log('client saw slime', cs, 'host slime life', await host.evaluate(() => { const n = G.npcs.find(n => n.uid === window.__uid); return n ? n.life + '/' + n.lifeMax : 'dead'; }));
  // chat
  await client.evaluate(() => G.sendChat('six seven chat test'));
  await host.waitForTimeout(600);
  console.log('host chat', await host.evaluate(() => UI.chatLog.slice(-3).map(c => c.msg)));
  // host places a chest & fills it; client opens chest data
  const chest = await host.evaluate(() => { const p = G.player; const x = (p.cx / TS | 0) + 3; let y = (p.y + p.h) / TS | 0; y -= 2; const ok = G.world.canPlaceObject(x, y, T.CHEST); if (ok) { G.world.placeObject(x, y, T.CHEST); } return [x, y, ok]; });
  await host.waitForTimeout(800);
  console.log('chest placed', chest, 'client tile', await client.evaluate(([x, y]) => [G.world.tile(x, y), !!G.world.chests[x + ',' + y]], chest));
  // boss summon from client
  await client.evaluate(() => { G.world.dayTime = false; });
  await host.evaluate(() => { G.world.dayTime = false; G.world.time = 100; });
  await client.evaluate(() => G.trySummon('king_slime', G.player));
  await client.waitForTimeout(1500);
  console.log('boss on host', await host.evaluate(() => G.npcs.filter(n => n.boss).map(n => n.type)), 'client', await client.evaluate(() => G.npcs.filter(n => n.boss).map(n => n.type)));
  await host.screenshot({ path: 'mp_host.png' });
  await client.screenshot({ path: 'mp_client.png' });
  console.log('ERRORS:', errors.length, errors.slice(0, 10).join('\n'));
  await browser.close();
})();
