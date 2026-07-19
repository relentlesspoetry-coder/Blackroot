// Dream Realms crafting and profession editor draft data
// Modular Pass 28: crafting/resource editor definitions used by editor metadata tools.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.PROFESSION_DEFS = [
    {
      id: 'gathering',
      name: 'Gathering',
      category: 'harvesting',
      tool: 'Hands / Sickle',
      maxRank: 100,
      xpCurve: 'profession_loop_v0119',
      color: '#75d069',
      label: 'G',
      notes: 'Herbs, mushrooms, fibers, and wild plant ingredients.'
    },
    {
      id: 'mining',
      name: 'Mining',
      category: 'harvesting',
      tool: 'Pickaxe',
      maxRank: 100,
      xpCurve: 'profession_loop_v0119',
      color: '#c78347',
      label: 'M',
      notes: 'Ore, stone, crystals, coal, and cave mineral nodes.'
    },
    {
      id: 'fishing',
      name: 'Fishing',
      category: 'harvesting',
      tool: 'Fishing Rod',
      maxRank: 100,
      xpCurve: 'profession_loop_v0119',
      color: '#5eb7cc',
      label: 'F',
      notes: 'Ponds, rivers, blackwater pools, and cave pool fish.'
    },
    {
      id: 'cooking',
      name: 'Cooking',
      category: 'crafting',
      tool: 'Cooking Fire',
      maxRank: 100,
      xpCurve: 'profession_loop_v0119',
      color: '#f0a35b',
      label: 'C',
      notes: 'Food, drinks, buffs, cooked fish, stews, and camp supplies.'
    },
    {
      id: 'blacksmithing',
      name: 'Blacksmithing',
      category: 'crafting',
      tool: 'Forge',
      maxRank: 100,
      xpCurve: 'profession_loop_v0119',
      color: '#b8b2a8',
      label: 'B',
      notes: 'Weapons, shields, plate pieces, metal fittings, and tools.'
    },
    {
      id: 'tailoring',
      name: 'Tailoring',
      category: 'crafting',
      tool: 'Loom',
      maxRank: 100,
      xpCurve: 'profession_loop_v0119',
      color: '#c991ff',
      label: 'T',
      notes: 'Cloth, leather, bags, caster armor, and stitched components.'
    }
  ];

  DR.CRAFTING_STATIONS = [
    {
      id: 'station_campfire',
      name: 'Campfire',
      profession: 'cooking',
      objectType: 'fire',
      requiredZone: 'any',
      color: '#f0a35b',
      label: 'CF',
      notes: 'Basic cooking station. Can be placed in camps and safe areas.'
    },
    {
      id: 'station_forge',
      name: 'Smithing Forge',
      profession: 'blacksmithing',
      objectType: 'forge',
      requiredZone: 'town_or_camp',
      color: '#b8b2a8',
      label: 'FG',
      notes: 'Blacksmithing station for ore bars, blades, shields, and fittings.'
    },
    {
      id: 'station_loom',
      name: 'Tailoring Loom',
      profession: 'tailoring',
      objectType: 'loom',
      requiredZone: 'town_or_camp',
      color: '#c991ff',
      label: 'LM',
      notes: 'Tailoring station for cloth, thread, bags, and light armor.'
    },
    {
      id: 'station_alchemy_table',
      name: 'Herbalist Table',
      profession: 'gathering',
      objectType: 'herbalistTable',
      requiredZone: 'town_or_camp',
      color: '#75d069',
      label: 'HT',
      notes: 'Herb-processing station definition available for editor placement and future recipes.'
    }
  ];

  DR.CRAFTING_RECIPES = [
    {
      id: 'recipe_roasted_darkwater_fish',
      name: 'Roasted Darkwater Fish',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 4,
      successChance: 0.95,
      inputs: [
        { itemId: 'item_darkwater_fish', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_roasted_darkwater_fish', quantity: 1 }
      ],
      xp: 8,
      unlocks: [],
      notes: 'Starter cooking recipe. Runtime crafting output item.'
    },
    {
      id: 'recipe_copper_bar',
      name: 'Copper Bar',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 5,
      successChance: 0.92,
      inputs: [
        { itemId: 'item_copper_ore', quantity: 2 }
      ],
      outputs: [
        { itemId: 'item_copper_bar', quantity: 1 }
      ],
      xp: 10,
      unlocks: ['recipe_gloomforged_blade_refine'],
      notes: 'Starter smelting recipe draft.'
    },
    {
      id: 'recipe_gloomleaf_wraps',
      name: 'Gloomleaf Wraps',
      profession: 'tailoring',
      stationId: 'station_loom',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 6,
      successChance: 0.90,
      inputs: [
        { itemId: 'item_gloomleaf', quantity: 3 }
      ],
      outputs: [
        { itemId: 'item_gloomleaf_wraps', quantity: 1 }
      ],
      xp: 9,
      unlocks: [],
      notes: 'Early tailoring material recipe draft.'
    },
    {
      id: 'recipe_gloomforged_blade_refine',
      name: 'Refine Gloomforged Blade',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 2,
      requiredRecipeId: 'recipe_copper_bar',
      levelRequirement: 5,
      craftTimeSeconds: 8,
      successChance: 0.78,
      inputs: [
        { itemId: 'item_gloomforged_blade', quantity: 1 },
        { itemId: 'item_copper_bar', quantity: 2 }
      ],
      outputs: [
        { itemId: 'item_gloomforged_blade', quantity: 1, variant: 'refined' }
      ],
      xp: 26,
      unlocks: [],
      notes: 'Upgrade recipe draft. Variant handling creates compiled crafted equipment at runtime.'
    }
    ,
    {
      id: 'recipe_grilled_minnow',
      name: 'Grilled Minnow',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 3.5,
      successChance: 0.96,
      inputs: [
        { itemId: 'item_murkwater_minnow', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_grilled_minnow', quantity: 1 }
      ],
      xp: 7,
      unlocks: [],
      notes: 'Pass 48 fishing-to-cooking recipe from open-water fish.'
    },
    {
      id: 'recipe_cooked_eel_skewer',
      name: 'Cooked Eel Skewer',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 4.5,
      successChance: 0.92,
      inputs: [
        { itemId: 'item_blackwater_eel', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_cooked_eel_skewer', quantity: 1 }
      ],
      xp: 13,
      unlocks: [],
      notes: 'Pass 48 stronger cooked fish food with a short buff.'
    },
    {
      id: 'recipe_cave_blindfish_roast',
      name: 'Cave Blindfish Roast',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 4.0,
      successChance: 0.94,
      inputs: [
        { itemId: 'item_cave_blindfish', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_grilled_minnow', quantity: 1 }
      ],
      xp: 10,
      unlocks: [],
      notes: 'Pass 48 cave-pool fish cooking route.'
    }
    ,
    {
      id: 'recipe_tin_bar',
      name: 'Tin Bar',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 4.2,
      successChance: 0.96,
      inputs: [
        { itemId: 'item_tin_ore', quantity: 2 }
      ],
      outputs: [
        { itemId: 'item_tin_bar', quantity: 1 }
      ],
      xp: 9,
      unlocks: [],
      notes: 'V0.11.9 starter smelting recipe.'
    },
    {
      id: 'recipe_iron_bar',
      name: 'Iron Bar',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 2,
      unlockedByDefault: true,
      levelRequirement: 3,
      craftTimeSeconds: 5.5,
      successChance: 0.90,
      inputs: [
        { itemId: 'item_iron_ore', quantity: 3 },
        { itemId: 'item_coal', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_iron_bar', quantity: 1 }
      ],
      xp: 24,
      unlocks: ['recipe_reinforced_buckle', 'recipe_crude_sword'],
      notes: 'V0.11.9 iron smelting recipe.'
    },
    {
      id: 'recipe_darkstone_bar',
      name: 'Darkstone Bar',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 3,
      unlockedByDefault: true,
      levelRequirement: 5,
      craftTimeSeconds: 6.8,
      successChance: 0.84,
      inputs: [
        { itemId: 'item_darkstone_ore', quantity: 3 },
        { itemId: 'item_coal', quantity: 2 }
      ],
      outputs: [
        { itemId: 'item_darkstone_bar', quantity: 1 }
      ],
      xp: 36,
      unlocks: [],
      notes: 'V0.11.9 deeper cave smelting recipe.'
    },
    {
      id: 'recipe_blackiron_bar',
      name: 'Blackiron Bar',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 4,
      unlockedByDefault: true,
      levelRequirement: 7,
      craftTimeSeconds: 7.5,
      successChance: 0.80,
      inputs: [
        { itemId: 'item_blackiron_ore', quantity: 3 },
        { itemId: 'item_coal', quantity: 2 }
      ],
      outputs: [
        { itemId: 'item_blackiron_bar', quantity: 1 }
      ],
      xp: 48,
      unlocks: [],
      notes: 'V0.11.9 late cave smelting recipe.'
    },
    {
      id: 'recipe_reinforced_buckle',
      name: 'Reinforced Buckle',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 2,
      unlockedByDefault: true,
      levelRequirement: 2,
      craftTimeSeconds: 4.2,
      successChance: 0.93,
      inputs: [
        { itemId: 'item_copper_bar', quantity: 1 },
        { itemId: 'item_stone', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_reinforced_buckle', quantity: 2 }
      ],
      xp: 16,
      unlocks: [],
      notes: 'V0.11.9 smithing component recipe.'
    },
    {
      id: 'recipe_crude_sword',
      name: 'Crude Sword',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 2,
      unlockedByDefault: true,
      levelRequirement: 3,
      craftTimeSeconds: 7.2,
      successChance: 0.86,
      inputs: [
        { itemId: 'item_copper_bar', quantity: 2 },
        { itemId: 'item_reinforced_buckle', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_crude_sword', quantity: 1 }
      ],
      xp: 34,
      unlocks: [],
      notes: 'V0.11.9 craftable starter weapon.'
    },
    {
      id: 'recipe_iron_dagger',
      name: 'Iron Dagger',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 3,
      unlockedByDefault: true,
      levelRequirement: 5,
      craftTimeSeconds: 7.0,
      successChance: 0.84,
      inputs: [
        { itemId: 'item_iron_bar', quantity: 2 },
        { itemId: 'item_reinforced_buckle', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_iron_dagger', quantity: 1 }
      ],
      xp: 44,
      unlocks: [],
      notes: 'V0.11.9 craftable rogue/bard weapon.'
    },
    {
      id: 'recipe_iron_chestguard',
      name: 'Iron Chestguard',
      profession: 'blacksmithing',
      stationId: 'station_forge',
      tier: 3,
      unlockedByDefault: true,
      levelRequirement: 6,
      craftTimeSeconds: 8.5,
      successChance: 0.82,
      inputs: [
        { itemId: 'item_iron_bar', quantity: 4 },
        { itemId: 'item_reinforced_buckle', quantity: 2 }
      ],
      outputs: [
        { itemId: 'item_iron_chestguard', quantity: 1 }
      ],
      xp: 58,
      unlocks: [],
      notes: 'V0.11.9 craftable front-line armor.'
    },
    {
      id: 'recipe_roasted_fish',
      name: 'Roasted Fish',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 3.0,
      successChance: 0.97,
      inputs: [
        { itemId: 'item_small_pondfish', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_roasted_fish', quantity: 1 }
      ],
      xp: 8,
      unlocks: [],
      notes: 'V0.11.9 basic fishing-to-cooking recipe.'
    },
    {
      id: 'recipe_mushroom_stew',
      name: 'Mushroom Stew',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 2,
      unlockedByDefault: true,
      levelRequirement: 2,
      craftTimeSeconds: 4.8,
      successChance: 0.93,
      inputs: [
        { itemId: 'item_silkcap_mushroom', quantity: 1 },
        { itemId: 'item_mooncap', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_mushroom_stew', quantity: 1 }
      ],
      xp: 22,
      unlocks: [],
      notes: 'V0.11.9 cave mushroom cooking recipe.'
    },
    {
      id: 'recipe_miners_broth',
      name: "Miner's Broth",
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 2,
      unlockedByDefault: true,
      levelRequirement: 3,
      craftTimeSeconds: 5.4,
      successChance: 0.90,
      inputs: [
        { itemId: 'item_mossback_trout', quantity: 1 },
        { itemId: 'item_bitterleaf', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_miners_broth', quantity: 1 }
      ],
      xp: 28,
      unlocks: [],
      notes: 'V0.11.9 mining-route food recipe.'
    },
    {
      id: 'recipe_cave_eel_skewer',
      name: 'Cave Eel Skewer',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 3,
      unlockedByDefault: true,
      levelRequirement: 4,
      craftTimeSeconds: 5.8,
      successChance: 0.88,
      inputs: [
        { itemId: 'item_cave_eel', quantity: 1 },
        { itemId: 'item_glowmoss', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_cave_eel_skewer', quantity: 1 }
      ],
      xp: 38,
      unlocks: [],
      notes: 'V0.11.9 cave-pool cooking recipe.'
    },
    {
      id: 'recipe_simple_travel_ration',
      name: 'Simple Travel Ration',
      profession: 'cooking',
      stationId: 'station_campfire',
      tier: 1,
      unlockedByDefault: true,
      levelRequirement: 1,
      craftTimeSeconds: 3.6,
      successChance: 0.96,
      inputs: [
        { itemId: 'item_darkwater_fish', quantity: 1 },
        { itemId: 'item_gloomleaf', quantity: 1 }
      ],
      outputs: [
        { itemId: 'item_simple_travel_ration', quantity: 1 }
      ],
      xp: 12,
      unlocks: [],
      notes: 'V0.11.9 field ration recipe using existing fish/herb routes.'
    },

    // V0.18.68 (Roadmap Item 3 D): herbal potion recipes brewed at the campfire (the early-game
    // crafting hub) from gathered Dark Woods herbs. Outputs are the functional potions in
    // data/items.js; ingredients are all gatherable herb items.
    {
      id: 'recipe_minor_healing_draught', name: 'Minor Healing Draught', profession: 'cooking', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 4, successChance: 0.95,
      inputs: [ { itemId: 'item_gloomleaf', quantity: 2 } ],
      outputs: [ { itemId: 'item_minor_healing_draught', quantity: 1 } ],
      xp: 8, unlocks: [], notes: 'V0.18.68 herbal potion recipe.'
    },
    {
      id: 'recipe_minor_mana_draught', name: 'Minor Mana Draught', profession: 'cooking', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 4, successChance: 0.95,
      inputs: [ { itemId: 'item_wispbloom', quantity: 2 } ],
      outputs: [ { itemId: 'item_minor_mana_draught', quantity: 1 } ],
      xp: 8, unlocks: [], notes: 'V0.18.68 herbal potion recipe.'
    },
    {
      id: 'recipe_regeneration_tonic', name: 'Regeneration Tonic', profession: 'cooking', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 3, craftTimeSeconds: 6, successChance: 0.9,
      inputs: [ { itemId: 'item_gloomleaf', quantity: 1 }, { itemId: 'item_lantern_moss', quantity: 1 } ],
      outputs: [ { itemId: 'item_regeneration_tonic', quantity: 1 } ],
      xp: 12, unlocks: [], notes: 'V0.18.68 herbal potion recipe.'
    },
    {
      id: 'recipe_clarity_tonic', name: 'Clarity Tonic', profession: 'cooking', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 3, craftTimeSeconds: 6, successChance: 0.9,
      inputs: [ { itemId: 'item_wispbloom', quantity: 1 }, { itemId: 'item_lantern_moss', quantity: 1 } ],
      outputs: [ { itemId: 'item_clarity_tonic', quantity: 1 } ],
      xp: 12, unlocks: [], notes: 'V0.18.68 herbal potion recipe.'
    },
    {
      id: 'recipe_bramblehide_elixir', name: 'Bramblehide Elixir', profession: 'cooking', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 4, craftTimeSeconds: 7, successChance: 0.88,
      inputs: [ { itemId: 'item_thornberry', quantity: 2 }, { itemId: 'item_blackroot', quantity: 1 } ],
      outputs: [ { itemId: 'item_bramblehide_elixir', quantity: 1 } ],
      xp: 16, unlocks: [], notes: 'V0.18.68 herbal potion recipe.'
    },
    {
      id: 'recipe_antivenom_draught', name: 'Antivenom Draught', profession: 'cooking', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 5, craftTimeSeconds: 7, successChance: 0.88,
      inputs: [ { itemId: 'item_gloomcap_mushroom', quantity: 1 }, { itemId: 'item_webcap_fungus', quantity: 1 } ],
      outputs: [ { itemId: 'item_antivenom_draught', quantity: 1 } ],
      xp: 16, unlocks: [], notes: 'V0.18.68 herbal potion recipe.'
    },
    {
      // V0.18.71: recipe for Cooked Forest Stew - the obtainability audit found it had no source.
      id: 'recipe_cooked_forest_stew', name: 'Cooked Forest Stew', profession: 'cooking', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 5, successChance: 0.94,
      inputs: [ { itemId: 'item_gloomleaf', quantity: 2 }, { itemId: 'item_gloomcap_mushroom', quantity: 1 } ],
      outputs: [ { itemId: 'item_cooked_forest_stew', quantity: 1 } ],
      xp: 9, unlocks: [], notes: 'V0.18.71 forest stew recipe (closes an obtainability gap).'
    },

    // V0.18.69 (Roadmap Item 3 A): Wildpelt starter armor set - leatherwork stitched at the campfire
    // (the early crafting hub) from Dark Woods animal materials. Profession tailoring (leatherwork);
    // bound to the campfire via stationId so it is craftable now.
    {
      id: 'recipe_wildpelt_hood', name: 'Wildpelt Hood', profession: 'tailoring', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 5, successChance: 0.95,
      inputs: [ { itemId: 'item_wolf_pelt', quantity: 1 }, { itemId: 'item_gloomleaf', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_hood', quantity: 1 } ],
      xp: 8, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_mantle', name: 'Wildpelt Mantle', profession: 'tailoring', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 5, successChance: 0.95,
      inputs: [ { itemId: 'item_wolf_pelt', quantity: 1 }, { itemId: 'item_briar_hide', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_mantle', quantity: 1 } ],
      xp: 8, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_vest', name: 'Wildpelt Vest', profession: 'tailoring', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 7, successChance: 0.92,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_wolf_pelt', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_vest', quantity: 1 } ],
      xp: 12, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_leggings', name: 'Wildpelt Leggings', profession: 'tailoring', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 6, successChance: 0.93,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_gloomleaf', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_leggings', quantity: 1 } ],
      xp: 10, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_gloves', name: 'Wildpelt Gloves', profession: 'tailoring', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 4, successChance: 0.95,
      inputs: [ { itemId: 'item_briar_hide', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_gloves', quantity: 1 } ],
      xp: 7, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_boots', name: 'Wildpelt Boots', profession: 'tailoring', stationId: 'station_campfire',
      tier: 1, unlockedByDefault: true, levelRequirement: 1, craftTimeSeconds: 5, successChance: 0.94,
      inputs: [ { itemId: 'item_wolf_pelt', quantity: 1 }, { itemId: 'item_briar_hide', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_boots', quantity: 1 } ],
      xp: 8, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_cloak', name: 'Wildpelt Cloak', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 2, craftTimeSeconds: 6, successChance: 0.92,
      inputs: [ { itemId: 'item_wolf_pelt', quantity: 1 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_cloak', quantity: 1 } ],
      xp: 10, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe.'
    },
    {
      id: 'recipe_wildpelt_belt', name: 'Wildpelt Belt', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 2, craftTimeSeconds: 5, successChance: 0.93,
      inputs: [ { itemId: 'item_briar_hide', quantity: 1 }, { itemId: 'item_bone_dust', quantity: 1 } ],
      outputs: [ { itemId: 'item_wildpelt_belt', quantity: 1 } ],
      xp: 9, unlocks: [], notes: 'V0.18.69 Wildpelt set recipe (belt slot).'
    },
    // V0.18.75 (Roadmap Item 4 B): two crafted belts (campfire leatherwork).
    {
      id: 'recipe_belt_ironbark_girdle', name: 'Ironbark Girdle', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 4, craftTimeSeconds: 6, successChance: 0.9,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_gloomleaf', quantity: 1 } ],
      outputs: [ { itemId: 'item_belt_ironbark_girdle', quantity: 1 } ],
      xp: 14, unlocks: [], notes: 'V0.18.75 belt pool recipe (Item 4 B).'
    },
    {
      id: 'recipe_belt_studhide_warbelt', name: 'Studhide Warbelt', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 4, craftTimeSeconds: 6, successChance: 0.9,
      inputs: [ { itemId: 'item_briar_hide', quantity: 1 }, { itemId: 'item_wolf_pelt', quantity: 1 }, { itemId: 'item_bone_dust', quantity: 1 } ],
      outputs: [ { itemId: 'item_belt_studhide_warbelt', quantity: 1 } ],
      xp: 14, unlocks: [], notes: 'V0.18.75 belt pool recipe (Item 4 B).'
    },
    {
      // V0.18.76 (Roadmap Item 4 D): a crafted 10-slot bag (campfire leatherwork).
      id: 'recipe_bag_reinforced_field_pack', name: 'Reinforced Field Pack', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 5, craftTimeSeconds: 7, successChance: 0.9,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_gloomleaf', quantity: 2 } ],
      outputs: [ { itemId: 'item_bag_reinforced_field_pack', quantity: 1 } ],
      xp: 16, unlocks: [], notes: 'V0.18.76 bag pool recipe (Item 4 D).'
    },
    {
      // V0.18.77 (Roadmap Item 4 A): a crafted leather chest piece (campfire leatherwork).
      id: 'recipe_chest_bramblehide_cuirass', name: 'Bramblehide Cuirass', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 8, successChance: 0.88,
      inputs: [ { itemId: 'item_briar_hide', quantity: 3 }, { itemId: 'item_briar_tusk', quantity: 1 }, { itemId: 'item_gloomleaf', quantity: 1 } ],
      outputs: [ { itemId: 'item_chest_bramblehide_cuirass', quantity: 1 } ],
      xp: 20, unlocks: [], notes: 'V0.18.77 chest pool recipe (Item 4 A).'
    },
    {
      // V0.18.78 (Roadmap Item 4 A): crafted leather legs piece (campfire leatherwork).
      id: 'recipe_legs_bramblehide_greaves', name: 'Bramblehide Greaves', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 7, successChance: 0.89,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_legs_bramblehide_greaves', quantity: 1 } ],
      xp: 18, unlocks: [], notes: 'V0.18.78 legs pool recipe (Item 4 A).'
    },
    {
      // V0.18.80 (Roadmap Item 4 A): crafted leather head piece (campfire leatherwork).
      id: 'recipe_head_bramblehide_helm', name: 'Bramblehide Helm', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 6, successChance: 0.90,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_head_bramblehide_helm', quantity: 1 } ],
      xp: 16, unlocks: [], notes: 'V0.18.80 head pool recipe (Item 4 A).'
    },
    {
      // V0.18.81 (Roadmap Item 4 A): crafted leather shoulders piece (campfire leatherwork).
      id: 'recipe_shoulders_bramblehide_spaulders', name: 'Bramblehide Spaulders', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 6, successChance: 0.90,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_shoulders_bramblehide_spaulders', quantity: 1 } ],
      xp: 16, unlocks: [], notes: 'V0.18.81 shoulders pool recipe (Item 4 A).'
    },
    {
      // V0.18.82 (Roadmap Item 4 A): crafted leather hands piece (campfire leatherwork).
      id: 'recipe_hands_bramblehide_grips', name: 'Bramblehide Grips', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 5, successChance: 0.91,
      inputs: [ { itemId: 'item_briar_hide', quantity: 1 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_hands_bramblehide_grips', quantity: 1 } ],
      xp: 14, unlocks: [], notes: 'V0.18.82 hands pool recipe (Item 4 A).'
    },
    {
      // V0.18.83 (Roadmap Item 4 A): crafted leather feet piece (campfire leatherwork).
      id: 'recipe_feet_bramblehide_treads', name: 'Bramblehide Treads', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 5, successChance: 0.91,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_feet_bramblehide_treads', quantity: 1 } ],
      xp: 15, unlocks: [], notes: 'V0.18.83 feet pool recipe (Item 4 A).'
    },
    {
      // V0.18.84 (Roadmap Item 4 A): crafted leather cape piece (campfire leatherwork).
      id: 'recipe_cape_bramblehide_cloak', name: 'Bramblehide Cloak', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 6, successChance: 0.90,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_cape_bramblehide_cloak', quantity: 1 } ],
      xp: 15, unlocks: [], notes: 'V0.18.84 cape pool recipe (Item 4 A).'
    },
    {
      // V0.18.85 (Roadmap Item 4 B): crafted fang-dagger from a briar-boar tusk (campfire bonework).
      id: 'recipe_weapon_briartusk_fang', name: 'Briartusk Fang', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 7, successChance: 0.88,
      inputs: [ { itemId: 'item_briar_tusk', quantity: 2 }, { itemId: 'item_briar_hide', quantity: 1 } ],
      outputs: [ { itemId: 'item_weapon_briartusk_fang', quantity: 1 } ],
      xp: 18, unlocks: [], notes: 'V0.18.85 weapon pool recipe (Item 4 B).'
    },
    {
      // V0.18.86 (Roadmap Item 4 B): crafted hide-faced shield (campfire leatherwork).
      id: 'recipe_offhand_bramblewood_shield', name: 'Bramblewood Shield', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 6, craftTimeSeconds: 7, successChance: 0.89,
      inputs: [ { itemId: 'item_briar_hide', quantity: 2 }, { itemId: 'item_briar_tusk', quantity: 1 } ],
      outputs: [ { itemId: 'item_offhand_bramblewood_shield', quantity: 1 } ],
      xp: 17, unlocks: [], notes: 'V0.18.86 offhand pool recipe (Item 4 B).'
    },
    {
      // V0.18.87 (Roadmap Item 4 C): crafted defensive charm bound from briar materials (campfire).
      id: 'recipe_charm_wardstone', name: 'Wardstone Charm', profession: 'tailoring', stationId: 'station_campfire',
      tier: 2, unlockedByDefault: true, levelRequirement: 7, craftTimeSeconds: 6, successChance: 0.88,
      inputs: [ { itemId: 'item_briar_hide', quantity: 1 }, { itemId: 'item_briar_tusk', quantity: 2 } ],
      outputs: [ { itemId: 'item_charm_wardstone', quantity: 1 } ],
      xp: 18, unlocks: [], notes: 'V0.18.87 jewellery pool recipe (Item 4 C).'
    }


  ];

  DR.PROFESSION_BY_ID = Object.fromEntries(DR.PROFESSION_DEFS.map(profession => [profession.id, profession]));
  DR.CRAFTING_STATION_BY_ID = Object.fromEntries(DR.CRAFTING_STATIONS.map(station => [station.id, station]));
  DR.CRAFTING_RECIPE_BY_ID = Object.fromEntries(DR.CRAFTING_RECIPES.map(recipe => [recipe.id, recipe]));
})();
