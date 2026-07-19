// Dream Realms Character model normalization.
// Phase 1 (Simulation Core, Entity Model, Gameplay Event Bus).
//
// This module does NOT replace entities/player.js or systems/save-system.js
// (the owning systems for the live Player instance and the persisted
// character save payload). It is a read-only adapter,
// DR.CharacterModel.normalize(game), that projects the current player +
// game state into the canonical character shape requested for Phase 1:
// id, accountId, name, raceId, classId, level, xp, stats, inventoryId,
// equipment, skillTrees, factions, unlockedWaypoints.
//
// Entity model decisions:
// - classId: classes are keyed by their display-name string everywhere in
//   this codebase (data/classes.js, Player.className) - there is no
//   separate numeric/slug class id. `classId` here is that same string,
//   not a new identifier, to avoid a second parallel class-id scheme.
// - inventoryId: inventory/equipment are stored directly on the Game
//   instance (this.inventory, this.equipment), not behind a separate
//   inventory-container id. Introducing a real separate inventory service
//   is out of scope for this foundation phase. inventoryId here is a
//   derived, deterministic value (`inv_<characterId>`) via
//   DR.Ids so calling code already has a stable identifier to reference
//   "this character's inventory" as a concept, without any change to how
//   inventory is actually stored today.
// - skillTrees / factions / unlockedWaypoints: no owning system exists
//   yet for any of these (see docs/PHASE_0_CODEBASE_AUDIT.txt and
//   docs/PHASE_1_SIMULATION_CORE_EVENT_BUS.txt). systems/save-system.js
//   now persists them as new, additive, optional fields on the character
//   save payload (defaulting to {} / {} / []) so a future system has a
//   stable place to read from and write to without another save-format
//   migration. This module simply surfaces whatever is currently there.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  function normalize(game) {
    const p = game?.player;
    if (!p) return null;
    const characterId = p.characterId || null;
    return {
      id: characterId,
      accountId: p.accountId || game.activeAccountId || null,
      name: p.name || '',
      raceId: p.raceId || 'human',
      classId: p.className || null,
      level: Math.max(1, Math.floor(Number(p.level) || 1)),
      xp: Math.max(0, Math.floor(Number(p.xp) || 0)),
      stats: {
        maxHp: Number(p.maxHp) || 0,
        maxMana: Number(p.maxMana) || 0,
        attack: Number(p.attack) || 0,
        defense: Number(p.defense) || 0,
        speed: Number(p.speed) || 0,
        attributes: { ...(p.attributes || {}) },
        derivedStats: { ...(p.derivedStats || {}) }
      },
      inventoryId: characterId ? `inv_${characterId}` : null,
      equipment: { ...(game.equipment || {}) },
      skillTrees: { ...(p.skillTrees || {}) },
      factions: { ...(p.factions || {}) },
      unlockedWaypoints: Array.isArray(p.unlockedWaypoints) ? [...p.unlockedWaypoints] : []
    };
  }

  DR.CharacterModel = Object.freeze({ normalize });
})();
