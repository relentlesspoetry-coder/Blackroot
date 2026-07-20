// Dream Realms adaptive performance governor
// V0.15.12: frame pressure response for DPR, render pad, weather, and queue budgets.
(function() {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  class AdaptivePerformanceSystem {
    constructor(game, options = {}) {
      this.game = game;
      const perf = DR.CONFIG?.PERFORMANCE || {};
      this.enabled = options.enabled ?? perf.enableAdaptivePerformance !== false;
      this.targetFrameMs = Math.max(12, Number(options.targetFrameMs || perf.adaptiveTargetFrameMs || 18.5));
      this.stressFrameMs = Math.max(this.targetFrameMs + 1, Number(options.stressFrameMs || perf.adaptiveStressFrameMs || 24));
      this.recoveryFrameMs = Math.max(8, Number(options.recoveryFrameMs || perf.adaptiveRecoveryFrameMs || 15.2));
      this.sampleIntervalMs = Math.max(250, Number(options.sampleIntervalMs || perf.adaptiveSampleIntervalMs || 750));
      this.downshiftHoldMs = Math.max(300, Number(options.downshiftHoldMs || perf.adaptiveDownshiftHoldMs || 1500));
      this.upshiftHoldMs = Math.max(1000, Number(options.upshiftHoldMs || perf.adaptiveUpshiftHoldMs || 4500));
      this.minLevel = Math.max(0, Math.min(3, Number(options.minLevel ?? perf.adaptiveMinLevel ?? 0)));
      this.maxLevel = Math.max(this.minLevel, Math.min(3, Number(options.maxLevel ?? perf.adaptiveMaxLevel ?? 2)));
      this.level = Math.max(this.minLevel, Math.min(this.maxLevel, Number(options.initialLevel ?? perf.adaptiveInitialLevel ?? 2)));
      this.lastSampleMs = 0;
      this.frameMsEma = 0;
      this.renderMsEma = 0;
      this.updateMsEma = 0;
      this.stressMs = 0;
      this.recoveryMs = 0;
      this.downshifts = 0;
      this.upshifts = 0;
      this.lastChangeReason = 'initial';
      this.lastChangeMs = 0;
      this.resizeRequested = false;
      this.settingsCache = null;
      this.settingsCacheBase = null;
      this.settingsCacheLevel = -1;
      this.levelNames = ['rescue', 'performance', 'balanced', 'quality'];
    }

    beginFrame() {
      // Reserved for future budget reset hooks. Kept explicit so the game loop can call it safely.
    }

    update(perfStats, nowMs) {
      if (!this.enabled || !perfStats) return;
      const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : performance.now();
      const frameMs = Number(perfStats.frameMs) || 0;
      const renderMs = Number(perfStats.renderMs) || 0;
      const updateMs = Number(perfStats.updateMs) || 0;
      if (!frameMs) return;
      const alpha = this.frameMsEma ? 0.18 : 1;
      this.frameMsEma = this.frameMsEma ? (this.frameMsEma * (1 - alpha) + frameMs * alpha) : frameMs;
      this.renderMsEma = this.renderMsEma ? (this.renderMsEma * (1 - alpha) + renderMs * alpha) : renderMs;
      this.updateMsEma = this.updateMsEma ? (this.updateMsEma * (1 - alpha) + updateMs * alpha) : updateMs;

      if (this.lastSampleMs && now - this.lastSampleMs < this.sampleIntervalMs) return;
      const elapsed = this.lastSampleMs ? Math.max(0, now - this.lastSampleMs) : this.sampleIntervalMs;
      this.lastSampleMs = now;

      const inStress = this.frameMsEma >= this.stressFrameMs || this.renderMsEma >= this.targetFrameMs * 0.82;
      const canRecover = this.frameMsEma <= this.recoveryFrameMs && this.renderMsEma <= this.targetFrameMs * 0.62 && this.updateMsEma <= this.targetFrameMs * 0.62;

      if (inStress) {
        this.stressMs += elapsed;
        this.recoveryMs = 0;
      } else if (canRecover) {
        this.recoveryMs += elapsed;
        this.stressMs = Math.max(0, this.stressMs - elapsed * 0.5);
      } else {
        this.stressMs = Math.max(0, this.stressMs - elapsed * 0.35);
        this.recoveryMs = Math.max(0, this.recoveryMs - elapsed * 0.5);
      }

      if (this.stressMs >= this.downshiftHoldMs && this.level > this.minLevel) {
        this.setLevel(this.level - 1, `frame pressure ${this.frameMsEma.toFixed(1)} ms`);
        this.stressMs = 0;
        this.recoveryMs = 0;
      } else if (this.recoveryMs >= this.upshiftHoldMs && this.level < this.maxLevel) {
        this.setLevel(this.level + 1, `stable ${this.frameMsEma.toFixed(1)} ms`);
        this.recoveryMs = 0;
        this.stressMs = 0;
      }
    }

    setLevel(nextLevel, reason = 'manual') {
      const clamped = Math.max(this.minLevel, Math.min(this.maxLevel, Math.round(Number(nextLevel))));
      if (clamped === this.level) return false;
      const previous = this.level;
      this.level = clamped;
      this.settingsCache = null;
      this.settingsCacheLevel = -1;
      this.lastChangeReason = reason;
      this.lastChangeMs = performance.now?.() || Date.now();
      if (clamped < previous) this.downshifts += 1;
      else this.upshifts += 1;

      // DPR changes require a canvas resize. Defer to the runtime owner instead of resizing inside the governor.
      this.resizeRequested = true;
      return true;
    }

    consumeResizeRequest() {
      const requested = !!this.resizeRequested;
      this.resizeRequested = false;
      return requested;
    }

    levelName() {
      return this.levelNames[this.level] || 'custom';
    }

    effectiveSettings(baseSettings) {
      const base = baseSettings || DR.CONFIG?.PERFORMANCE || {};
      if (!this.enabled) return base;
      if (this.settingsCache && this.settingsCacheBase === base && this.settingsCacheLevel === this.level) return this.settingsCache;

      const settings = Object.assign({}, base);
      const basePad = Number(base.renderPad || DR.CONFIG?.RENDER_PAD || 20);
      const baseDpr = Number(base.maxDpr || 1.25);
      const level = this.level;
      // V0.17.95: adaptive render-resolution scale. Full res at balanced/quality;
      // progressively downscale the world's internal resolution under sustained
      // frame pressure so full-screen passes fill fewer pixels (see displayPixelRatio).
      settings.renderScale = 1;

      if (level >= 3) {
        settings.renderPad = Math.max(18, basePad + 2);
        settings.maxDpr = Math.min(Number(base.highQualityMaxDpr || 1.5), Math.max(baseDpr, 1.35));
        settings.enableWeatherSkyOverlay = base.enableWeatherSkyOverlay !== false;
        settings.enableWeatherForeground = base.enableWeatherForeground !== false;
        settings.entityCullPadPx = Number(base.entityCullPadPx || 960);
        settings.effectCullPadPx = Number(base.effectCullPadPx || 720);
        settings.damageTextCullPadPx = Number(base.damageTextCullPadPx || 520);
        settings.objectCullPadPx = Number(base.objectCullPadPx || 920);
      } else if (level === 2) {
        settings.renderPad = basePad;
        settings.maxDpr = baseDpr;
      } else if (level === 1) {
        settings.renderScale = 0.85;
        settings.renderPad = Math.max(14, basePad - 3);
        settings.maxDpr = Math.min(baseDpr, 1.12);
        settings.highQualityMaxDpr = settings.maxDpr;
        settings.enableWeatherSkyOverlay = base.enableWeatherSkyOverlay !== false;
        settings.entityCullPadPx = Math.min(Number(base.entityCullPadPx || 960), 760);
        settings.effectCullPadPx = Math.min(Number(base.effectCullPadPx || 720), 560);
        settings.damageTextCullPadPx = Math.min(Number(base.damageTextCullPadPx || 520), 420);
        settings.objectCullPadPx = Math.min(Number(base.objectCullPadPx || 920), 700);
        settings.uiFullCombatInterval = Math.max(Number(base.uiFullCombatInterval || 0.45), 0.60);
        settings.uiFullIdleInterval = Math.max(Number(base.uiFullIdleInterval || 0.85), 1.10);
        settings.maxActiveEffects = Math.min(Number(base.maxActiveEffects || DR.CONFIG?.MAX_ACTIVE_EFFECTS || 320), 260);
        settings.maxDamageText = Math.min(Number(base.maxDamageText || DR.CONFIG?.MAX_DAMAGE_TEXT || 72), 60);
      } else {
        settings.renderScale = 0.72;
        settings.renderPad = Math.max(12, basePad - 5);
        settings.maxDpr = 1.0;
        settings.highQualityMaxDpr = 1.0;
        settings.enableWeatherSkyOverlay = base.enableWeatherSkyOverlay !== false;
        settings.enableWeatherForeground = base.enableWeatherForeground !== false;
        settings.enableSunShafts = false;
        settings.enableDustMotes = base.enableDustMotes !== false;
        settings.entityCullPadPx = Math.min(Number(base.entityCullPadPx || 960), 620);
        settings.effectCullPadPx = Math.min(Number(base.effectCullPadPx || 720), 440);
        settings.damageTextCullPadPx = Math.min(Number(base.damageTextCullPadPx || 520), 340);
        settings.objectCullPadPx = Math.min(Number(base.objectCullPadPx || 920), 560);
        settings.maxActiveEffects = Math.min(Number(base.maxActiveEffects || DR.CONFIG?.MAX_ACTIVE_EFFECTS || 320), 220);
        settings.maxDamageText = Math.min(Number(base.maxDamageText || DR.CONFIG?.MAX_DAMAGE_TEXT || 72), 48);
        settings.uiFastCombatInterval = Math.max(Number(base.uiFastCombatInterval || 0.10), 0.16);
        settings.uiFastIdleInterval = Math.max(Number(base.uiFastIdleInterval || 0.20), 0.28);
        settings.uiFullCombatInterval = Math.max(Number(base.uiFullCombatInterval || 0.45), 0.85);
        settings.uiFullIdleInterval = Math.max(Number(base.uiFullIdleInterval || 0.85), 1.40);
      }

      settings.adaptiveLevel = this.level;
      settings.adaptiveLevelName = this.levelName();
      this.settingsCache = settings;
      this.settingsCacheBase = base;
      this.settingsCacheLevel = this.level;
      return settings;
    }

    snapshotStats() {
      return {
        enabled: !!this.enabled,
        level: this.level,
        levelName: this.levelName(),
        targetFrameMs: this.targetFrameMs,
        frameMsEma: this.frameMsEma || 0,
        renderMsEma: this.renderMsEma || 0,
        updateMsEma: this.updateMsEma || 0,
        stressMs: this.stressMs || 0,
        recoveryMs: this.recoveryMs || 0,
        downshifts: this.downshifts || 0,
        upshifts: this.upshifts || 0,
        lastChangeReason: this.lastChangeReason || ''
      };
    }
  }

  DR.systems.AdaptivePerformanceSystem = AdaptivePerformanceSystem;
  DR.AdaptivePerformanceSystem = AdaptivePerformanceSystem;
})();
