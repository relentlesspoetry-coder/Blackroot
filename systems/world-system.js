// Dream Realms external world generation system
// Extracted from the V0.10.3 stable baseline without changing runtime behavior.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};



  function normalizeWaterDepthsForMap(map) {
    const TILE = DR.TILE || window.TILE || {};
    const { seededNoise } = DR.utils || {};
    if (!Array.isArray(map) || !TILE.WATER) return { bodies: 0, waterTiles: 0 };
    const h = map.length;
    const w = map[0]?.length || 0;
    const seen = Array.from({ length: h }, () => new Array(w).fill(false));
    let bodies = 0;
    let waterTiles = 0;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        if (seen[sy][sx] || map[sy]?.[sx]?.type !== TILE.WATER) continue;
        bodies++;
        const cells = [];
        const queue = [{ x: sx, y: sy }];
        seen[sy][sx] = true;
        let minX = sx, maxX = sx, minY = sy, maxY = sy;
        for (let qi = 0; qi < queue.length; qi++) {
          const cell = queue[qi];
          cells.push(cell);
          minX = Math.min(minX, cell.x); maxX = Math.max(maxX, cell.x);
          minY = Math.min(minY, cell.y); maxY = Math.max(maxY, cell.y);
          for (const [dx, dy] of dirs) {
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            if (!map[ny]?.[nx] || seen[ny][nx] || map[ny][nx].type !== TILE.WATER) continue;
            seen[ny][nx] = true;
            queue.push({ x: nx, y: ny });
          }
        }

        waterTiles += cells.length;
        const spanX = maxX - minX + 1;
        const spanY = maxY - minY + 1;
        const aspect = Math.max(spanX, spanY) / Math.max(1, Math.min(spanX, spanY));
        const isRiverLike = aspect > 3.2 && cells.length > 18;
        const bodyMaxDepth = cells.length >= 180 ? 12 : cells.length >= 75 ? 10 : cells.length >= 25 ? 8 : 6;
        const maxDepth = isRiverLike ? Math.max(7, Math.min(10, bodyMaxDepth)) : bodyMaxDepth;

        const edge = [];
        const dist = new Map();
        for (const cell of cells) {
          const edgeWaterNeighbors = dirs.reduce((count, [dx, dy]) => count + (map[cell.y + dy]?.[cell.x + dx]?.type === TILE.WATER ? 1 : 0), 0);
          if (edgeWaterNeighbors < 4) {
            const key = `${cell.x},${cell.y}`;
            dist.set(key, 0);
            edge.push(cell);
          }
        }
        const bfs = edge.length ? edge.slice() : [cells[0]];
        if (!edge.length) dist.set(`${cells[0].x},${cells[0].y}`, 0);
        for (let qi = 0; qi < bfs.length; qi++) {
          const cell = bfs[qi];
          const base = dist.get(`${cell.x},${cell.y}`) || 0;
          for (const [dx, dy] of dirs) {
            const nx = cell.x + dx;
            const ny = cell.y + dy;
            if (map[ny]?.[nx]?.type !== TILE.WATER) continue;
            const key = `${nx},${ny}`;
            if (dist.has(key)) continue;
            dist.set(key, base + 1);
            bfs.push({ x: nx, y: ny });
          }
        }
        const maxDist = Math.max(1, ...Array.from(dist.values()));
        for (const cell of cells) {
          const tile = map[cell.y][cell.x];
          const d = dist.get(`${cell.x},${cell.y}`) || 0;
          const centerFactor = Math.min(1, d / maxDist);
          const noise = typeof seededNoise === 'function' ? seededNoise(cell.x, cell.y, 43117) : 0.5;
          const depth = Math.round(5 + (maxDepth - 5) * (centerFactor * 0.82 + noise * 0.18));
          tile.waterDepth = Math.max(5, Math.min(12, depth));
          tile.waterSurfaceElev = Number.isFinite(Number(tile.elev)) ? Number(tile.elev) : 0;
          tile.waterBottomElev = tile.waterSurfaceElev - tile.waterDepth;
          tile.waterBodySize = cells.length;
          tile.waterBodyKind = isRiverLike ? 'river' : (cells.length >= 75 ? 'lake' : 'pond');
          tile.blocked = false;
        }
      }
    }
    return { bodies, waterTiles };
  }

  DR.normalizeWaterDepthsForMap = normalizeWaterDepthsForMap;

  DR.WorldSystem = {
    install(Game) {
      const CONFIG = DR.CONFIG || { MAP_SIZE: 200, START_X: 100, START_Y: 100 };
      const TILE = DR.TILE || {};
      const TILE_DEF = DR.TILE_DEF || {};
      const { seededNoise, smoothNoise, clamp } = DR.utils || {};

            Game.prototype.generateMap = function() {
        const size = CONFIG.OVERWORLD_MAP_SIZE || CONFIG.MAP_SIZE;
        this.map = new Array(size);
        this.objects = new Array(size);
        this.caveEntrances = [];

        const inBounds = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
        const tileDef = type => TILE_DEF[type] || TILE_DEF[TILE.DARK_GRASS];
        const setTile = (x, y, type, elev = null, clearObject = false) => {
          x = Math.floor(x); y = Math.floor(y);
          if (!inBounds(x, y)) return;
          const tile = this.map[y][x];
          if (!tile) return;
          tile.type = type;
          if (elev !== null) tile.elev = Math.max(0, Math.floor(elev));
          tile.blocked = !tileDef(type).walk;
          if (type === TILE.WATER) {
            tile.elev = 0;
            tile.waterDepth = Math.max(5, tile.waterDepth || 7);
          } else {
            tile.waterDepth = 0;
            tile.waterSurfaceElev = undefined;
            tile.waterBottomElev = undefined;
          }
          if (clearObject) this.objects[y][x] = null;
        };
        const paintEllipse = (cx, cy, rx, ry, type, elevFn = null, clearObject = true) => {
          for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
            for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
              if (!inBounds(x, y)) continue;
              const nx = (x - cx) / Math.max(1, rx);
              const ny = (y - cy) / Math.max(1, ry);
              const d = nx * nx + ny * ny;
              if (d <= 1) {
                const elev = typeof elevFn === 'function' ? elevFn(x, y, d) : elevFn;
                setTile(x, y, type, elev, clearObject);
              }
            }
          }
        };
        const carvePath = (points, width, type = TILE.DIRT, elev = 0) => {
          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2.2);
            for (let s = 0; s <= steps; s++) {
              const t = s / Math.max(1, steps);
              const wobble = Math.sin(t * Math.PI * 2 + i * 1.7) * 0.55;
              const x = a.x + (b.x - a.x) * t + wobble;
              const y = a.y + (b.y - a.y) * t + Math.cos(t * Math.PI + i) * 0.45;
              paintEllipse(x, y, width, Math.max(1, width * 0.72), type, elev, true);
            }
          }
        };
        const carveWaterPath = (points, width) => {
          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2.5);
            for (let s = 0; s <= steps; s++) {
              const t = s / Math.max(1, steps);
              const wobble = Math.sin(t * Math.PI * 2 + i * 2.3) * 1.2;
              const x = a.x + (b.x - a.x) * t + wobble;
              const y = a.y + (b.y - a.y) * t + Math.cos(t * Math.PI * 1.3 + i) * 0.9;
              const w = width + Math.sin((x + y) * 0.13) * 0.8;
              paintEllipse(x, y, w, Math.max(1.4, w * 0.62), TILE.WATER, 0, true);
            }
          }
        };

        // Fresh V0.12.31 Dark Woods base: broad forest zones with intentional elevation,
        // not random stair clutter and not flat-only terrain.
        for (let y = 0; y < size; y++) {
          this.map[y] = new Array(size);
          this.objects[y] = new Array(size).fill(null);
          for (let x = 0; x < size; x++) {
            const dx = x - CONFIG.START_X;
            const dy = y - CONFIG.START_Y;
            const distStart = Math.hypot(dx, dy);
            const edgeFactor = Math.min(x, y, size - 1 - x, size - 1 - y) / (size * 0.5);
            const n1 = smoothNoise(x, y, 28, 31031);
            const n2 = smoothNoise(x, y, 13, 31032);
            const n3 = smoothNoise(x, y, 7, 31033);
            const radial = Math.min(1, distStart / 118);

            let type = TILE.DARK_GRASS;
            if (distStart < 16) type = TILE.FOREST_FLOOR;
            else if (radial < 0.34) type = n1 < 0.30 ? TILE.DEEP_GRASS : n2 > 0.72 ? TILE.FOREST_FLOOR : TILE.DARK_GRASS;
            else if (radial < 0.62) type = n2 > 0.68 ? TILE.UNDERBRUSH : n1 < 0.24 ? TILE.DEEP_GRASS : TILE.DARK_GRASS;
            else type = n1 > 0.64 ? TILE.UNDERBRUSH : n2 < 0.30 ? TILE.DEEP_GRASS : TILE.DARK_GRASS;

            // Intentional stone/ruin ridges around deep landmarks.
            const northRidge = Math.abs(y - (54 + Math.sin(x / 12) * 8)) < 4.5 && x > 116;
            const westRidge = Math.abs(x - (55 + Math.sin(y / 14) * 7)) < 3.7 && y > 132;
            const eastShelf = Math.abs(x - (160 + Math.sin(y / 15) * 6)) < 4.2 && y > 95 && y < 150;
            if (northRidge || westRidge || eastShelf || (n1 > 0.84 && n2 > 0.58 && distStart > 42)) type = TILE.STONE;

            // Far corruption tint for high-level areas.
            if ((x > 150 && y < 70) || (x > 160 && y > 145) || (x < 45 && y > 155)) {
              if (n3 > 0.48) type = TILE.UNDERBRUSH;
              if (n1 > 0.76) type = TILE.STONE;
            }

            let elev = 0;
            if (type !== TILE.WATER) {
              const ridgeBoost = (type === TILE.STONE || type === TILE.RUIN) ? 1.3 : 0;
              elev = Math.floor(Math.max(0, Math.min(4, radial * 2.2 + n2 * 1.8 + n3 * 0.8 + ridgeBoost - 1.05)));
              if (distStart < 18) elev = 0;
            }

            this.map[y][x] = { type, elev, blocked: !tileDef(type).walk, waterDepth: 0 };
          }
        }

        // Main water identity: one large winding creek plus ponds/grotto pools.
        carveWaterPath([
          { x: 8, y: 46 }, { x: 28, y: 58 }, { x: 52, y: 69 }, { x: 76, y: 66 },
          { x: 102, y: 78 }, { x: 128, y: 96 }, { x: 153, y: 111 }, { x: 190, y: 129 }
        ], 3.4);
        carveWaterPath([
          { x: 31, y: 157 }, { x: 50, y: 142 }, { x: 72, y: 130 }, { x: 95, y: 116 }
        ], 2.8);
        paintEllipse(155, 121, 12, 9, TILE.WATER, 0, true);
        paintEllipse(47, 143, 9, 8, TILE.WATER, 0, true);
        paintEllipse(117, 56, 10, 7, TILE.WATER, 0, true);
        paintEllipse(176, 162, 8, 7, TILE.WATER, 0, true);

        // Terrain identity landmarks before roads.
        paintEllipse(141, 68, 18, 13, TILE.RUIN, (x, y, d) => d < 0.45 ? 2 : 1, true);
        paintEllipse(170, 50, 15, 12, TILE.RUIN, (x, y, d) => d < 0.55 ? 3 : 2, true);
        paintEllipse(64, 171, 15, 10, TILE.STONE, (x, y, d) => d < 0.6 ? 2 : 1, true);
        paintEllipse(52, 139, 14, 12, TILE.UNDERBRUSH, 0, false);
        paintEllipse(160, 123, 20, 13, TILE.STONE, (x, y, d) => d < 0.5 ? 2 : 1, true);

        // Fresh route layout: roads connect camp, hamlet, cave mouths, and deep landmarks.
        carvePath([{x:100,y:100},{x:89,y:108},{x:80,y:116}], 2.5, TILE.DIRT, 0);
        carvePath([{x:100,y:100},{x:90,y:89},{x:76,y:74}], 2.0, TILE.DIRT, 0);
        carvePath([{x:100,y:100},{x:82,y:115},{x:64,y:129},{x:52,y:139}], 1.7, TILE.DIRT, 0);
        carvePath([{x:100,y:100},{x:118,y:88},{x:141,y:68},{x:145,y:63}], 1.7, TILE.DIRT, 1);
        carvePath([{x:100,y:100},{x:124,y:111},{x:149,y:119},{x:163,y:123}], 1.9, TILE.DIRT, 1);
        carvePath([{x:80,y:116},{x:72,y:140},{x:65,y:171}], 1.7, TILE.DIRT, 0);
        carvePath([{x:141,y:68},{x:158,y:57},{x:170,y:48}], 1.6, TILE.RUIN, 2);
        carvePath([{x:163,y:123},{x:172,y:144},{x:176,y:162}], 1.4, TILE.STONE, 1);

        // V0.17.43 Phase 4: extend the route network into the area added by the
        // Phase 2 resize, reaching into the Stone Hedge Clearing and Gloamroot
        // Depths regions defined in Phase 3. The Stone Hedge spur is a proper
        // maintained road (matches the existing main-road width); the Gloamroot
        // spur is a rougher side path (narrower); the third is a deliberately
        // unmarked, overgrown trail (narrowest, no lanterns placed along it).
        carvePath([{x:163,y:123},{x:182,y:158},{x:196,y:200},{x:200,y:240}], 1.7, TILE.DIRT, 1);
        carvePath([{x:176,y:162},{x:220,y:210},{x:260,y:250},{x:280,y:280}], 1.3, TILE.DIRT, 1);
        carvePath([{x:65,y:171},{x:52,y:200},{x:38,y:228}], 1.0, TILE.DIRT, 0);

        this.placeCamp();
        this.placeWorldLandmarks();
        this.ensureDarkWoodsAtmosphereLandmarks?.();
        this.ensureSilkWebApproachDressing?.();
        this.ensureHiddenTreeCaveConcealment?.();
        this.ensureBanditsFallLandmark?.();
        this.ensureStoneHedgeRuinsLandmark?.();
        this.ensureStoneHedgeWaypointObject?.();
        this.ensureDarkWoodsMicroLandmarks?.();
        this.ensureDarkWoodsTerritorySignposts?.();
        this.applyDeadLanternTrailVariants?.();
        this.normalizeOverworldCollisionAndDensity();
        this.flattenOverworldWalkableTerrain?.();
        // Phase 20: seed overworld herbs after collision/terrain is finalized so
        // the isWalkable-based placement scan sees the final walkable map.
        this.ensureDarkWoodsOverworldHerbs?.();
        // V0.20.81: placed AFTER normalizeOverworldCollisionAndDensity for the same reason the herbs
        // are - that pass prunes objects, and placing the crossing before it left the road tiles
        // carved but the interactable silently removed. Caught by walking a fresh character to it.
        DR.normalizeWaterDepthsForMap?.(this.map);
        // V0.20.80: Dark Woods is now stored as a NAMED overworld zone rather than "the" overworld.
        // The two assignments below still work identically (overworldMap/Objects are accessors onto
        // the active slot, which is dark_woods here), but going through the registry also marks the
        // slot generated, which is what lets travel know the zone is ready.
        this.activeOverworldZoneId = 'dark_woods';
        this.storeOverworldZone?.('dark_woods', this.map, this.objects);
        this.overworldMap = this.map;
        this.overworldObjects = this.objects;
        // V0.20.87: these run AFTER storeOverworldZone, not before it. Both target the dark_woods slot
        // BY NAME (the V0.20.81 lesson), and inside generateMap that slot still holds the PREVIOUS
        // grids until the store above swaps them in - so calling them earlier wrote the props into a
        // grid that was then thrown away. Silent: the functions ran, reported success, and the objects
        // simply were not in the world.
        this.ensureAshenValleyRoadLink?.();
        // The Dead Lantern waypoint is deliberately NOT placed here: ensureStartingCampRevamp runs
        // later (game.js) and clears the camp ellipse, so anything placed here is discarded. It is
        // called from game.js immediately after that pass instead.
        this.buildCaveMap();
        this.staticMinimap = this.buildStaticMinimap();
      };

      // V0.17.42 Phase 3: Dark Woods named subregion + level-band lookup.
      // Geography data lives in data/default-zones.js
      // (DR.DEFAULT_WORLD.zones.dark_woods.regions) so it sits alongside the
      // rest of the zone's descriptor metadata instead of a new data file.
      // 'box' regions are checked before the 'ring' fallback bands and win on
      // overlap; the three ring bands are ordered innermost-first and never
      // overlap each other, so exactly one region always matches any
      // in-bounds Dark Woods coordinate.
      Game.prototype.getDarkWoodsRegionAt = function(x, y) {
        const regions = DR.DEFAULT_WORLD?.zones?.dark_woods?.regions;
        if (!Array.isArray(regions)) return null;
        for (const region of regions) {
          if (region.shape === 'box') {
            if (x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2) return region;
          } else if (region.shape === 'ring') {
            const d = Math.hypot(x - region.cx, y - region.cy);
            if (d >= region.rMin && d < region.rMax) return region;
          }
        }
        return null;
      };

      Game.prototype.getDarkWoodsRegionLevelRange = function(x, y) {
        const region = this.getDarkWoodsRegionAt(x, y);
        if (!region) return { levelMin: 1, levelMax: 10 };
        return { levelMin: region.levelMin, levelMax: region.levelMax };
      };

      // V0.17.52 Phase 13 (Terrain Tile Detail + Overlays): shared depth
      // factor for render/terrain-renderer.js, derived from the Phase 3
      // region level bands rather than a new distance formula (reuses
      // existing, already-tuned geography instead of duplicating it).
      // 0 at level <=3 (Dead Lantern Outskirts, and any other starter-safe
      // reading) so the starter area is guaranteed unaffected; ramps to 1 at
      // level 10 (Gloamroot Depths / Silk Web Approach). Coordinate-pure and
      // cheap (getDarkWoodsRegionAt is a ~6-entry linear scan), safe to call
      // once per cached chunk-tile bake or per live structural-pass tile.
      Game.prototype.darkWoodsDepthFactor = function(x, y) {
        const { levelMax } = this.getDarkWoodsRegionLevelRange(x, y);
        return Math.max(0, Math.min(1, (levelMax - 3) / 7));
      };

      // V0.17.43 Phase 4: Dead Lantern Trail. Rather than hand-assigning a
      // variant at each of the ~24 existing lanternPost placement call sites
      // scattered across placeCamp/placeWorldLandmarks/
      // ensureDarkWoodsAtmosphereLandmarks, this single pass runs after all of
      // them and assigns a variant by looking up the region each lantern
      // actually landed in (Phase 3's getDarkWoodsRegionAt). Any lantern that
      // already has an explicit obj.variant set is left untouched.
      Game.prototype.applyDeadLanternTrailVariants = function() {
        if (!Array.isArray(this.objects)) return 0;
        const variantForRegion = {
          silk_web_approach: 'webbed',
          bandits_fall: 'bandit',
          gloamroot_depths: 'wisp',
          bramblefen_thicket: 'broken'
        };
        let updated = 0;
        for (let y = 0; y < this.objects.length; y++) {
          const row = this.objects[y];
          if (!Array.isArray(row)) continue;
          for (let x = 0; x < row.length; x++) {
            const obj = row[x];
            if (!obj || obj.type !== 'lanternPost' || obj.variant) continue;
            const region = this.getDarkWoodsRegionAt?.(x, y);
            obj.variant = variantForRegion[region?.id] || 'intact';
            updated += 1;
          }
        }
        return updated;
      };

      // V0.17.45 Phase 6 (Silk Web Cavern Exterior + Approach): scatter spider-
      // territory dressing across the silk_web_approach region box (Phase 3),
      // deterministically seeded by tile coordinate (not per-frame random, same
      // pattern as the sparse forest dressing in placeWorldLandmarks). Skips
      // water, already-occupied tiles, and a ring around the actual cave mouth
      // so the entrance stays clear and readable. Runs after
      // ensureDarkWoodsAtmosphereLandmarks (which places the cave entrance
      // itself) so this dressing is never overwritten by the entrance-clearing
      // pass, and before normalizeOverworldCollisionAndDensity so the usual
      // solid/decorOnly pass still applies to whatever gets placed here.
      Game.prototype.ensureSilkWebApproachDressing = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        const region = (DR.DEFAULT_WORLD?.zones?.dark_woods?.regions || []).find(r => r.id === 'silk_web_approach');
        if (!region || region.shape !== 'box') return 0;
        const caveEntrance = DR.CAVE_BY_ID?.silk_web_cavern?.entrance || { x: 52, y: 139 };
        const caveX = caveEntrance.x, caveY = caveEntrance.y;
        const clearRadius = 10;
        let placed = 0;
        for (let y = region.y1; y <= region.y2; y++) {
          for (let x = region.x1; x <= region.x2; x++) {
            if (!this.map[y]?.[x] || this.objects[y]?.[x]) continue;
            const tile = this.map[y][x];
            if (tile.type === TILE.WATER || tile.blocked) continue;
            if (Math.hypot(x - caveX, y - caveY) < clearRadius) continue;
            const r = seededNoise(x, y, 552201);
            if (r > 0.965) this.placeObject(x, y, 'webbedBush', {}, false);
            else if (r > 0.950) this.placeObject(x, y, 'thornBush', {}, false);
            else if (r > 0.940) this.placeObject(x, y, 'deadTree', { variant: Math.floor(r * 97) % 9, webbed: true }, true);
            else if (r > 0.932) this.placeObject(x, y, 'bones', {}, false);
            else if (r > 0.926) this.placeObject(x, y, 'brokenWeapon', { weaponKind: r > 0.929 ? 'spear' : 'sword', angle: (r * 12) % 1.4 }, false);
            else if (r > 0.921) this.placeObject(x, y, 'silkCocoon', { cocoonType: 'corpse' }, false);
            else if (r > 0.916) this.placeObject(x, y, 'caveWeb', {}, false);
            else continue;
            placed += 1;
          }
        }
        return placed;
      };

      // V0.17.47 Phase 8 (Hidden Tree Cave Exterior + Interior): concealment
      // ring around the Hidden Tree Cave entrance (mossfang_cave, id kept for
      // save-schema compatibility - see Phase 5). Unlike Silk Web Approach,
      // this cave has no dedicated region box (Phase 3), so concealment is
      // placed as a fixed-radius ring directly around the entrance instead of
      // scanning a region. Same ordering rationale as
      // ensureSilkWebApproachDressing: runs after the entrance-clearing pass
      // and before normalizeOverworldCollisionAndDensity. The inner ring
      // (radius 8-11, just outside the ~7.8-tile entrance clearing) is denser
      // and includes large blocking props so the mouth reads as tucked behind
      // foliage rather than standing in an open clearing; the outer ring
      // (11-20) is sparser general concealment.
      Game.prototype.ensureHiddenTreeCaveConcealment = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        const caveEntrance = DR.CAVE_BY_ID?.mossfang_cave?.entrance || { x: 76, y: 74 };
        const caveX = caveEntrance.x, caveY = caveEntrance.y;
        const innerMin = 8, innerMax = 11, outerMax = 20;
        let placed = 0;
        for (let y = caveY - outerMax; y <= caveY + outerMax; y++) {
          for (let x = caveX - outerMax; x <= caveX + outerMax; x++) {
            if (!this.map[y]?.[x] || this.objects[y]?.[x]) continue;
            const tile = this.map[y][x];
            if (tile.type === TILE.WATER || tile.blocked) continue;
            const d = Math.hypot(x - caveX, y - caveY);
            if (d < innerMin || d > outerMax) continue;
            const inner = d <= innerMax;
            const r = seededNoise(x, y, 774411);
            if (inner) {
              if (r > 0.90) this.placeObject(x, y, 'tree', { variant: Math.floor(r * 97) % 9, scale: 1.1 + r * 0.24, hue: seededNoise(x, y, 774412), mossy: true }, true);
              else if (r > 0.80) this.placeObject(x, y, 'rootArch', { variant: Math.floor(r * 97) % 4 }, true);
              else if (r > 0.66) this.placeObject(x, y, 'brush', {}, false);
              else if (r > 0.56) this.placeObject(x, y, 'hangingRoots', {}, false);
              else if (r > 0.50) this.placeObject(x, y, 'grassTuft', {}, false);
              else continue;
            } else {
              if (r > 0.94) this.placeObject(x, y, 'tree', { variant: Math.floor(r * 97) % 9, scale: 0.95 + r * 0.3, hue: seededNoise(x, y, 774412), mossy: r > 0.97 }, true);
              else if (r > 0.90) this.placeObject(x, y, 'brush', {}, false);
              else if (r > 0.87) this.placeObject(x, y, 'hangingRoots', {}, false);
              else if (r > 0.83) this.placeObject(x, y, 'grassTuft', {}, false);
              else continue;
            }
            placed += 1;
          }
        }
        return placed;
      };

      // V0.17.48 Phase 9 (Old Ruins / Bandit Area): Bandit's Fall landmark.
      // Placed in fresh territory added by the Phase 2 resize (center 230,60)
      // rather than the pre-existing Ashroot Hollow/Blackroot Catacombs ruin
      // remnants near x137-178 (left standing by Phase 5) - that area is
      // already dense with unrelated pre-Phase-3 mob camps/anchors (wolves,
      // duskwisps, ashroot horrors, a named rare) with enforced minimum
      // spacing; building a full authored ruin+camp layout there risked
      // overlapping several of them. This landmark gets a clean canvas while
      // still sitting fully inside the bandits_fall region box (Phase 3:
      // x130-280, y10-110). Layout: an outer broken wall ring with a single
      // south entry gap flanked by barricades, a central ruined structure
      // (arch + pillars, one fallen), two flanking rubble pockets with
      // partial walls for line-of-sight breaks, and a bandit camp clutter
      // spread across the interior courtyard.
      Game.prototype.ensureBanditsFallLandmark = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        const cx = 230, cy = 60;
        let placed = 0;
        const put = (dx, dy, type, extra = {}, blocked = false) => {
          const x = cx + dx, y = cy + dy;
          if (!this.map[y]?.[x]) return;
          this.placeObject(x, y, type, extra, blocked);
          placed += 1;
        };

        // Outer broken wall ring (rough rectangle, ~19x15 half-extents) with a
        // south entry gap between dx -4..4 at dy +15.
        const ringPoints = [];
        for (let dx = -18; dx <= 18; dx += 6) { ringPoints.push([dx, -15]); if (dx < -4 || dx > 4) ringPoints.push([dx, 15]); }
        for (let dy = -9; dy <= 9; dy += 6) { ringPoints.push([-18, dy]); ringPoints.push([18, dy]); }
        ringPoints.forEach(([dx, dy], i) => put(dx, dy, 'ruinWall', { mossy: i % 3 === 0, vines: i % 4 === 1 }, true));

        // Entry gap barricades (flanking the south opening, not blocking it).
        // dy 14 (not 15) so these sit just inside the gap rather than exactly
        // on top of the ring's own dx=-6/+6 wall segments at dy 15.
        put(-6, 14, 'barricade', {}, true);
        put(6, 14, 'barricade', {}, true);

        // Central ruined structure.
        put(0, -2, 'ruinArch', { broken: true }, true);
        put(-6, 2, 'ruinPillar', {}, true);
        put(6, 3, 'ruinPillar', { fallen: true, angle: 0.3 }, true);
        put(2, -6, 'ruinPillar', { fallen: true, angle: -0.5 }, true);

        // Side rubble pockets with partial walls for LOS breaks (ambush cover).
        put(-13, -6, 'ruinWall', { mossy: true }, true);
        put(-14, 2, 'rubble', { seed: 1 }, false);
        put(-11, 6, 'rubble', { seed: 2 }, false);
        put(13, -4, 'ruinWall', { vines: true }, true);
        put(14, 3, 'rubble', { seed: 3 }, false);
        put(12, 8, 'rubble', { seed: 4 }, false);

        // Bandit camp clutter, spread across the interior courtyard.
        put(-8, 8, 'crate', {}, true);
        put(-9, 10, 'crate', {}, true);
        put(-3, 9, 'barrel', {}, false);
        put(0, 11, 'barrel', {}, false);
        put(4, 9, 'sackPile', {}, false);
        put(7, 7, 'bedroll', { color: '#5c4a34' }, false);
        put(9, 10, 'bedroll', { color: '#4a3c2c' }, false);
        put(-2, 5, 'fire', { name: "Bandit's Fall Firepit" }, false);
        put(-4, 4, 'logSeat', { rotation: 0.2 }, false);
        put(2, 6, 'weaponRack', {}, true);
        put(-6, -2, 'brokenCart', {}, true);
        put(8, -3, 'ropeBundle', {}, false);
        put(-1, 12, 'sparringDummy', { variant: 1 }, true);

        return placed;
      };

      // V0.17.49 Phase 10 (Stone Hedge Ruins Static Landmark): static
      // standing-stone layout for the stone_hedge_clearing region box (Phase
      // 3: x130-250, y190-300). Center (210,250) sits ~14 tiles from the
      // Phase 4 road spur's endpoint (200,240), and comfortably clear of the
      // two Phase 4 lanterns already placed at (196,200)/(220,210) (both
      // 40+ tiles away). This phase is static dressing only: no waypoint
      // object and no wisps are placed here yet (Phase 11's job) - the
      // center is kept fully clear and ready for both. Ring stones use a
      // deliberately different grey-blue mossy-megalith palette from the
      // brown/tan bandit ruin masonry (Phase 9) so the two landmarks read as
      // distinct places, per this phase's own validation requirement.
      Game.prototype.ensureStoneHedgeRuinsLandmark = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        const cx = 210, cy = 250;
        let placed = 0;
        const put = (dx, dy, type, extra = {}, blocked = false) => {
          const x = Math.round(cx + dx), y = Math.round(cy + dy);
          if (!this.map[y]?.[x]) return;
          this.placeObject(x, y, type, extra, blocked);
          placed += 1;
        };

        // Partial stone ring: 12 evenly-spaced positions, radius 9, skipping
        // a ~90-degree arc facing the road entrance (toward -135deg, up-left)
        // so the circle reads as "partial" and the approach isn't blocked.
        const ringRadius = 9;
        const gapCenterAngle = -Math.PI * 0.75;
        const gapHalfWidth = Math.PI * 0.28;
        let stoneIndex = 0;
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          let diff = Math.atan2(Math.sin(angle - gapCenterAngle), Math.cos(angle - gapCenterAngle));
          if (Math.abs(diff) < gapHalfWidth) continue;
          const dx = Math.cos(angle) * ringRadius;
          const dy = Math.sin(angle) * ringRadius;
          const fallen = stoneIndex % 5 === 4;
          if (fallen) put(dx, dy, 'brokenSlab', { mossy: true }, false);
          else put(dx, dy, 'standingStone', { lean: (stoneIndex % 3 - 1) * 0.05, mossy: stoneIndex % 2 === 0, rune: stoneIndex % 3 === 0, phase: stoneIndex * 0.6 }, true);
          stoneIndex += 1;
        }

        // Inner rune stones (radius 5) and drifting magic residue, kept
        // outside the innermost ~4-tile radius that stays clear for the
        // future waypoint.
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + 0.3;
          put(Math.cos(angle) * 5, Math.sin(angle) * 5, 'runeStone', { phase: i * 0.8 }, false);
        }
        put(0, -5.5, 'magicResidue', { phase: 0 }, false);
        put(4, 3.5, 'magicResidue', { phase: 1.4 }, false);
        put(-4, 3.5, 'magicResidue', { phase: 2.8 }, false);

        // A couple of scattered broken slabs and moss-covered stones just
        // outside the main ring, as if pieces toppled outward over time.
        put(-12, -3, 'brokenSlab', { mossy: true }, false);
        put(12, 6, 'rock', {}, true);
        put(-11, 8, 'rock', {}, true);

        return placed;
      };

      // V0.17.50 Phase 11 (Wisps + Waypoint Integration): places the actual
      // waypoint object in the exact center of the Phase 10 stone ring
      // (210,250), which was deliberately left clear for this. A separate
      // function from ensureStoneHedgeRuinsLandmark so each phase's
      // contribution stays its own clean diff. blocked:false is required -
      // the player must be able to stand on the waypoint tile itself.
      // Interaction/attunement logic lives in systems/waypoint-system.js
      // (new file, this phase) - this function only places the visual prop.
      // V0.20.81: the walked road out of Dark Woods to Ashen Valley. Without this the new zone was
      // unreachable in normal play - see data/default-zones.js DR.ZONE_LINKS for the closed loop this
      // breaks. Placed at the far east of the map so the crossing sits in Gloamroot Depths (levels
      // 7-10), a deliberate difficulty step into a level 10-20 region.
      Game.prototype.ensureAshenValleyRoadLink = function() {
        const link = (DR.ZONE_LINKS || []).find(l => l.id === 'dark_woods_east_pass');
        if (!link) return 0;

        // Operates on the DARK WOODS SLOT BY NAME, not on this.map/this.objects.
        //
        // During a saved-world load the zone grids are populated before the live map is assigned, so
        // an earlier version of this function ran, found this.map still empty, and returned 0 without
        // doing anything - which meant the road existed only in brand-new worlds and every existing
        // save had no way into Ashen Valley. Confirmed by instrumenting the load: the function was
        // called, and did nothing.
        //
        // Same shape as the waypoint that was nearly placed in the wrong zone: a helper reaching for
        // "whatever is active" instead of the thing it actually means.
        const zone = this.overworldZoneSlot?.('dark_woods');
        const map = Array.isArray(zone?.map) ? zone.map : this.map;
        const objects = Array.isArray(zone?.objects) ? zone.objects : this.objects;
        if (!Array.isArray(map) || !Array.isArray(objects)) return 0;

        const size = map.length;
        const x = Math.min(size - 2, Math.max(1, link.fromX));
        const y = Math.min(size - 2, Math.max(1, link.fromY));
        if (!map[y]?.[x]) return 0;

        // V0.20.82: CUT A GATE THROUGH THE BOUNDARY TREE WALL.
        //
        // ensureDarkWoodsTreeWallBoundary rings the entire map in impassable trees - every tile within
        // 4 of the edge is blocked, elevated and given a boundaryTreeWall object. The V0.20.81 crossing
        // sat at x=344, FIFTEEN tiles inside that wall, so it read as a signpost standing in the woods
        // with the treeline still solid beyond it. There was no visible way out.
        //
        // The road now runs from inside the forest, THROUGH the wall, to the map edge. Because this
        // function runs after the wall is built (it is called late in generateMap, and again on world
        // load), the gate is cut into a wall that already exists rather than racing it.
        const TILEREF = DR.TILE || {};
        const gateHalfHeight = 1;                 // 3 tiles tall - a track, not a boulevard
        for (let ty = y - gateHalfHeight; ty <= y + gateHalfHeight; ty++) {
          for (let tx = x - 26; tx <= size - 1; tx++) {
            const tile = map[ty]?.[tx];
            if (!tile) continue;
            tile.type = TILEREF.DIRT ?? tile.type;
            tile.elev = 0;
            tile.blocked = false;
            tile.waterDepth = 0;
            // Clears the boundary trees too - they are objects, and leaving them would keep the gap
            // impassable no matter what the tile says.
            if (objects[ty]) objects[ty][tx] = null;
            delete tile.darkWoodsBoundaryWall;
          }
        }

        // Dress the gate mouth so it reads as a deliberate opening rather than a hole someone forgot
        // to fill: the flanking trees stay, and a pair of markers frame the road.
        // Decor yields to the markers; anything authored and meaningful does not. The first version
        // only allowed replacing empty ground or boundary trees, which silently placed nothing at all
        // because a flower and a mushroom happened to be sitting there.
        const YIELDS = new Set(['flower', 'mushroom', 'grassTuft', 'brush', 'glowMushroom', 'rootCluster']);
        for (const my of [y - gateHalfHeight - 1, y + gateHalfHeight + 1]) {
          if (!objects[my] || !map[my]?.[x]) continue;
          const marker = objects[my][x];
          if (marker && !marker.boundaryTreeWall && !YIELDS.has(marker.type)) continue;
          objects[my][x] = { type: 'standingStone', blocked: true, name: 'Valley Road Marker' };
          map[my][x].blocked = true;
        }

        // Written directly rather than through placeObject, which targets this.objects - the ACTIVE
        // zone - and would put the crossing in whichever zone happens to be loaded.
        objects[y][x] = {
          type: 'zoneLink',
          interactionType: 'zoneLink',
          zoneLinkId: link.id,
          name: link.name,
          interactLabel: `Travel to ${DR.DEFAULT_WORLD?.zones?.[link.toZone]?.name || link.toZone}`,
          toZone: link.toZone,
          blocked: false
        };
        return 1;
      };

      // V0.20.87: Dead Lantern Camp waypoint. Written the same way as the Ashen Valley road link and
      // for the same reasons learned there: it targets the DARK WOODS SLOT BY NAME rather than
      // this.map/this.objects (during a saved-world load the zone grids exist before the live map is
      // assigned, so a this.map-based version runs and silently does nothing), and it is called AFTER
      // the object-pruning pass, or the prop is deleted immediately after being placed.
      Game.prototype.ensureDeadLanternWaypointObject = function() {
        const zone = this.overworldZoneSlot?.('dark_woods');
        const map = Array.isArray(zone?.map) ? zone.map : this.map;
        const objects = Array.isArray(zone?.objects) ? zone.objects : this.objects;
        if (!Array.isArray(map) || !Array.isArray(objects)) return 0;
        const x = 106, y = 105;
        if (!map[y]?.[x]) return 0;

        // Clear a small apron so the dais is not drawn through a bush, and so players can gather on it
        // (spec 5.3 wants the waypoint to be a natural gathering point, which needs standing room).
        for (let ty = y - 2; ty <= y + 2; ty++) {
          for (let tx = x - 2; tx <= x + 2; tx++) {
            const tile = map[ty]?.[tx];
            if (!tile) continue;
            if (tile.waterDepth > 0) continue;
            tile.blocked = false;
            if (objects[ty] && objects[ty][tx] && tx !== x && ty !== y) objects[ty][tx] = null;
          }
        }

        objects[y][x] = {
          type: 'waypoint',
          interactionType: 'waypoint',
          waypointId: 'dead_lantern_waypoint',
          name: 'Dead Lantern Waypoint',
          interactLabel: 'Attune Waypoint',
          attuned: !!this.player?.unlockedWaypoints?.includes('dead_lantern_waypoint'),
          blocked: false
        };
        return 1;
      };

      Game.prototype.ensureStoneHedgeWaypointObject = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        const x = 210, y = 250;
        if (!this.map[y]?.[x]) return 0;
        const attuned = !!this.player?.unlockedWaypoints?.includes('stone_hedge_waypoint');
        this.placeObject(x, y, 'waypoint', {
          waypointId: 'stone_hedge_waypoint',
          name: 'Stone Hedge Waypoint',
          interactionType: 'waypoint',
          interactLabel: 'Attune Waypoint',
          attuned
        }, false);
        return 1;
      };

      // V0.17.54 Phase 15 (Micro-Landmarks + Environmental Storytelling):
      // 4 small authored micro-landmarks + 4 authored story scenes, per the
      // master plan. Each is a small, mostly non-blocking hand-placed prop
      // cluster (not a full landmark complex like Bandit's Fall/Stone Hedge)
      // - reuses existing props (fire+dead flag, bedroll+color, brokenCart,
      // crate, silkCocoon corpse, caveWeb, well+mossy, glowMushroom,
      // rootArch, standingStone) wherever a fit already existed, and only
      // the 6 new small Phase 15 props (hunterTrap/coinPouch/candleCluster/
      // tornCloak/bloodTrail/archerPlatform, see object-renderer.js) for
      // things nothing else covered. Coordinates were chosen (and verified
      // by a standalone Node distance sweep against every dark_woods mob
      // spawn anchor and existing landmark, not just eyeballed) to sit
      // outside the zone's dense pre-existing camp/anchor clutter so each
      // scene reads as its own vignette instead of overlapping a mob spawn.
      // V0.17.59 Phase 20 (Dark Woods Overworld Herbs): deterministically seed
      // the 5 overworld-only herb nodes into the dark_woods resource grid. The
      // overworld map is fully deterministic (generateMap uses only
      // seededNoise, no Math.random), so this terrain scan picks identical,
      // terrain-valid coordinates every run and is idempotent (a herb type is
      // skipped entirely if any node of it already exists, covering
      // save-reload where the persisted grid already has them). Placement is
      // region-driven off the Phase 3 region geometry (getDarkWoodsRegionAt):
      // Lantern Moss in Dead Lantern Outskirts, Thornberry in Bramblefen,
      // Gloomcap in the mid/deep forest rings, Wispbloom around Stone Hedge
      // (kept clear of the waypoint centre), and rare Blackroot only in
      // Gloamroot Depths well away from town. Called from the generateMap
      // sequence (new games) and from rebuildWorldRuntimeAfterWorldLoad (after
      // a saved editorResources is applied, so existing saves get them too).
      Game.prototype.ensureDarkWoodsOverworldHerbs = function() {
        const TILE = DR.TILE || {};
        const map = this.map;
        // Only seed against the 360-tile overworld map (caves/dungeons are 200).
        if (!Array.isArray(map) || map.length < 300) return 0;
        if (this.currentZone === 'cave' || this.currentZone === 'dungeon') return 0;
        if (!this.editorResources || typeof this.editorResources !== 'object') this.editorResources = { dark_woods: {}, mossfang_cave: {} };
        if (!this.editorResources.dark_woods) this.editorResources.dark_woods = {};
        const grid = this.editorResources.dark_woods;
        const size = Math.min(map.length, this.activeMapSize?.() || map.length);
        const startX = DR.CONFIG?.START_X ?? 100;
        const startY = DR.CONFIG?.START_Y ?? 100;
        const wpX = 210, wpY = 250; // Stone Hedge waypoint centre (Phase 11)
        const GROUND = new Set([TILE.DEEP_GRASS, TILE.DARK_GRASS, TILE.FOREST_FLOOR, TILE.DIRT, TILE.UNDERBRUSH]);
        const hash = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
        const buildNode = (type, x, y) => {
          const def = DR.RESOURCE_BY_ID?.[type] || {};
          return {
            id: `${type}_dark_woods_${x}_${y}`, type, name: def.name || type,
            category: def.category || 'herb', profession: def.profession || 'gathering',
            skill: def.skill || 'Gathering', tool: def.tool || 'Hands',
            levelRequired: def.levelRequired || 1, gatherTimeSeconds: def.gatherTimeSeconds || null,
            xpReward: def.xpReward || null, color: def.color || '#8fd6a0', label: def.label || 'H',
            x, y, zoneId: 'dark_woods', respawnSeconds: def.respawnSeconds || 180,
            drops: JSON.parse(JSON.stringify(def.drops || [])),
            rareDrops: JSON.parse(JSON.stringify(def.rareDrops || [])),
            rareNodeXpBonus: def.rareNodeXpBonus || 0,
            lootTableId: def.lootTableId || null,
            note: def.note || 'Dark Woods overworld herb node.'
          };
        };
        const specs = [
          { type: 'herb_lantern_moss',      count: 5, box: [58, 58, 142, 142], minTown: 14, region: 'dead_lantern_outskirts', spacing: 6 },
          { type: 'herb_thornberry',        count: 4, box: [4, 4, 200, 200], minTown: 44, region: 'bramblefen_thicket', spacing: 8 },
          { type: 'herb_gloomcap_mushroom', count: 4, box: [4, 4, 224, 224], minTown: 56, maxTown: 120, regionSet: ['bramblefen_thicket', 'gloamroot_depths'], spacing: 10 },
          { type: 'herb_wispbloom',         count: 3, box: [130, 190, 250, 300], region: 'stone_hedge_clearing', minWaypoint: 9, spacing: 10 },
          { type: 'herb_blackroot',         count: 2, box: [4, 4, size - 5, size - 5], minTown: 116, region: 'gloamroot_depths', spacing: 22 }
        ];
        let added = 0;
        for (let si = 0; si < specs.length; si++) {
          const spec = specs[si];
          let already = false;
          for (const n of Object.values(grid)) { if (String(n && (n.type || n.id) || '').toLowerCase() === spec.type) { already = true; break; } }
          if (already) continue;
          const bx0 = Math.max(4, spec.box[0]), by0 = Math.max(4, spec.box[1]);
          const bx1 = Math.min(size - 5, spec.box[2]), by1 = Math.min(size - 5, spec.box[3]);
          const candidates = [];
          for (let y = by0; y <= by1; y += 2) {
            for (let x = bx0; x <= bx1; x += 2) {
              const dTown = Math.hypot(x - startX, y - startY);
              if (spec.minTown && dTown < spec.minTown) continue;
              if (spec.maxTown && dTown > spec.maxTown) continue;
              const tile = map[y] && map[y][x];
              if (!tile || !GROUND.has(tile.type)) continue;
              const region = this.getDarkWoodsRegionAt(x, y);
              if (spec.region) { if (!region || region.id !== spec.region) continue; }
              else if (spec.regionSet) { if (!region || spec.regionSet.indexOf(region.id) < 0) continue; }
              if (spec.minWaypoint && Math.hypot(x - wpX, y - wpY) < spec.minWaypoint) continue;
              if (grid[`${x},${y}`]) continue;
              if (!this.isWalkable(x + 0.5, y + 0.5)) continue;
              candidates.push({ x, y, h: hash(x, y, si + 1) });
            }
          }
          candidates.sort((a, b) => a.h - b.h);
          const placed = [];
          for (let i = 0; i < candidates.length && placed.length < spec.count; i++) {
            const c = candidates[i];
            let ok = true;
            for (const p of placed) { if (Math.hypot(p.x - c.x, p.y - c.y) < spec.spacing) { ok = false; break; } }
            if (!ok) continue;
            placed.push(c);
          }
          for (const p of placed) {
            const key = `${p.x},${p.y}`;
            if (grid[key]) continue;
            grid[key] = buildNode(spec.type, p.x, p.y);
            added++;
          }
        }
        if (added) this.worldSaveDirty = true;
        return added;
      };

      // V0.17.60 Phase 21 (Silk Web Cavern Herbs): seed the 3 dungeon-only herbs
      // into a per-floor Silk Web resource grid (editorResources['silk_web_cavern:F<n>'],
      // read by the dungeon-aware gathering zoneKey). Placed relative to the
      // deterministic SILK_WEB_FLOOR_CONFIG rooms so positions - and therefore the
      // wall-clock respawn/depletion keys - stay stable across runs. Called at the
      // end of loadDungeonFloor. Idempotent per (type,room), so re-entering a floor
      // never duplicates nodes and keeps respawn timers meaningful. Webcap on the
      // early/mid floors, Widow's Veil deeper, Queen's Silkroot only in the final
      // deep chamber of floor 3.
      Game.prototype.ensureSilkWebCavernHerbs = function(dungeon, floor) {
        if (!dungeon || String(dungeon.id || '') !== 'silk_web_cavern') return 0;
        const TILE = DR.TILE || {};
        const map = this.dungeonMap || this.map;
        const objects = this.dungeonObjects || this.objects;
        if (!Array.isArray(map) || !map.length) return 0;
        const rooms = Array.isArray(this.dungeonRooms) ? this.dungeonRooms : [];
        if (!rooms.length) return 0;
        const fl = Math.max(1, Math.floor(Number(floor) || 1));
        const key = `silk_web_cavern:F${fl}`;
        if (!this.editorResources || typeof this.editorResources !== 'object') this.editorResources = { dark_woods: {}, mossfang_cave: {} };
        if (!this.editorResources[key]) this.editorResources[key] = {};
        const grid = this.editorResources[key];
        const buildNode = (type, x, y) => {
          const def = DR.RESOURCE_BY_ID?.[type] || {};
          return {
            id: `${type}_silk_web_cavern_f${fl}_${x}_${y}`, type, name: def.name || type,
            category: def.category || 'herb', profession: def.profession || 'gathering',
            skill: def.skill || 'Gathering', tool: def.tool || 'Hands',
            levelRequired: def.levelRequired || 1, gatherTimeSeconds: def.gatherTimeSeconds || null,
            xpReward: def.xpReward || null, color: def.color || '#b48cd6', label: def.label || 'H',
            x, y, zoneId: key, respawnSeconds: def.respawnSeconds || 240,
            drops: JSON.parse(JSON.stringify(def.drops || [])),
            rareDrops: JSON.parse(JSON.stringify(def.rareDrops || [])),
            rareNodeXpBonus: def.rareNodeXpBonus || 0,
            lootTableId: def.lootTableId || null,
            note: def.note || 'Silk Web Cavern herb node.'
          };
        };
        // Deterministic ring scan for a walkable cave-floor tile near a room
        // centre, skipping tiles already holding a dungeon object (stairs/webs/etc).
        const findSpot = (cx, cy, maxR) => {
          const bx = Math.floor(cx), by = Math.floor(cy);
          for (let r = 0; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const x = bx + dx, y = by + dy;
                const tile = map[y] && map[y][x];
                if (!tile || tile.type !== TILE.CAVE_FLOOR || tile.blocked) continue;
                if (objects && objects[y] && objects[y][x]) continue;
                if (grid[`${x},${y}`]) continue;
                if (typeof this.isWalkable === 'function' && !this.isWalkable(x + 0.5, y + 0.5)) continue;
                return { x, y };
              }
            }
          }
          return null;
        };
        const roomAt = frac => rooms[Math.min(rooms.length - 1, Math.max(0, Math.round(frac * (rooms.length - 1))))];
        const bossRoom = rooms.find(r => String(r.kind || '') === 'boss') || null;
        const plan = [];
        if (fl === 1) {
          plan.push(['herb_webcap_fungus', roomAt(0.25)]);
          plan.push(['herb_webcap_fungus', roomAt(0.45)]);
          plan.push(['herb_webcap_fungus', roomAt(0.65)]);
        } else if (fl === 2) {
          plan.push(['herb_webcap_fungus', roomAt(0.3)]);
          plan.push(['herb_webcap_fungus', roomAt(0.5)]);
          plan.push(['herb_widows_veil', roomAt(0.7)]);
          plan.push(['herb_widows_veil', roomAt(0.85)]);
        } else {
          plan.push(['herb_widows_veil', roomAt(0.4)]);
          plan.push(['herb_widows_veil', roomAt(0.6)]);
          plan.push(['herb_queens_silkroot', bossRoom || roomAt(0.82)]);
        }
        let added = 0;
        for (const [type, room] of plan) {
          if (!room) continue;
          // Idempotent across re-entries: skip if a node of this type already sits
          // near this room (positions can micro-shift if random dressing changed).
          let dup = false;
          for (const n of Object.values(grid)) {
            if (String(n && n.type || '').toLowerCase() === type && Math.hypot((n.x || 0) - room.x, (n.y || 0) - room.y) < 12) { dup = true; break; }
          }
          if (dup) continue;
          const spot = findSpot(room.x, room.y, 8);
          if (!spot) continue;
          const k = `${spot.x},${spot.y}`;
          if (grid[k]) continue;
          grid[k] = buildNode(type, spot.x, spot.y);
          added++;
        }
        return added;
      };

      Game.prototype.ensureDarkWoodsMicroLandmarks = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        let placed = 0;
        const scene = (cx, cy, radius, props) => {
          if (!this.map[cy]?.[cx]) return;
          this.flattenArea(cx, cy, radius, TILE.DARK_GRASS, 0);
          for (const p of props) {
            this.placeObject(cx + p.dx, cy + p.dy, p.type, p.obj || {}, !!p.blocked);
            placed += 1;
          }
        };

        // --- Micro-landmarks ---

        // Abandoned Hunter Camp (Bramblefen Thicket) - a burned-out camp
        // with signs the hunter never came back: dead fire, torn bedroll,
        // a snapped bow, an empty trap, and a blood trail leading away.
        scene(150, 155, 6, [
          { dx: 0, dy: 0, type: 'fire', obj: { dead: true } },
          { dx: 2, dy: -1, type: 'bedroll', obj: { color: '#5c5245', rotation: 0.35 } },
          { dx: -2, dy: 2, type: 'brokenWeapon', obj: { weaponKind: 'bow', angle: 1.1 } },
          { dx: -4, dy: 4, type: 'hunterTrap' },
          { dx: 4, dy: 2, type: 'bloodTrail', obj: { variant: 3 } },
          { dx: 6, dy: 3, type: 'bloodTrail', obj: { variant: 7 } }
        ]);

        // Old Forest Well (Dead Lantern Outskirts, beside the NW pond) -
        // moss-covered, still usable-looking, with a rare mushroom cluster
        // nearby. No quest object/day-night wisp wired up (Phase 17/quest
        // systems own that, out of this phase's scope - see report).
        scene(110, 72, 5, [
          { dx: 0, dy: 0, type: 'well', obj: { mossy: true }, blocked: true },
          { dx: 3, dy: 2, type: 'glowMushroom' },
          { dx: -3, dy: -2, type: 'mushroom' }
        ]);

        // Collapsed Watch Post (Bandit's Fall outskirts) - a satellite
        // lookout post separate from the main ruin, staffed by a lone scout
        // watching the northern approach.
        scene(260, 40, 6, [
          { dx: 0, dy: 0, type: 'archerPlatform', blocked: true },
          { dx: -3, dy: 2, type: 'crate', blocked: true },
          { dx: 3, dy: -1, type: 'sackPile' }
        ]);

        // Root Shrine (Gloamroot Depths) - a stone idol wrapped in giant
        // roots. Rare herb/quest-hook wiring is deferred to Phases 19-20/25
        // (the resource and quest systems don't exist yet); this phase adds
        // the visual landmark and a lone spirit encounter only.
        scene(100, 220, 6, [
          { dx: 0, dy: 0, type: 'standingStone', obj: { rune: false, mossy: true }, blocked: true },
          { dx: -3, dy: 1, type: 'rootArch', obj: { variant: 1 }, blocked: true },
          { dx: 3, dy: -2, type: 'hangingRoots' },
          { dx: 0, dy: 3, type: 'flower' }
        ]);

        // --- Environmental storytelling scenes ---

        // Bandit Ambush Remains (Bandit's Fall approach road) - a raided
        // wagon, scattered stolen crates, and an arrow-riddled tree.
        scene(195, 80, 6, [
          { dx: 0, dy: 0, type: 'brokenCart', blocked: true },
          { dx: -3, dy: 2, type: 'crate', blocked: true },
          { dx: 3, dy: 1, type: 'sackPile' },
          { dx: 2, dy: -3, type: 'tree', obj: { variant: 2 }, blocked: true },
          { dx: 3, dy: -4, type: 'brokenWeapon', obj: { weaponKind: 'arrow', angle: -1.3 } },
          { dx: 1, dy: -2, type: 'coinPouch' }
        ]);

        // Failed Spider Hunt (Silk Web Approach, well clear of the cave
        // entrance's own 10-tile ring from Phase 6) - a hunter's spear
        // caught in webbing, a wrapped corpse, a torn cloak, and a cold
        // campfire.
        scene(25, 175, 6, [
          { dx: 0, dy: 0, type: 'caveWeb' },
          { dx: 2, dy: -1, type: 'brokenWeapon', obj: { weaponKind: 'spear', angle: 0.2 } },
          { dx: -3, dy: 2, type: 'silkCocoon', obj: { cocoonType: 'corpse' } },
          { dx: -2, dy: -3, type: 'tornCloak', obj: { color: '#4a3f56' } },
          { dx: 4, dy: 3, type: 'fire', obj: { dead: true } }
        ]);

        // Lost Pilgrim Shrine (Dead Lantern Outskirts) - a small roadside
        // marker with melted candles, overgrown flowers, and a faint
        // magical residue in place of an animated glow (Phase 12's aura
        // pipeline is reserved for the Stone Hedge waypoint; a second
        // full VFX aura here would be out of this phase's surgical scope).
        scene(84, 102, 4, [
          { dx: 0, dy: 0, type: 'standingStone', obj: { rune: false, mossy: false }, blocked: true },
          { dx: 1, dy: 1, type: 'candleCluster' },
          { dx: -2, dy: 1, type: 'flower' },
          { dx: 2, dy: -1, type: 'flower' },
          { dx: 0, dy: 2, type: 'magicResidue', obj: { color: '#c9b8e8' } }
        ]);

        // Old Road Collapse (near the Phase 4 Stone Hedge spur, between the
        // {196,200} and {220,210} lantern waypoints) - a broken road section
        // with roots overtaking the path.
        scene(208, 205, 5, [
          { dx: 0, dy: 0, type: 'rubble' },
          { dx: 2, dy: 1, type: 'rootCluster' },
          { dx: -2, dy: -1, type: 'rootCluster' },
          { dx: 3, dy: -2, type: 'rubble' }
        ]);

        // V0.17.88 quest [21]: the Silk Web expedition camp at the cave mouth
        // (52,145) - where Liora/Tamsin/Oren came FROM. Three tents (one
        // shredded, half-packed), a cold fire, and six webbed cocoons - five
        // dead, one still breathing (the survivor of quest [22]). Cocoon prop
        // coords match the DR.INTERACT_POINTS 'approach_cocoon' points.
        scene(52, 145, 7, [
          { dx: 0, dy: 0, type: 'tent', blocked: true },
          { dx: -3, dy: -1, type: 'tent', obj: { shredded: true }, blocked: true },
          { dx: 3, dy: 0, type: 'tent', blocked: true },
          { dx: 1, dy: 2, type: 'fire', obj: { dead: true } },
          { dx: -2, dy: -2, type: 'silkCocoon', obj: { cocoonType: 'corpse' } },
          { dx: 2, dy: -2, type: 'silkCocoon', obj: { cocoonType: 'corpse' } },
          { dx: -3, dy: 1, type: 'silkCocoon', obj: { cocoonType: 'corpse' } },
          { dx: 3, dy: 1, type: 'silkCocoon', obj: { cocoonType: 'corpse' } },
          { dx: -1, dy: 3, type: 'silkCocoon', obj: { cocoonType: 'corpse' } },
          { dx: 1, dy: -4, type: 'silkCocoon', obj: { cocoonType: 'survivor' } }
        ]);

        return placed;
      };

      // V0.17.55 Phase 16 (Creature Territory Signposting + Ambient Life):
      // wires up Game.prototype.getDarkWoodsRegionAt's identity.signpostProps
      // field, which has existed as dormant metadata since Phase 3
      // (V0.17.42) and was never read anywhere until now - grepped the whole
      // codebase to confirm before writing this. Scatters each region's own
      // named signpost props at low density (density and seed distinct from,
      // and much sparser than, both the Phase 14 sparse forest-dressing pass
      // and the Phase 6/9 region-specific dressing passes) across that
      // region so a player gets a small warning before running into the
      // matching mob family. dead_lantern_outskirts's 'lanternPost' entry is
      // skipped - that region's signage is already fully owned by the Phase
      // 4 Dead Lantern Trail system, adding more here would just duplicate
      // it. Reuses existing props for every signpost name that already had
      // one (brokenWeapon+arrow kind from Phase 15, magicResidue from
      // Phase 10, webbedBush from Phase 6, eggCluster from the dungeon
      // system, rootCluster from Phase 14); only 'clawMarks' had no existing
      // prop and got one small new decal (see object-renderer.js).
      Game.prototype.ensureDarkWoodsTerritorySignposts = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return 0;
        const regions = DR.DEFAULT_WORLD?.zones?.dark_woods?.regions;
        if (!Array.isArray(regions) || !regions.some(r => Array.isArray(r.identity?.signpostProps))) return 0;

        const signMakers = {
          brokenArrow: (r) => ({ type: 'brokenWeapon', obj: { weaponKind: 'arrow', angle: r * 6.28 }, blocked: false }),
          floatingMote: () => ({ type: 'magicResidue', obj: { color: '#8fc8ff' }, blocked: false }),
          webbedBush: () => ({ type: 'webbedBush', obj: {}, blocked: false }),
          eggSac: () => ({ type: 'eggCluster', obj: {}, blocked: false }),
          clawMarks: () => ({ type: 'clawMarks', obj: {}, blocked: false }),
          heavyRoots: () => ({ type: 'rootCluster', obj: {}, blocked: false })
        };

        const boundsSize = this.activeMapSize?.() || CONFIG.OVERWORLD_MAP_SIZE || CONFIG.MAP_SIZE;
        let placed = 0;
        for (let y = 4; y < boundsSize - 4; y++) {
          for (let x = 4; x < boundsSize - 4; x++) {
            const tile = this.map[y][x];
            if (!tile || tile.type === TILE.WATER || tile.blocked || this.objects[y][x]) continue;
            const region = this.getDarkWoodsRegionAt?.(x, y);
            const names = region?.identity?.signpostProps;
            if (!Array.isArray(names) || !names.length) continue;
            const usable = names.filter(n => n !== 'lanternPost' && signMakers[n]);
            if (!usable.length) continue;
            const r = seededNoise(x, y, 161601);
            if (r < 0.988) continue;
            const pick = usable[Math.floor(seededNoise(x, y, 161602) * usable.length) % usable.length];
            const spec = signMakers[pick](r);
            this.placeObject(x, y, spec.type, spec.obj, spec.blocked);
            placed += 1;
          }
        }
        return placed;
      };

            Game.prototype.placeCamp = function() {
        const clearAndSet = (x, y, type, elev = 0) => {
          if (!this.map[y]?.[x]) return;
          this.map[y][x].type = type;
          this.map[y][x].elev = elev;
          this.map[y][x].blocked = !TILE_DEF[type].walk;
          this.objects[y][x] = null;
        };
        const campCenter = { x: 100, y: 100 };

        // V0.15.49 Dark Woods compact outpost: the old wide Dead Lantern camp
        // footprint was a sprawling settlement.  The authored camp is now a
        // small, readable outpost with a tight dirt pad, slim approach paths,
        // exactly five spaced tents, and no fences or extra buildings.
        for (let y = 74; y <= 126; y++) {
          for (let x = 72; x <= 130; x++) {
            if (!this.map[y]?.[x]) continue;
            const oldCampTile = this.map[y][x].type === TILE.CAMP || this.map[y][x].type === TILE.DIRT;
            const oldCampObject = this.objects[y]?.[x]?.startingCamp || this.objects[y]?.[x]?.campObject;
            const dx = (x - campCenter.x) / 1.35;
            const dy = (y - campCenter.y) / 1.05;
            const compact = Math.hypot((x - campCenter.x) / 11.4, (y - campCenter.y) / 9.2) <= 1.0;
            if ((oldCampTile || oldCampObject) && !compact && Math.hypot(dx, dy) < 24.5) {
              clearAndSet(x, y, TILE.FOREST_FLOOR, 0);
            }
            if (compact) clearAndSet(x, y, Math.hypot((x - campCenter.x) / 7.2, (y - campCenter.y) / 5.8) <= 1.0 ? TILE.CAMP : TILE.DIRT, 0);
          }
        }

        const carveLocalPath = (points, radius = 1.05, type = TILE.DIRT) => {
          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              const cx = a.x + (b.x - a.x) * t;
              const cy = a.y + (b.y - a.y) * t;
              for (let yy = Math.floor(cy - radius - 1); yy <= Math.ceil(cy + radius + 1); yy++) {
                for (let xx = Math.floor(cx - radius - 1); xx <= Math.ceil(cx + radius + 1); xx++) {
                  if (!this.map[yy]?.[xx]) continue;
                  if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= radius) clearAndSet(xx, yy, type, 0);
                }
              }
            }
          }
        };

        // Four narrow approaches keep the tiny outpost connected without expanding
        // the camp body back into a settlement-sized clearing.
        carveLocalPath([{x:100,y:100},{x:91,y:100},{x:82,y:96}], 1.05, TILE.DIRT);
        carveLocalPath([{x:100,y:100},{x:110,y:100},{x:119,y:104}], 1.05, TILE.DIRT);
        carveLocalPath([{x:100,y:100},{x:100,y:91},{x:94,y:85}], 0.95, TILE.DIRT);
        carveLocalPath([{x:100,y:100},{x:99,y:109},{x:93,y:116}], 0.95, TILE.DIRT);

        const placements = [
          // Exactly five tents: no lean-tos, no stalls, no house/shop/odd buildings, no fences.
          { x: 91, y: 91, type: 'tent', name: 'Northwest Watch Tent', scale: 1.58, blocked: true },
          { x: 109, y: 91, type: 'tent', name: 'Northeast Study Tent', scale: 1.58, blocked: true },
          { x: 90, y: 109, type: 'tent', name: 'Southwest Supply Tent', scale: 1.54, blocked: true },
          { x: 110, y: 109, type: 'tent', name: 'Southeast Guard Tent', scale: 1.54, blocked: true },
          { x: 100, y: 114, type: 'tent', name: 'Southern Rest Tent', scale: 1.50, blocked: true },

          // Small non-building camp dressing kept compact and walkable.
          { x: 100, y: 101, type: 'fire', name: 'Dark Woods Campfire', scale: 1.08, blocked: false },
          { x: 102, y: 101, type: 'cookingSpit', name: 'Cooking Spit', scale: 0.88, blocked: false },
          { x: 97, y: 101, type: 'logSeat', name: 'Campfire Log Seat', rotation: -0.18, blocked: false },
          { x: 103, y: 104, type: 'logSeat', name: 'Campfire Log Seat', rotation: 0.22, blocked: false },
          { x: 98, y: 106, type: 'bedroll', name: 'Rolled Bedroll', color: '#7c664a', blocked: false },
          { x: 94, y: 95, type: 'lanternPost', name: 'West Camp Lantern', phase: 0.2, blocked: false },
          { x: 106, y: 95, type: 'lanternPost', name: 'East Camp Lantern', phase: 1.4, blocked: false },
          { x: 95, y: 108, type: 'lanternPost', name: 'Southwest Camp Lantern', phase: 2.6, blocked: false },
          { x: 105, y: 108, type: 'lanternPost', name: 'Southeast Camp Lantern', phase: 3.8, blocked: false },
          { x: 92, y: 101, type: 'grassTuft', name: 'Trampled Camp Grass', blocked: false },
          { x: 108, y: 102, type: 'grassTuft', name: 'Trampled Camp Grass', blocked: false },
          { x: 99, y: 95, type: 'flower', name: 'Medicinal Flowers', blocked: false },
          { x: 96, y: 98, type: 'stashChest', name: 'Camp Stash', scale: 1.35, blocked: false, stashAccess: true, interactionType: 'stash', interactLabel: 'Open Stash', permanentStorage: true }
        ];

        for (const p of placements) this.placeObject(p.x, p.y, p.type, { ...p, startingCamp: true, campObject: true }, p.blocked);
        this.ensureCampStashChest?.();
      };

      Game.prototype.placeObject = function(x, y, type, extra = {}, blocked = false) {
        const boundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        if (x < 0 || y < 0 || x >= boundsSize || y >= boundsSize) return;
        if (!this.map[y]?.[x]) return;
        this.objects[y][x] = { type, ...extra };
        if (blocked) this.map[y][x].blocked = true;
      };

      Game.prototype.ensureCampStashChest = function() {
        const map = this.overworldMap || (this.currentZone === 'overworld' ? this.map : null);
        const objects = this.overworldObjects || (this.currentZone === 'overworld' ? this.objects : null);
        if (!Array.isArray(map) || !Array.isArray(objects)) return false;
        const campX = Math.round(window.DreamRealms?.CONFIG?.START_X || 100);
        const campY = Math.round(window.DreamRealms?.CONFIG?.START_Y || 100);
        const x = Math.max(2, Math.min((map[0]?.length || CONFIG.MAP_SIZE) - 3, campX - 4));
        const y = Math.max(2, Math.min((map.length || CONFIG.MAP_SIZE) - 3, campY - 2));
        if (!objects[y]) objects[y] = [];
        objects[y][x] = {
          type: 'stashChest',
          name: 'Camp Stash',
          scale: 1.35,
          blocked: false,
          stashAccess: true,
          interactionType: 'stash',
          interactLabel: 'Open Stash',
          permanentStorage: true,
          startingCamp: true,
          campObject: true,
          x,
          y
        };
        if (map[y]?.[x]) map[y][x].blocked = false;
        if (this.currentZone === 'overworld') {
          this.objects = objects;
          this.map = map;
        }
        this.mapDirty = true;
        return true;
      };

      Game.prototype.ensureDarkWoodsTreeWallBoundary = function() {
        if (!Array.isArray(this.map) || !Array.isArray(this.objects)) return false;
        const size = this.map.length || CONFIG.MAP_SIZE;
        if (size <= 0) return false;
        const wallDepth = 4;
        const fogDepth = 7;
        const visualTypes = ['tree', 'tree', 'tree', 'deadTree', 'rootArch'];
        let placed = 0;

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const edgeDist = Math.min(x, y, size - 1 - x, size - 1 - y);
            if (edgeDist > fogDepth) continue;
            const tile = this.map[y]?.[x];
            if (!tile) continue;

            const n = typeof seededNoise === 'function' ? seededNoise(x, y, 151504) : ((x * 17 + y * 31) % 100) / 100;
            if (edgeDist <= wallDepth) {
              tile.type = edgeDist <= 1 ? TILE.UNDERBRUSH : (n > 0.58 ? TILE.DEEP_GRASS : TILE.FOREST_FLOOR);
              tile.elev = Math.max(tile.elev || 0, edgeDist <= 1 ? 3 : 2);
              tile.blocked = true;
              tile.darkWoodsBoundaryWall = true;

              const variant = Math.floor((n * 97 + x * 3 + y * 5) % 11);
              const type = edgeDist <= 1
                ? 'tree'
                : (n > 0.84 ? 'rootArch' : visualTypes[variant % visualTypes.length]);
              const scaleBase = edgeDist <= 1 ? 1.24 : edgeDist === 2 ? 1.12 : 1.02;
              this.objects[y][x] = {
                type,
                variant,
                scale: scaleBase + (typeof seededNoise === 'function' ? seededNoise(x, y, 151505) * 0.22 : 0),
                hue: typeof seededNoise === 'function' ? seededNoise(x, y, 151506) : n,
                blocked: true,
                boundaryTreeWall: true,
                name: 'Dark Woods Boundary Trees'
              };
              placed += 1;
            } else if (!this.objects[y]?.[x] && tile.type !== TILE.WATER) {
              // Soft inner fringe so the hard edge reads as dense foliage instead of an invisible wall.
              if (n > 0.56) this.objects[y][x] = { type: n > 0.82 ? 'brush' : 'grassTuft', boundaryFoliage: true, name: 'Boundary Foliage' };
            }
          }
        }
        return placed > 0;
      };

            Game.prototype.ensureDarkWoodsAtmosphereLandmarks = function() {
        const savedMap = this.map;
        const savedObjects = this.objects;
        const map = this.overworldMap || (this.currentZone === 'overworld' ? this.map : null);
        const objects = this.overworldObjects || (this.currentZone === 'overworld' ? this.objects : null);
        if (!Array.isArray(map) || !Array.isArray(objects)) return false;
        this.map = map;
        this.objects = objects;

        const placeIfClear = (x, y, type, extra = {}, blocked = false) => {
          if (!this.map[y]?.[x] || !this.objects[y]) return false;
          if (this.map[y][x].type === TILE.WATER) return false;
          const existing = this.objects[y][x];
          if (existing && !['grassTuft', 'flower', 'mushroom', 'brush', 'glowMushroom'].includes(existing.type)) return false;
          this.placeObject(x, y, type, extra, blocked);
          return true;
        };

        // Atmosphere pass for the regenerated layout: lights on routes, glow in groves,
        // dead/ash silhouettes in dangerous outer regions.
        for (const p of [
          {x:93,y:104,phase:0.1}, {x:88,y:109,phase:0.7}, {x:83,y:114,phase:1.2},
          {x:92,y:91,phase:1.8}, {x:84,y:82,phase:2.4}, {x:113,y:91,phase:3.0},
          {x:127,y:80,phase:3.6}, {x:121,y:111,phase:4.2}, {x:141,y:118,phase:4.8},
          {x:71,y:132,phase:5.4}
        ]) placeIfClear(p.x, p.y, 'lanternPost', { phase: p.phase }, false);

        for (const p of [
          {x:43,y:141}, {x:60,y:132}, {x:115,y:56}, {x:150,y:90}, {x:92,y:143},
          {x:151,y:128}, {x:166,y:132}, {x:182,y:160}, {x:74,y:151}
        ]) placeIfClear(p.x, p.y, 'glowMushroom', {}, false);

        for (const p of [
          {x:64,y:94,variant:0}, {x:60,y:132,variant:1}, {x:132,y:146,variant:2}
        ]) placeIfClear(p.x, p.y, 'rootArch', { variant: p.variant }, true);

        for (const p of [
          {x:164,y:45,type:'deadTree',variant:0}, {x:176,y:84,type:'deadTree',variant:1},
          {x:36,y:166,type:'deadTree',variant:2}, {x:178,y:57,type:'ashStump'},
          {x:182,y:160,type:'ashStump'}, {x:34,y:154,type:'ashStump'},
          {x:152,y:44,type:'deadTree',variant:1}, {x:188,y:112,type:'deadTree',variant:0}
        ]) placeIfClear(p.x, p.y, p.type, { variant: p.variant || 0 }, p.type === 'deadTree');

        if (savedMap) this.map = savedMap;
        if (savedObjects) this.objects = savedObjects;
        if (this.currentZone === 'overworld') {
          this.map = this.overworldMap || this.map;
          this.objects = this.overworldObjects || this.objects;
        }
        this.ensureDarkWoodsCaveEntrances?.();
        return true;
      };


      Game.prototype.flattenOverworldWalkableTerrain = function(map = null) {
        const TILE = DR.TILE || window.TILE || {};
        const TILE_DEF = DR.TILE_DEF || window.TILE_DEF || {};
        const targetMap = map || this.overworldMap || (this.currentZone === 'overworld' ? this.map : null);
        if (!targetMap?.length) return false;
        let changed = false;
        for (let y = 0; y < targetMap.length; y++) {
          for (let x = 0; x < (targetMap[y]?.length || 0); x++) {
            const tile = targetMap[y]?.[x];
            if (!tile) continue;
            const def = TILE_DEF[tile.type] || {};
            if (def.walk || tile.type === TILE.WATER) {
              if ((Number(tile.elev) || 0) !== 0) changed = true;
              tile.elev = 0;
              if (tile.type === TILE.WATER) {
                tile.waterSurfaceElev = 0;
                tile.waterBottomElev = -Math.max(5, Number(tile.waterDepth) || 5);
              }
            }
          }
        }
        if (changed) {
          this.mapDirty = true;
          if (this.terrainCache) this.terrainCache.invalidated = true;
        }
        return changed;
      };

      Game.prototype.flattenArea = function(cx, cy, radius, tileType, elev = 0) {
        for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
          for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
            if (!this.map[y]?.[x]) continue;
            const d = Math.hypot(x - cx, y - cy);
            if (d > radius) continue;
            this.map[y][x].type = tileType;
            this.map[y][x].elev = elev;
            this.map[y][x].blocked = !TILE_DEF[tileType].walk;
            this.objects[y][x] = null;
          }
        }
      };

            Game.prototype.placeWorldLandmarks = function() {
        const paintArea = (cx, cy, radius, type, elev = 0) => this.flattenArea(cx, cy, radius, type, elev);
        const roadLanterns = [
          {x:94,y:104}, {x:89,y:108}, {x:84,y:113}, {x:92,y:91}, {x:84,y:82},
          {x:113,y:91}, {x:127,y:80}, {x:121,y:111}, {x:141,y:118}, {x:71,y:132},
          // V0.17.43 Phase 4: Dead Lantern Trail markers along the new Stone
          // Hedge / Gloamroot spurs (variant assigned by region afterward).
          {x:182,y:158}, {x:196,y:200}, {x:220,y:210}, {x:260,y:250}
        ];

        // V0.15.49: remove the old secondary hamlet/watch-camp clutter near the starter route.
        // The starter outpost is intentionally the only built camp footprint in this area.
        // Nearby route identity is preserved with natural ground dressing instead of houses, stalls, or fences.
        for (const p of [
          {x:79,y:121,type:'flower',blocked:false}, {x:73,y:112,type:'grassTuft',blocked:false},
          {x:121,y:111,type:'grassTuft',blocked:false}, {x:127,y:110,type:'flower',blocked:false}
        ]) this.placeObject(p.x, p.y, p.type, { variant: p.variant || 0 }, p.blocked);

        // North-east ruined road / Ashroot landmark.
        for (const p of [
          {x:137,y:65,type:'ruinWall',blocked:true}, {x:138,y:65,type:'ruinWall',blocked:true},
          {x:144,y:68,type:'ruinPillar',blocked:true}, {x:146,y:72,type:'ruinWall',blocked:true},
          {x:140,y:73,type:'ruinPillar',blocked:true}, {x:142,y:67,type:'mushroom',blocked:false},
          {x:135,y:71,type:'rock',blocked:true}, {x:148,y:64,type:'deadTree',blocked:true}
        ]) this.placeObject(p.x, p.y, p.type, {}, p.blocked);

        // Crystal lake landmark.
        for (const p of [
          {x:155,y:114,type:'crystalNode',blocked:false}, {x:163,y:116,type:'crystalNode',blocked:false},
          {x:170,y:124,type:'rock',blocked:true}, {x:151,y:128,type:'glowMushroom',blocked:false},
          {x:166,y:132,type:'glowMushroom',blocked:false}, {x:158,y:134,type:'banner',blocked:false}
        ]) this.placeObject(p.x, p.y, p.type, {}, p.blocked);

        // Spider marsh landmark.
        for (const p of [
          {x:47,y:136,type:'caveWeb',blocked:false}, {x:55,y:136,type:'caveWeb',blocked:false},
          {x:50,y:146,type:'caveWeb',blocked:false}, {x:58,y:143,type:'bones',blocked:false},
          {x:43,y:141,type:'glowMushroom',blocked:false}, {x:60,y:132,type:'rootArch',blocked:true}
        ]) this.placeObject(p.x, p.y, p.type, {}, p.blocked);

        // Forgotten Mine shelf.
        for (const p of [
          {x:60,y:166,type:'mineSupport',blocked:true}, {x:69,y:166,type:'mineSupport',blocked:true},
          {x:57,y:174,type:'rock',blocked:true}, {x:72,y:176,type:'rock',blocked:true},
          {x:64,y:164,type:'crate',blocked:true}, {x:68,y:171,type:'oreNode',blocked:false}
        ]) this.placeObject(p.x, p.y, p.type, {}, p.blocked);

        // Blackroot Catacombs upper ridge.
        for (const p of [
          {x:164,y:45,type:'ruinWall',blocked:true}, {x:169,y:44,type:'ruinPillar',blocked:true},
          {x:176,y:50,type:'ruinWall',blocked:true}, {x:171,y:55,type:'bones',blocked:false},
          {x:161,y:53,type:'deadTree',blocked:true}, {x:178,y:57,type:'ashStump',blocked:false}
        ]) this.placeObject(p.x, p.y, p.type, {}, p.blocked);

        // Lanterns and small landmarks along the new route network.
        for (const p of roadLanterns) this.placeObject(p.x, p.y, 'lanternPost', { phase: (p.x + p.y) * 0.13 }, false);

        // V0.17.43 Phase 4: a couple of hand-placed variant examples off the
        // main line (explicit obj.variant, so applyDeadLanternTrailVariants
        // leaves them alone) - a lantern toppled by something in the deep
        // Gloamroot side path, and one bent from age near the Stone Hedge spur.
        this.placeObject(265, 255, 'lanternPost', { phase: 0.5, variant: 'fallen' }, false);
        this.placeObject(192, 205, 'lanternPost', { phase: 2.1, variant: 'hanging' }, false);

        // Gloomheart Tree: major Dark Woods landmark, roughly 5 tiles wide by 7 tiles tall.
        const evilTreeX = 150;
        const evilTreeY = 88;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const tx = evilTreeX + dx;
            const ty = evilTreeY + dy;
            if (!this.map[ty]?.[tx]) continue;
            const rootBand = Math.abs(dx) === 2 || Math.abs(dy) >= 2;
            this.map[ty][tx].type = rootBand ? TILE.UNDERBRUSH : TILE.FOREST_FLOOR;
            this.map[ty][tx].elev = Math.max(this.map[ty][tx].elev || 0, rootBand ? 1 : 2);
            this.map[ty][tx].blocked = Math.abs(dx) <= 1 && Math.abs(dy) <= 2;
            this.objects[ty][tx] = null;
          }
        }
        for (const p of [
          {x:evilTreeX - 3,y:evilTreeY - 1,type:'rootArch',variant:2,blocked:true},
          {x:evilTreeX + 3,y:evilTreeY + 1,type:'rootArch',variant:3,blocked:true},
          {x:evilTreeX - 4,y:evilTreeY + 4,type:'glowMushroom',blocked:false},
          {x:evilTreeX + 4,y:evilTreeY - 3,type:'deadTree',variant:4,blocked:true}
        ]) this.placeObject(p.x, p.y, p.type, { variant: p.variant || 0 }, p.blocked);
        this.placeObject(evilTreeX, evilTreeY, 'evilTree', { scale: 1.2, landmark: true, name: 'Gloomheart Tree' }, true);
        for (const p of [
          {x:64,y:94,type:'rootArch',variant:0,blocked:true}, {x:132,y:146,type:'rootArch',variant:1,blocked:true},
          {x:176,y:84,type:'deadTree',variant:2,blocked:true}, {x:36,y:166,type:'deadTree',variant:1,blocked:true},
          {x:115,y:56,type:'glowMushroom',blocked:false}, {x:150,y:90,type:'glowMushroom',blocked:false},
          {x:92,y:143,type:'glowMushroom',blocked:false}, {x:182,y:160,type:'ashStump',blocked:false}
        ]) this.placeObject(p.x, p.y, p.type, { variant: p.variant || 0 }, p.blocked);

        // Sparse forest dressing after major routes are carved.
        const dressingSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        for (let y = 4; y < dressingSize - 4; y++) {
          for (let x = 4; x < dressingSize - 4; x++) {
            const tile = this.map[y][x];
            if (!tile || tile.type === TILE.WATER || tile.type === TILE.CAMP || tile.type === TILE.DIRT || this.objects[y][x]) continue;
            const dStart = Math.hypot(x - CONFIG.START_X, y - CONFIG.START_Y);
            if (dStart < 16) continue;
            const r = seededNoise(x, y, 123031);
            // V0.17.53 Phase 14 (Trees, Bushes, Terrain Props): a second,
            // independent noise channel picks sub-variety (ancient/dead/
            // mossy/berry/etc.) without disturbing the density thresholds
            // above, and darkWoodsDepthFactor (Phase 13's region-derived
            // gradient, reused rather than a new distance calc) biases
            // variety toward the deeper, more dangerous regions.
            const r2 = seededNoise(x, y, 123032);
            const depth = this.darkWoodsDepthFactor?.(x, y) || 0;
            const forestFloor = tile.type === TILE.DARK_GRASS || tile.type === TILE.DEEP_GRASS || tile.type === TILE.FOREST_FLOOR;
            if (forestFloor && r > 0.952) {
              // Ancient is the rarer, more specific condition (narrower r2
              // range) so it must be checked before the broader dead-tree
              // range, otherwise dead-tree's r2 > 0.93 would always win first
              // and ancient could never trigger - caught by simulation.
              if (depth > 0.6 && r2 > 0.985) this.placeObject(x, y, 'tree', { variant: Math.floor(r * 97) % 9, ancient: true, hue: seededNoise(x, y, 123778) }, true);
              else if (depth > 0.55 && r2 > 0.93) this.placeObject(x, y, 'deadTree', { variant: Math.floor(r2 * 97) % 9, scale: 0.85 + r2 * 0.4 }, true);
              else this.placeObject(x, y, 'tree', { variant: Math.floor(r * 97) % 9, scale: 0.86 + seededNoise(x, y, 123777) * 0.38, hue: seededNoise(x, y, 123778), mossy: r2 < depth * 0.35 }, true);
            }
            else if (tile.type === TILE.UNDERBRUSH && r > 0.935) {
              const kind = depth < 0.3 && r2 > 0.8 ? (r2 > 0.9 ? 'flowering' : 'berry')
                : depth > 0.55 && r2 > 0.8 ? (r2 > 0.9 ? 'dead' : 'mossy')
                : 'default';
              this.placeObject(x, y, 'brush', { kind, scale: r2 > 0.96 ? 1.3 : 1 }, false);
            }
            else if (tile.type === TILE.STONE && r > 0.80) this.placeObject(x, y, 'rock', { mossy: r2 < depth * 0.4 }, true);
            else if (r > 0.885) this.placeObject(x, y, 'grassTuft', {}, false);
            else if (r > 0.862) this.placeObject(x, y, 'flower', {}, false);
            else if (r > 0.840) this.placeObject(x, y, 'mushroom', {}, false);
            else if (r > 0.822 && forestFloor) this.placeObject(x, y, 'fallenLog', { variant: Math.floor(r2 * 97) % 2, mossy: r2 < depth * 0.5 }, false);
            else if (r > 0.807) this.placeObject(x, y, 'rootCluster', {}, false);
            else if (r > 0.795 && depth > 0.3) this.placeObject(x, y, 'ashStump', { natural: true }, false);
            else if (depth > 0.6 && r2 > 0.994) this.placeObject(x, y, 'rootBarrier', {}, true);
          }
        }

        this.ensureDarkWoodsTreeWallBoundary?.();
        this.ensureDarkWoodsCaveEntrances?.();
      };

            Game.prototype.normalizeOverworldCollisionAndDensity = function() {
        const decorOnly = new Set(['grassTuft', 'flower', 'mushroom', 'brush', 'glowMushroom', 'ashStump', 'lanternPost', 'caveWeb', 'bones', 'crystalNode', 'oreNode', 'webbedBush', 'thornBush', 'brokenWeapon', 'silkCocoon', 'hangingRoots', 'rubble', 'barrel', 'sackPile', 'ropeBundle', 'brokenSlab', 'runeStone', 'magicResidue', 'waypoint', 'fallenLog', 'rootCluster', 'hunterTrap', 'coinPouch', 'candleCluster', 'tornCloak', 'bloodTrail', 'fire', 'eggCluster', 'clawMarks']);
        const solid = new Set(['tree', 'rock', 'tent', 'largeCampTent', 'vendorStall', 'crate', 'campStall', 'fence', 'townHouse', 'shop', 'well', 'ruinWall', 'ruinPillar', 'ruinArch', 'barricade', 'mercpost', 'deadTree', 'evilTree', 'rootArch', 'mineSupport', 'standingStone', 'rootBarrier', 'archerPlatform']);
        const normalizeSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        for (let y = 0; y < normalizeSize; y++) {
          for (let x = 0; x < normalizeSize; x++) {
            const tile = this.map[y][x];
            const obj = this.objects[y][x];
            tile.blocked = !TILE_DEF[tile.type].walk;
            if (obj && solid.has(obj.type)) tile.blocked = true;
            if (obj && decorOnly.has(obj.type) && !obj.boundaryTreeWall) tile.blocked = false;
            if (tile.darkWoodsBoundaryWall || obj?.boundaryTreeWall) tile.blocked = true;
            if (obj?.type === 'cave') tile.blocked = false;
          }
        }

        // Always keep the core spawn camp and route exits passable.
        for (let y = 88; y <= 112; y++) {
          for (let x = 88; x <= 112; x++) {
            if (!this.map[y]?.[x]) continue;
            if (Math.hypot((x - 100) / 1.2, y - 100) < 7.2 && !this.objects[y][x]?.blocked) {
              this.map[y][x].blocked = false;
            }
          }
        }
      };


      // Clears props that world generation dropped into open water, or onto single land tiles so
      // surrounded by it that they read as floating.
      //
      // TWO CATEGORIES, and the second is the one that matters visually. Censused on the shipped
      // overworld: only 2 props sit on an actual WATER tile (a glow mushroom and a lantern post
      // standing in a lake), but 12 more sit on slivers with 4 or more of their 8 neighbours water.
      // Those are what read as objects floating on the surface. The threshold stops at 4 on purpose:
      // rocks and flowers with 1-3 water neighbours are ordinary shoreline dressing - a rocky beach
      // beside a lake looked entirely correct in-world - and removing those would strip legitimate
      // detail. 16 rocks and 18 flowers touch water somewhere; only the slivers are wrong.
      //
      // THIS EDITS WORLD DATA rather than culling at render time, deliberately. A prop hidden by the
      // renderer would leave its collision behind, so a removed rock would become an invisible wall.
      // Blocking is restored from the TILE TYPE afterwards, not forced to false, so terrain that is
      // legitimately impassable stays that way.
      //
      // Runs at boot AFTER the saved world loads and after the camp/landmark passes, so it cleans
      // generated and saved worlds alike. Idempotent - a second run finds nothing.
      Game.prototype.ensureNoPropsInWater = function () {
        const map = this.map, objects = this.objects;
        if (!map?.length || !objects?.length) return null;
        const isWater = t => !!(t && t.type === TILE.WATER);
        const removed = {};
        let count = 0;

        for (let y = 0; y < objects.length; y++) {
          const row = objects[y];
          if (!row) continue;
          for (let x = 0; x < row.length; x++) {
            const obj = row[x];
            if (!obj) continue;
            const tile = map[y]?.[x];
            if (!tile) continue;

            let drop = isWater(tile);
            if (!drop) {
              let n = 0;
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (!dx && !dy) continue;
                  if (isWater(map[y + dy]?.[x + dx])) n++;
                }
              }
              drop = n >= 4;
            }
            if (!drop) continue;

            const type = String(obj.type || obj.kind || 'unknown');
            removed[type] = (removed[type] || 0) + 1;
            count++;
            row[x] = null;
            // Restore blocking from the terrain, so the prop's collision does not outlive it.
            const def = TILE_DEF[tile.type];
            if (def && def.walk) tile.blocked = false;
          }
        }

        this._propsClearedFromWater = { count, byType: removed };
        if (count) {
          const detail = Object.entries(removed).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} x${v}`).join(', ');
          console.info(`[Blackroot] cleared ${count} prop(s) from water: ${detail}`);
        }
        return this._propsClearedFromWater;
      };

      Game.prototype.ensureStartingCampRevamp = function() {
      if (!this.objects || !this.map?.length) return;
      const campX = Math.round(window.DreamRealms?.CONFIG?.START_X || 100);
      const campY = Math.round(window.DreamRealms?.CONFIG?.START_Y || 100);
      const blockedTypes = new Set(['tent']);
      const removeCampObjectTypes = new Set([
        'largeCampTent', 'campLeanTo', 'vendorStall', 'campStall', 'crate', 'fence',
        'townHouse', 'shop', 'well', 'mercpost', 'banner', 'flag', 'groundFlag',
        'trainerBanner', 'sparringDummy', 'weaponRack', 'supplyStack', 'studyTable',
        'ritualCircle', 'herbalistTable', 'forge', 'loom'
      ]);

      const compactTile = (x, y) => Math.hypot((x - campX) / 11.4, (y - campY) / 9.2) <= 1.0;
      const innerCampTile = (x, y) => Math.hypot((x - campX) / 7.2, (y - campY) / 5.8) <= 1.0;
      const clearAndSet = (x, y, type, elev = 0) => {
        if (!this.map[y]?.[x]) return;
        this.map[y][x].type = type;
        this.map[y][x].elev = elev;
        this.map[y][x].blocked = !TILE_DEF[type].walk;
        this.objects[y][x] = null;
      };

      // Normalize saved/loaded older camp state: clear the previous large clearing,
      // remove fences and extra buildings, then repaint only the compact outpost.
      for (let y = campY - 27; y <= campY + 27; y++) {
        if (!this.objects[y] || !this.map[y]) continue;
        for (let x = campX - 30; x <= campX + 30; x++) {
          const obj = this.objects[y]?.[x];
          const oldTile = this.map[y]?.[x]?.type === TILE.CAMP || this.map[y]?.[x]?.type === TILE.DIRT;
          const oldObject = obj && (obj.startingCamp || obj.campObject || removeCampObjectTypes.has(String(obj.type || '')) || String(obj.name || '').toLowerCase().includes('camp edge fence'));
          if ((oldTile || oldObject) && !compactTile(x, y)) clearAndSet(x, y, TILE.FOREST_FLOOR, 0);
          else if (oldObject) {
            this.objects[y][x] = null;
            if (this.map[y]?.[x]) this.map[y][x].blocked = false;
          }
          if (compactTile(x, y)) clearAndSet(x, y, innerCampTile(x, y) ? TILE.CAMP : TILE.DIRT, 0);
        }
      }

      const carveLocalPath = (points, radius = 1.05, type = TILE.DIRT) => {
        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i], b = points[i + 1];
          const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const cx = a.x + (b.x - a.x) * t;
            const cy = a.y + (b.y - a.y) * t;
            for (let yy = Math.floor(cy - radius - 1); yy <= Math.ceil(cy + radius + 1); yy++) {
              for (let xx = Math.floor(cx - radius - 1); xx <= Math.ceil(cx + radius + 1); xx++) {
                if (!this.map[yy]?.[xx]) continue;
                if (Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy) <= radius) clearAndSet(xx, yy, type, 0);
              }
            }
          }
        }
      };
      carveLocalPath([{x:campX,y:campY},{x:campX-9,y:campY},{x:campX-18,y:campY-4}], 1.05, TILE.DIRT);
      carveLocalPath([{x:campX,y:campY},{x:campX+10,y:campY},{x:campX+19,y:campY+4}], 1.05, TILE.DIRT);
      carveLocalPath([{x:campX,y:campY},{x:campX,y:campY-9},{x:campX-6,y:campY-15}], 0.95, TILE.DIRT);
      carveLocalPath([{x:campX,y:campY},{x:campX-1,y:campY+9},{x:campX-7,y:campY+16}], 0.95, TILE.DIRT);

      const placements = [
        { dx: -9, dy: -9, type: 'tent', name: 'Northwest Watch Tent', scale: 1.58, blocked: true },
        { dx: 9, dy: -9, type: 'tent', name: 'Northeast Study Tent', scale: 1.58, blocked: true },
        { dx: -10, dy: 9, type: 'tent', name: 'Southwest Supply Tent', scale: 1.54, blocked: true },
        { dx: 10, dy: 9, type: 'tent', name: 'Southeast Guard Tent', scale: 1.54, blocked: true },
        { dx: 0, dy: 14, type: 'tent', name: 'Southern Rest Tent', scale: 1.50, blocked: true },
        { dx: 0, dy: 1, type: 'fire', name: 'Dark Woods Campfire', scale: 1.08, blocked: false },
        { dx: 2, dy: 1, type: 'cookingSpit', name: 'Cooking Spit', scale: 0.88, blocked: false },
        { dx: -3, dy: 1, type: 'logSeat', name: 'Campfire Log Seat', rotation: -0.18, blocked: false },
        { dx: 3, dy: 4, type: 'logSeat', name: 'Campfire Log Seat', rotation: 0.22, blocked: false },
        { dx: -2, dy: 6, type: 'bedroll', name: 'Rolled Bedroll', color: '#7c664a', blocked: false },
        { dx: -6, dy: -5, type: 'lanternPost', name: 'West Camp Lantern', phase: 0.2, blocked: false },
        { dx: 6, dy: -5, type: 'lanternPost', name: 'East Camp Lantern', phase: 1.4, blocked: false },
        { dx: -5, dy: 8, type: 'lanternPost', name: 'Southwest Camp Lantern', phase: 2.6, blocked: false },
        { dx: 5, dy: 8, type: 'lanternPost', name: 'Southeast Camp Lantern', phase: 3.8, blocked: false },
        { dx: -1, dy: -5, type: 'flower', name: 'Medicinal Flowers', blocked: false },
        { dx: -4, dy: -2, type: 'stashChest', name: 'Camp Stash', scale: 1.35, blocked: false, stashAccess: true, interactionType: 'stash', interactLabel: 'Open Stash', permanentStorage: true },

        // V0.20.8 (Roadmap Item 2 - Dead Lantern Camp overhaul). The camp placed 16 objects: five
        // tents, a fire, a spit, two log seats, ONE bedroll, four lanterns, flowers and a stash. Item 2
        // asks for crates, barrels, weapon racks, storage piles, training areas, tables, medical and
        // food/water - of which there were ZERO. Every type below is one render/object-renderer.js
        // already draws (audited against its own case list), so nothing here is invented art.
        //
        // Placement is deliberate, per Item 2's NPC layout rules: supplies sit with the quartermaster,
        // the training gear with the marshal, the herb table with the healer, the study desk with the
        // arcane trainers, cookware with the cook. Every tile below was checked free of NPCs and of the
        // existing objects above, and only tents/lean-tos block, so the walking paths stay open.

        // Cooking area - around the fire (0,1), spit (2,1) and Camp Cook (2,2)
        { dx: 1, dy: 3, type: 'sackPile', name: 'Cook\'s Grain Sacks', blocked: false },
        { dx: 3, dy: 2, type: 'barrel', name: 'Water Barrel', blocked: false },
        { dx: -1, dy: 2, type: 'crate', name: 'Cook\'s Crate', blocked: false },
        { dx: -2, dy: 4, type: 'well', name: 'Camp Well', scale: 0.92, blocked: false },

        // Quartermaster's supply line - around Brann, moved to (7,2) off the merchant's tile
        { dx: 6, dy: 2, type: 'supplyStack', name: 'Quartermaster\'s Supply Stack', blocked: false },
        { dx: 8, dy: 1, type: 'crate', name: 'Supply Crate', blocked: false },
        { dx: 7, dy: 0, type: 'barrel', name: 'Salt Barrel', blocked: false },
        { dx: 8, dy: 2, type: 'sackPile', name: 'Ration Sacks', blocked: false },
        { dx: 5, dy: 0, type: 'campStall', name: 'Camp Trade Stall', scale: 1.0, blocked: false },

        // Training area - beside Marshal Corven (8,-2)
        { dx: 6, dy: -3, type: 'sparringDummy', name: 'Sparring Dummy', blocked: false },
        { dx: 7, dy: -4, type: 'weaponRack', name: 'Camp Weapon Rack', blocked: false },
        { dx: 5, dy: -3, type: 'brokenWeapon', name: 'Splintered Practice Blade', blocked: false },

        // Medical - beside Sister Liora (-5,1). V0.18.68 removed the Herbalist Table from camp and
        // deferred re-placing it to THIS item; this is that deferral paid off.
        { dx: -6, dy: 1, type: 'herbalistTable', name: 'Herbalist Table', blocked: false },
        { dx: -6, dy: 2, type: 'crate', name: 'Medical Supplies', blocked: false },

        // Study - beside the arcane trainers at (-5,-8) and (-8,-8)
        { dx: -7, dy: -7, type: 'studyTable', name: 'Study Table', blocked: false },
        { dx: -6, dy: -8, type: 'candleCluster', name: 'Study Candles', blocked: false },

        // Sleeping quarters - beside the existing bedroll (-2,6)
        { dx: -1, dy: 6, type: 'bedroll', name: 'Bedroll', color: '#7a6448', blocked: false },
        { dx: -3, dy: 6, type: 'bedroll', name: 'Bedroll', color: '#836a4c', blocked: false },
        { dx: -3, dy: 7, type: 'campLeanTo', name: 'Sleeping Lean-To', scale: 1.15, blocked: true },

        // Two more tents, kept inside the camp ellipse so they stand on camp ground, not forest floor
        { dx: -11, dy: -2, type: 'tent', name: 'West Supply Tent', scale: 1.5, blocked: true },
        { dx: 11, dy: -1, type: 'tent', name: 'East Sleeping Tent', scale: 1.5, blocked: true },

        // Torches on the approach paths, and the camp's colours
        { dx: -3, dy: -6, type: 'torch', name: 'Path Torch', blocked: false },
        { dx: 3, dy: -6, type: 'torch', name: 'Path Torch', blocked: false },
        { dx: 0, dy: -6, type: 'banner', name: 'Dead Lantern Banner', blocked: false },

        // Small clutter - the spec's "sacks, rope, tools, cookware, and firewood"
        { dx: 1, dy: -2, type: 'ropeBundle', name: 'Coiled Rope', blocked: false },
        { dx: -2, dy: -1, type: 'crate', name: 'Camp Crate', blocked: false }
      ];
      for (const p of placements) {
        const x = clamp(campX + p.dx, 2, this.map[0].length - 3);
        const y = clamp(campY + p.dy, 2, this.map.length - 3);
        this.objects[y] = this.objects[y] || [];
        this.objects[y][x] = { ...p, x, y, startingCamp: true, campObject: true };
        if (this.map[y]?.[x]) this.map[y][x].blocked = blockedTypes.has(p.type) || !!p.blocked;
      }
      this.ensureCampStashChest?.();
      this.ensureVendorNpc?.();
    };

    Game.prototype.ensureVendorNpc = function() {
      const campX = Math.round(window.DreamRealms?.CONFIG?.START_X || 100);
      const campY = Math.round(window.DreamRealms?.CONFIG?.START_Y || 100);
      this.editorNpcs = this.editorNpcs || {};
      this.editorNpcs.dark_woods = this.editorNpcs.dark_woods || {};
      const id = 'npc_dead_lantern_quartermaster';
      if (!this.editorNpcs.dark_woods[id]) {
        this.editorNpcs.dark_woods[id] = {
          id,
          name: 'Quartermaster Brann',
          title: 'Vendor',
          type: 'vendor',
          className: 'Fighter',
          // V0.20.8 (Roadmap Item 2): was campX + 6, campY - the EXACT tile npc-system.js:242 already
          // placed npc_camp_merchant on, so Brann and the Camp Merchant stood inside one another. Item 2
          // forbids that twice over ("prevent NPCs from spawning or standing on top of one another",
          // "no overlapping NPC coordinates"). Brann is the newer arrival, so Brann moves - and he moves
          // to his own supply line (the stack, crates, barrel and ration sacks placed above), which is
          // the same rule's other half: "vendors and service NPCs positioned near objects relevant to
          // their role."
          x: campX + 7,
          y: campY + 2,
          level: 1,
          hp: 100,
          mana: 0,
          dialogue: 'Buy, sell, and keep your pack light.',
          vendor: true,
          sellOnly: true
        };
      } else {
        // This branch re-asserts position on an ALREADY-SAVED camp, so it must carry the same move -
        // otherwise an existing save keeps Brann standing in the merchant forever.
        Object.assign(this.editorNpcs.dark_woods[id], {
          name: 'Quartermaster Brann',
          title: 'Vendor',
          type: 'vendor',
          vendor: true,
          sellOnly: true,
          x: campX + 7,
          y: campY + 2
        });
      }
      if (typeof this.spawnRuntimeNpcs === 'function') this.spawnRuntimeNpcs();
    };

    }
  };
})();
