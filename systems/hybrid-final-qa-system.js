// Dream Realms V0.15.34: Final Hybrid renderer QA gate, release-candidate scoring, and layer safety holdoffs.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsHybridFinalQa';
  const LAYERS = Object.freeze([
    Object.freeze({ id: 'terrain', label: 'terrain', activeMethod: 'webglVisibleTerrainLayerActive', errorMetric: 'webglVisibleTerrainLastError' }),
    Object.freeze({ id: 'sprites', label: 'sprites', activeMethod: 'webglVisibleSpriteLayerActive', errorMetric: 'webglVisibleSpriteLastError' }),
    Object.freeze({ id: 'effects', label: 'effects', activeMethod: 'webglVisibleEffectLayerActive', errorMetric: 'webglVisibleEffectLastError' }),
    Object.freeze({ id: 'damageText', label: 'damage text', activeMethod: 'webglVisibleDamageTextLayerActive', errorMetric: 'webglVisibleDamageTextLastError' })
  ]);

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function safeGet(key, fallback = '') {
    try {
      const value = window.localStorage?.getItem?.(key);
      return value == null || value === '' ? fallback : value;
    } catch (_err) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try { window.localStorage?.setItem?.(key, String(value)); } catch (_err) {}
  }

  function safeRemove(key) {
    try { window.localStorage?.removeItem?.(key); } catch (_err) {}
  }

  function storageJson(key, fallback) {
    try {
      const raw = window.localStorage?.getItem?.(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_err) {
      return fallback;
    }
  }

  function toBool(value, fallback = false) {
    if (value === true || value === '1' || value === 'true' || value === 1) return true;
    if (value === false || value === '0' || value === 'false' || value === 0) return false;
    return !!fallback;
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function fmt(value, digits = 1) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : (0).toFixed(digits);
  }

  function avg(list, key) {
    if (!Array.isArray(list) || !list.length) return 0;
    let total = 0;
    let count = 0;
    for (const item of list) {
      const value = key ? num(item?.[key], NaN) : num(item, NaN);
      if (Number.isFinite(value)) {
        total += value;
        count += 1;
      }
    }
    return count ? total / count : 0;
  }

  function maxOf(list, key) {
    if (!Array.isArray(list) || !list.length) return 0;
    let best = 0;
    for (const item of list) {
      const value = key ? num(item?.[key], 0) : num(item, 0);
      if (value > best) best = value;
    }
    return best;
  }

  class HybridFinalQaSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = toBool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableHybridFinalQaGate === false ? '0' : '1'), cfg.enableHybridFinalQaGate !== false);
      this.releaseCandidateArmed = toBool(safeGet(`${STORAGE_PREFIX}:releaseCandidate`, '0'), false);
      this.history = Array.isArray(storageJson(`${STORAGE_PREFIX}:history`, [])) ? storageJson(`${STORAGE_PREFIX}:history`, []) : [];
      this.evidence = Array.isArray(storageJson(`${STORAGE_PREFIX}:evidence`, [])) ? storageJson(`${STORAGE_PREFIX}:evidence`, []) : [];
      this.layerBlockUntil = Object.create(null);
      this.layerBlockReason = Object.create(null);
      this.layerBlockCount = Object.create(null);
      this.layerStreaks = Object.create(null);
      this.frame = 0;
      this.lastSampleMs = 0;
      this.lastPersistMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'waiting for render samples';
      this.lastScore = 0;
      this.metrics = this.defaultMetrics();
      this.patchBackend(this.game?.renderBackendSystem);
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        releaseCandidateArmed: this.releaseCandidateArmed,
        releaseCandidateReady: false,
        status: 'warming',
        state: 'warming',
        score: 0,
        avgScore: 0,
        sampleCount: 0,
        stableFrames: 0,
        warningFrames: 0,
        unsafeFrames: 0,
        criticalFrames: 0,
        blockActive: false,
        blockedLayers: 'none',
        blockReason: '',
        worstLayer: 'none',
        fallbackPressure: 0,
        sceneRisk: 'pending',
        caveRisk: 'unknown',
        cameraRisk: 'unknown',
        seamRisk: 'unknown',
        depthRisk: 'unknown',
        releaseRecommendation: 'Collecting Hybrid final QA samples.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        evidence: []
      };
    }

    persist(force = false) {
      const now = nowMs();
      if (!force && now - this.lastPersistMs < 4000) return;
      this.lastPersistMs = now;
      const limit = Math.max(24, Math.floor(num(this.settings().hybridFinalQaHistoryLimit, 180)));
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      safeSet(`${STORAGE_PREFIX}:releaseCandidate`, this.releaseCandidateArmed ? '1' : '0');
      safeSet(`${STORAGE_PREFIX}:history`, JSON.stringify((this.history || []).slice(-limit)));
      safeSet(`${STORAGE_PREFIX}:evidence`, JSON.stringify((this.evidence || []).slice(-48)));
    }

    setEnabled(enabled, reason = 'manual') {
      this.enabled = !!enabled;
      this.lastAction = this.enabled ? 'enabled' : 'disabled';
      this.lastReason = reason;
      this.metrics.enabled = this.enabled;
      this.syncPerfStats();
      this.persist(true);
      return this.enabled;
    }

    setReleaseCandidateArmed(armed, reason = 'manual') {
      this.releaseCandidateArmed = !!armed;
      this.lastAction = this.releaseCandidateArmed ? 'release candidate armed' : 'release candidate disarmed';
      this.lastReason = reason;
      this.metrics.releaseCandidateArmed = this.releaseCandidateArmed;
      this.syncPerfStats();
      this.persist(true);
      return this.releaseCandidateArmed;
    }

    reset(reason = 'manual reset') {
      this.history = [];
      this.evidence = [];
      this.layerBlockUntil = Object.create(null);
      this.layerBlockReason = Object.create(null);
      this.layerStreaks = Object.create(null);
      this.lastAction = 'reset';
      this.lastReason = reason;
      safeRemove(`${STORAGE_PREFIX}:history`);
      safeRemove(`${STORAGE_PREFIX}:evidence`);
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
      this.persist(true);
      return true;
    }

    beginFrame() {
      this.frame += 1;
      this.patchBackend(this.game?.renderBackendSystem || this.game?.ensureRenderBackendSystem?.());
    }

    layerRemainingMs(layer, at = nowMs()) {
      return Math.max(0, num(this.layerBlockUntil?.[layer], 0) - at);
    }

    isLayerBlocked(layer) {
      if (!this.enabled) return false;
      return this.layerRemainingMs(layer) > 0;
    }

    blockedLayers(at = nowMs()) {
      return LAYERS.map(layer => layer.id).filter(id => this.layerRemainingMs(id, at) > 0);
    }

    blockLayer(layer, reason, durationMs) {
      if (!this.enabled || this.settings().hybridFinalQaAutoBlockLayers === false) return false;
      const id = String(layer || '').trim();
      if (!id) return false;
      const holdMs = clamp(durationMs, 500, 30000, num(this.settings().hybridFinalQaLayerBlockMs, 4500));
      const until = nowMs() + holdMs;
      this.layerBlockUntil[id] = Math.max(num(this.layerBlockUntil[id], 0), until);
      this.layerBlockReason[id] = String(reason || 'final QA safety block').slice(0, 140);
      this.layerBlockCount[id] = num(this.layerBlockCount[id], 0) + 1;
      this.layerStreaks[id] = 0;
      this.lastAction = `blocked ${id}`;
      this.lastReason = this.layerBlockReason[id];
      return true;
    }

    clearLayerBlocks(reason = 'manual') {
      for (const layer of LAYERS) {
        this.layerBlockUntil[layer.id] = 0;
        this.layerBlockReason[layer.id] = '';
        this.layerStreaks[layer.id] = 0;
      }
      this.lastAction = 'cleared layer blocks';
      this.lastReason = reason;
      this.syncPerfStats();
      return true;
    }

    patchBackend(backend) {
      if (!backend || backend.__drHybridFinalQaPatched) return;
      backend.__drHybridFinalQaPatched = true;
      const finalQa = this;
      for (const layer of LAYERS) {
        const method = layer.activeMethod;
        const original = backend[method];
        if (typeof original !== 'function') continue;
        backend[method] = function(...args) {
          if (finalQa.isLayerBlocked(layer.id)) {
            const reason = finalQa.layerBlockReason[layer.id] || 'final QA holdoff';
            this.metrics = this.metrics || {};
            this.metrics[layer.errorMetric] = `final-qa-block:${reason}`;
            return false;
          }
          return original.apply(this, args);
        };
      }
    }

    isCaveContext() {
      const zone = String(this.game?.currentZone || '').toLowerCase();
      const caveKey = String(this.game?.getActiveCaveZoneKey?.() || this.game?.activeCaveId || '').toLowerCase();
      return zone.includes('cave') || zone.includes('dungeon') || caveKey.includes('cave') || caveKey.includes('silk');
    }

    layerStats(perf) {
      return {
        terrain: {
          fallback: num(perf.renderBackendWebglVisibleTerrainFallbacks, 0) + num(perf.renderBackendWebglTerrainPartialFallbacks, 0),
          canvasFallback: 0,
          cost: num(perf.renderBackendWebglVisibleTerrainDrawMs, 0) + num(perf.renderBackendWebglVisibleTerrainCompositeMs, 0),
          active: !!perf.renderBackendWebglVisibleTerrainLayerActive,
          promoted: !!perf.renderBackendWebglVisibleTerrainLayerPromotedThisFrame
        },
        sprites: {
          fallback: num(perf.renderBackendWebglVisibleSpriteFallbacks, 0) + num(perf.renderBackendWebglVisibleSpriteDepthOrderFallbacks, 0),
          canvasFallback: num(perf.renderBackendWebglVisibleSpriteCanvasFallbackDraws, 0),
          cost: num(perf.renderBackendWebglVisibleSpriteDrawMs, 0) + num(perf.renderBackendWebglVisibleSpriteCompositeMs, 0),
          active: !!perf.renderBackendWebglVisibleSpriteLayerActive,
          promoted: !!perf.renderBackendWebglVisibleSpriteLayerPromotedThisFrame
        },
        effects: {
          fallback: num(perf.renderBackendWebglVisibleEffectFallbacks, 0),
          canvasFallback: num(perf.renderBackendWebglVisibleEffectCanvasFallbackDraws, 0),
          cost: num(perf.renderBackendWebglVisibleEffectDrawMs, 0) + num(perf.renderBackendWebglVisibleEffectCompositeMs, 0),
          active: !!perf.renderBackendWebglVisibleEffectLayerActive,
          promoted: !!perf.renderBackendWebglVisibleEffectLayerPromotedThisFrame
        },
        damageText: {
          fallback: num(perf.renderBackendWebglVisibleDamageTextFallbacks, 0),
          canvasFallback: num(perf.renderBackendWebglVisibleDamageTextCanvasFallbackDraws, 0),
          cost: num(perf.renderBackendWebglVisibleDamageTextDrawMs, 0) + num(perf.renderBackendWebglVisibleDamageTextCompositeMs, 0),
          active: !!perf.renderBackendWebglVisibleDamageTextLayerActive,
          promoted: !!perf.renderBackendWebglVisibleDamageTextLayerPromotedThisFrame
        }
      };
    }

    classifyScore(score, critical) {
      if (critical) return 'critical';
      if (score >= 92) return 'release-ready';
      if (score >= 82) return 'stable';
      if (score >= 68) return 'watch';
      if (score >= 48) return 'unsafe';
      return 'critical';
    }

    sample(perf) {
      const cfg = this.settings();
      const at = nowMs();
      const cave = this.isCaveContext();
      const layers = this.layerStats(perf || {});
      const layerIds = Object.keys(layers);
      let score = 100;
      let evidence = [];
      let critical = false;
      let sceneRisk = 'ok';
      let cameraRisk = 'ok';
      let caveRisk = cave ? 'watch' : 'clear';
      let seamRisk = 'ok';
      let depthRisk = 'ok';

      const fallbackPressure = num(perf.hybridQaFallbackPressure, 0)
        + num(perf.renderBackendHybridVisibleFallbacks, 0)
        + num(perf.renderBackendHybridVisibleCanvasFallbackDraws, 0);
      const hybridCost = Math.max(num(perf.renderBackendHybridVisibleFrameMs, 0), num(perf.hybridDefaultCandidateCostMs, 0));
      const frameMs = num(perf.frameMs, 0);
      const renderMs = num(perf.renderMs, 0);
      const roundTripMax = num(perf.renderBackendHybridCameraRoundTripMaxTiles, 0);
      const spriteDriftMax = num(perf.renderBackendHybridSpriteOriginMaxPx, 0);
      const depthViolations = num(perf.renderBackendHybridDepthOrderViolations, 0);
      const yawDelta = Math.abs(num(perf.renderBackendHybridCameraYawDeltaDeg, 0));
      const zoomDelta = Math.abs(num(perf.renderBackendHybridCameraZoomDelta, 0));
      const seamBleed = num(perf.renderBackendWebglTerrainSeamBleedPx, 0);
      const healthScore = num(perf.hybridRolloutHealthScore, NaN);
      const qaHeld = String(perf.hybridQaHeldOffLayers || 'none');

      if (perf.renderBackendWebglContextLost) { score -= 65; critical = true; evidence.push('WebGL context lost'); }
      if (perf.renderBackendModeDenied) { score -= 45; evidence.push(`renderer denied: ${perf.renderBackendModeDeniedReason || 'unknown'}`); }
      if (perf.renderBackendHybridPromotionBlockedByAudit) { score -= 28; evidence.push(`audit block: ${perf.renderBackendHybridCameraDepthAuditLastReason || 'projection/depth'}`); }
      if (perf.renderBackendWatchdogTrips > 0 && perf.renderBackendSafeMode) { score -= 22; evidence.push('watchdog safe mode active'); }
      if (Number.isFinite(healthScore) && healthScore < 60) { score -= Math.min(25, (60 - healthScore) * 0.35); evidence.push(`rollout health low ${Math.round(healthScore)}/100`); }
      if (qaHeld && qaHeld !== 'none') { score -= 12; evidence.push(`QA holdoff: ${qaHeld}`); }

      const fallbackWarn = num(cfg.hybridFinalQaFallbackWarn, 22);
      const fallbackBlock = num(cfg.hybridFinalQaFallbackBlock, 44);
      if (fallbackPressure > fallbackBlock) { score -= 26; sceneRisk = 'fallback-critical'; evidence.push(`fallback pressure ${fallbackPressure}`); }
      else if (fallbackPressure > fallbackWarn) { score -= 12; sceneRisk = 'fallback-watch'; evidence.push(`fallback pressure ${fallbackPressure}`); }

      const costWarn = num(cfg.hybridFinalQaCostWarnMs, 10.5);
      const costBlock = num(cfg.hybridFinalQaCostBlockMs, 18.0);
      if (hybridCost > costBlock) { score -= 24; sceneRisk = 'cost-critical'; evidence.push(`hybrid cost ${fmt(hybridCost)}ms`); }
      else if (hybridCost > costWarn) { score -= 10; sceneRisk = sceneRisk === 'ok' ? 'cost-watch' : sceneRisk; evidence.push(`hybrid cost ${fmt(hybridCost)}ms`); }

      if (frameMs > 33 || renderMs > 24) { score -= 10; evidence.push(`frame/render pressure f${fmt(frameMs)} r${fmt(renderMs)}`); }

      const rtWarn = num(cfg.hybridFinalQaRoundTripWarnTiles, 0.055);
      const rtBlock = num(cfg.hybridFinalQaRoundTripBlockTiles, 0.13);
      if (roundTripMax > rtBlock) { score -= 24; cameraRisk = 'roundtrip-block'; evidence.push(`round-trip ${fmt(roundTripMax, 3)} tiles`); }
      else if (roundTripMax > rtWarn) { score -= 10; cameraRisk = 'roundtrip-watch'; evidence.push(`round-trip ${fmt(roundTripMax, 3)} tiles`); }

      const driftWarn = num(cfg.hybridFinalQaSpriteDriftWarnPx, 20);
      const driftBlock = num(cfg.hybridFinalQaSpriteDriftBlockPx, 48);
      if (spriteDriftMax > driftBlock) { score -= 22; cameraRisk = 'sprite-drift-block'; evidence.push(`sprite drift ${fmt(spriteDriftMax)}px`); }
      else if (spriteDriftMax > driftWarn) { score -= 9; evidence.push(`sprite drift ${fmt(spriteDriftMax)}px`); }

      const depthWarn = num(cfg.hybridFinalQaDepthViolationWarn, 1);
      const depthBlock = num(cfg.hybridFinalQaDepthViolationBlock, 5);
      if (depthViolations >= depthBlock) { score -= 24; depthRisk = 'depth-block'; evidence.push(`depth violations ${depthViolations}`); }
      else if (depthViolations >= depthWarn) { score -= 9; depthRisk = 'depth-watch'; evidence.push(`depth violations ${depthViolations}`); }

      if (yawDelta > num(cfg.hybridFinalQaYawStressDeg, 18) || zoomDelta > num(cfg.hybridFinalQaZoomStress, 0.16)) {
        score -= 5;
        cameraRisk = cameraRisk === 'ok' ? 'camera-stress' : cameraRisk;
        evidence.push(`camera stress yaw ${fmt(yawDelta, 1)} zoom ${fmt(zoomDelta, 2)}`);
      }

      if (cave) {
        const cavePenalty = (perf.renderBackendHybridPromotionBlockedByAudit || depthViolations > 0 || layers.terrain.fallback > 0 || fallbackPressure > fallbackWarn) ? 12 : 3;
        score -= cavePenalty;
        caveRisk = cavePenalty >= 12 ? 'cave-layer-watch' : 'cave-active';
        if (cavePenalty >= 12) evidence.push('cave/fringe fallback watch');
      }

      if (layers.terrain.fallback > 0 && seamBleed <= 0) {
        score -= 7;
        seamRisk = 'bleed-off';
        evidence.push('terrain fallback with seam bleed off');
      } else if (layers.terrain.fallback > 2) {
        score -= 6;
        seamRisk = 'terrain-fallback-watch';
        evidence.push(`terrain fallback ${layers.terrain.fallback}`);
      }

      let worstLayer = 'none';
      let worstValue = -1;
      const layerFallbackWarn = num(cfg.hybridFinalQaLayerFallbackWarn, 12);
      const layerCostWarn = num(cfg.hybridFinalQaLayerCostWarnMs, 8.0);
      for (const id of layerIds) {
        const layer = layers[id];
        const pressure = layer.fallback + layer.canvasFallback + layer.cost;
        if (pressure > worstValue) { worstValue = pressure; worstLayer = id; }
        const unstable = layer.active && (layer.fallback > layerFallbackWarn || layer.canvasFallback > layerFallbackWarn || layer.cost > layerCostWarn);
        this.layerStreaks[id] = unstable ? (num(this.layerStreaks[id], 0) + 1) : Math.max(0, num(this.layerStreaks[id], 0) - 1);
        if (unstable) {
          score -= 6;
          evidence.push(`${id} pressure f${layer.fallback}/c${layer.canvasFallback}/${fmt(layer.cost)}ms`);
        }
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      const status = this.classifyScore(score, critical);
      const sample = {
        t: Date.now(),
        frame: this.frame,
        score,
        status,
        sceneRisk,
        caveRisk,
        cameraRisk,
        seamRisk,
        depthRisk,
        fallbackPressure,
        hybridCost: Number(hybridCost.toFixed(3)),
        frameMs: Number(frameMs.toFixed(3)),
        renderMs: Number(renderMs.toFixed(3)),
        roundTripMax: Number(roundTripMax.toFixed(4)),
        spriteDriftMax: Number(spriteDriftMax.toFixed(2)),
        depthViolations,
        yawDelta: Number(yawDelta.toFixed(2)),
        zoomDelta: Number(zoomDelta.toFixed(3)),
        cave,
        worstLayer,
        evidence: evidence.slice(0, 8)
      };
      this.history.push(sample);
      const historyLimit = Math.max(24, Math.floor(num(cfg.hybridFinalQaHistoryLimit, 180)));
      if (this.history.length > historyLimit) this.history.splice(0, this.history.length - historyLimit);

      if (evidence.length) {
        for (const text of evidence.slice(0, 4)) this.evidence.push(`${new Date().toLocaleTimeString()}: ${text}`);
        if (this.evidence.length > 48) this.evidence.splice(0, this.evidence.length - 48);
      }

      const triggerFrames = Math.max(1, Math.floor(num(cfg.hybridFinalQaLayerBlockTriggerFrames, 3)));
      const blockMs = num(cfg.hybridFinalQaLayerBlockMs, 4500);
      for (const id of layerIds) {
        if (num(this.layerStreaks[id], 0) >= triggerFrames) {
          this.blockLayer(id, `final QA ${id} pressure`, blockMs);
        }
      }
      if (perf.renderBackendHybridPromotionBlockedByAudit || roundTripMax > rtBlock || spriteDriftMax > driftBlock) {
        this.blockLayer('terrain', 'final QA projection/depth audit', blockMs);
        this.blockLayer('sprites', 'final QA projection/depth audit', blockMs);
      }
      if (depthViolations >= depthBlock) this.blockLayer('sprites', 'final QA depth order violation', blockMs);
      if (cave && (layers.terrain.fallback > 0 || perf.renderBackendHybridPromotionBlockedByAudit)) this.blockLayer('terrain', 'final QA cave/fringe terrain safety', blockMs);
      if (critical) {
        for (const layer of LAYERS) this.blockLayer(layer.id, 'final QA critical WebGL state', blockMs * 2);
      }

      const recent = this.history.slice(-Math.max(1, Math.floor(num(cfg.hybridFinalQaReleaseWindowFrames, 120))));
      const avgScore = avg(recent, 'score');
      const minScore = recent.reduce((min, item) => Math.min(min, num(item.score, 0)), 100);
      const criticalCount = recent.filter(item => item.status === 'critical' || item.status === 'unsafe').length;
      const stableFrames = this.history.filter(item => item.score >= 82).length;
      const warningFrames = this.history.filter(item => item.score >= 68 && item.score < 82).length;
      const unsafeFrames = this.history.filter(item => item.score >= 48 && item.score < 68).length;
      const criticalFrames = this.history.filter(item => item.score < 48).length;
      const blocked = this.blockedLayers(at);
      const releaseReady = this.enabled && recent.length >= Math.min(60, Math.max(10, Math.floor(num(cfg.hybridFinalQaReleaseMinSamples, 45))))
        && avgScore >= num(cfg.hybridFinalQaReleaseAvgScore, 88)
        && minScore >= num(cfg.hybridFinalQaReleaseMinScore, 72)
        && criticalCount === 0
        && blocked.length === 0;
      let recommendation = 'Keep testing Hybrid Default with F3/F6 before release-candidate status.';
      if (releaseReady) recommendation = 'Hybrid passed final QA window. Ready for release-candidate cleanup pass.';
      else if (status === 'critical') recommendation = 'Stay on Canvas Stable or clear WebGL failures before promoting Hybrid.';
      else if (blocked.length) recommendation = `Canvas fallback is protecting ${blocked.join(', ')}. Retest after holdoff expires.`;
      else if (caveRisk.includes('watch')) recommendation = 'Retest caves/fringe layers; terrain promotion is the highest-risk layer here.';
      else if (cameraRisk !== 'ok') recommendation = 'Retest camera rotation and zoom; projection drift is still measurable.';
      else if (depthRisk !== 'ok') recommendation = 'Retest crowded combat; sprite depth ordering still needs observation.';

      this.metrics = {
        enabled: this.enabled,
        releaseCandidateArmed: this.releaseCandidateArmed,
        releaseCandidateReady: releaseReady,
        status,
        state: status,
        score,
        avgScore: Number(avgScore.toFixed(1)),
        minScore,
        sampleCount: this.history.length,
        stableFrames,
        warningFrames,
        unsafeFrames,
        criticalFrames,
        blockActive: blocked.length > 0,
        blockedLayers: blocked.join(',') || 'none',
        blockReason: blocked.map(id => `${id}:${this.layerBlockReason[id] || ''}`).join(' | '),
        worstLayer,
        fallbackPressure,
        hybridCostMs: Number(hybridCost.toFixed(3)),
        sceneRisk,
        caveRisk,
        cameraRisk,
        seamRisk,
        depthRisk,
        roundTripMaxTiles: Number(roundTripMax.toFixed(4)),
        spriteDriftMaxPx: Number(spriteDriftMax.toFixed(2)),
        depthViolations,
        caveActive: cave,
        releaseRecommendation: recommendation,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        evidence: this.evidence.slice(-8),
        lastEvidence: evidence.join('; ')
      };
      this.syncPerfStats();
      this.persist(false);
      return this.metrics;
    }

    endFrame() {
      this.patchBackend(this.game?.renderBackendSystem || this.game?.ensureRenderBackendSystem?.());
      if (!this.enabled) {
        this.metrics.enabled = false;
        this.syncPerfStats();
        return this.metrics;
      }
      const cfg = this.settings();
      const intervalMs = Math.max(80, num(cfg.hybridFinalQaSampleMs, 250));
      const at = nowMs();
      if (at - this.lastSampleMs < intervalMs) {
        this.syncPerfStats();
        return this.metrics;
      }
      this.lastSampleMs = at;
      return this.sample(this.game?.perfStats || {});
    }

    snapshot() {
      return Object.assign({}, this.metrics, {
        enabled: this.enabled,
        releaseCandidateArmed: this.releaseCandidateArmed,
        history: (this.history || []).slice(-12),
        evidence: (this.evidence || []).slice(-10),
        layerBlocks: LAYERS.reduce((acc, layer) => {
          acc[layer.id] = {
            remainingMs: this.layerRemainingMs(layer.id),
            reason: this.layerBlockReason[layer.id] || '',
            count: num(this.layerBlockCount[layer.id], 0),
            streak: num(this.layerStreaks[layer.id], 0)
          };
          return acc;
        }, {})
      });
    }

    summary() {
      const snap = this.snapshot();
      return [
        `Hybrid Final QA: ${snap.score}/100 ${snap.status}, avg ${snap.avgScore}, samples ${snap.sampleCount}`,
        `Release candidate: ${snap.releaseCandidateReady ? 'ready' : 'not ready'}${snap.releaseCandidateArmed ? ', armed' : ''}`,
        `Blocked layers: ${snap.blockedLayers || 'none'}${snap.blockReason ? ` (${snap.blockReason})` : ''}`,
        `Risks: scene ${snap.sceneRisk}, cave ${snap.caveRisk}, camera ${snap.cameraRisk}, seam ${snap.seamRisk}, depth ${snap.depthRisk}`,
        `Recommendation: ${snap.releaseRecommendation}`
      ].join('\n');
    }

    exportPayload() {
      return {
        version: window.DREAM_REALMS_VERSION || 'unknown',
        build: window.DREAM_REALMS_BUILD_NAME || 'Dream Realms',
        exportedAt: new Date().toISOString(),
        snapshot: this.snapshot(),
        history: this.history.slice(),
        evidence: this.evidence.slice()
      };
    }

    syncPerfStats() {
      const perf = this.game?.perfStats || (this.game.perfStats = {});
      const snap = this.metrics || this.defaultMetrics();
      perf.hybridFinalQaEnabled = !!this.enabled;
      perf.hybridFinalQaReleaseCandidateArmed = !!this.releaseCandidateArmed;
      perf.hybridFinalQaReleaseCandidateReady = !!snap.releaseCandidateReady;
      perf.hybridFinalQaScore = num(snap.score, 0);
      perf.hybridFinalQaAvgScore = num(snap.avgScore, 0);
      perf.hybridFinalQaMinScore = num(snap.minScore, 0);
      perf.hybridFinalQaStatus = snap.status || 'warming';
      perf.hybridFinalQaState = snap.state || snap.status || 'warming';
      perf.hybridFinalQaSamples = num(snap.sampleCount, 0);
      perf.hybridFinalQaStableFrames = num(snap.stableFrames, 0);
      perf.hybridFinalQaWarningFrames = num(snap.warningFrames, 0);
      perf.hybridFinalQaUnsafeFrames = num(snap.unsafeFrames, 0);
      perf.hybridFinalQaCriticalFrames = num(snap.criticalFrames, 0);
      perf.hybridFinalQaBlockActive = !!snap.blockActive;
      perf.hybridFinalQaBlockedLayers = snap.blockedLayers || 'none';
      perf.hybridFinalQaBlockReason = snap.blockReason || '';
      perf.hybridFinalQaWorstLayer = snap.worstLayer || 'none';
      perf.hybridFinalQaFallbackPressure = num(snap.fallbackPressure, 0);
      perf.hybridFinalQaHybridCostMs = num(snap.hybridCostMs, 0);
      perf.hybridFinalQaSceneRisk = snap.sceneRisk || 'pending';
      perf.hybridFinalQaCaveRisk = snap.caveRisk || 'unknown';
      perf.hybridFinalQaCameraRisk = snap.cameraRisk || 'unknown';
      perf.hybridFinalQaSeamRisk = snap.seamRisk || 'unknown';
      perf.hybridFinalQaDepthRisk = snap.depthRisk || 'unknown';
      perf.hybridFinalQaRoundTripMaxTiles = num(snap.roundTripMaxTiles, 0);
      perf.hybridFinalQaSpriteDriftMaxPx = num(snap.spriteDriftMaxPx, 0);
      perf.hybridFinalQaDepthViolations = num(snap.depthViolations, 0);
      perf.hybridFinalQaCaveActive = !!snap.caveActive;
      perf.hybridFinalQaRecommendation = snap.releaseRecommendation || 'Collecting samples.';
      perf.hybridFinalQaLastAction = snap.lastAction || this.lastAction || '';
      perf.hybridFinalQaLastReason = snap.lastReason || this.lastReason || '';
      perf.hybridFinalQaEvidence = snap.lastEvidence || '';
      for (const layer of LAYERS) {
        perf[`hybridFinalQaBlockMs_${layer.id}`] = this.layerRemainingMs(layer.id);
        perf[`hybridFinalQaBlockCount_${layer.id}`] = num(this.layerBlockCount[layer.id], 0);
      }
    }
  }

  function downloadJson(filename, payload) {
    try {
      const blob = new Blob([JSON.stringify(payload || {}, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 250);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drHybridFinalQaInstalled) return;
    Game.prototype.__drHybridFinalQaInstalled = true;

    Game.prototype.ensureHybridFinalQaSystem = function() {
      if (!this.hybridFinalQaSystem) this.hybridFinalQaSystem = new HybridFinalQaSystem(this);
      this.hybridFinalQaSystem.patchBackend?.(this.renderBackendSystem || this.ensureRenderBackendSystem?.());
      return this.hybridFinalQaSystem;
    };

    Game.prototype.getHybridFinalQaSnapshot = function() {
      return this.ensureHybridFinalQaSystem?.().snapshot?.() || null;
    };

    Game.prototype.toggleHybridFinalQaGate = function() {
      const sys = this.ensureHybridFinalQaSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Hybrid Final QA gate: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid final qa toggle');
      return enabled;
    };

    Game.prototype.toggleHybridFinalQaReleaseCandidate = function() {
      const sys = this.ensureHybridFinalQaSystem?.();
      const armed = sys?.setReleaseCandidateArmed?.(!sys.releaseCandidateArmed, 'settings toggle') || false;
      this.logSystem?.(`Hybrid release-candidate gate: ${armed ? 'Armed' : 'Disarmed'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid final qa release candidate');
      return armed;
    };

    Game.prototype.clearHybridFinalQaLayerBlocks = function() {
      const ok = this.ensureHybridFinalQaSystem?.().clearLayerBlocks?.('settings clear layer blocks') === true;
      this.logSystem?.('Hybrid Final QA layer blocks cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid final qa clear blocks');
      return ok;
    };

    Game.prototype.resetHybridFinalQa = function() {
      const ok = this.ensureHybridFinalQaSystem?.().reset?.('settings reset') === true;
      this.logSystem?.('Hybrid Final QA history cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid final qa reset');
      return ok;
    };

    Game.prototype.exportHybridFinalQaJson = function() {
      const sys = this.ensureHybridFinalQaSystem?.();
      const ok = downloadJson(`dream-realms-hybrid-final-qa-${Date.now()}.json`, sys?.exportPayload?.() || {});
      this.logSystem?.(ok ? 'Hybrid Final QA JSON exported.' : 'Hybrid Final QA export failed.');
      return ok;
    };

    Game.prototype.copyHybridFinalQaSummary = async function() {
      const text = this.ensureHybridFinalQaSystem?.().summary?.() || 'Hybrid Final QA unavailable.';
      try {
        await navigator.clipboard?.writeText?.(text);
        this.logSystem?.('Hybrid Final QA summary copied.');
      } catch (_err) {
        this.logSystem?.(text);
      }
      return text;
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drHybridFinalQaWrapped) {
      const wrappedRender = function(...args) {
        const qa = this.ensureHybridFinalQaSystem?.();
        qa?.beginFrame?.();
        try {
          return originalRender.apply(this, args);
        } finally {
          try { qa?.endFrame?.(); } catch (err) { this.recordRuntimeSystemFault?.({ id: 'hybrid-final-qa' }, 'render', err); }
        }
      };
      wrappedRender.__drHybridFinalQaWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const rolloutClass = DR.HybridDefaultRolloutSystem?.HybridDefaultRolloutSystem;
    if (rolloutClass?.prototype?.calculateRisk && !rolloutClass.prototype.calculateRisk.__drHybridFinalQaWrapped) {
      const originalCalculateRisk = rolloutClass.prototype.calculateRisk;
      rolloutClass.prototype.calculateRisk = function(perf, candidateSnap, qaSnap) {
        const base = originalCalculateRisk.call(this, perf, candidateSnap, qaSnap);
        const finalQa = this.game?.getHybridFinalQaSnapshot?.();
        if (!finalQa || finalQa.enabled === false) return base;
        if (finalQa.status === 'critical' || finalQa.score < 40) {
          return { risk: 'critical', unstable: true, reason: `final QA critical: ${finalQa.lastEvidence || finalQa.blockReason || finalQa.status}` };
        }
        if (finalQa.blockActive && finalQa.score < 72) {
          return { risk: 'high', unstable: true, reason: `final QA blocking ${finalQa.blockedLayers || 'layer'}` };
        }
        if (base?.unstable && finalQa.releaseCandidateReady && finalQa.score >= 92) {
          const hard = String(base.reason || '').toLowerCase();
          if (!hard.includes('context lost') && !hard.includes('renderer denied') && !hard.includes('webgl unavailable')) {
            return { risk: 'medium', unstable: false, reason: `final QA release-ready suppressed transient risk: ${base.reason || 'unknown'}` };
          }
        }
        return base;
      };
      rolloutClass.prototype.calculateRisk.__drHybridFinalQaWrapped = true;
    }

    const originalDebugOverlay = Game.prototype.updateDebugOverlay;
    if (typeof originalDebugOverlay === 'function' && !originalDebugOverlay.__drHybridFinalQaWrapped) {
      const wrappedDebugOverlay = function(force = false, ...args) {
        const result = originalDebugOverlay.call(this, force, ...args);
        try {
          const body = document.getElementById('debugOverlayBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          if (body.textContent.includes('HybridFinalQA:')) return result;
          const snap = this.getHybridFinalQaSnapshot?.() || {};
          const extra = [
            `HybridFinalQA: ${snap.enabled === false ? 'off' : `${snap.score || 0}/100 ${snap.status || 'warming'}`}, avg ${fmt(snap.avgScore || 0)}, samples ${snap.sampleCount || 0}, RC ${snap.releaseCandidateReady ? 'ready' : 'no'}`,
            `HybridFinalRisks: scene ${snap.sceneRisk || 'pending'}, cave ${snap.caveRisk || 'unknown'}, camera ${snap.cameraRisk || 'unknown'}, seam ${snap.seamRisk || 'unknown'}, depth ${snap.depthRisk || 'unknown'}`,
            `HybridFinalBlocks: ${snap.blockedLayers || 'none'}, worst ${snap.worstLayer || 'none'}, pressure ${snap.fallbackPressure || 0}, cost ${fmt(snap.hybridCostMs || 0)}ms`,
            `HybridFinalNext: ${snap.releaseRecommendation || 'Collecting QA samples.'}`
          ].join('\n');
          body.textContent = `${body.textContent}\n${extra}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebugOverlay.__drHybridFinalQaWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebugOverlay;
    }

    const perfClass = DR.PerformanceVerificationSystem;
    if (perfClass?.prototype?.settingsPanelHtml && !perfClass.prototype.settingsPanelHtml.__drHybridFinalQaWrapped) {
      const originalSettingsHtml = perfClass.prototype.settingsPanelHtml;
      perfClass.prototype.settingsPanelHtml = function(escapeHtml) {
        const esc = typeof escapeHtml === 'function' ? escapeHtml : value => String(value);
        const html = originalSettingsHtml.call(this, escapeHtml);
        const snap = this.game?.getHybridFinalQaSnapshot?.() || {};
        const evidence = Array.isArray(snap.evidence) && snap.evidence.length ? snap.evidence.slice(-4).map(item => `<div>• ${esc(item)}</div>`).join('') : '<div>• none yet</div>';
        const block = `
          <div class="settingsSectionTitle">Hybrid Final QA</div>
          <div class="small" style="margin-bottom:8px">Final gate for Hybrid default release-candidate status. It watches camera rotation, zoom, cave/fringe safety, terrain seams, sprite depth, fallback pressure, and layer health.</div>
          <div class="settingsRow"><span>Final QA Gate</span><button class="toggleBtn ${snap.enabled !== false ? 'active' : ''}" data-hybrid-final-qa-toggle="1">${snap.enabled !== false ? 'On' : 'Off'}</button></div>
          <div class="settingsRow"><span>Release Candidate Gate</span><button class="toggleBtn ${snap.releaseCandidateArmed ? 'active' : ''}" data-hybrid-final-qa-rc="1">${snap.releaseCandidateArmed ? 'Armed' : 'Disarmed'}</button></div>
          <div class="small" style="margin-bottom:8px">Score: ${Number(snap.score || 0)}/100 (${esc(snap.status || 'warming')}), avg ${fmt(snap.avgScore || 0)}, samples ${Number(snap.sampleCount || 0)}, RC ${snap.releaseCandidateReady ? 'ready' : 'not ready'}, blocked ${esc(snap.blockedLayers || 'none')}, worst ${esc(snap.worstLayer || 'none')}.</div>
          <div class="small" style="margin-bottom:8px">Risks: scene ${esc(snap.sceneRisk || 'pending')}, cave ${esc(snap.caveRisk || 'unknown')}, camera ${esc(snap.cameraRisk || 'unknown')}, seam ${esc(snap.seamRisk || 'unknown')}, depth ${esc(snap.depthRisk || 'unknown')}. ${esc(snap.releaseRecommendation || '')}</div>
          <div class="small" style="margin-bottom:8px">Recent evidence:${evidence}</div>
          <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
            <button class="toggleBtn" data-hybrid-final-qa-export="1">Export Final QA JSON</button>
            <button class="toggleBtn" data-hybrid-final-qa-copy="1">Copy Final QA Summary</button>
            <button class="toggleBtn" data-hybrid-final-qa-clear-blocks="1">Clear Layer Blocks</button>
            <button class="toggleBtn" data-hybrid-final-qa-reset="1">Clear Final QA History</button>
          </div>
        `;
        const marker = '<div class="settingsSectionTitle">Hybrid Rollout Health</div>';
        return html.includes(marker) ? html.replace(marker, `${block}${marker}`) : `${html}${block}`;
      };
      perfClass.prototype.settingsPanelHtml.__drHybridFinalQaWrapped = true;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drHybridFinalQaWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          list?.querySelector('[data-hybrid-final-qa-toggle]')?.addEventListener('click', () => this.toggleHybridFinalQaGate?.());
          list?.querySelector('[data-hybrid-final-qa-rc]')?.addEventListener('click', () => this.toggleHybridFinalQaReleaseCandidate?.());
          list?.querySelector('[data-hybrid-final-qa-export]')?.addEventListener('click', () => this.exportHybridFinalQaJson?.());
          list?.querySelector('[data-hybrid-final-qa-copy]')?.addEventListener('click', () => this.copyHybridFinalQaSummary?.());
          list?.querySelector('[data-hybrid-final-qa-clear-blocks]')?.addEventListener('click', () => this.clearHybridFinalQaLayerBlocks?.());
          list?.querySelector('[data-hybrid-final-qa-reset]')?.addEventListener('click', () => this.resetHybridFinalQa?.());
        } catch (_err) {}
        return result;
      };
      wrappedRenderSettingsPanel.__drHybridFinalQaWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }
  }

  DR.HybridFinalQaSystem = { install, HybridFinalQaSystem };
  DR.systems.HybridFinalQaSystem = HybridFinalQaSystem;
})();
