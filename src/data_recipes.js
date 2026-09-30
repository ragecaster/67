// ---------- crafting recipes ----------
// [result, count, [[ingredient, n], ...], station | null]
// station: work_bench | furnace (hellforge counts) | anvil | hellforge | altar | bottle | sawmill | loom
const RECIPES = [];
function R(out, n, ing, station = null) { RECIPES.push({ out, n, ing, station }); }

// by hand
R('work_bench', 1, [['wood', 10]]);
R('wood_platform', 2, [['wood', 1]]);
R('torch', 3, [['wood', 1], ['gel', 1]]);
R('mana_crystal', 1, [['fallen_star', 5]]);
R('wood', 1, [['wood_platform', 2]]);

// work bench
R('wooden_sword', 1, [['wood', 7]], 'work_bench');
R('wooden_bow', 1, [['wood', 10]], 'work_bench');
R('wooden_hammer', 1, [['wood', 8]], 'work_bench');
R('wooden_boomerang', 1, [['wood', 12]], 'work_bench');
R('wooden_arrow', 5, [['wood', 1], ['stone_block', 1]], 'work_bench');
R('flaming_arrow', 5, [['wooden_arrow', 5], ['torch', 1]], 'work_bench');
R('unholy_arrow', 5, [['wooden_arrow', 5], ['rotten_chunk', 1]], 'work_bench');
R('wood_helmet', 1, [['wood', 20]], 'work_bench');
R('wood_breastplate', 1, [['wood', 30]], 'work_bench');
R('wood_greaves', 1, [['wood', 25]], 'work_bench');
R('wooden_door', 1, [['wood', 6]], 'work_bench');
R('wooden_table', 1, [['wood', 8]], 'work_bench');
R('wooden_chair', 1, [['wood', 4]], 'work_bench');
R('toilet', 1, [['wood', 6], ['stone_block', 7]], 'work_bench');
R('chest', 1, [['wood', 8], ['iron_bar', 2]], 'work_bench');
R('sawmill', 1, [['wood', 10], ['iron_bar', 2]], 'work_bench');
R('loom', 1, [['wood', 12]], 'work_bench');
R('furnace', 1, [['stone_block', 20], ['wood', 4], ['torch', 3]], 'work_bench');
R('iron_anvil', 1, [['iron_bar', 5]], 'work_bench');
R('candle', 1, [['gold_bar', 1], ['torch', 1]], 'work_bench');
R('wood_wall', 4, [['wood', 1]], 'work_bench');
R('stone_wall', 4, [['stone_block', 1]], 'work_bench');
R('dirt_wall', 4, [['dirt_block', 1]], 'work_bench');
R('gray_brick_wall', 4, [['gray_brick', 1]], 'work_bench');
R('hellstone_brick_wall', 4, [['hellstone_brick', 1]], 'work_bench');
R('bowl_of_soup', 1, [['mushroom', 2], ['daybloom', 1]], 'work_bench');
R('kentongan', 1, [['wood', 20], ['bone', 7]], 'work_bench');
R('obsidian_skull', 1, [['obsidian', 20]], 'furnace');
R('sunflower', 1, [['daybloom', 1], ['acorn', 1]], 'work_bench');

// sawmill / loom
R('bed', 1, [['wood', 15], ['silk', 5]], 'sawmill');
R('silk', 1, [['cobweb', 7]], 'loom');

// furnace
R('glass', 1, [['sand_block', 2]], 'furnace');
R('bottle', 2, [['glass', 1]], 'furnace');
R('gray_brick', 1, [['stone_block', 2]], 'furnace');
R('red_brick', 1, [['clay_block', 2]], 'furnace');
R('hellstone_brick', 1, [['hellstone', 1], ['stone_block', 1]], 'furnace');
R('gold_brick', 1, [['gold_ore', 1], ['stone_block', 1]], 'furnace');
R('meme67_block', 67, [['stone_block', 6], ['sand_block', 7]], 'furnace');
R('copper_bar', 1, [['copper_ore', 3]], 'furnace');
R('iron_bar', 1, [['iron_ore', 3]], 'furnace');
R('silver_bar', 1, [['silver_ore', 4]], 'furnace');
R('gold_bar', 1, [['gold_ore', 4]], 'furnace');
R('demonite_bar', 1, [['demonite_ore', 3]], 'furnace');
R('hellstone_bar', 1, [['hellstone', 3], ['obsidian', 1]], 'hellforge');

