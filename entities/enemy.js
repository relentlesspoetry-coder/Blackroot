(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};
  const { Entity } = DR.entities;
  const { dist } = DR.utils;
  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function hasThreatEntries(table) {
    if (!table || typeof table !== 'object') return false;
    for (const id in table) {
      const entry = table[id];
      const value = typeof entry === 'number' ? entry : Number(entry?.threat || 0);
      if (value > 0.05) return true;
    }
    return false;
  }

  function cachedRoamingGroup(game, groupId) {
    if (!game || !groupId) return [];
    const stamp = Number(game._perfFrameId || 0);
    if (!game._enemyRoamingGroupCache || game._enemyRoamingGroupCache.stamp !== stamp) {
      game._enemyRoamingGroupCache = { stamp, groups: new Map() };
    }
    const cache = game._enemyRoamingGroupCache.groups;
    if (cache.has(groupId)) return cache.get(groupId);
    const group = [];
    for (const enemy of game.enemies || []) {
      if (enemy && enemy.alive && enemy.roamingGroupId === groupId) group.push(enemy);
    }
    group.sort((a, b) => Number(a.spawnSlotId || 0) - Number(b.spawnSlotId || 0));
    cache.set(groupId, group);
    return group;
  }
  const DEFAULT_NEAR_AI_RADIUS_TILES = 20;
  const DEFAULT_MID_AI_RADIUS_TILES = 45;
  const DEFAULT_FAR_AI_RADIUS_TILES = 80;
  const PREVIOUS_GLOBAL_MOB_HEALTH_MULTIPLIER = 2.0;
  const PREVIOUS_GLOBAL_MOB_DAMAGE_MULTIPLIER = 1.2;
  const STANDARD_MOB_HEALTH_BUFF_MULTIPLIER = 1.18;
  const STANDARD_MOB_DAMAGE_BUFF_MULTIPLIER = 1.12;
  const ELITE_RARE_DAMAGE_EXTRA_MULTIPLIER = 1.30;
  const GLOBAL_MOB_HEALTH_MULTIPLIER = PREVIOUS_GLOBAL_MOB_HEALTH_MULTIPLIER * STANDARD_MOB_HEALTH_BUFF_MULTIPLIER;
  const GLOBAL_MOB_DAMAGE_MULTIPLIER = PREVIOUS_GLOBAL_MOB_DAMAGE_MULTIPLIER * STANDARD_MOB_DAMAGE_BUFF_MULTIPLIER;

  function isEliteRareMobType(type = {}) {
    const flags = [type.elite, type.named, type.rare, type.rareNameplate, type.boss, type.champion, type.unique];
    if (flags.some(Boolean)) return true;
    const text = `${type.aiProfile || ''} ${type.zoneRole || ''} ${type.threatTag || ''} ${type.encounterKind || ''}`.toLowerCase();
    return /elite|rare|named|boss|champion|unique/.test(text);
  }

  function enemyTierDamageMultiplier(type = {}) {
    return isEliteRareMobType(type) ? ELITE_RARE_DAMAGE_EXTRA_MULTIPLIER : 1;
  }

  function scaleEnemyAbilityDamage(enemy, rawDamage) {
    const base = Math.max(0, Number(rawDamage) || 0);
    const standard = STANDARD_MOB_DAMAGE_BUFF_MULTIPLIER;
    const tier = isEliteRareMobType(enemy?.baseType || enemy || {}) ? ELITE_RARE_DAMAGE_EXTRA_MULTIPLIER : 1;
    // V0.20.34: boss soft-enrage + phase damage escalation (1 for everything that isn't an escalating boss).
    const enrage = Math.max(1, Number(enemy?._bossDamageMult) || 1);
    return Math.max(1, Math.floor(base * standard * tier * enrage));
  }

  // V0.20.34 (Roadmap Item 19): a boss/miniboss/named enemy that runs the enrage + phase escalation.
  function isBossEnemy(enemy = {}) {
    const type = enemy.baseType || enemy || {};
    if (enemy.dungeonBoss || enemy.dungeonMiniBoss || type.dungeonBoss || type.dungeonMiniBoss) return true;
    if (enemy.boss || type.boss || enemy.named || type.named) return true;
    return /boss/.test(String(enemy.rank || type.rank || '').toLowerCase());
  }
  DR.isBossEnemy = isBossEnemy;


  function isAshrootHorrorEnemy(enemy = {}) {
    const type = enemy.baseType || enemy;
    const text = `${enemy.name || ''} ${type.name || ''} ${type.mobVisualKey || ''} ${type.visualKey || ''} ${type.aiProfile || ''} ${type.threatTag || ''} ${type.family || ''}`.toLowerCase();
    return text.includes('ashroot') || text.includes('ash root') || text.includes('elite root') || text.includes('burned tree');
  }

  function ashrootHostileTargets(game, center, radius) {
    const list = [];
    const add = actor => {
      if (!actor || actor.alive === false || !Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) return;
      if (Math.hypot(Number(actor.x) - Number(center.x), Number(actor.y) - Number(center.y)) <= radius) list.push(actor);
    };
    add(game?.player);
    add(game?.merc);
    add(game?.pet);
    for (const bot of game?.botPlayers || []) {
      add(bot);
      add(bot?.botPet);
    }
    for (const actor of game?.entities || []) {
      const kind = String(actor?.kind || '').toLowerCase();
      if (kind === 'bot' || kind === 'merc' || kind === 'pet') add(actor);
    }
    return list.filter((actor, index, arr) => actor && arr.indexOf(actor) === index);
  }

  DR.MOB_BALANCE = Object.freeze({
    ...(DR.MOB_BALANCE || {}),
    previousHealthMultiplier: PREVIOUS_GLOBAL_MOB_HEALTH_MULTIPLIER,
    previousDamageMultiplier: PREVIOUS_GLOBAL_MOB_DAMAGE_MULTIPLIER,
    standardHealthBuffMultiplier: STANDARD_MOB_HEALTH_BUFF_MULTIPLIER,
    standardDamageBuffMultiplier: STANDARD_MOB_DAMAGE_BUFF_MULTIPLIER,
    eliteRareDamageExtraMultiplier: ELITE_RARE_DAMAGE_EXTRA_MULTIPLIER,
    healthMultiplier: GLOBAL_MOB_HEALTH_MULTIPLIER,
    damageMultiplier: GLOBAL_MOB_DAMAGE_MULTIPLIER,
    standardDamageCapMultiplier: 1.08,
    eliteRareDamageCapMultiplier: 1.24,
    version: 'v0.14.81'
  });
  DR.scaleEnemyAbilityDamage = scaleEnemyAbilityDamage;
  DR.isEliteRareMobType = isEliteRareMobType;

