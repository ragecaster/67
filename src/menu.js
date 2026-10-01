// ---------- title screen, character + world select/creation, world gen progress ----------
const Menu = {
  screen: 'title', t: 0, players: [], worlds: [], sel: null, newP: null, newW: null, gen: null, splash: '', msg: '',
  open() {
    this.screen = 'title';
    this.splash = pick(MEME.splashes);
    document.title = pick(MEME.titles);
    Audio67.playMusic('Title_Screen');
    this.refresh();
  },
  async refresh() {
    this.players = (await Save.list('players')).sort((a, b) => (b.played || 0) - (a.played || 0));
    this.worlds = (await Save.list('worlds')).sort((a, b) => (b.played || 0) - (a.played || 0));
  },
  update() {
    this.t++;
    if (this.screen === 'gen' && this.gen) {
      const t0 = performance.now();
      while (performance.now() - t0 < 40) {
        const r = this.gen.it.next();
        if (r.done) { this.finishGen(r.value); break; }
        this.gen.msg = r.value[0]; this.gen.p = r.value[1];
      }
    }
  },
  // ?bot: fresh world + BotSigma, then hand control to the bot
  startBotRun(seed, turbo, size) {
    Audio67.init();
    SETTINGS.tts = false;
    const look = randomLook(); look.hair = '#ffd23a';
    const player = new Player('BotSigma', look, 0);
    this.botRun = { turbo };
    this.gen = { it: generateWorld('Bot World ' + seed, seed, size), msg: 'Starting...', p: 0, player };
    this.screen = 'gen';
    G.state = 'gen';
  },
  async finishGen(world) {
    const g = this.gen; this.gen = null;
    G.world = world; G.npcs = [];
    this.screen = 'loading';
    await Save.saveWorld(world);
    G.start(g.player, world);
    if (this.botRun) { Bot.vision = true; Bot.start(this.botRun.turbo); this.botRun = null; return; }
    G.save(true);
    if (this.mpMode === 'host') Net.host();
  },
  draw(ctx, vw, vh) {
    UI.beginFrame();
    this.drawScene(ctx, vw, vh);
    const s = this.screen;
    if (s === 'title') this.drawTitle(ctx, vw, vh);
    else if (s === 'players') this.drawPlayers(ctx, vw, vh);
    else if (s === 'create') this.drawCreate(ctx, vw, vh);
    else if (s === 'worlds') this.drawWorlds(ctx, vw, vh);
    else if (s === 'createWorld') this.drawCreateWorld(ctx, vw, vh);
    else if (s === 'gen' || s === 'loading') this.drawGen(ctx, vw, vh);
    else if (s === 'settings') { UI.drawSettings(ctx, vw, vh); if (!UI.settingsOpen) this.screen = 'title'; }
    else if (s === 'credits') this.drawCredits(ctx, vw, vh);
    else if (s === 'mp') this.drawMP(ctx, vw, vh);
    else if (s === 'join') this.drawJoin(ctx, vw, vh);
    if (this.msg) txt(ctx, this.msg, vw / 2, vh - 20, '#ff9a9a', 14, 'center');
  },
  // animated backdrop: sky, hills, grass strip and a parade of brainrot
  drawScene(ctx, vw, vh) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#3f6fd0'); g.addColorStop(1, '#a8d4ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(vw * 0.82, vh * 0.18, 30, 0, Math.PI * 2); ctx.fill();
    const cols = ['#4c8f5a', '#3a7548', '#2c5c38'];
    for (let l = 0; l < 3; l++) {
      const img = Render.tintedHill(l, cols[l]);
      const ox = -((t * (0.3 + l * 0.4)) % img.width);
      const y = vh * (0.42 + l * 0.08);
      for (let x = ox - img.width; x < vw; x += img.width) ctx.drawImage(img, Math.round(x), Math.round(y));
      ctx.fillStyle = cols[l]; ctx.fillRect(0, Math.round(y + img.height - 1), vw, vh);
    }
    const gy = Math.floor(vh * 0.82);
    const grass = TILE_ATLAS[T.GRASS], dirt = TILE_ATLAS[T.DIRT];
    const off = -((t * 1.2) % 16);
    for (let x = off - 16; x < vw; x += 16) {
      ctx.drawImage(grass, 1 * 16, 0, 16, 16, Math.round(x), gy, 16, 16);
      for (let y = gy + 16; y < vh; y += 16) ctx.drawImage(dirt, 0, ((x / 16 + y / 16) & 1) * 16, 16, 16, Math.round(x), y, 16, 16);
    }
    // trees
    const top = getImg('gen/tree_top'), trunk = getImg('gen/tree_trunk');
    for (let i = 0; i < 6; i++) {
      const x = ((i * 260 - t * 1.2) % (vw + 300) + vw + 300) % (vw + 300) - 150;
      const h = 5 + (i * 3) % 5;
      for (let j = 1; j <= h; j++) ctx.drawImage(trunk, Math.round(x), gy - j * 16);
      ctx.drawImage(top, Math.round(x + 8 - top.width / 2), gy - h * 16 - top.height + 8);
    }
    // meme parade
    const parade = [['gen/skibidi_', 2, 30, 44], ['gen/tung_', 1, 68, 100], ['gen/ballerina_', 4, 40, 68], ['npcs/Zombie', 0, 34, 46], ['npcs/Green_Slime', 0, 32, 22], ['gen/labubu_', 2, 28, 36], ['gen/bombardiro_', 2, 92, 44]];
    parade.forEach(([k, frames, w, h], i) => {
      const speed = 0.8 + (i % 3) * 0.3;
      const x = ((i * 190 + t * speed) % (vw + 400)) - 200;
      const hop = k.includes('skibidi') || k.includes('Slime') ? Math.abs(Math.sin(t * 0.08 + i)) * 20 : 0;
      const fly = k.includes('bombardiro') ? -vh * 0.45 + Math.sin(t * 0.03) * 10 : 0;
      const key = frames ? k + (Math.floor(t / 8) % frames) : k;
      const img = getImg(key);
      ctx.save(); ctx.translate(Math.round(x), gy - hop + fly);
      if (!frames) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width / 2, -img.height);
      ctx.restore();
    });
  },
  logo(ctx, vw, y) {
    const t = this.t;
    ctx.save();
    ctx.translate(vw / 2, y);
    ctx.rotate(Math.sin(t * 0.02) * 0.03);
    const s = 1 + Math.sin(t * 0.04) * 0.02;
    ctx.scale(s, s);
    ctx.font = 'bold 76px ' + UI_FONT; ctx.textAlign = 'center';
    ctx.lineWidth = 12; ctx.strokeStyle = '#0d2a0d'; ctx.strokeText('TERRARI67', 0, 0);
    const g = ctx.createLinearGradient(0, -60, 0, 10);
    g.addColorStop(0, '#9be35a'); g.addColorStop(0.55, '#4fa83a'); g.addColorStop(0.56, '#8a5a33'); g.addColorStop(1, '#5a3a1e');
    ctx.fillStyle = g; ctx.fillText('TERRARI67', 0, 0);
    ctx.restore();
    // splash
    ctx.save(); ctx.translate(vw / 2 + 220, y + 10); ctx.rotate(-0.3);
    const sc = 1 + Math.abs(Math.sin(t * 0.12)) * 0.1; ctx.scale(sc, sc);
    txt(ctx, this.splash, 0, 0, '#ffe63a', 20, 'center');
    ctx.restore();
    txt(ctx, 'a Terraria clone with Gen Z brainrot · 🤲 six seven 🤲', vw / 2, y + 36, '#fff', 15, 'center');
  },
  bigButton(ctx, x, y, w, label) {
    const hot = inRect(x, y, w, 40);
    txt(ctx, label, x + w / 2, y + 30, hot ? '#ffd23a' : '#ffffff', hot ? 30 : 26, 'center');
    UI.addRect(x, y, w, 40);
    if (hot && Input.mClick) { playSound('menu_tick'); playSound('tick'); Input.mClick = false; return true; }
    return false;
  },
  drawTitle(ctx, vw, vh) {
    this.logo(ctx, vw, vh * 0.2);
    const x = vw / 2 - 150, w = 300;
    let y = vh * 0.34;
    if (this.bigButton(ctx, x, y, w, 'Single Player')) { this.mpMode = null; this.screen = 'players'; this.refresh(); Audio67.init(); } y += 52;
    if (this.bigButton(ctx, x, y, w, 'Multiplayer')) { this.screen = 'mp'; Audio67.init(); } y += 52;
    if (this.bigButton(ctx, x, y, w, 'Settings')) { this.screen = 'settings'; UI.settingsOpen = true; } y += 52;
    if (this.bigButton(ctx, x, y, w, 'Credits')) this.screen = 'credits'; y += 52;
    if (this.bigButton(ctx, x, y, w, 'Six Seven')) { Audio67.init(); Synth.six_seven(); speak('six seven!', 1.2, 1.4); this.splash = pick(MEME.splashes); }
    txt(ctx, 'v1.0.67 · click anywhere to enable audio', 10, vh - 10, '#fff', 11, 'left', false);
  },
  drawMP(ctx, vw, vh) {
    this.panel(ctx, vw, vh, 560, 330);
    const x0 = vw / 2 - 280, y0 = vh / 2 - 165;
    txt(ctx, 'Multiplayer', vw / 2, y0 + 36, '#ffd23a', 24, 'center');
    const lines = ['Host: pick a character + world, you get a room code to send your friend.', 'Join: pick your character and type in their room code.', 'Peer-to-peer over the internet (no server or port forwarding).', 'Both players need the game set up (see README).'];
    lines.forEach((l, i) => txt(ctx, l, vw / 2, y0 + 70 + i * 22, '#dfe6ff', 13, 'center', false));
    if (UI.button(ctx, vw / 2 - 230, y0 + 180, 220, 40, 'Host & Play')) { this.mpMode = 'host'; this.screen = 'players'; this.refresh(); }
    if (UI.button(ctx, vw / 2 + 10, y0 + 180, 220, 40, 'Join Game')) { this.mpMode = 'join'; this.screen = 'players'; this.refresh(); }
    if (UI.button(ctx, vw / 2 - 60, y0 + 270, 120, 30, 'Back')) this.screen = 'title';
  },
  drawJoin(ctx, vw, vh) {
    this.syncTyping();
    this.panel(ctx, vw, vh, 520, 280);
    const x0 = vw / 2 - 260, y0 = vh / 2 - 140;
    txt(ctx, 'Join Game  ·  as ' + this.selPlayer, vw / 2, y0 + 36, '#ffd23a', 22, 'center');
    this.joinForm = this.joinForm || { code: '' };
    this.textField(ctx, x0 + 30, y0 + 80, 460, 'Room code (from the host, e.g. SIGMA4267)', this.joinForm, 'code', 16);
    if (Net.status) txt(ctx, Net.status, vw / 2, y0 + 150, Net.status.startsWith('No room') || Net.status.includes('error') ? '#ff9a9a' : '#9ad7ff', 14, 'center');
    if (UI.button(ctx, x0 + 20, y0 + 230, 120, 30, 'Back')) { Input.typing = null; Net.leave(false); Net.status = ''; this.screen = 'players'; }
    if (UI.button(ctx, x0 + 520 - 160, y0 + 230, 140, 30, 'Join')) {
      const code = (this.joinForm.code || '').trim();
      if (!code) { Net.status = 'Type the room code first.'; return; }
      Input.typing = null;
      Net.leave(false);
      Save.get('players', this.selPlayer).then(pd => { Net.join(code, Save.loadPlayer(pd), () => { }); });
    }
  },
  drawCredits(ctx, vw, vh) {
    this.panel(ctx, vw, vh, 620, 360);
    const lines = [
      ['TERRARI67', '#ffd23a', 26],
      ['A fan-made, non-commercial Terraria tribute with extra brainrot.', '#fff', 14],
      ['Terraria © Re-Logic. Sprites, sound effects and music are from the', '#dfe6ff', 13],
      ['Terraria Wiki and belong to their respective owners.', '#dfe6ff', 13],
      ['Meme-mobs (Skibidi Toilet, Tung Tung Tung Sahur, Bombardiro Crocodilo,', '#dfe6ff', 13],
      ['Ballerina Cappuccina, Labubu) are drawn procedurally in code.', '#dfe6ff', 13],
      ['6-7 was Dictionary.com word of the year 2025. We are so cooked.', '#9aff9a', 13],
      ['Controls: WASD/arrows move · Space jump · Mouse use/aim · Esc inventory', '#fff', 13],
      ['E grapple · M map · H quick heal · T drop item · 1-0 hotbar · 6+7 = 🤲', '#fff', 13],
    ];
    lines.forEach(([l, c, s], i) => txt(ctx, l, vw / 2, vh / 2 - 140 + i * 30, c, s, 'center', i === 0));
    if (UI.button(ctx, vw / 2 - 60, vh / 2 + 140, 120, 30, 'Back')) this.screen = 'title';
  },
  panel(ctx, vw, vh, w, h) {
    ctx.fillStyle = 'rgba(25,35,95,0.88)'; roundRect(ctx, vw / 2 - w / 2, vh / 2 - h / 2, w, h, 14); ctx.fill();
    ctx.strokeStyle = '#0a0f30'; ctx.lineWidth = 3; ctx.stroke();
    UI.addRect(vw / 2 - w / 2, vh / 2 - h / 2, w, h);
  },
  drawPlayers(ctx, vw, vh) {
    const w = 560, h = Math.min(vh - 40, 460);
    this.panel(ctx, vw, vh, w, h);
    const x0 = vw / 2 - w / 2, y0 = vh / 2 - h / 2;
    txt(ctx, 'Select Player', vw / 2, y0 + 34, '#ffd23a', 22, 'center');
    let y = y0 + 54;
    if (!this.players.length) txt(ctx, 'No characters yet. Make one, bestie.', vw / 2, y + 30, '#aab', 14, 'center');
    for (const p of this.players.slice(0, 7)) {
      const hot = inRect(x0 + 20, y, w - 40, 44);
      ctx.fillStyle = hot ? 'rgba(90,110,210,0.9)' : 'rgba(55,72,165,0.8)'; roundRect(ctx, x0 + 20, y, w - 40, 44, 8); ctx.fill();
      drawHumanoid(ctx, { look: p.look, dir: 1, w: 20, h: 42, onGround: true, vx: 0, walkFrame: 0, armor: p.armor, heldItem: () => null, itemAnim: 0 }, x0 + 30, y + 1, { preview: true, armor: p.armor });
      txt(ctx, p.name, x0 + 70, y + 20, '#fff', 16);
      txt(ctx, ['Main Character (Softcore)', 'Side Character (Mediumcore)', 'NPC Mode (Hardcore)'][p.difficulty || 0] + ' · ' + p.lifeMax + ' HP · ' + p.manaMaxBase + ' MP', x0 + 70, y + 37, '#cfd8ff', 12, 'left', false);
      UI.addRect(x0 + 20, y, w - 40, 44);
      if (UI.button(ctx, x0 + w - 110, y + 9, 70, 26, 'Delete', 'rgba(150,50,50,0.9)')) { if (this.confirmDel === p.key) { Save.del('players', p.key).then(() => this.refresh()); this.confirmDel = null; } else { this.confirmDel = p.key; this.msg = 'Click Delete again to confirm deleting ' + p.name + '.'; } }
      else if (hot && Input.mClick) { this.selPlayer = p.key; this.msg = ''; if (this.mpMode === 'join') { this.screen = 'join'; this.joinForm = { code: '' }; Net.status = ''; this.startTyping(this.joinForm, 'code', 16); } else { this.screen = 'worlds'; this.refresh(); } }
      y += 50;
    }
    if (this.mpMode) txt(ctx, this.mpMode === 'host' ? 'Hosting: pick your character' : 'Joining: pick your character', vw / 2, y0 + h - 56, '#9aff9a', 13, 'center');
    if (UI.button(ctx, x0 + 20, y0 + h - 44, 150, 30, 'Back')) this.screen = this.mpMode ? 'mp' : 'title';
    if (UI.button(ctx, x0 + w - 190, y0 + h - 44, 170, 30, 'New Character')) { this.newP = { name: '', look: randomLook(), difficulty: 0 }; this.screen = 'create'; this.editing = 'name'; this.startTyping(this.newP, 'name', 18); }
  },
  startTyping(obj, key, max) {
    Input.typing = { text: obj[key] || '', max, onDone: () => { }, onCancel: () => { } };
    this.typingTarget = [obj, key];
  },
  syncTyping() { if (Input.typing && this.typingTarget) this.typingTarget[0][this.typingTarget[1]] = Input.typing.text; },
  textField(ctx, x, y, w, label, obj, key, max) {
    txt(ctx, label, x, y - 6, '#fff', 13);
    const active = Input.typing && this.typingTarget && this.typingTarget[0] === obj && this.typingTarget[1] === key;
    ctx.fillStyle = active ? 'rgba(20,20,40,0.95)' : 'rgba(20,20,40,0.7)'; roundRect(ctx, x, y, w, 30, 6); ctx.fill();
    ctx.strokeStyle = active ? '#ffd23a' : '#556'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, (obj[key] || '') + (active && this.t % 60 < 30 ? '|' : ''), x + 8, y + 21, '#fff', 15, 'left', false);
    UI.addRect(x, y, w, 30);
    if (inRect(x, y, w, 30) && Input.mClick) this.startTyping(obj, key, max);
  },
  drawCreate(ctx, vw, vh) {
    this.syncTyping();
    const P = this.newP;
    const W_ = Math.min(820, vw - 20), H_ = Math.min(500, vh - 20);
    const x0 = vw / 2 - W_ / 2, y0 = vh / 2 - H_ / 2;
    this.panel(ctx, vw, vh, W_, H_);
    txt(ctx, 'Create Character', vw / 2, y0 + 30, '#ffd23a', 22, 'center');
    this.cat = this.cat || 'hair';
    // --- category tabs (left) ---
    const cats = [['hair', 'Hair'], ['eyes', 'Eyes'], ['skin', 'Skin'], ['shirt', 'Shirt'], ['under', 'Undershirt'], ['pants', 'Pants'], ['shoes', 'Shoes']];
    cats.forEach(([k, label], i) => {
      const bx = x0 + 16, by = y0 + 56 + i * 40;
      const sel = this.cat === k, hot = inRect(bx, by, 120, 34);
      ctx.fillStyle = sel ? 'rgba(235,200,70,0.9)' : hot ? 'rgba(90,110,210,0.9)' : 'rgba(55,72,165,0.8)';
      roundRect(ctx, bx, by, 120, 34, 7); ctx.fill();
      ctx.fillStyle = P.look[k] || '#fff'; ctx.fillRect(bx + 8, by + 9, 16, 16); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(bx + 8.5, by + 9.5, 15, 15);
      txt(ctx, label, bx + 32, by + 22, sel ? '#1a1a2a' : '#fff', 14, 'left');
      UI.addRect(bx, by, 120, 34);
      if (hot && Input.mClick) { this.cat = k; playSound('tick'); }
    });
    // --- big preview (center) ---
    const pvx = x0 + 150, pvy = y0 + 56, pvw = 210, pvh = 280;
    const g = ctx.createLinearGradient(0, pvy, 0, pvy + pvh);
    g.addColorStop(0, 'rgba(120,170,255,0.35)'); g.addColorStop(1, 'rgba(40,60,140,0.5)');
    ctx.fillStyle = g; roundRect(ctx, pvx, pvy, pvw, pvh, 10); ctx.fill();
    ctx.fillStyle = '#4c8f5a'; ctx.fillRect(pvx + 20, pvy + pvh - 40, pvw - 40, 8);
    ctx.fillStyle = '#6b4a2c'; ctx.fillRect(pvx + 20, pvy + pvh - 32, pvw - 40, 12);
    const demo = { look: P.look, dir: this.previewDir || 1, w: 20, h: 42, onGround: true, vx: this.t % 240 < 120 ? 0 : 1, walkFrame: this.t * 0.1, heldItem: () => null, itemAnim: 0, emote: 0, hurtFlash: 0 };
    ctx.save(); ctx.translate(pvx + pvw / 2 - 40, pvy + pvh - 40 - 42 * 4); ctx.scale(4, 4);
    drawHumanoid(ctx, demo, 0, 0, { preview: true, armor: [] });
    ctx.restore();
    UI.addRect(pvx, pvy, pvw, pvh);
    if (inRect(pvx, pvy, pvw, pvh) && Input.mClick) this.previewDir = -(this.previewDir || 1); // click to turn around
    // --- right side: color picker (+ hairstyles for hair) ---
    const rx = x0 + 380, rw = W_ - 400;
    const hex = P.look[this.cat] || '#ffffff';
    const [hh, ss, ll] = hexToHsl(hex);
    const slider = (label, y, val, grad, set) => {
      txt(ctx, label, rx, y - 4, '#fff', 13);
      const sx = rx, sw = rw, sh = 16;
      const gr = ctx.createLinearGradient(sx, 0, sx + sw, 0);
      grad(gr);
      ctx.fillStyle = gr; roundRect(ctx, sx, y, sw, sh, 5); ctx.fill(); ctx.strokeStyle = '#0a0f30'; ctx.lineWidth = 2; ctx.stroke();
      const kx = sx + val * sw;
      ctx.fillStyle = '#fff'; ctx.fillRect(kx - 3, y - 3, 6, sh + 6); ctx.strokeStyle = '#000'; ctx.strokeRect(kx - 3, y - 3, 6, sh + 6);
      UI.addRect(sx - 6, y - 6, sw + 12, sh + 12);
      if (Input.mDown && inRect(sx - 6, y - 6, sw + 12, sh + 12)) set(clamp((Input.mx - sx) / sw, 0, 1));
    };
    const setHsl = (h2, s2, l2) => { P.look[this.cat] = hslToHex(h2, s2, l2); };
    slider('Hue', y0 + 76, hh, gr => { for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, hslToHex(i / 6, 1, 0.5)); }, v => setHsl(v, ss, ll));
    slider('Saturation', y0 + 116, ss, gr => { gr.addColorStop(0, hslToHex(hh, 0, ll)); gr.addColorStop(1, hslToHex(hh, 1, ll)); }, v => setHsl(hh, v, ll));
    slider('Lightness', y0 + 156, ll, gr => { gr.addColorStop(0, '#000'); gr.addColorStop(0.5, hslToHex(hh, ss, 0.5)); gr.addColorStop(1, '#fff'); }, v => setHsl(hh, ss, v));
    if (this.cat === 'hair') {
      // hairstyle grid, paged
      const cols = Math.max(4, Math.floor(rw / 48)), rows = 3, per = cols * rows;
      this.hairPage = clamp(this.hairPage || Math.floor(P.look.hairStyle / per), 0, Math.ceil(HAIR_COUNT / per) - 1);
      const gy = y0 + 196;
      txt(ctx, 'Hairstyle ' + (P.look.hairStyle + 1) + ' / ' + HAIR_COUNT, rx, gy - 4, '#fff', 13);
      for (let k = 0; k < per; k++) {
        const idx = this.hairPage * per + k;
        if (idx >= HAIR_COUNT) break;
        const cx = rx + (k % cols) * 48, cy = gy + Math.floor(k / cols) * 48;
        const sel = P.look.hairStyle === idx, hot = inRect(cx, cy, 44, 44);
        ctx.fillStyle = sel ? 'rgba(235,200,70,0.9)' : hot ? 'rgba(90,110,210,0.9)' : 'rgba(55,72,165,0.7)';
        roundRect(ctx, cx, cy, 44, 44, 6); ctx.fill();
        if (PlayerSprites.ready) {
          const [c, Pp] = PlayerSprites.get(Object.assign({}, P.look, { hairStyle: idx }), [null, null, null], 0, false);
          const top = Math.max(0, Pp.ey - 16);
          ctx.save(); ctx.beginPath(); ctx.rect(cx + 2, cy + 2, 40, 40); ctx.clip();
          ctx.drawImage(c, 0, top, c.width, 28, cx + 22 - (Pp.bodyCX + 4), cy + 6, c.width, 28);
          ctx.restore();
        } else txt(ctx, String(idx + 1), cx + 22, cy + 28, '#fff', 13, 'center');
        UI.addRect(cx, cy, 44, 44);
        if (hot && Input.mClick) { P.look.hairStyle = idx; playSound('tick'); }
      }
      const pages = Math.ceil(HAIR_COUNT / per);
      const py = gy + rows * 48 + 4;
      if (UI.button(ctx, rx, py, 60, 24, '<')) this.hairPage = (this.hairPage - 1 + pages) % pages;
      txt(ctx, 'Page ' + (this.hairPage + 1) + '/' + pages, rx + rw / 2, py + 17, '#cfd8ff', 12, 'center');
      if (UI.button(ctx, rx + rw - 60, py, 60, 24, '>')) this.hairPage = (this.hairPage + 1) % pages;
    } else {
      // quick swatches
      const sw = ['#f0c39a', '#d9a066', '#b87945', '#8a5a33', '#5e3a1f', '#ffd8b8', '#ffffff', '#222222', '#d53a3a', '#3a7bd5', '#3ad56a', '#d5a53a', '#7b3ad5', '#ff8ac5', '#6ecbff', '#ffe066'];
      sw.forEach((c, i) => {
        const bx = rx + (i % 8) * 30, by = y0 + 200 + Math.floor(i / 8) * 30;
        ctx.fillStyle = c; ctx.fillRect(bx, by, 26, 26); ctx.strokeStyle = P.look[this.cat] === c ? '#ffd23a' : '#000'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 26, 26);
        UI.addRect(bx, by, 26, 26);
        if (inRect(bx, by, 26, 26) && Input.mClick) { P.look[this.cat] = c; playSound('tick'); }
      });
    }
    // --- name, difficulty, buttons (bottom) ---
    const by = y0 + H_ - 132;
    this.textField(ctx, x0 + 150, by + 20, 210, 'Name', P, 'name', 18);
    const diffs = [['Main Character', 'Softcore: drop some aura on death'], ['Side Character', 'Mediumcore: drop your items'], ['NPC Mode', 'Hardcore: one life. it is so over']];
    diffs.forEach(([n, d], i) => {
      const dx = x0 + 380 + i * ((W_ - 400) / 3), dw = (W_ - 400) / 3 - 8;
      const sel = P.difficulty === i, hot = inRect(dx, by + 6, dw, 44);
      ctx.fillStyle = sel ? ['rgba(90,200,120,0.9)', 'rgba(230,180,60,0.9)', 'rgba(220,70,70,0.9)'][i] : hot ? 'rgba(90,110,210,0.9)' : 'rgba(55,72,165,0.8)';
      roundRect(ctx, dx, by + 6, dw, 44, 7); ctx.fill();
      txt(ctx, n, dx + dw / 2, by + 24, '#fff', 13, 'center');
      txt(ctx, d, dx + dw / 2, by + 41, '#e8ecff', 9, 'center', false);
      UI.addRect(dx, by + 6, dw, 44);
      if (hot && Input.mClick) { P.difficulty = i; playSound('tick'); }
    });
    if (UI.button(ctx, x0 + 16, y0 + 56 + 7 * 40 + 6, 120, 30, '🎲 Randomize')) { const keep = P.name; P.look = randomLook(); P.name = keep; }
    if (UI.button(ctx, x0 + 16, y0 + H_ - 46, 120, 32, 'Back')) { Input.typing = null; this.screen = 'players'; }
    if (UI.button(ctx, x0 + W_ - 170, y0 + H_ - 46, 150, 32, 'Create')) {
      const name = (P.name || '').trim() || pick(['Sigma', 'Rizzler', 'Skibidi', 'Gyatt', 'SixSeven', 'Unc']);
      if (this.players.some(p => p.name === name)) { this.msg = 'A character with that name already exists.'; return; }
      Input.typing = null;
      const player = new Player(name, P.look, P.difficulty);
      player.created = Date.now();
      Save.savePlayer(player).then(() => { this.selPlayer = name; this.msg = ''; this.refresh(); if (this.mpMode === 'join') { this.screen = 'join'; this.joinForm = { code: '' }; Net.status = ''; this.startTyping(this.joinForm, 'code', 16); } else this.screen = 'worlds'; });
    }
  },
  drawWorlds(ctx, vw, vh) {
    const w = 560, h = Math.min(vh - 40, 460);
    this.panel(ctx, vw, vh, w, h);
    const x0 = vw / 2 - w / 2, y0 = vh / 2 - h / 2;
    txt(ctx, 'Select World  ·  playing as ' + this.selPlayer, vw / 2, y0 + 34, '#ffd23a', 20, 'center');
    let y = y0 + 54;
    if (!this.worlds.length) txt(ctx, 'No worlds yet. Generate one (it takes a few seconds, lock in).', vw / 2, y + 30, '#aab', 14, 'center');
    for (const wd of this.worlds.slice(0, 7)) {
      const hot = inRect(x0 + 20, y, w - 40, 44);
      ctx.fillStyle = hot ? 'rgba(90,110,210,0.9)' : 'rgba(55,72,165,0.8)'; roundRect(ctx, x0 + 20, y, w - 40, 44, 8); ctx.fill();
      txt(ctx, wd.name + (wd.hardmode ? '  (Hard Mogged)' : ''), x0 + 34, y + 20, wd.hardmode ? '#ff96ff' : '#fff', 16);
      txt(ctx, 'Size ' + wd.size + ' · seed ' + wd.seed + ' · day ' + ((wd.day || 0) + 1), x0 + 34, y + 37, '#cfd8ff', 12, 'left', false);
      UI.addRect(x0 + 20, y, w - 40, 44);
      if (UI.button(ctx, x0 + w - 110, y + 9, 70, 26, 'Delete', 'rgba(150,50,50,0.9)')) { if (this.confirmDel === wd.key) { Save.del('worlds', wd.key).then(() => this.refresh()); this.confirmDel = null; this.msg = ''; } else { this.confirmDel = wd.key; this.msg = 'Click Delete again to confirm deleting ' + wd.name + '.'; } }
      else if (hot && Input.mClick) this.play(wd.key);
      y += 50;
    }
    if (UI.button(ctx, x0 + 20, y0 + h - 44, 150, 30, 'Back')) this.screen = 'players';
    if (UI.button(ctx, x0 + w - 190, y0 + h - 44, 170, 30, 'New World')) { this.newW = { name: pick(['Ohio', 'Skibidi Land', 'Rizz Island', 'Sigma Valley', 'Gyatt Gorge', 'Fanum Fields', 'The Backrooms', 'Brainrot Basin']) + ' ' + randInt(1, 99), seed: '', size: 'small' }; this.screen = 'createWorld'; this.startTyping(this.newW, 'name', 24); }
  },
  async play(worldKey) {
    this.screen = 'loading';
    const pd = await Save.get('players', this.selPlayer);
    const wd = await Save.get('worlds', worldKey);
    if (!pd || !wd) { this.msg = 'Could not load save.'; this.screen = 'worlds'; return; }
    const player = Save.loadPlayer(pd), world = Save.loadWorld(wd);
    G.start(player, world);
    if (this.mpMode === 'host') Net.host();
  },
  drawCreateWorld(ctx, vw, vh) {
    this.syncTyping();
    const W_ = this.newW, w = 520, h = 330;
    this.panel(ctx, vw, vh, w, h);
    const x0 = vw / 2 - w / 2, y0 = vh / 2 - h / 2;
    txt(ctx, 'Create World', vw / 2, y0 + 34, '#ffd23a', 22, 'center');
    this.textField(ctx, x0 + 30, y0 + 76, w - 60, 'World name', W_, 'name', 24);
    this.textField(ctx, x0 + 30, y0 + 136, w - 60, 'Seed (optional — try "67")', W_, 'seed', 20);
    txt(ctx, 'Size', x0 + 30, y0 + 196, '#fff', 13);
    ['small', 'medium', 'large'].forEach((s, i) => {
      if (UI.button(ctx, x0 + 80 + i * 130, y0 + 180, 120, 26, (W_.size === s ? '> ' : '') + s[0].toUpperCase() + s.slice(1) + (W_.size === s ? ' <' : ''))) W_.size = s;
    });
    txt(ctx, 'Small generates fastest. Large is a big world (might take a while to generate).', vw / 2, y0 + 232, '#aab', 12, 'center', false);
    if (UI.button(ctx, x0 + 20, y0 + h - 44, 120, 30, 'Back')) { Input.typing = null; this.screen = 'worlds'; }
    if (UI.button(ctx, x0 + w - 160, y0 + h - 44, 140, 30, 'Create')) {
      Input.typing = null;
      const name = (W_.name || '').trim() || 'Ohio';
      if (this.worlds.some(wd => wd.name === name)) { this.msg = 'A world with that name already exists.'; return; }
      this.msg = '';
      Save.get('players', this.selPlayer).then(pd => {
        const player = Save.loadPlayer(pd);
        this.gen = { it: generateWorld(name, (W_.seed || '').trim() || String(randInt(1, 2147483646)), W_.size), msg: 'Starting...', p: 0, player };
        this.screen = 'gen';
      });
    }
  },
  drawGen(ctx, vw, vh) {
    ctx.fillStyle = 'rgba(10,15,40,0.75)'; ctx.fillRect(0, 0, vw, vh);
    this.logo(ctx, vw, vh * 0.25);
    const g = this.gen || { msg: 'Loading... (locking in)', p: 1 };
    txt(ctx, g.msg, vw / 2, vh * 0.5, '#fff', 20, 'center');
    const bw = Math.min(500, vw - 80);
    ctx.fillStyle = '#223'; roundRect(ctx, vw / 2 - bw / 2, vh * 0.5 + 20, bw, 18, 6); ctx.fill();
    ctx.fillStyle = '#ffd23a'; roundRect(ctx, vw / 2 - bw / 2, vh * 0.5 + 20, Math.max(8, bw * g.p), 18, 6); ctx.fill();
    txt(ctx, Math.round(g.p * 100) + '%', vw / 2, vh * 0.5 + 60, '#ffd23a', 14, 'center');
  },
};
