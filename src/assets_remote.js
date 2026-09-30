// ---------- asset sources ----------
// Local install: tools/setup.py packs everything into src/assets_data.js (ASSET_DATA) + assets/music/.
// Hosted (e.g. GitHub Pages): nothing Terraria-owned is in the repo. On first visit the browser downloads the
// sprites/sounds straight from the Terraria Wiki (CORS-enabled) and caches them in IndexedDB; music streams from the wiki.
const ASSET_SRC = {};   // 'tiles/Dirt_Block_(placed)' -> image URL | sfx data (data URL or ArrayBuffer)
const MUSIC_SRC = {};   // 'Overworld_Day' -> URL
const WIKI_API = 'https://terraria.fandom.com/api.php';

const AssetCache = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('terrari67-assets', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => res();
      } catch (e) { res(); }
    });
  },
  get(key) {
    if (!this.db) return Promise.resolve(null);
    return new Promise(res => { const r = this.db.transaction('files').objectStore('files').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  },
  put(key, val) {
    if (!this.db) return Promise.resolve();
    return new Promise(res => { const tx = this.db.transaction('files', 'readwrite'); tx.objectStore('files').put(val, key); tx.oncomplete = res; tx.onerror = res; });
  },
};

// resolve wiki file names -> direct URLs (MediaWiki API, 45 titles per request)
async function resolveWikiUrls(names) {
  const out = {};
  for (let i = 0; i < names.length; i += 45) {
    const chunk = names.slice(i, i + 45);
    const q = new URLSearchParams({ action: 'query', titles: chunk.map(n => 'File:' + n).join('|'), prop: 'imageinfo', iiprop: 'url', format: 'json', origin: '*' });
    const d = await (await fetch(WIKI_API + '?' + q, { referrerPolicy: 'no-referrer' })).json();
    const norm = {};
    for (const n of d.query.normalized || []) norm[n.to] = n.from;
    for (const p of Object.values(d.query.pages)) {
      if (!p.imageinfo) continue;
      const orig = (norm[p.title] || p.title).slice(5).replace(/ /g, '_');
      out[orig] = p.imageinfo[0].url;
    }
  }
  return out;
}

async function prepareAssets(onProgress, onStatus) {
  if (typeof ASSET_DATA !== 'undefined') {
    for (const k in ASSET_DATA) ASSET_SRC[k] = ASSET_DATA[k];
    for (const n of ASSET_MANIFEST.music) MUSIC_SRC[n.replace(/^Music-|\.mp3$/g, '')] = 'assets/music/' + n;
    return;
  }
  await AssetCache.open();
  const wanted = [];
  for (const [folder, names] of Object.entries(ASSET_MANIFEST)) {
    if (folder === 'music') continue;
    for (const n of names) wanted.push({ key: folder + '/' + n.replace(/\.[^.]+$/, ''), name: n, sfx: folder === 'sfx' });
  }
  // what's cached already?
  const missing = [];
  let done = 0;
  for (const w of wanted) {
    const blob = await AssetCache.get(w.key);
    if (blob) { useAsset(w, blob); done++; } else missing.push(w);
  }
  onProgress && onProgress(done / wanted.length);
  // music urls (streamed, not cached as files)
  let musicUrls = await AssetCache.get('__music_urls');
  if (!musicUrls) {
    onStatus && onStatus('Finding music on the Terraria Wiki...');
    musicUrls = await resolveWikiUrls(ASSET_MANIFEST.music);
    await AssetCache.put('__music_urls', musicUrls);
  }
  for (const n of ASSET_MANIFEST.music) if (musicUrls[n]) MUSIC_SRC[n.replace(/^Music-|\.mp3$/g, '')] = musicUrls[n] + '&format=original';
  if (!missing.length) return;
  onStatus && onStatus('First launch: downloading Terraria sprites & sounds from the wiki (~5 MB, only once)...');
  const urls = await resolveWikiUrls(missing.map(w => w.name));
  let failed = 0;
  const queue = missing.slice();
  const worker = async () => {
    while (queue.length) {
      const w = queue.shift();
      const url = urls[w.name];
      try {
        if (!url) throw new Error('not on wiki');
        const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'format=original', { referrerPolicy: 'no-referrer' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        await AssetCache.put(w.key, blob);
        useAsset(w, blob);
      } catch (e) { failed++; console.warn('asset failed', w.name, e); }
      done++;
      onProgress && onProgress(done / wanted.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (failed > 20) throw new Error(failed + ' assets failed to download');
}
function useAsset(w, blob) {
  if (w.sfx) ASSET_SRC[w.key] = blob;          // decoded by the audio system
  else ASSET_SRC[w.key] = URL.createObjectURL(blob);
}
