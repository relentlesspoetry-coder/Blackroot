// Dream Realms V0.15.42: Final ship cleanup and release-facing renderer validation.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsFinalShipCleanup';
  const SAFE_PROFILES = new Set(['auto', 'hybrid', 'canvas']);
  const SAFE_POLICIES = new Set(['auto', 'hybrid', 'canvas']);

  function iso() {
    try { return new Date().toISOString(); } catch (_err) { return ''; }
  }

  function nowMs() {
    try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; }
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function bool(value, fallback = false) {
    if (value === true || value === '1' || value === 'true' || value === 1) return true;
    if (value === false || value === '0' || value === 'false' || value === 0) return false;
    return !!fallback;
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

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function downloadText(filename, text, type = 'text/plain') {
    try {
      const blob = new Blob([String(text == null ? '' : text)], { type });
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
      try { navigator.clipboard?.writeText?.(String(text == null ? '' : text)); return true; } catch (__err) { return false; }
    }
  }

  function downloadJson(filename, payload) {
    return downloadText(filename, JSON.stringify(payload || {}, null, 2), 'application/json');
  }

  function readBenchmark(game, cfg) {
    const active = game?.performanceVerifier?.benchmark || null;
    const last = game?.performanceVerifier?.lastBenchmark || null;
    if (active?.active) return { state: 'running', ok: false, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0, durationSec: 0 };
    if (!last || last.active) return { state: 'missing', ok: !cfg.finalShipCleanupRequireBenchmark, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0, durationSec: 0 };
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const worstFrameMs = num(last.worstFrameMs, 0);
    const minFps = num(cfg.finalPerformanceQaPatchBenchmarkMinFps || 45, 45);
    const maxP95 = num(cfg.finalPerformanceQaPatchBenchmarkMaxP95Ms || 30, 30);
    const ok = avgFps >= minFps && (p95FrameMs <= 0 || p95FrameMs <= maxP95);
    return {
      state: ok ? 'accepted' : 'weak',
      ok,
      avgFps,
      p95FrameMs,
      worstFrameMs,
      durationSec: num(last.durationSec ?? last.elapsedSec, 0),
      startedAtIso: last.startedAtIso || '',
      finishedAtIso: last.finishedAtIso || ''
    };
  }

  function layerText(value) {
    if (!value) return 'none';
    return String(value).replace(/[|,]+/g, ', ').replace(/\s+/g, ' ').trim() || 'none';
  }

  class FinalShipCleanupSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableFinalShipCleanup === false ? '0' : '1'), cfg.enableFinalShipCleanup !== false);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'final ship cleanup loaded';
      this.metrics = this.defaultMetrics();
      this.repairStorage('boot');
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
        shipReady: false,
        finalLocked: false,
        rendererStable: false,
        rendererProfile: 'auto',
        rendererPolicy: 'auto',
        rendererMode: 'canvas2d',
        activeLayers: 'none',
        blockedLayers: 'none',
        stableLockScore: 0,
        manifestScore: 0,
        finalPerfQaScore: 0,
        healthScore: 0,
        finalQaScore: 0,
        fallbackPressure: 0,
        hybridCostMs: 0,
        webglReady: false,
        canvasFallbackReady: true,
        benchmarkState: 'missing',
        benchmarkOk: false,
        benchmarkAvgFps: 0,
        benchmarkP95FrameMs: 0,
        checklistPassed: 0,
        checklistTotal: 0,
        storageRepairs: 0,
        blockers: 'collecting samples',
        warnings: 'collecting samples',
        recommendation: 'Run one final F6 benchmark and export the Final Ship Report before packaging.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    repairStorage(reason = 'repair') {
      let repairs = 0;
      const profile = safeGet('dreamRealmsRendererPlayerProfile', 'auto');
      if (!SAFE_PROFILES.has(profile)) { safeSet('dreamRealmsRendererPlayerProfile', 'auto'); repairs++; }
      const rolloutPolicy = safeGet('dreamRealmsHybridDefaultRollout:policy', safeGet('dreamRealmsHybridDefaultRolloutPolicy', 'auto'));
      if (rolloutPolicy && !SAFE_POLICIES.has(rolloutPolicy)) {
        safeSet('dreamRealmsHybridDefaultRollout:policy', 'auto');
        safeSet('dreamRealmsHybridDefaultRolloutPolicy', 'auto');
        repairs++;
      }
      for (const key of ['dreamRealmsRendererRollbackUntil', 'dreamRealmsHybridDefaultRollout:rollbackUntil', 'dreamRealmsPostRcCanvasLockUntil']) {
        const raw = safeGet(key, '');
        if (raw && !Number.isFinite(Number(raw)) && !/^\d{4}-\d{2}-\d{2}T/.test(raw)) { safeRemove(key); repairs++; }
      }
      if (repairs) {
        this.lastAction = 'storage repair';
        this.lastReason = `${repairs} renderer storage value(s) repaired during ${reason}`;
      }
      this.metrics.storageRepairs = num(this.metrics.storageRepairs, 0) + repairs;
      return repairs;
    }

    collect() {
      const game = this.game;
      const cfg = this.settings();
      const perf = game?.perfStats || {};
      const stable = game?.getPerformanceStableReleaseLockSnapshot?.() || game?.performanceStableReleaseLockSystem?.snapshot?.() || {};
      const manifest = game?.getReleaseManifestChecklistSnapshot?.() || game?.releaseManifestChecklistSystem?.snapshot?.() || {};
      const finalPerf = game?.getFinalPerformanceQaPatchSnapshot?.() || game?.finalPerformanceQaPatchSystem?.snapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || game?.hybridRolloutHealthSystem?.snapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || game?.hybridFinalQaSystem?.snapshot?.() || {};
      const backend = game?.renderBackend?.snapshot?.() || game?.renderBackend?.metrics || {};
      const benchmark = readBenchmark(game, cfg);

      const rendererProfile = safeGet('dreamRealmsRendererPlayerProfile', stable.rendererProfile || 'auto') || 'auto';
      const rendererPolicy = safeGet('dreamRealmsHybridDefaultRollout:policy', stable.rendererPolicy || 'auto') || 'auto';
      const rendererMode = game?.renderBackendMode || perf.renderBackendMode || backend.mode || stable.rendererMode || 'canvas2d';
      const activeLayers = layerText(stable.activeLayers || manifest.activeLayers || perf.hybridDefaultCandidateActiveLayers || perf.webglVisibleLayerMask || 'none');
      const blockedLayers = layerText(finalQa.blockedLayers || stable.disabledLayers || manifest.blockedLayers || 'none');
      const stableLockScore = clamp(stable.score ?? perf.performanceStableReleaseLockScore, 0, 100, 0);
      const manifestScore = clamp(manifest.score ?? perf.releaseManifestChecklistScore, 0, 100, 0);
      const finalPerfQaScore = clamp(finalPerf.score ?? perf.finalPerformanceQaPatchScore, 0, 100, 0);
      const healthScore = clamp(health.healthScore ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0);
      const fallbackPressure = clamp(
        stable.fallbackPressure ?? manifest.fallbackPressure ?? finalPerf.fallbackPressure ?? perf.hybridRolloutFallbackPressure,
        0, 999, 0
      );
      const hybridCostMs = clamp(
        stable.hybridCostMs ?? manifest.hybridCostMs ?? finalPerf.hybridCostMs ?? perf.hybridVisibleFrameCostMs,
        0, 999, 0
      );
      const webglReady = bool(backend.webglReady ?? backend.webgl2Ready ?? perf.renderBackendWebglReady, false);
      const canvasFallbackReady = bool(stable.canvasFallbackReady ?? manifest.canvasFallbackReady, true);

      const checks = [
        { id: 'profile', label: 'Renderer profile', ok: rendererProfile === 'auto' || rendererProfile === 'hybrid' || rendererProfile === 'canvas', detail: rendererProfile },
        { id: 'canvas', label: 'Canvas fallback', ok: canvasFallbackReady, detail: canvasFallbackReady ? 'ready' : 'missing' },
        { id: 'stableLock', label: 'Stable lock score', ok: stableLockScore >= num(cfg.finalShipCleanupMinStableLockScore, 88), detail: `${Math.round(stableLockScore)}/100` },
        { id: 'manifest', label: 'Release manifest score', ok: manifestScore >= num(cfg.finalShipCleanupMinManifestScore, 88), detail: `${Math.round(manifestScore)}/100` },
        { id: 'finalPerf', label: 'Final performance QA', ok: finalPerfQaScore >= num(cfg.finalShipCleanupMinFinalPerfQaScore, 86), detail: `${Math.round(finalPerfQaScore)}/100` },
        { id: 'fallback', label: 'Fallback pressure', ok: fallbackPressure <= num(cfg.finalShipCleanupMaxFallbackPressure, 18), detail: `${Math.round(fallbackPressure)}` },
        { id: 'cost', label: 'Hybrid frame cost', ok: hybridCostMs <= num(cfg.finalShipCleanupMaxHybridCostMs, 11.0), detail: `${hybridCostMs.toFixed(1)}ms` },
        { id: 'benchmark', label: 'Benchmark evidence', ok: benchmark.ok || !cfg.finalShipCleanupRequireBenchmark, detail: `${benchmark.state}, ${Math.round(benchmark.avgFps || 0)} FPS, p95 ${(benchmark.p95FrameMs || 0).toFixed(1)}ms` },
        { id: 'webgl', label: 'WebGL path', ok: webglReady || rendererProfile === 'canvas', detail: webglReady ? 'available' : 'not available, Canvas fallback required' }
      ];
      const passed = checks.reduce((sum, c) => sum + (c.ok ? 1 : 0), 0);
      const total = checks.length;

      let score = 100;
      score -= Math.max(0, num(cfg.finalShipCleanupMinStableLockScore, 88) - stableLockScore) * 0.9;
      score -= Math.max(0, num(cfg.finalShipCleanupMinManifestScore, 88) - manifestScore) * 0.8;
      score -= Math.max(0, num(cfg.finalShipCleanupMinFinalPerfQaScore, 86) - finalPerfQaScore) * 0.8;
      score -= Math.max(0, fallbackPressure - num(cfg.finalShipCleanupMaxFallbackPressure, 18)) * 1.5;
      score -= Math.max(0, hybridCostMs - num(cfg.finalShipCleanupMaxHybridCostMs, 11.0)) * 2.0;
      if (!canvasFallbackReady) score -= 25;
      if (!webglReady && rendererProfile !== 'canvas') score -= 8;
      if (!benchmark.ok && cfg.finalShipCleanupRequireBenchmark) score -= 14;
      score = clamp(score, 0, 100, 0);

      const sample = {
        t: nowMs(),
        iso: iso(),
        score,
        status: 'warming',
        rendererProfile,
        rendererPolicy,
        rendererMode,
        activeLayers,
        blockedLayers,
        stableLockScore,
        manifestScore,
        finalPerfQaScore,
        healthScore,
        finalQaScore,
        fallbackPressure,
        hybridCostMs,
        webglReady,
        canvasFallbackReady,
        benchmarkState: benchmark.state,
        benchmarkOk: benchmark.ok,
        benchmarkAvgFps: benchmark.avgFps,
        benchmarkP95FrameMs: benchmark.p95FrameMs,
        benchmarkWorstFrameMs: benchmark.worstFrameMs,
        checklistPassed: passed,
        checklistTotal: total,
        checks
      };

      const failures = checks.filter(c => !c.ok);
      const warnings = [];
      if (!benchmark.ok) warnings.push(`benchmark ${benchmark.state}`);
      if (!webglReady && rendererProfile !== 'canvas') warnings.push('WebGL unavailable; Canvas fallback will be used');
      if (blockedLayers !== 'none') warnings.push(`blocked layers ${blockedLayers}`);
      if (fallbackPressure > 0) warnings.push(`fallback pressure ${Math.round(fallbackPressure)}`);

      const enoughSamples = this.history.length + 1 >= 3;
      const minScore = num(cfg.finalShipCleanupMinScore, 90);
      const shipReady = enoughSamples && score >= minScore && passed === total && canvasFallbackReady;
      const finalLocked = shipReady || (stableLockScore >= num(cfg.finalShipCleanupMinStableLockScore, 88) && manifestScore >= num(cfg.finalShipCleanupMinManifestScore, 88));
      const rendererStable = shipReady || (score >= 84 && fallbackPressure <= num(cfg.finalShipCleanupMaxFallbackPressure, 18) && hybridCostMs <= num(cfg.finalShipCleanupMaxHybridCostMs, 11.0));
      sample.shipReady = shipReady;
      sample.finalLocked = finalLocked;
      sample.rendererStable = rendererStable;
      sample.status = shipReady ? 'ship-ready' : (score >= minScore ? 'verify-benchmark' : (score >= 74 ? 'watch' : 'blocked'));
      sample.blockers = failures.length ? failures.map(c => `${c.label}: ${c.detail}`).join('; ') : 'none';
      sample.warnings = warnings.length ? warnings.join('; ') : 'none';
      sample.recommendation = shipReady
        ? 'Performance renderer stack is final-ship ready. Keep Auto renderer and Canvas Safe Mode available.'
        : (failures.length ? 'Resolve failed checks or run a clean F6 benchmark before shipping.' : 'Collect a few more stable samples, then export the Final Ship Report.');
      sample.storageRepairs = num(this.metrics.storageRepairs, 0);
      return sample;
    }

    sample(force = false) {
      if (!this.enabled && !force) return this.metrics;
      const interval = num(this.settings().finalShipCleanupSampleMs, 1200);
      const t = nowMs();
      if (!force && this.lastSampleMs && t - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = t;
      const sample = this.collect();
      const limit = Math.max(10, Math.floor(num(this.settings().finalShipCleanupHistoryLimit, 120)));
      this.history.push(sample);
      if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
      writeJson(`${STORAGE_PREFIX}:history`, this.history.slice(-limit));
      const scores = this.history.map(h => h.score);
      sample.avgScore = avg(scores);
      sample.minScore = min(scores, undefined, sample.score);
      sample.sampleCount = this.history.length;
      sample.lastAction = this.lastAction;
      sample.lastReason = this.lastReason;
      sample.lastSampleIso = sample.iso;
      this.metrics = sample;
      this.syncPerfStats();
      return sample;
    }

    snapshot() {
      return Object.assign({}, this.sample(false) || this.metrics, {
        history: this.history.slice(-Math.min(this.history.length, 24))
      });
    }

    setEnabled(enabled, reason = 'settings') {
      this.enabled = !!enabled;
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      this.lastAction = this.enabled ? 'enabled' : 'disabled';
      this.lastReason = reason;
      this.metrics.enabled = this.enabled;
      this.syncPerfStats();
      return this.enabled;
    }

    clear(reason = 'settings') {
      this.history = [];
      writeJson(`${STORAGE_PREFIX}:history`, []);
      this.lastAction = 'history cleared';
      this.lastReason = reason;
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
      return true;
    }

    clearSafetyState(reason = 'settings') {
      const keys = [
        'dreamRealmsRendererRollbackUntil',
        'dreamRealmsHybridDefaultRollout:rollbackUntil',
        'dreamRealmsPostRcCanvasLockUntil',
        'dreamRealmsPerformanceStableReleaseLock:history',
        'dreamRealmsFinalPerformanceQaPatch:history'
      ];
      for (const key of keys) safeRemove(key);
      this.lastAction = 'safety state cleared';
      this.lastReason = reason;
      this.repairStorage(reason);
      this.game?.clearHybridRendererQaHoldoffs?.(reason);
      this.game?.clearHybridFinalQaLayerBlocks?.(reason);
      this.game?.ensureHybridDefaultCandidateSystem?.().clearDisabledLayers?.(reason);
      this.game?.renderSettingsPanel?.();
      this.game?.markUiDirty?.('final ship cleanup clear safety');
      return true;
    }

    exportPayload() {
      const snap = this.sample(true) || this.metrics;
      return {
        game: 'Dream Realms',
        version: window.DREAM_REALMS_VERSION || '0.15.42',
        buildName: window.DREAM_REALMS_BUILD_NAME || 'Dream Realms V0.15.42 Final Ship Cleanup',
        exportedAt: iso(),
        finalShip: Object.assign({}, snap, { history: undefined }),
        checklist: snap.checks || [],
        perfStats: Object.assign({}, this.game?.perfStats || {}),
        releaseManifest: this.game?.getReleaseManifestChecklistSnapshot?.() || null,
        stableLock: this.game?.getPerformanceStableReleaseLockSnapshot?.() || null,
        finalPerformanceQa: this.game?.getFinalPerformanceQaPatchSnapshot?.() || null,
        history: this.history.slice(-Math.min(this.history.length, num(this.settings().finalShipCleanupExportHistoryLimit, 120)))
      };
    }

    textReport() {
      const payload = this.exportPayload();
      const s = payload.finalShip || {};
      const lines = [
        `${payload.buildName}`,
        `Version: ${payload.version}`,
        `Exported: ${payload.exportedAt}`,
        '',
        `Final Ship Status: ${s.status || 'warming'} (${Math.round(s.score || 0)}/100)`,
        `Ship Ready: ${s.shipReady ? 'Yes' : 'No'}`,
        `Renderer Stable: ${s.rendererStable ? 'Yes' : 'No'}`,
        `Renderer: ${s.rendererProfile || 'auto'} / ${s.rendererMode || 'canvas2d'}`,
        `Policy: ${s.rendererPolicy || 'auto'}`,
        `Active Layers: ${s.activeLayers || 'none'}`,
        `Blocked Layers: ${s.blockedLayers || 'none'}`,
        `Canvas Fallback: ${s.canvasFallbackReady ? 'Ready' : 'Missing'}`,
        `WebGL: ${s.webglReady ? 'Ready' : 'Unavailable'}`,
        `Fallback Pressure: ${Math.round(s.fallbackPressure || 0)}`,
        `Hybrid Cost: ${(s.hybridCostMs || 0).toFixed(1)}ms`,
        `Benchmark: ${s.benchmarkState || 'missing'}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        '',
        'Checklist:'
      ];
      for (const check of payload.checklist || []) lines.push(`- ${check.ok ? '[PASS]' : '[FAIL]'} ${check.label}: ${check.detail}`);
      lines.push('', `Warnings: ${s.warnings || 'none'}`, `Blockers: ${s.blockers || 'none'}`, `Recommendation: ${s.recommendation || ''}`);
      return lines.join('\n');
    }

    summary() {
      const s = this.sample(true) || this.metrics;
      return [
        `Final Ship Cleanup — ${window.DREAM_REALMS_BUILD_NAME || ''}`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), ship-ready ${s.shipReady ? 'yes' : 'no'}, renderer-stable ${s.rendererStable ? 'yes' : 'no'}`,
        `Renderer: ${s.rendererProfile} / ${s.rendererMode}, policy ${s.rendererPolicy}, layers ${s.activeLayers}, blocked ${s.blockedLayers}`,
        `Scores: StableLock ${Math.round(s.stableLockScore || 0)}, Manifest ${Math.round(s.manifestScore || 0)}, FinalPerfQA ${Math.round(s.finalPerfQaScore || 0)}, Health ${Math.round(s.healthScore || 0)}, FinalQA ${Math.round(s.finalQaScore || 0)}`,
        `Fallback/cost: ${Math.round(s.fallbackPressure || 0)} / ${(s.hybridCostMs || 0).toFixed(1)}ms`,
        `Benchmark: ${s.benchmarkState}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        `Checklist: ${s.checklistPassed || 0}/${s.checklistTotal || 0}`,
        `Warnings: ${s.warnings}`,
        `Blockers: ${s.blockers}`,
        `Recommendation: ${s.recommendation}`
      ].join('\n');
    }

    syncPerfStats() {
      const perf = this.game.perfStats = this.game.perfStats || {};
      const s = this.metrics || this.defaultMetrics();
      perf.finalShipCleanupEnabled = !!this.enabled;
      perf.finalShipCleanupScore = num(s.score, 0);
      perf.finalShipCleanupStatus = s.status || 'warming';
      perf.finalShipCleanupReady = !!s.shipReady;
      perf.finalShipCleanupRendererStable = !!s.rendererStable;
      perf.finalShipCleanupChecklistPassed = num(s.checklistPassed, 0);
      perf.finalShipCleanupChecklistTotal = num(s.checklistTotal, 0);
      perf.finalShipCleanupBlockers = s.blockers || 'none';
      perf.finalShipCleanupWarnings = s.warnings || 'none';
      perf.finalShipCleanupRecommendation = s.recommendation || '';
      perf.finalShipCleanupStorageRepairs = num(s.storageRepairs, 0);
    }
  }

  function settingsBlock(game) {
    const snap = game?.ensureFinalShipCleanupSystem?.().snapshot?.() || {};
    const color = snap.shipReady ? '#a6d15f' : (snap.status === 'blocked' ? '#d4665a' : '#d6b35a');
    const checks = (snap.checks || []).map(c => `<div class="small" style="margin:2px 0;color:${c.ok ? '#a6d15f' : '#d4665a'}">${c.ok ? 'PASS' : 'FAIL'} · ${esc(c.label)}: ${esc(c.detail)}</div>`).join('');
    return `
      <div class="settingsSectionTitle">Final Ship Cleanup</div>
      <div class="small" style="margin-bottom:8px">Release-facing validation for the finalized renderer/performance stack. Hybrid GPU remains Auto-default when healthy; Canvas Safe Mode remains the hard fallback.</div>
      <div class="settingsRow"><span>Final Ship Gate</span><button class="toggleBtn ${snap.enabled ? 'active' : ''}" data-final-ship-toggle="1">${snap.enabled ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Status</span><b style="color:${color}">${esc(snap.status || 'warming')} · ${Math.round(num(snap.score, 0))}/100</b></div>
      <div class="settingsRow"><span>Ship Ready</span><b>${snap.shipReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Renderer Stable</span><b>${snap.rendererStable ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Renderer</span><span>${esc(snap.rendererProfile || 'auto')} / ${esc(snap.rendererMode || 'canvas2d')}</span></div>
      <div class="settingsRow"><span>Layers</span><span>${esc(snap.activeLayers || 'none')} · blocked ${esc(snap.blockedLayers || 'none')}</span></div>
      <div class="settingsRow"><span>Benchmark</span><span>${esc(snap.benchmarkState || 'missing')} · ${Math.round(num(snap.benchmarkAvgFps, 0))} FPS · p95 ${num(snap.benchmarkP95FrameMs, 0).toFixed(1)}ms</span></div>
      <div class="settingsRow"><span>Checklist</span><span>${Math.round(num(snap.checklistPassed, 0))}/${Math.round(num(snap.checklistTotal, 0))} passed</span></div>
      <div style="margin:6px 0 8px">${checks}</div>
      <div class="small" style="margin-top:4px;color:#d6b35a">Warnings: ${esc(snap.warnings || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#d4665a">Blockers: ${esc(snap.blockers || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#9fb59c">${esc(snap.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px; flex-wrap:wrap">
        <button class="toggleBtn" data-final-ship-benchmark="1">Run F6 Benchmark</button>
        <button class="toggleBtn" data-final-ship-export-json="1">Export Ship JSON</button>
        <button class="toggleBtn" data-final-ship-export-text="1">Export Ship TXT</button>
        <button class="toggleBtn" data-final-ship-copy="1">Copy Summary</button>
        <button class="toggleBtn" data-final-ship-clear="1">Clear Ship Samples</button>
        <button class="toggleBtn" data-final-ship-clear-safety="1">Clear Renderer Safety State</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drFinalShipCleanupInstalled) return;
    Game.prototype.__drFinalShipCleanupInstalled = true;

    Game.prototype.ensureFinalShipCleanupSystem = function() {
      if (!this.finalShipCleanupSystem) this.finalShipCleanupSystem = new FinalShipCleanupSystem(this);
      return this.finalShipCleanupSystem;
    };

    Game.prototype.getFinalShipCleanupSnapshot = function() {
      return this.ensureFinalShipCleanupSystem?.().snapshot?.() || null;
    };

    Game.prototype.toggleFinalShipCleanup = function() {
      const sys = this.ensureFinalShipCleanupSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Final ship cleanup: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('final ship cleanup');
      return enabled;
    };

    Game.prototype.clearFinalShipCleanup = function() {
      this.ensureFinalShipCleanupSystem?.().clear?.('settings clear');
      this.logSystem?.('Final ship cleanup samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('final ship cleanup clear');
      return true;
    };

    Game.prototype.clearFinalShipRendererSafetyState = function() {
      this.ensureFinalShipCleanupSystem?.().clearSafetyState?.('settings clear safety');
      this.logSystem?.('Renderer safety state cleared.');
      return true;
    };

    Game.prototype.exportFinalShipCleanupJson = function() {
      const payload = this.ensureFinalShipCleanupSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.42'}-final-ship-report.json`, payload);
      this.logSystem?.(ok ? 'Final ship JSON exported.' : 'Final ship JSON export failed.');
      return payload;
    };

    Game.prototype.exportFinalShipCleanupText = function() {
      const text = this.ensureFinalShipCleanupSystem?.().textReport?.() || '';
      const ok = downloadText(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.42'}-final-ship-report.txt`, text, 'text/plain');
      this.logSystem?.(ok ? 'Final ship TXT exported.' : 'Final ship TXT export failed.');
      return text;
    };

    Game.prototype.copyFinalShipCleanupSummary = async function() {
      const text = this.ensureFinalShipCleanupSystem?.().summary?.() || 'Final ship summary unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Final ship summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };

    Game.prototype.runFinalShipBenchmark = function(seconds = 60) {
      if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('final ship toggle');
      return this.startPerformanceBenchmark?.(seconds);
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drFinalShipCleanupWrapped) {
      const wrappedRender = function(...args) {
        const result = originalRender.apply(this, args);
        try { this.ensureFinalShipCleanupSystem?.().sample?.(false); } catch (_err) {}
        return result;
      };
      wrappedRender.__drFinalShipCleanupWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalSettings = Game.prototype.renderSettingsPanel;
    if (typeof originalSettings === 'function' && !originalSettings.__drFinalShipCleanupWrapped) {
      const wrappedSettings = function(...args) {
        const result = originalSettings.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-final-ship-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-final-ship-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-final-ship-toggle]')?.addEventListener('click', () => this.toggleFinalShipCleanup?.());
          list?.querySelector('[data-final-ship-benchmark]')?.addEventListener('click', () => this.runFinalShipBenchmark?.(60));
          list?.querySelector('[data-final-ship-export-json]')?.addEventListener('click', () => this.exportFinalShipCleanupJson?.());
          list?.querySelector('[data-final-ship-export-text]')?.addEventListener('click', () => this.exportFinalShipCleanupText?.());
          list?.querySelector('[data-final-ship-copy]')?.addEventListener('click', () => this.copyFinalShipCleanupSummary?.());
          list?.querySelector('[data-final-ship-clear]')?.addEventListener('click', () => this.clearFinalShipCleanup?.());
          list?.querySelector('[data-final-ship-clear-safety]')?.addEventListener('click', () => this.clearFinalShipRendererSafetyState?.());
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'final-ship-cleanup' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedSettings.__drFinalShipCleanupWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedSettings;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drFinalShipCleanupWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensureFinalShipCleanupSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('FinalShip:')) return result;
          const line = `FinalShip: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, ready ${snap.shipReady ? 'yes' : 'no'}, renderer ${snap.rendererProfile || 'auto'}/${snap.rendererMode || 'canvas2d'}, bench ${snap.benchmarkState || 'missing'}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drFinalShipCleanupWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.FinalShipCleanupSystem = { install, FinalShipCleanupSystem };
})();
