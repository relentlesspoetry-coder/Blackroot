// Dream Realms external effects and combat-feedback system
// Extracted from the V0.10.3 stable baseline without changing runtime behavior.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.EffectsSystem = {
    install(Game) {
      Game.prototype.effectBudgetLimits = function() {
        const cfg = window.DreamRealms?.CONFIG || {};
        const perf = this.performanceSettings?.() || cfg.PERFORMANCE || {};
        return {
          effects: Math.max(96, Math.floor(Number(perf.maxActiveEffects || cfg.MAX_ACTIVE_EFFECTS) || 460)),
          damageText: Math.max(24, Math.floor(Number(perf.maxDamageText || cfg.MAX_DAMAGE_TEXT) || 96))
        };
      };

      Game.prototype.runtimeMemoryPoolLimits = function() {
        const cfg = window.DreamRealms?.CONFIG || {};
        const perf = this.performanceSettings?.() || cfg.PERFORMANCE || {};
        return {
          enabled: perf.enableRuntimeMemoryPools !== false,
          effectPool: Math.max(64, Math.floor(Number(perf.effectPoolMaxEntries || 640) || 640)),
          damageTextPool: Math.max(32, Math.floor(Number(perf.damageTextPoolMaxEntries || 192) || 192))
        };
      };

      Game.prototype.nextEffectSeed = function(seedHint = 0) {
        this._effectSeedCounter = (Number(this._effectSeedCounter || 0) + 1) % 1000000;
        const t = Number(this.time || 0) * 997.13;
        const h = Number(seedHint || 0) * 37.77;
        return (this._effectSeedCounter * 131.542 + t + h) % 1000000;
      };

      Game.prototype.decorateEffectVisualPayload = function(effect, payload = {}) {
        if (!effect) return effect;
        effect.color2 = payload.color2 || effect.color2 || '';
        effect.kind = payload.kind || effect.kind || '';
        effect.style = payload.style || effect.style || '';
        effect.school = payload.school || payload.damageType || effect.school || '';
        // V0.20.21: falls back to the casting class published by resolveClassSpell. vfxStyle() keys
        // its palette off sourceClass, and 98 of 99 spawnRing callers never passed one, so every
        // un-revamped caster resolved to the generic default. An explicit payload still wins, so a
        // class with bespoke VFX (Assassin V0.18.29, Cleric V0.18.31) keeps its designed look.
        // Not defaulted from effect.sourceClass: effects are pooled, and that would inherit the
        // previous caster's class - the same reset hazard spawnBolt documents for travelDuration.
        effect.sourceClass = payload.sourceClass || payload.className || this._spellVfxSourceClass || '';
        effect.scale = Math.max(0.05, Number(payload.scale || effect.scale || 1));
        effect.intensity = Math.max(0.05, Number(payload.intensity || effect.intensity || 1));
        effect.height = Number(payload.height ?? effect.height ?? 0) || 0;
        effect.depthBias = Number(payload.depthBias ?? effect.depthBias ?? 0) || 0;
        effect.impactDuration = Number(payload.impactDuration || effect.impactDuration || 0);
        effect.seed = Number(payload.seed ?? effect.seed ?? this.nextEffectSeed?.(effect.x + effect.y + effect.x2 + effect.y2)) || 0;
        return effect;
      };

      Game.prototype.ensureRuntimeMemoryStats = function() {
        if (!this.runtimeMemoryStats) {
          this.runtimeMemoryStats = {
            effectsReused: 0,
            effectsRecycled: 0,
            effectsExpired: 0,
            effectsDropped: 0,
            damageTextReused: 0,
            damageTextRecycled: 0,
            damageTextDropped: 0,
            arraysCompacted: 0,
            poolTrims: 0
          };
        }
        return this.runtimeMemoryStats;
      };

      Game.prototype.obtainRuntimeEffect = function(type = '') {
        const limits = this.runtimeMemoryPoolLimits?.() || { enabled: true, effectPool: 640 };
        const pool = this._effectPool || (this._effectPool = []);
        const stats = this.ensureRuntimeMemoryStats?.();
        const entry = limits.enabled && pool.length ? pool.pop() : {};
        if (stats && entry) stats.effectsReused += entry.__pooled ? 1 : 0;
        entry.__pooled = true;
        entry.type = String(type || '');
        entry.x = 0;
        entry.y = 0;
        entry.x2 = 0;
        entry.y2 = 0;
        entry.vx = 0;
        entry.vy = 0;
        entry.color = '#ffffff';
        entry.color2 = '';
        entry.kind = '';
        entry.style = '';
        entry.school = '';
        entry.sourceClass = '';
        entry.seed = 0;
        entry.radius = 0;
        entry.scale = 1;
        entry.intensity = 1;
        entry.height = 0;
        entry.depthBias = 0;
        entry.travelDuration = 0;
        entry.impactDuration = 0;
        entry.followId = null;
        entry.sourceId = null;
        entry.targetId = null;
        entry.t = 0;
        entry.life = 0;
        return entry;
      };

      Game.prototype.recycleEffectEntry = function(entry) {
        if (!entry) return;
        // Bard meditation aura effects are tracked by a side map. Do not pool them,
        // otherwise a reused object could still be referenced by the old aura key.
        if (entry.type === 'bardMeditationAura' || entry.actorKey) return;
        const limits = this.runtimeMemoryPoolLimits?.() || { enabled: true, effectPool: 640 };
        if (!limits.enabled) return;
        const pool = this._effectPool || (this._effectPool = []);
        if (pool.length >= limits.effectPool) return;
        for (const key of Object.keys(entry)) {
          if (key !== '__pooled') delete entry[key];
        }
        entry.__pooled = true;
        pool.push(entry);
        const stats = this.ensureRuntimeMemoryStats?.();
        if (stats) stats.effectsRecycled += 1;
      };

      Game.prototype.recycleDamageTextEntry = function(entry) {
        if (!entry) return;
        const limits = this.runtimeMemoryPoolLimits?.() || { enabled: true, damageTextPool: 192 };
        if (!limits.enabled) return;
        const pool = this._damageTextPool || (this._damageTextPool = []);
        if (pool.length >= limits.damageTextPool) return;
        entry.x = 0;
        entry.y = 0;
        entry.text = '';
        entry.color = '#ffffff';
        entry.t = 0;
        entry.life = 0;
        entry.__pooled = true;
        pool.push(entry);
        const stats = this.ensureRuntimeMemoryStats?.();
        if (stats) stats.damageTextRecycled += 1;
      };

      Game.prototype.addEffect = function(effect) {
        if (!effect || !Array.isArray(this.effects)) return null;
        const limits = this.runtimeMemoryPoolLimits?.() || { enabled: true };
        if (limits.enabled && !effect.__pooled && effect.type !== 'bardMeditationAura' && !effect.actorKey) {
          const pooled = this.obtainRuntimeEffect?.(effect.type || '') || {};
          Object.assign(pooled, effect);
          pooled.__pooled = true;
          effect = pooled;
        }
        const limit = this.effectBudgetLimits?.().effects || 460;
        if (this.effects.length >= limit) {
          let dropIndex = -1;
          for (let i = 0; i < this.effects.length; i++) {
            const type = String(this.effects[i]?.type || '');
            if (/spark|particle|dust|mote|note/i.test(type)) { dropIndex = i; break; }
          }
          if (dropIndex < 0) dropIndex = 0;
          const dropped = this.effects.splice(dropIndex, 1)[0];
          this.recycleEffectEntry?.(dropped);
          const stats = this.ensureRuntimeMemoryStats?.();
          if (stats) stats.effectsDropped += 1;
        }
        this.effects.push(effect);
        return effect;
      };

      Game.prototype.addDamageText = function(text) {
        if (!text || !Array.isArray(this.damageText)) return null;
        const limit = this.effectBudgetLimits?.().damageText || 96;
        while (this.damageText.length >= limit) {
          this.recycleDamageTextEntry?.(this.damageText.shift());
          const stats = this.ensureRuntimeMemoryStats?.();
          if (stats) stats.damageTextDropped += 1;
        }
        let entry = text;
        const limits = this.runtimeMemoryPoolLimits?.() || { enabled: true };
        if (limits.enabled && !text.__pooled) {
          const pool = this._damageTextPool || (this._damageTextPool = []);
          entry = pool.pop() || {};
          if (entry.__pooled) {
            const stats = this.ensureRuntimeMemoryStats?.();
            if (stats) stats.damageTextReused += 1;
          }
          entry.__pooled = true;
          entry.x = Number(text.x) || 0;
          entry.y = Number(text.y) || 0;
          entry.text = String(text.text || '');
          entry.color = text.color || '#ffffff';
          entry.t = Number(text.t) || 0;
          entry.life = Math.max(0.05, Number(text.life) || 0.85);
        }
        this.damageText.push(entry);
        return entry;
      };

      Game.prototype.spawnDamageText = function(x, y, text, color = '#ffffff', life = 0.85) {
        const pool = this._damageTextPool || (this._damageTextPool = []);
        const entry = pool.pop() || {};
        const stats = this.ensureRuntimeMemoryStats?.();
        if (stats && entry.__pooled) stats.damageTextReused += 1;
        entry.__pooled = true;
        entry.x = Number(x) || 0;
        entry.y = Number(y) || 0;
        entry.text = String(text || '');
        entry.color = color || '#ffffff';
        entry.t = 0;
        entry.life = Math.max(0.05, Number(life) || 0.85);
        return this.addDamageText(entry);
      };

      Game.prototype.updateEffects = function(dt) {
        const effects = Array.isArray(this.effects) ? this.effects : (this.effects = []);
        const damage = Array.isArray(this.damageText) ? this.damageText : (this.damageText = []);
        const safeDt = Math.max(0, Math.min(Number(dt) || 0, 0.10));
        const stats = this.ensureRuntimeMemoryStats?.();
        let followMap = null;
        let write = 0;
        let expiredEffects = 0;
        for (let i = 0; i < effects.length; i++) {
          const e = effects[i];
          if (!e) continue;
          if (e.followId && Array.isArray(this.entities)) {
            if (!followMap) {
              followMap = this._effectFollowMap || (this._effectFollowMap = new Map());
              followMap.clear();
              const followSources = [
                ...(Array.isArray(this.entities) ? this.entities : []),
                ...(Array.isArray(this.enemies) ? this.enemies : []),
                ...(Array.isArray(this.botPlayers) ? this.botPlayers : []),
                this.player, this.pet, this.merc
              ];
              for (const actor of followSources) if (actor?.id && actor.alive !== false) followMap.set(actor.id, actor);
            }
            const follow = followMap.get(e.followId);
            if (follow) { e.x = follow.x; e.y = follow.y; }
          }
          if (e.delay > 0) { e.delay = Math.max(0, Number(e.delay) - safeDt); effects[write++] = e; continue; } // hold staggered-burst effects until their delay elapses
          e.t = Number(e.t || 0) + safeDt;
          if (e.t < Number(e.life || 0)) effects[write++] = e;
          else {
            expiredEffects += 1;
            this.recycleEffectEntry?.(e);
          }
        }
        if (effects.length !== write && stats) stats.arraysCompacted += 1;
        effects.length = write;
        if (stats) stats.effectsExpired += expiredEffects;

        write = 0;
        for (let i = 0; i < damage.length; i++) {
          const d = damage[i];
          if (!d) continue;
          d.t = Number(d.t || 0) + safeDt;
          d.y = Number(d.y || 0) - safeDt * 0.7;
          if (d.t < Number(d.life || 0)) damage[write++] = d;
          else this.recycleDamageTextEntry?.(d);
        }
        if (damage.length !== write && stats) stats.arraysCompacted += 1;
        damage.length = write;

        const limits = this.effectBudgetLimits?.() || { effects: 460, damageText: 96 };
        if (effects.length > limits.effects) {
          const removeCount = effects.length - limits.effects;
          for (let i = 0; i < removeCount; i++) this.recycleEffectEntry?.(effects[i]);
          effects.copyWithin(0, removeCount);
          effects.length = limits.effects;
          if (stats) {
            stats.effectsDropped += removeCount;
            stats.arraysCompacted += 1;
          }
        }
        while (damage.length > limits.damageText) {
          this.recycleDamageTextEntry?.(damage.shift());
          if (stats) stats.damageTextDropped += 1;
        }
        if (this.camera) this.camera.shake = Math.max(0, this.camera.shake - safeDt * 20);
      };

      // V0.20.29 (Roadmap Item 6): shared bespoke motif burst for the five remaining casters. Same
      // isolated-effect-type discipline as the Wizard's; motif picks the visual (leaf/lunar/arc/etc).
      Game.prototype.spawnCasterMotifEffect = function(x, y, motif, options = {}) {
        const effect = this.obtainRuntimeEffect?.('casterMotif') || { type: 'casterMotif' };
        effect.type = 'casterMotif';
        effect.x = Number(x) || 0;
        effect.y = Number(y) || 0;
        effect.x2 = effect.x;
        effect.y2 = effect.y;
        effect.motif = String(motif || 'nature');
        effect.color = options.color || '';
        effect.radius = Math.max(2, Number(options.radius || 26));
        effect.scale = Math.max(0.05, Number(options.scale || 1));
        effect.height = Number(options.height ?? 0.04) || 0.04;
        effect.seed = Number(options.seed ?? this.nextEffectSeed?.(effect.x + effect.y)) || 0;
        effect.t = 0;
        effect.life = Math.max(0.2, Number(options.life || 0.62));
        this.addEffect(effect);
        return effect;
      };

      // V0.20.28 (Roadmap Item 6): bespoke Wizard elemental burst at a point. Isolated effect type so
      // it themes fire/frost/lightning/arcane distinctly without disturbing the shared palette system.
      Game.prototype.spawnWizardElementEffect = function(x, y, element, options = {}) {
        const effect = this.obtainRuntimeEffect?.('wizardElement') || { type: 'wizardElement' };
        effect.type = 'wizardElement';
        effect.x = Number(x) || 0;
        effect.y = Number(y) || 0;
        effect.x2 = effect.x;
        effect.y2 = effect.y;
        effect.element = String(element || 'arcane');
        effect.color = options.color || '';
        effect.radius = Math.max(2, Number(options.radius || 26));
        effect.scale = Math.max(0.05, Number(options.scale || 1));
        effect.height = Number(options.height ?? 0.04) || 0.04;
        effect.seed = Number(options.seed ?? this.nextEffectSeed?.(effect.x + effect.y)) || 0;
        effect.t = 0;
        effect.life = Math.max(0.2, Number(options.life || 0.62));
        this.addEffect(effect);
        return effect;
      };

      Game.prototype.spawnRing = function(x, y, color, radius, options = {}) {
        const effect = this.obtainRuntimeEffect?.('ring') || { type: 'ring' };
        effect.x = Number(x) || 0;
        effect.y = Number(y) || 0;
        effect.x2 = effect.x;
        effect.y2 = effect.y;
        effect.color = color || options.color || '#ffffff';
        effect.radius = Math.max(1, Number(radius || options.radius || 16));
        // V0.20.23: an OPTIONAL world-space radius, in tiles. When set, the renderer sizes the ring
        // from the real projection so the drawn edge is the damage edge (Roadmap Item 6: "a
        // ground-targeted spell must show the correct affected area"). The positional `radius`
        // argument above is SCREEN PIXELS and stays that way - passing spell.radius into it is the
        // unit confusion this exists to end. Always assigned, never defaulted from the pooled effect:
        // a recycled ring must not inherit the last cast's blast size.
        effect.worldRadius = Math.max(0, Number(options.worldRadius ?? this._spellVfxAreaRadius) || 0);
        effect.t = 0;
        effect.life = Math.max(0.20, Number(options.life || 0.68));
        this.decorateEffectVisualPayload?.(effect, options);
        this.addEffect(effect);
      };

      // V0.19.8 (Roadmap Item 6): a cone attack must VISIBLY use its real cone dimensions. Cleave hit a
      // 100-degree arc and drew spawnRing - a full 360 circle - so the picture told the player the exact
      // opposite of where the swing lands. Note spawnRing's radius is SCREEN PIXELS (16/22) and unrelated
      // to the spell's real reach, so that ring never showed true dimensions even as a circle.
      //
      // `radius` on a spellCone effect is WORLD units (tiles), unlike ring/spark: the renderer projects
      // the arc through the same iso transform the world uses, so what is drawn IS the area tested.
      // Deliberately NOT one of render-backend-system's sprite-cache `eligible` types - that cache keys on
      // type:color:style:radius:progress with no facing, so a baked cone would point the wrong way (the
      // same trap as the spider modelScale cache). This draws live through effects-renderer instead.
      Game.prototype.spawnSpellConeVfx = function(actor, color, worldRadius, coneDegrees, options = {}) {
        if (!actor) return null;
        const cone = Number(coneDegrees);
        if (!(cone > 0) || cone >= 359) return null; // not a cone; caller should spawn a ring
        const facing = this.actorFacingVector ? this.actorFacingVector(actor) : { x: 1, y: 0 };
        const effect = this.obtainRuntimeEffect?.('spellCone') || { type: 'spellCone' };
        effect.type = 'spellCone';
        effect.x = Number(actor.x) || 0;
        effect.y = Number(actor.y) || 0;
        effect.x2 = effect.x;
        effect.y2 = effect.y;
        effect.color = color || options.color || '#ffffff';
        effect.radius = Math.max(0.1, Number(worldRadius) || 2);
        effect.coneDegrees = cone;
        effect.angle = Math.atan2(facing.y, facing.x);
        effect.t = 0;
        effect.life = Math.max(0.18, Number(options.life || 0.42));
        this.decorateEffectVisualPayload?.(effect, options);
        this.addEffect(effect);
        return effect;
      };

      Game.prototype.playAttackAnimation = function(source, target, color = '#ffffff', style = 'slash') {
        if (!source || !target) return;
        source.attackAnim = 1;
        source.setFacingFromDelta(target.x - source.x, target.y - source.y);
        this.spawnSlash(source, target, color, style);
        // V0.20.0 (Roadmap Item 6): 'slam' fell through to the plain slash SOUND as well as the plain
        // slash visual, so the fighter's two heaviest hits were indistinguishable from level-1 Heavy
        // Swing in both. There is no dedicated slam sample, so it reuses attack_slash pitched well down -
        // a heavier weapon landing - rather than inventing an asset that does not exist.
        const slam = style === 'slam';
        this.playSfx?.(style === 'claw' ? 'attack_claw' : 'attack_slash', {
          x: source.x,
          y: source.y,
          volume: style === 'claw' ? 0.38 : (slam ? 0.52 : 0.42),
          rate: slam ? 0.58 + Math.random() * 0.10 : 0.92 + Math.random() * 0.18,
          cooldown: 0.055
        });
      };

      Game.prototype.spawnSlash = function(from, to, color, style = 'slash') {
        const effect = this.obtainRuntimeEffect?.('slash') || { type: 'slash' };
        effect.x = to.x;
        effect.y = to.y;
        effect.fromX = from.x;
        effect.fromY = from.y;
        effect.color = color;
        effect.style = style;
        effect.t = 0;
        effect.life = style === 'claw' ? 0.26 : 0.22;
        this.addEffect(effect);
      };

      Game.prototype.spawnBolt = function(from, to, color, options = {}) {
        const effect = this.obtainRuntimeEffect?.('bolt') || { type: 'bolt' };
        effect.x = from.x;
        effect.y = from.y;
        effect.x2 = to.x;
        effect.y2 = to.y;
        effect.color = color || options.color || '#ffffff';
        effect.style = options.style || options.kind || 'bolt';
        effect.kind = options.kind || effect.style || 'bolt';
        effect.school = options.school || options.damageType || '';
        effect.sourceClass = options.sourceClass || options.className || '';
        effect.color2 = options.color2 || '';
        effect.height = Number(options.height ?? 0.18) || 0.18;
        // V0.20.26 (Roadmap Item 6, "a projectile must originate from the correct casting hand"): the
        // bolt origin was the world foot position lifted a FIXED 24px, which lands at the belly (~37%
        // up the body) - nowhere near a caster's raised hands. Every humanoid publishes its feet
        // (_lastGroundAnchor) and head (_nameplateAnchor) each frame, uniformly across every class
        // renderer, so the cast point is derived from that span (~62% up = chest/hand height). Stored
        // as a px LIFT applied to the re-projected source each frame - exactly like the fixed 24 it
        // replaces, so it stays camera-safe - but scale-correct because it uses the real on-screen
        // body height, and it is uniform because both anchors exist for every actor. This raises the
        // origin height; the exact per-class hand-SIDE offset remains a larger, per-renderer refinement.
        effect.originLift = 24;
        const groundA = from && from._lastGroundAnchor, headA = from && from._nameplateAnchor;
        if (groundA && headA && this.vfxScreen) {
          const feetY = Number(groundA.groundY ?? groundA.y), headY = Number(headA.y);
          if (Number.isFinite(feetY) && Number.isFinite(headY) && feetY > headY) {
            const castY = feetY - (feetY - headY) * 0.62;
            const baseY = this.vfxScreen(from.x, from.y, 0.24 + effect.height).y;
            if (Number.isFinite(baseY)) effect.originLift = Math.max(0, baseY - castY);
          }
        }
        effect.depthBias = Number(options.depthBias ?? 0) || 0;
        effect.scale = Math.max(0.05, Number(options.scale || 1));
        effect.intensity = Math.max(0.05, Number(options.intensity || 1));
        effect.seed = Number(options.seed ?? this.nextEffectSeed?.((from.x || 0) + (to.y || 0))) || 0;
        effect.t = 0;
        // Phase 3 (Combat/Spell Parity): optional projectile descriptor
        // (see systems/spell-compiler-system.js) makes the bolt visually
        // travel from source to target over distance/speed instead of
        // instantly flashing the full line. Damage is still applied by the
        // caller before/regardless of this call - this only affects the
        // cosmetic line, never when damage lands. effect objects are
        // pooled (obtainRuntimeEffect), so travelDuration is always reset
        // explicitly to avoid leaking a previous bolt's travel state.
        const projectile = options.projectile;
        if (projectile && Number(projectile.speed) > 0) {
          const distance = Math.hypot((to.x || 0) - (from.x || 0), (to.y || 0) - (from.y || 0));
          effect.travelDuration = Math.min(0.6, distance / Number(projectile.speed));
          effect.life = effect.travelDuration + (effect.style === 'arrow' ? 0.18 : 0.12);
        } else {
          effect.travelDuration = 0;
          effect.life = effect.style === 'arrow' ? 0.30 : 0.22;
        }
        this.decorateEffectVisualPayload?.(effect, options);
        this.addEffect(effect);
      };

      Game.prototype.spawnArrowProjectile = function(from, to, color = '#b7d28a', options = {}) {
        return this.spawnBolt?.(from, to, color, {
          ...options,
          style: 'arrow',
          projectile: { speed: Number(options.speed || options.projectile?.speed || 18) }
        });
      };

      Game.prototype.spawnCastCue = function(source, color = '#ffffff', label = '', options = {}) {
        if (!source) return;
        // V0.20.36: the cast SOUND, defaulting to magic_cast (enemies/bots/mercs) but overridable so a
        // caller that knows the spell's element/kind can pass the right one (thunder_roll / attack_slash
        // via spellCastSfxId). This is the SINGLE cast-sound source - V0.20.35 wrongly added a second
        // one in resolveClassSpell, so lightning/melee doubled (magic_cast + thunder/slash); that is
        // removed and folded here.
        this.playSfx?.(options.sfx || 'magic_cast', { x: source.x, y: source.y, volume: 0.26, rate: 0.9 + Math.random() * 0.18, cooldown: 0.16 });
        const effect = this.obtainRuntimeEffect?.('castCue') || { type: 'castCue' };
        effect.x = source.x;
        effect.y = source.y;
        effect.color = color;
        effect.label = String(label || '').slice(0, 18);
        effect.kind = 'castCue';
        effect.seed = this.nextEffectSeed?.(source.x + source.y) || 0;
        effect.scale = 1;
        effect.intensity = 1;
        effect.t = 0;
        effect.life = 0.52;
        this.addEffect(effect);
      };

      Game.prototype.spawnCombatImpact = function(target, color = '#ffffff', intensity = 1, style = 'hit') {
        if (!target) return;
        const amount = Math.max(1, Math.min(3.2, Number(intensity) || 1));
        const impact = this.obtainRuntimeEffect?.('combatImpact') || { type: 'combatImpact' };
        impact.x = target.x;
        impact.y = target.y;
        impact.color = color;
        impact.intensity = amount;
        impact.scale = amount;
        impact.style = style;
        impact.kind = style;
        impact.seed = this.nextEffectSeed?.(target.x + target.y + amount) || 0;
        impact.height = 0.10;
        impact.t = 0;
        impact.life = 0.42;
        this.addEffect(impact);
        const count = Math.max(4, Math.min(10, Math.round(4 + amount * 2)));
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.04 + Math.random() * 0.08 + amount * 0.015;
          const spark = this.obtainRuntimeEffect?.('combatSpark') || { type: 'combatSpark' };
          spark.x = target.x + (Math.random() - 0.5) * 0.28;
          spark.y = target.y + (Math.random() - 0.5) * 0.28;
          spark.vx = Math.cos(angle) * speed;
          spark.vy = Math.sin(angle) * speed;
          spark.color = color;
          spark.t = 0;
          spark.life = 0.22 + Math.random() * 0.22;
          this.addEffect(spark);
        }
      };

      Game.prototype.spawnStatusPulse = function(target, color = '#8fe47d', label = '', options = {}) {
        if (!target) return;
        const soundLabel = String(label || '').toLowerCase();
        if (soundLabel.includes('heal') || soundLabel.includes('mana') || soundLabel.includes('bless') || soundLabel.includes('protect')) {
          this.playSfx?.('heal_chime', { x: target.x, y: target.y, volume: 0.22, rate: 0.92 + Math.random() * 0.12, cooldown: 0.22 });
        }
        const effect = this.obtainRuntimeEffect?.('statusPulse') || { type: 'statusPulse' };
        effect.x = target.x;
        effect.y = target.y;
        effect.color = color;
        effect.label = String(label || '').slice(0, 16);
        effect.kind = options.kind || String(label || '').toLowerCase();
        effect.school = options.school || options.damageType || '';
        // V0.20.21: statusPulse is drawn by drawStatusPulseEffect, which keys its motion off
        // vfxStyle() exactly as the ring does - but this spawner sets its identity by hand instead
        // of funnelling through decorateEffectVisualPayload, so it needs the same fallback to the
        // casting class published by resolveClassSpell. Without it a Wizard's Mana Shield pulse
        // stayed generic while the ring beside it drew runes.
        effect.sourceClass = options.sourceClass || options.className || this._spellVfxSourceClass || '';
        effect.seed = Number(options.seed ?? this.nextEffectSeed?.(target.x + target.y)) || 0;
        effect.radius = Number(options.radius || 18);
        effect.intensity = Math.max(0.05, Number(options.intensity || 1));
        effect.scale = Math.max(0.05, Number(options.scale || 1));
        effect.height = Number(options.height ?? 0.08) || 0.08;
        effect.t = 0;
        effect.life = Math.max(0.28, Number(options.life || 0.78));
        this.addEffect(effect);
      };


      Game.prototype.assassinVfxKey = function(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      };

      Game.prototype.assassinTargetIsMarkedForVfx = function(target, source = this.player) {
        return Boolean(this.isAssassinMarkedTarget?.(target, source));
      };

      Game.prototype.removeAssassinMarkSigilEffects = function(sourceId = this.player?.id ?? null, targetId = null) {
        if (!Array.isArray(this.effects)) return 0;
        let removed = 0;
        this.effects = this.effects.filter(effect => {
          if (!effect || effect.type !== 'assassinMarkSigil') return true;
          const sourceMatches = sourceId == null || effect.sourceId === sourceId;
          const targetMatches = targetId == null || effect.targetId === targetId || effect.followId === targetId;
          if (sourceMatches && targetMatches) { removed += 1; this.recycleEffectEntry?.(effect); return false; }
          return true;
        });
        return removed;
      };

      Game.prototype.spawnAssassinVfxEffect = function(type, payload = {}) {
        const effect = this.obtainRuntimeEffect?.(type) || { type };
        effect.type = type;
        effect.x = Number(payload.x ?? 0) || 0;
        effect.y = Number(payload.y ?? 0) || 0;
        effect.x2 = Number(payload.x2 ?? effect.x) || 0;
        effect.y2 = Number(payload.y2 ?? effect.y) || 0;
        effect.color = payload.color || '#cfd5d0';
        effect.color2 = payload.color2 || '';
        effect.kind = payload.kind || '';
        effect.style = payload.style || '';
        effect.school = payload.school || 'assassin';
        effect.sourceClass = payload.sourceClass || 'assassin';
        effect.sourceId = payload.sourceId || null;
        effect.targetId = payload.targetId || null;
        effect.followId = payload.followId || null;
        effect.marked = Boolean(payload.marked);
        effect.reason = payload.reason || '';
        effect.seed = Number(payload.seed ?? Math.random() * 10000) || 0;
        effect.rotation = Number(payload.rotation || 0);
        effect.radius = Number(payload.radius || 0);
        effect.scale = Math.max(0.05, Number(payload.scale || 1));
        effect.intensity = Number(payload.intensity || 1);
        effect.height = Number(payload.height ?? 0.18) || 0.18;
        effect.depthBias = Number(payload.depthBias ?? 0) || 0;
        effect.travelDuration = Number(payload.travelDuration || 0);
        effect.impactDuration = Number(payload.impactDuration || 0);
        effect.delay = Math.max(0, Number(payload.delay || 0) || 0);
        effect.t = 0;
        effect.life = Math.max(0.05, Number(payload.life || 0.4));
        return this.addEffect(effect);
      };

      // Assassin projectile kinds share one travelling-bolt effect; per-kind speed
      // and tint (the renderer supplies the full silhouette from the kind table).
      Game.prototype.spawnAssassinProjectileVfx = function(kind, source, target, options = {}) {
        if (!source || !target) return null;
        const distance = Math.hypot((target.x || 0) - (source.x || 0), (target.y || 0) - (source.y || 0));
        const SPEED = { knife: 32, blade: 34, crossbow: 26, heavyBolt: 34, venomBolt: 27, executionBolt: 30, poisonDart: 24 };
        const COLOR = { knife: '#d9dfde', blade: '#e6eeee', crossbow: '#b9c0c2', heavyBolt: '#c7d6e6', venomBolt: '#7dff65', executionBolt: '#e2455a', poisonDart: '#72df68' };
        const speed = Number(options.speed || SPEED[kind] || 30);
        const travel = Math.max(0.10, Math.min(0.42, distance / Math.max(1, speed)));
        return this.spawnAssassinVfxEffect?.('assassinProjectile', {
          kind, x: source.x, y: source.y, x2: target.x, y2: target.y,
          sourceId: source.id || null, targetId: target.id || null, marked: Boolean(options.marked),
          travelDuration: travel, life: travel + 0.18, color: options.color || COLOR[kind] || '#d8dde0', seed: options.seed
        });
      };

      Game.prototype.spawnAssassinImpactVfx = function(kind, target, options = {}) {
        if (!target) return null;
        const COLOR = { knife: '#eef4f3', blade: '#eef4f3', crossbow: '#f0f3ec', heavyBolt: '#dfeaf5', venomBolt: '#75e66a', executionBolt: '#e2455a', poisonDart: '#75e66a' };
        const poisonKind = kind === 'poisonDart' || kind === 'venomBolt';
        const color = (options.marked && !poisonKind) ? '#b31224' : (options.color || COLOR[kind] || '#d7dde1');
        this.spawnAssassinVfxEffect?.('assassinImpact', { kind, x: target.x, y: target.y, targetId: target.id || null, marked: Boolean(options.marked), color, life: 0.34, intensity: options.intensity || 1, seed: options.seed });
        if (options.marked) this.spawnAssassinMarkedHitVfx?.(target, this.player, { compact: true });
      };

      Game.prototype.spawnAssassinCrossbowAimVfx = function(source, target, options = {}) {
        if (!source || !target) return null;
        this.playSfx?.('attack_slash', { x: source.x, y: source.y, volume: 0.18, rate: 1.75, cooldown: 0.08 });
        return this.spawnAssassinVfxEffect?.('assassinCrosshair', {
          x: target.x, y: target.y, followId: target.id || null, sourceId: source.id || null, targetId: target.id || null,
          color: options.color || '#bfc5c9', life: 0.46, intensity: 1
        });
      };

      Game.prototype.spawnAssassinTripwireVfx = function(source, target, phase = 'place', options = {}) {
        if (!source || !target) return null;
        const type = phase === 'trigger' ? 'assassinTripwireTrigger' : 'assassinTripwire';
        if (phase === 'trigger') this.playSfx?.('hit_thud', { x: target.x, y: target.y, volume: 0.16, rate: 1.68, cooldown: 0.08 });
        return this.spawnAssassinVfxEffect?.(type, {
          x: source.x, y: source.y, x2: target.x, y2: target.y,
          sourceId: source.id || null, targetId: target.id || null, color: options.color || '#ccd0cf',
          life: phase === 'trigger' ? 0.48 : 0.72, marked: Boolean(options.marked)
        });
      };

      Game.prototype.spawnAssassinPoisonPulseVfx = function(target, options = {}) {
        if (!target) return null;
        return this.spawnAssassinVfxEffect?.('assassinPoisonPulse', {
          x: target.x, y: target.y, followId: target.id || null, targetId: target.id || null,
          color: options.color || '#78e268', life: 0.58, intensity: options.intensity || 1
        });
      };

      Game.prototype.spawnAssassinMarkAppliedVfx = function(source, target) {
        if (!source || !target) return;
        this.removeAssassinMarkSigilEffects?.(source.id ?? null, null);
        this.playSfx?.('magic_cast', { x: target.x, y: target.y, volume: 0.20, rate: 1.62, cooldown: 0.16 });
        this.spawnAssassinVfxEffect?.('assassinMarkLine', { x: source.x, y: source.y, x2: target.x, y2: target.y, sourceId: source.id || null, targetId: target.id || null, color: '#d32733', life: 0.30 });
        this.spawnAssassinVfxEffect?.('assassinMarkSigil', { x: target.x, y: target.y, followId: target.id || null, sourceId: source.id || null, targetId: target.id || null, color: '#d32733', life: 300, intensity: target.dungeonBoss || target.boss ? 1.25 : 1 });
        this.spawnAssassinVfxEffect?.('assassinMarkFlare', { x: target.x, y: target.y, followId: target.id || null, sourceId: source.id || null, targetId: target.id || null, color: '#ef3646', life: 0.45, intensity: 1.1 });
      };

      Game.prototype.spawnAssassinMarkedHitVfx = function(target, source = this.player, options = {}) {
        if (!target) return;
        this.spawnAssassinVfxEffect?.('assassinMarkFlare', { x: target.x, y: target.y, followId: target.id || null, sourceId: source?.id || null, targetId: target.id || null, color: '#db172a', life: options.compact ? 0.28 : 0.42, intensity: options.compact ? 0.78 : 1 });
      };

      Game.prototype.spawnAssassinMarkRemovedVfx = function(target, reason = 'removed', source = this.player) {
        if (!target) return;
        this.removeAssassinMarkSigilEffects?.(source?.id ?? null, target.id ?? null);
        this.spawnAssassinVfxEffect?.('assassinMarkRemove', { x: target.x, y: target.y, targetId: target.id || null, sourceId: source?.id || null, color: '#a91422', life: 0.62, reason, intensity: reason === 'death' ? 1.2 : 0.9 });
      };

      // Self-buff flourish (Quick Reload / Silent Step / Shadow Fuse / Black Lotus
      // Venom / Perfect Ambush) - each `style` renders its own signature at the caster.
      Game.prototype.spawnAssassinSelfBuffVfx = function(style, source = this.player, options = {}) {
        if (!source) return null;
        const SFX = { reload: 'attack_slash', silentstep: 'magic_cast', shadowfuse: 'magic_cast', venomcoat: 'magic_cast', ambush: 'attack_slash' };
        this.playSfx?.(SFX[String(style || '').toLowerCase()] || 'magic_cast', { x: source.x, y: source.y, volume: 0.16, rate: 1.6, cooldown: 0.12 });
        return this.spawnAssassinVfxEffect?.('assassinSelfBuff', {
          style, x: source.x, y: source.y, followId: source.id || null, sourceId: source.id || null,
          color: options.color || '#cfd5d0', life: options.life || 0.66, seed: options.seed
        });
      };

      // Death Box: a mechanical kill-zone laid over a radius.
      Game.prototype.spawnAssassinTrapFieldVfx = function(center, radius, options = {}) {
        if (!center) return null;
        this.playSfx?.('hit_thud', { x: center.x, y: center.y, volume: 0.2, rate: 1.35, cooldown: 0.1 });
        return this.spawnAssassinVfxEffect?.('assassinTrapField', {
          x: center.x, y: center.y, radius: Math.max(1, Number(radius || 3)),
          color: options.color || '#c9d0cf', color2: options.color2 || '#f0c6ff', life: options.life || 0.95, seed: options.seed
        });
      };

      // Fan of Knives: a short cone of tumbling blades fanned across the facing.
      Game.prototype.spawnAssassinFanVfx = function(source, options = {}) {
        if (!source) return null;
        const count = Math.max(3, Math.floor(options.count || 5));
        const spread = Number(options.spread || Math.PI * 0.6);
        const dist = Number(options.distance || options.radius || 3.2);
        const base = Number.isFinite(options.angle) ? options.angle : Math.atan2(Number(options.dy || 0), Number(options.dx || 1));
        this.playSfx?.('attack_slash', { x: source.x, y: source.y, volume: 0.2, rate: 1.5, cooldown: 0.08 });
        for (let i = 0; i < count; i++) {
          const a = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
          const tx = source.x + Math.cos(a) * dist, ty = source.y + Math.sin(a) * dist;
          this.spawnAssassinProjectileVfx?.('blade', source, { x: tx, y: ty, id: null }, { marked: options.marked, seed: (options.seed || 0) + i * 37, speed: 30 });
        }
      };

      // Repeater Burst: N staggered bolts at the same target (uses effect delay).
      Game.prototype.spawnAssassinBurstVfx = function(kind, source, target, count = 5, options = {}) {
        if (!source || !target) return null;
        const n = Math.max(1, Math.floor(count));
        const gap = Number(options.gap || 0.1);
        for (let i = 0; i < n; i++) {
          const fx = this.spawnAssassinProjectileVfx?.(kind, source, target, { marked: options.marked, seed: (options.seed || 0) + i * 53 });
          if (fx && i > 0) fx.delay = i * gap;
        }
      };



      // ---- Cleric holy VFX ----
      Game.prototype.spawnClericVfxEffect = function(type, payload = {}) {
        const effect = this.obtainRuntimeEffect?.(type) || { type };
        effect.type = type;
        effect.x = Number(payload.x ?? 0) || 0;
        effect.y = Number(payload.y ?? 0) || 0;
        effect.x2 = Number(payload.x2 ?? effect.x) || 0;
        effect.y2 = Number(payload.y2 ?? effect.y) || 0;
        effect.color = payload.color || '#ffd66a';
        effect.color2 = payload.color2 || '#fff6d5';
        effect.style = payload.style || '';
        effect.radius = Number(payload.radius || 0);
        effect.allies = Array.isArray(payload.allies) ? payload.allies : null;
        effect.seed = Number(payload.seed ?? Math.random() * 10000) || 0;
        effect.sourceId = payload.sourceId || null;
        effect.targetId = payload.targetId || null;
        effect.followId = payload.followId || null;
        effect.delay = Math.max(0, Number(payload.delay || 0) || 0);
        effect.t = 0;
        effect.life = Math.max(0.05, Number(payload.life || 0.7));
        return this.addEffect(effect);
      };

      // Each Cleric spell -> a holy effect keyed by clericSpellId: heals bloom,
      // HoTs sustain, AoE heals ripple radiance over the party, wards raise a
      // golden dome, cleanse flushes upward, Turn Undead bursts a nova, revive
      // rises as a column, and Smite/Judgment/Exorcise slam a pillar of light down.
      Game.prototype.spawnClericSpellEffect = function(spell, source, target = null, options = {}) {
        if (!source) return null;
        const CLERIC_VFX = {
          minor_heal:          { type: 'clericBless', style: 'heal',     color: '#8fe6a0', color2: '#e9ffee' },
          smite:               { type: 'clericSmite', style: 'smite',    color: '#ffe08a', color2: '#fff6d5' },
          renewing_prayer:     { type: 'clericBless', style: 'hot',      color: '#9fe6b0', color2: '#eafff0' },
          cleanse:             { type: 'clericBless', style: 'cleanse',  color: '#bfe6ff', color2: '#ffffff' },
          greater_heal:        { type: 'clericBless', style: 'heal',     color: '#8fe6a0', color2: '#f2fff5' },
          holy_ward:           { type: 'clericBless', style: 'ward',     color: '#ffd66a', color2: '#fff6d5' },
          radiant_touch:       { type: 'clericBless', style: 'heal',     color: '#fff0b8', color2: '#ffffff' },
          turn_undead:         { type: 'clericBless', style: 'nova',     color: '#fff2c0', color2: '#ffffff' },
          prayer_of_mending:   { type: 'clericBless', style: 'bless',    color: '#ffe08a', color2: '#fff6d5' },
          sanctuary:           { type: 'clericBless', style: 'ward',     color: '#ffd66a', color2: '#fff6d5' },
          divine_light:        { type: 'clericBless', style: 'aoeheal',  color: '#8fe6a0', color2: '#f2fff5' },
          blessed_barrier:     { type: 'clericBless', style: 'ward',     color: '#a9d4ff', color2: '#fff6d5' },
          judgment_light:      { type: 'clericSmite', style: 'judgment', color: '#ffd66a', color2: '#fff6d5' },
          purify_soul:         { type: 'clericBless', style: 'cleanse',  color: '#cfe9ff', color2: '#ffffff' },
          divine_intervention: { type: 'clericBless', style: 'ward',     color: '#fff0b8', color2: '#ffffff' },
          hymn_of_renewal:     { type: 'clericBless', style: 'aoeheal',  color: '#9fe6b0', color2: '#eafff0' },
          exorcise_evil:       { type: 'clericSmite', style: 'exorcise', color: '#ffffff', color2: '#ffe08a' },
          guardian_prayer:     { type: 'clericBless', style: 'ward',     color: '#ffd66a', color2: '#fff6d5' },
          radiant_revival:     { type: 'clericBless', style: 'revive',   color: '#fff0b8', color2: '#ffffff' },
          avatar_of_mercy:     { type: 'clericBless', style: 'bless',    color: '#fff0b8', color2: '#ffffff' }
        };
        const cfg = CLERIC_VFX[spell?.clericSpellId || ''] || { type: 'clericBless', style: 'heal', color: '#ffd66a', color2: '#fff6d5' };
        const anchor = target || source;
        const allies = Array.isArray(options.allies) ? options.allies.map(a => ({ id: a.id || null, x: Number(a.x) || anchor.x, y: Number(a.y) || anchor.y })).slice(0, 8) : null;
        const isAoe = cfg.style === 'aoeheal' || cfg.style === 'nova' || (cfg.style === 'ward' && allies && allies.length > 1);
        const sfx = cfg.type === 'clericSmite' ? (cfg.style === 'exorcise' ? 'magic_cast' : 'attack_slash') : (cfg.style === 'ward' ? 'magic_cast' : 'heal_chime');
        this.playSfx?.(sfx, { x: anchor.x, y: anchor.y, volume: 0.24, rate: cfg.type === 'clericSmite' ? 1.15 : 1.0, cooldown: 0.12 });
        if (cfg.type === 'clericSmite') {
          return this.spawnClericVfxEffect?.('clericSmite', { style: cfg.style, x: source.x, y: source.y, x2: anchor.x, y2: anchor.y, targetId: anchor.id || null, color: cfg.color, color2: cfg.color2, life: 0.55 });
        }
        const radius = options.radius || spell?.radius || (isAoe ? 12 : 3);
        const life = cfg.style === 'revive' ? 1.0 : (isAoe ? 0.9 : (cfg.style === 'hot' ? 1.1 : 0.72));
        return this.spawnClericVfxEffect?.('clericBless', {
          style: cfg.style, x: anchor.x, y: anchor.y, radius, allies,
          followId: isAoe ? null : (anchor.id || null),
          color: cfg.color, color2: cfg.color2, life
        });
      };

      Game.prototype.spawnBardSpellEffect = function(spellName, source, target = null, options = {}) {
        if (!source) return;
        const raw = String(spellName || options?.spell?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const key = raw.replace(/\s+/g, '');
        const sx = Number(source.x) || 0;
        const sy = Number(source.y) || 0;
        const tx = Number(target?.x ?? options.x ?? sx) || sx;
        const ty = Number(target?.y ?? options.y ?? sy) || sy;
        const color = options.color || options?.spell?.color || '#f0d38d';
        const allies = Array.isArray(options.allies)
          ? options.allies.filter(Boolean).map(a => ({ id: a.id || null, x: Number(a.x) || sx, y: Number(a.y) || sy, name: a.name || '' })).slice(0, 8)
          : (target ? [{ id: target.id || null, x: tx, y: ty, name: target.name || '' }] : []);
        const base = {
          x: sx,
          y: sy,
          x2: tx,
          y2: ty,
          sourceId: source.id || null,
          targetId: target?.id || null,
          color,
          t: 0,
          spellName: spellName || options?.spell?.name || ''
        };

        const pushNotes = (x, y, count, radius, life, palette = ['#ffd36a', '#f0d38d', '#d9985a', '#ffe7a4'], drift = 1) => {
          for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            this.addEffect({
              type: 'bardNoteParticle',
              x: x + Math.cos(a) * r,
              y: y + Math.sin(a) * r * 0.68,
              vx: Math.cos(a) * (0.012 + Math.random() * 0.032) * drift,
              vy: Math.sin(a) * (0.008 + Math.random() * 0.022) * drift,
              color: palette[i % palette.length],
              glyph: i % 5,
              size: 0.72 + Math.random() * 0.76,
              spin: (Math.random() - 0.5) * 3.4,
              t: 0,
              life: life * (0.72 + Math.random() * 0.58)
            });
          }
        };

        // Per-song visual identity: the fx family + theme colors, keyed by
        // bardSpellId (the old name-keyed dispatch only matched one current spell).
        const BARD_VFX = {
          quick_note:          { fx: 'sonic',      color: '#ffe27a', color2: '#d9985a' },
          song_of_mending:     { fx: 'song',       color: '#7ee39a', color2: '#c7f6c0' },
          mana_melody:         { fx: 'song',       color: '#6fb4ff', color2: '#bfe0ff' },
          hymn_of_courage:     { fx: 'song',       color: '#ffd36a', color2: '#ffb980', grand: true },
          dissonant_chord:     { fx: 'sonic',      color: '#ff8a4a', color2: '#d2462f' },
          lullaby:             { fx: 'lullaby',    color: '#c99be8', color2: '#f0b6bf' },
          battle_hymn:         { fx: 'song',       color: '#ff9a5a', color2: '#ffd36a', grand: true },
          drumbeat_rush:       { fx: 'song',       color: '#5fe0d0', color2: '#bff6ee' },
          mournful_note:       { fx: 'sonic',      color: '#9a8fe0', color2: '#c7bdff' },
          perfect_harmony:     { fx: 'song',       color: '#8fe6d6', color2: '#d6fff5' },
          blade_rhythm:        { fx: 'song',       color: '#ffcf8a', color2: '#ff9a5a', grand: true },
          chorus_of_clarity:   { fx: 'song',       color: '#fff0b8', color2: '#ffd36a' },
          dirge_of_weakness:   { fx: 'discordant', color: '#e0602f', color2: '#ffb980' },
          echoing_verse:       { fx: 'verse',      color: '#c9a3ff', color2: '#f0d3ff' },
          resonant_shield:     { fx: 'song',       color: '#a9c7ff', color2: '#ffe08a', grand: true },
          chorus_of_war:       { fx: 'song',       color: '#ff6a4a', color2: '#ffd36a', grand: true },
          final_refrain:       { fx: 'sonic',      color: '#ffb060', color2: '#ff5a70', big: true },
          songweave:           { fx: 'verse',      color: '#d7b5ff', color2: '#fff0b8' },
          legendary_ballad:    { fx: 'song',       color: '#ffe08a', color2: '#ffb980', grand: true },
          dreamsong_crescendo: { fx: 'song',       color: '#ffd36a', color2: '#a9d4ff', grand: true }
        };
        const spellId = options?.spell?.bardSpellId || key;
        const cfg = BARD_VFX[spellId] || { fx: 'song', color, color2: color };
        const c1 = cfg.color || color, c2 = cfg.color2 || c1;
        const palette = [c2, c1, '#fff0b8', c2];

        if (cfg.fx === 'sonic') {
          if (!target) return;
          this.addEffect({ ...base, color: c1, color2: c2, type: 'bardSonicCut', life: cfg.big ? 0.72 : 0.56 });
          pushNotes(sx, sy, cfg.big ? 12 : 8, 0.25, 0.55, palette, 1.8);
          this.playSfx?.('attack_slash', { x: sx, y: sy, volume: cfg.big ? 0.40 : 0.32, rate: cfg.big ? 0.90 : 1.18 + Math.random() * 0.12, cooldown: 0.08 });
          return;
        }
        if (cfg.fx === 'lullaby') {
          if (!target) return;
          this.addEffect({ ...base, color: c1, color2: c2, type: 'bardLullaby', life: Math.max(1.1, Number(options.duration || options?.spell?.duration || 4)) });
          pushNotes(tx, ty, 9, 0.35, 1.2, ['#c99be8', '#f0b6bf', '#ffd6a5'], 0.42);
          this.playSfx?.('magic_cast', { x: sx, y: sy, volume: 0.24, rate: 0.78, cooldown: 0.18 });
          return;
        }
        if (cfg.fx === 'discordant') {
          const center = options.center || source;
          const cx = Number(center.x) || sx, cy = Number(center.y) || sy;
          this.addEffect({ ...base, x: cx, y: cy, x2: cx, y2: cy, color: c1, color2: c2, type: 'bardDiscordantNote', radius: options.radius || options?.spell?.radius || 6, life: 0.85 });
          pushNotes(cx, cy, 20, 0.42, 0.72, [c1, c2, '#ffd36a', '#4a2018'], 2.4);
          this.playSfx?.('attack_slash', { x: cx, y: cy, volume: 0.42, rate: 0.82, cooldown: 0.16 });
          return;
        }
        // song / verse -> expanding song wave (grand for major songs; a compact
        // shimmer on the caster for the self "verse" buffs).
        const grand = Boolean(cfg.grand);
        const verse = cfg.fx === 'verse';
        let songAllies = Array.isArray(options.allies) && options.allies.length
          ? options.allies.filter(Boolean).map(a => ({ id: a.id || null, x: Number(a.x) || sx, y: Number(a.y) || sy, name: a.name || '' })).slice(0, 8)
          : null;
        if (!songAllies) {
          const gathered = verse ? [source] : (this.bardAlliesForSpell?.(options.spell) || [source]);
          songAllies = gathered.map(a => ({ id: a?.id || null, x: Number(a?.x) || sx, y: Number(a?.y) || sy, name: a?.name || '' })).slice(0, 8);
        }
        this.addEffect({ ...base, color: c1, color2: c2, type: grand ? 'bardValorChorus' : 'bardWarHymn', radius: options.radius || options?.spell?.radius || (verse ? 8 : 18), allies: songAllies, life: grand ? 1.72 : (verse ? 1.05 : 1.35), sustain: Math.max(1.2, Number(options.duration || options?.spell?.duration || 8)) });
        pushNotes(sx, sy, grand ? 30 : (verse ? 12 : 18), grand ? 0.9 : 0.62, grand ? 1.55 : 1.2, palette, grand ? 1.15 : 1);
        this.playSfx?.('magic_cast', { x: sx, y: sy, volume: grand ? 0.38 : 0.30, rate: 1.06 + Math.random() * 0.08, cooldown: 0.18 });
      };

      Game.prototype.spawnNecromancerSpellEffect = function(spellName, source, target = null, options = {}) {
        if (!source) return;
        const raw = String(spellName || options?.spell?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const key = raw.replace(/\s+/g, '');
        const color = options.color || options?.spell?.color || '#98c77b';
        const sx = Number(source.x) || 0;
        const sy = Number(source.y) || 0;
        const tx = Number(target?.x ?? options.x ?? sx) || sx;
        const ty = Number(target?.y ?? options.y ?? sy) || sy;
        const base = {
          x: sx,
          y: sy,
          x2: tx,
          y2: ty,
          sourceId: source.id || null,
          targetId: target?.id || null,
          color,
          t: 0,
          spellName: spellName || options?.spell?.name || ''
        };

        const pushHeavyMist = (x, y, count, radius, life, palette = ['#0b0d0c', '#143320', '#dce8cf']) => {
          for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            this.addEffect({
              type: 'necroBoneDust',
              x: x + Math.cos(a) * r,
              y: y + Math.sin(a) * r * 0.72,
              vx: Math.cos(a) * (0.018 + Math.random() * 0.032),
              vy: Math.sin(a) * (0.014 + Math.random() * 0.024),
              color: palette[i % palette.length],
              size: 2 + Math.random() * 4,
              t: 0,
              life: life * (0.72 + Math.random() * 0.42)
            });
          }
        };

        if (key === 'raiseboneservant') {
          const summonX = Number(target?.x ?? sx + 0.5);
          const summonY = Number(target?.y ?? sy + 0.5);
          this.addEffect({
            ...base,
            type: 'necroRaiseBoneServant',
            x: summonX,
            y: summonY,
            x2: summonX,
            y2: summonY,
            life: 1.45,
            radius: 34
          });
          pushHeavyMist(summonX, summonY, 18, 0.46, 1.1);
          this.playSfx?.('pet_summon', { x: summonX, y: summonY, volume: 0.36, rate: 0.72 + Math.random() * 0.08, cooldown: 0.18 });
          return;
        }

        if (key === 'lifetap') {
          if (!target) return;
          this.addEffect({ ...base, type: 'necroLifeTap', life: 0.78, tendrils: 1 });
          pushHeavyMist(tx, ty, 7, 0.28, 0.6, ['#201022', '#3b7a4f', '#d7dfca']);
          this.playSfx?.('magic_cast', { x: sx, y: sy, volume: 0.25, rate: 0.74 + Math.random() * 0.08, cooldown: 0.12 });
          return;
        }

        if (key === 'bonespear') {
          if (!target) return;
          this.addEffect({ ...base, type: 'necroBoneSpear', life: 0.72 });
          pushHeavyMist(sx, sy, 8, 0.2, 0.55, ['#d8e5b4', '#8ca086', '#0b0d0c']);
          this.playSfx?.('magic_cast', { x: sx, y: sy, volume: 0.28, rate: 0.86 + Math.random() * 0.1, cooldown: 0.1 });
          return;
        }

        if (key === 'rotcloud') {
          const center = options.center || target || source;
          this.addEffect({
            ...base,
            type: 'necroRotCloud',
            x: Number(center.x) || sx,
            y: Number(center.y) || sy,
            x2: Number(center.x) || sx,
            y2: Number(center.y) || sy,
            radius: options.radius || options?.spell?.radius || 4.4,
            life: Math.max(1.8, Number(options.duration || options?.spell?.duration || 4))
          });
          pushHeavyMist(Number(center.x) || sx, Number(center.y) || sy, 24, Math.max(0.8, Number(options.radius || 4.4) * 0.22), 1.8, ['#18240e', '#4b662c', '#11120c']);
          this.playSfx?.('magic_cast', { x: Number(center.x) || sx, y: Number(center.y) || sy, volume: 0.30, rate: 0.66 + Math.random() * 0.08, cooldown: 0.22 });
          return;
        }

        if (key === 'gravearmor') {
          const follow = target || source;
          this.addEffect({
            ...base,
            type: 'necroGraveArmor',
            x: Number(follow.x) || sx,
            y: Number(follow.y) || sy,
            followId: follow.id || null,
            life: Math.max(2.2, Number(options.duration || options?.spell?.duration || 10)),
            radius: 24
          });
          pushHeavyMist(Number(follow.x) || sx, Number(follow.y) || sy, 12, 0.26, 0.95, ['#d8e5b4', '#273126', '#111111']);
          this.playSfx?.('magic_cast', { x: Number(follow.x) || sx, y: Number(follow.y) || sy, volume: 0.28, rate: 0.78 + Math.random() * 0.08, cooldown: 0.22 });
          return;
        }

        if (key === 'soulleech') {
          if (!target) return;
          this.addEffect({ ...base, type: 'necroSoulLeech', life: 1.08, tendrils: 5 });
          pushHeavyMist(tx, ty, 12, 0.36, 0.85, ['#1e1228', '#60207b', '#d5e3c8']);
          this.playSfx?.('magic_cast', { x: sx, y: sy, volume: 0.36, rate: 0.62 + Math.random() * 0.08, cooldown: 0.18 });
        }
      };


      Game.prototype.spawnAshrootSpellEffect = function(spellName, source, target = null, options = {}) {
        if (!source) return;
        const raw = String(spellName || options?.ability?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const key = raw.replace(/\s+/g, '');
        const sx = Number(source.x) || 0;
        const sy = Number(source.y) || 0;
        const tx = Number(target?.x ?? options.x ?? sx) || sx;
        const ty = Number(target?.y ?? options.y ?? sy) || sy;
        const base = {
          x: sx,
          y: sy,
          x2: tx,
          y2: ty,
          sourceId: source.id || null,
          targetId: target?.id || null,
          color: options.color || '#d46a2f',
          t: 0,
          spellName: spellName || options?.ability?.name || ''
        };

        if (key === 'ashrootcrush') {
          this.addEffect({ ...base, type: 'ashrootCrush', life: 1.05, radius: 2.15 });
          this.playSfx?.('attack_claw', { x: tx, y: ty, volume: 0.48, rate: 0.62 + Math.random() * 0.08, cooldown: 0.12 });
          return;
        }

        if (key === 'ashcloud') {
          this.addEffect({
            ...base,
            type: 'ashrootAshCloud',
            x: tx,
            y: ty,
            x2: tx,
            y2: ty,
            radius: Number(options.radius || 2.2),
            life: Math.max(2.6, Number(options.duration || 3.4))
          });
          this.playSfx?.('magic_cast', { x: tx, y: ty, volume: 0.34, rate: 0.54 + Math.random() * 0.06, cooldown: 0.18 });
          return;
        }

        if (key === 'deathbloom') {
          this.addEffect({
            ...base,
            type: 'ashrootDeathBloom',
            x: tx,
            y: ty,
            x2: tx,
            y2: ty,
            radius: Number(options.radius || 1.8),
            life: 1.75
          });
          this.playSfx?.('magic_cast', { x: tx, y: ty, volume: 0.36, rate: 0.72 + Math.random() * 0.08, cooldown: 0.14 });
          return;
        }

        if (key === 'cinderrootsnare') {
          this.addEffect({
            ...base,
            type: 'ashrootCinderrootSnare',
            x: tx,
            y: ty,
            x2: tx,
            y2: ty,
            followId: target?.id || null,
            life: Math.max(3.6, Number(options.duration || 5.2))
          });
          this.playSfx?.('magic_cast', { x: tx, y: ty, volume: 0.32, rate: 0.64 + Math.random() * 0.08, cooldown: 0.16 });
          return;
        }

        if (key === 'blightwoodpulse') {
          this.addEffect({
            ...base,
            type: 'ashrootBlightwoodPulse',
            radius: Number(options.radius || 3.0),
            life: Math.max(2.2, Number(options.duration || 4.8))
          });
          this.playSfx?.('magic_cast', { x: sx, y: sy, volume: 0.36, rate: 0.58 + Math.random() * 0.06, cooldown: 0.18 });
          return;
        }

        if (key === 'ashenregrowth') {
          this.addEffect({
            ...base,
            type: 'ashrootAshenRegrowth',
            x: sx,
            y: sy,
            followId: source.id || null,
            life: Math.max(3.2, Number(options.duration || 7.0))
          });
          this.playSfx?.('heal_chime', { x: sx, y: sy, volume: 0.28, rate: 0.52 + Math.random() * 0.06, cooldown: 0.2 });
        }
      };

      Game.prototype.spawnTurnTelegraph = function(source, target, profile = {}) {
        if (!source || !target) return;
        this.addEffect({
          type: 'turnTelegraph',
          x: target.x,
          y: target.y,
          sourceX: source.x,
          sourceY: source.y,
          color: profile.color || '#d4665a',
          label: String(profile.name || 'Incoming').slice(0, 18),
          ranged: Boolean(profile.ranged),
          t: 0,
          life: Math.max(0.45, Number(profile.life) || 0.72)
        });
      };

      Game.prototype.spawnCorpseBurst = function(x, y) {
        for (let i = 0; i < 5; i++) {
          this.addEffect({
            type: 'spark',
            x: x + (Math.random() - 0.5) * 0.6,
            y: y + (Math.random() - 0.5) * 0.6,
            color: '#6f2a26',
            t: 0,
            life: 0.4 + Math.random() * 0.25
          });
        }
      };
    }
  };
})();
