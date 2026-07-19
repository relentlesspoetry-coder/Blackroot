// Dream Realms atmosphere system
// V0.11.2 owner: low-cost Dark Woods fog pockets, fireflies, and distant ambience.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const SYSTEM_ID = 'darkWoodsAtmosphere';
  const FOG_CELL = 11;
  const FIREFLY_CELL = 8;
  const MAX_FOG_CELLS = 18;
  const MAX_FIREFLY_CELLS = 20;
  const AMBIENT_CELL = 7;
  const MAX_AMBIENT_CREATURES = 26;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeNoise(x, y, seed) {
    if (DR.utils?.seededNoise) return DR.utils.seededNoise(x, y, seed);
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.017) * 43758.5453;
    return n - Math.floor(n);
  }

  function isOverworld(game) {
    return game?.currentZone === 'overworld' || game?.currentZone === 'dark_woods';
  }

  function distanceFromStart(x, y) {
    const startX = DR.CONFIG?.START_X ?? 100;
    const startY = DR.CONFIG?.START_Y ?? 100;
    return Math.hypot(x - startX, y - startY);
  }

  function tileAllowsAtmosphere(tile) {
    if (!tile) return false;
    const TILE = DR.TILE || {};
    return tile.type !== TILE.CAVE_WALL && tile.type !== TILE.STONE && tile.type !== TILE.RUIN && tile.type !== TILE.CAMP;
  }

  function renderFogPocket(game, context, x, y, tile, now, strength) {
    const s = game.worldToScreen(x, y, (tile?.elev || 0) + 0.04);
    const pulse = Math.sin(now * 0.00055 + x * 0.37 + y * 0.29) * 0.08;
    const deep = clamp(distanceFromStart(x, y) / 115, 0, 1);
    context.save();
    context.globalAlpha = clamp(0.08 + strength * 0.17 + pulse, 0.06, 0.28);
    const grd = context.createRadialGradient(s.x, s.y, 8, s.x, s.y, 70 + deep * 35);
    grd.addColorStop(0, deep > 0.62 ? 'rgba(169,188,152,0.52)' : 'rgba(189,216,181,0.40)');
    grd.addColorStop(0.62, deep > 0.62 ? 'rgba(89,102,83,0.25)' : 'rgba(89,126,91,0.18)');
    grd.addColorStop(1, 'rgba(22,34,25,0)');
    context.fillStyle = grd;
    context.beginPath();
    context.ellipse(s.x, s.y + 8, 72 + deep * 34, 23 + deep * 12, Math.sin(now * 0.00022 + x) * 0.12, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function renderFireflyCluster(game, context, x, y, tile, now, strength) {
    const base = game.worldToScreen(x, y, (tile?.elev || 0) + 0.35);
    const count = 2 + Math.floor(strength * 4);
    context.save();
    for (let i = 0; i < count; i++) {
      const phase = now * (0.0012 + i * 0.00017) + x * 0.8 + y * 0.4 + i * 2.1;
      const px = base.x + Math.sin(phase) * (16 + i * 5) + (safeNoise(x + i, y, 9244) - 0.5) * 34;
      const py = base.y - 22 + Math.cos(phase * 0.83) * (9 + i * 3) + (safeNoise(x, y + i, 9245) - 0.5) * 16;
      const alpha = clamp(0.26 + Math.sin(phase * 1.9) * 0.22, 0.10, 0.58);
      context.globalAlpha = alpha;
      context.fillStyle = i % 3 === 0 ? '#c8ff9d' : '#f7e884';
      context.beginPath();
      context.arc(px, py, 1.6 + (i % 2) * 0.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = alpha * 0.22;
      context.beginPath();
      context.arc(px, py, 7 + i, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }



  // Phase 16 (Creature Territory Signposting + Ambient Life): cave-mouth
  // proximity for bats, reusing the same entrance lookup pattern already
  // established in Phase 6/8's cave-approach dressing rather than a new
  // coordinate constant.
  function nearCaveMouth(x, y) {
    const silkWeb = DR.CAVE_BY_ID?.silk_web_cavern?.entrance || { x: 52, y: 139 };
    const hiddenTree = DR.CAVE_BY_ID?.mossfang_cave?.entrance || { x: 76, y: 74 };
    return Math.hypot(x - silkWeb.x, y - silkWeb.y) < 16 || Math.hypot(x - hiddenTree.x, y - hiddenTree.y) < 16;
  }

  function ambientCreatureKind(game, tile, x, y, light) {
    const TILE = DR.TILE || {};
    const type = tile?.type;
    const night = Number(light?.nightStrength || light?.fireflyBoost || 0) > 0.42 || game?.currentZone === 'cave' || game?.currentZone === 'dungeon';
    const roll = safeNoise(x, y, 9910);
    const nearWater = game?.map?.[y - 1]?.[x]?.type === TILE.WATER || game?.map?.[y + 1]?.[x]?.type === TILE.WATER || game?.map?.[y]?.[x - 1]?.type === TILE.WATER || game?.map?.[y]?.[x + 1]?.type === TILE.WATER;
    // Phase 16: depth-biased/region-flavored additions, reusing Phase 13's
    // darkWoodsDepthFactor and Phase 6/8's cave entrance lookups rather than
    // inventing new geography.
    const depth = game?.darkWoodsDepthFactor?.(x, y) || 0;
    if (night && nearCaveMouth(x, y) && roll > 0.5) return 'bat';
    if (night && roll > 0.48) return 'firefly';
    if (!night && nearWater && (type === TILE.UNDERBRUSH || type === TILE.DIRT) && roll > 0.7) return 'frog';
    if (!night && (type === TILE.DEEP_GRASS || type === TILE.DARK_GRASS || type === TILE.UNDERBRUSH) && roll > 0.66) return 'butterfly';
    if ((type === TILE.STONE || type === TILE.RUIN || nearWater) && roll > 0.64) return 'lizard';
    if ((type === TILE.DIRT || type === TILE.CAMP || type === TILE.FOREST_FLOOR || type === TILE.CAVE_FLOOR) && roll > 0.56) return 'beetle';
    if (!night && (type === TILE.FOREST_FLOOR || type === TILE.DARK_GRASS) && roll > 0.6) return 'squirrel';
    if (!night && depth > 0.4 && (type === TILE.DEEP_GRASS || type === TILE.FOREST_FLOOR) && roll > 0.78) return 'crow';
    if (!night && (type === TILE.DEEP_GRASS || type === TILE.DARK_GRASS) && depth < 0.5 && roll > 0.82) return 'deer';
    if (!night && roll > 0.72) return 'moth';
    return null;
  }

  function renderAmbientCreature(game, context, kind, x, y, tile, now, seed) {
    const elev = (tile?.elev || 0) + (kind === 'butterfly' || kind === 'moth' || kind === 'firefly' ? 0.32 : 0.08);
    const base = game.worldToScreen(x, y, elev);
    const phase = now * 0.001 + seed * 7.91;
    context.save();
    context.lineCap = 'round';
    if (kind === 'firefly') {
      const px = base.x + Math.sin(phase * 1.7) * 10;
      const py = base.y - 17 + Math.cos(phase * 1.3) * 6;
      const a = clamp(0.22 + Math.sin(phase * 3.4) * 0.18, 0.08, 0.48);
      context.globalAlpha = a;
      context.fillStyle = '#d9ff91';
      context.beginPath(); context.arc(px, py, 2.0, 0, Math.PI * 2); context.fill();
      context.globalAlpha = a * 0.24;
      context.beginPath(); context.arc(px, py, 8.5, 0, Math.PI * 2); context.fill();
    } else if (kind === 'butterfly' || kind === 'moth') {
      const px = base.x + Math.sin(phase * 1.5) * 12;
      const py = base.y - 18 + Math.cos(phase * 1.9) * 8;
      context.globalAlpha = kind === 'moth' ? 0.34 : 0.46;
      context.fillStyle = kind === 'moth' ? '#c9b995' : (seed % 2 > 1 ? '#e8d16b' : '#b7d978');
      context.beginPath(); context.ellipse(px - 3, py, 3, 2.1, -0.5, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.ellipse(px + 3, py, 3, 2.1, 0.5, 0, Math.PI * 2); context.fill();
      context.strokeStyle = 'rgba(36,28,18,0.34)';
      context.lineWidth = 1;
      context.beginPath(); context.moveTo(px, py - 2); context.lineTo(px, py + 3); context.stroke();
    } else if (kind === 'lizard') {
      const crawl = Math.sin(phase * 0.9) * 5;
      const px = base.x + crawl;
      const py = base.y + 4 + Math.cos(phase * 0.7) * 2;
      context.globalAlpha = 0.42;
      context.strokeStyle = '#617448';
      context.lineWidth = 3;
      context.beginPath(); context.moveTo(px - 7, py); context.quadraticCurveTo(px, py - 3, px + 8, py); context.stroke();
      context.lineWidth = 1.2;
      context.beginPath(); context.moveTo(px + 7, py); context.lineTo(px + 13, py - 2); context.stroke();
    } else if (kind === 'beetle') {
      const crawl = Math.sin(phase * 0.8) * 4;
      const px = base.x + crawl;
      const py = base.y + 5;
      context.globalAlpha = 0.38;
      context.fillStyle = '#1d1812';
      context.beginPath(); context.ellipse(px, py, 3.4, 2.2, 0, 0, Math.PI * 2); context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.45)';
      context.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { context.beginPath(); context.moveTo(px - 2, py + i); context.lineTo(px - 6, py + i * 2); context.moveTo(px + 2, py + i); context.lineTo(px + 6, py + i * 2); context.stroke(); }
    } else if (kind === 'crow') {
      const px = base.x + Math.sin(phase * 0.6) * 14;
      const py = base.y - 26 + Math.sin(phase * 1.1) * 3;
      const wing = Math.sin(phase * 4) * 6;
      context.globalAlpha = 0.5;
      context.strokeStyle = '#17140f';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(px - 9, py - wing); context.quadraticCurveTo(px, py + 2, px + 9, py - wing);
      context.stroke();
    } else if (kind === 'squirrel') {
      const hop = Math.abs(Math.sin(phase * 1.6)) * 3;
      const px = base.x + Math.sin(phase * 0.5) * 5;
      const py = base.y + 4 - hop;
      context.globalAlpha = 0.44;
      context.fillStyle = '#6b4526';
      context.beginPath(); context.ellipse(px, py, 3, 2.4, 0, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.ellipse(px + 4, py - 4 - hop * 0.5, 2.6, 3.6, 0.6, 0, Math.PI * 2); context.fill();
    } else if (kind === 'deer') {
      // Stateless "startled step" (Phase 16 scope decision - see phase
      // report): rather than persistent flee AI/pathing (out of scope for
      // this cosmetic, no-collision layer), the deer's rendered offset
      // simply points away from the player's current position each frame,
      // recomputed fresh every call with no stored state.
      const dxp = x - game.player.x, dyp = y - game.player.y;
      const distToPlayer = Math.hypot(dxp, dyp);
      const startled = distToPlayer < 7;
      const awayX = distToPlayer > 0.01 ? dxp / distToPlayer : 0;
      const awayY = distToPlayer > 0.01 ? dyp / distToPlayer : 0;
      const sway = startled ? 0 : Math.sin(phase * 0.7) * 3;
      const px = base.x + sway + (startled ? awayX * 14 : 0);
      const py = base.y - 6 + (startled ? awayY * 8 : 0);
      context.globalAlpha = 0.4;
      context.fillStyle = '#7a5a3a';
      context.beginPath(); context.ellipse(px, py, 6, 4, 0, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.ellipse(px + 6, py - 4, 2.6, 2.2, 0, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#4a3520';
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(px - 4, py + 4); context.lineTo(px - 4, py + 8);
      context.moveTo(px + 3, py + 4); context.lineTo(px + 3, py + 8);
      context.stroke();
    } else if (kind === 'frog') {
      const hop = Math.abs(Math.sin(phase * 1.3)) * 2.5;
      const px = base.x + Math.sin(phase * 0.4) * 4;
      const py = base.y + 5 - hop;
      context.globalAlpha = 0.42;
      context.fillStyle = '#4a7a3f';
      context.beginPath(); context.ellipse(px, py, 3.2, 2.4, 0, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.arc(px - 1.5, py - 1.5, 1, 0, Math.PI * 2); context.arc(px + 1.5, py - 1.5, 1, 0, Math.PI * 2); context.fill();
    } else if (kind === 'bat') {
      const px = base.x + Math.sin(phase * 3.1) * 13;
      const py = base.y - 20 + Math.cos(phase * 2.4) * 9;
      const flutter = Math.sin(phase * 6) * 4;
      context.globalAlpha = 0.4;
      context.fillStyle = '#100e0c';
      context.beginPath();
      context.moveTo(px, py);
      context.lineTo(px - 7, py - flutter);
      context.lineTo(px - 2, py + 1);
      context.lineTo(px + 2, py + 1);
      context.lineTo(px + 7, py - flutter);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  DR.AtmosphereSystem = {
    install(Game) {
      Game.prototype.renderDarkWoodsAtmosphere = function(context) {
        if (!this.player || !isOverworld(this) || !context) return;
        const px = Math.floor(this.player.x);
        const py = Math.floor(this.player.y);
        const now = performance.now();
        const light = this.getWorldLightState?.() || {};
        const fogBoost = Number(light.fogAlpha || 1);
        const fireflyBoost = Number(light.fireflyBoost || 0.25);
        // Phase 17 (Atmosphere / Time-of-Day): morning fog pools in low ground.
        // The dawn/morning phases raise fog density, biased toward low-elevation
        // valley tiles (elev 0-1); night fog is left untouched (it is already
        // driven up by fogBoost=light.fogAlpha). No new fog pass or timer - this
        // only reweights the existing deterministic fog-pocket seeding below.
        const phaseKey = light.phaseKey || '';
        const morningFog = phaseKey === 'dawn' ? 1 : (phaseKey === 'morning' ? 0.7 : 0);
        const range = Math.max(16, Math.ceil((DR.CONFIG?.RENDER_PAD || 18) * 0.95));
        // Phase 16 bugfix: this previously clamped to the shared cave/dungeon
        // DR.CONFIG.MAP_SIZE (200) even in the overworld, which has used the
        // Phase 2 360x360 DR.CONFIG.OVERWORLD_MAP_SIZE via activeMapSize()
        // since V0.17.41 - atmosphere-system.js was never updated for the
        // resize, so fog/fireflies silently stopped rendering for any player
        // position beyond ~x/y 197, i.e. most of the expanded zone. Matches
        // the activeMapSize() pattern already used everywhere else (game.js,
        // collision-system.js, world-system.js, etc).
        const mapBoundSize = this.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || 200;

        let fogDrawn = 0;
        const fogMinX = Math.max(2, px - range);
        const fogMaxX = Math.min(mapBoundSize - 3, px + range);
        const fogMinY = Math.max(2, py - range);
        const fogMaxY = Math.min(mapBoundSize - 3, py + range);
        for (let y = Math.floor(fogMinY / FOG_CELL) * FOG_CELL; y <= fogMaxY && fogDrawn < MAX_FOG_CELLS; y += FOG_CELL) {
          for (let x = Math.floor(fogMinX / FOG_CELL) * FOG_CELL; x <= fogMaxX && fogDrawn < MAX_FOG_CELLS; x += FOG_CELL) {
            const cx = x + 3 + Math.floor(safeNoise(x, y, 7701) * 5);
            const cy = y + 3 + Math.floor(safeNoise(x, y, 7702) * 5);
            const tile = this.map?.[cy]?.[cx];
            if (!tileAllowsAtmosphere(tile)) continue;
            const deep = clamp(distanceFromStart(cx, cy) / 110, 0, 1);
            // Low areas (valley floors, water-adjacent flats) hold morning fog;
            // elev is an integer 0-4, so elev 0 = full pool, tapering to none by
            // elev ~2. morningFog is 0 outside dawn/morning, so this whole term
            // vanishes at every other time of day.
            const lowness = clamp(1 - (tile.elev || 0) * 0.45, 0, 1);
            const morningPool = morningFog * lowness;
            const roll = safeNoise(cx, cy, 7720);
            if (roll < 0.62 - deep * 0.18 - morningPool * 0.3) continue;
            renderFogPocket(this, context, cx + 0.5, cy + 0.5, tile, now, roll * (0.55 + deep * 0.75 + morningPool * 0.9) * fogBoost);
            fogDrawn++;
          }
        }

        let flyDrawn = 0;
        for (let y = Math.floor(fogMinY / FIREFLY_CELL) * FIREFLY_CELL; y <= fogMaxY && flyDrawn < MAX_FIREFLY_CELLS; y += FIREFLY_CELL) {
          for (let x = Math.floor(fogMinX / FIREFLY_CELL) * FIREFLY_CELL; x <= fogMaxX && flyDrawn < MAX_FIREFLY_CELLS; x += FIREFLY_CELL) {
            const cx = x + 2 + Math.floor(safeNoise(x, y, 8844) * 4);
            const cy = y + 2 + Math.floor(safeNoise(x, y, 8845) * 4);
            const tile = this.map?.[cy]?.[cx];
            if (!tileAllowsAtmosphere(tile)) continue;
            const nearWater = this.map?.[cy - 1]?.[cx]?.type === DR.TILE?.WATER || this.map?.[cy + 1]?.[cx]?.type === DR.TILE?.WATER || this.map?.[cy]?.[cx - 1]?.type === DR.TILE?.WATER || this.map?.[cy]?.[cx + 1]?.type === DR.TILE?.WATER;
            const roll = safeNoise(cx, cy, 8890);
            const threshold = (nearWater ? 0.48 : 0.74) - fireflyBoost * 0.22;
            if (roll < threshold) continue;
            renderFireflyCluster(this, context, cx + 0.5, cy + 0.5, tile, now, roll * (0.65 + fireflyBoost));
            flyDrawn++;
          }
        }
      };


      Game.prototype.renderAmbientCreatureLayer = function(context) {
        if (!this.player || !context) return;
        if (!(isOverworld(this) || this.currentZone === 'cave' || this.currentZone === 'dungeon')) return;
        const px = Math.floor(this.player.x);
        const py = Math.floor(this.player.y);
        const now = performance.now();
        const light = this.getWorldLightState?.() || {};
        const range = Math.max(14, Math.ceil((DR.CONFIG?.RENDER_PAD || 18) * 0.85));
        const ambientMapBoundSize = this.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || 200;
        const minX = Math.max(2, px - range);
        const maxX = Math.min(ambientMapBoundSize - 3, px + range);
        const minY = Math.max(2, py - range);
        const maxY = Math.min(ambientMapBoundSize - 3, py + range);
        let drawn = 0;
        for (let y = Math.floor(minY / AMBIENT_CELL) * AMBIENT_CELL; y <= maxY && drawn < MAX_AMBIENT_CREATURES; y += AMBIENT_CELL) {
          for (let x = Math.floor(minX / AMBIENT_CELL) * AMBIENT_CELL; x <= maxX && drawn < MAX_AMBIENT_CREATURES; x += AMBIENT_CELL) {
            const cx = x + 1 + Math.floor(safeNoise(x, y, 9901) * (AMBIENT_CELL - 2));
            const cy = y + 1 + Math.floor(safeNoise(x, y, 9902) * (AMBIENT_CELL - 2));
            const tile = this.map?.[cy]?.[cx];
            if (!tileAllowsAtmosphere(tile)) continue;
            if (Math.hypot(cx - this.player.x, cy - this.player.y) > range + 2) continue;
            const kind = ambientCreatureKind(this, tile, cx, cy, light);
            if (!kind) continue;
            renderAmbientCreature(this, context, kind, cx + 0.5, cy + 0.5, tile, now, safeNoise(cx, cy, 9903) * 10);
            drawn++;
          }
        }
      };

    }
  };
})();