class Enemy extends Entity {
    constructor(type, x, y, level) {
      const scale = 1 + (level - 1) * 0.18;
      const eliteRare = isEliteRareMobType(type);
      const healthPaceMultiplier = eliteRare ? 2.85 : 2.45;
      const balancedHp = Math.max(1, Math.floor(type.hp * scale * healthPaceMultiplier * GLOBAL_MOB_HEALTH_MULTIPLIER));
      const balancedAttack = Math.max(1, Math.floor(type.attack * scale * GLOBAL_MOB_DAMAGE_MULTIPLIER * enemyTierDamageMultiplier(type)));
      // V0.17.99: ranged casters (wisps / ranged_caster profiles) engage from range and
      // kite instead of walking into melee. Detected from data tags; range widened so the
      // existing chase/attack distance logic naturally keeps them at casting distance.
      const rangedProfileText = `${type.aiProfile || ''} ${type.animationProfile || ''} ${type.rendererId || ''} ${type.mobVisualKey || ''}`.toLowerCase();
      const isRangedAttacker = /ranged|floatingcaster/.test(rangedProfileText);
      super(type.name, x, y, {
        hp: balancedHp,
        mana: 0,
        attack: balancedAttack,
        defense: Math.floor(type.defense * scale),
        speed: type.speed,
        color: type.color,
        range: isRangedAttacker ? 6.5 : 1.35,
        level,
        kind: 'enemy'
      });
      this.isRangedAttacker = isRangedAttacker;
      this.rangedKiteRange = 3.2;
      this.rangedAttackColor = type.color || '#9fd8ff';
      this.baseType = type;
      this.elite = Boolean(type.elite);
      this.named = Boolean(type.named);
      this.rare = Boolean(type.rare || type.rareNameplate);
      this.rareNameplate = Boolean(type.rareNameplate);
      this.boss = Boolean(type.boss);
      this.mobBalanceTier = eliteRare ? (this.boss ? 'boss' : this.elite ? 'elite' : this.named ? 'named' : 'rare') : 'standard';
      this.mobBalanceMultipliers = {
        health: GLOBAL_MOB_HEALTH_MULTIPLIER,
        damage: GLOBAL_MOB_DAMAGE_MULTIPLIER,
        tierDamage: enemyTierDamageMultiplier(type)
      };
      this.rendererId = type.rendererId || null;
      this.mobVisualKey = type.mobVisualKey || type.visualKey || null;
      this.visualScale = Number.isFinite(Number(type.visualScale)) ? Number(type.visualScale) : 1;
      this.animationProfile = type.animationProfile || null;
      this.family = type.family || null;
      this.homeX = x;
      this.homeY = y;
      this.aggro = false;
      this.respawnTimer = 0;
      this.patrolTarget = null;
      this.patrolWait = 0.8 + Math.random() * 2.2;
      this.patrolRadius = type.patrolRadius || (type.caveEnemy ? 4.5 : 7.5);
      this.aiStuckTimer = 0;
      this.lastAiX = this.x;
      this.lastAiY = this.y;
      this.tacticalCooldown = 0.8 + Math.random() * 1.6;
      this.spiderWebCooldown = 8 + Math.random() * 4;
      this.spiderWebCastAnim = 0;
      this.callHelpCooldown = 0.4 + Math.random() * 2.0;
      this.fleeCooldown = 0;
      this.lastTacticalLabel = '';
    }

    familyKey() {
      return String(this.baseType?.family || this.baseType?.id || this.baseType?.name || this.name || 'enemy').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }

    sameEncounterAs(other) {
      if (!other) return false;
      if (this.encounterId && other.encounterId) return this.encounterId === other.encounterId;
      if (this.spawnKey && other.spawnKey) return this.spawnKey === other.spawnKey;
      return false;
    }

    shouldAssistAlly(ally) {
      if (!ally || ally === this || !ally.alive || ally.aggro) return false;
      if (typeof ally.familyKey === 'function' && ally.familyKey() !== this.familyKey()) return false;
      const sameEncounter = this.sameEncounterAs(ally);
      const eliteCommander = Boolean(this.elite || this.baseType?.elite || this.baseType?.named);
      if (!sameEncounter && !eliteCommander) return false;
      if (!sameEncounter && eliteCommander && dist(this, ally) > 3.75) return false;
      if (Number(ally._assistLockedUntil || 0) > Date.now()) return false;
      return true;
    }

    callNearbyAllies(game, target) {
      this.callHelpCooldown = Math.max(0, Number(this.callHelpCooldown || 0));
      if (this.callHelpCooldown > 0 || !target?.alive) return false;
      this.callHelpCooldown = (this.elite || this.baseType?.elite ? 3.0 : 5.0) + Math.random() * 1.8;
      const radius = Math.max(2.6, Number(this.assistRadius || this.baseType?.assistRadius || (this.elite || this.baseType?.elite ? 4.8 : 3.8)));
      const cap = this.elite || this.baseType?.elite ? 3 : 1;
      let called = 0;
      const radiusSq = radius * radius;
      const candidates = [];
      for (const ally of (game.queryEnemiesNearEntity?.(this, radius + 1) || game.enemies || [])) {
        if (!this.shouldAssistAlly(ally)) continue;
        const dx = this.x - ally.x;
        const dy = this.y - ally.y;
        const dSq = dx * dx + dy * dy;
        if (dSq <= radiusSq) candidates.push({ ally, dSq });
      }
      candidates.sort((a, b) => a.dSq - b.dSq);
      for (const { ally } of candidates) {
        const allyHome = dist(ally, { x: ally.homeX, y: ally.homeY });
        const leash = Number(ally.baseType?.leashRadius) || 14;
        if (allyHome > leash - 2) continue;
        ally.aggro = true;
        ally.patrolTarget = null;
        ally.assistSourceId = this.id;
        ally._assistLockedUntil = Date.now() + 2500;
        game.addThreat?.(ally, target, 10, { reason: 'encounter-assist', actorCombatSeconds: 3.0, combatSeconds: 3.5 });
        called += 1;
        if (called >= cap) break;
      }
      if (called > 0) {
        this.lastTacticalLabel = 'called allies';
        game.spawnCastCue?.(this, '#d9a35f', 'Call');
      }
      return called > 0;
    }


    effectiveAggroRadius(game, target = null) {
      const type = this.baseType || {};
      const profile = String(type.aiProfile || '').toLowerCase();
      let radius = Number(type.aggroRadius);
      if (!Number.isFinite(radius) || radius <= 0) {
        radius = type.caveEnemy ? 4.8 : 5.6;
        if (profile.includes('sentry') || profile.includes('caster')) radius += 0.8;
        if (profile.includes('swarm')) radius -= 0.6;
      }
      radius += Math.min(0.9, Math.max(0, (Number(this.level || 1) - 1) * 0.08));
      if (this.elite || type.elite || type.named) radius += 1.0;
      if (game?.currentZone === 'cave' || game?.currentZone === 'dungeon') radius -= 0.45;
      return Math.max(3.2, Math.min(this.elite || type.elite ? 7.8 : 6.6, radius));
    }

    handlePathingFailure(game, target, dt) {
      this.aiPathFailCount = Math.min(8, Math.floor(Number(this.aiPathFailCount || 0)) + 1);
      this._pathRepath = 0;
      this._pathRoute = [];
      const home = { x: Number(this.homeX || this.x), y: Number(this.homeY || this.y) };
      if (this.aiPathFailCount >= 4 || !target?.alive) {
        this.aggro = false;
        this.patrolTarget = home;
        game?.resetThreatForEnemy?.(this);
        return this.moveToward(game, home.x, home.y, dt, 0.55);
      }
      const awayX = this.x - (target?.x ?? home.x);
      const awayY = this.y - (target?.y ?? home.y);
      const len = Math.hypot(awayX, awayY) || 1;
      const candidates = [
        { x: this.x + awayX / len * 0.85, y: this.y + awayY / len * 0.85 },
        { x: this.x - awayY / len * 0.85, y: this.y + awayX / len * 0.85 },
        { x: this.x + awayY / len * 0.85, y: this.y - awayX / len * 0.85 },
        home
      ];
      for (const c of candidates) {
        if (game?.isWalkable?.(c.x, c.y, this) && game?.tryMove?.(this, c.x, c.y)) return true;
      }
      return false;
    }

    targetHasStatus(target, statusId, minRemaining = 1.0) {
      if (!target || !Array.isArray(target.buffs)) return false;
      return target.buffs.some(effect => effect && effect.id === statusId && Number(effect.remaining || 0) > minRemaining);
    }


