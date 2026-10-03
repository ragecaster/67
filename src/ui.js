// ---------- in-game UI (immediate mode, Terraria layout) ----------
const SLOT = 40, GAP = 4;
function txt(ctx, s, x, y, color = '#fff', size = 14, align = 'left', bold = true) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px ' + UI_FONT;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = Math.max(2, size / 4); ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineJoin = 'round';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function inRect(x, y, w, h) { return Input.mx >= x && Input.mx < x + w && Input.my >= y && Input.my < y + h; }

const UI = {
  invOpen: false, chest: null, shop: null, talk: null, settingsOpen: false, chatLog: [], craftScroll: 0, hover: null,
  mouseOverUI: false, blockWorldClick: false, rects: [], achievementQueue: [], pickups: [],
  recipes: [], recipeTimer: 0, housingMsg: null,

  reset() { this.invOpen = false; this.chest = null; this.shop = null; this.talk = null; this.settingsOpen = false; this.chatLog = []; this.pickups = []; },
  addRect(x, y, w, h) { this.rects.push([x, y, w, h]); },
  beginFrame() {
    // decide mouse-over-ui from last frame's rects
    this.mouseOverUI = this.rects.some(r => inRect(r[0], r[1], r[2], r[3])) || WorldMap.open;
    if (typeof Bot !== 'undefined' && Bot.active && !this.invOpen && !Bot.uiBusy) this.mouseOverUI = false; // the bot never aims at HUD
    this.rects = [];
    this.hover = null;
  },

  // ---------- slots ----------
  drawSlot(ctx, x, y, stack, opts = {}) {
    const hot = inRect(x, y, SLOT, SLOT);
    ctx.fillStyle = opts.selected ? 'rgba(235,200,70,0.85)' : opts.color || (hot ? 'rgba(90,110,210,0.85)' : 'rgba(55,72,165,0.75)');
    roundRect(ctx, x, y, SLOT, SLOT, 6); ctx.fill();
    ctx.strokeStyle = opts.selected ? '#fff3b0' : 'rgba(20,25,60,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    if (opts.icon && !stack) { const ic = getImg(opts.icon); ctx.globalAlpha = 0.35; ctx.drawImage(ic, x + SLOT / 2 - ic.width / 2, y + SLOT / 2 - ic.height / 2); ctx.globalAlpha = 1; }
    if (stack) {
      const it = ITEMS[stack.id];
      const img = getImg(it ? it.img : 'gen/missing');
      const sc = Math.min(1, (SLOT - 10) / Math.max(img.width, img.height)) * (opts.selected ? 1.05 : 1);
      ctx.drawImage(img, Math.round(x + SLOT / 2 - img.width * sc / 2), Math.round(y + SLOT / 2 - img.height * sc / 2), img.width * sc, img.height * sc);
      if (stack.count > 1) txt(ctx, String(stack.count), x + 6, y + SLOT - 5, '#fff', 12, 'left');
    }
    if (opts.label) txt(ctx, opts.label, x + 5, y + 13, '#fff', 11, 'left');
    this.addRect(x, y, SLOT, SLOT);
    if (hot && stack) this.hover = { stack, price: opts.price, sell: opts.sell };
    return hot;
  },
  // handle clicking an inventory-like slot array
  slotClick(arr, i, opts = {}) {
    const p = G.player;
    const cur = arr[i];
    if (Input.mClick) {
      if (Input.shift && cur) { this.quickMove(arr, i); return true; }
      if (opts.accept && p.mouseItem && !opts.accept(ITEMS[p.mouseItem.id])) return true;
      if (p.mouseItem && cur && p.mouseItem.id === cur.id && cur.count < maxStack(cur.id)) {
        const n = Math.min(p.mouseItem.count, maxStack(cur.id) - cur.count);
        cur.count += n; p.mouseItem.count -= n; if (!p.mouseItem.count) p.mouseItem = null;
      } else { arr[i] = p.mouseItem; p.mouseItem = cur; }
      playSound('grab', 0.4);
      return true;
    }
    if (Input.rClick && cur) {
      const it = ITEMS[cur.id];
      // right click equips armor/accessories from the inventory
      if (arr === p.inv && (it.armor || it.acc)) { this.equip(i); return true; }
      if (arr === p.inv && it.use === 'use' && it.pet) return true;
      // take one
      if (!p.mouseItem || (p.mouseItem.id === cur.id && p.mouseItem.count < maxStack(cur.id))) {
        if (p.mouseItem) p.mouseItem.count++; else p.mouseItem = { id: cur.id, count: 1 };
        cur.count--; if (!cur.count) arr[i] = null;
        playSound('tick', 0.3);
      }
      return true;
    }
    return false;
  },
  equip(i) {
    const p = G.player, s = p.inv[i], it = ITEMS[s.id];
    if (it.armor) {
      const k = { head: 0, body: 1, legs: 2 }[it.armor];
      p.inv[i] = p.armor[k]; p.armor[k] = s;
    } else if (it.acc) {
      if (p.acc.some(a => a && a.id === s.id)) return;
      let k = p.acc.findIndex(a => !a); if (k < 0) k = 0;
      p.inv[i] = p.acc[k]; p.acc[k] = s;
    }
    playSound('grab', 0.5);
  },
  quickMove(arr, i) {
    const p = G.player, s = arr[i];
    if (this.shop && arr === p.inv) { this.sell(i); return; }
    const target = this.chest ? (arr === p.inv ? this.chest.inv : p.inv) : null;
    if (target) {
      const left = invAdd(target, s.id, s.count, 0, target === p.inv ? 50 : target.length);
      if (left) s.count = left; else arr[i] = null;
      playSound('grab', 0.4);
    } else if (arr === p.inv) {
      // shift-click to trash (Terraria)
      p.trash = s; arr[i] = null; playSound('grab', 0.4);
    }
  },
  sell(i) {
    const p = G.player, s = p.inv[i];
    if (!s || ITEMS[s.id].coin) return;
    const v = sellPrice(s.id) * s.count;
    p.inv[i] = null;
    invAddMoney(p.inv, v);
    this.shop.buyback.push(s);
    playSound('coins', 0.6);
    combatText(p.cx, p.y - 10, '+' + formatAura(v), '#ffd23a', { life: 60 });
  },

  // ---------- HUD ----------
  draw(ctx, vw, vh) {
    const p = G.player;
    this.beginFrame();
    this.blockWorldClick = false;
    if (p.dead) this.drawDeath(ctx, vw, vh);
    this.drawHotbar(ctx);
    this.drawLife(ctx, vw);
    this.drawBuffs(ctx);
    this.drawInfo(ctx, vw);
    if (!this.invOpen) WorldMap.drawMini(ctx, vw - 212, 92, 200, 140), this.addRect(vw - 212, 92, 200, 140);
    if (this.invOpen) this.drawInventory(ctx, vw, vh);
    if (this.talk) this.drawTalk(ctx, vw, vh);
    this.drawBossBar(ctx, vw, vh);
    this.drawChat(ctx, vw, vh);
    this.drawPickups(ctx, vw, vh);
    this.drawAchievements(ctx, vw, vh);
    if (this.settingsOpen) this.drawSettings(ctx, vw, vh);
    if (G.victory) this.drawVictory(ctx, vw, vh);
    this.drawHoverTile(ctx);
    if (this.hover && !p.mouseItem) this.drawTooltip(ctx, this.hover, vw, vh);
    this.drawMouseItem(ctx);
    // clicking in the world with an item on the cursor throws it (inventory closed = put back)
    if (p.mouseItem && !this.invOpen) { const left = invAdd(p.inv, p.mouseItem.id, p.mouseItem.count); if (left) G.dropItem(p.cx, p.cy, p.mouseItem.id, left); p.mouseItem = null; }
    if (p.mouseItem && Input.mClick && !this.mouseOverUIThisFrame()) {
      G.throwItem(p.cx + p.dir * 20, p.cy - 10, p.mouseItem.id, p.mouseItem.count, p.dir * 4, -1);
      p.mouseItem = null; this.blockWorldClick = true;
    }
    this.drawChatInput(ctx, vw, vh);
    if (Bot.active) {
      const msg = '🤖 BotSigma: ' + Bot.goal + '  ·  ' + Bot.turbo + 'x speed  ·  F8 stop · F9 speed';
      ctx.font = 'bold 13px ' + UI_FONT;
      const w = ctx.measureText(msg).width + 20;
      ctx.fillStyle = 'rgba(20,60,30,0.85)'; roundRect(ctx, vw / 2 - w / 2, vh - 92, w, 24, 8); ctx.fill();
      txt(ctx, msg, vw / 2, vh - 75, '#9aff9a', 13, 'center');
      if (Bot.act && Bot.act.probs) {
        const nm = k => k.replace(/^(fight|kite):(\d+)$/, (m, a, u) => a + ' ' + ((G.npcs.find(n => n.uid == u) || {}).name || '?')).replace(/_/g, ' ');
        const top = Object.entries(Bot.act.probs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => nm(k) + ' ' + Math.round(v * 100) + '%').join(' · ');
        const trained = TerraJev.has('act'), src = Bot.choiceSrc === 'teacher' ? ' (rules)' : Bot.choiceSrc === 'explore' ? ' (exploring)' : '';
        if (Bot.plan) txt(ctx, '📋 plan: ' + Bot.plan.label, vw / 2, vh - 134, '#cfe8ff', 12, 'center');
        txt(ctx, (trained ? '🧠 TerraJev' + src + ': ' : '📜 rules (TerraJev untrained): ') + top, vw / 2, vh - 116, trained ? '#ffd23a' : '#cfe8ff', 12, 'center');
      }
      if (Bot.vision) {
        const lines = SDK.summary(), bw = Math.min(vw - 40, 900);
        ctx.fillStyle = 'rgba(8,12,30,0.82)'; roundRect(ctx, vw / 2 - bw / 2, 70, bw, 22 + lines.length * 17, 8); ctx.fill();
        txt(ctx, 'BOT VISION (F7) — what TerraJev sees this tick', vw / 2, 86, '#ffd23a', 12, 'center');
        lines.forEach((l, k) => txt(ctx, l, vw / 2 - bw / 2 + 10, 104 + k * 17, '#dfe6ff', 11, 'left', false));
      }
      const ms = Object.keys(Bot.milestones);
      if (ms.length) txt(ctx, 'milestones: ' + ms.slice(-6).join(' → '), vw / 2, vh - 100, '#cfe8ff', 11, 'center', false);
    }
    this.drawNetInfo(ctx, vw, vh);
  },
  mouseOverUIThisFrame() { return this.rects.some(r => inRect(r[0], r[1], r[2], r[3])); },
  drawHotbar(ctx) {
    const p = G.player;
    const x0 = 20, y0 = 22;
    const held = p.held();
    if (!this.invOpen) txt(ctx, held ? ITEMS[held.id].name : 'Items', x0 + 5 * (SLOT + GAP) - 22, y0 - 6, held ? RARE_COLORS[ITEMS[held.id].rare || 0] : '#fff', 14, 'center');
    if (!this.invOpen) txt(ctx, (SETTINGS.smartCursor ? 'Smart Cursor: ON' : 'Smart Cursor: OFF') + ' (Ctrl) · Shift: auto-select', x0 + 10 * (SLOT + GAP) + 6, y0 + 25, SETTINGS.smartCursor ? '#ffb84a' : 'rgba(255,255,255,0.55)', 11, 'left', false);
    if (this.invOpen) return;
    for (let i = 0; i < 10; i++) {
      const x = x0 + i * (SLOT + GAP);
      const hot = this.drawSlot(ctx, x, y0, p.inv[i], { selected: i === p.sel, label: String((i + 1) % 10) });
      if (hot && Input.mClick) { p.sel = i; this.blockWorldClick = true; }
    }
  },
  drawLife(ctx, vw) {
    const p = G.player;
    const x0 = vw - 240, y0 = 12;
    txt(ctx, 'Life: ' + Math.max(0, Math.ceil(p.life)) + '/' + p.lifeMax, x0 + 110, y0 + 12, '#fff', 13, 'center');
    const heart = getImg('items/Heart');
    const hearts = Math.min(20, Math.ceil(p.lifeMax / 20));
    const per = p.lifeMax / hearts;
    for (let i = 0; i < hearts; i++) {
      const fill = clamp((p.life - i * per) / per, 0, 1);
      const x = x0 + (i % 10) * 22, y = y0 + 18 + Math.floor(i / 10) * 22;
      const pulse = i === Math.floor(p.life / per) ? 1 + Math.sin(G.tick * 0.15) * 0.06 : 1;
      ctx.globalAlpha = 0.25; ctx.drawImage(heart, x, y); ctx.globalAlpha = 1;
      if (fill > 0) { const s = (0.6 + 0.4 * fill) * pulse; ctx.drawImage(heart, x + 9 - 9 * s, y + 9 - 9 * s, 18 * s, 18 * s); }
    }
    // mana stars (vertical, right edge)
    const star = getImg('items/Star');
    const stars = Math.ceil(p.manaMax / 20);
    txt(ctx, 'Mana', vw - 22, y0 + 12, '#fff', 11, 'center');
    for (let i = 0; i < stars; i++) {
      const fill = clamp((p.mana - i * 20) / 20, 0, 1);
      const x = vw - 31, y = y0 + 18 + i * 22;
      ctx.globalAlpha = 0.25; ctx.drawImage(star, x, y); ctx.globalAlpha = 1;
      if (fill > 0) { const s = 0.5 + 0.5 * fill; ctx.drawImage(star, x + 9 - 9 * s, y + 9 - 9 * s, 18 * s, 18 * s); }
    }
    // aura meter
    const ay = y0 + 18 + Math.ceil(hearts / 10) * 22 + 2, aw = 180;
    const him = p.buffs.him;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, x0 + 10, ay, aw, 10, 4); ctx.fill();
    const af = him ? p.buffs.him / (30 * 60) : p.aura / 100;
    const ag = ctx.createLinearGradient(x0 + 10, 0, x0 + 10 + aw, 0); ag.addColorStop(0, '#ffb84a'); ag.addColorStop(1, '#fff3a8');
    ctx.fillStyle = ag; roundRect(ctx, x0 + 10, ay, Math.max(3, aw * af), 10, 4); ctx.fill();
    txt(ctx, him ? 'HIM MODE' : 'AURA ' + Math.floor(p.aura) + '%', x0 + 10 + aw / 2, ay + 9, him ? '#fff' : '#ffe9a0', 10, 'center');
    // breath bubbles
    if (p.breath < 200) { for (let i = 0; i < 10; i++) { ctx.fillStyle = p.breath / 20 > i ? '#9ad7ff' : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(p.cx - G.camX - 45 + i * 10, p.y - G.camY - 16, 4, 0, Math.PI * 2); ctx.fill(); } }
    this.addRect(x0, y0, 240, 70);
  },
  drawBuffs(ctx) {
    const p = G.player;
    let i = 0;
    const y = this.invOpen ? 22 : 70, bx0 = this.invOpen ? 20 + 10 * (SLOT + GAP) + 130 : 20;
    for (const [k, t] of Object.entries(p.buffs)) {
      const b = BUFFS[k]; if (!b) continue;
      const x = bx0 + i * 38;
      const img = getImg(b.img);
      ctx.drawImage(img, x, y, 32, 32);
      if (k !== 'labubu') txt(ctx, t > 3600 ? Math.ceil(t / 3600) + 'm' : Math.ceil(t / 60) + 's', x + 16, y + 44, '#fff', 11, 'center');
      if (inRect(x, y, 32, 32)) { this.hover = { text: b.name + '\n' + b.tip, color: b.debuff ? '#ff9a9a' : '#fff' }; if (Input.rClick && !b.debuff) { delete p.buffs[k]; if (k === 'labubu') G.removePet(); } }
      this.addRect(x, y, 32, 32);
      i++;
    }
  },
  drawInfo(ctx, vw) {
    const w = G.world, p = G.player;
    const t = G.clockString();
    const depth = Math.floor(p.cy / TS);
    let layer = depth < w.worldSurface ? 'Surface' : depth < w.rockLayer ? 'Underground' : depth < w.hellLayer ? 'Caverns' : 'Ohio';
    if (G.inBackrooms(p)) layer = 'Level 0 (The Backrooms)';
    const biome = G.biomeAt(Math.floor(p.cx / TS));
    const bname = { forest: 'Forest', desert: 'Desert', snow: 'Snow', brainrot: 'The Brainrot', ocean: 'Ocean' }[biome];
    const x = this.invOpen ? vw - 212 : vw - 212;
    txt(ctx, t + '  ·  ' + (depth < w.worldSurface ? bname : layer) + '  ·  ' + (depth < w.worldSurface ? (w.worldSurface - depth) + "' above" : (depth - w.worldSurface) + "' below"), vw - 12, 250, t.startsWith('6:07') ? '#ffd23a' : '#dfe6ff', 12, 'right');
    if (SETTINGS.showFps) txt(ctx, G.fps + ' fps', vw - 12, 266, '#aaa', 11, 'right');
  },

  // ---------- inventory ----------
  drawInventory(ctx, vw, vh) {
    const p = G.player;
    const x0 = 20, y0 = 22;
    txt(ctx, 'Inventory', x0, y0 - 6, '#fff', 14);
    ctx.fillStyle = 'rgba(20,30,80,0.35)'; roundRect(ctx, x0 - 6, y0 - 4, 10 * (SLOT + GAP) + 8, 5 * (SLOT + GAP) + 6, 8); ctx.fill();
    for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) {
      const i = r * 10 + c;
      const x = x0 + c * (SLOT + GAP), y = y0 + r * (SLOT + GAP);
      const hot = this.drawSlot(ctx, x, y, p.inv[i], { selected: i === p.sel, label: r === 0 ? String((c + 1) % 10) : null, sell: !!this.shop });
      if (hot) this.slotClick(p.inv, i);
    }
    // money + trash
    const bx = x0 + 10 * (SLOT + GAP) + 6;
    txt(ctx, formatAura(invMoney(p.inv)), x0, y0 + 5 * (SLOT + GAP) + 16, '#ffd23a', 13);
    const tx = bx, ty = y0 + 4 * (SLOT + GAP);
    const thot = this.drawSlot(ctx, tx, ty, p.trash, { color: 'rgba(120,40,40,0.8)', label: 'Trash' });
    // dropping a held item on the trash deletes whatever was in it for good; with an empty cursor, the last trashed item comes back
    if (thot && Input.mClick) {
      if (p.mouseItem) { p.trash = p.mouseItem; p.mouseItem = null; playSound('grab', 0.4); }
      else if (p.trash) { p.mouseItem = p.trash; p.trash = null; }
    }
    // buttons
    let by = y0;
    const btn = (label, fn) => { if (this.button(ctx, bx, by, 110, 26, label)) fn(); by += 30; };
    if (this.chest) {
      btn('Loot All', () => { for (let i = 0; i < this.chest.inv.length; i++) { const s = this.chest.inv[i]; if (s) { const l = ITEMS[s.id].coin ? (invAddMoney(p.inv, ITEMS[s.id].coin * s.count), 0) : invAdd(p.inv, s.id, s.count, 0, 50); if (l) s.count = l; else this.chest.inv[i] = null; } } playSound('grab'); });
      btn('Deposit All', () => { for (let i = 10; i < 50; i++) { const s = p.inv[i]; if (s && !ITEMS[s.id].coin) { const l = invAdd(this.chest.inv, s.id, s.count); if (l) s.count = l; else p.inv[i] = null; } } playSound('grab'); });
      btn('Quick Stack', () => { for (let i = 10; i < 50; i++) { const s = p.inv[i]; if (s && this.chest.inv.some(c => c && c.id === s.id)) { const l = invAdd(this.chest.inv, s.id, s.count); if (l) s.count = l; else p.inv[i] = null; } } playSound('grab'); });
    }
    btn('Sort', () => this.sortInv());
    btn('Housing?', () => { const tx = Math.floor(p.cx / TS), ty = Math.floor((p.y + p.h - 8) / TS); const r = checkRoom(G.world, tx, ty); this.housingMsg = [r.ok ? 'This house is suitable. W crib.' : r.reason, 240]; });
    btn('Settings', () => { this.settingsOpen = true; });
    if (this.housingMsg && this.housingMsg[1]-- > 0) txt(ctx, this.housingMsg[0], x0, y0 + 5 * (SLOT + GAP) + 34, this.housingMsg[0].startsWith('This house is suitable') ? '#32ff82' : '#ff9a9a', 13);

    // equipment column (right side)
    const ex = vw - 60, ey = 280;
    txt(ctx, 'Equip', ex + 20, ey - 8, '#fff', 13, 'center');
    const icons = ['items/Copper_Helmet', 'items/Copper_Chainmail', 'items/Copper_Greaves'];
    for (let k = 0; k < 3; k++) {
      const hot = this.drawSlot(ctx, ex, ey + k * (SLOT + GAP), p.armor[k], { icon: icons[k] });
      if (hot) this.slotClick(p.armor, k, { accept: it => it.armor === ['head', 'body', 'legs'][k] });
    }
    for (let k = 0; k < 5; k++) {
      const hot = this.drawSlot(ctx, ex, ey + (k + 3) * (SLOT + GAP) + 8, p.acc[k], { icon: 'items/Band_of_Regeneration' });
      if (hot) this.slotClick(p.acc, k, { accept: it => it.acc && !p.acc.some((a, j) => j !== k && a && a.id === it.id) });
    }
    // defense shield
    const dy = ey + 8 * (SLOT + GAP) + 16;
    ctx.fillStyle = '#8a8f96'; ctx.beginPath(); ctx.moveTo(ex + 20, dy); ctx.lineTo(ex + 36, dy + 6); ctx.lineTo(ex + 32, dy + 26); ctx.lineTo(ex + 20, dy + 34); ctx.lineTo(ex + 8, dy + 26); ctx.lineTo(ex + 4, dy + 6); ctx.closePath(); ctx.fill();
    txt(ctx, String(p.calc.defense), ex + 20, dy + 22, '#fff', 14, 'center');
    if (inRect(ex, dy, 40, 34)) this.hover = { text: p.calc.defense + ' Defense' + (p.calc.setBonus ? '\nSet bonus: ' + p.calc.setBonus : ''), color: '#fff' };
    this.addRect(ex, dy, 40, 34);
    // player preview
    const pvx = ex - 70, pvy = ey + 10;
    ctx.fillStyle = 'rgba(20,30,80,0.45)'; roundRect(ctx, pvx - 10, pvy - 6, 50, 64, 6); ctx.fill();
    drawHumanoid(ctx, Object.assign(Object.create(Object.getPrototypeOf(p)), p, { dir: 1, onGround: true, vx: 0, hurtFlash: 0, itemAnim: 0, useItem: null, emote: 0 }), pvx, pvy + 4, { preview: true });

    // chest / shop panels
    let panelY = y0 + 5 * (SLOT + GAP) + 44;
    if (this.chest) panelY = this.drawChestPanel(ctx, x0, panelY);
    if (this.shop) panelY = this.drawShopPanel(ctx, x0, panelY);
    // crafting
    this.drawCrafting(ctx, x0, Math.max(panelY, y0 + 5 * (SLOT + GAP) + 44), vh);
  },
  button(ctx, x, y, w, h, label, color) {
    const hot = inRect(x, y, w, h);
    ctx.fillStyle = hot ? 'rgba(90,110,210,0.95)' : (color || 'rgba(55,72,165,0.85)');
    roundRect(ctx, x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = 'rgba(10,15,40,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, label, x + w / 2, y + h / 2 + 5, hot ? '#ffd23a' : '#fff', 13, 'center');
    this.addRect(x, y, w, h);
    if (hot && Input.mClick) { playSound('tick', 0.5); Input.mClick = false; return true; }
    return false;
  },
  sortInv() {
    const p = G.player;
    const items = p.inv.slice(10).filter(Boolean);
    const merged = [];
    for (const s of items) { const l = invAdd(merged, s.id, s.count, 0, merged.length); if (l) merged.push({ id: s.id, count: l }); }
    const order = it => (it.pick || it.axe || it.hammer ? 0 : it.damage ? 1 : it.armor ? 2 : it.acc ? 3 : it.use === 'consume' ? 4 : it.place ? 6 : 5);
    merged.sort((a, b) => order(ITEMS[a.id]) - order(ITEMS[b.id]) || ITEMS[a.id].name.localeCompare(ITEMS[b.id].name));
    for (let i = 10; i < 50; i++) p.inv[i] = merged[i - 10] || null;
    playSound('grab');
  },
  drawChestPanel(ctx, x0, y0) {
    const inv = this.chest.inv;
    txt(ctx, this.chest.title, x0, y0 - 4, '#fff', 14);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
      const i = r * 10 + c, x = x0 + c * (SLOT + GAP), y = y0 + r * (SLOT + GAP);
      if (this.drawSlot(ctx, x, y, inv[i], { color: 'rgba(90,60,140,0.75)' })) this.slotClick(inv, i);
    }
    return y0 + 4 * (SLOT + GAP) + 26;
  },
  drawShopPanel(ctx, x0, y0) {
    const p = G.player, sh = this.shop;
    txt(ctx, sh.title + '  (prices incl. 6.7% Fanum tax · shift-click your items to sell)', x0, y0 - 4, '#fff', 13);
    const list = sh.items.concat(sh.buyback.map(s => s.id));
    this.shopSlots = [];   // where each item is drawn (the playtest bot clicks these)
    for (let i = 0; i < Math.min(40, list.length); i++) {
      const id = list[i];
      const x = x0 + (i % 10) * (SLOT + GAP), y = y0 + Math.floor(i / 10) * (SLOT + GAP);
      const isBuyback = i >= sh.items.length;
      const stack = isBuyback ? sh.buyback[i - sh.items.length] : { id, count: 1 };
      const price = isBuyback ? sellPrice(id) * stack.count : buyPrice(id);
      this.shopSlots.push({ id, buyback: isBuyback, x: x + SLOT / 2, y: y + SLOT / 2 });
      const hot = this.drawSlot(ctx, x, y, stack, { color: isBuyback ? 'rgba(120,90,40,0.8)' : 'rgba(40,120,90,0.75)', price });
      if (hot && (Input.mClick || Input.rClick)) {
        if (invSpend(p.inv, price)) {
          if (isBuyback) { sh.buyback.splice(i - sh.items.length, 1); invAdd(p.inv, stack.id, stack.count) && G.dropItem(p.cx, p.cy, stack.id, stack.count); }
          else if (p.mouseItem && p.mouseItem.id === id && p.mouseItem.count < maxStack(id)) p.mouseItem.count++;
          else if (!p.mouseItem) p.mouseItem = { id, count: 1 };
          else { if (invAdd(p.inv, id, 1)) G.dropItem(p.cx, p.cy, id, 1); }
          playSound('coins', 0.6);
        } else { combatText(p.cx, p.y - 10, 'Not enough aura. Broke.', '#ff5a5a', { life: 60 }); playSound('tick'); }
      }
    }
    return y0 + Math.ceil(Math.min(40, list.length) / 10) * (SLOT + GAP) + 26;
  },
  // ---------- crafting ----------
  stationsNear() {
    const p = G.player, w = G.world, st = new Set();
    const x0 = Math.floor(p.cx / TS) - 5, x1 = Math.floor(p.cx / TS) + 5, y0 = Math.floor(p.cy / TS) - 4, y1 = Math.floor(p.cy / TS) + 4;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = TILES[w.tile(x, y)];
      if (t && t.station) { st.add(t.station); if (t.station === 'hellforge') st.add('furnace'); if (t.station === 'bottle' && t.id === T.ALCHEMY) st.add('bottle'); }
    }
    return st;
  },
  canCraft(r, st, inv) {
    if (r.station && !st.has(r.station)) return false;
    for (const [id, n] of r.ing) if (invCount(inv, id) < n) return false;
    return true;
  },
  updateRecipes() {
    const st = this.stationsNear(), inv = G.player.inv;
    this.stations = st;
    this.recipes = RECIPES.filter(r => ITEMS[r.out] && this.canCraft(r, st, inv));
  },
  drawCrafting(ctx, x0, y0, vh) {
    const p = G.player;
    if (--this.recipeTimer <= 0) { this.updateRecipes(); this.recipeTimer = 15; }
    txt(ctx, 'Crafting' + (this.stations && this.stations.size ? '  (near: ' + [...this.stations].map(s => STATION_NAMES[s]).join(', ') + ')' : '  (by hand — find a Work Bench!)'), x0, y0 - 4, '#fff', 13);
    const rows = Math.max(1, Math.floor((vh - y0 - 20) / (SLOT + GAP)));
    const cols = 10;
    const per = rows * cols;
    const maxScroll = Math.max(0, Math.ceil(this.recipes.length / cols) - rows);
    if (inRect(x0, y0, cols * (SLOT + GAP), rows * (SLOT + GAP)) && Input.wheel) { this.craftScroll = clamp(this.craftScroll + Input.wheel, 0, maxScroll); Input.wheel = 0; }
    this.craftScroll = clamp(this.craftScroll, 0, maxScroll);
    const start = this.craftScroll * cols;
    this.recipeSlots = []; this.recipeSlots.x0 = x0; this.recipeSlots.y0 = y0;
    if (!this.recipes.length) txt(ctx, 'Nothing craftable yet. Chop some trees, bestie.', x0, y0 + 20, '#aab', 12, 'left', false);
    for (let k = 0; k < per && start + k < this.recipes.length; k++) {
      const r = this.recipes[start + k];
      const x = x0 + (k % cols) * (SLOT + GAP), y = y0 + Math.floor(k / cols) * (SLOT + GAP);
      const hot = this.drawSlot(ctx, x, y, { id: r.out, count: r.n }, { color: 'rgba(60,130,70,0.75)' });
      this.recipeSlots.push({ out: r.out, x: x + SLOT / 2, y: y + SLOT / 2 });
      if (hot) this.hover = { stack: { id: r.out, count: r.n }, recipe: r };
      if (hot && Input.mClick) this.craft(r);
    }
    if (maxScroll > 0) txt(ctx, '(scroll for more ' + (this.craftScroll + 1) + '/' + (maxScroll + 1) + ')', x0 + cols * (SLOT + GAP), y0 + 14, '#aab', 11, 'right', false);
  },
  craft(r) {
    const p = G.player;
    if (!this.canCraft(r, this.stations || new Set(), p.inv)) return;
    if (p.mouseItem && (p.mouseItem.id !== r.out || p.mouseItem.count + r.n > maxStack(r.out))) return;
    for (const [id, n] of r.ing) invRemove(p.inv, id, n);
    if (p.mouseItem) p.mouseItem.count += r.n; else p.mouseItem = { id: r.out, count: r.n };
    playSound('grab', 0.6);
    if (r.out === 'work_bench') G.achieve('benched');
    if (r.out === 'the_67') { G.sixSevenHit(p.cx, p.y - 20); }
    this.recipeTimer = 0;
  },

  // ---------- tooltip ----------
  drawTooltip(ctx, h, vw, vh) {
    const lines = [];
    if (h.stack) {
      const it = ITEMS[h.stack.id];
      if (!it) return;
      lines.push([it.name + (h.stack.count > 1 ? ' (' + h.stack.count + ')' : ''), RARE_COLORS[it.rare || 0]]);
      if (it.damage && !it.ammoType) {
        const kind = { melee: 'melee', ranged: 'ranged', magic: 'magic', thrown: 'thrown' }[it.dmgType] || '';
        lines.push([Math.round(G.player.finalDamage(it, it.damage)) + ' ' + kind + ' damage' + (it.sixSeven ? ' (' + Math.round(it.sixSeven * 100) + '%: 67)' : ''), '#fff']);
        lines.push([G.player.calc.crit + '% critical strike chance', '#fff']);
        const ut = it.useTime;
        lines.push([ut <= 8 ? 'Insanely fast speed' : ut <= 20 ? 'Very fast speed' : ut <= 25 ? 'Fast speed' : ut <= 30 ? 'Average speed' : ut <= 35 ? 'Slow speed' : 'Very slow speed', '#fff']);
        if (it.kb) lines.push([it.kb >= 9 ? 'Insane knockback' : it.kb >= 6 ? 'Strong knockback' : it.kb >= 4 ? 'Average knockback' : 'Weak knockback', '#fff']);
      }
      if (it.ammoType) lines.push([it.damage + ' damage', '#fff'], ['Ammo', '#fff']);
      if (it.pick) lines.push([it.pick + '% pickaxe power', '#fff']);
      if (it.axe) lines.push([it.axe + '% axe power', '#fff']);
      if (it.hammer) lines.push([it.hammer + '% hammer power', '#fff']);
      if (it.mana) lines.push(['Uses ' + it.mana + ' mana', '#fff']);
      if (it.defense) lines.push([it.defense + ' defense', '#fff']);
      if (it.armor) lines.push(['Equipable (right-click)', '#aab']);
      if (it.acc) lines.push(['Equipable accessory (right-click)', '#aab']);
      if (it.heal) lines.push(['Restores ' + it.heal + ' life', '#fff']);
      if (it.place != null || it.placeWall != null) lines.push(['Can be placed', '#fff']);
      if (it.consumable && !it.place && !it.placeWall) lines.push(['Consumable', '#fff']);
      if (it.material || RECIPES.some(r => r.ing.some(g => g[0] === it.id))) lines.push(['Material', '#fff']);
      for (const l of (it.tooltip || '').split('\n')) if (l) lines.push([l, '#dcdcff']);
      if (it.armor && it.set) { const p = G.player; const setOn = p.armor.every(a => a && ITEMS[a.id].set === it.set); if (setOn) lines.push(['Set bonus: ' + SET_BONUS[it.set].text, '#9aff9a']); }
      if (h.recipe) {
        lines.push(['Requires:', '#ffd23a']);
        for (const [id, n] of h.recipe.ing) lines.push(['  ' + n + ' ' + ITEMS[id].name, '#fff']);
        if (h.recipe.station) lines.push(['  @ ' + STATION_NAMES[h.recipe.station], '#aab']);
      }
      if (h.price != null) lines.push(['Buy price: ' + formatAura(h.price), '#ffd23a']);
      else if (h.sell && it.value) lines.push(['Sell price: ' + formatAura(sellPrice(it.id) * h.stack.count), '#ffd23a']);
    } else if (h.text) for (const l of h.text.split('\n')) lines.push([l, h.color || '#fff']);
    ctx.font = 'bold 13px ' + UI_FONT;
    const w = Math.max(...lines.map(l => ctx.measureText(l[0]).width)) + 16, hh = lines.length * 17 + 10;
    let x = Input.mx + 18, y = Input.my + 18;
    if (x + w > vw) x = vw - w - 4; if (y + hh > vh) y = vh - hh - 4;
    ctx.fillStyle = 'rgba(15,20,50,0.88)'; roundRect(ctx, x, y, w, hh, 6); ctx.fill();
    lines.forEach((l, i) => txt(ctx, l[0], x + 8, y + 20 + i * 17, l[1], 13));
  },
  drawMouseItem(ctx) {
    const p = G.player;
    if (!p.mouseItem) return;
    const it = ITEMS[p.mouseItem.id], img = getImg(it.img);
    const sc = Math.min(1, 30 / Math.max(img.width, img.height));
    ctx.drawImage(img, Input.mx + 8, Input.my + 8, img.width * sc, img.height * sc);
    if (p.mouseItem.count > 1) txt(ctx, String(p.mouseItem.count), Input.mx + 10, Input.my + 40, '#fff', 12);
  },
  drawHoverTile(ctx) {
    if (this.mouseOverUI || this.invOpen && this.mouseOverUIThisFrame()) return;
    const p = G.player;
    const it = p.heldItem();
    if (!it || p.dead) return;
    if (!(it.pick || it.axe || it.hammer || it.use === 'place' || it.use === 'placeWall')) return;
    if (SETTINGS.smartCursor) {
      const st = p.smartTarget(G.world, it);
      if (st) { ctx.strokeStyle = '#ffa53a'; ctx.lineWidth = 2; ctx.strokeRect(st[0] * TS - G.camX + 1, st[1] * TS - G.camY + 1, 14, 14); }
      return;
    }
    const tx = Math.floor(G.mouseWorldX() / TS), ty = Math.floor(G.mouseWorldY() / TS);
    if (!p.inReach(tx, ty)) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(tx * TS - G.camX + 0.5, ty * TS - G.camY + 0.5, 15, 15);
  },

  // ---------- npc chat ----------
  openTalk(n) {
    this.talk = { npc: n, text: npcGreeting(n, G.player) };
    n.talking = true;
    playSound('menu_open', 0.6);
  },
  closeTalk() { if (this.talk) this.talk.npc.talking = false; this.talk = null; this.shop = null; },
  drawTalk(ctx, vw, vh) {
    const t = this.talk, n = t.npc, p = G.player;
    if (n.dead || dist(n.cx, n.cy, p.cx, p.cy) > 250) { this.closeTalk(); return; }
    const w = Math.min(520, vw - 40), x = vw / 2 - w / 2, y = 20;
    ctx.font = '14px ' + UI_FONT;
    const lines = wrapText(ctx, t.text, w - 24);
    const h = 44 + lines.length * 19 + 36;
    ctx.fillStyle = 'rgba(30,40,110,0.9)'; roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = '#0a0f30'; ctx.lineWidth = 3; ctx.stroke();
    txt(ctx, n.name, x + 12, y + 22, '#ffd23a', 15);
    lines.forEach((l, i) => txt(ctx, l, x + 12, y + 46 + i * 19, '#fff', 14, 'left', false));
    this.addRect(x, y, w, h);
    let bx = x + 12;
    const by = y + h - 32;
    this.talkButtons = {};   // label -> centre (the playtest bot clicks these)
    const b = (label, fn) => { ctx.font = 'bold 13px ' + UI_FONT; const bw = ctx.measureText(label).width + 20; this.talkButtons[label] = { x: bx + bw / 2, y: by + 12 }; if (this.button(ctx, bx, by, bw, 24, label)) fn(); bx += bw + 8; };
    if (SHOPS[n.type]) b('Shop', () => { this.shop = { npc: n, title: n.shortName + "'s Shop", items: SHOPS[n.type](), buyback: [] }; this.invOpen = true; n.talking = false; this.talk = null; });
    if (n.type === 'nurse') {
      const c = nurseCost(p);
      b(c > 0 ? 'Heal (' + formatAura(c) + ')' : 'Heal', () => {
        if (c <= 0) { t.text = 'You are already at full health. Go touch grass.'; return; }
        if (invSpend(p.inv, c)) { p.heal(p.lifeMax - p.life); for (const k in p.buffs) if (BUFFS[k].debuff && k !== 'potion_sickness') delete p.buffs[k]; t.text = pick(['All glazed up. You are welcome.', 'Healed. Please stop crashing out.', 'Good as new. Aura restored.']); playSound('item4'); }
        else t.text = 'You cannot afford that. Broke behavior.';
      });
    }
    if (n.type === 'guide') b('Help', () => { t.text = npcGreeting(n, p); });
    b('Close', () => this.closeTalk());
  },

  // ---------- chat / popups ----------
  chat(msg, color = '#fff') {
    this.chatLog.push({ msg, color, t: 60 * 10 });
    if (this.chatLog.length > 60) this.chatLog.shift();
  },
  drawChat(ctx, vw, vh) {
    let y = vh - 30 - (G.npcs.some(n => n.boss) ? 50 : 0);
    const recent = this.chatLog.slice(-8).reverse();
    for (const c of recent) {
      if (c.t > 0) c.t--;
      if (c.t <= 0 && !this.invOpen) continue;
      ctx.globalAlpha = this.invOpen ? 0.9 : Math.min(1, c.t / 60);
      txt(ctx, c.msg, 20, y, c.color, 14);
      y -= 20;
    }
    ctx.globalAlpha = 1;
  },
  drawChatInput(ctx, vw, vh) {
    this.chatOpen = this.chatOpen && !!Input.typing;
    if (!this.chatOpen) return;
    const w = Math.min(600, vw - 40), y = vh - 26;
    ctx.fillStyle = 'rgba(10,15,40,0.85)'; roundRect(ctx, 16, y - 18, w, 24, 6); ctx.fill();
    txt(ctx, 'Say: ' + Input.typing.text + (G.tick % 60 < 30 ? '|' : ''), 24, y, '#fff', 14, 'left', false);
  },
  drawNetInfo(ctx, vw, vh) {
    if (!Net.active && !Net.status) return;
    let y = 280;
    const x = vw - 12;
    if (Net.status) { txt(ctx, Net.status, x, y, '#ffd23a', 12, 'right'); y += 18; }
    if (Net.isHost && Net.code) {
      const label = 'Room code: ' + Net.code + (this.copiedT > 0 ? '  (copied!)' : '  (click to copy)');
      ctx.font = 'bold 14px ' + UI_FONT;
      const w = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(20,90,50,0.85)'; roundRect(ctx, x - w, y - 16, w, 22, 6); ctx.fill();
      txt(ctx, label, x - 8, y, '#9aff9a', 14, 'right');
      this.addRect(x - w, y - 16, w, 22);
      if (inRect(x - w, y - 16, w, 22) && Input.mClick) { try { navigator.clipboard.writeText(Net.code); } catch (e) { } this.copiedT = 120; Input.mClick = false; }
      if (this.copiedT > 0) this.copiedT--;
      y += 22;
    }
    if (Net.active) {
      const names = [G.player.name + ' (you)'].concat(Object.values(G.remotes).map(r => r.name));
      txt(ctx, 'Players: ' + names.join(', '), x, y, '#cfe8ff', 12, 'right');
    }
  },
  drawPickups(ctx, vw, vh) {
    const p = G.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.t--; if (u.t <= 0) { this.pickups.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, u.t / 30);
      txt(ctx, u.text, p.cx - G.camX, p.y - G.camY - 30 - (this.pickups.length - 1 - i) * 16 - (90 - u.t) * 0.15, u.color, 13, 'center');
    }
    ctx.globalAlpha = 1;
  },
  drawAchievements(ctx, vw, vh) {
    const a = this.achievementQueue[0];
    if (!a) return;
    a.t--;
    if (a.t <= 0) { this.achievementQueue.shift(); return; }
    const slide = Math.min(1, (240 - a.t) / 15, a.t / 15);
    const w = 330, x = vw / 2 - w / 2, y = -60 + slide * 80;
    ctx.fillStyle = 'rgba(25,30,70,0.92)'; roundRect(ctx, x, y, w, 56, 10); ctx.fill(); ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, 'Achievement: ' + a.title, x + w / 2, y + 22, '#ffd23a', 15, 'center');
    txt(ctx, a.desc, x + w / 2, y + 42, '#fff', 12, 'center', false);
  },
  drawBossBar(ctx, vw, vh) {
    const bosses = G.npcs.filter(n => n.boss && !n.dead);
    if (!bosses.length) return;
    const b = bosses[0];
    const w = Math.min(500, vw - 80), x = vw / 2 - w / 2, y = vh - 60;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(ctx, x - 4, y - 4, w + 8, 30, 8); ctx.fill();
    const f = b.life / b.lifeMax;
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ff3a3a'); g.addColorStop(1, '#ff9a3a');
    ctx.fillStyle = g; roundRect(ctx, x, y, Math.max(4, w * f), 22, 6); ctx.fill();
    txt(ctx, b.name + '  ' + Math.max(0, Math.ceil(b.life)) + '/' + b.lifeMax, vw / 2, y + 16, '#fff', 13, 'center');
  },
  drawDeath(ctx, vw, vh) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, vw, vh);
    txt(ctx, G.deathMessage || 'You got cooked.', vw / 2, vh / 2 - 20, '#e1453a', 46, 'center');
    txt(ctx, G.deathTip || '', vw / 2, vh / 2 + 20, '#fff', 15, 'center', false);
    if (G.player.difficulty === 2) txt(ctx, 'Hardcore character. It is so over.', vw / 2, vh / 2 + 50, '#ff9a9a', 16, 'center');
    else txt(ctx, 'Respawning in ' + Math.ceil(G.player.respawn / 60) + '...', vw / 2, vh / 2 + 50, '#fff', 16, 'center');
  },
  drawVictory(ctx, vw, vh) {
    const v = G.victory;
    v.t++;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, v.t / 120)})`; ctx.fillRect(0, 0, vw, vh);
    const a = Math.min(1, v.t / 90);
    ctx.globalAlpha = a;
    txt(ctx, 'YOU BEAT TERRARI67', vw / 2, vh * 0.22, '#ffd23a', 54, 'center');
    txt(ctx, 'The Wall of Brainrot has been hard mogged. You are him.', vw / 2, vh * 0.22 + 40, '#fff', 18, 'center');
    const p = G.player;
    const stats = [
      'Player: ' + p.name,
      'Enemies cooked: ' + p.stats.kills,
      'Times cooked: ' + p.stats.deaths,
      '6-7s performed: ' + p.stats.sixSevens,
      'Aura: ' + formatAura(invMoney(p.inv)),
      'Days survived: ' + (G.world.day + 1),
    ];
    stats.forEach((s, i) => txt(ctx, s, vw / 2, vh * 0.22 + 90 + i * 24, '#dfe6ff', 16, 'center', false));
    const credits = ['Inspired by Terraria (Re-Logic). Sprites, sounds & music from the Terraria Wiki.', 'Memes: 6-7, Skibidi, Italian Brainrot, Ohio, Fanum Tax, Rizz, Sigma, Mewing, Aura, Labubu, Dubai Chocolate.', 'The world is now in Hard Mogged mode — enemies are stronger. Keep grinding.'];
    credits.forEach((s, i) => txt(ctx, s, vw / 2, vh * 0.22 + 260 + i * 20, '#aab', 13, 'center', false));
    if (v.t > 60 && Math.random() < 0.3) spawnDust(G.camX + Math.random() * vw, G.camY - 10, pick(['#ffd23a', '#ff4d6d', '#4dd2ff', '#7dff6b']), 1, 1, { vy: 2, life: 200, grav: 0.02, size: 4 });
    if (v.t > 90) {
      if (this.button(ctx, vw / 2 - 90, vh * 0.22 + 340, 180, 34, 'Keep Playing')) { G.victory = null; }
    }
    ctx.globalAlpha = 1;
    this.addRect(0, 0, vw, vh);
  },
  drawSettings(ctx, vw, vh) {
    const w = 360, h = 330, x = vw / 2 - w / 2, y = vh / 2 - h / 2;
    ctx.fillStyle = 'rgba(25,30,80,0.95)'; roundRect(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = '#0a0f30'; ctx.lineWidth = 3; ctx.stroke();
    this.addRect(x, y, w, h);
    txt(ctx, 'Settings', x + w / 2, y + 30, '#ffd23a', 20, 'center');
    let yy = y + 50;
    const slider = (label, get, set) => {
      txt(ctx, label + ': ' + Math.round(get() * 100) + '%', x + 20, yy + 16, '#fff', 13);
      const sx = x + 180, sw = 150;
      ctx.fillStyle = '#223'; ctx.fillRect(sx, yy + 8, sw, 8); ctx.fillStyle = '#ffd23a'; ctx.fillRect(sx, yy + 8, sw * get(), 8);
      this.addRect(sx, yy, sw, 24);
      if (Input.mDown && inRect(sx - 5, yy, sw + 10, 24)) set(clamp((Input.mx - sx) / sw, 0, 1));
      yy += 32;
    };
    const toggle = (label, key) => { if (this.button(ctx, x + 20, yy, w - 40, 26, label + ': ' + (SETTINGS[key] ? 'ON' : 'OFF'))) { SETTINGS[key] = !SETTINGS[key]; saveSettings(); } yy += 32; };
    slider('Music', () => SETTINGS.music, v => { SETTINGS.music = v; saveSettings(); });
    slider('Sound', () => SETTINGS.sfx, v => { Audio67.setSfxVolume(v); saveSettings(); });
    toggle('Brainrot voice (TTS)', 'tts');
    toggle('Smooth lighting', 'smoothLight');
    toggle('Show FPS', 'showFps');
    if (this.button(ctx, x + 20, yy, w - 40, 26, 'Zoom: ' + (SETTINGS.zoom ? SETTINGS.zoom + 'x' : 'Auto'))) { const zs = [0, 1, 1.5, 2, 2.5]; SETTINGS.zoom = zs[(zs.indexOf(SETTINGS.zoom) + 1) % zs.length]; saveSettings(); G.resize(); }
    yy += 32;
    if (this.button(ctx, x + 20, yy, w / 2 - 25, 28, 'Close')) this.settingsOpen = false;
    if (this.button(ctx, x + w / 2 + 5, yy, w / 2 - 25, 28, 'Save & Exit', 'rgba(150,50,50,0.9)')) { this.settingsOpen = false; G.saveAndExit(); }
  },
};
