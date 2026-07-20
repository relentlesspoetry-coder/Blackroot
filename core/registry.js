(() => {
  'use strict';

  window.DreamRealms = window.DreamRealms || {};
  window.DreamRealmsSystems = window.DreamRealmsSystems || [];

  window.registerDreamRealmsSystem = function registerDreamRealmsSystem(system) {
    if (!system || !system.id) return;
    const exists = window.DreamRealmsSystems.some(entry => entry.id === system.id);
    if (!exists) window.DreamRealmsSystems.push(system);
  };
})();

// Phase 1 (Descriptor & Registry Normalization): canonical, read-only
// descriptor lookup + reference-validation layer. This does not replace any
// data/*.js file as the owner of its catalog - every table() getter below
// just reads the existing DR.*_BY_ID export that file already produces. It
// exists to give every other system ONE safe place to check "does this id
// still resolve" and to run a single non-fatal boot-time consistency report
// instead of each system growing its own ad hoc existence checks.
(() => {
  const DR = window.DreamRealms = window.DreamRealms || {};

  // Bump this only when a save's descriptor-shaped data (item/spell/quest/
  // etc ids) could have shifted meaning in a way worth flagging on load -
  // not on every content addition. See systems/save-system.js and
  // systems/world-serializer.js, which stamp this into saved payloads.
  const DESCRIPTOR_VERSION = 1;

  const TABLES = {
    class: () => DR.CLASSES || {},
    race: () => DR.RACES || {},
    item: () => DR.ITEM_BY_ID || {},
    spell: () => DR.SPELL_BY_ID || {},
    mob: () => DR.MOB_DRAFT_BY_ID || {},
    boss: () => DR.BOSS_BY_ID || {},
    npc: () => DR.NPC_DRAFT_BY_ID || {},
    mobSpawn: () => DR.MOB_SPAWN_BY_ID || {},
    quest: () => DR.QUEST_BY_ID || {},
    event: () => DR.EVENT_BY_ID || {},
    resource: () => DR.RESOURCE_BY_ID || {},
    craftingRecipe: () => DR.CRAFTING_RECIPE_BY_ID || {},
    craftingStation: () => DR.CRAFTING_STATION_BY_ID || {},
    profession: () => DR.PROFESSION_BY_ID || {},
    zone: () => (DR.DEFAULT_WORLD && DR.DEFAULT_WORLD.zones) || {},
    // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity): added
    // for dungeon descriptor cross-referencing (see runBootValidation
    // below). data/dungeons.js remains the sole owner of this data - these
    // are read-only lookups over its existing exports.
    dungeon: () => DR.DUNGEON_BY_ID || {},
    puzzle: () => DR.PUZZLE_BY_ID || {},
    dungeonRoom: () => DR.DUNGEON_ROOM_BY_ID || {}
  };

  // data/loot-tables.js exports DR.LOOT_TABLES as an array, not a *_BY_ID
  // map (no other system needs one yet). Build a read-only id index lazily
  // for this module's own lookups only; this does not add or rename any
  // export on DR, so data/loot-tables.js remains the sole owner of the data.
  let lootTableIndexCache = null;
  let lootTableIndexSourceLength = -1;
  function lootTableIndex() {
    const source = Array.isArray(DR.LOOT_TABLES) ? DR.LOOT_TABLES : [];
    if (!lootTableIndexCache || lootTableIndexSourceLength !== source.length) {
      lootTableIndexCache = {};
      for (const entry of source) if (entry && entry.id) lootTableIndexCache[entry.id] = entry;
      lootTableIndexSourceLength = source.length;
    }
    return lootTableIndexCache;
  }
  TABLES.lootTable = lootTableIndex;

  function tableFor(kind) {
    const getter = TABLES[kind];
    if (!getter) return {};
    try { return getter() || {}; } catch (_) { return {}; }
  }

  function has(kind, id) {
    if (id == null || id === '') return false;
    return Object.prototype.hasOwnProperty.call(tableFor(kind), id);
  }

  function get(kind, id) {
    if (id == null) return null;
    return tableFor(kind)[id] || null;
  }

  // Some references in the data (quest giver/turnIn, resource drops) are
  // keyed by display name rather than by id - a pre-existing convention,
  // not something this pass introduces. This helper validates that
  // convention without pretending it is id-based.
  function hasByName(kind, name) {
    if (!name) return false;
    const table = tableFor(kind);
    for (const entry of Object.values(table)) {
      if (entry && entry.name === name) return true;
    }
    return false;
  }

  const compilerErrors = {};
  function recordCompilerErrors(kind, errors) {
    compilerErrors[kind] = Array.isArray(errors) ? errors.slice() : [];
  }

  let bootReport = null;

  // V0.18.71 (Roadmap Item 12): item obtainability audit. Cross-references every acquisition
  // source that names items by id (loot tables incl. boss/chest/dungeon-reward + rare/guaranteed
  // pools, crafting outputs, quest fixed + player-choice rewards) or by name (gathering/fishing
  // resource drops), and reports items with NO reachable source - the roadmap's "no item exists
  // only as an unused data record" check. Vendor stock is tag-based (no explicit item list), so a
  // "no source found" item may still be a vendor / quest-script / starting-gear item; this is a
  // review report, not a hard failure.
  function auditItemObtainability() {
    const items = tableFor('item');
    const sources = new Map();
    const add = (itemId, label) => {
      if (!itemId || !items[itemId]) return;
      if (!sources.has(itemId)) sources.set(itemId, new Set());
      sources.get(itemId).add(label);
    };
    for (const table of (Array.isArray(DR.LOOT_TABLES) ? DR.LOOT_TABLES : [])) {
      const t = `loot:${table.id || '?'}`;
      for (const e of (table.entries || [])) add(e && e.itemId, t);
      for (const id of (table.rarePool || [])) add(id, t);
      for (const id of (table.guaranteedPool || [])) add(id, t);
    }
    for (const recipe of Object.values(tableFor('craftingRecipe'))) {
      if (!recipe) continue;
      for (const o of (recipe.outputs || [])) add(o && o.itemId, `craft:${recipe.id || '?'}`);
    }
    for (const quest of Object.values(tableFor('quest'))) {
      if (!quest) continue;
      const rw = quest.rewards || {};
      for (const it of (rw.items || [])) add(it && (it.id || it.itemId), `quest:${quest.id || '?'}`);
      for (const it of (rw.choiceItems || [])) add(it && (it.id || it.itemId), `quest:${quest.id || '?'}`);
    }
    // Class starting gear (systems/inventory-system.js starterGear map) is granted at character
    // creation, not looted. Those items follow the canonical `item_starter_` id prefix, so
    // recognize that convention here rather than reaching into a gameplay system from data level.
    for (const id of Object.keys(items)) { if (/^item_starter_/.test(id)) add(id, 'starter:class-creation'); }
    const nameToId = {};
    for (const [id, it] of Object.entries(items)) { if (it && it.name) nameToId[String(it.name).toLowerCase()] = id; }
    for (const res of Object.values(tableFor('resource'))) {
      if (!res) continue;
      for (const d of [...(res.drops || []), ...(res.rareDrops || [])]) {
        const id = nameToId[String((d && d.item) || '').toLowerCase()];
        if (id) add(id, `gather:${res.id || '?'}`);
      }
    }
    // Fishing catch tables (systems/fishing-system.js DR.FISH_TABLES), keyed by water zone.
    const fishTables = DR.FISH_TABLES && typeof DR.FISH_TABLES === 'object' ? DR.FISH_TABLES : {};
    for (const [zone, list] of Object.entries(fishTables)) {
      for (const fish of (Array.isArray(list) ? list : [])) add(fish && fish.itemId, `fish:${zone}`);
    }
    // Vendor stock (systems/event-system.js DR.SHOP_ITEM_LISTS), by itemId.
    const shopLists = DR.SHOP_ITEM_LISTS && typeof DR.SHOP_ITEM_LISTS === 'object' ? DR.SHOP_ITEM_LISTS : {};
    for (const [shopId, list] of Object.entries(shopLists)) {
      for (const id of (Array.isArray(list) ? list : [])) add(id, `vendor:${shopId}`);
    }
    // Quest-script granted items (data/quests.js DR.INTERACT_POINTS / DR.DISCOVERY_POINTS grantItem).
    for (const arr of [DR.INTERACT_POINTS, DR.DISCOVERY_POINTS]) {
      for (const poi of (Array.isArray(arr) ? arr : [])) add(poi && poi.grantItem, `quest-grant:${(poi && (poi.objId || poi.id)) || '?'}`);
    }
    const unsourced = [];
    for (const [id, it] of Object.entries(items)) {
      if (!sources.has(id)) unsourced.push({ id, name: (it && it.name) || id, type: (it && it.type) || '?' });
    }
    unsourced.sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.id).localeCompare(String(b.id)));
    return {
      totalItems: Object.keys(items).length,
      sourcedCount: sources.size,
      unsourcedCount: unsourced.length,
      unsourced,
      sourceFor: id => [...(sources.get(id) || [])]
    };
  }

  function runBootValidation() {
    const warnings = [];

    function checkRef(kind, id, context) {
      if (id == null || id === '') return;
      if (!has(kind, id)) warnings.push(`${context}: unknown ${kind} id "${id}".`);
    }
    function checkRefByName(kind, name, context) {
      if (!name) return;
      if (!hasByName(kind, name)) warnings.push(`${context}: unknown ${kind} name "${name}".`);
    }

    // V0.19.3: validate a quest's giver/turnIn display name. See the call site for why an NPC-only
    // check was wrong. A name is fine if it resolves to an npc, a mob or a boss; and the reference is
    // optional entirely when the quest is auto-offered (no NPC hands it over) or auto-completed (no
    // NPC takes it back).
    function checkQuestPersonName(quest, field) {
      const name = quest && quest[field];
      if (!name) return;
      if (hasByName('npc', name) || hasByName('mob', name) || hasByName('boss', name)) return;
      const optional = field === 'giver'
        ? Boolean(quest.autoOffer || quest.foundAtPoi)
        : Boolean(quest.autoComplete);
      if (optional) return;
      warnings.push(`quest "${quest.id}" ${field}: unknown npc name "${name}".`);
    }

    try {
      for (const spell of Object.values(tableFor('spell'))) {
        if (spell && spell.className) checkRef('class', spell.className, `spell "${spell.id || spell.name}"`);
      }

      for (const npc of Object.values(tableFor('npc'))) {
        if (!npc) continue;
        for (const questId of (npc.questIds || [])) checkRef('quest', questId, `npc "${npc.id}"`);
        if (npc.classId) checkRef('class', npc.classId, `npc "${npc.id}"`);
      }

      for (const spawn of Object.values(tableFor('mobSpawn'))) {
        if (!spawn) continue;
        for (const mobId of (spawn.mobIds || [])) {
          if (!has('mob', mobId) && !has('boss', mobId)) warnings.push(`mobSpawn "${spawn.id}": unknown mob/boss id "${mobId}".`);
        }
        if (spawn.lootTableId) checkRef('lootTable', spawn.lootTableId, `mobSpawn "${spawn.id}"`);
      }

      for (const mob of Object.values(tableFor('mob'))) {
        if (mob && mob.lootTableId) checkRef('lootTable', mob.lootTableId, `mob "${mob.id}"`);
      }
      for (const boss of Object.values(tableFor('boss'))) {
        if (boss && boss.lootTableId) checkRef('lootTable', boss.lootTableId, `boss "${boss.id}"`);
      }

      for (const recipe of Object.values(tableFor('craftingRecipe'))) {
        if (!recipe) continue;
        for (const input of (recipe.inputs || [])) checkRef('item', input.itemId, `recipe "${recipe.id}" input`);
        for (const output of (recipe.outputs || [])) checkRef('item', output.itemId, `recipe "${recipe.id}" output`);
        if (recipe.stationId) checkRef('craftingStation', recipe.stationId, `recipe "${recipe.id}"`);
        for (const unlockId of (recipe.unlocks || [])) checkRef('craftingRecipe', unlockId, `recipe "${recipe.id}" unlocks`);
      }

      for (const quest of Object.values(tableFor('quest'))) {
        if (!quest) continue;
        for (const rewardItem of (quest.rewards?.items || [])) checkRef('item', rewardItem.id, `quest "${quest.id}" reward`);
        for (const choice of (quest.rewards?.choiceItems || [])) {
          checkRef('item', choice.id, `quest "${quest.id}" choice reward`);
          for (const className of (choice.classes || [])) checkRef('class', className, `quest "${quest.id}" choice reward class`);
        }
        // V0.19.3: a quest giver/turnIn is a DISPLAY NAME, and it may legitimately resolve to more
        // than an NPC. Checking it against the npc table alone produced FALSE warnings on real,
        // working content:
        //  - a MOB/BOSS: bounty and branch quests name their target, e.g. "Rurik the Fallen"
        //    (mob_bandit_leader) on quest_fall_of_rurik / quest_ruriks_bargain - whose own note says
        //    "Rurik is not a turn-in NPC";
        //  - NOBODY: an autoOffer/foundAtPoi quest is handed over by a place, not a person (e.g.
        //    quest_fourth_member's "The Survivor"), and an autoComplete quest has no turn-in NPC.
        //    Those quests still carry the name for narrative flavour, and that is not an error.
        // Only warn when a name resolves to nothing AND the quest actually needs that NPC.
        checkQuestPersonName(quest, 'giver');
        checkQuestPersonName(quest, 'turnIn');
      }

      for (const resource of Object.values(tableFor('resource'))) {
        if (!resource) continue;
        for (const drop of (resource.drops || [])) checkRefByName('item', drop.item, `resource "${resource.id}" drop`);
        for (const drop of (resource.rareDrops || [])) checkRefByName('item', drop.item, `resource "${resource.id}" rare drop`);
      }

      for (const zone of Object.values(tableFor('zone'))) {
        if (zone && zone.parentZone) checkRef('zone', zone.parentZone, `zone "${zone.id}"`);
      }

      for (const event of Object.values(tableFor('event'))) {
        if (!event || !Array.isArray(event.commands)) continue;
        for (const command of event.commands) {
          if (command?.type === 'questHook' && command.questId) checkRef('quest', command.questId, `event "${event.id}" command`);
          if (command?.type === 'warp' && command.targetZone) checkRef('zone', command.targetZone, `event "${event.id}" command`);
        }
      }

      // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
      // dungeon descriptors (data/dungeons.js) were not previously
      // cross-referenced at all. zoneId/entranceZoneId are intentionally
      // NOT checked here - they are floor-composite ids (e.g.
      // "blackroot_catacombs_f4") that never exactly match a plain zone
      // id, so validating them against the zone table would be a
      // guaranteed false positive; caveZoneId does use the exact zone id
      // format and is checked.
      for (const dungeon of Object.values(tableFor('dungeon'))) {
        if (!dungeon) continue;
        for (const bossId of (dungeon.bossIds || [])) checkRef('boss', bossId, `dungeon "${dungeon.id}"`);
        for (const puzzleId of (dungeon.puzzleIds || [])) checkRef('puzzle', puzzleId, `dungeon "${dungeon.id}"`);
        if (dungeon.lootTableId) checkRef('lootTable', dungeon.lootTableId, `dungeon "${dungeon.id}"`);
        if (dungeon.keyItemId) checkRef('item', dungeon.keyItemId, `dungeon "${dungeon.id}"`);
        if (dungeon.caveZoneId) checkRef('zone', dungeon.caveZoneId, `dungeon "${dungeon.id}"`);
      }
      for (const puzzle of Object.values(tableFor('puzzle'))) {
        if (puzzle && puzzle.dungeonId) checkRef('dungeon', puzzle.dungeonId, `puzzle "${puzzle.id}"`);
      }
    } catch (err) {
      warnings.push(`descriptor validation crashed safely: ${err?.message || err}`);
    }

    const compilerErrorCount = Object.values(compilerErrors).reduce((sum, list) => sum + list.length, 0);
    let obtainability = null;
    try {
      const audit = auditItemObtainability();
      obtainability = { total: audit.totalItems, sourced: audit.sourcedCount, unsourced: audit.unsourcedCount };
    } catch (_e) { /* audit is advisory - never let it break boot */ }
    bootReport = {
      ok: warnings.length === 0 && compilerErrorCount === 0,
      warnings,
      compilerErrors: JSON.parse(JSON.stringify(compilerErrors)),
      obtainability,
      checkedAt: Date.now()
    };

    if (warnings.length) {
      console.warn(`[Dream Realms Registry] ${warnings.length} descriptor reference warning(s) - game will continue, content may be incomplete:`, warnings);
    }
    if (obtainability && obtainability.unsourced > 0) {
      console.info(`[Dream Realms Registry] item obtainability: ${obtainability.sourced}/${obtainability.total} items have a loot/craft/quest/gather source; ${obtainability.unsourced} have none found (may be vendor-tag / quest-script / starting gear). Call DR.Registry.auditItemObtainability() for the list.`);
    }
    if (compilerErrorCount) {
      console.warn(`[Dream Realms Registry] ${compilerErrorCount} compiler error(s):`, compilerErrors);
    }
    return bootReport;
  }

  // Non-fatal existence check for ids embedded in save/runtime blobs (as
  // opposed to static content tables above). Used by save-system.js /
  // world-serializer.js to report - not silently drop - orphaned ids after
  // a content update. Returns the list of ids that no longer resolve.
  function auditRuntimeReferences(kind, ids, context) {
    if (!ids) return [];
    const list = Array.isArray(ids) ? ids : Object.keys(ids);
    const missing = list.filter(id => id && !has(kind, id));
    if (missing.length) {
      console.warn(`[Dream Realms Registry] ${context}: ${missing.length} ${kind} id(s) from a save no longer resolve to current content:`, missing);
    }
    return missing;
  }

  DR.Registry = {
    DESCRIPTOR_VERSION,
    KINDS: Object.keys(TABLES),
    tableFor,
    has,
    get,
    hasByName,
    recordCompilerErrors,
    runBootValidation,
    auditItemObtainability,
    auditRuntimeReferences,
    getReport: () => bootReport
  };
})();
