#!/usr/bin/env python3
"""Where does TerraJev spend its time, and what does the reward actually pay for?

Reads rollout JSONL (tests/jevcollect.js) and prints, per action kind:
  time share, reward per 1000 ticks, which reward terms that comes from, and how often the
  model overrode the teacher. Also: night behaviour, options that were offered but rarely taken.

usage: python3 tools/jev/analyze.py tools/jev/data/r*_a.jsonl [--src model|teacher|explore]
"""
import argparse, collections, glob, gzip, json, math, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))

TERMS = {  # must match train_terrajev.reward()
    'taken': lambda o: -3.0 * o['taken'], 'died': lambda o: -6.0 * o['died'], 'kills': lambda o: 0.3 * o['kills'],
    'dealt': lambda o: 0.002 * o['dealt'], 'loot': lambda o: 0.3 * math.log1p(o['gain'] / 100.0), 'ms': lambda o: 1.5 * o['ms'],
    'def': lambda o: 0.3 * o.get('dDef', 0), 'life': lambda o: 0.02 * o.get('dLife', 0), 'pick': lambda o: 0.05 * o.get('dPick', 0),
    'boss': lambda o: 15.0 * o.get('boss', 0) + 0.003 * o.get('bossDealt', 0),
}
NIGHT = 17  # state index: G.isNight()


def kind(cid): return cid.split(':')[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--src', help='only decisions from this source')
    a = ap.parse_args()
    rows = []
    for pat in a.files:
        for f in glob.glob(pat):
            for line in (gzip.open(f, 'rt') if f.endswith('.gz') else open(f)):
                r = json.loads(line)
                if r.get('q') == 'act' and 'outcome' in r and (not a.src or r['src'] == a.src): rows.append(r)
    if not rows: sys.exit('no act rows')
    tot_dur = sum(r['outcome']['dur'] for r in rows)
    agg = collections.defaultdict(lambda: {'n': 0, 'dur': 0, 'night': 0, 'R': 0.0, 'terms': collections.Counter(), 'src': collections.Counter(), 'over': 0})
    offered, taken_when_offered = collections.Counter(), collections.Counter()
    override = collections.Counter()  # (teacher kind -> chosen kind) when they differ
    for r in rows:
        o, ch = r['outcome'], r['cands'][r['chosen']]
        g = agg[kind(ch)]
        g['n'] += 1; g['dur'] += o['dur']; g['src'][r['src']] += 1
        if r['state'][NIGHT]: g['night'] += o['dur']
        for t, fn in TERMS.items():
            v = fn(o); g['terms'][t] += v; g['R'] += v
        tk = kind(r['cands'][r['teacher']]) if r['teacher'] >= 0 else None
        if tk and tk != kind(ch) and r['src'] != 'teacher': override[(tk, kind(ch))] += 1
        for k in set(map(kind, r['cands'])): offered[k] += 1
        taken_when_offered[kind(ch)] += 1

    print(f'{len(rows)} decisions, {tot_dur} ticks ({tot_dur / 60 / 60:.0f} game-min)\n')
    print(f'{"kind":10s} {"n":>6s} {"time%":>6s} {"night%":>7s} {"R/1k tick":>9s} {"R/dec":>7s}  top reward terms (total)')
    for k, g in sorted(agg.items(), key=lambda kv: -kv[1]['dur']):
        terms = ', '.join(f'{t} {v:+.0f}' for t, v in g['terms'].most_common() if abs(v) >= 0.5)
        neg = ', '.join(f'{t} {v:+.0f}' for t, v in g['terms'].items() if v <= -0.5)
        print(f'{k:10s} {g["n"]:6d} {100 * g["dur"] / tot_dur:5.1f}% {100 * g["night"] / max(1, g["dur"]):6.0f}% '
              f'{1000 * g["R"] / max(1, g["dur"]):+9.2f} {g["R"] / g["n"]:+7.2f}  {terms}' + (f' | {neg}' if neg else ''))

    print('\npick rate when offered (how often each kind is taken when it is on the menu):')
    for k in sorted(offered, key=lambda k: taken_when_offered[k] / offered[k]):
        print(f'  {k:10s} offered {offered[k]:6d}  taken {taken_when_offered[k]:6d}  ({100 * taken_when_offered[k] / offered[k]:4.1f}%)')

    print('\nmodel/explore overriding the teacher (teacher wanted -> got):')
    for (t, c), n in override.most_common(12): print(f'  {t:10s} -> {c:10s} {n}')

    night = [r for r in rows if r['state'][NIGHT]]
    if night:
        nd = sum(r['outcome']['dur'] for r in night)
        c = collections.Counter()
        for r in night: c[kind(r['cands'][r['chosen']])] += r['outcome']['dur']
        print(f'\nnight: {100 * nd / tot_dur:.0f}% of time; spent on ' + ', '.join(f'{k} {100 * v / nd:.0f}%' for k, v in c.most_common(6)))


if __name__ == '__main__':
    main()
