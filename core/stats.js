// Dream Realms core stat math and class attribute scaling.
// V0.12.38 owns armor/CDR diminishing returns, crit caps, and attribute-derived combat output.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const clamp = DR.utils?.clamp || ((value, min, max) => Math.max(min, Math.min(max, value)));

  const ATTRIBUTE_KEYS = ['strength', 'dexterity', 'stamina', 'intelligence', 'wisdom'];
  // V0.18.93: the item/data + display vocabulary writes the attributes under different spellings than
  // the canonical keys (the game DISPLAYS dexterity as "Agility", intelligence as "Intellect", wisdom
  // as "Spirit"). Without folding these aliases in, every 'agility' / 'intellect' / 'spirit' bonus on
  // gear/talents/sets was a silent dead stat. Map each alias to its canonical attribute.
  const ATTRIBUTE_ALIASES = {
    str: 'strength', dex: 'dexterity', agility: 'dexterity', sta: 'stamina',
    int: 'intelligence', intellect: 'intelligence', wis: 'wisdom', spirit: 'wisdom'
  };
  const STAT_KEYS = [
    'hp', 'mana', 'attack', 'defense', 'speed', 'armor', 'cdr', 'cooldownReduction',
    'crit', 'critChance', 'magicCrit', 'magicCritChance', 'critDamage', 'magicCritDamage',
    'spellPower', 'healingPower', 'damagePower', 'physicalPower', 'magicPower',
    'damagePct', 'physicalDamagePct', 'magicDamagePct', 'healingPct',
    // Phase 8a (Intersect parity): magic-damage-only mitigation stat, layered on
    // top of (never replacing) armorReduction. Zero by default on every existing
    // class/item, so no prior combat outcome changes unless content opts in.
    'magicResist', 'hpRegen', 'manaRegen',
    // V0.18.96: poison/venom damage-taken reduction (silk-cavern content). Rating -> reduction via a
    // diminishing-return curve like magicResist; applied to poison-tagged DoT ticks only.
    'poisonResist',
    ...ATTRIBUTE_KEYS
  ];

  const CLASS_ATTRIBUTES = {
    Paladin:      { strength: 13, dexterity: 7, stamina: 17, intelligence: 8, wisdom: 14 },
    Warden:       { strength: 12, dexterity: 8, stamina: 18, intelligence: 7, wisdom: 14 },
    Fighter:      { strength: 17, dexterity: 9, stamina: 13, intelligence: 5, wisdom: 6 },
    Rogue:        { strength: 12, dexterity: 17, stamina: 10, intelligence: 7, wisdom: 8 },
    Ranger:       { strength: 10, dexterity: 17, stamina: 11, intelligence: 7, wisdom: 11 },
    Assassin:     { strength: 10, dexterity: 18, stamina: 9, intelligence: 9, wisdom: 7 },
    Wizard:       { strength: 5, dexterity: 8, stamina: 8, intelligence: 18, wisdom: 11 },
    Shaman:       { strength: 7, dexterity: 8, stamina: 10, intelligence: 14, wisdom: 15 },
    Summoner:     { strength: 6, dexterity: 8, stamina: 8, intelligence: 15, wisdom: 12 },
    Necromancer:  { strength: 7, dexterity: 8, stamina: 9, intelligence: 15, wisdom: 10 },
    Cleric:       { strength: 8, dexterity: 7, stamina: 12, intelligence: 10, wisdom: 16 },
    Druid:        { strength: 8, dexterity: 9, stamina: 11, intelligence: 13, wisdom: 15 },
    Bard:         { strength: 9, dexterity: 12, stamina: 10, intelligence: 10, wisdom: 13 },
    Enchanter:    { strength: 6, dexterity: 9, stamina: 8, intelligence: 16, wisdom: 12 }
  };

  const CLASS_ATTRIBUTE_GROWTH = {
    Paladin:      { strength: 2, dexterity: 1, stamina: 3, intelligence: 0, wisdom: 2 },
    Warden:       { strength: 2, dexterity: 1, stamina: 3, intelligence: 0, wisdom: 2 },
    Fighter:      { strength: 3, dexterity: 2, stamina: 2, intelligence: 0, wisdom: 0 },
    Rogue:        { strength: 2, dexterity: 3, stamina: 1, intelligence: 1, wisdom: 1 },
    Ranger:       { strength: 1, dexterity: 3, stamina: 1, intelligence: 1, wisdom: 2 },
    Assassin:     { strength: 1, dexterity: 3, stamina: 1, intelligence: 2, wisdom: 1 },
    Wizard:       { strength: 0, dexterity: 1, stamina: 1, intelligence: 3, wisdom: 2 },
    Shaman:       { strength: 1, dexterity: 1, stamina: 2, intelligence: 2, wisdom: 3 },
    Summoner:     { strength: 0, dexterity: 1, stamina: 1, intelligence: 3, wisdom: 2 },
    Necromancer:  { strength: 1, dexterity: 1, stamina: 1, intelligence: 3, wisdom: 1 },
    Cleric:       { strength: 1, dexterity: 1, stamina: 2, intelligence: 1, wisdom: 3 },
    Druid:        { strength: 1, dexterity: 1, stamina: 2, intelligence: 2, wisdom: 3 },
    Bard:         { strength: 1, dexterity: 2, stamina: 1, intelligence: 1, wisdom: 2 },
    Enchanter:    { strength: 0, dexterity: 1, stamina: 1, intelligence: 3, wisdom: 2 }
  };

  const RULES = {
    armor: {
      cap: 0.68,
      denominatorBase: 42,
      denominatorPerLevel: 5.5
    },
    cooldownReduction: {
      cap: 0.40,
      denominatorBase: 72,
      denominatorPerLevel: 7.5
    },
    critChance: {
      base: 0.05,
      cap: 0.50,
      ratingCap: 0.30,
      denominatorBase: 78,
      denominatorPerLevel: 6.0
    },
    magicCritChance: {
      base: 0.05,
      cap: 0.45,
      ratingCap: 0.28,
      denominatorBase: 82,
      denominatorPerLevel: 6.5
    },
    critDamage: {
      base: 1.50,
      cap: 2.35,
      ratingCap: 0.65,
      denominatorBase: 96,
      denominatorPerLevel: 8.0
    },
    magicCritDamage: {
      base: 1.50,
      cap: 2.30,
      ratingCap: 0.60,
      denominatorBase: 100,
      denominatorPerLevel: 8.0
    },
    physicalDamageMultiplierCap: 2.15,
    magicDamageMultiplierCap: 2.20,
    healingMultiplierCap: 2.25,
    // Phase 8a: magic-resist diminishing-return curve, mirroring armor's shape.
    // Only ever fed by the magicResist stat (equipment/buffs) - no implicit
    // level/attribute scaling - so it stays at 0 (fully inert) for any entity
    // that doesn't explicitly carry the stat.
    magicResist: {
      cap: 0.60,
      denominatorBase: 46,
      denominatorPerLevel: 5.5
    },
    // V0.18.96: poison-resist diminishing-return curve. A NICHE, specialised resistance (only matters
    // vs poison/venom), so it stacks more generously than magicResist and caps higher - but never
    // fully negates poison. Fed only by the poisonResist stat (gear/buffs); 0 (inert) otherwise.
    poisonResist: {
      cap: 0.75,
      denominatorBase: 24,
      denominatorPerLevel: 3.0
    }
  };

  const numberOr = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const floorStat = (value, fallback = 0) => Math.floor(numberOr(value, fallback));

  function cleanStats(stats = {}) {
    const out = {};
    for (const key of STAT_KEYS) out[key] = 0;
    for (const [key, value] of Object.entries(stats || {})) {
      const n = numberOr(value, 0);
      if (!n) continue;
      out[key] = key === 'speed' ? Number(n.toFixed(3)) : n;
    }
    return out;
  }

  function addStats(target, source) {
    if (!source || typeof source !== 'object') return target;
    for (const [key, value] of Object.entries(source)) {
      const n = numberOr(value, 0);
      if (!n) continue;
      target[key] = (target[key] || 0) + n;
    }
    return target;
  }

  function attributesForClass(className, level = 1) {
    const base = CLASS_ATTRIBUTES[className] || CLASS_ATTRIBUTES.Fighter;
    const growth = CLASS_ATTRIBUTE_GROWTH[className] || CLASS_ATTRIBUTE_GROWTH.Fighter;
    const lvl = Math.max(1, Math.floor(numberOr(level, 1)));
    const out = {};
    for (const key of ATTRIBUTE_KEYS) {
      out[key] = Math.max(0, Math.floor(numberOr(base[key], 0) + numberOr(growth[key], 0) * (lvl - 1)));
    }
    return out;
  }

  function mergeAttributes(className, level, bonusStats = {}) {
    const out = attributesForClass(className, level);
    for (const key of ATTRIBUTE_KEYS) {
      let bonus = numberOr(bonusStats[key], 0);
      // fold in any alias spellings that map to this attribute (see ATTRIBUTE_ALIASES).
      for (const alias in ATTRIBUTE_ALIASES) {
        if (ATTRIBUTE_ALIASES[alias] === key) bonus += numberOr(bonusStats[alias], 0);
      }
      out[key] = Math.max(0, Math.floor(out[key] + bonus));
    }
    return out;
  }

  function diminishingReturn(rating, level, rule) {
    const r = Math.max(0, numberOr(rating, 0));
    if (r <= 0) return 0;
    const lvl = Math.max(1, Math.floor(numberOr(level, 1)));
    const denominator = Math.max(1, numberOr(rule.denominatorBase, 1) + lvl * numberOr(rule.denominatorPerLevel, 0));
    return clamp((r / (r + denominator)) * numberOr(rule.cap, 1), 0, numberOr(rule.cap, 1));
  }

  function ratingContribution(rating, level, rule) {
    return diminishingReturn(rating, level, {
      cap: rule.ratingCap ?? rule.cap,
      denominatorBase: rule.denominatorBase,
      denominatorPerLevel: rule.denominatorPerLevel
    });
  }

  function percentStat(value) {
    const n = numberOr(value, 0);
    return Math.abs(n) > 1 ? n / 100 : n;
  }

  function computePlayerDerived(className, level, basePrimary, bonuses = {}, raceMods = {}) {
    const totals = cleanStats(bonuses);
    const attributes = mergeAttributes(className, level, totals);
    // Race modifiers are runtime-derived after class growth/permanent bonuses and
    // before equipment-derived combat output. They are never baked into saves.
    for (const key of ATTRIBUTE_KEYS) attributes[key] = Math.max(0, Math.floor(attributes[key] + numberOr(raceMods?.[key], 0)));
    const str = attributes.strength;
    const dex = attributes.dexterity;
    const sta = attributes.stamina;
    const int = attributes.intelligence;
    const wis = attributes.wisdom;

    const maxHp = Math.max(1, floorStat(basePrimary.maxHp, 1) + floorStat(totals.hp) + Math.floor(sta * 2.2));
    const maxMana = Math.max(0, floorStat(basePrimary.maxMana, 0) + floorStat(totals.mana) + Math.floor(int * 1.7 + wis * 1.1));
    const attack = Math.max(1, floorStat(basePrimary.attack, 1) + floorStat(totals.attack) + Math.floor(str * 0.32 + dex * 0.10));
    const defense = Math.max(0, floorStat(basePrimary.defense, 0) + floorStat(totals.defense) + Math.floor(sta * 0.18));
    const speed = Math.max(0.65, numberOr(basePrimary.speed, 1) + numberOr(totals.speed, 0) + dex * 0.0035);

    // Phase 8a: magic resist is purely additive from base/equipment/buffs -
    // no attribute scaling - so it is 0 for every class/item that doesn't
    // explicitly set it (opt-in only, matches the "no rebalance" requirement).
    const magicResistRating = Math.max(0, floorStat(basePrimary.magicResist) + floorStat(totals.magicResist));
    const magicResistReduction = magicResistRating > 0 ? diminishingReturn(magicResistRating, level, RULES.magicResist) : 0;
    // V0.18.96: poison resist, same additive-rating -> DR shape as magic resist (opt-in via the stat).
    const poisonResistRating = Math.max(0, floorStat(basePrimary.poisonResist) + floorStat(totals.poisonResist));
    const poisonResistReduction = poisonResistRating > 0 ? diminishingReturn(poisonResistRating, level, RULES.poisonResist) : 0;
    const hpRegen = Math.max(0, numberOr(basePrimary.hpRegen, 0) + numberOr(totals.hpRegen, 0));
    const manaRegen = Math.max(0, numberOr(basePrimary.manaRegen, 0) + numberOr(totals.manaRegen, 0));

    const armorRating = Math.max(0, defense + floorStat(totals.armor) + Math.floor(sta * 0.52));
    const cdrRating = Math.max(0,
      numberOr(totals.cdr, 0) + numberOr(totals.cooldownReduction, 0) + int * 0.22 + wis * 0.26 + dex * 0.08
    );
    const critRating = Math.max(0, numberOr(totals.crit, 0) + numberOr(totals.critChance, 0));
    const magicCritRating = Math.max(0, numberOr(totals.magicCrit, 0) + numberOr(totals.magicCritChance, 0));
    const critDamageRating = Math.max(0, numberOr(totals.critDamage, 0));
    const magicCritDamageRating = Math.max(0, numberOr(totals.magicCritDamage, 0));

    const armorReduction = diminishingReturn(armorRating, level, RULES.armor);
    const cooldownReduction = diminishingReturn(cdrRating, level, RULES.cooldownReduction);
    const critChance = clamp(
      RULES.critChance.base + dex * 0.0025 + str * 0.0007 + ratingContribution(critRating, level, RULES.critChance),
      0,
      RULES.critChance.cap
    );
    const magicCritChance = clamp(
      RULES.magicCritChance.base + wis * 0.0018 + int * 0.0013 + ratingContribution(magicCritRating, level, RULES.magicCritChance),
      0,
      RULES.magicCritChance.cap
    );
    const critDamageMultiplier = clamp(
      RULES.critDamage.base + str * 0.003 + dex * 0.001 + ratingContribution(critDamageRating, level, RULES.critDamage),
      RULES.critDamage.base,
      RULES.critDamage.cap
    );
    const magicCritDamageMultiplier = clamp(
      RULES.magicCritDamage.base + int * 0.0025 + wis * 0.0015 + ratingContribution(magicCritDamageRating, level, RULES.magicCritDamage),
      RULES.magicCritDamage.base,
      RULES.magicCritDamage.cap
    );

    const physicalDamageMultiplier = clamp(
      1 + str * 0.006 + dex * 0.002 + numberOr(totals.damagePower, 0) / 260 + numberOr(totals.physicalPower, 0) / 230 + percentStat(totals.damagePct) + percentStat(totals.physicalDamagePct),
      0.30,
      RULES.physicalDamageMultiplierCap
    );
    const magicDamageMultiplier = clamp(
      1 + int * 0.007 + wis * 0.002 + numberOr(totals.spellPower, 0) / 230 + numberOr(totals.magicPower, 0) / 220 + percentStat(totals.damagePct) + percentStat(totals.magicDamagePct),
      0.30,
      RULES.magicDamageMultiplierCap
    );
    const healingMultiplier = clamp(
      1 + wis * 0.008 + int * 0.002 + numberOr(totals.healingPower, 0) / 220 + percentStat(totals.healingPct),
      0.30,
      RULES.healingMultiplierCap
    );

    return {
      attributes,
      totals,
      maxHp,
      maxMana,
      attack,
      defense,
      speed,
      armorRating,
      armorReduction,
      magicResistRating,
      magicResistReduction,
      poisonResistRating,
      poisonResistReduction,
      hpRegen,
      manaRegen,
      cooldownReduction,
      cooldownReductionRating: cdrRating,
      critChance,
      magicCritChance,
      critDamageMultiplier,
      magicCritDamageMultiplier,
      physicalDamageMultiplier,
      magicDamageMultiplier,
      healingMultiplier
    };
  }

  function effectiveCooldown(baseSeconds, entity) {
    const base = Math.max(0, numberOr(baseSeconds, 0));
    if (base <= 0) return 0;
    const cdr = clamp(numberOr(entity?.cooldownReduction ?? entity?.derivedStats?.cooldownReduction, 0), 0, RULES.cooldownReduction.cap);
    return Math.max(0.35, base * (1 - cdr));
  }

  function armorReductionFor(entity) {
    if (!entity) return 0;
    if (Number.isFinite(Number(entity.armorReduction)) && Number(entity.armorReduction) > 0) return clamp(Number(entity.armorReduction), 0, RULES.armor.cap);
    const lvl = Math.max(1, floorStat(entity.level, 1));
    const defense = typeof entity.getStat === 'function' ? entity.getStat('defense') : numberOr(entity.defense, 0);
    const armor = typeof entity.getStat === 'function' ? entity.getStat('armor') : numberOr(entity.armor, 0);
    const rating = Math.max(0, numberOr(armor, 0) + numberOr(defense, 0) + (entity.kind === 'enemy' ? lvl * 0.7 : lvl * 1.1));
    return diminishingReturn(rating, lvl, RULES.armor);
  }

  // Phase 8a: magic-only mitigation, additive on top of armorReductionFor (never
  // a replacement for it) - see systems/combat-system.js damageEntity, which
  // stacks the two multiplicatively. Returns 0 (fully inert) unless the entity
  // explicitly carries a positive magicResist stat via base/equipment/buffs.
  function magicResistReductionFor(entity) {
    if (!entity) return 0;
    if (Number.isFinite(Number(entity.magicResistReduction)) && Number(entity.magicResistReduction) > 0) {
      return clamp(Number(entity.magicResistReduction), 0, RULES.magicResist.cap);
    }
    const rating = typeof entity.getStat === 'function' ? entity.getStat('magicResist') : numberOr(entity.magicResist, 0);
    if (!(rating > 0)) return 0;
    const lvl = Math.max(1, floorStat(entity.level, 1));
    return diminishingReturn(rating, lvl, RULES.magicResist);
  }

  // V0.18.96: poison/venom damage-taken reduction for an entity. Mirrors magicResistReductionFor:
  // prefer a pre-derived entity.poisonResistReduction (set by recalculatePlayerStats), else derive
  // from the poisonResist stat/rating. Returns 0 (inert) unless the entity carries the stat.
  function poisonResistReductionFor(entity) {
    if (!entity) return 0;
    if (Number.isFinite(Number(entity.poisonResistReduction)) && Number(entity.poisonResistReduction) > 0) {
      return clamp(Number(entity.poisonResistReduction), 0, RULES.poisonResist.cap);
    }
    const rating = typeof entity.getStat === 'function' ? entity.getStat('poisonResist') : numberOr(entity.poisonResist, 0);
    if (!(rating > 0)) return 0;
    const lvl = Math.max(1, floorStat(entity.level, 1));
    return diminishingReturn(rating, lvl, RULES.poisonResist);
  }

  // V0.17.70 BUG 2 fix: damage-type -> combat school. data/spells.js ships ~15
  // non-physical, non-holy damage types (fire/frost/nature/arcane/lightning/
  // earth/sonic/psychic/lunar/planar/spirit/primal/bone/disease/poison and the
  // literal 'magic'; plus shadow). Before this map they fell through to the
  // PHYSICAL branch everywhere - mitigated by armor and critting off the
  // physical crit table - so e.g. a Fireball crit off dexterity. They are all
  // magic-school. 'holy' and 'physical' keep their existing behavior (holy is
  // deliberately left on the physical crit/output path per spec); 'true'
  // bypasses. Unknown/auto-attack default -> physical (unchanged).
  const MAGIC_DAMAGE_TYPES = new Set([
    'magic', 'fire', 'frost', 'arcane', 'lunar', 'planar', 'psychic', 'nature',
    'spirit', 'lightning', 'earth', 'sonic', 'primal', 'bone', 'disease', 'poison', 'shadow'
  ]);
  function damageSchoolFor(damageType) {
    if (damageType === 'true') return 'true';
    if (damageType === 'holy') return 'holy';
    if (damageType === 'healing') return 'magic';
    return MAGIC_DAMAGE_TYPES.has(damageType) ? 'magic' : 'physical';
  }
  function isMagicSchool(damageType) {
    return damageSchoolFor(damageType) === 'magic';
  }

  function outgoingMultiplier(source, damageType = 'physical') {
    if (!source) return 1;
    if (isMagicSchool(damageType)) return numberOr(source.magicDamageMultiplier ?? source.derivedStats?.magicDamageMultiplier, 1);
    return numberOr(source.physicalDamageMultiplier ?? source.derivedStats?.physicalDamageMultiplier, 1);
  }

  function critProfile(source, damageType = 'physical') {
    if (!source) return { chance: 0, multiplier: 1.5 };
    if (isMagicSchool(damageType) || damageType === 'healing') {
      return {
        chance: clamp(numberOr(source.magicCritChance ?? source.derivedStats?.magicCritChance, 0), 0, RULES.magicCritChance.cap),
        multiplier: clamp(numberOr(source.magicCritDamageMultiplier ?? source.derivedStats?.magicCritDamageMultiplier, RULES.magicCritDamage.base), RULES.magicCritDamage.base, RULES.magicCritDamage.cap)
      };
    }
    return {
      chance: clamp(numberOr(source.critChance ?? source.derivedStats?.critChance, 0), 0, RULES.critChance.cap),
      multiplier: clamp(numberOr(source.critDamageMultiplier ?? source.derivedStats?.critDamageMultiplier, RULES.critDamage.base), RULES.critDamage.base, RULES.critDamage.cap)
    };
  }

  DR.STAT_KEYS = STAT_KEYS;
  DR.ATTRIBUTE_KEYS = ATTRIBUTE_KEYS;
  DR.ATTRIBUTE_ALIASES = ATTRIBUTE_ALIASES;
  DR.STAT_RULES = RULES;
  DR.CLASS_ATTRIBUTES = CLASS_ATTRIBUTES;
  DR.CLASS_ATTRIBUTE_GROWTH = CLASS_ATTRIBUTE_GROWTH;
  DR.StatSystem = {
    ATTRIBUTE_KEYS,
    STAT_KEYS,
    RULES,
    CLASS_ATTRIBUTES,
    CLASS_ATTRIBUTE_GROWTH,
    numberOr,
    cleanStats,
    addStats,
    attributesForClass,
    mergeAttributes,
    diminishingReturn,
    computePlayerDerived,
    effectiveCooldown,
    armorReductionFor,
    magicResistReductionFor,
    poisonResistReductionFor,
    outgoingMultiplier,
    critProfile,
    damageSchoolFor,
    isMagicSchool
  };
})();
