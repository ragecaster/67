const run = require('./harness');
run(async (page) => {
  const r = await page.evaluate(() => Object.entries(ITEMS).filter(([id, it]) => it.damage && !it.pick && !it.axe && !it.hammer && !it.consumable).map(([id, it]) => `${id}: dmg ${it.damage} use ${it.use} anim ${it.useAnim || it.useTime} type ${it.dmgType} ${it.ammo ? 'ammo:' + it.ammo : ''} ${it.mana ? 'mana:' + it.mana : ''} rec:${RECIPES.some(r => r.out === id)}`));
  console.log(r.join('\n'));
});
