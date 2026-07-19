// Dream Realms V0.15.35: Player-facing performance/settings cleanup over the Hybrid renderer stack.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE = {
    advanced: 'dreamRealmsPerformanceSettingsAdvanced',
    profile: 'dreamRealmsRendererPlayerProfile'
  };

  const RENDERER_PROFILES = {
    auto: {
      id: 'auto',
      label: 'Auto',
      title: 'Recommended. Uses Hybrid GPU when healthy and Canvas fallback when needed.'
    },
    hybrid: {
      id: 'hybrid',
      label: 'Hybrid GPU',
      title: 'Forces the Hybrid WebGL path when available. Canvas fallback still remains active.'
    },
    canvas: {
      id: 'canvas',
      label: 'Canvas Safe Mode',
      title: 'Compatibility mode. Forces Canvas 2D and disables visible WebGL layers.'
    }
  };

  function safeStorageGet(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_err) {
      return fallback;
    }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_err) {}
  }

  function esc(value) {
    const str = String(value == null ? '' : value);
    return str.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function boolText(value) {
    return value ? 'On' : 'Off';
  }

  function clampNumber(value, min, max, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (_err) { return ''; }
  }

  class PerformanceSettingsCleanupSystem {
    constructor(game) {
      this.game = game;
      this.advanced = safeStorageGet(STORAGE.advanced, '0') === '1';
      const storedProfile = safeStorageGet(STORAGE.profile, 'auto') || 'auto';
      this.rendererProfile = RENDERER_PROFILES[storedProfile] ? storedProfile : 'auto';
      if (storedProfile !== this.rendererProfile) safeStorageSet(STORAGE.profile, this.rendererProfile);
      this.lastAction = 'initialized';
      this.lastReason = 'settings cleanup loaded';
      this.lastAppliedAt = 0;
    }

    setAdvanced(enabled, reason = 'settings') {
      this.advanced = !!enabled;
      safeStorageSet(STORAGE.advanced, this.advanced ? '1' : '0');
      this.lastAction = this.advanced ? 'advanced shown' : 'advanced hidden';
      this.lastReason = reason;
      this.game?.renderSettingsPanel?.();
      this.game?.markUiDirty?.('performance settings advanced');
      return this.advanced;
    }

    toggleAdvanced(reason = 'settings') {
      return this.setAdvanced(!this.advanced, reason);
    }

    setRendererProfile(profile, reason = 'settings') {
      const next = RENDERER_PROFILES[profile] ? profile : 'auto';
      this.rendererProfile = next;
      safeStorageSet(STORAGE.profile, next);
      this.lastAppliedAt = Date.now ? Date.now() : 0;
      this.lastAction = `renderer profile ${next}`;
      this.lastReason = reason;
      const game = this.game;
      try {
        if (next === 'canvas') {
          game?.setHybridDefaultRolloutPolicy?.('canvas');
          game?.ensureHybridDefaultCandidateSystem?.().forceCanvasCompatibility?.('player renderer profile canvas safe mode');
          game?.setRenderBackendMode?.('canvas2d', { reason: 'player renderer profile canvas safe mode' });
          game?.setWebglVisibleTerrainLayer?.(false);
          game?.setWebglVisibleSpriteLayer?.(false);
          game?.setWebglVisibleEffectLayer?.(false);
          game?.setWebglVisibleDamageTextLayer?.(false);
          game?.setWebglScenePreviewOverlay?.(false);
          game?.logSystem?.('Renderer profile: Canvas Safe Mode. WebGL layers disabled; Canvas fallback is authoritative.');
        } else if (next === 'hybrid') {
          game?.clearHybridDefaultRolloutRollback?.();
          game?.setHybridDefaultRolloutPolicy?.('hybrid');
          game?.ensureHybridDefaultRolloutSystem?.().setEnabled?.(true, 'player renderer profile hybrid gpu');
          const ok = game?.forceHybridDefaultRolloutNow?.();
          game?.logSystem?.(ok ? 'Renderer profile: Hybrid GPU forced. Canvas fallback remains active.' : 'Renderer profile: Hybrid GPU requested, but WebGL was denied or unavailable.');
        } else {
          game?.clearHybridDefaultRolloutRollback?.();
          game?.ensureHybridDefaultRolloutSystem?.().setEnabled?.(true, 'player renderer profile auto');
          game?.setHybridDefaultRolloutPolicy?.('auto');
          { const candidateSystem = game?.ensureHybridDefaultCandidateSystem?.(); if (candidateSystem) candidateSystem.compatibilityMode = false; }
          game?.ensureHybridDefaultRolloutSystem?.().applyHybridDefault?.('player renderer profile auto', { silent: true });
          game?.logSystem?.('Renderer profile: Auto. Hybrid GPU is used when healthy; Canvas fallback remains active.');
        }
      } catch (err) {
        this.lastAction = 'renderer profile apply failed';
        this.lastReason = err?.message || String(err || 'unknown');
        game?.recordRuntimeSystemFault?.({ id: 'performance-settings-cleanup' }, 'setRendererProfile', err);
      }
      game?.renderSettingsPanel?.();
      game?.markUiDirty?.('renderer player profile');
      return this.rendererProfile;
    }

    currentRendererProfile() {
      const rollout = this.game?.getHybridDefaultRolloutSnapshot?.() || {};
      const candidate = this.game?.getHybridDefaultCandidateSnapshot?.() || {};
      const mode = this.game?.getRenderBackendMode?.() || this.game?.perfStats?.renderBackendRendererMode || 'canvas2d';
      if (rollout.policy === 'canvas' || candidate.compatibilityMode || mode === 'canvas2d') {
        if (this.rendererProfile === 'canvas' || rollout.policy === 'canvas' || candidate.compatibilityMode) return 'canvas';
      }
      if (rollout.policy === 'hybrid' || this.rendererProfile === 'hybrid') return 'hybrid';
      return this.rendererProfile || 'auto';
    }

    snapshot() {
      const perf = this.game?.perfStats || {};
      const health = this.game?.getHybridRolloutHealthSnapshot?.() || {};
      const finalQa = this.game?.getHybridFinalQaSnapshot?.() || {};
      const rollout = this.game?.getHybridDefaultRolloutSnapshot?.() || {};
      const candidate = this.game?.getHybridDefaultCandidateSnapshot?.() || {};
      const backend = this.game?.ensureRenderBackendSystem?.();
      const backendMetrics = backend?.metrics || {};
      return {
        advanced: !!this.advanced,
        rendererProfile: this.currentRendererProfile(),
        storedRendererProfile: this.rendererProfile,
        performancePreset: this.game?.performanceVerifier?.preset || this.game?.perfStats?.performancePreset || 'balanced',
        performanceLabel: this.game?.performanceVerifier?.currentPresetDef?.().label || this.game?.perfStats?.performancePresetLabel || 'Balanced',
        lowSpecMode: !!this.game?.performanceVerifier?.lowSpecMode,
        rendererMode: this.game?.getRenderBackendMode?.() || backendMetrics.rendererMode || perf.renderBackendRendererMode || 'canvas2d',
        webglReady: !!(perf.webglPrototypeReady || perf.renderBackendWebglPrototypeReady || backendMetrics.webglPrototypeReady),
        activeLayers: rollout.layers || perf.hybridDefaultRolloutLayers || perf.renderBackendHybridVisiblePromotedLayerMask || 'none',
        rolloutState: rollout.state || perf.hybridDefaultRolloutState || 'unknown',
        rolloutPolicy: rollout.policy || perf.hybridDefaultRolloutPolicy || 'auto',
        rollbackActive: !!(rollout.rollbackActive || perf.hybridDefaultRolloutRollbackActive),
        rollbackRemainingMs: Number(rollout.rollbackRemainingMs || perf.hybridDefaultRolloutRollbackRemainingMs || 0),
        candidateState: candidate.state || perf.hybridDefaultCandidateState || 'unknown',
        healthScore: clampNumber(health.score ?? perf.hybridRolloutHealthScore, 0, 100, 0),
        healthStatus: health.status || perf.hybridRolloutHealthStatus || 'pending',
        finalQaScore: clampNumber(finalQa.score ?? perf.hybridFinalQaScore, 0, 100, 0),
        finalQaStatus: finalQa.status || perf.hybridFinalQaStatus || 'pending',
        releaseReady: !!(finalQa.releaseCandidateReady || perf.hybridFinalQaReleaseCandidateReady),
        blockedLayers: finalQa.blockedLayers || perf.hybridFinalQaBlockedLayers || perf.hybridQaHeldOffLayers || 'none',
        lastHealthRecommendation: health.recommendation || perf.hybridRolloutHealthRecommendation || '',
        lastQaRecommendation: finalQa.releaseRecommendation || perf.hybridFinalQaRecommendation || '',
        lastAction: this.lastAction,
        lastReason: this.lastReason
      };
    }

    statusLine() {
      const s = this.snapshot();
      const rollback = s.rollbackActive ? `rollback ${Math.ceil(s.rollbackRemainingMs / 60000)}m` : 'no rollback';
      return `Renderer ${RENDERER_PROFILES[s.rendererProfile]?.label || s.rendererProfile}, ${s.rendererMode}, WebGL ${s.webglReady ? 'ready' : 'unavailable'}, health ${s.healthScore}/100 ${s.healthStatus}, QA ${s.finalQaScore}/100 ${s.finalQaStatus}, layers ${s.activeLayers || 'none'}, ${rollback}.`;
    }

    exportPayload() {
      return {
        build: window.DREAM_REALMS_BUILD_NAME || '',
        version: window.DREAM_REALMS_VERSION || '',
        createdAt: nowIso(),
        settingsCleanup: this.snapshot(),
        rollout: this.game?.getHybridDefaultRolloutSnapshot?.() || null,
        health: this.game?.getHybridRolloutHealthSnapshot?.() || null,
        finalQa: this.game?.getHybridFinalQaSnapshot?.() || null,
        performanceBenchmark: this.game?.performanceVerifier?.lastBenchmark || null
      };
    }
  }

  function buildSimpleSettingsHtml(system, originalHtml) {
    const s = system.snapshot();
    const presets = DR.PERFORMANCE_PRESETS || {};
    const presetButtons = Object.entries(presets).map(([id, p]) => {
      const active = id === s.performancePreset ? 'active' : '';
      return `<button class="toggleBtn ${active}" data-performance-preset="${esc(id)}" title="${esc(p.description || p.label || id)}">${esc(p.label || id)}</button>`;
    }).join('');
    const debugOpen = !!(system.game?.debugOverlayOpen || DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true);
    const advancedBlock = debugOpen && system.advanced
      ? `<details open class="performanceAdvancedBlock"><summary>Debug Performance Diagnostics</summary>${originalHtml || ''}</details>`
      : '';
    const advancedToggle = debugOpen
      ? `<div class="settingsRow"><span>Debug Diagnostics</span><button class="toggleBtn ${system.advanced ? 'active' : ''}" data-performance-settings-advanced="1">${system.advanced ? 'Shown' : 'Hidden'}</button></div>`
      : '';
    return `
      <div class="settingsSectionTitle">Performance</div>
      <div class="settingsRow" style="gap:6px;flex-wrap:wrap"><span>Preset</span><div style="display:flex;gap:6px;flex-wrap:wrap">${presetButtons}</div></div>
      <div class="settingsRow"><span>Low-Spec Mode</span><button class="toggleBtn ${s.lowSpecMode ? 'active' : ''}" data-performance-low-spec="1">${boolText(s.lowSpecMode)}</button></div>
      ${advancedToggle}
      ${advancedBlock}
    `;
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drPerformanceSettingsCleanupInstalled) return;
    Game.prototype.__drPerformanceSettingsCleanupInstalled = true;

    Game.prototype.ensurePerformanceSettingsCleanupSystem = function() {
      if (!this.performanceSettingsCleanupSystem) this.performanceSettingsCleanupSystem = new PerformanceSettingsCleanupSystem(this);
      return this.performanceSettingsCleanupSystem;
    };

    Game.prototype.setRendererPlayerProfile = function(profile, reason = 'settings') {
      return this.ensurePerformanceSettingsCleanupSystem?.().setRendererProfile?.(profile, reason);
    };

    Game.prototype.togglePerformanceSettingsAdvanced = function() {
      return this.ensurePerformanceSettingsCleanupSystem?.().toggleAdvanced?.('settings toggle');
    };

    Game.prototype.resetRendererPerformanceAuto = function() {
      const sys = this.ensurePerformanceSettingsCleanupSystem?.();
      this.resetPerformanceSettings?.();
      this.clearHybridDefaultRolloutRollback?.();
      this.clearHybridRendererQaHoldoffs?.('reset auto');
      this.clearHybridFinalQaLayerBlocks?.('reset auto');
      { const candidate = this.ensureHybridDefaultCandidateSystem?.(); candidate?.clearDisabledLayers?.('reset auto'); candidate?.disabledLayers?.clear?.(); }
      sys?.setRendererProfile?.('auto', 'reset auto');
      this.logSystem?.('Renderer/performance profile reset to Auto + Balanced.');
      this.renderSettingsPanel?.();
      return true;
    };

    Game.prototype.clearRendererRollbacksAndHolds = function() {
      this.clearHybridDefaultRolloutRollback?.();
      this.clearHybridRendererQaHoldoffs?.('settings clear rollbacks');
      this.clearHybridFinalQaLayerBlocks?.('settings clear rollbacks');
      { const candidate = this.ensureHybridDefaultCandidateSystem?.(); candidate?.clearDisabledLayers?.('settings clear rollbacks'); candidate?.disabledLayers?.clear?.(); }
      this.ensureHybridDefaultRolloutSystem?.().applyHybridDefault?.('settings clear rollbacks', { silent: true });
      this.logSystem?.('Hybrid renderer rollbacks and layer holdoffs cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('renderer clear rollbacks');
      return true;
    };

    Game.prototype.exportRendererHealthJson = function() {
      const payload = this.ensurePerformanceSettingsCleanupSystem?.().exportPayload?.() || {};
      const json = JSON.stringify(payload, null, 2);
      const filename = `dream-realms-renderer-health-${Date.now ? Date.now() : 'report'}.json`;
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.logSystem?.('Renderer health JSON exported.');
      } catch (_err) {
        try { navigator.clipboard?.writeText?.(json); this.logSystem?.('Renderer health JSON copied to clipboard.'); } catch (__err) { this.logSystem?.('Renderer health JSON export failed.'); }
      }
      return payload;
    };

    const perfClass = DR.PerformanceVerificationSystem || DR.systems?.PerformanceVerificationSystem;
    if (perfClass?.prototype && typeof perfClass.prototype.settingsPanelHtml === 'function' && !perfClass.prototype.settingsPanelHtml.__drPerformanceSettingsCleanupWrapped) {
      const originalSettingsPanelHtml = perfClass.prototype.settingsPanelHtml;
      const wrappedSettingsPanelHtml = function(...args) {
        const game = this.game;
        const system = game?.ensurePerformanceSettingsCleanupSystem?.();
        let originalHtml = '';
        if (system?.advanced) {
          try { originalHtml = originalSettingsPanelHtml.apply(this, args) || ''; } catch (err) { originalHtml = `<div class="small">Advanced settings unavailable: ${esc(err?.message || err)}</div>`; }
        }
        if (!system) return originalSettingsPanelHtml.apply(this, args);
        return buildSimpleSettingsHtml(system, originalHtml);
      };
      wrappedSettingsPanelHtml.__drPerformanceSettingsCleanupWrapped = true;
      perfClass.prototype.settingsPanelHtml = wrappedSettingsPanelHtml;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drPerformanceSettingsCleanupWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          if (list) {
            list.querySelector('[data-performance-settings-advanced]')?.addEventListener('click', () => this.togglePerformanceSettingsAdvanced?.());
          }
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'performance-settings-cleanup' }, 'renderSettingsPanel listeners', err);
        }
        return result;
      };
      wrappedRenderSettingsPanel.__drPerformanceSettingsCleanupWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }

    const originalUpdateDebugOverlay = Game.prototype.updateDebugOverlay;
    if (typeof originalUpdateDebugOverlay === 'function' && !originalUpdateDebugOverlay.__drPerformanceSettingsCleanupWrapped) {
      const wrappedUpdateDebugOverlay = function(force, ...rest) {
        const result = originalUpdateDebugOverlay.call(this, force, ...rest);
        try {
          const body = document.getElementById('debugBody');
          if (body && (this.debugOverlayOpen || force || DR.CONFIG?.PERFORMANCE?.showPerformanceOverlay === true)) {
            const snap = this.ensurePerformanceSettingsCleanupSystem?.().snapshot?.();
            if (snap) {
              const row = document.createElement('div');
              row.textContent = `Player perf profile: renderer ${RENDERER_PROFILES[snap.rendererProfile]?.label || snap.rendererProfile}, preset ${snap.performanceLabel}, low-spec ${snap.lowSpecMode ? 'on' : 'off'}, health ${Math.round(snap.healthScore || 0)}/100, QA ${Math.round(snap.finalQaScore || 0)}/100.`;
              body.appendChild(row);
            }
          }
        } catch (_err) {}
        return result;
      };
      wrappedUpdateDebugOverlay.__drPerformanceSettingsCleanupWrapped = true;
      Game.prototype.updateDebugOverlay = wrappedUpdateDebugOverlay;
    }
  }

  DR.PerformanceSettingsCleanupSystem = PerformanceSettingsCleanupSystem;
  DR.systems.PerformanceSettingsCleanupSystem = PerformanceSettingsCleanupSystem;
  DR.PERFORMANCE_RENDERER_PROFILES = RENDERER_PROFILES;

  DR.PerformanceSettingsCleanupInstaller = { install };

  if (DR.Game) install(DR.Game);
})();
