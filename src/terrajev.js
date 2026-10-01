// ---------- TerraJev: a tiny Jev-style decision model for BotSigma ----------
// Same contract as Jev / OpenJev / NanoJev: a state + a typed question with a set of candidate options in,
// a calibrated probability for every candidate out, in ONE forward pass (nothing is generated).
// Unlike NanoJev (0.6B, ~250 ms, never saw Terraria: 1/5 on obvious probes), this model is ~100k
// parameters, runs in the browser in well under a millisecond, and is trained on Terraria rollouts
// (tools/jev/train_terrajev.py): imitation of the old rules first, then outcome-weighted policy improvement.
//
// Architecture (mirrors tools/jev/train_terrajev.py exactly):
//   s = MLP_state(state features)                 64-d
//   c_i = MLP_cand(candidate features_i)          64-d
//   h_i = ReLU(W_pair [s, c_i, s*c_i])            64-d
//   a_i = MultiHeadAttention(h)_i                 (4 heads: candidates see each other, permutation-equivariant)
//   logit_i = w . tanh(h_i + a_i) + b ;  p = softmax(logit / T) over the offered candidates
//   V(s) = value head (used only in training as the advantage baseline)
const TerraJev = {
  W: null, ready: false, temperature: 1, sample: false, epsilon: 0, logging: false, records: [], pending: [],
  OPTIONS: ['fight', 'kite', 'flee', 'heal', 'ignore', 'rest', 'shelter', 'continue'],

  load(weights) {
    if (!weights || !weights.meta) return false;
    this.W = weights; this.ready = true;
    return true;
  },

  // ---------- tiny tensor helpers ----------
  lin(L, x) { const o = L.b.slice(), n = x.length; for (let i = 0; i < o.length; i++) { let s = o[i]; const off = i * n; for (let j = 0; j < n; j++) s += L.w[off + j] * x[j]; o[i] = s; } return o; },
  relu(v) { for (let i = 0; i < v.length; i++) if (v[i] < 0) v[i] = 0; return v; },
  mlp(layers, x) { let h = x; layers.forEach((L, i) => { h = this.lin(L, h); if (i < layers.length - 1 || L.act) this.relu(h); }); return h; },

  forward(stateVec, candVecs) {
    const W = this.W;
    const s = this.mlp(W.state, stateVec);
    const H = candVecs.map(cv => { const c = this.mlp(W.cand, cv); return this.relu(this.lin(W.pair, s.concat(c, s.map((v, i) => v * c[i])))); });
    // multi-head self-attention across the candidate set
    const d = H[0].length, nh = W.heads, dh = d / nh, n = H.length;
    const Q = H.map(h => this.lin(W.q, h)), K = H.map(h => this.lin(W.k, h)), V = H.map(h => this.lin(W.v, h));
    const mixed = H.map(() => new Array(d).fill(0));
    for (let hd = 0; hd < nh; hd++) {
      for (let i = 0; i < n; i++) {
        const sc = []; let mx = -1e9;
        for (let j = 0; j < n; j++) { let dot = 0; for (let k = hd * dh; k < (hd + 1) * dh; k++) dot += Q[i][k] * K[j][k]; dot /= Math.sqrt(dh); sc.push(dot); if (dot > mx) mx = dot; }
        let sum = 0; for (let j = 0; j < n; j++) { sc[j] = Math.exp(sc[j] - mx); sum += sc[j]; }
        for (let j = 0; j < n; j++) { const a = sc[j] / sum; for (let k = hd * dh; k < (hd + 1) * dh; k++) mixed[i][k] += a * V[j][k]; }
      }
    }
    const logits = H.map((h, i) => { const o = this.lin(W.o, mixed[i]); let z = W.score.b[0]; for (let k = 0; k < d; k++) z += W.score.w[k] * Math.tanh(h[k] + o[k]); return z; });
    return logits;
  },

  // decide(question) -> { choice, probabilities, idx }
  //   q = { id, state: number[], candidates: [{ id, features: number[] }], teacher?: id }
  decide(q) {
    let probs;
    if (this.ready) {
      const logits = this.forward(q.state, q.candidates.map(c => c.features));
      const T = this.temperature, mx = Math.max(...logits);
      const e = logits.map(z => Math.exp((z - mx) / T)), sum = e.reduce((a, b) => a + b, 0);
      probs = e.map(v => v / sum);
    } else {
      // no weights yet: behave like the teacher (the old rules), still through the same interface
      probs = q.candidates.map(c => (c.id === q.teacher ? 1 : 0));
      if (!probs.some(v => v)) probs = q.candidates.map(() => 1 / q.candidates.length);
    }
    // exploration for training rollouts: with probability epsilon try a random allowed option
    const eps = this.epsilon || 0;
    if (eps > 0) probs = probs.map(v => (1 - eps) * v + eps / probs.length);
    let idx = 0;
    if (this.sample || eps > 0) { let r = Math.random(), acc = 0; idx = probs.length - 1; for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (r <= acc) { idx = i; break; } } }
    else idx = probs.indexOf(Math.max(...probs));
    const out = { id: q.id, choice: q.candidates[idx].id, idx, probabilities: Object.fromEntries(q.candidates.map((c, i) => [c.id, probs[i]])) };
    if (this.logging) this.record(q, out, probs);
    this.last = out;
    return out;
  },

  // ---------- rollout logging for training (outcome measured over the next H ticks) ----------
  H: 240,
  record(q, out, probs) {
    const m = this.metrics();
    this.pending.push({ t: G.tick, q: q.id, state: q.state, cands: q.candidates.map(c => c.id), feats: q.candidates.map(c => c.features), chosen: out.idx, mu: probs[out.idx], teacher: q.candidates.findIndex(c => c.id === q.teacher), m0: m });
    if (this.pending.length > 4000) this.pending.shift();
  },
  // running counters the reward is built from (filled by bot/npc hooks)
  counters: { dmgTaken: 0, dmgDealt: 0, kills: 0, deaths: 0, value: 0 },
  metrics() { const c = this.counters, p = G.player; return { taken: c.dmgTaken, dealt: c.dmgDealt, kills: p.stats.kills, deaths: c.deaths, value: this.invValue(p), lifeMax: p.lifeMax, ms: Object.keys(Bot.milestones || {}).length }; },
  invValue(p) { let v = 0; for (const s of p.inv) if (s && ITEMS[s.id]) v += (ITEMS[s.id].value || 1) * s.count; return v; },
  tickLogging() {
    if (!this.logging) return;
    const p = G.player;
    if (this.lastLife != null && p.life < this.lastLife && !p.dead) this.counters.dmgTaken += this.lastLife - p.life;
    this.lastLife = p.dead ? null : p.life;
    if (p.dead && !this.wasDead) this.counters.deaths++;
    this.wasDead = p.dead;
    while (this.pending.length && G.tick - this.pending[0].t >= this.H) {
      const r = this.pending.shift(), m = this.metrics(), m0 = r.m0;
      r.outcome = {
        taken: (m.taken - m0.taken) / Math.max(100, m0.lifeMax), died: m.deaths - m0.deaths, kills: m.kills - m0.kills,
        dealt: m.dealt - m0.dealt, gain: Math.max(0, m.value - m0.value), ms: m.ms - m0.ms,
      };
      delete r.m0;
      this.records.push(r);
    }
  },
};

