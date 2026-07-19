(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};
  const { Entity } = DR.entities;
  const { dist } = DR.utils;
  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  class Pet extends Entity {
    constructor(x, y, owner, opts = {}) {
      const petType = opts.petType || 'shard';
      const undeadPet = petType === 'undead' || petType === 'undead_knight' || petType === 'undead_minion';
      const defaultName = petType === 'undead_knight' ? 'Skeleton Knight' : (undeadPet ? 'Bone Servant' : 'Azure Shard Familiar');
      const color = opts.color || opts.petColor || (undeadPet ? '#d8e5b4' : '#78ddff');
      super(opts.name || opts.petName || defaultName, x, y, {
        hp: opts.hp || opts.petHp || (petType === 'undead_knight' ? 240 : (undeadPet ? 95 : 58)),
        mana: 0,
        attack: opts.attack || opts.petAttack || (petType === 'undead_knight' ? 19 : (undeadPet ? 8 : 12)),
        defense: opts.defense || opts.petDefense || (petType === 'undead_knight' ? 8 : (undeadPet ? 3 : 2)),
        speed: opts.speed || (undeadPet ? 3.25 : 3.8),
        color,
        range: petType === 'shard' ? Math.max(5.4, Number(opts.range) || 0) : (opts.range || 1.45),
        kind: 'pet'
      });
      this.combatStyle = petType === 'shard' ? 'rangedCaster' : 'melee';
      this.autoAttackRangeTiles = petType === 'shard' ? 5.6 : 1.55;
      this.autoAttackProjectile = petType === 'shard';
      this.autoAttackDamageType = petType === 'shard' ? 'magic' : (opts.petDamageType || 'physical');
      this.attackDamageMin = Number(opts.attackDamageMin ?? opts.petAttackMin ?? 0);
      this.attackDamageMax = Number(opts.attackDamageMax ?? opts.petAttackMax ?? 0);
      this.attackIntervalSeconds = Number(opts.attackIntervalSeconds ?? opts.petAttackSpeed ?? 0);
      this.shieldBashDamage = Number(opts.shieldBashDamage || 0);
      this.shieldBashCooldown = Number(opts.shieldBashCooldown || 10);
      this.shieldBashTimer = 0;
      this.temporaryPet = opts.temporaryPet === true;
      this.temporaryLife = Number(opts.temporaryLife ?? opts.tempMinionDuration ?? 0);
      this.tempAttackLimit = Number(opts.tempAttackLimit ?? opts.attackLimit ?? 0);
      this.mainPetLife = this.temporaryPet ? 0 : Number(opts.mainPetLife ?? opts.petDuration ?? 0);
      this.autoAttack = false;
      this.autoAttackAutoEngaged = false;
      this.owner = owner;
      this.ownerId = opts.ownerId || owner?.botId || owner?.remoteId || owner?.id || null;
      this.petType = petType;
      this.className = undeadPet ? 'Necromancer' : 'Summoner';
      this.visualModel = undeadPet ? (petType === 'undead_knight' ? 'necroSkeletonKnight' : 'necroBoneServant') : 'summonerFloatingShard';
      this.hoveringPet = !undeadPet;
      this.spawnFx = 1.25;
      this.command = opts.command || 'assist';
      this.commandState = opts.commandState || this.command;
      this.level = Math.max(1, Math.floor(Number(opts.level || owner?.level || 1)));
      this.zone = opts.zone || owner?.zone || 'dark_woods';
      this.combatCooldown = Math.max(0, Number(opts.combatCooldown || 0));
      this.target = null;
      this.targetId = null;
      this.aiIntent = 'following';
    }

    isValidHostileTarget(game, target) {
      if (!target || target.alive === false || target.ambient || target.nonCombat) return false;
      if (!Number.isFinite(Number(target.x)) || !Number.isFinite(Number(target.y))) return false;
      if (game.isFriendlyTarget?.(target)) return false;
      if (game.isHostileTarget?.(target)) return true;
      if (target.hostile === true || String(target.faction || '').toLowerCase() === 'hostile') return true;
      return Array.isArray(game.enemies) && game.enemies.includes(target);
    }

    enemyById(game, id) {
      if (id == null) return null;
      return (game.enemies || []).find(enemy => this.isValidHostileTarget(game, enemy) && String(enemy.id) === String(id)) || null;
    }

    resolveOwnerAssistTarget(game) {
      const owner = this.owner;
      if (!owner || owner.alive === false) return null;
      const directIds = [owner.combatTargetId, owner.targetId, owner.forcedTargetId, owner.objectiveEnemyId, owner.adventureTargetId];
      for (const id of directIds) {
        const direct = this.enemyById(game, id);
        if (direct) return direct;
      }
      if (this.isValidHostileTarget(game, owner.target)) return owner.target;

      const ownerThreat = (game.enemies || []).find(enemy => this.isValidHostileTarget(game, enemy) && game.pickEnemyTarget?.(enemy) === owner);
      if (ownerThreat) return ownerThreat;

      const partyTarget = game.resolvePartyAssistTarget?.(this, {
        range: 12.5,
        preferPlayerTarget: true,
        allowUnengagedPlayerTarget: false
      });
      if (this.isValidHostileTarget(game, partyTarget)) return partyTarget;

      const supportActors = [game.player, game.merc, ...(game.botPlayers || []).filter(bot => {
        const role = String(bot?.role || bot?.className || '').toLowerCase();
        return /heal|cleric|druid|support|bard|enchant/.test(role);
      })].filter(Boolean);
      let threatenedSupport = null;
      let threatenedDistance = Infinity;
      for (const enemy of game.enemies || []) {
        if (!this.isValidHostileTarget(game, enemy)) continue;
        const victim = game.pickEnemyTarget?.(enemy);
        if (!supportActors.includes(victim)) continue;
        const distance = dist(this, enemy);
        if (distance <= 13.5 && distance < threatenedDistance) {
          threatenedSupport = enemy;
          threatenedDistance = distance;
        }
      }
      if (threatenedSupport) return threatenedSupport;

      const ownerInCombat = Number(owner.combatCooldown || 0) > 0 || owner._speechWasInCombat === true;
      if (!ownerInCombat) return null;
      return (game.enemies || [])
        .filter(enemy => this.isValidHostileTarget(game, enemy))
        .filter(enemy => enemy.aggro || enemy.hp < enemy.maxHp || Number(enemy.combatCooldown || 0) > 0)
        .map(enemy => ({ enemy, distance: dist(this, enemy) }))
        .filter(entry => entry.distance <= 10.5)
        .sort((a, b) => a.distance - b.distance)[0]?.enemy || null;
    }

    resolveExplicitAssistTarget(game) {
      const owner = this.owner;
      const ids = [this.forcedTargetId, this.targetId, owner?.targetId, owner?.combatTargetId, owner?.forcedTargetId, owner?.objectiveEnemyId, owner?.adventureTargetId]
        .filter(id => id != null);
      for (const id of ids) {
        const enemy = this.enemyById(game, id);
        if (enemy) return enemy;
      }
      const direct = game.getTarget?.();
      if (this.isValidHostileTarget(game, direct)) return direct;
      if (this.isValidHostileTarget(game, owner?.target)) return owner.target;
      return null;
    }

    ownerActiveThreats(game) {
      const owner = this.owner;
      if (!owner || owner.alive === false) return [];
      return (game.activeThreatsForEntity?.(owner) || []).filter(enemy => this.isValidHostileTarget(game, enemy));
    }

    sameEnemy(a, b) {
      if (!a || !b) return false;
      if (a === b) return true;
      const aId = a.id ?? a.enemyId ?? a.uid;
      const bId = b.id ?? b.enemyId ?? b.uid;
      return aId != null && bId != null && String(aId) === String(bId);
    }

    ownerIsThreatenedBy(game, candidate) {
      if (!this.isValidHostileTarget(game, candidate)) return false;
      return this.ownerActiveThreats(game).some(enemy => this.sameEnemy(enemy, candidate));
    }

    ownerHasActiveThreat(game) {
      return this.ownerActiveThreats(game).length > 0;
    }

    ownerIsMeditatingOrResting(game) {
      const owner = this.owner;
      if (!owner) return false;
      return Boolean(
        game.actorIsMeditating?.(owner)
        || owner.meditating
        || owner.resting
        || owner.isResting
        || String(owner.botState || owner.currentActivityLabel || '').toLowerCase().includes('meditat')
        || String(owner.commandState || '').toLowerCase().includes('rest')
      );
    }

    ownerIsBusyNonCombat(game) {
      const owner = this.owner;
      if (!owner) return false;
      return Boolean(owner.gathering || owner.harvesting || owner.fishing || owner.castingGathering || game.resourceGatheringSystem?.active);
    }

    ownerCombatIntentActive(game, candidate = null) {
      const owner = this.owner;
      if (!owner || owner.alive === false) return false;

      // V0.14.40: assist-mode discipline is shared by Bone Servant and Azure Shard.
      // Recovery and non-combat actions are hard gates.  Stale threat, selected mobs,
      // proximity aggro, or old damaged targets must not wake an assist pet while the
      // owner is meditating, resting, harvesting, fishing, or otherwise out of combat.
      if (this.ownerIsMeditatingOrResting(game) || this.ownerIsBusyNonCombat(game)) return false;

      const hasExplicitCandidate = candidate != null;
      if (!hasExplicitCandidate && this.ownerHasActiveThreat(game)) return true;

      const direct = hasExplicitCandidate ? candidate : this.resolveExplicitAssistTarget(game);
      if (!this.isValidHostileTarget(game, direct)) return this.ownerHasActiveThreat(game);

      // If the owner is under attack, assist the actual attacker.  Do not treat a
      // random selected target as valid just because some other enemy is threatening
      // the owner; that was one path into pet self-pulls.
      if (this.ownerIsThreatenedBy(game, direct)) return true;

      const ownerTargetMatches = String(owner.targetId ?? owner.combatTargetId ?? '') === String(direct.id ?? '');
      const ownerDirectAttack = Boolean(owner.autoAttack && ownerTargetMatches);
      if (ownerDirectAttack) return true;

      const ownerRecentCombat = Number(owner.combatCooldown || 0) > 0 || owner._speechWasInCombat === true;
      if (!ownerRecentCombat) return false;

      const targetEngaged = Boolean(
        direct.aggro
        || Number(direct.combatCooldown || 0) > 0
        || Number(direct.hp || 0) < Number(direct.maxHp || direct.hp || 0)
      );
      return ownerTargetMatches && targetEngaged;
    }

    resolveAssistModeTarget(game) {
      const owner = this.owner;
      if (!owner || owner.alive === false) return null;
      if (this.ownerIsMeditatingOrResting(game) || this.ownerIsBusyNonCombat(game)) return null;

      // Defend the owner first, then assist the owner's active attack target.  This
      // keeps both Necromancer and Summoner pets from charging a merely selected mob.
      let bestThreat = null;
      let bestThreatDistance = Infinity;
      for (const enemy of this.ownerActiveThreats(game)) {
        const d = dist(this, enemy);
        if (d < bestThreatDistance) {
          bestThreat = enemy;
          bestThreatDistance = d;
        }
      }
      if (bestThreat) return bestThreat;

      const direct = this.resolveExplicitAssistTarget(game);
      if (direct && this.ownerCombatIntentActive(game, direct)) return direct;
      return null;
    }

    clearAssistModeCombatState(game, reason = 'owner-out-of-combat') {
      this.autoAttack = false;
      this.autoAttackAutoEngaged = false;
      this.target = null;
      this.targetId = null;
      this.forcedTargetId = null;
      this.combatCooldown = 0;
      this.attackTimer = Math.min(Number(this.attackTimer || 0), 0.15);
      this.aiIntent = dist(this, this.owner || this) > 1.8 ? 'following' : 'idle';
      this.commandState = this.aiIntent === 'following' ? 'following' : 'assist-idle';
      this._assistIdleReason = reason;

      // Clear this pet's own stale threat contribution so an assist pet cannot keep
      // itself in combat after the owner has disengaged.  The owner/system threat
      // tables remain intact; only this pet's independent entries are removed.
      if (typeof game.clearThreatForEntity === 'function') game.clearThreatForEntity(this);
      else {
        for (const enemy of game.enemies || []) {
          if (!enemy || !enemy.threatTable) continue;
          delete enemy.threatTable[String(this.id)];
          if (String(enemy.forcedTargetId ?? '') === String(this.id ?? '')) {
            enemy.forcedTargetId = null;
            enemy.forcedTargetTimer = 0;
          }
        }
      }
    }

    resolveSustainedCombatTarget(game) {
      const command = String(this.command || 'assist');
      if (command === 'passive' || command === 'follow') return null;
      const owner = this.owner;
      const candidates = [
        this.target,
        this.enemyById(game, this.targetId),
        this.enemyById(game, this.forcedTargetId),
        owner?.target,
        this.enemyById(game, owner?.targetId),
        this.enemyById(game, owner?.combatTargetId)
      ].filter(Boolean);
      const petLeash = this.hoveringPet ? 10.5 : 8.75;
      const ownerLeash = this.hoveringPet ? 15.0 : 13.5;
      for (const enemy of candidates) {
        if (!this.isValidHostileTarget(game, enemy)) continue;
        const dPet = dist(this, enemy);
        const dOwner = owner ? dist(owner, enemy) : dPet;
        const enemyStillEngaged = enemy.aggro === true || Number(enemy.combatCooldown || 0) > 0 || Number(enemy.hp || 0) < Number(enemy.maxHp || enemy.hp || 0);
        const petStillEngaged = Number(this.combatCooldown || 0) > 0 || this.autoAttack === true || Number(this.attackTimer || 0) > 0;
        const ownerStillEngaged = Number(owner?.combatCooldown || 0) > 0 || owner?._speechWasInCombat === true;
        if (command === 'assist' && !this.ownerCombatIntentActive(game, enemy)) continue;
        if ((enemyStillEngaged || petStillEngaged || ownerStillEngaged || command === 'attack') && dPet <= petLeash && dOwner <= ownerLeash) {
          return enemy;
        }
      }
      return null;
    }

    resolveAutoAttackDamage(game, target) {
      const base = Math.max(1, Number(this.getStat?.('attack') || this.attack || 1));
      let damage = 0;
      if (this.attackDamageMin > 0 && this.attackDamageMax >= this.attackDamageMin) damage = randInt(Math.floor(this.attackDamageMin), Math.floor(this.attackDamageMax));
      else {
        const variance = randInt(1, 4);
        damage = this.petType === 'shard' ? Math.max(1, Math.floor(base * 0.72 + variance)) : Math.max(1, Math.floor(base * 0.86 + variance));
      }
      if (this.owner?.className === 'Necromancer' || String(this.className || '').toLowerCase() === 'necromancer') {
        const mark = target?.buffs?.find?.(effect => effect && effect.remaining > 0 && effect.id === 'necro_plague_mark');
        if (mark) damage = Math.floor(damage * (1 + Number(mark.petDamageBonusPct || 0.10)));
        const lich = this.owner?.buffs?.find?.(effect => effect && effect.remaining > 0 && effect.id === 'necro_lich_form');
        if (lich) damage = Math.floor(damage * Number(lich.petDamageMultiplier || 1.10));
      }
      return Math.max(1, damage);
    }

    targetBodyReach(target) {
      const explicit = Number(target?.combatRadius ?? target?.hitRadius ?? target?.bodyRadius ?? target?.collisionRadius ?? target?.radius);
      if (Number.isFinite(explicit) && explicit > 0) return Math.max(0, Math.min(1.45, explicit));
      const haystack = String(`${target?.name || ''} ${target?.baseType?.name || ''} ${target?.baseType?.id || ''} ${target?.baseType?.family || ''}`).toLowerCase();
      if (/boar|stag|bear|wolf|beast|bristle|briar/.test(haystack)) return 1.05;
      if (/spider|brood|chitin|widow|venom|spinner/.test(haystack)) return 0.85;
      if (/golem|treant|guardian|elite|boss|root/.test(haystack) || target?.elite || target?.boss || target?.dungeonBoss) return 1.15;
      if (/rotling|gloom|imp|rat|crawler/.test(haystack)) return 0.55;
      return 0.42;
    }

    effectiveAutoAttackRange(target) {
      if (this.petType === 'shard' || this.hoveringPet) return 5.6;
      const weaponReach = Math.max(1.55, Number(this.range || this.autoAttackRangeTiles || 1.55));
      // Bone Servant is a large procedural skeleton using center-point movement against
      // wide enemy sprites.  Give melee reach enough body-spacing tolerance so it does
      // not park beside large mobs and wait forever even though its blade visually
      // reaches the target.
      return Math.max(2.35, weaponReach + this.targetBodyReach(target) + 0.42);
    }

    canPetAutoAttackTarget(game, target) {
      if (!this.isValidHostileTarget(game, target)) return false;
      const ranged = this.petType === 'shard' || this.hoveringPet;
      const range = this.effectiveAutoAttackRange(target);
      if (dist(this, target) > range + (ranged ? 0.12 : 0.18)) return false;
      if (ranged && game.companionHasClearCombatLine?.(this, target, { desiredRange: range, requireLineOfSight: true }) === false) return false;
      return true;
    }

    performAutoAttack(game, target) {
      if (!this.canPetAutoAttackTarget(game, target)) return false;
      const ranged = this.petType === 'shard' || this.hoveringPet;
      const range = this.effectiveAutoAttackRange(target);
      this.setFacingFromDelta(target.x - this.x, target.y - this.y);
      this.autoAttack = true;
      this.autoAttackAutoEngaged = true;
      this.aiIntent = 'attacking';
      this.commandState = String(this.command || 'assist') === 'attack' ? 'attacking' : 'assisting';
      this.attackAnim = 1;
      if (ranged) this.spellCastAnim = Math.max(this.spellCastAnim || 0, 0.72);
      const color = (this.petType === 'undead' || this.petType === 'undead_knight' || this.petType === 'undead_minion') ? '#d8e5b4' : '#66d6ff';
      game.playAttackAnimation?.(this, target, color, (this.petType === 'undead' || this.petType === 'undead_knight' || this.petType === 'undead_minion') ? 'claw' : 'cast');
      if (ranged) game.spawnBolt?.(this, target, color);
      target.aggro = true;
      target.combatCooldown = Math.max(Number(target.combatCooldown || 0), 7.5);
      target.lastDamagedBy = this;
      target.lastDamagedById = this.id;
      game.damageEntity?.(target, this.resolveAutoAttackDamage(game, target), this, color, { damageType: ranged ? 'magic' : 'physical', source: 'pet-auto-attack' });
      if (this.temporaryPet && Number(this.tempAttackLimit || 0) > 0) {
        this.tempAttackLimit = Math.max(0, Math.floor(Number(this.tempAttackLimit || 0)) - 1);
        if (this.tempAttackLimit <= 0) {
          this.alive = false;
          this.hidden = true;
          game.entities = (game.entities || []).filter(entity => entity !== this);
          return true;
        }
      }
      if (this.shieldBashDamage > 0 && this.shieldBashTimer <= 0 && target.alive) {
        game.damageEntity?.(target, this.shieldBashDamage, this, '#e6f2bf', { damageType: 'physical', source: 'skeleton-knight-shield-bash' });
        this.shieldBashTimer = Math.max(0.5, this.shieldBashCooldown || 10);
        game.spawnStatusPulse?.(target, '#e6f2bf', 'Shield Bash');
      }
      this.attackTimer = this.attackIntervalSeconds > 0
        ? this.attackIntervalSeconds
        : (game.getAutoAttackIntervalSeconds
          ? game.getAutoAttackIntervalSeconds(this, { source: 'pet-auto-attack', baseSeconds: ranged ? 2.35 : 2.45 })
          : (ranged ? 2.35 : 2.45));
      this.combatCooldown = Math.max(this.combatCooldown || 0, 6.5);
      return true;
    }

    selectPetTarget(game) {
      const command = String(this.command || 'assist');
      if (command === 'passive' || command === 'follow') return null;
      const sustainedTarget = this.resolveSustainedCombatTarget(game);
      if (sustainedTarget) return sustainedTarget;
      const explicitAssist = this.resolveExplicitAssistTarget(game);
      const partyAssist = game.resolvePartyAssistTarget?.(this, { range: 12.5, preferPlayerTarget: true, allowUnengagedPlayerTarget: true });
      const playerTarget = game.getTarget?.();
      const engagedPlayerTarget = this.isValidHostileTarget(game, playerTarget) ? playerTarget : null;
      if (command === 'attack') return explicitAssist || engagedPlayerTarget || partyAssist || game.nearestEnemy?.(this.x, this.y, this.hoveringPet ? 9 : 7);
      if (command === 'assist') {
        // Assist is owner-combat only.  Do not use selected targets, party proximity,
        // damaged enemies, patrol scans, or nearest-enemy fallback unless the owner is
        // actively fighting or being attacked.
        return this.resolveAssistModeTarget(game);
      }
      if (command === 'guard') {
        const allies = game.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor: this.owner, range: 14 })?.map(entry => entry.actor) || [this.owner, this];
        let best = null;
        let bestScore = Infinity;
        for (const enemy of game.enemies || []) {
          if (!enemy?.alive) continue;
          const target = game.pickEnemyTarget?.(enemy) || null;
          const isThreat = allies.includes(target) || enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0;
          if (!isThreat) continue;
          const d = dist(enemy, this);
          if (d > 8.5) continue;
          const score = d + (target === this.owner ? -2 : target === this ? -1 : 0);
          if (score < bestScore) { best = enemy; bestScore = score; }
        }
        return best;
      }
      return null;
    }

    update(game, dt) {
      this.updateBase(dt);
      if (this.spawnFx > 0) this.spawnFx = Math.max(0, this.spawnFx - dt * 1.35);
      if (this.shieldBashTimer > 0) this.shieldBashTimer = Math.max(0, this.shieldBashTimer - dt);
      if (this.temporaryPet) {
        this.temporaryLife = Math.max(0, Number(this.temporaryLife || 0) - dt);
        if (this.temporaryLife <= 0) {
          this.alive = false;
          this.hidden = true;
          game.entities = (game.entities || []).filter(entity => entity !== this);
          return;
        }
      }
      if (!this.alive) return;
      if (!this.temporaryPet && Number(this.mainPetLife || 0) > 0) {
        this.mainPetLife = Math.max(0, Number(this.mainPetLife || 0) - dt);
        if (this.mainPetLife <= 0) {
          this.alive = false;
          this.hidden = true;
          if (game.pet === this) game.pet = null;
          game.entities = (game.entities || []).filter(entity => entity !== this);
          return;
        }
      }

      this.zone = this.owner?.zone || game.currentZone || this.zone || 'dark_woods';

      // Cosmetic-only mirroring: the pet never meditates itself (no XP, no
      // group/Bard synergy, no environmental bonus) - it just sits idle and
      // shows a simplified owner aura while the owner is meditating.
      this.meditationMirror = this.ownerIsMeditatingOrResting(game) && Boolean(game.actorIsMeditating?.(this.owner));
      if (this.meditationMirror) {
        this.vx = 0;
        this.vy = 0;
        this.target = null;
        this.targetId = null;
        return;
      }

      if (dist(this, this.owner) > 12) {
        this.x = this.owner.x + 0.4;
        this.y = this.owner.y + 0.4;
        return;
      }

      const command = String(this.command || 'assist');
      if (command === 'assist' && !this.ownerCombatIntentActive(game)) {
        this.clearAssistModeCombatState(game, this.ownerIsMeditatingOrResting(game) ? 'owner-resting' : 'owner-out-of-combat');
      }
      const target = command === 'assist' && !this.ownerCombatIntentActive(game) ? null : this.selectPetTarget(game);
      if (this.isValidHostileTarget(game, target)) {
        this.target = target;
        this.targetId = target.id ?? null;
        this.aiIntent = 'attacking';
        this.commandState = command === 'attack' ? 'attacking' : command === 'guard' ? 'guarding' : 'assisting';
        const rangedPet = this.petType === 'shard' || this.hoveringPet;
        const attackRange = this.effectiveAutoAttackRange(target);
        const desiredRange = rangedPet ? 4.4 : Math.max(1.55, Math.min(1.95, attackRange * 0.78));
        const anchor = game.companionCombatAnchor?.(this, target, { preferredRange: desiredRange }) || target;
        const clearCombatLine = rangedPet
          ? game.companionHasClearCombatLine?.(this, target, { desiredRange: attackRange, requireLineOfSight: true }) !== false
          : true;
        const canAttackNow = this.canPetAutoAttackTarget(game, target) && clearCombatLine;
        if (canAttackNow) {
          game.applyCompanionSeparation?.(this, { range: rangedPet ? 0.62 : 0.52, strength: 0.16 });
          this.setFacingFromDelta(target.x - this.x, target.y - this.y);
          this.autoAttack = true;
          this.combatCooldown = Math.max(this.combatCooldown || 0, 6.5);
          target.aggro = true;
          target.combatCooldown = Math.max(Number(target.combatCooldown || 0), 6.5);
          target.lastDamagedBy = target.lastDamagedBy || this;
          if (this.attackTimer <= 0) this.performAutoAttack(game, target);
        } else {
          if (!clearCombatLine) this._forcePathRecalcAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const moved = game.moveCompanionToCombatPosition
            ? game.moveCompanionToCombatPosition(this, target, dt, {
                role: rangedPet ? 'ranged-pet' : 'melee-pet',
                desiredRange,
                stopRange: rangedPet ? 0.55 : 0.42,
                requireLineOfSight: rangedPet,
                requireMeleeClearance: false,
                recalcMs: rangedPet ? 650 : 420,
                allowPartialPath: true
              })
            : this.moveToward(game, anchor.x, anchor.y, dt, rangedPet ? 0.55 : 0.42);

          // Owning pet AI fallback: if the shared companion path planner declines to
          // move and the melee pet is still outside attack range, push directly toward
          // the combat anchor/target using the pet's normal movement owner. This avoids
          // the Bone Servant standing idle when the planner believes no new path is
          // needed but the pet is not actually in weapon reach.
          if (!moved && !rangedPet && !this.canPetAutoAttackTarget(game, target)) {
            const fallbackStop = Math.max(0.72, Math.min(1.18, attackRange - 0.72));
            const fallback = anchor && Number.isFinite(Number(anchor.x)) && Number.isFinite(Number(anchor.y))
              ? anchor
              : target;
            this.moveToward(game, fallback.x, fallback.y, dt, fallbackStop);
          }

          if (!rangedPet && dist(this, target) <= attackRange + 0.75) {
            this._forcePathRecalcAt = 0;
            this.autoAttack = true;
            this.combatCooldown = Math.max(this.combatCooldown || 0, 6.5);
            target.aggro = true;
            target.combatCooldown = Math.max(Number(target.combatCooldown || 0), 6.5);
            if (this.attackTimer <= 0) this.performAutoAttack(game, target);
          }
        }
      } else if (this.owner && dist(this, this.owner) > 1.8) {
        this.autoAttack = false;
        this.target = null;
        this.targetId = null;
        this.forcedTargetId = null;
        this.aiIntent = 'following';
        this.commandState = command === 'passive' ? 'passive-follow' : 'following';
        const offset = game.companionFormationOffset?.('pet', 0) || { x: -0.95, y: 0.88 };
        if (game.moveCompanionToPoint) game.moveCompanionToPoint(this, this.owner.x + offset.x, this.owner.y + offset.y, dt, { mode: 'pet-follow', stopRange: 1.4, recalcMs: 720, allowPartialPath: true });
        else this.moveToward(game, this.owner.x + offset.x, this.owner.y + offset.y, dt, 1.4);
      } else {
        this.autoAttack = false;
        this.target = null;
        this.targetId = null;
        this.forcedTargetId = null;
        this.aiIntent = 'idle';
        this.commandState = command;
      }
    }
  }

  DR.entities.Pet = Pet;
  DR.Pet = Pet;
})();
