// Dream Realms V0.15.44: Final gameplay QA fixes and renderer route hardening.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};
  const STORAGE_PREFIX = 'dreamRealmsFinalGameplayQaFixes';

  function nowMs() { try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; } }
  function iso() { try { return new Date().toISOString(); } catch (_err) { return ''; } }
  function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max, fallback = min) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
  function bool(value, fallback = false) {
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    if (value === false || value === 'false' || value === '0' || value === 0) return false;
    return !!fallback;
  }
  function safeGet(key, fallback = '') { try { const v = window.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; } }
  function safeSet(key, value) { try { window.localStorage?.setItem?.(key, String(value)); } catch (_err) {} }
  function readJson(key, fallback) { try { const raw = window.localStorage?.getItem?.(key); return raw ? JSON.parse(raw) : fallback; } catch (_err) { return fallback; } }
  function writeJson(key, value) { try { window.localStorage?.setItem?.(key, JSON.stringify(value)); } catch (_err) {} }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }
  function avg(list, key) {
    if (!Array.isArray(list) || !list.length) return 0;
    let total = 0, count = 0;
    for (const item of list) {
      const v = key ? num(item && item[key], NaN) : num(item, NaN);
      if (Number.isFinite(v)) { total += v; count += 1; }
    }
    return count ? total / count : 0;
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
  function readBenchmark(game, cfg) {
    const active = game?.performanceVerifier?.benchmark || null;
    const last = game?.performanceVerifier?.lastBenchmark || null;
    if (active?.active) return { state: 'running', ok: false, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0 };
    if (!last || last.active) return { state: 'missing', ok: !cfg.finalGameplayQaRequireBenchmark, avgFps: 0, p95FrameMs: 0, worstFrameMs: 0 };
    const avgFps = num(last.avgFps ?? last.averageFps, 0);
    const p95FrameMs = num(last.p95FrameMs, 0);
    const worstFrameMs = num(last.worstFrameMs, 0);
    const minFps = num(cfg.finalPerformanceQaPatchBenchmarkMinFps || 45, 45);
    const maxP95 = num(cfg.finalPerformanceQaPatchBenchmarkMaxP95Ms || 30, 30);
    const ok = avgFps >= minFps && (!p95FrameMs || p95FrameMs <= maxP95);
    return { state: ok ? 'accepted' : 'weak', ok, avgFps, p95FrameMs, worstFrameMs };
  }
  function layerText(value) {
    if (!value) return 'none';
    if (Array.isArray(value)) return value.length ? value.join(', ') : 'none';
    return String(value).replace(/[|,]+/g, ', ').replace(/\s+/g, ' ').trim() || 'none';
  }

  class FinalGameplayQaFixesSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = bool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.enableFinalGameplayQaFixes === false ? '0' : '1'), cfg.enableFinalGameplayQaFixes !== false);
      this.history = readJson(`${STORAGE_PREFIX}:history`, []);
      if (!Array.isArray(this.history)) this.history = [];
      this.lastSampleMs = 0;
      this.lastCamera = { yaw: 0, zoom: 0 };
      this.criticalFrames = 0;
      this.lastAction = 'initialized';
      this.lastReason = 'final gameplay QA fixes loaded';
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
    }

    settings() { return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {}; }

    defaultMetrics() {
      return {
        enabled: this.enabled,
        score: 0,
        avgScore: 0,
        status: 'warming',
        gameplayReady: false,
        sampleCount: 0,
        rendererProfile: 'auto',
        rendererMode: 'canvas2d',
        currentZone: 'overworld',
        caveContext: false,
        combatContext: false,
        cameraRisk: 'low',
        caveRisk: 'low',
        combatRisk: 'low',
        rendererRisk: 'low',
        fallbackPressure: 0,
        hybridCostMs: 0,
        activeLayers: 'none',
        blockedLayers: 'none',
        entityCount: 0,
        effectCount: 0,
        damageTextCount: 0,
        enemyCount: 0,
        botCount: 0,
        mercCount: 0,
        petCount: 0,
        benchmarkState: 'missing',
        benchmarkOk: false,
        blockerCount: 0,
        warningCount: 0,
        blockers: 'collecting samples',
        warnings: 'collecting samples',
        recommendation: 'Run the F6 benchmark and test caves, camera rotation, and large fights.',
        criticalFrames: 0,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: ''
      };
    }

    readRenderData() {
      const g = this.game;
      const perf = g?.perfStats || {};
      const backend = g?.renderBackend?.snapshot?.() || g?.renderBackend?.metrics || {};
      const stable = g?.getPerformanceStableReleaseLockSnapshot?.() || {};
      const finalShip = g?.getFinalShipCleanupSnapshot?.() || {};
      const launch = g?.getLaunchValidationPackageAuditSnapshot?.() || {};
      const finalPerf = g?.getFinalPerformanceQaPatchSnapshot?.() || {};
      const finalQa = g?.getHybridFinalQaSnapshot?.() || {};
      const rollout = g?.getHybridRolloutHealthSnapshot?.() || {};
      const qa = g?.getHybridRendererQaSnapshot?.() || {};
      const manifest = g?.getReleaseManifestChecklistSnapshot?.() || {};
      const stableLockScore = clamp(stable.score ?? perf.performanceStableReleaseLockScore, 0, 100, 0);
      const finalShipScore = clamp(finalShip.score ?? perf.finalShipCleanupScore, 0, 100, 0);
      const launchScore = clamp(launch.score ?? perf.launchValidationScore, 0, 100, 0);
      const finalPerfScore = clamp(finalPerf.score ?? perf.finalPerformanceQaPatchScore, 0, 100, 0);
      const manifestScore = clamp(manifest.score ?? perf.releaseManifestChecklistScore, 0, 100, 0);
      const finalQaScore = clamp(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0);
      const healthScore = clamp(rollout.score ?? rollout.healthScore ?? perf.hybridRolloutHealthScore, 0, 100, 0);
      const fallbackPressure = Math.max(
        num(stable.fallbackPressure, 0), num(finalShip.fallbackPressure, 0), num(launch.fallbackPressure, 0),
        num(finalPerf.fallbackPressure, 0), num(finalQa.fallbackPressure, 0), num(qa.fallbackPressure, 0),
        num(perf.hybridRolloutFallbackPressure, 0)
      );
      const hybridCostMs = Math.max(
        num(stable.hybridCostMs, 0), num(finalShip.hybridCostMs, 0), num(launch.hybridCostMs, 0),
        num(finalPerf.hybridCostMs, 0), num(finalQa.hybridCostMs, 0), num(perf.hybridVisibleFrameCostMs, 0)
      );
      return { perf, backend, stable, finalShip, launch, finalPerf, finalQa, rollout, qa, manifest, stableLockScore, finalShipScore, launchScore, finalPerfScore, manifestScore, finalQaScore, healthScore, fallbackPressure, hybridCostMs };
    }

    collectGameplayContext() {
      const g = this.game;
      const currentZone = g?.currentZone || 'overworld';
      const caveContext = currentZone === 'cave' || currentZone === 'dungeon' || !!g?.caveMap || !!g?.activeDungeon;
      const enemyCount = Array.isArray(g?.enemies) ? g.enemies.filter(e => e && e.alive !== false).length : 0;
      const botCount = Array.isArray(g?.bots) ? g.bots.filter(b => b && b.alive !== false).length : 0;
      const mercCount = Array.isArray(g?.mercenaries) ? g.mercenaries.filter(m => m && m.alive !== false).length : (g?.mercenary ? 1 : 0);
      const petCount = (g?.pet && g.pet.alive !== false ? 1 : 0) + (Array.isArray(g?.pets) ? g.pets.filter(p => p && p.alive !== false).length : 0);
      const effectCount = Array.isArray(g?.effects) ? g.effects.length : 0;
      const damageTextCount = Array.isArray(g?.damageTexts) ? g.damageTexts.length : (Array.isArray(g?.damageText) ? g.damageText.length : 0);
      const entityCount = enemyCount + botCount + mercCount + petCount + 1;
      const inCombat = !!g?.inCombat || !!g?.player?.inCombat || enemyCount > 12 || effectCount > 20 || damageTextCount > 10;
      const yaw = num(g?.cameraYaw ?? g?.camera?.yaw ?? 0, 0);
      const zoom = num(g?.zoom ?? g?.cameraZoom ?? g?.camera?.zoom ?? 1, 1);
      const yawDelta = Math.abs(yaw - num(this.lastCamera.yaw, yaw));
      const zoomDelta = Math.abs(zoom - num(this.lastCamera.zoom, zoom));
      this.lastCamera = { yaw, zoom };
      return { currentZone, caveContext, enemyCount, botCount, mercCount, petCount, effectCount, damageTextCount, entityCount, inCombat, yaw, zoom, yawDelta, zoomDelta };
    }

    collect() {
      const cfg = this.settings();
      const render = this.readRenderData();
      const ctx = this.collectGameplayContext();
      const benchmark = readBenchmark(this.game, cfg);
      const rendererProfile = safeGet('dreamRealmsRendererPlayerProfile', render.stable.rendererProfile || 'auto') || 'auto';
      const rendererMode = this.game?.renderBackendMode || render.perf.renderBackendMode || render.backend.mode || 'canvas2d';
      const activeLayers = layerText(render.stable.activeLayers || render.finalShip.activeLayers || render.launch.activeLayers || render.perf.hybridCandidateActiveLayers);
      const blockedLayers = layerText(render.finalQa.blockedLayers || render.qa.heldOffLayers || render.stable.disabledLayers || render.perf.hybridFinalQaBlockedLayers);
      const maxFallback = num(cfg.finalGameplayQaMaxFallbackPressure, 18);
      const maxCost = num(cfg.finalGameplayQaMaxHybridCostMs, 11.0);
      const yawStress = num(cfg.finalGameplayQaCameraYawStressDeg, 18) * Math.PI / 180;
      const zoomStress = num(cfg.finalGameplayQaZoomStress, 0.16);
      const cameraStress = ctx.yawDelta > yawStress || ctx.zoomDelta > zoomStress;
      const combatEntityWarn = num(cfg.finalGameplayQaCombatEntityWarn, 24);
      const combatEffectWarn = num(cfg.finalGameplayQaCombatEffectWarn, 48);
      const cameraRisk = cameraStress ? 'stress' : 'low';
      const caveRisk = ctx.caveContext && render.fallbackPressure > num(cfg.finalGameplayQaCaveFallbackWarn, 12) ? 'elevated' : (ctx.caveContext ? 'watch' : 'low');
      const combatRisk = (ctx.entityCount >= combatEntityWarn || ctx.effectCount >= combatEffectWarn) ? 'stress' : (ctx.inCombat ? 'watch' : 'low');
      const rendererRisk = render.fallbackPressure > maxFallback || render.hybridCostMs > maxCost ? 'elevated' : 'low';
      const blockers = [];
      const warnings = [];
      if (render.stableLockScore < 82) blockers.push(`StableLock low ${Math.round(render.stableLockScore)}`);
      if (render.finalShipScore < 82) blockers.push(`FinalShip low ${Math.round(render.finalShipScore)}`);
      if (render.launchScore < 82) warnings.push(`LaunchValidation low ${Math.round(render.launchScore)}`);
      if (render.fallbackPressure > maxFallback) warnings.push(`fallback pressure ${Math.round(render.fallbackPressure)}/${Math.round(maxFallback)}`);
      if (render.hybridCostMs > maxCost) warnings.push(`Hybrid cost ${render.hybridCostMs.toFixed(1)}ms/${maxCost.toFixed(1)}ms`);
      if (ctx.caveContext && caveRisk === 'elevated') warnings.push('cave/fringe context has elevated fallback pressure');
      if (cameraStress) warnings.push('camera/zoom stress frame observed');
      if (combatRisk === 'stress') warnings.push('large combat visual load observed');
      if (blockedLayers !== 'none') warnings.push(`blocked layers: ${blockedLayers}`);
      if (!benchmark.ok && cfg.finalGameplayQaRequireBenchmark) blockers.push('benchmark missing or weak');
      let score = 100;
      score -= Math.max(0, 90 - render.stableLockScore) * 0.35;
      score -= Math.max(0, 90 - render.finalShipScore) * 0.35;
      score -= Math.max(0, 88 - render.launchScore) * 0.25;
      score -= Math.max(0, 86 - render.finalPerfScore) * 0.25;
      score -= Math.max(0, 84 - render.healthScore) * 0.20;
      score -= Math.max(0, render.fallbackPressure - maxFallback) * 1.2;
      score -= Math.max(0, render.hybridCostMs - maxCost) * 1.5;
      if (cameraStress) score -= 4;
      if (ctx.caveContext && caveRisk === 'elevated') score -= 8;
      if (combatRisk === 'stress') score -= 5;
      if (blockedLayers !== 'none') score -= 5;
      if (!benchmark.ok && cfg.finalGameplayQaRequireBenchmark) score -= 12;
      score = clamp(score, 0, 100, 0);
      const criticalFallback = render.fallbackPressure >= num(cfg.finalGameplayQaCriticalFallbackPressure, 52);
      const criticalCost = render.hybridCostMs >= num(cfg.finalGameplayQaCriticalHybridCostMs, 22);
      const critical = criticalFallback || criticalCost || score < 35;
      if (critical) {
        this.criticalFrames += 1;
        blockers.push(criticalFallback ? 'critical fallback pressure' : (criticalCost ? 'critical Hybrid frame cost' : 'critical gameplay QA score'));
      } else {
        this.criticalFrames = Math.max(0, this.criticalFrames - 1);
      }
      const minScore = num(cfg.finalGameplayQaMinScore, 90);
      const gameplayReady = this.enabled && !blockers.length && score >= minScore && render.fallbackPressure <= maxFallback && render.hybridCostMs <= maxCost;
      const status = !this.enabled ? 'disabled' : (blockers.length ? 'blocked' : (score >= minScore ? 'ready' : (warnings.length ? 'watch' : 'warming')));
      const recommendation = blockers.length
        ? `Fix blocker: ${blockers[0]}. Canvas Safe Mode remains available.`
        : (warnings.length ? `Watch: ${warnings[0]}. Run the 60-second benchmark after testing caves/combat.` : 'Gameplay QA path looks stable. Continue real gameplay testing before final release label.');
      return {
        enabled: this.enabled,
        score,
        status,
        gameplayReady,
        rendererProfile,
        rendererMode,
        currentZone: ctx.currentZone,
        caveContext: ctx.caveContext,
        combatContext: ctx.inCombat,
        cameraRisk,
        caveRisk,
        combatRisk,
        rendererRisk,
        fallbackPressure: render.fallbackPressure,
        hybridCostMs: render.hybridCostMs,
        stableLockScore: render.stableLockScore,
        finalShipScore: render.finalShipScore,
        launchValidationScore: render.launchScore,
        finalPerfQaScore: render.finalPerfScore,
        healthScore: render.healthScore,
        finalQaScore: render.finalQaScore,
        manifestScore: render.manifestScore,
        activeLayers,
        blockedLayers,
        entityCount: ctx.entityCount,
        effectCount: ctx.effectCount,
        damageTextCount: ctx.damageTextCount,
        enemyCount: ctx.enemyCount,
        botCount: ctx.botCount,
        mercCount: ctx.mercCount,
        petCount: ctx.petCount,
        cameraYawDelta: ctx.yawDelta,
        cameraZoomDelta: ctx.zoomDelta,
        benchmarkState: benchmark.state,
        benchmarkOk: benchmark.ok,
        benchmarkAvgFps: benchmark.avgFps,
        benchmarkP95FrameMs: benchmark.p95FrameMs,
        criticalFrames: this.criticalFrames,
        blockerCount: blockers.length,
        warningCount: warnings.length,
        blockers: blockers.join('; ') || 'none',
        warnings: warnings.join('; ') || 'none',
        recommendation,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        lastSampleIso: iso()
      };
    }

    applyCriticalSafety(sample) {
      const cfg = this.settings();
      if (!sample || cfg.finalGameplayQaAutoCanvasOnCritical === false) return;
      // This safety net protects the hybrid-webgl-prototype pipeline.
      if (sample.criticalFrames < 3) return;
      if (this._forcingCanvas) return;
      this._forcingCanvas = true;
      try {
        const reason = `final gameplay QA critical safety: ${sample.blockers || 'renderer risk'}`;
        if (typeof this.game?.forceFinalPerformanceCanvasSafeMode === 'function') this.game.forceFinalPerformanceCanvasSafeMode(reason);
        else if (typeof this.game?.ensureHybridDefaultCandidateSystem === 'function') this.game.ensureHybridDefaultCandidateSystem()?.forceCanvasCompatibility?.(reason);
        else {
          this.game?.setRendererPlayerProfile?.('canvas', reason);
          this.game?.setRenderBackendMode?.('canvas2d', reason);
          safeSet('dreamRealmsRendererPlayerProfile', 'canvas');
          safeSet('dreamRealmsHybridDefaultRolloutPolicy', 'canvas');
        }
        this.lastAction = 'forced Canvas Safe Mode';
        this.lastReason = reason;
        this.criticalFrames = 0;
      } catch (_err) {
      } finally {
        this._forcingCanvas = false;
      }
    }

    sample(force = false) {
      const cfg = this.settings();
      const t = nowMs();
      if (!force && t - this.lastSampleMs < num(cfg.finalGameplayQaSampleMs, 1200)) return this.metrics;
      this.lastSampleMs = t;
      const sample = this.collect();
      this.metrics = sample;
      const entry = {
        t: Date.now ? Date.now() : 0,
        score: sample.score,
        status: sample.status,
        gameplayReady: sample.gameplayReady,
        caveContext: sample.caveContext,
        combatContext: sample.combatContext,
        cameraRisk: sample.cameraRisk,
        caveRisk: sample.caveRisk,
        combatRisk: sample.combatRisk,
        rendererRisk: sample.rendererRisk,
        fallbackPressure: sample.fallbackPressure,
        hybridCostMs: sample.hybridCostMs,
        blockers: sample.blockers,
        warnings: sample.warnings
      };
      this.history.push(entry);
      const limit = Math.max(12, Math.floor(num(cfg.finalGameplayQaHistoryLimit, 120)));
      while (this.history.length > limit) this.history.shift();
      sample.sampleCount = this.history.length;
      sample.avgScore = avg(this.history, 'score');
      this.metrics = sample;
      writeJson(`${STORAGE_PREFIX}:history`, this.history);
      this.applyCriticalSafety(sample);
      this.syncPerfStats();
      return sample;
    }

    snapshot(force = false) { return Object.assign({}, this.sample(force) || this.metrics || this.defaultMetrics()); }
    clear(reason = 'manual clear') {
      this.history = [];
      this.criticalFrames = 0;
      writeJson(`${STORAGE_PREFIX}:history`, this.history);
      this.lastAction = 'cleared';
      this.lastReason = reason;
      this.metrics = this.defaultMetrics();
      this.syncPerfStats();
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
    exportPayload() {
      const cfg = this.settings();
      const limit = Math.max(1, Math.floor(num(cfg.finalGameplayQaExportHistoryLimit, 120)));
      return {
        kind: 'dream-realms-final-gameplay-qa-fixes',
        version: window.DREAM_REALMS_VERSION || '0.15.44',
        buildName: window.DREAM_REALMS_BUILD_NAME || '',
        createdAt: iso(),
        snapshot: this.snapshot(true),
        history: this.history.slice(-limit)
      };
    }
    textReport() {
      const s = this.snapshot(true);
      return [
        `Dream Realms ${window.DREAM_REALMS_VERSION || ''} — Final Gameplay QA Fixes`,
        `Status: ${s.status} (${Math.round(s.score || 0)}/100), gameplay-ready ${s.gameplayReady ? 'yes' : 'no'}`,
        `Renderer: ${s.rendererProfile}/${s.rendererMode}; layers active ${s.activeLayers}; blocked ${s.blockedLayers}`,
        `Zone: ${s.currentZone}; cave ${s.caveContext ? 'yes' : 'no'}; combat ${s.combatContext ? 'yes' : 'no'}`,
        `Camera risk: ${s.cameraRisk}; cave risk: ${s.caveRisk}; combat risk: ${s.combatRisk}; renderer risk: ${s.rendererRisk}`,
        `Entities: ${Math.round(s.entityCount || 0)} total, enemies ${Math.round(s.enemyCount || 0)}, bots ${Math.round(s.botCount || 0)}, mercs ${Math.round(s.mercCount || 0)}, pets ${Math.round(s.petCount || 0)}`,
        `Effects: ${Math.round(s.effectCount || 0)}, damage text ${Math.round(s.damageTextCount || 0)}`,
        `Fallback pressure: ${Math.round(s.fallbackPressure || 0)}, Hybrid cost ${(s.hybridCostMs || 0).toFixed(1)}ms`,
        `Benchmark: ${s.benchmarkState}, FPS ${Math.round(s.benchmarkAvgFps || 0)}, p95 ${(s.benchmarkP95FrameMs || 0).toFixed(1)}ms`,
        `Warnings: ${s.warnings || 'none'}`,
        `Blockers: ${s.blockers || 'none'}`,
        `Recommendation: ${s.recommendation || ''}`
      ].join('\n');
    }
    summary() {
      const s = this.snapshot(true);
      return `FinalGameplayQA ${Math.round(s.score || 0)}/100 ${s.status || 'warming'}; ready ${s.gameplayReady ? 'yes' : 'no'}; zone ${s.currentZone}; cave ${s.caveRisk}; combat ${s.combatRisk}; renderer ${s.rendererRisk}; blockers ${s.blockers || 'none'}`;
    }
    syncPerfStats() {
      const perf = this.game.perfStats = this.game.perfStats || {};
      const s = this.metrics || this.defaultMetrics();
      perf.finalGameplayQaFixesEnabled = !!this.enabled;
      perf.finalGameplayQaFixesScore = num(s.score, 0);
      perf.finalGameplayQaFixesAvgScore = num(s.avgScore, 0);
      perf.finalGameplayQaFixesStatus = s.status || 'warming';
      perf.finalGameplayQaFixesReady = !!s.gameplayReady;
      perf.finalGameplayQaFixesBlockers = s.blockers || 'none';
      perf.finalGameplayQaFixesWarnings = s.warnings || 'none';
      perf.finalGameplayQaFixesCameraRisk = s.cameraRisk || 'low';
      perf.finalGameplayQaFixesCaveRisk = s.caveRisk || 'low';
      perf.finalGameplayQaFixesCombatRisk = s.combatRisk || 'low';
      perf.finalGameplayQaFixesRendererRisk = s.rendererRisk || 'low';
      perf.finalGameplayQaFixesLastAction = this.lastAction || '';
      perf.finalGameplayQaFixesLastReason = this.lastReason || '';
    }
  }

  function settingsBlock(game) {
    const snap = game?.ensureFinalGameplayQaFixesSystem?.().snapshot?.() || {};
    const color = snap.gameplayReady ? '#a6d15f' : (snap.status === 'blocked' ? '#d4665a' : '#d6b35a');
    return `
      <div class="settingsSectionTitle">Final Gameplay QA Fixes</div>
      <div class="small" style="margin-bottom:8px">Final gameplay-route QA for camera, caves, large fights, Hybrid fallback pressure, and Canvas Safe Mode safety.</div>
      <div class="settingsRow"><span>Gameplay QA Gate</span><button class="toggleBtn ${snap.enabled ? 'active' : ''}" data-final-gameplay-qa-toggle="1">${snap.enabled ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>Status</span><b style="color:${color}">${esc(snap.status || 'warming')} · ${Math.round(num(snap.score, 0))}/100</b></div>
      <div class="settingsRow"><span>Gameplay Ready</span><b>${snap.gameplayReady ? 'Yes' : 'No'}</b></div>
      <div class="settingsRow"><span>Renderer</span><span>${esc(snap.rendererProfile || 'auto')} / ${esc(snap.rendererMode || 'canvas2d')}</span></div>
      <div class="settingsRow"><span>Zone / Context</span><span>${esc(snap.currentZone || 'overworld')} · cave ${snap.caveContext ? 'yes' : 'no'} · combat ${snap.combatContext ? 'yes' : 'no'}</span></div>
      <div class="settingsRow"><span>Risks</span><span>camera ${esc(snap.cameraRisk || 'low')} · cave ${esc(snap.caveRisk || 'low')} · combat ${esc(snap.combatRisk || 'low')} · renderer ${esc(snap.rendererRisk || 'low')}</span></div>
      <div class="settingsRow"><span>Load</span><span>${Math.round(num(snap.entityCount, 0))} entities · ${Math.round(num(snap.effectCount, 0))} effects · ${Math.round(num(snap.damageTextCount, 0))} text</span></div>
      <div class="settingsRow"><span>Fallback / Cost</span><span>${Math.round(num(snap.fallbackPressure, 0))} / ${num(snap.hybridCostMs, 0).toFixed(1)}ms</span></div>
      <div class="settingsRow"><span>Layers</span><span>active ${esc(snap.activeLayers || 'none')} · blocked ${esc(snap.blockedLayers || 'none')}</span></div>
      <div class="settingsRow"><span>Benchmark</span><span>${esc(snap.benchmarkState || 'missing')} · ${Math.round(num(snap.benchmarkAvgFps, 0))} FPS · p95 ${num(snap.benchmarkP95FrameMs, 0).toFixed(1)}ms</span></div>
      <div class="small" style="margin-top:4px;color:#d6b35a">Warnings: ${esc(snap.warnings || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#d4665a">Blockers: ${esc(snap.blockers || 'none')}</div>
      <div class="small" style="margin-top:4px;color:#9fb59c">${esc(snap.recommendation || '')}</div>
      <div class="settingsRow" style="gap:6px; flex-wrap:wrap">
        <button class="toggleBtn" data-final-gameplay-qa-benchmark="1">Run Gameplay QA Benchmark</button>
        <button class="toggleBtn" data-final-gameplay-qa-export-json="1">Export Gameplay QA JSON</button>
        <button class="toggleBtn" data-final-gameplay-qa-export-text="1">Export Gameplay QA TXT</button>
        <button class="toggleBtn" data-final-gameplay-qa-copy="1">Copy Summary</button>
        <button class="toggleBtn" data-final-gameplay-qa-clear="1">Clear Samples</button>
        <button class="toggleBtn" data-final-gameplay-qa-canvas="1">Force Canvas Safe Mode</button>
      </div>
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drFinalGameplayQaFixesInstalled) return;
    Game.prototype.__drFinalGameplayQaFixesInstalled = true;

    Game.prototype.ensureFinalGameplayQaFixesSystem = function() {
      if (!this.finalGameplayQaFixesSystem) this.finalGameplayQaFixesSystem = new FinalGameplayQaFixesSystem(this);
      return this.finalGameplayQaFixesSystem;
    };
    Game.prototype.getFinalGameplayQaFixesSnapshot = function() { return this.ensureFinalGameplayQaFixesSystem?.().snapshot?.() || null; };
    Game.prototype.toggleFinalGameplayQaFixes = function() {
      const sys = this.ensureFinalGameplayQaFixesSystem?.();
      const enabled = sys?.setEnabled?.(!sys.enabled, 'settings toggle') || false;
      this.logSystem?.(`Final Gameplay QA Fixes: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.(); this.markUiDirty?.('final gameplay qa toggle'); return enabled;
    };
    Game.prototype.clearFinalGameplayQaFixes = function() {
      this.ensureFinalGameplayQaFixesSystem?.().clear?.('settings clear');
      this.logSystem?.('Final gameplay QA samples cleared.'); this.renderSettingsPanel?.(); this.markUiDirty?.('final gameplay qa clear'); return true;
    };
    Game.prototype.exportFinalGameplayQaFixesJson = function() {
      const payload = this.ensureFinalGameplayQaFixesSystem?.().exportPayload?.() || {};
      const ok = downloadJson(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.44'}-final-gameplay-qa.json`, payload);
      this.logSystem?.(ok ? 'Final gameplay QA JSON exported.' : 'Final gameplay QA JSON export failed.'); return payload;
    };
    Game.prototype.exportFinalGameplayQaFixesText = function() {
      const text = this.ensureFinalGameplayQaFixesSystem?.().textReport?.() || '';
      const ok = downloadText(`dream-realms-v${window.DREAM_REALMS_VERSION || '0.15.44'}-final-gameplay-qa.txt`, text, 'text/plain');
      this.logSystem?.(ok ? 'Final gameplay QA TXT exported.' : 'Final gameplay QA TXT export failed.'); return text;
    };
    Game.prototype.copyFinalGameplayQaFixesSummary = async function() {
      const text = this.ensureFinalGameplayQaFixesSystem?.().summary?.() || 'Final gameplay QA unavailable.';
      try { await navigator.clipboard?.writeText?.(text); this.logSystem?.('Final gameplay QA summary copied.'); }
      catch (_err) { this.logSystem?.(text); }
      return text;
    };
    Game.prototype.runFinalGameplayQaBenchmark = function(seconds = 60) {
      if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('final gameplay qa toggle');
      return this.startPerformanceBenchmark?.(seconds);
    };
    Game.prototype.forceFinalGameplayQaCanvasSafeMode = function(reason = 'settings force') {
      if (typeof this.forceFinalPerformanceCanvasSafeMode === 'function') this.forceFinalPerformanceCanvasSafeMode(`final gameplay QA: ${reason}`);
      else this.ensureHybridDefaultCandidateSystem?.().forceCanvasCompatibility?.(`final gameplay QA: ${reason}`);
      this.renderSettingsPanel?.(); this.markUiDirty?.('final gameplay qa canvas'); return true;
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drFinalGameplayQaFixesWrapped) {
      const wrappedRender = function(...args) {
        const result = originalRender.apply(this, args);
        try { this.ensureFinalGameplayQaFixesSystem?.().sample?.(false); } catch (_err) {}
        return result;
      };
      wrappedRender.__drFinalGameplayQaFixesWrapped = true;
      Game.prototype.render = wrappedRender;
    }

    const originalSettings = Game.prototype.renderSettingsPanel;
    if (typeof originalSettings === 'function' && !originalSettings.__drFinalGameplayQaFixesWrapped) {
      const wrappedSettings = function(...args) {
        const result = originalSettings.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list && !list.querySelector('[data-final-gameplay-qa-block]')) {
            const block = document.createElement('div');
            block.setAttribute('data-final-gameplay-qa-block', '1');
            block.innerHTML = settingsBlock(this);
            list.appendChild(block);
          }
          list?.querySelector('[data-final-gameplay-qa-toggle]')?.addEventListener('click', () => this.toggleFinalGameplayQaFixes?.());
          list?.querySelector('[data-final-gameplay-qa-benchmark]')?.addEventListener('click', () => this.runFinalGameplayQaBenchmark?.(60));
          list?.querySelector('[data-final-gameplay-qa-export-json]')?.addEventListener('click', () => this.exportFinalGameplayQaFixesJson?.());
          list?.querySelector('[data-final-gameplay-qa-export-text]')?.addEventListener('click', () => this.exportFinalGameplayQaFixesText?.());
          list?.querySelector('[data-final-gameplay-qa-copy]')?.addEventListener('click', () => this.copyFinalGameplayQaFixesSummary?.());
          list?.querySelector('[data-final-gameplay-qa-clear]')?.addEventListener('click', () => this.clearFinalGameplayQaFixes?.());
          list?.querySelector('[data-final-gameplay-qa-canvas]')?.addEventListener('click', () => this.forceFinalGameplayQaCanvasSafeMode?.('settings force'));
        } catch (err) { this.recordRuntimeSystemFault?.({ id: 'final-gameplay-qa-fixes' }, 'settings listeners', err); }
        return result;
      };
      wrappedSettings.__drFinalGameplayQaFixesWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedSettings;
    }

    const originalDebug = Game.prototype.updateDebugOverlay;
    if (typeof originalDebug === 'function' && !originalDebug.__drFinalGameplayQaFixesWrapped) {
      const wrappedDebug = function(force = false, ...rest) {
        const result = originalDebug.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugOverlayBody') || document.getElementById('debugBody');
          if (!body || (!this.debugOverlayOpen && !force && DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay !== true)) return result;
          const snap = this.ensureFinalGameplayQaFixesSystem?.().snapshot?.();
          if (!snap || String(body.textContent || '').includes('FinalGameplayQA:')) return result;
          const line = `FinalGameplayQA: ${Math.round(snap.score || 0)}/100 ${snap.status || 'warming'}, ready ${snap.gameplayReady ? 'yes' : 'no'}, zone ${snap.currentZone || 'overworld'}, cave ${snap.caveRisk || 'low'}, combat ${snap.combatRisk || 'low'}, ${snap.blockers || 'none'}`;
          body.textContent = `${body.textContent || ''}\n${line}`;
        } catch (_err) {}
        return result;
      };
      wrappedDebug.__drFinalGameplayQaFixesWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedDebug;
    }
  }

  DR.FinalGameplayQaFixesSystem = { install, FinalGameplayQaFixesSystem };
})();
