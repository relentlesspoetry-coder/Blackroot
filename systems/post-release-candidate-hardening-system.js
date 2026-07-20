// Dream Realms V0.15.37: Post-release-candidate hardening for renderer defaults, benchmark evidence, and rollback reports.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsPostReleaseHardening';
  const PROFILE_KEY = 'dreamRealmsRendererPlayerProfile';
  const ONE_HOUR_MS = 60 * 60 * 1000;

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

  function esc(value) {
    const str = String(value == null ? '' : value);
    return str.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
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

  function avg(list, key) {
    if (!Array.isArray(list) || !list.length) return 0;
    let total = 0;
    let count = 0;
    for (const item of list) {
      const value = key ? num(item?.[key], NaN) : num(item, NaN);
      if (Number.isFinite(value)) { total += value; count += 1; }
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

  function benchmarkVerdict(benchmark, cfg) {
    if (!benchmark || benchmark.active) return { state: 'missing', ok: false, warning: 'no completed benchmark' };
    const avgFps = num(benchmark.avgFps ?? benchmark.averageFps, 0);
    const p95 = num(benchmark.p95FrameMs, 0);
    const minFps = num(cfg.postReleaseHardeningBenchmarkMinFps, 45);
    const maxP95 = num(cfg.postReleaseHardeningBenchmarkMaxP95Ms, 28);
    const problems = [];
    if (avgFps > 0 && avgFps < minFps) problems.push(`avg FPS ${Math.round(avgFps)}/${Math.round(minFps)}`);
    if (p95 > 0 && p95 > maxP95) problems.push(`p95 ${p95.toFixed(1)}ms/${maxP95.toFixed(1)}ms`);
    return {
      state: problems.length ? 'weak' : 'ok',
      ok: problems.length === 0,
      warning: problems.join('; ') || 'benchmark evidence accepted',
      avgFps,
      p95
    };
  }

  class PostReleaseCandidateHardeningSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = toBool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enablePostReleaseCandidateHardening === false ? '0' : '1'), cfg.enablePostReleaseCandidateHardening !== false);
      this.firstRunComplete = safeGet(`${STORAGE_PREFIX}:firstRunComplete`, '0') === '1';
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'post-release hardening loaded';
      this.rollbackEvidence = readJson(`${STORAGE_PREFIX}:rollbackEvidence`, []);
      if (!Array.isArray(this.rollbackEvidence)) this.rollbackEvidence = [];
      this.metrics = this.defaultMetrics();
      this.applyFirstRunDefaults('constructor');
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        status: 'warming',
        confidence: 0,
        avgConfidence: 0,
        minConfidence: 0,
        sampleCount: 0,
        shipReady: false,
        benchmarkState: 'missing',
        benchmarkWarning: 'no completed benchmark',
        firstRunComplete: !!this.firstRunComplete,
        rendererProfile: 'auto',
        rolloutPolicy: 'auto',
        rcScore: 0,
        rcReady: false,
        healthScore: 0,
        finalQaScore: 0,
        fallbackPressure: 0,
        hybridCostMs: 0,
        rollbackActive: false,
        rollbackFailureCount: 0,
        canvasLockActive: false,
        warnings: 'collecting samples',
        blockers: 'collecting samples',
        recommendation: 'Collect post-release samples during normal gameplay.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    applyFirstRunDefaults(reason = 'first run') {
      if (this.firstRunComplete) return false;
      const cfg = this.settings();
      const storedProfile = safeGet(PROFILE_KEY, '');
      const profile = String(cfg.postReleaseHardeningFirstRunDefaultProfile || 'auto').toLowerCase();
      try {
        if (!storedProfile && (profile === 'auto' || profile === 'canvas' || profile === 'hybrid')) {
          this.game?.setRendererPlayerProfile?.(profile, `post-release ${reason}`);
          this.lastAction = 'first-run renderer default applied';
          this.lastReason = profile;
        }
        this.game?.ensureHybridDefaultRolloutSystem?.().setPolicy?.('auto', `post-release ${reason}`);
      } catch (err) {
        this.lastAction = 'first-run default failed';
        this.lastReason = err?.message || String(err || 'unknown');
      }
      this.firstRunComplete = true;
      safeSet(`${STORAGE_PREFIX}:firstRunComplete`, '1');
      return true;
    }

    collect() {
      const game = this.game;
      const perf = game?.perfStats || {};
      const stable = game?.getStableReleaseCandidateSnapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || {};
      const rollout = game?.getHybridDefaultRolloutSnapshot?.() || {};
      const cleanup = game?.ensurePerformanceSettingsCleanupSystem?.().snapshot?.() || {};
      const candidate = game?.getHybridDefaultCandidateSnapshot?.() || {};
      const qa = game?.getHybridRendererQaSnapshot?.() || {};
      const benchmark = game?.performanceVerifier?.lastBenchmark || null;
      const cfg = this.settings();
      const fallbackPressure = Math.max(
        num(stable.fallbackPressure, 0),
        num(finalQa.fallbackPressure ?? perf.hybridFinalQaFallbackPressure, 0),
        num(health.fallbackDelta ?? perf.hybridRolloutHealthFallbackDelta, 0),
        num(perf.renderBackendHybridVisibleAggregateFallbacks, 0)
      );
      const hybridCostMs = Math.max(
        num(stable.hybridCostMs, 0),
        num(finalQa.hybridCostMs ?? perf.hybridFinalQaHybridCostMs, 0),
        num(health.hybridCostMs ?? perf.hybridRolloutHealthHybridCostMs, 0),
        num(perf.renderBackendHybridVisibleFrameMs, 0)
      );
      return { perf, stable, health, finalQa, rollout, cleanup, candidate, qa, benchmark, cfg, fallbackPressure, hybridCostMs };
    }

    evaluate() {
      const data = this.collect();
      const { stable, health, finalQa, rollout, cleanup, candidate, qa, benchmark, cfg, fallbackPressure, hybridCostMs } = data;
      const bench = benchmarkVerdict(benchmark, cfg);
      const requiredBenchmarkPolicy = String(cfg.postReleaseHardeningRequireBenchmarkPolicy || 'warn').toLowerCase();
      const warnings = [];
      const blockers = [];
      const rcScore = clamp(stable.score, 0, 100, 0);
      const healthScore = clamp(health.score ?? stable.healthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? stable.finalQaScore, 0, 100, 0);
      const rendererProfile = cleanup.rendererProfile || stable.rendererProfile || 'auto';
      const rolloutPolicy = rollout.policy || cleanup.rolloutPolicy || 'auto';
      const rollbackActive = !!(rollout.rollbackActive || cleanup.rollbackActive);
      const compatibilityMode = !!(candidate.compatibilityMode || rendererProfile === 'canvas' || rolloutPolicy === 'canvas');
      const contextLost = !!(data.perf.renderBackendWebglContextLost);
      const rendererDenied = !!(data.perf.renderBackendModeDenied);
      const qaHeld = !!(qa.heldOffLayers && qa.heldOffLayers !== 'none') || !!(data.perf.hybridQaHeldOffLayers && data.perf.hybridQaHeldOffLayers !== 'none');
      const finalBlocked = !!(finalQa.blockActive || data.perf.hybridFinalQaBlockActive);
      const targetConfidence = clamp(cfg.postReleaseHardeningMinConfidence || 88, 0, 100, 88);
      const targetRc = clamp(cfg.postReleaseHardeningMinRcScore || 88, 0, 100, 88);
      const targetHealth = clamp(cfg.postReleaseHardeningMinHealthScore || 82, 0, 100, 82);
      const targetQa = clamp(cfg.postReleaseHardeningMinFinalQaScore || 84, 0, 100, 84);
      const maxFallback = num(cfg.postReleaseHardeningMaxFallbackPressure, 20);
      const maxCost = num(cfg.postReleaseHardeningMaxHybridCostMs, 11.5);

      if (rcScore < targetRc) blockers.push(`release gate ${Math.round(rcScore)}/${Math.round(targetRc)}`);
      if (healthScore < targetHealth) blockers.push(`health ${Math.round(healthScore)}/${Math.round(targetHealth)}`);
      if (finalQaScore < targetQa) blockers.push(`Final QA ${Math.round(finalQaScore)}/${Math.round(targetQa)}`);
      if (fallbackPressure > maxFallback) blockers.push(`fallback pressure ${Math.round(fallbackPressure)}/${Math.round(maxFallback)}`);
      if (hybridCostMs > maxCost) blockers.push(`Hybrid cost ${hybridCostMs.toFixed(1)}ms/${maxCost.toFixed(1)}ms`);
      if (rollbackActive) blockers.push('rollout rollback active');
      if (compatibilityMode) warnings.push('Canvas compatibility profile active');
      if (contextLost) blockers.push('WebGL context lost');
      if (rendererDenied) blockers.push('renderer mode denied');
      if (qaHeld) warnings.push(`QA layer holdoff ${qa.heldOffLayers || data.perf.hybridQaHeldOffLayers || 'active'}`);
      if (finalBlocked) warnings.push('Final QA layer block active');
      if (!stable.releaseReady) warnings.push('stable release gate not ready yet');
      if (bench.state !== 'ok') {
        if (requiredBenchmarkPolicy === 'block' || requiredBenchmarkPolicy === 'required') blockers.push(bench.warning);
        else warnings.push(bench.warning);
      }

      let confidence = Math.round((rcScore * 0.32) + (healthScore * 0.22) + (finalQaScore * 0.24) + (clamp(stable.avgScore, 0, 100, rcScore) * 0.12) + (bench.ok ? 10 : 3));
      confidence -= Math.min(22, Math.max(0, fallbackPressure - maxFallback) * 2);
      confidence -= Math.min(18, Math.max(0, hybridCostMs - maxCost) * 2);
      confidence -= Math.min(25, blockers.length * 6);
      confidence -= Math.min(10, warnings.length * 2);
      confidence = clamp(confidence, 0, 100, 0);

      const shipReady = this.enabled && confidence >= targetConfidence && blockers.length === 0 && (stable.releaseReady || rcScore >= targetRc + 2);
      let status = 'warming';
      if (!this.enabled) status = 'disabled';
      else if (shipReady) status = 'ship-ready';
      else if (confidence >= targetConfidence - 4) status = 'release-candidate';
      else if (confidence >= 70) status = 'needs-evidence';
      else if (confidence >= 45) status = 'unstable';
      else status = 'blocked';

      const recommendation = shipReady
        ? 'Post-release hardening passed: keep Hybrid default with Canvas fallback preserved.'
        : blockers.length
          ? `Hold release: ${blockers.slice(0, 2).join('; ')}.`
          : warnings.length
            ? `Candidate with warnings: ${warnings.slice(0, 2).join('; ')}.`
            : 'Run benchmark and test camera rotation, caves, dense combat, and Silk Web Cavern.';

      return {
        enabled: this.enabled,
        status,
        confidence,
        shipReady,
        rcScore,
        rcReady: !!stable.releaseReady,
        healthScore,
        finalQaScore,
        fallbackPressure,
        hybridCostMs,
        benchmarkState: bench.state,
        benchmarkWarning: bench.warning,
        benchmarkAvgFps: bench.avgFps || 0,
        benchmarkP95FrameMs: bench.p95 || 0,
        rendererProfile,
        rolloutPolicy,
        rollbackActive,
        rollbackRemainingMs: num(rollout.rollbackRemainingMs || cleanup.rollbackRemainingMs, 0),
        rollbackFailureCount: num(rollout.failureCount || data.perf.hybridDefaultRolloutFailureCount, 0),
        compatibilityMode,
        canvasLockActive: compatibilityMode || rolloutPolicy === 'canvas',
        qaHoldoff: qaHeld,
        finalQaBlock: finalBlocked,
        contextLost,
        rendererDenied,
        warnings: warnings.join('; ') || 'none',
        blockers: blockers.join('; ') || 'none',
        recommendation,
        firstRunComplete: !!this.firstRunComplete,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: iso()
      };
    }

    sample(force = false) {
      if (!this.enabled && !force) return this.metrics;
      this.applyFirstRunDefaults('sample');
      const cfg = this.settings();
      const interval = Math.max(250, num(cfg.postReleaseHardeningSampleMs, 650));
      const t = nowMs();
      if (!force && this.lastSampleMs && t - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = t;
      const snap = this.evaluate();
      this.history.push(snap);
      const max = Math.max(30, Math.floor(num(cfg.postReleaseHardeningHistoryLimit, 240)));
      while (this.history.length > max) this.history.shift();
      const confidence = this.history.map(s => num(s.confidence, 0));
      snap.sampleCount = this.history.length;
      snap.avgConfidence = Math.round(avg(this.history, 'confidence'));
      snap.minConfidence = Math.round(min(this.history, 'confidence', snap.confidence));
      this.metrics = snap;
      if (snap.shipReady) safeSet(`${STORAGE_PREFIX}:lastShipReadyIso`, snap.lastSampleIso);
      this.persistHistory();
      this.maybeLockCanvasAfterRepeatedRollbacks(snap);
      this.syncPerfStats();
      return snap;
    }

    maybeLockCanvasAfterRepeatedRollbacks(snap) {
      const cfg = this.settings();
      const limit = Math.max(1, Math.floor(num(cfg.postReleaseHardeningRepeatedRollbackLimit, 2)));
      const failures = Math.floor(num(snap.rollbackFailureCount, 0));
      if (failures < limit || snap.rendererProfile === 'canvas' || snap.contextLost === false && !snap.rendererDenied && !snap.rollbackActive) return false;
      const hours = Math.max(1, num(cfg.postReleaseHardeningCanvasLockHours, 12));
      const evidence = { at: iso(), failures, reason: snap.blockers || snap.warnings || 'repeated hybrid rollback' };
      this.rollbackEvidence.push(evidence);
      while (this.rollbackEvidence.length > 12) this.rollbackEvidence.shift();
      writeJson(`${STORAGE_PREFIX}:rollbackEvidence`, this.rollbackEvidence);
      try {
        this.game?.setRendererPlayerProfile?.('canvas', `post-release canvas lock: ${evidence.reason}`);
        this.game?.ensureHybridDefaultRolloutSystem?.().rollbackToCanvas?.(`post-release hardening: ${evidence.reason}`, hours);
        this.lastAction = 'canvas lock applied';
        this.lastReason = evidence.reason;
        this.game?.logSystem?.(`Hybrid locked to Canvas Safe Mode for ${Math.round(hours)}h after repeated rollback evidence.`);
        return true;
      } catch (_err) {
        return false;
      }
    }

    persistHistory() {
      const limit = Math.max(20, Math.floor(num(this.settings().postReleaseHardeningExportHistoryLimit, 120)));
      writeJson(`${STORAGE_PREFIX}:history`, this.history.slice(-limit));
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

    clearCanvasLock(reason = 'settings clear') {
      try {
        this.game?.clearHybridDefaultRolloutRollback?.();
        this.game?.setRendererPlayerProfile?.('auto', `post-release clear canvas lock: ${reason}`);
        this.lastAction = 'canvas lock cleared';
        this.lastReason = reason;
        this.syncPerfStats();
        return true;
      } catch (_err) {
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

    snapshot() {
      this.sample(false);
      return Object.assign({}, this.metrics, {
        historyLength: this.history.length,
        rollbackEvidence: this.rollbackEvidence.slice(-8),
        lastShipReadyIso: safeGet(`${STORAGE_PREFIX}:lastShipReadyIso`, '') || ''
      });
    }

    summary() {
      const s = this.snapshot();
      return [
        `Post-Release Hardening: ${Math.round(s.confidence || 0)}/100 ${s.status}`,
        `Ship ready: ${s.shipReady ? 'yes' : 'no'}, samples: ${s.sampleCount || 0}, avg/min: ${Math.round(s.avgConfidence || 0)}/${Math.round(s.minConfidence || 0)}`,
        `Renderer: ${s.rendererProfile}/${s.rolloutPolicy}, rollback active: ${s.rollbackActive ? 'yes' : 'no'}, Canvas lock: ${s.canvasLockActive ? 'yes' : 'no'}`,
        `Release gate: ${Math.round(s.rcScore || 0)}/100, health ${Math.round(s.healthScore || 0)}/100, Final QA ${Math.round(s.finalQaScore || 0)}/100`,
        `Benchmark: ${s.benchmarkState} (${s.benchmarkWarning || 'n/a'})`,
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
        history: this.history.slice(-Math.max(20, Math.floor(num(this.settings().postReleaseHardeningExportHistoryLimit, 120)))),
        rollbackEvidence: this.rollbackEvidence.slice(-12),
        stableReleaseCandidate: this.game?.getStableReleaseCandidateSnapshot?.() || null,
        rendererHealth: this.game?.ensurePerformanceSettingsCleanupSystem?.().exportPayload?.() || null,
        benchmark: this.game?.performanceVerifier?.lastBenchmark || null,
        benchmarkHistory: this.game?.performanceVerifier?.benchmarkHistory || []
      };
    }

    syncPerfStats() {
      const perf = this.game?.perfStats || (this.game ? (this.game.perfStats = {}) : null);
      if (!perf) return;
      const s = this.metrics || this.defaultMetrics();
      perf.postReleaseHardeningEnabled = !!this.enabled;
      perf.postReleaseHardeningStatus = s.status || 'warming';
      perf.postReleaseHardeningConfidence = num(s.confidence, 0);
      perf.postReleaseHardeningAvgConfidence = num(s.avgConfidence, 0);
      perf.postReleaseHardeningMinConfidence = num(s.minConfidence, 0);
      perf.postReleaseHardeningShipReady = !!s.shipReady;
      perf.postReleaseHardeningSampleCount = num(s.sampleCount, 0);
      perf.postReleaseHardeningBenchmarkState = s.benchmarkState || 'missing';
      perf.postReleaseHardeningBlockers = s.blockers || 'none';
      perf.postReleaseHardeningWarnings = s.warnings || 'none';
      perf.postReleaseHardeningRecommendation = s.recommendation || '';
      perf.postReleaseHardeningFirstRunComplete = !!this.firstRunComplete;
      perf.postReleaseHardeningLastAction = this.lastAction || '';
      perf.postReleaseHardeningLastReason = this.lastReason || '';
    }
  }

  function settingsHtml(game) {
    const sys = game?.ensurePostReleaseCandidateHardeningSystem?.();
    const s = sys?.snapshot?.() || {};
    return `
      <div class="settingsSectionTitle">Post-Release Hardening</div>
      <div class="small" style="margin-bottom:8px">Final safety layer for Hybrid-as-default. It checks release-gate evidence, benchmark quality, rollback pressure, and Canvas fallback readiness.</div>
      <div class="settingsRow"><span>Hardening Gate</span><button class="toggleBtn ${s.enabled !== false ? 'active' : ''}" data-post-release-toggle="1">${s.enabled !== false ? 'On' : 'Off'}</button></div>
      <div class="small" style="margin-bottom:6px">Confidence: ${Math.round(s.confidence || 0)}/100 (${esc(s.status || 'warming')}), avg ${Math.round(s.avgConfidence || 0)}, samples ${Number(s.sampleCount || 0)}, ship-ready ${s.shipReady ? 'yes' : 'no'}.</div>
      <div class="small" style="margin-bottom:6px">Benchmark: ${esc(s.benchmarkState || 'missing')} — ${esc(s.benchmarkWarning || 'no benchmark evidence')}.</div>
      <div class="small" style="margin-bottom:6px">Blockers: ${esc(s.blockers || 'none')}</div>
      <div class="small" style="margin-bottom:8px">Recommendation: ${esc(s.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
        <button class="toggleBtn" data-post-release-benchmark="1">Run Release Benchmark</button>
        <button class="toggleBtn" data-post-release-export="1">Export Hardening JSON</button>
        <button class="toggleBtn" data-post-release-copy="1">Copy Hardening Summary</button>
        <button class="toggleBtn" data-post-release-reset="1">Clear Hardening Samples</button>
        <button class="toggleBtn" data-post-release-clear-lock="1">Clear Canvas Lock</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drPostReleaseCandidateHardeningInstalled) return;
    Game.prototype.__drPostReleaseCandidateHardeningInstalled = true;

    Game.prototype.ensurePostReleaseCandidateHardeningSystem = function() {
      if (!this.postReleaseCandidateHardeningSystem) this.postReleaseCandidateHardeningSystem = new PostReleaseCandidateHardeningSystem(this);
      return this.postReleaseCandidateHardeningSystem;
    };

    Game.prototype.getPostReleaseCandidateHardeningSnapshot = function() {
      return this.ensurePostReleaseCandidateHardeningSystem?.().snapshot?.() || null;
    };

    Game.prototype.togglePostReleaseCandidateHardening = function() {
      const sys = this.ensurePostReleaseCandidateHardeningSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Post-release hardening: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('post release hardening');
      return enabled;
    };

    Game.prototype.resetPostReleaseCandidateHardening = function() {
      this.ensurePostReleaseCandidateHardeningSystem?.().reset?.('settings reset');
      this.logSystem?.('Post-release hardening samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('post release hardening reset');
      return true;
    };

    Game.prototype.clearPostReleaseCanvasLock = function() {
      const ok = this.ensurePostReleaseCandidateHardeningSystem?.().clearCanvasLock?.('settings clear canvas lock');
      this.logSystem?.(ok ? 'Post-release Canvas lock cleared; renderer reset to Auto.' : 'Post-release Canvas lock clear failed.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('post release canvas lock');
      return ok;
    };

    Game.prototype.exportPostReleaseHardeningJson = function() {
      const payload = this.ensurePostReleaseCandidateHardeningSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.37'}-post-release-hardening.json`, payload);
      this.logSystem?.(ok ? 'Post-release hardening JSON exported.' : 'Post-release hardening JSON export failed.');
      return payload;
    };

    Game.prototype.copyPostReleaseHardeningSummary = async function() {
      const text = this.ensurePostReleaseCandidateHardeningSystem?.().summary?.() || 'Post-release hardening unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Post-release hardening summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };

    Game.prototype.runPostReleaseBenchmark = function() {
      const seconds = Number(this.performanceSettings?.().benchmarkDurationSec || 60) || 60;
      if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('post-release toggle');
      return this.startPerformanceBenchmark?.(seconds);
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drPostReleaseHardeningWrapped) {
      const wrappedRender = function(...args) {
        try { this.ensurePostReleaseCandidateHardeningSystem?.().sample?.(false); } catch (_err) {}
        return originalRender.apply(this, args);
      };
      wrappedRender.__drPostReleaseHardeningWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const perfClass = DR.PerformanceVerificationSystem || DR.systems?.PerformanceVerificationSystem;
    if (perfClass?.prototype && typeof perfClass.prototype.settingsPanelHtml === 'function' && !perfClass.prototype.settingsPanelHtml.__drPostReleaseHardeningWrapped) {
      const originalSettingsPanelHtml = perfClass.prototype.settingsPanelHtml;
      const wrappedSettingsPanelHtml = function(...args) {
        const html = originalSettingsPanelHtml.apply(this, args) || '';
        if (!(this.game?.debugOverlayOpen || DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true)) return html;
        const block = settingsHtml(this.game);
        const marker = '<div class="settingsSectionTitle">Stable Release Candidate</div>';
        return html.includes(marker) ? html.replace(marker, `${block}${marker}`) : `${html}${block}`;
      };
      wrappedSettingsPanelHtml.__drPostReleaseHardeningWrapped = true;
      perfClass.prototype.settingsPanelHtml = wrappedSettingsPanelHtml;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drPostReleaseHardeningWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          list?.querySelector('[data-post-release-toggle]')?.addEventListener('click', () => this.togglePostReleaseCandidateHardening?.());
          list?.querySelector('[data-post-release-benchmark]')?.addEventListener('click', () => this.runPostReleaseBenchmark?.());
          list?.querySelector('[data-post-release-export]')?.addEventListener('click', () => this.exportPostReleaseHardeningJson?.());
          list?.querySelector('[data-post-release-copy]')?.addEventListener('click', () => this.copyPostReleaseHardeningSummary?.());
          list?.querySelector('[data-post-release-reset]')?.addEventListener('click', () => this.resetPostReleaseCandidateHardening?.());
          list?.querySelector('[data-post-release-clear-lock]')?.addEventListener('click', () => this.clearPostReleaseCanvasLock?.());
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'post-release-hardening' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedRenderSettingsPanel.__drPostReleaseHardeningWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drPostReleaseHardeningWrapped) {
      const wrappedDebug = function(force, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (body && (this.debugOverlayOpen || force || DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true)) {
            const snap = this.ensurePostReleaseCandidateHardeningSystem?.().snapshot?.();
            if (snap) {
              const line = `\nPostRC: ${Math.round(snap.confidence || 0)}/100 ${snap.status || 'warming'}, ship ${snap.shipReady ? 'yes' : 'no'}, bench ${snap.benchmarkState || 'missing'}, blockers ${snap.blockers || 'none'}`;
              if (!String(body.textContent || '').includes('PostRC:')) body.textContent = `${body.textContent || ''}${line}`;
            }
          }
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drPostReleaseHardeningWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.PostReleaseCandidateHardeningSystem = { install, PostReleaseCandidateHardeningSystem };
  DR.systems.PostReleaseCandidateHardeningSystem = PostReleaseCandidateHardeningSystem;
  if (DR.Game) install(DR.Game);
})();
