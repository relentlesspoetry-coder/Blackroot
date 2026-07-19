// Blackroot main game runtime shell
// V0.15.37 runtime shell with post-release candidate renderer hardening.
  (() => {
    'use strict';


    const DR = window.DreamRealms || {};
    const {
      CONFIG,
      TILE,
      TILE_DEF,
      CLASSES,
      CLASS_SPELL_BOOK,
      MERC_ROLES,
      ENEMY_TYPES,
      RARITIES,
      EQUIP_SLOTS,
      SLOT_LABELS,
      CLASS_ARCHETYPES,
      LOOT_BASES,
      AFFIXES
    } = DR;
    const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils;


    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;

    const minimap = document.getElementById('minimap');
    const mmctx = minimap.getContext('2d', { alpha: false });

    const ui = {
      logoSplash: document.getElementById('logoSplash'),
      splashPatchNotesBtn: document.getElementById('splashPatchNotesBtn'),
      splashFullscreenBtn: document.getElementById('splashFullscreenBtn'),
      splashLoginBtn: document.getElementById('splashLoginBtn'),
      splashCreateAccountBtn: document.getElementById('splashCreateAccountBtn'),
      splashLoadGameBtn: document.getElementById('splashLoadGameBtn'),
      splashSaveFolderBtn: document.getElementById('splashSaveFolderBtn'),
      splashSettingsBtn: document.getElementById('splashSettingsBtn'),
      splashExitBtn: document.getElementById('splashExitBtn'),
      splashSettingsPanel: document.getElementById('splashSettingsPanel'),
      accountPanel: document.getElementById('accountPanel'),
      accountModeTitle: document.getElementById('accountModeTitle'),
      accountNameInput: document.getElementById('accountNameInput'),
      accountPasswordInput: document.getElementById('accountPasswordInput'),
      accountSubmitBtn: document.getElementById('accountSubmitBtn'),
      accountCancelBtn: document.getElementById('accountCancelBtn'),
      accountMessage: document.getElementById('accountMessage'),
      characterSlotScreen: document.getElementById('characterSlotScreen'),
      characterSlotFeatured: document.getElementById('characterSlotFeatured'),
      characterSlotGrid: document.getElementById('characterSlotGrid'),
      characterSlotAccountMeta: document.getElementById('characterSlotAccountMeta'),
      closeCharacterSlotsBtn: document.getElementById('closeCharacterSlotsBtn'),
      backToAccountBtn: document.getElementById('backToAccountBtn'),
      splashPatchNotesPanel: document.getElementById('splashPatchNotesPanel'),
      classScreen: document.getElementById('classScreen'),
      classGrid: document.getElementById('classGrid'),
      raceGrid: document.getElementById('raceGrid'),
      raceDetailPanel: document.getElementById('raceDetailPanel'),
      raceSummary: document.getElementById('raceSummary'),
      charNameInput: document.getElementById('charNameInput'),
      genderSelect: document.getElementById('genderSelect'),
      hairSelect: document.getElementById('hairSelect'),
      hairColorInput: document.getElementById('hairColorInput'),
      eyeColorInput: document.getElementById('eyeColorInput'),
      faceSelect: document.getElementById('faceSelect'),
      skinSelect: document.getElementById('skinSelect'),
      clothesPrimaryInput: document.getElementById('clothesPrimaryInput'),
      clothesSecondaryInput: document.getElementById('clothesSecondaryInput'),
      creatorSummary: document.getElementById('creatorSummary'),
      creatorPreview: document.getElementById('creatorPreview'),
      enterRealmBtn: document.getElementById('enterRealmBtn'),
      ccGenderGrid: document.getElementById('ccGenderGrid'),
      ccHairSelector: document.getElementById('ccHairSelector'),
      ccHairColors: document.getElementById('ccHairColors'),
      ccEyeColors: document.getElementById('ccEyeColors'),
      ccSkinColors: document.getElementById('ccSkinColors'),
      ccBackBtn: document.getElementById('ccBackBtn'),
      ccRandomizeBtn: document.getElementById('ccRandomizeBtn'),
      playerName: document.getElementById('playerName'),
      playerMeta: document.getElementById('playerMeta'),
      hudPortraitIcon: document.getElementById('hudPortraitIcon'),
      goldText: document.getElementById('goldText'),
      hpFill: document.getElementById('hpFill'),
      mpFill: document.getElementById('mpFill'),
      xpFill: document.getElementById('xpFill'),
      hpText: document.getElementById('hpText'),
      mpText: document.getElementById('mpText'),
      xpText: document.getElementById('xpText'),
      spellSlots: Array.from(document.querySelectorAll('[data-spell-name]')),
      log: document.getElementById('log'),
      logBody: document.getElementById('logBody'),
      chatInput: document.getElementById('chatInput'),
      chatSendBtn: document.getElementById('chatSendBtn'),
      logMeta: document.getElementById('logMeta'),
      logTabs: Array.from(document.querySelectorAll('[data-log-tab]')),
      externalSystemsHud: document.getElementById('externalSystemsHud'),
      targetBox: document.getElementById('targetBox'),
      targetName: document.getElementById('targetName'),
      targetMeta: document.getElementById('targetMeta'),
      targetHpFill: document.getElementById('targetHpFill'),
      targetHpText: document.getElementById('targetHpText'),
      playerStatusTray: document.getElementById('playerStatusTray'),
      actionStatusTray: document.getElementById('actionStatusRow'),
      actionBuffTray: document.getElementById('actionBuffTray'),
      actionDebuffTray: document.getElementById('actionDebuffTray'),
      unifiedCompanionHud: document.getElementById('unifiedCompanionHud'),
      unifiedHudMeta: document.getElementById('unifiedHudMeta'),
      unifiedHudFrames: document.getElementById('unifiedHudFrames'),
      targetStatusTray: document.getElementById('targetStatusTray'),
      mercStatusTray: document.getElementById('mercStatusTray'),
      mercPanel: document.getElementById('mercPanel'),
      mercOptions: document.getElementById('mercOptions'),
      mercStatus: document.getElementById('mercStatus'),
      mercBarWrap: document.getElementById('mercBarWrap'),
      mercHpFill: document.getElementById('mercHpFill'),
      mercMpFill: document.getElementById('mercMpFill'),
      mercHpText: document.getElementById('mercHpText'),
      mercMpText: document.getElementById('mercMpText'),
      mercPortrait: document.getElementById('mercPortrait'),
      mercMetaTop: document.getElementById('mercMetaTop'),
      mercRoleLine: document.getElementById('mercRoleLine'),
      mercStateLine: document.getElementById('mercStateLine'),
      mercStatGrid: document.getElementById('mercStatGrid'),
      mercXpFill: document.getElementById('mercXpFill'),
      mercXpText: document.getElementById('mercXpText'),
      mercGearBtn: document.getElementById('mercGearBtn'),
      mercCommands: document.getElementById('mercCommands'),
      mercInvitePartyBtn: document.getElementById('mercInvitePartyBtn'),
      dismissMercBtn: document.getElementById('dismissMercBtn'),
      mapOverlay: document.getElementById('mapOverlay'),
      worldMap: document.getElementById('worldMap'),
      closeMapBtn: document.getElementById('closeMapBtn'),
      mapZoomInBtn: document.getElementById('mapZoomInBtn'),
      mapZoomOutBtn: document.getElementById('mapZoomOutBtn'),
      mapRecenterBtn: document.getElementById('mapRecenterBtn'),
      bagPanel: document.getElementById('bagPanel'),
      closeBagBtn: document.getElementById('closeBagBtn'),
      bagMeta: document.getElementById('bagMeta'),
      bagMoney: document.getElementById('bagMoney'),
      bagBar: document.getElementById('bagBar'),
      bagDock: document.getElementById('bagDock'),
      equipmentGrid: document.getElementById('equipmentGrid'),
      bagGrid: document.getElementById('bagGrid'),
      bankPanel: document.getElementById('bankPanel'),
      closeBankBtn: document.getElementById('closeBankBtn'),
      bankMeta: document.getElementById('bankMeta'),
      bankGrid: document.getElementById('bankGrid'),
      tradePanel: document.getElementById('tradePanel'),
      tradePeerName: document.getElementById('tradePeerName'),
      closeTradeBtn: document.getElementById('closeTradeBtn'),
      tradeConfirmBtn: document.getElementById('tradeConfirmBtn'),
      tradeMyOffer: document.getElementById('tradeMyOffer'),
      tradeTheirOffer: document.getElementById('tradeTheirOffer'),
      tradeMyStatus: document.getElementById('tradeMyStatus'),
      tradeTheirStatus: document.getElementById('tradeTheirStatus'),
      skillsPanel: document.getElementById('skillsPanel'),
      closeSkillsBtn: document.getElementById('closeSkillsBtn'),
      skillsMeta: document.getElementById('skillsMeta'),
      skillsList: document.getElementById('skillsList'),
      partyPanel: document.getElementById('partyPanel'),
      multiplayerStatus: document.getElementById('multiplayerStatus'),
      partyMembers: document.getElementById('partyMembers'),
      nearbyPlayers: document.getElementById('nearbyPlayers'),
      partyInvites: document.getElementById('partyInvites'),
      partyInvitePopup: document.getElementById('partyInvitePopup'),
      partyInvitePopupList: document.getElementById('partyInvitePopupList'),
      partyMercControls: document.getElementById('partyMercControls'),
      minimapWrap: document.getElementById('minimapWrap'),
      fpsCounter: document.getElementById('fpsCounter'),
      timeCycleClock: document.getElementById('timeCycleClock'),
      worldClockTime: document.getElementById('worldClockTime'),
      worldClockPhase: document.getElementById('worldClockPhase'),
      weatherPanel: document.getElementById('weatherPanel'),
      weatherStatus: document.getElementById('weatherStatus'),
      weatherClimate: document.getElementById('weatherClimate'),
      weatherCycleBtn: document.getElementById('weatherCycleBtn'),
      debugOverlay: document.getElementById('debugOverlay'),
      debugOverlayBody: document.getElementById('debugOverlayBody'),
      partyHud: document.getElementById('partyHud'),
      partyHudMeta: document.getElementById('partyHudMeta'),
      partyHudMembers: document.getElementById('partyHudMembers'),
      copyPeerBtn: document.getElementById('copyPeerBtn'),
      menuToggleBtn: document.getElementById('menuToggleBtn'),
      menuPanel: document.getElementById('menuPanel'),
      closeMenuBtn: document.getElementById('closeMenuBtn'),
      menuCharacterBtn: document.getElementById('menuCharacterBtn'),
      menuBagsBtn: document.getElementById('menuBagsBtn'),
      menuSkillsBtn: document.getElementById('menuSkillsBtn'),
      menuSpellsBtn: document.getElementById('menuSpellsBtn'),
      menuSettingsBtn: document.getElementById('menuSettingsBtn'),
      menuFullscreenBtn: document.getElementById('menuFullscreenBtn'),
      menuPatchNotesBtn: document.getElementById('menuPatchNotesBtn'),
      menuSaveFolderBtn: document.getElementById('menuSaveFolderBtn'),
      menuPatchNotesPanel: document.getElementById('menuPatchNotesPanel'),
      menuLogoutBtn: document.getElementById('menuLogoutBtn'),
      menuExitBtn: document.getElementById('menuExitBtn'),
      characterPanel: document.getElementById('characterPanel'),
      closeCharacterBtn: document.getElementById('closeCharacterBtn'),
      characterSummary: document.getElementById('characterSummary'),
      characterStats: document.getElementById('characterStats'),
      spellPanel: document.getElementById('spellPanel'),
      closeSpellBtn: document.getElementById('closeSpellBtn'),
      spellSummary: document.getElementById('spellSummary'),
      spellList: document.getElementById('spellList'),
      settingsPanel: document.getElementById('settingsPanel'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      settingsList: document.getElementById('settingsList'),
      pauseOverlay: document.getElementById('pauseOverlay')
    };
    DR.ui = ui;
    DR.runtime = { canvas, ctx, minimap, mmctx, ui };

    // Classic-script renderer compatibility.
    // Some renderer files were extracted from the original single-file closure and still
    // reference ctx/mmctx/canvas/ui as globals. Keep those references valid without
    // moving renderer logic back into game.js.
    window.canvas = canvas;
    window.ctx = ctx;
    window.minimap = minimap;
    window.mmctx = mmctx;
    window.ui = ui;

    const BLACKROOT_LOGO_DATA = './assets/logo/blackroot-logo.svg';
    document.querySelectorAll('[data-logo-img]').forEach(img => {
      img.src = BLACKROOT_LOGO_DATA;
    });

    const { Entity, Player, Enemy, Mercenary, Pet, RemotePlayer } = DR.entities;

    function randInt(a, b) {
      return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    const CLICK_WALK_STOP_DISTANCE = 0.18;
    const CLICK_WALK_MAX_RANGE = 24;
    const CLICK_WALK_MAX_SECONDS = 6.5;
    const CLICK_WALK_STUCK_SECONDS = 0.55;

    class Game {
      constructor() {
        this.canvas = canvas;
        this.minimapCanvas = minimap;
        this.map = [];
        this.objects = [];
        this.entities = [];
        this.enemies = [];
        this.player = null;
        this.merc = null;
        this.pet = null;
        this.started = false;
        this.paused = false;
        this.keys = new Set();
        this.mouse = { x: 0, y: 0 };
        this.clickMoveTarget = null;
        this.clickMovePath = [];
        this.clickMovePathIndex = 0;
        this.clickMovePulse = 0;
        this.lastClickToWalkAt = 0;
        this.lastRuntimeFaultAt = 0;
        this.camera = {
          x: 0,
          y: 0,
          shake: 0,
          yaw: 0,
          yawVel: 0,
          zoom: CONFIG.CAMERA_DEFAULT_ZOOM,
          targetZoom: CONFIG.CAMERA_DEFAULT_ZOOM
        };
        this.effects = [];
        this.damageText = [];
        this.logLines = [];
        this.logEntries = { System: [], Combat: [], Chat: [], Party: [] };
        this.activeLogTab = 'System';
        this.lastTime = performance.now();
        this.fpsFrameCount = 0;
        this.fpsElapsed = 0;
        this.currentFps = 0;
        this.displayFpsEma = 0;
        this.fpsWindowStartMs = 0;
        this.fpsLastSampleMs = 0;
        // V0.17.06: Mini-Map no longer owns an FPS widget; these fields remain
        // for F3/debug overlay diagnostics only.
        this.fpsValueNode = null;
        this.debugOverlayOpen = false;
        this.minimapTimer = 0;
        this.staticMinimap = null;
        this.bagOpen = false;
        this.mapOpen = false;
        this.playerRespawnTimer = 0;
        this.inventory = [];
        this.bags = null;
        this.equipment = Object.fromEntries(EQUIP_SLOTS.map(slot => [slot, null]));
        this.itemSerial = 1;
        this.bagDirty = true;
        this.mapDirty = true;
        this.currentZone = 'overworld';
        this.overworldMap = null;
        this.overworldObjects = null;
        this.caveMap = null;
        this.caveObjects = null;
        this.overworldEnemies = [];
        this.caveEnemies = [];
        this.caveEntrances = [];
        this.caveReturn = { x: CONFIG.START_X, y: CONFIG.START_Y };
        this.caveExit = { x: CONFIG.START_X, y: CONFIG.START_Y };
        this.editorAttributes = { dark_woods: {}, mossfang_cave: {} };
        this.editorResources = { dark_woods: {}, mossfang_cave: {} };
        this.editorEvents = { dark_woods: {}, mossfang_cave: {} };
        this.editorNpcs = { dark_woods: {}, mossfang_cave: {} };
        this.editorMobSpawns = { dark_woods: {}, mossfang_cave: {} };
        this.editorNpcDefinitions = JSON.parse(JSON.stringify(window.DreamRealms?.NPC_DRAFT_BY_ID || {}));
        this.editorMobDefinitions = JSON.parse(JSON.stringify(window.DreamRealms?.MOB_DRAFT_BY_ID || {}));
        this.editorBosses = JSON.parse(JSON.stringify(window.DreamRealms?.BOSS_BY_ID || {}));
        this.editorMobSpawnDefinitions = JSON.parse(JSON.stringify(window.DreamRealms?.MOB_SPAWN_BY_ID || {}));
        this.editorResourceTypes = JSON.parse(JSON.stringify(window.DreamRealms?.RESOURCE_BY_ID || {}));
        this.editorProfessions = JSON.parse(JSON.stringify(window.DreamRealms?.PROFESSION_BY_ID || {}));
        this.editorCraftingStations = JSON.parse(JSON.stringify(window.DreamRealms?.CRAFTING_STATION_BY_ID || {}));
        this.editorRecipes = JSON.parse(JSON.stringify(window.DreamRealms?.CRAFTING_RECIPE_BY_ID || {}));
        this.editorItems = JSON.parse(JSON.stringify(window.DreamRealms?.ITEM_BY_ID || {}));
        this.editorLootTables = JSON.parse(JSON.stringify(window.DreamRealms?.LOOT_TABLE_BY_ID || {}));
        this.editorSpells = JSON.parse(JSON.stringify(window.DreamRealms?.SPELL_BY_ID || {}));
        this.classSpellSlots = JSON.parse(JSON.stringify(window.DreamRealms?.DEFAULT_CLASS_SPELL_SLOTS || {}));
        this.compiledClassSpellBook = null;
        this.compiledSpellById = null;
        this.spellCompilerErrors = [];
        this.spellBookDirty = true;
        this.compiledItems = null;
        this.compiledItemById = null;
        this.itemCompilerErrors = [];
        this.itemCatalogDirty = true;
        this.eventRuntimeState = null;
        this.pendingEventRuntimeState = null;
        this.chestRuntimeState = null;
        this.pendingChestRuntimeState = null;
        this.resourceRuntimeState = null;
        this.pendingResourceRuntimeState = null;
        this.craftingRuntimeState = null;
        this.pendingCraftingRuntimeState = null;
        this.npcRuntimeState = null;
        this.pendingNpcRuntimeState = null;
        this.dungeonRuntimeState = null;
        this.pendingDungeonRuntimeState = null;
        this.puzzleRuntimeState = null;
        this.pendingPuzzleRuntimeState = null;
        this.activeDungeon = null;
        this.dungeonMap = null;
        this.dungeonObjects = null;
        this.dungeonEnemies = [];
        this.dungeonRooms = [];
        this.mobSpawnRuntimeState = null;
        this.pendingMobSpawnRuntimeState = null;
        this.npcTrainingBonuses = { hp: 0, mana: 0, attack: 0, defense: 0, speed: 0 };
        this.editorSpawnPoints = { dark_woods: null, mossfang_cave: null };
        this.zoneProperties = {
          dark_woods: { levelMin: 1, levelMax: 10, weather: 'temperate_forest', biome: 'temperate_forest', elevation: 850, music: 'dark_woods' },
          mossfang_cave: { levelMin: 1, levelMax: 8, weather: 'none', biome: 'cave', elevation: 120, music: 'cave_ambience' }
        };
        this.worldTime = null;
        this.weatherState = null;
        this.statusEffectRuntimeState = { version: 1 };
        this.threatRuntimeState = { version: 1 };
        this.lastWeatherUiKey = null;
        this.lastWorldClockUiMinute = null;
        this.lastWorldClockPhase = null;
        this.externalSystems = [];
        this.systemLookup = {};
        this.localPeerId = `dw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        this.peerName = null;
        this.peerChannel = null;
        this.multiplayerAvailable = false;
        this.multiplayerTimer = 0;
        this.multiplayerPruneTimer = 0;
        this.partyPanelDirty = true;
        this.partyOpen = true;
        this.skillsOpen = false;
        this.menuOpen = false;
        this.characterPanelOpen = false;
        this.spellPanelOpen = false;
        this.settingsPanelOpen = false;
        // V0.20.18: load them, the way the line below has always loaded keybindings.
        this.uiPrefs = this.loadUiPrefs();
        this.keyBindings = this.loadKeyBindings();
        this.pendingKeyRebindAction = null;
        this.meditationSettleSeconds = window.DreamRealms?.MEDITATION_TUNING?.settleSeconds ?? 1.0;
        this.partyMercIncluded = false;
        this.remotePlayers = new Map();
        this.botPlayers = [];
        this.botPartyMembers = new Set();
        this.botHudDirty = true;
        this.performanceMode = (() => {
          try { return localStorage.getItem('dreamRealmsPerformanceMode') || DR.CONFIG?.PERFORMANCE?.mode || 'balanced'; }
          catch (_) { return DR.CONFIG?.PERFORMANCE?.mode || 'balanced'; }
        })();
        // V0.17.95: persisted user render-resolution scale (0.5-1.0). Combines with the
        // adaptive governor's per-level scale and the pixel budget in displayPixelRatio().
        this.userRenderScale = (() => {
          const floor = Math.max(0.25, Number(DR.CONFIG?.PERFORMANCE?.minRenderScale) || 0.5);
          try {
            const v = parseFloat(localStorage.getItem('dreamRealms.renderScale'));
            return Number.isFinite(v) ? Math.max(floor, Math.min(1, v)) : 1;
          } catch (_) { return 1; }
        })();
        this.enemySpatialGrid = { cellSize: DR.CONFIG?.PERFORMANCE?.enemySpatialCellSize || 8, cells: new Map(), sourceCount: 0, builtFrame: -1 };
        this.objectChunkIndex = { cellSize: DR.CONFIG?.PERFORMANCE?.objectChunkSize || 16, mapRef: null, objectsRef: null, zoneKey: '', chunks: new Map(), objectCount: 0, builtFrame: -1, lastAuditFrame: -1, dirty: true };
        const AssetSystemCtor = DR.AssetSystem || DR.assets?.AssetSystem || class { constructor() {} };
        const SpriteAtlasSystemCtor = DR.SpriteAtlasSystem || DR.assets?.SpriteAtlasSystem || class { constructor() {} isReady() { return false; } };
        const SpriteSheetSystemCtor = DR.SpriteSheetSystem || DR.assets?.SpriteSheetSystem || class { constructor() {} isReady() { return false; } };
        const RuntimeSpriteCacheSystemCtor = DR.RuntimeSpriteCacheSystem || DR.systems?.RuntimeSpriteCacheSystem || class { constructor() {} beginFrame() {} drawModel() { return false; } snapshotStats() { return { enabled: false, entries: 0, hits: 0, misses: 0 }; } };
        const PerformanceVerificationSystemCtor = DR.PerformanceVerificationSystem || DR.systems?.PerformanceVerificationSystem || class { constructor() { this.preset = 'balanced'; } beginFrame() {} update() {} effectiveBaseSettings(base) { return base || {}; } snapshotStats() { return { preset: 'balanced', presetLabel: 'Balanced' }; } consumeResizeRequest() { return false; } };
        const AdaptivePerformanceSystemCtor = DR.AdaptivePerformanceSystem || DR.systems?.AdaptivePerformanceSystem || class { constructor() {} beginFrame() {} update() {} effectiveSettings(base) { return base || {}; } snapshotStats() { return { enabled: false, levelName: 'off' }; } consumeResizeRequest() { return false; } };
        this.assetSystem = new AssetSystemCtor({ baseUrl: './' });
        this.spriteAtlasSystem = new SpriteAtlasSystemCtor(this, { assetSystem: this.assetSystem });
        this.spriteSheetSystem = new SpriteSheetSystemCtor(this, { assetSystem: this.assetSystem });
        this.performanceVerifier = new PerformanceVerificationSystemCtor(this, { benchmarkDurationSec: DR.CONFIG?.PERFORMANCE?.benchmarkDurationSec });
        if (this.performanceVerifier?.preset) this.performanceMode = this.performanceVerifier.preset;
        this.runtimeSpriteCache = new RuntimeSpriteCacheSystemCtor(this, { enabled: DR.CONFIG?.PERFORMANCE?.enableSpriteCache !== false, maxEntries: DR.CONFIG?.PERFORMANCE?.spriteCacheMaxEntries });
        this.adaptivePerformance = new AdaptivePerformanceSystemCtor(this, { enabled: DR.CONFIG?.PERFORMANCE?.enableAdaptivePerformance !== false });
        this.renderScratch = { tileRenderables: [], terrainDepthRenderables: [], waterDepthRenderables: [], worldRenderables: [], objectChunkEntries: [], renderItemPool: [], renderItemPoolUsed: 0 };
        this.perfStats = {
          frameMs: 0,
          updateMs: 0,
          renderMs: 0,
          entitiesDrawn: 0,
          terrainChunksDrawn: 0,
          tilesQueued: 0,
          objectsQueued: 0,
          effectsQueued: 0,
          damageTextQueued: 0,
          worldRenderables: 0,
          aiUpdatesThisFrame: 0,
          enemiesAwake: 0,
          enemiesThrottled: 0,
          enemiesSleeping: 0,
          enemiesMid: 0,
          enemiesFar: 0,
          terrainSurfacesDrawn: 0,
          terrainWaterSurfacesDrawn: 0,
          terrainShoreSurfacesDrawn: 0,
          terrainChunkCacheEntries: 0,
          terrainChunkBuilds: 0,
          terrainChunkCacheInvalidations: 0,
          terrainChunksConsidered: 0,
          terrainChunksCulled: 0,
          objectChunkCacheEntries: 0,
          objectChunksVisited: 0,
          objectIndexObjects: 0,
          objectsCulled: 0,
          pathWorkerPending: 0,
          pathWorkerRequestsThisFrame: 0,
          pathWorkerCompleted: 0,
          pathWorkerFailed: 0,
          pathWorkerSyncFallbacks: 0,
          pathWorkerGridBuilds: 0,
          pathWorkerPendingCapSkips: 0,
          pathWorkerFrameBudgetSkips: 0,
          pathWorkerCooldownRejects: 0,
          pathWorkerReusedRoutes: 0,
          pathWorkerDuplicateRequests: 0,
          uiUpdateMs: 0,
          uiFastMs: 0,
          uiFullMs: 0,
          uiFastUpdates: 0,
          uiFullUpdates: 0,
          uiSkippedUpdates: 0,
          uiDomWrites: 0,
          uiTextWrites: 0,
          uiHtmlWrites: 0,
          uiStyleWrites: 0,
          uiClassWrites: 0,
          uiCompanionResourceUpdates: 0,
          renderQueueBuildMs: 0,
          renderQueueSortMs: 0,
          terrainRenderQueueSortMs: 0,
          worldRenderQueueSortMs: 0,
          entityScreenCulled: 0,
          entityTileCulled: 0,
          effectScreenCulled: 0,
          effectTileCulled: 0,
          damageScreenCulled: 0,
          damageTileCulled: 0,
          effectPoolEntries: 0,
          effectPoolReused: 0,
          effectPoolRecycled: 0,
          effectsExpired: 0,
          effectsDropped: 0,
          damageTextPoolEntries: 0,
          damageTextPoolReused: 0,
          damageTextPoolRecycled: 0,
          damageTextDropped: 0,
          arraysCompacted: 0,
          renderItemPoolUsed: 0,
          renderItemPoolSize: 0,
          renderItemPoolTrims: 0,
          renderBackendWebgl: false,
          renderBackendWebgl2: false,
          renderBackendBitmapRenderer: false,
          renderBackendOffscreenCanvas: false,
          renderBackendActive: 'canvas2d',
          renderBackendWebglPrototypeReady: false,
          renderBackendWebglContextLost: false,
          renderBackendWebglMaxTextureSize: 0,
          renderBackendWebglRenderer: '',
          renderBackendRendererMode: 'canvas2d',
          renderBackendWatchdogEnabled: false,
          renderBackendAutoFallbacks: 0,
          renderBackendWatchdogTrips: 0,
          renderBackendFailureScore: 0,
          renderBackendCooldownRemainingMs: 0,
          renderBackendLastFallbackReason: '',
          renderBackendLastModeRequest: 'canvas2d',
          renderBackendModeDenied: false,
          renderBackendModeDeniedReason: '',
          renderBackendSafeMode: true,
          renderBackendWebglSpritePrototypeEnabled: false,
          renderBackendWebglSpriteProgramReady: false,
          renderBackendWebglSpriteShadowDraw: true,
          renderBackendWebglSpriteCandidates: 0,
          renderBackendWebglSpriteEligible: 0,
          renderBackendWebglSpriteTextureEntries: 0,
          renderBackendWebglSpriteTextureUploads: 0,
          renderBackendWebglSpriteTextureEvictions: 0,
          renderBackendWebglSpriteUploadMs: 0,
          renderBackendWebglSpriteDrawCalls: 0,
          renderBackendWebglSpriteQuads: 0,
          renderBackendWebglSpriteDrawMs: 0,
          renderBackendWebglSpriteFallbacks: 0,
          renderBackendWebglSpriteLastError: '',
          renderBackendWebglScenePreviewEnabled: false,
          renderBackendWebglScenePreviewOverlayEnabled: false,
          renderBackendWebglScenePreviewTerrainLayerEnabled: true,
          renderBackendWebglScenePreviewSpriteLayerEnabled: true,
          renderBackendWebglScenePreviewGuidesEnabled: true,
          renderBackendWebglScenePreviewReady: false,
          renderBackendWebglScenePreviewDrawCalls: 0,
          renderBackendWebglScenePreviewQuads: 0,
          renderBackendWebglScenePreviewTerrainQuads: 0,
          renderBackendWebglScenePreviewSpriteQuads: 0,
          renderBackendWebglScenePreviewDrawMs: 0,
          renderBackendWebglScenePreviewCompositeMs: 0,
          renderBackendWebglScenePreviewComposites: 0,
          renderBackendWebglScenePreviewLastError: '',
          renderBackendWebglScenePreviewAlignmentScore: 0,
          renderBackendWebglScenePreviewCoveragePct: 0,
          renderBackendWebglScenePreviewFallbackPressure: 0,
          renderBackendWebglScenePreviewPromotionReady: false,
          renderBackendWebglScenePreviewReadiness: 'inactive',
          renderBackendWebglScenePreviewRecommendation: '',
          renderBackendSpriteBatchPrepared: 0,
          renderBackendTerrainBatchPrepared: 0,
          renderBackendWorldBatchPrepared: 0,
          renderBackendObjectBatchPrepared: 0,
          renderBackendEntityBatchPrepared: 0,
          renderBackendEffectBatchPrepared: 0,
          renderBackendDamageBatchPrepared: 0,
          renderBackendBatchOverflow: 0,
          renderBackendBatchBuildMs: 0,
          renderBackendBatchFrames: 0,
          renderBackendBatchDrawablePct: 0,
          overlayCacheEntries: 0,
          overlayCacheHits: 0,
          overlayCacheMisses: 0,
          overlayCacheEvictions: 0,
          overlayCacheDraws: 0,
          overlayFrameDraws: 0,
          overlayCacheBuildMs: 0,
          adaptiveEnabled: false,
          adaptiveLevel: 2,
          adaptiveLevelName: 'balanced',
          adaptiveFrameMsEma: 0,
          adaptiveRenderMsEma: 0,
          adaptiveUpdateMsEma: 0,
          adaptiveDownshifts: 0,
          adaptiveUpshifts: 0,
          adaptiveLastChangeReason: '',
          performancePreset: 'balanced',
          lowSpecMode: false,
          hotspotArea: 'pending',
          hotspotReason: '',
          benchmarkActive: false,
          benchmarkFrames: 0,
          benchmarkRemainingSec: 0,
          benchmarkAvgFps: 0,
          benchmarkAvgFrameMs: 0,
          benchmarkP95FrameMs: 0,
          benchmarkWorstFrameMs: 0,
          benchmarkLastHotspot: ''
        };
        this.renderBackendCaps = this.detectRenderBackendCapabilities?.() || null;
        this.partyId = null;
        this.partyLeaderId = this.localPeerId;
        this.partyMembers = new Set([this.localPeerId]);
        this.partyInvites = new Map();
        this.botPartyInvites = new Map();

        this.initAudioSystem?.();
        this.initializeWorldClock?.();
        this.initializeWeather?.();
        this.setupMultiplayer();
        this.initSteamDeckSupport?.();
        this.generateMap();
        if (this.suppressSavedWorldLoad) {
          this.worldSaveLoadedAtBoot = false;
        } else {
          this.worldSaveLoadedAtBoot = this.loadSavedWorldState?.({ silent: true, duringBoot: true }) || false;
        }
        this.ensureDarkWoodsAtmosphereLandmarks?.();
        this.ensureStartingCampRevamp?.();
        // V0.20.87: AFTER the camp revamp, never before it. That pass clears every object inside the
        // camp ellipse (clearAndSet nulls them), and the Dead Lantern waypoint sits at 0.76 of that
        // radius - so placing it during world generation put it down and then had it wiped, silently,
        // on every boot.
        this.ensureDeadLanternWaypointObject?.();
        // AFTER the landmark/camp passes, so anything they place is cleaned too. Removes props that
        // generation dropped into open water or onto slivers surrounded by it.
        this.ensureNoPropsInWater?.();
        this.spriteSheetSystem?.loadDefaultIndex?.({ silent: true });
        this.spriteAtlasSystem?.loadDefaultAtlases?.({ silent: true });
        this.staticMinimap = this.buildStaticMinimap?.() || this.staticMinimap;
        this.initUI();
        // External terrain owners (notably underwater entrances) must finish authored
        // map mutations before the mob-spawn owner validates and creates populations.
        this.swimmingSystem?.normalizeActiveMap?.();
        this.swimmingSystem?.ensureEntrances?.();
        this.spawnEnemies();
        this.bindEvents();
        this.resize();
        // V0.19.0 (Roadmap Item 23): attach the development-only debug tools (DarkWoodsGame.debug.*).
        // Attaching is harmless - every command refuses to run until debug mode is explicitly enabled.
        try { this.installDebugTools?.(); } catch (_e) { /* debug tools must never break boot */ }
        // V0.20.9 (Roadmap Item 17): attach world examine. It binds the interact key as a FALLBACK -
        // it asks every other system whether they have a target beside the player and stays silent if
        // any of them do, so it cannot take E from talking, looting, gathering or crafting.
        try { this.installWorldExamineSystem?.(); } catch (_e) { /* examining must never break boot */ }
        // V0.21.0 (Art Direction Phase 1): lock the presentation profile. This call did not exist
        // before - the profile shipped in V0.20.96 and nothing invoked it, so the camera mode and
        // snap-angle count were never actually applied and the CONFIG/profile agreement was never
        // checked. Advisory: it warns on drift, it does not throw.
        try { this.applyArtDirectionProfile?.(); } catch (_e) { /* presentation must never break boot */ }
        // V0.21.2 (Phase 2): bake the waypoint shrine EAGERLY, before the validation suite runs a few
        // lines below. It is lazy by default - built on first draw - which meant the suite reported
        // "0 atlases" while the asset registered fine moments later, so the one check that would catch
        // a malformed shrine never saw it. Building here makes that validation real.
        try { this.buildAuthoredWaypointShrine?.(); } catch (_e) { /* art must never break boot */ }
        // V0.18.92 (Roadmap Item 22): run the consolidated validation suite once at boot (registry
        // validation + stat-pipeline regression self-test). Advisory-only, one log line; a bare
        // try/catch guarantees it never blocks the loop.
        try {
          const vs = this.runValidationSuite?.();
          if (vs) {
            const s = vs.summary;
            const line = `[Dream Realms] validation suite: ${vs.ok ? 'PASS' : 'FAIL'} - stat-pipeline ${s.statPipeline}, items sourced ${s.itemsSourced}, ${s.dataIssues} data issue(s), ${s.economyIssues} economy issue(s), ${s.dialogueIssues} dialogue issue(s), ${s.compilerErrors} compiler error(s), ${s.registryWarnings} descriptor warning(s). Call DarkWoodsGame.runValidationSuite() for details.`;
            if (vs.ok) console.info(line); else console.warn(line, vs.sections);
          }
        } catch (_e) { /* validation is advisory - never let it break boot */ }
        requestAnimationFrame(t => this.loop(t));
      }













      defaultKeyBindings() {
        return {
          moveUp: 'w',
          moveDown: 's',
          moveLeft: 'a',
          moveRight: 'd',
          jump: 'space',
          ascend: 'space',
          dive: 'u',
          interact: 'e',
          // V0.20.9 (Roadmap Item 17): examining the world has its own key rather than sharing E.
          // E is claimed by NPCs at ~3.25 tiles, and Dead Lantern Camp holds 27 of them - an NPC is in
          // range almost everywhere, so an E-based examine would have been silent in the exact place
          // its objects live. A dedicated key also means examining can never take a press from talking,
          // looting, gathering or crafting, which is Item 17's "must not interfere" rule met outright.
          examine: 'i',
          targetNearest: 'tab',
          autoAttack: '1',
          spell2: '2',
          spell3: '3',
          spell4: '4',
          spell5: '5',
          spell6: '6',
          spell7: '7',
          spell8: '8',
          spell9: '9',
          spell0: '0',
          meditate: 'r',
          portal: 't',
          bags: 'b',
          character: 'c',
          skills: 'k',
          map: 'm',
          party: 'o',
          talents: 'n',
          spellbook: 'v',
          hireMerc: 'h',
          pause: 'p',
          gather: 'g',
          crafting: 'j',
          fishing: 'f',
          questLog: 'l',
          // V0.20.67 (Roadmap Item 7 + Item 20): the mount/taming keys were originally hardcoded raw
          // key checks inside their own systems, which meant they never went through this table - so
          // they were invisible to the remapping UI AND silently collided with existing actions. All
          // three of the first choices were already taken: 'm' is map, 'h' is hireMerc, 't' is portal.
          // Registered here instead, on the only letters this table leaves free (q/x/y/z), so they are
          // remappable like everything else and a future collision is visible rather than silent.
          tameBeast: 'z',
          mountToggle: 'x',
          mountPanel: 'y',
          fullscreen: 'f11',
          debugOverlay: 'f3',
          saveFolder: 'f5',
          saveWorld: 'f12',
          exportCharacter: 'f7',
          reloadWorld: 'f8'
        };
      }

      keyBindingLabels() {
        return [
          ['Movement', [
            ['moveUp', 'Move Up'], ['moveDown', 'Move Down'], ['moveLeft', 'Move Left'], ['moveRight', 'Move Right'],
            ['jump', 'Jump'], ['ascend', 'Swim Up / Surface'], ['dive', 'Dive Down']
          ]],
          ['Combat', [
            ['targetNearest', 'Target Nearest'], ['autoAttack', 'Auto Attack'],
            ['spell2', 'Ability Slot 2'], ['spell3', 'Ability Slot 3'], ['spell4', 'Ability Slot 4'], ['spell5', 'Ability Slot 5'],
            ['spell6', 'Ability Slot 6'], ['spell7', 'Ability Slot 7'], ['spell8', 'Ability Slot 8'], ['spell9', 'Ability Slot 9'], ['spell0', 'Ability Slot 0']
          ]],
          ['Interactions / Professions', [
            ['interact', 'Interact'], ['gather', 'Nearest Gather'], ['crafting', 'Crafting Station'], ['fishing', 'Start Fishing'], ['meditate', 'Meditate'], ['portal', 'Portal to Camp / Return'],
            ['tameBeast', 'Tame Target Beast'], ['mountToggle', 'Mount / Dismount']
          ]],
          ['Windows / UI', [
            ['bags', 'Bags'], ['character', 'Character Info'], ['skills', 'Skills / Professions'], ['talents', 'Talents'], ['spellbook', 'Spellbook'], ['map', 'Map'], ['party', 'Party'], ['questLog', 'Quest Log'], ['mountPanel', 'Mounts'], ['pause', 'Pause']
          ]],
          ['System', [
            ['fullscreen', 'Fullscreen'], ['debugOverlay', 'Debug Overlay'], ['saveFolder', 'Save Folder'], ['saveWorld', 'Save World + Character'], ['exportCharacter', 'Export Character'], ['reloadWorld', 'Reload World']
          ]]
        ];
      }

      normalizeInputKeyFromEvent(event) {
        if (!event) return '';
        const code = String(event.code || '');
        if (code === 'Space') return 'space';
        if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
        if (/^Digit[0-9]$/.test(code)) return code.slice(5);
        if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
        if (/^F\d{1,2}$/.test(code)) return code.toLowerCase();
        if (code.startsWith('Arrow')) return code.toLowerCase();
        if (code === 'Tab') return 'tab';
        if (code === 'Enter') return 'enter';
        if (code === 'Escape') return 'escape';
        const key = String(event.key || '').toLowerCase();
        if (key === ' ') return 'space';
        return key;
      }

      normalizeBindingKey(value) {
        const key = String(value || '').trim().toLowerCase();
        if (key === ' ') return 'space';
        if (key === 'esc') return 'escape';
        if (key === 'spacebar') return 'space';
        return key;
      }

      displayKey(value) {
        const key = this.normalizeBindingKey(value);
        if (!key) return 'Unbound';
        const names = { space: 'Space', tab: 'Tab', enter: 'Enter', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' };
        if (names[key]) return names[key];
        if (/^f\d{1,2}$/.test(key)) return key.toUpperCase();
        return key.length === 1 ? key.toUpperCase() : key.replace(/\b\w/g, m => m.toUpperCase());
      }

      loadKeyBindings() {
        const defaults = this.defaultKeyBindings();
        try {
          const raw = window.localStorage?.getItem('dream-realms.keybindings.v1');
          if (!raw) return { ...defaults };
          const parsed = JSON.parse(raw);
          return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
        } catch (_err) {
          return { ...defaults };
        }
      }

      saveKeyBindings() {
        try { window.localStorage?.setItem('dream-realms.keybindings.v1', JSON.stringify(this.keyBindings || this.defaultKeyBindings())); } catch (_err) {}
      }

      // V0.20.18: UI preferences persist, the same way keybindings a few lines up always have.
      //
      // They never did. `this.uiPrefs = { showMinimap: true, ... }` was assigned fresh on every boot,
      // with no save and no load anywhere in the codebase - verified: nothing in localStorage, nothing
      // in the character save, no saveUiPrefs function at all. Turn off Show Minimap, reload, it is
      // back. Three settings the game offers and then forgets, sitting one line above a keybinding
      // system that has been persisting correctly the whole time.
      //
      // This is also the prerequisite for Roadmap Item 20: "accessibility settings must persist per
      // user". A reduced-motion or screen-shake toggle built on uiPrefs today would be forgotten every
      // reload - which for an accessibility setting is worse than not offering it.
      //
      // Deliberately mirrors loadKeyBindings/saveKeyBindings exactly: same storage-key shape, same
      // defaults-then-overlay merge (so a pref added later appears for existing players instead of
      // being missing), same swallow-and-carry-on error handling. Per-browser, not per-character:
      // whether the minimap is visible is a property of the person playing, not of the character.
      defaultUiPrefs() {
        return {
          showMinimap: true, showMercPanel: true, showPartyHud: true, largeChat: true,
          // V0.20.19 (Roadmap Item 20 - accessibility): off by default, i.e. shake stays ON, because a
          // default must never silently change how the game looks for someone who did not ask.
          reduceScreenShake: false,
          // V0.20.37 (Roadmap Item 20): reduced motion - also off by default. When ON it zeroes screen
          // shake AND thins decorative particle density, WITHOUT removing any effect: rings, bolts,
          // telegraphs and health bars all still draw, so gameplay information and timing are preserved
          // (the spec's hard requirement). It is a superset of reduceScreenShake for the shake gate.
          reduceMotion: false,
          // V0.20.38 (Roadmap Item 20 - colourblind support): off by default. When ON, each status pip
          // gets a shape-based valence marker (up-triangle buff / down-triangle debuff), so beneficial
          // and harmful effects are distinguishable WITHOUT relying on colour - the spec's "avoid
          // colour-only status". Family glyphs (poison/frost/heal etc.) are always on regardless.
          colorblindStatusMarkers: false,
          // V0.20.39 (Roadmap Item 20 - high-contrast): off by default. When ON the current-target
          // reticle draws thicker and in pure black+white instead of the thin amber ring, so a
          // low-vision player can always see which enemy is targeted. Changes only the indicator's
          // look, nothing about targeting itself.
          highContrastTarget: false
        };
      }

      loadUiPrefs() {
        const defaults = this.defaultUiPrefs();
        try {
          const raw = window.localStorage?.getItem('dream-realms.ui-prefs.v1');
          if (!raw) return { ...defaults };
          const parsed = JSON.parse(raw);
          return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
        } catch (_err) {
          return { ...defaults };
        }
      }

      saveUiPrefs() {
        try { window.localStorage?.setItem('dream-realms.ui-prefs.v1', JSON.stringify(this.uiPrefs || this.defaultUiPrefs())); } catch (_err) {}
      }

      bindingForAction(action) {
        const defaults = this.defaultKeyBindings();
        return this.normalizeBindingKey((this.keyBindings || defaults)[action] || defaults[action] || '');
      }

      isActionKey(event, action) {
        return this.normalizeInputKeyFromEvent(event) === this.bindingForAction(action);
      }

      isHeldAction(action) {
        return this.keys?.has(this.bindingForAction(action));
      }

      beginKeyRebind(action) {
        this.pendingKeyRebindAction = action;
        this.renderSettingsPanel?.();
      }

      setKeyBinding(action, key) {
        if (!action) return false;
        const normalized = this.normalizeBindingKey(key);
        if (!normalized) return false;
        this.keyBindings = { ...(this.keyBindings || this.defaultKeyBindings()), [action]: normalized };
        this.pendingKeyRebindAction = null;
        this.saveKeyBindings();
        this.renderSettingsPanel?.();
        this.log?.(`Bound ${action} to ${this.displayKey(normalized)}.`);
        return true;
      }

      resetKeyBindings() {
        this.keyBindings = this.defaultKeyBindings();
        this.pendingKeyRebindAction = null;
        this.saveKeyBindings();
        this.renderSettingsPanel?.();
        this.log?.('Control bindings reset to defaults.');
      }


      isEditableTextTarget(event = null) {
        const el = event?.target || document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return false;
        const tag = String(el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        return Boolean(el.isContentEditable || el.closest?.('[contenteditable="true"]'));
      }

      isFullscreenActive() {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      }

      updateFullscreenUi() {
        const active = this.isFullscreenActive();
        document.body.classList.toggle('fullscreenActive', active);
        if (ui.menuFullscreenBtn) ui.menuFullscreenBtn.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
        if (ui.splashFullscreenBtn) ui.splashFullscreenBtn.textContent = active ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
      }

      async toggleFullscreen() {
        try {
          if (this.isFullscreenActive()) {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          } else {
            const target = document.documentElement;
            if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: 'hide' });
            else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
          }
        } catch (err) {
          this.log?.('Fullscreen request was blocked by the browser. Use the menu button or browser fullscreen shortcut.');
        }
        this.updateFullscreenUi();
        this.resize();
      }

      // UI setup / logo splash moved to systems/ui-system.js

      isChatInputFocused() {
        return !!(ui.chatInput && document.activeElement === ui.chatInput);
      }

      focusChatInput() {
        if (!ui.chatInput || !this.started || this.paused) return false;
        this.keys?.clear?.();
        this.playerIntentDx = 0;
        this.playerIntentDy = 0;
        ui.chatInput.focus();
        ui.chatInput.select?.();
        return true;
      }

      normalizeChatCommand(raw = '') {
        const text = String(raw || '').trim();
        if (!text) return '';
        const command = text.startsWith('/') ? text.slice(1) : text;
        if (/\s/.test(command)) return '';
        return command.toLowerCase();
      }

      submitChatInput() {
        const input = ui.chatInput;
        if (!input) return false;
        const raw = String(input.value || '').trim();
        input.value = '';
        input.blur?.();
        if (!raw) return false;
        const loweredRaw = raw.toLowerCase();
        if (loweredRaw === '/debug bots' || loweredRaw === 'debug bots') {
          if (typeof this.debugBotsCommand === 'function') return this.debugBotsCommand();
          this.logSystem?.('Bot debug command unavailable.');
          return true;
        }
        if (loweredRaw === '/meditate emote' || loweredRaw === 'meditate emote') {
          return this.triggerMeditateSlashEmote?.() || true;
        }
        if (loweredRaw === '/who' || loweredRaw === 'who') {
          if (typeof this.adventurerWhoCommand === 'function') return this.adventurerWhoCommand();
          this.logSystem?.('Adventurer roster unavailable.');
          return true;
        }
        const command = this.normalizeChatCommand(raw);
        if (command === 'dance') return this.startPlayerEmote('dance');
        if (command === 'sit') {
          if (this.player?.emoteState === 'sit') return this.stopPlayerEmote('sit', 'toggle');
          return this.startPlayerEmote('sit');
        }
        if (command === 'stand') return this.stopPlayerEmote(this.player?.emoteState || '', 'stand');
        const name = this.player?.name || 'You';
        if (this.activeLogTab === 'Party') this.logParty?.(`${name}: ${raw}`);
        else this.logChat?.(`${name}: ${raw}`);
        return true;
      }

      startPlayerEmote(kind) {
        const p = this.player;
        if (!p || !p.alive) return false;
        const emote = String(kind || '').toLowerCase();
        if (!['dance', 'sit'].includes(emote)) return false;
        if (this.isEntityInCombat?.(p) || p.autoAttack || Number(p.combatCooldown || 0) > 0) {
          this.log?.('You cannot emote while in combat.');
          return false;
        }
        if (p.meditating) this.cancelMeditation?.(p, 'emote', { silent: true });
        if (p.fishing) this.fishingSystem?.cancelFishing?.('Fishing cancelled.');
        if (this.resourceGatheringSystem?.active) this.resourceGatheringSystem.cancelHarvest?.('Gathering cancelled.');
        if (p.emoteState && p.emoteState !== emote) this.stopPlayerEmote(p.emoteState, 'new emote');
        this.clearClickMoveTarget?.();
        p.vx = 0;
        p.vy = 0;
        p.moveBlend = 0;
        p.emoteState = emote;
        p.emoteActive = true;
        p.emoteStartedAt = performance.now();
        p.emoteAnim = 0;
        p.action = emote;
        p.currentAction = emote;
        p.animationState = emote;
        p.currentAnimation = emote;
        if (emote === 'dance') this.log?.('You start dancing.');
        else this.log?.('You sit down.');
        this.playSfx?.('ui_select', { volume: 0.22, cooldown: 0.12 });
        return true;
      }

      stopPlayerEmote(expected = '', reason = '', options = {}) {
        const p = this.player;
        if (!p || !p.emoteActive) return false;
        const active = String(p.emoteState || '').toLowerCase();
        const wanted = String(expected || '').toLowerCase();
        if (wanted && active && active !== wanted && !['movement','damage','action','stand','toggle','new emote'].includes(String(reason || '').toLowerCase())) return false;
        p.emoteActive = false;
        p.emoteState = '';
        p.emoteStartedAt = 0;
        p.emoteAnim = 0;
        p.action = '';
        p.currentAction = null;
        p.animationState = 'idle';
        p.currentAnimation = 'idle';
        if (!options.silent) {
          if (active === 'dance') this.log?.('You stop dancing.');
          else if (active === 'sit') this.log?.('You stand up.');
        }
        return true;
      }

      cancelPlayerEmote(reason = 'action', options = {}) {
        if (!this.player?.emoteActive) return false;
        return this.stopPlayerEmote(this.player.emoteState, reason, options);
      }

      bindEvents() {
        window.addEventListener('resize', () => this.resize());
        // Main-menu input routing: clicking/tapping empty space on the splash must do
        // nothing. Every legitimate transition off the splash (login, create account,
        // load game, character selection) is wired to its own explicit button handler
        // below; there is intentionally no generic "any click closes the menu" path.
        // Main-menu button routing is owned by UiSystem.bindMainMenuActions().
        // Keep in-game menu controls here only; the splash uses a single delegated
        // Blackroot action dispatcher so visible buttons and click targets cannot drift.
        ui.menuPatchNotesBtn?.addEventListener('click', e => {
          e.preventDefault();
          this.ensureMenuButtonOwnership?.();
          this.refreshPatchNotesPanels?.();
          const panel = ui.menuPatchNotesPanel;
          if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        ui.menuFullscreenBtn?.addEventListener('click', e => {
          e.preventDefault();
          this.toggleFullscreen();
        });
        document.addEventListener('fullscreenchange', () => this.updateFullscreenUi());
        document.addEventListener('webkitfullscreenchange', () => this.updateFullscreenUi());
        window.addEventListener('keydown', e => {
          if (this.layeredMapEditor?.active) return;
          if (e.repeat || this.isEditableTextTarget(e)) return;
          const key = this.normalizeInputKeyFromEvent(e);
          const corpseLootKey = key === 'e' || this.isActionKey(e, 'interact');
          if (!corpseLootKey) return;
          if (this.tryInteractCorpseLoot?.({ silent: true, range: 4.5, fromKey: true })) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }, true);

        window.addEventListener('keydown', e => {
          if (this.layeredMapEditor?.active) return;
          const key = this.normalizeInputKeyFromEvent(e);
          if (this.pendingKeyRebindAction) {
            e.preventDefault();
            this.setKeyBinding(this.pendingKeyRebindAction, key);
            return;
          }
          if (this.isEditableTextTarget(e)) return;
          if (this.isActionKey(e, 'fullscreen')) { e.preventDefault(); this.toggleFullscreen(); return; }
          if (this.isActionKey(e, 'debugOverlay')) { e.preventDefault(); this.toggleDebugOverlay(); return; }
          if (key === 'f4') { e.preventDefault(); this.cyclePerformancePreset?.(); return; }
          if (key === 'f5') { e.preventDefault(); this.toggleLowSpecPerformanceMode?.(); return; }
          if (key === 'f6') { e.preventDefault(); this.togglePerformanceBenchmark?.(); return; }
          if (key === 'escape') {
            e.preventDefault();
            this.hideWorldContextMenu?.();
            if (this.started && !this.paused) this.toggleMenu?.();
            return;
          }
          if ([this.bindingForAction('moveUp'), this.bindingForAction('moveDown'), this.bindingForAction('moveLeft'), this.bindingForAction('moveRight'), this.bindingForAction('jump'), this.bindingForAction('targetNearest'), 'enter'].includes(key)) e.preventDefault();
          if (ui.logoSplash && ui.logoSplash.style.display !== 'none' && ['enter', 'a', 'space'].includes(key)) {
            e.preventDefault();
            this.showAccountPanel?.('login');
            return;
          }
          if (key === 'enter' && this.started && !this.paused && !e.repeat) {
            e.preventDefault();
            this.focusChatInput?.();
            return;
          }
          this.keys.add(key);

          if (!this.started) return;
          if (this.isActionKey(e, 'pause')) this.togglePause();
          if (this.paused) return;

          if (this.isActionKey(e, 'jump') && !e.repeat) this.playerJump();
          if (this.isActionKey(e, 'targetNearest') && !e.repeat) this.targetNearest();
          if (this.isActionKey(e, 'autoAttack') && !e.repeat && !e.shiftKey) this.playerAttack();
          // V0.17.71 BUG 1: number keys cast bar 1 slots 0-8; Shift+number casts
          // bar 2 slots 9-17. Slots resolve their assigned spell (drag-to-assign).
          for (const [action, slot] of [['spell2',0],['spell3',1],['spell4',2],['spell5',3],['spell6',4],['spell7',5],['spell8',6],['spell9',7],['spell0',8]]) {
            if (this.isActionKey(e, action)) this.useHotbarSlot(e.shiftKey ? slot + 9 : slot);
          }
          if (this.isActionKey(e, 'meditate') && !e.repeat) this.toggleMeditate();
          if (this.isActionKey(e, 'portal') && !e.repeat) { e.preventDefault(); this.tryCastPortalSpell?.(); }
          if (this.isActionKey(e, 'bags')) this.toggleBag();
          if (this.isActionKey(e, 'character')) this.toggleCharacterPanel?.();
          if (this.isActionKey(e, 'skills')) this.toggleSkillsPanel?.();
          if (this.isActionKey(e, 'talents')) this.toggleTalentPanel?.();
          if (this.isActionKey(e, 'spellbook')) this.toggleSpellbookWindow?.();
          if (this.isActionKey(e, 'map')) this.toggleMap();
          if (this.isActionKey(e, 'party')) this.togglePartyPanel();
          if (this.isActionKey(e, 'hireMerc')) {
            if (this.merc) this.dismissMerc();
            else this.hireMerc('cleric');
          }
        });

        window.addEventListener('keyup', e => this.keys.delete(this.normalizeInputKeyFromEvent(e)));

        canvas.addEventListener('mousemove', e => {
          const rect = canvas.getBoundingClientRect();
          this.mouse.x = e.clientX - rect.left;
          this.mouse.y = e.clientY - rect.top;
          this.updateGroundLootHoverAtScreen?.(e.clientX, e.clientY, this.mouse.x, this.mouse.y);
        });

        canvas.addEventListener('pointerdown', e => {
          const primaryButton = e.button == null || e.button === 0;
          if (!this.started || this.paused || !primaryButton || e.target !== canvas || e.isPrimary === false) return;
          const rect = canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const clickedWeb = this.pickSpiderWebAtScreen?.(sx, sy);
          if (clickedWeb) {
            e.preventDefault();
            e.stopPropagation();
            this.clearClickMoveTarget();
            this.selectSpiderWebTarget?.(clickedWeb, { source: 'left_click' });
            this.lastClickToWalkAt = performance.now();
            return;
          }
          const clickedEnemy = this.pickEnemyAtScreen?.(sx, sy);
          if (clickedEnemy) {
            e.preventDefault();
            e.stopPropagation();
            this.clearClickMoveTarget();
            this.selectHostileTarget?.(clickedEnemy, { source: 'left_click', autoAttack: false });
            this.lastClickToWalkAt = performance.now();
            return;
          }
          const clickedFriendly = this.pickFriendlyAtScreen?.(sx, sy);
          if (clickedFriendly) {
            e.preventDefault();
            e.stopPropagation();
            this.clearClickMoveTarget();
            this.selectFriendlyTarget?.(clickedFriendly, { source: 'left_click' });
            this.lastClickToWalkAt = performance.now();
            return;
          }
          const clickedCorpse = this.pickCorpseAtScreen?.(sx, sy);
          if (clickedCorpse) {
            e.preventDefault();
            e.stopPropagation();
            this.clearClickMoveTarget();
            if (clickedCorpse.temporaryGroundItem) this.tryPickupTemporaryGroundItem?.(clickedCorpse);
            else this.openCorpseLootWindow?.(clickedCorpse);
            this.lastClickToWalkAt = performance.now();
            return;
          }
          const world = this.safeScreenToWorld(sx, sy);
          if (!world) return;
          e.preventDefault();
          if (this.setClickMoveTarget(world.x, world.y, { screenX: sx, screenY: sy })) this.lastClickToWalkAt = performance.now();
        }, { passive: false });


        canvas.addEventListener('contextmenu', e => {
          if (!this.started || this.paused || e.target !== canvas) return;
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const clickedWeb = this.pickSpiderWebAtScreen?.(sx, sy);
          if (clickedWeb) {
            this.clearClickMoveTarget?.();
            this.hideWorldContextMenu?.();
            this.selectSpiderWebTarget?.(clickedWeb, { source: 'right_click' });
            return;
          }
          const clickedEnemy = this.pickEnemyAtScreen?.(sx, sy);
          if (clickedEnemy) {
            this.clearClickMoveTarget?.();
            this.hideWorldContextMenu?.();
            this.selectHostileTarget?.(clickedEnemy, { source: 'right_click' });
            return;
          }
          const clickedFriendly = this.pickFriendlyAtScreen?.(sx, sy);
          if (clickedFriendly) {
            this.clearClickMoveTarget?.();
            const opened = this.showWorldContextMenu?.(e.clientX, e.clientY, { x: clickedFriendly.x, y: clickedFriendly.y, actor: clickedFriendly });
            if (!opened) this.selectFriendlyTarget?.(clickedFriendly, { source: 'right_click' });
            return;
          }
          const world = this.safeScreenToWorld?.(sx, sy);
          const clickedNpc = world ? this.npcSystem?.findNpcAtWorld?.(world, { maxDistance: 1.15 }) : null;
          if (clickedNpc) {
            this.clearClickMoveTarget?.();
            this.showWorldContextMenu?.(e.clientX, e.clientY, { x: Number(clickedNpc.x) + 0.5, y: Number(clickedNpc.y) + 0.5, npc: clickedNpc });
            return;
          }
          if (!world) return;
          this.showWorldContextMenu(e.clientX, e.clientY, world);
        }, { passive: false });

        window.addEventListener('pointerdown', e => {
          const menu = document.getElementById('worldContextMenu');
          if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) this.hideWorldContextMenu();
          const partyMenu = document.getElementById('partyMemberContextMenu');
          if (partyMenu && partyMenu.style.display !== 'none' && !partyMenu.contains(e.target) && !e.target.closest?.('[data-party-member-id]')) this.hidePartyMemberContextMenu?.();
        });

        window.addEventListener('keydown', e => {
          if (e.key === 'Escape') {
            this.hideWorldContextMenu();
            this.hidePartyMemberContextMenu?.();
          }
        });

        canvas.addEventListener('wheel', e => {
          if (!this.started) return;
          e.preventDefault();
          const dy = clamp(Number(e.deltaY) || 0, -120, 120);
          if (Math.abs(dy) < 1) return;
          this.adjustCameraZoom(dy < 0 ? 1 : -1);
        }, { passive: false });

        ui.copyPeerBtn.addEventListener('click', () => this.copyPeerId());
        ui.partyPanel.addEventListener('click', e => {
          const btn = e.target.closest('button[data-party-action]');
          if (!btn) return;
          const action = btn.dataset.partyAction;
          const peerId = btn.dataset.peerId;
          const inviteId = btn.dataset.inviteId;
          const memberId = btn.dataset.partyMemberId;
          const command = btn.dataset.command;
          if (action === 'invite') this.invitePeer(peerId);
          else if (action === 'companionCommand') this.handlePartyCompanionCommand?.(memberId, command);
          else if (action === 'accept') this.acceptPartyInvite(inviteId);
          else if (action === 'decline') this.declinePartyInvite(inviteId);
          else if (action === 'leave') this.leaveParty();
          else if (action === 'inviteMerc') this.inviteMercToParty?.();
          else if (action === 'removeMerc') this.removeMercFromParty?.();
          // Phase 10 (Intersect parity): local player-to-player trade.
          else if (action === 'trade') this.requestTrade?.(peerId);
          else if (action === 'acceptTrade') this.acceptTradeInvite?.(inviteId);
          else if (action === 'declineTrade') this.declineTradeInvite?.(inviteId);
        });

        this.installWorldSaveControls?.();
        this.bindSteamDeckEvents?.();
      }

      performanceSettings() {
        // V0.17.98: memoized. performanceVerifier.effectiveBaseSettings allocates a fresh
        // object every call (Object.assign), which ALSO breaks adaptivePerformance's
        // identity-keyed cache so it re-allocates too. This method is called hundreds of
        // times per frame (enemy AI banding alone called it ~920x/frame => ~2500 object
        // allocations/frame => ~88 ms of GC/CPU). Rebuild only when the preset / lowSpec /
        // adaptive level / adaptive-enabled actually change; otherwise return the cached
        // object (result is read-only for all callers).
        const verifier = this.performanceVerifier;
        const adaptive = this.adaptivePerformance;
        const level = adaptive ? adaptive.level : -1;
        const preset = verifier ? verifier.preset : '';
        const lowSpec = verifier && verifier.lowSpecMode ? 1 : 0;
        const enabled = adaptive ? (adaptive.enabled !== false) : true;
        const cache = this._perfSettingsCache;
        if (cache && cache.level === level && cache.preset === preset && cache.lowSpec === lowSpec && cache.enabled === enabled) {
          return cache.value;
        }
        let base = DR.CONFIG?.PERFORMANCE || {};
        if (verifier?.effectiveBaseSettings) base = verifier.effectiveBaseSettings(base);
        const value = adaptive?.effectiveSettings ? adaptive.effectiveSettings(base) : base;
        this._perfSettingsCache = { value, level, preset, lowSpec, enabled };
        return value;
      }

      // Combined user (slider) x adaptive (per-level) render-resolution scale, clamped
      // to [minRenderScale, 1]. 1 = full native resolution.
      effectiveRenderScale(perf) {
        perf = perf || this.performanceSettings?.() || {};
        const floor = Math.max(0.25, Number(perf.minRenderScale ?? CONFIG.PERFORMANCE?.minRenderScale) || 0.5);
        const user = Number.isFinite(Number(this.userRenderScale)) ? Number(this.userRenderScale) : 1;
        const adaptive = Number.isFinite(Number(perf.renderScale)) ? Number(perf.renderScale) : 1;
        return Math.max(floor, Math.min(1, user * adaptive));
      }

      // Persist the user's render-resolution preference and re-apply it. Clamped to
      // [minRenderScale, 1]; the actual backing resolution is user x adaptive x budget.
      setRenderResolutionScale(scale, options = {}) {
        const perf = this.performanceSettings?.() || {};
        const floor = Math.max(0.25, Number(perf.minRenderScale ?? CONFIG.PERFORMANCE?.minRenderScale) || 0.5);
        const clamped = Math.max(floor, Math.min(1, Number(scale) || 1));
        this.userRenderScale = clamped;
        try { localStorage.setItem('dreamRealms.renderScale', String(clamped)); } catch (_) {}
        this.resize?.();
        if (options.log !== false) this.logSystem?.(`Render resolution set to ${Math.round(clamped * 100)}%.`);
        return clamped;
      }

      displayPixelRatio() {
        const raw = Math.max(1, Number(window.devicePixelRatio) || 1);
        const perf = this.performanceSettings?.() || {};
        const mode = String(this.performanceMode || perf.mode || 'balanced').toLowerCase();
        const maxDpr = mode === 'quality'
          ? Number(perf.highQualityMaxDpr || 1.5)
          : Number(perf.maxDpr || 1.25);
        let dpr = Math.min(raw, Math.max(1, Math.min(1.75, maxDpr || 1.25)));
        // V0.17.95: render-resolution scaling. The world renders in CSS-pixel space and
        // is scaled to the backing store by this dpr, so reducing it only softens the
        // world image - it never affects layout, HUD/DOM, or pointer mapping (mouse
        // coords come from getBoundingClientRect in CSS px). Apply the user/adaptive
        // scale, then clamp by an absolute backing-pixel budget for very high-res
        // displays. Floor keeps it from collapsing to an unreadable resolution.
        const floor = Math.max(0.25, Number(perf.minRenderScale ?? CONFIG.PERFORMANCE?.minRenderScale) || 0.5);
        dpr *= this.effectiveRenderScale ? this.effectiveRenderScale(perf) : 1;
        const budget = Math.max(0, Number(perf.maxRenderPixels ?? CONFIG.PERFORMANCE?.maxRenderPixels) || 0);
        if (budget > 0) {
          const size = this.displayTargetSize?.() || {};
          const cssW = Math.max(1, Number(size.viewportWidth) || Number(window.innerWidth) || 2560);
          const cssH = Math.max(1, Number(size.viewportHeight) || Number(window.innerHeight) || 1440);
          const budgetScale = Math.sqrt(budget / (cssW * cssH));
          if (Number.isFinite(budgetScale) && budgetScale > 0) dpr = Math.min(dpr, budgetScale);
        }
        return Math.max(floor * 0.9, dpr);
      }

      worldRenderPadTiles() {
        const perf = this.performanceSettings?.() || {};
        const configured = Number(perf.renderPad || CONFIG.RENDER_PAD || 20);
        const zoom = clamp(this.camera?.zoom || 1, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        return Math.ceil(configured / zoom) + 4;
      }

      shouldDrawExpensiveWorldEffect(key) {
        const perf = this.performanceSettings?.() || {};
        if (String(this.performanceMode || perf.mode || 'balanced').toLowerCase() === 'quality') return true;
        if (key === 'sunShafts') return perf.enableSunShafts !== false;
        if (key === 'dustMotes') return perf.enableDustMotes !== false || perf.weatherAlwaysVisibleOutsideCaves === true;
        if (key === 'weatherForeground') {
          const visual = this.getWeatherVisualState?.();
          const activeWeather = visual && visual.category !== 'clear' && visual.particleDensity > 0;
          return perf.enableWeatherForeground !== false || (perf.weatherAlwaysVisibleOutsideCaves === true && activeWeather);
        }
        if (key === 'weatherSkyOverlay') {
          const visual = this.getWeatherVisualState?.();
          const activeWeather = visual && visual.category !== 'clear' && Number(visual.weatherSkyInfluence || 0) > 0.01;
          return perf.enableWeatherSkyOverlay !== false || (perf.weatherAlwaysVisibleOutsideCaves === true && activeWeather);
        }
        return true;
      }

      detectRenderBackendCapabilities(force = false) {
        if (this.renderBackendCaps && !force) return this.renderBackendCaps;
        const caps = {
          webgl: false,
          webgl2: false,
          bitmapRenderer: false,
          offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
          probedAt: performance.now?.() || Date.now()
        };
        if (DR.CONFIG?.PERFORMANCE?.enableRenderBackendProbe === false) {
          this.renderBackendCaps = caps;
          return caps;
        }
        try {
          const probe = document.createElement('canvas');
          probe.width = 2;
          probe.height = 2;
          caps.webgl2 = !!probe.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: false });
          caps.webgl = caps.webgl2 || !!(probe.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: false }) || probe.getContext('experimental-webgl'));
          caps.bitmapRenderer = !!probe.getContext('bitmaprenderer');
        } catch (_err) {
          caps.error = 'probe failed';
        }
        this.renderBackendCaps = caps;
        if (this.perfStats) {
          this.perfStats.renderBackendWebgl = !!caps.webgl;
          this.perfStats.renderBackendWebgl2 = !!caps.webgl2;
          this.perfStats.renderBackendBitmapRenderer = !!caps.bitmapRenderer;
          this.perfStats.renderBackendOffscreenCanvas = !!caps.offscreenCanvas;
        }
        return caps;
      }

      worldPointInsideViewportFast(wx, wy, elev = 0, padPx = 720, projection = null) {
        const p = projection || this.getCameraProjectionCache?.();
        if (!p) return true;
        const dx = Number(wx) - p.centerX;
        const dy = Number(wy) - p.centerY;
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
        const px = dx * p.cos - dy * p.sin;
        const py = dx * p.sin + dy * p.cos;
        const sx = (px - py) * p.tileHalfW + p.halfWidth;
        const sy = (px + py) * p.tileHalfH - ((Number(elev) || 0) - p.centerElev) * CONFIG.ELEV_STEP + p.halfHeight;
        const pad = Math.max(0, Number(padPx) || 0) / Math.max(0.35, Number(p.zoom) || 1);
        return sx >= -pad && sy >= -pad && sx <= p.width + pad && sy <= p.height + pad;
      }

      refreshEnemySpatialGrid(force = false) {
        const frame = this._perfFrameId || 0;
        const grid = this.enemySpatialGrid || (this.enemySpatialGrid = { cellSize: DR.CONFIG?.PERFORMANCE?.enemySpatialCellSize || 8, cells: new Map(), sourceCount: 0, builtFrame: -1 });
        if (!force && grid.builtFrame === frame && grid.sourceCount === (this.enemies?.length || 0)) return grid;
        const cellSize = Math.max(4, Number(grid.cellSize || DR.CONFIG?.PERFORMANCE?.enemySpatialCellSize || 8));
        grid.cellSize = cellSize;
        grid.cells.clear();
        for (const enemy of this.enemies || []) {
          if (!enemy || enemy.alive === false || !Number.isFinite(Number(enemy.x)) || !Number.isFinite(Number(enemy.y))) continue;
          const cx = Math.floor(Number(enemy.x) / cellSize);
          const cy = Math.floor(Number(enemy.y) / cellSize);
          const key = `${cx}:${cy}`;
          let bucket = grid.cells.get(key);
          if (!bucket) grid.cells.set(key, bucket = []);
          bucket.push(enemy);
        }
        grid.sourceCount = this.enemies?.length || 0;
        grid.builtFrame = frame;
        return grid;
      }

      queryEnemiesNearPoint(x, y, radius = 12, options = {}) {
        const px = Number(x);
        const py = Number(y);
        const r = Math.max(0.25, Number(radius) || 12);
        if (!Number.isFinite(px) || !Number.isFinite(py)) return [];
        const grid = this.refreshEnemySpatialGrid?.() || this.enemySpatialGrid;
        if (!grid?.cells) return (this.enemies || []).filter(enemy => enemy?.alive !== false);
        const cellSize = Math.max(4, Number(grid.cellSize) || 8);
        const minCx = Math.floor((px - r) / cellSize);
        const maxCx = Math.floor((px + r) / cellSize);
        const minCy = Math.floor((py - r) / cellSize);
        const maxCy = Math.floor((py + r) / cellSize);
        const result = [];
        const radiusSq = r * r;
        for (let cy = minCy; cy <= maxCy; cy++) {
          for (let cx = minCx; cx <= maxCx; cx++) {
            const bucket = grid.cells.get(`${cx}:${cy}`);
            if (!bucket) continue;
            for (const enemy of bucket) {
              if (!enemy || enemy.alive === false) continue;
              if (options.zone && enemy.zone && enemy.zone !== options.zone) continue;
              const dx = Number(enemy.x) - px;
              const dy = Number(enemy.y) - py;
              if (dx * dx + dy * dy <= radiusSq) result.push(enemy);
            }
          }
        }
        return result;
      }

      queryEnemiesNearEntity(entity, radius = 12, options = {}) {
        if (!entity) return [];
        return this.queryEnemiesNearPoint?.(entity.x, entity.y, radius, options) || [];
      }

      objectChunkZoneKey() {
        const active = this.dungeonSystem?.state?.active || this.activeDungeon;
        const dungeonId = active?.dungeonId || active?.id || '';
        const floor = active?.floor || '';
        return `${this.currentZone || 'overworld'}:${dungeonId}:${floor}`;
      }

      markObjectChunkIndexDirty(reason = 'objects changed') {
        const index = this.objectChunkIndex || (this.objectChunkIndex = { chunks: new Map(), dirty: true });
        index.dirty = true;
        index.lastDirtyReason = String(reason || 'objects changed');
      }

      refreshObjectChunkIndex(force = false) {
        const perf = this.performanceSettings?.() || {};
        if (perf.enableObjectChunkIndex === false) return null;
        const frame = this._perfFrameId || 0;
        const index = this.objectChunkIndex || (this.objectChunkIndex = { chunks: new Map(), dirty: true });
        const zoneKey = this.objectChunkZoneKey?.() || 'overworld';
        const cellSize = Math.max(4, Number(perf.objectChunkSize || index.cellSize || 16));
        const auditFrames = Math.max(15, Number(perf.objectIndexAuditFrames || 90));
        const shouldAudit = !Number.isFinite(Number(index.lastAuditFrame)) || frame - Number(index.lastAuditFrame) >= auditFrames;
        const objectRows = this.objects || [];
        if (!force && !index.dirty && index.objectsRef === objectRows && index.zoneKey === zoneKey && index.cellSize === cellSize && !shouldAudit) return index;
        index.cellSize = cellSize;
        index.zoneKey = zoneKey;
        index.objectsRef = objectRows;
        index.mapRef = this.map || null;
        index.chunks = index.chunks instanceof Map ? index.chunks : new Map();
        index.chunks.clear();
        index.objectCount = 0;
        const chunkBoundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        const maxRows = Math.min(objectRows.length || 0, chunkBoundsSize || objectRows.length || 0);
        for (let y = 0; y < maxRows; y++) {
          const row = objectRows[y];
          if (!Array.isArray(row)) continue;
          const maxCols = Math.min(row.length || 0, chunkBoundsSize || row.length || 0);
          for (let x = 0; x < maxCols; x++) {
            const obj = row[x];
            if (!obj) continue;
            const cx = Math.floor(x / cellSize);
            const cy = Math.floor(y / cellSize);
            const key = `${cx}:${cy}`;
            let bucket = index.chunks.get(key);
            if (!bucket) index.chunks.set(key, bucket = []);
            bucket.push({ x, y, obj, elev: Number(this.map?.[y]?.[x]?.elev) || 0 });
            index.objectCount += 1;
          }
        }
        index.dirty = false;
        index.builtFrame = frame;
        index.lastAuditFrame = frame;
        if (this.perfStats) {
          this.perfStats.objectChunkCacheEntries = index.chunks.size;
          this.perfStats.objectIndexObjects = index.objectCount;
        }
        return index;
      }

      collectObjectChunkEntries(minX, maxX, minY, maxY) {
        const index = this.refreshObjectChunkIndex?.();
        if (!index?.chunks?.size) return [];
        const cellSize = Math.max(4, Number(index.cellSize) || 16);
        const minCx = Math.floor(minX / cellSize);
        const maxCx = Math.floor(maxX / cellSize);
        const minCy = Math.floor(minY / cellSize);
        const maxCy = Math.floor(maxY / cellSize);
        const scratch = this.renderScratch || (this.renderScratch = {});
        const out = scratch.objectChunkEntries || (scratch.objectChunkEntries = []);
        out.length = 0;
        let chunksVisited = 0;
        for (let cy = minCy; cy <= maxCy; cy++) {
          for (let cx = minCx; cx <= maxCx; cx++) {
            const bucket = index.chunks.get(`${cx}:${cy}`);
            if (!bucket?.length) continue;
            chunksVisited += 1;
            for (const entry of bucket) {
              if (entry.x < minX || entry.x > maxX || entry.y < minY || entry.y > maxY) continue;
              out.push(entry);
            }
          }
        }
        if (this.perfStats) {
          this.perfStats.objectChunksVisited = chunksVisited;
          this.perfStats.objectChunkCacheEntries = index.chunks.size;
          this.perfStats.objectIndexObjects = index.objectCount || 0;
        }
        return out;
      }

      applyCanvasDisplayTransform() {
        const dpr = this.displayPixelRatio?.() || 1;
        if (ctx?.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        else if (ctx?.resetTransform) {
          ctx.resetTransform();
          ctx.scale(dpr, dpr);
        }
        ctx.imageSmoothingEnabled = false;
      }

      displayTargetSize() {
        const targetWidth = Math.max(1, Math.floor(Number(CONFIG.DISPLAY_TARGET_WIDTH) || 2560));
        const targetHeight = Math.max(1, Math.floor(Number(CONFIG.DISPLAY_TARGET_HEIGHT) || 1440));
        const viewportWidth = Math.max(1, Math.floor(Number(window.innerWidth) || targetWidth));
        const viewportHeight = Math.max(1, Math.floor(Number(window.innerHeight) || targetHeight));
        return { targetWidth, targetHeight, viewportWidth, viewportHeight };
      }

      resize() {
        const dpr = this.displayPixelRatio();
        const size = this.displayTargetSize?.() || { viewportWidth: window.innerWidth || 2560, viewportHeight: window.innerHeight || 1440 };
        const cssWidth = size.viewportWidth;
        const cssHeight = size.viewportHeight;
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.dataset.targetWidth = String(size.targetWidth || 2560);
        canvas.dataset.targetHeight = String(size.targetHeight || 1440);
        document.documentElement?.style?.setProperty?.('--game-target-width', `${size.targetWidth || 2560}px`);
        document.documentElement?.style?.setProperty?.('--game-target-height', `${size.targetHeight || 1440}px`);
        this.applyCanvasDisplayTransform();
      }

      start(className, appearance = {}) {
        // Central world-entry transition (single owner of world entry). Every field
        // Player() derives from class/race data tables self-heals to a safe default
        // (unknown class -> Fighter, unknown race -> Human, blank name -> class name),
        // so the one placeholder value that would otherwise survive verbatim is an
        // explicit "Unchosen" name - refuse it here rather than let it reach the world.
        if (String(appearance?.name ?? '').trim() === 'Unchosen') {
          this.log?.('Blocked world entry: no character was selected or created.');
          this.showCharacterSlotsScreen?.();
          return false;
        }
        // V0.20.2: a character's belongings live on the GAME, not on Player - so a fresh Player alone
        // does NOT make a fresh character. Without this, creating a second character kept the first
        // one's gear, bags, bank, quests and profession levels (and, since classStartingGearGranted
        // survived, denied the new character its starter kit). World entry is the single owner of that
        // reset. The load path is unaffected: it calls applyCharacterState() straight after start(),
        // which restores the saved character over the top of this.
        this.resetCharacterOwnedState?.();
        this.player = new Player(className, appearance);
        this.peerName = this.player.name;
        this.entities.push(this.player);
        // V0.16.31: world entry owns teardown of the main-menu/modal stack so a stale
        // fullscreen Blackroot splash cannot remain above gameplay and appear as a
        // post-login black screen.
        this.enterGameplayDisplayMode?.('start');
        if (ui.logoSplash) { ui.logoSplash.style.display = 'none'; ui.logoSplash.setAttribute('aria-hidden', 'true'); }
        if (ui.accountPanel) ui.accountPanel.style.display = 'none';
        if (ui.splashPatchNotesPanel) ui.splashPatchNotesPanel.style.display = 'none';
        if (ui.splashSettingsPanel) ui.splashSettingsPanel.style.display = 'none';
        ui.classScreen.style.display = 'none';
        if (ui.characterSlotScreen) ui.characterSlotScreen.style.display = 'none';
        this.activeCharacterSlotIndex = Number.isInteger(this.pendingCharacterSlotIndex) ? this.pendingCharacterSlotIndex : this.activeCharacterSlotIndex;
        this.updateSpellHotbar();
        this.started = true;
        // V0.16.32: gameplay state is the single owner after a character is chosen.
        // Re-apply the handoff after started=true so UI update gates and CSS selectors
        // cannot briefly re-open menu overlays or leave the canvas hidden.
        this.enterGameplayDisplayMode?.('started');
        document.body.classList.add('gameStarted');
        document.body.classList.remove('blackrootMenuActive');
        this.ensureGameplayHudChrome?.('start');
        this.ensureMenuButtonOwnership?.();
        this.resize?.();
        this.unlockAudioSystem?.();
        this.playSfx?.('ui_select', { volume: 0.35, cooldown: 0.1 });
        this.playPendingZoneMusic?.();
        this.recenterCameraOnPlayer?.(true);
        this.log(`Entered Blackroot: Dark Woods as ${this.player.className}.`);
        this.log('Dead Lantern Camp anchors Dark Woods. Named cave routes now branch into Mossfang Cave, Silk Web Cavern, Ashroot Hollow, Crystal Grotto, Forgotten Mine, and Blackroot Catacombs.');
        this.log('Caves now use small/medium/large multi-floor layouts with stair transitions, cave-specific resources, cave loot tables, and deeper dungeon hooks.');
        this.log('Professions are active: gather, mine, fish, cook, and smith. Use G near resource nodes, F near water, C near stations, and Skills for profession levels.');
        this.log('Fishing now has visible pole animations, cast/wait/reel states, animated bobbers, and fish swimming through rivers, ponds, lakes, and cave pools.');
        this.log('WASD/click-to-walk movement is enabled. Space jumps. Left/Right arrows rotate the camera. Steam Deck controls are supported.');
        this.log('Browser-local multiplayer is active. Open this file in another tab/window and press O for party controls.');
        this.log('Press B for bags and M for the full map. Press E near NPCs/chests/events/dungeon entrances, F near water, G near resources, and C near crafting stations.');
        this.log('Enemies drop class-aware randomized loot. Stand near a lootable corpse and press E to open Corpse Loot.');
        if (this.worldSaveLoadedAtBoot) this.log('Loaded saved world state for Dark Woods.');
        if (this.worldSaveMigratedAtBoot) this.log('Saved world was migrated to the current format. A backup copy was preserved.');
        if (this.worldSaveLoadErrorAtBoot) this.log(`Ignored invalid saved world and restored default: ${this.worldSaveLoadErrorAtBoot}`);
        this.log('World tools: F9 save · F8 load · F7 reset · F6 export · F4 import. Account saves: autosave every 15 minutes with bound character slots · F5 choose save folder · F10 export current character JSON.');
        this.initSteamDeckSupport?.();
        if (window.innerWidth <= 1280 && window.innerHeight <= 850) {
          this.log('Steam Deck layout active: A jump, B interact/back, X attack, Y target, Start menu, Select map, D-pad panels, sticks move/camera.');
        }
        this.notifyExternalSystems('player-started', { className: this.player.className });
        this.ensureBotPlayers?.();
        this.initAdventurerPopulation?.();
        this.grantClassStartingGear?.(this.player.className);
        this.addItem(this.generateLoot({ level: 1, name: 'Starting Cache' }, true));
        const hasStarterTool = itemId => (this.inventory || []).some(item => String(item.itemId || item.sourceItemId || item.id || '') === itemId);
        const starterTools = [
          ['item_crude_pickaxe', 'Crude Pickaxe'],
          ['item_basic_fishing_rod', 'Basic Fishing Rod'],
          ['item_herbalist_knife', 'Herbalist Knife'],
          ['item_worn_hatchet', 'Worn Hatchet']
        ];
        for (const [itemId, name] of starterTools) {
          if (!hasStarterTool(itemId)) {
            this.grantEditorItem?.(itemId, 1, { rarityKey: 'white' });
            this.log(`Starter tool added: ${name}.`);
          }
        }
        this.recalculatePlayerStats();
        this.updateSpellHotbar?.();
        this.renderBag();
        this.broadcastLocalPeerState(true);
      }

      togglePause() {
        this.paused = !this.paused;
        ui.pauseOverlay.style.display = this.paused ? 'grid' : 'none';
      }

      installExternalSystems() {
        if (this.externalSystemsInstalled) return;
        this.externalSystemsInstalled = true;
        const systems = window.DreamRealmsSystems || [];
        for (const system of systems) {
          if (!system || !system.id || this.systemLookup[system.id]) continue;
          if (typeof system.install !== 'function') continue;
          const runtime = system.install(this);
          if (!runtime) continue;
          this.externalSystems.push(runtime);
          this.systemLookup[system.id] = runtime;
        }
      }

      recordRuntimeSystemFault(system, phase, err) {
        const id = String(system?.id || system?.name || 'external-system');
        const key = `${phase}:${id}`;
        const now = performance.now();
        this.runtimeSystemFaults = this.runtimeSystemFaults || {};
        const fault = this.runtimeSystemFaults[key] || { count: 0, lastAt: 0 };
        fault.count += 1;
        if (now - fault.lastAt > 2500) {
          fault.lastAt = now;
          console.error(`[Blackroot] ${phase} fault in ${id}`, err);
        }
        this.runtimeSystemFaults[key] = fault;
      }

      updateExternalSystems(dt) {
        for (const system of this.externalSystems) {
          if (!system || typeof system.update !== 'function') continue;
          try {
            system.update(dt);
          } catch (err) {
            this.recordRuntimeSystemFault(system, 'update', err);
          }
        }
        // V0.17.91 fog of war: reveal terrain around the player as they explore.
        try { this.fogUpdate?.(dt); } catch (_e) {}
        // V0.20.10 (Roadmap Item 17): the nearby-interaction prompt. Driven from here rather than from
        // a system of its own because it must follow the player every frame, and this is where the
        // other per-frame system panels already refresh.
        try { this.refreshExaminePanel?.(); } catch (_e) {}
      }

      renderExternalSystems(context) {
        for (const system of this.externalSystems) {
          if (!system || typeof system.render !== 'function') continue;
          context.save();
          try {
            system.render(context);
          } catch (err) {
            this.recordRuntimeSystemFault(system, 'render', err);
          } finally {
            context.restore();
          }
        }
      }

      notifyExternalSystems(eventName, payload = {}) {
        for (const system of this.externalSystems) {
          if (!system || typeof system.onGameEvent !== 'function') continue;
          try {
            system.onGameEvent(eventName, payload);
          } catch (err) {
            this.recordRuntimeSystemFault?.(system, 'onGameEvent', err);
          }
        }
        // Phase 1 (Simulation Core, Gameplay Event Bus): forward the
        // subset of existing notifyExternalSystems eventName strings that
        // map onto the new typed DR.GameEvents constants. This is the one
        // central place that does the string->typed-constant translation
        // so every existing notifyExternalSystems call site keeps working
        // unchanged while also feeding the new event bus. See
        // docs/PHASE_1_SIMULATION_CORE_EVENT_BUS.txt for the full event
        // list and which ones are not yet wired (no owning system yet).
        this.dispatchGameplayEvent?.(eventName, payload);
      }

      dispatchGameplayEvent(eventName, payload) {
        const Events = DR.GameEvents;
        const Bus = DR.EventBus;
        if (!Events || !Bus) return;
        switch (eventName) {
          case 'damage-dealt': Bus.emit(Events.DAMAGE_DEALT, payload); break;
          case 'healing-done': Bus.emit(Events.HEALING_DONE, payload); break;
          case 'enemy-killed':
            Bus.emit(Events.ENTITY_KILLED, payload);
            if (payload?.enemy?.boss || payload?.enemy?.dungeonBoss) Bus.emit(Events.BOSS_KILLED, payload);
            break;
          case 'item-looted': Bus.emit(Events.ITEM_LOOTED, payload); break;
          case 'resource-gathered': Bus.emit(Events.RESOURCE_GATHERED, payload); break;
          case 'quest-objective-progress': Bus.emit(Events.QUEST_OBJECTIVE_PROGRESS, payload); break;
          case 'event-triggered': Bus.emit(Events.ZONE_EVENT_STARTED, payload); break;
          case 'item-crafted': Bus.emit(Events.ITEM_CRAFTED, payload); break;
          case 'dungeon-completed': Bus.emit(Events.DUNGEON_COMPLETED, payload); break;
          default: break;
        }
      }

      // -------------------------------
      // Meditation rules
      // -------------------------------
      meditationSkillLevel(entity = this.player) {
        if (!entity) return 1;
        if (entity.meditation?.level) return Math.max(1, Math.min(20, Math.floor(Number(entity.meditation.level) || 1)));
        if (entity.meditationSkill?.level) return Math.max(1, Math.min(20, Math.floor(Number(entity.meditationSkill.level) || 1)));
        return 1;
      }

      // The authoritative Meditation recovery-tick period in seconds (root
      // cause of the V0.17.23 "heals too fast / ignores the 15s tick" bug:
      // this used to return the tuning value that had drifted to 1.0s).
      // updateMeditationForEntity() gates HP/resource recovery AND
      // Meditation skill XP on this cadence, so the value here must stay
      // in sync with MEDITATION_TUNING.tickIntervalSeconds
      // (systems/meditation-system.js).
      // V0.18.88 (Roadmap Item 4 D): armour-set detection for the player. Membership is by item id
      // (the item compiler carries only a fixed field set, so a custom setId would be dropped; ids
      // always survive). Reads the player's equipment map (this.equipment, game.js init).
      equippedArmorSetCount(setId, entity = this.player) {
        const set = window.DreamRealms?.ARMOR_SETS?.[setId];
        const equip = (entity === this.player) ? this.equipment : entity?.equipment;
        if (!set || !equip || typeof equip !== 'object') return 0;
        const ids = set.pieceIds || [];
        let n = 0;
        for (const slot of Object.keys(equip)) {
          const it = equip[slot];
          // Runtime instances carry the source item id in itemId/sourceItemId (id is a numeric
          // instance id); raw drafts use id. Check all so detection works in every path.
          const srcId = it && (it.itemId || it.sourceItemId || it.id);
          if (srcId && ids.includes(srcId)) n++;
        }
        return n;
      }

      hasFullArmorSet(setId, entity = this.player) {
        const set = window.DreamRealms?.ARMOR_SETS?.[setId];
        if (!set) return false;
        return this.equippedArmorSetCount(setId, entity) >= (set.pieceIds?.length || Infinity);
      }

      meditationTickRate(entity = this.player) {
        let interval = window.DreamRealms?.MEDITATION_TUNING?.tickIntervalSeconds ?? 15.0;
        // V0.18.88 (Roadmap Item 4 D): the Dark Woods Wanderer full-set bonus makes the PLAYER meditate
        // faster by shortening the tick interval - reusing the existing tick cadence, no separate loop.
        if (entity === this.player && this.hasFullArmorSet?.('dark_woods_wanderer', entity)) {
          const speed = window.DreamRealms?.ARMOR_SETS?.dark_woods_wanderer?.bonus?.meditationSpeedPercent || 0;
          if (speed > 0) interval = Math.max(1, interval * (1 - speed));
        }
        return interval;
      }

      actorIsMeditating(entity = this.player) {
        return Boolean(entity && (
          entity.meditating === true ||
          entity.isMeditating === true ||
          entity.isSitting === true ||
          entity.isResting === true ||
          entity.isRecovering === true ||
          /meditat|rest|recover/i.test(String(entity.meditationState || entity.recoveryState || entity.restState || ''))
        ));
      }

      clearBotMeditationMovePenalty(entity) {
        if (!entity) return false;
        let changed = false;
        for (const id of ['bot_meditation_slow', 'meditation_slow', 'bot_meditation_move_penalty', 'recovery_slow']) {
          if (this.removeStatusEffect?.(entity, id)) changed = true;
        }
        if (Array.isArray(entity.buffs)) {
          const before = entity.buffs.length;
          entity.buffs = entity.buffs.filter(effect => {
            const id = String(effect?.id || '').toLowerCase();
            const name = String(effect?.name || '').toLowerCase();
            const source = String(effect?.sourceKind || effect?.sourceName || effect?.source || '').toLowerCase();
            if (id === 'bot_meditation_slow' || id === 'meditation_slow' || id === 'bot_meditation_move_penalty' || id === 'recovery_slow') return false;
            if (source === 'bot_meditation' || source.includes('bot meditation')) return false;
            if ((id.includes('meditation') || name.includes('meditation')) && effect?.hostile !== true) return false;
            return true;
          });
          changed = changed || entity.buffs.length !== before;
        }
        entity.statusMoveMultiplier = null;
        entity.meditationMoveMultiplier = null;
        entity.recoveryMoveMultiplier = null;
        return changed;
      }

      clearActorMeditationPathPenalty(entity, nowMs = performance.now()) {
        if (!entity) return false;
        if (Array.isArray(entity._pathRoute)) entity._pathRoute.length = 0;
        if (Array.isArray(entity._companionPathRoute)) entity._companionPathRoute.length = 0;
        entity._pathTarget = null;
        entity._pathGoal = null;
        entity._companionPathGoal = null;
        entity._companionPathMode = '';
        entity._pathRepath = 0;
        entity._lastPathRecalcMs = 0;
        entity._forcePathRecalcAt = nowMs;
        entity._cachedMoveSpeed = null;
        entity._lastMoveSpeed = null;
        entity.cachedMoveSpeed = null;
        entity.pathFollowSpeed = null;
        return true;
      }

      resolveMeditationAnimationClass(entity = this.player) {
        const raw = String(entity?.className || entity?.playerClass || entity?.classId || entity?.role || entity?.type || '').toLowerCase().replace(/[\s_\-]/g, '');
        const role = String(entity?.roleKey || '').toLowerCase().replace(/[\s_\-]/g, '');
        if (raw.includes('bard')) return 'bard';
        if (raw.includes('druid')) return 'druid';
        if (raw.includes('fighter') || raw.includes('warrior') || raw.includes('guardian') || role === 'guardian') return 'fighter';
        if (raw.includes('rogue') || raw.includes('scout') || raw.includes('assassin') || role === 'scout') return 'rogue';
        if (raw.includes('cleric') || raw.includes('priest') || raw.includes('healer') || role === 'cleric' || role === 'fieldcleric') return 'cleric';
        if (raw.includes('enchanter') || raw.includes('mesmer') || raw.includes('illusion')) return 'enchanter';
        if (raw.includes('summoner') || raw.includes('adept') || role === 'adept') return 'summoner';
        if (raw.includes('necromancer') || raw.includes('necro')) return 'necromancer';
        return 'default';
      }

      lockMeditatingActorMovement(entity = this.player) {
        if (!entity) return false;
        entity.meditating = true;
        entity.isMeditating = true;
        entity.isSitting = true;
        entity.isResting = true;
        entity.isRecovering = false;
        entity.wantsToMeditate = true;
        entity.meditationState = 'sitting';
        entity.recoveryState = 'none';
        entity.restState = 'meditating';
        entity.vx = 0;
        entity.vy = 0;
        entity.moveBlend = 0;
        entity.wantsToMove = false;
        entity.walkCycle = entity.walkCycle || 0;
        entity.meditationAnimationClass = this.resolveMeditationAnimationClass?.(entity) || 'default';
        entity.currentAnimation = `meditate_${entity.meditationAnimationClass}`;
        entity.animationState = 'meditate';
        if (Array.isArray(entity._pathRoute)) entity._pathRoute.length = 0;
        if (Array.isArray(entity._companionPathRoute)) entity._companionPathRoute.length = 0;
        entity._pathTarget = null;
        entity._pathGoal = null;
        entity._companionPathGoal = null;
        entity._forcePathRecalcAt = 0;
        entity._pathRepath = 0;
        if (entity.kind === 'player') {
          this.clearClickMoveTarget?.();
          this.playerIntentDx = 0;
          this.playerIntentDy = 0;
        }
        if (entity.kind === 'bot') {
          entity.roamTarget = null;
          entity.currentTargetName = '';
          entity.botState = 'meditating';
          entity.currentActivityLabel = 'Meditating';
        } else if (entity.kind === 'merc') {
          entity.commandState = entity.command === 'meditate' ? 'command-meditating' : 'resting-to-full';
        }
        return true;
      }

      startMeditation(entity = this.player, options = {}) {
        if (!entity || !entity.alive) return false;
        if (!entity.meditation) this.normalizeMeditationState?.(entity);
        this.clearStaleCombatState?.(entity, { silent: true });
        if (entity === this.player) this.cancelPlayerEmote?.('action');
        if (this.isEntityInCombat(entity)) {
          if (entity === this.player && !options.silent) this.log('You cannot meditate in combat.');
          return false;
        }
        // Meditation exists to restore HP/resource; updateMeditationForEntity
        // completes instantly when the actor is already full. For the player
        // that produced a jarring "begin settling..." immediately followed by
        // "Meditation complete." Guard the manual case (player, unforced) so a
        // fully-rested player just gets one clear line instead. Bots/mercs
        // pre-check need before calling and never start at full, so this is
        // scoped to the player and does not touch companion behavior.
        if (entity === this.player && !options.force) {
          const fullHp = (Number(entity.hp) || 0) >= Math.max(0, Number(entity.maxHp) || 0);
          const fullResource = (Number(entity.mana) || 0) >= Math.max(0, Number(entity.maxMana) || 0);
          if (fullHp && fullResource) {
            if (!options.silent) this.log('You are already fully rested.');
            return false;
          }
        }
        if (!options.force) {
          const outOfCombatSeconds = this.meditationOutOfCombatSeconds?.(entity) ?? Infinity;
          const required = window.DreamRealms?.MEDITATION_TUNING?.outOfCombatRequiredSeconds ?? 3.0;
          if (outOfCombatSeconds < required) {
            if (entity === this.player && !options.silent) this.log('You must be out of combat a little longer before you can meditate.');
            return false;
          }
          const moving = Math.hypot(entity.vx || 0, entity.vy || 0) > 0.025 || (entity.moveBlend || 0) > 0.06;
          if (moving) {
            if (entity === this.player && !options.silent) this.log('You must stand still to begin meditating.');
            return false;
          }
          if (entity.isJumping || (entity.z || 0) > 0) {
            if (entity === this.player && !options.silent) this.log('You cannot meditate while jumping.');
            return false;
          }
          if (entity.swimming || entity.isUnderwater || entity.underwater) {
            if (entity === this.player && !options.silent) this.log('You cannot meditate while swimming.');
            return false;
          }
          if (entity.mounted) {
            if (entity === this.player && !options.silent) this.log('You cannot meditate while mounted.');
            return false;
          }
        }
        const nowTs = performance.now();
        const graceWindow = window.DreamRealms?.MEDITATION_TUNING?.graceWindowSeconds ?? 3.0;
        const inGraceWindow = entity._meditationGraceDeadline > 0 && nowTs < entity._meditationGraceDeadline;
        entity._meditationGraceDeadline = 0;
        entity._meditationGraceRemaining = inGraceWindow ? (window.DreamRealms?.MEDITATION_TUNING?.graceRegenSeconds ?? 2.0) : 0;

        const rushWindow = (window.DreamRealms?.MEDITATION_TUNING?.postCombatRushWindowSeconds ?? 10.0) * 1000;
        const sinceCombatMs = entity._lastCombatActiveAt ? (nowTs - entity._lastCombatActiveAt) : Infinity;
        if (sinceCombatMs <= rushWindow && !entity._postCombatRushConsumed) {
          entity._postCombatRushConsumed = true;
          entity._postCombatRushRemaining = window.DreamRealms?.MEDITATION_TUNING?.postCombatRushBoostSeconds ?? 5.0;
        } else {
          entity._postCombatRushRemaining = 0;
        }

        entity.meditating = true;
        entity.isMeditating = true;
        entity.isSitting = true;
        entity.isResting = true;
        entity.isRecovering = false;
        entity.wantsToMeditate = true;
        entity.meditationState = 'sitting';
        entity.recoveryState = 'none';
        entity.restState = 'meditating';
        entity.meditationPhase = window.DreamRealms?.MEDITATION_STATES?.SITTING_DOWN || 'SITTING_DOWN';
        entity.meditationStartedAt = nowTs;
        entity.meditationSettleRemaining = inGraceWindow ? 0 : this.meditationSettleSeconds;
        entity.meditationTickTimer = 0;
        entity.meditationTickRate = this.meditationTickRate?.(entity) || 1;
        entity.meditationProgress = 0;
        entity._meditationPlayerXpSnapshot = entity === this.player ? Math.max(0, Number(entity.xp) || 0) : null;
        entity.meditation.lastMeditationStartTime = Date.now();
        this.lockMeditatingActorMovement?.(entity);
        if (this.isBardMeditationAuraSource?.(entity)) this.refreshBardMeditationAura?.({ forceUi: true });
        if (entity === this.player) this.playAudioEvent?.('meditation_start', { actor: entity, volume: options.silent ? 0.18 : 0.36 });
        if (entity === this.player && !options.silent) this.log('You sit down and begin settling into meditation.');
        return true;
      }

      cancelMeditation(entity = this.player, reason = '', options = {}) {
        if (!entity) return false;
        const hadMeditationState = this.actorIsMeditating?.(entity) || entity.meditationIntent || /meditat|rest|recover/i.test(String(entity.currentActivityLabel || entity.botState || entity.commandState || ''));
        if (!hadMeditationState) return false;
        const nowMs = performance.now();
        if (entity.meditation) {
          const sessionSeconds = entity.meditationStartedAt ? Math.max(0, (nowMs - entity.meditationStartedAt) / 1000) : 0;
          entity.meditation.totalSecondsMeditated = (entity.meditation.totalSecondsMeditated || 0) + sessionSeconds;
          entity.meditation.lastMeditationBreakTime = Date.now();
          if (entity.meditation.totalSecondsMeditated >= 36000) window.DreamRealms?.MeditationHelpers?.unlockMeditationAchievement?.(this, entity, 'vigilant_rest');
        }
        const softInterrupt = String(reason || '') === 'movement';
        const hardInterrupt = ['combat', 'damage taken', 'attack', 'spell cast', 'portal cast'].includes(String(reason || ''));
        const graceWindow = window.DreamRealms?.MEDITATION_TUNING?.graceWindowSeconds ?? 3.0;
        entity._meditationGraceDeadline = softInterrupt ? (nowMs + graceWindow * 1000) : 0;
        entity._meditationStillnessStartedAt = 0;
        entity.meditationPhase = hardInterrupt
          ? (window.DreamRealms?.MEDITATION_STATES?.FORCED_STAND || 'FORCED_STAND')
          : (window.DreamRealms?.MEDITATION_STATES?.IDLE || 'IDLE');
        entity.meditating = false;
        entity.isMeditating = false;
        entity.isSitting = false;
        entity.isResting = false;
        entity.isRecovering = false;
        entity.wantsToMeditate = false;
        entity.meditationState = 'none';
        entity.recoveryState = 'none';
        entity.restState = 'none';
        entity.meditationStartedAt = 0;
        entity.meditationSettleRemaining = 0;
        entity.meditationTickTimer = 0;
        entity.meditationTickRate = 0;
        entity.meditationProgress = 0;
        entity._meditationPlayerXpSnapshot = null;
        entity.vx = 0;
        entity.vy = 0;
        entity.moveBlend = 0;
        entity.currentAction = null;
        entity.meditationAnimationClass = '';
        entity.animationState = 'idle';
        entity.currentAnimation = 'idle';
        this.clearBotMeditationMovePenalty?.(entity);
        this.clearActorMeditationPathPenalty?.(entity, nowMs);
        entity.wantsToMove = entity.kind === 'bot' || entity.kind === 'merc';
        if (this.isBardMeditationAuraSource?.(entity) || String(entity.className || '').toLowerCase() === 'bard') this.refreshBardMeditationAura?.({ forceUi: true });
        if (entity.kind === 'bot') {
          entity.meditationIntent = '';
          entity.roamTarget = null;
          if (/meditat|rest|recover/i.test(String(entity.currentActivityLabel || ''))) entity.currentActivityLabel = this.isBotInParty?.(entity) ? 'Party Ready' : 'Ready';
          if (/meditat|rest|recover/i.test(String(entity.botState || ''))) entity.botState = 'idle';
        } else if (entity.kind === 'merc') {
          entity.meditationIntent = '';
          if (/meditat|rest|recover/i.test(String(entity.commandState || ''))) entity.commandState = entity.command === 'meditate' ? 'assist' : (entity.command || 'assist');
        }
        if (entity === this.player) this.playAudioEvent?.('meditation_stop', { actor: entity, volume: options.silent ? 0.12 : 0.24 });
        if (entity === this.player && reason && !options.silent) this.log(`Meditation cancelled: ${reason}.`);
        return true;
      }

      resolveActorMoveSpeed(entity) {
        if (!entity || entity.alive === false) return 0;
        if (this.hasStatusTag?.(entity, 'root') || this.hasStatusTag?.(entity, 'stun')) return 0;
        const rawBase = Number(entity.speed ?? entity.baseMoveSpeed ?? CONFIG.BASE_MOVE_SPEED ?? 3.2);
        const baseSpeed = Math.max(0, Number.isFinite(rawBase) ? rawBase : (CONFIG.BASE_MOVE_SPEED || 3.2));
        let speed = Number(entity.getStat?.('speed'));
        if (!Number.isFinite(speed)) speed = baseSpeed;
        if (this.actorIsMeditating?.(entity)) return 0;
        return Math.max(0, speed);
      }

      actorBardMeditationKey(entity) {
        if (!entity) return '';
        const rawId = entity.id ?? entity.botId ?? entity.remoteId ?? entity.peerId ?? entity.name ?? '';
        return String(rawId || `${entity.kind || 'actor'}:${entity.x || 0}:${entity.y || 0}`);
      }

      isBardMeditationAuraSource(entity) {
        if (!entity || entity.alive === false || !this.actorIsMeditating?.(entity)) return false;
        const classKey = String(entity.className || entity.playerClass || entity.classId || entity.botClassAiProfileId || '').toLowerCase().replace(/[\s_\-]+/g, '');
        if (classKey !== 'bard') return false;
        if (entity === this.player || String(entity.kind || '').toLowerCase() === 'player') return true;
        if (String(entity.kind || '').toLowerCase() === 'bot') return this.isBotInParty?.(entity) === true;
        if (String(entity.kind || '').toLowerCase() === 'remote') return this.isPartyActor?.(entity) === true;
        return false;
      }

      bardMeditationAuraRadius() {
        return 30;
      }

      collectBardMeditationAuraSources() {
        const sources = [];
        const push = actor => {
          if (!this.isBardMeditationAuraSource?.(actor)) return;
          if (!sources.includes(actor)) sources.push(actor);
        };
        push(this.player);
        for (const bot of this.botPlayers || []) push(bot);
        for (const id of this.partyMembers || []) {
          if (String(id) === String(this.localPeerId)) continue;
          push(this.remotePlayers?.get?.(id));
        }
        return sources;
      }

      setBardMeditationAuraStatus(target, source) {
        if (!target || target.alive === false) return false;
        if (!Array.isArray(target.buffs)) target.buffs = [];
        const existing = target.buffs.find(effect => effect?.id === 'bard_meditation_aura');
        const nowMs = this.runtimeNowMs?.() || (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        const sourceName = source === this.player ? 'You' : (source?.name || 'Bard');
        const base = {
          version: 1,
          id: 'bard_meditation_aura',
          name: "Bard's Meditation Aura",
          type: 'buff',
          remaining: 0.85,
          duration: 0.85,
          tickRate: 0,
          tickTimer: 0,
          stacks: 1,
          maxStacks: 1,
          mods: {},
          periodicDamage: 0,
          periodicHealing: 0,
          damageType: 'magic',
          canCrit: false,
          color: '#8fd7ff',
          description: "Bard's Meditation Aura – enhanced meditation regeneration while this Bard meditates nearby.",
          sourceId: source?.id ?? source?.botId ?? null,
          sourceKind: source?.kind || 'bard',
          sourceName,
          hostile: false,
          cleanseType: '',
          isCurable: false,
          clearsOnDeath: true,
          tags: ['song', 'meditation', 'aura', 'regen'],
          appliedAt: nowMs
        };
        if (existing) {
          Object.assign(existing, base, { appliedAt: existing.appliedAt || nowMs });
        } else {
          target.buffs.push(base);
        }
        target._bardMeditationAuraActive = true;
        target._bardMeditationAuraSourceId = base.sourceId;
        target._bardMeditationAuraLastSeen = nowMs;
        return true;
      }

      clearBardMeditationAuraStatus(target) {
        if (!target) return false;
        target._bardMeditationAuraActive = false;
        target._bardMeditationAuraSourceId = null;
        target._bardMeditationAuraLastSeen = 0;
        if (!Array.isArray(target.buffs)) return false;
        const before = target.buffs.length;
        target.buffs = target.buffs.filter(effect => effect?.id !== 'bard_meditation_aura');
        return target.buffs.length !== before;
      }

      ensureBardMeditationAuraEffect(target) {
        if (!target || target.alive === false || !Array.isArray(this.effects)) return null;
        const id = this.actorBardMeditationKey?.(target) || '';
        if (!id) return null;
        if (!this._bardMeditationAuraEffectMap) this._bardMeditationAuraEffectMap = new Map();
        let effect = this._bardMeditationAuraEffectMap.get(id);
        if (!effect || !this.effects.includes(effect)) {
          effect = {
            type: 'bardMeditationAura',
            x: target.x,
            y: target.y,
            followId: target.id || null,
            actorKey: id,
            seed: Math.random(),
            t: 0,
            life: 0.95
          };
          this.addEffect?.(effect) || this.effects.push(effect);
          this._bardMeditationAuraEffectMap.set(id, effect);
        } else {
          effect.t = 0;
          effect.life = 0.95;
          effect.x = target.x;
          effect.y = target.y;
          effect.followId = target.id || effect.followId || null;
        }
        return effect;
      }

      clearBardMeditationAuraEffects(activeKeys = null) {
        if (!Array.isArray(this.effects)) return;
        let write = 0;
        let removed = 0;
        for (let i = 0; i < this.effects.length; i++) {
          const effect = this.effects[i];
          const keep = effect?.type !== 'bardMeditationAura' || (activeKeys && activeKeys.has(String(effect.actorKey || '')));
          if (keep) this.effects[write++] = effect;
          else {
            removed += 1;
            this.recycleEffectEntry?.(effect);
          }
        }
        if (write !== this.effects.length) this.effects.length = write;
        if (removed && this.runtimeMemoryStats) this.runtimeMemoryStats.arraysCompacted += 1;
        if (this._bardMeditationAuraEffectMap instanceof Map) {
          for (const key of Array.from(this._bardMeditationAuraEffectMap.keys())) {
            if (!activeKeys || !activeKeys.has(String(key))) this._bardMeditationAuraEffectMap.delete(key);
          }
        }
      }

      refreshBardMeditationAura(options = {}) {
        const sources = this.collectBardMeditationAuraSources?.() || [];
        const activeKeys = new Set();
        const radius = this.bardMeditationAuraRadius?.() || 30;
        if (sources.length) {
          for (const source of sources) {
            const members = this.getPartyCombatMembers?.({ includeRemote: true, includePet: true, anchor: source, range: radius }) || [];
            for (const entry of members) {
              const target = entry?.actor;
              if (!target || target.alive === false) continue;
              const key = this.actorBardMeditationKey?.(target) || '';
              if (!key || activeKeys.has(key)) continue;
              activeKeys.add(key);
              this.setBardMeditationAuraStatus?.(target, source);
              this.ensureBardMeditationAuraEffect?.(target);
            }
          }
        }

        const previous = this._bardMeditationAuraActiveKeys instanceof Set ? this._bardMeditationAuraActiveKeys : new Set();
        for (const key of previous) {
          if (activeKeys.has(key)) continue;
          const target = this.findActorByBardMeditationKey?.(key);
          if (target) this.clearBardMeditationAuraStatus?.(target);
        }
        if (!activeKeys.size) {
          for (const actor of [this.player, this.merc, this.pet, ...(this.botPlayers || [])]) this.clearBardMeditationAuraStatus?.(actor);
          if (this.remotePlayers instanceof Map) for (const actor of this.remotePlayers.values()) this.clearBardMeditationAuraStatus?.(actor);
        }
        this.clearBardMeditationAuraEffects?.(activeKeys.size ? activeKeys : null);
        this._bardMeditationAuraActiveKeys = activeKeys;
        this._bardMeditationAuraActiveSourceCount = sources.length;
        if (options.forceUi !== false) {
          this.partyPanelDirty = true;
          this.botHudDirty = true;
          this._uiDirty = true;
        }
        return activeKeys.size;
      }

      findActorByBardMeditationKey(key) {
        const wanted = String(key || '');
        if (!wanted) return null;
        const actors = [this.player, this.merc, this.pet, ...(this.botPlayers || [])];
        if (this.remotePlayers instanceof Map) actors.push(...this.remotePlayers.values());
        return actors.find(actor => this.actorBardMeditationKey?.(actor) === wanted) || null;
      }

      updateBardMeditationAuraRuntime(dt) {
        const safeDt = Math.max(0, Number(dt) || 0);
        const activeCount = this._bardMeditationAuraActiveSourceCount || 0;
        const hasPossibleSource = activeCount > 0 || this.isBardMeditationAuraSource?.(this.player) || (this.botPlayers || []).some(bot => this.isBardMeditationAuraSource?.(bot));
        if (!hasPossibleSource && !(this._bardMeditationAuraActiveKeys instanceof Set && this._bardMeditationAuraActiveKeys.size)) return;
        this._bardMeditationAuraRefreshTimer = Math.max(0, Number(this._bardMeditationAuraRefreshTimer || 0) - safeDt);
        if (this._bardMeditationAuraRefreshTimer > 0) return;
        this._bardMeditationAuraRefreshTimer = 0.30;
        this.refreshBardMeditationAura?.({ forceUi: false });
      }

      // NOTE: `regen.hpPerSec`/`regen.resourcePerSec` (systems/meditation-system.js
      // calculateMeditationRegen) are the FLAT amount to restore for one
      // completed Meditation tick (see MEDITATION_TUNING.tickIntervalSeconds),
      // already inclusive of environment/bard/group/Great-Stillness bonuses -
      // they are not a continuous per-second rate to be re-multiplied here.
      // V0.17.23 root-cause fix: this used to multiply by the tick length
      // again (`* safeTick`), which is what made Meditation heal ~15x faster
      // than the intended 15-second tick once the tick period was corrected.
      applyMeditationRecoveryTick(entity, tickSeconds = 1, regen = null, options = {}) {
        if (!entity || entity.alive === false) return { hp: 0, resource: 0 };
        if (!this.actorIsMeditating?.(entity)) return { hp: 0, resource: 0 };
        if (this.isEntityInCombat?.(entity)) return { hp: 0, resource: 0 };
        const data = regen || this.calculateMeditationRegen?.(entity, {}) || { hpPerSec: 0, resourcePerSec: 0 };
        let hpRestored = 0;
        let resourceRestored = 0;

        const maxHp = Math.max(0, Number(entity.maxHp) || 0);
        if (maxHp > 0 && Number(data.hpPerSec || 0) > 0) {
          const before = Math.max(0, Number(entity.hp) || 0);
          const amount = Math.max(0, Number(data.hpPerSec || 0));
          entity.hp = Math.min(maxHp, before + amount);
          hpRestored = Math.max(0, entity.hp - before);
        }

        const maxMana = Math.max(0, Number(entity.maxMana) || 0);
        if (maxMana > 0 && Number(data.resourcePerSec || 0) > 0) {
          const before = Math.max(0, Number(entity.mana) || 0);
          const amount = Math.max(0, Number(data.resourcePerSec || 0));
          entity.mana = Math.min(maxMana, before + amount);
          resourceRestored = Math.max(0, entity.mana - before);
        }

        if ((hpRestored > 0 || resourceRestored > 0) && entity === this.player) {
          this._uiDirty = true;
          this.playerHudDirty = true;
        }
        return { hp: hpRestored, resource: resourceRestored };
      }

      updateMeditationForEntity(entity, dt, options = {}) {
        if (!this.actorIsMeditating?.(entity) || !entity.alive) return;
        if (!entity.meditation) this.normalizeMeditationState?.(entity);
        const safeDt = Math.max(0, Math.min(0.25, Number(dt) || 0));
        const playerXpBefore = entity === this.player ? Math.max(0, Number(entity.xp) || 0) : null;
        this.lockMeditatingActorMovement?.(entity);
        if (this.isEntityInCombat(entity)) {
          this.cancelMeditation(entity, 'combat', options);
          return;
        }
        const completeSession = () => {
          this.cancelMeditation(entity, '', { silent: true });
          if (entity === this.player && !options.silent) this.log('Meditation complete.');
          if (entity.kind === 'merc' && entity.command === 'meditate') entity.command = 'assist';
          if (entity.kind === 'bot') entity.meditationIntent = '';
        };
        const maxHp = Math.max(0, Number(entity.maxHp) || 0);
        const maxMana = Math.max(0, Number(entity.maxMana) || 0);
        if ((Number(entity.hp) || 0) >= maxHp && (Number(entity.mana) || 0) >= maxMana) { completeSession(); return; }

        entity.meditationSettleRemaining = Math.max(0, Number(entity.meditationSettleRemaining || 0) - safeDt);
        if (entity.meditationSettleRemaining > 0) {
          entity.meditationPhase = window.DreamRealms?.MEDITATION_STATES?.SITTING_DOWN || 'SITTING_DOWN';
          return;
        }
        entity.meditationPhase = window.DreamRealms?.MEDITATION_STATES?.MEDITATING || 'MEDITATING';

        entity._meditationGraceRemaining = Math.max(0, Number(entity._meditationGraceRemaining || 0) - safeDt);
        entity._postCombatRushRemaining = Math.max(0, Number(entity._postCombatRushRemaining || 0) - safeDt);

        const tickPeriod = Math.max(0.25, Number(this.meditationTickRate(entity) || 1));
        entity.meditationTickRate = tickPeriod;
        entity.meditationTickTimer = Math.max(0, Number(entity.meditationTickTimer || 0) + safeDt);
        entity.meditationProgress = Math.max(0, Math.min(1, entity.meditationTickTimer / tickPeriod));

        let pulsed = false;
        let recoveredHp = 0;
        let recoveredResource = 0;
        let tickSafety = 0;
        while (entity.meditationTickTimer >= tickPeriod && tickSafety < 4) {
          entity.meditationTickTimer = Math.max(0, entity.meditationTickTimer - tickPeriod);
          const regen = this.calculateMeditationRegen?.(entity, {}) || { hpPerSec: 0, resourcePerSec: 0, xpPerTick: 0 };
          const restored = this.applyMeditationRecoveryTick?.(entity, tickPeriod, regen, options) || { hp: 0, resource: 0 };
          recoveredHp += Number(restored.hp || 0);
          recoveredResource += Number(restored.resource || 0);
          // Meditation SKILL XP (not player level XP - see the safeguard
          // below) is granted once per completed 15-second tick, matching
          // docs/PASS_47_1_DARK_WOODS_MEDITATION_QOL.txt's "Meditation XP is
          // granted only when an actual restore tick happens." Player-only:
          // the Skills panel (systems/skills-system.js) only ever renders
          // game.player's meditationSkill, so bots/mercs meditating here
          // must not advance it.
          if (entity === this.player) this.gainMeditationXp?.(regen.xpPerTick || 0);
          pulsed = true;
          tickSafety += 1;
        }
        entity.meditationProgress = Math.max(0, Math.min(1, entity.meditationTickTimer / tickPeriod));
        if (pulsed && (recoveredHp > 0 || recoveredResource > 0)) {
          this.spawnRing?.(entity.x, entity.y, '#69cfff', entity.kind === 'merc' || entity.kind === 'bot' ? 7 : 10);
        }

        // V0.17.21 safeguard: meditation recovery must never mutate player
        // combat XP. Valid XP remains owned by kill/quest/progression calls.
        if (entity === this.player && playerXpBefore !== null) {
          const currentXp = Math.max(0, Number(entity.xp) || 0);
          if (currentXp !== playerXpBefore) {
            entity.xp = playerXpBefore;
            if (!this._meditationXpSafeguardLogged) {
              this._meditationXpSafeguardLogged = true;
              console.warn('[Meditation] Blocked player EXP mutation during meditation recovery tick.');
            }
          }
        }

        if (this.isGreatStillnessActive?.() && entity._meditationStillnessStartedAt) {
          const held = (performance.now() - entity._meditationStillnessStartedAt) / 1000;
          const stillnessDuration = window.DreamRealms?.MEDITATION_TUNING?.greatStillnessDurationSeconds ?? 60;
          if (held >= stillnessDuration) {
            this.recordGreatStillnessCompletion?.(entity);
            entity._meditationStillnessStartedAt = 0;
            if (entity === this.player) this.log('The Stillness recognizes your unbroken calm.');
          }
        }

        if ((Number(entity.hp) || 0) >= maxHp && (Number(entity.mana) || 0) >= maxMana) completeSession();
      }

      updatePlayerEmoteState(dt) {
        const p = this.player;
        if (!p?.emoteActive) return;
        if (!p.alive) {
          this.stopPlayerEmote?.(p.emoteState, 'death', { silent: true });
          return;
        }
        if (this.isEntityInCombat?.(p) || p.autoAttack || Number(p.combatCooldown || 0) > 0 || Number(p.attackAnim || 0) > 0.02 || Number(p.spellCastAnim || 0) > 0.02) {
          this.cancelPlayerEmote?.('action');
          return;
        }
        p.vx = 0;
        p.vy = 0;
        p.moveBlend = 0;
        const speed = p.emoteState === 'dance' ? 1.65 : 0.55;
        p.emoteAnim = ((Number(p.emoteAnim || 0) + Math.max(0, Number(dt) || 0) * speed) % 1 + 1) % 1;
        p.action = p.emoteState;
        p.currentAction = p.emoteState;
        p.animationState = p.emoteState;
        p.currentAnimation = p.emoteState;
      }

      // -------------------------------
      // Main loop / frame update
      // -------------------------------
      loop(now) {
        const frameStart = performance.now();
        this._runtimeFrameNowMs = Number.isFinite(Number(now)) ? Number(now) : frameStart;
        const rawDt = (now - this.lastTime) / 1000;
        const dt = Math.min(CONFIG.MAX_DT, Number.isFinite(rawDt) ? rawDt : 0);
        this.lastTime = now;
        this.updateFpsCounter(rawDt, now);
        this.runtimeSpriteCache?.beginFrame?.();
        this.performanceVerifier?.beginFrame?.();
        this.adaptivePerformance?.beginFrame?.();

        const updateStart = performance.now();
        try {
          if (this.started && !this.paused) this.update(dt);
        } catch (err) {
          this.handleRuntimeFrameError(err, 'update');
        } finally {
          if (this.perfStats) this.perfStats.updateMs = performance.now() - updateStart;
        }

        const renderStart = performance.now();
        try {
          this.render();
        } catch (err) {
          this.handleRuntimeFrameError(err, 'render');
          this.drawRenderFailureOverlay?.(`World render recovered: ${err?.message || err}`);
        } finally {
          if (this.perfStats) {
            this.perfStats.renderMs = performance.now() - renderStart;
            this.perfStats.frameMs = performance.now() - frameStart;
            const frameDoneMs = performance.now();
            this.adaptivePerformance?.update?.(this.perfStats, frameDoneMs);
            this.performanceVerifier?.update?.(this.perfStats, frameDoneMs);
            if (this.adaptivePerformance?.consumeResizeRequest?.() || this.performanceVerifier?.consumeResizeRequest?.()) this.resize();
          }
          requestAnimationFrame(t => this.loop(t));
        }
      }


      updateFpsCounter(rawDt, nowMs) {
        // V0.17.06: FPS is no longer rendered in the Mini-Map HUD. Keep the
        // presentation-cadence measurement alive for the F3/debug overlay only.

        // V0.14.30: FPS is a HUD diagnostic and must measure real presentation cadence,
        // not the clamped simulation delta used for movement safety. The previous meter
        // could show very low values while the game still felt smooth after movement-dt
        // substeps were restored, because it accumulated capped/irregular sim dt.
        const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : performance.now();
        if (!Number.isFinite(now) || now <= 0) return;
        if (document.hidden) {
          this.fpsFrameCount = 0;
          this.fpsWindowStartMs = now;
          this.fpsLastSampleMs = now;
          return;
        }

        const last = Number(this.fpsLastSampleMs || 0);
        this.fpsLastSampleMs = now;
        if (!last || now < last || now - last > 1000) {
          this.fpsFrameCount = 0;
          this.fpsWindowStartMs = now;
          return;
        }

        if (!this.fpsWindowStartMs) this.fpsWindowStartMs = now;
        this.fpsFrameCount = (this.fpsFrameCount || 0) + 1;
        const elapsedMs = now - this.fpsWindowStartMs;
        if (elapsedMs < 500) return;

        const measured = Math.max(1, Math.min(240, (this.fpsFrameCount * 1000) / Math.max(1, elapsedMs)));
        this.displayFpsEma = this.displayFpsEma ? (this.displayFpsEma * 0.55 + measured * 0.45) : measured;
        this.currentFps = Math.round(this.displayFpsEma);
        this.fpsFrameCount = 0;
        this.fpsWindowStartMs = now;

        if (ui.fpsCounter) {
          if (!this.fpsValueNode && ui.fpsCounter.querySelector) this.fpsValueNode = ui.fpsCounter.querySelector('.fpsValue');
          const value = this.fpsValueNode;
          if (value) {
            const next = String(this.currentFps);
            if (value.textContent !== next) value.textContent = next;
          } else {
            const next = `FPS ${this.currentFps}`;
            if (ui.fpsCounter.textContent !== next) ui.fpsCounter.textContent = next;
          }
        }
      }

      // V0.20.48: derive bot locomotion from ACTUAL displacement, and do it AFTER every bot update has
      // run. Most bot movement paths set vx/vy/moveBlend themselves, but a bot can be repositioned while
      // its own update has already declared it stationary - the casting/busy branches zero moveBlend and
      // return early - so it slid along wearing a standing pose (getEntityAtlasAction resolves 'walk' off
      // moveBlend/velocity, saw zero, and drew idle). Fixing it inside the bot update did not hold: those
      // same branches overwrote it later in the very same frame. Measuring the ground actually covered is
      // ground truth and cannot be clobbered, and it covers every movement path including ones added
      // later. Only ever RAISES the gait to a walking floor - never lowers it - so a genuinely stationary
      // bot still reports idle. A large jump is a teleport (zone sync, respawn, formation snap), not a
      // walk, so it is ignored rather than played as a sprint.
      // V0.20.62: bot day/night shifts. Camp draws ~45 procedural characters at once, which profiling
      // identified as why the frame rate collapses near camp (8 FPS at camp against 20 away). Half the
      // ambient adventurer bots stand down each phase, mirroring the NPC shifts in npc-system.js.
      //
      // Deliberate exception: a bot currently in the player's PARTY keeps working. Having a party
      // member blink out of existence at dusk mid-fight would be a bug, not ambience.
      //
      // Uses the same nightStrength threshold and hysteresis as the camp NPCs so both populations
      // change over together at dusk rather than a few seconds apart.
      updateBotShifts() {
        const bots = this.botPlayers;
        if (!Array.isArray(bots) || !bots.length) return;
        const nightStrength = Number(this.getWorldLightState?.()?.nightStrength) || 0;
        const isNight = nightStrength > (this._botIsNight ? 0.52 : 0.62);
        this._botIsNight = isNight;
        // Assign by SORTING identities and alternating rather than hashing each one independently:
        // a per-id hash is stable but not balanced (it split the real roster 7/10, not evenly).
        // Sorting keeps it deterministic across sessions while guaranteeing half on each shift, and
        // only re-runs when the roster actually changes.
        const idOf = bot => String(this.botIdentityKey?.(bot) || bot.botId || bot.name || '');
        const stamp = bots.map(idOf).sort().join('|');
        if (stamp !== this._botShiftStamp) {
          this._botShiftStamp = stamp;
          const order = bots.slice().sort((a, b) => idOf(a).localeCompare(idOf(b)));
          order.forEach((bot, i) => { if (bot) bot._botShift = (i % 2) === 0 ? 'day' : 'night'; });
        }
        for (const bot of bots) {
          if (!bot) continue;
          const offShift = (bot._botShift === 'night') !== isNight;
          bot._offShift = offShift && !this.isBotInParty?.(bot);
        }
      }

      deriveBotLocomotion(dt) {
        if (!(dt > 0)) return;
        const bots = this.botPlayers;
        if (!Array.isArray(bots) || !bots.length) return;
        for (const bot of bots) {
          if (!bot || bot.alive === false) continue;
          const lx = Number(bot._locLastX);
          const ly = Number(bot._locLastY);
          if (Number.isFinite(lx) && Number.isFinite(ly)) {
            const ddx = bot.x - lx;
            const ddy = bot.y - ly;
            const moved = Math.hypot(ddx, ddy);
            if (moved > 0.0008 && moved < 1.5) {
              if (Math.abs(Number(bot.vx) || 0) + Math.abs(Number(bot.vy) || 0) <= 0.01) {
                bot.vx = ddx / dt;
                bot.vy = ddy / dt;
              }
              bot.moveBlend = Math.min(1, Math.max(Number(bot.moveBlend) || 0, 0.35));
              bot.walkCycle = (Number(bot.walkCycle) || 0) + dt * 8.5;
            } else if (moved <= 0.0008) {
              // A bot that covered no ground is standing still, whatever any path left behind. Without
              // this the first version of the fix traded sliding-while-walking for walking-in-place:
              // moveBlend was only ever raised, so a bot that stopped kept its gait running (measured
              // 655 of 871 stationary frames reporting 'walk'). Decay the blend and drop the derived
              // velocity so it settles back to idle.
              bot.moveBlend = Math.max(0, (Number(bot.moveBlend) || 0) - dt * 2.6);
              if ((Number(bot.moveBlend) || 0) <= 0.0001) { bot.vx = 0; bot.vy = 0; }
            }
          }
          bot._locLastX = bot.x;
          bot._locLastY = bot.y;
        }
      }

      // V0.20.47: the one place player walk speed is decided. Reads the real speed stat (so gear and
      // speed buffs still work exactly as before) and applies CONFIG.PLAYER_WALK_SPEED_SCALE. Every
      // movement path calls this, so keyboard, click-to-move and controller can never disagree.
      playerWalkSpeed(entity = this.player) {
        const raw = Number(entity?.getStat?.('speed') ?? entity?.speed ?? 1) || 1;
        const scale = Number(DR.CONFIG?.PLAYER_WALK_SPEED_SCALE);
        let speed = raw * (Number.isFinite(scale) && scale > 0 ? scale : 1);
        // V0.20.64 (Roadmap Item 7.G/7.J): mounts multiply the speed at this single funnel rather
        // than getting movement code of their own. Everything downstream - tryMoveActorSubstepped,
        // collision, terrain, zone boundaries - therefore applies unchanged, so a mount can never
        // outrun a wall or cross a boundary a walker could not.
        if (entity === this.player && this.mountSpeedMultiplier) {
          speed *= Math.max(0.5, Number(this.mountSpeedMultiplier()) || 1);
        }
        return speed;
      }

      resetCanvasTransform() {
        const dpr = this.displayPixelRatio?.() || Math.min(Math.max(Number(window.devicePixelRatio) || 1, 1), 2);
        try {
          if (ctx?.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          else if (ctx?.resetTransform) {
            ctx.resetTransform();
            ctx.scale(dpr, dpr);
          }
          if (ctx) ctx.imageSmoothingEnabled = false;
        } catch (_err) {}
      }

      sanitizeWorldCamera() {
        if (!this.camera) this.camera = {};
        const cfg = window.DreamRealms?.CONFIG || CONFIG;
        const defaultZoom = cfg.CAMERA_DEFAULT_ZOOM || 1;
        const minZoom = cfg.CAMERA_MIN_ZOOM || 0.55;
        const maxZoom = cfg.CAMERA_MAX_ZOOM || 2.2;
        if (!Number.isFinite(this.camera.yaw)) this.camera.yaw = 0;
        if (!Number.isFinite(this.camera.yawVel)) this.camera.yawVel = 0;
        if (!Number.isFinite(this.camera.zoom) || this.camera.zoom <= 0) this.camera.zoom = defaultZoom;
        if (!Number.isFinite(this.camera.targetZoom) || this.camera.targetZoom <= 0) this.camera.targetZoom = this.camera.zoom;
        if (!Number.isFinite(this.camera.shake)) this.camera.shake = 0;
        this.camera.zoom = clamp(this.camera.zoom, minZoom, maxZoom);
        this.camera.targetZoom = clamp(this.camera.targetZoom, minZoom, maxZoom);
        if (Math.abs(this.camera.zoom - this.camera.targetZoom) > (maxZoom - minZoom) * 1.25) this.camera.zoom = this.camera.targetZoom;
        this.camera.shake = clamp(this.camera.shake, 0, 8);
      }

      recenterCameraOnPlayer(resetYaw = false) {
        this.sanitizeWorldCamera();
        if (resetYaw) {
          this.camera.yaw = 0;
          this.camera.yawVel = 0;
        }
        this.camera.shake = 0;
        this.clearClickMoveTarget?.();
      }

      handleRuntimeFrameError(err, phase = 'frame') {
        const now = performance.now();
        this.resetCanvasTransform?.();
        this.clearClickMoveTarget?.();
        this.sanitizeWorldCamera?.();
        if (this.player) {
          if (!Number.isFinite(this.player.x)) this.player.x = CONFIG.START_X + 0.5;
          if (!Number.isFinite(this.player.y)) this.player.y = CONFIG.START_Y + 0.5;
          this.player.vx = 0;
          this.player.vy = 0;
          this.recenterCameraOnPlayer?.(false);
        }
        if (!this.lastRuntimeFaultAt || now - this.lastRuntimeFaultAt > 2500) {
          this.lastRuntimeFaultAt = now;
          console.error(`[Blackroot] Runtime ${phase} recovered`, err);
          const msg = err?.message ? `Recovered from a ${phase} fault: ${err.message}` : `Recovered from a ${phase} fault.`;
          this.log?.(msg);
        }
      }

      beginAiFrame() {
        if (!this.perfStats) return;
        this.perfStats.aiUpdatesThisFrame = 0;
        this.perfStats.enemiesAwake = 0;
        this.perfStats.enemiesThrottled = 0;
        this.perfStats.enemiesSleeping = 0;
        this.perfStats.enemiesMid = 0;
        this.perfStats.enemiesFar = 0;
      }

      recordEnemyAiBudget(enemy, band = 'near', skipped = false) {
        if (!this.perfStats || !enemy) return;
        const key = String(band || 'near').toLowerCase();
        if (skipped) this.perfStats.enemiesThrottled += 1;
        else {
          this.perfStats.enemiesAwake += 1;
          this.perfStats.aiUpdatesThisFrame += 1;
        }
        if (key === 'sleep') this.perfStats.enemiesSleeping += 1;
        else if (key === 'mid') this.perfStats.enemiesMid += 1;
        else if (key === 'far') this.perfStats.enemiesFar += 1;
      }

      toggleDebugOverlay() {
        this.debugOverlayOpen = !this.debugOverlayOpen;
        if (ui.debugOverlay) ui.debugOverlay.classList.toggle('visible', !!this.debugOverlayOpen);
        document.body?.classList?.toggle('debugHudOpen', !!this.debugOverlayOpen);
        this.updateDebugOverlay?.(true);
      }

      formatPerfNumber(value, digits = 1) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(digits) : '--';
      }

      syncRuntimeMemoryPerfStats() {
        if (!this.perfStats) return;
        const stats = this.runtimeMemoryStats || {};
        this.perfStats.effectPoolEntries = Array.isArray(this._effectPool) ? this._effectPool.length : 0;
        this.perfStats.effectPoolReused = stats.effectsReused || 0;
        this.perfStats.effectPoolRecycled = stats.effectsRecycled || 0;
        this.perfStats.effectsExpired = stats.effectsExpired || 0;
        this.perfStats.effectsDropped = stats.effectsDropped || 0;
        this.perfStats.damageTextPoolEntries = Array.isArray(this._damageTextPool) ? this._damageTextPool.length : 0;
        this.perfStats.damageTextPoolReused = stats.damageTextReused || 0;
        this.perfStats.damageTextPoolRecycled = stats.damageTextRecycled || 0;
        this.perfStats.damageTextDropped = stats.damageTextDropped || 0;
        this.perfStats.arraysCompacted = stats.arraysCompacted || 0;
        const scratch = this.renderScratch || {};
        this.perfStats.renderItemPoolSize = Array.isArray(scratch.renderItemPool) ? scratch.renderItemPool.length : 0;
        this.perfStats.renderItemPoolUsed = Number(scratch.renderItemPoolUsed || 0) || 0;
        this.perfStats.renderItemPoolTrims = Number(stats.poolTrims || 0) || 0;
      }

      updateDebugOverlay(force = false) {
        if (!ui.debugOverlayBody) return;
        if (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true) return;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const intervalMs = Math.max(100, Number((this.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {}).debugOverlayInterval || 0.25) * 1000);
        if (!force && Number(this._lastDebugOverlayUpdateMs || 0) > 0 && now - this._lastDebugOverlayUpdateMs < intervalMs) return;
        this._lastDebugOverlayUpdateMs = now;
        if (DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true && ui.debugOverlay) ui.debugOverlay.classList.add('visible');
        document.body?.classList?.toggle('performanceOverlayVisible', DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true);
        this.syncRuntimeMemoryPerfStats?.();
        this.performanceVerifier?.syncPerfStats?.(this.perfStats);
        const perf = this.perfStats || {};
        const cache = this.runtimeSpriteCache?.snapshotStats?.() || {};
        const dpr = this.displayPixelRatio?.() || 1;
        const lines = [
          `FPS: ${this.displayFpsEma ? Math.round(this.displayFpsEma) : this.currentFps || '--'}`,
          `Frame: ${this.formatPerfNumber(perf.frameMs)} ms`,
          `Update: ${this.formatPerfNumber(perf.updateMs)} ms`,
          `Render: ${this.formatPerfNumber(perf.renderMs)} ms`,
          `DPR: ${this.formatPerfNumber(dpr, 2)}  Pad: ${this.worldRenderPadTiles?.() || CONFIG.RENDER_PAD}`,
          `Preset: ${perf.performancePreset || this.performanceMode || 'balanced'}${perf.lowSpecMode ? ' + LowSpec' : ''}`,
          `Hotspot: ${perf.hotspotArea || 'pending'} ${perf.hotspotReason || ''}`,
          `Benchmark: ${perf.benchmarkActive ? `running ${Math.ceil(perf.benchmarkRemainingSec || 0)}s left` : `idle avg ${Math.round(perf.benchmarkAvgFps || 0)} FPS`}`,
          `BenchmarkLast: p95 ${this.formatPerfNumber(perf.benchmarkP95FrameMs || 0)} ms, worst ${this.formatPerfNumber(perf.benchmarkWorstFrameMs || 0)} ms, hotspot ${perf.benchmarkLastHotspot || '--'}`,
          `BenchmarkDrift: sprite miss/s ${this.formatPerfNumber(perf.benchmarkSpriteMissesPerSecond || 0, 2)}, evict/s ${this.formatPerfNumber(perf.benchmarkSpriteEvictionsPerSecond || 0, 2)}, path budget ${perf.benchmarkPathFrameBudgetDelta || 0}`,
          `Recommend: ${perf.hotspotRecommendation || 'Run F6 benchmark.'}`,
          `Drawn: entities ${perf.entitiesDrawn || 0}, chunks ${perf.terrainChunksDrawn || 0}`,
          `Terrain: surfaces ${perf.terrainSurfacesDrawn || 0}, water ${perf.terrainWaterSurfacesDrawn || 0}, shore ${perf.terrainShoreSurfacesDrawn || 0}`,
          `TerrainCache: entries ${perf.terrainChunkCacheEntries || 0}, builds ${perf.terrainChunkBuilds || 0}, invalid ${perf.terrainChunkCacheInvalidations || 0}`,
          `TerrainCull: considered ${perf.terrainChunksConsidered || 0}, culled ${perf.terrainChunksCulled || 0}`,
          `Objects: queued ${perf.objectsQueued || 0}, culled ${perf.objectsCulled || 0}, chunks ${perf.objectChunksVisited || 0}/${perf.objectChunkCacheEntries || 0}`,
          `Queued: tiles ${perf.tilesQueued || 0}, world ${perf.worldRenderables || 0}`,
          `Queued FX: effects ${perf.effectsQueued || 0}, dmg ${perf.damageTextQueued || 0}`,
          `MemoryPools: fx ${perf.effectPoolEntries || 0} recycled ${perf.effectPoolRecycled || 0} reused ${perf.effectPoolReused || 0}`,
          `MemoryPools: dmg ${perf.damageTextPoolEntries || 0} recycled ${perf.damageTextPoolRecycled || 0} reused ${perf.damageTextPoolReused || 0}`,
          `MemoryPressure: fx expired ${perf.effectsExpired || 0}, fx dropped ${perf.effectsDropped || 0}, dmg dropped ${perf.damageTextDropped || 0}`,
          `RenderPool: used ${perf.renderItemPoolUsed || 0}, size ${perf.renderItemPoolSize || 0}, trims ${perf.renderItemPoolTrims || 0}, compact ${perf.arraysCompacted || 0}`,
          `QueueCost: build ${this.formatPerfNumber(perf.renderQueueBuildMs || 0)} ms, sort ${this.formatPerfNumber(perf.renderQueueSortMs || 0)} ms`,
          `Cull: ent t${perf.entityTileCulled || 0}/s${perf.entityScreenCulled || 0}, fx t${perf.effectTileCulled || 0}/s${perf.effectScreenCulled || 0}, dmg t${perf.damageTileCulled || 0}/s${perf.damageScreenCulled || 0}`,
          `Backend: ${perf.renderBackendActive || 'canvas2d'} active, WebGL ${perf.renderBackendWebgl ? 'yes' : 'no'}, WebGL2 ${perf.renderBackendWebgl2 ? 'yes' : 'no'}, Offscreen ${perf.renderBackendOffscreenCanvas ? 'yes' : 'no'}`,
          `BackendProto: ready ${perf.renderBackendWebglPrototypeReady ? 'yes' : 'no'}, maxTex ${perf.renderBackendWebglMaxTextureSize || 0}, lost ${perf.renderBackendWebglContextLost ? 'yes' : 'no'}`,
          `BackendWatch: ${perf.renderBackendWatchdogEnabled ? 'on' : 'off'}, safe ${perf.renderBackendSafeMode ? 'yes' : 'no'}, score ${perf.renderBackendFailureScore || 0}, trips ${perf.renderBackendWatchdogTrips || 0}, fallback ${perf.renderBackendAutoFallbacks || 0}`,
          `BackendCooldown: ${Math.ceil((perf.renderBackendCooldownRemainingMs || 0) / 1000)}s, denied ${perf.renderBackendModeDenied ? 'yes' : 'no'} ${perf.renderBackendModeDeniedReason || ''}, last ${perf.renderBackendLastFallbackReason || 'ok'}`,
          `HybridDefault: ${perf.hybridDefaultCandidateArmed ? 'armed' : 'off'}, compat ${perf.hybridDefaultCompatibilityMode ? 'yes' : 'no'}, state ${perf.hybridDefaultCandidateState || 'idle'}, ready ${perf.hybridDefaultCandidateReady ? 'yes' : 'no'}`,
          `HybridDefaultQA: safe ${perf.hybridDefaultCandidateSafeFrames || 0}, unstable ${perf.hybridDefaultCandidateUnstableFrames || 0}, disabled ${perf.hybridDefaultCandidateDisabledLayers || 'none'}, last ${perf.hybridDefaultCandidateLastReason || 'ok'}`,
          `HybridDefaultLayers: terrain ${perf.hybridDefaultCandidateTerrainHealth || '--'}, sprites ${perf.hybridDefaultCandidateSpriteHealth || '--'}, fx ${perf.hybridDefaultCandidateEffectHealth || '--'}, dmg ${perf.hybridDefaultCandidateDamageTextHealth || '--'}, fallback ${perf.hybridDefaultCandidateFallbacks || 0}, cost ${this.formatPerfNumber(perf.hybridDefaultCandidateCostMs || 0)} ms`,
          `HybridRollout: ${perf.hybridDefaultRolloutEnabled ? 'on' : 'off'}, policy ${perf.hybridDefaultRolloutPolicy || 'auto'}, state ${perf.hybridDefaultRolloutState || 'idle'}, active ${perf.hybridDefaultRolloutDefaultActive ? 'yes' : 'no'}`,
          `HybridRolloutQA: risk ${perf.hybridDefaultRolloutRisk || 'pending'}, layers ${perf.hybridDefaultRolloutLayers || 'none'}, success ${perf.hybridDefaultRolloutSuccessfulFrames || 0}, unstable ${perf.hybridDefaultRolloutUnstableFrames || 0}, rollback ${Math.ceil((perf.hybridDefaultRolloutRollbackRemainingMs || 0) / 1000)}s`,
          `HybridRolloutLast: failures ${perf.hybridDefaultRolloutFailureCount || 0}, candidate ${perf.hybridDefaultRolloutCandidateState || '--'}, qa ${perf.hybridDefaultRolloutQaState || '--'}, last ${perf.hybridDefaultRolloutLastReason || 'ok'}`,
          `BackendBatch: sprite ${perf.renderBackendSpriteBatchPrepared || 0}, terrain ${perf.renderBackendTerrainBatchPrepared || 0}, world ${perf.renderBackendWorldBatchPrepared || 0}, overflow ${perf.renderBackendBatchOverflow || 0}`,
          `BackendKinds: obj ${perf.renderBackendObjectBatchPrepared || 0}, ent ${perf.renderBackendEntityBatchPrepared || 0}, fx ${perf.renderBackendEffectBatchPrepared || 0}, dmg ${perf.renderBackendDamageBatchPrepared || 0}`,
          `BackendCost: batch ${this.formatPerfNumber(perf.renderBackendBatchBuildMs || 0)} ms, drawable ${this.formatPerfNumber(perf.renderBackendBatchDrawablePct || 0, 1)}%`,
          `HybridVisible: consolidated ${perf.renderBackendHybridVisibleFrameConsolidation ? 'yes' : 'no'}, mask ${perf.renderBackendHybridVisiblePromotedLayerMask || '--'}, frame ${this.formatPerfNumber(perf.renderBackendHybridVisibleFrameMs || 0)} ms`,
          `HybridVisibleFlush: flushes ${perf.renderBackendHybridVisibleFlushes || 0}, boundaries ${perf.renderBackendHybridVisibleBoundaryFlushes || 0}, switches ${perf.renderBackendHybridVisibleLayerSwitches || 0}, last ${perf.renderBackendHybridVisibleLastFlushReason || 'none'}`,
          `HybridVisibleFallback: fallback ${perf.renderBackendHybridVisibleFallbacks || 0}, canvasFallbackDraws ${perf.renderBackendHybridVisibleCanvasFallbackDraws || 0}`,
          `HybridQA: ${perf.hybridQaEnabled ? perf.hybridQaState || 'pending' : 'off'}, held ${perf.hybridQaHeldOffLayers || 'none'}, worst ${perf.hybridQaWorstLayer || '--'}, pressure ${perf.hybridQaFallbackPressure || 0}`,
          `HybridQARisk: mixed ${perf.hybridQaMixedFallbackLayer || 'none'}, doubleRisk ${perf.hybridQaDoubleDrawRiskFrames || 0}, missedRisk ${perf.hybridQaMissedDrawRiskFrames || 0}, cost ${this.formatPerfNumber(perf.hybridQaFrameCostMs || 0)} ms`,
          `HybridQAHoldoff: terrain ${Math.ceil((perf.hybridQaHoldoffMs_terrain || 0)/1000)}s, sprites ${Math.ceil((perf.hybridQaHoldoffMs_sprites || 0)/1000)}s, fx ${Math.ceil((perf.hybridQaHoldoffMs_effects || 0)/1000)}s, dmg ${Math.ceil((perf.hybridQaHoldoffMs_damageText || 0)/1000)}s`,
          `HybridQAReason: ${perf.hybridQaLastReason || 'ok'}`,
          `HybridAudit: ${perf.renderBackendHybridCameraDepthAuditEnabled ? (perf.renderBackendHybridCameraDepthAuditState || 'pending') : 'off'}, blocked ${perf.renderBackendHybridPromotionBlockedByAudit ? 'yes' : 'no'}, reason ${perf.renderBackendHybridCameraDepthAuditLastReason || 'ok'}`,
          `HybridAuditCamera: rt max ${this.formatPerfNumber(perf.renderBackendHybridCameraRoundTripMaxTiles || 0, 3)}t avg ${this.formatPerfNumber(perf.renderBackendHybridCameraRoundTripAvgTiles || 0, 3)}t, yawΔ ${this.formatPerfNumber(perf.renderBackendHybridCameraYawDeltaDeg || 0, 1)}°, zoomΔ ${this.formatPerfNumber(perf.renderBackendHybridCameraZoomDelta || 0, 2)}`,
          `HybridAuditDepth: violations ${perf.renderBackendHybridDepthOrderViolations || 0}, spriteOrigin max ${this.formatPerfNumber(perf.renderBackendHybridSpriteOriginMaxPx || 0, 1)}px avg ${this.formatPerfNumber(perf.renderBackendHybridSpriteOriginAvgPx || 0, 1)}px samples ${perf.renderBackendHybridSpriteOriginSamples || 0}`,
          `WebGLSprite: mode ${perf.renderBackendRendererMode || 'canvas2d'}, enabled ${perf.renderBackendWebglSpritePrototypeEnabled ? 'yes' : 'no'}, program ${perf.renderBackendWebglSpriteProgramReady ? 'yes' : 'no'}`,
          `WebGLSpriteBatch: cand ${perf.renderBackendWebglSpriteCandidates || 0}, eligible ${perf.renderBackendWebglSpriteEligible || 0}, draw ${perf.renderBackendWebglSpriteDrawCalls || 0}, quads ${perf.renderBackendWebglSpriteQuads || 0}`,
          `WebGLSpriteTex: tex ${perf.renderBackendWebglSpriteTextureEntries || 0}, upload ${perf.renderBackendWebglSpriteTextureUploads || 0}, evict ${perf.renderBackendWebglSpriteTextureEvictions || 0}, fallback ${perf.renderBackendWebglSpriteFallbacks || 0}`,
          `WebGLSpriteCost: upload ${this.formatPerfNumber(perf.renderBackendWebglSpriteUploadMs || 0)} ms, draw ${this.formatPerfNumber(perf.renderBackendWebglSpriteDrawMs || 0)} ms, ${perf.renderBackendWebglSpriteLastError || 'ok'}`,
          `WebGLTerrain: enabled ${perf.renderBackendWebglTerrainPrototypeEnabled ? 'yes' : 'no'}, program ${perf.renderBackendWebglTerrainProgramReady ? 'yes' : 'no'}, cand ${perf.renderBackendWebglTerrainCandidates || 0}`,
          `WebGLTerrainBatch: draw ${perf.renderBackendWebglTerrainDrawCalls || 0}, quads ${perf.renderBackendWebglTerrainQuads || 0}, tex ${perf.renderBackendWebglTerrainTextureEntries || 0}, upload ${perf.renderBackendWebglTerrainTextureUploads || 0}`,
          `WebGLTerrainCost: upload ${this.formatPerfNumber(perf.renderBackendWebglTerrainUploadMs || 0)} ms, draw ${this.formatPerfNumber(perf.renderBackendWebglTerrainDrawMs || 0)} ms, fallback ${perf.renderBackendWebglTerrainFallbacks || 0}, ${perf.renderBackendWebglTerrainLastError || 'ok'}`,
          `WebGLTerrainVisible: enabled ${perf.renderBackendWebglVisibleTerrainLayerEnabled ? 'yes' : 'no'}, active ${perf.renderBackendWebglVisibleTerrainLayerActive ? 'yes' : 'no'}, promoted ${perf.renderBackendWebglVisibleTerrainLayerPromotedThisFrame ? 'yes' : 'no'}`,
          `WebGLTerrainVisibleCost: draw ${this.formatPerfNumber(perf.renderBackendWebglVisibleTerrainDrawMs || 0)} ms, composite ${this.formatPerfNumber(perf.renderBackendWebglVisibleTerrainCompositeMs || 0)} ms, quads ${perf.renderBackendWebglVisibleTerrainQuads || 0}, fallback ${perf.renderBackendWebglVisibleTerrainFallbacks || 0}, ${perf.renderBackendWebglVisibleTerrainLastError || 'ok'}`,
          `WebGLTerrainStability: seamBleed ${perf.renderBackendWebglTerrainSeamBleedPx || 0}px, partialFallback ${perf.renderBackendWebglTerrainPartialFallbacks || 0}`,
          `WebGLSpriteVisible: enabled ${perf.renderBackendWebglVisibleSpriteLayerEnabled ? 'yes' : 'no'}, active ${perf.renderBackendWebglVisibleSpriteLayerActive ? 'yes' : 'no'}, promoted ${perf.renderBackendWebglVisibleSpriteLayerPromotedThisFrame ? 'yes' : 'no'}`,
          `WebGLSpriteVisibleBatch: cand ${perf.renderBackendWebglVisibleSpriteCandidates || 0}, queued ${perf.renderBackendWebglVisibleSpriteQueued || 0}, draw ${perf.renderBackendWebglVisibleSpriteDrawCalls || 0}, quads ${perf.renderBackendWebglVisibleSpriteQuads || 0}, flush ${perf.renderBackendWebglVisibleSpriteFlushes || 0}`,
          `WebGLSpriteDepth: groups ${perf.renderBackendWebglVisibleSpriteDepthGroups || 0}, depthFallback ${perf.renderBackendWebglVisibleSpriteDepthOrderFallbacks || 0}, canvasFallbackDraws ${perf.renderBackendWebglVisibleSpriteCanvasFallbackDraws || 0}`,
          `WebGLSpriteVisibleCost: draw ${this.formatPerfNumber(perf.renderBackendWebglVisibleSpriteDrawMs || 0)} ms, composite ${this.formatPerfNumber(perf.renderBackendWebglVisibleSpriteCompositeMs || 0)} ms, fallback ${perf.renderBackendWebglVisibleSpriteFallbacks || 0}, ${perf.renderBackendWebglVisibleSpriteLastError || 'ok'}`,
          `WebGLEffectsVisible: enabled ${perf.renderBackendWebglVisibleEffectLayerEnabled ? 'yes' : 'no'}, active ${perf.renderBackendWebglVisibleEffectLayerActive ? 'yes' : 'no'}, promoted ${perf.renderBackendWebglVisibleEffectLayerPromotedThisFrame ? 'yes' : 'no'}`,
          `WebGLEffectsBatch: cand ${perf.renderBackendWebglVisibleEffectCandidates || 0}, queued ${perf.renderBackendWebglVisibleEffectQueued || 0}, draw ${perf.renderBackendWebglVisibleEffectDrawCalls || 0}, quads ${perf.renderBackendWebglVisibleEffectQuads || 0}, flush ${perf.renderBackendWebglVisibleEffectFlushes || 0}`,
          `WebGLEffectsCache: entries ${perf.renderBackendWebglVisibleEffectCacheEntries || 0}, hit ${perf.renderBackendWebglVisibleEffectCacheHits || 0}, miss ${perf.renderBackendWebglVisibleEffectCacheMisses || 0}, evict ${perf.renderBackendWebglVisibleEffectCacheEvictions || 0}`,
          `WebGLEffectsCost: draw ${this.formatPerfNumber(perf.renderBackendWebglVisibleEffectDrawMs || 0)} ms, composite ${this.formatPerfNumber(perf.renderBackendWebglVisibleEffectCompositeMs || 0)} ms, fallback ${perf.renderBackendWebglVisibleEffectFallbacks || 0}, canvasFallback ${perf.renderBackendWebglVisibleEffectCanvasFallbackDraws || 0}, ${perf.renderBackendWebglVisibleEffectLastError || 'ok'}`,
          `WebGLDamageText: enabled ${perf.renderBackendWebglVisibleDamageTextLayerEnabled ? 'yes' : 'no'}, active ${perf.renderBackendWebglVisibleDamageTextLayerActive ? 'yes' : 'no'}, promoted ${perf.renderBackendWebglVisibleDamageTextLayerPromotedThisFrame ? 'yes' : 'no'}`,
          `WebGLDamageBatch: cand ${perf.renderBackendWebglVisibleDamageTextCandidates || 0}, queued ${perf.renderBackendWebglVisibleDamageTextQueued || 0}, draw ${perf.renderBackendWebglVisibleDamageTextDrawCalls || 0}, quads ${perf.renderBackendWebglVisibleDamageTextQuads || 0}, flush ${perf.renderBackendWebglVisibleDamageTextFlushes || 0}`,
          `WebGLDamageCache: entries ${perf.renderBackendWebglVisibleDamageTextCacheEntries || 0}, hit ${perf.renderBackendWebglVisibleDamageTextCacheHits || 0}, miss ${perf.renderBackendWebglVisibleDamageTextCacheMisses || 0}, evict ${perf.renderBackendWebglVisibleDamageTextCacheEvictions || 0}`,
          `WebGLDamageCost: draw ${this.formatPerfNumber(perf.renderBackendWebglVisibleDamageTextDrawMs || 0)} ms, composite ${this.formatPerfNumber(perf.renderBackendWebglVisibleDamageTextCompositeMs || 0)} ms, fallback ${perf.renderBackendWebglVisibleDamageTextFallbacks || 0}, canvasFallback ${perf.renderBackendWebglVisibleDamageTextCanvasFallbackDraws || 0}, ${perf.renderBackendWebglVisibleDamageTextLastError || 'ok'}`,
          `WebGLScene: enabled ${perf.renderBackendWebglScenePreviewEnabled ? 'yes' : 'no'}, overlay ${perf.renderBackendWebglScenePreviewOverlayEnabled ? 'yes' : 'no'}, ready ${perf.renderBackendWebglScenePreviewReady ? 'yes' : 'no'}`,
          `WebGLSceneLayers: terrain ${perf.renderBackendWebglScenePreviewTerrainLayerEnabled ? 'on' : 'off'}, sprites ${perf.renderBackendWebglScenePreviewSpriteLayerEnabled ? 'on' : 'off'}, guides ${perf.renderBackendWebglScenePreviewGuidesEnabled ? 'on' : 'off'}`,
          `WebGLSceneBatch: draw ${perf.renderBackendWebglScenePreviewDrawCalls || 0}, quads ${perf.renderBackendWebglScenePreviewQuads || 0}, terrain ${perf.renderBackendWebglScenePreviewTerrainQuads || 0}, sprites ${perf.renderBackendWebglScenePreviewSpriteQuads || 0}`,
          `WebGLSceneCost: draw ${this.formatPerfNumber(perf.renderBackendWebglScenePreviewDrawMs || 0)} ms, composite ${this.formatPerfNumber(perf.renderBackendWebglScenePreviewCompositeMs || 0)} ms, ${perf.renderBackendWebglScenePreviewLastError || 'ok'}`,
          `WebGLSceneQA: score ${perf.renderBackendWebglScenePreviewAlignmentScore || 0}, coverage ${this.formatPerfNumber(perf.renderBackendWebglScenePreviewCoveragePct || 0, 1)}%, fallback ${perf.renderBackendWebglScenePreviewFallbackPressure || 0}, ${perf.renderBackendWebglScenePreviewPromotionReady ? 'promotion-ready' : (perf.renderBackendWebglScenePreviewReadiness || 'inactive')}`,
          `WebGLSceneNext: ${perf.renderBackendWebglScenePreviewRecommendation || 'Use preview overlay before promotion.'}`,
          `OverlayCache: entries ${perf.overlayCacheEntries || 0}, hit ${perf.overlayCacheHits || 0}, miss ${perf.overlayCacheMisses || 0}, evict ${perf.overlayCacheEvictions || 0}`,
          `OverlayCost: draws ${perf.overlayCacheDraws || 0}, frame ${perf.overlayFrameDraws || 0}, build ${this.formatPerfNumber(perf.overlayCacheBuildMs || 0)} ms`,
          `Adaptive: ${perf.adaptiveEnabled ? perf.adaptiveLevelName || 'on' : 'off'} L${perf.adaptiveLevel ?? '--'}, ema f${this.formatPerfNumber(perf.adaptiveFrameMsEma || 0)} r${this.formatPerfNumber(perf.adaptiveRenderMsEma || 0)} u${this.formatPerfNumber(perf.adaptiveUpdateMsEma || 0)}`,
          `AdaptiveShift: down ${perf.adaptiveDownshifts || 0}, up ${perf.adaptiveUpshifts || 0}, ${perf.adaptiveLastChangeReason || 'initial'}`,
          `AI: updates ${perf.aiUpdatesThisFrame || 0}, awake ${perf.enemiesAwake || 0}`,
          `AI: throttled ${perf.enemiesThrottled || 0}, sleeping ${perf.enemiesSleeping || 0}`,
          `AI bands: mid ${perf.enemiesMid || 0}, far ${perf.enemiesFar || 0}`,
          `PathWorker: ${this.pathWorkerMetrics?.enabled ? 'on' : 'off'} ready ${this.pathWorkerMetrics?.ready ? 'yes' : 'no'} pending ${this.pathWorkerMetrics?.pending || 0}`,
          `PathWorker: req/frame ${this.pathWorkerMetrics?.requestsThisFrame || 0}, done ${this.pathWorkerMetrics?.completed || 0}, fail ${this.pathWorkerMetrics?.failed || 0}, fallback ${this.pathWorkerMetrics?.syncFallbacks || 0}`,
          `PathWorkerPressure: budget ${this.pathWorkerMetrics?.frameBudgetSkips || 0}, cap ${this.pathWorkerMetrics?.pendingCapSkips || 0}, cooldown ${this.pathWorkerMetrics?.cooldownRejects || 0}, reused ${this.pathWorkerMetrics?.reusedExistingRoutes || 0}`,
          `PathWorkerGrid: v${this.pathWorkerMetrics?.gridVersion || 0}, builds ${this.pathWorkerMetrics?.gridBuilds || 0}, cells ${this.pathWorkerMetrics?.gridCells || 0}`,
          `UI: ${this.formatPerfNumber(perf.uiUpdateMs || 0)} ms, fast ${perf.uiFastUpdates || 0}, full ${perf.uiFullUpdates || 0}, skip ${perf.uiSkippedUpdates || 0}`,
          `UI DOM: writes ${perf.uiDomWrites || 0}, text ${perf.uiTextWrites || 0}, html ${perf.uiHtmlWrites || 0}, style ${perf.uiStyleWrites || 0}`,
          `UI Companion: resource writes ${perf.uiCompanionResourceUpdates || 0}`,
          `SpriteCache: ${cache.enabled ? 'on' : 'off'} entries ${cache.entries || 0}/${cache.maxEntries || 0}`,
          `SpriteCache: hits ${cache.hits || 0}, misses ${cache.misses || 0}, evict ${cache.evictions || 0}`,
          `SpriteCache/frame: +${cache.generatedThisFrame || 0}, hit ${cache.hitsThisFrame || 0}, miss ${cache.missesThisFrame || 0}, skip ${cache.budgetSkipsThisFrame || 0}`,
          `SpriteCache/topMiss: ${(cache.topMissModels || []).slice(0, 3).map(m => `${m.model}:${m.count}`).join(', ') || '--'}`
        ];
        const next = lines.join('\n');
        if (ui.debugOverlayBody.textContent !== next) ui.debugOverlayBody.textContent = next;
      }

      update(dt) {
        this._perfFrameId = ((this._perfFrameId || 0) + 1) >>> 0;
        this.beginAiFrame?.();
        this.initUiFrameMetrics?.();
        this.updateWorldClock?.(dt);
        this.updateWeather?.(dt);
        this.updateAudioSystem?.(dt);
        this.updateStatusEffects?.(dt);
        this.updatePlayerSpellCast?.(dt);
        this.updatePendingSpellImpacts?.(dt);
        this.updateThreatRuntime?.(dt);
        this.handleInput(dt);
        this.updatePlayerEmoteState?.(dt);
        if (this.zoneTransitionCooldown > 0) this.zoneTransitionCooldown = Math.max(0, this.zoneTransitionCooldown - dt);
        this.updateCompanionTransitionGrace?.(dt);
        this.checkZoneTransition();
        this.updateBotShifts?.();
        for (const entity of this.entities) {
          if (entity === this.player) entity.updateBase(dt);
          else if (entity._offShift) continue; // V0.20.62: off-shift bots are stood down - no AI either
          else if (entity.update) entity.update(this, dt);
        }
        this.deriveBotLocomotion?.(dt);
        this.updatePlayerRespawn(dt);

        this.updateEffects(dt);
        this.updatePortalRuntime?.(dt);
        this.updateTargetValidity();
        this.updateMobSpawnRuntime?.(dt);
        this.refreshEnemySpatialGrid?.(true);
        this.updateCombatRuntime?.(dt);
        this.updateSpiderWebRuntime?.(dt);
        this.updateCorpseCleanup?.(dt);
        this.updateCorpseLootAutoOpen?.();
        this.updateLootRollSessions?.(dt);

        this.updateMeditationForEntity(this.player, dt);
        this.updateBardMeditationAuraRuntime?.(dt);
        this.updateGreatStillness?.(dt);

        this.regen(dt);
        this.updateExternalSystems(dt);
        this.updateBotPlayerSystem?.(dt);
        this.updateAdventurerWorldEvents?.(dt);
        this.updateAdventurerDailySchedule?.(dt);
        this.updateAdventurerAbstractSim?.(dt);
        this.updateAdventurerMaterialization?.(dt);
        this.updateActorSeparation?.(dt);
        if (this.updateUIBatched) this.updateUIBatched(dt);
        else this.updateUI();
        this.updateCombatLevelUpPopup?.(dt * 1000);
        this.updateAutosave?.(dt);
        this.updateDebugOverlay?.();
        this.updateMultiplayer(dt);

        this.minimapTimer -= dt;
        if (this.minimapTimer <= 0) {
          this.drawMinimap();
          this.minimapTimer = Number((this.performanceSettings?.() || CONFIG.PERFORMANCE || {}).minimapInterval || 0.35);
        }

        if (this.mapOpen) {
          this.worldMapTimer = Math.max(0, Number(this.worldMapTimer || 0) - dt);
          if (this.worldMapTimer <= 0) {
            this.drawWorldMap();
            this.worldMapTimer = Number((this.performanceSettings?.() || CONFIG.PERFORMANCE || {}).worldMapInterval || 0.20);
          }
        }
      }

      // -------------------------------
      // Input and camera system
      // -------------------------------
      handleInput(dt) {
        if (!this.player) return;
        this.pollSteamDeckInput?.(dt);
        this.updateCameraRotation(dt);
        this.updateCameraZoom(dt);
        this.applySteamDeckLook?.(dt);
        if (!this.player.alive) return;
        if (this.hasStatusTag?.(this.player, 'stun')) {
          this.clearClickMoveTarget?.();
          return;
        }
        let camDx = 0;
        let camDy = 0;
        // WASD stays screen/camera-relative while the camera rotates.
        // These are camera-space movement vectors, then rotated back into world-space.
        if (this.isHeldAction('moveUp')) { camDx -= 1; camDy -= 1; }
        if (this.isHeldAction('moveDown')) { camDx += 1; camDy += 1; }
        if (this.isHeldAction('moveLeft')) { camDx -= 1; camDy += 1; }
        if (this.isHeldAction('moveRight')) { camDx += 1; camDy -= 1; }

        if (camDx || camDy) {
          this.clearClickMoveTarget();
          if (this.hasStatusTag?.(this.player, 'root')) {
            if (!this.player.lastRootMoveLogAt || performance.now() - this.player.lastRootMoveLogAt > 1800) {
              this.player.lastRootMoveLogAt = performance.now();
              this.logCombat?.('You are rooted.');
            }
            return;
          }
          this.cancelMeditation?.(this.player, 'movement');
          this.cancelPlayerEmote?.('movement');
          this.fishingSystem?.cancelForMovement?.();
          this.resourceGatheringSystem?.cancelForMovement?.();
          const len = Math.hypot(camDx, camDy);
          camDx /= len;
          camDy /= len;
          const c = Math.cos(this.camera.yaw || 0);
          const s = Math.sin(this.camera.yaw || 0);
          const dx = camDx * c + camDy * s;
          const dy = -camDx * s + camDy * c;
          const speed = this.playerWalkSpeed() * dt;
          this.tryMoveActorSubstepped?.(this.player, dx, dy, speed, { maxStep: 0.16 });
          this.player.setFacingFromDelta(dx, dy);
          return;
        }

        if (this.applySteamDeckMovement?.(dt)) return;

        this.updateClickToWalk(dt);
      }



      tryMoveActorSubstepped(entity, ux, uy, distance, options = {}) {
        if (!entity || !Number.isFinite(Number(ux)) || !Number.isFinite(Number(uy))) return false;
        let remaining = Math.max(0, Number(distance) || 0);
        if (remaining <= 0.0001) return false;
        const len = Math.hypot(ux, uy) || 1;
        ux /= len;
        uy /= len;
        const maxStep = Math.max(0.05, Number(options.maxStep) || 0.16);
        let moved = false;
        let guard = 0;
        while (remaining > 0.0001 && guard++ < 16) {
          const step = Math.min(remaining, maxStep);
          const ox = entity.x;
          const oy = entity.y;
          const nx = ox + ux * step;
          const ny = oy + uy * step;
          if (this.tryMove?.(entity, nx, ny)) {
            moved = true;
            remaining -= step;
            continue;
          }
          const absX = Math.abs(ux);
          const absY = Math.abs(uy);
          let axisMoved = false;
          if (absX >= absY && absX > 0.001) axisMoved = this.tryMove?.(entity, ox + Math.sign(ux) * Math.max(0.012, step * absX), oy) || false;
          if (!axisMoved && absY > 0.001) axisMoved = this.tryMove?.(entity, ox, oy + Math.sign(uy) * Math.max(0.012, step * absY)) || false;
          if (!axisMoved && absX < absY && absX > 0.001) axisMoved = this.tryMove?.(entity, ox + Math.sign(ux) * Math.max(0.012, step * absX), oy) || false;
          if (!axisMoved) break;
          moved = true;
          const actual = Math.hypot(entity.x - ox, entity.y - oy);
          remaining -= Math.max(actual, step * 0.45);
        }
        return moved;
      }

      hideWorldContextMenu() {
        const menu = document.getElementById('worldContextMenu');
        if (menu) menu.style.display = 'none';
      }

      resourceActionVerb(node) {
        const id = String(node?.type || node?.id || '').toLowerCase();
        const category = String(node?.category || '').toLowerCase();
        if (category === 'mining' || id.startsWith('ore_')) return 'Start Mining';
        if (category === 'fishing' || id.startsWith('fish_')) return 'Start Fishing';
        return 'Start Gathering';
      }

      stationForWorldObject(obj) {
        if (!obj) return null;
        const type = String(obj.type || '').toLowerCase();
        let id = obj.stationId || obj.craftingStationId || obj.station || null;
        if (!id && type === 'forge') id = 'station_forge';
        if (!id && type === 'campfire') id = 'station_campfire';
        if (!id && type === 'loom') id = 'station_loom';
        if (!id) return null;
        return this.editorCraftingStations?.[id] || DR.CRAFTING_STATION_BY_ID?.[id] || null;
      }

      showWorldContextMenu(clientX, clientY, world) {
        const menu = document.getElementById('worldContextMenu');
        if (!menu || !this.player) return false;
        const tx = Math.floor(world.x);
        const ty = Math.floor(world.y);
        const tile = this.map?.[ty]?.[tx] || null;
        const obj = this.objects?.[ty]?.[tx] || null;
        const actions = [];
        const npcActions = this.npcSystem?.contextActionsAtWorld?.(world) || [];
        if (npcActions.length) actions.push(...npcActions);
        const partyActions = this.partyContextActionsAtWorld?.(world) || [];
        if (partyActions.length) actions.push(...partyActions);
        const botActions = this.botContextActionsAtWorld?.(world) || [];
        if (botActions.length) actions.push(...botActions);
        const resource = this.resourceGatheringSystem?.findResourceAt?.(tx, ty, 2);
        if (resource) {
          const def = this.editorResourceTypes?.[resource.type || resource.id] || DR.RESOURCE_BY_ID?.[resource.type || resource.id] || resource;
          actions.push({
            label: this.resourceActionVerb(resource),
            title: def?.name || resource.name || 'Resource',
            run: () => this.resourceGatheringSystem?.startHarvestAtWorld?.(tx, ty, resource)
          });
        }
        if (tile && tile.type === TILE.WATER) {
          actions.push({
            label: 'Start Fishing',
            title: tile.waterDepth >= 9 ? 'Deep Water' : 'Water',
            run: () => this.fishingSystem?.startFishingAtWater?.(tx, ty)
          });
        }
        const station = this.stationForWorldObject(obj);
        if (station) {
          const profession = String(station.profession || '').toLowerCase();
          const label = profession === 'blacksmithing' ? 'Start Smelting' : profession === 'cooking' ? 'Start Cooking' : 'Start Crafting';
          actions.push({
            label,
            title: station.name || 'Crafting Station',
            run: () => {
              const distToStation = Math.hypot((tx + 0.5) - this.player.x, (ty + 0.5) - this.player.y);
              if (distToStation > 3.25) return this.log?.('Move closer to the crafting station.');
              const key = `${this.currentZone === 'cave' ? (this.getActiveCaveZoneKey?.() || 'cave') : 'dark_woods'}:${tx},${ty}:${station.id || 'station'}`;
              this.craftingSystem?.toggleWindow?.(true, { station, obj, x: tx, y: ty, key, distance: distToStation });
            }
          });
        }
        if (!actions.length) {
          this.hideWorldContextMenu();
          return false;
        }
        const title = actions[0].title || 'Actions';
        menu.innerHTML = `<div class="contextTitle">${escapeHtml(title)}</div>${actions.map((action, i) => `<button type="button" data-world-action="${i}">${escapeHtml(action.label)}</button>`).join('')}`;
        menu.querySelectorAll('[data-world-action]').forEach(button => {
          button.addEventListener('click', () => {
            const action = actions[Number(button.dataset.worldAction)];
            this.hideWorldContextMenu();
            action?.run?.();
          });
        });
        const pad = 12;
        menu.style.display = 'block';
        let x = Number(clientX) + 2;
        let y = Number(clientY) + 2;
        const w = menu.offsetWidth || 180;
        const h = menu.offsetHeight || 90;
        if (x + w + pad > window.innerWidth) x = Math.max(pad, window.innerWidth - w - pad);
        if (y + h + pad > window.innerHeight) y = Math.max(pad, window.innerHeight - h - pad);
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        return true;
      }

      safeScreenToWorld(sx, sy) {
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
        try {
          const world = this.screenToWorld(sx, sy);
          if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return null;
          return world;
        } catch (err) {
          console.warn('[Blackroot] screenToWorld failed', err);
          return null;
        }
      }

      getEntityTargetScreenBounds(entity, options = {}) {
        if (!entity || !Number.isFinite(Number(entity.x)) || !Number.isFinite(Number(entity.y))) return null;
        const clickPadding = Number.isFinite(Number(options.hitPaddingPx)) ? Number(options.hitPaddingPx) : (options.hostile ? 12 : 8);
        const spriteBounds = entity._spriteClickBounds;
        if (spriteBounds && Number.isFinite(spriteBounds.x) && Number.isFinite(spriteBounds.y) && spriteBounds.w > 0 && spriteBounds.h > 0) {
          return {
            cx: spriteBounds.x + spriteBounds.w / 2,
            cy: spriteBounds.y + spriteBounds.h / 2,
            rx: Math.max(22, spriteBounds.w / 2 + clickPadding),
            ry: Math.max(22, spriteBounds.h / 2 + clickPadding),
            depth: spriteBounds.y + spriteBounds.h
          };
        }
        const tile = this.tileAt?.(entity.x, entity.y) || { elev: 0 };
        const foot = this.worldToScreen(entity.x, entity.y, (tile.elev || 0) + (entity.z || 0));
        if (!foot || !Number.isFinite(foot.x) || !Number.isFinite(foot.y)) return null;
        const visualScale = clamp(Number(entity.visualScale || entity.modelScale || entity.baseType?.visualScale || 1) || 1, 0.55, 2.35);
        const collisionRadius = Math.max(0.35, Number(entity.collisionRadius || entity.radius || entity.baseType?.collisionRadius || 0.55));
        const configuredWidth = Number(entity.targetClickWidthPx || entity.baseType?.targetClickWidthPx || 0);
        const configuredHeight = Number(entity.targetClickHeightPx || entity.baseType?.targetClickHeightPx || 0);
        const kind = String(entity.kind || '').toLowerCase();
        const baseRx = configuredWidth > 0 ? configuredWidth * 0.5 : (kind === 'enemy' ? 40 : 30) * visualScale + collisionRadius * 10;
        const baseRy = configuredHeight > 0 ? configuredHeight * 0.5 : (kind === 'enemy' ? 54 : 46) * visualScale + collisionRadius * 9;
        const anchorHeight = Number(entity.targetAnchorHeightPx || entity.baseType?.targetAnchorHeightPx || 0) || (kind === 'enemy' ? 66 * visualScale : 58 * visualScale);
        return {
          cx: foot.x,
          cy: foot.y - anchorHeight * 0.42,
          rx: clamp(baseRx + clickPadding, 28, 112),
          ry: clamp(baseRy + clickPadding, 34, 124),
          depth: foot.y
        };
      }

      pickTargetableEntityAtScreen(sx, sy, entities, options = {}) {
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
        let best = null;
        let bestScore = Infinity;
        for (const entity of entities || []) {
          if (!entity || entity.alive === false || entity.temporaryGroundItem) continue;
          const bounds = this.getEntityTargetScreenBounds(entity, options);
          if (!bounds) continue;
          const dx = sx - bounds.cx;
          const dy = sy - bounds.cy;
          const score = (dx * dx) / (bounds.rx * bounds.rx) + (dy * dy) / (bounds.ry * bounds.ry);
          if (score <= 1) {
            const depthBias = -bounds.depth * 0.00008;
            const finalScore = score + depthBias;
            if (finalScore < bestScore) {
              best = entity;
              bestScore = finalScore;
            }
          }
        }
        return best;
      }

      // 3D-mode counterpart of pickTargetableEntityAtScreen: a real raycast
      // against the 3D scene's entity meshes (respects perspective and
      // actual visual occlusion) first, falling back to a padded
      // screen-projection circle test (since a raw raycast alone requires
      // the cursor to land exactly on a mesh, and 3D perspective doesn't
      // carry the 2D picker's per-kind ellipse sizing). Only ever called
      // while the experimental 3D renderer is the active mode; the 2D path
      // above is completely unaffected.
      pickTargetableEntityAtScreen3D(sx, sy, entities, options = {}) {
        const list = (entities || []).filter(entity => entity && entity.alive !== false && !entity.temporaryGroundItem);
        if (!list.length) return null;
        const hitEntity = this.render3DSystem.raycastEntityAt(sx, sy);
        if (hitEntity && list.includes(hitEntity)) return hitEntity;
        const padding = Number.isFinite(Number(options.hitPaddingPx)) ? Number(options.hitPaddingPx) : (options.hostile ? 12 : 8);
        const radius = 34 + padding;
        let best = null;
        let bestScore = Infinity;
        for (const entity of list) {
          const screen = this.render3DSystem.projectEntityToScreen(entity);
          if (!screen) continue;
          const dx = sx - screen.x;
          const dy = sy - screen.y;
          const score = dx * dx + dy * dy;
          if (score <= radius * radius && score < bestScore) { best = entity; bestScore = score; }
        }
        return best;
      }

      pickEnemyAtScreen(sx, sy) {
        const enemies = (this.enemies || []).filter(enemy => this.isTargetableHostile ? this.isTargetableHostile(enemy) : (enemy?.alive && enemy.kind === 'enemy'));
        return this.pickTargetableEntityAtScreen(sx, sy, enemies, { hostile: true, hitPaddingPx: 14 });
      }

      pickFriendlyAtScreen(sx, sy) {
        const actors = this.friendlyTargetActors?.({ includePlayer: false }) || [this.merc, this.pet, ...(this.botPlayers || [])].filter(Boolean);
        const currentZone = this.currentZone || 'overworld';
        return this.pickTargetableEntityAtScreen(sx, sy, actors.filter(actor => {
          if (!actor || actor === this.player || !actor.alive) return false;
          if (actor.kind === 'bot' && (actor.zone || 'overworld') !== currentZone) return false;
          return true;
        }), { friendly: true });
      }

      findNearestWalkableClickTile(x, y, radius = 1) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        let best = null;
        let bestDist = Infinity;
        const searchRadius = Math.max(1, Math.min(4, Math.floor(Number(radius) || 1)));
        const candidates = [
          { x, y, precise: true },
          { x: cx + 0.5, y: cy + 0.5 },
          { x: cx + 0.35, y: cy + 0.35 },
          { x: cx + 0.65, y: cy + 0.35 },
          { x: cx + 0.35, y: cy + 0.65 },
          { x: cx + 0.65, y: cy + 0.65 }
        ];
        const clickBoundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        for (const c of candidates) {
          if (c.x < 0.5 || c.y < 0.5 || c.x > clickBoundsSize - 1.5 || c.y > clickBoundsSize - 1.5) continue;
          if (!this.isWalkable(c.x, c.y, this.player)) continue;
          return { x: c.x, y: c.y, precise: !!c.precise };
        }
        for (let r = 1; r <= searchRadius; r++) {
          for (let yy = cy - r; yy <= cy + r; yy++) {
            for (let xx = cx - r; xx <= cx + r; xx++) {
              if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r) continue;
              if (xx < 0 || yy < 0 || xx >= clickBoundsSize || yy >= clickBoundsSize) continue;
              const wx = xx + 0.5;
              const wy = yy + 0.5;
              if (!this.isWalkable(wx, wy, this.player)) continue;
              const d = Math.hypot(wx - x, wy - y);
              if (d < bestDist) {
                best = { x: wx, y: wy, precise: false };
                bestDist = d;
              }
            }
          }
          if (best) return best;
        }
        return best;
      }

      setClickMoveTarget(x, y, options = {}) {
        if (!this.player?.alive) return false;
        // V0.18.60: click-to-move must respect ROOT, just like keyboard movement does.
        if (this.hasStatusTag?.(this.player, 'root')) {
          if (!this.player.lastRootMoveLogAt || performance.now() - this.player.lastRootMoveLogAt > 1800) {
            this.player.lastRootMoveLogAt = performance.now();
            this.logCombat?.('You are rooted.');
          }
          this.clearClickMoveTarget();
          return false;
        }
        if (Number.isFinite(Number(options.screenX)) && Number.isFinite(Number(options.screenY))) {
          const sx = Number(options.screenX);
          const sy = Number(options.screenY);
          const clickedTarget = this.pickSpiderWebAtScreen?.(sx, sy) || this.pickEnemyAtScreen?.(sx, sy) || this.pickFriendlyAtScreen?.(sx, sy);
          if (clickedTarget) {
            this.clearClickMoveTarget();
            return false;
          }
        }
        const px = Number(this.player.x);
        const py = Number(this.player.y);
        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(x) || !Number.isFinite(y)) {
          this.clearClickMoveTarget();
          return false;
        }

        let dx = x - px;
        let dy = y - py;
        let d = Math.hypot(dx, dy);
        if (!Number.isFinite(d) || d <= CLICK_WALK_STOP_DISTANCE) {
          this.clearClickMoveTarget();
          return false;
        }
        if (d > CLICK_WALK_MAX_RANGE) {
          x = px + (dx / d) * CLICK_WALK_MAX_RANGE;
          y = py + (dy / d) * CLICK_WALK_MAX_RANGE;
        }

        const setClickBoundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        const target = this.findNearestWalkableClickTile(clamp(x, 0.5, setClickBoundsSize - 1.5), clamp(y, 0.5, setClickBoundsSize - 1.5), options.searchRadius || 3);
        if (!target) {
          this.log?.('Cannot walk there.');
          this.clearClickMoveTarget();
          return false;
        }

        const path = this.findPath?.(px, py, target.x, target.y, this.player, { maxNodes: 1200, maxRange: CLICK_WALK_MAX_RANGE + 8 }) || [];
        if (!path.length && !this.hasLineWalkPath?.(px, py, target.x, target.y, this.player)) {
          this.log?.('Cannot path there.');
          this.clearClickMoveTarget();
          return false;
        }

        this.cancelMeditation?.(this.player, 'movement');
        this.cancelPlayerEmote?.('movement');
        this.fishingSystem?.cancelForMovement?.();
        this.resourceGatheringSystem?.cancelForMovement?.();
        this.clickMovePath = path;
        this.clickMovePathIndex = 0;
        this.clickMoveTarget = {
          x: target.x,
          y: target.y,
          age: 0,
          stuck: 0,
          lastX: px,
          lastY: py,
          lastDistance: Math.hypot(target.x - px, target.y - py),
          pathRefresh: 0.45
        };
        this.clickMovePulse = 0.5;
        return true;
      }

      clearClickMoveTarget() {
        this.clickMoveTarget = null;
        this.clickMovePath = [];
        this.clickMovePathIndex = 0;
      }

      tryClickMoveStep(entity, ux, uy, step) {
        if (!entity || !Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(step) || step <= 0) return false;
        const px = Number(entity.x);
        const py = Number(entity.y);
        const nx = px + ux * step;
        const ny = py + uy * step;
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
        if (this.tryMove(entity, nx, ny)) return true;

        // Axis fallback prevents diagonal corner clipping from killing click-to-move.
        const absX = Math.abs(ux);
        const absY = Math.abs(uy);
        const firstX = absX >= absY;
        const tryAxis = axis => {
          if (axis === 'x' && absX > 0.001) return this.tryMove(entity, px + Math.sign(ux) * Math.max(0.012, step * absX), py);
          if (axis === 'y' && absY > 0.001) return this.tryMove(entity, px, py + Math.sign(uy) * Math.max(0.012, step * absY));
          return false;
        };
        return firstX ? (tryAxis('x') || tryAxis('y')) : (tryAxis('y') || tryAxis('x'));
      }

      updateClickToWalk(dt) {
        const target = this.clickMoveTarget;
        if (!target) return;
        if (!this.player?.alive || this.paused) {
          this.clearClickMoveTarget();
          return;
        }
        // V0.18.60: stop an in-progress click-move the moment the player is rooted.
        if (this.hasStatusTag?.(this.player, 'root')) { this.clearClickMoveTarget(); return; }

        dt = Math.max(0, Math.min(Number(dt) || 0, CONFIG.PLAYER_MOVE_MAX_DT || CONFIG.MAX_DT || 0.10));
        if (!dt) return;

        const px = Number(this.player.x);
        const py = Number(this.player.y);
        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
          this.clearClickMoveTarget();
          return;
        }

        target.age += dt;
        if (target.age > CLICK_WALK_MAX_SECONDS) {
          this.clearClickMoveTarget();
          return;
        }

        const finalDx = target.x - px;
        const finalDy = target.y - py;
        const finalD = Math.hypot(finalDx, finalDy);
        if (!Number.isFinite(finalD) || finalD <= CLICK_WALK_STOP_DISTANCE) {
          this.clearClickMoveTarget();
          return;
        }

        target.pathRefresh = Math.max(0, (target.pathRefresh || 0) - dt);
        if ((!Array.isArray(this.clickMovePath) || !this.clickMovePath.length || target.pathRefresh <= 0) && !this.hasLineWalkPath?.(px, py, target.x, target.y, this.player)) {
          this.clickMovePath = this.findPath?.(px, py, target.x, target.y, this.player, { maxNodes: 1200, maxRange: CLICK_WALK_MAX_RANGE + 8 }) || [];
          this.clickMovePathIndex = 0;
          target.pathRefresh = 0.65;
        }

        while (this.clickMovePath?.length && this.clickMovePathIndex < this.clickMovePath.length) {
          const wp = this.clickMovePath[this.clickMovePathIndex];
          if (Math.hypot(wp.x - px, wp.y - py) < 0.30) this.clickMovePathIndex++;
          else break;
        }

        const waypoint = (this.clickMovePath && this.clickMovePathIndex < this.clickMovePath.length)
          ? this.clickMovePath[this.clickMovePathIndex]
          : target;
        const dx = waypoint.x - px;
        const dy = waypoint.y - py;
        const d = Math.hypot(dx, dy);
        if (!Number.isFinite(d) || d <= 0.001) return;

        const moved = Math.hypot(px - target.lastX, py - target.lastY);
        const improved = target.lastDistance - finalD;
        if (moved < 0.0015 && improved < 0.0015) target.stuck += dt;
        else target.stuck = 0;
        target.lastX = px;
        target.lastY = py;
        target.lastDistance = finalD;

        if (target.stuck > CLICK_WALK_STUCK_SECONDS) {
          this.clickMovePath = this.findPath?.(px, py, target.x, target.y, this.player, { maxNodes: 1400, maxRange: CLICK_WALK_MAX_RANGE + 10 }) || [];
          this.clickMovePathIndex = 0;
          target.stuck = 0;
          if (!this.clickMovePath.length && !this.hasLineWalkPath?.(px, py, target.x, target.y, this.player)) {
            this.log?.('Path blocked.');
            this.clearClickMoveTarget();
            return;
          }
        }

        const ux = dx / d;
        const uy = dy / d;
        // V0.20.47: floor scales with the walk-speed knob too - a fixed 0.8 floor would have quietly
        // cancelled the slowdown for anyone at or below it.
        const speed = Math.max(0.8 * (Number(DR.CONFIG?.PLAYER_WALK_SPEED_SCALE) > 0 ? Number(DR.CONFIG.PLAYER_WALK_SPEED_SCALE) : 1), this.playerWalkSpeed());
        const step = Math.min(d, speed * dt);
        if (step <= 0.0001) {
          this.clearClickMoveTarget();
          return;
        }

        let movedDirect = false;
        let remainingStep = step;
        let clickGuard = 0;
        while (remainingStep > 0.0001 && clickGuard++ < 16) {
          const subStep = Math.min(remainingStep, 0.16);
          const beforeX = this.player.x;
          const beforeY = this.player.y;
          const movedSub = this.tryClickMoveStep?.(this.player, ux, uy, subStep) || false;
          if (!movedSub) break;
          movedDirect = true;
          remainingStep -= Math.max(0.001, Math.hypot(this.player.x - beforeX, this.player.y - beforeY));
          if (Math.hypot(target.x - this.player.x, target.y - this.player.y) <= CLICK_WALK_STOP_DISTANCE) break;
        }
        if (!movedDirect) {
          target.stuck += dt * 1.5;
          target.pathRefresh = 0;
          this.clickMovePath = this.findPath?.(px, py, target.x, target.y, this.player, { maxNodes: 1400, maxRange: CLICK_WALK_MAX_RANGE + 10 }) || [];
          this.clickMovePathIndex = 0;
          if (target.stuck > CLICK_WALK_STUCK_SECONDS * 1.8 && !this.clickMovePath.length) {
            this.log?.('Path blocked.');
            this.clearClickMoveTarget();
          }
          return;
        }

        this.player.setFacingFromDelta(ux, uy);
      }


      playerJump() {
        if (!this.player || !this.player.alive || this.paused) return false;
        const active = document.activeElement;
        if (active && active !== document.body && active.matches?.('input, textarea, select, [contenteditable="true"]')) return false;
        if (active && active.matches?.('button')) active.blur?.();
        if ((this.player.swimming || this.player.underwater || this.player.isUnderwater) && this.swimmingSystem) {
          this.keys?.add(' ');
          return true;
        }
        if ((this.player.z || 0) > 0.02 || (this.player.jumpCooldown || 0) > 0) return false;
        this.cancelMeditation?.(this.player, 'jump', { silent: true });
        this.cancelPlayerEmote?.('action');
        this.fishingSystem?.cancelForMovement?.();
        this.resourceGatheringSystem?.cancelForMovement?.();
        this.player.z = Math.max(0.01, this.player.z || 0);
        this.player.vz = 4.85;
        this.player.jumpCooldown = 0.42;
        this.player.jumpAnim = 0.36;
        this.player.isJumping = true;
        this.player.moveBlend = Math.max(this.player.moveBlend || 0, 0.55);
        this.spawnRing?.(this.player.x, this.player.y, '#d7f2ff', 5);
        this.broadcastLocalPeerState?.(true);
        return true;
      }

      updateCameraRotation(dt) {
        const left = this.keys.has('arrowleft');
        const right = this.keys.has('arrowright');
        const input = (left ? -1 : 0) + (right ? 1 : 0);
        const accel = 5.8;
        const maxVel = 2.65;
        const damping = 8.2;

        if (input) this.camera.yawVel += input * accel * dt;
        else this.camera.yawVel *= Math.max(0, 1 - damping * dt);

        this.camera.yawVel = clamp(this.camera.yawVel, -maxVel, maxVel);
        this.camera.yaw += this.camera.yawVel * dt;
        if (this.camera.yaw > Math.PI * 2 || this.camera.yaw < -Math.PI * 2) this.camera.yaw %= Math.PI * 2;
        // V0.20.96: settle onto one of eight authored headings once the player stops turning, so
        // per-angle art stays possible. Only applies below a velocity threshold, so rotation still
        // feels continuous while the key is held rather than notching between steps.
        this.applyCameraYawSnap?.(dt);
      }

      adjustCameraZoom(direction) {
        this.sanitizeWorldCamera?.();
        const step = clamp(CONFIG.CAMERA_ZOOM_STEP || 0.12, 0.02, 0.18);
        const dir = Number(direction) > 0 ? 1 : -1;
        const target = clamp(this.camera.targetZoom || CONFIG.CAMERA_DEFAULT_ZOOM, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        const next = dir > 0 ? target * (1 + step) : target / (1 + step);
        this.camera.targetZoom = clamp(next, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        this.camera.zoom = clamp(this.camera.zoom || this.camera.targetZoom, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
      }

      updateCameraZoom(dt) {
        this.sanitizeWorldCamera?.();
        const target = clamp(this.camera.targetZoom || CONFIG.CAMERA_DEFAULT_ZOOM, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        const safeDt = clamp(Number(dt) || 0, 0, CONFIG.MAX_DT || 0.05);
        const rate = clamp(1 - Math.exp(-(CONFIG.CAMERA_ZOOM_LERP || 12) * safeDt), 0, 1);
        this.camera.zoom = clamp(lerp(this.camera.zoom || target, target, rate), CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        this.camera.targetZoom = target;
      }




      // -------------------------------
      // Collision and movement system
      // -------------------------------
















      // -------------------------------
      // Combat and ability system
      // -------------------------------
















      // Mercenary hiring runtime moved to systems/mercenary-system.js


      // -------------------------------
      // Multiplayer and party system
      // -------------------------------
      // Multiplayer runtime moved to systems/multiplayer-system.js



      // Party runtime moved to systems/party-system.js






      // HUD/log/map/party panel toggles moved to systems/ui-system.js



// -------------------------------
      // Camera projection and renderer entry point
      // -------------------------------
      getViewportMetrics() {
        const size = this.displayTargetSize?.() || {};
        const width = Math.max(1, Number(window.innerWidth || size.targetWidth || 2560));
        const height = Math.max(1, Number(window.innerHeight || size.targetHeight || 1440));
        const metrics = this._viewportMetrics || (this._viewportMetrics = {});
        if (metrics.width !== width || metrics.height !== height) {
          metrics.width = width;
          metrics.height = height;
          metrics.halfWidth = width * 0.5;
          metrics.halfHeight = height * 0.5;
        }
        return metrics;
      }

      resolveCameraTargetWorld() {
        this.sanitizeWorldCamera?.();
        const fallbackX = Number.isFinite(Number(this.camera?.x)) ? Number(this.camera.x) : (CONFIG.START_X + 0.5);
        const fallbackY = Number.isFinite(Number(this.camera?.y)) ? Number(this.camera.y) : (CONFIG.START_Y + 0.5);
        let targetX = fallbackX;
        let targetY = fallbackY;
        if (this.player && Number.isFinite(Number(this.player.x)) && Number.isFinite(Number(this.player.y))) {
          if (!Number.isFinite(this.player.x)) this.player.x = CONFIG.START_X + 0.5;
          if (!Number.isFinite(this.player.y)) this.player.y = CONFIG.START_Y + 0.5;
          targetX = Number(this.player.x);
          targetY = Number(this.player.y);
        }
        const tile = this.tileAt?.(targetX, targetY) || { elev: 0 };
        const targetElev = Number(tile?.elev) || 0;
        if (this.camera) {
          // V0.17.19: camera.x/y are the canonical world-space pivot mirrors, not an
          // independent screen-space pan. Keeping them synced prevents old render paths
          // from rotating terrain around a different point than the player/entity path.
          this.camera.x = targetX;
          this.camera.y = targetY;
          this.camera.targetWorldX = targetX;
          this.camera.targetWorldY = targetY;
          this.camera.targetElev = targetElev;
        }
        return { x: targetX, y: targetY, elev: targetElev };
      }

      angleDeltaRad(a, b) {
        return Math.atan2(Math.sin((Number(a) || 0) - (Number(b) || 0)), Math.cos((Number(a) || 0) - (Number(b) || 0)));
      }

      getCameraProjectionCache() {
        const viewport = this.getViewportMetrics();
        const target = this.resolveCameraTargetWorld?.() || { x: 0, y: 0, elev: 0 };
        const centerX = Number(target.x) || 0;
        const centerY = Number(target.y) || 0;
        const centerElev = Number(target.elev) || 0;
        const yaw = Number(this.camera?.yaw || 0);
        const zoom = clamp(this.camera?.zoom || CONFIG.CAMERA_DEFAULT_ZOOM, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        const frameId = Number(this._worldRenderFrameId || 0) || 0;
        // V0.20.19 (Roadmap Item 20): the screen-shake accessibility gate, applied at the CONSUMER.
        //
        // Shake is written from four places - a melee swing (combat-system:1471), a crit
        // (combat-system:1667), a portal (portal-system:278) - and decayed in effects-system. Gating it
        // at each producer would be four edits, four chances to miss a fifth added later, and the
        // classic cascade-patch. This is the single line every source funnels through, so one gate
        // covers all of them and any future one for free.
        //
        // Deliberately zeroes the READ, not camera.shake itself: the sources keep incrementing it and
        // effects-system keeps decaying it exactly as before, so nothing else can notice this setting
        // exists. Turning it back on mid-session is instant, with no state to reconcile.
        const shake = (this.uiPrefs?.reduceScreenShake || this.uiPrefs?.reduceMotion) ? 0 : clamp(Number(this.camera?.shake || 0), 0, 8);
        const cache = this._cameraProjectionCache || (this._cameraProjectionCache = {});
        const changed = (
          cache.centerX !== centerX || cache.centerY !== centerY || cache.centerElev !== centerElev ||
          cache.yaw !== yaw || cache.zoom !== zoom || cache.width !== viewport.width || cache.height !== viewport.height ||
          cache.frameId !== frameId || cache.shake !== shake
        );
        if (changed) {
          cache.centerX = centerX;
          cache.centerY = centerY;
          cache.centerElev = centerElev;
          cache.pivotWorldX = centerX;
          cache.pivotWorldY = centerY;
          cache.pivotElev = centerElev;
          cache.yaw = yaw;
          cache.cos = Math.cos(yaw);
          cache.sin = Math.sin(yaw);
          cache.zoom = zoom;
          cache.invZoom = 1 / Math.max(0.0001, zoom);
          cache.width = viewport.width;
          cache.height = viewport.height;
          cache.halfWidth = viewport.halfWidth;
          cache.halfHeight = viewport.halfHeight;
          cache.tileHalfW = CONFIG.TILE_W * 0.5;
          cache.tileHalfH = CONFIG.TILE_H * 0.5;
          cache.frameId = frameId;
          cache.shake = shake;
          if (shake > 0) {
            // One shake sample per render frame. Per-call random shake distorted tile
            // corners/chunks independently and could read as ground drift during camera work.
            const t = Number(this._runtimeFrameNowMs || performance.now()) * 0.001;
            cache.shakeX = Math.sin(t * 83.17 + frameId * 0.73) * shake * 0.45;
            cache.shakeY = Math.cos(t * 71.53 + frameId * 0.61) * shake * 0.45;
          } else {
            cache.shakeX = 0;
            cache.shakeY = 0;
          }
        }
        return cache;
      }

      cameraCenter() {
        const c = this.getCameraProjectionCache();
        return { x: c.centerX, y: c.centerY, elev: c.centerElev };
      }

      cameraSpace(x, y) {
        const c = this.getCameraProjectionCache();
        const dx = Number(x || 0) - c.centerX;
        const dy = Number(y || 0) - c.centerY;
        return {
          x: dx * c.cos - dy * c.sin,
          y: dx * c.sin + dy * c.cos,
          center: { x: c.centerX, y: c.centerY, elev: c.centerElev }
        };
      }

      cameraDepth(x, y, z = 0) {
        const c = this.getCameraProjectionCache();
        const dx = Number(x || 0) - c.centerX;
        const dy = Number(y || 0) - c.centerY;
        const px = dx * c.cos - dy * c.sin;
        const py = dx * c.sin + dy * c.cos;
        return px + py + Number(z || 0) * 0.025;
      }

      projectWorldToScreenUnzoomed(x, y, z = 0, options = {}) {
        const c = this.getCameraProjectionCache();
        const dx = Number(x || 0) - c.centerX;
        const dy = Number(y || 0) - c.centerY;
        const px = dx * c.cos - dy * c.sin;
        const py = dx * c.sin + dy * c.cos;
        const sx = (px - py) * c.tileHalfW + c.halfWidth;
        const sy = (px + py) * c.tileHalfH - (Number(z || 0) - c.centerElev) * CONFIG.ELEV_STEP + c.halfHeight;
        const includeShake = options.includeShake !== false;
        return {
          x: sx + (includeShake ? Number(c.shakeX || 0) : 0),
          y: sy + (includeShake ? Number(c.shakeY || 0) : 0)
        };
      }

      worldToScreen(x, y, z = 0) {
        return this.projectWorldToScreenUnzoomed(x, y, z, { includeShake: true });
      }

      screenToWorld(sx, sy, options = {}) {
        const c = this.getCameraProjectionCache();
        const targetZ = Number.isFinite(Number(options?.z)) ? Number(options.z) : 0;
        const rawX = Number(sx || 0) - Number(c.shakeX || 0);
        const rawY = Number(sy || 0) - Number(c.shakeY || 0);
        const unzoomedX = c.halfWidth + (rawX - c.halfWidth) * c.invZoom;
        const unzoomedY = c.halfHeight + (rawY - c.halfHeight) * c.invZoom;
        const wx = unzoomedX - c.halfWidth;
        const wy = unzoomedY - c.halfHeight + (targetZ - c.centerElev) * CONFIG.ELEV_STEP;
        const u = wx / c.tileHalfW;
        const v = wy / c.tileHalfH;
        const rx = (u + v) * 0.5;
        const ry = (v - u) * 0.5;
        return {
          x: c.centerX + rx * c.cos + ry * c.sin,
          y: c.centerY - rx * c.sin + ry * c.cos
        };
      }

      cameraRotationSinglePassTerrainActive() {
        const yawVel = Math.abs(Number(this.camera?.yawVel || 0));
        const yawDelta = Math.abs(Number(this._cameraYawDeltaThisFrame || 0));
        return yawVel > 0.0008 || yawDelta > 0.0008;
      }

      beginWorldCameraTransform() {
        this.sanitizeWorldCamera?.();
        const projection = this.getCameraProjectionCache();
        ctx.save();
        ctx.translate(projection.halfWidth, projection.halfHeight);
        ctx.scale(projection.zoom, projection.zoom);
        ctx.translate(-projection.halfWidth, -projection.halfHeight);
      }

      endWorldCameraTransform() {
        try { ctx.restore(); }
        finally { this.resetCanvasTransform?.(); }
      }


      isRenderableWorldGrid(grid = this.map) {
        const minSize = CONFIG.MAP_SIZE || 200;
        if (!Array.isArray(grid) || grid.length < minSize) return false;
        const size = grid.length;
        const sampleRows = [0, Math.floor(size / 2), size - 1];
        for (const y of sampleRows) {
          if (!Array.isArray(grid[y]) || grid[y].length < minSize) return false;
        }
        const px = this.player ? Math.max(0, Math.min(size - 1, Math.floor(this.player.x))) : Math.floor(size / 2);
        const py = this.player ? Math.max(0, Math.min(size - 1, Math.floor(this.player.y))) : Math.floor(size / 2);
        const tile = grid[py]?.[px] || grid[Math.floor(size / 2)]?.[Math.floor(size / 2)];
        return Boolean(tile && typeof tile === 'object' && Number.isFinite(Number(tile.type)) && Number.isFinite(Number(tile.elev)));
      }

      recoverRenderableWorld(reason = 'invalid active map') {
        if (this.worldRenderRecoveryInProgress) return false;
        this.worldRenderRecoveryInProgress = true;
        try {
          const savedSuppressSavedWorldLoad = this.suppressSavedWorldLoad;
          this.suppressSavedWorldLoad = true;
          this.generateDefaultWorld();
          this.suppressSavedWorldLoad = savedSuppressSavedWorldLoad;
          if (typeof this.rebuildWorldRuntimeAfterWorldLoad === 'function') this.rebuildWorldRuntimeAfterWorldLoad();
          else {
            this.currentZone = 'overworld';
            this.map = this.overworldMap || this.map;
            this.objects = this.overworldObjects || this.objects;
          }
          if (this.player) {
            this.player.x = CONFIG.START_X + 0.5;
            this.player.y = CONFIG.START_Y + 0.5;
          }
          this.log?.(`Recovered world renderer from ${reason}. Default Dark Woods restored.`);
          return true;
        } finally {
          this.worldRenderRecoveryInProgress = false;
        }
      }

      drawRenderFailureOverlay(message) {
        ctx.save();
        this.resetCanvasTransform?.();
        ctx.fillStyle = 'rgba(8, 4, 4, 0.90)';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.fillStyle = '#ffcc88';
        ctx.font = '18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Blackroot render recovery failed', 32, 46);
        ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.fillStyle = '#f2dfbd';
        ctx.fillText(String(message || 'Unknown render error'), 32, 78);
        ctx.restore();
      }

      render() {
        // V0.17.19: all projection users in this frame share one explicit render-frame
        // key and one yaw delta. Terrain, entities, VFX, and targeting now agree on the
        // same player/world pivot while the camera rotates.
        this._worldRenderFrameId = ((Number(this._worldRenderFrameId || 0) + 1) >>> 0) || 1;
        const renderYaw = Number(this.camera?.yaw || 0);
        const previousRenderYaw = Number.isFinite(Number(this._cameraLastRenderYaw)) ? Number(this._cameraLastRenderYaw) : renderYaw;
        this._cameraYawDeltaThisFrame = this.angleDeltaRad ? this.angleDeltaRad(renderYaw, previousRenderYaw) : Math.atan2(Math.sin(renderYaw - previousRenderYaw), Math.cos(renderYaw - previousRenderYaw));
        this._cameraLastRenderYaw = renderYaw;
        this._cameraProjectionCache = null;
        if (this.perfStats) {
          this.perfStats.entitiesDrawn = 0;
          this.perfStats.terrainChunksDrawn = 0;
          this.perfStats.tilesQueued = 0;
          this.perfStats.objectsQueued = 0;
          this.perfStats.effectsQueued = 0;
          this.perfStats.damageTextQueued = 0;
          this.perfStats.worldRenderables = 0;
          this.perfStats.terrainSurfacesDrawn = 0;
          this.perfStats.terrainWaterSurfacesDrawn = 0;
          this.perfStats.terrainShoreSurfacesDrawn = 0;
          this.perfStats.terrainChunkCacheEntries = this.terrainChunkCache?.chunks?.size || 0;
          this.perfStats.terrainChunkBuilds = this.terrainChunkCache?.builds || 0;
          this.perfStats.terrainChunkCacheInvalidations = this.terrainChunkCache?.invalidations || 0;
          this.perfStats.terrainChunksConsidered = 0;
          this.perfStats.terrainChunksCulled = 0;
          this.perfStats.objectChunkCacheEntries = this.objectChunkIndex?.chunks?.size || 0;
          this.perfStats.objectChunksVisited = 0;
          this.perfStats.objectIndexObjects = this.objectChunkIndex?.objectCount || 0;
          this.perfStats.objectsCulled = 0;
          this.perfStats.renderQueueBuildMs = 0;
          this.perfStats.renderQueueSortMs = 0;
          this.perfStats.terrainRenderQueueSortMs = 0;
          this.perfStats.worldRenderQueueSortMs = 0;
          this.perfStats.entityScreenCulled = 0;
          this.perfStats.entityTileCulled = 0;
          this.perfStats.effectScreenCulled = 0;
          this.perfStats.effectTileCulled = 0;
          this.perfStats.damageScreenCulled = 0;
          this.perfStats.damageTileCulled = 0;
          const backendCaps = this.detectRenderBackendCapabilities?.() || this.renderBackendCaps || {};
          this.perfStats.renderBackendWebgl = !!backendCaps.webgl;
          this.perfStats.renderBackendWebgl2 = !!backendCaps.webgl2;
          this.perfStats.renderBackendBitmapRenderer = !!backendCaps.bitmapRenderer;
          this.perfStats.renderBackendOffscreenCanvas = !!backendCaps.offscreenCanvas;
          this.perfStats.renderBackendTerrainBatchPrepared = 0;
          this.perfStats.renderBackendWorldBatchPrepared = 0;
          this.perfStats.renderBackendObjectBatchPrepared = 0;
          this.perfStats.renderBackendEntityBatchPrepared = 0;
          this.perfStats.renderBackendEffectBatchPrepared = 0;
          this.perfStats.renderBackendDamageBatchPrepared = 0;
          this.perfStats.renderBackendBatchOverflow = 0;
          this.perfStats.renderBackendBatchBuildMs = 0;
          this.perfStats.renderBackendBatchDrawablePct = 0;
          const adaptive = this.adaptivePerformance?.snapshotStats?.() || null;
          if (adaptive) {
            this.perfStats.adaptiveEnabled = !!adaptive.enabled;
            this.perfStats.adaptiveLevel = adaptive.level ?? 0;
            this.perfStats.adaptiveLevelName = adaptive.levelName || 'off';
            this.perfStats.adaptiveFrameMsEma = adaptive.frameMsEma || 0;
            this.perfStats.adaptiveRenderMsEma = adaptive.renderMsEma || 0;
            this.perfStats.adaptiveUpdateMsEma = adaptive.updateMsEma || 0;
            this.perfStats.adaptiveDownshifts = adaptive.downshifts || 0;
            this.perfStats.adaptiveUpshifts = adaptive.upshifts || 0;
            this.perfStats.adaptiveLastChangeReason = adaptive.lastChangeReason || '';
          }
        }
        this.resetCanvasTransform?.();
        // V0.16.31: gameplay rendering must never inherit modal/menu canvas state.
        // Reset the mutable drawing state before world composition.
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        try { ctx.filter = 'none'; } catch (_err) {}
        this.sanitizeWorldCamera?.();
        const viewport = this.getViewportMetrics();
        const projection = this.getCameraProjectionCache();
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        if (!this.drawWorldSky?.(ctx)) {
          const sky = ctx.createLinearGradient(0, 0, 0, viewport.height);
          sky.addColorStop(0, '#1f382b');
          sky.addColorStop(0.42, '#142719');
          sky.addColorStop(1, '#07100a');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, viewport.width, viewport.height);
        }

        if (this.shouldDrawExpensiveWorldEffect?.('weatherSkyOverlay') !== false) this.renderWeatherSkyOverlay?.(ctx);
        this.drawDistantCanopy();

        if (!this.player) {
          this.renderAmbientOnly();
          return;
        }

        if (!this.isRenderableWorldGrid(this.map)) {
          if (!this.recoverRenderableWorld('invalid or incomplete active world grid')) {
            this.drawRenderFailureOverlay('Active world grid is invalid or incomplete.');
            return;
          }
        }

        const px = Math.floor(this.player.x);
        const py = Math.floor(this.player.y);
        const renderPad = this.worldRenderPadTiles?.() || Math.ceil(CONFIG.RENDER_PAD / clamp(this.camera.zoom || 1, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM)) + 4;
        const renderBoundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        const minX = clamp(px - renderPad, 0, renderBoundsSize - 1);
        const maxX = clamp(px + renderPad, 0, renderBoundsSize - 1);
        const minY = clamp(py - renderPad, 0, renderBoundsSize - 1);
        const maxY = clamp(py + renderPad, 0, renderBoundsSize - 1);

        const scratch = this.renderScratch || (this.renderScratch = { tileRenderables: [], terrainDepthRenderables: [], waterDepthRenderables: [], worldRenderables: [], renderItemPool: [] });
        const tileRenderables = scratch.tileRenderables; tileRenderables.length = 0;
        const terrainDepthRenderables = scratch.terrainDepthRenderables; terrainDepthRenderables.length = 0;
        const waterDepthRenderables = scratch.waterDepthRenderables; waterDepthRenderables.length = 0;
        const worldRenderables = scratch.worldRenderables; worldRenderables.length = 0;
        const renderItemPool = scratch.renderItemPool || (scratch.renderItemPool = []);
        let renderItemPoolIndex = 0;
        const makeRenderable = kind => {
          const item = renderItemPool[renderItemPoolIndex] || (renderItemPool[renderItemPoolIndex] = {});
          renderItemPoolIndex++;
          item.kind = kind;
          item.depth = 0;
          item.x = 0;
          item.y = 0;
          item.tile = null;
          item.obj = null;
          item.elev = 0;
          item.entity = null;
          item.effect = null;
          item.damage = null;
          item.layer = null;
          return item;
        };
        const terrainChunkSurfaceAvailable = this.terrainChunkRenderingAvailable?.() === true;
        const zoom = projection.zoom || clamp(this.camera.zoom || 1, CONFIG.CAMERA_MIN_ZOOM, CONFIG.CAMERA_MAX_ZOOM);
        const perfSettings = this.performanceSettings?.() || {};
        const configuredCullPad = Number(perfSettings.viewportCullPadPx || 760);
        const cullPad = Math.max(520, configuredCullPad) / zoom;
        const viewportMaxX = viewport.width + cullPad;
        const viewportMaxY = viewport.height + cullPad;
        const projCenterX = projection.centerX;
        const projCenterY = projection.centerY;
        const projCenterElev = projection.centerElev;
        const projCos = projection.cos;
        const projSin = projection.sin;
        const projTileHalfW = projection.tileHalfW;
        const projTileHalfH = projection.tileHalfH;
        const projHalfWidth = projection.halfWidth;
        const projHalfHeight = projection.halfHeight;
        const depthFast = (wx, wy, wz = 0) => {
          const dx = wx - projCenterX;
          const dy = wy - projCenterY;
          return (dx * projCos - dy * projSin) + (dx * projSin + dy * projCos) + wz * 0.025;
        };
        const projectScreenFast = (wx, wy, wz = 0) => {
          const dx = wx - projCenterX;
          const dy = wy - projCenterY;
          const px = dx * projCos - dy * projSin;
          const py = dx * projSin + dy * projCos;
          return {
            x: (px - py) * projTileHalfW + projHalfWidth,
            y: (px + py) * projTileHalfH - ((wz || 0) - projCenterElev) * CONFIG.ELEV_STEP + projHalfHeight
          };
        };
        const insideScreenFast = (wx, wy, wz = 0, pad = cullPad) => {
          const s = projectScreenFast(wx, wy, wz);
          return s.x >= -pad && s.y >= -pad && s.x <= viewport.width + pad && s.y <= viewport.height + pad;
        };
        const queueBuildStart = performance.now();
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const tile = this.map[y][x];
            const dxScreen = x - projCenterX;
            const dyScreen = y - projCenterY;
            const pxScreen = dxScreen * projCos - dyScreen * projSin;
            const pyScreen = dxScreen * projSin + dyScreen * projCos;
            const sx = (pxScreen - pyScreen) * projTileHalfW + projHalfWidth;
            const sy = (pxScreen + pyScreen) * projTileHalfH - ((tile.elev || 0) - projCenterElev) * CONFIG.ELEV_STEP + projHalfHeight;
            if (sx < -cullPad || sy < -cullPad || sx > viewportMaxX || sy > viewportMaxY) continue;
            const depthDx = x + 0.5 - projCenterX;
            const depthDy = y + 0.5 - projCenterY;
            const tileDepth = (depthDx * projCos - depthDy * projSin) + (depthDx * projSin + depthDy * projCos) + (tile.elev || 0) * 0.025;
            const tileBias = tile.type === TILE.CAVE_WALL ? 0.18 : -2.2;
            if (this.terrainTileNeedsStructuralPass?.(x, y, tile) !== false) {
              if (terrainChunkSurfaceAvailable && this.isTerrainChunkWaterTile?.(tile)) {
                const item = makeRenderable('waterDepth');
                item.depth = tileDepth + tileBias; item.x = x; item.y = y; item.tile = tile;
                waterDepthRenderables.push(item);
              } else if (terrainChunkSurfaceAvailable && this.isTerrainChunkGroundTile?.(tile)) {
                const item = makeRenderable('terrainDepth');
                item.depth = tileDepth + tileBias; item.x = x; item.y = y; item.tile = tile;
                terrainDepthRenderables.push(item);
              } else {
                const item = makeRenderable('tile');
                item.depth = tileDepth + tileBias; item.x = x; item.y = y; item.tile = tile;
                tileRenderables.push(item);
              }
            }
            if (tile.type === TILE.CAVE_WALL && typeof this.drawCaveWallDepthOccluder === 'function') {
              const item = makeRenderable('caveOccluder');
              item.depth = typeof this.caveWallOcclusionDepth === 'function' ? this.caveWallOcclusionDepth(x, y, tile) : tileDepth + 1.08;
              item.x = x; item.y = y; item.tile = tile;
              worldRenderables.push(item);
            }
            // V0.15.08: object/prop renderables are collected from a chunk index after the
            // terrain scan. That avoids touching every object-grid cell every frame.
          }
        }

        const objectEntries = this.collectObjectChunkEntries?.(minX, maxX, minY, maxY) || [];
        const objectCullPad = Math.max(cullPad, Math.max(520, Number(perfSettings.objectCullPadPx || 920)) / zoom);
        const objectCullPadTop = Math.max(120, Number(perfSettings.objectCullPadTopPx || 160)) / zoom;
        const objectViewportMaxX = viewport.width + objectCullPad;
        const objectViewportMaxY = viewport.height + objectCullPad;
        let objectsCulled = 0;
        for (const entry of objectEntries) {
          const x = entry.x;
          const y = entry.y;
          const obj = entry.obj;
          if (!obj) continue;
          const tile = this.map?.[y]?.[x];
          const elev = Number(entry.elev ?? tile?.elev) || 0;
          const dxScreen = x - projCenterX;
          const dyScreen = y - projCenterY;
          const pxScreen = dxScreen * projCos - dyScreen * projSin;
          const pyScreen = dxScreen * projSin + dyScreen * projCos;
          const sx = (pxScreen - pyScreen) * projTileHalfW + projHalfWidth;
          const sy = (pxScreen + pyScreen) * projTileHalfH - (elev - projCenterElev) * CONFIG.ELEV_STEP + projHalfHeight;
          // V0.20.61: the vertical pad must be ASYMMETRIC. Props are drawn UPWARD from their ground
          // anchor, so a prop anchored above the top edge is entirely off screen, while one anchored
          // below the bottom edge can still show its crown - a tall tree needs the full 920px there.
          // Using the generous pad on both sides kept a measured 68 of 151 props alive at screen-y
          // -350 to -411, all of them invisible. The top pad only has to cover the small amount a prop
          // draws BELOW its anchor (contact shadow / base), which is well under 160px.
          if (sx < -objectCullPad || sy < -objectCullPadTop || sx > objectViewportMaxX || sy > objectViewportMaxY) {
            objectsCulled += 1;
            continue;
          }
          const depthDx = x + 0.5 - projCenterX;
          const depthDy = y + 0.5 - projCenterY;
          const tileDepth = (depthDx * projCos - depthDy * projSin) + (depthDx * projSin + depthDy * projCos) + elev * 0.025;
          const item = makeRenderable('object');
          item.depth = tileDepth + 0.72; item.x = x; item.y = y; item.obj = obj; item.elev = elev;
          worldRenderables.push(item);
        }
        if (this.perfStats) this.perfStats.objectsCulled = objectsCulled;

        const strictEntityScreenCull = perfSettings.enableStrictEntityScreenCulling !== false;
        const entityCullPad = Math.max(cullPad, Math.max(520, Number(perfSettings.entityCullPadPx || 960)) / zoom);
        const effectCullPad = Math.max(cullPad, Math.max(360, Number(perfSettings.effectCullPadPx || 720)) / zoom);
        const damageCullPad = Math.max(cullPad, Math.max(280, Number(perfSettings.damageTextCullPadPx || 520)) / zoom);
        let entityTileCulled = 0;
        let entityScreenCulled = 0;
        let effectTileCulled = 0;
        let effectScreenCulled = 0;
        let damageTileCulled = 0;
        let damageScreenCulled = 0;
        for (const e of this.entities) {
          if (!e) continue;
          if ((e.kind === 'remote' || e.kind === 'bot') && e.zone !== this.currentZone) continue;
          // V0.20.62: off-shift bots are "asleep in their tent" like off-shift NPCs - not drawn, and
          // skipped by AI in updateBotShifts. Gated here in the render-queue build so the cost is
          // avoided at queue time, matching how objects and NPCs are handled.
          if (e._offShift) continue;
          if (e.x < minX - 2 || e.x > maxX + 2 || e.y < minY - 2 || e.y > maxY + 2) {
            entityTileCulled += 1;
            continue;
          }
          const et = this.map?.[Math.floor(e.y)]?.[Math.floor(e.x)];
          const elev = Number(et?.elev) || 0;
          if (strictEntityScreenCull && e !== this.player && !insideScreenFast(e.x, e.y, elev, entityCullPad)) {
            entityScreenCulled += 1;
            continue;
          }
          const item = makeRenderable('entity');
          // V0.18.36: the player wins same-tile depth ties so companions/mercs/NPCs
          // standing on (or fractionally in front of) the player don't paint over it.
          // The nudge (~0.05) is a small fraction of a tile's depth step, so an actor
          // clearly in front of the player still occludes it - "the player is behind
          // them" reads correctly - it only breaks true ties and hair's-breadth overlaps.
          item.depth = depthFast(e.x, e.y, elev) + 0.95 + (e === this.player ? 0.05 : 0);
          item.entity = e;
          worldRenderables.push(item);
        }
        for (const ef of this.effects) {
          if (!ef || ef.x < minX - 3 || ef.x > maxX + 3 || ef.y < minY - 3 || ef.y > maxY + 3) {
            effectTileCulled += 1;
            continue;
          }
          const et = this.map?.[Math.floor(ef.y)]?.[Math.floor(ef.x)];
          const elev = Number(et?.elev) || 0;
          if (strictEntityScreenCull && !insideScreenFast(ef.x, ef.y, elev, effectCullPad)) {
            effectScreenCulled += 1;
            continue;
          }
          if (ef.type === 'rotlingRootEntangle') {
            // V0.17.25 root-cause fix: entities queue at depthFast(...) + 0.95
            // (see the entity loop above). The whole root effect used to queue
            // at a single bias of 0.86 - always LESS than the entity's, so the
            // entangled target's own sprite always drew on top of and hid it.
            // Split into two depth-biased passes so only the ground-crack base
            // stays behind the target (like a normal ground decal) while the
            // ankle-wrapping tendrils queue above the entity bias and are
            // guaranteed to render in front of the lower legs/feet.
            const base = makeRenderable('effect');
            base.depth = depthFast(ef.x, ef.y, elev) + 0.86;
            base.effect = ef;
            base.layer = 'base';
            worldRenderables.push(base);
            const wrap = makeRenderable('effect');
            wrap.depth = depthFast(ef.x, ef.y, elev) + 1.02;
            wrap.effect = ef;
            wrap.layer = 'wrap';
            worldRenderables.push(wrap);
            continue;
          }
          const effectDepthBias = ef.type === 'terrainStep' ? 0.50 : 1.1;
          const item = makeRenderable('effect');
          item.depth = depthFast(ef.x, ef.y, elev) + effectDepthBias;
          item.effect = ef;
          worldRenderables.push(item);
        }
        for (const d of this.damageText) {
          if (!d || d.x < minX - 3 || d.x > maxX + 3 || d.y < minY - 3 || d.y > maxY + 3) {
            damageTileCulled += 1;
            continue;
          }
          const dtile = this.map?.[Math.floor(d.y)]?.[Math.floor(d.x)];
          const elev = Number(dtile?.elev) || 0;
          if (strictEntityScreenCull && !insideScreenFast(d.x, d.y, elev, damageCullPad)) {
            damageScreenCulled += 1;
            continue;
          }
          const item = makeRenderable('damage');
          item.depth = depthFast(d.x, d.y, elev) + 1.4;
          item.damage = d;
          worldRenderables.push(item);
        }
        if (this.perfStats) {
          this.perfStats.entityTileCulled = entityTileCulled;
          this.perfStats.entityScreenCulled = entityScreenCulled;
          this.perfStats.effectTileCulled = effectTileCulled;
          this.perfStats.effectScreenCulled = effectScreenCulled;
          this.perfStats.damageTileCulled = damageTileCulled;
          this.perfStats.damageScreenCulled = damageScreenCulled;
          this.perfStats.renderQueueBuildMs = performance.now() - queueBuildStart;
        }

        // V0.18.62: caveOccluder ranks BELOW entity (was 2.35, above entity) so that when a cave
        // wall's depth-sort anchor exactly ties an actor's depth, the ACTOR wins the tie and draws
        // on top - walls/corners no longer paint over players/mercs/pets/mobs hugging a wall's front
        // face. Depth still dominates: an actor genuinely behind a wall (lower depth) is still
        // occluded; only exact/hair's-breadth ties flip to the actor. Occluder still ranks above
        // objects/terrain so it keeps covering props and ground that sit behind the wall.
        const drawOrder = { tile: 0, object: 1, terrainStep: 1.5, caveOccluder: 1.9, entity: 2, effect: 3, damage: 4 };
        const sortStart = performance.now();
        waterDepthRenderables.sort((a, b) => a.depth - b.depth);
        terrainDepthRenderables.sort((a, b) => a.depth - b.depth);
        tileRenderables.sort((a, b) => a.depth - b.depth);
        const worldSortStart = performance.now();
        worldRenderables.sort((a, b) => {
          const ak = a.kind === 'effect' && a.effect?.type === 'terrainStep' ? 'terrainStep' : a.kind;
          const bk = b.kind === 'effect' && b.effect?.type === 'terrainStep' ? 'terrainStep' : b.kind;
          return (a.depth - b.depth) || ((drawOrder[ak] ?? 0) - (drawOrder[bk] ?? 0));
        });
        if (this.perfStats) {
          const sortEnd = performance.now();
          this.perfStats.renderQueueSortMs = sortEnd - sortStart;
          this.perfStats.terrainRenderQueueSortMs = worldSortStart - sortStart;
          this.perfStats.worldRenderQueueSortMs = sortEnd - worldSortStart;
        }
        if (this.perfStats) {
          this.perfStats.tilesQueued = tileRenderables.length + terrainDepthRenderables.length + waterDepthRenderables.length;
          let objectsQueued = 0;
          let entitiesQueued = 0;
          let effectsQueued = 0;
          let damageQueued = 0;
          for (const r of worldRenderables) {
            if (r.kind === 'object') objectsQueued += 1;
            else if (r.kind === 'entity') entitiesQueued += 1;
            else if (r.kind === 'effect') effectsQueued += 1;
            else if (r.kind === 'damage') damageQueued += 1;
          }
          this.perfStats.objectsQueued = objectsQueued;
          this.perfStats.entitiesDrawn = entitiesQueued;
          this.perfStats.effectsQueued = effectsQueued;
          this.perfStats.damageTextQueued = damageQueued;
          this.perfStats.worldRenderables = worldRenderables.length;
        }
        this.prepareHybridRenderBatch?.({
          worldRenderables,
          tileRenderables,
          terrainDepthRenderables,
          waterDepthRenderables,
          minX, maxX, minY, maxY,
          viewport,
          projection
        });
        scratch.renderItemPoolUsed = renderItemPoolIndex;
        const renderPoolLimit = Math.max(1024, Math.floor(Number((perfSettings || {}).renderItemPoolMaxEntries || DR.CONFIG?.PERFORMANCE?.renderItemPoolMaxEntries || 9000) || 9000));
        if ((perfSettings || {}).enableRenderItemPoolTrim !== false && renderItemPool.length > renderPoolLimit) {
          renderItemPool.length = renderPoolLimit;
          const memStats = this.ensureRuntimeMemoryStats?.();
          if (memStats) memStats.poolTrims += 1;
        }
        if (this.perfStats) {
          this.perfStats.renderItemPoolUsed = renderItemPoolIndex;
          this.perfStats.renderItemPoolSize = renderItemPool.length;
        }

        if (typeof this.drawTile !== 'function' || typeof this.drawObject !== 'function' || typeof this.drawEntity !== 'function') {
          this.drawRenderFailureOverlay('A required renderer module did not load. Keep the extracted render/ folder beside the HTML.');
          return;
        }
        // V0.18.63: mark the cave walls that would cover a friendly actor so their occluder
        // redraw is skipped below (drawCaveWallDepthOccluder reads this) - walls stop rendering
        // over the player/mercs/pets/bots at any camera angle.
        this._caveWallCutaways = this.computeCaveWallCutaways?.() || null;
        // V0.18.64: reset the per-frame light list. Light-emitting props (torches) push their
        // unzoomed screen position here as they draw; renderSilkCavernAtmosphere then projects
        // real warm light from each one through the cave darkness after the world is drawn.
        if (!this._silkFrameLights) this._silkFrameLights = [];
        this._silkFrameLights.length = 0;
        this.beginWorldCameraTransform();
        this._botSpeechBubblePlacements = [];
        this._nameplatePlacements = [];
        try {
          this._waterDepthFacesDrawn = 0;
          this._terrainRenderPhase = 'water-depth';
          for (const r of waterDepthRenderables) this.drawWaterDepthLayer(r.x, r.y, r.tile);
          this._terrainGroundCacheActive = terrainDepthRenderables.length > 0;
          this._terrainWaterCacheActive = true;
          // V0.21.17: drawTerrainChunks needs these to emit wall faces per band.
          this._terrainBandRenderables = terrainDepthRenderables;
          this._terrainStructuralPassMode = 'depth-underlay';
          this._terrainRenderPhase = 'terrain-depth-underlay';
          for (const r of terrainDepthRenderables) this.drawTile(r.x, r.y, r.tile);
          this._terrainStructuralPassMode = 'full';
          this._terrainRenderPhase = 'terrain-surfaces';
          const terrainCacheActive = this.drawTerrainChunks?.(minX, maxX, minY, maxY) === true;
          this._terrainGroundCacheActive = terrainCacheActive;
          this._terrainWaterCacheActive = terrainCacheActive;
          // V0.21.17: the occlusion-cap pass NO LONGER RUNS HERE. Wall faces are now drawn INSIDE
          // the band composite - after each elevation band's ground, before the band above - by
          // drawTerrainChunks calling back into drawTerrainBandWalls. Running it here, after every
          // band, is what let a band-1 wall paint over band-2 ground: the walls were not part of the
          // stack at all. See render/terrain-renderer.js.
          if (terrainCacheActive && terrainDepthRenderables.length) {
            // handled per-band inside drawTerrainChunks
          } else if (!terrainCacheActive && terrainDepthRenderables.length) {
            this._terrainGroundCacheActive = false;
            this._terrainWaterCacheActive = false;
            this._terrainStructuralPassMode = 'full';
            this._terrainRenderPhase = 'structural-terrain-fallback';
            for (const r of terrainDepthRenderables) this.drawTile(r.x, r.y, r.tile);
          }
          this._terrainStructuralPassMode = 'full';
          this._terrainRenderPhase = 'structural-terrain';
          for (const r of tileRenderables) this.drawTile(r.x, r.y, r.tile);
          this._terrainGroundCacheActive = false;
          this._terrainWaterCacheActive = false;
          this._terrainStructuralPassMode = 'full';
          // V0.18.40: draw the Silk Web Cavern floor webbing over the (chunk-cached)
          // terrain here - the per-tile drawTile hook is skipped for chunked ground tiles,
          // so this overlay is what actually makes the floor read as webbed.
          this.renderSilkWebFloorOverlay?.(minX, maxX, minY, maxY);
          // Live pass: raised water spilling over an elevation drop. Must not be baked into the
          // terrain chunk cache, because falling water animates.
          // Drifting surface flow on open water; the baked shimmer only pulses its alpha, so
          // without this nothing on the water actually travels.
          this.renderWaterFlow?.(minX, maxX, minY, maxY);
          this.renderWaterfalls?.(minX, maxX, minY, maxY);
          this.renderSilkCritters?.(); // V0.18.49: decorative free-roaming floor spiders
          this.layeredMapEditor?.renderUnderEntities?.(ctx);
          // V0.18.34: resource nodes (herbs/ore/roots) draw as a GROUND layer here, beneath the
          // depth-sorted entity/object pass, instead of as a post-world overlay that painted them
          // on top of players/bots/mobs/pets.
          this.resourceGatheringSystem?.renderGroundLayer?.(ctx);
          const hybridBackend = this.ensureRenderBackendSystem?.();
          try { hybridBackend?.beginHybridVisibleFrame?.(ctx); } catch (_err) {}
          const flushVisibleWebglLayers = (reason = 'boundary') => {
            try {
              if (hybridBackend?.flushHybridVisibleQueues) return hybridBackend.flushHybridVisibleQueues(ctx, reason);
              this.flushWebglVisibleSpriteLayer?.(ctx);
              this.flushWebglVisibleEffectLayer?.(ctx);
              this.flushWebglVisibleDamageTextLayer?.(ctx);
            } catch (_err) {}
            return false;
          };
          const queueHybridVisibleRenderable = (renderable) => {
            try {
              if (hybridBackend?.queueHybridVisibleRenderable) return hybridBackend.queueHybridVisibleRenderable(renderable, ctx) === true;
              if (renderable?.kind === 'entity') return this.tryQueueWebglVisibleSpriteRenderable?.(renderable) === true;
              if (renderable?.kind === 'effect') return this.tryQueueWebglVisibleEffectRenderable?.(renderable) === true;
              if (renderable?.kind === 'damage') return this.tryQueueWebglVisibleDamageTextRenderable?.(renderable) === true;
            } catch (_err) {}
            return false;
          };
          for (const r of worldRenderables) {
            try {
              if (r.kind === 'entity') {
                if (queueHybridVisibleRenderable(r)) continue;
                this.drawEntity(r.entity);
              } else if (r.kind === 'effect') {
                if (queueHybridVisibleRenderable(r)) continue;
                this.drawEffect(r.effect, r.layer);
              } else if (r.kind === 'damage') {
                if (queueHybridVisibleRenderable(r)) continue;
                this.drawDamage(r.damage);
              } else {
                flushVisibleWebglLayers(`canvas-${r.kind || 'renderable'}`);
                if (r.kind === 'object') this.drawObject(r.x, r.y, r.obj, r.elev);
                else if (r.kind === 'caveOccluder') this.drawCaveWallDepthOccluder(r.x, r.y, r.tile);

              }
            } catch (err) {
              flushVisibleWebglLayers(`exception-${r.kind || 'renderable'}`);
              this.recordRuntimeSystemFault({ id: `world-${r.kind || 'renderable'}` }, 'render', err);
            }
          }
          try {
            if (hybridBackend?.endHybridVisibleFrame) hybridBackend.endHybridVisibleFrame(ctx);
            else flushVisibleWebglLayers('end-frame');
          } catch (_err) {
            flushVisibleWebglLayers('end-frame-fallback');
          }
          this.renderPortalRuntime?.(ctx);
          this.layeredMapEditor?.renderFringe?.(ctx);
          this.renderExternalSystems(ctx);
          this.layeredMapEditor?.renderOverlays?.(ctx);
          this.renderDarkWoodsAtmosphere?.(ctx);
          this.renderAmbientCreatureLayer?.(ctx);
          this.drawClickMoveMarker();
        } finally {
          this._terrainGroundCacheActive = false;
          this._terrainWaterCacheActive = false;
          this._terrainRenderPhase = null;
          this.endWorldCameraTransform();
        }

        // V0.14.26: removed the legacy screen-space depth-fog oval overlay; it drifted independently of world geometry and read as random floating shapes.
        // V0.15.52: weather is a screen-space atmospheric layer; draw it after
        // the world camera transform is closed so rain/fog/snow/dust remain visible.
        this.renderWeatherWorld?.(ctx);
        if (this.shouldDrawExpensiveWorldEffect?.('sunShafts') !== false) this.drawSunShafts();
        if (this.shouldDrawExpensiveWorldEffect?.('dustMotes') !== false) this.drawWorldDustMotes?.();
        if (this.shouldDrawExpensiveWorldEffect?.('weatherForeground') !== false) this.renderWeatherForeground?.(ctx);
        this.drawWorldLightOverlay?.(ctx);
        this.renderWeatherFlash?.(ctx);
        this.renderSilkCavernAtmosphere?.(ctx); // V0.18.59: night darkening + rolling ground fog in the silk cavern
        this.drawVignette();
      }

      drawClickMoveMarker() {
        if (!this.clickMoveTarget || !this.player?.alive) return;
        const target = this.clickMoveTarget;
        if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
        const tile = this.tileAt(target.x, target.y);
        const s = this.worldToScreen(target.x, target.y, tile.elev + 0.03);
        const t = performance.now() * 0.006;
        const r = 12 + Math.sin(t) * 2;
        ctx.save();
        ctx.globalAlpha = 0.86;
        ctx.strokeStyle = '#9ee7ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 4, r * 1.45, r * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#6ecaff';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 4, r * 1.15, r * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      renderAmbientOnly() {
        const t = performance.now() * 0.001;
        ctx.fillStyle = '#07100c';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        for (let i = 0; i < 50; i++) {
          const x = (Math.sin(i * 77.1 + t * 0.12) * 0.5 + 0.5) * window.innerWidth;
          const y = (Math.cos(i * 42.7 + t * 0.08) * 0.5 + 0.5) * window.innerHeight;
          ctx.fillStyle = 'rgba(135, 174, 115, 0.04)';
          ctx.fillRect(x | 0, y | 0, 2, 2);
        }
      }

      drawDistantCanopy() {
        const t = performance.now() * 0.00008;
        const light = this.getWorldLightState?.() || null;
        const alpha = light?.canopyAlpha ?? 0.34;
        const far = light?.canopyFar || '#18321f';
        const near = light?.canopyNear || '#1d3d27';
        ctx.save();
        ctx.globalAlpha = alpha;
        for (let row = 0; row < 4; row++) {
          const y = 70 + row * 42;
          const scale = 0.72 + row * 0.18;
          const offset = ((t * 900 + row * 143) % 180) - 90;
          for (let i = -2; i < Math.ceil(window.innerWidth / 110) + 3; i++) {
            const x = i * 110 + offset * (0.3 + row * 0.12);
            ctx.fillStyle = row % 2 ? far : near;
            this.fillPoly([
              { x: x - 46 * scale, y: y + 22 * scale },
              { x: x - 22 * scale, y: y - 30 * scale },
              { x: x + 4 * scale, y: y + 3 * scale },
              { x: x + 33 * scale, y: y - 36 * scale },
              { x: x + 62 * scale, y: y + 22 * scale }
            ]);
          }
        }
        ctx.restore();
      }

      drawSunShafts() {
        const light = this.getWorldLightState?.() || null;
        const shaftStrength = light?.sunShaftAlpha ?? 1;
        if (shaftStrength <= 0.015) return;
        const time = performance.now() * 0.001;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const drift = Math.sin(time * 0.25) * 42;
        const tint = light?.sunShaftTint || '#ede0a7';
        const warmMid = light?.phaseKey === 'dusk' ? 'rgba(214,142,96,0.28)' : (light?.phaseKey === 'dawn' ? 'rgba(236,186,118,0.30)' : 'rgba(206,196,138,0.26)');
        for (let i = 0; i < 5; i++) {
          const hash = this.hash2D?.(i, 77, 9110) ?? ((i * 0.173) % 1);
          const width = 72 + hash * 58;
          const opacity = (0.035 + hash * 0.032 + Math.sin(time * 0.7 + i) * 0.006) * shaftStrength;
          const x = 40 + i * 245 + drift + Math.sin(time * 0.18 + i * 2.3) * 22;
          const grad = ctx.createLinearGradient(x, 0, x + 330, window.innerHeight);
          grad.addColorStop(0, light?.phaseKey === 'dusk' ? 'rgba(240,177,120,0.60)' : (light?.phaseKey === 'dawn' ? 'rgba(255,228,164,0.60)' : 'rgba(237,224,167,0.62)'));
          grad.addColorStop(0.46, warmMid);
          grad.addColorStop(1, 'rgba(108,96,64,0)');
          ctx.globalAlpha = opacity;
          ctx.fillStyle = grad;
          this.fillPoly([
            { x: x, y: 0 },
            { x: x + width, y: 0 },
            { x: x + 380 + width * 0.4, y: window.innerHeight },
            { x: x + 235, y: window.innerHeight }
          ]);
          // V0.14.26: removed animated screen-space oval light patches; retained only subtle shaft polygons.
        }
        ctx.restore();
      }

      drawWorldDustMotes() {
        const light = this.getWorldLightState?.() || null;
        const time = performance.now() * 0.001;
        const count = Math.min(95, Math.max(45, Math.floor((window.innerWidth * window.innerHeight) / 28000)));
        const alphaBase = light?.dustAlpha ?? 0.06;
        const tint = light?.dustTint || '#ece0ae';
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < count; i++) {
          const hx = this.hash2D?.(i, 1, 9301) ?? ((i * 16807 % 97) / 97);
          const hy = this.hash2D?.(i, 2, 9302) ?? ((i * 48271 % 113) / 113);
          const hr = this.hash2D?.(i, 3, 9303) ?? 0.5;
          const ha = this.hash2D?.(i, 4, 9304) ?? 0.5;
          const x = (hx * window.innerWidth + time * (2 + hr * 5)) % window.innerWidth;
          const y = (hy * window.innerHeight + Math.sin(time * 0.45 + i) * 8) % window.innerHeight;
          const r = 0.65 + hr * 1.45;
          ctx.globalAlpha = alphaBase * (0.45 + ha * 0.75);
          ctx.fillStyle = tint;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Terrain rendering moved to render/terrain-renderer.js

      // Object / prop rendering moved to render/object-renderer.js

      // Entity rendering moved to render/entity-renderer.js

      // Minimap rendering moved to render/minimap-renderer.js
    }


    // V0.20.80: FIRST, deliberately. It converts overworldMap/overworldObjects/overworldEnemies into
    // prototype accessors, and those must exist before `new Game()` runs below - the constructor
    // assigns all three, and an assignment with no setter present would create OWN properties that
    // permanently shadow the accessors.
    window.DreamRealms.ArtDirectionSystem?.install(Game);
    window.DreamRealms.AuthoredAtlasSystem?.install(Game);
    window.DreamRealms.WaypointShrineAsset?.install(Game);
    window.DreamRealms.OverworldZoneRegistry.install(Game);
    window.DreamRealms.WorldSystem.install(Game);
    window.DreamRealms.AshenValleyWorldSystem?.install(Game);
    window.DreamRealms.CaveSystem.install(Game);
    window.DreamRealms.CollisionSystem.install(Game);
    window.DreamRealms.PathfindingWorkerSystem?.install(Game);
    window.DreamRealms.EffectsSystem.install(Game);
    window.DreamRealms.PortalSystem?.install(Game);
    window.DreamRealms.TerrainFootstepSystem?.install(Game);
    window.DreamRealms.AtmosphereSystem?.install(Game);
    window.DreamRealms.WeatherSystem?.install(Game);
    window.DreamRealms.WorldTimeSystem?.install(Game);
    window.DreamRealms.AudioSystem?.install(Game);
    window.DreamRealms.AmbientAudioSystem?.install(Game);
    window.DreamRealms.ItemCompilerSystem.install(Game);
    window.DreamRealms.LootSystem.install(Game);
    window.DreamRealms.InventorySystem.install(Game);
    window.DreamRealms.BankSystem?.install(Game);
    window.DreamRealms.TradeSystem?.install(Game);
    window.DreamRealms.StatusEffectSystem?.install(Game);
    window.DreamRealms.ThreatSystem?.install(Game);
    window.DreamRealms.CombatSystem.install(Game);
    window.DreamRealms.MeditationSystem?.install(Game);
    window.DreamRealms.AdventurerPopulationSystem?.install(Game);
    window.DreamRealms.MobSpawnSystem.install(Game);
    window.DreamRealms.DpsMeterSystem?.install(Game);
    window.DreamRealms.SpellSystem.install(Game);
    window.DreamRealms.TalentSystem?.install(Game);
    window.DreamRealms.SteamDeckSystem?.install(Game);
    window.DreamRealms.MercenarySystem.install(Game);
    window.DreamRealms.UiSystem.install(Game);
    window.DreamRealms.SaveSystem.install(Game);
    window.DreamRealms.MultiplayerSystem.install(Game);
    window.DreamRealms.PartySystem.install(Game);
    window.DreamRealms.BotPlayerSystem?.install(Game);
    window.DreamRealms.RenderUtils.install(Game);
    window.DreamRealms.TerrainRenderer.install(Game);
    window.DreamRealms.ObjectRenderer.install(Game);
    window.DreamRealms.EntityRenderer.install(Game);
    window.DreamRealms.EffectsRenderer.install(Game);
    // Must come AFTER EffectsRenderer: it wraps the drawEffect that line installs. Wrapping it from
    // the systems block above would be overwritten here without a word.
    window.DreamRealms.ArtDirectionSystem?.installVfxPass?.(Game);
    window.DreamRealms.MinimapRenderer.install(Game);
    window.DreamRealms.RenderBackendSystem?.install(Game);
    window.DreamRealms.Render3DSystem?.install(Game);
    window.DreamRealms.PerformanceVerificationInstaller?.install(Game);
    window.DreamRealms.HybridDefaultCandidateSystem?.install(Game);
    window.DreamRealms.HybridRendererQaSystem?.install(Game);
    window.DreamRealms.HybridDefaultRolloutSystem?.install(Game);
    window.DreamRealms.HybridRolloutHealthSystem?.install(Game);
    window.DreamRealms.HybridFinalQaSystem?.install(Game);
    window.DreamRealms.PerformanceSettingsCleanupInstaller?.install(Game);
    window.DreamRealms.StableReleaseCandidateSystem?.install(Game);
    window.DreamRealms.PostReleaseCandidateHardeningSystem?.install(Game);
    window.DreamRealms.RendererReleasePolishSystem?.install(Game);
    window.DreamRealms.PerformanceStableReleaseLockSystem?.install(Game);
    window.DreamRealms.FinalPerformanceQaPatchSystem?.install(Game);
    window.DreamRealms.ReleaseManifestChecklistSystem?.install(Game);
    window.DreamRealms.FinalShipCleanupSystem?.install(Game);
    window.DreamRealms.LaunchValidationPackageAuditSystem?.install(Game);
    window.DreamRealms.FinalGameplayQaFixesSystem?.install(Game);
    window.DreamRealms.RuntimeQaSystem?.install(Game);
    window.DreamRealms.DebugToolsSystem?.install(Game);
    window.DreamRealms.WorldExamineSystem?.install(Game);

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      })[ch]);
    }

    window.DarkWoodsGame = new Game();
    window.DarkWoodsGame.runRuntimeIntegrityAudit?.('boot');
  })();
  
