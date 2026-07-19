// Dream Realms runtime mob spawn system
// Modular Pass 37: converts editor mob spawn markers into live runtime enemy populations.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const DEFAULT_MOB_SPAWN_PLACEMENTS = [
    // V0.12.31 regenerated Dark Woods spawn anchors: rebuilt to match the new roads, landmarks, cave entrances, and level-gradient pockets.
    { zone: 'dark_woods', x: 72, y: 89, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 80, y: 123, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 119, y: 86, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 121, y: 119, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 91, y: 126, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 70, y: 112, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 130, y: 100, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 104, y: 128, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 132, y: 81, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 65, y: 99, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 116, y: 132, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 88, y: 78, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 53, y: 60, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 63, y: 71, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 83, y: 58, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 98, y: 61, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 116, y: 55, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 128, y: 58, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 135, y: 72, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 149, y: 75, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 157, y: 63, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 168, y: 64, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 181, y: 70, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 190, y: 95, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 143, y: 108, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 152, y: 104, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 169, y: 110, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 180, y: 120, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 151, y: 138, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 184, y: 143, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 36, y: 119, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 45, y: 128, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 61, y: 128, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 38, y: 146, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 66, y: 151, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 82, y: 144, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 39, y: 166, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 55, y: 181, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 76, y: 177, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 93, y: 170, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 31, y: 184, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 105, y: 188, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 24, y: 42, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 38, y: 36, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 72, y: 34, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 112, y: 30, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 145, y: 34, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 172, y: 35, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 193, y: 49, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 123, y: 160, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 139, y: 170, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 160, y: 166, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 183, y: 176, spawnId: 'spawn_dark_woods_ashroot_horrors' },
    { zone: 'dark_woods', x: 194, y: 156, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 44, y: 84, spawnId: 'spawn_dark_woods_briar_boars' },
    { zone: 'dark_woods', x: 56, y: 106, spawnId: 'spawn_dark_woods_rotlings' },
    { zone: 'dark_woods', x: 72, y: 135, spawnId: 'spawn_dark_woods_wolves' },
    { zone: 'dark_woods', x: 100, y: 144, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 118, y: 145, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 136, y: 135, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 156, y: 96, spawnId: 'spawn_dark_woods_duskwisps' },
    { zone: 'dark_woods', x: 164, y: 92, spawnId: 'spawn_dark_woods_hollow_stags' },
    { zone: 'dark_woods', x: 172, y: 82, spawnId: 'spawn_dark_woods_deep_mixed' },
    { zone: 'dark_woods', x: 128, y: 132, spawnId: 'spawn_dark_woods_named_briarback' },
    { zone: 'dark_woods', x: 116, y: 48, spawnId: 'spawn_dark_woods_named_lumen_wisp' },
    { zone: 'dark_woods', x: 92, y: 162, spawnId: 'spawn_dark_woods_named_thorn_stag' },
    { zone: 'dark_woods', x: 177, y: 62, spawnId: 'spawn_dark_woods_named_ashroot_elder' },
    // V0.17.48 Phase 9: Bandit's Fall named leader, anchored near the ruin
    // landmark's central structure (ensureBanditsFallLandmark, center 230,60).
    { zone: 'dark_woods', x: 225, y: 55, spawnId: 'spawn_bandits_fall_named_leader' },
    // V0.17.50 Phase 11: Stone Hedge Ruins inner-ring/named wisp, reusing the
    // existing spawn_dark_woods_named_lumen_wisp draft (already elite/rare
    // per its own data - serves as both "inner-ring stronger" and "optional
    // named wisp" from the plan, since only one non-named wisp tier
    // (Duskwisp) plus this one named tier (Lumen-Wisp) exist in the active
    // Dark Woods mob data; see the Phase 11 report for why a 3rd wisp tier
    // wasn't invented). Placed just outside the waypoint's clear radius
    // (Phase 10: nothing closer than 5 tiles to 210,250) and inside the
    // standing-stone ring (radius 9), between the two.
    { zone: 'dark_woods', x: 210, y: 256, spawnId: 'spawn_dark_woods_named_lumen_wisp' },
  ];
  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const MIN_RESPAWN_SECONDS = 75;

  // V0.15.04: authored Dark Woods population layer with 50% hostile density reduction.  This supplements the existing
  // editor-owned spawn markers with structured camps, solo roamers, and roaming groups.
  // It intentionally lives in the mob spawn owner instead of a late runtime patch.
  const DARK_WOODS_POPULATION_VERSION = 6; // V0.18.3: far-reach camps + denser distant spread
  const DARK_WOODS_TARGET_MOB_COUNT_MULTIPLIER = 1.5;
  const DARK_WOODS_HOSTILE_DENSITY_SCALE = 0.5;
  const DARK_WOODS_SAFE_TOWN_RADIUS_TILES = 17;
  const DARK_WOODS_SAFE_SPAWN_RADIUS_TILES = 15;
  const DARK_WOODS_CAVE_ENTRANCE_SAFE_RADIUS_TILES = 7;
  const DARK_WOODS_MIN_SOLO_SPACING_TILES = 8;
  const DARK_WOODS_MIN_CAMP_SPACING_TILES = 18;
  const DARK_WOODS_MIN_GROUP_SPACING_TILES = 12;
  // V0.13.23: population-stability budget constants.  These keep the 3x
  // population pass from turning into per-frame all-mob AI and provide an
  // owned audit/repair path for invalid or overcrowded placements.
  const DARK_WOODS_FULL_AI_RADIUS_TILES = 34;
  const DARK_WOODS_LIGHT_AI_RADIUS_TILES = 76;
  const DARK_WOODS_RESPAWN_SCAN_INTERVAL_MS = 550;
  const DARK_WOODS_RESPAWN_SCAN_BUDGET = 96;
  const DARK_WOODS_DENSITY_RADIUS_TILES = 8;
  const DARK_WOODS_DENSITY_CAPS = {
    anchor: 9,
    camp: 8,
    solo_roamer: 3,
    roaming_group: 6,
    default: 8
  };

  const DARK_WOODS_MOB_CAMPS = [
    { id: 'wolf_den_west', type: 'wolf_den', x: 38, y: 64, spawnId: 'spawn_dark_woods_wolves', countMin: 4, countMax: 6, radius: 8, roamRadius: 6, minSpacing: 3.6, minCampSpacing: 18, respawnMin: 90, respawnMax: 145 },
    { id: 'wolf_den_southwood', type: 'wolf_den', x: 61, y: 154, spawnId: 'spawn_dark_woods_wolves', countMin: 4, countMax: 6, radius: 8, roamRadius: 7, minSpacing: 3.8, minCampSpacing: 18, respawnMin: 95, respawnMax: 150 },
    { id: 'rootling_thicket_west', type: 'rootling_thicket', x: 34, y: 132, spawnId: 'spawn_dark_woods_rotlings', countMin: 5, countMax: 7, radius: 9, roamRadius: 6, minSpacing: 3.4, minCampSpacing: 18, respawnMin: 90, respawnMax: 145 },
    { id: 'spider_nest_south', type: 'spider_nest', x: 101, y: 154, spawnId: 'spawn_cave_spiders', countMin: 4, countMax: 6, radius: 8, roamRadius: 5, minSpacing: 3.4, minCampSpacing: 18, respawnMin: 100, respawnMax: 150 },
    { id: 'grave_wisp_patch_east', type: 'undead_grave_patch', x: 151, y: 121, spawnId: 'spawn_dark_woods_duskwisps', countMin: 4, countMax: 6, radius: 9, roamRadius: 6, minSpacing: 3.8, minCampSpacing: 18, respawnMin: 100, respawnMax: 155 },
    { id: 'gloom_feeding_ground_outer', type: 'gloom_beast_feeding_ground', x: 176, y: 155, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 4, countMax: 6, radius: 10, roamRadius: 7, minSpacing: 4.2, minCampSpacing: 18, respawnMin: 115, respawnMax: 165 },
    { id: 'ashroot_blight_north', type: 'rootling_thicket', x: 172, y: 42, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 2, countMax: 3, radius: 8, roamRadius: 5, minSpacing: 5.0, minCampSpacing: 20, respawnMin: 130, respawnMax: 185 },
    { id: 'young_wolf_glen_northwest', type: 'wolf_den', x: 55, y: 38, spawnId: 'spawn_dark_woods_wolves', countMin: 3, countMax: 5, radius: 8, roamRadius: 6, minSpacing: 3.6, minCampSpacing: 18, respawnMin: 90, respawnMax: 140 },
    { id: 'hollow_stag_copse_south', type: 'hollow_stag_copse', x: 137, y: 169, spawnId: 'spawn_dark_woods_hollow_stags', countMin: 3, countMax: 5, radius: 10, roamRadius: 8, minSpacing: 5.0, minCampSpacing: 18, respawnMin: 115, respawnMax: 170 },
    { id: 'ashroot_guard_east', type: 'ruined_shrine_ambush', x: 190, y: 90, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 2, countMax: 3, radius: 8, roamRadius: 5, minSpacing: 5.0, minCampSpacing: 20, respawnMin: 135, respawnMax: 190 },
    { id: 'grave_patch_southwest', type: 'undead_grave_patch', x: 24, y: 178, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 2, countMax: 4, radius: 9, roamRadius: 6, minSpacing: 5.0, minCampSpacing: 18, respawnMin: 135, respawnMax: 190 },
    { id: 'lumen_ruin_north', type: 'ruined_shrine_ambush', x: 125, y: 45, spawnId: 'spawn_dark_woods_duskwisps', countMin: 4, countMax: 6, radius: 9, roamRadius: 6, minSpacing: 3.9, minCampSpacing: 18, respawnMin: 100, respawnMax: 155 },
    { id: 'mushroom_clearing_west', type: 'mushroom_infested_clearing', x: 29, y: 104, spawnId: 'spawn_dark_woods_rotlings', countMin: 5, countMax: 7, radius: 9, roamRadius: 6, minSpacing: 3.5, minCampSpacing: 18, respawnMin: 90, respawnMax: 145 },
    { id: 'mushroom_clearing_south', type: 'mushroom_infested_clearing', x: 111, y: 186, spawnId: 'spawn_dark_woods_rotlings', countMin: 5, countMax: 7, radius: 9, roamRadius: 6, minSpacing: 3.5, minCampSpacing: 18, respawnMin: 95, respawnMax: 150 },
    { id: 'briar_boar_wallow_mid', type: 'gloom_beast_feeding_ground', x: 123, y: 101, spawnId: 'spawn_dark_woods_briar_boars', countMin: 4, countMax: 6, radius: 9, roamRadius: 7, minSpacing: 4.5, minCampSpacing: 18, respawnMin: 105, respawnMax: 160 },
    { id: 'thorn_spider_copse_east', type: 'spider_nest', x: 162, y: 72, spawnId: 'spawn_cave_spiders', countMin: 4, countMax: 6, radius: 8, roamRadius: 5, minSpacing: 3.5, minCampSpacing: 18, respawnMin: 105, respawnMax: 155 },
    { id: 'hollow_stag_grove_west', type: 'hollow_stag_copse', x: 63, y: 184, spawnId: 'spawn_dark_woods_hollow_stags', countMin: 3, countMax: 5, radius: 11, roamRadius: 8, minSpacing: 5.0, minCampSpacing: 18, respawnMin: 120, respawnMax: 175 },
    { id: 'deepwood_crossing_east', type: 'gloom_beast_feeding_ground', x: 195, y: 132, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 4, countMax: 6, radius: 10, roamRadius: 7, minSpacing: 5.2, minCampSpacing: 18, respawnMin: 120, respawnMax: 175 },
    { id: 'wisp_lantern_marsh_north', type: 'undead_grave_patch', x: 152, y: 35, spawnId: 'spawn_dark_woods_duskwisps', countMin: 4, countMax: 6, radius: 9, roamRadius: 6, minSpacing: 4.0, minCampSpacing: 18, respawnMin: 105, respawnMax: 160 },
    { id: 'ashroot_blackened_stand', type: 'rootling_thicket', x: 193, y: 49, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 2, countMax: 4, radius: 8, roamRadius: 5, minSpacing: 5.2, minCampSpacing: 20, respawnMin: 140, respawnMax: 200 },
    // V0.17.48 Phase 9: Bandit's Fall camp, placed at the new ruin landmark
    // (systems/world-system.js ensureBanditsFallLandmark, center 230,60) in
    // fresh Phase 2 territory - comfortably clear (40+ tiles) of every other
    // camp in this list, so minCampSpacing is not a concern here.
    { id: 'bandits_fall_camp', type: 'bandit_camp', x: 230, y: 65, spawnId: 'spawn_bandits_fall_camp', countMin: 3, countMax: 5, radius: 12, roamRadius: 9, minSpacing: 4.5, minCampSpacing: 20, respawnMin: 120, respawnMax: 175 },
    // V0.17.50 Phase 11: Stone Hedge Ruins outer-ring wisps, reusing the
    // existing spawn_dark_woods_duskwisps draft (no new mob/spawn data
    // needed). Centered 16 tiles south of the ring (210,266), i.e. outside
    // the standing-stone ring at radius 9 (Phase 10), so the "outer ring"
    // patrol area sits around the landmark rather than inside it.
    { id: 'stone_hedge_wisps_outer', type: 'undead_grave_patch', x: 210, y: 266, spawnId: 'spawn_dark_woods_duskwisps', countMin: 3, countMax: 4, radius: 9, roamRadius: 12, minSpacing: 4.5, minCampSpacing: 20, respawnMin: 100, respawnMax: 155 },
    // V0.18.3: the camps above cluster in the top-left near town (x/y < ~200); camp is at
    // (100,100) on a 360x360 map, so the whole east/south/deep-corner half was nearly
    // camp-less. These fill the far reaches with well-spaced, distance-appropriate camps
    // (deeper = tougher families), so density no longer thins out away from town.
    { id: 'deepwood_hollow_east', type: 'gloom_beast_feeding_ground', x: 244, y: 128, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 4, countMax: 6, radius: 10, roamRadius: 8, minSpacing: 4.6, minCampSpacing: 22, respawnMin: 120, respawnMax: 175 },
    { id: 'ashroot_scar_far_east', type: 'rootling_thicket', x: 286, y: 96, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 3, countMax: 4, radius: 9, roamRadius: 6, minSpacing: 5.0, minCampSpacing: 22, respawnMin: 140, respawnMax: 200 },
    { id: 'hollow_stag_range_east', type: 'hollow_stag_copse', x: 262, y: 192, spawnId: 'spawn_dark_woods_hollow_stags', countMin: 4, countMax: 6, radius: 11, roamRadius: 8, minSpacing: 5.0, minCampSpacing: 22, respawnMin: 125, respawnMax: 180 },
    { id: 'gloamroot_feeding_ground', type: 'gloom_beast_feeding_ground', x: 306, y: 158, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 4, countMax: 6, radius: 11, roamRadius: 8, minSpacing: 4.8, minCampSpacing: 22, respawnMin: 130, respawnMax: 185 },
    { id: 'briar_wallow_south', type: 'gloom_beast_feeding_ground', x: 158, y: 232, spawnId: 'spawn_dark_woods_briar_boars', countMin: 4, countMax: 6, radius: 10, roamRadius: 7, minSpacing: 4.5, minCampSpacing: 22, respawnMin: 115, respawnMax: 170 },
    { id: 'spider_hollow_south', type: 'spider_nest', x: 112, y: 278, spawnId: 'spawn_cave_spiders', countMin: 4, countMax: 6, radius: 9, roamRadius: 6, minSpacing: 3.6, minCampSpacing: 22, respawnMin: 110, respawnMax: 165 },
    { id: 'hollow_stag_glen_south', type: 'hollow_stag_copse', x: 202, y: 302, spawnId: 'spawn_dark_woods_hollow_stags', countMin: 4, countMax: 6, radius: 11, roamRadius: 8, minSpacing: 5.0, minCampSpacing: 22, respawnMin: 125, respawnMax: 180 },
    { id: 'gloamroot_depths_camp', type: 'gloom_beast_feeding_ground', x: 258, y: 256, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 5, countMax: 7, radius: 12, roamRadius: 9, minSpacing: 5.0, minCampSpacing: 22, respawnMin: 135, respawnMax: 195 },
    { id: 'ashroot_deepcorner', type: 'rootling_thicket', x: 304, y: 292, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 3, countMax: 5, radius: 10, roamRadius: 6, minSpacing: 5.2, minCampSpacing: 22, respawnMin: 145, respawnMax: 205 },
    { id: 'wolf_den_far_south', type: 'wolf_den', x: 66, y: 246, spawnId: 'spawn_dark_woods_wolves', countMin: 4, countMax: 6, radius: 9, roamRadius: 7, minSpacing: 3.8, minCampSpacing: 22, respawnMin: 100, respawnMax: 155 },
    { id: 'wisp_marsh_far_east', type: 'undead_grave_patch', x: 316, y: 218, spawnId: 'spawn_dark_woods_duskwisps', countMin: 4, countMax: 6, radius: 10, roamRadius: 7, minSpacing: 4.0, minCampSpacing: 22, respawnMin: 115, respawnMax: 170 },
    { id: 'rootling_bog_southcentral', type: 'mushroom_infested_clearing', x: 150, y: 300, spawnId: 'spawn_dark_woods_rotlings', countMin: 5, countMax: 7, radius: 10, roamRadius: 6, minSpacing: 3.5, minCampSpacing: 22, respawnMin: 105, respawnMax: 160 }
  ];

  const DARK_WOODS_SOLO_ROAMERS = [
    { id: 'solo_wolves', spawnId: 'spawn_dark_woods_wolves', count: 34, roamRadius: 10, minSpacing: DARK_WOODS_MIN_SOLO_SPACING_TILES, seedX: 24, seedY: 38, stepX: 37, stepY: 29 },
    { id: 'solo_rotlings', spawnId: 'spawn_dark_woods_rotlings', count: 30, roamRadius: 9, minSpacing: DARK_WOODS_MIN_SOLO_SPACING_TILES, seedX: 36, seedY: 54, stepX: 31, stepY: 43 },
    { id: 'solo_boars', spawnId: 'spawn_dark_woods_briar_boars', count: 26, roamRadius: 10, minSpacing: DARK_WOODS_MIN_SOLO_SPACING_TILES, seedX: 44, seedY: 82, stepX: 47, stepY: 33 },
    { id: 'solo_wisps', spawnId: 'spawn_dark_woods_duskwisps', count: 22, roamRadius: 11, minSpacing: DARK_WOODS_MIN_SOLO_SPACING_TILES, seedX: 118, seedY: 36, stepX: 29, stepY: 47 },
    { id: 'solo_deepwood', spawnId: 'spawn_dark_woods_hollow_stags', count: 24, roamRadius: 12, minSpacing: 10, seedX: 74, seedY: 146, stepX: 41, stepY: 37 }
  ];

  const DARK_WOODS_ROAMING_GROUPS = [
    { id: 'wolf_pack_roamer_01', x: 46, y: 92, spawnId: 'spawn_dark_woods_wolves', countMin: 3, countMax: 4, radius: 9, roamRadius: 18, leashRadius: 24, minSpacing: 4.5 },
    { id: 'wolf_pack_roamer_02', x: 87, y: 54, spawnId: 'spawn_dark_woods_wolves', countMin: 3, countMax: 4, radius: 9, roamRadius: 18, leashRadius: 24, minSpacing: 4.5 },
    { id: 'rootling_patrol_01', x: 73, y: 128, spawnId: 'spawn_dark_woods_rotlings', countMin: 3, countMax: 5, radius: 8, roamRadius: 15, leashRadius: 22, minSpacing: 4.0 },
    { id: 'rootling_patrol_02', x: 117, y: 132, spawnId: 'spawn_dark_woods_rotlings', countMin: 3, countMax: 5, radius: 8, roamRadius: 15, leashRadius: 22, minSpacing: 4.0 },
    { id: 'boar_run_01', x: 111, y: 82, spawnId: 'spawn_dark_woods_briar_boars', countMin: 2, countMax: 4, radius: 8, roamRadius: 16, leashRadius: 23, minSpacing: 4.8 },
    { id: 'boar_run_02', x: 48, y: 148, spawnId: 'spawn_dark_woods_briar_boars', countMin: 2, countMax: 4, radius: 8, roamRadius: 16, leashRadius: 23, minSpacing: 4.8 },
    { id: 'wisp_drift_01', x: 145, y: 76, spawnId: 'spawn_dark_woods_duskwisps', countMin: 3, countMax: 4, radius: 10, roamRadius: 18, leashRadius: 25, minSpacing: 4.5 },
    { id: 'wisp_drift_02', x: 158, y: 108, spawnId: 'spawn_dark_woods_duskwisps', countMin: 3, countMax: 4, radius: 10, roamRadius: 18, leashRadius: 25, minSpacing: 4.5 },
    { id: 'deepwood_roamer_01', x: 170, y: 122, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 3, countMax: 5, radius: 11, roamRadius: 20, leashRadius: 28, minSpacing: 5.5 },
    { id: 'deepwood_roamer_02', x: 139, y: 148, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 3, countMax: 5, radius: 11, roamRadius: 20, leashRadius: 28, minSpacing: 5.5 },
    { id: 'stag_roamer_01', x: 88, y: 176, spawnId: 'spawn_dark_woods_hollow_stags', countMin: 2, countMax: 4, radius: 12, roamRadius: 20, leashRadius: 28, minSpacing: 6.0 },
    { id: 'ashroot_roamer_01', x: 183, y: 178, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 2, countMax: 3, radius: 10, roamRadius: 18, leashRadius: 26, minSpacing: 6.0 },
    { id: 'wolf_pack_roamer_03', x: 28, y: 155, spawnId: 'spawn_dark_woods_wolves', countMin: 3, countMax: 5, radius: 9, roamRadius: 18, leashRadius: 24, minSpacing: 4.5 },
    { id: 'rootling_patrol_03', x: 67, y: 72, spawnId: 'spawn_dark_woods_rotlings', countMin: 3, countMax: 5, radius: 8, roamRadius: 15, leashRadius: 22, minSpacing: 4.0 },
    { id: 'boar_run_03', x: 132, y: 61, spawnId: 'spawn_dark_woods_briar_boars', countMin: 3, countMax: 4, radius: 9, roamRadius: 16, leashRadius: 23, minSpacing: 4.8 },
    { id: 'wisp_drift_03', x: 119, y: 166, spawnId: 'spawn_dark_woods_duskwisps', countMin: 3, countMax: 5, radius: 10, roamRadius: 18, leashRadius: 25, minSpacing: 4.5 },
    { id: 'deepwood_roamer_03', x: 154, y: 185, spawnId: 'spawn_dark_woods_deep_mixed', countMin: 3, countMax: 5, radius: 11, roamRadius: 20, leashRadius: 28, minSpacing: 5.5 },
    { id: 'stag_roamer_02', x: 44, y: 173, spawnId: 'spawn_dark_woods_hollow_stags', countMin: 2, countMax: 4, radius: 12, roamRadius: 20, leashRadius: 28, minSpacing: 6.0 },
    { id: 'spider_roamer_01', x: 108, y: 146, spawnId: 'spawn_cave_spiders', countMin: 3, countMax: 5, radius: 8, roamRadius: 16, leashRadius: 22, minSpacing: 4.0 },
    { id: 'ashroot_roamer_02', x: 166, y: 166, spawnId: 'spawn_dark_woods_ashroot_horrors', countMin: 2, countMax: 3, radius: 10, roamRadius: 18, leashRadius: 26, minSpacing: 6.0 }
  ];


  function darkWoodsSoloPoint(spec, index) {
    // Deterministic quasi-random distribution. Keeps population stable across reloads
    // without relying on runtime random placement or save-only side effects.
    const x = 14 + ((Number(spec.seedX || 17) + index * Number(spec.stepX || 31) + Math.floor(index / 5) * 19) % 178);
    const y = 18 + ((Number(spec.seedY || 23) + index * Number(spec.stepY || 37) + Math.floor(index / 4) * 23) % 170);
    return { x, y };
  }

  function isNamedDarkWoodsSpawn(spawnIdOrPlacement, def = null) {
    const id = String(typeof spawnIdOrPlacement === 'string' ? spawnIdOrPlacement : (spawnIdOrPlacement?.spawnId || spawnIdOrPlacement?.id || '')).toLowerCase();
    if (id.includes('named')) return true;
    if (def?.elite || def?.named || def?.boss || def?.rare) return true;
    const ids = Array.isArray(def?.mobIds) ? def.mobIds : (Array.isArray(spawnIdOrPlacement?.mobIds) ? spawnIdOrPlacement.mobIds : []);
    return ids.some(mobId => String(mobId).toLowerCase().includes('named'));
  }

  function scaleDarkWoodsHostileCount(value, mode = 'round') {
    const raw = Math.max(0, safeNumber(value, 0));
    if (raw <= 1) return Math.max(0, Math.floor(raw));
    const scaled = raw * DARK_WOODS_HOSTILE_DENSITY_SCALE;
    const rounded = mode === 'ceil' ? Math.ceil(scaled) : Math.floor(scaled);
    return Math.max(1, rounded);
  }

  function scaleDarkWoodsCountPair(zoneId, placement, def, countMin, countMax) {
    if (zoneId !== 'dark_woods' || isNamedDarkWoodsSpawn(placement, def)) return { countMin, countMax };
    // V0.17.90: tiered-spread encounters carry exact group sizes - do not halve.
    if (placement?.exactCount || def?.exactCount) return { countMin, countMax };
    const min = scaleDarkWoodsHostileCount(countMin, 'floor');
    const max = Math.max(min, scaleDarkWoodsHostileCount(countMax, 'ceil'));
    return { countMin: Math.max(1, min), countMax: Math.max(1, max) };
  }

  // V0.17.90 mob distribution rework: a deterministic full-coverage tiered
  // encounter generator. Fixes the two causes of the "empty" outer zone:
  // (1) the old solo/group generators only scattered within x:14-192,y:18-188,
  // leaving Bandit's Fall / Stone Hedge / Gloamroot (out to ~285,300) sparse;
  // (2) group sizes were halved by DARK_WOODS_HOSTILE_DENSITY_SCALE.
  // This scatters well-spaced roaming encounters across the whole content area,
  // with EXACT group-size tiers (solo=1, small 2-3, medium 3-5, large 5-7,
  // flagged exactCount so the density scale leaves them alone), family + tier
  // weighted by distance from camp, and level derived from distance (the
  // existing overworldProgress/chooseLevel). Deterministic (hash-lattice), so
  // the population is stable across reloads exactly like the old solo roamers.
  function darkWoodsHash(x, y) {
    let h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  const DARK_WOODS_ENCOUNTER_TIERS = {
    solo:   { min: 1, max: 1, roam: 20, radius: 6,  leash: 26, kind: 'solo_roamer',  spacing: 8,  respawnMin: 75,  respawnMax: 130 },
    small:  { min: 2, max: 3, roam: 16, radius: 8,  leash: 24, kind: 'roaming_group', spacing: 10, respawnMin: 110, respawnMax: 170 },
    medium: { min: 3, max: 5, roam: 12, radius: 9,  leash: 22, kind: 'roaming_group', spacing: 12, respawnMin: 120, respawnMax: 180 },
    large:  { min: 5, max: 7, roam: 9,  radius: 11, leash: 20, kind: 'roaming_group', spacing: 14, respawnMin: 135, respawnMax: 200 }
  };

  const DARK_WOODS_BAND_FAMILIES = {
    near:  ['spawn_dark_woods_wolves', 'spawn_dark_woods_rotlings', 'spawn_dark_woods_briar_boars'],
    mid:   ['spawn_dark_woods_briar_boars', 'spawn_cave_spiders', 'spawn_dark_woods_duskwisps', 'spawn_dark_woods_hollow_stags'],
    deep:  ['spawn_dark_woods_duskwisps', 'spawn_dark_woods_hollow_stags', 'spawn_dark_woods_deep_mixed'],
    outer: ['spawn_dark_woods_deep_mixed', 'spawn_dark_woods_ashroot_horrors', 'spawn_dark_woods_hollow_stags']
  };

  // Tier weight thresholds per band: more solo/small near camp, more medium/large
  // deep. Each entry is [soloMax, smallMax, mediumMax] cumulative in 0..1.
  const DARK_WOODS_TIER_WEIGHTS = {
    near:  [0.50, 0.84, 0.97],
    mid:   [0.34, 0.64, 0.90],
    deep:  [0.26, 0.52, 0.82],
    outer: [0.22, 0.46, 0.76]
  };

  function darkWoodsTieredEncounters() {
    const out = [];
    const cx = Number(DR.CONFIG?.START_X) || 100;
    const cy = Number(DR.CONFIG?.START_Y) || 100;
    const step = 20;
    let idx = 0;
    for (let gy = 12; gy <= 306; gy += step) {
      for (let gx = 14; gx <= 306; gx += step) {
        // deterministic jitter within the cell
        const jx = gx + Math.round((darkWoodsHash(gx + 101, gy + 7) * 2 - 1) * (step * 0.42));
        const jy = gy + Math.round((darkWoodsHash(gx + 3, gy + 211) * 2 - 1) * (step * 0.42));
        if (jx < 8 || jy < 8 || jx > 312 || jy > 312) continue;
        const dist = Math.hypot(jx - cx, jy - cy);
        // V0.18.3: camp is at (100,100) on a 360x360 map, so the deep SE corner is ~290
        // tiles out. The old cap (205) left the far reaches empty and the ramp saturated at
        // dist 106, so density thinned with distance. Cover the whole content radius and
        // ramp over the full distance so the far half is as lively as (denser than) near.
        if (dist < 22 || dist > 300) continue;          // keep the camp clear, cover all content
        const progress = clamp((dist - 22) / 208, 0, 1);
        // Distance-ramped acceptance: modest near the safe camp ground, rising toward the
        // deep reaches so exploring out is rewarded, not emptier.
        if (darkWoodsHash(jx + 61, jy + 89) > (0.17 + progress * 0.41)) continue;
        const band = progress < 0.28 ? 'near' : progress < 0.55 ? 'mid' : progress < 0.80 ? 'deep' : 'outer';
        const fam = DARK_WOODS_BAND_FAMILIES[band];
        const spawnId = fam[Math.floor(darkWoodsHash(jx + 17, jy + 43) * fam.length) % fam.length];
        const tw = DARK_WOODS_TIER_WEIGHTS[band];
        const t = darkWoodsHash(jx + 211, jy + 137);
        const tier = t < tw[0] ? 'solo' : t < tw[1] ? 'small' : t < tw[2] ? 'medium' : 'large';
        const T = DARK_WOODS_ENCOUNTER_TIERS[tier];
        idx += 1;
        out.push({
          zone: 'dark_woods', x: jx, y: jy, spawnId,
          encounterKind: T.kind, encounterId: `dw_spread_${String(idx).padStart(3, '0')}_${tier}`,
          countMin: T.min, countMax: T.max, radius: T.radius,
          roamRadius: T.roam, patrolRadius: T.roam, leashRadius: T.leash,
          minSpacing: T.spacing, minCampSpacing: 12,
          respawnMin: T.respawnMin, respawnMax: T.respawnMax,
          exactCount: true, noSpawnNearTown: true, avoidRoads: true, autoSeeded: true
        });
      }
    }
    return out;
  }

  function darkWoodsStructuredPlacements() {
    const out = [];
    for (const camp of DARK_WOODS_MOB_CAMPS) {
      out.push({
        zone: 'dark_woods', x: camp.x, y: camp.y, spawnId: camp.spawnId,
        encounterKind: 'camp', encounterId: camp.id, encounterType: camp.type,
        countMin: camp.countMin, countMax: camp.countMax, radius: camp.radius,
        roamRadius: camp.roamRadius, patrolRadius: camp.roamRadius,
        minSpacing: camp.minSpacing, minCampSpacing: camp.minCampSpacing,
        respawnMin: camp.respawnMin, respawnMax: camp.respawnMax,
        noSpawnNearTown: true, avoidRoads: true, autoSeeded: true
      });
    }
    // V0.17.90: the old DARK_WOODS_SOLO_ROAMERS + DARK_WOODS_ROAMING_GROUPS
    // (confined to the top-left ~192x188 box) are replaced by the full-coverage
    // tiered generator below, which spreads solo/small/medium/large roaming
    // encounters across the entire content area with exact tier sizes.
    for (const enc of darkWoodsTieredEncounters()) out.push(enc);
    return out;
  }

  function darkWoodsAllDefaultPlacements() {
    return [...DEFAULT_MOB_SPAWN_PLACEMENTS, ...darkWoodsStructuredPlacements()];
  }

  function darkWoodsRespawnSeconds(spawn, enemy = null) {
    if (!spawn || spawn.zone && spawn.zone !== 'dark_woods') return Math.max(MIN_RESPAWN_SECONDS, Math.floor(safeNumber(spawn?.respawnSeconds || enemy?.baseType?.respawnSeconds, MIN_RESPAWN_SECONDS)));
    const kind = String(spawn.encounterKind || enemy?.encounterKind || '').toLowerCase();
    const explicitMin = Number(spawn.respawnMin);
    const explicitMax = Number(spawn.respawnMax);
    let min = Number.isFinite(explicitMin) ? explicitMin : 90;
    let max = Number.isFinite(explicitMax) ? explicitMax : 150;
    if (kind === 'solo_roamer') { min = Number.isFinite(explicitMin) ? explicitMin : 75; max = Number.isFinite(explicitMax) ? explicitMax : 130; }
    if (kind === 'roaming_group') { min = Number.isFinite(explicitMin) ? explicitMin : 120; max = Number.isFinite(explicitMax) ? explicitMax : 180; }
    if (spawn.elite || enemy?.elite || enemy?.baseType?.elite) { min = Math.max(min, 135); max = Math.max(max, 210); }
    min = Math.max(MIN_RESPAWN_SECONDS, Math.floor(min));
    max = Math.max(min, Math.floor(max));
    return randInt(min, max);
  }

  function overworldProgress(game, zoneId, node) {
    if (zoneId !== 'dark_woods') return 0.5;
    const startX = Number(game?.editorSpawnPoints?.dark_woods?.x || DR.CONFIG?.START_X || 100);
    const startY = Number(game?.editorSpawnPoints?.dark_woods?.y || DR.CONFIG?.START_Y || 100);
    const dx = safeNumber(node?.x, startX) - startX;
    const dy = safeNumber(node?.y, startY) - startY;
    return clamp((Math.hypot(dx, dy) - 10) / 96, 0, 1);
  }

  function encounterBandForProgress(progress) {
    if (progress < 0.28) return 'near';
    if (progress < 0.58) return 'mid';
    if (progress < 0.78) return 'deep';
    return 'outer';
  }

  function desiredCountCap(zoneId, spawn, node, game) {
    if (zoneId !== 'dark_woods') return 60;
    const progress = overworldProgress(game, zoneId, node);
    const ids = Array.isArray(spawn.mobIds) ? spawn.mobIds : [];
    const named = Boolean(spawn.elite) || ids.some(id => String(id).includes('named') || String(id).includes('elder') || String(id).includes('lumen') || String(id).includes('briarback'));
    if (named) return 1;
    // V0.17.90: tiered-spread encounters carry exact group sizes - honor countMax
    // (solo has countMax 1, so this still yields 1 for solo roamers).
    if (spawn.exactCount) return Math.max(1, Math.floor(safeNumber(spawn.countMax, 3)));
    const kind = String(spawn.encounterKind || '').toLowerCase();
    if (kind === 'solo_roamer') return 1;
    if (kind === 'camp') return Math.max(1, Math.min(4, Math.floor(safeNumber(spawn.countMax, 3))));
    if (kind === 'roaming_group') return Math.max(1, Math.min(3, Math.floor(safeNumber(spawn.countMax, 3))));
    const id = String(spawn.id || spawn.spawnId || '');
    if (id.includes('ashroot')) return progress >= 0.78 ? 2 : 1;
    if (id.includes('deep_mixed')) return progress >= 0.78 ? 3 : 2;
    if (id.includes('hollow_stags')) return progress >= 0.62 ? 3 : 2;
    if (progress < 0.28) return 3;
    if (progress < 0.58) return 4;
    return 3;
  }

  function weightedPick(entries) {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight || 0), 0);
    if (total <= 0) return entries[0]?.id || null;
    let roll = Math.random() * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight || 0);
      if (roll <= 0) return entry.id;
    }
    return entries[entries.length - 1]?.id || null;
  }

  function defaultState() {
    return { version: DARK_WOODS_POPULATION_VERSION, zones: { dark_woods: { spawns: {} } } };
  }

  function normalizeState(raw) {
    const state = defaultState();
    state.version = Math.max(DARK_WOODS_POPULATION_VERSION, Math.floor(safeNumber(raw?.version, 1)));
    if (!raw || typeof raw !== 'object') return state;
    const zones = raw.zones && typeof raw.zones === 'object' ? raw.zones : {};
    for (const zoneId of new Set(['dark_woods', ...Object.keys(zones)])) {
      const zone = zones[zoneId] && typeof zones[zoneId] === 'object' ? zones[zoneId] : {};
      const spawns = zone.spawns && typeof zone.spawns === 'object' ? zone.spawns : {};
      if (!state.zones[zoneId]) state.zones[zoneId] = { spawns: {} };
      state.zones[zoneId].spawns = {};
      for (const [spawnKey, record] of Object.entries(spawns)) {
        if (!record || typeof record !== 'object') continue;
        const desiredCount = clamp(Math.floor(safeNumber(record.desiredCount, 1)), 0, 60);
        const slots = record.slots && typeof record.slots === 'object' ? record.slots : {};
        state.zones[zoneId].spawns[spawnKey] = { desiredCount, slots: {} };
        for (const [slotId, slot] of Object.entries(slots)) {
          if (!slot || typeof slot !== 'object') continue;
          state.zones[zoneId].spawns[spawnKey].slots[slotId] = {
            mobId: slot.mobId || null,
            level: Math.max(1, Math.floor(safeNumber(slot.level, 1))),
            dead: Boolean(slot.dead),
            respawnAt: Math.max(0, Math.floor(safeNumber(slot.respawnAt, 0))),
            x: Number.isFinite(Number(slot.x)) ? Number(slot.x) : null,
            y: Number.isFinite(Number(slot.y)) ? Number(slot.y) : null
          };
        }
      }
    }
    return state;
  }

  function zoneIdFromRuntime(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function zoneMap(game, zoneId) {
    return zoneId !== 'dark_woods' ? game.caveMap : game.overworldMap;
  }

  function zoneObjects(game, zoneId) {
    return zoneId !== 'dark_woods' ? game.caveObjects : game.overworldObjects;
  }

  function zoneEnemyArray(game, zoneId) {
    return zoneId !== 'dark_woods' ? game.caveEnemies : game.overworldEnemies;
  }

  function attrKey(x, y) {
    return `${Math.floor(x)},${Math.floor(y)}`;
  }

  function spawnNodeKey(zoneId, node) {
    return `${zoneId}:${Math.floor(safeNumber(node.x))},${Math.floor(safeNumber(node.y))}:${node.spawnId || node.id || 'spawn'}`;
  }

  function currentSpawnGrid(game, zoneId) {
    game.editorMobSpawns = game.editorMobSpawns || { dark_woods: {} };
    game.editorMobSpawns.dark_woods = game.editorMobSpawns.dark_woods || {};
    if (!game.editorMobSpawns[zoneId]) game.editorMobSpawns[zoneId] = {};
    return game.editorMobSpawns[zoneId];
  }

  function spawnDef(game, nodeOrId) {
    const id = typeof nodeOrId === 'string' ? nodeOrId : (nodeOrId?.spawnId || nodeOrId?.id);
    const def = game.editorMobSpawnDefinitions?.[id] || DR.MOB_SPAWN_BY_ID?.[id] || null;
    if (typeof nodeOrId === 'object') return { ...(def || {}), ...(nodeOrId || {}), id: id || def?.id };
    return def;
  }

  function mobDef(game, mobId) {
    return game.editorMobDefinitions?.[mobId] || DR.MOB_DRAFT_BY_ID?.[mobId] || null;
  }

  function makeSpawnNode(game, zoneId, x, y, spawnInput) {
    const placement = typeof spawnInput === 'object' && spawnInput ? spawnInput : { spawnId: spawnInput };
    const def = spawnDef(game, placement.spawnId || placement.id);
    if (!def) return null;
    let countMin = Math.max(1, Math.floor(safeNumber(placement.countMin ?? def.countMin, 1)));
    let countMax = Math.max(countMin, Math.floor(safeNumber(placement.countMax ?? def.countMax, countMin)));
    ({ countMin, countMax } = scaleDarkWoodsCountPair(zoneId, placement, def, countMin, countMax));
    return {
      id: placement.id || `${def.id}_${x}_${y}`,
      type: 'mobSpawn',
      spawnId: def.id,
      name: placement.name || def.name || def.id,
      mobIds: Array.isArray(placement.mobIds) ? [...placement.mobIds] : (Array.isArray(def.mobIds) ? [...def.mobIds] : []),
      x,
      y,
      countMin,
      countMax,
      radius: Math.max(1, Math.floor(safeNumber(placement.radius ?? def.radius, 6))),
      respawnSeconds: Math.max(MIN_RESPAWN_SECONDS, Math.floor(safeNumber(placement.respawnSeconds ?? def.respawnSeconds, 90))),
      respawnMin: Number.isFinite(Number(placement.respawnMin)) ? Number(placement.respawnMin) : null,
      respawnMax: Number.isFinite(Number(placement.respawnMax)) ? Number(placement.respawnMax) : null,
      levelMin: Math.max(1, Math.floor(safeNumber(placement.levelMin ?? def.levelMin, 1))),
      levelMax: Math.max(1, Math.floor(safeNumber(placement.levelMax ?? def.levelMax, def.levelMin || 1))),
      faction: placement.faction || def.faction || 'hostile',
      lootTableId: placement.lootTableId || def.lootTableId || null,
      color: placement.color || def.color || '#d981ff',
      label: placement.label || def.label || 'M',
      notes: placement.notes || def.notes || '',
      encounterKind: placement.encounterKind || 'anchor',
      encounterId: placement.encounterId || placement.id || `${def.id}_${x}_${y}`,
      encounterType: placement.encounterType || null,
      exactCount: Boolean(placement.exactCount || def.exactCount),
      roamRadius: Math.max(2, safeNumber(placement.roamRadius ?? placement.patrolRadius ?? def.roamRadius, placement.encounterKind === 'solo_roamer' ? 9 : 6)),
      patrolRadius: Math.max(2, safeNumber(placement.patrolRadius ?? placement.roamRadius ?? def.patrolRadius, placement.encounterKind === 'solo_roamer' ? 9 : 6)),
      leashRadius: Math.max(8, safeNumber(placement.leashRadius ?? def.leashRadius, placement.encounterKind === 'roaming_group' ? 24 : 16)),
      minSpacing: Math.max(1.8, safeNumber(placement.minSpacing ?? def.minSpacing, placement.encounterKind === 'solo_roamer' ? DARK_WOODS_MIN_SOLO_SPACING_TILES : 4.75)),
      minCampSpacing: Math.max(0, safeNumber(placement.minCampSpacing ?? def.minCampSpacing, placement.encounterKind === 'camp' ? DARK_WOODS_MIN_CAMP_SPACING_TILES : 0)),
      avoidRoads: placement.avoidRoads !== false,
      noSpawnNearTown: placement.noSpawnNearTown ?? def.noSpawnNearTown ?? true,
      autoSeeded: placement.autoSeeded === true
    };
  }

  function allSpawnNodes(game, zoneId) {
    const grid = currentSpawnGrid(game, zoneId);
    const nodes = [];
    for (const [key, raw] of Object.entries(grid)) {
      if (!raw || raw.enabled === false || !raw.spawnId) continue;
      const [rawX, rawY] = key.split(',');
      const x = Number.isFinite(Number(raw.x)) ? Number(raw.x) : Number(rawX);
      const y = Number.isFinite(Number(raw.y)) ? Number(raw.y) : Number(rawY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      nodes.push({ ...raw, x, y });
    }
    nodes.sort((a, b) => (a.y - b.y) || (a.x - b.x) || String(a.spawnId).localeCompare(String(b.spawnId)));
    return nodes;
  }

  function ensureDefaultMobSpawnPlacements(game) {
    for (const zoneId of ['dark_woods']) {
      const grid = currentSpawnGrid(game, zoneId);
      const desiredKeys = new Set();
      for (const placement of darkWoodsAllDefaultPlacements().filter(p => p.zone === zoneId)) {
        const key = attrKey(placement.x, placement.y);
        desiredKeys.add(key);
        const node = makeSpawnNode(game, zoneId, placement.x, placement.y, placement);
        if (!node) continue;
        node.autoSeeded = true;
        node.populationVersion = DARK_WOODS_POPULATION_VERSION;

        if (grid[key]?.spawnId) {
          const existing = grid[key];
          if (existing.autoSeeded === true || existing.spawnId === node.spawnId) {
            grid[key] = { ...existing, ...node, enabled: existing.enabled !== false };
          }
          continue;
        }
        grid[key] = node;
      }

      // V0.15.04: remove surplus generated solo/group anchors left by older higher-density saves.
      for (const [key, node] of Object.entries(grid)) {
        if (!node || node.enabled === false) continue;
        if (node.autoSeeded === true && node.populationVersion !== DARK_WOODS_POPULATION_VERSION && !desiredKeys.has(key)) {
          delete grid[key];
        }
      }
    }
  }

  function markerSignature(game, zoneId) {
    return allSpawnNodes(game, zoneId).map(node => {
      const def = spawnDef(game, node) || node;
      const ids = Array.isArray(def.mobIds) ? def.mobIds.join('|') : '';
      return [Math.floor(safeNumber(node.x)), Math.floor(safeNumber(node.y)), node.spawnId, ids, def.countMin, def.countMax, def.radius, def.respawnSeconds, def.levelMin, def.levelMax, def.lootTableId].join(':');
    }).join(';');
  }

  function normalizeGold(value) {
    if (value && typeof value === 'object') {
      const min = Math.max(0, Math.floor(safeNumber(value.min, 0)));
      const max = Math.max(min, Math.floor(safeNumber(value.max, min)));
      return randInt(min, max);
    }
    return Math.max(0, Math.floor(safeNumber(value, 0)));
  }

  function makeEnemyType(game, draft, spawn, level) {
    const elite = Boolean(draft.elite || spawn.elite);
    const rare = Boolean(draft.rare || spawn.rare || draft.rareNameplate || spawn.rareNameplate);
    const named = Boolean(draft.named || spawn.named);
    const boss = Boolean(draft.boss || spawn.boss);
    const eliteScale = elite ? 1.35 : 1;
    return {
      id: draft.id,
      name: draft.name || draft.id || 'Enemy',
      color: draft.color || spawn.color || '#d4665a',
      rendererId: draft.rendererId || draft.visualRenderer || spawn.rendererId || null,
      mobVisualKey: draft.mobVisualKey || draft.visualKey || spawn.mobVisualKey || null,
      visualScale: Number.isFinite(Number(draft.visualScale)) ? Number(draft.visualScale) : (Number.isFinite(Number(spawn.visualScale)) ? Number(spawn.visualScale) : 1),
      animationProfile: draft.animationProfile || spawn.animationProfile || null,
      hp: Math.max(1, Math.floor(safeNumber(draft.hp, 30) * eliteScale)),
      attack: Math.max(1, Math.floor(safeNumber(draft.attack, 5) * eliteScale)),
      defense: Math.max(0, Math.floor(safeNumber(draft.defense, 1) * eliteScale)),
      speed: Math.max(0.4, safeNumber(draft.speed, 1.6)),
      xp: Math.max(1, Math.floor(safeNumber(draft.xp, 8) * eliteScale)),
      gold: normalizeGold(draft.gold),
      lootTableId: spawn.lootTableId || draft.lootTableId || null,
      aggroRadius: safeNumber(draft.aggroRadius || spawn.aggroRadius, elite ? 8 : 6),
      leashRadius: safeNumber(draft.leashRadius || spawn.leashRadius, elite ? 18 : 12),
      // Phase 4 (NPC AI/Spawn/Leash/Loot Ownership): optional per-mob flee
      // HP ratio (0-1), consumed by Enemy.prototype.tryLowHealthTactic in
      // entities/enemy.js. null when undeclared, which keeps that
      // function's existing hardcoded 0.18 fallback - no shipped draft
      // sets this today.
      fleeHp: Number.isFinite(Number(draft.fleeHp)) && Number(draft.fleeHp) > 0 && Number(draft.fleeHp) < 1 ? Number(draft.fleeHp) : null,
      assistRadius: Math.max(3.0, safeNumber(draft.assistRadius || spawn.assistRadius, elite ? 5.4 : 4.6)),
      respawnSeconds: Math.max(MIN_RESPAWN_SECONDS, Math.floor(safeNumber(spawn.respawnSeconds || draft.respawnSeconds, 45))),
      elite,
      rare,
      named,
      boss,
      family: draft.family || null,
      zoneRole: draft.zoneRole || spawn.zoneRole || null,
      aiProfile: draft.aiProfile || spawn.aiProfile || (elite ? 'elite' : 'basic'),
      threatTag: draft.threatTag || spawn.threatTag || (elite ? 'Elite' : 'Melee'),
      abilities: Array.isArray(draft.abilities) ? [...draft.abilities] : [],
      turnAbilities: Array.isArray(draft.turnAbilities) ? cloneJson(draft.turnAbilities) : [],
      lootRolls: Math.max(1, Math.floor(safeNumber(draft.lootRolls || spawn.lootRolls, elite ? 2 : 1))),
      rareNameplate: Boolean(draft.rareNameplate || spawn.rareNameplate),
      encounterWeight: Math.max(1, Math.floor(safeNumber(draft.encounterWeight || spawn.encounterWeight, elite ? 3 : 1)))
    };
  }

  function isTileBlockedForZone(game, zoneId, x, y) {
    const map = zoneMap(game, zoneId);
    const tile = map?.[y]?.[x];
    if (!tile) return true;
    const tileType = String(tile.type || '').toLowerCase();
    const waterType = (window.DreamRealms || {}).TILE?.WATER;
    // The `waterDepth > 0` clause that used to sit on the end of this test is gone: it was an OR, so
    // tile type never gated it, and the 37 non-water tiles carrying stale waterDepth were counted as
    // water. DEFENSIVE ONLY - measured, this changed spawn validity on 0 of those 37 tiles, because
    // they are already rejected further down for other reasons. It is removed because it is the same
    // latent fault that was live in isValidGroundDropTile, not because it was doing damage here.
    if (tile.type === waterType || tileType.includes('water') || tile.deepWater === true) return true;
    if (tile.blocked || tile.solid || tile.collision) return true;
    if (tileType.includes('wall') || tileType.includes('void')) return true;
    const obj = zoneObjects(game, zoneId)?.[y]?.[x];
    if (obj && (obj.blocked || obj.solid || obj.collision)) return true;
    const objectType = String(obj?.type || obj?.kind || obj?.id || '').toLowerCase();
    if (/tree|rock|boulder|wall|cliff|fence|building|stump|solid|blocker/.test(objectType)) return true;
    // Phase 4 (NPC AI/Spawn/Leash/Loot Ownership): this used to be the only
    // tile-validity check mob spawn/roam consulted, and it never read the
    // Layered Map Editor's "Blocked"/"NPC Avoid" painted attributes (a
    // separate attribute store from game.editorAttributes, owned by
    // systems/layered-map-editor-system.js) - a tile painted Blocked or NPC
    // Avoid in the F9/F10 layered map editor had no effect on where mobs
    // could spawn or roam. isTileBlockedForZone is the single choke point
    // both isSafeSpawnTile and isRoamSafeTile call first, so fixing it here
    // covers both spawn placement and roam/patrol validity. Uses an
    // explicit zoneId (via layeredMapAttributeAt's zone parameter) rather
    // than game.layeredMapCanEnter, which always checks the CURRENTLY
    // ACTIVE zone (game.currentZone) with no way to ask about a different
    // zone - important since mob-spawn-system checks tiles by explicit
    // zoneId, which is not always the active zone.
    const layeredAttr = game.layeredMapAttributeAt?.(x, y, zoneId);
    if (layeredAttr?.blocked || layeredAttr?.npcAvoid) return true;
    return false;
  }

  function isSpawnEntranceTile(game, zoneId, x, y) {
    const key = attrKey(x, y);
    const attr = game.editorAttributes?.[zoneId]?.[key] || {};
    if (attr.spawnPoint || attr.warp || attr.entrance || attr.dungeonEntrance || attr.caveEntrance) return true;
    const obj = zoneObjects(game, zoneId)?.[y]?.[x];
    const type = String(obj?.type || obj?.kind || obj?.id || '').toLowerCase();
    if (/cave.?entrance|dungeon.?entrance|portal|warp|zone.?exit/.test(type)) return true;
    return zoneId === 'dark_woods' && (game.caveEntrances || []).some(entrance => Math.floor(Number(entrance?.x)) === x && Math.floor(Number(entrance?.y)) === y);
  }

  function warnSkippedSpawn(game, zoneId, node, slotId, reason = 'no valid ground tile') {
    const key = `${zoneId}:${node?.spawnId || node?.id || 'spawn'}:${Math.floor(safeNumber(node?.x))},${Math.floor(safeNumber(node?.y))}:${slotId}`;
    game.mobSpawnWarningTimes = game.mobSpawnWarningTimes && typeof game.mobSpawnWarningTimes === 'object' ? game.mobSpawnWarningTimes : {};
    const now = Date.now();
    if (now - safeNumber(game.mobSpawnWarningTimes[key], 0) < 10000) return false;
    game.mobSpawnWarningTimes[key] = now;
    const message = `Mob spawn skipped at ${zoneId} ${Math.floor(safeNumber(node?.x))},${Math.floor(safeNumber(node?.y))}: ${reason}.`;
    console.warn(`[Dream Realms] ${message}`);
    game.log?.(message, 'System');
    return true;
  }

  function tooCloseToNpcSafeZone(game, zoneId, x, y) {
    const npcs = game.editorNpcs?.[zoneId] || {};
    for (const node of Object.values(npcs)) {
      if (!node) continue;
      const def = game.editorNpcDefinitions?.[node.npcId] || DR.NPC_DRAFT_BY_ID?.[node.npcId] || {};
      const radius = safeNumber(node.safeZoneRadius ?? def.safeZoneRadius, 0);
      if (radius > 0 && Math.hypot((safeNumber(node.x) + 0.5) - (x + 0.5), (safeNumber(node.y) + 0.5) - (y + 0.5)) <= radius) return true;
    }
    return false;
  }

  function isSpawnOccupied(game, zoneId, x, y, spawnOrIgnoreEnemy = null) {
    const spawn = spawnOrIgnoreEnemy && spawnOrIgnoreEnemy.kind !== 'enemy' ? spawnOrIgnoreEnemy : {};
    const ignoreEnemy = spawnOrIgnoreEnemy && spawnOrIgnoreEnemy.kind === 'enemy' ? spawnOrIgnoreEnemy : (spawn?.ignoreEnemy || null);
    const localSpacing = Math.max(1.8, safeNumber(spawn.minSpacing, zoneId === 'dark_woods' ? 4.25 : 3.0));
    const globalSpacing = Math.max(1.25, localSpacing * 0.62);
    const arr = zoneEnemyArray(game, zoneId) || [];
    for (const enemy of arr) {
      if (!enemy || enemy === ignoreEnemy || !enemy.alive) continue;
      const d = Math.hypot(enemy.x - (x + 0.5), enemy.y - (y + 0.5));
      if (enemy.spawnKey && spawn.spawnKey && enemy.spawnKey === spawn.spawnKey && d < localSpacing) return true;
      if (d < globalSpacing) return true;
    }
    for (const ally of [game.player, game.merc, game.pet, ...(Array.isArray(game.botPlayers) ? game.botPlayers : [])]) {
      if (!ally || !ally.alive) continue;
      if (Math.hypot(ally.x - (x + 0.5), ally.y - (y + 0.5)) < 1.45) return true;
    }
    return false;
  }

  function nearbyAliveEnemyCount(game, zoneId, x, y, radius, options = {}) {
    const arr = zoneEnemyArray(game, zoneId) || [];
    const r = Math.max(0.5, safeNumber(radius, DARK_WOODS_DENSITY_RADIUS_TILES));
    const ignoreEnemy = options.ignoreEnemy || null;
    let count = 0;
    for (const enemy of arr) {
      if (!enemy || enemy === ignoreEnemy || !enemy.alive) continue;
      if (Math.hypot(enemy.x - (x + 0.5), enemy.y - (y + 0.5)) <= r) count += 1;
    }
    return count;
  }

  function exceedsLocalDensityCap(game, zoneId, x, y, spawn = {}) {
    if (zoneId !== 'dark_woods') return false;
    if (spawn?.respawnMode) return false;
    const kind = String(spawn.encounterKind || 'anchor').toLowerCase();
    const cap = DARK_WOODS_DENSITY_CAPS[kind] || DARK_WOODS_DENSITY_CAPS.default;
    const radius = kind === 'solo_roamer' ? 6 : kind === 'roaming_group' ? 7 : DARK_WOODS_DENSITY_RADIUS_TILES;
    return nearbyAliveEnemyCount(game, zoneId, x, y, radius, spawn) >= cap;
  }

  function isRoamSafeTile(game, zoneId, x, y, enemy = null) {
    if (isTileBlockedForZone(game, zoneId, x, y)) return false;
    const tile = zoneMap(game, zoneId)?.[y]?.[x];
    const tileType = tile?.type;
    const DRLocal = window.DreamRealms || {};
    if (zoneId === 'dark_woods' && [DRLocal.TILE?.WATER, DRLocal.TILE?.DEEP_WATER].includes(tileType)) return false;
    const attr = game.editorAttributes?.[zoneId]?.[attrKey(x, y)] || {};
    if (attr.safeZone || attr.noMobSpawn || attr.spawnPoint) return false;
    if (zoneId === 'dark_woods') {
      const startX = DR.CONFIG?.START_X || 100;
      const startY = DR.CONFIG?.START_Y || 100;
      if (Math.hypot(x + 0.5 - startX, y + 0.5 - startY) <= DARK_WOODS_SAFE_SPAWN_RADIUS_TILES) return false;
      if (Math.hypot(x + 0.5 - 87, y + 0.5 - 111) <= DARK_WOODS_SAFE_TOWN_RADIUS_TILES) return false;
      for (const entrance of game.caveEntrances || []) {
        if (Math.hypot(x + 0.5 - entrance.x, y + 0.5 - entrance.y) <= Math.max(DARK_WOODS_CAVE_ENTRANCE_SAFE_RADIUS_TILES, safeNumber(entrance.radius, 3) + 3)) return false;
      }
    }
    if (enemy) {
      const hx = safeNumber(enemy.spawnHomeX || enemy.homeX, enemy.x);
      const hy = safeNumber(enemy.spawnHomeY || enemy.homeY, enemy.y);
      const leash = Math.max(8, safeNumber(enemy.baseType?.leashRadius || enemy.patrolRadius || enemy.roamRadius, 16));
      if (Math.hypot((x + 0.5) - hx, (y + 0.5) - hy) > leash + 1.5) return false;
    }
    return true;
  }

  function isSafeSpawnTile(game, zoneId, x, y, spawn) {
    const map = zoneMap(game, zoneId);
    const height = Array.isArray(map) ? map.length : 0;
    const width = height && Array.isArray(map[0]) ? map[0].length : 0;
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    if (isTileBlockedForZone(game, zoneId, x, y)) return false;
    const tile = zoneMap(game, zoneId)?.[y]?.[x];
    const tileType = tile?.type;
    const DRLocal = window.DreamRealms || {};
    if (zoneId === 'dark_woods' && spawn?.avoidRoads !== false && [DRLocal.TILE?.DIRT, DRLocal.TILE?.CAMP, DRLocal.TILE?.RUIN, DRLocal.TILE?.STONE].includes(tileType)) return false;
    const attr = game.editorAttributes?.[zoneId]?.[attrKey(x, y)] || {};
    if (attr.noMobSpawn || attr.safeZone || attr.spawnPoint || attr.blocked || attr.solid || attr.collision || attr.collisionOnly) return false;
    if (isSpawnEntranceTile(game, zoneId, x, y)) return false;
    if (game.editorNpcs?.[zoneId]?.[attrKey(x, y)]) return false;
    if (tooCloseToNpcSafeZone(game, zoneId, x, y)) return false;
    if (isSpawnOccupied(game, zoneId, x, y, spawn || null)) return false;
    if (zoneId === 'dark_woods') {
      const startX = DR.CONFIG?.START_X || 100;
      const startY = DR.CONFIG?.START_Y || 100;
      if (Math.hypot(x + 0.5 - startX, y + 0.5 - startY) <= DARK_WOODS_SAFE_SPAWN_RADIUS_TILES) return false;
      if (Math.hypot(x + 0.5 - 150, y + 0.5 - 88) <= 8.5) return false;
      if (Math.hypot(x + 0.5 - 87, y + 0.5 - 111) <= DARK_WOODS_SAFE_TOWN_RADIUS_TILES) return false;
      if (spawn?.respawnMode && game.player && Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y) < safeNumber(spawn.minRespawnDistanceFromPlayer, 18)) return false;
      for (const entrance of game.caveEntrances || []) {
        if (Math.hypot(x + 0.5 - entrance.x, y + 0.5 - entrance.y) <= Math.max(DARK_WOODS_CAVE_ENTRANCE_SAFE_RADIUS_TILES, safeNumber(entrance.radius, 3) + 4)) return false;
      }
      if (exceedsLocalDensityCap(game, zoneId, x, y, spawn || {})) return false;
    } else {
      const exit = game.caveExit || { x: DR.CONFIG?.START_X || 100, y: (DR.CONFIG?.START_Y || 100) - 34 };
      if (Math.hypot(x - exit.x, y - (exit.y + 5)) < 12) return false;
    }
    return true;
  }

  function findSpawnTileForZone(game, zoneId, cx, cy, radius, spawn) {
    const candidates = [];
    const rMax = Math.max(1, Math.floor(radius));
    for (let r = 0; r <= rMax; r++) {
      for (let i = 0; i < 32; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        const x = Math.floor(cx + Math.cos(a) * d);
        const y = Math.floor(cy + Math.sin(a) * d);
        if (isSafeSpawnTile(game, zoneId, x, y, spawn)) candidates.push({ x, y });
      }
      if (candidates.length) break;
    }
    if (candidates.length) return candidates[randInt(0, candidates.length - 1)];
    for (let y = Math.floor(cy - rMax); y <= Math.ceil(cy + rMax); y++) {
      for (let x = Math.floor(cx - rMax); x <= Math.ceil(cx + rMax); x++) {
        if (Math.hypot(x - cx, y - cy) <= rMax && isSafeSpawnTile(game, zoneId, x, y, spawn)) return { x, y };
      }
    }
    for (let r = rMax + 1; r <= rMax + 24; r++) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (Math.hypot(x - cx, y - cy) <= r && isSafeSpawnTile(game, zoneId, x, y, spawn)) return { x, y };
        }
      }
    }
    const fallbackX = Math.floor(cx);
    const fallbackY = Math.floor(cy);
    return isSafeSpawnTile(game, zoneId, fallbackX, fallbackY, spawn) ? { x: fallbackX, y: fallbackY } : null;
  }

  function chooseMobId(game, spawn, slotRecord, zoneId = 'dark_woods', node = null) {
    const ids = Array.isArray(spawn.mobIds) ? spawn.mobIds.filter(id => mobDef(game, id)) : [];
    if (slotRecord?.mobId && ids.includes(slotRecord.mobId)) return slotRecord.mobId;
    if (!ids.length) return null;
    if (ids.length === 1 || zoneId !== 'dark_woods') return ids[randInt(0, ids.length - 1)];

    const progress = overworldProgress(game, zoneId, node);
    const centerLevel = clamp(Math.round(1 + progress * 9), 1, 10);
    const weighted = ids.map(id => {
      const draft = mobDef(game, id) || {};
      const min = Math.max(1, Math.floor(safeNumber(draft.levelMin, 1)));
      const max = Math.max(min, Math.floor(safeNumber(draft.levelMax, min)));
      const center = (min + max) / 2;
      const mismatch = Math.abs(center - centerLevel);
      let weight = Math.max(1, safeNumber(draft.encounterWeight, 1)) / Math.max(1, mismatch + 0.75);
      if (draft.elite || String(draft.zoneRole || '').includes('elite') || String(id).includes('ashroot')) {
        weight *= progress >= 0.78 ? 0.55 : progress >= 0.62 ? 0.22 : 0.06;
      }
      if (min > centerLevel + 2) weight *= 0.28;
      if (max < centerLevel - 3) weight *= 0.45;
      return { id, weight };
    });
    return weightedPick(weighted);
  }

  function chooseLevel(spawn, draft, slotRecord, game, zoneId, node) {
    const min = Math.max(1, Math.floor(safeNumber(spawn.levelMin ?? draft.levelMin, 1)));
    const max = Math.max(min, Math.floor(safeNumber(spawn.levelMax ?? draft.levelMax, min)));
    if (slotRecord && Number.isFinite(Number(slotRecord.level))) {
      const stored = Math.max(1, Math.floor(Number(slotRecord.level)));
      if (zoneId !== 'dark_woods' || (stored >= min && stored <= max)) return stored;
    }
    if (zoneId === 'dark_woods') {
      const progress = overworldProgress(game, zoneId, node);
      const centerLevel = clamp(Math.round(1 + progress * 9), 1, 10);
      const bandMin = Math.max(min, centerLevel - 1);
      const bandMax = Math.min(max, centerLevel + 1);
      return bandMin <= bandMax ? randInt(bandMin, bandMax) : randInt(min, max);
    }
    return randInt(min, max);
  }

  function ensureZoneRuntimeState(game, zoneId) {
    game.mobSpawnRuntimeState = normalizeState(game.mobSpawnRuntimeState);
    if (!game.mobSpawnRuntimeState.zones[zoneId]) game.mobSpawnRuntimeState.zones[zoneId] = { spawns: {} };
    return game.mobSpawnRuntimeState.zones[zoneId];
  }

  function buildSlotEnemy(game, zoneId, node, spawn, spawnRecord, slotIndex) {
    const slotId = String(slotIndex);
    const slotRecord = spawnRecord.slots[slotId] || {};
    const mobId = chooseMobId(game, spawn, slotRecord, zoneId, node);
    if (!mobId) return null;
    const draft = mobDef(game, mobId);
    if (!draft) return null;
    const level = chooseLevel(spawn, draft, slotRecord, game, zoneId, node);
    const type = makeEnemyType(game, draft, spawn, level);
    const pos = Number.isFinite(Number(slotRecord.x)) && Number.isFinite(Number(slotRecord.y)) && isSafeSpawnTile(game, zoneId, Math.floor(slotRecord.x), Math.floor(slotRecord.y), spawn)
      ? { x: Math.floor(slotRecord.x), y: Math.floor(slotRecord.y) }
      : findSpawnTileForZone(game, zoneId, safeNumber(node.x), safeNumber(node.y), safeNumber(spawn.radius, 6), spawn);
    if (!pos) {
      warnSkippedSpawn(game, zoneId, node, slotId);
      return null;
    }
    const enemy = new DR.Enemy(type, pos.x + 0.5, pos.y + 0.5, level);
    enemy.mobDraftId = mobId;
    enemy.spawnGroupId = node.spawnId || spawn.id;
    enemy.spawnKey = spawnNodeKey(zoneId, node);
    enemy.spawnSlotId = slotId;
    enemy.spawnSlotKey = `${enemy.spawnKey}:${slotId}`;
    enemy.spawnZoneId = zoneId;
    enemy.encounterId = enemy.spawnKey;
    enemy.encounterBand = encounterBandForProgress(overworldProgress(game, zoneId, node));
    enemy.encounterKind = spawn.encounterKind || node.encounterKind || 'anchor';
    enemy.encounterType = spawn.encounterType || node.encounterType || null;
    enemy.roamRadius = Math.max(2, safeNumber(spawn.roamRadius || node.roamRadius, enemy.encounterKind === 'solo_roamer' ? 9 : 6));
    enemy.respawnMin = Number.isFinite(Number(spawn.respawnMin)) ? Number(spawn.respawnMin) : null;
    enemy.respawnMax = Number.isFinite(Number(spawn.respawnMax)) ? Number(spawn.respawnMax) : null;
    enemy.patrolRadius = Math.max(2, safeNumber(spawn.patrolRadius || spawn.roamRadius || node.patrolRadius, enemy.roamRadius));
    enemy.roamingGroupId = enemy.encounterKind === 'roaming_group' ? (spawn.encounterId || node.encounterId || enemy.spawnKey) : null;
    enemy.groupLeaderSlotId = enemy.roamingGroupId ? '0' : null;
    enemy.assistRadius = Math.max(3.25, safeNumber(type.assistRadius || spawn.assistRadius, enemy.elite ? 5.6 : 4.8));
    enemy.baseType.leashRadius = Math.max(enemy.baseType.leashRadius || 0, safeNumber(spawn.leashRadius, enemy.encounterKind === 'roaming_group' ? 24 : enemy.baseType.leashRadius || 14));
    enemy.spawnHomeX = safeNumber(node.x) + 0.5;
    enemy.spawnHomeY = safeNumber(node.y) + 0.5;
    enemy.homeX = pos.x + 0.5;
    enemy.homeY = pos.y + 0.5;
    enemy.lootTableId = spawn.lootTableId || draft.lootTableId || null;
    enemy.respawnTimer = Number.POSITIVE_INFINITY;
    enemy.noSelfRespawn = true;
    enemy.elite = Boolean(type.elite);
    enemy.rare = Boolean(type.rare || type.rareNameplate);
    enemy.named = Boolean(type.named);
    enemy.boss = Boolean(type.boss);
    enemy.mobBalanceTier = enemy.boss ? 'boss' : enemy.elite ? 'elite' : enemy.named ? 'named' : enemy.rare ? 'rare' : (enemy.mobBalanceTier || 'standard');
    enemy.lootRolls = Math.max(1, Math.floor(safeNumber(type.lootRolls, enemy.elite || enemy.rare || enemy.named || enemy.boss ? 2 : 1)));
    enemy.rareNameplate = Boolean(type.rareNameplate || type.rare);
    if (slotRecord.dead && safeNumber(slotRecord.respawnAt, 0) > Date.now()) {
      enemy.alive = false;
      enemy.hp = 0;
      enemy.deadTimer = 0;
    }
    spawnRecord.slots[slotId] = {
      mobId,
      level,
      dead: !enemy.alive,
      respawnAt: enemy.alive ? 0 : Math.max(Date.now() + 1000, safeNumber(slotRecord.respawnAt, Date.now() + darkWoodsRespawnSeconds(spawn, enemy) * 1000)),
      x: pos.x,
      y: pos.y
    };
    return enemy;
  }

  function auditZonePopulation(game, zoneId = 'dark_woods') {
    const enemies = zoneEnemyArray(game, zoneId) || [];
    const summary = {
      zoneId,
      total: enemies.length,
      alive: 0,
      invalid: 0,
      blocked: 0,
      townUnsafe: 0,
      spawnUnsafe: 0,
      caveEntranceUnsafe: 0,
      playerRespawnUnsafe: 0,
      nearRoad: 0,
      overcrowded: 0,
      byKind: {},
      byBand: {}
    };
    const startX = DR.CONFIG?.START_X || 100;
    const startY = DR.CONFIG?.START_Y || 100;
    for (const enemy of enemies) {
      if (!enemy) { summary.invalid += 1; continue; }
      if (enemy.alive) summary.alive += 1;
      const x = Math.floor(enemy.x);
      const y = Math.floor(enemy.y);
      const kind = enemy.encounterKind || 'anchor';
      const band = enemy.encounterBand || 'unknown';
      summary.byKind[kind] = (summary.byKind[kind] || 0) + 1;
      summary.byBand[band] = (summary.byBand[band] || 0) + 1;
      if (isTileBlockedForZone(game, zoneId, x, y)) summary.blocked += 1;
      if (zoneId === 'dark_woods') {
        if (Math.hypot(enemy.x - 87, enemy.y - 111) <= DARK_WOODS_SAFE_TOWN_RADIUS_TILES) summary.townUnsafe += 1;
        if (Math.hypot(enemy.x - startX, enemy.y - startY) <= DARK_WOODS_SAFE_SPAWN_RADIUS_TILES) summary.spawnUnsafe += 1;
        if (game.player?.alive && Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y) < 9) summary.playerRespawnUnsafe += 1;
        const tileType = zoneMap(game, zoneId)?.[y]?.[x]?.type;
        const DRLocal = window.DreamRealms || {};
        if ([DRLocal.TILE?.DIRT, DRLocal.TILE?.CAMP, DRLocal.TILE?.RUIN, DRLocal.TILE?.STONE].includes(tileType) && enemy.encounterKind !== 'road_threat') summary.nearRoad += 1;
        for (const entrance of game.caveEntrances || []) {
          if (Math.hypot(enemy.x - entrance.x, enemy.y - entrance.y) <= Math.max(DARK_WOODS_CAVE_ENTRANCE_SAFE_RADIUS_TILES, safeNumber(entrance.radius, 3) + 4)) {
            summary.caveEntranceUnsafe += 1;
            break;
          }
        }
        const cap = DARK_WOODS_DENSITY_CAPS[String(kind).toLowerCase()] || DARK_WOODS_DENSITY_CAPS.default;
        const radius = kind === 'solo_roamer' ? 6 : kind === 'roaming_group' ? 7 : DARK_WOODS_DENSITY_RADIUS_TILES;
        if (nearbyAliveEnemyCount(game, zoneId, x, y, radius, { ignoreEnemy: enemy }) >= cap) summary.overcrowded += 1;
      }
    }
    summary.hardIssues = summary.invalid + summary.blocked + summary.townUnsafe + summary.spawnUnsafe + summary.caveEntranceUnsafe;
    summary.softIssues = summary.overcrowded + summary.nearRoad + summary.playerRespawnUnsafe;
    summary.issues = summary.hardIssues;
    return summary;
  }

  function repairInvalidZoneSlots(game, zoneId = 'dark_woods') {
    const zoneState = ensureZoneRuntimeState(game, zoneId);
    let cleared = 0;
    const nodes = allSpawnNodes(game, zoneId);
    const nodeByKey = new Map(nodes.map(node => [spawnNodeKey(zoneId, node), node]));
    for (const [spawnKey, spawnRecord] of Object.entries(zoneState.spawns || {})) {
      const node = nodeByKey.get(spawnKey);
      const spawn = spawnDef(game, node || spawnRecord?.spawnId || spawnKey) || {};
      if (!spawnRecord?.slots) continue;
      for (const [slotId, slot] of Object.entries(spawnRecord.slots)) {
        if (!slot || !Number.isFinite(Number(slot.x)) || !Number.isFinite(Number(slot.y))) continue;
        const x = Math.floor(Number(slot.x));
        const y = Math.floor(Number(slot.y));
        if (!isSafeSpawnTile(game, zoneId, x, y, { ...spawn, ignoreEnemy: null })) {
          delete slot.x;
          delete slot.y;
          cleared += 1;
        }
      }
    }
    return cleared;
  }

  function createRuntimeApi(game) {
    return {
      version: DARK_WOODS_POPULATION_VERSION,
      darkWoodsPopulationTargetMultiplier: DARK_WOODS_TARGET_MOB_COUNT_MULTIPLIER,
      darkWoodsStructuredPlacementCount() { return darkWoodsStructuredPlacements().length; },
      canSpawnDarkWoodsMobAt(x, y, options = {}) { return isSafeSpawnTile(game, 'dark_woods', Math.floor(x), Math.floor(y), options || {}); },
      isValidMobSpawnTile(zoneId, x, y, options = {}) { return isSafeSpawnTile(game, zoneId, Math.floor(x), Math.floor(y), options || {}); },
      findValidMobSpawnNear(zoneId, x, y, radius = 8, options = {}) {
        const position = findSpawnTileForZone(game, zoneId, Number(x), Number(y), radius, options || {});
        if (!position && options.warnIfMissing) warnSkippedSpawn(game, zoneId, { x, y, spawnId: options.spawnId || 'runtime_spawn' }, options.slotId || 'runtime');
        return position;
      },
      canRoamDarkWoodsMobAt(x, y, enemy = null) { return isRoamSafeTile(game, 'dark_woods', Math.floor(x), Math.floor(y), enemy || null); },
      auditZone(zoneId = 'dark_woods') { return auditZonePopulation(game, zoneId); },
      repairInvalidSlots(zoneId = 'dark_woods') { return repairInvalidZoneSlots(game, zoneId); },
      ensureDefaultMobSpawnPlacements() {
        ensureDefaultMobSpawnPlacements(game);
      },
      serializeState() {
        return cloneJson(game.mobSpawnRuntimeState || defaultState());
      },
      importState(raw) {
        game.mobSpawnRuntimeState = normalizeState(raw);
        game.pendingMobSpawnRuntimeState = null;
        this.zoneSignatures = {};
      },
      zoneSignatures: {},
      activeSignature(zoneId) {
        return markerSignature(game, zoneId);
      },
      rebuildZone(zoneId, options = {}) {
        this.ensureDefaultMobSpawnPlacements();
        game.mobSpawnRuntimeState = normalizeState(game.mobSpawnRuntimeState || game.pendingMobSpawnRuntimeState);
        const zoneState = ensureZoneRuntimeState(game, zoneId);
        const target = zoneEnemyArray(game, zoneId);
        const activeZoneId = zoneIdFromRuntime(game);
        const nodes = allSpawnNodes(game, zoneId);
        if (zoneId !== 'dark_woods' && Array.isArray(target) && target.some(enemy => enemy?.caveEnemy)) {
          if (zoneId === activeZoneId) game.setActiveEnemySet(target);
          this.zoneSignatures[zoneId] = `generated-cave:${zoneId}:${target.length}`;
          return target.length;
        }
        const previous = new Set(target.filter(enemy => enemy?.spawnZoneId === zoneId));
        for (const enemy of previous) {
          const index = game.entities.indexOf(enemy);
          if (index >= 0) game.entities.splice(index, 1);
        }
        target.length = 0;

        for (const node of nodes) {
          const spawn = spawnDef(game, node);
          if (!spawn || !Array.isArray(spawn.mobIds) || !spawn.mobIds.length) continue;
          const spawnKey = spawnNodeKey(zoneId, node);
          spawn.spawnKey = spawnKey;
          spawn.minSpacing = Math.max(safeNumber(spawn.minSpacing, 0), zoneId === 'dark_woods' ? 4.75 : 3.0);
          spawn.radius = Math.max(safeNumber(spawn.radius, 6), zoneId === 'dark_woods' ? 10 : 6);
          const densityMultiplier = zoneId === 'dark_woods' ? 1.0 : 1;
          const min = Math.max(0, Math.floor(safeNumber(spawn.countMin, 1) * densityMultiplier));
          const max = Math.max(min, Math.floor(safeNumber(spawn.countMax, spawn.countMin || 1) * densityMultiplier));
          const spawnRecord = zoneState.spawns[spawnKey] || { desiredCount: randInt(min, max), slots: {} };
          if (options.rerollCounts || !Number.isFinite(Number(spawnRecord.desiredCount))) spawnRecord.desiredCount = randInt(min, max);
          if (zoneId === 'dark_woods' && spawnRecord.desiredCount < min) spawnRecord.desiredCount = randInt(min, max);
          const maxPerAnchor = zoneId === 'dark_woods' ? Math.max(min, Math.min(max, desiredCountCap(zoneId, spawn, node, game))) : max;
          spawnRecord.desiredCount = clamp(Math.floor(spawnRecord.desiredCount), min, maxPerAnchor);
          spawnRecord.slots = spawnRecord.slots && typeof spawnRecord.slots === 'object' ? spawnRecord.slots : {};
          zoneState.spawns[spawnKey] = spawnRecord;

          for (let i = 0; i < spawnRecord.desiredCount; i++) {
            const enemy = buildSlotEnemy(game, zoneId, node, spawn, spawnRecord, i);
            if (!enemy) continue;
            target.push(enemy);
          }
        }

        if (zoneId === activeZoneId) game.setActiveEnemySet(target);
        this.lastAudit = auditZonePopulation(game, zoneId);
        if (zoneId === 'dark_woods' && options.repairInvalid && this.lastAudit.issues > 0) {
          const cleared = repairInvalidZoneSlots(game, zoneId);
          if (cleared > 0) return this.rebuildZone(zoneId, { ...options, repairInvalid: false, rerollCounts: false });
        }
        this.zoneSignatures[zoneId] = this.activeSignature(zoneId);
        return target.length;
      },
      ensureZone(zoneId) {
        this.ensureDefaultMobSpawnPlacements();
        const signature = this.activeSignature(zoneId);
        if (this.zoneSignatures[zoneId] !== signature) this.rebuildZone(zoneId);
      },
      noteDeadEnemy(enemy) {
        if (!enemy?.spawnZoneId || !enemy.spawnKey || enemy.spawnSlotId == null) return;
        const zoneState = ensureZoneRuntimeState(game, enemy.spawnZoneId);
        const spawnRecord = zoneState.spawns[enemy.spawnKey];
        if (!spawnRecord) return;
        const slot = spawnRecord.slots[String(enemy.spawnSlotId)] || {};
        if (slot.dead && safeNumber(slot.respawnAt, 0) > Date.now()) return;
        const spawn = { ...(spawnDef(game, enemy.spawnGroupId) || spawnDef(game, { spawnId: enemy.spawnGroupId }) || {}), encounterKind: enemy.encounterKind, respawnMin: enemy.respawnMin, respawnMax: enemy.respawnMax };
        const respawnMs = darkWoodsRespawnSeconds(spawn, enemy) * 1000;
        spawnRecord.slots[String(enemy.spawnSlotId)] = {
          mobId: enemy.mobDraftId || slot.mobId || null,
          level: enemy.level || slot.level || 1,
          dead: true,
          respawnAt: Date.now() + respawnMs,
          x: Math.floor(enemy.x),
          y: Math.floor(enemy.y)
        };
      },
      respawnEnemy(enemy) {
        if (!enemy?.spawnZoneId || !enemy.spawnKey || enemy.spawnSlotId == null) return false;
        const node = allSpawnNodes(game, enemy.spawnZoneId).find(n => spawnNodeKey(enemy.spawnZoneId, n) === enemy.spawnKey);
        const spawn = { ...(spawnDef(game, node || enemy.spawnGroupId) || {}), ignoreEnemy: enemy, respawnMode: true, minRespawnDistanceFromPlayer: 18, encounterKind: enemy.encounterKind };
        const pos = findSpawnTileForZone(game, enemy.spawnZoneId, safeNumber(node?.x, enemy.spawnHomeX || enemy.homeX), safeNumber(node?.y, enemy.spawnHomeY || enemy.homeY), safeNumber(spawn.radius, 6), spawn);
        if (!pos) {
          warnSkippedSpawn(game, enemy.spawnZoneId, node || { x: enemy.spawnHomeX, y: enemy.spawnHomeY, spawnId: enemy.spawnGroupId }, enemy.spawnSlotId, 'no valid respawn ground tile');
          return false;
        }
        if (isSpawnOccupied(game, enemy.spawnZoneId, pos.x, pos.y, { ...spawn, ignoreEnemy: enemy, spawnKey: enemy.spawnKey })) return false;
        enemy.x = pos.x + 0.5;
        enemy.y = pos.y + 0.5;
        enemy.homeX = enemy.x;
        enemy.homeY = enemy.y;
        enemy.hp = enemy.maxHp;
        enemy.alive = true;
        enemy.deadTimer = 0;
        enemy.aggro = false;
        const zoneState = ensureZoneRuntimeState(game, enemy.spawnZoneId);
        const slot = zoneState.spawns[enemy.spawnKey]?.slots?.[String(enemy.spawnSlotId)];
        if (slot) {
          slot.dead = false;
          slot.respawnAt = 0;
          slot.x = pos.x;
          slot.y = pos.y;
        }
        game.spawnRing?.(enemy.x, enemy.y, enemy.color || enemy.baseType?.color || '#d4665a', enemy.elite ? 18 : 12);
        return true;
      },
      update(dt) {
        if (!game.started) return;
        const zoneId = zoneIdFromRuntime(game);
        this.ensureZone(zoneId);
        const now = Date.now();
        this._respawnScanAccumulatorMs = safeNumber(this._respawnScanAccumulatorMs, 0) + Math.max(0, safeNumber(dt, 0)) * 1000;
        if (this._respawnScanAccumulatorMs < DARK_WOODS_RESPAWN_SCAN_INTERVAL_MS) return;
        this._respawnScanAccumulatorMs = 0;
        const enemies = zoneEnemyArray(game, zoneId) || [];
        if (!Number.isFinite(this._respawnScanCursor)) this._respawnScanCursor = 0;
        const budget = Math.min(enemies.length, zoneId === 'dark_woods' ? DARK_WOODS_RESPAWN_SCAN_BUDGET : enemies.length);
        for (let checked = 0; checked < budget; checked++) {
          if (!enemies.length) break;
          const index = this._respawnScanCursor % enemies.length;
          this._respawnScanCursor = (index + 1) % Math.max(1, enemies.length);
          const enemy = enemies[index];
          if (!enemy?.spawnSlotKey) continue;
          if (!enemy.alive) {
            const zoneState = ensureZoneRuntimeState(game, zoneId);
            const slot = zoneState.spawns[enemy.spawnKey]?.slots?.[String(enemy.spawnSlotId)];
            if (slot?.dead && safeNumber(slot.respawnAt, 0) <= now) this.respawnEnemy(enemy);
            else this.noteDeadEnemy(enemy);
          }
        }
      }
    };
  }

  DR.MobSpawnSystem = {
    install(Game) {
      Game.prototype.initMobSpawnRuntime = function() {
        if (!this.mobSpawnSystem) this.mobSpawnSystem = createRuntimeApi(this);
        if (this.pendingMobSpawnRuntimeState) this.mobSpawnSystem.importState(this.pendingMobSpawnRuntimeState);
        else this.mobSpawnRuntimeState = normalizeState(this.mobSpawnRuntimeState);
        this.mobSpawnSystem.ensureDefaultMobSpawnPlacements();
        return this.mobSpawnSystem;
      };

      Game.prototype.canSpawnDarkWoodsMobAt = function(x, y, options = {}) {
        this.initMobSpawnRuntime?.();
        return this.mobSpawnSystem?.canSpawnDarkWoodsMobAt?.(x, y, options) === true;
      };

      Game.prototype.isValidMobSpawnTile = function(zoneId, x, y, options = {}) {
        this.initMobSpawnRuntime?.();
        return this.mobSpawnSystem?.isValidMobSpawnTile?.(zoneId, x, y, options) === true;
      };

      Game.prototype.findValidMobSpawnNear = function(zoneId, x, y, radius = 8, options = {}) {
        this.initMobSpawnRuntime?.();
        return this.mobSpawnSystem?.findValidMobSpawnNear?.(zoneId, x, y, radius, options) || null;
      };

      Game.prototype.canEnemyRoamTo = function(x, y, enemy = null) {
        const zoneId = this.currentZone === 'cave' ? (this.getActiveCaveZoneKey?.() || this.currentCave?.id || 'mossfang_cave') : 'dark_woods';
        this.initMobSpawnRuntime?.();
        if (zoneId === 'dark_woods') return this.mobSpawnSystem?.canRoamDarkWoodsMobAt?.(x, y, enemy) === true;
        return this.isWalkable?.(x, y, enemy) === true;
      };

      Game.prototype.auditDarkWoodsSpawnPopulation = function() {
        this.initMobSpawnRuntime?.();
        return this.mobSpawnSystem?.auditZone?.('dark_woods') || null;
      };

      Game.prototype.repairDarkWoodsSpawnPopulation = function() {
        this.initMobSpawnRuntime?.();
        const cleared = this.mobSpawnSystem?.repairInvalidSlots?.('dark_woods') || 0;
        if (cleared > 0) this.mobSpawnSystem?.rebuildZone?.('dark_woods', { repairInvalid: false });
        return cleared;
      };

      Game.prototype.darkWoodsStructuredPlacementCount = function() {
        this.initMobSpawnRuntime?.();
        return this.mobSpawnSystem?.darkWoodsStructuredPlacementCount?.() || 0;
      };

      Game.prototype.spawnEnemies = function() {
        const runtime = this.initMobSpawnRuntime();
        runtime.rebuildZone('dark_woods');
      };

      // V0.17.85 defend verb: spawn a single bespoke overworld enemy of a mob
      // draft at (x,y) as a transient quest-wave mob. It carries NO spawn slot,
      // so the normal respawn/population scan ignores it (never respawns, never
      // counted against zone density); it is removed via despawnQuestEntity.
      Game.prototype.spawnQuestWaveEnemy = function(mobId, x, y, level = 1, options = {}) {
        this.initMobSpawnRuntime?.();
        const draft = mobDef(this, mobId);
        if (!draft || !DR.Enemy) return null;
        const lvl = Math.max(1, Math.floor(Number(level) || 1));
        const pos = this.findValidMobSpawnNear?.('dark_woods', Math.floor(x), Math.floor(y), Number(options.searchRadius) || 6)
          || { x: Math.floor(x), y: Math.floor(y) };
        const type = makeEnemyType(this, draft, {}, lvl);
        const enemy = new DR.Enemy(type, pos.x + 0.5, pos.y + 0.5, lvl);
        enemy.mobDraftId = mobId;
        enemy.spawnZoneId = 'dark_woods';
        enemy.homeX = pos.x + 0.5; enemy.homeY = pos.y + 0.5;
        enemy.spawnHomeX = pos.x + 0.5; enemy.spawnHomeY = pos.y + 0.5;
        enemy.roamRadius = Number(options.roamRadius) || 14;
        enemy.patrolRadius = enemy.roamRadius;
        if (enemy.baseType) enemy.baseType.leashRadius = Number(options.leashRadius) || 40;
        enemy.respawnTimer = Number.POSITIVE_INFINITY;
        enemy.noSelfRespawn = true;
        enemy.questWaveMob = true;
        enemy.encounterKind = 'anchor';
        enemy.aggro = true;
        if (this.player) { enemy.targetId = this.player.id; enemy.aggroTargetId = this.player.id; }
        const zarr = zoneEnemyArray(this, 'dark_woods');
        if (Array.isArray(zarr) && !zarr.includes(enemy)) zarr.push(enemy);
        if (Array.isArray(this.enemies) && this.enemies !== zarr && !this.enemies.includes(enemy)) this.enemies.push(enemy);
        if (Array.isArray(this.entities) && !this.entities.includes(enemy)) this.entities.push(enemy);
        this.spawnRing?.(enemy.x, enemy.y, enemy.color || enemy.baseType?.color || '#d4665a', 14);
        return enemy;
      };

      Game.prototype.despawnQuestEntity = function(entity) {
        if (!entity) return;
        entity.alive = false; entity.hp = 0; entity.temporaryLife = 0;
        const zarr = zoneEnemyArray(this, 'dark_woods');
        for (const arr of [this.enemies, this.overworldEnemies, this.entities, zarr]) {
          if (!Array.isArray(arr)) continue;
          const i = arr.indexOf(entity);
          if (i >= 0) arr.splice(i, 1);
        }
      };


      Game.prototype.setActiveEnemySet = function(enemySet) {
        this.enemies = Array.isArray(enemySet) ? enemySet : [];
        const activeZone = this.currentZone || 'overworld';
        if (this.player) this.player.zone = activeZone;
        const allies = typeof this.activeZoneAllies === 'function'
          ? this.activeZoneAllies(activeZone)
          : [this.player, this.merc, this.pet].filter(Boolean);
        this.entities = [...this.enemies, ...allies.filter(Boolean)];
      };

      Game.prototype.updateMobSpawnRuntime = function(dt) {
        this.initMobSpawnRuntime().update(dt);
      };

    }
  };
})();
