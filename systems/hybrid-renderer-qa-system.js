// Dream Realms V0.15.31: Hybrid renderer QA guardrails and granular layer holdoff.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const LAYERS = Object.freeze([
    Object.freeze({
      id: 'terrain', label: 'terrain',
      activeKey: 'renderBackendWebglVisibleTerrainLayerActive',
      promotedKey: 'renderBackendWebglVisibleTerrainLayerPromotedThisFrame',
      fallbackKey: 'renderBackendWebglVisibleTerrainFallbacks',
      canvasFallbackKey: null,
      drawKey: 'renderBackendWebglVisibleTerrainDrawMs',
      compositeKey: 'renderBackendWebglVisibleTerrainCompositeMs',
      errorKey: 'renderBackendWebglVisibleTerrainLastError',
      backendActiveMethod: 'webglVisibleTerrainLayerActive',
      backendErrorMetric: 'webglVisibleTerrainLastError'
    }),
    Object.freeze({
      id: 'sprites', label: 'sprites',
      activeKey: 'renderBackendWebglVisibleSpriteLayerActive',
      promotedKey: 'renderBackendWebglVisibleSpriteLayerPromotedThisFrame',
      fallbackKey: 'renderBackendWebglVisibleSpriteFallbacks',
      canvasFallbackKey: 'renderBackendWebglVisibleSpriteCanvasFallbackDraws',
      drawKey: 'renderBackendWebglVisibleSpriteDrawMs',
      compositeKey: 'renderBackendWebglVisibleSpriteCompositeMs',
      errorKey: 'renderBackendWebglVisibleSpriteLastError',
      backendActiveMethod: 'webglVisibleSpriteLayerActive',
      backendErrorMetric: 'webglVisibleSpriteLastError'
    }),
    Object.freeze({
      id: 'effects', label: 'effects',
      activeKey: 'renderBackendWebglVisibleEffectLayerActive',
      promotedKey: 'renderBackendWebglVisibleEffectLayerPromotedThisFrame',
      fallbackKey: 'renderBackendWebglVisibleEffectFallbacks',
      canvasFallbackKey: 'renderBackendWebglVisibleEffectCanvasFallbackDraws',
      drawKey: 'renderBackendWebglVisibleEffectDrawMs',
      compositeKey: 'renderBackendWebglVisibleEffectCompositeMs',
      errorKey: 'renderBackendWebglVisibleEffectLastError',
      backendActiveMethod: 'webglVisibleEffectLayerActive',
      backendErrorMetric: 'webglVisibleEffectLastError'
    }),
    Object.freeze({
      id: 'damageText', label: 'damage text',
      activeKey: 'renderBackendWebglVisibleDamageTextLayerActive',
      promotedKey: 'renderBackendWebglVisibleDamageTextLayerPromotedThisFrame',
      fallbackKey: 'renderBackendWebglVisibleDamageTextFallbacks',
      canvasFallbackKey: 'renderBackendWebglVisibleDamageTextCanvasFallbackDraws',
      drawKey: 'renderBackendWebglVisibleDamageTextDrawMs',
      compositeKey: 'renderBackendWebglVisibleDamageTextCompositeMs',
      errorKey: 'renderBackendWebglVisibleDamageTextLastError',
      backendActiveMethod: 'webglVisibleDamageTextLayerActive',
      backendErrorMetric: 'webglVisibleDamageTextLastError'
    })
  ]);

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function metricNumber(perf, key) {
    return Math.max(0, Number(perf?.[key] || 0) || 0);
  }

  function nonEmptyError(value) {
    const text = String(value || '').trim();
    if (!text || text === 'ok' || text === '--') return '';
    if (text.startsWith('qa-holdoff:')) return '';
    return text;
  }

  class HybridRendererQaGuardSystem {
    constructor(game) {
      this.game = game;
      this.frame = 0;
      this.layerFallbackStreak = Object.create(null);
      this.layerHoldoffUntil = Object.create(null);
      this.layerHoldoffReason = Object.create(null);
      this.layerHoldoffCount = Object.create(null);
      this.lastAction = 'initialized';
      this.lastReason = 'waiting for first render frame';
      this.lastState = 'pending';
      this.lastWorstLayer = 'none';
      this.lastMixedFallbackLayer = 'none';
      this.lastLayerSummary = 'pending';
      this.lastFrameCostMs = 0;
      this.lastFallbackPressure = 0;
      this.doubleDrawRiskFrames = 0;
      this.missedDrawRiskFrames = 0;
      this.activeHoldoffFrames = 0;
      this.patchBackend(this.game?.renderBackendSystem);
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    enabled() {
      return this.settings().enableHybridRendererQaGuard !== false;
    }

    beginFrame() {
      this.frame += 1;
      this.patchBackend(this.game?.renderBackendSystem || this.game?.ensureRenderBackendSystem?.());
    }

    layerRemainingMs(layer, at = nowMs()) {
      return Math.max(0, Number(this.layerHoldoffUntil?.[layer] || 0) - at);
    }

    isLayerHeldOff(layer) {
      if (!this.enabled()) return false;
      return this.layerRemainingMs(layer) > 0;
    }

    heldOffLayers(at = nowMs()) {
      return LAYERS.map(l => l.id).filter(id => this.layerRemainingMs(id, at) > 0);
    }

    clearHoldoffs(reason = 'manual') {
      for (const layer of LAYERS) {
        this.layerHoldoffUntil[layer.id] = 0;
        this.layerHoldoffReason[layer.id] = '';
        this.layerFallbackStreak[layer.id] = 0;
      }
      this.lastAction = 'cleared holdoffs';
      this.lastReason = reason;
      this.syncPerfStats();
      return true;
    }

    holdLayer(layer, reason, durationMs) {
      const cfg = this.settings();
      if (cfg.hybridQaAutoHoldoffLayers === false) return false;
      const id = String(layer || '').trim();
      if (!id) return false;
      const holdMs = clampNumber(durationMs, Number(cfg.hybridQaLayerHoldoffMs || 3500), 500, 30000);
      const until = nowMs() + holdMs;
      this.layerHoldoffUntil[id] = Math.max(Number(this.layerHoldoffUntil[id] || 0), until);
      this.layerHoldoffReason[id] = String(reason || 'fallback pressure').slice(0, 120);
      this.layerHoldoffCount[id] = (Number(this.layerHoldoffCount[id] || 0) || 0) + 1;
      this.layerFallbackStreak[id] = 0;
      this.lastAction = `held ${id}`;
      this.lastReason = this.layerHoldoffReason[id];
      return true;
    }

    patchBackend(backend) {
      if (!backend || backend.__drHybridRendererQaGuardPatched) return;
      backend.__drHybridRendererQaGuardPatched = true;
      const qa = this;
      for (const layer of LAYERS) {
        const method = layer.backendActiveMethod;
        const original = backend[method];
        if (typeof original !== 'function') continue;
        backend[method] = function(...args) {
          if (qa.isLayerHeldOff(layer.id)) {
            const reason = qa.layerHoldoffReason[layer.id] || 'qa holdoff';
            this.metrics = this.metrics || {};
            this.metrics[layer.backendErrorMetric] = `qa-holdoff:${reason}`;
            return false;
          }
          return original.apply(this, args);
        };
      }
    }

    layerSnapshot(perf, layer, at) {
      const fallback = metricNumber(perf, layer.fallbackKey);
      const canvasFallback = layer.canvasFallbackKey ? metricNumber(perf, layer.canvasFallbackKey) : fallback;
      const drawMs = metricNumber(perf, layer.drawKey);
      const compositeMs = metricNumber(perf, layer.compositeKey);
      const costMs = drawMs + compositeMs;
      const active = !!perf?.[layer.activeKey];
      const promoted = !!perf?.[layer.promotedKey];
      const heldMs = this.layerRemainingMs(layer.id, at);
      const error = nonEmptyError(perf?.[layer.errorKey]);
      return { id: layer.id, label: layer.label, active, promoted, fallback, canvasFallback, costMs, heldMs, error };
    }

    endFrame() {
      const perf = this.game?.perfStats || {};
      const cfg = this.settings();
      const at = nowMs();
      const enabled = this.enabled();
      const layerMaxFallbacks = clampNumber(cfg.hybridQaMaxLayerFallbacksPerFrame, 10, 1, 128);
      const layerMaxCanvasFallbacks = clampNumber(cfg.hybridQaMaxLayerCanvasFallbackDrawsPerFrame, 18, 1, 256);
      const layerMaxCostMs = clampNumber(cfg.hybridQaMaxLayerCostMs, 7.5, 1, 40);
      const triggerFrames = Math.max(1, Math.floor(Number(cfg.hybridQaLayerHoldoffTriggerFrames || 4) || 4));
      const holdoffMs = clampNumber(cfg.hybridQaLayerHoldoffMs, 3500, 500, 30000);
      const maxSwitches = Math.max(1, Math.floor(Number(cfg.hybridQaMaxLayerSwitchesPerFrame || 36) || 36));
      const snapshots = LAYERS.map(layer => this.layerSnapshot(perf, layer, at));
      let fallbackPressure = 0;
      let worst = null;
      let warnings = [];
      let held = [];
      let mixedFallbackLayer = 'none';
      let totalCost = 0;
      for (const s of snapshots) {
        totalCost += s.costMs;
        fallbackPressure += s.fallback + s.canvasFallback;
        if (!worst || (s.fallback + s.canvasFallback + s.costMs) > (worst.fallback + worst.canvasFallback + worst.costMs)) worst = s;
        const tooManyFallbacks = s.active && (s.fallback > layerMaxFallbacks || s.canvasFallback > layerMaxCanvasFallbacks);
        const tooSlow = s.active && s.costMs > layerMaxCostMs;
        const hasError = s.active && !!s.error;
        const mixedFallback = s.promoted && s.canvasFallback > 0;
        if (mixedFallback && mixedFallbackLayer === 'none') mixedFallbackLayer = s.id;
        if (s.heldMs > 0) held.push(s.id);
        const unstable = enabled && (tooManyFallbacks || tooSlow || hasError);
        if (unstable) {
          this.layerFallbackStreak[s.id] = (Number(this.layerFallbackStreak[s.id] || 0) || 0) + 1;
          const reason = tooManyFallbacks
            ? `${s.id} fallback pressure f${s.fallback}/c${s.canvasFallback}`
            : tooSlow
              ? `${s.id} cost ${s.costMs.toFixed(1)}ms`
              : `${s.id} error ${s.error}`;
          warnings.push(reason);
          if (this.layerFallbackStreak[s.id] >= triggerFrames) this.holdLayer(s.id, reason, holdoffMs);
        } else {
          this.layerFallbackStreak[s.id] = Math.max(0, (Number(this.layerFallbackStreak[s.id] || 0) || 0) - 1);
        }
      }

      const switches = metricNumber(perf, 'renderBackendHybridVisibleLayerSwitches');
      if (switches > maxSwitches) warnings.push(`high layer switches ${switches}`);

      const auditBlocked = !!perf.renderBackendHybridPromotionBlockedByAudit;
      if (auditBlocked) warnings.push(`audit blocked: ${perf.renderBackendHybridCameraDepthAuditLastReason || 'projection/depth'}`);

      const queued = metricNumber(perf, 'worldRenderables');
      const promotedMask = String(perf.renderBackendHybridVisiblePromotedLayerMask || '');
      const activeHybrid = String(perf.renderBackendRendererMode || '') === 'hybrid-webgl-prototype';
      const promotedAny = promotedMask.length > 0;
      const canvasFallbackDraws = metricNumber(perf, 'renderBackendHybridVisibleCanvasFallbackDraws');
      if (activeHybrid && queued > 0 && !promotedAny && canvasFallbackDraws === 0 && !auditBlocked) {
        this.missedDrawRiskFrames += 1;
        if (this.missedDrawRiskFrames >= 3) warnings.push('hybrid had renderables but no promoted layer/fallback draw accounting');
      } else {
        this.missedDrawRiskFrames = Math.max(0, this.missedDrawRiskFrames - 1);
      }

      if (mixedFallbackLayer !== 'none') this.doubleDrawRiskFrames += 1;
      else this.doubleDrawRiskFrames = Math.max(0, this.doubleDrawRiskFrames - 1);

      held = this.heldOffLayers(at);
      if (held.length) this.activeHoldoffFrames += 1;
      this.lastFallbackPressure = fallbackPressure;
      this.lastFrameCostMs = totalCost;
      this.lastWorstLayer = worst?.id || 'none';
      this.lastMixedFallbackLayer = mixedFallbackLayer;
      this.lastLayerSummary = snapshots.map(s => `${s.id}:${s.promoted ? 'promoted' : s.active ? 'active' : s.heldMs > 0 ? 'held' : 'off'}/f${s.fallback}/c${s.canvasFallback}`).join(' ');
      this.lastState = held.length ? 'holdoff' : warnings.length ? 'warn' : activeHybrid ? 'ok' : 'canvas';
      if (!warnings.length && !held.length && this.lastAction === 'initialized') this.lastReason = 'ok';
      else if (warnings.length) this.lastReason = warnings.slice(0, 3).join('; ');
      this.syncPerfStats(snapshots);
    }

    snapshot() {
      const at = nowMs();
      const holdoffs = Object.fromEntries(LAYERS.map(l => [l.id, Math.ceil(this.layerRemainingMs(l.id, at))]));
      return {
        enabled: this.enabled(),
        state: this.lastState,
        heldOffLayers: this.heldOffLayers(at).join(',') || 'none',
        holdoffs,
        worstLayer: this.lastWorstLayer,
        mixedFallbackLayer: this.lastMixedFallbackLayer,
        fallbackPressure: this.lastFallbackPressure,
        frameCostMs: this.lastFrameCostMs,
        activeHoldoffFrames: this.activeHoldoffFrames,
        doubleDrawRiskFrames: this.doubleDrawRiskFrames,
        missedDrawRiskFrames: this.missedDrawRiskFrames,
        holdoffCounts: { ...this.layerHoldoffCount },
        fallbackStreaks: { ...this.layerFallbackStreak },
        layerSummary: this.lastLayerSummary,
        lastAction: this.lastAction,
        lastReason: this.lastReason
      };
    }

    syncPerfStats(layerSnapshots = null) {
      const perf = this.game?.perfStats;
      if (!perf) return;
      const snap = this.snapshot();
      perf.hybridQaEnabled = !!snap.enabled;
      perf.hybridQaState = snap.state;
      perf.hybridQaHeldOffLayers = snap.heldOffLayers;
      perf.hybridQaWorstLayer = snap.worstLayer;
      perf.hybridQaMixedFallbackLayer = snap.mixedFallbackLayer;
      perf.hybridQaFallbackPressure = snap.fallbackPressure;
      perf.hybridQaFrameCostMs = snap.frameCostMs;
      perf.hybridQaActiveHoldoffFrames = snap.activeHoldoffFrames;
      perf.hybridQaDoubleDrawRiskFrames = snap.doubleDrawRiskFrames;
      perf.hybridQaMissedDrawRiskFrames = snap.missedDrawRiskFrames;
      perf.hybridQaLayerSummary = snap.layerSummary;
      perf.hybridQaLastAction = snap.lastAction;
      perf.hybridQaLastReason = snap.lastReason;
      for (const layer of LAYERS) {
        const id = layer.id;
        perf[`hybridQaHoldoffMs_${id}`] = Number(snap.holdoffs[id] || 0) || 0;
        perf[`hybridQaHoldoffCount_${id}`] = Number(snap.holdoffCounts[id] || 0) || 0;
        perf[`hybridQaFallbackStreak_${id}`] = Number(snap.fallbackStreaks[id] || 0) || 0;
      }
      if (layerSnapshots) {
        for (const s of layerSnapshots) {
          perf[`hybridQaLayer_${s.id}`] = `${s.promoted ? 'promoted' : s.active ? 'active' : s.heldMs > 0 ? 'held' : 'off'} f${s.fallback} c${s.canvasFallback} ${s.costMs.toFixed(1)}ms`;
        }
      }
    }
  }

  DR.HybridRendererQaGuardSystem = HybridRendererQaGuardSystem;
  DR.systems.HybridRendererQaGuardSystem = HybridRendererQaGuardSystem;

  DR.HybridRendererQaSystem = {
    install(Game) {
      if (!Game || !Game.prototype) return;

      Game.prototype.ensureHybridRendererQaSystem = function() {
        if (!this.hybridRendererQa) this.hybridRendererQa = new HybridRendererQaGuardSystem(this);
        this.hybridRendererQa.patchBackend?.(this.renderBackendSystem || this.ensureRenderBackendSystem?.());
        return this.hybridRendererQa;
      };

      Game.prototype.clearHybridRendererQaHoldoffs = function(reason = 'manual') {
        const ok = this.ensureHybridRendererQaSystem?.()?.clearHoldoffs?.(reason) === true;
        this.logSystem?.('Hybrid renderer QA holdoffs cleared.');
        this.renderSettingsPanel?.();
        this.markUiDirty?.('hybrid renderer qa reset');
        return ok;
      };

      Game.prototype.hybridRendererQaSnapshot = function() {
        return this.ensureHybridRendererQaSystem?.()?.snapshot?.() || null;
      };

      const originalRender = Game.prototype.render;
      if (typeof originalRender === 'function' && !originalRender.__drHybridRendererQaWrapped) {
        const wrapped = function(...args) {
          const qa = this.ensureHybridRendererQaSystem?.();
          qa?.beginFrame?.();
          try {
            return originalRender.apply(this, args);
          } finally {
            try { qa?.endFrame?.(); } catch (err) { this.recordRuntimeSystemFault?.({ id: 'hybrid-renderer-qa' }, 'render', err); }
          }
        };
        wrapped.__drHybridRendererQaWrapped = true;
        Game.prototype.render = wrapped;
      }
    }
  };
})();
