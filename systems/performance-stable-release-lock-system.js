// Dream Realms V0.15.39: Performance stable release lock for renderer/performance shipping defaults.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsPerformanceStableReleaseLock';
  const PROFILE_KEY = 'dreamRealmsRendererPlayerProfile';
  const ADVANCED_KEY = 'dreamRealmsPerformanceSettingsAdvanced';

  function nowMs() {
    try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; }
  }

  function wallMs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function iso() {
    try { return new Date().toISOString(); } catch (_err) { return ''; }
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

  function bool(value, fallback = false) {
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

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
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

  function benchmarkState(game, cfg) {
    const last = game?.performanceVerifier?.lastBenchmark || null;
    if (!last || last.active) {
      return { state: 'missing', ok: false, avgFps: 0, p95FrameMs: 0, warning: 'no completed benchmark' };
    }
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const minFps = num(cfg.stableReleaseLockBenchmarkMinFps, 45);
    const maxP95 = num(cfg.stableReleaseLockBenchmarkMaxP95Ms, 30);
    const ok = avgFps >= minFps && (p95FrameMs <= 0 || p95FrameMs <= maxP95);
    return {
      state: ok ? 'accepted' : 'weak',
      ok,
      avgFps,
      p95FrameMs,
      warning: ok ? 'benchmark accepted' : `benchmark below target (${Math.round(avgFps)} FPS, p95 ${p95FrameMs.toFixed(1)}ms)`
    };
  }

  class PerformanceStableReleaseLockSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enablePerformanceStableReleaseLock === false ? '0' : '1'), cfg.enablePerformanceStableReleaseLock !== false);
      this.releaseMode = bool(safeGet(`${STORAGE_PREFIX}:releaseMode`, cfg.stableReleaseLockEnabledDefault === false ? '0' : '1'), cfg.stableReleaseLockEnabledDefault !== false);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'stable release lock loaded';
      this.lockedAtIso = safeGet(`${STORAGE_PREFIX}:lockedAtIso`, '');
      this.defaultsApplied = safeGet(`${STORAGE_PREFIX}:defaultsApplied`, '0') === '1';
      this.metrics = this.defaultMetrics();
      // NOTE: side-effecting init (applyReleaseDefaults -> setHybridDefaultRolloutPolicy
      // -> renderSettingsPanel) runs in ensurePerformanceStableReleaseLockSystem AFTER
      // this instance is stored on the game, so the settings-panel snapshot chain can
      // re-enter ensure() and reuse this instance instead of constructing it again.
      // Running it here (before the singleton is stored) recurses until the stack
      // overflows on every boot. See ensurePerformanceStableReleaseLockSystem below.
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        releaseMode: this.releaseMode,
        status: 'warming',
        score: 0,
        avgScore: 0,
        minScore: 0,
        sampleCount: 0,
        locked: false,
        shipReady: false,
        rendererProfile: 'auto',
        rolloutPolicy: 'auto',
        rendererMode: 'canvas2d',
        activeLayers: 'none',
        blockedLayers: 'none',
        canvasFallbackReady: true,
        webglReady: false,
        releasePolished: false,
        polishScore: 0,
        polishSamples: 0,
        postRcConfidence: 0,
        stableRcScore: 0,
        stableRcReady: false,
        healthScore: 0,
        finalQaScore: 0,
        finalQaReady: false,
        fallbackPressure: 0,
        hybridCostMs: 0,
        benchmarkState: 'missing',
        benchmarkOk: false,
        benchmarkAvgFps: 0,
        benchmarkP95FrameMs: 0,
        advancedDiagnostics: false,
        warnings: 'collecting samples',
        blockers: 'collecting samples',
        recommendation: 'Collect release-lock samples during gameplay.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lockedAtIso: this.lockedAtIso || '',
        lastSampleIso: ''
      };
    }

    applyReleaseDefaults(reason = 'release defaults') {
      const cfg = this.settings();
      if (safeGet(ADVANCED_KEY, '') === '' && cfg.stableReleaseLockHideAdvancedDiagnosticsDefault !== false) {
        safeSet(ADVANCED_KEY, '0');
      }
      const storedProfile = safeGet(PROFILE_KEY, '');
      if (!this.defaultsApplied && !storedProfile) {
        const profile = String(cfg.stableReleaseLockDefaultRendererProfile || 'auto').toLowerCase();
        const safeProfile = profile === 'hybrid' || profile === 'canvas' || profile === 'auto' ? profile : 'auto';
        try { this.game?.setRendererPlayerProfile?.(safeProfile, `stable release lock ${reason}`); } catch (_err) { safeSet(PROFILE_KEY, safeProfile); }
        this.lastAction = 'release default renderer profile applied';
        this.lastReason = safeProfile;
      }
      if (!this.defaultsApplied) {
        try { this.game?.setHybridDefaultRolloutPolicy?.('auto'); } catch (_err) {}
        safeSet(`${STORAGE_PREFIX}:defaultsApplied`, '1');
        this.defaultsApplied = true;
      }
    }

    collect() {
      const game = this.game;
      const perf = game?.perfStats || {};
      const cfg = this.settings();
      const cleanup = game?.ensurePerformanceSettingsCleanupSystem?.().snapshot?.() || {};
      const rollout = game?.getHybridDefaultRolloutSnapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || {};
      const stableRc = game?.getStableReleaseCandidateSnapshot?.() || {};
      const postRc = game?.getPostReleaseCandidateHardeningSnapshot?.() || {};
      const polish = game?.getRendererReleasePolishSnapshot?.() || {};
      const backend = game?.ensureRenderBackendSystem?.();
      const backendMetrics = backend?.metrics || {};
      const bench = benchmarkState(game, cfg);
      const fallbackPressure = Math.max(
        num(rollout.fallbackPressure, 0),
        num(health.fallbackDelta, 0),
        num(finalQa.fallbackPressure, 0),
        num(polish.fallbackPressure, 0),
        num(perf.hybridDefaultRolloutFallbackPressure, 0),
        num(perf.renderBackendHybridVisibleAggregateFallbacks, 0)
      );
      const hybridCostMs = Math.max(
        num(rollout.hybridCostMs, 0),
        num(health.hybridCostMs, 0),
        num(finalQa.hybridCostMs, 0),
        num(polish.hybridCostMs, 0),
        num(perf.renderBackendHybridVisibleFrameCostMs, 0)
      );
      const rendererProfile = cleanup.rendererProfile || cleanup.storedRendererProfile || safeGet(PROFILE_KEY, 'auto') || 'auto';
      const rolloutPolicy = rollout.policy || cleanup.rolloutPolicy || perf.hybridDefaultRolloutPolicy || 'auto';
      const rendererMode = game?.getRenderBackendMode?.() || cleanup.rendererMode || perf.renderBackendRendererMode || 'canvas2d';
      const activeLayers = rollout.layers || cleanup.activeLayers || perf.hybridDefaultRolloutLayers || perf.renderBackendHybridVisiblePromotedLayerMask || 'none';
      const blockedLayers = finalQa.blockedLayers || cleanup.blockedLayers || perf.hybridFinalQaBlockedLayers || perf.hybridQaHeldOffLayers || 'none';
      const healthScore = clamp(health.score ?? cleanup.healthScore ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? cleanup.finalQaScore ?? perf.hybridFinalQaScore, 0, 100, 0);
      const stableRcScore = clamp(stableRc.score ?? perf.stableReleaseCandidateScore, 0, 100, 0);
      const postRcConfidence = clamp(postRc.confidence ?? perf.postReleaseHardeningConfidence, 0, 100, 0);
      const polishScore = clamp(polish.score ?? perf.rendererReleasePolishScore, 0, 100, 0);
      const polishSamples = num(polish.sampleCount ?? perf.rendererReleasePolishSampleCount, 0);
      const releasePolished = !!(polish.releasePolished || perf.rendererReleasePolishReleasePolished);
      const canvasFallbackReady = polish.canvasFallbackReady !== false && cleanup.canvasFallbackReady !== false;
      const webglReady = !!(cleanup.webglReady || perf.webglPrototypeReady || perf.renderBackendWebglPrototypeReady || backendMetrics.webglPrototypeReady);
      const hardFailure = !!(perf.renderBackendContextLost || rollout.deniedReason === 'webgl unavailable' || backendMetrics.contextLost);

      const warnings = [];
      const blockers = [];
      let score = 100;
      const maxFallback = num(cfg.stableReleaseLockMaxFallbackPressure, 14);
      const maxCost = num(cfg.stableReleaseLockMaxHybridCostMs, 10.0);
      const minPolish = num(cfg.stableReleaseLockMinPolishScore, 90);
      const minPostRc = num(cfg.stableReleaseLockMinPostRcConfidence, 88);
      const minHealth = num(cfg.stableReleaseLockMinHealthScore, 84);
      const minFinalQa = num(cfg.stableReleaseLockMinFinalQaScore, 86);
      const minStableRc = num(cfg.stableReleaseLockMinStableRcScore, 88);

      if (!canvasFallbackReady) { blockers.push('Canvas fallback not ready'); score -= 35; }
      if (!webglReady && rendererProfile !== 'canvas') { warnings.push('WebGL unavailable; Canvas Safe Mode will be used'); score -= 8; }
      if (hardFailure) { blockers.push('hard WebGL/backend failure'); score -= 40; }
      if (!releasePolished) { warnings.push('release polish not locked yet'); score -= 8; }
      if (polishScore && polishScore < minPolish) { warnings.push(`polish ${Math.round(polishScore)}`); score -= Math.min(18, Math.round((minPolish - polishScore) * 0.45)); }
      if (postRcConfidence && postRcConfidence < minPostRc) { warnings.push(`PostRC ${Math.round(postRcConfidence)}`); score -= Math.min(14, Math.round((minPostRc - postRcConfidence) * 0.35)); }
      if (healthScore && healthScore < minHealth) { warnings.push(`health ${Math.round(healthScore)}`); score -= Math.min(18, Math.round((minHealth - healthScore) * 0.45)); }
      if (finalQaScore && finalQaScore < minFinalQa) { warnings.push(`FinalQA ${Math.round(finalQaScore)}`); score -= Math.min(18, Math.round((minFinalQa - finalQaScore) * 0.45)); }
      if (stableRcScore && stableRcScore < minStableRc) { warnings.push(`StableRC ${Math.round(stableRcScore)}`); score -= Math.min(14, Math.round((minStableRc - stableRcScore) * 0.35)); }
      if (fallbackPressure > maxFallback) { warnings.push(`fallback pressure ${Math.round(fallbackPressure)}`); score -= Math.min(18, Math.round((fallbackPressure - maxFallback) * 0.75)); }
      if (hybridCostMs > maxCost) { warnings.push(`Hybrid cost ${hybridCostMs.toFixed(1)}ms`); score -= Math.min(20, Math.round((hybridCostMs - maxCost) * 2)); }
      if (String(blockedLayers || 'none') !== 'none') { warnings.push(`blocked layers ${blockedLayers}`); score -= 8; }
      if (!bench.ok) { warnings.push(bench.warning); score -= bool(cfg.stableReleaseLockRequireBenchmark, false) ? 18 : 4; }

      score = clamp(score, 0, 100, 0);
      const sampleCount = this.history.length + 1;
      const locked = score >= num(cfg.stableReleaseLockMinScore, 90)
        && sampleCount >= Math.max(1, Math.floor(num(cfg.stableReleaseLockMinSamples, 30)))
        && polishSamples >= Math.max(1, Math.floor(num(cfg.rendererReleasePolishMinSamples || cfg.stableReleaseLockMinPolishSamples, 45)))
        && blockers.length === 0
        && (bench.ok || !bool(cfg.stableReleaseLockRequireBenchmark, false));
      const status = blockers.length ? 'blocked' : locked ? 'locked' : score >= 82 ? 'ship-candidate' : score >= 68 ? 'polishing' : 'not-ready';
      const recommendation = blockers.length
        ? `Fix blocker: ${blockers[0]}.`
        : locked
          ? 'Performance renderer path is release-locked. Keep Canvas Safe Mode as fallback and ship with F3/F6 diagnostics available.'
          : warnings.length
            ? `Resolve: ${warnings.slice(0, 3).join('; ')}.`
            : 'Collect more stable release-lock samples.';

      return {
        enabled: this.enabled,
        releaseMode: this.releaseMode,
        status,
        score,
        sampleCount,
        locked,
        shipReady: locked,
        rendererProfile,
        rolloutPolicy,
        rendererMode,
        activeLayers,
        blockedLayers: blockedLayers || 'none',
        canvasFallbackReady,
        webglReady,
        releasePolished,
        polishScore,
        polishSamples,
        postRcConfidence,
        stableRcScore,
        stableRcReady: !!(stableRc.ready || stableRc.releaseReady || perf.stableReleaseCandidateReady),
        healthScore,
        finalQaScore,
        finalQaReady: !!(finalQa.releaseCandidateReady || perf.hybridFinalQaReleaseCandidateReady),
        fallbackPressure,
        hybridCostMs,
        benchmarkState: bench.state,
        benchmarkOk: bench.ok,
        benchmarkAvgFps: bench.avgFps,
        benchmarkP95FrameMs: bench.p95FrameMs,
        advancedDiagnostics: safeGet(ADVANCED_KEY, '0') === '1',
        warnings: warnings.join('; ') || 'none',
        blockers: blockers.join('; ') || 'none',
        recommendation,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lockedAtIso: this.lockedAtIso || '',
        lastSampleIso: iso()
      };
    }

    sample(force = false) {
      if (!this.enabled) {
        this.metrics.enabled = false;
        this.syncPerfStats();
        return this.metrics;
      }
      const now = nowMs();
      const interval = Math.max(350, num(this.settings().stableReleaseLockSampleMs, 750));
      if (!force && now - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = now;
      this.applyReleaseDefaults('sample');
      const sample = this.collect();
      this.history.push(sample);
      const max = Math.max(30, Math.floor(num(this.settings().stableReleaseLockHistoryLimit, 180)));
      if (this.history.length > max) this.history.splice(0, this.history.length - max);
      sample.avgScore = avg(this.history, 'score');
      sample.minScore = min(this.history, 'score', sample.score);
      sample.sampleCount = this.history.length;
      const minSamples = Math.max(1, Math.floor(num(this.settings().stableReleaseLockMinSamples, 30)));
      sample.locked = !!sample.locked && sample.avgScore >= num(this.settings().stableReleaseLockMinScore, 90) && sample.minScore >= num(this.settings().stableReleaseLockMinFloorScore, 72) && this.history.length >= minSamples;
      sample.shipReady = !!sample.locked;
      if (sample.locked && !this.lockedAtIso) {
        this.lockedAtIso = iso();
        safeSet(`${STORAGE_PREFIX}:lockedAtIso`, this.lockedAtIso);
        this.lastAction = 'stable release locked';
        this.lastReason = 'score thresholds passed';
      }
      sample.lockedAtIso = this.lockedAtIso || '';
      this.metrics = sample;
      writeJson(`${STORAGE_PREFIX}:history`, this.history.slice(-Math.max(20, Math.floor(num(this.settings().stableReleaseLockExportHistoryLimit, 120)))));
      this.syncPerfStats();
      return this.metrics;
    }

    setEnabled(enabled, reason = 'settings') {
      this.enabled = !!enabled;
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      this.lastAction = this.enabled ? 'enabled' : 'disabled';
      this.lastReason = reason;
      this.sample(true);
      return this.enabled;
    }

    setReleaseMode(enabled, reason = 'settings') {
      this.releaseMode = !!enabled;
      safeSet(`${STORAGE_PREFIX}:releaseMode`, this.releaseMode ? '1' : '0');
      this.lastAction = this.releaseMode ? 'release mode enabled' : 'release mode disabled';
      this.lastReason = reason;
      if (this.releaseMode) this.applyReleaseDefaults(reason);
      this.sample(true);
      return this.releaseMode;
    }

    reset(reason = 'settings') {
      this.history = [];
      this.lockedAtIso = '';
      safeRemove(`${STORAGE_PREFIX}:history`);
      safeRemove(`${STORAGE_PREFIX}:lockedAtIso`);
      this.lastAction = 'stable release lock samples cleared';
      this.lastReason = reason;
      this.metrics = this.defaultMetrics();
      this.sample(true);
      return true;
    }

    clearSafetyState(reason = 'settings') {
      try {
        this.game?.clearHybridDefaultRolloutRollback?.();
        this.game?.clearHybridFinalQaLayerBlocks?.();
        this.game?.clearHybridQaLayerHoldoffs?.();
        this.game?.clearPostReleaseCanvasLock?.();
        this.game?.clearRendererReleaseSafetyState?.();
        this.game?.setRendererPlayerProfile?.('auto', `stable release lock ${reason}`);
        this.game?.setHybridDefaultRolloutPolicy?.('auto');
        this.lastAction = 'release safety state cleared';
        this.lastReason = reason;
        this.sample(true);
        return true;
      } catch (err) {
        this.lastAction = 'release safety clear failed';
        this.lastReason = err?.message || String(err || 'unknown');
        return false;
      }
    }

    snapshot() {
      return Object.assign({}, this.metrics, { enabled: this.enabled, releaseMode: this.releaseMode });
    }

    exportPayload() {
      return {
        build: window.DREAM_REALMS_BUILD_NAME || '',
        version: window.DREAM_REALMS_VERSION || '',
        createdAt: iso(),
        stableReleaseLock: this.snapshot(),
        history: this.history.slice(-Math.max(20, Math.floor(num(this.settings().stableReleaseLockExportHistoryLimit, 120)))),
        rendererReleasePolish: this.game?.getRendererReleasePolishSnapshot?.() || null,
        postReleaseHardening: this.game?.getPostReleaseCandidateHardeningSnapshot?.() || null,
        stableReleaseCandidate: this.game?.getStableReleaseCandidateSnapshot?.() || null,
        hybridHealth: this.game?.getHybridRolloutHealthSnapshot?.() || null,
        finalQa: this.game?.getHybridFinalQaSnapshot?.() || null,
        benchmark: this.game?.performanceVerifier?.lastBenchmark || null
      };
    }

    summary() {
      const s = this.snapshot();
      return [
        `Dream Realms ${window.DREAM_REALMS_VERSION || ''} Performance Stable Release Lock`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), locked: ${s.locked ? 'yes' : 'no'}, samples: ${s.sampleCount || 0}`,
        `Renderer: ${s.rendererProfile}/${s.rolloutPolicy}/${s.rendererMode}; layers: ${s.activeLayers}; blocked: ${s.blockedLayers}`,
        `Health: ${Math.round(s.healthScore || 0)}, FinalQA: ${Math.round(s.finalQaScore || 0)}, Polish: ${Math.round(s.polishScore || 0)}, PostRC: ${Math.round(s.postRcConfidence || 0)}`,
        `Benchmark: ${s.benchmarkState}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${Number(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        `Blockers: ${s.blockers || 'none'}`,
        `Recommendation: ${s.recommendation || ''}`
      ].join('\n');
    }

    syncPerfStats() {
      const perf = this.game && (this.game.perfStats = this.game.perfStats || {});
      if (!perf) return;
      const s = this.metrics || {};
      perf.performanceStableReleaseLockEnabled = !!this.enabled;
      perf.performanceStableReleaseLockMode = !!this.releaseMode;
      perf.performanceStableReleaseLockStatus = s.status || 'warming';
      perf.performanceStableReleaseLockScore = num(s.score, 0);
      perf.performanceStableReleaseLockAvgScore = num(s.avgScore, 0);
      perf.performanceStableReleaseLockMinScore = num(s.minScore, 0);
      perf.performanceStableReleaseLockLocked = !!s.locked;
      perf.performanceStableReleaseLockShipReady = !!s.shipReady;
      perf.performanceStableReleaseLockSampleCount = num(s.sampleCount, 0);
      perf.performanceStableReleaseLockBlockers = s.blockers || 'none';
      perf.performanceStableReleaseLockWarnings = s.warnings || 'none';
      perf.performanceStableReleaseLockRecommendation = s.recommendation || '';
      perf.performanceStableReleaseLockBenchmarkState = s.benchmarkState || 'missing';
      perf.performanceStableReleaseLockBenchmarkOk = !!s.benchmarkOk;
      perf.performanceStableReleaseLockLockedAtIso = s.lockedAtIso || this.lockedAtIso || '';
      perf.performanceStableReleaseLockLastAction = this.lastAction || '';
      perf.performanceStableReleaseLockLastReason = this.lastReason || '';
    }
  }

  function settingsBlock(game) {
    const sys = game?.ensurePerformanceStableReleaseLockSystem?.();
    const s = sys?.snapshot?.() || {};
    return `
      <div class="settingsSectionTitle">Performance Stable Release Lock</div>
      <div class="small" style="margin-bottom:8px">Shipping gate for the renderer/performance stack. Hybrid GPU remains the default path only when healthy; Canvas Safe Mode remains the compatibility fallback.</div>
      <div class="settingsRow"><span>Stable Release Lock</span><button class="toggleBtn ${s.enabled !== false ? 'active' : ''}" data-stable-release-lock-toggle="1">${s.enabled !== false ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Release Mode Defaults</span><button class="toggleBtn ${s.releaseMode ? 'active' : ''}" data-stable-release-mode-toggle="1">${s.releaseMode ? 'On' : 'Off'}</button></div>
      <div class="small" style="margin-bottom:6px">Score: ${Math.round(s.score || 0)}/100 (${esc(s.status || 'warming')}), avg ${Math.round(s.avgScore || 0)}, min ${Math.round(s.minScore || 0)}, samples ${Number(s.sampleCount || 0)}, locked ${s.locked ? 'yes' : 'no'}.</div>
      <div class="small" style="margin-bottom:6px">Renderer: ${esc(s.rendererProfile || 'auto')} / ${esc(s.rolloutPolicy || 'auto')} / ${esc(s.rendererMode || 'canvas2d')}. Layers: ${esc(s.activeLayers || 'none')}. Canvas fallback ${s.canvasFallbackReady !== false ? 'ready' : 'missing'}.</div>
      <div class="small" style="margin-bottom:6px">Benchmark: ${esc(s.benchmarkState || 'missing')} ${s.benchmarkOk ? 'accepted' : 'not accepted'}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${Number(s.benchmarkP95FrameMs || 0).toFixed(1)}ms.</div>
      <div class="small" style="margin-bottom:6px">Blockers: ${esc(s.blockers || 'none')}</div>
      <div class="small" style="margin-bottom:8px">Recommendation: ${esc(s.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
        <button class="toggleBtn" data-stable-release-export="1">Export Lock JSON</button>
        <button class="toggleBtn" data-stable-release-copy="1">Copy Lock Summary</button>
        <button class="toggleBtn" data-stable-release-reset="1">Clear Lock Samples</button>
        <button class="toggleBtn" data-stable-release-clear="1">Clear Safety State</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drPerformanceStableReleaseLockInstalled) return;
    Game.prototype.__drPerformanceStableReleaseLockInstalled = true;

    Game.prototype.ensurePerformanceStableReleaseLockSystem = function() {
      if (!this.performanceStableReleaseLockSystem) {
        // Store the singleton BEFORE running side-effecting init. applyReleaseDefaults
        // renders the settings panel, whose settingsBlock re-enters this ensure(); if
        // the instance is not stored first, that re-entry sees a falsy field and builds
        // the system again, recursing until the stack overflows (and never reaching the
        // defaultsApplied='1' write, so the storm repeats on every load). Storing first
        // makes the re-entrant call reuse this instance.
        const sys = new PerformanceStableReleaseLockSystem(this);
        this.performanceStableReleaseLockSystem = sys;
        sys.applyReleaseDefaults('constructor');
        sys.syncPerfStats();
      }
      return this.performanceStableReleaseLockSystem;
    };

    Game.prototype.getPerformanceStableReleaseLockSnapshot = function() {
      return this.ensurePerformanceStableReleaseLockSystem?.().snapshot?.() || null;
    };

    Game.prototype.togglePerformanceStableReleaseLock = function() {
      const sys = this.ensurePerformanceStableReleaseLockSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Performance stable release lock: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('performance stable release lock');
      return enabled;
    };

    Game.prototype.togglePerformanceStableReleaseMode = function() {
      const sys = this.ensurePerformanceStableReleaseLockSystem?.();
      const enabled = sys?.setReleaseMode?.(!sys.releaseMode, 'settings toggle') || false;
      this.logSystem?.(`Release mode defaults: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('performance stable release mode');
      return enabled;
    };

    Game.prototype.resetPerformanceStableReleaseLock = function() {
      this.ensurePerformanceStableReleaseLockSystem?.().reset?.('settings reset');
      this.logSystem?.('Performance stable release lock samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('performance stable release lock reset');
      return true;
    };

    Game.prototype.clearPerformanceStableReleaseSafetyState = function() {
      const ok = this.ensurePerformanceStableReleaseLockSystem?.().clearSafetyState?.('settings clear');
      this.logSystem?.(ok ? 'Renderer release safety state cleared.' : 'Renderer release safety clear failed.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('performance stable release safety clear');
      return ok;
    };

    Game.prototype.exportPerformanceStableReleaseLockJson = function() {
      const payload = this.ensurePerformanceStableReleaseLockSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.39'}-performance-stable-release-lock.json`, payload);
      this.logSystem?.(ok ? 'Performance stable release lock JSON exported.' : 'Performance stable release lock JSON export failed.');
      return payload;
    };

    Game.prototype.copyPerformanceStableReleaseLockSummary = async function() {
      const text = this.ensurePerformanceStableReleaseLockSystem?.().summary?.() || 'Performance stable release lock unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Performance stable release lock summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drPerformanceStableReleaseLockWrapped) {
      const wrappedRender = function(...args) {
        try { this.ensurePerformanceStableReleaseLockSystem?.().sample?.(false); } catch (_err) {}
        return originalRender.apply(this, args);
      };
      wrappedRender.__drPerformanceStableReleaseLockWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalSettings = Game.prototype.renderSettingsPanel;
    if (typeof originalSettings === 'function' && !originalSettings.__drPerformanceStableReleaseLockWrapped) {
      const wrappedSettings = function(...args) {
        const result = originalSettings.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-stable-release-lock-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-stable-release-lock-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-stable-release-lock-toggle]')?.addEventListener('click', () => this.togglePerformanceStableReleaseLock?.());
          list?.querySelector('[data-stable-release-mode-toggle]')?.addEventListener('click', () => this.togglePerformanceStableReleaseMode?.());
          list?.querySelector('[data-stable-release-export]')?.addEventListener('click', () => this.exportPerformanceStableReleaseLockJson?.());
          list?.querySelector('[data-stable-release-copy]')?.addEventListener('click', () => this.copyPerformanceStableReleaseLockSummary?.());
          list?.querySelector('[data-stable-release-reset]')?.addEventListener('click', () => this.resetPerformanceStableReleaseLock?.());
          list?.querySelector('[data-stable-release-clear]')?.addEventListener('click', () => this.clearPerformanceStableReleaseSafetyState?.());
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'performance-stable-release-lock' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedSettings.__drPerformanceStableReleaseLockWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedSettings;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drPerformanceStableReleaseLockWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensurePerformanceStableReleaseLockSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('StableLock:')) return result;
          const line = `StableLock: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, locked ${snap.locked ? 'yes' : 'no'}, renderer ${snap.rendererProfile || 'auto'}, bench ${snap.benchmarkState || 'missing'}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drPerformanceStableReleaseLockWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.PerformanceStableReleaseLockSystem = { install, PerformanceStableReleaseLockSystem };
})();