    tryAshrootHorrorAbility(game, target, d) {
      if (!game || !target?.alive || !this.aggro || !isAshrootHorrorEnemy(this)) return false;
      const level = Number(this.level || 1);
      const attack = Math.max(1, Number(this.getStat?.('attack') || this.attack || 8));
      const scaled = amount => scaleEnemyAbilityDamage(this, amount);

      const cast = (name, effectTarget = target, options = {}) => {
        game.spawnAshrootSpellEffect?.(name, this, effectTarget, options);
        game.spawnCastCue?.(this, options.color || '#d46a2f', name.replace(/Ashroot |Ashen |Cinderroot |Blightwood /g, '').slice(0, 12));
      };

      // V0.20.32 (Roadmap Item 19): the Ashroot miniboss's ground-AoE string abilities telegraph now
      // too, closing the follow-up left by V0.20.31 - a danger marker sized to the blast appears, then
      // the strike (damage and/or status, snapshotted at cast) lands AOE_TELEGRAPH_DELAY later via the
      // shared enemy_aoe pending-impact queue. Same reaction window as the data-driven abilities.
      const AOE_TELEGRAPH_DELAY = 0.5;
      const telegraphAoe = (cx, cy, radius, dmg, status, color, damageType = 'magic') => {
        const ringPx = radius * 26;
        game.addEffect?.({ type: 'bossGroundTelegraph', x: cx, y: cy, x2: cx, y2: cy, t: 0, life: AOE_TELEGRAPH_DELAY + 0.06, color, color2: '#ffd24a', radius: ringPx / 5.8, seed: ((Math.floor(cx * 73856) ^ Math.floor(cy * 19349)) >>> 0) || 1 });
        if (Number(dmg) > 0) game.queuePendingSpellImpact?.({ kind: 'enemy_aoe', delay: AOE_TELEGRAPH_DELAY, center: { x: cx, y: cy }, radius, damage: Math.round(dmg), source: this, color, aoeOptions: status ? { status, damageType } : { damageType } });
        else if (status) game.queuePendingSpellImpact?.({ kind: 'enemy_aoe', delay: AOE_TELEGRAPH_DELAY, center: { x: cx, y: cy }, radius, source: this, color, status });
      };

      const hpRatio = this.hp / Math.max(1, this.maxHp || 1);
      if (hpRatio <= 0.48 && !this.targetHasStatus(this, 'ashen_regrowth', 2.0)) {
        cast('Ashen Regrowth', this, { duration: 7.0, color: '#ff8a32' });
        const heal = Math.max(12, Math.floor((this.maxHp || 1) * 0.10 + level * 3.2));
        game.healEntity?.(this, heal, true, this);
        game.applyStatusEffect?.(this, {
          id: 'ashen_regrowth',
          name: 'Ashen Regrowth',
          type: 'buff',
          duration: 7.0,
          mods: { defense: Math.max(2, Math.floor(level * 0.7)) },
          color: '#ff8a32',
          hostile: false,
          maxStacks: 1,
          tags: ['heal-over-time', 'defense', 'ashroot']
        }, this);
        this.tacticalCooldown = 12.5 + Math.random() * 2.2;
        return true;
      }

      const rotation = Array.isArray(this._ashrootAbilityRotation) && this._ashrootAbilityRotation.length
        ? this._ashrootAbilityRotation
        : (this._ashrootAbilityRotation = ['cinderroot_snare', 'ash_cloud', 'death_bloom', 'blightwood_pulse', 'ashroot_crush']);
      const start = Math.floor(Number(this._ashrootAbilityIndex || 0)) % rotation.length;

      for (let pass = 0; pass < rotation.length; pass++) {
        const ability = rotation[(start + pass) % rotation.length];

        if (ability === 'ashroot_crush' && d <= 2.15 + 0.45) {
          cast('Ashroot Crush', target, { color: '#d46a2f' });
          game.playAttackAnimation?.(this, target, '#d46a2f', 'crush');
          game.damageEntity?.(target, scaled(Math.floor(attack * 0.74 + level * 1.6)), this, '#d46a2f', { damageType: 'physical', canCrit: false });
          game.spawnCombatImpact?.(target, '#ff7a2d', 1.4, 'enemy');
          this._ashrootAbilityIndex = start + pass + 1;
          this.tacticalCooldown = 4.8 + Math.random() * 1.2;
          return true;
        }

        if (ability === 'cinderroot_snare' && d <= 5.5 && !this.targetHasStatus(target, 'cinderroot_snare', 1.6)) {
          cast('Cinderroot Snare', target, { duration: 5.2, color: '#f06c2d' });
          game.applyStatusEffect?.(target, {
            id: 'cinderroot_snare',
            name: 'Cinderroot Snare',
            type: 'control',
            duration: 5.2,
            tickRate: 1.7,
            periodicDamage: scaled(Math.max(2, Math.floor(level * 1.05))),
            mods: { speed: -2.0 },
            tags: ['root', 'burn', 'dot', 'ashroot'],
            color: '#f06c2d',
            hostile: true,
            maxStacks: 1
          }, this);
          this._ashrootAbilityIndex = start + pass + 1;
          this.tacticalCooldown = 8.6 + Math.random() * 1.6;
          return true;
        }

        if (ability === 'ash_cloud' && d <= 4.8) {
          cast('Ash Cloud', target, { radius: 2.2, duration: 4.2, color: '#8d7564' });
          telegraphAoe(target.x, target.y, 2.2, scaled(Math.floor(attack * 0.34 + level * 0.75)), {
            id: 'ashen', name: 'Ashen', type: 'debuff', duration: 5.0,
            mods: { attack: -Math.max(1, Math.floor(level * 0.35)), speed: -0.35 },
            color: '#8d7564', hostile: true, maxStacks: 1, tags: ['ash', 'blind', 'debuff', 'ashroot']
          }, '#9a6e50');
          this._ashrootAbilityIndex = start + pass + 1;
          this.tacticalCooldown = 9.4 + Math.random() * 1.8;
          return true;
        }

        if (ability === 'death_bloom' && d <= 3.8) {
          cast('Death Bloom', target, { radius: 1.8, duration: 3.8, color: '#a6d66a' });
          telegraphAoe(target.x, target.y, 1.8, scaled(Math.floor(attack * 0.42 + level * 0.85)), {
            id: 'withered', name: 'Withered', type: 'debuff', duration: 5.5,
            mods: { defense: -Math.max(1, Math.floor(level * 0.45)), attack: -Math.max(1, Math.floor(level * 0.32)) },
            color: '#a6d66a', hostile: true, maxStacks: 1, tags: ['wither', 'plant-decay', 'debuff', 'ashroot']
          }, '#a6d66a');
          this._ashrootAbilityIndex = start + pass + 1;
          this.tacticalCooldown = 10.2 + Math.random() * 1.8;
          return true;
        }

        if (ability === 'blightwood_pulse' && d <= 4.5) {
          cast('Blightwood Pulse', this, { radius: 3.0, duration: 5.0, color: '#96c85a' });
          telegraphAoe(this.x, this.y, 3.0, 0, {
            id: 'blightwood_vulnerability', name: 'Blightwood Vulnerability', type: 'debuff', duration: 6.0,
            mods: { defense: -Math.max(2, Math.floor(level * 0.55)), healingMultiplier: -0.15 },
            color: '#96c85a', hostile: true, maxStacks: 1, tags: ['blight', 'defense', 'healing-reduction', 'ashroot']
          }, '#96c85a');
          this._ashrootAbilityIndex = start + pass + 1;
          this.tacticalCooldown = 11.5 + Math.random() * 2.0;
          return true;
        }
      }
      return false;
    }

