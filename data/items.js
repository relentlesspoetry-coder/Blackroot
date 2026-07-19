// Dream Realms item editor draft data
// Modular Pass 26: item definitions used by the editor data tools.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  const allClasses = Object.keys(DR.CLASSES || {});

  DR.ITEM_TYPES = [
    { id: 'weapon', name: 'Weapon' },
    { id: 'armor', name: 'Armor' },
    { id: 'accessory', name: 'Accessory' },
    { id: 'consumable', name: 'Consumable' },
    { id: 'resource', name: 'Resource' },
    { id: 'quest', name: 'Quest Item' },
    { id: 'currency', name: 'Currency' },
    { id: 'bag', name: 'Bag' },
    { id: 'tool', name: 'Tool' }
  ];

  DR.ITEM_DRAFTS = [
    {
      id: 'item_linen_pouch',
      name: 'Linen Pouch',
      type: 'bag',
      slot: 'bag',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { slots: 8 },
      damage: null,
      armor: 0,
      sellValue: 12,
      stackSize: 1,
      bagSlots: 8,
      icon: { family: 'bag', color: '#d8cfa8', glyph: '▤' },
      description: 'A small equippable bag with 8 item slots.',
      editorNote: 'Pass 46 bag-system test item.'
    },
    {
      id: 'item_travelers_pack',
      name: "Traveler's Pack",
      type: 'bag',
      slot: 'bag',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { slots: 12 },
      damage: null,
      armor: 0,
      sellValue: 28,
      stackSize: 1,
      bagSlots: 12,
      icon: { family: 'bag', color: '#6fd088', glyph: '▤' },
      description: 'A sturdy travel pack with 12 item slots.',
      editorNote: 'Pass 46 bag-system test item.'
    },
    {
      id: 'item_worn_small_pouch',
      name: 'Worn Small Pouch',
      type: 'bag',
      slot: 'bag',
      rarity: 'grey',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { slots: 3 },
      damage: null,
      armor: 0,
      sellValue: 6,
      stackSize: 1,
      bagSlots: 3,
      icon: { family: 'bag', color: '#8b928a', glyph: '▤' },
      description: 'A battered three-slot pouch. Equips into an open bag slot.',
      editorNote: 'V0.13.15 Dark Woods small bag drop.'
    },
    {
      id: 'item_frayed_traveler_bag',
      name: 'Frayed Traveler Bag',
      type: 'bag',
      slot: 'bag',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { slots: 4 },
      damage: null,
      armor: 0,
      sellValue: 10,
      stackSize: 1,
      bagSlots: 4,
      icon: { family: 'bag', color: '#d8ded1', glyph: '▤' },
      description: 'A small four-slot travel bag. Equips into an open bag slot.',
      editorNote: 'V0.13.15 Dark Woods small bag drop.'
    },
    {
      id: 'item_darkwood_satchel',
      name: 'Darkwood Satchel',
      type: 'bag',
      slot: 'bag',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { slots: 5 },
      damage: null,
      armor: 0,
      sellValue: 16,
      stackSize: 1,
      bagSlots: 5,
      icon: { family: 'bag', color: '#54c86f', glyph: '▤' },
      description: 'A darkwood five-slot satchel. Equips into an open bag slot.',
      editorNote: 'V0.13.15 Dark Woods small bag drop.'
    },
    {
      id: 'item_reinforced_small_bag',
      name: 'Reinforced Small Bag',
      type: 'bag',
      slot: 'bag',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { slots: 6 },
      damage: null,
      armor: 0,
      sellValue: 24,
      stackSize: 1,
      bagSlots: 6,
      icon: { family: 'bag', color: '#5ea2ff', glyph: '▤' },
      description: 'A reinforced six-slot small bag. Equips into an open bag slot.',
      editorNote: 'V0.13.15 Dark Woods small bag drop.'
    },
    {
      id: 'item_gloomforged_blade',
      name: 'Gloomforged Blade',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: ['Bard', 'Fighter'],
      stats: { attack: 6 },
      damage: { min: 3, max: 8, speed: 2.4 },
      armor: 0,
      sellValue: 18,
      stackSize: 1,
      icon: { family: 'blade', color: '#d8ded1', glyph: '⚔' },
      description: 'A plain iron blade darkened by the woods.',
      editorNote: 'Starter melee weapon draft.'
    },
    {
      id: 'item_widowfang_dagger',
      name: 'Widowfang Dagger',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'green',
      levelRequirement: 2,
      classRestrictions: ['Rogue', 'Bard'],
      stats: { attack: 7, speed: 0.08 },
      damage: { min: 2, max: 7, speed: 1.7 },
      armor: 0,
      sellValue: 28,
      stackSize: 1,
      icon: { family: 'dagger', color: '#54c86f', glyph: '⌁' },
      description: 'A quick curved dagger shaped like a spider fang.',
      editorNote: 'Fast rogue/bard weapon draft.'
    },
    {
      id: 'item_blackroot_staff',
      name: 'Blackroot Staff',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: ['Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric'],
      stats: { attack: 3, mana: 14 },
      damage: { min: 2, max: 5, speed: 2.9 },
      armor: 0,
      sellValue: 20,
      stackSize: 1,
      twoHanded: true,
      icon: { family: 'staff', color: '#d8ded1', glyph: '杖' },
      description: 'A crooked staff cut from old darkwood root.',
      editorNote: 'Starter caster/healer weapon draft.'
    },
    {
      id: 'item_ironbark_shield',
      name: 'Ironbark Shield',
      type: 'armor',
      slot: 'offhand',
      rarity: 'green',
      levelRequirement: 2,
      classRestrictions: ['Fighter', 'Cleric'],
      stats: { defense: 6, hp: 12 },
      damage: null,
      armor: 6,
      sellValue: 34,
      stackSize: 1,
      icon: { family: 'shield', color: '#54c86f', glyph: '▣' },
      description: 'Dense bark reinforced with rough iron bands.',
      editorNote: 'Starter tank/healer offhand draft.'
    },
    {
      id: 'item_hollow_warden_bulwark',
      name: 'Hollow Warden Bulwark',
      type: 'armor',
      slot: 'offhand',
      rarity: 'purple',
      levelRequirement: 6,
      classRestrictions: ['Fighter', 'Cleric'],
      stats: { defense: 11, hp: 24 },
      damage: null,
      armor: 11,
      sellValue: 140,
      stackSize: 1,
      icon: { family: 'shield', color: '#b15cff', glyph: '▣' },
      description: 'A boss shield bound with crypt-root iron.',
      editorNote: 'Pass 40 boss reward draft.'
    },
    {
      id: 'item_rootbound_scepter',
      name: 'Rootbound Scepter',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'purple',
      levelRequirement: 8,
      classRestrictions: ['Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric'],
      stats: { attack: 7, mana: 26 },
      damage: { min: 5, max: 12, speed: 2.7 },
      armor: 0,
      sellValue: 155,
      stackSize: 1,
      icon: { family: 'staff', color: '#b15cff', glyph: '杖' },
      description: 'A living scepter cut from the Rootbound Matriarch.',
      editorNote: 'Pass 40 boss reward draft.'
    },
    {
      id: 'item_gloom_kings_signet',
      name: "Gloom King's Signet",
      type: 'accessory',
      slot: 'ring1',
      rarity: 'gold',
      levelRequirement: 10,
      classRestrictions: allClasses,
      stats: { hp: 18, mana: 18, attack: 3, defense: 3 },
      damage: null,
      armor: 0,
      sellValue: 260,
      stackSize: 1,
      icon: { family: 'ring', color: '#f0c449', glyph: '◈' },
      description: 'A sovereign ring from the last chamber of Gloom\'s Crypt.',
      editorNote: 'Pass 40 final boss reward draft.'
    },
    {
      id: 'item_silk_mothers_mantle',
      name: "Silk Mother's Mantle",
      type: 'armor',
      slot: 'cape',
      rarity: 'purple',
      levelRequirement: 5,
      classRestrictions: allClasses,
      stats: { hp: 12, mana: 10, speed: 0.08 },
      damage: null,
      armor: 4,
      sellValue: 135,
      stackSize: 1,
      icon: { family: 'cloak', color: '#d68cff', glyph: '⌁' },
      description: 'A living silk mantle torn from the Silk Mother.',
      editorNote: 'Pass 40 boss reward draft.'
    },
    {
      id: 'item_gloomleaf',
      name: 'Gloomleaf',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 2,
      stackSize: 99,
      icon: { family: 'herb', color: '#75d069', glyph: '♧' },
      description: 'A bitter leaf used in basic remedies and cooking.',
      editorNote: 'Gathering resource.'
    },
    {
      id: 'item_copper_ore',
      name: 'Copper Ore',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 3,
      stackSize: 99,
      icon: { family: 'ore', color: '#c78347', glyph: '◆' },
      description: 'Ore used by blacksmithing recipes.',
      editorNote: 'Mining resource.'
    },
    {
      id: 'item_darkwater_fish',
      name: 'Darkwater Fish',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 4,
      stackSize: 20,
      icon: { family: 'fish', color: '#5eb7cc', glyph: '><>' },
      description: 'A small fish from the blackwater pools.',
      editorNote: 'Fishing/cooking resource.'
    },
    // ---- V0.17.61 Phase 22: Dark Woods-only overworld fish. sellValue = the
    // master plan's vendor value; caught from Dark Woods overworld water only. ----
    {
      id: 'item_duskmud_minnow',
      name: 'Duskmud Minnow',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 2,
      stackSize: 20,
      icon: { family: 'fish', color: '#7a6a4a', glyph: '><>' },
      description: 'A muddy little minnow from the starter ponds and banks of the Dark Woods.',
      editorNote: 'Dark Woods overworld fish (Phase 22).'
    },
    {
      id: 'item_lanternfin',
      name: 'Lanternfin',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 4,
      stackSize: 20,
      icon: { family: 'fish', color: '#e0b95c', glyph: '><>' },
      description: 'A pale, faintly glowing fish found in waters near the dead lantern trails.',
      editorNote: 'Dark Woods overworld fish (Phase 22).'
    },
    {
      id: 'item_brambleback_pike',
      name: 'Brambleback Pike',
      type: 'resource',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 8,
      stackSize: 20,
      icon: { family: 'fish', color: '#6b8f4a', glyph: '><>' },
      description: 'A thorny, aggressive pike that lurks in the tangled waters of Bramblefen Thicket.',
      editorNote: 'Dark Woods overworld fish (Phase 22).'
    },
    {
      id: 'item_ghostscale_trout',
      name: 'Ghostscale Trout',
      type: 'resource',
      slot: 'none',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 15,
      stackSize: 20,
      icon: { family: 'fish', color: '#bcdfe6', glyph: '><>' },
      description: 'A translucent trout from the wisp-touched pools near Stone Hedge.',
      editorNote: 'Dark Woods overworld fish (Phase 22).'
    },
    {
      id: 'item_gloamroot_catfish',
      name: 'Gloamroot Catfish',
      type: 'resource',
      slot: 'none',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 35,
      stackSize: 20,
      icon: { family: 'fish', color: '#4a5a6a', glyph: '><>' },
      description: 'A rare, heavy catfish drawn from the deep shaded pools of Gloamroot Depths.',
      editorNote: 'Dark Woods overworld fish, rare (Phase 22).'
    },
    // ---- V0.17.62 Phase 23: Silk Web Cavern-only cave fish. Caught from cave
    // pools carved into the dungeon floors; higher sellValue reflects the
    // hostile dungeon access. ----
    {
      id: 'item_blind_silk_minnow',
      name: 'Blind Silk Minnow',
      type: 'resource',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 9,
      stackSize: 20,
      icon: { family: 'fish', color: '#cbd6dc', glyph: '><>' },
      description: 'A pale, eyeless minnow that drifts in the shallow cave pools of Silk Web Cavern.',
      editorNote: 'Silk Web Cavern-only cave fish (Phase 23).'
    },
    {
      id: 'item_venomgill_eel',
      name: 'Venomgill Eel',
      type: 'resource',
      slot: 'none',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 20,
      stackSize: 20,
      icon: { family: 'fish', color: '#8fd66a', glyph: '><>' },
      description: 'A venom-slicked eel from the deeper pools near the spider nests of Silk Web Cavern.',
      editorNote: 'Silk Web Cavern-only cave fish (Phase 23).'
    },
    {
      id: 'item_broodpool_angler',
      name: 'Broodpool Angler',
      type: 'resource',
      slot: 'none',
      rarity: 'purple',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 55,
      stackSize: 20,
      icon: { family: 'fish', color: '#7a5aa0', glyph: '><>' },
      description: 'A rare, luminous angler drawn from the deepest broodpools of Silk Web Cavern.',
      editorNote: 'Silk Web Cavern-only cave fish, rare (Phase 23).'
    },
    // ---- V0.17.59 Phase 20: Dark Woods overworld herb materials. sellValue =
    // the master plan's vendor value. Dropped by the herb_* resource nodes. ----
    {
      id: 'item_lantern_moss',
      name: 'Lantern Moss',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 2,
      stackSize: 99,
      icon: { family: 'herb', color: '#8fd6a0', glyph: '♧' },
      description: 'Pale moss that clings to old lantern posts along the Dark Woods roads.',
      editorNote: 'Dark Woods overworld gathering herb (Phase 20).'
    },
    {
      id: 'item_thornberry',
      name: 'Thornberry',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 3,
      stackSize: 99,
      icon: { family: 'herb', color: '#c2456a', glyph: '❦' },
      description: 'A tart red berry that grows on the thorny brush of Bramblefen Thicket.',
      editorNote: 'Dark Woods overworld gathering herb (Phase 20).'
    },
    {
      id: 'item_gloomcap_mushroom',
      name: 'Gloomcap Mushroom',
      type: 'resource',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 99,
      icon: { family: 'herb', color: '#7d6bb0', glyph: '🍄' },
      description: 'A dusky mushroom found in shaded woods and around fallen logs.',
      editorNote: 'Dark Woods overworld gathering herb (Phase 20).'
    },
    {
      id: 'item_wispbloom',
      name: 'Wispbloom',
      type: 'resource',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 14,
      stackSize: 99,
      icon: { family: 'herb', color: '#9fe6ff', glyph: '✿' },
      description: 'A faintly glowing flower that blooms only among the Stone Hedge standing stones.',
      editorNote: 'Dark Woods overworld gathering herb (Phase 20).'
    },
    {
      id: 'item_blackroot',
      name: 'Blackroot Herb',
      type: 'resource',
      slot: 'none',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 32,
      stackSize: 99,
      icon: { family: 'herb', color: '#5a4a7a', glyph: '☘' },
      description: 'A rare, dark taproot drawn from the ancient roots deep in Gloamroot Depths.',
      editorNote: 'Dark Woods overworld gathering herb, rare (Phase 20).'
    },
    // ---- V0.17.60 Phase 21: Silk Web Cavern-only herb materials. Higher
    // sellValue than overworld herbs (hostile dungeon access). ----
    {
      id: 'item_webcap_fungus',
      name: 'Webcap Fungus',
      type: 'resource',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 9,
      stackSize: 99,
      icon: { family: 'herb', color: '#c9b06a', glyph: '🍄' },
      description: 'A web-strewn fungus that grows on the cavern walls of Silk Web Cavern.',
      editorNote: 'Silk Web Cavern-only gathering herb (Phase 21).'
    },
    {
      id: 'item_widows_veil',
      name: "Widow's Veil",
      type: 'resource',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 18,
      stackSize: 99,
      icon: { family: 'herb', color: '#b48cd6', glyph: '✾' },
      description: 'A pale, gauzy herb that clings to the deep spider tunnels of Silk Web Cavern.',
      editorNote: 'Silk Web Cavern-only gathering herb (Phase 21).'
    },
    {
      id: 'item_queens_silkroot',
      name: "Queen's Silkroot",
      type: 'resource',
      slot: 'none',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 50,
      stackSize: 99,
      icon: { family: 'herb', color: '#7a5aa0', glyph: '❦' },
      description: "A prized root drawn from the Silk Queen's nest in the deepest chamber of Silk Web Cavern.",
      editorNote: 'Silk Web Cavern-only gathering herb, rare (Phase 21).'
    },
    {
      id: 'item_copper_bar',
      name: 'Copper Bar',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 8,
      stackSize: 99,
      icon: { family: 'bar', color: '#d69b63', glyph: '▰' },
      description: 'A refined copper bar used in blacksmithing recipes.',
      editorNote: 'Runtime crafting output.'
    },
    {
      id: 'item_gloomleaf_wraps',
      name: 'Gloomleaf Wraps',
      type: 'resource',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 99,
      icon: { family: 'cloth', color: '#9bd889', glyph: '▧' },
      description: 'Herbal wraps prepared for tailoring and basic field dressing.',
      editorNote: 'Runtime crafting output.'
    },
    {
      id: 'item_roasted_darkwater_fish',
      name: 'Roasted Darkwater Fish',
      type: 'consumable',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 8 },
      damage: null,
      armor: 0,
      sellValue: 9,
      stackSize: 20,
      icon: { family: 'food', color: '#f0a35b', glyph: '◒' },
      description: 'A cooked fish that restores health when used from the bag.',
      editorNote: 'Runtime crafting output / usable consumable.'
    },
    {
      // V0.20.70 (Roadmap Item 7): the starter mount, bought rather than tamed. Every other mount
      // requires weakening a beast and winning the taming minigame, which a fresh level-1 character
      // cannot do - the easiest tameable beast needs level 3 and bait that drops in the woods. This
      // gives a new player a mount on day one without touching the taming progression.
      id: 'item_drovers_whistle',
      name: "Drover's Whistle",
      type: 'consumable',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      useEffect: { unlocksMountId: 'mount_black_wolf' },
      cooldownMs: 0,
      damage: null,
      armor: 0,
      sellValue: 120,
      stackSize: 1,
      icon: { family: 'tool', color: '#cbb894', glyph: '♪' },
      description: 'A drover\'s bone whistle. The camp keeps a black riding wolf that answers it - raised from a cub, steady, and in no particular hurry.',
      editorNote: 'V0.20.70: the purchasable starter mount. Sold by the camp quartermaster so a level-1 character is not locked out of mounts until they can tame one.'
    },
    {
      id: 'item_cooked_forest_stew',
      name: 'Cooked Forest Stew',
      type: 'consumable',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 18, mana: 8 },
      useEffect: { hp: 18, mana: 8, buff: { name: 'Warm Meal', duration: 150, mods: { hp: 6 }, effectCategory: 'food' } },
      cooldownMs: 12000,
      damage: null,
      armor: 0,
      sellValue: 16,
      stackSize: 10,
      icon: { family: 'food', color: '#d8ad57', glyph: '♨' },
      description: 'A warm camp stew of gloomleaf and gloomcap. Restores health and mana and leaves you Warm Fed for a while.',
      editorNote: 'V0.18.71: given a campfire recipe (was an orphan food with no source, found by the obtainability audit) + a proper food buff.'
    },
    {
      id: 'item_glooms_crypt_key',
      name: "Gloom's Crypt Key",
      type: 'quest',
      slot: 'none',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 0,
      stackSize: 1,
      icon: { family: 'key', color: '#a987ff', glyph: '⚿' },
      description: 'A cold crypt key tied to the sealed lower chambers of Gloom\'s Crypt.',
      editorNote: 'Key item referenced by the dungeon draft.'
    },
    {
      id: 'item_mossfang_charm',
      name: 'Mossfang Charm',
      type: 'accessory',
      slot: 'charm',
      rarity: 'blue',
      levelRequirement: 5,
      classRestrictions: allClasses,
      stats: { hp: 8, mana: 8, attack: 1 },
      damage: null,
      armor: 0,
      sellValue: 75,
      stackSize: 1,
      icon: { family: 'charm', color: '#5ea2ff', glyph: '✦' },
      description: 'A cave charm carved from an old wolf fang.',
      editorNote: 'Rare Mossfang Cave reward draft.'
    }
    ,
    {
      id: 'item_worn_fishing_rod',
      name: 'Worn Fishing Rod',
      type: 'resource',
      slot: 'tool',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 6,
      stackSize: 1,
      icon: { family: 'tool', color: '#9cc7dd', glyph: '⌁' },
      description: 'A simple rod used to fish from any nearby water. Starter fishing tool.',
      editorNote: 'Pass 48 fishing profession foundation tool.'
    },
    {
      id: 'item_crude_pickaxe',
      name: 'Crude Pickaxe',
      type: 'resource',
      slot: 'tool',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 8,
      stackSize: 1,
      icon: { family: 'tool', color: '#c78347', glyph: '⛏' },
      description: 'A rough mining pick used for starter cave ore nodes.',
      editorNote: 'Pass 48 mining foundation tool.'
    },
    {
      id: 'item_murkwater_minnow',
      name: 'Murkwater Minnow',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 2,
      stackSize: 99,
      icon: { family: 'fish', color: '#75b8c8', glyph: '><>' },
      description: 'A small fish from Dark Woods shallows. Used in cooking.',
      editorNote: 'Pass 48 open-water fishing catch.'
    },
    {
      id: 'item_mossback_carp',
      name: 'Mossback Carp',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 4,
      stackSize: 99,
      icon: { family: 'fish', color: '#789f60', glyph: '><>' },
      description: 'A hardy forest carp with a mossy back.',
      editorNote: 'Pass 48 open-water fishing catch.'
    },
    {
      id: 'item_blackwater_eel',
      name: 'Blackwater Eel',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 11,
      stackSize: 99,
      icon: { family: 'fish', color: '#4da3aa', glyph: '≈' },
      description: 'An eel from deep blackwater pools. Good cooking ingredient.',
      editorNote: 'Pass 48 open-water fishing catch.'
    },
    {
      id: 'item_cave_blindfish',
      name: 'Cave Blindfish',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 5,
      stackSize: 99,
      icon: { family: 'fish', color: '#c9d8d5', glyph: '><>' },
      description: 'A pale fish adapted to underground cave pools.',
      editorNote: 'Pass 48 cave fishing catch.'
    },
    {
      id: 'item_silverfin',
      name: 'Silverfin',
      type: 'resource',
      slot: 'material',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 18,
      stackSize: 99,
      icon: { family: 'fish', color: '#bce8ff', glyph: '✦' },
      description: 'A rare bright fish that flashes like moonlight.',
      editorNote: 'Pass 48 rare open-water fishing catch.'
    },
    {
      id: 'item_torn_boot',
      name: 'Torn Boot',
      type: 'resource',
      slot: 'material',
      rarity: 'grey',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 1,
      stackSize: 20,
      icon: { family: 'junk', color: '#777777', glyph: '⌐' },
      description: 'Fishing junk. Mostly worthless.',
      editorNote: 'Pass 48 junk fishing catch.'
    },
    {
      id: 'item_river_driftwood',
      name: 'River Driftwood',
      type: 'resource',
      slot: 'material',
      rarity: 'grey',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 1,
      stackSize: 50,
      icon: { family: 'junk', color: '#8b6743', glyph: '/' },
      description: 'Waterlogged wood pulled from the water.',
      editorNote: 'Pass 48 junk fishing catch.'
    },
    {
      id: 'item_grilled_minnow',
      name: 'Grilled Minnow',
      type: 'consumable',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 18, mana: 8 },
      useEffect: { hp: 18, mana: 8, buff: { name: 'Well Fed', duration: 120, mods: { defense: 1 }, effectCategory: 'food' } },
      cooldownMs: 10000,
      damage: null,
      armor: 0,
      sellValue: 9,
      stackSize: 20,
      icon: { family: 'food', color: '#e0aa62', glyph: '♨' },
      description: 'Cooked fish food. Restores HP/Mana and grants a small short defensive food buff.',
      editorNote: 'Pass 48 fishing-to-cooking link.'
    },
    {
      id: 'item_cooked_eel_skewer',
      name: 'Cooked Eel Skewer',
      type: 'consumable',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 34, mana: 18 },
      useEffect: { hp: 34, mana: 18, buff: { name: 'Eel Vitality', duration: 180, mods: { hp: 8 }, effectCategory: 'food' } },
      cooldownMs: 12000,
      damage: null,
      armor: 0,
      sellValue: 20,
      stackSize: 20,
      icon: { family: 'food', color: '#d89f57', glyph: '♨' },
      description: 'A stronger cooked fish meal with a short vitality buff.',
      editorNote: 'Pass 48 fishing-to-cooking link.'
    }
    ,
    {
      id: 'item_briar_tusk',
      name: 'Briar Tusk',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 5,
      stackSize: 50,
      icon: { family: 'bone', color: '#d0b58b', glyph: 'ʌ' },
      description: 'A curved tusk chipped from a bramble-fed boar.',
      editorNote: 'V0.11.0 Dark Woods content drop.'
    },
    {
      id: 'item_duskwisp_core',
      name: 'Duskwisp Core',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 2 },
      damage: null,
      armor: 0,
      sellValue: 14,
      stackSize: 25,
      icon: { family: 'gem', color: '#80c9ff', glyph: '✧' },
      description: 'A dim blue spark left behind by a defeated duskwisp.',
      editorNote: 'V0.11.0 Dark Woods mid-zone drop.'
    },
    {
      id: 'item_ashroot_splinter',
      name: 'Ashroot Splinter',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { attack: 1 },
      damage: null,
      armor: 0,
      sellValue: 18,
      stackSize: 25,
      icon: { family: 'wood', color: '#8f8172', glyph: '≋' },
      description: 'A brittle splinter from corrupted deadwood roots.',
      editorNote: 'V0.11.0 Dark Woods outer-zone drop.'
    },
    {
      id: 'item_deepwood_ring',
      name: 'Deepwood Ring',
      type: 'accessory',
      slot: 'ring',
      rarity: 'blue',
      levelRequirement: 6,
      classRestrictions: allClasses,
      stats: { hp: 16, mana: 10, defense: 2 },
      damage: null,
      armor: 0,
      sellValue: 76,
      stackSize: 1,
      icon: { family: 'ring', color: '#69c98f', glyph: '○' },
      description: 'A ring braided from living vine and dull silver. It hums softly near old roots.',
      editorNote: 'V0.11.0 Dark Woods rare outer-zone reward.'
    },
    {
      id: 'item_warden_lantern_charm',
      name: 'Warden Lantern Charm',
      type: 'accessory',
      slot: 'trinket',
      rarity: 'green',
      levelRequirement: 3,
      classRestrictions: allClasses,
      stats: { hp: 10, mana: 6 },
      damage: null,
      armor: 0,
      sellValue: 42,
      stackSize: 1,
      icon: { family: 'charm', color: '#ffd875', glyph: '✦' },
      description: 'A small lantern token given to scouts who return from the deeper road.',
      editorNote: 'V0.11.0 quest reward.'
    }
    ,
    {
      id: 'item_briar_hide',
      name: 'Briar Hide',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 6,
      stackSize: 50,
      icon: { family: 'hide', color: '#9b724b', glyph: '▱' },
      description: 'Tough hide cut from a briar-fed boar. Useful for early leatherwork.',
      editorNote: 'V0.11.3 Dark Woods family material.'
    },
    {
      id: 'item_wolf_pelt',
      name: 'Gloom Wolf Pelt',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 5,
      stackSize: 50,
      icon: { family: 'hide', color: '#707b76', glyph: '▱' },
      description: 'A dark pelt from a Gloom Wolf.',
      editorNote: 'V0.11.3 wolf-family material.'
    },
    {
      id: 'item_rotling_root',
      name: 'Rotling Root',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 4,
      stackSize: 50,
      icon: { family: 'root', color: '#708a45', glyph: '≋' },
      description: 'A twitching root pulled from a defeated rotling.',
      editorNote: 'V0.11.3 rotling-family material.'
    },
    {
      id: 'item_hollow_antler',
      name: 'Hollow Antler',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 16,
      stackSize: 25,
      icon: { family: 'bone', color: '#d0c19d', glyph: '⋔' },
      description: 'A pale antler from a Hollow Stag. It is lighter than it should be.',
      editorNote: 'V0.11.3 deepwood material.'
    },
    {
      id: 'item_light_essence',
      name: 'Light Essence',
      type: 'resource',
      slot: 'material',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 2 },
      damage: null,
      armor: 0,
      sellValue: 24,
      stackSize: 25,
      icon: { family: 'gem', color: '#bce8ff', glyph: '✧' },
      description: 'Condensed pale light from a rare wisp core.',
      editorNote: 'V0.11.3 wisp rare material.'
    },
    {
      id: 'item_corrupted_root',
      name: 'Corrupted Root',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 20,
      stackSize: 25,
      icon: { family: 'root', color: '#74685e', glyph: '≋' },
      description: 'A dead root blackened by ashroot corruption.',
      editorNote: 'V0.11.3 ashroot-family material.'
    },
    {
      id: 'item_road_wardens_buckler',
      name: "Road Warden's Buckler",
      type: 'armor',
      slot: 'offhand',
      rarity: 'green',
      levelRequirement: 2,
      classRestrictions: ['Fighter', 'Cleric', 'Bard'],
      stats: { defense: 5, hp: 10 },
      damage: null,
      armor: 5,
      sellValue: 48,
      stackSize: 1,
      icon: { family: 'shield', color: '#72d88d', glyph: '▣' },
      description: 'A small road shield marked with the lantern warden crest.',
      editorNote: 'V0.11.3 early quest reward.'
    },
    {
      id: 'item_briarhide_gloves',
      name: 'Briarhide Gloves',
      type: 'armor',
      slot: 'hands',
      rarity: 'green',
      levelRequirement: 3,
      classRestrictions: allClasses,
      stats: { attack: 2, defense: 2, hp: 8 },
      damage: null,
      armor: 3,
      sellValue: 55,
      stackSize: 1,
      icon: { family: 'gloves', color: '#8e6a46', glyph: '▧' },
      description: 'Thick gloves stitched from thorn-resistant briar hide.',
      editorNote: 'V0.11.3 early Dark Woods gear.'
    },
    {
      id: 'item_wolfclaw_boots',
      name: 'Wolfclaw Boots',
      type: 'armor',
      slot: 'feet',
      rarity: 'green',
      levelRequirement: 2,
      classRestrictions: allClasses,
      stats: { speed: 0.05, defense: 1, hp: 6 },
      damage: null,
      armor: 2,
      sellValue: 42,
      stackSize: 1,
      icon: { family: 'boots', color: '#7d8980', glyph: '∪' },
      description: 'Soft boots lined with Gloom Wolf pelt.',
      editorNote: 'V0.11.3 wolf-family gear.'
    },
    {
      id: 'item_rotroot_wraps',
      name: 'Rotroot Wraps',
      type: 'armor',
      slot: 'hands',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 4, defense: 1 },
      damage: null,
      armor: 1,
      sellValue: 22,
      stackSize: 1,
      icon: { family: 'cloth', color: '#6f8b48', glyph: '▧' },
      description: 'Basic hand wraps braided from cleaned root fiber.',
      editorNote: 'V0.11.3 starter rootling gear.'
    },
    {
      id: 'item_duskwisp_charm',
      name: 'Duskwisp Charm',
      type: 'accessory',
      slot: 'charm',
      rarity: 'blue',
      levelRequirement: 5,
      classRestrictions: allClasses,
      stats: { mana: 18, defense: 1, speed: 0.03 },
      damage: null,
      armor: 0,
      sellValue: 92,
      stackSize: 1,
      icon: { family: 'charm', color: '#80c9ff', glyph: '✦' },
      description: 'A charm that pulses with a cold blue glimmer.',
      editorNote: 'V0.11.3 midwood quest/drop reward.'
    },
    {
      id: 'item_hollow_stag_mantle',
      name: 'Hollow Stag Mantle',
      type: 'armor',
      slot: 'cape',
      rarity: 'blue',
      levelRequirement: 6,
      classRestrictions: allClasses,
      stats: { hp: 18, defense: 3, mana: 8 },
      damage: null,
      armor: 4,
      sellValue: 110,
      stackSize: 1,
      icon: { family: 'cloak', color: '#c8b78e', glyph: '⌁' },
      description: 'A pale mantle fastened with smooth hollow antler buttons.',
      editorNote: 'V0.11.3 deepwood gear.'
    },
    {
      id: 'item_ashroot_band',
      name: 'Ashroot Band',
      type: 'accessory',
      slot: 'ring',
      rarity: 'purple',
      levelRequirement: 8,
      classRestrictions: allClasses,
      stats: { hp: 18, attack: 3, defense: 2 },
      damage: null,
      armor: 0,
      sellValue: 150,
      stackSize: 1,
      icon: { family: 'ring', color: '#b777ff', glyph: '◈' },
      description: 'A corrupted silver ring threaded with dead root fiber.',
      editorNote: 'V0.11.3 outer woods rare gear.'
    },
    {
      id: 'item_briarback_cleaver',
      name: 'Briarback Cleaver',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'blue',
      levelRequirement: 4,
      classRestrictions: ['Fighter', 'Bard'],
      stats: { attack: 10, hp: 8 },
      damage: { min: 5, max: 12, speed: 2.3 },
      armor: 0,
      sellValue: 120,
      stackSize: 1,
      icon: { family: 'axe', color: '#5ea2ff', glyph: '⚔' },
      description: 'A heavy road-cleaver chipped from Old Tusk Briarback.',
      editorNote: 'V0.11.3 named rare weapon.'
    },
    {
      id: 'item_lumen_wisp_shard',
      name: 'Lumen-Wisp Shard',
      type: 'accessory',
      slot: 'amulet',
      rarity: 'purple',
      levelRequirement: 6,
      classRestrictions: allClasses,
      stats: { mana: 28, speed: 0.05, defense: 2 },
      damage: null,
      armor: 0,
      sellValue: 160,
      stackSize: 1,
      icon: { family: 'gem', color: '#bce8ff', glyph: '✧' },
      description: 'A clear shard that bends dusk-light around it.',
      editorNote: 'V0.11.3 named rare caster reward.'
    },
    {
      id: 'item_thorn_crowned_mantle',
      name: 'Thorn-Crowned Mantle',
      type: 'armor',
      slot: 'cape',
      rarity: 'purple',
      levelRequirement: 8,
      classRestrictions: allClasses,
      stats: { hp: 26, defense: 4, attack: 2 },
      damage: null,
      armor: 5,
      sellValue: 180,
      stackSize: 1,
      icon: { family: 'cloak', color: '#b777ff', glyph: '⌁' },
      description: 'A deepwood mantle crowned with blackened thorn-antler tips.',
      editorNote: 'V0.11.3 named rare deepwood reward.'
    },
    {
      id: 'item_ashroot_elder_heart',
      name: 'Ashroot Elder Heart',
      type: 'accessory',
      slot: 'charm',
      rarity: 'gold',
      levelRequirement: 10,
      classRestrictions: allClasses,
      stats: { hp: 32, mana: 18, attack: 4, defense: 3 },
      damage: null,
      armor: 0,
      sellValue: 260,
      stackSize: 1,
      icon: { family: 'charm', color: '#e5bd5b', glyph: '◆' },
      description: 'A warm coal-like core from the Ashroot Elder.',
      editorNote: 'V0.11.3 outer named rare reward.'
    }
    ,
    {
      id: 'item_mooncap',
      name: 'Mooncap',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 4,
      stackSize: 99,
      icon: { family: 'herb', color: '#b894ff', glyph: '☾' },
      description: 'A pale cave mushroom used by gathering and cooking recipes.',
      editorNote: 'V0.11.8 cave mushroom resource.'
    },
    {
      id: 'item_dreamspore',
      name: 'Dreamspore',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 1 },
      damage: null,
      armor: 0,
      sellValue: 12,
      stackSize: 50,
      icon: { family: 'herb', color: '#d68cff', glyph: '✹' },
      description: 'A luminous spore shaken loose from underground mushrooms.',
      editorNote: 'V0.11.8 rare cave plant resource.'
    },
    {
      id: 'item_silkcap_mushroom',
      name: 'Silkcap Mushroom',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 5,
      stackSize: 99,
      icon: { family: 'herb', color: '#d68cff', glyph: '♧' },
      description: 'A mushroom growing through old spider silk.',
      editorNote: 'V0.11.8 Silk Web Cavern resource.'
    },
    {
      id: 'item_ashroot_moss',
      name: 'Ashroot Moss',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 1 },
      damage: null,
      armor: 0,
      sellValue: 13,
      stackSize: 50,
      icon: { family: 'herb', color: '#9aa276', glyph: '≋' },
      description: 'Dull moss that grows on corrupted roots and catacomb stone.',
      editorNote: 'V0.11.8 Ashroot/Blackroot cave herb.'
    },
    {
      id: 'item_spider_silk',
      name: 'Spider Silk',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 6,
      stackSize: 99,
      icon: { family: 'cloth', color: '#e4c8ff', glyph: '⌁' },
      description: 'Strong cave silk used by later tailoring recipes.',
      editorNote: 'V0.11.8 spider cave drop.'
    },
    {
      id: 'item_venom_sac',
      name: 'Venom Sac',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { attack: 1 },
      damage: null,
      armor: 0,
      sellValue: 16,
      stackSize: 50,
      icon: { family: 'alchemy', color: '#b6ef65', glyph: '●' },
      description: 'A volatile venom gland from deep-cave spiders.',
      editorNote: 'V0.11.8 spider cave rare material.'
    },
    {
      id: 'item_stone',
      name: 'Stone',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 1,
      stackSize: 99,
      icon: { family: 'ore', color: '#8c8a76', glyph: '◆' },
      description: 'Common stone chipped from cave walls.',
      editorNote: 'V0.11.8 mining byproduct.'
    },
    {
      id: 'item_coal',
      name: 'Coal',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 5,
      stackSize: 99,
      icon: { family: 'ore', color: '#3b3c42', glyph: '◆' },
      description: 'A black fuel stone used by future smelting recipes.',
      editorNote: 'V0.11.8 cave mining resource.'
    },
    {
      id: 'item_darkstone_ore',
      name: 'Darkstone Ore',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { defense: 1 },
      damage: null,
      armor: 0,
      sellValue: 14,
      stackSize: 99,
      icon: { family: 'ore', color: '#7b8292', glyph: '◆' },
      description: 'Dense ore from deeper Dark Woods caves.',
      editorNote: 'V0.11.8 mining resource.'
    },
    {
      id: 'item_blackiron_ore',
      name: 'Blackiron Ore',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { defense: 1 },
      damage: null,
      armor: 0,
      sellValue: 18,
      stackSize: 99,
      icon: { family: 'ore', color: '#424852', glyph: '◆' },
      description: 'Heavy ore from old mine seams and catacomb depths.',
      editorNote: 'V0.11.8 Forgotten Mine/Blackroot resource.'
    },
    {
      id: 'item_glimmer_crystal',
      name: 'Glimmer Crystal',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 2 },
      damage: null,
      armor: 0,
      sellValue: 20,
      stackSize: 50,
      icon: { family: 'gem', color: '#70d8e6', glyph: '✧' },
      description: 'A glowing crystal from Crystal Grotto veins.',
      editorNote: 'V0.11.8 crystal cave resource.'
    },
    {
      id: 'item_rough_gem',
      name: 'Rough Gem',
      type: 'resource',
      slot: 'material',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 2 },
      damage: null,
      armor: 0,
      sellValue: 32,
      stackSize: 25,
      icon: { family: 'gem', color: '#9fd7ff', glyph: '◇' },
      description: 'An uncut gem pulled from ore veins.',
      editorNote: 'V0.11.8 mining rare resource.'
    },
    {
      id: 'item_night_crystal',
      name: 'Night Crystal',
      type: 'resource',
      slot: 'material',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 3 },
      damage: null,
      armor: 0,
      sellValue: 40,
      stackSize: 25,
      icon: { family: 'gem', color: '#a987ff', glyph: '✦' },
      description: 'A rare violet crystal found in deep cave veins.',
      editorNote: 'V0.11.8 mining rare resource.'
    },
    {
      id: 'item_pale_eel',
      name: 'Pale Eel',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 18,
      stackSize: 50,
      icon: { family: 'fish', color: '#d6e4cf', glyph: '≈' },
      description: 'A pale eel from underground pools.',
      editorNote: 'V0.11.8 cave-pool rare catch.'
    },
    {
      id: 'item_crystal_band',
      name: 'Crystal Band',
      type: 'accessory',
      slot: 'ring',
      rarity: 'blue',
      levelRequirement: 6,
      classRestrictions: allClasses,
      stats: { mana: 18, defense: 2, speed: 0.04 },
      damage: null,
      armor: 0,
      sellValue: 120,
      stackSize: 1,
      icon: { family: 'ring', color: '#70d8e6', glyph: '○' },
      description: 'A ring set with a cave crystal that hums near underground water.',
      editorNote: 'V0.11.8 Crystal Grotto rare reward.'
    },
    {
      id: 'item_mine_relic_pick',
      name: 'Mine Relic Pick',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'blue',
      levelRequirement: 7,
      classRestrictions: ['Fighter', 'Rogue', 'Bard'],
      stats: { attack: 9, defense: 2 },
      damage: { min: 5, max: 13, speed: 2.25 },
      armor: 0,
      sellValue: 135,
      stackSize: 1,
      icon: { family: 'pickaxe', color: '#d8ad57', glyph: '⛏' },
      description: 'A brutal mining pick recovered from the Forgotten Mine.',
      editorNote: 'V0.11.8 Forgotten Mine rare weapon.'
    },
    {
      id: 'item_blackroot_signet',
      name: 'Blackroot Signet',
      type: 'accessory',
      slot: 'ring',
      rarity: 'purple',
      levelRequirement: 9,
      classRestrictions: allClasses,
      stats: { hp: 24, mana: 20, attack: 3, defense: 3 },
      damage: null,
      armor: 0,
      sellValue: 210,
      stackSize: 1,
      icon: { family: 'ring', color: '#a987ff', glyph: '◈' },
      description: 'A catacomb signet marked with blackroot filigree.',
      editorNote: 'V0.11.8 Blackroot Catacombs rare reward.'
    }
    ,
    {
      id: 'item_tin_bar',
      name: 'Tin Bar',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 99,
      icon: { family: 'bar', color: '#b8a078', glyph: '▰' },
      description: 'A soft tin bar used by starter smithing recipes and fittings.',
      editorNote: 'V0.11.9 blacksmithing output.'
    }

    ,
    {
      id: 'item_basic_fishing_rod',
      name: 'Basic Fishing Rod',
      type: 'tool',
      slot: 'tool',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 1,
      icon: { family: 'tool', color: '#9cc7dd', glyph: '⌁' },
      description: 'A basic rod used to fish from any nearby water.',
      editorNote: 'V0.11.9 profession loop starter fishing tool.'
    },
    {
      id: 'item_worn_hatchet',
      name: 'Worn Hatchet',
      type: 'tool',
      slot: 'tool',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 1,
      icon: { family: 'tool', color: '#b58b4a', glyph: '⌓' },
      description: 'A worn hatchet reserved for woodcutting expansion.',
      editorNote: 'V0.11.9 starter profession tool; woodcutting recipes are deferred.'
    },
    {
      id: 'item_herbalist_knife',
      name: 'Herbalist Knife',
      type: 'tool',
      slot: 'tool',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 1,
      icon: { family: 'tool', color: '#75d069', glyph: '⌁' },
      description: 'A small curved knife for harvesting tougher herbs, mushrooms, and roots.',
      editorNote: 'V0.11.9 profession loop starter gathering tool.'
    },
    {
      id: 'item_tin_ore',
      name: 'Tin Ore',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 3,
      stackSize: 99,
      icon: { family: 'ore', color: '#b8a078', glyph: '◆' },
      description: 'Soft starter ore used for low-tier smithing alloys.',
      editorNote: 'V0.11.9 mining resource.'
    },
    {
      id: 'item_iron_ore',
      name: 'Iron Ore',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 6,
      stackSize: 99,
      icon: { family: 'ore', color: '#9ba2a4', glyph: '◆' },
      description: 'A reliable smithing ore from mid-depth caves and mine seams.',
      editorNote: 'V0.11.9 mining resource.'
    },
    {
      id: 'item_iron_bar',
      name: 'Iron Bar',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 14,
      stackSize: 99,
      icon: { family: 'bar', color: '#bcc4c5', glyph: '▰' },
      description: 'A forged iron bar used for early weapons and armor.',
      editorNote: 'V0.11.9 blacksmithing output.'
    },
    {
      id: 'item_darkstone_bar',
      name: 'Darkstone Bar',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { defense: 1 },
      damage: null,
      armor: 0,
      sellValue: 26,
      stackSize: 99,
      icon: { family: 'bar', color: '#7b8292', glyph: '▰' },
      description: 'A dense dark bar used in tougher cave-forged gear.',
      editorNote: 'V0.11.9 blacksmithing output.'
    },
    {
      id: 'item_blackiron_bar',
      name: 'Blackiron Bar',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { defense: 1 },
      damage: null,
      armor: 0,
      sellValue: 32,
      stackSize: 99,
      icon: { family: 'bar', color: '#424852', glyph: '▰' },
      description: 'A heavy bar for late Dark Woods smithing recipes.',
      editorNote: 'V0.11.9 blacksmithing output.'
    },
    {
      id: 'item_reinforced_buckle',
      name: 'Reinforced Buckle',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 10,
      stackSize: 99,
      icon: { family: 'bar', color: '#d8ad57', glyph: '▣' },
      description: 'A small forged component used by armor and tool recipes.',
      editorNote: 'V0.11.9 blacksmithing component.'
    },
    {
      id: 'item_crude_sword',
      name: 'Crude Sword',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'white',
      levelRequirement: 2,
      classRestrictions: ['Fighter', 'Rogue', 'Bard'],
      stats: { attack: 6 },
      damage: { min: 3, max: 9, speed: 2.45 },
      armor: 0,
      sellValue: 34,
      stackSize: 1,
      icon: { family: 'blade', color: '#d8ded1', glyph: '⚔' },
      description: 'A rough but serviceable blade made from starter metals.',
      editorNote: 'V0.11.9 craftable weapon.'
    },
    {
      id: 'item_iron_dagger',
      name: 'Iron Dagger',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'green',
      levelRequirement: 4,
      classRestrictions: ['Rogue', 'Bard'],
      stats: { attack: 8, speed: 0.05 },
      damage: { min: 4, max: 10, speed: 1.75 },
      armor: 0,
      sellValue: 62,
      stackSize: 1,
      icon: { family: 'dagger', color: '#9ba2a4', glyph: '⌁' },
      description: 'A balanced dagger forged from iron bars.',
      editorNote: 'V0.11.9 craftable weapon.'
    },
    {
      id: 'item_iron_chestguard',
      name: 'Iron Chestguard',
      type: 'armor',
      slot: 'chest',
      rarity: 'green',
      levelRequirement: 5,
      classRestrictions: ['Fighter', 'Cleric'],
      stats: { defense: 8, hp: 18 },
      damage: null,
      armor: 8,
      sellValue: 84,
      stackSize: 1,
      icon: { family: 'armor', color: '#bcc4c5', glyph: '▤' },
      description: 'A basic forged chestguard for front-line classes.',
      editorNote: 'V0.11.9 craftable armor.'
    },
    {
      id: 'item_bitterleaf',
      name: 'Bitterleaf',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 3,
      stackSize: 99,
      icon: { family: 'herb', color: '#8ccf5e', glyph: '♧' },
      description: 'A sharp-tasting herb used in travel rations and broth.',
      editorNote: 'V0.11.9 gathering resource.'
    },
    {
      id: 'item_ashroot',
      name: 'Ashroot',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 1 },
      damage: null,
      armor: 0,
      sellValue: 10,
      stackSize: 99,
      icon: { family: 'root', color: '#9aa276', glyph: '♣' },
      description: 'A soot-dark medicinal root from corrupted hollows.',
      editorNote: 'V0.11.9 gathering resource.'
    },
    {
      id: 'item_glowmoss',
      name: 'Glowmoss',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 1 },
      damage: null,
      armor: 0,
      sellValue: 11,
      stackSize: 99,
      icon: { family: 'herb', color: '#69c59d', glyph: '≋' },
      description: 'Soft luminous moss harvested from cave walls.',
      editorNote: 'V0.11.9 cave gathering resource.'
    },
    {
      id: 'item_redcap_fungus',
      name: 'Redcap Fungus',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 1 },
      damage: null,
      armor: 0,
      sellValue: 9,
      stackSize: 99,
      icon: { family: 'herb', color: '#d65757', glyph: '♧' },
      description: 'A pungent red mushroom used in cave stews.',
      editorNote: 'V0.11.9 cave gathering resource.'
    },
    {
      id: 'item_grave_moss',
      name: 'Grave Moss',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 1 },
      damage: null,
      armor: 0,
      sellValue: 12,
      stackSize: 99,
      icon: { family: 'herb', color: '#a987ff', glyph: '≋' },
      description: 'Cold moss gathered from catacomb stone.',
      editorNote: 'V0.11.9 catacomb gathering resource.'
    },
    {
      id: 'item_bone_dust',
      name: 'Bone Dust',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 4,
      stackSize: 99,
      icon: { family: 'bone', color: '#d8ded1', glyph: '∴' },
      description: 'Powdered bone used by future alchemy and dungeon-key recipes.',
      editorNote: 'V0.11.9 catacomb material.'
    },
    {
      id: 'item_cursed_ore',
      name: 'Cursed Ore',
      type: 'resource',
      slot: 'material',
      rarity: 'blue',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { attack: 1, defense: 1 },
      damage: null,
      armor: 0,
      sellValue: 36,
      stackSize: 50,
      icon: { family: 'ore', color: '#7b4fb1', glyph: '◆' },
      description: 'Ore threaded with blackroot corruption.',
      editorNote: 'V0.11.9 rare mining resource.'
    },
    {
      id: 'item_small_pondfish',
      name: 'Small Pondfish',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 3,
      stackSize: 99,
      icon: { family: 'fish', color: '#5eb7cc', glyph: '><>' },
      description: 'A common fish used in simple cooking recipes.',
      editorNote: 'V0.11.9 fishing resource.'
    },
    {
      id: 'item_mossback_trout',
      name: 'Mossback Trout',
      type: 'resource',
      slot: 'material',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 6,
      stackSize: 99,
      icon: { family: 'fish', color: '#6fae8c', glyph: '><>' },
      description: 'A moss-flecked trout from quiet Dark Woods water.',
      editorNote: 'V0.11.9 fishing resource.'
    },
    {
      id: 'item_cave_eel',
      name: 'Cave Eel',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: {},
      damage: null,
      armor: 0,
      sellValue: 12,
      stackSize: 50,
      icon: { family: 'fish', color: '#d6e4cf', glyph: '≈' },
      description: 'A slick eel from underground water.',
      editorNote: 'V0.11.9 cave-pool fishing resource.'
    },
    {
      id: 'item_roasted_fish',
      name: 'Roasted Fish',
      type: 'consumable',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 12 },
      damage: null,
      armor: 0,
      sellValue: 8,
      stackSize: 20,
      icon: { family: 'food', color: '#f0a35b', glyph: '◒' },
      description: 'Simple roasted fish. Restores HP when used.',
      editorNote: 'V0.11.9 cooking output.'
    },
    {
      id: 'item_mushroom_stew',
      name: 'Mushroom Stew',
      type: 'consumable',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 20, mana: 8 },
      damage: null,
      armor: 0,
      sellValue: 18,
      stackSize: 20,
      icon: { family: 'food', color: '#d8ad57', glyph: '♨' },
      description: 'A cave mushroom stew that restores health and mana.',
      editorNote: 'V0.11.9 cooking output.'
    },
    {
      id: 'item_miners_broth',
      name: "Miner's Broth",
      type: 'consumable',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 16, defense: 1 },
      damage: null,
      armor: 0,
      sellValue: 20,
      stackSize: 20,
      icon: { family: 'food', color: '#c78347', glyph: '♨' },
      description: 'A hearty broth. Restores HP; the defense note is reserved for future timed food buffs.',
      editorNote: 'V0.11.9 cooking output.'
    },
    {
      id: 'item_cave_eel_skewer',
      name: 'Cave Eel Skewer',
      type: 'consumable',
      slot: 'none',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 24, mana: 6 },
      damage: null,
      armor: 0,
      sellValue: 22,
      stackSize: 20,
      icon: { family: 'food', color: '#d6e4cf', glyph: '◒' },
      description: 'A cooked cave eel skewer that restores HP and mana.',
      editorNote: 'V0.11.9 cooking output.'
    },
    {
      id: 'item_simple_travel_ration',
      name: 'Simple Travel Ration',
      type: 'consumable',
      slot: 'none',
      rarity: 'white',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { hp: 10, mana: 4 },
      damage: null,
      armor: 0,
      sellValue: 7,
      stackSize: 20,
      icon: { family: 'food', color: '#d8cfa8', glyph: '▧' },
      description: 'Packed field food made from fish and herbs.',
      editorNote: 'V0.11.9 cooking output.'
    }

    ,
    {
      id: 'item_silverthorn_sprig',
      name: 'Silverthorn Sprig',
      type: 'resource',
      slot: 'material',
      rarity: 'green',
      levelRequirement: 1,
      classRestrictions: allClasses,
      stats: { mana: 1 },
      damage: null,
      armor: 0,
      sellValue: 10,
      stackSize: 99,
      icon: { family: 'herb', color: '#c9e9d7', glyph: '♧' },
      description: 'A rare silver-veined herb sprig used by advanced cooking and future alchemy.',
      editorNote: 'V0.11.9 resolved rare herb drop.'
    }

    ,
                                                                                                                                                        
  ];

  DR.ITEM_DRAFTS.push(
    { id:'item_webbed_chitin_shard', name:'Webbed Chitin Shard', type:'resource', slot:null, rarity:'green', levelRequirement:1, classRestrictions:allClasses, stats:{}, damage:null, armor:0, sellValue:18, stackSize:20, icon:{family:'material',color:'#9ed0b5',glyph:'◆'}, description:'A shard of chitin wrapped in sticky dungeon silk.', editorNote:'V0.13.24 Silk Web Cavern elite material.' },
    { id:'item_spider_silk_thread', name:'Spider Silk Thread', type:'resource', slot:null, rarity:'green', levelRequirement:1, classRestrictions:allClasses, stats:{}, damage:null, armor:0, sellValue:16, stackSize:20, icon:{family:'thread',color:'#d8c8f2',glyph:'〰'}, description:'Strong silk harvested from elite cavern webs.', editorNote:'V0.13.24 Silk Web Cavern elite material.' },
    { id:'item_chitin_buckler', name:'Chitin Buckler', type:'armor', slot:'offhand', rarity:'blue', levelRequirement:6, classRestrictions:['Fighter','Cleric','Bard'], stats:{defense:8,hp:14}, damage:null, armor:8, sellValue:96, stackSize:1, icon:{family:'shield',color:'#5ea2ff',glyph:'▣'}, description:'A hardened spider-chitin buckler from Silk Web Cavern.', editorNote:'V0.13.24 dungeon elite drop.' },
    { id:'item_silkfang_dagger', name:'Silkfang Dagger', type:'weapon', slot:'weapon', rarity:'blue', levelRequirement:6, classRestrictions:['Rogue','Bard','Necromancer'], stats:{attack:10,agility:2}, damage:{min:6,max:13,speed:1.7}, armor:0, sellValue:104, stackSize:1, icon:{family:'dagger',color:'#5ea2ff',glyph:'⌁'}, description:'A quick dagger made from a hollow spider fang.', editorNote:'V0.13.24 dungeon elite drop.' },
    { id:'item_webspinner_wand', name:'Webspinner Wand', type:'weapon', slot:'weapon', rarity:'blue', levelRequirement:6, classRestrictions:['Cleric','Druid','Summoner','Enchanter','Necromancer','Bard'], stats:{mana:22,intellect:3}, damage:{min:4,max:10,speed:2.4}, armor:0, sellValue:106, stackSize:1, icon:{family:'wand',color:'#7ab6ff',glyph:'✦'}, description:'A wand that hums when near thick webbing.', editorNote:'V0.13.24 dungeon elite drop.' },
    { id:'item_cocoonweave_gloves', name:'Cocoonweave Gloves', type:'armor', slot:'hands', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{stamina:2,spirit:2}, damage:null, armor:5, sellValue:88, stackSize:1, icon:{family:'gloves',color:'#7ab6ff',glyph:'▤'}, description:'Gloves stitched from treated cocoon silk.', editorNote:'V0.13.24 dungeon elite drop.' },
    { id:'item_venom_stained_boots', name:'Venom-Stained Boots', type:'armor', slot:'feet', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{agility:2,stamina:2,poisonResist:3}, damage:null, armor:6, sellValue:92, stackSize:1, icon:{family:'boots',color:'#77d07d',glyph:'▰'}, description:'Boots darkened by old venom stains and treated against spider toxin.', editorNote:'V0.13.46 dungeon elite poison-resist drop.' },
    { id:'item_threadjaw_fangblade', name:'Threadjaw Fangblade', type:'weapon', slot:'weapon', rarity:'blue', levelRequirement:7, classRestrictions:['Rogue','Bard','Fighter'], stats:{attack:12,agility:3}, damage:{min:7,max:16,speed:1.8}, armor:0, sellValue:142, stackSize:1, icon:{family:'dagger',color:'#6ba7ff',glyph:'⌁'}, description:'A serrated fangblade torn from Threadjaw Alpha.', editorNote:'V0.13.24 mini-boss drop.' },
    { id:'item_old_venomsacs_gland', name:"Old Venomsac's Gland", type:'accessory', slot:'charm', rarity:'blue', levelRequirement:7, classRestrictions:allClasses, stats:{spirit:2,mana:18,poisonResist:4}, damage:null, armor:0, sellValue:128, stackSize:1, icon:{family:'trinket',color:'#8bdc64',glyph:'●'}, description:'A preserved venom gland used by apothecaries.', editorNote:'V0.13.46 mini-boss charm; legacy trinket saves normalize safely.' },
    { id:'item_cocoon_tenders_sash', name:"Cocoon Tender's Sash", type:'armor', slot:'charm', rarity:'blue', levelRequirement:8, classRestrictions:allClasses, stats:{stamina:3,spirit:2}, damage:null, armor:5, sellValue:138, stackSize:1, icon:{family:'belt',color:'#bb9cff',glyph:'═'}, description:'A broad sash braided from cocoon binding silk.', editorNote:'V0.13.46 mini-boss charm; legacy waist saves normalize safely.' },
    { id:'item_pale_spinners_hood', name:"Pale Spinner's Hood", type:'armor', slot:'head', rarity:'blue', levelRequirement:8, classRestrictions:['Cleric','Druid','Summoner','Enchanter','Necromancer','Bard'], stats:{intellect:3,mana:20}, damage:null, armor:4, sellValue:146, stackSize:1, icon:{family:'hood',color:'#d7c5ff',glyph:'⌂'}, description:'A pale hood with web-stitched eye slits.', editorNote:'V0.13.24 mini-boss drop.' },
    { id:'item_hollowfang_chitin_guard', name:'Hollowfang Chitin Guard', type:'armor', slot:'offhand', rarity:'blue', levelRequirement:8, classRestrictions:['Fighter','Cleric'], stats:{defense:11,hp:22}, damage:null, armor:11, sellValue:154, stackSize:1, icon:{family:'shield',color:'#7ab6ff',glyph:'▣'}, description:'A broad shield plate from Hollowfang Brood-Sire.', editorNote:'V0.13.24 mini-boss drop.' },
    { id:'item_skirrs_chitin_chestguard', name:"Skirr's Chitin Chestguard", type:'armor', slot:'chest', rarity:'blue', levelRequirement:7, classRestrictions:['Fighter','Cleric','Bard'], stats:{defense:13,hp:28}, damage:null, armor:13, sellValue:178, stackSize:1, icon:{family:'chest',color:'#669cff',glyph:'▦'}, description:'A plated chestguard from Broodwarden Skirr.', editorNote:'V0.13.24 floor boss drop.' },
    { id:'item_broodwardens_fang', name:"Broodwarden's Fang", type:'weapon', slot:'weapon', rarity:'blue', levelRequirement:7, classRestrictions:['Fighter','Rogue','Bard'], stats:{attack:13,stamina:2}, damage:{min:8,max:18,speed:2.0}, armor:0, sellValue:184, stackSize:1, icon:{family:'sword',color:'#669cff',glyph:'⚔'}, description:'A weapon shaped from Skirr\'s longest fang.', editorNote:'V0.13.24 floor boss drop.' },
    { id:'item_ring_of_sticky_silk', name:'Ring of Sticky Silk', type:'accessory', slot:'ring1', rarity:'blue', levelRequirement:7, classRestrictions:allClasses, stats:{stamina:2,spirit:2}, damage:null, armor:0, sellValue:170, stackSize:1, icon:{family:'ring',color:'#66b6ff',glyph:'◈'}, description:'A ring threaded with adhesive silk.', editorNote:'V0.13.24 floor boss drop.' },
    { id:'item_velyras_cocoon_robe', name:"Velyra's Cocoon Robe", type:'armor', slot:'chest', rarity:'purple', levelRequirement:9, classRestrictions:['Cleric','Druid','Summoner','Enchanter','Necromancer','Bard'], stats:{intellect:5,spirit:4,mana:36}, damage:null, armor:8, sellValue:270, stackSize:1, icon:{family:'robe',color:'#b15cff',glyph:'▥'}, description:'An epic robe layered with pale cocoon silk.', editorNote:'V0.13.24 Matron Velyra drop.' },
    { id:'item_matrons_venom_focus', name:"Matron's Venom Focus", type:'accessory', slot:'offhand', rarity:'blue', levelRequirement:9, classRestrictions:['Cleric','Druid','Summoner','Enchanter','Necromancer','Bard'], stats:{intellect:4,mana:28}, damage:null, armor:0, sellValue:210, stackSize:1, icon:{family:'focus',color:'#75d069',glyph:'✦'}, description:'A venom-bright focus from Matron Velyra.', editorNote:'V0.13.24 Matron Velyra drop.' },
    { id:'item_widow_silk_leggings', name:'Widow-Silk Leggings', type:'armor', slot:'legs', rarity:'blue', levelRequirement:9, classRestrictions:allClasses, stats:{agility:3,stamina:3}, damage:null, armor:8, sellValue:205, stackSize:1, icon:{family:'legs',color:'#6ba7ff',glyph:'▥'}, description:'Leggings reinforced with widow silk.', editorNote:'V0.13.24 Matron Velyra drop.' },
    { id:'item_queens_loomheart_staff', name:"Queen's Loomheart Staff", type:'weapon', slot:'weapon', rarity:'purple', levelRequirement:10, classRestrictions:['Cleric','Druid','Summoner','Enchanter','Necromancer','Bard'], stats:{intellect:6,spirit:4,mana:46}, damage:{min:9,max:22,speed:2.8}, armor:0, sellValue:420, stackSize:1, icon:{family:'staff',color:'#b15cff',glyph:'杖'}, description:'An epic staff pulsing with the Queen\'s loomheart.', editorNote:'V0.13.24 final boss drop.' },
    { id:'item_arakhzels_carapace_mantle', name:"Arakh'Zel's Carapace Mantle", type:'armor', slot:'chest', rarity:'purple', levelRequirement:10, classRestrictions:allClasses, stats:{defense:8,stamina:5,hp:36}, damage:null, armor:12, sellValue:430, stackSize:1, icon:{family:'mantle',color:'#b15cff',glyph:'▦'}, description:'A heavy mantle from the Queen\'s royal carapace.', editorNote:'V0.13.24 final boss drop.' },
    { id:'item_ring_of_the_looming_hunger', name:'Ring of the Looming Hunger', type:'accessory', slot:'ring1', rarity:'purple', levelRequirement:10, classRestrictions:allClasses, stats:{attack:4,intellect:4,hp:18,mana:18}, damage:null, armor:0, sellValue:410, stackSize:1, icon:{family:'ring',color:'#b15cff',glyph:'◈'}, description:'A ring that vibrates with hungry silk-lines.', editorNote:'V0.13.24 final boss drop.' },
    { id:'item_royal_websilk_satchel', name:'Royal Websilk Satchel', type:'bag', slot:'bag', rarity:'blue', levelRequirement:8, classRestrictions:allClasses, stats:{slots:8}, damage:null, armor:0, sellValue:180, stackSize:1, bagSlots:8, icon:{family:'bag',color:'#5ea2ff',glyph:'▤'}, description:'An eight-slot dungeon satchel woven from royal websilk.', editorNote:'V0.13.24 final boss bag drop.' },
    { id:'item_queens_venom_fang', name:"Queen's Venom Fang", type:'weapon', slot:'weapon', rarity:'purple', levelRequirement:10, classRestrictions:['Rogue','Bard','Fighter','Necromancer'], stats:{attack:17,agility:5}, damage:{min:11,max:25,speed:1.9}, armor:0, sellValue:440, stackSize:1, icon:{family:'dagger',color:'#b15cff',glyph:'⌁'}, description:'A dagger cut from Queen Arakh\'Zel\'s venom fang.', editorNote:'V0.13.24 final boss drop.' },
    { id:'item_silk_web_antivenom_charm', name:'Silk Web Antivenom Charm', type:'accessory', slot:'amulet', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{stamina:2,spirit:3,poisonResist:6}, damage:null, armor:0, sellValue:120, stackSize:1, icon:{family:'charm',color:'#83d873',glyph:'✚'}, description:'A charm prepared against Silk Web Cavern venom.', editorNote:'V0.13.46 quest reward with dungeon poison resistance.' }
  );


  DR.ITEM_DRAFTS.push(
    { id:'item_darkbough_helmet', name:'Darkbough Helmet', type:'armor', slot:'head', rarity:'green', levelRequirement:2, classRestrictions:['Fighter','Cleric','Bard'], stats:{defense:3,hp:10}, damage:null, armor:3, sellValue:38, stackSize:1, icon:{family:'helm',color:'#54c86f',glyph:'⌂'}, description:'A bark-ridged helmet reinforced with tarnished iron.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_moonless_silk_hood', name:'Moonless Silk Hood', type:'armor', slot:'head', rarity:'green', levelRequirement:2, classRestrictions:['Druid','Enchanter','Summoner','Necromancer','Cleric','Bard'], stats:{mana:12,spirit:1}, damage:null, armor:2, sellValue:40, stackSize:1, icon:{family:'hood',color:'#66c982',glyph:'⌂'}, description:'A soft hood stitched from darkwood spider silk.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_gloomguard_pauldrons', name:'Gloomguard Pauldrons', type:'armor', slot:'shoulders', rarity:'green', levelRequirement:3, classRestrictions:['Fighter','Cleric','Bard'], stats:{defense:4,hp:12}, damage:null, armor:4, sellValue:46, stackSize:1, icon:{family:'shoulders',color:'#54c86f',glyph:'▱'}, description:'Heavy shoulder plates worn by old road guards.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_moss_stitched_mantle', name:'Moss-Stitched Mantle', type:'armor', slot:'shoulders', rarity:'green', levelRequirement:3, classRestrictions:['Rogue','Druid','Enchanter','Summoner','Necromancer','Bard'], stats:{mana:9,attack:2}, damage:null, armor:2, sellValue:48, stackSize:1, icon:{family:'shoulders',color:'#65cf78',glyph:'▱'}, description:'A flexible shoulder mantle quilted with living moss.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_shadowmoss_cape', name:'Shadowmoss Cape', type:'armor', slot:'cape', rarity:'green', levelRequirement:3, classRestrictions:allClasses, stats:{hp:7,mana:7,speed:0.03}, damage:null, armor:2, sellValue:50, stackSize:1, icon:{family:'cloak',color:'#5ecf88',glyph:'⌁'}, description:'A dark cape that breaks up the wearer’s outline in the woods.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_lanternthread_cape', name:'Lanternthread Cape', type:'armor', slot:'cape', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{hp:14,mana:12,speed:0.05}, damage:null, armor:4, sellValue:118, stackSize:1, icon:{family:'cloak',color:'#5ea2ff',glyph:'⌁'}, description:'A cape threaded with pale lantern-fiber and warding knots.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_old_path_amulet', name:'Amulet of the Old Path', type:'accessory', slot:'amulet', rarity:'green', levelRequirement:2, classRestrictions:allClasses, stats:{attack:2,defense:2,mana:8}, damage:null, armor:0, sellValue:52, stackSize:1, icon:{family:'amulet',color:'#65cf78',glyph:'◎'}, description:'A small neck charm carved with an old road mark.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_warden_lantern_amulet', name:'Warden Lantern Amulet', type:'accessory', slot:'amulet', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{defense:3,spirit:3,mana:14}, damage:null, armor:0, sellValue:124, stackSize:1, icon:{family:'amulet',color:'#5ea2ff',glyph:'◎'}, description:'A blue-lit amulet that steadies the wearer in deep gloom.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_briar_silver_earring', name:'Briar-Silver Earring', type:'accessory', slot:'earring1', rarity:'green', levelRequirement:2, classRestrictions:allClasses, stats:{mana:7,spirit:1}, damage:null, armor:0, sellValue:44, stackSize:1, icon:{family:'earring',color:'#65cf78',glyph:'◦'}, description:'A single silver hoop twisted through a briar thorn.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_fangbone_earring', name:'Fangbone Earring', type:'accessory', slot:'earring2', rarity:'green', levelRequirement:2, classRestrictions:allClasses, stats:{attack:1,hp:7}, damage:null, armor:0, sellValue:44, stackSize:1, icon:{family:'earring',color:'#65cf78',glyph:'◦'}, description:'A small bone earring cut from a gloomfang shard.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_starlit_moth_earring', name:'Starlit Moth Earring', type:'accessory', slot:'earring1', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{intellect:2,spirit:2,mana:12}, damage:null, armor:0, sellValue:116, stackSize:1, icon:{family:'earring',color:'#5ea2ff',glyph:'◦'}, description:'A tiny wing-shaped earring that catches cave light.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_hollow_light_ring', name:'Ring of Hollow Light', type:'accessory', slot:'ring1', rarity:'green', levelRequirement:2, classRestrictions:allClasses, stats:{mana:10,hp:6}, damage:null, armor:0, sellValue:54, stackSize:1, icon:{family:'ring',color:'#65cf78',glyph:'◈'}, description:'A faintly glowing ring found near the old paths.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_deepwood_band', name:'Deepwood Band', type:'accessory', slot:'ring2', rarity:'green', levelRequirement:2, classRestrictions:allClasses, stats:{attack:2,stamina:1}, damage:null, armor:0, sellValue:54, stackSize:1, icon:{family:'ring',color:'#65cf78',glyph:'◈'}, description:'A dark wooden ring hardened with resin.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_rootglass_signet', name:'Rootglass Signet', type:'accessory', slot:'ring2', rarity:'blue', levelRequirement:6, classRestrictions:allClasses, stats:{attack:2,intellect:2,hp:10,mana:10}, damage:null, armor:0, sellValue:128, stackSize:1, icon:{family:'ring',color:'#5ea2ff',glyph:'◈'}, description:'A polished blue signet grown around a sliver of rootglass.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_bone_luck_charm', name:'Bone Luck Charm', type:'accessory', slot:'charm', rarity:'green', levelRequirement:2, classRestrictions:allClasses, stats:{hp:8,mana:8,attack:1}, damage:null, armor:0, sellValue:48, stackSize:1, icon:{family:'charm',color:'#65cf78',glyph:'✚'}, description:'A small charm strung with carved bone chips.', editorNote:'V0.13.35 full gear-slot loot coverage.' },
    { id:'item_webbed_queen_earring', name:'Webbed Queen Earring', type:'accessory', slot:'earring2', rarity:'purple', levelRequirement:10, classRestrictions:allClasses, stats:{intellect:4,spirit:3,mana:24}, damage:null, armor:0, sellValue:260, stackSize:1, icon:{family:'earring',color:'#b15cff',glyph:'◦'}, description:'A purple earring woven from royal cavern silk.', editorNote:'V0.13.35 Silk Web Cavern slot coverage.' },
    { id:'item_royal_websilk_cape', name:'Royal Websilk Cape', type:'armor', slot:'cape', rarity:'purple', levelRequirement:10, classRestrictions:allClasses, stats:{hp:24,mana:20,speed:0.08}, damage:null, armor:6, sellValue:300, stackSize:1, icon:{family:'cloak',color:'#b15cff',glyph:'⌁'}, description:'An epic cape spun from Queen Arakh\'Zel’s royal webbing.', editorNote:'V0.13.35 Silk Web Cavern slot coverage.' },
    { id:'item_arakhzels_spined_shoulders', name:"Arakh'Zel's Spined Shoulders", type:'armor', slot:'shoulders', rarity:'purple', levelRequirement:10, classRestrictions:allClasses, stats:{defense:6,stamina:4,hp:28}, damage:null, armor:8, sellValue:310, stackSize:1, icon:{family:'shoulders',color:'#b15cff',glyph:'▱'}, description:'Spined shoulder armor shaped from royal carapace.', editorNote:'V0.13.35 Silk Web Cavern slot coverage.' }
  );


  // V0.15.89: starter gear for the expanded 14-class roster.
  DR.ITEM_DRAFTS.push(
                    
                    
    
                
                    
                    
                              );


  // V0.16.89: Complete 14-class starter gear catalog. Class starter equipment is
  // replaced here in the item owner; profession tools, bags, loot, and non-class
  // starter items remain untouched.
  DR.ITEM_DRAFTS.push(
    {
            "id": "item_starter_v01689_paladin_oath_mace",
            "name": "Oathlit Recruit Mace",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Paladin"
            ],
            "stats": {
                "attack": 2,
                "defense": 1
            },
            "damage": {
                "min": 2,
                "max": 4,
                "speed": 2.7
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "mace",
                "color": "#f3d46b",
                "glyph": "✚"
            },
            "description": "A plain recruit mace marked with a dull oath-sigil.",
            "editorNote": "V0.16.89 Paladin starter weapon."
        },
        {
            "id": "item_starter_v01689_paladin_lantern_shield",
            "name": "Lantern Oath Shield",
            "type": "armor",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Paladin"
            ],
            "stats": {
                "defense": 3,
                "hp": 6
            },
            "damage": null,
            "armor": 3,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "shield",
                "color": "#e9d37b",
                "glyph": "▣"
            },
            "description": "A battered shield painted with a faded lantern oath.",
            "editorNote": "V0.16.89 Paladin starter shield."
        },
        {
            "id": "item_starter_v01689_paladin_dull_mail",
            "name": "Dull Sunmail Vest",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Paladin"
            ],
            "stats": {
                "defense": 3,
                "hp": 5,
                "mana": 2
            },
            "damage": null,
            "armor": 3,
            "sellValue": 6,
            "stackSize": 1,
            "icon": {
                "family": "mail",
                "color": "#d8c98a",
                "glyph": "▥"
            },
            "description": "Training mail worn by new holy defenders.",
            "editorNote": "V0.16.89 Paladin starter chest."
        },
        {
            "id": "item_starter_v01689_paladin_squire_greaves",
            "name": "Squire Sunmail Greaves",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Paladin"
            ],
            "stats": {
                "defense": 2,
                "hp": 3
            },
            "damage": null,
            "armor": 2,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#bfae72",
                "glyph": "▥"
            },
            "description": "Simple greaves with dull brass links.",
            "editorNote": "V0.16.89 Paladin starter legs."
        },
        {
            "id": "item_starter_v01689_paladin_oathwalker_boots",
            "name": "Oathwalker Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Paladin"
            ],
            "stats": {
                "defense": 1,
                "hp": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#6e5736",
                "glyph": "▰"
            },
            "description": "Heavy field boots used by new oathkeepers.",
            "editorNote": "V0.16.89 Paladin starter feet."
        },
        {
            "id": "item_starter_v01689_warden_root_mallet",
            "name": "Rootstone Training Mallet",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Warden"
            ],
            "stats": {
                "attack": 2,
                "defense": 1
            },
            "damage": {
                "min": 2,
                "max": 4,
                "speed": 2.9
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "maul",
                "color": "#8fcf70",
                "glyph": "◆"
            },
            "description": "A root-bound mallet weighted with smooth fieldstone.",
            "editorNote": "V0.16.89 Warden starter weapon."
        },
        {
            "id": "item_starter_v01689_warden_barkguard",
            "name": "Barkguard Buckler",
            "type": "armor",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Warden"
            ],
            "stats": {
                "defense": 3,
                "hp": 7
            },
            "damage": null,
            "armor": 3,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "shield",
                "color": "#8fcf70",
                "glyph": "▣"
            },
            "description": "A buckler layered with bark strips and green cord.",
            "editorNote": "V0.16.89 Warden starter shield."
        },
        {
            "id": "item_starter_v01689_warden_thornhide_vest",
            "name": "Thornhide Initiate Vest",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Warden"
            ],
            "stats": {
                "defense": 3,
                "hp": 7
            },
            "damage": null,
            "armor": 3,
            "sellValue": 6,
            "stackSize": 1,
            "icon": {
                "family": "hide",
                "color": "#6fa861",
                "glyph": "▧"
            },
            "description": "Flexible hide armor reinforced with thorned seams.",
            "editorNote": "V0.16.89 Warden starter chest."
        },
        {
            "id": "item_starter_v01689_warden_rootfiber_leggings",
            "name": "Rootfiber Leggings",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Warden"
            ],
            "stats": {
                "defense": 2,
                "hp": 3
            },
            "damage": null,
            "armor": 2,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#5f8545",
                "glyph": "▧"
            },
            "description": "Waxed root-fiber leggings made for rough ground.",
            "editorNote": "V0.16.89 Warden starter legs."
        },
        {
            "id": "item_starter_v01689_warden_mossbound_boots",
            "name": "Mossbound Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Warden"
            ],
            "stats": {
                "defense": 1,
                "hp": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#4d6138",
                "glyph": "▰"
            },
            "description": "Moss-padded boots that steady the wearer in mud.",
            "editorNote": "V0.16.89 Warden starter feet."
        },
        {
            "id": "item_starter_v01689_fighter_rustcleaver",
            "name": "Rustcleaver Training Blade",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Fighter"
            ],
            "stats": {
                "attack": 4
            },
            "damage": {
                "min": 3,
                "max": 6,
                "speed": 3.2
            },
            "armor": 0,
            "sellValue": 6,
            "stackSize": 1,
            "twoHanded": true,
            "icon": {
                "family": "greatsword",
                "color": "#d0b070",
                "glyph": "⚔"
            },
            "description": "A crude two-handed blade made for learning weight, reach, and timing.",
            "editorNote": "V0.16.89 Fighter starter two-handed weapon."
        },
        {
            "id": "item_starter_v01689_fighter_bruisers_token",
            "name": "Bruiser Training Token",
            "type": "accessory",
            "slot": "charm",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Fighter"
            ],
            "stats": {
                "attack": 1,
                "hp": 3
            },
            "damage": null,
            "armor": 0,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "charm",
                "color": "#d0b070",
                "glyph": "◆"
            },
            "description": "A rough iron token carried by new heavy-weapon trainees.",
            "editorNote": "V0.16.89 Fighter starter identity charm."
        },
        {
            "id": "item_starter_v01689_fighter_split_leather_vest",
            "name": "Split-Leather Bruiser Vest",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Fighter"
            ],
            "stats": {
                "defense": 2,
                "hp": 3,
                "attack": 1
            },
            "damage": null,
            "armor": 2,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "leather",
                "color": "#876443",
                "glyph": "▧"
            },
            "description": "Light leather armor that protects without slowing a heavy swing.",
            "editorNote": "V0.16.89 Fighter starter chest."
        },
        {
            "id": "item_starter_v01689_fighter_bruiser_pants",
            "name": "Bruiser Footwork Pants",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Fighter"
            ],
            "stats": {
                "defense": 1,
                "attack": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#6e4d34",
                "glyph": "▧"
            },
            "description": "Reinforced leather pants built for stance work and lunges.",
            "editorNote": "V0.16.89 Fighter starter legs."
        },
        {
            "id": "item_starter_v01689_fighter_stride_boots",
            "name": "Heavy-Step Stride Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Fighter"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.01
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#523927",
                "glyph": "▰"
            },
            "description": "Scuffed boots with enough grip to support a full wind-up swing.",
            "editorNote": "V0.16.89 Fighter starter feet."
        },
        {
            "id": "item_starter_v01689_rogue_gutter_dagger",
            "name": "Gutter Training Dagger",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Rogue"
            ],
            "stats": {
                "attack": 2,
                "speed": 0.02
            },
            "damage": {
                "min": 2,
                "max": 4,
                "speed": 2.1
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "dagger",
                "color": "#9fa4aa",
                "glyph": "†"
            },
            "description": "A dull-edged dagger balanced for quick cuts.",
            "editorNote": "V0.16.89 Rogue starter main-hand dagger."
        },
        {
            "id": "item_starter_v01689_rogue_sleeve_shiv",
            "name": "Sleeve Shiv",
            "type": "weapon",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Rogue"
            ],
            "stats": {
                "attack": 1,
                "speed": 0.03
            },
            "damage": {
                "min": 1,
                "max": 3,
                "speed": 2
            },
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "dagger",
                "color": "#c4c7cb",
                "glyph": "†"
            },
            "description": "A crude off-hand blade meant for fast follow-up cuts.",
            "editorNote": "V0.16.89 Rogue starter offhand weapon."
        },
        {
            "id": "item_starter_v01689_rogue_shadowpatched_jerkin",
            "name": "Shadowpatched Jerkin",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Rogue"
            ],
            "stats": {
                "defense": 1,
                "attack": 1,
                "speed": 0.01
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "leather",
                "color": "#4e5256",
                "glyph": "▧"
            },
            "description": "Dark leather patched for silent movement.",
            "editorNote": "V0.16.89 Rogue starter chest."
        },
        {
            "id": "item_starter_v01689_rogue_cutpurse_pants",
            "name": "Cutpurse Leather Pants",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Rogue"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.02
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#373b40",
                "glyph": "▧"
            },
            "description": "Flexible pants with knife-slit seams and quiet stitching.",
            "editorNote": "V0.16.89 Rogue starter legs."
        },
        {
            "id": "item_starter_v01689_rogue_softfall_boots",
            "name": "Softfall Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Rogue"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.03
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#26282b",
                "glyph": "▰"
            },
            "description": "Soft-soled boots made for quiet footwork.",
            "editorNote": "V0.16.89 Rogue starter feet."
        },
        {
            "id": "item_starter_v01689_ranger_greenwood_bow",
            "name": "Greenwood Scout Bow",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Ranger"
            ],
            "stats": {
                "attack": 3,
                "speed": 0.01
            },
            "damage": {
                "min": 2,
                "max": 5,
                "speed": 2.5
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "twoHanded": true,
            "icon": {
                "family": "bow",
                "color": "#77b85f",
                "glyph": "➶"
            },
            "description": "A flexible shortbow made for patrol shots and moving aim.",
            "editorNote": "V0.16.89 Ranger starter bow."
        },
        {
            "id": "item_starter_v01689_ranger_frayed_quiver",
            "name": "Frayed Scout Quiver",
            "type": "accessory",
            "slot": "charm",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Ranger"
            ],
            "stats": {
                "attack": 1,
                "speed": 0.01
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "quiver",
                "color": "#77b85f",
                "glyph": "➶"
            },
            "description": "A patched quiver with enough arrows for a first patrol.",
            "editorNote": "V0.16.89 Ranger starter quiver charm."
        },
        {
            "id": "item_starter_v01689_ranger_trailhide_jerkin",
            "name": "Trailhide Scout Jerkin",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Ranger"
            ],
            "stats": {
                "defense": 1,
                "hp": 3,
                "attack": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "leather",
                "color": "#557d49",
                "glyph": "▧"
            },
            "description": "Light trail armor dyed in muted forest green.",
            "editorNote": "V0.16.89 Ranger starter chest."
        },
        {
            "id": "item_starter_v01689_ranger_pathfinder_pants",
            "name": "Pathfinder Field Pants",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Ranger"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.02
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#435f38",
                "glyph": "▧"
            },
            "description": "Field pants with reinforced knees and quiet cloth seams.",
            "editorNote": "V0.16.89 Ranger starter legs."
        },
        {
            "id": "item_starter_v01689_ranger_miretrail_boots",
            "name": "Miretrail Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Ranger"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.03
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#2f472a",
                "glyph": "▰"
            },
            "description": "Trail boots made for mud, roots, and quick repositioning.",
            "editorNote": "V0.16.89 Ranger starter feet."
        },
        {
            "id": "item_starter_v01689_assassin_hand_crossbow",
            "name": "Blackstring Hand Crossbow",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Assassin"
            ],
            "stats": {
                "attack": 3
            },
            "damage": {
                "min": 2,
                "max": 5,
                "speed": 2.7
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "crossbow",
                "color": "#7e6aa8",
                "glyph": "➶"
            },
            "description": "A light crossbow with a dark cord and rough bone sight.",
            "editorNote": "V0.16.89 Assassin starter crossbow."
        },
        {
            "id": "item_starter_v01689_assassin_throwing_fangs",
            "name": "Bundle of Throwing Fangs",
            "type": "weapon",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Assassin"
            ],
            "stats": {
                "attack": 2,
                "speed": 0.02
            },
            "damage": {
                "min": 1,
                "max": 3,
                "speed": 2.2
            },
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "dagger",
                "color": "#9b83d0",
                "glyph": "✦"
            },
            "description": "Short weighted blades used for opening throws and finishing cuts.",
            "editorNote": "V0.16.89 Assassin starter throwing offhand."
        },
        {
            "id": "item_starter_v01689_assassin_nightpad_vest",
            "name": "Nightpad Leather Vest",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Assassin"
            ],
            "stats": {
                "defense": 1,
                "attack": 1,
                "speed": 0.01
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "leather",
                "color": "#3d3354",
                "glyph": "▧"
            },
            "description": "Padded leather dyed dark violet for ambush work.",
            "editorNote": "V0.16.89 Assassin starter chest."
        },
        {
            "id": "item_starter_v01689_assassin_silent_trousers",
            "name": "Silent Mark Trousers",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Assassin"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.02
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#302840",
                "glyph": "▧"
            },
            "description": "Soft trousers cut for crouching, traps, and quick withdrawals.",
            "editorNote": "V0.16.89 Assassin starter legs."
        },
        {
            "id": "item_starter_v01689_assassin_ghoststep_boots",
            "name": "Ghoststep Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Assassin"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.03
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#241f30",
                "glyph": "▰"
            },
            "description": "Quiet boots built for fast repositioning after a shot.",
            "editorNote": "V0.16.89 Assassin starter feet."
        },
        {
            "id": "item_starter_v01689_wizard_splinter_wand",
            "name": "Splintered Arcane Wand",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Wizard"
            ],
            "stats": {
                "attack": 1,
                "mana": 7
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.8
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "wand",
                "color": "#6fa8ff",
                "glyph": "✦"
            },
            "description": "A cracked wand that still holds a thin arcane charge.",
            "editorNote": "V0.16.89 Wizard starter weapon."
        },
        {
            "id": "item_starter_v01689_wizard_chipped_orb",
            "name": "Chipped Blueglass Orb",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Wizard"
            ],
            "stats": {
                "mana": 8
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "orb",
                "color": "#8fbdff",
                "glyph": "◎"
            },
            "description": "A chipped focus orb used to steady basic spellcasting.",
            "editorNote": "V0.16.89 Wizard starter offhand focus."
        },
        {
            "id": "item_starter_v01689_wizard_threadbare_robe",
            "name": "Threadbare Arcane Robe",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Wizard"
            ],
            "stats": {
                "mana": 9,
                "defense": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "robe",
                "color": "#355b99",
                "glyph": "▥"
            },
            "description": "A faded blue robe with simple stitched spell marks.",
            "editorNote": "V0.16.89 Wizard starter chest."
        },
        {
            "id": "item_starter_v01689_wizard_inkmarked_trousers",
            "name": "Inkmarked Cloth Trousers",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Wizard"
            ],
            "stats": {
                "mana": 4
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#263f70",
                "glyph": "▥"
            },
            "description": "Cloth trousers stained with old study ink.",
            "editorNote": "V0.16.89 Wizard starter legs."
        },
        {
            "id": "item_starter_v01689_wizard_softstep_slippers",
            "name": "Softstep Study Slippers",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Wizard"
            ],
            "stats": {
                "mana": 3
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#1f3156",
                "glyph": "▰"
            },
            "description": "Soft slippers made for library floors, not battlefields.",
            "editorNote": "V0.16.89 Wizard starter feet."
        },
        {
            "id": "item_starter_v01689_shaman_raincaller_rod",
            "name": "Raincaller Rod",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Shaman"
            ],
            "stats": {
                "attack": 1,
                "mana": 6
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.8
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "staff",
                "color": "#59c9b2",
                "glyph": "ϟ"
            },
            "description": "A storm-marked rod wrapped in wet cord and beadwork.",
            "editorNote": "V0.16.89 Shaman starter weapon."
        },
        {
            "id": "item_starter_v01689_shaman_pebble_totem",
            "name": "Pebble Spirit Totem",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Shaman"
            ],
            "stats": {
                "mana": 6,
                "defense": 1
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "totem",
                "color": "#70e6d3",
                "glyph": "◆"
            },
            "description": "A small earth totem used to anchor storm rites.",
            "editorNote": "V0.16.89 Shaman starter offhand totem."
        },
        {
            "id": "item_starter_v01689_shaman_stormhide_wrap",
            "name": "Stormhide Initiate Wrap",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Shaman"
            ],
            "stats": {
                "mana": 7,
                "defense": 2
            },
            "damage": null,
            "armor": 2,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "hide",
                "color": "#35766b",
                "glyph": "▧"
            },
            "description": "A hide wrap marked with storm knots and spirit ash.",
            "editorNote": "V0.16.89 Shaman starter chest."
        },
        {
            "id": "item_starter_v01689_shaman_riverwoven_leggings",
            "name": "Riverwoven Leggings",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Shaman"
            ],
            "stats": {
                "mana": 4,
                "defense": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#28574f",
                "glyph": "▧"
            },
            "description": "Woven leggings dyed with river clay and stormwater.",
            "editorNote": "V0.16.89 Shaman starter legs."
        },
        {
            "id": "item_starter_v01689_shaman_mudsole_boots",
            "name": "Mudsole Spirit Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Shaman"
            ],
            "stats": {
                "defense": 1,
                "mana": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#244840",
                "glyph": "▰"
            },
            "description": "Earth-packed boots that keep the caster grounded.",
            "editorNote": "V0.16.89 Shaman starter feet."
        },
        {
            "id": "item_starter_v01689_summoner_binder_rod",
            "name": "Binder Rod",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Summoner"
            ],
            "stats": {
                "attack": 1,
                "mana": 6
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.8
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "focus",
                "color": "#66d6c7",
                "glyph": "✦"
            },
            "description": "A small rod etched with crude binding marks.",
            "editorNote": "V0.16.89 Summoner starter weapon."
        },
        {
            "id": "item_starter_v01689_summoner_pact_grimoire",
            "name": "Blank Pact Grimoire",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Summoner"
            ],
            "stats": {
                "mana": 7,
                "hp": 2
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "grimoire",
                "color": "#8be9dd",
                "glyph": "▤"
            },
            "description": "An empty grimoire prepared for a first familiar bond.",
            "editorNote": "V0.16.89 Summoner starter grimoire."
        },
        {
            "id": "item_starter_v01689_summoner_teal_initiate_robe",
            "name": "Teal Initiate Robe",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Summoner"
            ],
            "stats": {
                "mana": 8,
                "defense": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "robe",
                "color": "#2c756f",
                "glyph": "▥"
            },
            "description": "A teal robe stitched with beginner summoning circles.",
            "editorNote": "V0.16.89 Summoner starter chest."
        },
        {
            "id": "item_starter_v01689_summoner_boundcloth_pants",
            "name": "Boundcloth Pants",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Summoner"
            ],
            "stats": {
                "mana": 4,
                "hp": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#245b57",
                "glyph": "▥"
            },
            "description": "Cloth pants threaded with weak binding cord.",
            "editorNote": "V0.16.89 Summoner starter legs."
        },
        {
            "id": "item_starter_v01689_summoner_circle_sandals",
            "name": "Circle-Step Sandals",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Summoner"
            ],
            "stats": {
                "mana": 3
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#1e4946",
                "glyph": "▰"
            },
            "description": "Simple sandals used when drawing summoning circles.",
            "editorNote": "V0.16.89 Summoner starter feet."
        },
        {
            "id": "item_starter_v01689_necromancer_bonepin_wand",
            "name": "Bonepin Wand",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Necromancer"
            ],
            "stats": {
                "attack": 1,
                "mana": 6
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.9
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "bonewand",
                "color": "#78a06a",
                "glyph": "☠"
            },
            "description": "A thin wand made from polished bone splinters.",
            "editorNote": "V0.16.89 Necromancer starter weapon."
        },
        {
            "id": "item_starter_v01689_necromancer_chalk_skull",
            "name": "Chalk-Marked Skull Focus",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Necromancer"
            ],
            "stats": {
                "mana": 7,
                "hp": 2
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "skull",
                "color": "#a8c09a",
                "glyph": "☠"
            },
            "description": "A small skull focus marked with chalked grave signs.",
            "editorNote": "V0.16.89 Necromancer starter skull focus."
        },
        {
            "id": "item_starter_v01689_necromancer_gravecloth_robe",
            "name": "Frayed Gravecloth Robe",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Necromancer"
            ],
            "stats": {
                "mana": 8,
                "defense": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "robe",
                "color": "#42503d",
                "glyph": "▥"
            },
            "description": "A robe sewn from grey gravecloth and old binding thread.",
            "editorNote": "V0.16.89 Necromancer starter chest."
        },
        {
            "id": "item_starter_v01689_necromancer_bonewrap_leggings",
            "name": "Bonewrap Leggings",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Necromancer"
            ],
            "stats": {
                "mana": 4,
                "hp": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#323d30",
                "glyph": "▥"
            },
            "description": "Dark leggings wrapped with brittle bone charms.",
            "editorNote": "V0.16.89 Necromancer starter legs."
        },
        {
            "id": "item_starter_v01689_necromancer_gravedust_boots",
            "name": "Gravedust Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Necromancer"
            ],
            "stats": {
                "mana": 3
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#252d24",
                "glyph": "▰"
            },
            "description": "Dusty boots that smell faintly of old crypt soil.",
            "editorNote": "V0.16.89 Necromancer starter feet."
        },
        {
            "id": "item_starter_v01689_cleric_bell_mace",
            "name": "Bellmark Acolyte Mace",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Cleric"
            ],
            "stats": {
                "attack": 1,
                "mana": 4,
                "defense": 1
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.8
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "mace",
                "color": "#f0e6a0",
                "glyph": "✚"
            },
            "description": "A simple mace carried by new field acolytes.",
            "editorNote": "V0.16.89 Cleric starter weapon."
        },
        {
            "id": "item_starter_v01689_cleric_wooden_prayer_icon",
            "name": "Wooden Prayer Icon",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Cleric"
            ],
            "stats": {
                "mana": 6,
                "defense": 1
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "symbol",
                "color": "#fff0a8",
                "glyph": "✚"
            },
            "description": "A carved prayer icon used to focus basic healing rites.",
            "editorNote": "V0.16.89 Cleric starter prayer symbol."
        },
        {
            "id": "item_starter_v01689_cleric_plain_chain_vest",
            "name": "Plain Acolyte Chain Vest",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Cleric"
            ],
            "stats": {
                "defense": 2,
                "hp": 4,
                "mana": 4
            },
            "damage": null,
            "armor": 2,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "mail",
                "color": "#d8d0a0",
                "glyph": "▥"
            },
            "description": "Light chain armor for healers working near danger.",
            "editorNote": "V0.16.89 Cleric starter chest."
        },
        {
            "id": "item_starter_v01689_cleric_field_chain_leggings",
            "name": "Field Chain Leggings",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Cleric"
            ],
            "stats": {
                "defense": 1,
                "mana": 3
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#aaa37d",
                "glyph": "▥"
            },
            "description": "Light chain leggings with patched cloth backing.",
            "editorNote": "V0.16.89 Cleric starter legs."
        },
        {
            "id": "item_starter_v01689_cleric_candlewax_boots",
            "name": "Candlewax Field Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Cleric"
            ],
            "stats": {
                "defense": 1,
                "mana": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#756f56",
                "glyph": "▰"
            },
            "description": "Field boots stained with chapel wax and road dust.",
            "editorNote": "V0.16.89 Cleric starter feet."
        },
        {
            "id": "item_starter_v01689_druid_crooked_branch_staff",
            "name": "Crooked Branch Staff",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Druid"
            ],
            "stats": {
                "attack": 1,
                "mana": 5
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.9
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "staff",
                "color": "#78c26d",
                "glyph": "♣"
            },
            "description": "A living branch staff trimmed for novice rites.",
            "editorNote": "V0.16.89 Druid starter weapon."
        },
        {
            "id": "item_starter_v01689_druid_seedling_totem",
            "name": "Seedling Totem",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Druid"
            ],
            "stats": {
                "mana": 6,
                "hp": 2
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "totem",
                "color": "#9adf87",
                "glyph": "♣"
            },
            "description": "A tiny green totem used for basic renewal magic.",
            "editorNote": "V0.16.89 Druid starter offhand totem."
        },
        {
            "id": "item_starter_v01689_druid_leafmend_robe",
            "name": "Leafmend Robe",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Druid"
            ],
            "stats": {
                "mana": 7,
                "defense": 1,
                "hp": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "robe",
                "color": "#3f7f42",
                "glyph": "▥"
            },
            "description": "A robe patched with broad leaves and natural thread.",
            "editorNote": "V0.16.89 Druid starter chest."
        },
        {
            "id": "item_starter_v01689_druid_barkwoven_leggings",
            "name": "Barkwoven Leggings",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Druid"
            ],
            "stats": {
                "mana": 3,
                "defense": 1,
                "hp": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#345f34",
                "glyph": "▥"
            },
            "description": "Soft leggings woven with thin strips of bark fiber.",
            "editorNote": "V0.16.89 Druid starter legs."
        },
        {
            "id": "item_starter_v01689_druid_dewmoss_sandals",
            "name": "Dewmoss Sandals",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Druid"
            ],
            "stats": {
                "mana": 2,
                "speed": 0.01
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#274927",
                "glyph": "▰"
            },
            "description": "Moss-lined sandals used for quiet grove walking.",
            "editorNote": "V0.16.89 Druid starter feet."
        },
        {
            "id": "item_starter_v01689_bard_camp_songblade",
            "name": "Camp Songblade",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Bard"
            ],
            "stats": {
                "attack": 2,
                "mana": 3
            },
            "damage": {
                "min": 2,
                "max": 4,
                "speed": 2.4
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "songblade",
                "color": "#c69bea",
                "glyph": "♪"
            },
            "description": "A light blade used to keep rhythm between songs.",
            "editorNote": "V0.16.89 Bard starter weapon."
        },
        {
            "id": "item_starter_v01689_bard_weathered_lute",
            "name": "Weathered Camp Lute",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Bard"
            ],
            "stats": {
                "mana": 5,
                "defense": 1
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "lute",
                "color": "#d7b1ff",
                "glyph": "♫"
            },
            "description": "A battered lute used for camp songs and morale chants.",
            "editorNote": "V0.16.89 Bard starter instrument offhand."
        },
        {
            "id": "item_starter_v01689_bard_minstrel_vest",
            "name": "Patchwork Minstrel Vest",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Bard"
            ],
            "stats": {
                "defense": 1,
                "mana": 5,
                "hp": 2
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "leather",
                "color": "#765994",
                "glyph": "▧"
            },
            "description": "A colorful vest patched from old stage cloth and road leather.",
            "editorNote": "V0.16.89 Bard starter chest."
        },
        {
            "id": "item_starter_v01689_bard_travel_tights",
            "name": "Travel-Tuned Trousers",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Bard"
            ],
            "stats": {
                "mana": 3,
                "speed": 0.01
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#604773",
                "glyph": "▧"
            },
            "description": "Light trousers cut for dancing, dodging, and marching songs.",
            "editorNote": "V0.16.89 Bard starter legs."
        },
        {
            "id": "item_starter_v01689_bard_stageworn_boots",
            "name": "Stageworn Performer Boots",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Bard"
            ],
            "stats": {
                "defense": 1,
                "speed": 0.02
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#42314f",
                "glyph": "▰"
            },
            "description": "Soft performer boots with worn heels and quiet soles.",
            "editorNote": "V0.16.89 Bard starter feet."
        },
        {
            "id": "item_starter_v01689_enchanter_rune_wand",
            "name": "Crooked Rune Wand",
            "type": "weapon",
            "slot": "weapon",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Enchanter"
            ],
            "stats": {
                "attack": 1,
                "mana": 6
            },
            "damage": {
                "min": 1,
                "max": 4,
                "speed": 2.8
            },
            "armor": 0,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "wand",
                "color": "#b8a0ff",
                "glyph": "✦"
            },
            "description": "A crooked wand scratched with faint mind-runes.",
            "editorNote": "V0.16.89 Enchanter starter weapon."
        },
        {
            "id": "item_starter_v01689_enchanter_clouded_orb",
            "name": "Clouded Thought Orb",
            "type": "accessory",
            "slot": "offhand",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Enchanter"
            ],
            "stats": {
                "mana": 7
            },
            "damage": null,
            "armor": 0,
            "sellValue": 4,
            "stackSize": 1,
            "icon": {
                "family": "orb",
                "color": "#c7b6ff",
                "glyph": "◎"
            },
            "description": "A cloudy focus orb used to steady charm and illusion magic.",
            "editorNote": "V0.16.89 Enchanter starter orb."
        },
        {
            "id": "item_starter_v01689_enchanter_faded_silk_robe",
            "name": "Faded Violet Silk Robe",
            "type": "armor",
            "slot": "chest",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Enchanter"
            ],
            "stats": {
                "mana": 8,
                "defense": 1
            },
            "damage": null,
            "armor": 1,
            "sellValue": 5,
            "stackSize": 1,
            "icon": {
                "family": "robe",
                "color": "#5f4a9a",
                "glyph": "▥"
            },
            "description": "A faded robe stitched with simple illusion patterns.",
            "editorNote": "V0.16.89 Enchanter starter chest."
        },
        {
            "id": "item_starter_v01689_enchanter_runecloth_trousers",
            "name": "Runecloth Trousers",
            "type": "armor",
            "slot": "legs",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Enchanter"
            ],
            "stats": {
                "mana": 4
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "legs",
                "color": "#493873",
                "glyph": "▥"
            },
            "description": "Light cloth trousers marked with unfinished runes.",
            "editorNote": "V0.16.89 Enchanter starter legs."
        },
        {
            "id": "item_starter_v01689_enchanter_quietmind_slippers",
            "name": "Quietmind Slippers",
            "type": "armor",
            "slot": "feet",
            "rarity": "white",
            "levelRequirement": 1,
            "classRestrictions": [
                "Enchanter"
            ],
            "stats": {
                "mana": 3
            },
            "damage": null,
            "armor": 1,
            "sellValue": 3,
            "stackSize": 1,
            "icon": {
                "family": "boots",
                "color": "#332852",
                "glyph": "▰"
            },
            "description": "Soft slippers used during long charm and focus lessons.",
            "editorNote": "V0.16.89 Enchanter starter feet."
        }
  );


  // V0.17.84 Dark Woods Quest Rebuild - quest items + reward gear for the new
  // 25-quest set (design: Blackroot Dark Woods Quests.txt). Flavor stats from
  // the design doc are mapped onto the game's real stat keys (mana/hp/defense/
  // attack/speed/intellect/poisonResist).
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_lantern_oil', name: 'Lantern Oil', type: 'consumable', slot: 'none',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 4, stackSize: 20, icon: { family: 'potion', color: '#ffd36a', glyph: '🜍' },
      description: 'A small tin of trail-lantern oil. Enough to rekindle a dark lantern post.',
      editorNote: 'V0.17.84 quest [01] Light the Way reward.'
    },
    {
      id: 'item_tarnished_coin', name: 'Tarnished Coin', type: 'resource', slot: 'none',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 3, stackSize: 99, icon: { family: 'coin', color: '#b7a86a', glyph: '◉' },
      description: 'A coin two centuries old, thrown into the old forest well as a wish. The marks around its rim are not decoration.',
      editorNote: 'V0.17.84 quest item: [02] What the Well Remembers (kept), delivered in [03], keys the [17] rune puzzle.'
    },
    {
      id: 'item_pilgrim_charm', name: "Pilgrim's Charm", type: 'accessory', slot: 'charm',
      rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: { intellect: 2, mana: 10 }, damage: null, armor: 0,
      sellValue: 40, stackSize: 1, icon: { family: 'charm', color: '#c9b8e8', glyph: '✚' },
      description: 'A small pewter charm from the old pilgrim road. Some debts are older than we are.',
      editorNote: 'V0.17.84 quest [03] The Pilgrim\'s Road reward (design "+2 wisdom" -> intellect).'
    },
    {
      id: 'item_hunters_journal', name: "Aldric's Journal", type: 'resource', slot: 'none',
      rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 2, stackSize: 1, icon: { family: 'book', color: '#8a6b45', glyph: '▤' },
      description: 'Third day. Found a kill. Not wolf work - the ribs were opened, not torn. Something is dragging them somewhere. North-east, into the thick. I am going to see.',
      editorNote: 'V0.17.84 quest item: recovered in [06], the ONLY guidance for the [07] breadcrumb trail (kept in bag).'
    },
    {
      id: 'item_briarback_tusk_charm', name: 'Briarback Tusk Charm', type: 'accessory', slot: 'charm',
      rarity: 'blue', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, poisonResist: 8, hp: 10 }, damage: null, armor: 2,
      sellValue: 130, stackSize: 1, icon: { family: 'charm', color: '#7fae5a', glyph: '⚞' },
      description: 'A charm carved from Old Tusk Briarback\'s broken tusk. Wards against the bramble\'s poison.',
      editorNote: 'V0.17.84 quest [08] Old Tusk reward choice [a].'
    },
    {
      id: 'item_aldrics_bow', name: "Aldric's Bow", type: 'weapon', slot: 'weapon',
      rarity: 'blue', levelRequirement: 5, classRestrictions: ['Fighter', 'Rogue', 'Ranger', 'Bard'], stats: { attack: 9, speed: 0.05 }, damage: { min: 6, max: 11, speed: 2.1 }, armor: 0,
      sellValue: 130, stackSize: 1, icon: { family: 'bow', color: '#5ea2ff', glyph: '🏹' },
      description: 'The best hunter in the Bramblefen carried this bow. He would want it used.',
      editorNote: 'V0.17.84 quest [08] Old Tusk reward choice [b] (design "ranged, +dex" -> attack/speed).'
    },
    {
      id: 'item_thornberry_draught', name: 'Thornberry Draught', type: 'consumable', slot: 'none',
      rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 12, stackSize: 20, icon: { family: 'potion', color: '#b13c5a', glyph: '🜋' },
      description: 'A tart red draught pressed from bramblefen thornberries. Restores vigor in the field.',
      editorNote: 'V0.17.84 quest [08] Old Tusk reward choice [c].'
    }
  );

  // V0.17.86 Dark Woods Quest Rebuild II - Bandit's Fall + Rurik branch items.
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_torn_lookout_ledger', name: "Torn Lookout's Ledger", type: 'resource', slot: 'none',
      rarity: 'white', levelRequirement: 5, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 2, stackSize: 1, icon: { family: 'book', color: '#8a7a5a', glyph: '▤' },
      description: 'It came up out of the ground near the old grove and it was not a beast, it was WALKING, and it was made of the forest. We are not raiders any more. We are refugees.',
      editorNote: 'V0.17.86 quest [13] The Lookout\'s Last Watch (kept). Seeds the Gloamroot zone arc.'
    },
    {
      id: 'item_bandit_lockpicks', name: 'Bandit Lockpicks', type: 'resource', slot: 'none',
      rarity: 'white', levelRequirement: 7, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 25, stackSize: 5, icon: { family: 'tool', color: '#b0b0b8', glyph: '⚿' },
      description: 'A rolled set of fine bandit lockpicks. Rurik pays those who keep their word.',
      editorNote: 'V0.17.86 quest [14a] The Bargain reward.'
    },
    {
      id: 'item_ruriks_fallen_blade', name: "Rurik's Fallen Blade", type: 'weapon', slot: 'weapon',
      rarity: 'purple', levelRequirement: 7, classRestrictions: ['Fighter', 'Rogue', 'Bard', 'Assassin'], stats: { attack: 14, hp: 12, speed: 0.04 }, damage: { min: 9, max: 17, speed: 2.2 }, armor: 0,
      sellValue: 320, stackSize: 1, icon: { family: 'sword', color: '#b777ff', glyph: '⚔' },
      description: "The blade of the fallen bandit king. The first unique weapon to leave Dark Woods.",
      editorNote: 'V0.17.86 quest [14b] The Fall of Rurik reward choice [a] - first unique weapon.'
    },
    {
      id: 'item_fences_ledger', name: "The Fence's Ledger", type: 'accessory', slot: 'charm',
      rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { intellect: 2 }, damage: null, armor: 0,
      sellValue: 260, stackSize: 1, icon: { family: 'book', color: '#5ea2ff', glyph: '▣' },
      description: 'Every debt, every name, every price in Dark Woods. Merchants deal gently with the one who holds it. (Vendor-discount effect flavour; not yet wired to prices.)',
      editorNote: 'V0.17.86 quest [14b] reward choice [b] - design "permanent 10% vendor discount"; a trinket for now.'
    }
  );

  // V0.17.87 Dark Woods Quest Rebuild III - Stone Hedge Clearing items.
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_lumenshard', name: 'Lumenshard', type: 'accessory', slot: 'charm',
      rarity: 'purple', levelRequirement: 8, classRestrictions: allClasses, stats: { mana: 24, intellect: 3 }, damage: null, armor: 0,
      sellValue: 210, stackSize: 1, icon: { family: 'charm', color: '#d7f6ff', glyph: '✦' },
      description: 'A shard of the Lumen-Wisp that never stops glowing. It rekindles dark lanterns you pass - the level-1 trail lit effortlessly, five levels on.',
      editorNote: 'V0.17.87 quest [19] Lumen reward choice [a] (glow/relight flavour).'
    },
    {
      id: 'item_wispflame_focus', name: 'Wispflame Focus', type: 'accessory', slot: 'offhand',
      rarity: 'purple', levelRequirement: 8, classRestrictions: allClasses, stats: { intellect: 5, mana: 14 }, damage: null, armor: 0,
      sellValue: 210, stackSize: 1, icon: { family: 'orb', color: '#9be7ff', glyph: '❉' },
      description: 'A cold blue wispflame caught in a focus of glass and silver. Sharpens a caster\'s will.',
      editorNote: 'V0.17.87 quest [19] Lumen reward choice [b] (offhand, spell power -> intellect).'
    },
    {
      id: 'item_wardstone_fragment', name: 'Wardstone Fragment', type: 'resource', slot: 'none',
      rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 60, stackSize: 20, icon: { family: 'stone', color: '#b7c4d8', glyph: '◈' },
      description: 'A shard of one of the standing stones, warm with old warding magic. The ring was raised to seal something.',
      editorNote: 'V0.17.87 quest [17]/[20] Stone Hedge reward material.'
    }
  );

  // V0.17.88 Dark Woods Quest Rebuild V - Silk Web Approach items.
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_antivenom', name: 'Silk Web Antivenom', type: 'consumable', slot: 'none',
      rarity: 'white', levelRequirement: 6, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      sellValue: 18, stackSize: 20, icon: { family: 'potion', color: '#83d873', glyph: '🜁' },
      description: 'A cloudy green draught that draws spider venom from the blood. Makes the whole cavern survivable.',
      editorNote: 'V0.17.88 quest [23] Anti-Venom Supply reward (Quartermaster).'
    }
  );

  // V0.17.89 Dark Woods Quest Rebuild VI - Gloamroot Depths + capstone items.
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_grove_token', name: 'Grove Token', type: 'accessory', slot: 'charm',
      rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { hp: 20, mana: 12 }, damage: null, armor: 1,
      sellValue: 180, stackSize: 1, icon: { family: 'charm', color: '#7fae5a', glyph: '❦' },
      description: 'A token of woven root the old shrine accepted. Something in the deep woods is still listening.',
      editorNote: 'V0.17.89 quest [24] Offerings reward.'
    },
    {
      id: 'item_heart_of_the_long_root', name: 'Heart of the Long Root', type: 'accessory', slot: 'charm',
      rarity: 'orange', levelRequirement: 10, classRestrictions: allClasses, stats: { hp: 40, mana: 30, attack: 5, defense: 4 }, damage: null, armor: 3,
      sellValue: 600, stackSize: 1, icon: { family: 'charm', color: '#8fe06a', glyph: '✦' },
      description: 'The still-beating heart of the walking forest, warm against the rot it held back for years. The best charm the Dark Woods will ever give.',
      editorNote: "V0.17.89 quest [25] The Long Root capstone reward choice [a] - the zone's best."
    },
    {
      id: 'item_thalens_seal', name: "Thalen's Seal", type: 'accessory', slot: 'ring',
      rarity: 'orange', levelRequirement: 10, classRestrictions: allClasses, stats: { intellect: 4, mana: 20 }, damage: null, armor: 0,
      sellValue: 600, stackSize: 1, icon: { family: 'rune', color: '#b7c4d8', glyph: '❂' },
      description: 'Elder Thalen\'s warding seal. Those who carry it draw a richer harvest from the Dark Woods. (+15% harvest-yield flavour; the seal is worn, the effect is the story.)',
      editorNote: 'V0.17.89 quest [25] capstone reward choice [b] - design "+15% harvest yield in Dark Woods".'
    }
  );

  // V0.18.68 (Roadmap Item 3 D): Dark Woods herbal potions. Brewed at the campfire (the early-game
  // crafting hub) from gathered Dark Woods herbs. Instant heal/mana draughts route their cooldown
  // to a shared potion group (effectCategory potion_heal / potion_mana); the tonics/elixirs apply a
  // categorized potion_buff, so only one potion buff is active at a time via the effect policy.
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_minor_healing_draught', name: 'Minor Healing Draught', type: 'consumable', slot: 'none',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      useEffect: { hp: 45 }, effectCategory: 'potion_heal', cooldownMs: 15000,
      sellValue: 12, stackSize: 20, icon: { family: 'potion', color: '#d8434f', glyph: '🜍' },
      description: 'A red draught pressed from gloomleaf. Restores a burst of health.',
      editorNote: 'V0.18.68 herbal potion (Roadmap Item 3 D). Campfire brew.'
    },
    {
      id: 'item_minor_mana_draught', name: 'Minor Mana Draught', type: 'consumable', slot: 'none',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      useEffect: { mana: 35 }, effectCategory: 'potion_mana', cooldownMs: 15000,
      sellValue: 12, stackSize: 20, icon: { family: 'potion', color: '#4a7bd8', glyph: '🜄' },
      description: 'A cool blue draught steeped from wispbloom. Restores a burst of mana.',
      editorNote: 'V0.18.68 herbal potion (Roadmap Item 3 D). Campfire brew.'
    },
    {
      id: 'item_regeneration_tonic', name: 'Regeneration Tonic', type: 'consumable', slot: 'none',
      rarity: 'green', levelRequirement: 3, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      useEffect: { hp: 10, buff: { name: 'Regeneration', duration: 30, periodicHealing: 6, tickRate: 3, effectCategory: 'potion_buff', color: '#7fd08a' } },
      cooldownMs: 20000,
      sellValue: 22, stackSize: 20, icon: { family: 'potion', color: '#6fbf6a', glyph: '🜁' },
      description: 'A green tonic of gloomleaf and lantern moss that knits wounds over time.',
      editorNote: 'V0.18.68 herbal potion (Roadmap Item 3 D). Campfire brew.'
    },
    {
      id: 'item_clarity_tonic', name: 'Clarity Tonic', type: 'consumable', slot: 'none',
      rarity: 'green', levelRequirement: 3, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      useEffect: { mana: 8, buff: { name: 'Clarity', duration: 30, periodicMana: 5, tickRate: 3, effectCategory: 'potion_buff', color: '#6f9fe0' } },
      cooldownMs: 20000,
      sellValue: 22, stackSize: 20, icon: { family: 'potion', color: '#6f9fe0', glyph: '🜄' },
      description: 'A clear infusion of wispbloom and lantern moss that restores mana steadily.',
      editorNote: 'V0.18.68 herbal potion (Roadmap Item 3 D). Campfire brew.'
    },
    {
      id: 'item_bramblehide_elixir', name: 'Bramblehide Elixir', type: 'consumable', slot: 'none',
      rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      useEffect: { buff: { name: 'Bramblehide', duration: 180, mods: { defense: 4, armor: 3 }, effectCategory: 'potion_buff', color: '#b98a4a' } },
      cooldownMs: 30000,
      sellValue: 28, stackSize: 20, icon: { family: 'potion', color: '#b98a4a', glyph: '🜃' },
      description: 'A thick elixir of thornberry and blackroot that toughens the skin.',
      editorNote: 'V0.18.68 herbal potion (Roadmap Item 3 D). Campfire brew.'
    },
    {
      id: 'item_antivenom_draught', name: 'Antivenom Draught', type: 'consumable', slot: 'none',
      rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: {}, damage: null, armor: 0,
      useEffect: { buff: { name: 'Antivenom', duration: 180, mods: { poisonResist: 20 }, effectCategory: 'potion_buff', color: '#8fd873' } },
      cooldownMs: 30000,
      sellValue: 30, stackSize: 20, icon: { family: 'potion', color: '#8fd873', glyph: '🜁' },
      description: 'A bitter draught of gloomcap and webcap that wards against spider venom.',
      editorNote: 'V0.18.68 herbal potion (Roadmap Item 3 D). Handy in the Silk Web Cavern.'
    }
  );

  // V0.18.69 (Roadmap Item 3 A): the Wildpelt set - a complete craftable Dark Woods starter armor
  // set, one piece for every armour slot including the belt. Leatherwork stitched at the campfire
  // from Dark Woods animal materials (Gloom Wolf pelt, Briar Hide, Briar Tusk, Bone Dust) bound
  // with Gloomleaf. Low starter stats: a meaningful first upgrade for a poorly-equipped character.
  DR.ITEM_DRAFTS.push(
    {
      id: 'item_wildpelt_hood', name: 'Wildpelt Hood', type: 'armor', slot: 'head', armorType: 'leather',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { defense: 1, hp: 4 }, damage: null, armor: 2,
      sellValue: 10, stackSize: 1, icon: { family: 'helm', color: '#8e6a46', glyph: '⌂' },
      description: 'A hood of Gloom Wolf pelt, laced shut against the cold of the woods.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_mantle', name: 'Wildpelt Mantle', type: 'armor', slot: 'shoulders', armorType: 'leather',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { defense: 1, hp: 3 }, damage: null, armor: 1,
      sellValue: 9, stackSize: 1, icon: { family: 'shoulders', color: '#8a6a48', glyph: '⌒' },
      description: 'Pelt and hide draped across the shoulders and pinned with a splinter of tusk.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_vest', name: 'Wildpelt Vest', type: 'armor', slot: 'chest', armorType: 'leather',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { defense: 2, hp: 8 }, damage: null, armor: 4,
      sellValue: 16, stackSize: 1, icon: { family: 'chest', color: '#9b724b', glyph: '▤' },
      description: 'A stitched vest of briar hide over a wolf-pelt lining. Tough and warm.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_leggings', name: 'Wildpelt Leggings', type: 'armor', slot: 'legs', armorType: 'leather',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { defense: 1, hp: 6 }, damage: null, armor: 3,
      sellValue: 13, stackSize: 1, icon: { family: 'legs', color: '#8e6a46', glyph: '▥' },
      description: 'Briar-hide leggings bound at the knee with gloomleaf cord.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_gloves', name: 'Wildpelt Gloves', type: 'armor', slot: 'hands', armorType: 'leather',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { defense: 1, hp: 3 }, damage: null, armor: 1,
      sellValue: 8, stackSize: 1, icon: { family: 'gloves', color: '#8a6a48', glyph: '▧' },
      description: 'Simple hide gloves, the fingers left free for gathering and grip.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_boots', name: 'Wildpelt Boots', type: 'armor', slot: 'feet', armorType: 'leather',
      rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { speed: 0.03, defense: 1, hp: 3 }, damage: null, armor: 2,
      sellValue: 10, stackSize: 1, icon: { family: 'boots', color: '#7d8980', glyph: '∪' },
      description: 'Soft pelt-lined boots that make little sound on the forest floor.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_cloak', name: 'Wildpelt Cloak', type: 'armor', slot: 'cape', armorType: 'leather',
      rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 1, hp: 4 }, damage: null, armor: 1,
      sellValue: 12, stackSize: 1, icon: { family: 'cape', color: '#707b76', glyph: '⛃' },
      description: 'A full wolf-pelt cloak, tusk-clasped at the throat. Sheds rain and gloom alike.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A).'
    },
    {
      id: 'item_wildpelt_belt', name: 'Wildpelt Belt', type: 'armor', slot: 'belt', armorType: 'leather',
      rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 1, hp: 3 }, damage: null, armor: 1,
      sellValue: 9, stackSize: 1, icon: { family: 'belt', color: '#8e6a46', glyph: '▬' },
      description: 'A broad hide belt studded with bone. Holds a pack and a blade both.',
      editorNote: 'V0.18.69 Wildpelt starter set (Roadmap Item 3 A). Covers the belt slot.'
    }
  );

  // V0.18.75 (Roadmap Item 4 B): a proper Dark Woods BELT pool - 20 distinct belts across levels
  // 1-7 and white/green/blue rarity, with offensive / defensive / caster / regen / utility /
  // gathering profiles and two class-oriented belts. Every belt has a source (vendor / loot /
  // craft), tracked by the obtainability audit. type 'armor', slot 'belt'.
  const beltIcon = (color, glyph) => ({ family: 'belt', color, glyph: glyph || '▬' });
  DR.ITEM_DRAFTS.push(
    // --- basic / vendor (white) ---
    { id: 'item_belt_frayed_rope', name: 'Frayed Rope Belt', type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { defense: 1, hp: 4 }, damage: null, armor: 1, sellValue: 6, stackSize: 1, icon: beltIcon('#9a8358'), description: 'A length of knotted rope worn as a belt. Better than nothing.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    { id: 'item_belt_studded_leather', name: 'Studded Leather Belt', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 6 }, damage: null, armor: 2, sellValue: 11, stackSize: 1, icon: beltIcon('#8a6a46'), description: 'A plain leather belt reinforced with iron studs.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    { id: 'item_belt_hunters_cord', name: "Hunter's Cord", type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { attack: 2, speed: 0.02 }, damage: null, armor: 1, sellValue: 12, stackSize: 1, icon: beltIcon('#a05a3a'), description: 'A hunter\'s working belt, hung with empty snare-loops.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    { id: 'item_belt_woven_reed_sash', name: 'Woven Reed Sash', type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { mana: 12, intellect: 1 }, damage: null, armor: 0, sellValue: 12, stackSize: 1, icon: beltIcon('#6f9fb0'), description: 'A sash of dried riverbank reeds, cool against the skin.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    { id: 'item_belt_travelers', name: "Traveler's Belt", type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { speed: 0.04, hp: 4 }, damage: null, armor: 1, sellValue: 13, stackSize: 1, icon: beltIcon('#7d8980'), description: 'A well-worn road belt with a dozen little buckles.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    { id: 'item_belt_mendcloth', name: 'Mendcloth Belt', type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: { hp: 8, hpRegen: 2 }, damage: null, armor: 1, sellValue: 14, stackSize: 1, icon: beltIcon('#6fae72'), description: 'Wrapped in poultice-soaked cloth that keeps a wound closed.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    { id: 'item_belt_foragers_toolbelt', name: "Forager's Toolbelt", type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: { defense: 1, hp: 6, stamina: 1 }, damage: null, armor: 1, sellValue: 15, stackSize: 1, icon: beltIcon('#8f7a4a'), description: 'A sturdy toolbelt with loops for a knife, sickle and pouch.', editorNote: 'V0.18.75 belt pool (Item 4 B). Gathering/utility.' },
    { id: 'item_belt_apprentice_cord', name: "Apprentice's Cord", type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: { mana: 14, intellect: 2 }, damage: null, armor: 0, sellValue: 16, stackSize: 1, icon: beltIcon('#8f77c0'), description: 'A knotted cord an apprentice ties off their spell-focus with.', editorNote: 'V0.18.75 belt pool (Item 4 B).' },
    // --- loot (green) ---
    { id: 'item_belt_wolfsinew', name: 'Wolfsinew Belt', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 3, classRestrictions: allClasses, stats: { attack: 4, critChance: 2, hp: 6 }, damage: null, armor: 2, sellValue: 40, stackSize: 1, icon: beltIcon('#8a5a3a'), description: 'Braided from gloom-wolf sinew. It creaks when you tense.', editorNote: 'V0.18.75 belt pool (Item 4 B). Offensive.' },
    { id: 'item_belt_pathfinders_cinch', name: "Pathfinder's Cinch", type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { speed: 0.06, defense: 1, hp: 6 }, damage: null, armor: 2, sellValue: 46, stackSize: 1, icon: beltIcon('#6b9b7a'), description: 'A ranger\'s cinch cut from stag-hide, light and quiet.', editorNote: 'V0.18.75 belt pool (Item 4 B). Utility/movement.' },
    { id: 'item_belt_gloomsilk_sash', name: 'Gloomsilk Sash', type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 20, intellect: 2, magicResist: 3 }, damage: null, armor: 0, sellValue: 50, stackSize: 1, icon: beltIcon('#7d6fb8'), description: 'Spun from duskwisp silk; it hums faintly with cold magic.', editorNote: 'V0.18.75 belt pool (Item 4 B). Caster.' },
    { id: 'item_belt_ironbark_girdle', name: 'Ironbark Girdle', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { defense: 3, hp: 12, magicResist: 2 }, damage: null, armor: 4, sellValue: 52, stackSize: 1, icon: beltIcon('#6b5a3a'), description: 'Broad plates of ironbark laced over thick hide.', editorNote: 'V0.18.75 belt pool (Item 4 B). Defensive / crafted.' },
    { id: 'item_belt_studhide_warbelt', name: 'Studhide Warbelt', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 4, defense: 2, hp: 8 }, damage: null, armor: 3, sellValue: 54, stackSize: 1, icon: beltIcon('#7a4a30'), description: 'A heavy warbelt of studded hide, bone-buckled.', editorNote: 'V0.18.75 belt pool (Item 4 B). Crafted.' },
    { id: 'item_belt_lifebloom_girdle', name: 'Lifebloom Girdle', type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { hp: 14, hpRegen: 3, manaRegen: 2 }, damage: null, armor: 2, sellValue: 58, stackSize: 1, icon: beltIcon('#6fbf8a'), description: 'Woven with rot-root that keeps flowering no matter the season.', editorNote: 'V0.18.75 belt pool (Item 4 B). Regeneration.' },
    { id: 'item_belt_bramblehide_cinch', name: 'Bramblehide Cinch', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 12, stamina: 2 }, damage: null, armor: 3, sellValue: 60, stackSize: 1, icon: beltIcon('#7f6a44'), description: 'Cut from a briar-boar\'s flank, thorns and all.', editorNote: 'V0.18.75 belt pool (Item 4 B). Defensive.' },
    { id: 'item_belt_fanged_warbelt', name: 'Fanged Warbelt', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { attack: 6, critChance: 3 }, damage: null, armor: 2, sellValue: 66, stackSize: 1, icon: beltIcon('#9a3a3a'), description: 'Hung with the fangs of everything that tried you and lost.', editorNote: 'V0.18.75 belt pool (Item 4 B). Offensive.' },
    { id: 'item_belt_rootwardens', name: "Rootwarden's Girdle", type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 5, classRestrictions: ['Warden', 'Druid', 'Shaman', 'Ranger'], stats: { defense: 3, hp: 14, stamina: 2, hpRegen: 2 }, damage: null, armor: 4, sellValue: 72, stackSize: 1, icon: beltIcon('#5f7a4a'), description: 'A living girdle of woven root that tightens to guard its warden.', editorNote: 'V0.18.75 belt pool (Item 4 B). Class-oriented (nature).' },
    { id: 'item_belt_ashroot_girdle', name: 'Ashroot Girdle', type: 'armor', slot: 'belt', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 4, hp: 14, magicResist: 3 }, damage: null, armor: 4, sellValue: 78, stackSize: 1, icon: beltIcon('#6a5f55'), description: 'Bound with ashroot fibre that shrugs off the crypt\'s cold spells.', editorNote: 'V0.18.75 belt pool (Item 4 B). Defensive.' },
    // --- rare (blue) ---
    { id: 'item_belt_hollow_wardens', name: "Hollow Warden's Belt", type: 'armor', slot: 'belt', armorType: 'plate', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 4, hp: 20, magicResist: 5, stamina: 3 }, damage: null, armor: 6, sellValue: 150, stackSize: 1, icon: beltIcon('#8896a0'), description: 'Taken from a hollow warden. Still faintly warm, and it should not be.', editorNote: 'V0.18.75 belt pool (Item 4 B). Rare defensive.' },
    { id: 'item_belt_runethread', name: 'Runethread Belt', type: 'armor', slot: 'belt', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 30, intellect: 3, cdr: 3, spellPower: 6 }, damage: null, armor: 0, sellValue: 165, stackSize: 1, icon: beltIcon('#9a6fd8'), description: 'Every thread is a stitched rune; the whole belt reads like a spell.', editorNote: 'V0.18.75 belt pool (Item 4 B). Class-oriented (caster), rare.' }
  );

  // V0.18.76 (Roadmap Item 4 D): 10 new BAGS spanning 5-14 slots across all four capacity tiers -
  // small starter (4-6), common field (7-9), uncommon reinforced (10-12), rare Dark Woods (13-14).
  // type 'bag', slot 'bag', capacity in bagSlots (+ stats.slots for display). Each has a source.
  const bagIcon = color => ({ family: 'bag', color, glyph: '▤' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_bag_barkweave_pouch', name: 'Barkweave Pouch', type: 'bag', slot: 'bag', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { slots: 5 }, damage: null, armor: 0, sellValue: 14, stackSize: 1, bagSlots: 5, icon: bagIcon('#9a8358'), description: 'A little pouch woven from stripped bark. Holds five things.', editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_trappers_satchel', name: "Trapper's Satchel", type: 'bag', slot: 'bag', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { slots: 6 }, damage: null, armor: 0, sellValue: 22, stackSize: 1, bagSlots: 6, icon: bagIcon('#8a6a46'), description: "A trapper's six-slot satchel, smelling faintly of bait.", editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_gloomhide_pack', name: 'Gloomhide Pack', type: 'bag', slot: 'bag', rarity: 'white', levelRequirement: 3, classRestrictions: allClasses, stats: { slots: 7 }, damage: null, armor: 0, sellValue: 34, stackSize: 1, bagSlots: 7, icon: bagIcon('#6f6a5a'), description: 'A seven-slot pack of tanned gloomhide with a rope strap.', editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_silkline_satchel', name: 'Silkline Satchel', type: 'bag', slot: 'bag', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { slots: 8 }, damage: null, armor: 0, sellValue: 55, stackSize: 1, bagSlots: 8, icon: bagIcon('#9a86c0'), description: 'Eight slots, stitched shut with strong pale spider-silk.', editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_woodsmans_rucksack', name: "Woodsman's Rucksack", type: 'bag', slot: 'bag', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { slots: 9 }, damage: null, armor: 0, sellValue: 62, stackSize: 1, bagSlots: 9, icon: bagIcon('#7a6a44'), description: 'A broad nine-slot rucksack built for a long haul out of the woods.', editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_reinforced_field_pack', name: 'Reinforced Field Pack', type: 'bag', slot: 'bag', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { slots: 10 }, damage: null, armor: 0, sellValue: 80, stackSize: 1, bagSlots: 10, icon: bagIcon('#6b7a4a'), description: 'Ten slots, hide-reinforced at every seam so nothing tears loose.', editorNote: 'V0.18.76 bag pool (Item 4 D). Crafted.' },
    { id: 'item_bag_wardens_haversack', name: "Warden's Haversack", type: 'bag', slot: 'bag', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { slots: 11 }, damage: null, armor: 0, sellValue: 96, stackSize: 1, bagSlots: 11, icon: bagIcon('#5f6a55'), description: "An eleven-slot haversack of an old woods-warden, still sturdy.", editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_spidersilk_carryall', name: 'Spidersilk Carryall', type: 'bag', slot: 'bag', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { slots: 12 }, damage: null, armor: 0, sellValue: 150, stackSize: 1, bagSlots: 12, icon: bagIcon('#8f77c8'), description: 'Twelve slots of woven spidersilk, impossibly light for its size.', editorNote: 'V0.18.76 bag pool (Item 4 D).' },
    { id: 'item_bag_broodmothers_websack', name: "Broodmother's Web-Sack", type: 'bag', slot: 'bag', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { slots: 13 }, damage: null, armor: 0, sellValue: 210, stackSize: 1, bagSlots: 13, icon: bagIcon('#b06ac0'), description: 'A thirteen-slot cocoon-sack cut from a brood chamber. Best not to ask what it held.', editorNote: 'V0.18.76 bag pool (Item 4 D). Rare.' },
    { id: 'item_bag_deepwood_expedition_pack', name: 'Deepwood Expedition Pack', type: 'bag', slot: 'bag', rarity: 'purple', levelRequirement: 9, classRestrictions: allClasses, stats: { slots: 14 }, damage: null, armor: 0, sellValue: 320, stackSize: 1, bagSlots: 14, icon: bagIcon('#c9962e'), description: 'The full fourteen-slot expedition pack of a deepwood ranger. Carries a small life.', editorNote: 'V0.18.76 bag pool (Item 4 D). Rarest bag.' }
  );

  // V0.18.77 (Roadmap Item 4 A): 10 new CHEST pieces, one full equipment slot's worth. Covers all
  // four armour types (cloth/leather/chain/plate) with caster / agile / balanced / tank profiles
  // across levels 1-8 and white/green/blue rarity, plus two class-oriented pieces. type 'armor',
  // slot 'chest'. Every piece has a source (vendor / loot / craft).
  const chestIcon = color => ({ family: 'chest', color, glyph: '▤' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_chest_homespun_robe', name: 'Homespun Robe', type: 'armor', slot: 'chest', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { mana: 8, intellect: 1 }, damage: null, armor: 1, sellValue: 14, stackSize: 1, icon: chestIcon('#8f83a8'), description: 'A plain homespun robe. Warm enough, if nothing else.', editorNote: 'V0.18.77 chest pool (Item 4 A).' },
    { id: 'item_chest_gloomweave_robe', name: 'Gloomweave Robe', type: 'armor', slot: 'chest', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 22, intellect: 3, magicResist: 3 }, damage: null, armor: 2, sellValue: 60, stackSize: 1, icon: chestIcon('#7d6fb8'), description: 'Duskwisp-thread robes that drink the gloom and give back cold.', editorNote: 'V0.18.77 chest pool (Item 4 A). Caster.' },
    { id: 'item_chest_runespun_vestments', name: 'Runespun Vestments', type: 'armor', slot: 'chest', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 34, intellect: 4, spellPower: 8, magicResist: 3 }, damage: null, armor: 3, sellValue: 190, stackSize: 1, icon: chestIcon('#9a6fd8'), description: 'Vestments stitched thread-by-thread with woven runes.', editorNote: 'V0.18.77 chest pool (Item 4 A). Class-oriented (caster), rare.' },
    { id: 'item_chest_tanned_jerkin', name: 'Tanned Leather Jerkin', type: 'armor', slot: 'chest', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 8 }, damage: null, armor: 3, sellValue: 18, stackSize: 1, icon: chestIcon('#8a6a46'), description: 'A simple tanned jerkin, supple and quiet.', editorNote: 'V0.18.77 chest pool (Item 4 A).' },
    { id: 'item_chest_stalkers_vest', name: "Stalker's Vest", type: 'armor', slot: 'chest', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 4, critChance: 2, hp: 10 }, damage: null, armor: 4, sellValue: 62, stackSize: 1, icon: chestIcon('#7a5a3a'), description: 'A close-cut vest built for creeping up on things.', editorNote: 'V0.18.77 chest pool (Item 4 A). Agile.' },
    { id: 'item_chest_bramblehide_cuirass', name: 'Bramblehide Cuirass', type: 'armor', slot: 'chest', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 4, hp: 18, stamina: 2 }, damage: null, armor: 6, sellValue: 88, stackSize: 1, icon: chestIcon('#7f6a44'), description: 'A cuirass of layered briar-boar hide, thorns filed to studs.', editorNote: 'V0.18.77 chest pool (Item 4 A). Crafted.' },
    { id: 'item_chest_field_chainshirt', name: 'Field Chainshirt', type: 'armor', slot: 'chest', armorType: 'chain', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 4, hp: 16, magicResist: 2 }, damage: null, armor: 7, sellValue: 80, stackSize: 1, icon: chestIcon('#9aa0a6'), description: 'A serviceable chainshirt, oiled against the damp.', editorNote: 'V0.18.77 chest pool (Item 4 A). Balanced.' },
    { id: 'item_chest_wardens_chainmail', name: "Warden's Chainmail", type: 'armor', slot: 'chest', armorType: 'chain', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 5, hp: 24, magicResist: 3, stamina: 2 }, damage: null, armor: 9, sellValue: 165, stackSize: 1, icon: chestIcon('#8892a0'), description: 'The heavy mail of a woods-warden, each ring hand-closed.', editorNote: 'V0.18.77 chest pool (Item 4 A). Rare balanced.' },
    { id: 'item_chest_iron_breastplate', name: 'Iron Breastplate', type: 'armor', slot: 'chest', armorType: 'plate', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 5, hp: 14 }, damage: null, armor: 8, sellValue: 84, stackSize: 1, icon: chestIcon('#a7adb4'), description: 'A dented but honest iron breastplate.', editorNote: 'V0.18.77 chest pool (Item 4 A). Tank.' },
    { id: 'item_chest_hollowsteel_cuirass', name: 'Hollowsteel Cuirass', type: 'armor', slot: 'chest', armorType: 'plate', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 7, hp: 30, stamina: 3, magicResist: 2 }, damage: null, armor: 12, sellValue: 210, stackSize: 1, icon: chestIcon('#8f979e'), description: 'Forged from the ore the hollow things leave behind. Grave-cold to the touch.', editorNote: 'V0.18.77 chest pool (Item 4 A). Class-oriented (tank), rare.' }
  );

  // V0.18.78 (Roadmap Item 4 A): 10 new LEGS pieces - another full slot, same four armour types
  // (cloth/leather/chain/plate), levels 1-8, white/green/blue, two class-oriented. type 'armor',
  // slot 'legs'. Every piece has a source (vendor / loot / craft).
  const legsIcon = color => ({ family: 'legs', color, glyph: '▥' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_legs_homespun_leggings', name: 'Homespun Leggings', type: 'armor', slot: 'legs', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { mana: 6, intellect: 1 }, damage: null, armor: 1, sellValue: 12, stackSize: 1, icon: legsIcon('#8f83a8'), description: 'Plain homespun leggings, patched at both knees.', editorNote: 'V0.18.78 legs pool (Item 4 A).' },
    { id: 'item_legs_gloomweave_leggings', name: 'Gloomweave Leggings', type: 'armor', slot: 'legs', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 16, intellect: 2, magicResist: 2 }, damage: null, armor: 2, sellValue: 52, stackSize: 1, icon: legsIcon('#7d6fb8'), description: 'Duskwisp-thread leggings, cold to wear on a warm day.', editorNote: 'V0.18.78 legs pool (Item 4 A). Caster.' },
    { id: 'item_legs_runespun_leggings', name: 'Runespun Leggings', type: 'armor', slot: 'legs', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 26, intellect: 3, spellPower: 6, magicResist: 2 }, damage: null, armor: 3, sellValue: 170, stackSize: 1, icon: legsIcon('#9a6fd8'), description: 'Rune-stitched leggings that hum against the leg.', editorNote: 'V0.18.78 legs pool (Item 4 A). Class-oriented (caster), rare.' },
    { id: 'item_legs_tanned_leggings', name: 'Tanned Leggings', type: 'armor', slot: 'legs', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 6 }, damage: null, armor: 3, sellValue: 16, stackSize: 1, icon: legsIcon('#8a6a46'), description: 'Simple tanned leggings, worn soft.', editorNote: 'V0.18.78 legs pool (Item 4 A).' },
    { id: 'item_legs_stalkers_leggings', name: "Stalker's Leggings", type: 'armor', slot: 'legs', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 2, hp: 8, speed: 0.02 }, damage: null, armor: 4, sellValue: 58, stackSize: 1, icon: legsIcon('#7a5a3a'), description: 'Close leggings that let you move without a sound.', editorNote: 'V0.18.78 legs pool (Item 4 A). Agile.' },
    { id: 'item_legs_bramblehide_greaves', name: 'Bramblehide Greaves', type: 'armor', slot: 'legs', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 3, hp: 14, stamina: 2 }, damage: null, armor: 5, sellValue: 80, stackSize: 1, icon: legsIcon('#7f6a44'), description: 'Layered briar-boar hide greaves, tough at the shin.', editorNote: 'V0.18.78 legs pool (Item 4 A). Crafted.' },
    { id: 'item_legs_field_chainlegs', name: 'Field Chainlegs', type: 'armor', slot: 'legs', armorType: 'chain', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 12, magicResist: 2 }, damage: null, armor: 6, sellValue: 74, stackSize: 1, icon: legsIcon('#9aa0a6'), description: 'Chain leggings, oiled and quiet enough for a march.', editorNote: 'V0.18.78 legs pool (Item 4 A). Balanced.' },
    { id: 'item_legs_wardens_legguards', name: "Warden's Legguards", type: 'armor', slot: 'legs', armorType: 'chain', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 4, hp: 18, magicResist: 3, stamina: 2 }, damage: null, armor: 8, sellValue: 150, stackSize: 1, icon: legsIcon('#8892a0'), description: 'Heavy mail legguards off an old woods-warden.', editorNote: 'V0.18.78 legs pool (Item 4 A). Rare balanced.' },
    { id: 'item_legs_iron_greaves', name: 'Iron Greaves', type: 'armor', slot: 'legs', armorType: 'plate', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 4, hp: 12 }, damage: null, armor: 7, sellValue: 78, stackSize: 1, icon: legsIcon('#a7adb4'), description: 'Honest iron greaves, scuffed but sound.', editorNote: 'V0.18.78 legs pool (Item 4 A). Tank.' },
    { id: 'item_legs_hollowsteel_greaves', name: 'Hollowsteel Greaves', type: 'armor', slot: 'legs', armorType: 'plate', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 6, hp: 24, stamina: 3 }, damage: null, armor: 10, sellValue: 195, stackSize: 1, icon: legsIcon('#8f979e'), description: 'Grave-cold hollowsteel greaves, forged from what the hollow leave behind.', editorNote: 'V0.18.78 legs pool (Item 4 A). Class-oriented (tank), rare.' }
  );

  // V0.18.80 (Roadmap Item 4 A): 10 HEAD pieces, one full slot to match chest/legs. Four armour types
  // (cloth/leather/chain/plate), levels 1-8, 2 white / 5 green / 3 blue, two class-oriented. type 'armor',
  // slot 'head'. Every piece has a source (vendor / loot / craft).
  const headIcon = color => ({ family: 'head', color, glyph: '⌂' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_head_homespun_hood', name: 'Homespun Hood', type: 'armor', slot: 'head', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { mana: 5, intellect: 1 }, damage: null, armor: 1, sellValue: 11, stackSize: 1, icon: headIcon('#8f83a8'), description: 'A plain homespun hood, thin at the crown.', editorNote: 'V0.18.80 head pool (Item 4 A).' },
    { id: 'item_head_gloomweave_hood', name: 'Gloomweave Hood', type: 'armor', slot: 'head', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 14, intellect: 2, magicResist: 2 }, damage: null, armor: 2, sellValue: 50, stackSize: 1, icon: headIcon('#7d6fb8'), description: 'A duskwisp-thread hood that keeps the mind cool.', editorNote: 'V0.18.80 head pool (Item 4 A). Caster.' },
    { id: 'item_head_runespun_cowl', name: 'Runespun Cowl', type: 'armor', slot: 'head', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 24, intellect: 3, spellPower: 6, magicResist: 2 }, damage: null, armor: 3, sellValue: 168, stackSize: 1, icon: headIcon('#9a6fd8'), description: 'A rune-stitched cowl that whispers when you cast.', editorNote: 'V0.18.80 head pool (Item 4 A). Class-oriented (caster), rare.' },
    { id: 'item_head_tanned_cap', name: 'Tanned Cap', type: 'armor', slot: 'head', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 5 }, damage: null, armor: 2, sellValue: 15, stackSize: 1, icon: headIcon('#8a6a46'), description: 'A simple tanned cap, worn soft at the brim.', editorNote: 'V0.18.80 head pool (Item 4 A).' },
    { id: 'item_head_stalkers_hood', name: "Stalker's Hood", type: 'armor', slot: 'head', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 2, hp: 7 }, damage: null, armor: 3, sellValue: 56, stackSize: 1, icon: headIcon('#7a5a3a'), description: 'A close leather hood that hides the eyes.', editorNote: 'V0.18.80 head pool (Item 4 A). Agile.' },
    { id: 'item_head_bramblehide_helm', name: 'Bramblehide Helm', type: 'armor', slot: 'head', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 3, hp: 12, stamina: 2 }, damage: null, armor: 4, sellValue: 78, stackSize: 1, icon: headIcon('#7f6a44'), description: 'A layered briar-boar hide helm, hard across the brow.', editorNote: 'V0.18.80 head pool (Item 4 A). Crafted.' },
    { id: 'item_head_field_coif', name: 'Field Coif', type: 'armor', slot: 'head', armorType: 'chain', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 10, magicResist: 2 }, damage: null, armor: 5, sellValue: 72, stackSize: 1, icon: headIcon('#9aa0a6'), description: 'A chain coif, oiled and quiet under a hood.', editorNote: 'V0.18.80 head pool (Item 4 A). Balanced.' },
    { id: 'item_head_wardens_helm', name: "Warden's Helm", type: 'armor', slot: 'head', armorType: 'chain', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 4, hp: 16, magicResist: 3, stamina: 2 }, damage: null, armor: 7, sellValue: 148, stackSize: 1, icon: headIcon('#8892a0'), description: 'A mailed helm off an old woods-warden, dented but proud.', editorNote: 'V0.18.80 head pool (Item 4 A). Rare balanced.' },
    { id: 'item_head_iron_helm', name: 'Iron Helm', type: 'armor', slot: 'head', armorType: 'plate', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 4, hp: 11 }, damage: null, armor: 6, sellValue: 76, stackSize: 1, icon: headIcon('#a7adb4'), description: 'An honest iron helm, scuffed but sound.', editorNote: 'V0.18.80 head pool (Item 4 A). Tank.' },
    { id: 'item_head_hollowsteel_greathelm', name: 'Hollowsteel Greathelm', type: 'armor', slot: 'head', armorType: 'plate', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 6, hp: 22, stamina: 3 }, damage: null, armor: 9, sellValue: 192, stackSize: 1, icon: headIcon('#8f979e'), description: 'A grave-cold hollowsteel greathelm, visor shaped like a hollow stare.', editorNote: 'V0.18.80 head pool (Item 4 A). Class-oriented (tank), rare.' }
  );

  // V0.18.81 (Roadmap Item 4 A): 10 SHOULDERS pieces, one full slot to match head/chest/legs. Four
  // armour types (cloth/leather/chain/plate), levels 1-8, 2 white / 5 green / 3 blue, two class-oriented.
  // type 'armor', slot 'shoulders'. Every piece has a source (vendor / loot / craft).
  const shouldersIcon = color => ({ family: 'shoulders', color, glyph: '⌒' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_shoulders_homespun_mantle', name: 'Homespun Mantle', type: 'armor', slot: 'shoulders', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { mana: 5, intellect: 1 }, damage: null, armor: 1, sellValue: 11, stackSize: 1, icon: shouldersIcon('#8f83a8'), description: 'A plain homespun mantle, fraying at the shoulder seam.', editorNote: 'V0.18.81 shoulders pool (Item 4 A).' },
    { id: 'item_shoulders_gloomweave_mantle', name: 'Gloomweave Mantle', type: 'armor', slot: 'shoulders', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 14, intellect: 2, magicResist: 2 }, damage: null, armor: 2, sellValue: 50, stackSize: 1, icon: shouldersIcon('#7d6fb8'), description: 'A duskwisp-thread mantle that drapes cold across the back.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Caster.' },
    { id: 'item_shoulders_runespun_mantle', name: 'Runespun Mantle', type: 'armor', slot: 'shoulders', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 24, intellect: 3, spellPower: 6, magicResist: 2 }, damage: null, armor: 3, sellValue: 168, stackSize: 1, icon: shouldersIcon('#9a6fd8'), description: 'A rune-stitched mantle whose sigils crawl when you cast.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Class-oriented (caster), rare.' },
    { id: 'item_shoulders_tanned_spaulders', name: 'Tanned Spaulders', type: 'armor', slot: 'shoulders', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 5 }, damage: null, armor: 2, sellValue: 15, stackSize: 1, icon: shouldersIcon('#8a6a46'), description: 'Simple tanned spaulders, laced at the collar.', editorNote: 'V0.18.81 shoulders pool (Item 4 A).' },
    { id: 'item_shoulders_stalkers_spaulders', name: "Stalker's Spaulders", type: 'armor', slot: 'shoulders', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 2, hp: 7 }, damage: null, armor: 3, sellValue: 56, stackSize: 1, icon: shouldersIcon('#7a5a3a'), description: 'Close leather spaulders that never catch on a branch.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Agile.' },
    { id: 'item_shoulders_bramblehide_spaulders', name: 'Bramblehide Spaulders', type: 'armor', slot: 'shoulders', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 3, hp: 12, stamina: 2 }, damage: null, armor: 4, sellValue: 78, stackSize: 1, icon: shouldersIcon('#7f6a44'), description: 'Layered briar-boar hide spaulders, ridged along the top.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Crafted.' },
    { id: 'item_shoulders_field_pauldrons', name: 'Field Pauldrons', type: 'armor', slot: 'shoulders', armorType: 'chain', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 10, magicResist: 2 }, damage: null, armor: 5, sellValue: 72, stackSize: 1, icon: shouldersIcon('#9aa0a6'), description: 'Chain pauldrons, oiled and quiet on the march.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Balanced.' },
    { id: 'item_shoulders_wardens_pauldrons', name: "Warden's Pauldrons", type: 'armor', slot: 'shoulders', armorType: 'chain', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 4, hp: 16, magicResist: 3, stamina: 2 }, damage: null, armor: 7, sellValue: 148, stackSize: 1, icon: shouldersIcon('#8892a0'), description: 'Heavy mail pauldrons off an old woods-warden.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Rare balanced.' },
    { id: 'item_shoulders_iron_pauldrons', name: 'Iron Pauldrons', type: 'armor', slot: 'shoulders', armorType: 'plate', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 4, hp: 11 }, damage: null, armor: 6, sellValue: 76, stackSize: 1, icon: shouldersIcon('#a7adb4'), description: 'Honest iron pauldrons, scuffed but sound.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Tank.' },
    { id: 'item_shoulders_hollowsteel_pauldrons', name: 'Hollowsteel Pauldrons', type: 'armor', slot: 'shoulders', armorType: 'plate', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 6, hp: 22, stamina: 3 }, damage: null, armor: 9, sellValue: 192, stackSize: 1, icon: shouldersIcon('#8f979e'), description: 'Grave-cold hollowsteel pauldrons, edged like folded wings.', editorNote: 'V0.18.81 shoulders pool (Item 4 A). Class-oriented (tank), rare.' }
  );

  // V0.18.82 (Roadmap Item 4 A): 10 HANDS pieces, one full slot to match head/shoulders/chest/legs.
  // Four armour types (cloth/leather/chain/plate), levels 1-8, 2 white / 5 green / 3 blue, two
  // class-oriented. type 'armor', slot 'hands'. Every piece has a source (vendor / loot / craft).
  const handsIcon = color => ({ family: 'hands', color, glyph: '✋' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_hands_homespun_gloves', name: 'Homespun Gloves', type: 'armor', slot: 'hands', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { mana: 5, intellect: 1 }, damage: null, armor: 1, sellValue: 10, stackSize: 1, icon: handsIcon('#8f83a8'), description: 'Thin homespun gloves, worn through at the fingertips.', editorNote: 'V0.18.82 hands pool (Item 4 A).' },
    { id: 'item_hands_gloomweave_gloves', name: 'Gloomweave Gloves', type: 'armor', slot: 'hands', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 13, intellect: 2, magicResist: 2 }, damage: null, armor: 2, sellValue: 48, stackSize: 1, icon: handsIcon('#7d6fb8'), description: 'Duskwisp-thread gloves that keep the fingers nimble in the cold.', editorNote: 'V0.18.82 hands pool (Item 4 A). Caster.' },
    { id: 'item_hands_runespun_gloves', name: 'Runespun Gloves', type: 'armor', slot: 'hands', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 22, intellect: 3, spellPower: 6, magicResist: 2 }, damage: null, armor: 3, sellValue: 164, stackSize: 1, icon: handsIcon('#9a6fd8'), description: 'Rune-stitched gloves that spark faintly at the seams.', editorNote: 'V0.18.82 hands pool (Item 4 A). Class-oriented (caster), rare.' },
    { id: 'item_hands_tanned_gloves', name: 'Tanned Gloves', type: 'armor', slot: 'hands', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 5 }, damage: null, armor: 2, sellValue: 14, stackSize: 1, icon: handsIcon('#8a6a46'), description: 'Simple tanned gloves, supple at the knuckle.', editorNote: 'V0.18.82 hands pool (Item 4 A).' },
    { id: 'item_hands_stalkers_gloves', name: "Stalker's Gloves", type: 'armor', slot: 'hands', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 2, hp: 6 }, damage: null, armor: 3, sellValue: 54, stackSize: 1, icon: handsIcon('#7a5a3a'), description: 'Close leather gloves that keep a sure grip on a drawn string.', editorNote: 'V0.18.82 hands pool (Item 4 A). Agile.' },
    { id: 'item_hands_bramblehide_grips', name: 'Bramblehide Grips', type: 'armor', slot: 'hands', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 3, hp: 11, stamina: 2 }, damage: null, armor: 4, sellValue: 76, stackSize: 1, icon: handsIcon('#7f6a44'), description: 'Layered briar-boar hide grips, studded across the back of the hand.', editorNote: 'V0.18.82 hands pool (Item 4 A). Crafted.' },
    { id: 'item_hands_field_gauntlets', name: 'Field Gauntlets', type: 'armor', slot: 'hands', armorType: 'chain', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 9, magicResist: 2 }, damage: null, armor: 5, sellValue: 70, stackSize: 1, icon: handsIcon('#9aa0a6'), description: 'Chain-backed gauntlets, oiled and quiet.', editorNote: 'V0.18.82 hands pool (Item 4 A). Balanced.' },
    { id: 'item_hands_wardens_gauntlets', name: "Warden's Gauntlets", type: 'armor', slot: 'hands', armorType: 'chain', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 4, hp: 15, magicResist: 3, stamina: 2 }, damage: null, armor: 7, sellValue: 146, stackSize: 1, icon: handsIcon('#8892a0'), description: 'Mailed gauntlets off an old woods-warden, worn smooth at the grip.', editorNote: 'V0.18.82 hands pool (Item 4 A). Rare balanced.' },
    { id: 'item_hands_iron_gauntlets', name: 'Iron Gauntlets', type: 'armor', slot: 'hands', armorType: 'plate', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 4, hp: 10 }, damage: null, armor: 6, sellValue: 74, stackSize: 1, icon: handsIcon('#a7adb4'), description: 'Honest iron gauntlets, scuffed but sound.', editorNote: 'V0.18.82 hands pool (Item 4 A). Tank.' },
    { id: 'item_hands_hollowsteel_gauntlets', name: 'Hollowsteel Gauntlets', type: 'armor', slot: 'hands', armorType: 'plate', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 6, hp: 21, stamina: 3 }, damage: null, armor: 9, sellValue: 190, stackSize: 1, icon: handsIcon('#8f979e'), description: 'Grave-cold hollowsteel gauntlets that close with a hollow clank.', editorNote: 'V0.18.82 hands pool (Item 4 A). Class-oriented (tank), rare.' }
  );

  // V0.18.83 (Roadmap Item 4 A): 10 FEET pieces, one full slot to match the rest of the armour. Four
  // armour types (cloth/leather/chain/plate), levels 1-8, 2 white / 5 green / 3 blue, two class-oriented.
  // type 'armor', slot 'feet'. Every piece has a source (vendor / loot / craft).
  const feetIcon = color => ({ family: 'feet', color, glyph: '▿' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_feet_homespun_slippers', name: 'Homespun Slippers', type: 'armor', slot: 'feet', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { mana: 5, intellect: 1 }, damage: null, armor: 1, sellValue: 10, stackSize: 1, icon: feetIcon('#8f83a8'), description: 'Thin homespun slippers, soft and nearly soundless.', editorNote: 'V0.18.83 feet pool (Item 4 A).' },
    { id: 'item_feet_gloomweave_slippers', name: 'Gloomweave Slippers', type: 'armor', slot: 'feet', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 13, intellect: 2, magicResist: 2 }, damage: null, armor: 2, sellValue: 48, stackSize: 1, icon: feetIcon('#7d6fb8'), description: 'Duskwisp-thread slippers that never quite touch the cold ground.', editorNote: 'V0.18.83 feet pool (Item 4 A). Caster.' },
    { id: 'item_feet_runespun_slippers', name: 'Runespun Slippers', type: 'armor', slot: 'feet', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 22, intellect: 3, spellPower: 6, magicResist: 2 }, damage: null, armor: 3, sellValue: 164, stackSize: 1, icon: feetIcon('#9a6fd8'), description: 'Rune-stitched slippers that leave a faint glowing print.', editorNote: 'V0.18.83 feet pool (Item 4 A). Class-oriented (caster), rare.' },
    { id: 'item_feet_tanned_boots', name: 'Tanned Boots', type: 'armor', slot: 'feet', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 5 }, damage: null, armor: 2, sellValue: 14, stackSize: 1, icon: feetIcon('#8a6a46'), description: 'Simple tanned boots, broken in at the heel.', editorNote: 'V0.18.83 feet pool (Item 4 A).' },
    { id: 'item_feet_stalkers_boots', name: "Stalker's Boots", type: 'armor', slot: 'feet', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 2, hp: 6, speed: 0.02 }, damage: null, armor: 3, sellValue: 56, stackSize: 1, icon: feetIcon('#7a5a3a'), description: 'Close leather boots that make no sound on old leaves.', editorNote: 'V0.18.83 feet pool (Item 4 A). Agile.' },
    { id: 'item_feet_bramblehide_treads', name: 'Bramblehide Treads', type: 'armor', slot: 'feet', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 3, hp: 11, stamina: 2 }, damage: null, armor: 4, sellValue: 76, stackSize: 1, icon: feetIcon('#7f6a44'), description: 'Layered briar-boar hide treads, gripping and thorn-proof.', editorNote: 'V0.18.83 feet pool (Item 4 A). Crafted.' },
    { id: 'item_feet_field_sabatons', name: 'Field Sabatons', type: 'armor', slot: 'feet', armorType: 'chain', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 9, magicResist: 2 }, damage: null, armor: 5, sellValue: 70, stackSize: 1, icon: feetIcon('#9aa0a6'), description: 'Chain-shod sabatons, oiled and quiet on a march.', editorNote: 'V0.18.83 feet pool (Item 4 A). Balanced.' },
    { id: 'item_feet_wardens_sabatons', name: "Warden's Sabatons", type: 'armor', slot: 'feet', armorType: 'chain', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { defense: 4, hp: 15, magicResist: 3, stamina: 2 }, damage: null, armor: 7, sellValue: 146, stackSize: 1, icon: feetIcon('#8892a0'), description: 'Mailed sabatons off an old woods-warden, sure on any footing.', editorNote: 'V0.18.83 feet pool (Item 4 A). Rare balanced.' },
    { id: 'item_feet_iron_sabatons', name: 'Iron Sabatons', type: 'armor', slot: 'feet', armorType: 'plate', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 4, hp: 10 }, damage: null, armor: 6, sellValue: 74, stackSize: 1, icon: feetIcon('#a7adb4'), description: 'Honest iron sabatons, scuffed but sound.', editorNote: 'V0.18.83 feet pool (Item 4 A). Tank.' },
    { id: 'item_feet_hollowsteel_sabatons', name: 'Hollowsteel Sabatons', type: 'armor', slot: 'feet', armorType: 'plate', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 6, hp: 21, stamina: 3 }, damage: null, armor: 9, sellValue: 190, stackSize: 1, icon: feetIcon('#8f979e'), description: 'Grave-cold hollowsteel sabatons that ring hollow on stone.', editorNote: 'V0.18.83 feet pool (Item 4 A). Class-oriented (tank), rare.' }
  );

  // V0.18.84 (Roadmap Item 4 A): 10 CAPE pieces. Capes are the light utility slot - cloth/leather only
  // (no plate/chain), low armour, varied profiles (movement / caster / healer / agile / defensive) rather
  // than the four-armour-type split used for body slots. Levels 1-8, 2 white / 5 green / 3 blue, two
  // class-oriented. type 'armor', slot 'cape'. Every piece has a source (vendor / loot / craft).
  const capeIcon = color => ({ family: 'cloak', color, glyph: '⌁' });
  DR.ITEM_DRAFTS.push(
    { id: 'item_cape_traveler_cloak', name: "Traveler's Cloak", type: 'armor', slot: 'cape', armorType: 'cloth', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { speed: 0.03, hp: 4 }, damage: null, armor: 1, sellValue: 12, stackSize: 1, icon: capeIcon('#6a6f7a'), description: 'A weather-worn traveler\'s cloak, good for a long road.', editorNote: 'V0.18.84 cape pool (Item 4 A). Movement.' },
    { id: 'item_cape_tanned_cloak', name: 'Tanned Cloak', type: 'armor', slot: 'cape', armorType: 'leather', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { defense: 2, hp: 5 }, damage: null, armor: 2, sellValue: 15, stackSize: 1, icon: capeIcon('#8a6a46'), description: 'A simple tanned cloak, sheds a light rain.', editorNote: 'V0.18.84 cape pool (Item 4 A).' },
    { id: 'item_cape_field_cloak', name: 'Field Cloak', type: 'armor', slot: 'cape', armorType: 'leather', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { defense: 3, hp: 8, magicResist: 2 }, damage: null, armor: 3, sellValue: 60, stackSize: 1, icon: capeIcon('#6f7a5a'), description: 'A soldier\'s field cloak, oiled against the damp.', editorNote: 'V0.18.84 cape pool (Item 4 A). Balanced.' },
    { id: 'item_cape_bramblehide_cloak', name: 'Bramblehide Cloak', type: 'armor', slot: 'cape', armorType: 'leather', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { defense: 2, hp: 10, stamina: 2 }, damage: null, armor: 3, sellValue: 74, stackSize: 1, icon: capeIcon('#7f6a44'), description: 'A briar-boar hide cloak, thorn-proof across the shoulders.', editorNote: 'V0.18.84 cape pool (Item 4 A). Crafted.' },
    { id: 'item_cape_gloomweave_cloak', name: 'Gloomweave Cloak', type: 'armor', slot: 'cape', armorType: 'cloth', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 12, intellect: 2, magicResist: 2 }, damage: null, armor: 2, sellValue: 52, stackSize: 1, icon: capeIcon('#7d6fb8'), description: 'A duskwisp-thread cloak that drinks the light around it.', editorNote: 'V0.18.84 cape pool (Item 4 A). Caster.' },
    { id: 'item_cape_stalkers_cloak', name: "Stalker's Cloak", type: 'armor', slot: 'cape', armorType: 'leather', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 2, critChance: 3, speed: 0.03 }, damage: null, armor: 2, sellValue: 56, stackSize: 1, icon: capeIcon('#7a5a3a'), description: 'A ragged-hemmed stalker\'s cloak that breaks your outline.', editorNote: 'V0.18.84 cape pool (Item 4 A). Agile.' },
    { id: 'item_cape_lumen_cloak', name: 'Lumen Cloak', type: 'armor', slot: 'cape', armorType: 'cloth', rarity: 'green', levelRequirement: 6, classRestrictions: allClasses, stats: { hp: 12, healingPower: 5, magicResist: 2 }, damage: null, armor: 2, sellValue: 72, stackSize: 1, icon: capeIcon('#cfc98a'), description: 'A pale lumen-wisp cloak, warm to the touch.', editorNote: 'V0.18.84 cape pool (Item 4 A). Healer.' },
    { id: 'item_cape_wardens_warcloak', name: "Warden's Warcloak", type: 'armor', slot: 'cape', armorType: 'leather', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 4, hp: 18, stamina: 3, magicResist: 2 }, damage: null, armor: 4, sellValue: 170, stackSize: 1, icon: capeIcon('#6f7a5a'), description: 'A heavy warden\'s warcloak, weighted at the hem to hold in a gale.', editorNote: 'V0.18.84 cape pool (Item 4 A). Class-oriented (tank), rare.' },
    { id: 'item_cape_shadeweave_shroud', name: 'Shadeweave Shroud', type: 'armor', slot: 'cape', armorType: 'cloth', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { mana: 16, magicResist: 4, critChance: 2, spellPower: 4 }, damage: null, armor: 2, sellValue: 172, stackSize: 1, icon: capeIcon('#5b5570'), description: 'A shadeweave shroud that seems to trail a step behind you.', editorNote: 'V0.18.84 cape pool (Item 4 A). Rare caster/utility.' },
    { id: 'item_cape_runespun_cloak', name: 'Runespun Cloak', type: 'armor', slot: 'cape', armorType: 'cloth', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Necromancer', 'Enchanter', 'Summoner', 'Cleric', 'Druid'], stats: { mana: 20, intellect: 3, spellPower: 5, magicResist: 2 }, damage: null, armor: 2, sellValue: 166, stackSize: 1, icon: capeIcon('#9a6fd8'), description: 'A rune-stitched cloak whose sigils drift like embers.', editorNote: 'V0.18.84 cape pool (Item 4 A). Class-oriented (caster), rare.' }
  );

  // V0.18.85 (Roadmap Item 4 B): 10 main-hand WEAPONS spanning the class archetypes (see
  // DR.CLASS_ARCHETYPES in data/loot.js) so every class gains coverage - sword, dagger x2, staff, bow,
  // mace, wand, maul, bonewand, greataxe. type 'weapon', slot 'weapon'; damage {min,max,speed};
  // twoHanded on 2H weapons. Levels 1-8, 2 white / 5 green / 3 blue, two class-oriented. Every weapon
  // has a source (vendor / loot / craft). Offhands follow in the next version.
  DR.ITEM_DRAFTS.push(
    { id: 'item_weapon_gloomiron_sword', name: 'Gloomiron Sword', type: 'weapon', slot: 'weapon', rarity: 'white', levelRequirement: 1, classRestrictions: ['Fighter', 'Paladin', 'Bard'], stats: { attack: 6 }, damage: { min: 4, max: 9, speed: 2.4 }, armor: 0, sellValue: 20, stackSize: 1, icon: { family: 'blade', color: '#d8ded1', glyph: '⚔' }, description: 'A plain gloomiron arming sword, honest and balanced.', editorNote: 'V0.18.85 weapon pool (Item 4 B). 1H sword.' },
    { id: 'item_weapon_briar_dagger', name: 'Briar Dagger', type: 'weapon', slot: 'weapon', rarity: 'white', levelRequirement: 2, classRestrictions: ['Rogue', 'Assassin', 'Bard'], stats: { attack: 5, speed: 0.06 }, damage: { min: 3, max: 7, speed: 1.6 }, armor: 0, sellValue: 22, stackSize: 1, icon: { family: 'dagger', color: '#d8ded1', glyph: '⌁' }, description: 'A short briar-steel dagger, quick in the hand.', editorNote: 'V0.18.85 weapon pool (Item 4 B). Fast 1H dagger.' },
    { id: 'item_weapon_oaken_staff', name: 'Oaken Staff', type: 'weapon', slot: 'weapon', rarity: 'green', levelRequirement: 3, classRestrictions: ['Wizard', 'Shaman', 'Druid', 'Enchanter', 'Summoner', 'Necromancer', 'Cleric'], stats: { attack: 3, mana: 16, spellPower: 4 }, damage: { min: 3, max: 7, speed: 2.9 }, armor: 0, sellValue: 46, stackSize: 1, twoHanded: true, icon: { family: 'staff', color: '#6f7a5a', glyph: '杖' }, description: 'A knotted oaken staff that carries a caster\'s will.', editorNote: 'V0.18.85 weapon pool (Item 4 B). 2H caster staff.' },
    { id: 'item_weapon_stalkers_shortbow', name: "Stalker's Shortbow", type: 'weapon', slot: 'weapon', rarity: 'green', levelRequirement: 4, classRestrictions: ['Ranger', 'Assassin'], stats: { attack: 8, critChance: 2 }, damage: { min: 5, max: 11, speed: 2.7 }, armor: 0, sellValue: 62, stackSize: 1, twoHanded: true, icon: { family: 'bow', color: '#7a5a3a', glyph: '➹' }, description: 'A short recurve bow of dark yew, quiet on the draw.', editorNote: 'V0.18.85 weapon pool (Item 4 B). 2H ranged.' },
    { id: 'item_weapon_gravebell_mace', name: 'Gravebell Mace', type: 'weapon', slot: 'weapon', rarity: 'green', levelRequirement: 4, classRestrictions: ['Paladin', 'Cleric', 'Warden'], stats: { attack: 6, defense: 1 }, damage: { min: 5, max: 10, speed: 2.6 }, armor: 0, sellValue: 60, stackSize: 1, icon: { family: 'mace', color: '#9aa0a6', glyph: '⚒' }, description: 'A flanged mace that tolls faintly when it strikes.', editorNote: 'V0.18.85 weapon pool (Item 4 B). 1H mace.' },
    { id: 'item_weapon_duskwisp_wand', name: 'Duskwisp Wand', type: 'weapon', slot: 'weapon', rarity: 'green', levelRequirement: 4, classRestrictions: ['Wizard', 'Enchanter', 'Summoner'], stats: { attack: 2, mana: 12, spellPower: 6 }, damage: { min: 3, max: 6, speed: 2.2 }, armor: 0, sellValue: 58, stackSize: 1, icon: { family: 'wand', color: '#7d6fb8', glyph: '✦' }, description: 'A slim wand tipped with a caught duskwisp ember.', editorNote: 'V0.18.85 weapon pool (Item 4 B). 1H caster wand.' },
    { id: 'item_weapon_briartusk_fang', name: 'Briartusk Fang', type: 'weapon', slot: 'weapon', rarity: 'green', levelRequirement: 6, classRestrictions: ['Rogue', 'Assassin', 'Bard'], stats: { attack: 8, critChance: 3, speed: 0.06 }, damage: { min: 5, max: 10, speed: 1.6 }, armor: 0, sellValue: 82, stackSize: 1, icon: { family: 'dagger', color: '#7f6a44', glyph: '⌁' }, description: 'A cruel fang-dagger cut from a briar-boar tusk.', editorNote: 'V0.18.85 weapon pool (Item 4 B). Crafted fast 1H dagger.' },
    { id: 'item_weapon_wardens_maul', name: "Warden's Maul", type: 'weapon', slot: 'weapon', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Warden', 'Fighter', 'Paladin'], stats: { attack: 13, defense: 2, speed: -0.04 }, damage: { min: 10, max: 19, speed: 3.4 }, armor: 0, sellValue: 172, stackSize: 1, twoHanded: true, icon: { family: 'mace', color: '#8892a0', glyph: '⚒' }, description: 'A two-handed woods-warden maul, slow and ruinous.', editorNote: 'V0.18.85 weapon pool (Item 4 B). Rare 2H maul.' },
    { id: 'item_weapon_hollowbone_wand', name: 'Hollowbone Wand', type: 'weapon', slot: 'weapon', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Necromancer', 'Summoner'], stats: { attack: 2, mana: 20, spellPower: 9, magicCritChance: 2 }, damage: { min: 4, max: 8, speed: 2.2 }, armor: 0, sellValue: 176, stackSize: 1, icon: { family: 'wand', color: '#9a6fd8', glyph: '✦' }, description: 'A wand of fused hollowbone that hums with grave-cold.', editorNote: 'V0.18.85 weapon pool (Item 4 B). Class-oriented (necro/summoner), rare.' },
    { id: 'item_weapon_hollowsteel_reaver', name: 'Hollowsteel Reaver', type: 'weapon', slot: 'weapon', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Fighter', 'Warden', 'Paladin'], stats: { attack: 15, critChance: 3 }, damage: { min: 12, max: 22, speed: 3.0 }, armor: 0, sellValue: 205, stackSize: 1, twoHanded: true, icon: { family: 'blade', color: '#8f979e', glyph: '⚔' }, description: 'A great hollowsteel reaver, its edge weeping grave-cold.', editorNote: 'V0.18.85 weapon pool (Item 4 B). Class-oriented (2H melee), rare.' }
  );

  // V0.18.86 (Roadmap Item 4 B): 10 OFFHANDS for the offhand slot. Two kinds, matching the existing
  // offhands: SHIELDS (type 'armor', give armor + defense/hp, family 'shield') for the front line, and
  // caster FOCUSES (type 'accessory', armor 0, give mana/spellPower/healing, families orb/grimoire/
  // totem/symbol/skull) for spellcasters. Levels 1-8, 2 white / 5 green / 3 blue, two class-oriented.
  // slot 'offhand'. Every piece has a source (vendor / loot / craft).
  DR.ITEM_DRAFTS.push(
    { id: 'item_offhand_bark_buckler', name: 'Bark Buckler', type: 'armor', slot: 'offhand', rarity: 'white', levelRequirement: 1, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 3, hp: 6 }, damage: null, armor: 3, sellValue: 16, stackSize: 1, icon: { family: 'shield', color: '#8a6a46', glyph: '▣' }, description: 'A round buckler of banded darkwood bark.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Shield.' },
    { id: 'item_offhand_apprentice_orb', name: 'Apprentice Orb', type: 'accessory', slot: 'offhand', rarity: 'white', levelRequirement: 2, classRestrictions: ['Wizard', 'Enchanter', 'Summoner', 'Necromancer', 'Shaman', 'Druid', 'Cleric', 'Bard'], stats: { mana: 10, intellect: 1 }, damage: null, armor: 0, sellValue: 18, stackSize: 1, icon: { family: 'orb', color: '#8fb0c8', glyph: '◍' }, description: 'A clouded glass orb, cool and faintly humming.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Caster focus.' },
    { id: 'item_offhand_ironbound_shield', name: 'Ironbound Shield', type: 'armor', slot: 'offhand', rarity: 'green', levelRequirement: 4, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 6, hp: 14 }, damage: null, armor: 6, sellValue: 58, stackSize: 1, icon: { family: 'shield', color: '#9aa0a6', glyph: '▣' }, description: 'A kite shield of oak bound in rough iron.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Shield.' },
    { id: 'item_offhand_gloomweave_grimoire', name: 'Gloomweave Grimoire', type: 'accessory', slot: 'offhand', rarity: 'green', levelRequirement: 4, classRestrictions: ['Wizard', 'Enchanter', 'Summoner', 'Necromancer'], stats: { mana: 16, intellect: 2, spellPower: 4 }, damage: null, armor: 0, sellValue: 56, stackSize: 1, icon: { family: 'grimoire', color: '#7d6fb8', glyph: '❦' }, description: 'A duskwisp-bound grimoire whose pages turn themselves.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Caster focus.' },
    { id: 'item_offhand_thornroot_totem', name: 'Thornroot Totem', type: 'accessory', slot: 'offhand', rarity: 'green', levelRequirement: 5, classRestrictions: ['Shaman', 'Druid'], stats: { mana: 14, healingPower: 5, magicResist: 2 }, damage: null, armor: 0, sellValue: 60, stackSize: 1, icon: { family: 'totem', color: '#6f7a5a', glyph: '⁂' }, description: 'A thornroot totem that thrums with the woods\' pulse.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Nature focus.' },
    { id: 'item_offhand_lumen_symbol', name: 'Lumen Symbol', type: 'accessory', slot: 'offhand', rarity: 'green', levelRequirement: 6, classRestrictions: ['Cleric', 'Paladin', 'Druid'], stats: { mana: 16, healingPower: 6, magicResist: 2 }, damage: null, armor: 0, sellValue: 72, stackSize: 1, icon: { family: 'symbol', color: '#cfc98a', glyph: '☩' }, description: 'A pale lumen-wisp symbol on a holy chain.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Healer focus.' },
    { id: 'item_offhand_bramblewood_shield', name: 'Bramblewood Shield', type: 'armor', slot: 'offhand', rarity: 'green', levelRequirement: 6, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 7, hp: 16, stamina: 2 }, damage: null, armor: 7, sellValue: 80, stackSize: 1, icon: { family: 'shield', color: '#7f6a44', glyph: '▣' }, description: 'A heavy shield faced with layered briar-boar hide.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Crafted shield.' },
    { id: 'item_offhand_bonecarved_skull', name: 'Bonecarved Skull', type: 'accessory', slot: 'offhand', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Necromancer', 'Summoner'], stats: { mana: 18, spellPower: 7, magicCritChance: 2 }, damage: null, armor: 0, sellValue: 158, stackSize: 1, icon: { family: 'skull', color: '#c8c2b0', glyph: '☠' }, description: 'A rune-carved skull that mutters in a dead tongue.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Rare necro focus.' },
    { id: 'item_offhand_runespun_orb', name: 'Runespun Orb', type: 'accessory', slot: 'offhand', rarity: 'blue', levelRequirement: 7, classRestrictions: ['Wizard', 'Enchanter', 'Summoner', 'Necromancer', 'Shaman', 'Druid', 'Cleric'], stats: { mana: 22, intellect: 3, spellPower: 7, magicResist: 2 }, damage: null, armor: 0, sellValue: 172, stackSize: 1, icon: { family: 'orb', color: '#9a6fd8', glyph: '◍' }, description: 'A rune-etched orb wound with a thread of trapped light.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Class-oriented (caster), rare.' },
    { id: 'item_offhand_hollowsteel_bulwark', name: 'Hollowsteel Bulwark', type: 'armor', slot: 'offhand', rarity: 'blue', levelRequirement: 8, classRestrictions: ['Paladin', 'Warden', 'Fighter', 'Cleric'], stats: { defense: 10, hp: 26, stamina: 3 }, damage: null, armor: 10, sellValue: 198, stackSize: 1, icon: { family: 'shield', color: '#8f979e', glyph: '▣' }, description: 'A grave-cold hollowsteel bulwark that rings when struck.', editorNote: 'V0.18.86 offhand pool (Item 4 B). Class-oriented (tank), rare.' }
  );

  // V0.18.87 (Roadmap Item 4 C): 10 JEWELLERY pieces across all four jewellery slots. type 'accessory',
  // armor 0, class-agnostic (allClasses) utility stats. Paired slots resolve automatically: slot 'ring'
  // -> ring1/ring2 and slot 'earring' -> earring1/earring2 (inventory-system.js). This also fills the
  // EARRING slot, which had no items before. 3 amulets / 3 rings / 2 earrings / 2 charms; levels 1-8,
  // 2 white / 5 green / 3 blue. Every piece has a source (vendor / loot / craft).
  DR.ITEM_DRAFTS.push(
    { id: 'item_amulet_woodcharm_pendant', name: 'Woodcharm Pendant', type: 'accessory', slot: 'amulet', rarity: 'white', levelRequirement: 1, classRestrictions: allClasses, stats: { hp: 8, mana: 6 }, damage: null, armor: 0, sellValue: 14, stackSize: 1, icon: { family: 'amulet', color: '#8a7a5a', glyph: '✧' }, description: 'A carved woodcharm on a leather cord, warm from the hand.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Amulet.' },
    { id: 'item_ring_copper_band', name: 'Copper Band', type: 'accessory', slot: 'ring', rarity: 'white', levelRequirement: 2, classRestrictions: allClasses, stats: { hp: 6, defense: 2 }, damage: null, armor: 0, sellValue: 15, stackSize: 1, icon: { family: 'ring', color: '#b58a5a', glyph: '○' }, description: 'A plain copper band, green at the edges.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Ring.' },
    { id: 'item_earring_briar_stud', name: 'Briar Stud', type: 'accessory', slot: 'earring', rarity: 'green', levelRequirement: 3, classRestrictions: allClasses, stats: { attack: 2, hp: 8 }, damage: null, armor: 0, sellValue: 40, stackSize: 1, icon: { family: 'earring', color: '#7f6a44', glyph: '❈' }, description: 'A little briar-thorn stud, sharper than it looks.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Earring (fills a new slot).' },
    { id: 'item_amulet_stalkers_pendant', name: "Stalker's Pendant", type: 'accessory', slot: 'amulet', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 2, speed: 0.02 }, damage: null, armor: 0, sellValue: 58, stackSize: 1, icon: { family: 'amulet', color: '#7a5a3a', glyph: '✧' }, description: 'A fanged pendant favoured by woods-stalkers.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Agile amulet.' },
    { id: 'item_ring_duskwisp_band', name: 'Duskwisp Band', type: 'accessory', slot: 'ring', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { mana: 12, intellect: 2, spellPower: 3 }, damage: null, armor: 0, sellValue: 56, stackSize: 1, icon: { family: 'ring', color: '#7d6fb8', glyph: '○' }, description: 'A cold band set with a caught duskwisp mote.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Caster ring.' },
    { id: 'item_charm_wolffang', name: 'Wolffang Charm', type: 'accessory', slot: 'charm', rarity: 'green', levelRequirement: 4, classRestrictions: allClasses, stats: { attack: 3, critChance: 3 }, damage: null, armor: 0, sellValue: 60, stackSize: 1, icon: { family: 'charm', color: '#9aa0a6', glyph: '✦' }, description: 'A gloom-wolf fang bound with sinew and luck.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Offensive charm.' },
    { id: 'item_earring_gloomdrop_earring', name: 'Gloomdrop Earring', type: 'accessory', slot: 'earring', rarity: 'green', levelRequirement: 5, classRestrictions: allClasses, stats: { mana: 12, spellPower: 3, magicResist: 2 }, damage: null, armor: 0, sellValue: 62, stackSize: 1, icon: { family: 'earring', color: '#6f7a5a', glyph: '❈' }, description: 'A hanging gloomdrop that beads with cold light.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Caster earring.' },
    { id: 'item_amulet_lumen_pendant', name: 'Lumen Pendant', type: 'accessory', slot: 'amulet', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { mana: 18, healingPower: 6, magicResist: 3 }, damage: null, armor: 0, sellValue: 168, stackSize: 1, icon: { family: 'amulet', color: '#cfc98a', glyph: '✧' }, description: 'A pale lumen-wisp pendant that glows in the dark.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Healer amulet, rare.' },
    { id: 'item_ring_hollowsteel_signet', name: 'Hollowsteel Signet', type: 'accessory', slot: 'ring', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { attack: 5, critChance: 2, hp: 12 }, damage: null, armor: 0, sellValue: 176, stackSize: 1, icon: { family: 'ring', color: '#8f979e', glyph: '○' }, description: 'A heavy hollowsteel signet, grave-cold on the finger.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Offensive ring, rare.' },
    { id: 'item_charm_wardstone', name: 'Wardstone Charm', type: 'accessory', slot: 'charm', rarity: 'blue', levelRequirement: 7, classRestrictions: allClasses, stats: { hp: 16, defense: 3, magicResist: 3 }, damage: null, armor: 0, sellValue: 170, stackSize: 1, icon: { family: 'charm', color: '#b7c4d8', glyph: '✦' }, description: 'A briar-warded stone charm that turns a little harm aside.', editorNote: 'V0.18.87 jewellery pool (Item 4 C). Crafted defensive charm, rare.' },

    // V0.18.88 (Roadmap Item 4 D - CAPSTONE): the rare DARK WOODS WANDERER SET. A 4-piece traveler's
    // outfit (head/chest/legs/feet) with strong solo stats AND a full-set bonus (+3% XP, faster
    // meditation) applied via the meditation and XP systems - not a separate tick loop. Set membership
    // is tracked by item id in DR.ARMOR_SETS below (the item compiler carries only a fixed field set,
    // so a custom setId would be dropped; ids always survive). Blue, level 8, all classes, leather.
    { id: 'item_wanderer_hood', name: "Wanderer's Hood", type: 'armor', slot: 'head', armorType: 'leather', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { hp: 14, mana: 10, speed: 0.02, magicResist: 2 }, damage: null, armor: 4, sellValue: 180, stackSize: 1, icon: { family: 'head', color: '#6fae9a', glyph: '⌂' }, description: 'A deep-cowled wanderer\'s hood, patched from a dozen roads. Dark Woods Wanderer set (4): wear all four for +3% XP and faster meditation.', editorNote: 'V0.18.88 Dark Woods Wanderer set (Item 4 D). Set head.' },
    { id: 'item_wanderer_garb', name: "Wanderer's Garb", type: 'armor', slot: 'chest', armorType: 'leather', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { hp: 22, mana: 14, defense: 3, magicResist: 2 }, damage: null, armor: 6, sellValue: 230, stackSize: 1, icon: { family: 'chest', color: '#6fae9a', glyph: '▤' }, description: 'Layered travelling garb, worn soft and quiet. Dark Woods Wanderer set (4): wear all four for +3% XP and faster meditation.', editorNote: 'V0.18.88 Dark Woods Wanderer set (Item 4 D). Set chest.' },
    { id: 'item_wanderer_leggings', name: "Wanderer's Leggings", type: 'armor', slot: 'legs', armorType: 'leather', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { hp: 18, mana: 10, defense: 2, speed: 0.02 }, damage: null, armor: 5, sellValue: 200, stackSize: 1, icon: { family: 'legs', color: '#6fae9a', glyph: '▥' }, description: 'Hard-wearing leggings that have walked a hundred leagues. Dark Woods Wanderer set (4): wear all four for +3% XP and faster meditation.', editorNote: 'V0.18.88 Dark Woods Wanderer set (Item 4 D). Set legs.' },
    { id: 'item_wanderer_boots', name: "Wanderer's Boots", type: 'armor', slot: 'feet', armorType: 'leather', rarity: 'blue', levelRequirement: 8, classRestrictions: allClasses, stats: { hp: 14, speed: 0.05, defense: 2 }, damage: null, armor: 4, sellValue: 180, stackSize: 1, icon: { family: 'feet', color: '#6fae9a', glyph: '▿' }, description: 'Broken-in boots that never seem to tire. Dark Woods Wanderer set (4): wear all four for +3% XP and faster meditation.', editorNote: 'V0.18.88 Dark Woods Wanderer set (Item 4 D). Set feet.' }
  );

  DR.ITEM_BY_ID = Object.fromEntries(DR.ITEM_DRAFTS.map(item => [item.id, item]));

  // V0.18.88 (Roadmap Item 4 D): armour-set registry. Membership is by item id (the compiler carries
  // only a fixed field set, so a custom setId on the draft would be dropped - item ids always survive).
  // The full-set bonus is applied at two existing single hooks: Game.meditationTickRate (faster ticks)
  // and Game.awardPlayerXp (+XP), with no separate tick loop. bonus.meditationSpeedPercent shortens the
  // meditation tick interval; bonus.xpPercent adds to the player XP multiplier.
  DR.ARMOR_SETS = {
    dark_woods_wanderer: {
      id: 'dark_woods_wanderer',
      name: 'Dark Woods Wanderer',
      pieceIds: ['item_wanderer_hood', 'item_wanderer_garb', 'item_wanderer_leggings', 'item_wanderer_boots'],
      // bonus.stats flow through the stat pipeline (recalculatePlayerStats, V0.18.89); xpPercent and
      // meditationSpeedPercent are applied at their own hooks (awardPlayerXp / meditationTickRate).
      bonus: { stats: { speed: 0.03, hp: 10 }, xpPercent: 0.03, meditationSpeedPercent: 0.15 },
      bonusText: 'Full set (4): +0.03 speed, +10 max HP, +3% experience and 15% faster meditation.'
    }
  };
  DR.ARMOR_SET_BY_ID = DR.ARMOR_SETS;

  // V0.17.16: canonical item-art bindings. Runtime UI resolves these
  // keys through the normal item descriptor path, including items restored from
  // older saves that only carry a stable itemId/sourceItemId.
  const UPLOADED_ITEM_ICON_IDS = Object.freeze([
    'item_old_path_amulet',
    'item_lumen_wisp_shard',
    'item_silk_web_antivenom_charm',
    'item_warden_lantern_amulet',
    'item_starter_v01689_fighter_bruisers_token',
    'item_starter_v01689_ranger_frayed_quiver',
    'item_bone_luck_charm',
    'item_duskwisp_charm',
    'item_mossfang_charm',
    'item_old_venomsacs_gland',
    'item_ashroot_elder_heart',
    'item_briar_silver_earring',
    'item_starlit_moth_earring',
    'item_fangbone_earring',
    'item_webbed_queen_earring',
    'item_starter_v01689_summoner_pact_grimoire',
    'item_starter_v01689_necromancer_chalk_skull',
    'item_starter_v01689_wizard_chipped_orb',
    'item_starter_v01689_enchanter_clouded_orb',
    'item_starter_v01689_shaman_pebble_totem',
    'item_starter_v01689_druid_seedling_totem',
    'item_starter_v01689_bard_weathered_lute',
    'item_starter_v01689_cleric_wooden_prayer_icon',
    'item_matrons_venom_focus',
    'item_crystal_band',
    'item_deepwood_ring',
    'item_ashroot_band',
    'item_blackroot_signet',
    'item_hollow_light_ring',
    'item_ring_of_sticky_silk',
    'item_gloom_kings_signet',
    'item_ring_of_the_looming_hunger',
    'item_deepwood_band',
    'item_rootglass_signet',
    'item_warden_lantern_charm',
    'item_shadowmoss_cape',
    'item_silk_mothers_mantle',
    'item_hollow_stag_mantle',
    'item_lanternthread_cape',
    'item_thorn_crowned_mantle',
    'item_royal_websilk_cape',
    'item_cocoon_tenders_sash',
    'item_starter_v01689_paladin_dull_mail',
    'item_starter_v01689_enchanter_faded_silk_robe',
    'item_starter_v01689_necromancer_gravecloth_robe',
    'item_starter_v01689_druid_leafmend_robe',
    'item_starter_v01689_assassin_nightpad_vest',
    'item_starter_v01689_bard_minstrel_vest',
    'item_starter_v01689_cleric_plain_chain_vest',
    'item_starter_v01689_rogue_shadowpatched_jerkin',
    'item_starter_v01689_fighter_split_leather_vest',
    'item_starter_v01689_shaman_stormhide_wrap',
    'item_starter_v01689_summoner_teal_initiate_robe',
    'item_starter_v01689_warden_thornhide_vest',
    'item_starter_v01689_wizard_threadbare_robe',
    'item_starter_v01689_ranger_trailhide_jerkin',
    'item_iron_chestguard',
    'item_skirrs_chitin_chestguard',
    'item_velyras_cocoon_robe',
    'item_arakhzels_carapace_mantle',
    'item_starter_v01689_cleric_candlewax_boots',
    'item_starter_v01689_summoner_circle_sandals',
    'item_starter_v01689_druid_dewmoss_sandals',
    'item_starter_v01689_assassin_ghoststep_boots',
    'item_starter_v01689_necromancer_gravedust_boots',
    'item_starter_v01689_fighter_stride_boots',
    'item_starter_v01689_ranger_miretrail_boots',
    'item_starter_v01689_warden_mossbound_boots',
    'item_starter_v01689_shaman_mudsole_boots',
    'item_starter_v01689_paladin_oathwalker_boots',
    'item_starter_v01689_enchanter_quietmind_slippers',
    'item_starter_v01689_rogue_softfall_boots',
    'item_starter_v01689_wizard_softstep_slippers',
    'item_starter_v01689_bard_stageworn_boots',
    'item_wolfclaw_boots',
    'item_venom_stained_boots',
    'item_rotroot_wraps',
    'item_briarhide_gloves',
    'item_cocoonweave_gloves',
    'item_darkbough_helmet',
    'item_moonless_silk_hood',
    'item_pale_spinners_hood',
    'item_starter_v01689_druid_barkwoven_leggings',
    'item_starter_v01689_necromancer_bonewrap_leggings',
    'item_starter_v01689_summoner_boundcloth_pants',
    'item_starter_v01689_fighter_bruiser_pants',
    'item_starter_v01689_rogue_cutpurse_pants',
    'item_starter_v01689_cleric_field_chain_leggings',
    'item_starter_v01689_wizard_inkmarked_trousers',
    'item_starter_v01689_ranger_pathfinder_pants',
    'item_starter_v01689_shaman_riverwoven_leggings',
    'item_starter_v01689_warden_rootfiber_leggings',
    'item_starter_v01689_enchanter_runecloth_trousers',
    'item_starter_v01689_assassin_silent_trousers',
    'item_starter_v01689_paladin_squire_greaves',
    'item_starter_v01689_bard_travel_tights',
    'item_widow_silk_leggings',
    'item_starter_v01689_warden_barkguard',
    'item_starter_v01689_paladin_lantern_shield',
    'item_ironbark_shield',
    'item_road_wardens_buckler',
    'item_chitin_buckler',
    'item_hollow_warden_bulwark',
    'item_hollowfang_chitin_guard',
    'item_gloomguard_pauldrons',
    'item_moss_stitched_mantle',
    'item_arakhzels_spined_shoulders',
    'item_worn_small_pouch',
    'item_frayed_traveler_bag',
    'item_linen_pouch',
    'item_darkwood_satchel',
    'item_reinforced_small_bag',
    'item_travelers_pack',
    'item_royal_websilk_satchel',
    'item_cave_eel_skewer',
    'item_cooked_eel_skewer',
    'item_cooked_forest_stew',
    'item_grilled_minnow',
    'item_miners_broth',
    'item_mushroom_stew',
    'item_roasted_darkwater_fish',
    'item_roasted_fish',
    'item_simple_travel_ration',
    'item_starter_v01689_assassin_throwing_fangs',
    'item_starter_v01689_rogue_sleeve_shiv',
    'item_starter_v01689_cleric_bell_mace',
    'item_starter_v01689_summoner_binder_rod',
    'item_blackroot_staff',
    'item_starter_v01689_assassin_hand_crossbow',
    'item_starter_v01689_necromancer_bonepin_wand',
    'item_starter_v01689_bard_camp_songblade',
    'item_starter_v01689_druid_crooked_branch_staff',
    'item_starter_v01689_enchanter_rune_wand',
    'item_gloomforged_blade',
    'item_starter_v01689_ranger_greenwood_bow',
    'item_starter_v01689_rogue_gutter_dagger',
    'item_starter_v01689_paladin_oath_mace',
    'item_starter_v01689_shaman_raincaller_rod',
    'item_starter_v01689_warden_root_mallet',
    'item_starter_v01689_fighter_rustcleaver',
    'item_starter_v01689_wizard_splinter_wand',
    'item_crude_sword',
    'item_widowfang_dagger',
    'item_iron_dagger',
    'item_briarback_cleaver',
    'item_silkfang_dagger',
    'item_webspinner_wand',
    'item_broodwardens_fang',
    'item_mine_relic_pick',
    'item_threadjaw_fangblade',
    'item_rootbound_scepter',
    'item_queens_loomheart_staff',
    'item_queens_venom_fang',
    // V0.17.94: resource/material/tool/fish icon art (61 items) - the "last of the items".
    'item_ashroot',
    'item_ashroot_moss',
    'item_ashroot_splinter',
    'item_basic_fishing_rod',
    'item_bitterleaf',
    'item_blackiron_bar',
    'item_blackiron_ore',
    'item_blackwater_eel',
    'item_bone_dust',
    'item_briar_hide',
    'item_briar_tusk',
    'item_cave_blindfish',
    'item_cave_eel',
    'item_coal',
    'item_copper_bar',
    'item_copper_ore',
    'item_corrupted_root',
    'item_crude_pickaxe',
    'item_cursed_ore',
    'item_darkstone_bar',
    'item_darkstone_ore',
    'item_darkwater_fish',
    'item_dreamspore',
    'item_duskwisp_core',
    'item_glimmer_crystal',
    'item_wolf_pelt',
    'item_glooms_crypt_key',
    'item_gloomleaf',
    'item_gloomleaf_wraps',
    'item_glowmoss',
    'item_grave_moss',
    'item_herbalist_knife',
    'item_hollow_antler',
    'item_iron_bar',
    'item_iron_ore',
    'item_light_essence',
    'item_mooncap',
    'item_mossback_carp',
    'item_mossback_trout',
    'item_murkwater_minnow',
    'item_night_crystal',
    'item_pale_eel',
    'item_redcap_fungus',
    'item_reinforced_buckle',
    'item_river_driftwood',
    'item_rotling_root',
    'item_rough_gem',
    'item_silkcap_mushroom',
    'item_silverfin',
    'item_silverthorn_sprig',
    'item_small_pondfish',
    'item_spider_silk',
    'item_spider_silk_thread',
    'item_stone',
    'item_tin_bar',
    'item_tin_ore',
    'item_torn_boot',
    'item_venom_sac',
    'item_webbed_chitin_shard',
    'item_worn_fishing_rod',
    'item_worn_hatchet',
  ]);
  for (const id of UPLOADED_ITEM_ICON_IDS) {
    const item = DR.ITEM_BY_ID[id];
    if (item) item.iconKey = id.replace(/^item_/, '');
  }
  DR.ITEM_ICON_KEYS_BY_ID = Object.freeze(Object.fromEntries(
    UPLOADED_ITEM_ICON_IDS.map(id => [id, id.replace(/^item_/, '')])
  ));
  DR.ITEM_ICON_ASSET_KEYS = Object.freeze(Object.fromEntries(
    UPLOADED_ITEM_ICON_IDS.map(id => [id.replace(/^item_/, ''), true])
  ));
})();
