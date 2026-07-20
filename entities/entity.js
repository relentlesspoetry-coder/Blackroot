(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};

let nextId = 1;

  function restoreActorLiveState(actor) {
    if (!actor) return false;
    actor.alive = true;
    actor.dead = false;
    actor.isDead = false;
    actor.isCorpse = false;
    actor.isGhost = false;
    actor.ghosted = false;
    actor.hidden = false;
    actor.visible = true;
    actor.renderable = true;
    actor.spriteVisible = true;
    actor.alpha = 1;
    actor.opacity = 1;
    actor.deathProgress = 0;
    actor.deathState = 'none';
    actor.respawnState = 'none';
    actor.phase = 'living';
    actor.action = 'idle';
    actor.currentAction = null;
    actor.animationState = 'idle';
    actor.currentAnimation = 'idle';
    actor.deadTimer = 0;
    actor.hitAnim = 0;
    actor.hitReaction = 0;
    actor.damageAnim = 0;
    actor.attackAnim = 0;
    actor.spellCastAnim = 0;
    actor.autoAttack = false;
    actor.autoAttackToggle = false;
    actor.autoAttackAutoEngaged = false;
    actor.autoAttackVisualActive = false;
    actor.autoAttackVisualType = '';
    actor.autoAttackVisualPhase = 0;
    actor.autoAttackVisualPulse = 0;
    actor.autoAttackVisualInterval = 0;
    actor.autoAttackVisualWeapon = '';
    actor.autoAttackVisualClass = '';
    actor.autoAttackVisualRole = '';
    actor.autoAttackVisualAimSide = 0;
    actor.autoAttackVisualTargetId = null;
    actor.autoAttackVisualTargetX = null;
    actor.autoAttackVisualTargetY = null;
    actor.moveBlend = 0;
    actor.z = 0;
    actor.vz = 0;
    return true;
  }

  function markActorDeathState(actor, options = {}) {
    if (!actor) return false;
    actor.alive = false;
    actor.dead = true;
    actor.isDead = true;
    actor.isCorpse = options.corpse !== false;
    actor.isGhost = false;
    actor.ghosted = false;
    actor.hidden = false;
    actor.visible = true;
    actor.renderable = true;
    actor.spriteVisible = true;
    actor.alpha = 1;
    actor.opacity = 1;
    actor.hp = 0;
    actor.deadTimer = 0;
    actor.deathProgress = 1;
    actor.deathState = options.state || 'dead';
    actor.respawnState = options.respawnState || (actor.kind === 'player' ? 'pending' : 'none');
    actor.phase = 'dead';
    actor.action = 'death';
    actor.currentAction = 'death';
    actor.animationState = 'death';
    actor.currentAnimation = 'death';
    actor.autoAttack = false;
    actor.autoAttackToggle = false;
    actor.autoAttackAutoEngaged = false;
    actor.autoAttackVisualActive = false;
    actor.autoAttackVisualType = '';
    actor.autoAttackVisualPhase = 0;
    actor.autoAttackVisualPulse = 0;
    actor.autoAttackVisualInterval = 0;
    actor.autoAttackVisualWeapon = '';
    actor.autoAttackVisualClass = '';
    actor.autoAttackVisualRole = '';
    actor.autoAttackVisualAimSide = 0;
    actor.autoAttackVisualTargetId = null;
    actor.autoAttackVisualTargetX = null;
    actor.autoAttackVisualTargetY = null;
    actor.attackTimer = 0;
    actor.castTimer = 0;
    actor.attackAnim = 0;
    actor.spellCastAnim = 0;
    actor.hitAnim = 0;
    actor.hitReaction = 0;
    actor.damageAnim = 0;
    actor.moveBlend = 0;
    actor.vx = 0;
    actor.vy = 0;
    actor.z = 0;
    actor.vz = 0;
    actor.isJumping = false;
    return true;
  }

  
  
  class Entity {
    constructor(name, x, y, opts = {}) {
      this.id = nextId++;
      this.name = name;
      this.x = x;
      this.y = y;
      this.z = 0;
      this.vz = 0;
      this.jumpCooldown = 0;
      this.jumpAnim = 0;
      this.isJumping = false;
      this.vx = 0;
      this.vy = 0;
      this.level = opts.level ?? 1;
      this.maxHp = opts.hp ?? 100;
      this.hp = this.maxHp;
      this.maxMana = opts.mana ?? 0;
      this.mana = this.maxMana;
      this.attack = opts.attack ?? 8;
      this.defense = opts.defense ?? 2;
      this.speed = opts.speed ?? 2.0;
      this.attributes = { ...(opts.attributes || {}) };
      this.statRatings = { ...(opts.statRatings || {}) };
      this.derivedStats = { ...(opts.derivedStats || {}) };
      this.armor = opts.armor ?? opts.defense ?? 0;
      this.armorReduction = opts.armorReduction ?? 0;
      this.cooldownReduction = opts.cooldownReduction ?? 0;
      this.critChance = opts.critChance ?? 0;
      this.magicCritChance = opts.magicCritChance ?? 0;
      this.critDamageMultiplier = opts.critDamageMultiplier ?? 1.5;
      this.magicCritDamageMultiplier = opts.magicCritDamageMultiplier ?? 1.5;
      this.physicalDamageMultiplier = opts.physicalDamageMultiplier ?? 1;
      this.magicDamageMultiplier = opts.magicDamageMultiplier ?? 1;
      this.healingMultiplier = opts.healingMultiplier ?? 1;
      this.range = opts.range ?? 1.5;
      this.color = opts.color ?? '#ffffff';
      this.kind = opts.kind ?? 'entity';
      this.alive = true;
      this.deadTimer = 0;
      this.autoAttack = false;
      this.autoAttackToggle = false;
      this.autoAttackAutoEngaged = false;
      this.autoAttackVisualActive = false;
      this.autoAttackVisualType = '';
      this.autoAttackVisualPhase = 0;
      this.autoAttackVisualPulse = 0;
      this.autoAttackVisualInterval = 0;
      this.autoAttackVisualWeapon = '';
      this.autoAttackVisualClass = '';
      this.autoAttackVisualRole = '';
      this.autoAttackVisualAimSide = 0;
      this.autoAttackVisualTargetId = null;
      this.autoAttackVisualTargetX = null;
      this.autoAttackVisualTargetY = null;
      this.attackTimer = 0;
      this.castTimer = 0;
      this.buffs = [];
      this.facing = 1;
      this.facingX = 1;
      this.facingY = 0;
      this.facingName = 'east';
      this.walkCycle = 0;
      this.moveBlend = 0;
      this.attackAnim = 0;
      this.spellCastAnim = 0;
    }
  
    getStat(stat) {
      const key = String(stat || '');
      const attributeKeys = DR.ATTRIBUTE_KEYS || [];
      let base = attributeKeys.includes(key) ? (this.attributes?.[key] ?? 0) : (this[key] ?? this.statRatings?.[key] ?? this.derivedStats?.[key] ?? 0);
      for (const buff of this.buffs) {
        if (buff.mods && buff.mods[key] != null) base += Number(buff.mods[key]) || 0;
      }
      if (key === 'speed' && DR.StatusEffects?.statusSpeedScalar) base *= DR.StatusEffects.statusSpeedScalar(this);
      return Math.max(0, base);
    }
  
    addBuff(name, duration, mods, extra = {}) {
      if (DR.StatusEffects?.applyToEntity) {
        return DR.StatusEffects.applyToEntity(this, {
          id: extra.id || extra.statusId || name,
          name,
          duration,
          mods: mods || {},
          tickDamage: extra.tickDamage,
          tickHealing: extra.tickHealing,
          tickRate: extra.tickRate,
          tickTimer: extra.tickTimer,
          damageType: extra.damageType,
          color: extra.color,
          sourceId: extra.sourceId,
          sourceKind: extra.sourceKind,
          sourceName: extra.sourceName,
          type: extra.type,
          tags: extra.tags,
          maxStacks: extra.maxStacks,
          stacks: extra.stacks,
          hostile: extra.hostile,
          canCrit: extra.canCrit
        }, extra.source || null, extra.game || null);
      }
      const payload = { name, duration, remaining: duration, mods: mods || {}, ...extra };
      const existing = this.buffs.find(b => b.name === name);
      if (existing) {
        Object.assign(existing, payload);
        return existing;
      }
      this.buffs.push(payload);
      return payload;
    }
  
    setFacingFromDelta(dx, dy) {
      const len = Math.hypot(dx, dy);
      if (len <= 0.0001) return;
      this.facingX = dx / len;
      this.facingY = dy / len;
      this.facing = this.facingX >= 0 ? 1 : -1;
      const angle = Math.atan2(this.facingY, this.facingX);
      const octant = Math.round(angle / (Math.PI / 4));
      const names = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
      this.facingName = names[(octant + 8) % 8];
    }
  
    updateBase(dt) {
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.castTimer = Math.max(0, this.castTimer - dt);
      this.combatCooldown = Math.max(0, (this.combatCooldown || 0) - dt);
      if (this.combatCooldown > 0) {
        this._lastCombatActiveAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this._postCombatRushConsumed = false;
      }
      this.jumpCooldown = Math.max(0, (this.jumpCooldown || 0) - dt);
      this.jumpAnim = Math.max(0, (this.jumpAnim || 0) - dt * 3.6);
      if ((this.z || 0) > 0 || (this.vz || 0) > 0) {
        this.vz = (this.vz || 0) - 13.2 * dt;
        this.z = Math.max(0, (this.z || 0) + this.vz * dt);
        this.isJumping = this.z > 0;
        if (this.z <= 0) {
          this.z = 0;
          this.vz = 0;
          this.isJumping = false;
        }
      } else {
        this.z = 0;
        this.vz = 0;
        this.isJumping = false;
      }
      this.attackAnim = Math.max(0, (this.attackAnim || 0) - dt * 4.6);
      this.spellCastAnim = Math.max(0, (this.spellCastAnim || 0) - dt * 3.2);
      if (!DR.StatusEffects) {
        for (let i = this.buffs.length - 1; i >= 0; i--) {
          const remainingKey = this.buffs[i].remaining != null ? 'remaining' : 'duration';
          this.buffs[i][remainingKey] -= dt;
          if (this.buffs[i][remainingKey] <= 0) this.buffs.splice(i, 1);
        }
      }
  
      // Animation owner: keep movement state alive long enough for planted steps to read.
      // Earlier builds faded this too quickly, so bodies slid while small offsets disappeared.
      this.moveBlend = Math.max(0, (this.moveBlend || 0) - dt * 1.15);
      this.vx *= Math.max(0, 1 - dt * 5.2);
      this.vy *= Math.max(0, 1 - dt * 5.2);
      if (!this.alive) this.deadTimer += dt;
    }
  
    moveToward(game, tx, ty, dt, stopRange = 0) {
      const dx = tx - this.x;
      const dy = ty - this.y;
      const len = Math.hypot(dx, dy);
      if (len <= stopRange || len <= 0.001) return false;

      // V0.13.0: movement AI should not visually jump during low-FPS or recovery spikes.
      // Clamp simulation delta for autonomous actors, then steer around small blockers before
      // asking the pathfinder. This improves both mobs and bot players without a cascade patch.
      const safeDt = Math.min(Math.max(Number(dt) || 0, 0), this.kind === 'player' ? (DR.CONFIG?.PLAYER_MOVE_MAX_DT || 0.10) : (DR.CONFIG?.AI_MOVE_MAX_DT || 0.085));
      const resolvedSpeed = Number(game?.resolveActorMoveSpeed?.(this));
      const step = (Number.isFinite(resolvedSpeed) ? resolvedSpeed : this.getStat('speed')) * safeDt;
      const ux = dx / len;
      const uy = dy / len;

      const directX = this.x + ux * step;
      const directY = this.y + uy * step;
      if (game.hasLineWalkPath?.(this.x, this.y, directX, directY, this) && game.tryMove(this, directX, directY)) return true;

      // Cheap local steering prevents bots/mobs from pinning against tents, trees, fences, and water edges.
      const side = [
        { x: -uy, y: ux, bias: 0.92 },
        { x: uy, y: -ux, bias: 0.92 },
        { x: ux * 0.62 - uy * 0.78, y: uy * 0.62 + ux * 0.78, bias: 0.86 },
        { x: ux * 0.62 + uy * 0.78, y: uy * 0.62 - ux * 0.78, bias: 0.86 }
      ];
      for (const steer of side) {
        const sx = this.x + steer.x * step * steer.bias;
        const sy = this.y + steer.y * step * steer.bias;
        if (game.hasLineWalkPath?.(this.x, this.y, sx, sy, this) && game.tryMove(this, sx, sy)) {
          this._pathRepath = Math.min(Number(this._pathRepath || 0), 0.05);
          return true;
        }
      }

      const waypoint = game.nextPathStepForActor?.(this, tx, ty, safeDt, {
        maxRange: this.kind === 'enemy' ? 32 : 48,
        maxNodes: this.kind === 'enemy' ? 900 : 1500,
        repathSeconds: this.kind === 'enemy' ? 0.42 : 0.24,
        repathDistance: this.kind === 'enemy' ? 0.82 : 0.55
      });
      if (!waypoint) return false;

      const pdx = waypoint.x - this.x;
      const pdy = waypoint.y - this.y;
      const plen = Math.hypot(pdx, pdy);
      if (plen <= 0.001) {
        this._pathRoute?.shift?.();
        return false;
      }
      const nx = this.x + (pdx / plen) * Math.min(step, plen);
      const ny = this.y + (pdy / plen) * Math.min(step, plen);
      const moved = game.tryMove(this, nx, ny);
      if (!moved) {
        this._pathRepath = 0;
        this._pathRoute = [];
      }
      return moved;
    }
  }
  

  DR.entities.Entity = Entity;
  DR.Entity = Entity;
  DR.restoreActorLiveState = restoreActorLiveState;
  DR.markActorDeathState = markActorDeathState;
})();
