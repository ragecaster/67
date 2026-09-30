// ---------- tile + wall definitions ----------
// hp: total "pick damage" needed to break (a hit deals the tool's power; dirt-likes take double)
// minPick: minimum pickaxe power needed; block: framed with neighbour-aware atlas
const T = {
  AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, SAND: 5, COPPER: 6, IRON: 7, SILVER: 8, GOLD: 9,
  DEMONITE: 10, ASH: 11, HELLSTONE: 12, CLAY: 13, SNOW: 14, ICE: 15, CORRUPT_GRASS: 16, EBONSTONE: 17,
  GRAY_BRICK: 18, RED_BRICK: 19, OBSIDIAN: 20, HELLSTONE_BRICK: 21, GLASS: 22, MUD: 23, GOLD_BRICK: 24,
  EBONSAND: 25, SANDSTONE: 26, MEME67: 27,
  PLATFORM: 30, TORCH: 31, WORKBENCH: 32, FURNACE: 33, ANVIL: 34, DOOR_CLOSED: 35, DOOR_OPEN: 36,
  CHEST: 37, TABLE: 38, CHAIR: 39, TOILET: 40, BED: 41, HELLFORGE: 42, ALTAR: 43, POT: 44,
  LIFE_CRYSTAL: 45, SHADOW_ORB: 46, TREE: 47, CACTUS: 48, SUNFLOWER: 49, MUSHROOM: 50, PLANT: 51,
  COBWEB: 52, CANDLE: 53, SAWMILL: 54, LOOM: 55, BOTTLE: 56, PIGGY_BANK: 57, DAYBLOOM: 58, BLINKROOT: 59,
  TOMBSTONE: 61, ALCHEMY: 62,
  WALLPAPER: 63, CARPET: 64, FLUORESCENT: 65, NOCLIP: 66, EXIT_SIGN: 67,
};

const TILES = [];
function defTile(id, o) { TILES[id] = Object.assign({ id, solid: false, block: false, hp: 100, minPick: 0, light: null, mapColor: '#888' }, o); }

