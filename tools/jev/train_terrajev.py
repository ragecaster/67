#!/usr/bin/env python3
"""Train TerraJev (src/terrajev.js) from bot rollouts and export browser weights.

Data: JSONL from tests/jevcollect.js. Each row = one decision: state features, candidate option ids + features,
the chosen index, the behaviour probability (mu), the teacher (old rules) index, and the outcome over the next
240 ticks (damage taken / died / kills / damage dealt / loot gained / milestones).

Objective (offline, stable, works from logged data):
  L = w_bc * CE(teacher)                         imitation, so the model starts as good as the rules
    + w_rl * exp(clip(A/beta)) * CE(chosen)      advantage-weighted regression: do more of what turned out well
    + 0.5  * (V(s) - R)^2                        value baseline,  A = R - V(s)
The architecture mirrors terrajev.js exactly (Jev-style candidate-set head with self-attention over candidates).

usage: tools/jev/.venv/bin/python tools/jev/train_terrajev.py tools/jev/data/*.jsonl [--bc 1.0 --rl 1.0 --epochs 30]
"""
import argparse, glob, json, math, random, sys
from pathlib import Path
import torch, torch.nn as nn, torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[2]


def reward(o, q='act'):
    # one number per decision, measured over that decision's own window (until the next decision, 300..1500 ticks)
    return (-3.0 * o['taken'] - 6.0 * o['died'] + 0.3 * o['kills'] + 0.002 * o['dealt']
            + 0.3 * math.log1p(o['gain'] / 100.0) + 1.5 * o['ms'] + 0.3 * o.get('dDef', 0) + 0.02 * o.get('dLife', 0) + 0.05 * o.get('dPick', 0)
            # the end goal: all four bosses dead. A first kill outweighs any death, and damage on a boss earns partial credit
            + 15.0 * o.get('boss', 0) + 0.003 * o.get('bossDealt', 0))


class TerraJev(nn.Module):
    def __init__(self, sdim, cdim, d=64, heads=4):
        super().__init__()
        self.state = nn.ModuleList([nn.Linear(sdim, 128), nn.Linear(128, d)])
        self.cand = nn.ModuleList([nn.Linear(cdim, d)])
        self.pair = nn.Linear(3 * d, d)
        self.q, self.k, self.v, self.o = (nn.Linear(d, d) for _ in range(4))
        self.score = nn.Linear(d, 1)
        self.value = nn.ModuleList([nn.Linear(d, d), nn.Linear(d, 1)])
        self.heads, self.d = heads, d

    def forward(self, S, C, mask):
        # S: [B, sdim], C: [B, K, cdim], mask: [B, K] True = real candidate
        s = F.relu(self.state[1](F.relu(self.state[0](S))))
        c = F.relu(self.cand[0](C))
        sx = s[:, None, :].expand_as(c)
        h = F.relu(self.pair(torch.cat([sx, c, sx * c], -1)))
        B, K, d = h.shape
        nh, dh = self.heads, d // self.heads
        q = self.q(h).view(B, K, nh, dh).transpose(1, 2)
        k = self.k(h).view(B, K, nh, dh).transpose(1, 2)
        v = self.v(h).view(B, K, nh, dh).transpose(1, 2)
        att = (q @ k.transpose(-1, -2)) / math.sqrt(dh)
        att = att.masked_fill(~mask[:, None, None, :], -1e9).softmax(-1)
        mixed = (att @ v).transpose(1, 2).reshape(B, K, d)
        logits = self.score(torch.tanh(h + self.o(mixed))).squeeze(-1)
        logits = logits.masked_fill(~mask, -1e9)
        val = self.value[1](F.relu(self.value[0](s))).squeeze(-1)
        return logits, val


def load(paths, q='act'):
    rows = []
    for p in paths:
        for line in open(p):
            r = json.loads(line)
            if r.get('q') == q and 'outcome' in r and len(r['cands']) > 1:
                rows.append(r)
    if rows:  # only the newest feature layout (older rollouts used different features)
        dims = (len(rows[-1]['state']), len(rows[-1]['feats'][0]))
        rows = [r for r in rows if (len(r['state']), len(r['feats'][0])) == dims]
    return rows


def batchify(rows):
    K = max(len(r['cands']) for r in rows)
    sdim, cdim = len(rows[0]['state']), len(rows[0]['feats'][0])
    S = torch.tensor([r['state'] for r in rows], dtype=torch.float32)
    C = torch.zeros(len(rows), K, cdim); M = torch.zeros(len(rows), K, dtype=torch.bool)
    for i, r in enumerate(rows):
        n = len(r['cands']); C[i, :n] = torch.tensor(r['feats']); M[i, :n] = True
    a = torch.tensor([r['chosen'] for r in rows]); t = torch.tensor([r['teacher'] for r in rows])
    R = torch.tensor([reward(r['outcome'], r.get('q', 'tactic')) for r in rows], dtype=torch.float32)
    mu = torch.tensor([r['mu'] for r in rows], dtype=torch.float32)
    return S, C, M, a, t, R, mu


