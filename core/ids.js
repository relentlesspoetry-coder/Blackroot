// Dream Realms canonical identity schema.
// Phase 1 (Simulation Core, Entity Model, Gameplay Event Bus): this module
// documents and standardizes the ID formats already in use across the
// codebase, and provides generator/validator helpers for the ID kinds that
// do not yet have a canonical form. It does not replace any existing ID
// generator (entities/entity.js's runtime id counter, save-system.js's
// characterId generator, loot-system.js's itemSerial counter, etc.) -
// those remain the source of truth for their own values. This module is
// the single place new code should look to understand or produce an id in
// the correct shape, and the place future systems (factions, skill trees)
// should generate their first ids from.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  // Each entry documents: kind of value, current owner, and example.
  // Not enforced at runtime - this is living documentation plus the
  // validators/generators below.
  const SCHEMA = Object.freeze({
    EntityId: {
      format: 'positive integer, session-scoped (resets on reload)',
      owner: 'entities/entity.js (nextId counter)',
      persisted: false,
      example: 42
    },
    AccountId: {
      format: 'string, opaque',
      owner: 'systems/save-system.js',
      persisted: true,
      example: 'acct-9f2c1a'
    },
    CharacterId: {
      format: 'string "char-<slotIndex+1>-<hash>"',
      owner: 'systems/save-system.js (generateCharacterId)',
      persisted: true,
      example: 'char-1-7ae21c'
    },
    ItemInstanceId: {
      format: 'positive integer, session-scoped (resets on reload)',
      owner: 'systems/loot-system.js (itemSerial counter)',
      persisted: false,
      example: 118
    },
    ZoneId: {
      format: 'string catalog/zone key, optionally composite "cave:<caveId>:<floor>" style for multi-floor caves',
      owner: 'systems/world-system.js, systems/cave-system.js, systems/dungeon-system.js, systems/portal-system.js',
      persisted: true,
      example: 'dark_woods'
    },
    FactionId: {
      format: 'string slug, "faction_<slug>"',
      owner: 'none yet - reserved for a future faction/reputation system',
      persisted: false,
      example: 'faction_dark_woods_settlement'
    },
    QuestId: {
      format: 'string catalog key, "quest_<slug>"',
      owner: 'data/quests.js, systems/quest-system.js',
      persisted: true,
      example: 'quest_darkwood_first_steps'
    },
    SkillId: {
      format: 'string slug, "skill_<slug>"',
      owner: 'none yet - systems/resource-gathering-system.js and systems/skills-system.js currently key skills by plain display name (e.g. "Mining"), not this format; reserved for a future unified skill-tree system',
      persisted: false,
      example: 'skill_mining'
    },

    // Phase 1 (Descriptor & Registry Normalization): documents the id
    // formats already produced by data/*.js and read through
    // core/registry.js's DR.Registry lookup layer. These are existing
    // conventions, not new formats - documented here for the first time.
    ClassId: {
      format: 'display-name string used as an object key (e.g. "Fighter")',
      owner: 'data/classes.js (DR.CLASSES)',
      persisted: true,
      example: 'Fighter'
    },
    RaceId: {
      format: 'lowercase string slug',
      owner: 'data/races.js (DR.RACES, DR.normalizeRaceId)',
      persisted: true,
      example: 'human'
    },
    ItemId: {
      format: 'string catalog key, "item_<slug>"',
      owner: 'data/items.js (DR.ITEM_BY_ID)',
      persisted: true,
      example: 'item_linen_pouch'
    },
    SpellDescriptorId: {
      format: 'string catalog key, "spell_<class>_<slug>"',
      owner: 'data/spell-editor.js (DR.SPELL_BY_ID), compiled by systems/spell-compiler-system.js',
      persisted: false,
      example: 'spell_bard_war_hymn'
    },
    NpcId: {
      format: 'string catalog key, "npc_<slug>"',
      owner: 'data/npcs.js (DR.NPC_DRAFT_BY_ID)',
      persisted: false,
      example: 'npc_town_guide'
    },
    MobId: {
      format: 'string catalog key, "mob_<slug>" or "boss_<slug>"/"miniboss_<slug>"',
      owner: 'data/npcs.js (DR.MOB_DRAFT_BY_ID), data/enemies.js (DR.BOSS_BY_ID)',
      persisted: false,
      example: 'mob_gloom_wolf'
    },
    ResourceId: {
      format: 'string catalog key, "<category>_<slug>" (e.g. "herb_<slug>")',
      owner: 'data/resources.js (DR.RESOURCE_BY_ID)',
      persisted: false,
      example: 'herb_gloomleaf'
    },
    CraftingRecipeId: {
      format: 'string catalog key, "recipe_<slug>"',
      owner: 'data/crafting.js (DR.CRAFTING_RECIPE_BY_ID)',
      persisted: false,
      example: 'recipe_copper_bar'
    },
    EventTypeId: {
      format: 'string catalog key, "<slug>" or "<slug>_event"',
      owner: 'data/events.js (DR.EVENT_BY_ID)',
      persisted: false,
      example: 'quest_hook'
    }
  });

  const slugify = value => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const prefixedPattern = prefix => new RegExp(`^${prefix}_[a-z0-9_]+$`);

  const isNonEmptyString = value => typeof value === 'string' && value.length > 0;
  const isPositiveInteger = value => Number.isInteger(value) && value > 0;

  const questIdPattern = prefixedPattern('quest');
  const factionIdPattern = prefixedPattern('faction');
  const skillIdPattern = prefixedPattern('skill');

  const Ids = {
    SCHEMA,

    // -- validators (format checks only, do not confirm the id resolves to
    // a real record - callers still need their own catalog/lookup) --
    isEntityId: value => isPositiveInteger(value),
    isItemInstanceId: value => isPositiveInteger(value),
    isAccountId: value => isNonEmptyString(value),
    isCharacterId: value => isNonEmptyString(value) && value.startsWith('char-'),
    isZoneId: value => isNonEmptyString(value),
    isQuestId: value => isNonEmptyString(value) && questIdPattern.test(value),
    isFactionId: value => isNonEmptyString(value) && factionIdPattern.test(value),
    isSkillId: value => isNonEmptyString(value) && skillIdPattern.test(value),

    // -- generators for the ID kinds that do not have a canonical
    // generator anywhere yet. New code (not yet-existing faction/skill-tree
    // systems) should call these rather than inventing another format. --
    createFactionId(name) {
      const slug = slugify(name);
      return slug ? `faction_${slug}` : null;
    },
    createSkillId(name) {
      const slug = slugify(name);
      return slug ? `skill_${slug}` : null;
    },

    // -- zone id helper: the canonical current ZoneId for wherever the
    // player is right now, reusing the existing composite-key logic that
    // already lives on Game/CaveSystem rather than re-deriving it. --
    currentZoneId(game) {
      if (!game) return null;
      if (game.currentZone === 'cave') return game.getActiveCaveZoneKey?.() || game.currentCave?.id || null;
      if (game.currentZone === 'dungeon') {
        return game.activeDungeon?.id || game.dungeonSystem?.state?.active?.dungeonId || game.dungeonRuntimeState?.active?.dungeonId || 'dungeon';
      }
      return game.currentZone || 'dark_woods';
    }
  };

  DR.Ids = Object.freeze(Ids);
})();
