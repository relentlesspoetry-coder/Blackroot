// Dream Realms runtime procedural sprite cache
// V0.15.15: bounded animation buckets prevent endless key churn while preserving cached procedural frames.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const DEFAULT_BOUNDS = Object.freeze({ width: 260, height: 260, originX: 130, originY: 190 });
  const HUMANOID_BOUNDS = Object.freeze({ width: 260, height: 280, originX: 130, originY: 210 });
  const BEAST_BOUNDS = Object.freeze({ width: 300, height: 240, originX: 150, originY: 170 });
  // V0.17.93: tall standing mobs (the ashroot/deadroot family - anchorY 122-142
  // x scale 1.22-1.45 x visualScale) draw ~180-250px above their feet, which
  // overran BEAST_BOUNDS' 170px of headroom and clipped the canopy. Give them a
  // taller canvas.
  const TALL_MOB_BOUNDS = Object.freeze({ width: 340, height: 350, originX: 170, originY: 290 });
  const BOSS_BOUNDS = Object.freeze({ width: 420, height: 340, originX: 210, originY: 250 });

  function safeString(value, fallback = '') {
    return String(value ?? fallback).toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_').slice(0, 96);
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }


  function cacheScale(value) {
    const n = Math.max(0.2, Math.min(4, safeNumber(value, 1)));
    return Math.round(n * 16) / 16;
  }

  function quantize(value, steps = 8) {
    const n = safeNumber(value, 0);
    return Math.max(0, Math.min(steps, Math.floor(Math.max(0, n) * steps)));
  }

  function quantizeSigned(value, steps = 8) {
    const n = Math.max(-1, Math.min(1, safeNumber(value, 0)));
    return Math.round(n * steps);
  }

  function hasAutoAttackVisualState(actor) {
    if (!actor) return false;
    return !!actor.autoAttackVisualActive
      || Math.abs(safeNumber(actor.autoAttackVisualPhase, 0)) > 0.001
      || Math.abs(safeNumber(actor.autoAttackVisualPulse, 0)) > 0.001
      || Math.abs(safeNumber(actor.autoAttackVisualAimSide, 0)) > 0.001;
  }

  function equipmentSignature(equipment) {
    if (!equipment || typeof equipment !== 'object') return 'noeq';
    const slots = ['head','shoulders','chest','legs','hands','gloves','feet','boots','cape','weapon','offhand','mainHand','mainhand','main_hand','primary','secondary','leftHand','rightHand','charm'];
    const out = [];
    for (const slot of slots) {
      const item = equipment[slot];
      if (!item) continue;
      out.push(`${slot}:${safeString(item.itemId || item.sourceItemId || item.sourceId || item.id || item.key || item.name || item.type || 'item')}:${safeString(item.type || '')}:${safeString(item.slot || '')}:${safeString(item.icon?.family || '')}:${safeString(item.rarity?.key || item.rarity || item.grade || '')}:${safeString((item.classRestrictions || []).join(','))}`);
    }
    return out.length ? out.join('|') : 'noeq';
  }

  class RuntimeSpriteCacheSystem {
    constructor(game, options = {}) {
      this.game = game || null;
      const perf = DR.CONFIG?.PERFORMANCE || {};
      this.enabled = options.enabled ?? perf.enableSpriteCache !== false;
      this.maxEntries = Math.max(64, Math.floor(Number(options.maxEntries || perf.spriteCacheMaxEntries || 1800)));
      this.entries = new Map();
      this.frameId = 0;
      this.stats = {
        hits: 0,
        misses: 0,
        draws: 0,
        evictions: 0,
        failures: 0,
        entries: 0,
        generatedThisFrame: 0,
        hitsThisFrame: 0,
        missesThisFrame: 0,
        evictionsThisFrame: 0,
        budgetSkipsThisFrame: 0,
        boundedBucketKeys: 0,
        unboundedBucketKeys: 0,
        modelMisses: Object.create(null),
        modelHits: Object.create(null)
      };
      this.disabledModels = new Set();
      this.canvasFactory = this.resolveCanvasFactory();
    }

    resolveCanvasFactory() {
      if (typeof OffscreenCanvas !== 'undefined') {
        return (w, h) => new OffscreenCanvas(w, h);
      }
      return (w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      };
    }

    beginFrame() {
      this.frameId = (this.frameId + 1) >>> 0;
      const perf = this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
      const nextMaxEntries = Math.max(64, Math.floor(Number(perf.spriteCacheMaxEntries) || this.maxEntries || 1800));
      if (nextMaxEntries !== this.maxEntries) this.maxEntries = nextMaxEntries;
      this.stats.generatedThisFrame = 0;
      this.stats.hitsThisFrame = 0;
      this.stats.missesThisFrame = 0;
      this.stats.evictionsThisFrame = 0;
      this.stats.budgetSkipsThisFrame = 0;
      this.stats.boundedBucketKeys = 0;
      this.stats.unboundedBucketKeys = 0;
      this.stats.entries = this.entries.size;
    }

    clear() {
      this.entries.clear();
      this.stats.entries = 0;
    }

    invalidateMatching(prefix) {
      if (!prefix) return 0;
      let removed = 0;
      for (const key of Array.from(this.entries.keys())) {
        if (key.includes(prefix)) {
          this.entries.delete(key);
          removed += 1;
        }
      }
      this.stats.entries = this.entries.size;
      return removed;
    }

    boundsFor(actor, options = {}) {
      if (options.bounds && typeof options.bounds === 'object') return { ...DEFAULT_BOUNDS, ...options.bounds };
      const key = safeString(options.bounds || options.rendererId || actor?.rendererId || actor?.kind || '');
      if (actor?.dungeonBoss || actor?.boss || actor?.eliteBoss || key.includes('boss')) return BOSS_BOUNDS;
      // V0.17.93: the tall ashroot/deadroot family needs extra vertical headroom.
      // Checked before the generic 'mob' branch (since 'tallmob'.includes('mob')).
      if (key.includes('tallmob') || /ashroot|deadroot/.test(safeString(actor?.mobVisualKey || actor?.family || actor?.rendererId || '')) ) return TALL_MOB_BOUNDS;
      if (key.includes('wolf') || key.includes('boar') || key.includes('spider') || key.includes('rotling') || key.includes('mob') || actor?.kind === 'enemy') return BEAST_BOUNDS;
      if (key.includes('humanoid') || key.includes('class') || key.includes('bard') || key.includes('druid') || actor?.kind === 'player' || actor?.kind === 'bot' || actor?.kind === 'merc') return HUMANOID_BOUNDS;
      return DEFAULT_BOUNDS;
    }

    actionFrameMs(actor, options = {}) {
      const perf = DR.CONFIG?.PERFORMANCE || {};
      if (Number.isFinite(Number(options.frameMs)) && Number(options.frameMs) > 0) return Number(options.frameMs);
      const action = safeString(actor?.action || 'idle');
      const moving = !!actor?.isMoving || action === 'walk' || action === 'swim';
      const dynamic = action === 'attack' || action === 'cast' || action === 'hit' || action === 'death' || hasAutoAttackVisualState(actor) || Number(actor?.attackAnim || 0) > 0.02 || Number(actor?.spellCastAnim || 0) > 0.02 || Number(actor?.hitAnim || 0) > 0.02;
      const base = dynamic ? Math.max(66, Number(perf.spriteCacheActionFrameMs || 125))
        : moving ? Math.max(66, Number(perf.spriteCacheMovingFrameMs || 100))
          : Math.max(100, Number(perf.spriteCacheIdleFrameMs || 250));
      // V0.20.58: a bucket shorter than the frame interval changes on EVERY frame, so the cache key
      // never repeats, every lookup misses, and the cache re-bakes instead of reusing - which is
      // strictly more expensive than just drawing the model live. That is a death spiral: the slower
      // the game runs, the more it re-bakes, the slower it runs. Measured at ~9 FPS (111ms frames)
      // against a 100ms moving bucket: 25 of 27 keys changed every frame, and the ONLY differing
      // component was the trailing time bucket.
      // Floor the bucket at a multiple of the measured frame time so the quantization actually
      // quantizes. This is a no-op at healthy frame rates (16.7ms x 3 = 50ms, still under every
      // configured bucket) and only engages when frames are already slow.
      const frameMs = Number(this.game?.perfStats?.frameMs) || 0;
      if (frameMs > 0) return Math.max(base, frameMs * 3);
      return base;
    }

    animationBucket(actor, action, options = {}, nowMs = performance.now()) {
      const perf = this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
      const bounded = perf.spriteCacheBoundAnimationBuckets !== false;
      const frameMs = this.actionFrameMs(actor, options);
      const rawBucket = Math.floor(safeNumber(nowMs, 0) / frameMs);
      if (!bounded) {
        this.stats.unboundedBucketKeys += 1;
        return rawBucket;
      }
      let buckets = Math.max(1, Math.floor(Number(perf.spriteCacheIdleBuckets) || 2));
      const dynamic = action === 'attack' || action === 'cast' || action === 'hit' || action === 'death' || hasAutoAttackVisualState(actor) || Number(actor?.attackAnim || 0) > 0.02 || Number(actor?.spellCastAnim || 0) > 0.02 || Number(actor?.hitAnim || 0) > 0.02;
      const moving = !!actor?.isMoving || action === 'walk' || action === 'swim';
      if (action === 'death' || actor?.alive === false || actor?.dead) buckets = Math.max(1, Math.floor(Number(perf.spriteCacheDeathBuckets) || 6));
      else if (dynamic) buckets = Math.max(1, Math.floor(Number(perf.spriteCacheActionBuckets) || 8));
      else if (moving) buckets = Math.max(1, Math.floor(Number(perf.spriteCacheMovingBuckets) || 6));
      const bucket = rawBucket % buckets;
      this.stats.boundedBucketKeys += 1;
      return bucket;
    }

    incrementModelCounter(bucket, modelId) {
      if (!bucket || !modelId) return;
      bucket[modelId] = (Number(bucket[modelId]) || 0) + 1;
      const keys = Object.keys(bucket);
      if (keys.length > 48) {
        keys.sort((a, b) => (Number(bucket[a]) || 0) - (Number(bucket[b]) || 0));
        for (let i = 0; i < Math.min(8, keys.length - 40); i++) delete bucket[keys[i]];
      }
    }

    buildKey(actor, options = {}, nowMs = performance.now()) {
      const action = safeString(actor?.action || (actor?.isMoving ? 'walk' : 'idle'));
      const timeBucket = this.animationBucket(actor, action, options, nowMs);
      const renderer = safeString(options.rendererId || actor?.rendererId || actor?.mobVisualKey || actor?.className || actor?.kind || 'actor');
      const direction = safeString(actor?.facingName || actor?.direction || actor?._humanoidSheetDirection || 'south');
      const classKey = safeString(actor?.className || actor?.playerClass || actor?.classId || actor?.roleKey || actor?.kind || 'none');
      const identityKey = safeString(actor?.id || actor?.entityId || actor?.characterId || actor?.botId || actor?.name || actor?.sourceEntity?.id || actor?.sourceEntity?.name || 'anon');
      const visualKey = safeString(actor?.mobVisualKey || actor?.visualKey || actor?._darkWoodsMobVisualKey || actor?.spiderRole || actor?.family || actor?.petType || 'default');
      const role = safeString(actor?.npcRole || actor?.visualRole || actor?.role || actor?.roleKey || actor?.trainerClass || 'none');
      const flags = [
        actor?.alive === false || actor?.dead ? 'dead' : 'alive',
        actor?.elite || actor?.baseType?.elite ? 'elite' : '',
        actor?.named || actor?.baseType?.named ? 'named' : '',
        actor?.rare || actor?.baseType?.rare ? 'rare' : '',
        actor?.dungeonBoss || actor?.boss || actor?.baseType?.boss ? 'boss' : '',
        actor?.meditating ? 'med' : '',
        actor?.swimming ? 'swim' : '',
        actor?.fishing ? 'fish' : '',
        actor?.isClassTrainerModel ? 'trainer' : '',
        actor?.debugFacing ? 'dbg' : ''
      ].filter(Boolean).join(',') || 'noflags';
      const dynamic = [
        `atk${quantize(actor?.attackAnim, 8)}`,
        `cast${quantize(actor?.spellCastAnim, 8)}`,
        `hit${quantize(actor?.hitAnim, 8)}`,
        `death${quantize(actor?.deathProgress, 8)}`,
        `move${actor?.isMoving ? 1 : 0}`,
        `mb${quantize(actor?.moveBlend, 4)}`,
        `sw${quantize(actor?.swimBlend, 4)}`,
        `ga${quantize(actor?.gatheringProgress, 4)}`,
        `aav${actor?.autoAttackVisualActive ? 1 : 0}`,
        `aat${safeString(actor?.autoAttackVisualType || 'none')}`,
        `aaw${safeString(actor?.autoAttackVisualWeapon || 'none')}`,
        `aas${quantizeSigned(actor?.autoAttackVisualAimSide, 2)}`,
        `aap${quantize(actor?.autoAttackVisualPhase, 8)}`,
        `aapu${quantize(actor?.autoAttackVisualPulse, 8)}`,
        `drawsc${cacheScale(options.scale || 1).toFixed(3)}`,
        `sc${quantize(actor?.visualScale || actor?.baseType?.visualScale || 1, 8)}`
      ].join(',');
      const palette = safeString(`${actor?.gender || ''}:${actor?.skinTone || actor?.skin || ''}:${actor?.hairStyle || ''}:${actor?.hairColor || ''}:${actor?.clothesPrimary || ''}:${actor?.clothesSecondary || ''}:${actor?.visualPalette || ''}`);
      const eq = equipmentSignature(actor?.visualEquipment || actor?.equipment || actor?.botEquipment);
      return [renderer, identityKey, classKey, visualKey, role, direction, action, flags, dynamic, palette, eq, `t${timeBucket}`].join('::');
    }

    getContext(canvas) {
      const c = canvas.getContext('2d', { alpha: true });
      if (c) c.imageSmoothingEnabled = false;
      return c;
    }

    enforceBudget() {
      if (this.entries.size <= this.maxEntries) return;
      const over = this.entries.size - this.maxEntries;
      const sortable = Array.from(this.entries.entries());
      sortable.sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
      for (let i = 0; i < over && i < sortable.length; i++) {
        this.entries.delete(sortable[i][0]);
        this.stats.evictions += 1;
        this.stats.evictionsThisFrame += 1;
      }
      this.stats.entries = this.entries.size;
    }

    drawModel(targetCtx, actor, model, options = {}) {
      if (!this.enabled || DR.CONFIG?.PERFORMANCE?.enableSpriteCache === false || !targetCtx || !actor || !model?.draw) return false;
      const modelId = safeString(options.rendererId || actor.rendererId || actor.className || actor.kind || 'model');
      if (this.disabledModels.has(modelId)) return false;
      const screenX = safeNumber(options.screenX ?? actor.screenX, 0);
      const screenY = safeNumber(options.screenY ?? actor.screenY, 0);
      const scale = cacheScale(options.scale);
      const nowMs = safeNumber(options.nowMs, performance.now());
      const key = this.buildKey(actor, options, nowMs);
      let entry = this.entries.get(key);
      if (entry) {
        entry.lastUsed = this.frameId;
        entry.uses += 1;
        this.stats.hits += 1;
        this.stats.hitsThisFrame += 1;
        this.incrementModelCounter(this.stats.modelHits, modelId);
      } else {
        const perf = this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
        const maxMissesThisFrame = Math.max(8, Math.floor(Number(perf.spriteCacheMaxMissesPerFrame) || 96));
        if (this.stats.missesThisFrame >= maxMissesThisFrame) {
          this.stats.budgetSkipsThisFrame += 1;
          return false;
        }
        this.stats.misses += 1;
        this.stats.missesThisFrame += 1;
        this.incrementModelCounter(this.stats.modelMisses, modelId);
        const bounds = this.boundsFor(actor, options);
        const canvas = this.canvasFactory(Math.max(32, Math.ceil(bounds.width * scale)), Math.max(32, Math.ceil(bounds.height * scale)));
        const c = this.getContext(canvas);
        if (!c) return false;
        c.clearRect(0, 0, canvas.width, canvas.height);
        const bakeActor = {
          ...actor,
          sourceEntity: actor.sourceEntity || actor,
          screenX: bounds.originX,
          screenY: bounds.originY,
          _nameplateAnchor: null
        };
        try {
          c.save();
          c.imageSmoothingEnabled = false;
          try { c.filter = 'none'; } catch (_err) {}
          c.setTransform?.(scale, 0, 0, scale, 0, 0);
          const ok = model.draw(c, bakeActor, nowMs) !== false;
          c.restore();
          if (!ok) return false;
        } catch (err) {
          try { c.restore(); } catch (_) {}
          this.stats.failures += 1;
          if (this.stats.failures < 12) console.warn('[DreamRealms] runtime sprite cache bake failed; falling back', modelId, err);
          return false;
        }
        const anchor = bakeActor._nameplateAnchor
          ? { dx: (safeNumber(bakeActor._nameplateAnchor.x, bounds.originX) - bounds.originX) * scale, dy: (safeNumber(bakeActor._nameplateAnchor.y, bounds.originY - 90) - bounds.originY) * scale }
          : null;
        const propagatedProps = {};
        for (const prop of ['_wolfDedicatedRenderer','_boarDedicatedRenderer','_rotlingDedicatedRenderer','_wolfVisualKey','_rotlingVisualKey','_darkWoodsMobVisualKey','_darkWoodsMobRenderer','_darkWoodsMobAction','_trainerClassRenderer']) {
          if (bakeActor[prop] != null) propagatedProps[prop] = bakeActor[prop];
        }
        entry = { canvas, width: canvas.width, height: canvas.height, originX: bounds.originX * scale, originY: bounds.originY * scale, scale, anchor, props: propagatedProps, lastUsed: this.frameId, uses: 1 };
        this.entries.set(key, entry);
        this.stats.generatedThisFrame += 1;
        this.enforceBudget();
      }
      targetCtx.save();
      try {
        targetCtx.imageSmoothingEnabled = false;
        try { targetCtx.filter = 'none'; } catch (_err) {}
        targetCtx.drawImage(entry.canvas, Math.round(screenX - entry.originX), Math.round(screenY - entry.originY));
      } finally {
        targetCtx.restore();
      }
      actor._runtimeSpriteCached = true;
      actor._runtimeSpriteCacheKey = key;
      if (entry.props && typeof entry.props === 'object') Object.assign(actor, entry.props);
      if (entry.anchor) actor._nameplateAnchor = { x: screenX + entry.anchor.dx, y: screenY + entry.anchor.dy };
      this.stats.draws += 1;
      this.stats.entries = this.entries.size;
      return true;
    }

    topModelCounters(bucket, limit = 5) {
      return Object.entries(bucket || {})
        .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
        .slice(0, Math.max(0, limit))
        .map(([model, count]) => ({ model, count }));
    }

    snapshotStats() {
      return {
        ...this.stats,
        entries: this.entries.size,
        maxEntries: this.maxEntries,
        enabled: this.enabled && DR.CONFIG?.PERFORMANCE?.enableSpriteCache !== false,
        topMissModels: this.topModelCounters(this.stats.modelMisses, 5),
        topHitModels: this.topModelCounters(this.stats.modelHits, 5)
      };
    }
  }

  DR.RuntimeSpriteCacheSystem = RuntimeSpriteCacheSystem;
  DR.systems.RuntimeSpriteCacheSystem = RuntimeSpriteCacheSystem;
})();
