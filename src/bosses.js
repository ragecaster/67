// ---------- bosses ----------
const BOSS_TYPES = {
  king_slime: {
    name: 'King Skibidi', img: 'npcs/King_Slime', w: 110, h: 76, life: 2000, damage: 40, defense: 10, kb: 0, boss: true, ai: 'king_slime', music: 'Boss_1',
    drops: [['gel', 1, 30, 60], ['skibidi_plunger', 1, 1, 1], ['toilet', 1, 1, 3], ['lesser_healing_potion', 1, 5, 15], ['labubu', 0.1, 1, 1]], value: 10000, blood: '#6fb4ff',
    onDeath: n => bossDefeated(n, 'king_slime'),
  },
  eye_of_cthulhu: {
    name: 'Eye of Ohio', img: 'npcs/Eye_of_Cthulhu', w: 100, h: 100, life: 2800, damage: 15, defense: 12, kb: 0, boss: true, ai: 'eye', music: 'Boss_1', noGravity: true, noTileCollide: true,
    drops: [['demonite_ore', 1, 30, 87], ['unholy_arrow', 1, 20, 49], ['lesser_healing_potion', 1, 5, 15], ['lens', 1, 3, 6]], value: 30000,
    onDeath: n => bossDefeated(n, 'eye_of_cthulhu'),
  },
  tung_sahur: {
    name: 'Tung Tung Tung Sahur', img: 'gen/tung_0', w: 60, h: 96, life: 4400, damage: 32, defense: 10, kb: 0, boss: true, ai: 'tung', music: 'Boss_3', blood: '#c99a62',
    drops: [['tung_bat', 1, 1, 1], ['sahur_snack', 1, 5, 10], ['cobalt_shield', 0.5, 1, 1], ['healing_potion', 1, 5, 15], ['bone', 1, 10, 30]], value: 50000, hitSound: 'tink',
    onDeath: n => bossDefeated(n, 'tung_sahur'),
  },
  wall_of_flesh: {
    name: 'Wall of Brainrot', img: 'npcs/Wall_of_Flesh', w: 130, h: 420, life: 8000, damage: 50, defense: 12, kb: 0, boss: true, ai: 'wall', music: 'Boss_2', noGravity: true, noTileCollide: true, lavaImmune: true,
    drops: [['healing_potion', 1, 5, 15], ['meme67_block', 1, 67, 67], ['rocket_boots', 1, 1, 1], ['dubai_chocolate', 1, 3, 6]], value: 80000,
    onDeath: n => { bossDefeated(n, 'wall_of_flesh'); },
    faceDir: n => n.ai[3] || 1,
  },
};
// bosses share the NPC class
Object.assign(NPC_TYPES, BOSS_TYPES);

function bossAwoken(type) {
  const d = BOSS_TYPES[type];
  G.announce(d.name + ' has awoken! (lock in)', '#af4bff');
  playSound('roar', 1);
  const taunt = pick(MEME.bossTaunts[type]);
  speak(taunt, 1.0, 0.8);
}
function bossDefeated(n, key) {
  const w = G.world;
  const first = !w.flags[key];
  w.flags[key] = true;
  G.announce(n.name + ' has been defeated! ' + pick(['W.', 'Ratio.', 'Mogged.', 'GG no re.', 'Aura +10000.']), '#af4bff');
  G.achieve(key);
  if (typeof Bot !== 'undefined' && Bot.active) Bot.milestone('killed ' + key.replace(/_/g, ' '));
  G.chatReact();
  if (G.player) G.player.addAura(25);
  if (key === 'wall_of_flesh') {
    w.flags.hardmode = true;
    G.announce('The spirits of Skibidi and Sigma have been released.', '#32ff82');
    G.announce('The world is now in HARD MOGGED mode.', '#32ff82');
    if (first) G.showVictory();
  }
  if (key === 'eye_of_cthulhu') G.announce('Brainrot Ore dropped! Smelt it into bars for gear. The grindset continues.', '#ffd23a');
  if (key === 'tung_sahur') G.announce('Sahur has ended. You may now eat breakfast in peace.', '#ffd23a');
  for (let i = 0; i < 60; i++) spawnDust(n.cx, n.cy, pick(['#ffd23a', '#ff4d6d', '#4dd2ff', '#7dff6b']), 1, 5, { life: 80, size: 4 });
  Synth.vine_boom();
}

