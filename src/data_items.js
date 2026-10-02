// ---------- item definitions ----------
// Item ids are strings; images come from the wiki ('items/…') or are generated in art.js ('gen/…').
const ITEMS = {};
const RARE_COLORS = ['#ffffff', '#9696ff', '#96ff96', '#ffc896', '#ff9696', '#ff96ff', '#d2a0ff', '#ffd700'];

// average damage one hit lands on a target with `def` defense (The 67: most hits are normal, some land as exactly 67)
function expectedHit(it, def = 0) {
  const normal = Math.max(1, (it.damage || 0) - def * 0.5);
  return it.sixSeven ? (1 - it.sixSeven) * normal + it.sixSeven * 67 : normal;
}
function defItem(id, o) {
  const it = Object.assign({
    id, name: id, img: 'items/' + id, stack: 1, value: 0, rare: 0, tooltip: '',
    use: null, useTime: 20, autoReuse: false, consumable: false,
  }, o);
  if (it.useAnim == null) it.useAnim = it.useTime;
  ITEMS[id] = it;
  return it;
}

// helpers for common shapes
function block(id, name, img, tile, extra = {}) { return defItem(id, Object.assign({ name, img, stack: 9999, use: 'place', place: tile, useTime: 15, autoReuse: true, consumable: true }, extra)); }
function wallItem(id, name, img, wall, extra = {}) { return defItem(id, Object.assign({ name, img, stack: 9999, use: 'placeWall', placeWall: wall, useTime: 7, autoReuse: true, consumable: true }, extra)); }
function furniture(id, name, img, tile, extra = {}) { return defItem(id, Object.assign({ name, img, stack: 99, use: 'place', place: tile, useTime: 15, autoReuse: true, consumable: true }, extra)); }
function material(id, name, img, extra = {}) { return defItem(id, Object.assign({ name, img, stack: 9999, material: true }, extra)); }

// ===== blocks =====
block('dirt_block', 'Dirt Block', 'items/Dirt_Block', T.DIRT, { tooltip: 'Touch grass? Nah, touch dirt.' });
block('stone_block', 'Stone Block', 'items/Stone_Block', T.STONE, { tooltip: 'Stone cold sigma.' });
block('sand_block', 'Sand Block', 'items/Sand_Block', T.SAND, { tooltip: 'Falls off harder than your favourite streamer.' });
block('wood', 'Wood', 'items/Wood', T.WOOD, { tooltip: 'Wood. It is giving... tree.' });
block('glass', 'Glass', 'items/Glass', T.GLASS);
block('clay_block', 'Clay Block', 'items/Clay_Block', T.CLAY);
block('mud_block', 'Mud Block', 'items/Mud_Block', T.MUD);
block('snow_block', 'Snow Block', 'items/Snow_Block', T.SNOW);
block('ice_block', 'Ice Block', 'items/Ice_Block', T.ICE, { tooltip: 'Ice cold. Literally.' });
block('ash_block', 'Ash Block', 'items/Ash_Block', T.ASH, { tooltip: 'Only found in Ohio.' });
block('ebonstone_block', 'Brainrot Stone', 'items/Ebonstone_Block', T.EBONSTONE, { tooltip: 'Smells like 8 hours of scrolling.' });
block('gray_brick', 'Gray Brick', 'items/Gray_Brick', T.GRAY_BRICK);
block('red_brick', 'Red Brick', 'items/Red_Brick', T.RED_BRICK);
block('hellstone_brick', 'Ohio Brick', 'items/Hellstone_Brick', T.HELLSTONE_BRICK);
block('gold_brick', 'Rizzium Brick', 'items/Gold_Brick', T.GOLD_BRICK, { tooltip: 'Build a house with W rizz.' });
block('sandstone_block', 'Sandstone Block', 'items/Sandstone_Block', T.SANDSTONE);
block('obsidian', 'Obsidian', 'items/Obsidian', T.OBSIDIAN, { tooltip: 'Water + lava = lore.' });
block('meme67_block', '67 Block', 'gen/item_meme67', T.MEME67, { rare: 3, tooltip: 'Six. Seven. 🤲\nGlows with pure unfiltered brainrot.' });
block('copper_ore', 'Copium Ore', 'items/Copper_Ore', T.COPPER, { tooltip: 'Maybe the real ore was the friends we made.' });
block('iron_ore', 'Ironic Ore', 'items/Iron_Ore', T.IRON, { tooltip: "Isn't it ironic." });
block('silver_ore', 'Sigma Ore', 'items/Silver_Ore', T.SILVER, { tooltip: 'Grindset material.' });
block('gold_ore', 'Rizzium Ore', 'items/Gold_Ore', T.GOLD, { tooltip: 'Unspoken rizz, in ore form.' });
block('demonite_ore', 'Brainrot Ore', 'items/Demonite_Ore', T.DEMONITE, { rare: 1, tooltip: 'Pulsates with skibidi energy.' });
block('hellstone', 'Ohiostone', 'items/Hellstone', T.HELLSTONE, { rare: 2, tooltip: 'Hot to the touch. Only in Ohio.' });

