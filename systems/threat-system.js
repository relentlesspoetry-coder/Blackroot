// Dream Realms threat and aggro runtime system.
// V0.12.42 owns per-enemy threat tables, taunts, healing threat, threat decay, and target selection.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const dist = DR.utils?.dist || ((a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0)));

  const THREAT_SAVE_VERSION = 1;

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function alive(entity) {
    return Boolean(entity && entity.alive !== false && Number.isFinite(Number(entity.x)) && Number.isFinite(Number(entity.y)));
  }

  function isAlly(entity) {
    return ['player', 'merc', 'pet', 'bot', 'remote'].includes(String(entity?.kind || ''));
  }

  function isEnemy(entity) {
    return String(entity?.kind || '') === 'enemy';
  }

  function threatCacheStamp(game) {
    return Number(game?._perfFrameId || game?._threatCacheStamp || 0);
  }

  function rebuildThreatActorCache(game) {
    const allies = [];
    const enemies = [];
    const actorById = new Map();
    const seen = new Set();
    const addActor = actor => {
      if (!alive(actor)) return;
      const key = String(actor?.id ?? actor?.botId ?? actor?.remoteId ?? '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      allies.push(actor);
      actorById.set(String(actor.id), actor);
    };
    addActor(game?.player);
    addActor(game?.merc);
    addActor(game?.pet);
    for (const bot of game?.botPlayers || []) {
      addActor(bot);
      addActor(bot?.botPet);
    }
    for (const entity of game?.entities || []) if (isAlly(entity)) addActor(entity);
    if (game?.remotePlayers instanceof Map) for (const actor of game.remotePlayers.values()) addActor(actor);
    for (const enemy of game?.enemies || []) {
      if (!alive(enemy)) continue;
      enemies.push(enemy);
      if (enemy.id != null) actorById.set(String(enemy.id), enemy);
    }
    return { stamp: threatCacheStamp(game), allies, enemies, actorById };
  }

  function threatRuntimeCache(game) {
    if (!game) return { stamp: -1, allies: [], enemies: [], actorById: new Map() };
    const stamp = threatCacheStamp(game);
    if (!game._threatRuntimeCache || game._threatRuntimeCache.stamp !== stamp) {
      game._threatRuntimeCache = rebuildThreatActorCache(game);
    }
    return game._threatRuntimeCache;
  }

  function allAllies(game) {
    return threatRuntimeCache(game).allies;
  }

  function allEnemies(game) {
    return threatRuntimeCache(game).enemies;
  }

  function threatTable(enemy) {
    if (!enemy.threatTable || typeof enemy.threatTable !== 'object' || Array.isArray(enemy.threatTable)) enemy.threatTable = {};
    return enemy.threatTable;
  }

  function hasThreatEntries(table) {
    if (!table) return false;
    for (const id in table) {
      if (safeNumber(table[id]?.threat, 0) > 0.05) return true;
    }
    return false;
  }

  function entryFor(enemy, actor) {
    const table = threatTable(enemy);
    const key = String(actor.id);
    if (!table[key]) {
      table[key] = {
        version: THREAT_SAVE_VERSION,
        actorId: actor.id,
        actorKind: actor.kind || 'entity',
        actorName: actor.name || 'Unknown',
        threat: 0,
        lastThreatAt: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())
      };
    }
    return table[key];
  }

  function actorById(game, id) {
    if (id == null || !game) return null;
    const sid = String(id);
    const cached = threatRuntimeCache(game).actorById.get(sid);
    if (cached) return cached;
    for (const actor of game?.entities || []) if (String(actor?.id) === sid) return actor;
    for (const enemy of game?.enemies || []) if (String(enemy?.id) === sid) return enemy;
    return null;
  }

  function withinLeash(enemy, actor) {
    if (!alive(enemy) || !alive(actor)) return false;
    const leash = Math.max(4, safeNumber(enemy.baseType?.leashRadius || enemy.leashRadius, 14)) + 2.0;
    const dx = (actor.x || 0) - (enemy.homeX ?? enemy.x);
    const dy = (actor.y || 0) - (enemy.homeY ?? enemy.y);
    return dx * dx + dy * dy <= leash * leash;
  }

  function proximityThreat(enemy, actor) {
    const aggroRadius = Math.max(1, safeNumber(enemy.baseType?.aggroRadius || enemy.aggroRadius, 9));
    const d = dist(enemy, actor);
    if (d > aggroRadius) return 0;
    const woundedBonus = enemy.hp < enemy.maxHp ? 6 : 0;
    const actorCombatBonus = (actor.combatCooldown || 0) > 0 ? 4 : 0;
    return Math.max(0, 2 + (aggroRadius - d) * 1.2 + woundedBonus + actorCombatBonus);
  }

  DR.Threat = {
    THREAT_SAVE_VERSION,

    add(enemy, actor, amount, options = {}) {
      if (!isEnemy(enemy) || !alive(enemy) || !isAlly(actor) || !alive(actor)) return 0;
      const value = Math.max(0, safeNumber(amount, 0));
      if (value <= 0) return 0;
      const entry = entryFor(enemy, actor);
      const scalar = safeNumber(options.scalar, 1);
      const bonus = safeNumber(options.flatBonus, 0);
      entry.threat = Math.max(0, safeNumber(entry.threat, 0) + value * scalar + bonus);
      entry.actorKind = actor.kind || entry.actorKind;
      entry.actorName = actor.name || entry.actorName;
      entry.lastThreatAt = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
      if (options.taunt) {
        enemy.forcedTargetId = actor.id;
        enemy.forcedTargetTimer = Math.max(enemy.forcedTargetTimer || 0, safeNumber(options.tauntDuration, 3.0));
        entry.threat = Math.max(entry.threat, this.highestThreatValue(enemy) + safeNumber(options.tauntBonus, 35));
      }
      enemy.aggro = true;
      enemy.combatCooldown = Math.max(enemy.combatCooldown || 0, safeNumber(options.combatSeconds, 6));
      actor.combatCooldown = Math.max(actor.combatCooldown || 0, safeNumber(options.actorCombatSeconds, 4));
      return entry.threat;
    },

    highestThreatValue(enemy) {
      let highest = 0;
      const table = threatTable(enemy);
      for (const id in table) highest = Math.max(highest, safeNumber(table[id]?.threat, 0));
      return highest;
    },

    addHealing(game, healer, healedAmount) {
      if (!alive(healer) || !isAlly(healer)) return 0;
      const amount = Math.max(0, safeNumber(healedAmount, 0));
      if (amount <= 0) return 0;
      let applied = 0;
      for (const enemy of allEnemies(game)) {
        const table = threatTable(enemy);
        const hasThreat = hasThreatEntries(table);
        const nearby = dist(enemy, healer) <= Math.max(8, safeNumber(enemy.baseType?.aggroRadius || enemy.aggroRadius, 9) + 3);
        const hostile = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0;
        if (!hostile && !hasThreat && !nearby) continue;
        if (!withinLeash(enemy, healer)) continue;
        this.add(enemy, healer, Math.max(1, amount * 0.55), { reason: 'healing', actorCombatSeconds: 3.5, combatSeconds: 5.5 });
        applied++;
      }
      return applied;
    },

    pickTarget(game, enemy) {
      if (!alive(enemy)) return null;
      const allies = allAllies(game);
      if (!allies.length) return null;
      const silkGate = DR.SilkWebEncounterGate;
      const silkBossGate = silkGate?.isBossLike?.(enemy) ? silkGate : null;
      const canBossAcquire = actor => !silkBossGate || silkBossGate.canAcquireTarget?.(game, enemy, actor, { source: 'threat-pick' }) !== false;

      if (enemy.forcedTargetId != null && safeNumber(enemy.forcedTargetTimer, 0) > 0) {
        const forced = actorById(game, enemy.forcedTargetId);
        if (alive(forced) && withinLeash(enemy, forced) && canBossAcquire(forced)) return forced;
        if (silkBossGate) {
          enemy.forcedTargetId = null;
          enemy.forcedTargetTimer = 0;
        }
      }

      const table = threatTable(enemy);
      let best = null;
      let bestScore = -Infinity;
      let hasStoredThreat = false;
      for (const id in table) {
        const entry = table[id];
        const storedThreat = safeNumber(entry?.threat, 0);
        if (storedThreat <= 0.05) { delete table[id]; continue; }
        hasStoredThreat = true;
        const actor = actorById(game, entry?.actorId ?? id);
        if (!alive(actor) || !withinLeash(enemy, actor) || !canBossAcquire(actor)) { delete table[id]; continue; }
        const d = dist(enemy, actor);
        const score = storedThreat - Math.max(0, d - 1.5) * 0.12;
        if (score > bestScore) {
          best = actor;
          bestScore = score;
        }
      }
      if (best && bestScore > 0.05) return best;
      if (hasStoredThreat) return null;

      // Proximity aggro is only used when no actor has generated stored threat.
      // It must never replace a real bot/pet threat table with a player fallback.
      for (const actor of allies) {
        if (!withinLeash(enemy, actor) || !canBossAcquire(actor)) continue;
        const proximity = proximityThreat(enemy, actor);
        if (proximity <= 0) continue;
        const d = dist(enemy, actor);
        const score = proximity - Math.max(0, d - 1.5) * 0.12;
        if (score > bestScore) {
          best = actor;
          bestScore = score;
        }
      }
      return bestScore > 0 ? best : null;
    },

    decay(game, dt) {
      const safeDt = Math.max(0, Math.min(0.5, safeNumber(dt, 0)));
      if (safeDt <= 0) return;
      for (const enemy of allEnemies(game)) {
        if (enemy.forcedTargetTimer > 0) {
          enemy.forcedTargetTimer = Math.max(0, enemy.forcedTargetTimer - safeDt);
          if (enemy.forcedTargetTimer <= 0) enemy.forcedTargetId = null;
        }
        const table = threatTable(enemy);
        const target = this.pickTarget(game, enemy);
        const active = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0 || Boolean(target);
        const decayRate = active ? 0.18 : 2.5;
        let remainingThreat = false;
        for (const id in table) {
          const entry = table[id];
          const actor = actorById(game, id);
          if (!alive(actor) || !withinLeash(enemy, actor)) {
            entry.threat = Math.max(0, safeNumber(entry.threat, 0) - safeDt * 16);
          } else {
            entry.threat = Math.max(0, safeNumber(entry.threat, 0) - safeDt * decayRate);
          }
          if (entry.threat <= 0.05) delete table[id];
          else remainingThreat = true;
        }
        if (!remainingThreat && enemy.hp >= enemy.maxHp && (enemy.combatCooldown || 0) <= 0) enemy.aggro = false;
      }
    },

    clearEntity(game, actor) {
      if (!actor) return;
      for (const enemy of allEnemies(game)) {
        const table = threatTable(enemy);
        delete table[String(actor.id)];
        if (enemy.forcedTargetId === actor.id) {
          enemy.forcedTargetId = null;
          enemy.forcedTargetTimer = 0;
        }
      }
    },

    reset(enemy) {
      if (!enemy) return;
      enemy.threatTable = {};
      enemy.forcedTargetId = null;
      enemy.forcedTargetTimer = 0;
      enemy.aggro = false;
    },

    leader(enemy, game) {
      const target = this.pickTarget(game, enemy);
      if (!target) return null;
      const threat = safeNumber(threatTable(enemy)[String(target.id)]?.threat, 0);
      return { target, threat };
    },

    relativeThreat(game, enemy, actor) {
      if (!alive(enemy) || !alive(actor) || !isEnemy(enemy)) {
        return { threat: 0, highest: 0, percent: 0, rank: 0, isPrimary: false, hasThreat: false };
      }
      const table = threatTable(enemy);
      const rows = [];
      for (const id in table) {
        const entry = table[id];
        const threat = safeNumber(entry?.threat, 0);
        if (threat <= 0.05) continue;
        const rowActor = actorById(game, entry?.actorId ?? id);
        if (!alive(rowActor) || !withinLeash(enemy, rowActor)) continue;
        rows.push({ id: String(entry?.actorId ?? id), actor: rowActor, threat });
      }
      rows.sort((a, b) => b.threat - a.threat);
      const highest = rows.length ? rows[0].threat : 0;
      const playerId = String(actor.id);
      const index = rows.findIndex(row => String(row.id) === playerId || row.actor === actor);
      const threat = index >= 0 ? rows[index].threat : 0;
      const percent = highest > 0 ? Math.max(0, Math.min(1, threat / highest)) : 0;
      return {
        threat,
        highest,
        percent,
        rank: index >= 0 ? index + 1 : 0,
        isPrimary: index === 0 && threat > 0.05,
        hasThreat: rows.length > 0,
        targetName: rows[0]?.actor?.name || ''
      };
    },

    serializeEnemy(enemy) {
      if (!enemy || !enemy.threatTable) return null;
      const entries = Object.values(enemy.threatTable)
        .filter(entry => safeNumber(entry.threat, 0) > 0.05)
        .map(entry => ({
          version: THREAT_SAVE_VERSION,
          actorId: entry.actorId,
          actorKind: entry.actorKind,
          actorName: entry.actorName,
          threat: Math.round(safeNumber(entry.threat, 0) * 100) / 100
        }));
      return entries.length ? { version: THREAT_SAVE_VERSION, entries } : null;
    }
  };

  DR.ThreatSystem = {
    install(Game) {
      Game.prototype.addThreat = function(enemy, actor, amount, options = {}) {
        // V0.17.69 Talents: player-only threat multiplier (Provoking Presence,
        // Unbreakable Oath). Applied at the single choke point so spell threat,
        // auto-attack threat, and healing-derived threat all scale uniformly.
        if (actor === this.player && this.talentThreatMultiplier) amount *= this.talentThreatMultiplier();
        return DR.Threat.add(enemy, actor, amount, options);
      };

      Game.prototype.addHealingThreat = function(healer, healedAmount) {
        return DR.Threat.addHealing(this, healer, healedAmount);
      };

      // Phase 3 (Combat/Spell Parity): target validator + status contract
      // for taunt, matching the same hostile/alive/stun checks now shared
      // by spell casts (systems/combat-system.js resolveHostileSpellTarget,
      // systems/status-effect-system.js isActionLocked) instead of calling
      // straight into DR.Threat.add with no validation. tauntEnemy has no
      // current callers in the codebase, so this only hardens the contract
      // before a future ability/AI hook becomes its first caller - it does
      // not change any existing behavior. 'taunt_immune' is a new status
      // tag (Intersect-style boss taunt immunity); no shipped status uses
      // it yet, so that branch is inert today too.
      Game.prototype.tauntEnemy = function(enemy, actor = this.player, duration = 3.0, bonus = 45) {
        if (!enemy || !enemy.alive || !this.isHostileTarget?.(enemy)) return false;
        if (actor && this.isActionLocked?.(actor)) return false;
        if (this.hasStatusTag?.(enemy, 'taunt_immune')) {
          if (actor === this.player) this.logCombat?.(`${enemy.name || 'Target'} cannot be taunted.`);
          return false;
        }
        return DR.Threat.add(enemy, actor, bonus, { reason: 'taunt', taunt: true, tauntDuration: duration, tauntBonus: bonus });
      };

      Game.prototype.updateThreatRuntime = function(dt) {
        this._threatCacheStamp = this._perfFrameId || ((this._threatCacheStamp || 0) + 1);
        this._threatRuntimeCache = null;
        DR.Threat.decay(this, dt);
      };

      Game.prototype.getThreatTarget = function(enemy) {
        return DR.Threat.pickTarget(this, enemy);
      };

      Game.prototype.describeThreatLeader = function(enemy) {
        const leader = DR.Threat.leader(enemy, this);
        if (!leader?.target) return '';
        const value = leader.threat > 0 ? ` · Threat: ${leader.target.name} ${Math.round(leader.threat)}` : ` · Threat: ${leader.target.name}`;
        return value;
      };

      Game.prototype.getPlayerThreatInfoForEnemy = function(enemy, actor = this.player) {
        return DR.Threat.relativeThreat(this, enemy, actor);
      };

      Game.prototype.clearThreatForEntity = function(actor) {
        return DR.Threat.clearEntity(this, actor);
      };

      Game.prototype.resetThreatForEnemy = function(enemy) {
        return DR.Threat.reset(enemy);
      };
    }
  };
})();
