// Dream Realms dungeon and puzzle editor draft data
// Modular Pass 38: Dungeon editor schemas now feed runtime dungeon entrance and instance loading.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.DUNGEON_DRAFTS = [
    {
      id: 'dungeon_glooms_crypt',
      name: "Gloom's Crypt",
      zoneId: 'dark_woods',
      entranceZoneId: 'blackroot_catacombs_f4',
      caveZoneId: 'blackroot_catacombs',
      theme: 'crypt_root',
      minLevel: 9,
      maxLevel: 12,
      floors: 3,
      recommendedPartySize: 1,
      eliteMultiplier: 3,
      bossIds: ['boss_hollow_warden', 'boss_rootbound_matriarch', 'boss_gloom_king'],
      lootTableId: 'loot_dungeon_chest',
      keyItemId: 'item_glooms_crypt_key',
      puzzleIds: ['puzzle_lantern_order', 'puzzle_root_sigils', 'puzzle_bone_levers'],
      roomPlan: ['entrance', 'combat', 'puzzle', 'boss', 'treasure'],
      color: '#a987ff',
      label: 'D',
      notes: 'Primary Dark Woods dungeon concept. In V0.11.8 this is reached from Blackroot Catacombs final-floor cave hook, not a standalone overworld shortcut.'
    },
    {
      id: 'dungeon_silk_web_depths',
      name: 'Silk Web Depths',
      zoneId: 'silk_web_cavern_f2',
      entranceZoneId: 'silk_web_cavern_f2',
      caveZoneId: 'silk_web_cavern',
      theme: 'spider_cavern',
      minLevel: 4,
      maxLevel: 9,
      floors: 2,
      recommendedPartySize: 1,
      eliteMultiplier: 2,
      bossIds: ['boss_silk_mother'],
      lootTableId: 'loot_dungeon_chest',
      keyItemId: null,
      puzzleIds: ['puzzle_web_gates'],
      roomPlan: ['entrance', 'web_choke', 'egg_room', 'boss', 'treasure'],
      color: '#d68cff',
      label: 'W',
      notes: 'Spider-only dungeon branch. In V0.11.8 this is reached from Silk Web Cavern floor 2 via the cave dungeon hook.'
    }
  ];

  DR.PUZZLE_DRAFTS = [
    {
      id: 'puzzle_lantern_order',
      name: 'Lantern Order Puzzle',
      dungeonId: 'dungeon_glooms_crypt',
      puzzleType: 'sequence',
      triggerType: 'interact',
      requiredSwitches: 4,
      resetOnFail: true,
      successOpens: ['door_lantern_gate'],
      failureSpawns: ['spawn_dark_woods_rotlings'],
      color: '#fff08a',
      label: 'L',
      notes: 'Player activates lantern markers in order to open a gate.'
    },
    {
      id: 'puzzle_root_sigils',
      name: 'Root Sigil Puzzle',
      dungeonId: 'dungeon_glooms_crypt',
      puzzleType: 'symbol_match',
      triggerType: 'interact',
      requiredSwitches: 3,
      resetOnFail: false,
      successOpens: ['door_root_seal'],
      failureSpawns: [],
      color: '#75d069',
      label: 'R',
      notes: 'Root-symbol matching puzzle for a lower crypt floor.'
    },
    {
      id: 'puzzle_bone_levers',
      name: 'Bone Lever Puzzle',
      dungeonId: 'dungeon_glooms_crypt',
      puzzleType: 'sequence',
      triggerType: 'interact',
      requiredSwitches: 3,
      resetOnFail: true,
      successOpens: ['door_bone_gate'],
      failureSpawns: ['spawn_dark_woods_rotlings'],
      color: '#d8ded1',
      label: 'B',
      notes: 'A lower-crypt lever sequence using bone-handled switches. Added in Pass 45 so Gloom\'s Crypt references only valid puzzle drafts.'
    },
    {
      id: 'puzzle_web_gates',
      name: 'Web Gate Puzzle',
      dungeonId: 'dungeon_silk_web_depths',
      puzzleType: 'kill_and_unlock',
      triggerType: 'clear_room',
      requiredSwitches: 0,
      resetOnFail: false,
      successOpens: ['door_web_gate'],
      failureSpawns: [],
      color: '#d68cff',
      label: 'G',
      notes: 'Clear spider egg rooms to open web gates.'
    }
  ];

  DR.DUNGEON_ROOM_DRAFTS = [
    { id: 'room_entrance', name: 'Entrance Room', kind: 'entrance', color: '#9fd7ff', label: 'E', notes: 'Dungeon entry and staging room.' },
    { id: 'room_combat', name: 'Combat Room', kind: 'combat', color: '#d981ff', label: 'C', notes: 'Mob encounter room.' },
    { id: 'room_puzzle', name: 'Puzzle Room', kind: 'puzzle', color: '#fff08a', label: 'P', notes: 'Puzzle objective room.' },
    { id: 'room_boss', name: 'Boss Room', kind: 'boss', color: '#e65d4f', label: 'B', notes: 'Boss encounter room.' },
    { id: 'room_treasure', name: 'Treasure Room', kind: 'treasure', color: '#d8ad57', label: 'T', notes: 'Reward room / chest room.' }
    ,
    {
      id: 'dungeon_blackwater_grotto',
      name: 'Blackwater Grotto',
      zoneId: 'dark_woods',
      entranceZoneId: 'dark_woods',
      caveZoneId: 'mossfang_cave',
      theme: 'underwater_grotto',
      minLevel: 3,
      maxLevel: 8,
      floors: 2,
      recommendedPartySize: 1,
      eliteMultiplier: 2,
      bossIds: ['boss_hollow_warden'],
      lootTableId: 'loot_dungeon_chest',
      keyItemId: null,
      puzzleIds: ['puzzle_lantern_order'],
      visualTags: ['underwater', 'blackwater', 'secret_cave', 'bubbles'],
      caveVariant: 'small',
      notes: 'Pass 48 hidden underwater cave reached by diving at river bubble vents.'
    },
    {
      id: 'dungeon_sunken_root_halls',
      name: 'Sunken Root Halls',
      zoneId: 'dark_woods',
      entranceZoneId: 'dark_woods',
      caveZoneId: 'mossfang_cave',
      theme: 'sunken_roots',
      minLevel: 5,
      maxLevel: 10,
      floors: 3,
      recommendedPartySize: 1,
      eliteMultiplier: 2,
      bossIds: ['boss_rootbound_matriarch', 'boss_gloom_king'],
      lootTableId: 'loot_dungeon_chest',
      keyItemId: null,
      puzzleIds: ['puzzle_root_seals'],
      visualTags: ['underwater', 'roots', 'large_cave', 'drowned_halls'],
      caveVariant: 'large',
      notes: 'Pass 48 larger underwater dungeon concept with multi-floor cave support.'
    },
    {
      id: 'dungeon_blind_pool_depths',
      name: 'Blind Pool Depths',
      zoneId: 'mossfang_cave',
      entranceZoneId: 'mossfang_cave',
      caveZoneId: 'mossfang_cave',
      theme: 'blind_cave_pool',
      minLevel: 4,
      maxLevel: 9,
      floors: 2,
      recommendedPartySize: 1,
      eliteMultiplier: 2,
      bossIds: ['boss_silk_mother'],
      lootTableId: 'loot_dungeon_chest',
      keyItemId: null,
      puzzleIds: ['puzzle_bone_levers'],
      visualTags: ['underwater', 'cave_pool', 'blindfish', 'mushrooms'],
      caveVariant: 'big',
      notes: 'Pass 48 cave-pool underwater dungeon with cave-specific fish/resource identity.'
    }

  ];


  DR.DUNGEON_DRAFTS.push({
    id: 'silk_web_cavern',
    name: 'Silk Web Cavern',
    zoneId: 'silk_web_cavern_f1_outer_webworks',
    entranceZoneId: 'silk_web_cavern',
    caveZoneId: 'silk_web_cavern',
    zoneHook: 'dark_woods_cave_entrance',
    theme: 'silk_web_cavern',
    enemyTheme: 'spider_only_elite_dungeon',
    minLevel: 6,
    maxLevel: 10,
    floor3TargetLevel: 10,
    floors: 3,
    recommendedPartySize: 6,
    groupTuning: 'player_plus_bots_or_mercs',
    eliteMultiplier: 3,
    bossIds: ['boss_broodwarden_skirr', 'boss_matron_velyra', 'boss_queen_arakhzel'],
    miniBossIds: [
      'miniboss_threadjaw_alpha', 'miniboss_old_venomsac',
      'miniboss_cocoon_tender', 'miniboss_pale_spinner_yssra', 'miniboss_hollowfang_broodsire',
      'miniboss_chitinmaw', 'miniboss_widow_of_the_loom', 'miniboss_venom_eye_oracle', 'miniboss_egg_heart'
    ],
    lootTableId: 'loot_silk_web_cavern',
    eliteLootTableId: 'loot_silk_web_cavern_elites',
    miniBossLootTableId: 'loot_silk_web_cavern_minibosses',
    rewardLootTableId: 'loot_silk_web_cavern_final',
    keyItemId: null,
    puzzleIds: ['puzzle_silk_web_gate_f1', 'puzzle_silk_web_gate_f2', 'puzzle_silk_web_gate_f3'],
    questChainId: 'quest_chain_silk_web_cavern',
    floorIds: [
      'silk_web_cavern_f1_outer_webworks',
      'silk_web_cavern_f2_cocoon_warrens',
      'silk_web_cavern_f3_queens_loom'
    ],
    entranceInterior: { floorId: 'floor1', facing: 'south', roomId: 'safe_entry' },
    partySpawnOffsets: [
      { x: 0, y: 0 }, { x: -2, y: 2 }, { x: 2, y: 2 },
      { x: -3, y: 4 }, { x: 0, y: 4 }, { x: 3, y: 4 }
    ],
    questGiverCluster: [
      { npcId: 'npc_silk_web_field_cleric_liora', offsetX: -3, offsetY: -1 },
      { npcId: 'npc_silk_web_scout_tamsin', offsetX: 0, offsetY: -2 },
      { npcId: 'npc_silk_web_venomkeeper_oren', offsetX: 3, offsetY: -1 }
    ],
    spiritHealer: { npcId: 'npc_silk_web_spirit_healer', offsetX: 4, offsetY: 2 },
    roomPlan: ['safe_entry', 'combat', 'web_choke', 'egg_room', 'combat', 'boss', 'treasure'],
    color: '#d68cff',
    label: 'W',
    notes: 'V0.13.24 full 3-floor spider-only elite dungeon with exclusive loot, quests, mini-bosses, web gates, cocoons, and hazards.'
  });

  DR.PUZZLE_DRAFTS.push(
    {
      id: 'puzzle_silk_web_gate_f1',
      name: 'Outer Webworks Gate',
      dungeonId: 'silk_web_cavern',
      puzzleType: 'web_anchor_gate',
      triggerType: 'interact',
      requiredSwitches: 3,
      successOpens: ['door_skirr_web_gate'],
      color: '#d68cff',
      label: 'W',
      notes: 'Destroy three web anchors and defeat Threadjaw Alpha before Broodwarden Skirr.'
    },
    {
      id: 'puzzle_silk_web_gate_f2',
      name: 'Cocoon Warrens Locks',
      dungeonId: 'silk_web_cavern',
      puzzleType: 'web_anchor_gate',
      triggerType: 'interact',
      requiredSwitches: 4,
      successOpens: ['door_velyra_cocoon_gate'],
      color: '#c797ff',
      label: 'C',
      notes: 'Break cocoon locks before Matron Velyra.'
    },
    {
      id: 'puzzle_silk_web_gate_f3',
      name: "Queen's Loom Pylons",
      dungeonId: 'silk_web_cavern',
      puzzleType: 'web_anchor_gate',
      triggerType: 'interact',
      requiredSwitches: 3,
      successOpens: ['door_queen_loom_gate'],
      color: '#ff92d7',
      label: 'Q',
      notes: 'Deactivate three web pylons before Queen Arakh\'Zel.'
    }
  );

  DR.DUNGEON_BY_ID = Object.fromEntries(DR.DUNGEON_DRAFTS.map(dungeon => [dungeon.id, dungeon]));
  DR.PUZZLE_BY_ID = Object.fromEntries(DR.PUZZLE_DRAFTS.map(puzzle => [puzzle.id, puzzle]));
  DR.DUNGEON_ROOM_BY_ID = Object.fromEntries(DR.DUNGEON_ROOM_DRAFTS.map(room => [room.id, room]));
})();
