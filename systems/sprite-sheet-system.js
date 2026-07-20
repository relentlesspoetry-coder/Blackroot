(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.assets = DR.assets || {};

  const DEFAULT_INDEX_URL = './assets/sprites/sprite-index.json';
  const FRAME_WARN_LIMIT = 768;
  const CLASS_MODELS = Object.freeze(['Paladin', 'Warden', 'Fighter', 'Rogue', 'Ranger', 'Assassin', 'Wizard', 'Shaman', 'Summoner', 'Necromancer', 'Cleric', 'Druid', 'Bard', 'Enchanter']);

  function normalizeToken(value, fallback = 'default') {
    const helper = DR.SpriteAtlasSystem?.normalizeToken;
    if (helper) return helper(value, fallback);
    const text = String(value ?? '').trim();
    return text ? (text.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || fallback) : fallback;
  }

  function normalizeDirection(value, fallback = 'south') {
    const helper = DR.SpriteAtlasSystem?.normalizeDirection;
    return helper ? helper(value, fallback) : fallback;
  }

  function inferModelId(actor = {}) {
    const helper = DR.SpriteAtlasSystem?.inferModelId;
    return helper ? helper(actor) : normalizeToken(actor.rendererId || actor.family || actor.kind || 'Unknown', 'Unknown');
  }


  function inferObjectModelId(object = {}) {
    const explicit = object.spriteModelId || object.modelId || object.visualModelId;
    if (explicit) return normalizeToken(explicit, 'UnknownProp');
    const helper = DR.SpriteBakeSystem?.propModelIdForObjectType;
    if (helper) return normalizeToken(helper(object.type, 'UnknownProp'), 'UnknownProp');
    return normalizeToken(object.type || 'UnknownProp', 'UnknownProp');
  }

  function inferObjectVariant(object = {}) {
    return normalizeToken(object.variant || object.visualVariant || 'default', 'default');
  }

  function inferObjectAction(object = {}) {
    if (object.open === true) return 'open';
    if (object.active === true) return 'active';
    if (object.lit === true || object.type === 'torch' || object.type === 'fire') return 'flicker';
    if (object.glowing === true || /glow|crystal|venom|egg/i.test(String(object.type || ''))) return 'glow';
    return normalizeToken(object.action || object.state || 'idle', 'idle');
  }

  function inferObjectFrameIndex(object = {}, action = 'idle', frameCount = 1) {
    const count = Math.max(1, Number(frameCount) || 1);
    if (count <= 1) return 0;
    const explicit = Number(object.spriteFrameIndex ?? object.frameIndex);
    if (Number.isFinite(explicit)) return ((Math.floor(explicit) % count) + count) % count;
    const now = Number(object.renderNowMs || (typeof performance !== 'undefined' ? performance.now() : Date.now())) * 0.001;
    const seed = String(object.id || object.name || object.type || 'prop').split('').reduce((sum, ch) => (sum + ch.charCodeAt(0)) % 997, 0) * 0.013;
    if (action === 'flicker' || action === 'glow' || action === 'pulse') return Math.floor((now * 5 + seed) % count);
    if (action === 'sway') return Math.floor((now * 3 + seed) % count);
    return 0;
  }

  function inferVariant(actor = {}) {
    const helper = DR.SpriteAtlasSystem?.inferVariant;
    return helper ? helper(actor) : normalizeToken(actor.variant || actor.visualVariant || 'normal', 'normal');
  }

  function inferAction(actor = {}) {
    const helper = DR.SpriteAtlasSystem?.inferAction;
    return helper ? helper(actor) : (actor.dead || actor.alive === false ? 'death' : (actor.action || 'idle'));
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
      indexRequested: 0,
      indexLoaded: 0,
      indexErrors: 0,
      modelsRegistered: 0,
      modelMetadataRequested: 0,
      modelMetadataLoaded: 0,
      modelMetadataErrors: 0,
      modelImagesRequested: 0,
      modelImagesLoaded: 0,
      modelImageErrors: 0,
      framesLoaded: 0,
      spriteDraws: 0,
      proceduralFallbacks: 0,
      missingFrames: 0,
      missingModels: 0,
      invalidFrames: 0,
      lastIndexUrl: '',
      lastError: '',
      fallbackReasons: Object.create(null)
    };
  }

  class SpriteSheetSystem {
    constructor(game = null, options = {}) {
      this.game = game;
      this.assetSystem = options.assetSystem || new (DR.AssetSystem || DR.assets.AssetSystem || class {})({ baseUrl: './' });
      this.enabled = options.enabled !== false;
      this.debugDraw = !!options.debugDraw;
      this.index = null;
      this.indexUrl = options.indexUrl || DEFAULT_INDEX_URL;
      this.indexBasePath = './assets/sprites/';
      this.indexReady = false;
      this.indexLoading = false;
      this.models = new Map();
      this.sheets = new Map();
      this.loadingModels = new Map();
      this.failedModels = new Set();
      this.frameCounts = new Map();
      this.warnedMissingFrames = new Set();
      this.warnedMissingModels = new Set();
      this.stats = createStats();
    }

    async loadDefaultIndex(options = {}) {
      return this.loadIndex(options.url || this.indexUrl, { silent: options.silent !== false });
    }

    async loadIndex(indexUrl, options = {}) {
      if (!this.enabled || !indexUrl || this.indexLoading) return false;
      this.indexLoading = true;
      this.stats.indexRequested++;
      this.stats.lastIndexUrl = indexUrl;
      let index = await this.assetSystem.loadJson(indexUrl, { silent: options.silent !== false });
      if (!index || typeof index !== 'object') index = await this.loadScriptIndex(indexUrl, options);
      this.indexLoading = false;
      if (!index || typeof index !== 'object') {
        this.indexReady = false;
        this.stats.indexErrors++;
        this.stats.lastError = `Sprite index unavailable: ${indexUrl}`;
        return false;
      }
      this.index = index;
      this.indexReady = true;
      this.indexBasePath = indexUrl.includes('/') ? indexUrl.slice(0, indexUrl.lastIndexOf('/') + 1) : './';
      this.models.clear();
      const models = index.models || {};
      for (const [modelId, model] of Object.entries(models)) {
        if (!model || typeof model !== 'object') continue;
        this.models.set(normalizeToken(modelId, modelId), { ...model, modelId: normalizeToken(model.modelId || modelId, modelId) });
      }
      this.stats.indexLoaded++;
      this.stats.modelsRegistered = this.models.size;
      return true;
    }

    loadScriptIndex(indexUrl, options = {}) {
      return new Promise(resolve => {
        const scriptUrl = String(indexUrl || '').replace(/\.json(?:$|[?#])/, '.manifest.js');
        if (!scriptUrl || scriptUrl === indexUrl) return resolve(null);
        const script = document.createElement('script');
        script.async = false;
        script.onload = () => {
          const indexes = window.DreamRealmsSpriteSheetIndexes || {};
          const index = indexes[indexUrl] || indexes['sprite-index.json'] || window.DreamRealmsSpriteSheetIndex || null;
          if (!index && !options.silent) console.warn(`[SpriteSheetSystem] Index script loaded but no sprite index was registered: ${scriptUrl}`);
          resolve(index);
        };
        script.onerror = () => {
          if (!options.silent) console.warn(`[SpriteSheetSystem] Failed to load sprite-index script fallback: ${scriptUrl}`);
          resolve(null);
        };
        script.src = scriptUrl;
        document.head.appendChild(script);
      });
    }

    resolvePath(path, base = this.indexBasePath) {
      const value = String(path || '').trim();
      if (!value) return '';
      if (/^(https?:|data:|blob:|\.\/|\.\.\/|\/)/i.test(value)) return value;
      if (value.startsWith('assets/')) return `./${value}`;
      return `${base}${value}`;
    }

    ensureModelSheetLoaded(modelId, options = {}) {
      const id = normalizeToken(modelId, 'Unknown');
      if (!this.enabled || !this.indexReady || id === 'Unknown') return null;
      if (this.sheets.has(id)) return Promise.resolve(this.sheets.get(id));
      if (this.failedModels.has(id)) return null;
      if (this.loadingModels.has(id)) return this.loadingModels.get(id);
      const entry = this.models.get(id);
      if (!entry) {
        this.warnMissingModelOnce(id);
        return null;
      }
      const promise = this.loadModelSheet(id, options).finally(() => this.loadingModels.delete(id));
      this.loadingModels.set(id, promise);
      return promise;
    }

    async loadModelSheet(modelId, options = {}) {
      const id = normalizeToken(modelId, 'Unknown');
      const entry = this.models.get(id);
      if (!entry) return null;
      this.stats.modelMetadataRequested++;
      const metadataUrl = this.resolvePath(entry.metadata || entry.json || `${entry.type === 'class' ? 'classes' : entry.type === 'prop' ? 'props' : 'mobs'}/${id}.json`);
      const metaBase = metadataUrl.includes('/') ? metadataUrl.slice(0, metadataUrl.lastIndexOf('/') + 1) : this.indexBasePath;
      let metadata = await this.assetSystem.loadJson(metadataUrl, { silent: options.silent !== false });
      if (!metadata || typeof metadata !== 'object') metadata = await this.loadScriptSheetMetadata(metadataUrl, options);
      if (!metadata || typeof metadata !== 'object') {
        this.stats.modelMetadataErrors++;
        this.stats.lastError = `Sprite sheet metadata unavailable for ${id}: ${metadataUrl}`;
        this.failedModels.add(id);
        return null;
      }
      this.stats.modelMetadataLoaded++;
      const imagePath = metadata.image || entry.image || `${id}.png`;
      const imageUrl = this.resolvePath(imagePath, metaBase);
      this.stats.modelImagesRequested++;
      const image = await this.assetSystem.loadImage(imageUrl, { silent: options.silent !== false });
      if (!image) {
        this.stats.modelImageErrors++;
        this.stats.lastError = `Sprite sheet image unavailable for ${id}: ${imageUrl}`;
        this.failedModels.add(id);
        return null;
      }
      this.stats.modelImagesLoaded++;
      const frames = new Map();
      const rawFrames = metadata.frames || {};
      for (const [key, raw] of Object.entries(rawFrames)) {
        if (!raw || typeof raw !== 'object') continue;
        const frame = { ...raw, key, modelId: metadata.modelId || id, image, page: imagePath };
        if (!this.isValidFrame(frame)) {
          this.stats.invalidFrames++;
          continue;
        }
        frames.set(key, frame);
        this.indexFrameCount(id, frame);
      }
      const sheet = { modelId: id, type: metadata.type || entry.type || 'entity', metadata, image, frames, entry };
      this.sheets.set(id, sheet);
      this.stats.framesLoaded = Array.from(this.sheets.values()).reduce((sum, s) => sum + s.frames.size, 0);
      return sheet;
    }

    loadScriptSheetMetadata(metadataUrl, options = {}) {
      return new Promise(resolve => {
        const scriptUrl = String(metadataUrl || '').replace(/\.json(?:$|[?#])/, '.manifest.js');
        if (!scriptUrl || scriptUrl === metadataUrl) return resolve(null);
        const script = document.createElement('script');
        script.async = false;
        script.onload = () => {
          const metas = window.DreamRealmsSpriteSheetMetadata || {};
          const basename = String(metadataUrl || '').split('/').pop();
          const metadata = metas[metadataUrl] || metas[basename] || null;
          resolve(metadata);
        };
        script.onerror = () => resolve(null);
        script.src = scriptUrl;
        document.head.appendChild(script);
      });
    }

    isValidFrame(frame) {
      return !!frame && frame.image && Number(frame.w || frame.width || 0) > 0 && Number(frame.h || frame.height || 0) > 0 && Number.isFinite(Number(frame.anchorX)) && Number.isFinite(Number(frame.anchorY));
    }

    indexFrameCount(modelId, frame) {
      const baseKey = [modelId, frame.variant, frame.state, frame.direction].map(v => normalizeToken(v, 'default')).join('.');
      const current = this.frameCounts.get(baseKey) || 0;
      const index = Number(frame.frameIndex || 0);
      this.frameCounts.set(baseKey, Math.max(current, index + 1));
    }

    isReady() { return !!(this.enabled && this.indexReady); }

    getFrame(modelId, frameKey, options = {}) {
      const id = normalizeToken(modelId, 'Unknown');
      if (!this.isReady() || !id || !frameKey) return null;
      const sheet = this.sheets.get(id);
      if (!sheet) {
        this.ensureModelSheetLoaded(id, options);
        return null;
      }
      const frame = sheet.frames.get(frameKey);
      if (!frame && options.warn !== false) this.warnMissingFrameOnce(`${id}.${frameKey}`);
      return frame || null;
    }

    getEntityFrame(actor = {}, game = this.game, options = {}) {
      const modelId = inferModelId(actor);
      if (!modelId || modelId === 'Unknown') return null;
      this.ensureModelSheetLoaded(modelId, options);
      const sheet = this.sheets.get(modelId);
      if (!sheet) return null;
      const candidates = this.getEntityLocalFrameKeyCandidates(actor, game, modelId);
      for (const key of candidates) {
        const frame = this.getFrame(modelId, key, { warn: false });
        if (frame) return { frame, key, modelId, fullKey: `${modelId}.${key}` };
      }
      if (options.warn !== false && candidates[0]) this.warnMissingFrameOnce(`${modelId}.${candidates[0]}`);
      return null;
    }


    getObjectFrame(object = {}, game = this.game, options = {}) {
      const modelId = inferObjectModelId(object);
      if (!modelId || modelId === 'UnknownProp') return null;
      this.ensureModelSheetLoaded(modelId, options);
      const sheet = this.sheets.get(modelId);
      if (!sheet) return null;
      const candidates = this.getObjectLocalFrameKeyCandidates(object, game, modelId);
      for (const key of candidates) {
        const frame = this.getFrame(modelId, key, { warn: false });
        if (frame) return { frame, key, modelId, fullKey: `${modelId}.${key}` };
      }
      if (options.warn !== false && candidates[0]) this.warnMissingFrameOnce(`${modelId}.${candidates[0]}`);
      return null;
    }

    getObjectLocalFrameKeyCandidates(object = {}, game = this.game, modelId = inferObjectModelId(object)) {
      const variant = inferObjectVariant(object);
      const action = normalizeToken(inferObjectAction(object), 'idle');
      const direction = normalizeDirection(object.direction || object.facingName || 'south', 'south');
      const actionFallbacks = action === 'idle' ? ['idle'] : [action, 'idle'];
      const variantFallbacks = variant === 'default' ? ['default'] : [variant, 'default'];
      const directionFallbacks = direction === 'south' ? ['south'] : [direction, 'south'];
      const keys = [];
      const seen = new Set();
      for (const v of variantFallbacks) {
        for (const a of actionFallbacks) {
          for (const d of directionFallbacks) {
            const count = this.getFrameCount(modelId, v, a, d);
            const idx = inferObjectFrameIndex(object, a, count);
            for (const frameIndex of [idx, 0]) {
              const key = `${v}.${a}.${d}.${frameIndex}`;
              if (!seen.has(key)) { seen.add(key); keys.push(key); }
            }
          }
        }
      }
      return keys;
    }

    getEntityLocalFrameKeyCandidates(actor = {}, game = this.game, modelId = inferModelId(actor)) {
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
            const key = `${v}.${a}.${d}.${idx}`;
            if (!seen.has(key)) { seen.add(key); keys.push(key); }
            const key0 = `${v}.${a}.${d}.0`;
            if (!seen.has(key0)) { seen.add(key0); keys.push(key0); }
          }
        }
      }
      return keys;
    }

    fallbackVariantForModel(modelId, variant) {
      const key = String(modelId || '').toLowerCase();
      if (CLASS_MODELS.map(v => v.toLowerCase()).includes(key)) return variant === 'trainer' ? 'trainer' : 'player';
      if (key === 'briarboar') return 'briarBoar';
      if (key === 'gloomwolf') return 'gloomWolf';
      if (key === 'rotling') return 'rotling';
      if (key === 'spider') return 'lurker';
      if (key === 'spirithealer') return 'default';
      return 'normal';
    }

    actionFallbacks(action) {
      const a = normalizeToken(action, 'idle');
      const atlas = DR.SpriteAtlasSystem?.prototype;
      if (atlas?.actionFallbacks) return atlas.actionFallbacks.call({ }, a);
      const fallbacks = { swim: ['swim', 'walk', 'idle'], charge: ['charge', 'attack', 'idle'], specialAttack: ['specialAttack', 'attack', 'cast', 'idle'], rangedAttack: ['rangedAttack', 'attack', 'cast', 'idle'], corruptionCast: ['corruptionCast', 'specialAttack', 'attack', 'idle'], sporeBurst: ['sporeBurst', 'corruptionCast', 'specialAttack', 'idle'], cast: ['cast', 'idle'], meditate: ['meditate', 'idle'], hit: ['hit', 'idle'], death: ['death', 'idle'], walk: ['walk', 'idle'], attack: ['attack', 'idle'], idle: ['idle'] };
      return fallbacks[a] || [a, 'idle'];
    }

    getFrameCount(modelId, variant, state, direction) {
      const key = [modelId, variant, state, direction].map(v => normalizeToken(v, 'default')).join('.');
      return this.frameCounts.get(key) || 1;
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
      this.recordSpriteDraw();
      return true;
    }

    applyFrameAnchors(entity, frame, screenX, screenY, scale = 1) {
      if (!entity || !frame) return;
      const anchorX = Number(frame.anchorX ?? frame.w / 2 ?? 0);
      const anchorY = Number(frame.anchorY ?? frame.h * 0.72 ?? 0);
      const localToScreen = (x, y) => ({ x: screenX + (Number(x) - anchorX) * scale, y: screenY + (Number(y) - anchorY) * scale });
      if (Number.isFinite(Number(frame.nameplateAnchorX)) && Number.isFinite(Number(frame.nameplateAnchorY))) entity._nameplateAnchor = localToScreen(frame.nameplateAnchorX, frame.nameplateAnchorY);
      if (Number.isFinite(Number(frame.footAnchorX)) && Number.isFinite(Number(frame.footAnchorY))) entity._spriteFootAnchor = localToScreen(frame.footAnchorX, frame.footAnchorY);
      if (Number.isFinite(Number(frame.shadowAnchorX)) && Number.isFinite(Number(frame.shadowAnchorY))) entity._spriteShadowAnchor = localToScreen(frame.shadowAnchorX, frame.shadowAnchorY);
      if (frame.clickBounds && typeof frame.clickBounds === 'object') {
        const topLeft = localToScreen(frame.clickBounds.x, frame.clickBounds.y);
        entity._spriteClickBounds = { x: topLeft.x, y: topLeft.y, w: Number(frame.clickBounds.w || 0) * scale, h: Number(frame.clickBounds.h || 0) * scale };
      }
    }

    warnMissingModelOnce(modelId) {
      if (!modelId || this.warnedMissingModels.has(modelId) || this.warnedMissingModels.size >= FRAME_WARN_LIMIT) return;
      this.warnedMissingModels.add(modelId);
      this.stats.missingModels = this.warnedMissingModels.size;
      console.warn(`[SpriteSheetSystem] No per-model sprite sheet registered for ${modelId}; using procedural fallback.`);
    }

    warnMissingFrameOnce(key) {
      if (!key || this.warnedMissingFrames.has(key) || this.warnedMissingFrames.size >= FRAME_WARN_LIMIT) return;
      this.warnedMissingFrames.add(key);
      this.stats.missingFrames = this.warnedMissingFrames.size;
      console.warn(`[SpriteSheetSystem] Missing sprite frame: ${key}; using procedural fallback.`);
    }

    recordSpriteDraw() { this.stats.spriteDraws++; }

    recordProceduralFallback(reason = 'procedural') {
      this.stats.proceduralFallbacks++;
      const key = normalizeToken(reason, 'procedural');
      this.stats.fallbackReasons[key] = (this.stats.fallbackReasons[key] || 0) + 1;
    }

    setDebugEnabled(enabled) { this.debugDraw = !!enabled; return this.debugDraw; }
    getStats() { return { ...this.stats, ready: this.indexReady, enabled: this.enabled, modelsLoaded: this.sheets.size, modelsFailed: this.failedModels.size, modelsRegistered: this.models.size, missingFrames: this.warnedMissingFrames.size, missingModels: this.warnedMissingModels.size }; }
  }

  SpriteSheetSystem.CLASS_MODELS = CLASS_MODELS;
  SpriteSheetSystem.normalizeToken = normalizeToken;
  SpriteSheetSystem.inferModelId = inferModelId;
  SpriteSheetSystem.inferVariant = inferVariant;
  SpriteSheetSystem.inferAction = inferAction;
  SpriteSheetSystem.inferObjectModelId = inferObjectModelId;
  SpriteSheetSystem.inferObjectVariant = inferObjectVariant;
  SpriteSheetSystem.inferObjectAction = inferObjectAction;

  DR.SpriteSheetSystem = SpriteSheetSystem;
  DR.assets.SpriteSheetSystem = SpriteSheetSystem;
})();
