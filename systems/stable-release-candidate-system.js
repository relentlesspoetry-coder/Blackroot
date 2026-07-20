// Dream Realms V0.15.36: Stable release-candidate gate for the Hybrid renderer rollout.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsStableReleaseCandidate';

  function nowMs() {
    try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; }
  }

  function wallIso() {
    try { return new Date().toISOString(); } catch (_err) { return ''; }
  }

  function safeGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_err) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_err) {}
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_err) {}
  }

  function toBool(value, fallback = false) {
    if (value === true || value === false) return value;
    if (value == null) return fallback;
    const raw = String(value).trim().toLowerCase();
    if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
    if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
    return fallback;
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max, fallback = 0) {
    const n = num(value, fallback);
    return Math.max(min, Math.min(max, n));
  }

  function esc(value) {
    const str = String(value == null ? '' : value);
    return str.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
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
      setTimeout(() => URL.revokeObjectURL(url), 500);
      return true;
    } catch (_err) {
      return false;
    }
  }

  const CHECKS = Object.freeze([
    { id: 'rendererProfile', label: 'Renderer profile' },
    { id: 'webgl', label: 'WebGL availability' },
    { id: 'rollout', label: 'Hybrid rollout' },
    { id: 'health', label: 'Hybrid health' },
    { id: 'finalQa', label: 'Final QA gate' },
    { id: 'fallback', label: 'Fallback pressure' },
    { id: 'frameCost', label: 'Hybrid frame cost' },
    { id: 'layers', label: 'Promoted layers' },
    { id: 'benchmark', label: 'Benchmark evidence' },
    { id: 'compatibility', label: 'Canvas compatibility path' }
  ]);

  const RELEASE_LAYERS = Object.freeze(['terrain', 'sprites', 'effects', 'damage']);

  class StableReleaseCandidateSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = toBool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableStableReleaseCandidateGate === false ? '0' : '1'), cfg.enableStableReleaseCandidateGate !== false);
      this.releaseArmed = toBool(safeGet(`${STORAGE_PREFIX}:armed`, cfg.stableReleaseCandidateArmedDefault === false ? '0' : '1'), cfg.stableReleaseCandidateArmedDefault !== false);
      this.history = [];
      this.lastSampleMs = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'stable release-candidate gate loaded';
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        releaseArmed: this.releaseArmed,
        status: 'warming',
        score: 0,
        avgScore: 0,
        minScore: 0,
        sampleCount: 0,
        releaseReady: false,
        checksPassed: 0,
        checksTotal: CHECKS.length,
        blockers: 'collecting samples',
        warnings: 'none',
        recommendation: 'Collect release-candidate samples during normal gameplay.',
        layerMask: 'none',
        rollbackActive: false,
        compatibilityMode: false,
        healthScore: 0,
        finalQaScore: 0,
        finalQaReady: false,
        fallbackPressure: 0,
        hybridCostMs: 0,
        frameMs: 0,
        renderMs: 0,
        updateMs: 0,
        uiMs: 0,
        webglReady: false,
        benchmarkStatus: 'none',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    setEnabled(enabled, reason = 'settings') {
      this.enabled = !!enabled;
      this.lastAction = this.enabled ? 'gate enabled' : 'gate disabled';
      this.lastReason = reason;
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      this.syncPerfStats();
      return this.enabled;
    }

    setReleaseArmed(armed, reason = 'settings') {
      this.releaseArmed = !!armed;
      this.lastAction = this.releaseArmed ? 'release gate armed' : 'release gate disarmed';
      this.lastReason = reason;
      safeSet(`${STORAGE_PREFIX}:armed`, this.releaseArmed ? '1' : '0');
      this.syncPerfStats();
      return this.releaseArmed;
    }

    reset(reason = 'settings reset') {
      this.history.length = 0;
      this.metrics = this.defaultMetrics();
      this.lastAction = 'history cleared';
      this.lastReason = reason;
      safeRemove(`${STORAGE_PREFIX}:lastReadyIso`);
      this.syncPerfStats();
      return true;
    }

    layerMask(perf, rollout) {
      const rolloutLayers = String(rollout?.layers || '').trim();
      if (rolloutLayers && rolloutLayers !== 'none') return rolloutLayers;
      const parts = [];
      if (perf.renderBackendWebglVisibleTerrainLayerActive) parts.push('terrain');
      if (perf.renderBackendWebglVisibleSpriteLayerActive) parts.push('sprites');
      if (perf.renderBackendWebglVisibleEffectLayerActive) parts.push('effects');
      if (perf.renderBackendWebglVisibleDamageTextLayerActive) parts.push('damage');
      return parts.join(',') || 'none';
    }

    collect() {
      const game = this.game;
      const perf = game?.perfStats || {};
      const cleanup = game?.ensurePerformanceSettingsCleanupSystem?.().snapshot?.() || {};
      const health = game?.getHybridRolloutHealthSnapshot?.() || {};
      const finalQa = game?.getHybridFinalQaSnapshot?.() || {};
      const rollout = game?.getHybridDefaultRolloutSnapshot?.() || {};
      const candidate = game?.getHybridDefaultCandidateSnapshot?.() || {};
      const qa = game?.getHybridRendererQaSnapshot?.() || {};
      const backend = game?.ensureRenderBackendSystem?.();
      const bench = game?.performanceVerifier?.lastBenchmark || null;
      const cfg = this.settings();
      const layerMask = this.layerMask(perf, rollout);
      const promotedLayers = layerMask === 'none' ? [] : layerMask.split(',').map(s => s.trim()).filter(Boolean);
      const requiredLayers = RELEASE_LAYERS.filter(layer => cfg[`stableReleaseCandidateRequire_${layer}`] !== false);
      const missingLayers = requiredLayers.filter(layer => !promotedLayers.includes(layer));
      return {
        perf,
        cleanup,
        health,
        finalQa,
        rollout,
        candidate,
        qa,
        backendMetrics: backend?.metrics || {},
        benchmark: bench,
        cfg,
        layerMask,
        promotedLayers,
        requiredLayers,
        missingLayers
      };
    }

    evaluate() {
      const data = this.collect();
      const { perf, cleanup, health, finalQa, rollout, candidate, qa, backendMetrics, benchmark, cfg, layerMask, missingLayers } = data;
      const checks = {};
      const blockers = [];
      const warnings = [];
      const targetHealth = clamp(cfg.stableReleaseCandidateHealthScore || 84, 0, 100, 84);
      const targetFinalQa = clamp(cfg.stableReleaseCandidateFinalQaScore || 86, 0, 100, 86);
      const targetFinalQaAvg = clamp(cfg.stableReleaseCandidateFinalQaAvgScore || 88, 0, 100, 88);
      const maxFallback = Math.max(0, num(cfg.stableReleaseCandidateMaxFallbackPressure || 18, 18));
      const maxCost = Math.max(1, num(cfg.stableReleaseCandidateMaxHybridCostMs || 10.5, 10.5));
      const minSamples = Math.max(1, Math.floor(num(cfg.stableReleaseCandidateMinSamples || 90, 90)));
      const requireBenchmark = cfg.stableReleaseCandidateRequireBenchmark === true;
      const webglReady = !!(perf.webglPrototypeReady || perf.renderBackendWebglPrototypeReady || backendMetrics.webglPrototypeReady);
      const rendererProfile = cleanup.rendererProfile || 'auto';
      const rendererMode = cleanup.rendererMode || backendMetrics.rendererMode || perf.renderBackendRendererMode || 'canvas2d';
      const healthScore = clamp(health.score ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0);
      const finalQaAvg = clamp(finalQa.avgScore ?? perf.hybridFinalQaAvgScore, 0, 100, 0);
      const finalQaSamples = Math.max(0, Math.floor(num(finalQa.sampleCount ?? perf.hybridFinalQaSamples, 0)));
      const fallbackPressure = Math.max(
        num(finalQa.fallbackPressure ?? perf.hybridFinalQaFallbackPressure, 0),
        num(health.fallbackDelta ?? perf.hybridRolloutHealthFallbackDelta, 0),
        num(candidate.frameFallbacks ?? perf.hybridDefaultCandidateFallbacks, 0)
      );
      const hybridCostMs = Math.max(
        num(finalQa.hybridCostMs ?? perf.hybridFinalQaHybridCostMs, 0),
        num(health.hybridCostMs ?? perf.hybridRolloutHealthHybridCostMs, 0),
        num(candidate.frameCostMs ?? perf.hybridDefaultCandidateCostMs, 0)
      );
      const rollbackActive = !!(rollout.rollbackActive || perf.hybridDefaultRolloutRollbackActive);
      const compatibilityMode = !!(candidate.compatibilityMode || cleanup.rendererProfile === 'canvas' || rollout.policy === 'canvas');
      const contextLost = !!(perf.renderBackendWebglContextLost || backendMetrics.webglContextLost);
      const rendererDenied = !!(perf.renderBackendModeDenied || backendMetrics.renderBackendModeDenied);
      const qaHoldoff = !!(qa.heldOffLayers && qa.heldOffLayers !== 'none') || !!(perf.hybridQaHeldOffLayers && perf.hybridQaHeldOffLayers !== 'none');
      const finalQaBlock = !!(finalQa.blockActive || perf.hybridFinalQaBlockActive);
      const benchmarkOk = !requireBenchmark || !!(benchmark && !benchmark.active && (benchmark.avgFps || benchmark.averageFps || benchmark.avgFrameMs || benchmark.p95FrameMs));

      checks.rendererProfile = rendererProfile !== 'canvas' && rendererMode !== 'canvas2d';
      checks.webgl = webglReady && !contextLost && !rendererDenied;
      checks.rollout = !rollbackActive && !compatibilityMode && (rollout.policy === 'auto' || rollout.policy === 'hybrid' || !rollout.policy);
      checks.health = healthScore >= targetHealth;
      checks.finalQa = finalQaScore >= targetFinalQa && finalQaAvg >= targetFinalQaAvg && finalQaSamples >= minSamples && !finalQaBlock;
      checks.fallback = fallbackPressure <= maxFallback && !qaHoldoff;
      checks.frameCost = hybridCostMs <= maxCost;
      checks.layers = missingLayers.length === 0;
      checks.benchmark = benchmarkOk;
      checks.compatibility = true;

      if (!checks.rendererProfile) blockers.push(`renderer is ${rendererProfile}/${rendererMode}`);
      if (!checks.webgl) blockers.push(contextLost ? 'WebGL context lost' : rendererDenied ? 'renderer denied' : 'WebGL unavailable');
      if (!checks.rollout) blockers.push(rollbackActive ? 'rollout rollback active' : compatibilityMode ? 'Canvas compatibility mode active' : 'rollout not active');
      if (!checks.health) blockers.push(`health ${Math.round(healthScore)}/${targetHealth}`);
      if (!checks.finalQa) blockers.push(`Final QA ${Math.round(finalQaScore)}/${targetFinalQa}, avg ${Math.round(finalQaAvg)}/${targetFinalQaAvg}, samples ${finalQaSamples}/${minSamples}${finalQaBlock ? ', blocked' : ''}`);
      if (!checks.fallback) blockers.push(qaHoldoff ? 'QA layer holdoff active' : `fallback pressure ${fallbackPressure}/${maxFallback}`);
      if (!checks.frameCost) blockers.push(`Hybrid cost ${hybridCostMs.toFixed(1)}ms/${maxCost.toFixed(1)}ms`);
      if (!checks.layers) blockers.push(`missing promoted layer(s): ${missingLayers.join(', ')}`);
      if (!checks.benchmark) warnings.push('no completed release benchmark');
      if (cleanup.lowSpecMode) warnings.push('Low-Spec mode active');
      if (perf.adaptiveLevelName && String(perf.adaptiveLevelName).toLowerCase() === 'rescue') warnings.push('adaptive governor in rescue mode');

      const passed = Object.values(checks).filter(Boolean).length;
      const hardBlockers = blockers.length;
      let score = Math.round((passed / CHECKS.length) * 100);
      score = Math.min(score, Math.round((healthScore + finalQaScore + finalQaAvg) / 3));
      score -= Math.min(30, hardBlockers * 8);
      score -= Math.min(12, Math.max(0, fallbackPressure - maxFallback));
      score -= Math.min(12, Math.max(0, hybridCostMs - maxCost) * 2);
      score = clamp(score, 0, 100, 0);

      const releaseReady = this.enabled && this.releaseArmed && score >= clamp(cfg.stableReleaseCandidateMinScore || 90, 0, 100, 90) && hardBlockers === 0;
      let status = 'warming';
      if (!this.enabled) status = 'disabled';
      else if (!this.releaseArmed) status = 'disarmed';
      else if (releaseReady) status = 'release-ready';
      else if (score >= 82) status = 'candidate';
      else if (score >= 64) status = 'needs-qa';
      else if (score >= 42) status = 'unstable';
      else status = 'blocked';

      const recommendation = releaseReady
        ? 'Release candidate ready: Hybrid can remain default with Canvas fallback preserved.'
        : blockers.length
          ? `Not release-ready: fix ${blockers.slice(0, 2).join('; ')}.`
          : warnings.length
            ? `Candidate with warnings: ${warnings.slice(0, 2).join('; ')}.`
            : 'Collect more samples during combat, caves, camera rotation, and zone traversal.';

      return {
        enabled: this.enabled,
        releaseArmed: this.releaseArmed,
        status,
        score,
        checks,
        checksPassed: passed,
        checksTotal: CHECKS.length,
        releaseReady,
        blockers: blockers.join('; ') || 'none',
        warnings: warnings.join('; ') || 'none',
        recommendation,
        rendererProfile,
        rendererMode,
        webglReady,
        layerMask,
        missingLayers: missingLayers.join(',') || 'none',
        rollbackActive,
        compatibilityMode,
        healthScore,
        healthStatus: health.status || perf.hybridRolloutHealthStatus || 'pending',
        finalQaScore,
        finalQaAvg,
        finalQaStatus: finalQa.status || perf.hybridFinalQaStatus || 'pending',
        finalQaSamples,
        finalQaReady: !!(finalQa.releaseCandidateReady || perf.hybridFinalQaReleaseCandidateReady),
        fallbackPressure,
        hybridCostMs,
        frameMs: num(perf.frameMs || perf.lastFrameMs, 0),
        renderMs: num(perf.renderMs || perf.lastRenderMs, 0),
        updateMs: num(perf.updateMs || perf.lastUpdateMs, 0),
        uiMs: num(perf.uiUpdateMs, 0),
        benchmarkStatus: benchmark ? (benchmark.active ? 'running' : 'complete') : 'none',
        lastBenchmark: benchmark || null,
        qaHoldoff,
        finalQaBlock,
        contextLost,
        rendererDenied,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: wallIso()
      };
    }

    sample(force = false) {
      if (!this.enabled && !force) return this.metrics;
      const cfg = this.settings();
      const interval = Math.max(250, num(cfg.stableReleaseCandidateSampleMs || 500, 500));
      const t = nowMs();
      if (!force && this.lastSampleMs && t - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = t;
      const snap = this.evaluate();
      this.history.push(snap);
      const max = Math.max(20, Math.floor(num(cfg.stableReleaseCandidateHistoryLimit || 180, 180)));
      while (this.history.length > max) this.history.shift();
      const scores = this.history.map(s => num(s.score, 0));
      snap.sampleCount = this.history.length;
      snap.avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : snap.score;
      snap.minScore = scores.length ? Math.min(...scores) : snap.score;
      if (snap.releaseReady) safeSet(`${STORAGE_PREFIX}:lastReadyIso`, snap.lastSampleIso);
      this.metrics = snap;
      this.syncPerfStats();
      return snap;
    }

    snapshot() {
      this.sample(false);
      return Object.assign({}, this.metrics, {
        historyLength: this.history.length,
        lastReadyIso: safeGet(`${STORAGE_PREFIX}:lastReadyIso`, '') || ''
      });
    }

    summary() {
      const s = this.snapshot();
      return [
        `Stable Release Candidate: ${s.score}/100 ${s.status}`,
        `Ready: ${s.releaseReady ? 'yes' : 'no'}, armed: ${s.releaseArmed ? 'yes' : 'no'}, samples: ${s.sampleCount || 0}`,
        `Renderer: ${s.rendererProfile}/${s.rendererMode}, layers ${s.layerMask || 'none'}, WebGL ${s.webglReady ? 'ready' : 'unavailable'}`,
        `Health: ${Math.round(s.healthScore || 0)}/100 ${s.healthStatus}, Final QA: ${Math.round(s.finalQaScore || 0)}/100 ${s.finalQaStatus}`,
        `Blockers: ${s.blockers || 'none'}`,
        `Warnings: ${s.warnings || 'none'}`,
        `Recommendation: ${s.recommendation || ''}`
      ].join('\n');
    }

    exportPayload() {
      return {
        version: window.DREAM_REALMS_VERSION || '',
        build: window.DREAM_REALMS_BUILD_NAME || '',
        exportedAt: wallIso(),
        snapshot: this.snapshot(),
        history: this.history.slice(-80),
        rendererHealth: this.game?.ensurePerformanceSettingsCleanupSystem?.().exportPayload?.() || null,
        lastBenchmark: this.game?.performanceVerifier?.lastBenchmark || null
      };
    }

    syncPerfStats() {
      const perf = this.game?.perfStats || (this.game.perfStats = {});
      const s = this.metrics || this.defaultMetrics();
      perf.stableReleaseCandidateEnabled = !!this.enabled;
      perf.stableReleaseCandidateArmed = !!this.releaseArmed;
      perf.stableReleaseCandidateReady = !!s.releaseReady;
      perf.stableReleaseCandidateScore = num(s.score, 0);
      perf.stableReleaseCandidateAvgScore = num(s.avgScore, 0);
      perf.stableReleaseCandidateMinScore = num(s.minScore, 0);
      perf.stableReleaseCandidateStatus = s.status || 'warming';
      perf.stableReleaseCandidateChecksPassed = num(s.checksPassed, 0);
      perf.stableReleaseCandidateChecksTotal = num(s.checksTotal, CHECKS.length);
      perf.stableReleaseCandidateBlockers = s.blockers || 'none';
      perf.stableReleaseCandidateWarnings = s.warnings || 'none';
      perf.stableReleaseCandidateRecommendation = s.recommendation || '';
      perf.stableReleaseCandidateLayerMask = s.layerMask || 'none';
      perf.stableReleaseCandidateHealthScore = num(s.healthScore, 0);
      perf.stableReleaseCandidateFinalQaScore = num(s.finalQaScore, 0);
      perf.stableReleaseCandidateFallbackPressure = num(s.fallbackPressure, 0);
      perf.stableReleaseCandidateHybridCostMs = num(s.hybridCostMs, 0);
    }
  }

  function buildSettingsHtml(game) {
    const sys = game?.ensureStableReleaseCandidateSystem?.();
    const s = sys?.snapshot?.() || {};
    const checks = CHECKS.map(check => {
      const ok = !!s.checks?.[check.id];
      return `<div class="small">${ok ? '✓' : '✗'} ${esc(check.label)}</div>`;
    }).join('');
    return `
      <div class="settingsSectionTitle">Stable Release Candidate</div>
      <div class="small" style="margin-bottom:8px">Final shipping gate for the performance renderer stack. Hybrid can be default only when this gate is release-ready; Canvas Safe Mode remains available.</div>
      <div class="settingsRow"><span>Release Gate</span><button class="toggleBtn ${s.enabled !== false ? 'active' : ''}" data-stable-rc-toggle="1">${s.enabled !== false ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Release Armed</span><button class="toggleBtn ${s.releaseArmed ? 'active' : ''}" data-stable-rc-armed="1">${s.releaseArmed ? 'Armed' : 'Disarmed'}</button></div>
      <div class="small" style="margin-bottom:8px">Score: ${Math.round(s.score || 0)}/100 (${esc(s.status || 'warming')}), avg ${Math.round(s.avgScore || 0)}, samples ${Number(s.sampleCount || 0)}, ready ${s.releaseReady ? 'yes' : 'no'}.</div>
      <div class="small" style="margin-bottom:8px">Renderer: ${esc(s.rendererProfile || 'auto')} / ${esc(s.rendererMode || 'unknown')}. Layers: ${esc(s.layerMask || 'none')}. Health ${Math.round(s.healthScore || 0)}/100, Final QA ${Math.round(s.finalQaScore || 0)}/100.</div>
      <div class="small" style="margin-bottom:8px">Blockers: ${esc(s.blockers || 'none')}</div>
      <div class="small" style="margin-bottom:8px">Warnings: ${esc(s.warnings || 'none')}</div>
      <details><summary>Release checklist</summary>${checks}</details>
      <div class="settingsRow" style="gap:6px;flex-wrap:wrap;margin-top:8px">
        <button class="toggleBtn" data-stable-rc-export="1">Export Release JSON</button>
        <button class="toggleBtn" data-stable-rc-copy="1">Copy Release Summary</button>
        <button class="toggleBtn" data-stable-rc-reset="1">Clear Release Samples</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drStableReleaseCandidateInstalled) return;
    Game.prototype.__drStableReleaseCandidateInstalled = true;

    Game.prototype.ensureStableReleaseCandidateSystem = function() {
      if (!this.stableReleaseCandidateSystem) this.stableReleaseCandidateSystem = new StableReleaseCandidateSystem(this);
      return this.stableReleaseCandidateSystem;
    };

    Game.prototype.getStableReleaseCandidateSnapshot = function() {
      return this.ensureStableReleaseCandidateSystem?.().snapshot?.() || null;
    };

    Game.prototype.toggleStableReleaseCandidateGate = function() {
      const sys = this.ensureStableReleaseCandidateSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Stable Release Candidate gate: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('stable rc gate');
      return enabled;
    };

    Game.prototype.toggleStableReleaseCandidateArmed = function() {
      const sys = this.ensureStableReleaseCandidateSystem?.();
      const armed = sys?.setReleaseArmed?.(!sys.releaseArmed, 'settings toggle') || false;
      this.logSystem?.(`Stable Release Candidate armed: ${armed ? 'Yes' : 'No'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('stable rc armed');
      return armed;
    };

    Game.prototype.resetStableReleaseCandidateSamples = function() {
      this.ensureStableReleaseCandidateSystem?.().reset?.('settings reset');
      this.logSystem?.('Stable Release Candidate samples cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('stable rc reset');
      return true;
    };

    Game.prototype.exportStableReleaseCandidateJson = function() {
      const payload = this.ensureStableReleaseCandidateSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-stable-release-candidate-${Date.now ? Date.now() : 'report'}.json`, payload);
      this.logSystem?.(ok ? 'Stable Release Candidate JSON exported.' : 'Stable Release Candidate JSON export failed.');
      return payload;
    };

    Game.prototype.copyStableReleaseCandidateSummary = async function() {
      const text = this.ensureStableReleaseCandidateSystem?.().summary?.() || 'Stable Release Candidate unavailable.';
      try {
        await navigator.clipboard?.writeText?.(text);
        this.logSystem?.('Stable Release Candidate summary copied.');
      } catch (_err) {
        this.logSystem?.(text);
      }
      return text;
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drStableReleaseCandidateWrapped) {
      const wrappedRender = function(...args) {
        try { this.ensureStableReleaseCandidateSystem?.().sample?.(false); } catch (_err) {}
        return originalRender.apply(this, args);
      };
      wrappedRender.__drStableReleaseCandidateWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const perfClass = DR.PerformanceVerificationSystem || DR.systems?.PerformanceVerificationSystem;
    if (perfClass?.prototype && typeof perfClass.prototype.settingsPanelHtml === 'function' && !perfClass.prototype.settingsPanelHtml.__drStableReleaseCandidateWrapped) {
      const originalSettingsPanelHtml = perfClass.prototype.settingsPanelHtml;
      const wrappedSettingsPanelHtml = function(...args) {
        const html = originalSettingsPanelHtml.apply(this, args) || '';
        const block = buildSettingsHtml(this.game);
        const marker = '<div class="settingsSectionTitle">Renderer Health</div>';
        return html.includes(marker) ? html.replace(marker, `${block}${marker}`) : `${html}${block}`;
      };
      wrappedSettingsPanelHtml.__drStableReleaseCandidateWrapped = true;
      perfClass.prototype.settingsPanelHtml = wrappedSettingsPanelHtml;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drStableReleaseCandidateWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          list?.querySelector('[data-stable-rc-toggle]')?.addEventListener('click', () => this.toggleStableReleaseCandidateGate?.());
          list?.querySelector('[data-stable-rc-armed]')?.addEventListener('click', () => this.toggleStableReleaseCandidateArmed?.());
          list?.querySelector('[data-stable-rc-export]')?.addEventListener('click', () => this.exportStableReleaseCandidateJson?.());
          list?.querySelector('[data-stable-rc-copy]')?.addEventListener('click', () => this.copyStableReleaseCandidateSummary?.());
          list?.querySelector('[data-stable-rc-reset]')?.addEventListener('click', () => this.resetStableReleaseCandidateSamples?.());
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'stable-release-candidate' }, 'settings listeners', err);
        }
        return result;
      };
      wrappedRenderSettingsPanel.__drStableReleaseCandidateWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }

    const originalUpdateDebugOverlay = Game.prototype.updateDebugOverlay;
    if (typeof originalUpdateDebugOverlay === 'function' && !originalUpdateDebugOverlay.__drStableReleaseCandidateWrapped) {
      const wrappedUpdateDebugOverlay = function(force, ...rest) {
        const result = originalUpdateDebugOverlay.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (body && (this.debugOverlayOpen || force || DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true)) {
            const snap = this.ensureStableReleaseCandidateSystem?.().snapshot?.();
            if (snap) {
              const line = `\nStableRC: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, ready ${snap.releaseReady ? 'yes' : 'no'}, checks ${snap.checksPassed || 0}/${snap.checksTotal || CHECKS.length}, blockers ${snap.blockers || 'none'}`;
              if (!String(body.textContent || '').includes('StableRC:')) body.textContent = `${body.textContent || ''}${line}`;
            }
          }
        } catch (_err) {}
        return result;
      };
      wrappedUpdateDebugOverlay.__drStableReleaseCandidateWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedUpdateDebugOverlay;
    }
  }

  DR.StableReleaseCandidateSystem = { install, StableReleaseCandidateSystem };
  DR.systems.StableReleaseCandidateSystem = StableReleaseCandidateSystem;
  if (DR.Game) install(DR.Game);
})();
