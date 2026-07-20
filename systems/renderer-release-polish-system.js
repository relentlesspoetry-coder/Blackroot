// Dream Realms V0.15.38: renderer QA fixes and release polish.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const STORAGE_PREFIX = 'dreamRealmsRendererReleasePolish';
  const PROFILE_KEY = 'dreamRealmsRendererPlayerProfile';
  const ROLLOUT_PREFIX = 'dreamRealmsHybridDefaultRollout';
  const VALID_PROFILES = new Set(['auto', 'hybrid', 'canvas']);
  const VALID_POLICIES = new Set(['auto', 'hybrid', 'canvas']);

  function nowMs() {
    try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; }
  }

  function iso() {
    try { return new Date().toISOString(); } catch (_err) { return ''; }
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

  function bool(value, fallback = false) {
    if (value === true || value === '1' || value === 'true' || value === 1) return true;
    if (value === false || value === '0' || value === 'false' || value === 0) return false;
    return !!fallback;
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

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage?.getItem?.(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { window.localStorage?.setItem?.(key, JSON.stringify(value)); } catch (_err) {}
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

  function min(list, key, fallback = 0) {
    if (!Array.isArray(list) || !list.length) return fallback;
    let result = Infinity;
    for (const item of list) {
      const value = key ? num(item?.[key], NaN) : num(item, NaN);
      if (Number.isFinite(value)) result = Math.min(result, value);
    }
    return result === Infinity ? fallback : result;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function downloadJson(filename, payload) {
    const json = JSON.stringify(payload || {}, null, 2);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 750);
      return true;
    } catch (_err) {
      try { navigator.clipboard?.writeText?.(json); return true; } catch (__err) { return false; }
    }
  }

  function benchmarkSnapshot(game) {
    const last = game?.performanceVerifier?.lastBenchmark || null;
    if (!last || last.active) {
      return { state: 'missing', ok: false, avgFps: 0, p95FrameMs: 0, warning: 'no completed benchmark' };
    }
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const hotspot = last.hotspot?.area || last.hotspotArea || 'unknown';
    return {
      state: avgFps > 0 ? 'complete' : 'partial',
      ok: avgFps >= 45 && (p95FrameMs <= 0 || p95FrameMs <= 30),
      avgFps,
      p95FrameMs,
      hotspot,
      warning: avgFps <= 0 ? 'benchmark missing avg FPS' : avgFps < 45 ? 'benchmark FPS below release target' : p95FrameMs > 30 ? 'benchmark p95 above release target' : 'benchmark accepted'
    };
  }

  class RendererReleasePolishSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableRendererReleasePolish === false ? '0' : '1'), cfg.enableRendererReleasePolish !== false);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'release polish loaded';
      this.storageRepairCount = 0;
      this.autoCanvasClampCount = 0;
      this.lastStorageRepair = 'none';
      this.metrics = this.defaultMetrics();
      this.repairStoredRendererState('constructor');
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        status: 'warming',
        score: 0,
        avgScore: 0,
        minScore: 0,
        sampleCount: 0,
        releasePolished: false,
        rendererProfile: 'auto',
        rolloutPolicy: 'auto',
        rendererMode: 'canvas2d',
        webglReady: false,
        canvasFallbackReady: true,
        hybridReady: false,
        benchmarkState: 'missing',
        benchmarkOk: false,
        benchmarkAvgFps: 0,
        benchmarkP95FrameMs: 0,
        fallbackPressure: 0,
        hybridCostMs: 0,
        healthScore: 0,
        finalQaScore: 0,
        postRcConfidence: 0,
        stableRcScore: 0,
        postRcShipReady: false,
        stableRcReady: false,
        rolloutActive: false,
        rollbackActive: false,
        qaHoldoff: false,
        blockedLayers: 'none',
        canvasLockActive: false,
        storageRepairCount: this.storageRepairCount,
        autoCanvasClampCount: this.autoCanvasClampCount,
        warnings: 'collecting samples',
        blockers: 'collecting samples',
        recommendation: 'Collect release-polish samples during normal gameplay.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastStorageRepair: this.lastStorageRepair,
        lastSampleIso: ''
      };
    }

    repairStoredRendererState(reason = 'sample') {
      let changed = false;
      const profile = safeGet(PROFILE_KEY, '');
      if (profile && !VALID_PROFILES.has(String(profile).toLowerCase())) {
        safeSet(PROFILE_KEY, 'auto');
        this.storageRepairCount += 1;
        this.lastStorageRepair = `renderer profile ${profile} -> auto`;
        changed = true;
      }
      const policyKey = `${ROLLOUT_PREFIX}:policy`;
      const policy = safeGet(policyKey, '');
      if (policy && !VALID_POLICIES.has(String(policy).toLowerCase())) {
        safeSet(policyKey, 'auto');
        this.storageRepairCount += 1;
        this.lastStorageRepair = `rollout policy ${policy} -> auto`;
        changed = true;
      }
      const rollbackKey = `${ROLLOUT_PREFIX}:rollbackUntilWallMs`;
      const rollback = num(safeGet(rollbackKey, '0'), 0);
      const wall = Date.now ? Date.now() : new Date().getTime();
      // Remove stale or obviously corrupt rollback timestamps. Active rollback is left alone.
      if (rollback > 0 && (rollback < wall - 60000 || rollback > wall + 1000 * 60 * 60 * 24 * 7)) {
        safeRemove(rollbackKey);
        this.storageRepairCount += 1;
        this.lastStorageRepair = 'stale rollout rollback cleared';
        changed = true;
      }
      if (changed) {
        this.lastAction = 'storage repaired';
        this.lastReason = reason;
      }
      return changed;
    }

    collect() {
      const game = this.game;
      const perf = game?.perfStats || {};
      const cleanup = game?.ensurePerformanceSettingsCleanupSystem?.().snapshot?.() || {};
      const rollout = game?.getHybridDefaultRolloutSnapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || {};
      const stable = game?.getStableReleaseCandidateSnapshot?.() || {};
      const postRc = game?.getPostReleaseCandidateHardeningSnapshot?.() || {};
      const candidate = game?.getHybridDefaultCandidateSnapshot?.() || {};
      const qa = game?.getHybridRendererQaSnapshot?.() || {};
      const backend = game?.ensureRenderBackendSystem?.();
      const backendMetrics = backend?.metrics || {};
      const benchmark = benchmarkSnapshot(game);
      const rendererProfile = cleanup.rendererProfile || safeGet(PROFILE_KEY, 'auto') || 'auto';
      const rolloutPolicy = rollout.policy || cleanup.rolloutPolicy || safeGet(`${ROLLOUT_PREFIX}:policy`, 'auto') || 'auto';
      const rendererMode = game?.getRenderBackendMode?.() || cleanup.rendererMode || backendMetrics.rendererMode || perf.renderBackendRendererMode || 'canvas2d';
      const webglReady = !!(cleanup.webglReady || perf.webglPrototypeReady || perf.renderBackendWebglPrototypeReady || backendMetrics.webglPrototypeReady);
      const rollbackActive = !!(rollout.rollbackActive || cleanup.rollbackActive || postRc.rollbackActive || perf.hybridDefaultRolloutRollbackActive);
      const compatibilityMode = !!(candidate.compatibilityMode || perf.hybridDefaultCompatibilityMode || rendererProfile === 'canvas' || rolloutPolicy === 'canvas');
      const blockedLayers = String(finalQa.blockedLayers || qa.heldOffLayers || perf.hybridFinalQaBlockedLayers || perf.hybridQaHeldOffLayers || 'none');
      const fallbackPressure = Math.max(
        num(health.lastFallbackDelta, 0),
        num(perf.hybridRolloutHealthLastFallbackDelta, 0),
        num(perf.hybridQaFallbackPressure, 0),
        num(perf.renderBackendHybridVisibleFallbacks, 0),
        num(perf.renderBackendHybridVisibleCanvasFallbackDraws, 0) / 2
      );
      const hybridCostMs = Math.max(
        num(health.lastHybridCostMs, 0),
        num(perf.hybridRolloutHealthLastHybridCostMs, 0),
        num(perf.renderBackendHybridVisibleFrameMs, 0),
        num(perf.hybridDefaultCandidateCostMs, 0)
      );
      const healthScore = clamp(health.score ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0);
      const postRcConfidence = clamp(postRc.confidence ?? perf.postReleaseHardeningConfidence, 0, 100, 0);
      const stableRcScore = clamp(stable.score ?? perf.stableReleaseCandidateScore, 0, 100, 0);
      const rolloutActive = !!(rollout.defaultActive || perf.hybridDefaultRolloutDefaultActive || rendererMode === 'hybrid');
      const qaHoldoff = blockedLayers !== 'none' || !!(qa.heldOffLayers && qa.heldOffLayers !== 'none');
      const contextLost = !!(perf.renderBackendWebglContextLost || backendMetrics.webglContextLost || health.contextLost || finalQa.contextLost);
      const rendererDenied = !!(perf.renderBackendModeDenied || rollout.rendererDenied || health.rendererDenied);
      const canvasFallbackReady = true;
      const hybridReady = webglReady && !contextLost && !rendererDenied && !rollbackActive;
      return {
        benchmark,
        rendererProfile,
        rolloutPolicy,
        rendererMode,
        webglReady,
        canvasFallbackReady,
        hybridReady,
        rollbackActive,
        compatibilityMode,
        blockedLayers,
        fallbackPressure,
        hybridCostMs,
        healthScore,
        finalQaScore,
        postRcConfidence,
        stableRcScore,
        rolloutActive,
        qaHoldoff,
        contextLost,
        rendererDenied,
        postRcShipReady: !!(postRc.shipReady || perf.postReleaseHardeningShipReady),
        stableRcReady: !!(stable.releaseReady || perf.stableReleaseCandidateReady),
        rolloutState: rollout.state || perf.hybridDefaultRolloutState || 'unknown',
        candidateState: candidate.state || perf.hybridDefaultCandidateState || 'unknown',
        finalQaStatus: finalQa.status || perf.hybridFinalQaStatus || 'pending',
        healthStatus: health.status || perf.hybridRolloutHealthStatus || 'pending'
      };
    }

    evaluate() {
      const cfg = this.settings();
      const data = this.collect();
      const warnings = [];
      const blockers = [];
      let score = 100;

      if (!data.canvasFallbackReady) { blockers.push('Canvas fallback unavailable'); score -= 80; }
      if (data.contextLost) { blockers.push('WebGL context lost'); score -= 45; }
      if (data.rendererDenied) { blockers.push('Hybrid renderer denied'); score -= 40; }
      if (!data.webglReady && data.rendererProfile !== 'canvas') { warnings.push('WebGL unavailable; Auto should use Canvas Safe Mode'); score -= 18; }
      if (data.rollbackActive) { warnings.push('Canvas rollback active'); score -= 18; }
      if (data.compatibilityMode && data.rendererProfile !== 'canvas') { warnings.push('Compatibility mode forcing Canvas'); score -= 10; }
      if (data.qaHoldoff) { warnings.push(`Hybrid layer holdoff: ${data.blockedLayers}`); score -= 14; }
      if (data.fallbackPressure > num(cfg.rendererReleasePolishMaxFallbackPressure, 16)) { warnings.push(`fallback pressure ${Math.round(data.fallbackPressure)}`); score -= Math.min(18, Math.round((data.fallbackPressure - num(cfg.rendererReleasePolishMaxFallbackPressure, 16)) * 0.7)); }
      if (data.hybridCostMs > num(cfg.rendererReleasePolishMaxHybridCostMs, 10.5)) { warnings.push(`Hybrid frame cost ${data.hybridCostMs.toFixed(1)}ms`); score -= Math.min(18, Math.round((data.hybridCostMs - num(cfg.rendererReleasePolishMaxHybridCostMs, 10.5)) * 2)); }
      if (data.healthScore && data.healthScore < num(cfg.rendererReleasePolishMinHealthScore, 84)) { warnings.push(`health score ${Math.round(data.healthScore)}`); score -= Math.min(18, Math.round((num(cfg.rendererReleasePolishMinHealthScore, 84) - data.healthScore) * 0.45)); }
      if (data.finalQaScore && data.finalQaScore < num(cfg.rendererReleasePolishMinFinalQaScore, 86)) { warnings.push(`Final QA score ${Math.round(data.finalQaScore)}`); score -= Math.min(18, Math.round((num(cfg.rendererReleasePolishMinFinalQaScore, 86) - data.finalQaScore) * 0.45)); }
      if (data.postRcConfidence && data.postRcConfidence < num(cfg.rendererReleasePolishMinPostRcConfidence, 88)) { warnings.push(`PostRC confidence ${Math.round(data.postRcConfidence)}`); score -= Math.min(14, Math.round((num(cfg.rendererReleasePolishMinPostRcConfidence, 88) - data.postRcConfidence) * 0.35)); }
      if (data.stableRcScore && data.stableRcScore < num(cfg.rendererReleasePolishMinStableRcScore, 88)) { warnings.push(`StableRC score ${Math.round(data.stableRcScore)}`); score -= Math.min(14, Math.round((num(cfg.rendererReleasePolishMinStableRcScore, 88) - data.stableRcScore) * 0.35)); }
      if (data.benchmark.state === 'missing') { warnings.push('release benchmark missing'); score -= num(cfg.rendererReleasePolishRequireBenchmark, false) ? 25 : 5; }
      else if (!data.benchmark.ok) { warnings.push(data.benchmark.warning); score -= 16; }

      score = clamp(Math.round(score), 0, 100, 0);
      const sampleCount = this.history.length + 1;
      const releasePolished = score >= num(cfg.rendererReleasePolishMinScore, 90)
        && sampleCount >= Math.max(1, Math.floor(num(cfg.rendererReleasePolishMinSamples, 45)))
        && blockers.length === 0
        && data.canvasFallbackReady
        && (data.benchmark.ok || !num(cfg.rendererReleasePolishRequireBenchmark, false));
      const status = blockers.length ? 'blocked' : score >= 92 ? 'ship-ready' : score >= 82 ? 'release-candidate' : score >= 68 ? 'watch' : 'unstable';
      const recommendation = blockers.length
        ? `Fix blockers: ${blockers.slice(0, 2).join('; ')}.`
        : releasePolished
          ? 'Renderer path is polished enough for stable lock testing.'
          : warnings.length
            ? `Address: ${warnings.slice(0, 3).join('; ')}.`
            : 'Collect more release-polish samples during normal gameplay.';
      return {
        enabled: this.enabled,
        status,
        score,
        sampleCount,
        releasePolished,
        rendererProfile: data.rendererProfile,
        rolloutPolicy: data.rolloutPolicy,
        rendererMode: data.rendererMode,
        webglReady: data.webglReady,
        canvasFallbackReady: data.canvasFallbackReady,
        hybridReady: data.hybridReady,
        benchmarkState: data.benchmark.state,
        benchmarkOk: data.benchmark.ok,
        benchmarkAvgFps: data.benchmark.avgFps || 0,
        benchmarkP95FrameMs: data.benchmark.p95FrameMs || 0,
        fallbackPressure: data.fallbackPressure,
        hybridCostMs: data.hybridCostMs,
        healthScore: data.healthScore,
        finalQaScore: data.finalQaScore,
        postRcConfidence: data.postRcConfidence,
        stableRcScore: data.stableRcScore,
        postRcShipReady: data.postRcShipReady,
        stableRcReady: data.stableRcReady,
        rolloutActive: data.rolloutActive,
        rollbackActive: data.rollbackActive,
        qaHoldoff: data.qaHoldoff,
        blockedLayers: data.blockedLayers,
        canvasLockActive: data.compatibilityMode || data.rolloutPolicy === 'canvas' || data.rendererProfile === 'canvas',
        storageRepairCount: this.storageRepairCount,
        autoCanvasClampCount: this.autoCanvasClampCount,
        warnings: warnings.join('; ') || 'none',
        blockers: blockers.join('; ') || 'none',
        recommendation,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastStorageRepair: this.lastStorageRepair,
        lastSampleIso: iso()
      };
    }

    sample(force = false) {
      if (!this.enabled && !force) return this.metrics;
      this.repairStoredRendererState('sample');
      const interval = Math.max(250, num(this.settings().rendererReleasePolishSampleMs, 700));
      const t = nowMs();
      if (!force && this.lastSampleMs && t - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = t;
      const snap = this.evaluate();
      this.history.push(snap);
      const max = Math.max(30, Math.floor(num(this.settings().rendererReleasePolishHistoryLimit, 180)));
      while (this.history.length > max) this.history.shift();
      snap.sampleCount = this.history.length;
      snap.avgScore = Math.round(avg(this.history, 'score'));
      snap.minScore = Math.round(min(this.history, 'score', snap.score));
      this.metrics = snap;
      writeJson(`${STORAGE_PREFIX}:history`, this.history.slice(-Math.max(20, Math.floor(num(this.settings().rendererReleasePolishExportHistoryLimit, 120)))));
      this.syncPerfStats();
      return snap;
    }

    snapshot() {
      this.sample(false);
      return Object.assign({}, this.metrics, {
        historyLength: this.history.length,
        history: this.history.slice(-12)
      });
    }

    reset(reason = 'settings reset') {
      this.history.length = 0;
      this.metrics = this.defaultMetrics();
      this.lastAction = 'history cleared';
      this.lastReason = reason;
      safeRemove(`${STORAGE_PREFIX}:history`);
      this.syncPerfStats();
      return true;
    }

    clearRendererSafetyState(reason = 'settings') {
      try {
        this.repairStoredRendererState(reason);
        this.game?.clearHybridDefaultRolloutRollback?.();
        this.game?.clearHybridQaLayerHoldoffs?.();
        this.game?.clearHybridFinalQaBlocks?.();
        this.game?.clearPostReleaseCanvasLock?.();
        this.game?.setRendererPlayerProfile?.('auto', `release polish clear: ${reason}`);
        this.lastAction = 'renderer safety cleared';
        this.lastReason = reason;
        this.syncPerfStats();
        return true;
      } catch (err) {
        this.lastAction = 'renderer safety clear failed';
        this.lastReason = err?.message || String(err || 'unknown');
        return false;
      }
    }

    setEnabled(enabled, reason = 'settings') {
      this.enabled = !!enabled;
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      this.lastAction = this.enabled ? 'enabled' : 'disabled';
      this.lastReason = reason;
      this.syncPerfStats();
      return this.enabled;
    }

    summary() {
      const s = this.snapshot();
      return [
        `Dream Realms Renderer Release Polish — ${window.DREAM_REALMS_VERSION || ''}`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), avg ${Math.round(s.avgScore || 0)}, min ${Math.round(s.minScore || 0)}, samples ${s.sampleCount || 0}`,
        `Release polished: ${s.releasePolished ? 'yes' : 'no'}`,
        `Renderer: ${s.rendererProfile}/${s.rolloutPolicy}/${s.rendererMode}, WebGL ${s.webglReady ? 'ready' : 'unavailable'}, Canvas fallback ${s.canvasFallbackReady ? 'ready' : 'missing'}`,
        `Benchmark: ${s.benchmarkState}, avg FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${Number(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        `Health: rollout ${Math.round(s.healthScore || 0)}, final QA ${Math.round(s.finalQaScore || 0)}, PostRC ${Math.round(s.postRcConfidence || 0)}, StableRC ${Math.round(s.stableRcScore || 0)}`,
        `Fallback pressure: ${Math.round(s.fallbackPressure || 0)}, Hybrid cost ${Number(s.hybridCostMs || 0).toFixed(1)}ms, blocked layers ${s.blockedLayers || 'none'}`,
        `Blockers: ${s.blockers || 'none'}`,
        `Warnings: ${s.warnings || 'none'}`,
        `Recommendation: ${s.recommendation || ''}`
      ].join('\n');
    }

    exportPayload() {
      return {
        version: window.DREAM_REALMS_VERSION || '',
        build: window.DREAM_REALMS_BUILD_NAME || '',
        createdAt: iso(),
        snapshot: this.snapshot(),
        history: this.history.slice(-Math.max(20, Math.floor(num(this.settings().rendererReleasePolishExportHistoryLimit, 120)))),
        postReleaseHardening: this.game?.getPostReleaseCandidateHardeningSnapshot?.() || null,
        stableReleaseCandidate: this.game?.getStableReleaseCandidateSnapshot?.() || null,
        finalQa: this.game?.getHybridFinalQaSnapshot?.() || null,
        rolloutHealth: this.game?.getHybridRolloutHealthSnapshot?.() || null,
        benchmark: this.game?.performanceVerifier?.lastBenchmark || null
      };
    }

    syncPerfStats() {
      const perf = this.game?.perfStats || (this.game ? (this.game.perfStats = {}) : null);
      if (!perf) return;
      const s = this.metrics || this.defaultMetrics();
      perf.rendererReleasePolishEnabled = !!this.enabled;
      perf.rendererReleasePolishStatus = s.status || 'warming';
      perf.rendererReleasePolishScore = num(s.score, 0);
      perf.rendererReleasePolishAvgScore = num(s.avgScore, 0);
      perf.rendererReleasePolishMinScore = num(s.minScore, 0);
      perf.rendererReleasePolishReleasePolished = !!s.releasePolished;
      perf.rendererReleasePolishSampleCount = num(s.sampleCount, 0);
      perf.rendererReleasePolishBenchmarkState = s.benchmarkState || 'missing';
      perf.rendererReleasePolishBenchmarkOk = !!s.benchmarkOk;
      perf.rendererReleasePolishCanvasFallbackReady = s.canvasFallbackReady !== false;
      perf.rendererReleasePolishHybridReady = !!s.hybridReady;
      perf.rendererReleasePolishBlockers = s.blockers || 'none';
      perf.rendererReleasePolishWarnings = s.warnings || 'none';
      perf.rendererReleasePolishRecommendation = s.recommendation || '';
      perf.rendererReleasePolishStorageRepairCount = this.storageRepairCount;
      perf.rendererReleasePolishLastAction = this.lastAction || '';
      perf.rendererReleasePolishLastReason = this.lastReason || '';
    }
  }

  function settingsBlock(game) {
    const sys = game?.ensureRendererReleasePolishSystem?.();
    const s = sys?.snapshot?.() || {};
    return `
      <div class="settingsSectionTitle">Renderer Release Polish</div>
      <div class="small" style="margin-bottom:8px">Final QA polish for the Hybrid GPU rollout. It checks WebGL health, Canvas fallback readiness, benchmark evidence, rollback pressure, and release-candidate scores.</div>
      <div class="settingsRow"><span>Release Polish Gate</span><button class="toggleBtn ${s.enabled !== false ? 'active' : ''}" data-render-polish-toggle="1">${s.enabled !== false ? 'On' : 'Off'}</button></div>
      <div class="small" style="margin-bottom:6px">Score: ${Math.round(s.score || 0)}/100 (${esc(s.status || 'warming')}), avg ${Math.round(s.avgScore || 0)}, samples ${Number(s.sampleCount || 0)}, polished ${s.releasePolished ? 'yes' : 'no'}.</div>
      <div class="small" style="margin-bottom:6px">Renderer: ${esc(s.rendererProfile || 'auto')} / ${esc(s.rolloutPolicy || 'auto')} / ${esc(s.rendererMode || 'canvas2d')}. WebGL ${s.webglReady ? 'ready' : 'unavailable'}, Canvas fallback ${s.canvasFallbackReady !== false ? 'ready' : 'missing'}.</div>
      <div class="small" style="margin-bottom:6px">Benchmark: ${esc(s.benchmarkState || 'missing')} ${s.benchmarkOk ? 'accepted' : 'not accepted'}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${Number(s.benchmarkP95FrameMs || 0).toFixed(1)}ms.</div>
      <div class="small" style="margin-bottom:6px">Blockers: ${esc(s.blockers || 'none')}</div>
      <div class="small" style="margin-bottom:8px">Recommendation: ${esc(s.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
        <button class="toggleBtn" data-render-polish-export="1">Export Polish JSON</button>
        <button class="toggleBtn" data-render-polish-copy="1">Copy Polish Summary</button>
        <button class="toggleBtn" data-render-polish-reset="1">Clear Polish Samples</button>
        <button class="toggleBtn" data-render-polish-clear="1">Clear Renderer Safety State</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drRendererReleasePolishInstalled) return;
    Game.prototype.__drRendererReleasePolishInstalled = true;

    Game.prototype.ensureRendererReleasePolishSystem = function() {
      if (!this.rendererReleasePolishSystem) this.rendererReleasePolishSystem = new RendererReleasePolishSystem(this);
      return this.rendererReleasePolishSystem;
    };

    Game.prototype.getRendererReleasePolishSnapshot = function() {
      return this.ensureRendererReleasePolishSystem?.().snapshot?.() || null;
    };

    Game.prototype.toggleRendererReleasePolish = function() {
      const sys = this.ensureRendererReleasePolishSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Renderer release polish: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('renderer release polish');
      return enabled;
    };

    Game.prototype.resetRendererReleasePolish = function() {
      this.ensureRendererReleasePolishSystem?.().reset?.('settings reset');
      this.logSystem?.('Renderer release polish samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('renderer release polish reset');
      return true;
    };

    Game.prototype.clearRendererReleaseSafetyState = function() {
      const ok = this.ensureRendererReleasePolishSystem?.().clearRendererSafetyState?.('settings clear');
      this.logSystem?.(ok ? 'Renderer safety state cleared; profile reset to Auto.' : 'Renderer safety clear failed.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('renderer release polish clear');
      return ok;
    };

    Game.prototype.exportRendererReleasePolishJson = function() {
      const payload = this.ensureRendererReleasePolishSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.38'}-renderer-release-polish.json`, payload);
      this.logSystem?.(ok ? 'Renderer release polish JSON exported.' : 'Renderer release polish JSON export failed.');
      return payload;
    };

    Game.prototype.copyRendererReleasePolishSummary = async function() {
      const text = this.ensureRendererReleasePolishSystem?.().summary?.() || 'Renderer release polish unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Renderer release polish summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drRendererReleasePolishWrapped) {
      const wrappedRender = function(...args) {
        try { this.ensureRendererReleasePolishSystem?.().sample?.(false); } catch (_err) {}
        return originalRender.apply(this, args);
      };
      wrappedRender.__drRendererReleasePolishWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drRendererReleasePolishWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-render-polish-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-render-polish-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-render-polish-toggle]')?.addEventListener('click', () => this.toggleRendererReleasePolish?.());
          list?.querySelector('[data-render-polish-export]')?.addEventListener('click', () => this.exportRendererReleasePolishJson?.());
          list?.querySelector('[data-render-polish-copy]')?.addEventListener('click', () => this.copyRendererReleasePolishSummary?.());
          list?.querySelector('[data-render-polish-reset]')?.addEventListener('click', () => this.resetRendererReleasePolish?.());
          list?.querySelector('[data-render-polish-clear]')?.addEventListener('click', () => this.clearRendererReleaseSafetyState?.());
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'renderer-release-polish' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedRenderSettingsPanel.__drRendererReleasePolishWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drRendererReleasePolishWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensureRendererReleasePolishSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('ReleasePolish:')) return result;
          const line = `ReleasePolish: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, polished ${snap.releasePolished ? 'yes' : 'no'}, bench ${snap.benchmarkState || 'missing'}, fallback ${Math.round(snap.fallbackPressure || 0)}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drRendererReleasePolishWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.RendererReleasePolishSystem = { install, RendererReleasePolishSystem };
})();
