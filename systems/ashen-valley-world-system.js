// Blackroot - Ashen Valley terrain generation (Roadmap Item 26, Phase 1).
//
// V0.20.80: generates the SECOND overworld zone. Deliberately a separate file from
// systems/world-system.js: that file is 1600 lines of Dark Woods-specific geography, and growing a
// second zone inside it would make both harder to change. Storage is owned by
// core/overworld-zone-registry.js; the zone's identity and subregion boxes are owned by
// data/default-zones.js. This file owns only "what do the tiles look like".
//
// The tile contract is matched to Dark Woods exactly - { type, elev, blocked, waterDepth } with
// blocked derived from TILE_DEF[type].walk - so collision, pathfinding, swimming, fishing, minimap and
// the renderer all work on this zone with no changes. Anything that reads a map does not need to know
// which zone it is looking at.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const ZONE_ID = 'ashen_valley';

  DR.AshenValleyWorldSystem = {
    install(Game) {
      const CONFIG = DR.CONFIG || {};
      const TILE = DR.TILE || {};
      const TILE_DEF = DR.TILE_DEF || {};
      const { smoothNoise } = DR.utils || {};

      Game.prototype.generateAshenValleyMap = function() {
        const def = DR.DEFAULT_WORLD?.zones?.[ZONE_ID];
        const size = Math.max(64, Math.floor(def?.width || 450));
        const map = new Array(size);
        const objects = new Array(size);

        const inBounds = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
        const tileDef = type => TILE_DEF[type] || TILE_DEF[TILE.DARK_GRASS];
        const noise = (x, y, scale, seed) => (typeof smoothNoise === 'function' ? smoothNoise(x, y, scale, seed) : 0.5);

        const setTile = (x, y, type, elev = null, clearObject = false) => {
          x = Math.floor(x); y = Math.floor(y);
          if (!inBounds(x, y)) return;
          const tile = map[y][x];
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
          if (clearObject) objects[y][x] = null;
        };

        const paintEllipse = (cx, cy, rx, ry, type, elevFn = null, clearObject = true) => {
          for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
            for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
              if (!inBounds(x, y)) continue;
              const nx = (x - cx) / Math.max(1, rx);
              const ny = (y - cy) / Math.max(1, ry);
              const d = nx * nx + ny * ny;
              if (d <= 1) setTile(x, y, type, typeof elevFn === 'function' ? elevFn(x, y, d) : elevFn, clearObject);
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

        // ---- Base terrain -------------------------------------------------------------------
        // Ashen Valley reads as a broad inhabited basin, not more Dark Woods: open grassland in the
        // middle and south where the farms and city sit, forest in the west, rising stone in the
        // north and east. Elevation is driven by distance from the valley floor so the highlands
        // genuinely climb rather than being flat tiles wearing a stone texture.
        const floorX = 250, floorY = 260;   // the low centre of the basin
        for (let y = 0; y < size; y++) {
          map[y] = new Array(size);
          objects[y] = new Array(size).fill(null);
          for (let x = 0; x < size; x++) {
            const n1 = noise(x, y, 30, 51071);
            const n2 = noise(x, y, 14, 51072);
            const n3 = noise(x, y, 7, 51073);
            const basin = Math.min(1, Math.hypot(x - floorX, y - floorY) / 250);

            let type = TILE.DARK_GRASS;
            if (n1 < 0.28) type = TILE.DEEP_GRASS;
            else if (n2 > 0.74) type = TILE.UNDERBRUSH;

            // West and north-west is the Ashwood: genuinely wooded.
            if (x < 175 && y < 245) type = n2 > 0.55 ? TILE.FOREST_FLOOR : (n1 < 0.34 ? TILE.DEEP_GRASS : TILE.DARK_GRASS);
            // North and east climb into the highlands and ruins.
            if ((y < 145 && x > 245) || (x > 305 && y < 285)) type = n1 > 0.55 ? TILE.STONE : (n3 > 0.62 ? TILE.UNDERBRUSH : TILE.DARK_GRASS);
            // The mine's shoulder in the far north-west.
            if (x < 135 && y < 115 && n1 > 0.6) type = TILE.STONE;
            // Cemetery ground reads dead and bare.
            if (x > 165 && x < 255 && y < 135) type = n2 > 0.58 ? TILE.DIRT : (n1 > 0.7 ? TILE.STONE : TILE.DARK_GRASS);

            // V0.20.94: elevation comes from LOW-FREQUENCY relief only. The first version floored
            // `basin * 2.6 + n2 * 1.7 + n3 * 0.7`, where n2 is noise at scale 14 and n3 at scale 7 -
            // high-frequency terms, so the floor flipped by one every couple of tiles. Measured, that
            // produced 107 elevation edges per 1,000 tiles against Dark Woods' 2, a FIFTY-THREE times
            // denser field of steps - and since one elevation unit is 28px, nearly half a tile, each
            // one is a full-height wall. The result was an endless hairline staircase that read as
            // floating slabs rather than terrain. The renderer was never at fault.
            //
            // n2/n3 still drive tile TYPE above, where per-tile variation is exactly what is wanted.
            let elev = 0;
            if (type !== TILE.WATER) {
              // The ridge term must NOT key off tile type: type is chosen from n1/n2/n3, the same
              // high-frequency noise just removed from elevation, so `type === STONE ? 1.35 : 0`
              // reintroduced per-tile churn through the back door. Measured, that alone kept the zone
              // at 67 edges per 1,000 tiles after the first fix. Highland mass is a smooth field.
              const highland = noise(x, y, 62, 51075);
              const upland = ((y < 150 && x > 250) || (x > 310 && y < 290)) ? 1 : 0;
              const ridge = upland * Math.max(0, highland - 0.35) * 3.4;
              const relief = noise(x, y, 46, 51074);
              elev = Math.max(0, Math.min(5, basin * 2.2 + relief * 1.9 + ridge - 0.75));
            }
            // Stored unrounded for now; a smoothing pass below flattens it into coherent plateaus
            // before it is floored, so a single noisy tile cannot punch a step through flat ground.
            map[y][x] = { type, elev, blocked: !tileDef(type).walk, waterDepth: 0 };
          }
        }

        // ---- Flatten elevation into plateaus -------------------------------------------------
        // Three box-blur passes over the continuous height, then floor. Blurring BEFORE flooring is what
        // creates broad flat ground with occasional real cliffs, instead of a step every time noise
        // crosses an integer boundary. Water stays at 0.
        for (let pass = 0; pass < 3; pass++) {
          const src = new Float32Array(size * size);
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) src[y * size + x] = map[y][x].elev;
          for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
              if (map[y][x].type === TILE.WATER) continue;
              let sum = 0, n = 0;
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                sum += src[(y + dy) * size + (x + dx)]; n++;
              }
              map[y][x].elev = sum / n;
            }
          }
        }
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const t = map[y][x];
            t.elev = t.type === TILE.WATER ? 0 : Math.max(0, Math.min(5, Math.round(t.elev)));
          }
        }

        // ---- The river ----------------------------------------------------------------------
        // The zone's spine: enters from the north-east highlands, runs past the city, and drains
        // into the marsh in the south-east. The Riverlands and Marsh subregions are defined around it.
        carveWaterPath([
          { x: 404, y: 96 }, { x: 380, y: 160 }, { x: 342, y: 232 }, { x: 306, y: 296 },
          { x: 286, y: 342 }, { x: 300, y: 380 }, { x: 340, y: 404 }, { x: 396, y: 420 }
        ], 4.2);
        // Western tributary through the farmland.
        carveWaterPath([{ x: 120, y: 300 }, { x: 168, y: 322 }, { x: 226, y: 340 }, { x: 286, y: 350 }], 2.9);
        // Marsh pools.
        paintEllipse(360, 392, 26, 18, TILE.WATER, 0, true);
        paintEllipse(404, 372, 18, 15, TILE.WATER, 0, true);
        paintEllipse(330, 418, 20, 12, TILE.WATER, 0, true);
        // Highland tarn feeding the river.
        paintEllipse(398, 76, 14, 11, TILE.WATER, 0, true);

        // ---- Landmark terrain ---------------------------------------------------------------
        paintEllipse(370, 210, 34, 26, TILE.RUIN, (x, y, d) => (d < 0.45 ? 3 : 2), true);   // Old Ruins
        paintEllipse(410, 250, 22, 18, TILE.RUIN, (x, y, d) => (d < 0.5 ? 3 : 2), true);
        paintEllipse(340, 70, 40, 28, TILE.STONE, (x, y, d) => (d < 0.5 ? 4 : 3), true);    // Highlands
        paintEllipse(400, 120, 28, 22, TILE.STONE, (x, y, d) => (d < 0.5 ? 4 : 3), true);
        paintEllipse(72, 62, 30, 24, TILE.STONE, (x, y, d) => (d < 0.5 ? 3 : 2), true);     // Mine shoulder
        paintEllipse(210, 74, 34, 26, TILE.DIRT, 0, true);                                   // Cemetery ground

        // ---- The city plate -----------------------------------------------------------------
        // Ashenfall's footprint is FLATTENED and cleared now, in Phase 1, so the city can be built on
        // known-good ground later. Deliberately CAMP tiles: that is the existing "settled ground"
        // tile the camp already uses, so footstep audio, decals and render treatment are correct with
        // no new tile type. Phase 1 ships this as an empty plate - no props, no NPCs.
        for (let y = 150; y <= 290; y++) {
          for (let x = 150; x <= 300; x++) {
            if (!inBounds(x, y)) continue;
            const edge = Math.min(x - 150, 300 - x, y - 150, 290 - y);
            if (edge < 0) continue;
            if (map[y][x].type === TILE.WATER) continue;   // never pave over the river
            setTile(x, y, edge < 3 ? TILE.DIRT : TILE.CAMP, 0, true);
          }
        }

        // ---- Roads ---------------------------------------------------------------------------
        // Every subregion is reachable from the city on a road, so the zone can be traversed before
        // any content exists in it.
        carvePath([{ x: 225, y: 290 }, { x: 210, y: 322 }, { x: 180, y: 348 }, { x: 140, y: 366 }], 2.6, TILE.DIRT, 0); // farmland
        carvePath([{ x: 300, y: 250 }, { x: 330, y: 274 }, { x: 336, y: 310 }, { x: 320, y: 350 }], 2.4, TILE.DIRT, 0); // riverlands
        carvePath([{ x: 320, y: 350 }, { x: 350, y: 372 }, { x: 372, y: 392 }], 2.0, TILE.DIRT, 0);                     // marsh
        carvePath([{ x: 150, y: 210 }, { x: 116, y: 200 }, { x: 86, y: 176 }, { x: 70, y: 148 }], 2.4, TILE.DIRT, 0);   // ashwood
        carvePath([{ x: 70, y: 148 }, { x: 62, y: 112 }, { x: 68, y: 78 }], 2.0, TILE.DIRT, 0);                         // mine
        carvePath([{ x: 225, y: 150 }, { x: 220, y: 122 }, { x: 212, y: 96 }], 2.4, TILE.DIRT, 0);                      // cemetery
        carvePath([{ x: 300, y: 190 }, { x: 332, y: 196 }, { x: 360, y: 206 }], 2.4, TILE.RUIN, 2);                     // ruins
        carvePath([{ x: 300, y: 170 }, { x: 330, y: 140 }, { x: 344, y: 104 }], 2.2, TILE.STONE, 3);                    // highlands

        // ---- Finalise -----------------------------------------------------------------------
        // Same normalisation Dark Woods runs, so water depth and collision agree with every consumer.
        DR.normalizeWaterDepthsForMap?.(map);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const t = map[y][x];
            if (t) t.blocked = !tileDef(t.type).walk;
          }
        }

        this.storeOverworldZone(ZONE_ID, map, objects, { enemies: [] });

        // The waypoint is placed directly rather than through Game.placeObject, because that helper
        // writes into `this.objects` - the ACTIVE zone - and Ashen Valley is generated while Dark
        // Woods is still active. Writing through it here would have put the Ashenfall waypoint in
        // Dark Woods. Same class of bug as the runtime-spawn list mismatch from the Silk Cavern work:
        // a helper that silently targets the wrong collection.
        const wpX = 225, wpY = 232;
        if (map[wpY]?.[wpX]) {
          objects[wpY][wpX] = {
            type: 'waypoint',
            interactionType: 'waypoint',
            waypointId: 'ashenfall_city_waypoint',
            name: 'Ashenfall City Waypoint',
            interactLabel: 'Attune Waypoint',
            attuned: !!this.player?.unlockedWaypoints?.includes('ashenfall_city_waypoint'),
            blocked: false
          };
          setTile(wpX, wpY, TILE.CAMP, 0, false);
        }

        // ---- The road back to Dark Woods ----------------------------------------------------
        // V0.20.81: the return leg. Lands in Valley Farmland (levels 10-12), the zone's gentlest
        // ground, and is joined by road to the farmland route and onward to the city - so a player
        // arriving on foot has somewhere to walk to rather than standing in a field.
        const link = (DR.ZONE_LINKS || []).find(l => l.id === 'ashen_valley_west_pass');
        let linkPoint = null;
        if (link) {
          const lx = Math.min(size - 2, Math.max(1, link.fromX));
          const ly = Math.min(size - 2, Math.max(1, link.fromY));
          carvePath([{ x: lx, y: ly }, { x: 74, y: 318 }, { x: 110, y: 344 }, { x: 140, y: 366 }], 2.4, TILE.DIRT, 0);
          for (let ty = ly - 2; ty <= ly + 2; ty++) {
            for (let tx = lx - 2; tx <= lx + 6; tx++) {
              const tile = map[ty]?.[tx];
              if (!tile) continue;
              tile.type = TILE.DIRT; tile.elev = 0; tile.blocked = false; tile.waterDepth = 0;
              if (objects[ty]) objects[ty][tx] = null;
            }
          }
          objects[ly][lx] = {
            type: 'zoneLink',
            interactionType: 'zoneLink',
            zoneLinkId: link.id,
            name: link.name,
            interactLabel: `Travel to ${DR.DEFAULT_WORLD?.zones?.[link.toZone]?.name || link.toZone}`,
            toZone: link.toZone,
            blocked: false
          };
          linkPoint = { x: lx, y: ly };
        }

        return { id: ZONE_ID, size, map, objects, waypoint: { x: wpX, y: wpY }, link: linkPoint };
      };

      // Where the player lands when arriving in the zone. Chosen inside the city plate, which is
      // flat CAMP ground by construction, and verified walkable at generation time rather than
      // trusted - an arrival tile that is blocked strands the player.
      Game.prototype.ashenValleyArrivalPoint = function() {
        const slot = this.overworldZoneSlot?.(ZONE_ID);
        const map = slot?.map;
        const preferred = { x: 225, y: 240 };
        if (!Array.isArray(map)) return preferred;
        const walkable = (x, y) => {
          const t = map[Math.floor(y)]?.[Math.floor(x)];
          return !!t && !t.blocked && !(t.waterDepth > 0);
        };
        if (walkable(preferred.x, preferred.y)) return preferred;
        for (let r = 1; r <= 40; r++) {
          for (let a = 0; a < 16; a++) {
            const ang = (a / 16) * Math.PI * 2;
            const x = Math.round(preferred.x + Math.cos(ang) * r);
            const y = Math.round(preferred.y + Math.sin(ang) * r);
            if (walkable(x, y)) return { x, y };
          }
        }
        return preferred;
      };
    }
  };
})();
