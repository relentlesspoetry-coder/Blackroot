// Dream Realms editor system
// Modular Pass 45: editor polish adds searchable palettes, richer validation, safer shortcuts, and clearer inspection feedback.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const TILE = DR.TILE || {};
  const TILE_DEF = DR.TILE_DEF || {};
  const CONFIG = DR.CONFIG || { MAP_SIZE: 200 };
  const RESOURCE_TYPES = DR.RESOURCE_TYPES || [];
  const PROFESSION_DEFS = DR.PROFESSION_DEFS || [];
  const CRAFTING_STATIONS = DR.CRAFTING_STATIONS || [];
  const CRAFTING_RECIPES = DR.CRAFTING_RECIPES || [];
  const EVENT_TYPES = DR.EVENT_TYPES || [];
  const NPC_DRAFTS = DR.NPC_DRAFTS || [];
  const MOB_DRAFTS = DR.MOB_DRAFTS || [];
  const MOB_SPAWN_DRAFTS = DR.MOB_SPAWN_DRAFTS || [];
  const DUNGEON_DRAFTS = DR.DUNGEON_DRAFTS || [];
  const PUZZLE_DRAFTS = DR.PUZZLE_DRAFTS || [];
  const DUNGEON_ROOM_DRAFTS = DR.DUNGEON_ROOM_DRAFTS || [];
  const QUEST_DRAFTS = DR.QUEST_DRAFTS || [];
  const ITEM_DRAFTS = DR.ITEM_DRAFTS || [];
  const LOOT_TABLES = DR.LOOT_TABLES || [];
  const SPELL_DRAFTS = DR.SPELL_DRAFTS || {};
  const SPELL_DRAFT_LIST = DR.SPELL_DRAFT_LIST || Object.values(SPELL_DRAFTS || {});
  const EVENT_BY_ID = DR.EVENT_BY_ID || Object.fromEntries(EVENT_TYPES.map(event => [event.id, event]));
  const NPC_DRAFT_BY_ID = DR.NPC_DRAFT_BY_ID || Object.fromEntries(NPC_DRAFTS.map(npc => [npc.id, npc]));
  const MOB_DRAFT_BY_ID = DR.MOB_DRAFT_BY_ID || Object.fromEntries(MOB_DRAFTS.map(mob => [mob.id, mob]));
  const MOB_SPAWN_BY_ID = DR.MOB_SPAWN_BY_ID || Object.fromEntries(MOB_SPAWN_DRAFTS.map(spawn => [spawn.id, spawn]));
  const DUNGEON_BY_ID = DR.DUNGEON_BY_ID || Object.fromEntries(DUNGEON_DRAFTS.map(dungeon => [dungeon.id, dungeon]));
  const PUZZLE_BY_ID = DR.PUZZLE_BY_ID || Object.fromEntries(PUZZLE_DRAFTS.map(puzzle => [puzzle.id, puzzle]));
  const DUNGEON_ROOM_BY_ID = DR.DUNGEON_ROOM_BY_ID || Object.fromEntries(DUNGEON_ROOM_DRAFTS.map(room => [room.id, room]));
  const QUEST_BY_ID = DR.QUEST_BY_ID || Object.fromEntries(QUEST_DRAFTS.map(quest => [quest.id, quest]));
  const ITEM_BY_ID = DR.ITEM_BY_ID || Object.fromEntries(ITEM_DRAFTS.map(item => [item.id, item]));
  const LOOT_TABLE_BY_ID = DR.LOOT_TABLE_BY_ID || Object.fromEntries(LOOT_TABLES.map(table => [table.id, table]));
  const SPELL_BY_ID = DR.SPELL_BY_ID || SPELL_DRAFTS || Object.fromEntries(SPELL_DRAFT_LIST.map(spell => [spell.id, spell]));
  const RESOURCE_BY_ID = DR.RESOURCE_BY_ID || Object.fromEntries(RESOURCE_TYPES.map(resource => [resource.id, resource]));
  const PROFESSION_BY_ID = DR.PROFESSION_BY_ID || Object.fromEntries(PROFESSION_DEFS.map(profession => [profession.id, profession]));
  const CRAFTING_STATION_BY_ID = DR.CRAFTING_STATION_BY_ID || Object.fromEntries(CRAFTING_STATIONS.map(station => [station.id, station]));
  const CRAFTING_RECIPE_BY_ID = DR.CRAFTING_RECIPE_BY_ID || Object.fromEntries(CRAFTING_RECIPES.map(recipe => [recipe.id, recipe]));
  const clamp = DR.utils?.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));

  const tileEntries = Object.keys(TILE)
    .map(key => ({ key, value: TILE[key], name: TILE_DEF[TILE[key]]?.name || key }))
    .sort((a, b) => a.value - b.value);

  const objectEntries = [
    { type: 'none', name: 'None / Erase', solid: false },
    { type: 'tree', name: 'Tree', solid: true, make: () => ({ type: 'tree', variant: Math.floor(Math.random() * 3) }) },
    { type: 'brush', name: 'Brush', solid: false },
    { type: 'rock', name: 'Rock', solid: true },
    { type: 'mushroom', name: 'Mushroom', solid: false },
    { type: 'grassTuft', name: 'Grass Tuft', solid: false },
    { type: 'flower', name: 'Flower Patch', solid: false },
    { type: 'crate', name: 'Crate', solid: true },
    { type: 'banner', name: 'Banner', solid: true },
    { type: 'lanternPost', name: 'Lantern Post', solid: false, make: () => ({ type: 'lanternPost', phase: Math.random() * Math.PI * 2 }) },
    { type: 'deadTree', name: 'Dead Tree', solid: true, make: () => ({ type: 'deadTree', variant: Math.floor(Math.random() * 3) }) },
    { type: 'ashStump', name: 'Ash Stump', solid: false },
    { type: 'glowMushroom', name: 'Glow Mushroom Cluster', solid: false },
    { type: 'rootArch', name: 'Root Arch', solid: true, make: () => ({ type: 'rootArch', variant: Math.floor(Math.random() * 3) }) },
    { type: 'fence', name: 'Fence', solid: true },
    { type: 'tent', name: 'Tent', solid: true },
    { type: 'fire', name: 'Campfire', solid: false },
    { type: 'forge', name: 'Smithing Forge', solid: false },
    { type: 'loom', name: 'Tailoring Loom', solid: false },
    { type: 'herbalistTable', name: 'Herbalist Table', solid: false },
    { type: 'mercpost', name: 'Merc Post', solid: true },
    { type: 'ruinWall', name: 'Ruin Wall', solid: true },
    { type: 'ruinPillar', name: 'Ruin Pillar', solid: true },
    { type: 'townHouse', name: 'Town House', solid: true, make: () => ({ type: 'townHouse', variant: Math.floor(Math.random() * 3) }) },
    { type: 'shop', name: 'Shop', solid: true },
    { type: 'well', name: 'Well', solid: true },
    { type: 'campStall', name: 'Camp Stall', solid: true },
    { type: 'cave', name: 'Cave Entrance', solid: true, make: () => ({ type: 'cave', name: 'Editor Cave', scale: 3.85 }) },
    { type: 'caveExit', name: 'Cave Exit', solid: false, make: () => ({ type: 'caveExit', scale: 3.25 }) }
  ];


  const attributeEntries = [
    { id: 'block', name: 'Block', color: '#e65d4f', label: 'B' },
    { id: 'unblock', name: 'Unblock Override', color: '#70d486', label: 'U' },
    { id: 'npcAvoid', name: 'NPC Avoid', color: '#f0b94a', label: 'N' },
    { id: 'noMobSpawn', name: 'No Mob Spawn', color: '#d981ff', label: 'M' },
    { id: 'safeZone', name: 'Safe Zone', color: '#6fd3ff', label: 'S' },
    { id: 'warp', name: 'Warp / Zone Exit', color: '#fff08a', label: 'W' },
    { id: 'spawnPoint', name: 'Spawn Point', color: '#ffffff', label: 'P' },
    { id: 'meditationGarden', name: 'Meditation Garden', color: '#bfe8c9', label: 'G' }
  ];

  const zoneTargetEntries = [
    { id: 'dark_woods', name: 'Dark Woods' },
    { id: 'mossfang_cave', name: 'Mossfang Cave' }
  ];


  const caveThemeEntries = [
    {
      id: 'mossfang',
      name: 'Mossfang Cave',
      palette: { floor: '#6a5b45', wall: '#5e5140' },
      objects: ['mushroom', 'rock', 'grassTuft'],
      note: 'Moss, animal bones, wet stone, cave wolves.'
    },
    {
      id: 'silkweb',
      name: 'Silk Web Cavern',
      palette: { floor: '#5d514b', wall: '#4a403c' },
      objects: ['mushroom', 'rock'],
      note: 'Spider cave: webs, eggs, sticky floor patches, venom mobs.'
    },
    {
      id: 'hollowroot',
      name: 'Hollowroot Burrow',
      palette: { floor: '#5a4b37', wall: '#493b2d' },
      objects: ['brush', 'mushroom', 'rock'],
      note: 'Root-choked cave: old roots, rot growth, corrupted nature mobs.'
    },
    {
      id: 'emberstone',
      name: 'Emberstone Hollow',
      palette: { floor: '#6b5040', wall: '#4f382e' },
      objects: ['rock', 'mushroom'],
      note: 'Warm stone, ore seams, smoke vents, fire beetles.'
    }
  ];

  const caveLayoutPresets = [
    { id: 'small', name: 'Small Cave', radius: 22, roomCount: 3, note: 'Short 1-3 room cave.' },
    { id: 'big', name: 'Big Cave', radius: 34, roomCount: 6, note: 'Branching mid-sized cave.' },
    { id: 'large', name: 'Large Cave', radius: 48, roomCount: 10, note: 'Large cave with loops and side rooms.' }
  ];

  const resourceEntries = RESOURCE_TYPES.length ? RESOURCE_TYPES : [
    { id: 'herb_gloomleaf', name: 'Gloomleaf Herb', category: 'herb', color: '#75d069', label: 'H', tool: 'Hands', skill: 'Gathering', respawnSeconds: 180, note: 'Basic herb node.' },
    { id: 'ore_copper', name: 'Copper Vein', category: 'mining', color: '#c78347', label: 'O', tool: 'Pickaxe', skill: 'Mining', respawnSeconds: 300, note: 'Starter ore node.' },
    { id: 'fish_blackwater', name: 'Blackwater Fishing Spot', category: 'fishing', color: '#5eb7cc', label: 'F', tool: 'Fishing Rod', skill: 'Fishing', respawnSeconds: 90, note: 'Fishing spot.' },
    { id: 'chest_common', name: 'Common Chest Spawn', category: 'chest', color: '#d8ad57', label: 'T', tool: 'None', skill: 'Looting', respawnSeconds: 900, note: 'Basic chest spawn.' }
  ];
  const safeResourceTypes = new Set(resourceEntries.map(entry => entry.id));


  const professionEntries = PROFESSION_DEFS.length ? PROFESSION_DEFS : [
    { id: 'gathering', name: 'Gathering', category: 'harvesting', tool: 'Hands', maxRank: 100, color: '#75d069', label: 'G', notes: 'Herb and wild plant harvesting.' },
    { id: 'mining', name: 'Mining', category: 'harvesting', tool: 'Pickaxe', maxRank: 100, color: '#c78347', label: 'M', notes: 'Ore and mineral harvesting.' },
    { id: 'fishing', name: 'Fishing', category: 'harvesting', tool: 'Fishing Rod', maxRank: 100, color: '#5eb7cc', label: 'F', notes: 'Fishing spots and water resource harvesting.' },
    { id: 'cooking', name: 'Cooking', category: 'crafting', tool: 'Cooking Fire', maxRank: 100, color: '#f0a35b', label: 'C', notes: 'Food and buff meals.' },
    { id: 'blacksmithing', name: 'Blacksmithing', category: 'crafting', tool: 'Forge', maxRank: 100, color: '#b8b2a8', label: 'B', notes: 'Metal weapons, shields, and tools.' },
    { id: 'tailoring', name: 'Tailoring', category: 'crafting', tool: 'Loom', maxRank: 100, color: '#c991ff', label: 'T', notes: 'Cloth, leather, bags, and light armor.' }
  ];

  const craftingStationEntries = CRAFTING_STATIONS.length ? CRAFTING_STATIONS : [
    { id: 'station_campfire', name: 'Campfire', profession: 'cooking', objectType: 'fire', color: '#f0a35b', label: 'CF', notes: 'Basic cooking station.' },
    { id: 'station_forge', name: 'Smithing Forge', profession: 'blacksmithing', objectType: 'forge', color: '#b8b2a8', label: 'FG', notes: 'Blacksmithing station.' },
    { id: 'station_loom', name: 'Tailoring Loom', profession: 'tailoring', objectType: 'loom', color: '#c991ff', label: 'LM', notes: 'Tailoring station.' }
  ];

  const recipeEntries = CRAFTING_RECIPES.length ? CRAFTING_RECIPES : [
    { id: 'recipe_roasted_darkwater_fish', name: 'Roasted Darkwater Fish', profession: 'cooking', stationId: 'station_campfire', tier: 1, levelRequirement: 1, craftTimeSeconds: 4, successChance: 0.95, inputs: [{ itemId: 'item_darkwater_fish', quantity: 1 }], outputs: [{ itemId: 'item_darkwater_fish', quantity: 1, variant: 'cooked' }], xp: 8, notes: 'Starter cooking recipe.' },
    { id: 'recipe_copper_bar', name: 'Copper Bar', profession: 'blacksmithing', stationId: 'station_forge', tier: 1, levelRequirement: 1, craftTimeSeconds: 5, successChance: 0.92, inputs: [{ itemId: 'item_copper_ore', quantity: 2 }], outputs: [{ itemId: 'item_copper_bar', quantity: 1 }], xp: 10, notes: 'Starter smelting recipe.' }
  ];
  const safeProfessionIds = new Set(professionEntries.map(entry => entry.id));
  const safeCraftingStationIds = new Set(craftingStationEntries.map(entry => entry.id));
  const safeRecipeIds = new Set(recipeEntries.map(entry => entry.id));

  const eventEntries = EVENT_TYPES.length ? EVENT_TYPES : [
    { id: 'event_marker', name: 'Event Marker', category: 'generic', color: '#ffd66e', label: 'E', trigger: 'interact', note: 'Generic event marker.' },
    { id: 'dialogue', name: 'Dialogue Event', category: 'dialogue', color: '#9fd7ff', label: 'D', trigger: 'interact', note: 'Dialogue event.' },
    { id: 'chest_event', name: 'Chest Event', category: 'chest', color: '#d8ad57', label: 'C', trigger: 'interact', note: 'Scripted chest event.' },
    { id: 'quest_hook', name: 'Quest Hook', category: 'quest', color: '#c991ff', label: 'Q', trigger: 'interact', note: 'Quest hook event.' },
    { id: 'shop_event', name: 'Shop Event', category: 'shop', color: '#7fe0a1', label: '$', trigger: 'interact', note: 'Shop event.' },
    { id: 'warp_event', name: 'Warp Event', category: 'warp', color: '#fff08a', label: 'W', trigger: 'touch', note: 'Warp event.' }
  ];
  const safeEventTypes = new Set(eventEntries.map(entry => entry.id));

  const npcEntries = NPC_DRAFTS.length ? NPC_DRAFTS : [
    { id: 'npc_town_guide', name: 'Town Guide', role: 'quest_giver', faction: 'Dark Woods Settlement', level: 1, questIds: ['quest_darkwood_first_steps'], shopId: null, dialogueId: 'dialogue_town_guide_intro', color: '#ffd875', label: 'Q', notes: 'Starter quest NPC draft.' },
    { id: 'npc_camp_merchant', name: 'Camp Merchant', role: 'merchant', faction: 'Dark Woods Settlement', level: 2, questIds: [], shopId: 'shop_camp_basic_goods', dialogueId: 'dialogue_camp_merchant', color: '#d8ad57', label: '$', notes: 'Starter shop NPC draft.' }
  ];
  const mobEntries = MOB_DRAFTS.length ? MOB_DRAFTS : [
    { id: 'mob_gloom_wolf', name: 'Gloom Wolf', rendererId: 'wolf', mobVisualKey: 'gloomWolf', visualScale: 1.0, animationProfile: 'quadrupedPredator', family: 'wolf', levelMin: 1, levelMax: 4, hp: 48, attack: 8, defense: 2, speed: 2.2, xp: 14, lootTableId: 'loot_dark_woods_common_mobs', color: '#52605f', label: 'W', notes: 'Starter wolf mob draft.' },
    { id: 'mob_rotling', name: 'Rotling', rendererId: 'rotling', mobVisualKey: 'rotling', rotlingPalette: 'rotling', visualScale: 0.98, animationProfile: 'rotlingCreep', family: 'rootling', levelMin: 1, levelMax: 5, hp: 38, attack: 6, defense: 1, speed: 1.7, xp: 11, lootTableId: 'loot_dark_woods_common_mobs', color: '#597034', label: 'R', notes: 'Starter rootling mob draft.' }
  ];
  const mobSpawnEntries = MOB_SPAWN_DRAFTS.length ? MOB_SPAWN_DRAFTS : [
    { id: 'spawn_dark_woods_wolves', name: 'Dark Woods Wolves', mobIds: ['mob_gloom_wolf'], countMin: 2, countMax: 5, radius: 8, respawnSeconds: 45, levelMin: 1, levelMax: 4, lootTableId: 'loot_dark_woods_common_mobs', color: '#52605f', label: 'W', notes: 'Outdoor wolf pack spawn marker.' },
    { id: 'spawn_dark_woods_rotlings', name: 'Dark Woods Rotlings', mobIds: ['mob_rotling'], countMin: 3, countMax: 7, radius: 7, respawnSeconds: 38, levelMin: 1, levelMax: 5, lootTableId: 'loot_dark_woods_common_mobs', color: '#597034', label: 'R', notes: 'Outdoor rotling spawn marker.' }
  ];
  const dungeonEntries = DUNGEON_DRAFTS.length ? DUNGEON_DRAFTS : [
    { id: 'dungeon_glooms_crypt', name: "Gloom's Crypt", zoneId: 'dark_woods', entranceZoneId: 'dark_woods', caveZoneId: 'mossfang_cave', theme: 'crypt_root', minLevel: 6, maxLevel: 12, floors: 3, recommendedPartySize: 1, eliteMultiplier: 3, bossIds: ['boss_hollow_warden'], lootTableId: 'loot_dungeon_chest', keyItemId: null, puzzleIds: ['puzzle_lantern_order'], roomPlan: ['entrance','combat','puzzle','boss','treasure'], color: '#a987ff', label: 'D', notes: 'Starter dungeon draft.' }
  ];
  const puzzleEntries = PUZZLE_DRAFTS.length ? PUZZLE_DRAFTS : [
    { id: 'puzzle_lantern_order', name: 'Lantern Order Puzzle', dungeonId: 'dungeon_glooms_crypt', puzzleType: 'sequence', triggerType: 'interact', requiredSwitches: 4, resetOnFail: true, successOpens: ['door_lantern_gate'], failureSpawns: [], color: '#fff08a', label: 'L', notes: 'Starter puzzle draft.' }
  ];
  const dungeonRoomEntries = DUNGEON_ROOM_DRAFTS.length ? DUNGEON_ROOM_DRAFTS : [
    { id: 'room_entrance', name: 'Entrance Room', kind: 'entrance', color: '#9fd7ff', label: 'E', notes: 'Dungeon entrance room.' },
    { id: 'room_puzzle', name: 'Puzzle Room', kind: 'puzzle', color: '#fff08a', label: 'P', notes: 'Puzzle room marker.' },
    { id: 'room_boss', name: 'Boss Room', kind: 'boss', color: '#e65d4f', label: 'B', notes: 'Boss room marker.' },
    { id: 'room_treasure', name: 'Treasure Room', kind: 'treasure', color: '#d8ad57', label: 'T', notes: 'Treasure room marker.' }
  ];
  const safeDungeonIds = new Set(dungeonEntries.map(entry => entry.id));
  const safePuzzleIds = new Set(puzzleEntries.map(entry => entry.id));
  const normalizeLootTableId = id => id === 'common_chest' ? 'loot_common_chest' : id;

  const safeNpcIds = new Set(npcEntries.map(entry => entry.id));
  const safeMobIds = new Set(mobEntries.map(entry => entry.id));
  const safeMobSpawnIds = new Set(mobSpawnEntries.map(entry => entry.id));

  const questEntries = QUEST_DRAFTS.length ? QUEST_DRAFTS : [
    {
      id: 'quest_darkwood_first_steps',
      name: 'First Steps Into Dark Woods',
      folder: 'Dark Woods / Starter',
      repeatable: false,
      canAbandon: true,
      giver: 'Town Guide',
      turnIn: 'Town Guide',
      color: '#c991ff',
      label: 'Q',
      tasks: [{ type: 'kill', target: 'any_dark_woods_mob', label: 'Defeat enemies in Dark Woods', required: 3, progress: 0 }],
      rewards: { xp: 80, gold: 18, items: [] },
      note: 'Starter quest draft.'
    }
  ];
  const safeQuestIds = new Set(questEntries.map(entry => entry.id));

  const itemEntries = ITEM_DRAFTS.length ? ITEM_DRAFTS : [
    { id: 'item_gloomforged_blade', name: 'Gloomforged Blade', type: 'weapon', slot: 'weapon', rarity: 'white', levelRequirement: 1, classRestrictions: ['Bard', 'Fighter'], stats: { attack: 6 }, damage: { min: 3, max: 8, speed: 2.4 }, armor: 0, sellValue: 18, stackSize: 1, icon: { family: 'blade', color: '#d8ded1', glyph: '⚔' }, description: 'Starter melee weapon draft.' },
    { id: 'item_gloomleaf', name: 'Gloomleaf', type: 'resource', slot: 'none', rarity: 'white', levelRequirement: 1, classRestrictions: Object.keys(DR.CLASSES || {}), stats: {}, damage: null, armor: 0, sellValue: 2, stackSize: 99, icon: { family: 'herb', color: '#75d069', glyph: '♧' }, description: 'Gathering resource.' }
  ];
  const lootTableEntries = LOOT_TABLES.length ? LOOT_TABLES : [
    { id: 'loot_dark_woods_common_mobs', name: 'Dark Woods Common Mobs', source: { kind: 'mobFamily', id: 'dark_woods_common' }, gold: { min: 1, max: 8 }, rarityWeights: { grey: 45, white: 35, green: 15, blue: 4, purple: 1 }, entries: [{ itemId: 'item_gloomleaf', chance: 22, min: 1, max: 2 }], rarePool: [], notes: 'Starter outdoor mob drops.' }
  ];
  const safeItemIds = new Set(itemEntries.map(entry => entry.id));
  const safeLootTableIds = new Set(lootTableEntries.map(entry => entry.id));

  const spellEntries = SPELL_DRAFT_LIST.length ? SPELL_DRAFT_LIST : Object.values(SPELL_BY_ID || {});
  const safeSpellIds = new Set(spellEntries.map(entry => entry.id));

  const solidObjectTypes = new Set(objectEntries.filter(entry => entry.solid).map(entry => entry.type));
  const safeObjectTypes = new Set(objectEntries.map(entry => entry.type));

  const tabDefs = [
    { id: 'layeredMap', label: 'Layered Map', tools: [] },
    { id: 'tiles', label: 'Tiles', tools: ['Select', 'Paint Tile', 'Rectangle', 'Fill', 'Eyedropper', 'Raise', 'Lower'] },
    { id: 'objects', label: 'Objects', tools: ['Select', 'Place Object', 'Erase Object', 'Eyedropper Object'] },
    { id: 'attributes', label: 'Attributes', tools: ['Select', 'Block', 'Unblock', 'NPC Avoid', 'No Mob Spawn', 'Safe Zone', 'Meditation Garden', 'Warp', 'Clear Attribute'] },
    { id: 'zones', label: 'Zones', tools: ['Zone Properties', 'Zone Exit', 'Spawn Point', 'Level Range', 'Clear Attribute'] },
    { id: 'caves', label: 'Caves', tools: ['Cave Properties', 'Generate Small Cave', 'Generate Big Cave', 'Generate Large Cave', 'Cave Room', 'Cave Tunnel', 'Cave Entrance', 'Cave Exit', 'Cave Floor', 'Cave Wall'] },
    { id: 'resources', label: 'Resources', tools: ['Select', 'Resource Browser', 'New Resource', 'Edit Resource', 'Duplicate Resource', 'Delete Resource', 'Place Resource', 'Erase Resource', 'Eyedropper Resource', 'Herb Node', 'Mining Node', 'Fishing Spot', 'Chest Spawn'] },
    { id: 'events', label: 'Events', tools: ['Select', 'Place Event', 'Erase Event', 'Eyedropper Event', 'Event Marker', 'Dialogue', 'Chest', 'Quest Hook', 'Shop Event', 'Warp Event'] },
    { id: 'npcs', label: 'NPCs', tools: ['NPC Browser', 'New NPC', 'Edit NPC', 'Duplicate NPC', 'Delete NPC', 'Place NPC', 'Erase NPC', 'Eyedropper NPC', 'Assign Quest', 'Assign Shop', 'Assign Dialogue'] },
    { id: 'mobs', label: 'Mobs', tools: ['Mob Browser', 'New Mob', 'Edit Mob', 'Duplicate Mob', 'Delete Mob', 'Spawn Browser', 'New Spawn', 'Edit Spawn', 'Duplicate Spawn', 'Delete Spawn', 'Place Spawn', 'Erase Spawn', 'Eyedropper Spawn', 'Assign Mob Loot'] },
    { id: 'dungeons', label: 'Dungeons', tools: ['Dungeon Browser', 'New Dungeon', 'Edit Dungeon', 'Duplicate Dungeon', 'Delete Dungeon', 'Puzzle Browser', 'New Puzzle', 'Edit Puzzle', 'Duplicate Puzzle', 'Delete Puzzle', 'Place Dungeon Entrance', 'Erase Dungeon Marker', 'Eyedropper Dungeon', 'Boss Room', 'Puzzle Marker', 'Lock Marker', 'Key Marker', 'Door Marker', 'Treasure Room', 'Assign Dungeon Loot'] },
    { id: 'quests', label: 'Quests', tools: ['Select', 'Place Quest Hook', 'Assign Quest Hook', 'Eyedropper Quest', 'New Quest', 'Edit Quest', 'Delete Quest'] },
    { id: 'items', label: 'Items', tools: ['Item Browser', 'New Item', 'Edit Item', 'Duplicate Item', 'Delete Item'] },
    { id: 'loot', label: 'Loot', tools: ['Loot Table Browser', 'New Loot Table', 'Edit Loot Table', 'Duplicate Loot Table', 'Delete Loot Table', 'Assign Loot Table'] },
    { id: 'spells', label: 'Spells', tools: ['Spell Browser', 'New Spell', 'Edit Spell', 'Duplicate Spell', 'Delete Spell', 'Assign Class Slot'] },
    { id: 'crafting', label: 'Crafting', tools: ['Recipe Browser', 'New Recipe', 'Edit Recipe', 'Duplicate Recipe', 'Delete Recipe', 'Assign Station', 'Place Station', 'Erase Station', 'Eyedropper Station'] }
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
  }

  function tileName(tile) {
    if (!tile) return 'None';
    return TILE_DEF[tile.type]?.name || `Tile ${tile.type}`;
  }

  function objectName(obj) {
    if (!obj) return 'None';
    return obj.type || obj.kind || obj.name || 'Object';
  }

  function makeButton(label, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  function cloneObjectTemplate(entry) {
    if (!entry || entry.type === 'none') return null;
    if (typeof entry.make === 'function') return entry.make();
    return { type: entry.type };
  }

  window.registerDreamRealmsSystem({
    id: 'editor-shell',
    name: 'Editor Shell',

    install(game) {
      const runtime = {
        game,
        active: false,
        // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
        // the attribute/resource/event/npc/mob-spawn/dungeon markers drawn
        // by render() below used to always render whenever the editor was
        // open - there was no way to hide any one category. Defaulting
        // every key to true preserves that exact prior always-on behavior;
        // these only ever change if a user clicks one of the new overlay
        // toggle buttons (data-editor-action="toggleOverlay*").
        overlays: { attributes: true, resources: true, events: true, npcs: true, mobSpawns: true, dungeons: true },
        tab: 'tiles',
        tool: 'Select',
        selectedTileType: TILE.DIRT ?? 3,
        selectedObjectType: 'tree',
        selectedAttributeType: 'block',
        selectedWarpTarget: 'mossfang_cave',
        selectedCaveTheme: 'mossfang',
        selectedCavePreset: 'small',
        selectedResourceType: resourceEntries[0]?.id || 'herb_gloomleaf',
        selectedProfessionId: professionEntries[0]?.id || 'gathering',
        selectedStationId: craftingStationEntries[0]?.id || 'station_campfire',
        selectedRecipeId: recipeEntries[0]?.id || 'recipe_roasted_darkwater_fish',
        selectedNpcId: npcEntries[0]?.id || 'npc_town_guide',
        selectedMobId: mobEntries[0]?.id || 'mob_gloom_wolf',
        selectedMobSpawnId: mobSpawnEntries[0]?.id || 'spawn_dark_woods_wolves',
        selectedDungeonId: dungeonEntries[0]?.id || 'dungeon_glooms_crypt',
        selectedPuzzleId: puzzleEntries[0]?.id || 'puzzle_lantern_order',
        selectedEventType: eventEntries[0]?.id || 'event_marker',
        selectedQuestId: questEntries[0]?.id || 'quest_darkwood_first_steps',
        selectedItemId: itemEntries[0]?.id || 'item_gloomforged_blade',
        selectedLootTableId: lootTableEntries[0]?.id || 'loot_dark_woods_common_mobs',
        selectedSpellId: spellEntries[0]?.id || 'spell_bard_war_hymn',
        caveRoomRadius: 8,
        caveTunnelWidth: 3,
        zoneExitRadius: 2.5,
        brushSize: 1,
        hovered: null,
        selected: null,
        rectAnchor: null,
        paintDown: false,
        panel: null,
        tabBar: null,
        toolList: null,
        palette: null,
        paletteSearchInput: null,
        paletteCount: null,
        validationPanel: null,
        status: null,
        inspector: null,
        paletteSearch: '',
        validationSummary: 'Validation has not run yet.',
        lastValidation: null,
        lastPaintKey: '',
        changeCount: 0,
        undoStack: [],
        redoStack: [],
        maxHistory: 80,
        isApplyingHistory: false,

        init() {
          this.ensureEditorMetadata();
          this.injectStyles();
          this.buildPanel();
          this.bindEvents();
          this.refreshPanel();
        },

        injectStyles() {
          if (document.getElementById('dream-realms-editor-styles')) return;
          const style = document.createElement('style');
          style.id = 'dream-realms-editor-styles';
          style.textContent = `
            .editor-panel {
              position: fixed;
              right: 18px;
              top: 80px;
              width: 382px;
              max-height: calc(100vh - 112px);
              overflow: hidden;
              display: none;
              z-index: 45;
              color: #e9ddbf;
              background: linear-gradient(180deg, rgba(20,18,14,0.96), rgba(8,10,8,0.94));
              border: 1px solid rgba(221,190,116,0.42);
              border-radius: 16px;
              box-shadow: 0 18px 48px rgba(0,0,0,0.55), inset 0 0 18px rgba(229,194,107,0.08);
              font-family: Georgia, 'Times New Roman', serif;
            }
            .editor-panel.active { display: block; }
            .editor-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 12px 14px;
              border-bottom: 1px solid rgba(221,190,116,0.24);
              background: rgba(95,70,32,0.20);
            }
            .editor-title { font-weight: 800; letter-spacing: 0.06em; color: #f1d18a; }
            .editor-hotkey { font-size: 11px; color: #a99a78; }
            .editor-body { padding: 12px; max-height: calc(100vh - 180px); overflow: auto; }
            .editor-tabs, .editor-tool-list, .editor-palette { display: flex; flex-wrap: wrap; gap: 6px; }
            .editor-tabs { margin-bottom: 10px; }
            .editor-tabs button,
            .editor-tool-list button,
            .editor-actions button,
            .editor-palette button {
              cursor: var(--game-cursor);
              border: 1px solid rgba(211,175,103,0.28);
              background: rgba(47,38,24,0.82);
              color: #e9ddbf;
              border-radius: 10px;
              padding: 7px 9px;
              font: inherit;
              font-size: 12px;
            }
            .editor-tabs button:disabled,
            .editor-tool-list button:disabled,
            .editor-actions button:disabled,
            .editor-palette button:disabled {
              opacity: 0.42;
              cursor: var(--game-cursor);
            }
            .editor-tabs button.active,
            .editor-tool-list button.active,
            .editor-palette button.active,
            .editor-actions button.active {
              color: #fff4cf;
              border-color: rgba(255,213,116,0.82);
              background: linear-gradient(180deg, rgba(138,96,36,0.95), rgba(72,48,21,0.95));
              box-shadow: 0 0 12px rgba(255,205,95,0.16);
            }
            .editor-section {
              border: 1px solid rgba(221,190,116,0.16);
              border-radius: 12px;
              padding: 10px;
              margin: 10px 0;
              background: rgba(0,0,0,0.22);
            }
            .editor-section h4 {
              margin: 0 0 8px;
              color: #d9bc78;
              font-size: 13px;
              letter-spacing: 0.04em;
            }
            .editor-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
            .editor-search-box { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
            .editor-search-box button { min-width: 56px !important; padding: 6px 8px !important; }
            .editor-search-hidden { display: none !important; }
            .editor-palette-count { color: #d9bc78; margin: 6px 0 0; }
            .editor-validation {
              margin-top: 8px;
              border-left: 3px solid rgba(255,213,116,0.45);
              padding-left: 8px;
              color: #d8dfb6;
            }
            .editor-status, .editor-inspector {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              color: #c9d1aa;
              font-size: 11px;
              line-height: 1.45;
              white-space: pre-wrap;
            }
            .editor-close { min-width: 32px; height: 28px; padding: 0 !important; font-weight: 800 !important; }
            .editor-badge {
              display: inline-block;
              border: 1px solid rgba(255,213,116,0.28);
              border-radius: 999px;
              padding: 2px 7px;
              color: #f3d996;
              background: rgba(255,213,116,0.08);
              font-size: 10px;
              margin-left: 6px;
            }
            .editor-field-row { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 8px; margin: 6px 0; }
            .editor-field-row label { color: #cdbb8b; font-size: 12px; }
            .editor-field-row input, .editor-field-row select {
              min-width: 0;
              border: 1px solid rgba(211,175,103,0.26);
              background: rgba(11,14,10,0.92);
              color: #f0e4c6;
              border-radius: 8px;
              padding: 6px 8px;
              font: 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .editor-hint { color: #a99a78; font-size: 11px; line-height: 1.35; margin-top: 8px; }
            .editor-swatch { display:inline-block; width:10px; height:10px; margin-right:5px; border-radius:3px; border:1px solid rgba(255,255,255,.22); vertical-align:-1px; }
          `;
          document.head.appendChild(style);
        },

        buildPanel() {
          if (this.panel) return;
          const panel = document.createElement('aside');
          panel.className = 'editor-panel';
          panel.innerHTML = `
            <div class="editor-header">
              <div>
                <div class="editor-title">Dream Realms Editor <span class="editor-badge">Pass 45 QA</span></div>
                <div class="editor-hotkey">F10 toggles editor · / focuses filter · [ ] brush size · Esc clears selection · Ctrl+Z / Ctrl+Y history</div>
              </div>
              <button type="button" class="editor-close" data-editor-close>×</button>
            </div>
            <div class="editor-body">
              <div class="editor-section">
                <h4>Editor Tabs</h4>
                <div class="editor-tabs" data-editor-tabs></div>
              </div>
              <div class="editor-section">
                <h4>Tools</h4>
                <div class="editor-tool-list" data-editor-tools></div>
                <div class="editor-field-row">
                  <label>Brush Size</label>
                  <input type="range" min="1" max="9" step="1" value="1" data-editor-brush>
                </div>
                <div class="editor-status" data-editor-brush-label>Brush: 1x1</div>
              </div>
              <div class="editor-section">
                <h4>Palette</h4>
                <div class="editor-field-row editor-search-row">
                  <label>Filter</label>
                  <div class="editor-search-box">
                    <input type="search" placeholder="Search this tab..." data-editor-palette-search>
                    <button type="button" data-editor-action="clearSearch">Clear</button>
                  </div>
                </div>
                <div class="editor-status editor-palette-count" data-editor-palette-count>Showing all palette entries.</div>
                <div class="editor-palette" data-editor-palette></div>
                <div class="editor-hint" data-editor-hint></div>
              </div>
              <div class="editor-section">
                <h4>World Save Tools</h4>
                <div class="editor-actions">
                  <button type="button" data-editor-action="undo">Undo</button>
                  <button type="button" data-editor-action="redo">Redo</button>
                  <button type="button" data-editor-action="save">Save World</button>
                  <button type="button" data-editor-action="load">Load World</button>
                  <button type="button" data-editor-action="export">Export JSON</button>
                  <button type="button" data-editor-action="import">Import JSON</button>
                  <button type="button" data-editor-action="validateOnly">Validate Only</button>
                  <button type="button" data-editor-action="validate">Validate + Repair</button>
                  <button type="button" data-editor-action="clearSelection">Clear Selection</button>
                  <button type="button" data-editor-action="focusPlayer">Focus Player</button>
                  <button type="button" data-editor-action="reset">Reset World</button>
                  <button type="button" data-editor-action="copyInspector">Copy Inspector</button>
                </div>
              </div>
              <div class="editor-section">
                <h4>Overlays</h4>
                <div class="editor-actions" data-editor-overlay-actions>
                  <button type="button" data-editor-action="toggleOverlayAttributes">Attributes: On</button>
                  <button type="button" data-editor-action="toggleOverlayResources">Resources: On</button>
                  <button type="button" data-editor-action="toggleOverlayEvents">Events: On</button>
                  <button type="button" data-editor-action="toggleOverlayNpcs">NPCs: On</button>
                  <button type="button" data-editor-action="toggleOverlayMobSpawns">Mob Spawns: On</button>
                  <button type="button" data-editor-action="toggleOverlayDungeons">Dungeons: On</button>
                </div>
              </div>
              <div class="editor-section">
                <h4>Status</h4>
                <div class="editor-status" data-editor-status></div>
                <div class="editor-status editor-validation" data-editor-validation>Validation has not run yet.</div>
              </div>
              <div class="editor-section">
                <h4>Inspector</h4>
                <div class="editor-inspector" data-editor-inspector></div>
              </div>
            </div>
          `;
          document.body.appendChild(panel);
          this.panel = panel;
          this.tabBar = panel.querySelector('[data-editor-tabs]');
          this.toolList = panel.querySelector('[data-editor-tools]');
          this.palette = panel.querySelector('[data-editor-palette]');
          this.paletteSearchInput = panel.querySelector('[data-editor-palette-search]');
          this.paletteCount = panel.querySelector('[data-editor-palette-count]');
          this.validationPanel = panel.querySelector('[data-editor-validation]');
          this.status = panel.querySelector('[data-editor-status]');
          this.inspector = panel.querySelector('[data-editor-inspector]');
          this.hint = panel.querySelector('[data-editor-hint]');
          this.brushInput = panel.querySelector('[data-editor-brush]');
          this.brushLabel = panel.querySelector('[data-editor-brush-label]');

          panel.querySelector('[data-editor-close]').addEventListener('click', () => this.toggle(false));
          panel.addEventListener('click', event => this.handlePanelClick(event));
          this.brushInput.addEventListener('input', () => {
            this.brushSize = Number(this.brushInput.value) || 1;
            this.refreshStatus();
            this.refreshBrushLabel();
          });
          this.paletteSearchInput?.addEventListener('input', () => {
            this.paletteSearch = String(this.paletteSearchInput.value || '');
            this.applyPaletteSearch();
            this.refreshStatus();
          });
        },

        bindEvents() {
          window.addEventListener('keydown', event => {
            const key = String(event.key || '').toLowerCase();
            if (event.key === 'F10') {
              event.preventDefault();
              this.toggle();
              return;
            }
            if (!this.active) return;
            const target = event.target;
            const isTextInput = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '');
            if (!isTextInput && event.key === '/') {
              event.preventDefault();
              this.paletteSearchInput?.focus();
              this.paletteSearchInput?.select?.();
              return;
            }
            if (!isTextInput && event.key === 'Escape') {
              event.preventDefault();
              this.selected = null;
              this.rectAnchor = null;
              this.refreshInspector();
              return;
            }
            if (!isTextInput && event.key === '[') {
              event.preventDefault();
              this.setBrushSize((Number(this.brushSize) || 1) - 2);
              return;
            }
            if (!isTextInput && event.key === ']') {
              event.preventDefault();
              this.setBrushSize((Number(this.brushSize) || 1) + 2);
              return;
            }
            if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
              event.preventDefault();
              this.undo();
              return;
            }
            if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
              event.preventDefault();
              this.redo();
            }
          });

          window.addEventListener('pointerup', () => {
            this.paintDown = false;
            this.lastPaintKey = '';
          }, true);

          const canvas = DR.runtime?.canvas;
          if (!canvas) return;

          canvas.addEventListener('mousemove', event => {
            if (!this.active || this.tab === 'layeredMap' || !this.game.started || this.game.paused) return;
            const ref = this.tileRefFromPointer(event);
            this.hovered = ref;
            if (this.paintDown && this.isDragPaintTool()) {
              this.applyTool(ref);
            }
            this.refreshInspector();
          }, true);

          canvas.addEventListener('pointerdown', event => {
            if (!this.active || this.tab === 'layeredMap' || !this.game.started || this.game.paused) return;
            const ref = this.tileRefFromPointer(event);
            this.hovered = ref;
            this.selected = ref;
            this.paintDown = true;
            this.applyTool(ref);
            this.refreshInspector();
            event.preventDefault();
            event.stopImmediatePropagation();
          }, true);
        },

        tileRefFromPointer(event) {
          const canvas = DR.runtime?.canvas;
          const rect = canvas.getBoundingClientRect();
          const world = this.game.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
          return this.resolveTileRef(world.x, world.y);
        },

        handlePanelClick(event) {
          const tabButton = event.target.closest('button[data-editor-tab]');
          if (tabButton) {
            this.tab = tabButton.dataset.editorTab;
            const def = tabDefs.find(entry => entry.id === this.tab);
            this.tool = def?.tools?.[0] || 'Select';
            this.rectAnchor = null;
            this.refreshPanel();
            this.syncLayeredMapEditor();
            return;
          }

          const toolButton = event.target.closest('button[data-editor-tool]');
          if (toolButton) {
            this.tool = toolButton.dataset.editorTool;
            this.rectAnchor = null;
            this.refreshPanel();
            return;
          }

          const tileButton = event.target.closest('button[data-editor-tile]');
          if (tileButton) {
            this.selectedTileType = Number(tileButton.dataset.editorTile);
            this.tool = 'Paint Tile';
            this.tab = 'tiles';
            this.refreshPanel();
            return;
          }

          const objectButton = event.target.closest('button[data-editor-object]');
          if (objectButton) {
            this.selectedObjectType = objectButton.dataset.editorObject;
            this.tool = this.selectedObjectType === 'none' ? 'Erase Object' : 'Place Object';
            this.tab = 'objects';
            this.refreshPanel();
            return;
          }

          const attrButton = event.target.closest('button[data-editor-attr]');
          if (attrButton) {
            this.selectedAttributeType = attrButton.dataset.editorAttr;
            const entry = attributeEntries.find(item => item.id === this.selectedAttributeType);
            if (entry?.id === 'warp') this.tool = this.tab === 'zones' ? 'Zone Exit' : 'Warp';
            else if (entry?.id === 'spawnPoint') this.tool = 'Spawn Point';
            else if (entry?.id === 'block') this.tool = 'Block';
            else if (entry?.id === 'unblock') this.tool = 'Unblock';
            else if (entry) this.tool = entry.name;
            this.refreshPanel();
            return;
          }

          const targetButton = event.target.closest('button[data-editor-target-zone]');
          if (targetButton) {
            this.selectedWarpTarget = targetButton.dataset.editorTargetZone;
            this.refreshPanel();
            return;
          }

          const caveThemeButton = event.target.closest('button[data-editor-cave-theme]');
          if (caveThemeButton) {
            this.selectedCaveTheme = caveThemeButton.dataset.editorCaveTheme;
            this.setCaveTheme(this.selectedCaveTheme);
            this.refreshPanel();
            return;
          }

          const cavePresetButton = event.target.closest('button[data-editor-cave-preset]');
          if (cavePresetButton) {
            this.selectedCavePreset = cavePresetButton.dataset.editorCavePreset;
            this.tool = cavePresetButton.dataset.editorTool || this.tool;
            this.tab = 'caves';
            this.refreshPanel();
            return;
          }

          const resourceButton = event.target.closest('button[data-editor-resource]');
          if (resourceButton) {
            this.selectedResourceType = resourceButton.dataset.editorResource;
            const resource = this.resourceTypeById(this.selectedResourceType);
            if (resource?.category === 'herb') this.tool = 'Herb Node';
            else if (resource?.category === 'mining') this.tool = 'Mining Node';
            else if (resource?.category === 'fishing') this.tool = 'Fishing Spot';
            else if (resource?.category === 'chest') this.tool = 'Chest Spawn';
            else this.tool = 'Place Resource';
            this.tab = 'resources';
            this.refreshPanel();
            return;
          }

          const resourceActionButton = event.target.closest('button[data-editor-resource-action]');
          if (resourceActionButton) {
            this.runResourceAction(resourceActionButton.dataset.editorResourceAction);
            return;
          }

          const professionButton = event.target.closest('button[data-editor-profession]');
          if (professionButton) {
            this.selectedProfessionId = professionButton.dataset.editorProfession;
            this.tab = 'crafting';
            this.refreshPanel();
            return;
          }

          const stationButton = event.target.closest('button[data-editor-station]');
          if (stationButton) {
            this.selectedStationId = stationButton.dataset.editorStation;
            this.tab = 'crafting';
            this.refreshPanel();
            return;
          }

          const recipeButton = event.target.closest('button[data-editor-recipe]');
          if (recipeButton) {
            this.selectedRecipeId = recipeButton.dataset.editorRecipe;
            this.tab = 'crafting';
            this.tool = 'Recipe Browser';
            this.refreshPanel();
            return;
          }

          const craftingActionButton = event.target.closest('button[data-editor-crafting-action]');
          if (craftingActionButton) {
            this.runCraftingAction(craftingActionButton.dataset.editorCraftingAction);
            return;
          }
          const eventButton = event.target.closest('button[data-editor-event]');
          if (eventButton) {
            this.selectedEventType = eventButton.dataset.editorEvent;
            const eventDef = eventEntries.find(item => item.id === this.selectedEventType);
            if (eventDef?.category === 'dialogue') this.tool = 'Dialogue';
            else if (eventDef?.category === 'chest') this.tool = 'Chest';
            else if (eventDef?.category === 'quest') this.tool = 'Quest Hook';
            else if (eventDef?.category === 'shop') this.tool = 'Shop Event';
            else if (eventDef?.category === 'warp') this.tool = 'Warp Event';
            else this.tool = 'Event Marker';
            this.tab = 'events';
            this.refreshPanel();
            return;
          }

          const npcButton = event.target.closest('button[data-editor-npc]');
          if (npcButton) {
            this.selectedNpcId = npcButton.dataset.editorNpc;
            this.tab = 'npcs';
            this.tool = 'NPC Browser';
            this.refreshPanel();
            return;
          }

          const npcActionButton = event.target.closest('button[data-editor-npc-action]');
          if (npcActionButton) {
            this.runNpcAction(npcActionButton.dataset.editorNpcAction);
            return;
          }

          const mobButton = event.target.closest('button[data-editor-mob]');
          if (mobButton) {
            this.selectedMobId = mobButton.dataset.editorMob;
            this.tab = 'mobs';
            this.tool = 'Mob Browser';
            this.refreshPanel();
            return;
          }

          const mobSpawnButton = event.target.closest('button[data-editor-mob-spawn]');
          if (mobSpawnButton) {
            this.selectedMobSpawnId = mobSpawnButton.dataset.editorMobSpawn;
            this.tab = 'mobs';
            this.tool = 'Spawn Browser';
            this.refreshPanel();
            return;
          }

          const mobActionButton = event.target.closest('button[data-editor-mob-action]');
          if (mobActionButton) {
            this.runMobAction(mobActionButton.dataset.editorMobAction);
            return;
          }

          const dungeonButton = event.target.closest('button[data-editor-dungeon]');
          if (dungeonButton) {
            this.selectedDungeonId = dungeonButton.dataset.editorDungeon;
            this.tab = 'dungeons';
            this.tool = 'Dungeon Browser';
            this.refreshPanel();
            return;
          }

          const puzzleButton = event.target.closest('button[data-editor-puzzle]');
          if (puzzleButton) {
            this.selectedPuzzleId = puzzleButton.dataset.editorPuzzle;
            const puzzle = this.selectedPuzzle();
            if (puzzle?.dungeonId) this.selectedDungeonId = puzzle.dungeonId;
            this.tab = 'dungeons';
            this.tool = 'Puzzle Browser';
            this.refreshPanel();
            return;
          }

          const dungeonActionButton = event.target.closest('button[data-editor-dungeon-action]');
          if (dungeonActionButton) {
            this.runDungeonAction(dungeonActionButton.dataset.editorDungeonAction);
            return;
          }

          const questButton = event.target.closest('button[data-editor-quest]');
          if (questButton) {
            this.selectedQuestId = questButton.dataset.editorQuest;
            this.tool = 'Place Quest Hook';
            this.tab = 'quests';
            this.refreshPanel();
            return;
          }

          const questActionButton = event.target.closest('button[data-editor-quest-action]');
          if (questActionButton) {
            this.runQuestAction(questActionButton.dataset.editorQuestAction);
            return;
          }

          const itemButton = event.target.closest('button[data-editor-item]');
          if (itemButton) {
            this.selectedItemId = itemButton.dataset.editorItem;
            this.tab = 'items';
            this.tool = 'Item Browser';
            this.refreshPanel();
            return;
          }

          const itemActionButton = event.target.closest('button[data-editor-item-action]');
          if (itemActionButton) {
            this.runItemAction(itemActionButton.dataset.editorItemAction);
            return;
          }

          const lootButton = event.target.closest('button[data-editor-loot-table]');
          if (lootButton) {
            this.selectedLootTableId = lootButton.dataset.editorLootTable;
            this.tab = 'loot';
            this.tool = 'Loot Table Browser';
            this.refreshPanel();
            return;
          }

          const lootActionButton = event.target.closest('button[data-editor-loot-action]');
          if (lootActionButton) {
            this.runLootAction(lootActionButton.dataset.editorLootAction);
            return;
          }

          const spellButton = event.target.closest('button[data-editor-spell]');
          if (spellButton) {
            this.selectedSpellId = spellButton.dataset.editorSpell;
            this.tab = 'spells';
            this.tool = 'Spell Browser';
            this.refreshPanel();
            return;
          }

          const spellActionButton = event.target.closest('button[data-editor-spell-action]');
          if (spellActionButton) {
            this.runSpellAction(spellActionButton.dataset.editorSpellAction);
            return;
          }

          const actionButton = event.target.closest('button[data-editor-action]');
          if (actionButton) this.runAction(actionButton.dataset.editorAction);
        },

        runAction(action) {
          if (action === 'undo') this.undo();
          else if (action === 'redo') this.redo();
          else if (action === 'save') { this.game.saveWorldState?.(); this.game.layeredMapEditor?.markWorldSaved?.(); }
          else if (action === 'load') this.game.loadSavedWorldState?.({ silent: false, resetEntities: true });
          else if (action === 'export') this.game.exportWorldSave?.();
          else if (action === 'import') this.game.worldImportInput?.click?.();
          // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
          // "Validate Only" has been a button in this panel since before
          // this phase, but had no matching branch here, so clicking it
          // did nothing at all - a real, pre-existing bug directly
          // relevant to strengthening the validation panel this phase
          // already extends (see collectValidationDetails above).
          else if (action === 'validateOnly') this.validateEditedWorld({ repair: false });
          else if (action === 'validate') this.validateEditedWorld({ repair: true });
          else if (action === 'clearSelection') this.clearSelection();
          else if (action === 'reset') this.game.resetWorldSave?.();
          else if (action === 'markDirty') this.markDirty('Editor marked world state dirty.');
          // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
          // independent overlay visibility toggles for the marker
          // categories render() draws - previously always-on with no way
          // to hide any one category while the editor is open.
          else if (action === 'toggleOverlayAttributes') this.overlays.attributes = !this.overlays.attributes;
          else if (action === 'toggleOverlayResources') this.overlays.resources = !this.overlays.resources;
          else if (action === 'toggleOverlayEvents') this.overlays.events = !this.overlays.events;
          else if (action === 'toggleOverlayNpcs') this.overlays.npcs = !this.overlays.npcs;
          else if (action === 'toggleOverlayMobSpawns') this.overlays.mobSpawns = !this.overlays.mobSpawns;
          else if (action === 'toggleOverlayDungeons') this.overlays.dungeons = !this.overlays.dungeons;
          this.refreshStatus();
        },

        refreshOverlayButtons() {
          if (!this.panel) return;
          const labels = { toggleOverlayAttributes: ['Attributes', 'attributes'], toggleOverlayResources: ['Resources', 'resources'], toggleOverlayEvents: ['Events', 'events'], toggleOverlayNpcs: ['NPCs', 'npcs'], toggleOverlayMobSpawns: ['Mob Spawns', 'mobSpawns'], toggleOverlayDungeons: ['Dungeons', 'dungeons'] };
          for (const [action, [label, key]] of Object.entries(labels)) {
            const button = this.panel.querySelector(`[data-editor-action="${action}"]`);
            if (!button) continue;
            const on = this.overlays[key] !== false;
            button.textContent = `${label}: ${on ? 'On' : 'Off'}`;
            button.classList.toggle('active', on);
          }
        },

        runQuestAction(action) {
          if (action === 'new') this.createQuestDraft();
          else if (action === 'edit') this.editSelectedQuest();
          else if (action === 'delete') this.deleteSelectedQuest();
          else if (action === 'assign' && (this.selected || this.hovered)) this.assignQuestHookAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedQuestId);
          this.refreshPanel();
        },

        runItemAction(action) {
          if (action === 'new') this.createItemDraft();
          else if (action === 'edit') this.editSelectedItem();
          else if (action === 'duplicate') this.duplicateSelectedItem();
          else if (action === 'delete') this.deleteSelectedItem();
          this.refreshPanel();
        },

        runLootAction(action) {
          if (action === 'new') this.createLootTableDraft();
          else if (action === 'edit') this.editSelectedLootTable();
          else if (action === 'duplicate') this.duplicateSelectedLootTable();
          else if (action === 'delete') this.deleteSelectedLootTable();
          else if (action === 'assign' && (this.selected || this.hovered)) this.assignLootTableAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedLootTableId);
          this.refreshPanel();
        },

        runSpellAction(action) {
          if (action === 'new') this.createSpellDraft();
          else if (action === 'edit') this.editSelectedSpell();
          else if (action === 'duplicate') this.duplicateSelectedSpell();
          else if (action === 'delete') this.deleteSelectedSpell();
          else if (action === 'assign') this.assignSelectedSpellToClassSlot();
          this.refreshPanel();
        },

        runResourceAction(action) {
          if (action === 'new') this.createResourceTypeDraft();
          else if (action === 'edit') this.editSelectedResourceType();
          else if (action === 'duplicate') this.duplicateSelectedResourceType();
          else if (action === 'delete') this.deleteSelectedResourceType();
          this.refreshPanel();
        },

        runNpcAction(action) {
          if (action === 'new') this.createNpcDraft();
          else if (action === 'edit') this.editSelectedNpc();
          else if (action === 'duplicate') this.duplicateSelectedNpc();
          else if (action === 'delete') this.deleteSelectedNpc();
          else if (action === 'place' && (this.selected || this.hovered)) this.setNpcAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedNpcId);
          else if (action === 'erase' && (this.selected || this.hovered)) this.clearNpcAt((this.selected || this.hovered).x, (this.selected || this.hovered).y);
          else if (action === 'assignQuest' && (this.selected || this.hovered)) this.assignNpcQuestAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedQuestId);
          else if (action === 'assignShop' && (this.selected || this.hovered)) this.assignNpcShopAt((this.selected || this.hovered).x, (this.selected || this.hovered).y);
          else if (action === 'assignDialogue' && (this.selected || this.hovered)) this.assignNpcDialogueAt((this.selected || this.hovered).x, (this.selected || this.hovered).y);
          this.refreshPanel();
        },

        runMobAction(action) {
          if (action === 'newMob') this.createMobDraft();
          else if (action === 'editMob') this.editSelectedMob();
          else if (action === 'duplicateMob') this.duplicateSelectedMob();
          else if (action === 'deleteMob') this.deleteSelectedMob();
          else if (action === 'newSpawn') this.createMobSpawnDraft();
          else if (action === 'editSpawn') this.editSelectedMobSpawn();
          else if (action === 'duplicateSpawn') this.duplicateSelectedMobSpawn();
          else if (action === 'deleteSpawn') this.deleteSelectedMobSpawn();
          else if (action === 'placeSpawn' && (this.selected || this.hovered)) this.setMobSpawnAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedMobSpawnId);
          else if (action === 'eraseSpawn' && (this.selected || this.hovered)) this.clearMobSpawnAt((this.selected || this.hovered).x, (this.selected || this.hovered).y);
          else if (action === 'assignLoot' && (this.selected || this.hovered)) this.assignMobLootAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedLootTableId);
          this.refreshPanel();
        },

        runDungeonAction(action) {
          if (action === 'newDungeon') this.createDungeonDraft();
          else if (action === 'editDungeon') this.editSelectedDungeon();
          else if (action === 'duplicateDungeon') this.duplicateSelectedDungeon();
          else if (action === 'deleteDungeon') this.deleteSelectedDungeon();
          else if (action === 'newPuzzle') this.createPuzzleDraft();
          else if (action === 'editPuzzle') this.editSelectedPuzzle();
          else if (action === 'duplicatePuzzle') this.duplicateSelectedPuzzle();
          else if (action === 'deletePuzzle') this.deleteSelectedPuzzle();
          else if (action === 'placeEntrance' && (this.selected || this.hovered)) this.setDungeonMarkerAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, 'entrance');
          else if (action === 'eraseMarker' && (this.selected || this.hovered)) this.clearDungeonMarkerAt((this.selected || this.hovered).x, (this.selected || this.hovered).y);
          else if (action === 'assignLoot' && (this.selected || this.hovered)) this.assignDungeonLootAt((this.selected || this.hovered).x, (this.selected || this.hovered).y, this.selectedLootTableId);
          this.refreshPanel();
        },

        runCraftingAction(action) {
          if (action === 'new') this.createRecipeDraft();
          else if (action === 'edit') this.editSelectedRecipe();
          else if (action === 'duplicate') this.duplicateSelectedRecipe();
          else if (action === 'delete') this.deleteSelectedRecipe();
          else if (action === 'assign') this.assignSelectedRecipeToStation();
          this.refreshPanel();
        },

        toggle(force) {
          this.active = typeof force === 'boolean' ? force : !this.active;
          if (this.panel) this.panel.classList.toggle('active', this.active);
          this.syncLayeredMapEditor();
          this.refreshPanel();
          if (this.game.started) this.game.log(this.active ? 'Editor mode enabled.' : 'Editor mode disabled.');
        },

        syncLayeredMapEditor() {
          const layered = this.game.layeredMapEditor;
          if (!layered) return;
          const enabled = this.active && this.tab === 'layeredMap';
          layered.setEnabledFromEditor?.(enabled);
          layered.setActiveFromEditor?.(enabled);
          if (enabled && this.palette) layered.buildEditorTabUi?.(this.palette);
        },

        activeSize() {
          const size = this.game.map?.length || CONFIG.MAP_SIZE || 200;
          return Math.max(1, size);
        },

        resolveTileRef(x, y) {
          const size = this.activeSize();
          const tx = Math.max(0, Math.min(size - 1, Math.floor(x)));
          const ty = Math.max(0, Math.min(size - 1, Math.floor(y)));
          const tile = this.game.map?.[ty]?.[tx] || null;
          const obj = this.game.objects?.[ty]?.[tx] || null;
          return {
            zone: this.game.currentZone || 'overworld',
            x: tx,
            y: ty,
            tile,
            obj,
            blocked: Boolean(tile?.blocked)
          };
        },

        isDragPaintTool() {
          return ['Paint Tile', 'Place Object', 'Erase Object', 'Raise', 'Lower', 'Block', 'Unblock', 'NPC Avoid', 'No Mob Spawn', 'Safe Zone', 'Meditation Garden', 'Warp', 'Clear Attribute', 'Cave Floor', 'Cave Wall', 'Place Resource', 'Erase Resource', 'Herb Node', 'Mining Node', 'Fishing Spot', 'Chest Spawn', 'Place Event', 'Erase Event', 'Event Marker', 'Dialogue', 'Chest', 'Quest Hook', 'Shop Event', 'Warp Event', 'Place Quest Hook', 'Assign Quest Hook', 'Place NPC', 'Erase NPC', 'Assign Quest', 'Assign Shop', 'Assign Dialogue', 'Place Spawn', 'Erase Spawn', 'Assign Mob Loot', 'Place Station', 'Erase Station'].includes(this.tool);
        },

        applyTool(ref) {
          if (!ref || !ref.tile) return;
          const key = `${this.tool}:${ref.x}:${ref.y}:${this.brushSize}`;
          if (this.paintDown && this.lastPaintKey === key && this.isDragPaintTool()) return;
          this.lastPaintKey = key;

          if (this.tool === 'Select') {
            this.game.log(`Editor selected ${ref.zone} ${ref.x},${ref.y}.`);
            return;
          }
          if (this.tool === 'Paint Tile') return this.paintBrush(ref, tile => this.setTile(tile.x, tile.y, this.selectedTileType));
          if (this.tool === 'Cave Floor') return this.paintBrush(ref, tile => this.setTile(tile.x, tile.y, TILE.CAVE_FLOOR));
          if (this.tool === 'Cave Wall') return this.paintBrush(ref, tile => this.setTile(tile.x, tile.y, TILE.CAVE_WALL));
          if (this.tool === 'Raise') return this.paintBrush(ref, tile => this.raiseTile(tile.x, tile.y, 1));
          if (this.tool === 'Lower') return this.paintBrush(ref, tile => this.raiseTile(tile.x, tile.y, -1));
          if (this.tool === 'Block') return this.paintBrush(ref, tile => this.setAttributeAt(tile.x, tile.y, { block: true, unblock: false }));
          if (this.tool === 'Unblock') return this.paintBrush(ref, tile => this.setAttributeAt(tile.x, tile.y, { unblock: true, block: false }));
          if (this.tool === 'NPC Avoid') return this.paintBrush(ref, tile => this.setAttributeAt(tile.x, tile.y, { npcAvoid: true }));
          if (this.tool === 'No Mob Spawn') return this.paintBrush(ref, tile => this.setAttributeAt(tile.x, tile.y, { noMobSpawn: true }));
          if (this.tool === 'Safe Zone') return this.paintBrush(ref, tile => this.setAttributeAt(tile.x, tile.y, { safeZone: true, noMobSpawn: true }));
          if (this.tool === 'Meditation Garden') return this.paintBrush(ref, tile => this.setAttributeAt(tile.x, tile.y, { meditationGarden: true, safeZone: true, noMobSpawn: true }));
          if (this.tool === 'Warp') return this.paintBrush(ref, tile => this.setWarpAt(tile.x, tile.y));
          if (this.tool === 'Clear Attribute') return this.paintBrush(ref, tile => this.clearAttributeAt(tile.x, tile.y));
          if (this.tool === 'Place Object') return this.paintBrush(ref, tile => this.placeObjectAt(tile.x, tile.y, this.selectedObjectType));
          if (this.tool === 'Erase Object') return this.paintBrush(ref, tile => this.placeObjectAt(tile.x, tile.y, 'none'));
          if (this.tool === 'Place Station') return this.paintBrush(ref, tile => this.setCraftingStationAt(tile.x, tile.y, this.selectedStationId));
          if (this.tool === 'Erase Station') return this.paintBrush(ref, tile => this.clearCraftingStationAt(tile.x, tile.y));
          if (this.tool === 'Eyedropper Station') return this.pickCraftingStation(ref);
          if (this.tool === 'Eyedropper') return this.pickTile(ref);
          if (this.tool === 'Eyedropper Object') return this.pickObject(ref);
          if (this.tool === 'Fill') return this.fillTile(ref);
          if (this.tool === 'Rectangle') return this.rectangleTile(ref);
          if (this.tool === 'Cave Properties') return this.editCaveProperties();
          if (this.tool === 'Generate Small Cave') return this.generateCavePreset('small');
          if (this.tool === 'Generate Big Cave') return this.generateCavePreset('big');
          if (this.tool === 'Generate Large Cave') return this.generateCavePreset('large');
          if (this.tool === 'Cave Room') return this.carveCaveRoom(ref);
          if (this.tool === 'Cave Tunnel') return this.carveCaveTunnel(ref);
          if (this.tool === 'Cave Entrance') return this.singleCellEdit(ref, 'Placed cave entrance.', () => this.placeObjectAt(ref.x, ref.y, 'cave', true));
          if (this.tool === 'Cave Exit') return this.singleCellEdit(ref, 'Placed cave exit.', () => this.placeObjectAt(ref.x, ref.y, 'caveExit', true));
          if (this.tool === 'Zone Exit') return this.singleCellEdit(ref, 'Placed zone exit marker.', () => this.setWarpAt(ref.x, ref.y));
          if (this.tool === 'Spawn Point') return this.singleCellEdit(ref, 'Placed spawn point marker.', () => this.setSpawnPointAt(ref.x, ref.y));
          if (this.tool === 'Place Resource') return this.paintBrush(ref, tile => this.setResourceAt(tile.x, tile.y, this.selectedResourceType));
          if (this.tool === 'Erase Resource') return this.paintBrush(ref, tile => this.clearResourceAt(tile.x, tile.y));
          if (this.tool === 'Herb Node') return this.paintBrush(ref, tile => this.setResourceAt(tile.x, tile.y, this.pickResourceByCategory('herb')));
          if (this.tool === 'Mining Node') return this.paintBrush(ref, tile => this.setResourceAt(tile.x, tile.y, this.pickResourceByCategory('mining')));
          if (this.tool === 'Fishing Spot') return this.paintBrush(ref, tile => this.setResourceAt(tile.x, tile.y, this.pickResourceByCategory('fishing')));
          if (this.tool === 'Chest Spawn') return this.paintBrush(ref, tile => this.setResourceAt(tile.x, tile.y, this.pickResourceByCategory('chest')));
          if (this.tool === 'Eyedropper Resource') return this.pickResource(ref);
          if (this.tool === 'Place Event') return this.paintBrush(ref, tile => this.setEventAt(tile.x, tile.y, this.selectedEventType));
          if (this.tool === 'Erase Event') return this.paintBrush(ref, tile => this.clearEventAt(tile.x, tile.y));
          if (this.tool === 'Event Marker') return this.paintBrush(ref, tile => this.setEventAt(tile.x, tile.y, 'event_marker'));
          if (this.tool === 'Dialogue') return this.paintBrush(ref, tile => this.setEventAt(tile.x, tile.y, 'dialogue'));
          if (this.tool === 'Chest') return this.paintBrush(ref, tile => this.setEventAt(tile.x, tile.y, 'chest_event'));
          if (this.tool === 'Quest Hook') return this.paintBrush(ref, tile => this.setQuestHookAt(tile.x, tile.y, this.selectedQuestId));
          if (this.tool === 'Shop Event') return this.paintBrush(ref, tile => this.setEventAt(tile.x, tile.y, 'shop_event'));
          if (this.tool === 'Warp Event') return this.paintBrush(ref, tile => this.setEventAt(tile.x, tile.y, 'warp_event'));
          if (this.tool === 'Eyedropper Event') return this.pickEvent(ref);
          if (this.tool === 'Place Quest Hook') return this.paintBrush(ref, tile => this.setQuestHookAt(tile.x, tile.y, this.selectedQuestId));
          if (this.tool === 'Assign Quest Hook') return this.singleCellEdit(ref, 'Assigned quest hook.', () => this.assignQuestHookAt(ref.x, ref.y, this.selectedQuestId));
          if (this.tool === 'Eyedropper Quest') return this.pickQuest(ref);
          if (this.tool === 'NPC Browser') return this.game.log(this.npcSummary(this.selectedNpc()));
          if (this.tool === 'New NPC') return this.createNpcDraft();
          if (this.tool === 'Edit NPC') return this.editSelectedNpc();
          if (this.tool === 'Duplicate NPC') return this.duplicateSelectedNpc();
          if (this.tool === 'Delete NPC') return this.deleteSelectedNpc();
          if (this.tool === 'Place NPC') return this.paintBrush(ref, tile => this.setNpcAt(tile.x, tile.y, this.selectedNpcId));
          if (this.tool === 'Erase NPC') return this.paintBrush(ref, tile => this.clearNpcAt(tile.x, tile.y));
          if (this.tool === 'Eyedropper NPC') return this.pickNpc(ref);
          if (this.tool === 'Assign Quest') return this.singleCellEdit(ref, 'Assigned quest to NPC marker.', () => this.assignNpcQuestAt(ref.x, ref.y, this.selectedQuestId));
          if (this.tool === 'Assign Shop') return this.singleCellEdit(ref, 'Assigned shop to NPC marker.', () => this.assignNpcShopAt(ref.x, ref.y));
          if (this.tool === 'Assign Dialogue') return this.singleCellEdit(ref, 'Assigned dialogue to NPC marker.', () => this.assignNpcDialogueAt(ref.x, ref.y));
          if (this.tool === 'Mob Browser') return this.game.log(this.mobSummary(this.selectedMob()));
          if (this.tool === 'New Mob') return this.createMobDraft();
          if (this.tool === 'Edit Mob') return this.editSelectedMob();
          if (this.tool === 'Duplicate Mob') return this.duplicateSelectedMob();
          if (this.tool === 'Delete Mob') return this.deleteSelectedMob();
          if (this.tool === 'Spawn Browser') return this.game.log(this.mobSpawnSummary(this.selectedMobSpawn()));
          if (this.tool === 'New Spawn') return this.createMobSpawnDraft();
          if (this.tool === 'Edit Spawn') return this.editSelectedMobSpawn();
          if (this.tool === 'Duplicate Spawn') return this.duplicateSelectedMobSpawn();
          if (this.tool === 'Delete Spawn') return this.deleteSelectedMobSpawn();
          if (this.tool === 'Place Spawn') return this.paintBrush(ref, tile => this.setMobSpawnAt(tile.x, tile.y, this.selectedMobSpawnId));
          if (this.tool === 'Erase Spawn') return this.paintBrush(ref, tile => this.clearMobSpawnAt(tile.x, tile.y));
          if (this.tool === 'Eyedropper Spawn') return this.pickMobSpawn(ref);
          if (this.tool === 'Assign Mob Loot') return this.singleCellEdit(ref, 'Assigned loot table to mob spawn marker.', () => this.assignMobLootAt(ref.x, ref.y, this.selectedLootTableId));
          if (this.tool === 'Dungeon Browser') return this.game.log(this.dungeonSummary(this.selectedDungeon()));
          if (this.tool === 'New Dungeon') return this.createDungeonDraft();
          if (this.tool === 'Edit Dungeon') return this.editSelectedDungeon();
          if (this.tool === 'Duplicate Dungeon') return this.duplicateSelectedDungeon();
          if (this.tool === 'Delete Dungeon') return this.deleteSelectedDungeon();
          if (this.tool === 'Puzzle Browser') return this.game.log(this.puzzleSummary(this.selectedPuzzle()));
          if (this.tool === 'New Puzzle') return this.createPuzzleDraft();
          if (this.tool === 'Edit Puzzle') return this.editSelectedPuzzle();
          if (this.tool === 'Duplicate Puzzle') return this.duplicateSelectedPuzzle();
          if (this.tool === 'Delete Puzzle') return this.deleteSelectedPuzzle();
          if (this.tool === 'Place Dungeon Entrance') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'entrance'));
          if (this.tool === 'Erase Dungeon Marker') return this.paintBrush(ref, tile => this.clearDungeonMarkerAt(tile.x, tile.y));
          if (this.tool === 'Eyedropper Dungeon') return this.pickDungeonMarker(ref);
          if (this.tool === 'Boss Room') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'bossRoom'));
          if (this.tool === 'Puzzle Marker') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'puzzle'));
          if (this.tool === 'Lock Marker') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'lock'));
          if (this.tool === 'Key Marker') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'key'));
          if (this.tool === 'Door Marker') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'door'));
          if (this.tool === 'Treasure Room') return this.paintBrush(ref, tile => this.setDungeonMarkerAt(tile.x, tile.y, 'treasureRoom'));
          if (this.tool === 'Assign Dungeon Loot') return this.singleCellEdit(ref, 'Assigned loot table to dungeon marker.', () => this.assignDungeonLootAt(ref.x, ref.y, this.selectedLootTableId));
          if (this.tool === 'New Quest') return this.createQuestDraft();
          if (this.tool === 'Edit Quest') return this.editSelectedQuest();
          if (this.tool === 'Delete Quest') return this.deleteSelectedQuest();
          if (this.tool === 'Item Browser') return this.game.log(this.itemSummary(this.selectedItem()));
          if (this.tool === 'New Item') return this.createItemDraft();
          if (this.tool === 'Edit Item') return this.editSelectedItem();
          if (this.tool === 'Duplicate Item') return this.duplicateSelectedItem();
          if (this.tool === 'Delete Item') return this.deleteSelectedItem();
          if (this.tool === 'Loot Table Browser') return this.game.log(this.lootTableSummary(this.selectedLootTable()));
          if (this.tool === 'New Loot Table') return this.createLootTableDraft();
          if (this.tool === 'Edit Loot Table') return this.editSelectedLootTable();
          if (this.tool === 'Duplicate Loot Table') return this.duplicateSelectedLootTable();
          if (this.tool === 'Delete Loot Table') return this.deleteSelectedLootTable();
          if (this.tool === 'Assign Loot Table') return this.singleCellEdit(ref, 'Assigned loot table.', () => this.assignLootTableAt(ref.x, ref.y, this.selectedLootTableId));
          if (this.tool === 'Spell Browser') return this.game.log(this.spellSummary(this.selectedSpell()));
          if (this.tool === 'New Spell') return this.createSpellDraft();
          if (this.tool === 'Edit Spell') return this.editSelectedSpell();
          if (this.tool === 'Duplicate Spell') return this.duplicateSelectedSpell();
          if (this.tool === 'Delete Spell') return this.deleteSelectedSpell();
          if (this.tool === 'Assign Class Slot') return this.assignSelectedSpellToClassSlot();
          if (this.tool === 'Resource Browser') return this.game.log(this.resourceSummary(this.selectedResourceTypeDef()));
          if (this.tool === 'New Resource') return this.createResourceTypeDraft();
          if (this.tool === 'Edit Resource') return this.editSelectedResourceType();
          if (this.tool === 'Duplicate Resource') return this.duplicateSelectedResourceType();
          if (this.tool === 'Delete Resource') return this.deleteSelectedResourceType();
          if (this.tool === 'Recipe Browser') return this.game.log(this.recipeSummary(this.selectedRecipe()));
          if (this.tool === 'New Recipe') return this.createRecipeDraft();
          if (this.tool === 'Edit Recipe') return this.editSelectedRecipe();
          if (this.tool === 'Duplicate Recipe') return this.duplicateSelectedRecipe();
          if (this.tool === 'Delete Recipe') return this.deleteSelectedRecipe();
          if (this.tool === 'Assign Station') return this.assignSelectedRecipeToStation();
          if (this.tool === 'Place Station') return this.paintBrush(ref, tile => this.setCraftingStationAt(tile.x, tile.y, this.selectedStationId));
          if (this.tool === 'Erase Station') return this.paintBrush(ref, tile => this.clearCraftingStationAt(tile.x, tile.y));
          if (this.tool === 'Eyedropper Station') return this.pickCraftingStation(ref);
          if (this.tool === 'Level Range') return this.editLevelRange();
          if (this.tool === 'Zone Properties') return this.editZoneProperties();

          this.game.log(`${this.tool} is reserved for a later editor pass.`);
        },

        brushCoords(ref) {
          const coords = [];
          const radius = Math.floor((this.brushSize - 1) / 2);
          for (let y = ref.y - radius; y <= ref.y + radius; y++) {
            for (let x = ref.x - radius; x <= ref.x + radius; x++) {
              if (this.game.map?.[y]?.[x]) coords.push({ x, y });
            }
          }
          return coords;
        },

        paintBrush(ref, fn) {
          const coords = this.brushCoords(ref);
          const snapshot = this.beginHistory(`${this.tool} brush`, coords);
          let changed = 0;
          for (const coord of coords) {
            if (fn(coord) !== false) changed++;
          }
          if (this.commitHistory(snapshot)) {
            this.afterEdit(`${this.tool} edited ${changed} tile${changed === 1 ? '' : 's'}.`);
          }
        },

        singleCellEdit(ref, label, fn) {
          const snapshot = this.beginHistory(label, [{ x: ref.x, y: ref.y }]);
          fn();
          if (this.commitHistory(snapshot)) this.afterEdit(label);
        },

        setTile(x, y, type) {
          const tile = this.game.map?.[y]?.[x];
          if (!tile) return false;
          tile.type = Number(type);
          this.syncBlockedAt(x, y);
          this.game.invalidateTerrainChunkAt?.(x, y, 'editor tile paint');
          return true;
        },

        raiseTile(x, y, delta) {
          const tile = this.game.map?.[y]?.[x];
          if (!tile) return false;
          tile.elev = clamp((Number(tile.elev) || 0) + delta, 0, 7);
          this.game.invalidateTerrainChunkAt?.(x, y, 'editor elevation change');
          return true;
        },

        setBlocked(x, y, blocked) {
          const tile = this.game.map?.[y]?.[x];
          if (!tile) return false;
          tile.blocked = Boolean(blocked);
          return true;
        },

        placeObjectAt(x, y, objectType, silent = false) {
          if (!this.game.objects?.[y]) return false;
          if (objectType === 'none') {
            this.game.objects[y][x] = null;
            this.syncBlockedAt(x, y);
            if (!silent) this.singleCellEdit({ x, y }, `Erased object at ${x},${y}.`, () => {});
            return true;
          }
          const entry = objectEntries.find(item => item.type === objectType);
          if (!entry) return false;
          this.game.objects[y][x] = cloneObjectTemplate(entry);
          this.syncBlockedAt(x, y);
          if (!silent) this.game.log(`Placed ${entry.name} at ${x},${y}.`);
          return true;
        },

        pickTile(ref) {
          if (!ref.tile) return;
          this.selectedTileType = ref.tile.type;
          this.tool = 'Paint Tile';
          this.tab = 'tiles';
          this.game.log(`Picked tile: ${tileName(ref.tile)}.`);
          this.refreshPanel();
        },

        pickObject(ref) {
          this.selectedObjectType = ref.obj?.type || 'none';
          this.tool = this.selectedObjectType === 'none' ? 'Erase Object' : 'Place Object';
          this.tab = 'objects';
          this.game.log(`Picked object: ${objectName(ref.obj)}.`);
          this.refreshPanel();
        },

        fillTile(ref) {
          if (!ref.tile) return;
          const oldType = ref.tile.type;
          const newType = this.selectedTileType;
          if (oldType === newType) return;
          const size = this.activeSize();
          const stack = [{ x: ref.x, y: ref.y }];
          const seen = new Set();
          const coords = [];
          const maxFill = 2400;
          while (stack.length && coords.length < maxFill) {
            const p = stack.pop();
            const key = `${p.x},${p.y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const tile = this.game.map?.[p.y]?.[p.x];
            if (!tile || tile.type !== oldType) continue;
            coords.push({ x: p.x, y: p.y });
            if (p.x > 0) stack.push({ x: p.x - 1, y: p.y });
            if (p.x < size - 1) stack.push({ x: p.x + 1, y: p.y });
            if (p.y > 0) stack.push({ x: p.x, y: p.y - 1 });
            if (p.y < size - 1) stack.push({ x: p.x, y: p.y + 1 });
          }
          const snapshot = this.beginHistory('Fill tile paint', coords);
          let changed = 0;
          for (const coord of coords) {
            if (this.setTile(coord.x, coord.y, newType)) changed++;
          }
          if (this.commitHistory(snapshot)) this.afterEdit(`Fill painted ${changed} tile${changed === 1 ? '' : 's'}.`);
        },

        rectangleTile(ref) {
          if (!this.rectAnchor) {
            this.rectAnchor = { x: ref.x, y: ref.y };
            this.game.log(`Rectangle anchor set at ${ref.x},${ref.y}. Click second corner to paint.`);
            return;
          }
          const x1 = Math.min(this.rectAnchor.x, ref.x);
          const x2 = Math.max(this.rectAnchor.x, ref.x);
          const y1 = Math.min(this.rectAnchor.y, ref.y);
          const y2 = Math.max(this.rectAnchor.y, ref.y);
          const coords = [];
          for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
              if (this.game.map?.[y]?.[x]) coords.push({ x, y });
            }
          }
          const snapshot = this.beginHistory('Rectangle tile paint', coords);
          let changed = 0;
          for (const coord of coords) {
            if (this.setTile(coord.x, coord.y, this.selectedTileType)) changed++;
          }
          this.rectAnchor = null;
          if (this.commitHistory(snapshot)) this.afterEdit(`Rectangle painted ${changed} tile${changed === 1 ? '' : 's'}.`);
        },

        currentZoneKey() {
          return this.game.currentZone === 'cave' ? 'mossfang_cave' : 'dark_woods';
        },

        ensureEditorMetadata() {
          if (!this.game.editorAttributes || typeof this.game.editorAttributes !== 'object') this.game.editorAttributes = {};
          if (!this.game.editorAttributes.dark_woods) this.game.editorAttributes.dark_woods = {};
          if (!this.game.editorAttributes.mossfang_cave) this.game.editorAttributes.mossfang_cave = {};
          if (!this.game.editorSpawnPoints || typeof this.game.editorSpawnPoints !== 'object') this.game.editorSpawnPoints = {};
          if (!this.game.editorResources || typeof this.game.editorResources !== 'object') this.game.editorResources = {};
          if (!this.game.editorResources.dark_woods) this.game.editorResources.dark_woods = {};
          if (!this.game.editorResources.mossfang_cave) this.game.editorResources.mossfang_cave = {};
          if (!this.game.editorResourceTypes || typeof this.game.editorResourceTypes !== 'object') this.game.editorResourceTypes = JSON.parse(JSON.stringify(RESOURCE_BY_ID || {}));
          for (const resource of resourceEntries) {
            if (resource?.id && !this.game.editorResourceTypes[resource.id]) this.game.editorResourceTypes[resource.id] = JSON.parse(JSON.stringify(resource));
          }
          if (!this.game.editorEvents || typeof this.game.editorEvents !== 'object') this.game.editorEvents = {};
          if (!this.game.editorEvents.dark_woods) this.game.editorEvents.dark_woods = {};
          if (!this.game.editorEvents.mossfang_cave) this.game.editorEvents.mossfang_cave = {};
          if (!this.game.editorNpcs || typeof this.game.editorNpcs !== 'object') this.game.editorNpcs = {};
          if (!this.game.editorNpcs.dark_woods) this.game.editorNpcs.dark_woods = {};
          if (!this.game.editorNpcs.mossfang_cave) this.game.editorNpcs.mossfang_cave = {};
          if (!this.game.editorMobSpawns || typeof this.game.editorMobSpawns !== 'object') this.game.editorMobSpawns = {};
          if (!this.game.editorMobSpawns.dark_woods) this.game.editorMobSpawns.dark_woods = {};
          if (!this.game.editorMobSpawns.mossfang_cave) this.game.editorMobSpawns.mossfang_cave = {};
          if (!this.game.editorNpcDefinitions || typeof this.game.editorNpcDefinitions !== 'object') this.game.editorNpcDefinitions = JSON.parse(JSON.stringify(NPC_DRAFT_BY_ID || {}));
          for (const npc of npcEntries) {
            if (npc?.id && !this.game.editorNpcDefinitions[npc.id]) this.game.editorNpcDefinitions[npc.id] = JSON.parse(JSON.stringify(npc));
          }
          if (!this.game.editorMobDefinitions || typeof this.game.editorMobDefinitions !== 'object') this.game.editorMobDefinitions = JSON.parse(JSON.stringify(MOB_DRAFT_BY_ID || {}));
          for (const mob of mobEntries) {
            if (mob?.id && !this.game.editorMobDefinitions[mob.id]) this.game.editorMobDefinitions[mob.id] = JSON.parse(JSON.stringify(mob));
          }
          if (!this.game.editorMobSpawnDefinitions || typeof this.game.editorMobSpawnDefinitions !== 'object') this.game.editorMobSpawnDefinitions = JSON.parse(JSON.stringify(MOB_SPAWN_BY_ID || {}));
          for (const spawn of mobSpawnEntries) {
            if (spawn?.id && !this.game.editorMobSpawnDefinitions[spawn.id]) this.game.editorMobSpawnDefinitions[spawn.id] = JSON.parse(JSON.stringify(spawn));
          }
          if (!this.game.editorDungeons || typeof this.game.editorDungeons !== 'object') this.game.editorDungeons = JSON.parse(JSON.stringify(DUNGEON_BY_ID || {}));
          for (const dungeon of dungeonEntries) {
            if (dungeon?.id && !this.game.editorDungeons[dungeon.id]) this.game.editorDungeons[dungeon.id] = JSON.parse(JSON.stringify(dungeon));
          }
          if (!this.game.editorPuzzles || typeof this.game.editorPuzzles !== 'object') this.game.editorPuzzles = JSON.parse(JSON.stringify(PUZZLE_BY_ID || {}));
          for (const puzzle of puzzleEntries) {
            if (puzzle?.id && !this.game.editorPuzzles[puzzle.id]) this.game.editorPuzzles[puzzle.id] = JSON.parse(JSON.stringify(puzzle));
          }
          if (!this.game.editorDungeonMarkers || typeof this.game.editorDungeonMarkers !== 'object') this.game.editorDungeonMarkers = {};
          if (!this.game.editorDungeonMarkers.dark_woods) this.game.editorDungeonMarkers.dark_woods = {};
          if (!this.game.editorDungeonMarkers.mossfang_cave) this.game.editorDungeonMarkers.mossfang_cave = {};
          if (!this.game.editorQuests || typeof this.game.editorQuests !== 'object') this.game.editorQuests = JSON.parse(JSON.stringify(QUEST_BY_ID || {}));
          for (const quest of questEntries) {
            if (quest?.id && !this.game.editorQuests[quest.id]) this.game.editorQuests[quest.id] = JSON.parse(JSON.stringify(quest));
          }
          if (!this.game.editorItems || typeof this.game.editorItems !== 'object') this.game.editorItems = JSON.parse(JSON.stringify(ITEM_BY_ID || {}));
          for (const item of itemEntries) {
            if (item?.id && !this.game.editorItems[item.id]) this.game.editorItems[item.id] = JSON.parse(JSON.stringify(item));
          }
          if (!this.game.editorLootTables || typeof this.game.editorLootTables !== 'object') this.game.editorLootTables = JSON.parse(JSON.stringify(LOOT_TABLE_BY_ID || {}));
          for (const table of lootTableEntries) {
            if (table?.id && !this.game.editorLootTables[table.id]) this.game.editorLootTables[table.id] = JSON.parse(JSON.stringify(table));
          }
          if (!this.game.editorSpells || typeof this.game.editorSpells !== 'object') this.game.editorSpells = JSON.parse(JSON.stringify(SPELL_BY_ID || {}));
          for (const spell of spellEntries) {
            if (spell?.id && !this.game.editorSpells[spell.id]) this.game.editorSpells[spell.id] = JSON.parse(JSON.stringify(spell));
          }
          if (!this.game.classSpellSlots || typeof this.game.classSpellSlots !== 'object') this.game.classSpellSlots = {};
          if (!this.game.editorProfessions || typeof this.game.editorProfessions !== 'object') this.game.editorProfessions = JSON.parse(JSON.stringify(PROFESSION_BY_ID || {}));
          for (const profession of professionEntries) {
            if (profession?.id && !this.game.editorProfessions[profession.id]) this.game.editorProfessions[profession.id] = JSON.parse(JSON.stringify(profession));
          }
          if (!this.game.editorCraftingStations || typeof this.game.editorCraftingStations !== 'object') this.game.editorCraftingStations = JSON.parse(JSON.stringify(CRAFTING_STATION_BY_ID || {}));
          for (const station of craftingStationEntries) {
            if (station?.id && !this.game.editorCraftingStations[station.id]) this.game.editorCraftingStations[station.id] = JSON.parse(JSON.stringify(station));
          }
          if (!this.game.editorRecipes || typeof this.game.editorRecipes !== 'object') this.game.editorRecipes = JSON.parse(JSON.stringify(CRAFTING_RECIPE_BY_ID || {}));
          for (const recipe of recipeEntries) {
            if (recipe?.id && !this.game.editorRecipes[recipe.id]) this.game.editorRecipes[recipe.id] = JSON.parse(JSON.stringify(recipe));
          }
          if (!this.game.classSpellSlots || typeof this.game.classSpellSlots !== 'object') this.game.classSpellSlots = {};
          for (const spell of Object.values(this.game.editorSpells || {})) {
            if (!spell || !spell.className) continue;
            if (!Array.isArray(this.game.classSpellSlots[spell.className])) this.game.classSpellSlots[spell.className] = [];
            const slot = Math.max(0, Math.floor(Number(spell.slotIndex) || 0));
            if (!this.game.classSpellSlots[spell.className][slot]) this.game.classSpellSlots[spell.className][slot] = spell.id;
          }
          if (!this.game.zoneProperties || typeof this.game.zoneProperties !== 'object') this.game.zoneProperties = {};
          if (!this.game.zoneProperties.dark_woods) this.game.zoneProperties.dark_woods = { levelMin: 1, levelMax: 10, weather: 'forest_mist', music: 'dark_woods' };
          if (!this.game.zoneProperties.mossfang_cave) this.game.zoneProperties.mossfang_cave = { levelMin: 1, levelMax: 8, weather: 'none', music: 'cave_ambience' };
          if (!this.game.caveEditorMeta || typeof this.game.caveEditorMeta !== 'object') this.game.caveEditorMeta = {};
          if (!this.game.caveEditorMeta.mossfang_cave) {
            this.game.caveEditorMeta.mossfang_cave = {
              name: 'Mossfang Cave',
              theme: 'mossfang',
              size: 'big',
              floors: 1,
              mobFamily: 'cave_wolves',
              notes: 'Starter cave attached to Dark Woods.'
            };
          }
        },

        attrKey(x, y) {
          return `${Math.floor(x)},${Math.floor(y)}`;
        },

        currentAttrGrid() {
          this.ensureEditorMetadata();
          const key = this.currentZoneKey();
          if (!this.game.editorAttributes[key]) this.game.editorAttributes[key] = {};
          return this.game.editorAttributes[key];
        },

        getAttrAt(x, y, zoneKey = this.currentZoneKey()) {
          this.ensureEditorMetadata();
          return this.game.editorAttributes?.[zoneKey]?.[this.attrKey(x, y)] || null;
        },

        currentResourceGrid() {
          this.ensureEditorMetadata();
          const key = this.currentZoneKey();
          if (!this.game.editorResources[key]) this.game.editorResources[key] = {};
          return this.game.editorResources[key];
        },

        getResourceAt(x, y, zoneKey = this.currentZoneKey()) {
          this.ensureEditorMetadata();
          return this.game.editorResources?.[zoneKey]?.[this.attrKey(x, y)] || null;
        },

        currentEventGrid() {
          this.ensureEditorMetadata();
          const key = this.currentZoneKey();
          if (!this.game.editorEvents[key]) this.game.editorEvents[key] = {};
          return this.game.editorEvents[key];
        },

        getEventAt(x, y, zoneKey = this.currentZoneKey()) {
          this.ensureEditorMetadata();
          return this.game.editorEvents?.[zoneKey]?.[this.attrKey(x, y)] || null;
        },

        currentNpcGrid() {
          this.ensureEditorMetadata();
          const key = this.currentZoneKey();
          if (!this.game.editorNpcs[key]) this.game.editorNpcs[key] = {};
          return this.game.editorNpcs[key];
        },

        getNpcAt(x, y, zoneKey = this.currentZoneKey()) {
          this.ensureEditorMetadata();
          return this.game.editorNpcs?.[zoneKey]?.[this.attrKey(x, y)] || null;
        },

        currentMobSpawnGrid() {
          this.ensureEditorMetadata();
          const key = this.currentZoneKey();
          if (!this.game.editorMobSpawns[key]) this.game.editorMobSpawns[key] = {};
          return this.game.editorMobSpawns[key];
        },

        getMobSpawnAt(x, y, zoneKey = this.currentZoneKey()) {
          this.ensureEditorMetadata();
          return this.game.editorMobSpawns?.[zoneKey]?.[this.attrKey(x, y)] || null;
        },

        currentDungeonMarkerGrid() {
          this.ensureEditorMetadata();
          const key = this.currentZoneKey();
          if (!this.game.editorDungeonMarkers[key]) this.game.editorDungeonMarkers[key] = {};
          return this.game.editorDungeonMarkers[key];
        },

        getDungeonMarkerAt(x, y, zoneKey = this.currentZoneKey()) {
          this.ensureEditorMetadata();
          return this.game.editorDungeonMarkers?.[zoneKey]?.[this.attrKey(x, y)] || null;
        },

        makeEventNode(eventId, x, y) {
          const def = eventEntries.find(entry => entry.id === eventId) || EVENT_BY_ID[eventId] || eventEntries[0];
          if (!def) return null;
          return {
            id: def.id,
            type: def.id,
            category: def.category || 'generic',
            name: def.name || def.id,
            x,
            y,
            trigger: def.trigger || 'interact',
            commands: def.commands ? JSON.parse(JSON.stringify(def.commands)) : [],
            conditions: def.conditions ? JSON.parse(JSON.stringify(def.conditions)) : [],
            enabled: true,
            lootTableId: def.id === 'chest_event' ? 'loot_common_chest' : null,
            note: def.note || ''
          };
        },

        setEventAt(x, y, eventId) {
          const grid = this.currentEventGrid();
          const node = this.makeEventNode(eventId, x, y);
          if (!node) return false;
          grid[this.attrKey(x, y)] = node;
          return true;
        },

        clearEventAt(x, y) {
          const grid = this.currentEventGrid();
          delete grid[this.attrKey(x, y)];
          return true;
        },

        pickEvent(ref) {
          const node = this.getEventAt(ref.x, ref.y);
          if (!node) {
            this.game.log('No event marker on that tile.');
            return;
          }
          this.selectedEventType = node.type || node.id;
          const def = eventEntries.find(entry => entry.id === this.selectedEventType);
          this.tool = def?.category === 'dialogue' ? 'Dialogue'
            : def?.category === 'chest' ? 'Chest'
            : def?.category === 'quest' ? 'Quest Hook'
            : def?.category === 'shop' ? 'Shop Event'
            : def?.category === 'warp' ? 'Warp Event'
            : 'Place Event';
          this.tab = 'events';
          this.game.log(`Picked event: ${node.name || this.selectedEventType}.`);
          this.refreshPanel();
        },

        currentNpcList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorNpcDefinitions || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedNpc() {
          this.ensureEditorMetadata();
          return this.game.editorNpcDefinitions?.[this.selectedNpcId] || NPC_DRAFT_BY_ID[this.selectedNpcId] || npcEntries[0] || null;
        },

        makeNpcId(name) {
          const base = String(name || 'new npc').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'new_npc';
          let id = base.startsWith('npc_') ? base : `npc_${base}`;
          let finalId = id;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorNpcDefinitions?.[finalId]) finalId = `${id}_${i++}`;
          return finalId;
        },

        cloneNpcDraft(npc) {
          return npc ? JSON.parse(JSON.stringify(npc)) : null;
        },

        createNpcDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('NPC name:', 'New NPC');
          if (!name) return false;
          const role = window.prompt('NPC role:', 'quest_giver') || 'quest_giver';
          const id = this.makeNpcId(name);
          const npc = {
            id,
            name: name.trim(),
            role: role.trim(),
            faction: window.prompt('Faction:', 'Dark Woods Settlement') || 'Dark Woods Settlement',
            level: Number(window.prompt('Level:', '1')) || 1,
            dialogueId: window.prompt('Dialogue id:', `dialogue_${id.replace(/^npc_/, '')}`) || null,
            questIds: [],
            shopId: null,
            trainerClass: null,
            vendorTags: [],
            patrol: { mode: 'stationary', radius: 0, speed: 0 },
            interactionRange: 2.1,
            safeZoneRadius: 3,
            color: '#ffd875',
            label: role === 'merchant' ? '$' : role === 'class_trainer' ? 'T' : 'N',
            notes: 'Created in the Dream Realms NPC editor.'
          };
          this.game.editorNpcDefinitions[id] = npc;
          this.selectedNpcId = id;
          this.markDirty(`Created NPC draft: ${npc.name}.`);
          return true;
        },

        editSelectedNpc() {
          this.ensureEditorMetadata();
          const npc = this.selectedNpc();
          if (!npc) return false;
          const updated = this.cloneNpcDraft(npc);
          updated.name = window.prompt('NPC name:', updated.name || updated.id) || updated.name;
          updated.role = window.prompt('NPC role:', updated.role || 'quest_giver') || updated.role || 'quest_giver';
          updated.faction = window.prompt('Faction:', updated.faction || 'Dark Woods Settlement') || updated.faction || 'Dark Woods Settlement';
          updated.level = Number(window.prompt('Level:', String(updated.level || 1))) || updated.level || 1;
          updated.dialogueId = window.prompt('Dialogue id:', updated.dialogueId || '') || updated.dialogueId || null;
          updated.shopId = window.prompt('Shop id:', updated.shopId || '') || updated.shopId || null;
          const questCsv = window.prompt('Quest ids, comma-separated:', (updated.questIds || []).join(','));
          if (questCsv != null) updated.questIds = questCsv.split(',').map(x => x.trim()).filter(Boolean);
          updated.label = window.prompt('Map label:', updated.label || 'N') || updated.label || 'N';
          updated.notes = window.prompt('Notes:', updated.notes || '') || updated.notes || '';
          this.game.editorNpcDefinitions[updated.id] = updated;
          this.markDirty(`Updated NPC draft: ${updated.name}.`);
          return true;
        },

        duplicateSelectedNpc() {
          this.ensureEditorMetadata();
          const npc = this.selectedNpc();
          if (!npc) return false;
          const copy = this.cloneNpcDraft(npc);
          copy.name = `${copy.name || copy.id} Copy`;
          copy.id = this.makeNpcId(copy.name);
          copy.notes = 'Duplicated in the Dream Realms NPC editor.';
          this.game.editorNpcDefinitions[copy.id] = copy;
          this.selectedNpcId = copy.id;
          this.markDirty(`Duplicated NPC draft: ${copy.name}.`);
          return true;
        },

        deleteSelectedNpc() {
          this.ensureEditorMetadata();
          const npc = this.selectedNpc();
          if (!npc) return false;
          if (!window.confirm(`Delete NPC draft "${npc.name || npc.id}"? Placed markers using this id will remain until erased or reassigned.`)) return false;
          delete this.game.editorNpcDefinitions[npc.id];
          const next = this.currentNpcList()[0];
          this.selectedNpcId = next?.id || 'npc_town_guide';
          this.markDirty(`Deleted NPC draft: ${npc.name || npc.id}.`);
          return true;
        },

        makeNpcNode(npcId, x, y) {
          const def = this.game.editorNpcDefinitions?.[npcId] || NPC_DRAFT_BY_ID[npcId] || npcEntries[0];
          if (!def) return null;
          return {
            id: `${def.id}_${x}_${y}`,
            type: 'npc',
            npcId: def.id,
            name: def.name || def.id,
            role: def.role || 'npc',
            faction: def.faction || 'neutral',
            x,
            y,
            level: Number(def.level) || 1,
            dialogueId: def.dialogueId || null,
            questIds: Array.isArray(def.questIds) ? [...def.questIds] : [],
            shopId: def.shopId || null,
            trainerClass: def.trainerClass || null,
            patrol: def.patrol ? JSON.parse(JSON.stringify(def.patrol)) : { mode: 'stationary', radius: 0, speed: 0 },
            interactionRange: Number(def.interactionRange) || 2.1,
            safeZoneRadius: Number(def.safeZoneRadius) || 0,
            color: def.color || '#ffd875',
            label: def.label || 'N',
            notes: def.notes || ''
          };
        },

        setNpcAt(x, y, npcId) {
          const node = this.makeNpcNode(npcId, x, y);
          if (!node) return false;
          this.currentNpcGrid()[this.attrKey(x, y)] = node;
          return true;
        },

        clearNpcAt(x, y) {
          delete this.currentNpcGrid()[this.attrKey(x, y)];
          return true;
        },

        pickNpc(ref) {
          const node = this.getNpcAt(ref.x, ref.y);
          if (!node) {
            this.game.log('No NPC marker on that tile.');
            return;
          }
          this.selectedNpcId = node.npcId || node.id;
          this.tab = 'npcs';
          this.tool = 'Place NPC';
          this.game.log(`Picked NPC: ${node.name || this.selectedNpcId}.`);
          this.refreshPanel();
        },

        assignNpcQuestAt(x, y, questId) {
          const node = this.getNpcAt(x, y);
          if (!node) return this.setNpcAt(x, y, this.selectedNpcId);
          if (!Array.isArray(node.questIds)) node.questIds = [];
          if (questId && !node.questIds.includes(questId)) node.questIds.push(questId);
          const quest = this.game.editorQuests?.[questId] || QUEST_BY_ID[questId];
          node.questName = quest?.name || questId || null;
          return true;
        },

        assignNpcShopAt(x, y) {
          const node = this.getNpcAt(x, y);
          if (!node) return this.setNpcAt(x, y, this.selectedNpcId);
          const shopId = window.prompt('Shop id for this NPC:', node.shopId || 'shop_camp_basic_goods');
          if (!shopId) return false;
          node.shopId = shopId.trim();
          node.role = node.role || 'merchant';
          node.label = node.label || '$';
          return true;
        },

        assignNpcDialogueAt(x, y) {
          const node = this.getNpcAt(x, y);
          if (!node) return this.setNpcAt(x, y, this.selectedNpcId);
          const dialogueId = window.prompt('Dialogue id for this NPC:', node.dialogueId || `dialogue_${String(node.npcId || node.id).replace(/^npc_/, '')}`);
          if (!dialogueId) return false;
          node.dialogueId = dialogueId.trim();
          return true;
        },

        currentMobList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorMobDefinitions || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedMob() {
          this.ensureEditorMetadata();
          return this.game.editorMobDefinitions?.[this.selectedMobId] || MOB_DRAFT_BY_ID[this.selectedMobId] || mobEntries[0] || null;
        },

        currentMobSpawnList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorMobSpawnDefinitions || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedMobSpawn() {
          this.ensureEditorMetadata();
          return this.game.editorMobSpawnDefinitions?.[this.selectedMobSpawnId] || MOB_SPAWN_BY_ID[this.selectedMobSpawnId] || mobSpawnEntries[0] || null;
        },

        makeMobId(name) {
          const base = String(name || 'new mob').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'new_mob';
          let id = base.startsWith('mob_') ? base : `mob_${base}`;
          let finalId = id;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorMobDefinitions?.[finalId]) finalId = `${id}_${i++}`;
          return finalId;
        },

        makeMobSpawnId(name) {
          const base = String(name || 'new spawn').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'new_spawn';
          let id = base.startsWith('spawn_') ? base : `spawn_${base}`;
          let finalId = id;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorMobSpawnDefinitions?.[finalId]) finalId = `${id}_${i++}`;
          return finalId;
        },

        createMobDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('Mob name:', 'New Mob');
          if (!name) return false;
          const id = this.makeMobId(name);
          const mob = {
            id,
            name: name.trim(),
            family: window.prompt('Mob family:', 'beast') || 'beast',
            zoneRole: window.prompt('Zone role:', 'outdoor_roamer') || 'outdoor_roamer',
            levelMin: Number(window.prompt('Level min:', '1')) || 1,
            levelMax: Number(window.prompt('Level max:', '3')) || 3,
            hp: Number(window.prompt('HP:', '40')) || 40,
            attack: Number(window.prompt('Attack:', '6')) || 6,
            defense: Number(window.prompt('Defense:', '1')) || 1,
            speed: Number(window.prompt('Speed:', '1.8')) || 1.8,
            xp: Number(window.prompt('XP:', '12')) || 12,
            lootTableId: this.selectedLootTableId || 'loot_dark_woods_common_mobs',
            abilities: [],
            aggroRadius: 5,
            leashRadius: 12,
            respawnSeconds: 45,
            elite: false,
            color: '#b8c27d',
            label: 'M',
            notes: 'Created in the Dream Realms mob editor.'
          };
          this.game.editorMobDefinitions[id] = mob;
          this.selectedMobId = id;
          this.markDirty(`Created mob draft: ${mob.name}.`);
          return true;
        },

        editSelectedMob() {
          this.ensureEditorMetadata();
          const mob = this.selectedMob();
          if (!mob) return false;
          const updated = JSON.parse(JSON.stringify(mob));
          updated.name = window.prompt('Mob name:', updated.name || updated.id) || updated.name;
          updated.family = window.prompt('Mob family:', updated.family || 'beast') || updated.family || 'beast';
          updated.levelMin = Number(window.prompt('Level min:', String(updated.levelMin || 1))) || updated.levelMin || 1;
          updated.levelMax = Number(window.prompt('Level max:', String(updated.levelMax || updated.levelMin || 1))) || updated.levelMax || updated.levelMin || 1;
          updated.hp = Number(window.prompt('HP:', String(updated.hp || 40))) || updated.hp || 40;
          updated.attack = Number(window.prompt('Attack:', String(updated.attack || 6))) || updated.attack || 6;
          updated.defense = Number(window.prompt('Defense:', String(updated.defense || 1))) || updated.defense || 1;
          updated.lootTableId = window.prompt('Loot table id:', updated.lootTableId || this.selectedLootTableId || '') || updated.lootTableId || null;
          const abilityCsv = window.prompt('Abilities, comma-separated:', (updated.abilities || []).join(','));
          if (abilityCsv != null) updated.abilities = abilityCsv.split(',').map(x => x.trim()).filter(Boolean);
          updated.label = window.prompt('Map label:', updated.label || 'M') || updated.label || 'M';
          updated.notes = window.prompt('Notes:', updated.notes || '') || updated.notes || '';
          this.game.editorMobDefinitions[updated.id] = updated;
          this.markDirty(`Updated mob draft: ${updated.name}.`);
          return true;
        },

        duplicateSelectedMob() {
          this.ensureEditorMetadata();
          const mob = this.selectedMob();
          if (!mob) return false;
          const copy = JSON.parse(JSON.stringify(mob));
          copy.name = `${copy.name || copy.id} Copy`;
          copy.id = this.makeMobId(copy.name);
          copy.notes = 'Duplicated in the Dream Realms mob editor.';
          this.game.editorMobDefinitions[copy.id] = copy;
          this.selectedMobId = copy.id;
          this.markDirty(`Duplicated mob draft: ${copy.name}.`);
          return true;
        },

        deleteSelectedMob() {
          this.ensureEditorMetadata();
          const mob = this.selectedMob();
          if (!mob) return false;
          if (!window.confirm(`Delete mob draft "${mob.name || mob.id}"? Spawn groups using this id will remain until edited.`)) return false;
          delete this.game.editorMobDefinitions[mob.id];
          const next = this.currentMobList()[0];
          this.selectedMobId = next?.id || 'mob_gloom_wolf';
          this.markDirty(`Deleted mob draft: ${mob.name || mob.id}.`);
          return true;
        },

        createMobSpawnDraft() {
          this.ensureEditorMetadata();
          const mob = this.selectedMob();
          const name = window.prompt('Spawn group name:', `${mob?.name || 'Mob'} Spawn`);
          if (!name) return false;
          const id = this.makeMobSpawnId(name);
          const spawn = {
            id,
            name: name.trim(),
            mobIds: [mob?.id || this.selectedMobId || 'mob_gloom_wolf'],
            countMin: Number(window.prompt('Min count:', '1')) || 1,
            countMax: Number(window.prompt('Max count:', '4')) || 4,
            radius: Number(window.prompt('Spawn radius:', '7')) || 7,
            respawnSeconds: Number(window.prompt('Respawn seconds:', '45')) || 45,
            levelMin: mob?.levelMin || 1,
            levelMax: mob?.levelMax || 3,
            faction: 'hostile_wildlife',
            lootTableId: mob?.lootTableId || this.selectedLootTableId || 'loot_dark_woods_common_mobs',
            noSpawnNearTown: true,
            color: mob?.color || '#b8c27d',
            label: mob?.label || 'M',
            notes: 'Created in the Dream Realms mob spawn editor.'
          };
          this.game.editorMobSpawnDefinitions[id] = spawn;
          this.selectedMobSpawnId = id;
          this.markDirty(`Created mob spawn group: ${spawn.name}.`);
          return true;
        },

        editSelectedMobSpawn() {
          this.ensureEditorMetadata();
          const spawn = this.selectedMobSpawn();
          if (!spawn) return false;
          const updated = JSON.parse(JSON.stringify(spawn));
          updated.name = window.prompt('Spawn group name:', updated.name || updated.id) || updated.name;
          const mobCsv = window.prompt('Mob ids, comma-separated:', (updated.mobIds || []).join(','));
          if (mobCsv != null) updated.mobIds = mobCsv.split(',').map(x => x.trim()).filter(Boolean);
          updated.countMin = Number(window.prompt('Min count:', String(updated.countMin || 1))) || updated.countMin || 1;
          updated.countMax = Number(window.prompt('Max count:', String(updated.countMax || updated.countMin || 1))) || updated.countMax || updated.countMin || 1;
          updated.radius = Number(window.prompt('Radius:', String(updated.radius || 7))) || updated.radius || 7;
          updated.respawnSeconds = Number(window.prompt('Respawn seconds:', String(updated.respawnSeconds || 45))) || updated.respawnSeconds || 45;
          updated.lootTableId = window.prompt('Loot table id:', updated.lootTableId || this.selectedLootTableId || '') || updated.lootTableId || null;
          updated.label = window.prompt('Map label:', updated.label || 'M') || updated.label || 'M';
          updated.notes = window.prompt('Notes:', updated.notes || '') || updated.notes || '';
          this.game.editorMobSpawnDefinitions[updated.id] = updated;
          this.markDirty(`Updated mob spawn group: ${updated.name}.`);
          return true;
        },

        duplicateSelectedMobSpawn() {
          this.ensureEditorMetadata();
          const spawn = this.selectedMobSpawn();
          if (!spawn) return false;
          const copy = JSON.parse(JSON.stringify(spawn));
          copy.name = `${copy.name || copy.id} Copy`;
          copy.id = this.makeMobSpawnId(copy.name);
          copy.notes = 'Duplicated in the Dream Realms mob spawn editor.';
          this.game.editorMobSpawnDefinitions[copy.id] = copy;
          this.selectedMobSpawnId = copy.id;
          this.markDirty(`Duplicated mob spawn group: ${copy.name}.`);
          return true;
        },

        deleteSelectedMobSpawn() {
          this.ensureEditorMetadata();
          const spawn = this.selectedMobSpawn();
          if (!spawn) return false;
          if (!window.confirm(`Delete spawn group "${spawn.name || spawn.id}"? Placed spawn markers using this id will remain until erased or reassigned.`)) return false;
          delete this.game.editorMobSpawnDefinitions[spawn.id];
          const next = this.currentMobSpawnList()[0];
          this.selectedMobSpawnId = next?.id || 'spawn_dark_woods_wolves';
          this.markDirty(`Deleted mob spawn group: ${spawn.name || spawn.id}.`);
          return true;
        },

        makeMobSpawnNode(spawnId, x, y) {
          const def = this.game.editorMobSpawnDefinitions?.[spawnId] || MOB_SPAWN_BY_ID[spawnId] || mobSpawnEntries[0];
          if (!def) return null;
          return {
            id: `${def.id}_${x}_${y}`,
            type: 'mobSpawn',
            spawnId: def.id,
            name: def.name || def.id,
            mobIds: Array.isArray(def.mobIds) ? [...def.mobIds] : [],
            x,
            y,
            countMin: Number(def.countMin) || 1,
            countMax: Number(def.countMax) || 1,
            radius: Number(def.radius) || 6,
            respawnSeconds: Number(def.respawnSeconds) || 45,
            levelMin: Number(def.levelMin) || 1,
            levelMax: Number(def.levelMax) || Number(def.levelMin) || 1,
            faction: def.faction || 'hostile',
            lootTableId: def.lootTableId || null,
            color: def.color || '#d981ff',
            label: def.label || 'M',
            notes: def.notes || ''
          };
        },

        setMobSpawnAt(x, y, spawnId) {
          const node = this.makeMobSpawnNode(spawnId, x, y);
          if (!node) return false;
          this.currentMobSpawnGrid()[this.attrKey(x, y)] = node;
          return true;
        },

        clearMobSpawnAt(x, y) {
          delete this.currentMobSpawnGrid()[this.attrKey(x, y)];
          return true;
        },

        pickMobSpawn(ref) {
          const node = this.getMobSpawnAt(ref.x, ref.y);
          if (!node) {
            this.game.log('No mob spawn marker on that tile.');
            return;
          }
          this.selectedMobSpawnId = node.spawnId || node.id;
          this.tab = 'mobs';
          this.tool = 'Place Spawn';
          this.game.log(`Picked mob spawn: ${node.name || this.selectedMobSpawnId}.`);
          this.refreshPanel();
        },

        assignMobLootAt(x, y, lootTableId) {
          const node = this.getMobSpawnAt(x, y);
          if (!node) return this.setMobSpawnAt(x, y, this.selectedMobSpawnId);
          const table = this.game.editorLootTables?.[lootTableId] || LOOT_TABLE_BY_ID[lootTableId];
          node.lootTableId = table?.id || lootTableId || node.lootTableId || null;
          node.lootTableName = table?.name || node.lootTableId || null;
          return true;
        },


        currentDungeonList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorDungeons || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedDungeon() {
          this.ensureEditorMetadata();
          return this.game.editorDungeons?.[this.selectedDungeonId] || DUNGEON_BY_ID[this.selectedDungeonId] || dungeonEntries[0] || null;
        },

        currentPuzzleList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorPuzzles || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedPuzzle() {
          this.ensureEditorMetadata();
          return this.game.editorPuzzles?.[this.selectedPuzzleId] || PUZZLE_BY_ID[this.selectedPuzzleId] || puzzleEntries[0] || null;
        },

        makeDungeonId(name) {
          const base = String(name || 'new dungeon').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'dungeon';
          let id = `dungeon_${base}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorDungeons[id]) id = `dungeon_${base}_${i++}`;
          return id;
        },

        makePuzzleId(name) {
          const base = String(name || 'new puzzle').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'puzzle';
          let id = `puzzle_${base}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorPuzzles[id]) id = `puzzle_${base}_${i++}`;
          return id;
        },

        createDungeonDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('Dungeon name:', 'New Dream Realms Dungeon');
          if (!name) return false;
          const id = this.makeDungeonId(name);
          const dungeon = {
            id,
            name: name.trim(),
            zoneId: this.currentZoneKey(),
            entranceZoneId: this.currentZoneKey(),
            caveZoneId: 'mossfang_cave',
            theme: window.prompt('Dungeon theme id:', 'crypt_root') || 'crypt_root',
            minLevel: Math.max(1, Math.floor(Number(window.prompt('Minimum level:', '5')) || 5)),
            maxLevel: Math.max(1, Math.floor(Number(window.prompt('Maximum level:', '10')) || 10)),
            floors: Math.max(1, Math.floor(Number(window.prompt('Floor count:', '1')) || 1)),
            recommendedPartySize: Math.max(1, Math.floor(Number(window.prompt('Recommended party size:', '1')) || 1)),
            eliteMultiplier: Math.max(1, Number(window.prompt('Elite loot multiplier:', '2')) || 2),
            bossIds: [],
            lootTableId: this.selectedLootTableId || 'loot_dungeon_chest',
            keyItemId: null,
            puzzleIds: [],
            roomPlan: ['entrance', 'combat', 'boss', 'treasure'],
            color: '#a987ff',
            label: 'D',
            notes: window.prompt('Dungeon notes:', `${name.trim()} editor dungeon draft.`) || `${name.trim()} editor dungeon draft.`
          };
          this.game.editorDungeons[id] = dungeon;
          this.selectedDungeonId = id;
          this.markDirty(`Created dungeon draft: ${dungeon.name}.`);
          return true;
        },

        editSelectedDungeon() {
          this.ensureEditorMetadata();
          const dungeon = this.selectedDungeon();
          if (!dungeon) return false;
          const updated = JSON.parse(JSON.stringify(dungeon));
          updated.name = window.prompt('Dungeon name:', updated.name || updated.id) || updated.name;
          updated.theme = window.prompt('Theme id:', updated.theme || 'crypt_root') || updated.theme || 'crypt_root';
          updated.minLevel = Math.max(1, Math.floor(Number(window.prompt('Minimum level:', updated.minLevel ?? 1)) || updated.minLevel || 1));
          updated.maxLevel = Math.max(updated.minLevel, Math.floor(Number(window.prompt('Maximum level:', updated.maxLevel ?? updated.minLevel)) || updated.maxLevel || updated.minLevel));
          updated.floors = Math.max(1, Math.floor(Number(window.prompt('Floor count:', updated.floors ?? 1)) || updated.floors || 1));
          updated.lootTableId = window.prompt('Loot table id:', updated.lootTableId || this.selectedLootTableId || '') || updated.lootTableId || null;
          const puzzles = window.prompt('Puzzle ids, comma-separated:', (updated.puzzleIds || []).join(','));
          if (puzzles != null) updated.puzzleIds = puzzles.split(',').map(x => x.trim()).filter(Boolean);
          updated.notes = window.prompt('Notes:', updated.notes || '') || updated.notes || '';
          this.game.editorDungeons[updated.id] = updated;
          this.markDirty(`Updated dungeon draft: ${updated.name}.`);
          return true;
        },

        duplicateSelectedDungeon() {
          this.ensureEditorMetadata();
          const dungeon = this.selectedDungeon();
          if (!dungeon) return false;
          const copy = JSON.parse(JSON.stringify(dungeon));
          copy.name = `${copy.name || copy.id} Copy`;
          copy.id = this.makeDungeonId(copy.name);
          copy.notes = 'Duplicated in the Dream Realms dungeon editor.';
          this.game.editorDungeons[copy.id] = copy;
          this.selectedDungeonId = copy.id;
          this.markDirty(`Duplicated dungeon draft: ${copy.name}.`);
          return true;
        },

        deleteSelectedDungeon() {
          this.ensureEditorMetadata();
          const dungeon = this.selectedDungeon();
          if (!dungeon) return false;
          if (!window.confirm(`Delete dungeon draft "${dungeon.name || dungeon.id}"? Placed markers using this id will remain until erased or reassigned.`)) return false;
          delete this.game.editorDungeons[dungeon.id];
          const next = this.currentDungeonList()[0];
          this.selectedDungeonId = next?.id || 'dungeon_glooms_crypt';
          this.markDirty(`Deleted dungeon draft: ${dungeon.name || dungeon.id}.`);
          return true;
        },

        createPuzzleDraft() {
          this.ensureEditorMetadata();
          const dungeon = this.selectedDungeon();
          const name = window.prompt('Puzzle name:', 'New Dungeon Puzzle');
          if (!name) return false;
          const id = this.makePuzzleId(name);
          const puzzle = {
            id,
            name: name.trim(),
            dungeonId: dungeon?.id || this.selectedDungeonId,
            puzzleType: window.prompt('Puzzle type:', 'sequence') || 'sequence',
            triggerType: window.prompt('Trigger type:', 'interact') || 'interact',
            requiredSwitches: Math.max(0, Math.floor(Number(window.prompt('Required switches:', '3')) || 0)),
            resetOnFail: true,
            successOpens: [],
            failureSpawns: [],
            color: '#fff08a',
            label: 'P',
            notes: window.prompt('Puzzle notes:', `${name.trim()} editor puzzle draft.`) || `${name.trim()} editor puzzle draft.`
          };
          this.game.editorPuzzles[id] = puzzle;
          if (dungeon && !Array.isArray(dungeon.puzzleIds)) dungeon.puzzleIds = [];
          if (dungeon && !dungeon.puzzleIds.includes(id)) dungeon.puzzleIds.push(id);
          this.selectedPuzzleId = id;
          this.markDirty(`Created puzzle draft: ${puzzle.name}.`);
          return true;
        },

        editSelectedPuzzle() {
          this.ensureEditorMetadata();
          const puzzle = this.selectedPuzzle();
          if (!puzzle) return false;
          const updated = JSON.parse(JSON.stringify(puzzle));
          updated.name = window.prompt('Puzzle name:', updated.name || updated.id) || updated.name;
          updated.dungeonId = window.prompt('Dungeon id:', updated.dungeonId || this.selectedDungeonId || '') || updated.dungeonId || this.selectedDungeonId;
          updated.puzzleType = window.prompt('Puzzle type:', updated.puzzleType || 'sequence') || updated.puzzleType || 'sequence';
          updated.triggerType = window.prompt('Trigger type:', updated.triggerType || 'interact') || updated.triggerType || 'interact';
          updated.requiredSwitches = Math.max(0, Math.floor(Number(window.prompt('Required switches:', updated.requiredSwitches ?? 0)) || 0));
          updated.notes = window.prompt('Notes:', updated.notes || '') || updated.notes || '';
          this.game.editorPuzzles[updated.id] = updated;
          this.selectedDungeonId = updated.dungeonId || this.selectedDungeonId;
          this.markDirty(`Updated puzzle draft: ${updated.name}.`);
          return true;
        },

        duplicateSelectedPuzzle() {
          this.ensureEditorMetadata();
          const puzzle = this.selectedPuzzle();
          if (!puzzle) return false;
          const copy = JSON.parse(JSON.stringify(puzzle));
          copy.name = `${copy.name || copy.id} Copy`;
          copy.id = this.makePuzzleId(copy.name);
          copy.notes = 'Duplicated in the Dream Realms dungeon puzzle editor.';
          this.game.editorPuzzles[copy.id] = copy;
          this.selectedPuzzleId = copy.id;
          this.markDirty(`Duplicated puzzle draft: ${copy.name}.`);
          return true;
        },

        deleteSelectedPuzzle() {
          this.ensureEditorMetadata();
          const puzzle = this.selectedPuzzle();
          if (!puzzle) return false;
          if (!window.confirm(`Delete puzzle draft "${puzzle.name || puzzle.id}"? Placed puzzle markers using this id will remain until erased or reassigned.`)) return false;
          delete this.game.editorPuzzles[puzzle.id];
          const dungeon = this.game.editorDungeons?.[puzzle.dungeonId];
          if (dungeon && Array.isArray(dungeon.puzzleIds)) dungeon.puzzleIds = dungeon.puzzleIds.filter(id => id !== puzzle.id);
          const next = this.currentPuzzleList()[0];
          this.selectedPuzzleId = next?.id || 'puzzle_lantern_order';
          this.markDirty(`Deleted puzzle draft: ${puzzle.name || puzzle.id}.`);
          return true;
        },

        makeDungeonMarkerNode(kind, dungeonId, puzzleId, x, y) {
          const dungeon = this.game.editorDungeons?.[dungeonId] || DUNGEON_BY_ID[dungeonId] || dungeonEntries[0];
          const puzzle = puzzleId ? (this.game.editorPuzzles?.[puzzleId] || PUZZLE_BY_ID[puzzleId]) : null;
          const roomDef = dungeonRoomEntries.find(room => room.kind === kind || room.id === kind) || null;
          const markerMeta = {
            entrance: { label: 'D', color: dungeon?.color || '#a987ff', name: 'Dungeon Entrance' },
            bossRoom: { label: 'B', color: '#e65d4f', name: 'Boss Room' },
            puzzle: { label: puzzle?.label || 'P', color: puzzle?.color || '#fff08a', name: 'Puzzle Marker' },
            lock: { label: 'L', color: '#fff08a', name: 'Lock Marker' },
            key: { label: 'K', color: '#75d069', name: 'Key Marker' },
            door: { label: 'R', color: '#9fd7ff', name: 'Door Marker' },
            treasureRoom: { label: 'T', color: '#d8ad57', name: 'Treasure Room' }
          }[kind] || { label: roomDef?.label || 'D', color: roomDef?.color || '#a987ff', name: roomDef?.name || 'Dungeon Marker' };
          return {
            id: `dungeon_${kind}_${x}_${y}`,
            type: 'dungeonMarker',
            markerKind: kind,
            dungeonId: dungeon?.id || dungeonId || this.selectedDungeonId,
            dungeonName: dungeon?.name || dungeonId || 'Dungeon',
            puzzleId: puzzle?.id || (kind === 'puzzle' ? this.selectedPuzzleId : null),
            puzzleName: puzzle?.name || null,
            x,
            y,
            zoneKey: this.currentZoneKey(),
            floor: this.game.currentZone === 'cave' ? 1 : 0,
            lootTableId: (kind === 'treasureRoom' || kind === 'bossRoom') ? (dungeon?.lootTableId || this.selectedLootTableId || null) : null,
            linkedDoorId: kind === 'lock' || kind === 'key' ? `${dungeon?.id || dungeonId}_door_1` : null,
            trigger: kind === 'entrance' ? 'touch' : 'interact',
            color: markerMeta.color,
            label: markerMeta.label,
            name: markerMeta.name,
            notes: `${markerMeta.name} for ${dungeon?.name || dungeonId || 'dungeon'}. Runtime dungeon loading and puzzle execution are active.`
          };
        },

        setDungeonMarkerAt(x, y, kind = 'entrance') {
          const node = this.makeDungeonMarkerNode(kind, this.selectedDungeonId, kind === 'puzzle' ? this.selectedPuzzleId : null, x, y);
          if (!node) return false;
          this.currentDungeonMarkerGrid()[this.attrKey(x, y)] = node;
          return true;
        },

        clearDungeonMarkerAt(x, y) {
          delete this.currentDungeonMarkerGrid()[this.attrKey(x, y)];
          return true;
        },

        pickDungeonMarker(ref) {
          const node = this.getDungeonMarkerAt(ref.x, ref.y);
          if (!node) {
            this.game.log('No dungeon marker on that tile.');
            return;
          }
          this.selectedDungeonId = node.dungeonId || this.selectedDungeonId;
          if (node.puzzleId) this.selectedPuzzleId = node.puzzleId;
          this.tab = 'dungeons';
          this.tool = node.markerKind === 'puzzle' ? 'Puzzle Marker' : 'Place Dungeon Entrance';
          this.game.log(`Picked dungeon marker: ${node.name || node.markerKind} · ${node.dungeonName || node.dungeonId}.`);
          this.refreshPanel();
        },

        assignDungeonLootAt(x, y, lootTableId) {
          const node = this.getDungeonMarkerAt(x, y);
          if (!node) return this.setDungeonMarkerAt(x, y, 'treasureRoom');
          const table = this.game.editorLootTables?.[lootTableId] || LOOT_TABLE_BY_ID[lootTableId];
          node.lootTableId = table?.id || lootTableId || node.lootTableId || null;
          node.lootTableName = table?.name || node.lootTableId || null;
          return true;
        },

        currentQuestList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorQuests || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedQuest() {
          this.ensureEditorMetadata();
          return this.game.editorQuests?.[this.selectedQuestId] || QUEST_BY_ID[this.selectedQuestId] || questEntries[0] || null;
        },

        cloneQuestDraft(quest) {
          return quest ? JSON.parse(JSON.stringify(quest)) : null;
        },

        makeQuestId(name) {
          const base = String(name || 'new quest').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'quest';
          let id = `quest_${base}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorQuests[id]) id = `quest_${base}_${i++}`;
          return id;
        },

        createQuestDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('Quest name:', 'New Dream Realms Quest');
          if (!name) return false;
          const id = this.makeQuestId(name);
          const objective = window.prompt('Primary objective text:', 'Defeat enemies in Dark Woods') || 'Complete the objective';
          const required = Math.max(1, Math.floor(Number(window.prompt('Required count:', '3')) || 1));
          const xp = Math.max(0, Math.floor(Number(window.prompt('XP reward:', '80')) || 0));
          const gold = Math.max(0, Math.floor(Number(window.prompt('Gold reward:', '15')) || 0));
          const quest = {
            id,
            name: name.trim(),
            folder: this.currentZoneKey() === 'mossfang_cave' ? 'Mossfang Cave' : 'Dark Woods',
            repeatable: false,
            canAbandon: true,
            giver: 'Editor NPC',
            turnIn: 'Editor NPC',
            color: '#c991ff',
            label: 'Q',
            beforeOfferText: `${name.trim()} is available.`,
            offerText: `Will you help with ${name.trim()}?`,
            inProgressText: objective,
            completedText: `${name.trim()} is complete.`,
            tasks: [{ type: 'custom', target: 'editor_objective', label: objective, required, progress: 0 }],
            rewards: { xp, gold, items: [] },
            note: 'Created in the Dream Realms quest editor foundation.'
          };
          this.game.editorQuests[id] = quest;
          this.selectedQuestId = id;
          this.markDirty(`Created quest: ${quest.name}.`);
          return true;
        },

        editSelectedQuest() {
          this.ensureEditorMetadata();
          const quest = this.selectedQuest();
          if (!quest) {
            this.game.log('No quest selected.');
            return false;
          }
          const name = window.prompt('Quest name:', quest.name || quest.id);
          if (!name) return false;
          const folder = window.prompt('Quest folder:', quest.folder || 'Dark Woods') || quest.folder || 'Dark Woods';
          const objective = window.prompt('Primary objective text:', quest.tasks?.[0]?.label || 'Complete the objective') || quest.tasks?.[0]?.label || 'Complete the objective';
          const required = Math.max(1, Math.floor(Number(window.prompt('Required count:', quest.tasks?.[0]?.required ?? 1)) || 1));
          const xp = Math.max(0, Math.floor(Number(window.prompt('XP reward:', quest.rewards?.xp ?? 0)) || 0));
          const gold = Math.max(0, Math.floor(Number(window.prompt('Gold reward:', quest.rewards?.gold ?? 0)) || 0));
          const updated = this.cloneQuestDraft(quest);
          updated.name = name.trim();
          updated.folder = folder.trim();
          updated.tasks = [{ ...(updated.tasks?.[0] || { type: 'custom', target: 'editor_objective' }), label: objective, required, progress: 0 }];
          updated.rewards = { ...(updated.rewards || {}), xp, gold, items: updated.rewards?.items || [] };
          updated.inProgressText = objective;
          this.game.editorQuests[updated.id] = updated;
          this.markDirty(`Updated quest: ${updated.name}.`);
          return true;
        },

        deleteSelectedQuest() {
          this.ensureEditorMetadata();
          const quest = this.selectedQuest();
          if (!quest) return false;
          if (!window.confirm(`Delete quest draft "${quest.name || quest.id}"? Placed quest hooks will remain but become unassigned.`)) return false;
          delete this.game.editorQuests[quest.id];
          const next = this.currentQuestList()[0];
          this.selectedQuestId = next?.id || 'quest_darkwood_first_steps';
          this.markDirty(`Deleted quest: ${quest.name || quest.id}.`);
          return true;
        },

        makeQuestHookNode(x, y, questId) {
          const quest = this.game.editorQuests?.[questId] || QUEST_BY_ID[questId] || questEntries[0];
          const node = this.makeEventNode('quest_hook', x, y);
          if (!node || !quest) return node;
          node.questId = quest.id;
          node.questName = quest.name || quest.id;
          node.name = `Quest Hook: ${quest.name || quest.id}`;
          node.category = 'quest';
          node.commands = [{ type: 'questHook', questId: quest.id }];
          node.conditions = [{ type: 'questAvailable', questId: quest.id }];
          node.note = quest.note || 'Quest hook assigned from Quest Editor.';
          return node;
        },

        setQuestHookAt(x, y, questId) {
          const grid = this.currentEventGrid();
          const node = this.makeQuestHookNode(x, y, questId || this.selectedQuestId);
          if (!node) return false;
          grid[this.attrKey(x, y)] = node;
          return true;
        },

        assignQuestHookAt(x, y, questId) {
          const grid = this.currentEventGrid();
          const key = this.attrKey(x, y);
          const existing = grid[key];
          if (!existing || existing.category !== 'quest') {
            grid[key] = this.makeQuestHookNode(x, y, questId || this.selectedQuestId);
            return true;
          }
          const quest = this.game.editorQuests?.[questId] || QUEST_BY_ID[questId] || questEntries[0];
          existing.questId = quest?.id || questId;
          existing.questName = quest?.name || questId;
          existing.name = `Quest Hook: ${existing.questName}`;
          existing.commands = [{ type: 'questHook', questId: existing.questId }];
          existing.conditions = [{ type: 'questAvailable', questId: existing.questId }];
          return true;
        },

        pickQuest(ref) {
          const node = this.getEventAt(ref.x, ref.y);
          if (!node || node.category !== 'quest') {
            this.game.log('No quest hook on that tile.');
            return false;
          }
          this.selectedQuestId = node.questId || node.commands?.find(cmd => cmd.questId)?.questId || this.selectedQuestId;
          this.tool = 'Place Quest Hook';
          this.tab = 'quests';
          this.game.log(`Picked quest hook: ${node.questName || this.selectedQuestId}.`);
          this.refreshPanel();
          return true;
        },

        currentItemList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorItems || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedItem() {
          this.ensureEditorMetadata();
          return this.game.editorItems?.[this.selectedItemId] || ITEM_BY_ID[this.selectedItemId] || itemEntries[0] || null;
        },

        cloneItemDraft(item) {
          return item ? JSON.parse(JSON.stringify(item)) : null;
        },

        makeItemId(name) {
          const base = String(name || 'new item').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
          let id = `item_${base}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorItems[id]) id = `item_${base}_${i++}`;
          return id;
        },

        createItemDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('Item name:', 'New Dream Realms Item');
          if (!name) return false;
          const id = this.makeItemId(name);
          const type = (window.prompt('Item type:', 'weapon') || 'weapon').trim();
          const slot = (window.prompt('Equipment slot / none:', type === 'weapon' ? 'weapon' : 'none') || 'none').trim();
          const rarity = (window.prompt('Rarity key:', 'white') || 'white').trim();
          const levelRequirement = Math.max(1, Math.floor(Number(window.prompt('Level requirement:', '1')) || 1));
          const sellValue = Math.max(0, Math.floor(Number(window.prompt('Sell value:', '10')) || 0));
          const stackSize = Math.max(1, Math.floor(Number(window.prompt('Stack size:', type === 'resource' ? '99' : '1')) || 1));
          const attack = Math.floor(Number(window.prompt('Attack stat:', '0')) || 0);
          const defense = Math.floor(Number(window.prompt('Defense stat:', '0')) || 0);
          const hp = Math.floor(Number(window.prompt('HP stat:', '0')) || 0);
          const mana = Math.floor(Number(window.prompt('Mana stat:', '0')) || 0);
          const stats = {};
          if (attack) stats.attack = attack;
          if (defense) stats.defense = defense;
          if (hp) stats.hp = hp;
          if (mana) stats.mana = mana;
          const item = {
            id,
            name: name.trim(),
            type,
            slot,
            rarity,
            levelRequirement,
            classRestrictions: Object.keys(DR.CLASSES || {}),
            stats,
            damage: type === 'weapon' ? { min: Math.max(1, attack || 1), max: Math.max(2, (attack || 1) + 3), speed: 2.4 } : null,
            armor: defense,
            sellValue,
            stackSize,
            icon: { family: type, color: '#d8ded1', glyph: '?' },
            description: window.prompt('Item description:', `${name.trim()} created in the item editor.`) || '',
            editorNote: 'Created in the Dream Realms item editor.'
          };
          this.game.editorItems[id] = item;
          this.selectedItemId = id;
          this.markDirty(`Created item: ${item.name}.`);
          return true;
        },

        editSelectedItem() {
          this.ensureEditorMetadata();
          const item = this.selectedItem();
          if (!item) {
            this.game.log('No item selected.');
            return false;
          }
          const updated = this.cloneItemDraft(item);
          const name = window.prompt('Item name:', updated.name || updated.id);
          if (!name) return false;
          updated.name = name.trim();
          updated.type = (window.prompt('Item type:', updated.type || 'weapon') || updated.type || 'weapon').trim();
          updated.slot = (window.prompt('Equipment slot / none:', updated.slot || 'none') || updated.slot || 'none').trim();
          updated.rarity = (window.prompt('Rarity key:', updated.rarity || 'white') || updated.rarity || 'white').trim();
          updated.levelRequirement = Math.max(1, Math.floor(Number(window.prompt('Level requirement:', updated.levelRequirement ?? 1)) || 1));
          updated.sellValue = Math.max(0, Math.floor(Number(window.prompt('Sell value:', updated.sellValue ?? 0)) || 0));
          updated.stackSize = Math.max(1, Math.floor(Number(window.prompt('Stack size:', updated.stackSize ?? 1)) || 1));
          updated.description = window.prompt('Item description:', updated.description || '') || updated.description || '';
          this.game.editorItems[updated.id] = updated;
          this.markDirty(`Updated item: ${updated.name}.`);
          return true;
        },

        duplicateSelectedItem() {
          this.ensureEditorMetadata();
          const item = this.selectedItem();
          if (!item) return false;
          const copy = this.cloneItemDraft(item);
          copy.name = `${item.name || item.id} Copy`;
          copy.id = this.makeItemId(copy.name);
          copy.editorNote = 'Duplicated in the Dream Realms item editor.';
          this.game.editorItems[copy.id] = copy;
          this.selectedItemId = copy.id;
          this.markDirty(`Duplicated item: ${copy.name}.`);
          return true;
        },

        deleteSelectedItem() {
          this.ensureEditorMetadata();
          const item = this.selectedItem();
          if (!item) return false;
          const inUse = this.currentLootTableList().some(table => (table.entries || []).some(entry => entry.itemId === item.id) || (table.rarePool || []).includes(item.id));
          if (inUse && !window.confirm(`Item "${item.name || item.id}" is used by one or more loot tables. Delete it anyway?`)) return false;
          if (!inUse && !window.confirm(`Delete item draft "${item.name || item.id}"?`)) return false;
          delete this.game.editorItems[item.id];
          const next = this.currentItemList()[0];
          this.selectedItemId = next?.id || 'item_gloomforged_blade';
          this.markDirty(`Deleted item: ${item.name || item.id}.`);
          return true;
        },

        currentLootTableList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorLootTables || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedLootTable() {
          this.ensureEditorMetadata();
          return this.game.editorLootTables?.[this.selectedLootTableId] || LOOT_TABLE_BY_ID[this.selectedLootTableId] || lootTableEntries[0] || null;
        },

        cloneLootTable(table) {
          return table ? JSON.parse(JSON.stringify(table)) : null;
        },

        makeLootTableId(name) {
          const base = String(name || 'new loot table').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'loot_table';
          let id = base.startsWith('loot_') ? base : `loot_${base}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorLootTables[id]) id = `${base}_${i++}`;
          return id;
        },

        createLootTableDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('Loot table name:', 'New Loot Table');
          if (!name) return false;
          const id = this.makeLootTableId(name);
          const itemId = this.selectedItemId || this.currentItemList()[0]?.id || 'item_gloomleaf';
          const chance = Math.max(0, Math.min(100, Number(window.prompt('Primary drop chance %:', '25')) || 0));
          const goldMin = Math.max(0, Math.floor(Number(window.prompt('Gold min:', '1')) || 0));
          const goldMax = Math.max(goldMin, Math.floor(Number(window.prompt('Gold max:', '8')) || goldMin));
          const table = {
            id,
            name: name.trim(),
            source: { kind: 'editor', id: this.currentZoneKey() },
            gold: { min: goldMin, max: goldMax },
            rarityWeights: { grey: 35, white: 35, green: 20, blue: 7, purple: 2, gold: 0.8, orange: 0.2, red: 0 },
            entries: [{ itemId, chance, min: 1, max: 1 }],
            rarePool: [],
            notes: 'Created in the Dream Realms loot-table editor.'
          };
          this.game.editorLootTables[id] = table;
          this.selectedLootTableId = id;
          this.markDirty(`Created loot table: ${table.name}.`);
          return true;
        },

        editSelectedLootTable() {
          this.ensureEditorMetadata();
          const table = this.selectedLootTable();
          if (!table) {
            this.game.log('No loot table selected.');
            return false;
          }
          const updated = this.cloneLootTable(table);
          const name = window.prompt('Loot table name:', updated.name || updated.id);
          if (!name) return false;
          updated.name = name.trim();
          updated.source = {
            ...(updated.source || {}),
            kind: window.prompt('Source kind:', updated.source?.kind || 'editor') || updated.source?.kind || 'editor',
            id: window.prompt('Source id:', updated.source?.id || this.currentZoneKey()) || updated.source?.id || this.currentZoneKey()
          };
          const itemId = window.prompt('Primary item id:', updated.entries?.[0]?.itemId || this.selectedItemId || '') || updated.entries?.[0]?.itemId || this.selectedItemId;
          const chance = Math.max(0, Math.min(100, Number(window.prompt('Primary drop chance %:', updated.entries?.[0]?.chance ?? 25)) || 0));
          const min = Math.max(1, Math.floor(Number(window.prompt('Quantity min:', updated.entries?.[0]?.min ?? 1)) || 1));
          const max = Math.max(min, Math.floor(Number(window.prompt('Quantity max:', updated.entries?.[0]?.max ?? min)) || min));
          updated.entries = [{ ...(updated.entries?.[0] || {}), itemId, chance, min, max }, ...(updated.entries || []).slice(1)];
          updated.gold = {
            min: Math.max(0, Math.floor(Number(window.prompt('Gold min:', updated.gold?.min ?? 0)) || 0)),
            max: Math.max(0, Math.floor(Number(window.prompt('Gold max:', updated.gold?.max ?? 0)) || 0))
          };
          if (updated.gold.max < updated.gold.min) updated.gold.max = updated.gold.min;
          updated.notes = window.prompt('Loot table notes:', updated.notes || '') || updated.notes || '';
          this.game.editorLootTables[updated.id] = updated;
          this.markDirty(`Updated loot table: ${updated.name}.`);
          return true;
        },

        duplicateSelectedLootTable() {
          this.ensureEditorMetadata();
          const table = this.selectedLootTable();
          if (!table) return false;
          const copy = this.cloneLootTable(table);
          copy.name = `${table.name || table.id} Copy`;
          copy.id = this.makeLootTableId(copy.name);
          copy.notes = 'Duplicated in the Dream Realms loot-table editor.';
          this.game.editorLootTables[copy.id] = copy;
          this.selectedLootTableId = copy.id;
          this.markDirty(`Duplicated loot table: ${copy.name}.`);
          return true;
        },

        deleteSelectedLootTable() {
          this.ensureEditorMetadata();
          const table = this.selectedLootTable();
          if (!table) return false;
          if (!window.confirm(`Delete loot table draft "${table.name || table.id}"? Existing placed assignments will keep the old id until changed.`)) return false;
          delete this.game.editorLootTables[table.id];
          const next = this.currentLootTableList()[0];
          this.selectedLootTableId = next?.id || 'loot_dark_woods_common_mobs';
          this.markDirty(`Deleted loot table: ${table.name || table.id}.`);
          return true;
        },

        currentSpellList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorSpells || {}).sort((a, b) => {
            const classCompare = String(a.className || '').localeCompare(String(b.className || ''));
            if (classCompare) return classCompare;
            return Number(a.slotIndex || 0) - Number(b.slotIndex || 0);
          });
        },

        selectedSpell() {
          this.ensureEditorMetadata();
          return this.game.editorSpells?.[this.selectedSpellId] || SPELL_BY_ID[this.selectedSpellId] || spellEntries[0] || null;
        },

        cloneSpellDraft(spell) {
          return spell ? JSON.parse(JSON.stringify(spell)) : null;
        },

        makeSpellId(className, name) {
          const cleanClass = String(className || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general';
          const cleanName = String(name || 'new spell').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'spell';
          let id = `spell_${cleanClass}_${cleanName}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorSpells[id]) id = `spell_${cleanClass}_${cleanName}_${i++}`;
          return id;
        },

        normalizeSpellSlot(className, slotIndex, spellId) {
          if (!className) return;
          if (!this.game.classSpellSlots || typeof this.game.classSpellSlots !== 'object') this.game.classSpellSlots = {};
          if (!Array.isArray(this.game.classSpellSlots[className])) this.game.classSpellSlots[className] = [];
          this.game.classSpellSlots[className][Math.max(0, Math.floor(Number(slotIndex) || 0))] = spellId;
        },

        createSpellDraft() {
          this.ensureEditorMetadata();
          const selected = this.selectedSpell();
          const className = (window.prompt('Class name:', selected?.className || 'Bard') || selected?.className || 'Bard').trim();
          const name = window.prompt('Spell name:', 'New Dream Realms Spell');
          if (!name) return false;
          const id = this.makeSpellId(className, name);
          const kind = (window.prompt('Spell kind:', selected?.kind || 'bolt') || 'bolt').trim();
          const role = (window.prompt('Role:', selected?.role || 'damage') || 'damage').trim();
          const cost = Math.max(0, Math.floor(Number(window.prompt('Mana/stamina cost:', selected?.cost ?? 10)) || 0));
          const cooldown = Math.max(0, Number(window.prompt('Cooldown seconds:', selected?.cooldown ?? 3)) || 0);
          const power = Math.max(0, Math.floor(Number(window.prompt('Power:', selected?.power ?? selected?.heal ?? 25)) || 0));
          const slotIndex = Math.max(0, Math.floor(Number(window.prompt('Class hotbar slot index 0-5:', selected?.slotIndex ?? 0)) || 0));
          const spell = {
            id,
            name: name.trim(),
            className,
            slotIndex,
            hotkey: String(slotIndex + 2),
            role,
            kind,
            target: selected?.target || 'enemy',
            cost,
            cooldown,
            range: selected?.range ?? 7,
            radius: selected?.radius ?? null,
            power,
            heal: String(kind).includes('heal') ? power : null,
            duration: selected?.duration ?? null,
            buffName: String(kind).includes('buff') ? name.trim() : null,
            mods: selected?.mods ? JSON.parse(JSON.stringify(selected.mods)) : {},
            color: selected?.color || '#d8ded1',
            animation: {
              cast: `${id}_cast`,
              projectile: selected?.animation?.projectile || (String(kind).includes('bolt') ? 'bolt_projectile' : null),
              impact: `${id}_impact`,
              aura: selected?.animation?.aura || null
            },
            sound: {
              cast: `${id}_cast_tone`,
              impact: `${id}_impact_tone`
            },
            description: window.prompt('Description:', `${name.trim()} editor spell draft.`) || `${name.trim()} editor spell draft.`,
            note: 'Created in the Dream Realms spell editor.'
          };
          this.game.editorSpells[id] = spell;
          this.normalizeSpellSlot(className, slotIndex, id);
          this.selectedSpellId = id;
          this.markDirty(`Created spell draft: ${spell.name}.`);
          this.game.markSpellBookDirty?.('spell draft created');
          this.game.rebuildRuntimeSpellBook?.();
          this.game.updateSpellHotbar?.();
          return true;
        },

        editSelectedSpell() {
          this.ensureEditorMetadata();
          const spell = this.selectedSpell();
          if (!spell) {
            this.game.log('No spell selected.');
            return false;
          }
          const updated = this.cloneSpellDraft(spell);
          const oldClass = updated.className;
          const oldSlot = Math.max(0, Math.floor(Number(updated.slotIndex) || 0));
          const name = window.prompt('Spell name:', updated.name || updated.id);
          if (!name) return false;
          updated.name = name.trim();
          updated.className = (window.prompt('Class name:', updated.className || 'Bard') || updated.className || 'Bard').trim();
          updated.kind = (window.prompt('Spell kind:', updated.kind || 'bolt') || updated.kind || 'bolt').trim();
          updated.role = (window.prompt('Role:', updated.role || 'damage') || updated.role || 'damage').trim();
          updated.target = (window.prompt('Target:', updated.target || 'enemy') || updated.target || 'enemy').trim();
          updated.cost = Math.max(0, Math.floor(Number(window.prompt('Cost:', updated.cost ?? 0)) || 0));
          updated.cooldown = Math.max(0, Number(window.prompt('Cooldown seconds:', updated.cooldown ?? 0)) || 0);
          updated.power = Math.max(0, Math.floor(Number(window.prompt('Power:', updated.power ?? 0)) || 0));
          updated.range = Number(window.prompt('Range, blank keeps current:', updated.range ?? '')) || updated.range || null;
          updated.radius = Number(window.prompt('Radius, blank keeps current:', updated.radius ?? '')) || updated.radius || null;
          updated.duration = Number(window.prompt('Duration, blank keeps current:', updated.duration ?? '')) || updated.duration || null;
          updated.slotIndex = Math.max(0, Math.floor(Number(window.prompt('Class hotbar slot index 0-5:', updated.slotIndex ?? 0)) || 0));
          updated.hotkey = String(updated.slotIndex + 2);
          updated.color = window.prompt('Editor/effect color:', updated.color || '#d8ded1') || updated.color || '#d8ded1';
          updated.description = window.prompt('Description:', updated.description || '') || updated.description || '';
          updated.note = window.prompt('Notes:', updated.note || '') || updated.note || '';
          this.game.editorSpells[updated.id] = updated;
          if (this.game.classSpellSlots?.[oldClass]?.[oldSlot] === updated.id) this.game.classSpellSlots[oldClass][oldSlot] = null;
          this.normalizeSpellSlot(updated.className, updated.slotIndex, updated.id);
          this.markDirty(`Updated spell draft: ${updated.name}.`);
          this.game.markSpellBookDirty?.('spell draft updated');
          this.game.rebuildRuntimeSpellBook?.();
          this.game.updateSpellHotbar?.();
          return true;
        },

        duplicateSelectedSpell() {
          this.ensureEditorMetadata();
          const spell = this.selectedSpell();
          if (!spell) return false;
          const copy = this.cloneSpellDraft(spell);
          copy.name = `${spell.name || spell.id} Copy`;
          copy.id = this.makeSpellId(copy.className || 'general', copy.name);
          copy.slotIndex = Math.max(0, Math.floor(Number(spell.slotIndex) || 0));
          copy.hotkey = String(copy.slotIndex + 2);
          copy.note = 'Duplicated in the Dream Realms spell editor.';
          this.game.editorSpells[copy.id] = copy;
          this.selectedSpellId = copy.id;
          this.normalizeSpellSlot(copy.className, copy.slotIndex, copy.id);
          this.markDirty(`Duplicated spell draft: ${copy.name}.`);
          this.game.markSpellBookDirty?.('spell draft duplicated');
          this.game.rebuildRuntimeSpellBook?.();
          this.game.updateSpellHotbar?.();
          return true;
        },

        deleteSelectedSpell() {
          this.ensureEditorMetadata();
          const spell = this.selectedSpell();
          if (!spell) return false;
          if (!window.confirm(`Delete spell draft "${spell.name || spell.id}"?`)) return false;
          delete this.game.editorSpells[spell.id];
          for (const slots of Object.values(this.game.classSpellSlots || {})) {
            if (!Array.isArray(slots)) continue;
            for (let i = 0; i < slots.length; i++) {
              if (slots[i] === spell.id) slots[i] = null;
            }
          }
          const next = this.currentSpellList()[0];
          this.selectedSpellId = next?.id || 'spell_bard_war_hymn';
          this.markDirty(`Deleted spell draft: ${spell.name || spell.id}.`);
          this.game.markSpellBookDirty?.('spell draft deleted');
          this.game.rebuildRuntimeSpellBook?.();
          this.game.updateSpellHotbar?.();
          return true;
        },

        assignSelectedSpellToClassSlot() {
          this.ensureEditorMetadata();
          const spell = this.selectedSpell();
          if (!spell) return false;
          const className = (window.prompt('Assign to class:', spell.className || 'Bard') || spell.className || 'Bard').trim();
          const slotIndex = Math.max(0, Math.floor(Number(window.prompt('Assign to class slot index 0-5:', spell.slotIndex ?? 0)) || 0));
          spell.className = className;
          spell.slotIndex = slotIndex;
          spell.hotkey = String(slotIndex + 2);
          this.game.editorSpells[spell.id] = spell;
          this.normalizeSpellSlot(className, slotIndex, spell.id);
          this.markDirty(`Assigned ${spell.name || spell.id} to ${className} slot ${slotIndex}.`);
          this.game.markSpellBookDirty?.('spell slot assigned');
          this.game.rebuildRuntimeSpellBook?.();
          this.game.updateSpellHotbar?.();
          return true;
        },

        assignLootTableAt(x, y, lootTableId) {
          const table = this.game.editorLootTables?.[lootTableId] || LOOT_TABLE_BY_ID[lootTableId] || lootTableEntries[0];
          if (!table) return false;
          const resource = this.getResourceAt(x, y);
          if (resource) {
            resource.lootTableId = table.id;
            resource.lootTableName = table.name || table.id;
            resource.lootSource = table.source || null;
            return true;
          }
          const event = this.getEventAt(x, y);
          if (event && (event.category === 'chest' || event.type === 'chest_event')) {
            event.lootTableId = table.id;
            event.lootTableName = table.name || table.id;
            event.commands = Array.isArray(event.commands) ? event.commands.filter(cmd => cmd.type !== 'openLootTable') : [];
            event.commands.push({ type: 'openLootTable', lootTableId: table.id });
            return true;
          }
          const attr = this.getAttrAt(x, y);
          if (attr) {
            attr.lootTableId = table.id;
            attr.lootTableName = table.name || table.id;
            return true;
          }
          this.setAttributeAt(x, y, { lootTableId: table.id, lootTableName: table.name || table.id });
          return true;
        },

        lootTableAt(x, y) {
          const resource = this.getResourceAt(x, y);
          if (resource?.lootTableId) return resource.lootTableId;
          const event = this.getEventAt(x, y);
          if (event?.lootTableId) return event.lootTableId;
          const attr = this.getAttrAt(x, y);
          if (attr?.lootTableId) return attr.lootTableId;
          return null;
        },

        pickResourceByCategory(category) {
          const list = this.currentResourceTypeList();
          const selected = list.find(entry => entry.id === this.selectedResourceType && entry.category === category);
          const fallback = list.find(entry => entry.category === category) || list[0];
          const picked = selected || fallback;
          if (picked) this.selectedResourceType = picked.id;
          return picked?.id || this.selectedResourceType;
        },

        makeResourceNode(resourceId, x, y) {
          const def = this.resourceTypeById(resourceId) || this.currentResourceTypeList()[0];
          if (!def) return null;
          return {
            id: def.id,
            type: def.id,
            category: def.category || 'resource',
            name: def.name || def.id,
            x,
            y,
            tool: def.tool || 'Hands',
            skill: def.skill || 'Gathering',
            respawnSeconds: Number(def.respawnSeconds) || 180,
            drops: def.drops ? JSON.parse(JSON.stringify(def.drops)) : [],
            rareDrops: def.rareDrops ? JSON.parse(JSON.stringify(def.rareDrops)) : [],
            lootTableId: def.lootTableId || (def.category === 'chest' ? 'loot_common_chest' : def.category === 'herb' ? 'loot_gathering_herbs' : def.category === 'mining' ? 'loot_mining_copper' : def.category === 'fishing' ? 'loot_fishing_blackwater' : null),
            note: def.note || ''
          };
        },

        setResourceAt(x, y, resourceId) {
          const grid = this.currentResourceGrid();
          const node = this.makeResourceNode(resourceId, x, y);
          if (!node) return false;
          grid[this.attrKey(x, y)] = node;
          return true;
        },

        clearResourceAt(x, y) {
          const grid = this.currentResourceGrid();
          delete grid[this.attrKey(x, y)];
          return true;
        },

        pickResource(ref) {
          const node = this.getResourceAt(ref.x, ref.y);
          if (!node) {
            this.game.log('No resource node on that tile.');
            return;
          }
          this.selectedResourceType = node.type || node.id;
          const def = this.resourceTypeById(this.selectedResourceType);
          this.tool = def?.category === 'herb' ? 'Herb Node'
            : def?.category === 'mining' ? 'Mining Node'
            : def?.category === 'fishing' ? 'Fishing Spot'
            : def?.category === 'chest' ? 'Chest Spawn'
            : 'Place Resource';
          this.tab = 'resources';
          this.game.log(`Picked resource: ${node.name || this.selectedResourceType}.`);
          this.refreshPanel();
        },

        currentResourceTypeList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorResourceTypes || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        resourceTypeById(id) {
          this.ensureEditorMetadata();
          return this.game.editorResourceTypes?.[id] || RESOURCE_BY_ID[id] || resourceEntries.find(entry => entry.id === id) || null;
        },

        selectedResourceTypeDef() {
          return this.resourceTypeById(this.selectedResourceType) || this.currentResourceTypeList()[0] || null;
        },

        cloneResourceType(resource) {
          return resource ? JSON.parse(JSON.stringify(resource)) : null;
        },

        makeResourceTypeId(name, category = 'resource') {
          const cleanCategory = String(category || 'resource').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'resource';
          const cleanName = String(name || 'new resource').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'node';
          let id = `${cleanCategory}_${cleanName}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorResourceTypes[id]) id = `${cleanCategory}_${cleanName}_${i++}`;
          return id;
        },

        createResourceTypeDraft() {
          this.ensureEditorMetadata();
          const name = window.prompt('Resource type name:', 'New Resource Node');
          if (!name) return false;
          const category = (window.prompt('Category herb/mining/fishing/chest/resource:', 'resource') || 'resource').trim();
          const id = this.makeResourceTypeId(name, category);
          const skill = window.prompt('Profession skill:', category === 'mining' ? 'Mining' : category === 'fishing' ? 'Fishing' : category === 'herb' ? 'Gathering' : 'Gathering') || 'Gathering';
          const tool = window.prompt('Required tool:', category === 'mining' ? 'Pickaxe' : category === 'fishing' ? 'Fishing Rod' : 'Hands') || 'Hands';
          const respawnSeconds = Math.max(1, Math.floor(Number(window.prompt('Respawn seconds:', category === 'chest' ? '900' : '180')) || 180));
          const resource = {
            id,
            name: name.trim(),
            category,
            tool,
            skill,
            color: window.prompt('Editor color:', '#9fdc8f') || '#9fdc8f',
            label: (window.prompt('Map label, 1-2 chars:', String(name.trim()[0] || 'R').toUpperCase()) || 'R').slice(0, 2),
            respawnSeconds,
            drops: [],
            rareDrops: [],
            lootTableId: category === 'chest' ? 'loot_common_chest' : category === 'herb' ? 'loot_gathering_herbs' : category === 'mining' ? 'loot_mining_copper' : category === 'fishing' ? 'loot_fishing_blackwater' : null,
            note: window.prompt('Design notes:', `${name.trim()} editor resource definition.`) || `${name.trim()} editor resource definition.`
          };
          this.game.editorResourceTypes[id] = resource;
          this.selectedResourceType = id;
          this.markDirty(`Created resource definition: ${resource.name}.`);
          return true;
        },

        editSelectedResourceType() {
          this.ensureEditorMetadata();
          const resource = this.selectedResourceTypeDef();
          if (!resource) return false;
          const updated = this.cloneResourceType(resource);
          const name = window.prompt('Resource type name:', updated.name || updated.id);
          if (!name) return false;
          updated.name = name.trim();
          updated.category = (window.prompt('Category:', updated.category || 'resource') || updated.category || 'resource').trim();
          updated.skill = window.prompt('Profession skill:', updated.skill || 'Gathering') || updated.skill || 'Gathering';
          updated.tool = window.prompt('Required tool:', updated.tool || 'Hands') || updated.tool || 'Hands';
          updated.respawnSeconds = Math.max(1, Math.floor(Number(window.prompt('Respawn seconds:', updated.respawnSeconds ?? 180)) || 180));
          updated.color = window.prompt('Editor color:', updated.color || '#9fdc8f') || updated.color || '#9fdc8f';
          updated.label = (window.prompt('Map label:', updated.label || 'R') || updated.label || 'R').slice(0, 2);
          updated.lootTableId = window.prompt('Default loot table id:', updated.lootTableId || '') || updated.lootTableId || null;
          updated.note = window.prompt('Design notes:', updated.note || '') || updated.note || '';
          this.game.editorResourceTypes[updated.id] = updated;
          this.markDirty(`Updated resource definition: ${updated.name}.`);
          return true;
        },

        duplicateSelectedResourceType() {
          this.ensureEditorMetadata();
          const resource = this.selectedResourceTypeDef();
          if (!resource) return false;
          const copy = this.cloneResourceType(resource);
          copy.name = `${resource.name || resource.id} Copy`;
          copy.id = this.makeResourceTypeId(copy.name, copy.category || 'resource');
          copy.note = 'Duplicated in the Dream Realms resource editor.';
          this.game.editorResourceTypes[copy.id] = copy;
          this.selectedResourceType = copy.id;
          this.markDirty(`Duplicated resource definition: ${copy.name}.`);
          return true;
        },

        deleteSelectedResourceType() {
          this.ensureEditorMetadata();
          const resource = this.selectedResourceTypeDef();
          if (!resource) return false;
          if (!window.confirm(`Delete resource definition "${resource.name || resource.id}"? Placed nodes with this id will be cleaned by Validate Map if not reassigned.`)) return false;
          delete this.game.editorResourceTypes[resource.id];
          const next = this.currentResourceTypeList()[0];
          this.selectedResourceType = next?.id || 'herb_gloomleaf';
          this.markDirty(`Deleted resource definition: ${resource.name || resource.id}.`);
          return true;
        },

        normalizeAttr(attr) {
          if (!attr || typeof attr !== 'object') return null;
          const out = {};
          for (const [key, value] of Object.entries(attr)) {
            if (value === false || value == null) continue;
            out[key] = value;
          }
          if (out.block && out.unblock) delete out.unblock;
          if (out.unblock && out.block) delete out.block;
          return Object.keys(out).length ? out : null;
        },

        setAttributeAt(x, y, attrDelta) {
          const grid = this.currentAttrGrid();
          const key = this.attrKey(x, y);
          const next = this.normalizeAttr({ ...(grid[key] || {}), ...(attrDelta || {}) });
          if (next) grid[key] = next;
          else delete grid[key];
          this.syncBlockedAt(x, y);
          return true;
        },

        clearAttributeAt(x, y) {
          const grid = this.currentAttrGrid();
          delete grid[this.attrKey(x, y)];
          this.syncBlockedAt(x, y);
          return true;
        },

        setWarpAt(x, y) {
          const zoneKey = this.currentZoneKey();
          const targetZone = this.selectedWarpTarget === zoneKey
            ? (zoneKey === 'dark_woods' ? 'mossfang_cave' : 'dark_woods')
            : this.selectedWarpTarget;
          return this.setAttributeAt(x, y, {
            warp: {
              targetZone,
              targetX: targetZone === 'dark_woods' ? (CONFIG.START_X || 100) : 100,
              targetY: targetZone === 'dark_woods' ? (CONFIG.START_Y || 100) : 72,
              radius: this.zoneExitRadius
            },
            zoneExit: true
          });
        },

        setSpawnPointAt(x, y) {
          this.ensureEditorMetadata();
          const zoneKey = this.currentZoneKey();
          this.game.editorSpawnPoints[zoneKey] = { x, y };
          return this.setAttributeAt(x, y, { spawnPoint: true, safeZone: true, noMobSpawn: true });
        },

        requireCaveEditorZone(actionName = 'Cave editing') {
          if (this.game.currentZone !== 'cave') {
            this.game.log(`${actionName} requires entering Mossfang Cave first.`);
            return false;
          }
          return true;
        },

        activeCaveTheme() {
          return caveThemeEntries.find(entry => entry.id === this.selectedCaveTheme)
            || caveThemeEntries[0];
        },

        activeCaveMeta() {
          this.ensureEditorMetadata();
          return this.game.caveEditorMeta.mossfang_cave;
        },

        setCaveTheme(themeId) {
          const theme = caveThemeEntries.find(entry => entry.id === themeId) || caveThemeEntries[0];
          this.selectedCaveTheme = theme.id;
          const meta = this.activeCaveMeta();
          meta.theme = theme.id;
          meta.themeName = theme.name;
          meta.themeNote = theme.note;
          this.afterEdit(`Cave theme set to ${theme.name}.`);
        },

        editCaveProperties() {
          const meta = this.activeCaveMeta();
          const name = window.prompt('Cave name:', meta.name || 'Mossfang Cave');
          if (!name) return;
          const floorsRaw = window.prompt('Number of cave floors planned:', String(meta.floors || 1));
          const floors = Number(floorsRaw);
          const mobFamily = window.prompt('Cave mob family/theme:', meta.mobFamily || 'cave_wolves');
          meta.name = name.trim();
          meta.floors = Number.isFinite(floors) ? Math.max(1, Math.min(8, Math.floor(floors))) : (meta.floors || 1);
          meta.mobFamily = (mobFamily || meta.mobFamily || 'cave_wolves').trim();
          const props = this.game.zoneProperties.mossfang_cave || {};
          this.game.zoneProperties.mossfang_cave = { ...props, name: meta.name, caveTheme: meta.theme, floors: meta.floors, mobFamily: meta.mobFamily };
          this.afterEdit(`Updated cave properties: ${meta.name}.`);
          this.refreshPanel();
        },

        caveObjectForTheme(x, y, open) {
          if (!open) return null;
          const theme = this.activeCaveTheme();
          const r = seededNoise(x, y, 7100 + theme.id.length * 13);
          if (theme.id === 'silkweb') {
            if (r > 0.965) return { type: 'mushroom' };
            if (r > 0.935) return { type: 'rock' };
            return null;
          }
          if (theme.id === 'hollowroot') {
            if (r > 0.965) return { type: 'brush' };
            if (r > 0.94) return { type: 'mushroom' };
            if (r > 0.915) return { type: 'rock' };
            return null;
          }
          if (theme.id === 'emberstone') {
            if (r > 0.94) return { type: 'rock' };
            if (r > 0.925) return { type: 'mushroom' };
            return null;
          }
          if (r > 0.965) return { type: 'mushroom' };
          if (r > 0.93) return { type: 'rock' };
          if (r > 0.91) return { type: 'grassTuft' };
          return null;
        },

        generateCavePreset(sizeId) {
          if (!this.requireCaveEditorZone('Generating a cave layout')) return;
          const preset = caveLayoutPresets.find(entry => entry.id === sizeId) || caveLayoutPresets[0];
          this.selectedCavePreset = preset.id;
          const ok = window.confirm(`Generate ${preset.name}? This replaces the current cave tile/object layout. Undo is not stored for full-cave generation; export first if needed.`);
          if (!ok) return;
          const size = this.activeSize();
          const cx = CONFIG.START_X || Math.floor(size / 2);
          const cy = CONFIG.START_Y || Math.floor(size / 2);
          const rooms = [];
          const theme = this.activeCaveTheme();
          for (let i = 0; i < preset.roomCount; i++) {
            const angle = (Math.PI * 2 * i) / Math.max(1, preset.roomCount) + seededNoise(i, preset.radius, 2200) * 0.9;
            const dist = i === 0 ? 0 : preset.radius * (0.28 + seededNoise(i, preset.roomCount, 2201) * 0.62);
            rooms.push({
              x: Math.round(cx + Math.cos(angle) * dist),
              y: Math.round(cy + Math.sin(angle) * dist * 0.74),
              rx: Math.round(6 + seededNoise(i, 3, 2202) * (preset.id === 'small' ? 4 : preset.id === 'big' ? 7 : 10)),
              ry: Math.round(5 + seededNoise(i, 8, 2203) * (preset.id === 'small' ? 4 : preset.id === 'big' ? 6 : 9))
            });
          }

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const tile = this.game.map[y][x];
              tile.type = TILE.CAVE_WALL;
              tile.elev = 5;
              tile.blocked = true;
              this.game.objects[y][x] = null;
            }
          }

          const carveFloor = (x, y, elev = 0) => {
            const tile = this.game.map?.[y]?.[x];
            if (!tile) return;
            tile.type = TILE.CAVE_FLOOR;
            tile.elev = elev;
            tile.blocked = false;
          };
          const carveEllipse = room => {
            for (let y = room.y - room.ry; y <= room.y + room.ry; y++) {
              for (let x = room.x - room.rx; x <= room.x + room.rx; x++) {
                const nx = (x - room.x) / Math.max(1, room.rx);
                const ny = (y - room.y) / Math.max(1, room.ry);
                if (nx * nx + ny * ny <= 1.05) carveFloor(x, y, Math.floor(seededNoise(x, y, 3301) * 2));
              }
            }
          };
          const carveLine = (a, b, width) => {
            const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
            for (let i = 0; i <= steps; i++) {
              const x = Math.round(a.x + (b.x - a.x) * (i / steps));
              const y = Math.round(a.y + (b.y - a.y) * (i / steps));
              for (let oy = -width; oy <= width; oy++) {
                for (let ox = -width; ox <= width; ox++) {
                  if (ox * ox + oy * oy <= width * width + 0.5) carveFloor(x + ox, y + oy, Math.floor(seededNoise(x + ox, y + oy, 3302) * 2));
                }
              }
            }
          };

          rooms.forEach(carveEllipse);
          for (let i = 1; i < rooms.length; i++) carveLine(rooms[i - 1], rooms[i], preset.id === 'small' ? 2 : preset.id === 'big' ? 3 : 4);
          if (rooms.length > 3) carveLine(rooms[0], rooms[rooms.length - 1], preset.id === 'large' ? 3 : 2);

          const exitY = Math.max(8, cy - preset.radius + 2);
          this.game.caveExit = { x: cx, y: exitY, radius: preset.id === 'small' ? 4.5 : preset.id === 'big' ? 5.2 : 6.2 };
          for (let y = exitY - 3; y <= exitY + 9; y++) {
            for (let x = cx - 10; x <= cx + 10; x++) {
              if (!this.game.map[y]?.[x]) continue;
              const dx = Math.abs(x - cx);
              if (y <= exitY + 1 && dx <= 9) {
                this.game.map[y][x].type = TILE.CAVE_WALL;
                this.game.map[y][x].elev = 5;
                this.game.map[y][x].blocked = true;
                this.game.objects[y][x] = null;
              } else if (dx <= 10) {
                carveFloor(x, y, 0);
                this.game.objects[y][x] = null;
              }
            }
          }
          this.game.objects[this.game.caveExit.y][this.game.caveExit.x] = { type: 'caveExit', scale: preset.id === 'large' ? 3.75 : 3.25 };

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const tile = this.game.map[y][x];
              if (tile.type !== TILE.CAVE_FLOOR) continue;
              const obj = this.caveObjectForTheme(x, y, true);
              if (obj && Math.hypot(x - cx, y - cy) > 8 && Math.hypot(x - this.game.caveExit.x, y - this.game.caveExit.y) > 12) {
                this.game.objects[y][x] = obj;
                if (obj.type === 'rock') tile.blocked = true;
              }
            }
          }

          const meta = this.activeCaveMeta();
          meta.size = preset.id;
          meta.theme = theme.id;
          meta.themeName = theme.name;
          meta.lastGeneratedAt = new Date().toISOString();
          this.game.caveEnemies = [];
          this.game.enemies = [];
          this.markDirty(`Generated ${preset.name} with ${theme.name} theme.`);
          this.game.staticMinimap = this.game.buildStaticMinimap?.();
          this.game.mapDirty = true;
          this.refreshPanel();
        },

        carveCaveRoom(ref) {
          if (!this.requireCaveEditorZone('Cave room carving')) return;
          const radius = Math.max(3, Number(this.caveRoomRadius) || 8);
          const coords = [];
          for (let y = ref.y - radius; y <= ref.y + radius; y++) {
            for (let x = ref.x - radius; x <= ref.x + radius; x++) {
              const dx = (x - ref.x) / radius;
              const dy = (y - ref.y) / Math.max(2, radius * 0.72);
              if (dx * dx + dy * dy <= 1 && this.game.map?.[y]?.[x]) coords.push({ x, y });
            }
          }
          const snapshot = this.beginHistory('Carve cave room', coords);
          for (const coord of coords) {
            const tile = this.game.map[coord.y][coord.x];
            tile.type = TILE.CAVE_FLOOR;
            tile.elev = Math.floor(seededNoise(coord.x, coord.y, 6120) * 2);
            tile.blocked = false;
            this.game.objects[coord.y][coord.x] = null;
          }
          if (this.commitHistory(snapshot)) this.afterEdit(`Carved cave room at ${ref.x},${ref.y}.`);
        },

        carveCaveTunnel(ref) {
          if (!this.requireCaveEditorZone('Cave tunnel carving')) return;
          if (!this.rectAnchor) {
            this.rectAnchor = { x: ref.x, y: ref.y };
            this.game.log(`Cave tunnel start set at ${ref.x},${ref.y}. Click tunnel end.`);
            return;
          }
          const a = this.rectAnchor;
          const b = ref;
          const width = Math.max(1, Number(this.caveTunnelWidth) || 3);
          const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
          const coords = [];
          const seen = new Set();
          for (let i = 0; i <= steps; i++) {
            const x = Math.round(a.x + (b.x - a.x) * (i / steps));
            const y = Math.round(a.y + (b.y - a.y) * (i / steps));
            for (let oy = -width; oy <= width; oy++) {
              for (let ox = -width; ox <= width; ox++) {
                if (ox * ox + oy * oy > width * width + 0.5) continue;
                const tx = x + ox;
                const ty = y + oy;
                if (!this.game.map?.[ty]?.[tx]) continue;
                const key = `${tx},${ty}`;
                if (seen.has(key)) continue;
                seen.add(key);
                coords.push({ x: tx, y: ty });
              }
            }
          }
          const snapshot = this.beginHistory('Carve cave tunnel', coords);
          for (const coord of coords) {
            const tile = this.game.map[coord.y][coord.x];
            tile.type = TILE.CAVE_FLOOR;
            tile.elev = Math.floor(seededNoise(coord.x, coord.y, 6121) * 2);
            tile.blocked = false;
            this.game.objects[coord.y][coord.x] = null;
          }
          this.rectAnchor = null;
          if (this.commitHistory(snapshot)) this.afterEdit(`Carved cave tunnel (${coords.length} cells).`);
        },

        editLevelRange() {
          this.ensureEditorMetadata();
          const zoneKey = this.currentZoneKey();
          const props = this.game.zoneProperties[zoneKey] || {};
          const min = Number(window.prompt('Minimum level for this zone:', props.levelMin ?? 1));
          if (!Number.isFinite(min)) return;
          const max = Number(window.prompt('Maximum level for this zone:', props.levelMax ?? Math.max(1, min))); 
          if (!Number.isFinite(max)) return;
          this.game.zoneProperties[zoneKey] = { ...props, levelMin: Math.max(1, Math.floor(min)), levelMax: Math.max(Math.floor(min), Math.floor(max)) };
          this.afterEdit(`Updated ${zoneKey} level range.`);
        },

        editZoneProperties() {
          this.ensureEditorMetadata();
          const zoneKey = this.currentZoneKey();
          const props = this.game.zoneProperties[zoneKey] || {};
          const displayName = window.prompt('Zone display name:', props.name || (zoneKey === 'dark_woods' ? 'Dark Woods' : 'Mossfang Cave'));
          if (!displayName) return;
          this.game.zoneProperties[zoneKey] = { ...props, name: displayName.trim() };
          this.afterEdit(`Updated ${zoneKey} properties.`);
        },

        syncBlockedAt(x, y) {
          const tile = this.game.map?.[y]?.[x];
          if (!tile) return false;
          const obj = this.game.objects?.[y]?.[x] || null;
          const attr = this.getAttrAt(x, y);
          const naturalBlocked = !Boolean(TILE_DEF[tile.type]?.walk) || Boolean(obj && solidObjectTypes.has(obj.type));
          tile.blocked = attr?.block ? true : (attr?.unblock ? false : naturalBlocked);
          return true;
        },

        cloneCellState(x, y) {
          const tile = this.game.map?.[y]?.[x] || null;
          const obj = this.game.objects?.[y]?.[x] || null;
          return {
            x,
            y,
            tile: tile ? { type: Number(tile.type), elev: Number(tile.elev) || 0, blocked: Boolean(tile.blocked) } : null,
            obj: obj ? JSON.parse(JSON.stringify(obj)) : null,
            attr: this.getAttrAt(x, y) ? JSON.parse(JSON.stringify(this.getAttrAt(x, y))) : null,
            resource: this.getResourceAt(x, y) ? JSON.parse(JSON.stringify(this.getResourceAt(x, y))) : null,
            event: this.getEventAt(x, y) ? JSON.parse(JSON.stringify(this.getEventAt(x, y))) : null,
            npc: this.getNpcAt(x, y) ? JSON.parse(JSON.stringify(this.getNpcAt(x, y))) : null,
            mobSpawn: this.getMobSpawnAt(x, y) ? JSON.parse(JSON.stringify(this.getMobSpawnAt(x, y))) : null,
            dungeonMarker: this.getDungeonMarkerAt(x, y) ? JSON.parse(JSON.stringify(this.getDungeonMarkerAt(x, y))) : null
          };
        },

        sameCellState(a, b) {
          return JSON.stringify(a?.tile || null) === JSON.stringify(b?.tile || null)
            && JSON.stringify(a?.obj || null) === JSON.stringify(b?.obj || null)
            && JSON.stringify(a?.attr || null) === JSON.stringify(b?.attr || null)
            && JSON.stringify(a?.resource || null) === JSON.stringify(b?.resource || null)
            && JSON.stringify(a?.event || null) === JSON.stringify(b?.event || null)
            && JSON.stringify(a?.npc || null) === JSON.stringify(b?.npc || null)
            && JSON.stringify(a?.mobSpawn || null) === JSON.stringify(b?.mobSpawn || null)
            && JSON.stringify(a?.dungeonMarker || null) === JSON.stringify(b?.dungeonMarker || null);
        },

        uniqueCoords(coords) {
          const out = [];
          const seen = new Set();
          for (const coord of coords || []) {
            if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) continue;
            const x = Math.floor(coord.x);
            const y = Math.floor(coord.y);
            if (!this.game.map?.[y]?.[x]) continue;
            const key = `${x},${y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ x, y });
          }
          return out;
        },

        beginHistory(label, coords) {
          const cleanCoords = this.uniqueCoords(coords);
          return {
            label,
            before: cleanCoords.map(coord => this.cloneCellState(coord.x, coord.y))
          };
        },

        commitHistory(snapshot) {
          if (!snapshot || this.isApplyingHistory) return false;
          const after = snapshot.before.map(cell => this.cloneCellState(cell.x, cell.y));
          const before = [];
          const changedAfter = [];
          for (let i = 0; i < snapshot.before.length; i++) {
            if (!this.sameCellState(snapshot.before[i], after[i])) {
              before.push(snapshot.before[i]);
              changedAfter.push(after[i]);
            }
          }
          if (!before.length) return false;
          this.undoStack.push({ label: snapshot.label, before, after: changedAfter });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack.length = 0;
          return true;
        },

        restoreCells(cells) {
          for (const cell of cells || []) {
            if (!this.game.map?.[cell.y]?.[cell.x]) continue;
            if (cell.tile) {
              this.game.map[cell.y][cell.x] = {
                type: Number(cell.tile.type),
                elev: Number(cell.tile.elev) || 0,
                blocked: Boolean(cell.tile.blocked)
              };
            }
            if (this.game.objects?.[cell.y]) {
              this.game.objects[cell.y][cell.x] = cell.obj ? JSON.parse(JSON.stringify(cell.obj)) : null;
            }
            const grid = this.currentAttrGrid();
            const key = this.attrKey(cell.x, cell.y);
            if (cell.attr) grid[key] = JSON.parse(JSON.stringify(cell.attr));
            else delete grid[key];
            const resourceGrid = this.currentResourceGrid();
            if (cell.resource) resourceGrid[key] = JSON.parse(JSON.stringify(cell.resource));
            else delete resourceGrid[key];
            const eventGrid = this.currentEventGrid();
            if (cell.event) eventGrid[key] = JSON.parse(JSON.stringify(cell.event));
            else delete eventGrid[key];
            const npcGrid = this.currentNpcGrid();
            if (cell.npc) npcGrid[key] = JSON.parse(JSON.stringify(cell.npc));
            else delete npcGrid[key];
            const mobGrid = this.currentMobSpawnGrid();
            if (cell.mobSpawn) mobGrid[key] = JSON.parse(JSON.stringify(cell.mobSpawn));
            else delete mobGrid[key];
            const dungeonGrid = this.currentDungeonMarkerGrid();
            if (cell.dungeonMarker) dungeonGrid[key] = JSON.parse(JSON.stringify(cell.dungeonMarker));
            else delete dungeonGrid[key];
            this.syncBlockedAt(cell.x, cell.y);
          }
          this.game.staticMinimap = null;
          this.game.mapDirty = true;
          this.game.worldSaveDirty = true;
        },

        undo() {
          const entry = this.undoStack.pop();
          if (!entry) {
            this.game.log('Editor undo stack is empty.');
            return;
          }
          this.isApplyingHistory = true;
          this.restoreCells(entry.before);
          this.isApplyingHistory = false;
          this.redoStack.push(entry);
          this.afterEdit(`Undo: ${entry.label}.`);
        },

        redo() {
          const entry = this.redoStack.pop();
          if (!entry) {
            this.game.log('Editor redo stack is empty.');
            return;
          }
          this.isApplyingHistory = true;
          this.restoreCells(entry.after);
          this.isApplyingHistory = false;
          this.undoStack.push(entry);
          this.afterEdit(`Redo: ${entry.label}.`);
        },

        clearSelection() {
          this.selected = null;
          this.hovered = null;
          this.rectAnchor = null;
          this.lastPaintKey = '';
          this.game.log('Editor selection cleared.');
          this.refreshPanel();
        },

        currentProfessionList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorProfessions || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedProfession() {
          this.ensureEditorMetadata();
          return this.game.editorProfessions?.[this.selectedProfessionId] || PROFESSION_BY_ID[this.selectedProfessionId] || professionEntries[0] || null;
        },

        currentStationList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorCraftingStations || {}).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        selectedStation() {
          this.ensureEditorMetadata();
          return this.game.editorCraftingStations?.[this.selectedStationId] || CRAFTING_STATION_BY_ID[this.selectedStationId] || craftingStationEntries[0] || null;
        },


        stationForObjectType(objectType) {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorCraftingStations || {}).find(station => String(station.objectType || '') === String(objectType || '')) || null;
        },

        setCraftingStationAt(x, y, stationId) {
          if (!this.game.objects?.[y]) return false;
          const station = this.game.editorCraftingStations?.[stationId] || CRAFTING_STATION_BY_ID[stationId] || this.selectedStation();
          if (!station?.objectType) return false;
          this.game.objects[y][x] = {
            type: station.objectType,
            stationId: station.id,
            craftingStationId: station.id,
            name: station.name || station.id,
            blocked: Boolean(station.blocked || station.solid)
          };
          this.syncBlockedAt(x, y);
          return true;
        },

        clearCraftingStationAt(x, y) {
          if (!this.game.objects?.[y]) return false;
          const obj = this.game.objects[y][x];
          const isStation = Boolean(obj && (obj.stationId || obj.craftingStationId || this.stationForObjectType(obj.type)));
          if (!isStation) return false;
          this.game.objects[y][x] = null;
          this.syncBlockedAt(x, y);
          return true;
        },

        pickCraftingStation(ref) {
          const obj = ref?.obj || this.game.objects?.[ref?.y]?.[ref?.x] || null;
          const station = obj?.stationId
            ? (this.game.editorCraftingStations?.[obj.stationId] || CRAFTING_STATION_BY_ID[obj.stationId])
            : obj?.craftingStationId
              ? (this.game.editorCraftingStations?.[obj.craftingStationId] || CRAFTING_STATION_BY_ID[obj.craftingStationId])
              : this.stationForObjectType(obj?.type);
          if (!station) {
            this.game.log('No crafting station on that tile.');
            return false;
          }
          this.selectedStationId = station.id;
          this.tool = 'Place Station';
          this.tab = 'crafting';
          this.game.log(`Picked crafting station: ${station.name || station.id}.`);
          this.refreshPanel();
          return true;
        },

        currentRecipeList() {
          this.ensureEditorMetadata();
          return Object.values(this.game.editorRecipes || {}).sort((a, b) => {
            const prof = String(a.profession || '').localeCompare(String(b.profession || ''));
            if (prof) return prof;
            return String(a.name || a.id).localeCompare(String(b.name || b.id));
          });
        },

        selectedRecipe() {
          this.ensureEditorMetadata();
          return this.game.editorRecipes?.[this.selectedRecipeId] || CRAFTING_RECIPE_BY_ID[this.selectedRecipeId] || recipeEntries[0] || null;
        },

        cloneRecipe(recipe) {
          return recipe ? JSON.parse(JSON.stringify(recipe)) : null;
        },

        makeRecipeId(name, profession = 'crafting') {
          const cleanProfession = String(profession || 'crafting').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'crafting';
          const cleanName = String(name || 'new recipe').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'recipe';
          let id = `recipe_${cleanProfession}_${cleanName}`;
          let i = 2;
          this.ensureEditorMetadata();
          while (this.game.editorRecipes[id]) id = `recipe_${cleanProfession}_${cleanName}_${i++}`;
          return id;
        },

        createRecipeDraft() {
          this.ensureEditorMetadata();
          const selected = this.selectedRecipe();
          const name = window.prompt('Recipe name:', 'New Dream Realms Recipe');
          if (!name) return false;
          const profession = (window.prompt('Profession id:', selected?.profession || this.selectedProfessionId || 'cooking') || 'cooking').trim();
          const stationId = (window.prompt('Station id:', selected?.stationId || this.selectedStationId || 'station_campfire') || 'station_campfire').trim();
          const inputId = (window.prompt('Input item id:', selected?.inputs?.[0]?.itemId || this.selectedItemId || 'item_gloomleaf') || 'item_gloomleaf').trim();
          const inputQty = Math.max(1, Math.floor(Number(window.prompt('Input quantity:', selected?.inputs?.[0]?.quantity ?? 1)) || 1));
          const outputId = (window.prompt('Output item id:', selected?.outputs?.[0]?.itemId || this.selectedItemId || inputId) || inputId).trim();
          const outputQty = Math.max(1, Math.floor(Number(window.prompt('Output quantity:', selected?.outputs?.[0]?.quantity ?? 1)) || 1));
          const id = this.makeRecipeId(name, profession);
          const recipe = {
            id,
            name: name.trim(),
            profession,
            stationId,
            tier: Math.max(1, Math.floor(Number(window.prompt('Recipe tier:', selected?.tier ?? 1)) || 1)),
            levelRequirement: Math.max(1, Math.floor(Number(window.prompt('Profession level requirement:', selected?.levelRequirement ?? 1)) || 1)),
            craftTimeSeconds: Math.max(1, Number(window.prompt('Craft time seconds:', selected?.craftTimeSeconds ?? 5)) || 5),
            successChance: clamp(Number(window.prompt('Success chance 0-1:', selected?.successChance ?? 0.9)) || 0.9, 0, 1),
            inputs: [{ itemId: inputId, quantity: inputQty }],
            outputs: [{ itemId: outputId, quantity: outputQty }],
            xp: Math.max(0, Math.floor(Number(window.prompt('Profession XP:', selected?.xp ?? 10)) || 0)),
            unlocks: [],
            notes: window.prompt('Recipe notes:', `${name.trim()} editor recipe draft.`) || `${name.trim()} editor recipe draft.`
          };
          this.game.editorRecipes[id] = recipe;
          this.selectedRecipeId = id;
          this.selectedProfessionId = profession;
          this.selectedStationId = stationId;
          this.markDirty(`Created recipe: ${recipe.name}.`);
          return true;
        },

        editSelectedRecipe() {
          this.ensureEditorMetadata();
          const recipe = this.selectedRecipe();
          if (!recipe) return false;
          const updated = this.cloneRecipe(recipe);
          const name = window.prompt('Recipe name:', updated.name || updated.id);
          if (!name) return false;
          updated.name = name.trim();
          updated.profession = (window.prompt('Profession id:', updated.profession || 'cooking') || updated.profession || 'cooking').trim();
          updated.stationId = (window.prompt('Station id:', updated.stationId || 'station_campfire') || updated.stationId || 'station_campfire').trim();
          updated.tier = Math.max(1, Math.floor(Number(window.prompt('Recipe tier:', updated.tier ?? 1)) || 1));
          updated.levelRequirement = Math.max(1, Math.floor(Number(window.prompt('Profession level requirement:', updated.levelRequirement ?? 1)) || 1));
          updated.craftTimeSeconds = Math.max(1, Number(window.prompt('Craft time seconds:', updated.craftTimeSeconds ?? 5)) || 5);
          updated.successChance = clamp(Number(window.prompt('Success chance 0-1:', updated.successChance ?? 0.9)) || 0.9, 0, 1);
          updated.xp = Math.max(0, Math.floor(Number(window.prompt('Profession XP:', updated.xp ?? 10)) || 0));
          const inputId = (window.prompt('Primary input item id:', updated.inputs?.[0]?.itemId || 'item_gloomleaf') || updated.inputs?.[0]?.itemId || 'item_gloomleaf').trim();
          const inputQty = Math.max(1, Math.floor(Number(window.prompt('Primary input quantity:', updated.inputs?.[0]?.quantity ?? 1)) || 1));
          const outputId = (window.prompt('Primary output item id:', updated.outputs?.[0]?.itemId || inputId) || updated.outputs?.[0]?.itemId || inputId).trim();
          const outputQty = Math.max(1, Math.floor(Number(window.prompt('Primary output quantity:', updated.outputs?.[0]?.quantity ?? 1)) || 1));
          updated.inputs = [{ ...(updated.inputs?.[0] || {}), itemId: inputId, quantity: inputQty }];
          updated.outputs = [{ ...(updated.outputs?.[0] || {}), itemId: outputId, quantity: outputQty }];
          updated.notes = window.prompt('Recipe notes:', updated.notes || '') || updated.notes || '';
          this.game.editorRecipes[updated.id] = updated;
          this.selectedProfessionId = updated.profession;
          this.selectedStationId = updated.stationId;
          this.markDirty(`Updated recipe: ${updated.name}.`);
          return true;
        },

        duplicateSelectedRecipe() {
          this.ensureEditorMetadata();
          const recipe = this.selectedRecipe();
          if (!recipe) return false;
          const copy = this.cloneRecipe(recipe);
          copy.name = `${recipe.name || recipe.id} Copy`;
          copy.id = this.makeRecipeId(copy.name, copy.profession || 'crafting');
          copy.notes = 'Duplicated in the Dream Realms crafting editor.';
          this.game.editorRecipes[copy.id] = copy;
          this.selectedRecipeId = copy.id;
          this.markDirty(`Duplicated recipe: ${copy.name}.`);
          return true;
        },

        deleteSelectedRecipe() {
          this.ensureEditorMetadata();
          const recipe = this.selectedRecipe();
          if (!recipe) return false;
          if (!window.confirm(`Delete recipe draft "${recipe.name || recipe.id}"?`)) return false;
          delete this.game.editorRecipes[recipe.id];
          const next = this.currentRecipeList()[0];
          this.selectedRecipeId = next?.id || 'recipe_roasted_darkwater_fish';
          this.markDirty(`Deleted recipe: ${recipe.name || recipe.id}.`);
          return true;
        },

        assignSelectedRecipeToStation() {
          this.ensureEditorMetadata();
          const recipe = this.selectedRecipe();
          const station = this.selectedStation();
          if (!recipe || !station) return false;
          recipe.stationId = station.id;
          recipe.profession = station.profession || recipe.profession;
          this.game.editorRecipes[recipe.id] = recipe;
          this.selectedProfessionId = recipe.profession;
          this.markDirty(`Assigned ${recipe.name || recipe.id} to ${station.name || station.id}.`);
          return true;
        },

        professionSummary(profession) {
          if (!profession) return 'none';
          return `${profession.name || profession.id} · ${profession.category || 'profession'} · tool ${profession.tool || 'n/a'} · max ${profession.maxRank || 100}`;
        },

        stationSummary(station) {
          if (!station) return 'none';
          return `${station.name || station.id} · ${station.profession || 'profession'} · object ${station.objectType || 'none'}`;
        },

        recipeSummary(recipe) {
          if (!recipe) return 'none';
          const input = recipe.inputs?.[0] ? `${recipe.inputs[0].quantity || 1}x ${recipe.inputs[0].itemId}` : 'no input';
          const output = recipe.outputs?.[0] ? `${recipe.outputs[0].quantity || 1}x ${recipe.outputs[0].itemId}` : 'no output';
          return `${recipe.name || recipe.id} · ${recipe.profession || 'crafting'} · tier ${recipe.tier || 1} · ${input} → ${output}`;
        },

        validateEditedWorld({ repair = false } = {}) {
          const size = this.activeSize();
          const detailReport = this.collectValidationDetails(size);
          let issues = 0;
          let repairs = 0;
          if (!Array.isArray(this.game.map) || this.game.map.length !== size) issues++;
          if (!Array.isArray(this.game.objects) || this.game.objects.length !== size) issues++;
          for (let y = 0; y < size; y++) {
            if (!Array.isArray(this.game.map[y])) {
              issues++;
              if (repair) {
                this.game.map[y] = [];
                repairs++;
              }
            }
            if (!Array.isArray(this.game.objects[y])) {
              issues++;
              if (repair) {
                this.game.objects[y] = [];
                repairs++;
              }
            }
            for (let x = 0; x < size; x++) {
              const tile = this.game.map?.[y]?.[x];
              if (!tile || !TILE_DEF[tile.type]) {
                issues++;
                if (repair) {
                  this.game.map[y][x] = { type: TILE.FOREST_FLOOR ?? TILE.DIRT ?? 1, elev: 0, blocked: false };
                  repairs++;
                }
              } else if (!Number.isFinite(tile.elev)) {
                issues++;
                if (repair) {
                  tile.elev = 0;
                  repairs++;
                }
              }
              const obj = this.game.objects?.[y]?.[x];
              if (obj && !safeObjectTypes.has(obj.type)) {
                issues++;
                if (repair) {
                  this.game.objects[y][x] = null;
                  repairs++;
                }
              }
              if (repair) this.syncBlockedAt(x, y);
            }
          }
          const px = Math.floor(this.game.player?.x ?? 0);
          const py = Math.floor(this.game.player?.y ?? 0);
          const playerTile = this.game.map?.[py]?.[px];
          if (this.game.player && (!playerTile || playerTile.blocked)) {
            issues++;
            if (repair) {
              const safe = this.game.findSpawnTile?.(px, py) || { x: CONFIG.START_X || 100, y: CONFIG.START_Y || 100 };
              this.game.player.x = safe.x + 0.5;
              this.game.player.y = safe.y + 0.5;
              repairs++;
            }
          }
          this.ensureEditorMetadata();
          for (const [zoneKey, grid] of Object.entries(this.game.editorAttributes || {})) {
            for (const key of Object.keys(grid || {})) {
              const [rawX, rawY] = key.split(',');
              const x = Number(rawX);
              const y = Number(rawY);
              if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) {
                issues++;
                if (repair) {
                  delete grid[key];
                  repairs++;
                }
              }
            }
          }
          for (const [_zoneKey, grid] of Object.entries(this.game.editorResources || {})) {
            for (const [key, node] of Object.entries(grid || {})) {
              const [rawX, rawY] = key.split(',');
              const x = Number(rawX);
              const y = Number(rawY);
              if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size || !node || !(new Set(this.currentResourceTypeList().map(resource => resource.id))).has(node.type || node.id)) {
                issues++;
                if (repair) {
                  delete grid[key];
                  repairs++;
                }
              }
            }
          }

          for (const [_zoneKey, grid] of Object.entries(this.game.editorNpcs || {})) {
            for (const [key, node] of Object.entries(grid || {})) {
              const [rawX, rawY] = key.split(',');
              const x = Number(rawX);
              const y = Number(rawY);
              if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size || !node || !node.npcId) {
                issues++;
                if (repair) {
                  delete grid[key];
                  repairs++;
                }
              }
            }
          }
          for (const [_zoneKey, grid] of Object.entries(this.game.editorMobSpawns || {})) {
            for (const [key, node] of Object.entries(grid || {})) {
              const [rawX, rawY] = key.split(',');
              const x = Number(rawX);
              const y = Number(rawY);
              if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size || !node || !node.spawnId) {
                issues++;
                if (repair) {
                  delete grid[key];
                  repairs++;
                }
              }
            }
          }
          for (const [_zoneKey, grid] of Object.entries(this.game.editorDungeonMarkers || {})) {
            for (const [key, node] of Object.entries(grid || {})) {
              const [rawX, rawY] = key.split(',');
              const x = Number(rawX);
              const y = Number(rawY);
              if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size || !node || !node.dungeonId) {
                issues++;
                if (repair) {
                  delete grid[key];
                  repairs++;
                }
              }
            }
          }
          for (const [id, dungeon] of Object.entries(this.game.editorDungeons || {})) {
            if (!dungeon || typeof dungeon !== 'object' || !id || dungeon.id !== id || !dungeon.name) {
              issues++;
              if (repair) {
                delete this.game.editorDungeons[id];
                repairs++;
              }
            }
          }
          for (const [id, puzzle] of Object.entries(this.game.editorPuzzles || {})) {
            if (!puzzle || typeof puzzle !== 'object' || !id || puzzle.id !== id || !puzzle.name) {
              issues++;
              if (repair) {
                delete this.game.editorPuzzles[id];
                repairs++;
              }
            }
          }

          for (const [id, npc] of Object.entries(this.game.editorNpcDefinitions || {})) {
            if (!npc || typeof npc !== 'object' || !id || npc.id !== id || !npc.name) {
              issues++;
              if (repair) {
                delete this.game.editorNpcDefinitions[id];
                repairs++;
              }
            }
          }
          for (const [id, mob] of Object.entries(this.game.editorMobDefinitions || {})) {
            if (!mob || typeof mob !== 'object' || !id || mob.id !== id || !mob.name) {
              issues++;
              if (repair) {
                delete this.game.editorMobDefinitions[id];
                repairs++;
              }
              continue;
            }
            if (!Number.isFinite(Number(mob.hp)) || Number(mob.hp) < 1) {
              issues++;
              if (repair) {
                mob.hp = 1;
                repairs++;
              }
            }
          }
          for (const [id, spawn] of Object.entries(this.game.editorMobSpawnDefinitions || {})) {
            if (!spawn || typeof spawn !== 'object' || !id || spawn.id !== id || !spawn.name || !Array.isArray(spawn.mobIds)) {
              issues++;
              if (repair) {
                delete this.game.editorMobSpawnDefinitions[id];
                repairs++;
              }
              continue;
            }
            for (const mobId of spawn.mobIds) {
              if (mobId && !this.game.editorMobDefinitions?.[mobId]) {
                issues++;
                if (repair) spawn.missingMob = true;
              }
            }
          }

          for (const [id, item] of Object.entries(this.game.editorItems || {})) {
            if (!item || typeof item !== 'object' || !id || item.id !== id || !item.name) {
              issues++;
              if (repair) {
                delete this.game.editorItems[id];
                repairs++;
              }
            }
          }
          for (const [id, table] of Object.entries(this.game.editorLootTables || {})) {
            if (!table || typeof table !== 'object' || !id || table.id !== id || !Array.isArray(table.entries)) {
              issues++;
              if (repair) {
                delete this.game.editorLootTables[id];
                repairs++;
              }
              continue;
            }
            for (const entry of table.entries) {
              if (!entry || !entry.itemId || !this.game.editorItems?.[entry.itemId]) {
                issues++;
                if (repair && entry) entry.missingItem = true;
              }
            }
          }

          for (const [id, spell] of Object.entries(this.game.editorSpells || {})) {
            if (!spell || typeof spell !== 'object' || !id || spell.id !== id || !spell.name || !spell.className) {
              issues++;
              if (repair) {
                delete this.game.editorSpells[id];
                repairs++;
              }
              continue;
            }
            const slot = Math.floor(Number(spell.slotIndex) || 0);
            if (slot < 0 || slot > 11) {
              issues++;
              if (repair) {
                spell.slotIndex = Math.max(0, Math.min(11, slot));
                spell.hotkey = String(spell.slotIndex + 2);
                repairs++;
              }
            }
            if (!Number.isFinite(Number(spell.cooldown)) || Number(spell.cooldown) < 0) {
              issues++;
              if (repair) {
                spell.cooldown = 0;
                repairs++;
              }
            }
            if (!Number.isFinite(Number(spell.cost)) || Number(spell.cost) < 0) {
              issues++;
              if (repair) {
                spell.cost = 0;
                repairs++;
              }
            }
          }
          for (const [className, slots] of Object.entries(this.game.classSpellSlots || {})) {
            if (!Array.isArray(slots)) {
              issues++;
              if (repair) {
                this.game.classSpellSlots[className] = [];
                repairs++;
              }
              continue;
            }
            for (let i = 0; i < slots.length; i++) {
              if (slots[i] && !this.game.editorSpells?.[slots[i]]) {
                issues++;
                if (repair) {
                  slots[i] = null;
                  repairs++;
                }
              }
            }
          }

          for (const [id, resource] of Object.entries(this.game.editorResourceTypes || {})) {
            if (!resource || typeof resource !== 'object' || !id || resource.id !== id || !resource.name) {
              issues++;
              if (repair) {
                delete this.game.editorResourceTypes[id];
                repairs++;
              }
              continue;
            }
            if (!Number.isFinite(Number(resource.respawnSeconds)) || Number(resource.respawnSeconds) < 1) {
              issues++;
              if (repair) {
                resource.respawnSeconds = 180;
                repairs++;
              }
            }
          }
          for (const [id, profession] of Object.entries(this.game.editorProfessions || {})) {
            if (!profession || typeof profession !== 'object' || !id || profession.id !== id || !profession.name) {
              issues++;
              if (repair) {
                delete this.game.editorProfessions[id];
                repairs++;
              }
            }
          }
          for (const [id, station] of Object.entries(this.game.editorCraftingStations || {})) {
            if (!station || typeof station !== 'object' || !id || station.id !== id || !station.name) {
              issues++;
              if (repair) {
                delete this.game.editorCraftingStations[id];
                repairs++;
              }
              continue;
            }
            if (station.profession && !this.game.editorProfessions?.[station.profession]) {
              issues++;
              if (repair) {
                station.missingProfession = true;
                repairs++;
              }
            }
          }
          for (const [id, recipe] of Object.entries(this.game.editorRecipes || {})) {
            if (!recipe || typeof recipe !== 'object' || !id || recipe.id !== id || !recipe.name || !Array.isArray(recipe.inputs) || !Array.isArray(recipe.outputs)) {
              issues++;
              if (repair) {
                delete this.game.editorRecipes[id];
                repairs++;
              }
              continue;
            }
            if (recipe.profession && !this.game.editorProfessions?.[recipe.profession]) {
              issues++;
              if (repair) recipe.missingProfession = true;
            }
            if (recipe.stationId && !this.game.editorCraftingStations?.[recipe.stationId]) {
              issues++;
              if (repair) recipe.missingStation = true;
            }
            for (const part of [...recipe.inputs, ...recipe.outputs]) {
              if (!part?.itemId || !this.game.editorItems?.[part.itemId]) {
                issues++;
                if (repair && part) part.missingItem = true;
              }
            }
          }

          this.lastValidation = { issues, repairs, detailReport, repaired: Boolean(repair), at: new Date().toISOString() };
          this.validationSummary = this.formatValidationReport(this.lastValidation);
          if (repair && repairs) this.markDirty(`Editor validation repaired ${repairs} issue${repairs === 1 ? '' : 's'}.`);
          this.game.log(`Editor validation complete: ${issues} issue${issues === 1 ? '' : 's'}, ${repairs} repair${repairs === 1 ? '' : 's'}.`);
          this.refreshPanel();
          return { issues, repairs, detailReport };
        },

        collectValidationDetails(size = this.activeSize()) {
          this.ensureEditorMetadata();
          const report = { total: 0, categories: {}, samples: [] };
          const add = (category, message) => {
            report.total++;
            report.categories[category] = (report.categories[category] || 0) + 1;
            if (report.samples.length < 12) report.samples.push(`${category}: ${message}`);
          };
          const inBounds = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
          const scanGrid = (label, grid, validator) => {
            for (const [zoneKey, zoneGrid] of Object.entries(grid || {})) {
              if (!zoneGrid || typeof zoneGrid !== 'object' || Array.isArray(zoneGrid)) {
                add(label, `${zoneKey} grid is invalid`);
                continue;
              }
              for (const [key, node] of Object.entries(zoneGrid)) {
                const [rawX, rawY] = String(key).split(',');
                const x = Number(rawX);
                const y = Number(rawY);
                if (!inBounds(x, y)) {
                  add(label, `${zoneKey} marker ${key} is out of bounds`);
                  continue;
                }
                if (typeof validator === 'function') validator(zoneKey, key, node, x, y, add);
              }
            }
          };

          if (!Array.isArray(this.game.map) || this.game.map.length !== size) add('map', `active map row count is ${this.game.map?.length ?? 'missing'}, expected ${size}`);
          if (!Array.isArray(this.game.objects) || this.game.objects.length !== size) add('objects', `active object row count is ${this.game.objects?.length ?? 'missing'}, expected ${size}`);
          for (let y = 0; y < size; y++) {
            if (!Array.isArray(this.game.map?.[y])) add('map', `row ${y} is missing`);
            if (!Array.isArray(this.game.objects?.[y])) add('objects', `row ${y} is missing`);
            for (let x = 0; x < size; x++) {
              const tile = this.game.map?.[y]?.[x];
              if (!tile || !TILE_DEF[tile.type]) add('map', `tile ${x},${y} has invalid terrain type`);
              else if (!Number.isFinite(Number(tile.elev))) add('map', `tile ${x},${y} has invalid elevation`);
              const obj = this.game.objects?.[y]?.[x];
              if (obj && !safeObjectTypes.has(obj.type)) add('objects', `${x},${y} uses unknown object ${obj.type || 'unknown'}`);
            }
          }

          scanGrid('attributes', this.game.editorAttributes, (_zone, _key, attr, x, y) => {
            if (!attr || typeof attr !== 'object') add('attributes', `${x},${y} has invalid attribute metadata`);
          });
          scanGrid('resources', this.game.editorResources, (_zone, _key, node, x, y) => {
            const id = node?.type || node?.id;
            if (!node || !id || !this.game.editorResourceTypes?.[id]) add('resources', `${x},${y} references missing resource ${id || 'none'}`);
          });
          scanGrid('events', this.game.editorEvents, (_zone, _key, node, x, y) => {
            if (!node || typeof node !== 'object') add('events', `${x},${y} has invalid event marker`);
            if (node?.questId && !this.game.editorQuests?.[node.questId]) add('events', `${x},${y} references missing quest ${node.questId}`);
            if (node?.lootTableId && !this.game.editorLootTables?.[normalizeLootTableId(node.lootTableId)]) add('events', `${x},${y} references missing loot table ${node.lootTableId}`);
            for (const command of node?.commands || []) {
              if (command?.questId && !this.game.editorQuests?.[command.questId]) add('events', `${x},${y} command references missing quest ${command.questId}`);
              const lootId = command?.lootTable || command?.lootTableId;
              if (lootId && !this.game.editorLootTables?.[normalizeLootTableId(lootId)]) add('events', `${x},${y} command references missing loot table ${lootId}`);
            }
          });
          scanGrid('npcs', this.game.editorNpcs, (_zone, _key, node, x, y) => {
            if (!node?.npcId || !this.game.editorNpcDefinitions?.[node.npcId]) add('npcs', `${x},${y} references missing NPC ${node?.npcId || 'none'}`);
            for (const questId of node?.questIds || []) if (!this.game.editorQuests?.[questId]) add('npcs', `${x},${y} references missing quest ${questId}`);
          });
          for (const [id, npc] of Object.entries(this.game.editorNpcDefinitions || {})) {
            if (!npc || npc.id !== id || !npc.name) add('npc drafts', `${id} is malformed`);
            for (const questId of npc?.questIds || []) if (!this.game.editorQuests?.[questId]) add('npc drafts', `${id} references missing quest ${questId}`);
          }

          scanGrid('mob spawns', this.game.editorMobSpawns, (_zone, _key, node, x, y) => {
            if (!node?.spawnId || !this.game.editorMobSpawnDefinitions?.[node.spawnId]) add('mob spawns', `${x},${y} references missing spawn group ${node?.spawnId || 'none'}`);
          });
          scanGrid('dungeons', this.game.editorDungeonMarkers, (_zone, _key, node, x, y) => {
            if (!node?.dungeonId || !this.game.editorDungeons?.[node.dungeonId]) add('dungeons', `${x},${y} references missing dungeon ${node?.dungeonId || 'none'}`);
            if (node?.puzzleId && !this.game.editorPuzzles?.[node.puzzleId]) add('dungeons', `${x},${y} references missing puzzle ${node.puzzleId}`);
            if (node?.lootTableId && !this.game.editorLootTables?.[node.lootTableId]) add('dungeons', `${x},${y} references missing loot table ${node.lootTableId}`);
          });

          for (const [id, quest] of Object.entries(this.game.editorQuests || {})) {
            if (!quest || quest.id !== id || !quest.name) add('quests', `${id} is malformed`);
            for (const reward of quest?.rewards?.items || []) {
              const itemId = reward?.itemId || reward?.id || reward?.name;
              if (!itemId || !this.game.editorItems?.[itemId]) add('quests', `${id} rewards missing item ${itemId || 'none'}`);
            }
          }
          for (const [id, item] of Object.entries(this.game.editorItems || {})) {
            if (!item || item.id !== id || !item.name) add('items', `${id} is malformed`);
          }
          for (const [id, table] of Object.entries(this.game.editorLootTables || {})) {
            if (!table || table.id !== id || !Array.isArray(table.entries)) {
              add('loot tables', `${id} is malformed`);
              continue;
            }
            for (const entry of table.entries) {
              if (!entry?.itemId || !this.game.editorItems?.[entry.itemId]) add('loot tables', `${id} references missing item ${entry?.itemId || 'none'}`);
              if (!Number.isFinite(Number(entry?.weight ?? entry?.chance)) || Number(entry?.weight ?? entry?.chance) <= 0) add('loot tables', `${id} has invalid entry weight/chance for ${entry?.itemId || 'unknown'}`);
            }
          }
          for (const [id, spell] of Object.entries(this.game.editorSpells || {})) {
            if (!spell || spell.id !== id || !spell.name || !spell.className) add('spells', `${id} is malformed`);
            const slot = Math.floor(Number(spell?.slotIndex) || 0);
            if (slot < 0 || slot > 11) add('spells', `${id} has invalid hotbar slot ${spell?.slotIndex}`);
          }
          for (const [className, slots] of Object.entries(this.game.classSpellSlots || {})) {
            if (!Array.isArray(slots)) {
              add('class spell slots', `${className} slots are not an array`);
              continue;
            }
            for (const spellId of slots) if (spellId && !this.game.editorSpells?.[spellId]) add('class spell slots', `${className} references missing spell ${spellId}`);
          }
          for (const [id, mob] of Object.entries(this.game.editorMobDefinitions || {})) {
            if (!mob || mob.id !== id || !mob.name) add('mob drafts', `${id} is malformed`);
            if (mob?.lootTableId && !this.game.editorLootTables?.[normalizeLootTableId(mob.lootTableId)]) add('mob drafts', `${id} references missing loot table ${mob.lootTableId}`);
          }
          for (const [id, spawn] of Object.entries(this.game.editorMobSpawnDefinitions || {})) {
            if (!spawn || spawn.id !== id || !Array.isArray(spawn.mobIds)) add('mob spawn drafts', `${id} is malformed`);
            for (const mobId of spawn?.mobIds || []) if (!this.game.editorMobDefinitions?.[mobId]) add('mob spawn drafts', `${id} references missing mob ${mobId}`);
            if (spawn?.lootTableId && !this.game.editorLootTables?.[normalizeLootTableId(spawn.lootTableId)]) add('mob spawn drafts', `${id} references missing loot table ${spawn.lootTableId}`);
          }
          for (const [id, dungeon] of Object.entries(this.game.editorDungeons || {})) {
            if (!dungeon || dungeon.id !== id || !dungeon.name) add('dungeon drafts', `${id} is malformed`);
            for (const bossId of dungeon?.bossIds || []) if (!this.game.editorBosses?.[bossId]) add('dungeon drafts', `${id} references missing boss ${bossId}`);
            for (const puzzleId of dungeon?.puzzleIds || []) if (!this.game.editorPuzzles?.[puzzleId]) add('dungeon drafts', `${id} references missing puzzle ${puzzleId}`);
            if (dungeon?.keyItemId && !this.game.editorItems?.[dungeon.keyItemId]) add('dungeon drafts', `${id} references missing key item ${dungeon.keyItemId}`);
            for (const lootId of [dungeon?.lootTableId].filter(Boolean)) if (!this.game.editorLootTables?.[normalizeLootTableId(lootId)]) add('dungeon drafts', `${id} references missing loot table ${lootId}`);
          }
          for (const [id, puzzle] of Object.entries(this.game.editorPuzzles || {})) {
            if (!puzzle || puzzle.id !== id || !puzzle.name) add('puzzle drafts', `${id} is malformed`);
            if (puzzle?.dungeonId && !this.game.editorDungeons?.[puzzle.dungeonId]) add('puzzle drafts', `${id} references missing dungeon ${puzzle.dungeonId}`);
            for (const spawnId of puzzle?.failureSpawns || []) if (!this.game.editorMobSpawnDefinitions?.[spawnId]) add('puzzle drafts', `${id} references missing failure spawn ${spawnId}`);
          }
          for (const [id, station] of Object.entries(this.game.editorCraftingStations || {})) {
            if (!station || station.id !== id || !station.name) add('crafting stations', `${id} is malformed`);
            if (station?.profession && !this.game.editorProfessions?.[station.profession]) add('crafting stations', `${id} references missing profession ${station.profession}`);
          }
          for (const [id, recipe] of Object.entries(this.game.editorRecipes || {})) {
            if (!recipe || recipe.id !== id || !recipe.name || !Array.isArray(recipe.inputs) || !Array.isArray(recipe.outputs)) {
              add('recipes', `${id} is malformed`);
              continue;
            }
            if (recipe.profession && !this.game.editorProfessions?.[recipe.profession]) add('recipes', `${id} references missing profession ${recipe.profession}`);
            if (recipe.stationId && !this.game.editorCraftingStations?.[recipe.stationId]) add('recipes', `${id} references missing station ${recipe.stationId}`);
            for (const part of [...recipe.inputs, ...recipe.outputs]) if (!part?.itemId || !this.game.editorItems?.[part.itemId]) add('recipes', `${id} references missing item ${part?.itemId || 'none'}`);
          }

          // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
          // the validation report above already checked every entity-
          // reference category, but never checked warp targets, mob spawns
          // placed on blocked/cave-entrance tiles, or resources placed on
          // invalid tiles - all explicitly requested checks with no prior
          // coverage. These are read-only report additions to the same
          // report/add() accumulator above; they never throw and never
          // block saving.
          scanGrid('legacy warps', this.game.editorAttributes, (zoneKey, key, attr, x, y) => {
            const warp = attr?.warp;
            if (!warp) return;
            const targetZone = warp.targetZone;
            if (!targetZone || !DR.Registry?.has?.('zone', targetZone)) {
              add('warps', `${zoneKey} ${x},${y} targets unknown zone "${targetZone || 'none'}"`);
              return;
            }
            const tx = Math.floor(Number(warp.targetX));
            const ty = Math.floor(Number(warp.targetY));
            if (!inBounds(tx, ty)) add('warps', `${zoneKey} ${x},${y} warp target ${tx},${ty} is out of bounds`);
            if (targetZone === zoneKey && tx === x && ty === y) add('warps', `${zoneKey} ${x},${y} warps to itself (self-loop)`);
          });
          const layeredMaps = this.game.layeredMapEditor?.maps || {};
          for (const [mapId, map] of Object.entries(layeredMaps)) {
            for (const [key, warp] of Object.entries(map?.attributes?.warps || {})) {
              if (!warp || warp.enabled === false) continue;
              const [rawX, rawY] = String(key).split(',');
              const x = Number(rawX);
              const y = Number(rawY);
              const target = layeredMaps[warp.targetMap];
              if (!warp.targetMap || !target) {
                add('warps', `${mapId} ${key} targets unknown map "${warp.targetMap || 'none'}"`);
                continue;
              }
              const tx = Math.floor(Number(warp.targetX));
              const ty = Math.floor(Number(warp.targetY));
              if (tx < 0 || ty < 0 || tx >= (target.width || size) || ty >= (target.height || size)) {
                add('warps', `${mapId} ${key} warp target ${tx},${ty} is out of bounds for ${warp.targetMap}`);
              }
              if (warp.targetMap === mapId && tx === x && ty === y) add('warps', `${mapId} ${key} warps to itself (self-loop)`);
            }
          }

          scanGrid('mob spawn placement', this.game.editorMobSpawns, (zoneKey, _key, _node, x, y) => {
            const tile = zoneKey === this.currentZoneKey() ? this.game.map?.[y]?.[x] : null;
            if (tile?.blocked) add('mob spawn placement', `${zoneKey} ${x},${y} mob spawn is on a blocked tile`);
            // game.caveEntrances is dark_woods-only data (systems/world-serializer.js),
            // so only cross-check it against dark_woods mob spawn markers -
            // otherwise a cave zone's marker sharing the same numeric x,y as
            // a dark_woods cave entrance would be a false positive.
            if (zoneKey === 'dark_woods') {
              const entranceHit = (this.game.caveEntrances || []).some(entrance => Math.floor(Number(entrance?.x)) === x && Math.floor(Number(entrance?.y)) === y);
              if (entranceHit) add('mob spawn placement', `${zoneKey} ${x},${y} mob spawn is on a cave entrance tile`);
            }
          });
          scanGrid('resource placement', this.game.editorResources, (zoneKey, _key, _node, x, y) => {
            const tile = zoneKey === this.currentZoneKey() ? this.game.map?.[y]?.[x] : null;
            if (tile?.blocked) add('resource placement', `${zoneKey} ${x},${y} resource node is on a blocked tile`);
          });

          return report;
        },

        formatValidationReport(result) {
          const report = result?.detailReport || { total: 0, categories: {}, samples: [] };
          const lines = [];
          const issueWord = result?.issues === 1 ? 'issue' : 'issues';
          const repairWord = result?.repairs === 1 ? 'repair' : 'repairs';
          lines.push(`Validation: ${result?.issues ?? report.total} ${issueWord}, ${result?.repairs ?? 0} ${repairWord}.`);
          if (!report.total) {
            lines.push('Detailed scan: clean. No broken editor/runtime references found.');
          } else {
            const categories = Object.entries(report.categories).sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(' · ');
            lines.push(`Detailed categories: ${categories}`);
            lines.push(...report.samples.slice(0, 8).map(sample => `- ${sample}`));
          }
          if (result?.repaired) lines.push('Repair mode was enabled; structural fixes were applied where safe. Reference-only warnings are flagged but not guessed.');
          return lines.join('\n');
        },

        afterEdit(message) {
          this.changeCount++;
          this.markDirty(message);
          this.selected = this.hovered || this.selected;
          this.refreshInspector();
        },

        markDirty(message) {
          this.game.worldSaveDirty = true;
          this.game.mapDirty = true;
          this.game.staticMinimap = null;
          this.game.markItemCatalogDirty?.(message || 'editor edit');
          if (message) this.game.log(message);
        },

        refreshPanel() {
          this.refreshTabs();
          this.refreshTools();
          this.refreshPalette();
          this.applyPaletteSearch();
          this.refreshStatus();
          this.refreshInspector();
          this.refreshBrushLabel();
          this.refreshValidationPanel();
        },

        setBrushSize(value) {
          const next = Math.max(1, Math.min(9, Math.floor(Number(value) || 1)));
          this.brushSize = next % 2 === 0 ? Math.max(1, next - 1) : next;
          if (this.brushInput) this.brushInput.value = String(this.brushSize);
          this.refreshBrushLabel();
          this.refreshStatus();
        },

        clearPaletteSearch() {
          this.paletteSearch = '';
          if (this.paletteSearchInput) this.paletteSearchInput.value = '';
          this.applyPaletteSearch();
          this.refreshStatus();
        },

        focusPlayerSelection() {
          if (!this.game.player) return;
          const x = Math.floor(this.game.player.x || 0);
          const y = Math.floor(this.game.player.y || 0);
          this.selected = this.resolveTileRef(x, y);
          this.hovered = this.selected;
          this.refreshInspector();
          this.game.log(`Editor selected player tile ${x},${y}.`);
        },

        copyInspectorSummary() {
          const text = this.inspector?.textContent || '';
          if (!text) return;
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => this.game.log('Copied editor inspector summary.')).catch(() => this.game.log(text));
          } else {
            this.game.log(text);
          }
        },

        refreshValidationPanel() {
          if (this.validationPanel) this.validationPanel.textContent = this.validationSummary || 'Validation has not run yet.';
        },

        paletteSearchableSelector() {
          return [
            '[data-editor-tile]', '[data-editor-object]', '[data-editor-attr]', '[data-editor-target-zone]',
            '[data-editor-cave-theme]', '[data-editor-cave-preset]', '[data-editor-resource]', '[data-editor-profession]',
            '[data-editor-station]', '[data-editor-recipe]', '[data-editor-event]', '[data-editor-npc]',
            '[data-editor-mob]', '[data-editor-mob-spawn]', '[data-editor-dungeon]', '[data-editor-puzzle]',
            '[data-editor-quest]', '[data-editor-item]', '[data-editor-loot-table]', '[data-editor-spell]'
          ].join(',');
        },

        applyPaletteSearch() {
          if (!this.palette) return;
          const query = String(this.paletteSearchInput?.value ?? this.paletteSearch ?? '').trim().toLowerCase();
          this.paletteSearch = query;
          const buttons = Array.from(this.palette.querySelectorAll(this.paletteSearchableSelector()));
          let visible = 0;
          for (const button of buttons) {
            const haystack = [button.textContent, button.title, ...Object.values(button.dataset || {})].join(' ').toLowerCase();
            const match = !query || haystack.includes(query);
            button.classList.toggle('editor-search-hidden', !match);
            if (match) visible++;
          }
          if (this.paletteCount) {
            if (!buttons.length) this.paletteCount.textContent = 'No searchable palette entries on this tab.';
            else this.paletteCount.textContent = query ? `Filter: "${query}" · showing ${visible}/${buttons.length}` : `Showing all ${buttons.length} palette entries.`;
          }
        },

        refreshTabs() {
          if (!this.tabBar) return;
          this.tabBar.innerHTML = '';
          for (const tab of tabDefs) {
            const button = makeButton(tab.label);
            button.dataset.editorTab = tab.id;
            button.classList.toggle('active', tab.id === this.tab);
            this.tabBar.appendChild(button);
          }
        },

        refreshTools() {
          if (!this.toolList) return;
          const def = tabDefs.find(entry => entry.id === this.tab) || tabDefs[0];
          this.toolList.innerHTML = '';
          for (const tool of def.tools) {
            const button = makeButton(tool);
            button.dataset.editorTool = tool;
            button.classList.toggle('active', tool === this.tool);
            this.toolList.appendChild(button);
          }
        },

        refreshPalette() {
          if (!this.palette) return;
          this.palette.innerHTML = '';
          if (this.tab === 'layeredMap') {
            this.game.layeredMapEditor?.buildEditorTabUi?.(this.palette);
            this.game.layeredMapEditor?.refreshEditorTabUi?.();
            if (this.hint) this.hint.textContent = 'Layered-map data, tools, tilesets, attributes, and rendering are owned by the layered map controller. F9 opens this tab directly.';
            return;
          }
          if (this.tab === 'tiles') {
            const entries = tileEntries;
            for (const entry of entries) {
              const def = TILE_DEF[entry.value];
              const button = makeButton(entry.name);
              button.dataset.editorTile = String(entry.value);
              button.classList.toggle('active', Number(this.selectedTileType) === Number(entry.value));
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(def?.top || '#888')}"></span>${escapeHtml(entry.name)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Pick a tile, then use Paint Tile, Rectangle, Fill, Raise, Lower, Cave Floor, or Cave Wall.';
            return;
          }
          if (this.tab === 'objects') {
            for (const entry of objectEntries) {
              const button = makeButton(entry.name);
              button.dataset.editorObject = entry.type;
              button.classList.toggle('active', this.selectedObjectType === entry.type);
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Pick an object, then click the world to place it. Drag for quick object painting. Use None / Erase to clear objects.';
            return;
          }
          if (this.tab === 'attributes') {
            for (const entry of attributeEntries) {
              const button = makeButton(entry.name);
              button.dataset.editorAttr = entry.id;
              button.classList.toggle('active', this.selectedAttributeType === entry.id);
              button.innerHTML = `<span class="editor-swatch" style="background:${entry.color}"></span>${escapeHtml(entry.name)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Paint block/unblock overrides, safe zones, NPC avoid, no-mob-spawn, and warp markers. Clear Attribute removes editor metadata from a tile.';
            return;
          }
          if (this.tab === 'zones') {
            for (const entry of zoneTargetEntries) {
              const button = makeButton(`Target: ${entry.name}`);
              button.dataset.editorTargetZone = entry.id;
              button.classList.toggle('active', this.selectedWarpTarget === entry.id);
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Use Zone Exit to place a warp marker to the selected target. Use Spawn Point to mark the current zone start location.';
            return;
          }
          if (this.tab === 'resources') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New Resource'],
              ['edit', 'Edit Selected'],
              ['duplicate', 'Duplicate Selected'],
              ['delete', 'Delete Selected']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorResourceAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const title = document.createElement('div');
            title.className = 'editor-hint';
            title.style.flexBasis = '100%';
            title.textContent = 'Resource Definitions';
            this.palette.appendChild(title);
            for (const entry of this.currentResourceTypeList()) {
              const button = makeButton(entry.name || entry.id);
              button.dataset.editorResource = entry.id;
              button.classList.toggle('active', this.selectedResourceType === entry.id);
              button.title = entry.note || `${entry.category || 'resource'} node`;
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(entry.color || '#9fc')}"></span>${escapeHtml(entry.name || entry.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Place and edit herb, mining, fishing, chest, and custom resource definitions. Runtime gathering now consumes placed resource data.';
            return;
          }
          if (this.tab === 'events') {
            for (const entry of eventEntries) {
              const button = makeButton(entry.name || entry.id);
              button.dataset.editorEvent = entry.id;
              button.classList.toggle('active', this.selectedEventType === entry.id);
              button.title = entry.note || `${entry.category || 'event'} event`;
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(entry.color || '#ffd66e')}"></span>${escapeHtml(entry.name || entry.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Place event markers for dialogue, chests, quest hooks, shops, and scripted warps. Runtime event execution now consumes these markers.';
            return;
          }
          if (this.tab === 'npcs') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New NPC'],
              ['edit', 'Edit Selected'],
              ['duplicate', 'Duplicate Selected'],
              ['delete', 'Delete Selected'],
              ['place', 'Place On Selected Tile'],
              ['erase', 'Erase Selected Tile'],
              ['assignQuest', 'Assign Selected Quest'],
              ['assignShop', 'Assign Shop Id'],
              ['assignDialogue', 'Assign Dialogue Id']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorNpcAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const title = document.createElement('div');
            title.className = 'editor-hint';
            title.style.flexBasis = '100%';
            title.textContent = 'NPC Drafts';
            this.palette.appendChild(title);
            for (const npc of this.currentNpcList()) {
              const button = makeButton(npc.name || npc.id);
              button.dataset.editorNpc = npc.id;
              button.classList.toggle('active', this.selectedNpcId === npc.id);
              button.title = this.npcSummary(npc);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(npc.color || '#ffd875')}"></span>${escapeHtml(npc.name || npc.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create NPC drafts, place NPC markers, and assign quest/shop/dialogue metadata. Runtime NPC interaction now consumes placed NPC markers.';
            return;
          }
          if (this.tab === 'mobs') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['newMob', 'New Mob'],
              ['editMob', 'Edit Mob'],
              ['duplicateMob', 'Duplicate Mob'],
              ['deleteMob', 'Delete Mob'],
              ['newSpawn', 'New Spawn Group'],
              ['editSpawn', 'Edit Spawn Group'],
              ['duplicateSpawn', 'Duplicate Spawn'],
              ['deleteSpawn', 'Delete Spawn'],
              ['placeSpawn', 'Place Spawn On Selected Tile'],
              ['eraseSpawn', 'Erase Selected Spawn'],
              ['assignLoot', 'Assign Selected Loot Table']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorMobAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const mobTitle = document.createElement('div');
            mobTitle.className = 'editor-hint';
            mobTitle.style.flexBasis = '100%';
            mobTitle.textContent = 'Mob Drafts';
            this.palette.appendChild(mobTitle);
            for (const mob of this.currentMobList()) {
              const button = makeButton(mob.name || mob.id);
              button.dataset.editorMob = mob.id;
              button.classList.toggle('active', this.selectedMobId === mob.id);
              button.title = this.mobSummary(mob);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(mob.color || '#b8c27d')}"></span>${escapeHtml(mob.name || mob.id)}`;
              this.palette.appendChild(button);
            }
            const spawnTitle = document.createElement('div');
            spawnTitle.className = 'editor-hint';
            spawnTitle.style.flexBasis = '100%';
            spawnTitle.textContent = 'Spawn Groups';
            this.palette.appendChild(spawnTitle);
            for (const spawn of this.currentMobSpawnList()) {
              const button = makeButton(spawn.name || spawn.id);
              button.dataset.editorMobSpawn = spawn.id;
              button.classList.toggle('active', this.selectedMobSpawnId === spawn.id);
              button.title = this.mobSpawnSummary(spawn);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(spawn.color || '#d981ff')}"></span>${escapeHtml(spawn.name || spawn.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create mob definitions and spawn groups, then place spawn markers. Runtime uses these markers for live mob populations, caps, and respawn timers.';
            return;
          }
          if (this.tab === 'dungeons') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['newDungeon', 'New Dungeon'],
              ['editDungeon', 'Edit Dungeon'],
              ['duplicateDungeon', 'Duplicate Dungeon'],
              ['deleteDungeon', 'Delete Dungeon'],
              ['newPuzzle', 'New Puzzle'],
              ['editPuzzle', 'Edit Puzzle'],
              ['duplicatePuzzle', 'Duplicate Puzzle'],
              ['deletePuzzle', 'Delete Puzzle'],
              ['placeEntrance', 'Place Entrance On Selected Tile'],
              ['eraseMarker', 'Erase Selected Marker'],
              ['assignLoot', 'Assign Selected Loot']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorDungeonAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const dungeonTitle = document.createElement('div');
            dungeonTitle.className = 'editor-hint';
            dungeonTitle.style.flexBasis = '100%';
            dungeonTitle.textContent = 'Dungeon Drafts';
            this.palette.appendChild(dungeonTitle);
            for (const dungeon of this.currentDungeonList()) {
              const button = makeButton(dungeon.name || dungeon.id);
              button.dataset.editorDungeon = dungeon.id;
              button.classList.toggle('active', this.selectedDungeonId === dungeon.id);
              button.title = this.dungeonSummary(dungeon);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(dungeon.color || '#a987ff')}"></span>${escapeHtml(dungeon.name || dungeon.id)}`;
              this.palette.appendChild(button);
            }
            const puzzleTitle = document.createElement('div');
            puzzleTitle.className = 'editor-hint';
            puzzleTitle.style.flexBasis = '100%';
            puzzleTitle.textContent = 'Puzzle Drafts';
            this.palette.appendChild(puzzleTitle);
            for (const puzzle of this.currentPuzzleList()) {
              const button = makeButton(puzzle.name || puzzle.id);
              button.dataset.editorPuzzle = puzzle.id;
              button.classList.toggle('active', this.selectedPuzzleId === puzzle.id);
              button.title = this.puzzleSummary(puzzle);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(puzzle.color || '#fff08a')}"></span>${escapeHtml(puzzle.name || puzzle.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create dungeon and puzzle drafts, then place entrance, boss, puzzle, lock, key, door, and treasure markers. Entrance markers load runtime dungeon instances; puzzle markers, keys, locks, and doors execute at runtime.';
            return;
          }
          if (this.tab === 'quests') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New Quest'],
              ['edit', 'Edit Selected'],
              ['delete', 'Delete Selected'],
              ['assign', 'Assign To Selected Tile']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorQuestAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const title = document.createElement('div');
            title.className = 'editor-hint';
            title.style.flexBasis = '100%';
            title.textContent = 'Quest Drafts';
            this.palette.appendChild(title);
            for (const quest of this.currentQuestList()) {
              const button = makeButton(quest.name || quest.id);
              button.dataset.editorQuest = quest.id;
              button.classList.toggle('active', this.selectedQuestId === quest.id);
              button.title = `${quest.folder || 'Quest'} · ${quest.tasks?.[0]?.label || 'No objective'} · ${quest.rewards?.xp || 0}xp/${quest.rewards?.gold || 0}g`;
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(quest.color || '#c991ff')}"></span>${escapeHtml(quest.name || quest.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create quest drafts and place quest-hook markers. Runtime quest tracking now consumes quest metadata and hook assignments.';
            return;
          }
          if (this.tab === 'items') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New Item'],
              ['edit', 'Edit Selected'],
              ['duplicate', 'Duplicate Selected'],
              ['delete', 'Delete Selected']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorItemAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const title = document.createElement('div');
            title.className = 'editor-hint';
            title.style.flexBasis = '100%';
            title.textContent = 'Item Drafts';
            this.palette.appendChild(title);
            for (const item of this.currentItemList()) {
              const button = makeButton(item.name || item.id);
              button.dataset.editorItem = item.id;
              button.classList.toggle('active', this.selectedItemId === item.id);
              button.title = this.itemSummary(item);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(item.icon?.color || '#d8ded1')}"></span>${escapeHtml(item.name || item.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create, edit, duplicate, and delete item drafts. Pass 42 compiles these drafts into live runtime loot, crafting, vendor, consumable, and equipment outputs.';
            return;
          }
          if (this.tab === 'loot') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New Loot Table'],
              ['edit', 'Edit Selected'],
              ['duplicate', 'Duplicate Selected'],
              ['delete', 'Delete Selected'],
              ['assign', 'Assign To Selected Tile']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorLootAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const title = document.createElement('div');
            title.className = 'editor-hint';
            title.style.flexBasis = '100%';
            title.textContent = 'Loot Tables';
            this.palette.appendChild(title);
            for (const table of this.currentLootTableList()) {
              const button = makeButton(table.name || table.id);
              button.dataset.editorLootTable = table.id;
              button.classList.toggle('active', this.selectedLootTableId === table.id);
              button.title = this.lootTableSummary(table);
              button.innerHTML = `<span class="editor-swatch" style="background:#d8ad57"></span>${escapeHtml(table.name || table.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create loot tables and assign them to selected resource nodes, chest events, or metadata tiles. Runtime chest/resource loot can now consume these tables.';
            return;
          }
          if (this.tab === 'spells') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New Spell'],
              ['edit', 'Edit Selected'],
              ['duplicate', 'Duplicate Selected'],
              ['delete', 'Delete Selected'],
              ['assign', 'Assign Class Slot']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorSpellAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);
            const title = document.createElement('div');
            title.className = 'editor-hint';
            title.style.flexBasis = '100%';
            title.textContent = 'Spell Drafts';
            this.palette.appendChild(title);
            for (const spell of this.currentSpellList()) {
              const button = makeButton(`${spell.className || 'General'} · ${spell.name || spell.id}`);
              button.dataset.editorSpell = spell.id;
              button.classList.toggle('active', this.selectedSpellId === spell.id);
              button.title = this.spellSummary(spell);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(spell.color || '#d8ded1')}"></span>${escapeHtml(spell.className || 'General')} · ${escapeHtml(spell.name || spell.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create, edit, duplicate, delete, and assign class spell drafts. Pass 41 compiles these drafts into the live 2-7 runtime hotbar.';
            return;
          }
          if (this.tab === 'crafting') {
            const actions = document.createElement('div');
            actions.className = 'editor-actions';
            actions.style.flexBasis = '100%';
            for (const action of [
              ['new', 'New Recipe'],
              ['edit', 'Edit Selected'],
              ['duplicate', 'Duplicate Selected'],
              ['delete', 'Delete Selected'],
              ['assign', 'Assign Station']
            ]) {
              const button = makeButton(action[1]);
              button.dataset.editorCraftingAction = action[0];
              actions.appendChild(button);
            }
            this.palette.appendChild(actions);

            const professionTitle = document.createElement('div');
            professionTitle.className = 'editor-hint';
            professionTitle.style.flexBasis = '100%';
            professionTitle.textContent = 'Professions';
            this.palette.appendChild(professionTitle);
            for (const profession of this.currentProfessionList()) {
              const button = makeButton(profession.name || profession.id);
              button.dataset.editorProfession = profession.id;
              button.classList.toggle('active', this.selectedProfessionId === profession.id);
              button.title = this.professionSummary(profession);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(profession.color || '#d8ded1')}"></span>${escapeHtml(profession.name || profession.id)}`;
              this.palette.appendChild(button);
            }

            const stationTitle = document.createElement('div');
            stationTitle.className = 'editor-hint';
            stationTitle.style.flexBasis = '100%';
            stationTitle.textContent = 'Stations';
            this.palette.appendChild(stationTitle);
            for (const station of this.currentStationList()) {
              const button = makeButton(station.name || station.id);
              button.dataset.editorStation = station.id;
              button.classList.toggle('active', this.selectedStationId === station.id);
              button.title = this.stationSummary(station);
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(station.color || '#d8ded1')}"></span>${escapeHtml(station.name || station.id)}`;
              this.palette.appendChild(button);
            }

            const recipeTitle = document.createElement('div');
            recipeTitle.className = 'editor-hint';
            recipeTitle.style.flexBasis = '100%';
            recipeTitle.textContent = 'Recipes';
            this.palette.appendChild(recipeTitle);
            for (const recipe of this.currentRecipeList()) {
              const button = makeButton(`${recipe.profession || 'crafting'} · ${recipe.name || recipe.id}`);
              button.dataset.editorRecipe = recipe.id;
              button.classList.toggle('active', this.selectedRecipeId === recipe.id);
              button.title = this.recipeSummary(recipe);
              const profession = this.game.editorProfessions?.[recipe.profession] || PROFESSION_BY_ID[recipe.profession] || {};
              button.innerHTML = `<span class="editor-swatch" style="background:${escapeHtml(profession.color || '#d8ded1')}"></span>${escapeHtml(recipe.profession || 'crafting')} · ${escapeHtml(recipe.name || recipe.id)}`;
              this.palette.appendChild(button);
            }
            if (this.hint) this.hint.textContent = 'Create/edit recipes and place runtime crafting stations. Press C near placed stations to craft in live play.';
            return;
          }
          if (this.tab === 'caves') {
            const themeTitle = document.createElement('div');
            themeTitle.className = 'editor-hint';
            themeTitle.textContent = 'Cave Themes';
            this.palette.appendChild(themeTitle);
            for (const entry of caveThemeEntries) {
              const button = makeButton(entry.name);
              button.dataset.editorCaveTheme = entry.id;
              button.classList.toggle('active', this.selectedCaveTheme === entry.id);
              button.title = entry.note;
              this.palette.appendChild(button);
            }
            const presetTitle = document.createElement('div');
            presetTitle.className = 'editor-hint';
            presetTitle.style.flexBasis = '100%';
            presetTitle.textContent = 'Layout Presets';
            this.palette.appendChild(presetTitle);
            for (const preset of caveLayoutPresets) {
              const button = makeButton(preset.name);
              button.dataset.editorCavePreset = preset.id;
              button.dataset.editorTool = preset.id === 'small' ? 'Generate Small Cave' : preset.id === 'big' ? 'Generate Big Cave' : 'Generate Large Cave';
              button.classList.toggle('active', this.selectedCavePreset === preset.id);
              button.title = preset.note;
              this.palette.appendChild(button);
            }
            const meta = this.activeCaveMeta();
            if (this.hint) this.hint.textContent = `Cave: ${meta.name || 'Mossfang Cave'} · Theme: ${this.activeCaveTheme().name} · Floors planned: ${meta.floors || 1}. Enter the cave before carving rooms/tunnels or generating a layout.`;
            return;
          }
          const msg = document.createElement('div');
          msg.className = 'editor-hint';
          msg.textContent = 'This editor category is reserved for a later pass.';
          this.palette.appendChild(msg);
          if (this.hint) this.hint.textContent = '';
        },

        refreshBrushLabel() {
          if (!this.brushLabel) return;
          this.brushLabel.textContent = `Brush: ${this.brushSize}x${this.brushSize}`;
        },

        refreshStatus() {
          this.refreshOverlayButtons();
          if (!this.status) return;
          const hasSave = typeof this.game.hasSavedWorldState === 'function' ? this.game.hasSavedWorldState() : false;
          this.status.textContent = [
            `Mode: ${this.active ? 'ON' : 'OFF'}`,
            `Tab: ${this.tab}`,
            `Tool: ${this.tool}`,
            `Tile Brush: ${TILE_DEF[this.selectedTileType]?.name || this.selectedTileType}`,
            `Object Brush: ${objectEntries.find(e => e.type === this.selectedObjectType)?.name || this.selectedObjectType}`,
            `Attribute Brush: ${attributeEntries.find(e => e.id === this.selectedAttributeType)?.name || this.selectedAttributeType}`,
            `Resource Brush: ${this.resourceTypeById(this.selectedResourceType)?.name || this.selectedResourceType}`,
            `Resource Definitions: ${this.currentResourceTypeList().length}`,
            `Selected Profession: ${this.selectedProfession()?.name || this.selectedProfessionId}`,
            `Stations: ${this.currentStationList().length}`,
            `Selected Recipe: ${this.selectedRecipe()?.name || this.selectedRecipeId}`,
            `Recipes: ${this.currentRecipeList().length}`,
            `Event Brush: ${eventEntries.find(e => e.id === this.selectedEventType)?.name || this.selectedEventType}`,
            `Selected NPC: ${this.selectedNpc()?.name || this.selectedNpcId}`,
            `NPC Drafts: ${this.currentNpcList().length}`,
            `Selected Mob: ${this.selectedMob()?.name || this.selectedMobId}`,
            `Mob Drafts: ${this.currentMobList().length}`,
            `Selected Spawn: ${this.selectedMobSpawn()?.name || this.selectedMobSpawnId}`,
            `Spawn Groups: ${this.currentMobSpawnList().length}`,
            `Selected Dungeon: ${this.selectedDungeon()?.name || this.selectedDungeonId}`,
            `Dungeon Drafts: ${this.currentDungeonList().length}`,
            `Selected Puzzle: ${this.selectedPuzzle()?.name || this.selectedPuzzleId}`,
            `Puzzle Drafts: ${this.currentPuzzleList().length}`,
            `Selected Quest: ${this.selectedQuest()?.name || this.selectedQuestId}`,
            `Quest Drafts: ${this.currentQuestList().length}`,
            `Selected Item: ${this.selectedItem()?.name || this.selectedItemId}`,
            `Item Drafts: ${this.currentItemList().length}`,
            `Selected Loot Table: ${this.selectedLootTable()?.name || this.selectedLootTableId}`,
            `Loot Tables: ${this.currentLootTableList().length}`,
            `Selected Spell: ${this.selectedSpell()?.name || this.selectedSpellId}`,
            `Spell Drafts: ${this.currentSpellList().length}`,
            `Palette Filter: ${this.paletteSearch ? this.paletteSearch : 'none'}`,
            `Last Validation: ${this.lastValidation ? `${this.lastValidation.issues} issue(s), ${this.lastValidation.repairs} repair(s)` : 'not run'}`,
            `Warp Target: ${zoneTargetEntries.find(e => e.id === this.selectedWarpTarget)?.name || this.selectedWarpTarget}`,
            `Cave Theme: ${this.activeCaveTheme().name}`,
            `Cave Preset: ${caveLayoutPresets.find(e => e.id === this.selectedCavePreset)?.name || this.selectedCavePreset}`,
            `Brush Size: ${this.brushSize}`,
            `Zone: ${this.game.currentZone || 'none'}`,
            `Saved World: ${hasSave ? 'yes' : 'no'}`,
            `Dirty: ${this.game.worldSaveDirty ? 'yes' : 'no'}`,
            `Changes: ${this.changeCount}`,
            `Undo: ${this.undoStack.length}`,
            `Redo: ${this.redoStack.length}`,
            `Camera: yaw ${(this.game.camera?.yaw || 0).toFixed(2)} · zoom ${(this.game.camera?.zoom || 1).toFixed(2)}`,
            this.rectAnchor ? `Rectangle Anchor: ${this.rectAnchor.x},${this.rectAnchor.y}` : 'Rectangle Anchor: none'
          ].join('\n');
        },

        refreshInspector() {
          if (!this.inspector) return;
          const ref = this.selected || this.hovered;
          if (!ref) {
            this.inspector.textContent = 'Move the mouse over the map to inspect tiles. Click a tile to edit/select it.';
            return;
          }
          const lines = [
            `Selection: ${this.selected ? 'locked' : 'hover'}`,
            `Zone: ${ref.zone}`,
            `Tile: ${ref.x}, ${ref.y}`,
            `Terrain: ${tileName(ref.tile)}`,
            `Elevation: ${ref.tile?.elev ?? 'n/a'}`,
            `Blocked: ${ref.tile?.blocked ? 'yes' : 'no'}`,
            `Object: ${objectName(this.game.objects?.[ref.y]?.[ref.x])}`,
            `Attributes: ${this.attributeSummary(this.getAttrAt(ref.x, ref.y))}`,
            `Resource: ${this.resourceSummary(this.getResourceAt(ref.x, ref.y))}`,
            `Event: ${this.eventSummary(this.getEventAt(ref.x, ref.y))}`,
            `NPC: ${this.npcPlacementSummary(this.getNpcAt(ref.x, ref.y))}`,
            `Mob Spawn: ${this.mobSpawnPlacementSummary(this.getMobSpawnAt(ref.x, ref.y))}`,
            `Dungeon Marker: ${this.dungeonMarkerSummary(this.getDungeonMarkerAt(ref.x, ref.y))}`,
            `Quest Hook: ${this.questHookSummary(this.getEventAt(ref.x, ref.y))}`,
            `Loot Table: ${this.lootTableCellSummary(ref.x, ref.y)}`,
            `Selected Spell: ${this.spellSummary(this.selectedSpell())}`,
            `Selected Profession: ${this.professionSummary(this.selectedProfession())}`,
            `Selected Station: ${this.stationSummary(this.selectedStation())}`,
            `Selected Recipe: ${this.recipeSummary(this.selectedRecipe())}`,
            `Current Tool: ${this.tool}`,
            `Palette Filter: ${this.paletteSearch || 'none'}`,
            `Last Validation: ${this.lastValidation ? `${this.lastValidation.issues} issue(s), ${this.lastValidation.repairs} repair(s)` : 'not run'}`,
            `Cave Meta: ${this.activeCaveMeta().name || 'Mossfang Cave'} / ${this.activeCaveTheme().name}`,
            `Undo Stack: ${this.undoStack.length}`,
            `Redo Stack: ${this.redoStack.length}`
          ];
          this.inspector.textContent = lines.join('\n');
          this.refreshStatus();
        },

        attributeSummary(attr) {
          if (!attr) return 'none';
          const parts = [];
          if (attr.block) parts.push('block');
          if (attr.unblock) parts.push('unblock');
          if (attr.npcAvoid) parts.push('npc avoid');
          if (attr.noMobSpawn) parts.push('no mob spawn');
          if (attr.safeZone) parts.push('safe zone');
          if (attr.spawnPoint) parts.push('spawn point');
          if (attr.zoneExit || attr.warp) parts.push(`warp → ${attr.warp?.targetZone || 'target'}`);
          return parts.join(', ') || 'metadata';
        },

        resourceSummary(node) {
          if (!node) return 'none';
          const def = this.resourceTypeById(node.type || node.id);
          return `${node.name || def?.name || node.type || node.id} · ${node.category || def?.category || 'resource'} · ${node.skill || def?.skill || 'skill'} · ${node.tool || def?.tool || 'tool'}`;
        },

        eventSummary(node) {
          if (!node) return 'none';
          const def = eventEntries.find(entry => entry.id === (node.type || node.id));
          const commandCount = Array.isArray(node.commands) ? node.commands.length : 0;
          const questPart = node.questId ? ` · quest ${node.questId}` : '';
          return `${node.name || def?.name || node.type || node.id} · ${node.category || def?.category || 'event'} · ${node.trigger || def?.trigger || 'interact'} · commands ${commandCount}${questPart}`;
        },

        npcSummary(npc) {
          if (!npc) return 'none';
          const quests = Array.isArray(npc.questIds) ? npc.questIds.length : 0;
          const shop = npc.shopId ? ` · shop ${npc.shopId}` : '';
          const trainer = npc.trainerClass ? ` · trainer ${npc.trainerClass}` : '';
          return `${npc.name || npc.id} · ${npc.role || 'npc'} · lvl ${npc.level || 1} · quests ${quests}${shop}${trainer}`;
        },

        npcPlacementSummary(node) {
          if (!node) return 'none';
          const quests = Array.isArray(node.questIds) ? node.questIds.length : 0;
          return `${node.name || node.npcId || node.id} · ${node.role || 'npc'} · lvl ${node.level || 1} · quests ${quests} · ${node.dialogueId || 'no dialogue'}`;
        },

        mobSummary(mob) {
          if (!mob) return 'none';
          return `${mob.name || mob.id} · ${mob.family || 'mob'} · lvl ${mob.levelMin || 1}-${mob.levelMax || mob.levelMin || 1} · hp ${mob.hp || 0} · atk ${mob.attack || 0} · loot ${mob.lootTableId || 'none'}`;
        },

        mobSpawnSummary(spawn) {
          if (!spawn) return 'none';
          const mobs = Array.isArray(spawn.mobIds) ? spawn.mobIds.join(',') : 'none';
          return `${spawn.name || spawn.id} · mobs ${mobs} · count ${spawn.countMin || 1}-${spawn.countMax || 1} · radius ${spawn.radius || 0} · respawn ${spawn.respawnSeconds || 0}s`;
        },

        mobSpawnPlacementSummary(node) {
          if (!node) return 'none';
          const mobs = Array.isArray(node.mobIds) ? node.mobIds.join(',') : 'none';
          return `${node.name || node.spawnId || node.id} · mobs ${mobs} · count ${node.countMin || 1}-${node.countMax || 1} · loot ${node.lootTableId || 'none'}`;
        },


        dungeonSummary(dungeon) {
          if (!dungeon) return 'none';
          const puzzles = Array.isArray(dungeon.puzzleIds) ? dungeon.puzzleIds.length : 0;
          const bosses = Array.isArray(dungeon.bossIds) ? dungeon.bossIds.length : 0;
          return `${dungeon.name || dungeon.id} · lvl ${dungeon.minLevel || 1}-${dungeon.maxLevel || dungeon.minLevel || 1} · floors ${dungeon.floors || 1} · puzzles ${puzzles} · bosses ${bosses} · loot ${dungeon.lootTableId || 'none'}`;
        },

        puzzleSummary(puzzle) {
          if (!puzzle) return 'none';
          return `${puzzle.name || puzzle.id} · ${puzzle.puzzleType || 'puzzle'} · dungeon ${puzzle.dungeonId || 'none'} · trigger ${puzzle.triggerType || 'interact'} · switches ${puzzle.requiredSwitches || 0}`;
        },

        dungeonMarkerSummary(node) {
          if (!node) return 'none';
          const puzzle = node.puzzleId ? ` · puzzle ${node.puzzleId}` : '';
          const loot = node.lootTableId ? ` · loot ${node.lootTableId}` : '';
          return `${node.name || node.markerKind || 'Dungeon Marker'} · ${node.dungeonName || node.dungeonId || 'dungeon'} · ${node.markerKind || 'marker'}${puzzle}${loot}`;
        },

        questHookSummary(node) {
          if (!node || node.category !== 'quest') return 'none';
          const questId = node.questId || node.commands?.find(cmd => cmd.questId)?.questId;
          const quest = this.game.editorQuests?.[questId] || QUEST_BY_ID[questId];
          return `${quest?.name || node.questName || questId || 'unassigned'} · ${quest?.folder || 'Quest'} · rewards ${quest?.rewards?.xp || 0}xp/${quest?.rewards?.gold || 0}g`;
        },

        itemSummary(item) {
          if (!item) return 'none';
          const statText = Object.entries(item.stats || {}).map(([key, value]) => `${key}+${value}`).join(', ') || 'no stats';
          return `${item.name || item.id} · ${item.type || 'item'} · slot ${item.slot || 'none'} · ${item.rarity || 'white'} · lvl ${item.levelRequirement || 1} · ${statText}`;
        },

        lootTableSummary(table) {
          if (!table) return 'none';
          const entries = Array.isArray(table.entries) ? table.entries.length : 0;
          const gold = table.gold ? `${table.gold.min || 0}-${table.gold.max || 0}g` : '0g';
          return `${table.name || table.id} · ${table.source?.kind || 'source'}:${table.source?.id || 'editor'} · entries ${entries} · gold ${gold}`;
        },

        spellSummary(spell) {
          if (!spell) return 'none';
          const parts = [
            spell.name || spell.id,
            spell.className || 'General',
            `slot ${Number(spell.slotIndex || 0)}`,
            spell.kind || 'spell',
            spell.role || 'role',
            `cost ${spell.cost ?? 0}`,
            `cd ${spell.cooldown ?? 0}s`
          ];
          if (spell.power != null) parts.push(`power ${spell.power}`);
          if (spell.heal != null) parts.push(`heal ${spell.heal}`);
          if (spell.range != null) parts.push(`range ${spell.range}`);
          if (spell.radius != null) parts.push(`radius ${spell.radius}`);
          return parts.join(' · ');
        },

        lootTableCellSummary(x, y) {
          const id = this.lootTableAt(x, y);
          if (!id) return 'none';
          const table = this.game.editorLootTables?.[id] || LOOT_TABLE_BY_ID[id];
          return table ? this.lootTableSummary(table) : `${id} · missing table`;
        },

        update(_dt) {
          if (!this.active) return;
          this.refreshStatus();
        },

        render(context) {
          if (!this.active || this.tab === 'layeredMap' || !this.game.started || this.game.paused) return;
          const ref = this.selected || this.hovered;
          const overlays = this.overlays || (this.overlays = { attributes: true, resources: true, events: true, npcs: true, mobSpawns: true, dungeons: true });
          if (overlays.attributes !== false) this.drawAttributeMarkers(context);
          if (overlays.resources !== false) this.drawResourceMarkers(context);
          if (overlays.events !== false) this.drawEventMarkers(context);
          if (overlays.npcs !== false) this.drawNpcMarkers(context);
          if (overlays.mobSpawns !== false) this.drawMobSpawnMarkers(context);
          if (overlays.dungeons !== false) this.drawDungeonMarkers(context);
          if (!ref || !ref.tile) return;
          this.drawTileHighlight(context, ref, this.selected ? '#ffd875' : '#79d7ff', this.selected ? 0.38 : 0.22);
          if (this.rectAnchor && this.tool === 'Rectangle') {
            this.drawRectanglePreview(context, this.rectAnchor, ref);
          }
        },

        drawAttributeMarkers(context) {
          const grid = this.currentAttrGrid();
          if (!grid) return;
          const px = this.game.player?.x ?? CONFIG.START_X ?? 100;
          const py = this.game.player?.y ?? CONFIG.START_Y ?? 100;
          const maxDist = 34;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const [key, attr] of Object.entries(grid)) {
            const [rawX, rawY] = key.split(',');
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > maxDist) continue;
            const tile = this.game.map?.[y]?.[x];
            if (!tile) continue;
            const marker = this.primaryAttributeMarker(attr);
            if (!marker) continue;
            const s = this.game.worldToScreen(x, y, tile.elev + 0.16);
            context.globalAlpha = 0.78;
            context.fillStyle = marker.color;
            context.beginPath();
            context.arc(s.x, s.y - 10, 8, 0, Math.PI * 2);
            context.fill();
            context.globalAlpha = 1;
            context.fillStyle = '#07100d';
            context.fillText(marker.label, s.x, s.y - 10.5);
          }
          context.restore();
        },

        drawResourceMarkers(context) {
          const grid = this.currentResourceGrid();
          if (!grid) return;
          const px = this.game.player?.x ?? CONFIG.START_X ?? 100;
          const py = this.game.player?.y ?? CONFIG.START_Y ?? 100;
          const maxDist = 36;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const [key, node] of Object.entries(grid)) {
            const [rawX, rawY] = key.split(',');
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > maxDist) continue;
            const tile = this.game.map?.[y]?.[x];
            if (!tile) continue;
            const def = this.resourceTypeById(node.type || node.id) || node;
            const s = this.game.worldToScreen(x, y, tile.elev + 0.20);
            context.globalAlpha = 0.86;
            context.fillStyle = def.color || '#9fdc8f';
            context.beginPath();
            context.roundRect?.(s.x - 8, s.y - 31, 16, 16, 4);
            if (typeof context.roundRect !== 'function') context.rect(s.x - 8, s.y - 31, 16, 16);
            context.fill();
            context.globalAlpha = 1;
            context.fillStyle = '#07100d';
            context.fillText(def.label || 'R', s.x, s.y - 23.5);
          }
          context.restore();
        },

        drawEventMarkers(context) {
          const grid = this.currentEventGrid();
          if (!grid) return;
          const px = this.game.player?.x ?? CONFIG.START_X ?? 100;
          const py = this.game.player?.y ?? CONFIG.START_Y ?? 100;
          const maxDist = 36;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const [key, node] of Object.entries(grid)) {
            const [rawX, rawY] = key.split(',');
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > maxDist) continue;
            const tile = this.game.map?.[y]?.[x];
            if (!tile) continue;
            const def = eventEntries.find(entry => entry.id === (node.type || node.id)) || node;
            const s = this.game.worldToScreen(x, y, tile.elev + 0.26);
            context.globalAlpha = 0.88;
            context.fillStyle = def.color || '#ffd66e';
            context.beginPath();
            context.moveTo(s.x, s.y - 38);
            context.lineTo(s.x + 9, s.y - 29);
            context.lineTo(s.x, s.y - 20);
            context.lineTo(s.x - 9, s.y - 29);
            context.closePath();
            context.fill();
            context.globalAlpha = 1;
            context.fillStyle = '#07100d';
            context.fillText(def.label || 'E', s.x, s.y - 29.2);
          }
          context.restore();
        },

        drawNpcMarkers(context) {
          const grid = this.currentNpcGrid();
          if (!grid) return;
          const px = this.game.player?.x ?? CONFIG.START_X ?? 100;
          const py = this.game.player?.y ?? CONFIG.START_Y ?? 100;
          const maxDist = 36;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const [key, node] of Object.entries(grid)) {
            const [rawX, rawY] = key.split(',');
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > maxDist) continue;
            const tile = this.game.map?.[y]?.[x];
            if (!tile) continue;
            const def = this.game.editorNpcDefinitions?.[node.npcId] || node;
            const s = this.game.worldToScreen(x, y, tile.elev + 0.34);
            context.globalAlpha = 0.92;
            context.fillStyle = node.color || def.color || '#ffd875';
            context.beginPath();
            context.arc(s.x, s.y - 44, 9, 0, Math.PI * 2);
            context.fill();
            context.globalAlpha = 1;
            context.fillStyle = '#07100d';
            context.fillText(node.label || def.label || 'N', s.x, s.y - 44.5);
          }
          context.restore();
        },

        drawMobSpawnMarkers(context) {
          const grid = this.currentMobSpawnGrid();
          if (!grid) return;
          const px = this.game.player?.x ?? CONFIG.START_X ?? 100;
          const py = this.game.player?.y ?? CONFIG.START_Y ?? 100;
          const maxDist = 36;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const [key, node] of Object.entries(grid)) {
            const [rawX, rawY] = key.split(',');
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > maxDist) continue;
            const tile = this.game.map?.[y]?.[x];
            if (!tile) continue;
            const def = this.game.editorMobSpawnDefinitions?.[node.spawnId] || node;
            const s = this.game.worldToScreen(x, y, tile.elev + 0.28);
            context.globalAlpha = 0.82;
            context.fillStyle = node.color || def.color || '#d981ff';
            context.beginPath();
            context.rect(s.x - 9, s.y - 18, 18, 18);
            context.fill();
            context.globalAlpha = 1;
            context.fillStyle = '#07100d';
            context.fillText(node.label || def.label || 'M', s.x, s.y - 9.2);
          }
          context.restore();
        },


        drawDungeonMarkers(context) {
          const grid = this.currentDungeonMarkerGrid();
          if (!grid) return;
          const px = this.game.player?.x ?? CONFIG.START_X ?? 100;
          const py = this.game.player?.y ?? CONFIG.START_Y ?? 100;
          const maxDist = 38;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const [key, node] of Object.entries(grid)) {
            const [rawX, rawY] = key.split(',');
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > maxDist) continue;
            const tile = this.game.map?.[y]?.[x];
            if (!tile) continue;
            const dungeon = this.game.editorDungeons?.[node.dungeonId] || node;
            const s = this.game.worldToScreen(x, y, tile.elev + 0.40);
            context.globalAlpha = 0.90;
            context.fillStyle = node.color || dungeon.color || '#a987ff';
            context.beginPath();
            context.moveTo(s.x, s.y - 56);
            context.lineTo(s.x + 10, s.y - 46);
            context.lineTo(s.x + 7, s.y - 34);
            context.lineTo(s.x - 7, s.y - 34);
            context.lineTo(s.x - 10, s.y - 46);
            context.closePath();
            context.fill();
            context.globalAlpha = 1;
            context.fillStyle = '#07100d';
            context.fillText(node.label || dungeon.label || 'D', s.x, s.y - 44.5);
          }
          context.restore();
        },

        primaryAttributeMarker(attr) {
          if (!attr) return null;
          if (attr.spawnPoint) return attributeEntries.find(entry => entry.id === 'spawnPoint');
          if (attr.warp || attr.zoneExit) return attributeEntries.find(entry => entry.id === 'warp');
          if (attr.safeZone) return attributeEntries.find(entry => entry.id === 'safeZone');
          if (attr.noMobSpawn) return attributeEntries.find(entry => entry.id === 'noMobSpawn');
          if (attr.npcAvoid) return attributeEntries.find(entry => entry.id === 'npcAvoid');
          if (attr.block) return attributeEntries.find(entry => entry.id === 'block');
          if (attr.unblock) return attributeEntries.find(entry => entry.id === 'unblock');
          return null;
        },

        drawTileHighlight(context, ref, color, alpha) {
          const center = this.game.worldToScreen(ref.x, ref.y, ref.tile.elev + 0.05);
          const north = this.game.worldToScreen(ref.x - 0.5, ref.y - 0.5, ref.tile.elev + 0.05);
          const east = this.game.worldToScreen(ref.x + 0.5, ref.y - 0.5, ref.tile.elev + 0.05);
          const south = this.game.worldToScreen(ref.x + 0.5, ref.y + 0.5, ref.tile.elev + 0.05);
          const west = this.game.worldToScreen(ref.x - 0.5, ref.y + 0.5, ref.tile.elev + 0.05);
          context.save();
          context.globalAlpha = alpha;
          context.fillStyle = color;
          this.game.fillPoly([north, east, south, west]);
          context.globalAlpha = 0.95;
          context.strokeStyle = color;
          context.lineWidth = 1.8;
          this.game.strokePoly([north, east, south, west]);
          context.globalAlpha = 1;
          context.fillStyle = '#fff1a8';
          context.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.fillText(`${ref.x},${ref.y}`, center.x, center.y - 9);
          context.restore();
        },

        drawRectanglePreview(context, a, b) {
          const x1 = Math.min(a.x, b.x);
          const x2 = Math.max(a.x, b.x);
          const y1 = Math.min(a.y, b.y);
          const y2 = Math.max(a.y, b.y);
          context.save();
          for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
              const tile = this.game.map?.[y]?.[x];
              if (!tile) continue;
              this.drawTileHighlight(context, { x, y, tile }, '#ffb347', 0.10);
            }
          }
          context.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
