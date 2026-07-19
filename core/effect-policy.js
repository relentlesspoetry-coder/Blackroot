// Dream Realms — Effect Policy (Roadmap Item 13: Buff, Debuff, Cooldown & Stacking Rules).
//
// V0.18.65 (foundation slice 1): ONE authoritative, data-driven policy for temporary and
// while-equipped effects and for consumables. Systems QUERY this module — they must not
// hard-code their own caps. This is the home that replaces ad-hoc rules like the old
// hard-coded Bard major-song cap (the roadmap's own cautionary example).
//
// Ownership rules (match core/registry.js): this module OWNS the effect-policy catalog only.
// It does not apply effects, run timers, or store per-actor state — the status-effect / spell /
// item-consumable systems remain the owners of that. They call in here to ask "what is the rule
// for this category?" and "enforce this category's concurrency cap on this actor".
//
// A CATEGORY groups effects/consumables that share a rule set:
//   scope        : 'target'          — counted on the affected actor across ALL sources.
//                  'sourceAndTarget' — counted per (source actor, target actor) pair, e.g. one
//                                       bard's songs on you are independent of another bard's.
//   maxConcurrent: how many of this category may be active at once within the scope.
//                  0 / undefined = unlimited.
//   overflow     : 'dropOldest' (remove oldest to make room) | 'rejectNew' (deny the incoming).
//   stackMode    : 'refresh' (re-apply resets duration) | 'stack' (adds a stack) |
//                  'replaceStronger' (keep the stronger, reject the weaker) | 'independent'.
//   cooldownGroup: shared consumable-cooldown key. Matches item.cooldownGroup, which the item
//                  consumable path (systems/item-compiler-system.js) already keys off of.
//   dispelType   : 'magic' | 'poison' | 'disease' | 'curse' | 'none' (for future dispel rules).
//
// NOTE: only `major_song` is wired to live behaviour in this slice (it replaces the hard-coded
// Bard cap). The food/potion/consumable categories are defined here now as forward-looking DATA
// so the campfire cooking & alchemy work (Roadmap Item 3) consumes an existing policy instead of
// hard-coding fresh caps. Wiring the rest of the systems through this policy is a later slice.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const POLICY_VERSION = 1;

  const CATEGORIES = {
    // Bard major songs: up to 5 active at once from a single bard (per source+target), oldest
    // drops to make room, re-casting refreshes. Replaces the old hard-coded cap of 5.
    major_song:  { scope: 'sourceAndTarget', maxConcurrent: 5, overflow: 'dropOldest', stackMode: 'refresh', dispelType: 'magic' },

    // Consumables (forward-looking data for Roadmap Item 3). Food and buff-potions each hold a
    // single active buff on the actor and share a category cooldown group; instant heal/mana
    // potions have no concurrency but their own cooldown groups.
    food:        { scope: 'target', maxConcurrent: 1, overflow: 'dropOldest', stackMode: 'replaceStronger', cooldownGroup: 'food',        dispelType: 'none' },
    potion_buff: { scope: 'target', maxConcurrent: 1, overflow: 'dropOldest', stackMode: 'replaceStronger', cooldownGroup: 'potion_buff', dispelType: 'magic' },
    potion_heal: { scope: 'target', maxConcurrent: 0, cooldownGroup: 'potion_heal', dispelType: 'none' },
    potion_mana: { scope: 'target', maxConcurrent: 0, cooldownGroup: 'potion_mana', dispelType: 'none' },

    // Generic effect families (define shared rules without capping existing behaviour: cap 0).
    class_buff:  { scope: 'sourceAndTarget', maxConcurrent: 0, stackMode: 'refresh', dispelType: 'magic' },
    dot:         { scope: 'sourceAndTarget', maxConcurrent: 0, stackMode: 'stack',   dispelType: 'magic' },
    poison:      { scope: 'sourceAndTarget', maxConcurrent: 0, stackMode: 'stack',   dispelType: 'poison' },
    curse:       { scope: 'sourceAndTarget', maxConcurrent: 0, stackMode: 'refresh', dispelType: 'curse' }
  };

  const DEFAULT_RULE = Object.freeze({
    scope: 'target', maxConcurrent: 0, overflow: 'dropOldest',
    stackMode: 'refresh', cooldownGroup: null, dispelType: 'magic'
  });

  // Read-only rule lookup with defaults filled in.
  function ruleFor(category) {
    const base = CATEGORIES[category];
    return base ? { ...DEFAULT_RULE, ...base } : { ...DEFAULT_RULE };
  }

  function has(category) { return Object.prototype.hasOwnProperty.call(CATEGORIES, category); }

  // Concurrency cap for a category (0 = unlimited).
  function limitFor(category) { return Math.max(0, Number(ruleFor(category).maxConcurrent) || 0); }

  // Shared consumable-cooldown key for a category (null = per-item cooldown).
  function cooldownGroupFor(category) { return ruleFor(category).cooldownGroup || null; }

  // Classify an effect/consumable object into a category. Prefers an explicit
  // effect.effectCategory (future data may set it), then known runtime flags, else null
  // (uncapped — existing effects keep behaving exactly as before).
  function categoryOf(effect) {
    if (!effect) return null;
    if (effect.effectCategory && has(effect.effectCategory)) return effect.effectCategory;
    if (effect.majorSong === true) return 'major_song';
    return null;
  }

  // Enforce a category's concurrency cap on `actor.buffs`, dropping the oldest matching effects
  // until there is room for one more (the incoming effect). The array order is treated as
  // oldest-first, matching how buffs are pushed. `incomingId` is excluded from the count so the
  // effect about to be applied is not counted against itself. `sourceId` scopes
  // 'sourceAndTarget' categories to a single source actor.
  //
  // Returns: the number of effects removed, or -1 to signal "reject the incoming effect"
  // (overflow: 'rejectNew' when already at the cap). cap <= 0 means unlimited -> returns 0.
  function enforceConcurrency(actor, category, options = {}) {
    if (!actor || !Array.isArray(actor.buffs)) return 0;
    const rule = ruleFor(category);
    const cap = Math.max(0, Number(rule.maxConcurrent) || 0);
    if (cap <= 0) return 0;
    const sourceId = options.sourceId ?? null;
    const incomingId = options.incomingId ?? null;
    const scoped = actor.buffs.filter(b =>
      b && (b.remaining === undefined || b.remaining > 0) &&
      b.id !== incomingId &&
      categoryOf(b) === category &&
      (rule.scope !== 'sourceAndTarget' || (b.sourceId ?? null) === sourceId));
    if (rule.overflow === 'rejectNew') return scoped.length >= cap ? -1 : 0;
    let removed = 0;
    while (scoped.length >= cap) {
      const oldest = scoped.shift();
      actor.buffs = actor.buffs.filter(b => b !== oldest);
      removed += 1;
    }
    return removed;
  }

  // Non-fatal boot-time consistency report, in the same spirit as core/registry.js's
  // runBootValidation. Flags obviously invalid policy entries without throwing.
  function validate() {
    const problems = [];
    const scopes = new Set(['target', 'sourceAndTarget']);
    const overflows = new Set(['dropOldest', 'rejectNew']);
    const stackModes = new Set(['refresh', 'stack', 'replaceStronger', 'independent']);
    for (const [id, raw] of Object.entries(CATEGORIES)) {
      const r = { ...DEFAULT_RULE, ...raw };
      if (!scopes.has(r.scope)) problems.push(`${id}: invalid scope "${r.scope}"`);
      if (!overflows.has(r.overflow)) problems.push(`${id}: invalid overflow "${r.overflow}"`);
      if (!stackModes.has(r.stackMode)) problems.push(`${id}: invalid stackMode "${r.stackMode}"`);
      if (!(Number(r.maxConcurrent) >= 0)) problems.push(`${id}: invalid maxConcurrent "${r.maxConcurrent}"`);
    }
    if (problems.length) {
      console.warn(`[Dream Realms Effect Policy] ${problems.length} policy issue(s):`, problems);
    }
    return problems;
  }

  DR.effectPolicy = Object.freeze({
    POLICY_VERSION,
    categories: () => CATEGORIES,
    has,
    ruleFor,
    limitFor,
    cooldownGroupFor,
    categoryOf,
    enforceConcurrency,
    validate
  });

  try { validate(); } catch (_err) { /* never let a policy report break boot */ }
})();
