// BlackRoot Meditation System — canonical owner of meditation balance config,
// the Level 1-20 progression chart, central regen calculation, Bard Harmonic
// Meditation tiers/Duet, group synergy, environmental bonuses, the Great
// Stillness world event, achievement/title save hooks, and migration-safe
// meditation save data.
//
// State-machine entry points (startMeditation/cancelMeditation/
// updateMeditationForEntity/actorIsMeditating) remain owned by game.js, which
// already has every interrupt call site wired through them; this module
// supplies the math/config those entry points call into so bonuses are never
// stacked independently in more than one place.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  function clamp(value, min, max) {
    const n = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  }
  function clamp01(value) { return clamp(value, 0, 1); }
  const dist = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));

  // ---------------------------------------------------------------------
  // Balance config — the spec's exact object, plus a separate tuning table
  // for implementation-only constants so the required shape stays intact.
  // ---------------------------------------------------------------------
  const MEDITATION_BALANCE = Object.freeze({
    maxTotalRegenMultiplier: 4.0,
    safeZoneXpMultiplier: 1.25,
    greatStillnessRegenMultiplier: 2.0,
    greatStillnessXpMultiplier: 1.5,
    postCombatRushMultiplier: 1.25,
    bardCrescendoMultiplier: 3.0
  });
  DR.MEDITATION_BALANCE = MEDITATION_BALANCE;

  const MEDITATION_TUNING = Object.freeze({
    settleSeconds: 1.0,
    outOfCombatRequiredSeconds: 3.0,
    // V0.17.23 root-cause fix: this is the authoritative recovery-tick
    // period consumed by game.js's updateMeditationForEntity/
    // meditationTickRate (previously mislabeled "cosmetic" and left at
    // 1.0s by the V0.16.94 revamp, which is why Meditation healed ~15x
    // faster than intended and ignored the documented 15-second tick from
    // docs/PASS_47_1_DARK_WOODS_MEDITATION_QOL.txt). Do not lower this to
    // get smoother-looking regen - the per-tick amounts below assume a
    // single lump restore every 15 real seconds, not a continuous drip.
    tickIntervalSeconds: 15.0,
    // Conservative, documented baseline Meditation-skill XP granted once
    // per valid 15-second tick (see systems/skills-system.js -> game.js
    // updateMeditationForEntity). No original numeric value for this
    // survived the V0.16.94/V0.17.21 rewrites (V0.17.21 zeroed xpPerTick
    // entirely as an overbroad guard against a player-level-XP leak bug),
    // so this is a deliberately conservative flat rate rather than a
    // guess dressed up as the "real" spec number.
    skillXpPerTick: 5,
    graceWindowSeconds: 3.0,
    graceRegenMultiplier: 0.5,
    graceRegenSeconds: 2.0,
    postCombatRushWindowSeconds: 10.0,
    postCombatRushBoostSeconds: 5.0,
    bardAuraRadius: 40,
    bardDuetRadius: 15,
    groupSynergyRadius: 15,
    groupSynergyBonusPct: 0.05,
    fullPartySynergyBonusPct: 0.08,
    fullPartySize: 5,
    bardDuetBonusPct: 0.05,
    bardDuetCrescendoBonusPct: 0.10,
    meditationGardenBonusPerMeditatorPct: 0.01,
    meditationGardenMaxBonusPct: 0.20,
    greatStillnessDurationSeconds: 60,
    greatStillnessMinIntervalHours: 12,
    greatStillnessMaxIntervalHours: 24,
    greatStillnessWarningSeconds: 300
  });
  DR.MEDITATION_TUNING = MEDITATION_TUNING;

  // ---------------------------------------------------------------------
  // State machine constants
  // ---------------------------------------------------------------------
  DR.MEDITATION_STATES = Object.freeze({
    IDLE: 'IDLE',
    SITTING_DOWN: 'SITTING_DOWN',
    MEDITATING: 'MEDITATING',
    BREAKING_MEDITATION: 'BREAKING_MEDITATION',
    GRACE_RECOVERY: 'GRACE_RECOVERY',
    FORCED_STAND: 'FORCED_STAND'
  });

  DR.MEDITATION_AI_STATES = Object.freeze({
    IDLE: 'IDLE',
    EVALUATING_REST: 'EVALUATING_REST',
    SEEKING_SAFE_SPOT: 'SEEKING_SAFE_SPOT',
    SITTING_DOWN: 'SITTING_DOWN',
    MEDITATING: 'MEDITATING',
    BREAKING_MEDITATION: 'BREAKING_MEDITATION',
    RETURNING_TO_FOLLOW: 'RETURNING_TO_FOLLOW',
    FORCED_STAND: 'FORCED_STAND'
  });

  const HARD_BREAK_REASONS = new Set(['combat', 'damage taken', 'attack', 'spell cast', 'portal cast', 'hostile']);

  // ---------------------------------------------------------------------
  // Level 1-20 progression chart. NOTE: hpPerSec/resourcePerSec are legacy
  // field names from the V0.16.94 revamp; they are consumed as a flat
  // amount restored once per 15-second Meditation tick (see
  // tickIntervalSeconds above and game.js's applyMeditationRecoveryTick),
  // not as a continuous per-real-second rate. Renaming the fields was
  // avoided to keep this fix surgical - every reader of this table (bard
  // aura math, bot desire score, etc.) already treats them as "the
  // restore chart row," so only the tick-application math needed to
  // change.
  // ---------------------------------------------------------------------
  const MEDITATION_LEVELS = Object.freeze([
    { level: 1, xp: 0, hpPerSec: 2, resourcePerSec: 1 },
    { level: 2, xp: 400, hpPerSec: 3, resourcePerSec: 2 },
    { level: 3, xp: 900, hpPerSec: 4, resourcePerSec: 3 },
    { level: 4, xp: 1500, hpPerSec: 5, resourcePerSec: 4 },
    { level: 5, xp: 2200, hpPerSec: 6, resourcePerSec: 6, unlock: 'First aura upgrade, Tier 1 emote' },
    { level: 6, xp: 3000, hpPerSec: 8, resourcePerSec: 7 },
    { level: 7, xp: 3900, hpPerSec: 9, resourcePerSec: 9 },
    { level: 8, xp: 4900, hpPerSec: 11, resourcePerSec: 10 },
    { level: 9, xp: 6000, hpPerSec: 12, resourcePerSec: 12 },
    { level: 10, xp: 7200, hpPerSec: 14, resourcePerSec: 14, unlock: 'Bard Meditation Melody, Tier 2 emote, /meditate emote hotkey' },
    { level: 11, xp: 8500, hpPerSec: 16, resourcePerSec: 16 },
    { level: 12, xp: 9900, hpPerSec: 18, resourcePerSec: 18 },
    { level: 13, xp: 11400, hpPerSec: 20, resourcePerSec: 20 },
    { level: 14, xp: 13000, hpPerSec: 22, resourcePerSec: 22 },
    { level: 15, xp: 14700, hpPerSec: 24, resourcePerSec: 24, unlock: 'Second aura upgrade, Tier 3 emote' },
    { level: 16, xp: 16500, hpPerSec: 27, resourcePerSec: 26 },
    { level: 17, xp: 18400, hpPerSec: 29, resourcePerSec: 29 },
    { level: 18, xp: 20400, hpPerSec: 32, resourcePerSec: 31 },
    { level: 19, xp: 22500, hpPerSec: 34, resourcePerSec: 34 },
    { level: 20, xp: 24700, hpPerSec: 37, resourcePerSec: 37, unlock: 'Max level, orbiting ring, Tier 4 emote, Bard Crescendo, title "the Enlightened"' }
  ]);
  DR.MEDITATION_LEVELS = MEDITATION_LEVELS;
  DR.MEDITATION_MAX_LEVEL = 20;

  function levelRow(level) {
    const clamped = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    return MEDITATION_LEVELS[clamped - 1];
  }

  function xpNeededForNextLevel(level) {
    const clamped = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    if (clamped >= 20) return null;
    return MEDITATION_LEVELS[clamped].xp - MEDITATION_LEVELS[clamped - 1].xp;
  }

  // ---------------------------------------------------------------------
  // Environmental meditation bonuses. Detection uses BlackRoot's existing
  // tile terrain types (data/tiles.js) and zone ids where a real signal
  // already exists (forests, water, caves, ruins, campfires, graveyards).
  // Categories with no current map signal (inns, temples, ley lines,
  // battlefields, musical venues, mountain peaks) read an explicit
  // `meditationEnvironment` editor attribute instead of being hardcoded per
  // tile — see systems/editor-system.js for the authoring hook. Until a
  // zone/tile is tagged, those categories simply yield no bonus.
  // ---------------------------------------------------------------------
  const MEDITATION_ENVIRONMENTS = Object.freeze({
    inn: { id: 'inn', label: "Hearth's Comfort", regenPct: 0.10, xpMultiplier: 1.25, classBonus: {} },
    temple: { id: 'temple', label: 'Sacred Ground', regenPct: 0.10, xpMultiplier: 1, classBonus: { cleric: 0.20, druid: 0.20 } },
    ancient_ruins: { id: 'ancient_ruins', label: 'Echoes of the Past', regenPct: 0.10, xpMultiplier: 1, classBonus: { enchanter: 0.20, necromancer: 0.20 } },
    forest_grove: { id: 'forest_grove', label: "Nature's Embrace", regenPct: 0.10, xpMultiplier: 1, classBonus: { druid: 0.20, summoner: 0.20 } },
    campfire: { id: 'campfire', label: 'Flickering Warmth', regenPct: 0.15, xpMultiplier: 1, classBonus: {} },
    graveyard_crypt: { id: 'graveyard_crypt', label: "Death's Threshold", regenPct: 0.10, xpMultiplier: 1, classBonus: { necromancer: 0.25 } },
    ley_line: { id: 'ley_line', label: 'Arcane Confluence', regenPct: 0.10, xpMultiplier: 1, classBonus: { enchanter: 0.25 } },
    battlefield: { id: 'battlefield', label: "Warrior's Respite", regenPct: 0.10, xpMultiplier: 1, classBonus: { fighter: 0.20, rogue: 0.20 } },
    near_water: { id: 'near_water', label: 'Flowing Tranquility', regenPct: 0.10, xpMultiplier: 1, classBonus: {} },
    musical_venue: { id: 'musical_venue', label: 'Resonant Hall', regenPct: 0.10, xpMultiplier: 1, classBonus: { bard: 0.25 } },
    mountain_peak: { id: 'mountain_peak', label: 'Windswept Clarity', regenPct: 0.15, xpMultiplier: 1, classBonus: {} },
    cave_underground: { id: 'cave_underground', label: 'Earthen Stillness', regenPct: 0.10, xpMultiplier: 1, classBonus: {} },
    meditation_garden: { id: 'meditation_garden', label: 'Communal Stillness', regenPct: 0, xpMultiplier: 1, classBonus: {} }
  });
  DR.MEDITATION_ENVIRONMENTS = MEDITATION_ENVIRONMENTS;

  // ---------------------------------------------------------------------
  // Achievement / title hooks (BlackRoot has no achievement/title system —
  // these are migration-safe save flags + chat log unlocks only).
  // ---------------------------------------------------------------------
  const MEDITATION_ACHIEVEMENTS = Object.freeze([
    { id: 'first_breath', name: 'First Breath', title: 'the Calm', description: 'Reach Meditation Level 5.' },
    { id: 'inner_stillness', name: 'Inner Stillness', title: 'the Centered', description: 'Reach Meditation Level 10.' },
    { id: 'mind_over_body', name: 'Mind Over Body', title: 'the Tranquil', description: 'Reach Meditation Level 15.' },
    { id: 'perfect_harmony', name: 'Perfect Harmony', title: 'the Enlightened', description: 'Reach Meditation Level 20.' },
    { id: 'group_serenity', name: 'Group Serenity', title: 'the Unifier', description: 'Full party meditation 50 times.' },
    { id: 'world_weary_rest', name: 'World-Weary Rest', title: 'the Wanderer', description: 'Meditate in 20 unique environmental locations.' },
    { id: 'vigilant_rest', name: 'Vigilant Rest', title: 'the Patient', description: 'Meditate for 10 cumulative hours.' },
    { id: 'shared_dream', name: 'Shared Dream', title: 'the Harmonized', description: 'Meditate with a Level 20 Bard during Crescendo.' },
    { id: 'duet_of_dreams', name: 'Duet of Dreams', title: 'the Harmonious', description: 'Duet with 10 different Bards.' },
    { id: 'stillness_embrace', name: 'Stillness Embrace', title: 'the Still', description: 'Meditate through The Great Stillness.' },
    { id: 'sanctuary_seeker', name: 'Sanctuary Seeker', title: 'the Rooted', description: 'Meditate in all environmental location types.' }
  ]);
  DR.MEDITATION_ACHIEVEMENTS = MEDITATION_ACHIEVEMENTS;
  const MEDITATION_ACHIEVEMENT_BY_ID = {};
  for (const a of MEDITATION_ACHIEVEMENTS) MEDITATION_ACHIEVEMENT_BY_ID[a.id] = a;

  const ENVIRONMENT_COUNT = Object.keys(MEDITATION_ENVIRONMENTS).length;

  // ---------------------------------------------------------------------
  // Meditation emote data hooks. Tier gates: 5/10/15/20. BlackRoot has no
  // radial emote UI and its 'f' key is already bound to fishing, so
  // activation is via /meditate emote (chat) and a cycle-hook method; see
  // game.js submitChatInput and toggleMeditationEmoteCycle.
  // ---------------------------------------------------------------------
  function classEmoteSet(prefix, labels) {
    return labels.map((name, i) => ({ id: `${prefix}_tier${i + 1}`, tier: i + 1, unlockLevel: [5, 10, 15, 20][i], name }));
  }
  const MEDITATION_EMOTES = Object.freeze({
    Fighter: classEmoteSet('fighter', ['Sharpen Blade', 'War Chant', 'Salute the Fallen', 'Champion\'s Rest']),
    Bard: classEmoteSet('bard', ['Hum a Tune', 'Quiet Strum', 'Whistling Melody', 'Encore Bow']),
    Necromancer: classEmoteSet('necromancer', ['Whispered Rite', 'Bone Rattle', 'Soul Beckon', 'Grave Communion']),
    Enchanter: classEmoteSet('enchanter', ['Idle Glyph', 'Mind Ripple', 'Prismatic Focus', 'Arcane Bloom']),
    Summoner: classEmoteSet('summoner', ['Whisper to the Void', 'Planar Glance', 'Familiar Nuzzle', 'Rift Gaze']),
    Rogue: classEmoteSet('rogue', ['Coin Flip', 'Blade Twirl', 'Shadow Nod', 'Vanishing Bow']),
    Cleric: classEmoteSet('cleric', ['Quiet Prayer', 'Blessing Gesture', 'Radiant Sigh', 'Ascendant Hymn']),
    Druid: classEmoteSet('druid', ['Leaf Twirl', 'Root Touch', 'Spirit Call', 'Seasons Turn']),
    Paladin: classEmoteSet('paladin', ['Silent Vow', 'Shield Rest', 'Sunlit Salute', 'Oath Renewed']),
    Warden: classEmoteSet('warden', ['Bark Touch', 'Stone Breath', 'Root Anchor', "Guardian's Peace"]),
    Ranger: classEmoteSet('ranger', ['Feather Twirl', 'Trail Glance', 'Bowstring Hum', "Wild's Welcome"]),
    Assassin: classEmoteSet('assassin', ['Knife Spin', 'Silent Mark', 'Poison Vial Check', "Executioner's Calm"]),
    Wizard: classEmoteSet('wizard', ['Rune Trace', 'Arcane Flicker', 'Mote Gaze', "Archmage's Repose"]),
    Shaman: classEmoteSet('shaman', ['Totem Touch', 'Storm Listen', 'Ancestor Nod', "Spirit's Calm"])
  });
  DR.MEDITATION_EMOTES = MEDITATION_EMOTES;

  function emoteSetForEntity(entity) {
    const classKey = actorClassKey(entity);
    const className = Object.keys(MEDITATION_EMOTES).find(k => k.toLowerCase() === classKey);
    return MEDITATION_EMOTES[className] || [];
  }

  function unlockEmotesForLevel(entity) {
    if (!entity?.meditation) return;
    const level = entity.meditation.level;
    for (const emote of emoteSetForEntity(entity)) {
      if (level >= emote.unlockLevel && !entity.meditation.unlockedEmotes.includes(emote.id)) {
        entity.meditation.unlockedEmotes.push(emote.id);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Class aura palette metadata (used by the renderer for the five classes
  // that previously had no meditation aura, and by the emote/achievement
  // UI). Fighter/Paladin/Rogue/Cleric/Enchanter/Summoner/Necromancer/Bard/
  // Druid keep their existing bespoke render functions untouched.
  // ---------------------------------------------------------------------
  DR.MEDITATION_CLASS_PALETTE = Object.freeze({
    warden: { colors: ['#8fcf70', '#4a3524'], label: 'Bark and Root Guardian' },
    ranger: { colors: ['#77b85f', '#e8dcae'], label: 'Wilderness Trailwarden' },
    assassin: { colors: ['#c23b3b', '#141018'], label: 'Execution Sigil' },
    wizard: { colors: ['#6fa8ff', '#b98bff'], label: 'Arcane Rune Circle' },
    shaman: { colors: ['#59c9b2', '#8a6a3a'], label: 'Storm and Earth Totem' }
  });

  function actorClassKey(entity) {
    return String(entity?.className || entity?.playerClass || entity?.classId || entity?.botClassAiProfileId || '').toLowerCase().replace(/[\s_\-]+/g, '');
  }

  // ---------------------------------------------------------------------
  // Migration-safe meditation save-state hydration.
  // ---------------------------------------------------------------------
  function normalizeMeditationState(entity) {
    if (!entity) return null;
    let m = entity.meditation;
    if (!m || typeof m !== 'object') m = {};
    const level = Math.max(1, Math.min(20, Math.floor(Number(m.level) || 1)));
    const xp = Math.max(0, Math.floor(Number(m.xp) || 0));
    const totalSecondsMeditated = Math.max(0, Number(m.totalSecondsMeditated) || 0);
    const unlockedEmotes = Array.isArray(m.unlockedEmotes) ? m.unlockedEmotes.filter(id => typeof id === 'string') : [];
    const validEmoteIds = new Set();
    for (const set of Object.values(MEDITATION_EMOTES)) for (const e of set) validEmoteIds.add(e.id);
    const cleanedEmotes = [];
    for (const id of unlockedEmotes) {
      if (validEmoteIds.has(id)) cleanedEmotes.push(id);
      else console.warn(`[Meditation] Unknown emote id "${id}" dropped during save migration.`);
    }
    const achievements = (m.achievements && typeof m.achievements === 'object') ? { ...m.achievements } : {};
    for (const id of Object.keys(achievements)) {
      if (!MEDITATION_ACHIEVEMENT_BY_ID[id]) {
        console.warn(`[Meditation] Unknown achievement id "${id}" dropped during save migration.`);
        delete achievements[id];
      }
    }
    const titlesUnlocked = Array.isArray(m.titlesUnlocked) ? m.titlesUnlocked.filter(t => typeof t === 'string') : [];
    entity.meditation = {
      level,
      xp,
      totalSecondsMeditated,
      unlockedEmotes: cleanedEmotes,
      selectedEmote: typeof m.selectedEmote === 'string' && validEmoteIds.has(m.selectedEmote) ? m.selectedEmote : null,
      achievements,
      titlesUnlocked,
      activeTitle: typeof m.activeTitle === 'string' ? m.activeTitle : null,
      environmentalLocationsVisited: (m.environmentalLocationsVisited && typeof m.environmentalLocationsVisited === 'object') ? { ...m.environmentalLocationsVisited } : {},
      fullPartyMeditationCount: Math.max(0, Math.floor(Number(m.fullPartyMeditationCount) || 0)),
      bardDuetPartners: (m.bardDuetPartners && typeof m.bardDuetPartners === 'object') ? { ...m.bardDuetPartners } : {},
      lastMeditationBreakTime: Math.max(0, Number(m.lastMeditationBreakTime) || 0),
      lastMeditationStartTime: Math.max(0, Number(m.lastMeditationStartTime) || 0),
      lastGreatStillnessParticipation: m.lastGreatStillnessParticipation || null,
      stillnessMoteUnlocked: Boolean(m.stillnessMoteUnlocked)
    };
    // Keep the pre-existing Skills-panel-facing meditationSkill object in
    // sync so systems/skills-system.js keeps working unmodified.
    if (!entity.meditationSkill || typeof entity.meditationSkill !== 'object') {
      entity.meditationSkill = { name: 'Meditating', level, xp, ticks: 0 };
    } else {
      entity.meditationSkill.level = level;
      entity.meditationSkill.xp = xp;
    }
    return entity.meditation;
  }

  DR.migrateMeditationSaveData = normalizeMeditationState;

  // ---------------------------------------------------------------------
  // Zone/tile environment detection
  // ---------------------------------------------------------------------
  function attrKey(x, y) { return `${Math.floor(x)},${Math.floor(y)}`; }

  function activeZoneKey(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function attributeAt(game, x, y) {
    const grid = game.editorAttributes?.[activeZoneKey(game)];
    if (!grid) return null;
    return grid[attrKey(x, y)] || null;
  }

  function tileDefAt(game, x, y) {
    const tileId = game.tileAt?.(x, y);
    return (tileId != null && DR.TILE_DEF) ? DR.TILE_DEF[tileId] : null;
  }

  function detectEnvironment(game, entity) {
    const attr = attributeAt(game, entity.x, entity.y);
    if (attr && attr.meditationGarden) return MEDITATION_ENVIRONMENTS.meditation_garden;
    if (attr && attr.meditationEnvironment && MEDITATION_ENVIRONMENTS[attr.meditationEnvironment]) {
      return MEDITATION_ENVIRONMENTS[attr.meditationEnvironment];
    }
    const zoneKey = activeZoneKey(game);
    if (/catacomb|hollow|crypt|grave/i.test(zoneKey)) return MEDITATION_ENVIRONMENTS.graveyard_crypt;
    if (game.currentZone === 'cave') return MEDITATION_ENVIRONMENTS.cave_underground;
    const tile = tileDefAt(game, entity.x, entity.y);
    const TILE = DR.TILE || {};
    const tileId = game.tileAt?.(entity.x, entity.y);
    if (tileId === TILE.CAMP) return MEDITATION_ENVIRONMENTS.campfire;
    if (tileId === TILE.RUIN) return MEDITATION_ENVIRONMENTS.ancient_ruins;
    if (tileId === TILE.WATER) return MEDITATION_ENVIRONMENTS.near_water;
    if (tileId === TILE.FOREST_FLOOR || tileId === TILE.UNDERBRUSH || tileId === TILE.DEEP_GRASS || tileId === TILE.DARK_GRASS) {
      return MEDITATION_ENVIRONMENTS.forest_grove;
    }
    if (tile?.terrainType === 'cave_floor' || tile?.terrainType === 'ash_soil') return MEDITATION_ENVIRONMENTS.cave_underground;
    return null;
  }

  function isSafeZoneActive(game, entity) {
    const attr = attributeAt(game, entity.x, entity.y);
    return Boolean(attr && attr.safeZone);
  }

  function meditationGardenBonusPct(game, entity) {
    const attr = attributeAt(game, entity.x, entity.y);
    if (!attr || !attr.meditationGarden) return 0;
    const members = game.getPartyCombatMembers?.({ includeRemote: true, includePet: false, anchor: entity, range: MEDITATION_TUNING.groupSynergyRadius }) || [];
    let meditatorCount = game.actorIsMeditating?.(entity) ? 1 : 0;
    for (const entry of members) {
      if (entry.actor !== entity && game.actorIsMeditating?.(entry.actor)) meditatorCount += 1;
    }
    return Math.min(MEDITATION_TUNING.meditationGardenMaxBonusPct, meditatorCount * MEDITATION_TUNING.meditationGardenBonusPerMeditatorPct);
  }

  // ---------------------------------------------------------------------
  // Bard Harmonic Meditation tiers / Duet / Group synergy
  // ---------------------------------------------------------------------
  function bardMeditationLevel(bard) {
    return Math.max(1, Math.min(20, Math.floor(Number(bard?.meditation?.level || bard?.meditationSkill?.level) || 1)));
  }

  function bardTierForLevel(level) {
    if (level >= 20) return 3;
    if (level >= 10) return 2;
    return 1;
  }

  function meditatingBardsNear(game, entity, radius) {
    const bards = [];
    const candidates = [game.player, ...(game.botPlayers || [])];
    if (game.remotePlayers instanceof Map) candidates.push(...game.remotePlayers.values());
    for (const actor of candidates) {
      if (!actor || actor.alive === false) continue;
      if (actorClassKey(actor) !== 'bard') continue;
      if (!game.actorIsMeditating?.(actor)) continue;
      if (dist(actor, entity) > radius) continue;
      bards.push(actor);
    }
    return bards;
  }

  function bardHarmonicBonusPct(game, entity) {
    if (game.isEntityInCombat?.(entity)) return 0;
    const selfIsBard = actorClassKey(entity) === 'bard' && game.actorIsMeditating?.(entity);
    const nearby = meditatingBardsNear(game, entity, MEDITATION_TUNING.bardAuraRadius).filter(b => b !== entity || selfIsBard);
    if (!nearby.length) return 0;
    const recipientLevel = Math.max(1, Math.min(20, Math.floor(Number(entity?.meditation?.level ?? entity?.meditationSkill?.level) || 1)));
    const recipientRow = levelRow(recipientLevel);
    let best = 0;
    for (const bard of nearby) {
      const level = bardMeditationLevel(bard);
      const tier = bardTierForLevel(level);
      let pct;
      if (tier >= 3) {
        pct = MEDITATION_BALANCE.bardCrescendoMultiplier - 1; // Crescendo: regen tripled before cap, i.e. +200%
      } else if (tier === 2) {
        pct = 0.15; // Meditation Melody: flat +15%
      } else {
        // Soothing Presence: recipient regenerates as if +1 effective Meditation Level (capped at 20).
        const boosted = levelRow(Math.min(20, recipientLevel + 1));
        pct = recipientRow.hpPerSec > 0 ? (boosted.hpPerSec / recipientRow.hpPerSec - 1) : 0;
      }
      if (pct > best) best = pct;
    }
    return best;
  }

  function bardDuetBonusPct(game, entity) {
    const selfBard = actorClassKey(entity) === 'bard' && game.actorIsMeditating?.(entity);
    if (!selfBard) return 0;
    const others = meditatingBardsNear(game, entity, MEDITATION_TUNING.bardDuetRadius).filter(b => b !== entity);
    if (!others.length) return 0;
    const selfLevel = bardMeditationLevel(entity);
    const partner = others[0];
    const partnerLevel = bardMeditationLevel(partner);
    const eitherHasMelody = selfLevel >= 10 || partnerLevel >= 10;
    if (!eitherHasMelody) return 0;
    const bothCrescendo = selfLevel >= 20 && partnerLevel >= 20;
    game.trackBardDuetPartner?.(entity, partner);
    return bothCrescendo ? MEDITATION_TUNING.bardDuetCrescendoBonusPct : MEDITATION_TUNING.bardDuetBonusPct;
  }

  function groupSynergyBonusPct(game, entity) {
    if (!game.actorIsMeditating?.(entity)) return 0;
    const members = game.getPartyCombatMembers?.({ includeRemote: true, includePet: false, anchor: entity, range: MEDITATION_TUNING.groupSynergyRadius }) || [];
    let meditatingCount = 1;
    let totalCount = 1;
    for (const entry of members) {
      if (entry.actor === entity) continue;
      totalCount += 1;
      if (game.actorIsMeditating?.(entry.actor)) meditatingCount += 1;
    }
    if (meditatingCount < 2) return 0;
    if (totalCount >= MEDITATION_TUNING.fullPartySize && meditatingCount >= MEDITATION_TUNING.fullPartySize) {
      return MEDITATION_TUNING.fullPartySynergyBonusPct;
    }
    return MEDITATION_TUNING.groupSynergyBonusPct;
  }

  // ---------------------------------------------------------------------
  // Great Stillness world event scheduler (rides the existing world clock
  // owned by systems/time-cycle-system.js; does not create a second clock).
  // ---------------------------------------------------------------------
  function totalInGameHours(game) {
    const info = game.getWorldTimeInfo?.();
    if (!info) return 0;
    return (Math.max(1, info.day) - 1) * 24 + info.minuteOfDay / 60;
  }

  function ensureGreatStillnessState(game) {
    if (game.greatStillness) return game.greatStillness;
    game.greatStillness = {
      nextAtHour: null,
      warned: false,
      active: false,
      remaining: 0,
      lastEndedAtHour: null
    };
    return game.greatStillness;
  }

  function scheduleNextGreatStillness(game, fromHour) {
    const state = ensureGreatStillnessState(game);
    const span = MEDITATION_TUNING.greatStillnessMinIntervalHours +
      Math.random() * (MEDITATION_TUNING.greatStillnessMaxIntervalHours - MEDITATION_TUNING.greatStillnessMinIntervalHours);
    state.nextAtHour = fromHour + span;
    state.warned = false;
  }

  function updateGreatStillness(game, dt) {
    if (!game.worldTime) return;
    const state = ensureGreatStillnessState(game);
    const hour = totalInGameHours(game);
    if (state.nextAtHour == null) { scheduleNextGreatStillness(game, hour); return; }

    if (state.active) {
      state.remaining = Math.max(0, state.remaining - dt);
      if (state.remaining <= 0) {
        state.active = false;
        state.lastEndedAtHour = hour;
        game.log?.('The Stillness fades. The world stirs once more.');
        scheduleNextGreatStillness(game, hour);
      }
      return;
    }

    const hoursUntil = state.nextAtHour - hour;
    if (!state.warned && hoursUntil <= MEDITATION_TUNING.greatStillnessWarningSeconds / 3600) {
      state.warned = true;
      game.log?.('A profound calm gathers on the horizon. The Stillness approaches.');
    }
    if (hoursUntil <= 0) {
      state.active = true;
      state.remaining = MEDITATION_TUNING.greatStillnessDurationSeconds;
      game.log?.('The world exhales. For a brief moment, all things feel quieter... The Stillness is upon us.');
      for (const actor of [game.player, ...(game.botPlayers || [])]) {
        if (actor && game.actorIsMeditating?.(actor)) actor._meditationStillnessStartedAt = nowMs();
      }
    }
  }

  function isGreatStillnessActive(game) {
    return Boolean(game.greatStillness && game.greatStillness.active);
  }

  // ---------------------------------------------------------------------
  // Achievement / title checking (hook-only — no UI beyond chat log).
  // ---------------------------------------------------------------------
  function unlockMeditationAchievement(game, entity, achievementId) {
    const state = entity?.meditation;
    if (!state) return false;
    if (state.achievements[achievementId]) return false;
    const def = MEDITATION_ACHIEVEMENT_BY_ID[achievementId];
    if (!def) return false;
    state.achievements[achievementId] = { unlockedAt: Date.now() };
    if (!state.titlesUnlocked.includes(def.title)) state.titlesUnlocked.push(def.title);
    if (entity === game.player) game.log?.(`Achievement unlocked: ${def.name} — title "${def.title}" is now available.`);
    return true;
  }

  function checkLevelAchievements(game, entity) {
    const level = entity?.meditation?.level || 1;
    if (level >= 5) unlockMeditationAchievement(game, entity, 'first_breath');
    if (level >= 10) unlockMeditationAchievement(game, entity, 'inner_stillness');
    if (level >= 15) unlockMeditationAchievement(game, entity, 'mind_over_body');
    if (level >= 20) unlockMeditationAchievement(game, entity, 'perfect_harmony');
  }

  function trackEnvironmentVisit(game, entity, environment) {
    if (!environment || !entity?.meditation) return;
    entity.meditation.environmentalLocationsVisited[environment.id] = true;
    const visitedCount = Object.keys(entity.meditation.environmentalLocationsVisited).length;
    if (visitedCount >= 20) unlockMeditationAchievement(game, entity, 'world_weary_rest');
    if (visitedCount >= ENVIRONMENT_COUNT) unlockMeditationAchievement(game, entity, 'sanctuary_seeker');
  }

  // ---------------------------------------------------------------------
  // Bot/merc "meditation desire score" — advisory weighting layered on top
  // of each companion's own existing HP/mana-threshold trigger, not a
  // replacement for it (entities/bot-player.js and entities/mercenary.js
  // remain the owning AI loops).
  // ---------------------------------------------------------------------
  function meditationDesireScore(game, entity, context = {}) {
    let score = 0;
    const hpRatio = entity.maxHp > 0 ? entity.hp / entity.maxHp : 1;
    const resRatio = entity.maxMana > 0 ? entity.mana / entity.maxMana : 1;
    if (hpRatio < 0.70) score += 0.25;
    if (hpRatio < 0.30) score += 0.35;
    if (resRatio < 0.50) score += 0.20;
    const isCaster = ['wizard', 'shaman', 'summoner', 'necromancer', 'cleric', 'druid', 'bard', 'enchanter'].includes(actorClassKey(entity));
    if (isCaster && resRatio < 0.50) score += 0.15;
    if (context.justLeftCombat) score += 0.20;
    if (context.partyMemberMeditating) score += 0.08;
    if (context.bardMeditatingNearby) score += 0.08;
    if (context.nearSafeZone) score += 0.08;
    if (context.nearRestSpot) score += 0.08;
    if (context.dangerNearby) score -= 0.30;
    if (context.coverNearbyHostilesFar) score += 0.05;
    if (context.idleSeconds >= 30) score += 0.04;
    if (context.isNight) score += 0.03;
    const level = Math.max(1, Math.min(20, Math.floor(Number(entity?.meditation?.level) || 1)));
    score += (level / 20) * 0.05;
    if (context.socialDowntime) score += 0.03;
    return clamp01(score);
  }

  DR.MeditationHelpers = {
    levelRow,
    xpNeededForNextLevel,
    detectEnvironment,
    isSafeZoneActive,
    meditationGardenBonusPct,
    bardHarmonicBonusPct,
    bardDuetBonusPct,
    groupSynergyBonusPct,
    meditationDesireScore,
    isGreatStillnessActive,
    checkLevelAchievements,
    trackEnvironmentVisit,
    unlockMeditationAchievement,
    actorClassKey
  };

  // ---------------------------------------------------------------------
  // Install
  // ---------------------------------------------------------------------
  DR.MeditationSystem = {
    install(Game) {
      Game.prototype.normalizeMeditationState = function(entity = this.player) {
        return normalizeMeditationState(entity);
      };

      Game.prototype.meditationLevelRow = function(entity = this.player) {
        const level = entity?.meditation?.level ?? entity?.meditationSkill?.level ?? 1;
        return levelRow(level);
      };

      Game.prototype.grantMeditationXp = function(entity = this.player, amount, context = {}) {
        if (!entity || !(amount > 0)) return;
        if (!entity.meditation) normalizeMeditationState(entity);
        const state = entity.meditation;
        state.xp = Math.max(0, state.xp + amount);
        let needed = xpNeededForNextLevel(state.level);
        let leveled = false;
        while (needed != null && state.xp >= needed && state.level < 20) {
          state.xp -= needed;
          state.level += 1;
          leveled = true;
          needed = xpNeededForNextLevel(state.level);
          if (entity === this.player) this.log?.(`Meditation level ${state.level}.`);
        }
        if (state.level >= 20) state.xp = 0;
        if (entity.meditationSkill) {
          entity.meditationSkill.level = state.level;
          entity.meditationSkill.xp = state.xp;
        }
        if (leveled) {
          unlockEmotesForLevel(entity);
          DR.MeditationHelpers.checkLevelAchievements(this, entity);
        }
        return leveled;
      };

      Game.prototype.unlockedMeditationEmotesFor = function(entity = this.player) {
        const level = entity?.meditation?.level || 1;
        return emoteSetForEntity(entity).filter(e => level >= e.unlockLevel);
      };

      Game.prototype.triggerMeditationEmote = function(entity = this.player, emoteId = null) {
        if (!this.actorIsMeditating?.(entity)) return false;
        const unlocked = this.unlockedMeditationEmotesFor(entity);
        if (!unlocked.length) return false;
        const chosen = emoteId ? unlocked.find(e => e.id === emoteId) : unlocked[Math.floor(Math.random() * unlocked.length)];
        if (!chosen) return false;
        if (entity.meditation) entity.meditation.selectedEmote = chosen.id;
        entity.activeMeditationEmote = chosen.id;
        entity._meditationEmoteFlashUntil = nowMs() + 2500;
        if (entity === this.player) this.log?.(`You perform "${chosen.name}".`);
        return true;
      };

      Game.prototype.cycleMeditationEmote = function(entity = this.player) {
        const unlocked = this.unlockedMeditationEmotesFor(entity);
        if (!unlocked.length) {
          if (entity === this.player) this.log?.('No meditation emotes unlocked yet.');
          return false;
        }
        const currentIndex = unlocked.findIndex(e => e.id === entity?.meditation?.selectedEmote);
        const next = unlocked[(currentIndex + 1) % unlocked.length];
        return this.triggerMeditationEmote(entity, next.id);
      };

      Game.prototype.triggerMeditateSlashEmote = function() {
        const p = this.player;
        if (!p) return false;
        if (!this.actorIsMeditating?.(p)) { this.log?.('You must be meditating to use /meditate emote.'); return true; }
        const level = p.meditation?.level || 1;
        if (level < 10) { this.log?.('/meditate emote unlocks at Meditation Level 10.'); return true; }
        this.triggerMeditationEmote(p, p.meditation?.selectedEmote || null);
        return true;
      };

      Game.prototype.meditationOutOfCombatSeconds = function(entity) {
        if (!entity || !entity._lastCombatActiveAt) return Infinity;
        return (nowMs() - entity._lastCombatActiveAt) / 1000;
      };

      Game.prototype.calculateMeditationRegen = function(entity, context = {}) {
        const result = { hpPerSec: 0, resourcePerSec: 0, xpPerTick: 0, multiplier: 1, visualModifiers: {} };
        if (!entity || this.isEntityInCombat?.(entity)) return result;

        const row = this.meditationLevelRow(entity);
        let baseHp = row.hpPerSec;
        let baseRes = row.resourcePerSec;

        let multiplier = 1;
        const visual = {};

        const environment = DR.MeditationHelpers.detectEnvironment(this, entity);
        if (environment) {
          const classKey = actorClassKey(entity);
          const classBonus = environment.classBonus?.[classKey];
          multiplier += (classBonus != null ? classBonus : environment.regenPct);
          visual.environment = environment.id;
        }
        const gardenBonus = DR.MeditationHelpers.meditationGardenBonusPct(this, entity);
        if (gardenBonus > 0) { multiplier += gardenBonus; visual.gardenBonus = gardenBonus; }

        const bardBonus = DR.MeditationHelpers.bardHarmonicBonusPct(this, entity);
        if (bardBonus > 0) {
          multiplier += bardBonus;
          visual.bardAura = true;
          if (bardBonus >= MEDITATION_BALANCE.bardCrescendoMultiplier - 1 && actorClassKey(entity) !== 'bard') {
            unlockMeditationAchievement(this, entity, 'shared_dream');
          }
        }

        const duetBonus = DR.MeditationHelpers.bardDuetBonusPct(this, entity);
        if (duetBonus > 0) { multiplier += duetBonus; visual.duet = true; }

        const groupBonus = DR.MeditationHelpers.groupSynergyBonusPct(this, entity);
        if (groupBonus > 0) {
          multiplier += groupBonus;
          visual.groupSynergy = true;
          const fullParty = groupBonus >= MEDITATION_TUNING.fullPartySynergyBonusPct;
          if (fullParty && !entity._fullPartySynergyActive) this.recordFullPartyMeditation?.(entity);
          entity._fullPartySynergyActive = fullParty;
        } else {
          entity._fullPartySynergyActive = false;
        }

        if (isGreatStillnessActive(this)) {
          multiplier *= MEDITATION_BALANCE.greatStillnessRegenMultiplier;
          visual.greatStillness = true;
        }

        if (entity._meditationGraceRemaining > 0) {
          multiplier *= MEDITATION_TUNING.graceRegenMultiplier;
          visual.grace = true;
        }
        if (entity._postCombatRushRemaining > 0) {
          multiplier *= MEDITATION_BALANCE.postCombatRushMultiplier;
          visual.postCombatRush = true;
        }

        const cappedMultiplier = Math.min(MEDITATION_BALANCE.maxTotalRegenMultiplier, multiplier);
        result.hpPerSec = baseHp * cappedMultiplier;
        result.resourcePerSec = baseRes * cappedMultiplier;
        result.multiplier = cappedMultiplier;
        result.visualModifiers = visual;

        // V0.17.21 correctly stopped Meditation from leaking into PLAYER
        // LEVEL XP (entity.xp / the kill-quest-progression bar) - that
        // safeguard in game.js's updateMeditationForEntity is untouched and
        // still active. But it zeroed xpPerTick entirely, which also
        // silenced the separate, legitimate Meditation SKILL XP
        // (entity.meditation.xp / entity.meditationSkill, rendered only in
        // the Skills panel via systems/skills-system.js) that valid ticks
        // are supposed to grant. V0.17.23 restored a conservative flat
        // Meditation-skill XP rate here; game.js only ever forwards this
        // value to game.gainMeditationXp (skill XP), never to entity.xp.
        //
        // V0.17.24: wires the pre-existing-but-dormant XP multiplier config
        // (MEDITATION_BALANCE.safeZoneXpMultiplier/greatStillnessXpMultiplier
        // and each MEDITATION_ENVIRONMENTS[x].xpMultiplier) into that flat
        // rate instead of leaving them defined-but-unread. These are direct
        // multiplicative factors (1.25 = "1.25x"), so they stack
        // multiplicatively with each other, not with the additive
        // regen-percentage multiplier above - XP and HP/resource bonuses are
        // intentionally separate per MEDITATION_BALANCE's own split fields
        // (e.g. greatStillnessRegenMultiplier vs greatStillnessXpMultiplier).
        let xpMultiplier = 1;
        if (environment && Number(environment.xpMultiplier) > 0) xpMultiplier *= environment.xpMultiplier;
        if (DR.MeditationHelpers.isSafeZoneActive(this, entity)) xpMultiplier *= MEDITATION_BALANCE.safeZoneXpMultiplier;
        if (isGreatStillnessActive(this)) xpMultiplier *= MEDITATION_BALANCE.greatStillnessXpMultiplier;
        result.xpPerTick = MEDITATION_TUNING.skillXpPerTick * xpMultiplier;

        if (environment) DR.MeditationHelpers.trackEnvironmentVisit(this, entity, environment);
        return result;
      };

      Game.prototype.meditationDesireScore = function(entity, context = {}) {
        return DR.MeditationHelpers.meditationDesireScore(this, entity, context);
      };

      Game.prototype.isGreatStillnessActive = function() {
        return isGreatStillnessActive(this);
      };

      Game.prototype.updateGreatStillness = function(dt) {
        updateGreatStillness(this, dt);
      };

      Game.prototype.trackBardDuetPartner = function(entity, partner) {
        if (!entity?.meditation || !partner) return;
        const key = String(partner.id ?? partner.botId ?? partner.name ?? '');
        if (!key || entity.meditation.bardDuetPartners[key]) return;
        entity.meditation.bardDuetPartners[key] = Date.now();
        const count = Object.keys(entity.meditation.bardDuetPartners).length;
        if (count >= 10) DR.MeditationHelpers.unlockMeditationAchievement(this, entity, 'duet_of_dreams');
      };

      Game.prototype.recordFullPartyMeditation = function(entity) {
        if (!entity?.meditation) return;
        entity.meditation.fullPartyMeditationCount = (entity.meditation.fullPartyMeditationCount || 0) + 1;
        if (entity.meditation.fullPartyMeditationCount >= 50) DR.MeditationHelpers.unlockMeditationAchievement(this, entity, 'group_serenity');
      };

      Game.prototype.recordGreatStillnessCompletion = function(entity) {
        if (!entity?.meditation) return;
        entity.meditation.lastGreatStillnessParticipation = Date.now();
        entity.meditation.stillnessMoteUnlocked = true;
        DR.MeditationHelpers.unlockMeditationAchievement(this, entity, 'stillness_embrace');
      };
    }
  };
})();
