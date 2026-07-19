(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};
  DR.assets = DR.assets || {};

  const DIRECTIONS = Object.freeze(['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']);
  const CLASS_MODELS = Object.freeze(['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter']);
  const CLASS_MODEL_SET = new Set(CLASS_MODELS.map(v => v.toLowerCase()));
  const DEFAULT_MANIFEST_URL = './assets/atlases/entities.json';
  const FRAME_WARN_LIMIT = 512;

  function normalizeToken(value, fallback = 'default') {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    return text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || fallback;
  }

  function normalizeDirection(value, fallback = 'south') {
    const text = String(value || '').toLowerCase().replace(/[\s_-]/g, '');
    const map = {
      n: 'north', north: 'north',
      ne: 'northeast', northeast: 'northeast',
      e: 'east', east: 'east',
      se: 'southeast', southeast: 'southeast',
      s: 'south', south: 'south',
      sw: 'southwest', southwest: 'southwest',
      w: 'west', west: 'west',
      nw: 'northwest', northwest: 'northwest'
    };
    return map[text] || fallback;
  }

  function inferAction(actor = {}) {
    if (actor.dead || actor.alive === false || actor.action === 'death') return 'death';
    const explicit = String(actor.action || '').trim();
    if (explicit) {
      if (explicit === 'performing') return 'cast';
      if (explicit === 'howl') return 'specialAttack';
      if (explicit === 'webSpit' || explicit === 'sporeBurst' || explicit === 'corruptionCast') return explicit;
      return explicit;
    }
    if (actor.meditating) return 'meditate';
    if (actor.fishing) return 'fishing';
    if (actor.swimming || actor.inWater) return 'swim';
    if (Number(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0) > 0.02) return 'hit';
    if (Number(actor.spellCastAnim || 0) > 0.05) return actor.kind === 'enemy' ? 'specialAttack' : 'cast';
    if (Number(actor.attackAnim || 0) > 0.02) return actor.chargeActive || actor.charging ? 'charge' : 'attack';
    if (actor.isMoving || Number(actor.moveBlend || 0) > 0.08 || Math.abs(actor.vx || 0) + Math.abs(actor.vy || 0) > 0.01) return 'walk';
    return 'idle';
  }

  function inferModelId(actor = {}) {
    const base = actor.baseType || {};
    const renderer = String(actor.rendererId || base.rendererId || '').toLowerCase();
    const family = String(actor.family || base.family || '').toLowerCase();
    const visual = String(actor.mobVisualKey || base.mobVisualKey || actor.visualKey || base.visualKey || '').toLowerCase();
    const name = String(actor.name || base.name || actor.mobType || '').toLowerCase();
    const className = actor.className || actor.playerClass || actor.classId || base.className || base.playerClass;

    if (actor.visualRole === 'spirit_healer' || actor.visualRole === 'spiritHealer' || renderer.includes('spirit') || name.includes('spirit healer')) return 'SpiritHealer';
    if (renderer.includes('boar') || family.includes('boar') || visual.includes('boar') || name.includes('boar') || name.includes('briarback') || name.includes('tusk')) return 'BriarBoar';
    if (renderer.includes('wolf') || family.includes('wolf') || visual.includes('wolf') || name.includes('wolf') || name.includes('mossfang')) return 'GloomWolf';
    if (renderer.includes('rotling') || family.includes('rotling') || visual.includes('rotling') || name.includes('rotling')) return 'Rotling';
    if (renderer.includes('spider') || family.includes('spider') || visual.includes('spider') || name.includes('spider') || name.includes('silk')) return 'Spider';
    if (renderer.includes('skeleton') || family.includes('skeleton') || name.includes('skeleton') || name.includes('bone')) return 'Skeleton';
    if (renderer.includes('bandit') || family.includes('bandit') || name.includes('bandit')) return 'Bandit';
    // V0.20.53: these three had no branch, so they fell through to the generic rendererId return below
    // and asked the atlas for 'wisp.*' / 'stag.*' / 'deadroot.*'. The baker writes them under their
    // canonical model names, so every frame missed and 267/400 live entities stayed procedural.
    if (renderer.includes('wisp') || family.includes('wisp') || visual.includes('wisp') || name.includes('wisp')) return 'Wisp';
    if (renderer.includes('stag') || family.includes('stag') || visual.includes('stag') || name.includes('stag')) return 'HollowStag';
    if (renderer.includes('deadroot') || renderer.includes('ashroot') || family.includes('deadroot') || family.includes('ashroot') || visual.includes('ashroot') || name.includes('ashroot')) return 'AshRootHorror';
    if (className) return normalizeToken(className, 'ClassModel');
    if (actor.kind === 'player' || actor.kind === 'bot' || actor.visualRole === 'class_trainer' || renderer === 'classtrainer' || renderer === 'classTrainer') return normalizeToken(className || 'Fighter', 'Fighter');
    return normalizeToken(renderer || family || actor.kind || 'Unknown', 'Unknown');
  }

  function inferVariant(actor = {}) {
    const base = actor.baseType || {};
    const modelId = inferModelId(actor);
    const modelKey = String(modelId || '').toLowerCase();
    const visualRole = String(actor.visualRole || base.visualRole || '').toLowerCase();
    const rendererId = String(actor.rendererId || base.rendererId || '').toLowerCase();
    const name = String(actor.name || base.name || '').toLowerCase();

    if (modelKey === 'spirithealer') return 'default';
    if (CLASS_MODEL_SET.has(modelKey)) {
      if (visualRole === 'class_trainer' || rendererId === 'classtrainer') return 'trainer';
      return 'player';
    }
    if (modelKey === 'briarboar') {
      if (name.includes('old tusk') || name.includes('briarback')) return 'oldTuskBriarback';
      return normalizeToken(actor.mobVisualKey || base.mobVisualKey || actor.boarPalette || base.boarPalette || actor.paletteKey || base.paletteKey || 'briarBoar', 'briarBoar');
    }
    if (modelKey === 'gloomwolf') {
      if (name.includes('mossfang')) return 'mossfangAlpha';
      return normalizeToken(actor.mobVisualKey || base.mobVisualKey || actor.wolfPalette || base.wolfPalette || actor.paletteKey || base.paletteKey || 'gloomWolf', 'gloomWolf');
    }
    if (modelKey === 'rotling') {
      return normalizeToken(actor.mobVisualKey || base.mobVisualKey || actor.rotlingPalette || base.rotlingPalette || actor.paletteKey || base.paletteKey || 'rotling', 'rotling');
    }
    if (modelKey === 'spider') {
      return normalizeToken(actor.spiderRole || base.spiderRole || actor.mobVisualKey || base.mobVisualKey || actor.visualKey || base.visualKey || 'lurker', 'lurker');
    }

    const text = String(actor.mobVisualKey || base.mobVisualKey || actor.visualKey || base.visualKey || actor.variant || actor.visualVariant || actor.trainerVisualVariant || actor.paletteKey || base.paletteKey || actor.rendererVariant || '').trim();
    if (text) return normalizeToken(text, 'normal');
    if (actor.named || actor.isNamed || actor.dungeonBoss || actor.boss) return 'named';
    if (actor.elite || actor.dungeonMiniBoss) return 'elite';
    if (actor.rare) return 'rare';
    return 'normal';
  }

  function inferFrameIndex(actor = {}, action = 'idle', frameCount = 1) {
    const count = Math.max(1, Number(frameCount) || 1);
    if (count <= 1) return 0;
    const explicit = Number(actor.spriteFrameIndex ?? actor.frameIndex);
    if (Number.isFinite(explicit)) return ((Math.floor(explicit) % count) + count) % count;
    const now = Number(actor.renderNowMs || (typeof performance !== 'undefined' ? performance.now() : Date.now())) * 0.001;
    const offset = Number(actor.animationSeed || actor.id || 0) * 0.017;
    if (action === 'death') return Math.min(count - 1, Math.floor(Number(actor.deathProgress || 1) * count));
    if (action === 'hit') return Math.min(count - 1, Math.floor((1 - Math.max(0, Math.min(1, Number(actor.hitAnim || 0)))) * count));
    if (action === 'attack' || action === 'specialAttack' || action === 'charge' || action === 'rangedAttack') {
      const t = Math.max(0, Math.min(0.999, Number(actor.attackAnim || actor.spellCastAnim || 0)));
      if (t > 0) return Math.min(count - 1, Math.floor((1 - t) * count));
      return Math.floor((now * 8 + offset) % count);
    }
    if (action === 'walk') return Math.floor((now * 8 + offset) % count);
    if (action === 'swim') return Math.floor((now * 5 + offset) % count);
    if (action === 'cast' || action === 'meditate' || action === 'fishing' || action === 'corruptionCast' || action === 'sporeBurst') return Math.floor((now * 4 + offset) % count);
    return Math.floor((now * 2 + offset) % count);
  }

  function createStats() {
    return {
      manifestsRequested: 0,
      manifestsLoaded: 0,
      manifestErrors: 0,
      pagesRequested: 0,
      pagesLoaded: 0,
      pageErrors: 0,
      framesLoaded: 0,
      atlasDraws: 0,
      proceduralFallbacks: 0,
      missingFrames: 0,
      invalidFrames: 0,
      lastManifestUrl: '',
      lastError: '',
      lastLoadedAt: 0,
      fallbackReasons: Object.create(null)
    };
  }

  class SpriteAtlasSystem {
    constructor(game = null, options = {}) {
      this.game = game;
      this.assetSystem = options.assetSystem || new (DR.AssetSystem || DR.assets.AssetSystem || class {})({ baseUrl: './' });
      this.manifests = new Map();
      this.frames = new Map();
      this.pages = new Map();
      this.frameCounts = new Map();
      this.warnedMissingFrames = new Set();
      this.ready = false;
      this.loading = false;
      this.failed = false;
      this.enabled = options.enabled !== false;
      this.hasFrames = false;
      this.debugDraw = !!options.debugDraw;
      this.stats = createStats();
    }

    async loadDefaultAtlases(options = {}) {
      return this.loadAtlas(options.url || DEFAULT_MANIFEST_URL, { silent: options.silent !== false });
    }

    async loadAtlas(manifestUrl, options = {}) {
      if (!this.enabled || !manifestUrl || this.loading) return false;
      this.loading = true;
      this.stats.manifestsRequested++;
      this.stats.lastManifestUrl = manifestUrl;
      let manifest = await this.assetSystem.loadJson(manifestUrl, { silent: options.silent !== false });
      if (!manifest || typeof manifest !== 'object') {
        manifest = await this.loadScriptManifest(manifestUrl, options);
      }
      this.loading = false;
      if (!manifest || typeof manifest !== 'object') {
        this.ready = false;
        this.failed = false;
        this.stats.manifestErrors++;
        this.stats.lastError = `Manifest unavailable: ${manifestUrl}`;
        return false;
      }

      this.stats.manifestsLoaded++;
      const basePath = manifestUrl.includes('/') ? manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1) : './';
      const pageNames = this.resolveManifestPages(manifest);
      const loadedPages = new Map();
      for (const pageName of pageNames) {
        this.stats.pagesRequested++;
        const pagePath = /^(https?:|data:|blob:|\.\/|\.\.\/|\/)/i.test(pageName) ? pageName : `${basePath}${pageName}`;
        const image = await this.assetSystem.loadImage(pagePath, { silent: options.silent !== false });
        if (image) {
          loadedPages.set(pageName, image);
          this.stats.pagesLoaded++;
        } else {
          this.stats.pageErrors++;
          this.stats.lastError = `Atlas page unavailable: ${pagePath}`;
        }
      }

      this.manifests.set(manifestUrl, manifest);
      for (const [pageName, image] of loadedPages) this.pages.set(pageName, image);
      const frames = manifest.frames || {};
      for (const [key, rawFrame] of Object.entries(frames)) {
        if (!rawFrame || typeof rawFrame !== 'object') continue;
        const pageName = rawFrame.page || rawFrame.atlas || rawFrame.image || manifest.image || pageNames[0] || '';
        const image = loadedPages.get(pageName) || this.pages.get(pageName);
        if (!image) continue;
        const frame = { ...rawFrame, key: rawFrame.key || key, image, page: pageName };
        if (!this.isValidFrame(frame)) {
          this.stats.invalidFrames++;
          continue;
        }
        this.frames.set(key, frame);
        this.indexFrameCount(frame);
      }
      this.hasFrames = this.frames.size > 0;
      this.ready = this.hasFrames;
      this.failed = false;
      this.stats.framesLoaded = this.frames.size;
      this.stats.lastLoadedAt = Date.now();
      return this.ready;
    }

    isValidFrame(frame) {
      return !!frame && Number(frame.w || frame.width || 0) > 0 && Number(frame.h || frame.height || 0) > 0 && frame.image && Number.isFinite(Number(frame.anchorX)) && Number.isFinite(Number(frame.anchorY));
    }


    loadScriptManifest(manifestUrl, options = {}) {
      return new Promise(resolve => {
        const scriptUrl = String(manifestUrl || '').replace(/\.json(?:$|[?#])/, '.manifest.js');
        if (!scriptUrl || scriptUrl === manifestUrl) return resolve(null);
        const before = window.DreamRealmsSpriteAtlasManifest || null;
        const script = document.createElement('script');
        script.async = false;
        script.onload = () => {
          const manifests = window.DreamRealmsSpriteAtlasManifests || {};
          const manifest = manifests[manifestUrl] || manifests['entities.json'] || window.DreamRealmsSpriteAtlasManifest || null;
          if (!manifest && !options.silent) console.warn(`[SpriteAtlasSystem] Manifest script loaded but no manifest was registered: ${scriptUrl}`);
          if (before && before !== manifest && !manifests[manifestUrl]) window.DreamRealmsSpriteAtlasManifest = before;
          resolve(manifest);
        };
        script.onerror = () => {
          if (!options.silent) console.warn(`[SpriteAtlasSystem] Failed to load manifest script fallback: ${scriptUrl}`);
          resolve(null);
        };
        script.src = scriptUrl;
        document.head.appendChild(script);
      });
    }

    resolveManifestPages(manifest = {}) {
      if (Array.isArray(manifest.pages)) return manifest.pages.map(page => typeof page === 'string' ? page : page && page.image).filter(Boolean);
      if (Array.isArray(manifest.images)) return manifest.images.filter(Boolean);
      if (manifest.image) return [manifest.image];
      return [];
    }

    indexFrameCount(frame) {
      const baseKey = [frame.modelId, frame.variant, frame.state, frame.direction].map(v => normalizeToken(v, 'default')).join('.');
      const current = this.frameCounts.get(baseKey) || 0;
      const index = Number(frame.frameIndex || 0);
      this.frameCounts.set(baseKey, Math.max(current, index + 1));
    }

    isReady() { return !!(this.enabled && this.ready && this.hasFrames); }

    getFrame(key, options = {}) {
      if (!this.isReady() || !key) return null;
      const frame = this.frames.get(key);
      if (!frame && options.warn !== false) this.warnMissingFrameOnce(key);
      return frame || null;
    }

    getEntityFrame(actor = {}, game = this.game, options = {}) {
      const candidates = this.getEntityFrameKeyCandidates(actor, game);
      for (const key of candidates) {
        const frame = this.getFrame(key, { warn: false });
        if (frame) return { frame, key };
      }
      if (options.warn !== false && candidates[0]) this.warnMissingFrameOnce(candidates[0]);
      return null;
    }

    getEntityFrameKeyCandidates(actor = {}, game = this.game) {
      const modelId = inferModelId(actor);
      if (modelId === 'Unknown') return [];
      const variant = inferVariant(actor);
      const action = normalizeToken(inferAction(actor), 'idle');
      const direction = normalizeDirection(actor.facingName || game?.actorFacingName?.(actor) || actor._humanoidSheetDirection || 'south');
      const modelFallbackVariant = this.fallbackVariantForModel(modelId, variant);
      const actionFallbacks = this.actionFallbacks(action);
      const directionFallbacks = direction === 'south' ? ['south'] : [direction, 'south'];
      const variantFallbacks = modelFallbackVariant === variant ? [variant] : [variant, modelFallbackVariant];
      const keys = [];
      const seen = new Set();
      for (const v of variantFallbacks) {
        for (const a of actionFallbacks) {
          for (const d of directionFallbacks) {
            const count = this.getFrameCount(modelId, v, a, d);
            const idx = inferFrameIndex(actor, a, count);
            const key = `${modelId}.${v}.${a}.${d}.${idx}`;
            if (!seen.has(key)) { seen.add(key); keys.push(key); }
            const key0 = `${modelId}.${v}.${a}.${d}.0`;
            if (!seen.has(key0)) { seen.add(key0); keys.push(key0); }
          }
        }
      }
      return keys;
    }

    fallbackVariantForModel(modelId, variant) {
      const key = String(modelId || '').toLowerCase();
      if (CLASS_MODEL_SET.has(key)) return variant === 'trainer' ? 'trainer' : 'player';
      if (key === 'briarboar') return 'briarBoar';
      if (key === 'gloomwolf') return 'gloomWolf';
      if (key === 'rotling') return 'rotling';
      if (key === 'spider') return 'lurker';
      if (key === 'spirithealer') return 'default';
      return 'normal';
    }

    actionFallbacks(action) {
      const a = normalizeToken(action, 'idle');
      const fallbacks = {
        charge: ['charge', 'attack', 'idle'],
        specialAttack: ['specialAttack', 'attack', 'cast', 'idle'],
        rangedAttack: ['rangedAttack', 'attack', 'cast', 'idle'],
        corruptionCast: ['corruptionCast', 'specialAttack', 'attack', 'idle'],
        sporeBurst: ['sporeBurst', 'corruptionCast', 'specialAttack', 'idle'],
        howl: ['specialAttack', 'attack', 'idle'],
        cast: ['cast', 'idle'],
        meditate: ['meditate', 'idle'],
        fishing: ['fishing', 'idle'],
        swim: ['swim', 'walk', 'idle'],
        hit: ['hit', 'idle'],
        death: ['death', 'idle'],
        walk: ['walk', 'idle'],
        attack: ['attack', 'idle'],
        idle: ['idle']
      };
      return fallbacks[a] || [a, 'idle'];
    }

    warnMissingFrameOnce(key) {
      if (!key || this.warnedMissingFrames.has(key) || this.warnedMissingFrames.size >= FRAME_WARN_LIMIT) return;
      this.warnedMissingFrames.add(key);
      this.stats.missingFrames = this.warnedMissingFrames.size;
      console.warn(`[SpriteAtlasSystem] Missing atlas frame: ${key}; using procedural fallback.`);
    }

    getFrameCount(modelId, variant, state, direction) {
      const key = [modelId, variant, state, direction].map(v => normalizeToken(v, 'default')).join('.');
      return this.frameCounts.get(key) || 1;
    }

    getEntityFrameKey(actor = {}, game = this.game) {
      return this.getEntityFrameKeyCandidates(actor, game)[0] || '';
    }

    drawFrame(ctx, frame, screenX, screenY, options = {}) {
      if (!ctx || !frame || !frame.image) return false;
      const scale = Number.isFinite(Number(options.scale)) ? Number(options.scale) : 1;
      const alpha = Number.isFinite(Number(options.alpha)) ? Number(options.alpha) : 1;
      const sx = Number(frame.x || 0);
      const sy = Number(frame.y || 0);
      const sw = Number(frame.w || frame.width || 0);
      const sh = Number(frame.h || frame.height || 0);
      if (sw <= 0 || sh <= 0) return false;
      const anchorX = Number(frame.anchorX ?? sw / 2);
      const anchorY = Number(frame.anchorY ?? Math.round(sh * 0.72));
      const dx = Math.round(screenX - anchorX * scale);
      const dy = Math.round(screenY - anchorY * scale);
      ctx.save();
      ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
      ctx.imageSmoothingEnabled = options.imageSmoothingEnabled === true;
      ctx.drawImage(frame.image, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
      ctx.restore();
      this.recordAtlasDraw();
      return true;
    }

    applyFrameAnchors(entity, frame, screenX, screenY, scale = 1) {
      if (!entity || !frame) return;
      const anchorX = Number(frame.anchorX ?? frame.w / 2 ?? 0);
      const anchorY = Number(frame.anchorY ?? frame.h * 0.72 ?? 0);
      const localToScreen = (x, y) => ({ x: screenX + (Number(x) - anchorX) * scale, y: screenY + (Number(y) - anchorY) * scale });
      if (Number.isFinite(Number(frame.nameplateAnchorX)) && Number.isFinite(Number(frame.nameplateAnchorY))) {
        entity._nameplateAnchor = localToScreen(frame.nameplateAnchorX, frame.nameplateAnchorY);
      }
      if (Number.isFinite(Number(frame.footAnchorX)) && Number.isFinite(Number(frame.footAnchorY))) {
        entity._spriteFootAnchor = localToScreen(frame.footAnchorX, frame.footAnchorY);
      }
      if (Number.isFinite(Number(frame.shadowAnchorX)) && Number.isFinite(Number(frame.shadowAnchorY))) {
        entity._spriteShadowAnchor = localToScreen(frame.shadowAnchorX, frame.shadowAnchorY);
      }
      if (frame.clickBounds && typeof frame.clickBounds === 'object') {
        const topLeft = localToScreen(frame.clickBounds.x, frame.clickBounds.y);
        entity._spriteClickBounds = {
          x: topLeft.x,
          y: topLeft.y,
          w: Number(frame.clickBounds.w || 0) * scale,
          h: Number(frame.clickBounds.h || 0) * scale
        };
      }
    }

    recordAtlasDraw() { this.stats.atlasDraws++; }

    recordProceduralFallback(reason = 'procedural') {
      this.stats.proceduralFallbacks++;
      const key = normalizeToken(reason, 'procedural');
      this.stats.fallbackReasons[key] = (this.stats.fallbackReasons[key] || 0) + 1;
    }

    setDebugEnabled(enabled) { this.debugDraw = !!enabled; return this.debugDraw; }
    getStats() { return { ...this.stats, missingFrames: this.warnedMissingFrames.size, ready: this.ready, enabled: this.enabled, hasFrames: this.hasFrames, framesLoaded: this.frames.size }; }
    resetStats() {
      const persistent = { manifestsRequested: this.stats.manifestsRequested, manifestsLoaded: this.stats.manifestsLoaded, pagesRequested: this.stats.pagesRequested, pagesLoaded: this.stats.pagesLoaded, framesLoaded: this.frames.size };
      this.stats = Object.assign(createStats(), persistent);
    }
  }

  SpriteAtlasSystem.DIRECTIONS = DIRECTIONS;
  SpriteAtlasSystem.CLASS_MODELS = CLASS_MODELS;
  SpriteAtlasSystem.inferModelId = inferModelId;
  SpriteAtlasSystem.inferVariant = inferVariant;
  SpriteAtlasSystem.inferAction = inferAction;
  SpriteAtlasSystem.normalizeDirection = normalizeDirection;
  SpriteAtlasSystem.normalizeToken = normalizeToken;

  DR.SpriteAtlasSystem = SpriteAtlasSystem;
  DR.assets.SpriteAtlasSystem = SpriteAtlasSystem;
})();