    tryTacticalAbility(game, target, d) {
      this.tacticalCooldown = Math.max(0, Number(this.tacticalCooldown || 0));
      if (this.tacticalCooldown > 0 || !target?.alive || !this.aggro) return false;
      const name = String(this.baseType?.name || this.name || '').toLowerCase();
      const family = this.familyKey();
      const level = Number(this.level || 1);
      if (this.tryAshrootHorrorAbility?.(game, target, d)) return true;
      if (this.tryDataAbility?.(game, target, d)) return true;
      const eliteSpiderPoison = Boolean(this.elite || this.baseType?.elite || this.baseType?.named || this.dungeonBoss || this.dungeonMiniBoss || this.bossEnemy);
      if (eliteSpiderPoison && (family.includes('spider') || name.includes('spider') || name.includes('widow')) && d <= this.range + 0.35 && !this.targetHasStatus(target, 'venom_bite', 2.0)) {
        const elitePoison = true;
        game.applyStatusEffect?.(target, {
          id: 'venom_bite', name: elitePoison ? 'Potent Venom Bite' : 'Venom Bite', type: 'dot',
          duration: elitePoison ? 6.0 : 4.8,
          tickRate: 2.0,
          periodicDamage: scaleEnemyAbilityDamage(this, Math.max(1, Math.floor(level * (elitePoison ? 0.82 : 0.58)))),
          maxStacks: 1,
          tags: ['poison', 'dot', 'debuff'],
          cleanseType: 'poison', isCurable: true,
          color: '#8fd66d', hostile: true
        }, this);
        game.spawnCastCue?.(this, '#8fd66d', 'Venom');
        this.tacticalCooldown = 7.5 + Math.random() * 2.0;
        return true;
      }
      if ((family.includes('wolf') || name.includes('wolf')) && d <= this.range + 0.4 && !this.targetHasStatus(target, 'rending_bite', 1.6)) {
        game.applyStatusEffect?.(target, { id: 'rending_bite', name: 'Rending Bite', type: 'dot', duration: 5.0, tickRate: 1.7, periodicDamage: scaleEnemyAbilityDamage(this, Math.max(2, Math.floor(level * 1.1))), color: '#d4665a', hostile: true }, this);
        game.spawnCastCue?.(this, '#d4665a', 'Rend');
        this.tacticalCooldown = 6.8 + Math.random() * 1.8;
        return true;
      }
      if ((family.includes('root') || name.includes('root') || name.includes('rotling')) && d <= 5.5 && !this.targetHasStatus(target, 'root_snare', 1.4)) {
        game.applyStatusEffect?.(target, { id: 'root_snare', name: 'Root Snare', type: 'control', duration: 3.2, tags: ['root'], color: '#91bd68', hostile: true }, this);
        game.spawnCastCue?.(this, '#91bd68', 'Root');
        this.tacticalCooldown = 8.5 + Math.random() * 2.4;
        return true;
      }
      return false;
    }

    // V0.18.0: generic data-driven ability executor. Mobs (esp. minibosses/bosses in
    // data/enemies.js) carry object-format `abilities` [{id,name,kind,damageScale,radius,
    // cooldown,...}] that nothing consumed before - so bosses never used their kits. This
    // picks an off-cooldown, in-range ability and runs it by `kind`, tracking per-ability
    // cooldowns on the instance. Exotic movement kinds (blink/charge/lunge/retreat/
    // cocoon_prison/silk_lines/summon_adds) are skipped here (future work); damage uses the
    // mob's normal auto-attack damage x damageScale so it stays balanced.
    tryDataAbility(game, target, d) {
      const abilities = this.baseType?.abilities;
      if (!Array.isArray(abilities) || !abilities.length || !target?.alive) return false;
      const now = game.runtimeNowMs?.() || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
      const cd = this._abilityCd || (this._abilityCd = {});
      const selfKinds = new Set(['shield', 'buff', 'frenzy', 'boss_heal', 'heal']);
      for (const ab of abilities) {
        if (!ab || typeof ab !== 'object' || !ab.kind) continue; // string abilities handled elsewhere
        const id = String(ab.id || ab.name || ab.kind);
        if ((cd[id] || 0) > now) continue;
        const kind = String(ab.kind).toLowerCase();
        const reach = Number(ab.range || ab.radius || this.range) + 0.6;
        if (!selfKinds.has(kind) && d > reach) continue;
        if (this.executeDataAbility(game, target, ab, d, kind) === true) {
          cd[id] = now + Math.max(2200, Number(ab.cooldown || 5) * 1000);
          this.tacticalCooldown = 1.4 + Math.random() * 1.0; // brief gap before the next ability
          return true;
        }
      }
      return false;
    }