block('wallpaper_block', 'Yellow Wallpaper', 'gen/item_wallpaper', T.WALLPAPER, { tooltip: 'Mono-yellow. Smells like old moist carpet.\nThe hum is getting louder.' });
block('carpet_block', 'Moist Carpet', 'gen/item_carpet', T.CARPET, { tooltip: 'Why is it wet. Why is it always wet.' });

// ===== walls =====
wallItem('dirt_wall', 'Dirt Wall', 'items/Dirt_Wall', W.DIRT_P);
wallItem('stone_wall', 'Stone Wall', 'items/Stone_Wall', W.STONE_P);
wallItem('wood_wall', 'Wood Wall', 'items/Wood_Wall', W.WOOD);
wallItem('gray_brick_wall', 'Gray Brick Wall', 'items/Gray_Brick_Wall', W.GRAY_BRICK);
wallItem('hellstone_brick_wall', 'Ohio Brick Wall', 'items/Hellstone_Brick_Wall', W.HELLSTONE_BRICK);
wallItem('wallpaper_wall', 'Wallpaper Wall', 'gen/item_wallpaper_wall', W.WALLPAPER_P, { tooltip: 'Now your house can feel like Level 0.' });

// ===== furniture =====
furniture('wood_platform', 'Wood Platform', 'items/Wood_Platform', T.PLATFORM, { stack: 9999 });
furniture('torch', 'Torch', 'items/Torch', T.TORCH, { stack: 9999, holdLight: [1, 0.85, 0.55], tooltip: 'Lights up the vibes.' });
furniture('work_bench', 'Work Bench', 'items/Work_Bench', T.WORKBENCH, { tooltip: 'Used for basic crafting. Grindset starts here.' });
furniture('furnace', 'Furnace', 'items/Furnace', T.FURNACE, { tooltip: 'Used for smelting ore.' });
furniture('iron_anvil', 'Ironic Anvil', 'items/Iron_Anvil', T.ANVIL, { tooltip: 'Used to craft items from metal bars.' });
furniture('hellforge', 'Ohioforge', 'items/Hellforge', T.HELLFORGE, { rare: 2, tooltip: 'Used to smelt Ohiostone. Also a furnace.' });
furniture('chest', 'Chest', 'items/Chest', T.CHEST, { tooltip: 'Stores items. Fanum-proof (mostly).' });
furniture('wooden_door', 'Wooden Door', 'items/Wooden_Door', T.DOOR_CLOSED, { tooltip: 'Right-click to open. Zombies hate this one trick.' });
furniture('wooden_table', 'Wooden Table', 'items/Wooden_Table', T.TABLE);
furniture('wooden_chair', 'Wooden Chair', 'items/Wooden_Chair', T.CHAIR);
furniture('toilet', 'Skibidi Toilet', 'items/Toilet', T.TOILET, { tooltip: 'Counts as a chair.\nSkibidi dop dop dop yes yes.' });
furniture('bed', 'Bed', 'items/Bed', T.BED, { tooltip: 'Right-click to set your spawn point. Sleep is for the weak (and the well-rested).' });
furniture('candle', 'Candle', 'items/Candle', T.CANDLE);
furniture('sawmill', 'Sawmill', 'items/Sawmill', T.SAWMILL, { tooltip: 'Used for advanced wood crafting.' });
furniture('loom', 'Loom', 'items/Loom', T.LOOM, { tooltip: 'Used for crafting cloth.' });
furniture('bottle', 'Bottle', 'items/Bottle', T.BOTTLE, { tooltip: 'Place it to make potions. Also holds liquid.' });
furniture('piggy_bank', 'Fanum Tax Bank', 'items/Piggy_Bank', T.PIGGY_BANK, { value: 10000, tooltip: 'Right-click to store items.\nFanum cannot tax what he cannot find.' });
furniture('sunflower', 'Sunflower', 'items/Sunflower', T.SUNFLOWER, { tooltip: 'Keeps the vibes immaculate nearby.' });
furniture('fluorescent_light', 'Fluorescent Light', 'gen/item_fluorescent', T.FLUORESCENT, { tooltip: 'Buzzes at exactly 60 hertz. Place it on a ceiling.\nCounts as a light source.' });
furniture('tombstone', 'Tombstone', 'items/Tombstone', T.TOMBSTONE, { tooltip: 'Here lies someone who got cooked.' });

