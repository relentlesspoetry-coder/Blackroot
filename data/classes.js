(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  const dist = DR.utils?.dist || ((a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)));

  const COMBAT_STYLE_RANGES = Object.freeze({
    melee: 1.25,
    hybridMeleeSupport: 1.5,
    rangedCaster: 6,
    rangedWeapon: 7
  });

  const GLOBAL_AUTO_ATTACK_INTERVAL_MS = 2500;
  const GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS = GLOBAL_AUTO_ATTACK_INTERVAL_MS / 1000;

  const AUTO_ATTACK_SPEED_TUNING = Object.freeze({
    globalIntervalMs: GLOBAL_AUTO_ATTACK_INTERVAL_MS,
    globalIntervalSeconds: GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS,
    minSwingSeconds: GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS,
    maxSwingSeconds: GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS,
    speedBaseline: 3.2,
    speedScalarPerPoint: 0,
    minHasteMultiplier: 1,
    maxSlowMultiplier: 1
  });

  const CLASS_ORDER = Object.freeze(["Paladin", "Warden", "Fighter", "Rogue", "Ranger", "Assassin", "Wizard", "Shaman", "Summoner", "Necromancer", "Cleric", "Druid", "Bard", "Enchanter"]);

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, safeNumber(value, min)));
  }

  function equippedWeapon(actor) {
    const equipment = actor?.equipment || actor?.gear || {};
    return equipment.weapon || equipment.mainHand || equipment.mainhand || equipment.primary || null;
  }

  function weaponSwingSeconds(actor) {
    const weapon = equippedWeapon(actor);
    if (!weapon) return null;
    const damage = weapon.damage && typeof weapon.damage === 'object' ? weapon.damage : null;
    const raw = weapon.attackSpeed ?? weapon.weaponSpeed ?? weapon.swingSpeed ?? damage?.speed;
    const seconds = safeNumber(raw, NaN);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  function actorHasteMultiplier(actor, context = {}) {
    if (!actor || context.ignoreSpeedStat === true) return 1;
    const explicit = safeNumber(context.speedBaseline, NaN);
    const fallback = safeNumber(actor.baseSpeed, safeNumber(actor.speed, AUTO_ATTACK_SPEED_TUNING.speedBaseline));
    const baseline = Number.isFinite(explicit) ? explicit : fallback;
    const effective = safeNumber(actor.getStat?.('speed'), safeNumber(actor.speed, baseline));
    const delta = effective - baseline;
    return clampNumber(
      1 - delta * AUTO_ATTACK_SPEED_TUNING.speedScalarPerPoint,
      AUTO_ATTACK_SPEED_TUNING.minHasteMultiplier,
      AUTO_ATTACK_SPEED_TUNING.maxSlowMultiplier
    );
  }

  function applyAutoAttackSpeedModifiers(actor, baseSeconds, context = {}) {
    if (context.applyExplicitAutoAttackModifiers === true) return baseSeconds * actorHasteMultiplier(actor, context);
    return baseSeconds;
  }

  function resolveAutoAttackIntervalSeconds(actor, context = {}) {
    const base = GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS;
    const tuned = applyAutoAttackSpeedModifiers(actor, base, context);
    return Number(clampNumber(tuned, GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS, GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS).toFixed(3));
  }

  function combatIdentity(className) {
    const definition = DR.CLASSES?.[className] || DR.CLASSES?.Fighter || {};
    const combatStyle = definition.combatStyle || 'melee';
    return {
      combatStyle,
      autoAttackRangeTiles: Number(definition.autoAttackRangeTiles || COMBAT_STYLE_RANGES[combatStyle] || 1.25),
      autoAttackProjectile: definition.autoAttackProjectile === true,
      autoAttackDamageType: definition.autoAttackDamageType || (combatStyle === 'rangedCaster' ? 'magic' : 'physical')
    };
  }

  function executeSignatureSpell(game, className) {
    if (!game?.player) return false;
    const spell = (DR.CLASS_SPELL_BOOK?.[className] || [])[0];
    if (spell && typeof game.resolveClassSpell === 'function') {
      game.player.spellCastAnim = 1;
      game.spawnCastCue?.(game.player, spell.color || DR.CLASSES?.[className]?.color || '#d8ded1', spell.name || className);
      game.resolveClassSpell(spell, { target: game.getTarget?.() || null });
      return true;
    }
    game.log?.(`${className} training is not ready yet.`);
    return false;
  }

  function makeClass(name, definition) {
    return {
      ...definition,
      use(game) { return executeSignatureSpell(game, name); }
    };
  }

  DR.CLASSES = {
    Paladin: makeClass("Paladin", {
      color: "#f3d46b", hp: 132, mana: 100, attack: 12, defense: 13, speed: 0.92,
      combatStyle: "melee", autoAttackRangeTiles: 1.35, autoAttackProjectile: false, autoAttackDamageType: "physical",
      attributes: { strength: 13, dexterity: 7, stamina: 17, intelligence: 8, wisdom: 14 },
      role: "Tank",
      skill: "Radiant Strike",
      desc: "Holy shield tank. Divine mitigation, auras, self-healing, anti-undead pressure, and high threat control."
    }),
    Warden: makeClass("Warden", {
      color: "#8fcf70", hp: 138, mana: 100, attack: 11, defense: 14, speed: 0.9,
      combatStyle: "melee", autoAttackRangeTiles: 1.35, autoAttackProjectile: false, autoAttackDamageType: "physical",
      attributes: { strength: 12, dexterity: 8, stamina: 18, intelligence: 7, wisdom: 14 },
      role: "Tank",
      skill: "Stonehand Strike",
      desc: "Nature/stone sustain-control tank. Bark armor, stone plating, roots, thorns, regeneration, zones, and sustained AoE threat."
    }),
    Fighter: makeClass("Fighter", {
      color: "#d0b070", hp: 118, mana: 100, attack: 19, defense: 6, speed: 0.98,
      resourceName: "Stamina", resourceShortName: "STA", combatResourceRegen: 8, outOfCombatResourceRegen: 18,
      combatStyle: "melee", autoAttackRangeTiles: 1.25, autoAttackProjectile: false, autoAttackDamageType: "physical",
      attributes: { strength: 17, dexterity: 9, stamina: 13, intelligence: 5, wisdom: 6 },
      role: "Heavy-Weapon Melee DPS",
      skill: "Heavy Swing",
      desc: "Light/leather heavy-weapon melee DPS. Two-handed strikes, cleaves, staggers, momentum, and raw weapon damage. Not a tank."
    }),
    Rogue: makeClass("Rogue", {
      color: "#9fa4aa", hp: 92, mana: 100, attack: 18, defense: 4, speed: 1.24,
      resourceName: "Energy", resourceShortName: "Energy", combatResourceRegen: 10, outOfCombatResourceRegen: 10,
      combatStyle: "melee", autoAttackRangeTiles: 1.25, autoAttackProjectile: false, autoAttackDamageType: "physical",
      attributes: { strength: 12, dexterity: 17, stamina: 10, intelligence: 7, wisdom: 8 },
      role: "Melee DPS",
      skill: "Quick Cut",
      desc: "Light/leather melee stealth DPS. Daggers, short blades, poisons, bleeds, Energy, and evasion."
    }),
    Ranger: makeClass("Ranger", {
      color: "#77b85f", hp: 98, mana: 100, attack: 17, defense: 4, speed: 1.12,
      resourceName: "Focus", resourceShortName: "Focus", combatResourceRegen: 8, outOfCombatResourceRegen: 8,
      combatStyle: "rangedWeapon", autoAttackRangeTiles: 7, autoAttackProjectile: true, autoAttackDamageType: "physical",
      attributes: { strength: 10, dexterity: 17, stamina: 11, intelligence: 7, wisdom: 11 },
      role: "Physical Ranged DPS",
      skill: "Steady Shot",
      desc: "Bow, trap, and tracking physical ranged DPS. Focus, wilderness scouting, kiting, and terrain control."
    }),
    Assassin: makeClass("Assassin", {
      color: "#7e6aa8", hp: 90, mana: 100, attack: 18, defense: 3, speed: 1.18,
      combatStyle: "rangedWeapon", autoAttackRangeTiles: 6.5, autoAttackProjectile: true, autoAttackDamageType: "physical",
      attributes: { strength: 10, dexterity: 18, stamina: 9, intelligence: 9, wisdom: 7 },
      role: "Physical Ranged DPS",
      skill: "Throwing Knife",
      desc: "Ranged executioner. Traps, throwing weapons, crossbow shots, poison bolts, and marked kills. Distinct from melee Rogue."
    }),
    Wizard: makeClass("Wizard", {
      color: "#6fa8ff", hp: 76, mana: 120, attack: 8, defense: 3, speed: 0.96,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 7.5, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 5, dexterity: 8, stamina: 8, intelligence: 18, wisdom: 11 },
      role: "Magic Ranged DPS",
      skill: "Arcane Bolt",
      desc: "Fragile scholarly ranged magic DPS. Mana management, fire burst, frost control, arcane force, and high-risk casting windows."
    }),
    Shaman: makeClass("Shaman", {
      color: "#59c9b2", hp: 88, mana: 115, attack: 10, defense: 4, speed: 0.98,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 7, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 7, dexterity: 8, stamina: 10, intelligence: 14, wisdom: 15 },
      role: "Magic Ranged DPS",
      skill: "Lightning Spark",
      desc: "Primal storm/earth/spirit ranged magic DPS. Totems, ritual fields, mixed primal damage, and battlefield pressure; not a healer replacement."
    }),
    Summoner: makeClass("Summoner", {
      color: "#66d6c7", hp: 82, mana: 115, attack: 8, defense: 3, speed: 0.98,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 6.8, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 6, dexterity: 8, stamina: 8, intelligence: 15, wisdom: 12 },
      role: "Pet / DPS",
      skill: "Summon Familiar",
      desc: "Planar pet DPS. Main companion uptime, pet commands, temporary summons, planar gates, and pet-based burst windows."
    }),
    Necromancer: makeClass("Necromancer", {
      color: "#78a06a", hp: 84, mana: 120, attack: 10, defense: 3, speed: 0.96,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 6.8, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 7, dexterity: 8, stamina: 9, intelligence: 15, wisdom: 10 },
      role: "Pet / DPS",
      skill: "Bone Splinter",
      desc: "Undead pet DPS. Bone magic, disease, curses, drains, DoTs, and dark sustain."
    }),
    Cleric: makeClass("Cleric", {
      color: "#f0e6a0", hp: 102, mana: 125, attack: 8, defense: 7, speed: 0.95,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 6.8, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 8, dexterity: 7, stamina: 12, intelligence: 10, wisdom: 16 },
      role: "Healer",
      skill: "Minor Heal",
      desc: "Holy healer. Direct heals, wards, cleansing, prayers, and anti-undead support."
    }),
    Druid: makeClass("Druid", {
      color: "#78c26d", hp: 96, mana: 120, attack: 9, defense: 5, speed: 1.0,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 6.8, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 8, dexterity: 9, stamina: 11, intelligence: 13, wisdom: 15 },
      role: "Healer",
      skill: "Rejuvenating Vine",
      desc: "Nature healer. HoTs, vines, roots, moon magic, animal spirits, and regeneration."
    }),
    Bard: makeClass("Bard", {
      color: "#c69bea", hp: 92, mana: 115, attack: 11, defense: 5, speed: 1.12,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 7, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 9, dexterity: 12, stamina: 10, intelligence: 10, wisdom: 13 },
      role: "Support / Utility",
      skill: "Quick Note",
      desc: "Music support. Songs, instruments, buffs, morale, regeneration, meditation synergy, and group utility."
    }),
    Enchanter: makeClass("Enchanter", {
      color: "#b8a0ff", hp: 78, mana: 125, attack: 8, defense: 3, speed: 1.0,
      combatStyle: "rangedCaster", autoAttackRangeTiles: 7, autoAttackProjectile: true, autoAttackDamageType: "magic",
      attributes: { strength: 6, dexterity: 9, stamina: 8, intelligence: 16, wisdom: 12 },
      role: "Support / Utility",
      skill: "Mind Spark",
      desc: "Mind magic support. Illusions, charms, mesmerize, confusion, rune buffs/debuffs, and control."
    })
  };

  DR.CLASS_ORDER = CLASS_ORDER;
  DR.AUTO_ATTACK_RANGE_TILES = COMBAT_STYLE_RANGES;
  DR.GLOBAL_AUTO_ATTACK_INTERVAL_MS = GLOBAL_AUTO_ATTACK_INTERVAL_MS;
  DR.GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS = GLOBAL_AUTO_ATTACK_INTERVAL_SECONDS;
  DR.AUTO_ATTACK_SPEED_TUNING = AUTO_ATTACK_SPEED_TUNING;
  DR.applyAutoAttackSpeedModifiers = applyAutoAttackSpeedModifiers;
  DR.resolveAutoAttackIntervalSeconds = resolveAutoAttackIntervalSeconds;
  DR.getClassCombatIdentity = combatIdentity;
})();
