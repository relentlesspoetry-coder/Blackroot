// Dream Realms loot-table editor draft data
// Modular Pass 26: loot table definitions used by editor assignment tools.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.LOOT_TABLES = [
    {
      id: 'loot_dark_woods_wolves',
      name: 'Dark Woods: Wolf Family',
      source: { kind: 'mobFamily', id: 'wolf' },
      gold: { min: 1, max: 7 },
      rarityWeights: { grey: 34, white: 40, green: 18, blue: 6, purple: 1.5, gold: 0.3, orange: 0.05, red: 0 },
      entries: [
        { itemId: 'item_wolf_pelt', chance: 36, min: 1, max: 2 },
        { itemId: 'item_belt_wolfsinew', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_chest_stalkers_vest', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_legs_stalkers_leggings', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_head_stalkers_hood', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_shoulders_stalkers_spaulders', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_hands_stalkers_gloves', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_feet_stalkers_boots', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_cape_stalkers_cloak', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_weapon_stalkers_shortbow', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_offhand_thornroot_totem', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_amulet_stalkers_pendant', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_gloomleaf', chance: 12, min: 1, max: 2 },
        { itemId: 'item_wolfclaw_boots', chance: 4.5, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_mossfang_charm', 'item_wolfclaw_boots'],
      rareChance: 3.5,
      notes: 'V0.11.3 family-specific wolf loot progression.'
    },
    {
      id: 'loot_dark_woods_rotlings',
      name: 'Dark Woods: Rotling Family',
      source: { kind: 'mobFamily', id: 'rootling' },
      gold: { min: 1, max: 6 },
      rarityWeights: { grey: 38, white: 39, green: 16, blue: 5, purple: 1.4, gold: 0.25, orange: 0.04, red: 0 },
      entries: [
        { itemId: 'item_rotling_root', chance: 40, min: 1, max: 3 },
        { itemId: 'item_belt_lifebloom_girdle', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_gloomleaf', chance: 24, min: 1, max: 2 },
        { itemId: 'item_rotroot_wraps', chance: 5, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_rotroot_wraps', 'item_warden_lantern_charm'],
      rareChance: 3,
      notes: 'V0.11.3 rootling loot table.'
    },
    {
      id: 'loot_dark_woods_briar_boars',
      name: 'Dark Woods: Briar Boars',
      source: { kind: 'mobFamily', id: 'boar' },
      gold: { min: 2, max: 12 },
      rarityWeights: { grey: 26, white: 40, green: 23, blue: 8, purple: 2.3, gold: 0.5, orange: 0.08, red: 0.01 },
      entries: [
        { itemId: 'item_briar_tusk', chance: 44, min: 1, max: 2 },
        { itemId: 'item_belt_bramblehide_cinch', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_chest_field_chainshirt', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_legs_field_chainlegs', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_head_field_coif', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_shoulders_field_pauldrons', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_hands_field_gauntlets', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_feet_field_sabatons', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_cape_lumen_cloak', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_weapon_gravebell_mace', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_offhand_lumen_symbol', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_charm_wolffang', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_briar_hide', chance: 34, min: 1, max: 2 },
        { itemId: 'item_briarhide_gloves', chance: 5.5, min: 1, max: 1 },
        { itemId: 'item_road_wardens_buckler', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_briarhide_gloves', 'item_briarback_cleaver'],
      rareChance: 4.5,
      notes: 'V0.11.3 early/mid road family loot.'
    },
    {
      id: 'loot_dark_woods_duskwisps',
      name: 'Dark Woods: Duskwisps',
      source: { kind: 'mobFamily', id: 'wisp' },
      gold: { min: 5, max: 18 },
      rarityWeights: { grey: 10, white: 32, green: 32, blue: 18, purple: 6, gold: 1.5, orange: 0.25, red: 0.02 },
      entries: [
        { itemId: 'item_duskwisp_core', chance: 50, min: 1, max: 2 },
        { itemId: 'item_belt_gloomsilk_sash', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_bag_silkline_satchel', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_chest_gloomweave_robe', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_legs_gloomweave_leggings', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_head_gloomweave_hood', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_shoulders_gloomweave_mantle', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_hands_gloomweave_gloves', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_feet_gloomweave_slippers', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_cape_gloomweave_cloak', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_weapon_duskwisp_wand', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_offhand_gloomweave_grimoire', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_ring_duskwisp_band', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_light_essence', chance: 13, min: 1, max: 1 },
        { itemId: 'item_duskwisp_charm', chance: 4.5, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_duskwisp_charm', 'item_lumen_wisp_shard'],
      rareChance: 5.5,
      notes: 'V0.11.3 midwood caster/trinket loot.'
    },
    {
      id: 'loot_dark_woods_hollow_stags',
      name: 'Dark Woods: Hollow Stags',
      source: { kind: 'mobFamily', id: 'stag' },
      gold: { min: 7, max: 24 },
      rarityWeights: { grey: 12, white: 30, green: 32, blue: 18, purple: 6.5, gold: 1.2, orange: 0.22, red: 0.02 },
      entries: [
        { itemId: 'item_hollow_antler', chance: 42, min: 1, max: 2 },
        { itemId: 'item_belt_pathfinders_cinch', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_bag_woodsmans_rucksack', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_briar_hide', chance: 18, min: 1, max: 2 },
        { itemId: 'item_hollow_stag_mantle', chance: 4.2, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_hollow_stag_mantle', 'item_thorn_crowned_mantle'],
      rareChance: 5,
      notes: 'V0.11.3 deepwood stamina/armor loot.'
    },
    {
      id: 'loot_dark_woods_ashroot_horrors',
      name: 'Dark Woods: Ashroot Horrors',
      source: { kind: 'mobFamily', id: 'deadroot' },
      gold: { min: 14, max: 40 },
      rarityWeights: { grey: 5, white: 22, green: 34, blue: 24, purple: 10, gold: 3.5, orange: 1, red: 0.1 },
      entries: [
        { itemId: 'item_ashroot_splinter', chance: 58, min: 1, max: 2 },
        { itemId: 'item_belt_ashroot_girdle', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_bag_wardens_haversack', chance: 2.2, min: 1, max: 1 },
        { itemId: 'item_chest_wardens_chainmail', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_legs_wardens_legguards', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_head_wardens_helm', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_shoulders_wardens_pauldrons', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_hands_wardens_gauntlets', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_feet_wardens_sabatons', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_cape_wardens_warcloak', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_weapon_wardens_maul', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_offhand_bonecarved_skull', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_earring_gloomdrop_earring', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_wanderer_leggings', chance: 1.2, min: 1, max: 1 },
        { itemId: 'item_corrupted_root', chance: 32, min: 1, max: 2 },
        { itemId: 'item_ashroot_band', chance: 4, min: 1, max: 1 },
        { itemId: 'item_deepwood_ring', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_ashroot_band', 'item_ashroot_elder_heart'],
      rareChance: 5.8,
      notes: 'V0.11.3 outer-woods elite loot table.'
    },
    {
      id: 'loot_dark_woods_named_rares',
      name: 'Dark Woods: Named Rares',
      source: { kind: 'namedRare', id: 'dark_woods' },
      gold: { min: 26, max: 82 },
      rarityWeights: { grey: 0, white: 8, green: 30, blue: 35, purple: 20, gold: 5.5, orange: 1.2, red: 0.1 },
      entries: [
        { itemId: 'item_briarback_cleaver', chance: 14, min: 1, max: 1 },
        { itemId: 'item_belt_fanged_warbelt', chance: 4.0, min: 1, max: 1 },
        { itemId: 'item_belt_rootwardens', chance: 3.0, min: 1, max: 1 },
        { itemId: 'item_bag_spidersilk_carryall', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_chest_hollowsteel_cuirass', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_legs_hollowsteel_greaves', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_head_hollowsteel_greathelm', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_shoulders_hollowsteel_pauldrons', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_hands_hollowsteel_gauntlets', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_feet_hollowsteel_sabatons', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_cape_shadeweave_shroud', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_weapon_hollowsteel_reaver', chance: 1.5, min: 1, max: 1 },
        { itemId: 'item_offhand_hollowsteel_bulwark', chance: 1.8, min: 1, max: 1 },
        { itemId: 'item_ring_hollowsteel_signet', chance: 1.8, min: 1, max: 1 },
        { itemId: 'item_wanderer_hood', chance: 1.2, min: 1, max: 1 },
        { itemId: 'item_wanderer_garb', chance: 1.0, min: 1, max: 1 },
        { itemId: 'item_lumen_wisp_shard', chance: 14, min: 1, max: 1 },
        { itemId: 'item_thorn_crowned_mantle', chance: 14, min: 1, max: 1 },
        { itemId: 'item_ashroot_elder_heart', chance: 10, min: 1, max: 1 },
        { itemId: 'item_ashroot_band', chance: 12, min: 1, max: 1 },
        { itemId: 'item_hollow_stag_mantle', chance: 12, min: 1, max: 1 },
        { itemId: 'item_duskwisp_charm', chance: 12, min: 1, max: 1 }
      ],
      rarePool: ['item_briarback_cleaver', 'item_lumen_wisp_shard', 'item_thorn_crowned_mantle', 'item_ashroot_elder_heart'],
      rareChance: 16,
      notes: 'V0.11.3 high-reward table for named rare mobs.'
    },
    {
      id: 'loot_dark_woods_common_mobs',
      name: 'Dark Woods Common Mobs',
      source: { kind: 'mobFamily', id: 'dark_woods_common' },
      gold: { min: 1, max: 8 },
      rarityWeights: { grey: 45, white: 35, green: 15, blue: 4, purple: 1, gold: 0.2, orange: 0.05, red: 0 },
      entries: [
        { itemId: 'item_gloomleaf', chance: 22, min: 1, max: 2 },
        { itemId: 'item_gloomforged_blade', chance: 3, min: 1, max: 1 },
        { itemId: 'item_blackroot_staff', chance: 3, min: 1, max: 1 },
        { itemId: 'item_briar_tusk', chance: 18, min: 1, max: 2 },
        { itemId: 'item_duskwisp_core', chance: 9, min: 1, max: 1 },
        { itemId: 'item_ashroot_splinter', chance: 7, min: 1, max: 1 },
        { itemId: 'item_worn_small_pouch', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_frayed_traveler_bag', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_darkwood_satchel', chance: 0.9, min: 1, max: 1 },
        { itemId: 'item_reinforced_small_bag', chance: 0.35, min: 1, max: 1 },
      ],
      rarePool: ['item_mossfang_charm', 'item_deepwood_ring', 'item_briarhide_gloves', 'item_duskwisp_charm'],
      rareChance: 4,
      notes: 'V0.11.0 outdoor mob drops with early, mid, and outer Dark Woods materials.'
    },
    {
      id: 'loot_mossfang_cave_mobs',
      name: 'Mossfang Cave Mobs',
      source: { kind: 'caveMobFamily', id: 'mossfang_cave' },
      gold: { min: 3, max: 16 },
      rarityWeights: { grey: 32, white: 34, green: 22, blue: 8, purple: 2.5, gold: 0.8, orange: 0.15, red: 0.02 },
      entries: [
        { itemId: 'item_widowfang_dagger', chance: 4, min: 1, max: 1 },
        { itemId: 'item_ironbark_shield', chance: 3, min: 1, max: 1 },
        { itemId: 'item_mossfang_charm', chance: 1.2, min: 1, max: 1 }
      ],
      rarePool: ['item_mossfang_charm'],
      notes: 'Starter cave table. Future cave editor can assign this by cave theme.'
    },
    {
      id: 'loot_common_chest',
      name: 'Common Chest',
      source: { kind: 'chest', id: 'common' },
      gold: { min: 8, max: 35 },
      rarityWeights: { grey: 8, white: 44, green: 32, blue: 12, purple: 3, gold: 0.8, orange: 0.15, red: 0.01 },
      entries: [
        { itemId: 'item_gloomleaf', chance: 45, min: 1, max: 5 },
        { itemId: 'item_belt_hollow_wardens', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_belt_runethread', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_bag_broodmothers_websack', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_bag_deepwood_expedition_pack', chance: 1.0, min: 1, max: 1 },
        { itemId: 'item_chest_runespun_vestments', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_legs_runespun_leggings', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_head_runespun_cowl', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_shoulders_runespun_mantle', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_hands_runespun_gloves', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_feet_runespun_slippers', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_cape_runespun_cloak', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_weapon_hollowbone_wand', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_offhand_runespun_orb', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_amulet_lumen_pendant', chance: 2.0, min: 1, max: 1 },
        { itemId: 'item_wanderer_boots', chance: 1.2, min: 1, max: 1 },
        { itemId: 'item_copper_ore', chance: 30, min: 1, max: 4 },
        { itemId: 'item_gloomforged_blade', chance: 6, min: 1, max: 1 },
        { itemId: 'item_blackroot_staff', chance: 6, min: 1, max: 1 }
      ],
      rarePool: ['item_mossfang_charm'],
      notes: 'General overworld chest table.'
    },
    {
      id: 'loot_dungeon_chest',
      name: 'Dungeon Chest',
      source: { kind: 'chest', id: 'dungeon' },
      gold: { min: 28, max: 120 },
      rarityWeights: { grey: 0, white: 18, green: 36, blue: 26, purple: 12, gold: 5, orange: 2, red: 0.2 },
      entries: [
        { itemId: 'item_mossfang_charm', chance: 10, min: 1, max: 1 },
        { itemId: 'item_widowfang_dagger', chance: 8, min: 1, max: 1 },
        { itemId: 'item_ironbark_shield', chance: 8, min: 1, max: 1 }
      ],
      rarePool: ['item_mossfang_charm'],
      notes: 'Higher-value chest table for dungeon/puzzle rewards.'
    },
    {
      id: 'loot_dungeon_elite_mobs',
      name: 'Dungeon Elite Mobs',
      source: { kind: 'dungeonElite', id: 'all' },
      gold: { min: 12, max: 42 },
      rarityWeights: { grey: 0, white: 24, green: 42, blue: 22, purple: 8, gold: 2, orange: 0.4, red: 0.05 },
      entries: [
        { itemId: 'item_gloomleaf', chance: 22, min: 1, max: 3 },
        { itemId: 'item_copper_ore', chance: 18, min: 1, max: 4 },
        { itemId: 'item_mossfang_charm', chance: 4, min: 1, max: 1 },
        { itemId: 'item_widowfang_dagger', chance: 3, min: 1, max: 1 },
        { itemId: 'item_ironbark_shield', chance: 3, min: 1, max: 1 }
      ],
      rarePool: ['item_mossfang_charm', 'item_widowfang_dagger', 'item_ironbark_shield'],
      rareChance: 9,
      notes: 'Pass 40 table for elite dungeon mobs. Dungeon runtime can roll this multiple times based on eliteMultiplier.'
    },
    {
      id: 'loot_boss_hollow_warden',
      name: 'Boss: Hollow Warden',
      source: { kind: 'boss', id: 'boss_hollow_warden' },
      gold: { min: 60, max: 115 },
      rarityWeights: { grey: 0, white: 0, green: 34, blue: 36, purple: 20, gold: 8, orange: 1.5, red: 0.2 },
      entries: [
        { itemId: 'item_hollow_warden_bulwark', chance: 28, min: 1, max: 1 },
        { itemId: 'item_ironbark_shield', chance: 18, min: 1, max: 1 },
        { itemId: 'item_mossfang_charm', chance: 12, min: 1, max: 1 }
      ],
      rarePool: ['item_hollow_warden_bulwark'],
      rareChance: 14,
      notes: 'Pass 40 named boss reward table.'
    },
    {
      id: 'loot_boss_rootbound_matriarch',
      name: 'Boss: Rootbound Matriarch',
      source: { kind: 'boss', id: 'boss_rootbound_matriarch' },
      gold: { min: 75, max: 140 },
      rarityWeights: { grey: 0, white: 0, green: 28, blue: 38, purple: 23, gold: 9, orange: 1.8, red: 0.2 },
      entries: [
        { itemId: 'item_rootbound_scepter', chance: 28, min: 1, max: 1 },
        { itemId: 'item_blackroot_staff', chance: 20, min: 1, max: 1 },
        { itemId: 'item_mossfang_charm', chance: 14, min: 1, max: 1 }
      ],
      rarePool: ['item_rootbound_scepter'],
      rareChance: 15,
      notes: 'Pass 40 named boss reward table.'
    },
    {
      id: 'loot_boss_gloom_king',
      name: 'Boss: Gloom King',
      source: { kind: 'boss', id: 'boss_gloom_king' },
      gold: { min: 115, max: 225 },
      rarityWeights: { grey: 0, white: 0, green: 18, blue: 36, purple: 28, gold: 14, orange: 3.4, red: 0.6 },
      entries: [
        { itemId: 'item_gloom_kings_signet', chance: 32, min: 1, max: 1 },
        { itemId: 'item_hollow_warden_bulwark', chance: 12, min: 1, max: 1 },
        { itemId: 'item_rootbound_scepter', chance: 12, min: 1, max: 1 },
        { itemId: 'item_mossfang_charm', chance: 18, min: 1, max: 1 }
      ],
      rarePool: ['item_gloom_kings_signet'],
      rareChance: 18,
      notes: 'Pass 40 final boss reward table.'
    },
    {
      id: 'loot_boss_silk_mother',
      name: 'Boss: Silk Mother',
      source: { kind: 'boss', id: 'boss_silk_mother' },
      gold: { min: 70, max: 135 },
      rarityWeights: { grey: 0, white: 0, green: 30, blue: 38, purple: 22, gold: 8, orange: 1.8, red: 0.2 },
      entries: [
        { itemId: 'item_silk_mothers_mantle', chance: 30, min: 1, max: 1 },
        { itemId: 'item_widowfang_dagger', chance: 20, min: 1, max: 1 },
        { itemId: 'item_mossfang_charm', chance: 14, min: 1, max: 1 }
      ],
      rarePool: ['item_silk_mothers_mantle'],
      rareChance: 16,
      notes: 'Pass 40 named boss reward table.'
    },
    {
      id: 'loot_gathering_herbs',
      name: 'Gathering: Herbs',
      source: { kind: 'resource', id: 'herb' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 90, green: 9, blue: 1, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_gloomleaf', chance: 100, min: 1, max: 3 }
      ],
      rarePool: [],
      notes: 'Default herb node output.'
    },
    {
      id: 'loot_mining_copper',
      name: 'Mining: Copper Veins',
      source: { kind: 'resource', id: 'mining' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 88, green: 10, blue: 2, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_copper_ore', chance: 100, min: 1, max: 4 }
      ],
      rarePool: [],
      notes: 'Default mining node output.'
    },
    {
      id: 'loot_fishing_blackwater',
      name: 'Fishing: Blackwater',
      source: { kind: 'resource', id: 'fishing' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 92, green: 7, blue: 1, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_darkwater_fish', chance: 100, min: 1, max: 2 }
      ],
      rarePool: [],
      notes: 'Default fishing spot output.'
    }
    ,
    {
      id: 'loot_fishing_hotspot_darkwoods',
      name: 'Fishing Hotspot: Dark Woods Water',
      source: { kind: 'fishingHotspot', id: 'dark_woods' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 12, white: 70, green: 14, blue: 4, purple: 0.5, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_murkwater_minnow', chance: 58, min: 1, max: 2 },
        { itemId: 'item_mossback_carp', chance: 28, min: 1, max: 1 },
        { itemId: 'item_blackwater_eel', chance: 12, min: 1, max: 1 },
        { itemId: 'item_torn_boot', chance: 10, min: 1, max: 1 },
        { itemId: 'item_river_driftwood', chance: 14, min: 1, max: 2 }
      ],
      rarePool: ['item_silverfin'],
      rareChance: 5,
      notes: 'Pass 48 open-water river/pond fishing loot table.'
    },
    {
      id: 'loot_fishing_hotspot_cave',
      name: 'Fishing Hotspot: Cave Pool',
      source: { kind: 'fishingHotspot', id: 'mossfang_cave' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 10, white: 68, green: 17, blue: 5, purple: 0.5, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_cave_blindfish', chance: 72, min: 1, max: 2 },
        { itemId: 'item_blackwater_eel', chance: 12, min: 1, max: 1 },
        { itemId: 'item_river_driftwood', chance: 10, min: 1, max: 1 }
      ],
      rarePool: ['item_silverfin'],
      rareChance: 6,
      notes: 'Pass 48 cave pool fishing loot table.'
    }
    ,
    {
      id: 'loot_cave_mossfang_mobs',
      name: 'Cave: Mossfang Mobs',
      source: { kind: 'caveMobFamily', id: 'mossfang_cave' },
      gold: { min: 2, max: 12 },
      rarityWeights: { grey: 32, white: 36, green: 22, blue: 7, purple: 2, gold: 0.6, orange: 0.1, red: 0.01 },
      entries: [
        { itemId: 'item_wolf_pelt', chance: 18, min: 1, max: 1 },
        { itemId: 'item_mooncap', chance: 18, min: 1, max: 2 },
        { itemId: 'item_widowfang_dagger', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_mossfang_charm', chance: 1.5, min: 1, max: 1 }
      ],
      rarePool: ['item_mossfang_charm', 'item_widowfang_dagger'],
      rareChance: 4.5,
      notes: 'V0.11.8 starter cave identity table.'
    },
    {
      id: 'loot_cave_silk_web_mobs',
      name: 'Cave: Silk Web Cavern Mobs',
      source: { kind: 'caveMobFamily', id: 'silk_web_cavern' },
      gold: { min: 4, max: 18 },
      rarityWeights: { grey: 22, white: 36, green: 27, blue: 10, purple: 3.5, gold: 1, orange: 0.15, red: 0.01 },
      entries: [
        { itemId: 'item_spider_silk', chance: 55, min: 1, max: 3 },
        { itemId: 'item_venom_sac', chance: 18, min: 1, max: 1 },
        { itemId: 'item_silkcap_mushroom', chance: 14, min: 1, max: 2 },
        { itemId: 'item_widowfang_dagger', chance: 4, min: 1, max: 1 },
        { itemId: 'item_silk_mothers_mantle', chance: 0.9, min: 1, max: 1 }
      ],
      rarePool: ['item_widowfang_dagger', 'item_silk_mothers_mantle'],
      rareChance: 6,
      notes: 'V0.11.8 spider-only cave loot table.'
    },
    {
      id: 'loot_cave_ashroot_mobs',
      name: 'Cave: Ashroot Hollow Mobs',
      source: { kind: 'caveMobFamily', id: 'ashroot_hollow' },
      gold: { min: 7, max: 26 },
      rarityWeights: { grey: 14, white: 30, green: 33, blue: 15, purple: 6, gold: 1.6, orange: 0.25, red: 0.02 },
      entries: [
        { itemId: 'item_ashroot_moss', chance: 24, min: 1, max: 2 },
        { itemId: 'item_ashroot_splinter', chance: 36, min: 1, max: 2 },
        { itemId: 'item_corrupted_root', chance: 22, min: 1, max: 2 },
        { itemId: 'item_duskwisp_core', chance: 12, min: 1, max: 1 },
        { itemId: 'item_ashroot_band', chance: 3.2, min: 1, max: 1 }
      ],
      rarePool: ['item_ashroot_band', 'item_deepwood_ring'],
      rareChance: 6.5,
      notes: 'V0.11.8 corrupted cave loot table.'
    },
    {
      id: 'loot_cave_crystal_grotto_mobs',
      name: 'Cave: Crystal Grotto Mobs',
      source: { kind: 'caveMobFamily', id: 'crystal_grotto' },
      gold: { min: 9, max: 32 },
      rarityWeights: { grey: 10, white: 28, green: 35, blue: 18, purple: 6.5, gold: 2, orange: 0.35, red: 0.03 },
      entries: [
        { itemId: 'item_glimmer_crystal', chance: 42, min: 1, max: 2 },
        { itemId: 'item_rough_gem', chance: 9, min: 1, max: 1 },
        { itemId: 'item_night_crystal', chance: 5, min: 1, max: 1 },
        { itemId: 'item_crystal_band', chance: 3.5, min: 1, max: 1 },
        { itemId: 'item_lumen_wisp_shard', chance: 2.2, min: 1, max: 1 }
      ],
      rarePool: ['item_crystal_band', 'item_lumen_wisp_shard'],
      rareChance: 7.2,
      notes: 'V0.11.8 crystal cave loot table.'
    },
    {
      id: 'loot_cave_forgotten_mine_mobs',
      name: 'Cave: Forgotten Mine Mobs',
      source: { kind: 'caveMobFamily', id: 'forgotten_mine' },
      gold: { min: 10, max: 38 },
      rarityWeights: { grey: 10, white: 27, green: 36, blue: 18, purple: 7, gold: 1.8, orange: 0.3, red: 0.03 },
      entries: [
        { itemId: 'item_blackiron_ore', chance: 34, min: 1, max: 2 },
        { itemId: 'item_darkstone_ore', chance: 22, min: 1, max: 2 },
        { itemId: 'item_coal', chance: 28, min: 1, max: 2 },
        { itemId: 'item_mine_relic_pick', chance: 3.8, min: 1, max: 1 },
        { itemId: 'item_ironbark_shield', chance: 3.2, min: 1, max: 1 }
      ],
      rarePool: ['item_mine_relic_pick', 'item_ironbark_shield'],
      rareChance: 7.4,
      notes: 'V0.11.8 mining cave loot table.'
    },
    {
      id: 'loot_cave_blackroot_catacombs_mobs',
      name: 'Cave: Blackroot Catacombs Mobs',
      source: { kind: 'caveMobFamily', id: 'blackroot_catacombs' },
      gold: { min: 16, max: 52 },
      rarityWeights: { grey: 4, white: 18, green: 34, blue: 25, purple: 14, gold: 4, orange: 0.75, red: 0.06 },
      entries: [
        { itemId: 'item_blackiron_ore', chance: 20, min: 1, max: 2 },
        { itemId: 'item_night_crystal', chance: 8, min: 1, max: 1 },
        { itemId: 'item_ashroot_elder_heart', chance: 2.5, min: 1, max: 1 },
        { itemId: 'item_blackroot_signet', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_glooms_crypt_key', chance: 1.6, min: 1, max: 1 }
      ],
      rarePool: ['item_blackroot_signet', 'item_ashroot_elder_heart', 'item_gloom_kings_signet'],
      rareChance: 9,
      notes: 'V0.11.8 late cave / dungeon route loot table.'
    },
    {
      id: 'loot_cave_small_treasure',
      name: 'Cave Treasure: Small',
      source: { kind: 'caveChest', id: 'small' },
      gold: { min: 10, max: 38 },
      rarityWeights: { grey: 5, white: 42, green: 36, blue: 13, purple: 3, gold: 0.8, orange: 0.1, red: 0.01 },
      entries: [
        { itemId: 'item_mooncap', chance: 35, min: 1, max: 3 },
        { itemId: 'item_copper_ore', chance: 28, min: 1, max: 4 },
        { itemId: 'item_mossfang_charm', chance: 4, min: 1, max: 1 }
      ],
      rarePool: ['item_mossfang_charm'],
      rareChance: 5,
      notes: 'V0.11.8 small cave chest table.'
    },
    {
      id: 'loot_cave_medium_treasure',
      name: 'Cave Treasure: Medium',
      source: { kind: 'caveChest', id: 'medium' },
      gold: { min: 22, max: 74 },
      rarityWeights: { grey: 0, white: 28, green: 42, blue: 20, purple: 7, gold: 2, orange: 0.25, red: 0.02 },
      entries: [
        { itemId: 'item_spider_silk', chance: 26, min: 1, max: 3 },
        { itemId: 'item_ashroot_moss', chance: 22, min: 1, max: 2 },
        { itemId: 'item_darkstone_ore', chance: 20, min: 1, max: 3 },
        { itemId: 'item_deepwood_ring', chance: 3.2, min: 1, max: 1 },
        { itemId: 'item_widowfang_dagger', chance: 3.4, min: 1, max: 1 }
      ],
      rarePool: ['item_deepwood_ring', 'item_widowfang_dagger'],
      rareChance: 7,
      notes: 'V0.11.8 medium cave chest table.'
    },
    {
      id: 'loot_cave_large_treasure',
      name: 'Cave Treasure: Large',
      source: { kind: 'caveChest', id: 'large' },
      gold: { min: 42, max: 145 },
      rarityWeights: { grey: 0, white: 14, green: 36, blue: 28, purple: 15, gold: 5.5, orange: 1.2, red: 0.08 },
      entries: [
        { itemId: 'item_blackiron_ore', chance: 25, min: 1, max: 3 },
        { itemId: 'item_glimmer_crystal', chance: 23, min: 1, max: 3 },
        { itemId: 'item_night_crystal', chance: 9, min: 1, max: 1 },
        { itemId: 'item_crystal_band', chance: 4.2, min: 1, max: 1 },
        { itemId: 'item_mine_relic_pick', chance: 4.2, min: 1, max: 1 },
        { itemId: 'item_blackroot_signet', chance: 2.2, min: 1, max: 1 }
      ],
      rarePool: ['item_crystal_band', 'item_mine_relic_pick', 'item_blackroot_signet'],
      rareChance: 10,
      notes: 'V0.11.8 large cave / late exploration chest table.'
    },
    {
      id: 'loot_gathering_cave_plants',
      name: 'Gathering: Cave Plants',
      source: { kind: 'resource', id: 'cave_plants' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 78, green: 18, blue: 4, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_mooncap', chance: 45, min: 1, max: 2 },
        { itemId: 'item_silkcap_mushroom', chance: 22, min: 1, max: 2 },
        { itemId: 'item_ashroot_moss', chance: 20, min: 1, max: 2 },
        { itemId: 'item_dreamspore', chance: 4, min: 1, max: 1 }
      ],
      rarePool: ['item_dreamspore'],
      rareChance: 4,
      notes: 'V0.11.8 cave plant resource output.'
    },
    {
      id: 'loot_mining_cave_veins',
      name: 'Mining: Cave Veins',
      source: { kind: 'resource', id: 'cave_veins' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 65, green: 25, blue: 9, purple: 1, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_copper_ore', chance: 24, min: 1, max: 3 },
        { itemId: 'item_darkstone_ore', chance: 28, min: 1, max: 2 },
        { itemId: 'item_blackiron_ore', chance: 20, min: 1, max: 2 },
        { itemId: 'item_glimmer_crystal', chance: 16, min: 1, max: 2 },
        { itemId: 'item_coal', chance: 20, min: 1, max: 2 },
        { itemId: 'item_rough_gem', chance: 4, min: 1, max: 1 },
        { itemId: 'item_night_crystal', chance: 2.5, min: 1, max: 1 }
      ],
      rarePool: ['item_rough_gem', 'item_night_crystal'],
      rareChance: 5,
      notes: 'V0.11.8 cave mining resource output.'
    }
    ,
    {
      id: 'loot_mining_starter_veins',
      name: 'Mining: Starter Veins',
      source: { kind: 'resource', id: 'starter_mining' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 86, green: 12, blue: 2, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_copper_ore', chance: 55, min: 1, max: 3 },
        { itemId: 'item_tin_ore', chance: 45, min: 1, max: 3 },
        { itemId: 'item_stone', chance: 25, min: 1, max: 2 }
      ],
      rarePool: ['item_rough_gem'],
      rareChance: 3,
      notes: 'V0.11.9 starter mining profession table.'
    },
    {
      id: 'loot_mining_iron_veins',
      name: 'Mining: Iron Veins',
      source: { kind: 'resource', id: 'iron_mining' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 72, green: 22, blue: 6, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_iron_ore', chance: 72, min: 1, max: 3 },
        { itemId: 'item_coal', chance: 28, min: 1, max: 2 },
        { itemId: 'item_darkstone_ore', chance: 10, min: 1, max: 1 }
      ],
      rarePool: ['item_rough_gem'],
      rareChance: 5,
      notes: 'V0.11.9 iron mining profession table.'
    },
    {
      id: 'loot_mining_cursed_veins',
      name: 'Mining: Cursed Veins',
      source: { kind: 'resource', id: 'cursed_mining' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 42, green: 38, blue: 16, purple: 4, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_cursed_ore', chance: 48, min: 1, max: 1 },
        { itemId: 'item_blackiron_ore', chance: 35, min: 1, max: 2 },
        { itemId: 'item_bone_dust', chance: 18, min: 1, max: 2 }
      ],
      rarePool: ['item_night_crystal'],
      rareChance: 7,
      notes: 'V0.11.9 late cave mining profession table.'
    },
    {
      id: 'loot_gathering_catacomb_plants',
      name: 'Gathering: Catacomb Plants',
      source: { kind: 'resource', id: 'catacomb_plants' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 55, green: 34, blue: 10, purple: 1, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_grave_moss', chance: 45, min: 1, max: 2 },
        { itemId: 'item_ashroot', chance: 25, min: 1, max: 2 },
        { itemId: 'item_bone_dust', chance: 20, min: 1, max: 2 },
        { itemId: 'item_glowmoss', chance: 15, min: 1, max: 1 }
      ],
      rarePool: ['item_dreamspore'],
      rareChance: 6,
      notes: 'V0.11.9 catacomb gathering profession table.'
    },
    {
      id: 'loot_fishing_profession_darkwoods',
      name: 'Fishing: Dark Woods Pools',
      source: { kind: 'resource', id: 'darkwoods_fishing_pool' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 80, green: 15, blue: 5, purple: 0, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_small_pondfish', chance: 56, min: 1, max: 2 },
        { itemId: 'item_mossback_trout', chance: 28, min: 1, max: 1 },
        { itemId: 'item_murkwater_minnow', chance: 20, min: 1, max: 2 }
      ],
      rarePool: ['item_silverfin'],
      rareChance: 4,
      notes: 'V0.11.9 static fishing pool profession table.'
    },
    {
      id: 'loot_fishing_profession_cave',
      name: 'Fishing: Deep Cave Pools',
      source: { kind: 'resource', id: 'deep_cave_fishing_pool' },
      gold: { min: 0, max: 0 },
      rarityWeights: { grey: 0, white: 62, green: 28, blue: 9, purple: 1, gold: 0, orange: 0, red: 0 },
      entries: [
        { itemId: 'item_cave_eel', chance: 38, min: 1, max: 1 },
        { itemId: 'item_cave_blindfish', chance: 46, min: 1, max: 2 },
        { itemId: 'item_pale_eel', chance: 10, min: 1, max: 1 }
      ],
      rarePool: ['item_silverfin'],
      rareChance: 5,
      notes: 'V0.11.9 static cave pool fishing profession table.'
    }



  ];

  DR.LOOT_TABLES.push(
    { id:'loot_silk_web_cavern', name:'Silk Web Cavern: Dungeon Exclusive', source:{kind:'dungeon',id:'silk_web_cavern'}, gold:{min:20,max:76}, rarityWeights:{grey:0,white:4,green:58,blue:32,purple:5,gold:1,orange:0,red:0}, entries:[{itemId:'item_webbed_chitin_shard',chance:34,min:1,max:3},{itemId:'item_venom_sac',chance:28,min:1,max:2},{itemId:'item_spider_silk_thread',chance:32,min:1,max:3},{itemId:'item_chitin_buckler',chance:2.4,min:1,max:1},{itemId:'item_silkfang_dagger',chance:2.2,min:1,max:1},{itemId:'item_webspinner_wand',chance:2.0,min:1,max:1},{itemId:'item_cocoonweave_gloves',chance:2.2,min:1,max:1},{itemId:'item_venom_stained_boots',chance:2.2,min:1,max:1}], rarePool:['item_chitin_buckler','item_silkfang_dagger','item_webspinner_wand','item_cocoonweave_gloves','item_venom_stained_boots'], rareChance:8, notes:'V0.13.24 umbrella Silk Web Cavern exclusive loot table.' },
    { id:'loot_silk_web_cavern_elites', name:'Silk Web Cavern: Elite Spiders', source:{kind:'dungeonElite',id:'silk_web_cavern'}, gold:{min:16,max:58}, rarityWeights:{grey:0,white:6,green:58,blue:30,purple:5,gold:1,orange:0,red:0}, entries:[{itemId:'item_webbed_chitin_shard',chance:42,min:1,max:3},{itemId:'item_venom_sac',chance:32,min:1,max:2},{itemId:'item_spider_silk_thread',chance:38,min:1,max:3},{itemId:'item_chitin_buckler',chance:2.8,min:1,max:1},{itemId:'item_silkfang_dagger',chance:2.6,min:1,max:1},{itemId:'item_webspinner_wand',chance:2.4,min:1,max:1},{itemId:'item_cocoonweave_gloves',chance:2.6,min:1,max:1},{itemId:'item_venom_stained_boots',chance:2.6,min:1,max:1}], rarePool:['item_chitin_buckler','item_silkfang_dagger','item_webspinner_wand','item_cocoonweave_gloves','item_venom_stained_boots'], rareChance:8.5, notes:'Elite spider trash drops.' },
    { id:'loot_silk_web_cavern_minibosses', name:'Silk Web Cavern: Mini-Bosses', source:{kind:'miniBoss',id:'silk_web_cavern'}, gold:{min:70,max:150}, rarityWeights:{grey:0,white:0,green:30,blue:56,purple:12,gold:2,orange:0,red:0}, entries:[{itemId:'item_threadjaw_fangblade',chance:12,min:1,max:1},{itemId:'item_old_venomsacs_gland',chance:12,min:1,max:1},{itemId:'item_cocoon_tenders_sash',chance:12,min:1,max:1},{itemId:'item_pale_spinners_hood',chance:12,min:1,max:1},{itemId:'item_hollowfang_chitin_guard',chance:12,min:1,max:1},{itemId:'item_webbed_chitin_shard',chance:55,min:2,max:5},{itemId:'item_spider_silk_thread',chance:50,min:2,max:5}], rarePool:['item_threadjaw_fangblade','item_old_venomsacs_gland','item_cocoon_tenders_sash','item_pale_spinners_hood','item_hollowfang_chitin_guard'], rareChance:24, guaranteedCount:1, guaranteedPool:['item_threadjaw_fangblade','item_old_venomsacs_gland','item_cocoon_tenders_sash','item_pale_spinners_hood','item_hollowfang_chitin_guard'], notes:'Guaranteed blue-chance mini-boss table. V0.13.26 guarantees one named mini-boss item per mini-boss roll.' },
    { id:'loot_boss_broodwarden_skirr', name:'Boss: Broodwarden Skirr', source:{kind:'boss',id:'boss_broodwarden_skirr'}, gold:{min:130,max:260}, rarityWeights:{grey:0,white:0,green:20,blue:65,purple:13,gold:2,orange:0,red:0}, entries:[{itemId:'item_skirrs_chitin_chestguard',chance:18,min:1,max:1},{itemId:'item_broodwardens_fang',chance:18,min:1,max:1},{itemId:'item_ring_of_sticky_silk',chance:18,min:1,max:1},{itemId:'item_spider_silk_thread',chance:60,min:3,max:6}], rarePool:['item_skirrs_chitin_chestguard','item_broodwardens_fang','item_ring_of_sticky_silk'], rareChance:32, guaranteedCount:1, guaranteedPool:['item_skirrs_chitin_chestguard','item_broodwardens_fang','item_ring_of_sticky_silk'], notes:'Floor 1 boss table. V0.13.26 guarantees one Skirr item.' },
    { id:'loot_boss_matron_velyra', name:'Boss: Matron Velyra', source:{kind:'boss',id:'boss_matron_velyra'}, gold:{min:190,max:340}, rarityWeights:{grey:0,white:0,green:10,blue:56,purple:30,gold:4,orange:0,red:0}, entries:[{itemId:'item_velyras_cocoon_robe',chance:14,min:1,max:1},{itemId:'item_matrons_venom_focus',chance:20,min:1,max:1},{itemId:'item_widow_silk_leggings',chance:20,min:1,max:1},{itemId:'item_venom_sac',chance:70,min:3,max:7}], rarePool:['item_velyras_cocoon_robe','item_matrons_venom_focus','item_widow_silk_leggings'], rareChance:38, guaranteedCount:1, guaranteedPool:['item_velyras_cocoon_robe','item_matrons_venom_focus','item_widow_silk_leggings'], notes:'Floor 2 boss table. V0.13.26 guarantees one Matron item.' },
    { id:'loot_boss_queen_arakhzel', name:"Boss: Queen Arakh'Zel", source:{kind:'boss',id:'boss_queen_arakhzel'}, gold:{min:320,max:580}, rarityWeights:{grey:0,white:0,green:0,blue:45,purple:48,gold:7,orange:0,red:0}, entries:[{itemId:'item_queens_loomheart_staff',chance:14,min:1,max:1},{itemId:'item_arakhzels_carapace_mantle',chance:14,min:1,max:1},{itemId:'item_ring_of_the_looming_hunger',chance:14,min:1,max:1},{itemId:'item_royal_websilk_satchel',chance:18,min:1,max:1},{itemId:'item_queens_venom_fang',chance:14,min:1,max:1},{itemId:'item_webbed_queen_earring',chance:12,min:1,max:1},{itemId:'item_royal_websilk_cape',chance:12,min:1,max:1},{itemId:'item_arakhzels_spined_shoulders',chance:12,min:1,max:1}], rarePool:['item_queens_loomheart_staff','item_arakhzels_carapace_mantle','item_ring_of_the_looming_hunger','item_royal_websilk_satchel','item_queens_venom_fang','item_webbed_queen_earring','item_royal_websilk_cape','item_arakhzels_spined_shoulders'], rareChance:100, guaranteedCount:1, guaranteedPool:['item_queens_loomheart_staff','item_arakhzels_carapace_mantle','item_ring_of_the_looming_hunger','item_royal_websilk_satchel','item_queens_venom_fang','item_webbed_queen_earring','item_royal_websilk_cape','item_arakhzels_spined_shoulders'], notes:'Final boss guaranteed named dungeon gear across weapons, armor, jewelry, cape, shoulders, and bag slots. V0.13.46.' },
    { id:'loot_silk_web_cavern_treasure', name:'Silk Web Cavern: Treasure Web', source:{kind:'chest',id:'silk_web_cavern'}, gold:{min:120,max:320}, rarityWeights:{grey:0,white:0,green:20,blue:56,purple:20,gold:4,orange:0,red:0}, entries:[{itemId:'item_chitin_buckler',chance:8,min:1,max:1},{itemId:'item_silkfang_dagger',chance:8,min:1,max:1},{itemId:'item_webspinner_wand',chance:8,min:1,max:1},{itemId:'item_cocoonweave_gloves',chance:8,min:1,max:1},{itemId:'item_venom_stained_boots',chance:8,min:1,max:1},{itemId:'item_silk_web_antivenom_charm',chance:7,min:1,max:1},{itemId:'item_royal_websilk_satchel',chance:5,min:1,max:1},{itemId:'item_webbed_queen_earring',chance:3,min:1,max:1},{itemId:'item_royal_websilk_cape',chance:3,min:1,max:1}], rarePool:['item_royal_websilk_satchel','item_velyras_cocoon_robe','item_ring_of_the_looming_hunger','item_webbed_queen_earring','item_royal_websilk_cape'], rareChance:18, guaranteedCount:1, guaranteedPool:['item_chitin_buckler','item_silkfang_dagger','item_webspinner_wand','item_cocoonweave_gloves','item_venom_stained_boots','item_silk_web_antivenom_charm'], notes:'Guarded cache and optional reliquary table with one guaranteed dungeon item. V0.13.46.' },
    { id:'loot_silk_web_cavern_final', name:'Silk Web Cavern: Final Reward', source:{kind:'dungeonReward',id:'silk_web_cavern'}, gold:{min:260,max:520}, rarityWeights:{grey:0,white:0,green:0,blue:48,purple:48,gold:4,orange:0,red:0}, entries:[{itemId:'item_queens_loomheart_staff',chance:10,min:1,max:1},{itemId:'item_arakhzels_carapace_mantle',chance:10,min:1,max:1},{itemId:'item_ring_of_the_looming_hunger',chance:10,min:1,max:1},{itemId:'item_royal_websilk_satchel',chance:14,min:1,max:1},{itemId:'item_queens_venom_fang',chance:10,min:1,max:1},{itemId:'item_silk_web_antivenom_charm',chance:16,min:1,max:1},{itemId:'item_webbed_queen_earring',chance:10,min:1,max:1},{itemId:'item_royal_websilk_cape',chance:10,min:1,max:1},{itemId:'item_arakhzels_spined_shoulders',chance:10,min:1,max:1}], rarePool:['item_queens_loomheart_staff','item_arakhzels_carapace_mantle','item_ring_of_the_looming_hunger','item_queens_venom_fang','item_webbed_queen_earring','item_royal_websilk_cape','item_arakhzels_spined_shoulders'], rareChance:100, guaranteedCount:1, guaranteedPool:['item_queens_loomheart_staff','item_arakhzels_carapace_mantle','item_ring_of_the_looming_hunger','item_royal_websilk_satchel','item_queens_venom_fang','item_webbed_queen_earring','item_royal_websilk_cape','item_arakhzels_spined_shoulders'], notes:'Completion treasure web guarantees one named final reward across the expanded dungeon slot identity. V0.13.46.' }
  );


  const V01335_SLOT_LOOT = Object.freeze([
    'item_darkbough_helmet',
    'item_moonless_silk_hood',
    'item_gloomguard_pauldrons',
    'item_moss_stitched_mantle',
    'item_shadowmoss_cape',
    'item_old_path_amulet',
    'item_briar_silver_earring',
    'item_fangbone_earring',
    'item_hollow_light_ring',
    'item_deepwood_band',
    'item_bone_luck_charm'
  ]);

  const V01335_BLUE_SLOT_LOOT = Object.freeze([
    'item_lanternthread_cape',
    'item_warden_lantern_amulet',
    'item_starlit_moth_earring',
    'item_rootglass_signet'
  ]);

  const V01335_DUNGEON_SLOT_LOOT = Object.freeze([
    'item_webbed_queen_earring',
    'item_royal_websilk_cape',
    'item_arakhzels_spined_shoulders'
  ]);

  const addSlotLootEntries = (tableIds, itemIds, chance, rareChanceBonus = 0) => {
    for (const tableId of tableIds) {
      const table = DR.LOOT_TABLES.find(entry => entry.id === tableId);
      if (!table) continue;
      table.entries = Array.isArray(table.entries) ? table.entries : [];
      const existing = new Set(table.entries.map(entry => entry && entry.itemId).filter(Boolean));
      for (const itemId of itemIds) {
        if (!existing.has(itemId)) table.entries.push({ itemId, chance, min: 1, max: 1 });
      }
      table.rarePool = Array.isArray(table.rarePool) ? table.rarePool : [];
      for (const itemId of itemIds) if (!table.rarePool.includes(itemId)) table.rarePool.push(itemId);
      if (rareChanceBonus) table.rareChance = Math.max(Number(table.rareChance || 0), rareChanceBonus);
      table.notes = `${table.notes || ''} V0.13.35 adds full visible gear-slot coverage.`.trim();
    }
  };

  addSlotLootEntries([
    'loot_dark_woods_wolves',
    'loot_dark_woods_rotlings',
    'loot_dark_woods_briar_boars',
    'loot_dark_woods_duskwisps',
    'loot_dark_woods_hollow_stags',
    'loot_dark_woods_ashroot_horrors',
    'loot_dark_woods_common_mobs',
    'loot_mossfang_cave_mobs',
    'loot_cave_mossfang_mobs',
    'loot_cave_silk_web_mobs',
    'loot_cave_ashroot_mobs',
    'loot_cave_crystal_grotto_mobs',
    'loot_cave_forgotten_mine_mobs',
    'loot_cave_blackroot_catacombs_mobs'
  ], V01335_SLOT_LOOT, 1.65, 5.5);

  addSlotLootEntries([
    'loot_dark_woods_named_rares',
    'loot_common_chest',
    'loot_dungeon_chest',
    'loot_cave_small_treasure',
    'loot_cave_medium_treasure',
    'loot_cave_large_treasure',
    'loot_dungeon_elite_mobs',
    'loot_boss_hollow_warden',
    'loot_boss_rootbound_matriarch',
    'loot_boss_gloom_king',
    'loot_boss_silk_mother'
  ], [...V01335_SLOT_LOOT, ...V01335_BLUE_SLOT_LOOT], 3.25, 12);

  addSlotLootEntries([
    'loot_silk_web_cavern',
    'loot_silk_web_cavern_elites',
    'loot_silk_web_cavern_minibosses',
    'loot_boss_broodwarden_skirr',
    'loot_boss_matron_velyra',
    'loot_boss_queen_arakhzel',
    'loot_silk_web_cavern_treasure',
    'loot_silk_web_cavern_final'
  ], [...V01335_BLUE_SLOT_LOOT, ...V01335_DUNGEON_SLOT_LOOT], 4.5, 18);


  DR.LOOT_TABLE_BY_ID = Object.fromEntries(DR.LOOT_TABLES.map(table => [table.id, table]));
})();
