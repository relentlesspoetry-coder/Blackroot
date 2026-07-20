// Dream Realms V0.15.29: Hybrid renderer depth/camera audit with promotion guardrails.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function clamp01(value) {
    const n = Number(value) || 0;
    return Math.max(0, Math.min(1, n));
  }

  function createScratchCanvas(width, height, preferOffscreen) {
    const w = Math.max(1, Math.ceil(Number(width) || 1));
    const h = Math.max(1, Math.ceil(Number(height) || 1));
    if (preferOffscreen && typeof OffscreenCanvas !== 'undefined') {
      try { return new OffscreenCanvas(w, h); } catch (_err) {}
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function resizeScratchCanvas(canvas, width, height) {
    const w = Math.max(1, Math.ceil(Number(width) || 1));
    const h = Math.max(1, Math.ceil(Number(height) || 1));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }



  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      try { console.warn('[DreamRealms] WebGL shader compile failed:', gl.getShaderInfoLog(shader)); } catch (_err) {}
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      try { console.warn('[DreamRealms] WebGL program link failed:', gl.getProgramInfoLog(program)); } catch (_err) {}
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function safeLocalStorageGet(key, fallback = '') {
    try {
      const value = window.localStorage?.getItem?.(key);
      return value == null || value === '' ? fallback : value;
    } catch (_err) {
      return fallback;
    }
  }

  function safeLocalStorageSet(key, value) {
    try { window.localStorage?.setItem?.(key, String(value)); } catch (_err) {}
  }

  function fillPolyPath(c, points) {
    if (!c || !points || !points.length) return;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
    c.closePath();
    c.fill();
  }

  function finiteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function angleDeltaRad(a, b) {
    let d = (Number(a) || 0) - (Number(b) || 0);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function distance2d(ax, ay, bx, by) {
    const dx = finiteNumber(ax, 0) - finiteNumber(bx, 0);
    const dy = finiteNumber(ay, 0) - finiteNumber(by, 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function rgbaFromHex(hex, alpha) {
    const value = String(hex || '#ffffff').trim();
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    const raw = value[0] === '#' ? value.slice(1) : value;
    const full = raw.length === 3
      ? raw.split('').map(ch => ch + ch).join('')
      : raw.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return `rgba(255,255,255,${safeAlpha.toFixed(3)})`;
    return `rgba(${r},${g},${b},${safeAlpha.toFixed(3)})`;
  }

  class HybridRenderBackendSystem {
    constructor(game) {
      this.game = game;
      this.config = game.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
      this.overlayCache = new Map();
      this.webglSpriteTextureCache = new Map();
      this.webglTerrainTextureCache = new Map();
      this.webglSpriteCandidates = [];
      this.pendingWebglSceneSpriteCandidates = [];
      this.webglScenePreviewStorageKey = 'dreamRealmsWebglScenePreviewOverlay';
      this.webglScenePreviewOverlayEnabled = safeLocalStorageGet(this.webglScenePreviewStorageKey, this.config.enableWebglVisibleScenePreviewOverlay ? '1' : '0') === '1';
      this.webglSceneTerrainStorageKey = 'dreamRealmsWebglScenePreviewTerrainLayer';
      this.webglSceneSpriteStorageKey = 'dreamRealmsWebglScenePreviewSpriteLayer';
      this.webglSceneGuidesStorageKey = 'dreamRealmsWebglScenePreviewGuides';
      this.webglScenePreviewTerrainEnabled = safeLocalStorageGet(this.webglSceneTerrainStorageKey, this.config.webglScenePreviewTerrainLayerDefault === false ? '0' : '1') === '1';
      this.webglScenePreviewSpriteEnabled = safeLocalStorageGet(this.webglSceneSpriteStorageKey, this.config.webglScenePreviewSpriteLayerDefault === false ? '0' : '1') === '1';
      this.webglScenePreviewGuidesEnabled = safeLocalStorageGet(this.webglSceneGuidesStorageKey, this.config.webglScenePreviewGuidesDefault === false ? '0' : '1') === '1';
      this.webglVisibleTerrainStorageKey = 'dreamRealmsWebglVisibleTerrainLayer';
      this.webglVisibleTerrainEnabled = safeLocalStorageGet(this.webglVisibleTerrainStorageKey, this.config.webglVisibleTerrainLayerDefault ? '1' : '0') === '1';
      this.webglVisibleSpriteStorageKey = 'dreamRealmsWebglVisibleSpriteLayer';
      this.webglVisibleSpriteEnabled = safeLocalStorageGet(this.webglVisibleSpriteStorageKey, this.config.webglVisibleSpriteLayerDefault ? '1' : '0') === '1';
      this.webglVisibleSpriteQueue = [];
      this.webglVisibleSpriteLastQueuedDepth = -Infinity;
      this.webglVisibleSpriteFallbackEntities = [];
      this.webglVisibleEffectStorageKey = 'dreamRealmsWebglVisibleEffectLayer';
      this.webglVisibleEffectEnabled = safeLocalStorageGet(this.webglVisibleEffectStorageKey, this.config.webglVisibleEffectLayerDefault ? '1' : '0') === '1';
      this.webglVisibleEffectQueue = [];
      this.webglEffectSpriteCache = new Map();
      this.webglVisibleDamageTextStorageKey = 'dreamRealmsWebglVisibleDamageTextLayer';
      this.webglVisibleDamageTextEnabled = safeLocalStorageGet(this.webglVisibleDamageTextStorageKey, this.config.webglVisibleDamageTextLayerDefault ? '1' : '0') === '1';
      this.webglVisibleDamageTextQueue = [];
      this.webglDamageTextSpriteCache = new Map();
      this.rendererModeStorageKey = 'dreamRealmsRenderBackendMode';
      const storedRendererMode = safeLocalStorageGet(this.rendererModeStorageKey, this.config.renderBackendMode || 'canvas2d');
      this.rendererMode = this.normalizeRendererMode(storedRendererMode);
      if (storedRendererMode !== this.rendererMode) safeLocalStorageSet(this.rendererModeStorageKey, this.rendererMode);
      this.lastRequestedRendererMode = this.rendererMode;
      this.renderBackendFailureScore = 0;
      this.renderBackendCooldownUntilMs = 0;
      this.renderBackendFailureWindow = [];
      this.frameId = 0;
      this.frameSpriteBatchCount = 0;
      this.frameTerrainBatchCount = 0;
      this.frameWorldBatchCount = 0;
      this.frameObjectBatchCount = 0;
      this.frameEntityBatchCount = 0;
      this.frameEffectBatchCount = 0;
      this.frameDamageBatchCount = 0;
      this.frameBatchOverflow = 0;
      this.frameBatchBuildMs = 0;
      this.frameBatchDrawablePct = 0;
      this.frameOverlayDraws = 0;
      this.frameWebglSpriteCandidates = 0;
      this.frameWebglSpriteEligible = 0;
      this.frameWebglSpriteUploads = 0;
      this.frameWebglSpriteDrawCalls = 0;
      this.frameWebglSpriteQuads = 0;
      this.frameWebglSpriteFallbacks = 0;
      this.frameWebglSpriteUploadMs = 0;
      this.frameWebglSpriteDrawMs = 0;
      this.frameWebglTerrainCandidates = 0;
      this.frameWebglTerrainUploads = 0;
      this.frameWebglTerrainDrawCalls = 0;
      this.frameWebglTerrainQuads = 0;
      this.frameWebglTerrainFallbacks = 0;
      this.frameWebglTerrainUploadMs = 0;
      this.frameWebglTerrainDrawMs = 0;
      this.frameWebglScenePreviewDrawCalls = 0;
      this.frameWebglScenePreviewQuads = 0;
      this.frameWebglScenePreviewTerrainQuads = 0;
      this.frameWebglScenePreviewSpriteQuads = 0;
      this.frameWebglScenePreviewDrawMs = 0;
      this.frameWebglScenePreviewCompositeMs = 0;
      this.frameWebglScenePreviewComposites = 0;
      this.frameWebglVisibleTerrainDrawCalls = 0;
      this.frameWebglVisibleTerrainQuads = 0;
      this.frameWebglVisibleTerrainDrawMs = 0;
      this.frameWebglVisibleTerrainCompositeMs = 0;
      this.frameWebglVisibleTerrainFallbacks = 0;
      this.frameWebglVisibleTerrainComposites = 0;
      this.frameWebglVisibleSpriteCandidates = 0;
      this.frameWebglVisibleSpriteQueued = 0;
      this.frameWebglVisibleSpriteDrawCalls = 0;
      this.frameWebglVisibleSpriteQuads = 0;
      this.frameWebglVisibleSpriteDrawMs = 0;
      this.frameWebglVisibleSpriteCompositeMs = 0;
      this.frameWebglVisibleSpriteFallbacks = 0;
      this.frameWebglVisibleSpriteComposites = 0;
      this.frameWebglVisibleSpriteFlushes = 0;
      this.frameWebglVisibleSpriteCanvasFallbackDraws = 0;
      this.frameWebglVisibleSpriteDepthGroups = 0;
      this.frameWebglVisibleSpriteDepthOrderFallbacks = 0;
      this.frameWebglVisibleEffectCandidates = 0;
      this.frameWebglVisibleEffectQueued = 0;
      this.frameWebglVisibleEffectDrawCalls = 0;
      this.frameWebglVisibleEffectQuads = 0;
      this.frameWebglVisibleEffectDrawMs = 0;
      this.frameWebglVisibleEffectCompositeMs = 0;
      this.frameWebglVisibleEffectComposites = 0;
      this.frameWebglVisibleEffectFlushes = 0;
      this.frameWebglVisibleEffectFallbacks = 0;
      this.frameWebglVisibleEffectCanvasFallbackDraws = 0;
      this.frameWebglVisibleEffectCacheHits = 0;
      this.frameWebglVisibleEffectCacheMisses = 0;
      this.frameWebglVisibleEffectCacheEvictions = 0;
      this.frameWebglVisibleDamageTextCandidates = 0;
      this.frameWebglVisibleDamageTextQueued = 0;
      this.frameWebglVisibleDamageTextDrawCalls = 0;
      this.frameWebglVisibleDamageTextQuads = 0;
      this.frameWebglVisibleDamageTextDrawMs = 0;
      this.frameWebglVisibleDamageTextCompositeMs = 0;
      this.frameWebglVisibleDamageTextComposites = 0;
      this.frameWebglVisibleDamageTextFlushes = 0;
      this.frameWebglVisibleDamageTextFallbacks = 0;
      this.frameWebglVisibleDamageTextCanvasFallbackDraws = 0;
      this.frameWebglVisibleDamageTextCacheHits = 0;
      this.frameWebglVisibleDamageTextCacheMisses = 0;
      this.frameWebglVisibleDamageTextCacheEvictions = 0;
      this.frameWebglTerrainSeamBleedPx = 0;
      this.frameWebglTerrainPartialFallbacks = 0;
      this.frameHybridVisibleFlushes = 0;
      this.frameHybridVisibleLayerSwitches = 0;
      this.frameHybridVisibleCanvasFallbackDraws = 0;
      this.frameHybridVisibleFallbacks = 0;
      this.frameHybridVisibleBoundaryFlushes = 0;
      this.frameHybridVisibleFrameMs = 0;
      this.frameHybridVisiblePromotedLayerMask = '';
      this.frameHybridVisibleLastFlushReason = '';
      this.hybridVisibleFrameStartMs = nowMs();
      this.hybridVisibleCurrentLayer = 'none';
      this.frameHybridVisibleFlushes = 0;
      this.frameHybridVisibleLayerSwitches = 0;
      this.frameHybridVisibleCanvasFallbackDraws = 0;
      this.frameHybridVisibleFallbacks = 0;
      this.frameHybridVisibleBoundaryFlushes = 0;
      this.frameHybridVisibleFrameMs = 0;
      this.frameHybridVisiblePromotedLayerMask = '';
      this.frameHybridVisibleLastFlushReason = '';
      this.hybridVisibleFrameStartMs = 0;
      this.hybridVisibleCurrentLayer = 'none';
      this.hybridAuditLastFrame = -999999;
      this.hybridAuditLastYaw = Number(this.game?.camera?.yaw || 0) || 0;
      this.hybridAuditLastZoom = Number(this.game?.camera?.zoom || 1) || 1;
      this.hybridAuditState = 'pending';
      this.frameHybridAuditRoundTripSamples = 0;
      this.frameHybridAuditRoundTripMaxTiles = 0;
      this.frameHybridAuditRoundTripAvgTiles = 0;
      this.frameHybridAuditSpriteOriginSamples = 0;
      this.frameHybridAuditSpriteOriginMaxPx = 0;
      this.frameHybridAuditSpriteOriginAvgPx = 0;
      this.frameHybridAuditDepthViolations = 0;
      this.frameHybridAuditCameraYawDeltaDeg = 0;
      this.frameHybridAuditCameraZoomDelta = 0;
      this.frameHybridAuditPromotionBlocked = false;
      this.frameHybridAuditLastReason = '';
      this.metrics = {
        activeBackend: 'canvas2d',
        webglPrototypeReady: false,
        webglContextLost: false,
        webglMaxTextureSize: 0,
        webglRenderer: '',
        rendererMode: this.rendererMode,
        webglSpritePrototypeEnabled: false,
        webglSpriteProgramReady: false,
        webglSpriteShadowDraw: true,
        webglSpriteCandidates: 0,
        webglSpriteEligible: 0,
        webglSpriteTextureEntries: 0,
        webglSpriteTextureUploads: 0,
        webglSpriteTextureEvictions: 0,
        webglSpriteUploadMs: 0,
        webglSpriteDrawCalls: 0,
        webglSpriteQuads: 0,
        webglSpriteDrawMs: 0,
        webglSpriteFallbacks: 0,
        webglSpriteLastError: '',
        webglTerrainPrototypeEnabled: false,
        webglTerrainProgramReady: false,
        webglTerrainShadowDraw: true,
        webglTerrainCandidates: 0,
        webglTerrainTextureEntries: 0,
        webglTerrainTextureUploads: 0,
        webglTerrainTextureEvictions: 0,
        webglTerrainUploadMs: 0,
        webglTerrainDrawCalls: 0,
        webglTerrainQuads: 0,
        webglTerrainDrawMs: 0,
        webglTerrainFallbacks: 0,
        webglTerrainLastError: '',
        webglScenePreviewEnabled: false,
        webglScenePreviewOverlayEnabled: this.webglScenePreviewOverlayEnabled,
        webglScenePreviewTerrainLayerEnabled: this.webglScenePreviewTerrainEnabled,
        webglScenePreviewSpriteLayerEnabled: this.webglScenePreviewSpriteEnabled,
        webglScenePreviewGuidesEnabled: this.webglScenePreviewGuidesEnabled,
        webglScenePreviewReady: false,
        webglScenePreviewDrawCalls: 0,
        webglScenePreviewQuads: 0,
        webglScenePreviewTerrainQuads: 0,
        webglScenePreviewSpriteQuads: 0,
        webglScenePreviewDrawMs: 0,
        webglScenePreviewCompositeMs: 0,
        webglScenePreviewComposites: 0,
        webglScenePreviewLastError: '',
        webglScenePreviewAlignmentScore: 0,
        webglScenePreviewCoveragePct: 0,
        webglScenePreviewFallbackPressure: 0,
        webglScenePreviewPromotionReady: false,
        webglScenePreviewReadiness: 'inactive',
        webglScenePreviewRecommendation: 'Enable Hybrid WebGL Prototype and scene preview overlay to validate alignment.',
        webglVisibleTerrainLayerEnabled: this.webglVisibleTerrainEnabled,
        webglVisibleTerrainLayerActive: false,
        webglVisibleTerrainLayerPromotedThisFrame: false,
        webglVisibleTerrainDrawCalls: 0,
        webglVisibleTerrainQuads: 0,
        webglVisibleTerrainDrawMs: 0,
        webglVisibleTerrainCompositeMs: 0,
        webglVisibleTerrainComposites: 0,
        webglVisibleTerrainFallbacks: 0,
        webglVisibleTerrainLastError: '',
        webglVisibleSpriteLayerEnabled: this.webglVisibleSpriteEnabled,
        webglVisibleSpriteLayerActive: false,
        webglVisibleSpriteLayerPromotedThisFrame: false,
        webglVisibleSpriteCandidates: 0,
        webglVisibleSpriteQueued: 0,
        webglVisibleSpriteDrawCalls: 0,
        webglVisibleSpriteQuads: 0,
        webglVisibleSpriteDrawMs: 0,
        webglVisibleSpriteCompositeMs: 0,
        webglVisibleSpriteComposites: 0,
        webglVisibleSpriteFlushes: 0,
        webglVisibleSpriteFallbacks: 0,
        webglVisibleSpriteLastError: '',
        webglVisibleSpriteCanvasFallbackDraws: 0,
        webglVisibleSpriteDepthGroups: 0,
        webglVisibleSpriteDepthOrderFallbacks: 0,
        webglVisibleEffectLayerEnabled: this.webglVisibleEffectEnabled,
        webglVisibleEffectLayerActive: false,
        webglVisibleEffectLayerPromotedThisFrame: false,
        webglVisibleEffectCandidates: 0,
        webglVisibleEffectQueued: 0,
        webglVisibleEffectDrawCalls: 0,
        webglVisibleEffectQuads: 0,
        webglVisibleEffectDrawMs: 0,
        webglVisibleEffectCompositeMs: 0,
        webglVisibleEffectComposites: 0,
        webglVisibleEffectFlushes: 0,
        webglVisibleEffectFallbacks: 0,
        webglVisibleEffectCanvasFallbackDraws: 0,
        webglVisibleEffectCacheEntries: 0,
        webglVisibleEffectCacheHits: 0,
        webglVisibleEffectCacheMisses: 0,
        webglVisibleEffectCacheEvictions: 0,
        webglVisibleEffectLastError: '',
        webglVisibleDamageTextLayerEnabled: this.webglVisibleDamageTextEnabled,
        webglVisibleDamageTextLayerActive: false,
        webglVisibleDamageTextLayerPromotedThisFrame: false,
        webglVisibleDamageTextCandidates: 0,
        webglVisibleDamageTextQueued: 0,
        webglVisibleDamageTextDrawCalls: 0,
        webglVisibleDamageTextQuads: 0,
        webglVisibleDamageTextDrawMs: 0,
        webglVisibleDamageTextCompositeMs: 0,
        webglVisibleDamageTextComposites: 0,
        webglVisibleDamageTextFlushes: 0,
        webglVisibleDamageTextFallbacks: 0,
        webglVisibleDamageTextCanvasFallbackDraws: 0,
        webglVisibleDamageTextCacheEntries: 0,
        webglVisibleDamageTextCacheHits: 0,
        webglVisibleDamageTextCacheMisses: 0,
        webglVisibleDamageTextCacheEvictions: 0,
        webglVisibleDamageTextLastError: '',
        webglTerrainSeamBleedPx: 0,
        webglTerrainPartialFallbacks: 0,
        overlayCacheEntries: 0,
        overlayCacheHits: 0,
        overlayCacheMisses: 0,
        overlayCacheEvictions: 0,
        overlayCacheDraws: 0,
        overlayCacheBuildMs: 0,
        frameOverlayDraws: 0,
        spriteBatchPrepared: 0,
        terrainBatchPrepared: 0,
        worldBatchPrepared: 0,
        objectBatchPrepared: 0,
        entityBatchPrepared: 0,
        effectBatchPrepared: 0,
        damageBatchPrepared: 0,
        backendBatchOverflow: 0,
        backendBatchBuildMs: 0,
        backendBatchFrames: 0,
        backendBatchDrawablePct: 0,
        frames: 0,
        renderBackendWatchdogEnabled: false,
        renderBackendAutoFallbacks: 0,
        renderBackendWatchdogTrips: 0,
        renderBackendFailureScore: 0,
        renderBackendCooldownRemainingMs: 0,
        renderBackendLastFallbackReason: '',
        renderBackendLastModeRequest: this.rendererMode,
        renderBackendModeDenied: false,
        renderBackendModeDeniedReason: '',
        renderBackendSafeMode: this.rendererMode === 'canvas2d',
        hybridVisibleFrameConsolidation: true,
        hybridVisibleFlushes: 0,
        hybridVisibleLayerSwitches: 0,
        hybridVisibleCanvasFallbackDraws: 0,
        hybridVisibleFallbacks: 0,
        hybridVisibleBoundaryFlushes: 0,
        hybridVisibleFrameMs: 0,
        hybridVisiblePromotedLayerMask: '',
        hybridVisibleLastFlushReason: '',
        hybridCameraDepthAuditEnabled: true,
        hybridCameraDepthAuditState: 'pending',
        hybridCameraDepthAuditSamples: 0,
        hybridCameraRoundTripMaxTiles: 0,
        hybridCameraRoundTripAvgTiles: 0,
        hybridSpriteOriginSamples: 0,
        hybridSpriteOriginMaxPx: 0,
        hybridSpriteOriginAvgPx: 0,
        hybridDepthOrderViolations: 0,
        hybridCameraYawDeltaDeg: 0,
        hybridCameraZoomDelta: 0,
        hybridPromotionBlockedByAudit: false,
        hybridCameraDepthAuditLastReason: ''
      };
      this.batchScratch = [];
      this.initWebglPrototype();
    }

    refreshConfig() {
      this.config = this.game.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || this.config || {};
      return this.config;
    }

    initWebglPrototype() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglPrototypeBackend === false) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const gl = canvas.getContext('webgl2', {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        }) || canvas.getContext('webgl', {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        }) || canvas.getContext('experimental-webgl');
        if (!gl) return;
        this.webglPrototypeCanvas = canvas;
        this.webglPrototypeContext = gl;
        this.metrics.webglPrototypeReady = true;
        this.metrics.webglMaxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
        try {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          if (ext) this.metrics.webglRenderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').slice(0, 80);
        } catch (_err) {}
        canvas.addEventListener?.('webglcontextlost', () => {
          this.metrics.webglContextLost = true;
          this.metrics.webglPrototypeReady = false;
        });
        canvas.addEventListener?.('webglcontextrestored', () => {
          this.metrics.webglContextLost = false;
          this.batchScratch = [];
      this.initWebglPrototype();
        });
      } catch (_err) {
        this.metrics.webglPrototypeReady = false;
      }
    }

    beginFrame() {
      this.frameId = (this.frameId + 1) >>> 0;
      this.frameSpriteBatchCount = 0;
      this.frameTerrainBatchCount = 0;
      this.frameWorldBatchCount = 0;
      this.frameObjectBatchCount = 0;
      this.frameEntityBatchCount = 0;
      this.frameEffectBatchCount = 0;
      this.frameDamageBatchCount = 0;
      this.frameBatchOverflow = 0;
      this.frameBatchBuildMs = 0;
      this.frameBatchDrawablePct = 0;
      this.frameOverlayDraws = 0;
      this.frameWebglSpriteCandidates = 0;
      this.frameWebglSpriteEligible = 0;
      this.frameWebglSpriteUploads = 0;
      this.frameWebglSpriteDrawCalls = 0;
      this.frameWebglSpriteQuads = 0;
      this.frameWebglSpriteFallbacks = 0;
      this.frameWebglSpriteUploadMs = 0;
      this.frameWebglSpriteDrawMs = 0;
      this.frameWebglTerrainCandidates = 0;
      this.frameWebglTerrainUploads = 0;
      this.frameWebglTerrainDrawCalls = 0;
      this.frameWebglTerrainQuads = 0;
      this.frameWebglTerrainFallbacks = 0;
      this.frameWebglTerrainUploadMs = 0;
      this.frameWebglTerrainDrawMs = 0;
      this.frameWebglScenePreviewDrawCalls = 0;
      this.frameWebglScenePreviewQuads = 0;
      this.frameWebglScenePreviewTerrainQuads = 0;
      this.frameWebglScenePreviewSpriteQuads = 0;
      this.frameWebglScenePreviewDrawMs = 0;
      this.frameWebglScenePreviewCompositeMs = 0;
      this.frameWebglScenePreviewComposites = 0;
      this.frameWebglVisibleTerrainDrawCalls = 0;
      this.frameWebglVisibleTerrainQuads = 0;
      this.frameWebglVisibleTerrainDrawMs = 0;
      this.frameWebglVisibleTerrainCompositeMs = 0;
      this.frameWebglVisibleTerrainFallbacks = 0;
      this.frameWebglVisibleTerrainComposites = 0;
      this.frameWebglVisibleSpriteCandidates = 0;
      this.frameWebglVisibleSpriteQueued = 0;
      this.frameWebglVisibleSpriteDrawCalls = 0;
      this.frameWebglVisibleSpriteQuads = 0;
      this.frameWebglVisibleSpriteDrawMs = 0;
      this.frameWebglVisibleSpriteCompositeMs = 0;
      this.frameWebglVisibleSpriteFallbacks = 0;
      this.frameWebglVisibleSpriteComposites = 0;
      this.frameWebglVisibleSpriteFlushes = 0;
      this.frameWebglVisibleSpriteCanvasFallbackDraws = 0;
      this.frameWebglVisibleSpriteDepthGroups = 0;
      this.frameWebglVisibleSpriteDepthOrderFallbacks = 0;
      this.frameWebglVisibleEffectCandidates = 0;
      this.frameWebglVisibleEffectQueued = 0;
      this.frameWebglVisibleEffectDrawCalls = 0;
      this.frameWebglVisibleEffectQuads = 0;
      this.frameWebglVisibleEffectDrawMs = 0;
      this.frameWebglVisibleEffectCompositeMs = 0;
      this.frameWebglVisibleEffectComposites = 0;
      this.frameWebglVisibleEffectFlushes = 0;
      this.frameWebglVisibleEffectFallbacks = 0;
      this.frameWebglVisibleEffectCanvasFallbackDraws = 0;
      this.frameWebglVisibleEffectCacheHits = 0;
      this.frameWebglVisibleEffectCacheMisses = 0;
      this.frameWebglVisibleEffectCacheEvictions = 0;
      this.frameWebglVisibleDamageTextCandidates = 0;
      this.frameWebglVisibleDamageTextQueued = 0;
      this.frameWebglVisibleDamageTextDrawCalls = 0;
      this.frameWebglVisibleDamageTextQuads = 0;
      this.frameWebglVisibleDamageTextDrawMs = 0;
      this.frameWebglVisibleDamageTextCompositeMs = 0;
      this.frameWebglVisibleDamageTextComposites = 0;
      this.frameWebglVisibleDamageTextFlushes = 0;
      this.frameWebglVisibleDamageTextFallbacks = 0;
      this.frameWebglVisibleDamageTextCanvasFallbackDraws = 0;
      this.frameWebglVisibleDamageTextCacheHits = 0;
      this.frameWebglVisibleDamageTextCacheMisses = 0;
      this.frameWebglVisibleDamageTextCacheEvictions = 0;
      this.frameWebglTerrainSeamBleedPx = 0;
      this.frameWebglTerrainPartialFallbacks = 0;
      this.frameHybridVisibleFlushes = 0;
      this.frameHybridVisibleLayerSwitches = 0;
      this.frameHybridVisibleCanvasFallbackDraws = 0;
      this.frameHybridVisibleFallbacks = 0;
      this.frameHybridVisibleBoundaryFlushes = 0;
      this.frameHybridVisibleFrameMs = 0;
      this.frameHybridVisiblePromotedLayerMask = '';
      this.frameHybridVisibleLastFlushReason = '';
      this.hybridVisibleFrameStartMs = 0;
      this.hybridVisibleCurrentLayer = 'none';
      this.frameHybridAuditRoundTripSamples = 0;
      this.frameHybridAuditRoundTripMaxTiles = 0;
      this.frameHybridAuditRoundTripAvgTiles = 0;
      this.frameHybridAuditSpriteOriginSamples = 0;
      this.frameHybridAuditSpriteOriginMaxPx = 0;
      this.frameHybridAuditSpriteOriginAvgPx = 0;
      this.frameHybridAuditDepthViolations = 0;
      this.frameHybridAuditCameraYawDeltaDeg = 0;
      this.frameHybridAuditCameraZoomDelta = 0;
      this.frameHybridAuditPromotionBlocked = false;
      this.frameHybridAuditLastReason = '';
      this.webglVisibleSpriteLastQueuedDepth = -Infinity;
      if (this.webglVisibleSpriteFallbackEntities) this.webglVisibleSpriteFallbackEntities.length = 0;
      this.metrics.webglVisibleTerrainLayerPromotedThisFrame = false;
      this.metrics.webglVisibleSpriteLayerPromotedThisFrame = false;
      this.metrics.webglVisibleEffectLayerPromotedThisFrame = false;
      this.metrics.webglVisibleDamageTextLayerPromotedThisFrame = false;
      if (this.webglVisibleEffectQueue) this.webglVisibleEffectQueue.length = 0;
      if (this.webglSpriteCandidates) this.webglSpriteCandidates.length = 0;
      if (this.pendingWebglSceneSpriteCandidates) this.pendingWebglSceneSpriteCandidates.length = 0;
      if (this.webglVisibleSpriteQueue) this.webglVisibleSpriteQueue.length = 0;
      this.metrics.frames += 1;
    }

    endFrame() {
      this.metrics.frameOverlayDraws = this.frameOverlayDraws;
      this.metrics.spriteBatchPrepared = this.frameSpriteBatchCount;
      this.metrics.terrainBatchPrepared = this.frameTerrainBatchCount;
      this.metrics.worldBatchPrepared = this.frameWorldBatchCount;
      this.metrics.objectBatchPrepared = this.frameObjectBatchCount;
      this.metrics.entityBatchPrepared = this.frameEntityBatchCount;
      this.metrics.effectBatchPrepared = this.frameEffectBatchCount;
      this.metrics.damageBatchPrepared = this.frameDamageBatchCount;
      this.metrics.backendBatchOverflow = this.frameBatchOverflow;
      this.metrics.backendBatchBuildMs = this.frameBatchBuildMs;
      this.metrics.backendBatchDrawablePct = this.frameBatchDrawablePct;
      this.metrics.overlayCacheEntries = this.overlayCache.size;
      this.metrics.rendererMode = this.rendererMode || 'canvas2d';
      this.metrics.webglSpritePrototypeEnabled = this.webglSpritePrototypeActive();
      this.metrics.webglSpriteShadowDraw = this.refreshConfig().webglSpritePrototypeShadowDraw !== false;
      this.metrics.webglSpriteCandidates = this.frameWebglSpriteCandidates || 0;
      this.metrics.webglSpriteEligible = this.frameWebglSpriteEligible || 0;
      this.metrics.webglSpriteTextureEntries = this.webglSpriteTextureCache?.size || 0;
      this.metrics.webglSpriteTextureUploads = this.frameWebglSpriteUploads || 0;
      this.metrics.webglSpriteUploadMs = this.frameWebglSpriteUploadMs || 0;
      this.metrics.webglSpriteDrawCalls = this.frameWebglSpriteDrawCalls || 0;
      this.metrics.webglSpriteQuads = this.frameWebglSpriteQuads || 0;
      this.metrics.webglSpriteDrawMs = this.frameWebglSpriteDrawMs || 0;
      this.metrics.webglSpriteFallbacks = this.frameWebglSpriteFallbacks || 0;
      this.metrics.webglTerrainPrototypeEnabled = this.webglTerrainPrototypeActive();
      this.metrics.webglTerrainShadowDraw = this.refreshConfig().webglTerrainPrototypeShadowDraw !== false;
      this.metrics.webglTerrainCandidates = this.frameWebglTerrainCandidates || 0;
      this.metrics.webglTerrainTextureEntries = this.webglTerrainTextureCache?.size || 0;
      this.metrics.webglTerrainTextureUploads = this.frameWebglTerrainUploads || 0;
      this.metrics.webglTerrainUploadMs = this.frameWebglTerrainUploadMs || 0;
      this.metrics.webglTerrainDrawCalls = this.frameWebglTerrainDrawCalls || 0;
      this.metrics.webglTerrainQuads = this.frameWebglTerrainQuads || 0;
      this.metrics.webglTerrainDrawMs = this.frameWebglTerrainDrawMs || 0;
      this.metrics.webglTerrainFallbacks = this.frameWebglTerrainFallbacks || 0;
      this.metrics.webglScenePreviewEnabled = this.webglScenePreviewActive?.() || false;
      this.metrics.webglScenePreviewOverlayEnabled = !!this.webglScenePreviewOverlayEnabled;
      this.metrics.webglScenePreviewReady = !!(this.webglPrototypeContext && this.webglPrototypeCanvas && this.metrics.webglPrototypeReady);
      this.metrics.webglScenePreviewDrawCalls = this.frameWebglScenePreviewDrawCalls || 0;
      this.metrics.webglScenePreviewQuads = this.frameWebglScenePreviewQuads || 0;
      this.metrics.webglScenePreviewTerrainQuads = this.frameWebglScenePreviewTerrainQuads || 0;
      this.metrics.webglScenePreviewSpriteQuads = this.frameWebglScenePreviewSpriteQuads || 0;
      this.metrics.webglScenePreviewDrawMs = this.frameWebglScenePreviewDrawMs || 0;
      this.metrics.webglScenePreviewCompositeMs = this.frameWebglScenePreviewCompositeMs || 0;
      this.metrics.webglScenePreviewComposites = this.frameWebglScenePreviewComposites || 0;
      this.metrics.webglScenePreviewTerrainLayerEnabled = !!this.webglScenePreviewTerrainEnabled;
      this.metrics.webglScenePreviewSpriteLayerEnabled = !!this.webglScenePreviewSpriteEnabled;
      this.metrics.webglScenePreviewGuidesEnabled = !!this.webglScenePreviewGuidesEnabled;
      this.metrics.webglVisibleTerrainLayerEnabled = !!this.webglVisibleTerrainEnabled;
      this.metrics.webglVisibleTerrainLayerActive = this.webglVisibleTerrainLayerActive?.() || false;
      this.metrics.webglVisibleTerrainDrawCalls = this.frameWebglVisibleTerrainDrawCalls || 0;
      this.metrics.webglVisibleTerrainQuads = this.frameWebglVisibleTerrainQuads || 0;
      this.metrics.webglVisibleTerrainDrawMs = this.frameWebglVisibleTerrainDrawMs || 0;
      this.metrics.webglVisibleTerrainCompositeMs = this.frameWebglVisibleTerrainCompositeMs || 0;
      this.metrics.webglVisibleTerrainComposites = this.frameWebglVisibleTerrainComposites || 0;
      this.metrics.webglVisibleTerrainFallbacks = this.frameWebglVisibleTerrainFallbacks || 0;
      this.metrics.webglVisibleSpriteLayerEnabled = !!this.webglVisibleSpriteEnabled;
      this.metrics.webglVisibleSpriteLayerActive = this.webglVisibleSpriteLayerActive?.() || false;
      this.metrics.webglVisibleSpriteCandidates = this.frameWebglVisibleSpriteCandidates || 0;
      this.metrics.webglVisibleSpriteQueued = this.frameWebglVisibleSpriteQueued || 0;
      this.metrics.webglVisibleSpriteDrawCalls = this.frameWebglVisibleSpriteDrawCalls || 0;
      this.metrics.webglVisibleSpriteQuads = this.frameWebglVisibleSpriteQuads || 0;
      this.metrics.webglVisibleSpriteDrawMs = this.frameWebglVisibleSpriteDrawMs || 0;
      this.metrics.webglVisibleSpriteCompositeMs = this.frameWebglVisibleSpriteCompositeMs || 0;
      this.metrics.webglVisibleSpriteComposites = this.frameWebglVisibleSpriteComposites || 0;
      this.metrics.webglVisibleSpriteFlushes = this.frameWebglVisibleSpriteFlushes || 0;
      this.metrics.webglVisibleSpriteCanvasFallbackDraws = this.frameWebglVisibleSpriteCanvasFallbackDraws || 0;
      this.metrics.webglVisibleSpriteDepthGroups = this.frameWebglVisibleSpriteDepthGroups || 0;
      this.metrics.webglVisibleSpriteDepthOrderFallbacks = this.frameWebglVisibleSpriteDepthOrderFallbacks || 0;
      this.metrics.webglVisibleSpriteFallbacks = this.frameWebglVisibleSpriteFallbacks || 0;
      this.metrics.webglVisibleEffectLayerEnabled = !!this.webglVisibleEffectEnabled;
      this.metrics.webglVisibleEffectLayerActive = this.webglVisibleEffectLayerActive?.() || false;
      this.metrics.webglVisibleEffectCandidates = this.frameWebglVisibleEffectCandidates || 0;
      this.metrics.webglVisibleEffectQueued = this.frameWebglVisibleEffectQueued || 0;
      this.metrics.webglVisibleEffectDrawCalls = this.frameWebglVisibleEffectDrawCalls || 0;
      this.metrics.webglVisibleEffectQuads = this.frameWebglVisibleEffectQuads || 0;
      this.metrics.webglVisibleEffectDrawMs = this.frameWebglVisibleEffectDrawMs || 0;
      this.metrics.webglVisibleEffectCompositeMs = this.frameWebglVisibleEffectCompositeMs || 0;
      this.metrics.webglVisibleEffectComposites = this.frameWebglVisibleEffectComposites || 0;
      this.metrics.webglVisibleEffectFlushes = this.frameWebglVisibleEffectFlushes || 0;
      this.metrics.webglVisibleEffectFallbacks = this.frameWebglVisibleEffectFallbacks || 0;
      this.metrics.webglVisibleEffectCanvasFallbackDraws = this.frameWebglVisibleEffectCanvasFallbackDraws || 0;
      this.metrics.webglVisibleEffectCacheEntries = this.webglEffectSpriteCache?.size || 0;
      this.metrics.webglVisibleEffectCacheHits = this.frameWebglVisibleEffectCacheHits || 0;
      this.metrics.webglVisibleEffectCacheMisses = this.frameWebglVisibleEffectCacheMisses || 0;
      this.metrics.webglVisibleEffectCacheEvictions = this.frameWebglVisibleEffectCacheEvictions || 0;
      this.metrics.webglVisibleDamageTextLayerEnabled = !!this.webglVisibleDamageTextEnabled;
      this.metrics.webglVisibleDamageTextLayerActive = this.webglVisibleDamageTextLayerActive?.() || false;
      this.metrics.webglVisibleDamageTextCandidates = this.frameWebglVisibleDamageTextCandidates || 0;
      this.metrics.webglVisibleDamageTextQueued = this.frameWebglVisibleDamageTextQueued || 0;
      this.metrics.webglVisibleDamageTextDrawCalls = this.frameWebglVisibleDamageTextDrawCalls || 0;
      this.metrics.webglVisibleDamageTextQuads = this.frameWebglVisibleDamageTextQuads || 0;
      this.metrics.webglVisibleDamageTextDrawMs = this.frameWebglVisibleDamageTextDrawMs || 0;
      this.metrics.webglVisibleDamageTextCompositeMs = this.frameWebglVisibleDamageTextCompositeMs || 0;
      this.metrics.webglVisibleDamageTextComposites = this.frameWebglVisibleDamageTextComposites || 0;
      this.metrics.webglVisibleDamageTextFlushes = this.frameWebglVisibleDamageTextFlushes || 0;
      this.metrics.webglVisibleDamageTextFallbacks = this.frameWebglVisibleDamageTextFallbacks || 0;
      this.metrics.webglVisibleDamageTextCanvasFallbackDraws = this.frameWebglVisibleDamageTextCanvasFallbackDraws || 0;
      this.metrics.webglVisibleDamageTextCacheEntries = this.webglDamageTextSpriteCache?.size || 0;
      this.metrics.webglVisibleDamageTextCacheHits = this.frameWebglVisibleDamageTextCacheHits || 0;
      this.metrics.webglVisibleDamageTextCacheMisses = this.frameWebglVisibleDamageTextCacheMisses || 0;
      this.metrics.webglVisibleDamageTextCacheEvictions = this.frameWebglVisibleDamageTextCacheEvictions || 0;
      this.metrics.webglTerrainSeamBleedPx = this.frameWebglTerrainSeamBleedPx || 0;
      this.metrics.webglTerrainPartialFallbacks = this.frameWebglTerrainPartialFallbacks || 0;
      this.metrics.hybridVisibleFrameConsolidation = this.refreshConfig().enableHybridVisibleFrameConsolidation !== false;
      this.metrics.hybridVisibleFlushes = this.frameHybridVisibleFlushes || 0;
      this.metrics.hybridVisibleLayerSwitches = this.frameHybridVisibleLayerSwitches || 0;
      this.metrics.hybridVisibleCanvasFallbackDraws = this.frameHybridVisibleCanvasFallbackDraws || 0;
      this.metrics.hybridVisibleFallbacks = this.frameHybridVisibleFallbacks || 0;
      this.metrics.hybridVisibleBoundaryFlushes = this.frameHybridVisibleBoundaryFlushes || 0;
      this.metrics.hybridVisibleFrameMs = this.frameHybridVisibleFrameMs || (this.hybridVisibleFrameStartMs ? Math.max(0, nowMs() - this.hybridVisibleFrameStartMs) : 0);
      this.metrics.hybridVisiblePromotedLayerMask = this.frameHybridVisiblePromotedLayerMask || this.promotedVisibleLayerMask?.() || '';
      this.metrics.hybridVisibleLastFlushReason = this.frameHybridVisibleLastFlushReason || '';
      this.metrics.hybridCameraDepthAuditEnabled = this.refreshConfig().enableHybridCameraDepthAudit !== false;
      this.metrics.hybridCameraDepthAuditState = this.hybridAuditState || 'pending';
      this.metrics.hybridCameraDepthAuditSamples = this.frameHybridAuditRoundTripSamples || this.metrics.hybridCameraDepthAuditSamples || 0;
      this.metrics.hybridCameraRoundTripMaxTiles = this.frameHybridAuditRoundTripMaxTiles || this.metrics.hybridCameraRoundTripMaxTiles || 0;
      this.metrics.hybridCameraRoundTripAvgTiles = this.frameHybridAuditRoundTripAvgTiles || this.metrics.hybridCameraRoundTripAvgTiles || 0;
      this.metrics.hybridSpriteOriginSamples = this.frameHybridAuditSpriteOriginSamples || this.metrics.hybridSpriteOriginSamples || 0;
      this.metrics.hybridSpriteOriginMaxPx = this.frameHybridAuditSpriteOriginMaxPx || this.metrics.hybridSpriteOriginMaxPx || 0;
      this.metrics.hybridSpriteOriginAvgPx = this.frameHybridAuditSpriteOriginAvgPx || this.metrics.hybridSpriteOriginAvgPx || 0;
      this.metrics.hybridDepthOrderViolations = this.frameHybridAuditDepthViolations || this.metrics.hybridDepthOrderViolations || 0;
      this.metrics.hybridCameraYawDeltaDeg = this.frameHybridAuditCameraYawDeltaDeg || this.metrics.hybridCameraYawDeltaDeg || 0;
      this.metrics.hybridCameraZoomDelta = this.frameHybridAuditCameraZoomDelta || this.metrics.hybridCameraZoomDelta || 0;
      this.metrics.hybridPromotionBlockedByAudit = !!(this.frameHybridAuditPromotionBlocked || this.metrics.hybridPromotionBlockedByAudit);
      this.metrics.hybridCameraDepthAuditLastReason = this.frameHybridAuditLastReason || this.metrics.hybridCameraDepthAuditLastReason || '';
      this.metrics.webglVisibleSpriteLastError = this.metrics.webglVisibleSpriteLastError || '';
      this.updateScenePreviewAlignmentMetrics?.();
      this.updateRenderBackendWatchdog?.();
      this.metrics.activeBackend = this.activeBackendLabel?.() || (this.isHybridRendererMode?.() ? 'canvas2d+webgl-prototypes' : 'canvas2d');
      this.metrics.renderBackendSafeMode = !this.isHybridRendererMode?.();
      this.syncPerfStats();
    }

    syncPerfStats() {
      const perf = this.game.perfStats;
      if (!perf) return;
      perf.renderBackendActive = this.metrics.activeBackend;
      perf.renderBackendWebglPrototypeReady = !!this.metrics.webglPrototypeReady;
      perf.renderBackendWebglContextLost = !!this.metrics.webglContextLost;
      perf.renderBackendWebglMaxTextureSize = this.metrics.webglMaxTextureSize || 0;
      perf.renderBackendWebglRenderer = this.metrics.webglRenderer || '';
      perf.overlayCacheEntries = this.metrics.overlayCacheEntries || 0;
      perf.overlayCacheHits = this.metrics.overlayCacheHits || 0;
      perf.overlayCacheMisses = this.metrics.overlayCacheMisses || 0;
      perf.overlayCacheEvictions = this.metrics.overlayCacheEvictions || 0;
      perf.overlayCacheDraws = this.metrics.overlayCacheDraws || 0;
      perf.overlayCacheBuildMs = this.metrics.overlayCacheBuildMs || 0;
      perf.overlayFrameDraws = this.metrics.frameOverlayDraws || 0;
      perf.renderBackendSpriteBatchPrepared = this.metrics.spriteBatchPrepared || 0;
      perf.renderBackendTerrainBatchPrepared = this.metrics.terrainBatchPrepared || 0;
      perf.renderBackendWorldBatchPrepared = this.metrics.worldBatchPrepared || 0;
      perf.renderBackendObjectBatchPrepared = this.metrics.objectBatchPrepared || 0;
      perf.renderBackendEntityBatchPrepared = this.metrics.entityBatchPrepared || 0;
      perf.renderBackendEffectBatchPrepared = this.metrics.effectBatchPrepared || 0;
      perf.renderBackendDamageBatchPrepared = this.metrics.damageBatchPrepared || 0;
      perf.renderBackendBatchOverflow = this.metrics.backendBatchOverflow || 0;
      perf.renderBackendBatchBuildMs = this.metrics.backendBatchBuildMs || 0;
      perf.renderBackendBatchFrames = this.metrics.backendBatchFrames || 0;
      perf.renderBackendBatchDrawablePct = this.metrics.backendBatchDrawablePct || 0;
      perf.renderBackendRendererMode = this.metrics.rendererMode || 'canvas2d';
      perf.renderBackendWatchdogEnabled = !!this.metrics.renderBackendWatchdogEnabled;
      perf.renderBackendAutoFallbacks = this.metrics.renderBackendAutoFallbacks || 0;
      perf.renderBackendWatchdogTrips = this.metrics.renderBackendWatchdogTrips || 0;
      perf.renderBackendFailureScore = this.metrics.renderBackendFailureScore || 0;
      perf.renderBackendCooldownRemainingMs = this.metrics.renderBackendCooldownRemainingMs || 0;
      perf.renderBackendLastFallbackReason = this.metrics.renderBackendLastFallbackReason || '';
      perf.renderBackendLastModeRequest = this.metrics.renderBackendLastModeRequest || this.rendererMode || 'canvas2d';
      perf.renderBackendModeDenied = !!this.metrics.renderBackendModeDenied;
      perf.renderBackendModeDeniedReason = this.metrics.renderBackendModeDeniedReason || '';
      perf.renderBackendSafeMode = !!this.metrics.renderBackendSafeMode;
      perf.renderBackendWebglSpritePrototypeEnabled = !!this.metrics.webglSpritePrototypeEnabled;
      perf.renderBackendWebglSpriteProgramReady = !!this.metrics.webglSpriteProgramReady;
      perf.renderBackendWebglSpriteShadowDraw = this.metrics.webglSpriteShadowDraw !== false;
      perf.renderBackendWebglSpriteCandidates = this.metrics.webglSpriteCandidates || 0;
      perf.renderBackendWebglSpriteEligible = this.metrics.webglSpriteEligible || 0;
      perf.renderBackendWebglSpriteTextureEntries = this.metrics.webglSpriteTextureEntries || 0;
      perf.renderBackendWebglSpriteTextureUploads = this.metrics.webglSpriteTextureUploads || 0;
      perf.renderBackendWebglSpriteTextureEvictions = this.metrics.webglSpriteTextureEvictions || 0;
      perf.renderBackendWebglSpriteUploadMs = this.metrics.webglSpriteUploadMs || 0;
      perf.renderBackendWebglSpriteDrawCalls = this.metrics.webglSpriteDrawCalls || 0;
      perf.renderBackendWebglSpriteQuads = this.metrics.webglSpriteQuads || 0;
      perf.renderBackendWebglSpriteDrawMs = this.metrics.webglSpriteDrawMs || 0;
      perf.renderBackendWebglSpriteFallbacks = this.metrics.webglSpriteFallbacks || 0;
      perf.renderBackendWebglSpriteLastError = this.metrics.webglSpriteLastError || '';
      perf.renderBackendWebglTerrainPrototypeEnabled = !!this.metrics.webglTerrainPrototypeEnabled;
      perf.renderBackendWebglTerrainProgramReady = !!this.metrics.webglTerrainProgramReady;
      perf.renderBackendWebglTerrainShadowDraw = this.metrics.webglTerrainShadowDraw !== false;
      perf.renderBackendWebglTerrainCandidates = this.metrics.webglTerrainCandidates || 0;
      perf.renderBackendWebglTerrainTextureEntries = this.metrics.webglTerrainTextureEntries || 0;
      perf.renderBackendWebglTerrainTextureUploads = this.metrics.webglTerrainTextureUploads || 0;
      perf.renderBackendWebglTerrainTextureEvictions = this.metrics.webglTerrainTextureEvictions || 0;
      perf.renderBackendWebglTerrainUploadMs = this.metrics.webglTerrainUploadMs || 0;
      perf.renderBackendWebglTerrainDrawCalls = this.metrics.webglTerrainDrawCalls || 0;
      perf.renderBackendWebglTerrainQuads = this.metrics.webglTerrainQuads || 0;
      perf.renderBackendWebglTerrainDrawMs = this.metrics.webglTerrainDrawMs || 0;
      perf.renderBackendWebglTerrainFallbacks = this.metrics.webglTerrainFallbacks || 0;
      perf.renderBackendWebglTerrainLastError = this.metrics.webglTerrainLastError || '';
      perf.renderBackendWebglScenePreviewEnabled = !!this.metrics.webglScenePreviewEnabled;
      perf.renderBackendWebglScenePreviewOverlayEnabled = !!this.metrics.webglScenePreviewOverlayEnabled;
      perf.renderBackendWebglScenePreviewTerrainLayerEnabled = !!this.metrics.webglScenePreviewTerrainLayerEnabled;
      perf.renderBackendWebglScenePreviewSpriteLayerEnabled = !!this.metrics.webglScenePreviewSpriteLayerEnabled;
      perf.renderBackendWebglScenePreviewGuidesEnabled = !!this.metrics.webglScenePreviewGuidesEnabled;
      perf.renderBackendWebglScenePreviewReady = !!this.metrics.webglScenePreviewReady;
      perf.renderBackendWebglScenePreviewDrawCalls = this.metrics.webglScenePreviewDrawCalls || 0;
      perf.renderBackendWebglScenePreviewQuads = this.metrics.webglScenePreviewQuads || 0;
      perf.renderBackendWebglScenePreviewTerrainQuads = this.metrics.webglScenePreviewTerrainQuads || 0;
      perf.renderBackendWebglScenePreviewSpriteQuads = this.metrics.webglScenePreviewSpriteQuads || 0;
      perf.renderBackendWebglScenePreviewDrawMs = this.metrics.webglScenePreviewDrawMs || 0;
      perf.renderBackendWebglScenePreviewCompositeMs = this.metrics.webglScenePreviewCompositeMs || 0;
      perf.renderBackendWebglScenePreviewComposites = this.metrics.webglScenePreviewComposites || 0;
      perf.renderBackendWebglScenePreviewLastError = this.metrics.webglScenePreviewLastError || '';
      perf.renderBackendWebglScenePreviewAlignmentScore = this.metrics.webglScenePreviewAlignmentScore || 0;
      perf.renderBackendWebglScenePreviewCoveragePct = this.metrics.webglScenePreviewCoveragePct || 0;
      perf.renderBackendWebglScenePreviewFallbackPressure = this.metrics.webglScenePreviewFallbackPressure || 0;
      perf.renderBackendWebglScenePreviewPromotionReady = !!this.metrics.webglScenePreviewPromotionReady;
      perf.renderBackendWebglScenePreviewReadiness = this.metrics.webglScenePreviewReadiness || 'inactive';
      perf.renderBackendWebglScenePreviewRecommendation = this.metrics.webglScenePreviewRecommendation || '';
      perf.renderBackendWebglVisibleTerrainLayerEnabled = !!this.metrics.webglVisibleTerrainLayerEnabled;
      perf.renderBackendWebglVisibleTerrainLayerActive = !!this.metrics.webglVisibleTerrainLayerActive;
      perf.renderBackendWebglVisibleTerrainLayerPromotedThisFrame = !!this.metrics.webglVisibleTerrainLayerPromotedThisFrame;
      perf.renderBackendWebglVisibleTerrainDrawCalls = this.metrics.webglVisibleTerrainDrawCalls || 0;
      perf.renderBackendWebglVisibleTerrainQuads = this.metrics.webglVisibleTerrainQuads || 0;
      perf.renderBackendWebglVisibleTerrainDrawMs = this.metrics.webglVisibleTerrainDrawMs || 0;
      perf.renderBackendWebglVisibleTerrainCompositeMs = this.metrics.webglVisibleTerrainCompositeMs || 0;
      perf.renderBackendWebglVisibleTerrainComposites = this.metrics.webglVisibleTerrainComposites || 0;
      perf.renderBackendWebglVisibleTerrainFallbacks = this.metrics.webglVisibleTerrainFallbacks || 0;
      perf.renderBackendWebglVisibleTerrainLastError = this.metrics.webglVisibleTerrainLastError || '';
      perf.renderBackendWebglVisibleSpriteLayerEnabled = !!this.metrics.webglVisibleSpriteLayerEnabled;
      perf.renderBackendWebglVisibleSpriteLayerActive = !!this.metrics.webglVisibleSpriteLayerActive;
      perf.renderBackendWebglVisibleSpriteLayerPromotedThisFrame = !!this.metrics.webglVisibleSpriteLayerPromotedThisFrame;
      perf.renderBackendWebglVisibleSpriteCandidates = this.metrics.webglVisibleSpriteCandidates || 0;
      perf.renderBackendWebglVisibleSpriteQueued = this.metrics.webglVisibleSpriteQueued || 0;
      perf.renderBackendWebglVisibleSpriteDrawCalls = this.metrics.webglVisibleSpriteDrawCalls || 0;
      perf.renderBackendWebglVisibleSpriteQuads = this.metrics.webglVisibleSpriteQuads || 0;
      perf.renderBackendWebglVisibleSpriteDrawMs = this.metrics.webglVisibleSpriteDrawMs || 0;
      perf.renderBackendWebglVisibleSpriteCompositeMs = this.metrics.webglVisibleSpriteCompositeMs || 0;
      perf.renderBackendWebglVisibleSpriteComposites = this.metrics.webglVisibleSpriteComposites || 0;
      perf.renderBackendWebglVisibleSpriteFlushes = this.metrics.webglVisibleSpriteFlushes || 0;
      perf.renderBackendWebglVisibleSpriteCanvasFallbackDraws = this.metrics.webglVisibleSpriteCanvasFallbackDraws || 0;
      perf.renderBackendWebglVisibleSpriteDepthGroups = this.metrics.webglVisibleSpriteDepthGroups || 0;
      perf.renderBackendWebglVisibleSpriteDepthOrderFallbacks = this.metrics.webglVisibleSpriteDepthOrderFallbacks || 0;
      perf.renderBackendWebglVisibleSpriteFallbacks = this.metrics.webglVisibleSpriteFallbacks || 0;
      perf.renderBackendWebglVisibleEffectLayerEnabled = !!this.metrics.webglVisibleEffectLayerEnabled;
      perf.renderBackendWebglVisibleEffectLayerActive = !!this.metrics.webglVisibleEffectLayerActive;
      perf.renderBackendWebglVisibleEffectLayerPromotedThisFrame = !!this.metrics.webglVisibleEffectLayerPromotedThisFrame;
      perf.renderBackendWebglVisibleEffectCandidates = this.metrics.webglVisibleEffectCandidates || 0;
      perf.renderBackendWebglVisibleEffectQueued = this.metrics.webglVisibleEffectQueued || 0;
      perf.renderBackendWebglVisibleEffectDrawCalls = this.metrics.webglVisibleEffectDrawCalls || 0;
      perf.renderBackendWebglVisibleEffectQuads = this.metrics.webglVisibleEffectQuads || 0;
      perf.renderBackendWebglVisibleEffectDrawMs = this.metrics.webglVisibleEffectDrawMs || 0;
      perf.renderBackendWebglVisibleEffectCompositeMs = this.metrics.webglVisibleEffectCompositeMs || 0;
      perf.renderBackendWebglVisibleEffectComposites = this.metrics.webglVisibleEffectComposites || 0;
      perf.renderBackendWebglVisibleEffectFlushes = this.metrics.webglVisibleEffectFlushes || 0;
      perf.renderBackendWebglVisibleEffectFallbacks = this.metrics.webglVisibleEffectFallbacks || 0;
      perf.renderBackendWebglVisibleEffectCanvasFallbackDraws = this.metrics.webglVisibleEffectCanvasFallbackDraws || 0;
      perf.renderBackendWebglVisibleEffectCacheEntries = this.metrics.webglVisibleEffectCacheEntries || 0;
      perf.renderBackendWebglVisibleEffectCacheHits = this.metrics.webglVisibleEffectCacheHits || 0;
      perf.renderBackendWebglVisibleEffectCacheMisses = this.metrics.webglVisibleEffectCacheMisses || 0;
      perf.renderBackendWebglVisibleEffectCacheEvictions = this.metrics.webglVisibleEffectCacheEvictions || 0;
      perf.renderBackendWebglVisibleEffectLastError = this.metrics.webglVisibleEffectLastError || '';
      perf.renderBackendWebglVisibleDamageTextLayerEnabled = !!this.metrics.webglVisibleDamageTextLayerEnabled;
      perf.renderBackendWebglVisibleDamageTextLayerActive = !!this.metrics.webglVisibleDamageTextLayerActive;
      perf.renderBackendWebglVisibleDamageTextLayerPromotedThisFrame = !!this.metrics.webglVisibleDamageTextLayerPromotedThisFrame;
      perf.renderBackendWebglVisibleDamageTextCandidates = this.metrics.webglVisibleDamageTextCandidates || 0;
      perf.renderBackendWebglVisibleDamageTextQueued = this.metrics.webglVisibleDamageTextQueued || 0;
      perf.renderBackendWebglVisibleDamageTextDrawCalls = this.metrics.webglVisibleDamageTextDrawCalls || 0;
      perf.renderBackendWebglVisibleDamageTextQuads = this.metrics.webglVisibleDamageTextQuads || 0;
      perf.renderBackendWebglVisibleDamageTextDrawMs = this.metrics.webglVisibleDamageTextDrawMs || 0;
      perf.renderBackendWebglVisibleDamageTextCompositeMs = this.metrics.webglVisibleDamageTextCompositeMs || 0;
      perf.renderBackendWebglVisibleDamageTextComposites = this.metrics.webglVisibleDamageTextComposites || 0;
      perf.renderBackendWebglVisibleDamageTextFlushes = this.metrics.webglVisibleDamageTextFlushes || 0;
      perf.renderBackendWebglVisibleDamageTextFallbacks = this.metrics.webglVisibleDamageTextFallbacks || 0;
      perf.renderBackendWebglVisibleDamageTextCanvasFallbackDraws = this.metrics.webglVisibleDamageTextCanvasFallbackDraws || 0;
      perf.renderBackendWebglVisibleDamageTextCacheEntries = this.metrics.webglVisibleDamageTextCacheEntries || 0;
      perf.renderBackendWebglVisibleDamageTextCacheHits = this.metrics.webglVisibleDamageTextCacheHits || 0;
      perf.renderBackendWebglVisibleDamageTextCacheMisses = this.metrics.webglVisibleDamageTextCacheMisses || 0;
      perf.renderBackendWebglVisibleDamageTextCacheEvictions = this.metrics.webglVisibleDamageTextCacheEvictions || 0;
      perf.renderBackendWebglVisibleDamageTextLastError = this.metrics.webglVisibleDamageTextLastError || '';
      perf.renderBackendWebglTerrainSeamBleedPx = this.metrics.webglTerrainSeamBleedPx || 0;
      perf.renderBackendWebglTerrainPartialFallbacks = this.metrics.webglTerrainPartialFallbacks || 0;
      perf.renderBackendHybridVisibleFrameConsolidation = !!this.metrics.hybridVisibleFrameConsolidation;
      perf.renderBackendHybridVisibleFlushes = this.metrics.hybridVisibleFlushes || 0;
      perf.renderBackendHybridVisibleLayerSwitches = this.metrics.hybridVisibleLayerSwitches || 0;
      perf.renderBackendHybridVisibleCanvasFallbackDraws = this.metrics.hybridVisibleCanvasFallbackDraws || 0;
      perf.renderBackendHybridVisibleFallbacks = this.metrics.hybridVisibleFallbacks || 0;
      perf.renderBackendHybridVisibleBoundaryFlushes = this.metrics.hybridVisibleBoundaryFlushes || 0;
      perf.renderBackendHybridVisibleFrameMs = this.metrics.hybridVisibleFrameMs || 0;
      perf.renderBackendHybridVisiblePromotedLayerMask = this.metrics.hybridVisiblePromotedLayerMask || '';
      perf.renderBackendHybridVisibleLastFlushReason = this.metrics.hybridVisibleLastFlushReason || '';
      perf.renderBackendHybridCameraDepthAuditEnabled = !!this.metrics.hybridCameraDepthAuditEnabled;
      perf.renderBackendHybridCameraDepthAuditState = this.metrics.hybridCameraDepthAuditState || 'pending';
      perf.renderBackendHybridCameraDepthAuditSamples = this.metrics.hybridCameraDepthAuditSamples || 0;
      perf.renderBackendHybridCameraRoundTripMaxTiles = this.metrics.hybridCameraRoundTripMaxTiles || 0;
      perf.renderBackendHybridCameraRoundTripAvgTiles = this.metrics.hybridCameraRoundTripAvgTiles || 0;
      perf.renderBackendHybridSpriteOriginSamples = this.metrics.hybridSpriteOriginSamples || 0;
      perf.renderBackendHybridSpriteOriginMaxPx = this.metrics.hybridSpriteOriginMaxPx || 0;
      perf.renderBackendHybridSpriteOriginAvgPx = this.metrics.hybridSpriteOriginAvgPx || 0;
      perf.renderBackendHybridDepthOrderViolations = this.metrics.hybridDepthOrderViolations || 0;
      perf.renderBackendHybridCameraYawDeltaDeg = this.metrics.hybridCameraYawDeltaDeg || 0;
      perf.renderBackendHybridCameraZoomDelta = this.metrics.hybridCameraZoomDelta || 0;
      perf.renderBackendHybridPromotionBlockedByAudit = !!this.metrics.hybridPromotionBlockedByAudit;
      perf.renderBackendHybridCameraDepthAuditLastReason = this.metrics.hybridCameraDepthAuditLastReason || '';
      perf.renderBackendWebglVisibleSpriteLastError = this.metrics.webglVisibleSpriteLastError || '';
    }


    updateHybridCameraDepthAudit(payload = {}) {
      const cfg = this.refreshConfig();
      this.metrics.hybridCameraDepthAuditEnabled = cfg.enableHybridCameraDepthAudit !== false;
      if (cfg.enableHybridCameraDepthAudit === false) {
        this.hybridAuditState = 'disabled';
        this.metrics.hybridCameraDepthAuditState = 'disabled';
        this.metrics.hybridPromotionBlockedByAudit = false;
        return true;
      }
      const frame = Number(this.frameId || 0) || 0;
      const interval = Math.max(1, Math.floor(Number(cfg.hybridCameraAuditIntervalFrames || 12) || 12));
      if (frame - Number(this.hybridAuditLastFrame || -999999) < interval && this.metrics.hybridCameraDepthAuditState && this.metrics.hybridCameraDepthAuditState !== 'pending') {
        this.frameHybridAuditPromotionBlocked = !!this.metrics.hybridPromotionBlockedByAudit;
        this.frameHybridAuditLastReason = this.metrics.hybridCameraDepthAuditLastReason || '';
        return !this.frameHybridAuditPromotionBlocked;
      }
      this.hybridAuditLastFrame = frame;
      const game = this.game;
      let state = 'ok';
      const reasons = [];
      const player = game?.player || { x: game?.camera?.x || 0, y: game?.camera?.y || 0 };
      const radius = Math.max(1, Number(cfg.hybridCameraAuditSampleRadius || 6) || 6);
      const samples = [
        { x: player.x || 0, y: player.y || 0 },
        { x: (player.x || 0) + radius, y: player.y || 0 },
        { x: (player.x || 0) - radius, y: player.y || 0 },
        { x: player.x || 0, y: (player.y || 0) + radius },
        { x: player.x || 0, y: (player.y || 0) - radius },
        { x: (player.x || 0) + radius * 0.65, y: (player.y || 0) + radius * 0.65 },
        { x: (player.x || 0) - radius * 0.65, y: (player.y || 0) - radius * 0.65 }
      ];
      let rtMax = 0;
      let rtSum = 0;
      let rtSamples = 0;
      if (typeof game?.worldToScreen === 'function' && typeof game?.screenToWorld === 'function') {
        for (const sample of samples) {
          try {
            const screen = game.worldToScreen(sample.x, sample.y, 0);
            const world = game.screenToWorld(screen.x, screen.y, { z: 0 });
            if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue;
            const err = distance2d(sample.x, sample.y, world.x, world.y);
            rtMax = Math.max(rtMax, err);
            rtSum += err;
            rtSamples += 1;
          } catch (_err) {}
        }
      }
      const rtAvg = rtSamples ? rtSum / rtSamples : 0;
      const rtWarn = Math.max(0.001, Number(cfg.hybridCameraRoundTripWarnTiles || 0.045) || 0.045);
      const rtBlock = Math.max(rtWarn, Number(cfg.hybridCameraRoundTripBlockTiles || 0.12) || 0.12);
      if (rtMax > rtWarn) { state = 'warn'; reasons.push(`roundtrip ${rtMax.toFixed(3)}t`); }
      if (rtMax > rtBlock) { state = 'blocked'; reasons.push(`roundtrip-block ${rtMax.toFixed(3)}t`); }

      const world = Array.isArray(payload.worldRenderables) ? payload.worldRenderables : [];
      const eps = Math.max(0.000001, Number(cfg.webglVisibleSpriteDepthEpsilon || 0.0005) || 0.0005);
      let lastDepth = -Infinity;
      let depthViolations = 0;
      for (let i = 0; i < world.length; i++) {
        const d = Number(world[i]?.depth);
        if (!Number.isFinite(d)) continue;
        if (d + eps < lastDepth) depthViolations += 1;
        if (d > lastDepth) lastDepth = d;
      }
      const depthWarn = Math.max(0, Math.floor(Number(cfg.hybridDepthOrderWarnCount ?? 1) || 0));
      const depthBlock = Math.max(depthWarn, Math.floor(Number(cfg.hybridDepthOrderBlockCount ?? 4) || 4));
      if (depthViolations > depthWarn) { state = state === 'ok' ? 'warn' : state; reasons.push(`depth ${depthViolations}`); }
      if (depthViolations > depthBlock) { state = 'blocked'; reasons.push(`depth-block ${depthViolations}`); }

      let originMax = 0;
      let originSum = 0;
      let originSamples = 0;
      const maxOriginSamples = Math.min(world.length, 48);
      for (let i = 0; i < world.length && originSamples < maxOriginSamples; i++) {
        const r = world[i];
        if (r?.kind !== 'entity' || !r.entity) continue;
        const actor = r.entity;
        const sx = Number(actor.screenX);
        const sy = Number(actor.screenY);
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
        try {
          const tile = game?.tileAt?.(actor.x, actor.y) || game?.map?.[Math.floor(actor.y)]?.[Math.floor(actor.x)] || null;
          const elev = Number(tile?.elev) || 0;
          const projected = game?.worldToScreen?.(actor.x, actor.y, elev + (Number(actor.z) || 0));
          if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;
          const drift = distance2d(sx, sy, projected.x, projected.y);
          originMax = Math.max(originMax, drift);
          originSum += drift;
          originSamples += 1;
        } catch (_err) {}
      }
      const originAvg = originSamples ? originSum / originSamples : 0;
      const originWarn = Math.max(1, Number(cfg.hybridSpriteOriginWarnPx || 18) || 18);
      const originBlock = Math.max(originWarn, Number(cfg.hybridSpriteOriginBlockPx || 42) || 42);
      if (originMax > originWarn) { state = state === 'ok' ? 'warn' : state; reasons.push(`origin ${Math.round(originMax)}px`); }
      if (originMax > originBlock) { state = 'blocked'; reasons.push(`origin-block ${Math.round(originMax)}px`); }

      const yaw = Number(game?.camera?.yaw || 0) || 0;
      const zoom = Number(game?.camera?.zoom || 1) || 1;
      const yawDeltaDeg = Math.abs(angleDeltaRad(yaw, this.hybridAuditLastYaw)) * 180 / Math.PI;
      const zoomDelta = Math.abs(zoom - Number(this.hybridAuditLastZoom || zoom));
      this.hybridAuditLastYaw = yaw;
      this.hybridAuditLastZoom = zoom;
      const yawWarn = Math.max(0, Number(cfg.hybridAuditCameraChangeYawWarnDeg || 12) || 12);
      const zoomWarn = Math.max(0, Number(cfg.hybridAuditCameraChangeZoomWarn || 0.10) || 0.10);
      if (yawDeltaDeg > yawWarn || zoomDelta > zoomWarn) {
        if (state === 'ok') state = 'tracking';
        reasons.push(`camera Δ${yawDeltaDeg.toFixed(1)}°/${zoomDelta.toFixed(2)}z`);
      }

      const blocked = cfg.hybridPromotionBlockedByAudit !== false && state === 'blocked';
      this.hybridAuditState = state;
      this.frameHybridAuditRoundTripSamples = rtSamples;
      this.frameHybridAuditRoundTripMaxTiles = rtMax;
      this.frameHybridAuditRoundTripAvgTiles = rtAvg;
      this.frameHybridAuditSpriteOriginSamples = originSamples;
      this.frameHybridAuditSpriteOriginMaxPx = originMax;
      this.frameHybridAuditSpriteOriginAvgPx = originAvg;
      this.frameHybridAuditDepthViolations = depthViolations;
      this.frameHybridAuditCameraYawDeltaDeg = yawDeltaDeg;
      this.frameHybridAuditCameraZoomDelta = zoomDelta;
      this.frameHybridAuditPromotionBlocked = blocked;
      this.frameHybridAuditLastReason = reasons.join(', ') || 'ok';
      this.metrics.hybridCameraDepthAuditState = state;
      this.metrics.hybridCameraDepthAuditSamples = rtSamples;
      this.metrics.hybridCameraRoundTripMaxTiles = rtMax;
      this.metrics.hybridCameraRoundTripAvgTiles = rtAvg;
      this.metrics.hybridSpriteOriginSamples = originSamples;
      this.metrics.hybridSpriteOriginMaxPx = originMax;
      this.metrics.hybridSpriteOriginAvgPx = originAvg;
      this.metrics.hybridDepthOrderViolations = depthViolations;
      this.metrics.hybridCameraYawDeltaDeg = yawDeltaDeg;
      this.metrics.hybridCameraZoomDelta = zoomDelta;
      this.metrics.hybridPromotionBlockedByAudit = blocked;
      this.metrics.hybridCameraDepthAuditLastReason = this.frameHybridAuditLastReason;
      return !blocked;
    }

    hybridPromotionBlockedByAudit(layer = 'visible') {
      const cfg = this.refreshConfig();
      if (cfg.enableHybridCameraDepthAudit === false || cfg.hybridPromotionBlockedByAudit === false) return false;
      if (this.metrics.hybridPromotionBlockedByAudit === true || this.hybridAuditState === 'blocked') {
        const msg = `audit-block:${layer}:${this.metrics.hybridCameraDepthAuditLastReason || 'blocked'}`;
        if (layer === 'terrain') this.metrics.webglVisibleTerrainLastError = msg;
        else if (layer === 'sprite') this.metrics.webglVisibleSpriteLastError = msg;
        else if (layer === 'effect') this.metrics.webglVisibleEffectLastError = msg;
        else if (layer === 'damage') this.metrics.webglVisibleDamageTextLastError = msg;
        return true;
      }
      return false;
    }


    normalizeRendererMode(mode) {
      const raw = String(mode || '').toLowerCase().trim();
      if (raw === 'hybrid-webgl-prototype' || raw === 'hybrid-webgl' || raw === 'webgl' || raw === 'hybrid') return 'hybrid-webgl-prototype';
      return 'canvas2d';
    }

    rendererModeLabel(mode = this.rendererMode) {
      const normalized = this.normalizeRendererMode(mode);
      if (normalized === 'hybrid-webgl-prototype') return 'Hybrid WebGL Prototype';
      return 'Canvas 2D Stable';
    }

    isHybridRendererMode(mode = this.rendererMode) {
      return this.normalizeRendererMode(mode) === 'hybrid-webgl-prototype';
    }

    backendCooldownRemainingMs() {
      const remaining = Math.max(0, Number(this.renderBackendCooldownUntilMs || 0) - nowMs());
      this.metrics.renderBackendCooldownRemainingMs = Math.ceil(remaining);
      return remaining;
    }

    canEnterHybridMode(options = {}) {
      if (options.force === true) return true;
      const cfg = this.refreshConfig();
      if (cfg.enableHybridRenderBackend === false || cfg.enableWebglPrototypeBackend === false) {
        this.metrics.renderBackendModeDeniedReason = 'hybrid backend disabled';
        return false;
      }
      if (this.metrics.webglContextLost) {
        this.metrics.renderBackendModeDeniedReason = 'WebGL context lost';
        return false;
      }
      if (!this.metrics.webglPrototypeReady || !this.webglPrototypeContext) {
        this.initWebglPrototype?.();
        if (!this.metrics.webglPrototypeReady || !this.webglPrototypeContext) {
          this.metrics.renderBackendModeDeniedReason = 'WebGL unavailable';
          return false;
        }
      }
      const cooldown = this.backendCooldownRemainingMs();
      if (cooldown > 0) {
        this.metrics.renderBackendModeDeniedReason = `cooldown ${Math.ceil(cooldown / 1000)}s`;
        return false;
      }
      this.metrics.renderBackendModeDeniedReason = '';
      return true;
    }

    setRendererMode(mode, reason = 'manual', options = {}) {
      const next = this.normalizeRendererMode(mode);
      this.lastRequestedRendererMode = next;
      this.metrics.renderBackendLastModeRequest = next;
      this.metrics.renderBackendModeDenied = false;
      this.metrics.renderBackendModeDeniedReason = '';
      if (next === 'hybrid-webgl-prototype' && !this.canEnterHybridMode(options)) {
        this.metrics.renderBackendModeDenied = true;
        this.metrics.rendererMode = this.rendererMode;
        this.metrics.lastRendererModeChangeReason = `${reason}:denied`;
        return false;
      }
      if (next === this.rendererMode) return false;
      this.rendererMode = next;
      this.metrics.rendererMode = next;
      safeLocalStorageSet(this.rendererModeStorageKey, next);
      this.metrics.activeBackend = this.isHybridRendererMode(next) ? 'canvas2d+webgl-prototypes' : 'canvas2d';
      this.metrics.lastRendererModeChangeReason = reason;
      return true;
    }

    toggleRendererMode() {
      const next = this.isHybridRendererMode() ? 'canvas2d' : 'hybrid-webgl-prototype';
      this.setRendererMode(next, 'toggle');
      return this.rendererMode;
    }

    webglSpritePrototypeActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglSpriteBatchPrototype === false) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      return !!this.webglPrototypeContext;
    }

    webglTerrainPrototypeActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglTerrainBatchPrototype === false) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      return !!this.webglPrototypeContext;
    }

    updateRenderBackendWatchdog() {
      const cfg = this.refreshConfig();
      const enabled = cfg.enableRenderBackendWatchdog !== false;
      this.metrics.renderBackendWatchdogEnabled = !!enabled;
      this.backendCooldownRemainingMs();
      if (!enabled || !this.isHybridRendererMode()) {
        this.renderBackendFailureScore = Math.max(0, Math.floor(Number(this.renderBackendFailureScore || 0) * 0.92));
        this.metrics.renderBackendFailureScore = this.renderBackendFailureScore;
        return false;
      }
      const maxFallbacks = Math.max(0, Math.floor(Number(cfg.renderBackendMaxFallbacksPerFrame || 36) || 36));
      const maxUploadMs = Math.max(1, Number(cfg.renderBackendMaxFrameUploadMs || 7) || 7);
      const maxDrawMs = Math.max(1, Number(cfg.renderBackendMaxFrameDrawMs || 7) || 7);
      const fallbacks = (this.frameWebglSpriteFallbacks || 0) + (this.frameWebglTerrainFallbacks || 0) + (this.frameWebglVisibleSpriteFallbacks || 0) + (this.frameWebglVisibleEffectFallbacks || 0) + (this.frameWebglVisibleDamageTextFallbacks || 0);
      const uploadMs = (this.frameWebglSpriteUploadMs || 0) + (this.frameWebglTerrainUploadMs || 0);
      const drawMs = (this.frameWebglSpriteDrawMs || 0) + (this.frameWebglTerrainDrawMs || 0) + (this.frameWebglScenePreviewDrawMs || 0) + (this.frameWebglScenePreviewCompositeMs || 0) + (this.frameWebglVisibleSpriteDrawMs || 0) + (this.frameWebglVisibleSpriteCompositeMs || 0) + (this.frameWebglVisibleEffectDrawMs || 0) + (this.frameWebglVisibleEffectCompositeMs || 0) + (this.frameWebglVisibleDamageTextDrawMs || 0) + (this.frameWebglVisibleDamageTextCompositeMs || 0);
      let reason = '';
      if (this.metrics.webglContextLost) reason = 'WebGL context lost';
      else if (!this.metrics.webglPrototypeReady) reason = 'WebGL unavailable';
      else if (fallbacks > maxFallbacks) reason = `fallback pressure ${fallbacks}`;
      else if (uploadMs > maxUploadMs) reason = `upload pressure ${uploadMs.toFixed(1)}ms`;
      else if (drawMs > maxDrawMs) reason = `draw pressure ${drawMs.toFixed(1)}ms`;
      if (reason) this.renderBackendFailureScore += 1;
      else this.renderBackendFailureScore = Math.max(0, this.renderBackendFailureScore - 1);
      const tripCount = Math.max(2, Math.floor(Number(cfg.renderBackendFailureTripCount || 8) || 8));
      this.metrics.renderBackendFailureScore = this.renderBackendFailureScore;
      if (reason && this.renderBackendFailureScore >= tripCount && cfg.renderBackendAutoFallback !== false) {
        this.metrics.renderBackendWatchdogTrips += 1;
        this.metrics.renderBackendAutoFallbacks += 1;
        this.metrics.renderBackendLastFallbackReason = reason;
        this.rendererMode = 'canvas2d';
        this.metrics.rendererMode = 'canvas2d';
        this.metrics.activeBackend = 'canvas2d';
        this.metrics.renderBackendSafeMode = true;
        safeLocalStorageSet(this.rendererModeStorageKey, 'canvas2d');
        this.renderBackendFailureScore = 0;
        this.metrics.renderBackendFailureScore = 0;
        this.renderBackendCooldownUntilMs = nowMs() + Math.max(0, Number(cfg.renderBackendCooldownMs || 10000) || 10000);
        this.backendCooldownRemainingMs();
        try { this.game?.logSystem?.(`Renderer backend auto-fallback: ${reason}. Canvas 2D Stable restored.`); } catch (_err) {}
        try { this.game?.renderSettingsPanel?.(); this.game?.markUiDirty?.('renderer watchdog fallback'); } catch (_err) {}
        return true;
      }
      return false;
    }

    initWebglSpritePipeline() {
      const gl = this.webglPrototypeContext;
      if (!gl || this.webglSpriteProgram) return !!this.webglSpriteProgram;
      try {
        const vertexSource = `
          attribute vec2 a_position;
          attribute vec2 a_texcoord;
          varying vec2 v_texcoord;
          void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texcoord = a_texcoord;
          }
        `;
        const fragmentSource = `
          precision mediump float;
          varying vec2 v_texcoord;
          uniform sampler2D u_texture;
          void main() {
            gl_FragColor = texture2D(u_texture, v_texcoord);
          }
        `;
        const program = createProgram(gl, vertexSource, fragmentSource);
        if (!program) return false;
        const vertexBuffer = gl.createBuffer();
        if (!vertexBuffer) return false;
        this.webglSpriteProgram = program;
        this.webglSpriteVertexBuffer = vertexBuffer;
        this.webglSpriteAttribs = {
          position: gl.getAttribLocation(program, 'a_position'),
          texcoord: gl.getAttribLocation(program, 'a_texcoord')
        };
        this.webglSpriteUniforms = { texture: gl.getUniformLocation(program, 'u_texture') };
        gl.useProgram(program);
        gl.uniform1i(this.webglSpriteUniforms.texture, 0);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.metrics.webglSpriteProgramReady = true;
        return true;
      } catch (err) {
        this.metrics.webglSpriteLastError = `pipeline:${err?.message || err}`;
        this.metrics.webglSpriteProgramReady = false;
        return false;
      }
    }

    getSpriteCacheEntry(key) {
      if (!key) return null;
      const cache = this.game?.runtimeSpriteCache;
      const entries = cache?.entries;
      if (!entries || typeof entries.get !== 'function') return null;
      return entries.get(key) || null;
    }

    trimWebglSpriteTextureCache() {
      const cfg = this.refreshConfig();
      const limit = Math.max(32, Math.floor(Number(cfg.webglSpriteTextureCacheMaxEntries || 512) || 512));
      if (!this.webglSpriteTextureCache || this.webglSpriteTextureCache.size <= limit) return;
      const entries = Array.from(this.webglSpriteTextureCache.entries()).sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
      const removeCount = Math.max(0, this.webglSpriteTextureCache.size - limit);
      const gl = this.webglPrototypeContext;
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        const [key, entry] = entries[i];
        try { if (entry.texture && gl) gl.deleteTexture(entry.texture); } catch (_err) {}
        this.webglSpriteTextureCache.delete(key);
        this.metrics.webglSpriteTextureEvictions += 1;
      }
    }

    textureForSpriteEntry(key, entry) {
      const gl = this.webglPrototypeContext;
      if (!gl || !entry?.canvas || !key) return null;
      let texEntry = this.webglSpriteTextureCache.get(key);
      const width = Number(entry.width || entry.canvas.width || 0) || 0;
      const height = Number(entry.height || entry.canvas.height || 0) || 0;
      if (texEntry && texEntry.width === width && texEntry.height === height) {
        texEntry.lastUsed = this.frameId;
        return texEntry;
      }
      const cfg = this.refreshConfig();
      const maxUploads = Math.max(0, Math.floor(Number(cfg.webglSpriteMaxUploadsPerFrame || 24) || 24));
      if (this.frameWebglSpriteUploads >= maxUploads) {
        this.frameWebglSpriteFallbacks += 1;
        return null;
      }
      const start = nowMs();
      try {
        const texture = texEntry?.texture || gl.createTexture();
        if (!texture) return null;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.canvas);
        texEntry = { texture, width, height, lastUsed: this.frameId, uploads: (texEntry?.uploads || 0) + 1 };
        this.webglSpriteTextureCache.set(key, texEntry);
        this.frameWebglSpriteUploads += 1;
        this.frameWebglSpriteUploadMs += nowMs() - start;
        this.trimWebglSpriteTextureCache();
        return texEntry;
      } catch (err) {
        this.metrics.webglSpriteLastError = `upload:${err?.message || err}`;
        this.frameWebglSpriteFallbacks += 1;
        return null;
      }
    }

    collectWebglSpriteCandidates(worldRenderables = [], projection = null) {
      const cfg = this.refreshConfig();
      const maxCandidates = Math.max(32, Math.floor(Number(cfg.webglSpriteMaxCandidates || 512) || 512));
      const candidates = this.webglSpriteCandidates || (this.webglSpriteCandidates = []);
      candidates.length = 0;
      const limit = Math.min(worldRenderables.length, maxCandidates);
      for (let i = 0; i < limit; i++) {
        const r = worldRenderables[i];
        if (!r || r.kind !== 'entity' || !r.entity) continue;
        const actor = r.entity;
        const key = actor._runtimeSpriteCacheKey;
        if (!key) continue;
        const entry = this.getSpriteCacheEntry(key);
        if (!entry?.canvas) continue;
        let screenX = Number(actor.screenX);
        let screenY = Number(actor.screenY);
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
          const tile = this.game?.tileAt?.(actor.x, actor.y) || this.game?.map?.[Math.floor(actor.y)]?.[Math.floor(actor.x)] || null;
          const elev = Number(tile?.elev) || 0;
          const foot = this.game?.worldToScreen?.(actor.x, actor.y, elev + (Number(actor.z) || 0));
          screenX = Number(foot?.x);
          screenY = Number(foot?.y);
        }
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) continue;
        candidates.push({ key, entry, screenX, screenY, scale: Number(actor.visualScale || 1) || 1, depth: Number(r.depth) || 0 });
      }
      this.frameWebglSpriteCandidates = candidates.length;
      return candidates;
    }


    webglScenePreviewActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglVisibleScenePreview === false) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      return !!this.webglPrototypeContext;
    }

    webglVisibleTerrainLayerActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglVisibleTerrainLayer === false) return false;
      if (this.game?.cameraRotationSinglePassTerrainActive?.() === true) {
        this.metrics.webglVisibleTerrainLastError = 'camera-rotation-single-pass';
        return false;
      }
      if (!this.webglVisibleTerrainEnabled) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      if (!this.webglPrototypeContext) return false;
      if (this.hybridPromotionBlockedByAudit?.('terrain')) return false;
      if (cfg.webglVisibleTerrainRequirePromotionReady === true && !this.metrics.webglScenePreviewPromotionReady) return false;
      return true;
    }

    setWebglVisibleTerrainLayer(enabled) {
      this.webglVisibleTerrainEnabled = !!enabled;
      safeLocalStorageSet(this.webglVisibleTerrainStorageKey, this.webglVisibleTerrainEnabled ? '1' : '0');
      this.metrics.webglVisibleTerrainLayerEnabled = this.webglVisibleTerrainEnabled;
      return this.webglVisibleTerrainEnabled;
    }

    toggleWebglVisibleTerrainLayer() {
      return this.setWebglVisibleTerrainLayer(!this.webglVisibleTerrainEnabled);
    }

    webglVisibleSpriteLayerActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglVisibleSpriteLayer === false) return false;
      if (!this.webglVisibleSpriteEnabled) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      if (!this.webglPrototypeContext) return false;
      if (this.hybridPromotionBlockedByAudit?.('sprite')) return false;
      if (cfg.webglVisibleSpriteRequirePromotionReady === true && !this.metrics.webglScenePreviewPromotionReady) return false;
      return true;
    }

    setWebglVisibleSpriteLayer(enabled) {
      this.webglVisibleSpriteEnabled = !!enabled;
      safeLocalStorageSet(this.webglVisibleSpriteStorageKey, this.webglVisibleSpriteEnabled ? '1' : '0');
      this.metrics.webglVisibleSpriteLayerEnabled = this.webglVisibleSpriteEnabled;
      return this.webglVisibleSpriteEnabled;
    }

    toggleWebglVisibleSpriteLayer() {
      return this.setWebglVisibleSpriteLayer(!this.webglVisibleSpriteEnabled);
    }


    webglVisibleEffectLayerActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglVisibleEffectLayer === false) return false;
      if (!this.webglVisibleEffectEnabled) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      if (!this.webglPrototypeContext) return false;
      if (this.hybridPromotionBlockedByAudit?.('effect')) return false;
      if (cfg.webglVisibleEffectRequirePromotionReady === true && !this.metrics.webglScenePreviewPromotionReady) return false;
      return true;
    }

    setWebglVisibleEffectLayer(enabled) {
      this.webglVisibleEffectEnabled = !!enabled;
      safeLocalStorageSet(this.webglVisibleEffectStorageKey, this.webglVisibleEffectEnabled ? '1' : '0');
      this.metrics.webglVisibleEffectLayerEnabled = this.webglVisibleEffectEnabled;
      return this.webglVisibleEffectEnabled;
    }

    toggleWebglVisibleEffectLayer() {
      return this.setWebglVisibleEffectLayer(!this.webglVisibleEffectEnabled);
    }

    effectProgressBucket(effect) {
      const life = Math.max(0.001, Number(effect?.life || 0.35) || 0.35);
      const p = Math.max(0, Math.min(1, Number(effect?.t || 0) / life));
      const buckets = Math.max(2, Math.floor(Number(this.refreshConfig().webglVisibleEffectProgressBuckets || 8) || 8));
      return Math.max(0, Math.min(buckets, Math.floor(p * buckets)));
    }

    effectSpriteCacheKey(effect) {
      if (!effect?.type) return '';
      const type = String(effect.type);
      const eligible = new Set(['ring', 'spark', 'slash', 'castCue', 'combatImpact', 'combatSpark', 'statusPulse']);
      if (!eligible.has(type)) return '';
      const color = String(effect.color || '#ffffff').slice(0, 24);
      const style = String(effect.style || effect.label || '').slice(0, 20);
      const radius = Math.round(Number(effect.radius || effect.size || effect.intensity || 1) * 10) / 10;
      return `effect:${type}:${color}:${style}:${radius}:p${this.effectProgressBucket(effect)}`;
    }

    drawEffectSpriteCanvas(entryContext, effect, size, center) {
      const ctx = entryContext;
      if (!ctx || !effect) return false;
      const life = Math.max(0.001, Number(effect.life || 0.35) || 0.35);
      const p = Math.max(0, Math.min(1, Number(effect.t || 0) / life));
      const fade = Math.max(0, 1 - p);
      const color = effect.color || '#ffffff';
      const cx = center;
      const cy = center;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (effect.type === 'ring') {
        const r = Math.max(9, Number(effect.radius || 18) * (1 + p * 1.8));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (effect.type === 'spark') {
        ctx.fillStyle = color;
        ctx.fillRect(cx - 2, cy - 7, 4, 4);
        ctx.globalAlpha *= 0.45;
        ctx.beginPath(); ctx.arc(cx, cy - 5, 8 + p * 6, 0, Math.PI * 2); ctx.fill();
      } else if (effect.type === 'slash') {
        const dir = Number(effect.fromX) <= Number(effect.x) ? 1 : -1;
        ctx.strokeStyle = color;
        ctx.lineWidth = effect.style === 'claw' ? 2.2 : 3.2;
        ctx.beginPath();
        ctx.arc(cx + dir * 3, cy - 18, effect.style === 'claw' ? 18 : 23, dir > 0 ? -0.9 : Math.PI + 0.9, dir > 0 ? 0.7 : Math.PI - 0.7);
        ctx.stroke();
        if (effect.style === 'claw') {
          ctx.beginPath(); ctx.arc(cx + dir * 6, cy - 13, 13, dir > 0 ? -0.9 : Math.PI + 0.9, dir > 0 ? 0.7 : Math.PI - 0.7); ctx.stroke();
        }
      } else if (effect.type === 'castCue') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy - 8, 14 + p * 20, 6 + p * 8, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = Math.max(0, fade * 0.34);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(cx, cy - 8, 9 + p * 12, 4 + p * 6, 0, 0, Math.PI * 2); ctx.fill();
      } else if (effect.type === 'combatImpact') {
        const v = (12 + p * 18) * (effect.intensity || 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        ctx.moveTo(cx - v, cy - 20); ctx.lineTo(cx + v, cy - 20);
        ctx.moveTo(cx, cy - 20 - v * 0.55); ctx.lineTo(cx, cy - 20 + v * 0.55);
        ctx.stroke();
        ctx.globalAlpha = Math.max(0, fade * 0.22);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy - 20, v * 0.7, 0, Math.PI * 2); ctx.fill();
      } else if (effect.type === 'combatSpark') {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;
        const ang = Math.atan2(Number(effect.vy || 0.3), Number(effect.vx || 0.5));
        const len = 9 + p * 10;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * 3, cy - 10 - Math.sin(ang) * 3); ctx.lineTo(cx + Math.cos(ang) * len, cy - 10 + Math.sin(ang) * len); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy - 10, 2.4, 0, Math.PI * 2); ctx.fill();
      } else if (effect.type === 'statusPulse') {
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        const r = 12 + p * 22;
        ctx.beginPath(); ctx.ellipse(cx, cy - 12, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = Math.max(0, fade * 0.18);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy - 26, r * 0.65, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.restore();
        return false;
      }
      ctx.restore();
      return true;
    }

    effectSpriteEntryFor(effect) {
      const key = this.effectSpriteCacheKey(effect);
      if (!key) return null;
      let cached = this.webglEffectSpriteCache.get(key);
      if (cached?.entry?.canvas) {
        cached.lastUsed = this.frameId;
        this.frameWebglVisibleEffectCacheHits += 1;
        return { key, entry: cached.entry };
      }
      const cfg = this.refreshConfig();
      const size = Math.max(48, Math.min(160, Math.floor(Number(cfg.webglVisibleEffectSpriteSize || 96) || 96)));
      const canvas = createScratchCanvas(size, size, !!cfg.preferOffscreenOverlayCache);
      const ctx = canvas.getContext?.('2d');
      if (!ctx || !this.drawEffectSpriteCanvas(ctx, effect, size, Math.floor(size / 2))) return null;
      const entry = { canvas, width: size, height: size, originX: Math.floor(size / 2), originY: Math.floor(size / 2) };
      this.webglEffectSpriteCache.set(key, { entry, lastUsed: this.frameId });
      this.frameWebglVisibleEffectCacheMisses += 1;
      this.trimWebglEffectSpriteCache();
      return { key, entry };
    }

    trimWebglEffectSpriteCache() {
      const cfg = this.refreshConfig();
      const limit = Math.max(24, Math.floor(Number(cfg.webglVisibleEffectSpriteCacheMaxEntries || 192) || 192));
      if (!this.webglEffectSpriteCache || this.webglEffectSpriteCache.size <= limit) return;
      const entries = Array.from(this.webglEffectSpriteCache.entries()).sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
      const removeCount = Math.max(0, this.webglEffectSpriteCache.size - limit);
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        this.webglEffectSpriteCache.delete(entries[i][0]);
        this.frameWebglVisibleEffectCacheEvictions += 1;
      }
    }

    candidateForEffectRenderable(renderable) {
      if (!renderable || renderable.kind !== 'effect' || !renderable.effect) return null;
      const effect = renderable.effect;
      const sprite = this.effectSpriteEntryFor(effect);
      if (!sprite?.entry?.canvas) return null;
      let x = Number(effect.x);
      let y = Number(effect.y);
      if ((effect.type === 'combatSpark') && Number.isFinite(Number(effect.vx)) && Number.isFinite(Number(effect.vy))) {
        const life = Math.max(0.001, Number(effect.life || 0.35) || 0.35);
        const p = Math.max(0, Math.min(1, Number(effect.t || 0) / life));
        x += (Number(effect.vx) || 0) * p * 8;
        y += (Number(effect.vy) || 0) * p * 8;
      }
      const tile = this.game?.tileAt?.(x, y) || this.game?.map?.[Math.floor(y)]?.[Math.floor(x)] || null;
      const elev = Number(tile?.elev) || 0;
      const screen = this.game?.worldToScreen?.(x, y, elev + 0.05);
      const screenX = Number(screen?.x);
      const screenY = Number(screen?.y);
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
      return { key: sprite.key, entry: sprite.entry, screenX, screenY, scale: 1, depth: Number(renderable.depth) || 0, effect };
    }

    drawQueuedVisibleEffectsWithCanvasFallback(context, queue, reason = 'fallback') {
      const list = queue || this.webglVisibleEffectQueue || [];
      if (!list.length) return 0;
      let drawn = 0;
      if (this.refreshConfig().webglVisibleEffectCanvasFallbackOnGroupFailure === false) return 0;
      for (const cand of list) {
        try {
          if (cand?.effect && typeof this.game?.drawEffect === 'function') {
            this.game.drawEffect(cand.effect);
            drawn += 1;
          }
        } catch (err) {
          this.metrics.webglVisibleEffectLastError = `visible-effect:${reason}:canvas-fallback:${err?.message || err}`;
        }
      }
      this.frameWebglVisibleEffectCanvasFallbackDraws += drawn;
      return drawn;
    }

    queueWebglVisibleEffectRenderable(renderable) {
      if (!this.webglVisibleEffectLayerActive()) return false;
      const cfg = this.refreshConfig();
      const maxQueued = Math.max(1, Math.floor(Number(cfg.webglVisibleEffectMaxQueuedPerFrame || 160) || 160));
      const maxGroup = Math.max(1, Math.floor(Number(cfg.webglVisibleEffectMaxGroupSize || 64) || 64));
      const queue = this.webglVisibleEffectQueue || (this.webglVisibleEffectQueue = []);
      if ((this.frameWebglVisibleEffectQueued || 0) >= maxQueued || queue.length >= maxGroup) {
        this.frameWebglVisibleEffectFallbacks += 1;
        return false;
      }
      this.frameWebglVisibleEffectCandidates += 1;
      const cand = this.candidateForEffectRenderable(renderable);
      if (!cand) {
        this.frameWebglVisibleEffectFallbacks += 1;
        return false;
      }
      const texEntry = this.textureForSpriteEntry(cand.key, cand.entry);
      if (!texEntry?.texture) {
        this.frameWebglVisibleEffectFallbacks += 1;
        return false;
      }
      queue.push(cand);
      this.frameWebglVisibleEffectQueued += 1;
      return true;
    }

    flushWebglVisibleEffectLayer(context) {
      const queue = this.webglVisibleEffectQueue;
      if (!queue || !queue.length) return false;
      if (!context || !this.webglVisibleEffectLayerActive()) {
        this.frameWebglVisibleEffectFallbacks += queue.length;
        this.drawQueuedVisibleEffectsWithCanvasFallback(context, queue, 'inactive');
        queue.length = 0;
        return false;
      }
      if (!this.ensureWebglSceneSurface() || !this.setupWebglQuadAttributes()) {
        this.frameWebglVisibleEffectFallbacks += queue.length;
        this.drawQueuedVisibleEffectsWithCanvasFallback(context, queue, 'surface-not-ready');
        queue.length = 0;
        return false;
      }
      const gl = this.webglPrototypeContext;
      const drawStart = nowMs();
      try {
        gl.viewport(0, 0, this.webglPrototypeCanvas.width, this.webglPrototypeCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const drawn = this.drawWebglSpriteCandidatesToScene(queue);
        this.frameWebglVisibleEffectDrawCalls += drawn;
        this.frameWebglVisibleEffectQuads += drawn;
        this.frameWebglVisibleEffectDrawMs += nowMs() - drawStart;
        if (drawn <= 0 || (this.refreshConfig().webglVisibleEffectRequireCompleteGroupDraw !== false && drawn < queue.length)) {
          this.frameWebglVisibleEffectFallbacks += queue.length;
          this.drawQueuedVisibleEffectsWithCanvasFallback(context, queue, drawn <= 0 ? 'no-quads' : 'partial-group');
          this.metrics.webglVisibleEffectLastError = drawn <= 0 ? 'visible-effect:no-quads' : `visible-effect:partial-group:${drawn}/${queue.length}`;
          queue.length = 0;
          return false;
        }
        const compositeStart = nowMs();
        context.save();
        try {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = Math.max(0.05, Math.min(1, Number(this.refreshConfig().webglVisibleEffectCompositeOpacity || 1) || 1));
          context.globalCompositeOperation = this.refreshConfig().webglVisibleEffectCompositeOperation || 'source-over';
          context.imageSmoothingEnabled = false;
          context.drawImage(this.webglPrototypeCanvas, 0, 0, context.canvas?.width || this.webglPrototypeCanvas.width, context.canvas?.height || this.webglPrototypeCanvas.height);
        } finally {
          context.restore();
        }
        this.frameWebglVisibleEffectCompositeMs += nowMs() - compositeStart;
        this.frameWebglVisibleEffectComposites += 1;
        this.frameWebglVisibleEffectFlushes += 1;
        this.metrics.webglVisibleEffectLayerPromotedThisFrame = true;
        this.metrics.webglVisibleEffectLastError = '';
        queue.length = 0;
        return true;
      } catch (err) {
        this.frameWebglVisibleEffectFallbacks += queue.length || 1;
        this.drawQueuedVisibleEffectsWithCanvasFallback(context, queue, 'exception');
        this.metrics.webglVisibleEffectLastError = `visible-effect:${err?.message || err}`;
        queue.length = 0;
        return false;
      }
    }


    webglVisibleDamageTextLayerActive() {
      const cfg = this.refreshConfig();
      if (cfg.enableWebglVisibleDamageTextLayer === false) return false;
      if (!this.webglVisibleDamageTextEnabled) return false;
      if (!this.isHybridRendererMode()) return false;
      if (this.metrics.webglContextLost || !this.metrics.webglPrototypeReady) return false;
      if (!this.webglPrototypeContext) return false;
      if (this.hybridPromotionBlockedByAudit?.('damage')) return false;
      if (cfg.webglVisibleDamageTextRequirePromotionReady === true && !this.metrics.webglScenePreviewPromotionReady) return false;
      return true;
    }

    setWebglVisibleDamageTextLayer(enabled) {
      this.webglVisibleDamageTextEnabled = !!enabled;
      safeLocalStorageSet(this.webglVisibleDamageTextStorageKey, this.webglVisibleDamageTextEnabled ? '1' : '0');
      this.metrics.webglVisibleDamageTextLayerEnabled = this.webglVisibleDamageTextEnabled;
      return this.webglVisibleDamageTextEnabled;
    }

    toggleWebglVisibleDamageTextLayer() {
      return this.setWebglVisibleDamageTextLayer(!this.webglVisibleDamageTextEnabled);
    }

    damageTextProgressBucket(damage) {
      const life = Math.max(0.001, Number(damage?.life || 0.85) || 0.85);
      const p = Math.max(0, Math.min(1, Number(damage?.t || 0) / life));
      const buckets = Math.max(2, Math.floor(Number(this.refreshConfig().webglVisibleDamageTextProgressBuckets || 6) || 6));
      return Math.max(0, Math.min(buckets, Math.floor(p * buckets)));
    }

    damageTextSpriteCacheKey(damage) {
      if (!damage?.text) return '';
      const text = String(damage.text || '').slice(0, 32);
      const color = String(damage.color || '#ffffff').slice(0, 24);
      return `damage:${text}:${color}:p${this.damageTextProgressBucket(damage)}`;
    }

    drawDamageTextSpriteCanvas(entryContext, damage, width, height) {
      const ctx = entryContext;
      if (!ctx || !damage) return false;
      const text = String(damage.text || '');
      if (!text) return false;
      const life = Math.max(0.001, Number(damage.life || 0.85) || 0.85);
      const p = Math.max(0, Math.min(1, Number(damage.t || 0) / life));
      const alpha = Math.max(0, Math.min(1, 1 - p));
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillText(text, 2, 16);
      ctx.fillStyle = damage.color || '#ffffff';
      ctx.fillText(text, 1, 15);
      ctx.restore();
      return true;
    }

    damageTextSpriteEntryFor(damage) {
      const key = this.damageTextSpriteCacheKey(damage);
      if (!key) return null;
      let cached = this.webglDamageTextSpriteCache.get(key);
      if (cached?.entry?.canvas) {
        cached.lastUsed = this.frameId;
        this.frameWebglVisibleDamageTextCacheHits += 1;
        return { key, entry: cached.entry };
      }
      const cfg = this.refreshConfig();
      const maxWidth = Math.max(48, Math.floor(Number(cfg.webglVisibleDamageTextMaxWidthPx || 180) || 180));
      const height = Math.max(32, Math.floor(Number(cfg.webglVisibleDamageTextSpriteHeightPx || 56) || 56));
      const measureCanvas = createScratchCanvas(8, 8, false);
      const measureCtx = measureCanvas.getContext?.('2d');
      let width = maxWidth;
      try {
        if (measureCtx) {
          measureCtx.font = 'bold 13px ui-monospace, monospace';
          width = Math.min(maxWidth, Math.max(24, Math.ceil(measureCtx.measureText(String(damage.text || '')).width + 6)));
        }
      } catch (_err) {}
      const canvas = createScratchCanvas(width, height, !!cfg.preferOffscreenOverlayCache);
      const ctx = canvas.getContext?.('2d');
      if (!ctx || !this.drawDamageTextSpriteCanvas(ctx, damage, width, height)) return null;
      const entry = { canvas, width, height, originX: 0, originY: 49 };
      this.webglDamageTextSpriteCache.set(key, { entry, lastUsed: this.frameId });
      this.frameWebglVisibleDamageTextCacheMisses += 1;
      this.trimWebglDamageTextSpriteCache();
      return { key, entry };
    }

    trimWebglDamageTextSpriteCache() {
      const cfg = this.refreshConfig();
      const limit = Math.max(32, Math.floor(Number(cfg.webglVisibleDamageTextSpriteCacheMaxEntries || 256) || 256));
      if (!this.webglDamageTextSpriteCache || this.webglDamageTextSpriteCache.size <= limit) return;
      const entries = Array.from(this.webglDamageTextSpriteCache.entries()).sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
      const removeCount = Math.max(0, this.webglDamageTextSpriteCache.size - limit);
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        this.webglDamageTextSpriteCache.delete(entries[i][0]);
        this.frameWebglVisibleDamageTextCacheEvictions += 1;
      }
    }

    candidateForDamageRenderable(renderable) {
      if (!renderable || renderable.kind !== 'damage' || !renderable.damage) return null;
      const damage = renderable.damage;
      const sprite = this.damageTextSpriteEntryFor(damage);
      if (!sprite?.entry?.canvas) return null;
      const tile = this.game?.tileAt?.(damage.x, damage.y) || this.game?.map?.[Math.floor(damage.y)]?.[Math.floor(damage.x)] || null;
      const elev = Number(tile?.elev) || 0;
      const screen = this.game?.worldToScreen?.(damage.x, damage.y, elev);
      const screenX = Number(screen?.x);
      const screenY = Number(screen?.y);
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
      return { key: sprite.key, entry: sprite.entry, screenX, screenY, scale: 1, depth: Number(renderable.depth) || 0, damage };
    }

    drawQueuedVisibleDamageTextWithCanvasFallback(context, queue, reason = 'fallback') {
      const list = queue || this.webglVisibleDamageTextQueue || [];
      if (!list.length) return 0;
      let drawn = 0;
      if (this.refreshConfig().webglVisibleDamageTextCanvasFallbackOnGroupFailure === false) return 0;
      for (const cand of list) {
        try {
          if (cand?.damage && typeof this.game?.drawDamage === 'function') {
            this.game.drawDamage(cand.damage);
            drawn += 1;
          }
        } catch (err) {
          this.metrics.webglVisibleDamageTextLastError = `visible-damage:${reason}:canvas-fallback:${err?.message || err}`;
        }
      }
      this.frameWebglVisibleDamageTextCanvasFallbackDraws += drawn;
      return drawn;
    }

    queueWebglVisibleDamageTextRenderable(renderable) {
      if (!this.webglVisibleDamageTextLayerActive()) return false;
      const cfg = this.refreshConfig();
      const maxQueued = Math.max(1, Math.floor(Number(cfg.webglVisibleDamageTextMaxQueuedPerFrame || 128) || 128));
      const maxGroup = Math.max(1, Math.floor(Number(cfg.webglVisibleDamageTextMaxGroupSize || 64) || 64));
      const queue = this.webglVisibleDamageTextQueue || (this.webglVisibleDamageTextQueue = []);
      if ((this.frameWebglVisibleDamageTextQueued || 0) >= maxQueued || queue.length >= maxGroup) {
        this.frameWebglVisibleDamageTextFallbacks += 1;
        return false;
      }
      this.frameWebglVisibleDamageTextCandidates += 1;
      const cand = this.candidateForDamageRenderable(renderable);
      if (!cand) {
        this.frameWebglVisibleDamageTextFallbacks += 1;
        return false;
      }
      const texEntry = this.textureForSpriteEntry(cand.key, cand.entry);
      if (!texEntry?.texture) {
        this.frameWebglVisibleDamageTextFallbacks += 1;
        return false;
      }
      queue.push(cand);
      this.frameWebglVisibleDamageTextQueued += 1;
      return true;
    }

    flushWebglVisibleDamageTextLayer(context) {
      const queue = this.webglVisibleDamageTextQueue;
      if (!queue || !queue.length) return false;
      if (!context || !this.webglVisibleDamageTextLayerActive()) {
        this.frameWebglVisibleDamageTextFallbacks += queue.length;
        this.drawQueuedVisibleDamageTextWithCanvasFallback(context, queue, 'inactive');
        queue.length = 0;
        return false;
      }
      if (!this.ensureWebglSceneSurface() || !this.setupWebglQuadAttributes()) {
        this.frameWebglVisibleDamageTextFallbacks += queue.length;
        this.drawQueuedVisibleDamageTextWithCanvasFallback(context, queue, 'surface-not-ready');
        queue.length = 0;
        return false;
      }
      const gl = this.webglPrototypeContext;
      const drawStart = nowMs();
      try {
        gl.viewport(0, 0, this.webglPrototypeCanvas.width, this.webglPrototypeCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const drawn = this.drawWebglSpriteCandidatesToScene(queue);
        this.frameWebglVisibleDamageTextDrawCalls += drawn;
        this.frameWebglVisibleDamageTextQuads += drawn;
        this.frameWebglVisibleDamageTextDrawMs += nowMs() - drawStart;
        if (drawn <= 0 || (this.refreshConfig().webglVisibleDamageTextRequireCompleteGroupDraw !== false && drawn < queue.length)) {
          this.frameWebglVisibleDamageTextFallbacks += queue.length;
          this.drawQueuedVisibleDamageTextWithCanvasFallback(context, queue, drawn <= 0 ? 'no-quads' : 'partial-group');
          this.metrics.webglVisibleDamageTextLastError = drawn <= 0 ? 'visible-damage:no-quads' : `visible-damage:partial-group:${drawn}/${queue.length}`;
          queue.length = 0;
          return false;
        }
        const compositeStart = nowMs();
        context.save();
        try {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = Math.max(0.05, Math.min(1, Number(this.refreshConfig().webglVisibleDamageTextCompositeOpacity || 1) || 1));
          context.globalCompositeOperation = 'source-over';
          context.imageSmoothingEnabled = false;
          context.drawImage(this.webglPrototypeCanvas, 0, 0, context.canvas?.width || this.webglPrototypeCanvas.width, context.canvas?.height || this.webglPrototypeCanvas.height);
        } finally {
          context.restore();
        }
        this.frameWebglVisibleDamageTextCompositeMs += nowMs() - compositeStart;
        this.frameWebglVisibleDamageTextComposites += 1;
        this.frameWebglVisibleDamageTextFlushes += 1;
        this.metrics.webglVisibleDamageTextLayerPromotedThisFrame = true;
        this.metrics.webglVisibleDamageTextLastError = '';
        queue.length = 0;
        return true;
      } catch (err) {
        this.frameWebglVisibleDamageTextFallbacks += queue.length || 1;
        this.drawQueuedVisibleDamageTextWithCanvasFallback(context, queue, 'exception');
        this.metrics.webglVisibleDamageTextLastError = `visible-damage:${err?.message || err}`;
        queue.length = 0;
        return false;
      }
    }


    beginHybridVisibleFrame(context) {
      if (this.refreshConfig().enableHybridVisibleFrameConsolidation === false) return false;
      this.hybridVisibleFrameStartMs = nowMs();
      this.hybridVisibleCurrentLayer = 'none';
      this.frameHybridVisiblePromotedLayerMask = '';
      this.frameHybridVisibleLastFlushReason = '';
      return !!context;
    }

    promotedVisibleLayerMask() {
      const parts = [];
      if (this.metrics.webglVisibleTerrainLayerPromotedThisFrame) parts.push('terrain');
      if (this.metrics.webglVisibleSpriteLayerPromotedThisFrame) parts.push('sprites');
      if (this.metrics.webglVisibleEffectLayerPromotedThisFrame) parts.push('effects');
      if (this.metrics.webglVisibleDamageTextLayerPromotedThisFrame) parts.push('damageText');
      return parts.join('+');
    }

    noteHybridVisibleLayer(layer) {
      const next = layer || 'canvas';
      const prev = this.hybridVisibleCurrentLayer || 'none';
      if (prev !== 'none' && prev !== next) this.frameHybridVisibleLayerSwitches += 1;
      this.hybridVisibleCurrentLayer = next;
    }

    flushHybridVisibleQueues(context, reason = 'boundary') {
      if (this.refreshConfig().enableHybridVisibleFrameConsolidation === false) {
        let any = false;
        if (this.webglVisibleSpriteQueue?.length) any = this.flushWebglVisibleSpriteLayer(context) || any;
        if (this.webglVisibleEffectQueue?.length) any = this.flushWebglVisibleEffectLayer(context) || any;
        if (this.webglVisibleDamageTextQueue?.length) any = this.flushWebglVisibleDamageTextLayer(context) || any;
        return any;
      }
      const beforeSpriteFallbacks = Number(this.frameWebglVisibleSpriteFallbacks || 0);
      const beforeEffectFallbacks = Number(this.frameWebglVisibleEffectFallbacks || 0);
      const beforeDamageFallbacks = Number(this.frameWebglVisibleDamageTextFallbacks || 0);
      const beforeSpriteCanvas = Number(this.frameWebglVisibleSpriteCanvasFallbackDraws || 0);
      const beforeEffectCanvas = Number(this.frameWebglVisibleEffectCanvasFallbackDraws || 0);
      const beforeDamageCanvas = Number(this.frameWebglVisibleDamageTextCanvasFallbackDraws || 0);
      let flushed = 0;
      let promoted = false;
      const flushEffectsFirst = this.refreshConfig().hybridVisibleFlushEffectsBeforeSprites === true;
      const doSprite = () => {
        if (this.webglVisibleSpriteQueue?.length) {
          flushed += 1;
          promoted = this.flushWebglVisibleSpriteLayer(context) || promoted;
        }
      };
      const doEffect = () => {
        if (this.webglVisibleEffectQueue?.length) {
          flushed += 1;
          promoted = this.flushWebglVisibleEffectLayer(context) || promoted;
        }
      };
      const doDamage = () => {
        if (this.webglVisibleDamageTextQueue?.length) {
          flushed += 1;
          promoted = this.flushWebglVisibleDamageTextLayer(context) || promoted;
        }
      };
      if (flushEffectsFirst) { doEffect(); doSprite(); doDamage(); }
      else { doSprite(); doEffect(); doDamage(); }
      if (flushed > 0) {
        this.frameHybridVisibleFlushes += flushed;
        this.frameHybridVisibleBoundaryFlushes += 1;
        this.frameHybridVisibleLastFlushReason = String(reason || 'boundary').slice(0, 80);
      }
      this.frameHybridVisibleFallbacks += Math.max(0, Number(this.frameWebglVisibleSpriteFallbacks || 0) - beforeSpriteFallbacks)
        + Math.max(0, Number(this.frameWebglVisibleEffectFallbacks || 0) - beforeEffectFallbacks)
        + Math.max(0, Number(this.frameWebglVisibleDamageTextFallbacks || 0) - beforeDamageFallbacks);
      this.frameHybridVisibleCanvasFallbackDraws += Math.max(0, Number(this.frameWebglVisibleSpriteCanvasFallbackDraws || 0) - beforeSpriteCanvas)
        + Math.max(0, Number(this.frameWebglVisibleEffectCanvasFallbackDraws || 0) - beforeEffectCanvas)
        + Math.max(0, Number(this.frameWebglVisibleDamageTextCanvasFallbackDraws || 0) - beforeDamageCanvas);
      return promoted;
    }

    queueHybridVisibleRenderable(renderable, context) {
      if (this.refreshConfig().enableHybridVisibleFrameConsolidation === false) {
        if (renderable?.kind === 'entity') return this.queueWebglVisibleSpriteRenderable(renderable) === true;
        if (renderable?.kind === 'effect') return this.queueWebglVisibleEffectRenderable(renderable) === true;
        if (renderable?.kind === 'damage') return this.queueWebglVisibleDamageTextRenderable(renderable) === true;
        return false;
      }
      if (!renderable) return false;
      if (renderable.kind === 'entity') {
        if (this.webglVisibleEffectQueue?.length || this.webglVisibleDamageTextQueue?.length) this.flushHybridVisibleQueues(context, 'overlays-before-entity');
        const queued = this.queueWebglVisibleSpriteRenderable(renderable) === true;
        if (queued) {
          this.noteHybridVisibleLayer('sprites');
          return true;
        }
        if (this.webglVisibleSpriteQueue?.length) this.flushHybridVisibleQueues(context, 'sprite-before-canvas-entity');
        this.noteHybridVisibleLayer('canvas');
        return false;
      }
      if (renderable.kind === 'effect') {
        if (this.webglVisibleSpriteQueue?.length || this.webglVisibleDamageTextQueue?.length) this.flushHybridVisibleQueues(context, 'non-effect-before-effect');
        const queued = this.queueWebglVisibleEffectRenderable(renderable) === true;
        if (queued) {
          this.noteHybridVisibleLayer('effects');
          return true;
        }
        if (this.webglVisibleEffectQueue?.length) this.flushHybridVisibleQueues(context, 'effect-before-canvas-effect');
        this.noteHybridVisibleLayer('canvas');
        return false;
      }
      if (renderable.kind === 'damage') {
        if (this.webglVisibleSpriteQueue?.length || this.webglVisibleEffectQueue?.length) this.flushHybridVisibleQueues(context, 'scene-before-damage');
        const queued = this.queueWebglVisibleDamageTextRenderable(renderable) === true;
        if (queued) {
          this.noteHybridVisibleLayer('damageText');
          return true;
        }
        if (this.webglVisibleDamageTextQueue?.length) this.flushHybridVisibleQueues(context, 'damage-before-canvas-damage');
        this.noteHybridVisibleLayer('canvas');
        return false;
      }
      if (this.webglVisibleSpriteQueue?.length || this.webglVisibleEffectQueue?.length || this.webglVisibleDamageTextQueue?.length) this.flushHybridVisibleQueues(context, `canvas-${renderable.kind || 'renderable'}`);
      this.noteHybridVisibleLayer('canvas');
      return false;
    }

    endHybridVisibleFrame(context) {
      if (this.refreshConfig().enableHybridVisibleFrameConsolidation === false) return false;
      const promoted = this.flushHybridVisibleQueues(context, 'end-frame');
      this.frameHybridVisiblePromotedLayerMask = this.promotedVisibleLayerMask();
      this.frameHybridVisibleFrameMs = this.hybridVisibleFrameStartMs ? Math.max(0, nowMs() - this.hybridVisibleFrameStartMs) : 0;
      this.hybridVisibleCurrentLayer = 'none';
      return promoted;
    }

    activeBackendLabel() {
      if (!this.isHybridRendererMode?.()) return 'canvas2d';
      const terrain = this.webglVisibleTerrainLayerActive?.() && this.metrics.webglVisibleTerrainLayerPromotedThisFrame;
      const sprites = this.webglVisibleSpriteLayerActive?.() && this.metrics.webglVisibleSpriteLayerPromotedThisFrame;
      const effects = this.webglVisibleEffectLayerActive?.() && this.metrics.webglVisibleEffectLayerPromotedThisFrame;
      const damage = this.webglVisibleDamageTextLayerActive?.() && this.metrics.webglVisibleDamageTextLayerPromotedThisFrame;
      if (terrain && sprites && effects && damage) return 'webgl-terrain+webgl-sprites+webgl-effects+webgl-damage+canvas-ui';
      if (terrain && sprites && damage) return 'webgl-terrain+webgl-sprites+webgl-damage+canvas-effects';
      if (sprites && damage) return 'webgl-sprites+webgl-damage+canvas-scene';
      if (effects && damage) return 'webgl-effects+webgl-damage+canvas-scene';
      if (damage) return 'webgl-damage+canvas-scene';
      if (terrain && sprites && effects) return 'webgl-terrain+webgl-sprites+webgl-effects+canvas-ui';
      if (terrain && sprites) return 'webgl-terrain+webgl-sprites+canvas-effects';
      if (terrain && effects) return 'webgl-terrain+webgl-effects+canvas-actors';
      if (sprites && effects) return 'webgl-sprites+webgl-effects+canvas-terrain';
      if (terrain) return 'webgl-terrain+canvas-actors';
      if (sprites) return 'webgl-sprites+canvas-terrain';
      if (effects) return 'webgl-effects+canvas-scene';
      if (this.webglScenePreviewActive?.()) return 'canvas2d+webgl-scene-preview';
      return 'canvas2d+webgl-prototypes';
    }

    drawQueuedVisibleSpritesWithCanvasFallback(context, queue, reason = 'fallback') {
      const list = queue || this.webglVisibleSpriteQueue || [];
      if (!list.length) return 0;
      let drawn = 0;
      const shouldFallback = this.refreshConfig().webglVisibleSpriteCanvasFallbackOnGroupFailure !== false;
      if (!shouldFallback) return 0;
      for (const cand of list) {
        const entity = cand?.entity;
        if (!entity) continue;
        try {
          if (typeof this.game?.drawEntity === 'function') {
            this.game.drawEntity(entity);
            drawn += 1;
          }
        } catch (err) {
          this.metrics.webglVisibleSpriteLastError = `visible-sprite:${reason}:canvas-fallback:${err?.message || err}`;
        }
      }
      this.frameWebglVisibleSpriteCanvasFallbackDraws += drawn;
      return drawn;
    }

    candidateForEntityRenderable(renderable) {
      if (!renderable || renderable.kind !== 'entity' || !renderable.entity) return null;
      const actor = renderable.entity;
      if (actor === this.game?.player && this.refreshConfig().webglVisibleSpritePromotePlayer === false) return null;
      const key = actor._runtimeSpriteCacheKey;
      if (!key) return null;
      const entry = this.getSpriteCacheEntry(key);
      if (!entry?.canvas) return null;
      let screenX = Number(actor.screenX);
      let screenY = Number(actor.screenY);
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
        const tile = this.game?.tileAt?.(actor.x, actor.y) || this.game?.map?.[Math.floor(actor.y)]?.[Math.floor(actor.x)] || null;
        const elev = Number(tile?.elev) || 0;
        const foot = this.game?.worldToScreen?.(actor.x, actor.y, elev + (Number(actor.z) || 0));
        screenX = Number(foot?.x);
        screenY = Number(foot?.y);
      }
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
      return { key, entry, screenX, screenY, scale: Number(actor.visualScale || 1) || 1, depth: Number(renderable.depth) || 0, entity: actor };
    }

    queueWebglVisibleSpriteRenderable(renderable) {
      if (!this.webglVisibleSpriteLayerActive()) return false;
      const cfg = this.refreshConfig();
      const maxQueued = Math.max(1, Math.floor(Number(cfg.webglVisibleSpriteMaxQueuedPerFrame || cfg.webglSpriteMaxDrawsPerFrame || 192) || 192));
      const maxGroup = Math.max(1, Math.floor(Number(cfg.webglVisibleSpriteMaxGroupSize || maxQueued) || maxQueued));
      const queue = this.webglVisibleSpriteQueue || (this.webglVisibleSpriteQueue = []);
      if ((this.frameWebglVisibleSpriteQueued || 0) >= maxQueued || queue.length >= maxGroup) {
        this.frameWebglVisibleSpriteFallbacks += 1;
        return false;
      }
      const cand = this.candidateForEntityRenderable(renderable);
      this.frameWebglVisibleSpriteCandidates += 1;
      if (!cand) {
        this.frameWebglVisibleSpriteFallbacks += 1;
        return false;
      }
      if (cfg.webglVisibleSpriteRequireDepthSorted !== false) {
        const eps = Math.max(0, Number(cfg.webglVisibleSpriteDepthEpsilon || 0.0005) || 0.0005);
        const lastDepth = Number(this.webglVisibleSpriteLastQueuedDepth);
        if (Number.isFinite(lastDepth) && cand.depth + eps < lastDepth) {
          this.frameWebglVisibleSpriteDepthOrderFallbacks += 1;
          this.frameWebglVisibleSpriteFallbacks += 1;
          this.metrics.webglVisibleSpriteLastError = 'visible-sprite:depth-order-fallback';
          return false;
        }
      }
      const texEntry = this.textureForSpriteEntry(cand.key, cand.entry);
      if (!texEntry?.texture) {
        this.frameWebglVisibleSpriteFallbacks += 1;
        return false;
      }
      queue.push(cand);
      this.webglVisibleSpriteLastQueuedDepth = Math.max(Number(this.webglVisibleSpriteLastQueuedDepth) || -Infinity, Number(cand.depth) || 0);
      this.frameWebglVisibleSpriteQueued += 1;
      return true;
    }

    flushWebglVisibleSpriteLayer(context) {
      const queue = this.webglVisibleSpriteQueue;
      if (!queue || !queue.length) return false;
      if (!context || !this.webglVisibleSpriteLayerActive()) {
        this.frameWebglVisibleSpriteFallbacks += queue.length;
        this.drawQueuedVisibleSpritesWithCanvasFallback(context, queue, 'inactive');
        queue.length = 0;
        this.webglVisibleSpriteLastQueuedDepth = -Infinity;
        return false;
      }
      if (!this.ensureWebglSceneSurface() || !this.setupWebglQuadAttributes()) {
        this.frameWebglVisibleSpriteFallbacks += queue.length;
        this.drawQueuedVisibleSpritesWithCanvasFallback(context, queue, 'surface-not-ready');
        queue.length = 0;
        this.webglVisibleSpriteLastQueuedDepth = -Infinity;
        return false;
      }
      const gl = this.webglPrototypeContext;
      const drawStart = nowMs();
      try {
        gl.viewport(0, 0, this.webglPrototypeCanvas.width, this.webglPrototypeCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const drawn = this.drawWebglSpriteCandidatesToScene(queue);
        this.frameWebglVisibleSpriteDrawCalls += drawn;
        this.frameWebglVisibleSpriteQuads += drawn;
        this.frameWebglVisibleSpriteDrawMs += nowMs() - drawStart;
        if (drawn <= 0 || (this.refreshConfig().webglVisibleSpriteRequireCompleteGroupDraw !== false && drawn < queue.length)) {
          this.frameWebglVisibleSpriteFallbacks += queue.length;
          this.drawQueuedVisibleSpritesWithCanvasFallback(context, queue, drawn <= 0 ? 'no-quads' : 'partial-group');
          this.metrics.webglVisibleSpriteLastError = drawn <= 0 ? 'visible-sprite:no-quads' : `visible-sprite:partial-group:${drawn}/${queue.length}`;
          queue.length = 0;
          this.webglVisibleSpriteLastQueuedDepth = -Infinity;
          return false;
        }
        const compositeStart = nowMs();
        context.save();
        try {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = Math.max(0.05, Math.min(1, Number(this.refreshConfig().webglVisibleSpriteCompositeOpacity || 1) || 1));
          context.globalCompositeOperation = 'source-over';
          context.imageSmoothingEnabled = false;
          context.drawImage(this.webglPrototypeCanvas, 0, 0, context.canvas?.width || this.webglPrototypeCanvas.width, context.canvas?.height || this.webglPrototypeCanvas.height);
        } finally {
          context.restore();
        }
        this.frameWebglVisibleSpriteCompositeMs += nowMs() - compositeStart;
        this.frameWebglVisibleSpriteComposites += 1;
        this.frameWebglVisibleSpriteFlushes += 1;
        this.frameWebglVisibleSpriteDepthGroups += 1;
        this.webglVisibleSpriteLastQueuedDepth = -Infinity;
        this.metrics.webglVisibleSpriteLayerPromotedThisFrame = true;
        this.metrics.webglVisibleSpriteLastError = '';
        queue.length = 0;
        return true;
      } catch (err) {
        this.frameWebglVisibleSpriteFallbacks += queue.length || 1;
        this.drawQueuedVisibleSpritesWithCanvasFallback(context, queue, 'exception');
        this.metrics.webglVisibleSpriteLastError = `visible-sprite:${err?.message || err}`;
        queue.length = 0;
        this.webglVisibleSpriteLastQueuedDepth = -Infinity;
        return false;
      }
    }

    setWebglScenePreviewOverlay(enabled) {
      this.webglScenePreviewOverlayEnabled = !!enabled;
      safeLocalStorageSet(this.webglScenePreviewStorageKey, this.webglScenePreviewOverlayEnabled ? '1' : '0');
      this.metrics.webglScenePreviewOverlayEnabled = this.webglScenePreviewOverlayEnabled;
      return this.webglScenePreviewOverlayEnabled;
    }

    toggleWebglScenePreviewOverlay() {
      return this.setWebglScenePreviewOverlay(!this.webglScenePreviewOverlayEnabled);
    }


    setWebglScenePreviewLayer(layer, enabled) {
      const on = !!enabled;
      if (layer === 'terrain') {
        this.webglScenePreviewTerrainEnabled = on;
        safeLocalStorageSet(this.webglSceneTerrainStorageKey, on ? '1' : '0');
        this.metrics.webglScenePreviewTerrainLayerEnabled = on;
      } else if (layer === 'sprites') {
        this.webglScenePreviewSpriteEnabled = on;
        safeLocalStorageSet(this.webglSceneSpriteStorageKey, on ? '1' : '0');
        this.metrics.webglScenePreviewSpriteLayerEnabled = on;
      } else if (layer === 'guides') {
        this.webglScenePreviewGuidesEnabled = on;
        safeLocalStorageSet(this.webglSceneGuidesStorageKey, on ? '1' : '0');
        this.metrics.webglScenePreviewGuidesEnabled = on;
      }
      return on;
    }

    toggleWebglScenePreviewLayer(layer) {
      if (layer === 'terrain') return this.setWebglScenePreviewLayer('terrain', !this.webglScenePreviewTerrainEnabled);
      if (layer === 'sprites') return this.setWebglScenePreviewLayer('sprites', !this.webglScenePreviewSpriteEnabled);
      if (layer === 'guides') return this.setWebglScenePreviewLayer('guides', !this.webglScenePreviewGuidesEnabled);
      return false;
    }

    updateScenePreviewAlignmentMetrics() {
      const cfg = this.refreshConfig();
      const active = !!this.metrics.webglScenePreviewEnabled;
      const ready = !!this.metrics.webglScenePreviewReady;
      const terrainLayer = !!this.webglScenePreviewTerrainEnabled;
      const spriteLayer = !!this.webglScenePreviewSpriteEnabled;
      const terrainExpected = terrainLayer ? Math.max(0, Number(this.frameWebglTerrainCandidates || 0) || 0) : 0;
      const spriteExpected = spriteLayer ? Math.max(0, Number(this.pendingWebglSceneSpriteCandidates?.length || this.frameWebglSpriteCandidates || 0) || 0) : 0;
      const expected = terrainExpected + spriteExpected;
      const drawn = Math.max(0, Number(this.frameWebglScenePreviewQuads || 0) || 0);
      const coverage = expected > 0 ? Math.max(0, Math.min(100, (drawn / expected) * 100)) : (active && ready ? 100 : 0);
      const fallbackPressure = (Number(this.frameWebglSpriteFallbacks || 0) || 0) + (Number(this.frameWebglTerrainFallbacks || 0) || 0);
      const costMs = (Number(this.frameWebglScenePreviewDrawMs || 0) || 0) + (Number(this.frameWebglScenePreviewCompositeMs || 0) || 0);
      const maxCost = Math.max(1, Number(cfg.webglScenePreviewMaxCostMsForReady || 5) || 5);
      const maxFallbacks = Math.max(0, Math.floor(Number(cfg.webglScenePreviewMaxFallbacksForReady || 4) || 4));
      const costScore = Math.max(0, 100 - Math.max(0, costMs - maxCost) * 12);
      const fallbackScore = Math.max(0, 100 - Math.max(0, fallbackPressure - maxFallbacks) * 16);
      const baseScore = active && ready ? 100 : 0;
      const layerScore = terrainLayer || spriteLayer ? 100 : 35;
      const score = Math.round(Math.min(baseScore, coverage * 0.55 + costScore * 0.25 + fallbackScore * 0.15 + layerScore * 0.05));
      const target = Math.max(50, Math.min(98, Number(cfg.webglScenePreviewPromotionScoreTarget || 82) || 82));
      const promotionReady = score >= target && active && ready && fallbackPressure <= maxFallbacks && costMs <= maxCost * 1.35 && !!this.webglScenePreviewOverlayEnabled;
      let readiness = 'inactive';
      let recommendation = 'Enable Hybrid WebGL Prototype and scene preview overlay before promoting WebGL to visible rendering.';
      if (active && !ready) {
        readiness = 'blocked';
        recommendation = this.metrics.webglScenePreviewLastError || this.metrics.webglContextLost ? 'WebGL scene preview is blocked by context/error state. Stay on Canvas 2D Stable.' : 'WebGL scene surface is not ready yet.';
      } else if (active && ready && !this.webglScenePreviewOverlayEnabled) {
        readiness = 'hidden';
        recommendation = 'Turn on WebGL Scene Preview overlay to visually compare terrain and sprite alignment.';
      } else if (active && ready && expected > 0 && coverage < 82) {
        readiness = 'coverage-low';
        recommendation = 'Coverage is low. Keep Hybrid in preview mode and inspect missing terrain/sprite batches.';
      } else if (active && ready && fallbackPressure > maxFallbacks) {
        readiness = 'fallback-pressure';
        recommendation = 'Texture upload fallback pressure is too high. Increase cache reuse or lower WebGL candidate budgets before promotion.';
      } else if (active && ready && costMs > maxCost * 1.35) {
        readiness = 'cost-high';
        recommendation = 'WebGL preview cost is too high for visible renderer promotion. Reduce upload/draw budgets or cache more layers.';
      } else if (promotionReady) {
        readiness = 'promotion-ready';
        recommendation = 'WebGL scene preview is stable enough for the next pass: optional full-size comparison or limited visible terrain layer.';
      } else if (active && ready) {
        readiness = 'watch';
        recommendation = 'Preview is running. Use terrain/sprite layer toggles and guides to verify alignment before promotion.';
      }
      this.metrics.webglScenePreviewCoveragePct = Math.round(coverage * 10) / 10;
      this.metrics.webglScenePreviewFallbackPressure = fallbackPressure;
      this.metrics.webglScenePreviewAlignmentScore = score;
      this.metrics.webglScenePreviewPromotionReady = promotionReady;
      this.metrics.webglScenePreviewReadiness = readiness;
      this.metrics.webglScenePreviewRecommendation = recommendation;
      return score;
    }

    sceneCanvasSize() {
      const gameCanvas = this.game?.canvas;
      const w = Math.max(16, Math.floor(Number(window.innerWidth || gameCanvas?.clientWidth || gameCanvas?.width || 800) || 800));
      const h = Math.max(16, Math.floor(Number(window.innerHeight || gameCanvas?.clientHeight || gameCanvas?.height || 600) || 600));
      return { width: w, height: h };
    }

    ensureWebglSceneSurface() {
      if (!this.webglScenePreviewActive()) return false;
      if (!this.initWebglSpritePipeline()) return false;
      const canvas = this.webglPrototypeCanvas;
      const gl = this.webglPrototypeContext;
      const size = this.sceneCanvasSize();
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      return true;
    }

    screenPointForWebgl(point) {
      const c = this.game?.getCameraProjectionCache?.();
      if (!c || !point) return { x: finiteNumber(point?.x, 0), y: finiteNumber(point?.y, 0) };
      return {
        x: c.halfWidth + (finiteNumber(point.x, c.halfWidth) - c.halfWidth) * c.zoom,
        y: c.halfHeight + (finiteNumber(point.y, c.halfHeight) - c.halfHeight) * c.zoom
      };
    }

    drawWebglQuadPx(texture, points, uv) {
      const gl = this.webglPrototypeContext;
      const canvas = this.webglPrototypeCanvas;
      if (!gl || !canvas || !texture || !points || points.length < 4) return false;
      const w = Math.max(1, canvas.width || 1);
      const h = Math.max(1, canvas.height || 1);
      const ndc = (pt, tex) => [
        finiteNumber(pt.x, 0) / w * 2 - 1,
        1 - finiteNumber(pt.y, 0) / h * 2,
        finiteNumber(tex.u, 0),
        finiteNumber(tex.v, 0)
      ];
      const p0 = ndc(points[0], uv[0]);
      const p1 = ndc(points[1], uv[1]);
      const p2 = ndc(points[2], uv[2]);
      const p3 = ndc(points[3], uv[3]);
      const verts = new Float32Array([
        ...p0, ...p1, ...p2,
        ...p2, ...p1, ...p3
      ]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.webglSpriteVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    }

    setupWebglQuadAttributes() {
      const gl = this.webglPrototypeContext;
      if (!gl || !this.webglSpriteProgram || !this.webglSpriteVertexBuffer) return false;
      gl.useProgram(this.webglSpriteProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.webglSpriteVertexBuffer);
      const posLoc = this.webglSpriteAttribs.position;
      const uvLoc = this.webglSpriteAttribs.texcoord;
      if (posLoc >= 0) { gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0); }
      if (uvLoc >= 0) { gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8); }
      return true;
    }

    drawWebglSpriteCandidatesToScene(candidates = []) {
      if (!candidates.length || !this.setupWebglQuadAttributes()) return 0;
      const cfg = this.refreshConfig();
      const maxDraws = Math.max(0, Math.floor(Number(cfg.webglSceneMaxSpriteDrawsPerFrame || cfg.webglSpriteMaxDrawsPerFrame || 192) || 192));
      let drawn = 0;
      for (let i = 0; i < candidates.length && drawn < maxDraws; i++) {
        const cand = candidates[i];
        const texEntry = this.textureForSpriteEntry(cand.key, cand.entry);
        if (!texEntry?.texture) continue;
        const scale = Number(cand.scale) || 1;
        const c = this.game?.getCameraProjectionCache?.();
        const sxRaw = finiteNumber(cand.screenX, 0);
        const syRaw = finiteNumber(cand.screenY, 0);
        const screen = c ? { x: c.halfWidth + (sxRaw - c.halfWidth) * c.zoom, y: c.halfHeight + (syRaw - c.halfHeight) * c.zoom } : { x: sxRaw, y: syRaw };
        const originX = finiteNumber(cand.entry.originX, 0) * scale * (c?.zoom || 1);
        const originY = finiteNumber(cand.entry.originY, 0) * scale * (c?.zoom || 1);
        const w = Math.max(1, finiteNumber(cand.entry.width || texEntry.width, 1) * scale * (c?.zoom || 1));
        const h = Math.max(1, finiteNumber(cand.entry.height || texEntry.height, 1) * scale * (c?.zoom || 1));
        const x0 = screen.x - originX;
        const y0 = screen.y - originY;
        if (this.drawWebglQuadPx(texEntry.texture, [
          { x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0, y: y0 + h }, { x: x0 + w, y: y0 + h }
        ], [
          { u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }, { u: 1, v: 1 }
        ])) drawn += 1;
      }
      return drawn;
    }

    drawWebglTerrainCandidatesToScene(payload = {}) {
      const candidates = this.collectWebglTerrainCandidates(payload);
      if (!candidates.length || !this.setupWebglQuadAttributes()) return 0;
      const cfg = this.refreshConfig();
      const maxDraws = Math.max(0, Math.floor(Number(cfg.webglSceneMaxTerrainDrawsPerFrame || cfg.webglTerrainMaxDrawsPerFrame || 128) || 128));
      const game = this.game;
      const projection = game?.getCameraProjectionCache?.();
      const cos = Number.isFinite(Number(projection?.cos)) ? Number(projection.cos) : Math.cos(Number(game?.camera?.yaw || 0));
      const sin = Number.isFinite(Number(projection?.sin)) ? Number(projection.sin) : Math.sin(Number(game?.camera?.yaw || 0));
      const zoom = Number(projection?.zoom || 1) || 1;
      const xScreenX = (cos - sin) * DR.CONFIG.TILE_W / 2;
      const xScreenY = (cos + sin) * DR.CONFIG.TILE_H / 2;
      const yScreenX = (-sin - cos) * DR.CONFIG.TILE_W / 2;
      const yScreenY = (-sin + cos) * DR.CONFIG.TILE_H / 2;
      let drawn = 0;
      const cfgBleed = this.refreshConfig();
      const bleed = Math.max(0, Math.min(8, Math.floor(Number(cfgBleed.webglTerrainChunkBleedPx ?? 2) || 0)));
      this.frameWebglTerrainSeamBleedPx = bleed;
      for (let i = 0; i < candidates.length && drawn < maxDraws; i++) {
        const cand = candidates[i];
        const texEntry = this.textureForTerrainCandidate(cand);
        if (!texEntry?.texture || !cand.chunk || !cand.canvas) continue;
        const chunk = cand.chunk;
        const originRaw = game?.worldToScreen?.(chunk.startX - 0.5, chunk.startY - 0.5, finiteNumber(cand.elev, 0));
        const origin = this.screenPointForWebgl(originRaw);
        const ax = { x: (xScreenX / Math.max(1, chunk.scale || 1)) * zoom, y: (xScreenY / Math.max(1, chunk.scale || 1)) * zoom };
        const ay = { x: (yScreenX / Math.max(1, chunk.scale || 1)) * zoom, y: (yScreenY / Math.max(1, chunk.scale || 1)) * zoom };
        const dx0 = -bleed;
        const dy0 = -bleed;
        const dx1 = finiteNumber(cand.cropW, 1) + bleed;
        const dy1 = finiteNumber(cand.cropH, 1) + bleed;
        const point = (dx, dy) => ({ x: origin.x + ax.x * dx + ay.x * dy, y: origin.y + ax.y * dx + ay.y * dy });
        const texW = Math.max(1, finiteNumber(cand.canvas.width, texEntry.width || 1));
        const texH = Math.max(1, finiteNumber(cand.canvas.height, texEntry.height || 1));
        const sx0 = Math.max(0, finiteNumber(cand.cropX, 0) - bleed);
        const sy0 = Math.max(0, finiteNumber(cand.cropY, 0) - bleed);
        const sx1 = Math.min(texW, finiteNumber(cand.cropX, 0) + finiteNumber(cand.cropW, 1) + bleed);
        const sy1 = Math.min(texH, finiteNumber(cand.cropY, 0) + finiteNumber(cand.cropH, 1) + bleed);
        if (this.drawWebglQuadPx(texEntry.texture, [
          point(dx0, dy0), point(dx1, dy0), point(dx0, dy1), point(dx1, dy1)
        ], [
          { u: sx0 / texW, v: sy0 / texH }, { u: sx1 / texW, v: sy0 / texH },
          { u: sx0 / texW, v: sy1 / texH }, { u: sx1 / texW, v: sy1 / texH }
        ])) drawn += 1;
      }
      return drawn;
    }

    drawWebglVisibleTerrainLayer(payload = {}) {
      if (!this.webglVisibleTerrainLayerActive()) return false;
      const context = window.DreamRealms?.runtime?.ctx || this.game?.ctx || null;
      if (!context) return false;
      if (!this.ensureWebglSceneSurface() || !this.setupWebglQuadAttributes()) return false;
      const gl = this.webglPrototypeContext;
      const start = nowMs();
      try {
        gl.viewport(0, 0, this.webglPrototypeCanvas.width, this.webglPrototypeCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const terrainDrawn = this.drawWebglTerrainCandidatesToScene(payload);
        this.frameWebglVisibleTerrainDrawCalls += terrainDrawn;
        this.frameWebglVisibleTerrainQuads += terrainDrawn;
        this.frameWebglVisibleTerrainDrawMs += nowMs() - start;
        const requiredTerrainDraws = Math.min(Number(this.frameWebglTerrainCandidates || 0) || terrainDrawn, Math.max(1, Number(this.refreshConfig().webglSceneMaxTerrainDrawsPerFrame || this.refreshConfig().webglTerrainMaxDrawsPerFrame || terrainDrawn) || terrainDrawn));
        if (terrainDrawn <= 0 || (this.refreshConfig().webglTerrainRequireCompleteCandidateDraw === true && terrainDrawn < requiredTerrainDraws)) {
          this.frameWebglVisibleTerrainFallbacks += 1;
          if (terrainDrawn > 0) this.frameWebglTerrainPartialFallbacks += 1;
          this.metrics.webglVisibleTerrainLastError = terrainDrawn <= 0 ? 'visible-terrain:no-quads' : `visible-terrain:partial:${terrainDrawn}/${requiredTerrainDraws}`;
          return false;
        }
        const compositeStart = nowMs();
        context.save();
        try {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = Math.max(0.05, Math.min(1, Number(this.refreshConfig().webglVisibleTerrainCompositeOpacity || 1) || 1));
          context.globalCompositeOperation = 'source-over';
          context.imageSmoothingEnabled = true;
          context.drawImage(this.webglPrototypeCanvas, 0, 0, context.canvas?.width || this.webglPrototypeCanvas.width, context.canvas?.height || this.webglPrototypeCanvas.height);
        } finally {
          context.restore();
        }
        this.frameWebglVisibleTerrainCompositeMs += nowMs() - compositeStart;
        this.frameWebglVisibleTerrainComposites += 1;
        this.metrics.webglVisibleTerrainLayerPromotedThisFrame = true;
        this.metrics.webglVisibleTerrainLastError = '';
        return true;
      } catch (err) {
        this.frameWebglVisibleTerrainFallbacks += 1;
        this.metrics.webglVisibleTerrainLastError = `visible-terrain:${err?.message || err}`;
        return false;
      }
    }

    drawWebglScenePreview(payload = {}) {
      if (!this.webglScenePreviewActive()) return false;
      if (!this.ensureWebglSceneSurface() || !this.setupWebglQuadAttributes()) return false;
      const gl = this.webglPrototypeContext;
      const start = nowMs();
      try {
        gl.viewport(0, 0, this.webglPrototypeCanvas.width, this.webglPrototypeCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const terrainDrawn = this.webglScenePreviewTerrainEnabled ? this.drawWebglTerrainCandidatesToScene(payload) : 0;
        const spriteDrawn = this.webglScenePreviewSpriteEnabled ? this.drawWebglSpriteCandidatesToScene(this.pendingWebglSceneSpriteCandidates || []) : 0;
        const total = terrainDrawn + spriteDrawn;
        this.frameWebglScenePreviewDrawCalls += total;
        this.frameWebglScenePreviewQuads += total;
        this.frameWebglScenePreviewTerrainQuads += terrainDrawn;
        this.frameWebglScenePreviewSpriteQuads += spriteDrawn;
        this.frameWebglScenePreviewDrawMs += nowMs() - start;
        this.metrics.webglScenePreviewLastError = '';
        return total > 0;
      } catch (err) {
        this.metrics.webglScenePreviewLastError = `scene:${err?.message || err}`;
        return false;
      }
    }

    drawVisibleScenePreviewOverlay(context) {
      const cfg = this.refreshConfig();
      if (!context || !this.webglScenePreviewOverlayEnabled || cfg.enableWebglVisibleScenePreviewOverlay === false) return false;
      if (this.metrics.webglVisibleSpriteLayerPromotedThisFrame && cfg.webglVisibleSpriteAllowPreviewOverlay !== true) return false;
      if (!this.webglPrototypeCanvas || !this.metrics.webglScenePreviewReady && !this.webglScenePreviewActive()) return false;
      const canvas = this.webglPrototypeCanvas;
      const start = nowMs();
      try {
        const full = cfg.webglVisibleScenePreviewFullSize === true;
        const opacity = Math.max(0.05, Math.min(1, Number(cfg.webglVisibleScenePreviewOverlayOpacity || 0.92) || 0.92));
        const scale = full ? 1 : Math.max(0.12, Math.min(0.65, Number(cfg.webglVisibleScenePreviewOverlayScale || 0.30) || 0.30));
        const dstW = full ? window.innerWidth : Math.max(160, Math.floor(window.innerWidth * scale));
        const dstH = full ? window.innerHeight : Math.max(100, Math.floor(window.innerHeight * scale));
        const x = full ? 0 : Math.max(10, window.innerWidth - dstW - 16);
        const y = full ? 0 : Math.max(10, window.innerHeight - dstH - 16);
        context.save();
        context.globalAlpha = opacity;
        context.drawImage(canvas, x, y, dstW, dstH);
        if (!full) {
          context.globalAlpha = 0.88;
          context.strokeStyle = '#66d9ff';
          context.lineWidth = 2;
          context.strokeRect(x + 0.5, y + 0.5, dstW - 1, dstH - 1);
          context.fillStyle = 'rgba(4,10,18,0.78)';
          context.fillRect(x, y, Math.min(dstW, 244), 22);
          context.fillStyle = '#dff8ff';
          context.font = '12px monospace';
          context.fillText('WebGL scene preview (Canvas active)', x + 8, y + 15);
          if (this.webglScenePreviewGuidesEnabled) {
            const cx = x + dstW / 2;
            const cy = y + dstH / 2;
            context.save();
            context.globalAlpha = 0.72;
            context.strokeStyle = 'rgba(255,255,255,0.62)';
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(cx, y + 24);
            context.lineTo(cx, y + dstH - 4);
            context.moveTo(x + 4, cy);
            context.lineTo(x + dstW - 4, cy);
            context.stroke();
            context.fillStyle = 'rgba(4,10,18,0.72)';
            context.fillRect(x + 6, y + dstH - 40, Math.min(dstW - 12, 300), 32);
            context.fillStyle = '#dff8ff';
            context.font = '11px monospace';
            context.fillText(`T:${this.webglScenePreviewTerrainEnabled ? 'on' : 'off'} S:${this.webglScenePreviewSpriteEnabled ? 'on' : 'off'} score:${this.metrics.webglScenePreviewAlignmentScore || 0}`, x + 12, y + dstH - 24);
            context.fillText(`${this.metrics.webglScenePreviewReadiness || 'inactive'}`, x + 12, y + dstH - 10);
            context.restore();
          }
        }
        context.restore();
        this.frameWebglScenePreviewCompositeMs += nowMs() - start;
        this.frameWebglScenePreviewComposites += 1;
        return true;
      } catch (err) {
        this.metrics.webglScenePreviewLastError = `composite:${err?.message || err}`;
        try { context.restore(); } catch (_err) {}
        return false;
      }
    }

    drawWebglSpritePrototype(candidates) {
      if (!this.webglSpritePrototypeActive()) return false;
      if (!this.initWebglSpritePipeline()) return false;
      const gl = this.webglPrototypeContext;
      const canvas = this.webglPrototypeCanvas;
      const cfg = this.refreshConfig();
      const maxDraws = Math.max(0, Math.floor(Number(cfg.webglSpriteMaxDrawsPerFrame || 192) || 192));
      const width = Math.max(16, Math.min(2048, Math.floor((this.game?.canvas?.width || window.innerWidth || 256) / 2)));
      const height = Math.max(16, Math.min(2048, Math.floor((this.game?.canvas?.height || window.innerHeight || 256) / 2)));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const start = nowMs();
      try {
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.webglSpriteProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.webglSpriteVertexBuffer);
        const posLoc = this.webglSpriteAttribs.position;
        const uvLoc = this.webglSpriteAttribs.texcoord;
        if (posLoc >= 0) {
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
        }
        if (uvLoc >= 0) {
          gl.enableVertexAttribArray(uvLoc);
          gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
        }
        let drawn = 0;
        for (let i = 0; i < candidates.length && drawn < maxDraws; i++) {
          const cand = candidates[i];
          const texEntry = this.textureForSpriteEntry(cand.key, cand.entry);
          if (!texEntry?.texture) continue;
          const w = Math.max(1, Number(cand.entry.width || texEntry.width || 1) * (Number(cand.scale) || 1));
          const h = Math.max(1, Number(cand.entry.height || texEntry.height || 1) * (Number(cand.scale) || 1));
          const x0 = ((Number(cand.screenX) - Number(cand.entry.originX || 0) * (Number(cand.scale) || 1)) / Math.max(1, this.game?.canvas?.width || window.innerWidth || width)) * width;
          const y0 = ((Number(cand.screenY) - Number(cand.entry.originY || 0) * (Number(cand.scale) || 1)) / Math.max(1, this.game?.canvas?.height || window.innerHeight || height)) * height;
          const x1 = x0 + w;
          const y1 = y0 + h;
          const nx0 = x0 / width * 2 - 1;
          const nx1 = x1 / width * 2 - 1;
          const ny0 = 1 - y0 / height * 2;
          const ny1 = 1 - y1 / height * 2;
          const verts = new Float32Array([
            nx0, ny0, 0, 0,
            nx1, ny0, 1, 0,
            nx0, ny1, 0, 1,
            nx0, ny1, 0, 1,
            nx1, ny0, 1, 0,
            nx1, ny1, 1, 1
          ]);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texEntry.texture);
          gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          drawn += 1;
        }
        this.frameWebglSpriteEligible = candidates.length;
        this.frameWebglSpriteDrawCalls = drawn;
        this.frameWebglSpriteQuads = drawn;
        this.frameWebglSpriteDrawMs += nowMs() - start;
        return drawn > 0;
      } catch (err) {
        this.metrics.webglSpriteLastError = `draw:${err?.message || err}`;
        this.frameWebglSpriteFallbacks += candidates.length || 1;
        return false;
      }
    }

    webglTerrainTextureKey(candidate) {
      const built = Math.floor(Number(candidate?.builtAt || 0) || 0);
      const width = Number(candidate?.canvas?.width || 0) || 0;
      const height = Number(candidate?.canvas?.height || 0) || 0;
      return `${candidate?.zoneKey || 'zone'}:${candidate?.chunkX || 0}:${candidate?.chunkY || 0}:${candidate?.kind || 'surface'}:${candidate?.elev || 0}:${width}x${height}:${built}`;
    }

    trimWebglTerrainTextureCache() {
      const cfg = this.refreshConfig();
      const limit = Math.max(32, Math.floor(Number(cfg.webglTerrainTextureCacheMaxEntries || 384) || 384));
      if (!this.webglTerrainTextureCache || this.webglTerrainTextureCache.size <= limit) return;
      const entries = Array.from(this.webglTerrainTextureCache.entries()).sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
      const removeCount = Math.max(0, this.webglTerrainTextureCache.size - limit);
      const gl = this.webglPrototypeContext;
      for (let i = 0; i < removeCount && i < entries.length; i++) {
        const [key, entry] = entries[i];
        try { if (entry.texture && gl) gl.deleteTexture(entry.texture); } catch (_err) {}
        this.webglTerrainTextureCache.delete(key);
        this.metrics.webglTerrainTextureEvictions += 1;
      }
    }

    textureForTerrainCandidate(candidate) {
      const gl = this.webglPrototypeContext;
      const canvas = candidate?.canvas;
      if (!gl || !canvas) return null;
      const key = this.webglTerrainTextureKey(candidate);
      let texEntry = this.webglTerrainTextureCache.get(key);
      const width = Number(canvas.width || 0) || 0;
      const height = Number(canvas.height || 0) || 0;
      if (texEntry && texEntry.width === width && texEntry.height === height) {
        texEntry.lastUsed = this.frameId;
        return texEntry;
      }
      const cfg = this.refreshConfig();
      const maxUploads = Math.max(0, Math.floor(Number(cfg.webglTerrainMaxUploadsPerFrame || 18) || 18));
      if (this.frameWebglTerrainUploads >= maxUploads) {
        this.frameWebglTerrainFallbacks += 1;
        return null;
      }
      const start = nowMs();
      try {
        const texture = texEntry?.texture || gl.createTexture();
        if (!texture) return null;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        texEntry = { texture, width, height, lastUsed: this.frameId, uploads: (texEntry?.uploads || 0) + 1 };
        this.webglTerrainTextureCache.set(key, texEntry);
        this.frameWebglTerrainUploads += 1;
        this.frameWebglTerrainUploadMs += nowMs() - start;
        this.trimWebglTerrainTextureCache();
        return texEntry;
      } catch (err) {
        this.metrics.webglTerrainLastError = `terrain-upload:${err?.message || err}`;
        this.frameWebglTerrainFallbacks += 1;
        return null;
      }
    }

    collectWebglTerrainCandidates(payload = {}) {
      const cfg = this.refreshConfig();
      const maxCandidates = Math.max(32, Math.floor(Number(cfg.webglTerrainMaxCandidates || 192) || 192));
      const visibleChunks = Array.isArray(payload.visibleChunks) ? payload.visibleChunks : [];
      const candidates = [];
      const zoneKey = String(payload.zoneKey || this.game?.terrainChunkZoneKey?.() || 'zone');
      for (const entry of visibleChunks) {
        if (!entry?.chunk || candidates.length >= maxCandidates) break;
        const chunk = entry.chunk;
        const pushLayer = (kind, layer) => {
          if (!layer?.canvas || candidates.length >= maxCandidates) return;
          candidates.push({
            kind, zoneKey, chunkX: chunk.chunkX, chunkY: chunk.chunkY,
            elev: Number(layer.elev || 0), builtAt: chunk.builtAt || 0, canvas: layer.canvas, chunk,
            cropX: entry.cropX, cropY: entry.cropY, cropW: entry.cropW, cropH: entry.cropH
          });
        };
        for (const layer of chunk.sortedWaterLayers || []) {
          pushLayer('water', layer);
          if (layer.shimmerCanvas) pushLayer('water-shimmer', { ...layer, canvas: layer.shimmerCanvas });
        }
        for (const layer of chunk.sortedLayers || []) pushLayer('ground', layer);
        for (const layer of chunk.sortedShoreLayers || []) pushLayer('shore', layer);
      }
      this.frameWebglTerrainCandidates = candidates.length;
      return candidates;
    }

    initWebglTerrainPipeline() {
      const ready = this.initWebglSpritePipeline();
      this.metrics.webglTerrainProgramReady = ready;
      return ready;
    }

    drawWebglTerrainPrototype(payload = {}) {
      if (!this.webglTerrainPrototypeActive()) return false;
      if (this.webglVisibleTerrainLayerActive?.()) return this.drawWebglVisibleTerrainLayer(payload);
      if (this.webglScenePreviewActive?.()) return this.drawWebglScenePreview(payload);
      if (!this.initWebglTerrainPipeline()) return false;
      const candidates = this.collectWebglTerrainCandidates(payload);
      if (!candidates.length) return false;
      const gl = this.webglPrototypeContext;
      const canvas = this.webglPrototypeCanvas;
      const cfg = this.refreshConfig();
      const maxDraws = Math.max(0, Math.floor(Number(cfg.webglTerrainMaxDrawsPerFrame || 128) || 128));
      const width = Math.max(16, Math.min(2048, Math.floor((this.game?.canvas?.width || window.innerWidth || 256) / 2)));
      const height = Math.max(16, Math.min(2048, Math.floor((this.game?.canvas?.height || window.innerHeight || 256) / 2)));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const start = nowMs();
      try {
        gl.viewport(0, 0, width, height);
        gl.useProgram(this.webglSpriteProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.webglSpriteVertexBuffer);
        const posLoc = this.webglSpriteAttribs.position;
        const uvLoc = this.webglSpriteAttribs.texcoord;
        if (posLoc >= 0) { gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0); }
        if (uvLoc >= 0) { gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8); }
        let drawn = 0;
        const colCount = Math.max(1, Math.floor(Math.sqrt(maxDraws)) || 8);
        const rowCount = Math.ceil(Math.max(1, maxDraws) / colCount);
        const cellW = width / colCount;
        const cellH = height / rowCount;
        for (let i = 0; i < candidates.length && drawn < maxDraws; i++) {
          const cand = candidates[i];
          const texEntry = this.textureForTerrainCandidate(cand);
          if (!texEntry?.texture) continue;
          const col = drawn % colCount;
          const row = Math.floor(drawn / colCount);
          const pad = 1;
          const x0 = col * cellW + pad;
          const y0 = row * cellH + pad;
          const x1 = Math.min(width, x0 + cellW - pad * 2);
          const y1 = Math.min(height, y0 + cellH - pad * 2);
          const nx0 = x0 / width * 2 - 1;
          const nx1 = x1 / width * 2 - 1;
          const ny0 = 1 - y0 / height * 2;
          const ny1 = 1 - y1 / height * 2;
          const verts = new Float32Array([nx0,ny0,0,0, nx1,ny0,1,0, nx0,ny1,0,1, nx0,ny1,0,1, nx1,ny0,1,0, nx1,ny1,1,1]);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texEntry.texture);
          gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          drawn += 1;
        }
        this.frameWebglTerrainDrawCalls = drawn;
        this.frameWebglTerrainQuads = drawn;
        this.frameWebglTerrainDrawMs += nowMs() - start;
        return drawn > 0;
      } catch (err) {
        this.metrics.webglTerrainLastError = `terrain-draw:${err?.message || err}`;
        this.frameWebglTerrainFallbacks += candidates.length || 1;
        return false;
      }
    }

    getCacheLimit() {
      const cfg = this.refreshConfig();
      return Math.max(4, Math.floor(Number(cfg.screenOverlayCacheMaxEntries || 24) || 24));
    }

    getOverlayCanvas(key, width, height, painter) {
      const cfg = this.refreshConfig();
      if (cfg.enableScreenOverlayCache === false) return null;
      const existing = this.overlayCache.get(key);
      if (existing) {
        existing.usedFrame = this.frameId;
        this.metrics.overlayCacheHits += 1;
        return existing.canvas;
      }
      const start = nowMs();
      const canvas = createScratchCanvas(width, height, cfg.preferOffscreenOverlayCache !== false);
      resizeScratchCanvas(canvas, width, height);
      const overlayCtx = canvas.getContext?.('2d');
      if (!overlayCtx) return null;
      painter(overlayCtx, canvas.width, canvas.height);
      this.overlayCache.set(key, { key, canvas, usedFrame: this.frameId });
      this.metrics.overlayCacheMisses += 1;
      this.metrics.overlayCacheBuildMs += nowMs() - start;
      this.trimOverlayCache();
      return canvas;
    }

    trimOverlayCache() {
      const limit = this.getCacheLimit();
      if (this.overlayCache.size <= limit) return;
      const entries = Array.from(this.overlayCache.values()).sort((a, b) => (a.usedFrame || 0) - (b.usedFrame || 0));
      const removeCount = Math.max(0, this.overlayCache.size - limit);
      for (let i = 0; i < removeCount; i++) {
        this.overlayCache.delete(entries[i].key);
        this.metrics.overlayCacheEvictions += 1;
      }
    }

    drawCachedCanvas(context, canvas) {
      if (!context || !canvas) return false;
      try {
        context.drawImage(canvas, 0, 0);
        this.frameOverlayDraws += 1;
        this.metrics.overlayCacheDraws += 1;
        return true;
      } catch (_err) {
        return false;
      }
    }


    classifyRenderableBatchKind(renderable) {
      if (!renderable) return 'unknown';
      if (renderable.kind === 'object') return 'object';
      if (renderable.kind === 'entity') return 'entity';
      if (renderable.kind === 'effect') return 'effect';
      if (renderable.kind === 'damage') return 'damage';
      if (renderable.kind === 'caveOccluder') return 'occluder';
      return String(renderable.kind || 'unknown');
    }

    prepareFrameBatches(payload = {}) {
      const cfg = this.refreshConfig();
      if (cfg.enableHybridBatchPreparation === false) return false;
      const start = nowMs();
      const world = Array.isArray(payload.worldRenderables) ? payload.worldRenderables : [];
      const terrainCount = (Array.isArray(payload.waterDepthRenderables) ? payload.waterDepthRenderables.length : 0)
        + (Array.isArray(payload.terrainDepthRenderables) ? payload.terrainDepthRenderables.length : 0)
        + (Array.isArray(payload.tileRenderables) ? payload.tileRenderables.length : 0);
      const maxItems = Math.max(256, Math.floor(finiteNumber(cfg.hybridBatchMaxItems, 4096)));
      const scratch = this.batchScratch || (this.batchScratch = []);
      scratch.length = 0;
      let objects = 0;
      let entities = 0;
      let effects = 0;
      let damage = 0;
      let drawable = 0;
      const limit = Math.min(world.length, maxItems);
      for (let i = 0; i < limit; i++) {
        const r = world[i];
        const kind = this.classifyRenderableBatchKind(r);
        if (kind === 'object') objects += 1;
        else if (kind === 'entity') entities += 1;
        else if (kind === 'effect') effects += 1;
        else if (kind === 'damage') damage += 1;
        if (kind === 'object' || kind === 'entity' || kind === 'effect') drawable += 1;
        const item = scratch[i] || (scratch[i] = {});
        item.kind = kind;
        item.depth = finiteNumber(r?.depth, 0);
        item.x = finiteNumber(r?.x ?? r?.entity?.x ?? r?.effect?.x ?? r?.damage?.x, 0);
        item.y = finiteNumber(r?.y ?? r?.entity?.y ?? r?.effect?.y ?? r?.damage?.y, 0);
        item.ref = r?.entity || r?.obj || r?.effect || r?.damage || null;
      }
      this.frameTerrainBatchCount = terrainCount;
      this.frameWorldBatchCount = world.length;
      this.frameObjectBatchCount = objects;
      this.frameEntityBatchCount = entities;
      this.frameEffectBatchCount = effects;
      this.frameDamageBatchCount = damage;
      this.frameSpriteBatchCount = terrainCount + drawable;
      this.frameBatchOverflow = Math.max(0, world.length - maxItems);
      this.frameBatchBuildMs += nowMs() - start;
      this.frameBatchDrawablePct = world.length > 0 ? Math.round((drawable / world.length) * 1000) / 10 : 0;
      this.metrics.backendBatchFrames += 1;
      if (this.webglSpritePrototypeActive()) {
        const candidates = this.collectWebglSpriteCandidates(world, payload.projection || null);
        if (this.webglScenePreviewActive?.()) {
          const pending = this.pendingWebglSceneSpriteCandidates || (this.pendingWebglSceneSpriteCandidates = []);
          pending.length = 0;
          for (let i = 0; i < candidates.length; i++) pending.push(candidates[i]);
        } else {
          this.drawWebglSpritePrototype(candidates);
        }
      }
      this.updateHybridCameraDepthAudit?.(payload);
      this.metrics.activeBackend = this.activeBackendLabel?.() || (this.isHybridRendererMode?.() ? 'canvas2d+webgl-prototypes' : 'canvas2d');
      return true;
    }

    drawCachedDistantCanopy(context, light) {
      const cfg = this.refreshConfig();
      if (cfg.enableCachedCanopyOverlay === false) return false;
      const w = window.innerWidth || context?.canvas?.width || 1;
      const h = window.innerHeight || context?.canvas?.height || 1;
      const alpha = finiteNumber(light?.canopyAlpha, 0.34);
      const alphaBucket = Math.round(alpha * 100);
      const far = String(light?.canopyFar || '#18321f');
      const near = String(light?.canopyNear || '#1d3d27');
      const bucketSize = Math.max(4, Math.floor(finiteNumber(cfg.canopyOverlayCachePixelBucket, 10)));
      const drift = ((nowMs() * 0.00008 * 900) % 180) - 90;
      const driftBucket = Math.round(drift / bucketSize);
      const key = `canopy:${w}x${h}:a${alphaBucket}:d${driftBucket}:f${far}:n${near}`;
      const canvas = this.getOverlayCanvas(key, w, h, (c, cw, ch) => {
        const cachedDrift = driftBucket * bucketSize;
        c.clearRect(0, 0, cw, ch);
        c.globalAlpha = alphaBucket / 100;
        for (let row = 0; row < 4; row++) {
          const y = 70 + row * 42;
          const scale = 0.72 + row * 0.18;
          const offset = ((cachedDrift + row * 143) % 180) - 90;
          c.fillStyle = row % 2 ? far : near;
          for (let i = -2; i < Math.ceil(cw / 110) + 3; i++) {
            const x = i * 110 + offset * (0.3 + row * 0.12);
            fillPolyPath(c, [
              { x: x - 46 * scale, y: y + 22 * scale },
              { x: x - 22 * scale, y: y - 30 * scale },
              { x: x + 4 * scale, y: y + 3 * scale },
              { x: x + 33 * scale, y: y - 36 * scale },
              { x: x + 62 * scale, y: y + 22 * scale }
            ]);
          }
        }
        c.globalAlpha = 1;
      });
      return this.drawCachedCanvas(context, canvas);
    }

    drawCachedSunShafts(context, light) {
      const cfg = this.refreshConfig();
      if (cfg.enableCachedSunShaftOverlay === false) return false;
      const shaftStrength = finiteNumber(light?.sunShaftAlpha, 1);
      if (shaftStrength <= 0.015) return true;
      const w = window.innerWidth || context?.canvas?.width || 1;
      const h = window.innerHeight || context?.canvas?.height || 1;
      const phase = String(light?.phaseKey || 'day');
      const strengthBucket = Math.round(shaftStrength * 100);
      const bucketSize = Math.max(6, Math.floor(finiteNumber(cfg.sunShaftCachePixelBucket, 14)));
      const drift = Math.sin(nowMs() * 0.001 * 0.25) * 42;
      const driftBucket = Math.round(drift / bucketSize);
      const key = `sunshafts:${w}x${h}:p${phase}:s${strengthBucket}:d${driftBucket}:${light?.sunShaftTint || '#ede0a7'}`;
      const canvas = this.getOverlayCanvas(key, w, h, (c, cw, ch) => {
        const cachedDrift = driftBucket * bucketSize;
        const cachedStrength = strengthBucket / 100;
        const warmMid = phase === 'dusk' ? 'rgba(214,142,96,0.28)' : (phase === 'dawn' ? 'rgba(236,186,118,0.30)' : 'rgba(206,196,138,0.26)');
        c.clearRect(0, 0, cw, ch);
        c.globalCompositeOperation = 'screen';
        for (let i = 0; i < 5; i++) {
          const hash = ((Math.sin(i * 77.17 + 9110) * 43758.5453) % 1 + 1) % 1;
          const width = 72 + hash * 58;
          const opacity = (0.035 + hash * 0.032) * cachedStrength;
          const x = 40 + i * 245 + cachedDrift;
          const grad = c.createLinearGradient(x, 0, x + 330, ch);
          grad.addColorStop(0, phase === 'dusk' ? 'rgba(240,177,120,0.60)' : (phase === 'dawn' ? 'rgba(255,228,164,0.60)' : 'rgba(237,224,167,0.62)'));
          grad.addColorStop(0.46, warmMid);
          grad.addColorStop(1, 'rgba(108,96,64,0)');
          c.globalAlpha = opacity;
          c.fillStyle = grad;
          fillPolyPath(c, [
            { x: x, y: 0 },
            { x: x + width, y: 0 },
            { x: x + 380 + width * 0.4, y: ch },
            { x: x + 235, y: ch }
          ]);
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      });
      return this.drawCachedCanvas(context, canvas);
    }


    drawCachedVignette(context, light) {
      const w = window.innerWidth || context?.canvas?.width || 1;
      const h = window.innerHeight || context?.canvas?.height || 1;
      const outer = Math.max(0.34, Math.min(0.74, Number(light?.vignetteAlpha) || 0.46));
      const mid = Math.max(0.10, Math.min(0.34, outer * 0.28));
      const outerBucket = Math.round(outer * 100);
      const midBucket = Math.round(mid * 100);
      const key = `vignette:${w}x${h}:o${outerBucket}:m${midBucket}`;
      const canvas = this.getOverlayCanvas(key, w, h, (c, cw, ch) => {
        const cachedOuter = outerBucket / 100;
        const cachedMid = midBucket / 100;
        const grad = c.createRadialGradient(
          cw / 2, ch / 2, Math.min(cw, ch) * 0.28,
          cw / 2, ch / 2, Math.max(cw, ch) * 0.78
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.72, `rgba(0,0,0,${cachedMid.toFixed(3)})`);
        grad.addColorStop(1, `rgba(0,0,0,${cachedOuter.toFixed(3)})`);
        c.clearRect(0, 0, cw, ch);
        c.fillStyle = grad;
        c.fillRect(0, 0, cw, ch);
      });
      return this.drawCachedCanvas(context, canvas);
    }

    drawCachedLightTransition(context, light) {
      const transition = clamp01(light?.transition || 0);
      if (transition <= 0.02) return false;
      const w = window.innerWidth || context?.canvas?.width || 1;
      const h = window.innerHeight || context?.canvas?.height || 1;
      const transitionBucket = Math.round(transition * 50);
      const warm = String(light?.sunShaftTint || '#f0b178');
      const cool = '#6a4bff';
      const key = `light-transition:${w}x${h}:t${transitionBucket}:${warm}:${cool}`;
      const canvas = this.getOverlayCanvas(key, w, h, (c, cw, ch) => {
        const cachedTransition = transitionBucket / 50;
        const glow = c.createLinearGradient(0, 0, cw, ch);
        glow.addColorStop(0, rgbaFromHex(warm, 0.05 * cachedTransition));
        glow.addColorStop(0.55, 'rgba(0,0,0,0)');
        glow.addColorStop(1, rgbaFromHex(cool, 0.035 * cachedTransition));
        c.clearRect(0, 0, cw, ch);
        c.fillStyle = glow;
        c.fillRect(0, 0, cw, ch);
      });
      if (!canvas) return false;
      context.save();
      context.globalCompositeOperation = 'screen';
      const ok = this.drawCachedCanvas(context, canvas);
      context.restore();
      return ok;
    }
  }

  function install(Game) {
    if (!Game || !Game.prototype) return;

    Game.prototype.ensureRenderBackendSystem = function() {
      if (!this.renderBackendSystem) {
        this.renderBackendSystem = new HybridRenderBackendSystem(this);
        this.renderBackendSystem.syncPerfStats();
      }
      return this.renderBackendSystem;
    };

    const originalRender = Game.prototype.render;
    if (typeof originalRender === 'function' && !originalRender.__drBackendWrapped) {
      const wrapped = function(...args) {
        const backend = this.ensureRenderBackendSystem?.();
        backend?.beginFrame?.();
        try {
          return originalRender.apply(this, args);
        } finally {
          try {
            const context = window.DreamRealms?.runtime?.ctx || null;
            backend?.drawVisibleScenePreviewOverlay?.(context);
          } catch (_err) {}
          backend?.endFrame?.();
        }
      };
      wrapped.__drBackendWrapped = true;
      Game.prototype.render = wrapped;
    }

    const originalDrawVignette = Game.prototype.drawVignette;
    if (typeof originalDrawVignette === 'function' && !originalDrawVignette.__drBackendWrapped) {
      const wrappedVignette = function(...args) {
        const DRRuntime = window.DreamRealms?.runtime || {};
        const context = DRRuntime.ctx;
        const backend = this.ensureRenderBackendSystem?.();
        const cfg = this.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
        if (context && backend && cfg.enableScreenOverlayCache !== false) {
          const light = this.getWorldLightState?.() || {};
          if (backend.drawCachedVignette(context, light)) return;
        }
        return originalDrawVignette.apply(this, args);
      };
      wrappedVignette.__drBackendWrapped = true;
      Game.prototype.drawVignette = wrappedVignette;
    }

    const originalLightOverlay = Game.prototype.drawWorldLightOverlay;
    if (typeof originalLightOverlay === 'function' && !originalLightOverlay.__drBackendWrapped) {
      const wrappedLightOverlay = function(context, ...rest) {
        const light = this.getWorldLightState?.();
        const cfg = this.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
        if (!light || !context || cfg.enableScreenOverlayCache === false) return originalLightOverlay.call(this, context, ...rest);

        const darkness = Math.max(0, Math.min(0.72, Number(light.worldDarkness || 0)));
        if (darkness > 0.015) {
          context.save();
          context.globalCompositeOperation = 'multiply';
          context.fillStyle = `rgba(20,30,56,${darkness.toFixed(3)})`;
          context.fillRect(0, 0, window.innerWidth, window.innerHeight);
          context.restore();
        }

        if (light.transition > 0.02 && this.currentZone !== 'cave' && this.currentZone !== 'dungeon') {
          const backend = this.ensureRenderBackendSystem?.();
          if (backend && backend.drawCachedLightTransition(context, light)) return;

          // Direct fallback for the transition gradient only; do not call the original
          // implementation here because the darkness multiply pass was already drawn.
          context.save();
          context.globalCompositeOperation = 'screen';
          const glow = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
          glow.addColorStop(0, rgbaFromHex(light.sunShaftTint || '#f0b178', 0.05 * light.transition));
          glow.addColorStop(0.55, 'rgba(0,0,0,0)');
          glow.addColorStop(1, rgbaFromHex('#6a4bff', 0.035 * light.transition));
          context.fillStyle = glow;
          context.fillRect(0, 0, window.innerWidth, window.innerHeight);
          context.restore();
        }
        return true;
      };
      wrappedLightOverlay.__drBackendWrapped = true;
      Game.prototype.drawWorldLightOverlay = wrappedLightOverlay;
    }


    Game.prototype.prepareHybridRenderBatch = function(payload) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.prepareFrameBatches?.(payload) === true;
    };

    Game.prototype.prepareHybridTerrainBatch = function(payload) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.drawWebglTerrainPrototype?.(payload) === true;
    };

    const originalDistantCanopy = Game.prototype.drawDistantCanopy;
    if (typeof originalDistantCanopy === 'function' && !originalDistantCanopy.__drBackendWrapped) {
      const wrappedDistantCanopy = function(...args) {
        const DRRuntime = window.DreamRealms?.runtime || {};
        const context = DRRuntime.ctx;
        const backend = this.ensureRenderBackendSystem?.();
        const cfg = this.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
        if (context && backend && cfg.enableScreenOverlayCache !== false && cfg.enableCachedCanopyOverlay !== false) {
          const light = this.getWorldLightState?.() || {};
          if (backend.drawCachedDistantCanopy(context, light)) return;
        }
        return originalDistantCanopy.apply(this, args);
      };
      wrappedDistantCanopy.__drBackendWrapped = true;
      Game.prototype.drawDistantCanopy = wrappedDistantCanopy;
    }

    const originalSunShafts = Game.prototype.drawSunShafts;
    if (typeof originalSunShafts === 'function' && !originalSunShafts.__drBackendWrapped) {
      const wrappedSunShafts = function(...args) {
        const DRRuntime = window.DreamRealms?.runtime || {};
        const context = DRRuntime.ctx;
        const backend = this.ensureRenderBackendSystem?.();
        const cfg = this.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {};
        if (context && backend && cfg.enableScreenOverlayCache !== false && cfg.enableCachedSunShaftOverlay !== false) {
          const light = this.getWorldLightState?.() || {};
          if (backend.drawCachedSunShafts(context, light)) return;
        }
        return originalSunShafts.apply(this, args);
      };
      wrappedSunShafts.__drBackendWrapped = true;
      Game.prototype.drawSunShafts = wrappedSunShafts;
    }


    Game.prototype.setRenderBackendMode = function(mode, options = {}) {
      const backend = this.ensureRenderBackendSystem?.();
      const changed = backend?.setRendererMode?.(mode, options.reason || 'settings', options) || false;
      backend?.syncPerfStats?.();
      if (changed) {
        this.logSystem?.(`Renderer backend: ${backend?.rendererModeLabel?.(backend.rendererMode) || (mode === 'hybrid-webgl-prototype' ? 'Hybrid WebGL Prototype' : 'Canvas 2D Stable')}.`);
      } else if (backend?.metrics?.renderBackendModeDenied) {
        this.logSystem?.(`Renderer backend request denied: ${backend.metrics.renderBackendModeDeniedReason || 'unavailable'}.`);
      }
      this.renderSettingsPanel?.();
      this.markUiDirty?.('renderer backend mode');
      return changed;
    };

    Game.prototype.toggleRenderBackendMode = function() {
      const backend = this.ensureRenderBackendSystem?.();
      const before = backend?.rendererMode || 'canvas2d';
      const next = backend?.toggleRendererMode?.() || 'canvas2d';
      backend?.syncPerfStats?.();
      if (backend?.metrics?.renderBackendModeDenied && before === next) this.logSystem?.(`Renderer backend request denied: ${backend.metrics.renderBackendModeDeniedReason || 'unavailable'}.`);
      else this.logSystem?.(`Renderer backend: ${backend?.rendererModeLabel?.(next) || (next === 'hybrid-webgl-prototype' ? 'Hybrid WebGL Prototype' : 'Canvas 2D Stable')}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('renderer backend mode');
      return next;
    };

    Game.prototype.getRenderBackendMode = function() {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.rendererMode || 'canvas2d';
    };

    Game.prototype.toggleWebglVisibleTerrainLayer = function() {
      const backend = this.ensureRenderBackendSystem?.();
      const enabled = backend?.toggleWebglVisibleTerrainLayer?.() || false;
      backend?.syncPerfStats?.();
      this.logSystem?.(`Visible WebGL terrain layer: ${enabled ? 'On' : 'Off'}. Actors, effects, and UI remain Canvas-rendered.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible terrain layer');
      return enabled;
    };

    Game.prototype.setWebglVisibleTerrainLayer = function(enabled) {
      const backend = this.ensureRenderBackendSystem?.();
      const next = backend?.setWebglVisibleTerrainLayer?.(!!enabled) || false;
      backend?.syncPerfStats?.();
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible terrain layer');
      return next;
    };

    Game.prototype.isWebglTerrainLayerPromoted = function() {
      const backend = this.ensureRenderBackendSystem?.();
      return !!(backend?.metrics?.webglVisibleTerrainLayerPromotedThisFrame && backend?.webglVisibleTerrainLayerActive?.());
    };

    Game.prototype.toggleWebglVisibleSpriteLayer = function() {
      const backend = this.ensureRenderBackendSystem?.();
      const enabled = backend?.toggleWebglVisibleSpriteLayer?.() || false;
      backend?.syncPerfStats?.();
      this.logSystem?.(`Visible WebGL sprite layer: ${enabled ? 'On' : 'Off'}. Dynamic effects, nameplates, and UI remain Canvas-rendered.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible sprite layer');
      return enabled;
    };

    Game.prototype.setWebglVisibleSpriteLayer = function(enabled) {
      const backend = this.ensureRenderBackendSystem?.();
      const next = backend?.setWebglVisibleSpriteLayer?.(!!enabled) || false;
      backend?.syncPerfStats?.();
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible sprite layer');
      return next;
    };

    Game.prototype.isWebglSpriteLayerPromoted = function() {
      const backend = this.ensureRenderBackendSystem?.();
      return !!(backend?.metrics?.webglVisibleSpriteLayerPromotedThisFrame && backend?.webglVisibleSpriteLayerActive?.());
    };

    Game.prototype.flushWebglVisibleSpriteLayer = function(context) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.flushWebglVisibleSpriteLayer?.(context || window.DreamRealms?.runtime?.ctx || this.ctx) === true;
    };

    Game.prototype.tryQueueWebglVisibleSpriteRenderable = function(renderable) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.queueWebglVisibleSpriteRenderable?.(renderable) === true;
    };

    Game.prototype.toggleWebglVisibleEffectLayer = function() {
      const backend = this.ensureRenderBackendSystem?.();
      const enabled = backend?.toggleWebglVisibleEffectLayer?.() || false;
      backend?.syncPerfStats?.();
      this.logSystem?.(`Visible WebGL effect layer: ${enabled ? 'On' : 'Off'}. Unsupported effects and UI remain Canvas-rendered.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible effect layer');
      return enabled;
    };

    Game.prototype.setWebglVisibleEffectLayer = function(enabled) {
      const backend = this.ensureRenderBackendSystem?.();
      const next = backend?.setWebglVisibleEffectLayer?.(!!enabled) || false;
      backend?.syncPerfStats?.();
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible effect layer');
      return next;
    };

    Game.prototype.isWebglEffectLayerPromoted = function() {
      const backend = this.ensureRenderBackendSystem?.();
      return !!(backend?.metrics?.webglVisibleEffectLayerPromotedThisFrame && backend?.webglVisibleEffectLayerActive?.());
    };

    Game.prototype.flushWebglVisibleEffectLayer = function(context) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.flushWebglVisibleEffectLayer?.(context || window.DreamRealms?.runtime?.ctx || this.ctx) === true;
    };

    Game.prototype.tryQueueWebglVisibleEffectRenderable = function(renderable) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.queueWebglVisibleEffectRenderable?.(renderable) === true;
    };


    Game.prototype.toggleWebglVisibleDamageTextLayer = function() {
      const backend = this.ensureRenderBackendSystem?.();
      const enabled = backend?.toggleWebglVisibleDamageTextLayer?.() || false;
      backend?.syncPerfStats?.();
      this.logSystem?.(`Visible WebGL damage text layer: ${enabled ? 'On' : 'Off'}. Health bars, nameplates, and UI remain Canvas-rendered.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible damage text layer');
      return enabled;
    };

    Game.prototype.setWebglVisibleDamageTextLayer = function(enabled) {
      const backend = this.ensureRenderBackendSystem?.();
      const next = backend?.setWebglVisibleDamageTextLayer?.(!!enabled) || false;
      backend?.syncPerfStats?.();
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl visible damage text layer');
      return next;
    };

    Game.prototype.isWebglDamageTextLayerPromoted = function() {
      const backend = this.ensureRenderBackendSystem?.();
      return !!(backend?.metrics?.webglVisibleDamageTextLayerPromotedThisFrame && backend?.webglVisibleDamageTextLayerActive?.());
    };

    Game.prototype.flushWebglVisibleDamageTextLayer = function(context) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.flushWebglVisibleDamageTextLayer?.(context || window.DreamRealms?.runtime?.ctx || this.ctx) === true;
    };

    Game.prototype.tryQueueWebglVisibleDamageTextRenderable = function(renderable) {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.queueWebglVisibleDamageTextRenderable?.(renderable) === true;
    };

    Game.prototype.toggleWebglScenePreviewOverlay = function() {
      const backend = this.ensureRenderBackendSystem?.();
      const enabled = backend?.toggleWebglScenePreviewOverlay?.() || false;
      backend?.syncPerfStats?.();
      this.logSystem?.(`WebGL scene preview overlay: ${enabled ? 'On' : 'Off'}. Canvas renderer remains active.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl scene preview overlay');
      return enabled;
    };

    Game.prototype.setWebglScenePreviewOverlay = function(enabled) {
      const backend = this.ensureRenderBackendSystem?.();
      const next = backend?.setWebglScenePreviewOverlay?.(!!enabled) || false;
      backend?.syncPerfStats?.();
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl scene preview overlay');
      return next;
    };

    Game.prototype.toggleWebglScenePreviewLayer = function(layer) {
      const backend = this.ensureRenderBackendSystem?.();
      const enabled = backend?.toggleWebglScenePreviewLayer?.(layer) || false;
      backend?.syncPerfStats?.();
      this.logSystem?.(`WebGL scene preview ${layer} layer: ${enabled ? 'On' : 'Off'}.`);
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl scene preview layer');
      return enabled;
    };

    Game.prototype.setWebglScenePreviewLayer = function(layer, enabled) {
      const backend = this.ensureRenderBackendSystem?.();
      const next = backend?.setWebglScenePreviewLayer?.(layer, !!enabled) || false;
      backend?.syncPerfStats?.();
      this.renderSettingsPanel?.();
      this.markUiDirty?.('webgl scene preview layer');
      return next;
    };

    Game.prototype.getRenderBackendSnapshot = function() {
      const backend = this.ensureRenderBackendSystem?.();
      return backend?.metrics ? { ...backend.metrics } : null;
    };
  }

  DR.RenderBackendSystem = { install, HybridRenderBackendSystem };
})();
