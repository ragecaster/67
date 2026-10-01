// Freeze / thaw a bot situation so a failure found after a long run can be debugged repeatedly.
//   const { capture, restore } = require('./snaplib');  await capture(page, file);  await restore(page, file);
// World arrays are stored as base64; the bot's own memory (house, base, milestones, bad tiles, cooldowns) is stored too.
const fs = require('fs');
async function capture(page, file) {
  const data = await page.evaluate(() => {
    const b64 = (ta) => { let s = ''; const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return { type: ta.constructor.name, data: btoa(s) }; };
    const w = G.world, p = G.player, ser = Save.serializeWorld(w);
    const world = { meta: ser.meta, townNPCs: ser.townNPCs, chests: ser.chests };
    for (const k of ['tiles', 'walls', 'frames', 'liquid', 'ltype', 'explored', 'surface']) world[k] = ser[k] ? b64(ser[k]) : null;
    return {
      world, player: Save.serializePlayer(p), pos: { x: p.x, y: p.y }, tick: G.tick,
      bot: { houseSpot: Bot.houseSpot, base: Bot.base, milestones: Bot.milestones, houseFinished: Bot.houseFinished, badTiles: Bot.badTiles ? [...Bot.badTiles] : [], cooldowns: Bot.cooldowns || {}, fails: Bot.fails || {}, deaths: Bot.deaths },
    };
  });
  fs.writeFileSync(file, JSON.stringify(data));
  return data.tick;
}
async function restore(page, file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  await page.evaluate((data) => {
    const un = (o) => { if (!o) return o; const bin = atob(o.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new window[o.type](u8.buffer); };
    const d = { meta: data.world.meta, townNPCs: data.world.townNPCs, chests: data.world.chests, flipMap: {} };
    for (const k of ['tiles', 'walls', 'frames', 'liquid', 'ltype', 'explored', 'surface']) d[k] = un(data.world[k]);
    const w = Save.loadWorld(d), p = Save.loadPlayer(data.player);
    G.start(p, w);
    p.x = data.pos.x; p.y = data.pos.y; p.vx = p.vy = 0; G.snapCamera();
    Bot.houseSpot = data.bot.houseSpot; Bot.base = data.bot.base; Bot.milestones = data.bot.milestones; Bot.houseFinished = data.bot.houseFinished;
    Bot.badTiles = new Set(data.bot.badTiles); Bot.cooldowns = data.bot.cooldowns; Bot.fails = data.bot.fails; Bot.deaths = data.bot.deaths;
    Bot.start(1); Bot.verbose = false;
  }, data);
  return data.tick;
}
module.exports = { capture, restore };
