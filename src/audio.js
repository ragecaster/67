// ---------- sound effects (wiki wavs), synthesized meme sounds, music ----------
const SETTINGS = loadSettings();
function loadSettings() {
  const def = { music: 0.45, sfx: 0.7, tts: true, zoom: 0, smoothLight: true, showFps: false, autosave: true };
  try { return Object.assign(def, JSON.parse(localStorage.getItem('t67_settings') || '{}')); } catch (e) { return def; }
}
function saveSettings() { try { localStorage.setItem('t67_settings', JSON.stringify(SETTINGS)); } catch (e) { } }

const SFX_MAP = {
  dig: ['Dig_0', 'Dig_1', 'Dig_2'], tink: ['Tink_0', 'Tink_1', 'Tink_2'], swing: ['Item_1'], eat: ['Item_2'], potion: ['Item_3'],
  crystal: ['Item_4'], bow: ['Item_5'], mirror: ['Item_6'], magic: ['Item_8', 'Item_9'], throw: ['Item_1'], gun: ['Item_11'], minishark: ['Item_11'],
  explode: ['Item_14'], fire: ['Item_20'], grab: ['Grab'], coins: ['Coins'], player_hit: ['Player_Hit_0', 'Player_Hit_1', 'Player_Hit_2'],
  player_killed: ['Player_Killed'], npc_hit: ['NPC_Hit_1', 'NPC_Hit_2', 'NPC_Hit_3'], npc_killed: ['NPC_Killed_1', 'NPC_Killed_2', 'NPC_Killed_3'],
  roar: ['Roar_0'], roar2: ['Roar_1'], menu_open: ['Menu_Open'], menu_close: ['Menu_Close'], tick: ['Menu_Tick'],
  door_open: ['Door_Opened'], door_close: ['Door_Closed'], splash: ['Splash_0'], zombie: ['Zombie_0', 'Zombie_1', 'Zombie_2'],
  shatter: ['Shatter'], unlock: ['Unlock'], research: ['Research_0'], drip: ['Drip_0'], chat: ['Chat'], item7: ['Item_7'],
  place: ['Dig_0', 'Dig_1', 'Dig_2'], item37: ['Item_37'], item29: ['Item_29'], item13: ['Item_13'], item12: ['Item_12'], item16: ['Item_16'], item10: ['Item_10'],
};

const Audio67 = {
  ctx: null, buffers: {}, sfxGain: null, ready: false, music: {}, currentTrack: null, targetTrack: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = SETTINGS.sfx; this.sfxGain.connect(this.ctx.destination);
      const keys = Object.keys(ASSET_SRC).filter(k => k.startsWith('sfx/'));
      keys.forEach(async k => {
        const src = ASSET_SRC[k];
        let buf;
        if (typeof src === 'string') { // data URL from the local install
          const bin = atob(src.split(',')[1]); const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          buf = u8.buffer;
        } else buf = await src.arrayBuffer(); // Blob downloaded from the wiki
        this.ctx.decodeAudioData(buf).then(ab => { this.buffers[k.slice(4)] = ab; }).catch(() => { });
      });
      this.ready = true;
    } catch (e) { console.warn('audio unavailable', e); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  play(name, vol = 1, pitchVar = 0.1, rate = 1) {
    if (!this.ctx || SETTINGS.sfx <= 0) return;
    const list = SFX_MAP[name];
    if (!list) { if (Synth[name]) Synth[name](vol); return; }
    const buf = this.buffers[list[Math.floor(Math.random() * list.length)]];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * pitchVar);
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.sfxGain);
    src.start();
  },
  setSfxVolume(v) { SETTINGS.sfx = v; if (this.sfxGain) this.sfxGain.gain.value = v; },

  // ----- music: streamed <audio> elements with crossfade -----
  playMusic(track) {
    this.targetTrack = track;
    if (track && !this.music[track]) {
      const a = new Audio(MUSIC_SRC[track] || 'assets/music/Music-' + track + '.mp3');
      a.loop = true; a.volume = 0; a.preload = 'auto'; a.referrerPolicy = 'no-referrer';
      this.music[track] = a;
    }
  },
  updateMusic() {
    const vol = SETTINGS.music;
    for (const [name, a] of Object.entries(this.music)) {
      if (name === this.targetTrack) {
        if (a.paused && vol > 0) { const p = a.play(); if (p && p.catch) p.catch(() => { }); }
        a.volume = Math.min(vol, a.volume + 0.01);
      } else if (!a.paused) {
        a.volume = Math.max(0, a.volume - 0.02);
        if (a.volume <= 0.001) a.pause();
      }
    }
  },
};
function playSound(name, vol, pv) { Audio67.play(name, vol == null ? 1 : vol, pv == null ? 0.12 : pv); }
function playTileSound(t) { playSound(t.sound === 'tink' ? 'tink' : t.sound === 'shatter' ? 'shatter' : 'dig', 0.8); }

// procedurally synthesized meme sounds
const Synth = {
  vine_boom(vol = 1) {
    const c = Audio67.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g); g.connect(Audio67.sfxGain); o.start(t); o.stop(t + 1.3);
    // noise thump
    const n = c.createBufferSource(), nb = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    n.buffer = nb; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const ng = c.createGain(); ng.gain.value = 0.6 * vol; n.connect(f); f.connect(ng); ng.connect(Audio67.sfxGain); n.start(t);
  },
  lava_hiss(vol = 0.5) {
    const c = Audio67.ctx; if (!c) return;
    const n = c.createBufferSource(), nb = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = nb; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
    const g = c.createGain(); g.gain.value = 0.25 * vol; n.connect(f); f.connect(g); g.connect(Audio67.sfxGain); n.start();
  },
  // "tung tung tung" wood block knocks
  tung(vol = 1) {
    const c = Audio67.ctx; if (!c) return;
    for (let k = 0; k < 3; k++) {
      const t = c.currentTime + k * 0.18;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.08);
      g.gain.setValueAtTime(0.7 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(Audio67.sfxGain); o.start(t); o.stop(t + 0.15);
    }
  },
  // cheerful two-note "six seven" jingle
  six_seven(vol = 1) {
    const c = Audio67.ctx; if (!c) return;
    [[659, 0], [784, 0.16], [988, 0.32]].forEach(([f, dt]) => {
      const t = c.currentTime + dt, o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.12 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(Audio67.sfxGain); o.start(t); o.stop(t + 0.16);
    });
  },
  achievement(vol = 1) {
    const c = Audio67.ctx; if (!c) return;
    [523, 659, 784, 1047].forEach((f, k) => {
      const t = c.currentTime + k * 0.09, o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.18 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(Audio67.sfxGain); o.start(t); o.stop(t + 0.32);
    });
  },
  skibidi(vol = 1) {
    const c = Audio67.ctx; if (!c) return;
    // "dop dop dop yes yes" rhythm with a toilet-flush-ish noise
    [0, 0.12, 0.24, 0.5, 0.66].forEach((dt, k) => {
      const t = c.currentTime + dt, o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = k < 3 ? 180 : 240;
      g.gain.setValueAtTime(0.08 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g); g.connect(Audio67.sfxGain); o.start(t); o.stop(t + 0.11);
    });
  },
};

// text to speech for meme shouts (toggleable)
let lastSpeak = 0;
function speak(text, rate = 1.1, pitch = 1.2) {
  if (!SETTINGS.tts || !window.speechSynthesis) return;
  const now = performance.now();
  if (now - lastSpeak < 1500) return;
  lastSpeak = now;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.pitch = pitch; u.volume = Math.min(1, SETTINGS.sfx + 0.2);
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { }
}
