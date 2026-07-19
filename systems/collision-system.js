// Dream Realms external collision and tile query system
// Extracted from the V0.10.3 stable baseline without changing runtime behavior.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.CollisionSystem = {
    install(Game) {
      Game.prototype.tryMove = function(entity, nx, ny) {
        if (!entity) return false;
        const tile = this.tileAt(nx, ny);
        if (!tile) return false;
        const waterType = (TILE && TILE.WATER) || DR.TILE?.WATER;
        const movingPlayer = entity.kind === 'player';
        const enteringWater = tile.type === waterType;
        // V0.17.97: any actor that can swim may enter water (was player-only). Lets
        // enemies, mercenaries, pets and bots cross rivers/lakes and swim like the player.
        if (enteringWater && this.actorCanSwim?.(entity) !== true) return false;
        if (!enteringWater && !this.isWalkable(nx, ny, entity)) return false;
        const ox = entity.x;
        const oy = entity.y;
        const moveBoundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        entity.x = clamp(nx, 0.5, moveBoundsSize - 1.5);
        entity.y = clamp(ny, 0.5, moveBoundsSize - 1.5);
        const dx = entity.x - ox;
        const dy = entity.y - oy;
        entity.vx = dx;
        entity.vy = dy;
        const distStep = Math.hypot(dx, dy);
        if (distStep > 0.0001) {
          entity.swimming = enteringWater; // player state is still refined per-frame by swimmingSystem
          entity.moveBlend = 1;
          entity.walkCycle = (entity.walkCycle || 0) + distStep * (enteringWater ? 32 : 44);
          entity.setFacingFromDelta(dx, dy);
          this.handleTerrainFootstep?.(entity, dx, dy, distStep);
        }
        return true;
      };

      Game.prototype.activeMapSize = function() {
        const map = this.map || null;
        if (this._activeMapSizeMap !== map) {
          this._activeMapSizeMap = map;
          this._activeMapSizeValue = Math.max(1, Math.floor(Number(map?.length) || Number(CONFIG.MAP_SIZE) || 200));
        }
        return this._activeMapSizeValue || CONFIG.MAP_SIZE || 200;
      };

      Game.prototype.hasBlockingObjectAt = function(x, y, entity = null) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        const obj = this.objects?.[ty]?.[tx];
        if (!obj) return false;
        if (obj.blocked === true || obj.solid === true || obj.collision === true) return true;
        if (obj.blocked === false || obj.passable === true) return false;
        const type = String(obj.type || obj.kind || '').toLowerCase();
        if (!type) return false;
        if (type.includes('tree') || type.includes('wall') || type.includes('blocker')) return true;
        if (type.includes('rock') || type.includes('boulder') || type.includes('cliff')) return true;
        if (type.includes('building') || type.includes('fence') || type.includes('gate_closed')) return true;
        if (type.includes('stump') || type.includes('log_block')) return true;
        return false;
      };

      Game.prototype.isWalkable = function(x, y, entity = null) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        if (tx < 0 || ty < 0 || tx >= size || ty >= size) return false;
        const tile = this.map?.[ty]?.[tx];
        if (!tile) return false;
        if (this.layeredMapCanEnter?.(tx, ty, entity) === false) return false;
        if (this.hasBlockingObjectAt?.(tx, ty, entity)) return false;
        const waterType = (TILE && TILE.WATER) || DR.TILE?.WATER;
        const tileType = String(tile.type || '').toLowerCase();
        const deepWater = tile.deep === true || tile.deepWater === true || tile.type === 'deep_water' || tileType.includes('deep_water') || Number(tile.waterDepth || 0) >= 0.62;
        if (tile.type === waterType || tileType.includes('water')) {
          // V0.17.97: any swimmer may enter shallow OR deep water. deepWater is retained
          // (unused here) in case a future non-swimmer wading rule wants it.
          void deepWater;
          return this.actorCanSwim?.(entity) === true;
        }
        if (tile.type === 'tree' || tileType.includes('cave_wall') || tileType.includes('wall')) return false;
        return !tile.blocked;
      };

      // V0.17.97: swim capability. All actors swim by default so they cross water like the
      // player; opt out per-actor with `cannotSwim = true` (or `canSwim = false`), and the
      // player still respects an external `playerCanSwim === false` disable.
      Game.prototype.actorCanSwim = function(entity) {
        if (!entity) return false;
        if (entity.kind === 'player') return this.playerCanSwim !== false;
        if (entity.cannotSwim === true || entity.canSwim === false) return false;
        return true;
      };

      // V0.17.97: enemy navigation. Enemies previously only used local steering
      // (moveToward), so a tree/rock/water-edge between them and their target left them
      // stuck. When the straight line is clear, steer directly (cheap). When it is
      // blocked, A*-route around the obstacle with a per-enemy cached, throttled path so
      // the extra cost stays bounded even with many chasers.
      Game.prototype.moveEnemyToward = function(enemy, tx, ty, dt, stopRange = 0) {
        if (!enemy || !Number.isFinite(Number(tx)) || !Number.isFinite(Number(ty))) return false;
        if (this.hasLineWalkPath?.(enemy.x, enemy.y, tx, ty, enemy) !== false) {
          enemy._navRoute = null;
          return enemy.moveToward(this, tx, ty, dt, stopRange);
        }
        const now = this.runtimeNowMs?.() || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
        const goalMoved = !enemy._navGoal || Math.hypot(enemy._navGoal.x - tx, enemy._navGoal.y - ty) > 1.4;
        if (!Array.isArray(enemy._navRoute) || !enemy._navRoute.length || goalMoved || now >= (enemy._navRepathAt || 0)) {
          enemy._navRoute = this.findPath(enemy.x, enemy.y, tx, ty, enemy, { maxNodes: 520, maxRange: 26, allowPartialPath: true }) || [];
          enemy._navGoal = { x: tx, y: ty };
          enemy._navRepathAt = now + 480 + Math.random() * 260; // throttle A* per enemy
        }
        while (enemy._navRoute.length) {
          const wp = enemy._navRoute[0];
          if (Math.hypot(wp.x - enemy.x, wp.y - enemy.y) > 0.45) break;
          enemy._navRoute.shift();
        }
        const wp = enemy._navRoute[0];
        if (wp) return enemy.moveToward(this, wp.x, wp.y, dt, 0);
        // No route (fully walled off) - best-effort direct steer keeps some pressure.
        return enemy.moveToward(this, tx, ty, dt, stopRange);
      };

      Game.prototype.isBotWalkableTile = function(tx, ty, actor = null) {
        const x = Math.floor(tx);
        const y = Math.floor(ty);
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        if (x < 0 || y < 0 || x >= size || y >= size) return false;
        return this.isWalkable?.(x + 0.5, y + 0.5, actor || { kind: 'bot' }) === true;
      };

      Game.prototype.isDangerousDungeonHazardTile = function(tx, ty) {
        const obj = this.objects?.[Math.floor(ty)]?.[Math.floor(tx)];
        if (!obj) return false;
        const type = String(obj.type || '').toLowerCase();
        return type === 'webhazard' || type === 'bosscocoonprison';
      };

      Game.prototype.isCompanionWalkableTile = function(tx, ty, actor = null) {
        return this.isBotWalkableTile?.(tx, ty, actor || { kind: 'bot' }) === true;
      };

      Game.prototype.runtimeNowMs = function() {
        const cached = Number(this._runtimeFrameNowMs || 0);
        if (cached > 0) return cached;
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      };

      Game.prototype.actorSeparationRole = function(actor) {
        if (!actor || actor.alive === false || actor.isCorpse || actor.hidden === true || actor.renderable === false) return '';
        const kind = String(actor.kind || '').toLowerCase();
        if (kind === 'enemy') return 'enemy';
        if (kind === 'bot') return 'bot';
        if (kind === 'merc') return 'merc';
        if (kind === 'pet') return 'pet';
        return '';
      };

      Game.prototype.actorSeparationRadius = function(actor) {
        const role = this.actorSeparationRole?.(actor) || '';
        if (!role) return 0;
        const explicit = Number(actor.separationRadius ?? actor.collisionRadius ?? actor.baseType?.separationRadius ?? actor.baseType?.collisionRadius);
        if (Number.isFinite(explicit) && explicit > 0) return Math.max(0.34, Math.min(1.28, explicit));
        let radius = role === 'enemy' ? 0.66 : role === 'pet' ? 0.40 : 0.58;
        const scale = Number(actor.visualScale || actor.baseType?.visualScale || 1);
        if (Number.isFinite(scale) && scale > 1) radius += Math.min(0.32, (scale - 1) * 0.22);
        const visual = String(actor.name || actor.baseType?.name || actor.mobVisualKey || actor.rendererId || '').toLowerCase();
        if (/boar|stag|horror|elder|wolf|brute|boss|elite/.test(visual)) radius += 0.08;
        if (actor.elite || actor.baseType?.elite || actor.baseType?.named || actor.dungeonBoss || actor.boss) radius += 0.12;
        if (actor.meditating || actor.isMeditating || /meditat|rest|recover/i.test(String(actor.botState || actor.commandState || actor.currentActivityLabel || ''))) radius += 0.10;
        return Math.max(0.38, Math.min(1.05, radius));
      };

      Game.prototype.combatPositionOccupancyPenalty = function(actor, x, y, target = null, options = {}) {
        const actors = this.collectSeparatedNpcActors?.() || [];
        const actorRadius = this.actorSeparationRadius?.(actor) || 0.5;
        let penalty = 0;
        for (const other of actors) {
          if (!other || other === actor || other.alive === false) continue;
          const role = this.actorSeparationRole?.(other);
          if (!role || role === 'pet') continue;
          const d = Math.hypot(Number(other.x || 0) - x, Number(other.y || 0) - y);
          const sameTarget = target && (String(other.targetId ?? other.combatTargetId ?? other.forcedTargetId ?? '') === String(target.id ?? '') || Number(other.combatCooldown || 0) > 0);
          const min = actorRadius + (this.actorSeparationRadius?.(other) || 0.5) + (sameTarget ? 0.30 : 0.12);
          if (d < min) penalty += (min - d) * (sameTarget ? 7.5 : 3.0);
        }
        return penalty;
      };

      Game.prototype.collectSeparatedNpcActors = function() {
        const out = [];
        const seen = new Set();
        const add = actor => {
          if (!actor || seen.has(actor)) return;
          if (!this.actorSeparationRole?.(actor)) return;
          if (!Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) return;
          if (actor.zone && this.currentZone && actor.zone !== this.currentZone) return;
          seen.add(actor);
          out.push(actor);
        };
        for (const enemy of this.enemies || []) add(enemy);
        for (const bot of this.botPlayers || []) add(bot);
        add(this.merc);
        add(this.pet);
        for (const entity of this.entities || []) add(entity);
        return out;
      };

      Game.prototype.tryActorSeparationNudge = function(actor, dx, dy, amount) {
        if (!actor || !Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(amount) || amount <= 0) return false;
        const len = Math.hypot(dx, dy);
        if (len <= 0.0001) return false;
        const ux = dx / len;
        const uy = dy / len;
        const startX = Number(actor.x);
        const startY = Number(actor.y);
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        const clampX = x => clamp(x, 0.5, size - 1.5);
        const clampY = y => clamp(y, 0.5, size - 1.5);
        const attempts = [
          { x: startX + ux * amount, y: startY + uy * amount },
          { x: startX + ux * amount, y: startY },
          { x: startX, y: startY + uy * amount }
        ];
        for (const target of attempts) {
          const nx = clampX(target.x);
          const ny = clampY(target.y);
          if (!this.isWalkable?.(nx, ny, actor)) continue;
          if (actor.kind === 'enemy' && !actor.aggro && this.canEnemyRoamTo?.(nx, ny, actor) === false) continue;
          if (this.hasLineWalkPath && this.hasLineWalkPath(startX, startY, nx, ny, actor) === false) continue;
          actor.x = nx;
          actor.y = ny;
          actor.vx = (actor.vx || 0) * 0.25;
          actor.vy = (actor.vy || 0) * 0.25;
          actor._separationNudgePulse = Math.min(1, Number(actor._separationNudgePulse || 0) + amount * 2.5);
          actor._separationLastAt = this.runtimeNowMs?.() || Date.now();
          if (Math.hypot(actor.x - startX, actor.y - startY) > 0.035 && (actor._pathRoute?.length || actor._companionPathRoute?.length)) {
            actor._pathRepath = 0;
            actor._forcePathRecalcAt = actor._separationLastAt;
          }
          return Math.hypot(actor.x - startX, actor.y - startY) > 0.0001;
        }
        return false;
      };

      Game.prototype.updateActorSeparation = function(dt = 0) {
        const actors = this.collectSeparatedNpcActors?.() || [];
        if (actors.length < 2) return false;
        const cfg = window.DreamRealms?.CONFIG || {};
        const interval = Math.max(0.016, Number(cfg.ACTOR_SEPARATION_INTERVAL) || 0.033);
        this._actorSeparationAccumulator = Math.min(0.2, Math.max(0, Number(this._actorSeparationAccumulator || 0) + Math.max(0, Number(dt) || 0)));
        if (this._actorSeparationAccumulator < interval) return false;
        const safeDt = Math.max(0, Math.min(this._actorSeparationAccumulator, 0.05));
        this._actorSeparationAccumulator = 0;
        if (safeDt <= 0) return false;
        const cellSize = 1.45;
        const scratch = this._actorSeparationScratch || (this._actorSeparationScratch = { grid: new Map(), pushes: new Map(), seenPairs: new Set(), actorIds: new Map() });
        const grid = scratch.grid;
        const pushes = scratch.pushes;
        const seenPairs = scratch.seenPairs;
        const actorIds = scratch.actorIds;
        grid.clear(); pushes.clear(); seenPairs.clear(); actorIds.clear();
        const keyFor = (x, y) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
        for (let i = 0; i < actors.length; i++) actorIds.set(actors[i], String(actors[i]?.id ?? actors[i]?.botId ?? actors[i]?.name ?? i));
        for (const actor of actors) {
          const key = keyFor(actor.x, actor.y);
          let bucket = grid.get(key);
          if (!bucket) { bucket = []; grid.set(key, bucket); }
          bucket.push(actor);
        }
        const addPush = (actor, x, y) => {
          const cur = pushes.get(actor) || { x: 0, y: 0 };
          cur.x += x;
          cur.y += y;
          pushes.set(actor, cur);
        };
        for (const actor of actors) {
          const cx = Math.floor(actor.x / cellSize);
          const cy = Math.floor(actor.y / cellSize);
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
              const bucket = grid.get(`${gx},${gy}`);
              if (!bucket) continue;
              for (const other of bucket) {
                if (!other || other === actor) continue;
                const aId = actorIds.get(actor) || 'a';
                const bId = actorIds.get(other) || 'b';
                const pairKey = aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
                if (seenPairs.has(pairKey)) continue;
                seenPairs.add(pairKey);
                const ax = Number(actor.x), ay = Number(actor.y), bx = Number(other.x), by = Number(other.y);
                let dx = ax - bx;
                let dy = ay - by;
                let d = Math.hypot(dx, dy);
                if (d <= 0.0001) {
                  const hashText = `${aId}:${bId}`;
                  let seed = 2166136261;
                  for (let si = 0; si < hashText.length; si++) seed = Math.imul(seed ^ hashText.charCodeAt(si), 16777619) >>> 0;
                  const angle = (seed % 6283) / 1000;
                  dx = Math.cos(angle);
                  dy = Math.sin(angle);
                  d = 0.001;
                }
                const roleA = this.actorSeparationRole?.(actor) || '';
                const roleB = this.actorSeparationRole?.(other) || '';
                if (roleA === 'pet' && roleB === 'pet') continue;
                const minDist = (this.actorSeparationRadius?.(actor) || 0) + (this.actorSeparationRadius?.(other) || 0) + (roleA === 'pet' || roleB === 'pet' ? 0.06 : 0.16);
                if (minDist <= 0 || d >= minDist) continue;
                const overlap = minDist - d;
                const nx = dx / d;
                const ny = dy / d;
                const weightA = roleA === 'pet' ? 0.45 : 1;
                const weightB = roleB === 'pet' ? 0.45 : 1;
                const total = weightA + weightB || 1;
                const pressure = Math.min(0.34, overlap * 0.62);
                addPush(actor, nx * pressure * (weightB / total), ny * pressure * (weightB / total));
                addPush(other, -nx * pressure * (weightA / total), -ny * pressure * (weightA / total));
              }
            }
          }
        }
        if (!pushes.size) return false;
        const maxNudge = Math.max(0.024, Math.min(0.20, safeDt * 2.85));
        let moved = false;
        for (const [actor, push] of pushes) {
          const mag = Math.hypot(push.x, push.y);
          if (mag <= 0.004) continue;
          const amount = Math.min(maxNudge, mag);
          moved = this.tryActorSeparationNudge?.(actor, push.x, push.y, amount) || moved;
        }
        return moved;
      };

      Game.prototype.clearActorPathState = function(actor) {
        if (!actor) return;
        actor._pathRoute = [];
        actor._pathTarget = null;
        actor._pathRepath = 0;
        this.clearCompanionPath?.(actor);
      };

      Game.prototype.companionHasClearCombatLine = function(actor, target, options = {}) {
        if (!actor || !target) return false;
        const desiredRange = Math.max(0.75, Number(options.desiredRange || options.preferredRange || actor.range || 1.4));
        const d = Math.hypot((target.x || 0) - (actor.x || 0), (target.y || 0) - (actor.y || 0));
        if (d <= 0.001) return true;
        const requiresClearance = options.requireLineOfSight === true || desiredRange <= 2.25 || options.requireMeleeClearance === true;
        if (!requiresClearance) return true;
        if (!this.hasLineWalkPath) return true;
        return this.hasLineWalkPath(actor.x, actor.y, target.x, target.y, actor) === true;
      };

      Game.prototype.companionAtValidCombatPosition = function(actor, target, desiredRange = 1.4, options = {}) {
        if (!actor || !target) return false;
        const d = Math.hypot((target.x || 0) - (actor.x || 0), (target.y || 0) - (actor.y || 0));
        const range = Math.max(0.85, Number(desiredRange) || 1.4);
        const lower = Math.max(0.55, range - (range > 2.25 ? 1.25 : 0.72));
        const upper = range + (range > 2.25 ? 0.35 : 0.45);
        if (d < lower || d > upper) return false;
        return this.companionHasClearCombatLine?.(actor, target, { ...options, desiredRange: range }) !== false;
      };

      Game.prototype.tileAt = function(x, y) {
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        const tx = clamp(Math.floor(x), 0, size - 1);
        const ty = clamp(Math.floor(y), 0, size - 1);
        return this.map?.[ty]?.[tx] || null;
      };

      Game.prototype.isWaterTile = function(x, y) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        if (tx < 0 || ty < 0 || tx >= size || ty >= size) return false;
        const waterType = (TILE && TILE.WATER) || DR.TILE?.WATER;
        const tile = this.map?.[ty]?.[tx];
        const type = String(tile?.type || '').toLowerCase();
        return Boolean(tile && (tile.type === waterType || type.includes('water')));
      };

      Game.prototype.isSwimmingTile = function(x, y) {
        return this.isWaterTile(x, y);
      };

      Game.prototype.isNearWater = function(x, y, radius = 2) {
        return !!this.findNearbyWaterTile(x, y, radius);
      };

      Game.prototype.findNearbyWaterTile = function(x, y, radius = 2) {
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        let best = null;
        let bestDSq = Infinity;
        const maxDSq = (radius + 0.35) * (radius + 0.35);
        for (let yy = cy - radius; yy <= cy + radius; yy++) {
          for (let xx = cx - radius; xx <= cx + radius; xx++) {
            if (!this.isWaterTile(xx, yy)) continue;
            const dx = xx + 0.5 - x;
            const dy = yy + 0.5 - y;
            const dSq = dx * dx + dy * dy;
            if (dSq <= maxDSq && dSq < bestDSq) {
              bestDSq = dSq;
              best = { x: xx + 0.5, y: yy + 0.5, tileX: xx, tileY: yy, distance: Math.sqrt(dSq) };
            }
          }
        }
        return best;
      };


      Game.prototype.pathTileBlocked = function(tx, ty, entity = null, options = {}) {
        const x = Math.floor(tx);
        const y = Math.floor(ty);
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        if (x < 0 || y < 0 || x >= size || y >= size) return true;
        const canWalk = typeof options.canWalk === 'function' ? options.canWalk : null;
        if (canWalk) return canWalk(x, y, entity) !== true;
        return !this.isWalkable(x + 0.5, y + 0.5, entity);
      };

      Game.prototype.findPath = function(startX, startY, endX, endY, entity = null, options = {}) {
        const size = this.activeMapSize?.() || CONFIG.MAP_SIZE || 200;
        const sx = Math.floor(startX);
        const sy = Math.floor(startY);
        const ex = Math.floor(endX);
        const ey = Math.floor(endY);
        const maxNodes = Math.max(80, Math.min(2600, Math.floor(Number(options.maxNodes || options.maxSearchTiles) || 720)));
        const maxRange = Math.max(6, Math.min(80, Math.floor(Number(options.maxRange) || 28)));
        const allowPartialPath = options.allowPartialPath === true;
        const canWalk = typeof options.canWalk === 'function' ? options.canWalk : null;
        const blocked = (x, y) => this.pathTileBlocked(x, y, entity, { canWalk });
        if (sx < 0 || sy < 0 || sx >= size || sy >= size || blocked(sx, sy)) return null;
        if (ex < 0 || ey < 0 || ex >= size || ey >= size) return null;
        const dxTotal = ex - sx;
        const dyTotal = ey - sy;
        if (Math.hypot(dxTotal, dyTotal) > maxRange && !allowPartialPath) return null;
        if (blocked(ex, ey) && !allowPartialPath) return null;

        const encode = (x, y) => y * size + x;
        const decodeX = key => key % size;
        const decodeY = key => Math.floor(key / size);
        const startKey = encode(sx, sy);
        const endKey = encode(ex, ey);
        const came = new Map();
        const best = new Map([[startKey, 0]]);
        const closed = new Set();
        const open = [{ x: sx, y: sy, g: 0, f: Math.hypot(dxTotal, dyTotal), key: startKey }];
        const heapLess = (a, b) => a.f < b.f || (a.f === b.f && a.g > b.g);
        const heapPush = node => {
          open.push(node);
          let i = open.length - 1;
          while (i > 0) {
            const p = (i - 1) >> 1;
            if (!heapLess(open[i], open[p])) break;
            const tmp = open[i]; open[i] = open[p]; open[p] = tmp;
            i = p;
          }
        };
        const heapPop = () => {
          const first = open[0];
          const last = open.pop();
          if (open.length && last) {
            open[0] = last;
            let i = 0;
            for (;;) {
              const l = i * 2 + 1;
              const r = l + 1;
              let b = i;
              if (l < open.length && heapLess(open[l], open[b])) b = l;
              if (r < open.length && heapLess(open[r], open[b])) b = r;
              if (b === i) break;
              const tmp = open[i]; open[i] = open[b]; open[b] = tmp;
              i = b;
            }
          }
          return first;
        };
        const reconstruct = (walkKey) => {
          const out = [];
          let guard = 0;
          while (walkKey != null && guard++ < maxNodes) {
            const px = decodeX(walkKey);
            const py = decodeY(walkKey);
            out.push({ x: px + 0.5, y: py + 0.5 });
            walkKey = came.get(walkKey);
          }
          out.reverse();
          if (out.length && Math.floor(out[0].x) === sx && Math.floor(out[0].y) === sy) out.shift();
          return this.smoothPath?.(out, entity) || out;
        };

        const dirs = this._pathNeighborDirs || (this._pathNeighborDirs = [
          [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
          [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]
        ]);
        let inspected = 0;
        let bestPartialKey = startKey;
        let bestPartialScore = Math.hypot(dxTotal, dyTotal);
        while (open.length && inspected++ < maxNodes) {
          const cur = heapPop();
          if (!cur || closed.has(cur.key)) continue;
          closed.add(cur.key);
          const partialScore = Math.hypot(ex - cur.x, ey - cur.y) + cur.g * 0.035;
          if (partialScore < bestPartialScore) {
            bestPartialScore = partialScore;
            bestPartialKey = cur.key;
          }
          if (cur.key === endKey) return reconstruct(cur.key);
          for (let i = 0; i < dirs.length; i++) {
            const dir = dirs[i];
            const nx = cur.x + dir[0];
            const ny = cur.y + dir[1];
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            if (Math.hypot(nx - sx, ny - sy) > maxRange + 1) continue;
            if (blocked(nx, ny)) continue;
            if (dir[0] !== 0 && dir[1] !== 0 && (blocked(cur.x + dir[0], cur.y) || blocked(cur.x, cur.y + dir[1]))) continue;
            const nKey = encode(nx, ny);
            if (closed.has(nKey)) continue;
            const g = cur.g + dir[2];
            const known = best.get(nKey);
            if (known != null && g >= known) continue;
            best.set(nKey, g);
            came.set(nKey, cur.key);
            const h = Math.hypot(ex - nx, ey - ny);
            heapPush({ x: nx, y: ny, g, f: g + h * 1.08, key: nKey });
          }
        }
        if (allowPartialPath && bestPartialKey && bestPartialKey !== startKey) return reconstruct(bestPartialKey);
        return null;
      };

      Game.prototype.hasLineWalkPath = function(ax, ay, bx, by, entity = null) {
        const frame = Number(this._perfFrameId || 0);
        let cache = this._lineWalkPathFrameCache;
        if (!cache || cache.frame !== frame) {
          cache = this._lineWalkPathFrameCache || (this._lineWalkPathFrameCache = { frame, map: new Map(), limit: 2200 });
          cache.frame = frame;
          cache.map.clear();
        }
        const q = value => Math.round(Number(value || 0) * 4);
        const kind = entity?.kind || '';
        const key = `${kind}:${q(ax)},${q(ay)}>${q(bx)},${q(by)}`;
        const known = cache.map.get(key);
        if (known != null) return known;

        const dx = bx - ax;
        const dy = by - ay;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2.2));
        let lastTx = Math.floor(ax);
        let lastTy = Math.floor(ay);
        let ok = true;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = ax + dx * t;
          const y = ay + dy * t;
          const tx = Math.floor(x);
          const ty = Math.floor(y);
          if (this.pathTileBlocked(tx, ty, entity)) { ok = false; break; }
          if (tx !== lastTx && ty !== lastTy && (this.pathTileBlocked(tx, lastTy, entity) || this.pathTileBlocked(lastTx, ty, entity))) { ok = false; break; }
          lastTx = tx;
          lastTy = ty;
        }
        if (cache.map.size < cache.limit) cache.map.set(key, ok);
        return ok;
      };

      Game.prototype.smoothPath = function(path, entity = null) {
        if (!Array.isArray(path) || path.length <= 2) return path || [];
        const out = [];
        let i = 0;
        while (i < path.length) {
          out.push(path[i]);
          let best = i + 1;
          for (let j = Math.min(path.length - 1, i + 8); j > i + 1; j--) {
            if (this.hasLineWalkPath(path[i].x, path[i].y, path[j].x, path[j].y, entity)) {
              best = j;
              break;
            }
          }
          i = best;
        }
        return out;
      };

      Game.prototype.nextPathStepForActor = function(actor, targetX, targetY, dt = 0, options = {}) {
        if (!actor) return null;
        const repathDistance = Number(options.repathDistance) || 1.15;
        const targetDx = actor._pathTarget ? actor._pathTarget.x - targetX : Infinity;
        const targetDy = actor._pathTarget ? actor._pathTarget.y - targetY : Infinity;
        const targetMoved = !actor._pathTarget || (targetDx * targetDx + targetDy * targetDy) > repathDistance * repathDistance;
        actor._pathRepath = Math.max(0, (actor._pathRepath || 0) - Math.max(0, Number(dt) || 0));
        if (!Array.isArray(actor._pathRoute) || !actor._pathRoute.length || targetMoved || actor._pathRepath <= 0) {
          actor._pathRoute = this.findPath(actor.x, actor.y, targetX, targetY, actor, {
            maxNodes: options.maxNodes || (actor.kind === 'enemy' ? 620 : 980),
            maxRange: options.maxRange || (actor.kind === 'enemy' ? 24 : 36)
          }) || [];
          actor._pathTarget = { x: targetX, y: targetY };
          actor._pathRepath = Number(options.repathSeconds) || (actor.kind === 'enemy' ? 0.72 : 0.45);
        }
        while (actor._pathRoute.length) {
          const step = actor._pathRoute[0];
          const dx = step.x - actor.x;
          const dy = step.y - actor.y;
          if (dx * dx + dy * dy >= 0.34 * 0.34) break;
          actor._pathRoute.shift();
        }
        return actor._pathRoute[0] || null;
      };

      Game.prototype.findNearestCompanionWalkablePoint = function(x, y, actor = null, radius = 5) {
        const cx = Math.floor(Number(x) || 0);
        const cy = Math.floor(Number(y) || 0);
        const maxRadius = Math.max(0, Math.floor(Number(radius) || 0));
        let best = null;
        let bestScore = Infinity;
        for (let r = 0; r <= maxRadius; r++) {
          for (let yy = cy - r; yy <= cy + r; yy++) {
            for (let xx = cx - r; xx <= cx + r; xx++) {
              if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r) continue;
              if (!this.isCompanionWalkableTile?.(xx, yy, actor)) continue;
              const px = xx + 0.5;
              const py = yy + 0.5;
              const score = Math.hypot(px - x, py - y) + Math.hypot(px - (actor?.x || px), py - (actor?.y || py)) * 0.08;
              if (score < bestScore) { bestScore = score; best = { x: px, y: py, tileX: xx, tileY: yy }; }
            }
          }
          if (best) return best;
        }
        return null;
      };

      Game.prototype.clearCompanionPath = function(actor) {
        if (!actor) return;
        actor._companionPathRoute = [];
        actor._companionPathGoal = null;
        actor._companionPathMode = '';
        actor._lastCombatPathPartial = false;
      };

      Game.prototype.shouldRecalculateCompanionPath = function(actor, goal, nowMs, options = {}) {
        if (!actor || !goal) return false;
        const recalcMs = Math.max(240, Math.floor(Number(options.recalcMs) || 650));
        if (!Array.isArray(actor._companionPathRoute) || actor._companionPathRoute.length === 0) return true;
        if (actor._forcePathRecalcAt && nowMs >= actor._forcePathRecalcAt) return true;
        if (nowMs - Number(actor._lastPathRecalcMs || 0) >= recalcMs) return true;
        const old = actor._companionPathGoal;
        const repathDistance = Number(options.repathDistance) || 0.85;
        if (!old) return true;
        const goalDx = (old.x || 0) - goal.x;
        const goalDy = (old.y || 0) - goal.y;
        if (goalDx * goalDx + goalDy * goalDy > repathDistance * repathDistance) return true;
        const next = actor._companionPathRoute[0];
        if (next && !this.isCompanionWalkableTile?.(Math.floor(next.x), Math.floor(next.y), actor)) return true;
        return false;
      };

      Game.prototype.updateBotStuckState = function(actor, nowMs, wantsToMove = false) {
        if (!actor || (actor.kind !== 'bot' && actor.kind !== 'merc')) return false;
        if (!Number.isFinite(actor._lastMoveSampleAt)) {
          actor._lastMoveSampleAt = nowMs;
          actor._lastMoveX = actor.x;
          actor._lastMoveY = actor.y;
          actor._stuckMs = 0;
          return false;
        }
        if (nowMs - actor._lastMoveSampleAt < 250) return false;
        const movedDistSq = Math.pow((actor.x || 0) - (actor._lastMoveX || actor.x || 0), 2) + Math.pow((actor.y || 0) - (actor._lastMoveY || actor.y || 0), 2);
        const wanted = wantsToMove || actor.wantsToMove === true;
        if (wanted && movedDistSq < 0.0036) actor._stuckMs = Number(actor._stuckMs || 0) + (nowMs - actor._lastMoveSampleAt);
        else actor._stuckMs = 0;
        actor._lastMoveSampleAt = nowMs;
        actor._lastMoveX = actor.x;
        actor._lastMoveY = actor.y;
        if (actor._stuckMs > 900) {
          this.clearCompanionPath?.(actor);
          actor._forcePathRecalcAt = nowMs;
          actor._alternateCombatTileBias = Math.random();
          actor._stuckCount = Number(actor._stuckCount || 0) + 1;
          actor._stuckMs = 0;
          return true;
        }
        return false;
      };

      Game.prototype.tryCompanionStepToward = function(actor, targetX, targetY, dt = 0, options = {}) {
        if (!actor || !Number.isFinite(Number(targetX)) || !Number.isFinite(Number(targetY))) return false;
        const dx = targetX - actor.x;
        const dy = targetY - actor.y;
        const len = Math.hypot(dx, dy);
        if (len <= 0.001) return false;
        const safeDt = Math.min(Math.max(Number(dt) || 0, 0), CONFIG.AI_MOVE_MAX_DT || 0.085);
        const resolvedSpeed = Number(this.resolveActorMoveSpeed?.(actor));
        const speed = Math.max(0, Number.isFinite(resolvedSpeed) ? resolvedSpeed : Number(actor.getStat?.('speed') ?? actor.speed ?? 2.8));
        if (speed <= 0.001) {
          actor.wantsToMove = false;
          return false;
        }
        const step = Math.min(speed * safeDt, len);
        const ux = dx / len;
        const uy = dy / len;
        actor.wantsToMove = true;
        const tryAttempt = (x, y, strict = false) => {
          if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
          if (strict && this.hasLineWalkPath && !this.hasLineWalkPath(actor.x, actor.y, x, y, actor)) return false;
          if (!strict && this.isWalkable && !this.isWalkable(x, y, actor)) return false;
          return this.tryMove?.(actor, x, y) === true;
        };
        const ax = actor.x;
        const ay = actor.y;
        if (tryAttempt(ax + ux * step, ay + uy * step, true)) return true;
        if (tryAttempt(ax + ux * step, ay, false)) return true;
        if (tryAttempt(ax, ay + uy * step, false)) return true;
        const sideX = -uy * step * 0.72;
        const sideY = ux * step * 0.72;
        if (tryAttempt(ax + sideX, ay + sideY, false)) return true;
        if (tryAttempt(ax - sideX, ay - sideY, false)) return true;
        const fanA = ux * 0.62;
        const fanB = uy * 0.62;
        const turnX = uy * 0.78;
        const turnY = ux * 0.78;
        if (tryAttempt(ax + (fanA - turnX) * step, ay + (fanB + turnY) * step, false)) return true;
        if (tryAttempt(ax + (fanA + turnX) * step, ay + (fanB - turnY) * step, false)) return true;
        return false;
      };

      Game.prototype.followCompanionPath = function(actor, dt = 0, options = {}) {
        if (!actor || !Array.isArray(actor._companionPathRoute) || actor._companionPathRoute.length === 0) return false;
        while (actor._companionPathRoute.length) {
          const first = actor._companionPathRoute[0];
          const dx = first.x - actor.x;
          const dy = first.y - actor.y;
          if (dx * dx + dy * dy >= 0.26 * 0.26) break;
          actor._companionPathRoute.shift();
        }
        let next = actor._companionPathRoute[0];
        if (!next) return false;
        if (this.hasLineWalkPath) {
          for (let i = Math.min(actor._companionPathRoute.length - 1, 4); i > 0; i--) {
            const candidate = actor._companionPathRoute[i];
            if (candidate && this.hasLineWalkPath(actor.x, actor.y, candidate.x, candidate.y, actor)) {
              actor._companionPathRoute.splice(0, i);
              next = actor._companionPathRoute[0];
              break;
            }
          }
        }
        const moved = this.tryCompanionStepToward?.(actor, next.x, next.y, dt, options) === true;
        const nowMs = this.runtimeNowMs?.() || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
        if (!moved) {
          this.clearCompanionPath?.(actor);
          actor._forcePathRecalcAt = nowMs;
          actor._alternateCombatTileBias = Math.random();
          this.updateBotStuckState?.(actor, nowMs, true);
          return false;
        }
        this.updateBotStuckState?.(actor, nowMs, true);
        return true;
      };

      Game.prototype.moveCompanionToPoint = function(actor, targetX, targetY, dt = 0, options = {}) {
        if (!actor || !Number.isFinite(Number(targetX)) || !Number.isFinite(Number(targetY))) return false;
        const stopRange = Math.max(0, Number(options.stopRange ?? options.range ?? 0.65));
        const d = Math.hypot((targetX || 0) - actor.x, (targetY || 0) - actor.y);
        if (d <= stopRange) {
          actor.wantsToMove = false;
          this.updateBotStuckState?.(actor, performance.now(), false);
          return false;
        }
        const destination = this.isCompanionWalkableTile?.(Math.floor(targetX), Math.floor(targetY), actor)
          ? { x: targetX, y: targetY }
          : this.findNearestCompanionWalkablePoint?.(targetX, targetY, actor, options.searchRadius || 5);
        if (!destination) {
          this.clearCompanionPath?.(actor);
          return false;
        }
        const nowMs = this.runtimeNowMs?.() || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
        const goal = { x: destination.x, y: destination.y, mode: options.mode || 'follow' };
        const directAllowed = options.forcePath !== true && this.hasLineWalkPath?.(actor.x, actor.y, destination.x, destination.y, actor) === true;
        if (directAllowed && this.tryCompanionStepToward?.(actor, destination.x, destination.y, dt, options)) {
          this.updateBotStuckState?.(actor, nowMs, true);
          return true;
        }
        if (this.shouldRecalculateCompanionPath?.(actor, goal, nowMs, options)) {
          actor._companionPathRoute = this.findPath?.(actor.x, actor.y, destination.x, destination.y, actor, {
            canWalk: (tx, ty, entity) => this.isCompanionWalkableTile(tx, ty, entity),
            maxNodes: options.maxNodes || 1500,
            maxSearchTiles: options.maxSearchTiles || options.maxNodes || 1500,
            maxRange: options.maxRange || 52,
            allowPartialPath: options.allowPartialPath !== false
          }) || [];
          actor._companionPathGoal = goal;
          actor._companionPathMode = goal.mode;
          actor._lastPathRecalcMs = nowMs;
          actor._forcePathRecalcAt = 0;
        }
        return this.followCompanionPath?.(actor, dt, options) || false;
      };

      Game.prototype.findReachableCombatPosition = function(actor, target, desiredRange = 1.4, options = {}) {
        if (!actor || !target) return null;
        const range = Math.max(0.85, Number(desiredRange) || 1.4);
        const tx = Math.floor(target.x);
        const ty = Math.floor(target.y);
        const melee = range <= 2.25;
        const minR = melee ? 0.95 : Math.max(2.4, range - 1.35);
        const maxR = melee ? Math.max(1.8, range + 0.9) : range + 1.65;
        const radius = Math.max(2, Math.ceil(maxR + 1));
        const limit = Math.max(4, Math.min(14, Number(options.maxCandidates) || 10));
        const candidates = this._combatPositionCandidates || (this._combatPositionCandidates = []);
        candidates.length = 0;
        const bias = Number(actor._alternateCombatTileBias || 0);
        const insertCandidate = candidate => {
          let i = candidates.length;
          while (i > 0 && candidate.score < candidates[i - 1].score) i--;
          if (i >= limit) return;
          candidates.splice(i, 0, candidate);
          if (candidates.length > limit) candidates.length = limit;
        };
        for (let yy = ty - radius; yy <= ty + radius; yy++) {
          for (let xx = tx - radius; xx <= tx + radius; xx++) {
            if (xx === tx && yy === ty) continue;
            if (!this.isCompanionWalkableTile?.(xx, yy, actor)) continue;
            const cx = xx + 0.5;
            const cy = yy + 0.5;
            const dxTarget = cx - target.x;
            const dyTarget = cy - target.y;
            const targetDist = Math.hypot(dxTarget, dyTarget);
            if (targetDist < minR || targetDist > maxR) continue;
            const needsClearance = options.requireLineOfSight === true || melee || options.requireMeleeClearance === true;
            if (needsClearance && this.hasLineWalkPath && !this.hasLineWalkPath(cx, cy, target.x, target.y, actor)) continue;
            const actorDist = Math.hypot(cx - actor.x, cy - actor.y);
            const rangeError = Math.abs(targetDist - range) * (melee ? 1.1 : 0.72);
            const angleBias = Math.abs(Math.sin((xx * 12.9898 + yy * 78.233 + bias * 437.1))) * 0.18;
            const hazardPenalty = this.isDangerousDungeonHazardTile?.(xx, yy) ? (melee ? 3.4 : 5.8) : 0;
            const occupancyPenalty = this.combatPositionOccupancyPenalty?.(actor, cx, cy, target, options) || 0;
            insertCandidate({ x: cx, y: cy, tileX: xx, tileY: yy, score: actorDist + rangeError + angleBias + hazardPenalty + occupancyPenalty, hazard: hazardPenalty > 0, occupancyPenalty });
          }
        }
        for (let i = 0; i < candidates.length; i++) {
          const tile = candidates[i];
          const path = this.findPath?.(actor.x, actor.y, tile.x, tile.y, actor, {
            canWalk: (x, y, entity) => this.isCompanionWalkableTile(x, y, entity),
            maxNodes: options.maxNodes || 1600,
            maxSearchTiles: options.maxSearchTiles || options.maxNodes || 1600,
            maxRange: options.maxRange || 56,
            allowPartialPath: false
          });
          if (path && path.length) return { tile, path };
        }
        const partial = this.findPath?.(actor.x, actor.y, target.x, target.y, actor, {
          canWalk: (x, y, entity) => this.isCompanionWalkableTile(x, y, entity),
          maxNodes: options.maxNodes || 1600,
          maxSearchTiles: options.maxSearchTiles || options.maxNodes || 1600,
          maxRange: options.maxRange || 56,
          allowPartialPath: true
        }) || [];
        return partial.length ? { tile: partial[partial.length - 1], path: partial, partial: true } : null;
      };

      Game.prototype.moveCompanionToCombatPosition = function(actor, target, dt = 0, options = {}) {
        if (!actor || !target || target.alive === false) return false;
        const desiredRange = Math.max(0.9, Number(options.desiredRange || options.preferredRange || actor.range || 1.4));
        const currentDistance = Math.hypot(actor.x - target.x, actor.y - target.y);
        const stopRange = Math.max(0.3, Number(options.stopRange ?? (desiredRange <= 2.25 ? 0.46 : 0.70)));
        const standingInHazard = this.isDangerousDungeonHazardTile?.(Math.floor(actor.x), Math.floor(actor.y));
        const nowMs = this.runtimeNowMs?.() || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
        const validCombatPosition = this.companionAtValidCombatPosition?.(actor, target, desiredRange, options) === true;
        if (!standingInHazard && validCombatPosition) {
          actor.wantsToMove = false;
          this.updateBotStuckState?.(actor, nowMs, false);
          return false;
        }
        if (standingInHazard || !validCombatPosition) actor._forcePathRecalcAt = nowMs;
        const goalKey = `${Math.floor(target.x)},${Math.floor(target.y)}:${desiredRange.toFixed(1)}:${options.role || actor.role || actor.roleKey || ''}`;
        const goal = { x: target.x, y: target.y, mode: `combat:${goalKey}` };
        if (this.shouldRecalculateCompanionPath?.(actor, goal, nowMs, { ...options, recalcMs: options.recalcMs || 650, repathDistance: options.repathDistance || 0.75 })) {
          const result = this.findReachableCombatPosition?.(actor, target, desiredRange, { ...options, requireMeleeClearance: desiredRange <= 2.25 });
          actor._companionPathRoute = result?.path || [];
          actor._companionPathGoal = result?.tile ? { x: result.tile.x, y: result.tile.y, mode: goal.mode } : goal;
          actor._companionPathMode = 'combat';
          actor._lastPathRecalcMs = nowMs;
          actor._forcePathRecalcAt = 0;
          actor._lastCombatPathPartial = Boolean(result?.partial);
        }
        return this.followCompanionPath?.(actor, dt, { ...options, stopRange }) || false;
      };


      Game.prototype.findSpawnTile = function(cx, cy, radius) {
        for (let r = 0; r <= radius; r++) {
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            const x = Math.floor(cx + Math.cos(a) * r);
            const y = Math.floor(cy + Math.sin(a) * r);
            if (this.isWalkable(x + 0.5, y + 0.5)) return { x, y };
          }
        }
        return { x: CONFIG.START_X, y: CONFIG.START_Y };
      };

    }
  };
})();
