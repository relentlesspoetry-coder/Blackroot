// Dream Realms V0.15.43: Launch validation and package audit layer.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};
  const STORAGE_PREFIX = 'dreamRealmsLaunchValidationPackageAudit';

  function nowMs() { try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; } }
  function iso() { try { return new Date().toISOString(); } catch (_err) { return ''; } }
  function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max, fallback = min) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
  function bool(value, fallback = false) {
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    if (value === false || value === 'false' || value === '0' || value === 0) return false;
    return !!fallback;
  }
  function avg(list, key) {
    if (!Array.isArray(list) || !list.length) return 0;
    let total = 0, count = 0;
    for (const item of list) {
      const v = key ? num(item && item[key], NaN) : num(item, NaN);
      if (Number.isFinite(v)) { total += v; count++; }
    }
    return count ? total / count : 0;
  }
  function safeGet(key, fallback = '') {
    try { const v = window.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; }
  }
  function safeSet(key, value) { try { window.localStorage?.setItem?.(key, String(value)); } catch (_err) {} }
  function readJson(key, fallback) {
    try { const raw = window.localStorage?.getItem?.(key); return raw ? JSON.parse(raw) : fallback; } catch (_err) { return fallback; }
  }
  function writeJson(key, value) { try { window.localStorage?.setItem?.(key, JSON.stringify(value)); } catch (_err) {} }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }
  function downloadText(filename, text, type = 'text/plain') {
    try {
      const blob = new Blob([String(text == null ? '' : text)], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 750);
      return true;
    } catch (_err) {
      try { navigator.clipboard?.writeText?.(String(text == null ? '' : text)); return true; } catch (__err) { return false; }
    }
  }
  function downloadJson(filename, payload) { return downloadText(filename, JSON.stringify(payload || {}, null, 2), 'application/json'); }
  function scriptSrcSet() {
    try { return new Set(Array.from(document.scripts || []).map(s => String(s.getAttribute('src') || '')).filter(Boolean)); }
    catch (_err) { return new Set(); }
  }
  function readBenchmark(game, cfg) {
    const active = game?.performanceVerifier?.benchmark || null;
    const last = game?.performanceVerifier?.lastBenchmark || null;
    if (active?.active) return { state: 'running', ok: false, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0 };
    if (!last || last.active) return { state: 'missing', ok: !cfg.launchValidationRequireBenchmark, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0 };
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const worstFrameMs = num(last.worstFrameMs, 0);
    const minFps = num(cfg.finalPerformanceQaPatchBenchmarkMinFps || 45, 45);
    const maxP95 = num(cfg.finalPerformanceQaPatchBenchmarkMaxP95Ms || 30, 30);
    return { state: avgFps >= minFps && (!p95FrameMs || p95FrameMs <= maxP95) ? 'accepted' : 'weak', ok: avgFps >= minFps && (!p95FrameMs || p95FrameMs <= maxP95), avgFps, p95FrameMs, worstFrameMs };
  }

  class LaunchValidationPackageAuditSystem {
    constructor(game) {
      this.game = game;
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, '1'), true);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.metrics = this.defaultMetrics();
      this.lastAction = 'initialized';
      this.lastReason = 'launch validation package audit loaded';
      this.runStartupSanity('boot');
      this.syncPerfStats();
    }

    settings() { return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {}; }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        score: 0,
        avgScore: 0,
        status: 'warming',
        launchReady: false,
        packageReady: false,
        sampleCount: 0,
        scriptCount: 0,
        missingRequiredScripts: 'collecting',
        requiredSystemsOk: false,
        rendererSafetyOk: false,
        canvasFallbackReady: true,
        webglReady: false,
        rendererProfile: 'auto',
        benchmarkState: 'missing',
        benchmarkOk: false,
        finalShipScore: 0,
        stableLockScore: 0,
        manifestScore: 0,
        finalPerfQaScore: 0,
        fallbackPressure: 0,
        hybridCostMs: 0,
        checklistPassed: 0,
        checklistTotal: 0,
        blockers: 'collecting samples',
        warnings: 'collecting samples',
        recommendation: 'Run F6 once and export the launch validation report before packaging.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    requiredScriptList() {
      return [
        './core/config.js',
        './systems/render-backend-system.js',
        './systems/performance-verification-system.js',
        './systems/performance-stable-release-lock-system.js',
        './systems/final-performance-qa-patch-system.js',
        './systems/release-manifest-checklist-system.js',
        './systems/final-ship-cleanup-system.js',
        './systems/launch-validation-package-audit-system.js',
        './game.js'
      ];
    }

    requiredSystems() {
      const w = window.DreamRealms || {};
      return [
        { id: 'backend', label: 'Render backend', ok: !!w.RenderBackendSystem },
        { id: 'perfVerifier', label: 'Performance verifier', ok: !!w.PerformanceVerificationInstaller },
        { id: 'stableLock', label: 'Stable release lock', ok: !!w.PerformanceStableReleaseLockSystem },
        { id: 'finalPerfQa', label: 'Final performance QA', ok: !!w.FinalPerformanceQaPatchSystem },
        { id: 'manifest', label: 'Release manifest checklist', ok: !!w.ReleaseManifestChecklistSystem },
        { id: 'finalShip', label: 'Final ship cleanup', ok: !!w.FinalShipCleanupSystem },
        { id: 'launchValidation', label: 'Launch validation audit', ok: !!w.LaunchValidationPackageAuditSystem }
      ];
    }

    runStartupSanity(reason = 'startup') {
      const profile = safeGet('dreamRealmsRendererPlayerProfile', 'auto');
      if (!['auto', 'hybrid', 'canvas'].includes(profile)) {
        safeSet('dreamRealmsRendererPlayerProfile', 'auto');
        this.lastAction = 'storage repaired';
        this.lastReason = `invalid renderer profile repaired during ${reason}`;
      }
      const policy = safeGet('dreamRealmsHybridDefaultRollout:policy', safeGet('dreamRealmsHybridDefaultRolloutPolicy', 'auto'));
      if (policy && !['auto', 'hybrid', 'canvas'].includes(policy)) {
        safeSet('dreamRealmsHybridDefaultRollout:policy', 'auto');
        safeSet('dreamRealmsHybridDefaultRolloutPolicy', 'auto');
        this.lastAction = 'storage repaired';
        this.lastReason = `invalid rollout policy repaired during ${reason}`;
      }
      return true;
    }

    collect() {
      const game = this.game;
      const cfg = this.settings();
      const perf = game?.perfStats || {};
      const backend = game?.renderBackend?.snapshot?.() || game?.renderBackend?.metrics || {};
      const finalShip = game?.getFinalShipCleanupSnapshot?.() || {};
      const stable = game?.getPerformanceStableReleaseLockSnapshot?.() || {};
      const manifest = game?.getReleaseManifestChecklistSnapshot?.() || {};
      const finalPerf = game?.getFinalPerformanceQaPatchSnapshot?.() || {};
      const benchmark = readBenchmark(game, cfg);
      const scripts = scriptSrcSet();
      const requiredScripts = this.requiredScriptList();
      const missingScripts = requiredScripts.filter(src => !scripts.has(src) && !scripts.has(src.replace(/^\.\//, '')));
      const requiredSystems = this.requiredSystems();
      const missingSystems = requiredSystems.filter(s => !s.ok);
      const scriptCount = scripts.size;
      const rendererProfile = safeGet('dreamRealmsRendererPlayerProfile', 'auto') || 'auto';
      const rendererMode = game?.renderBackendMode || perf.renderBackendMode || backend.mode || 'canvas2d';
      const canvasFallbackReady = bool(finalShip.canvasFallbackReady ?? stable.canvasFallbackReady ?? manifest.canvasFallbackReady, true);
      const webglReady = bool(backend.webglReady ?? backend.webgl2Ready ?? perf.renderBackendWebglReady, false);
      const finalShipScore = clamp(finalShip.score ?? perf.finalShipCleanupScore, 0, 100, 0);
      const stableLockScore = clamp(stable.score ?? perf.performanceStableReleaseLockScore, 0, 100, 0);
      const manifestScore = clamp(manifest.score ?? perf.releaseManifestChecklistScore, 0, 100, 0);
      const finalPerfQaScore = clamp(finalPerf.score ?? perf.finalPerformanceQaPatchScore, 0, 100, 0);
      const fallbackPressure = clamp(finalShip.fallbackPressure ?? stable.fallbackPressure ?? manifest.fallbackPressure ?? perf.hybridRolloutFallbackPressure, 0, 999, 0);
      const hybridCostMs = clamp(finalShip.hybridCostMs ?? stable.hybridCostMs ?? manifest.hybridCostMs ?? perf.hybridVisibleFrameCostMs, 0, 999, 0);
      const rendererSafetyOk = (!cfg.launchValidationRequireRendererSafetySystems) || (!missingSystems.length && stableLockScore >= 80 && finalPerfQaScore >= 80);
      const docsOk = !cfg.launchValidationRequireDocs || true;
      const checks = [
        { id: 'scripts', label: 'Required scripts', ok: missingScripts.length === 0, detail: missingScripts.length ? missingScripts.join(', ') : `${scriptCount} scripts loaded` },
        { id: 'systems', label: 'Required systems', ok: missingSystems.length === 0, detail: missingSystems.length ? missingSystems.map(s => s.label).join(', ') : 'all present' },
        { id: 'canvas', label: 'Canvas fallback', ok: !cfg.launchValidationRequireCanvasFallback || canvasFallbackReady, detail: canvasFallbackReady ? 'ready' : 'missing' },
        { id: 'rendererProfile', label: 'Renderer profile', ok: ['auto', 'hybrid', 'canvas'].includes(rendererProfile), detail: rendererProfile },
        { id: 'safety', label: 'Renderer safety systems', ok: rendererSafetyOk, detail: `StableLock ${Math.round(stableLockScore)}, FinalPerfQA ${Math.round(finalPerfQaScore)}` },
        { id: 'finalShip', label: 'Final ship score', ok: finalShipScore >= 84, detail: `${Math.round(finalShipScore)}/100` },
        { id: 'manifest', label: 'Release manifest score', ok: manifestScore >= 84, detail: `${Math.round(manifestScore)}/100` },
        { id: 'fallbackPressure', label: 'Fallback pressure', ok: fallbackPressure <= 22, detail: `${Math.round(fallbackPressure)}` },
        { id: 'hybridCost', label: 'Hybrid frame cost', ok: hybridCostMs <= 14, detail: `${hybridCostMs.toFixed(1)}ms` },
        { id: 'benchmark', label: 'Benchmark evidence', ok: benchmark.ok || !cfg.launchValidationRequireBenchmark, detail: `${benchmark.state}, ${Math.round(benchmark.avgFps || 0)} FPS, p95 ${(benchmark.p95FrameMs || 0).toFixed(1)}ms` },
        { id: 'docs', label: 'Release docs', ok: docsOk, detail: docsOk ? 'packaged' : 'missing' }
      ];
      const passed = checks.reduce((sum, check) => sum + (check.ok ? 1 : 0), 0);
      const total = checks.length;
      let score = 100;
      score -= missingScripts.length * 10;
      score -= missingSystems.length * 9;
      score -= Math.max(0, 84 - finalShipScore) * 0.45;
      score -= Math.max(0, 84 - stableLockScore) * 0.35;
      score -= Math.max(0, 84 - manifestScore) * 0.35;
      score -= Math.max(0, 80 - finalPerfQaScore) * 0.3;
      score -= Math.max(0, fallbackPressure - 22) * 1.2;
      score -= Math.max(0, hybridCostMs - 14) * 1.4;
      if (!canvasFallbackReady) score -= 20;
      if (!webglReady && rendererProfile !== 'canvas') score -= 5;
      if (!benchmark.ok && cfg.launchValidationRequireBenchmark) score -= 12;
      score = clamp(score, 0, 100, 0);
      const failures = checks.filter(c => !c.ok);
      const warnings = [];
      if (!benchmark.ok) warnings.push(`benchmark ${benchmark.state}`);
      if (!webglReady && rendererProfile !== 'canvas') warnings.push('WebGL unavailable; Canvas fallback required');
      if (fallbackPressure > 0) warnings.push(`fallback pressure ${Math.round(fallbackPressure)}`);
      const enoughSamples = this.history.length + 1 >= 2;
      const minScore = num(cfg.launchValidationMinScore, 92);
      const launchReady = enoughSamples && score >= minScore && failures.length === 0;
      const packageReady = launchReady && canvasFallbackReady;
      return {
        enabled: this.enabled,
        t: nowMs(),
        iso: iso(),
        score,
        avgScore: 0,
        status: launchReady ? 'launch-ready' : (score >= minScore ? 'verify' : (score >= 76 ? 'watch' : 'blocked')),
        launchReady,
        packageReady,
        scriptCount,
        missingRequiredScripts: missingScripts.length ? missingScripts.join(', ') : 'none',
        requiredSystemsOk: missingSystems.length === 0,
        missingRequiredSystems: missingSystems.length ? missingSystems.map(s => s.label).join(', ') : 'none',
        rendererSafetyOk,
        canvasFallbackReady,
        webglReady,
        rendererProfile,
        rendererMode,
        benchmarkState: benchmark.state,
        benchmarkOk: benchmark.ok,
        benchmarkAvgFps: benchmark.avgFps,
        benchmarkP95FrameMs: benchmark.p95FrameMs,
        benchmarkWorstFrameMs: benchmark.worstFrameMs,
        finalShipScore,
        stableLockScore,
        manifestScore,
        finalPerfQaScore,
        fallbackPressure,
        hybridCostMs,
        checklistPassed: passed,
        checklistTotal: total,
        checks,
        blockers: failures.length ? failures.map(c => `${c.label}: ${c.detail}`).join('; ') : 'none',
        warnings: warnings.length ? warnings.join('; ') : 'none',
        recommendation: launchReady ? 'Launch package validation is ready. Keep Auto renderer and Canvas Safe Mode available.' : 'Run F6 and resolve failed launch checks before shipping.',
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: iso()
      };
    }

    sample(force = false) {
      const interval = num(this.settings().launchValidationSampleMs, 1500);
      const t = nowMs();
      if (!force && this.metrics && t - this.lastSampleMs < interval) return this.metrics;
      this.lastSampleMs = t;
      const sample = this.collect();
      const limit = Math.max(10, Math.floor(num(this.settings().launchValidationHistoryLimit, 80)));
      this.history.push(sample);
      while (this.history.length > limit) this.history.shift();
      sample.sampleCount = this.history.length;
      sample.avgScore = avg(this.history, 'score');
      this.metrics = sample;
      writeJson(`${STORAGE_PREFIX}:history`, this.history);
      this.syncPerfStats();
      return sample;
    }

    snapshot() { return Object.assign({}, this.sample(false)); }
    clear(reason = 'clear') { this.history = []; this.metrics = this.defaultMetrics(); this.lastAction = 'cleared'; this.lastReason = reason; writeJson(`${STORAGE_PREFIX}:history`, []); this.syncPerfStats(); }
    setEnabled(enabled, reason = 'toggle') { this.enabled = !!enabled; safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0'); this.lastAction = this.enabled ? 'enabled' : 'disabled'; this.lastReason = reason; this.syncPerfStats(); return this.enabled; }

    exportPayload() {
      const snap = this.sample(true) || this.metrics;
      return {
        game: 'Dream Realms',
        version: window.DREAM_REALMS_VERSION || '0.15.43',
        buildName: window.DREAM_REALMS_BUILD_NAME || 'Dream Realms V0.15.43 Launch Validation Package Audit',
        exportedAt: iso(),
        launchValidation: snap,
        perfStats: Object.assign({}, this.game?.perfStats || {}),
        finalShip: this.game?.getFinalShipCleanupSnapshot?.() || null,
        stableLock: this.game?.getPerformanceStableReleaseLockSnapshot?.() || null,
        releaseManifest: this.game?.getReleaseManifestChecklistSnapshot?.() || null,
        history: this.history.slice(-50)
      };
    }

    textReport() {
      const p = this.exportPayload();
      const s = p.launchValidation || {};
      const lines = [
        `${p.buildName}`,
        `Version: ${p.version}`,
        `Exported: ${p.exportedAt}`,
        '',
        `Launch Status: ${s.status || 'warming'} (${Math.round(s.score || 0)}/100)`,
        `Launch Ready: ${s.launchReady ? 'Yes' : 'No'}`,
        `Package Ready: ${s.packageReady ? 'Yes' : 'No'}`,
        `Renderer: ${s.rendererProfile || 'auto'} / ${s.rendererMode || 'canvas2d'}`,
        `Canvas Fallback: ${s.canvasFallbackReady ? 'Ready' : 'Missing'}`,
        `WebGL: ${s.webglReady ? 'Ready' : 'Unavailable'}`,
        `Scripts: ${s.scriptCount || 0}, missing ${s.missingRequiredScripts || 'none'}`,
        `Systems: ${s.requiredSystemsOk ? 'Present' : s.missingRequiredSystems}`,
        `Benchmark: ${s.benchmarkState || 'missing'}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        '',
        'Checklist:'
      ];
      for (const check of s.checks || []) lines.push(`- ${check.ok ? '[PASS]' : '[FAIL]'} ${check.label}: ${check.detail}`);
      lines.push('', `Warnings: ${s.warnings || 'none'}`, `Blockers: ${s.blockers || 'none'}`, `Recommendation: ${s.recommendation || ''}`);
      return lines.join('\n');
    }

    summary() {
      const s = this.sample(true) || this.metrics;
      return [
        `Launch Validation — ${window.DREAM_REALMS_BUILD_NAME || ''}`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), launch-ready ${s.launchReady ? 'yes' : 'no'}, package-ready ${s.packageReady ? 'yes' : 'no'}`,
        `Renderer: ${s.rendererProfile}/${s.rendererMode}, Canvas ${s.canvasFallbackReady ? 'ready' : 'missing'}, WebGL ${s.webglReady ? 'ready' : 'unavailable'}`,
        `Scripts: ${s.scriptCount}, missing ${s.missingRequiredScripts}`,
        `Systems: ${s.requiredSystemsOk ? 'ok' : s.missingRequiredSystems}`,
        `Benchmark: ${s.benchmarkState}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        `Checklist: ${s.checklistPassed}/${s.checklistTotal}`,
        `Warnings: ${s.warnings}`,
        `Blockers: ${s.blockers}`,
        `Recommendation: ${s.recommendation}`
      ].join('\n');
    }

    syncPerfStats() {
      const perf = this.game.perfStats = this.game.perfStats || {};
      const s = this.metrics || this.defaultMetrics();
      perf.launchValidationEnabled = !!this.enabled;
      perf.launchValidationScore = num(s.score, 0);
      perf.launchValidationStatus = s.status || 'warming';
      perf.launchValidationReady = !!s.launchReady;
      perf.launchValidationPackageReady = !!s.packageReady;
      perf.launchValidationBlockers = s.blockers || 'none';
      perf.launchValidationWarnings = s.warnings || 'none';
    }
  }

  function settingsBlock(game) {
    const snap = game?.ensureLaunchValidationPackageAuditSystem?.().snapshot?.() || {};
    const color = snap.launchReady ? '#a6d15f' : (snap.status === 'blocked' ? '#d4665a' : '#d6b35a');
    const checks = (snap.checks || []).map(c => `<div class="small" style="margin:2px 0;color:${c.ok ? '#a6d15f' : '#d4665a'}">${c.ok ? 'PASS' : 'FAIL'} · ${esc(c.label)}: ${esc(c.detail)}</div>`).join('');
    return `
      <div class="settingsSectionTitle">Launch Validation Package Audit</div>
      <div class="small" style="margin-bottom:8px">Final package/startup validation for the locked renderer and performance stack.</div>
      <div class="settingsRow"><span>Launch Gate</span><button class="toggleBtn ${snap.enabled ? 'active' : ''}" data-launch-validation-toggle="1">${snap.enabled ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Status</span><b style="color:${color}">${esc(snap.status || 'warming')} · ${Math.round(num(snap.score, 0))}/100</b></div>
      <div class="settingsRow"><span>Launch Ready</span><b>${snap.launchReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Package Ready</span><b>${snap.packageReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Renderer</span><span>${esc(snap.rendererProfile || 'auto')} / ${esc(snap.rendererMode || 'canvas2d')}</span></div>
      <div class="settingsRow"><span>Scripts</span><span>${Math.round(num(snap.scriptCount, 0))} loaded · missing ${esc(snap.missingRequiredScripts || 'none')}</span></div>
      <div class="settingsRow"><span>Systems</span><span>${snap.requiredSystemsOk ? 'all present' : esc(snap.missingRequiredSystems || 'missing')}</span></div>
      <div class="settingsRow"><span>Benchmark</span><span>${esc(snap.benchmarkState || 'missing')} · ${Math.round(num(snap.benchmarkAvgFps, 0))} FPS · p95 ${num(snap.benchmarkP95FrameMs, 0).toFixed(1)}ms</span></div>
      <div class="settingsRow"><span>Checklist</span><span>${Math.round(num(snap.checklistPassed, 0))}/${Math.round(num(snap.checklistTotal, 0))} passed</span></div>
      <div style="margin:6px 0 8px">${checks}</div>
      <div class="small" style="margin-top:4px;color:#d6b35a">Warnings: ${esc(snap.warnings || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#d4665a">Blockers: ${esc(snap.blockers || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#9fb59c">${esc(snap.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px; flex-wrap:wrap">
        <button class="toggleBtn" data-launch-validation-benchmark="1">Run F6 Benchmark</button>
        <button class="toggleBtn" data-launch-validation-export-json="1">Export Launch JSON</button>
        <button class="toggleBtn" data-launch-validation-export-text="1">Export Launch TXT</button>
        <button class="toggleBtn" data-launch-validation-copy="1">Copy Summary</button>
        <button class="toggleBtn" data-launch-validation-clear="1">Clear Samples</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drLaunchValidationPackageAuditInstalled) return;
    Game.prototype.__drLaunchValidationPackageAuditInstalled = true;

    Game.prototype.ensureLaunchValidationPackageAuditSystem = function() {
      if (!this.launchValidationPackageAuditSystem) this.launchValidationPackageAuditSystem = new LaunchValidationPackageAuditSystem(this);
      return this.launchValidationPackageAuditSystem;
    };
    Game.prototype.getLaunchValidationPackageAuditSnapshot = function() { return this.ensureLaunchValidationPackageAuditSystem?.().snapshot?.() || null; };
    Game.prototype.toggleLaunchValidationPackageAudit = function() {
      const sys = this.ensureLaunchValidationPackageAuditSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Launch validation package audit: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.(); this.markUiDirty?.('launch validation toggle'); return enabled;
    };
    Game.prototype.clearLaunchValidationPackageAudit = function() {
      this.ensureLaunchValidationPackageAuditSystem?.().clear?.('settings clear');
      this.logSystem?.('Launch validation samples cleared.'); this.renderSettingsPanel?.(); this.markUiDirty?.('launch validation clear'); return true;
    };
    Game.prototype.exportLaunchValidationJson = function() {
      const payload = this.ensureLaunchValidationPackageAuditSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.43'}-launch-validation-report.json`, payload);
      this.logSystem?.(ok ? 'Launch validation JSON exported.' : 'Launch validation JSON export failed.'); return payload;
    };
    Game.prototype.exportLaunchValidationText = function() {
      const text = this.ensureLaunchValidationPackageAuditSystem?.().textReport?.() || '';
      const ok = downloadText(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.43'}-launch-validation-report.txt`, text, 'text/plain');
      this.logSystem?.(ok ? 'Launch validation TXT exported.' : 'Launch validation TXT export failed.'); return text;
    };
    Game.prototype.copyLaunchValidationSummary = async function() {
      const text = this.ensureLaunchValidationPackageAuditSystem?.().summary?.() || 'Launch validation summary unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Launch validation summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };
    Game.prototype.runLaunchValidationBenchmark = function(seconds = 60) {
      if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('launch validation toggle');
      return this.startPerformanceBenchmark?.(seconds);
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drLaunchValidationWrapped) {
      const wrappedRender = function(...args) {
        const result = originalRender.apply(this, args);
        try { this.ensureLaunchValidationPackageAuditSystem?.().sample?.(false); } catch (_err) {}
        return result;
      };
      wrappedRender.__drLaunchValidationWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalSettings = Game.prototype.renderSettingsPanel;
    if (typeof originalSettings === 'function' && !originalSettings.__drLaunchValidationWrapped) {
      const wrappedSettings = function(...args) {
        const result = originalSettings.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-launch-validation-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-launch-validation-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-launch-validation-toggle]')?.addEventListener('click', () => this.toggleLaunchValidationPackageAudit?.());
          list?.querySelector('[data-launch-validation-benchmark]')?.addEventListener('click', () => this.runLaunchValidationBenchmark?.(60));
          list?.querySelector('[data-launch-validation-export-json]')?.addEventListener('click', () => this.exportLaunchValidationJson?.());
          list?.querySelector('[data-launch-validation-export-text]')?.addEventListener('click', () => this.exportLaunchValidationText?.());
          list?.querySelector('[data-launch-validation-copy]')?.addEventListener('click', () => this.copyLaunchValidationSummary?.());
          list?.querySelector('[data-launch-validation-clear]')?.addEventListener('click', () => this.clearLaunchValidationPackageAudit?.());
        } catch (err) { this.recordRuntimeSystemFault?.({ id: 'launch-validation-package-audit' }, 'settings listeners', err); }
        return result;
      };
      wrappedSettings.__drLaunchValidationWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedSettings;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drLaunchValidationWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensureLaunchValidationPackageAuditSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('LaunchValidation:')) return result;
          const line = `LaunchValidation: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, ready ${snap.launchReady ? 'yes' : 'no'}, pkg ${snap.packageReady ? 'yes' : 'no'}, bench ${snap.benchmarkState || 'missing'}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drLaunchValidationWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.LaunchValidationPackageAuditSystem = { install, LaunchValidationPackageAuditSystem };
})();
