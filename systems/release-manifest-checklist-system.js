// Dream Realms V0.15.41: Release manifest and benchmark checklist for shipping validation.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsReleaseManifestChecklist';

  function iso() {
    try { return new Date().toISOString(); } catch (_err) { return ''; }
  }

  function nowMs() {
    try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; }
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
    if (!last || last.active) return { state: 'missing', ok: false, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0, durationSec: 0 };
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const worstFrameMs = num(last.worstFrameMs, 0);
    const minFps = num(cfg.finalPerformanceQaPatchBenchmarkMinFps || cfg.releaseManifestBenchmarkMinFps, 45);
    const maxP95 = num(cfg.finalPerformanceQaPatchBenchmarkMaxP95Ms || cfg.releaseManifestBenchmarkMaxP95Ms, 30);
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

  class ReleaseManifestChecklistSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableReleaseManifestChecklist === false ? '0' : '1'), cfg.enableReleaseManifestChecklist !== false);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'release manifest checklist loaded';
      this.metrics = this.defaultMetrics();
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
        manifestReady: false,
        rendererProfile: 'auto',
        rendererMode: 'canvas2d',
        activeLayers: 'none',
        blockedLayers: 'none',
        stableLockScore: 0,
        stableLockReady: false,
        finalPerfQaScore: 0,
        finalPerfQaReady: false,
        healthScore: 0,
        finalQaScore: 0,
        polishScore: 0,
        postRcConfidence: 0,
        rcScore: 0,
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
        blockers: 'collecting samples',
        warnings: 'collecting samples',
        recommendation: 'Run the F6 benchmark, test Hybrid Auto and Canvas Safe Mode, then export this manifest.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    collect() {
      const game = this.game;
      const cfg = this.settings();
      const perf = game?.perfStats || {};
      const stable = game?.getPerformanceStableReleaseLockSnapshot?.() || game?.performanceStableReleaseLockSystem?.snapshot?.() || {};
      const finalPerf = game?.getFinalPerformanceQaPatchSnapshot?.() || game?.finalPerformanceQaPatchSystem?.snapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || game?.hybridRolloutHealthSystem?.snapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || game?.hybridFinalQaSystem?.snapshot?.() || {};
      const polish = game?.getRendererReleasePolishSnapshot?.() || game?.rendererReleasePolishSystem?.snapshot?.() || {};
      const postRc = game?.getPostReleaseCandidateHardeningSnapshot?.() || game?.postReleaseCandidateHardeningSystem?.snapshot?.() || {};
      const rc = game?.getStableReleaseCandidateSnapshot?.() || game?.stableReleaseCandidateSystem?.snapshot?.() || {};
      const backend = game?.renderBackend?.snapshot?.() || game?.renderBackend?.metrics || {};
      const benchmark = readBenchmark(game, cfg);

      const rendererProfile = safeGet('dreamRealmsRendererPlayerProfile', stable.rendererProfile || 'auto') || 'auto';
      const rendererMode = String(perf.renderBackendMode || stable.rendererMode || backend.mode || 'canvas2d');
      const activeLayers = layerText(stable.activeLayers || finalPerf.activeLayers || perf.hybridVisibleLayerMask || perf.hybridDefaultCandidateActiveLayers || 'none');
      const blockedLayers = layerText(stable.blockedLayers || finalPerf.blockedLayers || finalQa.blockedLayers || perf.hybridFinalQaBlockedLayers || 'none');

      const stableLockScore = clamp(stable.score ?? perf.performanceStableReleaseLockScore, 0, 100, 0);
      const finalPerfQaScore = clamp(finalPerf.score ?? perf.finalPerformanceQaPatchScore, 0, 100, 0);
      const healthScore = clamp(health.score ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0);
      const polishScore = clamp(polish.score ?? perf.rendererReleasePolishScore, 0, 100, 0);
      const postRcConfidence = clamp(postRc.confidence ?? postRc.score ?? perf.postReleaseCandidateConfidence, 0, 100, 0);
      const rcScore = clamp(rc.score ?? perf.stableReleaseCandidateScore, 0, 100, 0);
      const fallbackPressure = Math.max(
        num(stable.fallbackPressure, 0),
        num(finalPerf.fallbackPressure, 0),
        num(polish.fallbackPressure, 0),
        num(perf.hybridFallbackPressure, 0),
        num(perf.hybridQaFallbackPressure, 0)
      );
      const hybridCostMs = Math.max(
        num(stable.hybridCostMs, 0),
        num(finalPerf.hybridCostMs, 0),
        num(polish.hybridCostMs, 0),
        num(perf.hybridVisibleFrameCostMs, 0),
        num(perf.renderBackendFrameDrawMs, 0)
      );

      const webglReady = !!(
        stable.webglReady || finalPerf.webglReady || backend.webglReady || backend.webgl2Ready || perf.renderBackendWebglReady || perf.renderBackendWebgl2Ready
      );
      const canvasFallbackReady = stable.canvasFallbackReady !== false && finalPerf.canvasFallbackReady !== false;

      const checks = [
        { id: 'stable-lock', label: 'Stable release lock score', ok: stableLockScore >= num(cfg.releaseManifestMinStableLockScore, 88), detail: `${Math.round(stableLockScore)}/100` },
        { id: 'final-performance-qa', label: 'Final performance QA score', ok: finalPerfQaScore >= num(cfg.releaseManifestMinFinalPerfQaScore, 86), detail: `${Math.round(finalPerfQaScore)}/100` },
        { id: 'hybrid-health', label: 'Hybrid rollout health score', ok: healthScore >= num(cfg.releaseManifestMinHealthScore, 82) || rendererMode === 'canvas2d', detail: `${Math.round(healthScore)}/100` },
        { id: 'final-renderer-qa', label: 'Hybrid final QA score', ok: finalQaScore >= num(cfg.releaseManifestMinFinalQaScore, 84) || rendererMode === 'canvas2d', detail: `${Math.round(finalQaScore)}/100` },
        { id: 'fallback-pressure', label: 'Fallback pressure', ok: fallbackPressure <= num(cfg.releaseManifestMaxFallbackPressure, 18), detail: `${Math.round(fallbackPressure)}` },
        { id: 'hybrid-cost', label: 'Hybrid frame cost', ok: hybridCostMs <= num(cfg.releaseManifestMaxHybridCostMs, 11.0), detail: `${hybridCostMs.toFixed(1)}ms` },
        { id: 'canvas-safe-mode', label: 'Canvas Safe Mode fallback', ok: canvasFallbackReady, detail: canvasFallbackReady ? 'ready' : 'missing' },
        { id: 'webgl-or-canvas', label: 'Renderer path available', ok: rendererMode === 'canvas2d' || webglReady, detail: rendererMode === 'canvas2d' ? 'canvas' : (webglReady ? 'webgl' : 'webgl missing') },
        { id: 'benchmark', label: 'Release benchmark evidence', ok: benchmark.ok || cfg.releaseManifestRequireBenchmark !== true, detail: benchmark.state }
      ];

      const passed = checks.filter(c => c.ok).length;
      const requiredFailures = checks.filter(c => !c.ok && c.id !== 'benchmark').map(c => `${c.label}: ${c.detail}`);
      if (cfg.releaseManifestRequireBenchmark === true && !benchmark.ok) requiredFailures.push(`Benchmark: ${benchmark.state}`);
      const warnings = checks.filter(c => !c.ok && c.id === 'benchmark').map(c => `${c.label}: ${c.detail}`);

      let score = Math.round(
        stableLockScore * 0.20 +
        finalPerfQaScore * 0.18 +
        healthScore * 0.14 +
        finalQaScore * 0.14 +
        polishScore * 0.10 +
        postRcConfidence * 0.08 +
        rcScore * 0.08 +
        Math.max(0, 100 - fallbackPressure * 3) * 0.04 +
        Math.max(0, 100 - hybridCostMs * 5) * 0.04
      );
      if (!canvasFallbackReady) score -= 20;
      if (rendererMode !== 'canvas2d' && !webglReady) score -= 20;
      if (requiredFailures.length) score -= Math.min(20, requiredFailures.length * 5);
      score = clamp(score, 0, 100, 0);

      const shipReady = requiredFailures.length === 0 && score >= 88;
      const manifestReady = shipReady && (benchmark.ok || cfg.releaseManifestRequireBenchmark !== true);
      const status = manifestReady ? 'manifest-ready' : (shipReady ? 'benchmark-warning' : (score >= 76 ? 'needs-review' : 'blocked'));
      const recommendation = manifestReady
        ? 'Renderer/performance manifest is ready. Export JSON/text and run a final gameplay smoke test before packaging.'
        : (requiredFailures.length
          ? 'Resolve listed blockers or force Canvas Safe Mode for affected hardware before release.'
          : 'Run F6 benchmark and complete gameplay smoke test to finalize the release manifest.');

      return {
        enabled: this.enabled,
        status,
        score,
        avgScore: 0,
        minScore: 0,
        sampleCount: 0,
        shipReady,
        manifestReady,
        rendererProfile,
        rendererMode,
        activeLayers,
        blockedLayers,
        stableLockScore,
        stableLockReady: !!stable.locked || !!stable.shipReady || stableLockScore >= 88,
        finalPerfQaScore,
        finalPerfQaReady: !!finalPerf.releaseReady || finalPerfQaScore >= 86,
        healthScore,
        finalQaScore,
        polishScore,
        postRcConfidence,
        rcScore,
        fallbackPressure,
        hybridCostMs,
        webglReady,
        canvasFallbackReady,
        benchmarkState: benchmark.state,
        benchmarkOk: !!benchmark.ok,
        benchmarkAvgFps: benchmark.avgFps,
        benchmarkP95FrameMs: benchmark.p95FrameMs,
        benchmarkWorstFrameMs: benchmark.worstFrameMs,
        checklist: checks,
        checklistPassed: passed,
        checklistTotal: checks.length,
        blockers: requiredFailures.join('; ') || 'none',
        warnings: warnings.join('; ') || (benchmark.ok ? 'none' : 'benchmark not completed'),
        recommendation,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: iso()
      };
    }

    sample(force = false) {
      if (!this.enabled && !force) return this.metrics;
      const cfg = this.settings();
      const now = nowMs();
      const interval = num(cfg.releaseManifestSampleMs, 1200);
      if (!force && this.lastSampleMs && now - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = now;
      const metrics = this.collect();
      this.history.push({
        at: metrics.lastSampleIso,
        score: metrics.score,
        status: metrics.status,
        shipReady: metrics.shipReady,
        manifestReady: metrics.manifestReady,
        rendererMode: metrics.rendererMode,
        fallbackPressure: metrics.fallbackPressure,
        hybridCostMs: metrics.hybridCostMs,
        benchmarkState: metrics.benchmarkState,
        blockers: metrics.blockers
      });
      const limit = Math.max(12, num(cfg.releaseManifestHistoryLimit, 90));
      if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
      metrics.avgScore = avg(this.history, 'score');
      metrics.minScore = min(this.history, 'score', metrics.score);
      metrics.sampleCount = this.history.length;
      this.metrics = metrics;
      writeJson(`${STORAGE_PREFIX}:history`, this.history);
      this.syncPerfStats();
      return this.metrics;
    }

    snapshot() {
      return this.sample(false) || this.metrics || this.defaultMetrics();
    }

    setEnabled(enabled, reason = 'settings') {
      this.enabled = !!enabled;
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      this.lastAction = this.enabled ? 'enabled' : 'disabled';
      this.lastReason = reason;
      this.sample(true);
      return this.enabled;
    }

    clear(reason = 'settings') {
      this.history = [];
      safeRemove(`${STORAGE_PREFIX}:history`);
      this.lastAction = 'cleared';
      this.lastReason = reason;
      this.metrics = this.defaultMetrics();
      this.sample(true);
      return true;
    }

    exportPayload() {
      const snap = this.sample(true) || this.metrics;
      const game = this.game;
      return {
        kind: 'dream-realms-release-manifest-checklist',
        version: window.DREAM_REALMS_VERSION || '0.15.41',
        buildName: window.DREAM_REALMS_BUILD_NAME || '',
        exportedAt: iso(),
        userAgent: navigator.userAgent || '',
        viewport: { width: window.innerWidth || 0, height: window.innerHeight || 0, dpr: window.devicePixelRatio || 1 },
        checklist: snap.checklist || [],
        summary: {
          status: snap.status,
          score: snap.score,
          avgScore: snap.avgScore,
          minScore: snap.minScore,
          sampleCount: snap.sampleCount,
          shipReady: snap.shipReady,
          manifestReady: snap.manifestReady,
          blockers: snap.blockers,
          warnings: snap.warnings,
          recommendation: snap.recommendation
        },
        renderer: {
          profile: snap.rendererProfile,
          mode: snap.rendererMode,
          activeLayers: snap.activeLayers,
          blockedLayers: snap.blockedLayers,
          webglReady: snap.webglReady,
          canvasFallbackReady: snap.canvasFallbackReady,
          fallbackPressure: snap.fallbackPressure,
          hybridCostMs: snap.hybridCostMs
        },
        scores: {
          stableLock: snap.stableLockScore,
          finalPerformanceQa: snap.finalPerfQaScore,
          hybridHealth: snap.healthScore,
          finalQa: snap.finalQaScore,
          releasePolish: snap.polishScore,
          postRcConfidence: snap.postRcConfidence,
          stableRc: snap.rcScore
        },
        benchmark: {
          state: snap.benchmarkState,
          ok: snap.benchmarkOk,
          avgFps: snap.benchmarkAvgFps,
          p95FrameMs: snap.benchmarkP95FrameMs,
          worstFrameMs: snap.benchmarkWorstFrameMs
        },
        perfStats: Object.assign({}, game?.perfStats || {}),
        history: this.history.slice(-Math.min(this.history.length, 60))
      };
    }

    textManifest() {
      const p = this.exportPayload();
      const lines = [
        `${p.buildName}`,
        `Version: ${p.version}`,
        `Exported: ${p.exportedAt}`,
        '',
        `Release Manifest Status: ${p.summary.status} (${Math.round(p.summary.score || 0)}/100)`,
        `Ship Ready: ${p.summary.shipReady ? 'Yes' : 'No'}`,
        `Manifest Ready: ${p.summary.manifestReady ? 'Yes' : 'No'}`,
        `Renderer: ${p.renderer.profile} / ${p.renderer.mode}`,
        `Active Layers: ${p.renderer.activeLayers}`,
        `Blocked Layers: ${p.renderer.blockedLayers}`,
        `WebGL Ready: ${p.renderer.webglReady ? 'Yes' : 'No'}`,
        `Canvas Fallback: ${p.renderer.canvasFallbackReady ? 'Ready' : 'Missing'}`,
        `Fallback Pressure: ${Math.round(p.renderer.fallbackPressure || 0)}`,
        `Hybrid Cost: ${(p.renderer.hybridCostMs || 0).toFixed(1)}ms`,
        `Benchmark: ${p.benchmark.state}, FPS ${Math.round(p.benchmark.avgFps || 0)}, p95 ${(p.benchmark.p95FrameMs || 0).toFixed(1)}ms`,
        '',
        'Checklist:'
      ];
      for (const check of p.checklist || []) lines.push(`- ${check.ok ? '[PASS]' : '[FAIL]'} ${check.label}: ${check.detail}`);
      lines.push('', `Warnings: ${p.summary.warnings || 'none'}`, `Blockers: ${p.summary.blockers || 'none'}`, `Recommendation: ${p.summary.recommendation || ''}`);
      return lines.join('\n');
    }

    summary() {
      const s = this.sample(true) || this.metrics;
      return [
        `Release Manifest Checklist — ${window.DREAM_REALMS_BUILD_NAME || ''}`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), ship-ready ${s.shipReady ? 'yes' : 'no'}, manifest-ready ${s.manifestReady ? 'yes' : 'no'}`,
        `Renderer: ${s.rendererProfile} / ${s.rendererMode}, layers ${s.activeLayers}, blocked ${s.blockedLayers}`,
        `Scores: StableLock ${Math.round(s.stableLockScore || 0)}, FinalPerfQA ${Math.round(s.finalPerfQaScore || 0)}, Health ${Math.round(s.healthScore || 0)}, FinalQA ${Math.round(s.finalQaScore || 0)}`,
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
      perf.releaseManifestChecklistEnabled = !!this.enabled;
      perf.releaseManifestChecklistScore = num(s.score, 0);
      perf.releaseManifestChecklistStatus = s.status || 'warming';
      perf.releaseManifestChecklistShipReady = !!s.shipReady;
      perf.releaseManifestChecklistManifestReady = !!s.manifestReady;
      perf.releaseManifestChecklistPassed = num(s.checklistPassed, 0);
      perf.releaseManifestChecklistTotal = num(s.checklistTotal, 0);
      perf.releaseManifestChecklistBlockers = s.blockers || 'none';
      perf.releaseManifestChecklistWarnings = s.warnings || 'none';
      perf.releaseManifestChecklistRecommendation = s.recommendation || '';
    }
  }

  function settingsBlock(game) {
    const snap = game?.ensureReleaseManifestChecklistSystem?.().snapshot?.() || {};
    const color = snap.manifestReady ? '#a6d15f' : (snap.status === 'blocked' ? '#d4665a' : '#d6b35a');
    const checks = (snap.checklist || []).map(c => `<div class="small" style="margin:2px 0;color:${c.ok ? '#a6d15f' : '#d4665a'}">${c.ok ? 'PASS' : 'FAIL'} · ${esc(c.label)}: ${esc(c.detail)}</div>`).join('');
    return `
      <div class="settingsSectionTitle">Release Manifest Checklist</div>
      <div class="small" style="margin-bottom:8px">Final export/checklist layer for the renderer/performance release. This does not change gameplay; it verifies the already-locked renderer stack.</div>
      <div class="settingsRow"><span>Manifest Checklist</span><button class="toggleBtn ${snap.enabled ? 'active' : ''}" data-release-manifest-toggle="1">${snap.enabled ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Status</span><b style="color:${color}">${esc(snap.status || 'warming')} · ${Math.round(num(snap.score, 0))}/100</b></div>
      <div class="settingsRow"><span>Checklist</span><span>${Math.round(num(snap.checklistPassed, 0))}/${Math.round(num(snap.checklistTotal, 0))} passed</span></div>
      <div class="settingsRow"><span>Ship Ready</span><b>${snap.shipReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Manifest Ready</span><b>${snap.manifestReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Renderer</span><span>${esc(snap.rendererProfile || 'auto')} / ${esc(snap.rendererMode || 'canvas2d')}</span></div>
      <div class="settingsRow"><span>Layers</span><span>${esc(snap.activeLayers || 'none')}</span></div>
      <div class="settingsRow"><span>Benchmark</span><span>${esc(snap.benchmarkState || 'missing')} · ${Math.round(num(snap.benchmarkAvgFps, 0))} FPS · p95 ${num(snap.benchmarkP95FrameMs, 0).toFixed(1)}ms</span></div>
      <div style="margin:6px 0 8px">${checks}</div>
      <div class="small" style="margin-top:4px;color:#d6b35a">Warnings: ${esc(snap.warnings || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#d4665a">Blockers: ${esc(snap.blockers || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#9fb59c">${esc(snap.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px; flex-wrap:wrap">
        <button class="toggleBtn" data-release-manifest-benchmark="1">Run F6 Benchmark</button>
        <button class="toggleBtn" data-release-manifest-export-json="1">Export Manifest JSON</button>
        <button class="toggleBtn" data-release-manifest-export-text="1">Export Manifest TXT</button>
        <button class="toggleBtn" data-release-manifest-copy="1">Copy Summary</button>
        <button class="toggleBtn" data-release-manifest-clear="1">Clear Manifest Samples</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drReleaseManifestChecklistInstalled) return;
    Game.prototype.__drReleaseManifestChecklistInstalled = true;

    Game.prototype.ensureReleaseManifestChecklistSystem = function() {
      if (!this.releaseManifestChecklistSystem) this.releaseManifestChecklistSystem = new ReleaseManifestChecklistSystem(this);
      return this.releaseManifestChecklistSystem;
    };

    Game.prototype.getReleaseManifestChecklistSnapshot = function() {
      return this.ensureReleaseManifestChecklistSystem?.().snapshot?.() || null;
    };

    Game.prototype.toggleReleaseManifestChecklist = function() {
      const sys = this.ensureReleaseManifestChecklistSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Release manifest checklist: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('release manifest checklist');
      return enabled;
    };

    Game.prototype.clearReleaseManifestChecklist = function() {
      this.ensureReleaseManifestChecklistSystem?.().clear?.('settings clear');
      this.logSystem?.('Release manifest checklist samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('release manifest clear');
      return true;
    };

    Game.prototype.exportReleaseManifestChecklistJson = function() {
      const payload = this.ensureReleaseManifestChecklistSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.41'}-release-manifest.json`, payload);
      this.logSystem?.(ok ? 'Release manifest JSON exported.' : 'Release manifest JSON export failed.');
      return payload;
    };

    Game.prototype.exportReleaseManifestChecklistText = function() {
      const text = this.ensureReleaseManifestChecklistSystem?.().textManifest?.() || '';
      const ok = downloadText(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.41'}-release-manifest.txt`, text, 'text/plain');
      this.logSystem?.(ok ? 'Release manifest TXT exported.' : 'Release manifest TXT export failed.');
      return text;
    };

    Game.prototype.copyReleaseManifestChecklistSummary = async function() {
      const text = this.ensureReleaseManifestChecklistSystem?.().summary?.() || 'Release manifest unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Release manifest summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };

    Game.prototype.runReleaseManifestBenchmark = function(seconds = 60) {
      if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('release manifest toggle');
      return this.startPerformanceBenchmark?.(seconds);
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drReleaseManifestChecklistWrapped) {
      const wrappedRender = function(...args) {
        const result = originalRender.apply(this, args);
        try { this.ensureReleaseManifestChecklistSystem?.().sample?.(false); } catch (_err) {}
        return result;
      };
      wrappedRender.__drReleaseManifestChecklistWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalSettings = Game.prototype.renderSettingsPanel;
    if (typeof originalSettings === 'function' && !originalSettings.__drReleaseManifestChecklistWrapped) {
      const wrappedSettings = function(...args) {
        const result = originalSettings.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-release-manifest-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-release-manifest-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-release-manifest-toggle]')?.addEventListener('click', () => this.toggleReleaseManifestChecklist?.());
          list?.querySelector('[data-release-manifest-benchmark]')?.addEventListener('click', () => this.runReleaseManifestBenchmark?.(60));
          list?.querySelector('[data-release-manifest-export-json]')?.addEventListener('click', () => this.exportReleaseManifestChecklistJson?.());
          list?.querySelector('[data-release-manifest-export-text]')?.addEventListener('click', () => this.exportReleaseManifestChecklistText?.());
          list?.querySelector('[data-release-manifest-copy]')?.addEventListener('click', () => this.copyReleaseManifestChecklistSummary?.());
          list?.querySelector('[data-release-manifest-clear]')?.addEventListener('click', () => this.clearReleaseManifestChecklist?.());
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'release-manifest-checklist' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedSettings.__drReleaseManifestChecklistWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedSettings;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drReleaseManifestChecklistWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensureReleaseManifestChecklistSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('ReleaseManifest:')) return result;
          const line = `ReleaseManifest: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, checklist ${snap.checklistPassed || 0}/${snap.checklistTotal || 0}, ship ${snap.shipReady ? 'yes' : 'no'}, bench ${snap.benchmarkState || 'missing'}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drReleaseManifestChecklistWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.ReleaseManifestChecklistSystem = { install, ReleaseManifestChecklistSystem };
})();
