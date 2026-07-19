(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.TerrainRenderer = {
    install(Game) {
      Object.assign(Game.prototype, {
      terrainChunkSize() {
        return 16;
      },

      terrainChunkTextureScale() {
        return 24;
      },

      terrainChunkEdgeSamplePaddingTiles() {
        return 2;
      },

      ensureTerrainChunkCache() {
        if (this.terrainChunkCache?.chunks instanceof Map) return this.terrainChunkCache;
        this.terrainChunkCache = {
          chunks: new Map(),
          dirtyChunks: new Set(),
          mapIds: new WeakMap(),
          nextMapId: 1,
          builds: 0,
          draws: 0,
          waterBuilds: 0,
          waterDraws: 0,
          shoreBuilds: 0,
          shoreDraws: 0,
          invalidations: 0,
          lastZoneKey: '',
          maxEntries: 96,
          visibleEntries: [],
          visibleEntryPool: []
        };
        return this.terrainChunkCache;
      },

      terrainChunkMapId(map = this.map) {
        const cache = this.ensureTerrainChunkCache();
        if (!map || (typeof map !== 'object' && typeof map !== 'function')) return 'missing';
        let id = cache.mapIds.get(map);
        if (!id) {
          id = `map${cache.nextMapId++}`;
          cache.mapIds.set(map, id);
        }
        return id;
      },

      terrainChunkZoneKey() {
        const active = this.dungeonSystem?.state?.active || this.activeDungeon;
        const dungeonId = active?.dungeonId || active?.id || '';
        const floor = active?.floor || '';
        return `${this.currentZone || 'overworld'}:${dungeonId}:${floor}:${this.terrainChunkMapId()}`;
      },

      invalidateTerrainChunks(reason = 'terrain changed', bounds = null) {
        const cache = this.ensureTerrainChunkCache();
        const zoneKey = this.terrainChunkZoneKey();
        cache.dirtyChunks = cache.dirtyChunks instanceof Set ? cache.dirtyChunks : new Set();
        if (!bounds) {
          for (const key of cache.chunks.keys()) {
            if (key.startsWith(`${zoneKey}:`)) cache.chunks.delete(key);
          }
          for (const key of Array.from(cache.dirtyChunks)) {
            if (key.startsWith(`${zoneKey}:`)) cache.dirtyChunks.delete(key);
          }
        } else {
          const size = this.terrainChunkSize();
          const minChunkX = Math.floor((Number(bounds.minX) || 0) / size) - 1;
          const maxChunkX = Math.floor((Number(bounds.maxX) || 0) / size) + 1;
          const minChunkY = Math.floor((Number(bounds.minY) || 0) / size) - 1;
          const maxChunkY = Math.floor((Number(bounds.maxY) || 0) / size) + 1;
          for (let cy = minChunkY; cy <= maxChunkY; cy++) {
            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
              const key = `${zoneKey}:${cx}:${cy}`;
              cache.dirtyChunks.add(key);
              cache.chunks.delete(key);
            }
          }
        }
        cache.invalidations++;
        cache.lastInvalidationReason = String(reason || 'terrain changed');
        if (this.markObjectChunkIndexDirty) this.markObjectChunkIndexDirty(`terrain/${reason || 'terrain changed'}`);
      },

      invalidateTerrainChunkAt(x, y, reason = 'terrain tile changed') {
        const tx = Math.floor(Number(x));
        const ty = Math.floor(Number(y));
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
        this.invalidateTerrainChunks(reason, { minX: tx, maxX: tx, minY: ty, maxY: ty });
        return true;
      },

      isTerrainChunkGroundTile(tile) {
        const DR = window.DreamRealms;
        if (!tile || tile.type === DR.TILE?.WATER || tile.type === DR.TILE?.CAVE_WALL) return false;
        return DR.TILE_DEF?.[tile.type]?.walk === true;
      },

      isTerrainChunkWaterTile(tile) {
        return Boolean(tile && tile.type === window.DreamRealms.TILE?.WATER);
      },

      terrainChunkRenderingAvailable() {
        const cache = this.ensureTerrainChunkCache();
        if (typeof cache.surfaceSupported === 'boolean') return cache.surfaceSupported;
        const probe = this.createTerrainChunkSurface(2, 2);
        cache.surfaceSupported = Boolean(probe?.canvas && probe?.context);
        return cache.surfaceSupported;
      },

      terrainTileNeedsStructuralPass(x, y, tile) {
        if (!this.terrainChunkRenderingAvailable()) return true;
        if (this.isTerrainChunkWaterTile(tile)) {
          const { WATER } = window.DreamRealms.TILE || {};
          return [this.map?.[y - 1]?.[x], this.map?.[y]?.[x + 1], this.map?.[y + 1]?.[x], this.map?.[y]?.[x - 1]]
            .some(other => !other || other.type !== WATER);
        }
        if (!this.isTerrainChunkGroundTile(tile)) return true;
        return this.hasHalfBlockExposure(x, y, tile);
      },

      hasHalfBlockExposure(x, y, tile) {
        const neighbor = [
          this.map?.[y - 1]?.[x] ?? null,
          this.map?.[y]?.[x + 1] ?? null,
          this.map?.[y + 1]?.[x] ?? null,
          this.map?.[y]?.[x - 1] ?? null
        ];
        return neighbor.some(other => this.isLowerTerrainExposure(tile, other));
      },

      terrainEdgeDefinitionsForTile(x, y, corners = null) {
        const c = corners || {
          north: this.worldToScreen(x - 0.5, y - 0.5, this.map?.[y]?.[x]?.elev || 0),
          east: this.worldToScreen(x + 0.5, y - 0.5, this.map?.[y]?.[x]?.elev || 0),
          south: this.worldToScreen(x + 0.5, y + 0.5, this.map?.[y]?.[x]?.elev || 0),
          west: this.worldToScreen(x - 0.5, y + 0.5, this.map?.[y]?.[x]?.elev || 0)
        };
        return {
          n: { key: 'n', name: 'northFace', a: c.north, b: c.east, nx: x, ny: y - 1, ax: x - 0.5, ay: y - 0.5, bx: x + 0.5, by: y - 0.5, shade: -28 },
          e: { key: 'e', name: 'eastFace',  a: c.east,  b: c.south, nx: x + 1, ny: y, ax: x + 0.5, ay: y - 0.5, bx: x + 0.5, by: y + 0.5, shade: -20 },
          s: { key: 's', name: 'southFace', a: c.west,  b: c.south, nx: x, ny: y + 1, ax: x - 0.5, ay: y + 0.5, bx: x + 0.5, by: y + 0.5, shade: -32 },
          w: { key: 'w', name: 'westFace',  a: c.north, b: c.west, nx: x - 1, ny: y, ax: x - 0.5, ay: y - 0.5, bx: x - 0.5, by: y + 0.5, shade: -38 }
        };
      },

      isLowerTerrainExposure(tile, other) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        if (!tile) return false;
        const tileElev = Number(tile.elev) || 0;
        if (!other) return true;

        // Water is visually recessed even when legacy map data stores the same elevation as land.
        // Treat it as an exposed half-block boundary without changing collision or water logic.
        if (tile.type !== TILE.WATER && other.type === TILE.WATER) return true;

        const otherElev = Number(other.elev) || 0;
        if (tileElev > otherElev) return true;

        // Cave walls are structural blockers. Their visible side faces should appear wherever they
        // border non-wall floor, but floor next to cave wall should not draw a false drop-off.
        if (tile.type === TILE.CAVE_WALL && other.type !== TILE.CAVE_WALL) return true;
        return false;
      },

      lowerElevationForTerrainExposure(tile, other) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const tileElev = Number(tile?.elev) || 0;
        if (!other) return tileElev - 1;
        const otherElev = Number(other.elev) || 0;
        if (tile?.type !== TILE.WATER && other.type === TILE.WATER) {
          return Math.min(otherElev - 0.18, tileElev - 0.72);
        }
        if (tile?.type === TILE.CAVE_WALL && other.type !== TILE.CAVE_WALL) {
          return Math.min(otherElev, tileElev - 1);
        }
        return otherElev;
      },

      resolveHalfBlockExposure(x, y, tile, corners = null, neighborOverride = null) {
        const edges = this.terrainEdgeDefinitionsForTile(x, y, corners);
        const neighbor = neighborOverride || {
          n: this.map?.[y - 1]?.[x] ?? null,
          e: this.map?.[y]?.[x + 1] ?? null,
          s: this.map?.[y + 1]?.[x] ?? null,
          w: this.map?.[y]?.[x - 1] ?? null
        };
        const diagonal = {
          ne: this.map?.[y - 1]?.[x + 1] ?? null,
          se: this.map?.[y + 1]?.[x + 1] ?? null,
          sw: this.map?.[y + 1]?.[x - 1] ?? null,
          nw: this.map?.[y - 1]?.[x - 1] ?? null
        };
        const exposed = {
          n: false, e: false, s: false, w: false,
          north: false, east: false, south: false, west: false,
          ne: false, se: false, sw: false, nw: false
        };
        const faces = [];
        for (const key of ['n', 'e', 's', 'w']) {
          const edge = edges[key];
          const other = neighbor[key];
          if (!this.isLowerTerrainExposure(tile, other)) continue;
          const lowerElev = this.lowerElevationForTerrainExposure(tile, other);
          const drop = Math.max(0.01, (Number(tile?.elev) || 0) - lowerElev);
          exposed[key] = true;
          if (key === 'n') exposed.north = true;
          if (key === 'e') exposed.east = true;
          if (key === 's') exposed.south = true;
          if (key === 'w') exposed.west = true;
          faces.push({ ...edge, other, lowerElev, drop });
        }

        // Corner joins need diagonal sampling in addition to cardinal exposure. Cave walls already
        // looked coherent because their wall/floor masks normally expose two perpendicular faces on
        // the same tile. Organic overworld half-blocks also produce one-sided and zig-zag cases,
        // so each top corner gets its own join descriptor when either two faces meet or a single
        // face terminates beside a lower/void diagonal.
        const byKey = new Map(faces.map(face => [face.key, face]));
        const cornerDefs = [
          { key: 'ne', name: 'northEast', corner: corners?.east,  wx: x + 0.5, wy: y - 0.5, sides: ['n', 'e'], diagonal: diagonal.ne, diagonalKey: 'ne', singleOwner: { n: true, e: false }, seed: 54501 },
          { key: 'se', name: 'southEast', corner: corners?.south, wx: x + 0.5, wy: y + 0.5, sides: ['e', 's'], diagonal: diagonal.se, diagonalKey: 'se', singleOwner: { e: true, s: false }, seed: 54502 },
          { key: 'sw', name: 'southWest', corner: corners?.west,  wx: x - 0.5, wy: y + 0.5, sides: ['s', 'w'], diagonal: diagonal.sw, diagonalKey: 'sw', singleOwner: { s: true, w: false }, seed: 54503 },
          { key: 'nw', name: 'northWest', corner: corners?.north, wx: x - 0.5, wy: y - 0.5, sides: ['w', 'n'], diagonal: diagonal.nw, diagonalKey: 'nw', singleOwner: { w: true, n: false }, seed: 54504 }
        ];
        const cornerJoins = [];
        const tileElev = Number(tile?.elev) || 0;
        for (const def of cornerDefs) {
          const sideFaces = def.sides.map(key => byKey.get(key)).filter(Boolean);
          const diagonalExposed = this.isLowerTerrainExposure(tile, def.diagonal);
          exposed[def.diagonalKey] = diagonalExposed;

          // V0.20.92: DIAGONAL-ONLY corners used to be dropped here by `if (!sideFaces.length) continue`.
          // That is the notch reported on raised terrain: where a slope steps diagonally, a tile can be
          // level with BOTH cardinal neighbours yet higher than the diagonal one, so it has no side
          // faces at all and the corner went unowned - measured at 27.4% of exposed corners in the Ashen
          // highlands and 34.6% in Dark Woods, so this is pre-existing and simply far more visible in a
          // zone with real elevation.
          //
          // Restricted to a genuine ELEVATION drop. I first allowed any diagonal exposure and measured
          // the result: orphans went to zero but double-drawn corners rose 8 -> 16, because
          // isLowerTerrainExposure is also true for water and cave-wall adjacency, so both diagonal
          // pairs around a corner could claim it. For a real elevation step that cannot happen - both
          // cardinal neighbours are by definition level with this tile (a difference would have made a
          // side face), so the opposite pair is level with itself and neither of them is exposed.
          // Water corners are left alone; they already get shore treatment.
          const diagonalElev = Number(def.diagonal?.elev);
          const diagonalOnlyJoin = !sideFaces.length && diagonalExposed
            && Number.isFinite(diagonalElev) && tileElev > diagonalElev;
          if (!sideFaces.length && !diagonalOnlyJoin) continue;

          const twoSidedJoin = sideFaces.length >= 2;
          const singleSideKey = sideFaces.length === 1 ? sideFaces[0].key : null;
          const ownsSingleSideJoin = Boolean(singleSideKey && def.singleOwner?.[singleSideKey]);
          if (!diagonalOnlyJoin && !twoSidedJoin && (!diagonalExposed || !ownsSingleSideJoin)) continue;
          const lowerCandidates = sideFaces.map(face => face.lowerElev);
          if (diagonalExposed) lowerCandidates.push(this.lowerElevationForTerrainExposure(tile, def.diagonal));
          const lowerElev = Math.min(...lowerCandidates);
          cornerJoins.push({
            key: def.key,
            name: def.name,
            corner: def.corner,
            wx: def.wx,
            wy: def.wy,
            sideKeys: def.sides,
            sideFaces,
            lowerElev,
            drop: Math.max(0.01, tileElev - lowerElev),
            diagonal: def.diagonal,
            diagonalExposed,
            twoSidedJoin,
            seed: def.seed
          });
        }
        return { exposed, faces, cornerJoins, diagonal, neighbor, edges };
      },

      terrainMaterialForTile(tile) {
        const DR = window.DreamRealms;
        const { TILE, TILE_DEF } = DR;
        const def = TILE_DEF?.[tile?.type] || {};
        const silk = this.currentZone === 'dungeon' && String(this.dungeonSystem?.state?.active?.dungeonId || this.activeDungeon?.id || '') === 'silk_web_cavern';
        const materials = {
          [TILE.DEEP_GRASS]: { family: 'grass', base: '#3c5c2b', light: '#52753a', dark: '#294321' },
          [TILE.DARK_GRASS]: { family: 'grass', base: '#304a27', light: '#416236', dark: '#21351e' },
          [TILE.UNDERBRUSH]: { family: 'grass', base: '#2d4a27', light: '#3f6335', dark: '#1f351d' },
          [TILE.FOREST_FLOOR]: { family: 'forest', base: '#51432f', light: '#68543a', dark: '#372d23' },
          [TILE.DIRT]: { family: 'dirt', base: '#80603f', light: '#9b754d', dark: '#5f452f' },
          [TILE.CAMP]: { family: 'dirt', base: '#987047', light: '#b48757', dark: '#6f4f34' },
          [TILE.STONE]: { family: 'stone', base: '#7e7d6c', light: '#999783', dark: '#5e5d52' },
          [TILE.RUIN]: { family: 'stone', base: '#777563', light: '#908c76', dark: '#565448' },
          [TILE.CAVE_FLOOR]: silk
            ? { family: 'silk', base: '#564d43', light: '#6b6257', dark: '#37332f' }
            : { family: 'cave', base: '#625744', light: '#796c56', dark: '#443c32' }
        };
        return materials[tile?.type] || { family: def.terrainType || 'ground', base: def.top || '#665b46', light: def.rim || '#80745c', dark: def.side || '#453b30' };
      },

      waterMaterialForTile(tile) {
        const depth = Math.max(5, Math.min(12, Number(tile?.waterDepth) || 5));
        const caveWater = this.currentZone === 'cave' || this.currentZone === 'dungeon';
        if (caveWater) {
          return depth >= 9
            ? { family: 'cave-deep', base: '#122e38', light: '#315966', dark: '#071922', shore: '#416b70' }
            : { family: 'cave-shallow', base: '#244852', light: '#47717a', dark: '#102a32', shore: '#668486' };
        }
        return depth >= 9
          ? { family: 'deep', base: '#174657', light: '#327486', dark: '#071f2d', shore: '#4c8e96' }
          : depth <= 6
            ? { family: 'shallow', base: '#347783', light: '#65a4a6', dark: '#1b4f5c', shore: '#84aaa0' }
            : { family: 'water', base: '#286373', light: '#4b8d98', dark: '#103948', shore: '#679b98' };
      },

      cachedOrganicEdgeCurve(x, y, edge, worldMinX, worldMinY, scale, normalOffset = 0) {
        const vertical = edge.dx !== 0;
        const worldEdgeX = x + (edge.dx > 0 ? 1 : 0);
        const worldEdgeY = y + (edge.dy > 0 ? 1 : 0);
        // Held at 0.16. V0.21.7 tried 0.34 to let the boundary wander off the grid; because adjacent
        // edge curves share vertex seeds they stay joined, so the widened curves chained across tiles
        // into long snaking ribbons of contrasting material colour - clearly visible as worm shapes
        // on the ground. The jitter has to stay small enough that a boundary reads as a tile edge.
        const vertexJitter = (vx, vy, seed) => (this.hash2D(vx, vy, seed) - 0.5) * scale * 0.16;
        if (vertical) {
          const baseX = (worldEdgeX - worldMinX) * scale + edge.dx * normalOffset;
          const y0 = (y - worldMinY) * scale;
          return {
            p0: { x: baseX + vertexJitter(worldEdgeX, y, 52001), y: y0 },
            c1: { x: baseX + vertexJitter(worldEdgeX * 3, y * 3 + 1, 52002), y: y0 + scale * 0.32 },
            c2: { x: baseX + vertexJitter(worldEdgeX * 3, y * 3 + 2, 52003), y: y0 + scale * 0.68 },
            p3: { x: baseX + vertexJitter(worldEdgeX, y + 1, 52001), y: y0 + scale }
          };
        }
        const baseY = (worldEdgeY - worldMinY) * scale + edge.dy * normalOffset;
        const x0 = (x - worldMinX) * scale;
        return {
          p0: { x: x0, y: baseY + vertexJitter(x, worldEdgeY, 52011) },
          c1: { x: x0 + scale * 0.32, y: baseY + vertexJitter(x * 3 + 1, worldEdgeY * 3, 52012) },
          c2: { x: x0 + scale * 0.68, y: baseY + vertexJitter(x * 3 + 2, worldEdgeY * 3, 52013) },
          p3: { x: x0 + scale, y: baseY + vertexJitter(x + 1, worldEdgeY, 52011) }
        };
      },

      strokeCachedOrganicCurve(context, curve) {
        context.beginPath();
        context.moveTo(curve.p0.x, curve.p0.y);
        context.bezierCurveTo(curve.c1.x, curve.c1.y, curve.c2.x, curve.c2.y, curve.p3.x, curve.p3.y);
        context.stroke();
      },

      // V0.21.7 tried to widen this into a real material crossfade, and every variant was rejected
      // on sight: a 1-tile gradient stroke read as airbrushed smear, and pairing a wider edge jitter
      // with under-texture bleed lobes chained into snaking ribbons across the ground. Reverted to
      // exactly its previous form. Blending two flat-filled tile materials convincingly needs the
      // authored terrain atlases with real transition tiles (Phase 15), not a wider procedural seam.
      drawCachedMaterialBoundary(context, x, y, edge, worldMinX, worldMinY, scale, material, otherMaterial) {
        const curve = this.cachedOrganicEdgeCurve(x, y, edge, worldMinX, worldMinY, scale);
        const flip = this.hash2D(x + edge.dx, y + edge.dy, 52101) > 0.5;
        // Scales the whole accent. See terrain.seamStrength in systems/art-direction-system.js.
        const seam = this.terrainSeamStrength();
        context.save();
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.globalAlpha = 0.34 * seam;
        context.strokeStyle = flip ? material.base : otherMaterial.base;
        context.lineWidth = scale * 0.38;
        this.strokeCachedOrganicCurve(context, curve);
        context.globalAlpha = 0.32 * seam;
        context.strokeStyle = flip ? otherMaterial.base : material.base;
        context.lineWidth = scale * 0.24;
        this.strokeCachedOrganicCurve(context, curve);
        // The `light` tint drawn along the seam is what reads most as a hard PENCILLED edge, so it
        // falls off faster than the two base-colour bands beneath it. At seamStrength 1 this is
        // still the original 0.14.
        context.globalAlpha = 0.14 * seam * seam;
        context.strokeStyle = flip ? otherMaterial.light : material.light;
        context.lineWidth = scale * 0.075;
        this.strokeCachedOrganicCurve(context, curve);
        context.restore();
      },

      drawCachedShoreContour(context, x, y, edge, worldMinX, worldMinY, scale, material) {
        const curve = this.cachedOrganicEdgeCurve(x, y, edge, worldMinX, worldMinY, scale, scale * 0.035);
        context.save();
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.globalAlpha = 0.28;
        context.strokeStyle = material.dark;
        context.lineWidth = scale * 0.23;
        this.strokeCachedOrganicCurve(context, curve);
        context.globalAlpha = 0.92;
        context.strokeStyle = material.base;
        context.lineWidth = scale * 0.16;
        this.strokeCachedOrganicCurve(context, curve);
        context.globalAlpha = 0.26;
        context.strokeStyle = material.light;
        context.lineWidth = scale * 0.055;
        this.strokeCachedOrganicCurve(context, curve);
        context.restore();
      },

      createTerrainChunkSurface(width, height) {
        let canvas = null;
        if (typeof OffscreenCanvas === 'function') canvas = new OffscreenCanvas(width, height);
        else if (typeof document !== 'undefined' && document.createElement) {
          canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
        }
        const context = canvas?.getContext?.('2d');
        if (!canvas || !context) return null;
        context.imageSmoothingEnabled = true;
        return { canvas, context };
      },

      terrainChunkSignature(chunkX, chunkY) {
        const size = this.terrainChunkSize();
        const startX = chunkX * size;
        const startY = chunkY * size;
        let hash = 2166136261;
        // Include neighboring tiles so elevation lips, shoreline caps, and material masks
        // invalidate across chunk boundaries instead of leaving stale edge seams.
        const samplePadding = Math.max(1, Number(this.terrainChunkEdgeSamplePaddingTiles?.()) || 2);
        for (let y = startY - samplePadding; y <= startY + size + samplePadding - 1; y++) {
          const row = this.map?.[y];
          for (let x = startX - samplePadding; x <= startX + size + samplePadding - 1; x++) {
            const tile = row?.[x];
            const depth = tile && this.isTerrainChunkWaterTile(tile) ? Math.max(0, Math.min(15, Math.floor(Number(tile.waterDepth) || 0))) : 0;
            const packed = tile ? ((Number(tile.type) & 255) | (((Number(tile.elev) || 0) & 31) << 8) | (depth << 13)) : 65535;
            hash ^= packed;
            hash = Math.imul(hash, 16777619);
          }
        }
        return hash >>> 0;
      },

      // Strength/frequency for the chunk macro wash, from the art profile. terrain.macroVariation
      // shipped in V0.20.96 and was read by NOTHING until this. Falls back to 0 (no wash) rather than
      // to a guess, so a malformed profile leaves terrain exactly as it was.
      // V0.21.4 (Art Direction): AMBIENT GRADE. The reference image's ground sits at luma 72.6 with
      // saturation 0.444; measured in-game with weather cleared, ours sat at luma 128.5 / saturation
      // 0.405 - so the HUE AND RICHNESS WERE ALREADY CLOSE (a 0.039 saturation gap) and the whole
      // visible difference was BRIGHTNESS, 1.77x too high. That is one lever, not a terrain rebuild.
      //
      // The profile's ambient.value of 0.72 would only reach luma 92.5, still well above the target,
      // so the grade is applied against a measured coefficient rather than the nominal one. Saturation
      // is nudged rather than pushed, because it was nearly right already - over-saturating muddy
      // earth is how "muted earth tones" turns into orange mud.
      //
      // Applied to the MATERIAL BASE inside the chunk build, which is where terrain is genuinely drawn
      // (drawTile runs ~34 times a frame; drawGroundDetail never runs at all - see V0.21.3).
      // Darkening applied to the finished chunk layer, derived from the profile's ambient.value.
      // Measured: composite luma sat at 93.0 against the reference's 72.6, so ~0.22 closes it.
      // V0.21.5: THE TERRAIN DETAIL PASS. The reference art's ground is dense with pebbles, small
      // stones, dirt clumps, cracks and grass - "instead of large flat-color tiles, the ground uses
      // noise, cracks, stones, dirt variation, moss, and irregular shading". This draws that, into the
      // CHUNK LAYER where terrain is actually built, so it is cached and costs nothing per frame.
      //
      // Deterministic per tile: every element is placed from hash2D on the tile's own coordinates, so
      // the same tile always looks the same and chunk rebuilds are stable.
      // V0.21.7: HEIGHT LIGHTING AND AMBIENT OCCLUSION - "more 3D without being 3D".
      //
      // A flat-shaded surface reads as flat no matter how much texture sits on it, because the eye
      // judges form from LIGHT, not from detail. This gives every ground tile a lit side and a shaded
      // side derived from the actual height field, plus occlusion darkening where geometry crowds in.
      // Nothing here is 3D - it is per-tile shading computed from neighbouring elevations - but it is
      // the same information a 3D renderer would use, which is why it reads as volume.
      //
      // THREE EFFECTS, all baked into the chunk layer so they cost nothing per frame:
      //
      //   1. DIRECTIONAL LIGHT. A fixed sun from the north-west, the convention this projection
      //      already implies. Ground sloping toward it lightens; ground sloping away darkens. The
      //      slope comes from the elevation gradient across the tile's neighbours, so a hillside gets
      //      a consistently lit face and a consistently shaded one instead of uniform colour.
      //
      //   2. AMBIENT OCCLUSION. Tiles hemmed in by higher ground go darker, proportional to how much
      //      taller the surroundings are. This is what puts real depth into the base of a cliff, a
      //      gully or a step - the darkening that the human eye reads as "something is above me".
      //      It is also, finally, the ground contact shadow at the foot of cliffs that four separate
      //      attempts failed to produce (documented in V0.20.94) - approached from the height field
      //      rather than from projected geometry, which is why it works.
      //
      //   3. EDGE HIGHLIGHT. The lip of a drop catches light. One bright line along the top of a step
      //      does more for perceived relief than any amount of surface shading below it.
      drawChunkHeightLighting(c, x, y, px, py, scale, tile) {
        if (!c) return;
        const map = this.map;
        if (!map) return;
        const e = (xx, yy) => {
          const t = map[yy]?.[xx];
          return t ? (Number(t.elev) || 0) : null;
        };
        const here = Number(tile?.elev) || 0;
        const S = scale;

        // Neighbour heights; missing tiles fall back to our own so map edges do not carve a trench.
        const nN = e(x, y - 1) ?? here, nS = e(x, y + 1) ?? here;
        const nW = e(x - 1, y) ?? here, nE = e(x + 1, y) ?? here;
        const nNW = e(x - 1, y - 1) ?? here, nSE = e(x + 1, y + 1) ?? here;

        // --- 0. ELEVATION TONE. The cue that was missing: raised ground and the ground below it
        // were rendering at the SAME tone, so a plateau read as "walls between two flat areas"
        // rather than as a mass standing above the land. Height itself has to change the colour.
        //
        // Physically this is sky exposure - high open ground sees more of the sky dome and catches
        // more light, low ground sits deeper in ambient shadow. It is also how every isometric game
        // that reads well handles it, and it does more for legibility than any wall detailing,
        // because it works at a glance and at any zoom.
        //
        // Warm on the lift, cool on the sink, so height reads as light rather than as bleach.
        // Clamped hard: this is a legibility cue, not a gradient ramp, and beyond a few levels of
        // elevation further separation stops meaning anything.
        {
          // Ramp measured, not guessed: at here/5 x 0.22 adjacent elevation levels separated by only
          // 1.8 luma - present in the data, invisible to the eye. here/3 x 0.30 puts roughly 6-7 luma
          // between neighbouring levels, which is the point a step starts reading as a step.
          const lift = Math.max(-1, Math.min(1, here / 3));
          if (Math.abs(lift) > 0.02) {
            const a = Math.abs(lift) * 0.30;
            c.fillStyle = lift > 0 ? `rgba(255,240,206,${a.toFixed(4)})`
                                   : `rgba(10,12,20,${(a * 1.1).toFixed(4)})`;
            c.fillRect(px - 0.5, py - 0.5, S + 1, S + 1);
          }
        }

        // --- 1. DIRECTIONAL LIGHT from the north-west.
        // Gradient: positive means the ground rises toward the light, so the face turns to meet it.
        const grad = ((here - nNW) * 0.70 + (here - nN) * 0.5 + (here - nW) * 0.5) / 3;
        if (Math.abs(grad) > 0.02) {
          const lit = Math.max(-1, Math.min(1, grad * 0.85));
          const a = Math.min(0.30, Math.abs(lit) * 0.26);
          c.fillStyle = lit > 0 ? `rgba(255,242,214,${a.toFixed(4)})`
                                : `rgba(12,14,22,${(a * 1.15).toFixed(4)})`;
          c.fillRect(px - 0.5, py - 0.5, S + 1, S + 1);
        }

        // --- 2. AMBIENT OCCLUSION from surrounding height.
        let above = 0;
        for (const n of [nN, nS, nW, nE, nNW, nSE]) if (n > here) above += Math.min(3, n - here);
        if (above > 0) {
          const ao = Math.min(0.42, above * 0.085);
          // Strongest against the side the higher ground is on, so it reads as a shadow cast by that
          // mass rather than a uniform dimming of the whole tile.
          const gx = ((nW > here ? nW - here : 0) - (nE > here ? nE - here : 0));
          const gy = ((nN > here ? nN - here : 0) - (nS > here ? nS - here : 0));
          const len = Math.hypot(gx, gy) || 1;
          const cxp = px + S * 0.5 - (gx / len) * S * 0.34;
          const cyp = py + S * 0.5 - (gy / len) * S * 0.34;
          const g = c.createRadialGradient(cxp, cyp, S * 0.08, cxp, cyp, S * 0.95);
          g.addColorStop(0, `rgba(6,8,14,${ao.toFixed(4)})`);
          g.addColorStop(1, 'rgba(6,8,14,0)');
          c.fillStyle = g;
          c.fillRect(px - 0.5, py - 0.5, S + 1, S + 1);
        }

        // --- 3. EDGE HIGHLIGHT along the top lip of a drop.
        const dropS = here - nS, dropE = here - nE;
        if (dropS > 0 || dropE > 0) {
          c.save();
          c.globalAlpha = Math.min(0.34, Math.max(dropS, dropE) * 0.20);
          c.strokeStyle = 'rgba(255,246,222,0.9)';
          c.lineWidth = Math.max(1, S * 0.035);
          c.beginPath();
          if (dropS > 0) { c.moveTo(px, py + S); c.lineTo(px + S, py + S); }
          if (dropE > 0) { c.moveTo(px + S, py); c.lineTo(px + S, py + S); }
          c.stroke();
          c.restore();
        }
      },

      drawChunkGroundTexture(c, x, y, px, py, scale, material, tile) {
        if (!c || !material) return;
        const DRu = window.DreamRealms;
        const P = DRu.ART_PROFILE?.terrain || {};
        const colorShade = DRu.utils?.colorShade;
        if (!colorShade) return;
        const h = (k) => this.hash2D(x, y, k);
        const base = material.base;

        const TILE = DRu.TILE || {};
        const t = tile?.type;
        const grassy = t === TILE.DEEP_GRASS || t === TILE.DARK_GRASS || t === TILE.UNDERBRUSH;
        const stony  = t === TILE.STONE || t === TILE.RUIN || t === TILE.CAVE_FLOOR;

        // Local RNG seeded per tile so element counts and positions are stable but uncorrelated
        // between neighbours - the mottle has to look scattered, not gridded.
        let seed = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
        const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 374761393) >>> 0; return seed / 4294967296; };

        const S = scale;
        const X0 = px, Y0 = py;

        // --- 1. DIRT SPECKLE: fine grain over everything. This is what kills the "flat colour" read
        // at close range; without it the eye sees a solid fill however many big rocks sit on top.
        const speckle = Math.round(S * S * 0.014 * (0.6 + (Number(P.decalDensity) || 0.42)));
        for (let i = 0; i < speckle; i++) {
          const sx = X0 + rnd() * S, sy = Y0 + rnd() * S;
          const dark = rnd() > 0.42;
          c.fillStyle = dark ? `rgba(0,0,0,${(0.05 + rnd() * 0.13).toFixed(3)})`
                             : `rgba(255,240,214,${(0.03 + rnd() * 0.07).toFixed(3)})`;
          const r = 0.5 + rnd() * 1.4;
          c.fillRect(sx, sy, r, r);
        }

        // --- 2. DIRT CLUMPS: soft irregular patches of tone, larger than speckle, smaller than the
        // macro wash. Fills the mid-frequency gap that made the ground read as noise-on-flat.
        const clumps = 3 + Math.floor(rnd() * 4);
        for (let i = 0; i < clumps; i++) {
          const cxp = X0 + rnd() * S, cyp = Y0 + rnd() * S;
          const rx = S * (0.06 + rnd() * 0.13), ry = rx * (0.5 + rnd() * 0.5);
          c.fillStyle = rnd() > 0.5 ? `rgba(0,0,0,${(0.04 + rnd() * 0.07).toFixed(3)})`
                                    : `rgba(150,120,86,${(0.05 + rnd() * 0.09).toFixed(3)})`;
          c.beginPath();
          c.ellipse(cxp, cyp, Math.max(0.5, rx), Math.max(0.4, ry), rnd() * 3.14, 0, Math.PI * 2);
          c.fill();
        }

        // --- 3. PEBBLES AND STONES, each with a lit top and a dark side so it reads as a solid object
        // sitting ON the ground rather than a painted dot. This is the single biggest contributor to
        // the reference's texture.
        const pebbles = (stony ? 9 : 5) + Math.floor(rnd() * (stony ? 8 : 6));
        for (let i = 0; i < pebbles; i++) {
          const sx = X0 + rnd() * S, sy = Y0 + rnd() * S;
          const r = S * (0.012 + rnd() * 0.030);
          if (r < 0.6) continue;
          c.fillStyle = `rgba(0,0,0,${(0.16 + rnd() * 0.12).toFixed(3)})`;     // contact shadow
          c.beginPath(); c.ellipse(sx, sy + r * 0.55, r * 1.15, r * 0.62, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = colorShade(base, 14 + rnd() * 22);                      // lit body
          c.beginPath(); c.ellipse(sx, sy, r, r * 0.82, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = `rgba(0,0,0,${(0.12 + rnd() * 0.10).toFixed(3)})`;      // shaded underside
          c.beginPath(); c.ellipse(sx + r * 0.16, sy + r * 0.24, r * 0.72, r * 0.5, 0, 0, Math.PI * 2); c.fill();
        }

        // --- 4. CRACKS, from the profile's crackDensity. Short jagged runs, not smooth curves.
        const crackChance = Number(P.crackDensity) || 0.28;
        if (h(9311) < crackChance) {
          const segs = 3 + Math.floor(rnd() * 3);
          let cxp = X0 + rnd() * S, cyp = Y0 + rnd() * S;
          c.strokeStyle = `rgba(0,0,0,${(0.16 + rnd() * 0.16).toFixed(3)})`;
          c.lineWidth = 0.6 + rnd() * 0.9;
          c.beginPath(); c.moveTo(cxp, cyp);
          for (let i = 0; i < segs; i++) {
            cxp += (rnd() - 0.5) * S * 0.34; cyp += (rnd() - 0.5) * S * 0.30;
            c.lineTo(cxp, cyp);
          }
          c.stroke();
        }

        // --- 5. MOSS on grass and stone, from the profile's mossDensity.
        const mossChance = Number(P.mossDensity) || 0.22;
        if ((grassy || stony) && h(6127) < mossChance) {
          const patches = 2 + Math.floor(rnd() * 3);
          for (let i = 0; i < patches; i++) {
            const sx = X0 + rnd() * S, sy = Y0 + rnd() * S;
            c.fillStyle = `rgba(${stony ? '86,102,58' : '74,96,52'},${(0.10 + rnd() * 0.16).toFixed(3)})`;
            c.beginPath();
            c.ellipse(sx, sy, S * (0.04 + rnd() * 0.09), S * (0.025 + rnd() * 0.05), rnd() * 3.14, 0, Math.PI * 2);
            c.fill();
          }
        }

        // --- 6. GRASS BLADES on grassy ground: short upright strokes, lit at the tip. The reference
        // has these breaking the ground silhouette wherever earth meets vegetation.
        if (grassy) {
          const blades = 5 + Math.floor(rnd() * 7);
          for (let i = 0; i < blades; i++) {
            const sx = X0 + rnd() * S, sy = Y0 + rnd() * S;
            const hgt = S * (0.05 + rnd() * 0.09);
            const lean = (rnd() - 0.5) * hgt * 0.55;
            c.strokeStyle = `rgba(${88 + rnd() * 40 | 0},${112 + rnd() * 46 | 0},${52 + rnd() * 30 | 0},${(0.32 + rnd() * 0.34).toFixed(3)})`;
            c.lineWidth = 0.7 + rnd() * 0.6;
            c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + lean * 0.5, sy - hgt * 0.6, sx + lean, sy - hgt); c.stroke();
          }
        }
      },

      ambientLayerGradeAlpha() {
        const v = Number(window.DreamRealms.ART_PROFILE?.ambient?.layerGrade);
        return Number.isFinite(v) && v >= 0 && v < 1 ? v : 0;
      },

      gradeAmbientColour(css) {
        const cache = this._ambientGradeCache || (this._ambientGradeCache = new Map());
        const hit = cache.get(css);
        if (hit) return hit;
        const A = window.DreamRealms.ART_PROFILE?.ambient;
        const vIn = Number(A?.value), sIn = Number(A?.saturation);
        const v = Number.isFinite(vIn) && vIn > 0 ? vIn : 1;
        const sat = Number.isFinite(sIn) && sIn > 0 ? sIn : 1;
        if (v === 1 && sat === 1) { cache.set(css, css); return css; }

        const m = /^#?([0-9a-f]{6})$/i.exec(String(css).trim());
        if (!m) { cache.set(css, css); return css; }
        const n = parseInt(m[1], 16);
        let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;

        // Saturation about the luma axis, so hue is preserved and only vividness moves.
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const satScale = sat;                          // full strength; see the profile note - this LIFTS
        r = L + (r - L) * satScale;
        g = L + (g - L) * satScale;
        b = L + (b - L) * satScale;

        const clamp = x => Math.max(0, Math.min(255, Math.round(x)));
        const out = `rgb(${clamp(r * v)},${clamp(g * v)},${clamp(b * v)})`;
        cache.set(css, out);
        return out;
      },

      terrainMacroAmount() {
        const a = Number(window.DreamRealms.ART_PROFILE?.terrain?.macroVariation);
        return Number.isFinite(a) && a > 0 ? Math.min(1, a) : 0;
      },

      // Strength of the broad world-anchored ellipse patches stamped into a chunk. 0 disables them
      // entirely, which is the shipped default - see the note on terrain.macroPatchStrength in
      // systems/art-direction-system.js. Kept as a knob rather than deleted so the technique can be
      // retuned (smaller radii, softer falloff) instead of being rediscovered from scratch.
      terrainMacroPatchStrength() {
        const a = Number(window.DreamRealms.ART_PROFILE?.terrain?.macroPatchStrength);
        return Number.isFinite(a) && a > 0 ? Math.min(1, a) : 0;
      },

      // Contrast of the material-transition accent. Defaults to 1 (the original look) when the
      // profile is missing or malformed, rather than to a guess.
      terrainSeamStrength() {
        const a = Number(window.DreamRealms.ART_PROFILE?.terrain?.seamStrength);
        return Number.isFinite(a) && a >= 0 ? Math.min(1, a) : 1;
      },

      // WATER-EDGE CORNER ROUNDING WAS TRIED HERE IN V0.21.7 AND REMOVED. Do not re-attempt it.
      //
      // Water is filled per tile as a rect, so a shoreline is literally the tile lattice. Rounding a
      // water tile's EXPOSED corners (both orthogonal neighbours land) looks like the obvious fix and
      // does essentially nothing, because of how shorelines are actually shaped. Censused over 710
      // water tiles:
      //   - only 158 (22.3%) have any exposed corner at all
      //   - 145 (20.4%) are STRAIGHT-shore tiles with land on exactly one side, whose two corners are
      //     both shared with water neighbours and so can never round
      // Measured effect at a 0.32-tile radius: 0.08% of water coverage changed. Pushed to the 0.5
      // ceiling, where the rounding meets in the middle of a tile, the staircase still read hard -
      // because the staircase is made of the straight runs that rounding cannot touch.
      //
      // NOR IS THIS A CAMERA PROBLEM, the other candidate. The camera snaps to 4 headings and
      // 0/90/180/270 all map the diamond lattice onto itself, so rotation cannot change the shoreline
      // at all. Forcing an unsnapped 45 degrees was tested in-world: it converts the diagonal
      // staircase into a rectilinear one and flattens the isometric read - worse on both counts.
      //
      // A smooth shoreline needs SUB-TILE geometry: a marching-squares contour over the water grid, or
      // authored shoreline/transition tiles (the doc's Phase 15).

      // Drifting surface flow on open water.
      //
      // WHY THIS EXISTS AT ALL: the chunk already bakes a shimmer layer, and drawTerrainChunks
      // animates it — but only its ALPHA, via `shimmerAlpha = 0.24 + sin(t)*0.075`. The squiggles
      // themselves are baked, so they brighten and dim in place and nothing ever travels. Water read
      // as completely still. This pass adds movement that actually goes somewhere.
      //
      // A LIVE PASS for the same reason the waterfalls are: a cached chunk cannot animate. It is
      // kept cheap by clipping ONCE to the union of visible water diamonds and then drawing a single
      // lattice of streaks over that region, rather than doing per-tile work.
      //
      // THE LATTICE LIVES IN WORLD SPACE, not screen space. Streaks are placed on a world grid,
      // scrolled along a world-space direction, and each endpoint is projected through
      // worldToScreen. That keeps the current consistent when the camera rotates; scrolling in
      // screen space would make the river change direction every time the player pressed Q or E.
      renderWaterFlow(minX, maxX, minY, maxY) {
        const { ctx } = window.DreamRealms.runtime || {};
        const map = this.map;
        const cfg = window.DreamRealms.ART_PROFILE?.terrain?.waterFlow;
        if (!ctx || !map || !cfg) return 0;
        const strength = Number(cfg.strength) || 0;
        if (strength <= 0) return 0;

        // --- clip to the union of visible water tiles, so streaks cannot spill onto land ---
        let tiles = 0;
        ctx.save();
        ctx.beginPath();
        for (let y = minY; y <= maxY; y++) {
          const row = map[y];
          if (!row) continue;
          for (let x = minX; x <= maxX; x++) {
            const tile = row[x];
            if (!this.isTerrainChunkWaterTile(tile)) continue;
            const e = Number(tile.elev) || 0;
            const p0 = this.worldToScreen(x, y, e);
            const p1 = this.worldToScreen(x + 1, y, e);
            const p2 = this.worldToScreen(x + 1, y + 1, e);
            const p3 = this.worldToScreen(x, y + 1, e);
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            tiles++;
          }
        }
        if (!tiles) { ctx.restore(); return 0; }
        ctx.clip();

        const t = performance.now() * 0.001;
        const step = Math.max(0.6, Number(cfg.density) || 1.5);
        const speed = Number(cfg.speed) || 0.055;
        let dx = Number(cfg.dirX) || 1, dy = Number(cfg.dirY) || 0;
        const dlen = Math.hypot(dx, dy) || 1;
        dx /= dlen; dy /= dlen;
        // Scroll offset wrapped to the lattice period, so streaks recycle seamlessly instead of
        // marching off to infinity and losing precision.
        const travel = (t * speed) % step;

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        let drawn = 0;

        // LITTLE WAVE CRESTS. Three primitives were tried before this and each failed for a reason
        // worth keeping, because each looked plausible in code:
        //   - thin strokes ALONG the current read unmistakably as RAIN. Evenly spaced, thin,
        //     high-contrast diagonals are exactly what falling precipitation looks like.
        //   - solid ctx.ellipse fills read as LILY PADS - hard-edged ovals floating on the lake.
        //   - soft radial blobs read as an oil sheen: tonal, but with no structure to identify as
        //     water.
        // A wave has a CREST, and a crest runs ACROSS the current, not along it. That single
        // difference is what makes this read as water rather than as weather or as a stain.
        const perpX = -dy, perpY = dx;
        const wavePass = (spacing, lenLo, lenHi, rate, seed, aLo, aHi, width, lift, withTrough = true) => {
          const localTravel = (t * speed * rate) % spacing;
          for (let gy = minY - spacing; gy <= maxY + spacing; gy += spacing) {
            for (let gx = minX - spacing; gx <= maxX + spacing; gx += spacing) {
              const h1 = this.hash2D(Math.round(gx * 7), Math.round(gy * 7), seed);
              const h2 = this.hash2D(Math.round(gy * 11), Math.round(gx * 11), seed + 1);
              // Jitter off the lattice so crests never line up into a grid.
              const ox = gx + (h1 - 0.5) * spacing * 0.95 + dx * localTravel;
              const oy = gy + (h2 - 0.5) * spacing * 0.95 + dy * localTravel;
              const tile = map[Math.floor(oy)]?.[Math.floor(ox)];
              if (!this.isTerrainChunkWaterTile(tile)) continue;   // cull before projecting
              const e = Number(tile.elev) || 0;

              const half = (lenLo + h1 * (lenHi - lenLo)) * 0.5;
              // Crest runs across the current; the middle bows downstream so it curves like a
              // ripple instead of being a straight dash.
              const bow = 0.16 + h2 * 0.20;
              const p0 = this.worldToScreen(ox - perpX * half, oy - perpY * half, e);
              const pc = this.worldToScreen(ox + dx * bow, oy + dy * bow, e);
              const p2 = this.worldToScreen(ox + perpX * half, oy + perpY * half, e);
              const life = Math.sin(((localTravel / spacing) + h2) % 1 * Math.PI);
              const alpha = (aLo + h2 * (aHi - aLo)) * strength * life;
              if (alpha <= 0.004) continue;

              // Shadowed trough just behind the crest, then the lit crest itself. Two thin strokes
              // a couple of pixels apart is what gives a ripple its roll - a single line is a dash.
              // The finest octave skips the trough: at that size it is under a pixel and invisible,
              // so it would double the stroke count for nothing.
              if (withTrough) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = alpha * 0.55;
                ctx.strokeStyle = '#0e2d3c';
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y + lift);
                ctx.quadraticCurveTo(pc.x, pc.y + lift, p2.x, p2.y + lift);
                ctx.stroke();
              }

              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = alpha;
              ctx.strokeStyle = '#cbe9f4';
              ctx.lineWidth = width;
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.quadraticCurveTo(pc.x, pc.y, p2.x, p2.y);
              ctx.stroke();
              drawn++;
            }
          }
        };

        ctx.lineCap = 'round';
        // THREE OCTAVES. Detail here comes from adding spatial frequencies, not from raising alpha
        // on the ones already present - two scales alone left the surface reading as sparse dashes
        // however bright they were. Each octave is roughly half the spacing and travels faster, the
        // way smaller ripples genuinely outrun larger swells.
        // CREST COUNT SCALES AS 1/spacing², so a finer octave is quadratically expensive. Measured:
        // dropping the third octave to 0.62 spacing took the pass from ~124 crests and unmeasurable
        // cost to ~530 crests and ~6.1ms/frame, and visibility went DOWN (mean delta 2.62 → 1.30)
        // because sub-pixel strokes at low alpha do not register. More detail is not more crests -
        // it is crests you can actually see. The fine octave is therefore sparser and BRIGHTER than
        // the instinct says, and skips its trough stroke entirely.
        wavePass(step * 1.9, 1.5, 2.6, 0.60, 60201, 0.06, 0.11, 1.7, 2.2);   // slow swells
        wavePass(step * 1.05, 0.7, 1.4, 1.00, 60101, 0.06, 0.115, 1.2, 1.5); // mid ripples
        wavePass(step * 0.90, 0.38, 0.80, 1.45, 60401, 0.06, 0.12, 1.0, 0, false); // fine chop

        ctx.restore();
        this._waterFlowStreaks = drawn;
        this._waterFlowTiles = tiles;
        return drawn;
      },

      // Waterfalls where raised water spills over an elevation drop.
      //
      // A LIVE PER-FRAME PASS, deliberately, where almost everything else terrain-related is baked
      // into the chunk cache. Falling water has to animate, and a cached chunk by definition cannot.
      // Cost is unmeasurable in practice (0.05ms signal against 0.3ms drift) because the situation is
      // rare: 12 of 1455 water tiles sit above their neighbours, over 14 drop edges.
      //
      // GEOMETRY IS COMPUTED HERE rather than taken from exposure.faces, because water only earns a
      // structural pass when a neighbour is NOT water (terrainTileNeedsStructuralPass), and every
      // drop in this world is water-to-water, so the wall-face path never runs on them. A drop face
      // is the shared tile edge extruded straight down: elevation shifts screen Y only, so the top
      // and bottom edges stay parallel.
      //
      // EDGES ARE CHAINED INTO CONTINUOUS RUNS before drawing, and that is the whole point of this
      // version. Drawing each edge as its own quad produced a row of separate panels with hard
      // corners between them - repeatedly reported as "not connected" - because a diagonal stream
      // spills over a STAIRCASE of tile edges, and neighbouring edges that genuinely share a vertex
      // were still being drawn as unrelated sheets. Measured on this map: 7 front-facing edges chain
      // into 4 runs, one of them three edges long. Within a run there is now a single clip path, a
      // single lip stroke and streaks that cross tile boundaries, so it reads as one curtain.
      //
      // Runs that remain separate ARE correct - the stream really does stop spilling and resume
      // further along - so this closes the false gaps without inventing water where none falls.
      renderWaterfalls(minX, maxX, minY, maxY) {
        const { ctx } = window.DreamRealms.runtime || {};
        const map = this.map;
        if (!ctx || !map) return 0;
        const STEP = Number(window.DreamRealms.CONFIG?.ELEV_STEP) || 45;
        const t = performance.now();
        const EDGES = [
          { dx: 1, dy: 0, ax: 1, ay: 0, bx: 1, by: 1, k: 'e' },
          { dx: -1, dy: 0, ax: 0, ay: 0, bx: 0, by: 1, k: 'w' },
          { dx: 0, dy: 1, ax: 0, ay: 1, bx: 1, by: 1, k: 's' },
          { dx: 0, dy: -1, ax: 0, ay: 0, bx: 1, by: 0, k: 'n' }
        ];

        // ---- 1. collect front-facing spill edges as WORLD-space segments ----
        const segs = [];
        for (let y = minY; y <= maxY; y++) {
          const row = map[y];
          if (!row) continue;
          for (let x = minX; x <= maxX; x++) {
            const tile = row[x];
            if (!this.isTerrainChunkWaterTile(tile)) continue;
            const elev = Number(tile.elev) || 0;
            for (const e of EDGES) {
              const other = map[y + e.dy]?.[x + e.dx];
              if (!other) continue;
              const oe = Number(other.elev) || 0;
              if (oe >= elev) continue;

              // Front-face test. Both samples are taken at THE SAME ELEVATION on purpose: what
              // decides whether a wall faces the camera is the direction of its outward normal in
              // the ground plane, nothing to do with how far it drops. Sampling each tile at its own
              // elevation folds the drop into the comparison and the drop dominates - 2 steps is
              // 90px against a 34px lateral offset - so every face passes and the back-facing walls
              // get drawn too. Sampling worldToScreen keeps this correct at every snap angle, where
              // a fixed compass check would not.
              const here = this.worldToScreen(x + 0.5, y + 0.5, elev);
              const there = this.worldToScreen(x + e.dx + 0.5, y + e.dy + 0.5, elev);
              if (there.y <= here.y) continue;

              const dz = (elev - oe) * STEP;
              if (!(dz > 1)) continue;
              segs.push({ ax: x + e.ax, ay: y + e.ay, bx: x + e.bx, by: y + e.by,
                          elev, dz, k: e.k, tx: x, ty: y });
            }
          }
        }
        if (!segs.length) { this._waterfallFacesDrawn = 0; this._waterfallRunsDrawn = 0; return 0; }

        // ---- 2. chain segments sharing a world vertex into runs ----
        const runs = this.chainWaterfallSegments(segs);

        // ---- 3. draw each run as ONE sheet ----
        for (const run of runs) this.drawWaterfallRun(ctx, run, t);

        this._waterfallFacesDrawn = segs.length;
        this._waterfallRunsDrawn = runs.length;
        return segs.length;
      },

      // Walks the shared-vertex graph and returns ordered vertex chains. Segments meet only at
      // integer tile corners, so an exact string key is a safe identity here - no epsilon needed.
      chainWaterfallSegments(segs) {
        const key = (x, y) => x + ',' + y;
        const byVert = new Map();
        for (const s of segs) {
          for (const k of [key(s.ax, s.ay), key(s.bx, s.by)]) {
            if (!byVert.has(k)) byVert.set(k, []);
            byVert.get(k).push(s);
          }
        }
        const used = new Set();
        const runs = [];

        const walk = (seg, fromKey) => {
          // Follow the chain from one end, consuming segments as it goes.
          const pts = [];
          let cur = seg;
          let atKey = fromKey;
          for (;;) {
            used.add(cur);
            const aK = key(cur.ax, cur.ay), bK = key(cur.bx, cur.by);
            const startIsA = atKey === aK;
            const sx = startIsA ? cur.ax : cur.bx, sy = startIsA ? cur.ay : cur.by;
            const ex = startIsA ? cur.bx : cur.ax, ey = startIsA ? cur.by : cur.ay;
            if (!pts.length) pts.push({ x: sx, y: sy, dz: cur.dz, elev: cur.elev });
            pts.push({ x: ex, y: ey, dz: cur.dz, elev: cur.elev });
            const nextKey = startIsA ? bK : aK;
            const cand = (byVert.get(nextKey) || []).find(s2 => s2 !== cur && !used.has(s2));
            if (!cand) return pts;
            cur = cand;
            atKey = nextKey;
          }
        };

        // Start from chain ENDS (vertices touched by exactly one segment) so open runs come out in
        // order; anything left after that is a closed loop and can start anywhere.
        for (const s of segs) {
          if (used.has(s)) continue;
          const aOpen = (byVert.get(key(s.ax, s.ay)) || []).length === 1;
          const bOpen = (byVert.get(key(s.bx, s.by)) || []).length === 1;
          if (!aOpen && !bOpen) continue;
          runs.push(walk(s, aOpen ? key(s.ax, s.ay) : key(s.bx, s.by)));
        }
        for (const s of segs) {
          if (used.has(s)) continue;
          runs.push(walk(s, key(s.ax, s.ay)));
        }
        return runs;
      },

      // Draws one chained run as a single continuous curtain.
      drawWaterfallRun(ctx, pts, t) {
        if (!pts || pts.length < 2) return;

        // Top line at each vertex's own surface elevation; bottom is that point dropped by its own
        // dz. Carrying both per-vertex keeps a run correct even where two drops differ in height,
        // rather than assuming one elevation for the whole chain.
        const A = [], B = [];
        for (const p of pts) {
          const s = this.worldToScreen(p.x, p.y, p.elev);
          A.push(s);
          B.push({ x: s.x, y: s.y + p.dz });
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(A[0].x, A[0].y);
        for (let i = 1; i < A.length; i++) ctx.lineTo(A[i].x, A[i].y);
        for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i].x, B[i].y);
        ctx.closePath();
        ctx.clip();

        let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
        for (const p of A) { if (p.y < minY) minY = p.y; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }
        for (const p of B) { if (p.y > maxY) maxY = p.y; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }

        // THE COLUMN SIDE, opaque. Nothing else draws it: a water tile only earns a structural pass
        // when a neighbour is NOT water, and these drops are water-to-water, so the side of the
        // raised channel was never rendered at all. A translucent sheet here let the lake show
        // through and the raised water read as a curtain hanging in mid-air.
        const body = ctx.createLinearGradient(0, minY, 0, maxY);
        body.addColorStop(0, 'rgb(64,124,140)');
        body.addColorStop(0.55, 'rgb(36,86,104)');
        body.addColorStop(1, 'rgb(18,52,68)');
        ctx.fillStyle = body;
        ctx.fillRect(minX - 2, minY - 2, (maxX - minX) + 4, (maxY - minY) + 4);

        // --- falling streaks, spaced along the WHOLE run so they cross tile boundaries ---
        const runLen = A.reduce((acc, p, i) => i ? acc + Math.hypot(p.x - A[i-1].x, p.y - A[i-1].y) : 0, 0);
        const pointAt = (u) => {
          const want = u * runLen;
          let acc = 0;
          for (let i = 1; i < A.length; i++) {
            const d = Math.hypot(A[i].x - A[i-1].x, A[i].y - A[i-1].y);
            if (acc + d >= want || i === A.length - 1) {
              const f = d > 0 ? Math.max(0, Math.min(1, (want - acc) / d)) : 0;
              return { x: A[i-1].x + (A[i].x - A[i-1].x) * f,
                       y: A[i-1].y + (A[i].y - A[i-1].y) * f,
                       dz: pts[i].dz };
            }
            acc += d;
          }
          return { x: A[0].x, y: A[0].y, dz: pts[0].dz };
        };
        const N = Math.max(6, Math.round(runLen / 11));
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N; i++) {
          const j = this.hash2D(Math.round(pts[0].x) * 31 + i, Math.round(pts[0].y) * 17 + i, 7710);
          const j2 = this.hash2D(Math.round(pts[0].y) * 13 + i, Math.round(pts[0].x) * 29 + i, 7711);
          const p = pointAt((i + 0.15 + j * 0.7) / N);
          const speed = 0.55 + j * 0.85;
          const phase = ((t * 0.0016 * speed) + j) % 1;
          const len = p.dz * (0.16 + j2 * 0.30);
          const w = 1 + j2 * 2.2;
          ctx.globalAlpha = 0.10 + j * 0.16;
          ctx.fillStyle = '#cfeaf2';
          ctx.fillRect(p.x - w * 0.5, p.y + phase * (p.dz + len) - len, w, len);
        }

        // --- ONE continuous lip along the whole run ---
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#dff2f7';
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < A.length; i++) {
          const wob = Math.sin(t * 0.004 + i * 1.7) * 0.9;
          if (i === 0) ctx.moveTo(A[i].x, A[i].y + wob); else ctx.lineTo(A[i].x, A[i].y + wob);
        }
        ctx.stroke();
        ctx.restore();

        // --- plunge spray along the base, OUTSIDE the clip so it can billow onto the water ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const S = Math.max(3, Math.round(runLen / 26));
        for (let i = 0; i < S; i++) {
          const j = this.hash2D(Math.round(pts[0].x) * 7 + i, Math.round(pts[0].y) * 11 + i, 7712);
          const p = pointAt((i + 0.5) / S);
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.005 + j * 6.3);
          // Radii clamped: a negative radius throws and blacks the frame.
          const rx = Math.max(0.5, (5 + j * 7) * (0.75 + pulse * 0.5));
          const ry = Math.max(0.4, rx * 0.42);
          ctx.globalAlpha = 0.05 + pulse * 0.10;
          ctx.fillStyle = '#e6f6fa';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + p.dz - ry * 0.3, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      // Per-tile tonal wash drawn into the CHUNK LAYER, immediately after the flat base fill and
      // before everything else, so later detail passes sit on top of it rather than being tinted.
      // Darkens in the troughs and warms in the peaks: sunlit ground should read warmer than shaded
      // ground, not merely brighter.
      drawChunkMacroVariation(c, x, y, px, py, scale) {
        if (!c) return;
        const amount = this.terrainMacroAmount();
        if (!amount) return;
        const DR = window.DreamRealms;
        const noise = DR.utils?.seededNoise;
        if (!noise) return;

        // DR.utils.smoothNoise IS NOT USABLE HERE and this is why three attempts at this feature all
        // measured as nothing: sampled across 16,000 points it returns a spread of 0.0001 - it is a
        // CONSTANT 0.5135, not a field. Feeding it through |n - 0.5| produced a flat 0.0151 alpha
        // everywhere (min = median = max), so the "variation" was a uniform 1.5% tint over the whole
        // world. The user's report that the ground "looks the same" was exactly right. Two of those
        // attempts were spent raising the strength multiplier, which could never have helped.
        //
        // seededNoise has a real 0.98 spread but is not spatially smooth, so it is sampled on an
        // integer lattice and bilinearly interpolated here. That gives BOTH range and smoothness -
        // the two properties this needs and neither helper provides alone.
        const CELL = 11;                       // tiles per noise cell
        const fx = x / CELL, fy = y / CELL;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);      // smoothstep, so cell borders have no crease
        const sy = ty * ty * (3 - 2 * ty);
        const n00 = noise(x0, y0, 4471), n10 = noise(x0 + 1, y0, 4471);
        const n01 = noise(x0, y0 + 1, 4471), n11 = noise(x0 + 1, y0 + 1, 4471);
        const top = n00 + (n10 - n00) * sx;
        const bot = n01 + (n11 - n01) * sx;
        const n = top + (bot - top) * sy;

        const v = (n - 0.5) * 2;                // -1 .. 1, genuinely varying now
        const a = Math.abs(v) * amount * 0.55;
        if (a < 0.004) return;
        // Darker in the troughs, warmer in the peaks: sunlit ground should read warm, not just pale.
        c.fillStyle = v < 0 ? `rgba(0,0,0,${a.toFixed(4)})` : `rgba(255,236,196,${(a * 0.72).toFixed(4)})`;
        c.fillRect(px - 0.5, py - 0.5, scale + 1, scale + 1);
      },

      buildTerrainChunk(chunkX, chunkY) {
        const cache = this.ensureTerrainChunkCache();
        const size = this.terrainChunkSize();
        const scale = this.terrainChunkTextureScale();
        const padding = Math.max(3, Number(this.terrainChunkEdgeSamplePaddingTiles?.()) || 2);
        const startX = chunkX * size;
        const startY = chunkY * size;
        const mapHeight = this.map?.length || 0;
        const mapWidth = this.map?.[0]?.length || 0;
        const widthTiles = Math.max(0, Math.min(size, mapWidth - startX));
        const heightTiles = Math.max(0, Math.min(size, mapHeight - startY));
        const layers = new Map();
        const waterLayers = new Map();
        const shoreLayers = new Map();
        const getLayer = elev => {
          let layer = layers.get(elev);
          if (layer) return layer;
          const surface = this.createTerrainChunkSurface((size + padding * 2) * scale, (size + padding * 2) * scale);
          if (!surface) return null;
          layer = { ...surface, elev, groundTiles: 0, organicBoundarySegments: 0 };
          layers.set(elev, layer);
          return layer;
        };
        const getWaterLayer = elev => {
          let layer = waterLayers.get(elev);
          if (layer) return layer;
          const surface = this.createTerrainChunkSurface((size + padding * 2) * scale, (size + padding * 2) * scale);
          const shimmer = this.createTerrainChunkSurface((size + padding * 2) * scale, (size + padding * 2) * scale);
          if (!surface || !shimmer) return null;
          layer = { ...surface, shimmerCanvas: shimmer.canvas, shimmerContext: shimmer.context, elev, waterTiles: 0 };
          waterLayers.set(elev, layer);
          return layer;
        };
        const getShoreLayer = elev => {
          let layer = shoreLayers.get(elev);
          if (layer) return layer;
          const surface = this.createTerrainChunkSurface((size + padding * 2) * scale, (size + padding * 2) * scale);
          if (!surface) return null;
          layer = { ...surface, elev, shoreEdges: 0, organicSegments: 0 };
          shoreLayers.set(elev, layer);
          return layer;
        };
        const worldMinX = startX - padding;
        const worldMinY = startY - padding;

        for (let y = worldMinY; y < startY + size + padding; y++) {
          for (let x = worldMinX; x < startX + size + padding; x++) {
            const tile = this.map?.[y]?.[x];
            if (!tile) continue;
            const elev = Number(tile.elev) || 0;
            if (this.isTerrainChunkWaterTile(tile)) {
              const layer = getWaterLayer(elev);
              if (!layer) continue;
              const material = this.waterMaterialForTile(tile);
              const px = (x - worldMinX) * scale;
              const py = (y - worldMinY) * scale;
              layer.context.fillStyle = material.base;
              layer.context.fillRect(px - 0.5, py - 0.5, scale + 1, scale + 1);
              this.drawCachedHighPolyWaterLayerDetails(layer.context, x, y, worldMinX, worldMinY, scale, material, tile);
              layer.waterTiles++;
              continue;
            }
            if (!this.isTerrainChunkGroundTile(tile)) continue;
            const layer = getLayer(elev);
            if (!layer) continue;
            const material = this.terrainMaterialForTile(tile);
            const px = (x - worldMinX) * scale;
            const py = (y - worldMinY) * scale;
            layer.context.fillStyle = this.gradeAmbientColour(material.base);
            layer.context.fillRect(px - 0.5, py - 0.5, scale + 1, scale + 1);
            // V0.21.3 (Art Direction Phase 3): macro variation. The two lines above are the "large
            // flat-color tiles" the spec objects to - every tile of a material got one identical base
            // colour, so a field read as a single flat sheet however much fine detail sat on top.
            //
            // THIS HAD TO GO HERE. A first attempt put it at the drawGroundDetail call sites in
            // drawTile() and measured as nothing: instrumenting call counts showed drawTile runs only
            // ~34 times a frame (edge cases) and drawGroundDetail runs ZERO times, because the visible
            // terrain is built here and cached. Correct code in a path that never executes.
            //
            // LOW FREQUENCY IS LOAD-BEARING: sampled at 1/9th tile frequency so the wash drifts over
            // ~9 tiles. Neighbours therefore differ by ~2% alpha and cannot band - which matters
            // because this file already learned (see the depth-darkening buffer below) that a flat
            // per-tile fill shows a hard diamond edge. A per-tile random here would be that mistake.
            this.drawChunkMacroVariation(layer.context, x, y, px, py, scale);
            this.drawChunkGroundTexture(layer.context, x, y, px, py, scale, material, tile);
            // Lighting LAST, over the texture, so pebbles and grass sit inside the shading
            // rather than floating on top of it - which is what sells the volume.
            this.drawChunkHeightLighting(layer.context, x, y, px, py, scale, tile);
            layer.groundTiles++;
          }
        }

        // Depth-darkening wash, precomputed once as a low-res (1px per tile)
        // buffer and drawn back per layer bilinearly-smoothed (below) so the
        // region-band darkening reads as a seamless gradient across tile AND
        // chunk boundaries. Earlier a flat per-tile fill showed a hard diamond
        // grid and an oversized per-tile circle overlapped its neighbours into
        // rings; interpolating a per-tile buffer gives the exact same intensity
        // with neither artefact. depthFactor is a pure world-position function,
        // so sampling a 1-tile border makes adjacent chunks line up seamlessly.
        let depthWash = null;
        {
          const dx0 = worldMinX - 1, dy0 = worldMinY - 1;
          const dbw = (startX + size + padding) - dx0 + 1;
          const dbh = (startY + size + padding) - dy0 + 1;
          if (dbw >= 2 && dbh >= 2) {
            const buf = this._terrainDepthWashBuf || (this._terrainDepthWashBuf = document.createElement('canvas'));
            if (buf.width < dbw) buf.width = dbw;
            if (buf.height < dbh) buf.height = dbh;
            const bctx = buf.getContext('2d');
            const img = bctx.createImageData(dbw, dbh);
            const data = img.data;
            let anyDepth = false;
            for (let j = 0; j < dbh; j++) {
              for (let i = 0; i < dbw; i++) {
                const df = this.darkWoodsDepthFactor?.(dx0 + i, dy0 + j) || 0;
                if (df <= 0.02) continue;
                anyDepth = true;
                const o = (j * dbw + i) * 4;
                data[o] = 5; data[o + 1] = 8; data[o + 2] = 7;
                data[o + 3] = Math.min(255, (df * 0.22 * 255) | 0);
              }
            }
            if (anyDepth) {
              bctx.putImageData(img, 0, 0);
              depthWash = {
                canvas: buf, sw: dbw, sh: dbh,
                dx: (dx0 - worldMinX) * scale, dy: (dy0 - worldMinY) * scale,
                dw: dbw * scale, dh: dbh * scale,
              };
            }
          }
        }

        for (const layer of layers.values()) {
          const c = layer.context;
          c.save();
          c.globalCompositeOperation = 'source-atop';
          // Broad world-anchored patches, intended to break repetition across tile and chunk
          // boundaries. OFF by default since V0.21.7: at up to 5.7x4.3 tiles with a hard elliptical
          // falloff they read as discrete ovals stamped on the ground rather than as variation.
          const patchStrength = this.terrainMacroPatchStrength();
          if (patchStrength > 0) {
            for (let gy = Math.floor((worldMinY - 5) / 4) * 4; gy <= startY + size + padding + 5; gy += 4) {
              for (let gx = Math.floor((worldMinX - 5) / 4) * 4; gx <= startX + size + padding + 5; gx += 4) {
                const seed = this.hash2D(gx, gy, 49001);
                const centerX = (gx - worldMinX + (this.hash2D(gx, gy, 49002) - 0.5) * 3.2) * scale;
                const centerY = (gy - worldMinY + (this.hash2D(gy, gx, 49003) - 0.5) * 3.2) * scale;
                c.globalAlpha = (0.045 + seed * 0.075) * patchStrength;
                c.fillStyle = seed > 0.52 ? '#f1ddb2' : '#172018';
                c.beginPath();
                c.ellipse(centerX, centerY, (2.1 + seed * 3.6) * scale, (1.5 + this.hash2D(gx, gy, 49004) * 2.8) * scale, seed * Math.PI, 0, Math.PI * 2);
                c.fill();
              }
            }
          }

          // Material transitions get irregular, feather-like patches instead of straight grid edges.
          for (let y = worldMinY; y < startY + size + padding; y++) {
            for (let x = worldMinX; x < startX + size + padding; x++) {
              const tile = this.map?.[y]?.[x];
              if (!this.isTerrainChunkGroundTile(tile) || (Number(tile.elev) || 0) !== layer.elev) continue;
              const material = this.terrainMaterialForTile(tile);
              for (const edge of [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }]) {
                const other = this.map?.[y + edge.dy]?.[x + edge.dx];
                if (!this.isTerrainChunkGroundTile(other) || (Number(other.elev) || 0) !== layer.elev) continue;
                const otherMaterial = this.terrainMaterialForTile(other);
                if (otherMaterial.family === material.family) continue;
                this.drawCachedMaterialBoundary(c, x, y, edge, worldMinX, worldMinY, scale, material, otherMaterial);
                layer.organicBoundarySegments++;
              }

              // Sparse material-specific marks are baked once, never allocated per frame.
              const detail = this.hash2D(x, y, 49201);
              if (detail > 0.54) {
                const localX = (x - worldMinX + 0.18 + this.hash2D(x, y, 49202) * 0.64) * scale;
                const localY = (y - worldMinY + 0.18 + this.hash2D(y, x, 49203) * 0.64) * scale;
                c.globalAlpha = 0.16 + detail * 0.12;
                c.strokeStyle = material.family === 'grass' ? material.light : material.dark;
                c.fillStyle = material.family === 'silk' ? 'rgba(218,205,220,0.52)' : material.dark;
                c.lineWidth = Math.max(1, scale * 0.045);
                if (material.family === 'grass') {
                  this.drawCachedHighPolyGrassFloorDetails(c, x, y, worldMinX, worldMinY, scale, material, detail);
                } else if (material.family === 'dirt' || material.family === 'forest') {
                  // V0.17.52 Phase 13: 'forest' (FOREST_FLOOR) previously fell
                  // to the generic single-ellipse `else` branch below and got
                  // no undulation/crack/pebble/debris detail at all, unlike
                  // every other ground family - the richer dirt-detail
                  // treatment is the closest fit (soil-like ground), reusing
                  // the material's own base/light/dark colors passed in
                  // rather than a new function.
                  this.drawCachedHighPolyDirtFloorDetails(c, x, y, worldMinX, worldMinY, scale, material, detail);
                } else if (material.family === 'cave') {
                  this.drawCachedHighPolyCaveFloorDetails(c, x, y, worldMinX, worldMinY, scale, material, detail);
                } else if (material.family === 'stone') {
                  c.beginPath();
                  c.moveTo(localX - scale * 0.22, localY);
                  c.lineTo(localX, localY - scale * 0.08);
                  c.lineTo(localX + scale * 0.19, localY + scale * 0.08);
                  c.stroke();
                } else if (material.family === 'silk') {
                  c.beginPath();
                  c.arc(localX, localY, scale * 0.19, Math.PI * 0.15, Math.PI * 1.35);
                  c.stroke();
                  c.beginPath();
                  c.arc(localX + scale * 0.1, localY, scale * 0.12, Math.PI * 0.05, Math.PI * 1.25);
                  c.stroke();
                } else {
                  c.beginPath();
                  c.ellipse(localX, localY, scale * 0.12, scale * 0.07, detail * Math.PI, 0, Math.PI * 2);
                  c.fill();
                }
              }

            }
          }

          // V0.17.52 Phase 13 depth-darkening wash (region level bands via
          // darkWoodsDepthFactor: 0 near town, strongest in the level 9-10
          // Gloamroot Depths / Silk Web Approach). The precomputed low-res buffer
          // is drawn back bilinearly-smoothed and clipped by source-atop to this
          // layer's own ground tiles, giving a seamless gradient with no per-tile
          // diamond grid and no overlap rings.
          if (depthWash) {
            const prevSmoothing = c.imageSmoothingEnabled;
            c.imageSmoothingEnabled = true;
            c.globalAlpha = 1;
            c.drawImage(depthWash.canvas, 0, 0, depthWash.sw, depthWash.sh, depthWash.dx, depthWash.dy, depthWash.dw, depthWash.dh);
            c.imageSmoothingEnabled = prevSmoothing;
          }
          c.restore();
        }

        for (const layer of waterLayers.values()) {
          const c = layer.context;
          c.save();
          c.globalCompositeOperation = 'source-atop';

          // Broad, world-anchored fields span several tiles and stay identical in adjacent
          // chunks. They provide connected water value changes without tile-sized boxes.
          for (let gy = Math.floor((worldMinY - 6) / 5) * 5; gy <= startY + size + padding + 6; gy += 5) {
            for (let gx = Math.floor((worldMinX - 6) / 5) * 5; gx <= startX + size + padding + 6; gx += 5) {
              const seed = this.hash2D(gx, gy, 50001);
              const centerX = (gx - worldMinX + (this.hash2D(gx, gy, 50002) - 0.5) * 4) * scale;
              const centerY = (gy - worldMinY + (this.hash2D(gy, gx, 50003) - 0.5) * 4) * scale;
              c.globalAlpha = 0.07 + seed * 0.08;
              c.fillStyle = seed > 0.48 ? '#79b4b5' : '#031a27';
              c.beginPath();
              c.ellipse(centerX, centerY, (3.2 + seed * 4.8) * scale, (2.2 + this.hash2D(gx, gy, 50004) * 3.8) * scale, seed * Math.PI, 0, Math.PI * 2);
              c.fill();
            }
          }

          // Depth cues use soft radial fields and shore fades. The logical waterDepth stays
          // unchanged and continues to own collision, swimming, fishing, and validation.
          for (let y = worldMinY; y < startY + size + padding; y++) {
            for (let x = worldMinX; x < startX + size + padding; x++) {
              const tile = this.map?.[y]?.[x];
              if (!this.isTerrainChunkWaterTile(tile) || (Number(tile.elev) || 0) !== layer.elev) continue;
              const material = this.waterMaterialForTile(tile);
              const px = (x - worldMinX) * scale;
              const py = (y - worldMinY) * scale;
              const depth = this.waterDepthForTile(x, y, tile);
              const depthRatio = Math.max(0, Math.min(1, (depth - 5) / 7));
              const depthGradient = c.createRadialGradient(px + scale * 0.5, py + scale * 0.5, scale * 0.08, px + scale * 0.5, py + scale * 0.5, scale * 0.82);
              depthGradient.addColorStop(0, depthRatio > 0.55 ? 'rgba(0,18,31,0.34)' : 'rgba(115,174,170,0.18)');
              depthGradient.addColorStop(1, 'rgba(12,42,51,0)');
              c.globalAlpha = 0.72;
              c.fillStyle = depthGradient;
              c.fillRect(px - scale * 0.3, py - scale * 0.3, scale * 1.6, scale * 1.6);

              const edges = [
                { dx: 0, dy: -1, x1: px, y1: py, x2: px, y2: py + scale * 0.48, rx: px, ry: py, rw: scale, rh: scale * 0.58 },
                { dx: 1, dy: 0, x1: px + scale, y1: py, x2: px + scale * 0.52, y2: py, rx: px + scale * 0.42, ry: py, rw: scale * 0.58, rh: scale },
                { dx: 0, dy: 1, x1: px, y1: py + scale, x2: px, y2: py + scale * 0.52, rx: px, ry: py + scale * 0.42, rw: scale, rh: scale * 0.58 },
                { dx: -1, dy: 0, x1: px, y1: py, x2: px + scale * 0.48, y2: py, rx: px, ry: py, rw: scale * 0.58, rh: scale }
              ];
              for (const edge of edges) {
                const other = this.map?.[y + edge.dy]?.[x + edge.dx];
                if (this.isTerrainChunkWaterTile(other)) continue;
                const shore = c.createLinearGradient(edge.x1, edge.y1, edge.x2, edge.y2);
                shore.addColorStop(0, material.shore);
                shore.addColorStop(0.38, material.light);
                shore.addColorStop(1, 'rgba(50,110,112,0)');
                c.globalAlpha = 0.42;
                c.fillStyle = shore;
                c.fillRect(edge.rx, edge.ry, edge.rw, edge.rh);
              }
            }
          }
          c.restore();

          // A second cached surface contains globally aligned wave bands. Runtime animation
          // only pulses this surface's opacity; it never loops over water tiles or rebuilds it.
          const shimmer = layer.shimmerContext;
          shimmer.save();
          shimmer.clearRect(0, 0, layer.shimmerCanvas.width, layer.shimmerCanvas.height);
          shimmer.lineCap = 'round';
          shimmer.lineJoin = 'round';
          shimmer.strokeStyle = this.currentZone === 'cave' || this.currentZone === 'dungeon' ? 'rgba(115,168,176,0.42)' : 'rgba(174,226,224,0.52)';
          shimmer.lineWidth = Math.max(1.1, scale * 0.065);
          for (let gy = Math.floor((worldMinY - 2) / 2) * 2; gy <= startY + size + padding + 2; gy += 2) {
            for (let gx = Math.floor((worldMinX - 3) / 3) * 3; gx <= startX + size + padding + 3; gx += 3) {
              if (this.hash2D(gx, gy, 50101) < 0.38) continue;
              const sx = (gx - worldMinX - 0.35 + this.hash2D(gx, gy, 50102) * 0.7) * scale;
              const sy = (gy - worldMinY + this.hash2D(gy, gx, 50103) * 0.65) * scale;
              const length = (1.25 + this.hash2D(gx, gy, 50104) * 1.9) * scale;
              shimmer.globalAlpha = 0.34 + this.hash2D(gx, gy, 50105) * 0.34;
              shimmer.beginPath();
              shimmer.moveTo(sx, sy);
              shimmer.bezierCurveTo(sx + length * 0.28, sy - scale * 0.16, sx + length * 0.66, sy + scale * 0.17, sx + length, sy);
              shimmer.stroke();
            }
          }
          shimmer.globalCompositeOperation = 'destination-in';
          shimmer.fillStyle = '#fff';
          shimmer.beginPath();
          for (let y = worldMinY; y < startY + size + padding; y++) {
            for (let x = worldMinX; x < startX + size + padding; x++) {
              const tile = this.map?.[y]?.[x];
              if (!this.isTerrainChunkWaterTile(tile) || (Number(tile.elev) || 0) !== layer.elev) continue;
              shimmer.rect((x - worldMinX) * scale - 0.5, (y - worldMinY) * scale - 0.5, scale + 1, scale + 1);
            }
          }
          shimmer.fill();
          shimmer.restore();
        }

        // Land-owned shoreline caps are a distinct cached composition layer. They are drawn
        // after water and ground tops, so the upper edge of every depth face is concealed by
        // the material it cuts beneath instead of appearing pasted over the world.
        for (let y = worldMinY; y < startY + size + padding; y++) {
          for (let x = worldMinX; x < startX + size + padding; x++) {
            const tile = this.map?.[y]?.[x];
            if (!this.isTerrainChunkGroundTile(tile)) continue;
            const waterEdges = [
              { key: 'n', dx: 0, dy: -1 },
              { key: 'e', dx: 1, dy: 0 },
              { key: 's', dx: 0, dy: 1 },
              { key: 'w', dx: -1, dy: 0 }
            ].filter(edge => this.isTerrainChunkWaterTile(this.map?.[y + edge.dy]?.[x + edge.dx]));
            if (!waterEdges.length) continue;
            const elev = Number(tile.elev) || 0;
            const layer = getShoreLayer(elev);
            if (!layer) continue;
            const c = layer.context;
            const material = this.terrainMaterialForTile(tile);
            for (const edge of waterEdges) {
              this.drawCachedShoreContour(c, x, y, edge, worldMinX, worldMinY, scale, material);
              layer.shoreEdges++;
              layer.organicSegments++;
            }
          }
        }

        // V0.21.4: AMBIENT GRADE ON THE FINISHED LAYER. Grading material.base alone hit diminishing
        // returns - cutting `value` 0.565 -> 0.40, a 29% reduction, moved composite luma only
        // 103.7 -> 93.0 (10%), because the cached detail passes, depth wash and boundary work all
        // paint ON TOP of the base ungraded. Pushing the base darker would have crushed it to mud
        // before the composite ever reached the reference. Grading here, after every pass has run,
        // catches all of it in one place - the same "find where it is actually drawn" lesson that
        // V0.21.3 learned about drawGroundDetail.
        //
        // source-atop is what makes this safe: it tints only pixels the layer already painted, so
        // untouched regions of the padded surface stay transparent. A plain fill or 'multiply' would
        // give the whole surface alpha and turn the padding into a visible dark slab.
        const layerGrade = this.ambientLayerGradeAlpha();
        if (layerGrade > 0.004) {
          for (const layer of [...layers.values(), ...shoreLayers.values()]) {
            const c = layer?.context; const cv = layer?.canvas;
            if (!c || !cv) continue;
            c.save();
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = `rgba(8,6,4,${layerGrade.toFixed(4)})`;
            c.fillRect(0, 0, cv.width, cv.height);
            c.restore();
          }
          // Water is deliberately graded LESS: it is a light source of its own in this palette and
          // darkening it to match earth reads as tar.
          for (const layer of waterLayers.values()) {
            const c = layer?.context; const cv = layer?.canvas;
            if (!c || !cv) continue;
            c.save();
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = `rgba(8,6,4,${(layerGrade * 0.55).toFixed(4)})`;
            c.fillRect(0, 0, cv.width, cv.height);
            c.restore();
          }
        }

        cache.builds++;
        if (waterLayers.size) cache.waterBuilds++;
        if (shoreLayers.size) cache.shoreBuilds++;
        const organicBoundarySegments = Array.from(layers.values()).reduce((sum, layer) => sum + (layer.organicBoundarySegments || 0), 0);
        const organicShoreSegments = Array.from(shoreLayers.values()).reduce((sum, layer) => sum + (layer.organicSegments || 0), 0);
        const sortedLayers = Array.from(layers.values()).sort((a, b) => a.elev - b.elev);
        const sortedWaterLayers = Array.from(waterLayers.values()).sort((a, b) => a.elev - b.elev);
        const sortedShoreLayers = Array.from(shoreLayers.values()).sort((a, b) => a.elev - b.elev);
        return { chunkX, chunkY, startX, startY, widthTiles, heightTiles, padding, scale, layers, waterLayers, shoreLayers, sortedLayers, sortedWaterLayers, sortedShoreLayers, organicBoundarySegments, organicShoreSegments, boundaryMode: 'organic-curves-v2', signature: this.terrainChunkSignature(chunkX, chunkY), builtAt: performance.now() };
      },

      getOrBuildTerrainChunk(chunkX, chunkY) {
        const cache = this.ensureTerrainChunkCache();
        const key = `${this.terrainChunkZoneKey()}:${chunkX}:${chunkY}`;
        let chunk = cache.chunks.get(key);
        const frame = this._perfFrameId || 0;
        cache.dirtyChunks = cache.dirtyChunks instanceof Set ? cache.dirtyChunks : new Set();
        const isDirty = cache.dirtyChunks.has(key);
        const auditFrames = Math.max(30, Number(window.DreamRealms?.CONFIG?.PERFORMANCE?.terrainSignatureAuditFrames || 300));
        const shouldAudit = !!chunk && !isDirty && (!Number.isFinite(Number(chunk.lastSignatureAuditFrame)) || frame - Number(chunk.lastSignatureAuditFrame) >= auditFrames);
        if (!chunk || isDirty) {
          chunk = this.buildTerrainChunk(chunkX, chunkY);
          chunk.lastSignatureAuditFrame = frame;
          cache.chunks.set(key, chunk);
          cache.dirtyChunks.delete(key);
          while (cache.chunks.size > cache.maxEntries) cache.chunks.delete(cache.chunks.keys().next().value);
        } else if (shouldAudit) {
          const signature = this.terrainChunkSignature(chunkX, chunkY);
          chunk.lastSignatureAuditFrame = frame;
          if (chunk.signature !== signature) {
            chunk = this.buildTerrainChunk(chunkX, chunkY);
            chunk.lastSignatureAuditFrame = frame;
            cache.chunks.set(key, chunk);
          } else {
            chunk.lastUsedFrame = frame;
          }
        } else {
          chunk.lastUsedFrame = frame;
        }
        return chunk;
      },

      terrainChunkIntersectsViewport(chunkX, chunkY, padPx = 900) {
        const size = this.terrainChunkSize();
        const startX = chunkX * size;
        const startY = chunkY * size;
        const viewport = this.getViewportMetrics?.() || { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
        const corners = [
          this.worldToScreen(startX - 1, startY - 1, 0),
          this.worldToScreen(startX + size + 1, startY - 1, 0),
          this.worldToScreen(startX - 1, startY + size + 1, 0),
          this.worldToScreen(startX + size + 1, startY + size + 1, 0)
        ];
        let minSx = Infinity, maxSx = -Infinity, minSy = Infinity, maxSy = -Infinity;
        for (const c of corners) {
          minSx = Math.min(minSx, c.x); maxSx = Math.max(maxSx, c.x);
          minSy = Math.min(minSy, c.y); maxSy = Math.max(maxSy, c.y);
        }
        const pad = Math.max(300, Number(padPx) || 900);
        return maxSx >= -pad && minSx <= viewport.width + pad && maxSy >= -pad && minSy <= viewport.height + pad;
      },

      // V0.21.17: draws the structural wall faces for ONE elevation band, called from the band
      // composite immediately after that band's ground surfaces. Tiles are filtered by their own
      // elevation, so a wall only ever draws with the band it belongs to.
      drawTerrainBandWalls(bandElev) {
        const list = this._terrainBandRenderables;
        if (!list || !list.length) return;
        const prevMode = this._terrainStructuralPassMode;
        const prevPhase = this._terrainRenderPhase;
        this._terrainStructuralPassMode = 'occlusion-cap';
        this._terrainRenderPhase = 'terrain-band-walls';
        for (const r of list) {
          if ((Number(r.tile?.elev) || 0) !== bandElev) continue;
          this.drawTile(r.x, r.y, r.tile);
        }
        this._terrainStructuralPassMode = prevMode;
        this._terrainRenderPhase = prevPhase;
      },

      drawTerrainChunks(minX, maxX, minY, maxY) {
        const DR = window.DreamRealms;
        const { CONFIG } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !this.map) return false;
        const cache = this.ensureTerrainChunkCache();
        const zoneKey = this.terrainChunkZoneKey();
        if (cache.lastZoneKey !== zoneKey) {
          cache.lastZoneKey = zoneKey;
          cache.invalidations++;
          if (cache.dirtyChunks instanceof Set) cache.dirtyChunks.clear();
        }
        const size = this.terrainChunkSize();
        const minChunkX = Math.floor(minX / size);
        const maxChunkX = Math.floor(maxX / size);
        const minChunkY = Math.floor(minY / size);
        const maxChunkY = Math.floor(maxY / size);
        const projection = this.getCameraProjectionCache?.() || {};
        const cos = Number.isFinite(Number(projection.cos)) ? Number(projection.cos) : Math.cos(Number(this.camera?.yaw) || 0);
        const sin = Number.isFinite(Number(projection.sin)) ? Number(projection.sin) : Math.sin(Number(this.camera?.yaw) || 0);
        const xScreenX = (cos - sin) * CONFIG.TILE_W / 2;
        const xScreenY = (cos + sin) * CONFIG.TILE_H / 2;
        const yScreenX = (-sin - cos) * CONFIG.TILE_W / 2;
        const yScreenY = (-sin + cos) * CONFIG.TILE_H / 2;
        let drawn = 0;
        let waterDrawn = 0;
        let shoreDrawn = 0;
        const shimmerAlpha = 0.24 + (Math.sin(performance.now() * 0.0011) + 1) * 0.075;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        const visibleChunks = cache.visibleEntries || (cache.visibleEntries = []);
        const entryPool = cache.visibleEntryPool || (cache.visibleEntryPool = []);
        visibleChunks.length = 0;
        let entryIndex = 0;
        let chunksConsidered = 0;
        let chunksCulled = 0;
        const perf = window.DreamRealms?.CONFIG?.PERFORMANCE || {};
        const strictCull = perf.enableStrictViewportCulling !== false;
        const chunkCullPad = Math.max(520, Number(perf.viewportCullPadPx || 760));
        for (let cy = minChunkY; cy <= maxChunkY; cy++) {
          for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            chunksConsidered += 1;
            if (strictCull && !this.terrainChunkIntersectsViewport?.(cx, cy, chunkCullPad)) {
              chunksCulled += 1;
              continue;
            }
            const chunk = this.getOrBuildTerrainChunk(cx, cy);
            if ((!chunk?.layers?.size && !chunk?.waterLayers?.size && !chunk?.shoreLayers?.size) || chunk.widthTiles <= 0 || chunk.heightTiles <= 0) continue;
            const entry = entryPool[entryIndex] || (entryPool[entryIndex] = {});
            entryIndex++;
            entry.chunk = chunk;
            entry.cropX = chunk.padding * chunk.scale;
            entry.cropY = chunk.padding * chunk.scale;
            entry.cropW = chunk.widthTiles * chunk.scale;
            entry.cropH = chunk.heightTiles * chunk.scale;
            visibleChunks.push(entry);
          }
        }

        const cameraRotationSinglePass = this.cameraRotationSinglePassTerrainActive?.() === true;
        const hybridTerrainPromoted = !cameraRotationSinglePass && this.prepareHybridTerrainBatch?.({
          visibleChunks,
          zoneKey,
          minX, maxX, minY, maxY,
          chunksConsidered,
          chunksCulled,
          projection
        }) === true && this.isWebglTerrainLayerPromoted?.() === true;

        if (hybridTerrainPromoted) {
          ctx.restore();
          const promotedSurfaces = visibleChunks.reduce((sum, entry) => sum
            + (entry.chunk.sortedWaterLayers?.length || 0) * 2
            + (entry.chunk.sortedLayers?.length || 0)
            + (entry.chunk.sortedShoreLayers?.length || 0), 0);
          const boundarySegments = visibleChunks.reduce((sum, entry) => sum + (entry.chunk.organicBoundarySegments || 0), 0);
          const shoreSegments = visibleChunks.reduce((sum, entry) => sum + (entry.chunk.organicShoreSegments || 0), 0);
          cache.draws += promotedSurfaces;
          cache.lastFrame = { chunks: visibleChunks.length, surfaces: promotedSurfaces, waterSurfaces: 0, shoreSurfaces: 0, depthFaces: this._waterDepthFacesDrawn || 0, boundarySegments, shoreSegments, boundaryMode: 'organic-curves-v2', halfBlockFaceMode: 'corner-join-columns-v2', builds: cache.builds, waterBuilds: cache.waterBuilds, shoreBuilds: cache.shoreBuilds, chunksConsidered, chunksCulled, compositionOrder: ['water-depth', 'terrain-depth-underlay', 'webgl-promoted-terrain-surface', 'ground-occlusion-cap', 'structural-walls', 'actors-props'] };
          if (this.perfStats) {
            this.perfStats.terrainCameraSinglePass = cameraRotationSinglePass;
            this.perfStats.terrainChunksDrawn = visibleChunks.length;
            this.perfStats.terrainSurfacesDrawn = promotedSurfaces;
            this.perfStats.terrainWaterSurfacesDrawn = 0;
            this.perfStats.terrainShoreSurfacesDrawn = 0;
            this.perfStats.terrainChunkCacheEntries = cache.chunks.size;
            this.perfStats.terrainChunkBuilds = cache.builds;
            this.perfStats.terrainChunkCacheInvalidations = cache.invalidations;
            this.perfStats.terrainChunksConsidered = chunksConsidered;
            this.perfStats.terrainChunksCulled = chunksCulled;
            this.perfStats.terrainWebglPromoted = true;
          }
          return true;
        }

        const bleed = 2;
        const drawSurface = (entry, canvas, elev, alpha = 1, composite = 'source-over') => {
          if (!canvas) return;
          const { chunk, cropX, cropY, cropW, cropH } = entry;
          const origin = this.worldToScreen(chunk.startX - 0.5, chunk.startY - 0.5, elev);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = composite;
          ctx.transform(xScreenX / chunk.scale, xScreenY / chunk.scale, yScreenX / chunk.scale, yScreenY / chunk.scale, origin.x, origin.y);
          ctx.drawImage(canvas, cropX - bleed, cropY - bleed, cropW + bleed * 2, cropH + bleed * 2, -bleed, -bleed, cropW + bleed * 2, cropH + bleed * 2);
          ctx.restore();
        };

        // Explicit global composition phases prevent a later chunk's water from covering an
        // earlier chunk's land at cross-chunk shorelines.
        // V0.21.16: BAND-MAJOR COMPOSITE, which is the stack as specified:
        //   ground 1, ground 2, ground 3, ground 4, water 1..4, mask 1..4
        //
        // ELEVATION IS THE PRIMARY SORT KEY and chunk depth only orders within a band. V0.21.10
        // through V0.21.15 had this the other way round - chunk depth primary, elevation secondary -
        // which interleaves bands across chunks and lets a far chunk's high ground draw before a near
        // chunk's low ground. Band-major means every surface at a given elevation is laid down before
        // ANY surface above it, everywhere on screen, so a higher band can never appear beneath a
        // lower one regardless of which chunk either belongs to or which way the camera faces.
        //
        // V0.21.15: COMPOSITE ORDER IS GROUND -> WATER -> SHORE.
        //
        // It was WATER -> GROUND -> SHORE, i.e. water was laid down BEFORE the land and then painted
        // over by it. At a shoreline that is backwards: water should lap OVER the bank edge, not be
        // buried under it. The visible symptom was thin dark wedges exactly where water met a bank -
        // the ground surface cutting across water that should have been on top of it.
        //
        // This is the user's own stated layer model - ground, then water, then mask - and it is worth
        // recording that the fault was the ORDER OF THE THREE STAGES, not the ordering within any one
        // of them. Fourteen versions went into sorting pieces correctly inside each stage while the
        // stages themselves were in the wrong sequence.
        // Shared by all three composite stages so they cannot drift apart again (the V0.21.14
        // lesson: the depth key was applied to one of three sibling loops and reported as done).
        const chunkDepth = (entry) => {
          const cx = entry.chunk.startX + entry.chunk.widthTiles * 0.5;
          const cy = entry.chunk.startY + entry.chunk.heightTiles * 0.5;
          return this.worldToScreen(cx, cy, 0).y;
        };

        // V0.21.10: GROUND LAYERS COMPOSITED BY A REAL ISOMETRIC DEPTH KEY.
        //
        // THE BUG THIS REPLACES: the loop used to be `for each chunk { for each layer }`, so EVERY
        // layer of one chunk drew before ANY layer of the next, in whatever order chunks happened to
        // be pushed. A far chunk's high ground therefore painted over a near chunk's low ground - and
        // because which chunks are "far" changes as the camera turns, the fault appeared and vanished
        // with rotation. That is the root cause behind the corner artefacts V0.21.8 and V0.21.9
        // treated at the drawing end; those made wall faces SURVIVE bad ordering, this makes the
        // ordering correct.
        //
        // THE KEY IS THE ENGINE'S OWN PROJECTION, deliberately, rather than hand-rolled rotation
        // maths: worldToScreen already folds in camera yaw, so projecting each chunk's centre AT A
        // FIXED ELEVATION gives a screen Y that is monotonic with true isometric depth at any
        // heading. Sampling at elev 0 for every unit is what makes it a depth measure rather than a
        // screen-position measure - elevation must NOT reorder anything, it only raises where a
        // surface lands. Elevation is then the tiebreak, ascending, so higher ground still covers the
        // lower ground behind it within the same depth band.
        const groundUnits = cache.groundUnits || (cache.groundUnits = []);
        groundUnits.length = 0;
        for (const entry of visibleChunks) {
          const layers = entry.chunk.sortedLayers || [];
          if (!layers.length) continue;
          const cx = entry.chunk.startX + entry.chunk.widthTiles * 0.5;
          const cy = entry.chunk.startY + entry.chunk.heightTiles * 0.5;
          const depth = this.worldToScreen(cx, cy, 0).y;
          for (const layer of layers) groundUnits.push({ entry, layer, depth });
        }
        groundUnits.sort((a, b) => (a.layer.elev - b.layer.elev) || (a.depth - b.depth));
        // V0.21.17: WALLS ARE PART OF THE STACK NOW. After each elevation band's ground is laid
        // down, the wall faces belonging to THAT band are drawn, before the band above begins. The
        // stack is therefore ground 1, walls 1, ground 2, walls 2, ... exactly as the layer list
        // implies - walls belong to a band, so they draw with it.
        //
        // Previously the wall pass ran ONCE, after every band, from game.js. That is why a band-1
        // wall could paint over band-2 ground: the walls were not in the stack at all, so no amount
        // of ordering the stack could place them correctly. Every mechanism built to compensate -
        // the depth-underlay pass, the quad clip, the camera-facing filter - existed only because
        // walls sat outside the composite.
        let bandStart = 0;
        for (let i = 0; i <= groundUnits.length; i++) {
          const atEnd = i === groundUnits.length;
          if (!atEnd && groundUnits[i].layer.elev === groundUnits[bandStart].layer.elev) continue;
          const bandElev = groundUnits[bandStart].layer.elev;
          for (let k = bandStart; k < i; k++) {
            drawSurface(groundUnits[k].entry, groundUnits[k].layer.canvas, groundUnits[k].layer.elev);
            drawn++;
          }
          this.drawTerrainBandWalls(bandElev);
          bandStart = i;
          if (atEnd) break;
        }
        // V0.21.14: water and shore get the SAME depth key as ground. V0.21.10 fixed the ordering
        // for ground layers and left these two loops on the original chunk-then-elevation iteration,
        // so they kept the identical bug - a far chunk's water or shoreline drawn over a near chunk's
        // land. That is why the last remaining artefacts were all AT WATER EDGES: thin dark slivers
        // and wedges where a shoreline or water surface from one chunk cut across the bank of
        // another. Fixing one of three loops and calling the ordering fixed was the oversight.
        const waterUnits = [];
        for (const entry of visibleChunks) {
          const wl = entry.chunk.sortedWaterLayers || [];
          if (!wl.length) continue;
          const depth = chunkDepth(entry);
          for (const layer of wl) waterUnits.push({ entry, layer, depth });
        }
        waterUnits.sort((a, b) => (a.layer.elev - b.layer.elev) || (a.depth - b.depth));
        for (const u of waterUnits) {
          drawSurface(u.entry, u.layer.canvas, u.layer.elev);
          drawSurface(u.entry, u.layer.shimmerCanvas, u.layer.elev + 0.015, shimmerAlpha, 'screen');
          waterDrawn += 2;
        }
        const shoreUnits = [];
        for (const entry of visibleChunks) {
          const sl = entry.chunk.sortedShoreLayers || [];
          if (!sl.length) continue;
          const depth = chunkDepth(entry);
          for (const layer of sl) shoreUnits.push({ entry, layer, depth });
        }
        shoreUnits.sort((a, b) => (a.layer.elev - b.layer.elev) || (a.depth - b.depth));
        for (const u of shoreUnits) {
          drawSurface(u.entry, u.layer.canvas, u.layer.elev + 0.025);
          shoreDrawn++;
        }
        ctx.restore();
        cache.draws += drawn;
        cache.waterDraws += waterDrawn;
        cache.shoreDraws += shoreDrawn;
        const boundarySegments = visibleChunks.reduce((sum, entry) => sum + (entry.chunk.organicBoundarySegments || 0), 0);
        const shoreSegments = visibleChunks.reduce((sum, entry) => sum + (entry.chunk.organicShoreSegments || 0), 0);
        cache.lastFrame = { chunks: visibleChunks.length, surfaces: drawn, waterSurfaces: waterDrawn, shoreSurfaces: shoreDrawn, depthFaces: this._waterDepthFacesDrawn || 0, boundarySegments, shoreSegments, boundaryMode: 'organic-curves-v2', halfBlockFaceMode: 'corner-join-columns-v2', builds: cache.builds, waterBuilds: cache.waterBuilds, shoreBuilds: cache.shoreBuilds, chunksConsidered, chunksCulled, compositionOrder: ['water-depth', 'terrain-depth-underlay', 'water-surface', 'ground-surface', 'ground-occlusion-cap', 'shore-cap', 'structural-walls', 'actors-props'] };
        if (this.perfStats) {
          this.perfStats.terrainWebglPromoted = false;
          this.perfStats.terrainChunksDrawn = visibleChunks.length;
          this.perfStats.terrainSurfacesDrawn = drawn;
          this.perfStats.terrainWaterSurfacesDrawn = waterDrawn;
          this.perfStats.terrainShoreSurfacesDrawn = shoreDrawn;
          this.perfStats.terrainChunkCacheEntries = cache.chunks.size;
          this.perfStats.terrainChunkBuilds = cache.builds;
          this.perfStats.terrainChunkCacheInvalidations = cache.invalidations;
          this.perfStats.terrainChunksConsidered = chunksConsidered;
          this.perfStats.terrainChunksCulled = chunksCulled;
        }
        return drawn + waterDrawn + shoreDrawn > 0;
      },

      getTerrainChunkCacheStats() {
        const cache = this.ensureTerrainChunkCache();
        return {
          entries: cache.chunks.size,
          builds: cache.builds,
          draws: cache.draws,
          waterBuilds: cache.waterBuilds,
          waterDraws: cache.waterDraws,
          shoreBuilds: cache.shoreBuilds,
          shoreDraws: cache.shoreDraws,
          invalidations: cache.invalidations,
          dirtyChunks: cache.dirtyChunks?.size || 0,
          lastFrame: cache.lastFrame || null,
          lastInvalidationReason: cache.lastInvalidationReason || null
        };
      },

      drawWaterDepthLayer(x, y, tile) {
        const DR = window.DreamRealms;
        const { TILE, TILE_DEF } = DR;
        if (!tile || tile.type !== TILE.WATER) return false;
        const corners = {
          north: this.worldToScreen(x - 0.5, y - 0.5, tile.elev),
          east: this.worldToScreen(x + 0.5, y - 0.5, tile.elev),
          south: this.worldToScreen(x + 0.5, y + 0.5, tile.elev),
          west: this.worldToScreen(x - 0.5, y + 0.5, tile.elev)
        };
        const neighbor = {
          n: this.map[y - 1]?.[x] ?? null,
          e: this.map[y]?.[x + 1] ?? null,
          s: this.map[y + 1]?.[x] ?? null,
          w: this.map[y]?.[x - 1] ?? null
        };
        this.drawDeepWaterShaft(x, y, tile, corners, neighbor, TILE_DEF[tile.type]);
        this._waterDepthFacesDrawn = (this._waterDepthFacesDrawn || 0) + 1;
        return true;
      },

      drawTile(x, y, tile) {
        const DR = window.DreamRealms;
        const { TILE, TILE_DEF } = DR;
        const { seededNoise, colorShade } = DR.utils || {};
        const { ctx } = DR.runtime || {};
        const s = this.worldToScreen(x, y, tile.elev);
        const def = TILE_DEF[tile.type];
        const tileVariant = this.getTileVisualVariant?.(x, y, tile) || { name: 'normal', seed: 0, r: 0.5, intensity: 0 };
        const isCaveWall = tile.type === TILE.CAVE_WALL;
        const isWater = tile.type === TILE.WATER;
        const groundCached = Boolean(this._terrainGroundCacheActive && this.isTerrainChunkGroundTile(tile));
        const waterCached = Boolean(this._terrainWaterCacheActive && isWater);
        const structuralMode = this._terrainStructuralPassMode || 'full';
        const depthUnderlayOnly = structuralMode === 'depth-underlay';
        const occlusionCapOnly = structuralMode === 'occlusion-cap';

        // Project all four corners through the active camera. Rendering every potential edge from
        // these projected corners prevents rotated views from losing block sides.
        const north = this.worldToScreen(x - 0.5, y - 0.5, tile.elev);
        const east = this.worldToScreen(x + 0.5, y - 0.5, tile.elev);
        const south = this.worldToScreen(x + 0.5, y + 0.5, tile.elev);
        const west = this.worldToScreen(x - 0.5, y + 0.5, tile.elev);
        const center = s;

        const neighbor = {
          n: this.map[y - 1]?.[x] ?? null,
          e: this.map[y]?.[x + 1] ?? null,
          s: this.map[y + 1]?.[x] ?? null,
          w: this.map[y]?.[x - 1] ?? null
        };

        const exposure = this.resolveHalfBlockExposure(x, y, tile, { north, east, south, west }, neighbor);

        const lip = isWater ? 5 : 3;
        if (!occlusionCapOnly && !groundCached && !waterCached) {
          ctx.save();
          ctx.globalAlpha = isCaveWall ? 0.22 : 0.11;
          ctx.fillStyle = '#000';
          this.fillPoly([
            { x: west.x + 7, y: west.y + lip + 8 },
            { x: south.x + 10, y: south.y + lip + 11 },
            { x: east.x + 13, y: east.y + lip + 4 },
            { x: south.x + 3, y: south.y + lip - 4 }
          ]);
          ctx.restore();
        }

        // Deep water owns its own visible shaft/drop. Rivers and lakes now read as actual depth,
        // not just a flat blue surface. Depth is stored on tiles where available and derived
        // deterministically for older saves.
        if (!occlusionCapOnly && isWater) {
          this.drawDeepWaterShaft(x, y, tile, { north, east, south, west }, neighbor, def);
        }

        // Build the structural edge list once so the cached terrain pipeline can render ground
        // depth faces below the cached top surface, then render only material caps after it.
        const tallFaces = exposure.faces.map(face => {
          const bottomA = this.worldToScreen(face.ax, face.ay, face.lowerElev);
          const bottomB = this.worldToScreen(face.bx, face.by, face.lowerElev);
          const caveWallBoundary = isCaveWall && face.other && face.other.type !== TILE.CAVE_WALL;
          const caveShade = face.key === 'n' ? -11 : face.key === 'e' ? -5 : face.key === 's' ? -12 : -18;
          return { ...face, shade: isCaveWall ? caveShade : face.shade, caveWallBoundary, bottomA, bottomB };
        });

        if (occlusionCapOnly) {
          // V0.21.8: REDRAW THE WALL FACES HERE, after the cached chunk surfaces have been blitted.
          //
          // THE BUG THIS FIXES, and why four previous attempts missed it: structural wall faces are
          // drawn in the EARLIER 'depth-underlay' pass (game.js), and drawTerrainChunks then blits the
          // cached top surfaces OVER them. Those cached layers are composited in ELEVATION order with
          // NO camera-yaw term, so as the camera rotates the screen area each projected layer covers
          // shifts relative to where the faces were drawn - and at some angles a layer lands on top of
          // a face that should be in front of it. The face is not missing; it is painted over.
          //
          // That is both reported symptoms at once: "corners vanish" is a layer covering a face, and
          // "the layer below renders on top at different angles" is the same overlap seen from the
          // other side. V0.20.92-95 all improved the faces themselves - joins, shading, source data,
          // colour - and none could survive being overdrawn afterwards.
          //
          // Redrawing here rather than moving the underlay: the underlay still does useful work (it
          // puts face pixels beneath the cached surface so the top edge caps cleanly), and drawing the
          // same face twice is idempotent - identical geometry, identical colour, same pixels. The
          // second draw simply lands AFTER the blit, so it survives.
          // CLIPPED TO THE FACE QUAD. Without this the redraw spills past its own top edge and
          // paints over the cached ground surface that is supposed to cap it - which made the front
          // face read as a ground tile and made the raised block's top surface look like it sat
          // BELOW its own wall. In the underlay pass that capping came for free, because the blit
          // landed on top afterwards; a redraw after the blit has to respect the edge itself.
          //
          // The clip is the exact quad the face occupies - top edge a->b, bottom edge
          // aBottom->bBottom - so the wall can still cover the lower ground in front of it (which is
          // the whole point) while being unable to touch anything at or above its own lip.
          if (!isWater) {
            const { ctx } = window.DreamRealms.runtime || {};
            // V0.21.12: ONLY CAMERA-FACING WALLS ARE REDRAWN.
            //
            // V0.21.8 redrew EVERY face after the chunk blit so they would stop being painted over.
            // That was too broad: the far side of a plateau is SUPPOSED to be hidden behind its own
            // top surface. Redrawing those made their INSIDE visible, so standing on raised ground
            // showed the backs of the far walls and the player no longer read as being on top of
            // anything - the user's words, "it looks like just a wall, it doesn't look like im on
            // top of the ground either".
            //
            // Near/far is decided by the engine's own projection rather than by edge key, because
            // which compass direction faces the camera changes with yaw: a face is on the near side
            // when its top edge projects LOWER on screen than the tile's own centre. That test is
            // correct at any heading and needs no rotation maths of its own.
            const centreY = this.worldToScreen(x, y, tile?.elev || 0).y;
            for (const face of tallFaces) {
              if ((face.a.y + face.b.y) * 0.5 <= centreY + 0.5) continue;   // far side: stays capped
              if (ctx) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(face.a.x, face.a.y);
                ctx.lineTo(face.b.x, face.b.y);
                ctx.lineTo(face.bottomB.x, face.bottomB.y);
                ctx.lineTo(face.bottomA.x, face.bottomA.y);
                ctx.closePath();
                ctx.clip();
              }
              this.drawLayeredWallFace(face.a, face.b, face.bottomA, face.bottomB, def, isCaveWall, tileVariant, face.key, face.shade);
              this.drawWallCourses(face.a, face.b, face.bottomA, face.bottomB, def, isCaveWall);
              this.drawWallFaceDetails(face.a, face.b, face.bottomA, face.bottomB, def, isCaveWall, tileVariant, x, y, face.key);
              if (ctx) ctx.restore();
              // Ledge lip drawn OUTSIDE the clip: it is the highlight that sits ON the edge line, so
              // clipping it to the face would shave off the half that reads as the lip.
              this.drawLedgeLip(face.a, face.b, isCaveWall, tileVariant, face.key);
            }
            // V0.21.13: THE CORNER JOINS TOO. This is the triangular notch left at corners after
            // V0.21.12. Where two wall faces meet, a wedge of geometry fills the gap between them,
            // and it is drawn by drawHalfBlockCornerJoins in the FULL path (line ~2001) - which the
            // cap pass never reached, because the cap pass only called
            // drawHalfBlockCornerOcclusionCaps, a DIFFERENT routine that draws occlusion caps rather
            // than the join wedge. So the joins were drawn in the underlay, buried by the ground
            // blit, and never redrawn: every wall face survived, and the wedge between them did not.
            //
            // Deliberately NOT filtered by camera facing, unlike the faces above. A corner join sits
            // BETWEEN two faces, so at a convex corner one of its neighbours can be near-side while
            // the other is far-side; filtering the wedge by either one leaves the notch back. The
            // join routine already decides for itself which corners are exposed.
            this.drawHalfBlockCornerJoins(x, y, tile, tallFaces, { north, east, south, west }, def, isCaveWall, tileVariant, exposure.cornerJoins);
          }
          if (!isWater && !isCaveWall && this.isTerrainChunkGroundTile(tile)) {
            for (const face of tallFaces) this.drawGroundSurfaceOcclusionLip(x, y, tile, face.a, face.b, tileVariant, face.key);
            this.drawHalfBlockCornerOcclusionCaps(x, y, tile, tallFaces, { north, east, south, west }, tileVariant, exposure.cornerJoins);
          }
          return;
        }

        // Draw true vertical faces for all four edges when the adjacent tile is lower or when a
        // cave wall borders open floor. This is intentionally not limited to south/east, because
        // the camera can rotate freely.
        let anyTallFace = tallFaces.length > 0;
        for (const face of tallFaces) {
          this.drawLayeredWallFace(face.a, face.b, face.bottomA, face.bottomB, def, isCaveWall, tileVariant, face.key, face.shade);
          this.drawWallCourses(face.a, face.b, face.bottomA, face.bottomB, def, isCaveWall);
          this.drawWallFaceDetails(face.a, face.b, face.bottomA, face.bottomB, def, isCaveWall, tileVariant, x, y, face.key);
          if (!depthUnderlayOnly) {
            this.drawLedgeLip(face.a, face.b, isCaveWall, tileVariant, face.key);
            if (tileVariant.name === 'chipped' || tileVariant.name === 'cracked') this.drawBrokenEdgeDetail(face.a, face.b, tileVariant, face.key);
          }
        }
        this.drawHalfBlockCornerJoins(x, y, tile, tallFaces, { north, east, south, west }, def, isCaveWall, tileVariant, exposure.cornerJoins);

        if (depthUnderlayOnly) return;

        // Thin walkable floor lips remain for low/flat terrain so individual tiles retain 2.5D mass.
        if (!anyTallFace && !isWater && !groundCached) {
          const southFloorA = { x: west.x, y: west.y + lip };
          const southFloorB = { x: south.x, y: south.y + lip };
          const southFloorC = { x: east.x, y: east.y + lip * 0.82 };
          ctx.fillStyle = colorShade(def.side, -7);
          this.fillPoly([south, west, southFloorA, southFloorB]);
          ctx.fillStyle = colorShade(def.side, -3);
          this.fillPoly([east, south, southFloorB, southFloorC]);
        }

        if (groundCached || waterCached) return;

        let top = def.top;
        const heightLight = tile.elev * 5;
        const checker = seededNoise(x * 5, y * 5, 711) > 0.5 ? 3 : -2;
        top = colorShade(top, heightLight + checker);

        const bevel = isCaveWall ? 5 : 4;
        ctx.fillStyle = colorShade(def.rim, isCaveWall ? -8 : -10);
        this.fillPoly([north, east, south, west]);
        ctx.fillStyle = top;
        this.fillPoly([
          this.lerpPoint(north, center, bevel / 26),
          this.lerpPoint(east, center, bevel / 28),
          this.lerpPoint(south, center, bevel / 26),
          this.lerpPoint(west, center, bevel / 28)
        ]);

        const facet = seededNoise(x, y, 1904);
        if (isCaveWall) {
          ctx.fillStyle = colorShade(top, 6 + facet * 4);
          this.fillPoly([north, east, center, west]);
          ctx.fillStyle = colorShade(top, -5 + facet * 2);
          this.fillPoly([center, east, south, west]);
        } else if (!isWater) {
          ctx.save();
          ctx.globalAlpha = 0.20;
          ctx.fillStyle = colorShade(top, 8 + facet * 4);
          this.fillPoly([north, east, center, west]);
          ctx.fillStyle = colorShade(top, -6 + facet * 2);
          this.fillPoly([west, center, east, south]);
          ctx.restore();
        }

        this.drawTileBevels(north, east, south, west, isCaveWall, isWater, tileVariant, neighbor, tile);
        this.drawTerrainEdgeTransitions(x, y, tile, { north, east, south, west, center }, neighbor, tileVariant);
        this.drawOrganicTerrainBlend(x, y, tile, { north, east, south, west, center }, neighbor, tileVariant);

        if (!isWater) {
          if (this.hash2D(x, y, 7027) < 0.52) this.drawTileMicroDetails(s, tile, x, y, tileVariant, { north, east, south, west });
          if (this.hash2D(x, y, 7028) < 0.60) this.drawGroundDetail(s, tile, x, y);
          this.drawGroundDecalLayer(s, tile, x, y, tileVariant);
          if (tile.silkWebHighFidelity || tile.silkWebCavern) this.drawSilkWebCavernSurfaceDetails?.(s, tile, x, y, tileVariant, { north, east, south, west, center });
          this.drawTerrainScatterDetails?.(s, tile, x, y, tileVariant);
        }
      },


      // V0.18.40: dedicated silk-floor overlay. The Silk Web Cavern floor is CHUNKED
      // terrain (isTerrainChunkGroundTile == true for CAVE_FLOOR), so drawTile runs in
      // 'depth-underlay'/'occlusion-cap' mode for those tiles and RETURNS before the
      // per-tile surface detail at drawSilkWebCavernSurfaceDetails - meaning the floor
      // webbing added in V0.18.37/38 never actually rendered. This pass draws it directly
      // over the (cached) terrain every frame, under the entity/object pass. Called from
      // game.js after the terrain passes.
      renderSilkWebFloorOverlay(minX, maxX, minY, maxY) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !this.map) return;
        if (this.currentZone !== 'dungeon' || this.dungeonSystem?.state?.active?.dungeonId !== 'silk_web_cavern') return;
        const W = ctx.canvas?.width || 100000;
        const H = ctx.canvas?.height || 100000;
        for (let y = minY; y <= maxY; y++) {
          const row = this.map[y];
          if (!row) continue;
          for (let x = minX; x <= maxX; x++) {
            const tile = row[x];
            if (!tile || tile.type !== TILE.CAVE_FLOOR) continue;
            if (!tile.silkWebCavern && !tile.silkWebHighFidelity) continue;
            const s = this.worldToScreen(x, y, tile.elev);
            if (s.x < -140 || s.y < -120 || s.x > W + 140 || s.y > H + 140) continue;
            const corners = {
              north: this.worldToScreen(x - 0.5, y - 0.5, tile.elev),
              east: this.worldToScreen(x + 0.5, y - 0.5, tile.elev),
              south: this.worldToScreen(x + 0.5, y + 0.5, tile.elev),
              west: this.worldToScreen(x - 0.5, y + 0.5, tile.elev),
              center: s
            };
            const variant = this.getTileVisualVariant?.(x, y, tile) || {};
            this.drawSilkWebCavernSurfaceDetails(s, tile, x, y, variant, corners);
          }
        }
      },

      drawSilkWebCavernSurfaceDetails(s, tile, x, y, variant = {}, corners = null) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !tile || tile.type !== TILE.CAVE_FLOOR) return;
        // V0.18.38: the floor must read as "you are INSIDE a giant spider web" - MOSTLY
        // webbing with only thin winding dirt paths showing the ground. Each web tile
        // gets a silk film base + a back web layer + a dense front lattice + an orb-web
        // hub (webs on webs on webs). A coherent low-frequency mask carves the thin dirt
        // paths through it. Deterministic per tile (hash2D) so nothing shimmers on pan.
        const royal = !!tile.royalSilk;
        const cocoon = !!tile.cocoonWall;
        const venom = !!tile.venomTint;
        const N = corners?.north || { x: s.x, y: s.y - 15 };
        const E = corners?.east || { x: s.x + 32, y: s.y };
        const S = corners?.south || { x: s.x, y: s.y + 15 };
        const W = corners?.west || { x: s.x - 32, y: s.y };
        const C = corners?.center || { x: s.x, y: s.y - 1 };
        const silk = royal ? '255,182,238' : cocoon ? '232,222,248' : venom ? '206,236,150' : '222,212,244';
        const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        // coherent webbiness: coarse 3x3 blobs + fine detail -> mostly webbed, thin dirt paths.
        const coarse = this.hash2D(Math.floor(x / 3), Math.floor(y / 3), 8801);
        const fine = this.hash2D(x, y, 8802);
        const dirtPath = (coarse * 0.62 + fine * 0.38) < 0.17;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (!dirtPath) {
          // 1) silk film base so the floor reads as covered.
          ctx.globalAlpha = royal ? 0.26 : venom ? 0.2 : 0.22;
          ctx.fillStyle = `rgba(${silk},1)`;
          ctx.beginPath();
          ctx.moveTo(N.x, N.y); ctx.lineTo(E.x, E.y); ctx.lineTo(S.x, S.y); ctx.lineTo(W.x, W.y); ctx.closePath();
          ctx.fill();
          // 2) BACK web layer - cooler, offset threads reading as webs UNDER the top web.
          const perim = [lerp(W, N, 0.4), lerp(N, E, 0.35), lerp(N, E, 0.72), lerp(E, S, 0.4), lerp(S, W, 0.35), lerp(S, W, 0.72), lerp(W, N, 0.76)];
          ctx.strokeStyle = `rgba(${silk},0.5)`;
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.28;
          for (let i = 0; i < perim.length; i++) {
            const a = perim[i], b = perim[(i + 3) % perim.length];
            const mx = (a.x + b.x) * 0.5 + (this.hash2D(x + i, y, 8811) - 0.5) * 6;
            const my = (a.y + b.y) * 0.5 + 2 + this.hash2D(x, y + i, 8812) * 5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
          }
          // 3) V0.18.48: an IRREGULAR woven cobweb (replaces the rigid corner-to-corner truss
          // that tiled into a geometric triangle grid). Threads run between JITTERED interior
          // anchors - not the shared tile corners - and sag like real draped silk, so no
          // repeating geodesic mesh forms and the floor reads as organic spider silk.
          const anchors = [];
          for (let a = 0; a < 5; a++) {
            const t1 = this.hash2D(x * 3 + a, y * 2 - a, 8850 + a);
            const t2 = this.hash2D(x - a * 2, y * 4 + a, 8860 + a);
            anchors.push({ x: C.x + (t1 - 0.5) * 48 + (t2 - 0.5) * 8, y: C.y + (t2 - 0.5) * 23 + (t1 - 0.5) * 4 });
          }
          ctx.strokeStyle = `rgba(${silk},0.74)`;
          ctx.lineWidth = 1.0;
          ctx.globalAlpha = royal ? 0.5 : 0.44;
          ctx.beginPath();
          for (let a = 0; a < anchors.length; a++) {
            const p = anchors[a], q = anchors[(a + 1) % anchors.length];
            ctx.moveTo(p.x, p.y);
            ctx.quadraticCurveTo((p.x + q.x) / 2 + (this.hash2D(x + a, y, 8870) - 0.5) * 8, (p.y + q.y) / 2 + 4 + this.hash2D(x, y + a, 8871) * 6, q.x, q.y);
            if (this.hash2D(x + a, y - a, 8872) > 0.45) { const r = anchors[(a + 2) % anchors.length]; ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo((p.x + r.x) / 2, (p.y + r.y) / 2 + 5, r.x, r.y); }
          }
          ctx.stroke();
          // a few loose threads reaching toward the edges to tie loosely to neighbours (jittered
          // targets, so no rigid shared-corner grid re-forms)
          ctx.globalAlpha = 0.3; ctx.lineWidth = 0.7;
          ctx.beginPath();
          const edges = [N, E, S, W];
          for (let e = 0; e < edges.length; e++) {
            if (this.hash2D(x + e, y - e, 8880) > 0.5) continue;
            const src = anchors[(this.hash2D(x, y + e, 8881) * anchors.length) | 0];
            const tgt = lerp(C, edges[e], 0.68 + this.hash2D(x + e, y, 8882) * 0.26);
            ctx.moveTo(src.x, src.y); ctx.quadraticCurveTo((src.x + tgt.x) / 2, (src.y + tgt.y) / 2 + 4, tgt.x, tgt.y);
          }
          ctx.stroke();
          // V0.18.50: sparse, dim beads at a couple of anchor knots (was a bright bead on
          // every knot, which read as a dotted geometric mesh across the floor).
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = royal ? 'rgba(255,232,250,0.7)' : 'rgba(246,243,255,0.7)';
          for (let a = 0; a < anchors.length; a++) { if (this.hash2D(x + a, y * 2, 8883) > 0.74) { ctx.beginPath(); ctx.arc(anchors[a].x, anchors[a].y, 0.6, 0, Math.PI * 2); ctx.fill(); } }
          // 4) V0.18.46: a proper WOVEN orb web on most tiles - iso-squashed radial spokes tied
          // together by a real capture spiral (not just concentric rings), with bright silk
          // beads at the junctions. The orb web is the clearest "spider web" read.
          if (this.hash2D(x, y, 8820) > 0.42) {
            const hx = C.x + (this.hash2D(x, y, 8821) - 0.5) * 12;
            const hy = C.y + (this.hash2D(y, x, 8822) - 0.5) * 7;
            const spokes = 8, R = 15, ky = 0.46, rot = this.hash2D(x, y, 8823) * Math.PI;
            // V0.18.50: dimmer, thinner radial spokes so they no longer read as a hard
            // star-burst repeated across the floor.
            ctx.strokeStyle = `rgba(${silk},0.6)`;
            ctx.lineWidth = 0.55;
            ctx.globalAlpha = royal ? 0.3 : 0.24;
            for (let sp = 0; sp < spokes; sp++) { const a = sp * (Math.PI * 2 / spokes) + rot; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * R, hy + Math.sin(a) * R * ky); ctx.stroke(); }
            // the capture spiral is now the dominant feature - denser (~3 turns) + brighter, so
            // the soft coil of a real orb web reads instead of the straight spokes.
            ctx.strokeStyle = `rgba(${silk},0.74)`;
            ctx.lineWidth = 0.7;
            ctx.globalAlpha = royal ? 0.5 : 0.42;
            ctx.beginPath();
            let started = false;
            for (let tt = 0.14; tt <= 1.001; tt += 1 / (spokes * 3)) {
              const a = tt * Math.PI * 2 * 3.0 + rot, rr = R * tt;
              const px = hx + Math.cos(a) * rr, py = hy + Math.sin(a) * rr * ky;
              if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
            }
            ctx.stroke();
            // just a soft centre bead (dropped the ring of junction dots that read as mesh vertices)
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = royal ? 'rgba(255,232,250,0.8)' : 'rgba(246,243,255,0.8)';
            ctx.beginPath(); ctx.arc(hx, hy, 1.0, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          // dirt path tile: only a couple of stray edge threads so even the path feels infested.
          ctx.strokeStyle = `rgba(${silk},0.5)`;
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.3;
          for (let i = 0; i < 2; i++) {
            const a = lerp(W, N, this.hash2D(x + i, y, 8831));
            const b = lerp(N, E, this.hash2D(x, y + i, 8832));
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (venom) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = 'rgba(166,255,104,0.42)';
          ctx.beginPath();
          ctx.ellipse(C.x - 6 + this.hash2D(x, y, 8841) * 12, C.y + 3, 18, 5, -0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },


      // V0.18.63: wall CUT-AWAY. Tall cave walls (elev ~5 = ~140px) are drawn as depth-sorted
      // occluders so they hide actors genuinely behind them - but that also means a wall reaches
      // up the screen and paints over friendly actors (player/mercs/pets/bots) that are standing
      // near it at whatever camera angle. This scans the friendly party each frame and marks the
      // cave-wall tiles whose tall body would draw OVER a friendly, so drawCaveWallDepthOccluder
      // can skip its redraw for those tiles (the base terrain pass still paints the wall BEHIND
      // the actors, so the wall stays fully visible - it just no longer covers your party).
      // Projection-based (uses the live camera yaw), so it holds at every angle. Enemies are NOT
      // cut away, so they stay properly hidden behind walls.
      computeCaveWallCutaways() {
        const DR = window.DreamRealms;
        const TILE = DR.TILE || window.TILE;
        const set = this._caveWallCutawaySet || (this._caveWallCutawaySet = new Set());
        set.clear();
        const map = this.map;
        if (!map || !TILE) return set;
        const c = this.getCameraProjectionCache?.();
        if (!c) return set;
        const cx = c.centerX, cy = c.centerY, cos = c.cos, sin = c.sin;
        const friends = [this.player, this.merc, this.pet]
          .concat(this.botPlayers || [], this.mercs || [], this.pets || [], this.companions || []);
        const RANGE = 5;           // tiles to scan around each friendly (covers a ~140px tall wall)
        const REACH = 5.2;         // max depth (in tiles) a wall's tall body reaches up the screen
        const HALF_OVERLAP = 1.2;  // horizontal screen overlap threshold (in tile-proxy units)
        for (const e of friends) {
          if (!e || e.alive === false) continue;
          const ex = Number(e.x), ey = Number(e.y);
          if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;
          const fx = Math.floor(ex), fy = Math.floor(ey);
          const et = map[fy]?.[fx];
          const aElev = Number(et?.elev) || 0;
          const adx = ex - cx, ady = ey - cy;
          const apx = adx * cos - ady * sin, apy = adx * sin + ady * cos;
          const aDepth = apx + apy + aElev * 0.025;
          const aProxyX = apx - apy;
          for (let wy = fy - RANGE; wy <= fy + RANGE; wy++) {
            const row = map[wy];
            if (!row) continue;
            for (let wx = fx - RANGE; wx <= fx + RANGE; wx++) {
              const t = row[wx];
              if (!t || t.type !== TILE.CAVE_WALL) continue;
              const wElev = Number(t.elev) || 0;
              const wdx = wx - cx, wdy = wy - cy;
              const wpx = wdx * cos - wdy * sin, wpy = wdx * sin + wdy * cos;
              const wDepth = wpx + wpy + wElev * 0.025;
              const dd = wDepth - aDepth;          // wall must be IN FRONT and within its reach
              if (dd <= 0.05 || dd > REACH) continue;
              if (Math.abs((wpx - wpy) - aProxyX) > HALF_OVERLAP) continue; // horizontal overlap
              set.add(wx * 4096 + wy);
            }
          }
        }
        return set;
      },

      caveWallOcclusionDepth(x, y, tile) {
        const DR = window.DreamRealms;
        const TILE = DR.TILE || window.TILE;
        if (!tile || tile.type !== TILE.CAVE_WALL) return this.cameraDepth(x + 0.5, y + 0.5, Number(tile?.elev) || 0);
        const elev = Number(tile.elev) || 0;
        const depths = [
          this.cameraDepth(x - 0.5, y - 0.5, elev),
          this.cameraDepth(x + 0.5, y - 0.5, elev),
          this.cameraDepth(x + 0.5, y + 0.5, elev),
          this.cameraDepth(x - 0.5, y + 0.5, elev)
        ];
        // Use the camera-front top corner as the sort anchor (rotation-robust: the frontmost
        // corner is always the max regardless of yaw). The wall/roof occluder must draw after
        // actors behind the cave wall, but before actors standing in front of it.
        // V0.18.62: dropped the old +0.38 forward bias. That bias pushed the wall ~0.38 depth
        // units PAST its own frontmost corner, so a cave wall reached out and drew its corner
        // over players/mercs/pets/mobs standing at or just in front of its front face (the
        // user's "wall corners shouldn't render over players"). The bare front corner still
        // covers everything genuinely behind the wall (huge margin) but no longer over-reaches.
        return Math.max(...depths);
      },

      drawCaveWallDepthOccluder(x, y, tile) {
        const DR = window.DreamRealms;
        const { TILE, TILE_DEF } = DR;
        const { seededNoise, colorShade } = DR.utils || {};
        const { ctx } = DR.runtime || {};
        if (!ctx || !tile || tile.type !== TILE.CAVE_WALL) return false;
        const def = TILE_DEF[tile.type];
        if (!def) return false;
        // V0.18.63: cut-away. If this wall's tall body would draw over a friendly actor
        // (see computeCaveWallCutaways), skip the occluder redraw entirely - the base terrain
        // pass already painted the wall BEHIND the actors, so the party stays visible in front
        // of it instead of the wall's corner/face covering them.
        if (this._caveWallCutaways && this._caveWallCutaways.has(x * 4096 + y)) return false;
        const tileVariant = this.getTileVisualVariant?.(x, y, tile) || { name: 'normal', seed: 0, r: 0.5, intensity: 0 };
        const north = this.worldToScreen(x - 0.5, y - 0.5, tile.elev);
        const east = this.worldToScreen(x + 0.5, y - 0.5, tile.elev);
        const south = this.worldToScreen(x + 0.5, y + 0.5, tile.elev);
        const west = this.worldToScreen(x - 0.5, y + 0.5, tile.elev);
        const center = this.worldToScreen(x, y, tile.elev);
        const neighbor = {
          n: this.map[y - 1]?.[x] ?? null,
          e: this.map[y]?.[x + 1] ?? null,
          s: this.map[y + 1]?.[x] ?? null,
          w: this.map[y]?.[x - 1] ?? null
        };
        const exposure = this.resolveHalfBlockExposure(x, y, tile, { north, east, south, west }, neighbor);
        const tallFaces = exposure.faces.map(face => {
          const bottomA = this.worldToScreen(face.ax, face.ay, face.lowerElev);
          const bottomB = this.worldToScreen(face.bx, face.by, face.lowerElev);
          const caveShade = face.key === 'n' ? -11 : face.key === 'e' ? -5 : face.key === 's' ? -12 : -18;
          return { ...face, shade: caveShade, bottomA, bottomB };
        });

        // Redraw only cave structural mass as a depth-sorted occluder. The normal terrain pass
        // still paints the cave first; this pass is the owning camera-depth correction that lets
        // rotated cave roofs/front lips cover actors that are actually behind them.
        for (const face of tallFaces) {
          this.drawLayeredWallFace(face.a, face.b, face.bottomA, face.bottomB, def, true, tileVariant, face.key, face.shade);
          this.drawWallCourses(face.a, face.b, face.bottomA, face.bottomB, def, true);
          this.drawWallFaceDetails(face.a, face.b, face.bottomA, face.bottomB, def, true, tileVariant, x, y, face.key);
          this.drawLedgeLip(face.a, face.b, true, tileVariant, face.key);
        }
        this.drawHalfBlockCornerJoins(x, y, tile, tallFaces, { north, east, south, west }, def, true, tileVariant, exposure.cornerJoins);

        let top = def.top;
        const facet = (typeof seededNoise === 'function' ? seededNoise(x, y, 1904) : this.hash2D(x, y, 1904));
        const shade = typeof colorShade === 'function' ? colorShade : (c => c);
        ctx.save();
        const bevel = 5;
        ctx.fillStyle = shade(def.rim, -8);
        this.fillPoly([north, east, south, west]);
        ctx.fillStyle = shade(top, 5 + facet * 3);
        this.fillPoly([
          this.lerpPoint(north, center, bevel / 26),
          this.lerpPoint(east, center, bevel / 28),
          this.lerpPoint(south, center, bevel / 26),
          this.lerpPoint(west, center, bevel / 28)
        ]);
        ctx.fillStyle = shade(top, 6 + facet * 4);
        this.fillPoly([north, east, center, west]);
        ctx.fillStyle = shade(top, -5 + facet * 2);
        this.fillPoly([center, east, south, west]);
        ctx.restore();
        this.drawTileBevels(north, east, south, west, true, false, tileVariant, neighbor, tile);
        if (this.hash2D(x, y, 7027) < 0.52) this.drawTileMicroDetails(center, tile, x, y, tileVariant, { north, east, south, west });
        if (this.hash2D(x, y, 7028) < 0.60) this.drawGroundDetail(center, tile, x, y);
        this.drawGroundDecalLayer(center, tile, x, y, tileVariant);
        this.drawTerrainScatterDetails?.(center, tile, x, y, tileVariant);
        if (tile.silkWebWall) this.drawSilkCavernWallWebs({ north, east, south, west }, tallFaces, x, y, tile);
        return true;
      },

      // V0.18.37: silk drapes hanging on the Silk Web Cavern's walls so the walls read
      // as webbed too, not just the floor. Draws vertical drape strands falling from
      // each exposed wall face's top edge partway down the face, plus a couple of
      // horizontal binding threads. Deterministic per tile (hash2D) so it never shimmers.
      drawSilkCavernWallWebs(corners, tallFaces, x, y, tile) {
        const { ctx } = window.DreamRealms.runtime || {};
        if (!ctx || !Array.isArray(tallFaces) || !tallFaces.length) return;
        // V0.18.40: heavy woven silk sheeting caking the cavern walls. Each exposed face
        // gets a gradient silk sheet (denser at the top), a thick set of vertical drapes,
        // a diagonal cross-weave, horizontal binding threads, dangling silk beads and
        // corner orb webs - so the walls read as thickly caked in web, not lightly draped.
        const royal = !!tile.royalSilk;
        const silk = royal ? '255,182,238' : '226,216,246';
        ctx.save();
        ctx.lineCap = 'round';
        const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        for (const face of tallFaces) {
          const ta = face.a, tb = face.b, ba = face.bottomA, bb = face.bottomB;
          if (!ta || !tb || !ba || !bb) continue;
          // V0.18.62: clip every web on this wall to THIS face's quad. Fixes the user's
          // "webs render over the top of the walls" - the drape strands, the variety-a
          // floor curtain (which used to hang ~32px past the face bottom) and the corner
          // orb webs no longer spill above the top edge onto the wall/ledge top, nor below
          // onto the ledge/floor in front. Silk stays strictly on the vertical face.
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(ta.x, ta.y); ctx.lineTo(tb.x, tb.y); ctx.lineTo(bb.x, bb.y); ctx.lineTo(ba.x, ba.y); ctx.closePath();
          ctx.clip();
          // 1) silk sheet over the face, denser toward the top (gradient).
          const g = ctx.createLinearGradient(ta.x, ta.y, ba.x, ba.y);
          g.addColorStop(0, `rgba(${silk},${royal ? 0.42 : 0.34})`);
          g.addColorStop(0.55, `rgba(${silk},${royal ? 0.24 : 0.19})`);
          g.addColorStop(1, `rgba(${silk},0.06)`);
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(ta.x, ta.y); ctx.lineTo(tb.x, tb.y); ctx.lineTo(bb.x, bb.y); ctx.lineTo(ba.x, ba.y); ctx.closePath();
          ctx.fill();
          // 2) thick vertical drape strands.
          const n = 14;
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            const tx = ta.x + (tb.x - ta.x) * t, tyy = ta.y + (tb.y - ta.y) * t;
            const bx = ba.x + (bb.x - ba.x) * t, byy = ba.y + (bb.y - ba.y) * t;
            const drop = 0.55 + this.hash2D(x + i, y * 3, 9180) * 0.45;
            const ex = tx + (bx - tx) * drop, ey = tyy + (byy - tyy) * drop;
            const sag = this.hash2D(x * 3, y + i, 9181) * 4;
            ctx.strokeStyle = `rgba(${silk},${(0.45 + this.hash2D(x, i, 9182) * 0.35).toFixed(2)})`;
            ctx.lineWidth = 0.8 + this.hash2D(i, y, 9183) * 1.2;
            ctx.globalAlpha = royal ? 0.55 : 0.48;
            ctx.beginPath();
            ctx.moveTo(tx, tyy);
            ctx.quadraticCurveTo((tx + ex) * 0.5 + sag, (tyy + ey) * 0.5, ex, ey);
            ctx.stroke();
            if (this.hash2D(x + i, y + i, 9184) > 0.62) {
              ctx.globalAlpha = 0.45;
              ctx.fillStyle = `rgba(${silk},0.75)`;
              ctx.beginPath(); ctx.arc(ex, ey, 1.1, 0, Math.PI * 2); ctx.fill();
            }
          }
          // 3) diagonal cross-weave between the top and bottom edges (woven look).
          ctx.globalAlpha = royal ? 0.3 : 0.24;
          ctx.strokeStyle = `rgba(${silk},0.5)`;
          ctx.lineWidth = 0.6;
          for (let d = 0; d < 6; d++) {
            const t0 = d / 6, t1 = Math.min(1, t0 + 0.42);
            const p0 = lerp(ta, tb, t0), p1 = lerp(ba, bb, t1);
            ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
            const q0 = lerp(ta, tb, t1), q1 = lerp(ba, bb, t0);
            ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
          }
          // 4) horizontal binding threads weaving the drapes into a mesh.
          ctx.globalAlpha = royal ? 0.38 : 0.32;
          ctx.lineWidth = 0.7;
          ctx.strokeStyle = `rgba(${silk},0.6)`;
          for (let h = 1; h <= 6; h++) {
            const t = h * 0.12;
            const a = lerp(ta, ba, t), c = lerp(tb, bb, t);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo((a.x + c.x) * 0.5, (a.y + c.y) * 0.5 + 3, c.x, c.y);
            ctx.stroke();
          }
          // 5) orb webs tucked into both top corners of the face.
          for (const cornerT of [0.16, 0.84]) {
            if (this.hash2D(x + Math.round(cornerT * 10), y, 9185) < 0.4) continue;
            const anchor = lerp(ta, tb, cornerT);
            const hx = anchor.x, hy = anchor.y + 6;
            ctx.strokeStyle = `rgba(${silk},0.6)`;
            ctx.globalAlpha = 0.42;
            ctx.lineWidth = 0.6;
            for (let ring = 1; ring <= 3; ring++) { ctx.beginPath(); ctx.ellipse(hx, hy, ring * 3.2, ring * 2.8, 0, 0, Math.PI * 2); ctx.stroke(); }
            for (let sp = 0; sp < 5; sp++) { const a = sp * (Math.PI * 2 / 5); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 10, hy + Math.sin(a) * 9); ctx.stroke(); }
          }
          // 6) V0.18.49: per-tile wall-web VARIETY so the walls read differently tile-to-tile -
          // some webs stretch down to the floor, some carry egg sacs, some have tiny spiders on.
          const variety = this.hash2D(x * 2, y * 3, 9190);
          if (variety < 0.3) {
            // (a) a heavy web curtain stretching DOWN to the floor in front of the wall
            ctx.globalAlpha = royal ? 0.2 : 0.16; ctx.fillStyle = `rgba(${silk},1)`;
            ctx.beginPath();
            ctx.moveTo(ta.x, ta.y); ctx.lineTo(tb.x, tb.y);
            ctx.lineTo(bb.x, bb.y + 32); ctx.lineTo(ba.x, ba.y + 32); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = royal ? 0.5 : 0.44; ctx.strokeStyle = `rgba(${silk},0.62)`;
            for (let i = 1; i <= 4; i++) {
              const t = i / 5, top = lerp(ta, tb, t), bot = lerp(ba, bb, t);
              const fx = bot.x + (this.hash2D(x + i, y, 9191) - 0.5) * 6, fy = bot.y + 26 + this.hash2D(x, y + i, 9192) * 22;
              ctx.lineWidth = 1.0 + this.hash2D(i, x, 9193) * 1.2;
              ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo((top.x + fx) / 2 + (this.hash2D(x, i, 9194) - 0.5) * 10, (top.y + fy) / 2, fx, fy); ctx.stroke();
            }
          } else if (variety < 0.55) {
            // (b) egg sacs clustered on the wall web
            const eggs = 3 + (this.hash2D(x, y, 9195) * 3 | 0);
            for (let e = 0; e < eggs; e++) {
              const t = 0.2 + this.hash2D(x + e, y, 9196) * 0.6;
              const p = lerp(lerp(ta, tb, t), lerp(ba, bb, t), 0.28 + this.hash2D(x, y + e, 9197) * 0.44);
              ctx.globalAlpha = 0.9; ctx.fillStyle = `rgba(${silk},0.92)`;
              ctx.beginPath(); ctx.ellipse(p.x, p.y, 3.4 + this.hash2D(e, x, 9198) * 2, 4.4 + this.hash2D(y, e, 9199) * 2.4, 0, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = 'rgba(60,40,70,0.32)'; ctx.lineWidth = 0.6; ctx.stroke();
            }
          } else if (variety < 0.78) {
            // (c) tiny spiders crawling on the wall web. V0.18.54: they WALK back and forth across
            // the web (a ping-pong sweep), FACING their direction of travel with a stepping leg
            // gait - they no longer spin in place on a looping path.
            const n = 1 + (this.hash2D(x, y, 9200) * 3 | 0);
            const wallNow = performance.now();
            const acrossAngle = Math.atan2(tb.y - ta.y, tb.x - ta.x); // "across the web" heading
            for (let sI = 0; sI < n; sI++) {
              const ph = this.hash2D(x + sI, y, 9205);
              const speed = 0.00016 + this.hash2D(sI, x, 9206) * 0.0001;
              const cyc = (wallNow * speed + ph * 2) % 2;        // 0..2
              const tri = cyc < 1 ? cyc : 2 - cyc;               // 0..1..0 -> walk to an edge, turn, walk back
              const goingRight = cyc < 1;
              const tt = 0.16 + tri * 0.68;                      // sweep across the web
              const df = 0.32 + this.hash2D(x, y + sI, 9202) * 0.32 + Math.sin(wallNow * 0.0005 + ph * 6) * 0.06;
              const p = lerp(lerp(ta, tb, tt), lerp(ba, bb, tt), df);
              const ang = acrossAngle + (goingRight ? 0 : Math.PI) + Math.PI / 2; // face the way it walks
              const walk = wallNow * (0.009 + this.hash2D(sI, y, 9207) * 0.005);
              this.drawTinySpider?.(p.x, p.y, 2 + this.hash2D(sI, x, 9203) * 1.4, ang, royal ? '#4a2a48' : '#2e2340', walk);
            }
          }
          // V0.18.62: close this face's web clip (see the ctx.clip() at the top of the loop).
          ctx.restore();
        }
        ctx.restore();
      },

      hash2D(x, y, seed = 1337) {
        let h = ((Math.floor(x) * 374761393) ^ (Math.floor(y) * 668265263) ^ (Math.floor(seed) * 1442695041)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
      },

      getTileVisualVariant(x, y, tile) {
        const r = this.hash2D(x, y, 21931);
        // V0.17.52 Phase 13: moss grows more readily deeper into Dark Woods.
        // depthFactor is 0 near town (mossyCeiling stays at the original
        // 0.68) and raises the ceiling to 0.82 in the deepest regions -
        // roughly 9% baseline mossy-tile chance growing to ~23%.
        const depthFactor = this.darkWoodsDepthFactor?.(x, y) || 0;
        const mossyCeiling = 0.68 + depthFactor * 0.14;
        let name = 'normal';
        if (r < 0.16) name = 'cracked';
        else if (r < 0.32) name = 'dusty';
        else if (r < 0.47) name = 'chipped';
        else if (r < 0.59) name = 'stained';
        else if (r < mossyCeiling) name = 'mossy';
        return { name, r, seed: Math.floor(r * 1000000) + x * 4099 + y * 9176, intensity: this.hash2D(x, y, 21932) };
      },

      drawTileBevels(north, east, south, west, isCaveWall, isWater, variant = {}, neighbor = {}, tile = null) {
        const { ctx } = window.DreamRealms.runtime || {};
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Top-left bevel highlight.
        ctx.globalAlpha = isWater ? 0.055 : (isCaveWall ? 0.13 : 0.07);
        ctx.strokeStyle = isWater ? 'rgba(210,255,255,0.18)' : 'rgba(255,248,214,0.20)';
        ctx.lineWidth = isCaveWall ? 1.1 : 0.85;
        ctx.beginPath();
        ctx.moveTo(west.x, west.y);
        ctx.lineTo(north.x, north.y);
        ctx.lineTo(east.x, east.y);
        ctx.stroke();

        // Bottom-right shadow bevel.
        ctx.globalAlpha = isWater ? 0.070 : (isCaveWall ? 0.18 : 0.10);
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = isCaveWall ? 1.2 : 0.95;
        ctx.beginPath();
        ctx.moveTo(east.x, east.y);
        ctx.lineTo(south.x, south.y);
        ctx.lineTo(west.x, west.y);
        ctx.stroke();

        // Occasional missing grout/chipped corner accents.
        if (variant.name === 'chipped' || variant.name === 'cracked') {
          ctx.globalAlpha = 0.28;
          ctx.strokeStyle = 'rgba(28,24,18,0.55)';
          ctx.lineWidth = 1.3;
          const t = variant.intensity || 0.5;
          const p1 = this.lerpPoint(west, north, 0.12 + t * 0.2);
          const p2 = this.lerpPoint(west, north, 0.24 + t * 0.2);
          ctx.beginPath();
          ctx.moveTo(p1.x + 1, p1.y + 2);
          ctx.lineTo(p2.x + 4, p2.y + 5);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawTileMicroDetails(s, tile, x, y, variant = {}, corners = null) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        const type = tile.type;
        const stoneLike = type === TILE.STONE || type === TILE.RUIN || type === TILE.CAVE_WALL || type === TILE.CAVE_FLOOR;
        const dirtLike = type === TILE.DIRT || type === TILE.CAMP || type === TILE.FOREST_FLOOR;
        const grassLike = type === TILE.DEEP_GRASS || type === TILE.DARK_GRASS || type === TILE.UNDERBRUSH;
        if (!stoneLike && !dirtLike && !grassLike) return;
        ctx.save();

        if (variant.name === 'cracked' || stoneLike) {
          const count = variant.name === 'cracked' ? 2 : 1;
          ctx.globalAlpha = variant.name === 'cracked' ? 0.42 : 0.22;
          ctx.strokeStyle = stoneLike ? 'rgba(31,28,23,0.48)' : 'rgba(68,48,31,0.35)';
          ctx.lineWidth = 1.25;
          for (let i = 0; i < count; i++) {
            const ox = -26 + this.hash2D(x * 13 + i, y * 17, 2401) * 52;
            const oy = -10 + this.hash2D(x * 19 - i, y * 11, 2402) * 20;
            ctx.beginPath();
            ctx.moveTo(s.x + ox, s.y + oy);
            ctx.lineTo(s.x + ox + 8 + this.hash2D(x, y + i, 2403) * 12, s.y + oy - 3 + this.hash2D(y, x + i, 2404) * 7);
            ctx.lineTo(s.x + ox + 22 + this.hash2D(y + i, x, 2405) * 10, s.y + oy + 2 + this.hash2D(x + i, y, 2406) * 9);
            ctx.stroke();
          }
        }

        if (variant.name === 'dusty' || variant.name === 'stained') {
          const dust = variant.name === 'dusty';
          ctx.globalAlpha = dust ? 0.20 : 0.18;
          ctx.fillStyle = dust ? 'rgba(210,184,130,0.55)' : 'rgba(38,29,20,0.58)';
          for (let i = 0; i < 2; i++) {
            const px = s.x - 28 + this.hash2D(x * 7 + i, y * 5, 2511) * 56;
            const py = s.y - 10 + this.hash2D(y * 7 + i, x * 5, 2512) * 22;
            ctx.beginPath();
            ctx.ellipse(px, py, 7 + this.hash2D(i, x, 2513) * 11, 2.5 + this.hash2D(i, y, 2514) * 4, this.hash2D(x, y + i, 2515) * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (variant.name === 'mossy' || grassLike) {
          ctx.globalAlpha = grassLike ? 0.24 : 0.18;
          ctx.fillStyle = 'rgba(62,104,50,0.60)';
          for (let i = 0; i < 1; i++) {
            const px = s.x - 32 + this.hash2D(x + i * 3, y, 2601) * 64;
            const py = s.y - 12 + this.hash2D(y + i * 5, x, 2602) * 25;
            ctx.beginPath();
            ctx.ellipse(px, py, 5 + this.hash2D(x, i, 2603) * 9, 2 + this.hash2D(y, i, 2604) * 3, -0.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Embedded pebbles / broken stone specks.
        if (stoneLike || dirtLike) {
          ctx.globalAlpha = 0.24;
          ctx.fillStyle = 'rgba(40,33,24,0.62)';
          const count = 1 + Math.floor(this.hash2D(x, y, 2701) * 3);
          for (let i = 0; i < count; i++) {
            const px = s.x - 32 + this.hash2D(x * 23 + i, y * 31, 2702) * 64;
            const py = s.y - 12 + this.hash2D(y * 23 + i, x * 31, 2703) * 25;
            ctx.beginPath();
            ctx.ellipse(px, py, 1.5 + this.hash2D(i, x, 2704) * 2.5, 0.9 + this.hash2D(i, y, 2705) * 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      },

      drawGroundDecalLayer(s, tile, x, y, variant = {}) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        const r = this.hash2D(x, y, 3117);
        if (r > 0.74 && variant.name === 'normal') return;
        ctx.save();
        const type = tile.type;
        let color = 'rgba(190,170,120,0.18)';
        if (variant.name === 'stained') color = 'rgba(50,38,26,0.24)';
        else if (variant.name === 'mossy' || type === TILE.DEEP_GRASS || type === TILE.DARK_GRASS) color = 'rgba(70,100,55,0.22)';
        else if (variant.name === 'cracked') color = 'rgba(25,22,18,0.28)';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.72;
        const w = 16 + this.hash2D(x, y, 3118) * 36;
        const h = 5 + this.hash2D(y, x, 3119) * 12;
        ctx.beginPath();
        ctx.ellipse(s.x + (this.hash2D(x, y, 3120) - 0.5) * 34, s.y + (this.hash2D(y, x, 3121) - 0.5) * 16, w, h, (this.hash2D(x, y, 3122) - 0.5) * 0.7, 0, Math.PI * 2);
        ctx.fill();
        if (variant.name === 'cracked') {
          ctx.globalAlpha = 0.46;
          ctx.strokeStyle = 'rgba(22,19,15,0.58)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(s.x - 18, s.y - 3);
          ctx.lineTo(s.x - 4, s.y - 9);
          ctx.lineTo(s.x + 7, s.y - 1);
          ctx.lineTo(s.x + 24, s.y - 4);
          ctx.stroke();
        }
        ctx.restore();
      },

      // V0.17.52 Phase 13: previously a dangling, never-defined optional-chain
      // call (`this.drawTerrainScatterDetails?.(...)`) at both live
      // structural-pass call sites - a silent no-op. Implements two
      // deterministic, low-cost overlays for exactly those tiles (edges,
      // elevation drop-offs, water-adjacent - the minority of tiles that
      // bypass the chunk cache and redraw every frame, so this is
      // deliberately cheap): an extra dark shadow fleck scaled by regional
      // depth (reinforcing the cached-path darkening wash at the specific
      // tiles most likely to be visually prominent - map edges/drop-offs),
      // and a terrain-level "magical residue" shimmer confined to the
      // Stone Hedge Ruins region (Phase 10/3) - the one overlay from the
      // plan's list with no existing equivalent anywhere (the Phase 10
      // magicResidue prop is a separate object-layer effect, not a terrain
      // overlay; this is the terrain-level counterpart).
      drawTerrainScatterDetails(s, tile, x, y, variant = {}) {
        const { ctx } = window.DreamRealms.runtime || {};
        if (!ctx) return;
        const depthFactor = this.darkWoodsDepthFactor?.(x, y) || 0;
        if (depthFactor > 0.15 && this.hash2D(x, y, 61101) < depthFactor * 0.4) {
          ctx.save();
          ctx.globalAlpha = 0.14 + depthFactor * 0.14;
          ctx.fillStyle = '#04060a';
          const w = 10 + this.hash2D(x, y, 61102) * 14;
          const h = 4 + this.hash2D(y, x, 61103) * 6;
          ctx.beginPath();
          ctx.ellipse(s.x + (this.hash2D(x, y, 61104) - 0.5) * 20, s.y + (this.hash2D(y, x, 61105) - 0.5) * 10, w, h, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const region = this.getDarkWoodsRegionAt?.(x, y);
        if (region?.id === 'stone_hedge_clearing' && this.hash2D(x, y, 61201) > 0.82) {
          ctx.save();
          const t = (this.runtimeNowMs?.() || (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())) / 1000;
          const shimmer = 0.16 + Math.sin(t * 0.6 + x * 0.7 + y * 0.4) * 0.08;
          ctx.globalAlpha = Math.max(0, shimmer);
          ctx.fillStyle = '#a9d8ff';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 6 + this.hash2D(x, y, 61202) * 4, 2.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      },

      tileTerrainFamily(tile) {
        const { TILE } = window.DreamRealms;
        if (!tile) return 'void';
        if (tile.type === TILE.WATER) return 'water';
        if (tile.type === TILE.CAVE_WALL) return 'wall';
        if (tile.type === TILE.CAVE_FLOOR || tile.type === TILE.STONE || tile.type === TILE.RUIN) return 'stone';
        if (tile.type === TILE.DIRT || tile.type === TILE.CAMP || tile.type === TILE.FOREST_FLOOR) return 'dirt';
        if (tile.type === TILE.DEEP_GRASS || tile.type === TILE.DARK_GRASS || tile.type === TILE.UNDERBRUSH) return 'grass';
        return String(tile.type || 'other');
      },

      terrainTransitionColor(fromFamily, toFamily) {
        if (fromFamily === 'water' || toFamily === 'water') {
          if (fromFamily === 'dirt' || toFamily === 'dirt') return 'rgba(132,92,54,0.58)';
          if (fromFamily === 'stone' || toFamily === 'stone') return 'rgba(82,86,78,0.48)';
          return 'rgba(93,126,62,0.50)';
        }
        if ((fromFamily === 'grass' && toFamily === 'dirt') || (fromFamily === 'dirt' && toFamily === 'grass')) return 'rgba(112,93,48,0.34)';
        if ((fromFamily === 'grass' && toFamily === 'stone') || (fromFamily === 'stone' && toFamily === 'grass')) return 'rgba(72,96,54,0.30)';
        if ((fromFamily === 'dirt' && toFamily === 'stone') || (fromFamily === 'stone' && toFamily === 'dirt')) return 'rgba(95,76,48,0.32)';
        return 'rgba(0,0,0,0.12)';
      },

      drawEdgeStrip(corners, edgeName, color, alpha = 0.32) {
        const { ctx } = window.DreamRealms.runtime || {};
        const edgeMap = {
          n: ['north', 'east'],
          e: ['east', 'south'],
          s: ['west', 'south'],
          w: ['north', 'west']
        };
        const pair = edgeMap[edgeName];
        if (!pair) return;
        const a = corners[pair[0]];
        const b = corners[pair[1]];
        ctx.save();
        ctx.globalAlpha = alpha * 0.52;
        ctx.strokeStyle = color;
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        const mid = this.lerpPoint(a, b, 0.5);
        const inward = this.lerpPoint(mid, corners.center, 0.10);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(inward.x, inward.y, b.x, b.y);
        ctx.stroke();
        ctx.restore();
      },

      drawTerrainEdgeTransitions(x, y, tile, corners, neighbor, variant = {}) {
        const family = this.tileTerrainFamily(tile);
        if (family === 'wall') return;
        const checks = [
          ['n', neighbor.n],
          ['e', neighbor.e],
          ['s', neighbor.s],
          ['w', neighbor.w]
        ];
        for (const [edge, other] of checks) {
          const otherFamily = this.tileTerrainFamily(other);
          if (otherFamily === family) continue;
          if (otherFamily === 'void') continue;
          const color = this.terrainTransitionColor(family, otherFamily);
          const alpha = family === 'water' || otherFamily === 'water' ? 0.58 : 0.38;
          if (family !== 'water' && otherFamily === 'water') this.drawLegacyShoreDepthEdge(corners, edge, variant);
          this.drawEdgeStrip(corners, edge, color, alpha);
        }
      },


      drawOrganicTerrainBlend(x, y, tile, corners, neighbor, variant = {}) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !tile || tile.type === TILE.CAVE_WALL) return;
        const family = this.tileTerrainFamily(tile);
        if (family === 'water' || family === 'wall' || family === 'void') return;
        const edges = [
          ['n', neighbor.n, corners.north, corners.east],
          ['e', neighbor.e, corners.east, corners.south],
          ['s', neighbor.s, corners.west, corners.south],
          ['w', neighbor.w, corners.north, corners.west]
        ];
        const transitionSeeds = {
          grass: 'rgba(31,57,28,0.26)',
          dirt: 'rgba(99,72,42,0.24)',
          stone: 'rgba(86,86,72,0.22)'
        };
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [edge, other, a, b] of edges) {
          const otherFamily = this.tileTerrainFamily(other);
          if (!other || otherFamily === family || otherFamily === 'void' || otherFamily === 'wall') continue;
          if (otherFamily === 'water') continue;
          const color = transitionSeeds[otherFamily] || this.terrainTransitionColor(family, otherFamily);
          const seed = (variant.seed || 0) + edge.charCodeAt(0) * 97;
          const strands = family === 'grass' || otherFamily === 'grass' ? 5 : 3;
          for (let i = 0; i < strands; i++) {
            const t = 0.10 + this.hash2D(x + i * 3, y + seed, 15001) * 0.80;
            const p0 = this.lerpPoint(a, b, t);
            const inward = this.lerpPoint(p0, corners.center, 0.16 + this.hash2D(y + i, x + seed, 15002) * 0.18);
            const wobble = (this.hash2D(x + seed, y + i, 15003) - 0.5) * 7;
            ctx.globalAlpha = 0.30 + this.hash2D(x + i, y + seed, 15004) * 0.18;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2 + this.hash2D(seed + i, x - y, 15005) * 1.6;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.quadraticCurveTo((p0.x + inward.x) * 0.5 + wobble, (p0.y + inward.y) * 0.5 - wobble * 0.18, inward.x, inward.y);
            ctx.stroke();
          }
          if ((family === 'grass' && otherFamily === 'dirt') || (family === 'dirt' && otherFamily === 'grass')) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = family === 'grass' ? 'rgba(54,84,38,0.34)' : 'rgba(72,88,45,0.25)';
            for (let i = 0; i < 2; i++) {
              const t = 0.2 + this.hash2D(seed + i, x, 15006) * 0.6;
              const p0 = this.lerpPoint(a, b, t);
              const p1 = this.lerpPoint(p0, corners.center, 0.26 + i * 0.09);
              ctx.beginPath();
              ctx.ellipse(p1.x, p1.y, 9 + this.hash2D(i, seed, 15007) * 12, 2.5 + this.hash2D(i, seed, 15008) * 4, (this.hash2D(x, y + i, 15009) - 0.5) * 0.9, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();
      },

      drawLegacyShoreDepthEdge(corners, edgeName, variant = {}) {
        const { ctx } = window.DreamRealms.runtime || {};
        const edgeMap = {
          n: ['north', 'east'],
          e: ['east', 'south'],
          s: ['west', 'south'],
          w: ['north', 'west']
        };
        const pair = edgeMap[edgeName];
        if (!pair) return;
        const a = corners[pair[0]];
        const b = corners[pair[1]];
        const drop = 9;
        const jitter = (variant.intensity || 0.5) * 2;

        ctx.save();

        // Short vertical side face only on shoreline/water-contact edges.
        const g = ctx.createLinearGradient((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + drop);
        g.addColorStop(0, 'rgba(92,78,51,0.72)');
        g.addColorStop(0.58, 'rgba(61,49,32,0.78)');
        g.addColorStop(1, 'rgba(24,18,12,0.64)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.86;
        this.fillPoly([
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
          { x: b.x, y: b.y + drop + jitter },
          { x: a.x, y: a.y + drop + jitter }
        ]);

        // Restrained curved lip for the non-cached fallback renderer.
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = 'rgba(190,176,136,0.44)';
        ctx.lineWidth = 1.35;
        ctx.lineCap = 'round';
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5 - 2 - jitter;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 1);
        ctx.quadraticCurveTo(midX, midY, b.x, b.y - 1);
        ctx.stroke();

        // Underside water-contact shadow.
        ctx.globalAlpha = 0.26;
        ctx.strokeStyle = 'rgba(0,0,0,0.42)';
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + drop + 1);
        ctx.quadraticCurveTo(midX, midY + drop + 3, b.x, b.y + drop + 1);
        ctx.stroke();

        // Sparse chips on the shoreline lip.
        if ((variant.seed || 0) % 3 !== 1) {
          ctx.globalAlpha = 0.32;
          ctx.fillStyle = 'rgba(30,22,14,0.70)';
          for (let i = 0; i < 2; i++) {
            const t = this.hash2D((variant.seed || 7) + i, i, 12091);
            const p = this.lerpPoint(a, b, t);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 3 + i * 2, 2.2 + this.hash2D(i, variant.seed || 3, 12092) * 2, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      },

      waterDepthForTile(x, y, tile) {
        const DR = window.DreamRealms;
        const noise = DR.utils?.seededNoise?.(x, y, 12031) ?? 0.5;
        return Math.max(5, Math.min(12, Math.floor(Number(tile?.waterDepth) || (5 + noise * 8))));
      },

      drawDeepWaterShaft(x, y, tile, corners, neighbor, def) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { colorShade } = DR.utils || {};
        const { ctx } = DR.runtime || {};
        const depth = this.waterDepthForTile(x, y, tile);
        const bottomElev = Number(tile.elev || 0) - depth;
        const waterNeighbor = key => neighbor[key]?.type === TILE.WATER;
        const faces = [
          { key: 'n', a: corners.north, b: corners.east, ax: x - 0.5, ay: y - 0.5, bx: x + 0.5, by: y - 0.5, shade: -44 },
          { key: 'e', a: corners.east, b: corners.south, ax: x + 0.5, ay: y - 0.5, bx: x + 0.5, by: y + 0.5, shade: -34 },
          { key: 's', a: corners.west, b: corners.south, ax: x - 0.5, ay: y + 0.5, bx: x + 0.5, by: y + 0.5, shade: -48 },
          { key: 'w', a: corners.north, b: corners.west, ax: x - 0.5, ay: y - 0.5, bx: x - 0.5, by: y + 0.5, shade: -55 }
        ];

        ctx.save();
        for (const face of faces) {
          if (waterNeighbor(face.key)) continue;
          const ba = this.worldToScreen(face.ax, face.ay, bottomElev);
          const bb = this.worldToScreen(face.bx, face.by, bottomElev);
          const gradient = ctx.createLinearGradient(face.a.x, face.a.y, ba.x, ba.y);
          gradient.addColorStop(0, 'rgba(22, 80, 94, 0.86)');
          gradient.addColorStop(0.55, 'rgba(8, 37, 49, 0.94)');
          gradient.addColorStop(1, 'rgba(1, 10, 18, 0.98)');
          ctx.fillStyle = gradient;
          this.fillPoly([face.a, face.b, bb, ba]);
          ctx.globalAlpha = 0.32;
          ctx.strokeStyle = colorShade(def.side, face.shade);
          ctx.lineWidth = 1.2;
          for (let i = 1; i < Math.min(7, depth); i++) {
            const t = i / depth;
            const p1 = this.lerpPoint(face.a, ba, t);
            const p2 = this.lerpPoint(face.b, bb, t);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Dark bottom glimpse on isolated/small pools.
        const connected = ['n', 'e', 's', 'w'].filter(waterNeighbor).length;
        if (connected <= 1) {
          const bn = this.worldToScreen(x - 0.42, y - 0.42, bottomElev);
          const be = this.worldToScreen(x + 0.42, y - 0.42, bottomElev);
          const bs = this.worldToScreen(x + 0.42, y + 0.42, bottomElev);
          const bw = this.worldToScreen(x - 0.42, y + 0.42, bottomElev);
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = '#010812';
          this.fillPoly([bn, be, bs, bw]);
        }
        ctx.restore();
      },

      drawWallCourses(a, b, aBottom, bBottom, def, isCaveWall) {
        const DR = window.DreamRealms;
        const { colorShade } = DR.utils || {};
        const { ctx } = DR.runtime || {};
        const courses = isCaveWall ? 5 : 2;
        ctx.save();
        ctx.globalAlpha = isCaveWall ? 0.34 : 0.28;
        ctx.strokeStyle = colorShade(def.side, isCaveWall ? -18 : -34);
        ctx.lineWidth = isCaveWall ? 1.15 : 1;
        for (let i = 1; i < courses; i++) {
          const t = i / courses;
          const p1 = this.lerpPoint(a, aBottom, t);
          const p2 = this.lerpPoint(b, bBottom, t);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          if (isCaveWall) {
            const mid = this.lerpPoint(p1, p2, 0.46 + (i % 2) * 0.08);
            ctx.beginPath();
            ctx.moveTo(mid.x - 4, mid.y - 3);
            ctx.lineTo(mid.x + 4, mid.y + 5);
            ctx.stroke();
          }
        }
        ctx.restore();
      },


      // V0.20.93: `faceShade` is now actually applied. Every face already carried a per-direction
      // shade (n -28, e -20, s -32, w -38) and tallFaces propagated it - but this function ignored it
      // and drew all four sides with one identical gradient. So two perpendicular walls meeting at a
      // corner were exactly the same colour, the corner between them was invisible, and a stepped
      // cliff read as folded paper rather than solid stone. That is the reported "corners don't render
      // correctly at every angle": nothing was missing, the corner simply had no contrast to show it.
      //
      // The shade is applied RELATIVE to the set's midpoint rather than absolutely, so faces differ
      // from each other without darkening every cliff in the game by 30 points. The spread is widened
      // x1.6 so the distinction survives the vertical gradient on top of it.
      drawLayeredWallFace(a, b, aBottom, bBottom, def, isCaveWall, variant = {}, faceKey = 's', faceShade = null) {
        const { ctx } = window.DreamRealms.runtime || {};
        const { colorShade } = window.DreamRealms.utils || {};
        const top = def.side || '#604a32';
        const MID = isCaveWall ? -11.5 : -29.5;          // midpoint of each set's shade values
        const dir = Number.isFinite(Number(faceShade))
          ? Math.max(-26, Math.min(26, (Number(faceShade) - MID) * 1.6))
          : 0;

        // V0.20.95: darkening is scaled by the MATERIAL'S HEADROOM. Grass, underbrush and forest floor
        // have very dark side colours (luma 33-40), so the pre-existing -42 bottom stop already put
        // them at luma 2-5 - and V0.20.93's directional offset pushed all four to EXACTLY rgb(0,0,0)
        // on their west faces. That is the solid black shown on grass cliffs: not a hole in the
        // terrain, a wall face crushed to the clear colour.
        //
        // Scaling by luma/70 leaves stone, ruin, camp and dirt untouched (they are already at or above
        // that) while lifting the dark materials clear of black. Fixes my regression and the
        // pre-existing near-black bottom in the same stroke.
        const parseLuma = c => {
          const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(c || ''));
          if (!m) return 70;
          return (parseInt(m[1], 16) + parseInt(m[2], 16) + parseInt(m[3], 16)) / 3;
        };
        const headroom = Math.max(0.42, Math.min(1, parseLuma(top) / 70));
        const S = amt => colorShade(top, amt < 0 ? amt * headroom : amt);

        const gradient = ctx.createLinearGradient((a.x + b.x) / 2, (a.y + b.y) / 2, (aBottom.x + bBottom.x) / 2, (aBottom.y + bBottom.y) / 2);
        gradient.addColorStop(0, isCaveWall ? S(5 + dir) : S(-2 + dir));
        gradient.addColorStop(0.52, isCaveWall ? S(-18 + dir) : S(-20 + dir));
        gradient.addColorStop(1, isCaveWall ? S(-48 + dir) : S(-42 + dir));
        ctx.save();
        ctx.fillStyle = gradient;
        this.fillPoly([a, b, bBottom, aBottom]);

        // Contact darkening at bottom of wall face.
        ctx.globalAlpha = isCaveWall ? 0.34 : 0.25;
        ctx.strokeStyle = 'rgba(0,0,0,0.56)';
        ctx.lineWidth = isCaveWall ? 4 : 3;
        ctx.beginPath();
        ctx.moveTo(aBottom.x, aBottom.y);
        ctx.lineTo(bBottom.x, bBottom.y);
        ctx.stroke();

        // Edge ambient occlusion where top meets side.
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + 3);
        ctx.lineTo(b.x, b.y + 3);
        ctx.stroke();
        ctx.restore();
      },

      drawWallFaceDetails(a, b, aBottom, bBottom, def, isCaveWall, variant = {}, tx = 0, ty = 0, faceKey = 's') {
        const { ctx } = window.DreamRealms.runtime || {};
        const r = variant.r || this.hash2D(tx, ty, 4101);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Vertical seams and stone-block rows.
        const seams = isCaveWall ? 3 : 2;
        ctx.globalAlpha = isCaveWall ? 0.30 : 0.22;
        ctx.strokeStyle = isCaveWall ? 'rgba(18,20,15,0.58)' : 'rgba(32,24,18,0.44)';
        ctx.lineWidth = 1.2;
        for (let i = 1; i <= seams; i++) {
          const t = (i / (seams + 1)) + (this.hash2D(tx + i, ty, 4102) - 0.5) * 0.06;
          const pTop = this.lerpPoint(a, b, t);
          const pBot = this.lerpPoint(aBottom, bBottom, t + (this.hash2D(tx, ty + i, 4103) - 0.5) * 0.08);
          ctx.beginPath();
          ctx.moveTo(pTop.x, pTop.y + 4);
          ctx.lineTo(pBot.x, pBot.y - 3);
          ctx.stroke();
        }

        // Cracks.
        if (variant.name === 'cracked' || isCaveWall || r < 0.42) {
          ctx.globalAlpha = isCaveWall ? 0.36 : 0.25;
          ctx.strokeStyle = 'rgba(14,12,9,0.72)';
          ctx.lineWidth = 1.25;
          const midTop = this.lerpPoint(a, b, 0.22 + this.hash2D(tx, ty, 4110) * 0.56);
          const midBot = this.lerpPoint(aBottom, bBottom, 0.25 + this.hash2D(ty, tx, 4111) * 0.46);
          const m1 = this.lerpPoint(midTop, midBot, 0.26);
          const m2 = this.lerpPoint(midTop, midBot, 0.52);
          const m3 = this.lerpPoint(midTop, midBot, 0.72);
          ctx.beginPath();
          ctx.moveTo(m1.x, m1.y);
          ctx.lineTo(m2.x + (this.hash2D(tx, ty, 4112) - 0.5) * 12, m2.y + 4);
          ctx.lineTo(m3.x + (this.hash2D(ty, tx, 4113) - 0.5) * 14, m3.y);
          ctx.stroke();
        }

        // Moss/root/water-stain streaks.
        if (variant.name === 'mossy' || isCaveWall || r > 0.64) {
          const mossColor = variant.name === 'mossy' ? 'rgba(72,112,58,0.38)' : 'rgba(66,92,53,0.24)';
          ctx.strokeStyle = mossColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = isCaveWall ? 0.58 : 0.34;
          for (let i = 0; i < 2; i++) {
            const t = 0.18 + this.hash2D(tx + i, ty, 4120) * 0.66;
            const pTop = this.lerpPoint(a, b, t);
            const pEnd = this.lerpPoint(aBottom, bBottom, t + (this.hash2D(ty, tx + i, 4121) - 0.5) * 0.10);
            ctx.beginPath();
            ctx.moveTo(pTop.x, pTop.y + 3);
            ctx.quadraticCurveTo((pTop.x + pEnd.x) / 2 + (this.hash2D(tx, ty + i, 4122) - 0.5) * 12, (pTop.y + pEnd.y) / 2, pEnd.x, pEnd.y - 4);
            ctx.stroke();
          }
        }

        // Broken stones at wall base.
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = 'rgba(26,20,14,0.65)';
        const rubble = 1 + Math.floor(this.hash2D(tx, ty, 4130) * 3);
        for (let i = 0; i < rubble; i++) {
          const t = this.hash2D(tx + i, ty, 4131);
          const p = this.lerpPoint(aBottom, bBottom, t);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 2, 2 + this.hash2D(i, tx, 4132) * 3, 1.2 + this.hash2D(i, ty, 4133) * 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      },

      drawHalfBlockCornerJoins(x, y, tile, tallFaces, corners, def, isCaveWall = false, variant = {}, cornerJoins = null) {
        const DR = window.DreamRealms;
        const { ctx } = DR.runtime || {};
        const { colorShade } = DR.utils || {};
        if (!ctx || !Array.isArray(tallFaces) || !tallFaces.length) return;
        const shade = typeof colorShade === 'function' ? colorShade : (color => color);
        const byKey = new Map(tallFaces.map(face => [face.key, face]));
        const fallbackJoins = [
          { key: 'ne', name: 'northEast', sideKeys: ['n', 'e'], corner: corners.east,  wx: x + 0.5, wy: y - 0.5, seed: 54501 },
          { key: 'se', name: 'southEast', sideKeys: ['e', 's'], corner: corners.south, wx: x + 0.5, wy: y + 0.5, seed: 54502 },
          { key: 'sw', name: 'southWest', sideKeys: ['s', 'w'], corner: corners.west,  wx: x - 0.5, wy: y + 0.5, seed: 54503 },
          { key: 'nw', name: 'northWest', sideKeys: ['w', 'n'], corner: corners.north, wx: x - 0.5, wy: y - 0.5, seed: 54504 }
        ].map(join => {
          const sideFaces = join.sideKeys.map(key => byKey.get(key)).filter(Boolean);
          if (sideFaces.length < 2) return null;
          return { ...join, sideFaces, lowerElev: Math.min(...sideFaces.map(face => face.lowerElev)), twoSidedJoin: true };
        }).filter(Boolean);
        const joins = Array.isArray(cornerJoins) && cornerJoins.length ? cornerJoins : fallbackJoins;
        if (!joins.length) return;

        const side = def?.side || this.terrainMaterialForTile(tile).dark || '#3b2d21';
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const join of joins) {
          if (!join?.corner) continue;
          const lowerElev = Number.isFinite(join.lowerElev) ? join.lowerElev : Math.min(...(join.sideFaces || []).map(face => face.lowerElev));
          if (!Number.isFinite(lowerElev)) continue;
          const bottom = this.worldToScreen(join.wx, join.wy, lowerElev);
          const jitter = (this.hash2D(x, y, join.seed || 54500) - 0.5) * (isCaveWall ? 1.1 : 0.9);
          const top = { x: join.corner.x + jitter * 0.16, y: join.corner.y + 1.25 };
          const bot = { x: bottom.x + jitter * 0.42, y: bottom.y - 2.25 };
          const dx = bot.x - top.x;
          const dy = bot.y - top.y;
          const len = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / len;
          const ny = dx / len;
          const full = Boolean(join.twoSidedJoin || (join.sideFaces || []).length > 1);
          const topWidth = isCaveWall ? (full ? 4.0 : 2.9) : (full ? 3.25 : 2.2);
          const bottomWidth = isCaveWall ? (full ? 5.2 : 3.6) : (full ? 4.1 : 2.8);
          const gradient = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
          gradient.addColorStop(0, shade(side, isCaveWall ? 4 : -4));
          gradient.addColorStop(0.58, shade(side, isCaveWall ? -20 : -30));
          gradient.addColorStop(1, shade(side, isCaveWall ? -48 : -48));

          // Cave walls close their corners with a solid vertical column. Overworld half-blocks now
          // use the same architectural idea, but with softer material-toned widths so grass/dirt/path
          // corners do not turn into hard stone outlines. One-sided diagonal joins only get the
          // lighter column, which repairs zig-zags and bridge endpoints without doubling seams.
          ctx.globalAlpha = isCaveWall ? (full ? 0.84 : 0.58) : (full ? 0.68 : 0.46);
          ctx.fillStyle = gradient;
          this.fillPoly([
            { x: top.x + nx * topWidth, y: top.y + ny * topWidth },
            { x: top.x - nx * topWidth, y: top.y - ny * topWidth },
            { x: bot.x - nx * bottomWidth, y: bot.y - ny * bottomWidth },
            { x: bot.x + nx * bottomWidth, y: bot.y + ny * bottomWidth }
          ]);

          ctx.globalAlpha = isCaveWall ? 0.34 : 0.24;
          ctx.strokeStyle = shade(side, isCaveWall ? -34 : -42);
          ctx.lineWidth = isCaveWall ? (full ? 2.1 : 1.3) : (full ? 1.55 : 0.95);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y + 1.2);
          ctx.lineTo(bot.x, bot.y - 1.2);
          ctx.stroke();

          ctx.globalAlpha = isCaveWall ? 0.24 : 0.18;
          ctx.strokeStyle = shade(side, isCaveWall ? 12 : -5);
          ctx.lineWidth = isCaveWall ? 1.05 : 0.8;
          ctx.beginPath();
          ctx.moveTo(top.x - nx * topWidth * 0.46, top.y + 0.6);
          ctx.lineTo(bot.x - nx * bottomWidth * 0.36, bot.y - 2.4);
          ctx.stroke();
        }
        ctx.restore();
      },

      drawHalfBlockCornerOcclusionCaps(x, y, tile, tallFaces, corners, variant = {}, cornerJoins = null) {
        const DR = window.DreamRealms;
        const { ctx } = DR.runtime || {};
        if (!ctx || !Array.isArray(tallFaces) || !tallFaces.length) return;
        const material = this.terrainMaterialForTile(tile);
        const byKey = new Map(tallFaces.map(face => [face.key, face]));
        const fallbackJoins = [
          { key: 'ne', sideKeys: ['n', 'e'], corner: corners.east,  seed: 54601 },
          { key: 'se', sideKeys: ['e', 's'], corner: corners.south, seed: 54602 },
          { key: 'sw', sideKeys: ['s', 'w'], corner: corners.west,  seed: 54603 },
          { key: 'nw', sideKeys: ['w', 'n'], corner: corners.north, seed: 54604 }
        ].filter(join => join.sideKeys.every(key => byKey.get(key)));
        const joins = Array.isArray(cornerJoins) && cornerJoins.length ? cornerJoins : fallbackJoins;
        if (!joins.length) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const join of joins) {
          if (!join?.corner) continue;
          const full = Boolean(join.twoSidedJoin || (join.sideFaces || []).length > 1);
          const r = (full ? 2.15 : 1.55) + this.hash2D(x, y, join.seed || 54600) * (full ? 1.0 : 0.58);
          ctx.globalAlpha = full ? 0.76 : 0.58;
          ctx.fillStyle = material.base;
          ctx.beginPath();
          ctx.ellipse(join.corner.x, join.corner.y, r * 1.42, r * 0.84, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = full ? 0.21 : 0.13;
          ctx.fillStyle = material.light;
          ctx.beginPath();
          ctx.ellipse(join.corner.x, join.corner.y - 1.2, r * 0.95, r * 0.40, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawGroundSurfaceOcclusionLip(x, y, tile, a, b, variant = {}, faceKey = 's') {
        const DR = window.DreamRealms;
        const { ctx } = DR.runtime || {};
        if (!ctx) return;
        const { colorShade } = DR.utils || {};
        const material = this.terrainMaterialForTile(tile);
        const shade = typeof colorShade === 'function' ? colorShade : (color => color);
        const jitter = (this.hash2D(x, y, 53401 + faceKey.charCodeAt(0)) - 0.5) * 0.75;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Material-colored cap: covers the upper seam of the lower depth face without
        // reintroducing the thick rectangular outline removed in the organic-boundary pass.
        ctx.globalAlpha = 0.48;
        ctx.strokeStyle = shade(material.dark, -4);
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + 1.8 + jitter);
        ctx.lineTo(b.x, b.y + 1.8 + jitter);
        ctx.stroke();

        ctx.globalAlpha = 0.78;
        ctx.strokeStyle = material.base;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + jitter);
        ctx.lineTo(b.x, b.y + jitter);
        ctx.stroke();

        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = material.light;
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 1.25 + jitter * 0.35);
        ctx.lineTo(b.x, b.y - 1.25 + jitter * 0.35);
        ctx.stroke();

        if ((variant.name === 'chipped' || variant.name === 'cracked') && this.hash2D(x, y, 53421) > 0.35) {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = shade(material.dark, -10);
          const chips = 1 + Math.floor(this.hash2D(x, y, 53422) * 3);
          for (let i = 0; i < chips; i++) {
            const p = this.lerpPoint(a, b, this.hash2D(x + i, y, 53423));
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 2 + this.hash2D(i, x, 53424) * 2, 1.8, 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      },

      drawLedgeLip(a, b, isCaveWall = false, variant = {}, faceKey = 's') {
        const { ctx } = window.DreamRealms.runtime || {};
        ctx.save();
        ctx.lineCap = 'round';
        ctx.globalAlpha = isCaveWall ? 0.32 : 0.28;
        ctx.strokeStyle = isCaveWall ? 'rgba(185,202,139,0.30)' : 'rgba(220,205,160,0.34)';
        ctx.lineWidth = isCaveWall ? 2.4 : 2.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = 'rgba(0,0,0,0.36)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + 3);
        ctx.lineTo(b.x, b.y + 3);
        ctx.stroke();
        ctx.restore();
      },

      drawBrokenEdgeDetail(a, b, variant = {}, edgeDir = 's') {
        const { ctx } = window.DreamRealms.runtime || {};
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(40,30,20,0.58)';
        const count = 2 + Math.floor((variant.intensity || 0.5) * 4);
        for (let i = 0; i < count; i++) {
          const t = this.hash2D(variant.seed + i, i, 4210);
          const p = this.lerpPoint(a, b, t);
          const ox = (this.hash2D(variant.seed, i, 4211) - 0.5) * 12;
          const oy = 2 + this.hash2D(i, variant.seed, 4212) * 9;
          ctx.beginPath();
          ctx.arc(p.x + ox, p.y + oy, 1.6 + this.hash2D(i, variant.seed, 4213) * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      drawCachedHighPolyWaterLayerDetails(c, x, y, worldMinX, worldMinY, scale, material, tile = null) {
        const localX = (x - worldMinX) * scale;
        const localY = (y - worldMinY) * scale;
        const seedBase = 83000 + Math.floor(this.hash2D(x, y, 83001) * 100000);
        const depth = Math.max(5, Math.min(12, Number(tile?.waterDepth) || 5));
        const depthRatio = Math.max(0, Math.min(1, (depth - 5) / 7));
        const caveWater = this.currentZone === 'cave' || this.currentZone === 'dungeon';
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.globalCompositeOperation = 'source-over';

        // Subtle connected-plane undulation: broad swells, sheltered glass patches, and darker depth pockets.
        for (let i = 0; i < 3; i++) {
          const cx = localX + (0.18 + this.hash2D(x * 11 + i, y * 13, seedBase + 1) * 0.64) * scale;
          const cy = localY + (0.18 + this.hash2D(y * 11 - i, x * 13, seedBase + 2) * 0.64) * scale;
          const wide = 0.20 + this.hash2D(i, x, seedBase + 3) * 0.32;
          const tall = 0.05 + this.hash2D(i, y, seedBase + 4) * 0.12;
          c.globalAlpha = 0.08 + depthRatio * 0.07;
          c.fillStyle = i % 2 ? 'rgba(3,24,34,0.52)' : (caveWater ? 'rgba(92,136,146,0.24)' : 'rgba(105,181,184,0.24)');
          c.beginPath();
          c.ellipse(cx, cy, wide * scale, tall * scale, (this.hash2D(x, y + i, seedBase + 5) - 0.5) * 1.4, 0, Math.PI * 2);
          c.fill();
        }

        // Fine wind-ripple bands aligned across the water tile. These are baked into the water surface cache.
        const rippleCount = 2 + Math.floor(this.hash2D(x, y, seedBase + 10) * 4);
        for (let r = 0; r < rippleCount; r++) {
          const sx = localX + (0.04 + this.hash2D(x * 17 + r, y * 19, seedBase + 11) * 0.82) * scale;
          const sy = localY + (0.16 + this.hash2D(y * 17 - r, x * 19, seedBase + 12) * 0.58) * scale;
          const len = (0.20 + this.hash2D(r, x, seedBase + 13) * 0.38) * scale;
          const bend = (this.hash2D(r, y, seedBase + 14) - 0.5) * 0.12 * scale;
          c.globalAlpha = 0.15 + this.hash2D(r, x + y, seedBase + 15) * 0.20;
          c.strokeStyle = caveWater ? 'rgba(132,184,192,0.48)' : 'rgba(192,241,236,0.48)';
          c.lineWidth = Math.max(0.55, scale * (0.010 + this.hash2D(r, y, seedBase + 16) * 0.014));
          c.beginPath();
          c.moveTo(sx, sy);
          c.bezierCurveTo(sx + len * 0.30, sy - scale * 0.055 + bend, sx + len * 0.70, sy + scale * 0.045 - bend, sx + len, sy);
          c.stroke();
          c.globalAlpha *= 0.45;
          c.strokeStyle = 'rgba(4,25,34,0.42)';
          c.beginPath();
          c.moveTo(sx + scale * 0.05, sy + scale * 0.035);
          c.bezierCurveTo(sx + len * 0.35, sy + scale * 0.03, sx + len * 0.62, sy + scale * 0.05, sx + len * 0.88, sy + scale * 0.025);
          c.stroke();
        }

        // Local disturbances: fish/insect rings, small eddies, and current convergence lines.
        if (this.hash2D(x, y, seedBase + 20) > 0.52) {
          const rx = localX + (0.20 + this.hash2D(x, y, seedBase + 21) * 0.60) * scale;
          const ry = localY + (0.23 + this.hash2D(y, x, seedBase + 22) * 0.54) * scale;
          const rings = 1 + Math.floor(this.hash2D(x, y, seedBase + 23) * 3);
          for (let i = 0; i < rings; i++) {
            c.globalAlpha = 0.12 - i * 0.025;
            c.strokeStyle = caveWater ? 'rgba(119,171,178,0.50)' : 'rgba(198,238,232,0.54)';
            c.lineWidth = Math.max(0.45, scale * 0.009);
            c.beginPath();
            c.ellipse(rx, ry, (0.055 + i * 0.055) * scale, (0.025 + i * 0.028) * scale, this.hash2D(x, y, seedBase + 24) * Math.PI, 0, Math.PI * 2);
            c.stroke();
          }
        }

        // Submerged bottom cues: vegetation/darker depth, sandbars, and shallow bottom visibility.
        if (this.hash2D(x, y, seedBase + 30) > 0.38) {
          const bx = localX + (0.18 + this.hash2D(x, y, seedBase + 31) * 0.64) * scale;
          const by = localY + (0.20 + this.hash2D(y, x, seedBase + 32) * 0.56) * scale;
          c.globalAlpha = depthRatio > 0.55 ? 0.11 : 0.18;
          c.fillStyle = depthRatio > 0.55 ? 'rgba(3,18,29,0.64)' : 'rgba(180,165,105,0.30)';
          c.beginPath();
          c.ellipse(bx, by, (0.12 + this.hash2D(x, y, seedBase + 33) * 0.17) * scale, (0.035 + this.hash2D(y, x, seedBase + 34) * 0.065) * scale, this.hash2D(x, y, seedBase + 35) * Math.PI, 0, Math.PI * 2);
          c.fill();
        }

        // Shoreline and object contact treatment: meniscus, lapping wavelets, foam/debris high-water lines.
        const edges = [
          { key: 'n', dx: 0, dy: -1, horizontal: true, px: localX, py: localY, sign: -1 },
          { key: 'e', dx: 1, dy: 0, horizontal: false, px: localX + scale, py: localY, sign: 1 },
          { key: 's', dx: 0, dy: 1, horizontal: true, px: localX, py: localY + scale, sign: 1 },
          { key: 'w', dx: -1, dy: 0, horizontal: false, px: localX, py: localY, sign: -1 }
        ];
        for (const edge of edges) {
          const other = this.map?.[y + edge.dy]?.[x + edge.dx];
          if (this.isTerrainChunkWaterTile(other)) continue;
          c.globalAlpha = 0.28;
          c.strokeStyle = material.shore || (caveWater ? '#668486' : '#84aaa0');
          c.lineWidth = Math.max(1.0, scale * 0.035);
          c.beginPath();
          if (edge.horizontal) {
            const yy = edge.py - edge.sign * scale * 0.035;
            c.moveTo(localX + scale * 0.05, yy);
            c.bezierCurveTo(localX + scale * 0.30, yy + edge.sign * scale * 0.035, localX + scale * 0.66, yy - edge.sign * scale * 0.035, localX + scale * 0.95, yy);
          } else {
            const xx = edge.px - edge.sign * scale * 0.035;
            c.moveTo(xx, localY + scale * 0.05);
            c.bezierCurveTo(xx + edge.sign * scale * 0.035, localY + scale * 0.30, xx - edge.sign * scale * 0.035, localY + scale * 0.66, xx, localY + scale * 0.95);
          }
          c.stroke();
          if (this.hash2D(x + edge.dx, y + edge.dy, seedBase + 40) > 0.46) {
            c.globalAlpha = 0.16;
            c.strokeStyle = caveWater ? 'rgba(130,160,150,0.38)' : 'rgba(221,225,174,0.44)';
            c.lineWidth = Math.max(0.55, scale * 0.012);
            if (edge.horizontal) {
              const yy = edge.py - edge.sign * scale * 0.11;
              c.beginPath();
              c.moveTo(localX + scale * 0.16, yy);
              c.lineTo(localX + scale * 0.34, yy + edge.sign * scale * 0.015);
              c.moveTo(localX + scale * 0.56, yy - edge.sign * scale * 0.008);
              c.lineTo(localX + scale * 0.76, yy + edge.sign * scale * 0.012);
              c.stroke();
            } else {
              const xx = edge.px - edge.sign * scale * 0.11;
              c.beginPath();
              c.moveTo(xx, localY + scale * 0.16);
              c.lineTo(xx + edge.sign * scale * 0.015, localY + scale * 0.34);
              c.moveTo(xx - edge.sign * scale * 0.008, localY + scale * 0.56);
              c.lineTo(xx + edge.sign * scale * 0.012, localY + scale * 0.76);
              c.stroke();
            }
          }
        }

        // Floating elements: leaves, twigs, foam/pollen slicks, lily pads, and surface-life dimples.
        const floatRoll = this.hash2D(x, y, seedBase + 50);
        if (floatRoll > 0.54) {
          const fx = localX + (0.15 + this.hash2D(x, y, seedBase + 51) * 0.70) * scale;
          const fy = localY + (0.20 + this.hash2D(y, x, seedBase + 52) * 0.56) * scale;
          const kind = this.hash2D(y, x, seedBase + 53);
          if (kind < 0.34) {
            c.globalAlpha = 0.22;
            c.fillStyle = 'rgba(128,94,39,0.62)';
            c.beginPath();
            c.ellipse(fx, fy, scale * 0.045, scale * 0.020, this.hash2D(x, y, seedBase + 54) * Math.PI, 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = 0.13;
            c.strokeStyle = 'rgba(57,42,23,0.72)';
            c.lineWidth = Math.max(0.4, scale * 0.007);
            c.beginPath();
            c.moveTo(fx - scale * 0.035, fy);
            c.lineTo(fx + scale * 0.035, fy);
            c.stroke();
          } else if (kind < 0.62) {
            c.globalAlpha = 0.22;
            c.strokeStyle = 'rgba(92,61,28,0.68)';
            c.lineWidth = Math.max(0.6, scale * 0.014);
            c.beginPath();
            c.moveTo(fx - scale * 0.06, fy + scale * 0.01);
            c.lineTo(fx + scale * 0.07, fy - scale * 0.015);
            c.stroke();
          } else if (!caveWater && kind < 0.82) {
            c.globalAlpha = 0.18;
            c.fillStyle = 'rgba(73,115,62,0.60)';
            c.beginPath();
            c.ellipse(fx, fy, scale * 0.06, scale * 0.032, this.hash2D(x, y, seedBase + 55) * Math.PI, 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = 0.18;
            c.strokeStyle = 'rgba(155,205,120,0.45)';
            c.lineWidth = Math.max(0.45, scale * 0.008);
            c.beginPath();
            c.moveTo(fx, fy);
            c.lineTo(fx + scale * 0.050, fy - scale * 0.004);
            c.stroke();
          } else {
            c.globalAlpha = 0.13;
            c.fillStyle = caveWater ? 'rgba(150,174,170,0.40)' : 'rgba(230,225,180,0.38)';
            c.beginPath();
            c.ellipse(fx, fy, scale * 0.09, scale * 0.020, this.hash2D(x, y, seedBase + 56) * Math.PI, 0, Math.PI * 2);
            c.fill();
          }
        }

        // Tiny sparkle/caustic glints where the cached surface catches light.
        if (this.hash2D(x, y, seedBase + 60) > 0.62) {
          const gx = localX + (0.20 + this.hash2D(x, y, seedBase + 61) * 0.60) * scale;
          const gy = localY + (0.22 + this.hash2D(y, x, seedBase + 62) * 0.50) * scale;
          c.globalAlpha = caveWater ? 0.16 : 0.24;
          c.strokeStyle = caveWater ? 'rgba(178,225,230,0.45)' : 'rgba(236,255,245,0.62)';
          c.lineWidth = Math.max(0.45, scale * 0.010);
          c.beginPath();
          c.moveTo(gx - scale * 0.040, gy);
          c.lineTo(gx + scale * 0.040, gy);
          c.moveTo(gx, gy - scale * 0.016);
          c.lineTo(gx, gy + scale * 0.016);
          c.stroke();
        }
        c.restore();
      },

      drawCachedHighPolyCaveFloorDetails(c, x, y, worldMinX, worldMinY, scale, material, detail = 0.5) {
        const localX = (x - worldMinX) * scale;
        const localY = (y - worldMinY) * scale;
        const seedBase = 93000 + Math.floor(this.hash2D(x, y, 93001) * 100000);
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.globalCompositeOperation = 'source-over';

        // Broad bedrock undulation and old basin/channel fields. These remain inside the tile footprint.
        for (let i = 0; i < 3; i++) {
          const cx = localX + (0.15 + this.hash2D(x * 13 + i, y * 17, seedBase + 1) * 0.70) * scale;
          const cy = localY + (0.18 + this.hash2D(y * 13 - i, x * 17, seedBase + 2) * 0.58) * scale;
          const wet = this.hash2D(x + i, y - i, seedBase + 3) > 0.64;
          c.globalAlpha = wet ? 0.105 : 0.085;
          c.fillStyle = wet ? 'rgba(22,28,27,0.72)' : 'rgba(122,112,86,0.42)';
          c.beginPath();
          c.ellipse(cx, cy, (0.20 + this.hash2D(i, x, seedBase + 4) * 0.28) * scale, (0.055 + this.hash2D(i, y, seedBase + 5) * 0.11) * scale, (this.hash2D(x, y + i, seedBase + 6) - 0.5) * 1.4, 0, Math.PI * 2);
          c.fill();
        }

        // Geological fracture systems, bedding lines, healed mineralized cracks.
        const fractures = 3 + Math.floor(this.hash2D(x, y, seedBase + 10) * 5);
        for (let i = 0; i < fractures; i++) {
          const sx = localX + (0.08 + this.hash2D(x * 19 + i, y * 23, seedBase + 11) * 0.82) * scale;
          const sy = localY + (0.12 + this.hash2D(y * 19 - i, x * 23, seedBase + 12) * 0.62) * scale;
          const len = (0.12 + this.hash2D(i, x, seedBase + 13) * 0.32) * scale;
          const angle = (this.hash2D(x - i, y + i, seedBase + 14) - 0.5) * Math.PI * 1.35;
          const mineral = this.hash2D(i, y, seedBase + 15) > 0.70;
          c.globalAlpha = mineral ? 0.24 : 0.26;
          c.strokeStyle = mineral ? 'rgba(190,178,142,0.52)' : 'rgba(24,22,20,0.62)';
          c.lineWidth = Math.max(0.5, scale * (mineral ? 0.011 : 0.015));
          c.beginPath();
          c.moveTo(sx, sy);
          c.quadraticCurveTo(sx + Math.cos(angle + 0.65) * len * 0.42, sy + Math.sin(angle + 0.65) * len * 0.34, sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.58);
          if (!mineral && this.hash2D(i, x + y, seedBase + 16) > 0.50) {
            c.moveTo(sx + Math.cos(angle) * len * 0.36, sy + Math.sin(angle) * len * 0.22);
            c.lineTo(sx + Math.cos(angle + 1.1) * len * 0.62, sy + Math.sin(angle + 1.1) * len * 0.45);
          }
          c.stroke();
        }

        // Flowstone sheets, rimstone micro-gours, and drip-polished patches.
        if (this.hash2D(x, y, seedBase + 30) > 0.28) {
          const fx = localX + (0.12 + this.hash2D(x, y, seedBase + 31) * 0.72) * scale;
          const fy = localY + (0.18 + this.hash2D(y, x, seedBase + 32) * 0.50) * scale;
          const rot = (this.hash2D(x, y, seedBase + 33) - 0.5) * 1.0;
          c.globalAlpha = 0.115;
          c.fillStyle = 'rgba(176,163,124,0.36)';
          c.beginPath();
          c.ellipse(fx, fy, scale * (0.13 + this.hash2D(x, y, seedBase + 34) * 0.18), scale * (0.035 + this.hash2D(y, x, seedBase + 35) * 0.055), rot, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 0.18;
          c.strokeStyle = 'rgba(211,198,150,0.38)';
          c.lineWidth = Math.max(0.45, scale * 0.007);
          for (let r = 0; r < 2; r++) {
            c.beginPath();
            c.ellipse(fx, fy + r * scale * 0.035, scale * (0.10 + r * 0.045), scale * (0.025 + r * 0.012), rot, Math.PI * 0.05, Math.PI * 1.10);
            c.stroke();
          }
        }

        // Loose stones, fallen spall, cave pearls, and seated contact shadows.
        const stones = 2 + Math.floor(this.hash2D(x, y, seedBase + 40) * 5);
        for (let i = 0; i < stones; i++) {
          const px = localX + (0.10 + this.hash2D(x * 31 + i, y * 37, seedBase + 41) * 0.80) * scale;
          const py = localY + (0.15 + this.hash2D(y * 31 - i, x * 37, seedBase + 42) * 0.60) * scale;
          const rx = (0.025 + this.hash2D(i, x, seedBase + 43) * 0.065) * scale;
          const ry = (0.013 + this.hash2D(i, y, seedBase + 44) * 0.040) * scale;
          c.globalAlpha = 0.22;
          c.fillStyle = 'rgba(18,16,14,0.58)';
          c.beginPath();
          c.ellipse(px + scale * 0.010, py + scale * 0.016, rx * 1.45, ry * 1.30, 0, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 0.40;
          c.fillStyle = this.hash2D(i, y, seedBase + 45) > 0.55 ? 'rgba(128,120,96,0.66)' : 'rgba(84,78,66,0.64)';
          c.beginPath();
          c.ellipse(px, py, rx, ry, this.hash2D(i, x, seedBase + 46) * Math.PI, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 0.20;
          c.strokeStyle = 'rgba(210,198,156,0.42)';
          c.lineWidth = Math.max(0.35, scale * 0.006);
          c.beginPath();
          c.moveTo(px - rx * 0.45, py - ry * 0.20);
          c.lineTo(px + rx * 0.42, py - ry * 0.38);
          c.stroke();
        }

        // Moisture/seepage zones, drip impact rings, sediment drifts, and dark microbial stains.
        if (this.hash2D(x, y, seedBase + 60) > 0.36) {
          const mx = localX + (0.14 + this.hash2D(x, y, seedBase + 61) * 0.70) * scale;
          const my = localY + (0.20 + this.hash2D(y, x, seedBase + 62) * 0.52) * scale;
          c.globalAlpha = 0.095;
          c.fillStyle = 'rgba(9,18,18,0.72)';
          c.beginPath();
          c.ellipse(mx, my, scale * (0.10 + this.hash2D(x, y, seedBase + 63) * 0.12), scale * (0.025 + this.hash2D(y, x, seedBase + 64) * 0.035), 0, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 0.18;
          c.strokeStyle = 'rgba(160,184,172,0.28)';
          c.lineWidth = Math.max(0.4, scale * 0.006);
          c.beginPath();
          c.ellipse(mx, my, scale * 0.060, scale * 0.021, this.hash2D(x, y, seedBase + 65) * Math.PI, 0, Math.PI * 2);
          c.stroke();
        }

        // Sparse cave-life and ancient-debris readables: guano pellets, pale fungi, bone chips.
        if (this.hash2D(x, y, seedBase + 80) > 0.52) {
          const bx = localX + (0.14 + this.hash2D(x, y, seedBase + 81) * 0.72) * scale;
          const by = localY + (0.18 + this.hash2D(y, x, seedBase + 82) * 0.58) * scale;
          const kind = this.hash2D(x, y, seedBase + 83);
          if (kind < 0.38) {
            c.globalAlpha = 0.20;
            c.fillStyle = 'rgba(35,30,25,0.64)';
            for (let g = 0; g < 3; g++) {
              c.beginPath();
              c.ellipse(bx + (g - 1) * scale * 0.020, by + (g % 2) * scale * 0.010, scale * 0.011, scale * 0.007, 0, 0, Math.PI * 2);
              c.fill();
            }
          } else if (kind < 0.70) {
            c.globalAlpha = 0.28;
            c.strokeStyle = 'rgba(222,224,202,0.42)';
            c.fillStyle = 'rgba(198,202,178,0.50)';
            c.lineWidth = Math.max(0.4, scale * 0.006);
            c.beginPath();
            c.moveTo(bx, by + scale * 0.018);
            c.lineTo(bx, by - scale * 0.030);
            c.stroke();
            c.beginPath();
            c.ellipse(bx, by - scale * 0.034, scale * 0.025, scale * 0.012, 0, 0, Math.PI * 2);
            c.fill();
          } else {
            c.globalAlpha = 0.24;
            c.strokeStyle = 'rgba(196,185,152,0.56)';
            c.lineWidth = Math.max(0.45, scale * 0.008);
            c.beginPath();
            c.moveTo(bx - scale * 0.035, by);
            c.lineTo(bx + scale * 0.030, by - scale * 0.012);
            c.stroke();
          }
        }
        c.restore();
      },

      drawCachedHighPolyDirtFloorDetails(c, x, y, worldMinX, worldMinY, scale, material, detail = 0.5) {
        const localX = (x - worldMinX) * scale;
        const localY = (y - worldMinY) * scale;
        const seedBase = Math.floor((detail || 0.5) * 100000) + 76000;
        const campLike = material?.base === '#987047';
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // Quad-plane undulation illusion: hummocks, compacted depressions, and rain drainage paths.
        for (let i = 0; i < 4; i++) {
          const cx = localX + (0.12 + this.hash2D(x * 11 + i, y * 13, seedBase + 1) * 0.76) * scale;
          const cy = localY + (0.18 + this.hash2D(y * 11 - i, x * 13, seedBase + 2) * 0.62) * scale;
          const damp = this.hash2D(x + i, y - i, seedBase + 3) > 0.56;
          c.globalAlpha = damp ? 0.105 : 0.135;
          c.fillStyle = damp ? 'rgba(55,39,27,0.58)' : 'rgba(157,111,65,0.44)';
          c.beginPath();
          c.ellipse(cx, cy, (0.12 + this.hash2D(i, x, seedBase + 4) * 0.24) * scale, (0.045 + this.hash2D(i, y, seedBase + 5) * 0.11) * scale, (this.hash2D(x, y + i, seedBase + 6) - 0.5) * 1.7, 0, Math.PI * 2);
          c.fill();
        }

        // Desiccation cracks, compacted path scuffs, and rain rills. All remain inside the existing tile footprint.
        const crackCount = 2 + Math.floor(this.hash2D(x, y, seedBase + 10) * 4);
        for (let i = 0; i < crackCount; i++) {
          const sx = localX + (0.15 + this.hash2D(x * 17 + i, y * 19, seedBase + 11) * 0.70) * scale;
          const sy = localY + (0.18 + this.hash2D(y * 17 - i, x * 19, seedBase + 12) * 0.58) * scale;
          const len = (0.12 + this.hash2D(i, x, seedBase + 13) * 0.23) * scale;
          const angle = (this.hash2D(x - i, y + i, seedBase + 14) - 0.5) * Math.PI * 1.2;
          c.globalAlpha = 0.13 + this.hash2D(i, y, seedBase + 15) * 0.12;
          c.strokeStyle = this.hash2D(i, x, seedBase + 16) > 0.72 ? 'rgba(37,24,17,0.56)' : 'rgba(86,58,34,0.50)';
          c.lineWidth = Math.max(0.65, scale * (0.018 + this.hash2D(i, x, seedBase + 17) * 0.018));
          c.beginPath();
          c.moveTo(sx, sy);
          c.quadraticCurveTo(sx + Math.cos(angle + 0.7) * len * 0.42, sy + Math.sin(angle + 0.7) * len * 0.32, sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.72);
          if (this.hash2D(i, x + y, seedBase + 18) > 0.58) {
            c.moveTo(sx + Math.cos(angle) * len * 0.38, sy + Math.sin(angle) * len * 0.24);
            c.lineTo(sx + Math.cos(angle + 1.1) * len * 0.68, sy + Math.sin(angle + 1.1) * len * 0.46);
          }
          c.stroke();
        }

        // Embedded pebbles and exposed stone inclusions with soil-interface shadows.
        const stones = 2 + Math.floor(this.hash2D(x, y, seedBase + 20) * 4);
        for (let i = 0; i < stones; i++) {
          const px = localX + (0.12 + this.hash2D(x * 23 + i, y * 29, seedBase + 21) * 0.76) * scale;
          const py = localY + (0.18 + this.hash2D(y * 23 - i, x * 29, seedBase + 22) * 0.60) * scale;
          const rx = (0.022 + this.hash2D(i, x, seedBase + 23) * 0.052) * scale;
          const ry = (0.015 + this.hash2D(i, y, seedBase + 24) * 0.035) * scale;
          c.globalAlpha = 0.16;
          c.fillStyle = 'rgba(43,31,22,0.50)';
          c.beginPath();
          c.ellipse(px + scale * 0.012, py + scale * 0.014, rx * 1.22, ry * 1.15, 0, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 0.30;
          c.fillStyle = this.hash2D(i, y, seedBase + 25) > 0.55 ? 'rgba(118,103,82,0.62)' : 'rgba(82,74,61,0.58)';
          c.beginPath();
          c.ellipse(px, py, rx, ry, this.hash2D(i, x, seedBase + 26) * Math.PI, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 0.16;
          c.strokeStyle = 'rgba(184,164,120,0.45)';
          c.lineWidth = Math.max(0.45, scale * 0.010);
          c.beginPath();
          c.moveTo(px - rx * 0.55, py - ry * 0.25);
          c.lineTo(px + rx * 0.48, py - ry * 0.42);
          c.stroke();
        }

        // Exposed roots, leaf litter, twigs, worm casts, and ant mounds at cached-terrain scale.
        const organic = 2 + Math.floor(this.hash2D(x, y, seedBase + 30) * 4);
        for (let i = 0; i < organic; i++) {
          const px = localX + (0.14 + this.hash2D(x * 31 + i, y * 37, seedBase + 31) * 0.72) * scale;
          const py = localY + (0.18 + this.hash2D(y * 31 - i, x * 37, seedBase + 32) * 0.60) * scale;
          const kind = this.hash2D(i, x - y, seedBase + 33);
          if (kind < 0.30) {
            c.globalAlpha = 0.20;
            c.strokeStyle = 'rgba(84,51,25,0.70)';
            c.lineWidth = Math.max(0.7, scale * 0.020);
            c.beginPath();
            c.moveTo(px - scale * 0.10, py + scale * 0.02);
            c.quadraticCurveTo(px - scale * 0.02, py - scale * 0.05, px + scale * 0.12, py - scale * 0.02);
            c.stroke();
            c.globalAlpha = 0.12;
            c.strokeStyle = 'rgba(47,32,20,0.65)';
            c.lineWidth = Math.max(0.45, scale * 0.010);
            c.beginPath();
            c.moveTo(px - scale * 0.02, py - scale * 0.02);
            c.lineTo(px + scale * 0.10, py - scale * 0.07);
            c.stroke();
          } else if (kind < 0.58) {
            c.globalAlpha = 0.18;
            c.fillStyle = 'rgba(105,70,34,0.64)';
            c.beginPath();
            c.ellipse(px, py, scale * 0.055, scale * 0.025, this.hash2D(i, x, seedBase + 34) * Math.PI, 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = 0.13;
            c.strokeStyle = 'rgba(55,34,19,0.58)';
            c.lineWidth = Math.max(0.4, scale * 0.009);
            c.beginPath();
            c.moveTo(px - scale * 0.045, py);
            c.lineTo(px + scale * 0.045, py);
            c.stroke();
          } else if (kind < 0.82) {
            c.globalAlpha = 0.18;
            c.strokeStyle = 'rgba(104,73,41,0.72)';
            c.lineWidth = Math.max(0.65, scale * 0.017);
            c.beginPath();
            c.moveTo(px - scale * 0.11, py + scale * 0.02);
            c.lineTo(px + scale * 0.11, py - scale * 0.02);
            c.stroke();
          } else {
            c.globalAlpha = 0.16;
            c.fillStyle = campLike ? 'rgba(68,47,27,0.62)' : 'rgba(73,54,35,0.58)';
            c.beginPath();
            c.ellipse(px, py, scale * 0.06, scale * 0.030, 0, 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = 0.10;
            c.strokeStyle = 'rgba(30,22,16,0.58)';
            c.lineWidth = Math.max(0.45, scale * 0.010);
            c.beginPath();
            c.arc(px, py, scale * 0.026, 0, Math.PI * 1.6);
            c.stroke();
          }
        }
        c.restore();
      },

      drawCachedHighPolyGrassFloorDetails(c, x, y, worldMinX, worldMinY, scale, material, detail = 0.5) {
        const localX = (x - worldMinX) * scale;
        const localY = (y - worldMinY) * scale;
        const seedBase = Math.floor((detail || 0.5) * 100000) + 62000;
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // Subtle quad-plane terrain undulation illusion: soft hummocks, damp depressions, and bare soil islands.
        for (let i = 0; i < 3; i++) {
          const hx = localX + (0.18 + this.hash2D(x * 7 + i, y * 5, seedBase + 1) * 0.64) * scale;
          const hy = localY + (0.22 + this.hash2D(y * 7 - i, x * 5, seedBase + 2) * 0.56) * scale;
          const dry = this.hash2D(x + i, y - i, seedBase + 3) > 0.62;
          c.globalAlpha = dry ? 0.105 : 0.075;
          c.fillStyle = dry ? 'rgba(116,91,52,0.62)' : 'rgba(23,44,22,0.58)';
          c.beginPath();
          c.ellipse(hx, hy, (0.18 + this.hash2D(i, x, seedBase + 4) * 0.20) * scale, (0.06 + this.hash2D(i, y, seedBase + 5) * 0.10) * scale, (this.hash2D(x, y + i, seedBase + 6) - 0.5) * 1.2, 0, Math.PI * 2);
          c.fill();
        }

        // Dense tufts: multiple grass species with varied blade angles and lengths.
        const tuftCount = 2 + Math.floor(this.hash2D(x, y, seedBase + 7) * 4);
        for (let t = 0; t < tuftCount; t++) {
          const cx = localX + (0.14 + this.hash2D(x * 17 + t, y * 19, seedBase + 8) * 0.72) * scale;
          const cy = localY + (0.20 + this.hash2D(y * 17 - t, x * 19, seedBase + 9) * 0.58) * scale;
          const blades = 4 + Math.floor(this.hash2D(x + t, y, seedBase + 10) * 6);
          for (let b = 0; b < blades; b++) {
            const lean = (this.hash2D(x + b, y + t, seedBase + 11) - 0.5) * 0.36 * scale;
            const h = (0.16 + this.hash2D(b, x - y + t, seedBase + 12) * 0.22) * scale;
            const baseOffset = (this.hash2D(b, t, seedBase + 13) - 0.5) * 0.16 * scale;
            c.globalAlpha = 0.22 + this.hash2D(t, b, seedBase + 14) * 0.28;
            c.strokeStyle = this.hash2D(t, b, seedBase + 15) > 0.55 ? material.light : material.dark;
            c.lineWidth = Math.max(0.8, scale * (0.030 + this.hash2D(t, b, seedBase + 16) * 0.030));
            c.beginPath();
            c.moveTo(cx + baseOffset, cy + scale * 0.08);
            c.quadraticCurveTo(cx + baseOffset + lean * 0.45, cy - h * 0.44, cx + baseOffset + lean, cy - h);
            c.stroke();
            if (b % 3 === 0) {
              c.globalAlpha *= 0.45;
              c.strokeStyle = 'rgba(210,226,148,0.52)';
              c.lineWidth = Math.max(0.45, scale * 0.012);
              c.beginPath();
              c.moveTo(cx + baseOffset + lean * 0.24, cy - h * 0.18);
              c.lineTo(cx + baseOffset + lean * 0.76, cy - h * 0.78);
              c.stroke();
            }
          }
        }

        // Broadleaf/clover rosettes and small flowers at controlled density.
        if (this.hash2D(x, y, seedBase + 20) > 0.45) {
          const px = localX + (0.20 + this.hash2D(x, y, seedBase + 21) * 0.62) * scale;
          const py = localY + (0.24 + this.hash2D(y, x, seedBase + 22) * 0.50) * scale;
          c.globalAlpha = 0.20;
          c.fillStyle = '#5f8f43';
          for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3 + this.hash2D(x, y, seedBase + 23) * 0.8;
            c.beginPath();
            c.ellipse(px + Math.cos(a) * scale * 0.07, py + Math.sin(a) * scale * 0.035, scale * 0.070, scale * 0.032, a, 0, Math.PI * 2);
            c.fill();
          }
          if (this.hash2D(x, y, seedBase + 24) > 0.72) {
            c.globalAlpha = 0.34;
            c.fillStyle = this.hash2D(x, y, seedBase + 25) > 0.5 ? '#e6d965' : '#dfe8d0';
            c.beginPath();
            c.arc(px + scale * 0.02, py - scale * 0.10, Math.max(1, scale * 0.025), 0, Math.PI * 2);
            c.fill();
          }
        }

        // Debris, pebbles, thatch, and small root crowns.
        if (this.hash2D(x, y, seedBase + 30) > 0.38) {
          c.globalAlpha = 0.16;
          c.strokeStyle = 'rgba(88,61,34,0.72)';
          c.lineWidth = Math.max(0.7, scale * 0.018);
          const tx = localX + (0.15 + this.hash2D(x, y, seedBase + 31) * 0.70) * scale;
          const ty = localY + (0.20 + this.hash2D(y, x, seedBase + 32) * 0.58) * scale;
          c.beginPath();
          c.moveTo(tx - scale * 0.08, ty + scale * 0.02);
          c.lineTo(tx + scale * 0.08, ty - scale * 0.02);
          c.stroke();
        }
        c.restore();
      },

      drawHighPolyGrassFloorDetails(s, tile, x, y, variant = {}) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !tile) return;
        const grassLike = tile.type === TILE.DEEP_GRASS || tile.type === TILE.DARK_GRASS || tile.type === TILE.UNDERBRUSH;
        if (!grassLike) return;
        const underbrush = tile.type === TILE.UNDERBRUSH;
        const dark = tile.type === TILE.DARK_GRASS;
        const density = underbrush ? 1.35 : dark ? 1.08 : 0.94;
        const baseSeed = 71000 + Math.floor((variant.noise || this.hash2D(x, y, 71001)) * 9999);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Bare soil/exposed root patches: subtle and within the existing tile footprint.
        const soilCount = 1 + Math.floor(this.hash2D(x, y, baseSeed + 1) * 3);
        for (let i = 0; i < soilCount; i++) {
          const px = s.x - 28 + this.hash2D(x * 13 + i, y * 17, baseSeed + 2) * 56;
          const py = s.y - 13 + this.hash2D(y * 13 - i, x * 17, baseSeed + 3) * 25;
          const dry = this.hash2D(x + i, y - i, baseSeed + 4) > 0.54;
          ctx.globalAlpha = dry ? 0.18 : 0.12;
          ctx.fillStyle = dry ? 'rgba(119,88,50,0.60)' : 'rgba(24,45,24,0.56)';
          ctx.beginPath();
          ctx.ellipse(px, py, 7 + this.hash2D(i, x, baseSeed + 5) * 12, 2.5 + this.hash2D(i, y, baseSeed + 6) * 5, (this.hash2D(x, y + i, baseSeed + 7) - 0.5) * 1.1, 0, Math.PI * 2);
          ctx.fill();
          // visible root threads / rain micro-erosion channels
          ctx.globalAlpha = 0.18;
          ctx.strokeStyle = dry ? 'rgba(68,43,23,0.58)' : 'rgba(77,77,42,0.42)';
          ctx.lineWidth = 0.75;
          for (let r = 0; r < 2; r++) {
            const sx = px - 6 + this.hash2D(i, r, baseSeed + 8) * 12;
            ctx.beginPath();
            ctx.moveTo(sx, py + 1);
            ctx.quadraticCurveTo(sx + 5, py - 3 + r * 3, sx + 12, py + (this.hash2D(r, i, baseSeed + 9) - 0.5) * 7);
            ctx.stroke();
          }
        }

        // Primary clustered grass tufts: varied blades, midrib highlights, and fountain growth pattern.
        const tufts = Math.floor((4 + this.hash2D(x, y, baseSeed + 10) * 5) * density);
        for (let t = 0; t < tufts; t++) {
          const cx = s.x - 31 + this.hash2D(x * 31 + t, y * 37, baseSeed + 11) * 62;
          const cy = s.y - 14 + this.hash2D(y * 31 - t, x * 37, baseSeed + 12) * 28;
          const blades = Math.floor((5 + this.hash2D(t, x, baseSeed + 13) * 7) * density);
          for (let b = 0; b < blades; b++) {
            const side = (this.hash2D(t, b, baseSeed + 14) - 0.5) * 2;
            const height = 8 + this.hash2D(b, t, baseSeed + 15) * (underbrush ? 16 : 12);
            const bend = side * (3 + this.hash2D(b, t, baseSeed + 16) * 7);
            const baseX = cx + (this.hash2D(b, t, baseSeed + 17) - 0.5) * 7;
            const baseY = cy + 3 + this.hash2D(t, b, baseSeed + 18) * 4;
            const oldBlade = this.hash2D(b, t, baseSeed + 19) > 0.86;
            ctx.globalAlpha = oldBlade ? 0.30 : 0.42 + this.hash2D(b, t, baseSeed + 20) * 0.25;
            ctx.strokeStyle = oldBlade ? 'rgba(164,150,75,0.62)' : (this.hash2D(b, t, baseSeed + 21) > 0.55 ? 'rgba(136,178,78,0.62)' : 'rgba(36,75,30,0.68)');
            ctx.lineWidth = 0.9 + this.hash2D(t, b, baseSeed + 22) * (underbrush ? 1.4 : 1.0);
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.quadraticCurveTo(baseX + bend * 0.35, baseY - height * 0.55, baseX + bend, baseY - height);
            ctx.stroke();
            if (b % 4 === 0) {
              ctx.globalAlpha *= 0.45;
              ctx.strokeStyle = 'rgba(216,234,160,0.45)';
              ctx.lineWidth = 0.42;
              ctx.beginPath();
              ctx.moveTo(baseX + bend * 0.18, baseY - height * 0.18);
              ctx.lineTo(baseX + bend * 0.78, baseY - height * 0.80);
              ctx.stroke();
            }
          }
        }

        // Secondary broadleaf plants, clover/plantain rosettes, and small flower heads.
        const broadleafCount = 1 + Math.floor(this.hash2D(x, y, baseSeed + 30) * (underbrush ? 4 : 3));
        for (let p = 0; p < broadleafCount; p++) {
          const cx = s.x - 25 + this.hash2D(x * 11 + p, y * 13, baseSeed + 31) * 50;
          const cy = s.y - 10 + this.hash2D(y * 11 - p, x * 13, baseSeed + 32) * 22;
          const leaves = 3 + Math.floor(this.hash2D(p, x, baseSeed + 33) * 4);
          for (let l = 0; l < leaves; l++) {
            const a = l * Math.PI * 2 / leaves + this.hash2D(x, y, baseSeed + 34) * 0.8;
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = this.hash2D(l, p, baseSeed + 35) > 0.5 ? 'rgba(91,137,61,0.78)' : 'rgba(70,112,53,0.78)';
            ctx.beginPath();
            ctx.ellipse(cx + Math.cos(a) * 4, cy + Math.sin(a) * 2, 4.0 + this.hash2D(l, p, baseSeed + 36) * 3, 1.7 + this.hash2D(p, l, baseSeed + 37) * 1.2, a, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.18;
            ctx.strokeStyle = 'rgba(190,220,142,0.42)';
            ctx.lineWidth = 0.45;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 3.5);
            ctx.stroke();
          }
          if (this.hash2D(x + p, y - p, baseSeed + 38) > 0.62) {
            const flower = this.hash2D(p, y, baseSeed + 39) > 0.5 ? 'rgba(230,216,95,0.82)' : 'rgba(220,218,206,0.82)';
            ctx.globalAlpha = 0.56;
            ctx.fillStyle = flower;
            ctx.beginPath();
            ctx.arc(cx + 3, cy - 7, 1.4 + this.hash2D(p, x, baseSeed + 40) * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Pebbles, thatch, seed husks, twigs, dew points.
        const debrisCount = 2 + Math.floor(this.hash2D(x, y, baseSeed + 50) * 4);
        for (let i = 0; i < debrisCount; i++) {
          const px = s.x - 30 + this.hash2D(x * 19 + i, y * 23, baseSeed + 51) * 60;
          const py = s.y - 12 + this.hash2D(y * 19 - i, x * 23, baseSeed + 52) * 24;
          const kind = this.hash2D(i, x - y, baseSeed + 53);
          if (kind < 0.34) {
            ctx.globalAlpha = 0.20;
            ctx.fillStyle = 'rgba(54,45,32,0.72)';
            ctx.beginPath();
            ctx.ellipse(px, py, 1.2 + this.hash2D(i, x, baseSeed + 54) * 2.0, 0.8 + this.hash2D(i, y, baseSeed + 55) * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind < 0.70) {
            ctx.globalAlpha = 0.24;
            ctx.strokeStyle = 'rgba(93,63,32,0.72)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(px - 5, py + 1);
            ctx.lineTo(px + 5, py - 2);
            ctx.stroke();
          } else {
            ctx.globalAlpha = 0.24;
            ctx.fillStyle = 'rgba(210,240,210,0.75)';
            ctx.beginPath();
            ctx.arc(px, py - 4, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Boundary thinning/seedling runners where grass neighbors non-grass terrain. Uses existing footprint, only overlays inward detail.
        const neighbor = {
          n: this.map?.[y - 1]?.[x] ?? null,
          e: this.map?.[y]?.[x + 1] ?? null,
          s: this.map?.[y + 1]?.[x] ?? null,
          w: this.map?.[y]?.[x - 1] ?? null
        };
        const edgeDefs = [
          ['n', neighbor.n, -1, -12], ['e', neighbor.e, 26, 0], ['s', neighbor.s, 0, 14], ['w', neighbor.w, -26, 0]
        ];
        for (const [edge, other, ox, oy] of edgeDefs) {
          if (this.tileTerrainFamily(other) === 'grass') continue;
          if (!other) continue;
          ctx.globalAlpha = 0.28;
          ctx.strokeStyle = 'rgba(75,116,49,0.52)';
          ctx.lineWidth = 0.8;
          for (let r = 0; r < 3; r++) {
            const rx = s.x + ox * 0.65 + (this.hash2D(x + r, y, baseSeed + 60 + edge.charCodeAt(0)) - 0.5) * 18;
            const ry = s.y + oy * 0.65 + (this.hash2D(y + r, x, baseSeed + 61 + edge.charCodeAt(0)) - 0.5) * 8;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.quadraticCurveTo(rx - ox * 0.12, ry - 4, rx - ox * 0.22, ry - 7);
            ctx.stroke();
          }
        }
        ctx.restore();
      },

      drawHighPolyCaveFloorDetails(s, tile, x, y, variant = {}) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !tile || tile.type !== TILE.CAVE_FLOOR) return;
        const baseSeed = 93000 + Math.floor((variant.noise || this.hash2D(x, y, 93001)) * 9999);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Bedrock undulation: shallow basins, low ledges, ancient water-polished channels.
        for (let i = 0; i < 4; i++) {
          const px = s.x - 30 + this.hash2D(x * 13 + i, y * 17, baseSeed + 1) * 60;
          const py = s.y - 13 + this.hash2D(y * 13 - i, x * 17, baseSeed + 2) * 26;
          const damp = this.hash2D(x + i, y - i, baseSeed + 3) > 0.62;
          ctx.globalAlpha = damp ? 0.13 : 0.16;
          ctx.fillStyle = damp ? 'rgba(24,31,29,0.64)' : 'rgba(125,113,87,0.34)';
          ctx.beginPath();
          ctx.ellipse(px, py, 8 + this.hash2D(i, x, baseSeed + 4) * 14, 2.0 + this.hash2D(i, y, baseSeed + 5) * 4.4, (this.hash2D(x, y + i, baseSeed + 6) - 0.5) * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Fracture networks, mineral veins, bedding-plane cuts, and spalling lines.
        const fractures = 4 + Math.floor(this.hash2D(x, y, baseSeed + 10) * 6);
        for (let i = 0; i < fractures; i++) {
          const sx = s.x - 30 + this.hash2D(x * 19 + i, y * 23, baseSeed + 11) * 60;
          const sy = s.y - 12 + this.hash2D(y * 19 - i, x * 23, baseSeed + 12) * 24;
          const len = 6 + this.hash2D(i, x, baseSeed + 13) * 16;
          const angle = (this.hash2D(x - i, y + i, baseSeed + 14) - 0.5) * Math.PI * 1.35;
          const mineral = this.hash2D(i, y, baseSeed + 15) > 0.68;
          ctx.globalAlpha = mineral ? 0.28 : 0.32;
          ctx.strokeStyle = mineral ? 'rgba(206,194,150,0.48)' : 'rgba(24,22,20,0.60)';
          ctx.lineWidth = mineral ? 0.55 : 0.65 + this.hash2D(i, y, baseSeed + 16) * 0.50;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + Math.cos(angle + 0.7) * len * 0.42, sy + Math.sin(angle + 0.7) * len * 0.32, sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.60);
          if (!mineral && this.hash2D(i, x + y, baseSeed + 17) > 0.48) {
            ctx.moveTo(sx + Math.cos(angle) * len * 0.34, sy + Math.sin(angle) * len * 0.22);
            ctx.lineTo(sx + Math.cos(angle + 1.05) * len * 0.58, sy + Math.sin(angle + 1.05) * len * 0.42);
          }
          ctx.stroke();
        }

        // Flowstone/rimstone sheets, drip impact rings, calcite nubs.
        if (this.hash2D(x, y, baseSeed + 30) > 0.30) {
          const fx = s.x - 24 + this.hash2D(x, y, baseSeed + 31) * 48;
          const fy = s.y - 10 + this.hash2D(y, x, baseSeed + 32) * 20;
          const rot = (this.hash2D(x, y, baseSeed + 33) - 0.5) * 1.0;
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = 'rgba(174,161,122,0.34)';
          ctx.beginPath();
          ctx.ellipse(fx, fy, 6 + this.hash2D(x, y, baseSeed + 34) * 10, 1.5 + this.hash2D(y, x, baseSeed + 35) * 2.6, rot, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.24;
          ctx.strokeStyle = 'rgba(214,198,150,0.36)';
          ctx.lineWidth = 0.5;
          for (let r = 0; r < 2; r++) {
            ctx.beginPath();
            ctx.ellipse(fx, fy + r * 2.3, 4.5 + r * 2.0, 1.1 + r * 0.45, rot, Math.PI * 0.05, Math.PI * 1.10);
            ctx.stroke();
          }
          if (this.hash2D(x, y, baseSeed + 36) > 0.62) {
            ctx.globalAlpha = 0.30;
            ctx.fillStyle = 'rgba(191,181,143,0.58)';
            ctx.beginPath();
            ctx.arc(fx + 3, fy - 2, 1.2 + this.hash2D(x, y, baseSeed + 37) * 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Loose stones, spall, cave pearls, seated shadows.
        const stones = 3 + Math.floor(this.hash2D(x, y, baseSeed + 40) * 6);
        for (let i = 0; i < stones; i++) {
          const px = s.x - 30 + this.hash2D(x * 31 + i, y * 37, baseSeed + 41) * 60;
          const py = s.y - 13 + this.hash2D(y * 31 - i, x * 37, baseSeed + 42) * 26;
          const rx = 1.4 + this.hash2D(i, x, baseSeed + 43) * 4.8;
          const ry = 0.8 + this.hash2D(i, y, baseSeed + 44) * 2.4;
          ctx.globalAlpha = 0.24;
          ctx.fillStyle = 'rgba(16,14,12,0.56)';
          ctx.beginPath();
          ctx.ellipse(px + 1, py + 1.2, rx * 1.45, ry * 1.30, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = this.hash2D(i, y, baseSeed + 45) > 0.55 ? 'rgba(129,120,95,0.66)' : 'rgba(84,78,66,0.64)';
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, this.hash2D(i, x, baseSeed + 46) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.20;
          ctx.strokeStyle = 'rgba(211,199,156,0.42)';
          ctx.lineWidth = 0.45;
          ctx.beginPath();
          ctx.moveTo(px - rx * 0.48, py - ry * 0.22);
          ctx.lineTo(px + rx * 0.45, py - ry * 0.40);
          ctx.stroke();
        }

        // Moisture/seepage stains, small puddle films, pale fungi, guano/bone fragments.
        const micro = 2 + Math.floor(this.hash2D(x, y, baseSeed + 60) * 4);
        for (let i = 0; i < micro; i++) {
          const px = s.x - 28 + this.hash2D(x * 41 + i, y * 43, baseSeed + 61) * 56;
          const py = s.y - 12 + this.hash2D(y * 41 - i, x * 43, baseSeed + 62) * 24;
          const kind = this.hash2D(i, x - y, baseSeed + 63);
          if (kind < 0.36) {
            ctx.globalAlpha = 0.14;
            ctx.fillStyle = 'rgba(10,18,18,0.66)';
            ctx.beginPath();
            ctx.ellipse(px, py, 4 + this.hash2D(i, x, baseSeed + 64) * 6, 1.2 + this.hash2D(i, y, baseSeed + 65) * 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.20;
            ctx.strokeStyle = 'rgba(159,184,172,0.28)';
            ctx.lineWidth = 0.45;
            ctx.beginPath();
            ctx.ellipse(px, py, 2.8, 0.9, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else if (kind < 0.58) {
            ctx.globalAlpha = 0.30;
            ctx.strokeStyle = 'rgba(222,224,202,0.42)';
            ctx.fillStyle = 'rgba(198,202,178,0.50)';
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(px, py + 1.5);
            ctx.lineTo(px, py - 3.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(px, py - 3.5, 2.0, 0.9, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (kind < 0.78) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = 'rgba(36,31,26,0.66)';
            for (let g = 0; g < 3; g++) {
              ctx.beginPath();
              ctx.ellipse(px + (g - 1) * 1.8, py + (g % 2) * 0.8, 1.0, 0.55, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = 'rgba(197,185,152,0.56)';
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.moveTo(px - 3.5, py);
            ctx.lineTo(px + 3, py - 1.2);
            ctx.stroke();
          }
        }

        // Cave wall transition: darker talus/debris near cave-wall neighbors, preserving footprint.
        const neighbor = {
          n: this.map?.[y - 1]?.[x] ?? null,
          e: this.map?.[y]?.[x + 1] ?? null,
          s: this.map?.[y + 1]?.[x] ?? null,
          w: this.map?.[y]?.[x - 1] ?? null
        };
        const edges = [['n', neighbor.n, 0, -11], ['e', neighbor.e, 26, 0], ['s', neighbor.s, 0, 13], ['w', neighbor.w, -26, 0]];
        for (const [edge, other, ox, oy] of edges) {
          if (other?.type !== TILE.CAVE_WALL) continue;
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = 'rgba(12,10,9,0.55)';
          for (let r = 0; r < 3; r++) {
            const rx = s.x + ox * 0.58 + (this.hash2D(x + r, y, baseSeed + 100 + edge.charCodeAt(0)) - 0.5) * 16;
            const ry = s.y + oy * 0.58 + (this.hash2D(y + r, x, baseSeed + 101 + edge.charCodeAt(0)) - 0.5) * 7;
            ctx.beginPath();
            ctx.ellipse(rx, ry, 2.8 + this.hash2D(r, x, baseSeed + 102) * 4, 1.0 + this.hash2D(r, y, baseSeed + 103) * 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      },

      drawHighPolyDirtFloorDetails(s, tile, x, y, variant = {}) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { ctx } = DR.runtime || {};
        if (!ctx || !tile) return;
        const type = tile.type;
        const dirtLike = type === TILE.DIRT || type === TILE.CAMP || type === TILE.FOREST_FLOOR;
        if (!dirtLike) return;
        const campLike = type === TILE.CAMP;
        const caveLike = false;
        const density = campLike ? 1.22 : 1.0;
        const baseSeed = 88000 + Math.floor((variant.noise || this.hash2D(x, y, 88001)) * 9999);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Base terrain undulation illusion: shallow drainage depressions, old root mounds, and compacted surfaces.
        const patches = Math.floor((3 + this.hash2D(x, y, baseSeed + 1) * 4) * density);
        for (let i = 0; i < patches; i++) {
          const px = s.x - 31 + this.hash2D(x * 17 + i, y * 19, baseSeed + 2) * 62;
          const py = s.y - 14 + this.hash2D(y * 17 - i, x * 19, baseSeed + 3) * 28;
          const damp = this.hash2D(x + i, y - i, baseSeed + 4) > 0.60;
          const compacted = this.hash2D(i, x + y, baseSeed + 5) > 0.68;
          ctx.globalAlpha = compacted ? 0.16 : damp ? 0.14 : 0.18;
          ctx.fillStyle = caveLike ? 'rgba(60,49,42,0.44)' : damp ? 'rgba(55,39,27,0.58)' : 'rgba(151,99,51,0.45)';
          ctx.beginPath();
          ctx.ellipse(px, py, 7 + this.hash2D(i, x, baseSeed + 6) * 14, 2.2 + this.hash2D(i, y, baseSeed + 7) * 5.2, (this.hash2D(x, y + i, baseSeed + 8) - 0.5) * 1.5, 0, Math.PI * 2);
          ctx.fill();
          if (compacted) {
            ctx.globalAlpha = 0.10;
            ctx.strokeStyle = 'rgba(35,24,17,0.60)';
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(px - 8, py + 1);
            ctx.quadraticCurveTo(px, py - 2, px + 10, py + 1);
            ctx.stroke();
          }
        }

        // Soil aggregate, desiccation cracks, runoff channels, and fine root traces.
        const cracks = 3 + Math.floor(this.hash2D(x, y, baseSeed + 20) * 5);
        for (let i = 0; i < cracks; i++) {
          const sx = s.x - 30 + this.hash2D(x * 23 + i, y * 29, baseSeed + 21) * 60;
          const sy = s.y - 12 + this.hash2D(y * 23 - i, x * 29, baseSeed + 22) * 25;
          const len = 5 + this.hash2D(i, x, baseSeed + 23) * 13;
          const angle = (this.hash2D(x - i, y + i, baseSeed + 24) - 0.5) * Math.PI * 1.2;
          const rill = this.hash2D(i, y, baseSeed + 25) > 0.64;
          ctx.globalAlpha = rill ? 0.18 : 0.20;
          ctx.strokeStyle = rill ? 'rgba(82,54,33,0.50)' : 'rgba(39,26,18,0.58)';
          ctx.lineWidth = rill ? 0.75 : 0.55 + this.hash2D(i, y, baseSeed + 26) * 0.55;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + Math.cos(angle + 0.8) * len * 0.45, sy + Math.sin(angle + 0.8) * len * 0.35, sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.68);
          if (!rill && this.hash2D(i, x + y, baseSeed + 27) > 0.55) {
            ctx.moveTo(sx + Math.cos(angle) * len * 0.35, sy + Math.sin(angle) * len * 0.22);
            ctx.lineTo(sx + Math.cos(angle + 1.15) * len * 0.60, sy + Math.sin(angle + 1.15) * len * 0.45);
          }
          ctx.stroke();
        }

        // Embedded stones with contact-shadow depressions and mineral vein readables.
        const stones = Math.floor((3 + this.hash2D(x, y, baseSeed + 40) * 5) * density);
        for (let i = 0; i < stones; i++) {
          const px = s.x - 30 + this.hash2D(x * 31 + i, y * 37, baseSeed + 41) * 60;
          const py = s.y - 13 + this.hash2D(y * 31 - i, x * 37, baseSeed + 42) * 26;
          const rx = 1.5 + this.hash2D(i, x, baseSeed + 43) * 4.6;
          const ry = 0.9 + this.hash2D(i, y, baseSeed + 44) * 2.4;
          ctx.globalAlpha = 0.20;
          ctx.fillStyle = 'rgba(38,27,19,0.54)';
          ctx.beginPath();
          ctx.ellipse(px + 1.0, py + 1.1, rx * 1.35, ry * 1.25, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.38;
          ctx.fillStyle = this.hash2D(i, y, baseSeed + 45) > 0.55 ? 'rgba(127,111,84,0.68)' : 'rgba(87,77,61,0.62)';
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, this.hash2D(i, x, baseSeed + 46) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.22;
          ctx.strokeStyle = 'rgba(199,174,124,0.42)';
          ctx.lineWidth = 0.45;
          ctx.beginPath();
          ctx.moveTo(px - rx * 0.55, py - ry * 0.25);
          ctx.lineTo(px + rx * 0.50, py - ry * 0.45);
          ctx.stroke();
        }

        // Exposed roots, cut root ends, twig debris, leaf litter, seed shells, and activity signs.
        const debris = Math.floor((4 + this.hash2D(x, y, baseSeed + 60) * 7) * density);
        for (let i = 0; i < debris; i++) {
          const px = s.x - 30 + this.hash2D(x * 41 + i, y * 43, baseSeed + 61) * 60;
          const py = s.y - 13 + this.hash2D(y * 41 - i, x * 43, baseSeed + 62) * 26;
          const kind = this.hash2D(i, x - y, baseSeed + 63);
          if (kind < 0.22) {
            // exposed lateral root
            ctx.globalAlpha = 0.26;
            ctx.strokeStyle = 'rgba(91,55,27,0.78)';
            ctx.lineWidth = 1.1 + this.hash2D(i, x, baseSeed + 64) * 1.0;
            ctx.beginPath();
            ctx.moveTo(px - 8, py + 1);
            ctx.quadraticCurveTo(px - 1, py - 5, px + 11, py - 2);
            ctx.stroke();
            ctx.globalAlpha = 0.14;
            ctx.strokeStyle = 'rgba(170,128,77,0.50)';
            ctx.lineWidth = 0.45;
            ctx.beginPath();
            ctx.moveTo(px - 5, py - 1);
            ctx.lineTo(px + 8, py - 3);
            ctx.stroke();
          } else if (kind < 0.42) {
            // leaf fragment / organic litter
            ctx.globalAlpha = 0.24;
            ctx.fillStyle = this.hash2D(i, y, baseSeed + 65) > 0.5 ? 'rgba(112,70,30,0.68)' : 'rgba(67,55,29,0.62)';
            ctx.beginPath();
            ctx.ellipse(px, py, 3.8, 1.7, this.hash2D(i, x, baseSeed + 66) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.14;
            ctx.strokeStyle = 'rgba(41,31,18,0.62)';
            ctx.lineWidth = 0.42;
            ctx.beginPath();
            ctx.moveTo(px - 3, py);
            ctx.lineTo(px + 3, py);
            ctx.stroke();
          } else if (kind < 0.60) {
            // twig or broken stick segment
            ctx.globalAlpha = 0.30;
            ctx.strokeStyle = 'rgba(96,61,31,0.78)';
            ctx.lineWidth = 0.8 + this.hash2D(i, y, baseSeed + 67) * 0.55;
            ctx.beginPath();
            ctx.moveTo(px - 6, py + 2);
            ctx.lineTo(px + 7, py - 2);
            ctx.stroke();
            if (this.hash2D(i, x, baseSeed + 68) > 0.55) {
              ctx.globalAlpha = 0.20;
              ctx.beginPath();
              ctx.moveTo(px + 1, py);
              ctx.lineTo(px + 5, py + 3);
              ctx.stroke();
            }
          } else if (kind < 0.75) {
            // worm cast / ant mound / burrow entrance
            ctx.globalAlpha = 0.20;
            ctx.fillStyle = 'rgba(73,53,34,0.66)';
            ctx.beginPath();
            ctx.ellipse(px, py, 3.1, 1.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.18;
            ctx.strokeStyle = 'rgba(30,22,16,0.62)';
            ctx.lineWidth = 0.45;
            ctx.beginPath();
            ctx.arc(px, py, 1.25, 0, Math.PI * 1.55);
            ctx.stroke();
          } else if (kind < 0.88) {
            // tiny footprint / animal track impression
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = 'rgba(30,22,16,0.55)';
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.ellipse(px + k * 1.8, py + (k % 2) * 1.2, 0.8, 0.55, 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // rare old activity sign: charcoal/pottery/nail speck, kept tiny so it does not redesign the tile.
            ctx.globalAlpha = campLike ? 0.28 : 0.18;
            ctx.fillStyle = campLike ? 'rgba(33,27,22,0.76)' : 'rgba(82,67,54,0.58)';
            ctx.beginPath();
            ctx.rect(px - 1.3, py - 0.8, 2.6, 1.6);
            ctx.fill();
          }
        }

        // Moisture pockets and biological response in low spots.
        if (!caveLike && this.hash2D(x, y, baseSeed + 90) > 0.58) {
          const px = s.x - 22 + this.hash2D(x, y, baseSeed + 91) * 44;
          const py = s.y - 10 + this.hash2D(y, x, baseSeed + 92) * 20;
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = 'rgba(48,53,35,0.54)';
          ctx.beginPath();
          ctx.ellipse(px, py, 6 + this.hash2D(x, y, baseSeed + 93) * 7, 1.6 + this.hash2D(y, x, baseSeed + 94) * 2.0, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.20;
          ctx.strokeStyle = 'rgba(65,96,48,0.44)';
          ctx.lineWidth = 0.55;
          for (let m = 0; m < 3; m++) {
            ctx.beginPath();
            ctx.moveTo(px - 5 + m * 4, py + 1);
            ctx.lineTo(px - 3 + m * 4, py - 3);
            ctx.stroke();
          }
        }

        // Organic edge transition: dirt receives grass runners / debris accumulation near grass boundaries only as overlay.
        const neighbor = {
          n: this.map?.[y - 1]?.[x] ?? null,
          e: this.map?.[y]?.[x + 1] ?? null,
          s: this.map?.[y + 1]?.[x] ?? null,
          w: this.map?.[y]?.[x - 1] ?? null
        };
        const edges = [['n', neighbor.n, 0, -11], ['e', neighbor.e, 26, 0], ['s', neighbor.s, 0, 13], ['w', neighbor.w, -26, 0]];
        for (const [edge, other, ox, oy] of edges) {
          if (this.tileTerrainFamily(other) !== 'grass') continue;
          ctx.globalAlpha = 0.24;
          ctx.strokeStyle = 'rgba(70,104,43,0.50)';
          ctx.lineWidth = 0.65;
          for (let r = 0; r < 3; r++) {
            const rx = s.x + ox * 0.55 + (this.hash2D(x + r, y, baseSeed + 100 + edge.charCodeAt(0)) - 0.5) * 18;
            const ry = s.y + oy * 0.55 + (this.hash2D(y + r, x, baseSeed + 101 + edge.charCodeAt(0)) - 0.5) * 8;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.quadraticCurveTo(rx - ox * 0.10, ry - 3, rx - ox * 0.18, ry - 6);
            ctx.stroke();
          }
        }
        ctx.restore();
      },

      drawGroundDetail(s, tile, x, y) {
        const DR = window.DreamRealms;
        const { TILE } = DR;
        const { seededNoise } = DR.utils || {};
        const { ctx } = DR.runtime || {};
        const type = tile.type;
        const grassLike = type === TILE.DEEP_GRASS || type === TILE.DARK_GRASS || type === TILE.UNDERBRUSH;
        const caveFloorLike = type === TILE.CAVE_FLOOR;
        const dirtLike = type === TILE.DIRT || type === TILE.CAMP || type === TILE.FOREST_FLOOR;
        const stoneLike = type === TILE.STONE || type === TILE.RUIN || type === TILE.CAVE_WALL;
        const n = seededNoise(x, y, 8001);

        if (grassLike) {
          this.drawHighPolyGrassFloorDetails(s, tile, x, y, { noise: n });
        } else if (caveFloorLike) {
          this.drawHighPolyCaveFloorDetails(s, tile, x, y, { noise: n });
        } else if (dirtLike) {
          this.drawHighPolyDirtFloorDetails(s, tile, x, y, { noise: n });
        } else if (stoneLike) {
          ctx.strokeStyle = 'rgba(48,47,41,0.35)';
          ctx.lineWidth = 2;
          const cuts = seededNoise(x, y, 915) > 0.5 ? [[-26,-2,2,-10,30,-1],[-14,9,15,4]] : [[-34,4,-8,-6,20,6],[2,-12,31,-5]];
          for (const c of cuts) {
            ctx.beginPath();
            ctx.moveTo(s.x + c[0], s.y + c[1]);
            for (let i = 2; i < c.length; i += 2) ctx.lineTo(s.x + c[i], s.y + c[i + 1]);
            ctx.stroke();
          }
        }
      },

      });
    }
  };
})();
