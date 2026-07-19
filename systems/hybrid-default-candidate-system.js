// Dream Realms V0.15.30: Hybrid renderer default-candidate profile and compatibility safety.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
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

  function toBool(value, fallback = false) {
    if (value === true || value === '1' || value === 'true' || value === 1) return true;
    if (value === false || value === '0' || value === 'false' || value === 0) return false;
    return !!fallback;
  }

  function clampInt(value, fallback, min, max) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  class HybridDefaultCandidateSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.storagePrefix = 'dreamRealmsHybridDefaultCandidate';
      this.armed = toBool(safeGet(`${this.storagePrefix}:armed`, cfg.hybridDefaultCandidateArmedDefault ? '1' : '0'), !!cfg.hybridDefaultCandidateArmedDefault);
      this.compatibilityMode = toBool(safeGet(`${this.storagePrefix}:compatibilityMode`, '0'), false);
      this.persistentHoldOff = toBool(safeGet(`${this.storagePrefix}:persistentHoldOff`, '0'), false);
      this.safeFrames = clampInt(safeGet(`${this.storagePrefix}:safeFrames`, '0'), 0, 0, 999999);
      this.unstableFrames = 0;
      this.lastApplyMs = 0;
      this.lastAutoFallbacks = 0;
      this.lastWatchdogTrips = 0;
      this.lastLayerDisabledReason = '';
      this.lastAction = 'initialized';
      this.lastReason = '';
      this.lastProfileApplyReason = '';
      this.disabledLayers = new Set(String(safeGet(`${this.storagePrefix}:disabledLayers`, '') || '').split(',').map(s => s.trim()).filter(Boolean));
      this.metrics = {
        enabled: cfg.enableHybridDefaultCandidate !== false,
        armed: this.armed,
        compatibilityMode: this.compatibilityMode,
        persistentHoldOff: this.persistentHoldOff,
        ready: false,
        state: 'idle',
        safeFrames: this.safeFrames,
        unstableFrames: 0,
        disabledLayers: this.disabledLayersLabel(),
        lastAction: this.lastAction,
        lastReason: '',
        terrainHealth: 'unknown',
        spriteHealth: 'unknown',
        effectHealth: 'unknown',
        damageTextHealth: 'unknown',
        frameFallbacks: 0,
        frameCostMs: 0,
        layerFallbacks: { terrain: 0, sprites: 0, effects: 0, damageText: 0 }
      };
      this.applyStartupPolicy();
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    backend() {
      return this.game?.ensureRenderBackendSystem?.() || null;
    }

    disabledLayersLabel() {
      return Array.from(this.disabledLayers || []).sort().join(',') || 'none';
    }

    persist() {
      safeSet(`${this.storagePrefix}:armed`, this.armed ? '1' : '0');
      safeSet(`${this.storagePrefix}:compatibilityMode`, this.compatibilityMode ? '1' : '0');
      safeSet(`${this.storagePrefix}:persistentHoldOff`, this.persistentHoldOff ? '1' : '0');
      safeSet(`${this.storagePrefix}:safeFrames`, String(this.safeFrames || 0));
      safeSet(`${this.storagePrefix}:disabledLayers`, Array.from(this.disabledLayers || []).sort().join(','));
    }

    applyStartupPolicy() {
      if (this.compatibilityMode) {
        this.forceCanvasCompatibility('startup compatibility mode', { silent: true });
        return;
      }
      if (this.armed && !this.persistentHoldOff) {
        this.applyCandidateProfile('startup armed profile', { silent: true });
      }
    }

    setArmed(enabled, reason = 'manual') {
      this.armed = !!enabled;
      if (this.armed) {
        this.compatibilityMode = false;
        this.persistentHoldOff = false;
        this.applyCandidateProfile(reason);
      } else {
        this.lastAction = 'candidate disarmed';
        this.lastReason = reason;
      }
      this.persist();
      this.syncPerfStats();
      return this.armed;
    }

    toggleArmed() {
      return this.setArmed(!this.armed, 'settings toggle');
    }

    setCompatibilityMode(enabled, reason = 'manual') {
      this.compatibilityMode = !!enabled;
      if (this.compatibilityMode) {
        this.armed = false;
        this.persistentHoldOff = true;
        this.forceCanvasCompatibility(reason || 'compatibility mode');
      } else {
        this.persistentHoldOff = false;
        this.lastAction = 'compatibility cleared';
        this.lastReason = reason;
      }
      this.persist();
      this.syncPerfStats();
      return this.compatibilityMode;
    }

    toggleCompatibilityMode() {
      return this.setCompatibilityMode(!this.compatibilityMode, 'settings toggle');
    }

    forceCanvasCompatibility(reason = 'compatibility mode', options = {}) {
      const backend = this.backend();
      try { backend?.setRendererMode?.('canvas2d', reason, { force: true }); } catch (_err) {}
      try { backend?.setWebglVisibleTerrainLayer?.(false); } catch (_err) {}
      try { backend?.setWebglVisibleSpriteLayer?.(false); } catch (_err) {}
      try { backend?.setWebglVisibleEffectLayer?.(false); } catch (_err) {}
      try { backend?.setWebglVisibleDamageTextLayer?.(false); } catch (_err) {}
      this.lastAction = 'canvas compatibility';
      this.lastReason = reason;
      this.disabledLayers.clear();
      this.safeFrames = 0;
      this.unstableFrames = 0;
      this.persist();
      backend?.syncPerfStats?.();
      if (!options.silent) this.game?.logSystem?.(`Hybrid renderer compatibility mode: Canvas 2D Stable (${reason}).`);
    }

    resetToCanvasStable(reason = 'manual reset') {
      this.armed = false;
      this.compatibilityMode = false;
      this.persistentHoldOff = false;
      this.disabledLayers.clear();
      this.safeFrames = 0;
      this.unstableFrames = 0;
      this.forceCanvasCompatibility(reason, { silent: true });
      this.lastAction = 'reset canvas stable';
      this.lastReason = reason;
      this.persist();
      this.syncPerfStats();
      this.game?.logSystem?.('Hybrid candidate reset. Canvas 2D Stable restored.');
    }

    applyCandidateProfile(reason = 'manual apply', options = {}) {
      const cfg = this.settings();
      const backend = this.backend();
      if (!backend || cfg.enableHybridDefaultCandidate === false) return false;
      this.compatibilityMode = false;
      this.persistentHoldOff = false;
      this.armed = true;
      const changedMode = backend.setRendererMode?.('hybrid-webgl-prototype', reason, {}) || false;
      const denied = !!backend.metrics?.renderBackendModeDenied;
      if (denied || !backend.isHybridRendererMode?.()) {
        this.lastAction = 'candidate denied';
        this.lastReason = backend.metrics?.renderBackendModeDeniedReason || 'hybrid unavailable';
        if (!options.silent) this.game?.logSystem?.(`Hybrid candidate denied: ${this.lastReason}.`);
        this.persist();
        this.syncPerfStats();
        return false;
      }
      if (cfg.hybridDefaultCandidateAutoEnableLayers !== false) {
        try { backend.setWebglVisibleTerrainLayer?.(!this.disabledLayers.has('terrain')); } catch (_err) {}
        try { backend.setWebglVisibleSpriteLayer?.(!this.disabledLayers.has('sprites')); } catch (_err) {}
        try { backend.setWebglVisibleEffectLayer?.(!this.disabledLayers.has('effects')); } catch (_err) {}
        try { backend.setWebglVisibleDamageTextLayer?.(!this.disabledLayers.has('damageText')); } catch (_err) {}
      }
      this.lastApplyMs = nowMs();
      this.lastAction = changedMode ? 'candidate enabled' : 'candidate refreshed';
      this.lastReason = reason;
      this.lastProfileApplyReason = reason;
      this.persist();
      backend.syncPerfStats?.();
      this.syncPerfStats();
      if (!options.silent) this.game?.logSystem?.('Hybrid renderer candidate profile applied. Canvas fallback remains active.');
      return true;
    }

    layerFallbackSnapshot(perf) {
      return {
        terrain: Number(perf.renderBackendWebglVisibleTerrainFallbacks || 0) + Number(perf.renderBackendWebglTerrainPartialFallbacks || 0),
        sprites: Number(perf.renderBackendWebglVisibleSpriteFallbacks || 0) + Number(perf.renderBackendWebglVisibleSpriteDepthOrderFallbacks || 0),
        effects: Number(perf.renderBackendWebglVisibleEffectFallbacks || 0),
        damageText: Number(perf.renderBackendWebglVisibleDamageTextFallbacks || 0)
      };
    }

    layerHealth(name, fallbacks, active, promoted) {
      if (this.disabledLayers.has(name)) return 'disabled';
      if (!active) return 'armed';
      if (fallbacks > 0) return 'fallback';
      return promoted ? 'promoted' : 'active';
    }

    disableWorstLayer(layerFallbacks, reason) {
      const entries = Object.entries(layerFallbacks || {}).filter(([name]) => !this.disabledLayers.has(name));
      entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
      const [worst, count] = entries[0] || [];
      if (!worst || Number(count || 0) <= 0) return false;
      const backend = this.backend();
      if (worst === 'terrain') backend?.setWebglVisibleTerrainLayer?.(false);
      else if (worst === 'sprites') backend?.setWebglVisibleSpriteLayer?.(false);
      else if (worst === 'effects') backend?.setWebglVisibleEffectLayer?.(false);
      else if (worst === 'damageText') backend?.setWebglVisibleDamageTextLayer?.(false);
      this.disabledLayers.add(worst);
      this.lastLayerDisabledReason = `${worst}:${reason || 'fallback pressure'}:${count}`;
      this.lastAction = 'layer disabled';
      this.lastReason = this.lastLayerDisabledReason;
      this.persist();
      this.game?.logSystem?.(`Hybrid candidate disabled ${worst} WebGL layer: ${reason || 'fallback pressure'}. Canvas fallback remains active.`);
      return true;
    }

    update(_dt) {
      const cfg = this.settings();
      const perf = this.game?.perfStats || {};
      const backend = this.backend();
      if (!backend || cfg.enableHybridDefaultCandidate === false) {
        this.metrics.enabled = false;
        this.syncPerfStats();
        return;
      }
      backend.syncPerfStats?.();
      const layerFallbacks = this.layerFallbackSnapshot(perf);
      const frameFallbacks = Number(perf.renderBackendHybridVisibleFallbacks || 0)
        + Number(perf.renderBackendWebglVisibleTerrainFallbacks || 0)
        + Number(perf.renderBackendWebglVisibleSpriteFallbacks || 0)
        + Number(perf.renderBackendWebglVisibleEffectFallbacks || 0)
        + Number(perf.renderBackendWebglVisibleDamageTextFallbacks || 0);
      const frameCost = Number(perf.renderBackendHybridVisibleFrameMs || 0)
        + Number(perf.renderBackendWebglVisibleTerrainDrawMs || 0)
        + Number(perf.renderBackendWebglVisibleTerrainCompositeMs || 0)
        + Number(perf.renderBackendWebglVisibleSpriteDrawMs || 0)
        + Number(perf.renderBackendWebglVisibleSpriteCompositeMs || 0)
        + Number(perf.renderBackendWebglVisibleEffectDrawMs || 0)
        + Number(perf.renderBackendWebglVisibleEffectCompositeMs || 0)
        + Number(perf.renderBackendWebglVisibleDamageTextDrawMs || 0)
        + Number(perf.renderBackendWebglVisibleDamageTextCompositeMs || 0);
      const maxFallbacks = Math.max(0, Number(cfg.hybridDefaultCandidateMaxFallbacksPerFrame || 18) || 18);
      const maxCost = Math.max(1, Number(cfg.hybridDefaultCandidateMaxFrameCostMs || 9.0) || 9.0);
      const auditBlocked = !!perf.renderBackendHybridPromotionBlockedByAudit;
      const contextLost = !!perf.renderBackendWebglContextLost;
      const modeDenied = !!perf.renderBackendModeDenied;
      const cooldown = Number(perf.renderBackendCooldownRemainingMs || 0) > 0;
      const watchdogTrips = Number(perf.renderBackendWatchdogTrips || 0);
      const autoFallbacks = Number(perf.renderBackendAutoFallbacks || 0);
      const unstable = contextLost || modeDenied || auditBlocked || cooldown || frameFallbacks > maxFallbacks || frameCost > maxCost;

      if (this.armed && !this.compatibilityMode && !this.persistentHoldOff) {
        const reapplyMs = Math.max(750, Number(cfg.hybridDefaultCandidateReapplyIntervalMs || 2500) || 2500);
        if (!backend.isHybridRendererMode?.() && nowMs() - this.lastApplyMs > reapplyMs && !cooldown && !contextLost) {
          this.applyCandidateProfile('candidate recovery');
        }
      }

      if (autoFallbacks > this.lastAutoFallbacks || watchdogTrips > this.lastWatchdogTrips) {
        this.lastAutoFallbacks = autoFallbacks;
        this.lastWatchdogTrips = watchdogTrips;
        if (cfg.hybridDefaultCandidatePersistentHoldOffAfterWatchdog !== false && this.armed) {
          this.persistentHoldOff = true;
          this.armed = false;
          this.lastAction = 'watchdog holdoff';
          this.lastReason = perf.renderBackendLastFallbackReason || 'watchdog fallback';
          this.persist();
        }
      }

      if (unstable) {
        this.unstableFrames += 1;
        this.safeFrames = 0;
        if (this.armed && !this.compatibilityMode && cfg.hybridDefaultCandidateDisableLayerOnFailure !== false) {
          const threshold = Math.max(3, Number(cfg.hybridDefaultCandidateLayerDisableFrames || 10) || 10);
          if (this.unstableFrames >= threshold && frameFallbacks > maxFallbacks) {
            this.disableWorstLayer(layerFallbacks, `fallback pressure ${frameFallbacks}`);
            this.unstableFrames = 0;
          }
        }
      } else {
        this.unstableFrames = 0;
        this.safeFrames = Math.min(999999, Number(this.safeFrames || 0) + 1);
      }

      const safeRequired = Math.max(30, Number(cfg.hybridDefaultCandidateRequireSafeFrames || 180) || 180);
      this.metrics.enabled = true;
      this.metrics.armed = !!this.armed;
      this.metrics.compatibilityMode = !!this.compatibilityMode;
      this.metrics.persistentHoldOff = !!this.persistentHoldOff;
      this.metrics.ready = this.armed && !this.compatibilityMode && !this.persistentHoldOff && this.safeFrames >= safeRequired;
      this.metrics.state = this.compatibilityMode ? 'canvas-compatibility'
        : this.persistentHoldOff ? 'watchdog-holdoff'
          : this.armed ? (unstable ? 'stabilizing' : (this.metrics.ready ? 'default-candidate-ready' : 'collecting-safe-frames'))
            : 'canvas-stable';
      this.metrics.safeFrames = this.safeFrames;
      this.metrics.unstableFrames = this.unstableFrames;
      this.metrics.disabledLayers = this.disabledLayersLabel();
      this.metrics.lastAction = this.lastAction;
      this.metrics.lastReason = this.lastReason || (unstable ? this.describeUnstableReason({ contextLost, modeDenied, auditBlocked, cooldown, frameFallbacks, maxFallbacks, frameCost, maxCost }) : 'ok');
      this.metrics.frameFallbacks = frameFallbacks;
      this.metrics.frameCostMs = frameCost;
      this.metrics.layerFallbacks = layerFallbacks;
      this.metrics.terrainHealth = this.layerHealth('terrain', layerFallbacks.terrain, perf.renderBackendWebglVisibleTerrainLayerActive, perf.renderBackendWebglVisibleTerrainLayerPromotedThisFrame);
      this.metrics.spriteHealth = this.layerHealth('sprites', layerFallbacks.sprites, perf.renderBackendWebglVisibleSpriteLayerActive, perf.renderBackendWebglVisibleSpriteLayerPromotedThisFrame);
      this.metrics.effectHealth = this.layerHealth('effects', layerFallbacks.effects, perf.renderBackendWebglVisibleEffectLayerActive, perf.renderBackendWebglVisibleEffectLayerPromotedThisFrame);
      this.metrics.damageTextHealth = this.layerHealth('damageText', layerFallbacks.damageText, perf.renderBackendWebglVisibleDamageTextLayerActive, perf.renderBackendWebglVisibleDamageTextLayerPromotedThisFrame);
      this.persist();
      this.syncPerfStats();
    }

    describeUnstableReason(flags) {
      if (flags.contextLost) return 'webgl context lost';
      if (flags.modeDenied) return 'mode denied';
      if (flags.auditBlocked) return 'audit blocked';
      if (flags.cooldown) return 'watchdog cooldown';
      if (flags.frameFallbacks > flags.maxFallbacks) return `fallback pressure ${flags.frameFallbacks}/${flags.maxFallbacks}`;
      if (flags.frameCost > flags.maxCost) return `hybrid cost ${flags.frameCost.toFixed(1)}ms/${flags.maxCost.toFixed(1)}ms`;
      return 'ok';
    }

    snapshot() {
      return { ...this.metrics, layerFallbacks: { ...(this.metrics.layerFallbacks || {}) } };
    }

    syncPerfStats() {
      const perf = this.game?.perfStats;
      if (!perf) return;
      const m = this.metrics || {};
      perf.hybridDefaultCandidateEnabled = !!m.enabled;
      perf.hybridDefaultCandidateArmed = !!m.armed;
      perf.hybridDefaultCompatibilityMode = !!m.compatibilityMode;
      perf.hybridDefaultPersistentHoldOff = !!m.persistentHoldOff;
      perf.hybridDefaultCandidateReady = !!m.ready;
      perf.hybridDefaultCandidateState = m.state || 'idle';
      perf.hybridDefaultCandidateSafeFrames = Number(m.safeFrames || 0);
      perf.hybridDefaultCandidateUnstableFrames = Number(m.unstableFrames || 0);
      perf.hybridDefaultCandidateDisabledLayers = m.disabledLayers || 'none';
      perf.hybridDefaultCandidateLastAction = m.lastAction || '';
      perf.hybridDefaultCandidateLastReason = m.lastReason || '';
      perf.hybridDefaultCandidateFallbacks = Number(m.frameFallbacks || 0);
      perf.hybridDefaultCandidateCostMs = Number(m.frameCostMs || 0);
      perf.hybridDefaultCandidateTerrainHealth = m.terrainHealth || 'unknown';
      perf.hybridDefaultCandidateSpriteHealth = m.spriteHealth || 'unknown';
      perf.hybridDefaultCandidateEffectHealth = m.effectHealth || 'unknown';
      perf.hybridDefaultCandidateDamageTextHealth = m.damageTextHealth || 'unknown';
    }
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drHybridDefaultCandidateInstalled) return;
    Game.prototype.__drHybridDefaultCandidateInstalled = true;

    Game.prototype.ensureHybridDefaultCandidateSystem = function() {
      if (!this.hybridDefaultCandidateSystem) this.hybridDefaultCandidateSystem = new HybridDefaultCandidateSystem(this);
      return this.hybridDefaultCandidateSystem;
    };

    const originalUpdate = Game.prototype.update;
    if (typeof originalUpdate === 'function' && !originalUpdate.__drHybridDefaultCandidateWrapped) {
      const wrappedUpdate = function(dt, ...rest) {
        const result = originalUpdate.call(this, dt, ...rest);
        try { this.ensureHybridDefaultCandidateSystem?.().update?.(dt); } catch (err) { this.handleRuntimeFrameError?.(err, 'hybrid default candidate'); }
        return result;
      };
      wrappedUpdate.__drHybridDefaultCandidateWrapped = true;
      Game.prototype.update = wrappedUpdate;
    }

    Game.prototype.applyHybridDefaultCandidateProfile = function(reason = 'manual') {
      const ok = this.ensureHybridDefaultCandidateSystem?.().applyCandidateProfile?.(reason) || false;
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default candidate');
      return ok;
    };

    Game.prototype.toggleHybridDefaultCandidateMode = function() {
      const enabled = this.ensureHybridDefaultCandidateSystem?.().toggleArmed?.() || false;
      this.logSystem?.(`Hybrid default candidate: ${enabled ? 'Armed' : 'Disarmed'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default candidate');
      return enabled;
    };

    Game.prototype.toggleHybridCompatibilityMode = function() {
      const enabled = this.ensureHybridDefaultCandidateSystem?.().toggleCompatibilityMode?.() || false;
      this.logSystem?.(`Hybrid compatibility mode: ${enabled ? 'Canvas-only' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid compatibility');
      return enabled;
    };

    Game.prototype.resetHybridRendererCompatibility = function() {
      this.ensureHybridDefaultCandidateSystem?.().resetToCanvasStable?.('settings reset');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid reset');
      return true;
    };

    Game.prototype.getHybridDefaultCandidateSnapshot = function() {
      return this.ensureHybridDefaultCandidateSystem?.().snapshot?.() || null;
    };

    const perfClass = DR.PerformanceVerificationSystem;
    if (perfClass?.prototype?.settingsPanelHtml && !perfClass.prototype.settingsPanelHtml.__drHybridDefaultCandidateWrapped) {
      const originalSettingsHtml = perfClass.prototype.settingsPanelHtml;
      perfClass.prototype.settingsPanelHtml = function(escapeHtml) {
        const esc = typeof escapeHtml === 'function' ? escapeHtml : value => String(value);
        const html = originalSettingsHtml.call(this, escapeHtml);
        const snap = this.game?.getHybridDefaultCandidateSnapshot?.() || {};
        const armed = !!snap.armed;
        const compat = !!snap.compatibilityMode;
        const ready = !!snap.ready;
        const state = snap.state || 'idle';
        const disabled = snap.disabledLayers || 'none';
        const reason = snap.lastReason || 'ok';
        const health = `terrain ${snap.terrainHealth || 'unknown'}, sprites ${snap.spriteHealth || 'unknown'}, effects ${snap.effectHealth || 'unknown'}, damage ${snap.damageTextHealth || 'unknown'}`;
        const block = `
          <div class="settingsSectionTitle">Hybrid Default Candidate</div>
          <div class="small" style="margin-bottom:8px">Candidate mode enables Hybrid WebGL and promoted terrain/sprite/effect/damage-text layers together, but keeps Canvas fallback authoritative. Compatibility mode forces Canvas-only and persists across reloads.</div>
          <div class="settingsRow"><span>Hybrid Default Candidate</span><button class="toggleBtn ${armed ? 'active' : ''}" data-hybrid-default-candidate="1">${armed ? 'Armed' : 'Off'}</button></div>
          <div class="settingsRow"><span>Canvas Compatibility Mode</span><button class="toggleBtn ${compat ? 'active' : ''}" data-hybrid-compatibility-mode="1">${compat ? 'On' : 'Off'}</button></div>
          <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
            <button class="toggleBtn" data-hybrid-apply-default-candidate="1">Apply Candidate Profile</button>
            <button class="toggleBtn" data-hybrid-reset-canvas-stable="1">Reset Canvas Stable</button>
          </div>
          <div class="small" style="margin-bottom:8px">State: ${esc(state)}${ready ? ' · ready' : ''}. Safe frames ${Number(snap.safeFrames || 0)}, unstable ${Number(snap.unstableFrames || 0)}, disabled layers ${esc(disabled)}. Layer health: ${esc(health)}. Fallbacks ${Number(snap.frameFallbacks || 0)}, cost ${Number(snap.frameCostMs || 0).toFixed(2)}ms. Last: ${esc(reason)}.</div>
        `;
        return html.replace('<div class="settingsRow"><span>Benchmark</span>', `${block}<div class="settingsRow"><span>Benchmark</span>`);
      };
      perfClass.prototype.settingsPanelHtml.__drHybridDefaultCandidateWrapped = true;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drHybridDefaultCandidateWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          list?.querySelector('[data-hybrid-default-candidate]')?.addEventListener('click', () => this.toggleHybridDefaultCandidateMode?.());
          list?.querySelector('[data-hybrid-compatibility-mode]')?.addEventListener('click', () => this.toggleHybridCompatibilityMode?.());
          list?.querySelector('[data-hybrid-apply-default-candidate]')?.addEventListener('click', () => this.applyHybridDefaultCandidateProfile?.('settings apply'));
          list?.querySelector('[data-hybrid-reset-canvas-stable]')?.addEventListener('click', () => this.resetHybridRendererCompatibility?.());
        } catch (_err) {}
        return result;
      };
      wrappedRenderSettingsPanel.__drHybridDefaultCandidateWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }
  }

  DR.HybridDefaultCandidateSystem = { install, HybridDefaultCandidateSystem };
  DR.systems.HybridDefaultCandidateSystem = HybridDefaultCandidateSystem;
})();
