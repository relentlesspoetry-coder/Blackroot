(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};
  const { Entity } = DR.entities;
  const { CONFIG, CLASSES } = DR;
  const { dist, clamp } = DR.utils;
  const BotRoles = DR.BotRoles || {};

  const BOT_ACTOR_AI_MIN_INTERVAL = 0.05;

  const BOT_ROLE_BY_CLASS = Object.freeze({
    Fighter: 'tank',
    Cleric: 'healer',
    Druid: 'hybrid_healer_damage',
    Rogue: 'meleeDps',
    Bard: 'support_control',
    Enchanter: 'control_support',
    Summoner: 'pet_caster',
    Necromancer: 'pet_dot_caster'
  });

  function classStats(className, level = 1) {
    const cls = CLASSES[className] || CLASSES.Fighter || {};
    const scale = Math.max(1, Math.floor(Number(level) || 1));
    const attributes = DR.StatSystem?.attributesForClass?.(className, scale) || cls.attributes || {};
    return {
      hp: Math.floor((cls.hp || 100) + (scale - 1) * 14),
      mana: Math.floor((cls.mana || 0) + (scale - 1) * ((cls.mana || 0) > 0 ? 8 : 0)),
      attack: Math.floor((cls.attack || 8) + (scale - 1) * 2),
      defense: Math.floor((cls.defense || 2) + (scale - 1)),
      speed: (CONFIG.BASE_MOVE_SPEED || 3.2) * (cls.speed || 1) * 0.78,
      color: cls.color || '#eef8dc',
      attributes
    };
  }

  class BotPlayer extends Entity {
    constructor(profile = {}, x = CONFIG.START_X + 0.5, y = CONFIG.START_Y + 0.5) {
      const className = profile.className || 'Fighter';
      const level = Math.max(1, Math.floor(Number(profile.level) || 1));
      const stats = classStats(className, level);
      super(profile.name || 'Bot Player', x, y, {
        hp: stats.hp,
        mana: stats.mana,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        color: stats.color,
        level,
        range: profile.range || ((BotRoles.isMeleeDpsRole?.(BOT_ROLE_BY_CLASS[className]) || BotRoles.isTankRole?.(BOT_ROLE_BY_CLASS[className])) ? 1.45 : 6.2),
        kind: 'bot',
        attributes: stats.attributes
      });
      this.botId = profile.id || `bot-${Math.random().toString(36).slice(2, 8)}`;
      this.remoteId = this.botId;
      this.className = className;
      this.role = profile.role || BOT_ROLE_BY_CLASS[className] || 'meleeDps';
      this.botClassAiProfileId = profile.botClassAiProfileId || String(className || 'Fighter').toLowerCase();
      this.level = level;
      this.xp = Math.max(0, Math.floor(Number(profile.xp) || 0));
      this.nextXp = Math.max(60, Math.floor(Number(profile.nextXp) || (85 + level * 38)));
      this.gearScore = Math.max(0, Math.floor(Number(profile.gearScore) || (level * 4)));
      this.goal = profile.goal || 'questing';
      this.botState = 'idle';
      this.zone = profile.zone || 'overworld';
      this.partyId = profile.partyId || null;
      this.command = profile.command || 'autonomous';
      this.personalityId = profile.personalityId || '';
      this.personalityProfile = null;
      this.speechBubble = null;
      this.speechCooldownUntil = 0;
      this.speechEventCooldowns = {};
      this.speechSequence = 0;
      this.behaviorGoal = profile.behaviorGoal || profile.goal || 'questing';
      this.squadId = profile.squadId || null;
      this.currentQuestId = profile.currentQuestId || profile.questId || null;
      this.questStage = profile.questStage || 'active';
      this.questTaskProgress = profile.questTaskProgress && typeof profile.questTaskProgress === 'object' ? { ...profile.questTaskProgress } : {};
      this.campSupply = Math.max(0, Math.min(100, Number(profile.campSupply ?? 65)));
      this.campVisitCooldown = Math.max(0, Number(profile.campVisitCooldown || 0));
      this.dungeonIntent = profile.dungeonIntent || null;
      this.dungeonRunTimer = Math.max(0, Number(profile.dungeonRunTimer || 0));
      this.dungeonCooldown = Math.max(0, Number(profile.dungeonCooldown || 0));
      this.dungeonCompletions = Math.max(0, Math.floor(Number(profile.dungeonCompletions || 0)));
      this.completedQuestIds = Array.isArray(profile.completedQuestIds) ? [...profile.completedQuestIds] : [];
      this.gold = Math.max(0, Math.floor(Number(profile.gold || 18 + Math.random() * 18)));
      this.junkValue = Math.max(0, Math.floor(Number(profile.junkValue || 0)));
      this.upgradeFragments = Math.max(0, Math.floor(Number(profile.upgradeFragments || 0)));
      this.reputation = Math.max(0, Math.floor(Number(profile.reputation || 0)));
      this.repairDebt = Math.max(0, Math.floor(Number(profile.repairDebt || 0)));
      this.socialMood = profile.socialMood || ['focused', 'curious', 'cautious', 'confident'][Math.floor(Math.random() * 4)];
      this.currentActivityLabel = profile.currentActivityLabel || 'Questing';
      this.adventureTargetId = profile.adventureTargetId || profile.objectiveEnemyId || null;
      this.adventureAnchor = profile.adventureAnchor && Number.isFinite(Number(profile.adventureAnchor.x)) && Number.isFinite(Number(profile.adventureAnchor.y))
        ? { x: Number(profile.adventureAnchor.x), y: Number(profile.adventureAnchor.y), type: profile.adventureAnchor.type || 'quest' }
        : null;
      this.adventureCommitTimer = Math.max(0, Number(profile.adventureCommitTimer || 0));
      this.campExitTimer = Math.max(0, Number(profile.campExitTimer || 0));
      this.lastSocialLine = profile.lastSocialLine || '';
      this.socialCooldown = Math.max(0, Number(profile.socialCooldown || 6 + Math.random() * 10));
      this.economyTimer = Math.max(0, Number(profile.economyTimer || 2 + Math.random() * 4));
      this.botInventory = Array.isArray(profile.botInventory) ? profile.botInventory.filter(Boolean) : [];
      this.botEquipment = profile.botEquipment && typeof profile.botEquipment === 'object' ? { ...profile.botEquipment } : {};
      this.lootTradeCooldown = Math.max(0, Number(profile.lootTradeCooldown || 0));
      this.tradeRequestCooldown = Math.max(0, Number(profile.tradeRequestCooldown || 0));
      this.meditationIntent = profile.meditationIntent || '';
      this.worldPresenceTimer = Math.max(0, Number(profile.worldPresenceTimer || Math.random() * 1.5));
      this.actorAiAccumulator = Math.max(0, Number(profile.actorAiAccumulator || Math.random() * 0.25));
      this.actorAiInterval = Math.max(0, Number(profile.actorAiInterval || BOT_ACTOR_AI_MIN_INTERVAL));
      this.lastActorAiSkipReason = profile.lastActorAiSkipReason || '';
      this.lastStableX = Number.isFinite(Number(profile.lastStableX)) ? Number(profile.lastStableX) : x;
      this.lastStableY = Number.isFinite(Number(profile.lastStableY)) ? Number(profile.lastStableY) : y;
      this.stuckTimer = Math.max(0, Number(profile.stuckTimer || 0));
      this.pullCooldown = Math.max(0, Number(profile.pullCooldown || 0));
      this.supportCooldown = Math.max(0, Number(profile.supportCooldown || 0));
      this.botSpellCooldowns = profile.botSpellCooldowns && typeof profile.botSpellCooldowns === 'object' ? { ...profile.botSpellCooldowns } : {};
      this.botLastCastName = profile.botLastCastName || '';
      this.botPetId = profile.botPetId || null;
      this.botPet = null;
      this.lastKnownPartyAnchor = null;
      this.questName = profile.questName || 'Patrol Dark Woods';
      this.questProgress = Math.max(0, Math.floor(Number(profile.questProgress) || 0));
      this.questRequired = Math.max(1, Math.floor(Number(profile.questRequired) || 3));
      this.roamAnchor = profile.roamAnchor || { x, y };
      this.roamTarget = null;
      this.decisionTimer = 0.2 + Math.random() * 0.8;
      this.attackAiTimer = 0;
      this.healAiTimer = 0;
      this.respawnTimer = 0;
      this.meditating = false;
      this.appearanceSeed = Number.isFinite(Number(profile.appearanceSeed)) ? Number(profile.appearanceSeed) : Math.random();
      this.hairStyle = profile.hairStyle || ['short', 'long', 'braid', 'curls', 'undercut'][Math.floor(Math.random() * 5)];
      this.faceStyle = profile.faceStyle || ['balanced', 'sharp', 'soft', 'stern'][Math.floor(Math.random() * 4)];
      this.hairColor = profile.hairColor || ['#4b3628', '#2d241d', '#704326', '#d1a45e'][Math.floor(Math.random() * 4)];
      this.skinTone = profile.skinTone || ['#d8a87e', '#b9825a', '#8d5d42', '#e0b690'][Math.floor(Math.random() * 4)];
      this.clothesPrimary = profile.clothesPrimary || stats.color;
      this.clothesSecondary = profile.clothesSecondary || '#8a7356';
      this.maxHp = stats.hp;
      this.hp = clamp(profile.hp ?? this.maxHp, 1, this.maxHp);
      this.maxMana = stats.mana;
      this.mana = clamp(profile.mana ?? this.maxMana, 0, this.maxMana);
    }

    isGroupedWithPlayer(game) {
      return Boolean(game?.isBotInParty?.(this));
    }

    healNeedRatio() {
      return this.maxHp > 0 ? this.hp / this.maxHp : 1;
    }

    manaRatio() {
      return this.maxMana > 0 ? this.mana / this.maxMana : 1;
    }

    chooseRoamTarget(game) {
      const grouped = this.isGroupedWithPlayer(game);
      const objectiveAnchor = !grouped ? game.resolveBotAdventureAnchor?.(this) : null;
      const camp = !grouped ? game.botCampAnchor?.() : null;
      const inCamp = camp ? dist(this, camp) <= 7.25 : false;
      const anchor = grouped && game.player ? game.player : (objectiveAnchor || this.roamAnchor);

      if (!grouped && objectiveAnchor) {
        this.roamAnchor = { x: objectiveAnchor.x, y: objectiveAnchor.y };
        this.adventureAnchor = { x: objectiveAnchor.x, y: objectiveAnchor.y, type: objectiveAnchor.type || 'quest' };
        if (objectiveAnchor.enemyId) {
          this.objectiveEnemyId = objectiveAnchor.enemyId;
          this.adventureTargetId = objectiveAnchor.enemyId;
        }
        const objectiveDistance = dist(this, objectiveAnchor);
        if (inCamp && objectiveDistance > 5.0) {
          this.botState = 'leaving-camp-for-objective';
          this.currentActivityLabel = 'Leaving Camp';
          this.roamTarget = { x: objectiveAnchor.x, y: objectiveAnchor.y };
          return;
        }
        if (objectiveAnchor.enemyId && objectiveDistance > 2.4) {
          this.botState = 'traveling-to-hunt';
          this.currentActivityLabel = 'Hunting';
          this.roamTarget = { x: objectiveAnchor.x, y: objectiveAnchor.y };
          return;
        }
        if (!objectiveAnchor.enemyId && objectiveDistance > 3.8) {
          this.botState = objectiveAnchor.type === 'gather' ? 'traveling-to-gather' : 'traveling-to-objective';
          this.currentActivityLabel = objectiveAnchor.type === 'gather' ? 'Gathering Route' : 'Quest Route';
          this.roamTarget = { x: objectiveAnchor.x, y: objectiveAnchor.y };
          return;
        }
        this.currentActivityLabel = objectiveAnchor.type === 'hunt' ? 'Hunting' : objectiveAnchor.type === 'gather' ? 'Gathering' : 'Questing';
        this.botState = objectiveAnchor.type === 'hunt' ? 'hunting-mobs' : 'questing';
      }

      const radius = grouped ? 3.6 : (objectiveAnchor?.enemyId ? 1.2 : 4.4);
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = objectiveAnchor?.enemyId ? Math.random() * radius : 0.8 + Math.random() * radius;
        const tx = anchor.x + Math.cos(angle) * r;
        const ty = anchor.y + Math.sin(angle) * r;
        if (game.isWalkable?.(tx, ty, this)) {
          this.roamTarget = { x: tx, y: ty };
          return;
        }
      }
      this.roamTarget = anchor ? { x: anchor.x, y: anchor.y } : null;
    }

    updateBaseStatsFromLevel() {
      const wasDowned = this.alive === false || this.botState === 'downed';
      const hpPct = this.maxHp > 0 ? this.hp / this.maxHp : 1;
      const mpPct = this.maxMana > 0 ? this.mana / this.maxMana : 1;
      const stats = classStats(this.className, this.level);
      this.baseMaxHp = stats.hp;
      this.baseMaxMana = stats.mana;
      this.maxHp = Math.floor(stats.hp + this.gearScore * 1.2);
      this.maxMana = Math.floor(stats.mana + (this.maxMana > 0 ? this.gearScore * 0.7 : 0));
      this.attack = Math.floor(stats.attack + this.gearScore * 0.22);
      this.defense = Math.floor(stats.defense + this.gearScore * 0.18);
      this.speed = stats.speed;
      if (wasDowned) {
        this.alive = false;
        this.hp = 0;
        this.botState = this.botState || 'downed';
      } else {
        this.hp = clamp(Math.ceil(this.maxHp * hpPct), 1, this.maxHp);
      }
      this.mana = clamp(Math.ceil(this.maxMana * mpPct), 0, this.maxMana);
    }

    gainXp(game, amount, source = null) {
      const xp = Math.max(0, Math.floor(Number(amount) || 0));
      if (xp <= 0) return false;
      this.xp += xp;
      this.lastXpGain = xp;
      this.lastXpSource = source?.name || 'Questing';
      let leveled = false;
      while (this.xp >= this.nextXp) {
        this.xp -= this.nextXp;
        this.level += 1;
        this.nextXp = Math.floor(this.nextXp * 1.32 + 35);
        this.gearScore += 3 + Math.floor(Math.random() * 4);
        this.updateBaseStatsFromLevel();
        this.hp = this.maxHp;
        this.mana = this.maxMana;
        leveled = true;
      }
      if (leveled) game?.logParty?.(`${this.name} reached level ${this.level} and upgraded gear.`);
      return true;
    }

    recordQuestKill(game, enemy) {
      if (game?.advanceBotQuestProgress?.(this, 1, enemy)) return;
      this.questProgress += 1;
      if (this.questProgress >= this.questRequired) {
        this.questProgress = 0;
        this.questRequired = 3 + Math.floor(Math.random() * 4) + Math.floor(this.level / 3);
        this.questName = ['Cull Gloom Beasts', 'Gather Camp Supplies', 'Scout the Woodline', 'Clear the Old Road'][Math.floor(Math.random() * 4)];
        this.gainXp(game, 45 + this.level * 12, { name: 'Quest Complete' });
        this.botState = 'turning-in';
        game?.logParty?.(`${this.name} completed a bot quest: ${this.questName}.`);
      }
    }

    findHealTarget(game) {
      const candidates = [];
      const push = actor => {
        if (!actor || actor.alive === false || actor.maxHp <= 0) return;
        if (DR.utils.dist(this, actor) > 10.5) return;
        const hpRatio = actor.hp / Math.max(1, actor.maxHp);
        const criticalBias = hpRatio < 0.32 ? -0.42 : hpRatio < 0.55 ? -0.18 : 0;
        const roleBias = actor === this ? -0.22 : actor === game.player ? -0.20 : actor.kind === 'merc' ? -0.08 : actor.role === 'tank' ? -0.06 : 0;
        const inCombatBias = game.isEntityInCombat?.(actor) ? -0.12 : 0;
        candidates.push({ actor, score: hpRatio + roleBias + criticalBias + inCombatBias, hpRatio });
      };
      if (this.isGroupedWithPlayer(game)) {
        push(game.player);
        push(game.merc);
        push(game.pet);
        for (const bot of game.botPlayers || []) if (game.isBotInParty?.(bot)) push(bot);
        for (const id of game.partyMembers || []) {
          if (String(id) === String(game.localPeerId)) continue;
          push(game.remotePlayers?.get?.(id));
        }
      } else {
        for (const bot of game.botPlayers || []) push(bot);
      }
      candidates.sort((a, b) => a.score - b.score || a.hpRatio - b.hpRatio);
      return candidates[0]?.actor || null;
    }

    findProtectTarget(game) {
      if (!this.isGroupedWithPlayer(game)) return null;
      const remoteAllies = Array.from(game.partyMembers || [])
        .filter(id => String(id) !== String(game.localPeerId))
        .map(id => game.remotePlayers?.get?.(id));
      const allies = [game.player, game.merc, game.pet, ...(game.botPlayers || []).filter(bot => bot !== this && game.isBotInParty?.(bot)), ...remoteAllies]
        .filter(actor => actor && actor.alive !== false);
      let best = null;
      let bestScore = Infinity;
      const personality = game.botPersonalityProfile?.(this) || {};
      const protectiveness = Number(personality.protectiveness || 0.6);
      const maxProtectRange = 11.5 + Number(personality.riskTolerance || 0.45) * 3;
      for (const enemy of game.enemies || []) {
        if (!enemy?.alive) continue;
        const dSelf = dist(this, enemy);
        if (dSelf > maxProtectRange) continue;
        const threatTarget = game.getThreatTarget?.(enemy);
        const attackingAlly = allies.find(ally => ally && (threatTarget === ally || dist(ally, enemy) <= (enemy.range || 1.35) + 1.0 || ally.targetId === enemy.id));
        if (!attackingAlly) continue;
        const allyRatio = attackingAlly.hp / Math.max(1, attackingAlly.maxHp || 1);
        const priority = attackingAlly === game.player ? -3.0 : (BotRoles.isHealingSupportRole?.(attackingAlly.role) ? -2.2 : 0);
        const rarePriority = enemy.dungeonBoss || enemy.boss ? -2.0 : enemy.elite || enemy.rareNameplate ? -1.0 : 0;
        const score = dSelf + allyRatio * (5 + protectiveness * 2) + priority * (0.7 + protectiveness) + rarePriority;
        if (score < bestScore) { best = enemy; bestScore = score; }
      }
      return best;
    }

    selectTarget(game) {
      if (game.isBotTemporarilyBusy?.(this)) return null;
      const grouped = this.isGroupedWithPlayer(game);
      if (grouped) {
        const protect = this.findProtectTarget?.(game);
        if (protect?.alive) return protect;
        const assist = game.resolveBotAssistTarget?.(this, { range: 13.5 })
          || game.resolvePartyAssistTarget?.(this, { range: 12.5, preferPlayerTarget: true, allowUnengagedPlayerTarget: false });
        if (assist?.alive && game.isBotHostileCombatTarget?.(assist)) return assist;
        return null;
      }

      const squadAssist = game.resolveBotAssistTarget?.(this, { range: 10.5, includeAutonomousSquad: true });
      if (squadAssist?.alive) return squadAssist;

      const objectiveId = this.adventureTargetId || this.objectiveEnemyId;
      const objectiveEnemy = objectiveId ? (game.enemies || []).find(enemy => enemy?.alive && enemy.id === objectiveId) : null;
      if (objectiveEnemy && game.enemyMatchesBotQuest?.(objectiveEnemy, this)) {
        const dObjective = dist(this, objectiveEnemy);
        const nearObjectiveRoute = this.botState === 'traveling-to-hunt' || this.botState === 'hunting-mobs' || dObjective <= 11.5;
        if (nearObjectiveRoute && dObjective <= 12.5 && this.pullCooldown <= 0 && !game.actorIsMeditating?.(this)) {
          this.botState = 'hunting-mobs';
          this.currentActivityLabel = 'Engaging Objective';
          return objectiveEnemy;
        }
      }

      let best = null;
      let bestScore = Infinity;
      const camp = game.botCampAnchor?.();
      const outsideCamp = !camp || dist(this, camp) > 7.0;
      const canStartPull = this.pullCooldown <= 0 && !game.actorIsMeditating?.(this) && this.behaviorGoal !== 'recovering' && outsideCamp;
      for (const enemy of game.enemies || []) {
        if (!enemy?.alive) continue;
        if (game.enemyMatchesBotQuest && !game.enemyMatchesBotQuest(enemy, this)) continue;
        const d = dist(this, enemy);
        const hostile = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0;
        const questing = this.behaviorGoal === 'questing' || this.behaviorGoal === 'road-patrol' || this.botState === 'hunting-mobs' || this.botState === 'traveling-to-hunt';
        const range = hostile ? 10.5 : (questing ? 7.8 : 3.0);
        if (d > range) continue;
        if (!hostile && !canStartPull) continue;
        const levelDelta = Math.max(0, Number(enemy.level || 1) - this.level);
        if (!hostile && levelDelta > 2) continue;
        const questBonus = game.enemyMatchesBotQuest?.(enemy, this) ? -2.5 : 0;
        const objectiveBonus = enemy.id === objectiveId ? -5.0 : 0;
        const score = d + (hostile ? -4 : 2.5) + (enemy.elite ? 2.0 : 0) + levelDelta * 1.4 + questBonus + objectiveBonus;
        if (score < bestScore) { best = enemy; bestScore = score; }
      }
      return best;
    }

    followParty(game, dt) {
      if (!this.isGroupedWithPlayer(game) || !game.player) return false;
      const partyBots = (game.botPlayers || [])
        .filter(bot => bot && bot.alive !== false && game.isBotInParty?.(bot))
        .sort((a, b) => String(a.botId || a.remoteId || a.name).localeCompare(String(b.botId || b.remoteId || b.name)));
      const slot = Math.max(0, partyBots.findIndex(bot => bot === this));
      const offset = game.partyBotFormationOffset?.(this, slot) || { x: -1.25, y: 0.9 };
      const preferred = { x: game.player.x + offset.x, y: game.player.y + offset.y };
      this.lastKnownPartyAnchor = preferred;

      const playerMoving = game.isPlayerActivelyMoving?.() === true;
      const preferredDistance = dist(this, preferred);
      const playerDistance = dist(this, game.player);
      const holdRange = playerMoving ? 0.82 : 1.95;
      const closeEnoughToPlayer = !playerMoving && playerDistance <= 3.35;

      this.botState = game.botPlayerMovementIntent?.(this) || (playerMoving ? 'moving-with-party' : 'holding-party-formation');
      this.currentActivityLabel = playerMoving ? 'Following Party' : 'Holding Formation';

      if (preferredDistance <= holdRange || closeEnoughToPlayer) {
        this.roamTarget = null;
        this.vx = 0;
        this.vy = 0;
        this.moveBlend = 0;
        this._pathRoute = [];
        return true;
      }

      const moveDt = Math.min(Math.max(Number(dt) || 0, 0), playerMoving ? 1 / 30 : 1 / 45);
      const stopRange = playerMoving ? 0.72 : 1.18;
      if (game.moveCompanionToPoint) game.moveCompanionToPoint(this, preferred.x, preferred.y, moveDt, { mode: 'party-follow', stopRange, recalcMs: playerMoving ? 420 : 680, allowPartialPath: true });
      else this.moveToward(game, preferred.x, preferred.y, moveDt, stopRange);
      return true;
    }

    restIfNeeded(game, dt) {
      const hpRatio = this.healNeedRatio();
      const mpRatio = this.manaRatio();
      const personality = game.botPersonalityProfile?.(this) || {};
      const recoveryBias = Number(personality.recoveryBias || 1);
      const grouped0 = this.isGroupedWithPlayer(game);
      const desireScore = game.meditationDesireScore?.(this, {
        justLeftCombat: (game.meditationOutOfCombatSeconds?.(this) ?? Infinity) <= 10,
        partyMemberMeditating: grouped0 && Boolean(game.actorIsMeditating?.(game.player)),
        bardMeditatingNearby: (game.botPlayers || []).some(b => b !== this && b.alive && String(b.className || '').toLowerCase() === 'bard' && game.actorIsMeditating?.(b)),
        dangerNearby: Boolean(game.isEntityInCombat?.(this))
      }) ?? 0.5;
      // Desire score nudges the existing personality-driven thresholds rather
      // than replacing them - a high-desire bot rests a little sooner, a
      // low/cautious one waits a little longer.
      const desireShift = (desireScore - 0.5) * 0.08;
      const hpRecoveryThreshold = Math.max(0.90, Math.min(0.97, 0.94 + (recoveryBias - 1) * 0.12 + desireShift));
      const manaRecoveryThreshold = Math.max(0.84, Math.min(0.94, 0.88 + (recoveryBias - 1) * 0.14 + desireShift));
      const needsHp = game.actorIsMeditating?.(this) ? this.hp < this.maxHp : hpRatio < hpRecoveryThreshold;
      const needsMp = this.maxMana > 0 && (game.actorIsMeditating?.(this) ? this.mana < this.maxMana : mpRatio < manaRecoveryThreshold);
      const grouped = grouped0;
      const playerMoving = grouped && game.isPlayerActivelyMoving?.();
      const combat = game.isEntityInCombat?.(this) || (!game.actorIsMeditating?.(this) && this.selectTarget(game));

      if (!needsHp && !needsMp) {
        if (game.actorIsMeditating?.(this)) game.cancelMeditation?.(this, 'full', { silent: true });
        this.meditationIntent = '';
        return false;
      }
      if (combat || playerMoving) {
        if (game.actorIsMeditating?.(this)) game.cancelMeditation?.(this, combat ? 'combat' : 'party moving', { silent: true });
        this.meditationIntent = '';
        if (playerMoving) return this.followParty(game, dt);
        return false;
      }
      if (grouped && game.player && dist(this, game.player) > 4.2) {
        if (game.actorIsMeditating?.(this)) game.cancelMeditation?.(this, 'too far from party', { silent: true });
        this.meditationIntent = 'waiting-for-party-anchor';
        return this.followParty(game, dt);
      }
      if (game.actorIsMeditating?.(this) || !grouped || !game.player || dist(this, game.player) <= 4.2) {
        const wasMeditating = !!game.actorIsMeditating?.(this);
        if (wasMeditating || game.startMeditation?.(this, { silent: true })) {
          if (!wasMeditating) game.queueBotSpeechEvent?.(this, 'startRecovery', { priority: 2 });
          this.botState = grouped ? 'party-meditating' : 'meditating';
          this.currentActivityLabel = grouped ? 'Party Meditate' : 'Meditating';
          this.meditationIntent = grouped ? 'party-rest-to-full' : 'auto-rest-to-full';
          this.vx = 0;
          this.vy = 0;
          this.moveBlend = 0;
          this.roamTarget = null;
          if (Array.isArray(this._pathRoute)) this._pathRoute.length = 0;
          this._pathTarget = null;
          game.lockMeditatingActorMovement?.(this);
          game.updateMeditationForEntity?.(this, dt, { silent: true });
          return true;
        }
      }
      return false;
    }

    updateCombat(game, target, dt) {
      if (!target?.alive || game.isBotHostileCombatTarget?.(target) !== true) return false;
      const role = this.role || 'meleeDps';
      const isTank = BotRoles.isTankRole?.(role) || role === 'tank';
      const isHealer = BotRoles.isHealingSupportRole?.(role) || role === 'healer' || role === 'support';
      const isSupport = BotRoles.isSupportRole?.(role) || role === 'support';
      const isControl = BotRoles.isControlRole?.(role) || role === 'casterDps';
      const ranged = BotRoles.isRangedRole?.(role) || role === 'healer' || role === 'casterDps' || role === 'support';
      const desiredRange = isTank ? 1.18 : (ranged ? 5.45 : 1.42);
      const anchor = game.companionCombatAnchor?.(this, target, { preferredRange: desiredRange });
      const anchorDistance = anchor ? dist(this, anchor) : 0;
      const d = dist(this, target);
      game.markBotOwnerCombatTarget?.(this, target, { cooldown: 4.0 });
      game.markBotSquadCombat?.(this, target);
      if (!target.aggro && this.pullCooldown <= 0) this.pullCooldown = isTank ? 3.2 : 5.0;
      this.botState = ranged ? 'casting' : 'attacking';
      this.currentActivityLabel = isTank ? 'Tanking' : (ranged ? 'Casting' : 'Fighting');
      this.combatCooldown = Math.max(this.combatCooldown || 0, 4.0);
      target.aggro = true;
      const threat = isTank ? 28 : (isHealer || isSupport ? 3 : 7);
      game.addThreat?.(target, this, threat, { reason: 'bot-role-engage', actorCombatSeconds: 3.5, combatSeconds: 4.5 });
      if (isTank) {
        const threatTarget = game.getThreatTarget?.(target);
        if (threatTarget && threatTarget !== this && this.supportCooldown <= 0) {
          game.addThreat?.(target, this, 38, { reason: 'bot-tank-taunt', taunt: true, tauntBonus: 28, actorCombatSeconds: 5.0, combatSeconds: 5.5 });
          game.spawnCastCue?.(this, '#ffd18a', 'Taunt');
          this.supportCooldown = 5.5;
        }
      } else if ((isSupport || isControl) && this.supportCooldown <= 0 && d <= 7.0) {
        const supportFlavor = isSupport && !BotRoles.isCasterDpsRole?.(role);
        const debuffColor = supportFlavor ? '#d6b8ff' : '#8fd7ff';
        game.applyStatusEffect?.(target, {
          id: supportFlavor ? 'bot_disrupting_refrain' : 'bot_arcane_snare',
          name: supportFlavor ? 'Disrupting Refrain' : 'Arcane Snare',
          type: 'debuff',
          duration: supportFlavor ? 5.5 : 4.5,
          mods: { attack: supportFlavor ? -2 : -1, defense: -1 },
          tags: ['slow'],
          color: debuffColor,
          hostile: true
        }, this);
        game.spawnCastCue?.(this, debuffColor, supportFlavor ? 'Debuff' : 'Snare');
        this.supportCooldown = supportFlavor ? 7.0 : 8.5;
      }
      game.markPartyCombatEngaged?.(target, this, { cooldown: 4.5 });
      const blockedCombatLine = game.companionHasClearCombatLine?.(this, target, { desiredRange, requireLineOfSight: ranged, requireMeleeClearance: !ranged }) === false;
      if (anchor && (blockedCombatLine || anchorDistance > (ranged ? 0.95 : 0.62) || d > desiredRange + 0.45)) {
        if (game.moveCompanionToCombatPosition) game.moveCompanionToCombatPosition(this, target, dt, {
          role: this.role,
          desiredRange,
          stopRange: ranged ? 0.55 : 0.46,
          requireLineOfSight: ranged,
          recalcMs: ranged ? 720 : 520,
          maxRange: 58,
          maxNodes: 1700
        });
        else this.moveToward(game, anchor.x, anchor.y, dt, ranged ? 0.55 : 0.46);
        return true;
      }
      if (d < desiredRange - 1.35 && ranged) {
        const dx = this.x - target.x;
        const dy = this.y - target.y;
        const len = Math.hypot(dx, dy) || 1;
        const tx = this.x + (dx / len) * 1.8;
        const ty = this.y + (dy / len) * 1.8;
        if (game.moveCompanionToPoint) game.moveCompanionToPoint(this, tx, ty, dt, { mode: 'ranged-keepaway', stopRange: 0.28, recalcMs: 520, allowPartialPath: true });
        else if (game.isWalkable?.(tx, ty, this)) game.tryMove?.(this, tx, ty);
      }
      game.applyCompanionSeparation?.(this, { range: ranged ? 0.76 : 0.58, strength: ranged ? 0.20 : 0.14 });
      this.setFacingFromDelta(target.x - this.x, target.y - this.y);
      if (this.attackAiTimer > 0 || this.attackTimer > 0) return true;
      const clearCombatLine = game.companionHasClearCombatLine?.(this, target, { desiredRange, requireLineOfSight: ranged, requireMeleeClearance: !ranged }) !== false;
      if (!clearCombatLine) {
        this._forcePathRecalcAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        return true;
      }
      const color = BotRoles.isPrimaryHealerRole?.(role) ? '#fff2b8' : (ranged ? '#a8e6ff' : '#ffd18a');
      const damageType = ranged ? 'magic' : 'physical';
      const rolePower = isTank ? 0.72 : (ranged ? 0.86 : 0.98);
      const raw = Math.max(2, Math.floor(this.getStat('attack') * rolePower + this.level * 1.35 + Math.random() * 4));
      game.playAttackAnimation?.(this, target, color, ranged ? 'cast' : 'slash');
      game.spawnCastCue?.(this, color, ranged ? 'Spell' : 'Strike');
      game.damageEntity?.(target, raw, this, color, { damageType, canCrit: true });
      if (isTank) game.addThreat?.(target, this, raw * 1.65, { reason: 'bot-tank-strike', flatBonus: 10 });
      this.attackAiTimer = game.getAutoAttackIntervalSeconds
        ? game.getAutoAttackIntervalSeconds(this, { source: 'bot-auto-attack' })
        : 2.5;
      this.attackTimer = this.attackAiTimer * 0.65;
      return true;
    }

    updateHealer(game, dt) {
      const role = this.role || 'meleeDps';
      const canFallbackHeal = BotRoles.isHealingSupportRole?.(role) || role === 'healer' || role === 'support';
      if (!canFallbackHeal) return false;
      const target = this.findHealTarget(game);
      const targetRatio = target ? target.hp / Math.max(1, target.maxHp) : 1;
      const threshold = BotRoles.isPrimaryHealerRole?.(role)
        ? (game.isEntityInCombat?.(target) ? 0.88 : 0.76)
        : (game.isEntityInCombat?.(target) ? 0.66 : 0.52);
      if (!target || targetRatio > threshold) return false;
      const d = dist(this, target);
      if (d > 7.2) {
        this.botState = 'moving-to-heal';
        this.currentActivityLabel = 'Moving to Heal';
        if (game.moveCompanionToPoint) game.moveCompanionToPoint(this, target.x, target.y, dt, { mode: 'move-to-heal', stopRange: 5.6, recalcMs: 650, allowPartialPath: true });
        else this.moveToward(game, target.x, target.y, dt, 5.6);
        return true;
      }
      if (this.healAiTimer > 0 || this.mana < 8) return false;
      this.setFacingFromDelta(target.x - this.x, target.y - this.y);
      const emergency = targetRatio < 0.38;
      const amount = Math.floor((emergency ? 26 : 18) + this.level * (emergency ? 6 : 5) + this.getStat('attack') * (emergency ? 0.70 : 0.55));
      game.healEntity?.(target, amount, true, this, { damageType: 'healing' });
      if (BotRoles.isPrimaryHealerRole?.(role) && emergency) {
        game.applyStatusEffect?.(target, { id: 'bot_renewing_grace', name: 'Renewing Grace', type: 'hot', duration: 6.0, tickRate: 2.0, periodicHealing: Math.max(3, Math.floor(this.level * 1.6)), color: '#b8ffd8', hostile: false }, this);
      } else if ((role === 'support' || role === 'support_control') && this.supportCooldown <= 0) {
        game.applyStatusEffect?.(target, { id: 'bot_guarded_rhythm', name: 'Guarded Rhythm', type: 'buff', duration: 7.0, mods: { defense: 2 }, color: '#f4d27d', hostile: false }, this);
        this.supportCooldown = 8.0;
      }
      game.spawnStatusPulse?.(target, '#b8ffd8', emergency ? 'Emergency Heal' : 'Bot Heal');
      this.mana = Math.max(0, this.mana - (emergency ? 11 : 8));
      this.spellCastAnim = 1;
      this.botState = emergency ? 'emergency-healing' : 'healing';
      this.currentActivityLabel = emergency ? 'Emergency Heal' : 'Healing';
      this.healAiTimer = emergency ? 1.45 : (BotRoles.isPrimaryHealerRole?.(role) ? 2.2 : 4.0);
      return true;
    }

    updateRoam(game, dt) {
      this.decisionTimer = Math.max(0, this.decisionTimer - dt);
      const grouped = this.isGroupedWithPlayer(game);
      const objective = !grouped ? game.resolveBotAdventureAnchor?.(this) : null;
      const camp = !grouped ? game.botCampAnchor?.() : null;
      const inCamp = camp ? dist(this, camp) <= 7.25 : false;
      const shouldLeaveCamp = !grouped && objective && inCamp && !game.shouldBotVisitCamp?.(this) && this.questStage !== 'turn-in';
      const staleObjective = objective && this.roamTarget && dist(this.roamTarget, objective) > 6.5;

      if (shouldLeaveCamp) {
        this.botState = 'leaving-camp-for-objective';
        this.currentActivityLabel = 'Leaving Camp';
        this.roamTarget = { x: objective.x, y: objective.y };
        this.campExitTimer = Math.max(0.75, Number(this.campExitTimer || 0));
      }

      if (!this.roamTarget || staleObjective || this.decisionTimer <= 0 || dist(this, this.roamTarget) < 0.7) {
        this.decisionTimer = objective ? 0.65 + Math.random() * 1.0 : 1.2 + Math.random() * 2.8;
        this.chooseRoamTarget(game);
      }

      if (this.roamTarget) {
        if (this.botState !== 'turning-in' && this.botState !== 'hunting-mobs' && this.botState !== 'traveling-to-objective' && this.botState !== 'traveling-to-hunt' && this.botState !== 'leaving-camp-for-objective') this.botState = 'questing';
        if (this.botState === 'turning-in') this.currentActivityLabel = 'Turning In';
        else if (this.botState === 'hunting-mobs' || this.botState === 'traveling-to-hunt') this.currentActivityLabel = 'Hunting';
        else if (this.botState === 'leaving-camp-for-objective') this.currentActivityLabel = 'Leaving Camp';
        else if (this.botState === 'traveling-to-objective') this.currentActivityLabel = 'Traveling';
        else this.currentActivityLabel = this.behaviorGoal === 'road-patrol' ? 'Patrolling' : 'Questing';
        const desiredRange = objective?.enemyId ? 1.55 : (shouldLeaveCamp ? 0.85 : 0.70);
        const moveDt = Math.min(Math.max(Number(dt) || 0, 0), 1 / 30);
        if (game.moveCompanionToPoint) game.moveCompanionToPoint(this, this.roamTarget.x, this.roamTarget.y, moveDt, { mode: 'bot-roam', stopRange: desiredRange, recalcMs: 740, allowPartialPath: true });
        else this.moveToward(game, this.roamTarget.x, this.roamTarget.y, moveDt, desiredRange);
      }
    }

    update(game, dt) {
      this.updateBase(dt);
      this.attackAiTimer = Math.max(0, this.attackAiTimer - dt);
      this.healAiTimer = Math.max(0, this.healAiTimer - dt);
      this.pullCooldown = Math.max(0, (this.pullCooldown || 0) - dt);
      this.supportCooldown = Math.max(0, (this.supportCooldown || 0) - dt);
      this.combatCooldown = Math.max(0, (this.combatCooldown || 0) - dt);
      if (this.isGroupedWithPlayer(game)) this.zone = game.currentZone || this.zone || 'overworld';
      else if (!this.zone) this.zone = 'overworld';
      if (!this.alive) {
        this.respawnTimer = Math.max(0, (this.respawnTimer || 8) - dt);
        this.botState = 'downed';
        if (this.respawnTimer <= 0) game.respawnBotPlayer?.(this);
        return;
      }
      if (game.actorIsMeditating?.(this)) {
        const grouped = this.isGroupedWithPlayer(game);
        const playerMoving = grouped && game.isPlayerActivelyMoving?.();
        const inCombat = game.isEntityInCombat?.(this) === true;
        if (inCombat || playerMoving) {
          game.cancelMeditation?.(this, inCombat ? 'combat' : 'party moving', { silent: true });
          game.queueBotSpeechEvent?.(this, 'stopRecoveryToFollow', { priority: 2 });
        } else {
          game.lockMeditatingActorMovement?.(this);
          this.botState = grouped ? 'party-meditating' : 'meditating';
          this.currentActivityLabel = 'Meditating';
          this.meditationIntent = this.meditationIntent || (grouped ? 'party-rest-to-full' : 'auto-rest-to-full');
          game.updateMeditationForEntity?.(this, dt, { silent: true });
          return;
        }
      }
      if (game.isBotTemporarilyBusy?.(this)) {
        this.vx = 0;
        this.vy = 0;
        this.moveBlend = 0;
        this.currentActivityLabel = this.botState === 'in-dungeon' ? 'In Dungeon' : 'Busy';
        // Busy bots do not passively regenerate; recovery is meditation/heal driven.
        return;
      }
      // No passive bot HP/MP regeneration. restIfNeeded() starts meditation when safe;
      // spells, potions, and explicit healing effects remain valid recovery sources.
      const actorSchedule = game.resolveBotActorSchedule?.(this, dt) || { run: true, reason: 'unscheduled' };
      if (!actorSchedule.run) {
        this.lastActorAiSkipReason = actorSchedule.reason || 'scheduled-idle';
        if (this.isGroupedWithPlayer(game) && game.isPlayerActivelyMoving?.()) {
          if (game.actorIsMeditating?.(this)) {
            game.cancelMeditation?.(this, 'party moving', { silent: true });
            game.queueBotSpeechEvent?.(this, 'stopRecoveryToFollow', { priority: 2 });
          }
          this.followParty(game, dt);
        }
        return;
      }
      this.lastActorAiSkipReason = '';
      game.markBotActorAiTick?.(this, actorSchedule);
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (game.updateBotAI?.(this, nowMs, dt)) return;

      // Legacy fallback stays owned by BotPlayer for older saves or stripped builds,
      // but current builds route through updateBotAI() for class-specific profiles.
      if (this.isGroupedWithPlayer(game) && game.isPlayerActivelyMoving?.()) {
        if (game.actorIsMeditating?.(this)) {
          game.cancelMeditation?.(this, 'party moving', { silent: true });
          game.queueBotSpeechEvent?.(this, 'stopRecoveryToFollow', { priority: 2 });
        }
        if (this.followParty(game, dt)) return;
      }
      if (this.updateHealer(game, dt)) return;
      if (this.restIfNeeded(game, dt)) return;
      const target = this.selectTarget(game);
      if (target && this.updateCombat(game, target, dt)) return;
      if (this.followParty(game, dt)) return;
      this.updateRoam(game, dt);
    }
  }

  DR.entities.BotPlayer = BotPlayer;
  DR.BotPlayer = BotPlayer;
})();