// ===== materials =====
material('gel', 'Gel', 'items/Gel', { value: 1, tooltip: "Skibidi juice. 'Both tasty and flammable.'" });
material('lens', 'Side-Eye Lens', 'items/Lens', { value: 100, tooltip: 'It is still judging you.' });
material('fallen_star', 'Fallen Star', 'items/Fallen_Star', { value: 500, rare: 1, tooltip: 'Disappears after sunrise. Main character energy.' });
material('silk', 'Silk', 'items/Silk', { value: 100 });
material('cobweb', 'Cobweb', 'items/Cobweb', { use: 'place', place: T.COBWEB, useTime: 15, autoReuse: true, consumable: true });
material('rotten_chunk', 'Doomscroll Chunk', 'items/Rotten_Chunk', { value: 10, tooltip: 'You ate 6 hours of short-form content to get this.' });
material('bone', 'Bone', 'items/Bone', { value: 50, tooltip: 'Jawline sold separately.' });
material('iron_chain', 'Iron Chain', 'items/Iron_Chain', { value: 100 });
material('hook', 'Hook', 'items/Hook', { value: 500, tooltip: 'Sometimes dropped by Mewing Skeletons.' });
material('cactus', 'Cactus', 'items/Cactus', { value: 5 });
material('daybloom', 'Daybloom', 'items/Daybloom', { value: 20, tooltip: 'Touch grass (the flower version).' });
material('blinkroot', 'Blinkroot', 'items/Blinkroot', { value: 20 });
material('acorn', 'Acorn', 'items/Acorn', { use: 'place', place: T.TREE, useTime: 15, consumable: true, tooltip: 'Plant it. Grow it. Chop it. The cycle.' });
material('copper_bar', 'Copium Bar', 'items/Copper_Bar', { value: 150 });
material('iron_bar', 'Ironic Bar', 'items/Iron_Bar', { value: 300 });
material('silver_bar', 'Sigma Bar', 'items/Silver_Bar', { value: 600 });
material('gold_bar', 'Rizzium Bar', 'items/Gold_Bar', { value: 1200 });
material('demonite_bar', 'Brainrot Bar', 'items/Demonite_Bar', { value: 3000, rare: 1 });
material('hellstone_bar', 'Ohio Bar', 'items/Hellstone_Bar', { value: 4000, rare: 3, tooltip: 'Hot to the touch. Only in Ohio.' });
material('copper_coin', 'Copper Aura', 'items/Copper_Coin', { stack: 100, coin: 1, tooltip: '+1 aura' });
material('silver_coin', 'Silver Aura', 'items/Silver_Coin', { stack: 100, coin: 100, tooltip: '+100 aura' });
material('gold_coin', 'Gold Aura', 'items/Gold_Coin', { stack: 100, coin: 10000, tooltip: '+10,000 aura. Aura farming paid off.' });
material('platinum_coin', 'Platinum Aura', 'items/Platinum_Coin', { stack: 9999, coin: 1000000, tooltip: 'Infinite aura. You are him.' });