// blocks (img = 3x3 "placed" sheet from the wiki)
defTile(T.DIRT, { name: 'Dirt', solid: true, block: true, img: 'tiles/Dirt_Block_(placed)', hp: 50, drop: 'dirt_block', mapColor: '#976b4b', sound: 'dig' });
defTile(T.GRASS, { name: 'Grass', solid: true, block: true, img: 'tiles/Grass_Block_(placed)', hp: 50, drop: 'dirt_block', mapColor: '#1c9e3f', sound: 'dig' });
defTile(T.STONE, { name: 'Stone', solid: true, block: true, img: 'tiles/Stone_Block_(placed)', hp: 100, drop: 'stone_block', mapColor: '#808080', sound: 'tink' });
defTile(T.WOOD, { name: 'Wood', solid: true, block: true, img: 'tiles/Wood_(placed)', hp: 60, drop: 'wood', mapColor: '#a97b4f', sound: 'dig' });
defTile(T.SAND, { name: 'Sand', solid: true, block: true, img: 'tiles/Sand_Block_(placed)', hp: 50, drop: 'sand_block', mapColor: '#d3c67e', sound: 'dig', falls: true });
defTile(T.COPPER, { name: 'Copium Ore', solid: true, block: true, img: 'tiles/Copper_Ore_(placed)', hp: 100, drop: 'copper_ore', mapColor: '#bf6b33', sound: 'tink', ore: true });
defTile(T.IRON, { name: 'Ironic Ore', solid: true, block: true, img: 'tiles/Iron_Ore_(placed)', hp: 120, drop: 'iron_ore', mapColor: '#8c6c5c', sound: 'tink', ore: true });
defTile(T.SILVER, { name: 'Sigma Ore', solid: true, block: true, img: 'tiles/Silver_Ore_(placed)', hp: 140, drop: 'silver_ore', mapColor: '#b9c2c3', sound: 'tink', ore: true });
defTile(T.GOLD, { name: 'Rizzium Ore', solid: true, block: true, img: 'tiles/Gold_Ore_(placed)', hp: 160, drop: 'gold_ore', mapColor: '#dfc740', sound: 'tink', ore: true });
defTile(T.DEMONITE, { name: 'Brainrot Ore', solid: true, block: true, img: 'tiles/Demonite_Ore_(placed)', hp: 200, minPick: 55, drop: 'demonite_ore', mapColor: '#6e5fa0', sound: 'tink', ore: true, light: [0.25, 0.12, 0.35] });
defTile(T.ASH, { name: 'Ash', solid: true, block: true, img: 'tiles/Ash_Block_(placed)', hp: 50, drop: 'ash_block', mapColor: '#44403f', sound: 'dig' });
defTile(T.HELLSTONE, { name: 'Ohiostone', solid: true, block: true, img: 'tiles/Hellstone_(placed)', hp: 240, minPick: 65, drop: 'hellstone', mapColor: '#c83a20', sound: 'tink', ore: true, light: [0.6, 0.2, 0.05] });
defTile(T.CLAY, { name: 'Clay', solid: true, block: true, img: 'tiles/Clay_Block_(placed)', hp: 50, drop: 'clay_block', mapColor: '#924b3b', sound: 'dig' });
defTile(T.SNOW, { name: 'Snow', solid: true, block: true, img: 'tiles/Snow_Block_(placed)', hp: 50, drop: 'snow_block', mapColor: '#d3e3ea', sound: 'dig' });
defTile(T.ICE, { name: 'Ice', solid: true, block: true, img: 'tiles/Ice_Block_(placed)', hp: 80, drop: 'ice_block', mapColor: '#90c4e8', sound: 'tink', slippery: true });
defTile(T.CORRUPT_GRASS, { name: 'Brainrot Grass', solid: true, block: true, img: 'gen/corrupt_grass', hp: 50, drop: 'dirt_block', mapColor: '#8d77b0', sound: 'dig' });
defTile(T.EBONSTONE, { name: 'Brainrot Stone', solid: true, block: true, img: 'tiles/Ebonstone_Block_(placed)', hp: 150, minPick: 65, drop: 'ebonstone_block', mapColor: '#6d5a80', sound: 'tink' });
defTile(T.GRAY_BRICK, { name: 'Gray Brick', solid: true, block: true, img: 'tiles/Gray_Brick_(placed)', hp: 100, drop: 'gray_brick', mapColor: '#8c8c8c', sound: 'tink' });
defTile(T.RED_BRICK, { name: 'Red Brick', solid: true, block: true, img: 'tiles/Red_Brick_(placed)', hp: 100, drop: 'red_brick', mapColor: '#aa3d32', sound: 'tink' });
defTile(T.OBSIDIAN, { name: 'Obsidian', solid: true, block: true, img: 'tiles/Obsidian_(placed)', hp: 200, minPick: 55, drop: 'obsidian', mapColor: '#3c2d4f', sound: 'tink' });
defTile(T.HELLSTONE_BRICK, { name: 'Ohio Brick', solid: true, block: true, img: 'tiles/Hellstone_Brick_(placed)', hp: 150, drop: 'hellstone_brick', mapColor: '#8e2e25', sound: 'tink' });
defTile(T.GLASS, { name: 'Glass', solid: true, block: true, img: 'tiles/Glass_(placed)', hp: 40, drop: 'glass', mapColor: '#c4e0ec', sound: 'shatter', transparent: true });
defTile(T.MUD, { name: 'Mud', solid: true, block: true, img: 'tiles/Mud_Block_(placed)', hp: 50, drop: 'mud_block', mapColor: '#5c4449', sound: 'dig' });
defTile(T.GOLD_BRICK, { name: 'Rizzium Brick', solid: true, block: true, img: 'tiles/Gold_Brick_(placed)', hp: 100, drop: 'gold_brick', mapColor: '#e4b42c', sound: 'tink' });
defTile(T.EBONSAND, { name: 'Brainrot Sand', solid: true, block: true, img: 'tiles/Ebonsand_Block_(placed)', hp: 50, drop: 'sand_block', mapColor: '#7d6f8f', sound: 'dig', falls: true });
defTile(T.SANDSTONE, { name: 'Sandstone', solid: true, block: true, img: 'tiles/Sandstone_Block_(placed)', hp: 100, drop: 'sandstone_block', mapColor: '#bf9954', sound: 'tink' });
defTile(T.MEME67, { name: '67 Block', solid: true, block: true, img: 'gen/meme67', hp: 67, drop: 'meme67_block', mapColor: '#ffcc33', sound: 'tink', light: [0.3, 0.25, 0.05] });

