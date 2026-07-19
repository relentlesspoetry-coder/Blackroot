// Dream Realms performance verification system
// V0.15.31: performance panel includes Hybrid renderer QA guardrail status and holdoff reset.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE = Object.freeze({
    preset: 'dreamRealmsPerformancePreset',
    legacyMode: 'dreamRealmsPerformanceMode',
    lowSpec: 'dreamRealmsLowSpecMode',
    lastBenchmark: 'dreamRealmsLastPerformanceBenchmark',
    benchmarkHistory: 'dreamRealmsBenchmarkHistory'
  });

  const PRESETS = Object.freeze({
    quality: Object.freeze({
      label: 'Quality',
      description: 'Best visuals. Use only if frame time is stable.',
      overrides: Object.freeze({
        mode: 'quality',
        sharpEntityModelRendering: true,
        modelImageSmoothing: false,
        maxDpr: 1.45,
        highQualityMaxDpr: 1.6,
        renderPad: 22,
        enableWeatherForeground: true,
        enableWeatherSkyOverlay: true,
        enableSunShafts: true,
        enableDustMotes: true,
        entityCullPadPx: 1040,
        effectCullPadPx: 820,
        damageTextCullPadPx: 620,
        objectCullPadPx: 1020,
        maxActiveEffects: 360,
        maxDamageText: 84,
        uiFastCombatInterval: 0.08,
        uiFastIdleInterval: 0.16,
        uiFullCombatInterval: 0.35,
        uiFullIdleInterval: 0.65,
        debugOverlayInterval: 0.20
      })
    }),
    balanced: Object.freeze({
      label: 'Balanced',
      description: 'Default target. Keeps visuals while avoiding high-DPR pixel cost.',
      overrides: Object.freeze({
        mode: 'balanced',
        sharpEntityModelRendering: true,
        modelImageSmoothing: false,
        maxDpr: 1.25,
        highQualityMaxDpr: 1.25,
        renderPad: 19,
        enableWeatherForeground: true,
        enableWeatherSkyOverlay: true,
        enableSunShafts: true,
        enableDustMotes: true,
        entityCullPadPx: 880,
        effectCullPadPx: 680,
        damageTextCullPadPx: 520,
        objectCullPadPx: 860,
        maxActiveEffects: 300,
        maxDamageText: 68
      })
    }),
    performance: Object.freeze({
      label: 'Performance',
      description: 'Lower pixel cost, tighter culling, slower expensive UI refreshes.',
      overrides: Object.freeze({
        mode: 'performance',
        sharpEntityModelRendering: true,
        modelImageSmoothing: false,
        maxDpr: 1.12,
        highQualityMaxDpr: 1.12,
        renderPad: 17,
        enableSunShafts: false,
        enableDustMotes: true,
        enableWeatherSkyOverlay: true,
        entityCullPadPx: 760,
        effectCullPadPx: 560,
        damageTextCullPadPx: 420,
        objectCullPadPx: 700,
        maxActiveEffects: 240,
        maxDamageText: 56,
        minimapInterval: 0.50,
        worldMapInterval: 0.35,
        uiFastCombatInterval: 0.12,
        uiFastIdleInterval: 0.22,
        uiFullCombatInterval: 0.65,
        uiFullIdleInterval: 1.10,
        uiPanelInterval: 0.85,
        pathWorkerMaxRequestsPerFrame: 18,
        midAiInterval: 0.30,
        farAiInterval: 1.20,
        sleepAiInterval: 6.0,
        spriteCacheMaxEntries: 1600
      })
    }),
    rescue: Object.freeze({
      label: 'Rescue',
      description: 'Hard low-cost mode for weak GPUs, Steam Deck load spikes, or browser throttling.',
      overrides: Object.freeze({
        mode: 'rescue',
        sharpEntityModelRendering: true,
        modelImageSmoothing: false,
        maxDpr: 1.0,
        highQualityMaxDpr: 1.0,
        renderPad: 14,
        enableSunShafts: false,
        enableDustMotes: false,
        enableWeatherForeground: true,
        enableWeatherSkyOverlay: true,
        entityCullPadPx: 620,
        effectCullPadPx: 440,
        damageTextCullPadPx: 340,
        objectCullPadPx: 560,
        maxActiveEffects: 170,
        maxDamageText: 36,
        minimapInterval: 0.75,
        worldMapInterval: 0.60,
        uiFastCombatInterval: 0.16,
        uiFastIdleInterval: 0.30,
        uiFullCombatInterval: 0.90,
        uiFullIdleInterval: 1.50,
        uiPanelInterval: 1.15,
        pathWorkerMaxPending: 72,
        pathWorkerMaxRequestsPerFrame: 14,
        midAiInterval: 0.35,
        farAiInterval: 1.50,
        sleepAiInterval: 7.0,
        spriteCacheMaxEntries: 1200,
        renderItemPoolMaxEntries: 7000
      })
    })
  });

  function storageGet(key, fallback = '') {
    try {
      const value = window.localStorage?.getItem?.(key);
      return value == null || value === '' ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try { window.localStorage?.setItem?.(key, String(value)); } catch (_) {}
  }

  function storageRemove(key) {
    try { window.localStorage?.removeItem?.(key); } catch (_) {}
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function percentile(sorted, ratio) {
    if (!sorted.length) return 0;
    const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index] || 0;
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + (Number(value) || 0), 0) / values.length;
  }

  function perSecond(delta, seconds) {
    const d = Math.max(0, Number(delta) || 0);
    const s = Math.max(0.001, Number(seconds) || 0);
    return d / s;
  }

  function topCounterList(items, limit = 3) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, Math.max(0, limit)).map(item => `${item.model || 'unknown'}:${item.count || 0}`);
  }

  class PerformanceVerificationSystem {
    constructor(game, options = {}) {
      this.game = game;
      const perf = DR.CONFIG?.PERFORMANCE || {};
      const stored = storageGet(STORAGE.preset, storageGet(STORAGE.legacyMode, perf.mode || 'balanced'));
      this.preset = PRESETS[stored] ? stored : 'balanced';
      this.lowSpecMode = storageGet(STORAGE.lowSpec, 'false') === 'true';
      this.benchmarkDurationSec = clampNumber(options.benchmarkDurationSec || perf.benchmarkDurationSec || 60, 5, 600, 60);
      this.hotspotSampleWindow = clampNumber(options.hotspotSampleWindow || perf.hotspotSampleWindow || 240, 60, 1200, 240);
      this.resizeRequested = false;
      this.samples = [];
      this.frameCounter = 0;
      this.hotspot = { area: 'pending', reason: 'Collecting samples.', score: 0 };
      this.benchmark = null;
      this.lastBenchmark = this.readLastBenchmark();
      this.benchmarkHistory = this.readBenchmarkHistory();
      this.lastModeChangeReason = 'boot';
    }

    readLastBenchmark() {
      const raw = storageGet(STORAGE.lastBenchmark, '');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (_) { return null; }
    }

    readBenchmarkHistory() {
      const raw = storageGet(STORAGE.benchmarkHistory, '');
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }

    persistBenchmarkResult(result) {
      if (!result) return;
      const perf = DR.CONFIG?.PERFORMANCE || {};
      const limit = Math.max(1, Math.floor(Number(perf.benchmarkHistoryLimit) || 8));
      const history = Array.isArray(this.benchmarkHistory) ? this.benchmarkHistory.slice() : [];
      history.unshift(result);
      this.benchmarkHistory = history.slice(0, limit);
      storageSet(STORAGE.lastBenchmark, JSON.stringify(result));
      storageSet(STORAGE.benchmarkHistory, JSON.stringify(this.benchmarkHistory));
    }

    currentPresetDef() {
      return PRESETS[this.preset] || PRESETS.balanced;
    }

    beginFrame() {
      this.frameCounter = (this.frameCounter + 1) >>> 0;
    }

    effectiveBaseSettings(baseSettings) {
      const base = Object.assign({}, baseSettings || DR.CONFIG?.PERFORMANCE || {});
      const presetDef = this.currentPresetDef();
      Object.assign(base, presetDef.overrides || {});
      base.mode = this.preset;
      if (this.lowSpecMode) {
        base.lowSpecMode = true;
        base.maxDpr = Math.min(Number(base.maxDpr || 1.25), 1.0);
        base.highQualityMaxDpr = Math.min(Number(base.highQualityMaxDpr || 1.25), 1.0);
        base.renderPad = Math.max(12, Math.min(Number(base.renderPad || 20), 14));
        base.enableSunShafts = false;
        base.enableDustMotes = true;
        base.enableWeatherSkyOverlay = true;
        base.enableWeatherForeground = true;
        base.entityCullPadPx = Math.min(Number(base.entityCullPadPx || 760), 580);
        base.effectCullPadPx = Math.min(Number(base.effectCullPadPx || 560), 390);
        base.damageTextCullPadPx = Math.min(Number(base.damageTextCullPadPx || 420), 300);
        base.objectCullPadPx = Math.min(Number(base.objectCullPadPx || 700), 520);
        base.maxActiveEffects = Math.min(Number(base.maxActiveEffects || 240), 150);
        base.maxDamageText = Math.min(Number(base.maxDamageText || 56), 30);
        base.minimapInterval = Math.max(Number(base.minimapInterval || 0.5), 0.9);
        base.worldMapInterval = Math.max(Number(base.worldMapInterval || 0.35), 0.75);
        base.uiFastCombatInterval = Math.max(Number(base.uiFastCombatInterval || 0.12), 0.18);
        base.uiFastIdleInterval = Math.max(Number(base.uiFastIdleInterval || 0.22), 0.34);
        base.uiFullCombatInterval = Math.max(Number(base.uiFullCombatInterval || 0.65), 1.05);
        base.uiFullIdleInterval = Math.max(Number(base.uiFullIdleInterval || 1.10), 1.70);
        base.uiPanelInterval = Math.max(Number(base.uiPanelInterval || 0.85), 1.25);
        base.pathWorkerMaxRequestsPerFrame = Math.min(Number(base.pathWorkerMaxRequestsPerFrame || 18), 12);
        base.midAiInterval = Math.max(Number(base.midAiInterval || 0.30), 0.40);
        base.farAiInterval = Math.max(Number(base.farAiInterval || 1.2), 1.70);
        base.sleepAiInterval = Math.max(Number(base.sleepAiInterval || 6.0), 8.0);
        base.spriteCacheMaxEntries = Math.min(Number(base.spriteCacheMaxEntries || 1600), 1000);
        base.renderItemPoolMaxEntries = Math.min(Number(base.renderItemPoolMaxEntries || 8000), 6000);
      }
      base.performancePreset = this.preset;
      return base;
    }

    applyPresetRuntimeSettings(reason = 'settings') {
      if (!this.game) return;
      this.game.performanceMode = this.preset;
      if (!this.game.perfStats) this.game.perfStats = {};
      this.game.perfStats.performancePreset = this.preset;
      this.game.perfStats.performancePresetLabel = this.currentPresetDef().label;
      this.game.perfStats.lowSpecMode = !!this.lowSpecMode;
      this.game.runtimeSpriteCache?.clear?.();
      this.game.markUiDirty?.(`performance ${reason}`);
    }

    setPreset(preset, reason = 'manual') {
      const next = PRESETS[preset] ? preset : 'balanced';
      const changed = next !== this.preset;
      this.preset = next;
      this.lastModeChangeReason = reason;
      storageSet(STORAGE.preset, next);
      storageSet(STORAGE.legacyMode, next);
      this.applyPresetRuntimeSettings(reason);
      this.requestResize();
      return changed;
    }

    cyclePreset() {
      const order = ['quality', 'balanced', 'performance', 'rescue'];
      const index = order.indexOf(this.preset);
      const next = order[(index + 1 + order.length) % order.length];
      this.setPreset(next, 'cycle');
      return next;
    }

    setLowSpecMode(enabled, reason = 'manual') {
      const next = !!enabled;
      const changed = next !== this.lowSpecMode;
      this.lowSpecMode = next;
      this.lastModeChangeReason = reason;
      storageSet(STORAGE.lowSpec, next ? 'true' : 'false');
      this.applyPresetRuntimeSettings(reason);
      this.requestResize();
      return changed;
    }

    toggleLowSpecMode() {
      this.setLowSpecMode(!this.lowSpecMode, 'toggle');
      return this.lowSpecMode;
    }

    resetSettings() {
      this.preset = 'balanced';
      this.lowSpecMode = false;
      this.lastModeChangeReason = 'reset';
      storageRemove(STORAGE.preset);
      storageRemove(STORAGE.lowSpec);
      storageSet(STORAGE.legacyMode, 'balanced');
      this.applyPresetRuntimeSettings('reset');
      this.requestResize();
    }

    requestResize() {
      this.resizeRequested = true;
    }

    consumeResizeRequest() {
      const requested = !!this.resizeRequested;
      this.resizeRequested = false;
      return requested;
    }

    pushSample(perfStats) {
      if (!perfStats) return;
      const cacheStats = this.game?.runtimeSpriteCache?.snapshotStats?.() || {};
      const pathMetrics = this.game?.pathWorkerMetrics || {};
      const sample = {
        frameMs: Number(perfStats.frameMs) || 0,
        updateMs: Number(perfStats.updateMs) || 0,
        renderMs: Number(perfStats.renderMs) || 0,
        uiMs: Number(perfStats.uiUpdateMs) || 0,
        queueBuildMs: Number(perfStats.renderQueueBuildMs) || 0,
        queueSortMs: Number(perfStats.renderQueueSortMs) || 0,
        spriteMisses: Number(cacheStats.missesThisFrame || 0),
        spriteGenerated: Number(cacheStats.generatedThisFrame || 0),
        spriteBudgetSkips: Number(cacheStats.budgetSkipsThisFrame || 0),
        spriteEvictions: Number(cacheStats.evictionsThisFrame || 0),
        pathFallbacks: Number(pathMetrics.syncFallbacks || 0),
        pathFrameBudgetSkips: Number(pathMetrics.frameBudgetSkips || 0),
        pathPendingCapSkips: Number(pathMetrics.pendingCapSkips || 0),
        pathCooldownRejects: Number(pathMetrics.cooldownRejects || 0),
        aiAwake: Number(perfStats.enemiesAwake) || 0,
        aiThrottled: Number(perfStats.enemiesThrottled) || 0,
        effectsQueued: Number(perfStats.effectsQueued) || 0,
        effectsDropped: Number(perfStats.effectsDropped) || 0,
        objectsCulled: Number(perfStats.objectsCulled) || 0,
        entitiesDrawn: Number(perfStats.entitiesDrawn) || 0
      };
      if (!sample.frameMs) return;
      this.samples.push(sample);
      while (this.samples.length > this.hotspotSampleWindow) this.samples.shift();
    }

    classifyHotspot() {
      const samples = this.samples;
      if (samples.length < 20) {
        this.hotspot = { area: 'warming', reason: `${samples.length}/${Math.min(20, this.hotspotSampleWindow)} samples`, score: samples.length };
        return this.hotspot;
      }
      const avgFrame = average(samples.map(s => s.frameMs));
      const avgRender = average(samples.map(s => s.renderMs));
      const avgUpdate = average(samples.map(s => s.updateMs));
      const avgUi = average(samples.map(s => s.uiMs));
      const avgQueue = average(samples.map(s => s.queueBuildMs + s.queueSortMs));
      const avgAiAwake = average(samples.map(s => s.aiAwake));
      const avgAiThrottled = average(samples.map(s => s.aiThrottled));
      const lastPathFallback = samples[samples.length - 1]?.pathFallbacks || 0;
      const avgSpriteGenerated = average(samples.map(s => s.spriteGenerated));
      const avgSpriteBudgetSkips = average(samples.map(s => s.spriteBudgetSkips || 0));
      const avgSpriteEvictions = average(samples.map(s => s.spriteEvictions || 0));
      const last = samples[samples.length - 1] || {};
      const pathPressure = (Number(last.pathFallbacks || 0) > 0 ? 5 : 0) + Number(last.pathFrameBudgetSkips || 0) * 0.2 + Number(last.pathPendingCapSkips || 0) * 0.4 + Number(last.pathCooldownRejects || 0) * 0.1;
      const frameSorted = samples.map(s => s.frameMs).sort((a, b) => a - b);
      const p95Frame = percentile(frameSorted, 0.95);

      const candidates = [
        { area: 'render', score: avgRender, reason: `render ${avgRender.toFixed(1)}ms / frame ${avgFrame.toFixed(1)}ms` },
        { area: 'update', score: avgUpdate, reason: `update ${avgUpdate.toFixed(1)}ms / frame ${avgFrame.toFixed(1)}ms` },
        { area: 'ui', score: avgUi * 1.75, reason: `UI ${avgUi.toFixed(1)}ms` },
        { area: 'render queue', score: avgQueue * 1.35, reason: `queue build/sort ${avgQueue.toFixed(1)}ms` },
        { area: 'sprite cache', score: avgSpriteGenerated * 0.55 + avgSpriteBudgetSkips * 0.25 + avgSpriteEvictions * 0.35, reason: `generated ${avgSpriteGenerated.toFixed(1)} cached frames/frame, skips ${avgSpriteBudgetSkips.toFixed(1)}, evict ${avgSpriteEvictions.toFixed(1)}` },
        { area: 'pathfinding worker', score: pathPressure, reason: `fallback ${lastPathFallback}, budget ${last.pathFrameBudgetSkips || 0}, cap ${last.pathPendingCapSkips || 0}, cooldown ${last.pathCooldownRejects || 0}` },
        { area: 'AI budget', score: avgAiAwake > 55 && avgAiThrottled < avgAiAwake ? 8 : 0, reason: `awake ${avgAiAwake.toFixed(0)} throttled ${avgAiThrottled.toFixed(0)}` }
      ].sort((a, b) => b.score - a.score);
      const top = candidates[0] || { area: 'unknown', reason: 'no sample', score: 0 };
      this.hotspot = {
        area: top.area,
        reason: `${top.reason}, p95 ${p95Frame.toFixed(1)}ms`,
        score: top.score,
        avgFrameMs: avgFrame,
        avgRenderMs: avgRender,
        avgUpdateMs: avgUpdate,
        avgUiMs: avgUi,
        p95FrameMs: p95Frame,
        recommendation: this.recommendationFor(top.area, { avgFrame, avgRender, avgUpdate, avgUi, avgQueue, avgSpriteGenerated, avgSpriteBudgetSkips, avgSpriteEvictions, pathPressure, avgAiAwake, avgAiThrottled })
      };
      return this.hotspot;
    }

    recommendationFor(area, data = {}) {
      switch (area) {
        case 'render':
          return 'Lower DPR/render pad or continue toward a batched WebGL world renderer.';
        case 'update':
          return 'Inspect AI/combat update loops; tighten distance throttles and avoid full entity scans.';
        case 'ui':
          return 'Reduce full panel rebuild frequency and keep HUD updates value-only.';
        case 'render queue':
          return 'Cull before queue insertion and reduce sort pressure from far props/entities.';
        case 'sprite cache':
          return 'Check top miss models; bounded animation buckets should keep cached frame generation finite.';
        case 'pathfinding worker':
          return 'Path worker is under pressure; reuse routes, raise frame budget only if update ms is low, or tighten repath intervals.';
        case 'AI budget':
          return 'Too many mobs are awake; increase far/sleep intervals or shrink active AI radius.';
        default:
          return 'Collect more samples or run the 60-second benchmark.';
      }
    }

    startBenchmark(durationSec = this.benchmarkDurationSec) {
      const duration = clampNumber(durationSec, 5, 600, this.benchmarkDurationSec);
      this.benchmark = {
        active: true,
        startedAt: performance.now?.() || Date.now(),
        durationSec: duration,
        elapsedSec: 0,
        frames: 0,
        frameMs: [],
        updateMs: [],
        renderMs: [],
        uiMs: [],
        queueMs: [],
        aiAwake: [],
        pathFallbackStart: Number(this.game?.pathWorkerMetrics?.syncFallbacks || 0),
        pathFrameBudgetStart: Number(this.game?.pathWorkerMetrics?.frameBudgetSkips || 0),
        pathPendingCapStart: Number(this.game?.pathWorkerMetrics?.pendingCapSkips || 0),
        pathCooldownStart: Number(this.game?.pathWorkerMetrics?.cooldownRejects || 0),
        spriteMissStart: Number(this.game?.runtimeSpriteCache?.snapshotStats?.()?.misses || 0),
        spriteEvictionStart: Number(this.game?.runtimeSpriteCache?.snapshotStats?.()?.evictions || 0)
      };
      return this.benchmark;
    }

    stopBenchmark(reason = 'manual') {
      if (!this.benchmark) return this.lastBenchmark;
      const bench = this.benchmark;
      bench.active = false;
      const sorted = bench.frameMs.slice().sort((a, b) => a - b);
      const cache = this.game?.runtimeSpriteCache?.snapshotStats?.() || {};
      const result = {
        reason,
        preset: this.preset,
        lowSpecMode: this.lowSpecMode,
        durationSec: Number(bench.elapsedSec || 0),
        frames: bench.frames || 0,
        avgFps: bench.elapsedSec > 0 ? (bench.frames / bench.elapsedSec) : 0,
        avgFrameMs: average(bench.frameMs),
        p95FrameMs: percentile(sorted, 0.95),
        worstFrameMs: sorted[sorted.length - 1] || 0,
        avgUpdateMs: average(bench.updateMs),
        avgRenderMs: average(bench.renderMs),
        avgUiMs: average(bench.uiMs),
        avgQueueMs: average(bench.queueMs),
        avgAiAwake: average(bench.aiAwake),
        pathSyncFallbackDelta: Math.max(0, Number(this.game?.pathWorkerMetrics?.syncFallbacks || 0) - Number(bench.pathFallbackStart || 0)),
        pathFrameBudgetDelta: Math.max(0, Number(this.game?.pathWorkerMetrics?.frameBudgetSkips || 0) - Number(bench.pathFrameBudgetStart || 0)),
        pathPendingCapDelta: Math.max(0, Number(this.game?.pathWorkerMetrics?.pendingCapSkips || 0) - Number(bench.pathPendingCapStart || 0)),
        pathCooldownDelta: Math.max(0, Number(this.game?.pathWorkerMetrics?.cooldownRejects || 0) - Number(bench.pathCooldownStart || 0)),
        spriteMissDelta: Math.max(0, Number(cache.misses || 0) - Number(bench.spriteMissStart || 0)),
        spriteEvictionDelta: Math.max(0, Number(cache.evictions || 0) - Number(bench.spriteEvictionStart || 0)),
        spriteMissesPerSecond: perSecond(Math.max(0, Number(cache.misses || 0) - Number(bench.spriteMissStart || 0)), bench.elapsedSec),
        spriteEvictionsPerSecond: perSecond(Math.max(0, Number(cache.evictions || 0) - Number(bench.spriteEvictionStart || 0)), bench.elapsedSec),
        topSpriteMissModels: topCounterList(cache.topMissModels || [], 5),
        hotspot: this.classifyHotspot(),
        completedAt: Date.now()
      };
      result.recommendation = result.hotspot?.recommendation || this.recommendationFor(result.hotspot?.area || 'unknown');
      this.lastBenchmark = result;
      this.persistBenchmarkResult(result);
      this.benchmark = null;
      return result;
    }

    updateBenchmark(perfStats, nowMs) {
      const bench = this.benchmark;
      if (!bench?.active || !perfStats) return;
      const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : (performance.now?.() || Date.now());
      bench.elapsedSec = Math.max(0, (now - bench.startedAt) / 1000);
      bench.frames += 1;
      bench.frameMs.push(Number(perfStats.frameMs) || 0);
      bench.updateMs.push(Number(perfStats.updateMs) || 0);
      bench.renderMs.push(Number(perfStats.renderMs) || 0);
      bench.uiMs.push(Number(perfStats.uiUpdateMs) || 0);
      bench.queueMs.push((Number(perfStats.renderQueueBuildMs) || 0) + (Number(perfStats.renderQueueSortMs) || 0));
      bench.aiAwake.push(Number(perfStats.enemiesAwake) || 0);
      if (bench.elapsedSec >= bench.durationSec) {
        const result = this.stopBenchmark('complete');
        this.game?.logSystem?.(`Benchmark complete: ${Math.round(result.avgFps || 0)} FPS avg, p95 ${result.p95FrameMs.toFixed(1)}ms, hotspot ${result.hotspot?.area || 'unknown'}.`);
      }
    }

    update(perfStats, nowMs) {
      this.pushSample(perfStats);
      if ((this.frameCounter % 15) === 0) this.classifyHotspot();
      this.updateBenchmark(perfStats, nowMs);
      this.syncPerfStats(perfStats);
    }

    syncPerfStats(perfStats) {
      if (!perfStats) return;
      const bench = this.benchmark;
      const last = this.lastBenchmark || {};
      const hotspot = this.hotspot || {};
      perfStats.performancePreset = this.preset;
      perfStats.lowSpecMode = !!this.lowSpecMode;
      perfStats.hotspotArea = hotspot.area || 'pending';
      perfStats.hotspotReason = hotspot.reason || '';
      perfStats.benchmarkActive = !!bench?.active;
      perfStats.benchmarkFrames = bench?.frames || 0;
      perfStats.benchmarkRemainingSec = bench?.active ? Math.max(0, Number(bench.durationSec || 0) - Number(bench.elapsedSec || 0)) : 0;
      perfStats.benchmarkAvgFps = bench?.active && bench.elapsedSec > 0 ? bench.frames / bench.elapsedSec : (last.avgFps || 0);
      perfStats.benchmarkAvgFrameMs = bench?.active ? average(bench.frameMs || []) : (last.avgFrameMs || 0);
      perfStats.benchmarkP95FrameMs = last.p95FrameMs || 0;
      perfStats.benchmarkWorstFrameMs = last.worstFrameMs || 0;
      perfStats.benchmarkLastHotspot = last.hotspot?.area || '';
      perfStats.hotspotRecommendation = hotspot.recommendation || last.recommendation || '';
      perfStats.benchmarkSpriteMissesPerSecond = last.spriteMissesPerSecond || 0;
      perfStats.benchmarkSpriteEvictionsPerSecond = last.spriteEvictionsPerSecond || 0;
      perfStats.benchmarkPathFrameBudgetDelta = last.pathFrameBudgetDelta || 0;
      perfStats.benchmarkPathPendingCapDelta = last.pathPendingCapDelta || 0;
      perfStats.benchmarkPathCooldownDelta = last.pathCooldownDelta || 0;
    }

    snapshotStats() {
      const presetDef = this.currentPresetDef();
      return {
        preset: this.preset,
        presetLabel: presetDef.label,
        presetDescription: presetDef.description,
        lowSpecMode: !!this.lowSpecMode,
        hotspot: this.hotspot,
        benchmark: this.benchmark,
        lastBenchmark: this.lastBenchmark,
        benchmarkHistory: this.benchmarkHistory,
        lastModeChangeReason: this.lastModeChangeReason,
        rendererMode: this.game?.getRenderBackendMode?.() || this.game?.perfStats?.renderBackendRendererMode || 'canvas2d',
        renderBackend: this.game?.getRenderBackendSnapshot?.() || null
      };
    }

    settingsPanelHtml(escapeHtml) {
      const esc = typeof escapeHtml === 'function' ? escapeHtml : value => String(value);
      const presetButtons = Object.entries(PRESETS).map(([key, def]) => {
        const active = key === this.preset ? 'active' : '';
        return `<button class="toggleBtn ${active}" data-performance-preset="${esc(key)}" title="${esc(def.description)}">${esc(def.label)}</button>`;
      }).join('');
      const bench = this.benchmark;
      const last = this.lastBenchmark;
      const rendererMode = this.game?.getRenderBackendMode?.() || this.game?.perfStats?.renderBackendRendererMode || 'canvas2d';
      const perf = this.game?.perfStats || {};
      const webglReady = !!perf.renderBackendWebglPrototypeReady;
      const scenePreviewOverlay = !!perf.renderBackendWebglScenePreviewOverlayEnabled;
      const scenePreviewTerrain = perf.renderBackendWebglScenePreviewTerrainLayerEnabled !== false;
      const scenePreviewSprites = perf.renderBackendWebglScenePreviewSpriteLayerEnabled !== false;
      const scenePreviewGuides = perf.renderBackendWebglScenePreviewGuidesEnabled !== false;
      const scenePreviewReady = !!perf.renderBackendWebglScenePreviewReady;
      const visibleTerrainLayer = !!perf.renderBackendWebglVisibleTerrainLayerEnabled;
      const visibleTerrainActive = !!perf.renderBackendWebglVisibleTerrainLayerActive;
      const visibleTerrainPromoted = !!perf.renderBackendWebglVisibleTerrainLayerPromotedThisFrame;
      const visibleSpriteLayer = !!perf.renderBackendWebglVisibleSpriteLayerEnabled;
      const visibleSpriteActive = !!perf.renderBackendWebglVisibleSpriteLayerActive;
      const visibleSpritePromoted = !!perf.renderBackendWebglVisibleSpriteLayerPromotedThisFrame;
      const visibleEffectLayer = !!perf.renderBackendWebglVisibleEffectLayerEnabled;
      const visibleEffectActive = !!perf.renderBackendWebglVisibleEffectLayerActive;
      const visibleEffectPromoted = !!perf.renderBackendWebglVisibleEffectLayerPromotedThisFrame;
      const visibleDamageTextLayer = !!perf.renderBackendWebglVisibleDamageTextLayerEnabled;
      const visibleDamageTextActive = !!perf.renderBackendWebglVisibleDamageTextLayerActive;
      const visibleDamageTextPromoted = !!perf.renderBackendWebglVisibleDamageTextLayerPromotedThisFrame;
      const hybridMask = perf.renderBackendHybridVisiblePromotedLayerMask || '--';
      const hybridFlushes = Number(perf.renderBackendHybridVisibleFlushes || 0);
      const hybridSwitches = Number(perf.renderBackendHybridVisibleLayerSwitches || 0);
      const hybridCanvasFallbacks = Number(perf.renderBackendHybridVisibleCanvasFallbackDraws || 0);
      const hybridQaState = perf.hybridQaEnabled ? (perf.hybridQaState || 'pending') : 'off';
      const hybridQaHeld = perf.hybridQaHeldOffLayers || 'none';
      const hybridQaReason = perf.hybridQaLastReason || 'ok';
      const webglButtonActive = rendererMode === 'hybrid-webgl-prototype' ? 'active' : '';
      const cooldownSec = Math.ceil(Math.max(0, Number(perf.renderBackendCooldownRemainingMs || 0)) / 1000);
      const watchdogText = perf.renderBackendWatchdogEnabled
        ? `Watchdog: on, fallback ${Number(perf.renderBackendAutoFallbacks || 0)}, score ${Number(perf.renderBackendFailureScore || 0)}, cooldown ${cooldownSec}s.`
        : 'Watchdog: off.';
      const deniedText = perf.renderBackendModeDenied ? ` Last renderer request denied: ${esc(perf.renderBackendModeDeniedReason || 'unknown')}.` : '';
      const benchmarkText = bench?.active
        ? `Benchmark running: ${Math.ceil(Math.max(0, Number(bench.durationSec || 0) - Number(bench.elapsedSec || 0)))}s left, ${bench.frames || 0} frames.`
        : last
          ? `Last benchmark: ${Math.round(last.avgFps || 0)} FPS avg, p95 ${Number(last.p95FrameMs || 0).toFixed(1)}ms, hotspot ${last.hotspot?.area || 'unknown'}.`
          : 'No benchmark run yet.';
      return `
        <div class="settingsSectionTitle">Performance</div>
        <div class="settingsRow" style="gap:6px;flex-wrap:wrap"><span>Preset</span><div style="display:flex;gap:6px;flex-wrap:wrap">${presetButtons}</div></div>
        <div class="settingsRow"><span>Low-Spec Mode</span><button class="toggleBtn ${this.lowSpecMode ? 'active' : ''}" data-performance-low-spec="1">${this.lowSpecMode ? 'On' : 'Off'}</button></div>
      `;    }
  }

  DR.PerformanceVerificationSystem = PerformanceVerificationSystem;
  DR.systems.PerformanceVerificationSystem = PerformanceVerificationSystem;
  DR.PERFORMANCE_PRESETS = PRESETS;

  DR.PerformanceVerificationInstaller = {
    install(Game) {
      if (!Game || !Game.prototype) return;
      Game.prototype.setPerformancePreset = function(preset, options = {}) {
        const changed = this.performanceVerifier?.setPreset?.(preset, options.reason || 'settings');
        if (changed) {
          this.logSystem?.(`Performance preset: ${this.performanceVerifier.currentPresetDef?.().label || preset}.`);
          this.renderSettingsPanel?.();
          this.markUiDirty?.('performance preset');
        }
        return changed;
      };
      Game.prototype.cyclePerformancePreset = function() {
        const next = this.performanceVerifier?.cyclePreset?.() || 'balanced';
        this.logSystem?.(`Performance preset: ${this.performanceVerifier?.currentPresetDef?.().label || next}.`);
        this.renderSettingsPanel?.();
        this.markUiDirty?.('performance preset');
        return next;
      };
      Game.prototype.toggleLowSpecPerformanceMode = function() {
        const enabled = this.performanceVerifier?.toggleLowSpecMode?.() || false;
        this.logSystem?.(`Low-Spec Mode: ${enabled ? 'On' : 'Off'}.`);
        this.renderSettingsPanel?.();
        this.markUiDirty?.('performance low spec');
        return enabled;
      };
      Game.prototype.startPerformanceBenchmark = function(seconds) {
        const bench = this.performanceVerifier?.startBenchmark?.(seconds);
        if (bench) this.logSystem?.(`Performance benchmark started for ${Math.round(bench.durationSec || 60)} seconds.`);
        this.renderSettingsPanel?.();
        return bench;
      };
      Game.prototype.stopPerformanceBenchmark = function(reason = 'manual') {
        const result = this.performanceVerifier?.stopBenchmark?.(reason);
        if (result) this.logSystem?.(`Benchmark: ${Math.round(result.avgFps || 0)} FPS avg, p95 ${Number(result.p95FrameMs || 0).toFixed(1)}ms, hotspot ${result.hotspot?.area || 'unknown'}.`);
        this.renderSettingsPanel?.();
        return result;
      };
      Game.prototype.togglePerformanceBenchmark = function() {
        if (this.performanceVerifier?.benchmark?.active) return this.stopPerformanceBenchmark?.('manual');
        return this.startPerformanceBenchmark?.(60);
      };
      Game.prototype.benchmarkReportPayload = function() {
        const stats = this.performanceVerifier?.snapshotStats?.() || {};
        const cache = this.runtimeSpriteCache?.snapshotStats?.() || {};
        const path = this.pathWorkerMetrics || {};
        return {
          version: window.DREAM_REALMS_VERSION || 'unknown',
          buildName: window.DREAM_REALMS_BUILD_NAME || '',
          generatedAt: new Date().toISOString(),
          preset: stats.preset,
          lowSpecMode: !!stats.lowSpecMode,
          hotspot: stats.hotspot || null,
          lastBenchmark: stats.lastBenchmark || null,
          benchmarkHistory: stats.benchmarkHistory || [],
          spriteCache: {
            enabled: !!cache.enabled,
            entries: cache.entries || 0,
            maxEntries: cache.maxEntries || 0,
            hits: cache.hits || 0,
            misses: cache.misses || 0,
            evictions: cache.evictions || 0,
            failures: cache.failures || 0,
            topMissModels: cache.topMissModels || []
          },
          pathWorker: {
            enabled: !!path.enabled,
            ready: !!path.ready,
            pending: path.pending || 0,
            completed: path.completed || 0,
            failed: path.failed || 0,
            timeouts: path.timeouts || 0,
            syncFallbacks: path.syncFallbacks || 0,
            frameBudgetSkips: path.frameBudgetSkips || 0,
            pendingCapSkips: path.pendingCapSkips || 0,
            cooldownRejects: path.cooldownRejects || 0,
            reusedExistingRoutes: path.reusedExistingRoutes || 0,
            lastReason: path.lastReason || ''
          },
          renderBackend: this.getRenderBackendSnapshot?.() || null,
          perfStats: this.perfStats || {}
        };
      };
      Game.prototype.exportLastBenchmarkReport = function() {
        const payload = this.benchmarkReportPayload?.();
        if (!payload) return false;
        const json = JSON.stringify(payload, null, 2);
        try {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Dream-Realms-V${window.DREAM_REALMS_VERSION || 'benchmark'}-performance-report.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 500);
          this.logSystem?.('Benchmark report exported.');
          return true;
        } catch (err) {
          this.logSystem?.(`Benchmark export failed: ${err?.message || err}`);
          return false;
        }
      };
      Game.prototype.copyBenchmarkSummary = async function() {
        const payload = this.benchmarkReportPayload?.();
        if (!payload) return false;
        const bench = payload.lastBenchmark || {};
        const hot = payload.hotspot || bench.hotspot || {};
        const text = [
          `Dream Realms ${payload.version} performance report`,
          `Preset: ${payload.preset}${payload.lowSpecMode ? ' + LowSpec' : ''}`,
          `FPS avg: ${Math.round(bench.avgFps || 0)}, p95: ${Number(bench.p95FrameMs || 0).toFixed(1)}ms, worst: ${Number(bench.worstFrameMs || 0).toFixed(1)}ms`,
          `Hotspot: ${hot.area || 'unknown'} - ${hot.reason || ''}`,
          `Recommendation: ${bench.recommendation || hot.recommendation || 'Collect more samples.'}`,
          `Sprite misses/sec: ${Number(bench.spriteMissesPerSecond || 0).toFixed(2)}, evictions/sec: ${Number(bench.spriteEvictionsPerSecond || 0).toFixed(2)}`,
          `Path pressure: fallback ${bench.pathSyncFallbackDelta || 0}, budget ${bench.pathFrameBudgetDelta || 0}, cap ${bench.pathPendingCapDelta || 0}, cooldown ${bench.pathCooldownDelta || 0}`
        ].join('\n');
        try {
          await navigator.clipboard?.writeText?.(text);
          this.logSystem?.('Benchmark summary copied.');
          return true;
        } catch (_) {
          this.logSystem?.(text);
          return false;
        }
      };

      // V0.20.55: per-phase render profiler. The existing benchmark reports FPS and a coarse hotspot;
      // this reports WHICH DRAW PHASE the milliseconds are actually in, on the machine running it.
      // It deliberately samples the REAL requestAnimationFrame loop rather than calling render() in a
      // tight synthetic loop - a synthetic loop drifts badly (identical config measured 127ms then
      // 148ms) and produced the wrong conclusion twice during the V0.20.49-54 performance work.
      Game.prototype.profileRenderPhases = function(frames = 120) {
        const game = this;
        const proto = Object.getPrototypeOf(game);
        const PHASES = ['drawEntity', 'drawObject', 'drawTile', 'drawTree', 'drawEffect', 'drawNameplate',
          'drawPropContactShadow', 'drawTerrainChunks', 'drawHumanoid', 'drawMinimap', 'drawDamage',
          'drawEntityStatusAuras', 'renderExternalSystems'];
        const wrapped = PHASES.filter(n => typeof proto[n] === 'function');
        const orig = {}, ms = {}, calls = {};
        for (const n of wrapped) {
          orig[n] = proto[n]; ms[n] = 0; calls[n] = 0;
          proto[n] = function(...args) {
            const t = performance.now();
            try { return orig[n].apply(this, args); }
            finally { ms[n] += performance.now() - t; calls[n]++; }
          };
        }
        // Each external system is timed separately - renderExternalSystems is usually the largest
        // single bucket, and it is worthless to know that without knowing which system inside it.
        const ext = (game.externalSystems || []).filter(s => s && typeof s.render === 'function');
        const extOrig = ext.map(s => s.render);
        const extMs = ext.map(() => 0);
        ext.forEach((s, i) => {
          s.render = function(...args) {
            const t = performance.now();
            try { return extOrig[i].apply(this, args); }
            finally { extMs[i] += performance.now() - t; }
          };
        });

        const frameTimes = [];
        let last = performance.now();
        let count = 0;
        return new Promise(resolve => {
          const tick = () => {
            const now = performance.now();
            frameTimes.push(now - last);
            last = now;
            if (++count < frames) { requestAnimationFrame(tick); return; }
            for (const n of wrapped) proto[n] = orig[n];
            ext.forEach((s, i) => { s.render = extOrig[i]; });
            const sorted = frameTimes.slice(1).sort((a, b) => a - b);
            const avg = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
            const atlas = game.spriteAtlasSystem?.getStats?.() || {};
            const report = {
              version: window.DREAM_REALMS_VERSION || 'unknown',
              framesSampled: sorted.length,
              fps: +(1000 / avg).toFixed(1),
              avgFrameMs: +avg.toFixed(1),
              p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(1),
              renderScale: +(game.activeRenderScale || game.userRenderScale || 1).toFixed(2),
              atlasFramesLoaded: atlas.framesLoaded || 0,
              counts: {
                entities: (game.entities || []).length,
                objects: (game.objects || []).length,
                effects: (game.effects || []).length
              },
              phasesMsPerFrame: wrapped
                .map(n => ({ phase: n, ms: +(ms[n] / count).toFixed(2), callsPerFrame: Math.round(calls[n] / count) }))
                .filter(r => r.ms >= 0.05).sort((a, b) => b.ms - a.ms),
              externalSystemsMsPerFrame: ext
                .map((s, i) => ({ system: s.id || s.name || `system${i}`, ms: +(extMs[i] / count).toFixed(2) }))
                .filter(r => r.ms >= 0.05).sort((a, b) => b.ms - a.ms)
            };
            try {
              console.log(`%cBlackroot ${report.version} - ${report.fps} FPS (avg ${report.avgFrameMs}ms, p95 ${report.p95FrameMs}ms)`, 'font-weight:bold');
              console.table(report.phasesMsPerFrame);
              console.table(report.externalSystemsMsPerFrame);
            } catch (_) {}
            resolve(report);
          };
          requestAnimationFrame(tick);
        });
      };

      Game.prototype.resetPerformanceSettings = function() {
        this.performanceVerifier?.resetSettings?.();
        this.logSystem?.('Performance settings reset to Balanced.');
        this.renderSettingsPanel?.();
        this.markUiDirty?.('performance reset');
      };
      Game.prototype.performanceVerificationSummary = function() {
        const stats = this.performanceVerifier?.snapshotStats?.() || {};
        const hotspot = stats.hotspot || {};
        const bench = stats.benchmark;
        const last = stats.lastBenchmark;
        if (bench?.active) return `Benchmark running: ${Math.round(bench.elapsedSec || 0)}s / ${Math.round(bench.durationSec || 0)}s.`;
        if (last) return `Preset ${stats.presetLabel || stats.preset}; hotspot ${last.hotspot?.area || hotspot.area || 'unknown'}; ${Math.round(last.avgFps || 0)} FPS avg.`;
        return `Preset ${stats.presetLabel || stats.preset || 'Balanced'}; hotspot ${hotspot.area || 'pending'}.`;
      };
    }
  };
})();
