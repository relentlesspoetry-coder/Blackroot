// Dream Realms V0.15.33: Hybrid rollout health telemetry, evidence, and false-rollback dampening.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsHybridRolloutHealth';

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

  function toBool(value, fallback = false) {
    if (value === true || value === '1' || value === 'true' || value === 1) return true;
    if (value === false || value === '0' || value === 'false' || value === 0) return false;
    return !!fallback;
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

  function average(values, key) {
    if (!Array.isArray(values) || !values.length) return 0;
    let total = 0;
    let count = 0;
    for (const item of values) {
      const value = key ? Number(item?.[key]) : Number(item);
      if (Number.isFinite(value)) {
        total += value;
        count += 1;
      }
    }
    return count ? total / count : 0;
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

  class HybridRolloutHealthSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = toBool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableHybridRolloutHealthTelemetry === false ? '0' : '1'), cfg.enableHybridRolloutHealthTelemetry !== false);
      this.history = Array.isArray(storageJson(`${STORAGE_PREFIX}:history`, [])) ? storageJson(`${STORAGE_PREFIX}:history`, []) : [];
      this.evidence = Array.isArray(storageJson(`${STORAGE_PREFIX}:evidence`, [])) ? storageJson(`${STORAGE_PREFIX}:evidence`, []) : [];
      this.lastSampleMs = 0;
      this.lastPersistMs = 0;
      this.lastCounters = null;
      this.stableSamples = 0;
      this.degradedSamples = 0;
      this.highRiskSamples = 0;
      this.criticalSamples = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'waiting for samples';
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        score: 0,
        status: 'warming',
        state: 'warming',
        recommendation: 'Collecting Hybrid renderer health samples.',
        sampleCount: 0,
        stableSamples: 0,
        degradedSamples: 0,
        highRiskSamples: 0,
        criticalSamples: 0,
        avgScore: 0,
        avgHybridCostMs: 0,
        avgFallbacks: 0,
        avgCanvasFallbackDraws: 0,
        lastScore: 0,
        lastHybridCostMs: 0,
        lastFallbackDelta: 0,
        lastCanvasFallbackDelta: 0,
        lastLayerMask: 'none',
        lastRisk: 'pending',
        rollbackRecommended: false,
        suppressTransientRollback: false,
        evidenceCount: 0,
        lastEvidence: '',
        lastAction: this.lastAction,
        lastReason: this.lastReason
      };
    }

    persist(force = false) {
      const now = nowMs();
      if (!force && now - Number(this.lastPersistMs || 0) < 4000) return;
      this.lastPersistMs = now;
      const cfg = this.settings();
      const limit = Math.max(24, Number(cfg.hybridRolloutHealthExportHistoryLimit || 120) || 120);
      try {
        safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
        safeSet(`${STORAGE_PREFIX}:history`, JSON.stringify((this.history || []).slice(-limit)));
        safeSet(`${STORAGE_PREFIX}:evidence`, JSON.stringify((this.evidence || []).slice(-32)));
      } catch (_err) {}
    }

    reset(reason = 'manual reset') {
      this.history = [];
      this.evidence = [];
      this.lastCounters = null;
      this.stableSamples = 0;
      this.degradedSamples = 0;
      this.highRiskSamples = 0;
      this.criticalSamples = 0;
      this.lastAction = 'reset';
      this.lastReason = reason;
      safeRemove(`${STORAGE_PREFIX}:history`);
      safeRemove(`${STORAGE_PREFIX}:evidence`);
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
      this.persist(true);
      return true;
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

    counters(perf) {
      return {
        hybridFallbacks: Number(perf.renderBackendHybridVisibleFallbacks || 0) || 0,
        canvasFallbackDraws: Number(perf.renderBackendHybridVisibleCanvasFallbackDraws || 0) || 0,
        terrainFallbacks: Number(perf.renderBackendWebglVisibleTerrainFallbacks || 0) + Number(perf.renderBackendWebglTerrainPartialFallbacks || 0),
        spriteFallbacks: Number(perf.renderBackendWebglVisibleSpriteFallbacks || 0) + Number(perf.renderBackendWebglVisibleSpriteDepthOrderFallbacks || 0),
        effectFallbacks: Number(perf.renderBackendWebglVisibleEffectFallbacks || 0),
        damageFallbacks: Number(perf.renderBackendWebglVisibleDamageTextFallbacks || 0),
        watchdogTrips: Number(perf.renderBackendWatchdogTrips || 0),
        autoFallbacks: Number(perf.renderBackendAutoFallbacks || 0),
        qaDoubleRisk: Number(perf.hybridQaDoubleDrawRiskFrames || 0),
        qaMissedRisk: Number(perf.hybridQaMissedDrawRiskFrames || 0)
      };
    }

    counterDelta(current, previous, key) {
      const now = Number(current?.[key] || 0) || 0;
      const old = Number(previous?.[key] || 0) || 0;
      return Math.max(0, now - old);
    }

    layerMask(perf) {
      const parts = [];
      if (perf.renderBackendWebglVisibleTerrainLayerActive) parts.push('terrain');
      if (perf.renderBackendWebglVisibleSpriteLayerActive) parts.push('sprites');
      if (perf.renderBackendWebglVisibleEffectLayerActive) parts.push('effects');
      if (perf.renderBackendWebglVisibleDamageTextLayerActive) parts.push('damage');
      return parts.join(',') || 'none';
    }

    hybridCost(perf) {
      const consolidated = Number(perf.renderBackendHybridVisibleFrameMs || 0) || 0;
      const explicitLayers =
        (Number(perf.renderBackendWebglVisibleTerrainDrawMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleTerrainCompositeMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleSpriteDrawMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleSpriteCompositeMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleEffectDrawMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleEffectCompositeMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleDamageTextDrawMs || 0) || 0) +
        (Number(perf.renderBackendWebglVisibleDamageTextCompositeMs || 0) || 0);
      return Math.max(consolidated, explicitLayers);
    }

    sample(perf) {
      const cfg = this.settings();
      const current = this.counters(perf);
      const previous = this.lastCounters || current;
      const fallbackDelta = this.counterDelta(current, previous, 'hybridFallbacks')
        + this.counterDelta(current, previous, 'terrainFallbacks')
        + this.counterDelta(current, previous, 'spriteFallbacks')
        + this.counterDelta(current, previous, 'effectFallbacks')
        + this.counterDelta(current, previous, 'damageFallbacks');
      const canvasFallbackDelta = this.counterDelta(current, previous, 'canvasFallbackDraws');
      const watchdogDelta = this.counterDelta(current, previous, 'watchdogTrips') + this.counterDelta(current, previous, 'autoFallbacks');
      const missedRiskDelta = this.counterDelta(current, previous, 'qaMissedRisk');
      const doubleRiskDelta = this.counterDelta(current, previous, 'qaDoubleRisk');
      this.lastCounters = current;

      const costMs = this.hybridCost(perf);
      const fallbackWarn = Math.max(1, Number(cfg.hybridRolloutHealthFallbackWarn || 14) || 14);
      const canvasFallbackWarn = Math.max(1, Number(cfg.hybridRolloutHealthCanvasFallbackWarn || 22) || 22);
      const costWarn = Math.max(1, Number(cfg.hybridRolloutHealthCostWarnMs || 8.5) || 8.5);
      const criticalCost = Math.max(costWarn + 1, Number(cfg.hybridRolloutHealthCriticalCostMs || 16) || 16);

      let score = 100;
      const evidence = [];
      if (perf.renderBackendWebglContextLost) { score -= 100; evidence.push('WebGL context lost'); }
      if (perf.renderBackendModeDenied) { score -= 55; evidence.push(`renderer denied: ${perf.renderBackendModeDeniedReason || 'unknown'}`); }
      if (perf.renderBackendHybridPromotionBlockedByAudit) { score -= 25; evidence.push(`audit blocked: ${perf.renderBackendHybridCameraDepthAuditLastReason || 'projection/depth'}`); }
      if (perf.hybridQaHeldOffLayers && perf.hybridQaHeldOffLayers !== 'none') { score -= 12; evidence.push(`QA holdoff: ${perf.hybridQaHeldOffLayers}`); }
      if (fallbackDelta > fallbackWarn) { score -= Math.min(34, 10 + Math.round((fallbackDelta - fallbackWarn) * 1.4)); evidence.push(`fallback spike ${fallbackDelta}/${fallbackWarn}`); }
      if (canvasFallbackDelta > canvasFallbackWarn) { score -= Math.min(24, 6 + Math.round((canvasFallbackDelta - canvasFallbackWarn) * 0.8)); evidence.push(`canvas fallback draws ${canvasFallbackDelta}/${canvasFallbackWarn}`); }
      if (watchdogDelta > 0) { score -= 42; evidence.push(`watchdog/auto fallback ${watchdogDelta}`); }
      if (missedRiskDelta > 0) { score -= 28; evidence.push(`missed-draw risk ${missedRiskDelta}`); }
      if (doubleRiskDelta > 0) { score -= 16; evidence.push(`double-draw risk ${doubleRiskDelta}`); }
      if (costMs > criticalCost) { score -= 42; evidence.push(`critical hybrid cost ${fmt(costMs)}ms`); }
      else if (costMs > costWarn) { score -= Math.min(28, 8 + Math.round((costMs - costWarn) * 3)); evidence.push(`high hybrid cost ${fmt(costMs)}ms/${fmt(costWarn)}ms`); }
      if (!perf.renderBackendWebglPrototypeReady && perf.renderBackendRendererMode === 'hybrid-webgl-prototype') { score -= 35; evidence.push('Hybrid requested before WebGL ready'); }
      if (this.layerMask(perf) === 'none' && perf.renderBackendRendererMode === 'hybrid-webgl-prototype') { score -= 8; evidence.push('Hybrid active with no promoted layers'); }

      score = Math.round(clamp(score, 0, 100, 0));
      const stableScore = Number(cfg.hybridRolloutHealthStableScore || 86) || 86;
      const degradedScore = Number(cfg.hybridRolloutHealthDegradedScore || 68) || 68;
      const highRiskScore = Number(cfg.hybridRolloutHealthHighRiskScore || 46) || 46;
      const rollbackScore = Number(cfg.hybridRolloutHealthRollbackScore || 28) || 28;
      let status = 'critical';
      if (score >= stableScore) status = 'stable';
      else if (score >= degradedScore) status = 'healthy';
      else if (score >= highRiskScore) status = 'degraded';
      else if (score >= rollbackScore) status = 'high-risk';

      if (status === 'stable' || status === 'healthy') {
        this.stableSamples += 1;
        this.degradedSamples = 0;
        this.highRiskSamples = 0;
        this.criticalSamples = 0;
      } else if (status === 'degraded') {
        this.degradedSamples += 1;
        this.highRiskSamples = 0;
        this.criticalSamples = 0;
      } else if (status === 'high-risk') {
        this.highRiskSamples += 1;
        this.criticalSamples = 0;
      } else {
        this.criticalSamples += 1;
      }

      const sample = {
        t: Date.now ? Date.now() : new Date().getTime(),
        score,
        status,
        costMs: Number(costMs.toFixed(3)),
        fallbackDelta,
        canvasFallbackDelta,
        watchdogDelta,
        missedRiskDelta,
        doubleRiskDelta,
        layerMask: this.layerMask(perf),
        rendererMode: perf.renderBackendRendererMode || perf.renderBackendActive || 'canvas2d',
        evidence: evidence.slice(0, 4)
      };
      this.history.push(sample);
      const maxHistory = Math.max(24, Number(cfg.hybridRolloutHealthWindow || 90) || 90);
      if (this.history.length > maxHistory) this.history.splice(0, this.history.length - maxHistory);

      if (evidence.length) {
        this.evidence.push(`${new Date(sample.t).toLocaleTimeString?.() || sample.t}: ${evidence.join('; ')}`);
        if (this.evidence.length > 32) this.evidence.splice(0, this.evidence.length - 32);
      }

      const avgScore = average(this.history, 'score');
      const avgHybridCostMs = average(this.history, 'costMs');
      const avgFallbacks = average(this.history, 'fallbackDelta');
      const avgCanvasFallbackDraws = average(this.history, 'canvasFallbackDelta');
      const rollbackRecommended = this.criticalSamples >= 3 || this.highRiskSamples >= 6 || score < rollbackScore;
      const suppressTransientRollback = cfg.hybridRolloutHealthSuppressTransientRollback !== false
        && (status === 'stable' || status === 'healthy')
        && this.stableSamples >= 4
        && !perf.renderBackendWebglContextLost
        && !perf.renderBackendModeDenied;
      let recommendation = 'Hybrid rollout is stable. Keep Hybrid Default enabled.';
      if (status === 'healthy') recommendation = 'Hybrid is healthy. Watch fallback pressure during heavy combat.';
      if (status === 'degraded') recommendation = 'Hybrid is degraded. Keep Canvas fallback active and check the layer with the latest fallback spike.';
      if (status === 'high-risk') recommendation = 'Hybrid is high-risk. Let QA holdoffs disable the worst layer before full rollback.';
      if (status === 'critical') recommendation = 'Hybrid is critical. Canvas compatibility rollback is recommended.';
      if (perf.renderBackendWebglContextLost) recommendation = 'WebGL context was lost. Use Canvas Compatibility Mode for this session.';

      this.metrics = {
        enabled: this.enabled,
        score,
        status,
        state: status,
        recommendation,
        sampleCount: this.history.length,
        stableSamples: this.stableSamples,
        degradedSamples: this.degradedSamples,
        highRiskSamples: this.highRiskSamples,
        criticalSamples: this.criticalSamples,
        avgScore,
        avgHybridCostMs,
        avgFallbacks,
        avgCanvasFallbackDraws,
        lastScore: score,
        lastHybridCostMs: costMs,
        lastFallbackDelta: fallbackDelta,
        lastCanvasFallbackDelta: canvasFallbackDelta,
        lastLayerMask: sample.layerMask,
        lastRisk: evidence.join('; ') || 'ok',
        rollbackRecommended,
        suppressTransientRollback,
        evidenceCount: this.evidence.length,
        lastEvidence: this.evidence[this.evidence.length - 1] || 'none',
        lastAction: this.lastAction,
        lastReason: this.lastReason
      };
      this.syncPerfStats();
      this.persist(false);
    }

    update(_dt) {
      if (!this.enabled) {
        this.metrics.enabled = false;
        this.metrics.state = 'disabled';
        this.syncPerfStats();
        return;
      }
      const cfg = this.settings();
      if (cfg.enableHybridRolloutHealthTelemetry === false) {
        this.metrics.enabled = false;
        this.syncPerfStats();
        return;
      }
      const interval = Math.max(120, Number(cfg.hybridRolloutHealthSampleMs || 500) || 500);
      const now = nowMs();
      if (now - Number(this.lastSampleMs || 0) < interval) return;
      this.lastSampleMs = now;
      this.sample(this.game?.perfStats || {});
    }

    snapshot() {
      return {
        ...this.metrics,
        history: (this.history || []).slice(-24),
        evidence: (this.evidence || []).slice(-12)
      };
    }

    exportPayload() {
      return {
        build: window.DREAM_REALMS_BUILD_NAME || '',
        version: window.DREAM_REALMS_VERSION || '',
        createdAt: new Date().toISOString(),
        snapshot: this.snapshot(),
        perf: {
          rendererMode: this.game?.perfStats?.renderBackendRendererMode || '',
          hybridRolloutState: this.game?.perfStats?.hybridDefaultRolloutState || '',
          hybridCandidateState: this.game?.perfStats?.hybridDefaultCandidateState || '',
          hybridQaState: this.game?.perfStats?.hybridQaState || '',
          activeLayers: this.game?.perfStats?.hybridDefaultRolloutLayers || ''
        }
      };
    }

    summary() {
      const m = this.metrics || {};
      return `Hybrid health ${m.score || 0}/100 (${m.status || 'pending'}), layers ${m.lastLayerMask || 'none'}, avg cost ${fmt(m.avgHybridCostMs || 0)}ms, avg fallbacks ${fmt(m.avgFallbacks || 0)}, recommendation: ${m.recommendation || 'pending'}`;
    }

    syncPerfStats() {
      const perf = this.game?.perfStats;
      if (!perf) return;
      const m = this.metrics || this.defaultMetrics();
      perf.hybridRolloutHealthEnabled = !!m.enabled;
      perf.hybridRolloutHealthScore = Number(m.score || 0) || 0;
      perf.hybridRolloutHealthStatus = m.status || 'pending';
      perf.hybridRolloutHealthState = m.state || 'pending';
      perf.hybridRolloutHealthRecommendation = m.recommendation || '';
      perf.hybridRolloutHealthSamples = Number(m.sampleCount || 0) || 0;
      perf.hybridRolloutHealthStableSamples = Number(m.stableSamples || 0) || 0;
      perf.hybridRolloutHealthDegradedSamples = Number(m.degradedSamples || 0) || 0;
      perf.hybridRolloutHealthHighRiskSamples = Number(m.highRiskSamples || 0) || 0;
      perf.hybridRolloutHealthCriticalSamples = Number(m.criticalSamples || 0) || 0;
      perf.hybridRolloutHealthAvgScore = Number(m.avgScore || 0) || 0;
      perf.hybridRolloutHealthAvgCostMs = Number(m.avgHybridCostMs || 0) || 0;
      perf.hybridRolloutHealthAvgFallbacks = Number(m.avgFallbacks || 0) || 0;
      perf.hybridRolloutHealthAvgCanvasFallbackDraws = Number(m.avgCanvasFallbackDraws || 0) || 0;
      perf.hybridRolloutHealthLastCostMs = Number(m.lastHybridCostMs || 0) || 0;
      perf.hybridRolloutHealthLastFallbackDelta = Number(m.lastFallbackDelta || 0) || 0;
      perf.hybridRolloutHealthLastCanvasFallbackDelta = Number(m.lastCanvasFallbackDelta || 0) || 0;
      perf.hybridRolloutHealthLayerMask = m.lastLayerMask || 'none';
      perf.hybridRolloutHealthLastRisk = m.lastRisk || 'ok';
      perf.hybridRolloutHealthRollbackRecommended = !!m.rollbackRecommended;
      perf.hybridRolloutHealthSuppressTransientRollback = !!m.suppressTransientRollback;
      perf.hybridRolloutHealthEvidenceCount = Number(m.evidenceCount || 0) || 0;
      perf.hybridRolloutHealthLastEvidence = m.lastEvidence || '';
    }
  }

  function downloadJson(filename, data) {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
    if (!Game || !Game.prototype || Game.prototype.__drHybridRolloutHealthInstalled) return;
    Game.prototype.__drHybridRolloutHealthInstalled = true;

    Game.prototype.ensureHybridRolloutHealthSystem = function() {
      if (!this.hybridRolloutHealthSystem) this.hybridRolloutHealthSystem = new HybridRolloutHealthSystem(this);
      return this.hybridRolloutHealthSystem;
    };

    const originalUpdate = Game.prototype.update;
    if (typeof originalUpdate === 'function' && !originalUpdate.__drHybridRolloutHealthWrapped) {
      const wrappedUpdate = function(dt, ...rest) {
        const result = originalUpdate.call(this, dt, ...rest);
        try { this.ensureHybridRolloutHealthSystem?.().update?.(dt); } catch (err) { this.recordRuntimeSystemFault?.({ id: 'hybrid-rollout-health' }, 'update', err); }
        return result;
      };
      wrappedUpdate.__drHybridRolloutHealthWrapped = true;
      Game.prototype.update = wrappedUpdate;
    }

    Game.prototype.getHybridRolloutHealthSnapshot = function() {
      return this.ensureHybridRolloutHealthSystem?.().snapshot?.() || null;
    };

    Game.prototype.resetHybridRolloutHealth = function() {
      const ok = this.ensureHybridRolloutHealthSystem?.().reset?.('settings reset') === true;
      this.logSystem?.('Hybrid rollout health history cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid rollout health reset');
      return ok;
    };

    Game.prototype.toggleHybridRolloutHealthTelemetry = function() {
      const sys = this.ensureHybridRolloutHealthSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Hybrid rollout health telemetry: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid rollout health toggle');
      return enabled;
    };

    Game.prototype.exportHybridRolloutHealthJson = function() {
      const sys = this.ensureHybridRolloutHealthSystem?.();
      if (!sys) return false;
      const ok = downloadJson(`dream-realms-hybrid-health-${Date.now()}.json`, sys.exportPayload?.() || {});
      this.logSystem?.(ok ? 'Hybrid renderer health JSON exported.' : 'Hybrid renderer health export failed.');
      return ok;
    };

    Game.prototype.copyHybridRolloutHealthSummary = async function() {
      const text = this.ensureHybridRolloutHealthSystem?.().summary?.() || 'Hybrid renderer health unavailable.';
      try {
        await navigator.clipboard?.writeText?.(text);
        this.logSystem?.('Hybrid renderer health summary copied.');
      } catch (_err) {
        this.logSystem?.(text);
      }
      return text;
    };

    const rolloutClass = DR.HybridDefaultRolloutSystem?.HybridDefaultRolloutSystem;
    if (rolloutClass?.prototype?.calculateRisk && !rolloutClass.prototype.calculateRisk.__drHybridRolloutHealthWrapped) {
      const originalCalculateRisk = rolloutClass.prototype.calculateRisk;
      rolloutClass.prototype.calculateRisk = function(perf, candidateSnap, qaSnap) {
        const base = originalCalculateRisk.call(this, perf, candidateSnap, qaSnap);
        const health = this.game?.getHybridRolloutHealthSnapshot?.();
        if (!health || health.enabled === false) return base;
        if (health.status === 'critical' && health.rollbackRecommended) {
          return { risk: 'critical', unstable: true, reason: `health critical: ${health.lastRisk || 'renderer health'}` };
        }
        if (health.rollbackRecommended && (health.status === 'high-risk' || Number(health.score || 0) < 28)) {
          return { risk: 'high', unstable: true, reason: `health rollback recommended: ${health.lastRisk || 'renderer health'}` };
        }
        const unsafeReason = String(base?.reason || '').toLowerCase();
        const hardFailure = unsafeReason.includes('context lost') || unsafeReason.includes('renderer denied') || unsafeReason.includes('webgl unavailable');
        if (base?.unstable && base.risk === 'high' && health.suppressTransientRollback && !hardFailure) {
          return { risk: 'medium', unstable: false, reason: `health suppressed transient rollout risk: ${base.reason || 'unknown'}` };
        }
        return base;
      };
      rolloutClass.prototype.calculateRisk.__drHybridRolloutHealthWrapped = true;
    }

    const originalDebugOverlay = Game.prototype.updateDebugOverlay;
    if (typeof originalDebugOverlay === 'function' && !originalDebugOverlay.__drHybridRolloutHealthWrapped) {
      const wrappedDebugOverlay = function(force = false, ...args) {
        const result = originalDebugOverlay.call(this, force, ...args);
        try {
          const body = document.getElementById('debugOverlayBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.getHybridRolloutHealthSnapshot?.();
          if (!snap || body.textContent.includes('HybridHealth:')) return result;
          const extra = [
            `HybridHealth: ${snap.score || 0}/100 ${snap.status || 'pending'}, avg ${fmt(snap.avgScore || 0, 1)}, samples ${snap.sampleCount || 0}, rollback ${snap.rollbackRecommended ? 'yes' : 'no'}`,
            `HybridHealthCost: last ${fmt(snap.lastHybridCostMs || 0)} ms, avg ${fmt(snap.avgHybridCostMs || 0)} ms, fallback +${snap.lastFallbackDelta || 0}, canvas +${snap.lastCanvasFallbackDelta || 0}`,
            `HybridHealthLayers: ${snap.lastLayerMask || 'none'}, suppressTransient ${snap.suppressTransientRollback ? 'yes' : 'no'}, risk ${snap.lastRisk || 'ok'}`,
            `HybridHealthNext: ${snap.recommendation || 'Collecting samples.'}`
          ].join('\n');
          body.textContent = `${body.textContent}\n${extra}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebugOverlay.__drHybridRolloutHealthWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebugOverlay;
    }

    const perfClass = DR.PerformanceVerificationSystem;
    if (perfClass?.prototype?.settingsPanelHtml && !perfClass.prototype.settingsPanelHtml.__drHybridRolloutHealthWrapped) {
      const originalSettingsHtml = perfClass.prototype.settingsPanelHtml;
      perfClass.prototype.settingsPanelHtml = function(escapeHtml) {
        const esc = typeof escapeHtml === 'function' ? escapeHtml : value => String(value);
        const html = originalSettingsHtml.call(this, escapeHtml);
        const snap = this.game?.getHybridRolloutHealthSnapshot?.() || {};
        const evidence = Array.isArray(snap.evidence) && snap.evidence.length ? snap.evidence.slice(-3).map(item => `<div>• ${esc(item)}</div>`).join('') : '<div>• none yet</div>';
        const block = `
          <div class="settingsSectionTitle">Hybrid Rollout Health</div>
          <div class="small" style="margin-bottom:8px">Tracks Hybrid renderer score, fallback evidence, and transient-risk dampening so the default rollout does not overreact to one bad frame.</div>
          <div class="settingsRow"><span>Health Telemetry</span><button class="toggleBtn ${snap.enabled !== false ? 'active' : ''}" data-hybrid-health-toggle="1">${snap.enabled !== false ? 'On' : 'Off'}</button></div>
          <div class="small" style="margin-bottom:8px">Score: ${Number(snap.score || 0)}/100 (${esc(snap.status || 'warming')}), avg ${fmt(snap.avgScore || 0, 1)}, samples ${Number(snap.sampleCount || 0)}, layers ${esc(snap.lastLayerMask || 'none')}, cost avg ${fmt(snap.avgHybridCostMs || 0)}ms, fallback avg ${fmt(snap.avgFallbacks || 0)}, rollback ${snap.rollbackRecommended ? 'recommended' : 'not recommended'}. ${esc(snap.recommendation || '')}</div>
          <div class="small" style="margin-bottom:8px">Recent evidence:${evidence}</div>
          <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
            <button class="toggleBtn" data-hybrid-health-export="1">Export Health JSON</button>
            <button class="toggleBtn" data-hybrid-health-copy="1">Copy Health Summary</button>
            <button class="toggleBtn" data-hybrid-health-reset="1">Clear Health History</button>
          </div>
        `;
        const marker = '<div class="settingsSectionTitle">Hybrid Default Rollout</div>';
        return html.includes(marker) ? html.replace(marker, `${block}${marker}`) : `${html}${block}`;
      };
      perfClass.prototype.settingsPanelHtml.__drHybridRolloutHealthWrapped = true;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drHybridRolloutHealthWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          list?.querySelector('[data-hybrid-health-toggle]')?.addEventListener('click', () => this.toggleHybridRolloutHealthTelemetry?.());
          list?.querySelector('[data-hybrid-health-export]')?.addEventListener('click', () => this.exportHybridRolloutHealthJson?.());
          list?.querySelector('[data-hybrid-health-copy]')?.addEventListener('click', () => this.copyHybridRolloutHealthSummary?.());
          list?.querySelector('[data-hybrid-health-reset]')?.addEventListener('click', () => this.resetHybridRolloutHealth?.());
        } catch (_err) {}
        return result;
      };
      wrappedRenderSettingsPanel.__drHybridRolloutHealthWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }
  }

  DR.HybridRolloutHealthSystem = { install, HybridRolloutHealthSystem };
  DR.systems.HybridRolloutHealthSystem = HybridRolloutHealthSystem;
})();
