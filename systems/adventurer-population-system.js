// Blackroot — Adventurer Population System (Phase 1: persistent registry).
//
// Part of the multi-phase "living world of adventurers" build (spec:
// Blackroot_Adventurer_Bot_AI_System.txt, plan: docs/PLAN_ADVENTURER_BOT_AI.md).
//
// PHASE 1 SCOPE — additive only. This introduces the persistent data layer: a
// registry of ~a dozen recognizable adventurer RECORDS that exist as data
// independent of whether a full BotPlayer entity is materialized for them. It
// seeds the roster, persists it in the save, and surfaces it via /who. It does
// NOT yet change how bots spawn or behave, nor run any simulation — that is
// Phase 2 (promote/demote bridge) and later. The first 8 records mirror the
// existing squad bots in systems/bot-player-system.js (BOT_START_PROFILES) so
// the two systems can be unified in Phase 2; the last 4 are new distant
// adventurers that only exist as records for now.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const POPULATION_SCHEMA_VERSION = 1;

  // Daily activity distribution (spec Blackroot_Adventurer_Bot_AI_System.txt).
  // group: solo/small/large drives party formation; inTown keeps them home;
  // reach scales the travel distance from the home town (0 = in town).
  // xpMult/goldMult/repMult scale the per-in-game-hour sim gains (Phase 4);
  // hpRate is the HP fraction gained (+) or lost (-) per in-game hour.
  const ACTIVITIES = Object.freeze([
    { id: 'rest_town',      label: 'Resting in town',        weight: 0.15, group: 'solo',  inTown: true,  reach: 0.0,  goal: 'camp-supply-run', xpMult: 0.0,  goldMult: 0.0,  repMult: 0.0, hpRate:  0.11 },
    { id: 'craft',          label: 'Crafting in town',       weight: 0.10, group: 'solo',  inTown: true,  reach: 0.0,  goal: 'camp-supply-run', xpMult: 0.15, goldMult: 0.9,  repMult: 0.0, hpRate:  0.02 },
    { id: 'gather',         label: 'Gathering resources',    weight: 0.15, group: 'solo',  inTown: false, reach: 0.35, goal: 'road-patrol',     xpMult: 0.25, goldMult: 1.1,  repMult: 0.2, hpRate: -0.02 },
    { id: 'solo_adventure', label: 'Adventuring solo',       weight: 0.20, group: 'solo',  inTown: false, reach: 0.6,  goal: 'questing',        xpMult: 1.0,  goldMult: 1.0,  repMult: 0.6, hpRate: -0.04 },
    { id: 'small_group',    label: 'On a small-group hunt',  weight: 0.25, group: 'small', inTown: false, reach: 0.8,  goal: 'questing',        xpMult: 1.4,  goldMult: 1.25, repMult: 1.0, hpRate: -0.03 },
    { id: 'large_group',    label: 'On a large-group raid',  weight: 0.15, group: 'large', inTown: false, reach: 1.0,  goal: 'dungeon-prep',    xpMult: 1.9,  goldMult: 1.6,  repMult: 1.5, hpRate: -0.06 }
  ]);

  // Abstract-sim tuning (per in-game hour unless noted).
  const SIM = Object.freeze({
    maxLevel: 20,
    xpBase: 55,          // base XP/hour (× activity xpMult)
    goldBase: 9,         // base gold/hour (× activity goldMult)
    repBase: 0.15,       // base reputation/hour (× activity repMult)
    travelFactor: 0.3,   // fraction of gains earned while still walking to the site
    goldSoftCap: 5000,
    gearFindPerHour: 0.4 // slow gear-score creep from adventuring finds
  });
  function xpForAdventurerLevel(level) { return 80 + Math.max(0, Math.floor(Number(level) || 1)) * 45; }

  // Economy / mercenaries (Phase 5). Adventurer mercs are ABSTRACT record data
  // (no entity is spawned for an off-screen adventurer) but use the real
  // DR.MERC_ROLES hire costs so the economy stays consistent with the player's.
  const ECON = Object.freeze({
    poorThreshold: 20,      // below this an adventurer gathers instead of adventuring
    maxMercs: 2,            // per adventurer
    mercUpkeepFrac: 0.3,   // daily upkeep = ceil(hireCost × this)
    repairFrac: 0.02,      // daily repair = floor(gearScore × this)
    sellGearPerLevel: 5,   // gold from selling replaced gear on a level-up
    soloHireGoldMin: 120   // a lone adventurer only hires a bodyguard if this rich
  });
  const MERC_FOR_CATEGORY = Object.freeze({ tank: 'guardian', healer: 'cleric', dps: 'scout' });
  function roleCategory(rec) {
    const r = String(rec?.role || '').toLowerCase();
    if (r.includes('tank')) return 'tank';
    if (r.includes('heal')) return 'healer';
    return 'dps';
  }
  function mercHireCost(roleKey) {
    const m = (DR.MERC_ROLES || {})[roleKey];
    return m ? Math.max(1, Math.floor(Number(m.cost) || 25)) : 25;
  }
  function mercUpkeep(roleKey) { return Math.ceil(mercHireCost(roleKey) * ECON.mercUpkeepFrac); }

  // Death / recovery loop (Phase 6). A dormant adventurer fighting at critical HP
  // can fall, go to the spirit healer, take a resurrection penalty, and recover —
  // healer support (own role / cleric merc / party healer) sharply lowers the risk.
  const DEATH = Object.freeze({
    hpThreshold: 0.15,       // death only rolls below this HP
    chancePerHourBase: 0.05, // × activity danger, per in-game hour
    dangerRef: 0.06,         // reference |hpRate| (large-group) = danger 1.0
    recoveryHours: 8,        // in-game hours at the spirit healer
    reviveHp: 0.3,           // HP fraction on revival (recovers from there)
    xpPenaltyFrac: 0.4,      // lose this fraction of the current level's XP need
    goldPenaltyFrac: 0.25,   // lose this fraction of gold (corpse/res cost)
    healerMitigation: 0.4    // HP-loss & death-chance multiplier when healer-backed
  });

  // Reputation → standing tiers (Phase 7). As adventurers do deeds their rep
  // climbs through these; reaching Renowned (rank 3) makes them a recognized name.
  const REP_TIERS = Object.freeze([
    { min: 300, name: 'Legendary', rank: 5 },
    { min: 150, name: 'Famed',     rank: 4 },
    { min: 75,  name: 'Renowned',  rank: 3 },
    { min: 40,  name: 'Respected', rank: 2 },
    { min: 20,  name: 'Known',     rank: 1 },
    { min: 0,   name: 'Unproven',  rank: 0 }
  ]);
  const NOTABLE_RANK = 3; // Renowned and above are worth announcing / earn a title
  function standingFor(rep) {
    const r = Number(rep) || 0;
    for (const t of REP_TIERS) if (r >= t.min) return t;
    return REP_TIERS[REP_TIERS.length - 1];
  }
  // Class-appropriate earned epithets for adventurers who rise to renown untitled.
  const EPITHETS = Object.freeze({
    fighter: ['the Bold', 'Ironhand', 'the Bulwark'], paladin: ['the Steadfast', 'Dawnward'],
    cleric: ['the Devout', 'the Merciful', 'Lightbringer'], druid: ['Wildheart', 'the Green'],
    rogue: ['the Quick', 'Nightblade', 'the Shadow'], enchanter: ['the Beguiler', 'Mindweaver'],
    summoner: ['the Binder', 'Packmaster'], bard: ['Silvertongue', 'the Melodious'],
    necromancer: ['the Grim', 'Bonelord'], ranger: ['the Hunter', 'Trailblazer'],
    wizard: ['the Arcane', 'Spellweaver'], assassin: ['the Silent', 'the Viper'],
    warden: ['Oakenshield', 'the Warden'], shaman: ['Stormcaller', 'the Ancestor']
  });
  function earnedTitleFor(rec) {
    const pool = EPITHETS[String(rec.className || '').toLowerCase()] || ['the Renowned'];
    const h = String(rec.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return pool[h % pool.length];
  }

  // Dynamic "world happenings" (Phase 8) that adventurers react to. There is no
  // dedicated world-boss/caravan system to hook, so this is a lightweight abstract
  // event: one runs at a time, adventurers of fitting level answer it at the next
  // dawn (travelling to it), and the sim rewards them there. reach = distance from
  // camp; durH = duration window in in-game hours; the sim rates behave like an
  // activity (goldMult high for caravans, repMult/danger high for the beast hunt).
  const WORLD_EVENTS = Object.freeze({
    caravan:      { name: 'merchant caravan', label: 'escorting a merchant caravan', levelMin: 1, reach: 0.5,  durH: [16, 28], xpMult: 0.6, goldMult: 2.2, repMult: 0.8, hpRate: -0.01,
                    startMsg: 'A merchant caravan winds through the Dark Woods — adventurers gather to escort and trade.' },
    beast:        { name: 'beast hunt',       label: 'hunting a rumored beast',       levelMin: 6, reach: 0.85, durH: [10, 20], xpMult: 1.6, goldMult: 1.3, repMult: 1.8, hpRate: -0.05,
                    startMsg: 'A great beast is rumored to stalk the deep woods — the bold answer the call.' },
    call_to_arms: { name: 'call to arms',     label: 'answering a call to arms',      levelMin: 4, reach: 0.15, durH: [8, 16],  xpMult: 1.0, goldMult: 0.9, repMult: 1.4, hpRate: -0.03,
                    startMsg: 'Horns sound over the camp — a call to arms rallies nearby adventurers.' }
  });
  const EVENT_ACTIVITIES = Object.freeze(Object.fromEntries(Object.entries(WORLD_EVENTS).map(([k, v]) =>
    ['event_' + k, { id: 'event_' + k, inTown: false, group: 'small', xpMult: v.xpMult, goldMult: v.goldMult, repMult: v.repMult, hpRate: v.hpRate }])));
  const EVENT_RESPONSE_CHANCE = 0.55;
  const ACTIVITY_BY_ID = Object.freeze(Object.fromEntries(ACTIVITIES.map(a => [a.id, a])));
  const PARTY_SIZE = Object.freeze({ small: [3, 4], large: [5, 6] });

  function pickActivity(rnd) {
    const total = ACTIVITIES.reduce((s, a) => s + a.weight, 0);
    let roll = (rnd || Math.random)() * total;
    for (const a of ACTIVITIES) { roll -= a.weight; if (roll <= 0) return a; }
    return ACTIVITIES[ACTIVITIES.length - 1];
  }

  // Home settlement(s). Blackroot is one Dark Woods overworld + instances, so the
  // camp/spawn is the shared home town for now.
  const HOME_TOWNS = Object.freeze({
    lantern_camp: { id: 'lantern_camp', name: 'Lantern Camp' }
  });
  const DEFAULT_HOME = 'lantern_camp';

  // Curated cast of a dozen recurring adventurers. The first 8 mirror
  // BOT_START_PROFILES (id/name/class/role/personality) so Phase 2 can fold the
  // live squad bots into these records; the last 4 are new distant adventurers
  // (Arlen the Hunter and Mira the Cleric are the spec's named examples).
  const SEED_ADVENTURERS = Object.freeze([
    { id: 'bot-guardian-bram', name: 'Bram',   race: 'human',   className: 'Paladin',     role: 'tank',                  personalityId: 'steady',   level: 8,  reputation: 34, squadBot: true },
    { id: 'bot-cleric-talia',  name: 'Talia',  race: 'human',   className: 'Cleric',      role: 'healer',                personalityId: 'cautious', level: 7,  reputation: 28, squadBot: true },
    { id: 'bot-rogue-riven',   name: 'Riven',  race: 'elf',     className: 'Rogue',       role: 'meleeDps',              personalityId: 'witty',    level: 7,  reputation: 22, squadBot: true },
    { id: 'bot-adept-luma',    name: 'Luma',   race: 'elf',     className: 'Enchanter',   role: 'control_support',       personalityId: 'steady',   level: 6,  reputation: 18, squadBot: true },
    { id: 'bot-druid-elowen',  name: 'Elowen', race: 'human',   className: 'Druid',       role: 'hybrid_healer_damage',  personalityId: 'cautious', level: 6,  reputation: 20, squadBot: true },
    { id: 'bot-summoner-orin', name: 'Orin',   race: 'ratkin',  className: 'Summoner',    role: 'pet_caster',            personalityId: 'bold',     level: 7,  reputation: 16, squadBot: true },
    { id: 'bot-bard-fenn',     name: 'Fenn',   race: 'human',   className: 'Bard',        role: 'support_control',       personalityId: 'witty',    level: 6,  reputation: 24, squadBot: true },
    { id: 'bot-necro-varek',   name: 'Varek',  race: 'human',   className: 'Necromancer', role: 'pet_dot_caster',        personalityId: 'grim',     level: 8,  reputation: 19, squadBot: true },
    { id: 'adv-ranger-arlen',  name: 'Arlen',  race: 'human',   className: 'Ranger',      role: 'rangedDps',             personalityId: 'steady',   level: 9,  reputation: 41, title: 'the Hunter' },
    { id: 'adv-cleric-mira',   name: 'Mira',   race: 'elf',     className: 'Cleric',      role: 'healer',                personalityId: 'cautious', level: 8,  reputation: 37, title: 'the Kind' },
    { id: 'adv-fighter-doran', name: 'Doran',  race: 'human',   className: 'Fighter',     role: 'tank',                  personalityId: 'bold',     level: 9,  reputation: 30 },
    { id: 'adv-wizard-sable',  name: 'Sable',  race: 'ratkin',  className: 'Wizard',      role: 'casterDps',             personalityId: 'grim',     level: 10, reputation: 33, title: 'the Grey' }
  ]);

  function clampInt(v, min, max, fallback = min) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  }
  function validRace(race) {
    const races = DR.RACES || {};
    const key = String(race || '').toLowerCase();
    return races[key] ? key : (races.human ? 'human' : key || 'human');
  }
  // Gear score is derived from level for now (Phase 6 gives it real progression).
  function gearScoreForLevel(level) {
    return clampInt(level, 1, 60) * 12;
  }

  // World location of the adventurer. x/y are null until assigned a walkable
  // overworld anchor (Phase 2 ensureAdventurerWorldPositions); Phase 3 will make
  // these move with a travel plan.
  function normalizeLocation(src) {
    const s = (src && typeof src === 'object') ? src : {};
    const x = Number(s.x); const y = Number(s.y);
    return {
      x: Number.isFinite(x) ? x : null,
      y: Number.isFinite(y) ? y : null,
      zone: String(s.zone || 'overworld'),
      traveling: Boolean(s.traveling)
    };
  }

  function normalizeRecord(raw, seedDefault = {}) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    const seed = seedDefault || {};
    const id = String(src.id || seed.id || `adv-${Math.random().toString(36).slice(2, 8)}`);
    const level = clampInt(src.level ?? seed.level, 1, 60, 1);
    const homeId = String(src.homeTownId || seed.homeTownId || DEFAULT_HOME);
    const home = HOME_TOWNS[homeId] || HOME_TOWNS[DEFAULT_HOME];
    const repVal = clampInt(src.reputation ?? seed.reputation, 0, 100000, 0);
    const tier = standingFor(repVal);
    return {
      schema: POPULATION_SCHEMA_VERSION,
      id,
      name: String(src.name || seed.name || 'Adventurer').slice(0, 24),
      race: validRace(src.race || seed.race),
      className: String(src.className || seed.className || 'Fighter'),
      role: String(src.role || seed.role || 'meleeDps'),
      personalityId: String(src.personalityId || seed.personalityId || 'steady'),
      level,
      xp: Math.max(0, Math.floor(Number(src.xp) || 0)),
      gold: Math.max(0, Math.floor(Number(src.gold ?? seed.gold ?? (40 + level * 15)) || 0)),
      reputation: repVal,
      // Standing tier + earned title (Phase 7). standingRank drives edge-triggered
      // milestone announcements; titleEarned marks a rep-earned (vs seed) title.
      standing: tier.name,
      standingRank: Math.max(0, Math.floor(Number(src.standingRank ?? tier.rank))),
      titleEarned: Boolean(src.titleEarned),
      title: (src.title ?? seed.title) ? String(src.title || seed.title).slice(0, 32) : '',
      homeTownId: home.id,
      homeTownName: home.name,
      gearScore: clampInt(src.gearScore, 0, 100000, gearScoreForLevel(level)),
      // Daily activity (Phase 3). activityId keys into ACTIVITIES; activityLabel
      // is the display string; groupId links party members; travelTarget is where
      // the record is walking today (dormant records move toward it).
      activity: String(src.activity || 'idle'),
      activityId: String(src.activityId || ''),
      activityLabel: String(src.activityLabel || 'At rest in ' + home.name),
      groupId: src.groupId ? String(src.groupId) : null,
      travelTarget: (src.travelTarget && Number.isFinite(Number(src.travelTarget.x)) && Number.isFinite(Number(src.travelTarget.y)))
        ? { x: Number(src.travelTarget.x), y: Number(src.travelTarget.y) } : null,
      state: String(src.state || 'in_town'),
      region: String(src.region || home.name),
      location: normalizeLocation(src.location),
      questRef: (src.questRef && typeof src.questRef === 'object') ? { ...src.questRef } : null,
      hpPct: Math.max(0, Math.min(1, Number(src.hpPct ?? 1) || 1)),
      // Death/recovery (Phase 6). deaths is a lifetime count; reviveAtHour is the
      // in-game hour a downed adventurer returns; hasHealerSupport is recomputed
      // each dawn for the sim.
      deaths: Math.max(0, Math.floor(Number(src.deaths) || 0)),
      reviveAtHour: Number.isFinite(Number(src.reviveAtHour)) ? Number(src.reviveAtHour) : null,
      hasHealerSupport: Boolean(src.hasHealerSupport),
      // materialized/botId are runtime links; never trusted from a save (the bot
      // does not exist yet at load), so they reset to false/null and the bridge
      // re-binds/re-promotes as the player moves.
      materialized: false,
      botId: null,
      // Hired mercenaries (Phase 5) — abstract data keyed by DR.MERC_ROLES.
      mercs: Array.isArray(src.mercs)
        ? src.mercs.filter(m => m && (DR.MERC_ROLES || {})[m.roleKey])
            .map(m => ({ roleKey: String(m.roleKey), hiredDay: Math.max(0, Math.floor(Number(m.hiredDay) || 0)) }))
            .slice(0, 2)
        : [],
      squadBot: Boolean(src.squadBot ?? seed.squadBot),
      guildId: src.guildId ? String(src.guildId) : null,
      lastDawnDay: Math.max(0, Math.floor(Number(src.lastDawnDay) || 0))
    };
  }

  DR.AdventurerPopulationSystem = {
    SEED_ADVENTURERS,
    HOME_TOWNS,
    install(Game) {
      // Build the registry once per world. Idempotent: an existing (restored)
      // population is kept; a missing/empty one is seeded from the curated cast.
      Game.prototype.initAdventurerPopulation = function() {
        if (!(this.adventurerPopulation instanceof Map)) this.adventurerPopulation = new Map();
        if (this.adventurerPopulation.size > 0) return this.adventurerPopulation;
        for (const seed of SEED_ADVENTURERS) {
          const rec = normalizeRecord(seed, seed);
          this.adventurerPopulation.set(rec.id, rec);
        }
        this._adventurerPopulationSeededAt = (this.getWorldTimeInfo?.()?.day) || 1;
        return this.adventurerPopulation;
      };

      Game.prototype.adventurerRecord = function(id) {
        return (this.adventurerPopulation instanceof Map) ? this.adventurerPopulation.get(String(id)) || null : null;
      };

      Game.prototype.adventurerPopulationList = function() {
        if (!(this.adventurerPopulation instanceof Map)) return [];
        return Array.from(this.adventurerPopulation.values());
      };

      // --- Persistence (migration-safe) ---
      Game.prototype.serializeAdventurerPopulation = function() {
        if (!(this.adventurerPopulation instanceof Map) || this.adventurerPopulation.size === 0) return null;
        return {
          schema: POPULATION_SCHEMA_VERSION,
          records: this.adventurerPopulationList().map(r => ({ ...r }))
        };
      };

      Game.prototype.restoreAdventurerPopulation = function(data) {
        this.adventurerPopulation = new Map();
        const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [];
        const seedById = new Map(SEED_ADVENTURERS.map(s => [s.id, s]));
        for (const raw of records) {
          const rec = normalizeRecord(raw, seedById.get(String(raw?.id)) || {});
          this.adventurerPopulation.set(rec.id, rec);
        }
        // Backfill any curated cast members missing from an older save.
        for (const seed of SEED_ADVENTURERS) {
          if (!this.adventurerPopulation.has(seed.id)) {
            const rec = normalizeRecord(seed, seed);
            this.adventurerPopulation.set(rec.id, rec);
          }
        }
        return this.adventurerPopulation;
      };

      // --- /who viewer (Phase 1 visibility) ---
      Game.prototype.adventurerWhoCommand = function() {
        this.initAdventurerPopulation?.();
        const list = this.adventurerPopulationList()
          .slice()
          .sort((a, b) => (b.reputation - a.reputation) || (b.level - a.level) || a.name.localeCompare(b.name));
        if (!list.length) { this.logSystem?.('No adventurers are known yet.'); return true; }
        this.logSystem?.(`Adventurers abroad in the Dark Woods (${list.length}):`);
        for (const r of list) {
          const named = r.title ? `${r.name} ${r.title}` : r.name;
          const raceName = (DR.RACES?.[r.race]?.name) || r.race;
          const here = r.materialized ? '● ' : '';
          const mercs = (r.mercs?.length) ? ` · +${r.mercs.length} merc${r.mercs.length > 1 ? 's' : ''}` : '';
          const fallen = r.deaths > 0 ? ` · †${r.deaths}` : '';
          const standing = r.standing || standingFor(r.reputation).name;
          this.logSystem?.(`  ${here}${named} — ${raceName} ${r.className} (Lv ${r.level}) · ${Math.floor(r.gold)}g · Rep ${Math.floor(r.reputation)} [${standing}]${mercs}${fallen} · ${r.activityLabel}`);
        }
        return true;
      };

      Game.prototype.adventurerPopulationSummary = function() {
        const list = this.adventurerPopulationList();
        return {
          count: list.length,
          schema: POPULATION_SCHEMA_VERSION,
          avgLevel: list.length ? Math.round(list.reduce((s, r) => s + r.level, 0) / list.length) : 0,
          totalReputation: list.reduce((s, r) => s + r.reputation, 0),
          materialized: list.filter(r => r.materialized).length,
          names: list.map(r => r.name)
        };
      };

      // Economy snapshot (Phase 5) — for tuning/inspection.
      Game.prototype.adventurerEconomySummary = function() {
        const list = this.adventurerPopulationList();
        const gold = list.map(r => r.gold);
        const mercs = list.flatMap(r => r.mercs || []);
        return {
          totalGold: Math.round(gold.reduce((s, g) => s + g, 0)),
          avgGold: list.length ? Math.round(gold.reduce((s, g) => s + g, 0) / list.length) : 0,
          minGold: Math.round(Math.min(...gold, 0)),
          maxGold: Math.round(Math.max(...gold, 0)),
          poor: list.filter(r => r.gold < ECON.poorThreshold).length,
          totalMercs: mercs.length,
          mercsByRole: mercs.reduce((m, x) => { m[x.roleKey] = (m[x.roleKey] || 0) + 1; return m; }, {})
        };
      };

      // Recompute an adventurer's reputation standing (Phase 7). Edge-triggered:
      // rising into a new notable tier earns an epithet (if untitled) and spreads
      // word of the name. Rank is persisted so nothing re-announces after a reload.
      Game.prototype.updateAdventurerStanding = function(rec) {
        if (!rec) return;
        const tier = standingFor(rec.reputation);
        rec.standing = tier.name;
        const prevRank = Number(rec.standingRank || 0);
        if (tier.rank <= prevRank) { rec.standingRank = tier.rank; return; }
        rec.standingRank = tier.rank;
        if (tier.rank >= NOTABLE_RANK) {
          if (!rec.title) {
            rec.title = earnedTitleFor(rec);
            rec.titleEarned = true;
            this.logSystem?.(`${rec.name} has earned the title "${rec.title}".`);
          }
          const named = rec.title ? `${rec.name} ${rec.title}` : rec.name;
          this.logSystem?.(`Word spreads of ${named} — now ${tier.name} across the Dark Woods.`);
        }
      };

      // The most renowned adventurers (Phase 7) — the recurring recognizable names.
      Game.prototype.adventurerRenownList = function(limit = 5) {
        return this.adventurerPopulationList()
          .slice()
          .sort((a, b) => b.reputation - a.reputation)
          .slice(0, Math.max(0, limit))
          .map(r => ({ name: r.title ? `${r.name} ${r.title}` : r.name, standing: standingFor(r.reputation).name, reputation: Math.floor(r.reputation), level: r.level }));
      };

      // Dynamic world-event lifecycle (Phase 8): one happening at a time, spaced out
      // on the in-game clock. Adventurers respond at the next dawn (see the roll).
      Game.prototype.updateAdventurerWorldEvents = function(dt) {
        if (!this.started) return;
        const info = this.getWorldTimeInfo?.(); if (!info) return;
        const hoursNow = (Math.max(1, info.day) - 1) * 24 + (Number(info.minuteOfDay) || 0) / 60;
        const ev = this.adventurerWorldEvent;
        if (ev) {
          if (hoursNow >= ev.endsAtHour) {
            this.logSystem?.(`The ${ev.def.name} has passed.`);
            this.adventurerWorldEvent = null;
            // Gap before the next happening: 6–16 in-game hours (~1–2.7 real hours
            // at 4h/in-game-day), so the world nearly always has something afoot
            // without back-to-back spam. Events are long-lived, so this reads as a
            // steadily active world.
            this._advNextEventHour = hoursNow + 6 + Math.random() * 10;
          }
          return;
        }
        if (this._advNextEventHour == null) { this._advNextEventHour = hoursNow + 3 + Math.random() * 5; return; }
        if (hoursNow < this._advNextEventHour) return;
        const keys = Object.keys(WORLD_EVENTS);
        const type = keys[Math.floor(Math.random() * keys.length)];
        const def = WORLD_EVENTS[type];
        const camp = this.defaultBotSpawnAnchor?.() || { x: (DR.CONFIG?.START_X || 100) + 0.5, y: (DR.CONFIG?.START_Y || 100) + 0.5 };
        const angle = Math.random() * Math.PI * 2;
        const radius = 90 * def.reach;
        const pt = this.findBotSpawnPoint?.(camp, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }, { kind: 'bot' }) || { x: camp.x, y: camp.y };
        const dur = def.durH[0] + Math.random() * (def.durH[1] - def.durH[0]);
        this.adventurerWorldEvent = { type, def, x: pt.x, y: pt.y, endsAtHour: hoursNow + dur, respondents: new Set() };
        this.logSystem?.(def.startMsg);
      };

      Game.prototype.adventurerWorldEventInfo = function() {
        const ev = this.adventurerWorldEvent;
        if (!ev) return null;
        return { type: ev.type, name: ev.def.name, x: Math.round(ev.x), y: Math.round(ev.y), endsAtHour: Math.round(ev.endsAtHour), respondents: ev.respondents.size };
      };

      // ---------------------------------------------------------------------
      // PHASE 2 — promote/demote bridge (the two-tier core).
      // Nearby non-squad records materialize into full BotPlayer entities and
      // demote back to data when the player leaves. The 8 squad records bind to
      // the existing BOT_START_PROFILES bots (always materialized) so they are
      // never doubled. Only a handful of records are ever checked, throttled, so
      // frame cost is flat regardless of population size.
      // ---------------------------------------------------------------------

      // Give each non-squad record a deterministic, walkable overworld anchor
      // (Phase 3 will make these move). Squad records get their position synced
      // from their live bot instead.
      Game.prototype.ensureAdventurerWorldPositions = function() {
        if (!(this.adventurerPopulation instanceof Map)) return;
        const base = this.defaultBotSpawnAnchor?.() || { x: (DR.CONFIG?.START_X || 100) + 0.5, y: (DR.CONFIG?.START_Y || 100) + 0.5 };
        let i = 0;
        for (const rec of this.adventurerPopulation.values()) {
          if (rec.squadBot) { i++; continue; }
          if (Number.isFinite(rec.location?.x) && Number.isFinite(rec.location?.y)) { i++; continue; }
          // scatter distant adventurers on a ring at adventuring distance, at a
          // deterministic angle per record so placement is stable across runs
          const angle = (i * 2.399963); // golden-angle spread
          const radius = 16 + (i % 4) * 7;
          const offset = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
          const pt = this.findBotSpawnPoint?.(base, offset, { kind: 'bot' }) || { x: base.x + offset.x, y: base.y + offset.y };
          rec.location = normalizeLocation({ x: pt.x, y: pt.y, zone: 'overworld' });
          i++;
        }
      };

      // Write live bot state back onto the record (called on demote + while a
      // squad bot is bound). Conservative: position/hp/activity always; level/gold
      // only mirror the live squad bots (distant records keep record authority for
      // the future abstract sim).
      Game.prototype.syncAdventurerRecordFromBot = function(rec, bot) {
        if (!rec || !bot) return;
        if (Number.isFinite(bot.x) && Number.isFinite(bot.y)) {
          rec.location = normalizeLocation({ x: bot.x, y: bot.y, zone: bot.zone || 'overworld' });
        }
        if (Number(bot.maxHp) > 0) rec.hpPct = Math.max(0, Math.min(1, Number(bot.hp) / Number(bot.maxHp)));
        if (bot.currentActivityLabel) rec.activityLabel = String(bot.currentActivityLabel);
        if (rec.squadBot) {
          if (Number.isFinite(bot.level)) rec.level = Math.max(1, Math.min(60, Math.floor(bot.level)));
          if (Number.isFinite(bot.gold)) rec.gold = Math.max(0, Math.floor(bot.gold));
        }
      };

      // Spawn a full BotPlayer for a record at its world anchor. Returns the bot
      // or null (invalid spot — retried next tick).
      Game.prototype.promoteAdventurerRecord = function(rec) {
        if (!rec || rec.squadBot) return null;
        if (!Number.isFinite(rec.location?.x) || !Number.isFinite(rec.location?.y)) return null;
        const profile = {
          id: rec.id,
          name: rec.name,
          className: rec.className,
          role: rec.role,
          personalityId: rec.personalityId,
          x: rec.location.x,
          y: rec.location.y,
          zone: rec.location.zone || 'overworld',
          reputation: rec.reputation,
          behaviorGoal: ACTIVITY_BY_ID[rec.activityId]?.goal || 'road-patrol',
          worldAdventurer: true
        };
        const bot = this.spawnBotPlayer?.(profile, { anchor: { x: rec.location.x, y: rec.location.y } });
        if (!bot) return null;
        bot.adventurerRecordId = rec.id;
        bot.worldAdventurer = true;
        if (rec.title) bot.adventurerTitle = rec.title;
        rec.materialized = true;
        rec.botId = String(bot.botId || bot.remoteId || bot.id || rec.id);
        return bot;
      };

      // Throttled promote/demote pass with distance hysteresis.
      Game.prototype.updateAdventurerMaterialization = function(dt) {
        if (!this.started || !this.player || !(this.adventurerPopulation instanceof Map)) return;
        this._advMatTimer = (this._advMatTimer || 0) + (Number(dt) || 0);
        if (this._advMatTimer < 0.5) return;
        this._advMatTimer = 0;
        this.ensureAdventurerWorldPositions?.();

        const zone = this.currentZone || 'overworld';
        const px = this.player.x, py = this.player.y;
        const promoteR = 26, demoteR = 34; // tiles; gap = hysteresis against thrash

        // live bots keyed by their bound record id
        const botByRecordId = new Map();
        for (const b of this.botPlayers || []) {
          const rid = b.adventurerRecordId || b.botId || b.remoteId || b.id;
          if (rid) botByRecordId.set(String(rid), b);
        }

        for (const rec of this.adventurerPopulation.values()) {
          const live = botByRecordId.get(String(rec.id)) || null;

          if (rec.squadBot) {
            // Always-materialized squad bots: bind + mirror. Never promote/demote.
            if (live && live.alive !== false && live.botState !== 'dismissed') {
              rec.materialized = true;
              rec.botId = String(live.botId || live.remoteId || live.id || rec.id);
              this.syncAdventurerRecordFromBot(rec, live);
            } else {
              rec.materialized = false;
            }
            continue;
          }

          if (live && live.alive !== false && live.botState !== 'dismissed') {
            // Materialized distant adventurer — demote if the player has moved far
            // away or changed zone.
            rec.materialized = true;
            rec.botId = String(live.botId || live.remoteId || live.id || rec.id);
            const sameZone = (live.zone || 'overworld') === zone;
            const d = sameZone ? Math.hypot(live.x - px, live.y - py) : Infinity;
            if (d > demoteR) {
              this.syncAdventurerRecordFromBot(rec, live);
              this.removeBotPlayer?.(live);
              rec.materialized = false;
              rec.botId = null;
            }
          } else {
            // Not materialized — promote if the player is near its overworld anchor.
            rec.materialized = false;
            rec.botId = null;
            if ((rec.location?.zone || 'overworld') !== zone) continue;
            const d = Math.hypot(Number(rec.location.x) - px, Number(rec.location.y) - py);
            if (d <= promoteR) this.promoteAdventurerRecord?.(rec);
          }
        }
      };

      // ---------------------------------------------------------------------
      // PHASE 3 — daily activity scheduler. Each in-game dawn every adventurer
      // rolls a primary activity (rest/craft/gather/solo/small/large per the
      // spec distribution), forms/joins a party, and picks a destination to
      // travel to. Dormant distant records walk toward that destination over the
      // day (so where you find them shifts); materialized ones act it out via the
      // existing bot AI (behaviorGoal set on promote).
      // ---------------------------------------------------------------------

      // A destination for today's activity: in-town activities stay at the camp;
      // adventuring ones pick a walkable point at a distance scaled by activity
      // reach and the adventurer's level (deeper = tougher, for higher levels).
      Game.prototype.pickAdventurerDestination = function(rec, activity, camp) {
        camp = camp || this.defaultBotSpawnAnchor?.() || { x: (DR.CONFIG?.START_X || 100) + 0.5, y: (DR.CONFIG?.START_Y || 100) + 0.5 };
        if (!activity || activity.inTown || activity.reach <= 0) {
          return { x: camp.x + (Math.random() * 4 - 2), y: camp.y + (Math.random() * 4 - 2) };
        }
        const levelFactor = Math.max(0.2, Math.min(1, (Number(rec.level) || 1) / 12));
        const radius = 90 * activity.reach * (0.5 + 0.5 * levelFactor);
        const angle = Math.random() * Math.PI * 2;
        const offset = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        const pt = this.findBotSpawnPoint?.(camp, offset, { kind: 'bot' }) || { x: camp.x + offset.x, y: camp.y + offset.y };
        return { x: pt.x, y: pt.y };
      };

      // Roll everyone's activity for the day, form parties, assign destinations.
      Game.prototype.rollAdventurerDailyActivities = function() {
        if (!(this.adventurerPopulation instanceof Map)) return 0;
        this.ensureAdventurerWorldPositions?.();
        const camp = this.defaultBotSpawnAnchor?.() || { x: (DR.CONFIG?.START_X || 100) + 0.5, y: (DR.CONFIG?.START_Y || 100) + 0.5 };
        const day = (this.getWorldTimeInfo?.()?.day) || 1;
        const records = this.adventurerPopulationList();
        const event = this.adventurerWorldEvent || null;

        const smallPool = [], largePool = [];
        for (const rec of records) {
          // A downed adventurer stays at the spirit healer until it revives (the
          // abstract sim flips state back to in_town when reviveAtHour passes).
          if (!rec.squadBot && rec.state === 'recovering') {
            rec.activityId = 'recovering';
            rec.activity = 'solo';
            rec.activityLabel = 'Recovering at the spirit healer';
            rec.groupId = null;
            rec.travelTarget = null;
            if (rec.location) rec.location.traveling = false;
            rec.lastDawnDay = day;
            continue;
          }
          // Dynamic event: adventurers of fitting level answer the call, dropping
          // their usual plans to travel to the happening.
          if (event && !rec.squadBot && rec.level >= event.def.levelMin && Math.random() < EVENT_RESPONSE_CHANCE) {
            rec.activityId = 'event_' + event.type;
            rec.activity = 'event';
            rec.activityLabel = event.def.label;
            rec.groupId = null;
            rec.lastDawnDay = day;
            rec.travelTarget = { x: event.x, y: event.y };
            if (rec.location) rec.location.traveling = true;
            rec.state = 'responding';
            rec.gold = Math.max(0, rec.gold - (12 + rec.level * 2)); // supplies for the trip
            event.respondents.add(rec.id);
            continue;
          }
          let a = pickActivity();
          // "Poor bots may gather resources instead" — a broke adventurer gathers
          // (income, low spend) rather than paying to go adventuring.
          if (!rec.squadBot && rec.gold < ECON.poorThreshold && !a.inTown && a.id !== 'gather') a = ACTIVITY_BY_ID.gather;
          rec.activityId = a.id;
          rec.activity = a.group;
          rec.activityLabel = a.label;
          rec.groupId = null;
          rec.lastDawnDay = day;
          // Only the world (non-squad) adventurers form travelling parties; squad
          // records stay with the player and just carry the activity for display.
          if (rec.squadBot) continue;
          if (a.group === 'small') smallPool.push(rec);
          else if (a.group === 'large') largePool.push(rec);
        }

        let partyN = 0;
        const formParties = (pool, [minS, maxS]) => {
          let i = 0;
          while (i < pool.length) {
            const remaining = pool.length - i;
            const size = Math.min(remaining, minS + Math.floor(Math.random() * (maxS - minS + 1)));
            if (size < 2) break; // a lone leftover just adventures on its own
            const gid = `party-d${day}-${++partyN}`;
            for (const m of pool.slice(i, i + size)) m.groupId = gid;
            i += size;
          }
        };
        formParties(smallPool, PARTY_SIZE.small);
        formParties(largePool, PARTY_SIZE.large);

        // Mercenaries: fill a party's missing tank/healer with a hired merc, paid
        // by the richest member who can afford it; a wealthy lone adventurer hires
        // a bodyguard of the role it lacks.
        const partyMembers = {};
        for (const rec of records) if (rec.groupId) (partyMembers[rec.groupId] = partyMembers[rec.groupId] || []).push(rec);
        for (const members of Object.values(partyMembers)) {
          const covered = new Set(members.map(roleCategory));
          for (const gap of ['tank', 'healer']) {
            if (covered.has(gap)) continue;
            const roleKey = MERC_FOR_CATEGORY[gap];
            const cost = mercHireCost(roleKey);
            const payer = members
              .filter(m => m.gold >= cost && m.gold >= ECON.poorThreshold && (m.mercs?.length || 0) < ECON.maxMercs)
              .sort((x, y) => y.gold - x.gold)[0];
            if (payer) { payer.gold -= cost; payer.mercs.push({ roleKey, hiredDay: day }); covered.add(gap); }
          }
        }
        for (const rec of records) {
          if (rec.squadBot || rec.groupId || rec.activityId !== 'solo_adventure') continue;
          if (rec.gold < ECON.soloHireGoldMin || (rec.mercs?.length || 0) >= ECON.maxMercs) continue;
          const gap = roleCategory(rec) === 'tank' ? 'healer' : 'tank';
          const roleKey = MERC_FOR_CATEGORY[gap];
          const cost = mercHireCost(roleKey);
          if (rec.gold >= cost) { rec.gold -= cost; rec.mercs.push({ roleKey, hiredDay: day }); }
        }

        // Healer support (Phase 6) drives survivability in the sim: own healer
        // role, a hired cleric, or a healer in the party.
        for (const rec of records) {
          if (rec.squadBot) continue;
          const selfHealer = roleCategory(rec) === 'healer';
          const mercHealer = (rec.mercs || []).some(m => m.roleKey === 'cleric');
          const partyHealer = rec.groupId && partyMembers[rec.groupId]
            ? partyMembers[rec.groupId].some(m => roleCategory(m) === 'healer' || (m.mercs || []).some(x => x.roleKey === 'cleric'))
            : false;
          rec.hasHealerSupport = selfHealer || mercHealer || partyHealer;
        }

        const destForParty = new Map();
        for (const rec of records) {
          if (rec.squadBot) { rec.travelTarget = null; continue; } // squad follows the player / its live AI
          if (rec.state === 'recovering') { rec.travelTarget = null; if (rec.location) rec.location.traveling = false; continue; }
          if (rec.state === 'responding') continue; // event responders already have a destination + spend
          const a = ACTIVITY_BY_ID[rec.activityId] || ACTIVITIES[0];
          let target;
          if (rec.groupId) {
            target = destForParty.get(rec.groupId);
            if (!target) { target = this.pickAdventurerDestination(rec, a, camp); destForParty.set(rec.groupId, target); }
          } else {
            target = this.pickAdventurerDestination(rec, a, camp);
          }
          rec.travelTarget = target;
          rec.state = a.inTown ? 'in_town' : 'traveling';
          if (target && rec.location) rec.location.traveling = true;
          // Daily spend: merc upkeep (unpayable mercs leave), supplies, repair.
          let upkeep = (rec.mercs || []).reduce((s, m) => s + mercUpkeep(m.roleKey), 0);
          while (rec.mercs.length && rec.gold < upkeep) upkeep -= mercUpkeep(rec.mercs.pop().roleKey);
          rec.gold = Math.max(0, rec.gold - upkeep);
          if (!a.inTown) rec.gold = Math.max(0, rec.gold - (12 + rec.level * 2)); // supplies
          rec.gold = Math.max(0, rec.gold - Math.floor(rec.gearScore * ECON.repairFrac)); // repair wear
        }
        // Social flourish (Phase 8): when several adventurers spend the day in
        // town, they gather — a light bit of living-world colour.
        const inTownCount = records.filter(r => !r.squadBot && ACTIVITY_BY_ID[r.activityId]?.inTown).length;
        if (inTownCount >= 3 && Math.random() < 0.4) this.logSystem?.('Several adventurers rest and swap stories around the campfire.');

        return records.length;
      };

      // Advance dormant, off-screen adventurers over in-game time: quest/grind XP
      // → level-ups, gold earned, gear-score creep, reputation from deeds, and HP
      // recovered (resting) or spent (adventuring). Cheap arithmetic over only the
      // dormant records — materialized ones progress through their live bot, squad
      // ones through the player's party — so cost stays flat as the roster grows.
      Game.prototype.updateAdventurerAbstractSim = function(dt) {
        if (!this.started || !(this.adventurerPopulation instanceof Map)) return;
        const info = this.getWorldTimeInfo?.(); if (!info) return;
        const hoursNow = (Math.max(1, info.day) - 1) * 24 + (Number(info.minuteOfDay) || 0) / 60;
        if (this._advSimHour == null) { this._advSimHour = hoursNow; return; }
        let dHours = hoursNow - this._advSimHour;
        this._advSimHour = hoursNow;
        if (dHours <= 0) return;
        dHours = Math.min(dHours, 6); // clamp big jumps (paused tab, day skip)

        for (const rec of this.adventurerPopulation.values()) {
          if (rec.squadBot || rec.materialized) continue;
          // At the spirit healer: return when the recovery window elapses.
          if (rec.state === 'recovering') {
            if (rec.reviveAtHour != null && hoursNow >= rec.reviveAtHour) {
              rec.state = 'in_town'; rec.hpPct = 1; rec.reviveAtHour = null;
              rec.activityLabel = 'Returned from the spirit healer';
            }
            continue;
          }
          const a = ACTIVITY_BY_ID[rec.activityId] || EVENT_ACTIVITIES[rec.activityId]; if (!a) continue;
          const traveling = !!rec.location?.traveling;
          const scale = (traveling ? SIM.travelFactor : 1) * dHours;

          if (a.xpMult > 0 && rec.level < SIM.maxLevel) {
            rec.xp += SIM.xpBase * a.xpMult * scale;
            let need = xpForAdventurerLevel(rec.level);
            while (rec.xp >= need && rec.level < SIM.maxLevel) {
              rec.xp -= need;
              rec.level += 1;
              rec.gearScore = Math.max(rec.gearScore, gearScoreForLevel(rec.level));
              rec.gold = Math.min(SIM.goldSoftCap, rec.gold + ECON.sellGearPerLevel * rec.level); // sold replaced gear
              need = xpForAdventurerLevel(rec.level);
            }
            if (rec.level >= SIM.maxLevel) rec.xp = 0;
          }
          if (a.goldMult > 0) rec.gold = Math.min(SIM.goldSoftCap, rec.gold + SIM.goldBase * a.goldMult * scale);
          if (a.hpRate) {
            // Healers/clerics soften HP loss (they don't reduce rest recovery).
            const rate = a.hpRate > 0 ? a.hpRate : a.hpRate * (rec.hasHealerSupport ? DEATH.healerMitigation : 1);
            rec.hpPct = Math.max(0.1, Math.min(1, rec.hpPct + rate * dHours));
          }
          if (a.repMult > 0 && !traveling) { rec.reputation += SIM.repBase * a.repMult * dHours; this.updateAdventurerStanding(rec); }
          if (!a.inTown && !traveling) rec.gearScore += SIM.gearFindPerHour * dHours;

          // Death roll: only for an adventurer actually at the site, at critical HP.
          if (!a.inTown && !traveling && rec.hpPct <= DEATH.hpThreshold) {
            const danger = Math.abs(a.hpRate || 0) / DEATH.dangerRef;
            const perHour = DEATH.chancePerHourBase * danger * (rec.hasHealerSupport ? DEATH.healerMitigation : 1);
            if (Math.random() < Math.min(0.9, perHour * dHours)) {
              rec.deaths += 1;
              rec.xp = Math.max(0, rec.xp - xpForAdventurerLevel(rec.level) * DEATH.xpPenaltyFrac);
              rec.gold = Math.max(0, Math.floor(rec.gold * (1 - DEATH.goldPenaltyFrac)));
              rec.hpPct = DEATH.reviveHp;
              rec.state = 'recovering';
              rec.reviveAtHour = hoursNow + DEATH.recoveryHours;
              rec.activityLabel = 'Recovering at the spirit healer';
              rec.travelTarget = null;
              const camp = this.defaultBotSpawnAnchor?.() || { x: (DR.CONFIG?.START_X || 100) + 0.5, y: (DR.CONFIG?.START_Y || 100) + 0.5 };
              if (rec.location) { rec.location.traveling = false; rec.location.x = camp.x; rec.location.y = camp.y; }
            }
          }
        }
      };

      // Per-frame: detect the in-game day rollover (→ re-roll) and walk dormant
      // distant records toward today's destination.
      Game.prototype.updateAdventurerDailySchedule = function(dt) {
        if (!this.started || !(this.adventurerPopulation instanceof Map)) return;
        const day = (this.getWorldTimeInfo?.()?.day) || 1;
        if (this._advScheduleDay !== day) {
          const firstRoll = this._advScheduleDay == null;
          this._advScheduleDay = day;
          this.rollAdventurerDailyActivities?.();
          if (!firstRoll) this.logSystem?.('A new day dawns over the Dark Woods — adventurers set out anew.');
        }
        this._advTravelTimer = (this._advTravelTimer || 0) + (Number(dt) || 0);
        if (this._advTravelTimer < 0.4) return;
        const step = this._advTravelTimer;
        this._advTravelTimer = 0;
        const speed = 5; // tiles/sec; dormant records are off-screen data
        for (const rec of this.adventurerPopulation.values()) {
          if (rec.squadBot || rec.materialized) continue; // live bots own their own movement
          if (!rec.location?.traveling || !rec.travelTarget) continue;
          if (!Number.isFinite(rec.location.x) || !Number.isFinite(rec.location.y)) continue;
          const dx = rec.travelTarget.x - rec.location.x, dy = rec.travelTarget.y - rec.location.y;
          const dist = Math.hypot(dx, dy);
          const move = speed * step;
          if (dist <= move || dist < 0.5) {
            rec.location.x = rec.travelTarget.x; rec.location.y = rec.travelTarget.y;
            rec.location.traveling = false; rec.travelTarget = null;
            rec.state = (ACTIVITY_BY_ID[rec.activityId]?.inTown) ? 'in_town' : 'adventuring';
          } else {
            rec.location.x += dx / dist * move; rec.location.y += dy / dist * move;
          }
        }
      };
    }
  };
})();
