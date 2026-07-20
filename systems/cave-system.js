// Dream Realms cave transition, named cave layout, multi-floor cave, cave resource, and cave encounter system.
// V0.11.8: Dark Woods Cave + Dungeon Expansion.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.17.44 Phase 5 (Cave Count Enforcement): Dark Woods is limited to exactly
  // 2 caves - Silk Web Cavern (kept as-is) and Hidden Tree Cave. Hidden Tree
  // Cave reuses the 'mossfang_cave' id/save-schema slot rather than a new zone
  // key, since systems/world-serializer.js hard-requires a zone literally
  // named 'mossfang_cave' as Dark Woods' second persisted zone in several
  // places (validateNormalizedPayload, migratePayload, serialize) - renaming
  // the key would force a save-schema migration for no gameplay benefit, so
  // only the display identity (name/theme/level range) changes here. Entrance
  // coordinates are unchanged; full exterior concealment/interior content is
  // Phase 8 scope, not this one.
  //
  // Ashroot Hollow, Crystal Grotto, and Forgotten Mine are removed entirely
  // (no dungeon hooks depended on them - see docs/V0.17.44 report for the
  // fishing-table/loot-table data this orphans, left in place as harmless
  // unreferenced data rather than deleted).
  //
  // Blackroot Catacombs is also removed. Its floor-4 dungeonHook was the ONLY
  // access point to the 'dungeon_glooms_crypt' ("Gloom's Crypt") dungeon
  // (data/dungeons.js) - removing this entrance orphans that dungeon with no
  // current replacement access point. The dungeon's data (rooms, 3 bosses,
  // puzzles, loot table) is left fully intact, not deleted, pending a future
  // decision on whether/how to re-attach it. See the Phase 5 report.
  const CAVE_DEFINITIONS = [
    {
      id: 'mossfang_cave',
      name: 'Hidden Tree Cave',
      size: 'small',
      floors: 1,
      minLevel: 4,
      maxLevel: 8,
      seed: 4103,
      theme: 'hidden_tree',
      entrance: { x: 76, y: 74, route: 'northwest', radius: 4.6, scale: 3.85, variant: 'moss' },
      enemyNames: ['Gloom Wolf', 'Rotling', 'Thorn Widow'],
      resourceTypes: ['herb_cave_moss', 'herb_mooncap', 'ore_tinstone', 'fish_cavepool'],
      lootTableId: 'loot_cave_mossfang_mobs',
      chestLootTableId: 'loot_cave_small_treasure',
      ambient: { glow: '#8df0bc', fog: '#5f7f64', accent: '#75d069' },
      notes: 'Small secret exploration cave concealed by dense trees, not a dungeon. Level range and identity updated in Phase 5; enemyNames/resourceTypes/exterior concealment still reflect the prior Mossfang Cave identity pending Phase 8.'
    },
    {
      id: 'silk_web_cavern',
      name: 'Silk Web Cavern',
      size: 'medium',
      floors: 3,
      minLevel: 6,
      maxLevel: 10,
      seed: 7201,
      theme: 'spider',
      entrance: { x: 52, y: 139, route: 'southwest', radius: 4.9, scale: 4.05, variant: 'web' },
      enemyNames: ['Webbed Cave Skitterer Elite', 'Silkfang Stalker Elite', 'Venom Sac Spider Elite', 'Cocoon Crawler Elite', 'Webguard Spinner Elite'],
      resourceTypes: ['herb_silkcap', 'herb_mooncap', 'herb_cave_moss', 'fish_cavepool'],
      lootTableId: 'loot_silk_web_cavern_elites',
      chestLootTableId: 'loot_silk_web_cavern_treasure',
      dungeonHook: { dungeonId: 'silk_web_cavern', label: 'W', color: '#d68cff', name: 'Silk Web Cavern' },
      directDungeon: true,
      ambient: { glow: '#d68cff', fog: '#6d4d83', accent: '#f0c6ff' },
      notes: 'Spider-only branch and canonical entrance to the 3-floor Silk Web Cavern elite dungeon. No bats or mixed cave mobs spawn here.'
    }
  ];

  DR.CAVE_DEFINITIONS = Object.freeze(CAVE_DEFINITIONS.map(cave => Object.freeze({ ...cave })));
  DR.CAVE_BY_ID = Object.freeze(Object.fromEntries(CAVE_DEFINITIONS.map(cave => [cave.id, cave])));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const caveById = id => DR.CAVE_BY_ID?.[id] || CAVE_DEFINITIONS.find(cave => cave.id === id || cave.name === id) || CAVE_DEFINITIONS[0];
  const seeded = (x, y, seed) => (DR.utils?.seededNoise || window.seededNoise)(Math.floor(x), Math.floor(y), seed);
  const smooth = (x, y, scale, seed) => (DR.utils?.smoothNoise || window.smoothNoise)(x, y, scale, seed);

  function createRng(seed) {
    let state = (seed >>> 0) || 1;
    return () => {
      state = Math.imul(state ^ (state >>> 15), 2246822507) ^ Math.imul(state + 0x9e3779b9, 3266489909);
      return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
    };
  }

  function caveZoneKey(caveId, floor) {
    const id = caveId || 'mossfang_cave';
    const f = Math.max(1, Math.floor(safeNumber(floor, 1)));
    return f <= 1 ? id : `${id}_f${f}`;
  }

  function cloneNode(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function ensureGridBucket(root, key) {
    if (!root[key]) root[key] = {};
    return root[key];
  }

  function makeResourceNode(type, x, y, zoneId, extra = {}) {
    const def = DR.RESOURCE_BY_ID?.[type] || {};
    return Object.assign({
      id: `${type}_${zoneId}_${x}_${y}`,
      type,
      name: def.name || type,
      category: def.category || 'resource',
      skill: def.skill || null,
      tool: def.tool || null,
      color: def.color || '#89d66f',
      label: def.label || 'R',
      x,
      y,
      zoneId,
      respawnSeconds: def.respawnSeconds || 180,
      drops: cloneNode(def.drops || []),
      rareDrops: cloneNode(def.rareDrops || []),
      note: def.note || 'V0.11.8 cave runtime resource node.'
    }, extra);
  }

  function makeDungeonMarker(kind, dungeon, x, y, zoneId, floor, hook = {}) {
    return {
      id: `dungeon_${kind}_${zoneId}_${x}_${y}`,
      type: 'dungeonMarker',
      markerKind: kind,
      dungeonId: dungeon?.id || hook.dungeonId,
      dungeonName: dungeon?.name || hook.name || hook.dungeonId,
      x,
      y,
      zoneKey: zoneId,
      floor,
      label: hook.label || dungeon?.label || 'D',
      color: hook.color || dungeon?.color || '#a987ff',
      name: hook.name || dungeon?.name || 'Dungeon Entrance',
      interactionRange: 3.1,
      lootTableId: dungeon?.lootTableId || 'loot_dungeon_chest',
      notes: `V0.11.8 cave dungeon hook for ${hook.name || dungeon?.name || hook.dungeonId}.`
    };
  }

  function carveEllipse(map, objects, room, floorType) {
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
    for (let y = Math.floor(room.y - room.h / 2) - 1; y <= Math.ceil(room.y + room.h / 2) + 1; y++) {
      for (let x = Math.floor(room.x - room.w / 2) - 1; x <= Math.ceil(room.x + room.w / 2) + 1; x++) {
        if (!map[y]?.[x]) continue;
        const nx = (x - room.x) / Math.max(1, room.w / 2);
        const ny = (y - room.y) / Math.max(1, room.h / 2);
        if (nx * nx + ny * ny > 1.08) continue;
        const rimNoise = smooth(x, y, 6, room.seed || 88);
        map[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
        objects[y][x] = null;
      }
    }
  }

  function carveDisk(map, objects, cx, cy, radius, floorType, elev = 0) {
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (!map[y]?.[x] || Math.hypot(x - cx, y - cy) > radius) continue;
        map[y][x] = { type: floorType, elev, blocked: !TILE_DEF[floorType]?.walk };
        objects[y][x] = null;
      }
    }
  }

  function carveCorridor(map, objects, a, b, floorType, width = 2) {
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.2));
    let lx = a.x;
    let ly = a.y;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const bend = Math.sin(t * Math.PI) * ((a.seed || 0) % 2 ? 5.5 : -5.5);
      const x = Math.round(a.x + (b.x - a.x) * t + bend * 0.35);
      const y = Math.round(a.y + (b.y - a.y) * t + Math.sin((a.x + b.y + i) / 7) * 1.25);
      const dx = x - lx;
      const dy = y - ly;
      const stepCount = Math.max(1, Math.abs(dx), Math.abs(dy));
      for (let s = 0; s <= stepCount; s++) {
        const px = Math.round(lx + dx * (s / stepCount));
        const py = Math.round(ly + dy * (s / stepCount));
        for (let oy = -width; oy <= width; oy++) {
          for (let ox = -width; ox <= width; ox++) {
            if (Math.abs(ox) + Math.abs(oy) > width + 1) continue;
            const tx = px + ox;
            const ty = py + oy;
            if (!map[ty]?.[tx]) continue;
            map[ty][tx] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
            objects[ty][tx] = null;
          }
        }
      }
      lx = x;
      ly = y;
    }
  }


  function carveOrganicBlob(map, objects, cx, cy, rx, ry, floorType, seed, elev = 0) {
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
    const minY = Math.floor(cy - ry - 2);
    const maxY = Math.ceil(cy + ry + 2);
    const minX = Math.floor(cx - rx - 2);
    const maxX = Math.ceil(cx + rx + 2);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!map[y]?.[x]) continue;
        const nx = (x - cx) / Math.max(1, rx);
        const ny = (y - cy) / Math.max(1, ry);
        const dist2 = nx * nx + ny * ny;
        const edgeNoise = smooth(x, y, 7.5, seed) * 0.42 + smooth(x + seed * 0.01, y - seed * 0.01, 15, seed + 37) * 0.20;
        const wobble = 0.72 + edgeNoise + Math.sin((x + seed) * 0.17) * 0.045 + Math.cos((y - seed) * 0.13) * 0.045;
        if (dist2 > wobble) continue;
        map[y][x] = {
          type: floorType,
          elev: 0,
          blocked: !TILE_DEF[floorType]?.walk
        };
        objects[y][x] = null;
      }
    }
  }

  function carveOrganicTunnel(map, objects, a, b, floorType, width, seed) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.45));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const bendA = (smooth(a.x, a.y, 20, seed) - 0.5) * 22;
    const bendB = (smooth(b.x, b.y, 22, seed + 19) - 0.5) * 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ease = t * t * (3 - 2 * t);
      const wave = Math.sin(t * Math.PI) * bendA + Math.sin(t * Math.PI * 2.0) * bendB * 0.35;
      const cx = a.x + dx * ease + nx * wave + Math.sin((seed + i) * 0.21) * 0.7;
      const cy = a.y + dy * ease + ny * wave + Math.cos((seed - i) * 0.17) * 0.7;
      const r = width + smooth(cx, cy, 8, seed + i) * 2.4 + Math.sin(t * Math.PI * 3) * 0.5;
      carveOrganicBlob(map, objects, cx, cy, r + 1.2, Math.max(2.2, r * 0.78), floorType, seed + i * 13, 0);
    }
  }

  function smoothCaveOpenCells(map, objects, floorType, iterations = 2) {
    const TILE = DR.TILE || window.TILE;
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
    const size = map.length;
    for (let pass = 0; pass < iterations; pass++) {
      const next = map.map(row => row.map(tile => ({ ...tile })));
      for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
          let floorNeighbors = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (!ox && !oy) continue;
              if (map[y + oy]?.[x + ox]?.type === floorType || map[y + oy]?.[x + ox]?.type === TILE.WATER) floorNeighbors++;
            }
          }
          if (map[y][x].type !== floorType && floorNeighbors >= 5) {
            next[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
            objects[y][x] = null;
          } else if (map[y][x].type === floorType && floorNeighbors <= 1) {
            next[y][x] = { type: TILE.CAVE_WALL, elev: 5, blocked: true };
            objects[y][x] = null;
          }
        }
      }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) map[y][x] = next[y][x];
    }
  }

  function carveNaturalCaveLayout(map, objects, rooms, def, floor, floorType) {
    const rng = createRng((def.seed || 1) + floor * 1237);
    const baseTunnel = def.size === 'large' ? 4.2 : def.size === 'medium' ? 3.55 : 3.0;
    for (const room of rooms) {
      const kindScale = room.kind === 'nest' ? 1.16 : room.kind === 'resource' ? 0.96 : room.kind === 'elite' || room.kind === 'boss' || room.kind === 'dungeonHook' ? 1.28 : 1;
      const rx = Math.max(6, room.w * (0.34 + rng() * 0.18) * kindScale);
      const ry = Math.max(5, room.h * (0.34 + rng() * 0.16) * kindScale);
      carveOrganicBlob(map, objects, room.x, room.y, rx, ry, floorType, room.seed + floor * 71, Math.floor(rng() * 1.4));
    }
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1];
      const b = rooms[i];
      carveOrganicTunnel(map, objects, a, b, floorType, baseTunnel + (i % 3) * 0.45, (def.seed || 1) + floor * 401 + i * 109);
      if (i > 1 && i < rooms.length - 1 && rng() > 0.55) {
        const angle = rng() * Math.PI * 2;
        const len = 14 + rng() * 16;
        const branch = { x: clamp(b.x + Math.cos(angle) * len, 18, (DR.CONFIG?.MAP_SIZE || 200) - 18), y: clamp(b.y + Math.sin(angle) * len, 18, (DR.CONFIG?.MAP_SIZE || 200) - 18) };
        carveOrganicTunnel(map, objects, b, branch, floorType, Math.max(2.25, baseTunnel - 0.9), (def.seed || 1) + floor * 809 + i * 149);
        carveOrganicBlob(map, objects, branch.x, branch.y, 5.5 + rng() * 5, 4.2 + rng() * 4, floorType, (def.seed || 1) + floor * 811 + i * 173, 0);
      }
    }
    smoothCaveOpenCells(map, objects, floorType, 2);
  }

  function findNearestOpenCell(map, x, y, radius = 8) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (map[cy]?.[cx] && !map[cy][cx].blocked) return { x: cx, y: cy };
    let best = null;
    let bestD = Infinity;
    for (let r = 1; r <= radius; r++) {
      for (let yy = cy - r; yy <= cy + r; yy++) {
        for (let xx = cx - r; xx <= cx + r; xx++) {
          const tile = map[yy]?.[xx];
          if (!tile || tile.blocked) continue;
          const d = Math.hypot(xx - x, yy - y);
          if (d < bestD) { best = { x: xx, y: yy }; bestD = d; }
        }
      }
      if (best) return best;
    }
    return { x: cx, y: cy };
  }

  function findCaveWallExitCell(map, room) {
    const TILE = DR.TILE || window.TILE;
    const cx = Math.round(room.x);
    const minY = Math.max(1, Math.floor(room.y - room.h * 0.62));
    const maxY = Math.min(map.length - 2, Math.floor(room.y + room.h * 0.12));
    const minX = Math.max(1, Math.floor(room.x - room.w * 0.46));
    const maxX = Math.min(map.length - 2, Math.ceil(room.x + room.w * 0.46));
    const candidates = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = map[y]?.[x];
        if (!tile || tile.blocked || tile.type !== TILE.CAVE_FLOOR) continue;
        const wallBehind = map[y - 1]?.[x]?.type === TILE.CAVE_WALL || map[y - 1]?.[x - 1]?.type === TILE.CAVE_WALL || map[y - 1]?.[x + 1]?.type === TILE.CAVE_WALL;
        const openFront = map[y + 1]?.[x] && !map[y + 1][x].blocked;
        if (!wallBehind || !openFront) continue;
        candidates.push({ x, y, score: Math.abs(x - cx) * 1.5 + y * 0.08 });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0] || findNearestOpenCell(map, room.x, room.y, 12);
  }

  function buildRooms(def, floor) {
    const floorCount = Math.max(1, Math.floor(def.floors || 1));
    const sizeConfig = {
      small: { count: 5, spread: 92, w: 22, h: 16 },
      medium: { count: 7, spread: 118, w: 24, h: 17 },
      large: { count: 9, spread: 140, w: 27, h: 19 }
    }[def.size || 'small'] || { count: 5, spread: 92, w: 22, h: 16 };
    const count = sizeConfig.count + Math.min(2, floor - 1);
    const rng = createRng((def.seed || 1) + floor * 997);
    const kinds = ['entrance', 'patrol', 'resource', 'nest', 'resource', 'elite', 'treasure', 'patrol', 'boss'];
    const rooms = [];
    for (let i = 0; i < count; i++) {
      const progress = count <= 1 ? 0 : i / (count - 1);
      const baseY = 174 - progress * sizeConfig.spread;
      const wave = Math.sin(progress * Math.PI * 2 + floor * 0.73) * (22 + floor * 2);
      const jitterX = (rng() - 0.5) * 14;
      const jitterY = (rng() - 0.5) * 10;
      let kind = kinds[Math.min(kinds.length - 1, i)];
      if (i === 0) kind = floor === 1 ? 'entrance' : 'stairsUp';
      if (i === count - 1) {
        if (floor < floorCount) kind = 'stairsDown';
        else if (def.dungeonHook) kind = 'dungeonHook';
        else kind = def.size === 'small' ? 'treasure' : 'boss';
      }
      const bossScale = kind === 'boss' || kind === 'dungeonHook' ? 1.22 : 1;
      rooms.push({
        index: i,
        kind,
        x: clamp(100 + wave + jitterX, 35, 165),
        y: clamp(baseY + jitterY, 24, 176),
        w: Math.floor(sizeConfig.w * bossScale + rng() * 7),
        h: Math.floor(sizeConfig.h * bossScale + rng() * 5),
        seed: Math.floor((def.seed || 1) + floor * 37 + i * 131)
      });
    }
    return rooms;
  }

  function openCellsNear(map, room, limit = 24) {
    const cells = [];
    const minY = Math.floor(room.y - room.h / 2) - 2;
    const maxY = Math.ceil(room.y + room.h / 2) + 2;
    const minX = Math.floor(room.x - room.w / 2) - 2;
    const maxX = Math.ceil(room.x + room.w / 2) + 2;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!map[y]?.[x] || map[y][x].blocked) continue;
        if (Math.hypot(x - room.x, y - room.y) > Math.max(room.w, room.h) * 0.56) continue;
        cells.push({ x, y });
      }
    }
    return cells.slice(0, Math.max(limit, cells.length));
  }

  function placeObjectSafe(map, objects, x, y, type, extra = {}, blocked = false) {
    if (!map[y]?.[x] || map[y][x].blocked) return false;
    objects[y][x] = { type, ...extra };
    if (blocked) map[y][x].blocked = true;
    return true;
  }


  function flattenCaveWalkableTerrain(map) {
    const TILE = DR.TILE || window.TILE || {};
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF || {};
    if (!Array.isArray(map)) return;
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < (map[y]?.length || 0); x++) {
        const tile = map[y][x];
        if (!tile) continue;
        const def = TILE_DEF[tile.type] || {};
        // Keep vertical wall mass, but remove small half-height slabs from playable cave floor/water.
        if (def.walk || tile.type === TILE.CAVE_FLOOR || tile.type === TILE.WATER) {
          tile.elev = 0;
          if (tile.type === TILE.WATER) {
            tile.waterSurfaceElev = 0;
            tile.waterBottomElev = -Math.max(5, Number(tile.waterDepth) || 5);
          }
        }
      }
    }
  }

  function placeWaterPool(map, objects, room, rng) {
    const TILE = DR.TILE || window.TILE;
    const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
    const cx = Math.round(room.x + (rng() - 0.5) * room.w * 0.35);
    const cy = Math.round(room.y + (rng() - 0.5) * room.h * 0.25);
    const radius = 3 + Math.floor(rng() * 3);
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!map[y]?.[x]) continue;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > radius) continue;
        const centerFactor = Math.max(0, 1 - dist / Math.max(1, radius));
        const poolMaxDepth = Math.min(12, 7 + Math.floor(radius * 1.15));
        const depth = Math.max(5, Math.min(12, Math.round(5 + (poolMaxDepth - 5) * centerFactor + rng() * 1.4)));
        map[y][x] = { type: TILE.WATER, elev: 0, blocked: !TILE_DEF[TILE.WATER]?.walk, waterDepth: depth, waterSurfaceElev: 0, waterBottomElev: -depth, waterBodyKind: 'cave_pool' };
        objects[y][x] = null;
      }
    }

    const hasAdjacentWater = (x, y) => {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (map[y + dy]?.[x + dx]?.type === TILE.WATER) return true;
      }
      return false;
    };

    const candidates = [];
    for (let y = cy - radius - 3; y <= cy + radius + 3; y++) {
      for (let x = cx - radius - 3; x <= cx + radius + 3; x++) {
        const tile = map[y]?.[x];
        if (!tile || tile.blocked || objects[y]?.[x]) continue;
        if (!hasAdjacentWater(x, y)) continue;
        candidates.push({ x, y, distance: Math.hypot(x - cx, y - cy) });
      }
    }

    if (candidates.length) {
      candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
      const pick = candidates[Math.floor(rng() * Math.min(candidates.length, 6))] || candidates[0];
      return { x: pick.x, y: pick.y, centerX: cx, centerY: cy, radius };
    }

    const fallbackCells = openCellsNear(map, room, 90).filter(cell => hasAdjacentWater(cell.x, cell.y));
    if (fallbackCells.length) {
      const pick = fallbackCells[Math.floor(rng() * fallbackCells.length)] || fallbackCells[0];
      return { x: pick.x, y: pick.y, centerX: cx, centerY: cy, radius };
    }

    return { x: Math.round(room.x), y: Math.round(room.y), centerX: cx, centerY: cy, radius };
  }

  function enemyTypeByName(name) {
    const types = DR.ENEMY_TYPES || window.ENEMY_TYPES || [];
    return types.find(type => normalizeId(type.name) === normalizeId(name)) || types.find(type => type.name && String(type.name).includes(name)) || types[0];
  }


  function chooseSpreadCells(cells, count, minDistance, rng, room = null) {
    const pool = Array.isArray(cells) ? [...cells] : [];
    const picks = [];
    if (!pool.length || count <= 0) return picks;
    const centerX = room?.x ?? pool.reduce((a, c) => a + c.x, 0) / pool.length;
    const centerY = room?.y ?? pool.reduce((a, c) => a + c.y, 0) / pool.length;
    const scoreCell = (cell, distanceFloor) => {
      const centerBias = Math.hypot(cell.x - centerX, cell.y - centerY) * 0.12;
      return distanceFloor + centerBias + rng() * 0.25;
    };
    while (pool.length && picks.length < count) {
      let bestIndex = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const cell = pool[i];
        const nearest = picks.length ? Math.min(...picks.map(p => Math.hypot(cell.x - p.x, cell.y - p.y))) : Infinity;
        const score = scoreCell(cell, nearest);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      const pick = pool.splice(bestIndex >= 0 ? bestIndex : 0, 1)[0];
      if (!pick) break;
      picks.push(pick);
      for (let i = pool.length - 1; i >= 0; i--) {
        if (Math.hypot(pool[i].x - pick.x, pool[i].y - pick.y) < minDistance) pool.splice(i, 1);
      }
    }
    if (picks.length < count) {
      const leftovers = cells.filter(cell => !picks.includes(cell));
      leftovers.sort((a, b) => {
        const da = picks.length ? Math.min(...picks.map(p => Math.hypot(a.x - p.x, a.y - p.y))) : 0;
        const db = picks.length ? Math.min(...picks.map(p => Math.hypot(b.x - p.x, b.y - p.y))) : 0;
        return db - da;
      });
      for (const cell of leftovers) {
        if (picks.length >= count) break;
        if (!picks.some(p => p.x === cell.x && p.y === cell.y)) picks.push(cell);
      }
    }
    return picks.slice(0, count);
  }

  function createCaveEnemy(def, room, floor, level, options = {}) {
    const Enemy = DR.entities?.Enemy || window.Enemy;
    if (!Enemy) return null;
    const names = Array.isArray(def.enemyNames) && def.enemyNames.length ? def.enemyNames : ['Rotling'];
    const type = enemyTypeByName(options.typeName || names[Math.floor((room.seed || 1) % names.length)]);
    if (!type) return null;
    const enemy = new Enemy(type, (options.x ?? room.x) + 0.5, (options.y ?? room.y) + 0.5, level);
    const prefix = def.theme === 'spider' ? 'Silkweb' : def.theme === 'crystal' ? 'Crystal' : def.theme === 'mine' ? 'Mine' : def.theme === 'catacomb' ? 'Catacomb' : def.theme === 'ashroot' ? 'Ashroot' : 'Cave';
    enemy.name = options.name || `${prefix} ${type.name}`;
    enemy.caveId = def.id;
    enemy.caveFloor = floor;
    enemy.caveTheme = def.theme;
    enemy.lootTableId = options.lootTableId || def.lootTableId || 'loot_mossfang_cave_mobs';
    enemy.baseType = { ...(enemy.baseType || type), name: type.name, lootTableId: enemy.lootTableId };
    enemy.respawnTimer = 999999;
    enemy.noSelfRespawn = true;
    enemy.caveEnemy = true;
    enemy.patrolRadius = options.elite ? 5.2 : 4.6;
    enemy.elite = Boolean(options.elite);
    enemy.lootRolls = options.lootRolls || (options.elite ? 2 : 1);
    if (options.elite) {
      enemy.name = options.name || `${prefix} Elite ${type.name}`;
      enemy.maxHp = Math.floor(enemy.maxHp * 1.7);
      enemy.hp = enemy.maxHp;
      enemy.attack = Math.floor(enemy.attack * 1.28);
      enemy.defense = Math.floor(enemy.defense * 1.18);
      enemy.xp = Math.floor((enemy.xp || type.xp || 10) * 1.8);
    }
    return enemy;
  }

  function spawnCaveEnemies(def, floor, rooms, map) {
    const enemies = [];
    const minLevel = Math.max(1, Math.floor(def.minLevel || 1));
    const maxLevel = Math.max(minLevel, Math.floor(def.maxLevel || minLevel));
    const names = Array.isArray(def.enemyNames) && def.enemyNames.length ? def.enemyNames : ['Rotling'];
    for (const room of rooms) {
      if (['entrance', 'stairsUp', 'stairsDown', 'treasure', 'dungeonHook', 'resource'].includes(room.kind)) continue;
      const cells = openCellsNear(map, room, 260);
      if (!cells.length) continue;
      // V0.12.27: caves should feel populated, but not stacked. Counts are roughly triple
      // the previous room budget and placement uses distance-first spreading below.
      const baseCount = room.kind === 'nest' ? 12 : room.kind === 'elite' || room.kind === 'boss' ? 5 : 9;
      const count = Math.min(cells.length, baseCount + Math.min(5, (floor - 1) * 2));
      const rng = createRng((def.seed || 1) + floor * 251 + room.index * 97);
      const minDistance = room.kind === 'nest' ? 4.3 : room.kind === 'elite' || room.kind === 'boss' ? 5.2 : 4.0;
      const picks = chooseSpreadCells(cells, count, minDistance, rng, room);
      for (let i = 0; i < picks.length; i++) {
        const cell = picks[i];
        const levelProgress = room.index / Math.max(1, rooms.length - 1);
        const level = clamp(Math.floor(minLevel + levelProgress * (maxLevel - minLevel + 1) + floor - 1 + rng() * 1.8), minLevel, maxLevel);
        const typeName = names[Math.floor(rng() * names.length)] || names[0];
        const elite = room.kind === 'elite' || room.kind === 'boss';
        const enemy = createCaveEnemy(def, room, floor, level, {
          x: cell.x,
          y: cell.y,
          typeName,
          elite,
          lootRolls: elite ? 2 : 1
        });
        if (enemy) enemies.push(enemy);
      }
    }
    return enemies;
  }

  function decorateCave(game, def, floor, map, objects, rooms) {
    const rng = createRng((def.seed || 1) + floor * 811);
    for (const room of rooms) {
      const cells = openCellsNear(map, room, 90);
      if (!cells.length) continue;
      const placeFromCell = (type, extra = {}, blocked = false, offset = 0) => {
        const start = Math.floor((rng() * cells.length + offset) % cells.length);
        let cell = cells[start] || cells[0];
        for (let i = 0; i < cells.length; i++) {
          const candidate = cells[(start + i) % cells.length];
          if (!candidate) continue;
          const tile = map[candidate.y]?.[candidate.x];
          if (!tile || tile.blocked || objects[candidate.y]?.[candidate.x]) continue;
          cell = candidate;
          break;
        }
        placeObjectSafe(map, objects, cell.x, cell.y, type, extra, blocked);
        return cell;
      };

      if (room.kind === 'resource' || room.kind === 'treasure') {
        if (def.resourceTypes?.includes('fish_cavepool')) {
          placeWaterPool(map, objects, room, rng);
        }
        const gatherableTypes = (def.resourceTypes || []).filter(type => type !== 'fish_cavepool');
        const nodeCount = room.kind === 'treasure' ? 2 : 3;
        for (let i = 0; i < nodeCount; i++) {
          const type = gatherableTypes[Math.floor(rng() * Math.max(1, gatherableTypes.length))] || 'herb_cave_moss';
          const cell = placeFromCell(type.startsWith('ore_') ? (type === 'ore_crystal' ? 'crystalNode' : 'miningVein') : (type.includes('mush') || type.includes('silkcap') ? 'caveMushrooms' : 'caveHerb'), { resourceId: type, color: def.ambient?.accent }, type.startsWith('ore_'), i * 11);
          game.seedCaveResourceNode?.(def, floor, type, cell.x, cell.y, { lootTableId: type.startsWith('ore_') ? 'loot_mining_cave_veins' : 'loot_gathering_cave_plants' });
        }
      }

      if (room.kind === 'treasure') {
        const cell = placeFromCell('dungeonTreasure', { name: `${def.name} Cache`, lootTableId: def.chestLootTableId || 'loot_common_chest' }, false, 31);
        game.seedCaveResourceNode?.(def, floor, 'chest_common', cell.x, cell.y, { name: `${def.name} Cache`, category: 'chest', lootTableId: def.chestLootTableId || 'loot_common_chest', label: 'T', color: '#d8ad57' });
      }

      const decorCount = room.kind === 'nest' ? 7 : room.kind === 'resource' ? 4 : 3;
      for (let i = 0; i < decorCount; i++) {
        const roll = rng();
        if (def.theme === 'spider') placeFromCell(roll > 0.45 ? 'caveWeb' : 'bones', { variant: i % 3 }, false, i * 7);
        else if (def.theme === 'crystal') placeFromCell(roll > 0.35 ? 'crystalNode' : 'caveMushrooms', { color: def.ambient?.accent, variant: i % 3 }, roll > 0.35, i * 7);
        else if (def.theme === 'mine') placeFromCell(roll > 0.52 ? 'mineSupport' : roll > 0.25 ? 'brokenCart' : 'miningVein', { variant: i % 3 }, roll > 0.25, i * 7);
        else if (def.theme === 'catacomb') placeFromCell(roll > 0.35 ? 'bones' : 'hangingRoots', { variant: i % 3 }, false, i * 7);
        else if (def.theme === 'ashroot') placeFromCell(roll > 0.35 ? 'hangingRoots' : 'bones', { variant: i % 3 }, false, i * 7);
        else placeFromCell(roll > 0.50 ? 'caveMushrooms' : 'hangingRoots', { variant: i % 3 }, false, i * 7);
      }

      if (room.kind === 'elite' || room.kind === 'boss') {
        placeFromCell('torch', { color: def.ambient?.glow }, false, 49);
      }
    }
  }

  DR.CaveSystem = {
    install(Game) {
      Game.prototype.getCaveDefinition = function(caveId) {
        return caveById(caveId);
      };

      Game.prototype.getActiveCaveZoneKey = function() {
        return caveZoneKey(this.currentCave?.id || this.activeCaveId || 'mossfang_cave', this.currentCaveFloor || 1);
      };

      Game.prototype.seedCaveResourceNode = function(def, floor, type, x, y, extra = {}) {
        const zoneId = caveZoneKey(def.id, floor);
        if (!this.editorResources || typeof this.editorResources !== 'object') this.editorResources = { dark_woods: {}, mossfang_cave: {} };
        const grid = ensureGridBucket(this.editorResources, zoneId);
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        if (!grid[key]) grid[key] = makeResourceNode(type, Math.floor(x), Math.floor(y), zoneId, extra);
        return grid[key];
      };

      Game.prototype.seedCaveDungeonHook = function(def, floor, x, y) {
        if (!def?.dungeonHook?.dungeonId) return null;
        if (!this.editorDungeonMarkers || typeof this.editorDungeonMarkers !== 'object') this.editorDungeonMarkers = { dark_woods: {}, mossfang_cave: {} };
        const zoneId = caveZoneKey(def.id, floor);
        const grid = ensureGridBucket(this.editorDungeonMarkers, zoneId);
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        const dungeon = this.editorDungeons?.[def.dungeonHook.dungeonId] || DR.DUNGEON_BY_ID?.[def.dungeonHook.dungeonId] || null;
        if (!grid[key]) grid[key] = makeDungeonMarker('entrance', dungeon, Math.floor(x), Math.floor(y), zoneId, floor, def.dungeonHook);
        return grid[key];
      };

      Game.prototype.buildCaveFloorState = function(defOrId = 'mossfang_cave', floor = 1) {
        const def = typeof defOrId === 'string' ? caveById(defOrId) : (defOrId || CAVE_DEFINITIONS[0]);
        const targetFloor = clamp(Math.floor(safeNumber(floor, 1)), 1, Math.max(1, Math.floor(def.floors || 1)));
        const key = `${def.id}:f${targetFloor}`;
        if (!this.caveFloorCache) this.caveFloorCache = {};
        if (this.caveFloorCache[key]) return this.caveFloorCache[key];

        const CONFIG = DR.CONFIG || window.CONFIG;
        const TILE = DR.TILE || window.TILE;
        const TILE_DEF = DR.TILE_DEF || window.TILE_DEF;
        const size = CONFIG.MAP_SIZE || 200;
        const map = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ type: TILE.CAVE_WALL, elev: 5, blocked: true })));
        const objects = Array.from({ length: size }, () => new Array(size).fill(null));
        const rooms = buildRooms(def, targetFloor);
        carveNaturalCaveLayout(map, objects, rooms, def, targetFloor, TILE.CAVE_FLOOR);

        const entranceRoom = rooms[0] || { x: CONFIG.START_X, y: CONFIG.START_Y + 70, w: 18, h: 14 };
        const finalRoom = rooms[rooms.length - 1] || entranceRoom;
        const exitCell = findCaveWallExitCell(map, entranceRoom);
        const finalCell = findNearestOpenCell(map, finalRoom.x, finalRoom.y, 14);
        const entranceX = exitCell.x;
        const entranceY = exitCell.y;
        const finalX = finalCell.x;
        const finalY = finalCell.y;
        carveOrganicBlob(map, objects, entranceX, entranceY + 2, 5.4, 3.4, TILE.CAVE_FLOOR, (def.seed || 1) + targetFloor * 1543, 0);
        carveOrganicBlob(map, objects, finalX, finalY, 5.6, 4.1, TILE.CAVE_FLOOR, (def.seed || 1) + targetFloor * 1567, 0);
        for (let xx = entranceX - 3; xx <= entranceX + 3; xx++) {
          if (map[entranceY - 1]?.[xx]) {
            map[entranceY - 1][xx] = { type: TILE.CAVE_WALL, elev: 5, blocked: true };
            objects[entranceY - 1][xx] = null;
          }
        }

        if (targetFloor === 1) objects[entranceY][entranceX] = {
          type: 'caveExit',
          scale: 1.95,
          name: 'Surface Exit',
          caveName: def.name,
          wallMounted: true,
          wallDir: 'north',
          daylight: true,
          doorwayOnly: true,
          triggerRadius: 0.72,
          visualMode: 'wallLightDoorway'
        };
        else objects[entranceY][entranceX] = { type: 'caveStairsUp', caveId: def.id, floor: targetFloor, targetFloor: targetFloor - 1, name: `${def.name} Floor ${targetFloor - 1}`, triggerRadius: 0.78 };

        if (targetFloor < Math.max(1, Math.floor(def.floors || 1))) {
          objects[finalY][finalX] = { type: 'caveStairsDown', caveId: def.id, floor: targetFloor, targetFloor: targetFloor + 1, name: `${def.name} Floor ${targetFloor + 1}` };
        } else if (def.dungeonHook) {
          objects[finalY][finalX] = { type: 'dungeonGate', dungeonId: def.dungeonHook.dungeonId, name: def.dungeonHook.name || 'Dungeon Entrance', color: def.dungeonHook.color || def.ambient?.glow };
          this.seedCaveDungeonHook(def, targetFloor, finalX, finalY);
        }

        decorateCave(this, def, targetFloor, map, objects, rooms);
        DR.normalizeWaterDepthsForMap?.(map);
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const obj = objects[y][x];
            map[y][x].blocked = !TILE_DEF[map[y][x].type]?.walk;
            if (obj && ['rock', 'miningVein', 'crystalNode', 'mineSupport', 'brokenCart'].includes(obj.type)) map[y][x].blocked = true;
            if (obj && ['caveExit', 'caveStairsDown', 'caveStairsUp', 'dungeonGate', 'dungeonTreasure'].includes(obj.type)) map[y][x].blocked = false;
          }
        }
        flattenCaveWalkableTerrain(map);

        const enemies = spawnCaveEnemies(def, targetFloor, rooms, map);
        const state = {
          key,
          def,
          floor: targetFloor,
          map,
          objects,
          rooms,
          enemies,
          exit: { x: entranceX, y: entranceY, radius: 0.72, triggerRadius: 0.72 },
          entranceSpawn: (() => { const c = findNearestOpenCell(map, entranceX, entranceY + 4, 10); return { x: c.x + 0.5, y: c.y + 0.5 }; })(),
          stairsUpSpawn: (() => { const c = findNearestOpenCell(map, entranceX, entranceY + 4, 10); return { x: c.x + 0.5, y: c.y + 0.5 }; })(),
          stairsDownSpawn: (() => { const c = findNearestOpenCell(map, finalX, finalY - 4, 10); return { x: c.x + 0.5, y: c.y + 0.5 }; })(),
          final: { x: finalX, y: finalY }
        };
        this.caveFloorCache[key] = state;
        return state;
      };

      Game.prototype.buildCaveMap = function(caveId = 'mossfang_cave', floor = 1) {
        const state = this.buildCaveFloorState(caveId, floor);
        this.currentCave = state.def;
        this.activeCaveId = state.def.id;
        this.currentCaveFloor = state.floor;
        this.currentCaveFloors = Math.max(1, Math.floor(state.def.floors || 1));
        this.caveMap = state.map;
        this.caveObjects = state.objects;
        this.caveEnemies = state.enemies;
        this.caveRooms = state.rooms;
        this.caveExit = state.exit;
        return state;
      };

      Game.prototype.generateCaveEnemies = function() {
        const state = this.buildCaveFloorState(this.currentCave?.id || this.activeCaveId || 'mossfang_cave', this.currentCaveFloor || 1);
        this.caveEnemies = state.enemies;
        return this.caveEnemies;
      };

      Game.prototype.loadCaveFloor = function(defOrId, floor = 1, spawnMode = 'entrance') {
        const state = this.buildCaveMap(typeof defOrId === 'string' ? defOrId : defOrId?.id, floor);
        this.currentZone = 'cave';
        this.map = state.map;
        this.objects = state.objects;
        this.setActiveEnemySet?.(state.enemies);
        const spawn = spawnMode === 'fromBelow' ? state.stairsDownSpawn : state.entranceSpawn;
        if (this.player) {
          this.player.x = clamp(spawn.x, 1, (DR.CONFIG?.MAP_SIZE || 200) - 2);
          this.player.y = clamp(spawn.y, 1, (DR.CONFIG?.MAP_SIZE || 200) - 2);
        }
        this.syncPartyCompanionsToPlayerZone?.({ zone: 'cave', snap: true, reason: 'cave-floor-load' })
          ?? this.syncPartyBotsToPlayerZone?.({ zone: 'cave', snap: true, reason: 'cave-floor-load' });
        this.staticMinimap = this.buildStaticMinimap?.() || this.staticMinimap;
        this.mapDirty = true;
        this.notifyExternalSystems?.('zone-entered', { zoneId: caveZoneKey(state.def.id, state.floor), zoneName: state.def.name, caveId: state.def.id, floor: state.floor, floors: state.def.floors });
        return state;
      };

      Game.prototype.changeCaveFloor = function(targetFloor, direction = 'down') {
        if (!this.currentCave) return false;
        const def = this.currentCave;
        const nextFloor = clamp(Math.floor(safeNumber(targetFloor, 1)), 1, Math.max(1, Math.floor(def.floors || 1)));
        if (nextFloor === this.currentCaveFloor) return false;
        this.loadCaveFloor(def, nextFloor, direction === 'up' ? 'fromBelow' : 'entrance');
        this.zoneTransitionCooldown = 0.65;
        this.log(`${def.name} · Floor ${nextFloor}/${def.floors}.`);
        return true;
      };

      Game.prototype.checkZoneTransition = function() {
        if (!this.player || !this.player.alive) return;
        if (safeNumber(this.zoneTransitionCooldown, 0) > 0) return;
        const px = this.player.x;
        const py = this.player.y;
        const tx = Math.floor(px);
        const ty = Math.floor(py);

        if (this.currentZone === 'overworld') {
          // V0.14.17: the painted cave mouth is visually below the object origin, so
          // front-facing players could stand at the entrance art without touching the
          // old exact origin tile.  Check the front threshold first, then keep the old
          // exact object tile as a fallback for saved worlds and edge cases.
          const frontEntrance = (this.caveEntrances || []).find(c => {
            const ex = Math.floor(c?.x ?? 0);
            const ey = Math.floor(c?.y ?? 0);
            // V0.18.39: the cave object is passable, so walking INTO the mouth carried the
            // player NORTH past the old trigger band (centred ~3 tiles below the origin) -
            // it only fired when they walked back out. Cover the whole mouth: the opening
            // at/above the origin AND the front threshold below it, so walking in teleports.
            const cx = ex + 0.5;
            const cy = ey + 1.4;
            const dx = (px - cx) / 2.5;
            const dy = (py - cy) / 2.7;
            return dx * dx + dy * dy <= 1;
          });
          if (frontEntrance) {
            this.enterCave(frontEntrance);
            return;
          }
          const obj = this.objects?.[ty]?.[tx];
          if (obj?.type === 'cave') {
            const entrance = (this.caveEntrances || []).find(c => (c.caveId || c.id) === (obj.caveId || obj.id) || c.name === obj.name) || obj;
            this.enterCave(entrance);
            return;
          }
          return;
        }

        if (this.currentZone !== 'cave') return;
        const obj = this.objects?.[ty]?.[tx];
        if (!obj || !['caveExit', 'caveStairsDown', 'caveStairsUp'].includes(obj.type)) return;

        // Interior cave transitions are exact-tile thresholds. The light doorway
        // itself is the warp tile, so walking near the glow no longer exits early.
        if (obj.type === 'caveExit') this.exitCave();
        else if (obj.type === 'caveStairsDown') this.changeCaveFloor(obj.targetFloor || (this.currentCaveFloor + 1), 'down');
        else if (obj.type === 'caveStairsUp') this.changeCaveFloor(obj.targetFloor || (this.currentCaveFloor - 1), 'up');
      };

      Game.prototype.enterCave = function(entrance) {
        const def = caveById(entrance?.caveId || entrance?.id || 'mossfang_cave');
        const ex = Math.floor(entrance?.x ?? def.entrance.x);
        const ey = Math.floor(entrance?.y ?? def.entrance.y);
        const mapSize = DR.CONFIG?.MAP_SIZE || window.CONFIG?.MAP_SIZE || 200;
        // Return just outside the cave doorway, not inside the trigger tile.
        // Since the entrance trigger is now exact-tile, this avoids accidental re-entry
        // while keeping the return point visually close to the mouth.
        this.caveReturn = { x: clamp(ex + 0.5, 1, mapSize - 2), y: clamp(ey + 4.15, 1, mapSize - 2) };

        // V0.13.30 corrective: Silk Web Cavern is the authored 3-floor dungeon, not a
        // generic cave wrapper with a deeper gate at the end. The V0.13.29 layout pass
        // rebuilt the dungeon generator, but the overworld entrance still routed the
        // player through the old cave floor pipeline. Load the authored dungeon directly
        // from the surface entrance so the new layout is what the player actually sees.
        if (def.id === 'silk_web_cavern' && def.directDungeon && def.dungeonHook?.dungeonId && this.dungeonSystem?.enterDungeon) {
          const marker = {
            markerKind: 'entrance',
            kind: 'entrance',
            dungeonId: def.dungeonHook.dungeonId,
            id: def.dungeonHook.dungeonId,
            name: def.dungeonHook.name || def.name,
            x: ex,
            y: ey,
            zoneId: 'dark_woods',
            interactionRange: 1.35,
            sourceCaveId: def.id,
            directDungeon: true
          };
          this.zoneTransitionCooldown = 0.75;
          this.log(`Entering ${def.name} · authored dungeon · Floor 1/${def.floors}.`);
          const entered = this.dungeonSystem.enterDungeon(marker, 1);
          return { key: `${def.id}:direct-dungeon`, def, floor: 1, directDungeon: true, entered };
        }

        const state = this.loadCaveFloor(def, 1, 'entrance');
        this.zoneTransitionCooldown = 0.75;
        this.log(`Entered ${def.name} · ${def.size} cave · Floor 1/${def.floors}.`);
        if (def.dungeonHook) this.log(`${def.name} contains a deeper dungeon route on its final floor.`);
        return state;
      };

      Game.prototype.exitCave = function() {
        this.currentZone = 'overworld';
        this.map = this.overworldMap;
        this.objects = this.overworldObjects;
        this.player.x = this.caveReturn.x;
        this.player.y = this.caveReturn.y;
        this.zoneTransitionCooldown = 0.95;
        this.syncPartyCompanionsToPlayerZone?.({ zone: 'overworld', snap: true, reason: 'cave-exit' })
          ?? this.syncPartyBotsToPlayerZone?.({ zone: 'overworld', snap: true, reason: 'cave-exit' });
        this.setActiveEnemySet?.(this.overworldEnemies);
        this.staticMinimap = this.buildStaticMinimap?.() || this.staticMinimap;
        this.mapDirty = true;
        this.log('Returned to Dark Woods.');
        this.notifyExternalSystems?.('zone-entered', { zoneId: 'dark_woods', zoneName: 'Dark Woods' });
      };

      Game.prototype.ensureDarkWoodsCaveEntrances = function() {
        const savedMap = this.map;
        const savedObjects = this.objects;
        const map = this.overworldMap || (this.currentZone === 'overworld' ? this.map : null);
        const objects = this.overworldObjects || (this.currentZone === 'overworld' ? this.objects : null);
        if (!Array.isArray(map) || !Array.isArray(objects)) return false;
        this.map = map;
        this.objects = objects;
        if (!Array.isArray(this.caveEntrances)) this.caveEntrances = [];
        const knownCaveIds = new Set(CAVE_DEFINITIONS.map(cave => cave.id));
        this.caveEntrances = this.caveEntrances.filter(entry => entry && (knownCaveIds.has(entry.caveId) || knownCaveIds.has(entry.id) || CAVE_DEFINITIONS.some(cave => cave.name === entry.name)));

        let changed = false;
        const makeTrail = (fromX, fromY, toX, toY, width = 1) => {
          const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY)));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(fromX + (toX - fromX) * t + Math.sin(t * Math.PI * 2) * 1.2);
            const y = Math.round(fromY + (toY - fromY) * t + Math.cos(t * Math.PI) * 0.8);
            for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
              if (Math.abs(ox) + Math.abs(oy) > width + 1) continue;
              if (!this.map[y + oy]?.[x + ox]) continue;
              if (this.map[y + oy][x + ox].type !== (DR.TILE || window.TILE).WATER) {
                this.map[y + oy][x + ox].type = (DR.TILE || window.TILE).DIRT;
                this.map[y + oy][x + ox].blocked = false;
                const existingObject = this.objects[y + oy]?.[x + ox];
                if (!existingObject || existingObject.type !== 'cave') this.objects[y + oy][x + ox] = null;
              }
            }
          }
        };

        const placeEntrance = def => {
          const entrance = def.entrance || {};
          const x = Math.floor(entrance.x);
          const y = Math.floor(entrance.y);
          const exists = this.caveEntrances.find(c => c.caveId === def.id || c.id === def.id || c.name === def.name);
          if (exists) {
            Object.assign(exists, {
              id: def.id,
              caveId: def.id,
              x,
              y,
              name: def.name,
              radius: 0.72,
              triggerRadius: 0.72,
              visualRadius: entrance.radius || 4.5,
              floors: def.floors,
              size: def.size,
              minLevel: def.minLevel,
              maxLevel: def.maxLevel
            });
          } else {
            this.caveEntrances.push({
              id: def.id,
              caveId: def.id,
              x,
              y,
              name: def.name,
              radius: 0.72,
              triggerRadius: 0.72,
              visualRadius: entrance.radius || 4.5,
              floors: def.floors,
              size: def.size,
              minLevel: def.minLevel,
              maxLevel: def.maxLevel
            });
            changed = true;
          }
          const TILE = DR.TILE || window.TILE;
          this.flattenArea?.(x, y + 1, 8 + Math.min(3, def.floors), def.theme === 'catacomb' ? TILE.RUIN : TILE.STONE, def.theme === 'catacomb' ? 1 : 2);
          this.flattenArea?.(x, y + 3, 4.5, def.theme === 'catacomb' ? TILE.RUIN : TILE.DIRT, 0);
          for (let yy = y - 8; yy <= y + 8; yy++) {
            for (let xx = x - 10; xx <= x + 10; xx++) {
              if (!this.map[yy]?.[xx]) continue;
              const d = Math.hypot((xx - x) / 1.35, yy - y);
              if (d < 7.8) {
                this.map[yy][xx].blocked = false;
                this.map[yy][xx].elev = Math.max(this.map[yy][xx].elev, d > 6 ? 2 : 1);
                this.objects[yy][xx] = null;
              }
            }
          }
          const previousObject = this.objects[y]?.[x];
          this.placeObject?.(x, y, 'cave', {
            id: def.id,
            caveId: def.id,
            name: def.name,
            scale: entrance.scale || 4,
            radius: 0.72,
            triggerRadius: 0.72,
            visualRadius: entrance.radius || 4.5,
            variant: entrance.variant || def.theme,
            floors: def.floors,
            levelRange: `${def.minLevel}-${def.maxLevel}`,
            glow: def.ambient?.glow
          }, false);
          if (!previousObject || previousObject.type !== 'cave' || previousObject.caveId !== def.id) changed = true;
          const props = [
            {x:x-7,y:y-5,type:'rock',blocked:true}, {x:x+7,y:y-4,type:'rock',blocked:true},
            {x:x-6,y:y+5,type:def.theme === 'spider' ? 'caveWeb' : def.theme === 'crystal' ? 'crystalNode' : 'mushroom',blocked:false},
            {x:x+6,y:y+5,type:def.theme === 'mine' ? 'mineSupport' : def.theme === 'catacomb' ? 'bones' : 'grassTuft',blocked:def.theme === 'mine'}
          ];
          for (const p of props) if (this.map[p.y]?.[p.x] && !this.objects[p.y][p.x]) this.placeObject?.(p.x, p.y, p.type, { color: def.ambient?.accent }, p.blocked);
        };

        for (const def of CAVE_DEFINITIONS) placeEntrance(def);
        // V0.17.44 Phase 5: only the connector spurs for the 2 surviving caves
        // remain (Hidden Tree Cave / mossfang_cave, and Silk Web Cavern). The
        // spurs that reinforced direct trails to the 4 removed cave mouths
        // (Ashroot Hollow, Crystal Grotto, Forgotten Mine, Blackroot
        // Catacombs) were removed rather than left to carve dead-end dirt
        // paths to empty forest. The general road network in generateMap's
        // carvePath calls is untouched - those roads still lead to the
        // now-cave-less ruin/stone terrain, which Phase 3 already folded into
        // the Bandit's Fall / Stone Hedge / Gloamroot Depths regions.
        makeTrail(100, 100, 85, 91, 1);
        makeTrail(88, 111, 64, 137, 1);

        if (savedMap) this.map = savedMap;
        if (savedObjects) this.objects = savedObjects;
        if (this.currentZone === 'overworld') {
          this.map = this.overworldMap || this.map;
          this.objects = this.overworldObjects || this.objects;
        }
        if (changed) this.worldSaveDirty = true;
        return changed;
      };
    }
  };
})();
