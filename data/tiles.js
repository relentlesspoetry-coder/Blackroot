(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  const TILE = DR.TILE;

  DR.TILE_DEF = {
    [TILE.DEEP_GRASS]: {
      name: 'Deep Grass', top: '#405f2b', side: '#22381d', rim: '#6f8749', walk: true,
      terrainType: 'grass',
      footstepProfile: { terrainId: 'grass', terrainName: 'Grass', particleEffect: 'grass_blade_fx', decalEffectOptional: null, soundSet: 'grass_soft', spawnScaleMin: 0.74, spawnScaleMax: 1.12, stepIntervalModifier: 1.0, particlesMin: 4, particlesMax: 7, colors: ['#6e9d4d', '#496f34', '#8ea65b'] }
    },
    [TILE.DARK_GRASS]: {
      name: 'Dark Grass', top: '#334d27', side: '#1c2f1b', rim: '#627742', walk: true,
      terrainType: 'grass',
      footstepProfile: { terrainId: 'grass', terrainName: 'Grass', particleEffect: 'grass_blade_fx', decalEffectOptional: null, soundSet: 'grass_soft', spawnScaleMin: 0.72, spawnScaleMax: 1.08, stepIntervalModifier: 1.0, particlesMin: 4, particlesMax: 7, colors: ['#5f8e45', '#385d2e', '#82955a'] }
    },
    [TILE.FOREST_FLOOR]: {
      name: 'Forest Floor', top: '#594831', side: '#33271d', rim: '#7d6743', walk: true,
      terrainType: 'leaves',
      footstepProfile: { terrainId: 'leaves', terrainName: 'Leaves', particleEffect: 'leaf_scatter_fx', decalEffectOptional: null, soundSet: 'leaf_dry', spawnScaleMin: 0.72, spawnScaleMax: 1.14, stepIntervalModifier: 1.04, particlesMin: 3, particlesMax: 6, colors: ['#82613a', '#5c452f', '#9a7646'] }
    },
    [TILE.DIRT]: {
      name: 'Dirt Path', top: '#8a633e', side: '#543821', rim: '#b28758', walk: true,
      terrainType: 'dirt',
      footstepProfile: { terrainId: 'dirt', terrainName: 'Dirt', particleEffect: 'dust_puff_fx', decalEffectOptional: null, soundSet: 'dirt_soft', spawnScaleMin: 0.78, spawnScaleMax: 1.18, stepIntervalModifier: 1.0, particlesMin: 4, particlesMax: 7, colors: ['#a87d50', '#805b39', '#61432c'] }
    },
    [TILE.WATER]: {
      name: 'Blackwater', top: '#2c6c78', side: '#174451', rim: '#6aa8ad', walk: false,
      terrainType: 'shallow_water',
      footstepProfile: { terrainId: 'shallow_water', terrainName: 'Shallow Water', particleEffect: 'ripple_splash_fx', decalEffectOptional: 'water_ripple_decal', soundSet: 'water_shallow', spawnScaleMin: 0.76, spawnScaleMax: 1.22, stepIntervalModifier: 1.16, particlesMin: 4, particlesMax: 8, colors: ['#8fd8e8', '#4aa7bc', '#c7f8ff'] }
    },
    [TILE.STONE]: {
      name: 'Stone', top: '#8c8a76', side: '#5a584b', rim: '#bcb38c', walk: true,
      terrainType: 'stone',
      footstepProfile: { terrainId: 'stone', terrainName: 'Stone', particleEffect: 'pebble_grit_fx', decalEffectOptional: null, soundSet: 'stone_grit', spawnScaleMin: 0.62, spawnScaleMax: 0.98, stepIntervalModifier: 0.94, particlesMin: 3, particlesMax: 5, colors: ['#bebaa0', '#8c8a76', '#676657'] }
    },
    [TILE.UNDERBRUSH]: {
      name: 'Underbrush', top: '#304f28', side: '#1b3019', rim: '#587540', walk: true,
      terrainType: 'grass',
      footstepProfile: { terrainId: 'grass', terrainName: 'Underbrush', particleEffect: 'grass_blade_fx', decalEffectOptional: null, soundSet: 'brush_soft', spawnScaleMin: 0.84, spawnScaleMax: 1.25, stepIntervalModifier: 1.12, particlesMin: 5, particlesMax: 8, colors: ['#5f8e49', '#355f30', '#789958'] }
    },
    [TILE.RUIN]: {
      name: 'Ruin Floor', top: '#89856e', side: '#595644', rim: '#beb58b', walk: true,
      terrainType: 'stone',
      footstepProfile: { terrainId: 'stone', terrainName: 'Ruin Stone', particleEffect: 'pebble_grit_fx', decalEffectOptional: null, soundSet: 'stone_grit', spawnScaleMin: 0.64, spawnScaleMax: 1.02, stepIntervalModifier: 0.96, particlesMin: 3, particlesMax: 6, colors: ['#bfb797', '#89856e', '#69644f'] }
    },
    [TILE.CAMP]: {
      name: 'Camp', top: '#b4844c', side: '#6c4a2c', rim: '#d7ae70', walk: true,
      terrainType: 'dirt',
      footstepProfile: { terrainId: 'dirt', terrainName: 'Packed Dirt', particleEffect: 'dust_puff_fx', decalEffectOptional: null, soundSet: 'packed_dirt', spawnScaleMin: 0.68, spawnScaleMax: 1.06, stepIntervalModifier: 0.98, particlesMin: 3, particlesMax: 6, colors: ['#c9985e', '#a87743', '#775234'] }
    },
    [TILE.CAVE_FLOOR]: {
      name: 'Cave Floor', top: '#6a5b45', side: '#3d3329', rim: '#95866d', walk: true,
      terrainType: 'ash_soil',
      footstepProfile: { terrainId: 'ash_soil', terrainName: 'Ash Soil', particleEffect: 'gray_dust_fx', decalEffectOptional: null, soundSet: 'cave_dust', spawnScaleMin: 0.72, spawnScaleMax: 1.12, stepIntervalModifier: 1.03, particlesMin: 4, particlesMax: 7, colors: ['#9b8f7b', '#6a5b45', '#4d453a'] }
    },
    [TILE.CAVE_WALL]: {
      name: 'Cave Wall', top: '#5e5140', side: '#4a3e31', rim: '#8d7d66', walk: false,
      terrainType: 'stone',
      footstepProfile: null
    }
  };})();
