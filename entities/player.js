(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};
  const { CONFIG, CLASSES } = DR;
  const { Entity } = DR.entities;

class Player extends Entity {
    constructor(className, appearance = {}) {
      const requestedClass = String(className || appearance.className || '').trim();
      const safeClassName = CLASSES[requestedClass] ? requestedClass : (CLASSES.Fighter ? 'Fighter' : Object.keys(CLASSES || {})[0]);
      const c = CLASSES[safeClassName] || { hp: 100, mana: 30, attack: 8, defense: 2, speed: 1, color: '#d0b070', attributes: {} };
      const attributes = DR.StatSystem?.attributesForClass?.(safeClassName, 1) || c.attributes || {};
      super(appearance.name || safeClassName, CONFIG.START_X + 0.5, CONFIG.START_Y + 0.5, {
        hp: c.hp, mana: c.mana, attack: c.attack, defense: c.defense,
        speed: CONFIG.BASE_MOVE_SPEED * c.speed, color: c.color, kind: 'player', attributes
      });
      this.className = safeClassName;
      this.raceId = DR.normalizeRaceId?.(appearance.raceId) || 'human';
      this.racePaletteId = DR.normalizeRacePaletteId?.(this.raceId, appearance.racePaletteId) || 'settled';
      // Phase 8b (Intersect parity): per-item-id/cooldown-group use throttle. Empty by default - no item
      // grants a cooldown until content sets item.cooldownMs/cooldownGroup.
      this.itemCooldowns = appearance.itemCooldowns && typeof appearance.itemCooldowns === 'object' ? { ...appearance.itemCooldowns } : {};
      this.combatStyle = c.combatStyle || 'melee';
      this.autoAttackRangeTiles = Number(c.autoAttackRangeTiles || 1.25);
      this.autoAttackProjectile = c.autoAttackProjectile === true;
      this.autoAttackDamageType = c.autoAttackDamageType || 'physical';
      this.gender = appearance.gender || 'male';
      this.hairStyle = DR.Hairstyles?.normalize?.(this.raceId, appearance.hairStyle) || appearance.hairStyle || 'short';
      this.hairColor = appearance.hairColor || '#4b3628';
      this.eyeColor = appearance.eyeColor || '#8ec9ff';
      this.faceStyle = appearance.faceStyle || 'balanced';
      this.skinTone = appearance.skinTone || '#d8a87e';
      this.clothesPrimary = appearance.clothesPrimary || c.color;
      this.clothesSecondary = appearance.clothesSecondary || '#9a7b51';
      this.name = String(appearance.name || safeClassName).trim().slice(0, 18) || safeClassName;
      this.xp = 0;
      this.nextXp = 100;
      this.coinCopper = 0;
      Object.defineProperty(this, 'gold', {
        configurable: true,
        enumerable: true,
        get() { return Math.floor(Math.max(0, Number(this.coinCopper) || 0) / 10000); },
        set(value) { this.coinCopper = Math.max(0, Math.floor(Number(value) || 0) * 10000); }
      });
      this.gold = 60;
      this.meditationSkill = { name: 'Meditating', level: 1, xp: 0, ticks: 0 };
      this.meditation = null;
      DR.migrateMeditationSaveData?.(this);
      this.targetId = null;
      this.meditating = false;
      this.fishing = false;
      this.fishingAction = 'idle';
      this.fishingAnim = 0;
      this.fishingTargetX = null;
      this.fishingTargetY = null;
      this.fishingCastTimer = 0;
      this.fishingReelTimer = 0;
      this.gathering = false;
      this.gatheringAnim = 0;
      this.gatheringProgress = 0;
      this.gatheringKind = null;
      this.gatheringTargetX = null;
      this.gatheringTargetY = null;
      this.swimming = false;
      this.underwater = false;
      this.isUnderwater = false;
      this.swimDepth = 0;
      this.waterDepthMax = 0;
      this.oxygen = 45;
      this.oxygenMax = 45;
      this.skillCooldown = 0;
      this.spellCooldowns = new Array(9).fill(0);
      this.baseMaxHp = this.maxHp;
      this.baseMaxMana = this.maxMana;
      this.baseAttack = this.attack;
      this.baseDefense = this.defense;
      this.baseSpeed = this.speed;
      this.baseAttributes = { ...attributes };
      this.attributes = { ...attributes };
      this.statRatings = DR.StatSystem?.cleanStats?.({}) || {};
      this.derivedStats = {};
      this.armor = this.defense;
      this.armorReduction = 0;
      this.cooldownReduction = 0;
      this.critChance = 0.05;
      this.magicCritChance = 0.05;
      this.critDamageMultiplier = 1.5;
      this.magicCritDamageMultiplier = 1.5;
      this.physicalDamageMultiplier = 1;
      this.magicDamageMultiplier = 1;
      this.healingMultiplier = 1;
    }
  
    updateBase(dt) {
      super.updateBase(dt);
      this.skillCooldown = Math.max(0, this.skillCooldown - dt);
      for (let i = 0; i < this.spellCooldowns.length; i++) this.spellCooldowns[i] = Math.max(0, this.spellCooldowns[i] - dt);
      for (const id of Object.keys(this.itemCooldowns || {})) this.itemCooldowns[id] = Math.max(0, Number(this.itemCooldowns[id]) - dt);
    }
  
    respawnAt(x, y) {
      DR.restoreActorLiveState?.(this);
      this.x = x;
      this.y = y;
      this.hp = Math.max(1, Math.floor(Number(this.maxHp || 1)));
      this.mana = Math.floor(this.maxMana * 0.55);
      this.targetId = null;
      this.meditating = false;
      this.fishing = false;
      this.fishingAction = 'idle';
      this.fishingAnim = 0;
      this.fishingTargetX = null;
      this.fishingTargetY = null;
      this.fishingCastTimer = 0;
      this.fishingReelTimer = 0;
      this.gathering = false;
      this.gatheringAnim = 0;
      this.gatheringProgress = 0;
      this.gatheringKind = null;
      this.gatheringTargetX = null;
      this.gatheringTargetY = null;
      this.castTimer = 0;
      this.attackTimer = 0;
      this.attackAnim = 0;
      this.spellCastAnim = 0;
      this.moveBlend = 0;
      this.z = 0;
      this.vz = 0;
      this.jumpCooldown = 0;
      this.jumpAnim = 0;
      this.isJumping = false;
      this.swimming = false;
      this.underwater = false;
      this.isUnderwater = false;
      this.swimDepth = 0;
      this.waterDepthMax = 0;
      this.oxygen = this.oxygenMax || 45;
      this.vx = 0;
      this.vy = 0;
    }
  }
  

  DR.entities.Player = Player;
  DR.Player = Player;
})();
