// ---------- keyboard + mouse ----------
const Input = {
  keys: {}, pressed: {}, released: {},
  mx: 0, my: 0, mDown: false, rDown: false, mClick: false, rClick: false, mRelease: false, wheel: 0,
  shift: false, ctrl: false, typing: null, // typing = {text, onDone, max}
  lastKeyTime: {},
  init(canvas) {
    window.addEventListener('keydown', e => {
      Audio67.init(); Audio67.resume();
      if (this.typing) { this.handleTyping(e); e.preventDefault(); return; }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.keys[k]) { this.pressed[k] = true; this.lastKeyTime[k] = performance.now(); }
      this.keys[k] = true;
      this.shift = e.shiftKey; this.ctrl = e.ctrlKey;
      if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key) || (e.ctrlKey && k === 's')) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys[k] = false; this.released[k] = true;
      this.shift = e.shiftKey; this.ctrl = e.ctrlKey;
    });
    window.addEventListener('blur', () => { this.keys = {}; this.mDown = false; this.rDown = false; });
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) * canvas.width / r.width;
      this.my = (e.clientY - r.top) * canvas.height / r.height;
    };
    canvas.addEventListener('mousemove', pos);
    canvas.addEventListener('mousedown', e => {
      Audio67.init(); Audio67.resume();
      pos(e);
      if (e.button === 0) { this.mDown = true; this.mClick = true; }
      if (e.button === 2) { this.rDown = true; this.rClick = true; }
      this.shift = e.shiftKey; this.ctrl = e.ctrlKey;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) { this.mDown = false; this.mRelease = true; }
      if (e.button === 2) this.rDown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    // touch fallback: tap = click
    canvas.addEventListener('touchstart', e => { const t = e.touches[0]; pos(t); this.mDown = true; this.mClick = true; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', e => { pos(e.touches[0]); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', e => { this.mDown = false; this.mRelease = true; });
  },
  handleTyping(e) {
    const t = this.typing;
    if (e.key === 'Enter') { const cb = t.onDone; this.typing = null; cb && cb(t.text); return; }
    if (e.key === 'Escape') { const cb = t.onCancel; this.typing = null; cb && cb(); return; }
    if (e.key === 'Backspace') { t.text = t.text.slice(0, -1); return; }
    if (e.key.length === 1 && t.text.length < (t.max || 24)) t.text += e.key;
  },
  // after the first update of a frame: stash click/wheel for the UI draw, clear everything for later sub-steps
  afterUpdate() {
    this.ui = { mClick: this.mClick, rClick: this.rClick, wheel: this.wheel, mRelease: this.mRelease };
    this.pressed = {}; this.mClick = false; this.rClick = false; this.wheel = 0; this.mRelease = false;
  },
  restoreForUI() { if (this.ui) Object.assign(this, this.ui); this.ui = null; },
  hideClicks() { const s = { mClick: this.mClick, rClick: this.rClick, wheel: this.wheel }; this.mClick = false; this.rClick = false; this.wheel = 0; return s; },
  unhideClicks(s) { this.mClick = this.mClick || s.mClick; this.rClick = this.rClick || s.rClick; this.wheel += s.wheel; },
  endFrame() {
    this.pressed = {}; this.released = {}; this.mClick = false; this.rClick = false; this.mRelease = false; this.wheel = 0;
  },
  down(k) { return !!this.keys[k]; },
  hit(k) { return !!this.pressed[k]; },
};
