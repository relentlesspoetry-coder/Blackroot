// Dream Realms spell draft definitions used by the editor data tools.
// Modular Pass 41: these drafts are compiled into live class spellbooks by systems/spell-compiler-system.js.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  const books = DR.CLASS_SPELL_BOOK || {};

  function slug(value) {
    return String(value || 'spell')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'spell';
  }

  function roleForKind(kind) {
    if (String(kind).includes('heal')) return 'healing';
    if (String(kind).includes('buff') || kind === 'mana' || kind === 'cleanse' || kind === 'revive' || kind === 'petSacrifice' || kind === 'transform') return 'support';
    if (String(kind).includes('debuff') || kind === 'drain') return 'control';
    return 'damage';
  }

  function targetForKind(kind) {
    if (kind === 'heal' || kind === 'mana' || kind === 'cleanse' || kind === 'revive' || kind === 'petHeal' || kind === 'buff' || kind === 'petBuff' || kind === 'summonPet' || kind === 'petSacrifice' || kind === 'transform') return 'ally_or_self';
    if (kind === 'groupBuff' || kind === 'aoeHeal') return 'party_area';
    if (kind === 'aoe' || kind === 'aoeDebuff' || kind === 'aoeMelee') return 'enemy_area';
    return 'enemy';
  }

  const drafts = {};
  for (const [className, list] of Object.entries(books)) {
    (list || []).forEach((spell, index) => {
      const id = `spell_${slug(className)}_${slug(spell.name)}`;
      const sourceSpell = spell && typeof spell === 'object' ? JSON.parse(JSON.stringify(spell)) : {};
      drafts[id] = {
        ...sourceSpell,
        id,
        name: spell.name || id,
        className,
        slotIndex: index,
        hotkey: String(index + 2),
        role: roleForKind(spell.kind),
        kind: spell.kind || 'bolt',
        target: targetForKind(spell.kind),
        cost: Number(spell.cost) || 0,
        cooldown: Number(spell.cooldown) || 0,
        range: spell.range ?? null,
        radius: spell.radius ?? null,
        power: spell.power ?? null,
        heal: spell.heal ?? null,
        duration: spell.duration ?? null,
        buffName: spell.buffName || null,
        mods: spell.mods ? JSON.parse(JSON.stringify(spell.mods)) : {},
        color: spell.color || '#d8ded1',
        animation: {
          cast: `${slug(className)}_${slug(spell.name)}_cast`,
          projectile: spell.range ? 'bolt_projectile' : null,
          impact: `${slug(spell.kind || 'spell')}_impact`,
          aura: String(spell.kind || '').includes('buff') || String(spell.kind || '').includes('heal') ? 'soft_aura' : null
        },
        sound: {
          cast: `${slug(spell.kind || 'spell')}_cast_tone`,
          impact: `${slug(spell.kind || 'spell')}_impact_tone`
        },
        description: spell.description || `${spell.name || 'Spell'} editor draft for ${className}.`,
        levelRequirement: spell.levelRequirement || 1,
        tickDamage: spell.tickDamage ?? null,
        tickDuration: spell.tickDuration ?? null,
        petName: spell.petName || null,
        petType: spell.petType || null,
        petColor: spell.petColor || null,
        petAttack: spell.petAttack ?? null,
        petHp: spell.petHp ?? null,
        executeBonusBelowPct: spell.executeBonusBelowPct ?? null,
        selfOnly: spell.selfOnly === true,
        removesStatusTags: Array.isArray(spell.removesStatusTags) ? [...spell.removesStatusTags] : [],
        reviveHpPct: spell.reviveHpPct ?? null,
        reviveManaPct: spell.reviveManaPct ?? null,
        castTime: spell.castTime ?? null,
        noLevelScaling: spell.noLevelScaling === true,
        instant: spell.instant === true,
        necroSpellId: spell.necroSpellId || null,
        statusId: spell.statusId || null,
        statusName: spell.statusName || null,
        tickRate: spell.tickRate ?? null,
        damageType: spell.damageType || null,
        drainHealPct: spell.drainHealPct ?? null,
        rootDuration: spell.rootDuration ?? null,
        slowPct: spell.slowPct ?? null,
        fearDuration: spell.fearDuration ?? null,
        physicalDamageTakenMultiplier: spell.physicalDamageTakenMultiplier ?? null,
        healingReceivedMultiplier: spell.healingReceivedMultiplier ?? null,
        moveSpeedMultiplier: spell.moveSpeedMultiplier ?? null,
        dotAmpPct: spell.dotAmpPct ?? null,
        drainAmpPct: spell.drainAmpPct ?? null,
        petDamageBonusPct: spell.petDamageBonusPct ?? null,
        selfBuffName: spell.selfBuffName || null,
        selfBuffDuration: spell.selfBuffDuration ?? null,
        selfBuffMods: spell.selfBuffMods ? JSON.parse(JSON.stringify(spell.selfBuffMods)) : {},
        petHealTick: spell.petHealTick ?? null,
        petHealDuration: spell.petHealDuration ?? null,
        petHealTickRate: spell.petHealTickRate ?? null,
        petAttackMin: spell.petAttackMin ?? null,
        petAttackMax: spell.petAttackMax ?? null,
        petAttackSpeed: spell.petAttackSpeed ?? null,
        petDamageType: spell.petDamageType || null,
        petDefense: spell.petDefense ?? null,
        replacePet: spell.replacePet === true,
        shieldBashDamage: spell.shieldBashDamage ?? null,
        shieldBashCooldown: spell.shieldBashCooldown ?? null,
        petSacrificePct: spell.petSacrificePct ?? null,
        nextDotBonusPct: spell.nextDotBonusPct ?? null,
        deathPactWindow: spell.deathPactWindow ?? null,
        executeThresholdPct: spell.executeThresholdPct ?? null,
        executeBonusDamage: spell.executeBonusDamage ?? null,
        manaRestoreOnKill: spell.manaRestoreOnKill ?? null,
        tempMinionCount: spell.tempMinionCount ?? null,
        tempMinionDuration: spell.tempMinionDuration ?? null,
        dotDamageMultiplier: spell.dotDamageMultiplier ?? null,
        drainHealingMultiplier: spell.drainHealingMultiplier ?? null,
        periodicMana: spell.periodicMana ?? null,
        periodicManaRate: spell.periodicManaRate ?? null,
        petDamageMultiplier: spell.petDamageMultiplier ?? null,
        allyHealingReceivedMultiplier: spell.allyHealingReceivedMultiplier ?? null,
        category: spell.category || null,
        tags: Array.isArray(spell.tags) ? [...spell.tags] : [],
        note: spell.note || 'Editor spell draft generated from the stable runtime spellbook.'
      };
    });
  }

  DR.SPELL_DRAFTS = drafts;
  DR.SPELL_DRAFT_LIST = Object.values(drafts).sort((a, b) => {
    const classCompare = String(a.className || '').localeCompare(String(b.className || ''));
    if (classCompare) return classCompare;
    return Number(a.slotIndex || 0) - Number(b.slotIndex || 0);
  });
  DR.SPELL_BY_ID = drafts;
})();
