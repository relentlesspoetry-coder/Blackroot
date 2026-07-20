// Dream Realms world serializer
// Owns conversion between runtime world arrays and saveable JSON payloads.
// Pass 43 adds formal save-schema migration and compatibility guards.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const SCHEMA = 'dream-realms-world-save-v3';
  const LEGACY_SCHEMA_V1 = 'dream-realms-world-save-v1';
  const LEGACY_SCHEMA_V2 = 'dream-realms-world-save-v2';
  const SAVE_FORMAT_VERSION = 3;
  const BUILD_PASS = 66;
  const SUPPORTED_SCHEMAS = new Set([SCHEMA, LEGACY_SCHEMA_V1, LEGACY_SCHEMA_V2]);

  function cloneJson(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function cloneTile(tile) {
    if (!tile) return null;
    const out = {
      type: Number(tile.type) || 0,
      elev: Number(tile.elev) || 0,
      blocked: Boolean(tile.blocked)
    };
    if (Number.isFinite(Number(tile.waterDepth))) out.waterDepth = Number(tile.waterDepth);
    if (Number.isFinite(Number(tile.waterSurfaceElev))) out.waterSurfaceElev = Number(tile.waterSurfaceElev);
    if (Number.isFinite(Number(tile.waterBottomElev))) out.waterBottomElev = Number(tile.waterBottomElev);
    if (Number.isFinite(Number(tile.waterBodySize))) out.waterBodySize = Number(tile.waterBodySize);
    if (typeof tile.waterBodyKind === 'string' && tile.waterBodyKind) out.waterBodyKind = tile.waterBodyKind;
    return out;
  }

  function cloneTileGrid(grid) {
    if (!Array.isArray(grid)) return [];
    return grid.map(row => Array.isArray(row) ? row.map(cloneTile) : []);
  }

  function cloneObjectGrid(grid) {
    if (!Array.isArray(grid)) return [];
    return grid.map(row => Array.isArray(row) ? row.map(cell => cell ? cloneJson(cell) : null) : []);
  }

  function emptyObjectGrid(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  }

  function normalizeTileGrid(grid) {
    if (!Array.isArray(grid)) return null;
    return grid.map(row => Array.isArray(row) ? row.map(tile => {
      if (!tile) return { type: 0, elev: 0, blocked: true };
      return cloneTile(tile) || { type: 0, elev: 0, blocked: true };
    }) : []);
  }

  function normalizeObjectGrid(grid) {
    if (!Array.isArray(grid)) return null;
    return grid.map(row => Array.isArray(row) ? row.map(cell => cell ? cloneJson(cell) : null) : []);
  }

  function objectOr(value, fallback = {}) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  }

  function cloneObjectOr(value, fallback = {}) {
    return cloneJson(objectOr(value, fallback));
  }

  // V0.18.79 (Roadmap Item 10 - save migration): shipped-content catalogs (items, spells,
  // loot tables, recipes, quests, npcs, mobs, ...) are snapshotted INTO every world save by
  // serialize(), and the character autosave writes a world save on its timer. A plain restore
  // (cloneObjectOr) lets that STALE snapshot fully shadow the shipped catalog, so any content
  // added in a newer build (e.g. new gear) never reaches an existing save/autosave.
  //
  // Fix: merge the current shipped catalog UNDERNEATH the saved snapshot. Every shipped id is
  // present (new content appears), while any saved entry still WINS on id collision, so editor
  // customizations and genuinely custom (save-only) ids are preserved untouched. This is purely
  // additive for new shipped ids - it never mutates or drops an existing saved entry, so it
  // cannot regress an existing save or an editor user's edits. (Balance changes to an existing
  // shipped id, and new drops added to a pre-existing loot table, still do not retroactively
  // override the saved copy - saved wins on collision - which is the safe, non-destructive
  // default; a deliberate shipped-wins refresh would be a separate opt-in.)
  function mergeShippedCatalog(savedValue, shipped) {
    const base = objectOr(shipped, {});
    const saved = objectOr(savedValue, null);
    if (!saved) return cloneJson(base);
    return cloneJson(Object.assign({}, base, saved));
  }

  // V0.20.83: these must read the DARK WOODS SLOT BY NAME, never the `overworldMap` accessor.
  //
  // The world save schema stores exactly one overworld, under the key `dark_woods`. Since V0.20.80
  // `game.overworldMap` is an accessor onto whichever zone is ACTIVE - so an autosave that fired while
  // the player stood in Ashen Valley serialised Ashen Valley's 450x450 terrain into the save's
  // dark_woods slot, permanently replacing the starting zone. Confirmed: a clean boot loaded a
  // "Dark Woods" that was 450 wide.
  //
  // This is the risk the accessor approach carries - existing code saying "overworldMap" meant "Dark
  // Woods", and now means "the active zone". Every site that means the STARTING zone specifically has
  // to say so. The fallbacks below are kept for a game whose registry has not populated yet, but they
  // are only reached when the named slot is genuinely absent.
  function getOverworldMap(game) {
    const named = game.overworldZoneSlot?.('dark_woods')?.map;
    if (Array.isArray(named) && named.length) return named;
    return (game.currentZone === 'overworld' ? game.map : null) || [];
  }

  function getOverworldObjects(game) {
    const named = game.overworldZoneSlot?.('dark_woods')?.objects;
    if (Array.isArray(named) && named.length) return named;
    return (game.currentZone === 'overworld' ? game.objects : null) || [];
  }

  function getCaveMap(game) {
    return game.caveMap || (game.currentZone === 'cave' ? game.map : null) || [];
  }

  function getCaveObjects(game) {
    return game.caveObjects || (game.currentZone === 'cave' ? game.objects : null) || [];
  }

  function defaultZoneProperties(zoneId) {
    if (zoneId === 'mossfang_cave') return { levelMin: 1, levelMax: 8, weather: 'none', biome: 'cave', elevation: 120, music: 'cave_ambience' };
    return { levelMin: 1, levelMax: 10, weather: 'temperate_forest', biome: 'temperate_forest', elevation: 850, music: 'dark_woods' };
  }

  function defaultCaveMeta() {
    return { name: 'Mossfang Cave', theme: 'mossfang', size: 'big', floors: 1, mobFamily: 'cave_wolves', notes: 'Starter cave attached to Dark Woods.' };
  }

  function validateTileGridShape(grid, name, size) {
    if (!Array.isArray(grid)) return { ok: false, error: `${name} tile grid is not an array.` };
    if (grid.length < size) return { ok: false, error: `${name} tile grid has ${grid.length} rows; expected ${size}.` };
    for (let y = 0; y < size; y++) {
      if (!Array.isArray(grid[y]) || grid[y].length < size) {
        return { ok: false, error: `${name} tile row ${y} is missing or too short.` };
      }
      for (let x = 0; x < size; x++) {
        const tile = grid[y][x];
        if (!tile || typeof tile !== 'object') return { ok: false, error: `${name} tile ${x},${y} is missing.` };
        if (!Number.isFinite(Number(tile.type))) return { ok: false, error: `${name} tile ${x},${y} has invalid type.` };
      }
    }
    return { ok: true };
  }

  function validateObjectGridShape(grid, name, size) {
    if (!Array.isArray(grid)) return { ok: false, error: `${name} object grid is not an array.` };
    if (grid.length < size) return { ok: false, error: `${name} object grid has ${grid.length} rows; expected ${size}.` };
    for (let y = 0; y < size; y++) {
      if (!Array.isArray(grid[y]) || grid[y].length < size) {
        return { ok: false, error: `${name} object row ${y} is missing or too short.` };
      }
    }
    return { ok: true };
  }

  function normalizeZonePayload(zone, defaults, size, migrations) {
    if (!zone || typeof zone !== 'object') return { ok: false, error: `${defaults.name} zone payload is missing.` };
    if (!Array.isArray(zone.tiles)) return { ok: false, error: `${defaults.name} zone is missing tile grid.` };

    const next = cloneJson(zone);
    next.id = String(next.id || defaults.id);
    next.name = String(next.name || defaults.name);
    next.type = String(next.type || defaults.type);
    if (defaults.parentZone && !next.parentZone) next.parentZone = defaults.parentZone;
    next.width = Number(next.width) || size;
    next.height = Number(next.height) || size;

    if (!Array.isArray(next.objects)) {
      next.objects = emptyObjectGrid(size);
      migrations.push(`${defaults.id}: created missing object grid`);
    }
    for (const key of ['attributes', 'resources', 'events', 'npcs', 'mobSpawns', 'dungeonMarkers']) {
      if (!next[key] || typeof next[key] !== 'object' || Array.isArray(next[key])) {
        next[key] = {};
        migrations.push(`${defaults.id}: initialized ${key}`);
      }
    }
    if (!('spawnPoint' in next)) next.spawnPoint = null;
    if (!next.properties || typeof next.properties !== 'object' || Array.isArray(next.properties)) {
      next.properties = defaultZoneProperties(defaults.id);
      migrations.push(`${defaults.id}: initialized properties`);
    } else {
      next.properties = { ...defaultZoneProperties(defaults.id), ...next.properties };
    }
    if (defaults.id === 'dark_woods' && !Array.isArray(next.caveEntrances)) {
      next.caveEntrances = [];
      migrations.push('dark_woods: initialized caveEntrances');
    }
    if (defaults.id === 'mossfang_cave') {
      if (!next.caveEditorMeta || typeof next.caveEditorMeta !== 'object' || Array.isArray(next.caveEditorMeta)) {
        next.caveEditorMeta = defaultCaveMeta();
        migrations.push('mossfang_cave: initialized caveEditorMeta');
      }
      if (!next.caveExit || typeof next.caveExit !== 'object' || Array.isArray(next.caveExit)) {
        next.caveExit = { x: 100, y: 66, radius: 5.2 };
        migrations.push('mossfang_cave: initialized caveExit');
      }
    }
    return { ok: true, zone: next };
  }

  function migratePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, error: 'World payload is missing.' };
    }

    const incomingSchema = payload.schema || LEGACY_SCHEMA_V1;
    if (!SUPPORTED_SCHEMAS.has(incomingSchema)) {
      return { ok: false, error: `Unsupported world schema: ${payload.schema || 'none'}.` };
    }

    const next = cloneJson(payload);
    const migrations = [];
    const warnings = [];
    // V0.17.41 Phase 2: Dark Woods (overworld) and Mossfang Cave no longer share
    // one global size. Prefer each zone's own already-serialized width/tiles
    // length (self-describing), falling back to the legacy shared mapSize field
    // for pre-Phase-2 saves where the two were always identical, and finally to
    // each zone's current-build default if the field is entirely absent.
    const legacySize = Number(next.mapSize) || (DR.CONFIG && DR.CONFIG.MAP_SIZE) || 200;
    const overworldSize = Number(next.zones?.dark_woods?.width)
      || Number(next.zones?.dark_woods?.tiles?.length)
      || (DR.CONFIG && DR.CONFIG.OVERWORLD_MAP_SIZE)
      || legacySize;
    const caveSize = Number(next.zones?.mossfang_cave?.width)
      || Number(next.zones?.mossfang_cave?.tiles?.length)
      || (DR.CONFIG && DR.CONFIG.MAP_SIZE)
      || legacySize;

    if (incomingSchema !== SCHEMA) {
      next.previousSchema = incomingSchema;
      next.schema = SCHEMA;
      migrations.push(`schema ${incomingSchema} -> ${SCHEMA}`);
    }

    if (Number(next.saveFormatVersion) !== SAVE_FORMAT_VERSION) {
      next.previousSaveFormatVersion = Number(next.saveFormatVersion) || 1;
      next.saveFormatVersion = SAVE_FORMAT_VERSION;
      migrations.push(`format ${next.previousSaveFormatVersion} -> ${SAVE_FORMAT_VERSION}`);
    }

    next.game = String(next.game || 'Dream Realms');
    next.worldName = String(next.worldName || 'Dream Realms');
    next.version = String(next.version || '0.13.13');
    next.createdFrom = String(next.createdFrom || 'Dream Realms V0.13.13 Encounter Balance Spawn Discipline Pass');
    next.lastMigratedBy = 'Dream Realms V0.13.13 Encounter Balance Spawn Discipline Pass';
    next.lastMigratedAt = new Date().toISOString();
    const incomingBuildPass = Number(next.buildPass) || 0;
    if (incomingBuildPass !== BUILD_PASS) {
      if (incomingBuildPass) next.previousBuildPass = incomingBuildPass;
      next.buildPass = BUILD_PASS;
      migrations.push(`build pass ${incomingBuildPass || 'unknown'} -> ${BUILD_PASS}`);
    } else {
      next.buildPass = BUILD_PASS;
    }
    // Legacy field retained for backward compatibility (pre-Phase-2 saves always had
    // dark_woods and mossfang_cave at the same size). New code should read
    // next.zoneMapSizes for the authoritative per-zone size instead.
    next.mapSize = overworldSize;
    next.zoneMapSizes = { dark_woods: overworldSize, mossfang_cave: caveSize };
    if (!['overworld', 'cave', 'dungeon'].includes(next.activeRuntimeZone)) next.activeRuntimeZone = 'overworld';

    if (!next.zones || typeof next.zones !== 'object') return { ok: false, error: 'World payload does not include zones.' };
    const dark = normalizeZonePayload(next.zones.dark_woods, { id: 'dark_woods', name: 'Dark Woods', type: 'overworld' }, overworldSize, migrations);
    if (!dark.ok) return dark;
    const cave = normalizeZonePayload(next.zones.mossfang_cave, { id: 'mossfang_cave', name: 'Mossfang Cave', type: 'cave', parentZone: 'dark_woods' }, caveSize, migrations);
    if (!cave.ok) return cave;
    next.zones.dark_woods = dark.zone;
    next.zones.mossfang_cave = cave.zone;

    const topLevelDefaults = {
      quests: () => DR.QUEST_BY_ID || {},
      resourceTypes: () => DR.RESOURCE_BY_ID || {},
      professions: () => DR.PROFESSION_BY_ID || {},
      craftingStations: () => DR.CRAFTING_STATION_BY_ID || {},
      recipes: () => DR.CRAFTING_RECIPE_BY_ID || {},
      npcs: () => DR.NPC_DRAFT_BY_ID || {},
      mobs: () => DR.MOB_DRAFT_BY_ID || {},
      bosses: () => DR.BOSS_BY_ID || {},
      mobSpawnGroups: () => DR.MOB_SPAWN_BY_ID || {},
      dungeons: () => DR.DUNGEON_BY_ID || {},
      puzzles: () => DR.PUZZLE_BY_ID || {},
      items: () => DR.ITEM_BY_ID || {},
      lootTables: () => DR.LOOT_TABLE_BY_ID || {},
      spells: () => DR.SPELL_BY_ID || {},
      classSpellSlots: () => DR.DEFAULT_CLASS_SPELL_SLOTS || {}
    };
    for (const [key, getter] of Object.entries(topLevelDefaults)) {
      if (!next[key] || typeof next[key] !== 'object' || Array.isArray(next[key])) {
        next[key] = cloneJson(getter());
        migrations.push(`initialized ${key}`);
      }
    }

    if (!next.worldTime || typeof next.worldTime !== 'object' || Array.isArray(next.worldTime)) {
      next.worldTime = DR.TimeCycle?.safeClockState ? DR.TimeCycle.safeClockState(null) : { version: 1, day: 1, minuteOfDay: 450, secondsPerGameDay: 14400 };
      migrations.push('initialized worldTime');
    } else if (DR.TimeCycle?.safeClockState) {
      next.worldTime = DR.TimeCycle.safeClockState(next.worldTime);
    }

    if (!next.worldWeather || typeof next.worldWeather !== 'object' || Array.isArray(next.worldWeather)) {
      next.worldWeather = DR.Weather?.safeWeatherState ? DR.Weather.safeWeatherState(null) : { version: 1, biome: 'temperate_forest', season: 'spring', elevation: 850, currentWeather: 'clear' };
      migrations.push('initialized worldWeather');
    } else if (DR.Weather?.safeWeatherState) {
      next.worldWeather = DR.Weather.safeWeatherState(next.worldWeather);
    }

    for (const key of ['questRuntime', 'eventRuntime', 'chestRuntime', 'resourceRuntime', 'craftingRuntime', 'npcRuntime', 'dungeonRuntime', 'puzzleRuntime', 'mobRuntime']) {
      if (next[key] != null && (typeof next[key] !== 'object' || Array.isArray(next[key]))) {
        next[key] = null;
        migrations.push(`discarded invalid ${key}`);
      } else if (!(key in next)) {
        next[key] = null;
        migrations.push(`initialized ${key}`);
      }
    }

    // Phase 1 (Descriptor & Registry Normalization): descriptor-version
    // migration guard. Logging only - never mutates or blocks the load.
    // Flags saves written against an older/newer descriptor catalog and
    // surfaces quest runtime ids that no longer resolve to current content.
    try {
      const currentDescriptorVersion = DR.Registry?.DESCRIPTOR_VERSION;
      const incomingDescriptorVersion = payload.descriptorSchemaVersion;
      if (currentDescriptorVersion != null && incomingDescriptorVersion != null && incomingDescriptorVersion !== currentDescriptorVersion) {
        warnings.push(`World save was written with descriptor schema v${incomingDescriptorVersion}, current is v${currentDescriptorVersion}.`);
      }
      next.descriptorSchemaVersion = currentDescriptorVersion || incomingDescriptorVersion || 1;
      if (next.questRuntime && DR.Registry?.auditRuntimeReferences) {
        const questIds = [
          ...Object.keys(next.questRuntime.active || {}),
          ...Object.keys(next.questRuntime.completed || {}),
          ...Object.keys(next.questRuntime.discovered || {})
        ];
        DR.Registry.auditRuntimeReferences('quest', questIds, 'world save quest runtime');
      }
    } catch (_) { /* validation must never block world load */ }

    const previousHistory = Array.isArray(next.migrationHistory) ? next.migrationHistory : [];
    if (migrations.length) {
      next.migrationHistory = previousHistory.concat([{ at: next.lastMigratedAt, by: next.lastMigratedBy, changes: migrations.slice() }]).slice(-12);
    } else {
      next.migrationHistory = previousHistory;
    }

    if (incomingSchema === LEGACY_SCHEMA_V1) {
      warnings.push('Imported legacy v1 save. Missing editor/runtime sections were backfilled with current defaults.');
    }

    return {
      ok: true,
      payload: next,
      migrated: migrations.length > 0 || incomingSchema !== payload.schema,
      migrations,
      warnings,
      schema: next.schema,
      saveFormatVersion: next.saveFormatVersion
    };
  }

  function validateNormalizedPayload(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'World payload is missing.' };
    if (payload.schema !== SCHEMA) return { ok: false, error: `Unsupported world schema after migration: ${payload.schema || 'none'}.` };
    if (Number(payload.saveFormatVersion) !== SAVE_FORMAT_VERSION) return { ok: false, error: `Unsupported save format version: ${payload.saveFormatVersion || 'none'}.` };
    if (!payload.zones || !payload.zones.dark_woods || !payload.zones.mossfang_cave) {
      return { ok: false, error: 'World payload does not include Dark Woods and Mossfang Cave.' };
    }
    if (!Array.isArray(payload.zones.dark_woods.tiles) || !Array.isArray(payload.zones.mossfang_cave.tiles)) {
      return { ok: false, error: 'World payload is missing tile grids.' };
    }
    const overworldSize = Number(payload.zoneMapSizes?.dark_woods) || Number(payload.zones.dark_woods.width) || Number(payload.mapSize) || (DR.CONFIG && DR.CONFIG.OVERWORLD_MAP_SIZE) || 200;
    const caveSize = Number(payload.zoneMapSizes?.mossfang_cave) || Number(payload.zones.mossfang_cave.width) || (DR.CONFIG && DR.CONFIG.MAP_SIZE) || 200;
    const darkTiles = validateTileGridShape(payload.zones.dark_woods.tiles, 'Dark Woods', overworldSize);
    if (!darkTiles.ok) return darkTiles;
    const caveTiles = validateTileGridShape(payload.zones.mossfang_cave.tiles, 'Mossfang Cave', caveSize);
    if (!caveTiles.ok) return caveTiles;
    const darkObjects = validateObjectGridShape(payload.zones.dark_woods.objects, 'Dark Woods', overworldSize);
    if (!darkObjects.ok) return darkObjects;
    const caveObjects = validateObjectGridShape(payload.zones.mossfang_cave.objects, 'Mossfang Cave', caveSize);
    if (!caveObjects.ok) return caveObjects;
    return { ok: true };
  }

  DR.WorldSerializer = {
    schema: SCHEMA,
    legacySchema: LEGACY_SCHEMA_V1,
    saveFormatVersion: SAVE_FORMAT_VERSION,
    buildPass: BUILD_PASS,

    serialize(game) {
      const now = new Date().toISOString();
      // V0.17.41 Phase 2: Dark Woods (overworld) and Mossfang Cave (cave) are no
      // longer guaranteed to be the same size, so each zone stamps its own real
      // grid length instead of sharing one global size.
      const overworldGrid = getOverworldMap(game);
      const caveGrid = getCaveMap(game);
      const overworldSize = overworldGrid.length || (DR.CONFIG && DR.CONFIG.OVERWORLD_MAP_SIZE) || 200;
      const caveSize = caveGrid.length || (DR.CONFIG && DR.CONFIG.MAP_SIZE) || 200;

      return {
        schema: SCHEMA,
        saveFormatVersion: SAVE_FORMAT_VERSION,
        descriptorSchemaVersion: DR.Registry?.DESCRIPTOR_VERSION || 1,
        buildPass: BUILD_PASS,
        game: 'Dream Realms',
        worldName: 'Dream Realms',
        version: window.DREAM_REALMS_VERSION || '0.14.67',
        createdFrom: window.DREAM_REALMS_BUILD_NAME || 'Dream Realms V0.14.67 Party Logout Disband Fix Pass',
        savedAt: now,
        activeRuntimeZone: game.currentZone || 'overworld',
        worldTime: cloneJson(game.serializeWorldTime?.() || null),
        worldWeather: cloneJson(game.serializeWeather?.() || null),
        mapSize: overworldSize,
        zoneMapSizes: { dark_woods: overworldSize, mossfang_cave: caveSize },
        layeredMaps: cloneJson(game.serializeLayeredMaps?.() || {}),
        quests: cloneJson(game.editorQuests || DR.QUEST_BY_ID || {}),
        resourceTypes: cloneJson(game.editorResourceTypes || DR.RESOURCE_BY_ID || {}),
        professions: cloneJson(game.editorProfessions || DR.PROFESSION_BY_ID || {}),
        craftingStations: cloneJson(game.editorCraftingStations || DR.CRAFTING_STATION_BY_ID || {}),
        recipes: cloneJson(game.editorRecipes || DR.CRAFTING_RECIPE_BY_ID || {}),
        npcs: cloneJson(game.editorNpcDefinitions || DR.NPC_DRAFT_BY_ID || {}),
        mobs: cloneJson(game.editorMobDefinitions || DR.MOB_DRAFT_BY_ID || {}),
        bosses: cloneJson(game.editorBosses || DR.BOSS_BY_ID || {}),
        mobSpawnGroups: cloneJson(game.editorMobSpawnDefinitions || DR.MOB_SPAWN_BY_ID || {}),
        dungeons: cloneJson(game.editorDungeons || DR.DUNGEON_BY_ID || {}),
        puzzles: cloneJson(game.editorPuzzles || DR.PUZZLE_BY_ID || {}),
        items: cloneJson(game.editorItems || DR.ITEM_BY_ID || {}),
        lootTables: cloneJson(game.editorLootTables || DR.LOOT_TABLE_BY_ID || {}),
        spells: cloneJson(game.editorSpells || DR.SPELL_BY_ID || {}),
        classSpellSlots: cloneJson(game.classSpellSlots || {}),
        questRuntime: cloneJson(game.questSystem?.serializeState ? game.questSystem.serializeState() : (game.questRuntimeState || null)),
        eventRuntime: cloneJson(game.eventSystem?.serializeState ? game.eventSystem.serializeState() : (game.eventRuntimeState || null)),
        chestRuntime: cloneJson(game.chestSystem?.serializeState ? game.chestSystem.serializeState() : (game.chestRuntimeState || null)),
        resourceRuntime: cloneJson(game.resourceGatheringSystem?.serializeState ? game.resourceGatheringSystem.serializeState() : (game.resourceRuntimeState || null)),
        craftingRuntime: cloneJson(game.craftingSystem?.serializeState ? game.craftingSystem.serializeState() : (game.craftingRuntimeState || null)),
        npcRuntime: cloneJson(game.npcSystem?.serializeState ? game.npcSystem.serializeState() : (game.npcRuntimeState || null)),
        dungeonRuntime: cloneJson(game.dungeonSystem?.serializeState ? game.dungeonSystem.serializeState() : (game.dungeonRuntimeState || null)),
        puzzleRuntime: cloneJson(game.puzzleSystem?.serializeState ? game.puzzleSystem.serializeState() : (game.puzzleRuntimeState || null)),
        mobRuntime: cloneJson(game.mobSpawnSystem?.serializeState ? game.mobSpawnSystem.serializeState() : (game.mobSpawnRuntimeState || null)),
        zones: {
          dark_woods: {
            id: 'dark_woods',
            name: 'Dark Woods',
            type: 'overworld',
            width: overworldSize,
            height: overworldSize,
            tiles: cloneTileGrid(getOverworldMap(game)),
            objects: cloneObjectGrid(getOverworldObjects(game)),
            attributes: cloneJson(game.editorAttributes?.dark_woods || {}),
            resources: cloneJson(game.editorResources?.dark_woods || {}),
            events: cloneJson(game.editorEvents?.dark_woods || {}),
            npcs: cloneJson(game.editorNpcs?.dark_woods || {}),
            mobSpawns: cloneJson(game.editorMobSpawns?.dark_woods || {}),
            dungeonMarkers: cloneJson(game.editorDungeonMarkers?.dark_woods || {}),
            spawnPoint: cloneJson(game.editorSpawnPoints?.dark_woods || null),
            properties: cloneJson(game.zoneProperties?.dark_woods || defaultZoneProperties('dark_woods')),
            caveEntrances: cloneJson(game.caveEntrances || [])
          },
          mossfang_cave: {
            id: 'mossfang_cave',
            name: 'Mossfang Cave',
            type: 'cave',
            parentZone: 'dark_woods',
            width: caveSize,
            height: caveSize,
            tiles: cloneTileGrid(getCaveMap(game)),
            objects: cloneObjectGrid(getCaveObjects(game)),
            attributes: cloneJson(game.editorAttributes?.mossfang_cave || {}),
            resources: cloneJson(game.editorResources?.mossfang_cave || {}),
            events: cloneJson(game.editorEvents?.mossfang_cave || {}),
            npcs: cloneJson(game.editorNpcs?.mossfang_cave || {}),
            mobSpawns: cloneJson(game.editorMobSpawns?.mossfang_cave || {}),
            dungeonMarkers: cloneJson(game.editorDungeonMarkers?.mossfang_cave || {}),
            spawnPoint: cloneJson(game.editorSpawnPoints?.mossfang_cave || null),
            properties: cloneJson(game.zoneProperties?.mossfang_cave || defaultZoneProperties('mossfang_cave')),
            caveEditorMeta: cloneJson(game.caveEditorMeta?.mossfang_cave || null),
            caveExit: cloneJson(game.caveExit || null)
          }
        }
      };
    },

    migrate(payload) {
      const migration = migratePayload(payload);
      if (!migration.ok) return migration;
      const validation = validateNormalizedPayload(migration.payload);
      if (!validation.ok) return validation;
      return migration;
    },

    validate(payload) {
      const migration = this.migrate(payload);
      if (!migration.ok) return migration;
      return { ok: true, migrated: migration.migrated, migrations: migration.migrations, warnings: migration.warnings, payload: migration.payload };
    },

    apply(game, payload) {
      const migration = this.migrate(payload);
      if (!migration.ok) return migration;
      const migratedPayload = migration.payload;

      const overworld = migratedPayload.zones.dark_woods;
      const cave = migratedPayload.zones.mossfang_cave;
      const overworldTiles = normalizeTileGrid(overworld.tiles);
      const overworldObjects = normalizeObjectGrid(overworld.objects);
      const caveTiles = normalizeTileGrid(cave.tiles);
      const caveObjects = normalizeObjectGrid(cave.objects);

      if (!overworldTiles || !caveTiles || !overworldObjects || !caveObjects) {
        return { ok: false, error: 'Unable to normalize world grids.' };
      }

      // V0.20.83: reject a saved overworld whose dimensions are not Dark Woods'. Saves written between
      // V0.20.80 and V0.20.83 could contain Ashen Valley's 450x450 terrain under the dark_woods key
      // (see getOverworldMap above), and silently accepting it replaces the starting zone forever -
      // the corruption survives every subsequent boot because it is in the save, not in memory.
      // Falling back to procedural generation loses editor decoration but keeps the world correct,
      // which is the right trade: a wrong Dark Woods is unrecoverable, a regenerated one is not.
      const expectedOverworld = Number(DR.DEFAULT_WORLD?.zones?.dark_woods?.width) || 0;
      if (expectedOverworld && overworldTiles.length !== expectedOverworld) {
        return {
          ok: false,
          error: `Saved overworld is ${overworldTiles.length}x${overworldTiles.length}, expected ${expectedOverworld}x${expectedOverworld} for Dark Woods.`
        };
      }

      game.overworldMap = overworldTiles;
      game.overworldObjects = overworldObjects;
      game.flattenOverworldWalkableTerrain?.(game.overworldMap);
      // V0.20.81: a SAVED world bypasses generateMap entirely, so anything the generator places would
      // never exist for an existing player. The Ashen Valley crossing is re-ensured here for exactly
      // the reason DR quest/recipe catalogs are merged below rather than replaced: shipped world
      // content has to reach saves written before it existed. Without this the road was carved only
      // for brand-new worlds, and every current save had no way into the new zone at all.
      game.activeOverworldZoneId = 'dark_woods';
      game.storeOverworldZone?.('dark_woods', overworldTiles, overworldObjects);
      game.ensureAshenValleyRoadLink?.();
      game.caveMap = caveTiles;
      game.caveObjects = caveObjects;
      game.caveEntrances = Array.isArray(overworld.caveEntrances) ? cloneJson(overworld.caveEntrances) : [];
      game.caveExit = cave.caveExit ? cloneJson(cave.caveExit) : { x: 100, y: 66, radius: 5.2 };
      if (typeof game.applyWorldTimeState === 'function') game.applyWorldTimeState(migratedPayload.worldTime || null);
      if (typeof game.applyWeatherState === 'function') game.applyWeatherState(migratedPayload.worldWeather || null);
      game.editorAttributes = {
        dark_woods: cloneObjectOr(overworld.attributes),
        mossfang_cave: cloneObjectOr(cave.attributes)
      };
      game.applyLayeredMaps?.(migratedPayload.layeredMaps || {});
      game.editorResources = {
        dark_woods: cloneObjectOr(overworld.resources),
        mossfang_cave: cloneObjectOr(cave.resources)
      };
      game.editorEvents = {
        dark_woods: cloneObjectOr(overworld.events),
        mossfang_cave: cloneObjectOr(cave.events)
      };
      game.editorNpcs = {
        dark_woods: cloneObjectOr(overworld.npcs),
        mossfang_cave: cloneObjectOr(cave.npcs)
      };
      game.editorMobSpawns = {
        dark_woods: cloneObjectOr(overworld.mobSpawns),
        mossfang_cave: cloneObjectOr(cave.mobSpawns)
      };
      game.editorDungeonMarkers = {
        dark_woods: cloneObjectOr(overworld.dungeonMarkers),
        mossfang_cave: cloneObjectOr(cave.dungeonMarkers)
      };
      game.editorSpawnPoints = {
        dark_woods: overworld.spawnPoint ? cloneJson(overworld.spawnPoint) : null,
        mossfang_cave: cave.spawnPoint ? cloneJson(cave.spawnPoint) : null
      };
      // V0.18.79: mergeShippedCatalog (not cloneObjectOr) so content added in a newer build
      // reaches an existing save/autosave; saved entries still win on id collision.
      game.editorQuests = mergeShippedCatalog(migratedPayload.quests, DR.QUEST_BY_ID || {});
      game.editorResourceTypes = mergeShippedCatalog(migratedPayload.resourceTypes, DR.RESOURCE_BY_ID || {});
      game.editorProfessions = mergeShippedCatalog(migratedPayload.professions, DR.PROFESSION_BY_ID || {});
      game.editorCraftingStations = mergeShippedCatalog(migratedPayload.craftingStations, DR.CRAFTING_STATION_BY_ID || {});
      game.editorRecipes = mergeShippedCatalog(migratedPayload.recipes, DR.CRAFTING_RECIPE_BY_ID || {});
      game.editorNpcDefinitions = mergeShippedCatalog(migratedPayload.npcs, DR.NPC_DRAFT_BY_ID || {});
      game.editorDungeons = mergeShippedCatalog(migratedPayload.dungeons, DR.DUNGEON_BY_ID || {});
      game.editorPuzzles = mergeShippedCatalog(migratedPayload.puzzles, DR.PUZZLE_BY_ID || {});
      game.editorMobDefinitions = mergeShippedCatalog(migratedPayload.mobs, DR.MOB_DRAFT_BY_ID || {});
      game.editorBosses = mergeShippedCatalog(migratedPayload.bosses, DR.BOSS_BY_ID || {});
      game.editorMobSpawnDefinitions = mergeShippedCatalog(migratedPayload.mobSpawnGroups, DR.MOB_SPAWN_BY_ID || {});
      game.editorItems = mergeShippedCatalog(migratedPayload.items, DR.ITEM_BY_ID || {});
      game.markItemCatalogDirty?.('world import');
      game.rebuildRuntimeItemCatalog?.();
      game.editorLootTables = mergeShippedCatalog(migratedPayload.lootTables, DR.LOOT_TABLE_BY_ID || {});
      game.editorSpells = mergeShippedCatalog(migratedPayload.spells, DR.SPELL_BY_ID || {});
      game.classSpellSlots = cloneObjectOr(migratedPayload.classSpellSlots, DR.DEFAULT_CLASS_SPELL_SLOTS || {});
      game.markSpellBookDirty?.('world import');
      game.rebuildRuntimeSpellBook?.();
      game.updateSpellHotbar?.();
      game.pendingQuestRuntimeState = cloneObjectOr(migratedPayload.questRuntime, null);
      if (game.questSystem && typeof game.questSystem.importState === 'function') game.questSystem.importState(game.pendingQuestRuntimeState);
      game.pendingEventRuntimeState = cloneObjectOr(migratedPayload.eventRuntime, null);
      if (game.eventSystem && typeof game.eventSystem.importState === 'function') game.eventSystem.importState(game.pendingEventRuntimeState);
      game.pendingChestRuntimeState = cloneObjectOr(migratedPayload.chestRuntime, null);
      if (game.chestSystem && typeof game.chestSystem.importState === 'function') game.chestSystem.importState(game.pendingChestRuntimeState);
      game.pendingResourceRuntimeState = cloneObjectOr(migratedPayload.resourceRuntime, null);
      if (game.resourceGatheringSystem && typeof game.resourceGatheringSystem.importState === 'function') game.resourceGatheringSystem.importState(game.pendingResourceRuntimeState);
      game.pendingCraftingRuntimeState = cloneObjectOr(migratedPayload.craftingRuntime, null);
      if (game.craftingSystem && typeof game.craftingSystem.importState === 'function') game.craftingSystem.importState(game.pendingCraftingRuntimeState);
      game.pendingNpcRuntimeState = cloneObjectOr(migratedPayload.npcRuntime, null);
      if (game.npcSystem && typeof game.npcSystem.importState === 'function') game.npcSystem.importState(game.pendingNpcRuntimeState);
      game.pendingDungeonRuntimeState = cloneObjectOr(migratedPayload.dungeonRuntime, null);
      if (game.dungeonSystem && typeof game.dungeonSystem.importState === 'function') game.dungeonSystem.importState(game.pendingDungeonRuntimeState);
      game.pendingPuzzleRuntimeState = cloneObjectOr(migratedPayload.puzzleRuntime, null);
      if (game.puzzleSystem && typeof game.puzzleSystem.importState === 'function') game.puzzleSystem.importState(game.pendingPuzzleRuntimeState);
      game.pendingMobSpawnRuntimeState = cloneObjectOr(migratedPayload.mobRuntime, null);
      if (game.mobSpawnSystem && typeof game.mobSpawnSystem.importState === 'function') game.mobSpawnSystem.importState(game.pendingMobSpawnRuntimeState);
      game.zoneProperties = {
        dark_woods: cloneObjectOr(overworld.properties, defaultZoneProperties('dark_woods')),
        mossfang_cave: cloneObjectOr(cave.properties, defaultZoneProperties('mossfang_cave'))
      };
      game.caveEditorMeta = {
        mossfang_cave: cloneObjectOr(cave.caveEditorMeta, defaultCaveMeta())
      };

      if (game.currentZone === 'cave') {
        game.map = game.caveMap;
        game.objects = game.caveObjects;
      } else {
        game.currentZone = 'overworld';
        game.map = game.overworldMap;
        game.objects = game.overworldObjects;
      }

      game.lastWorldMigration = { migrated: migration.migrated, migrations: migration.migrations, warnings: migration.warnings };
      if (typeof game.buildStaticMinimap === 'function') game.staticMinimap = game.buildStaticMinimap();
      game.mapDirty = true;
      game.worldSaveDirty = false;
      return { ok: true, migrated: migration.migrated, migrations: migration.migrations, warnings: migration.warnings, payload: migratedPayload };
    },

    cloneTileGrid,
    cloneObjectGrid,
    migratePayloadForTests: migratePayload
  };
})();