// the backrooms (Level 0)
defTile(T.WALLPAPER, { name: 'Yellow Wallpaper', solid: true, block: true, img: 'gen/wallpaper', hp: 120, drop: 'wallpaper_block', mapColor: '#c9b458', sound: 'dig' });
defTile(T.CARPET, { name: 'Moist Carpet', solid: true, block: true, img: 'gen/carpet', hp: 60, drop: 'carpet_block', mapColor: '#8f7a3c', sound: 'dig' });
defTile(T.FLUORESCENT, { name: 'Fluorescent Light', sprite: 'gen/fluorescent', hp: 1, drop: 'fluorescent_light', mapColor: '#fffbe0', light: [1, 0.97, 0.78], anyTool: true, housingLight: true, ceiling: true, flicker: true });
defTile(T.NOCLIP, { name: '??? (missing texture)', hp: 99999, drop: null, mapColor: '#ff00ff', unbreakable: true, noclip: true, light: [0.6, 0, 0.6] });
defTile(T.EXIT_SIGN, { name: 'EXIT', hp: 99999, drop: null, mapColor: '#3aff6a', unbreakable: true, exit: true, light: [0.2, 0.9, 0.3] });

// furniture / non-block tiles. multi: footprint in tiles, anchor: 'floor' | 'wall' | 'ceiling'
defTile(T.PLATFORM, { name: 'Wood Platform', platform: true, hp: 30, drop: 'wood_platform', mapColor: '#a97b4f', sound: 'dig', anyTool: false });
defTile(T.TORCH, { name: 'Torch', hp: 1, drop: 'torch', mapColor: '#fdb630', light: [1.0, 0.85, 0.55], anyTool: true, torch: true, housingLight: true });
defTile(T.WORKBENCH, { name: 'Work Bench', multi: [2, 1], sprite: 'items/Work_Bench', hp: 1, drop: 'work_bench', station: 'work_bench', mapColor: '#a97b4f', table: true, anyTool: true });
defTile(T.FURNACE, { name: 'Furnace', multi: [3, 2], sprite: 'items/Furnace', hp: 1, drop: 'furnace', station: 'furnace', mapColor: '#6f6f6f', light: [0.6, 0.35, 0.15], anyTool: true });
defTile(T.ANVIL, { name: 'Ironic Anvil', multi: [2, 1], sprite: 'tiles/Iron_Anvil_(placed)', hp: 1, drop: 'iron_anvil', station: 'anvil', mapColor: '#7c7c7c', anyTool: true });
defTile(T.DOOR_CLOSED, { name: 'Wooden Door', solid: true, multi: [1, 3], sprite: 'gen/door_closed', hp: 1, drop: 'wooden_door', mapColor: '#8d6b47', door: true, anyTool: true });
defTile(T.DOOR_OPEN, { name: 'Wooden Door', multi: [1, 3], sprite: 'gen/door_open', hp: 1, drop: 'wooden_door', mapColor: '#8d6b47', door: true, anyTool: true });
defTile(T.CHEST, { name: 'Chest', multi: [2, 2], sprite: 'items/Chest', hp: 1, drop: 'chest', mapColor: '#a97b4f', chest: true, anyTool: true });
defTile(T.TABLE, { name: 'Wooden Table', multi: [3, 2], sprite: 'tiles/Wooden_Table_(placed)', hp: 1, drop: 'wooden_table', mapColor: '#a97b4f', table: true, anyTool: true });
defTile(T.CHAIR, { name: 'Wooden Chair', multi: [1, 2], sprite: 'items/Wooden_Chair', hp: 1, drop: 'wooden_chair', mapColor: '#a97b4f', chair: true, anyTool: true, flip: true });
defTile(T.TOILET, { name: 'Skibidi Toilet', multi: [1, 2], sprite: 'items/Toilet', hp: 1, drop: 'toilet', mapColor: '#dddddd', chair: true, anyTool: true, flip: true });
defTile(T.BED, { name: 'Bed', multi: [4, 2], sprite: 'tiles/Bed_(placed)', hp: 1, drop: 'bed', mapColor: '#a97b4f', bed: true, anyTool: true, flip: true });
defTile(T.HELLFORGE, { name: 'Ohioforge', multi: [3, 2], sprite: 'items/Hellforge', hp: 1, drop: 'hellforge', station: 'hellforge', mapColor: '#6f3030', light: [0.9, 0.4, 0.15], anyTool: true });
defTile(T.ALTAR, { name: 'Brainrot Altar', multi: [3, 2], sprite: 'items/Demon_Altar', hp: 99999, drop: null, station: 'altar', mapColor: '#6d5a80', light: [0.35, 0.1, 0.4], unbreakable: true });
defTile(T.POT, { name: 'Pot', multi: [2, 2], sprite: 'gen/pot', hp: 1, drop: null, mapColor: '#8a5a3c', anyTool: true, pot: true });
defTile(T.LIFE_CRYSTAL, { name: 'Aura Crystal', multi: [2, 2], sprite: 'tiles/Life_Crystal_(placed)', hp: 1, drop: 'life_crystal', mapColor: '#f03c78', light: [0.6, 0.1, 0.3], anyTool: false });
defTile(T.SHADOW_ORB, { name: 'Brainrot Orb', multi: [2, 2], sprite: 'tiles/Shadow_Orb_(placed)', hp: 1, drop: null, mapColor: '#8f63b4', light: [0.5, 0.2, 0.6], needHammer: true, orb: true });
defTile(T.TREE, { name: 'Tree', hp: 100, drop: 'wood', mapColor: '#6b4a30', tree: true, axe: true });
defTile(T.CACTUS, { name: 'Cactus', hp: 60, drop: 'cactus', mapColor: '#4f8a32', cactus: true, axe: true });
defTile(T.SUNFLOWER, { name: 'Sunflower', multi: [2, 4], sprite: 'items/Sunflower', hp: 1, drop: 'sunflower', mapColor: '#e5c428', anyTool: true });
defTile(T.MUSHROOM, { name: 'Mushroom', sprite: 'tiles/Mushroom_(placed)', hp: 1, drop: 'mushroom', mapColor: '#c0443a', anyTool: true, plant: true });
defTile(T.PLANT, { name: 'Grass', hp: 1, drop: null, mapColor: '#1c9e3f', anyTool: true, plant: true, cut: true });
defTile(T.COBWEB, { name: 'Cobweb', sprite: 'gen/cobweb', hp: 1, drop: 'cobweb', mapColor: '#c8c8c8', anyTool: true, web: true, cut: true });
defTile(T.CANDLE, { name: 'Candle', sprite: 'items/Candle', hp: 1, drop: 'candle', mapColor: '#fdb630', light: [0.9, 0.75, 0.5], anyTool: true, housingLight: true });
defTile(T.SAWMILL, { name: 'Sawmill', multi: [3, 2], sprite: 'items/Sawmill', hp: 1, drop: 'sawmill', station: 'sawmill', mapColor: '#a97b4f', anyTool: true });
defTile(T.LOOM, { name: 'Loom', multi: [3, 2], sprite: 'items/Loom', hp: 1, drop: 'loom', station: 'loom', mapColor: '#a97b4f', anyTool: true });
defTile(T.BOTTLE, { name: 'Placed Bottle', sprite: 'items/Placed_Bottle', hp: 1, drop: 'placed_bottle', station: 'bottle', mapColor: '#9fd5e8', anyTool: true });
defTile(T.PIGGY_BANK, { name: 'Fanum Tax Bank', multi: [2, 1], sprite: 'items/Piggy_Bank', hp: 1, drop: 'piggy_bank', mapColor: '#f0a0b0', piggy: true, anyTool: true });
defTile(T.DAYBLOOM, { name: 'Daybloom', sprite: 'items/Daybloom', hp: 1, drop: 'daybloom', mapColor: '#e8d93a', anyTool: true, plant: true, cut: true });
defTile(T.BLINKROOT, { name: 'Blinkroot', sprite: 'items/Blinkroot', hp: 1, drop: 'blinkroot', mapColor: '#d8a040', anyTool: true, plant: true, cut: true, light: [0.35, 0.3, 0.1] });
defTile(T.TOMBSTONE, { name: 'Tombstone', multi: [2, 2], sprite: 'items/Tombstone', hp: 1, drop: 'tombstone', mapColor: '#999', anyTool: true });
defTile(T.ALCHEMY, { name: 'Alchemy Table', multi: [3, 2], sprite: 'items/Alchemy_Table', hp: 1, drop: 'alchemy_table', station: 'bottle', mapColor: '#a97b4f', anyTool: true, table: true });