// ===== consumables =====
defItem('mushroom', { name: 'Mushroom', img: 'items/Mushroom', stack: 99, use: 'consume', useTime: 17, consumable: true, heal: 15, potion: true, value: 25, tooltip: 'Heals 15 life. Kinda mid.' });
defItem('lesser_healing_potion', { name: 'Lesser Copium Potion', img: 'items/Lesser_Healing_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, heal: 50, potion: true, value: 300, tooltip: 'Restores 50 life.\nCope, seethe, heal.' });
defItem('healing_potion', { name: 'Copium Potion', img: 'items/Healing_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, heal: 100, potion: true, value: 1000, rare: 1, tooltip: 'Restores 100 life.\nMaximum copium.' });
defItem('lesser_mana_potion', { name: 'Lesser Mewing Potion', img: 'items/Lesser_Mana_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, healMana: 100, value: 250, tooltip: 'Restores 100 mana.\nTongue on the roof of your mouth.' });
defItem('swiftness_potion', { name: 'Zoomies Potion', img: 'items/Swiftness_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['swiftness', 240], value: 200, rare: 1, tooltip: '25% increased movement speed.' });
defItem('ironskin_potion', { name: 'Sigma Skin Potion', img: 'items/Ironskin_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['ironskin', 300], value: 200, rare: 1, tooltip: 'Increases defense by 8.' });
defItem('regeneration_potion', { name: 'Mewing Potion', img: 'items/Regeneration_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['regeneration', 300], value: 200, rare: 1, tooltip: 'Provides life regeneration. Jawline +1.' });
defItem('obsidian_skin_potion', { name: 'Ohio Skin Potion', img: 'items/Obsidian_Skin_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['obsidian_skin', 240], value: 200, rare: 1, tooltip: 'Provides immunity to lava.\nSurvive Ohio.' });
defItem('battle_potion', { name: 'Rage Bait Potion', img: 'items/Battle_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['battle', 420], value: 200, rare: 1, tooltip: 'Increases enemy spawn rate.\nOxford word of the year, in a bottle.' });
defItem('spelunker_potion', { name: 'Sus Detector Potion', img: 'items/Spelunker_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['spelunker', 300], value: 200, rare: 1, tooltip: 'Highlights nearby treasure and ore. Kinda sus.' });
defItem('night_owl_potion', { name: 'No Sleep Gang Potion', img: 'items/Night_Owl_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['night_owl', 240], value: 200, rare: 1, tooltip: 'Increases night vision. 3am doomscroll mode.' });
defItem('recall_potion', { name: 'Go Home Bro Potion', img: 'items/Recall_Potion', stack: 30, use: 'consume', useTime: 17, consumable: true, recall: true, value: 200, rare: 1, tooltip: 'Teleports you home.' });
defItem('bowl_of_soup', { name: 'Bussin Soup', img: 'items/Bowl_of_Soup', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['well_fed', 600], value: 200, tooltip: 'Minor improvements to all stats.\nThis soup is bussin fr fr.' });
defItem('cooked_fish', { name: 'Tralalero Sashimi', img: 'items/Cooked_Fish', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['well_fed', 900], value: 300, tooltip: 'Minor improvements to all stats.\nTralalero tralala... was delicious.' });
defItem('dubai_chocolate', { name: 'Dubai Chocolate', img: 'gen/item_dubai', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['well_fed', 1200], heal: 20, value: 2500, rare: 2, tooltip: 'Minor improvements to all stats.\nPistachio kunafa crunch. Viral for a reason.' });
defItem('sahur_snack', { name: 'Sahur Snack', img: 'gen/item_sahur', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['well_fed', 1800], heal: 40, value: 1000, rare: 2, tooltip: 'Minor improvements to all stats.\nEat before dawn or Tung Tung Tung comes knocking.' });
defItem('cappuccino', { name: 'Ballerina Cappuccino', img: 'gen/item_cappuccino', stack: 30, use: 'consume', useTime: 17, consumable: true, buff: ['swiftness', 300], heal: 30, value: 400, rare: 1, tooltip: '25% increased movement speed.\nMi mi mi, mi mi mi!' });
defItem('almond_water', { name: 'Almond Water', img: 'gen/item_almond', stack: 30, use: 'consume', useTime: 17, consumable: true, heal: 67, healMana: 67, cureDebuffs: true, potion: true, value: 6700, rare: 3, tooltip: 'Restores 67 life and 67 mana. Cures debuffs.\nThe only safe drink in the Backrooms. Tastes like hope.' });
defItem('life_crystal', { name: 'Aura Crystal', img: 'items/Life_Crystal', stack: 99, use: 'consume', useTime: 30, consumable: true, lifeCrystal: true, value: 7500, rare: 2, tooltip: 'Permanently increases maximum life by 20.\n+1000 aura.' });
defItem('mana_crystal', { name: 'Mewing Crystal', img: 'items/Mana_Crystal', stack: 99, use: 'consume', useTime: 30, consumable: true, manaCrystal: true, value: 2500, rare: 2, tooltip: 'Permanently increases maximum mana by 20.' });

// ===== summons =====
defItem('slime_crown', { name: 'Skibidi Crown', img: 'items/Slime_Crown', stack: 20, use: 'consume', useTime: 45, consumable: true, summon: 'king_slime', value: 5000, rare: 1, tooltip: 'Summons King Skibidi.\nSkibidi dop dop dop yes yes.' });
defItem('suspicious_looking_eye', { name: 'Suspicious Side-Eye', img: 'items/Suspicious_Looking_Eye', stack: 20, use: 'consume', useTime: 45, consumable: true, summon: 'eye_of_cthulhu', value: 5000, rare: 1, tooltip: 'Summons the Eye of Ohio. Use at night.\n"Bro is looking at you funny."' });
defItem('kentongan', { name: 'Sahur Kentongan', img: 'gen/item_kentongan', stack: 20, use: 'consume', useTime: 45, consumable: true, summon: 'tung_sahur', value: 6700, rare: 2, tooltip: 'Summons Tung Tung Tung Sahur. Use at night.\nTung. Tung. Tung. Tung. Tung. Tung. Tung. Tung. Tung. SAHUR.' });
defItem('guide_voodoo_doll', { name: 'Rizzler Voodoo Doll', img: 'items/Guide_Voodoo_Doll', stack: 1, value: 3000, rare: 2, voodoo: true, tooltip: "You feel like you shouldn't throw this into lava.\n(You should absolutely throw this into lava.)" });

// ===== tools =====
function tool(id, name, img, o) { return defItem(id, Object.assign({ name, img, use: 'swing', autoReuse: true, dmgType: 'melee', kb: 3 }, o)); }
const TIERS = [
  // key, meme name, pick, useTime, sword dmg, bow dmg, armor [h,b,l], set bonus def, value
  ['copper', 'Copium', 35, 15, 8, 6, [1, 2, 1], 2, 50],
  ['iron', 'Ironic', 40, 13, 10, 8, [2, 3, 2], 2, 100],
  ['silver', 'Sigma', 45, 12, 11, 9, [3, 4, 3], 3, 200],
  ['gold', 'Rizzium', 55, 11, 13, 11, [4, 5, 4], 3, 400],
];
const TIER_LORE = {
  copper: 'Coping, but make it metal.',
  iron: 'Ironically decent.',
  silver: 'Sigma grindset certified.',
  gold: 'W rizz. Ungodly drip.',
};
for (const [k, nm, pick, ut, sdmg, bdmg, arm, setDef, val] of TIERS) {
  const Nm = k.charAt(0).toUpperCase() + k.slice(1);
  tool(k + '_pickaxe', nm + ' Pickaxe', 'items/' + Nm + '_Pickaxe', { pick, useTime: ut, useAnim: ut + 6, damage: Math.round(sdmg * 0.55), value: val * 20, tooltip: TIER_LORE[k] });
  tool(k + '_axe', nm + ' Axe', 'items/' + Nm + '_Axe', { axe: pick, useTime: ut + 5, useAnim: ut + 11, damage: Math.round(sdmg * 0.5), value: val * 16, tooltip: TIER_LORE[k] });
  if (k !== 'gold' && k !== 'silver') tool(k + '_hammer', nm + ' Hammer', 'items/' + Nm + '_Hammer', { hammer: pick, useTime: ut + 8, useAnim: ut + 16, damage: Math.round(sdmg * 0.8), value: val * 16 });
  defItem(k + '_broadsword', { name: nm + ' Broadsword', img: 'items/' + Nm + '_Broadsword', use: 'swing', useTime: 21 - Math.round(val / 400), damage: sdmg, kb: 5, dmgType: 'melee', value: val * 18, tooltip: TIER_LORE[k] });
  defItem(k + '_bow', { name: nm + ' Bow', img: 'items/' + Nm + '_Bow', use: 'shoot', useTime: 29 - Math.round(val / 200), damage: bdmg, kb: 0, dmgType: 'ranged', ammo: 'arrow', shootSpeed: 6.6 + val / 200, value: val * 14 });
  defItem(k + '_helmet', { name: nm + ' Helmet', img: 'items/' + Nm + '_Helmet', armor: 'head', defense: arm[0], set: k, value: val * 25, tooltip: 'Set bonus: +' + setDef + ' defense' });
  defItem(k + '_chainmail', { name: nm + ' Chainmail', img: 'items/' + Nm + '_Chainmail', armor: 'body', defense: arm[1], set: k, value: val * 20 });
  defItem(k + '_greaves', { name: nm + ' Greaves', img: 'items/' + Nm + '_Greaves', armor: 'legs', defense: arm[2], set: k, value: val * 15 });
}
const SET_BONUS = {
  wood: { def: 1, text: '+1 defense. NPC starter pack.' },
  copper: { def: 2, text: '+2 defense' }, iron: { def: 2, text: '+2 defense' },
  silver: { def: 3, text: '+3 defense. Sigma grindset.' }, gold: { def: 3, text: '+3 defense. Rizz aura active.' },
  shadow: { moveSpeed: 0.15, text: '15% increased movement speed. Brainrot drip.' },
  molten: { meleeDmg: 0.17, fireImmune: true, text: '17% extra melee damage. Immune to Ohio heat.' },
};
defItem('copper_shortsword', { name: 'Copium Shortsword', img: 'items/Copper_Shortsword', use: 'thrust', useTime: 13, damage: 5, kb: 4, dmgType: 'melee', autoReuse: true, value: 70, tooltip: 'Starter weapon. Everyone starts somewhere.' });
tool('wooden_hammer', 'Wooden Hammer', 'items/Wooden_Hammer', { hammer: 25, useTime: 23, useAnim: 33, damage: 2, value: 10 });
defItem('wooden_sword', { name: 'Wooden Sword', img: 'items/Wooden_Sword', use: 'swing', useTime: 25, damage: 7, kb: 5, dmgType: 'melee', value: 20, tooltip: 'NPC weapon.' });
defItem('wooden_bow', { name: 'Wooden Bow', img: 'items/Wooden_Bow', use: 'shoot', useTime: 27, damage: 4, dmgType: 'ranged', ammo: 'arrow', shootSpeed: 6.1, value: 20 });
defItem('wood_helmet', { name: 'Wood Helmet', img: 'items/Wood_Helmet', armor: 'head', defense: 1, set: 'wood', value: 50 });
defItem('wood_breastplate', { name: 'Wood Breastplate', img: 'items/Wood_Breastplate', armor: 'body', defense: 1, set: 'wood', value: 50 });
defItem('wood_greaves', { name: 'Wood Greaves', img: 'items/Wood_Greaves', armor: 'legs', defense: 0, set: 'wood', value: 50 });

// brainrot (demonite) tier
tool('nightmare_pickaxe', 'Brainrot Pickaxe', 'items/Nightmare_Pickaxe', { pick: 65, useTime: 15, useAnim: 20, damage: 9, rare: 1, value: 18000, tooltip: 'Able to mine Ohiostone.' });
tool('war_axe_of_the_night', 'Doomscroll Axe', 'items/War_Axe_of_the_Night', { axe: 75, useTime: 21, useAnim: 30, damage: 20, rare: 1, value: 13500 });
defItem('lights_bane', { name: 'Doomscroller', img: "items/Light's_Bane", use: 'swing', useTime: 20, damage: 17, kb: 5, dmgType: 'melee', rare: 1, value: 13500, tooltip: 'Scrolls enemies into oblivion.' });
defItem('demon_bow', { name: 'Brainrot Bow', img: 'items/Demon_Bow', use: 'shoot', useTime: 23, damage: 14, dmgType: 'ranged', ammo: 'arrow', shootSpeed: 6.7, rare: 1, value: 13500 });
defItem('shadow_helmet', { name: 'Brainrot Helmet', img: 'items/Shadow_Helmet', armor: 'head', defense: 6, set: 'shadow', rare: 1, value: 37500, tooltip: '7% increased critical strike chance', crit: 7 });
defItem('shadow_scalemail', { name: 'Brainrot Scalemail', img: 'items/Shadow_Scalemail', armor: 'body', defense: 7, set: 'shadow', rare: 1, value: 30000, tooltip: '7% increased critical strike chance', crit: 7 });
defItem('shadow_greaves', { name: 'Brainrot Greaves', img: 'items/Shadow_Greaves', armor: 'legs', defense: 6, set: 'shadow', rare: 1, value: 22500, tooltip: '7% increased critical strike chance', crit: 7 });

// ohio (hellstone/molten) tier
tool('molten_pickaxe', 'Ohio Pickaxe', 'items/Molten_Pickaxe', { pick: 100, useTime: 18, useAnim: 25, damage: 12, rare: 3, value: 27000, tooltip: 'Mines anything this side of hardmode.' });
tool('molten_hamaxe', 'Ohio Hamaxe', 'items/Molten_Hamaxe', { axe: 150, hammer: 70, useTime: 27, useAnim: 29, damage: 20, rare: 3, value: 27000 });
defItem('fiery_greatsword', { name: 'Crashout Greatsword', img: 'items/Fiery_Greatsword', use: 'swing', useTime: 34, damage: 36, kb: 6.5, dmgType: 'melee', onHit: 'fire', rare: 3, value: 27000, scale: 1.3, tooltip: 'It is literally on fire. It crashed out.' });
defItem('molten_fury', { name: 'Ohio Fury', img: 'items/Molten_Fury', use: 'shoot', useTime: 21, damage: 29, dmgType: 'ranged', ammo: 'arrow', shootSpeed: 8, arrowFire: true, rare: 3, value: 27000, tooltip: 'Lights wooden arrows ablaze.' });
defItem('molten_helmet', { name: 'Ohio Helmet', img: 'items/Molten_Helmet', armor: 'head', defense: 8, set: 'molten', rare: 3, value: 45000, tooltip: '7% increased melee damage', meleeDmg: 0.07 });
defItem('molten_breastplate', { name: 'Ohio Breastplate', img: 'items/Molten_Breastplate', armor: 'body', defense: 9, set: 'molten', rare: 3, value: 30000, tooltip: '7% increased melee damage', meleeDmg: 0.07 });
defItem('molten_greaves', { name: 'Ohio Greaves', img: 'items/Molten_Greaves', armor: 'legs', defense: 8, set: 'molten', rare: 3, value: 30000, tooltip: '7% increased melee damage', meleeDmg: 0.07 });
defItem('nights_edge', { name: "Sigma's Edge", img: "items/Night's_Edge", use: 'swing', useTime: 21, damage: 42, kb: 4.5, dmgType: 'melee', rare: 3, value: 54000, scale: 1.15, tooltip: 'The final form of the grindset.' });

// meme weapons
defItem('the_67', { name: 'The Six Seven', img: 'gen/item_67', use: 'swing', useTime: 20, damage: 20, sixSeven: 0.2, kb: 6.7, dmgType: 'melee', shoot: 'sixseven', shootSpeed: 9, rare: 7, value: 67670, scale: 1.1, tooltip: '20% of hits deal exactly 67 damage.\nFires alternating 6s and 7s. 🤲\n"SIX SEVEEEN"' });
defItem('tung_bat', { name: 'Tung Bat', img: 'gen/item_tung_bat', use: 'swing', useTime: 26, damage: 30, kb: 11, dmgType: 'melee', rare: 3, value: 40000, scale: 1.2, onHit: 'tung', tooltip: 'Massive knockback.\nTung tung tung tung tung tung tung tung tung.' });
defItem('skibidi_plunger', { name: 'Skibidi Plunger', img: 'gen/item_plunger', use: 'throw', useTime: 20, damage: 13, kb: 6, dmgType: 'thrown', shoot: 'plunger', shootSpeed: 11, rare: 1, value: 5000, autoReuse: true, tooltip: 'Throws a returning plunger.\nDop dop dop yes yes.' });

defItem('liminal_blade', { name: 'Liminal Blade', img: 'gen/item_liminal', use: 'swing', useTime: 19, damage: 27, kb: 5, dmgType: 'melee', rare: 3, value: 45000, scale: 1.15, onHit: 'liminal', tooltip: 'Found somewhere between rooms.\nHits have a chance to make enemies noclip away (they get teleported).' });

// ranged & misc weapons
defItem('wooden_arrow', { name: 'Wooden Arrow', img: 'items/Wooden_Arrow', stack: 9999, ammoType: 'arrow', damage: 5, proj: 'arrow', consumable: true, value: 5 });
defItem('flaming_arrow', { name: 'Flaming Arrow', img: 'items/Flaming_Arrow', stack: 9999, ammoType: 'arrow', damage: 7, proj: 'flaming_arrow', consumable: true, value: 10 });
defItem('unholy_arrow', { name: 'Brainrot Arrow', img: 'items/Unholy_Arrow', stack: 9999, ammoType: 'arrow', damage: 10, proj: 'unholy_arrow', consumable: true, value: 40, rare: 1, tooltip: 'Pierces through enemies.' });
defItem('hellfire_arrow', { name: 'Ohio Arrow', img: 'items/Hellfire_Arrow', stack: 9999, ammoType: 'arrow', damage: 13, proj: 'hellfire_arrow', consumable: true, value: 50, rare: 2, tooltip: 'Explodes on impact.' });
defItem('musket_ball', { name: 'Musket Ball', img: 'items/Musket_Ball', stack: 9999, ammoType: 'bullet', damage: 7, proj: 'bullet', consumable: true, value: 7 });
defItem('flintlock_pistol', { name: 'Flintlock (Fanum Edition)', img: 'items/Flintlock_Pistol', use: 'shoot', useTime: 13, damage: 10, dmgType: 'ranged', ammo: 'bullet', shootSpeed: 10, value: 35000, rare: 1, tooltip: 'Taxes enemies at 10 damage per shot.' });
defItem('minishark', { name: 'Minishark (Tralalero Jr.)', img: 'items/Minishark', use: 'shoot', useTime: 8, damage: 6, dmgType: 'ranged', ammo: 'bullet', shootSpeed: 7, autoReuse: true, value: 350000, rare: 2, ammoSave: 0.33, tooltip: '33% chance to not consume ammo.\nHalf shark, half gun, all Tralalero.' });
defItem('enchanted_boomerang', { name: 'Fidget Spinner', img: 'items/Enchanted_Boomerang', use: 'throw', useTime: 15, damage: 13, kb: 8, dmgType: 'melee', shoot: 'boomerang', shootSpeed: 11, value: 10000, rare: 1, tooltip: 'It spins. It returns. It is 2017 again.' });
defItem('wooden_boomerang', { name: 'Wooden Fidget Spinner', img: 'items/Wooden_Boomerang', use: 'throw', useTime: 15, damage: 8, kb: 8, dmgType: 'melee', shoot: 'wooden_boomerang', shootSpeed: 6.5, value: 5000 });
defItem('ball_o_hurt', { name: "Ball O' Brainrot", img: "items/Ball_O'_Hurt", use: 'throw', useTime: 45, damage: 15, kb: 6.5, dmgType: 'melee', shoot: 'flail', shootSpeed: 12, value: 27000, rare: 1, tooltip: 'Brainrot, on a chain.' });
defItem('spear', { name: 'Spear', img: 'items/Spear', use: 'thrust', useTime: 31, damage: 8, kb: 6.5, dmgType: 'melee', reach: 60, value: 1000 });
defItem('shuriken', { name: 'Shuriken', img: 'items/Shuriken', stack: 9999, use: 'throw', useTime: 15, damage: 10, dmgType: 'thrown', shoot: 'shuriken', shootSpeed: 9, consumable: true, autoReuse: true, value: 15 });
defItem('throwing_knife', { name: 'Throwing Knife', img: 'items/Throwing_Knife', stack: 9999, use: 'throw', useTime: 15, damage: 12, dmgType: 'thrown', shoot: 'throwing_knife', shootSpeed: 10, consumable: true, autoReuse: true, value: 15 });
defItem('bomb', { name: 'Bombardiro Bomb', img: 'items/Bomb', stack: 9999, use: 'throw', useTime: 25, damage: 0, dmgType: 'thrown', shoot: 'bomb', shootSpeed: 5, consumable: true, value: 300, tooltip: 'A small explosion that will destroy some tiles.\nBombardiro Crocodilo approved.' });
defItem('grenade', { name: 'Grenade (No Cap)', img: 'items/Grenade', stack: 9999, use: 'throw', useTime: 40, damage: 60, dmgType: 'thrown', shoot: 'grenade', shootSpeed: 6.5, consumable: true, value: 75, tooltip: 'A small explosion that will not destroy tiles.' });
defItem('dynamite', { name: 'Crocodilo Dynamite', img: 'items/Dynamite', stack: 9999, use: 'throw', useTime: 40, damage: 0, dmgType: 'thrown', shoot: 'dynamite', shootSpeed: 4, consumable: true, value: 2000, rare: 1, tooltip: 'A large explosion that will destroy most tiles.' });
defItem('starfury', { name: 'Main Character Sword', img: 'items/Starfury', use: 'swing', useTime: 20, damage: 22, kb: 5, dmgType: 'melee', shoot: 'starfury_star', rare: 2, value: 20000, tooltip: 'Causes stars to rain from the sky.\nForged with the fury of the main character.' });

// magic
defItem('wand_of_sparking', { name: 'Wand of Rizz', img: 'items/Wand_of_Sparking', use: 'shoot', useTime: 18, damage: 8, dmgType: 'magic', mana: 2, shoot: 'spark', shootSpeed: 6.5, value: 10000, tooltip: 'Shoots a small spark of pure rizz.' });
defItem('vilethorn', { name: 'Brainrot Thorn', img: 'items/Vilethorn', use: 'shoot', useTime: 28, damage: 10, dmgType: 'magic', mana: 10, shoot: 'vilethorn', shootSpeed: 30, value: 10000, rare: 1, tooltip: 'Summons a vile thorn of pure doomscroll.' });
defItem('water_bolt', { name: 'Skibidi Water Bolt', img: 'items/Water_Bolt', use: 'shoot', useTime: 17, damage: 19, dmgType: 'magic', mana: 10, shoot: 'water_bolt', shootSpeed: 4.5, value: 10000, rare: 2, tooltip: 'Casts a slow moving bolt of toilet water.' });
defItem('magic_missile', { name: 'Homing Glaze', img: 'items/Magic_Missile', use: 'shoot', useTime: 22, damage: 22, dmgType: 'magic', mana: 10, shoot: 'magic_missile', shootSpeed: 6, value: 10000, rare: 2, tooltip: 'Casts a missile that glazes enemies.' });
defItem('flamelash', { name: 'Ohio Flamelash', img: 'items/Flamelash', use: 'shoot', useTime: 20, damage: 32, dmgType: 'magic', mana: 12, shoot: 'flamelash', shootSpeed: 6, value: 50000, rare: 3, tooltip: 'Summons a ball of fire that seeks the enemy.' });
defItem('demon_scythe', { name: "Demon Scythe (It's Giving)", img: 'items/Demon_Scythe', use: 'shoot', useTime: 20, damage: 30, dmgType: 'magic', mana: 14, shoot: 'demon_scythe', shootSpeed: 0.2, value: 27000, rare: 3, tooltip: 'Casts a demon scythe.' });

// accessories
function acc(id, name, img, fx, o = {}) { return defItem(id, Object.assign({ name, img, acc: true, fx, rare: 1, value: 10000 }, o)); }
acc('hermes_boots', 'Tralalero Sneakers', 'items/Hermes_Boots', { sprint: 6 }, { tooltip: 'The wearer can run super fast.\nThe shark wore them first.' });
acc('cloud_in_a_bottle', 'Delulu in a Bottle', 'items/Cloud_in_a_Bottle', { doubleJump: true }, { tooltip: 'Allows the holder to double jump.\nDelulu is the solulu.' });
acc('band_of_regeneration', 'Mewing Band', 'items/Band_of_Regeneration', { lifeRegen: 1 }, { tooltip: 'Slowly regenerates life.' });
acc('shackle', "Unc's Shackle", 'items/Shackle', { defense: 1 }, { tooltip: '+1 defense. Unc wore this in 2014.' });
acc('aglet', 'Drip Aglet', 'items/Aglet', { moveSpeed: 0.05 }, { tooltip: '5% increased movement speed. Drip check passed.' });
acc('lucky_horseshoe', 'Lucky Horseshoe', 'items/Lucky_Horseshoe', { noFallDmg: true }, { tooltip: 'Negates fall damage. Locked in.' });
acc('obsidian_skull', 'Ohio Skull', 'items/Obsidian_Skull', { fireBlockImmune: true, defense: 1 }, { tooltip: 'Grants immunity to Ohiostone burns.' });
acc('feral_claws', 'Crashout Claws', 'items/Feral_Claws', { meleeSpeed: 0.12 }, { tooltip: '12% increased melee speed.' });
acc('band_of_starpower', 'Band of Aura', 'items/Band_of_Starpower', { maxMana: 20 }, { tooltip: 'Increases maximum mana by 20.' });
acc('cobalt_shield', 'Sigma Shield', 'items/Cobalt_Shield', { noKnockback: true, defense: 1 }, { rare: 2, tooltip: 'Grants immunity to knockback. Unbothered. Moisturized.' });
acc('rocket_boots', 'Skibidi Boosters', 'items/Rocket_Boots', { rocket: 90 }, { rare: 2, value: 50000, tooltip: 'Allows flight. Fueled by skibidi.' });
acc('umbrella', 'Umbrella', 'items/Umbrella', { slowFall: true }, { rare: 0, tooltip: 'You will fall slower while holding this.' });

// utility
defItem('grappling_hook', { name: 'Rizz Hook', img: 'items/Grappling_Hook', hook: true, rare: 1, value: 20000, tooltip: "Press E to grapple. 'Get over here!' — your rizz" });
defItem('magic_mirror', { name: 'Looksmaxxing Mirror', img: 'items/Magic_Mirror', use: 'use', useTime: 90, recall: true, rare: 1, value: 50000, tooltip: 'Gaze in the mirror to return home.\nMogging yourself since 2011.' });
defItem('empty_bucket', { name: 'Empty Bucket', img: 'items/Empty_Bucket', stack: 99, use: 'bucket', useTime: 15, value: 400 });
defItem('water_bucket', { name: 'Water Bucket', img: 'items/Water_Bucket', stack: 99, use: 'pour', liquid: 0, useTime: 15, value: 400 });
defItem('lava_bucket', { name: 'Lava Bucket', img: 'items/Lava_Bucket', stack: 99, use: 'pour', liquid: 1, useTime: 15, value: 400 });
defItem('glowstick', { name: 'Glowstick', img: 'items/Glowstick', stack: 9999, holdLight: [0.5, 1.0, 0.6], value: 10, tooltip: 'Works when wet. Rave on.' });
defItem('labubu', { name: 'Labubu Blind Box', img: 'gen/item_labubu', use: 'use', useTime: 20, pet: 'labubu', rare: 4, value: 67000, tooltip: 'Summons a Labubu to follow you.\nYou pulled the secret one. W.' });
defItem('vile_powder', { name: 'Vile Powder', img: 'items/Vile_Powder', stack: 9999, value: 50, material: true });

// display name for an item id
function itemName(id) { const it = ITEMS[id]; return it ? it.name : id; }

// pickups that apply instantly (never enter the inventory)
defItem('heart', { name: 'Heart', img: 'items/Heart', stack: 1, pickupHeal: 20 });
defItem('mana_star', { name: 'Star', img: 'items/Star', stack: 1, pickupMana: 100 });
