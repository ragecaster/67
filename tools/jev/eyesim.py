"""Offline Eye of Ohio dash-dodge simulator (mirrors bosses.js eye() and player.js movement on flat ground).
Reports Eye contact hits per 1000 ticks for different player movement strategies, phase 1 and phase 2."""
import math, random, sys

PW, PH, EW, EH = 20, 42, 100, 100


class P:
    def __init__(s):
        s.x, s.y, s.vx, s.vy = 0.0, -PH, 0.0, 0.0   # y: top; ground at y=0 (feet)
        s.jump, s.held, s.ground, s.imm = 0, False, True, 0

    @property
    def cx(s): return s.x + PW / 2
    @property
    def cy(s): return s.y + PH / 2

    def step(s, L, R, J):
        mx, acc, slow = 3, 0.08, 0.2
        if L and not R:
            if s.vx > -mx:
                if s.vx > slow: s.vx -= slow
                s.vx -= acc; s.vx = max(s.vx, -mx)
        elif R and not L:
            if s.vx < mx:
                if s.vx < -slow: s.vx += slow
                s.vx += acc; s.vx = min(s.vx, mx)
        else:
            sl = slow if s.ground else slow * 0.5
            s.vx = s.vx - sl if s.vx > sl else s.vx + sl if s.vx < -sl else 0
        if abs(s.vx) > mx: s.vx *= 0.97
        if J:
            if s.jump > 0:
                s.vy = -5.01; s.jump -= 1
            elif not s.held and s.ground:
                s.vy = -5.01; s.jump = 15
            s.held = True
        else:
            s.jump = 0; s.held = False
        s.vy = min(s.vy + 0.4, 10)
        s.x += s.vx; s.y += s.vy
        if s.y >= -PH: s.y = -PH; s.vy = 0; s.ground = True
        else: s.ground = False
        if s.imm > 0: s.imm -= 1


class Eye:
    def __init__(s, p, phase2):
        s.x, s.y = p.cx - 300 - EW / 2, p.cy - 400
        s.vx = s.vy = 0.0; s.ph2 = phase2; s.state = 'hover'; s.a1 = 0; s.dashes = 0

    @property
    def cx(s): return s.x + EW / 2
    @property
    def cy(s): return s.y + EH / 2

    def step(s, p):
        ph2 = s.ph2
        if s.state == 'hover':
            tx, ty = p.cx, p.cy - 230
            spd, acc = (8, 0.2) if ph2 else (6, 0.15)
            s.vx += max(-1, min(1, tx - s.cx)) * acc; s.vy += max(-1, min(1, ty - s.cy)) * acc
            v = math.hypot(s.vx, s.vy)
            if v > spd: s.vx *= spd / v; s.vy *= spd / v
            s.x += s.vx; s.y += s.vy; s.a1 += 1
            if s.a1 > (120 if ph2 else 280): s.state = 'dash'; s.a1 = 0; s.dashes = 0
        else:
            if s.a1 == 0:
                a = math.atan2(p.cy - s.cy, p.cx - s.cx); sp = 10 if ph2 else 7
                s.vx, s.vy = math.cos(a) * sp, math.sin(a) * sp
            s.a1 += 1; s.x += s.vx; s.y += s.vy
            if s.a1 > 40: s.vx *= 0.95; s.vy *= 0.95
            if s.a1 > (55 if ph2 else 70):
                s.a1 = 0; s.dashes += 1
                if s.dashes >= (5 if ph2 else 3): s.state = 'hover'; s.a1 = 0


def overlap(p, e):
    return p.x < e.x + EW and p.x + PW > e.x and p.y < e.y + EH and p.y + PH > e.y


def run(strategy, phase2, ticks=30000, W=56 * 16, seed=1):
    random.seed(seed)
    p = P(); e = Eye(p, phase2); mem = {'dir': 1}
    hits = 0; dash_hits = 0
    for t in range(ticks):
        L, R, J = strategy(p, e, mem, W)
        p.step(L, R, J)
        e.step(p)
        if p.imm == 0 and overlap(p, e):
            hits += 1; p.imm = 40
            if e.state == 'dash': dash_hits += 1
            kb = 1 if e.cx < p.cx else -1
            p.vx = kb * 4.5; p.vy = -3.5; p.ground = False
    return hits * 1000 / ticks


# ---- strategies -------------------------------------------------------------
def stand(p, e, m, W): return False, False, False