// ---------- walls ----------
const W = { NONE: 0, DIRT: 1, STONE: 2, WOOD: 3, GRAY_BRICK: 4, EBONSTONE: 5, HELLSTONE_BRICK: 6, DIRT_P: 7, STONE_P: 8, WALLPAPER: 9, WALLPAPER_P: 10 };
const WALLS = [];
function defWall(id, o) { WALLS[id] = Object.assign({ id }, o); }
defWall(W.DIRT, { name: 'Dirt Wall', img: 'walls/Dirt_Wall_(placed)', natural: true, drop: null, mapColor: '#583f2c' });
defWall(W.STONE, { name: 'Stone Wall', img: 'walls/Stone_Wall_(placed)', natural: true, drop: null, mapColor: '#434343' });
defWall(W.WOOD, { name: 'Wood Wall', img: 'walls/Wood_Wall_(placed)', drop: 'wood_wall', mapColor: '#5a4029' });
defWall(W.GRAY_BRICK, { name: 'Gray Brick Wall', img: 'walls/Gray_Brick_Wall_(placed)', drop: 'gray_brick_wall', mapColor: '#3f3f3f' });
defWall(W.EBONSTONE, { name: 'Brainrot Wall', img: 'walls/Ebonstone_Wall_(placed)', natural: true, drop: null, mapColor: '#3a2f45' });
defWall(W.HELLSTONE_BRICK, { name: 'Ohio Brick Wall', img: 'walls/Hellstone_Brick_Wall_(placed)', drop: 'hellstone_brick_wall', mapColor: '#4a1c18' });
defWall(W.DIRT_P, { name: 'Dirt Wall', img: 'walls/Dirt_Wall_(placed)', drop: 'dirt_wall', mapColor: '#583f2c' });
defWall(W.STONE_P, { name: 'Stone Wall', img: 'walls/Stone_Wall_(placed)', drop: 'stone_wall', mapColor: '#434343' });
defWall(W.WALLPAPER, { name: 'Level 0 Wall', img: 'gen/wallpaper_wall', natural: true, drop: null, mapColor: '#a8963e' });
defWall(W.WALLPAPER_P, { name: 'Wallpaper Wall', img: 'gen/wallpaper_wall', drop: 'wallpaper_wall', mapColor: '#a8963e' });

function tileSolid(id) { const t = TILES[id]; return !!(t && t.solid); }
function tileBlock(id) { const t = TILES[id]; return !!(t && t.block); }
