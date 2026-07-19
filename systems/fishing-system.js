// Dream Realms fishing runtime system
// V0.12.2: fish-anywhere water casting, held pole pose, moving bobber, and aquatic life.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const CONFIG = DR.CONFIG || { TILE_W: 104 };

  const STORAGE_KEY = 'dream-realms-fishing-system-v3';
  const LEGACY_STORAGE_KEYS = ['dream-realms-fishing-system-v2'];
  const HOTSPOT_RELOCATE_SECONDS = 0;
  const HOTSPOT_COUNTS = { dark_woods: 0, defaultCave: 0 };
  const AQUATIC_COUNTS = { dark_woods: 34, defaultCave: 10 };
  const FISHING_SHORE_STAND_RANGE = 1.72;
  const FISHING_CAST_WATER_RANGE = 2.35;
  const WATER = () => (window.DreamRealms.TILE || {}).WATER;

  const FISH_TABLES = {
    dark_woods: [
      { itemId: 'item_small_pondfish', name: 'Small Pondfish', weight: 34, xp: 8, rarityKey: 'white' },
      { itemId: 'item_murkwater_minnow', name: 'Murkwater Minnow', weight: 28, xp: 8, rarityKey: 'white' },
      { itemId: 'item_mossback_trout', name: 'Mossback Trout', weight: 18, xp: 12, rarityKey: 'white' },
      { itemId: 'item_blackwater_eel', name: 'Blackwater Eel', weight: 10, xp: 17, rarityKey: 'green' },
      { itemId: 'item_silverfin', name: 'Silverfin', weight: 4, xp: 28, rarityKey: 'blue' },
      // V0.17.61 Phase 22: Dark Woods-only overworld fish, level-gated by
      // levelRequired (see eligibleFish). Gloamroot Catfish is deep-water-only
      // and carries a rare-node XP bonus. First-discovery bonus is applied from
      // levelRequired by the Phase 19 resolveCatch logic.
      { itemId: 'item_duskmud_minnow', name: 'Duskmud Minnow', weight: 30, xp: 10, rarityKey: 'white', levelRequired: 1 },
      { itemId: 'item_lanternfin', name: 'Lanternfin', weight: 22, xp: 14, rarityKey: 'white', levelRequired: 2 },
      { itemId: 'item_brambleback_pike', name: 'Brambleback Pike', weight: 15, xp: 24, rarityKey: 'green', levelRequired: 4 },
      { itemId: 'item_ghostscale_trout', name: 'Ghostscale Trout', weight: 9, xp: 34, rarityKey: 'blue', levelRequired: 5 },
      { itemId: 'item_gloamroot_catfish', name: 'Gloamroot Catfish', weight: 5, xp: 55, rarityKey: 'blue', levelRequired: 7, rareNodeXpBonus: 20, deepWaterOnly: true },
      { itemId: 'item_torn_boot', name: 'Torn Boot', weight: 3, xp: 2, rarityKey: 'grey', junk: true },
      { itemId: 'item_river_driftwood', name: 'River Driftwood', weight: 3, xp: 2, rarityKey: 'grey', junk: true }
    ],
    cave: [
      { itemId: 'item_cave_blindfish', name: 'Cave Blindfish', weight: 38, xp: 11, rarityKey: 'white' },
      { itemId: 'item_cave_eel', name: 'Cave Eel', weight: 24, xp: 16, rarityKey: 'white' },
      { itemId: 'item_blackwater_eel', name: 'Blackwater Eel', weight: 17, xp: 17, rarityKey: 'green' },
      { itemId: 'item_silverfin', name: 'Silverfin', weight: 5, xp: 30, rarityKey: 'blue' },
      { itemId: 'item_river_driftwood', name: 'River Driftwood', weight: 6, xp: 2, rarityKey: 'grey', junk: true }
    ],
    crystal_grotto: [
      { itemId: 'item_cave_blindfish', name: 'Cave Blindfish', weight: 28, xp: 12, rarityKey: 'white' },
      { itemId: 'item_cave_eel', name: 'Cave Eel', weight: 25, xp: 17, rarityKey: 'white' },
      { itemId: 'item_silverfin', name: 'Silverfin', weight: 10, xp: 32, rarityKey: 'blue' },
      { itemId: 'item_blackwater_eel', name: 'Blackwater Eel', weight: 14, xp: 18, rarityKey: 'green' }
    ],
    blackroot_catacombs: [
      { itemId: 'item_cave_eel', name: 'Cave Eel', weight: 30, xp: 18, rarityKey: 'white' },
      { itemId: 'item_blackwater_eel', name: 'Blackwater Eel', weight: 22, xp: 20, rarityKey: 'green' },
      { itemId: 'item_silverfin', name: 'Silverfin', weight: 8, xp: 34, rarityKey: 'blue' },
      { itemId: 'item_cave_blindfish', name: 'Cave Blindfish', weight: 20, xp: 13, rarityKey: 'white' }
    ],
    // V0.17.62 Phase 23: Silk Web Cavern-only cave fish, caught from cave pools
    // carved into the dungeon floors. Level-gated by levelRequired (see
    // eligibleFish); Broodpool Angler is deep-water-only (only the deep floor-3
    // pool, waterDepth>=9) and carries a rare-node XP bonus. First-discovery is
    // applied from levelRequired by the Phase 19 resolveCatch logic.
    silk_web_cavern: [
      { itemId: 'item_blind_silk_minnow', name: 'Blind Silk Minnow', weight: 30, xp: 28, rarityKey: 'green', levelRequired: 4 },
      { itemId: 'item_venomgill_eel', name: 'Venomgill Eel', weight: 14, xp: 44, rarityKey: 'blue', levelRequired: 6 },
      { itemId: 'item_broodpool_angler', name: 'Broodpool Angler', weight: 6, xp: 75, rarityKey: 'purple', levelRequired: 8, rareNodeXpBonus: 30, deepWaterOnly: true },
      { itemId: 'item_river_driftwood', name: 'Silk-Wrapped Driftwood', weight: 3, xp: 2, rarityKey: 'grey', junk: true }
    ]
  };
  // V0.18.71 (Roadmap Item 12): expose the fish catch tables as content data so the registry's
  // item-obtainability audit (and future loot/acquisition tooling) can see that a fish is
  // reachable by fishing. Read-only reference to the same object this system already uses.
  DR.FISH_TABLES = FISH_TABLES;

  const FISH_VISUALS = [
    { color: '#79d1d8', length: 0.28, speed: 0.86 },
    { color: '#5cae94', length: 0.34, speed: 0.70 },
    { color: '#c2e8ff', length: 0.24, speed: 1.04 },
    { color: '#425d64', length: 0.42, speed: 0.56 },
    { color: '#8cbf68', length: 0.30, speed: 0.76 }
  ];

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function loadState() {
    const rawCandidates = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    for (const key of rawCandidates) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        return {
          version: 3,
          level: Math.max(1, Math.floor(safeNumber(parsed.level, 1))),
          xp: Math.max(0, Math.floor(safeNumber(parsed.xp, 0))),
          catches: Math.max(0, Math.floor(safeNumber(parsed.catches, 0))),
          rareCatches: Math.max(0, Math.floor(safeNumber(parsed.rareCatches, 0))),
          hotspotCatches: Math.max(0, Math.floor(safeNumber(parsed.hotspotCatches, 0))),
          perfectReels: Math.max(0, Math.floor(safeNumber(parsed.perfectReels, 0)))
        };
      } catch (_err) {}
    }
    return { version: 3, level: 1, xp: 0, catches: 0, rareCatches: 0, hotspotCatches: 0, perfectReels: 0 };
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_err) {}
  }

  function weightedPick(list) {
    const table = Array.isArray(list) && list.length ? list : FISH_TABLES.dark_woods;
    const total = table.reduce((sum, entry) => sum + Math.max(0, safeNumber(entry.weight, 0)), 0) || 1;
    let roll = Math.random() * total;
    for (const entry of table) {
      roll -= Math.max(0, safeNumber(entry.weight, 0));
      if (roll <= 0) return entry;
    }
    return table[table.length - 1];
  }

  // Phase 22: gate a fish table by the player's Fishing level (per-fish
  // levelRequired; existing fish without it count as level 1) and by water depth
  // (deepWaterOnly fish only bite deep-water casts, so rare fish stay in deeper
  // water). Falls back to the level-1, non-deep fish so every cast has a pool.
  function eligibleFish(table, fishingLevel, deepWater) {
    const list = Array.isArray(table) ? table : [];
    const lvl = Math.max(1, Math.floor(safeNumber(fishingLevel, 1)));
    const ok = list.filter(f => {
      const req = Math.max(1, Math.floor(safeNumber(f.levelRequired, 1)));
      if (req > lvl) return false;
      if (f.deepWaterOnly && !deepWater) return false;
      return true;
    });
    if (ok.length) return ok;
    return list.filter(f => Math.max(1, Math.floor(safeNumber(f.levelRequired, 1))) <= 1 && !f.deepWaterOnly);
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('fishingSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'fishingSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Fishing</h3>
      <div class="small" data-fishing-status>Stand near any river, pond, lake, or cave pool and press F to cast.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-fishing-xp></div></div>
      <div class="small" data-fishing-action>Idle</div>
      <div class="small" data-fishing-meta>Level 1 · 0 XP</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  function zoneKey(game) {
    // Phase 23: the Silk Web Cavern dungeon has fishable cave pools carved into
    // its floors, so it gets its own fish-table key. Other dungeons have no
    // water and thus no fishing.
    if (game.currentZone === 'dungeon') {
      return String(game.activeDungeon?.id || game.dungeonSystem?.state?.active?.dungeonId || '') === 'silk_web_cavern'
        ? 'silk_web_cavern' : 'dungeon';
    }
    if (game.currentZone === 'cave') return game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave';
    // V0.20.91: the ACTIVE overworld zone, not a hardcoded 'dark_woods'. With one overworld the two
    // were the same thing; with two, Ashen Valley inherited Dark Woods' ambient fish, whose stored
    // coordinates are dry land here - so every fish re-targeted every frame.
    return String(game.activeOverworldZoneId || 'dark_woods');
  }

  function zoneFishTable(zone) {
    if (FISH_TABLES[zone]) return FISH_TABLES[zone];
    return zone === 'dark_woods' ? FISH_TABLES.dark_woods : FISH_TABLES.cave;
  }

  // V0.20.91: an OVERWORLD zone is any zone declared in DR.DEFAULT_WORLD without a parentZone -
  // i.e. not a cave or dungeon. Testing `zone !== 'dark_woods'` sent Ashen Valley down the CAVE
  // branch, which is the same hardcoded-single-overworld assumption that broke the map label and the
  // fog key in V0.20.83.
  function isOverworldZone(zone) {
    const def = window.DreamRealms?.DEFAULT_WORLD?.zones?.[zone];
    return !!def && !def.parentZone;
  }

  function activeMap(game, zone) {
    if (zone === 'silk_web_cavern') return game.dungeonMap || (game.currentZone === 'dungeon' ? game.map : null);
    if (isOverworldZone(zone)) {
      return game.overworldZoneSlot?.(zone)?.map || game.overworldMap || (game.currentZone === 'overworld' ? game.map : null);
    }
    return game.caveMap || (game.currentZone === 'cave' ? game.map : null);
  }

  function activeObjects(game, zone) {
    if (zone === 'silk_web_cavern') return game.dungeonObjects || (game.currentZone === 'dungeon' ? game.objects : null);
    if (isOverworldZone(zone)) {
      return game.overworldZoneSlot?.(zone)?.objects || game.overworldObjects || (game.currentZone === 'overworld' ? game.objects : null);
    }
    return game.caveObjects || (game.currentZone === 'cave' ? game.objects : null);
  }

  function hasFishingRod(game) {
    const inv = Array.isArray(game.inventory) ? game.inventory : [];
    return inv.some(item => {
      const id = String(item.itemId || item.sourceItemId || item.id || '').toLowerCase();
      const name = String(item.name || item.baseName || '').toLowerCase();
      return id === 'item_worn_fishing_rod' || id === 'item_basic_fishing_rod' || name.includes('fishing rod');
    });
  }

  function waterNeighborCounts(map, x, y) {
    let waterNeighbors = 0;
    let landNeighbors = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const tile = map?.[y + dy]?.[x + dx];
      if (!tile) continue;
      if (tile.type === WATER()) waterNeighbors++;
      else landNeighbors++;
    }
    return { waterNeighbors, landNeighbors };
  }

  function nearestFishingEdgeWater(game, zone = zoneKey(game), maxRange = FISHING_SHORE_STAND_RANGE) {
    const player = game.player;
    const map = activeMap(game, zone);
    if (!player || !map) return null;
    const px = safeNumber(player.x, NaN);
    const py = safeNumber(player.y, NaN);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
    const radius = Math.max(2, Math.ceil(maxRange + 1));
    let best = null;
    let bestDist = Infinity;
    for (let y = Math.floor(py) - radius; y <= Math.floor(py) + radius; y++) {
      for (let x = Math.floor(px) - radius; x <= Math.floor(px) + radius; x++) {
        const tile = map?.[y]?.[x];
        if (!tile || tile.type !== WATER()) continue;
        const { landNeighbors } = waterNeighborCounts(map, x, y);
        if (landNeighbors <= 0) continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        const d = Math.hypot(cx - px, cy - py);
        if (d <= maxRange && d < bestDist) {
          const objects = activeObjects(game, zone);
          const obj = objects?.[y]?.[x];
          if (obj?.blocked) continue;
          bestDist = d;
          best = { x, y, cx, cy, distance: d, tile };
        }
      }
    }
    return best;
  }

  function playerIsNextToFishableWater(game, zone = zoneKey(game)) {
    return Boolean(nearestFishingEdgeWater(game, zone, FISHING_SHORE_STAND_RANGE));
  }

  function isValidHotspotPosition(game, zone, x, y) {
    const map = activeMap(game, zone);
    if (!map?.[y]?.[x] || map[y][x].type !== WATER()) return false;
    const objects = activeObjects(game, zone);
    if (objects?.[y]?.[x]) return false;
    if (zone === 'dark_woods' && Math.hypot(x - 100, y - 100) < 10) return false;
    const { waterNeighbors, landNeighbors } = waterNeighborCounts(map, x, y);
    return waterNeighbors >= 1 && landNeighbors >= 1;
  }

  function isOpenWaterPosition(game, zone, x, y) {
    const map = activeMap(game, zone);
    if (!map?.[y]?.[x] || map[y][x].type !== WATER()) return false;
    const { waterNeighbors } = waterNeighborCounts(map, x, y);
    return waterNeighbors >= 2;
  }

  // V0.20.91: two faults fixed here, and the second is why an EMPTY Ashen Valley cost 33ms a frame.
  //
  // (1) The search area was clamped to CONFIG.MAP_SIZE, which is 200 - a constant that predates both
  //     the Dark Woods 360 expansion and Ashen Valley. On a 450x450 map it searched only the top-left
  //     200x200 corner. Ashen Valley's river lies entirely east of x=280, so that corner holds no
  //     water at all: every fish failed, fell through to the full grid sweep, and did it again the
  //     next frame. Dark Woods survived the same bug purely because its creek happens to sit inside
  //     its first 200x200. The real map size is used now.
  //
  // (2) A failed search had no memory, so a waterless region re-ran the whole sweep every frame
  //     forever. A short per-zone backoff means the worst case is now one sweep every few seconds
  //     rather than sixty a second - which any future zone without water would otherwise hit.
  const NO_WATER_BACKOFF_MS = 4000;
  const noWaterUntil = Object.create(null);

  function findWaterCandidate(game, zone, salt = 0, mode = 'hotspot') {
    const map = activeMap(game, zone);
    if (!map) return null;
    const size = map.length || 0;
    if (size <= 8) return null;

    const key = `${zone}:${mode}`;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (noWaterUntil[key] && now < noWaterUntil[key]) return null;

    const validator = mode === 'open' ? isOpenWaterPosition : isValidHotspotPosition;
    for (let attempt = 0; attempt < 520; attempt++) {
      const x = 4 + Math.floor(Math.random() * Math.max(1, size - 8));
      const y = 4 + Math.floor(Math.random() * Math.max(1, size - 8));
      if (validator(game, zone, x, y)) { delete noWaterUntil[key]; return { x, y }; }
    }
    for (let y = 3; y < size - 3; y++) {
      for (let x = 3; x < size - 3; x++) {
        if (((x * 31 + y * 17 + salt) % 5) !== 0) continue;
        if (validator(game, zone, x, y)) { delete noWaterUntil[key]; return { x, y }; }
      }
    }
    noWaterUntil[key] = now + NO_WATER_BACKOFF_MS;
    return null;
  }

  function findFishingCastTarget(game, range = FISHING_CAST_WATER_RANGE) {
    const player = game.player;
    const zone = zoneKey(game);
    const map = activeMap(game, zone);
    if (!player || !map) return null;
    if (!playerIsNextToFishableWater(game, zone)) return null;
    range = Math.min(Math.max(0.8, safeNumber(range, FISHING_CAST_WATER_RANGE)), FISHING_CAST_WATER_RANGE);
    const px = Number(player.x);
    const py = Number(player.y);
    const facingX = Number(player.facingX || 0);
    const facingY = Number(player.facingY || 0);
    const radius = Math.ceil(range);
    let best = null;
    let bestScore = Infinity;
    for (let y = Math.floor(py) - radius; y <= Math.floor(py) + radius; y++) {
      for (let x = Math.floor(px) - radius; x <= Math.floor(px) + radius; x++) {
        const tile = map?.[y]?.[x];
        if (!tile || tile.type !== WATER()) continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        const dx = cx - px;
        const dy = cy - py;
        const d = Math.hypot(dx, dy);
        if (d < 0.35 || d > range) continue;
        const objects = activeObjects(game, zone);
        const obj = objects?.[y]?.[x];
        if (obj?.blocked) continue;
        const forward = d > 0 ? ((dx / d) * facingX + (dy / d) * facingY) : 0;
        const depth = safeNumber(tile.waterDepth, 6);
        const shore = waterNeighborCounts(map, x, y).landNeighbors;
        const preferredDistance = Math.abs(d - 1.35) * 0.72;
        const score = preferredDistance - forward * 0.85 - Math.min(12, depth) * 0.035 - shore * 0.12;
        if (score < bestScore) {
          bestScore = score;
          best = {
            id: `${zone}_freecast_${x}_${y}_${Math.floor(performance.now())}`,
            zone,
            x: cx,
            y: cy,
            tileX: x,
            tileY: y,
            freeCast: true,
            rare: depth >= 10 && Math.random() < 0.12,
            waterDepth: depth,
            pulse: Math.random() * Math.PI * 2
          };
        }
      }
    }
    return best;
  }

  function isCastTargetStillValid(game, spot, maxRange = FISHING_CAST_WATER_RANGE) {
    if (!spot || !game.player) return false;
    const zone = zoneKey(game);
    const map = activeMap(game, zone);
    const tile = map?.[spot.tileY]?.[spot.tileX];
    if (!tile || tile.type !== WATER()) return false;
    if (!playerIsNextToFishableWater(game, zone)) return false;
    const allowed = Math.min(Math.max(0.8, safeNumber(maxRange, FISHING_CAST_WATER_RANGE)), FISHING_CAST_WATER_RANGE);
    return Math.hypot(game.player.x - spot.x, game.player.y - spot.y) <= allowed;
  }

  // V0.17.18: fallback projection only. The live line origin now prefers the actual
  // rod-tip screen anchor published by render/entity-renderer.js after drawing the pole.
  function getFishingPoleTipWorld(game, player, waterSpot, action = 'waiting', now = performance.now() * 0.001) {
    if (!player) return { x: 0, y: 0, z: 0 };
    const playerTile = game.tileAt?.(player.x, player.y);
    const targetX = safeNumber(waterSpot?.x, player.x + safeNumber(player.facingX, 1));
    const targetY = safeNumber(waterSpot?.y, player.y + safeNumber(player.facingY, 0));
    const targetLength = Math.hypot(targetX - player.x, targetY - player.y) || 1;
    const facingX = safeNumber(player.facingX, targetX - player.x);
    const facingY = safeNumber(player.facingY, targetY - player.y);
    const facingLength = Math.hypot(facingX, facingY) || 1;
    let dx = ((targetX - player.x) / targetLength) * 0.78 + (facingX / facingLength) * 0.22;
    let dy = ((targetY - player.y) / targetLength) * 0.78 + (facingY / facingLength) * 0.22;
    const directionLength = Math.hypot(dx, dy) || 1;
    dx /= directionLength;
    dy /= directionLength;
    const castProgress = action === 'casting'
      ? 1 - Math.max(0, Math.min(1, safeNumber(player.fishingCastTimer, 0) / 0.62))
      : 1;
    const reach = 0.50 + castProgress * 0.42;
    const poseSway = action === 'reeling' ? Math.sin(now * 15) * 0.045 : Math.sin(now * 3.2) * 0.018;
    return {
      x: player.x + dx * reach - dy * poseSway,
      y: player.y + dy * reach + dx * poseSway,
      z: safeNumber(playerTile?.elev, 0) + 3.25 + (action === 'casting' ? castProgress * 0.18 : 0)
    };
  }

  function getFishingBobberWorld(game, fishingRuntime) {
    const spot = fishingRuntime?.waterSpot;
    if (!spot) return null;
    const tile = game.tileAt?.(spot.x, spot.y);
    return { x: safeNumber(spot.x, 0), y: safeNumber(spot.y, 0), z: safeNumber(tile?.elev, 0) + 0.06 };
  }

  function worldFishingPointToScreen(game, point) {
    if (!point || typeof game.worldToScreen !== 'function') return null;
    const screen = game.worldToScreen(point.x, point.y, safeNumber(point.z, 0));
    return Number.isFinite(screen?.x) && Number.isFinite(screen?.y) ? { x: screen.x, y: screen.y } : null;
  }


  function cameraMatchesFishingRodTipAnchor(game, player) {
    if (!game || !player?.fishingRodTipScreen) return false;
    const tip = player.fishingRodTipScreen;
    if (!Number.isFinite(Number(tip.x)) || !Number.isFinite(Number(tip.y))) return false;
    const now = performance.now();
    const ageMs = now - safeNumber(player.fishingRodTipScreenAt, 0);
    if (!Number.isFinite(ageMs) || ageMs > 250) return false;
    const camera = game.camera || {};
    const yawDelta = Math.abs(safeNumber(player.fishingRodTipScreenCameraYaw, 0) - safeNumber(camera.yaw, 0));
    const zoomDelta = Math.abs(safeNumber(player.fishingRodTipScreenCameraZoom, 1) - safeNumber(camera.zoom, 1));
    const camXDelta = Math.abs(safeNumber(player.fishingRodTipScreenCameraX, 0) - safeNumber(camera.x, 0));
    const camYDelta = Math.abs(safeNumber(player.fishingRodTipScreenCameraY, 0) - safeNumber(camera.y, 0));
    return yawDelta < 0.0009 && zoomDelta < 0.0009 && camXDelta < 0.035 && camYDelta < 0.035;
  }

  function getFreshFishingRodTipScreen(game, player) {
    if (!cameraMatchesFishingRodTipAnchor(game, player)) return null;
    const tip = player.fishingRodTipScreen;
    return { x: Number(tip.x), y: Number(tip.y) };
  }

  function getFishingLineStartScreen(game, player, waterSpot, action, now) {
    const liveTip = getFreshFishingRodTipScreen(game, player);
    if (liveTip) return liveTip;
    // Fallback for hybrid-render or first-frame cases where the character renderer
    // has not yet published a rod-tip anchor. This keeps the line stable, but the
    // normal path above is the authoritative actual-pole-tip anchor.
    return worldFishingPointToScreen(game, getFishingPoleTipWorld(game, player, waterSpot, action, now));
  }

  function createFish(game, zone, index) {
    const pos = findWaterCandidate(game, zone, index * 13, 'open') || findWaterCandidate(game, zone, index * 13, 'hotspot');
    if (!pos) return null;
    const visual = FISH_VISUALS[index % FISH_VISUALS.length];
    const target = findWaterCandidate(game, zone, index * 29 + 7, 'open') || pos;
    return {
      id: `${zone}_fish_${index}_${Math.floor(performance.now())}`,
      zone,
      x: pos.x + 0.2 + Math.random() * 0.6,
      y: pos.y + 0.2 + Math.random() * 0.6,
      tx: target.x + 0.2 + Math.random() * 0.6,
      ty: target.y + 0.2 + Math.random() * 0.6,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      speed: visual.speed * (0.52 + Math.random() * 0.32),
      color: visual.color,
      length: visual.length * (0.85 + Math.random() * 0.34),
      visible: Math.random() < 0.74,
      turnCooldown: 0.5 + Math.random() * 2.5
    };
  }

  function clearPlayerFishingPose(game) {
    const p = game.player;
    if (!p) return;
    p.fishing = false;
    p.fishingAction = '';
    p.fishingAnim = 0;
    p.fishingTargetX = null;
    p.fishingTargetY = null;
    p.fishingCastTimer = 0;
    p.fishingReelTimer = 0;
    p.fishingRodTipScreen = null;
    p.fishingRodTipScreenFrame = null;
    p.fishingRodTipScreenCameraYaw = null;
    p.fishingRodTipScreenCameraZoom = null;
    p.fishingRodTipScreenCameraX = null;
    p.fishingRodTipScreenCameraY = null;
  }

  function setPlayerFishingPose(game, target, action = 'waiting') {
    const p = game.player;
    if (!p) return;
    p.fishing = true;
    p.fishingAction = action;
    // V0.19.9: was `(p.facingX || 1)` / `(p.facingY || 0)`. facingX is legitimately 0 when facing due
    // north or south, and `0 || 1` is 1, so the untargeted cast aimed 45 degrees off - and line 468 feeds
    // this straight back into setFacingFromDelta, so the player physically TURNED to the wrong heading.
    const castFacing = game.actorFacingVector ? game.actorFacingVector(p) : { x: 1, y: 0 };
    p.fishingTargetX = safeNumber(target?.x, p.x + castFacing.x * 2);
    p.fishingTargetY = safeNumber(target?.y, p.y + castFacing.y * 2);
    p.fishingAnim = safeNumber(p.fishingAnim, 0);
    p.fishingCastTimer = action === 'casting' ? 0.62 : safeNumber(p.fishingCastTimer, 0);
    p.fishingReelTimer = action === 'reeling' ? Math.max(safeNumber(p.fishingReelTimer, 0), 0.72) : safeNumber(p.fishingReelTimer, 0);
    p.meditating = false;
    p.moveBlend = 0;
    p.setFacingFromDelta?.(p.fishingTargetX - p.x, p.fishingTargetY - p.y);
  }

  registerDreamRealmsSystem({
    id: 'fishing',
    name: 'Fishing',

    install(game) {
      const state = loadState();
      const runtime = {
        id: 'fishing',
        name: 'Fishing',
        game,
        state,
        active: false,
        timer: 0,
        totalTimer: 0,
        waterSpot: null,
        bobberT: 0,
        status: 'Stand near any river, pond, lake, or cave pool and press F to cast.',
        actionLabel: 'Idle',
        panel: ensurePanel(),
        hotspots: {},
        relocateTimers: {},
        fishByZone: {},
        fishSeedZone: null,
        lastFishPulse: 0,
        poseReleaseTimer: 0,
        startPlayerX: null,
        startPlayerY: null,

        onGameEvent(eventName) {
          if (eventName === 'player-started') {
            this.ensureStarterRod();
            this.ensureAquaticLife('dark_woods', true);
            this.status = 'Fish anywhere near rivers, ponds, lakes, or cave pools. Press F near water.';
            this.refreshPanel();
          }
        },

        ensureStarterRod() {
          if (hasFishingRod(game)) return;
          const result = game.grantEditorItem?.('item_basic_fishing_rod', 1, { rarityKey: 'white' });
          if (!result?.ok) {
            game.addMaterialItem?.({
              id: 'item_basic_fishing_rod',
              itemId: 'item_basic_fishing_rod',
              name: 'Basic Fishing Rod',
              category: 'Tool',
              rarityKey: 'white',
              value: 10,
              stack: 1,
              description: 'A basic rod used to fish from any nearby water.'
            });
          }
          game.log?.('Starter tool added: Basic Fishing Rod.');
        },

        bindInput() {
          window.addEventListener('keydown', event => {
            if ((game.isActionKey ? !game.isActionKey(event, 'fishing') : event.key.toLowerCase() !== 'f') || event.repeat) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            const el = event.target;
            const tag = String(el?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
            event.preventDefault();
            this.toggleFishing();
          });
        },

        zoneHotspots(zone = zoneKey(game)) {
          if (!this.hotspots[zone]) this.hotspots[zone] = [];
          return this.hotspots[zone];
        },

        hotspotCount(zone) {
          return zone === 'dark_woods' ? HOTSPOT_COUNTS.dark_woods : HOTSPOT_COUNTS.defaultCave;
        },

        aquaticCount(zone) {
          return zone === 'dark_woods' ? AQUATIC_COUNTS.dark_woods : AQUATIC_COUNTS.defaultCave;
        },

        relocateHotspots(zone = zoneKey(game), force = false) {
          const now = performance.now() * 0.001;
          if (!force && safeNumber(this.relocateTimers[zone], 0) > now) return false;
          if (!activeMap(game, zone)) return false;
          const count = this.hotspotCount(zone);
          const next = [];
          for (let i = 0; i < count; i++) {
            const pos = findWaterCandidate(game, zone, i + Math.floor(now), 'hotspot');
            if (!pos) continue;
            next.push({
              id: `${zone}_hotspot_${i}_${Math.floor(now)}`,
              zone,
              x: pos.x + 0.5,
              y: pos.y + 0.5,
              tileX: pos.x,
              tileY: pos.y,
              rare: Math.random() < 0.18,
              createdAt: now,
              pulse: Math.random() * Math.PI * 2
            });
          }
          if (next.length) {
            this.hotspots[zone] = next;
            this.relocateTimers[zone] = now + HOTSPOT_RELOCATE_SECONDS;
            if (!force && game.currentZone !== 'dungeon') game.log?.('Fishing ripples drift to new water locations.');
            return true;
          }
          return false;
        },

        ensureAquaticLife(zone = zoneKey(game), force = false) {
          if (!activeMap(game, zone)) return false;
          if (!force && Array.isArray(this.fishByZone[zone]) && this.fishByZone[zone].length) return true;
          const count = this.aquaticCount(zone);
          const fish = [];
          for (let i = 0; i < count; i++) {
            const created = createFish(game, zone, i);
            if (created) fish.push(created);
          }
          this.fishByZone[zone] = fish;
          return fish.length > 0;
        },

        findNearbyFishingWater(range = FISHING_CAST_WATER_RANGE) {
          return findFishingCastTarget(game, range);
        },

        startFishingAtWater(tileX, tileY) {
          if (!game.player || game.player.meditating) return false;
          if (!hasFishingRod(game)) {
            this.status = 'You need a fishing rod.';
            this.actionLabel = 'Missing tool';
            game.log?.(this.status);
            this.refreshPanel();
            return false;
          }
          const x = Math.floor(safeNumber(tileX, NaN));
          const y = Math.floor(safeNumber(tileY, NaN));
          const tile = game.map?.[y]?.[x];
          if (!tile || tile.type !== WATER()) {
            this.status = 'That is not fishable water.';
            this.actionLabel = 'Invalid water';
            game.log?.(this.status);
            this.refreshPanel();
            return false;
          }
          if (!playerIsNextToFishableWater(game, zoneKey(game)) || Math.hypot((x + 0.5) - game.player.x, (y + 0.5) - game.player.y) > FISHING_CAST_WATER_RANGE) {
            this.status = 'Too far from water.';
            this.actionLabel = 'Too far';
            game.log?.(this.status);
            this.refreshPanel();
            return false;
          }
          if (!isCastTargetStillValid(game, { x: x + 0.5, y: y + 0.5, tileX: x, tileY: y, zone: zoneKey(game) })) {
            this.status = 'Too far from water.';
            this.actionLabel = 'No shoreline';
            game.log?.(this.status);
            this.refreshPanel();
            return false;
          }
          if (this.active) this.cancelFishing('You reel your line back in.');
          const depth = safeNumber(tile.waterDepth, 5);
          const spot = { x: x + 0.5, y: y + 0.5, tileX: x, tileY: y, zone: zoneKey(game), rare: depth >= 9, createdAt: performance.now() * 0.001, pulse: Math.random() * Math.PI * 2 };
          game.cancelPlayerEmote?.('action');
          this.active = true;
          this.startPlayerX = safeNumber(game.player.x, 0);
          this.startPlayerY = safeNumber(game.player.y, 0);
          this.waterSpot = spot;
          this.totalTimer = 3.55 + Math.random() * 3.45;
          this.timer = this.totalTimer;
          this.bobberT = 0;
          this.status = spot.rare ? 'Deep water cast... wait for a strong bite.' : 'Line cast... wait for a bite.';
          this.actionLabel = 'Casting';
          setPlayerFishingPose(game, spot, 'casting');
          game.log?.('You cast into the water.');
          this.refreshPanel();
          return true;
        },

        toggleFishing() {
          if (this.active) {
            this.cancelFishing('You reel your line back in.');
            return;
          }
          this.startFishing();
        },

        startFishing() {
          if (!game.player || game.player.meditating) return;
          if (!hasFishingRod(game)) {
            this.status = 'You need a fishing rod.';
            this.actionLabel = 'Missing tool';
            game.log?.(this.status);
            this.refreshPanel();
            return;
          }
          const spot = this.findNearbyFishingWater();
          if (!spot) {
            this.status = 'Too far from water.';
            this.actionLabel = 'Too far';
            game.log?.(this.status);
            this.refreshPanel();
            return;
          }
          game.cancelPlayerEmote?.('action');
          this.active = true;
          this.startPlayerX = safeNumber(game.player.x, 0);
          this.startPlayerY = safeNumber(game.player.y, 0);
          this.waterSpot = spot;
          this.totalTimer = 3.55 + Math.random() * 3.45;
          this.timer = this.totalTimer;
          this.bobberT = 0;
          this.status = spot.rare ? 'Deep water cast... wait for a strong bite.' : 'Line cast... wait for a bite.';
          this.actionLabel = 'Casting';
          setPlayerFishingPose(game, spot, 'casting');
          game.log?.('You cast into the water.');
          this.refreshPanel();
        },

        startFishingFromResource(node) {
          if (!node || !game.player) return false;
          const target = { x: safeNumber(node.x, game.player.x) + 0.5, y: safeNumber(node.y, game.player.y) + 0.5 };
          setPlayerFishingPose(game, target, 'waiting');
          this.actionLabel = 'Fishing resource node';
          this.refreshPanel();
          return true;
        },

        setPlayerFishingPose(target, action = 'waiting') {
          setPlayerFishingPose(game, target, action);
        },

        clearPlayerFishingPose() {
          clearPlayerFishingPose(game);
        },

        cancelFishing(message = 'Fishing cancelled.') {
          this.active = false;
          this.waterSpot = null;
          this.startPlayerX = null;
          this.startPlayerY = null;
          this.timer = 0;
          this.totalTimer = 0;
          this.bobberT = 0;
          this.status = message;
          this.actionLabel = 'Idle';
          clearPlayerFishingPose(game);
          game.log?.(this.status);
          this.refreshPanel();
        },

        cancelForMovement() {
          if (!this.active && !game.player?.fishing) return false;
          this.cancelFishing('Fishing cancelled by movement.');
          return true;
        },

        updatePlayerPose(dt) {
          const p = game.player;
          if (!p) return;
          if (this.poseReleaseTimer > 0) {
            this.poseReleaseTimer = Math.max(0, this.poseReleaseTimer - dt);
            if (this.poseReleaseTimer <= 0 && !this.active) clearPlayerFishingPose(game);
          }
          if (p.fishing) {
            p.fishingAnim = safeNumber(p.fishingAnim, 0) + dt;
            p.fishingCastTimer = Math.max(0, safeNumber(p.fishingCastTimer, 0) - dt);
            p.fishingReelTimer = Math.max(0, safeNumber(p.fishingReelTimer, 0) - dt);
          }
        },

        updateAquaticLife(dt) {
          const zone = zoneKey(game);
          this.ensureAquaticLife(zone, false);
          const fish = this.fishByZone[zone] || [];
          if (!fish.length) return;
          const player = game.player;
          for (let i = 0; i < fish.length; i++) {
            const f = fish[i];
            f.phase += dt * (4.2 + f.speed * 2.4);
            f.turnCooldown = Math.max(0, f.turnCooldown - dt);
            const dx = f.tx - f.x;
            const dy = f.ty - f.y;
            const dist = Math.hypot(dx, dy);
            const nearPlayer = player ? Math.hypot(player.x - f.x, player.y - f.y) < 1.35 : false;
            if (nearPlayer) {
              f.tx = f.x + (f.x - player.x) * 1.9 + (Math.random() - 0.5) * 1.2;
              f.ty = f.y + (f.y - player.y) * 1.9 + (Math.random() - 0.5) * 1.2;
              f.turnCooldown = 0.25;
            }
            if (dist < 0.08 || f.turnCooldown <= 0 || !isOpenWaterPosition(game, zone, Math.floor(f.tx), Math.floor(f.ty))) {
              const target = findWaterCandidate(game, zone, i * 41 + Math.floor(performance.now() * 0.01), 'open') || findWaterCandidate(game, zone, i * 43, 'hotspot');
              if (target) {
                f.tx = target.x + 0.2 + Math.random() * 0.6;
                f.ty = target.y + 0.2 + Math.random() * 0.6;
              }
              f.turnCooldown = 1.5 + Math.random() * 4.5;
            }
            const ndx = f.tx - f.x;
            const ndy = f.ty - f.y;
            const nd = Math.hypot(ndx, ndy) || 1;
            const step = Math.min(nd, f.speed * dt * (nearPlayer ? 1.9 : 1));
            const nx = f.x + (ndx / nd) * step;
            const ny = f.y + (ndy / nd) * step;
            if (isOpenWaterPosition(game, zone, Math.floor(nx), Math.floor(ny)) || isValidHotspotPosition(game, zone, Math.floor(nx), Math.floor(ny))) {
              f.vx = (ndx / nd) * f.speed;
              f.vy = (ndy / nd) * f.speed;
              f.x = nx;
              f.y = ny;
            } else {
              f.turnCooldown = 0;
            }
          }
        },

        update(dt) {
          if (!this.panel) this.panel = ensurePanel();
          this.updatePlayerPose(dt);
          if (game.started && game.currentZone !== 'dungeon') {
            const zone = zoneKey(game);
            this.updateAquaticLife(dt);
          }
          if (!game.player || !this.active) {
            this.refreshPanel();
            return;
          }

          this.bobberT += dt;
          const movedFromCast = Number.isFinite(this.startPlayerX) && Number.isFinite(this.startPlayerY)
            ? Math.hypot(game.player.x - this.startPlayerX, game.player.y - this.startPlayerY) > 0.055
            : false;
          const spotStillActive = this.waterSpot?.zone === zoneKey(game) && isCastTargetStillValid(game, this.waterSpot) && hasFishingRod(game);
          if (movedFromCast) {
            this.cancelFishing('Fishing cancelled by movement.');
            return;
          }
          if (!spotStillActive || game.player.meditating || !game.player.alive) {
            this.cancelFishing('Fishing cancelled. Too far from water.');
            return;
          }

          this.timer -= dt;
          const progress = 1 - Math.max(0, this.timer) / Math.max(0.001, this.totalTimer);
          if (progress < 0.17) {
            this.actionLabel = 'Casting';
            setPlayerFishingPose(game, this.waterSpot, 'casting');
          } else if (this.timer <= 0.78) {
            this.actionLabel = 'Bite — reeling';
            setPlayerFishingPose(game, this.waterSpot, 'reeling');
          } else {
            this.actionLabel = 'Waiting for bite';
            setPlayerFishingPose(game, this.waterSpot, 'waiting');
          }

          if (this.timer <= 0) this.resolveCatch();
          else this.refreshPanel();
        },

        resolveCatch() {
          const zone = zoneKey(game);
          const perfectWindow = Math.max(0, Math.min(1, 1 - Math.abs(this.timer) / 0.28));
          this.active = false;
          setPlayerFishingPose(game, this.waterSpot, 'reeling');
          const skillBonus = Math.min(0.20, (this.state.level - 1) * 0.013);
          const deepWaterBonus = this.waterSpot?.rare ? 0.10 : 0;
          const caught = Math.random() < 0.66 + skillBonus + deepWaterBonus;
          if (!caught) {
            this.status = 'The fish fought loose during the reel.';
            this.actionLabel = 'Fish escaped';
            game.log?.(this.status);
            this.gainXp(3);
            this.poseReleaseTimer = 0.22;
            this.refreshPanel();
            return;
          }

          // Phase 22: the authoritative Fishing level (resource-gathering skill,
          // single-source since Phase 19) gates which fish can bite; deep-water
          // casts unlock deepWaterOnly rare fish.
          const fishingLevel = game.resourceGatheringSystem?.skill?.('Fishing')?.level ?? this.state.level;
          const fish = weightedPick(eligibleFish(zoneFishTable(zone), fishingLevel, Boolean(this.waterSpot?.rare)));
          const result = game.grantEditorItem?.(fish.itemId, 1, { rarityKey: fish.rarityKey }) || { ok: false };
          if (!result.ok) {
            game.addMaterialItem?.({
              id: fish.itemId,
              itemId: fish.itemId,
              name: fish.name,
              category: fish.junk ? 'Fishing Junk' : 'Fish',
              rarityKey: fish.rarityKey,
              value: fish.junk ? 1 : 4,
              stack: 1,
              description: fish.junk ? 'Junk pulled from the water.' : 'A fish used for cooking.'
            });
          }

          this.state.catches += fish.junk ? 0 : 1;
          if (['blue', 'purple', 'gold'].includes(fish.rarityKey)) this.state.rareCatches += 1;
          if (perfectWindow > 0.7 && !fish.junk) this.state.perfectReels += 1;
          let fishXp = (this.waterSpot?.rare ? 5 : 0) + fish.xp + (perfectWindow > 0.7 ? 2 : 0);
          // Phase 19: first-time discovery bonus (once per fish species, tracked in
          // the shared resource-gathering discovered map) + data-driven rare-fish
          // bonus (fish.rareNodeXpBonus, populated for rare fish in Phases 22-23).
          let fishBonusNote = '';
          const rg = game.resourceGatheringSystem;
          if (!fish.junk && rg?.state) {
            if (!rg.state.discovered) rg.state.discovered = {};
            const fid = String(fish.itemId || fish.name || '').toLowerCase();
            if (fid && !rg.state.discovered[fid]) {
              rg.state.discovered[fid] = Date.now();
              const firstBonus = DR.Professions?.firstDiscoveryBonusForLevel
                ? DR.Professions.firstDiscoveryBonusForLevel(safeNumber(fish.levelRequired, 1))
                : 0;
              if (firstBonus > 0) { fishXp += firstBonus; fishBonusNote = ` First catch! +${firstBonus} EXP.`; }
            }
            const rareFishBonus = Math.max(0, Math.floor(safeNumber(fish.rareNodeXpBonus, 0)));
            if (rareFishBonus > 0) { fishXp += rareFishBonus; fishBonusNote += ` Rare +${rareFishBonus} EXP.`; }
          }
          this.gainXp(fishXp);
          // Phase 25: include the total Fishing EXP gained in the catch feedback
          // (fishBonusNote still breaks out first-catch/rare bonuses).
          this.status = fish.junk ? `Pulled up ${fish.name}.` : `Caught ${fish.name}. +${fishXp} Fishing EXP.${fishBonusNote}`;
          this.actionLabel = fish.junk ? 'Reeled in junk' : 'Catch landed';
          game.log?.(this.status);
          game.notifyExternalSystems?.('fish-caught', { itemId: fish.itemId, name: fish.name, rarityKey: fish.rarityKey, zoneId: zone, deepWater: Boolean(this.waterSpot?.rare) });
          game.spawnRing?.(game.player.x, game.player.y, fish.junk ? '#8b8b8b' : '#6bcff6', fish.junk ? 5 : 10);
          this.waterSpot = null;
          this.startPlayerX = null;
          this.startPlayerY = null;
          this.poseReleaseTimer = 0.32;
          this.refreshPanel();
        },

        gainXp(amount) {
          const xp = Math.max(1, Math.floor(safeNumber(amount, 1)));
          const rg = game.resourceGatheringSystem;
          if (rg?.gainSkillXp) {
            // Phase 19: the resource-gathering "Fishing" skill is the single source
            // of truth for Fishing level/xp. Grant there (it levels via the shared
            // Dark Woods profession table and logs level-ups), then mirror into this
            // system's own state so the fishing panel + catch-chance read the same
            // level. This retires the old divergent second Fishing counter/curve.
            rg.gainSkillXp('Fishing', xp, { items: [] }, true);
            this.syncLevelFromResource();
            rg.saveState?.();
            rg.refreshPanel?.();
          } else {
            // Fallback only (resource system unavailable): self-track on the shared curve.
            this.state.xp += xp;
            let needed = this.nextLevelXp();
            while (this.state.xp >= needed) {
              this.state.xp -= needed;
              this.state.level += 1;
              game.log?.(`Fishing level ${this.state.level}.`);
              needed = this.nextLevelXp();
            }
          }
          saveState(this.state);
          game.renderSkillsPanel?.();
          game.professionSystem?.render?.();
        },

        // Mirror the authoritative resource-gathering "Fishing" skill into this
        // system's own state (level/xp), so the fishing panel and catch-chance math
        // stay in lockstep with the single source of truth.
        syncLevelFromResource() {
          const sk = game.resourceGatheringSystem?.skill?.('Fishing');
          if (sk) { this.state.level = sk.level; this.state.xp = sk.xp; }
        },

        nextLevelXp() {
          const shared = DR.Professions?.nextLevelXp;
          if (typeof shared === 'function') return shared(this.state.level);
          return Math.max(65, Math.floor(80 * Math.pow(Math.max(1, this.state.level), 1.32)));
        },

        refreshPanel() {
          if (!this.panel) return;
          this.syncLevelFromResource();
          const statusNode = this.panel.querySelector('[data-fishing-status]');
          const xpNode = this.panel.querySelector('[data-fishing-xp]');
          const actionNode = this.panel.querySelector('[data-fishing-action]');
          const metaNode = this.panel.querySelector('[data-fishing-meta]');
          const needed = this.nextLevelXp();
          const pct = Math.max(0, Math.min(100, (this.state.xp / needed) * 100));
          if (statusNode) statusNode.textContent = this.active ? `${this.status} ${Math.max(1, Math.ceil(this.timer))}s` : this.status;
          if (xpNode) xpNode.style.width = `${pct}%`;
          if (actionNode) actionNode.textContent = `Action: ${this.actionLabel}`;
          if (metaNode) metaNode.textContent = `Level ${this.state.level} · ${this.state.xp}/${needed} XP · ${this.state.catches} fish · ${this.state.rareCatches} rare · ${this.state.perfectReels} clean reels`;
        },

        renderFish(context, fish, now) {
          const tile = game.tileAt?.(fish.x, fish.y);
          if (!tile || tile.type !== WATER()) return;
          const s = game.worldToScreen(fish.x, fish.y, safeNumber(tile.elev, 0) + 0.07);
          const swim = Math.sin(fish.phase) * 2.2;
          const angle = Math.atan2(fish.vy || 0.01, fish.vx || 0.01);
          const len = 24 * fish.length;
          const width = 7 * Math.max(0.75, fish.length * 2.1);
          const opacity = fish.visible ? 0.42 : 0.22;

          context.save();
          context.translate(s.x, s.y + Math.sin(now * 1.8 + fish.phase) * 1.2);
          context.rotate(angle * 0.35);
          context.globalAlpha = opacity;
          context.fillStyle = fish.color;
          context.beginPath();
          context.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#d7fbff';
          context.globalAlpha = opacity * 0.42;
          context.beginPath();
          context.ellipse(2, -1, len * 0.45, width * 0.38, 0, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = opacity * 0.86;
          context.fillStyle = fish.color;
          context.beginPath();
          context.moveTo(-len - 3, 0);
          context.lineTo(-len - 11, -width - swim * 0.3);
          context.lineTo(-len - 7, 0);
          context.lineTo(-len - 11, width + swim * 0.3);
          context.closePath();
          context.fill();
          context.globalAlpha = opacity * 0.55;
          context.strokeStyle = '#c9f5ff';
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(len * 0.2, -width * 0.2);
          context.quadraticCurveTo(-len * 0.1, swim, -len * 0.54, width * 0.15);
          context.stroke();
          context.restore();
        },

        renderHotspot(context, spot, now) {
          const tile = game.map?.[spot.tileY]?.[spot.tileX];
          if (!tile || tile.type !== WATER()) return;
          const s = game.worldToScreen(spot.x, spot.y, safeNumber(tile.elev, 0) + 0.1);
          const phase = now + spot.x * 0.13 + spot.y * 0.07 + safeNumber(spot.pulse, 0);
          context.save();
          context.globalAlpha = spot.rare ? 0.84 : 0.66;
          context.strokeStyle = spot.rare ? '#d8fbff' : '#77d5e8';
          context.lineWidth = spot.rare ? 2.4 : 1.8;
          for (let i = 0; i < 4; i++) {
            const r = 8 + i * 6 + Math.sin(phase * 2 + i) * 1.8;
            context.beginPath();
            context.ellipse(s.x, s.y + i * 1.6, r, r * 0.35, 0, 0, Math.PI * 2);
            context.stroke();
          }
          for (let i = 0; i < 7; i++) {
            const rise = ((phase * 18 + i * 8) % 30);
            const ox = Math.sin(phase + i * 1.5) * 12;
            context.globalAlpha = 0.60 - rise / 70;
            context.fillStyle = spot.rare ? '#edfefe' : '#b7efff';
            context.beginPath();
            context.arc(s.x + ox, s.y - rise, 1.7 + (i % 2), 0, Math.PI * 2);
            context.fill();
          }
          context.restore();
        },

        renderFishingLine(context, now) {
          if (!this.active || !this.waterSpot || !game.player) return;
          const p = game.player;
          const action = p.fishingAction || 'waiting';
          const bobberWorld = getFishingBobberWorld(game, this);
          const lineStart = getFishingLineStartScreen(game, p, this.waterSpot, action, now);
          const bobber = worldFishingPointToScreen(game, bobberWorld);
          if (!lineStart || !bobber) return;
          const linePixels = Math.hypot(lineStart.x - bobber.x, lineStart.y - bobber.y);
          const cameraZoom = Math.max(0.1, safeNumber(game.camera?.zoom, 1));
          const maxReasonableLinePixels = Math.max(260, 12 * safeNumber(CONFIG.TILE_W, 104) * cameraZoom);
          if (!Number.isFinite(linePixels) || linePixels > maxReasonableLinePixels) {
            const debug = game.debugOverlayOpen || DR.CONFIG?.DEBUG;
            if (debug && performance.now() - safeNumber(this.lastImpossibleLineWarningAt, 0) > 2000) {
              this.lastImpossibleLineWarningAt = performance.now();
              console.warn('[Dream Realms] Fishing line projection rejected an impossible endpoint distance.');
            }
            return;
          }
          const bend = action === 'reeling' ? Math.sin(now * 12) * 4 - 6 : Math.sin(now * 3.5) * 2;
          const bob = Math.sin(this.bobberT * (action === 'reeling' ? 9 : 5)) * (action === 'reeling' ? 6 : 3);

          context.save();
          context.strokeStyle = 'rgba(22, 17, 11, 0.46)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(lineStart.x, lineStart.y + 1);
          context.quadraticCurveTo((lineStart.x + bobber.x) / 2, Math.min(lineStart.y, bobber.y) - 19 + bend, bobber.x, bobber.y + bob + 1);
          context.stroke();
          context.strokeStyle = 'rgba(238, 229, 186, 0.72)';
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(lineStart.x, lineStart.y);
          context.quadraticCurveTo((lineStart.x + bobber.x) / 2, Math.min(lineStart.y, bobber.y) - 20 + bend, bobber.x, bobber.y + bob);
          context.stroke();

          context.globalAlpha = action === 'reeling' ? 0.92 : 0.76;
          context.strokeStyle = this.waterSpot.rare ? '#d4f7ff' : '#8bdcff';
          context.beginPath();
          context.ellipse(bobber.x, bobber.y + 3 + bob, 13 + (action === 'reeling' ? 5 : 0), 5 + (action === 'reeling' ? 3 : 0), 0, 0, Math.PI * 2);
          context.stroke();

          if (action === 'reeling') {
            for (let i = 0; i < 5; i++) {
              context.globalAlpha = 0.42 - i * 0.05;
              context.strokeStyle = '#cff7ff';
              context.beginPath();
              context.arc(bobber.x, bobber.y + bob, 8 + i * 5 + Math.sin(now * 9 + i) * 2, 0, Math.PI * 2);
              context.stroke();
            }
          }

          context.globalAlpha = 1;
          context.fillStyle = '#e8f7ff';
          context.beginPath();
          context.arc(bobber.x, bobber.y - 2 + bob, 3.5, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#db5147';
          context.fillRect(bobber.x - 3, bobber.y - 6 + bob, 6, 3);
          context.restore();
        },

        render(context) {
          if (!game.started) return;
          // Phase 23: allow fishing rendering inside the Silk Web Cavern dungeon
          // (its floors have carved cave pools); other dungeons stay excluded.
          const inSilkWeb = game.currentZone === 'dungeon' && String(game.activeDungeon?.id || '') === 'silk_web_cavern';
          if (game.currentZone === 'dungeon' && !inSilkWeb) return;
          const now = performance.now() * 0.001;
          const zone = zoneKey(game);
          // Ambient swimming fish are only spawned in the open overworld/cave
          // waters, not the small carved dungeon pools; the fishing line still
          // draws so casting reads correctly in the dungeon.
          if (!inSilkWeb) {
            this.ensureAquaticLife(zone, false);
            for (const fish of this.fishByZone[zone] || []) this.renderFish(context, fish, now);
          }
          this.renderFishingLine(context, now);
        }
      };

      runtime.bindInput();
      runtime.refreshPanel();
      game.fishingSystem = runtime;
      return runtime;
    }
  });
})();
