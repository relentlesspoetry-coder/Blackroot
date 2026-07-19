// Dream Realms WorldEntity normalization.
// Phase 1 (Simulation Core, Entity Model, Gameplay Event Bus).
//
// This module does NOT replace entities/entity.js or any of its
// subclasses, and does NOT add new fields to those runtime objects. It is
// a read-only adapter: DR.WorldEntity.normalize(source, game) inspects
// whatever shape already exists at runtime today - an Entity instance
// (player/enemy/mercenary/pet/remote-player/bot-player, all of which carry
// a `.kind` discriminator already), a plain NPC record from
// systems/npc-system.js (already carries `type: 'npc'`), a resource node
// from systems/resource-gathering-system.js (already carries its own
// `zoneId`), or a plain world object/prop from systems/world-system.js -
// and returns one canonical shape for code that wants a uniform view
// (event payloads, future networking/save tooling), without requiring any
// of those owning systems to change.
//
// Entity model decision: none of the current runtime actor objects carry
// a per-entity zoneId (the simulation currently has exactly one active
// zone at a time, tracked globally as Game.currentZone /
// Game.currentCave / Game.activeDungeon - see
// docs/PHASE_0_CODEBASE_AUDIT.txt section 3). Rather than adding a zoneId
// field to every entity class (a much larger, riskier change than this
// foundation phase calls for), normalize() derives zoneId from the
// source object's own zoneId if it has one (resource nodes and some NPC
// records already do), and otherwise falls back to the game's current
// zone via DR.Ids.currentZoneId(game). This is an accurate reflection of
// the current single-active-zone architecture, not a workaround.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const TYPES = Object.freeze({
    PLAYER: 'player',
    NPC: 'npc',
    MOB: 'mob',
    PET: 'pet',
    MERCENARY: 'mercenary',
    RESOURCE_NODE: 'resourceNode',
    OBJECT: 'object'
  });

  // Entity.kind -> canonical WorldEntity type. Bots and remote players are
  // player-controlled/player-representing actors, so they map to 'player'
  // here even though entities/entity.js keeps them as distinct kinds for
  // its own AI/network-sync purposes.
  const KIND_TO_TYPE = Object.freeze({
    player: TYPES.PLAYER,
    bot: TYPES.PLAYER,
    remote: TYPES.PLAYER,
    enemy: TYPES.MOB,
    pet: TYPES.PET,
    merc: TYPES.MERCENARY
  });

  function looksLikeResourceNode(source) {
    return isNonEmptyString(source.zoneId) && (
      isNonEmptyString(source.category) || isNonEmptyString(source.skill) ||
      isNonEmptyString(source.tool) || Number.isFinite(source.gatherTimeSeconds)
    );
  }

  const isNonEmptyString = value => typeof value === 'string' && value.length > 0;

  function resolveType(source) {
    if (!source || typeof source !== 'object') return TYPES.OBJECT;
    if (source.type === 'npc' || isNonEmptyString(source.npcId)) return TYPES.NPC;
    if (isNonEmptyString(source.kind) && KIND_TO_TYPE[source.kind]) return KIND_TO_TYPE[source.kind];
    if (looksLikeResourceNode(source)) return TYPES.RESOURCE_NODE;
    return TYPES.OBJECT;
  }

  function resolveRotation(source) {
    if (isNonEmptyString(source.facingName)) return source.facingName;
    if (Number.isFinite(source.facingX) && Number.isFinite(source.facingY)) {
      return Math.atan2(source.facingY, source.facingX);
    }
    return null;
  }

  function resolveZoneId(source, game) {
    if (isNonEmptyString(source.zoneId)) return source.zoneId;
    if (isNonEmptyString(source.dungeonId)) return source.dungeonId;
    return DR.Ids?.currentZoneId?.(game) ?? null;
  }

  function normalize(source, game = null) {
    if (!source || typeof source !== 'object') return null;
    return {
      id: source.id ?? source.npcId ?? null,
      type: resolveType(source),
      zoneId: resolveZoneId(source, game),
      position: { x: source.x ?? 0, y: source.y ?? 0 },
      rotation: resolveRotation(source),
      state: source.action || source.animationState || 'idle'
    };
  }

  DR.WorldEntity = Object.freeze({ TYPES, resolveType, normalize });
})();