    executeDataAbility(game, target, ab, d, kind) {
      const color = ab.color || this.rangedAttackColor || '#d98cff';
      const radius = Math.max(1.2, Number(ab.radius || 2.6));
      const ringPx = radius * 26;
      const hit = () => Math.max(1, Math.round((game.getEnemyAutoAttackRawDamage ? game.getEnemyAutoAttackRawDamage(this, target) : this.getStat('attack')) * Number(ab.damageScale || 1)));
      const cue = label => game.spawnCastCue?.(this, color, label || ab.name || 'Cast');
      // V0.20.31 (Roadmap Item 19): ground-targeted AoE now TELEGRAPHS. A danger marker sized to the
      // real blast (bossGroundTelegraph, radius scaled so its drawn circle matches the ability ring)
      // appears at the target, then the strike lands AOE_TELEGRAPH_DELAY later via the pending-impact
      // queue - a reaction window instead of same-frame damage. Cleave (at the enemy's own body) stays
      // instant: it is a swing, not a ground effect. The AoE damage is snapshotted at cast time.
      const AOE_TELEGRAPH_DELAY = 0.5;
      const groundTelegraph = (tx, ty) => game.addEffect?.({ type: 'bossGroundTelegraph', x: tx, y: ty, x2: tx, y2: ty, t: 0, life: AOE_TELEGRAPH_DELAY + 0.06, color, color2: '#ffd24a', radius: ringPx / 5.8, seed: ((Math.floor(tx * 73856) ^ Math.floor(ty * 19349)) >>> 0) || 1 });
      switch (kind) {
        case 'aoe': case 'venom_rain': case 'silk_lines':
          groundTelegraph(target.x, target.y);
          game.queuePendingSpellImpact?.({ kind: 'enemy_aoe', delay: AOE_TELEGRAPH_DELAY, center: { x: target.x, y: target.y }, radius, damage: hit(), source: this, color });
          cue(ab.name); return true;
        case 'cleave':
          game.spawnRing?.(this.x, this.y, color, ringPx);
          game.enemyAoeDamage?.(this.x, this.y, radius, hit(), this, color);
          game.playAttackAnimation?.(this, target, color, 'claw'); cue(ab.name); return true;
        case 'poison_cloud': {
          const tick = Math.max(1, Math.floor(hit() * 0.32));
          groundTelegraph(target.x, target.y);
          game.queuePendingSpellImpact?.({ kind: 'enemy_aoe', delay: AOE_TELEGRAPH_DELAY, center: { x: target.x, y: target.y }, radius, damage: Math.max(1, Math.floor(hit() * 0.45)), source: this, color,
            aoeOptions: { status: { id: 'venom_bite', name: ab.name || 'Venom Cloud', type: 'dot', duration: 5.0, tickRate: 2.0, periodicDamage: tick, tags: ['poison', 'dot', 'debuff'], cleanseType: 'poison', isCurable: true, color, hostile: true } } });
          cue(ab.name); return true;
        }
        case 'snare':
          groundTelegraph(target.x, target.y);
          game.queuePendingSpellImpact?.({ kind: 'enemy_aoe', delay: AOE_TELEGRAPH_DELAY, center: { x: target.x, y: target.y }, radius, source: this, color, status: { id: 'root_snare', name: ab.name || 'Snare', type: 'control', duration: 2.8, tags: ['root'], color, hostile: true } });
          cue(ab.name); return true;
        case 'debuff': {
          const sid = String(ab.status || 'weaken').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          game.applyStatusEffect?.(target, { id: sid, name: ab.status || ab.name || 'Weaken', type: 'debuff', duration: 5.0, moveSpeedMultiplier: /slow|snare|chill/.test(sid) ? -0.35 : 0, tags: ['debuff'], color, hostile: true }, this);
          cue(ab.name); return true;
        }
        case 'shield':
          game.applyStatusEffect?.(this, { id: 'mob_shield', name: ab.name || 'Shield', type: 'buff', duration: Number(ab.duration || 5), damageTakenMultiplier: -0.5, tags: ['shield', 'buff'], color }, this);
          cue(ab.name); return true;
        case 'buff': case 'frenzy':
          game.applyStatusEffect?.(this, { id: 'mob_frenzy', name: ab.name || 'Frenzy', type: 'buff', duration: Number(ab.duration || 6), moveSpeedMultiplier: 0.25, tags: ['buff'], color }, this);
          this.attackTimer = Math.min(this.attackTimer || 0, 0.4); // swing sooner
          cue(ab.name); return true;
        case 'boss_heal': case 'heal':
          this.hp = Math.min(this.maxHp, this.hp + Math.floor(this.maxHp * 0.12));
          game.spawnCastCue?.(this, '#7fe38a', ab.name || 'Mend'); return true;
        case 'charge': case 'lunge': {
          // V0.18.2: gap-close - dash toward the target, then strike (lunge adds a small
          // AoE + status at the landing point). advance = tiles moved this dash.
          const advance = Math.max(1.0, Number(ab.advance || (kind === 'lunge' ? 2.2 : 1.6)));
          const dx = target.x - this.x, dy = target.y - this.y, len = Math.hypot(dx, dy) || 1;
          const step = Math.min(advance, Math.max(0, len - 0.9));
          const nx = this.x + (dx / len) * step, ny = this.y + (dy / len) * step;
          if (game.isWalkable?.(nx, ny, this)) { this.x = nx; this.y = ny; }
          this.setFacingFromDelta(dx, dy);
          game.spawnRing?.(this.x, this.y, color, ringPx * 0.7);
          const status = ab.status ? { id: String(ab.status).toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: ab.status, type: 'debuff', duration: 4, moveSpeedMultiplier: /poison|snare|slow/.test(String(ab.status).toLowerCase()) ? -0.3 : 0, tags: ['debuff'], color, hostile: true } : null;
          game.enemyAoeDamage?.(this.x, this.y, kind === 'lunge' ? radius : Math.max(1.3, Number(ab.range || 1.8)), hit() + Math.max(0, Number(ab.damageBonus || 0)), this, color, status ? { status } : {});
          cue(ab.name); return true;
        }
        case 'blink': {
          // Teleport to just short of the target, strike + apply a flicker debuff.
          const bx = this.x - target.x, by = this.y - target.y, bl = Math.hypot(bx, by) || 1;
          const tx = target.x + (bx / bl) * 1.4, ty = target.y + (by / bl) * 1.4;
          game.spawnRing?.(this.x, this.y, color, ringPx * 0.6);
          if (game.isWalkable?.(tx, ty, this)) { this.x = tx; this.y = ty; }
          game.spawnRing?.(this.x, this.y, color, ringPx * 0.6);
          this.setFacingFromDelta(target.x - this.x, target.y - this.y);
          const bstatus = { id: 'flicker', name: ab.status || 'Flicker', type: 'debuff', duration: 3, moveSpeedMultiplier: -0.22, tags: ['debuff'], color, hostile: true };
          game.enemyAoeDamage?.(target.x, target.y, Math.max(1.2, radius), hit() + Math.max(0, Number(ab.damageBonus || 0)), this, color, { status: bstatus });
          cue(ab.name); return true;
        }
        case 'retreat': {
          // Hard disengage - burst away from the target while facing it.
          const ax = this.x - target.x, ay = this.y - target.y, al = Math.hypot(ax, ay) || 1;
          const rtx = this.x + (ax / al) * 3.0, rty = this.y + (ay / al) * 3.0;
          if (game.isWalkable?.(rtx, rty, this)) { this.x = rtx; this.y = rty; }
          this.setFacingFromDelta(target.x - this.x, target.y - this.y);
          game.spawnRing?.(this.x, this.y, color, ringPx * 0.6);
          cue(ab.name || 'Retreat'); return true;
        }
        case 'cocoon_prison': {
          // Trap the target: a hard root + light damage in radius.
          game.spawnRing?.(target.x, target.y, color, ringPx);
          game.enemyAoeDamage?.(target.x, target.y, radius, Math.max(1, Math.floor(hit() * 0.5)), this, color, {
            status: { id: 'cocoon_prison', name: ab.name || 'Cocoon Prison', type: 'control', duration: 3.4, moveSpeedMultiplier: -1, tags: ['root'], color, hostile: true }
          });
          cue(ab.name); return true;
        }
        case 'summon_adds': case 'phase_adds':
          return this.summonMobAdds(game, ab) === true;
        default:
          return false; // truly unknown kind
      }
    }

