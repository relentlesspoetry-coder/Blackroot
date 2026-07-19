// Dream Realms classic-script global compatibility bridge
// Keeps extracted systems usable when opened directly from a local folder.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  const expose = (name, value) => {
    if (typeof value !== 'undefined') window[name] = value;
  };

  expose('CONFIG', DR.CONFIG);
  expose('MAX_PARTY_SIZE', DR.MAX_PARTY_SIZE);
  expose('TILE', DR.TILE);
  expose('TILE_DEF', DR.TILE_DEF);
  expose('CLASSES', DR.CLASSES);
  expose('CLASS_SPELL_BOOK', DR.CLASS_SPELL_BOOK);
  expose('COMPILED_CLASS_SPELL_BOOK', DR.COMPILED_CLASS_SPELL_BOOK);
  expose('COMPILED_SPELL_BY_ID', DR.COMPILED_SPELL_BY_ID);
  expose('SPELL_BY_ID', DR.SPELL_BY_ID);
  expose('DEFAULT_CLASS_SPELL_SLOTS', DR.DEFAULT_CLASS_SPELL_SLOTS);
  expose('MERC_ROLES', DR.MERC_ROLES);
  expose('ENEMY_TYPES', DR.ENEMY_TYPES);
  expose('NPC_DRAFTS', DR.NPC_DRAFTS);
  expose('NPC_DRAFT_BY_ID', DR.NPC_DRAFT_BY_ID);
  expose('MOB_DRAFTS', DR.MOB_DRAFTS);
  expose('MOB_DRAFT_BY_ID', DR.MOB_DRAFT_BY_ID);
  expose('MOB_SPAWN_DRAFTS', DR.MOB_SPAWN_DRAFTS);
  expose('MOB_SPAWN_BY_ID', DR.MOB_SPAWN_BY_ID);
  expose('RARITIES', DR.RARITIES);
  expose('EQUIP_SLOTS', DR.EQUIP_SLOTS);
  expose('SLOT_LABELS', DR.SLOT_LABELS);
  expose('CLASS_ARCHETYPES', DR.CLASS_ARCHETYPES);
  expose('LOOT_BASES', DR.LOOT_BASES);
  expose('AFFIXES', DR.AFFIXES);
  expose('RESOURCE_TYPES', DR.RESOURCE_TYPES);
  expose('RESOURCE_BY_ID', DR.RESOURCE_BY_ID);
  expose('EVENT_TYPES', DR.EVENT_TYPES);
  expose('EVENT_BY_ID', DR.EVENT_BY_ID);

  if (DR.utils) {
    for (const [key, value] of Object.entries(DR.utils)) expose(key, value);
  }

  if (DR.entities) {
    for (const [key, value] of Object.entries(DR.entities)) expose(key, value);
  }
})();
