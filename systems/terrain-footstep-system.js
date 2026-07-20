// Dream Realms terrain footstep effect system
// V0.10.6 owner: terrain-tagged, step-timed traversal feedback.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const BASE_STEP_DISTANCE = 0.56;
  const MAX_TERRAIN_STEP_EFFECTS = 72;
  const OFFSCREEN_MARGIN = 160;

  function clampLocal(value, min, max) {
    if (DR.utils?.clamp) return DR.utils.clamp(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function terrainFallbackProfile(terrainType) {
    const profiles = {
      grass: { terrainId: 'grass', terrainName: 'Grass', particleEffect: 'grass_blade_fx', spawnScaleMin: 0.74, spawnScaleMax: 1.12, stepIntervalModifier: 1, particlesMin: 4, particlesMax: 7, colors: ['#8fcf65', '#6aa84a', '#b8df7d'] },
      dirt: { terrainId: 'dirt', terrainName: 'Dirt', particleEffect: 'dust_puff_fx', spawnScaleMin: 0.78, spawnScaleMax: 1.18, stepIntervalModifier: 1, particlesMin: 4, particlesMax: 7, colors: ['#c49161', '#a97846', '#7d5432'] },
      mud: { terrainId: 'mud', terrainName: 'Mud', particleEffect: 'mud_splash_fx', spawnScaleMin: 0.78, spawnScaleMax: 1.18, stepIntervalModifier: 1.18, particlesMin: 4, particlesMax: 7, colors: ['#4f3628', '#6c4a34', '#2d211b'] },
      sand: { terrainId: 'sand', terrainName: 'Sand', particleEffect: 'sand_spray_fx', spawnScaleMin: 0.74, spawnScaleMax: 1.16, stepIntervalModifier: 1.05, particlesMin: 4, particlesMax: 7, colors: ['#dcc07b', '#c9a960', '#f1d694'] },
      snow: { terrainId: 'snow', terrainName: 'Snow', particleEffect: 'snow_puff_fx', spawnScaleMin: 0.82, spawnScaleMax: 1.24, stepIntervalModifier: 1.1, particlesMin: 5, particlesMax: 8, colors: ['#eff8ff', '#cfe8f5', '#ffffff'] },
      shallow_water: { terrainId: 'shallow_water', terrainName: 'Shallow Water', particleEffect: 'ripple_splash_fx', spawnScaleMin: 0.76, spawnScaleMax: 1.22, stepIntervalModifier: 1.16, particlesMin: 4, particlesMax: 8, colors: ['#8fd8e8', '#4aa7bc', '#c7f8ff'] },
      stone: { terrainId: 'stone', terrainName: 'Stone', particleEffect: 'pebble_grit_fx', spawnScaleMin: 0.62, spawnScaleMax: 0.98, stepIntervalModifier: 0.94, particlesMin: 3, particlesMax: 5, colors: ['#bebaa0', '#8c8a76', '#676657'] },
      leaves: { terrainId: 'leaves', terrainName: 'Leaves', particleEffect: 'leaf_scatter_fx', spawnScaleMin: 0.72, spawnScaleMax: 1.14, stepIntervalModifier: 1.04, particlesMin: 3, particlesMax: 6, colors: ['#b1743f', '#8f5d32', '#c7964e'] },
      swamp: { terrainId: 'swamp', terrainName: 'Swamp', particleEffect: 'swamp_bubble_fx', spawnScaleMin: 0.82, spawnScaleMax: 1.26, stepIntervalModifier: 1.2, particlesMin: 4, particlesMax: 8, colors: ['#31543f', '#587148', '#1f332b'] },
      ash_soil: { terrainId: 'ash_soil', terrainName: 'Ash Soil', particleEffect: 'gray_dust_fx', spawnScaleMin: 0.72, spawnScaleMax: 1.12, stepIntervalModifier: 1.03, particlesMin: 4, particlesMax: 7, colors: ['#9b8f7b', '#6a5b45', '#4d453a'] }
    };
    return profiles[terrainType] || profiles.dirt;
  }

  function isFootstepActor(game, entity, distStep) {
    if (!game || !entity?.alive) return false;
    if (!Number.isFinite(distStep) || distStep <= 0.0001) return false;
    if (entity.deadTimer > 0) return false;
    if (entity.isMeditating || entity.meditating || entity.meditationActive) return false;
    if (entity.mounted || entity.mount || entity.ridingMount) return false;
    if ((entity.z || 0) > 0.025 || entity.isJumping || (entity.vz || 0) !== 0) return false;
    if (entity.knockback || entity.sliding) return false;

    // The terrain FX system is for humanoid/class actor traversal. Enemies and pets
    // have species-specific ground contact and should not inherit humanoid foot puffs.
    const kind = String(entity.kind || '').toLowerCase();
    if (entity === game.player || kind === 'player' || kind === 'bot' || kind === 'merc' || entity.isNpcModel || entity.trainerClass) return true;
    return false;
  }

  function normalizeFacingFromMotion(entity, dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    return { fx: dx / len, fy: dy / len };
  }

  function humanoidFootScreenOffset(entity, profile) {
    const className = String(entity?.className || entity?.playerClass || entity?.classId || entity?.trainerClass || '').toLowerCase();
    const kind = String(entity?.kind || '').toLowerCase();
    let y = 36;
    if (kind === 'bot' || kind === 'merc') y = 37;
    if (/cleric|druid|summoner|enchanter|necromancer/.test(className)) y = 38;
    if (/bard|rogue/.test(className)) y = 35;
    if (String(profile?.terrainId || '').includes('water')) y += 2;
    return y;
  }

  DR.TerrainFootstepSystem = {
    install(Game) {
      Game.prototype.getTerrainFootstepProfile = function(tile) {
        if (!tile) return null;
        const def = DR.TILE_DEF?.[tile.type];
        if (!def) return terrainFallbackProfile('dirt');
        if (def.footstepProfile === null) return null;
        return def.footstepProfile || terrainFallbackProfile(def.terrainType || 'dirt');
      };

      Game.prototype.isTerrainStepOnscreen = function(x, y) {
        if (!this.player || typeof this.worldToScreen !== 'function') return true;
        const tile = this.tileAt?.(x, y);
        const elev = safeNumber(tile?.elev, 0);
        const s = this.worldToScreen(x, y, elev);
        return s.x >= -OFFSCREEN_MARGIN && s.y >= -OFFSCREEN_MARGIN &&
          s.x <= window.innerWidth + OFFSCREEN_MARGIN && s.y <= window.innerHeight + OFFSCREEN_MARGIN;
      };

      Game.prototype.getActorFootContactAnchor = function(entity, dx = 0, dy = 0, profile = null) {
        const { fx, fy } = normalizeFacingFromMotion(entity, dx, dy);
        entity.terrainStepFoot = entity.terrainStepFoot === 1 ? -1 : 1;
        const side = entity.terrainStepFoot;

        // World-space offset keeps the effect on the active boot, while screen-space
        // offset compensates for humanoid procedural rigs whose drawn boots sit well
        // below the render root. This fixes dust/grass spawning from robes/torso.
        const lateral = 0.075;
        const trailing = 0.018;
        return {
          x: entity.x + (-fy * lateral * side) - fx * trailing,
          y: entity.y + (fx * lateral * side) - fy * trailing,
          facingX: fx,
          facingY: fy,
          footSide: side,
          screenXOffset: 0,
          screenYOffset: humanoidFootScreenOffset(entity, profile)
        };
      };

      Game.prototype.handleTerrainFootstep = function(entity, dx, dy, distStep) {
        if (!isFootstepActor(this, entity, distStep)) return;

        const tile = this.tileAt?.(entity.x, entity.y);
        const profile = this.getTerrainFootstepProfile?.(tile);
        if (!profile) return;

        const isWater = tile?.type === DR.TILE?.WATER || profile.terrainId === 'shallow_water';
        if (isWater) entity.terrainWetness = 2.4;

        const isSwimming = Boolean(entity.swimming || entity.underwater || entity.isSwimming || entity.isUnderwater);
        if (isSwimming) return;

        entity.terrainStepDistance = safeNumber(entity.terrainStepDistance, 0) + distStep;
        const interval = BASE_STEP_DISTANCE * safeNumber(profile.stepIntervalModifier, 1);
        if (entity.terrainStepDistance < interval) return;
        entity.terrainStepDistance = Math.max(0, entity.terrainStepDistance - interval);

        const anchor = this.getActorFootContactAnchor?.(entity, dx, dy, profile) || { x: entity.x, y: entity.y, facingX: 1, facingY: 0, footSide: 1, screenYOffset: 36 };
        this.spawnTerrainFootstepEffect?.(anchor.x, anchor.y, profile, {
          facingX: anchor.facingX,
          facingY: anchor.facingY,
          footSide: anchor.footSide,
          speedScale: clampLocal(distStep / 0.055, 0.72, 1.35),
          wetness: safeNumber(entity.terrainWetness, 0),
          screenXOffset: safeNumber(anchor.screenXOffset, 0),
          screenYOffset: safeNumber(anchor.screenYOffset, 36)
        });

        if (entity.terrainWetness > 0 && !isWater) {
          entity.terrainWetness = Math.max(0, entity.terrainWetness - 0.42);
        }
      };

      Game.prototype.spawnTerrainFootstepEffect = function(x, y, profile, options = {}) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !profile) return false;
        if (!this.isTerrainStepOnscreen?.(x, y)) return false;
        if (!Array.isArray(this.effects)) this.effects = [];

        let terrainSteps = 0;
        for (let i = this.effects.length - 1; i >= 0; i--) {
          if (this.effects[i]?.type === 'terrainStep') terrainSteps++;
          if (terrainSteps > MAX_TERRAIN_STEP_EFFECTS && this.effects[i]?.type === 'terrainStep') this.effects.splice(i, 1);
        }

        const baseScale = randomBetween(safeNumber(profile.spawnScaleMin, 0.75), safeNumber(profile.spawnScaleMax, 1.15)) * safeNumber(options.speedScale, 1);
        const count = randomInt(safeNumber(profile.particlesMin, 3), safeNumber(profile.particlesMax, 7));
        const colors = Array.isArray(profile.colors) && profile.colors.length ? profile.colors : ['#bda06f'];
        const particles = [];
        const facingX = safeNumber(options.facingX, 1);
        const facingY = safeNumber(options.facingY, 0);
        const wetness = safeNumber(options.wetness, 0);

        for (let i = 0; i < count; i++) {
          const lateral = randomBetween(-0.12, 0.12);
          const forward = randomBetween(-0.06, 0.18);
          particles.push({
            ox: (-facingY * lateral + facingX * forward) + randomBetween(-0.04, 0.04),
            oy: (facingX * lateral + facingY * forward) + randomBetween(-0.04, 0.04),
            vx: randomBetween(-0.02, 0.02) + facingX * randomBetween(0.015, 0.05),
            vy: randomBetween(-0.02, 0.02) + facingY * randomBetween(0.015, 0.05),
            lift: randomBetween(0.0, 8.0) * baseScale,
            size: randomBetween(1.2, 3.8) * baseScale,
            color: colors[i % colors.length],
            rot: randomBetween(0, Math.PI * 2),
            spin: randomBetween(-2.8, 2.8)
          });
        }

        if (wetness > 0.35 && profile.terrainId !== 'shallow_water') {
          for (let i = 0; i < 2; i++) {
            particles.push({
              ox: randomBetween(-0.09, 0.09), oy: randomBetween(-0.07, 0.08), vx: randomBetween(-0.015, 0.015), vy: randomBetween(-0.015, 0.015),
              lift: randomBetween(2, 7), size: randomBetween(1.2, 2.4), color: '#8ed9e8', rot: 0, spin: 0, droplet: true
            });
          }
        }

        (this.addEffect || ((effect) => { this.effects.push(effect); return effect; })).call(this, {
          type: 'terrainStep',
          terrainId: profile.terrainId,
          particleEffect: profile.particleEffect,
          x,
          y,
          t: 0,
          life: profile.terrainId === 'shallow_water' || profile.terrainId === 'swamp' ? 0.62 : 0.46,
          scale: baseScale,
          screenXOffset: safeNumber(options.screenXOffset, 0),
          screenYOffset: safeNumber(options.screenYOffset, 36),
          footSide: safeNumber(options.footSide, 1),
          particles
        });
        this.playTerrainFootstepSound?.(profile, { ...options, x, y, speedScale: baseScale });
        return true;
      };
    }
  };
})();
