// Dream Realms spell editor runtime compiler
// Modular Pass 41: compiles editor spell drafts and class-slot assignments into live hotbar spells.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const DEFAULT_COLOR = '#d8ded1';
  const MAX_HOTBAR_SLOTS = 20;

  const KIND_ALIASES = {
    projectile: 'bolt',
    missile: 'bolt',
    direct_damage: 'bolt',
    single_damage: 'bolt',
    damage: 'bolt',
    dot: 'boltDot',
    damage_over_time: 'boltDot',
    area_damage: 'aoe',
    area: 'aoe',
    melee_aoe: 'aoeMelee',
    cleave: 'aoeMelee',
    melee_damage: 'melee',
    strike: 'melee',
    melee_debuff: 'meleeDebuff',
    area_debuff: 'aoeDebuff',
    group_buff: 'groupBuff',
    party_buff: 'groupBuff',
    area_heal: 'aoeHeal',
    group_heal: 'aoeHeal',
    pet_heal: 'petHeal',
    pet_buff: 'petBuff',
    dash: 'dashStrike',
    teleport_strike: 'dashStrike',
    summon_bolt: 'boltSummon',
    summon_pet: 'summonPet',
    summon: 'summonPet',
    lifetap: 'drain',
    life_tap: 'drain',
    mana_restore: 'mana',
    restore_mana: 'mana',
    cure: 'cleanse',
    cure_poison: 'cleanse',
    purify: 'cleanse'
  };

  const SUPPORTED_KINDS = new Set([
    'buff', 'groupBuff', 'heal', 'mana', 'petHeal', 'petBuff', 'aoeHeal',
    'aoe', 'aoeMelee', 'aoeDebuff', 'melee', 'meleeDebuff', 'dashStrike',
    'drain', 'debuff', 'boltDot', 'boltSummon', 'summonPet', 'bolt', 'cleanse', 'revive', 'petSacrifice', 'tempMinions', 'transform'
  ]);

  function clone(value, fallback = null) {
    if (value === undefined || value === null) return fallback;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return fallback; }
  }

  // Phase 3 (Combat/Spell Parity): projectile descriptor for bolt-family
  // damage kinds. This is metadata only - it describes travel speed/pierce/
  // homing for a future or opt-in visual travel-time bolt (see
  // Game.prototype.spawnBolt in systems/effects-system.js, the only current
  // consumer, and only for plain 'bolt' kind spells). It does not change
  // when damage is applied (still instant on cast, unchanged).
  const PROJECTILE_KINDS = new Set(['bolt', 'boltDot', 'boltSummon', 'drain']);
  function projectileDescriptorFor(kind, draft) {
    if (!PROJECTILE_KINDS.has(kind)) return null;
    return {
      speed: Math.max(1, numberOr(draft.projectileSpeed, 30)),
      pierce: draft.projectilePierce === true,
      homing: draft.projectileHoming === true
    };
  }

  function compactId(value, fallback = 'spell') {
    return String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || fallback;
  }

  function numberOr(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  }

  function intOr(value, fallback = 0) {
    return Math.floor(numberOr(value, fallback));
  }

  function nullableNumber(value) {
    if (value === '' || value === undefined || value === null) return null;
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }

  function normalizeKind(kind, draft = {}) {
    const raw = String(kind || draft.runtimeKind || '').trim();
    if (SUPPORTED_KINDS.has(raw)) return raw;
    const key = raw.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (KIND_ALIASES[key]) return KIND_ALIASES[key];

    const role = String(draft.role || '').toLowerCase();
    const target = String(draft.target || '').toLowerCase();
    if (role.includes('heal')) return target.includes('area') || target.includes('party') ? 'aoeHeal' : 'heal';
    if (role.includes('support') || role.includes('buff')) return target.includes('party') || target.includes('group') ? 'groupBuff' : 'buff';
    if (role.includes('control') || role.includes('debuff')) return target.includes('area') ? 'aoeDebuff' : 'debuff';
    return 'bolt';
  }

  function roleForKind(kind) {
    if (kind === 'heal' || kind === 'petHeal' || kind === 'aoeHeal') return 'healing';
    if (kind === 'buff' || kind === 'groupBuff' || kind === 'petBuff' || kind === 'mana' || kind === 'cleanse' || kind === 'revive' || kind === 'petSacrifice' || kind === 'transform') return 'support';
    if (kind === 'debuff' || kind === 'aoeDebuff' || kind === 'drain' || kind === 'boltDot') return 'control';
    return 'damage';
  }

  function targetForKind(kind) {
    if (kind === 'heal' || kind === 'mana' || kind === 'cleanse' || kind === 'revive' || kind === 'petHeal' || kind === 'buff' || kind === 'petBuff' || kind === 'summonPet' || kind === 'petSacrifice' || kind === 'transform') return 'ally_or_self';
    if (kind === 'groupBuff' || kind === 'aoeHeal') return 'party_area';
    if (kind === 'aoe' || kind === 'aoeDebuff' || kind === 'aoeMelee') return 'enemy_area';
    return 'enemy';
  }

  function isTargetedKind(kind) {
    return kind === 'bolt' || kind === 'boltDot' || kind === 'boltSummon' ||
      kind === 'debuff' || kind === 'drain' || kind === 'melee' ||
      kind === 'meleeDebuff' || kind === 'dashStrike' || kind === 'cleanse' || kind === 'revive' || kind === 'tempMinions';
  }

  function isPetKind(kind) {
    return kind === 'petHeal' || kind === 'petBuff' || kind === 'petSacrifice';
  }

  function synthesizeEffects(spell) {
    const kind = spell.kind;
    const power = spell.power || spell.heal || 0;
    const effects = [];
    if (kind === 'summonPet') effects.push({ type: 'summon_pet', target: 'self' });
    else if (kind === 'cleanse') effects.push({ type: 'cleanse', tags: clone(spell.removesStatusTags, ['poison']), target: 'ally_or_self' });
    else if (kind === 'revive') effects.push({ type: 'revive', hpPct: spell.reviveHpPct || 0.35, manaPct: spell.reviveManaPct || 0.25, target: 'dead_ally' });
    else if (kind === 'heal' || kind === 'petHeal') effects.push({ type: 'heal', value: spell.heal || power, target: kind === 'petHeal' ? 'pet' : 'lowest_ally' });
    else if (kind === 'aoeHeal') {
      effects.push({ type: 'heal', value: spell.heal || power, target: 'self' });
      effects.push({ type: 'damage', value: power, target: 'enemy_area', radius: spell.radius || 4 });
    } else if (kind === 'mana') effects.push({ type: 'mana', value: power, target: 'self' });
    else if (kind === 'buff' || kind === 'groupBuff' || kind === 'petBuff') {
      effects.push({ type: 'buff', name: spell.buffName || spell.name, duration: spell.duration || 8, mods: clone(spell.mods, {}), target: kind === 'groupBuff' ? 'party' : (kind === 'petBuff' ? 'pet' : 'self') });
    } else if (kind === 'aoe' || kind === 'aoeMelee') effects.push({ type: 'damage', value: power, target: 'enemy_area', radius: spell.radius || 4 });
    else if (kind === 'aoeDebuff') {
      effects.push({ type: 'damage', value: power, target: 'enemy_area', radius: spell.radius || 4 });
      effects.push({ type: 'debuff', name: spell.name, duration: spell.duration || 4, mods: clone(spell.mods, {}), target: 'enemy_area', radius: spell.radius || 4 });
    } else if (kind === 'drain') {
      effects.push({ type: 'damage', value: power, target: 'enemy' });
      effects.push({ type: 'heal', value: Math.floor(power * 0.55), target: 'self' });
    } else {
      effects.push({ type: 'damage', value: power, target: 'enemy' });
      if (spell.mods && Object.keys(spell.mods).length) effects.push({ type: 'debuff', name: spell.name, duration: spell.duration || 5, mods: clone(spell.mods, {}), target: 'enemy' });
      if (kind === 'boltSummon') effects.push({ type: 'summon_pet', target: 'self' });
    }
    return effects;
  }

  function compileSpellDraft(draft, options = {}) {
    if (!draft || typeof draft !== 'object') return null;
    const kind = normalizeKind(draft.kind || draft.runtimeKind, draft);
    const className = String(draft.className || options.className || 'Bard').trim() || 'Bard';
    const slotIndex = Math.max(0, Math.min(19, intOr(draft.slotIndex, options.slotIndex ?? 0)));
    const id = String(draft.id || `spell_${compactId(className)}_${compactId(draft.name)}`);
    const name = String(draft.name || id).trim() || id;
    const powerValue = nullableNumber(draft.power);
    const healValue = nullableNumber(draft.heal);
    const compiled = {
      id,
      editorSpellId: id,
      compiledFromEditor: true,
      name,
      className,
      slotIndex,
      hotkey: String(slotIndex + 2),
      role: String(draft.role || roleForKind(kind)),
      kind,
      target: String(draft.target || targetForKind(kind)),
      cost: Math.max(0, intOr(draft.cost, 0)),
      cooldown: Math.max(0, numberOr(draft.cooldown, 0)),
      // Phase 3 (Combat/Spell Parity): optional shared-cooldown group id.
      // No shipped spell draft sets this today, so this is inert until a
      // future spell explicitly opts in - see Game.prototype.applySpellCooldownGroup
      // in systems/spell-system.js, the only reader of this field.
      cooldownGroup: draft.cooldownGroup ? String(draft.cooldownGroup) : null,
      projectile: projectileDescriptorFor(kind, draft),
      range: nullableNumber(draft.range) ?? (isTargetedKind(kind) ? (kind === 'melee' || kind === 'meleeDebuff' ? 2 : 7) : null),
      radius: nullableNumber(draft.radius),
      power: powerValue ?? (healValue ?? 0),
      heal: healValue,
      duration: nullableNumber(draft.duration),
      buffName: draft.buffName || (kind === 'buff' || kind === 'groupBuff' || kind === 'petBuff' || kind === 'transform' ? name : null),
      mods: draft.mods && typeof draft.mods === 'object' ? clone(draft.mods, {}) : {},
      color: String(draft.color || DEFAULT_COLOR),
      animation: clone(draft.animation, {}),
      sound: clone(draft.sound, {}),
      description: String(draft.description || ''),
      levelRequirement: Math.max(1, intOr(draft.levelRequirement ?? draft.level ?? draft.unlockLevel, 1)),
      tickDamage: nullableNumber(draft.tickDamage ?? draft.statusDamage),
      tickDuration: nullableNumber(draft.tickDuration),
      tickRate: nullableNumber(draft.tickRate ?? draft.tickIntervalSeconds),
      damageType: draft.damageType || null,
      statusId: draft.statusId || null,
      statusName: draft.statusName || null,
      tags: Array.isArray(draft.tags) ? clone(draft.tags, []) : [],
      noLevelScaling: draft.noLevelScaling === true,
      instant: draft.instant === true,
      necroSpellId: draft.necroSpellId || null,
      petName: draft.petName || draft.summonName || null,
      petType: draft.petType || null,
      petColor: draft.petColor || null,
      petAttack: nullableNumber(draft.petAttack),
      petHp: nullableNumber(draft.petHp),
      petAttackMin: nullableNumber(draft.petAttackMin),
      petAttackMax: nullableNumber(draft.petAttackMax),
      petAttackSpeed: nullableNumber(draft.petAttackSpeed),
      petDamageType: draft.petDamageType || null,
      petDefense: nullableNumber(draft.petDefense),
      replacePet: draft.replacePet === true,
      shieldBashDamage: nullableNumber(draft.shieldBashDamage),
      shieldBashCooldown: nullableNumber(draft.shieldBashCooldown),
      petSacrificePct: nullableNumber(draft.petSacrificePct),
      nextDotBonusPct: nullableNumber(draft.nextDotBonusPct),
      deathPactWindow: nullableNumber(draft.deathPactWindow),
      executeBonusBelowPct: nullableNumber(draft.executeBonusBelowPct),
      executeThresholdPct: nullableNumber(draft.executeThresholdPct),
      executeBonusDamage: nullableNumber(draft.executeBonusDamage),
      manaRestoreOnKill: nullableNumber(draft.manaRestoreOnKill),
      drainHealPct: nullableNumber(draft.drainHealPct),
      rootDuration: nullableNumber(draft.rootDuration),
      slowPct: nullableNumber(draft.slowPct),
      fearDuration: nullableNumber(draft.fearDuration),
      physicalDamageTakenMultiplier: nullableNumber(draft.physicalDamageTakenMultiplier),
      healingReceivedMultiplier: nullableNumber(draft.healingReceivedMultiplier),
      moveSpeedMultiplier: nullableNumber(draft.moveSpeedMultiplier),
      dotAmpPct: nullableNumber(draft.dotAmpPct),
      drainAmpPct: nullableNumber(draft.drainAmpPct),
      petDamageBonusPct: nullableNumber(draft.petDamageBonusPct),
      selfBuffName: draft.selfBuffName || null,
      selfBuffDuration: nullableNumber(draft.selfBuffDuration),
      selfBuffMods: draft.selfBuffMods && typeof draft.selfBuffMods === 'object' ? clone(draft.selfBuffMods, {}) : null,
      petHealTick: nullableNumber(draft.petHealTick),
      petHealDuration: nullableNumber(draft.petHealDuration),
      petHealTickRate: nullableNumber(draft.petHealTickRate),
      tempMinionCount: nullableNumber(draft.tempMinionCount),
      tempMinionDuration: nullableNumber(draft.tempMinionDuration),
      dotDamageMultiplier: nullableNumber(draft.dotDamageMultiplier),
      drainHealingMultiplier: nullableNumber(draft.drainHealingMultiplier),
      periodicMana: nullableNumber(draft.periodicMana),
      periodicManaRate: nullableNumber(draft.periodicManaRate),
      petDamageMultiplier: nullableNumber(draft.petDamageMultiplier),
      allyHealingReceivedMultiplier: nullableNumber(draft.allyHealingReceivedMultiplier),
      category: draft.category || null,
      note: draft.note || null,
      selfOnly: draft.selfOnly === true,
      removesStatusTags: Array.isArray(draft.removesStatusTags) ? clone(draft.removesStatusTags, []) : [],
      reviveHpPct: nullableNumber(draft.reviveHpPct),
      reviveManaPct: nullableNumber(draft.reviveManaPct),
      castTime: nullableNumber(draft.castTime),
      requiresTarget: isTargetedKind(kind),
      requiresPet: isPetKind(kind),
      effects: Array.isArray(draft.effects) && draft.effects.length ? clone(draft.effects, []) : null
    };
    for (const [key, value] of Object.entries(draft || {})) {
      if (compiled[key] !== undefined) continue;
      compiled[key] = clone(value, value);
    }
    compiled.effects = compiled.effects || synthesizeEffects(compiled);
    if (kind === 'aoe' || kind === 'aoeDebuff' || kind === 'aoeMelee' || kind === 'aoeHeal') compiled.radius = compiled.radius ?? 4;
    if (kind === 'groupBuff') compiled.radius = compiled.radius ?? 16;
    if (kind === 'buff') compiled.radius = compiled.radius ?? 14;
    return compiled;
  }

  function buildRuntimeBooks(editorSpells, classSpellSlots) {
    const sourceSpells = editorSpells && typeof editorSpells === 'object' ? editorSpells : (DR.SPELL_BY_ID || {});
    const sourceSlots = classSpellSlots && typeof classSpellSlots === 'object' ? classSpellSlots : {};
    const books = {};
    const index = {};
    const errors = [];
    const byClass = {};

    for (const [id, draft] of Object.entries(sourceSpells || {})) {
      const compiled = compileSpellDraft({ ...draft, id: draft?.id || id });
      if (!compiled) {
        errors.push(`Skipped invalid spell draft ${id}.`);
        continue;
      }
      index[compiled.id] = compiled;
      if (!byClass[compiled.className]) byClass[compiled.className] = [];
      byClass[compiled.className].push(compiled);
    }

    const classNames = new Set([
      ...Object.keys(DR.CLASSES || {}),
      ...Object.keys(byClass),
      ...Object.keys(sourceSlots || {})
    ]);

    for (const className of classNames) {
      const slots = new Array(MAX_HOTBAR_SLOTS).fill(null);
      const explicitSlots = Array.isArray(sourceSlots[className]) ? sourceSlots[className] : null;
      if (explicitSlots) {
        for (let i = 0; i < Math.min(MAX_HOTBAR_SLOTS, explicitSlots.length); i++) {
          const spellId = explicitSlots[i];
          if (!spellId) continue;
          if (index[spellId]) slots[i] = index[spellId];
          else errors.push(`Missing spell ${spellId} assigned to ${className} slot ${i}.`);
        }
      }

      const classDrafts = (byClass[className] || []).slice().sort((a, b) => {
        const slotCompare = Number(a.slotIndex || 0) - Number(b.slotIndex || 0);
        if (slotCompare) return slotCompare;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      for (const spell of classDrafts) {
        const slot = Math.max(0, Math.min(MAX_HOTBAR_SLOTS - 1, intOr(spell.slotIndex, 0)));
        if (!slots[slot]) slots[slot] = spell;
      }
      books[className] = slots;
    }

    return { books, spellsById: index, errors };
  }

  function seedDefaultClassSpellSlots(editorSpells) {
    const slots = {};
    for (const spell of Object.values(editorSpells || {})) {
      if (!spell || !spell.className) continue;
      const className = String(spell.className);
      if (!Array.isArray(slots[className])) slots[className] = [];
      const slot = Math.max(0, Math.min(MAX_HOTBAR_SLOTS - 1, intOr(spell.slotIndex, 0)));
      if (!slots[className][slot]) slots[className][slot] = spell.id;
    }
    return slots;
  }

  function compileGlobalDefaults() {
    const drafts = DR.SPELL_BY_ID || DR.SPELL_DRAFTS || {};
    const slots = seedDefaultClassSpellSlots(drafts);
    DR.DEFAULT_CLASS_SPELL_SLOTS = slots;
    const compiled = buildRuntimeBooks(drafts, slots);
    DR.COMPILED_CLASS_SPELL_BOOK = compiled.books;
    DR.COMPILED_SPELL_BY_ID = compiled.spellsById;
    DR.SPELL_COMPILER_ERRORS = compiled.errors;
    DR.Registry?.recordCompilerErrors?.('spell', compiled.errors);
    return compiled;
  }

  DR.SpellRuntimeCompiler = {
    MAX_HOTBAR_SLOTS,
    SUPPORTED_KINDS: Array.from(SUPPORTED_KINDS),
    KIND_ALIASES,
    normalizeKind,
    compileSpellDraft,
    buildRuntimeBooks,
    seedDefaultClassSpellSlots,
    compileGlobalDefaults,
    isTargetedKind,
    isPetKind
  };

  compileGlobalDefaults();
})();
