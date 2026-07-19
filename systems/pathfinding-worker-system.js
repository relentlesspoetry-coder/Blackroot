// Dream Realms async pathfinding worker system
// V0.15.09: moves high-volume actor A* requests off the browser main thread when available.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const WORKER_SOURCE = `
    'use strict';
    let grid = null;
    let gridVersion = 0;

    function hypot(dx, dy) { return Math.sqrt(dx * dx + dy * dy); }
    function encode(x, y, size) { return y * size + x; }

    class MinHeap {
      constructor() { this.items = []; }
      less(a, b) { return a.f < b.f || (a.f === b.f && a.g > b.g); }
      push(node) {
        const items = this.items;
        items.push(node);
        let i = items.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (!this.less(items[i], items[p])) break;
          const tmp = items[i]; items[i] = items[p]; items[p] = tmp;
          i = p;
        }
      }
      pop() {
        const items = this.items;
        const first = items[0];
        const last = items.pop();
        if (items.length && last) {
          items[0] = last;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1;
            const r = l + 1;
            let b = i;
            if (l < items.length && this.less(items[l], items[b])) b = l;
            if (r < items.length && this.less(items[r], items[b])) b = r;
            if (b === i) break;
            const tmp = items[i]; items[i] = items[b]; items[b] = tmp;
            i = b;
          }
        }
        return first;
      }
      get length() { return this.items.length; }
    }

    function blocked(x, y, size, cells) {
      if (x < 0 || y < 0 || x >= size || y >= size) return true;
      return cells[encode(x, y, size)] !== 0;
    }

    function reconstruct(came, walkKey, size, sx, sy, maxNodes) {
      const out = [];
      let guard = 0;
      while (walkKey != null && guard++ < maxNodes) {
        const px = walkKey % size;
        const py = Math.floor(walkKey / size);
        out.push({ x: px + 0.5, y: py + 0.5 });
        walkKey = came.get(walkKey);
      }
      out.reverse();
      if (out.length && Math.floor(out[0].x) === sx && Math.floor(out[0].y) === sy) out.shift();
      return out;
    }

    function findPath(job) {
      if (!grid || !grid.cells || grid.version !== job.gridVersion) {
        return { ok: false, path: [], inspected: 0, reason: 'grid-not-ready' };
      }
      const size = grid.size;
      const cells = grid.cells;
      const sx = Math.floor(Number(job.startX));
      const sy = Math.floor(Number(job.startY));
      const ex = Math.floor(Number(job.endX));
      const ey = Math.floor(Number(job.endY));
      const maxNodes = Math.max(80, Math.min(3200, Math.floor(Number(job.maxNodes) || 720)));
      const maxRange = Math.max(6, Math.min(96, Math.floor(Number(job.maxRange) || 28)));
      const allowPartialPath = job.allowPartialPath === true;

      if (sx < 0 || sy < 0 || sx >= size || sy >= size || blocked(sx, sy, size, cells)) {
        return { ok: false, path: [], inspected: 0, reason: 'bad-start' };
      }
      if (ex < 0 || ey < 0 || ex >= size || ey >= size) {
        return { ok: false, path: [], inspected: 0, reason: 'bad-end' };
      }
      const dxTotal = ex - sx;
      const dyTotal = ey - sy;
      if (hypot(dxTotal, dyTotal) > maxRange && !allowPartialPath) {
        return { ok: false, path: [], inspected: 0, reason: 'out-of-range' };
      }
      if (blocked(ex, ey, size, cells) && !allowPartialPath) {
        return { ok: false, path: [], inspected: 0, reason: 'blocked-end' };
      }

      const startKey = encode(sx, sy, size);
      const endKey = encode(ex, ey, size);
      const came = new Map();
      const best = new Map([[startKey, 0]]);
      const closed = new Set();
      const open = new MinHeap();
      open.push({ x: sx, y: sy, g: 0, f: hypot(dxTotal, dyTotal), key: startKey });
      const dirs = [
        [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
        [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]
      ];
      let inspected = 0;
      let bestPartialKey = startKey;
      let bestPartialScore = hypot(dxTotal, dyTotal);

      while (open.length && inspected++ < maxNodes) {
        const cur = open.pop();
        if (!cur || closed.has(cur.key)) continue;
        closed.add(cur.key);
        const partialScore = hypot(ex - cur.x, ey - cur.y) + cur.g * 0.035;
        if (partialScore < bestPartialScore) {
          bestPartialScore = partialScore;
          bestPartialKey = cur.key;
        }
        if (cur.key === endKey) {
          return { ok: true, path: reconstruct(came, cur.key, size, sx, sy, maxNodes), inspected, reason: 'complete' };
        }
        for (let i = 0; i < dirs.length; i++) {
          const dir = dirs[i];
          const nx = cur.x + dir[0];
          const ny = cur.y + dir[1];
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          if (hypot(nx - sx, ny - sy) > maxRange + 1) continue;
          if (blocked(nx, ny, size, cells)) continue;
          if (dir[0] !== 0 && dir[1] !== 0 && (blocked(cur.x + dir[0], cur.y, size, cells) || blocked(cur.x, cur.y + dir[1], size, cells))) continue;
          const nKey = encode(nx, ny, size);
          if (closed.has(nKey)) continue;
          const g = cur.g + dir[2];
          const known = best.get(nKey);
          if (known != null && g >= known) continue;
          best.set(nKey, g);
          came.set(nKey, cur.key);
          const h = hypot(ex - nx, ey - ny);
          open.push({ x: nx, y: ny, g, f: g + h * 1.08, key: nKey });
        }
      }
      if (allowPartialPath && bestPartialKey && bestPartialKey !== startKey) {
        return { ok: true, path: reconstruct(came, bestPartialKey, size, sx, sy, maxNodes), inspected, reason: 'partial' };
      }
      return { ok: false, path: [], inspected, reason: 'no-route' };
    }

    self.onmessage = event => {
      const msg = event.data || {};
      try {
        if (msg.type === 'grid') {
          gridVersion = Number(msg.version) || 0;
          grid = { size: Math.max(1, Math.floor(Number(msg.size) || 1)), version: gridVersion, cells: msg.cells instanceof Uint8Array ? msg.cells : new Uint8Array(msg.cells || []) };
          self.postMessage({ type: 'grid-ready', version: gridVersion, size: grid.size, cells: grid.cells.length });
          return;
        }
        if (msg.type === 'path') {
          const startedAt = Date.now();
          const result = findPath(msg);
          self.postMessage({ type: 'path-result', id: msg.id, ok: result.ok, path: result.path, inspected: result.inspected, reason: result.reason, elapsedMs: Date.now() - startedAt });
        }
      } catch (err) {
        self.postMessage({ type: 'path-result', id: msg.id, ok: false, path: [], inspected: 0, reason: err && err.message ? err.message : 'worker-error' });
      }
    };
  `;

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function perfConfig(game) {
    return (game && game.performanceSettings && game.performanceSettings()) || DR.CONFIG?.PERFORMANCE || {};
  }

  function quantize(value) {
    return Math.round((Number(value) || 0) * 2) / 2;
  }

  DR.PathfindingWorkerSystem = {
    install(Game) {
      if (!Game || Game.prototype.__pathfindingWorkerInstalled) return;
      Game.prototype.__pathfindingWorkerInstalled = true;

      const originalBeginAiFrame = Game.prototype.beginAiFrame;
      const originalNextPathStepForActor = Game.prototype.nextPathStepForActor;
      const originalMoveCompanionToPoint = Game.prototype.moveCompanionToPoint;

      Game.prototype.pathWorkerSettings = function() {
        const perf = perfConfig(this);
        return {
          enabled: perf.enablePathfindingWorker !== false,
          maxPending: Math.max(8, Math.floor(Number(perf.pathWorkerMaxPending) || 96)),
          maxRequestsPerFrame: Math.max(2, Math.floor(Number(perf.pathWorkerMaxRequestsPerFrame) || 22)),
          gridAuditFrames: Math.max(15, Math.floor(Number(perf.pathWorkerGridAuditFrames) || 120)),
          timeoutMs: Math.max(250, Math.floor(Number(perf.pathWorkerTimeoutMs) || 900)),
          failureCooldownMs: Math.max(0, Math.floor(Number(perf.pathWorkerFailureCooldownMs) || 900)),
          timeoutCooldownMs: Math.max(0, Math.floor(Number(perf.pathWorkerTimeoutCooldownMs) || 1200)),
          minDistance: Math.max(0, Number(perf.pathWorkerMinDistance) || 2.25),
          reuseExistingRoute: perf.pathWorkerBudgetReuseExistingRoute !== false,
          allowKinds: perf.pathWorkerActorKinds || ['enemy', 'bot', 'merc', 'pet']
        };
      };

      Game.prototype.ensurePathWorkerMetrics = function() {
        if (!this.pathWorkerMetrics) {
          this.pathWorkerMetrics = {
            enabled: false,
            ready: false,
            gridVersion: 0,
            gridBuilds: 0,
            gridCells: 0,
            pending: 0,
            requests: 0,
            requestsThisFrame: 0,
            completed: 0,
            failed: 0,
            timeouts: 0,
            syncFallbacks: 0,
            pendingCapSkips: 0,
            frameBudgetSkips: 0,
            cooldownRejects: 0,
            reusedExistingRoutes: 0,
            duplicateRequests: 0,
            directRejects: 0,
            lastReason: '',
            lastElapsedMs: 0,
            lastInspected: 0
          };
        }
        return this.pathWorkerMetrics;
      };

      Game.prototype.initPathfindingWorker = function() {
        const settings = this.pathWorkerSettings?.() || {};
        const metrics = this.ensurePathWorkerMetrics?.();
        if (!settings.enabled) {
          if (metrics) metrics.enabled = false;
          return false;
        }
        if (this._pathWorkerDisabled) {
          if (metrics) metrics.enabled = false;
          return false;
        }
        if (this._pathWorker) {
          if (metrics) metrics.enabled = true;
          return true;
        }
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
          this._pathWorkerDisabled = true;
          if (metrics) { metrics.enabled = false; metrics.lastReason = 'worker-api-unavailable'; }
          return false;
        }
        try {
          const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          const worker = new Worker(url);
          this._pathWorkerUrl = url;
          this._pathWorkerPending = new Map();
          worker.onmessage = event => this.handlePathWorkerMessage?.(event.data || {});
          worker.onerror = err => {
            const m = this.ensurePathWorkerMetrics?.();
            if (m) m.lastReason = err?.message || 'worker-error';
            this._pathWorkerDisabled = true;
            try { worker.terminate(); } catch (_) {}
            this._pathWorker = null;
          };
          this._pathWorker = worker;
          if (metrics) { metrics.enabled = true; metrics.ready = false; }
          return true;
        } catch (err) {
          this._pathWorkerDisabled = true;
          if (metrics) { metrics.enabled = false; metrics.lastReason = err?.message || 'worker-create-failed'; }
          return false;
        }
      };

      Game.prototype.disposePathfindingWorker = function() {
        if (this._pathWorker) {
          try { this._pathWorker.terminate(); } catch (_) {}
          this._pathWorker = null;
        }
        if (this._pathWorkerUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try { URL.revokeObjectURL(this._pathWorkerUrl); } catch (_) {}
        }
        this._pathWorkerUrl = '';
        this._pathWorkerPending?.clear?.();
        this._pathWorkerGrid = null;
      };

      Game.prototype.buildPathWorkerGrid = function(force = false) {
        const settings = this.pathWorkerSettings?.() || {};
        if (!settings.enabled || !this.initPathfindingWorker?.()) return false;
        const size = this.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || 200;
        const frame = Number(this._perfFrameId || 0);
        const mapRef = this.map || null;
        const objectsRef = this.objects || null;
        const current = this._pathWorkerGrid;
        const auditFrames = settings.gridAuditFrames || 120;
        const sameRefs = current && current.mapRef === mapRef && current.objectsRef === objectsRef && current.size === size;
        if (!force && sameRefs && frame - Number(current.lastAuditFrame || 0) < auditFrames && current.version === Number(this._pathWorkerGridVersion || 0)) return true;

        const cells = new Uint8Array(size * size);
        const probe = { kind: 'bot' };
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            cells[y * size + x] = this.pathTileBlocked?.(x, y, probe) ? 1 : 0;
          }
        }
        const version = (Number(this._pathWorkerGridVersion || 0) + 1) >>> 0;
        this._pathWorkerGridVersion = version;
        this._pathWorkerGrid = { size, cells, version, mapRef, objectsRef, lastAuditFrame: frame };
        try {
          this._pathWorker.postMessage({ type: 'grid', version, size, cells });
        } catch (err) {
          const m = this.ensurePathWorkerMetrics?.();
          if (m) m.lastReason = err?.message || 'grid-post-failed';
          return false;
        }
        const metrics = this.ensurePathWorkerMetrics?.();
        if (metrics) {
          metrics.enabled = true;
          metrics.gridVersion = version;
          metrics.gridBuilds += 1;
          metrics.gridCells = cells.length;
          metrics.pending = this._pathWorkerPending?.size || 0;
        }
        return true;
      };

      Game.prototype.pathWorkerCanHandleActor = function(actor, targetX, targetY, options = {}) {
        if (!actor || actor.alive === false) return false;
        if (options.forceSyncPath === true || options.disableWorkerPath === true) return false;
        const settings = this.pathWorkerSettings?.() || {};
        if (!settings.enabled) return false;
        const kind = String(actor.kind || '').toLowerCase();
        const allowed = settings.allowKinds || [];
        if (allowed.indexOf(kind) === -1) return false;
        if (kind === 'player' || kind === 'remote') return false;
        const now = this.runtimeNowMs?.() || nowMs();
        if (Number(actor._pathWorkerCooldownUntil || 0) > now) {
          const metrics = this.ensurePathWorkerMetrics?.();
          if (metrics) { metrics.cooldownRejects += 1; metrics.lastReason = 'actor-cooldown'; }
          return false;
        }
        const dx = Number(targetX) - Number(actor.x);
        const dy = Number(targetY) - Number(actor.y);
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;
        if (Math.hypot(dx, dy) < settings.minDistance) return false;
        return true;
      };

      Game.prototype.cleanupTimedOutPathWorkerRequests = function(now = nowMs()) {
        const pending = this._pathWorkerPending;
        if (!pending || !pending.size) return;
        const timeoutMs = this.pathWorkerSettings?.().timeoutMs || 900;
        const metrics = this.ensurePathWorkerMetrics?.();
        for (const [id, req] of pending) {
          if (now - Number(req.startedAt || 0) < timeoutMs) continue;
          pending.delete(id);
          if (req.actor && req.actor._asyncPathPending?.id === id) {
            req.actor._asyncPathPending = null;
            req.actor._pathWorkerCooldownUntil = now + (this.pathWorkerSettings?.().timeoutCooldownMs || 1200);
          }
          if (metrics) { metrics.timeouts += 1; metrics.lastReason = 'timeout'; }
        }
        if (metrics) metrics.pending = pending.size;
      };

      Game.prototype.requestActorPathAsync = function(actor, targetX, targetY, options = {}) {
        if (!this.pathWorkerCanHandleActor?.(actor, targetX, targetY, options)) return false;
        const metrics = this.ensurePathWorkerMetrics?.();
        const settings = this.pathWorkerSettings?.() || {};
        const now = this.runtimeNowMs?.() || nowMs();
        this.cleanupTimedOutPathWorkerRequests?.(now);
        if (!this.buildPathWorkerGrid?.()) return false;
        const pending = this._pathWorkerPending || (this._pathWorkerPending = new Map());
        const routePropForBudget = options.routeProp || '_pathRoute';
        const hasReusableRoute = Array.isArray(actor[routePropForBudget]) && actor[routePropForBudget].length > 0;
        if (pending.size >= settings.maxPending) {
          if (metrics) { metrics.lastReason = 'pending-cap'; metrics.pendingCapSkips += 1; if (hasReusableRoute) metrics.reusedExistingRoutes += 1; else metrics.syncFallbacks += 1; }
          return settings.reuseExistingRoute && hasReusableRoute;
        }
        if ((metrics?.requestsThisFrame || 0) >= settings.maxRequestsPerFrame) {
          if (metrics) { metrics.lastReason = 'frame-budget'; metrics.frameBudgetSkips += 1; if (hasReusableRoute) metrics.reusedExistingRoutes += 1; }
          return settings.reuseExistingRoute && hasReusableRoute;
        }
        const routeProp = options.routeProp || '_pathRoute';
        const targetProp = options.targetProp || '_pathTarget';
        const key = [
          String(actor.id || actor.name || actor.kind || 'actor'),
          routeProp,
          quantize(actor.x), quantize(actor.y),
          quantize(targetX), quantize(targetY),
          Math.floor(Number(options.maxRange) || 0),
          Math.floor(Number(options.maxNodes || options.maxSearchTiles) || 0),
          options.allowPartialPath === true ? 1 : 0
        ].join(':');
        const oldPending = actor._asyncPathPending;
        if (oldPending && oldPending.key === key && pending.has(oldPending.id)) {
          if (metrics) metrics.duplicateRequests += 1;
          return true;
        }

        const id = `pw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const req = {
          id,
          actor,
          key,
          routeProp,
          targetProp,
          targetX: Number(targetX),
          targetY: Number(targetY),
          startedAt: now,
          repathSeconds: Number(options.repathSeconds) || 0.55,
          goalData: options.goalData || null
        };
        pending.set(id, req);
        actor._asyncPathPending = { id, key, routeProp, startedAt: now };
        try {
          this._pathWorker.postMessage({
            type: 'path',
            id,
            gridVersion: this._pathWorkerGridVersion,
            startX: actor.x,
            startY: actor.y,
            endX: targetX,
            endY: targetY,
            maxNodes: options.maxNodes || options.maxSearchTiles || (actor.kind === 'enemy' ? 900 : 1500),
            maxRange: options.maxRange || (actor.kind === 'enemy' ? 32 : 52),
            allowPartialPath: options.allowPartialPath === true
          });
        } catch (err) {
          pending.delete(id);
          actor._asyncPathPending = null;
          if (metrics) { metrics.lastReason = err?.message || 'path-post-failed'; metrics.syncFallbacks += 1; }
          return false;
        }
        if (metrics) {
          metrics.enabled = true;
          metrics.requests += 1;
          metrics.requestsThisFrame += 1;
          metrics.pending = pending.size;
        }
        return true;
      };

      Game.prototype.handlePathWorkerMessage = function(msg = {}) {
        const metrics = this.ensurePathWorkerMetrics?.();
        if (msg.type === 'grid-ready') {
          if (metrics) {
            metrics.ready = true;
            metrics.gridVersion = Number(msg.version) || metrics.gridVersion || 0;
            metrics.gridCells = Number(msg.cells) || metrics.gridCells || 0;
          }
          return;
        }
        if (msg.type !== 'path-result') return;
        const pending = this._pathWorkerPending;
        const req = pending?.get?.(msg.id);
        if (!req) return;
        pending.delete(msg.id);
        if (metrics) {
          metrics.pending = pending.size;
          metrics.lastReason = msg.reason || '';
          metrics.lastElapsedMs = Number(msg.elapsedMs) || 0;
          metrics.lastInspected = Number(msg.inspected) || 0;
        }
        const actor = req.actor;
        if (!actor || actor.alive === false) return;
        if (actor._asyncPathPending?.id === msg.id) actor._asyncPathPending = null;
        if (msg.ok && Array.isArray(msg.path) && msg.path.length) {
          const smoothed = this.smoothPath?.(msg.path, actor) || msg.path;
          actor[req.routeProp] = smoothed;
          if (req.targetProp) actor[req.targetProp] = { x: req.targetX, y: req.targetY };
          actor._pathRepath = req.repathSeconds;
          if (req.goalData && req.routeProp === '_companionPathRoute') {
            actor._companionPathGoal = req.goalData.goal || actor._companionPathGoal || { x: req.targetX, y: req.targetY, mode: req.goalData.mode || 'follow' };
            actor._companionPathMode = req.goalData.mode || actor._companionPathMode || 'follow';
            actor._lastPathRecalcMs = this.runtimeNowMs?.() || nowMs();
            actor._forcePathRecalcAt = 0;
          }
          if (metrics) metrics.completed += 1;
        } else {
          if (!Array.isArray(actor[req.routeProp]) || actor[req.routeProp].length === 0) actor[req.routeProp] = [];
          actor._pathRepath = 0;
          const failNow = this.runtimeNowMs?.() || nowMs();
          actor._lastAsyncPathFailedAt = failNow;
          actor._pathWorkerCooldownUntil = failNow + (this.pathWorkerSettings?.().failureCooldownMs || 900);
          if (metrics) metrics.failed += 1;
        }
      };

      Game.prototype.beginAiFrame = function(...args) {
        if (typeof originalBeginAiFrame === 'function') originalBeginAiFrame.apply(this, args);
        const metrics = this.ensurePathWorkerMetrics?.();
        if (metrics) {
          metrics.requestsThisFrame = 0;
          metrics.pending = this._pathWorkerPending?.size || 0;
          metrics.enabled = this.pathWorkerSettings?.().enabled !== false && !this._pathWorkerDisabled;
          metrics.ready = Boolean(this._pathWorker && this._pathWorkerGridVersion);
        }
        this.cleanupTimedOutPathWorkerRequests?.();
      };

      Game.prototype.nextPathStepForActor = function(actor, targetX, targetY, dt = 0, options = {}) {
        if (!actor) return null;
        const repathDistance = Number(options.repathDistance) || 1.15;
        const targetDx = actor._pathTarget ? actor._pathTarget.x - targetX : Infinity;
        const targetDy = actor._pathTarget ? actor._pathTarget.y - targetY : Infinity;
        const targetMoved = !actor._pathTarget || (targetDx * targetDx + targetDy * targetDy) > repathDistance * repathDistance;
        actor._pathRepath = Math.max(0, (actor._pathRepath || 0) - Math.max(0, Number(dt) || 0));
        if (!Array.isArray(actor._pathRoute) || !actor._pathRoute.length || targetMoved || actor._pathRepath <= 0) {
          const repathSeconds = Number(options.repathSeconds) || (actor.kind === 'enemy' ? 0.72 : 0.45);
          const queued = this.requestActorPathAsync?.(actor, targetX, targetY, {
            ...options,
            routeProp: '_pathRoute',
            targetProp: '_pathTarget',
            repathSeconds,
            maxNodes: options.maxNodes || (actor.kind === 'enemy' ? 620 : 980),
            maxRange: options.maxRange || (actor.kind === 'enemy' ? 24 : 36)
          });
          if (queued) {
            actor._pathTarget = { x: targetX, y: targetY };
            actor._pathRepath = repathSeconds;
          } else if (typeof originalNextPathStepForActor === 'function') {
            const metrics = this.ensurePathWorkerMetrics?.();
            if (metrics) metrics.syncFallbacks += 1;
            return originalNextPathStepForActor.call(this, actor, targetX, targetY, dt, { ...options, forceSyncPath: true });
          }
        }
        while (actor._pathRoute?.length) {
          const step = actor._pathRoute[0];
          const dx = step.x - actor.x;
          const dy = step.y - actor.y;
          if (dx * dx + dy * dy >= 0.34 * 0.34) break;
          actor._pathRoute.shift();
        }
        return actor._pathRoute?.[0] || null;
      };

      Game.prototype.moveCompanionToPoint = function(actor, targetX, targetY, dt = 0, options = {}) {
        if (!actor || !Number.isFinite(Number(targetX)) || !Number.isFinite(Number(targetY))) return false;
        const stopRange = Math.max(0, Number(options.stopRange ?? options.range ?? 0.65));
        const d = Math.hypot((targetX || 0) - actor.x, (targetY || 0) - actor.y);
        if (d <= stopRange) {
          actor.wantsToMove = false;
          this.updateBotStuckState?.(actor, nowMs(), false);
          return false;
        }
        const destination = this.isCompanionWalkableTile?.(Math.floor(targetX), Math.floor(targetY), actor)
          ? { x: targetX, y: targetY }
          : this.findNearestCompanionWalkablePoint?.(targetX, targetY, actor, options.searchRadius || 5);
        if (!destination) {
          this.clearCompanionPath?.(actor);
          return false;
        }
        const frameNow = this.runtimeNowMs?.() || nowMs();
        const goal = { x: destination.x, y: destination.y, mode: options.mode || 'follow' };
        const directAllowed = options.forcePath !== true && this.hasLineWalkPath?.(actor.x, actor.y, destination.x, destination.y, actor) === true;
        if (directAllowed && this.tryCompanionStepToward?.(actor, destination.x, destination.y, dt, options)) {
          this.updateBotStuckState?.(actor, frameNow, true);
          return true;
        }
        if (this.shouldRecalculateCompanionPath?.(actor, goal, frameNow, options)) {
          const queued = this.requestActorPathAsync?.(actor, destination.x, destination.y, {
            ...options,
            routeProp: '_companionPathRoute',
            targetProp: '_companionPathTarget',
            maxNodes: options.maxNodes || 1500,
            maxSearchTiles: options.maxSearchTiles || options.maxNodes || 1500,
            maxRange: options.maxRange || 52,
            allowPartialPath: options.allowPartialPath !== false,
            repathSeconds: Math.max(0.24, Number(options.repathSeconds) || 0.55),
            goalData: { goal, mode: goal.mode }
          });
          if (queued) {
            actor._companionPathGoal = goal;
            actor._companionPathMode = goal.mode;
            actor._lastPathRecalcMs = frameNow;
            actor._forcePathRecalcAt = 0;
          } else if (typeof originalMoveCompanionToPoint === 'function') {
            const metrics = this.ensurePathWorkerMetrics?.();
            if (metrics) metrics.syncFallbacks += 1;
            return originalMoveCompanionToPoint.call(this, actor, targetX, targetY, dt, { ...options, forceSyncPath: true });
          }
        }
        return this.followCompanionPath?.(actor, dt, options) || false;
      };
    }
  };
})();
