// ---------- multiplayer (Terraria-style: the host owns the world, clients own their player) ----------
// Transport: WebRTC data channels via PeerJS (free public signaling server, peer-to-peer data).
// Host is authoritative for: NPCs/bosses/AI, enemy spawning, item drops, liquids, time/events, town NPCs.
// Every peer is authoritative for: its own player (movement, health, inventory) and the tiles it edits.
const NET_PREFIX = 'terrari67-v1-';
const PS_RATE = 3, NPC_RATE = 5, TIME_RATE = 120; // ticks between sends

async function gzipBytes(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function gunzipBytes(buf) {
  const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function toBuf(u8) { return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); }

const Net = {
  mode: null, peer: null, conns: [], hostConn: null, code: null, status: '', myId: 'host',
  applying: false, tileQueue: new Set(), itemUid: 1, npcMap: new Map(), lastChest: {},
  joinState: null,
  get active() { return !!this.mode; },
  get isHost() { return this.mode === 'host'; },
  get isClient() { return this.mode === 'client'; },

  peerOptions() {
    return { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } };
  },
  randomCode() {
    const words = ['SIGMA', 'RIZZ', 'OHIO', 'GYATT', 'SKIBIDI', 'FANUM', 'AURA', 'MEW', 'TUNG', 'COOKED', 'BUSSIN', 'DELULU'];
    return pick(words) + randInt(10, 99) + (Math.random() < 0.5 ? '67' : String(randInt(10, 99)));
  },

  // ================= hosting =================
  host() {
    if (typeof Peer === 'undefined') { G.chat('Multiplayer library failed to load (vendor/peerjs.min.js).', '#ff5a5a'); return; }
    const code = this.randomCode();
    this.status = 'Opening room...';
    this.peer = new Peer(NET_PREFIX + code, this.peerOptions());
    this.peer.on('open', () => {
      this.mode = 'host'; this.code = code; this.myId = 'host'; this.status = '';
      G.chat('Hosting! Room code: ' + code + '  — send it to your friend (Multiplayer > Join).', '#32ff82');
    });
    this.peer.on('connection', conn => this.acceptClient(conn));
    this.peer.on('error', e => {
      if (e.type === 'unavailable-id') { this.peer.destroy(); this.host(); return; }
      G.chat('Network error: ' + (e.type || e.message), '#ff5a5a');
    });
    this.peer.on('disconnected', () => { if (this.isHost && this.peer && !this.peer.destroyed) this.peer.reconnect(); });
  },
  acceptClient(conn) {
    conn.on('open', () => {
      this.conns.push(conn);
      conn.on('data', d => { try { this.onHostData(conn, d); } catch (e) { console.error('net host', e); } });
      conn.on('close', () => this.dropClient(conn));
      conn.on('error', () => this.dropClient(conn));
    });
  },
  dropClient(conn) {
    const i = this.conns.indexOf(conn);
    if (i < 0) return;
    this.conns.splice(i, 1);
    const rp = G.remotes[conn.peer];
    if (rp) { G.announce(rp.name + ' left the game. (Rage quit?)', '#ffd23a'); delete G.remotes[conn.peer]; }
    this.broadcast({ t: 'leave', pid: conn.peer });
  },
  send(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { console.warn('send failed', e); } },
  broadcast(msg, except) { for (const c of this.conns) if (c !== except) this.send(c, msg); },
  // send to everyone else (host: all clients, client: host)
  out(msg) { if (this.isHost) this.broadcast(msg); else if (this.isClient) this.send(this.hostConn, msg); },

  async sendWorld(conn) {
    const w = G.world;
    const meta = Save.serializeWorld(w).meta;
    this.send(conn, { t: 'wStart', meta, chests: w.chests, flipMap: w.flipMap || {} });
    for (const k of ['tiles', 'walls', 'frames', 'liquid', 'ltype', 'explored', 'surface']) {
      const arr = w[k];
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      this.send(conn, { t: 'wArr', k, data: toBuf(await gzipBytes(bytes)) });
    }
    const players = [this.playerHello(G.player, 'host')];
    for (const [pid, rp] of Object.entries(G.remotes)) if (pid !== conn.peer) players.push(this.playerHello(rp, pid));
    this.send(conn, { t: 'wEnd', npcs: this.npcSnapshot(), items: G.items.map(it => this.itemMsg(it)), players });
  },
  playerHello(p, pid) { return { pid, name: p.name, look: p.look }; },

  onHostData(conn, m) {
    switch (m.t) {
      case 'hello': {
        const rp = new Player(m.name, m.look, 0);
        rp.remote = true; rp.pid = conn.peer;
        rp.x = G.world.spawnX * TS; rp.y = G.world.spawnY * TS - 42;
        G.remotes[conn.peer] = rp;
        this.sendWorld(conn);
        this.broadcast({ t: 'join', pid: conn.peer, name: m.name, look: m.look }, conn);
        G.announce(m.name + ' has joined. (W friend)', '#32ff82');
        break;
      }
      case 'ps': { const rp = G.remotes[conn.peer]; if (rp) this.applyPS(rp, m); m.pid = conn.peer; this.broadcast(m, conn); break; }
      case 'tiles': this.applyTiles(m.a); this.broadcast(m, conn); break;
      case 'liq': this.applyLiq(m.a); this.broadcast(m, conn); break;
      case 'proj': m.pid = conn.peer; this.spawnRemoteProj(m); this.broadcast(m, conn); break;
      case 'hit': { const n = G.npcs.find(n => n.uid === m.u); if (n && !n.dead) { G.suppress67 = true; n.takeDamage(m.d, m.kb, m.dir, 0, true); G.suppress67 = false; } break; }
      case 'drop': { const d = G.dropItem(m.x, m.y, m.id, m.c); if (d && m.vx != null) for (const it of d) { it.vx = m.vx; it.vy = m.vy; it.noGrab = m.ng || 25; } break; }
      case 'pick': {
        const it = G.items.find(i => i.iid === m.iid && i.life > 0);
        if (!it) break;
        it.life = 0;
        this.send(conn, { t: 'give', id: it.id, c: it.count });
        break;
      }
      case 'chest': this.applyChest(m); this.broadcast(m, conn); break;
      case 'chat': G.chat(m.msg, m.color || '#fff'); this.broadcast(m, conn); break;
      case 'summon': { const rp = G.remotes[conn.peer]; if (rp && !G.npcs.some(n => n.type === m.type)) G.summonBoss(m.type, rp); break; }
      case 'voodoo': G.voodooInLava({ x: m.x, y: m.y }, G.remotes[conn.peer]); break;
    }
  },

  // ================= joining =================
  join(code, player, onDone) {
    if (typeof Peer === 'undefined') { this.status = 'Multiplayer library failed to load.'; return; }
    code = code.trim().toUpperCase();
    this.status = 'Connecting to ' + code + '...';
    this.localPlayer = player;
    this.peer = new Peer(undefined, this.peerOptions());
    this.peer.on('open', id => {
      this.myId = id;
      const conn = this.peer.connect(NET_PREFIX + code, { reliable: true });
      this.hostConn = conn;
      conn.on('open', () => { this.status = 'Downloading world...'; this.send(conn, { t: 'hello', name: player.name, look: player.look }); });
      conn.on('data', d => { try { this.onClientData(d); } catch (e) { console.error('net client', e); } });
      conn.on('close', () => this.lostHost());
      conn.on('error', () => this.lostHost());
    });
    this.peer.on('error', e => {
      this.status = e.type === 'peer-unavailable' ? 'No room with code ' + code + '. Check the code (it is case-insensitive).' : 'Network error: ' + (e.type || e.message);
      if (this.mode !== 'client') { this.peer.destroy(); this.peer = null; }
    });
    this.joinState = { arrays: {}, onDone };
  },
  lostHost() {
    if (!this.isClient) { this.status = 'Connection closed.'; return; }
    G.chat('Lost connection to the host. (They logged off or the connection dropped.)', '#ff5a5a');
    this.leave(true);
  },
  async onClientData(m) {
    const js = this.joinState;
    // until the world is unpacked, only world-transfer messages matter (the snapshot covers the rest)
    if (!this.isClient && !['wStart', 'wArr', 'wEnd', 'join', 'leave'].includes(m.t)) return;
    switch (m.t) {
      case 'wStart': js.meta = m.meta; js.chests = m.chests; js.flipMap = m.flipMap; this.status = 'Downloading world...'; break;
      case 'wArr': js.arrays[m.k] = m.data; this.status = 'Downloading world... (' + Object.keys(js.arrays).length + '/7)'; break;
      case 'wEnd': {
        this.status = 'Unpacking world...';
        const meta = js.meta;
        const d = { meta, chests: js.chests, flipMap: js.flipMap, townNPCs: [] };
        const types = { tiles: Uint8Array, walls: Uint8Array, frames: Uint8Array, liquid: Uint8Array, ltype: Uint8Array, explored: Uint8Array, surface: Int16Array };
        for (const [k, T_] of Object.entries(types)) { const u8 = await gunzipBytes(js.arrays[k]); d[k] = new T_(u8.buffer, 0, u8.byteLength / T_.BYTES_PER_ELEMENT); }
        const world = Save.loadWorld(d);
        this.mode = 'client';
        G.start(this.localPlayer, world, { client: true });
        for (const p of m.players) this.addRemote(p.pid, p.name, p.look);
        this.applyNPCs(m.npcs);
        for (const im of m.items) this.spawnItem(im);
        this.status = '';
        G.chat('Connected! Playing on ' + world.name + ' hosted by ' + (G.remotes.host ? G.remotes.host.name : 'the host') + '.', '#32ff82');
        js.onDone && js.onDone();
        break;
      }
      case 'join': this.addRemote(m.pid, m.name, m.look); break;
      case 'leave': delete G.remotes[m.pid]; break;
      case 'ps': { const rp = G.remotes[m.pid || 'host']; if (rp) this.applyPS(rp, m); break; }
      case 'npcs': this.applyNPCs(m.a); break;
      case 'tiles': this.applyTiles(m.a); break;
      case 'liq': this.applyLiq(m.a); break;
      case 'proj': this.spawnRemoteProj(m); break;
      case 'item': this.spawnItem(m); break;
      case 'itemGone': { const s = new Set(m.a); for (const it of G.items) if (s.has(it.iid)) it.life = 0; break; }
      case 'give': { G.player.receiveItem(m.id, m.c); break; }
      case 'time': this.applyTime(m); break;
      case 'chest': this.applyChest(m); break;
      case 'chat': G.chat(m.msg, m.color || '#fff'); break;
      case 'hurt': G.player.hurt(m.d, m.dir, { name: m.src }, 'enemy'); break;
      case 'victory': G.showVictory(); break;
    }
  },
  addRemote(pid, name, look) {
    const rp = new Player(name, look, 0);
    rp.remote = true; rp.pid = pid;
    G.remotes[pid] = rp;
  },
  leave(toMenu) {
    const wasClient = this.isClient;
    try { if (this.peer) this.peer.destroy(); } catch (e) { }
    this.peer = null; this.conns = []; this.hostConn = null; this.mode = null; this.code = null;
    this.npcMap.clear(); this.tileQueue.clear();
    G.remotes = {};
    if (toMenu && wasClient && G.state === 'play') G.saveAndExit();
  },

  // ================= per-tick sync =================
  tick() {
    if (!this.active || !G.world) return;
    const t = G.tick;
    if (t % PS_RATE === 0) this.out(this.playerState(G.player));
    if (this.tileQueue.size) this.flushTiles();
    if (this.isHost && this.conns.length) {
      if (t % NPC_RATE === 0) this.broadcast({ t: 'npcs', a: this.npcSnapshot() });
      if (t % TIME_RATE === 0) { const w = G.world; this.broadcast({ t: 'time', time: w.time, dayTime: w.dayTime, day: w.day, flags: w.flags }); }
      if (Liquid.changed.size) {
        const a = [];
        for (const i of Liquid.changed) a.push(i, G.world.liquid[i], G.world.ltype[i]);
        Liquid.changed.clear();
        for (let k = 0; k < a.length; k += 30000) this.broadcast({ t: 'liq', a: a.slice(k, k + 30000) });
      }
    } else Liquid.changed.clear();
    this.syncOpenChest();
  },
  playerState(p) {
    const s = p.held();
    return {
      t: 'ps', x: Math.round(p.x), y: Math.round(p.y), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), d: p.dir, og: p.onGround ? 1 : 0,
      l: Math.ceil(p.life), lm: p.lifeMax, dead: p.dead ? 1 : 0, held: s ? s.id : null, ua: p.useItem ? p.useItem.id : null,
      ia: p.itemAnim, iam: p.itemAnimMax, ang: +p.useAngle.toFixed(3), em: p.emote, ar: p.armor.map(a => a ? a.id : null),
      hk: p.hook ? [Math.round(p.hook.x), Math.round(p.hook.y)] : 0, aura: p.buffs.aura ? 1 : 0,
    };
  },
  applyPS(rp, m) {
    rp.tx = m.x; rp.ty = m.y;
    if (rp.x === 0 && rp.y === 0 || Math.abs(rp.x - m.x) > 400 || Math.abs(rp.y - m.y) > 400) { rp.x = m.x; rp.y = m.y; }
    rp.vx = m.vx; rp.vy = m.vy; rp.dir = m.d; rp.onGround = !!m.og; rp.life = m.l; rp.lifeMax = m.lm; rp.dead = !!m.dead;
    rp.inv[0] = m.held ? { id: m.held, count: 1 } : null; rp.sel = 0;
    rp.useItem = m.ua ? ITEMS[m.ua] : null; rp.itemAnim = m.ia; rp.itemAnimMax = m.iam || 1; rp.useAngle = m.ang;
    rp.emote = m.em; rp.armor = m.ar.map(id => id ? { id, count: 1 } : null);
    rp.hook = m.hk ? { x: m.hk[0], y: m.hk[1], state: 'latched' } : null;
    if (m.aura) rp.buffs.aura = 60; else delete rp.buffs.aura;
  },
  // remote players: smooth toward their last reported position
  updateRemotes() {
    for (const rp of Object.values(G.remotes)) {
      if (rp.tx != null) { rp.x = lerp(rp.x, rp.tx + rp.vx, 0.35); rp.y = lerp(rp.y, rp.ty + rp.vy, 0.35); }
      if (rp.onGround && Math.abs(rp.vx) > 0.1) rp.walkFrame += Math.abs(rp.vx) * 0.12; else if (rp.onGround) rp.walkFrame = 0;
      if (rp.itemAnim > 0) rp.itemAnim--;
      if (rp.emote > 0) rp.emote--;
      if (rp.hurtFlash > 0) rp.hurtFlash--;
    }
  },

  // ----- tiles -----
  queueTile(x, y) { this.tileQueue.add(y * G.world.w + x); },
  flushTiles() {
    const w = G.world, a = [];
    for (const i of this.tileQueue) a.push(i, w.tiles[i], w.frames[i], w.walls[i]);
    this.tileQueue.clear();
    for (let k = 0; k < a.length; k += 40000) this.out({ t: 'tiles', a: a.slice(k, k + 40000) });
  },
  applyTiles(a) {
    const w = G.world;
    this.applying = true;
    for (let k = 0; k < a.length; k += 4) {
      const i = a[k], x = i % w.w, y = (i / w.w) | 0;
      if (w.tiles[i] !== a[k + 1] || w.frames[i] !== a[k + 2]) w.setTile(x, y, a[k + 1], a[k + 2]);
      if (w.walls[i] !== a[k + 3]) w.setWall(x, y, a[k + 3]);
      if (a[k + 1] === T.CHEST && a[k + 2] === 0 && !w.chests[x + ',' + y]) w.chests[x + ',' + y] = new Array(40).fill(null);
      w.damage.delete(i);
      if (this.isHost) Liquid.wake(w, x, y);
    }
    this.applying = false;
  },
  applyLiq(a) {
    const w = G.world;
    for (let k = 0; k < a.length; k += 3) {
      w.liquid[a[k]] = a[k + 1]; w.ltype[a[k]] = a[k + 2];
      if (this.isHost) { const i = a[k]; Liquid.wake(w, i % w.w, (i / w.w) | 0); }
    }
  },
  sendLiquid(i) { const w = G.world; if (this.isClient) this.out({ t: 'liq', a: [i, w.liquid[i], w.ltype[i]] }); else if (this.isHost) Liquid.changed.add(i); },

  // ----- npcs (host -> clients) -----
  npcSnapshot() {
    const out = [];
    for (const n of G.npcs) {
      if (n.dead || n.localOnly) continue;
      const s = { u: n.uid, t: n.type, x: Math.round(n.x), y: Math.round(n.y), vx: +n.vx.toFixed(2), vy: +n.vy.toFixed(2), l: Math.ceil(n.life), m: n.lifeMax, d: n.dir, f: +(n.frame || 0).toFixed(2), r: +(n.rot || 0).toFixed(2), a: +(n.alpha).toFixed(2), dm: n.damage };
      if (n.boss) { s.w = Math.round(n.w); s.h = Math.round(n.h); s.k = n.frameKey; s.i = n.def.img; s.sc = n.def.scale; s.ai3 = n.ai[3]; s.bt = n.bodyTop; s.bb = n.bodyBot; }
      if (n.anchor) s.an = [Math.round(n.anchor[0]), Math.round(n.anchor[1])];
      if (n.town) { s.n = n.name; s.sn = n.shortName; s.e = n.emote || 0; s.hm = n.home; }
      if (n.speechT > 0) { s.s = n.speech; s.st = n.speechT; }
      if (n.buffs.on_fire) s.of = 1;
      out.push(s);
    }
    return out;
  },
  applyNPCs(list) {
    const seen = new Set();
    for (const s of list) {
      seen.add(s.u);
      let n = this.npcMap.get(s.u);
      if (!n || n.dead) {
        n = new NPC(s.t, 0, 0);
        n.netUid = s.u; n.x = s.x; n.y = s.y;
        this.npcMap.set(s.u, n);
        G.npcs.push(n);
      }
      n.tx = s.x; n.ty = s.y; n.vx = s.vx; n.vy = s.vy; n.life = s.l; n.lifeMax = s.m; n.dir = s.d; n.frame = s.f; n.rot = s.r; n.alpha = s.a; n.damage = s.dm;
      if (s.w) { n.w = s.w; n.h = s.h; n.frameKey = s.k; if (s.i && n.def.img !== s.i) n.def = Object.assign({}, n.def, { img: s.i }); if (s.sc) n.def.scale = s.sc; n.ai[3] = s.ai3; n.bodyTop = s.bt; n.bodyBot = s.bb; }
      if (s.an) n.anchor = s.an;
      if (s.n) { n.name = s.n; n.shortName = s.sn; n.home = s.hm; if (s.e && !(n.emote > 0)) n.emote = s.e; }
      if (s.s && s.s !== n.speech) { n.speech = s.s; n.speechT = s.st; }
      if (s.of) n.buffs.on_fire = 30; else delete n.buffs.on_fire;
    }
    for (const [u, n] of this.npcMap) if (!seen.has(u)) { n.dead = true; n.silentRemove = true; this.npcMap.delete(u); }
  },
  // client-side npc tick: interpolate + our own contact damage (the host only damages its own player)
  clientNPCs(world, p) {
    for (const n of G.npcs) {
      if (n.netUid == null) { n.update(world); continue; } // local-only (pets)
      if (n.tx != null) { n.x = lerp(n.x, n.tx + n.vx * 2, 0.4); n.y = lerp(n.y, n.ty + n.vy * 2, 0.4); }
      if (n.hitFlash > 0) n.hitFlash--;
      if (n.speechT > 0) n.speechT--;
      for (const k in n.immune) if (--n.immune[k] <= 0) delete n.immune[k];
      if (n.friendly || n.damage <= 0 || p.dead || n.alpha < 0.5) continue;
      let touching = rectsOverlap(n, p);
      if (n.type === 'wall_of_flesh') touching = p.cx > n.x - 10 && p.cx < n.x + n.w + 10 && p.y + p.h > (n.bodyTop || 0);
      if (touching && p.hurt(n.damage, n.cx < p.cx ? 1 : -1, n, 'enemy')) {
        if (n.def.onHitFire && !p.calc.fx.fireBlockImmune) p.addBuff('on_fire', 180);
        if (n.def.thief) n.steal(p);
      }
    }
  },

  // ----- items (host owns drops) -----
  itemMsg(it) { return { t: 'item', iid: it.iid, x: Math.round(it.x + it.w / 2), y: Math.round(it.y + it.h / 2), id: it.id, c: it.count, vx: +it.vx.toFixed(2), vy: +it.vy.toFixed(2), ng: it.noGrab, st: it.fallenStar ? 1 : 0 }; },
  spawnItem(m) {
    const it = new ItemDrop(m.x, m.y, m.id, m.c);
    it.iid = m.iid; it.vx = m.vx; it.vy = m.vy; it.noGrab = m.ng; it.fallenStar = !!m.st;
    G.items.push(it);
  },
  announceItem(it) { if (this.isHost) this.broadcast(this.itemMsg(it)); },
  requestPickup(it) {
    if (it.pendingPick && G.tick - it.pendingPick < 60) return;
    it.pendingPick = G.tick;
    this.out({ t: 'pick', iid: it.iid });
  },

  // ----- projectiles -----
  sendProj(pr) {
    const o = pr.opts || {};
    this.out({ t: 'proj', type: pr.type, x: Math.round(pr.cx), y: Math.round(pr.cy), vx: +pr.vx.toFixed(3), vy: +pr.vy.toFixed(3), dmg: pr.damage, kb: pr.kb, hostile: pr.hostile ? 1 : 0, glyph: o.glyph, grav: o.gravity, ou: pr.owner && pr.owner.uid && !pr.owner.remote ? pr.owner.uid : null });
  },
  spawnRemoteProj(m) {
    let owner = null;
    if (m.hostile) owner = G.npcs.find(n => n.netUid === m.ou || n.uid === m.ou) || null;
    else owner = G.remotes[m.pid || 'host'] || null;
    const opts = { hostile: !!m.hostile, glyph: m.glyph, remote: true };
    if (m.grav != null) opts.gravity = m.grav;
    const pr = G.spawnProjectile(m.type, m.x, m.y, m.vx, m.vy, m.dmg, m.kb, owner || { cx: m.x, cy: m.y, name: 'something' }, opts);
    if (!m.hostile) pr.visualOnly = true;
  },

  // ----- chests -----
  syncOpenChest() {
    const c = UI.chest;
    if (!c || !c.pos || c.inv === G.player.piggy) return;
    const key = c.pos[0] + ',' + c.pos[1];
    const sig = JSON.stringify(c.inv);
    if (this.lastChest[key] === undefined) { this.lastChest[key] = sig; return; }
    if (this.lastChest[key] !== sig) { this.lastChest[key] = sig; this.out({ t: 'chest', key, inv: c.inv }); }
  },
  applyChest(m) {
    const w = G.world;
    let inv = w.chests[m.key];
    if (!inv) inv = w.chests[m.key] = new Array(40).fill(null);
    for (let i = 0; i < 40; i++) inv[i] = m.inv[i] ? { id: m.inv[i].id, count: m.inv[i].count } : null;
    this.lastChest[m.key] = JSON.stringify(inv);
  },

  // ----- time / progression (host -> clients) -----
  applyTime(m) {
    const w = G.world;
    w.time = m.time; w.dayTime = m.dayTime; w.day = m.day;
    for (const k of ['king_slime', 'eye_of_cthulhu', 'tung_sahur', 'wall_of_flesh']) if (m.flags[k] && !w.flags[k]) G.achieve(k);
    Object.assign(w.flags, m.flags);
  },
};
