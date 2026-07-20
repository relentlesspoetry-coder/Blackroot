// Dream Realms runtime dungeon entrance and instance loading system
// Modular Pass 40: dungeon instances now include named bosses, elite dungeon loot, boss gates, and one-time reward nodes.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.dungeon-runtime.v1';

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const nowMs = () => Date.now();

  function defaultState() {
    return {
      version: 1,
      active: null,
      completedRuns: {},
      visitedFloors: {},
      lastDungeonId: null,
      lastEntranceKey: null,
      bossKills: {},
      miniBossKills: {},
      floorStats: {},
      lootedNodes: {},
      openedGates: {},
      interactedObjects: {}
    };
  }

  function normalizeState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;
    state.active = raw.active && typeof raw.active === 'object' ? cloneJson(raw.active) : null;
    state.completedRuns = raw.completedRuns && typeof raw.completedRuns === 'object' ? raw.completedRuns : {};
    state.visitedFloors = raw.visitedFloors && typeof raw.visitedFloors === 'object' ? raw.visitedFloors : {};
    state.lastDungeonId = raw.lastDungeonId || null;
    state.lastEntranceKey = raw.lastEntranceKey || null;
    state.bossKills = raw.bossKills && typeof raw.bossKills === 'object' ? raw.bossKills : {};
    state.miniBossKills = raw.miniBossKills && typeof raw.miniBossKills === 'object' ? raw.miniBossKills : {};
    state.floorStats = raw.floorStats && typeof raw.floorStats === 'object' ? raw.floorStats : {};
    state.lootedNodes = raw.lootedNodes && typeof raw.lootedNodes === 'object' ? raw.lootedNodes : {};
    state.openedGates = raw.openedGates && typeof raw.openedGates === 'object' ? raw.openedGates : {};
    state.interactedObjects = raw.interactedObjects && typeof raw.interactedObjects === 'object' ? raw.interactedObjects : {};
    state.version = 1;
    return state;
  }

  function readLocalState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (_err) {
      return defaultState();
    }
  }

  function writeLocalState(state) {
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_err) {}
  }

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function currentZoneKey(game) {
    if (game.currentZone === 'cave') return game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave';
    return 'dark_woods';
  }

  function markerKey(zoneId, marker) {
    return `${zoneId}:${Math.floor(safeNumber(marker?.x))},${Math.floor(safeNumber(marker?.y))}:${marker?.dungeonId || marker?.id || 'dungeon'}`;
  }

  function dungeonDef(game, dungeonId) {
    return game.editorDungeons?.[dungeonId] || DR.DUNGEON_BY_ID?.[dungeonId] || null;
  }

  function puzzleDef(game, puzzleId) {
    return game.editorPuzzles?.[puzzleId] || DR.PUZZLE_BY_ID?.[puzzleId] || null;
  }
  function bossDef(game, bossId) {
    return game.editorBosses?.[bossId] || DR.BOSS_BY_ID?.[bossId] || null;
  }

  function bossForFloor(game, dungeon, floor) {
    const ids = Array.isArray(dungeon?.bossIds) ? dungeon.bossIds.filter(Boolean) : [];
    if (!ids.length) return null;
    const index = clamp(Math.floor(safeNumber(floor, 1)) - 1, 0, ids.length - 1);
    return bossDef(game, ids[index]) || bossDef(game, ids[ids.length - 1]) || null;
  }

  function isBossRoom(kind) {
    return String(kind || '').toLowerCase() === 'boss';
  }

  function isDungeonCombatRoom(kind) {
    return ['combat', 'puzzle', 'web_choke', 'egg_room'].includes(String(kind || '').toLowerCase());
  }

  function currentRunId(state) {
    const active = state?.active || {};
    return active.runId || `${active.dungeonId || 'dungeon'}:${active.startedAt || 'run'}`;
  }

  function treasureNodeKey(state, node) {
    return `${currentRunId(state)}:treasure:${node?.floor || state?.active?.floor || 1}:${node?.x || 0},${node?.y || 0}`;
  }

  function bossKillKey(state, bossId, floor) {
    return `${currentRunId(state)}:boss:${bossId || 'boss'}:floor${floor || state?.active?.floor || 1}`;
  }

  function miniBossKillKey(state, miniBossId, floor) {
    return `${currentRunId(state)}:miniboss:${miniBossId || 'miniboss'}:floor${floor || state?.active?.floor || 1}`;
  }

  function goldRangeValue(value, fallback = 0) {
    if (value && typeof value === 'object') return randInt(Math.floor(safeNumber(value.min, fallback)), Math.floor(safeNumber(value.max, fallback)));
    return Math.floor(safeNumber(value, fallback));
  }

  function zoneMarkerGrid(game, zoneId) {
    if (!game.editorDungeonMarkers || typeof game.editorDungeonMarkers !== 'object') {
      game.editorDungeonMarkers = { dark_woods: {}, mossfang_cave: {} };
    }
    if (!game.editorDungeonMarkers.dark_woods) game.editorDungeonMarkers.dark_woods = {};
    if (!game.editorDungeonMarkers.mossfang_cave) game.editorDungeonMarkers.mossfang_cave = {};
    if (!game.editorDungeonMarkers[zoneId]) game.editorDungeonMarkers[zoneId] = {};
    return game.editorDungeonMarkers[zoneId];
  }

  function currentMarkerGrid(game) {
    return zoneMarkerGrid(game, currentZoneKey(game));
  }

  function allEntranceMarkers(game, zoneId = currentZoneKey(game)) {
    return Object.values(zoneMarkerGrid(game, zoneId)).filter(marker => {
      if (!marker || marker.enabled === false) return false;
      return (marker.markerKind || marker.kind) === 'entrance' && Boolean(marker.dungeonId);
    });
  }

  function allMarkersForActiveZone(game) {
    if (game.currentZone === 'dungeon') return [];
    return Object.values(currentMarkerGrid(game)).filter(marker => marker && marker.enabled !== false && marker.dungeonId);
  }

  function distanceToPlayer(game, marker) {
    if (!game.player || !marker) return Infinity;
    return Math.hypot((safeNumber(marker.x) + 0.5) - game.player.x, (safeNumber(marker.y) + 0.5) - game.player.y);
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('dungeonSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'dungeonSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Dungeons</h3>
      <div class="small" data-dungeon-status>No dungeon entrance nearby.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-dungeon-range style="background:linear-gradient(90deg,#8df0bc,#a987ff)"></div></div>
      <div class="small" data-dungeon-meta>E: Enter / stairs / exit</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  function ensureDungeonToast() {
    let panel = document.getElementById('dungeonRuntimeToast');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'dungeonRuntimeToast';
    panel.className = 'panel gameWindow';
    panel.style.display = 'none';
    panel.style.left = '50%';
    panel.style.top = '78px';
    panel.style.right = 'auto';
    panel.style.transform = 'translateX(-50%)';
    panel.style.width = 'min(540px, calc(100vw - 32px))';
    panel.style.pointerEvents = 'none';
    panel.innerHTML = `
      <div class="name" data-dungeon-toast-title>Dungeon</div>
      <div class="small" data-dungeon-toast-body></div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function ensureDungeonHudPanel() {
    const host = document.getElementById('minimapWrap');
    if (!host) return null;
    let panel = document.getElementById('dungeonInfoHudPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'dungeonInfoHudPanel';
    panel.className = 'dungeonInfoHudCard';
    panel.style.display = 'none';
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = `
      <div class="dungeonHudHeader">
        <div class="dungeonHudTitle" data-dungeon-hud-title>Dungeon</div>
        <div class="dungeonHudFloor" data-dungeon-hud-floor>Floor 1/1</div>
      </div>
      <div class="dungeonHudSubarea" data-dungeon-hud-subarea></div>
      <div class="dungeonHudStatus" data-dungeon-hud-status></div>
      <div class="dungeonHudRoom" data-dungeon-hud-room></div>
      <div class="dungeonHudHint" data-dungeon-hud-hint></div>
    `;
    const minimap = document.getElementById('minimap');
    if (minimap && minimap.parentNode === host && minimap.nextSibling) host.insertBefore(panel, minimap.nextSibling);
    else host.appendChild(panel);
    return panel;
  }

  function setDungeonHudText(panel, selector, value, fallback = '') {
    const node = panel?.querySelector?.(selector);
    if (!node) return;
    const text = String(value ?? fallback ?? '').trim();
    node.textContent = text;
    node.style.display = text ? '' : 'none';
  }

  function createMarker(kind, dungeon, x, y, zoneId) {
    const markerMeta = {
      entrance: { label: 'D', color: dungeon.color || '#a987ff', name: 'Dungeon Entrance' },
      treasureRoom: { label: 'T', color: '#d8ad57', name: 'Dungeon Treasure' }
    }[kind] || { label: 'D', color: dungeon.color || '#a987ff', name: 'Dungeon Marker' };
    return {
      id: `dungeon_${kind}_${x}_${y}`,
      type: 'dungeonMarker',
      markerKind: kind,
      dungeonId: dungeon.id,
      dungeonName: dungeon.name || dungeon.id,
      x,
      y,
      zoneKey: zoneId,
      floor: 0,
      label: markerMeta.label,
      color: markerMeta.color,
      name: markerMeta.name,
      interactionRange: 2.8,
      lootTableId: dungeon.lootTableId || null,
      notes: `${markerMeta.name} for ${dungeon.name || dungeon.id}. Runtime dungeon loading is active.`
    };
  }

  function setWalkableDisk(game, zoneId, cx, cy, radius, tileType) {
    const map = zoneId !== 'dark_woods' ? game.caveMap : game.overworldMap;
    const objects = zoneId !== 'dark_woods' ? game.caveObjects : game.overworldObjects;
    const TILE = DR.TILE || {};
    const TILE_DEF = DR.TILE_DEF || {};
    const type = tileType ?? (zoneId !== 'dark_woods' ? TILE.CAVE_FLOOR : TILE.RUIN);
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (!map?.[y]?.[x]) continue;
        if (Math.hypot(x - cx, y - cy) > radius) continue;
        map[y][x].type = type;
        map[y][x].blocked = false;
        map[y][x].elev = 0;
        if (objects?.[y]) objects[y][x] = null;
      }
    }
  }

  function buildEmptyGrid(size, fillTile) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => ({ ...fillTile })));
  }

  function buildEmptyObjects(size) {
    return Array.from({ length: size }, () => new Array(size).fill(null));
  }

  function carveRoom(map, objects, room) {
    const TILE = DR.TILE || {};
    const TILE_DEF = DR.TILE_DEF || {};
    const floorType = TILE.CAVE_FLOOR;
    for (let y = Math.floor(room.y - room.h / 2); y <= Math.ceil(room.y + room.h / 2); y++) {
      for (let x = Math.floor(room.x - room.w / 2); x <= Math.ceil(room.x + room.w / 2); x++) {
        if (!map[y]?.[x]) continue;
        const nx = (x - room.x) / Math.max(1, room.w / 2);
        const ny = (y - room.y) / Math.max(1, room.h / 2);
        if (nx * nx + ny * ny > 1.04) continue;
        map[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
        objects[y][x] = null;
      }
    }
  }

  // V0.18.41: `radius` narrows the tunnels. radius 2 -> ~5-wide main corridor,
  // radius 1 -> ~3-wide narrow pocket tunnel (was a fixed ~7-wide hall).
  function carveCorridor(map, objects, a, b, radius = 2) {
    const TILE = DR.TILE || {};
    const TILE_DEF = DR.TILE_DEF || {};
    const floorType = TILE.CAVE_FLOOR;
    const r = Math.max(1, Math.floor(radius));
    const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(a.x + (b.x - a.x) * t);
      const cy = Math.round(a.y + (b.y - a.y) * t);
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (Math.abs(ox) + Math.abs(oy) > r) continue;
          const x = cx + ox;
          const y = cy + oy;
          if (!map[y]?.[x]) continue;
          map[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
          objects[y][x] = null;
        }
      }
    }
  }

  // V0.18.41: carve small dead-end "pocket" caverns branching off the main rooms via
  // narrow tunnels, and register them so they get webbed, dressed and populated. These
  // never sit on the critical path (they branch off existing rooms into dead rock), so
  // they can't break boss/gate/objective reachability.
  function carveSilkPocketCaverns(game, dungeon, floor, rooms, map, objects) {
    const TILE = DR.TILE || {};
    const floorType = TILE.CAVE_FLOOR;
    const wallType = TILE.CAVE_WALL;
    const size = map.length || 200;
    const seedBase = Math.max(1, Math.floor(safeNumber(floor, 1))) * 131;
    const sourceRooms = (rooms || []).filter(r => {
      const k = String(r.kind || '').toLowerCase();
      return k === 'combat' || k === 'egg_room' || k === 'web_choke';
    });
    const dirs = [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4], [0, -1], [0, 1]];
    const added = [];
    let placed = 0;
    const maxPockets = floor === 1 ? 6 : floor === 2 ? 8 : 9;
    const isCarvable = (cx, cy, rw, rh) => {
      // require the pocket footprint to land in dead wall (don't overwrite other rooms)
      let wall = 0, total = 0;
      for (let y = Math.floor(cy - rh / 2) - 1; y <= Math.ceil(cy + rh / 2) + 1; y++) {
        for (let x = Math.floor(cx - rw / 2) - 1; x <= Math.ceil(cx + rw / 2) + 1; x++) {
          const tile = map[y]?.[x]; if (!tile) return false;
          total++; if (tile.type === wallType) wall++;
        }
      }
      return total > 0 && wall / total > 0.8;
    };
    for (let i = 0; i < sourceRooms.length && placed < maxPockets; i++) {
      const room = sourceRooms[i];
      const smallCavern = (seedBase + i) % 3 !== 0; // ~2/3 small, ~1/3 medium pocket
      const rw = smallCavern ? 14 + ((seedBase + i) % 4) : 22 + ((seedBase + i) % 6);
      const rh = smallCavern ? 11 + ((seedBase + i * 2) % 4) : 16 + ((seedBase + i) % 5);
      const dir = dirs[(seedBase + i) % dirs.length];
      const dist = Math.max(room.w, room.h) * 0.6 + rw * 0.7;
      const px = Math.round(clamp(room.x + dir[0] * dist, 8, size - 9));
      const py = Math.round(clamp(room.y + dir[1] * dist, 8, size - 9));
      if (!isCarvable(px, py, rw, rh)) continue;
      const pocket = {
        id: `${room.id}_pocket_${i}`,
        kind: smallCavern ? 'combat' : 'combat',
        name: smallCavern ? 'Silk Pocket Hollow' : 'Web-Choked Cavern',
        x: px, y: py, w: rw, h: rh,
        silkPocket: true, smallCavern,
        visualTags: smallCavern ? ['pocket', 'webs', 'bones'] : ['cavern', 'large_webs', 'junk']
      };
      carveRoom(map, objects, pocket);
      carveCorridor(map, objects, { x: room.x, y: room.y }, { x: px, y: py }, 1); // narrow tunnel
      added.push(pocket);
      placed++;
    }
    for (const p of added) rooms.push(p);
    return added.length;
  }

  // V0.17.62 Phase 23: carve small cave fishing pools (real TILE.WATER tiles with
  // waterDepth) into the Silk Web Cavern floors so the fishing system has water to
  // fish. Pools sit inside room interiors (only existing carved CAVE_FLOOR is
  // converted, so they never punch through walls or corridors) at deterministic
  // offsets from fixed rooms - stable across runs. Shallow pools on floors 1-2, a
  // deep pool (waterDepth>=9) on floor 3 for the deep-water-only Broodpool Angler.
  function carveSilkWebFishingPools(map, objects, rooms, floor) {
    const TILE = DR.TILE || {};
    const water = TILE.WATER;
    if (water == null || !Array.isArray(rooms) || rooms.length < 3) return { pools: 0, tiles: 0 };
    const roomAt = frac => rooms[Math.min(rooms.length - 1, Math.max(0, Math.round(frac * (rooms.length - 1))))];
    const carvePool = (room, offX, offY, rw, rh, depth) => {
      if (!room) return 0;
      const bx = Math.floor(room.x + offX), by = Math.floor(room.y + offY);
      let carved = 0;
      for (let y = by - rh; y <= by + rh; y++) {
        for (let x = bx - rw; x <= bx + rw; x++) {
          if (!map[y] || !map[y][x]) continue;
          const nx = (x - bx) / Math.max(1, rw), ny = (y - by) / Math.max(1, rh);
          if (nx * nx + ny * ny > 1.02) continue;
          if (map[y][x].type !== TILE.CAVE_FLOOR) continue; // stay inside carved room floor
          map[y][x] = { type: water, elev: 0, blocked: true, waterDepth: depth };
          if (objects[y]) objects[y][x] = null;
          carved++;
        }
      }
      return carved;
    };
    let pools = 0, tiles = 0;
    const add = n => { if (n > 0) { pools++; tiles += n; } };
    // V0.18.43: prefer rooms tagged as a water pool (matches the floor-plan pool locations);
    // fall back to the old index-based placement for floors without such tags.
    const poolRooms = (rooms || []).filter(r => (r.visualTags || []).some(t => /underground_pool|water_pool/.test(String(t))));
    const pick = frac => poolRooms.length ? poolRooms[Math.min(poolRooms.length - 1, Math.max(0, Math.round(frac * (poolRooms.length - 1))))] : roomAt(frac);
    if (floor === 1) {
      add(carvePool(pick(0.5), 5, -3, 3, 2, 5));   // shallow
    } else if (floor === 2) {
      add(carvePool(pick(0.0), -5, 3, 3, 2, 5));   // shallow
      add(carvePool(pick(1.0), 5, -3, 3, 2, 7));   // deeper
    } else {
      add(carvePool(pick(0.0), -5, 3, 3, 2, 6));   // mid
      add(carvePool(pick(1.0), 5, -3, 3, 2, 10));  // deep broodpool (waterDepth>=9)
    }
    return { pools, tiles };
  }

  function placeWallRim(map, objects) {
    const TILE = DR.TILE || {};
    const wallType = TILE.CAVE_WALL;
    const floorType = TILE.CAVE_FLOOR;
    for (let y = 1; y < map.length - 1; y++) {
      for (let x = 1; x < map[y].length - 1; x++) {
        if (map[y][x].type !== wallType) continue;
        let nearFloor = false;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (map[y + oy]?.[x + ox]?.type === floorType) nearFloor = true;
          }
        }
        if (!nearFloor) continue;
        map[y][x].elev = 4;
        const r = (x * 928371 + y * 19237) % 100;
        if (r > 92 && !objects[y][x]) objects[y][x] = { type: 'rock' };
      }
    }
  }

  function puzzleForFloor(game, dungeon, floor, index = 0) {
    const ids = Array.isArray(dungeon.puzzleIds) ? dungeon.puzzleIds.filter(Boolean) : [];
    if (!ids.length) return null;
    const id = ids[(Math.max(1, floor) - 1 + index) % ids.length];
    return puzzleDef(game, id) || null;
  }

  function clearDiskForObject(map, cx, cy, radius = 1) {
    const TILE = DR.TILE || {};
    const TILE_DEF = DR.TILE_DEF || {};
    const floorType = TILE.CAVE_FLOOR;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (!map[y]?.[x]) continue;
        map[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
      }
    }
  }

  function placeObjectNearRoom(map, objects, room, obj, offsetX = 0, offsetY = 0, blocked = false) {
    const x = clamp(Math.floor(room.x + offsetX), 2, (DR.CONFIG?.MAP_SIZE || 200) - 3);
    const y = clamp(Math.floor(room.y + offsetY), 2, (DR.CONFIG?.MAP_SIZE || 200) - 3);
    clearDiskForObject(map, x, y, blocked ? 0 : 1);
    objects[y][x] = obj;
    if (map[y]?.[x]) map[y][x].blocked = Boolean(blocked);
    return { x, y };
  }

  function placeGeneratedPuzzleObjects(game, dungeon, floor, rooms, map, objects) {
    const puzzleRooms = rooms.filter(room => room.kind === 'puzzle' || room.kind === 'web_choke' || room.kind === 'egg_room');
    if (!puzzleRooms.length) return;
    puzzleRooms.forEach((room, index) => {
      const puzzle = puzzleForFloor(game, dungeon, floor, index);
      if (!puzzle) return;
      const puzzleType = puzzle.puzzleType || 'sequence';
      const required = puzzleType === 'kill_and_unlock' ? 0 : clamp(Math.floor(safeNumber(puzzle.requiredSwitches, 3)), 1, 5);
      const instanceId = `${dungeon.id}:floor${floor}:${puzzle.id}:${index}`;
      const doorId = (Array.isArray(puzzle.successOpens) && puzzle.successOpens[0]) || `${instanceId}:door`;
      const keyId = `${instanceId}:key`;
      const lockId = `${instanceId}:lock`;
      const nextRoom = rooms[rooms.indexOf(room) + 1] || rooms[rooms.length - 1] || room;
      const doorRoom = {
        x: Math.round((room.x + nextRoom.x) / 2),
        y: Math.round((room.y + nextRoom.y) / 2),
        w: 6,
        h: 6
      };

      if (required > 0) {
        const positions = [
          { x: -6, y: -4 },
          { x: 6, y: -4 },
          { x: 0, y: 5 },
          { x: -8, y: 3 },
          { x: 8, y: 3 }
        ];
        for (let i = 0; i < required; i++) {
          const pos = positions[i % positions.length];
          placeObjectNearRoom(map, objects, room, {
            type: 'puzzleSwitch',
            id: `${instanceId}:switch:${i}`,
            switchId: `${instanceId}:switch:${i}`,
            puzzleId: puzzle.id,
            puzzleName: puzzle.name || puzzle.id,
            puzzleType,
            puzzleInstanceId: instanceId,
            dungeonId: dungeon.id,
            floor,
            sequenceIndex: i,
            totalSwitches: required,
            requiredSwitches: required,
            doorId,
            label: puzzle.label || String(i + 1),
            color: puzzle.color || '#fff08a',
            name: `${puzzle.name || 'Puzzle'} Switch ${i + 1}`,
            interactionRange: 2.15
          }, pos.x, pos.y, false);
        }

        placeObjectNearRoom(map, objects, room, {
          type: 'puzzleKey',
          id: keyId,
          keyId,
          linkedDoorId: doorId,
          puzzleId: puzzle.id,
          puzzleName: puzzle.name || puzzle.id,
          puzzleInstanceId: instanceId,
          dungeonId: dungeon.id,
          floor,
          label: 'K',
          color: '#75d069',
          name: `${puzzle.name || 'Puzzle'} Key`,
          interactionRange: 2.05
        }, -2, Math.floor(room.h / 3), false);

        placeObjectNearRoom(map, objects, doorRoom, {
          type: 'puzzleLock',
          id: lockId,
          lockId,
          keyId,
          linkedDoorId: doorId,
          puzzleId: puzzle.id,
          puzzleName: puzzle.name || puzzle.id,
          puzzleInstanceId: instanceId,
          dungeonId: dungeon.id,
          floor,
          label: 'L',
          color: '#fff08a',
          name: `${puzzle.name || 'Puzzle'} Lock`,
          interactionRange: 2.05
        }, -2, 0, false);
      }

      placeObjectNearRoom(map, objects, doorRoom, {
        type: 'puzzleDoor',
        id: doorId,
        doorId,
        keyId: required > 0 ? keyId : null,
        lockId: required > 0 ? lockId : null,
        puzzleId: puzzle.id,
        puzzleName: puzzle.name || puzzle.id,
        puzzleType,
        puzzleInstanceId: instanceId,
        dungeonId: dungeon.id,
        floor,
        label: 'D',
        color: puzzle.color || '#9fd7ff',
        name: `${puzzle.name || 'Puzzle'} Door`,
        interactionRange: 2.1,
        roomBounds: { x: room.x, y: room.y, radius: Math.max(room.w, room.h) * 0.72 }
      }, 0, 0, true);
    });
  }

  function createDungeonEnemy(game, type, room, dungeon, floor, level, options = {}) {
    const Enemy = DR.entities?.Enemy || DR.Enemy;
    if (!Enemy || !type) return null;
    const x = clamp(room.x + randInt(-Math.floor(room.w / 3), Math.floor(room.w / 3)), 2, (DR.CONFIG?.MAP_SIZE || 200) - 3) + 0.5;
    const y = clamp(room.y + randInt(-Math.floor(room.h / 3), Math.floor(room.h / 3)), 2, (DR.CONFIG?.MAP_SIZE || 200) - 3) + 0.5;
    const enemy = new Enemy(type, x, y, level);
    enemy.name = options.name || enemy.name;
    enemy.color = options.color || enemy.color || type.color;
    enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * safeNumber(options.hpMultiplier, 1)));
    enemy.hp = enemy.maxHp;
    enemy.attack = Math.max(1, Math.floor(enemy.attack * safeNumber(options.attackMultiplier, 1)));
    enemy.defense = Math.max(0, Math.floor(enemy.defense * safeNumber(options.defenseMultiplier, 1)));
    enemy.speed = Math.max(0.2, safeNumber(options.speed, enemy.speed));
    enemy.respawnTimer = 999999;
    enemy.noSelfRespawn = true;
    enemy.dungeonEnemy = true;
    enemy.dungeonId = dungeon.id;
    enemy.dungeonFloor = floor;
    enemy.dungeonRoomKind = room.kind;
    enemy.elite = Boolean(options.elite);
    enemy.dungeonElite = Boolean(options.dungeonElite);
    enemy.lootRolls = Math.max(1, Math.floor(safeNumber(options.lootRolls, 1)));
    enemy.lootTableId = options.lootTableId || dungeon.lootTableId || 'loot_dungeon_chest';
    enemy.baseType = {
      ...(enemy.baseType || type),
      name: options.baseName || type.name || enemy.name,
      lootTableId: enemy.lootTableId,
      xp: Math.floor(safeNumber(type.xp, 10) * safeNumber(options.xpMultiplier, 1)),
      gold: options.gold ?? type.gold ?? 0,
      aggroRadius: safeNumber(options.aggroRadius, type.aggroRadius || 8),
      leashRadius: safeNumber(options.leashRadius, type.leashRadius || 18)
    };
    return enemy;
  }

  function createBossEnemy(game, dungeon, floor, room) {
    const draft = bossForFloor(game, dungeon, floor);
    if (!draft) return null;
    const level = Math.max(1, Math.floor(safeNumber(dungeon.minLevel, 1)) + Math.floor(safeNumber(floor, 1)) - 1 + Math.floor(safeNumber(draft.levelOffset, 0)));
    const type = {
      name: draft.name || draft.id,
      color: draft.color || '#e65d4f',
      hp: Math.max(1, Math.floor(safeNumber(draft.hp, 400))),
      attack: Math.max(1, Math.floor(safeNumber(draft.attack, 25))),
      defense: Math.max(0, Math.floor(safeNumber(draft.defense, 8))),
      speed: Math.max(0.2, safeNumber(draft.speed, 1.35)),
      xp: Math.max(1, Math.floor(safeNumber(draft.xp, 250))),
      gold: draft.gold || { min: 45, max: 90 },
      lootTableId: draft.lootTableId || dungeon.lootTableId || 'loot_dungeon_chest',
      aggroRadius: 11,
      leashRadius: 24
    };
    const boss = createDungeonEnemy(game, type, room, dungeon, floor, level, {
      name: draft.name || draft.id,
      baseName: draft.name || draft.id,
      color: draft.color || type.color,
      hpMultiplier: 1,
      attackMultiplier: 1,
      defenseMultiplier: 1,
      xpMultiplier: 1,
      lootTableId: draft.lootTableId || dungeon.lootTableId || 'loot_dungeon_chest',
      lootRolls: 1,
      elite: true,
      dungeonElite: false,
      gold: draft.gold || type.gold,
      speed: draft.speed || type.speed,
      aggroRadius: 11,
      leashRadius: 24
    });
    if (!boss) return null;
    boss.dungeonBoss = true;
    boss.bossEnemy = true;
    boss.bossId = draft.id;
    boss.bossDraft = cloneJson(draft);
    boss.bossAbilityTimer = 2.2 + Math.random() * 1.8;
    boss.bossPhase = 1;
    boss.nameplateRange = 24;
    boss.range = 1.75;
    return boss;
  }


  const SILK_WEB_CAVERN_ID = 'silk_web_cavern';
  const SILK_WEB_ENCOUNTER_GROUPS = Object.freeze({
    smallSpiderPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Webling Skitterer', count: 2, elite: false }),
        Object.freeze({ type: 'Thorn Widow', count: 1, elite: false })
      ]),
      spacing: 1.55,
      patrolRadius: 4.5
    }),
    weblingSwarm: Object.freeze({
      members: Object.freeze([Object.freeze({ type: 'Webling Skitterer', count: 4, elite: false })]),
      spacing: 1.35,
      patrolRadius: 5.0
    }),
    venomSpiderPair: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Venom Sac Spider Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Thorn Widow', count: 1, elite: false })
      ]),
      spacing: 1.8,
      patrolRadius: 3.8
    }),
    eliteWebguardPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Webguard Spinner Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Webbed Cave Skitterer Elite', count: 2, elite: true })
      ]),
      spacing: 1.9,
      patrolRadius: 3.5
    }),
    cocoonGuardPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Cocoon Crawler Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Webling Skitterer', count: 2, elite: false })
      ]),
      spacing: 1.7,
      patrolRadius: 3.5
    }),
    venomNestPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Venom Burster Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Pale Cave Widow Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Webling Skitterer', count: 1, elite: false })
      ]),
      spacing: 2.0,
      patrolRadius: 3.6
    }),
    warrenCasterPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Brood Spinner Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Cocoon Binder Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Webbed Cave Skitterer Elite', count: 1, elite: true })
      ]),
      spacing: 2.0,
      patrolRadius: 4.0
    }),
    hatcheryGuardPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Hatchery Defender Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Brood Spinner Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Webling Skitterer', count: 2, elite: false })
      ]),
      spacing: 2.0,
      patrolRadius: 3.5
    }),
    royalWebguardPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Royal Webguard Elite', count: 2, elite: true }),
        Object.freeze({ type: "Queen's Silk Reaver Elite", count: 1, elite: true })
      ]),
      spacing: 2.2,
      patrolRadius: 3.5
    }),
    royalCasterPack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Gloom Brood Oracle Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Loom Spinner Elite', count: 1, elite: true }),
        Object.freeze({ type: 'Royal Webguard Elite', count: 1, elite: true })
      ]),
      spacing: 2.2,
      patrolRadius: 3.8
    }),
    chitinBrutePack: Object.freeze({
      members: Object.freeze([
        Object.freeze({ type: 'Chitin Horror Elite', count: 1, elite: true }),
        Object.freeze({ type: "Queen's Silk Reaver Elite", count: 2, elite: true })
      ]),
      spacing: 2.3,
      patrolRadius: 3.2
    })
  });

  const SILK_WEB_PACK_OFFSETS = Object.freeze([
    Object.freeze([0, 0]), Object.freeze([-3, 1]), Object.freeze([3, 1]), Object.freeze([-2, -3]),
    Object.freeze([2, -3]), Object.freeze([-5, -2]), Object.freeze([5, -2]), Object.freeze([0, 4])
  ]);

  const SILK_WEB_FLOOR_CONFIG = {
    1: {
      id: 'silk_web_cavern_f1_outer_webworks', name: 'The Outer Webworks', levelMin: 6, levelMax: 7,
      eliteTarget: 30,
      visualTheme: 'outer_webworks',
      // V0.18.43: Floor 1 rebuilt to match the "Silk Web Caverns" floor plan. Left-to-right
      // flow: Entrance -> Webbed Tunnels -> Spider Cavern (pool + safe camp) -> {Web Bridge
      // Room, Egg Sacs Chamber} -> web gate -> Broodmother Arachnis (boss) -> descent. The
      // gate is the only way to the boss and opens once Threadjaw Alpha (the mini-boss in
      // the Broodwarden Approach) is dead. A collapsed dead-end pocket hangs off the egg
      // chamber. Every room is on a connected path (boss reachability guaranteed).
      rooms: [
        { id:'safe_entry', kind:'safe_entry', name:'Lantern-Safe Entry Alcove', x:28, y:104, w:26, h:20, visualTags:['safe','lantern','open','camp'] },
        { id:'webbed_tunnels', kind:'web_choke', name:'Webbed Tunnels', x:56, y:90, w:28, h:18, visualTags:['web_curtains','tunnels','narrow'] },
        { id:'spider_cavern', kind:'combat', name:'Spider Cavern', x:88, y:110, w:50, h:38, visualTags:['den','large_webs','underground_pool','camp'] },
        { id:'web_bridge_room', kind:'web_choke', name:'Web Bridge Room', x:118, y:76, w:36, h:20, visualTags:['bridge','web','pit'] },
        { id:'egg_sacs_chamber', kind:'egg_room', name:'Egg Sacs Chamber', x:118, y:138, w:42, h:26, visualTags:['eggs','egg_sacs','brood'] },
        { id:'brood_approach', kind:'combat', name:'Broodwarden Approach', x:148, y:68, w:32, h:20, visualTags:['brood','miniboss','bones'] },
        { id:'gate', kind:'puzzle', name:'Sealed Web Gate', x:146, y:108, w:30, h:22, visualTags:['gate','anchors','web_obstacle'] },
        { id:'silk_dead_end', kind:'combat', name:'Collapsed Silk Pocket', x:128, y:166, w:20, h:14, visualTags:['dead_end','bones','webbed_weapons'] },
        { id:'boss', kind:'boss', name:'Broodmother Arachnis Den', x:180, y:108, w:44, h:38, visualTags:['boss','brood_sacs','arena'] },
        { id:'treasure', kind:'treasure', name:'Silk Descent Drop', x:180, y:64, w:24, h:14, visualTags:['descent','treasure'] }
      ],
      links: [['safe_entry','webbed_tunnels'],['webbed_tunnels','spider_cavern'],['spider_cavern','web_bridge_room'],['spider_cavern','egg_sacs_chamber'],['web_bridge_room','brood_approach'],['egg_sacs_chamber','gate'],['brood_approach','gate'],['egg_sacs_chamber','silk_dead_end'],['gate','boss'],['boss','treasure']],
      encounters: [
        { id:'f1_tunnels_pack', room:'webbed_tunnels', group:'smallSpiderPack', offsetX:0, offsetY:1, patrol:true },
        { id:'f1_cavern_swarm', room:'spider_cavern', group:'weblingSwarm', offsetX:-6, offsetY:2, patrol:true },
        { id:'f1_cavern_guard', room:'spider_cavern', group:'eliteWebguardPack', offsetX:8, offsetY:-2 },
        { id:'f1_bridge_pack', room:'web_bridge_room', group:'venomSpiderPair', offsetX:0, offsetY:1, patrol:true },
        { id:'f1_egg_guard', room:'egg_sacs_chamber', group:'cocoonGuardPack', offsetX:-4, offsetY:2 },
        { id:'f1_approach_guard', room:'brood_approach', group:'eliteWebguardPack', offsetX:0, offsetY:2 },
        { id:'f1_gate_guard', room:'gate', group:'venomSpiderPair', offsetX:0, offsetY:4 },
        { id:'f1_deadend_pack', room:'silk_dead_end', group:'cocoonGuardPack', offsetX:0, offsetY:0 }
      ],
      objectives: [
        { id:'f1_moss_1', room:'webbed_tunnels', kind:'cave_moss', offsetX:-6, offsetY:4 },
        { id:'f1_moss_2', room:'web_bridge_room', kind:'cave_moss', offsetX:8, offsetY:4 },
        { id:'f1_silk_1', room:'spider_cavern', kind:'silk_bundle', offsetX:-12, offsetY:-6 },
        { id:'f1_silk_2', room:'egg_sacs_chamber', kind:'silk_bundle', offsetX:10, offsetY:4 },
        { id:'f1_venom_nest_1', room:'gate', kind:'venom_nest', offsetX:8, offsetY:4 }
      ],
      chests: [{ id:'f1_egg_cache', room:'egg_sacs_chamber', offsetX:10, offsetY:-5 }, { id:'f1_deadend_cache', room:'silk_dead_end', offsetX:0, offsetY:0 }],
      elites: ['Webbed Cave Skitterer Elite','Silkfang Stalker Elite','Venom Sac Spider Elite','Cocoon Crawler Elite','Webguard Spinner Elite'],
      minibosses: [{ id:'miniboss_threadjaw_alpha', room:'brood_approach', name:'Threadjaw Alpha' }],
      bossId: 'boss_broodwarden_skirr', puzzleId: 'puzzle_silk_web_gate_f1'
    },
    2: {
      id: 'silk_web_cavern_f2_cocoon_warrens', name: 'The Cocoon Warrens', levelMin: 8, levelMax: 9,
      eliteTarget: 38,
      visualTheme: 'cocoon_warrens',
      // V0.18.44: Floor 2 rebuilt to the floor plan. Stairs Down -> Echoing Cavern ->
      // Webbed Alcove (mini-boss: The Cocoon Tender) -> Underground Pool (large, pool +
      // safe camp) -> Nesting Grounds (mini-boss: Pale Spinner Yssra) -> web gate ->
      // Chasm Overlook (boss) -> descent. A collapsed ledge hangs off the pool as a dead
      // end. Both mini-bosses gate the boss (killing them opens the gate).
      rooms: [
        { id:'descent', kind:'safe_entry', name:'Deep Descent Tunnel', x:28, y:104, w:26, h:20, visualTags:['entry','descent','camp'] },
        { id:'echoing_cavern', kind:'combat', name:'Echoing Cavern', x:54, y:100, w:34, h:26, visualTags:['echo','stalactites','webs'] },
        { id:'webbed_alcove', kind:'combat', name:'Webbed Alcove', x:80, y:70, w:32, h:22, visualTags:['cocoons','hanging_cocoons','miniboss'] },
        { id:'underground_pool', kind:'combat', name:'Underground Pool', x:104, y:112, w:50, h:38, visualTags:['den','large_webs','underground_pool','camp'] },
        { id:'nesting_grounds', kind:'egg_room', name:'Nesting Grounds', x:138, y:94, w:40, h:26, visualTags:['eggs','egg_sacs','brood','miniboss'] },
        { id:'gate', kind:'puzzle', name:'Sealed Silk Gate', x:150, y:68, w:28, h:20, visualTags:['gate','anchors','web_obstacle'] },
        { id:'chasm_dead_end', kind:'combat', name:'Collapsed Chasm Ledge', x:138, y:152, w:20, h:14, visualTags:['dead_end','pit','bones'] },
        { id:'boss', kind:'boss', name:'Chasm Overlook', x:178, y:100, w:46, h:38, visualTags:['boss','seer','poison_clouds','arena'] },
        { id:'treasure', kind:'treasure', name:'Deep Drop to the Queen\'s Loom', x:178, y:58, w:24, h:14, visualTags:['drop','descent'] }
      ],
      links: [['descent','echoing_cavern'],['echoing_cavern','webbed_alcove'],['echoing_cavern','underground_pool'],['webbed_alcove','underground_pool'],['webbed_alcove','gate'],['underground_pool','nesting_grounds'],['underground_pool','chasm_dead_end'],['nesting_grounds','gate'],['gate','boss'],['boss','treasure']],
      encounters: [
        { id:'f2_echo_pack', room:'echoing_cavern', group:'cocoonGuardPack', offsetX:0, offsetY:1, patrol:true },
        { id:'f2_alcove_guard', room:'webbed_alcove', group:'hatcheryGuardPack', offsetX:0, offsetY:2 },
        { id:'f2_pool_swarm', room:'underground_pool', group:'warrenCasterPack', offsetX:-6, offsetY:2, patrol:true },
        { id:'f2_pool_guard', room:'underground_pool', group:'venomNestPack', offsetX:8, offsetY:-2 },
        { id:'f2_nesting_guard', room:'nesting_grounds', group:'hatcheryGuardPack', offsetX:0, offsetY:2 },
        { id:'f2_gate_guard', room:'gate', group:'venomSpiderPair', offsetX:0, offsetY:4 },
        { id:'f2_deadend_pack', room:'chasm_dead_end', group:'venomNestPack', offsetX:0, offsetY:0 }
      ],
      objectives: [
        { id:'f2_moss_1', room:'echoing_cavern', kind:'cave_moss', offsetX:-8, offsetY:5 },
        { id:'f2_silk_1', room:'underground_pool', kind:'silk_bundle', offsetX:-12, offsetY:-6 },
        { id:'f2_silk_2', room:'nesting_grounds', kind:'silk_bundle', offsetX:10, offsetY:4 },
        { id:'f2_venom_nest_1', room:'gate', kind:'venom_nest', offsetX:8, offsetY:4 },
        { id:'f2_venom_nest_2', room:'chasm_dead_end', kind:'venom_nest', offsetX:0, offsetY:0 }
      ],
      chests: [
        { id:'f2_pool_cache', room:'underground_pool', offsetX:12, offsetY:-6 },
        { id:'f2_deadend_cache', room:'chasm_dead_end', offsetX:0, offsetY:0 }
      ],
      elites: ['Brood Spinner Elite','Pale Cave Widow Elite','Hatchery Defender Elite','Cocoon Binder Elite','Venom Burster Elite'],
      minibosses: [{ id:'miniboss_cocoon_tender', room:'webbed_alcove', name:'The Cocoon Tender' }, { id:'miniboss_pale_spinner_yssra', room:'nesting_grounds', name:'Pale Spinner Yssra' }],
      bossId: 'boss_matron_velyra', puzzleId: 'puzzle_silk_web_gate_f2'
    },
    3: {
      id: 'silk_web_cavern_f3_queens_loom', name: "The Queen's Loom", levelMin: 10, levelMax: 10,
      eliteTarget: 42,
      visualTheme: 'queens_loom',
      // V0.18.44: Floor 3 rebuilt to the floor plan. Stairs Down -> Silk Cocoon Hall
      // (mini-boss: Chitinmaw) -> The Great Nest (huge central cavern) -> Brood Nursery
      // (mini-boss: Widow of the Loom) -> the Chitin Gauntlet (gate) -> Matriarch's Lair
      // (boss, with a broodpool) -> exit thread. A silk-choked hollow hangs off the Great
      // Nest as a dead end. The two mini-bosses gate the boss.
      rooms: [
        { id:'royal_descent', kind:'safe_entry', name:'Royal Web Descent', x:28, y:104, w:26, h:20, visualTags:['royal_entry','silk_columns','camp'] },
        { id:'silk_cocoon_hall', kind:'combat', name:'Silk Cocoon Hall', x:54, y:100, w:36, h:26, visualTags:['cocoons','hanging_cocoons','miniboss','royal_silk'] },
        { id:'great_nest', kind:'combat', name:'The Great Nest', x:94, y:110, w:52, h:40, visualTags:['den','great_nest','large_webs','royal_brood'] },
        { id:'brood_nursery', kind:'egg_room', name:'Brood Nursery', x:126, y:74, w:42, h:26, visualTags:['eggs','royal_brood','brood_growths','miniboss'] },
        { id:'gauntlet', kind:'puzzle', name:'The Chitin Gauntlet', x:148, y:104, w:30, h:22, visualTags:['gauntlet','chitin_arches','web_obstacle','gate','anchors'] },
        { id:'nest_dead_end', kind:'combat', name:'Silk-Choked Hollow', x:104, y:158, w:20, h:14, visualTags:['dead_end','bones','webbed_weapons'] },
        { id:'boss', kind:'boss', name:"Matriarch's Lair", x:178, y:104, w:48, h:40, visualTags:['queen','throne','arena','royal_brood','underground_pool'] },
        { id:'treasure', kind:'treasure', name:'Treasure Web / Exit Thread', x:178, y:60, w:26, h:12, visualTags:['treasure','exit_thread'] }
      ],
      links: [['royal_descent','silk_cocoon_hall'],['silk_cocoon_hall','great_nest'],['great_nest','brood_nursery'],['great_nest','nest_dead_end'],['great_nest','gauntlet'],['brood_nursery','gauntlet'],['gauntlet','boss'],['boss','treasure']],
      encounters: [
        { id:'f3_cocoon_guard', room:'silk_cocoon_hall', group:'royalWebguardPack', offsetX:0, offsetY:2 },
        { id:'f3_nest_swarm', room:'great_nest', group:'chitinBrutePack', offsetX:-6, offsetY:2, patrol:true },
        { id:'f3_nest_caster', room:'great_nest', group:'royalCasterPack', offsetX:8, offsetY:-2 },
        { id:'f3_nursery_guard', room:'brood_nursery', group:'royalWebguardPack', offsetX:0, offsetY:2 },
        { id:'f3_gauntlet_guard', room:'gauntlet', group:'chitinBrutePack', offsetX:0, offsetY:3 },
        { id:'f3_deadend_pack', room:'nest_dead_end', group:'royalCasterPack', offsetX:0, offsetY:0 }
      ],
      objectives: [
        { id:'f3_venom_nest_1', room:'great_nest', kind:'venom_nest', offsetX:-12, offsetY:7 },
        { id:'f3_venom_nest_2', room:'brood_nursery', kind:'venom_nest', offsetX:10, offsetY:5 }
      ],
      chests: [{ id:'f3_nest_cache', room:'great_nest', offsetX:12, offsetY:-7 }, { id:'f3_deadend_cache', room:'nest_dead_end', offsetX:0, offsetY:0 }],
      elites: ['Royal Webguard Elite',"Queen's Silk Reaver Elite",'Gloom Brood Oracle Elite','Chitin Horror Elite','Loom Spinner Elite'],
      minibosses: [{ id:'miniboss_chitinmaw', room:'silk_cocoon_hall', name:'Chitinmaw' }, { id:'miniboss_widow_of_the_loom', room:'brood_nursery', name:'Widow of the Loom' }],
      bossId: 'boss_queen_arakhzel', puzzleId: 'puzzle_silk_web_gate_f3'
    }
  };


  const SILK_WEB_GATE_REQUIREMENTS = {
    1: { miniBossIds: ['miniboss_threadjaw_alpha'], label: 'Threadjaw Alpha' },
    2: { miniBossIds: ['miniboss_cocoon_tender', 'miniboss_pale_spinner_yssra'], label: 'the Cocoon Tender and Pale Spinner Yssra' },
    3: { miniBossIds: ['miniboss_chitinmaw', 'miniboss_widow_of_the_loom'], label: 'Chitinmaw and the Widow of the Loom' }
  };


  const SILK_WEB_COMBAT_TUNING = {
    elite: {
      1: { hp: 1.92, attack: 1.18, defense: 1.10, cooldownBias: 1.12, hazardScale: 0.78 },
      2: { hp: 2.04, attack: 1.25, defense: 1.14, cooldownBias: 1.04, hazardScale: 0.88 },
      3: { hp: 2.12, attack: 1.31, defense: 1.18, cooldownBias: 0.98, hazardScale: 0.96 }
    },
    miniboss: {
      1: { hp: 0.92, attack: 0.90, cooldownBias: 1.15 },
      2: { hp: 0.96, attack: 0.94, cooldownBias: 1.07 },
      3: { hp: 1.00, attack: 0.98, cooldownBias: 1.00 }
    },
    boss: {
      1: { hp: 0.96, attack: 0.90, cooldownBias: 1.18 },
      2: { hp: 1.00, attack: 0.94, cooldownBias: 1.08 },
      3: { hp: 1.04, attack: 0.98, cooldownBias: 1.00 }
    },
    hazardTickSeconds: 0.82,
    bossCocoonSeconds: 7.5,
    bossCocoonHpPct: 0.18,
    maxActiveBossAdds: 8
  };

  const SILK_WEB_TRAP_HOLD_SECONDS = 5.0;
  const SILK_WEB_TRAP_HOLD_MS = SILK_WEB_TRAP_HOLD_SECONDS * 1000;

  function silkTuning(rank, floor) {
    const key = String(rank || 'elite');
    const f = clamp(Math.floor(safeNumber(floor, 1)), 1, 3);
    return SILK_WEB_COMBAT_TUNING[key]?.[f] || SILK_WEB_COMBAT_TUNING.elite[f] || SILK_WEB_COMBAT_TUNING.elite[1];
  }

  function applySilkEnemyBalance(enemy, floor, rank = 'elite') {
    if (!enemy) return enemy;
    const tuning = silkTuning(rank, floor);
    enemy.silkWebBalanceRank = rank;
    enemy.silkWebFloor = clamp(Math.floor(safeNumber(floor, 1)), 1, 3);
    if (rank !== 'elite') {
      enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * safeNumber(tuning.hp, 1)));
      enemy.hp = Math.min(enemy.maxHp, enemy.maxHp);
      enemy.attack = Math.max(1, Math.floor(enemy.attack * safeNumber(tuning.attack, 1)));
    }
    enemy.bossCooldownBias = safeNumber(tuning.cooldownBias, 1);
    enemy.hazardDamageScale = safeNumber(tuning.hazardScale, 1);
    enemy.baseType = {
      ...(enemy.baseType || {}),
      aggroRadius: Math.min(safeNumber(enemy.baseType?.aggroRadius, 8), rank === 'boss' ? 10.5 : rank === 'miniboss' ? 9.5 : 7.5),
      leashRadius: Math.max(safeNumber(enemy.baseType?.leashRadius, 18), rank === 'boss' ? 28 : rank === 'miniboss' ? 24 : 20)
    };
    return enemy;
  }

  function silkStatusEffect(id, source = null, durationSeconds = 4.0, extra = {}) {
    const key = String(id || '').toLowerCase();
    if (key.includes('poison') || key.includes('venom')) {
      return {
        id: extra.id || 'silk_venom', name: extra.name || 'Silk Venom', type: 'dot', duration: durationSeconds,
        tickRate: Math.max(0.2, safeNumber(extra.tickRate, 2.0)),
        periodicDamage: Math.max(1, Math.floor(safeNumber(extra.periodicDamage, 2))),
        maxStacks: Math.max(1, Math.floor(safeNumber(extra.maxStacks, 1))),
        tags: ['poison', 'dot', 'debuff'], cleanseType: 'poison', isCurable: extra.isCurable !== false,
        color: extra.color || '#83d873', hostile: true, sourceName: source?.name || extra.sourceName || 'Silk Web Cavern',
        description: extra.description || ''
      };
    }
    if (key.includes('cocoon')) {
      return { id: extra.id || 'cocoon_prison', name: extra.name || 'Cocoon Prison', type: 'control', duration: durationSeconds, tags: ['root'], mods: { speed: -999 }, color: '#d8c8f2', hostile: true, sourceName: source?.name || extra.sourceName || 'Silk Web Cavern' };
    }
    return { id: extra.id || 'webbed', name: extra.name || 'Webbed', type: 'control', duration: durationSeconds, tags: ['root', 'slow'], mods: { speed: -999 }, color: '#d8c8f2', hostile: true, sourceName: source?.name || extra.sourceName || 'Silk Web Cavern', description: extra.description || '' };
  }

  function silkGroundWebStatusId(obj = {}) {
    const raw = String(obj.id || obj.objectId || `${obj.floor || 1}_${Math.floor(safeNumber(obj.x, 0))}_${Math.floor(safeNumber(obj.y, 0))}`);
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(-48) || 'trap';
    return `silk_ground_web_${slug}`;
  }

  function silkGroundWebRootEffect(obj, remainingSeconds) {
    const seconds = clamp(safeNumber(remainingSeconds, SILK_WEB_TRAP_HOLD_SECONDS), 0.05, SILK_WEB_TRAP_HOLD_SECONDS);
    return silkStatusEffect('ground_web_trap', obj, seconds, {
      id: silkGroundWebStatusId(obj),
      name: 'Spider Web Trap',
      sourceName: obj?.name || 'Thick Webbing',
      description: 'Immobilized by a ground web. The web snaps after 5 seconds.'
    });
  }

  function silkWebTrapTargets(game) {
    const partyBots = (game?.botPlayers || []).filter(bot => bot && bot.alive && game.isBotInParty?.(bot) && bot.zone === game.currentZone);
    return [game?.player, game?.merc, game?.pet, ...partyBots].filter(target => target && target.alive);
  }

  function breakSilkWebTrap(game, obj, reason = 'expired') {
    if (!obj || obj.type !== 'webHazard' || obj.broken === true) return false;
    const now = nowMs();
    obj.broken = true;
    obj.triggered = true;
    obj.breakReason = reason;
    obj.brokenAt = now;
    obj.name = 'Snapped Webbing';
    obj.color = '#8f82aa';
    obj.hazardKind = 'snapped_web';
    const statusId = silkGroundWebStatusId(obj);
    for (const target of silkWebTrapTargets(game)) {
      game?.removeStatusEffect?.(target, statusId);
      if (target?._silkWebTrapIds) delete target._silkWebTrapIds[statusId];
      target._forcePathRecalcAt = performance.now();
    }
    game?.spawnRing?.((safeNumber(obj.x, 0) || 0) + 0.5, (safeNumber(obj.y, 0) || 0) + 0.5, obj.color || '#d8c8f2', 14);
    return true;
  }

  function placeTemporaryDungeonObject(game, obj, x, y, radius = 4) {
    const spot = findWalkableNear(game.dungeonMap || game.map || [], game.dungeonObjects || game.objects || [], x, y, radius);
    if (!spot) return null;
    const tx = Math.floor(spot.x), ty = Math.floor(spot.y);
    if (!game.objects?.[ty]) return null;
    const placed = { ...obj, x: tx, y: ty, dungeonId: 'silk_web_cavern', floor: game.dungeonSystem?.state?.active?.floor || game.activeDungeon?.floor || 1 };
    game.objects[ty][tx] = placed;
    if (game.dungeonObjects && game.dungeonObjects !== game.objects) game.dungeonObjects[ty][tx] = placed;
    return placed;
  }

  function releaseCocoonedTarget(game, cocoon, reason = 'released') {
    if (!cocoon) return false;
    const all = [game.player, game.merc, game.pet, ...(game.botPlayers || [])].filter(Boolean);
    const target = all.find(actor => String(actor.id) === String(cocoon.prisonerId) || actor.name === cocoon.prisonerName);
    if (target) {
      game.removeStatusEffect?.(target, 'cocoon_prison');
      target.cocoonPrisonUntil = 0;
      target.currentActivityLabel = reason === 'broken' ? 'Freed' : target.currentActivityLabel;
    }
    if (game.objects?.[cocoon.y]?.[cocoon.x] === cocoon) game.objects[cocoon.y][cocoon.x] = null;
    if (game.dungeonObjects?.[cocoon.y]?.[cocoon.x] === cocoon) game.dungeonObjects[cocoon.y][cocoon.x] = null;
    game.spawnRing?.(cocoon.x + 0.5, cocoon.y + 0.5, reason === 'broken' ? '#8df0bc' : '#d8c8f2', 18);
    return true;
  }

  function silkGateMiniBossesDefeated(state, floor) {
    const required = SILK_WEB_GATE_REQUIREMENTS[Math.max(1, Math.floor(safeNumber(floor, 1)))]?.miniBossIds || [];
    if (!required.length) return true;
    return required.every(id => Boolean(state?.miniBossKills?.[miniBossKillKey(state, id, floor)]));
  }

  function silkGateMissingMiniBossLabel(state, floor) {
    const req = SILK_WEB_GATE_REQUIREMENTS[Math.max(1, Math.floor(safeNumber(floor, 1)))] || null;
    if (!req) return '';
    const missing = (req.miniBossIds || []).filter(id => !state?.miniBossKills?.[miniBossKillKey(state, id, floor)]);
    if (!missing.length) return '';
    return req.label || missing.join(', ');
  }

  function isSilkWebCavern(dungeon) {
    return String(dungeon?.id || dungeon?.dungeonId || '').toLowerCase() === SILK_WEB_CAVERN_ID;
  }


  function silkWebFriendlyCombatCandidates(game) {
    const currentZone = game?.currentZone || 'overworld';
    const partyBots = (game?.botPlayers || []).filter(bot => bot && bot.alive && game.isBotInParty?.(bot) && (bot.zone || currentZone) === currentZone);
    const actors = [game?.player, game?.merc, game?.pet, ...partyBots];
    const seen = new Set();
    return actors.filter(actor => {
      if (!actor || actor.alive === false || !Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) return false;
      const id = String(actor.id ?? actor.name ?? `${actor.kind || 'actor'}:${actor.x}:${actor.y}`);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function isSilkWebBossActor(boss) {
    if (!boss) return false;
    const id = String(boss.bossId || boss.id || boss.baseType?.id || '').toLowerCase();
    const family = String(boss.baseType?.family || boss.family || '').toLowerCase();
    return Boolean(
      boss.silkWebCavern && (boss.dungeonBoss || boss.dungeonMiniBoss) ||
      id.startsWith('boss_broodwarden') || id.startsWith('boss_matron') || id.startsWith('boss_queen') || id.startsWith('miniboss_') ||
      family === 'silk_web_boss' || family === 'silk_web_miniboss'
    );
  }

  function silkWebBossArena(boss) {
    return boss?.bossArena || boss?.encounterArena || null;
  }

  // V0.18.45: true only once the player has walked WELL INSIDE the boss arena (past the
  // outer ring near the doorway), so the entrance seal can't slam shut while they're still
  // at the threshold and then let them slip back out.
  function playerFullyInsideSilkBossArena(game, boss, marginFrac = 0.68) {
    const arena = silkWebBossArena(boss);
    const p = game?.player;
    if (!arena || !p) return false;
    const halfW = Math.max(2, safeNumber(arena.w, 16) * 0.5) * marginFrac;
    const halfH = Math.max(2, safeNumber(arena.h, 12) * 0.5) * marginFrac;
    return Math.abs(p.x - arena.x) <= halfW && Math.abs(p.y - arena.y) <= halfH;
  }

  function actorInsideSilkWebBossArena(actor, boss, padding = 0) {
    const arena = silkWebBossArena(boss);
    if (!actor || !arena) return false;
    const ax = safeNumber(arena.x, boss?.x || 0);
    const ay = safeNumber(arena.y, boss?.y || 0);
    const halfW = Math.max(1, safeNumber(arena.w, 8) * 0.5) + Math.max(0, safeNumber(padding, 0));
    const halfH = Math.max(1, safeNumber(arena.h, 8) * 0.5) + Math.max(0, safeNumber(padding, 0));
    return Math.abs(safeNumber(actor.x, 0) - ax) <= halfW && Math.abs(safeNumber(actor.y, 0) - ay) <= halfH;
  }

  function resetSilkWebBossEngagementState(boss) {
    if (!boss || !isSilkWebBossActor(boss)) return false;
    boss.silkWebEncounterActive = false;
    boss.silkWebDormant = true;
    boss.aggro = false;
    boss.inCombat = false;
    boss.combatCooldown = 0;
    boss.combatTargetId = null;
    boss.targetId = null;
    boss.forcedTargetId = null;
    boss.forcedTargetTimer = 0;
    boss.threatTable = {};
    return true;
  }

  function silkWebBossThreatIsActive(boss) {
    if (!boss) return false;
    if (boss.aggro || boss.inCombat || boss.combatTargetId || boss.targetId || boss.forcedTargetId) return true;
    if (Number(boss.hp || 0) < Number(boss.maxHp || 0)) return true;
    const table = boss.threatTable || {};
    return Object.values(table).some(entry => Number(entry?.threat || 0) > 0.05);
  }

  function silkWebBossCanAcquireTarget(game, boss, actor, options = {}) {
    if (!actor || actor.alive === false || !boss || boss.alive === false) return false;
    if (!isSilkWebBossActor(boss)) return true;
    if (game?.currentZone !== 'dungeon' || game?.dungeonSystem?.state?.active?.dungeonId !== SILK_WEB_CAVERN_ID) return true;

    const arena = silkWebBossArena(boss);
    const baseAggro = safeNumber(boss.baseType?.aggroRadius || boss.aggroRadius, boss.dungeonMiniBoss ? 9.5 : 10.5);
    const leash = safeNumber(boss.baseType?.leashRadius || boss.leashRadius, boss.dungeonMiniBoss ? 24 : 28);
    const dx = safeNumber(actor.x, 0) - safeNumber(boss.x, 0);
    const dy = safeNumber(actor.y, 0) - safeNumber(boss.y, 0);
    const d = Math.hypot(dx, dy);
    const padding = safeNumber(options.arenaPadding, boss.dungeonMiniBoss ? 2.25 : 2.75);

    // Silk Web minibosses and bosses are room-locked encounters. They do not acquire
    // party targets from the dungeon entrance, adjacent hallways, healing threat, or
    // stale saved threat until a party actor actually enters the encounter arena.
    if (arena) {
      if (actorInsideSilkWebBossArena(actor, boss, padding)) {
        boss.silkWebEncounterActive = true;
        boss.silkWebDormant = false;
        return true;
      }
      if (!boss.silkWebEncounterActive || options.requireArenaEntry === true) return false;
      const continuationRange = Math.min(Math.max(baseAggro + 2.5, 10), leash + 0.75);
      return d <= continuationRange;
    }

    if (d <= baseAggro + 0.75) {
      boss.silkWebEncounterActive = true;
      boss.silkWebDormant = false;
      return true;
    }
    return boss.silkWebEncounterActive && d <= Math.min(Math.max(baseAggro + 2.5, 10), leash + 0.75);
  }

  function nearestSilkWebBossTarget(game, boss, range, options = {}) {
    if (!boss) return null;
    const maxRange = Math.max(0.5, safeNumber(range, 0));
    let best = null;
    let bestDSq = maxRange * maxRange;
    for (const actor of silkWebFriendlyCombatCandidates(game)) {
      if (!silkWebBossCanAcquireTarget(game, boss, actor, options)) continue;
      const dx = safeNumber(actor.x, 0) - safeNumber(boss.x, 0);
      const dy = safeNumber(actor.y, 0) - safeNumber(boss.y, 0);
      const dSq = dx * dx + dy * dy;
      if (dSq <= bestDSq) {
        best = actor;
        bestDSq = dSq;
      }
    }
    return best;
  }

  function silkWebBossEncounterEngaged(game, boss) {
    if (!boss || boss.alive === false || game?.currentZone !== 'dungeon') return false;
    const baseAggro = safeNumber(boss.baseType?.aggroRadius || boss.aggroRadius, boss.dungeonMiniBoss ? 9.5 : 10.5);
    const leash = safeNumber(boss.baseType?.leashRadius || boss.leashRadius, boss.dungeonMiniBoss ? 24 : 28);
    const arena = silkWebBossArena(boss);
    const entryRange = arena ? Math.max(baseAggro + 0.75, Math.hypot(safeNumber(arena.w, 8) * 0.5, safeNumber(arena.h, 8) * 0.5) + 3.0) : baseAggro + 0.75;
    const entryTarget = nearestSilkWebBossTarget(game, boss, entryRange, { requireArenaEntry: true });
    if (entryTarget) return true;
    if (!boss.silkWebEncounterActive) {
      if (silkWebBossThreatIsActive(boss)) resetSilkWebBossEngagementState(boss);
      return false;
    }
    const activeRange = Math.min(Math.max(baseAggro + 2.5, 10), leash + 0.75);
    const activeTarget = nearestSilkWebBossTarget(game, boss, activeRange, { requireArenaEntry: false });
    if (activeTarget) return true;
    if (Number(boss.hp || 0) >= Number(boss.maxHp || 0)) resetSilkWebBossEngagementState(boss);
    return false;
  }

  DR.SilkWebEncounterGate = {
    isBossLike: isSilkWebBossActor,
    canAcquireTarget: silkWebBossCanAcquireTarget,
    resetBossState: resetSilkWebBossEngagementState,
    actorInsideArena: actorInsideSilkWebBossArena
  };

  function roomById(rooms, id) {
    return rooms.find(room => room.id === id) || rooms.find(room => room.kind === id) || rooms[0];
  }

  function silkObjectKey(state, obj) {
    return `${currentRunId(state)}:object:${obj?.id || obj?.objectId || obj?.type || 'object'}`;
  }

  function gateKey(state, obj) {
    return `${currentRunId(state)}:gate:${obj?.gateId || obj?.id || 'gate'}`;
  }

  function findWalkableNear(map, objects, cx, cy, radius = 5) {
    let best = null;
    let bestD = Infinity;
    const size = map?.length || (DR.CONFIG?.MAP_SIZE || 200);
    for (let r = 0; r <= radius; r++) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) continue;
          const tile = map[y]?.[x];
          if (!tile || tile.blocked) continue;
          const obj = objects?.[y]?.[x];
          if (obj && !['webHazard','venomSack','venomSackBurst','webBridge'].includes(obj.type)) continue;
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5 }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function dungeonTileKey(x, y) {
    return `${Math.floor(x)},${Math.floor(y)}`;
  }

  function dungeonTraversalTile(map, objects, x, y) {
    const tile = map?.[y]?.[x];
    if (!tile) return false;
    const object = objects?.[y]?.[x];
    const passableGate = ['webGate', 'puzzleDoor', 'dungeonStairs', 'dungeonExit', 'webBridge'].includes(object?.type);
    if (tile.blocked && !passableGate) return false;
    const definition = DR.TILE_DEF?.[tile.type];
    if (definition && definition.walk === false && !passableGate) return false;
    return true;
  }

  function buildDungeonReachableTiles(map, objects, startX, startY) {
    const reachable = new Set();
    if (!map?.length) return reachable;
    const start = findWalkableNear(map, objects, startX, startY, 8);
    if (!start) return reachable;
    const queue = [[Math.floor(start.x), Math.floor(start.y)]];
    reachable.add(dungeonTileKey(queue[0][0], queue[0][1]));
    for (let index = 0; index < queue.length; index++) {
      const [x, y] = queue[index];
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = dungeonTileKey(nx, ny);
        if (reachable.has(key) || !dungeonTraversalTile(map, objects, nx, ny)) continue;
        reachable.add(key);
        queue.push([nx, ny]);
      }
    }
    return reachable;
  }

  function isValidDungeonActorTile(game, x, y, options = {}) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const map = game.dungeonMap || game.map || [];
    const objects = game.dungeonObjects || game.objects || [];
    if (tx < 2 || ty < 2 || ty >= map.length - 2 || tx >= (map[ty]?.length || 0) - 2) return false;
    const tile = map[ty]?.[tx];
    if (!tile || tile.blocked || DR.TILE_DEF?.[tile.type]?.walk === false) return false;
    const object = objects[ty]?.[tx];
    if (object && !['webBridge'].includes(object.type)) return false;
    if (game.dungeonReachableTiles instanceof Set && !game.dungeonReachableTiles.has(dungeonTileKey(tx, ty))) return false;
    if (options.allowReserved !== true && game.dungeonReservedActorTiles instanceof Set && game.dungeonReservedActorTiles.has(dungeonTileKey(tx, ty))) return false;
    const actors = options.actors || [...(game.dungeonEnemies || []), game.player, game.merc, game.pet, ...(game.botPlayers || [])];
    if (options.avoidActors !== false && actors.some(actor => actor && actor !== options.ignoreActor && actor.alive !== false && Math.hypot(Number(actor.x || 0) - (tx + 0.5), Number(actor.y || 0) - (ty + 0.5)) < Number(options.minActorSpacing || 1.15))) return false;
    return true;
  }

  function findDungeonActorPlacement(game, cx, cy, radius = 8, options = {}) {
    let best = null;
    let bestDistance = Infinity;
    for (let r = 0; r <= radius; r++) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          if (!isValidDungeonActorTile(game, px, py, options)) continue;
          const distance = Math.hypot(px - cx, py - cy);
          if (distance < bestDistance) { best = { x: px, y: py }; bestDistance = distance; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function findSafeDungeonRespawnPoint(game, cx, cy, radius = 7) {
    const map = game.dungeonMap || game.map || [];
    const objects = game.dungeonObjects || game.objects || [];
    const size = map.length;
    let best = null;
    let bestDistance = Infinity;
    for (let r = 0; r <= radius; r++) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) continue;
          const tile = map[y]?.[x];
          if (!tile || tile.blocked) continue;
          const object = objects[y]?.[x];
          if (object && !['dungeonExit', 'webBridge'].includes(object.type)) continue;
          const px = x + 0.5;
          const py = y + 0.5;
          if ((game.dungeonEnemies || game.enemies || []).some(enemy => enemy?.alive && Math.hypot(enemy.x - px, enemy.y - py) < 2.25)) continue;
          if (game.isWalkable && game.isWalkable(px, py, game.player) !== true) continue;
          const distance = Math.hypot(px - cx, py - cy);
          if (distance < bestDistance) {
            best = { x: px, y: py };
            bestDistance = distance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function isExistingDungeonFloorTile(map, objects, x, y, options = {}) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 2 || ty < 2 || ty >= (map?.length || 0) - 2 || tx >= (map?.[ty]?.length || 0) - 2) return false;
    const tile = map[ty]?.[tx];
    if (!tile || tile.blocked || DR.TILE_DEF?.[tile.type]?.walk === false) return false;
    if (objects?.[ty]?.[tx]) return false;
    if (options.requireOpenNeighbors !== false) {
      const openNeighbors = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx, dy]) => {
        const neighbor = map[ty + dy]?.[tx + dx];
        return neighbor && !neighbor.blocked && DR.TILE_DEF?.[neighbor.type]?.walk !== false;
      }).length;
      if (openNeighbors < Math.max(1, Number(options.minOpenNeighbors || 2))) return false;
    }
    return true;
  }

  function findExistingDungeonFloorTile(map, objects, cx, cy, radius = 8, options = {}) {
    let best = null;
    let bestDistance = Infinity;
    for (let r = 0; r <= radius; r++) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!isExistingDungeonFloorTile(map, objects, x, y, options)) continue;
          const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (distance < bestDistance) { best = { x, y }; bestDistance = distance; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function placeSilkObject(map, objects, room, obj, ox = 0, oy = 0, blocked = false) {
    if (!room) return null;
    // V0.18.55: these old geometric grid/curtain web props (a rectangular net grid and a sparse
    // hanging fan) read badly - never place them (user request to remove). The orb-web ceiling
    // columns + wall/floor webs carry the silk look instead.
    if (obj && (obj.type === 'webCurtain' || obj.type === 'heavyWebCurtain' || obj.type === 'silkStrands')) return null;
    const intendedX = room.x + ox;
    const intendedY = room.y + oy;
    const position = findExistingDungeonFloorTile(map, objects, intendedX, intendedY, 9, {
      minOpenNeighbors: blocked ? 3 : 2
    });
    if (!position) return null;
    const placed = { ...obj, x: position.x, y: position.y, roomId: obj.roomId || room.id || '', roomKind: room.kind || '' };
    objects[position.y][position.x] = placed;
    if (blocked) {
      map[position.y][position.x].blocked = true;
      placed.blocking = true;
    }
    return placed;
  }

  function placeSilkDressingObject(map, objects, room, obj, ox = 0, oy = 0, blocked = false) {
    const placed = placeSilkObject(map, objects, room, {
      dungeonDressing: true,
      roomId: room?.id || '',
      roomKind: room?.kind || '',
      ...obj
    }, ox, oy, blocked);
    return placed;
  }

  function venomSackConsumedKey(state, obj) {
    return `${currentRunId(state)}:venom-sack:${obj?.id || obj?.objectId || `${obj?.floor || 1}:${Math.floor(safeNumber(obj?.x, 0))}:${Math.floor(safeNumber(obj?.y, 0))}`}`;
  }

  function venomSackPoisonEffect(source = null) {
    return silkStatusEffect('venom_sack_poison', source, 15.0, {
      id: 'venom_sack_poison',
      name: 'Venom Sack Poison',
      tickRate: 1.0,
      periodicDamage: 15,
      maxStacks: 20,
      color: '#a6ff68',
      sourceName: source?.name || 'Venom Sack',
      description: 'Deals 15 poison damage every 1s for 15s. Additional venom sacks stack this effect.'
    });
  }

  function placeSilkVenomSacks(game, dungeon, floor, rooms, map, objects) {
    const active = game?.dungeonSystem?.state || null;
    const candidates = rooms.filter(room => {
      const kind = String(room.kind || '').toLowerCase();
      const id = String(room.id || '').toLowerCase();
      const name = String(room.name || '').toLowerCase();
      const tags = Array.isArray(room.visualTags) ? room.visualTags.join(' ').toLowerCase() : '';
      if (kind === 'safe_entry' || kind === 'treasure' || id.includes('descent')) return false;
      return kind === 'combat' || kind === 'web_choke' || kind === 'egg_room' || kind === 'puzzle' || kind === 'boss' || /venom|web|egg|cocoon|spider|choke|gate|pylon/.test(`${id} ${name} ${tags}`);
    });
    let placed = 0;
    const maxSacks = floor === 1 ? 15 : floor === 2 ? 22 : 26;
    const floorSeed = Math.max(1, Math.floor(safeNumber(floor, 1)));
    const cornerSets = [
      [-0.35, 0.30], [0.36, 0.28], [-0.38, -0.24], [0.34, -0.26],
      [-0.22, 0.38], [0.18, 0.38], [-0.46, 0.02], [0.45, -0.02]
    ];
    for (let i = 0; i < candidates.length && placed < maxSacks; i++) {
      const room = candidates[i];
      const roomText = `${room.id || ''} ${room.name || ''} ${(room.visualTags || []).join(' ')}`.toLowerCase();
      const clusterSize = Math.min(3, Math.max(1, (roomText.includes('venom') || roomText.includes('egg') || room.kind === 'boss' ? 2 : 1) + (floor >= 3 && i % 3 === 0 ? 1 : 0)));
      for (let c = 0; c < clusterSize && placed < maxSacks; c++) {
        const slot = cornerSets[(i * 3 + c + floorSeed) % cornerSets.length];
        const ox = Math.round(room.w * slot[0]) + ((i + c) % 2 ? 1 : -1);
        const oy = Math.round(room.h * slot[1]) + ((i + c + floorSeed) % 2 ? -1 : 1);
        const id = `${dungeon.id}:floor${floor}:venom_sack:${room.id || i}:${c}`;
        const candidate = {
          type: 'venomSack', id, objectId: id, dungeonId: dungeon.id, floor,
          name: 'Venom Sack', label: '!', color: c % 2 ? '#d6ff6d' : '#a6ff68',
          triggerRadius: 0.95, singleUse: true, playerOnly: true, hazardKind: 'venom_sack'
        };
        if (active?.interactedObjects?.[venomSackConsumedKey(active, candidate)]) continue;
        const sack = placeSilkObject(map, objects, room, candidate, ox, oy, false);
        if (sack) placed++;
      }
    }
    return placed;
  }

  function isSilkPoisonStatus(effect = {}) {
    const text = `${effect.id || ''} ${effect.name || ''} ${effect.type || ''} ${effect.cleanseType || ''} ${effect.sourceName || ''}`.toLowerCase();
    const tags = Array.isArray(effect.tags) ? effect.tags.map(tag => String(tag).toLowerCase()) : [];
    return text.includes('poison') || text.includes('venom') || tags.includes('poison') || tags.includes('venom');
  }

  function isAllowedExistingSilkPoison(effect = {}) {
    const sourceKind = String(effect.sourceKind || '').toLowerCase();
    const sourceId = String(effect.sourceId || '').toLowerCase();
    const sourceName = String(effect.sourceName || '').toLowerCase();
    if (effect.id === 'venom_sack_poison' || effect.id === 'venom_egg_poison' || sourceName === 'venom sack' || sourceName === 'venom egg' || sourceId.includes('venom_sack') || sourceId.includes('venom_egg')) return true;
    if (sourceKind === 'enemy' && /spider|silk|web|venom|brood|matron|queen|skirr|arakh|velyra|widow|old venomsac|venom-eye/.test(`${sourceId} ${sourceName}`)) return true;
    return false;
  }

  function removeSilkEnvironmentalPoisonFromFriendlyTargets(game) {
    if (!game || game.currentZone !== 'dungeon' || game.dungeonSystem?.state?.active?.dungeonId !== 'silk_web_cavern') return 0;
    const partyBots = (game.botPlayers || []).filter(bot => bot && game.isBotInParty?.(bot) && bot.zone === game.currentZone);
    const targets = [game.player, game.merc, game.pet, ...partyBots].filter(Boolean);
    let removed = 0;
    for (const target of targets) {
      if (!Array.isArray(target.buffs) || !target.buffs.length) continue;
      const before = target.buffs.length;
      target.buffs = target.buffs.filter(effect => !isSilkPoisonStatus(effect) || isAllowedExistingSilkPoison(effect));
      removed += before - target.buffs.length;
    }
    if (removed > 0) {
      const now = nowMs();
      if (!game._silkEnvironmentalPoisonScrubLogAt || now - game._silkEnvironmentalPoisonScrubLogAt > 1200) {
        game._silkEnvironmentalPoisonScrubLogAt = now;
        console.warn(`[Dream Realms] Removed ${removed} non-combat Silk Web Cavern poison effect${removed === 1 ? '' : 's'}.`);
      }
    }
    return removed;
  }

  function markVenomSackBurst(game, state, obj, x, y) {
    if (!obj || !state) return false;
    const key = venomSackConsumedKey(state, { ...obj, x, y });
    state.interactedObjects = state.interactedObjects || {};
    state.interactedObjects[key] = { type: 'venomSack', floor: obj.floor || state.active?.floor || 1, at: nowMs() };
    const burst = {
      ...obj,
      type: 'venomSackBurst',
      name: 'Burst Venom Sack',
      color: '#60703a',
      triggered: true,
      burstAt: nowMs(),
      passable: true,
      blocked: false
    };
    if (game.objects?.[y]) game.objects[y][x] = burst;
    if (game.dungeonObjects?.[y]) game.dungeonObjects[y][x] = burst;
    game.spawnRing?.(x + 0.5, y + 0.5, '#a6ff68', 24);
    game.spawnDamageText?.(x + 0.5, y + 0.5, 'POISON', '#a6ff68', 1.05);
    state._venomSackLogAt = nowMs();
    game.log?.('A venom sack bursts under your feet.');
    game.dungeonSystem?.saveState?.();
    return true;
  }

  // ---------------------------------------------------------------------------
  // V0.18.35 Web Silk Cavern update: spider eggs (smashable -> loot OR baby
  // spiders) and venom eggs (dead, green, poison on walk-over/smash). Both reuse
  // the proven venom-sack proximity/consumed-key machinery so they persist per
  // run and their poison survives the environmental-poison scrubber.
  // ---------------------------------------------------------------------------
  function spiderEggConsumedKey(state, obj) {
    return `${currentRunId(state)}:spider-egg:${obj?.id || obj?.objectId || `${obj?.floor || 1}:${Math.floor(safeNumber(obj?.x, 0))}:${Math.floor(safeNumber(obj?.y, 0))}`}`;
  }

  function venomEggConsumedKey(state, obj) {
    return `${currentRunId(state)}:venom-egg:${obj?.id || obj?.objectId || `${obj?.floor || 1}:${Math.floor(safeNumber(obj?.x, 0))}:${Math.floor(safeNumber(obj?.y, 0))}`}`;
  }

  function venomEggPoisonEffect(source = null) {
    return silkStatusEffect('venom_egg_poison', source, 12.0, {
      id: 'venom_egg_poison',
      name: 'Venom Egg Toxin',
      tickRate: 1.0,
      periodicDamage: 12,
      maxStacks: 20,
      color: '#a6ff68',
      sourceName: source?.name || 'Venom Egg',
      description: 'A dead venom egg has burst over you. Deals 12 poison damage every 1s for 12s. Additional venom stacks this effect.'
    });
  }

  function markVenomEggBurst(game, state, obj, x, y) {
    if (!obj || !state) return false;
    const key = venomEggConsumedKey(state, { ...obj, x, y });
    state.interactedObjects = state.interactedObjects || {};
    state.interactedObjects[key] = { type: 'venomEgg', floor: obj.floor || state.active?.floor || 1, at: nowMs() };
    const burst = {
      ...obj,
      type: 'venomEggBurst',
      name: 'Burst Venom Egg',
      color: '#5c7433',
      triggered: true,
      burstAt: nowMs(),
      passable: true,
      blocked: false
    };
    if (game.objects?.[y]) game.objects[y][x] = burst;
    if (game.dungeonObjects?.[y]) game.dungeonObjects[y][x] = burst;
    game.spawnRing?.(x + 0.5, y + 0.5, '#a6ff68', 22);
    game.spawnDamageText?.(x + 0.5, y + 0.5, 'VENOM', '#a6ff68', 1.0);
    game.log?.('A dead venom egg bursts, splashing you with toxin.');
    game.dungeonSystem?.saveState?.();
    return true;
  }

  // V0.18.38: push a Silk Web Cavern VFX effect (egg burst, ceiling spider drop,
  // skeleton fall). Effects advance e.t and cull at e.life in updateEffects; the draws
  // live in render/effects-renderer.js.
  function spawnSilkEffect(game, type, x, y, extra = {}) {
    if (!game || typeof game.addEffect !== 'function') return null;
    const effect = { type, x, y };
    effect.x2 = extra.x2 != null ? extra.x2 : x;
    effect.y2 = extra.y2 != null ? extra.y2 : y;
    effect.t = 0;
    effect.life = Math.max(0.2, safeNumber(extra.life, 0.7));
    effect.seed = safeNumber(extra.seed, ((Math.floor(x * 73856) ^ Math.floor(y * 19349)) >>> 0)) || 1;
    effect.color = extra.color || '#d8c8f2';
    effect.color2 = extra.color2 || '#ffffff';
    if (extra.dropHeight != null) effect.dropHeight = extra.dropHeight;
    if (extra.radius != null) effect.radius = extra.radius;
    if (extra.dir != null) effect.dir = extra.dir;
    return game.addEffect(effect) || effect;
  }

  // ---------------------------------------------------------------------------
  // V0.18.42: boss/miniboss attack TELEGRAPHS - a red ground marker warns where a
  // strike will land, then the damage is applied after a short delay (was instant).
  // ---------------------------------------------------------------------------
  function queueSilkBossStrike(game, strike) {
    if (!game || !strike) return;
    game._silkBossStrikes = Array.isArray(game._silkBossStrikes) ? game._silkBossStrikes : [];
    game._silkBossStrikes.push(strike);
  }

  function updateSilkBossStrikes(game) {
    const list = game._silkBossStrikes;
    if (!Array.isArray(list) || !list.length) return;
    if (game.currentZone !== 'dungeon') { game._silkBossStrikes = []; return; }
    const now = nowMs();
    const remaining = [];
    for (const s of list) {
      if (!s || !s.boss || s.boss.alive === false) continue; // caster died -> strike fizzles
      if (now < s.applyAt) { remaining.push(s); continue; }
      const r = Math.max(1, safeNumber(s.radius, 4));
      const targets = silkWebFriendlyCombatCandidates(game).filter(t => t && t.alive !== false && Math.hypot(t.x - s.x, t.y - s.y) <= r + 0.4);
      game.spawnRing?.(s.x, s.y, s.color || '#ff5a4f', Math.floor(r * 5.8));
      spawnSilkEffect(game, 'bossStrikeHit', s.x, s.y, { life: 0.42, color: s.color || '#ff5a4f', radius: r });
      const kind = String(s.kind || '');
      for (const t of targets) {
        game.damageEntity?.(t, Math.max(1, Math.floor(safeNumber(s.damage, 1))), s.boss, s.color);
        if (kind.includes('poison') || kind.includes('venom')) game.applyStatusEffect?.(t, silkStatusEffect('poisoned', s.boss, 4.0, { periodicDamage: Math.max(2, Math.floor(safeNumber(s.boss.level, 8) * 0.55)), sourceName: s.boss.name }), s.boss);
        if (s.status || kind.includes('snare') || kind.includes('silk') || kind.includes('web')) game.applyStatusEffect?.(t, silkStatusEffect(s.status || 'webbed', s.boss, 3.0, { sourceName: s.boss.name }), s.boss);
      }
    }
    game._silkBossStrikes = remaining;
  }

  // ---------------------------------------------------------------------------
  // V0.18.42: boss-room WEB SEAL. On the floor-1 boss engaging, 3 spiders scuttle to
  // the room entrance and spin it shut (blocking barrier) so the player is trapped
  // until the boss dies, then the web tears open. Managed by dungeonSystem.updateBossSeal.
  // ---------------------------------------------------------------------------
  function silkSmoothStep(p) { const t = Math.max(0, Math.min(1, p)); return t * t * (3 - 2 * t); }

  function startSilkBossRoomSeal(game, floor, boss) {
    const TILE = DR.TILE || {};
    const arena = silkWebBossArena(boss) || { x: boss.x, y: boss.y, w: 20, h: 16 };
    const cfg = SILK_WEB_FLOOR_CONFIG[floor];
    // V0.18.43: the sealed entrance faces the boss room's non-treasure neighbour (the gate/
    // approach) - derived from the links so it works for any layout, not a hardcoded id.
    let approachId = null;
    for (const [a, b] of (cfg?.links || [])) {
      if (a === 'boss' && b !== 'treasure') approachId = b;
      else if (b === 'boss' && a !== 'treasure') approachId = a;
    }
    const approach = (cfg?.rooms || []).find(r => r.id === approachId) || (cfg?.rooms || []).find(r => r.id === 'skirr_approach') || (cfg?.rooms || []).find(r => r.kind === 'combat') || { x: arena.x, y: arena.y + 20 };
    let dx = approach.x - arena.x, dy = approach.y - arena.y;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const ex = arena.x + dx * (arena.w * 0.5 - 1);
    const ey = arena.y + dy * (arena.h * 0.5 - 1);
    const px = -dy, py = dx; // perpendicular to the corridor
    const isOpen = (tx, ty) => {
      const tile = game.map?.[ty]?.[tx];
      return Boolean(tile && !tile.blocked && tile.type === TILE.CAVE_FLOOR);
    };
    // V0.18.45: seal the ENTIRE entrance cross-section wall-to-wall with NO edge gaps.
    // At each depth slice across the throat we sweep the full perpendicular width and seal
    // every open tile (not just a fixed +-5 band), so however wide or offset the opening is,
    // the barrier spans from wall to wall. A few tiles deep makes it one thick plug the
    // player can't corner-cut around.
    const maxHalf = Math.ceil(Math.max(safeNumber(arena.w, 16), safeNumber(arena.h, 12)) * 0.5) + 6;
    const tileSet = new Map();
    for (let d = 0; d <= 3; d++) {
      const bx = ex + dx * d, by = ey + dy * d;
      for (let s = -maxHalf; s <= maxHalf; s++) {
        const tx = Math.round(bx + px * s), ty = Math.round(by + py * s);
        if (isOpen(tx, ty)) tileSet.set(`${tx},${ty}`, { x: tx, y: ty });
      }
    }
    const entranceTiles = Array.from(tileSet.values());
    if (entranceTiles.length < 2) return null;
    // spread the three spinning crawlers across the ACTUAL entrance width (V0.18.45)
    let sMin = Infinity, sMax = -Infinity;
    for (const t of entranceTiles) {
      const sVal = (t.x - ex) * px + (t.y - ey) * py;
      if (sVal < sMin) sMin = sVal;
      if (sVal > sMax) sMax = sVal;
    }
    if (!isFinite(sMin)) { sMin = -3; sMax = 3; }
    const crawlers = [];
    for (let i = 0; i < 3; i++) {
      const s = sMin + (sMax - sMin) * (i / 2); // spread the 3 spinners across the full width
      const sa = (i / 3) * Math.PI * 2;
      const c = {
        startX: boss.x + Math.cos(sa) * 3, startY: boss.y + Math.sin(sa) * 3,
        targetX: ex + px * s, targetY: ey + py * s,
        exitDir: Math.atan2(py, px) + (i - 1) * 0.8,
        seed: (i * 977 + Math.floor(boss.x)) >>> 0, dir: 0
      };
      c.x = c.startX; c.y = c.startY;
      crawlers.push(c);
    }
    game.spawnRing?.(ex, ey, '#d8c8f2', 24);
    game.log?.(`${boss.name || 'The broodwarden'} stirs - spiders scuttle to seal the way out!`);
    return { boss, bossId: boss.id, phase: 'walk', t: 0, walkDuration: 2.6, entrance: { x: ex, y: ey }, entranceTiles, crawlers, sealObjects: [] };
  }

  function placeSilkSealBarrier(game, seal) {
    const now = nowMs();
    for (const t of seal.entranceTiles) {
      const row = game.objects?.[t.y]; if (!row) continue;
      const prevObj = row[t.x] || null;
      const prevBlocked = game.map?.[t.y]?.[t.x]?.blocked;
      const wall = { type: 'bossWebSeal', name: 'Web Seal', solid: true, blocked: true, sealedAt: now, dungeonId: 'silk_web_cavern', bossSeal: true, x: t.x, y: t.y, _propSeed: (t.x * 73856 + t.y * 19349) >>> 0 };
      row[t.x] = wall;
      if (game.dungeonObjects && game.dungeonObjects !== game.objects && game.dungeonObjects[t.y]) game.dungeonObjects[t.y][t.x] = wall;
      if (game.map?.[t.y]?.[t.x]) game.map[t.y][t.x].blocked = true;
      seal.sealObjects.push({ x: t.x, y: t.y, prevObj, prevBlocked });
    }
    game.spawnRing?.(seal.entrance.x, seal.entrance.y, '#e0d6f0', 30);
    game.mapDirty = true;
  }

  function unsealSilkBossRoom(game, seal) {
    if (!seal) return;
    let torn = 0;
    for (const so of seal.sealObjects || []) {
      // Only restore tiles that still hold OUR web seal, so re-entering / a regenerated
      // floor can never be corrupted by a stale seal reference.
      if (game.objects?.[so.y]?.[so.x]?.type !== 'bossWebSeal') continue;
      game.objects[so.y][so.x] = so.prevObj || null;
      if (game.dungeonObjects && game.dungeonObjects !== game.objects && game.dungeonObjects[so.y]) game.dungeonObjects[so.y][so.x] = so.prevObj || null;
      if (game.map?.[so.y]?.[so.x]) game.map[so.y][so.x].blocked = Boolean(so.prevBlocked);
      spawnSilkEffect(game, 'silkEggBurst', so.x + 0.5, so.y + 0.5, { life: 0.5, color: '#e0d6f0' });
      torn++;
    }
    if (torn > 0) { game.mapDirty = true; game.log?.('The web seal tears apart - the way out is clear.'); }
  }

  // V0.18.45: register a RUNTIME-spawned dungeon enemy into all three lists. The AI
  // iterates game.enemies but the RENDER iterates game.entities (a snapshot built by
  // setActiveEnemySet at floor load), so enemies spawned after load must also be added
  // to game.entities or they are AI-active but INVISIBLE (bots attack an invisible mob).
  function registerRuntimeSilkEnemy(game, add) {
    if (!add) return add;
    if (Array.isArray(game.dungeonEnemies) && !game.dungeonEnemies.includes(add)) game.dungeonEnemies.push(add);
    if (Array.isArray(game.enemies) && !game.enemies.includes(add)) game.enemies.push(add);
    if (Array.isArray(game.entities) && !game.entities.includes(add)) game.entities.push(add);
    return add;
  }

  function makeBabySpider(game, floor, x, y, level, options = {}) {
    const dungeon = DR.DUNGEON_BY_ID?.silk_web_cavern || { id: 'silk_web_cavern', lootTableId: 'loot_silk_web_cavern' };
    const room = { x: x + 0.5, y: y + 0.5, w: 6, h: 6, kind: 'egg_room', id: 'spider_egg_hatch' };
    const add = createSilkDungeonEnemy(game, 'Webling Skitterer', room, dungeon, floor, level, {
      elite: false,
      name: 'Spiderling',
      hpMultiplier: 0.5,
      attackMultiplier: 0.65,
      defenseMultiplier: 0.9,
      xpMultiplier: 0.45,
      lootRolls: 1,
      speed: 1.55,
      minActorSpacing: 0.4,
      patrolRadius: 3.0,
      ...options
    });
    if (!add) return null;
    // V0.18.38: babies read as TINY skittering hatchlings, not full-size spiders.
    add.hatchedFromEgg = true;
    add.silkWebFloor = floor;
    add.spiderRole = 'skitterer';
    add.spiderling = true;
    // V0.18.48: genuinely TINY hatchlings (they were reading as full-size spiders).
    add.modelScale = 0.32;
    add.visualScale = 0.32;
    add.color = '#d8c8f2';
    add.nameplateRange = 0; // don't clutter the screen with a dozen baby nameplates
    return registerRuntimeSilkEnemy(game, add); // V0.18.45: also add to game.entities so it RENDERS
  }

  function spawnBabySpidersFromEgg(game, floor, x, y, count, options = {}) {
    const level = Math.max(1, Math.floor(safeNumber(game.player?.level, floor)) - 1);
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const add = makeBabySpider(game, floor, x, y, level, {
        intendedX: x + 0.5 + (Math.random() - 0.5) * 2.0,
        intendedY: y + 0.5 + (Math.random() - 0.5) * 2.0
      });
      if (add) {
        // V0.18.45: babies from a baby-egg crawl out and immediately attack.
        if (options.aggressive) {
          add.aggro = true;
          add.aggroTarget = game.player || null;
          add.leashRadius = Math.max(safeNumber(add.leashRadius, 18), 45);
        }
        game.spawnRing?.(add.x, add.y, '#d8c8f2', 10);
        spawned++;
      }
    }
    return spawned;
  }

  function smashSpiderEgg(game, state, obj, x, y, floor) {
    if (!obj || !state) return false;
    const key = spiderEggConsumedKey(state, { ...obj, x, y });
    state.interactedObjects = state.interactedObjects || {};
    state.interactedObjects[key] = { type: 'spiderEgg', floor: obj.floor || state.active?.floor || 1, at: nowMs() };
    const activeFloor = Math.max(1, Math.floor(safeNumber(floor || obj.floor || state.active?.floor, 1)));
    const burst = {
      ...obj,
      type: 'spiderEggBurst',
      name: 'Broken Spider Egg',
      triggered: true,
      burstAt: nowMs(),
      passable: true,
      blocked: false
    };
    if (game.objects?.[y]) game.objects[y][x] = burst;
    if (game.dungeonObjects?.[y]) game.dungeonObjects[y][x] = burst;
    // V0.18.38: egg-break animation - flying shell shards + a bursting silk puff.
    spawnSilkEffect(game, 'silkEggBurst', x + 0.5, y + 0.5, { life: 0.62, color: obj.royal ? '#f4d9ef' : '#ece2cd' });
    game.spawnRing?.(x + 0.5, y + 0.5, '#e6ddc8', 20);
    // V0.18.45: baby-eggs are GUARANTEED to hatch a clutch of tiny spiders that
    // immediately attack; other eggs keep the ~45% hatch / otherwise loot roll.
    const guaranteedBabies = obj.babyEgg === true;
    if (guaranteedBabies || Math.random() < 0.45) {
      const spawned = spawnBabySpidersFromEgg(game, activeFloor, x, y, randInt(guaranteedBabies ? 3 : 2, guaranteedBabies ? 5 : 3), { aggressive: true });
      if (spawned > 0) {
        game.spawnDamageText?.(x + 0.5, y + 0.5, 'HATCH!', '#d8c8f2', 1.0);
        game.log?.(`The egg bursts open - ${spawned} baby spider${spawned === 1 ? '' : 's'} scuttle out and attack!`);
        game.dungeonSystem?.saveState?.();
        return true;
      }
      // nowhere to place spiders -> fall through to loot so the smash still rewards.
    }
    game.rollEditorLootTable?.('loot_silk_web_cavern', { level: game.player?.level || activeFloor }, { grant: true, fallbackTableId: 'loot_common_chest' });
    game.spawnDamageText?.(x + 0.5, y + 0.5, 'LOOT', '#f0dca0', 1.0);
    game.log?.('You smash the spider egg - prey scraps and loot spill from the silk.');
    game.dungeonSystem?.saveState?.();
    return true;
  }

  // V0.18.38: ambient ceiling spider - a small spider drops on a silk line near the
  // player while exploring, to make the cavern feel alive and dangerous. Capped and
  // placed on a real walkable tile a few tiles away (never on top of the player).
  function maybeDropCeilingSpider(game, state) {
    const player = game.player;
    if (!player || player.alive === false) return;
    const floor = Math.max(1, Math.floor(safeNumber(state.active?.floor, 1)));
    const ambient = (game.dungeonEnemies || []).filter(e => e && e.alive && e.ceilingDropSpider).length;
    if (ambient >= 2) return; // V0.18.45: at most 2 ambient droppers at once
    const ang = Math.random() * Math.PI * 2;
    const rad = 3 + Math.random() * 4;
    const spot = findWalkableNear(game.dungeonMap || game.map || [], game.dungeonObjects || game.objects || [], player.x + Math.cos(ang) * rad, player.y + Math.sin(ang) * rad, 4);
    if (!spot) return;
    const level = Math.max(1, Math.floor(safeNumber(player.level, floor)));
    const add = makeBabySpider(game, floor, Math.floor(spot.x), Math.floor(spot.y), level, {
      name: 'Cave Skitterling',
      intendedX: spot.x, intendedY: spot.y,
      hpMultiplier: 0.72, attackMultiplier: 0.82, patrolRadius: 4.0
    });
    if (!add) return;
    add.ceilingDropSpider = true;
    add.modelScale = 0.56;
    add.visualScale = 0.56;
    spawnSilkEffect(game, 'silkDrop', add.x, add.y, { life: 1.1, dropHeight: 155 });
    game.spawnRing?.(add.x, add.y, '#d8c8f2', 12);
  }

  function webWrappedBodyConsumedKey(state, obj) {
    return `${currentRunId(state)}:wrapped-body:${obj?.id || obj?.objectId || `${obj?.floor || 1}:${Math.floor(safeNumber(obj?.x, 0))}:${Math.floor(safeNumber(obj?.y, 0))}`}`;
  }

  // V0.18.38: break a big web-wrapped victim - a skeleton tumbles out onto the floor
  // (silkSkeletonFall VFX) and the cocoon is left torn open. Sometimes drops loot.
  function breakWebWrappedBody(game, state, obj, x, y, floor) {
    if (!obj || !state) return false;
    const key = webWrappedBodyConsumedKey(state, { ...obj, x, y });
    state.interactedObjects = state.interactedObjects || {};
    state.interactedObjects[key] = { type: 'webWrappedBody', floor: obj.floor || state.active?.floor || 1, at: nowMs() };
    const broken = { ...obj, type: 'brokenWrappedBody', name: 'Torn Cocoon', triggered: true, burstAt: nowMs(), passable: true, blocked: false };
    if (game.objects?.[y]) game.objects[y][x] = broken;
    if (game.dungeonObjects?.[y]) game.dungeonObjects[y][x] = broken;
    spawnSilkEffect(game, 'silkSkeletonFall', x + 0.5, y + 0.5, { life: 0.95 });
    game.spawnRing?.(x + 0.5, y + 0.5, '#d8c8f2', 22);
    game.spawnDamageText?.(x + 0.5, y + 0.5, 'CRACK', '#e6e0cf', 1.0);
    game.log?.('The web-wrapped body splits open - a skeleton tumbles out onto the floor.');
    if (Math.random() < 0.5) game.rollEditorLootTable?.('loot_silk_web_cavern', { level: game.player?.level || floor }, { grant: true, fallbackTableId: 'loot_common_chest' });
    game.dungeonSystem?.saveState?.();
    return true;
  }

  // Web-density + "people die here" atmosphere pass: scatters far more floor and
  // wall webs plus web-wrapped remains/bone middens/prey cocoons across every
  // room. All placed objects are passable, visual-only, non-damaging dressing.
  function placeSilkInfestationDressing(game, dungeon, floor, rooms, map, objects) {
    let placed = 0;
    const floorSeed = Math.max(1, Math.floor(safeNumber(floor, 1)));
    const royalFloor = floor >= 3;
    const scatter = (room, type, count, extra = {}) => {
      for (let i = 0; i < count; i++) {
        const ang = (i * 2.399963 + floorSeed * 1.7 + (room.x + room.y) * 0.31) % (Math.PI * 2);
        const rad = 0.14 + ((i * 0.6180339 + floorSeed * 0.13) % 0.80);
        const ox = Math.round(Math.cos(ang) * (room.w / 2 - 2) * rad);
        const oy = Math.round(Math.sin(ang) * (room.h / 2 - 2) * rad);
        const obj = {
          type,
          name: extra.name || type,
          color: extra.color,
          floor,
          dungeonId: 'silk_web_cavern',
          roomId: room.id,
          infestationDressing: true,
          readabilityObject: true,
          passable: true,
          visualOnly: true,
          nonDamaging: true,
          ...(extra.extra || {})
        };
        if (placeSilkDressingObject(map, objects, room, obj, ox, oy, false)) placed++;
      }
    };
    for (const room of rooms || []) {
      const kind = String(room.kind || '').toLowerCase();
      const silk = royalFloor ? '#ff9de8' : '#d8c8f2';
      if (kind === 'safe_entry') {
        // even the entry is visibly infested, but lighter (readability).
        scatter(room, 'caveWeb', 2, { name: 'Cavern Webbing', color: silk, extra: { egg: false, rx: 26 } });
        scatter(room, 'webCurtain', 2, { name: 'Wall Webbing', color: silk });
        scatter(room, 'webBones', 1, { name: 'Web-Wrapped Remains', color: '#d6c8a2' });
        continue;
      }
      const area = Math.max(1, room.w * room.h);
      const sizeScale = Math.min(3, Math.max(1, Math.round(area / 90)));
      // "spiders live here": dense floor + wall + hanging webs.
      scatter(room, 'caveWeb', 3 + sizeScale + (royalFloor ? 1 : 0), { name: 'Floor Webbing', color: silk, extra: { egg: false, rx: 24 + floorSeed * 3 } });
      scatter(room, 'silkStrands', 2 + sizeScale, { name: 'Hanging Silk Strands', color: silk });
      scatter(room, 'webCurtain', 2 + sizeScale, { name: 'Layered Wall Webbing', color: silk });
      // "people die here": remains, bones, cocooned prey.
      if (kind !== 'treasure') {
        scatter(room, 'webBones', 1 + Math.floor(sizeScale / 2), { name: 'Web-Wrapped Remains', color: '#d6c8a2' });
        scatter(room, 'boneMidden', 1, { name: 'Bone Midden', color: '#d6c8a2' });
        if (sizeScale >= 2) scatter(room, 'preyCocoonRack', 1, { name: 'Cocooned Victims', color: silk });
      }
    }
    return placed;
  }

  // V0.18.41: floor-to-ceiling web columns + webbed junk piles (armor, weapons, bones
  // cocooned in silk). Passable, visual-only dressing that sells "spiders spun this whole
  // place and keep their kills' gear webbed up."
  function placeSilkCeilingWebsAndJunk(game, dungeon, floor, rooms, map, objects) {
    let placed = 0;
    const floorSeed = Math.max(1, Math.floor(safeNumber(floor, 1)));
    const royalFloor = floor >= 3;
    const scatter = (room, type, count, extra = {}) => {
      const phase = extra.phase || 0;
      for (let i = 0; i < count; i++) {
        const ang = (i * 2.399963 + floorSeed * 1.3 + (room.x + room.y) * 0.29 + phase) % (Math.PI * 2);
        const rad = 0.2 + ((i * 0.6180339 + floorSeed * 0.11) % 0.7);
        const ox = Math.round(Math.cos(ang) * (room.w / 2 - 3) * rad);
        const oy = Math.round(Math.sin(ang) * (room.h / 2 - 3) * rad);
        const obj = {
          type, name: extra.name || type, floor, royal: royalFloor,
          dungeonId: 'silk_web_cavern', roomId: room.id,
          passable: true, visualOnly: true, nonDamaging: true, ...(extra.extra || {})
        };
        if (placeSilkDressingObject(map, objects, room, obj, ox, oy, false)) placed++;
      }
    };
    for (const room of rooms || []) {
      const kind = String(room.kind || '').toLowerCase();
      const roomText = `${room.id || ''} ${(room.visualTags || []).join(' ')}`.toLowerCase();
      const big = (room.w * room.h) > 700;
      // V0.18.53: EVERY room gets floor-to-ceiling web columns now - including the safe-entry
      // and treasure rooms (a lighter set; they skip the gore below).
      const minimal = (kind === 'safe_entry' || kind === 'treasure');
      // V0.18.45: floor-to-ceiling web columns of VARIED sizes - some extremely thick, some small.
      const columnCount = minimal ? 5 : big ? 12 : room.silkPocket ? 4 : 8; // V0.18.57: ~30% more hanging web columns
      for (let c = 0; c < columnCount; c++) {
        const ang = (c * 2.399963 + floorSeed * 1.3 + (room.x + room.y) * 0.29) % (Math.PI * 2);
        const rad = 0.24 + ((c * 0.6180339 + floorSeed * 0.11) % 0.66);
        const ox = Math.round(Math.cos(ang) * (room.w / 2 - 4) * rad);
        const oy = Math.round(Math.sin(ang) * (room.h / 2 - 4) * rad);
        // V0.18.57: bias toward super-thick columns (about half thick), fewer thin wisps
        const thick = (c % 2 === 0) && (big || room.w > 22);
        const webSize = thick ? 'thick' : (c % 3 === 0 ? 'small' : 'medium');
        const obj = {
          type: 'ceilingWebColumn', name: thick ? 'Thick Ceiling Web' : 'Ceiling Web Column',
          floor, royal: royalFloor, dungeonId: 'silk_web_cavern', roomId: room.id,
          passable: true, visualOnly: true, nonDamaging: true, webSize
        };
        if (placeSilkDressingObject(map, objects, room, obj, ox, oy, false)) placed++;
      }
      if (minimal) continue; // safe-entry / treasure rooms get the webs but not the gore below
      // webbed junk piles - in combat / den / boneyard / supply rooms and pockets
      if (kind === 'combat' || room.silkPocket || /bone|junk|supports|weapon|victim|prey|den|midden|feeding/.test(roomText)) {
        scatter(room, 'webJunkPile', big ? 2 : 1, { name: 'Webbed Junk Pile' });
      }
      // V0.18.46: webbed bone piles across the ground - large ones in the open caverns,
      // small ones everywhere - mixed in among the web columns so the whole floor reads as
      // "people die here" (items 3 & 4). Big rooms get the large piles; every non-safe room
      // gets small ones.
      scatter(room, 'webbedBonePile', big ? 2 : 0, { name: 'Webbed Bone Pile', phase: 1.7, extra: { bonePileSize: 'large' } });
      scatter(room, 'webbedBonePile', big ? 3 : room.silkPocket ? 1 : 2, { name: 'Webbed Bones', phase: 3.4, extra: { bonePileSize: 'small' } });
      // V0.18.61: big + small spider EGG PILES on the ground - large ones in the brood/egg rooms
      // and open caverns, small ones scattered elsewhere.
      const eggPileRoom = kind === 'egg_room' || /egg|nest|nursery|hatch|brood/.test(roomText);
      scatter(room, 'eggPile', (eggPileRoom ? 2 : (big ? 1 : 0)), { name: 'Egg Pile', phase: 2.2, extra: { eggPileSize: 'large', royal: royalFloor } });
      scatter(room, 'eggPile', (eggPileRoom ? 2 : big ? 2 : 1), { name: 'Egg Clutch', phase: 4.6, extra: { eggPileSize: 'small', royal: royalFloor } });
      // V0.18.48: real-cave dressing - little rocks (some webbed) + stalagmites (small,
      // plus large + floor-to-ceiling columns in the big caverns, some silk-draped).
      scatter(room, 'caveRocks', big ? 2 : 1, { name: 'Cave Rocks', phase: 0.9 });
      scatter(room, 'caveRocks', 1, { name: 'Webbed Rocks', phase: 1.4, extra: { webbed: true } });
      // V0.18.59: varied stalagmite SIZES on the ground (xs..xl) + floor-to-ceiling columns,
      // plus a fringe of hanging ceiling STALACTITES (varied sizes), some silk-draped.
      scatter(room, 'caveStalagmite', big ? 3 : 1, { name: 'Tiny Stalagmite', phase: 0.4, extra: { size: 'xs' } });
      scatter(room, 'caveStalagmite', big ? 4 : 2, { name: 'Small Stalagmite', phase: 2.6, extra: { size: 'small' } });
      scatter(room, 'caveStalagmite', big ? 3 : 1, { name: 'Stalagmite', phase: 3.3, extra: { size: 'medium' } });
      scatter(room, 'caveStalagmite', big ? 2 : 1, { name: 'Large Stalagmite', phase: 4.1, extra: { size: 'large', webbed: true } });
      if (big) scatter(room, 'caveStalagmite', 1, { name: 'Great Stalagmite', phase: 5.6, extra: { size: 'xl' } });
      scatter(room, 'caveStalagmite', big ? 4 : 2, { name: 'Cave Column', phase: 5.0, extra: { size: 'column', webbed: (room.x + room.y) % 2 === 0 } });
      scatter(room, 'caveStalagmite', big ? 4 : 2, { name: 'Stalactite', phase: 0.9, extra: { hang: true, size: 'small' } });
      scatter(room, 'caveStalagmite', big ? 3 : 1, { name: 'Stalactite', phase: 1.9, extra: { hang: true, size: 'medium' } });
      scatter(room, 'caveStalagmite', big ? 2 : 1, { name: 'Great Stalactite', phase: 3.7, extra: { hang: true, size: 'large' } });
      scatter(room, 'caveStalagmite', big ? 2 : 1, { name: 'Tiny Stalactite', phase: 4.8, extra: { hang: true, size: 'xs' } });
      // V0.18.48: a REALLY large spider nest (spiders inside + tiny spiders crawling on it)
      // in the big open caverns and the brood/nest rooms - "spiders live here".
      if ((big || /nest|brood|nursery|cocoon|matron|queen|broodmother|lair|great/.test(roomText)) && kind !== 'boss') {
        scatter(room, 'giantSpiderNest', 1, { name: royalFloor ? 'Royal Spider Nest' : 'Giant Spider Nest', phase: 3.0, extra: { royal: royalFloor } });
      }
    }
    // V0.18.53: webs in the TUNNELS too - drop floor-to-ceiling web columns along the corridors
    // (walkable floor tiles that lie OUTSIDE every room), so no passage is bare.
    const CF = (DR.TILE || {}).CAVE_FLOOR;
    const inAnyRoom = (tx, ty) => (rooms || []).some(r => Math.abs(tx - r.x) <= r.w / 2 + 1 && Math.abs(ty - r.y) <= r.h / 2 + 1);
    for (let ty = 2; ty < map.length - 2; ty++) {
      const row = map[ty]; if (!row) continue;
      for (let tx = 2; tx < row.length - 2; tx++) {
        const t = row[tx];
        if (!t || t.blocked || t.type !== CF) continue;
        if (objects[ty]?.[tx]) continue;           // never overwrite an existing object
        if (inAnyRoom(tx, ty)) continue;           // rooms handled above
        if ((tx * 3 + ty * 7) % 6 === 0) {         // web columns along the corridors
          const thick = ((tx + ty) % 5 === 0);
          const webSize = thick ? 'thick' : ((tx * 2 + ty) % 2 ? 'small' : 'medium');
          objects[ty][tx] = { type: 'ceilingWebColumn', name: thick ? 'Thick Ceiling Web' : 'Ceiling Web Column', floor, royal: royalFloor, dungeonId: 'silk_web_cavern', roomId: 'tunnel', passable: true, visualOnly: true, nonDamaging: true, webSize, x: tx, y: ty };
          placed++;
        } else if ((tx * 5 + ty * 3) % 11 === 0) { // V0.18.58: ground stalagmites (incl. columns) in the tunnels
          const stCol = (tx + ty) % 3 === 0;
          objects[ty][tx] = { type: 'caveStalagmite', name: stCol ? 'Cave Column' : 'Stalagmite', size: stCol ? 'column' : ((tx + ty) % 4 === 0 ? 'medium' : 'small'), webbed: (tx * 7 + ty) % 2 === 0, floor, dungeonId: 'silk_web_cavern', roomId: 'tunnel', passable: true, visualOnly: true, nonDamaging: true, x: tx, y: ty };
          placed++;
        } else if ((tx * 7 + ty * 5) % 9 === 0) { // V0.18.59: hanging stalactites in the tunnels
          objects[ty][tx] = { type: 'caveStalagmite', name: 'Stalactite', hang: true, size: ['xs', 'small', 'medium'][(tx + ty) % 3], floor, dungeonId: 'silk_web_cavern', roomId: 'tunnel', passable: true, visualOnly: true, nonDamaging: true, x: tx, y: ty };
          placed++;
        }
      }
    }
    // V0.18.57: ONE massive "everything" web lair per floor, placed in the biggest open cavern -
    // multiple nests, tons of crawling spiders, lots of bones + eggs, cocooned bodies, and
    // webbed stalagmite columns inside it.
    let lairRoom = null;
    for (const room of rooms || []) {
      const k = String(room.kind || '').toLowerCase();
      if (k === 'safe_entry' || k === 'treasure' || k === 'boss') continue;
      if (!lairRoom || (room.w * room.h) > (lairRoom.w * lairRoom.h)) lairRoom = room;
    }
    if (lairRoom) {
      const lair = { type: 'giantWebLair', name: royalFloor ? 'Royal Web Lair' : 'Great Web Lair', floor, royal: royalFloor, dungeonId: 'silk_web_cavern', roomId: lairRoom.id, passable: true, visualOnly: true, nonDamaging: true };
      if (placeSilkDressingObject(map, objects, lairRoom, lair, 0, 0, false)) placed++;
    }
    return placed;
  }

  // Places smashable spider-egg clutches (loot / baby spiders) and dead venom
  // eggs (poison hazard) across the floor, honouring per-run consumed state so
  // they do not respawn once broken.
  function placeSilkNestEggs(game, dungeon, floor, rooms, map, objects) {
    const active = game?.dungeonSystem?.state || null;
    let placedEggs = 0;
    let placedVenom = 0;
    let placedBodies = 0;
    const floorSeed = Math.max(1, Math.floor(safeNumber(floor, 1)));
    const slots = [
      [-0.32, 0.28], [0.34, 0.26], [-0.36, -0.22], [0.30, -0.28],
      [-0.20, 0.36], [0.16, 0.36], [-0.42, 0.04], [0.42, -0.04]
    ];
    const maxSpiderEggs = floor === 1 ? 8 : floor === 2 ? 11 : 13;
    const maxVenomEggs = floor === 1 ? 10 : floor === 2 ? 14 : 16;
    const maxBodies = floor === 1 ? 5 : floor === 2 ? 7 : 8;
    let slotIx = floorSeed;
    for (let i = 0; i < (rooms || []).length; i++) {
      const room = rooms[i];
      const kind = String(room.kind || '').toLowerCase();
      const roomText = `${room.id || ''} ${room.name || ''} ${(room.visualTags || []).join(' ')}`.toLowerCase();
      if (kind === 'safe_entry' || kind === 'treasure') continue;
      const broodRoom = kind === 'egg_room' || /egg|cocoon|brood|nursery|hatch|nest|warren/.test(roomText);
      const venomRoom = /venom|pool|toxic/.test(roomText);
      const eggCount = (broodRoom ? randInt(2, 3) : (kind === 'combat' || kind === 'web_choke' || kind === 'boss' ? 1 : 0)) + (floor >= 3 ? 1 : 0);
      for (let c = 0; c < eggCount && placedEggs < maxSpiderEggs; c++) {
        const slot = slots[(slotIx++) % slots.length];
        const ox = Math.round(room.w * slot[0]) + ((i + c) % 2 ? 1 : -1);
        const oy = Math.round(room.h * slot[1]) + ((i + c) % 2 ? -1 : 1);
        const oid = `${dungeon.id}:floor${floor}:spider_egg:${room.id || i}:${c}`;
        // V0.18.45: ~half the eggs are baby-eggs - walking over them hatches a clutch of
        // tiny spiders that immediately attack (the rest keep the hatch/loot roll). Brood
        // rooms lean more toward baby-eggs.
        const babyEgg = (broodRoom ? randInt(0, 2) > 0 : randInt(0, 1) === 0);
        const candidate = {
          type: 'spiderEgg', id: oid, objectId: oid, dungeonId: dungeon.id, floor, babyEgg,
          name: babyEgg ? (floor >= 3 ? 'Twitching Royal Egg' : 'Twitching Spider Egg') : (floor >= 3 ? 'Royal Spider Egg Clutch' : 'Spider Egg Clutch'), label: 'E',
          royal: floor >= 3, color: floor >= 3 ? '#f4d9ef' : '#ede4cf',
          triggerRadius: 0.9, singleUse: true, playerOnly: true, hazardKind: 'spider_egg', passable: true
        };
        if (active?.interactedObjects?.[spiderEggConsumedKey(active, candidate)]) continue;
        if (placeSilkObject(map, objects, room, candidate, ox, oy, false)) placedEggs++;
      }
      const venomCount = (venomRoom ? randInt(2, 4) : (broodRoom ? 1 : 0) + (kind === 'combat' || kind === 'web_choke' ? 1 : 0));
      for (let c = 0; c < venomCount && placedVenom < maxVenomEggs; c++) {
        const slot = slots[(slotIx++ + 3) % slots.length];
        const ox = Math.round(room.w * slot[0]) + ((i + c + 1) % 2 ? -1 : 1);
        const oy = Math.round(room.h * slot[1]) + ((i + c + 1) % 2 ? 1 : -1);
        const oid = `${dungeon.id}:floor${floor}:venom_egg:${room.id || i}:${c}`;
        const candidate = {
          type: 'venomEgg', id: oid, objectId: oid, dungeonId: dungeon.id, floor,
          name: 'Venom Egg', label: '!', color: '#6f8d3f',
          triggerRadius: 0.85, singleUse: true, playerOnly: true, hazardKind: 'venom_egg', passable: true
        };
        if (active?.interactedObjects?.[venomEggConsumedKey(active, candidate)]) continue;
        if (placeSilkObject(map, objects, room, candidate, ox, oy, false)) placedVenom++;
      }
      // V0.18.38: big web-wrapped victims - break them (walk into) to spill a skeleton.
      const bodyCount = broodRoom || kind === 'combat' || kind === 'boss' || /victim|feeding|bone|prey|midden|corpse/.test(roomText) ? 1 + (floor >= 2 && i % 2 === 0 ? 1 : 0) : 0;
      for (let c = 0; c < bodyCount && placedBodies < maxBodies; c++) {
        const slot = slots[(slotIx++ + 5) % slots.length];
        const ox = Math.round(room.w * slot[0]) - ((i + c) % 2 ? 1 : -1);
        const oy = Math.round(room.h * slot[1]) - ((i + c) % 2 ? -1 : 1);
        const oid = `${dungeon.id}:floor${floor}:wrapped_body:${room.id || i}:${c}`;
        const candidate = {
          type: 'webWrappedBody', id: oid, objectId: oid, dungeonId: dungeon.id, floor,
          name: 'Web-Wrapped Body', label: '', royal: floor >= 3,
          triggerRadius: 1.0, singleUse: true, playerOnly: true, hazardKind: 'wrapped_body', passable: true
        };
        if (active?.interactedObjects?.[webWrappedBodyConsumedKey(active, candidate)]) continue;
        if (placeSilkObject(map, objects, room, candidate, ox, oy, false)) placedBodies++;
      }
    }
    return { placedEggs, placedVenom, placedBodies };
  }

  function stampSilkRoomTileIdentity(map, rooms, floor) {
    for (const room of rooms || []) {
      const tags = Array.isArray(room.visualTags) ? room.visualTags : [];
      for (let y = Math.floor(room.y - room.h / 2); y <= Math.ceil(room.y + room.h / 2); y++) {
        for (let x = Math.floor(room.x - room.w / 2); x <= Math.ceil(room.x + room.w / 2); x++) {
          const tile = map[y]?.[x];
          if (!tile || tile.blocked) continue;
          tile.silkWebCavern = true;
          tile.silkWebFloor = floor;
          tile.silkRoomId = room.id;
          tile.silkRoomKind = room.kind;
          tile.silkVisualTags = tags;
          if (tags.includes('venom') || tags.includes('pool')) tile.venomTint = true;
          if (tags.includes('royal_brood') || tags.includes('queen') || tags.includes('pylon')) tile.royalSilk = true;
          if (tags.includes('cocoons') || tags.includes('cocoon_walls') || tags.includes('hanging_cocoons')) tile.cocoonWall = true;
        }
      }
    }
  }


  function classifySilkRoomReadability(room, floor) {
    const tags = Array.isArray(room?.visualTags) ? room.visualTags : [];
    const name = String(room?.name || '').toLowerCase();
    if (room?.kind === 'safe_entry') return 'safe_transition';
    if (room?.kind === 'boss') return 'boss_arena';
    if (room?.kind === 'treasure') return 'treasure_exit';
    if (room?.kind === 'puzzle' || tags.includes('pylon') || name.includes('pylon')) return 'objective_gate';
    if (tags.includes('bridge') || name.includes('bridge')) return 'signature_bridge';
    if (tags.includes('venom') || name.includes('venom')) return 'venom_hazard';
    if (room?.kind === 'egg_room' || tags.some(tag => /egg|cocoon|brood/.test(tag)) || /egg|cocoon|brood|victim/.test(name)) return 'cocoon_brood';
    if (floor === 3) return 'royal_combat';
    return 'combat_room';
  }

  function decorateSilkRoomEdges(map, objects, room, type, count, floor, options = {}) {
    if (!room || !count) return 0;
    let placed = 0;
    const sides = [
      [-Math.floor(room.w / 2) + 3, -Math.floor(room.h / 3)],
      [ Math.floor(room.w / 2) - 3, -Math.floor(room.h / 3)],
      [-Math.floor(room.w / 3),  Math.floor(room.h / 2) - 3],
      [ Math.floor(room.w / 3),  Math.floor(room.h / 2) - 3]
    ];
    for (let i = 0; i < Math.min(count, sides.length); i++) {
      const [ox, oy] = sides[(i + (floor || 1)) % sides.length];
      const obj = {
        type,
        name: options.name || type,
        color: options.color,
        floor,
        dungeonId: 'silk_web_cavern',
        roomId: room.id,
        readabilityObject: true,
        label: options.label || '',
        role: classifySilkRoomReadability(room, floor),
        ...options.extra
      };
      if (placeSilkDressingObject(map, objects, room, obj, ox, oy, Boolean(options.blocked))) placed++;
    }
    return placed;
  }

  function placeSilkReadabilityObjects(game, dungeon, floor, rooms, map, objects) {
    let placed = 0;
    for (const room of rooms || []) {
      const role = classifySilkRoomReadability(room, floor);
      room.readabilityRole = role;
      room.mapColor = {
        safe_transition: '#f0dca0',
        boss_arena: '#ff6f6f',
        treasure_exit: '#d8ad57',
        objective_gate: '#d68cff',
        signature_bridge: '#8df0bc',
        venom_hazard: '#83d873',
        cocoon_brood: '#d8c8f2',
        royal_combat: '#ff9de8',
        combat_room: '#a777c9'
      }[role] || '#d6e4cf';

      if (role === 'safe_transition') {
        placed += decorateSilkRoomEdges(map, objects, room, 'brokenExpeditionMarker', 2, floor, { name: 'Old Expedition Marker', color: '#f0dca0' });
        placed += decorateSilkRoomEdges(map, objects, room, 'webCurtain', 1, floor, { name: 'Thin Wall Webs', color: '#d8c8f2' });
      } else if (role === 'signature_bridge') {
        // V0.18.51: removed the 'pitShadow' props - they rendered as a weird flat black circle
        // on the floor (user request).
        placed += decorateSilkRoomEdges(map, objects, room, 'webCurtain', 2, floor, { name: 'Bridge Support Webbing', color: '#d8c8f2' });
      } else if (role === 'venom_hazard') {
        placed += decorateSilkRoomEdges(map, objects, room, 'venomRunoff', 3, floor, { name: 'Venom Runoff', color: '#a6ff68', extra: { visualOnly: true, nonDamaging: true } });
      } else if (role === 'cocoon_brood') {
        placed += decorateSilkRoomEdges(map, objects, room, 'cocoonWall', 3, floor, { name: floor >= 3 ? 'Royal Cocoon Wall' : 'Cocoon Wall', color: floor >= 3 ? '#ff9de8' : '#d8c8f2' });
      } else if (role === 'objective_gate') {
        placed += decorateSilkRoomEdges(map, objects, room, 'silkFloorSigil', 2, floor, { name: floor >= 3 ? 'Royal Pylon Sigil' : 'Anchor Gate Sigil', color: floor >= 3 ? '#ff9de8' : '#d68cff', label: 'SIGIL' });
      } else if (role === 'boss_arena') {
        placed += Number(Boolean(placeSilkDressingObject(map, objects, room, { type:'bossArenaMark', name: room.name || 'Boss Arena Mark', dungeonId:dungeon.id, floor, roomId:room.id, readabilityObject:true, color: floor >= 3 ? '#ff9de8' : '#ff6f6f' }, 0, 0, false)));
        placed += decorateSilkRoomEdges(map, objects, room, 'webCurtain', 3, floor, { name: 'Arena Wall Webbing', color: floor >= 3 ? '#ff9de8' : '#d8c8f2' });
      } else if (role === 'treasure_exit') {
        placed += decorateSilkRoomEdges(map, objects, room, 'webbedWeaponRack', 2, floor, { name: 'Webbed Loot Relics', color: '#d8ad57' });
      } else if (role === 'royal_combat') {
        placed += decorateSilkRoomEdges(map, objects, room, 'silkFloorSigil', 1, floor, { name: 'Royal Silk Pattern', color: '#ff9de8' });
        placed += decorateSilkRoomEdges(map, objects, room, 'webCurtain', 2, floor, { name: 'Royal Silk Curtain', color: '#ff9de8' });
      } else {
        placed += decorateSilkRoomEdges(map, objects, room, 'webCurtain', 2, floor, { name: 'Layered Wall Webbing', color: '#d8c8f2' });
      }
    }
    return placed;
  }

  function buildSilkLayoutReadabilityReport(floor, rooms, links, objects, enemies) {
    const roomRoles = {};
    for (const room of rooms || []) roomRoles[classifySilkRoomReadability(room, floor)] = (roomRoles[classifySilkRoomReadability(room, floor)] || 0) + 1;
    let markerCount = 0;
    let readableDressing = 0;
    for (const row of objects || []) for (const obj of row || []) {
      if (!obj) continue;
      if (obj.readabilityObject) readableDressing++;
      if (['webGate','webAnchor','silkCocoon','silkQuestObjective','dungeonStairs','dungeonExit','dungeonTreasure','royalPylon','bossArenaMark','venomSack'].includes(obj.type)) markerCount++;
    }
    return {
      floor,
      roomCount: (rooms || []).length,
      linkCount: (links || []).length,
      roles: roomRoles,
      markerCount,
      readableDressing,
      bossCount: (enemies || []).filter(e => e?.dungeonBoss).length,
      miniBossCount: (enemies || []).filter(e => e?.dungeonMiniBoss).length,
      hasSafeEntry: (rooms || []).some(r => r.kind === 'safe_entry'),
      hasBossArena: (rooms || []).some(r => r.kind === 'boss'),
      hasTreasureExit: (rooms || []).some(r => r.kind === 'treasure'),
      layoutHook: 'v0.13.46-structured-encounters'
    };
  }

  function placeSilkDressingObjects(game, dungeon, floor, rooms, map, objects) {
    const byId = id => roomById(rooms, id);
    for (const room of rooms || []) {
      const tags = Array.isArray(room.visualTags) ? room.visualTags : [];
      const has = tag => tags.includes(tag) || String(room.name || '').toLowerCase().includes(tag.replace('_', ' '));
      if (room.kind === 'safe_entry') {
        placeSilkDressingObject(map, objects, room, { type:'torch', name:'Dungeon Lantern', color:'#f0dca0' }, -Math.floor(room.w/4), -2, false);
        placeSilkDressingObject(map, objects, room, { type:'silkStrands', name:'First Hanging Webs', color:'#d8c8f2' }, Math.floor(room.w/4), -3, false);
      }
      if (room.kind === 'combat' || room.kind === 'web_choke') {
        placeSilkDressingObject(map, objects, room, { type:'silkStrands', name:'Layered Silk Strands', color: floor === 3 ? '#ff9de8' : '#d8c8f2' }, -Math.floor(room.w/3), -Math.floor(room.h/5), false);
        placeSilkDressingObject(map, objects, room, { type:'webBones', name:'Web-Wrapped Remains' }, Math.floor(room.w/3), Math.floor(room.h/5), false);
      }
      if (room.kind === 'egg_room' || has('eggs') || has('brood')) {
        placeSilkDressingObject(map, objects, room, { type:'eggCluster', name: floor === 3 ? 'Royal Egg Cluster' : 'Spider Egg Cluster', royal: floor === 3 }, -Math.floor(room.w/4), Math.floor(room.h/5), false);
        placeSilkDressingObject(map, objects, room, { type:'broodGrowth', name:'Pulsing Brood Growth', color: floor === 3 ? '#9d70c9' : '#6f8d52' }, Math.floor(room.w/4), -Math.floor(room.h/5), false);
      }
      if (has('venom') || has('pool')) {
        placeSilkDressingObject(map, objects, room, { type:'venomPool', name:'Visible Venom Pool', color:'#a6ff68', visualOnly:true, nonDamaging:true }, 0, Math.floor(room.h/4), false);
      }
      if (has('pylon') || has('royal_silk')) {
        placeSilkDressingObject(map, objects, room, { type:'royalPylon', name:'Royal Web Pylon', royal:true }, 0, -Math.floor(room.h/5), false);
      }
      if (has('reliquary')) {
        placeSilkDressingObject(map, objects, room, { type:'silkReliquary', name:'Silk Reliquary' }, 0, 0, false);
      }
      if (floor === 3 && (room.kind === 'boss' || has('chitin') || has('queen'))) {
        placeSilkDressingObject(map, objects, room, { type:'chitinColumn', name:'Royal Chitin Column', royal:true }, -Math.floor(room.w/3), -Math.floor(room.h/4), true);
        placeSilkDressingObject(map, objects, room, { type:'chitinColumn', name:'Royal Chitin Column', royal:true }, Math.floor(room.w/3), -Math.floor(room.h/4), true);
      } else if (has('supports') || has('gate') || room.kind === 'boss') {
        placeSilkDressingObject(map, objects, room, { type:'chitinColumn', name:'Chitin-Web Column' }, -Math.floor(room.w/3), -Math.floor(room.h/4), false);
      }
    }
    const reliquary = byId('silk_reliquary');
    if (reliquary) placeSilkDressingObject(map, objects, reliquary, { type:'silkReliquary', name:'Royal Silk Reliquary' }, 0, 0, false);
  }


  function placeSilkHighFidelityEnvironmentObjects(game, dungeon, floor, rooms, map, objects) {
    let placed = 0;
    const highDetailTypes = new Set([
      'flowstoneDrapery','limestoneRubble','expeditionWarningRelic','silkAnchorBundle','heavyWebCurtain',
      'preyCocoonRack','boneMidden','hatchedEggSac','spiderlingNook','shedExoskeleton','bossBroodNest',
      'waterSeep','escapeTunnelMouth','stalactiteCluster','stalagmiteCluster','phosphorFungusCluster','silkWrappedGear'
    ]);
    for (const room of rooms || []) {
      const tags = Array.isArray(room.visualTags) ? room.visualTags : [];
      const roomText = `${room.id || ''} ${room.name || ''} ${tags.join(' ')}`.toLowerCase();
      const isRoyal = floor >= 3 || roomText.includes('queen') || roomText.includes('royal');
      const silkColor = isRoyal ? '#ffb3ee' : '#d8c8f2';
      const add = (type, name, ox, oy, extra = {}) => {
        const obj = { type, name, dungeonId: dungeon.id, floor, roomId: room.id, highFidelityDressing: true, visualOnly: true, passable: true, nonDamaging: true, color: extra.color || silkColor, ...extra };
        const placedObj = placeSilkDressingObject(map, objects, room, obj, ox, oy, false);
        if (placedObj) {
          placed++;
          if (map[placedObj.y]?.[placedObj.x]) {
            map[placedObj.y][placedObj.x].silkHighFidelityDetail = true;
            map[placedObj.y][placedObj.x].silkDetailType = type;
          }
        }
      };

      if (room.kind === 'safe_entry') {
        add('flowstoneDrapery', 'Flowstone Entry Drapery', -Math.floor(room.w * 0.32), -Math.floor(room.h * 0.22), { color:'#c7b68d' });
        add('expeditionWarningRelic', 'Rusted Expedition Warning', Math.floor(room.w * 0.30), Math.floor(room.h * 0.18), { color:'#d8ad57' });
        add('limestoneRubble', 'Slumped Limestone Blocks', 0, Math.floor(room.h * 0.30), { color:'#8c816d' });
      }

      if (room.kind === 'web_choke' || roomText.includes('gate') || roomText.includes('bridge')) {
        add('silkAnchorBundle', 'Cable-Thick Silk Anchor', -Math.floor(room.w * 0.34), -Math.floor(room.h * 0.18), { tension: true });
        add('heavyWebCurtain', 'Layered Web Curtain', Math.floor(room.w * 0.34), Math.floor(room.h * 0.12), { opacityVariant: roomText.includes('royal') ? 'royal' : 'aged' });
        // V0.18.51: removed the 'stalactiteCluster' - it rendered as weird tan/yellow triangles
        // hanging from the ceiling (user request).
      }

      if (room.kind === 'combat') {
        add('stalagmiteCluster', 'Broken Stalagmite Cluster', -Math.floor(room.w * 0.30), Math.floor(room.h * 0.28), { color:'#8f8877' });
        add('silkWrappedGear', 'Silk-Wrapped Gear Debris', Math.floor(room.w * 0.28), -Math.floor(room.h * 0.20), { color:'#d8ad57' });
        if (roomText.includes('bone') || roomText.includes('feeding') || roomText.includes('victim')) {
          add('boneMidden', 'Bone Midden', Math.floor(room.w * 0.18), Math.floor(room.h * 0.24), { color:'#d6c8a2' });
        } else {
          add('preyCocoonRack', 'Suspended Prey Cocoons', Math.floor(room.w * 0.24), Math.floor(room.h * 0.24), { color:silkColor });
        }
      }

      if (room.kind === 'egg_room' || /egg|cocoon|brood|nursery|throne/.test(roomText)) {
        add('hatchedEggSac', 'Torn Hatched Egg Sacs', -Math.floor(room.w * 0.25), -Math.floor(room.h * 0.18), { color: isRoyal ? '#ffd3f4' : '#e9dfc8' });
        add('spiderlingNook', 'Spiderling Crevice', Math.floor(room.w * 0.26), Math.floor(room.h * 0.24), { color:'#b9d69a' });
        add('preyCocoonRack', 'Brood Chamber Cocoons', 0, Math.floor(room.h * 0.32), { color:silkColor });
      }

      if (room.kind === 'boss') {
        add('shedExoskeleton', 'Shed Boss Exoskeleton', -Math.floor(room.w * 0.33), -Math.floor(room.h * 0.18), { color:'#6d4b38' });
        add('bossBroodNest', floor >= 3 ? 'Royal Brood Nest' : 'Broodwarden Nest', Math.floor(room.w * 0.26), Math.floor(room.h * 0.22), { color: isRoyal ? '#ff9de8' : '#d8c8f2' });
        add('silkAnchorBundle', 'Massive Arena Anchor Cable', -Math.floor(room.w * 0.12), Math.floor(room.h * 0.34), { color:silkColor, massive:true });
        add('phosphorFungusCluster', 'Cold Lair Fungus', Math.floor(room.w * 0.36), -Math.floor(room.h * 0.28), { color:'#9fe8ff' });
      }

      if (room.kind === 'treasure') {
        add('silkWrappedGear', 'Webbed Loot Relics', -Math.floor(room.w * 0.20), 0, { color:'#d8ad57' });
        add('heavyWebCurtain', 'Exit Thread Curtain', Math.floor(room.w * 0.24), 0, { color:silkColor });
      }

      if (/venom|pool|water|drip/.test(roomText)) {
        add('waterSeep', 'Cold Underground Seep', -Math.floor(room.w * 0.12), Math.floor(room.h * 0.34), { color:'#7fc8d8' });
        add('phosphorFungusCluster', 'Pale Cave Fungus', Math.floor(room.w * 0.30), -Math.floor(room.h * 0.30), { color:'#9fe8ff' });
      }

      if (/cell|escape|maze|descent|tunnel/.test(roomText) && room.kind !== 'safe_entry') {
        add('escapeTunnelMouth', 'Half-Sealed Spiderling Tunnel', -Math.floor(room.w * 0.42), 0, { color:'#1b1715' });
      }
    }

    // Mark all Silk Web tile surfaces as high-fidelity cave material. This does not alter collision.
    for (const row of map || []) for (const tile of row || []) {
      if (!tile?.silkWebCavern) continue;
      tile.silkWebHighFidelity = true;
      tile.surfaceDetail = tile.royalSilk ? 'royal_silk_over_limestone' : tile.cocoonWall ? 'cocoon_silk_over_limestone' : tile.venomTint ? 'venom_stained_limestone' : 'webbed_limestone';
    }
    return { placed, highDetailTypes: Array.from(highDetailTypes) };
  }


  function placeSilkWebObjects(game, dungeon, floor, rooms, map, objects) {
    const cfg = SILK_WEB_FLOOR_CONFIG[floor];
    if (!cfg) return;
    const puzzleId = cfg.puzzleId;
    const gateRoom = roomById(rooms, floor === 3 ? 'gauntlet' : 'gate') || roomById(rooms, 'lock_west') || roomById(rooms, 'hollowfang_den') || rooms.find(room => room.kind === 'puzzle') || rooms.find(room => room.kind === 'web_choke') || rooms[0];
    const anchorOffsets = floor === 2 ? [[-10,-3],[10,-3],[0,6],[0,-8]] : [[-9,-3],[9,-3],[0,6]];
    anchorOffsets.forEach((off, index) => {
      placeSilkObject(map, objects, gateRoom, {
        type: 'webAnchor', id: `${dungeon.id}:floor${floor}:anchor:${index}`, objectId: `${dungeon.id}:floor${floor}:anchor:${index}`,
        dungeonId: dungeon.id, floor, puzzleId, gateId: `${dungeon.id}:floor${floor}:gate`, name: `Web Anchor ${index + 1}`, label: 'A', color: '#d68cff', interactionRange: 2.2
      }, off[0], off[1], false);
    });
    placeSilkObject(map, objects, gateRoom, {
      type: 'webGate', id: `${dungeon.id}:floor${floor}:gate`, gateId: `${dungeon.id}:floor${floor}:gate`, dungeonId: dungeon.id, floor,
      requiredAnchors: anchorOffsets.length, puzzleId, label: 'G', color: '#d68cff', name: floor === 3 ? "Queen's Loom Gate" : 'Silk Web Gate', interactionRange: 2.4, sealed: true
    }, 0, -Math.floor(gateRoom.h / 3), true);

    rooms.filter(room => ['egg_room', 'combat'].includes(room.kind)).slice(0, floor + 3).forEach((room, index) => {
      placeSilkObject(map, objects, room, {
        type: 'silkCocoon', cocoonType: index % 3 === 0 ? 'survivor' : index % 3 === 1 ? 'egg' : 'poison',
        id: `${dungeon.id}:floor${floor}:cocoon:${index}`, objectId: `${dungeon.id}:floor${floor}:cocoon:${index}`,
        dungeonId: dungeon.id, floor, name: index % 3 === 0 ? 'Survivor Cocoon' : index % 3 === 1 ? 'Egg Cocoon' : 'Poison Cocoon', label: 'C', color: index % 3 === 2 ? '#83d873' : '#d8c8f2', interactionRange: 2.1
      }, (index % 2 ? 7 : -7), (index % 3) * 4 - 4, false);
    });
    rooms.filter(room => room.kind === 'web_choke' || room.kind === 'puzzle' || room.kind === 'boss').forEach((room, index) => {
      placeSilkObject(map, objects, room, {
        type: 'webHazard', id: `${dungeon.id}:floor${floor}:web_hazard:${index}`, dungeonId: dungeon.id, floor,
        hazardKind: 'ground_web_trap', name: 'Thick Webbing', color: '#d8c8f2',
        breakAfterSeconds: SILK_WEB_TRAP_HOLD_SECONDS, holdSeconds: SILK_WEB_TRAP_HOLD_SECONDS, triggerRadius: 1.65,
        destructible: true, maxHp: 1, hp: 1
      }, -Math.floor(room.w / 4), Math.floor(room.h / 4), false);
    });
    const bridgeRoom = rooms.find(room => room.name?.includes('Bridge'));
    if (bridgeRoom) placeSilkObject(map, objects, bridgeRoom, { type:'webBridge', id:`${dungeon.id}:floor${floor}:bridge`, name:'Webbed Bridge', dungeonId:dungeon.id, floor, color:'#d8c8f2' }, 0, 0, false);
  }

  function placeSilkStructuredObjectives(dungeon, floor, rooms, map, objects) {
    const cfg = SILK_WEB_FLOOR_CONFIG[floor];
    if (!cfg) return { objectives: [], chests: [] };
    const objectives = [];
    const chests = [];
    for (const spec of cfg.objectives || []) {
      const room = roomById(rooms, spec.room);
      if (!room) continue;
      const kind = String(spec.kind || 'silk_bundle');
      const details = kind === 'cave_moss'
        ? { name: 'Cavern Glowmoss', label: 'M', color: '#69c59d', itemId: 'item_glowmoss', objectiveTarget: 'item_glowmoss' }
        : kind === 'venom_nest'
          ? { name: 'Venom Nest', label: 'V', color: '#9bd86f', objectiveTarget: 'silk_web_venom_nest' }
          : { name: 'Bound Silk Bundle', label: 'S', color: '#d8c8f2', itemId: 'item_spider_silk_thread', objectiveTarget: 'item_spider_silk_thread' };
      const placed = placeSilkObject(map, objects, room, {
        type: 'silkQuestObjective',
        id: `${dungeon.id}:floor${floor}:objective:${spec.id}`,
        objectId: `${dungeon.id}:floor${floor}:objective:${spec.id}`,
        dungeonId: dungeon.id,
        floor,
        objectiveKind: kind,
        interactionRange: 2.2,
        ...details
      }, spec.offsetX || 0, spec.offsetY || 0, false);
      if (placed) objectives.push(placed);
    }
    for (const spec of cfg.chests || []) {
      const room = roomById(rooms, spec.room);
      if (!room) continue;
      const placed = placeSilkObject(map, objects, room, {
        type: 'dungeonTreasure',
        id: `${dungeon.id}:floor${floor}:chest:${spec.id}`,
        objectId: `${dungeon.id}:floor${floor}:chest:${spec.id}`,
        dungeonId: dungeon.id,
        floor,
        name: floor >= 3 ? 'Royal Web Reliquary' : 'Guarded Web Cache',
        label: 'T',
        color: '#d8ad57',
        lootTableId: 'loot_silk_web_cavern_treasure',
        requiresBossDefeat: false,
        optionalTreasure: true,
        interactionRange: 2.4
      }, spec.offsetX || 0, spec.offsetY || 0, false);
      if (placed) chests.push(placed);
    }
    return { objectives, chests };
  }

  function createSilkDungeonEnemy(game, typeName, room, dungeon, floor, level, options = {}) {
    const type = (DR.ENEMY_TYPES || []).find(t => t.name === typeName) || (DR.ENEMY_TYPES || []).find(t => t.spiderFamily) || (DR.ENEMY_TYPES || [])[0];
    const isElite = options.elite !== false;
    const intendedX = Number.isFinite(Number(options.intendedX)) ? Number(options.intendedX) : room.x + randInt(-Math.floor(room.w/3), Math.floor(room.w/3));
    const intendedY = Number.isFinite(Number(options.intendedY)) ? Number(options.intendedY) : room.y + randInt(-Math.floor(room.h/3), Math.floor(room.h/3));
    const spacing = Number(options.minActorSpacing || 1.5);
    const spot = game.dungeonSystem?.findActorPlacementNear?.(intendedX, intendedY, { radius: 10, actorId: options.id || typeName, minActorSpacing: spacing })
      || findDungeonActorPlacement(game, intendedX, intendedY, 10, { minActorSpacing: spacing });
    if (!spot) return null;
    const enemy = createDungeonEnemy(game, type, { ...room, x: spot.x, y: spot.y, w: 2, h: 2 }, dungeon, floor, level, {
      name: options.name || type?.name,
      hpMultiplier: options.hpMultiplier ?? (isElite ? silkTuning('elite', floor).hp : 1.15 + floor * 0.08),
      attackMultiplier: options.attackMultiplier ?? (isElite ? silkTuning('elite', floor).attack : 1.0 + floor * 0.05),
      defenseMultiplier: options.defenseMultiplier ?? (isElite ? silkTuning('elite', floor).defense : 1.0),
      xpMultiplier: options.xpMultiplier ?? (isElite ? 2.0 : 1.2),
      lootTableId: options.lootTableId || (isElite ? dungeon.eliteLootTableId : dungeon.lootTableId) || 'loot_silk_web_cavern',
      lootRolls: options.lootRolls ?? (isElite ? 2 : 1),
      elite: isElite,
      dungeonElite: isElite,
      ...options
    });
    if (enemy) {
      enemy.x = spot.x;
      enemy.y = spot.y;
      enemy.spiderFamily = true;
      enemy.silkWebCavern = true;
      enemy.rendererId = 'silk_web_spider';
      enemy.spiderRole = (window.DreamRealms?.render?.SilkWebSpiderProceduralModel || window.SilkWebSpiderProceduralModel)?.roleFor?.(enemy) || String(typeName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      enemy.semanticTags = Array.from(new Set([
        ...(enemy.semanticTags || []),
        'silk_web_mob',
        `silk_web_floor${floor}_mob`,
        ...(isElite ? ['silk_web_elite', `silk_web_floor${floor}_elite`] : [])
      ]));
      if (isElite) applySilkEnemyBalance(enemy, floor, 'elite');
      else {
        enemy.silkWebBalanceRank = 'normal';
        enemy.silkWebFloor = floor;
      }
      enemy.silkWebRoomId = room.id || room.kind || '';
      enemy.homeX = enemy.spawnHomeX = spot.x;
      enemy.homeY = enemy.spawnHomeY = spot.y;
      enemy.patrolRadius = Math.max(2.5, Number(options.patrolRadius || 4));
      enemy.roamRadius = enemy.patrolRadius;
      enemy.encounterId = options.encounterId || null;
      enemy.encounterGroupId = options.encounterGroupId || null;
      enemy.intentionalDungeonPlacement = true;
      enemy.pathRecalcBiasMs = 720 + Math.floor(Math.random() * 220);
    }
    return enemy;
  }

  function createSilkMiniBoss(game, draftId, room, dungeon, floor) {
    const draft = bossDef(game, draftId);
    if (!draft) return null;
    const spot = game.dungeonSystem?.findActorPlacementNear?.(room.x, room.y, { radius: 10, actorId: draftId, minActorSpacing: 2.0 })
      || findDungeonActorPlacement(game, room.x, room.y, 10, { minActorSpacing: 2.0 });
    if (!spot) return null;
    const enemy = createBossEnemy(game, { ...dungeon, bossIds: [draftId], lootTableId: draft.lootTableId || dungeon.miniBossLootTableId }, floor, { ...room, x: spot.x, y: spot.y });
    if (!enemy) return null;
    enemy.x = spot.x;
    enemy.y = spot.y;
    enemy.dungeonBoss = false;
    enemy.dungeonMiniBoss = true;
    enemy.spiderFamily = true;
    enemy.silkWebCavern = true;
    enemy.rendererId = 'silk_web_spider';
    enemy.spiderRole = (window.DreamRealms?.render?.SilkWebSpiderProceduralModel || window.SilkWebSpiderProceduralModel)?.roleFor?.(enemy) || String(draftId || draft.name || '').toLowerCase();
    enemy.bossId = draftId;
    enemy.name = draft.name;
    enemy.lootTableId = draft.lootTableId || dungeon.miniBossLootTableId || 'loot_silk_web_cavern_minibosses';
    enemy.baseType = { ...(enemy.baseType || {}), name: draft.name, lootTableId: enemy.lootTableId };
    enemy.semanticTags = ['silk_web_miniboss', `silk_web_floor${floor}_miniboss`];
    applySilkEnemyBalance(enemy, floor, 'miniboss');
    enemy.bossArena = { x: room.x, y: room.y, w: room.w, h: room.h, floor };
    enemy.silkWebEncounterActive = false;
    enemy.silkWebDormant = true;
    enemy.bossAbilityTimer = 3.0 + Math.random() * 1.5;
    enemy.pathRecalcBiasMs = 820 + Math.floor(Math.random() * 240);
    return enemy;
  }

  function createSilkBoss(game, draftId, room, dungeon, floor) {
    const spot = game.dungeonSystem?.findActorPlacementNear?.(room.x, room.y, { radius: 12, actorId: draftId, minActorSpacing: 2.5 })
      || findDungeonActorPlacement(game, room.x, room.y, 12, { minActorSpacing: 2.5 });
    if (!spot) return null;
    const enemy = createBossEnemy(game, { ...dungeon, bossIds: [draftId] }, floor, { ...room, x: spot.x, y: spot.y });
    if (!enemy) return null;
    enemy.x = spot.x;
    enemy.y = spot.y;
    enemy.silkWebCavern = true;
    enemy.spiderFamily = true;
    enemy.rendererId = 'silk_web_spider';
    enemy.spiderRole = (window.DreamRealms?.render?.SilkWebSpiderProceduralModel || window.SilkWebSpiderProceduralModel)?.roleFor?.(enemy) || String(draftId || '').toLowerCase();
    enemy.semanticTags = ['silk_web_boss', draftId, `silk_web_floor${floor}_boss`];
    applySilkEnemyBalance(enemy, floor, 'boss');
    enemy.bossArena = { x: room.x, y: room.y, w: room.w, h: room.h, floor };
    enemy.silkWebEncounterActive = false;
    enemy.silkWebDormant = true;
    enemy.bossAbilityTimer = 3.2 + Math.random() * 1.6;
    return enemy;
  }

  // V0.18.41: size-varied FILLER spiders (baby / little / big) so the cavern teems,
  // on top of the authored elite packs. Distinct modelScale + the size-bucketed sprite
  // cache key (render/entity-renderer.js) keep each size visually distinct. 'big' is a
  // tanky non-elite so it does NOT inflate elite/objective tracking.
  function makeSilkSpiderVariant(game, dungeon, floor, room, sizeClass, level) {
    const V = {
      baby:   { type: 'Webling Skitterer', elite: false, scale: 0.34, name: 'Spiderling',      hp: 0.5,  atk: 0.6,  def: 0.9,  speed: 1.55, xp: 0.5, color: '#d8c8f2', small: true },
      little: { type: 'Webling Skitterer', elite: false, scale: 0.5,  name: 'Little Skitterer', hp: 0.72, atk: 0.82, def: 0.95, speed: 1.35, xp: 0.7, color: '#cbbfe2', small: true },
      big:    { type: floor >= 3 ? 'Pale Cave Widow Elite' : 'Silkfang Stalker Elite', elite: false, scale: 1.34, name: 'Broodmother Spider', hp: 1.6, atk: 1.18, def: 1.15, speed: 0.95, xp: 1.4 }
    }[sizeClass];
    if (!V) return null;
    const e = createSilkDungeonEnemy(game, V.type, room, dungeon, floor, level, {
      elite: V.elite, name: V.name,
      hpMultiplier: V.hp, attackMultiplier: V.atk, defenseMultiplier: V.def, speed: V.speed,
      xpMultiplier: V.xp, lootRolls: 1,
      intendedX: room.x + randInt(-Math.floor(room.w / 3), Math.floor(room.w / 3)),
      intendedY: room.y + randInt(-Math.floor(room.h / 3), Math.floor(room.h / 3)),
      minActorSpacing: sizeClass === 'baby' ? 0.4 : sizeClass === 'big' ? 1.9 : 0.9,
      patrolRadius: sizeClass === 'big' ? 3.2 : 3.6
    });
    if (!e) return null;
    e.modelScale = V.scale;
    e.visualScale = V.scale;
    if (V.small) e.spiderling = true;
    if (V.color) e.color = V.color;
    if (sizeClass === 'big') e.bigSpider = true;
    e.extraFillerSpider = true;
    return e;
  }

  function spawnSilkExtraSpiders(game, dungeon, floor, rooms, enemies) {
    const cfg = SILK_WEB_FLOOR_CONFIG[floor] || SILK_WEB_FLOOR_CONFIG[1];
    const lvl = () => randInt(cfg.levelMin || 6, cfg.levelMax || 10);
    const targetRooms = (rooms || []).filter(r => {
      const k = String(r.kind || '').toLowerCase();
      return k === 'combat' || k === 'egg_room' || k === 'web_choke' || r.silkPocket;
    });
    const cap = floor === 1 ? 40 : floor === 2 ? 48 : 54;
    let placed = 0;
    const push = e => { if (e && placed < cap) { enemies.push(e); placed++; } };
    for (const room of targetRooms) {
      if (placed >= cap) break;
      const roomText = `${room.id || ''} ${(room.visualTags || []).join(' ')}`.toLowerCase();
      const brood = room.kind === 'egg_room' || /egg|cocoon|brood|nursery|nest|hatch/.test(roomText);
      const area = Math.max(1, room.w * room.h);
      const sizeScale = Math.min(3, Math.max(1, Math.round(area / 300)));
      for (let i = 0, n = (brood ? randInt(3, 5) : randInt(1, 2)); i < n; i++) push(makeSilkSpiderVariant(game, dungeon, floor, room, 'baby', Math.max(1, lvl() - 1)));
      for (let i = 0, n = randInt(1, sizeScale + 1); i < n; i++) push(makeSilkSpiderVariant(game, dungeon, floor, room, 'little', lvl()));
      if (!room.silkPocket && area > 700 && randInt(0, 2) === 0) push(makeSilkSpiderVariant(game, dungeon, floor, room, 'big', lvl()));
    }
    return placed;
  }

  function spawnSilkWebCavernEnemies(game, dungeon, floor, rooms) {
    const cfg = SILK_WEB_FLOOR_CONFIG[floor] || SILK_WEB_FLOOR_CONFIG[1];
    const enemies = [];
    game.dungeonEnemies = enemies;
    for (const encounter of cfg.encounters || []) {
      const room = roomById(rooms, encounter.room);
      const group = SILK_WEB_ENCOUNTER_GROUPS[encounter.group];
      if (!room || !group) continue;
      let memberIndex = 0;
      for (const member of group.members || []) {
        for (let count = 0; count < Math.max(1, Number(member.count || 1)); count++) {
          const offset = SILK_WEB_PACK_OFFSETS[memberIndex % SILK_WEB_PACK_OFFSETS.length];
          const intendedX = room.x + Number(encounter.offsetX || 0) + offset[0];
          const intendedY = room.y + Number(encounter.offsetY || 0) + offset[1];
          const enemy = createSilkDungeonEnemy(game, member.type, room, dungeon, floor, randInt(cfg.levelMin, cfg.levelMax), {
            id: `${encounter.id}:${memberIndex}`,
            intendedX,
            intendedY,
            elite: member.elite !== false,
            encounterId: encounter.id,
            encounterGroupId: encounter.group,
            patrolRadius: encounter.patrol ? group.patrolRadius : Math.min(3.25, group.patrolRadius),
            minActorSpacing: group.spacing
          });
          if (enemy) {
            enemy.encounterPatrol = Boolean(encounter.patrol);
            enemies.push(enemy);
          }
          memberIndex++;
        }
      }
    }
    for (const mini of cfg.minibosses) {
      const room = roomById(rooms, mini.room);
      const enemy = createSilkMiniBoss(game, mini.id, room, dungeon, floor);
      if (enemy) enemies.push(enemy);
    }
    const bossRoom = roomById(rooms, 'boss');
    const boss = createSilkBoss(game, cfg.bossId, bossRoom, dungeon, floor);
    if (boss) enemies.push(boss);
    // V0.18.41: teeming filler - baby/little/big spiders across combat rooms + pockets.
    spawnSilkExtraSpiders(game, dungeon, floor, rooms, enemies);
    return enemies;
  }

  // V0.18.49: decorative free-roaming little spiders that crawl the floor. They are NOT
  // enemies (no AI/HP/combat) - they just wander, and get squished if a friendly actor steps
  // on them. Stored on game.silkCritters; updated by dungeonSystem.updateSilkCritters, drawn
  // by game.renderSilkCritters. Regenerated each floor entry.
  function spawnSilkCritters(game, floor, rooms, map, objects) {
    const TILE = DR.TILE || {};
    const walkable = (tx, ty) => {
      const t = map?.[ty]?.[tx];
      if (!t || t.blocked || t.type !== TILE.CAVE_FLOOR) return false;
      const o = objects?.[ty]?.[tx];
      return !(o && (o.solid || o.blocking));
    };
    const cap = floor >= 3 ? 62 : floor === 2 ? 56 : 50; // V0.18.53: more ground crawlers to step on
    const spots = (rooms || []).filter(r => { const k = String(r.kind || '').toLowerCase(); return k !== 'safe_entry' && k !== 'treasure'; });
    const critters = [];
    let guard = 0;
    while (critters.length < cap && guard++ < cap * 10 && spots.length) {
      const room = spots[randInt(0, spots.length - 1)];
      const tx = Math.floor(room.x) + randInt(-Math.floor(room.w / 2) + 1, Math.floor(room.w / 2) - 1);
      const ty = Math.floor(room.y) + randInt(-Math.floor(room.h / 2) + 1, Math.floor(room.h / 2) - 1);
      if (!walkable(tx, ty)) continue;
      critters.push({
        x: tx + 0.5, y: ty + 0.5, dir: Math.random() * Math.PI * 2, vx: 0, vy: 0,
        wander: 0.3 + Math.random() * 0.9, moving: Math.random() < 0.7,
        size: 2.0 + Math.random() * 1.8, seed: (Math.random() * 1e9) >>> 0,
        royal: floor >= 3, dead: false
      });
    }
    game.silkCritters = critters;
    game.silkCrittersFloor = floor;
    return critters.length;
  }

  function generateSilkWebCavernFloor(game, dungeon, floor) {
    const CONFIG = DR.CONFIG || { MAP_SIZE: 200 };
    const TILE = DR.TILE || {};
    const TILE_DEF = DR.TILE_DEF || {};
    const size = CONFIG.MAP_SIZE || 200;
    const wallType = TILE.CAVE_WALL;
    const floorType = TILE.CAVE_FLOOR;
    const map = buildEmptyGrid(size, { type: wallType, elev: 5, blocked: true });
    const objects = buildEmptyObjects(size);
    const cfg = SILK_WEB_FLOOR_CONFIG[floor] || SILK_WEB_FLOOR_CONFIG[1];
    const rooms = cfg.rooms.map(room => ({ ...room, dungeonLayoutRevamp: true }));
    for (const room of rooms) carveRoom(map, objects, room);
    const links = Array.isArray(cfg.links) && cfg.links.length
      ? cfg.links
      : rooms.slice(1).map((room, index) => [rooms[index]?.id, room.id]);
    for (const pair of links) {
      const a = roomById(rooms, pair[0]);
      const b = roomById(rooms, pair[1]);
      if (a && b) carveCorridor(map, objects, a, b);
    }
    // V0.18.41: branch small/medium pocket caverns off the main rooms via narrow tunnels,
    // then everything below (tile flags, dressing, spawns) operates on the full room list.
    carveSilkPocketCaverns(game, dungeon, floor, rooms, map, objects);
    stampSilkRoomTileIdentity(map, rooms, floor);
    // V0.18.37: web EVERY walkable floor tile of the cavern - the corridors between
    // rooms too, not just room interiors - so the silk floor overlay reads as one
    // continuous infested mat with no bare patches. These tile flags drive
    // render/terrain-renderer.js drawSilkWebCavernSurfaceDetails.
    for (let ty = 0; ty < map.length; ty++) {
      const row = map[ty];
      if (!row) continue;
      for (let tx = 0; tx < row.length; tx++) {
        const t = row[tx];
        if (!t) continue;
        if (t.type === floorType && !t.blocked) {
          if (!t.silkWebCavern) { t.silkWebCavern = true; t.silkWebFloor = floor; }
        } else if (t.type === wallType && !t.silkWebWall) {
          // web the cavern walls that actually border the walkable floor (skip the
          // dead outer rock), so wall faces get silk drapes in the terrain render.
          if (map[ty - 1]?.[tx]?.type === floorType || map[ty + 1]?.[tx]?.type === floorType ||
              row[tx - 1]?.type === floorType || row[tx + 1]?.type === floorType) {
            t.silkWebWall = true;
            t.silkWebFloor = floor;
          }
        }
      }
    }
    placeWallRim(map, objects);
    placeSilkDressingObjects(game, dungeon, floor, rooms, map, objects);
    const highFidelityEnvironmentReport = placeSilkHighFidelityEnvironmentObjects(game, dungeon, floor, rooms, map, objects);
    const readabilityObjectCount = placeSilkReadabilityObjects(game, dungeon, floor, rooms, map, objects);
    placeSilkWebObjects(game, dungeon, floor, rooms, map, objects);
    const venomSackCount = placeSilkVenomSacks(game, dungeon, floor, rooms, map, objects);
    placeSilkInfestationDressing(game, dungeon, floor, rooms, map, objects);
    placeSilkCeilingWebsAndJunk(game, dungeon, floor, rooms, map, objects);
    placeSilkNestEggs(game, dungeon, floor, rooms, map, objects);
    const structuredObjects = placeSilkStructuredObjectives(dungeon, floor, rooms, map, objects);
    const entrance = rooms[0];
    const last = rooms[rooms.length - 1];
    objects[Math.floor(entrance.y)][Math.floor(entrance.x)] = { type: 'dungeonExit', dungeonId: dungeon.id, floor, name: dungeon.name || dungeon.id };
    if (floor < 3) {
      objects[Math.floor(last.y)][Math.floor(last.x)] = { type: 'dungeonStairs', dungeonId: dungeon.id, floor, nextFloor: floor + 1, name: `Descend to ${floor === 1 ? 'The Cocoon Warrens' : "The Queen's Loom"}` };
    } else {
      objects[Math.floor(last.y)][Math.floor(last.x)] = { type: 'dungeonTreasure', dungeonId: dungeon.id, floor, lootTableId: dungeon.rewardLootTableId || 'loot_silk_web_cavern_final', name: 'Treasure Web / Exit Thread' };
      if (objects[Math.floor(last.y) + 3]) objects[Math.floor(last.y) + 3][Math.floor(last.x)] = { type: 'dungeonExit', dungeonId: dungeon.id, floor, name: 'Exit Thread' };
    }
    for (const room of [entrance, last]) {
      for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
        const x = Math.floor(room.x) + ox; const y = Math.floor(room.y) + oy;
        if (!map[y]?.[x]) continue;
        map[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
        if (Math.hypot(ox, oy) <= 2) objects[y][x] = objects[y][x]?.type?.startsWith('dungeon') ? objects[y][x] : null;
      }
    }
    // Phase 23: carve cave fishing pools before reachability/enemy placement so
    // both account for the water (it is non-walkable; enemies avoid it).
    carveSilkWebFishingPools(map, objects, rooms, floor);
    game.dungeonMap = map;
    game.dungeonObjects = objects;
    game.dungeonReachableTiles = buildDungeonReachableTiles(map, objects, entrance.x + 0.5, entrance.y + 3.5);
    spawnSilkCritters(game, floor, rooms, map, objects); // V0.18.49: decorative crawling spiders
    const enemies = spawnSilkWebCavernEnemies(game, dungeon, floor, rooms);
    const layoutLinks = links.map(pair => ({ from: pair[0], to: pair[1] }));
    const readabilityReport = buildSilkLayoutReadabilityReport(floor, rooms, layoutLinks, objects, enemies);
    readabilityReport.readabilityObjectCount = readabilityObjectCount;
    return {
      map, objects, rooms, enemies, entrance, exit: last, layoutLinks, readabilityReport,
      floorMeta: {
        id: cfg.id, name: cfg.name, levelMin: cfg.levelMin, levelMax: cfg.levelMax, eliteTarget: cfg.eliteTarget,
        visualTheme: cfg.visualTheme || 'silk_web_cavern', roomCount: rooms.length, linkCount: layoutLinks.length,
        readabilityObjectCount, readabilityReport, highFidelityEnvironmentReport,
        highFidelityObjectCount: highFidelityEnvironmentReport?.placed || 0,
        encounterCount: (cfg.encounters || []).length,
        objectiveCount: structuredObjects.objectives.length,
        optionalChestCount: structuredObjects.chests.length,
        venomSackCount,
        layoutRevamp: 'v0.13.46-structured-encounters'
      }
    };
  }

  function spawnDungeonEnemies(game, dungeon, floor, rooms) {
    const Enemy = DR.entities?.Enemy || DR.Enemy;
    if (!Enemy) return [];
    const theme = String(dungeon.theme || '').toLowerCase();
    const allTypes = DR.ENEMY_TYPES || [];
    const spider = allTypes.find(t => /widow|spider|thorn/i.test(t.name));
    const rotling = allTypes.find(t => /rotling|gloom/i.test(t.name));
    const wisp = allTypes.find(t => /wisp|grave/i.test(t.name));
    const fallback = allTypes[0];
    const preferred = theme.includes('spider') ? [spider || fallback] : [rotling || fallback, wisp || fallback, spider || fallback].filter(Boolean);
    const enemies = [];
    const minLevel = Math.max(1, Math.floor(safeNumber(dungeon.minLevel, 1)) + floor - 1);
    const maxLevel = Math.max(minLevel, Math.floor(safeNumber(dungeon.maxLevel, minLevel)) + floor - 1);
    const multiplier = Math.max(1, Math.floor(safeNumber(dungeon.eliteMultiplier, 1)));
    for (const room of rooms) {
      if (isBossRoom(room.kind)) {
        const boss = createBossEnemy(game, dungeon, floor, room);
        if (boss) enemies.push(boss);
        const addCount = Math.max(1, Math.min(4, 1 + floor));
        for (let i = 0; i < addCount; i++) {
          const type = preferred[randInt(0, preferred.length - 1)] || fallback;
          if (!type) continue;
          const add = createDungeonEnemy(game, type, room, dungeon, floor, randInt(minLevel, maxLevel), {
            name: theme.includes('spider') ? `Silkbound ${type.name}` : `Cryptbound ${type.name}`,
            hpMultiplier: 1.25 + multiplier * 0.18,
            attackMultiplier: 1.15 + multiplier * 0.08,
            defenseMultiplier: 1.10 + multiplier * 0.06,
            xpMultiplier: 1.55,
            lootTableId: 'loot_dungeon_elite_mobs',
            lootRolls: Math.max(1, Math.min(3, multiplier)),
            elite: true,
            dungeonElite: true
          });
          if (add) enemies.push(add);
        }
        continue;
      }
      if (!isDungeonCombatRoom(room.kind)) continue;
      const count = 3 + floor;
      for (let i = 0; i < count; i++) {
        const type = preferred[randInt(0, preferred.length - 1)] || fallback;
        if (!type) continue;
        const enemy = createDungeonEnemy(game, type, room, dungeon, floor, randInt(minLevel, maxLevel), {
          name: theme.includes('spider') ? `Dungeon ${type.name}` : `Crypt ${type.name}`,
          hpMultiplier: Math.max(1, multiplier * 0.75),
          attackMultiplier: 1.1,
          defenseMultiplier: 1.05,
          xpMultiplier: 1.35,
          lootTableId: 'loot_dungeon_elite_mobs',
          lootRolls: Math.max(1, Math.min(3, multiplier)),
          elite: true,
          dungeonElite: true
        });
        if (enemy) enemies.push(enemy);
      }
    }
    return enemies;
  }

  function buildDungeonNavigationSnapshot(game, dungeon, floor, floorData) {
    const activeFloor = Math.max(1, Math.floor(safeNumber(floor, 1)));
    const rooms = (floorData?.rooms || []).map(room => ({
      id: room.id, kind: room.kind, name: room.name, x: room.x, y: room.y, w: room.w, h: room.h,
      readabilityRole: room.readabilityRole || classifySilkRoomReadability(room, activeFloor),
      mapColor: room.mapColor || null
    }));
    const objects = [];
    const grid = floorData?.objects || game.objects || [];
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y] || [];
      for (let x = 0; x < row.length; x++) {
        const obj = row[x];
        if (!obj || !['webGate','webAnchor','silkCocoon','dungeonStairs','dungeonExit','dungeonTreasure','venomSack'].includes(obj.type)) continue;
        objects.push({ type: obj.type, id: obj.id || obj.objectId || obj.gateId || `${obj.type}:${x}:${y}`, name: obj.name || obj.type, x, y, floor: obj.floor || activeFloor, opened: !!obj.opened, cocoonType: obj.cocoonType || null, nextFloor: obj.nextFloor || null });
      }
    }
    const enemyMarkers = (floorData?.enemies || game.dungeonEnemies || [])
      .filter(enemy => enemy && enemy.alive !== false && (enemy.dungeonBoss || enemy.dungeonMiniBoss))
      .map(enemy => ({ id: enemy.bossId || enemy.id || enemy.name, name: enemy.name, x: enemy.x, y: enemy.y, boss: !!enemy.dungeonBoss, miniBoss: !!enemy.dungeonMiniBoss }));
    const links = Array.isArray(floorData?.layoutLinks) ? floorData.layoutLinks.map(link => ({ ...link })) : [];
    return { dungeonId: dungeon?.id || 'dungeon', dungeonName: dungeon?.name || 'Dungeon', floor: activeFloor, rooms, links, objects, enemyMarkers, readabilityReport: floorData?.readabilityReport || null, updatedAt: nowMs() };
  }

  function generateDungeonFloor(game, dungeon, floor) {
    if (isSilkWebCavern(dungeon)) return generateSilkWebCavernFloor(game, dungeon, floor);
    const CONFIG = DR.CONFIG || { MAP_SIZE: 200, START_X: 100, START_Y: 100 };
    const TILE = DR.TILE || {};
    const TILE_DEF = DR.TILE_DEF || {};
    const size = CONFIG.MAP_SIZE || 200;
    const wallType = TILE.CAVE_WALL;
    const floorType = TILE.CAVE_FLOOR;
    const map = buildEmptyGrid(size, { type: wallType, elev: 5, blocked: true });
    const objects = buildEmptyObjects(size);
    const plan = Array.isArray(dungeon.roomPlan) && dungeon.roomPlan.length
      ? dungeon.roomPlan
      : ['entrance', 'combat', 'puzzle', 'boss', 'treasure'];
    const usable = plan.slice(0, 7);
    const spacing = Math.floor(126 / Math.max(1, usable.length - 1));
    const rooms = usable.map((kind, index) => {
      const centerY = 172 - index * spacing;
      const wave = index % 3 === 1 ? -24 : index % 3 === 2 ? 22 : 0;
      const width = kind === 'boss' ? 28 : kind === 'treasure' ? 20 : 24;
      const height = kind === 'boss' ? 20 : 17;
      return { kind, x: 100 + wave, y: clamp(centerY, 30, 176), w: width, h: height };
    });
    for (const room of rooms) carveRoom(map, objects, room);
    for (let i = 1; i < rooms.length; i++) carveCorridor(map, objects, rooms[i - 1], rooms[i]);
    placeWallRim(map, objects);
    placeGeneratedPuzzleObjects(game, dungeon, floor, rooms, map, objects);

    const entrance = rooms[0] || { x: CONFIG.START_X, y: CONFIG.START_Y + 70 };
    const last = rooms[rooms.length - 1] || entrance;
    objects[Math.floor(entrance.y)] [Math.floor(entrance.x)] = { type: 'dungeonExit', dungeonId: dungeon.id, floor, name: dungeon.name || dungeon.id };
    if (floor < Math.max(1, Math.floor(safeNumber(dungeon.floors, 1)))) {
      objects[Math.floor(last.y)] [Math.floor(last.x)] = { type: 'dungeonStairs', dungeonId: dungeon.id, floor, nextFloor: floor + 1, name: dungeon.name || dungeon.id };
    } else {
      objects[Math.floor(last.y)] [Math.floor(last.x)] = { type: 'dungeonTreasure', dungeonId: dungeon.id, floor, lootTableId: dungeon.lootTableId || 'loot_dungeon_chest', name: `${dungeon.name || 'Dungeon'} Reward` };
      if (objects[Math.floor(last.y) + 3]) objects[Math.floor(last.y) + 3][Math.floor(last.x)] = { type: 'dungeonExit', dungeonId: dungeon.id, floor, name: dungeon.name || dungeon.id };
    }

    // Keep a small interaction disk around instance travel nodes walkable.
    for (const room of [entrance, last]) {
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const x = Math.floor(room.x) + ox;
          const y = Math.floor(room.y) + oy;
          if (!map[y]?.[x]) continue;
          map[y][x] = { type: floorType, elev: 0, blocked: !TILE_DEF[floorType]?.walk };
        }
      }
    }

    const enemies = spawnDungeonEnemies(game, dungeon, floor, rooms);
    return { map, objects, rooms, enemies, entrance, exit: last };
  }


  function ensureNearbyDungeonSpecialObject(game) {
    if (game.currentZone !== 'dungeon' || !game.player) return null;
    const px = Math.floor(game.player.x);
    const py = Math.floor(game.player.y);
    let best = null;
    let bestD = 2.7;
    for (let y = py - 4; y <= py + 4; y++) {
      for (let x = px - 4; x <= px + 4; x++) {
        const obj = game.objects?.[y]?.[x];
        if (!obj || !['webAnchor','webGate','silkCocoon','silkQuestObjective'].includes(obj.type)) continue;
        const d = Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y);
        if (d < bestD) { bestD = d; best = { ...obj, x, y }; }
      }
    }
    return best;
  }

  function ensureNearbyTravelNode(game) {
    if (game.currentZone !== 'dungeon' || !game.player) return null;
    const px = Math.floor(game.player.x);
    const py = Math.floor(game.player.y);
    let best = null;
    let bestD = 2.8;
    for (let y = py - 4; y <= py + 4; y++) {
      for (let x = px - 4; x <= px + 4; x++) {
        const obj = game.objects?.[y]?.[x];
        if (!obj || !['dungeonExit', 'dungeonStairs', 'dungeonTreasure'].includes(obj.type)) continue;
        const d = Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y);
        if (d < bestD) {
          bestD = d;
          best = { ...obj, x, y };
        }
      }
    }
    return best;
  }

  window.registerDreamRealmsSystem({
    id: 'dungeonRuntime',
    name: 'Runtime Dungeon Loading',

    install(game) {
      const runtime = {
        id: 'dungeonRuntime',
        name: 'Runtime Dungeon Loading',
        game,
        state: normalizeState(game.pendingDungeonRuntimeState || readLocalState()),
        panel: ensurePanel(),
        toast: null,
        nearbyEntrance: null,
        nearbyTravelNode: null,
        statusTick: 0,
        toastTimer: 0,

        init() {
          game.dungeonSystem = this;
          game.dungeonRuntimeState = this.state;
          game.dungeonMap = game.dungeonMap || null;
          game.dungeonObjects = game.dungeonObjects || null;
          game.dungeonEnemies = game.dungeonEnemies || [];
          game.dungeonRooms = game.dungeonRooms || [];
          this.ensureDefaultDungeonEntrances();
          this.bindInput();
          this.refreshPanel();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'interact') : String(event.key || '').toLowerCase() === 'e')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            if (game.currentZone === 'dungeon') {
              const special = ensureNearbyDungeonSpecialObject(game);
              if (special) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.activateDungeonSpecialObject(special);
                return;
              }
              const node = ensureNearbyTravelNode(game);
              if (!node) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              this.activateDungeonTravelNode(node);
              return;
            }
            const marker = this.findNearbyEntrance();
            if (!marker) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.enterDungeon(marker);
          }, true);
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(raw) {
          this.state = normalizeState(raw || defaultState());
          game.dungeonRuntimeState = this.state;
          this.saveState();
          this.refreshPanel();
        },

        saveState() {
          game.dungeonRuntimeState = this.state;
          writeLocalState(this.state);
          if (game.worldSaveDirty !== undefined) game.worldSaveDirty = true;
        },

        onGameEvent(eventName, payload = {}) {
          if (eventName === 'player-started') {
            this.state = normalizeState(game.pendingDungeonRuntimeState || this.state || readLocalState());
            game.dungeonRuntimeState = this.state;
            this.ensureDefaultDungeonEntrances();
            this.refreshPanel();
          }
          if (eventName === 'enemy-killed' && payload?.enemy && (payload.enemy.dungeonBoss || payload.enemy.dungeonMiniBoss)) {
            const enemy = payload.enemy;
            const floor = enemy.dungeonFloor || this.state.active?.floor || 1;
            if (enemy.dungeonMiniBoss) {
              const key = miniBossKillKey(this.state, enemy.bossId || enemy.id || enemy.name, floor);
              this.state.miniBossKills[key] = {
                miniBossId: enemy.bossId || enemy.id || enemy.name,
                miniBossName: enemy.name,
                dungeonId: enemy.dungeonId,
                floor,
                defeatedAt: nowMs(),
                lootTableId: payload.lootTableId || enemy.lootTableId || null
              };
              if (this.state.active) {
                this.state.active.miniBossesDefeated = this.state.active.miniBossesDefeated || {};
                this.state.active.miniBossesDefeated[enemy.bossId || enemy.name] = nowMs();
              }
              this.saveState();
              game.spawnRing?.(enemy.x, enemy.y, '#c797ff', 26);
              game.log?.(`${enemy.name} defeated. Dungeon locks weaken.`);
              this.showToast('Mini-boss defeated', `${enemy.name} is down. Web gates may now be unlocked.`);
              this.refreshPanel();
              return;
            }
            const key = bossKillKey(this.state, enemy.bossId, floor);
            this.state.bossKills[key] = {
              bossId: enemy.bossId,
              bossName: enemy.name,
              dungeonId: enemy.dungeonId,
              floor,
              defeatedAt: nowMs(),
              lootTableId: payload.lootTableId || enemy.lootTableId || null
            };
            if (this.state.active) {
              this.state.active.bossesDefeated = this.state.active.bossesDefeated || {};
              this.state.active.bossesDefeated[enemy.bossId || enemy.name] = nowMs();
            }
            this.saveState();
            game.spawnRing?.(enemy.x, enemy.y, '#d8ad57', 32);
            game.log?.(`${enemy.name} defeated. Dungeon gate unlocked.`);
            this.showToast('Boss defeated', `${enemy.name} is down. Stairs/rewards are now unlocked.`);
            this.refreshPanel();
          }
        },

        ensureDefaultDungeonEntrances() {
          if (!game.editorDungeonMarkers || typeof game.editorDungeonMarkers !== 'object') {
            game.editorDungeonMarkers = { dark_woods: {}, mossfang_cave: {} };
          }
          if (!game.editorDungeonMarkers.dark_woods) game.editorDungeonMarkers.dark_woods = {};
          if (!game.editorDungeonMarkers.mossfang_cave) game.editorDungeonMarkers.mossfang_cave = {};

          // V0.11.8: dungeon progression is owned by named cave final-floor hooks.
          // Do not inject the old standalone Dark Woods / Mossfang shortcut markers,
          // because those bypass the small -> medium -> large cave progression curve.
          const staleDefaults = [
            { zoneId: 'dark_woods', key: '137,64', dungeonId: 'dungeon_glooms_crypt' },
            { zoneId: 'mossfang_cave', key: '76,114', dungeonId: 'dungeon_silk_web_depths' }
          ];
          let removed = 0;
          for (const stale of staleDefaults) {
            const grid = game.editorDungeonMarkers?.[stale.zoneId];
            const marker = grid?.[stale.key];
            if (marker?.dungeonId === stale.dungeonId && (marker.markerKind || marker.kind) === 'entrance') {
              delete grid[stale.key];
              removed++;
            }
          }
          if (removed) game.worldSaveDirty = true;
          return Boolean(removed);
        },

        findNearbyEntrance(range = 3.0) {
          if (game.currentZone === 'dungeon') return null;
          let best = null;
          let bestD = range;
          for (const marker of allEntranceMarkers(game)) {
            const dungeon = dungeonDef(game, marker.dungeonId);
            if (!dungeon) continue;
            const d = distanceToPlayer(game, marker);
            const allowed = Math.max(range, safeNumber(marker.interactionRange, range));
            if (d <= allowed && d < bestD) {
              best = marker;
              bestD = d;
            }
          }
          return best;
        },

        enterDungeon(marker, floor = 1) {
          const dungeon = dungeonDef(game, marker?.dungeonId);
          if (!dungeon) {
            game.log?.('Dungeon entrance has no valid dungeon draft assigned.');
            return false;
          }
          const minLevel = Math.max(1, Math.floor(safeNumber(dungeon.minLevel, 1)));
          if (game.player && game.player.level < minLevel) {
            game.log?.(`${dungeon.name || dungeon.id} requires level ${minLevel}.`);
            this.showToast(dungeon.name || 'Dungeon Locked', `Required level: ${minLevel}. Current level: ${game.player.level}.`);
            return false;
          }
          const fromZone = game.currentZone;
          const fromZoneKey = currentZoneKey(game);
          const returnX = game.player?.x ?? (safeNumber(marker.x) + 0.5);
          const returnY = game.player?.y ?? (safeNumber(marker.y) + 0.5);
          this.loadDungeonFloor({ dungeon, marker, floor, fromZone, fromZoneKey, returnX, returnY, freshRun: true });
          return true;
        },

        getRespawnCheckpoint(actor = game.player) {
          const active = this.state.active || game.activeDungeon;
          const dungeonId = String(active?.dungeonId || active?.id || '');
          const deathDungeonId = String(actor?.deathDungeonId || dungeonId);
          if (game.currentZone !== 'dungeon' || dungeonId !== SILK_WEB_CAVERN_ID || deathDungeonId !== SILK_WEB_CAVERN_ID) return null;
          const floor = Math.max(1, Math.floor(safeNumber(active?.floor || game.activeDungeon?.floor, 1)));
          const entrance = game.dungeonRooms?.[0] || game.dungeonNavigation?.rooms?.[0];
          if (!entrance) return null;
          const desiredX = safeNumber(entrance.x, 0) + 0.5;
          const desiredY = safeNumber(entrance.y, 0) + 3.5;
          const preferred = game.dungeonEntranceStaging?.floor === floor ? game.dungeonEntranceStaging.checkpoint : null;
          const preferredSafe = preferred && isValidDungeonActorTile(game, preferred.x, preferred.y, { ignoreActor: actor, allowReserved: true, minActorSpacing: 1.5 });
          const position = preferredSafe ? { x: preferred.x, y: preferred.y } : findDungeonActorPlacement(game, desiredX, desiredY, 14, { ignoreActor: actor, minActorSpacing: 1.5 });
          if (!position) {
            console.warn(`[Dream Realms] No safe Silk Web Cavern respawn tile found on floor ${floor}.`);
            return null;
          }
          return {
            ...position,
            zone: 'dungeon',
            zoneId: SILK_WEB_CAVERN_ID,
            dungeonId: SILK_WEB_CAVERN_ID,
            floor,
            floorId: `floor${floor}`,
            facing: 'south'
          };
        },

        isValidActorPlacement(x, y, options = {}) {
          if (game.currentZone !== 'dungeon' && !game.dungeonMap) return false;
          return isValidDungeonActorTile(game, x, y, options);
        },

        findActorPlacementNear(x, y, options = {}) {
          const position = findDungeonActorPlacement(game, x, y, options.radius || 10, options);
          if (!position && options.actorId) {
            this.placementWarnings = this.placementWarnings || new Set();
            const warningKey = `${game.activeDungeon?.id || 'dungeon'}:${game.activeDungeon?.floor || 1}:${options.actorId}`;
            if (!this.placementWarnings.has(warningKey)) {
              this.placementWarnings.add(warningKey);
              console.warn(`[Dream Realms] No valid dungeon placement for ${options.actorId} near ${Number(x).toFixed(1)},${Number(y).toFixed(1)}.`);
            }
          }
          return position;
        },

        reserveActorPlacement(position) {
          if (!position) return false;
          if (!(game.dungeonReservedActorTiles instanceof Set)) game.dungeonReservedActorTiles = new Set();
          game.dungeonReservedActorTiles.add(dungeonTileKey(position.x, position.y));
          return true;
        },

        validateActiveDungeonActors() {
          if (game.currentZone !== 'dungeon') return { checked: 0, moved: 0, invalid: [] };
          const actors = (game.dungeonEnemies || []).filter(Boolean);
          let moved = 0;
          const invalid = [];
          for (const actor of actors) {
            if (this.isValidActorPlacement(actor.x, actor.y, { ignoreActor: actor, avoidActors: false })) continue;
            invalid.push(actor.id || actor.name || 'enemy');
            const replacement = this.findActorPlacementNear(actor.homeX ?? actor.x, actor.homeY ?? actor.y, { radius: 14, actorId: actor.id || actor.name, ignoreActor: actor, minActorSpacing: 1.4 });
            if (!replacement) continue;
            actor.x = replacement.x;
            actor.y = replacement.y;
            actor.homeX = replacement.x;
            actor.homeY = replacement.y;
            actor.lastStableX = replacement.x;
            actor.lastStableY = replacement.y;
            moved += 1;
          }
          return { checked: actors.length, moved, invalid };
        },

        loadDungeonFloor({ dungeon, marker, floor, fromZone, fromZoneKey, returnX, returnY, freshRun = false }) {
          const floorCount = Math.max(1, Math.floor(safeNumber(dungeon.floors, 1)));
          const targetFloor = clamp(Math.floor(safeNumber(floor, 1)), 1, floorCount);
          const floorData = generateDungeonFloor(game, dungeon, targetFloor);
          game.currentZone = 'dungeon';
          game.activeDungeon = { id: dungeon.id, name: dungeon.name || dungeon.id, floor: targetFloor, floors: floorCount };
          // V0.18.60: big title card on entering / descending the Silk Web Cavern (fades after ~2s).
          if (dungeon.id === 'silk_web_cavern') game.dungeonTitleCard = { text: 'Silk Web Caverns', at: performance.now() };
          if (freshRun && game.performanceSettings?.().dpsMeterResetOnDungeonReset !== false) game.resetDpsMeter?.('dungeon reset');
          game.dungeonMap = floorData.map;
          game.dungeonObjects = floorData.objects;
          game.dungeonEnemies = floorData.enemies;
          game.dungeonRooms = floorData.rooms;
          game.dungeonReachableTiles = buildDungeonReachableTiles(floorData.map, floorData.objects, floorData.entrance.x + 0.5, floorData.entrance.y + 3.5);
          this.recordFloorStats?.(dungeon, targetFloor, floorData);
          game.dungeonFloorMeta = floorData.floorMeta || null;
          game.dungeonLayoutLinks = floorData.layoutLinks || [];
          game.dungeonLayoutReadabilityReport = floorData.readabilityReport || null;
          game.dungeonNavigation = buildDungeonNavigationSnapshot(game, dungeon, targetFloor, floorData);
          game.map = game.dungeonMap;
          game.objects = game.dungeonObjects;
          game.setActiveEnemySet?.(game.dungeonEnemies);
          game.dungeonReservedActorTiles = new Set();
          const entranceTarget = { x: floorData.entrance.x + 0.5, y: floorData.entrance.y + 3.5 };
          const playerPosition = this.findActorPlacementNear(entranceTarget.x, entranceTarget.y, { radius: 10, actorId: 'player', ignoreActor: game.player, minActorSpacing: 1.2 }) || entranceTarget;
          if (game.player) { game.player.x = playerPosition.x; game.player.y = playerPosition.y; }
          game.dungeonEntranceStaging = {
            dungeonId: dungeon.id,
            floor: targetFloor,
            checkpoint: { ...playerPosition },
            partySpawnOffsets: cloneJson(dungeon.partySpawnOffsets || []),
            spiritHealer: null,
            questGivers: []
          };
          this.reserveActorPlacement(playerPosition);
          game.npcSystem?.placeDungeonEntranceNpcs?.(dungeon.id, targetFloor, floorData.entrance, playerPosition);
          game.syncPartyCompanionsToPlayerZone?.({ zone: 'dungeon', snap: true, reason: 'dungeon-floor-load' })
            ?? game.syncPartyBotsToPlayerZone?.({ zone: 'dungeon', snap: true, reason: 'dungeon-floor-load' });
          this.validateActiveDungeonActors();
          if (typeof game.buildStaticMinimap === 'function') game.staticMinimap = game.buildStaticMinimap();
          game.mapDirty = true;
          const entranceKey = marker ? markerKey(fromZoneKey || currentZoneKey(game), marker) : this.state.lastEntranceKey;
          if (freshRun || !this.state.active) {
            const startedAt = nowMs();
            this.state.active = {
              dungeonId: dungeon.id,
              dungeonName: dungeon.name || dungeon.id,
              floor: targetFloor,
              floors: floorCount,
              fromZone,
              fromZoneKey,
              returnX,
              returnY,
              entranceKey,
              startedAt,
              runId: `${dungeon.id}:${startedAt}`,
              layoutVersion: dungeon.id === 'silk_web_cavern' ? 'v0.13.46-structured-encounters' : null,
              directDungeonEntrance: Boolean(marker?.directDungeon),
              bossesDefeated: {},
              lootedNodes: {},
              openedGates: {},
              interactedObjects: {}
            };
          } else {
            this.state.active.floor = targetFloor;
            this.state.active.floors = floorCount;
          }
          this.state.lastDungeonId = dungeon.id;
          this.state.lastEntranceKey = entranceKey || this.state.lastEntranceKey;
          this.state.visitedFloors[`${dungeon.id}:${targetFloor}`] = nowMs();
          this.saveState();
          // Phase 21: seed the Silk Web Cavern-only herbs into this floor's dungeon
          // resource grid (read by the dungeon-aware gathering zoneKey). Idempotent.
          game.ensureSilkWebCavernHerbs?.(dungeon, targetFloor);
          game.puzzleSystem?.applyCurrentZonePuzzleState?.();
          this.showToast(dungeon.name || dungeon.id, `Floor ${targetFloor}/${floorCount} loaded · ${game.dungeonEnemies.length} enemies.`);
          game.log?.(`Entered ${dungeon.name || dungeon.id} · Floor ${targetFloor}/${floorCount}.`);
          game.notifyExternalSystems?.('zone-entered', { zoneId: dungeon.id, zoneName: dungeon.name || dungeon.id, dungeonId: dungeon.id, floor: targetFloor });
          game.notifyExternalSystems?.('dungeon-entered', { dungeonId: dungeon.id, dungeon, floor: targetFloor, floors: floorCount });
          this.refreshPanel();
          return true;
        },



        recordFloorStats(dungeon, floor, floorData) {
          if (!dungeon || !this.state) return;
          const enemies = Array.isArray(floorData?.enemies) ? floorData.enemies : [];
          const stats = {
            dungeonId: dungeon.id,
            floor,
            floorName: floorData?.floorMeta?.name || `Floor ${floor}`,
            enemies: enemies.length,
            elites: enemies.filter(e => e?.dungeonElite).length,
            miniBosses: enemies.filter(e => e?.dungeonMiniBoss).length,
            bosses: enemies.filter(e => e?.dungeonBoss).length,
            nonSpiderCombat: enemies.filter(e => !(e?.spiderFamily || e?.silkWebCavern)).length,
            blockedSpawns: enemies.filter(e => {
              const tx = Math.floor(e.x), ty = Math.floor(e.y);
              return Boolean(game.dungeonMap?.[ty]?.[tx]?.blocked);
            }).length,
            recordedAt: nowMs()
          };
          this.state.floorStats[`${dungeon.id}:floor${floor}`] = stats;
        },

        auditSilkWebCavernProgression() {
          const dungeon = dungeonDef(game, 'silk_web_cavern');
          const bossIds = ['boss_broodwarden_skirr','boss_matron_velyra','boss_queen_arakhzel'];
          const miniBossIds = [
            'miniboss_threadjaw_alpha','miniboss_old_venomsac','miniboss_cocoon_tender','miniboss_pale_spinner_yssra','miniboss_hollowfang_broodsire',
            'miniboss_chitinmaw','miniboss_widow_of_the_loom','miniboss_venom_eye_oracle','miniboss_egg_heart'
          ];
          const lootIds = ['loot_silk_web_cavern_elites','loot_silk_web_cavern_minibosses','loot_boss_broodwarden_skirr','loot_boss_matron_velyra','loot_boss_queen_arakhzel','loot_silk_web_cavern_final'];
          return {
            dungeonId: dungeon?.id || null,
            floors: dungeon?.floors || 0,
            bossIdsPresent: bossIds.filter(id => DR.BOSS_BY_ID?.[id] || DR.ENEMY_DRAFT_BY_ID?.[id] || DR.MOB_DRAFT_BY_ID?.[id]).length,
            miniBossIdsPresent: miniBossIds.filter(id => DR.BOSS_BY_ID?.[id] || DR.ENEMY_DRAFT_BY_ID?.[id] || DR.MOB_DRAFT_BY_ID?.[id]).length,
            lootTablesPresent: lootIds.filter(id => game.getLootTableById?.(id, null) || DR.LOOT_TABLE_BY_ID?.[id]).length,
            stateTracksGates: Boolean(this.state?.openedGates),
            stateTracksObjects: Boolean(this.state?.interactedObjects),
            ok: Boolean(dungeon && dungeon.floors === 3)
          };
        },

        auditActiveDungeonFloor() {
          if (game.currentZone !== 'dungeon') return null;
          const enemies = game.dungeonEnemies || [];
          const objects = game.objects || [];
          let blockingTransitionObjects = 0;
          for (let y = 0; y < objects.length; y++) {
            for (let x = 0; x < (objects[y]?.length || 0); x++) {
              const obj = objects[y][x];
              if (!obj || !['dungeonExit','dungeonStairs','dungeonTreasure'].includes(obj.type)) continue;
              if (game.map?.[y]?.[x]?.blocked) blockingTransitionObjects++;
            }
          }
          return {
            dungeonId: this.state.active?.dungeonId || game.activeDungeon?.id || null,
            floor: this.state.active?.floor || game.activeDungeon?.floor || 1,
            enemies: enemies.length,
            living: enemies.filter(e => e?.alive).length,
            bosses: enemies.filter(e => e?.dungeonBoss).length,
            miniBosses: enemies.filter(e => e?.dungeonMiniBoss).length,
            nonSpiderCombat: enemies.filter(e => !(e?.spiderFamily || e?.silkWebCavern)).length,
            blockedSpawns: enemies.filter(e => game.map?.[Math.floor(e.y)]?.[Math.floor(e.x)]?.blocked).length,
            blockingTransitionObjects
          };
        },


        auditSilkWebCombatBalance() {
          const dungeon = dungeonDef(game, 'silk_web_cavern');
          const out = { dungeonId: dungeon?.id || null, floors: {}, ok: Boolean(dungeon) };
          for (let floor = 1; floor <= 3; floor++) {
            const cfg = SILK_WEB_FLOOR_CONFIG[floor];
            const tuning = silkTuning('elite', floor);
            const bossTuning = silkTuning('boss', floor);
            out.floors[floor] = {
              floorName: cfg?.name || `Floor ${floor}`,
              eliteTarget: cfg?.eliteTarget || 0,
              eliteHpMultiplier: tuning.hp,
              eliteAttackMultiplier: tuning.attack,
              bossCooldownBias: bossTuning.cooldownBias,
              hazardScale: tuning.hazardScale,
              targetLevelRange: [cfg?.levelMin || 1, cfg?.levelMax || 1],
              ok: Boolean(cfg && tuning.hp >= 1.8 && tuning.attack <= 1.35 && bossTuning.cooldownBias >= 1.0)
            };
          }
          out.ok = out.ok && Object.values(out.floors).every(row => row.ok);
          return out;
        },

        auditSilkWebPathingQA() {
          if (game.currentZone !== 'dungeon' || this.state.active?.dungeonId !== 'silk_web_cavern') return null;
          const enemies = game.dungeonEnemies || [];
          const companions = [game.merc, game.pet, ...(game.botPlayers || [])].filter(Boolean);
          const hazardTiles = [];
          for (let y = 0; y < (game.objects || []).length; y++) {
            for (let x = 0; x < (game.objects[y]?.length || 0); x++) {
              const obj = game.objects[y][x];
              if (obj && ['webHazard','venomSack','venomEgg','bossCocoonPrison'].includes(obj.type)) hazardTiles.push({ x, y, type: obj.type });
            }
          }
          return {
            dungeonId: 'silk_web_cavern',
            floor: this.state.active?.floor || 1,
            companions: companions.length,
            companionPaths: companions.filter(actor => Array.isArray(actor._companionPathRoute)).length,
            blockedEnemies: enemies.filter(e => game.map?.[Math.floor(e.y)]?.[Math.floor(e.x)]?.blocked).length,
            activeHazards: hazardTiles.length,
            companionsInsideHardBlock: companions.filter(actor => !game.isCompanionWalkableTile?.(Math.floor(actor.x), Math.floor(actor.y), actor)).length,
            ok: enemies.every(e => !game.map?.[Math.floor(e.y)]?.[Math.floor(e.x)]?.blocked)
          };
        },

        activateDungeonSpecialObject(node) {
          if (!this.state.active || !node) return false;
          const key = silkObjectKey(this.state, node);
          const liveNode = game.objects?.[node.y]?.[node.x];
          if (node.type === 'bossCocoonPrison') {
            return this.damageDungeonObject(node, Math.max(12, Math.floor((game.player?.getStat?.('attack') || game.player?.attack || 12) * 1.2)), game.player);
          }
          if (node.type === 'webAnchor') {
            if (this.state.interactedObjects[key]) {
              game.log?.(`${node.name || 'Web Anchor'} is already cut.`);
              return true;
            }
            this.state.interactedObjects[key] = { type: 'webAnchor', floor: node.floor, at: nowMs() };
            if (liveNode) { liveNode.opened = true; liveNode.severed = true; liveNode.type = 'webHazard'; liveNode.name = 'Severed Web Anchor'; liveNode.color = '#816199'; }
            game.spawnRing?.(node.x + 0.5, node.y + 0.5, '#d68cff', 18);
            game.log?.(`Cut ${node.name || 'Web Anchor'}.`);
            game.notifyExternalSystems?.('dungeon-object-interacted', { objectId: node.objectId || node.id, type: 'webAnchor', dungeonId: node.dungeonId, floor: node.floor });
            this.saveState();
            return true;
          }
          if (node.type === 'silkCocoon') {
            if (this.state.interactedObjects[key]) {
              game.log?.(`${node.name || 'Cocoon'} is already opened.`);
              return true;
            }
            this.state.interactedObjects[key] = { type: 'silkCocoon', cocoonType: node.cocoonType, floor: node.floor, at: nowMs() };
            if (liveNode) { liveNode.opened = true; liveNode.name = `Opened ${node.name || 'Cocoon'}`; liveNode.color = '#9f8cb5'; }
            if (node.cocoonType === 'survivor') game.questSystem?.advanceObjective?.('interact', { id: 'survivor_cocoon', name: 'survivor cocoon', zoneId: 'silk_web_cavern' }, 1);
            game.spawnRing?.(node.x + 0.5, node.y + 0.5, node.cocoonType === 'poison' ? '#83d873' : '#d8c8f2', 16);
            game.log?.(`Opened ${node.name || 'Cocoon'}.`);
            game.notifyExternalSystems?.('dungeon-object-interacted', { objectId: node.objectId || node.id, type: 'silkCocoon', cocoonType: node.cocoonType, dungeonId: node.dungeonId, floor: node.floor });
            this.saveState();
            return true;
          }
          if (node.type === 'silkQuestObjective') {
            if (this.state.interactedObjects[key]) {
              game.log?.(`${node.name || 'Dungeon objective'} is already cleared.`);
              return true;
            }
            if (node.itemId) {
              const granted = game.grantEditorItem?.(node.itemId, 1, { sourceLevel: game.player?.level || 1, rarityKey: 'green' });
              if (!granted?.ok) {
                game.log?.(`Bags are full. Make room before gathering ${node.name || 'this objective'}.`);
                return true;
              }
            } else {
              game.questSystem?.advanceObjective?.('interact', {
                id: node.objectiveTarget || node.objectiveKind,
                name: node.objectiveTarget || node.objectiveKind,
                zoneId: SILK_WEB_CAVERN_ID
              }, 1);
            }
            this.state.interactedObjects[key] = { type: node.type, objectiveKind: node.objectiveKind, floor: node.floor, at: nowMs() };
            if (liveNode) {
              liveNode.opened = true;
              liveNode.name = node.objectiveKind === 'venom_nest' ? 'Destroyed Venom Nest' : `Gathered ${node.name || 'Objective'}`;
              liveNode.color = '#71657d';
            }
            game.spawnRing?.(node.x + 0.5, node.y + 0.5, node.color || '#d8c8f2', 18);
            game.log?.(`${node.objectiveKind === 'venom_nest' ? 'Destroyed' : 'Gathered'} ${node.name || 'dungeon objective'}.`);
            game.notifyExternalSystems?.('dungeon-object-interacted', { objectId: node.objectId || node.id, type: node.type, objectiveKind: node.objectiveKind, dungeonId: node.dungeonId, floor: node.floor });
            this.saveState();
            return true;
          }
          if (node.type === 'webGate') {
            const gate = gateKey(this.state, node);
            if (this.state.openedGates[gate]) {
              game.log?.(`${node.name || 'Web Gate'} is already open.`);
              return true;
            }
            const prefix = `${currentRunId(this.state)}:object:${node.dungeonId}:floor${node.floor}:anchor:`;
            const cutCount = Object.keys(this.state.interactedObjects || {}).filter(k => k.startsWith(prefix)).length;
            const required = Math.max(1, Math.floor(safeNumber(node.requiredAnchors, 3)));
            if (cutCount < required) {
              game.log?.(`${node.name || 'Web Gate'} is sealed. Cut ${required - cutCount} more web anchor${required - cutCount === 1 ? '' : 's'}.`);
              this.showToast('Web gate sealed', `${cutCount}/${required} web anchors cut.`);
              return true;
            }
            if (String(node.dungeonId || this.state.active?.dungeonId || '') === SILK_WEB_CAVERN_ID && !silkGateMiniBossesDefeated(this.state, node.floor || this.state.active?.floor || 1)) {
              const missingLabel = silkGateMissingMiniBossLabel(this.state, node.floor || this.state.active?.floor || 1);
              game.log?.(`${node.name || 'Web Gate'} is bound by ${missingLabel}.`);
              this.showToast('Web gate sealed', `Defeat ${missingLabel} before opening this gate.`);
              return true;
            }
            this.state.openedGates[gate] = { floor: node.floor, openedAt: nowMs() };
            if (liveNode) { liveNode.opened = true; liveNode.sealed = false; liveNode.type = 'webHazard'; liveNode.name = 'Opened Web Gate'; liveNode.color = '#d8c8f2'; }
            if (game.map?.[node.y]?.[node.x]) game.map[node.y][node.x].blocked = false;
            game.spawnRing?.(node.x + 0.5, node.y + 0.5, '#f0c6ff', 24);
            game.log?.(`Opened ${node.name || 'Web Gate'}.`);
            this.saveState();
            return true;
          }
          return false;
        },

        activateDungeonTravelNode(node) {
          if (!this.state.active) return false;
          const dungeon = dungeonDef(game, this.state.active.dungeonId);
          if (!dungeon) return false;
          if (node.type === 'dungeonExit') return this.exitDungeon();
          if (node.type === 'dungeonStairs') {
            if (this.floorBossesAlive()) {
              game.log?.('A boss still holds this floor. Defeat it before descending.');
              this.showToast('Boss gate sealed', 'Defeat the floor boss before using the stairs.');
              return true;
            }
            const nextFloor = clamp(Math.floor(safeNumber(node.nextFloor, this.state.active.floor + 1)), 1, Math.max(1, Math.floor(safeNumber(dungeon.floors, 1))));
            this.loadDungeonFloor({
              dungeon,
              marker: null,
              floor: nextFloor,
              fromZone: this.state.active.fromZone,
              fromZoneKey: this.state.active.fromZoneKey,
              returnX: this.state.active.returnX,
              returnY: this.state.active.returnY,
              freshRun: false
            });
            return true;
          }
          if (node.type === 'dungeonTreasure') {
            if (node.requiresBossDefeat !== false && this.floorBossesAlive()) {
              game.log?.('The dungeon reward is sealed until the boss is defeated.');
              this.showToast('Reward sealed', 'Defeat the floor boss to unlock the treasure.');
              return true;
            }
            const key = treasureNodeKey(this.state, node);
            if (this.state.lootedNodes[key] || this.state.active?.lootedNodes?.[key]) {
              game.log?.(`${node.name || 'Dungeon reward'} is already claimed for this run.`);
              return true;
            }
            const tableId = node.lootTableId || (dungeon.id === 'silk_web_cavern' ? 'loot_silk_web_cavern_final' : dungeon.rewardLootTableId) || dungeon.lootTableId || 'loot_dungeon_chest';
            const result = game.rollEditorLootTable?.(tableId, { level: game.player?.level || dungeon.maxLevel || 1, name: node.name, kind: 'dungeonTreasure', dungeonId: dungeon.id, floor: this.state.active.floor }, { grant: true, fallbackTableId: dungeon.id === 'silk_web_cavern' ? 'loot_silk_web_cavern_treasure' : 'loot_dungeon_chest' });
            const runKey = currentRunId(this.state);
            if (!node.optionalTreasure) this.state.completedRuns[runKey] = { dungeonId: dungeon.id, completedAt: nowMs(), floor: this.state.active.floor, lootTableId: tableId, loot: result };
            this.state.lootedNodes[key] = { dungeonId: dungeon.id, floor: this.state.active.floor, lootedAt: nowMs(), lootTableId: tableId };
            if (this.state.active) {
              this.state.active.lootedNodes = this.state.active.lootedNodes || {};
              this.state.active.lootedNodes[key] = true;
            }
            const liveNode = game.objects?.[node.y]?.[node.x];
            if (liveNode) liveNode.opened = true;
            this.saveState();
            game.log?.(`Opened ${node.name || 'dungeon reward'}: ${result?.summary || 'nothing'}.`);
            game.spawnRing?.(node.x + 0.5, node.y + 0.5, '#d8ad57', 18);
            if (!node.optionalTreasure) game.notifyExternalSystems?.('dungeon-completed', { dungeonId: dungeon.id, dungeon, floor: this.state.active.floor, result });
            return true;
          }
          return false;
        },

        floorBossesAlive() {
          if (game.currentZone !== 'dungeon') return false;
          return (game.dungeonEnemies || []).some(enemy => enemy && enemy.alive && enemy.dungeonBoss);
        },

        livingFloorBoss() {
          if (game.currentZone !== 'dungeon') return null;
          return (game.dungeonEnemies || []).find(enemy => enemy && enemy.alive && enemy.dungeonBoss) || null;
        },

        updateBossAbilities(dt) {
          if (game.currentZone !== 'dungeon') return;
          updateSilkBossStrikes(game); // V0.18.42: land any telegraphed strikes whose delay elapsed
          for (const boss of game.dungeonEnemies || []) {
            if (!boss || !boss.alive || !(boss.dungeonBoss || boss.dungeonMiniBoss)) continue;
            if (!silkWebBossEncounterEngaged(game, boss)) {
              boss.bossAbilityTimer = Math.max(safeNumber(boss.bossAbilityTimer, 3), boss.dungeonMiniBoss ? 2.4 : 2.8);
              continue;
            }
            boss.bossAbilityTimer = safeNumber(boss.bossAbilityTimer, 3) - dt;
            const hpPct = boss.maxHp > 0 ? boss.hp / boss.maxHp : 1;
            const phase = hpPct <= 0.33 ? 3 : hpPct <= 0.66 ? 2 : 1;
            if (phase !== boss.bossPhase) {
              boss.bossPhase = phase;
              game.spawnRing?.(boss.x, boss.y, phase === 3 ? '#ff6f6f' : '#d8ad57', 22 + phase * 3);
              game.log?.(`${boss.name} enters phase ${phase}.`);
            }
            if (boss.bossAbilityTimer > 0) continue;
            this.castBossAbility(boss);
          }
        },


        updateBossSeal(dt) {
          if (game.currentZone !== 'dungeon' || this.state.active?.dungeonId !== 'silk_web_cavern') { this.bossSeal = null; return; }
          const floor = Math.max(1, Math.floor(safeNumber(this.state.active?.floor, 1)));
          if (!this.bossSeal) {
            if (floor !== 1) return; // V0.18.42: floor-1 boss room seal (per the request)
            const boss = (game.dungeonEnemies || []).find(e => e && e.alive && e.dungeonBoss && !e._bossSealDone && silkWebBossEncounterEngaged(game, e));
            if (!boss) return;
            // V0.18.45: wait until the player is FULLY inside the arena before sealing.
            if (!playerFullyInsideSilkBossArena(game, boss)) return;
            this.bossSeal = startSilkBossRoomSeal(game, floor, boss);
            if (this.bossSeal) boss._bossSealDone = true;
            return;
          }
          const seal = this.bossSeal;
          // boss killed OR the floor regenerated out from under us -> tear the seal down.
          if (!seal.boss || seal.boss.alive === false || !(game.dungeonEnemies || []).includes(seal.boss)) {
            unsealSilkBossRoom(game, seal);
            this.bossSeal = null;
            return;
          }
          seal.t += dt;
          if (seal.phase === 'walk') {
            const p = silkSmoothStep(seal.t / seal.walkDuration);
            for (const c of seal.crawlers) {
              c.x = c.startX + (c.targetX - c.startX) * p;
              c.y = c.startY + (c.targetY - c.startY) * p;
              c.dir = Math.atan2(c.targetY - c.startY, c.targetX - c.startX);
              spawnSilkEffect(game, 'silkSealCrawler', c.x, c.y, { life: 0.12, dir: c.dir, seed: c.seed });
            }
            if (seal.t >= seal.walkDuration) {
              placeSilkSealBarrier(game, seal);
              seal.phase = 'web';
              seal.t = 0;
              game.log?.('The spiders spin the entrance shut - kill the broodwarden to break free!');
            }
          } else if (seal.phase === 'web') {
            const p = Math.min(1, seal.t / 1.4);
            for (const c of seal.crawlers) {
              c.x = c.targetX + Math.cos(c.exitDir) * p * 7;
              c.y = c.targetY + Math.sin(c.exitDir) * p * 7;
              if (p < 0.92) spawnSilkEffect(game, 'silkSealCrawler', c.x, c.y, { life: 0.12, dir: c.exitDir, seed: c.seed });
            }
            if (seal.t >= 1.4) seal.phase = 'sealed';
          }
        },

        // V0.18.49: wander the decorative floor spiders and squish any a friendly actor steps
        // on. Purely cosmetic - they never fight. Cleared when we leave the silk cavern.
        updateSilkCritters(dt) {
          if (game.currentZone !== 'dungeon' || this.state.active?.dungeonId !== 'silk_web_cavern') {
            if (game.silkCritters?.length) game.silkCritters = [];
            return;
          }
          const critters = game.silkCritters;
          if (!Array.isArray(critters) || !critters.length) return;
          const map = game.dungeonMap || game.map;
          const TILE = DR.TILE || {};
          const walkable = (wx, wy) => { const t = map?.[Math.floor(wy)]?.[Math.floor(wx)]; return !!(t && !t.blocked && t.type === TILE.CAVE_FLOOR); };
          const steppers = [game.player, game.merc, game.pet, ...(game.botPlayers || [])].filter(a => a && a.alive !== false && Number.isFinite(a.x) && Number.isFinite(a.y));
          const now = nowMs();
          const speed = 0.5; // V0.18.55: slower - they were scurrying too fast on the floor
          let anyExpired = false;
          for (const c of critters) {
            if (c.dead) { if (now - (c.deadAt || 0) > 420) anyExpired = true; continue; }
            let squished = false;
            for (const a of steppers) { if (Math.hypot(a.x - c.x, a.y - c.y) < 0.42) { squished = true; break; } }
            if (squished) { c.dead = true; c.deadAt = now; continue; }
            c.wander -= dt;
            if (c.wander <= 0) { c.wander = 0.4 + Math.random() * 1.2; c.dir += (Math.random() - 0.5) * 2.2; c.moving = Math.random() < 0.72; }
            if (c.moving) {
              const nx = c.x + Math.cos(c.dir) * speed * dt, ny = c.y + Math.sin(c.dir) * speed * dt;
              // V0.18.54: advance the leg-gait phase only while actually moving, so the legs step
              // as it crawls (and hold still when idle) instead of the body sliding.
              if (walkable(nx, ny)) { c.vx = Math.cos(c.dir); c.vy = Math.sin(c.dir); c.x = nx; c.y = ny; c.walk = (c.walk || 0) + speed * dt * 16; }
              else { c.dir += Math.PI * 0.55 + Math.random() * 0.8; c.vx = 0; c.vy = 0; }
            } else { c.vx = 0; c.vy = 0; }
          }
          if (anyExpired) game.silkCritters = critters.filter(c => !(c.dead && now - (c.deadAt || 0) > 420));
        },

        castSilkWebBossAbility(boss, ability) {
          if (!silkWebBossEncounterEngaged(game, boss)) {
            boss.bossAbilityTimer = Math.max(safeNumber(boss.bossAbilityTimer, boss.dungeonMiniBoss ? 2.4 : 2.8), boss.dungeonMiniBoss ? 2.4 : 2.8);
            return;
          }
          const floor = Math.max(1, Math.floor(safeNumber(boss.dungeonFloor || this.state.active?.floor, 1)));
          const tuning = silkTuning(boss.dungeonMiniBoss ? 'miniboss' : 'boss', floor);
          const damageScale = safeNumber(ability.damageScale, 1);
          const radius = Math.max(1, safeNumber(ability.radius, 4.5));
          const candidates = silkWebFriendlyCombatCandidates(game);
          const targets = candidates
            .filter(target => Math.hypot(target.x - boss.x, target.y - boss.y) <= radius + 0.75)
            .sort((a, b) => Math.hypot(a.x - boss.x, a.y - boss.y) - Math.hypot(b.x - boss.x, b.y - boss.y));
          const primary = targets[0] || null;
          const kind = String(ability.kind || '').toLowerCase();
          const abilityName = ability.name || 'a web ability';
          const canCastWithoutTarget = ['summon_adds', 'phase_adds', 'shield', 'boss_heal', 'retreat', 'frenzy'].includes(kind);

          if ((!primary || primary.alive === false) && !canCastWithoutTarget) {
            boss.bossAbilityTimer = Math.max(1.4, safeNumber(ability.cooldown, 5.5) * 0.35);
            return;
          }

          const activeAdds = (game.dungeonEnemies || []).filter(enemy => enemy && enemy.alive && enemy.silkWebBossAdd && enemy.ownerBossId === boss.bossId).length;
          if (['summon_adds', 'phase_adds'].includes(kind)) {
            const room = { x: boss.x, y: boss.y, w: 12, h: 12, kind: 'boss_adds' };
            const count = Math.max(1, Math.floor(safeNumber(ability.summonCount, 2)));
            const allowed = Math.max(0, SILK_WEB_COMBAT_TUNING.maxActiveBossAdds - activeAdds);
            for (let i = 0; i < Math.min(count, allowed); i++) {
              const add = createSilkDungeonEnemy(game, floor >= 3 ? 'Loom Spinner Elite' : floor >= 2 ? 'Brood Spinner Elite' : 'Webbed Cave Skitterer Elite', room, DR.DUNGEON_BY_ID?.silk_web_cavern || { id:'silk_web_cavern' }, floor, boss.level || 8, { hpMultiplier: 1.05, attackMultiplier: 0.92, lootRolls: 1 });
              if (add) {
                const spot = findWalkableNear(game.dungeonMap || game.map || [], game.dungeonObjects || game.objects || [], boss.x + randInt(-5, 5), boss.y + randInt(-5, 5), 8);
                if (!spot) continue;
                add.x = spot.x;
                add.y = spot.y;
                add.silkWebBossAdd = true;
                add.ownerBossId = boss.bossId;
                registerRuntimeSilkEnemy(game, add); // V0.18.45: also add to game.entities so it RENDERS
              }
            }
            game.spawnRing?.(boss.x, boss.y, '#d8c8f2', 28);
            game.log?.(`${boss.name} uses ${abilityName}.`);
          } else if (kind === 'cocoon_prison') {
            const cocoon = placeTemporaryDungeonObject(game, {
              type: 'bossCocoonPrison', id: `${boss.bossId}:cocoon:${Date.now()}`, name: 'Cocoon Prison', label: 'BREAK', color: '#d8c8f2', breakable: true,
              prisonerId: primary.id, prisonerName: primary.name, hp: Math.max(18, Math.floor((primary.maxHp || 100) * SILK_WEB_COMBAT_TUNING.bossCocoonHpPct)), expiresAt: nowMs() + SILK_WEB_COMBAT_TUNING.bossCocoonSeconds * 1000
            }, primary.x, primary.y, 5);
            if (cocoon) {
              primary.cocoonPrisonUntil = cocoon.expiresAt;
              game.applyStatusEffect?.(primary, silkStatusEffect('cocoon_prison', boss, SILK_WEB_COMBAT_TUNING.bossCocoonSeconds, { sourceName: boss.name }), boss);
              game.spawnRing?.(primary.x, primary.y, '#d8c8f2', 24);
            }
            game.log?.(`${boss.name} uses ${abilityName}. Break the cocoon.`);
          } else if (kind === 'shield' || kind === 'boss_heal') {
            const amount = kind === 'boss_heal' ? Math.floor(boss.maxHp * 0.045) : 0;
            if (amount > 0) boss.hp = Math.min(boss.maxHp, boss.hp + amount);
            boss.tempDamageReduction = Math.max(boss.tempDamageReduction || 0, kind === 'boss_heal' ? 0.18 : 0.25);
            game.spawnRing?.(boss.x, boss.y, '#d8c8f2', 26);
            game.log?.(`${boss.name} uses ${abilityName}.`);
          } else if (kind === 'retreat') {
            const arena = boss.bossArena || { x: boss.x, y: boss.y, w: 16, h: 12 };
            const spot = findWalkableNear(game.dungeonMap || game.map || [], game.dungeonObjects || game.objects || [], arena.x + randInt(-Math.floor(arena.w / 3), Math.floor(arena.w / 3)), arena.y + randInt(-Math.floor(arena.h / 3), Math.floor(arena.h / 3)), 10);
            if (spot) { boss.x = spot.x; boss.y = spot.y; }
            game.spawnRing?.(boss.x, boss.y, '#d68cff', 22);
            game.log?.(`${boss.name} uses ${abilityName}.`);
          } else if (kind === 'frenzy') {
            if ((boss.maxHp > 0 ? boss.hp / boss.maxHp : 1) <= 0.35 || boss.dungeonMiniBoss) {
              boss.speed = Math.min(2.65, safeNumber(boss.speed, 1.5) * 1.05);
              boss.attack = Math.floor(safeNumber(boss.attack, boss.getStat?.('attack') || 1) * 1.025);
              game.spawnRing?.(boss.x, boss.y, '#ff6f6f', 24);
              game.log?.(`${boss.name} enters ${abilityName}.`);
            }
          } else {
            // V0.18.42: telegraph the ground strike (red danger marker), then land it after
            // a short delay so it can be dodged, instead of applying damage instantly.
            const poison = kind.includes('poison') || kind === 'venom_rain';
            const color = poison ? '#8fe06a' : '#ff5a4f';
            const damage = Math.max(1, Math.floor(boss.getStat('attack') * damageScale * safeNumber(tuning.attack, 1)));
            const strikeX = safeNumber(primary?.x, boss.x);
            const strikeY = safeNumber(primary?.y, boss.y);
            const delay = Math.max(0.55, safeNumber(ability.telegraph, boss.dungeonMiniBoss ? 0.8 : 0.95));
            queueSilkBossStrike(game, {
              boss, x: strikeX, y: strikeY, radius, damage, color, kind,
              status: ability.status || (kind === 'silk_lines' ? 'webbed' : null),
              applyAt: nowMs() + delay * 1000
            });
            spawnSilkEffect(game, 'bossGroundTelegraph', strikeX, strikeY, { life: delay, color, radius, seed: Math.floor(boss.x * 7 + boss.y * 13 + nowMs() * 0.01) });
            game.log?.(`${boss.name} winds up ${abilityName} - move!`);
          }
          boss.bossAbilityTimer = Math.max(3.1, safeNumber(ability.cooldown, 5.5) * safeNumber(boss.bossCooldownBias ?? tuning.cooldownBias, 1) - Math.max(0, safeNumber(boss.bossPhase, 1) - 1) * 0.22);
        },

        castBossAbility(boss) {
          const abilities = Array.isArray(boss.bossDraft?.abilities) ? boss.bossDraft.abilities : [];
          const ability = abilities.length ? abilities[randInt(0, abilities.length - 1)] : { name: 'Boss Strike', kind: 'cleave', damageScale: 1.2, radius: 2.2, cooldown: 4.5 };
          if (boss.silkWebCavern || String(boss.bossId || '').startsWith('boss_broodwarden') || String(boss.bossId || '').startsWith('boss_matron') || String(boss.bossId || '').startsWith('boss_queen')) return this.castSilkWebBossAbility(boss, ability);
          const phaseScale = 1 + Math.max(0, safeNumber(boss.bossPhase, 1) - 1) * 0.18;
          const damage = Math.max(1, Math.floor(boss.getStat('attack') * safeNumber(ability.damageScale, 1) * phaseScale));
          const radius = Math.max(1, safeNumber(ability.radius, ability.kind === 'aoe' ? 4.2 : 2.2));
          const partyBots = (game.botPlayers || []).filter(bot => bot && bot.alive && game.isBotInParty?.(bot) && bot.zone === game.currentZone);
          const targets = [game.player, game.merc, game.pet, ...partyBots].filter(target => target && target.alive && Math.hypot(target.x - boss.x, target.y - boss.y) <= radius);
          if (!targets.length) {
            boss.bossAbilityTimer = Math.max(2.4, safeNumber(ability.cooldown, 4.5) * 0.75);
            return;
          }
          const color = ability.kind === 'aoe' ? '#a987ff' : '#e65d4f';
          game.spawnRing?.(boss.x, boss.y, color, Math.floor(radius * 6));
          for (const target of targets) game.damageEntity?.(target, damage, boss, color);
          game.log?.(`${boss.name} uses ${ability.name || 'a boss ability'}.`);
          boss.bossAbilityTimer = Math.max(2.2, safeNumber(ability.cooldown, 4.5) - Math.max(0, safeNumber(boss.bossPhase, 1) - 1) * 0.45);
        },

        exitDungeon() {
          const active = this.state.active;
          if (!active) return false;
          const toZone = active.fromZone === 'cave' ? 'cave' : 'overworld';
          game.currentZone = toZone;
          if (toZone === 'cave') {
            game.map = game.caveMap;
            game.objects = game.caveObjects;
            game.generateCaveEnemies?.();
            game.setActiveEnemySet?.(game.caveEnemies);
          } else {
            game.map = game.overworldMap;
            game.objects = game.overworldObjects;
            game.setActiveEnemySet?.(game.overworldEnemies);
          }
          if (game.player) {
            game.player.x = clamp(safeNumber(active.returnX, DR.CONFIG?.START_X || 100), 1, (DR.CONFIG?.MAP_SIZE || 200) - 2);
            game.player.y = clamp(safeNumber(active.returnY, DR.CONFIG?.START_Y || 100), 1, (DR.CONFIG?.MAP_SIZE || 200) - 2);
          }
          game.syncPartyCompanionsToPlayerZone?.({ zone: toZone, snap: true, reason: 'dungeon-exit' })
            ?? game.syncPartyBotsToPlayerZone?.({ zone: toZone, snap: true, reason: 'dungeon-exit' });
          game.activeDungeon = null;
          game.dungeonFloorMeta = null;
          game.dungeonEnemies = [];
          game.dungeonMap = null;
          game.dungeonObjects = null;
          game.dungeonRooms = [];
          game.dungeonNavigation = null;
          this.state.active = null;
          this.saveState();
          if (typeof game.buildStaticMinimap === 'function') game.staticMinimap = game.buildStaticMinimap();
          game.mapDirty = true;
          game.log?.(`Exited dungeon. Returned to ${toZone === 'cave' ? 'Mossfang Cave' : 'Dark Woods'}.`);
          game.notifyExternalSystems?.('zone-entered', { zoneId: toZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods', zoneName: toZone === 'cave' ? (game.currentCave?.name || 'Cave') : 'Dark Woods' });
          this.refreshPanel();
          return true;
        },


        updateSilkWebHazards(dt) {
          if (game.currentZone !== 'dungeon' || this.state.active?.dungeonId !== 'silk_web_cavern') return;
          removeSilkEnvironmentalPoisonFromFriendlyTargets(game);
          const player = game.player;
          if (player && player.alive !== false) {
            const px = Math.floor(player.x);
            const py = Math.floor(player.y);
            for (let y = py - 1; y <= py + 1; y++) {
              for (let x = px - 1; x <= px + 1; x++) {
                const obj = game.objects?.[y]?.[x];
                if (!obj || obj.triggered) continue;
                if (obj.type !== 'venomSack' && obj.type !== 'venomEgg' && obj.type !== 'spiderEgg' && obj.type !== 'webWrappedBody') continue;
                const triggerRadius = Math.max(0.45, safeNumber(obj.triggerRadius, 0.95));
                if (Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) > triggerRadius) continue;
                if (obj.type === 'spiderEgg') {
                  smashSpiderEgg(game, this.state, obj, x, y, this.state.active?.floor || obj.floor || 1);
                } else if (obj.type === 'webWrappedBody') {
                  breakWebWrappedBody(game, this.state, obj, x, y, this.state.active?.floor || obj.floor || 1);
                } else if (obj.type === 'venomEgg') {
                  game.applyStatusEffect?.(player, venomEggPoisonEffect(obj), obj);
                  markVenomEggBurst(game, this.state, obj, x, y);
                } else {
                  game.applyStatusEffect?.(player, venomSackPoisonEffect(obj), obj);
                  markVenomSackBurst(game, this.state, obj, x, y);
                }
                return;
              }
            }
          }
          // V0.18.38: ambient dread - spiders web down from the ceiling near the player.
          // V0.18.45: much rarer (was every 13-29s, felt spammy) so the drop stays an
          // impactful scare rather than a constant event.
          this.silkDropTick = safeNumber(this.silkDropTick, 45 + Math.random() * 30) - dt;
          if (this.silkDropTick <= 0) {
            this.silkDropTick = 60 + Math.random() * 75; // ~1-2.25 min between drops
            maybeDropCeilingSpider(game, this.state);
          }
          this.silkHazardTick = safeNumber(this.silkHazardTick, 0) - dt;
          if (this.silkHazardTick > 0) return;
          this.silkHazardTick = SILK_WEB_COMBAT_TUNING.hazardTickSeconds;
          const now = nowMs();
          const webTargets = silkWebTrapTargets(game);
          for (const target of webTargets) {
            const tx = Math.floor(target.x);
            const ty = Math.floor(target.y);
            for (let y = ty - 2; y <= ty + 2; y++) {
              for (let x = tx - 2; x <= tx + 2; x++) {
                const obj = game.objects?.[y]?.[x];
                if (!obj || obj.type !== 'webHazard' || obj.temporarySpiderWebTrap === true || obj.broken === true || obj.triggered === true) continue;
                const triggerRadius = Math.max(0.45, safeNumber(obj.triggerRadius, 1.65));
                if (Math.hypot(x + 0.5 - target.x, y + 0.5 - target.y) > triggerRadius) continue;
                if (!obj.triggeredAt) {
                  obj.triggeredAt = now;
                  obj.breakAt = now + Math.max(0.25, safeNumber(obj.breakAfterSeconds, SILK_WEB_TRAP_HOLD_SECONDS)) * 1000;
                  obj.holdSeconds = Math.max(0.25, safeNumber(obj.breakAfterSeconds, SILK_WEB_TRAP_HOLD_SECONDS));
                  obj.trapState = 'holding';
                  obj.trappedTargetIds = [];
                }
                if (now >= safeNumber(obj.breakAt, now)) {
                  breakSilkWebTrap(game, obj, 'timeout');
                  continue;
                }
                const statusId = silkGroundWebStatusId(obj);
                if (!obj.trappedTargetIds.includes(target.id || target.name || 'player')) obj.trappedTargetIds.push(target.id || target.name || 'player');
                if (!target._silkWebTrapIds) target._silkWebTrapIds = {};
                target._silkWebTrapIds[statusId] = true;
                const remainingSeconds = Math.max(0.05, (safeNumber(obj.breakAt, now) - now) / 1000);
                target.slowedUntil = Math.max(target.slowedUntil || 0, Math.min(safeNumber(obj.breakAt, now), now + 1600));
                game.applyStatusEffect?.(target, silkGroundWebRootEffect(obj, remainingSeconds), obj);
                target._forcePathRecalcAt = performance.now();
                break;
              }
            }
          }
        },

        updateSilkWebControlObjects(dt) {
          if (game.currentZone !== 'dungeon' || this.state.active?.dungeonId !== 'silk_web_cavern') return;
          const grid = game.objects || game.dungeonObjects || [];
          const now = nowMs();
          for (let y = 0; y < grid.length; y++) {
            const row = grid[y] || [];
            for (let x = 0; x < row.length; x++) {
              const obj = row[x];
              if (!obj) continue;
              if (obj.type === 'bossCocoonPrison') {
                if (Number(obj.hp || 0) <= 0) releaseCocoonedTarget(game, obj, 'broken');
                else if (Number(obj.expiresAt || 0) > 0 && now >= Number(obj.expiresAt)) releaseCocoonedTarget(game, obj, 'expired');
              }
              if (obj.type === 'webHazard' && obj.temporarySpiderWebTrap !== true) {
                if (!obj.vanishAt) obj.vanishAt = now + 30000; // V0.18.61: spider webs vanish ~30s after they appear
                if (obj.broken !== true && Number(obj.breakAt || 0) > 0 && now >= Number(obj.breakAt)) breakSilkWebTrap(game, obj, 'timeout');
                else if (obj.broken !== true && now >= obj.vanishAt) { row[x] = null; game.mapDirty = true; }
              }
            }
          }
        },

        damageDungeonObject(obj, amount = 1, source = null) {
          if (!obj) return false;
          if (obj.type === 'webHazard') {
            if (obj.broken === true) return false;
            obj.hp = Math.max(0, Number(obj.hp ?? obj.maxHp ?? 1) - Math.max(1, Math.floor(safeNumber(amount, 1))));
            game.spawnRing?.((obj.x || 0) + 0.5, (obj.y || 0) + 0.5, '#d8c8f2', 12);
            if (obj.hp <= 0) breakSilkWebTrap(game, obj, 'damage');
            return true;
          }
          if (obj.type !== 'bossCocoonPrison') return false;
          obj.hp = Math.max(0, Number(obj.hp || 1) - Math.max(1, Math.floor(safeNumber(amount, 1))));
          game.spawnRing?.((obj.x || 0) + 0.5, (obj.y || 0) + 0.5, '#d8c8f2', 12);
          if (obj.hp <= 0) releaseCocoonedTarget(game, obj, 'broken');
          return true;
        },


        findActiveSilkWebRoom(actor = game.player) {
          if (game.currentZone !== 'dungeon' || String(this.state.active?.dungeonId || game.activeDungeon?.id || '') !== SILK_WEB_CAVERN_ID) return null;
          const x = safeNumber(actor?.x, NaN);
          const y = safeNumber(actor?.y, NaN);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          let best = null;
          let bestD = Infinity;
          for (const room of game.dungeonRooms || []) {
            const inside = x >= room.x - room.w / 2 && x <= room.x + room.w / 2 && y >= room.y - room.h / 2 && y <= room.y + room.h / 2;
            const d = Math.hypot(x - room.x, y - room.y);
            if (inside) return room;
            if (d < bestD) { bestD = d; best = room; }
          }
          return bestD <= 18 ? best : null;
        },

        getCurrentSilkRoomReadabilitySummary() {
          const room = this.findActiveSilkWebRoom?.();
          if (!room) return null;
          const role = room.readabilityRole || classifySilkRoomReadability(room, this.state.active?.floor || game.activeDungeon?.floor || 1);
          const hint = {
            safe_transition: 'Safe transition space',
            boss_arena: 'Boss arena: watch hazard telegraphs',
            treasure_exit: 'Treasure / exit area',
            objective_gate: 'Objective gate: anchors or pylon condition nearby',
            signature_bridge: 'Web bridge: stay on the silk span',
            venom_hazard: 'Venom hazard room: avoid green pools',
            cocoon_brood: 'Cocoon / brood chamber: check quest objects',
            royal_combat: 'Royal combat wing',
            combat_room: 'Elite spider pull room'
          }[role] || 'Dungeon chamber';
          return { roomId: room.id, name: room.name || room.id, role, hint, color: room.mapColor || '#d8c8f2' };
        },

        auditSilkWebLayoutReadability(floor = this.state.active?.floor || game.activeDungeon?.floor || 1) {
          const dungeon = dungeonDef(game, 'silk_web_cavern');
          if (!dungeon) return { ok: false, reason: 'missing dungeon' };
          const floorData = generateSilkWebCavernFloor(game, dungeon, floor);
          const report = floorData.readabilityReport || buildSilkLayoutReadabilityReport(floor, floorData.rooms, floorData.layoutLinks, floorData.objects, floorData.enemies);
          const hardIssues = [];
          if (!report.hasSafeEntry) hardIssues.push('missing safe entry');
          if (!report.hasBossArena) hardIssues.push('missing boss arena');
          if (!report.hasTreasureExit) hardIssues.push('missing treasure/exit');
          if (report.linkCount < report.roomCount) hardIssues.push('under-linked floor graph');
          if (report.markerCount < 6) hardIssues.push('too few navigation markers');
          if (report.readableDressing < report.roomCount) hardIssues.push('too little readable dressing');
          if (report.bossCount !== 1) hardIssues.push('wrong boss count');
          return { ok: hardIssues.length === 0, hardIssues, ...report };
        },

        getActiveNavigationSummary() {
          const active = this.state.active || game.activeDungeon;
          if (!active || String(active.dungeonId || active.id || '') !== 'silk_web_cavern') return null;
          const floor = Math.max(1, Math.floor(safeNumber(active.floor, 1)));
          const cfg = SILK_WEB_FLOOR_CONFIG[floor];
          const nav = game.dungeonNavigation || null;
          const aliveBoss = this.livingFloorBoss?.();
          const aliveMiniBosses = (game.dungeonEnemies || []).filter(enemy => enemy && enemy.alive && enemy.dungeonMiniBoss).length;
          const gateObjects = [];
          const grid = game.objects || game.dungeonObjects || [];
          for (let y = 0; y < grid.length; y++) {
            const row = grid[y] || [];
            for (let x = 0; x < row.length; x++) {
              const obj = row[x];
              if (obj?.type === 'webGate') gateObjects.push(obj);
            }
          }
          const runId = currentRunId(this.state);
          const cutAnchors = Object.keys(this.state.interactedObjects || {}).filter(key => key.startsWith(`${runId}:object:silk_web_cavern:floor${floor}:anchor:`)).length;
          const requiredAnchors = floor === 2 ? 4 : 3;
          let objective = '';
          if (gateObjects.some(obj => !obj.opened) && cutAnchors < requiredAnchors) objective = `Gate: ${cutAnchors}/${requiredAnchors} anchors cut`;
          else if (gateObjects.some(obj => !obj.opened) && !silkGateMiniBossesDefeated(this.state, floor)) objective = `Gate: defeat ${silkGateMissingMiniBossLabel(this.state, floor)}`;
          else if (aliveMiniBosses > 0) objective = `${aliveMiniBosses} mini-boss${aliveMiniBosses === 1 ? '' : 'es'} remain`;
          else if (aliveBoss) objective = `Boss: ${aliveBoss.name}`;
          else objective = floor < 3 ? 'Find the descent' : 'Claim the Treasure Web';
          return { dungeonId: 'silk_web_cavern', floor, floorName: cfg?.name || `Floor ${floor}`, objective, cutAnchors, requiredAnchors, aliveMiniBosses, aliveBossName: aliveBoss?.name || '', markerCount: (nav?.objects || []).length };
        },

        showToast(title, body) {
          this.toast = this.toast || ensureDungeonToast();
          if (!this.toast) return;
          const titleEl = this.toast.querySelector('[data-dungeon-toast-title]');
          const bodyEl = this.toast.querySelector('[data-dungeon-toast-body]');
          if (titleEl) titleEl.textContent = title;
          if (bodyEl) bodyEl.textContent = body;
          this.toast.style.display = 'block';
          this.toastTimer = 3.2;
        },

        update(dt) {
          if (!this.panel) this.panel = ensurePanel();
          if (game.currentZone !== 'dungeon' && (this.state.active || game.activeDungeon)) {
            this.state.active = null;
            game.activeDungeon = null;
            game.dungeonFloorMeta = null;
            game.dungeonEnemies = [];
            game.dungeonMap = null;
            game.dungeonObjects = null;
            game.dungeonRooms = [];
            this.saveState();
          }
          if (this.toastTimer > 0) {
            this.toastTimer = Math.max(0, this.toastTimer - dt);
            if (this.toastTimer === 0 && this.toast) this.toast.style.display = 'none';
          }
          this.updateBossAbilities(dt);
          this.updateBossSeal(dt);
          this.updateSilkCritters(dt);
          this.updateSilkWebHazards(dt);
          this.updateSilkWebControlObjects(dt);
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.18;
            this.nearbyEntrance = this.findNearbyEntrance();
            this.nearbyTravelNode = ensureNearbyTravelNode(game);
            this.refreshPanel();
            this.updateDungeonHudPanel?.();
          }
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-dungeon-status]');
          const fill = this.panel.querySelector('[data-dungeon-range]');
          const meta = this.panel.querySelector('[data-dungeon-meta]');
          if (game.currentZone === 'dungeon') {
            const active = this.state.active || game.activeDungeon;
            const node = this.nearbyTravelNode || ensureNearbyTravelNode(game);
            if (status) status.textContent = node
              ? `E: ${node.type === 'dungeonStairs' ? 'Descend to next floor' : node.type === 'dungeonTreasure' ? 'Open dungeon reward' : 'Exit dungeon'}`
              : `${active?.dungeonName || 'Dungeon'} · Floor ${active?.floor || 1}/${active?.floors || 1}`;
            if (fill) fill.style.width = node ? '100%' : '42%';
            if (meta) {
              const boss = this.livingFloorBoss();
              meta.textContent = boss
                ? `${boss.name} alive · ${Math.ceil((boss.hp / Math.max(1, boss.maxHp)) * 100)}% HP · boss gate sealed`
                : `${game.dungeonEnemies?.filter(e => e.alive).length || 0} enemies alive · Boss gate open`;
            }
            return;
          }
          const marker = this.nearbyEntrance || this.findNearbyEntrance();
          if (!marker) {
            if (status) status.textContent = 'No dungeon entrance nearby.';
            if (fill) fill.style.width = '0%';
            if (meta) {
              const count = Object.keys(game.editorDungeonMarkers || {}).reduce((sum, zoneId) => sum + allEntranceMarkers(game, zoneId).length, 0);
              meta.textContent = `${count} entrance marker${count === 1 ? '' : 's'} placed · E near an entrance`;
            }
            return;
          }
          const dungeon = dungeonDef(game, marker.dungeonId) || marker;
          const d = distanceToPlayer(game, marker);
          if (status) status.textContent = `E: Enter ${dungeon.name || marker.dungeonName || marker.dungeonId}`;
          if (fill) fill.style.width = `${Math.floor((1 - clamp(d, 0, 3) / 3) * 100)}%`;
          if (meta) meta.textContent = `Level ${dungeon.minLevel || 1}-${dungeon.maxLevel || '?'} · ${dungeon.floors || 1} floor${Number(dungeon.floors) === 1 ? '' : 's'}`;
        },

        updateDungeonHudPanel() {
          this.dungeonHudPanel = this.dungeonHudPanel || ensureDungeonHudPanel();
          const panel = this.dungeonHudPanel;
          if (!panel) return;
          const active = this.state.active || game.activeDungeon;
          if (game.currentZone !== 'dungeon' || !active) {
            panel.style.display = 'none';
            panel.dataset.dungeonActive = 'false';
            return;
          }
          panel.style.display = '';
          panel.dataset.dungeonActive = 'true';
          const dungeonId = active.dungeonId || active.id || '';
          const dungeon = dungeonId ? dungeonDef(game, dungeonId) : null;
          const floor = Math.max(1, Math.floor(safeNumber(active.floor, 1)));
          const floors = Math.max(floor, Math.floor(safeNumber(active.floors || dungeon?.floors, floor)));
          const nav = this.getActiveNavigationSummary?.() || null;
          const roomSummary = this.getCurrentSilkRoomReadabilitySummary?.() || null;
          const dungeonName = active.dungeonName || active.name || dungeon?.name || 'Dungeon';
          const floorName = nav?.floorName || game.dungeonFloorMeta?.name || active.floorName || '';
          let status = nav?.objective || '';
          if (nav && Number.isFinite(Number(nav.aliveMiniBosses)) && Number(nav.aliveMiniBosses) > 0) {
            status = `Mini-bosses remaining: ${Math.max(0, Math.floor(Number(nav.aliveMiniBosses)))}`;
          }
          const safe = roomSummary?.role === 'safe_transition';
          setDungeonHudText(panel, '[data-dungeon-hud-title]', dungeonName, 'Dungeon');
          setDungeonHudText(panel, '[data-dungeon-hud-floor]', `Floor ${floor}/${floors}`);
          setDungeonHudText(panel, '[data-dungeon-hud-subarea]', floorName);
          setDungeonHudText(panel, '[data-dungeon-hud-status]', status || 'Explore the dungeon');
          setDungeonHudText(panel, '[data-dungeon-hud-room]', roomSummary?.name || '');
          setDungeonHudText(panel, '[data-dungeon-hud-hint]', roomSummary?.hint || '');
          panel.classList.toggle('safeTransition', Boolean(safe));
        },

        render() {
          this.updateDungeonHudPanel?.();
          if (game.currentZone === 'dungeon') return this.renderDungeonLabels();
          this.renderEntranceMarkers();
        },

        renderEntranceMarkers() {
          if (!game.started || !game.player) return;
          const markers = allMarkersForActiveZone(game);
          const ctx = DR.runtime?.ctx;
          if (!ctx || typeof game.worldToScreen !== 'function') return;
          for (const marker of markers) {
            if ((marker.markerKind || marker.kind) !== 'entrance') continue;
            const x = safeNumber(marker.x) + 0.5;
            const y = safeNumber(marker.y) + 0.5;
            if (Math.hypot(x - game.player.x, y - game.player.y) > 42) continue;
            const elev = game.map?.[Math.floor(y)]?.[Math.floor(x)]?.elev || 0;
            const s = game.worldToScreen(x, y, elev);
            this.drawPortalGlyph(ctx, s, marker);
          }
        },

        renderDungeonLabels() {
          if (!game.started || !game.player) return;
          const ctx = DR.runtime?.ctx;
          if (!ctx || typeof game.worldToScreen !== 'function') return;
          const active = this.state.active || game.activeDungeon;
          const nav = this.getActiveNavigationSummary?.();
          for (const room of game.dungeonRooms || []) {
            const d = Math.hypot(room.x - game.player.x, room.y - game.player.y);
            if (d > 58) continue;
            const s = game.worldToScreen(room.x + 0.5, room.y + 0.5, 0);
            const kindColor = {
              safe_entry: '#f0dca0', combat: '#d8c8f2', egg_room: '#d8c8f2', web_choke: '#8df0bc', puzzle: '#d68cff', boss: '#ff6f6f', treasure: '#d8ad57'
            }[room.kind] || '#f4dfae';
            ctx.save();
            ctx.globalAlpha = Math.max(0.18, 0.78 - d / 90);
            ctx.fillStyle = 'rgba(5,8,6,0.48)';
            ctx.strokeStyle = kindColor;
            ctx.lineWidth = 1.5;
            ctx.font = '12px ui-monospace, monospace';
            ctx.textAlign = 'center';
            const label = room.name || room.kind;
            const w = Math.max(76, ctx.measureText(label).width + 18);
            ctx.fillRect(s.x - w / 2, s.y - 43, w, 18);
            ctx.strokeRect(s.x - w / 2, s.y - 43, w, 18);
            ctx.fillStyle = '#f4dfae';
            ctx.fillText(label, s.x, s.y - 30);
            ctx.restore();
          }
          this.updateDungeonHudPanel?.();
        },

        drawPortalGlyph(ctx, s, marker) {
          const t = performance.now() * 0.004;
          const color = marker.color || '#a987ff';
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.fillStyle = 'rgba(0,0,0,0.38)';
          ctx.beginPath();
          ctx.ellipse(0, 13, 34, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.86;
          ctx.beginPath();
          ctx.ellipse(0, -14, 20 + Math.sin(t) * 2, 34 + Math.cos(t * 0.7) * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(0, -14, 15, 28, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#f8ecd0';
          ctx.font = '11px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(marker.label || 'D', 0, -10);
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText('E', 0, 28);
          ctx.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
