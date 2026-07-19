(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};
  const { MERC_ROLES } = DR;
  const { Entity } = DR.entities;
  const { dist } = DR.utils;

  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function alive(entity) { return Boolean(entity && entity.alive !== false && Number.isFinite(entity.x) && Number.isFinite(entity.y)); }
  function hpRatio(entity) { return entity && entity.maxHp > 0 ? entity.hp / entity.maxHp : 1; }
  function manaRatio(entity) { return entity && entity.maxMana > 0 ? entity.mana / entity.maxMana : 1; }

  function tunedAutoAttackInterval(game, actor, baseSeconds, context = {}) {
    if (game?.getAutoAttackIntervalSeconds) {
      return game.getAutoAttackIntervalSeconds(actor, { source: context.source || 'mercenary-auto-attack' });
    }
    return 2.5;
  }

  const ROLE_BEHAVIOR = Object.freeze({
    guardian: {
      combatRange: 1.45,
      followRange: 2.05,
      guardRadius: 7.2,
      tauntCooldown: 5.8,
      tauntDuration: 4.1,
      tauntBonus: 68,
      stanceOffset: { x: 0.72, y: 0.62 },
      restHp: 0.92,
      restMana: 0.72
    },
    cleric: {
      combatRange: 6.25,
      followRange: 2.35,
      guardRadius: 8.0,
      healCooldown: 3.05,
      emergencyHealCooldown: 1.45,
      healMana: 13,
      emergencyMana: 20,
      keepAway: 3.35,
      restHp: 0.93,
      restMana: 0.82
    },
    adept: {
      combatRange: 6.8,
      followRange: 2.45,
      guardRadius: 8.5,
      castCooldown: 3.1,
      castMana: 11,
      keepAway: 3.85,
      restHp: 0.90,
      restMana: 0.72
    },
    scout: {
      combatRange: 1.48,
      followRange: 2.0,
      guardRadius: 7.4,
      strikeCooldown: 2.75,
      flankDistance: 0.78,
      restHp: 0.88,
      restMana: 0.58
    }
  });

  class Mercenary extends Entity {
    constructor(roleKey, x, y, owner) {
      const role = MERC_ROLES[roleKey];
      super(role.label, x, y, {
        hp: role.hp, mana: role.mana, attack: role.attack, defense: role.defense,
        speed: 3.65, range: role.range, color: role.color, kind: 'merc'
      });
      this.roleKey = roleKey;
      this.roleLabel = role.label;
      this.roleDesc = role.desc || 'Mercenary';
      this.owner = owner;
      this.level = Math.max(1, Math.floor(owner?.level || 1));
      this.xp = 0;
      this.nextXp = 85;
      this.totalXpEarned = 0;
      this.lastXpGain = 0;
      this.lastXpSource = '';
      this.lastXpAt = 0;
      this.levelUpPulse = 0;
      this.baseMaxHp = role.hp;
      this.baseMaxMana = role.mana;
      this.baseAttack = role.attack;
      this.baseDefense = role.defense;
      this.equipment = {
        mainHand: { name: `${role.label} Training Weapon`, slot: 'mainHand', attack: 1 },
        offHand: null,
        head: null,
        chest: { name: `${role.label} Contract Gear`, slot: 'chest', defense: 1 },
        legs: null,
        feet: { name: 'Travel Boots', slot: 'feet', defense: 1 },
        trinket: null
      };
      this.healTimer = 0;
      this.emergencyHealTimer = 0;
      this.tauntTimer = 0;
      this.castAiTimer = 0;
      this.command = 'assist';
      this.commandState = 'assist';
      this.meditating = false;
      this.meditateTick = 0;
      this.combatCooldown = 0;
      this.reviveTimer = 0;
      this.reviveDelay = 9.5;
      this.lastAiLogAt = 0;
      this.lastRoleAction = '';
      this.recalculateFromLevel();
      this.hp = this.maxHp;
      this.mana = this.maxMana;
    }

    behavior() {
      return ROLE_BEHAVIOR[this.roleKey] || ROLE_BEHAVIOR.scout;
    }

    gearStatTotals() {
      const totals = { hp: 0, mana: 0, attack: 0, defense: 0, armor: 0, speed: 0, range: 0, healingPower: 0, spellPower: 0, physicalPower: 0 };
      for (const item of Object.values(this.equipment || {})) {
        if (!item) continue;
        const stats = item.stats && typeof item.stats === 'object' ? item.stats : item;
        for (const [stat, value] of Object.entries(stats || {})) {
          const n = Number(value);
          if (!Number.isFinite(n)) continue;
          totals[stat] = (totals[stat] || 0) + n;
        }
        if (item.armor && !stats?.armor) totals.armor = (totals.armor || 0) + Number(item.armor || 0);
      }
      return totals;
    }

    getStat(stat) {
      const key = String(stat || '');
      let base = super.getStat(key);
      const gear = this.gearStatTotals?.() || {};
      if (key === 'defense') base += Number(gear.defense || 0) + Number(gear.armor || 0);
      else if (key === 'attack') base += Number(gear.attack || 0) + Number(gear.physicalPower || 0) + Number(gear.spellPower || 0) * 0.65;
      else if (key === 'speed') base += Number(gear.speed || 0);
      else if (key === 'range') base += Number(gear.range || 0);
      else base += Number(gear[key] || 0);
      return Math.max(0, base);
    }

    recalculateFromLevel() {
      const hpPct = this.maxHp > 0 ? this.hp / this.maxHp : 1;
      const mpPct = this.maxMana > 0 ? this.mana / this.maxMana : 1;
      const gear = this.gearStatTotals?.() || { hp: 0, mana: 0, armor: 0 };
      this.maxHp = Math.floor((this.baseMaxHp || this.maxHp || 80) + (this.level - 1) * 14 + Number(gear.hp || 0));
      this.maxMana = Math.floor((this.baseMaxMana || this.maxMana || 0) + (this.baseMaxMana > 0 ? (this.level - 1) * 8 : 0) + Number(gear.mana || 0));
      this.attack = Math.floor((this.baseAttack || this.attack || 8) + (this.level - 1) * 2);
      this.defense = Math.floor((this.baseDefense || this.defense || 2) + (this.level - 1));
      this.armor = Math.max(0, Math.floor(this.defense + Number(gear.defense || 0) + Number(gear.armor || 0)));
      this.hp = Math.max(1, Math.min(this.maxHp, Math.ceil(this.maxHp * hpPct)));
      this.mana = Math.max(0, Math.min(this.maxMana, Math.ceil(this.maxMana * mpPct)));
    }

    update(game, dt) {
      this.updateBase(dt);
      this.healTimer = Math.max(0, this.healTimer - dt);
      this.emergencyHealTimer = Math.max(0, this.emergencyHealTimer - dt);
      this.tauntTimer = Math.max(0, this.tauntTimer - dt);
      this.castAiTimer = Math.max(0, this.castAiTimer - dt);
      this.combatCooldown = Math.max(0, this.combatCooldown - dt);
      this.levelUpPulse = Math.max(0, Number(this.levelUpPulse || 0) - dt * 1.45);

      if (!this.owner || !this.owner.alive) return;
      if (!this.alive) {
        this.updateDownedRecovery(game, dt);
        return;
      }

      const command = String(this.command || 'assist').toLowerCase();
      const ownerMoving = this.ownerIsMoving();
      const inCombat = this.isCombatActive(game);
      const followDist = dist(this, this.owner);

      if (this.handleMeditation(game, dt, command, inCombat, ownerMoving, followDist)) return;
      if (command === 'passive') {
        this.commandState = 'passive';
        this.followOwner(game, dt, this.behavior().followRange + 0.35);
        return;
      }

      const healHandled = this.roleKey === 'cleric' ? this.tryClericHealing(game, inCombat) : false;
      if (healHandled) return;

      if (command === 'follow' && !this.isOwnerUnderDirectThreat(game)) {
        this.commandState = 'follow';
        this.followOwner(game, dt, this.behavior().followRange);
        return;
      }

      const target = this.selectCombatTarget(game, command);
      if (!target || !target.alive) {
        this.commandState = inCombat ? 'watching' : 'follow';
        this.followOwner(game, dt, this.behavior().followRange);
        return;
      }

      this.combatCooldown = Math.max(this.combatCooldown || 0, 3.2);
      if (this.roleKey === 'guardian') return this.updateGuardianCombat(game, target, dt);
      if (this.roleKey === 'cleric') return this.updateClericCombat(game, target, dt);
      if (this.roleKey === 'adept') return this.updateAdeptCombat(game, target, dt);
      return this.updateScoutCombat(game, target, dt);
    }

    updateDownedRecovery(game, dt) {
      this.commandState = 'downed';
      this.meditating = false;
      this.reviveTimer = Math.max(0, Number(this.reviveTimer || 0) - dt);
      const ownerCombat = game.isEntityInCombat?.(this.owner) || false;
      const safeDistance = dist(this, this.owner) <= 14;
      if (this.reviveTimer <= 0 && !ownerCombat && safeDistance) {
        game.reviveMercenary?.(this, { reason: 'recovery' });
      }
    }

    ownerIsMoving() {
      return Math.hypot(this.owner?.vx || 0, this.owner?.vy || 0) > 0.025 || (this.owner?.moveBlend || 0) > 0.18;
    }

    isCombatActive(game) {
      const partyTarget = game.resolvePartyAssistTarget?.(this, { range: this.behavior().guardRadius || 7.5, preferPlayerTarget: true });
      return Boolean(game.isEntityInCombat?.(this) || game.isEntityInCombat?.(this.owner) || partyTarget || this.findHostileThreat(game, 7.2));
    }

    needsRest(game = null) {
      const b = this.behavior();
      let restHp = b.restHp || 0.9;
      let restMana = b.restMana || 0.75;
      if (game) {
        const desireScore = game.meditationDesireScore?.(this, {
          justLeftCombat: (game.meditationOutOfCombatSeconds?.(this) ?? Infinity) <= 10,
          partyMemberMeditating: Boolean(game.actorIsMeditating?.(game.player)),
          dangerNearby: Boolean(game.isEntityInCombat?.(this.owner))
        }) ?? 0.5;
        const shift = (desireScore - 0.5) * 0.08;
        restHp = clamp(restHp + shift, 0.55, 0.97);
        restMana = clamp(restMana + shift, 0.45, 0.94);
      }
      return hpRatio(this) < restHp || (this.maxMana > 0 && manaRatio(this) < restMana);
    }

    handleMeditation(game, dt, command, inCombat, ownerMoving, followDist) {
      const commandMeditate = command === 'meditate';
      const commandStand = command === 'stand';
      // "Stand" is an explicit hold - it must not silently slide back into
      // auto-rest the instant HP/mana dips below the role's threshold.
      const needsMeditate = !commandStand && this.needsRest(game);
      const wantsMeditation = commandMeditate || needsMeditate;
      const maxRestDistance = commandMeditate ? 14.5 : 9.5;
      const maxHeldDistance = commandMeditate ? 15.8 : 10.8;
      const playerIsRelocating = ownerMoving || followDist > maxRestDistance;
      const canRest = wantsMeditation && !inCombat && !playerIsRelocating;

      if (game.actorIsMeditating?.(this) && (inCombat || ownerMoving || followDist > maxHeldDistance || commandStand)) {
        const reason = commandStand ? 'command changed' : inCombat ? 'combat' : ownerMoving ? 'player moving' : 'follow distance';
        game.cancelMeditation?.(this, reason, { silent: true });
      }

      if (commandStand) {
        this.commandState = 'standing';
        return true;
      }

      if (game.actorIsMeditating?.(this)) {
        this.commandState = commandMeditate ? 'command-meditating' : 'resting-to-full';
        this.meditationIntent = commandMeditate ? 'command' : 'auto-rest';
        game.lockMeditatingActorMovement?.(this);
        game.updateMeditationForEntity?.(this, dt, { silent: true });
        return true;
      }

      if (canRest) {
        if (game.startMeditation?.(this, { silent: true })) {
          this.commandState = commandMeditate ? 'command-meditating' : 'resting';
          this.meditationIntent = commandMeditate ? 'command' : 'auto-rest';
          game.lockMeditatingActorMovement?.(this);
          game.updateMeditationForEntity?.(this, dt, { silent: true });
          return true;
        }
      }

      if (wantsMeditation && !inCombat && playerIsRelocating) {
        this.commandState = commandMeditate ? 'waiting-to-meditate' : 'following-before-rest';
        this.followOwner(game, dt, this.behavior().followRange + 0.25);
        return true;
      }
      return false;
    }

    followOwner(game, dt, stopRange = 2.1) {
      const b = this.behavior();
      const offset = b.stanceOffset || { x: 0.85, y: 0.8 };
      const tx = this.owner.x + offset.x;
      const ty = this.owner.y + offset.y;
      const d = dist(this, this.owner);
      if (d > 14) {
        this.x = tx;
        this.y = ty;
        this.moveBlend = 0;
        this.commandState = 'catch-up';
        return true;
      }
      if (d > stopRange) {
        const stop = stopRange * 0.84;
        if (game.moveCompanionToPoint) return game.moveCompanionToPoint(this, tx, ty, dt, { mode: 'merc-follow', stopRange: stop, recalcMs: this.ownerIsMoving?.() ? 440 : 680, allowPartialPath: true });
        return this.moveToward(game, tx, ty, dt, stop);
      }
      return false;
    }

    findHostileThreat(game, range = 7.5) {
      let best = null;
      let bestScore = Infinity;
      const protectedAllies = game.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor: this.owner, range: Math.max(12, range + 5) })?.map(entry => entry.actor) || [this.owner, this];
      for (const enemy of game.enemies || []) {
        if (!alive(enemy)) continue;
        const dSelf = dist(enemy, this);
        const target = game.pickEnemyTarget?.(enemy) || null;
        const allyDistances = protectedAllies.map(ally => ally ? dist(enemy, ally) : Infinity);
        const dAlly = Math.min(...allyDistances, Infinity);
        const targetIsProtected = protectedAllies.includes(target);
        const hostile = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0 || targetIsProtected;
        if (!hostile) continue;
        const d = Math.min(dAlly, dSelf);
        if (d > range) continue;
        const targetBias = target === this.owner ? -2.4 : target === this ? -1.1 : targetIsProtected ? -1.7 : 0;
        const score = d + targetBias + (enemy.elite ? -0.8 : 0);
        if (score < bestScore) { best = enemy; bestScore = score; }
      }
      return best;
    }

    isOwnerUnderDirectThreat(game) {
      const protectedAllies = game.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor: this.owner, range: 12 })?.map(entry => entry.actor) || [this.owner];
      for (const enemy of game.enemies || []) {
        if (!alive(enemy)) continue;
        const target = game.pickEnemyTarget?.(enemy) || null;
        if (protectedAllies.includes(target) && dist(enemy, target) <= 7.5) return true;
      }
      return false;
    }

    selectCombatTarget(game, command) {
      if (command === 'passive' || command === 'meditate') return null;
      const assistTarget = game.resolvePartyAssistTarget?.(this, { range: this.behavior().combatRange + 5.5, preferPlayerTarget: true });
      const guardThreat = this.findHostileThreat(game, this.behavior().guardRadius || 7.5);
      if (command === 'guard') return guardThreat;
      if (command === 'follow') return guardThreat && this.isOwnerUnderDirectThreat(game) ? guardThreat : null;
      if (command === 'attack') return assistTarget || guardThreat || game.nearestEnemy?.(this.x, this.y, 9.5);
      return assistTarget || guardThreat;
    }

    tryClericHealing(game, inCombat) {
      if (this.maxMana <= 0 || this.mana < 8) return false;
      const weighted = game.getPartyHealingCandidates?.(this, { range: 16 }) || [game.player, game.merc, game.pet].filter(alive).map(actor => {
        let ratio = hpRatio(actor);
        let priority = ratio;
        if (actor.kind === 'player') priority -= 0.10;
        if (actor.kind === 'merc') priority -= 0.03;
        if (actor.kind === 'pet') priority += 0.04;
        return { actor, ratio, priority };
      }).sort((a, b) => a.priority - b.priority);
      const entry = weighted[0];
      if (!entry) return false;

      const emergency = entry.ratio <= 0.34;
      const normal = entry.ratio <= (inCombat ? 0.82 : 0.68);
      if (!normal && !emergency) return false;
      if (emergency) {
        if (this.emergencyHealTimer > 0 || this.mana < this.behavior().emergencyMana) return false;
        return this.castMercHeal(game, entry.actor, true);
      }
      if (this.healTimer > 0 || this.mana < this.behavior().healMana) return false;
      return this.castMercHeal(game, entry.actor, false);
    }

    castMercHeal(game, target, emergency = false) {
      const cost = emergency ? this.behavior().emergencyMana : this.behavior().healMana;
      const amount = emergency ? 46 + this.level * 6 : 28 + this.level * 4;
      const healed = game.healEntity(target, amount, true, this);
      this.mana = Math.max(0, this.mana - cost);
      this.healTimer = emergency ? 2.2 : this.behavior().healCooldown;
      this.emergencyHealTimer = emergency ? this.behavior().emergencyHealCooldown : Math.max(this.emergencyHealTimer, 0.45);
      this.combatCooldown = Math.max(this.combatCooldown || 0, 4.2);
      this.spellCastAnim = 1;
      this.lastRoleAction = emergency ? 'emergency heal' : 'heal';
      this.commandState = emergency ? 'emergency-healing' : 'healing';
      game.spawnRing?.(target.x, target.y, emergency ? '#fff2a8' : '#f0e6a0', emergency ? 17 : 12);
      game.spawnStatusPulse?.(target, emergency ? '#fff2a8' : '#f0e6a0', emergency ? 'Merc Save' : 'Merc Heal');
      game.playAudioEvent?.('meditation_start', { actor: target, volume: emergency ? 0.22 : 0.15, cooldown: 0.18 });
      game.playSfx?.('heal_chime', { x: target.x, y: target.y, volume: emergency ? 0.36 : 0.26, cooldown: 0.1 });
      if (healed > 0 && (!this.lastHealLogAt || performance.now() - this.lastHealLogAt > 1800)) {
        this.lastHealLogAt = performance.now();
        game.logCombat?.(`${this.name} heals ${target.name} for ${healed}.`);
      }
      return true;
    }

    updateGuardianCombat(game, target, dt) {
      const d = dist(this, target);
      this.commandState = 'tanking';
      if (this.tauntTimer <= 0 && d <= 6.2) {
        game.tauntEnemy?.(target, this, this.behavior().tauntDuration, this.behavior().tauntBonus + this.level * 5);
        this.tauntTimer = this.behavior().tauntCooldown;
        this.spellCastAnim = 0.6;
        this.lastRoleAction = 'taunt';
        game.spawnCastCue?.(this, '#d0b070', 'Taunt');
        game.spawnStatusPulse?.(target, '#d0b070', 'Taunted');
        game.playAudioEvent?.('merc_command', { actor: this, volume: 0.23, cooldown: 0.2 });
      }
      const stop = this.behavior().combatRange;
      const anchor = game.companionCombatAnchor?.(this, target, { preferredRange: stop * 0.92 }) || this.guardianTankAnchor(target, stop * 0.92);
      const anchorDrift = Math.hypot(this.x - anchor.x, this.y - anchor.y);
      if (d > stop + 0.3 || anchorDrift > 0.72) {
        if (game.moveCompanionToCombatPosition) return game.moveCompanionToCombatPosition(this, target, dt, {
          role: 'tank',
          desiredRange: stop * 0.92,
          stopRange: stop * 0.70,
          recalcMs: 520,
          maxRange: 58,
          maxNodes: 1700
        });
        return this.moveToward(game, anchor.x, anchor.y, dt, stop * 0.70);
      }
      game.applyCompanionSeparation?.(this, { range: 0.58, strength: 0.14 });
      if (this.attackTimer <= 0) {
        this.setFacingFromDelta(target.x - this.x, target.y - this.y);
        game.playAttackAnimation?.(this, target, this.color, 'slam');
        const damage = Math.max(2, Math.floor(this.getStat('attack') * 0.64 + this.level * 1.1 + randInt(1, 4)));
        game.damageEntity?.(target, damage, this, this.color, { damageType: 'physical' });
        game.addThreat?.(target, this, damage * 1.8, { reason: 'guardian-strike', flatBonus: 8 });
        this.attackTimer = tunedAutoAttackInterval(game, this, 3.35, { minSwingSeconds: 1.15 });
        this.lastRoleAction = 'shield strike';
      }
      return true;
    }

    guardianTankAnchor(target, distanceFromTarget = 1.25) {
      const owner = this.owner || this;
      let dx = (owner.x || 0) - (target.x || 0);
      let dy = (owner.y || 0) - (target.y || 0);
      let len = Math.hypot(dx, dy);
      if (len < 0.01) {
        dx = (this.x || 0) - (target.x || 0);
        dy = (this.y || 0) - (target.y || 0);
        len = Math.hypot(dx, dy) || 1;
      }
      dx /= len;
      dy /= len;
      return {
        x: target.x + dx * distanceFromTarget,
        y: target.y + dy * distanceFromTarget
      };
    }

    updateClericCombat(game, target, dt) {
      this.commandState = 'supporting';
      this.maintainRangedSpacing(game, target, dt, this.behavior().keepAway, this.behavior().combatRange - 0.5);
      if (this.attackTimer <= 0 && this.mana >= 5 && dist(this, target) <= this.behavior().combatRange + 0.4) {
        this.setFacingFromDelta(target.x - this.x, target.y - this.y);
        this.spellCastAnim = 1;
        game.spawnBolt?.(this, target, '#fff2a8');
        const damage = Math.max(1, Math.floor(this.getStat('attack') * 0.50 + this.level * 0.9 + randInt(1, 3)));
        this.mana = Math.max(0, this.mana - 5);
        game.damageEntity?.(target, damage, this, '#fff2a8', { damageType: 'magic' });
        this.attackTimer = tunedAutoAttackInterval(game, this, 4.1, { minSwingSeconds: 1.35 });
        this.lastRoleAction = 'smite';
      }
      return true;
    }

    updateAdeptCombat(game, target, dt) {
      const b = this.behavior();
      this.commandState = 'ranged-dps';
      this.maintainRangedSpacing(game, target, dt, b.keepAway, b.combatRange - 0.3);
      if (this.attackTimer <= 0 && this.castAiTimer <= 0 && dist(this, target) <= b.combatRange + 0.7) {
        const enoughMana = this.mana >= b.castMana;
        this.setFacingFromDelta(target.x - this.x, target.y - this.y);
        this.spellCastAnim = 1;
        game.spawnBolt?.(this, target, enoughMana ? '#83b7ff' : '#9fb6c7');
        const damage = Math.max(2, Math.floor(this.getStat('attack') * (enoughMana ? 0.94 : 0.55) + this.level * 1.25 + randInt(2, 5)));
        if (enoughMana) this.mana = Math.max(0, this.mana - b.castMana);
        game.damageEntity?.(target, damage, this, enoughMana ? '#83b7ff' : '#9fb6c7', { damageType: 'magic' });
        game.playSfx?.('magic_cast', { x: this.x, y: this.y, volume: 0.22, cooldown: 0.08 });
        this.attackTimer = tunedAutoAttackInterval(game, this, enoughMana ? b.castCooldown : 3.65, { minSwingSeconds: enoughMana ? 1.30 : 1.20 });
        this.castAiTimer = 0.28;
        this.lastRoleAction = enoughMana ? 'arcane bolt' : 'wand shot';
      }
      return true;
    }

    updateScoutCombat(game, target, dt) {
      const b = this.behavior();
      this.commandState = 'melee-dps';
      const d = dist(this, target);
      if (d > b.combatRange + 0.2) {
        const flank = game.companionCombatAnchor?.(this, target, { preferredRange: b.combatRange }) || this.flankPoint(target, b.flankDistance || 0.72);
        if (game.moveCompanionToCombatPosition) return game.moveCompanionToCombatPosition(this, target, dt, {
          role: 'melee',
          desiredRange: b.combatRange,
          stopRange: b.combatRange * 0.76,
          recalcMs: 520,
          maxRange: 58,
          maxNodes: 1700
        });
        return this.moveToward(game, flank.x, flank.y, dt, b.combatRange * 0.76);
      }
      game.applyCompanionSeparation?.(this, { range: 0.58, strength: 0.16 });
      if (this.attackTimer <= 0) {
        this.setFacingFromDelta(target.x - this.x, target.y - this.y);
        game.playAttackAnimation?.(this, target, this.color, 'slash');
        const damage = Math.max(2, Math.floor(this.getStat('attack') * 0.92 + this.level * 1.15 + randInt(2, 5)));
        game.damageEntity?.(target, damage, this, this.color, { damageType: 'physical' });
        this.attackTimer = tunedAutoAttackInterval(game, this, b.strikeCooldown, { minSwingSeconds: 1.05 });
        this.lastRoleAction = 'blade strike';
      }
      return true;
    }

    maintainRangedSpacing(game, target, dt, minRange, preferredRange) {
      const d = dist(this, target);
      const anchor = game.companionCombatAnchor?.(this, target, { preferredRange }) || null;
      if (anchor && Math.hypot(this.x - anchor.x, this.y - anchor.y) > 0.95) {
        this.setFacingFromDelta(target.x - this.x, target.y - this.y);
        if (game.moveCompanionToCombatPosition) return game.moveCompanionToCombatPosition(this, target, dt, {
          role: this.roleKey === 'cleric' ? 'healer' : 'ranged',
          desiredRange: preferredRange,
          stopRange: 0.64,
          requireLineOfSight: true,
          recalcMs: 720,
          maxRange: 58,
          maxNodes: 1700
        });
        return this.moveToward(game, anchor.x, anchor.y, dt, 0.64);
      }
      if (d < minRange && d > 0.01) {
        const dx = (this.x - target.x) / d;
        const dy = (this.y - target.y) / d;
        const tx = this.x + dx * 1.2;
        const ty = this.y + dy * 1.2;
        this.setFacingFromDelta(target.x - this.x, target.y - this.y);
        if (game.moveCompanionToPoint) return game.moveCompanionToPoint(this, tx, ty, dt, { mode: 'merc-keepaway', stopRange: 0.28, recalcMs: 520, allowPartialPath: true });
        if (game.isWalkable?.(tx, ty, this)) return game.tryMove?.(this, tx, ty) || false;
        const sx = this.x + (-dy) * 0.9;
        const sy = this.y + (dx) * 0.9;
        if (game.isWalkable?.(sx, sy, this)) return game.tryMove?.(this, sx, sy) || false;
        return false;
      }
      if (d > preferredRange) {
        if (game.moveCompanionToCombatPosition) return game.moveCompanionToCombatPosition(this, target, dt, {
          role: this.roleKey === 'cleric' ? 'healer' : 'ranged',
          desiredRange: preferredRange,
          stopRange: preferredRange * 0.18,
          requireLineOfSight: true,
          recalcMs: 720,
          maxRange: 58,
          maxNodes: 1700
        });
        return this.moveToward(game, target.x, target.y, dt, preferredRange * 0.92);
      }
      game.applyCompanionSeparation?.(this, { range: 0.76, strength: 0.18 });
      this.setFacingFromDelta(target.x - this.x, target.y - this.y);
      return false;
    }

    flankPoint(target, distance = 0.75) {
      const side = this.id % 2 === 0 ? 1 : -1;
      const fx = target.facingX || 1;
      const fy = target.facingY || 0;
      return {
        x: target.x + (-fy * side) * distance,
        y: target.y + (fx * side) * distance
      };
    }
  }

  DR.entities.Mercenary = Mercenary;
  DR.Mercenary = Mercenary;
})();