// anvil — metal tiers
for (const k of ['copper', 'iron', 'silver', 'gold']) {
  const bar = k + '_bar';
  R(k + '_pickaxe', 1, [[bar, 12], ['wood', 4]], 'anvil');
  R(k + '_axe', 1, [[bar, 9], ['wood', 3]], 'anvil');
  if (ITEMS[k + '_hammer']) R(k + '_hammer', 1, [[bar, 10], ['wood', 3]], 'anvil');
  R(k + '_broadsword', 1, [[bar, 8]], 'anvil');
  R(k + '_bow', 1, [[bar, 7]], 'anvil');
  R(k + '_helmet', 1, [[bar, 15]], 'anvil');
  R(k + '_chainmail', 1, [[bar, 25]], 'anvil');
  R(k + '_greaves', 1, [[bar, 20]], 'anvil');
}
R('copper_shortsword', 1, [['copper_bar', 7]], 'anvil');
R('iron_chain', 1, [['iron_bar', 3]], 'anvil');
R('grappling_hook', 1, [['hook', 1], ['iron_chain', 3]], 'anvil');
R('empty_bucket', 1, [['iron_bar', 3]], 'anvil');
R('the_67', 1, [['gold_bar', 6], ['silver_bar', 7]], 'anvil');
R('slime_crown', 1, [['gel', 20], ['gold_bar', 7]], 'anvil');
// brainrot tier
R('nightmare_pickaxe', 1, [['demonite_bar', 12], ['rotten_chunk', 6]], 'anvil');
R('war_axe_of_the_night', 1, [['demonite_bar', 10], ['rotten_chunk', 5]], 'anvil');
R('lights_bane', 1, [['demonite_bar', 10], ['rotten_chunk', 5]], 'anvil');
R('demon_bow', 1, [['demonite_bar', 10], ['rotten_chunk', 5]], 'anvil');
R('shadow_helmet', 1, [['demonite_bar', 15], ['rotten_chunk', 10]], 'anvil');
R('shadow_scalemail', 1, [['demonite_bar', 20], ['rotten_chunk', 15]], 'anvil');
R('shadow_greaves', 1, [['demonite_bar', 15], ['rotten_chunk', 10]], 'anvil');
// ohio tier
R('molten_pickaxe', 1, [['hellstone_bar', 20]], 'anvil');
R('molten_hamaxe', 1, [['hellstone_bar', 15]], 'anvil');
R('fiery_greatsword', 1, [['hellstone_bar', 20]], 'anvil');
R('molten_fury', 1, [['hellstone_bar', 15]], 'anvil');
R('molten_helmet', 1, [['hellstone_bar', 10]], 'anvil');
R('molten_breastplate', 1, [['hellstone_bar', 20]], 'anvil');
R('molten_greaves', 1, [['hellstone_bar', 15]], 'anvil');
R('hellfire_arrow', 100, [['wooden_arrow', 100], ['hellstone_bar', 1]], 'anvil');
R('flamelash', 1, [['magic_missile', 1], ['hellstone_bar', 10]], 'anvil');
R('hellforge', 1, [['furnace', 1], ['hellstone', 25]], 'anvil');

// altar
R('suspicious_looking_eye', 1, [['lens', 6]], 'altar');
R('nights_edge', 1, [['lights_bane', 1], ['fiery_greatsword', 1], ['tung_bat', 1]], 'altar');
R('vile_powder', 5, [['rotten_chunk', 1]], 'altar');

// alchemy (placed bottle)
R('lesser_healing_potion', 2, [['gel', 2], ['mushroom', 2], ['bottle', 2]], 'bottle');
R('healing_potion', 1, [['lesser_healing_potion', 2], ['blinkroot', 1]], 'bottle');
R('lesser_mana_potion', 2, [['gel', 2], ['fallen_star', 1], ['bottle', 2]], 'bottle');
R('swiftness_potion', 1, [['bottle', 1], ['blinkroot', 1], ['cactus', 1]], 'bottle');
R('ironskin_potion', 1, [['bottle', 1], ['daybloom', 1], ['iron_ore', 1]], 'bottle');
R('regeneration_potion', 1, [['bottle', 1], ['daybloom', 1], ['mushroom', 1]], 'bottle');
R('obsidian_skin_potion', 1, [['bottle', 1], ['blinkroot', 1], ['obsidian', 2]], 'bottle');
R('battle_potion', 1, [['bottle', 1], ['daybloom', 1], ['rotten_chunk', 1]], 'bottle');
R('spelunker_potion', 1, [['bottle', 1], ['blinkroot', 1], ['gold_ore', 1]], 'bottle');
R('night_owl_potion', 1, [['bottle', 1], ['daybloom', 1], ['blinkroot', 1]], 'bottle');
R('recall_potion', 1, [['bottle', 1], ['daybloom', 1], ['fallen_star', 1]], 'bottle');

const STATION_NAMES = { work_bench: 'Work Bench', furnace: 'Furnace', anvil: 'Anvil', hellforge: 'Ohioforge', altar: 'Brainrot Altar', bottle: 'Placed Bottle', sawmill: 'Sawmill', loom: 'Loom' };
