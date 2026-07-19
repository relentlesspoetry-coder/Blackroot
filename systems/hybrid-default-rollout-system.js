// Dream Realms V0.15.32: Hybrid renderer default rollout, rollback, and compatibility policy.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsHybridDefaultRollout';
  const ONE_HOUR_MS = 60 * 60 * 1000;

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function wallClockMs() {
    return Date.now ? Date.now() : new Date().getTime();
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

  function normalizePolicy(value, fallback = 'auto') {
    const raw = String(value || '').toLowerCase().trim();
    if (raw === 'hybrid' || raw === 'hybrid-default' || raw === 'webgl') return 'hybrid';
    if (raw === 'canvas' || raw === 'canvas-stable' || raw === 'canvas2d') return 'canvas';
    return fallback;
  }

  class HybridDefaultRolloutSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.enabled = toBool(safeGet(`${STORAGE_PREFIX}:enabled`, cfg.hybridDefaultRolloutEnabledDefault === false ? '0' : '1'), cfg.hybridDefaultRolloutEnabledDefault !== false);
      this.policy = normalizePolicy(safeGet(`${STORAGE_PREFIX}:policy`, cfg.hybridDefaultRolloutPolicy || 'auto'), cfg.hybridDefaultRolloutPolicy || 'auto');
      this.rollbackUntilWallMs = clampInt(safeGet(`${STORAGE_PREFIX}:rollbackUntilWallMs`, '0'), 0, 0, 4102444800000);
      this.failureCount = clampInt(safeGet(`${STORAGE_PREFIX}:failureCount`, '0'), 0, 0, 999999);
      this.successfulFrames = clampInt(safeGet(`${STORAGE_PREFIX}:successfulFrames`, '0'), 0, 0, 999999);
      this.unstableFrames = 0;
      this.lastApplyMs = 0;
      this.lastRollbackWallMs = clampInt(safeGet(`${STORAGE_PREFIX}:lastRollbackWallMs`, '0'), 0, 0, 4102444800000);
      this.rolloutAttemptedThisSession = false;
      this.defaultActive = false;
      this.lastAction = 'initialized';
      this.lastReason = '';
      this.lastRisk = 'pending';
      this.lastSnapshotMs = 0;
      this.metrics = {
        enabled: this.enabled,
        policy: this.policy,
        state: 'initializing',
        defaultActive: false,
        rollbackActive: this.rollbackActive(),
        rollbackRemainingMs: this.rollbackRemainingMs(),
        successfulFrames: this.successfulFrames,
        unstableFrames: 0,
        failureCount: this.failureCount,
        lastAction: this.lastAction,
        lastReason: this.lastReason,
        risk: this.lastRisk,
        candidateState: 'unknown',
        qaState: 'unknown',
        compatibilityMode: false,
        webglAvailable: false,
        layers: 'none'
      };
      this.syncPerfStats();
    }

    settings() {
      return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
    }

    backend() {
      return this.game?.ensureRenderBackendSystem?.() || null;
    }

    candidate() {
      return this.game?.ensureHybridDefaultCandidateSystem?.() || null;
    }

    qa() {
      return this.game?.ensureHybridRendererQaSystem?.() || null;
    }

    persist() {
      safeSet(`${STORAGE_PREFIX}:enabled`, this.enabled ? '1' : '0');
      safeSet(`${STORAGE_PREFIX}:policy`, this.policy || 'auto');
      safeSet(`${STORAGE_PREFIX}:rollbackUntilWallMs`, String(Math.floor(Number(this.rollbackUntilWallMs || 0) || 0)));
      safeSet(`${STORAGE_PREFIX}:failureCount`, String(Math.floor(Number(this.failureCount || 0) || 0)));
      safeSet(`${STORAGE_PREFIX}:successfulFrames`, String(Math.floor(Number(this.successfulFrames || 0) || 0)));
      safeSet(`${STORAGE_PREFIX}:lastRollbackWallMs`, String(Math.floor(Number(this.lastRollbackWallMs || 0) || 0)));
    }

    rollbackActive() {
      return Number(this.rollbackUntilWallMs || 0) > wallClockMs();
    }

    rollbackRemainingMs() {
      return Math.max(0, Number(this.rollbackUntilWallMs || 0) - wallClockMs());
    }

    clearRollback(reason = 'manual clear') {
      this.rollbackUntilWallMs = 0;
      this.unstableFrames = 0;
      this.failureCount = 0;
      this.lastAction = 'rollback cleared';
      this.lastReason = reason;
      safeRemove(`${STORAGE_PREFIX}:rollbackUntilWallMs`);
      this.persist();
      this.syncPerfStats();
      return true;
    }

    setEnabled(enabled, reason = 'manual') {
      this.enabled = !!enabled;
      this.lastAction = this.enabled ? 'rollout enabled' : 'rollout disabled';
      this.lastReason = reason;
      if (!this.enabled) this.defaultActive = false;
      this.persist();
      this.syncPerfStats();
      return this.enabled;
    }

    setPolicy(policy, reason = 'manual') {
      this.policy = normalizePolicy(policy, 'auto');
      this.lastAction = 'policy changed';
      this.lastReason = `${reason}:${this.policy}`;
      if (this.policy === 'canvas') {
        this.defaultActive = false;
        try { this.candidate()?.resetToCanvasStable?.('hybrid rollout policy canvas'); } catch (_err) {}
      }
      if (this.policy === 'hybrid') {
        this.clearRollback('policy hybrid');
        this.applyHybridDefault('policy hybrid');
      }
      this.persist();
      this.syncPerfStats();
      return this.policy;
    }

    forceHybridNow(reason = 'manual force') {
      this.enabled = true;
      this.policy = 'hybrid';
      this.clearRollback(reason);
      return this.applyHybridDefault(reason, { force: true });
    }

    rollbackToCanvas(reason = 'rollout rollback', hours = null) {
      const cfg = this.settings();
      const rollbackHours = Math.max(1, Number(hours ?? cfg.hybridDefaultRolloutRollbackHours ?? 6) || 6);
      this.rollbackUntilWallMs = wallClockMs() + rollbackHours * ONE_HOUR_MS;
      this.lastRollbackWallMs = wallClockMs();
      this.defaultActive = false;
      this.failureCount += 1;
      this.unstableFrames = 0;
      this.successfulFrames = 0;
      this.lastAction = 'rollback canvas';
      this.lastReason = reason;
      try { this.candidate()?.resetToCanvasStable?.(`hybrid rollout rollback: ${reason}`); } catch (_err) {}
      this.persist();
      this.game?.logSystem?.(`Hybrid default rollout rolled back to Canvas Stable for ${Math.round(rollbackHours)}h: ${reason}.`);
      this.syncPerfStats();
      return true;
    }

    applyHybridDefault(reason = 'rollout default', options = {}) {
      const cfg = this.settings();
      if (cfg.enableHybridDefaultRollout === false || !this.enabled) return false;
      if (this.policy === 'canvas') {
        this.lastAction = 'canvas policy';
        this.lastReason = reason;
        return false;
      }
      if (this.rollbackActive() && options.force !== true) {
        this.lastAction = 'rollback active';
        this.lastReason = reason;
        return false;
      }
      const backend = this.backend();
      if (!backend) return false;
      backend.syncPerfStats?.();
      if (backend.metrics?.webglContextLost) {
        this.lastAction = 'webgl unavailable';
        this.lastReason = 'context lost';
        return false;
      }
      if (!backend.metrics?.webglPrototypeReady) {
        try { backend.initWebglPrototype?.(); } catch (_err) {}
      }
      if (!backend.metrics?.webglPrototypeReady) {
        this.lastAction = 'webgl unavailable';
        this.lastReason = backend.metrics?.renderBackendModeDeniedReason || 'WebGL unavailable';
        return false;
      }
      const candidate = this.candidate();
      const ok = candidate?.applyCandidateProfile?.(reason, { silent: options.silent === true }) === true || backend.isHybridRendererMode?.() === true;
      this.rolloutAttemptedThisSession = true;
      this.lastApplyMs = nowMs();
      if (ok) {
        this.lastAction = 'hybrid default applied';
        this.lastReason = reason;
      } else {
        this.lastAction = 'hybrid default denied';
        this.lastReason = backend.metrics?.renderBackendModeDeniedReason || candidate?.metrics?.lastReason || 'candidate denied';
      }
      this.persist();
      this.syncPerfStats();
      return ok;
    }

    layerMask(perf) {
      const parts = [];
      if (perf.renderBackendWebglVisibleTerrainLayerActive) parts.push('terrain');
      if (perf.renderBackendWebglVisibleSpriteLayerActive) parts.push('sprites');
      if (perf.renderBackendWebglVisibleEffectLayerActive) parts.push('effects');
      if (perf.renderBackendWebglVisibleDamageTextLayerActive) parts.push('damage');
      return parts.join(',') || 'none';
    }

    calculateRisk(perf, candidateSnap, qaSnap) {
      if (candidateSnap?.compatibilityMode) return { risk: 'compatibility', unstable: false, reason: 'canvas compatibility mode' };
      if (this.rollbackActive()) return { risk: 'rollback', unstable: false, reason: 'rollback active' };
      if (perf.renderBackendWebglContextLost) return { risk: 'critical', unstable: true, reason: 'WebGL context lost' };
      if (perf.renderBackendModeDenied) return { risk: 'high', unstable: true, reason: perf.renderBackendModeDeniedReason || 'renderer denied' };
      if (perf.renderBackendHybridPromotionBlockedByAudit) return { risk: 'medium', unstable: true, reason: perf.renderBackendHybridCameraDepthAuditLastReason || 'hybrid audit blocked' };
      if (candidateSnap?.persistentHoldOff) return { risk: 'high', unstable: true, reason: candidateSnap.lastReason || 'candidate holdoff' };
      if (qaSnap?.heldOffLayers && qaSnap.heldOffLayers !== 'none') return { risk: 'medium', unstable: true, reason: `QA holdoff ${qaSnap.heldOffLayers}` };
      const cfg = this.settings();
      const fallbackBudget = Math.max(1, Number(cfg.hybridDefaultRolloutMaxFallbacksPerFrame || cfg.hybridDefaultCandidateMaxFallbacksPerFrame || 18) || 18);
      const costBudget = Math.max(1, Number(cfg.hybridDefaultRolloutMaxFrameCostMs || cfg.hybridDefaultCandidateMaxFrameCostMs || 9.0) || 9.0);
      const fallbacks = Number(candidateSnap?.frameFallbacks ?? perf.hybridDefaultCandidateFallbacks ?? 0) || 0;
      const cost = Number(candidateSnap?.frameCostMs ?? perf.hybridDefaultCandidateCostMs ?? 0) || 0;
      if (fallbacks > fallbackBudget) return { risk: 'medium', unstable: true, reason: `fallback ${fallbacks}/${fallbackBudget}` };
      if (cost > costBudget) return { risk: 'medium', unstable: true, reason: `hybrid cost ${cost.toFixed(1)}ms/${costBudget.toFixed(1)}ms` };
      if (!perf.renderBackendWebglPrototypeReady) return { risk: 'low', unstable: false, reason: 'waiting for WebGL ready' };
      return { risk: 'low', unstable: false, reason: 'ok' };
    }

    update(_dt) {
      const cfg = this.settings();
      const perf = this.game?.perfStats || {};
      if (cfg.enableHybridDefaultRollout === false) {
        this.enabled = false;
        this.metrics.state = 'disabled';
        this.syncPerfStats();
        return;
      }
      const backend = this.backend();
      const candidate = this.candidate();
      const qa = this.qa();
      backend?.syncPerfStats?.();
      candidate?.syncPerfStats?.();
      qa?.syncPerfStats?.();
      const candidateSnap = candidate?.snapshot?.() || {};
      const qaSnap = qa?.snapshot?.() || {};
      const rollback = this.rollbackActive();
      const compat = !!candidateSnap.compatibilityMode;
      // The experimental 3D renderer is a separate, player-chosen mode this
      // rollout system does not own. Stand down entirely while it is active
      // instead of fighting it back to hybrid-webgl-prototype/canvas2d, the
      // same way this system already stands down for policy === 'canvas'.
      const shouldAutoApply = this.enabled && this.policy !== 'canvas' && !rollback && !compat && !backend?.is3DRendererMode?.();
      const reapplyMs = Math.max(1000, Number(cfg.hybridDefaultRolloutReapplyMs || 3500) || 3500);
      if (shouldAutoApply && (!backend?.isHybridRendererMode?.() || !candidateSnap.armed) && nowMs() - this.lastApplyMs > reapplyMs) {
        this.applyHybridDefault(this.rolloutAttemptedThisSession ? 'rollout reapply' : 'rollout startup default', { silent: this.rolloutAttemptedThisSession });
      }
      const risk = this.calculateRisk(perf, candidateSnap, qaSnap);
      this.lastRisk = risk.risk;
      const activeHybrid = !!backend?.isHybridRendererMode?.();
      const activeLayers = this.layerMask(perf);
      if (risk.unstable && shouldAutoApply) {
        this.unstableFrames += 1;
        this.successfulFrames = 0;
      } else if (shouldAutoApply && activeHybrid && activeLayers !== 'none') {
        this.unstableFrames = 0;
        this.successfulFrames = Math.min(999999, Number(this.successfulFrames || 0) + 1);
      } else {
        this.unstableFrames = 0;
      }
      const rollbackFrames = Math.max(8, Number(cfg.hybridDefaultRolloutRollbackFrames || 28) || 28);
      if (shouldAutoApply && risk.unstable && this.unstableFrames >= rollbackFrames && (risk.risk === 'critical' || risk.risk === 'high')) {
        this.rollbackToCanvas(risk.reason);
      }
      const defaultFrames = Math.max(30, Number(cfg.hybridDefaultRolloutDefaultActiveFrames || 300) || 300);
      this.defaultActive = shouldAutoApply && activeHybrid && activeLayers !== 'none' && this.successfulFrames >= defaultFrames && !risk.unstable;
      this.metrics.enabled = !!this.enabled;
      this.metrics.policy = this.policy;
      this.metrics.defaultActive = !!this.defaultActive;
      this.metrics.rollbackActive = this.rollbackActive();
      this.metrics.rollbackRemainingMs = this.rollbackRemainingMs();
      this.metrics.successfulFrames = this.successfulFrames;
      this.metrics.unstableFrames = this.unstableFrames;
      this.metrics.failureCount = this.failureCount;
      this.metrics.lastAction = this.lastAction;
      this.metrics.lastReason = risk.reason || this.lastReason || 'ok';
      this.metrics.risk = this.lastRisk;
      this.metrics.candidateState = candidateSnap.state || 'unknown';
      this.metrics.qaState = qaSnap.state || 'unknown';
      this.metrics.compatibilityMode = compat;
      this.metrics.webglAvailable = !!perf.renderBackendWebglPrototypeReady;
      this.metrics.layers = activeLayers;
      this.metrics.state = !this.enabled ? 'disabled'
        : this.policy === 'canvas' ? 'canvas-policy'
          : compat ? 'compatibility-canvas'
            : this.metrics.rollbackActive ? 'rollback-canvas'
              : this.defaultActive ? 'hybrid-default-active'
                : shouldAutoApply ? (risk.unstable ? 'stabilizing-risk' : 'warming-hybrid-default')
                  : 'canvas-stable';
      this.persist();
      this.syncPerfStats();
    }

    snapshot() {
      return { ...this.metrics };
    }

    syncPerfStats() {
      const perf = this.game?.perfStats;
      if (!perf) return;
      const m = this.metrics || {};
      perf.hybridDefaultRolloutEnabled = !!m.enabled;
      perf.hybridDefaultRolloutPolicy = m.policy || 'auto';
      perf.hybridDefaultRolloutState = m.state || 'idle';
      perf.hybridDefaultRolloutDefaultActive = !!m.defaultActive;
      perf.hybridDefaultRolloutRollbackActive = !!m.rollbackActive;
      perf.hybridDefaultRolloutRollbackRemainingMs = Number(m.rollbackRemainingMs || 0) || 0;
      perf.hybridDefaultRolloutSuccessfulFrames = Number(m.successfulFrames || 0) || 0;
      perf.hybridDefaultRolloutUnstableFrames = Number(m.unstableFrames || 0) || 0;
      perf.hybridDefaultRolloutFailureCount = Number(m.failureCount || 0) || 0;
      perf.hybridDefaultRolloutLastAction = m.lastAction || '';
      perf.hybridDefaultRolloutLastReason = m.lastReason || '';
      perf.hybridDefaultRolloutRisk = m.risk || 'pending';
      perf.hybridDefaultRolloutCandidateState = m.candidateState || 'unknown';
      perf.hybridDefaultRolloutQaState = m.qaState || 'unknown';
      perf.hybridDefaultRolloutCompatibilityMode = !!m.compatibilityMode;
      perf.hybridDefaultRolloutWebglAvailable = !!m.webglAvailable;
      perf.hybridDefaultRolloutLayers = m.layers || 'none';
    }
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drHybridDefaultRolloutInstalled) return;
    Game.prototype.__drHybridDefaultRolloutInstalled = true;

    Game.prototype.ensureHybridDefaultRolloutSystem = function() {
      if (!this.hybridDefaultRolloutSystem) this.hybridDefaultRolloutSystem = new HybridDefaultRolloutSystem(this);
      return this.hybridDefaultRolloutSystem;
    };

    const originalUpdate = Game.prototype.update;
    if (typeof originalUpdate === 'function' && !originalUpdate.__drHybridDefaultRolloutWrapped) {
      const wrappedUpdate = function(dt, ...rest) {
        const result = originalUpdate.call(this, dt, ...rest);
        try { this.ensureHybridDefaultRolloutSystem?.().update?.(dt); } catch (err) { this.recordRuntimeSystemFault?.({ id: 'hybrid-default-rollout' }, 'update', err); }
        return result;
      };
      wrappedUpdate.__drHybridDefaultRolloutWrapped = true;
      Game.prototype.update = wrappedUpdate;
    }

    Game.prototype.toggleHybridDefaultRollout = function() {
      const system = this.ensureHybridDefaultRolloutSystem?.();
      const enabled = system?.setEnabled?.(!system.enabled, 'settings toggle') || false;
      this.logSystem?.(`Hybrid default rollout: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default rollout');
      return enabled;
    };

    Game.prototype.setHybridDefaultRolloutPolicy = function(policy) {
      const system = this.ensureHybridDefaultRolloutSystem?.();
      const next = system?.setPolicy?.(policy, 'settings') || 'auto';
      this.logSystem?.(`Hybrid default rollout policy: ${next}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default rollout policy');
      return next;
    };

    Game.prototype.forceHybridDefaultRolloutNow = function() {
      const ok = this.ensureHybridDefaultRolloutSystem?.().forceHybridNow?.('settings force hybrid') === true;
      this.logSystem?.(ok ? 'Hybrid default rollout forced now.' : 'Hybrid default rollout force failed; Canvas fallback remains active.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default rollout force');
      return ok;
    };

    Game.prototype.rollbackHybridDefaultRollout = function() {
      const ok = this.ensureHybridDefaultRolloutSystem?.().rollbackToCanvas?.('settings rollback') === true;
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default rollout rollback');
      return ok;
    };

    Game.prototype.clearHybridDefaultRolloutRollback = function() {
      const ok = this.ensureHybridDefaultRolloutSystem?.().clearRollback?.('settings clear rollback') === true;
      this.logSystem?.('Hybrid default rollout rollback cleared.');
      this.renderSettingsPanel?.();
      this.markUiDirty?.('hybrid default rollout clear rollback');
      return ok;
    };

    Game.prototype.getHybridDefaultRolloutSnapshot = function() {
      return this.ensureHybridDefaultRolloutSystem?.().snapshot?.() || null;
    };

    const perfClass = DR.PerformanceVerificationSystem;
    if (perfClass?.prototype?.settingsPanelHtml && !perfClass.prototype.settingsPanelHtml.__drHybridDefaultRolloutWrapped) {
      const originalSettingsHtml = perfClass.prototype.settingsPanelHtml;
      perfClass.prototype.settingsPanelHtml = function(escapeHtml) {
        const esc = typeof escapeHtml === 'function' ? escapeHtml : value => String(value);
        const html = originalSettingsHtml.call(this, escapeHtml);
        const snap = this.game?.getHybridDefaultRolloutSnapshot?.() || {};
        const rollbackSec = Math.ceil(Number(snap.rollbackRemainingMs || 0) / 1000);
        const policy = snap.policy || 'auto';
        const policyButton = value => `<button class="toggleBtn ${policy === value ? 'active' : ''}" data-hybrid-rollout-policy="${value}">${value}</button>`;
        const block = `
          <div class="settingsSectionTitle">Hybrid Default Rollout</div>
          <div class="small" style="margin-bottom:8px">Hybrid is now the default rollout path when WebGL is healthy. Canvas Compatibility Mode and automatic rollback remain available for unstable devices.</div>
          <div class="settingsRow"><span>Default Rollout</span><button class="toggleBtn ${snap.enabled ? 'active' : ''}" data-hybrid-default-rollout-toggle="1">${snap.enabled ? 'On' : 'Off'}</button></div>
          <div class="settingsRow" style="gap:6px;flex-wrap:wrap"><span>Policy</span>${policyButton('auto')}${policyButton('hybrid')}${policyButton('canvas')}</div>
          <div class="settingsRow" style="gap:6px;flex-wrap:wrap">
            <button class="toggleBtn" data-hybrid-rollout-force="1">Force Hybrid Now</button>
            <button class="toggleBtn" data-hybrid-rollout-rollback="1">Rollback Canvas</button>
            <button class="toggleBtn" data-hybrid-rollout-clear="1">Clear Rollback</button>
          </div>
          <div class="small" style="margin-bottom:8px">State: ${esc(snap.state || 'idle')}, active ${snap.defaultActive ? 'yes' : 'no'}, risk ${esc(snap.risk || 'pending')}, layers ${esc(snap.layers || 'none')}, success ${Number(snap.successfulFrames || 0)}, unstable ${Number(snap.unstableFrames || 0)}, failures ${Number(snap.failureCount || 0)}, rollback ${rollbackSec > 0 ? `${rollbackSec}s` : 'off'}. Last: ${esc(snap.lastReason || 'ok')}.</div>
        `;
        return html.replace('<div class="settingsSectionTitle">Hybrid Default Candidate</div>', `${block}<div class="settingsSectionTitle">Hybrid Default Candidate</div>`);
      };
      perfClass.prototype.settingsPanelHtml.__drHybridDefaultRolloutWrapped = true;
    }

    const originalRenderSettingsPanel = Game.prototype.renderSettingsPanel;
    if (typeof originalRenderSettingsPanel === 'function' && !originalRenderSettingsPanel.__drHybridDefaultRolloutWrapped) {
      const wrappedRenderSettingsPanel = function(...args) {
        const result = originalRenderSettingsPanel.apply(this, args);
        try {
          const list = document.getElementById('settingsList');
          list?.querySelector('[data-hybrid-default-rollout-toggle]')?.addEventListener('click', () => this.toggleHybridDefaultRollout?.());
          list?.querySelectorAll('[data-hybrid-rollout-policy]')?.forEach(btn => btn.addEventListener('click', () => this.setHybridDefaultRolloutPolicy?.(btn.getAttribute('data-hybrid-rollout-policy') || 'auto')));
          list?.querySelector('[data-hybrid-rollout-force]')?.addEventListener('click', () => this.forceHybridDefaultRolloutNow?.());
          list?.querySelector('[data-hybrid-rollout-rollback]')?.addEventListener('click', () => this.rollbackHybridDefaultRollout?.());
          list?.querySelector('[data-hybrid-rollout-clear]')?.addEventListener('click', () => this.clearHybridDefaultRolloutRollback?.());
        } catch (_err) {}
        return result;
      };
      wrappedRenderSettingsPanel.__drHybridDefaultRolloutWrapped = true;
      Game.prototype.renderSettingsPanel = wrappedRenderSettingsPanel;
    }
  }

  DR.HybridDefaultRolloutSystem = { install, HybridDefaultRolloutSystem };
  DR.systems.HybridDefaultRolloutSystem = HybridDefaultRolloutSystem;
})();