def strafe(p, e, m, W, jump_level=False, k=9, reverse_rule='late'):
    dashing = e.state == 'dash'
    late = not dashing or e.a1 > 35
    at_end = p.cx >= W / 2 if m['dir'] > 0 else p.cx <= -W / 2
    if at_end and (late or reverse_rule == 'any'): m['dir'] = -m['dir']
    if abs(p.cx) > W / 2 + 64: m['dir'] = -1 if p.cx > 0 else 1   # hard wall
    J = False
    if jump_level:
        level = dashing and e.a1 < 50 and e.cy > p.cy - 40 and abs(e.vx) > 3 and (e.vx > 0) == (p.cx > e.cx)
        gap = abs(e.cx - p.cx) - 60
        closing = abs(e.vx) + (abs(p.vx) if (p.vx > 0) == (e.cx > p.cx) else -abs(p.vx))
        if level and (gap < max(1, closing) * k or not p.ground): J = True
    return m['dir'] < 0, m['dir'] > 0, J


def predictive(p, e, m, W, k=9, look=60, margin=12):
    """At each tick, simulate the Eye's current dash forward (it's ballistic) against each of the three
    choices (left/right/none, with or without jump) and pick the one that keeps clear with the most margin,
    preferring to keep the current direction inside the arena."""
    best = None
    opts = [(-1, False), (1, False), (-1, True), (1, True), (0, False), (0, True)]
    for d, j in opts:
        score = sim_clear(p, e, d, j, look)
        # arena: stay inside
        edge_pen = 0
        if d != 0 and ((d > 0 and p.cx > W / 2) or (d < 0 and p.cx < -W / 2)): edge_pen = 500
        keep = 0 if d == m['dir'] else 3
        s = score - edge_pen - keep - (2 if j else 0)
        if best is None or s > best[0]: best = (s, d, j)
    _, d, j = best
    if d != 0: m['dir'] = d
    return d < 0, d > 0, j


def sim_clear(p, e, d, j, look):
    import copy
    q = copy.copy(p); f = copy.copy(e); minsep = 1e9
    for t in range(look):
        q.step(d < 0, d > 0, j and t < 16)
        f.step(q)
        sx = abs(q.cx - f.cx) - (PW + EW) / 2; sy = abs(q.cy - f.cy) - (PH + EH) / 2
        sep = max(sx, sy)
        minsep = min(minsep, sep)
        if f.state != e.state and t > 5: break
    return min(minsep, 40)


if __name__ == '__main__':
    S = {
        'stand': stand,
        'strafe': lambda p, e, m, W: strafe(p, e, m, W),
        'strafe+jump': lambda p, e, m, W: strafe(p, e, m, W, True),
        'strafe+jump k5': lambda p, e, m, W: strafe(p, e, m, W, True, 5),
        'strafe+jump k14': lambda p, e, m, W: strafe(p, e, m, W, True, 14),
        'predictive': predictive,
    }
    for name, f in S.items():
        print(f'{name:18s} ph1 {run(f, False, 12000):5.2f}/1000t  ph2 {run(f, True, 12000):5.2f}/1000t')


def plan_sim(p, e, plan, look):
    import copy
    d1, s_at, j_at = plan
    q = copy.copy(p); f = copy.copy(e); minsep = 1e9; t_hit = None
    for t in range(look):
        d = d1 if t < s_at else -d1
        q.step(d < 0, d > 0, j_at is not None and j_at <= t < j_at + 16)
        f.step(q)
        sep = max(abs(q.cx - f.cx) - (PW + EW) / 2, abs(q.cy - f.cy) - (PH + EH) / 2)
        if sep < minsep: minsep = sep
        if sep < 0: return sep - (look - t), q   # earlier hit = worse
    return min(minsep, 40), q


PLANS = [(d, s, j) for d in (-1, 1, 0) for s in (999, 12, 30) for j in (None, 0, 8, 16, 26)]


def planner(p, e, m, W, look=100, every=4):
    if m.get('left', 0) > 0 and m.get('plan'):
        m['left'] -= 1; m['t'] += 1
    else:
        best = None
        for pl in PLANS:
            sc, q = plan_sim(p, e, pl, look)
            # stay in the arena and prefer to keep running the same way, jump only when it pays
            out = max(0, abs(q.cx) - W / 2) / 16
            s = sc - out * 4 - (0.5 if pl[2] is not None else 0) - (1 if pl[0] != m['dir'] else 0) - (0.3 if pl[1] != 999 else 0)
            if best is None or s > best[0]: best = (s, pl)
        m['plan'] = best[1]; m['t'] = 0; m['left'] = every - 1
        if best[1][0]: m['dir'] = best[1][0]
    d1, s_at, j_at = m['plan']; t = m['t']
    d = d1 if t < s_at else -d1
    return d < 0, d > 0, j_at is not None and j_at <= t < j_at + 16


if __name__ == '__main__' and len(sys.argv) > 1:
    for look in (60, 100, 140):
        f = lambda p, e, m, W, look=look: planner(p, e, m, W, look)
        print(f'planner look={look:3d} ph1 {run(f, False, 6000):5.2f}/1000t  ph2 {run(f, True, 6000):5.2f}/1000t', flush=True)