    // V0.18.2: spawn temporary combat adds around the caster. Resolves what to summon from
    // ab.summonMob / baseType.summonMob, else a family-appropriate weak mob from the draft
    // registry (spiders for spider bosses, else the weakest non-elite mob).
    summonMobAdds(game, ab) {
      if (typeof game.spawnQuestWaveEnemy !== 'function') return false;
      const count = Math.max(1, Math.min(6, Math.floor(Number(ab.summonCount || ab.count || 2))));
      const addId = ab.summonMob || this.baseType?.summonMob || this.resolveSummonAddId(game);
      if (!addId) return false;
      const lvl = Math.max(1, Math.floor(Number(this.level || 1)) - 1);
      let spawned = 0;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const sx = this.x + Math.cos(ang) * 1.9, sy = this.y + Math.sin(ang) * 1.9;
        const add = game.spawnQuestWaveEnemy(addId, sx, sy, lvl, { leashRadius: 30, roamRadius: 12 });
        if (add) { add.summonedBy = this.id; add.isSummonedAdd = true; spawned++; }
      }
      if (spawned) game.spawnCastCue?.(this, ab.color || this.rangedAttackColor || '#c9a2ff', ab.name || 'Summon');
      return spawned > 0;
    }

    resolveSummonAddId(game) {
      const byId = DR.MOB_DRAFT_BY_ID || {};
      const entries = Object.entries(byId)
        .map(([id, d]) => ({ id, d }))
        .filter(({ d }) => d && !d.elite && !d.boss && !d.named && Number(d.hp) > 0);
      if (!entries.length) return null;
      const weakest = list => list.slice().sort((a, b) => Number(a.d.hp) - Number(b.d.hp))[0]?.id;
      const text = `${this.baseType?.family || ''} ${this.name || ''} ${this.baseType?.name || ''}`.toLowerCase();
      if (/spider|silk|web|brood|spinner|widow|cocoon/.test(text)) {
        const spiders = entries.filter(({ id, d }) => /spider|silk|web|brood|spinner|widow/.test(`${d.family || ''} ${d.name || ''} ${id}`.toLowerCase()));
        if (spiders.length) return weakest(spiders);
      }
      const fam = String(this.baseType?.family || '').toLowerCase();
      if (fam) {
        const sameFam = entries.filter(({ d }) => String(d.family || '').toLowerCase() === fam);
        if (sameFam.length) return weakest(sameFam);
      }
      return weakest(entries);
    }

    tryLowHealthTactic(game, target, dt) {
      this.fleeCooldown = Math.max(0, Number(this.fleeCooldown || 0) - dt);
      if (this.elite || this.baseType?.elite || this.baseType?.named) return false;
      const ratio = this.hp / Math.max(1, this.maxHp || 1);
      // Phase 4 (NPC AI/Spawn/Leash/Loot Ownership): the flee threshold was
      // a hardcoded 0.18 with no per-mob descriptor. baseType.fleeHp is a
      // new optional data field (data/npcs.js MOB_DRAFTS / data/enemies.js
      // BOSS_DRAFTS); no shipped mob sets it, so the fallback keeps this
      // ratio and every existing mob's flee behavior identical.
      const fleeThreshold = Number(this.baseType?.fleeHp);
      const effectiveFleeThreshold = Number.isFinite(fleeThreshold) && fleeThreshold > 0 && fleeThreshold < 1 ? fleeThreshold : 0.18;
      if (ratio > effectiveFleeThreshold || this.fleeCooldown > 0 || !target?.alive) return false;
      this.fleeCooldown = 4.0 + Math.random() * 2.5;
      this.callNearbyAllies(game, target);
      const hx = Number(this.homeX || this.x);
      const hy = Number(this.homeY || this.y);
      const leash = Number(this.baseType?.leashRadius) || 14;
      const awayX = this.x - target.x;
      const awayY = this.y - target.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      const desired = Math.min(3.25, Math.max(1.35, leash - dist(this, { x: hx, y: hy }) - 1.0));
      const tx = this.x + (awayX / awayLen) * desired;
      const ty = this.y + (awayY / awayLen) * desired;
      if (dist({ x: tx, y: ty }, { x: hx, y: hy }) <= leash - 0.5 && game.isWalkable?.(tx, ty, this)) {
        this.moveToward(game, tx, ty, dt, 0.55);
        this.lastTacticalLabel = 'falling back';
        return true;
      }
      return false;
    }

    // V0.17.99: ranged caster attack - a bolt at range, same damage as the melee auto
    // (getEnemyAutoAttackRawDamage) so it's balance-neutral, just delivered from distance.
    performRangedAttack(game, target, d) {
      if (!target?.alive) return false;
      const color = this.rangedAttackColor || '#9fd8ff';
      this.setFacingFromDelta(target.x - this.x, target.y - this.y);
      game.spawnBolt?.({ x: this.x, y: this.y - 0.4 }, { x: target.x, y: target.y - 0.4 }, color, { projectile: { speed: 15 }, kind: 'bolt', school: 'magic' });
      game.spawnCastCue?.(this, color, 'Cast');
      const damage = game.getEnemyAutoAttackRawDamage
        ? game.getEnemyAutoAttackRawDamage(this, target)
        : Math.floor(this.getStat('attack') * 0.9 + this.level * 0.42);
      game.damageEntity?.(target, damage, this, color, { damageType: 'magic', canCrit: false });
      game.spawnCombatImpact?.(target, color, 0.7, 'enemy');
      this.combatCooldown = Math.max(this.combatCooldown || 0, 7.5);
      this.attackTimer = (game.getEnemySwingDelay ? game.getEnemySwingDelay(this, target) : 2.5) / Math.max(0.1, Number(this._bossAttackSpeedMult) || 1); // V0.20.34: phase attack-speed
      return true;
    }

    // Back away from a target that has closed inside casting range, staying inside leash,
    // while continuing to face it (so it keeps firing as it retreats).
    kiteFromTarget(game, target, dt) {
      const awayX = this.x - target.x;
      const awayY = this.y - target.y;
      const len = Math.hypot(awayX, awayY) || 1;
      const tx = this.x + (awayX / len) * 1.6;
      const ty = this.y + (awayY / len) * 1.6;
      const hx = Number(this.homeX || this.x);
      const hy = Number(this.homeY || this.y);
      const leash = Number(this.baseType?.leashRadius) || 14;
      if (Math.hypot(tx - hx, ty - hy) <= leash && game.isWalkable?.(tx, ty, this)) {
        this.moveToward(game, tx, ty, dt, 0.1);
        this.lastTacticalLabel = 'kiting';
      }
      this.setFacingFromDelta(target.x - this.x, target.y - this.y);
    }

    aiUpdateBand(game) {
      if (this.aggro || hasThreatEntries(this.threatTable) || this.hp < this.maxHp) return 'near';
      if (game?.performanceSettings?.().enableAiThrottling === false) return 'near';
      const player = game?.player;
      if (!player?.alive) return 'sleep';
      const perf = game.performanceSettings?.() || {};
      const near = Math.max(6, Number(perf.nearAiRadius || DEFAULT_NEAR_AI_RADIUS_TILES));
      const mid = Math.max(near + 1, Number(perf.midAiRadius || DEFAULT_MID_AI_RADIUS_TILES));
      const far = Math.max(mid + 1, Number(perf.farAiRadius || DEFAULT_FAR_AI_RADIUS_TILES));
      const d = dist(this, player);
      if (d <= near) return 'near';
      if (d <= mid) return 'mid';
      if (d <= far) return 'far';
      if (this.elite || this.named || this.rare || this.boss || this.baseType?.elite || this.baseType?.named || this.baseType?.boss) return 'far';
      return 'sleep';
    }

    shouldSkipForAiBudget(game, dt) {
      const band = this.aiUpdateBand(game);
      this._lastAiBand = band;
      if (band === 'near') {
        game?.recordEnemyAiBudget?.(this, band, false);
        return false;
      }
      const now = game.runtimeNowMs?.() || (performance?.now ? performance.now() : Date.now());
      const nextAt = Number(this._nextBudgetAiAt || 0);
      if (now < nextAt) {
        game?.recordEnemyAiBudget?.(this, band, true);
        return true;
      }
      const perf = game.performanceSettings?.() || {};
      const eliteMul = (this.elite || this.named || this.rare || this.boss || this.baseType?.elite || this.baseType?.named || this.baseType?.boss)
        ? Math.max(0.25, Number(perf.eliteAiIntervalMultiplier || 0.55))
        : 1;
      const interval = band === 'mid'
        ? Number(perf.midAiInterval || 0.25)
        : band === 'far'
          ? Number(perf.farAiInterval || 1.0)
          : Number(perf.sleepAiInterval || 5.0);
      this._nextBudgetAiAt = now + Math.max(80, interval * 1000 * eliteMul) + Math.random() * Math.max(40, interval * 250);
      game?.recordEnemyAiBudget?.(this, band, false);
      return false;
    }
  

    updateRoamingGroupPatrol(game, dt) {
      if (this.encounterKind !== 'roaming_group' || !this.roamingGroupId || this.aggro) return false;
      const group = cachedRoamingGroup(game, this.roamingGroupId);
      const leader = group[0] || this;
      if (leader !== this) {
        const distanceToLeader = dist(this, leader);
        if (distanceToLeader > 9.5) {
          this.patrolTarget = { x: leader.x, y: leader.y };
          this.patrolWait = 0;
        }
        if (distanceToLeader > 2.5) {
          this.moveToward(game, leader.x, leader.y, dt, distanceToLeader > 6 ? 1.85 : 1.45);
          return true;
        }
        if (distanceToLeader < 1.1 && this.patrolWait > 0.1) return true;
        return false;
      }
      const groupHomeX = this.spawnHomeX || this.homeX;
      const groupHomeY = this.spawnHomeY || this.homeY;
      const homeDistance = Math.hypot(this.x - groupHomeX, this.y - groupHomeY);
      const leash = Number(this.baseType?.leashRadius || 24);
      if (homeDistance > leash) {
        this.patrolTarget = { x: groupHomeX, y: groupHomeY };
      } else if (this.patrolTarget && game.canEnemyRoamTo?.(this.patrolTarget.x, this.patrolTarget.y, this) === false) {
        this.patrolTarget = null;
        this.patrolWait = 0.4 + Math.random() * 1.2;
      }
      return false;
    }

    choosePatrolTarget(game) {
      const radius = Math.max(2.5, Number(this.patrolRadius) || 6);
      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const d = 1.5 + Math.random() * radius;
        const tx = this.homeX + Math.cos(angle) * d;
        const ty = this.homeY + Math.sin(angle) * d;
        if (game.isWalkable?.(tx, ty, this) && game.canEnemyRoamTo?.(tx, ty, this) !== false) {
          this.patrolTarget = { x: tx, y: ty };
          return;
        }
      }
      this.patrolTarget = null;
      this.patrolWait = 1.2 + Math.random() * 3.0;
    }

    updatePatrol(game, dt) {
      if (this.combatCooldown > 0) return;
      if (this.updateRoamingGroupPatrol?.(game, dt)) return;
      this.patrolWait = Math.max(0, (this.patrolWait || 0) - dt);
      const homeDistance = Math.hypot(this.x - this.homeX, this.y - this.homeY);
      const damaged = this.hp < this.maxHp;
      if (homeDistance > (this.patrolRadius || 6) + 1.25) {
        this.patrolTarget = { x: this.homeX, y: this.homeY };
      } else if (damaged) {
        this.patrolTarget = null;
        return;
      } else if (!this.patrolTarget && this.patrolWait <= 0) {
        this.choosePatrolTarget(game);
      }
      if (!this.patrolTarget) return;
      if (game.canEnemyRoamTo?.(this.patrolTarget.x, this.patrolTarget.y, this) === false) {
        this.patrolTarget = null;
        this.patrolWait = 0.8 + Math.random() * 2.4;
        return;
      }
      const d = dist(this, this.patrolTarget);
      if (d < 0.55) {
        this.patrolTarget = null;
        this.patrolWait = damaged ? 0.6 : 1.5 + Math.random() * 4.0;
        return;
      }
      this.moveToward(game, this.patrolTarget.x, this.patrolTarget.y, dt, damaged ? 0.45 : 0.35);
    }

    // V0.20.34 (Roadmap Item 19): boss soft-enrage + HP-threshold phases. Recomputes the damage and
    // attack-speed multipliers every frame from current combat time and HP, so a healed boss de-
    // escalates; the phase ANNOUNCE and the 25% burst are one-time (high-water latch). Non-bosses and
    // dead bosses do nothing. Reset by respawn() and by leashing home (see below).
    updateBossEscalation(game, dt) {
      if (!isBossEnemy(this) || !this.alive) { this._bossDamageMult = 1; this._bossAttackSpeedMult = 1; return; }
      if (this.aggro) this._bossCombatTime = (this._bossCombatTime || 0) + Math.max(0, Number(dt) || 0);
      const t = Number(this._bossCombatTime) || 0;
      // soft enrage: 45s grace, then +8% damage every 10s, capped at +80%.
      const softBonus = Math.min(0.80, Math.max(0, (t - 45) / 10) * 0.08);
      // HP-threshold phases: 50% -> +12% dmg / +20% speed; 25% -> +24% dmg / +40% speed.
      const ratio = this.hp / Math.max(1, this.maxHp || 1);
      let phaseLevel = 0, phaseDmg = 0, phaseSpeed = 0;
      if (ratio <= 0.25) { phaseLevel = 2; phaseDmg = 0.24; phaseSpeed = 0.40; }
      else if (ratio <= 0.50) { phaseLevel = 1; phaseDmg = 0.12; phaseSpeed = 0.20; }
      this._bossDamageMult = (1 + softBonus) * (1 + phaseDmg);
      this._bossAttackSpeedMult = 1 + phaseSpeed;
      if (phaseLevel > (this._bossPhaseSeen || 0)) {
        this._bossPhaseSeen = phaseLevel;
        game.log?.(`${this.name || 'The boss'} ${phaseLevel >= 2 ? 'turns desperate' : 'grows enraged'}!`);
        game.spawnCastCue?.(this, '#ff5a3d', phaseLevel >= 2 ? 'Desperate!' : 'Enraged!');
        if (phaseLevel >= 2 && !this._bossBurstFired) { this._bossBurstFired = true; this.bossPhaseBurst(game); }
      }
    }

    // The one-time 25%-HP burst: summon adds if this boss has a summon ability, otherwise a big
    // telegraphed strike at the player. The strike reuses the enemy_aoe telegraph queue, so it is
    // dodgeable AND interruptible like every other ground AoE.
    bossPhaseBurst(game) {
      const target = game.player;
      if (!target) return;
      const abilities = this.baseType?.abilities;
      const summonAb = Array.isArray(abilities) && abilities.find(a => a && /summon/.test(String(a.kind || '').toLowerCase()));
      if (summonAb && typeof this.executeDataAbility === 'function') { this.executeDataAbility(game, target, summonAb, 0, String(summonAb.kind).toLowerCase()); return; }
      const radius = 4.5;
      const ringPx = radius * 26;
      game.addEffect?.({ type: 'bossGroundTelegraph', x: target.x, y: target.y, x2: target.x, y2: target.y, t: 0, life: 0.86, color: '#ff5a3d', color2: '#ffd24a', radius: ringPx / 5.8, seed: ((Math.floor(target.x * 73856) ^ Math.floor(target.y * 19349)) >>> 0) || 1 });
      const base = game.getEnemyAutoAttackRawDamage ? game.getEnemyAutoAttackRawDamage(this, target) : (this.getStat?.('attack') || 10);
      game.queuePendingSpellImpact?.({ kind: 'enemy_aoe', delay: 0.8, center: { x: target.x, y: target.y }, radius, damage: Math.round(base * 2.2), source: this, color: '#ff5a3d', name: 'Desperate Strike' });
    }

    update(game, dt) {
      this.updateBase(dt);
      if (!this.alive) {
        if (!this.noSelfRespawn && this.deadTimer > this.respawnTimer) this.respawn(game);
        return;
      }
  
      this.tacticalCooldown = Math.max(0, Number(this.tacticalCooldown || 0) - dt);
      this.spiderWebCooldown = Math.max(0, Number(this.spiderWebCooldown || 0) - dt);
      this.spiderWebCastAnim = Math.max(0, Number(this.spiderWebCastAnim || 0) - dt);
      this.callHelpCooldown = Math.max(0, Number(this.callHelpCooldown || 0) - dt);
      this.updateBossEscalation(game, dt);
      // V0.20.34: enrage resets when the boss is no longer in combat (leash/deaggro), so a reset fight
      // starts fresh - standard leash behaviour. Phase latches follow HP each frame and need no reset.
      if (!this.aggro && Number(this._bossCombatTime) > 0) this._bossCombatTime = 0;
      if (game.hasStatusTag?.(this, 'stun')) return;
      const hasThreat = hasThreatEntries(this.threatTable);
      if ((this.aggro || hasThreat || this.hp < this.maxHp) && game?.recordEnemyAiBudget) game.recordEnemyAiBudget(this, 'near', false);
      if (!this.aggro && !hasThreat && this.shouldSkipForAiBudget?.(game, dt)) return;
      if (!this.aggro && !hasThreat && this._lastAiBand === 'sleep') {
        this.patrolTarget = null;
        return;
      }
      if (!this.aggro && !hasThreat && this._lastAiBand === 'far') {
        this.updatePatrol(game, Math.min(dt, 0.05));
        return;
      }
      const target = game.pickEnemyTarget(this);
      if (!target) {
        this.aggro = false;
        this.updatePatrol(game, dt);
        return;
      }
  
      const d = dist(this, target);
      const aggroRadius = this.effectiveAggroRadius?.(game, target) || 5.6;
      const leashRadius = Number(this.baseType?.leashRadius) || 14;
      const homeDistance = Math.hypot(this.x - this.homeX, this.y - this.homeY);
      const targetHomeDistance = Math.hypot(target.x - this.homeX, target.y - this.homeY);
      if (targetHomeDistance > leashRadius && homeDistance > 1.2) {
        this.aggro = false;
        this.patrolTarget = { x: this.homeX, y: this.homeY };
        game.resetThreatForEnemy?.(this);
        this.updatePatrol(game, dt);
        return;
      }
      else {
        const threatCount = hasThreatEntries(this.threatTable) ? 1 : 0;
        const clearPath = d <= Math.max(2.2, this.range + 0.8) || !game.hasLineWalkPath || game.hasLineWalkPath(this.x, this.y, target.x, target.y, this);
        const proximityAggro = d <= aggroRadius && clearPath;
        this.aggro = proximityAggro || this.hp < this.maxHp || threatCount > 0;
      }
      if (this.aggro && target && target.alive && d <= aggroRadius) {
        game.addThreat?.(this, target, 1.2, { reason: 'proximity', actorCombatSeconds: 1.2, combatSeconds: 2.5 });
        if (this.hp < this.maxHp || d <= Math.max(2.8, this.range + 1.4)) this.callNearbyAllies?.(game, target);
      }
      const movedRecently = Math.hypot(this.x - Number(this.lastAiX || this.x), this.y - Number(this.lastAiY || this.y));
      if (this.aggro && d > this.range + 0.35 && movedRecently < 0.015) this.aiStuckTimer = Math.min(3.0, Number(this.aiStuckTimer || 0) + dt);
      else this.aiStuckTimer = Math.max(0, Number(this.aiStuckTimer || 0) - dt * 2.0);
      this.lastAiX = this.x;
      this.lastAiY = this.y;
      if (this.aiStuckTimer > 2.25) {
        this.handlePathingFailure?.(game, target, dt);
        this.aiStuckTimer = 0.45;
      }

      if (!this.aggro) {
        if (homeDistance > (this.patrolRadius || 6) + 2) game.moveEnemyToward(this, this.homeX, this.homeY, dt, 0.35);
        else this.updatePatrol(game, dt);
      } else if (this.tryLowHealthTactic?.(game, target, dt)) {
        return;
      } else if (game.trySpiderMobWebAttack?.(this, target, d)) {
        return;
      } else if (this.isRangedAttacker && this.aggro && d < (this.rangedKiteRange || 3.2) && !game.hasStatusTag?.(this, 'root')) {
        // Ranged caster: the target closed inside casting range - back away while firing.
        this.kiteFromTarget(game, target, dt);
        if (this.attackTimer <= 0 && game.hasLineWalkPath?.(this.x, this.y, target.x, target.y, this) !== false) {
          this.tryTacticalAbility?.(game, target, d);
          this.performRangedAttack(game, target, d);
        }
      } else if (this.aggro && d > this.range) {
        if (!game.hasStatusTag?.(this, 'root')) {
          const moved = game.moveEnemyToward(this, target.x, target.y, dt, this.range * 0.86);
          if (moved) this.aiPathFailCount = 0;
          else this.handlePathingFailure?.(game, target, dt);
        }
      } else if (this.aggro && this.attackTimer <= 0) {
        if (this.isRangedAttacker) {
          // Fire only with line of sight; otherwise reposition to clear the shot.
          if (game.hasLineWalkPath?.(this.x, this.y, target.x, target.y, this) !== false) {
            this.tryTacticalAbility?.(game, target, d);
            this.performRangedAttack(game, target, d);
          } else if (!game.hasStatusTag?.(this, 'root')) {
            game.moveEnemyToward(this, target.x, target.y, dt, this.range * 0.5);
          }
        } else {
          this.setFacingFromDelta(target.x - this.x, target.y - this.y);
          this.tryTacticalAbility?.(game, target, d);
          game.playAttackAnimation(this, target, '#d4665a', 'claw');
          game.spawnCastCue?.(this, '#d4665a', 'Swing');
          const damage = game.getEnemyAutoAttackRawDamage
            ? game.getEnemyAutoAttackRawDamage(this, target)
            : Math.floor(this.getStat('attack') * 0.92 + randInt(0, 3) + this.level * 0.42);
          game.damageEntity(target, damage, this, '#d4665a', { damageType: 'physical', canCrit: false });
          game.spawnCombatImpact?.(target, '#d4665a', 0.85, 'enemy');
          this.combatCooldown = Math.max(this.combatCooldown || 0, 7.5);
          this.attackTimer = (game.getEnemySwingDelay ? game.getEnemySwingDelay(this, target) : 2.5) / Math.max(0.1, Number(this._bossAttackSpeedMult) || 1); // V0.20.34: phase attack-speed
        }
      }
    }
  
    respawn(game) {
      const pos = game.findSpawnTile(this.homeX, this.homeY, 8);
      this.x = pos.x + 0.5;
      this.y = pos.y + 0.5;
      this.hp = this.maxHp;
      this.alive = true;
      this.deadTimer = 0;
      this.aggro = false;
      // V0.20.34: a respawned boss starts a fresh fight - no lingering enrage or phase latches.
      this._bossCombatTime = 0; this._bossPhaseSeen = 0; this._bossBurstFired = false;
      this._bossDamageMult = 1; this._bossAttackSpeedMult = 1;
      game.resetThreatForEnemy?.(this);
      this.patrolTarget = null;
      this.patrolWait = 0.8 + Math.random() * 2.4;
      // V0.18.36: a corpse can be turned into a grouped loot bag - its name is
      // renamed to "Corpse Bag (N)" and it carries corpse-loot flags. respawn()
      // only reset combat state before, so the SAME pooled enemy object came back
      // alive still named "Corpse Bag (N)" (with a threat bar). Restore its real
      // identity and drop all corpse/loot-bag state so it respawns as a clean mob.
      if (this.baseType?.name) this.name = this.baseType.name;
      this.corpseLoot = null;
      this.isLootCorpse = false;
      this.corpseLooted = false;
      this.corpseLootInteractPending = false;
      this.corpseVisualExpired = false;
      this.corpseLootSummary = '';
      this.corpseLootCreatedAt = 0;
      this.corpseLootZoneId = null;
      this.groupLootMergedInto = null;
      this.blocksMovement = false;
      if (Array.isArray(game.lootableCorpses)) game.lootableCorpses = game.lootableCorpses.filter(corpse => corpse !== this);
    }
  }
  

  DR.entities.Enemy = Enemy;
  DR.Enemy = Enemy;
})();
