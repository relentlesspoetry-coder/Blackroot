// Dream Realms gameplay event bus.
// Phase 1 (Simulation Core, Entity Model, Gameplay Event Bus).
//
// A small, dependency-free publish/subscribe bus for cross-system gameplay
// notifications. This is additive foundation: existing systems keep
// working exactly as they do today (most already call the pre-existing
// Game.prototype.notifyExternalSystems relay - see game.js). That relay
// now also forwards a subset of its calls into DR.EventBus.emit() using
// the typed constants below, so systems do not need to know about this
// bus to already be emitting through it. New systems should prefer
// DR.EventBus directly.
//
// Rules this module follows (see docs/PHASE_1_SIMULATION_CORE_EVENT_BUS.txt):
// - Event types are typed constants (DR.GameEvents.*), never bare strings,
//   to avoid magic-string drift between emitters and listeners.
// - emit() never throws past a bad listener: each handler runs in its own
//   try/catch, and a failing handler only logs a console warning.
// - No allocations on the "no listeners" path; listener storage is a Map
//   of Sets so add/remove are O(1) and emit() only allocates the small
//   snapshot array needed to let handlers safely add/remove listeners
//   for the same event type mid-dispatch.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  // Typed event name constants. Keep this list in sync with
  // docs/PHASE_1_SIMULATION_CORE_EVENT_BUS.txt.
  //
  // Documented payload shapes (all payloads are plain objects; fields are
  // optional unless marked required - not every emitter can populate every
  // field yet):
  //   DAMAGE_DEALT              { targetId: EntityId, sourceId: EntityId|null, amount: number, damageType: string, isCrit: boolean }
  //   HEALING_DONE              { targetId: EntityId, sourceId: EntityId|null, amount: number, isCrit: boolean }
  //   ENTITY_KILLED             { targetId: EntityId, sourceId: EntityId|null, zoneId: ZoneId, worldEntity?: WorldEntity }
  //   ITEM_LOOTED               { itemId: string, name: string, qty: number, sourceId: EntityId|null }
  //   RESOURCE_GATHERED         { nodeType: string, itemId: string, qty: number, zoneId: ZoneId, skill: string }
  //   QUEST_OBJECTIVE_PROGRESS  { questId: QuestId, taskId: string|null, progress: number, required: number, eventType: string }
  //   REPUTATION_CHANGED        { factionId: FactionId, delta: number, newValue: number } (not yet emitted - no faction system exists yet)
  //   ZONE_EVENT_STARTED        { zoneId: ZoneId, eventKey: string, category: string }
  //   ZONE_EVENT_COMPLETED      { zoneId: ZoneId, eventKey: string, category: string } (not yet emitted - current event markers are one-shot, no distinct completion step exists yet)
  //   ITEM_CRAFTED              { itemId: string, name: string, qty: number, recipeId: string|null }
  //   BOSS_KILLED               { targetId: EntityId, sourceId: EntityId|null, zoneId: ZoneId }
  //   DUNGEON_COMPLETED         { dungeonId: string, floor: number }
  //   PLAYER_DISCOVERED_LOCATION{ zoneId: ZoneId, locationId: string } (not yet emitted - no discovery/fog-of-war tracking exists yet)
  //   DUEL_STARTED              { challengerId: EntityId, opponentId: EntityId } (not yet emitted - no duel system exists yet)
  //   DUEL_ENDED                { winnerId: EntityId, loserId: EntityId } (not yet emitted - no duel system exists yet)
  //   MARKET_ITEM_SOLD          { itemId: string, qty: number, priceCopper: number, sellerId: EntityId } (not yet emitted - no market system exists yet)
  //   MAIL_CLAIMED              { mailId: string, characterId: CharacterId } (not yet emitted - no mail system exists yet)
  const GameEvents = Object.freeze({
    DAMAGE_DEALT: 'DAMAGE_DEALT',
    HEALING_DONE: 'HEALING_DONE',
    ENTITY_KILLED: 'ENTITY_KILLED',
    ITEM_LOOTED: 'ITEM_LOOTED',
    RESOURCE_GATHERED: 'RESOURCE_GATHERED',
    QUEST_OBJECTIVE_PROGRESS: 'QUEST_OBJECTIVE_PROGRESS',
    REPUTATION_CHANGED: 'REPUTATION_CHANGED',
    ZONE_EVENT_STARTED: 'ZONE_EVENT_STARTED',
    ZONE_EVENT_COMPLETED: 'ZONE_EVENT_COMPLETED',
    ITEM_CRAFTED: 'ITEM_CRAFTED',
    BOSS_KILLED: 'BOSS_KILLED',
    DUNGEON_COMPLETED: 'DUNGEON_COMPLETED',
    PLAYER_DISCOVERED_LOCATION: 'PLAYER_DISCOVERED_LOCATION',
    DUEL_STARTED: 'DUEL_STARTED',
    DUEL_ENDED: 'DUEL_ENDED',
    MARKET_ITEM_SOLD: 'MARKET_ITEM_SOLD',
    MAIL_CLAIMED: 'MAIL_CLAIMED'
  });

  const VALID_EVENT_TYPES = new Set(Object.values(GameEvents));
  const listeners = new Map(); // eventType -> Set<handler>

  function on(eventType, handler) {
    if (typeof handler !== 'function') return () => {};
    if (!VALID_EVENT_TYPES.has(eventType)) {
      console.warn(`[EventBus] on() called with unknown event type "${eventType}". Use DR.GameEvents.*`);
    }
    let set = listeners.get(eventType);
    if (!set) {
      set = new Set();
      listeners.set(eventType, set);
    }
    set.add(handler);
    return () => off(eventType, handler);
  }

  function off(eventType, handler) {
    const set = listeners.get(eventType);
    if (!set) return false;
    const removed = set.delete(handler);
    if (set.size === 0) listeners.delete(eventType);
    return removed;
  }

  function emit(eventType, payload = {}) {
    const set = listeners.get(eventType);
    if (!set || set.size === 0) return 0;
    // Snapshot so a handler adding/removing a listener for this same event
    // type mid-dispatch cannot corrupt iteration; small and only allocated
    // when there is at least one listener.
    const handlers = [...set];
    let delivered = 0;
    for (const handler of handlers) {
      try {
        handler(payload, eventType);
        delivered++;
      } catch (err) {
        console.warn(`[EventBus] listener for "${eventType}" threw and was skipped:`, err);
      }
    }
    return delivered;
  }

  function listenerCount(eventType) {
    return listeners.get(eventType)?.size || 0;
  }

  DR.GameEvents = GameEvents;
  DR.EventBus = Object.freeze({ on, off, emit, listenerCount });
})();
