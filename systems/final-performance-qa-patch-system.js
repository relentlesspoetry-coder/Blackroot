// Dream Realms V0.15.40: Final performance QA patch for release-facing renderer verification.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsFinalPerformanceQaPatch';
  const PROFILE_KEY = 'dreamRealmsRendererPlayerProfile';

  function nowMs() {
    try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; }
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

  function benchmarkSnapshot(game, cfg) {
    const active = game?.performanceVerifier?.benchmark || null;
    const last = game?.performanceVerifier?.lastBenchmark || null;
    if (active?.active) return { state: 'running', ok: false, active: true, avgFps: 0, p95FrameMs: 0, warning: 'benchmark running' };
    if (!last || last.active) return { state: 'missing', ok: false, active: false, avgFps: 0, p95FrameMs: 0, warning: 'no completed benchmark' };
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const minFps = num(cfg.finalPerformanceQaPatchBenchmarkMinFps, 45);
    const maxP95 = num(cfg.finalPerformanceQaPatchBenchmarkMaxP95Ms, 30);
    const ok = avgFps >= minFps && (p95FrameMs <= 0 || p95FrameMs <= maxP95);
    return {
      state: ok ? 'accepted' : 'weak',
      ok,
      active: false,
      avgFps,
      p95FrameMs,
      warning: ok ? 'benchmark accepted' : `benchmark below target (${Math.round(avgFps)} FPS, p95 ${p95FrameMs.toFixed(1)}ms)`
    };
  }

  function layerMaskToText(mask) {
    if (!mask) return 'none';
    return String(mask).replace(/[|,]+/g, ', ').replace(/\s+/g, ' ').trim() || 'none';
  }

  class FinalPerformanceQaPatchSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableFinalPerformanceQaPatch === false ? '0' : '1'), cfg.enableFinalPerformanceQaPatch !== false);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.blackFrame = readJson(`${STORAGE_PREFIX}:blackFrame`, { consecutive: 0, total: 0, lastBrightness: 255, lastReason: 'none' });
      this.lastSampleMs = 0;
      this.renderFrame = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'final performance QA patch loaded';
      this.metrics = this.defaultMetrics();
      this.repairStoredRendererState();
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
        releaseReady: false,
        rendererProfile: 'auto',
        rendererMode: 'canvas2d',
        activeLayers: 'none',
        blockedLayers: 'none',
        stableLockScore: 0,
        stableLockReady: false,
        polishScore: 0,
        postRcConfidence: 0,
        stableRcScore: 0,
        healthScore: 0,
        finalQaScore: 0,
        fallbackPressure: 0,
        hybridCostMs: 0,
        benchmarkState: 'missing',
        benchmarkOk: false,
        benchmarkAvgFps: 0,
        benchmarkP95FrameMs: 0,
        blackFrameGuard: 'ok',
        blackFrameConsecutive: 0,
        blackFrameBrightness: 255,
        canvasFallbackReady: true,
        webglReady: false,
        warnings: 'collecting samples',
        blockers: 'collecting samples',
        recommendation: 'Run F6 benchmark and test Hybrid Auto through combat, caves, camera rotation, and zoom.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    repairStoredRendererState() {
      const profile = String(safeGet(PROFILE_KEY, 'auto') || 'auto').toLowerCase();
      if (!['auto', 'hybrid', 'canvas'].includes(profile)) {
        safeSet(PROFILE_KEY, 'auto');
        this.lastAction = 'repaired renderer profile';
        this.lastReason = `invalid profile ${profile}`;
      }
      const rolloutPolicy = String(safeGet('dreamRealmsHybridDefaultRolloutPolicy', 'auto') || 'auto').toLowerCase();
      if (!['auto', 'hybrid', 'canvas'].includes(rolloutPolicy)) {
        safeSet('dreamRealmsHybridDefaultRolloutPolicy', 'auto');
        this.lastAction = 'repaired rollout policy';
        this.lastReason = `invalid rollout policy ${rolloutPolicy}`;
      }
    }

    collect() {
      const game = this.game;
      const perf = game?.perfStats || {};
      const cfg = this.settings();
      const stableLock = game?.getPerformanceStableReleaseLockSnapshot?.() || {};
      const polish = game?.getRendererReleasePolishSnapshot?.() || {};
      const postRc = game?.getPostReleaseCandidateHardeningSnapshot?.() || {};
      const stableRc = game?.getStableReleaseCandidateSnapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || {};
      const cleanup = game?.performanceSettingsCleanupSystem?.snapshot?.() || game?.ensurePerformanceSettingsCleanupSystem?.().snapshot?.() || {};
      const rollout = game?.getHybridDefaultRolloutSnapshot?.() || {};
      const qa = game?.getHybridRendererQaSnapshot?.() || {};
      const bench = benchmarkSnapshot(game, cfg);
      const rendererProfile = cleanup.rendererProfile || safeGet(PROFILE_KEY, 'auto') || 'auto';
      const rendererMode = game?.getRenderBackendMode?.() || cleanup.rendererMode || perf.renderBackendRendererMode || 'canvas2d';
      const activeLayers = layerMaskToText(rollout.layers || cleanup.activeLayers || perf.hybridDefaultRolloutLayers || perf.renderBackendHybridVisiblePromotedLayerMask || 'none');
      const blockedLayers = layerMaskToText(finalQa.blockedLayers || qa.heldOffLayers || cleanup.blockedLayers || perf.hybridFinalQaBlockedLayers || perf.hybridQaHeldOffLayers || 'none');
      const stableLockScore = clamp(stableLock.score ?? perf.performanceStableReleaseLockScore, 0, 100, 0);
      const polishScore = clamp(polish.score ?? perf.rendererReleasePolishScore, 0, 100, 0);
      const postRcConfidence = clamp(postRc.confidence ?? perf.postReleaseHardeningConfidence, 0, 100, 0);
      const stableRcScore = clamp(stableRc.score ?? perf.stableReleaseCandidateScore, 0, 100, 0);
      const healthScore = clamp(health.score ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0);
      const fallbackPressure = Math.max(
        num(stableLock.fallbackPressure, 0),
        num(polish.fallbackPressure, 0),
        num(postRc.fallbackPressure, 0),
        num(stableRc.fallbackPressure, 0),
        num(finalQa.fallbackPressure, 0),
        num(health.fallbackDelta, 0),
        num(perf.renderBackendHybridVisibleAggregateFallbacks, 0),
        num(perf.renderBackendWebglVisibleSpriteFallbacks, 0),
        num(perf.renderBackendWebglVisibleEffectFallbacks, 0),
        num(perf.renderBackendWebglVisibleDamageTextFallbacks, 0)
      );
      const hybridCostMs = Math.max(
        num(stableLock.hybridCostMs, 0),
        num(polish.hybridCostMs, 0),
        num(postRc.hybridCostMs, 0),
        num(stableRc.hybridCostMs, 0),
        num(finalQa.hybridCostMs, 0),
        num(health.hybridCostMs, 0),
        num(perf.renderBackendHybridVisibleFrameCostMs, 0),
        num(perf.renderBackendWebglVisibleSpriteDrawMs, 0) + num(perf.renderBackendWebglVisibleSpriteCompositeMs, 0)
      );
      const webglReady = !!(perf.renderBackendWebgl || perf.renderBackendWebgl2 || game?.ensureRenderBackendSystem?.().metrics?.webglReady);
      const canvasFallbackReady = rendererMode === 'canvas2d' || !!game?.setRendererPlayerProfile || !!game?.setRenderBackendMode;
      const blackGuardBad = this.blackFrame?.consecutive >= num(cfg.finalPerformanceBlackFrameConsecutiveLimit, 6);
      const minStableLock = num(cfg.finalPerformanceQaPatchMinStableLockScore, 88);
      const minHealth = num(cfg.finalPerformanceQaPatchMinHealthScore, 82);
      const minFinalQa = num(cfg.finalPerformanceQaPatchMinFinalQaScore, 84);
      const maxFallback = num(cfg.finalPerformanceQaPatchMaxFallbackPressure, 18);
      const maxHybridCost = num(cfg.finalPerformanceQaPatchMaxHybridCostMs, 11);
      const warnings = [];
      const blockers = [];
      if (!webglReady && rendererProfile !== 'canvas') warnings.push('WebGL not ready; Canvas fallback should own rendering');
      if (!canvasFallbackReady) blockers.push('Canvas fallback not confirmed');
      if (stableLockScore < minStableLock) warnings.push(`StableLock score ${Math.round(stableLockScore)} < ${minStableLock}`);
      if (healthScore < minHealth) warnings.push(`Hybrid health ${Math.round(healthScore)} < ${minHealth}`);
      if (finalQaScore < minFinalQa) warnings.push(`Final QA ${Math.round(finalQaScore)} < ${minFinalQa}`);
      if (fallbackPressure > maxFallback) warnings.push(`fallback pressure ${Math.round(fallbackPressure)} > ${maxFallback}`);
      if (hybridCostMs > maxHybridCost) warnings.push(`Hybrid cost ${hybridCostMs.toFixed(1)}ms > ${maxHybridCost}ms`);
      if (blockedLayers && blockedLayers !== 'none') warnings.push(`blocked layers: ${blockedLayers}`);
      if (blackGuardBad) blockers.push('black-frame guard tripped');
      if (cfg.finalPerformanceQaPatchRequireBenchmark === true && !bench.ok) blockers.push(bench.warning || 'benchmark required');
      else if (!bench.ok && bench.state !== 'missing') warnings.push(bench.warning);
      else if (bench.state === 'missing') warnings.push('benchmark evidence missing');

      let score = 100;
      score -= Math.max(0, minStableLock - stableLockScore) * 0.65;
      score -= Math.max(0, minHealth - healthScore) * 0.55;
      score -= Math.max(0, minFinalQa - finalQaScore) * 0.55;
      score -= Math.max(0, 88 - polishScore) * 0.25;
      score -= Math.max(0, 84 - postRcConfidence) * 0.22;
      score -= Math.max(0, 84 - stableRcScore) * 0.18;
      score -= Math.max(0, fallbackPressure - maxFallback) * 1.2;
      score -= Math.max(0, hybridCostMs - maxHybridCost) * 2.2;
      if (!bench.ok && bench.state === 'weak') score -= 8;
      if (!bench.ok && bench.state === 'missing') score -= 3;
      if (blockedLayers && blockedLayers !== 'none') score -= 7;
      if (!webglReady && rendererProfile !== 'canvas') score -= 8;
      if (blackGuardBad) score -= 35;
      if (!canvasFallbackReady) score -= 25;
      score = clamp(score, 0, 100, 0);
      const minScore = num(cfg.finalPerformanceQaPatchMinScore, 88);
      const releaseReady = this.enabled && !blockers.length && score >= minScore && stableLockScore >= minStableLock && healthScore >= minHealth && finalQaScore >= minFinalQa && fallbackPressure <= maxFallback && hybridCostMs <= maxHybridCost;
      const status = !this.enabled ? 'off' : blockers.length ? 'blocked' : releaseReady ? 'release-ready' : score >= 78 ? 'verify' : score >= 58 ? 'degraded' : 'unsafe';
      const recommendation = blockers.length
        ? `Fix blocker: ${blockers[0]}. Canvas Safe Mode remains the safe path.`
        : releaseReady
          ? 'Renderer/performance path is ready for release testing. Keep F3/F6 diagnostics available.'
          : warnings.length
            ? `Verify: ${warnings[0]}. Run F6 benchmark during real gameplay.`
            : 'Collect more gameplay samples in Auto/Hybrid and Canvas Safe Mode.';
      return {
        enabled: this.enabled,
        status,
        score,
        releaseReady,
        rendererProfile,
        rendererMode,
        activeLayers,
        blockedLayers,
        stableLockScore,
        stableLockReady: !!(stableLock.locked || stableLock.shipReady || perf.performanceStableReleaseLockLocked),
        polishScore,
        postRcConfidence,
        stableRcScore,
        healthScore,
        finalQaScore,
        fallbackPressure,
        hybridCostMs,
        benchmarkState: bench.state,
        benchmarkOk: !!bench.ok,
        benchmarkAvgFps: bench.avgFps,
        benchmarkP95FrameMs: bench.p95FrameMs,
        blackFrameGuard: blackGuardBad ? 'tripped' : (this.blackFrame?.consecutive ? 'watching' : 'ok'),
        blackFrameConsecutive: num(this.blackFrame?.consecutive, 0),
        blackFrameBrightness: num(this.blackFrame?.lastBrightness, 255),
        canvasFallbackReady,
        webglReady,
        warnings: warnings.join('; ') || 'none',
        blockers: blockers.join('; ') || 'none',
        recommendation,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: iso()
      };
    }

    sample(force = false) {
      if (!this.enabled && !force) return this.metrics;
      const cfg = this.settings();
      const at = nowMs();
      const interval = num(cfg.finalPerformanceQaPatchSampleMs, 650);
      if (!force && at - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = at;
      const sample = this.collect();
      const entry = {
        at: Date.now ? Date.now() : at,
        score: sample.score,
        status: sample.status,
        releaseReady: sample.releaseReady,
        fallbackPressure: sample.fallbackPressure,
        hybridCostMs: sample.hybridCostMs,
        stableLockScore: sample.stableLockScore,
        healthScore: sample.healthScore,
        finalQaScore: sample.finalQaScore,
        blackFrameGuard: sample.blackFrameGuard,
        blockers: sample.blockers
      };
      this.history.push(entry);
      const limit = Math.max(24, Math.floor(num(cfg.finalPerformanceQaPatchHistoryLimit, 180)));
      if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
      writeJson(`${STORAGE_PREFIX}:history`, this.history);
      sample.avgScore = avg(this.history, 'score');
      sample.minScore = min(this.history, 'score', sample.score);
      sample.sampleCount = this.history.length;
      this.metrics = sample;
      this.syncPerfStats();
      return this.metrics;
    }

    isHybridActive() {
      const profile = String(safeGet(PROFILE_KEY, 'auto') || 'auto').toLowerCase();
      const mode = this.game?.getRenderBackendMode?.() || this.game?.perfStats?.renderBackendRendererMode || 'canvas2d';
      return profile !== 'canvas' && String(mode) !== 'canvas2d';
    }

    sampleFrameLiveness() {
      const cfg = this.settings();
      if (cfg.enableFinalPerformanceBlackFrameGuard === false) return;
      this.renderFrame += 1;
      const cadence = Math.max(30, Math.floor(num(cfg.finalPerformanceBlackFrameProbeFrames, 90)));
      if (this.renderFrame % cadence !== 0) return;
      if (!this.isHybridActive()) {
        this.blackFrame.consecutive = 0;
        this.blackFrame.lastReason = 'hybrid inactive';
        return;
      }
      const canvas = this.game?.canvas || window.canvas || document.getElementById('game');
      const ctx = window.ctx || canvas?.getContext?.('2d');
      if (!canvas || !ctx || !canvas.width || !canvas.height || typeof ctx.getImageData !== 'function') return;
      const points = [
        [0.50, 0.50], [0.25, 0.28], [0.75, 0.28], [0.25, 0.72], [0.75, 0.72], [0.50, 0.22], [0.50, 0.78]
      ];
      let total = 0;
      let max = 0;
      let count = 0;
      try {
        for (const [px, py] of points) {
          const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * px)));
          const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * py)));
          const d = ctx.getImageData(x, y, 1, 1).data;
          const b = (d[0] + d[1] + d[2]) / 3;
          total += b;
          max = Math.max(max, b);
          count += 1;
        }
      } catch (_err) {
        return;
      }
      const avgBrightness = count ? total / count : 255;
      const maxLimit = num(cfg.finalPerformanceBlackFrameBrightnessMax, 7);
      const avgLimit = num(cfg.finalPerformanceBlackFrameBrightnessAvg, 3.5);
      const dark = max <= maxLimit && avgBrightness <= avgLimit;
      this.blackFrame.lastBrightness = avgBrightness;
      if (dark) {
        this.blackFrame.consecutive = num(this.blackFrame.consecutive, 0) + 1;
        this.blackFrame.total = num(this.blackFrame.total, 0) + 1;
        this.blackFrame.lastReason = `dark frame avg ${avgBrightness.toFixed(1)} max ${max.toFixed(1)}`;
      } else {
        this.blackFrame.consecutive = 0;
        this.blackFrame.lastReason = 'frame has visible luma';
      }
      writeJson(`${STORAGE_PREFIX}:blackFrame`, this.blackFrame);
      const limit = num(cfg.finalPerformanceBlackFrameConsecutiveLimit, 6);
      if (this.blackFrame.consecutive >= limit && cfg.finalPerformanceBlackFrameAutoCanvasFallback !== false) {
        this.forceCanvasFallback('black-frame guard');
      }
    }

    forceCanvasFallback(reason) {
      if (this._forcingCanvas) return;
      this._forcingCanvas = true;
      try {
        this.game?.setRendererPlayerProfile?.('canvas', reason);
        this.game?.setHybridDefaultRolloutPolicy?.('canvas', reason);
        this.game?.setRenderBackendMode?.('canvas2d', reason);
        safeSet(PROFILE_KEY, 'canvas');
        safeSet('dreamRealmsHybridDefaultRolloutPolicy', 'canvas');
        this.lastAction = 'forced Canvas Safe Mode';
        this.lastReason = reason;
        this.game?.logSystem?.(`Renderer fallback: Canvas Safe Mode (${reason}).`);
      } catch (_err) {
      } finally {
        this._forcingCanvas = false;
      }
    }

    syncPerfStats() {
      const perf = this.game.perfStats = this.game.perfStats || {};
      const s = this.metrics || this.defaultMetrics();
      perf.finalPerformanceQaPatchEnabled = !!this.enabled;
      perf.finalPerformanceQaPatchStatus = s.status || 'warming';
      perf.finalPerformanceQaPatchScore = num(s.score, 0);
      perf.finalPerformanceQaPatchAvgScore = num(s.avgScore, 0);
      perf.finalPerformanceQaPatchMinScore = num(s.minScore, 0);
      perf.finalPerformanceQaPatchSampleCount = num(s.sampleCount, 0);
      perf.finalPerformanceQaPatchReleaseReady = !!s.releaseReady;
      perf.finalPerformanceQaPatchWarnings = s.warnings || 'none';
      perf.finalPerformanceQaPatchBlockers = s.blockers || 'none';
      perf.finalPerformanceQaPatchBlackFrameGuard = s.blackFrameGuard || 'ok';
      perf.finalPerformanceQaPatchBlackFrameConsecutive = num(s.blackFrameConsecutive, 0);
      perf.finalPerformanceQaPatchRecommendation = s.recommendation || '';
      perf.finalPerformanceQaPatchLastAction = this.lastAction || '';
      perf.finalPerformanceQaPatchLastReason = this.lastReason || '';
    }

    setEnabled(enabled, reason = 'settings') {
      this.enabled = !!enabled;
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      this.lastAction = this.enabled ? 'enabled' : 'disabled';
      this.lastReason = reason;
      this.sample(true);
      return this.enabled;
    }

    clear(reason = 'settings clear') {
      this.history = [];
      this.blackFrame = { consecutive: 0, total: 0, lastBrightness: 255, lastReason: reason };
      safeRemove(`${STORAGE_PREFIX}:history`);
      safeRemove(`${STORAGE_PREFIX}:blackFrame`);
      this.lastAction = 'cleared samples';
      this.lastReason = reason;
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
      return true;
    }

    snapshot() {
      const m = this.sample(false) || this.metrics || this.defaultMetrics();
      return { ...m };
    }

    exportPayload() {
      const cfg = this.settings();
      const limit = Math.max(20, Math.floor(num(cfg.finalPerformanceQaPatchExportHistoryLimit, 120)));
      return {
        version: window.DREAM_REALMS_VERSION || '0.15.40',
        buildName: window.DREAM_REALMS_BUILD_NAME || '',
        exportedAt: iso(),
        snapshot: this.snapshot(),
        blackFrame: this.blackFrame,
        history: this.history.slice(-limit),
        stableLock: this.game?.getPerformanceStableReleaseLockSnapshot?.() || null,
        releasePolish: this.game?.getRendererReleasePolishSnapshot?.() || null,
        postReleaseHardening: this.game?.getPostReleaseCandidateHardeningSnapshot?.() || null,
        stableReleaseCandidate: this.game?.getStableReleaseCandidateSnapshot?.() || null,
        hybridHealth: this.game?.getHybridRolloutHealthSnapshot?.() || null,
        finalQa: this.game?.getHybridFinalQaSnapshot?.() || null,
        lastBenchmark: this.game?.performanceVerifier?.lastBenchmark || null
      };
    }

    summary() {
      const s = this.snapshot();
      return [
        `Dream Realms ${window.DREAM_REALMS_VERSION || ''} Final Performance QA Patch`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), release-ready: ${s.releaseReady ? 'yes' : 'no'}`,
        `Renderer: profile ${s.rendererProfile}, mode ${s.rendererMode}, layers ${s.activeLayers}`,
        `StableLock ${Math.round(s.stableLockScore || 0)}, Health ${Math.round(s.healthScore || 0)}, FinalQA ${Math.round(s.finalQaScore || 0)}`,
        `Fallback pressure ${Math.round(s.fallbackPressure || 0)}, Hybrid cost ${(s.hybridCostMs || 0).toFixed(1)}ms`,
        `Benchmark: ${s.benchmarkState}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        `Black-frame guard: ${s.blackFrameGuard}, consecutive ${s.blackFrameConsecutive}`,
        `Warnings: ${s.warnings}`,
        `Blockers: ${s.blockers}`,
        `Recommendation: ${s.recommendation}`
      ].join('\n');
    }
  }

  function settingsBlock(game) {
    const snap = game?.ensureFinalPerformanceQaPatchSystem?.().snapshot?.() || {};
    const statusColor = snap.releaseReady ? '#a6d15f' : (snap.status === 'blocked' || snap.status === 'unsafe' ? '#d4665a' : '#d6b35a');
    return `
      <div class="settingsSectionTitle">Final Performance QA Patch</div>
      <div class="small" style="margin-bottom:8px">Final renderer verification layer. It checks StableLock, Hybrid health, Final QA, benchmark evidence, fallback pressure, and black-frame safety.</div>
      <div class="settingsRow"><span>QA Patch</span><button class="toggleBtn ${snap.enabled ? 'active' : ''}" data-final-performance-qa-toggle="1">${snap.enabled ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Status</span><b style="color:${statusColor}">${esc(snap.status || 'warming')} · ${Math.round(num(snap.score, 0))}/100</b></div>
      <div class="settingsRow"><span>Release Ready</span><b>${snap.releaseReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Renderer</span><span>${esc(snap.rendererProfile || 'auto')} / ${esc(snap.rendererMode || 'canvas2d')}</span></div>
      <div class="settingsRow"><span>Layers</span><span>${esc(snap.activeLayers || 'none')}</span></div>
      <div class="settingsRow"><span>Blocked</span><span>${esc(snap.blockedLayers || 'none')}</span></div>
      <div class="settingsRow"><span>Fallback / Cost</span><span>${Math.round(num(snap.fallbackPressure, 0))} / ${num(snap.hybridCostMs, 0).toFixed(1)}ms</span></div>
      <div class="settingsRow"><span>Benchmark</span><span>${esc(snap.benchmarkState || 'missing')} · ${Math.round(num(snap.benchmarkAvgFps, 0))} FPS · p95 ${num(snap.benchmarkP95FrameMs, 0).toFixed(1)}ms</span></div>
      <div class="settingsRow"><span>Black-Frame Guard</span><span>${esc(snap.blackFrameGuard || 'ok')} · ${Math.round(num(snap.blackFrameBrightness, 255))} luma</span></div>
      <div class="small" style="margin-top:6px;color:#d6b35a">Warnings: ${esc(snap.warnings || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#d4665a">Blockers: ${esc(snap.blockers || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#9fb59c">${esc(snap.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px; flex-wrap:wrap">
        <button class="toggleBtn" data-final-performance-qa-benchmark="1">Run F6 Benchmark</button>
        <button class="toggleBtn" data-final-performance-qa-export="1">Export QA JSON</button>
        <button class="toggleBtn" data-final-performance-qa-copy="1">Copy QA Summary</button>
        <button class="toggleBtn" data-final-performance-qa-clear="1">Clear QA Samples</button>
        <button class="toggleBtn" data-final-performance-qa-canvas="1">Force Canvas Safe Mode</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drFinalPerformanceQaPatchInstalled) return;
    Game.prototype.__drFinalPerformanceQaPatchInstalled = true;

    Game.prototype.ensureFinalPerformanceQaPatchSystem = function() {
      if (!this.finalPerformanceQaPatchSystem) this.finalPerformanceQaPatchSystem = new FinalPerformanceQaPatchSystem(this);
      return this.finalPerformanceQaPatchSystem;
    };

    Game.prototype.getFinalPerformanceQaPatchSnapshot = function() {
      return this.ensureFinalPerformanceQaPatchSystem?.().snapshot?.() || null;
    };

    Game.prototype.toggleFinalPerformanceQaPatch = function() {
      const sys = this.ensureFinalPerformanceQaPatchSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Final Performance QA Patch: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('final performance qa patch');
      return enabled;
    };

    Game.prototype.clearFinalPerformanceQaPatch = function() {
      this.ensureFinalPerformanceQaPatchSystem?.().clear?.('settings clear');
      this.logSystem?.('Final performance QA samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('final performance qa clear');
      return true;
    };

    Game.prototype.forceFinalPerformanceCanvasSafeMode = function(reason = 'settings') {
      this.ensureFinalPerformanceQaPatchSystem?.().forceCanvasFallback?.(reason);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('final performance qa canvas fallback');
      return true;
    };

    Game.prototype.exportFinalPerformanceQaPatchJson = function() {
      const payload = this.ensureFinalPerformanceQaPatchSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.40'}-final-performance-qa.json`, payload);
      this.logSystem?.(ok ? 'Final performance QA JSON exported.' : 'Final performance QA JSON export failed.');
      return payload;
    };

    Game.prototype.copyFinalPerformanceQaPatchSummary = async function() {
      const text = this.ensureFinalPerformanceQaPatchSystem?.().summary?.() || 'Final performance QA unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Final performance QA summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };

    Game.prototype.runFinalPerformanceReleaseBenchmark = function(seconds = 60) {
      if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('final performance qa toggle');
      return this.startPerformanceBenchmark?.(seconds);
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drFinalPerformanceQaPatchWrapped) {
      const wrappedRender = function(...args) {
        const result = originalRender.apply(this, args);
        try {
          const sys = this.ensureFinalPerformanceQaPatchSystem?.();
          sys?.sampleFrameLiveness?.();
          sys?.sample?.(false);
        } catch (_err) {}
        return result;
      };
      wrappedRender.__drFinalPerformanceQaPatchWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalSettings = Game.prototype.renderSettingsPanel;
    if (typeof originalSettings === 'function' && !originalSettings.__drFinalPerformanceQaPatchWrapped) {
      const wrappedSettings = function(...args) {
        const result = originalSettings.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-final-performance-qa-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-final-performance-qa-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-final-performance-qa-toggle]')?.addEventListener('click', () => this.toggleFinalPerformanceQaPatch?.());
          list?.querySelector('[data-final-performance-qa-benchmark]')?.addEventListener('click', () => this.runFinalPerformanceReleaseBenchmark?.(60));
          list?.querySelector('[data-final-performance-qa-export]')?.addEventListener('click', () => this.exportFinalPerformanceQaPatchJson?.());
          list?.querySelector('[data-final-performance-qa-copy]')?.addEventListener('click', () => this.copyFinalPerformanceQaPatchSummary?.());
          list?.querySelector('[data-final-performance-qa-clear]')?.addEventListener('click', () => this.clearFinalPerformanceQaPatch?.());
          list?.querySelector('[data-final-performance-qa-canvas]')?.addEventListener('click', () => this.forceFinalPerformanceCanvasSafeMode?.('settings force'));
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'final-performance-qa-patch' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedSettings.__drFinalPerformanceQaPatchWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedSettings;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drFinalPerformanceQaPatchWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensureFinalPerformanceQaPatchSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('FinalPerfQA:')) return result;
          const line = `FinalPerfQA: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, ready ${snap.releaseReady ? 'yes' : 'no'}, bench ${snap.benchmarkState || 'missing'}, black ${snap.blackFrameGuard || 'ok'}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drFinalPerformanceQaPatchWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.FinalPerformanceQaPatchSystem = { install, FinalPerformanceQaPatchSystem };
})();
