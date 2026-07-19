// Dream Realms real-time combat, entity death, and progression system.
// V0.12.86 owns real-time combat pacing, party combat propagation, shared XP/bot XP routing, and stale combat-state cleanup for meditation. Turn-based combat is not loaded.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  function randInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function alive(entity) {
    return Boolean(entity && entity.alive !== false && Number.isFinite(entity.x) && Number.isFinite(entity.y));
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function weaponDamageSeed(item) {
    if (!item) return 0;
    const statsAttack = safeNumber(item.stats?.attack ?? item.attack ?? item.attackPower ?? item.physicalPower, NaN);
    if (Number.isFinite(statsAttack) && statsAttack > 0) return statsAttack;
    const damage = item.damage && typeof item.damage === 'object' ? item.damage : null;
    const min = safeNumber(item.damageMin ?? item.minDamage ?? damage?.min, NaN);
    const max = safeNumber(item.damageMax ?? item.maxDamage ?? damage?.max, NaN);
    if (Number.isFinite(min) && Number.isFinite(max)) return Math.max(0, (min + max) * 0.5);
    return 0;
  }

  function combatDistance(a, b) {
    if (!a || !b) return Infinity;
    const ax = safeNumber(a.x, NaN);
    const ay = safeNumber(a.y, NaN);
    const bx = safeNumber(b.x, NaN);
    const by = safeNumber(b.y, NaN);
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return Infinity;
    return Math.hypot(ax - bx, ay - by);
  }

  // Normalized attacker->target vector, used to keep facing, projectile spawn point, and
  // projectile travel direction all derived from the same true (non-quantized) aim.
  function getAimVector(attacker, target) {
    const dx = safeNumber(target?.x, safeNumber(attacker?.x, 0)) - safeNumber(attacker?.x, 0);
    const dy = safeNumber(target?.y, safeNumber(attacker?.y, 0)) - safeNumber(attacker?.y, 0);
    const distance = Math.hypot(dx, dy) || 1;
    return { x: dx / distance, y: dy / distance, distance };
  }

  // Ranger bow shots must spawn near the bow/arrow tip, not the player's own center point.
  // World space has no notion of the procedural renderer's local bow-hand offset, so this
  // nudges the spawn point a small, fixed distance forward along the true aim vector -
  // enough that the arrow visibly originates in front of the archer instead of their feet.
  function rangedWeaponSpawnOrigin(attacker, aim) {
    const forward = 0.4;
    return { x: safeNumber(attacker?.x, 0) + aim.x * forward, y: safeNumber(attacker?.y, 0) + aim.y * forward };
  }

  const dist = combatDistance;

  const FRIENDLY_COMBAT_KINDS = Object.freeze(new Set(['player', 'remote', 'merc', 'pet', 'bot']));

  function actorKind(entity) {
    return String(entity?.kind || '').toLowerCase();
  }

  function isFriendlyCombatKind(entity) {
    return FRIENDLY_COMBAT_KINDS.has(actorKind(entity));
  }

  function friendlyCombatId(entity) {
    return String(entity?.botId || entity?.remoteId || entity?.id || entity?.name || '');
  }

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function levelNumber(entity) {
    return Math.max(1, Math.floor(safeNumber(entity?.level, 1)));
  }

  function enemyIncomingScalar(source, target) {
    if (!source || source.kind !== 'enemy') return 1;
    const level = levelNumber(source);
    const targetKind = String(target?.kind || '');
    if (targetKind === 'player') {
      if (level <= 2) return 0.64;
      if (level <= 4) return 0.72;
      if (level <= 6) return 0.82;
      return 0.90;
    }
    if (targetKind === 'merc' || targetKind === 'pet' || targetKind === 'bot') {
      if (level <= 4) return 0.78;
      return 0.88;
    }
    return 1;
  }

  function playerDamageCap(target, source) {
    if (!target || target.kind !== 'player' || !source || source.kind !== 'enemy') return Infinity;
    const level = levelNumber(source);
    const maxHp = Math.max(1, safeNumber(target.maxHp, 1));
    let cap;
    if (level <= 2) cap = Math.max(4, Math.floor(maxHp * 0.115));
    else if (level <= 4) cap = Math.max(5, Math.floor(maxHp * 0.145));
    else if (level <= 6) cap = Math.max(6, Math.floor(maxHp * 0.18));
    else cap = Math.max(8, Math.floor(maxHp * 0.24));
    const balance = DR.MOB_BALANCE || {};
    const eliteRare = !!(source.elite || source.rare || source.named || source.boss || source.rareNameplate || source.baseType?.elite || source.baseType?.rare || source.baseType?.named || source.baseType?.boss || source.baseType?.rareNameplate);
    const capMultiplier = eliteRare ? (Number(balance.eliteRareDamageCapMultiplier) || 1.24) : (Number(balance.standardDamageCapMultiplier) || 1.08);
    return Math.max(1, Math.floor(cap * capMultiplier));
  }

  const SPIDER_WEB_DIRECT_ROOT_SECONDS = 3.0;
  const SPIDER_WEB_TRAP_ROOT_SECONDS = 5.0;
  const SPIDER_WEB_TRAP_LIFETIME_MS = 10000;
  const SPIDER_WEB_HP = 100;
  const SPIDER_WEB_HIT_ROLL = 15;

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function spiderActorId(actor) {
    return String(actor?.id || actor?.botId || actor?.remoteId || actor?.name || 'actor').replace(/[^a-zA-Z0-9_:-]+/g, '_');
  }

  function spiderWebStatusIdFor(actor) {
    return `spider_web_root_${spiderActorId(actor).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  }

  function isSpiderEnemy(enemy = {}) {
    const type = enemy.baseType || enemy;
    const text = `${enemy.name || ''} ${type.name || ''} ${type.rendererId || ''} ${type.mobVisualKey || ''} ${type.visualKey || ''} ${type.family || ''} ${type.aiProfile || ''} ${type.threatTag || ''}`.toLowerCase();
    return Boolean(type.spiderFamily || enemy.spiderFamily || enemy.silkWebCavern || enemy.dungeonSpider || type.rendererId === 'spider')
      || /spider|widow|webling|webguard|skitterer|spinner|brood|silkfang|cocoon crawler|venomsac|venom sac|thorn widow|skirr|arakh/.test(text);
  }

  function activeMapSize(game) {
    const map = game?.map || [];
    const h = Array.isArray(map) ? map.length : 0;
    const w = h > 0 && Array.isArray(map[0]) ? map[0].length : 0;
    return { w, h };
  }

  function candidateTrapSpots(game, x, y) {
    const spots = [];
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.75 + Math.random() * 1.45;
      spots.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    spots.push({ x: x + 0.65, y: y + 0.35 }, { x: x - 0.55, y: y + 0.45 }, { x: x, y: y });
    return spots;
  }

  function friendlyWebVictims(game) {
    const list = [];
    const add = actor => {
      if (!actor || actor.alive === false || !Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) return;
      if (!list.includes(actor)) list.push(actor);
    };
    add(game?.player);
    add(game?.merc);
    add(game?.pet);
    for (const bot of game?.botPlayers || []) {
      if (bot && (bot.zone || 'overworld') === (game?.currentZone || 'overworld') && game?.isBotInParty?.(bot)) add(bot);
    }
    for (const remote of game?.remotePlayers?.values?.() || []) {
      if (remote && game?.isPartyActor?.(remote)) add(remote);
    }
    return list;
  }

  function webAttackAlliesFor(game, trapped) {
    const allies = [];
    const add = actor => {
      if (!actor || actor === trapped || actor.alive === false) return;
      if (!Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) return;
      if (!allies.includes(actor)) allies.push(actor);
    };
    if (trapped === game?.player || game?.isPartyActor?.(trapped) || trapped === game?.merc || trapped === game?.pet) {
      add(game?.pet);
      add(game?.merc);
      for (const bot of game?.botPlayers || []) if (game?.isBotInParty?.(bot) && (bot.zone || 'overworld') === (game?.currentZone || 'overworld')) add(bot);
    }
    return allies;
  }

  function inferDamageType(source, options = {}) {
    if (options.damageType) return options.damageType;
    const className = String(source?.className || '').toLowerCase();
    if (['cleric', 'druid', 'summoner', 'necromancer', 'enchanter'].includes(className)) return 'magic';
    return 'physical';
  }

  function applyOutgoingDamageStats(source, rawDamage, damageType) {
    const amount = safeNumber(rawDamage, 0);
    if (!source || source.kind === 'enemy') return amount;
    let multiplier = DR.StatSystem?.outgoingMultiplier?.(source, damageType) || 1;
    if (Array.isArray(source.buffs)) {
      for (const effect of source.buffs) {
        if (!effect || effect.remaining <= 0) continue;
        if (Number(effect.damageDoneMultiplier || 0) > 0) multiplier *= Number(effect.damageDoneMultiplier);
        if (damageType === 'holy' && Number(effect.holyDamageMultiplier || 0) > 0) multiplier *= Number(effect.holyDamageMultiplier);
      }
    }
    return amount * multiplier;
  }

  function rollCrit(source, damageType, options = {}) {
    if (!source || source.kind === 'enemy' || options.canCrit === false || options.isPeriodic) return { crit: false, multiplier: 1 };
    const profile = DR.StatSystem?.critProfile?.(source, damageType) || { chance: 0, multiplier: 1.5 };
    const chance = Math.max(0, Math.min(1, safeNumber(profile.chance, 0)));
    if (chance <= 0 || Math.random() >= chance) return { crit: false, multiplier: 1 };
    return { crit: true, multiplier: Math.max(1, safeNumber(profile.multiplier, 1.5)) };
  }

  function finalDamageColor(color, crit) {
    return crit ? '#ffd86a' : color;
  }


  const AUTO_ATTACK_RANGED_WEAPON_TOKENS = Object.freeze(['bow', 'crossbow', 'wand', 'staff', 'scepter', 'rod', 'orb', 'focus', 'book', 'grimoire', 'totem', 'symbol', 'skull', 'crystal']);
  const AUTO_ATTACK_MELEE_WEAPON_TOKENS = Object.freeze(['sword', 'blade', 'axe', 'mace', 'hammer', 'dagger', 'knife', 'spear', 'polearm', 'greatsword', 'greataxe', 'fist', 'claw', 'knuckle']);
  const PLAYER_AUTO_ATTACK_MELEE_CLASSES = Object.freeze(new Set(['bard', 'rogue', 'fighter', 'warrior']));
  const PLAYER_AUTO_ATTACK_CASTER_CLASSES = Object.freeze(new Set(['enchanter', 'druid', 'necromancer', 'cleric', 'summoner', 'mage', 'priest']));

  function normalizedAutoAttackClassName(actor = {}) {
    const text = String(actor.className || actor.playerClass || actor.classId || actor.role || actor.type || '').toLowerCase().replace(/[\s_\-]/g, '');
    const role = String(actor.roleKey || '').toLowerCase().replace(/[\s_\-]/g, '');
    if (text.includes('bard')) return 'bard';
    if (text.includes('warden')) return 'warden';
    if (text.includes('ranger') || text.includes('hunter') || text.includes('archer')) return 'ranger';
    if (text.includes('rogue') || role === 'scout') return 'rogue';
    if (text.includes('assassin')) return 'assassin';
    if (text.includes('fighter') || text.includes('warrior') || role === 'guardian' || text.includes('guardian')) return 'fighter';
    if (text.includes('enchanter') || text.includes('illusion') || text.includes('mesmer')) return 'enchanter';
    if (text.includes('druid')) return 'druid';
    if (text.includes('necromancer') || text.includes('necro')) return 'necromancer';
    if (text.includes('cleric') || text.includes('priest') || role === 'cleric' || role === 'fieldcleric') return 'cleric';
    if (text.includes('summoner') || role === 'adept') return 'summoner';
    return text || 'fighter';
  }

  function autoAttackClassRole(actor = {}) {
    const cls = normalizedAutoAttackClassName(actor);
    if (PLAYER_AUTO_ATTACK_MELEE_CLASSES.has(cls)) return { className: cls, role: 'melee' };
    if (PLAYER_AUTO_ATTACK_CASTER_CLASSES.has(cls)) return { className: cls, role: 'caster' };
    const identity = DR.getClassCombatIdentity?.(actor?.className) || {};
    const style = String(actor?.combatStyle || identity.combatStyle || '').toLowerCase();
    if (style.includes('rangedweapon') || cls === 'ranger' || cls === 'assassin') return { className: cls, role: 'rangedWeapon' };
    if (style.includes('ranged') || style.includes('caster')) return { className: cls, role: 'caster' };
    return { className: cls, role: 'melee' };
  }


  function autoAttackWeaponText(item) {
    if (!item) return '';
    return [
      item.weaponType,
      item.weaponFamily,
      item.family,
      item.subtype,
      item.category,
      item.type,
      item.slot,
      item.name,
      item.id,
      Array.isArray(item.tags) ? item.tags.join(' ') : item.tags,
      item.icon?.family,
      item.icon?.glyph
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function inferWeaponAttackMode(item) {
    const text = autoAttackWeaponText(item);
    if (!text) return '';
    for (const token of AUTO_ATTACK_RANGED_WEAPON_TOKENS) {
      if (new RegExp(`\b${token}\b`).test(text) || text.includes(token)) return token === 'bow' || token === 'crossbow' ? 'rangedWeapon' : 'rangedCaster';
    }
    for (const token of AUTO_ATTACK_MELEE_WEAPON_TOKENS) {
      if (new RegExp(`\b${token}\b`).test(text) || text.includes(token)) return 'melee';
    }
    return '';
  }

  const MELEE_AUTO_ATTACK_IMPACT_PHASE = 0.58;
  const MELEE_AUTO_ATTACK_DURATION_FRACTION = 0.72;

  function clamp01(value) {
    return Math.max(0, Math.min(1, safeNumber(value, 0)));
  }

  function easeOutCubic01(value) {
    const p = clamp01(value);
    return 1 - Math.pow(1 - p, 3);
  }

  function easeInOutCubic01(value) {
    const p = clamp01(value);
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  function meleeSwingVisualDurationSeconds(interval, className = '') {
    const cls = String(className || '').toLowerCase();
    const base = Math.max(0.25, safeNumber(interval, 2.5));
    const styleScale = cls === 'rogue' ? 0.56 : cls === 'fighter' ? 0.82 : cls === 'warden' ? 0.78 : cls === 'paladin' ? 0.72 : cls === 'bard' ? 0.60 : 0.70;
    return Math.max(0.34, Math.min(base, base * MELEE_AUTO_ATTACK_DURATION_FRACTION * styleScale));
  }

  function meleeSwingPulse(phase, className = '') {
    const p = clamp01(phase);
    const cls = String(className || '').toLowerCase();
    const heavy = cls === 'fighter' || cls === 'warden';
    const quick = cls === 'rogue' || cls === 'bard';
    // V0.16.88: full wind-up correction. The impact phase remains 0.58 so
    // real auto-attack damage still lines up with the visual hit, but the
    // visible motion now spends longer lifting high, then drops faster/lower.
    if (p < 0.35) return easeOutCubic01(p / 0.35) * (quick ? 0.56 : heavy ? 0.82 : 0.72);
    if (p < 0.58) return (quick ? 0.52 : heavy ? 0.74 : 0.64) + easeInOutCubic01((p - 0.35) / 0.23) * (quick ? 0.48 : heavy ? 0.36 : 0.40);
    if (p < 0.68) return 1;
    return Math.max(0, 1 - easeOutCubic01((p - 0.68) / 0.32)) * (quick ? 0.42 : 0.56);
  }

  function autoAttackAnimationPulse(phase, ranged, className = '') {
    const p = clamp01(phase);
    if (ranged) {
      const gather = p < 0.68 ? Math.sin((p / 0.68) * Math.PI * 0.5) * 0.72 : 0.72;
      const release = p >= 0.68 ? Math.sin(((p - 0.68) / 0.32) * Math.PI) * 0.45 : 0;
      return Math.max(0.16, Math.min(1, gather + release));
    }
    return Math.max(0.08, Math.min(1, meleeSwingPulse(p, className)));
  }

  DR.CombatSystem = {
    install(Game) {
      Game.prototype.regen = function(dt) {
        // Passive regen is intentionally limited. Bots and mercenaries recover HP/MP
        // only through meditation or explicit heals/potions/status effects.
        const allies = [this.player, this.pet].filter(Boolean);
        for (const a of allies) {
          if (!a.alive) continue;
          if (Number.isFinite(a.maxMana) && a.maxMana > 0) {
            const classKey = String(a.className || '').toLowerCase();
            const fighterUsingStamina = a.kind === 'player' && classKey === 'fighter';
            const inCombat = Number(a.combatCooldown || 0) > 0 || Boolean(a.autoAttack || a.autoAttackToggle);
            const rate = fighterUsingStamina ? (inCombat ? 8 : 18) : (a.kind === 'player' ? 1.9 : 0.65);
            // Phase 8a: optional per-class manaRegen stat, additive on top of the
            // existing baseline rate. No class sets it today, so this is 0 and
            // behavior is unchanged. Fighter intentionally reuses the same actor
            // numeric mana field as Stamina while all player-facing labels say Stamina.
            a.mana = clamp(a.mana + dt * (rate + (fighterUsingStamina ? 0 : (a.manaRegen || 0))), 0, a.maxMana);
          }
          // Phase 8a: optional per-class hpRegen stat (Intersect parity). No
          // class opts in today, so this branch is a true no-op until one does.
          if (Number.isFinite(a.maxHp) && a.maxHp > 0 && a.hpRegen > 0) {
            a.hp = clamp(a.hp + dt * a.hpRegen, 0, a.maxHp);
          }
        }
      };

      Game.prototype.updateTargetValidity = function() {
        const target = this.getTarget();
        if (!target || !target.alive) {
          if (this.player) {
            this.player.targetId = null;
            this.player.autoAttack = false;
            this.player.autoAttackToggle = false;
            this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
          }
        }
      };

      Game.prototype.lowestAlly = function() {
        const partyCandidates = this.getPartyHealingCandidates?.(this.player, { range: 18 }) || [];
        if (partyCandidates.length) return partyCandidates[0].actor;
        const candidates = [this.player, this.merc, this.pet].filter(a => a && a.alive);
        candidates.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        return candidates[0] || null;
      };

      Game.prototype.pickEnemyTarget = function(enemy) {
        if (!enemy || !enemy.alive) return null;
        const silkGate = DR.SilkWebEncounterGate;
        const silkBossGate = silkGate?.isBossLike?.(enemy) ? silkGate : null;
        const currentZone = this.currentZone || 'overworld';
        const isCurrentZoneActor = actor => {
          if (!alive(actor)) return false;
          const kind = String(actor.kind || '').toLowerCase();
          if (kind === 'bot' || kind === 'remote') return (actor.zone || 'overworld') === currentZone;
          return true;
        };
        const baseAggro = enemy.effectiveAggroRadius?.(this, null) || Number(enemy.baseType?.aggroRadius) || 6;
        const leash = Number(enemy.baseType?.leashRadius) || 14;
        const maxEngageRange = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0
          ? Math.min(14, leash + 1.5)
          : Math.min(9.5, baseAggro + 1.35);
        const actorScore = actor => {
          const d = dist(enemy, actor);
          if (!Number.isFinite(d) || d > maxEngageRange) return Infinity;
          let score = d;
          const kind = String(actor.kind || '').toLowerCase();
          if ((actor.combatCooldown || 0) > 0 || actor.autoAttack) score -= 0.65;
          if (kind === 'bot' && this.isBotInParty?.(actor)) score -= 0.25;
          // V0.17.99: smarter target priority - lower score = more attractive. Finish
          // wounded targets (stronger the closer to death) and favor squishier targets
          // (low max HP = caster/healer) over tanks. Distance still dominates so a mob
          // won't ignore whoever is actually meleeing it.
          const hpFrac = Number(actor.hp || 0) / Math.max(1, Number(actor.maxHp || 1));
          score -= (1 - hpFrac) * 1.1;
          score += Math.min(0.9, Number(actor.maxHp || 0) / 700);
          return score;
        };

        const hasStoredThreat = Object.values(enemy.threatTable || {}).some(entry => Number(entry?.threat || 0) > 0.05);
        const threatTarget = this.getThreatTarget?.(enemy);
        if (isCurrentZoneActor(threatTarget) && actorScore(threatTarget) < Infinity && (!silkBossGate || silkBossGate.canAcquireTarget?.(this, enemy, threatTarget, { source: 'threat-target' }) !== false)) return threatTarget;
        if (hasStoredThreat) return null;

        const partyActors = this.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor: enemy, range: maxEngageRange })?.map(entry => entry.actor) || [];
        const localActors = [this.player, this.merc, this.pet].filter(Boolean);
        const botActors = (this.botPlayers || []).flatMap(bot => {
          const list = [];
          if (bot && bot.alive && bot.zone === currentZone && dist(enemy, bot) <= maxEngageRange) list.push(bot);
          if (bot?.botPet && bot.botPet.alive !== false && dist(enemy, bot.botPet) <= maxEngageRange) list.push(bot.botPet);
          return list;
        });
        const bossArena = enemy.bossArena || enemy.encounterArena || null;
        const bossRoomAcquireRange = silkBossGate && bossArena
          ? Math.max(baseAggro + 0.75, Math.hypot(Number(bossArena.w || 8) * 0.5, Number(bossArena.h || 8) * 0.5) + 3.0)
          : baseAggro + 0.75;
        const candidates = [...partyActors, ...localActors, ...botActors]
          .filter((actor, index, list) => isCurrentZoneActor(actor) && list.indexOf(actor) === index)
          .filter(actor => dist(enemy, actor) <= bossRoomAcquireRange)
          .filter(actor => !silkBossGate || silkBossGate.canAcquireTarget?.(this, enemy, actor, { source: 'proximity-target' }) !== false)
          .map(actor => ({ actor, score: actorScore(actor) }))
          .filter(entry => entry.score < Infinity)
          .sort((a, b) => a.score - b.score);
        return candidates[0]?.actor || null;
      };

      Game.prototype.nearestEnemy = function(x, y, range = Infinity) {
        let best = null;
        let bestDSq = Number.isFinite(range) ? range * range : Infinity;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          const dSq = dx * dx + dy * dy;
          if (dSq < bestDSq) {
            best = e;
            bestDSq = dSq;
          }
        }
        return best;
      };

      Game.prototype.isFriendlyTarget = function(actor) {
        if (!actor || !actor.alive) return false;
        const kind = actorKind(actor);
        if (!FRIENDLY_COMBAT_KINDS.has(kind)) return false;
        if (kind === 'remote') return this.isPartyActor?.(actor) === true;
        if (kind === 'bot') return (actor.zone || 'overworld') === (this.currentZone || 'overworld');
        return true;
      };

      Game.prototype.isFriendlyCombatActor = function(actor) {
        return isFriendlyCombatKind(actor);
      };

      Game.prototype.isFriendlyFireBlocked = function(source, target, options = {}) {
        if (!source || !target) return false;
        return isFriendlyCombatKind(source) && isFriendlyCombatKind(target);
      };

      Game.prototype.rejectFriendlyHostileAction = function(source, target, options = {}) {
        if (!this.isFriendlyFireBlocked?.(source, target, options)) return false;
        if (source === this.player || options.playerInitiated === true) this.logCombat?.('Cannot attack friendly target.');
        if (source === this.player && this.player) {
          this.player.autoAttack = false;
          this.player.autoAttackToggle = false;
          this.player.autoAttackAutoEngaged = false;
          this.clearPlayerAutoAttackVisualState?.(this.player);
        }
        return true;
      };

      Game.prototype.canActorUseHostileActionOn = function(source, target, options = {}) {
        if (!alive(source) || !alive(target)) return false;
        if (this.isFriendlyFireBlocked?.(source, target, options)) return false;
        if (isFriendlyCombatKind(source)) {
          if (this.isHostileTarget?.(target) !== true) return false;
          const silkGate = DR.SilkWebEncounterGate;
          if (silkGate?.isBossLike?.(target) && silkGate.canAcquireTarget?.(this, target, source, { source: 'friendly-hostile-action' }) === false) return false;
          return true;
        }
        if (actorKind(source) === 'enemy') return isFriendlyCombatKind(target);
        return false;
      };

      Game.prototype.isHostileTarget = function(actor) {
        return Boolean(actor && actor.alive && String(actor.kind || '').toLowerCase() === 'enemy');
      };

      // Phase 3 (Combat/Spell Parity): canonical hostile-target validator.
      // Consolidates the friendly-fire/hostile/range checks that used to be
      // duplicated (with subtly different copies) across
      // spell-system.js's getNecromancerHostileTarget, canCastClassSpell,
      // and the requireTarget closure in resolveClassSpell. Pure - does not
      // set facing or mutate state, so it is safe to call from a preflight
      // check (canCastClassSpell) as well as from the actual cast resolver.
      // Behavior (message text, resolution order, range comparison) is
      // unchanged from what those three call sites already did.
      Game.prototype.resolveHostileSpellTarget = function(spell, candidate, options = {}) {
        const spellName = spell?.name || 'That';
        const range = Number.isFinite(options.range) ? options.range : Number(spell?.range || 7);
        if (candidate && this.isFriendlyCombatActor?.(candidate)) {
          if (options.silent !== true) this.logCombat?.('Cannot attack friendly target.');
          return { ok: false, reason: 'friendly', target: null };
        }
        const target = (candidate && candidate.alive && this.isHostileTarget?.(candidate)) ? candidate : this.getOffensiveTarget?.();
        if (!target || !target.alive || !this.isHostileTarget?.(target)) {
          if (options.silent !== true) this.log(`No hostile target for ${spellName}.`);
          return { ok: false, reason: 'no-target', target: null };
        }
        if (Number.isFinite(range) && range > 0 && this.player && dist(this.player, target) > range) {
          if (options.silent !== true) this.log(`${spellName} is out of range.`);
          return { ok: false, reason: 'range', target: null };
        }
        return { ok: true, reason: null, target };
      };

      Game.prototype.friendlyTargetActors = function(options = {}) {
        const currentZone = this.currentZone || 'overworld';
        const actors = [];
        if (options.includePlayer !== false) actors.push(this.player);
        if (options.includeMerc !== false) actors.push(this.merc);
        if (options.includePet !== false) actors.push(this.pet);
        for (const bot of this.botPlayers || []) {
          if (bot && bot.alive && (bot.zone || 'overworld') === currentZone) actors.push(bot);
        }
        if (options.includeRemote !== false) {
          for (const id of this.partyMembers || []) {
            if (String(id) === String(this.localPeerId)) continue;
            const remote = this.remotePlayers?.get?.(id);
            if (remote && remote.alive && (remote.zone || 'overworld') === currentZone) actors.push(remote);
          }
        }
        return actors.filter((actor, index, list) => this.isFriendlyTarget?.(actor) && list.indexOf(actor) === index);
      };

      Game.prototype.isSpiderMob = function(enemy) {
        return isSpiderEnemy(enemy);
      };

      Game.prototype.spiderWebStatusIdFor = function(actor) {
        return spiderWebStatusIdFor(actor);
      };

      Game.prototype.applySpiderBreakableWebRoot = function(target, source = null, durationSeconds = SPIDER_WEB_DIRECT_ROOT_SECONDS, options = {}) {
        if (!target || target.alive === false) return null;
        const now = nowMs();
        const seconds = Math.max(0.25, safeNumber(durationSeconds, SPIDER_WEB_DIRECT_ROOT_SECONDS));
        const webId = `spider_web_${spiderActorId(target)}_${Math.floor(now)}`;
        const web = {
          id: webId,
          type: 'spiderBreakableWeb',
          targetId: target.id || target.botId || target.name || 'actor',
          targetName: target.name || 'target',
          sourceId: source?.id || source?.name || null,
          sourceName: source?.name || 'Spider Web',
          mode: options.mode || 'direct',
          hp: SPIDER_WEB_HP,
          maxHp: SPIDER_WEB_HP,
          appliedAt: now,
          expiresAt: now + seconds * 1000,
          duration: seconds,
          lastAssistPulseAt: 0,
          previousTargetId: target.targetId || null,
          trapObjectId: options.trapObjectId || null
        };
        target.activeSpiderWeb = web;
        target.webbedOverlayUntil = web.expiresAt;
        target.slowedUntil = Math.max(target.slowedUntil || 0, web.expiresAt);
        target.currentActivityLabel = 'Webbed';
        this.applyStatusEffect?.(target, {
          id: spiderWebStatusIdFor(target),
          name: 'Spider Web',
          type: 'control',
          duration: seconds,
          tags: ['root', 'web'],
          mods: { speed: -999 },
          color: '#d8dbe2',
          hostile: true,
          sourceName: source?.name || 'Spider Web',
          maxStacks: 1,
          description: `Wrapped in breakable spider webbing. The web has ${SPIDER_WEB_HP} HP and breaks automatically after ${seconds.toFixed(0)} seconds.`
        }, source || { kind: 'enemy', name: 'Spider Web' });
        this.spawnRing?.(target.x, target.y, '#e7e4ef', 18);
        this.spawnStatusPulse?.(target, '#e7e4ef', 'Webbed');
        this.playSfx?.('hit_thud', { x: target.x, y: target.y, volume: 0.32, rate: 1.28, cooldown: 0.08 });
        this.logCombat?.(`${target.name || 'Target'} is trapped in spider webbing.`);
        return web;
      };

      Game.prototype.releaseSpiderBreakableWeb = function(target, reason = 'expired') {
        if (!target?.activeSpiderWeb) return false;
        const web = target.activeSpiderWeb;
        target.activeSpiderWeb = null;
        target.webbedOverlayUntil = 0;
        if (target.currentActivityLabel === 'Webbed') target.currentActivityLabel = reason === 'broken' ? 'Freed' : '';
        this.removeStatusEffect?.(target, spiderWebStatusIdFor(target));
        this.spawnRing?.(target.x, target.y, reason === 'broken' ? '#ffffff' : '#d8dbe2', reason === 'broken' ? 20 : 14);
        this.spawnCombatImpact?.(target, '#e8e6ef', reason === 'broken' ? 1.2 : 0.7, 'web');
        this.playSfx?.('attack_slash', { x: target.x, y: target.y, volume: 0.24, rate: 1.48, cooldown: 0.08 });
        for (const actor of webAttackAlliesFor(this, target)) {
          if (actor.currentActivityLabel === 'Breaking Web') actor.currentActivityLabel = '';
          if (actor.spiderWebAssistTargetId === web.id) actor.spiderWebAssistTargetId = null;
        }
        return true;
      };

      Game.prototype.damageSpiderBreakableWeb = function(target, amount = 1, source = null) {
        const web = target?.activeSpiderWeb;
        if (!web) return 0;
        const damage = Math.max(1, Math.floor(safeNumber(amount, 1)));
        web.hp = Math.max(0, safeNumber(web.hp, SPIDER_WEB_HP) - damage);
        this.spawnDamageText?.(target.x, target.y - 0.35, `WEB -${damage}`, '#e8e6ef', 0.7);
        this.spawnCombatImpact?.(target, '#e8e6ef', 0.65, 'web');
        if (web.hp <= 0) this.releaseSpiderBreakableWeb?.(target, 'broken');
        return damage;
      };

      Game.prototype.selectedSpiderWebTargetActor = function() {
        const selected = String(this.player?.spiderWebTargetId || '');
        if (!selected) return null;
        return friendlyWebVictims(this).find(actor => actor?.activeSpiderWeb && String(actor.activeSpiderWeb.id) === selected) || null;
      };

      Game.prototype.selectSpiderWebTarget = function(actor, options = {}) {
        if (!this.player || !actor?.activeSpiderWeb) return false;
        this.player.spiderWebTargetId = actor.activeSpiderWeb.id;
        this.player.targetId = null;
        this.player.autoAttack = false;
        this.player.autoAttackToggle = false;
        this.player.autoAttackAutoEngaged = false;
        this.clearPlayerAutoAttackVisualState?.(this.player);
        if (!options.silent) this.logCombat?.(`Targeting web on ${actor.name || 'ally'}.`);
        return true;
      };

      Game.prototype.pickSpiderWebAtScreen = function(sx, sy) {
        const actors = friendlyWebVictims(this).filter(actor => actor?.activeSpiderWeb);
        return this.pickTargetableEntityAtScreen?.(sx, sy, actors, { friendly: true, hitPaddingPx: 22 }) || null;
      };

      Game.prototype.spiderWebTargetCandidates = function(range = 14.5) {
        if (!this.player?.alive) return [];
        const maxSq = range * range;
        return friendlyWebVictims(this)
          .filter(actor => actor?.activeSpiderWeb && actor.alive !== false)
          .map(actor => {
            const dx = actor.x - this.player.x;
            const dy = actor.y - this.player.y;
            return { actor, dSq: dx * dx + dy * dy, angle: Math.atan2(dy, dx) };
          })
          .filter(entry => entry.dSq <= maxSq)
          .sort((a, b) => a.dSq - b.dSq || a.angle - b.angle)
          .map(entry => entry.actor);
      };

      Game.prototype.placeSpiderWebGroundTrap = function(source, target) {
        if (!target || !this.objects || !this.map) return null;
        const size = activeMapSize(this);
        if (!size.w || !size.h) return null;
        let chosen = null;
        for (const spot of candidateTrapSpots(this, target.x, target.y)) {
          const tx = Math.floor(spot.x);
          const ty = Math.floor(spot.y);
          if (tx < 1 || ty < 1 || tx >= size.w - 1 || ty >= size.h - 1) continue;
          if (!this.isWalkable?.(tx + 0.5, ty + 0.5, this.player)) continue;
          const occupied = this.objects?.[ty]?.[tx];
          if (occupied && !['webHazard', 'venomSackBurst'].includes(String(occupied.type || ''))) continue;
          chosen = { x: tx, y: ty };
          break;
        }
        if (!chosen) return null;
        const now = nowMs();
        const trap = {
          type: 'webHazard',
          id: `spider_web_trap_${Math.floor(now)}_${Math.floor(Math.random() * 9999)}`,
          objectId: `spider_web_trap_${Math.floor(now)}`,
          name: 'Spider Web Trap',
          hazardKind: 'spider_web_projectile_trap',
          sourceId: source?.id || source?.name || null,
          sourceName: source?.name || 'Spider',
          x: chosen.x, y: chosen.y,
          color: '#e8e6ef',
          breakAfterSeconds: SPIDER_WEB_TRAP_ROOT_SECONDS,
          holdSeconds: SPIDER_WEB_TRAP_ROOT_SECONDS,
          triggerRadius: 0.95,
          visualRadius: 0.95,
          destructible: true,
          maxHp: SPIDER_WEB_HP,
          hp: SPIDER_WEB_HP,
          temporarySpiderWebTrap: true,
          createdAt: now,
          expiresAt: now + SPIDER_WEB_TRAP_LIFETIME_MS,
          fadeAfterMs: SPIDER_WEB_TRAP_LIFETIME_MS
        };
        if (!this.objects[chosen.y]) this.objects[chosen.y] = [];
        this.objects[chosen.y][chosen.x] = trap;
        if (this.dungeonObjects && this.dungeonObjects !== this.objects) {
          if (!this.dungeonObjects[chosen.y]) this.dungeonObjects[chosen.y] = [];
          this.dungeonObjects[chosen.y][chosen.x] = trap;
        }
        if (!Array.isArray(this.activeSpiderWebTraps)) this.activeSpiderWebTraps = [];
        this.activeSpiderWebTraps.push(trap);
        this.spawnRing?.(chosen.x + 0.5, chosen.y + 0.5, '#e8e6ef', 13);
        this.playSfx?.('hit_thud', { x: chosen.x + 0.5, y: chosen.y + 0.5, volume: 0.22, rate: 1.62, cooldown: 0.08 });
        return trap;
      };

      Game.prototype.trySpiderMobWebAttack = function(enemy, target, distance = Infinity) {
        if (!enemy || !target || enemy.alive === false || target.alive === false) return false;
        if (!isSpiderEnemy(enemy)) return false;
        if (!this.isFriendlyCombatActor?.(target)) return false;
        if (target.activeSpiderWeb) return false;
        enemy.spiderWebCooldown = Math.max(0, safeNumber(enemy.spiderWebCooldown, 0));
        if (enemy.spiderWebCooldown > 0) return false;
        const maxRange = Math.max(5.5, Math.min(8.0, safeNumber(enemy.range, 1.35) + 5.0));
        const d = Number.isFinite(Number(distance)) ? distance : combatDistance(enemy, target);
        if (d > maxRange) return false;
        enemy.spiderWebCooldown = 8 + Math.random() * 4;
        enemy.spiderWebCastAnim = 0.85;
        enemy.attackAnim = Math.max(enemy.attackAnim || 0, 0.72);
        enemy.setFacingFromDelta?.(target.x - enemy.x, target.y - enemy.y);
        this.spawnCastCue?.(enemy, '#e8e6ef', 'Web');
        this.addEffect?.({ type: 'spiderWebProjectile', x: enemy.x, y: enemy.y, x2: target.x, y2: target.y, color: '#e8e6ef', t: 0, life: 0.34 });
        this.playSfx?.('magic_cast', { x: enemy.x, y: enemy.y, volume: 0.22, rate: 1.36, cooldown: 0.12 });
        if (Math.floor(Math.random() * SPIDER_WEB_HIT_ROLL) === 0) {
          this.applySpiderBreakableWebRoot?.(target, enemy, SPIDER_WEB_DIRECT_ROOT_SECONDS, { mode: 'direct' });
          this.logCombat?.(`${enemy.name || 'Spider'} webs ${target.name || 'target'} directly.`);
        } else {
          const trap = this.placeSpiderWebGroundTrap?.(enemy, target);
          if (trap) this.logCombat?.(`${enemy.name || 'Spider'} fires a web that splats onto the ground.`);
        }
        return true;
      };

      Game.prototype.updateSpiderWebRuntime = function(dt) {
        const now = nowMs();
        const safeDt = Math.max(0, Math.min(0.12, safeNumber(dt, 0)));
        const victims = friendlyWebVictims(this);
        for (const actor of victims) {
          const web = actor.activeSpiderWeb;
          if (!web) continue;
          if (actor.alive === false || safeNumber(web.hp, 0) <= 0 || now >= safeNumber(web.expiresAt, now)) {
            this.releaseSpiderBreakableWeb?.(actor, safeNumber(web.hp, 0) <= 0 ? 'broken' : 'expired');
          }
        }

        const traps = Array.isArray(this.activeSpiderWebTraps) ? this.activeSpiderWebTraps : (this.activeSpiderWebTraps = []);
        let write = 0;
        for (let i = 0; i < traps.length; i++) {
          const trap = traps[i];
          if (!trap || trap.removed === true) continue;
          if (trap.broken === true && now - safeNumber(trap.brokenAt, now) > 1200) {
            if (this.objects?.[trap.y]?.[trap.x] === trap) this.objects[trap.y][trap.x] = null;
            if (this.dungeonObjects?.[trap.y]?.[trap.x] === trap) this.dungeonObjects[trap.y][trap.x] = null;
            trap.removed = true;
            continue;
          }
          if (trap.triggered !== true && now >= safeNumber(trap.expiresAt, now + 1)) {
            trap.broken = true;
            trap.brokenAt = now;
            trap.breakReason = 'expired';
            trap.name = 'Fading Web Splat';
            trap.color = '#9f9aa8';
            traps[write++] = trap;
            continue;
          }
          if (trap.triggered !== true && trap.broken !== true) {
            const radius = Math.max(0.45, safeNumber(trap.triggerRadius, 0.95));
            for (const target of victims) {
              if (!target || target.activeSpiderWeb || target.alive === false) continue;
              if (combatDistance(target, { x: trap.x + 0.5, y: trap.y + 0.5 }) > radius) continue;
              trap.triggered = true;
              trap.broken = true;
              trap.brokenAt = now;
              trap.breakReason = 'triggered';
              trap.name = 'Snapped Web Splat';
              trap.color = '#8f82aa';
              if (this.objects?.[trap.y]?.[trap.x] === trap) this.objects[trap.y][trap.x] = null;
              if (this.dungeonObjects?.[trap.y]?.[trap.x] === trap) this.dungeonObjects[trap.y][trap.x] = null;
              this.applySpiderBreakableWebRoot?.(target, { kind: 'enemy', name: trap.sourceName || 'Spider Web' }, SPIDER_WEB_TRAP_ROOT_SECONDS, { mode: 'trap', trapObjectId: trap.id });
              this.spawnRing?.(trap.x + 0.5, trap.y + 0.5, '#e8e6ef', 16);
              break;
            }
          }
          if (trap.removed !== true) traps[write++] = trap;
        }
        traps.length = write;

        for (const trapped of victims) {
          const web = trapped?.activeSpiderWeb;
          if (!web) continue;
          for (const ally of webAttackAlliesFor(this, trapped)) {
            const identity = this.getActorAutoAttackIdentity?.(ally) || { range: safeNumber(ally.range, 1.35), damageType: 'physical' };
            const range = Math.max(1.25, safeNumber(identity.range, safeNumber(ally.range, 1.35)));
            if (combatDistance(ally, trapped) > range + 0.65) continue;
            ally.spiderWebAssistTimer = Math.max(0, safeNumber(ally.spiderWebAssistTimer, 0) - safeDt);
            if (ally.spiderWebAssistTimer > 0) continue;
            const attack = typeof ally.getStat === 'function' ? ally.getStat('attack') : safeNumber(ally.attack, 8);
            const dmg = Math.max(8, Math.floor(attack * 0.72 + safeNumber(ally.level, 1) * 0.65));
            ally.spiderWebAssistTimer = this.getAutoAttackIntervalSeconds?.(ally, { fallbackSeconds: 1.8, source: 'spider-web-assist' }) || 1.8;
            ally.spiderWebAssistTargetId = web.id;
            ally.currentActivityLabel = 'Breaking Web';
            ally.setFacingFromDelta?.(trapped.x - ally.x, trapped.y - ally.y);
            this.spawnSlash?.(ally, trapped, '#e8e6ef', 'slash');
            this.damageSpiderBreakableWeb?.(trapped, dmg, ally);
          }
        }
      };

      Game.prototype.getTarget = function() {
        if (!this.player || !this.player.targetId) return null;
        const id = this.player.targetId;
        const target = (this.enemies || []).find(e => e.id === id && e.alive)
          || this.friendlyTargetActors?.().find(actor => actor.id === id && actor.alive)
          || null;
        if (target) return target;
        const knownFriendly = [this.player, this.merc, this.pet, ...(this.botPlayers || []), ...Array.from(this.remotePlayers?.values?.() || [])]
          .find(actor => actor?.id === id || String(actor?.botId || actor?.remoteId || '') === String(id));
        return knownFriendly && this.isPartyActor?.(knownFriendly) ? knownFriendly : null;
      };

      Game.prototype.getOffensiveTarget = function() {
        const target = this.getTarget?.();
        return this.isHostileTarget?.(target) ? target : null;
      };

      Game.prototype.getFriendlySpellTarget = function(range = 18) {
        const target = this.getTarget?.();
        if (this.isFriendlyTarget?.(target) && (!this.player || Math.hypot(target.x - this.player.x, target.y - this.player.y) <= range)) return target;
        return null;
      };

      Game.prototype.activeThreatsForEntity = function(entity = this.player) {
        if (!alive(entity)) return [];
        const threats = [];
        const enemies = this.queryEnemiesNearEntity?.(entity, 14) || (Array.isArray(this.enemies) ? this.enemies : []);
        for (const enemy of enemies) {
          if (!alive(enemy)) continue;
          const d = dist(entity, enemy);
          const enemyRange = Math.max(1.1, safeNumber(enemy.range, 1.5));
          const activeReach = enemyRange + 0.95;
          const target = typeof this.pickEnemyTarget === 'function' ? this.pickEnemyTarget(enemy) : null;
          const targetIsEntity = target === entity;
          const playerHasEnemyTargeted = entity.kind === 'player' && entity.autoAttack && entity.targetId === enemy.id && d <= 9.5;
          const recentEnemyAction = (enemy.combatCooldown || 0) > 0;
          const hostile = Boolean(enemy.aggro || enemy.hp < enemy.maxHp || recentEnemyAction || playerHasEnemyTargeted);
          if (!hostile) continue;

          // Actual combat lock requires a real threat: direct targeting and reach/recent action,
          // or the player actively attacking this enemy. Mere damaged enemies nearby no longer
          // keep meditation locked forever.
          if (playerHasEnemyTargeted) {
            threats.push(enemy);
            continue;
          }
          if (targetIsEntity && (recentEnemyAction || d <= activeReach)) {
            threats.push(enemy);
            continue;
          }
          if (entity.kind === 'merc' || entity.kind === 'pet') {
            if (targetIsEntity && d <= activeReach + 0.5) threats.push(enemy);
          }
        }
        return threats;
      };

      Game.prototype.clearStaleCombatState = function(entity = this.player, options = {}) {
        if (!entity) return true;
        const threats = this.activeThreatsForEntity?.(entity) || [];
        if (threats.length) return false;

        // Pet combat is primarily owner-assist driven.  The Bone Servant is rarely the
        // enemy's current target, so the generic stale-combat cleanup was clearing its
        // autoAttack/combat state every frame while the player was still attacking.
        // Treat a live owner target as active combat for pets and let Pet.update own
        // target release when the target dies, leashes, or the command changes.
        if (entity.kind === 'pet') {
          const byId = id => id == null ? null : (this.enemies || []).find(enemy => enemy && enemy.alive !== false && String(enemy.id) === String(id)) || null;
          const owner = entity.owner || this.player;
          const petTarget = entity.target || byId(entity.targetId) || byId(entity.forcedTargetId) || byId(owner?.targetId) || byId(owner?.combatTargetId) || this.getOffensiveTarget?.();
          const petTargetValid = petTarget && petTarget.alive !== false && this.isHostileTarget?.(petTarget);
          if (petTargetValid) {
            const ownerAttackingTarget = owner && String(owner.targetId ?? owner.combatTargetId ?? '') === String(petTarget.id ?? '') && (owner.autoAttack || Number(owner.combatCooldown || 0) > 0);
            const targetEngaged = petTarget.aggro || Number(petTarget.combatCooldown || 0) > 0 || Number(petTarget.hp || 0) < Number(petTarget.maxHp || petTarget.hp || 0);
            const petCloseEnoughToContinue = dist(entity, petTarget) <= (entity.hoveringPet ? 14.5 : 11.5);
            if (petCloseEnoughToContinue && (ownerAttackingTarget || targetEngaged || Number(entity.attackTimer || 0) > 0)) return false;
          }
        }

        entity.combatCooldown = 0;
        if (entity.kind === 'player') {
          const target = this.getTarget?.();
          const offensiveTarget = this.isHostileTarget?.(target) ? target : null;
          if (!offensiveTarget || dist(entity, offensiveTarget) > 9.5) {
            entity.autoAttack = false;
            entity.autoAttackToggle = false;
            entity.autoAttackAutoEngaged = false;
            if (!target || !this.isFriendlyTarget?.(target)) entity.targetId = null;
          }
        } else if (entity.kind === 'merc' || entity.kind === 'pet' || entity.kind === 'bot') {
          entity.autoAttack = false;
        }

        for (const enemy of (this.queryEnemiesNearEntity?.(entity, 16) || this.enemies || [])) {
          if (!enemy || !enemy.alive) continue;
          const d = dist(entity, enemy);
          const target = typeof this.pickEnemyTarget === 'function' ? this.pickEnemyTarget(enemy) : null;
          const enemyRange = Math.max(1.1, safeNumber(enemy.range, 1.5)) + 1.5;
          if (target === entity && d > enemyRange && (enemy.combatCooldown || 0) <= 0) {
            enemy.aggro = false;
          }
        }
        return true;
      };

      Game.prototype.isEntityInCombat = function(entity = this.player) {
        if (!alive(entity)) return false;
        const threats = this.activeThreatsForEntity?.(entity) || [];
        if (threats.length) return true;
        if ((entity.combatCooldown || 0) > 0) return !this.clearStaleCombatState?.(entity, { silent: true });
        return false;
      };

      Game.prototype.findCombatEnemyForPlayer = function(range = 8.5) {
        if (!this.player || !this.player.alive) return null;
        let best = null;
        let bestScore = Infinity;
        for (const enemy of (this.queryEnemiesNearEntity?.(this.player, range + 2) || this.enemies || [])) {
          if (!enemy || !enemy.alive) continue;
          const d = dist(this.player, enemy);
          if (d > range) continue;
          const hostile = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0;
          if (!hostile && d > 2.15) continue;
          const score = d + (hostile ? 0 : 3.5);
          if (score < bestScore) {
            best = enemy;
            bestScore = score;
          }
        }
        return best;
      };

      Game.prototype.beginAutoAttack = function(target, options = {}) {
        if (options.explicit !== true && options.manual !== true) return false;
        if (!this.player || !this.player.alive || !target || !target.alive) return false;
        if (!this.isHostileTarget?.(target)) {
          if (target.id != null) this.player.targetId = target.id;
          this.player.autoAttack = false;
          this.player.autoAttackToggle = false;
          this.player.autoAttackAutoEngaged = false;
          this.clearPlayerAutoAttackVisualState?.(this.player);
          if (!options.silent) this.logCombat?.('Cannot attack friendly target.');
          return false;
        }
        this.player.targetId = target.id;
        if (!this.player.autoAttack && !options.silent) this.logCombat(`Auto attack toggled on: ${target.name}.`);
        this.player.autoAttack = true;
        this.player.autoAttackToggle = true;
        this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
        target.aggro = true;
        this.addThreat?.(target, this.player, 6, { reason: 'auto-attack-engage', flatBonus: options.forceCooldown ? 4 : 0 });

        const d = dist(this.player, target);
        const playerIdentity = this.getActorAutoAttackIdentity?.(this.player) || { range: Number(this.player.range || 1.35) };
        const targetReach = Math.max(playerIdentity.range, Number(target.range || 1.5)) + 0.05;
        if (options.forceCooldown || d <= targetReach || (target.combatCooldown || 0) > 0) {
          target.combatCooldown = Math.max(target.combatCooldown || 0, 6.5);
          this.player.combatCooldown = Math.max(this.player.combatCooldown || 0, 6.5);
        }
        return true;
      };

      Game.prototype.endAutoAttackIfCombatEnded = function() {
        if (!this.player) return false;
        const target = this.getOffensiveTarget?.();
        const candidate = this.findCombatEnemyForPlayer(7.0);
        const inCombat = (this.player.combatCooldown || 0) > 0 || Boolean(target) || Boolean(candidate);
        if (inCombat) return false;
        if (this.player.autoAttack || this.getOffensiveTarget?.()) {
          this.player.autoAttack = false;
          this.player.autoAttackToggle = false;
          this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
          if (this.getOffensiveTarget?.()) this.player.targetId = null;
          this.logCombat('Auto attack ended.');
          return true;
        }
        return false;
      };

      Game.prototype.isTargetableHostile = function(actor) {
        if (!actor || actor.alive === false || actor.hidden === true || actor.despawned === true || actor.pendingDespawn === true || actor.temporaryGroundItem || actor.ambient || actor.nonCombat) return false;
        if (String(actor.kind || '').toLowerCase() !== 'enemy') return false;
        if (!(this.enemies || []).includes(actor)) return false;
        if (!Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) return false;
        const silkGate = DR.SilkWebEncounterGate;
        if (silkGate?.isBossLike?.(actor) && this.player && silkGate.canAcquireTarget?.(this, actor, this.player, { source: 'hostile-targeting' }) === false) return false;
        return true;
      };

      Game.prototype.hostileTargetCandidates = function(options = {}) {
        if (!this.player || !this.player.alive) return [];
        const maxRange = Math.max(1, safeNumber(options.range, 10.5));
        const maxRangeSq = maxRange * maxRange;
        const preferVisible = options.preferVisible !== false;
        const list = [];
        const px = this.player.x;
        const py = this.player.y;
        for (const enemy of this.enemies || []) {
          if (!this.isTargetableHostile?.(enemy)) continue;
          const dx = enemy.x - px;
          const dy = enemy.y - py;
          const dSq = dx * dx + dy * dy;
          if (!Number.isFinite(dSq) || dSq > maxRangeSq) continue;
          const d = Math.sqrt(dSq);
          let score = d;
          let screenX = null;
          let screenY = null;
          let visible = false;
          if (typeof this.worldToScreen === 'function') {
            const gameCanvas = this.canvas || null;
            const tile = this.tileAt?.(enemy.x, enemy.y) || { elev: 0 };
            const s = this.worldToScreen(enemy.x, enemy.y, safeNumber(tile.elev, 0) + safeNumber(enemy.z, 0));
            screenX = Number.isFinite(Number(s?.x)) ? Number(s.x) : null;
            screenY = Number.isFinite(Number(s?.y)) ? Number(s.y) : null;
            const margin = 80;
            visible = Boolean(s && gameCanvas && screenX >= -margin && screenY >= -margin && screenX <= gameCanvas.width + margin && screenY <= gameCanvas.height + margin);
            if (preferVisible) score += visible ? -0.75 : 2.5;
          }
          if (enemy.elite || enemy.dungeonBoss || enemy.boss) score -= 0.15;
          list.push({ enemy, distance: d, score, screenX, screenY, visible, angle: Math.atan2(dy, dx) });
        }
        const ordered = options.cycleOrder === true
          ? list.sort((a, b) => {
              if (a.visible !== b.visible) return a.visible ? -1 : 1;
              if (a.visible && b.visible) return (a.screenX - b.screenX) || (a.screenY - b.screenY) || (a.distance - b.distance);
              return (a.angle - b.angle) || (a.distance - b.distance);
            })
          : list.sort((a, b) => a.score - b.score || a.distance - b.distance);
        return ordered.map(entry => entry.enemy);
      };

      Game.prototype.targetNearest = function() {
        if (!this.player || !this.player.alive) return false;
        const trappedWebActor = this.player.activeSpiderWeb ? this.player : null;
        if (trappedWebActor?.activeSpiderWeb && this.selectSpiderWebTarget?.(trappedWebActor, { source: 'tab-trapped' })) return true;
        const target = this.findClosestValidHostileToPlayer?.({ range: 14.5, requireSameZone: true });
        if (!target) {
          this.playAudioEvent?.('ui_error', { volume: 0.18 });
          this.logCombat?.('No enemy nearby.');
          return false;
        }
        return this.selectHostileTarget?.(target, { source: 'tab-closest', autoAttack: false }) === true;
      };

      Game.prototype.findClosestValidHostileToPlayer = function(options = {}) {
        const p = this.player;
        if (!p || !p.alive) return null;
        const range = Math.max(1, safeNumber(options.range, 14.5));
        const rangeSq = range * range;
        let best = null;
        let bestDistSq = Infinity;
        for (const enemy of this.enemies || []) {
          if (!this.isTargetableHostile?.(enemy)) continue;
          if (options.requireSameZone !== false && enemy.zone && this.currentZone && enemy.zone !== this.currentZone) continue;
          const dx = Number(enemy.x) - Number(p.x);
          const dy = Number(enemy.y) - Number(p.y);
          const distSq = dx * dx + dy * dy;
          if (!Number.isFinite(distSq) || distSq > rangeSq) continue;
          if (distSq < bestDistSq) { best = enemy; bestDistSq = distSq; }
        }
        return best;
      };

      Game.prototype.selectHostileTarget = function(target, options = {}) {
        if (!this.player || !this.isTargetableHostile?.(target)) return false;
        this.player.spiderWebTargetId = null;
        this.player.targetId = target.id;
        this.playAudioEvent?.('target_select', { actor: target });
        if (options.autoAttack) this.beginAutoAttack?.(target, { silent: true, explicit: true });
        if (!options.silent) this.logCombat?.(`Targeting ${target.name}.`);
        this.updateUI?.();
        return true;
      };

      Game.prototype.selectFriendlyTarget = function(actor, options = {}) {
        if (!this.player || !actor || actor.alive === false) return false;
        this.player.spiderWebTargetId = null;
        this.player.targetId = actor.id;
        this.player.autoAttack = false;
        this.player.autoAttackToggle = false;
        this.player.autoAttackAutoEngaged = false;
        this.clearPlayerAutoAttackVisualState?.(this.player);
        if (!options.silent) this.log?.(`Targeting ${actor.name || 'ally'}.`, 'System');
        this.updateUI?.();
        return true;
      };

      Game.prototype.getAutoAttackIntervalSeconds = function(actor, context = {}) {
        if (DR.resolveAutoAttackIntervalSeconds) {
          return DR.resolveAutoAttackIntervalSeconds(actor, context);
        }
        const base = Math.max(0.1, safeNumber(context.baseSeconds, context.fallbackSeconds ?? 3.25));
        return clamp(base * 0.82, 0.9, 3.25);
      };

      Game.prototype.getPlayerSwingDelay = function() {
        const base = this.getAutoAttackIntervalSeconds?.(this.player, { source: 'player-auto-attack' }) || 2.5;
        if (String(this.player?.className || '').toLowerCase() !== 'fighter') return base;
        const momentum = this.fighterMomentumStacks?.(this.player) || 0;
        return Math.max(0.65, base / (1 + momentum * 0.02));
      };

      Game.prototype.actorEquippedAutoAttackWeapon = function(actor = this.player) {
        if (!actor) return null;
        const equipment = actor === this.player
          ? (this.equipment || actor.equipment || actor.gear || {})
          : (actor.equipment || actor.botEquipment || actor.gear || {});
        return equipment?.weapon || equipment?.mainHand || equipment?.mainhand || equipment?.primary || null;
      };

      Game.prototype.getActorAutoAttackIdentity = function(actor = this.player) {
        const identity = DR.getClassCombatIdentity?.(actor?.className) || {};
        const weapon = this.actorEquippedAutoAttackWeapon?.(actor);
        const weaponMode = inferWeaponAttackMode(weapon);
        const classAttack = autoAttackClassRole(actor);
        const isRangedWeapon = classAttack.role === 'rangedWeapon' || weaponMode === 'rangedWeapon';
        const isCaster = !isRangedWeapon && (classAttack.role === 'caster' || weaponMode === 'rangedCaster');
        const isRanged = isCaster || isRangedWeapon || identity.autoAttackProjectile === true;
        const range = Math.max(0.75, Number(
          isRanged
            ? Math.max(Number(actor?.autoAttackRangeTiles || 0), Number(identity.autoAttackRangeTiles || 0), Number(actor?.range || 0), isCaster ? 6 : 5.5)
            : (actor?.autoAttackRangeTiles || identity.autoAttackRangeTiles || actor?.range || 1.25)
        ));
        return {
          combatStyle: isCaster ? 'rangedCaster' : isRangedWeapon ? 'rangedWeapon' : 'melee',
          range,
          ranged: isRanged,
          caster: isCaster,
          projectile: isRanged,
          projectileStyle: isRangedWeapon ? (classAttack.className === 'ranger' ? 'arrow' : 'physical') : 'bolt',
          damageType: actor?.autoAttackDamageType || identity.autoAttackDamageType || (isCaster ? 'magic' : 'physical'),
          weapon,
          weaponMode,
          className: classAttack.className,
          classRole: isCaster ? 'caster' : isRangedWeapon ? 'rangedWeapon' : 'melee',
          animationType: isCaster ? 'caster' : isRangedWeapon ? 'rangedWeapon' : 'melee'
        };
      };

      Game.prototype.startActorMeleeAutoAttackSwing = function(actor, target, identity = null, options = {}) {
        if (!actor || !actor.alive || !target || !target.alive) return false;
        const info = identity || this.getActorAutoAttackIdentity?.(actor) || { animationType: 'melee', classRole: 'melee', className: normalizedAutoAttackClassName(actor) };
        const caster = info.classRole === 'caster' || info.animationType === 'caster' || info.caster === true;
        const rangedWeapon = info.classRole === 'rangedWeapon' || info.animationType === 'rangedWeapon' || info.projectileStyle === 'arrow';
        if (caster || rangedWeapon) return false;
        const cls = info.className || normalizedAutoAttackClassName(actor);
        const interval = Math.max(0.25, Number(options.interval || this.getAutoAttackIntervalSeconds?.(actor, { source: options.source || 'actor-melee-auto-attack-visual' }) || this.getPlayerSwingDelay?.() || 2.5));
        const durationSec = meleeSwingVisualDurationSeconds(interval, cls);
        const now = nowMs();
        const durationMs = Math.max(180, durationSec * 1000);
        const impactPhase = MELEE_AUTO_ATTACK_IMPACT_PHASE;
        const targetKey = target.id ?? target.botId ?? target.name ?? null;
        const shouldForceImpact = options.forceImpact === true;
        const desiredStartAt = shouldForceImpact ? now - durationMs * impactPhase : Number(options.startedAt || now);
        actor.autoAttackVisualActive = true;
        actor.autoAttackVisualType = 'melee';
        actor.autoAttackVisualClass = cls;
        actor.autoAttackVisualRole = 'melee';
        actor.autoAttackVisualInterval = interval;
        actor.autoAttackVisualDurationMs = durationMs;
        actor.autoAttackVisualStartedAt = desiredStartAt;
        actor.autoAttackVisualImpactPhase = impactPhase;
        actor.autoAttackVisualWeapon = info.weapon?.name || info.weapon?.id || '';
        actor.autoAttackVisualTargetId = targetKey;
        actor.autoAttackVisualTargetX = target.x;
        actor.autoAttackVisualTargetY = target.y;
        actor.autoAttackVisualAimSide = target.x >= actor.x ? 1 : -1;
        actor.autoAttackVisualAimX = safeNumber(target.x, actor.x) - safeNumber(actor.x, 0);
        actor.autoAttackVisualAimY = safeNumber(target.y, actor.y) - safeNumber(actor.y, 0);
        if (typeof actor.setFacingFromDelta === 'function') actor.setFacingFromDelta(actor.autoAttackVisualAimX, actor.autoAttackVisualAimY);
        const phase = clamp01((now - desiredStartAt) / durationMs);
        actor.autoAttackVisualPhase = phase;
        actor.autoAttackVisualPulse = meleeSwingPulse(phase, cls);
        return true;
      };

      Game.prototype.refreshPlayerAutoAttackVisualState = function(target = null, dt = 0, identity = null) {
        const p = this.player;
        if (!p || !p.alive || !p.autoAttack || !target || !target.alive) {
          this.clearPlayerAutoAttackVisualState?.(p);
          return false;
        }
        const info = identity || this.getActorAutoAttackIdentity?.(p) || { ranged: false, animationType: 'melee', classRole: 'melee' };
        const interval = Math.max(0.25, Number(this.getPlayerSwingDelay?.() || this.getAutoAttackIntervalSeconds?.(p, { source: 'player-auto-attack-visual' }) || 2.5));
        const remaining = Math.max(0, Math.min(interval, Number(p.attackTimer || 0)));
        const linearPhase = Math.max(0, Math.min(1, 1 - remaining / interval));
        const caster = info.classRole === 'caster' || info.animationType === 'caster' || info.caster === true;
        const rangedWeapon = info.classRole === 'rangedWeapon' || info.animationType === 'rangedWeapon' || info.projectileStyle === 'arrow';
        if (!caster && !rangedWeapon) {
          const cls = info.className || normalizedAutoAttackClassName(p);
          const durationMs = meleeSwingVisualDurationSeconds(interval, cls) * 1000;
          const now = nowMs();
          const targetKey = target.id ?? target.botId ?? target.name ?? null;
          const impactAt = now + remaining * 1000;
          const startAt = impactAt - durationMs * MELEE_AUTO_ATTACK_IMPACT_PHASE;
          const activeStartedAt = Number(p.autoAttackVisualStartedAt || NaN);
          const activeDurationMs = Math.max(180, Number(p.autoAttackVisualDurationMs || durationMs));
          const activePhase = Number.isFinite(activeStartedAt) ? (now - activeStartedAt) / activeDurationMs : 2;
          const sameTarget = String(p.autoAttackVisualTargetId ?? '') === String(targetKey ?? '');
          if (now >= startAt && (!p.autoAttackVisualActive || !sameTarget || activePhase >= 1 || p.autoAttackVisualType !== 'melee')) {
            this.startActorMeleeAutoAttackSwing?.(p, target, info, { startedAt: startAt, interval, source: 'player-auto-attack-countdown' });
          } else if (p.autoAttackVisualActive && p.autoAttackVisualType === 'melee') {
            const phase = clamp01((now - activeStartedAt) / activeDurationMs);
            if (phase >= 1) {
              this.clearPlayerAutoAttackVisualState?.(p);
              return false;
            }
            p.autoAttackVisualPhase = phase;
            p.autoAttackVisualPulse = meleeSwingPulse(phase, cls);
            p.autoAttackVisualTargetX = target.x;
            p.autoAttackVisualTargetY = target.y;
            p.autoAttackVisualAimX = safeNumber(target.x, p.x) - safeNumber(p.x, 0);
            p.autoAttackVisualAimY = safeNumber(target.y, p.y) - safeNumber(p.y, 0);
            p.autoAttackVisualAimSide = p.autoAttackVisualAimX >= 0 ? 1 : -1;
            p.setFacingFromDelta?.(p.autoAttackVisualAimX, p.autoAttackVisualAimY);
          }
          return Boolean(p.autoAttackVisualActive);
        }
        if (rangedWeapon && target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          p.setFacingFromDelta?.(dx, dy);
          p.autoAttackVisualAimSide = dx >= 0 ? 1 : -1;
          p.autoAttackVisualTargetId = target.id ?? target.botId ?? target.name ?? null;
          p.autoAttackVisualTargetX = target.x;
          p.autoAttackVisualTargetY = target.y;
        }
        p.autoAttackVisualActive = true;
        p.autoAttackVisualType = caster ? 'caster' : rangedWeapon ? 'rangedWeapon' : 'melee';
        p.autoAttackVisualClass = info.className || normalizedAutoAttackClassName(p);
        p.autoAttackVisualRole = caster ? 'caster' : rangedWeapon ? 'rangedWeapon' : 'melee';
        p.autoAttackVisualPhase = linearPhase;
        p.autoAttackVisualPulse = autoAttackAnimationPulse(linearPhase, caster || rangedWeapon, p.autoAttackVisualClass);
        p.autoAttackVisualInterval = interval;
        p.autoAttackVisualWeapon = info.weapon?.name || info.weapon?.id || '';
        return true;
      };

      Game.prototype.canActorAutoAttackTarget = function(actor, target, options = {}) {
        if (!alive(actor) || !alive(target)) return false;
        if (!this.canActorUseHostileActionOn?.(actor, target, { autoAttack: true })) return false;
        const identity = this.getActorAutoAttackIdentity?.(actor) || { range: 1.25, ranged: false };
        if (dist(actor, target) > identity.range + (options.rangePadding ?? 0.05)) return false;
        if (identity.ranged && this.companionHasClearCombatLine) {
          return this.companionHasClearCombatLine(actor, target, { desiredRange: identity.range, requireLineOfSight: true }) !== false;
        }
        if (identity.ranged && this.hasLineWalkPath) return this.hasLineWalkPath(actor.x, actor.y, target.x, target.y, actor) === true;
        return true;
      };


      Game.prototype.getEnemySwingDelay = function(enemy, target = null) {
        return this.getAutoAttackIntervalSeconds?.(enemy, { source: 'enemy-auto-attack' }) || 2.5;
      };

      Game.prototype.getEnemyAutoAttackRawDamage = function(enemy, target = null) {
        const level = levelNumber(enemy);
        const attack = Math.max(1, safeNumber(enemy?.getStat?.('attack'), enemy?.attack || 5));
        const profile = String(enemy?.baseType?.aiProfile || enemy?.aiProfile || '').toLowerCase();
        let profileBonus = 0;
        if (profile.includes('elite') || profile.includes('brute') || profile.includes('horror')) profileBonus = 1.5;
        else if (profile.includes('skirmisher') || profile.includes('swarm')) profileBonus = -1;
        const variance = level <= 3 ? randInt(0, 2) : randInt(1, 4);
        // V0.20.34 (Roadmap Item 19): boss soft-enrage + phase damage escalation (1 for non-bosses).
        const enrage = Math.max(1, Number(enemy?._bossDamageMult) || 1);
        return Math.max(1, Math.floor((attack * 0.62 + level * 0.34 + variance + profileBonus) * enrage));
      };

      Game.prototype.clearPlayerAutoAttackVisualState = function(actor = this.player) {
        if (!actor) return false;
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
        actor.autoAttackVisualStartedAt = 0;
        actor.autoAttackVisualDurationMs = 0;
        actor.autoAttackVisualImpactPhase = 0;
        actor.autoAttackVisualAimX = 0;
        actor.autoAttackVisualAimY = 0;
        return true;
      };

      Game.prototype.stopAutoAttack = function(message = '') {
        if (!this.player) return;
        this.player.autoAttack = false;
        this.player.autoAttackToggle = false;
        this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
        this.player.attackTimer = 0;
        this.clearPlayerAutoAttackVisualState?.(this.player);
        if (message) this.logCombat(message);
        this.updateUI?.();
      };

      Game.prototype.enterCombatWithTarget = function(target, options = {}) {
        const p = this.player;
        if (!alive(p) || !alive(target)) return false;
        if (!this.isHostileTarget?.(target)) {
          if (options.explicit === true || options.manual === true || options.log === true) this.logCombat?.('Cannot attack friendly target.');
          return false;
        }
        if (options.explicit !== true && options.manual !== true) {
          p.targetId = target.id;
          return false;
        }
        p.targetId = target.id;
        if (!p.autoAttack && options.log) this.logCombat(`Auto attack toggled on: ${target.name}.`);
        p.autoAttack = true;
        p.autoAttackToggle = true;
        p.autoAttackAutoEngaged = false;
        this.clearPlayerAutoAttackVisualState?.(p);
        const attackIdentity = this.getActorAutoAttackIdentity?.(p) || { range: Number(p.range || 1.35) };
        if (options.forceCooldown || options.immediate || dist(p, target) <= attackIdentity.range + 0.05) p.combatCooldown = Math.max(p.combatCooldown || 0, 6.5);
        target.aggro = true;
        this.addThreat?.(target, p, options.immediate ? 10 : 5, { reason: 'combat-engage', flatBonus: options.forceCooldown ? 4 : 0 });
        if (options.forceCooldown || options.immediate || dist(p, target) <= attackIdentity.range + 0.05) target.combatCooldown = Math.max(target.combatCooldown || 0, 6.5);
        p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
        if (options.immediate && p.attackTimer <= 0 && this.canActorAutoAttackTarget?.(p, target)) {
          this.resolvePlayerAutoAttack(target);
        }
        return true;
      };

      Game.prototype.findAutoCombatTarget = function() {
        if (!this.player || !this.player.alive) return null;
        const current = this.getOffensiveTarget?.();
        if (current && current.alive && dist(this.player, current) <= 9.5) return current;
        const candidates = (this.enemies || []).filter(e => e && e.alive && (e.aggro || (e.combatCooldown || 0) > 0 || e.hp < e.maxHp));
        candidates.sort((a, b) => dist(this.player, a) - dist(this.player, b));
        const nearest = candidates[0];
        return nearest && dist(this.player, nearest) <= 7.5 ? nearest : null;
      };

      Game.prototype.playerAttack = function() {
        if (!this.player || !this.player.alive) return false;
        // Phase 3 (Combat/Spell Parity): status contract - stun blocks
        // starting a new attack, but still allows toggling an already-
        // active auto attack off. No shipped status applies 'stun' today
        // (see systems/status-effect-system.js), so this never fires for
        // current content.
        if (this.isActionLocked?.(this.player) && !this.player.autoAttack) {
          this.logCombat?.('You cannot act while stunned.');
          return false;
        }
        const selectedWebActor = this.selectedSpiderWebTargetActor?.() || (this.player.activeSpiderWeb ? this.player : null);
        if (selectedWebActor?.activeSpiderWeb) {
          const identity = this.getActorAutoAttackIdentity?.(this.player) || { range: 1.25, damageType: 'physical' };
          const webRange = Math.max(1.25, safeNumber(identity.range, safeNumber(this.player.range, 1.25)));
          if (combatDistance(this.player, selectedWebActor) > webRange + 0.65) {
            this.logCombat?.('Web is out of attack range.');
            return false;
          }
          this.player.autoAttack = false;
          this.player.autoAttackToggle = false;
          this.player.autoAttackAutoEngaged = false;
          this.clearPlayerAutoAttackVisualState?.(this.player);
          const attack = typeof this.player.getStat === 'function' ? this.player.getStat('attack') : safeNumber(this.player.attack, 8);
          const damage = Math.max(10, Math.floor(attack * 0.78 + safeNumber(this.player.level, 1) * 0.72));
          this.player.setFacingFromDelta?.(selectedWebActor.x - this.player.x, selectedWebActor.y - this.player.y);
          this.spawnSlash?.(this.player, selectedWebActor, '#e8e6ef', 'slash');
          this.damageSpiderBreakableWeb?.(selectedWebActor, damage, this.player);
          return true;
        }
        if (this.player.autoAttack) {
          this.stopAutoAttack('Auto attack toggled off.');
          return true;
        }
        const identity = this.getActorAutoAttackIdentity?.(this.player) || { range: 1.25 };
        const selectedTarget = this.getTarget?.();
        if (selectedTarget && this.isFriendlyCombatActor?.(selectedTarget)) {
          this.stopAutoAttack();
          this.logCombat?.('Cannot attack friendly target.');
          return false;
        }
        const target = this.getOffensiveTarget?.() || this.nearestEnemy(this.player.x, this.player.y, Math.max(5.5, identity.range + 0.25));
        if (!target) {
          this.stopAutoAttack();
          this.logCombat('No target in reach.');
          return false;
        }
        this.cancelMeditation?.(this.player, 'attack', { silent: true });
        this.cancelPlayerEmote?.('action');
        if (this.fishingSystem?.active) this.fishingSystem.cancelFishing('Fishing cancelled.');
        const started = this.enterCombatWithTarget(target, { log: true, immediate: true, explicit: true });
        this.updateUI?.();
        return started;
      };

      Game.prototype.resolvePlayerAutoAttack = function(target) {
        const p = this.player;
        if (!alive(p) || !alive(target) || !this.isHostileTarget?.(target)) return false;
        const identity = this.getActorAutoAttackIdentity?.(p) || { range: 1.25, ranged: false, projectile: false, damageType: 'physical' };
        if (!this.canActorAutoAttackTarget?.(p, target)) return false;
        const className = String(p.className || '').toLowerCase();
        const classBonus = className === 'rogue' ? randInt(1, 4) : className === 'fighter' ? randInt(2, 5) : randInt(1, 3);
        const damage = Math.max(2, Math.floor(p.getStat('attack') * 0.62 + p.level * 0.82 + classBonus));
        p.setFacingFromDelta(target.x - p.x, target.y - p.y);
        target.aggro = true;
        target.combatCooldown = Math.max(target.combatCooldown || 0, 8);
        p.combatCooldown = Math.max(p.combatCooldown || 0, 8);
        p.autoAttackLastImpactAt = performance.now();
        this.refreshPlayerAutoAttackVisualState?.(target, 0, identity);
        const autoAttackCaster = identity.classRole === 'caster' || identity.animationType === 'caster' || identity.caster === true;
        const autoAttackRangedWeapon = identity.classRole === 'rangedWeapon' || identity.animationType === 'rangedWeapon' || identity.projectileStyle === 'arrow';
        this.spawnCastCue?.(p, p.color, autoAttackCaster ? 'Auto Cast' : autoAttackRangedWeapon ? 'Shot' : 'Swing');
        if (autoAttackCaster) {
          p.spellCastAnim = Math.max(Number(p.spellCastAnim || 0), 0.92);
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          if (identity.projectile) this.spawnBolt?.(p, target, p.color);
        } else if (autoAttackRangedWeapon) {
          p.attackAnim = Math.max(Number(p.attackAnim || 0), 0.94);
          p.setFacingFromDelta?.(target.x - p.x, target.y - p.y);
          // Ranger: spawn the arrow near the bow tip (in front of the archer, along the true
          // aim vector) instead of the player's own center point, and drive its velocity from
          // that same vector so facing, spawn point, and travel direction all agree.
          const projectileSource = className === 'ranger' ? rangedWeaponSpawnOrigin(p, getAimVector(p, target)) : p;
          this.spawnArrowProjectile?.(projectileSource, target, p.color, { speed: 18, className }) || this.spawnBolt?.(projectileSource, target, p.color, { style: 'arrow', projectile: { speed: 18 } });
        } else {
          this.startActorMeleeAutoAttackSwing?.(p, target, identity, { forceImpact: true, interval: this.getPlayerSwingDelay?.() || this.getAutoAttackIntervalSeconds?.(p, { source: 'player-auto-attack-impact' }), source: 'player-auto-attack-impact' });
          this.playSfx?.(className === 'rogue' ? 'attack_slash' : 'attack_slash', { x: p.x, y: p.y, volume: className === 'rogue' ? 0.34 : 0.42, rate: className === 'fighter' ? 0.88 : className === 'rogue' ? 1.14 : 0.96, cooldown: 0.055 });
        }
        this.damageEntity(target, damage, p, p.color, { damageType: identity.damageType, canCrit: true });
        const offhandWeapon = className === 'rogue' ? this.getRogueDualWieldOffhandWeapon?.(p) : null;
        if (offhandWeapon && alive(target)) {
          const offhandSeed = weaponDamageSeed(offhandWeapon);
          const offhandDamage = Math.max(1, Math.floor(damage * 0.34 + offhandSeed * 0.26));
          this.damageEntity(target, offhandDamage, p, '#6affe1', { damageType: identity.damageType, canCrit: true, offhand: true });
          this.spawnCombatImpact?.(target, '#6affe1', 0.72, 'player');
        }
        this.spawnCombatImpact?.(target, p.color, 1.1, 'player');
        this.camera.shake = Math.min(4.5, this.camera.shake + (offhandWeapon ? 1.05 : 0.85));
        p.attackTimer = this.getPlayerSwingDelay();
        return true;
      };

      Game.prototype.updateCombatRuntime = function(dt) {
        if (!this.player || !this.player.alive) return;
        if (!this.player.autoAttack) {
          this.clearPlayerAutoAttackVisualState?.(this.player);
          this.clearStaleCombatState?.(this.player, { silent: true });
          this.clearStaleCombatState?.(this.merc, { silent: true });
          this.clearStaleCombatState?.(this.pet, { silent: true });
          return;
        }
        let target = this.getOffensiveTarget?.();
        if (!target || !target.alive) {
          this.stopAutoAttack('Auto attack ended.');
          this.clearStaleCombatState?.(this.player, { silent: true });
          return;
        }

        if (!target || !target.alive) {
          if (this.player.autoAttack) this.stopAutoAttack();
          this.clearStaleCombatState?.(this.player, { silent: true });
          return;
        }

        const d = dist(this.player, target);
        if (d > 9.5 || !this.isEntityInCombat?.(this.player)) {
          this.stopAutoAttack();
          this.clearStaleCombatState?.(this.player, { silent: true });
          return;
        }

        const identity = this.getActorAutoAttackIdentity?.(this.player) || { range: 1.25, ranged: false };
        this.refreshPlayerAutoAttackVisualState?.(target, dt, identity);
        this.player.setFacingFromDelta(target.x - this.player.x, target.y - this.player.y);
        if (!this.canActorAutoAttackTarget?.(this.player, target)) {
          if (!this.player.lastOutOfRangeCombatLogAt || performance.now() - this.player.lastOutOfRangeCombatLogAt > 2400) {
            this.player.lastOutOfRangeCombatLogAt = performance.now();
            this.logCombat(identity.ranged && d <= identity.range ? `${target.name} is not in clear line of sight.` : `${target.name} is out of ${identity.ranged ? 'ranged' : 'melee'} auto-attack range.`);
          }
          return;
        }
        if (this.player.attackTimer <= 0) this.resolvePlayerAutoAttack(target);
        this.clearStaleCombatState?.(this.merc, { silent: true });
        this.clearStaleCombatState?.(this.pet, { silent: true });
      };

      Game.prototype.updateRealtimeStatusDamage = function(dt) {
        // Status ticking is owned by systems/status-effect-system.js as of V0.12.42.
        // Kept as a compatibility delegate for older external systems that may call it.
        this.updateStatusEffects?.(dt);
      };

      // V0.20.41 (Roadmap Item 8 - Unified Skill Progression, armor proficiency slice). Four armor
      // skills (cloth/leather/chain/plate), level 1-20, that grow from taking real combat hits while
      // wearing that armour and increase the defence those pieces give. Built on the existing conventions:
      // data lives on the GAME (like all belongings, V0.20.2), the bonus is added to the derived-stats
      // aggregator (recomputed on every equip, never written to item base), and it persists in
      // serializeCharacterState. Class armour restrictions are unaffected - this only scales defence of
      // armour the class is already allowed to wear.
      const ARMOR_PROF_TYPES = ['cloth', 'leather', 'chain', 'plate'];
      const ARMOR_PROF_MAX_LEVEL = 20;

      Game.prototype.armorProficiencyData = function() {
        if (!this.armorProficiency || typeof this.armorProficiency !== 'object') this.armorProficiency = {};
        for (const t of ARMOR_PROF_TYPES) {
          const s = this.armorProficiency[t];
          if (!s || typeof s !== 'object') this.armorProficiency[t] = { level: 1, xp: 0 };
        }
        return this.armorProficiency;
      };

      // XP to advance FROM `level` to the next: gently escalating, 60 at level 1 up to ~440 near cap.
      Game.prototype.nextArmorProficiencyXp = function(level) {
        return 40 + Math.max(1, Math.floor(Number(level) || 1)) * 20;
      };

      // Count equipped pieces per armour type; the type with the most pieces is "dominant" (the armour
      // you are mainly wearing). Ties and empty loadouts return null - no XP, no bonus.
      Game.prototype.dominantArmorType = function() {
        const counts = {};
        for (const item of Object.values(this.equipment || {})) {
          const t = item && String(item.armorType || '').toLowerCase();
          if (t && ARMOR_PROF_TYPES.includes(t)) counts[t] = (counts[t] || 0) + 1;
        }
        let best = null, bestN = 0;
        for (const t of ARMOR_PROF_TYPES) { const n = counts[t] || 0; if (n > bestN) { best = t; bestN = n; } }
        return best;
      };

      // Per-level defence gain: +2% of a piece's armour per level above 1 (0% at 1, +38% at 20),
      // applied per armour type to the equipped pieces of that type. Returns a flat armour number to
      // add to the derived-stats aggregator.
      Game.prototype.armorProficiencyDefenseBonus = function() {
        const prof = this.armorProficiencyData();
        let bonus = 0;
        for (const item of Object.values(this.equipment || {})) {
          const t = item && String(item.armorType || '').toLowerCase();
          if (!t || !ARMOR_PROF_TYPES.includes(t)) continue;
          const base = Number(item.armor ?? item.stats?.armor ?? 0);
          if (!(base > 0)) continue;
          const level = Math.max(1, Math.min(ARMOR_PROF_MAX_LEVEL, Number(prof[t]?.level) || 1));
          bonus += base * (level - 1) * 0.02;
        }
        return Math.floor(bonus);
      };

      // Grant XP to the dominant armour type. Anti-exploit: only real enemy hits (gated by the caller),
      // a 1.5s cooldown, and non-trivial damage - so standing in a puddle taking 1-tick chip damage or
      // being hit while unarmoured grants nothing.
      Game.prototype.gainArmorProficiencyXp = function(amount, damageDealt = 0) {
        const type = this.dominantArmorType();
        if (!type) return;
        const maxHp = Math.max(1, Number(this.player?.maxHp) || 1);
        if (Number(damageDealt) < Math.max(1, maxHp * 0.01)) return; // trivial-damage guard
        const now = (this.runtimeNowMs?.() || Date.now());
        if (now - (this._armorProfXpAt || 0) < 1500) return; // cooldown
        this._armorProfXpAt = now;
        const prof = this.armorProficiencyData();
        const s = prof[type];
        if (s.level >= ARMOR_PROF_MAX_LEVEL) return; // max-level enforcement
        s.xp += Math.max(1, Math.floor(Number(amount) || 1));
        let needed = this.nextArmorProficiencyXp(s.level);
        while (s.level < ARMOR_PROF_MAX_LEVEL && s.xp >= needed) {
          s.xp -= needed;
          s.level += 1;
          this.log?.(`${type.charAt(0).toUpperCase() + type.slice(1)} Armor proficiency level ${s.level}.`);
          needed = this.nextArmorProficiencyXp(s.level);
        }
        if (s.level >= ARMOR_PROF_MAX_LEVEL) s.xp = 0;
        this.markStatsDirty?.();
      };

      Game.prototype.damageEntity = function(target, rawDamage, source, color = '#ffffff', options = {}) {
        if (!target || !target.alive) return 0;
        // Phase 3 (Combat/Spell Parity): status contract - an 'invulnerable'
        // tagged status blocks all incoming damage outright. No shipped
        // status applies this tag today (see systems/status-effect-system.js),
        // so this never fires for current content.
        if (this.isInvulnerable?.(target)) {
          if (source === this.player || options.playerInitiated === true) this.logCombat?.(`${target.name || 'Target'} is invulnerable.`);
          return 0;
        }
        if (source && this.isFriendlyFireBlocked?.(source, target, options)) {
          if (source === this.player || options.playerInitiated === true) this.logCombat?.('Cannot attack friendly target.');
          return 0;
        }
        if (source && isFriendlyCombatKind(source) && !this.isHostileTarget?.(target)) {
          if (source === this.player || options.playerInitiated === true) this.logCombat?.('Cannot attack friendly target.');
          return 0;
        }
        const damageType = inferDamageType(source, options);
        const crit = rollCrit(source, damageType, options);
        let adjustedRaw = applyOutgoingDamageStats(source, rawDamage, damageType) * crit.multiplier;
        if (target?.raceId === 'bogling' && (damageType === 'poison' || damageType === 'disease')) adjustedRaw *= 0.92;
        if (source?.kind === 'enemy' && ['player', 'merc', 'pet', 'bot'].includes(target.kind)) {
          adjustedRaw *= enemyIncomingScalar(source, target);
        }
        if (Array.isArray(target.buffs)) {
          for (const effect of target.buffs) {
            if (!effect || effect.remaining <= 0) continue;
            if (damageType === 'physical' && Number(effect.physicalDamageTakenMultiplier || 0) > 0) adjustedRaw *= Number(effect.physicalDamageTakenMultiplier);
            // V0.17.70 BUG 2 fix: magic-school damage (incl. fire/frost/nature/... and holy) uses magicDamageTakenMultiplier.
            if ((DR.StatSystem?.isMagicSchool?.(damageType) || damageType === 'holy') && Number(effect.magicDamageTakenMultiplier || 0) > 0) adjustedRaw *= Number(effect.magicDamageTakenMultiplier);
            if (Number(effect.damageTakenMultiplier || 0) > 0) adjustedRaw *= Number(effect.damageTakenMultiplier);
          }
        }
        // V0.17.69 Talents: player-only outgoing/incoming multipliers, applied
        // pre-mitigation so armor/magicResist DR still governs the final number.
        if (source === this.player) adjustedRaw *= this.talentOutgoingMultiplier?.(target, damageType, options) ?? 1;
        else if (source && (source === this.pet || source.temporaryPet === true || (source.owner && source.owner === this.player))) adjustedRaw *= this.talentPetMultiplier?.(source) ?? 1;
        if (target === this.player) adjustedRaw *= this.talentIncomingMultiplier?.(source, damageType, options) ?? 1;
        // Phase 8a (Intersect parity): 'true' damage bypasses all mitigation;
        // 'magic' damage additionally layers magicResistReductionFor on top of
        // (never instead of) the existing armorReduction. magicResist is 0 for
        // all current content, so totalReduction === armorReduction exactly
        // until a class/item explicitly opts in - no existing combat changes.
        let totalReduction = 0;
        if (damageType !== 'true') {
          const armorReduction = DR.StatSystem?.armorReductionFor?.(target) || 0;
          // V0.17.70 BUG 2 fix: all magic-school types (not just literal 'magic') layer magicResist.
          if (DR.StatSystem?.isMagicSchool?.(damageType)) {
            const magicResistReduction = DR.StatSystem?.magicResistReductionFor?.(target) || 0;
            totalReduction = 1 - (1 - armorReduction) * (1 - magicResistReduction);
          } else {
            totalReduction = armorReduction;
          }
        }
        let damage = Math.max(1, Math.floor(adjustedRaw * (1 - totalReduction)));
        damage = Math.min(damage, playerDamageCap(target, source));
        if (!options.redirected && source?.kind === 'enemy' && ['player', 'merc', 'pet', 'bot'].includes(target.kind) && Array.isArray(target.buffs) && damage > 0) {
          for (const effect of target.buffs) {
            if (!effect || effect.remaining <= 0 || Number(effect.damageRedirectPct || 0) <= 0 || effect.redirectActorId == null) continue;
            const guardian = this.findSpellActorById?.(effect.redirectActorId);
            if (!guardian || guardian === target || guardian.alive === false) continue;
            const redirected = Math.min(damage - 1, Math.floor(damage * Number(effect.damageRedirectPct || 0)));
            if (redirected <= 0) continue;
            damage -= redirected;
            this.damageEntity?.(guardian, redirected, source, effect.color || color, { ...options, redirected: true, damageType });
            if (Number(effect.flatThreatPerRedirect || 0) > 0) this.addThreat?.(source, guardian, Number(effect.flatThreatPerRedirect), { reason: 'paladin-redirect-guard' });
            if (Number(effect.stacks || 0) > 0) { effect.stacks = Math.max(0, Number(effect.stacks) - 1); if (effect.stacks <= 0) effect.remaining = 0; }
            this.spawnDamageText?.(target.x, target.y - 0.32, `Guard ${redirected}`, effect.color || '#fff2ba', 0.75);
            break;
          }
        }
        if (Array.isArray(target.buffs) && damage > 0) {
          for (const effect of target.buffs) {
            if (!effect || effect.remaining <= 0 || Number(effect.absorbRemaining || 0) <= 0) continue;
            const absorbed = Math.min(damage, Math.floor(Number(effect.absorbRemaining || 0)));
            effect.absorbRemaining = Math.max(0, Number(effect.absorbRemaining || 0) - absorbed);
            damage -= absorbed;
            if (absorbed > 0) this.spawnDamageText?.(target.x, target.y - 0.18, `Absorb ${absorbed}`, effect.color || '#fff2ba', 0.8);
            if (effect.absorbRemaining <= 0) effect.remaining = 0;
            if (damage <= 0) break;
          }
        }
        if (Array.isArray(target.buffs) && damage > 0) {
          for (const effect of target.buffs) {
            if (!effect || effect.remaining <= 0 || effect.consumeOnHit !== true || Number(effect.stacks || 0) <= 0) continue;
            effect.stacks = Math.max(0, Number(effect.stacks || 0) - 1);
            if (effect.stacks <= 0 && Number(effect.absorbRemaining || 0) <= 0) effect.remaining = 0;
            break;
          }
        }
        const targetHpBeforeDamage = Math.max(0, safeNumber(target.hp, 0));
        if (Array.isArray(target.buffs) && damage >= targetHpBeforeDamage && targetHpBeforeDamage > 0) {
          const save = target.buffs.find(effect => effect && effect.remaining > 0 && effect.lethalSave === true);
          if (save) {
            damage = Math.max(0, targetHpBeforeDamage - 1);
            save.remaining = 0;
            const followup = Math.max(1, Math.floor((target.maxHp || 1) * 0.20));
            this.applyStatusEffect?.(target, { id: 'divine_intervention_recovery', name: 'Divine Intervention Recovery', type: 'hot', duration: 6, tickRate: 2, periodicHealing: Math.ceil(followup / 3), color: save.color || '#fff2ba', hostile: false, tags: ['holy', 'hot'] }, source || target);
            this.spawnStatusPulse?.(target, save.color || '#fff2ba', 'Saved');
          }
        }
        target.hp -= damage;
        const actualDamage = Math.max(0, Math.min(damage, targetHpBeforeDamage));
        if (target.meditating) {
          this.cancelMeditation?.(target, 'damage taken', { silent: target.kind !== 'player' });
          if (target.kind === 'bot') this.queueBotSpeechEvent?.(target, 'stopRecoveryToFollow', { priority: 3 });
        }
        if (target.kind === 'player' && target.emoteActive) this.cancelPlayerEmote?.('damage');
        if (target.kind === 'player' && target.fishing) this.fishingSystem?.cancelFishing?.('Fishing cancelled.');
        if (target.kind === 'player') this.resourceGatheringSystem?.cancelForDamage?.();
        // V0.20.64 (Roadmap Item 7.H): a hit can unseat a rider. Placed here with the other
        // damage-interrupts rather than in a damage listener of its own, so it shares the one
        // authoritative damage site and cannot double-fire or miss a source.
        if (target.kind === 'player' && actualDamage > 0) this.mountSystem?.notifyPlayerDamaged?.(actualDamage);
        if (['player', 'merc', 'pet', 'bot', 'enemy'].includes(target.kind)) target.combatCooldown = Math.max(target.combatCooldown || 0, 6);
        if (source && ['player', 'merc', 'pet', 'bot', 'enemy'].includes(source.kind)) source.combatCooldown = Math.max(source.combatCooldown || 0, 6);
        if (target.kind === 'enemy' && source && ['player', 'merc', 'pet', 'bot'].includes(source.kind)) {
          target.aggro = true;
          this.addThreat?.(target, source, damage, { reason: options.isPeriodic ? 'periodic-damage' : 'damage' });
          this.markPartyCombatEngaged?.(target, source, { reason: options.isPeriodic ? 'periodic-damage' : 'damage' });
        }
        if (['player', 'merc', 'pet', 'bot'].includes(target.kind) && source?.kind === 'enemy') {
          this.addThreat?.(source, target, damage * 1.15, { reason: 'enemy-hit-target' });
        }
        // V0.20.41 (Roadmap Item 8): the player earns armour proficiency by surviving real enemy hits
        // while wearing armour. Gated to the player + enemy source; the method itself enforces the
        // cooldown, trivial-damage floor and max level. XP scales a little with the hit's severity.
        if (target.kind === 'player' && source?.kind === 'enemy' && !options.isPeriodic) {
          this.gainArmorProficiencyXp?.(6 + Math.floor(actualDamage / 4), actualDamage);
        }
        target.hitFlash = 0.22;
        const hitColor = finalDamageColor(color, crit.crit);
        if (actualDamage > 0 && typeof this.recordDamageEvent === 'function') {
          this.recordDamageEvent({
            amount: actualDamage,
            displayedAmount: damage,
            target,
            source,
            damageType,
            isPeriodic: options.isPeriodic === true,
            isCrit: crit.crit === true,
            color: hitColor,
            abilityId: options.abilityId || options.spellId || options.sourceId || '',
            abilityName: options.abilityName || options.spellName || options.name || ''
          });
        }
        if (this.spawnDamageText) this.spawnDamageText(target.x, target.y, `${crit.crit ? 'CRIT ' : ''}${damage}`, hitColor, crit.crit ? 1.05 : 0.85);
        else (this.addDamageText || ((entry) => { this.damageText.push(entry); return entry; })).call(this, { x: target.x, y: target.y, text: `${crit.crit ? 'CRIT ' : ''}${damage}`, color: hitColor, t: 0, life: crit.crit ? 1.05 : 0.85 });
        this.spawnCombatImpact?.(target, hitColor, Math.max(1, damage / 18), source?.kind === 'enemy' ? 'enemy' : 'player');
        this.playSfx?.('hit_thud', { x: target.x, y: target.y, volume: crit.crit ? 0.46 : 0.32, rate: crit.crit ? 0.82 : 0.9 + Math.random() * 0.16, cooldown: 0.045 });
        this.camera.shake = Math.min(5, this.camera.shake + (crit.crit ? 1.55 : 1.2));

        if (actualDamage > 0) {
          this.notifyExternalSystems?.('damage-dealt', {
            targetId: target.id, sourceId: source?.id ?? null, amount: actualDamage, damageType, isCrit: crit.crit === true
          });
          if (source === this.player && String(source?.className || '').toLowerCase() === 'fighter' && crit.crit === true) {
            const watcher = source.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'fighter_savage_momentum_watcher');
            if (watcher) this.applyFighterSelfBuff?.({ duration: 300, color: source.color || '#d0b070' }, 'fighter_savage_momentum', 'Savage Momentum', { stacks: 6, maxStacks: 6, fighterMeleeDamageBonus: 0.08, moveSpeedMultiplier: 1.12, tags: ['fighter', 'triggered'] });
            this.addFighterMomentum?.(1, source);
          }
          if (target === this.player && String(target?.className || '').toLowerCase() === 'fighter' && source?.kind === 'enemy' && Math.random() < 0.18) {
            this.applyStatusEffect?.(target, { id: 'fighter_riposte_ready', name: 'Riposte Ready', type: 'buff', duration: 300, color: target.color || '#d0b070', hostile: false, stacks: 1, maxStacks: 1, tags: ['fighter', 'riposte'], description: 'A parry opening is available. Heavy Riposte can be used.' }, target);
            this.spawnStatusPulse?.(target, target.color || '#d0b070', 'Riposte Ready');
          }
        }
        // V0.17.69 Talents: capstone proc triggers (player-sourced / player-taken).
        if (source === this.player && crit.crit === true) this.fireTalentProc?.('onCrit', { target, source, damageType });
        if (target === this.player && actualDamage > 0) {
          this.fireTalentProc?.('onDamageTaken', { source, damageType });
          this.fireTalentProc?.('lowHealth', { source, damageType });
        }
        if (target.hp <= 0) this.killEntity(target, source);
        return damage;
      };

      Game.prototype.healEntity = function(target, amount, text = true, source = null, options = {}) {
        if (!target || !target.alive) return 0;
        const healer = source || this.player || target;
        const base = safeNumber(amount, 0);
        let healingMultiplier = healer && healer.kind !== 'enemy' ? safeNumber(healer.healingMultiplier ?? healer.derivedStats?.healingMultiplier, 1) : 1;
        if (healer && Array.isArray(healer.buffs)) {
          for (const effect of healer.buffs) {
            if (!effect || effect.remaining <= 0) continue;
            if (Number(effect.healingMultiplier || 0) > 0) healingMultiplier *= Number(effect.healingMultiplier);
          }
        }
        let receivedMultiplier = 1;
        if (Array.isArray(target.buffs)) {
          for (const effect of target.buffs) {
            if (!effect || effect.remaining <= 0) continue;
            if (Number(effect.healingReceivedMultiplier || 0) > 0) receivedMultiplier *= Number(effect.healingReceivedMultiplier);
            if (healer !== target && Number(effect.allyHealingReceivedMultiplier || 0) > 0) receivedMultiplier *= Number(effect.allyHealingReceivedMultiplier);
          }
        }
        const crit = rollCrit(healer, 'healing', options);
        // V0.17.69 Talents: player-only healing done/received multipliers.
        if (healer === this.player) healingMultiplier *= this.talentHealingMultiplier?.(target, options) ?? 1;
        if (target === this.player) receivedMultiplier *= this.talentHealingReceivedMultiplier?.({ source: healer }) ?? 1;
        const finalAmount = Math.max(0, Math.floor(base * healingMultiplier * receivedMultiplier * crit.multiplier));
        const before = target.hp;
        target.hp = clamp(target.hp + finalAmount, 0, target.maxHp);
        const healed = Math.floor(target.hp - before);
        if (text && healed > 0) {
          if (this.spawnDamageText) this.spawnDamageText(target.x, target.y, `${crit.crit ? 'CRIT ' : ''}+${healed}`, crit.crit ? '#ffe08a' : '#8fe47d', crit.crit ? 1.05 : 0.9);
          else (this.addDamageText || ((entry) => { this.damageText.push(entry); return entry; })).call(this, { x: target.x, y: target.y, text: `${crit.crit ? 'CRIT ' : ''}+${healed}`, color: crit.crit ? '#ffe08a' : '#8fe47d', t: 0, life: crit.crit ? 1.05 : 0.9 });
          this.spawnStatusPulse?.(target, crit.crit ? '#ffe08a' : '#8fe47d', crit.crit ? 'Critical Heal' : 'Heal');
        }
        if (healed > 0 && healer && ['player', 'merc', 'pet', 'bot'].includes(healer.kind)) this.addHealingThreat?.(healer, healed);
        if (healed > 0) {
          this.notifyExternalSystems?.('healing-done', {
            targetId: target.id, sourceId: healer?.id ?? null, amount: healed, isCrit: crit.crit === true
          });
        }
        // V0.17.72 Talents: onHealCast capstone trigger (player healer only).
        if (healer === this.player && healed > 0 && options.talentProc !== true) this.fireTalentProc?.('onHealCast', { target, healed });
        return healed;
      };

      Game.prototype.restoreMana = function(target, amount) {
        const before = target.mana;
        target.mana = clamp(target.mana + amount, 0, target.maxMana);
        return Math.floor(target.mana - before);
      };

      Game.prototype.aoeDamage = function(x, y, radius, amount, color, source = this.player, options = {}) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (Math.hypot(enemy.x - x, enemy.y - y) <= radius) {
            this.damageEntity(enemy, amount, source || this.player, color, options);
          }
        }
      };

      // V0.18.0: enemy-side AoE - the mirror of aoeDamage, hitting the player and their
      // party (mercs/pets/bots) instead of enemies. Used by the generic mob ability
      // executor (Enemy.executeDataAbility) for aoe/cleave/poison_cloud etc. Pass amount=0
      // + options.status to apply a status only (snare/debuff).
      Game.prototype.enemyAoeDamage = function(x, y, radius, amount, source, color, options = {}) {
        const r = Math.max(0.5, Number(radius) || 2);
        const dmg = Math.max(0, Math.floor(Number(amount) || 0));
        const actors = [];
        const push = a => { if (a && a.alive !== false && a.hp !== 0 && !actors.includes(a)) actors.push(a); };
        push(this.player); push(this.merc); push(this.pet);
        for (const bot of this.botPlayers || []) { push(bot); if (bot?.botPet) push(bot.botPet); }
        let hit = 0;
        for (const a of actors) {
          if (Math.hypot((a.x || 0) - x, (a.y || 0) - y) > r) continue;
          if (dmg > 0) this.damageEntity?.(a, dmg, source || null, color || '#d98cff', { damageType: options.damageType || 'magic', canCrit: false, ...(options.damageOptions || {}) });
          if (options.status) { try { this.applyStatusEffect?.(a, { ...options.status }, source || null); } catch (_e) {} }
          hit++;
        }
        return hit;
      };

      Game.prototype.enemyAoeStatus = function(x, y, radius, effect, source) {
        return this.enemyAoeDamage(x, y, radius, 0, source, effect?.color, { status: effect });
      };

      // Party EXP Bond Bonus: single canonical award path for the party-size
      // XP bonus. Callers pass in `baseExp` already adjusted for any other
      // existing bonus (e.g. the pre-existing human-race +2%, computed the
      // same way it always was at each call site) so this function's only
      // job is applying the party bonus and incrementing player.xp - it
      // does not re-derive or duplicate the race bonus.
      // Active non-player party members (bots and remote players - NOT
      // mercenaries/pets, which are explicitly non-slot-consuming followers
      // elsewhere in the party system) each add +1%, capped at +5% since
      // the party caps at 6 total members and the player is one of them.
      Game.prototype.awardPlayerXp = function(baseExp, options = {}) {
        const p = this.player;
        const base = Math.max(0, Math.floor(Number(baseExp) || 0));
        if (!p || base <= 0) return { amount: 0, partyBonusPercent: 0, logText: '+0 XP' };
        const activeBonusMemberCount = Math.min(5, Math.max(0, this.getActiveExpBonusPartyMemberCount?.() || 0));
        const partyBonusPercent = activeBonusMemberCount * 0.01;
        // V0.18.88 (Roadmap Item 4 D): Dark Woods Wanderer full-set bonus adds a flat XP multiplier
        // here, on the single canonical award path, so it applies uniformly to every XP source.
        const wandererXpPercent = this.hasFullArmorSet?.('dark_woods_wanderer')
          ? (window.DreamRealms?.ARMOR_SETS?.dark_woods_wanderer?.bonus?.xpPercent || 0) : 0;
        const finalExp = Math.floor(base * (1 + partyBonusPercent + wandererXpPercent));
        p.xp += finalExp;
        const label = options.sourceLabel ? `${options.sourceLabel} ` : '';
        let logText = `${label}+${finalExp} XP`;
        if (partyBonusPercent > 0) logText += ` (Party Bond Bonus: +${Math.round(partyBonusPercent * 100)}%)`;
        if (wandererXpPercent > 0) logText += ` (Wanderer Set: +${Math.round(wandererXpPercent * 100)}%)`;
        return { amount: finalExp, partyBonusPercent, wandererXpPercent, logText };
      };

      Game.prototype.killEntity = function(target, source) {
        if (target && (target.kind === 'player' || target.kind === 'bot')) {
          target.deathZone = this.currentZone || 'overworld';
          target.deathDungeonId = this.currentZone === 'dungeon' ? String(this.activeDungeon?.id || this.dungeonSystem?.state?.active?.dungeonId || '') : '';
          target.deathDungeonFloor = this.currentZone === 'dungeon' ? Math.max(1, Math.floor(Number(this.activeDungeon?.floor || this.dungeonSystem?.state?.active?.floor || 1))) : null;
        }
        if (typeof DR.markActorDeathState === 'function') DR.markActorDeathState(target, { state: target.kind === 'player' ? 'player-dead' : 'dead' });
        else {
          target.alive = false;
          target.dead = true;
          target.isDead = true;
          target.hidden = false;
          target.visible = true;
          target.renderable = true;
          target.spriteVisible = true;
          target.hp = 0;
          target.deadTimer = 0;
          target.deathProgress = 1;
          target.deathState = 'dead';
          target.action = 'death';
        }
        if (target.kind === 'player' && Array.isArray(this.entities) && !this.entities.includes(target)) this.entities.push(target);
        // V0.17.69 Talents: onKill capstone trigger (killer = player only).
        if (source === this.player && target !== this.player) this.fireTalentProc?.('onKill', { target, source });
        this.clearThreatForEntity?.(target);
        if (target.kind === 'enemy') this.resetThreatForEnemy?.(target);
        if (target.kind === 'player' && this.performanceSettings?.().dpsMeterResetOnPlayerDeath !== false) this.resetDpsMeter?.('player death');
        const petOwner = (this.botPlayers || []).find(bot => bot?.botPet === target || (bot?.botPetId && String(bot.botPetId) === String(target.id)));
        if (petOwner && petOwner.alive !== false) this.queueBotSpeechEvent?.(petOwner, 'petDied', { priority: 3, required: true });
        if (target.kind === 'player' || target.kind === 'bot') {
          const eventType = target.kind === 'player' ? 'playerDeath' : 'botDeath';
          for (const bot of this.botPlayers || []) {
            if (bot === target || !this.isBotInParty?.(bot) || bot.alive === false) continue;
            if (this.queueBotSpeechEvent?.(bot, eventType, { priority: 4 })) break;
          }
        }
        if (target.kind === 'enemy' && this.player?.targetId === target.id) {
          this.player.autoAttack = false;
          this.player.autoAttackToggle = false;
          this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
          this.player.targetId = null;
          this.player.combatCooldown = 0;
          if (this.merc) this.merc.combatCooldown = 0;
          if (this.pet) this.pet.combatCooldown = 0;
        }

        if (target.kind === 'enemy') {
          this.playSfx?.('enemy_die', { x: target.x, y: target.y, volume: target.elite || target.dungeonBoss ? 0.5 : 0.34, rate: target.elite || target.dungeonBoss ? 0.78 : 0.95, cooldown: 0.09 });
          const xp = target.baseType.xp + target.level * 4;
          let xpAward = this.awardPartyEnemyXp?.(xp, target, source) || null;
          if (!xpAward) {
            const raceAdjustedXp = this.player.raceId === 'human' ? Math.max(1, Math.floor(xp * 1.02)) : xp;
            xpAward = this.awardPlayerXp(raceAdjustedXp);
            if (this.merc && this.merc.alive) this.awardMercXp?.(Math.max(1, Math.floor(xp * 0.72)), target);
          }
          if (source?.kind === 'bot') {
            if (!xpAward?.botXp && !xpAward?.botSourceHandled) this.awardBotXp?.(source, Math.max(1, Math.floor(xp * 0.90)), target);
            source.recordQuestKill?.(this, target);
            this.queueBotSpeechEvent?.(source, 'enemyKilled', { priority: 1 });
          }
          const lootResult = typeof this.rollEnemyLoot === 'function'
            ? this.rollEnemyLoot(target)
            : { currencyCopper: Math.max(1, target.level * 8), gold: 0, summary: 'currency', tableId: null, items: [] };
          if (source?.kind === 'bot') this.handleBotEnemyLoot?.(source, target, lootResult);
          target.corpseLoot = {
            tableId: lootResult.tableId || null,
            tableName: lootResult.tableName || '',
            currencyCopper: Math.max(0, Math.floor(Number(lootResult.currencyCopper) || 0)),
            currency: lootResult.currency || this.splitCopperValueIntoCurrency?.(lootResult.currencyCopper || 0) || null,
            gold: 0,
            items: Array.isArray(lootResult.items) ? lootResult.items.map(entry => ({ ...entry, taken: false })) : [],
            summary: lootResult.summary || 'nothing',
            looted: false
          };
          const partyLootPolicy = this.tagCorpseLootForParty?.(target, lootResult, source);
          this.spawnCorpseBurst(target.x, target.y);
          this.registerLootableCorpse?.(target, lootResult);
          this.notifyExternalSystems?.('enemy-killed', {
            id: target.id,
            name: target.name,
            baseName: target.baseType?.name || target.name,
            level: target.level,
            zoneId: this.currentZone === 'dungeon' ? (this.activeDungeon?.id || this.dungeonRuntimeState?.active?.dungeonId || 'dungeon') : this.currentZone === 'cave' ? (this.getActiveCaveZoneKey?.() || this.currentCave?.id || 'mossfang_cave') : 'dark_woods',
            enemy: target,
            lootTableId: lootResult.tableId || null,
            loot: lootResult
          });
          this.logCombat(`${target.name} defeated. ${xpAward?.logText || `+${xp} XP`}.`);
          if (partyLootPolicy?.partyLoot) this.logParty?.(`${target.name} corpse loot is party-tagged for ${partyLootPolicy.eligibleIds.length} eligible member${partyLootPolicy.eligibleIds.length === 1 ? '' : 's'}.`);
          if (this.corpseLootHasItems?.(target)) {
            this.tryOpenCorpseLootOnDeath?.(target);
            this.logCombat(`${target.name}'s corpse has loot: ${lootResult.summary}. Stand near the corpse and press E to open Corpse Loot.`);
          } else this.logCombat(`${target.name}'s corpse has no loot.`);
          this.checkLevelUp();
        } else if (target.kind === 'player') {
          this.playSfx?.('enemy_die', { x: target.x, y: target.y, volume: 0.52, rate: 0.7, cooldown: 0.1 });
          this.beginPlayerRespawn();
        } else if (target.kind === 'merc') {
          this.markMercenaryDowned?.(target);
        } else if (target.kind === 'pet') {
          this.playSfx?.('enemy_die', { x: target.x, y: target.y, volume: 0.28, rate: 1.15, cooldown: 0.1 });
          this.spawnCorpseBurst?.(target.x, target.y);
          this.spawnRing?.(target.x, target.y, '#d8e5b4', 18);
          this.entities = (this.entities || []).filter(entity => entity !== target);
          if (this.pet === target) this.pet = null;
          this.logCombat(`${target.name} crumbles away.`);
        } else if (target.kind === 'bot') {
          this.playSfx?.('enemy_die', { x: target.x, y: target.y, volume: 0.32, rate: 0.82, cooldown: 0.1 });
          this.spawnCorpseBurst?.(target.x, target.y);
          target.respawnTimer = Math.max(6, Number(target.respawnTimer || 8));
          target.botState = 'downed';
          this.logParty?.(`${target.name} was downed and will recover at ${target.deathDungeonId === 'silk_web_cavern' ? 'the cavern entrance' : 'camp'}.`);
        } else {
          this.logCombat(`${target.name} has fallen.`);
        }
      };

      Game.prototype.ensureDeathRespawnOverlay = function() {
        if (typeof document === 'undefined') return null;
        let overlay = document.getElementById('deathRespawnOverlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'deathRespawnOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;z-index:12000;pointer-events:none;background:radial-gradient(circle at center,rgba(0,0,0,.18),rgba(0,0,0,.42));';
        overlay.innerHTML = '<div style="pointer-events:auto;min-width:260px;max-width:360px;padding:18px 20px;border:1px solid rgba(255,255,255,.28);border-radius:14px;background:rgba(16,18,30,.92);box-shadow:0 18px 50px rgba(0,0,0,.45);text-align:center;color:#f4ecd8;font-family:inherit;"><div style="font-size:22px;font-weight:800;margin-bottom:8px;letter-spacing:.02em;">You have fallen</div><div id="deathRespawnStatus" style="font-size:13px;line-height:1.35;color:#d8cba8;margin-bottom:14px;">Waiting for resurrection...</div><button id="respawnAtCampButton" type="button" style="cursor:pointer;border:1px solid rgba(255,224,138,.55);border-radius:10px;background:linear-gradient(180deg,#3e315f,#251f3d);color:#ffe8aa;font-weight:800;padding:10px 16px;min-width:178px;box-shadow:0 0 18px rgba(143,99,255,.25);">Respawn at Camp</button></div>';
        const button = overlay.querySelector('#respawnAtCampButton');
        button?.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          this.playerAwaitingRespawn = false;
          this.playerRespawnTimer = 0;
          this.respawnPlayerAtCamp?.();
        });
        document.body.appendChild(overlay);
        return overlay;
      };

      Game.prototype.hasAvailableBotResurrectionForPlayer = function() {
        if (!this.player || this.player.alive !== false) return false;
        for (const bot of this.botPlayers || []) {
          if (!alive(bot) || this.isBotInParty?.(bot) !== true) continue;
          if (bot.botPendingCast?.spell?.kind === 'revive' && bot.botPendingCast.ally === this.player) return true;
          if (this.botReviveSpellFor?.(bot)) return true;
        }
        return false;
      };

      Game.prototype.refreshDeathRespawnOverlay = function() {
        const overlay = this.ensureDeathRespawnOverlay?.();
        if (!overlay) return false;
        const dead = Boolean(this.player && this.player.alive === false);
        overlay.style.display = dead ? 'grid' : 'none';
        if (dead) {
          const status = overlay.querySelector('#deathRespawnStatus');
          if (status) status.textContent = this.hasAvailableBotResurrectionForPlayer?.() ? 'Waiting for resurrection...' : 'No resurrection is currently available. You can respawn at camp.';
        }
        return dead;
      };

      Game.prototype.beginPlayerRespawn = function() {
        if (this.playerAwaitingRespawn === true) return;
        if (this.player) {
          this.player.autoAttack = false;
          this.player.autoAttackToggle = false;
          this.player.autoAttackAutoEngaged = false;
          this.clearPlayerAutoAttackVisualState?.(this.player);
        }
        this.playerRespawnTimer = 0;
        this.playerAwaitingRespawn = true;
        this.refreshDeathRespawnOverlay?.();
        this.logCombat(this.player?.deathDungeonId === 'silk_web_cavern' ? 'You were slain. Waiting for resurrection or respawn at the Silk Web Cavern entrance.' : 'You were slain. Waiting for resurrection or respawn at camp.');
      };

      Game.prototype.updatePlayerRespawn = function(dt) {
        if (this.player && this.player.alive === false) {
          this.refreshDeathRespawnOverlay?.();
          return;
        }
        if (this.playerAwaitingRespawn || this.playerRespawnTimer > 0) {
          this.playerAwaitingRespawn = false;
          this.playerRespawnTimer = 0;
          this.refreshDeathRespawnOverlay?.();
        }
      };

      Game.prototype.findDreamSpiritRespawnPoint = function() {
        const grid = this.editorNpcs?.dark_woods || {};
        const bound = this.boundDreamSpirit;
        if (bound && Number.isFinite(Number(bound.x)) && Number.isFinite(Number(bound.y))) return { x: Number(bound.x) + 0.5, y: Number(bound.y) + 0.5 };
        for (const node of Object.values(grid)) {
          if (!node) continue;
          const id = String(node.npcId || node.id || '').toLowerCase();
          const role = String(node.role || '').toLowerCase();
          if (role === 'dream_spirit' || id.includes('dream_spirit')) return { x: Number(node.x || CONFIG.START_X) + 0.5, y: Number(node.y || CONFIG.START_Y) + 0.5 };
        }
        return null;
      };

      Game.prototype.restoreActorAfterRespawn = function(actor) {
        if (!actor) return false;
        DR.restoreActorLiveState?.(actor);
        // V0.16.62: resolve max HP at the respawn owner after level/equipment/
        // companion scaling can update actor.maxHp, then restore full health.
        if (actor === this.player && typeof this.recalculatePlayerStats === 'function') this.recalculatePlayerStats();
        else if (typeof actor.recalculateFromLevel === 'function') actor.recalculateFromLevel();
        const resolvedMaxHp = Math.max(1, Math.floor(Number(actor.maxHp || actor.baseMaxHp || actor.hp || 1)));
        actor.maxHp = Math.max(resolvedMaxHp, Math.floor(Number(actor.maxHp || resolvedMaxHp)));
        actor.hp = actor.maxHp;
        actor.target = null;
        actor.targetId = null;
        actor.forcedTargetId = null;
        actor.combatTargetId = null;
        actor.combatCooldown = 0;
        actor.attackTimer = 0;
        actor.castTimer = 0;
        actor.meditating = false;
        actor.isMeditating = false;
        actor.isSitting = false;
        actor.isResting = false;
        actor.isRecovering = false;
        actor.wantsToMeditate = false;
        actor.meditationState = 'none';
        actor.recoveryState = 'none';
        actor.restState = 'none';
        actor.vx = 0;
        actor.vy = 0;
        this.clearDeathStatusEffects?.(actor);
        this.clearActorPathState?.(actor);
        return true;
      };

      Game.prototype.isResurrectableFriendlyActor = function(actor) {
        if (!actor) return false;
        const kind = actorKind(actor);
        if (actor === this.player || kind === 'player') return true;
        if (actor === this.merc || kind === 'merc') return actor === this.merc;
        if (kind === 'bot') return this.isBotInParty?.(actor) === true;
        if (kind === 'remote') return this.isPartyActor?.(actor) === true;
        return false;
      };

      Game.prototype.deadFriendlyActors = function() {
        const actors = [this.player, this.merc, ...(this.botPlayers || [])];
        for (const id of this.partyMembers || []) {
          if (String(id) === String(this.localPeerId)) continue;
          actors.push(this.remotePlayers?.get?.(id));
        }
        return actors.filter((actor, index, list) => actor && actor.alive === false && this.isResurrectableFriendlyActor?.(actor) && list.indexOf(actor) === index);
      };

      Game.prototype.getReviveTarget = function(caster = this.player) {
        const id = this.player?.targetId;
        if (!id) return null;
        return this.deadFriendlyActors?.().find(actor => String(actor.id) === String(id) || String(actor.botId || actor.remoteId || '') === String(id)) || null;
      };

      Game.prototype.canReviveTarget = function(caster, target, range = 6) {
        if (!alive(caster) || !target || target.alive !== false || !this.isResurrectableFriendlyActor?.(target)) return false;
        if (!['player', 'bot', 'merc', 'remote'].includes(actorKind(target))) return false;
        if (!Number.isFinite(Number(target.x)) || !Number.isFinite(Number(target.y)) || dist(caster, target) > Number(range || 6) + 0.05) return false;
        if (this.companionHasClearCombatLine) return this.companionHasClearCombatLine(caster, target, { desiredRange: range, requireLineOfSight: true }) !== false;
        return !this.hasLineWalkPath || this.hasLineWalkPath(caster.x, caster.y, target.x, target.y, caster) === true;
      };

      Game.prototype.reviveFriendlyActor = function(target, options = {}) {
        const caster = options.caster || this.player;
        if (!this.canReviveTarget?.(caster, target, options.range || 6)) return false;
        this.restoreActorAfterRespawn?.(target);
        if (this.currentZone === 'dungeon' && this.dungeonSystem?.isValidActorPlacement && !this.dungeonSystem.isValidActorPlacement(target.x, target.y, { ignoreActor: target, allowReserved: true, avoidActors: false })) {
          const safe = this.dungeonSystem.findActorPlacementNear?.(options.caster?.x ?? target.x, options.caster?.y ?? target.y, { radius: 10, actorId: `revive:${target.id || target.name}`, ignoreActor: target, minActorSpacing: 1.1 });
          if (safe) { target.x = safe.x; target.y = safe.y; }
        }
        target.hp = Math.max(1, Math.floor(Number(target.maxHp || 1) * Math.max(0.05, Math.min(1, Number(options.hpPct || 0.35)))));
        target.mana = Math.max(0, Math.floor(Number(target.maxMana || 0) * Math.max(0, Math.min(1, Number(options.manaPct || 0.25)))));
        target.respawnTimer = 0;
        target.reviveTimer = 0;
        target.reviveReservedBy = null;
        target.reviveReservedUntil = 0;
        target.botState = target.kind === 'bot' ? (this.isBotInParty?.(target) ? 'following-party' : 'recovered') : target.botState;
        target.currentActivityLabel = target.kind === 'bot' ? 'Revived' : target.currentActivityLabel;
        if (target.kind === 'player') {
          this.playerRespawnTimer = 0;
          this.playerAwaitingRespawn = false;
          this.refreshDeathRespawnOverlay?.();
        }
        this.spawnRing?.(target.x, target.y, options.color || '#f7f1c5', 20);
        this.spawnStatusPulse?.(target, options.color || '#f7f1c5', options.label || 'Revived');
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.updateUI?.();
        this.renderPartyHud?.({ force: true });
        return true;
      };

      Game.prototype.respawnPlayerAtCamp = function() {
        if (!this.player) return;
        const dungeonCheckpoint = this.dungeonSystem?.getRespawnCheckpoint?.(this.player) || null;
        if (!dungeonCheckpoint && this.currentZone !== 'overworld') {
          this.currentZone = 'overworld';
          this.map = this.overworldMap;
          this.objects = this.overworldObjects;
          this.setActiveEnemySet(this.overworldEnemies);
          this.staticMinimap = this.buildStaticMinimap();
          this.mapDirty = true;
        }
        const point = dungeonCheckpoint || this.findDreamSpiritRespawnPoint?.() || { x: CONFIG.START_X + 0.5, y: CONFIG.START_Y + 0.5 };
        this.player.respawnAt(point.x, point.y);
        this.playerAwaitingRespawn = false;
        this.playerRespawnTimer = 0;
        this.refreshDeathRespawnOverlay?.();
        this.restoreActorAfterRespawn?.(this.player);
        this.player.autoAttack = false;
        this.player.autoAttackToggle = false;
        this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
        this.player.combatCooldown = 0;
        this.clearDeathStatusEffects?.(this.player);
        this.clearActorPathState?.(this.player);
        this.player.deathZone = null;
        this.player.deathDungeonId = null;
        this.player.deathDungeonFloor = null;
        if (this.merc) { this.merc.x = this.player.x + 1.1; this.merc.y = this.player.y + 0.8; this.restoreActorAfterRespawn?.(this.merc); }
        if (this.pet) { this.pet.x = this.player.x - 0.8; this.pet.y = this.player.y + 0.8; this.restoreActorAfterRespawn?.(this.pet); }
        this.camera.shake = 0;
        if (this.camera) { this.camera.x = this.player.x; this.camera.y = this.player.y; }
        this.updateUI?.();
        this.logCombat(dungeonCheckpoint ? `You recover at the Silk Web Cavern floor ${dungeonCheckpoint.floor} entrance.` : 'You return to the Dream Spirit.');
      };

      Game.prototype.checkLevelUp = function() {
        if (!this.player) return;
        const oldLevel = Math.max(1, Math.floor(Number(this.player.level) || 1));
        let finalLevel = oldLevel;
        let leveled = false;
        while (this.player.xp >= this.player.nextXp) {
          this.player.xp -= this.player.nextXp;
          this.player.level += 1;
          finalLevel = Math.max(finalLevel, Math.max(1, Math.floor(Number(this.player.level) || 1)));
          leveled = true;
          this.player.nextXp = Math.floor(this.player.nextXp * 1.35 + 40);
          const hpGain = 12 + Math.floor(this.player.level * 2);
          const manaGain = this.player.maxMana > 0 ? 8 + this.player.level : 0;
          this.player.baseMaxHp = (this.player.baseMaxHp ?? this.player.maxHp) + hpGain;
          this.player.baseMaxMana = (this.player.baseMaxMana ?? this.player.maxMana) + manaGain;
          this.player.baseAttack = (this.player.baseAttack ?? this.player.attack) + 2;
          this.player.baseDefense = (this.player.baseDefense ?? this.player.defense) + 1;
          if (typeof this.recalculatePlayerStats === 'function') this.recalculatePlayerStats();
          else {
            this.player.maxHp += hpGain;
            this.player.maxMana += manaGain;
            this.player.attack += 2;
            this.player.defense += 1;
          }
          this.player.hp = this.player.maxHp;
          this.player.mana = this.player.maxMana;
          this.spawnRing(this.player.x, this.player.y, '#ffe08a', 28);
          this.playSfx?.('level_up', { x: this.player.x, y: this.player.y, volume: 0.52, cooldown: 0.3 });
          this.logCombat(`Level ${this.player.level}. Stats increased.`);
        }
        // V0.17.69 Talents: 1 point per level from 5 to 20 (derived from level -
        // nothing to grant). Notify once per level-up batch, not per level.
        if (leveled && this.player.level >= 5 && (this.talentPointsAvailable?.() ?? 0) > 0) {
          this.log?.(`Talent point available (${this.talentPointsAvailable()}). Press N.`, 'System');
          this.flashTalentPointPip?.();
        }
        if (leveled && finalLevel > oldLevel) {
          this.log?.(`You have reached Combat Level ${finalLevel}!`, 'System');
          this.showCombatLevelUpPopup?.(finalLevel);
        }
      };
    }
  };
})();