// ---------- feature extraction (keep in sync with tools/jev/train_terrajev.py: STATE_DIM / CAND_DIM) ----------
const JEV_TASKS = ['chop', 'build', 'craft', 'mine', 'fight', 'boss', 'hell', 'explore', 'other'];
function jevTaskKind(goal) {
  goal = goal || '';
  if (/chop/.test(goal)) return 'chop'; if (/house|build/.test(goal)) return 'build'; if (/craft|placing|equip/.test(goal)) return 'craft';
  if (/min/.test(goal)) return 'mine'; if (/Eye|Tung|boss|summon|lens/.test(goal)) return 'boss'; if (/Ohio|hell|bridge|doll|island/.test(goal)) return 'hell';
  if (/fight/.test(goal)) return 'fight'; if (/explor/.test(goal)) return 'explore'; return 'other';
}
function jevStateFeatures(bot, enemy) {
  const p = G.player, w = G.world, [fx, fy] = bot.feet();
  const potions = p.inv.reduce((n, s) => n + (s && ITEMS[s.id].heal && ITEMS[s.id].potion ? s.count : 0), 0);
  const ranged = p.inv.some(s => s && ITEMS[s.id].damage && (ITEMS[s.id].use === 'shoot' || ITEMS[s.id].shoot) && !(ITEMS[s.id].ammo && p.findAmmo(ITEMS[s.id].ammo) < 0));
  const ws = bot.bestWeaponSlot(enemy || null), wit = ws >= 0 ? ITEMS[p.inv[ws].id] : null;
  const dps = wit ? (wit.fixedDamage ? 67 : wit.damage) * 60 / Math.max(6, wit.useTime) : 0;
  const zone = fy < w.worldSurface ? 0 : fy < w.rockLayer ? 1 : fy < w.hellLayer ? 2 : 3;
  const base = bot.base || [fx, fy], dBase = Math.abs(fx - base[0]) + Math.abs(fy - base[1]);
  const near = G.npcs.filter(n => !n.friendly && !n.town && !n.dead && n.alpha > 0.5);
  const within = r => near.filter(n => dist(n.cx, n.cy, p.cx, p.cy) < r).length;
  const threat = near.filter(n => dist(n.cx, n.cy, p.cx, p.cy) < 300).reduce((s, n) => s + Math.max(1, n.damage - p.calc.defense * 0.5), 0);
  const projs = G.projectiles.filter(q => q.hostile && !q.dead && dist(q.cx, q.cy, p.cx, p.cy) < 220).length;
  const boss = G.npcs.find(n => n.boss && !n.dead);
  const e = enemy, edx = e ? (e.cx - p.cx) : 0, edy = e ? (e.cy - p.cy) : 0;
  const recent = TerraJev.recentHurt || 0;
  const kind = jevTaskKind(bot.lastGoal || bot.goal);
  const v = [
    p.life / p.lifeMax, p.lifeMax / 400, p.calc.defense / 30, Math.min(potions, 10) / 5, p.buffs.potion_sickness ? 1 : 0,
    ranged ? 1 : 0, Math.min(dps, 600) / 200, (p.aura || 0) / 100, p.buffs.him ? 1 : 0,
    zone === 0 ? 1 : 0, zone === 1 ? 1 : 0, zone === 2 ? 1 : 0, zone === 3 ? 1 : 0, G.inBackrooms(p) ? 1 : 0,
    Math.min(dBase, 300) / 100, dBase < 7 ? 1 : 0, bot.houseSpot ? 1 : 0,
    G.isNight() ? 1 : 0, w.flags.bloodMoon ? 1 : 0,
    boss ? 1 : 0, boss ? boss.life / boss.lifeMax : 0, boss ? Math.min(dist(boss.cx, boss.cy, p.cx, p.cy), 900) / 300 : 0,
    e ? 1 : 0, e ? Math.min(Math.hypot(edx, edy), 600) / 200 : 0, clamp(edx / 300, -2, 2), clamp(edy / 300, -2, 2),
    e ? e.life / e.lifeMax : 0, e ? Math.max(1, e.damage - p.calc.defense * 0.5) / Math.max(20, p.life) : 0,
    e && (e.def.noGravity || e.def.ai === 'flyer' || e.def.ai === 'bat' || e.def.ai === 'smiler') ? 1 : 0, e && e.boss ? 1 : 0,
    e && dps ? Math.min(e.life / (dps / 60) / 60, 10) / 3 : 0,
    within(160) / 3, within(450) / 5, Math.min(threat, 200) / 50, Math.min(projs, 6) / 3,
    Math.min(recent, 200) / Math.max(50, p.lifeMax), p.onGround ? 1 : 0, bot.floating && bot.floating() ? 1 : 0,
  ];
  for (const k of JEV_TASKS) v.push(kind === k ? 1 : 0);
  return v; // 38 + 9 = 47
}
function jevCandFeatures(bot, opt, enemy) {
  const p = G.player;
  const oh = TerraJev.OPTIONS.map(o => (o === opt ? 1 : 0));
  const potions = p.inv.reduce((n, s) => n + (s && ITEMS[s.id].heal && ITEMS[s.id].potion ? s.count : 0), 0);
  const [fx, fy] = bot.feet(), base = bot.base || [fx, fy];
  const dBase = Math.abs(fx - base[0]) + Math.abs(fy - base[1]);
  let a = 0, b = 0;
  if (opt === 'heal') { a = Math.min(potions, 10) / 5; b = (p.lifeMax - p.life) / p.lifeMax; }
  else if (opt === 'flee' || opt === 'shelter') { a = Math.min(dBase, 300) / 100; b = enemy ? Math.min(Math.abs(enemy.cx - p.cx), 600) / 200 : 0; }
  else if (opt === 'fight' || opt === 'kite') { a = enemy ? enemy.life / enemy.lifeMax : 0; b = enemy ? Math.min(Math.hypot(enemy.cx - p.cx, enemy.cy - p.cy), 600) / 200 : 0; }
  else if (opt === 'rest') { a = (p.lifeMax - p.life) / p.lifeMax; }
  return oh.concat([a, b]); // 8 + 2 = 10
}
if (typeof TERRAJEV_WEIGHTS !== 'undefined') TerraJev.load(TERRAJEV_WEIGHTS);