def export(model, path, meta):
    def L(layer, act=None):
        o = {'w': layer.weight.detach().flatten().tolist(), 'b': layer.bias.detach().tolist()}
        if act: o['act'] = True
        return o
    W = {'meta': meta, 'heads': model.heads,
         'state': [L(model.state[0]), L(model.state[1], act=True)], 'cand': [L(model.cand[0], act=True)],
         'pair': L(model.pair), 'q': L(model.q), 'k': L(model.k), 'v': L(model.v), 'o': L(model.o), 'score': L(model.score)}
    rnd = lambda x: [round(v, 5) for v in x]
    for key in ('pair', 'q', 'k', 'v', 'o', 'score'):
        W[key]['w'] = rnd(W[key]['w']); W[key]['b'] = rnd(W[key]['b'])
    for grp in ('state', 'cand'):
        for l in W[grp]: l['w'] = rnd(l['w']); l['b'] = rnd(l['b'])
    Path(path).write_text('// generated by tools/jev/train_terrajev.py\nconst TERRAJEV_WEIGHTS = ' + json.dumps(W, separators=(',', ':')) + ';\n')


def train_one(q, paths, a):
    rows = load(paths, q)
    if len(rows) < 300:
        print(f'[{q}] only {len(rows)} decisions: skipped'); return None, None
    random.seed(0); random.shuffle(rows)
    nval = max(100, len(rows) // 10)
    val, train = rows[:nval], rows[nval:]
    S, C, M, A, Tt, R, MU = batchify(train)
    vS, vC, vM, vA, vT, vR, vMU = batchify(val)
    print(f'[{q}] {len(rows)} decisions')
    stats = {}
    for r in rows:
        o = r['cands'][r['chosen']].split(':')[0]
        st = stats.setdefault(o, [0, 0.0]); st[0] += 1; st[1] += reward(r['outcome'], q)
    for o, (n, tot) in sorted(stats.items(), key=lambda x: -x[1][0])[:14]:
        print(f'    {o:22s} chosen {n:6d}x  mean reward {tot / n:+.3f}')
    torch.manual_seed(0)
    model = TerraJev(S.shape[1], C.shape[2])
    init = ROOT / 'tools' / 'jev' / f'terrajev_{q}.pt'
    if a.resume and init.exists():  # resume from the promoted (incumbent) model
        try: model.load_state_dict(torch.load(init))
        except Exception as e: print('    (could not resume:', e, ')')
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
    rstd = R.std().clamp(min=1e-3)
    for ep in range(a.epochs):
        model.train()
        perm = torch.randperm(len(S))
        for i in range(0, len(S), 256):
            b = perm[i:i + 256]
            logits, val_pred = model(S[b], C[b], M[b])
            logp = logits.log_softmax(-1)
            has_t = Tt[b] >= 0
            bc = -(logp[has_t, Tt[b][has_t]]).mean() if has_t.any() else torch.tensor(0.)
            adv = R[b] - val_pred.detach(); adv = ((adv - adv.mean()) / (adv.std() + 1e-6)).clamp(-3, 3)
            w = torch.exp(adv / a.beta).clamp(max=10)
            awr = -(w * logp[torch.arange(len(b)), A[b]]).mean()
            ent = -(logp.exp() * logp.masked_fill(~M[b], 0)).sum(-1).mean()
            vloss = F.mse_loss(val_pred, R[b])
            loss = a.bc * bc + a.rl * awr + 0.5 * vloss - a.ent * ent
            opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
    model.eval()
    with torch.no_grad():
        lg, vv = model(vS, vC, vM)
        vl = F.mse_loss(vv, vR).item()
        # how much better than the logged choices does the model expect to do? (advantage of argmax vs chosen, by value)
        pred = lg.argmax(-1)
        same = (pred == vA).float().mean().item()
        ht = vT >= 0
        teach = (pred[ht] == vT[ht]).float().mean().item() if ht.any() else float('nan')
        ev = 1 - vl / max(vR.var().item(), 1e-6)
    print(f'    value explained variance {ev:.2f}; agrees with the teacher {teach * 100:.0f}%, with the logged choice {same * 100:.0f}%')
    torch.save(model.state_dict(), a.pt or init)
    return model, {'stateDim': S.shape[1], 'candDim': C.shape[2], 'decisions': len(rows)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('data', nargs='+')
    ap.add_argument('--bc', type=float, default=1.0)
    ap.add_argument('--rl', type=float, default=1.0)
    ap.add_argument('--beta', type=float, default=1.0)
    ap.add_argument('--ent', type=float, default=0.01)
    ap.add_argument('--epochs', type=int, default=8)
    ap.add_argument('--pt', default=None, help='where to save the trained network (default: overwrite the incumbent)')
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--questions', default='act')
    ap.add_argument('--out', default=str(ROOT / 'src' / 'terrajev_weights.js'))
    a = ap.parse_args()
    paths = sorted({p for g in a.data for p in glob.glob(g)})
    print(f'{len(paths)} files')
    models = {}
    for q in a.questions.split(','):
        model, meta = train_one(q, paths, a)
        if model is not None: models[q] = (model, meta)
    def L(layer, act=None):
        o = {'w': [round(v, 5) for v in layer.weight.detach().flatten().tolist()], 'b': [round(v, 5) for v in layer.bias.detach().tolist()]}
        if act: o['act'] = True
        return o
    out = {}
    for q, (m, meta) in models.items():
        out[q] = {'meta': meta, 'heads': m.heads, 'state': [L(m.state[0]), L(m.state[1], act=True)], 'cand': [L(m.cand[0], act=True)],
                  'pair': L(m.pair), 'q': L(m.q), 'k': L(m.k), 'v': L(m.v), 'o': L(m.o), 'score': L(m.score)}
    Path(a.out).write_text('// generated by tools/jev/train_terrajev.py\nconst TERRAJEV_WEIGHTS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    print('exported', a.out, 'questions:', list(out))


if __name__ == '__main__':
    main()