// ----- boss AI -----
Object.assign(NPC_AI, {
  king_slime(n, world, p) {
    const ratio = n.life / n.lifeMax;
    const scale = 0.55 + 0.45 * ratio;
    // resize hitbox from the bottom center
    const nw = 110 * scale, nh = 76 * scale;
    n.x += (n.w - nw) / 2; n.y += n.h - nh; n.w = nw; n.h = nh; n.def.scale = scale * 0.72;
    n.vy = Math.min(n.vy + 0.35, 12);
    n.ai[0]++;
    if (p.dead || (G.isDay() && n.ai[0] > 60 * 60 * 3)) { n.alpha -= 0.01; if (n.alpha <= 0) { n.dead = true; n.silentRemove = true; G.announce('King Skibidi flushed away...', '#af4bff'); } moveEntity(n, world, { stepUp: false }); return; }
    // teleport when far or stuck
    const far = Math.abs(p.cx - n.cx) > 700 || Math.abs(p.cy - n.cy) > 500;
    if (n.ai[2] > 0) {
      n.ai[2]++;
      if (n.ai[2] < 40) n.alpha = Math.max(0, 1 - n.ai[2] / 40);
      else if (n.ai[2] === 40) {
        const tx = Math.floor(p.cx / TS) + randInt(-8, 8);
        let ty = Math.floor(p.cy / TS) - 8;
        while (ty < world.h - 2 && !world.solid(tx, ty + 1)) ty++;
        n.x = tx * TS - n.w / 2; n.y = (ty + 1) * TS - n.h; n.vx = 0; n.vy = 0;
        spawnDust(n.cx, n.cy, '#6fb4ff', 30, 4);
      } else { n.alpha = Math.min(1, (n.ai[2] - 40) / 30); if (n.ai[2] > 70) { n.ai[2] = 0; n.alpha = 1; } }
      return;
    }
    if ((far && n.onGround && Math.random() < 0.02) || n.ai[0] % 900 === 0) { n.ai[2] = 1; return; }
    if (n.onGround) {
      n.vx *= 0.8;
      n.ai[1]++;
      if (n.ai[1] > (ratio < 0.4 ? 30 : 45)) {
        n.ai[1] = 0; n.ai[3] = (n.ai[3] + 1) % 3;
        n.dir = p.cx < n.cx ? -1 : 1;
        const big = n.ai[3] === 2;
        n.vy = big ? -12 : -8; n.vx = n.dir * (big ? 5 : 4);
        if (Math.random() < 0.3) { n.say(pick(MEME.bossTaunts.king_slime)); Synth.skibidi(0.6); }
      }
    }
    moveEntity(n, world, { stepUp: false });
    // spawn minions as health is lost
    const lost = Math.floor((1 - ratio) * 20);
    if (lost > (n.minionsSpawned || 0)) {
      n.minionsSpawned = lost;
      const kind = Math.random() < 0.3 ? 'skibidi_toilet' : pick(['blue_slime', 'green_slime', 'purple_slime']);
      const m = G.spawnNPC(kind, n.cx + randRange(-30, 30), n.cy);
      m.vy = -5; m.vx = randRange(-4, 4);
    }
  },
  eye(n, world, p) {
    const d = n.def;
    n.ai[0]++;
    const phase2 = n.ai[2] >= 2;
    if (G.isDay() || p.dead) {
      n.vy -= 0.3; n.y += n.vy; n.rot += 0.1;
      if (n.cy < p.cy - 1500 || n.ai[0] > 100000) { n.dead = true; n.silentRemove = true; G.announce('The Eye of Ohio has left. (It was never him.)', '#af4bff'); }
      return;
    }
    // transformation at 50%
    if (n.ai[2] === 0 && n.life < n.lifeMax * 0.5) { n.ai[2] = 1; n.ai[1] = 0; n.state = 'spin'; n.vx *= 0.5; n.vy *= 0.5; playSound('roar', 1); }
    if (n.ai[2] === 1) {
      n.ai[1]++;
      n.rot += n.ai[1] < 60 ? n.ai[1] / 300 : (120 - n.ai[1]) / 300;
      n.vx *= 0.95; n.vy *= 0.95; n.x += n.vx; n.y += n.vy;
      if (n.ai[1] === 60) { n.def = Object.assign({}, d, { img: 'npcs/Eye_of_Cthulhu_(Phase_2)' }); for (let i = 0; i < 40; i++) spawnDust(n.cx, n.cy, '#b01010', 1, 5, { life: 60 }); n.damage = 23; n.defense = 0; n.say('ok now im locked in'); speak('now I am locked in', 1.1, 0.7); }
      if (n.ai[1] >= 120) { n.ai[2] = 2; n.ai[1] = 0; n.state = 'hover'; }
      return;
    }
    const face = () => { n.rot = Math.atan2(p.cy - n.cy, p.cx - n.cx) - Math.PI / 2; };
    if (!n.state) n.state = 'hover';
    if (n.state === 'hover') {
      const tx = p.cx, ty = p.cy - 230;
      const spd = phase2 ? 8 : 6, acc = phase2 ? 0.2 : 0.15;
      n.vx += clamp(tx - n.cx, -1, 1) * acc; n.vy += clamp(ty - n.cy, -1, 1) * acc;
      const v = Math.hypot(n.vx, n.vy); if (v > spd) { n.vx *= spd / v; n.vy *= spd / v; }
      n.x += n.vx; n.y += n.vy; face();
      n.ai[1]++;
      if (!phase2 && n.ai[1] % 60 === 30 && G.npcs.filter(m => m.type === 'servant').length < 8) {
        const s = G.spawnNPC('servant', n.cx, n.cy + 40); s.vx = randRange(-3, 3); s.vy = 3;
      }
      if (n.ai[1] > (phase2 ? 120 : 280)) { n.state = 'dash'; n.ai[1] = 0; n.dashes = 0; }
    } else if (n.state === 'dash') {
      if (n.ai[1] === 0) {
        const a = Math.atan2(p.cy - n.cy, p.cx - n.cx), spd = phase2 ? 10 : 7;
        n.vx = Math.cos(a) * spd; n.vy = Math.sin(a) * spd; n.rot = a - Math.PI / 2;
        playSound('roar2', 0.5); if (Math.random() < 0.3) n.say(pick(MEME.bossTaunts.eye_of_cthulhu));
      }
      n.ai[1]++;
      n.x += n.vx; n.y += n.vy;
      if (n.ai[1] > 40) { n.vx *= 0.95; n.vy *= 0.95; face(); }
      if (n.ai[1] > (phase2 ? 55 : 70)) { n.ai[1] = 0; n.dashes++; if (n.dashes >= (phase2 ? 5 : 3)) { n.state = 'hover'; n.ai[1] = 0; } }
    }
  },
  tung(n, world, p) {
    const ratio = n.life / n.lifeMax;
    n.ai[0]++;
    if (p.dead || (G.isDay() && n.ai[0] > 300)) {
      n.vy -= 0.4; n.y += n.vy; n.alpha -= 0.01;
      if (n.alpha <= 0) { n.dead = true; n.silentRemove = true; G.announce('Sahur is over. Tung Tung Tung Sahur went home.', '#af4bff'); }
      return;
    }
    n.frame = 0;
    const enraged = ratio < 0.35;
    n.vy = Math.min(n.vy + 0.45, 14);
    if (!n.state) n.state = 'walk';
    n.dir = p.cx < n.cx ? -1 : 1;
    if (n.state === 'walk') {
      const spd = enraged ? 3.5 : 2.2;
      n.vx = clamp(n.vx + n.dir * 0.15, -spd, spd);
      moveEntity(n, world, { stepUp: true });
      if (n.onGround && n.collidedX) n.vy = -9;
      n.ai[1]++;
      if (Math.abs(p.cx - n.cx) < 90 && Math.abs(p.cy - n.cy) < 100 && n.ai[1] > 40) { n.state = 'swing'; n.ai[1] = 0; }
      else if (n.ai[1] > (enraged ? 110 : 170)) { n.state = Math.random() < 0.5 ? 'leap' : 'throw'; n.ai[1] = 0; }
      if (Math.abs(p.cy - n.cy) > 400 || Math.abs(p.cx - n.cx) > 900) { n.state = 'leap'; n.ai[1] = 0; }
      n.frameKey = 'gen/tung_0';
    } else if (n.state === 'swing') {
      n.ai[1]++; n.vx *= 0.8;
      moveEntity(n, world);
      n.frameKey = n.ai[1] < 20 ? 'gen/tung_1' : 'gen/tung_2';
      if (n.ai[1] === 20) {
        playSound('swing', 1); Synth.tung(1);
        combatText(n.cx + n.dir * 40, n.y, 'TUNG!', '#e8c898', { big: true, life: 40 });
        const r = { x: n.cx + (n.dir > 0 ? 0 : -110), y: n.y - 10, w: 110, h: n.h + 10 };
        for (const pl of G.players) if (!pl.dead && rectsOverlap(r, pl)) G.hurtPlayer(pl, Math.round(n.damage * 1.4), n.dir, n);
      }
      if (n.ai[1] > 40) { n.state = 'walk'; n.ai[1] = 0; }
    } else if (n.state === 'leap') {
      if (n.ai[1] === 0) { n.vy = -13; n.vx = clamp((p.cx - n.cx) / 45, -9, 9); n.say('SAHUR!!'); speak('sahur!', 1.0, 0.6); }
      n.ai[1]++;
      n.frameKey = 'gen/tung_1';
      moveEntity(n, world, { stepUp: false });
      if (n.onGround && n.ai[1] > 10) {
        // slam: shockwaves both ways
        Synth.tung(1); G.shake = 12;
        for (const dir of [-1, 1]) G.spawnProjectile('tung_wave', n.cx, n.y + n.h - 12, dir * (enraged ? 7 : 5), 0, 26, 3, n, { hostile: true });
        n.state = 'walk'; n.ai[1] = 0; n.vx = 0;
      }
      if (n.ai[1] > 200) { n.state = 'walk'; n.ai[1] = 0; }
    } else if (n.state === 'throw') {
      n.ai[1]++; n.vx *= 0.85;
      moveEntity(n, world);
      n.frameKey = n.ai[1] % 20 < 10 ? 'gen/tung_1' : 'gen/tung_2';
      if (n.ai[1] % 20 === 10) {
        const dx = p.cx - n.cx;
        G.spawnProjectile('tung_log', n.cx, n.y + 10, clamp(dx / 50, -9, 9) + randRange(-1, 1), randRange(-9, -6), 22, 2, n, { hostile: true, gravity: 0.3 });
        combatText(n.cx, n.y - 10, 'tung', '#e8c898', { life: 30 });
      }
      if (n.ai[1] > (enraged ? 80 : 60)) { n.state = 'walk'; n.ai[1] = 0; }
    }
    if (n.ai[0] % 600 === 0) { n.say(pick(MEME.bossTaunts.tung_sahur)); Synth.tung(0.8); }
  },
  wall(n, world, p) {
    const ratio = n.life / n.lifeMax;
    if (!n.inited) {
      n.inited = true;
      // move toward the far side of the world from where it spawned (unless the summon chose a direction)
      if (!n.ai[3]) n.ai[3] = n.cx < world.w * TS / 2 ? 1 : -1;
      for (let i = 0; i < 6; i++) { const h = G.spawnNPC('hungry', n.cx, n.cy); h.ai[1] = -150 + i * 60; }
    }
    n.ai[0]++;
    const dir = n.ai[3];
    const spd = 1.3 + (1 - ratio) * 2.6;
    n.x += dir * spd;
    // the face follows the player's height, clamped to the underworld
    const top = world.hellLayer * TS, bot = (world.h - 2) * TS;
    const ty = clamp(p.cy - n.h / 2, top, bot - n.h);
    n.y += (ty - n.y) * 0.05;
    n.bodyTop = top - 20 * TS; n.bodyBot = world.h * TS;
    // tongue: pull player if they are behind the wall or too far away
    const behind = dir > 0 ? p.cx < n.x : p.cx > n.x + n.w;
    for (const pl of G.players) {
      const behindPl = dir > 0 ? pl.cx < n.x : pl.cx > n.x + n.w;
      if (pl.dead || !(behindPl || Math.abs(pl.cx - n.cx) > 2000)) continue;
      if (!pl.remote) { pl.x += (n.cx - pl.cx) * 0.08; pl.y += (n.cy - pl.cy) * 0.08; pl.vx = 0; pl.vy = 0; }
      if (G.tick % 20 === 0) { if (pl.remote) G.hurtPlayer(pl, 60, 0, n); else pl.hurt(60, 0, n, 'enemy', true); combatText(pl.cx, pl.y - 20, 'TONGUED (cringe)', '#ff5a5a', { life: 40 }); }
    }
    // contact along the whole wall column (clients check themselves)
    const lp = G.player;
    if (!lp.dead && lp.cx > n.x - 10 && lp.cx < n.x + n.w + 10 && lp.y + lp.h > n.bodyTop) lp.hurt(n.damage, dir, n, 'enemy');
    // eye lasers
    const rate = ratio < 0.25 ? 40 : ratio < 0.5 ? 70 : 110;
    if (n.ai[0] % rate === 0 && !p.dead) {
      for (const eyeY of [n.y + 60, n.y + n.h - 60]) {
        const ex = n.cx + dir * 40;
        const a = Math.atan2(p.cy - eyeY, p.cx - ex);
        G.spawnProjectile('eye_laser', ex, eyeY, Math.cos(a) * 9, Math.sin(a) * 9, 24, 0, n, { hostile: true });
      }
      playSound('item12', 0.4);
    }
    if (n.ai[0] % 400 === 0) { n.say(pick(MEME.bossTaunts.wall_of_flesh)); if (Math.random() < 0.5) speak(n.speech, 0.9, 0.5); }
    // don't crush town npcs / keep hungry count
    if (n.ai[0] % 300 === 0 && G.npcs.filter(h => h.type === 'hungry').length < 3) { const h = G.spawnNPC('hungry', n.cx, n.cy); h.ai[1] = randRange(-150, 150); }
    // reached world edge = player loses the arena; wall despawns (Terraria: WoF kills the player)
    if (n.x < 0 || n.x + n.w > world.w * TS) { for (const pl of G.players) if (!pl.dead) { if (pl.remote) G.hurtPlayer(pl, 9999, 0, n); else pl.kill('enemy', n); } n.dead = true; n.silentRemove = true; }
  },
});

// custom draws
BOSS_TYPES.tung_sahur.drawCustom = (n, ctx, camX, camY) => {
  const img = getImg(n.frameKey || 'gen/tung_0');
  const sx = Math.round(n.cx - camX), sy = Math.round(n.y + n.h - camY);
  ctx.save(); ctx.globalAlpha = n.alpha; ctx.translate(sx, sy);
  if (n.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -img.width / 2, -img.height);
  if (n.hitFlash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,60,60,0.4)'; ctx.fillRect(-img.width / 2, -img.height, img.width, img.height); }
  ctx.restore();
  if (n.speechT > 0) drawSpeech(ctx, n.speech, sx, sy - n.h - 10);
};
BOSS_TYPES.wall_of_flesh.drawCustom = (n, ctx, camX, camY) => {
  // wiki sprite: full face (eyes + mouth) facing left; flesh column spans x 60..209
  const face = getImg('npcs/Wall_of_Flesh');
  const dir = n.ai[3] || 1;
  const sx = Math.round(n.x - camX);
  const top = Math.max(n.bodyTop || 0, camY - 40), bottom = Math.min(n.bodyBot || 0, camY + G.viewH + 40);
  const fy = Math.round(n.y - camY);
  ctx.save();
  // mirror around the hitbox center so the face points the way the wall moves
  if (dir > 0) { ctx.translate(sx + n.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + n.w / 2), 0); }
  const seg = 40, colX = sx + 50;
  for (let y = Math.floor((top - camY) / seg) * seg; y < bottom - camY; y += seg) ctx.drawImage(face, 60, 105, 149, seg, colX, y, 149, seg);
  ctx.drawImage(face, sx - 10, fy);
  // brainrot flair: brains stuck to the wall
  const brain = getImg('gen/brain');
  for (let i = 0; i < 5; i++) ctx.drawImage(brain, colX + 30 + (i % 2) * 40, Math.round(fy - 160 + i * 150 + Math.sin(G.tick / 20 + i) * 6));
  if (n.hitFlash > 0) { ctx.fillStyle = 'rgba(255,60,60,0.25)'; ctx.fillRect(sx - 10, top - camY, 220, bottom - top); }
  ctx.restore();
  // tethers for hungries
  ctx.strokeStyle = '#7a2a3a'; ctx.lineWidth = 4;
  for (const h of G.npcs) if (h.type === 'hungry' && h.anchor) { ctx.beginPath(); ctx.moveTo(h.anchor[0] - camX, h.anchor[1] - camY); ctx.lineTo(h.cx - camX, h.cy - camY); ctx.stroke(); }
  if (n.speechT > 0) drawSpeech(ctx, n.speech, Math.round(n.cx - camX), Math.round(n.y - camY));
};
BOSS_TYPES.eye_of_cthulhu.drawCustom = (n, ctx, camX, camY) => {
  const img = getImg(n.def.img);
  ctx.save(); ctx.translate(Math.round(n.cx - camX), Math.round(n.cy - camY)); ctx.rotate(n.rot);
  ctx.drawImage(img, -img.width / 2, -img.height / 2 - 18);
  if (n.hitFlash > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.fillRect(-img.width / 2, -img.height / 2 - 18, img.width, img.height); }
  ctx.restore();
  if (n.speechT > 0) drawSpeech(ctx, n.speech, Math.round(n.cx - camX), Math.round(n.y - camY - 10));
};
