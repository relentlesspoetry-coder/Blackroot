// Dream Realms portal spell system
// V0.14.92: owns T-key camp/return portal creation, group teleporting, trigger handling, and high-detail portal rendering.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dist(a, b) {
    return Math.hypot((safeNumber(a?.x) - safeNumber(b?.x)), (safeNumber(a?.y) - safeNumber(b?.y)));
  }

  const PORTAL_TRIGGER_RADIUS = 1.1;
  const PORTAL_VISUAL_SCALE = 1.4;
  // Portals open a couple of tiles away (clearly beyond the trigger radius) so the
  // player has to WALK INTO the portal to travel, instead of being teleported the
  // instant it opens on top of them.
  const PORTAL_SPAWN_DISTANCE = 2.5;
  const PORTAL_SPAWN_GRACE = 0.42;
  const PORTAL_FOLLOWER_MIN_SPACING = 0.72;
  const CAMP_CENTER = Object.freeze({ x: 100.5, y: 100.5 });
  const CAMP_ARRIVAL = Object.freeze({ x: 101.5, y: 104.5 });
  const CAMP_RADIUS = 22.0;

  DR.PortalSystem = {
    install(Game) {
      Game.prototype.ensurePortalRuntime = function() {
        if (!this.portalRuntime || typeof this.portalRuntime !== 'object') {
          this.portalRuntime = {
            link: null,
            lastWildernessLocation: null,
            flash: null,
            cooldown: 0,
            castSerial: 1,
            lastUseAt: 0,
            collapseFx: null,
            entryRipple: null
          };
        }
        if (!('collapseFx' in this.portalRuntime)) this.portalRuntime.collapseFx = null;
        if (!('entryRipple' in this.portalRuntime)) this.portalRuntime.entryRipple = null;
        return this.portalRuntime;
      };

      Game.prototype.portalLocationZoneKey = function() {
        if (this.currentZone === 'cave') {
          const caveId = this.currentCave?.id || this.activeCaveId || 'mossfang_cave';
          const floor = Math.max(1, Math.floor(safeNumber(this.currentCaveFloor, 1)));
          return `cave:${caveId}:${floor}`;
        }
        return 'overworld';
      };

      Game.prototype.capturePortalLocation = function(x = this.player?.x, y = this.player?.y) {
        const zoneKey = this.portalLocationZoneKey?.() || 'overworld';
        const loc = {
          zoneKey,
          currentZone: this.currentZone === 'cave' ? 'cave' : 'overworld',
          x: safeNumber(x, this.player?.x || CAMP_ARRIVAL.x),
          y: safeNumber(y, this.player?.y || CAMP_ARRIVAL.y),
          createdAt: performance.now()
        };
        if (loc.currentZone === 'cave') {
          loc.caveId = this.currentCave?.id || this.activeCaveId || 'mossfang_cave';
          loc.caveFloor = Math.max(1, Math.floor(safeNumber(this.currentCaveFloor, 1)));
        }
        return loc;
      };

      Game.prototype.isPortalCampArea = function(locOrActor = this.player) {
        const zone = String(locOrActor?.currentZone || this.currentZone || 'overworld');
        if (zone === 'cave' || String(locOrActor?.zoneKey || '').startsWith('cave:')) return false;
        return dist(locOrActor, CAMP_CENTER) <= CAMP_RADIUS;
      };

      Game.prototype.recordPortalWildernessLocation = function() {
        if (!this.player || this.player.alive === false) return;
        const runtime = this.ensurePortalRuntime();
        const loc = this.capturePortalLocation(this.player.x, this.player.y);
        if (!this.isPortalCampArea(loc)) runtime.lastWildernessLocation = loc;
      };

      // Find a walkable spot ~PORTAL_SPAWN_DISTANCE tiles from (ax,ay) - preferring
      // the facing direction, then fanning out - that is clearly beyond the trigger
      // radius, so the portal opens in front of the player rather than on them.
      Game.prototype.findPortalPlacement = function(ax, ay, dirX = 1, dirY = 0) {
        const mapSize = safeNumber(DR.CONFIG?.MAP_SIZE, 200);
        const len = Math.hypot(dirX, dirY);
        const baseAngle = len < 0.01 ? 0 : Math.atan2(dirY, dirX);
        const minGap = PORTAL_TRIGGER_RADIUS + 0.6;
        const dists = [PORTAL_SPAWN_DISTANCE, PORTAL_SPAWN_DISTANCE + 0.7, PORTAL_SPAWN_DISTANCE - 0.4, PORTAL_SPAWN_DISTANCE - 0.7];
        const angleOffsets = [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, Math.PI];
        for (const d of dists) {
          if (d < minGap) continue;
          for (const off of angleOffsets) {
            const a = baseAngle + off;
            const x = clamp(ax + Math.cos(a) * d, 1.25, mapSize - 2.25);
            const y = clamp(ay + Math.sin(a) * d, 1.25, mapSize - 2.25);
            if ((!this.isWalkable || this.isWalkable(x, y, this.player)) && dist({ x, y }, { x: ax, y: ay }) >= minGap) return { x, y };
          }
        }
        const fx = len < 0.01 ? 1 : dirX / len, fy = len < 0.01 ? 0 : dirY / len;
        return { x: clamp(ax + fx * PORTAL_SPAWN_DISTANCE, 1.25, mapSize - 2.25), y: clamp(ay + fy * PORTAL_SPAWN_DISTANCE, 1.25, mapSize - 2.25) };
      };

      Game.prototype.findPortalSpawnPoint = function() {
        const p = this.player;
        if (!p) return { x: CAMP_ARRIVAL.x, y: CAMP_ARRIVAL.y };
        return this.findPortalPlacement(p.x, p.y, safeNumber(p.facingX, 1), safeNumber(p.facingY, 0));
      };

      Game.prototype.portalCurrentZoneName = function() {
        return this.currentZone === 'cave' ? 'cave' : 'overworld';
      };

      Game.prototype.collectPortalFollowers = function() {
        const followers = [];
        const seen = new Set();
        const add = (actor, kind) => {
          if (!actor || actor === this.player || actor.alive === false) return;
          const id = String(actor.botId || actor.remoteId || actor.id || actor.name || `${kind}-${followers.length}`);
          const key = `${kind}:${id}`;
          if (seen.has(key)) return;
          seen.add(key);
          followers.push({ kind, actor, id });
        };

        const partyBots = Array.isArray(this.botPlayers)
          ? this.botPlayers.filter(bot => bot && this.isBotInParty?.(bot))
              .sort((a, b) => String(a.botId || a.remoteId || a.name || '').localeCompare(String(b.botId || b.remoteId || b.name || '')))
          : [];
        partyBots.forEach(bot => add(bot, 'partyBot'));

        // Hired mercenaries and owned pets are auxiliary followers. They do not
        // need to consume a formal party slot to follow the player's portal use.
        add(this.merc, 'merc');
        add(this.pet, 'pet');
        return followers;
      };

      Game.prototype.portalFollowerArrivalOffset = function(entry, index = 0, total = 1) {
        const kind = String(entry?.kind || 'follower');
        const preferred = kind === 'partyBot'
          ? (this.partyBotFormationOffset?.(entry.actor, index) || this.companionFormationOffset?.(kind, index))
          : this.companionFormationOffset?.(kind, index);
        if (preferred && Number.isFinite(Number(preferred.x)) && Number.isFinite(Number(preferred.y))) return preferred;

        const ring = 1.05 + Math.floor(Math.max(0, index) / 6) * 0.42 + Math.min(0.35, Math.max(0, total - 3) * 0.04);
        const angle = -Math.PI * 0.5 + index * 2.39996323;
        return { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring };
      };

      Game.prototype.findPortalFollowerArrivalSpot = function(anchorX, anchorY, offset, actor, occupied = []) {
        const mapSize = safeNumber(DR.CONFIG?.MAP_SIZE, 200);
        const baseX = safeNumber(anchorX, this.player?.x || CAMP_ARRIVAL.x);
        const baseY = safeNumber(anchorY, this.player?.y || CAMP_ARRIVAL.y);
        const desired = {
          x: clamp(baseX + safeNumber(offset?.x, 0), 1.25, mapSize - 2.25),
          y: clamp(baseY + safeNumber(offset?.y, 0), 1.25, mapSize - 2.25)
        };
        const candidates = [desired];
        for (let ring = 1; ring <= 4; ring++) {
          const radius = 0.7 + ring * 0.38;
          const count = 8 + ring * 4;
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + ring * 0.41;
            candidates.push({
              x: clamp(desired.x + Math.cos(a) * radius, 1.25, mapSize - 2.25),
              y: clamp(desired.y + Math.sin(a) * radius, 1.25, mapSize - 2.25)
            });
          }
        }

        const canStand = point => {
          if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
          for (const other of occupied) {
            if (dist(point, other) < PORTAL_FOLLOWER_MIN_SPACING) return false;
          }
          if (typeof this.isWalkable === 'function') {
            try { return this.isWalkable(point.x, point.y, actor); }
            catch (_err) { return true; }
          }
          return true;
        };

        const valid = candidates.find(canStand);
        return valid || desired;
      };

      Game.prototype.applyPortalFollowers = function(reason = 'portal') {
        if (!this.player) return 0;
        const followers = this.collectPortalFollowers?.() || [];
        if (!followers.length) return 0;

        const zone = this.portalCurrentZoneName?.() || this.currentZone || 'overworld';
        const occupied = [{ x: this.player.x, y: this.player.y }];
        let moved = 0;
        followers.forEach((entry, index) => {
          const actor = entry.actor;
          if (!actor) return;
          const offset = this.portalFollowerArrivalOffset?.(entry, index, followers.length) || { x: 0.75 + index * 0.24, y: 0.75 };
          const spot = this.findPortalFollowerArrivalSpot?.(this.player.x, this.player.y, offset, actor, occupied) || { x: this.player.x, y: this.player.y };
          actor.x = spot.x;
          actor.y = spot.y;
          actor.vx = 0;
          actor.vy = 0;
          actor.moveBlend = 0;
          actor.lastStableX = spot.x;
          actor.lastStableY = spot.y;
          this.resetCompanionTransitionState?.(actor, zone, reason);
          actor.zone = zone;
          actor.portalFollowGrace = 0.65;
          occupied.push({ x: spot.x, y: spot.y });
          moved += 1;
        });

        this.ensureActiveZoneAllies?.(zone);
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.petCommandDirty = true;
        this.renderPartyHud?.({ force: true });
        return moved;
      };

      Game.prototype.ensurePortalCampArrivalSafe = function() {
        const map = this.overworldMap || (this.currentZone === 'overworld' ? this.map : null);
        const objects = this.overworldObjects || (this.currentZone === 'overworld' ? this.objects : null);
        const x = Math.floor(CAMP_ARRIVAL.x);
        const y = Math.floor(CAMP_ARRIVAL.y);
        if (map?.[y]?.[x]) {
          const TILE = DR.TILE || {};
          map[y][x].type = TILE.CAMP ?? map[y][x].type;
          map[y][x].blocked = false;
          map[y][x].waterDepth = 0;
        }
        if (objects?.[y]?.[x] && objects[y][x]?.blocked) objects[y][x] = null;
        return { x: CAMP_ARRIVAL.x, y: CAMP_ARRIVAL.y, currentZone: 'overworld', zoneKey: 'overworld', campArrival: true };
      };

      Game.prototype.applyPortalLocation = function(loc, reason = 'portal') {
        if (!loc || !this.player) return false;
        const mapSize = safeNumber(DR.CONFIG?.MAP_SIZE, 200);
        if (loc.currentZone === 'cave' || String(loc.zoneKey || '').startsWith('cave:')) {
          const caveId = loc.caveId || String(loc.zoneKey || '').split(':')[1] || this.activeCaveId || 'mossfang_cave';
          const caveFloor = Math.max(1, Math.floor(safeNumber(loc.caveFloor, 1)));
          if (typeof this.loadCaveFloor === 'function') this.loadCaveFloor(caveId, caveFloor, 'entrance');
          this.currentZone = 'cave';
          this.player.x = clamp(loc.x, 1.25, mapSize - 2.25);
          this.player.y = clamp(loc.y, 1.25, mapSize - 2.25);
        } else {
          this.currentZone = 'overworld';
          this.map = this.overworldMap || this.map;
          this.objects = this.overworldObjects || this.objects;
          this.setActiveEnemySet?.(this.overworldEnemies || []);
          this.player.x = clamp(loc.x, 1.25, mapSize - 2.25);
          this.player.y = clamp(loc.y, 1.25, mapSize - 2.25);
        }
        this.player.zone = this.portalCurrentZoneName?.() || this.currentZone || 'overworld';
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.moveBlend = 0;
        const followerCount = this.applyPortalFollowers?.(reason) || 0;
        this.clearClickMoveTarget?.();
        this.cancelPlayerEmote?.('portal');
        this.fishingSystem?.cancelFishing?.('Portal travel interrupted fishing.');
        this.resourceGatheringSystem?.cancelGathering?.('Portal travel interrupted gathering.');
        this.zoneTransitionCooldown = Math.max(safeNumber(this.zoneTransitionCooldown, 0), 0.35);
        this.staticMinimap = this.buildStaticMinimap?.() || this.staticMinimap;
        this.mapDirty = true;
        this.camera.shake = Math.min(4.5, safeNumber(this.camera?.shake, 0) + 1.2);
        this.portalRuntime.flash = { t: 0, life: 0.32, color: reason === 'return' ? '#b68cff' : '#74c7ff' };
        this.notifyExternalSystems?.('portal-teleport', { reason, location: loc, followerCount });
        return true;
      };

      Game.prototype.beginPortalCollapseFx = function(portal, reason = 'complete') {
        const runtime = this.ensurePortalRuntime();
        if (!portal) return false;
        runtime.collapseFx = {
          ...portal,
          reason,
          t: 0,
          life: reason === 'replaced' ? 0.38 : 0.52,
          zoneKey: portal.zoneKey || this.portalLocationZoneKey?.() || 'overworld'
        };
        return true;
      };

      Game.prototype.beginPortalEntryRipple = function(portal, reason = 'portal') {
        const runtime = this.ensurePortalRuntime();
        if (!portal) return false;
        runtime.entryRipple = {
          ...portal,
          reason,
          t: 0,
          life: 0.42,
          zoneKey: portal.zoneKey || this.portalLocationZoneKey?.() || 'overworld'
        };
        return true;
      };

      Game.prototype.destroyPortalLink = function(reason = 'replaced') {
        const runtime = this.ensurePortalRuntime();
        if (!runtime.link) return false;
        const entry = this.portalActiveEntry?.();
        this.beginPortalCollapseFx?.(entry, reason);
        runtime.flash = { t: 0, life: 0.22, color: '#b68cff' };
        runtime.link = null;
        if (reason && reason !== 'silent') this.log?.(`Portal closed${reason === 'complete' ? '.' : ` (${reason}).`}`);
        return true;
      };

      Game.prototype.tryCastPortalSpell = function() {
        const runtime = this.ensurePortalRuntime();
        if (!this.started || this.paused || !this.player?.alive) return false;
        if (safeNumber(runtime.cooldown, 0) > 0) {
          this.log?.(`Portal is stabilizing (${runtime.cooldown.toFixed(1)}s).`);
          return false;
        }

        // A portal ALWAYS leads back to Dead Lantern Camp; the return portal that
        // opens at camp brings you back to exactly where you cast it. (The old logic
        // treated anywhere within ~22 tiles of camp as "at camp" and sent you to a
        // stale wilderness anchor instead - that was the "random location" bug.)
        const atCamp = this.isPortalCampArea(this.player);
        let originTravel = this.capturePortalLocation(this.player.x, this.player.y);
        const destination = this.ensurePortalCampArrivalSafe();
        if (!atCamp) runtime.lastWildernessLocation = { ...originTravel };

        if (runtime.link) this.destroyPortalLink('replaced');

        const spawn = this.findPortalSpawnPoint();
        originTravel = this.capturePortalLocation(this.player.x, this.player.y);
        const originPortalLoc = this.capturePortalLocation(spawn.x, spawn.y);

        runtime.link = {
          id: `portal-${Date.now().toString(36)}-${runtime.castSerial++}`,
          phase: 'origin',
          useCount: 0,
          createdAt: performance.now(),
          spawnGrace: PORTAL_SPAWN_GRACE,
          originTravel,
          destination,
          originPortal: {
            ...originPortalLoc,
            role: 'origin',
            label: 'Portal to Camp',
            destinationZone: 'overworld',
            createdAt: performance.now()
          },
          returnPortal: null
        };
        runtime.cooldown = 0.5;
        runtime.flash = { t: 0, life: 0.22, color: '#7fc8ff' };
        this.cancelMeditation?.(this.player, 'portal cast', { silent: true });
        this.playSfx?.('magic_cast', { x: spawn.x, y: spawn.y, volume: 0.42, rate: 0.78, cooldown: 0.12 });
        this.log?.('You open a portal to Dead Lantern Camp.');
        return true;
      };

      Game.prototype.portalActiveEntry = function() {
        const runtime = this.ensurePortalRuntime();
        const link = runtime.link;
        if (!link) return null;
        if (link.phase === 'origin') return link.originPortal;
        if (link.phase === 'return') return link.returnPortal;
        return null;
      };

      Game.prototype.useActivePortal = function() {
        const runtime = this.ensurePortalRuntime();
        const link = runtime.link;
        if (!link || !this.player?.alive) return false;
        const now = performance.now();
        if (now - safeNumber(runtime.lastUseAt, 0) < 650) return false;
        runtime.lastUseAt = now;

        if (link.phase === 'origin') {
          const entryPortal = { ...link.originPortal };
          this.beginPortalEntryRipple?.(entryPortal, 'portal');
          const ok = this.applyPortalLocation(link.destination, 'portal');
          if (!ok) return false;
          link.useCount = 1;
          link.phase = 'return';
          // Open the return portal a few tiles away from where the player lands so
          // they can move about (shop, restock) and walk back through it when ready
          // - not get bounced straight back the instant they arrive.
          const returnSpot = this.findPortalPlacement(this.player.x, this.player.y, safeNumber(this.player.facingX, 1), safeNumber(this.player.facingY, 0));
          link.returnPortal = {
            ...this.capturePortalLocation(returnSpot.x, returnSpot.y),
            role: 'return',
            label: 'Return Portal',
            destinationZone: link.originTravel.currentZone || 'overworld',
            createdAt: performance.now()
          };
          link.spawnGrace = 0.48;
          this.playSfx?.('magic_cast', { x: this.player.x, y: this.player.y, volume: 0.34, rate: 1.12, cooldown: 0.18 });
          this.log?.('A return portal opens.');
          return true;
        }

        if (link.phase === 'return') {
          const entryPortal = { ...link.returnPortal };
          this.beginPortalEntryRipple?.(entryPortal, 'return');
          const ok = this.applyPortalLocation(link.originTravel, 'return');
          if (!ok) return false;
          const collapsePortal = this.capturePortalLocation?.(this.player.x, this.player.y) || entryPortal;
          this.beginPortalCollapseFx?.({ ...collapsePortal, role: 'collapsed-return', label: 'Closing Portal' }, 'complete');
          runtime.link = null;
          runtime.cooldown = 1.5;
          this.playSfx?.('magic_cast', { x: this.player.x, y: this.player.y, volume: 0.30, rate: 1.22, cooldown: 0.18 });
          this.log?.('You return through the portal. The link collapses.');
          return true;
        }
        return false;
      };

      Game.prototype.updatePortalRuntime = function(dt) {
        const runtime = this.ensurePortalRuntime();
        runtime.cooldown = Math.max(0, safeNumber(runtime.cooldown, 0) - dt);
        if (runtime.flash) {
          runtime.flash.t += dt;
          if (runtime.flash.t >= runtime.flash.life) runtime.flash = null;
        }
        if (runtime.collapseFx) {
          runtime.collapseFx.t += dt;
          if (runtime.collapseFx.t >= runtime.collapseFx.life) runtime.collapseFx = null;
        }
        if (runtime.entryRipple) {
          runtime.entryRipple.t += dt;
          if (runtime.entryRipple.t >= runtime.entryRipple.life) runtime.entryRipple = null;
        }
        this.recordPortalWildernessLocation?.();

        const link = runtime.link;
        if (!link || !this.player?.alive) return;
        link.spawnGrace = Math.max(0, safeNumber(link.spawnGrace, 0) - dt);
        if (link.spawnGrace > 0) return;
        const entry = this.portalActiveEntry?.();
        if (!entry) return;
        const playerLoc = this.capturePortalLocation(this.player.x, this.player.y);
        if (playerLoc.zoneKey !== entry.zoneKey) return;
        if (dist(this.player, entry) <= PORTAL_TRIGGER_RADIUS) this.useActivePortal?.();
      };

      Game.prototype.renderPortalVortexAt = function(ctx, portal, nowMs = performance.now(), opts = {}) {
        if (!portal || !ctx) return;
        const tile = this.tileAt?.(portal.x, portal.y) || { elev: 0 };
        const s = this.worldToScreen(portal.x, portal.y, safeNumber(tile.elev, 0) + 0.07);
        const t = nowMs * 0.001;
        const age = Math.max(0, (nowMs - safeNumber(portal.createdAt, nowMs - 360)) * 0.001);
        const open = clamp(age / 0.36, 0, 1);
        const collapseLife = safeNumber(opts.life, 0);
        const collapseT = collapseLife > 0 ? clamp(safeNumber(opts.t, 0) / collapseLife, 0, 1) : 0;
        const collapsing = !!opts.collapse;
        const stable = collapsing ? (1 - collapseT) : open;
        if (stable <= 0.01) return;
        const breath = 0.5 + Math.sin(t * 1.65 + safeNumber(portal.x) * 0.21) * 0.5;
        const fastPulse = 0.5 + Math.sin(t * 5.2 + safeNumber(portal.y) * 0.17) * 0.5;
        const entryPulse = clamp(safeNumber(opts.entryPulse, 0), 0, 1);
        const corona = 1 + entryPulse * 0.22 + (collapsing ? collapseT * 0.18 : 0);
        const squash = collapsing ? (1 - collapseT * 0.42) : (0.72 + open * 0.28);
        const stretch = collapsing ? (1 - collapseT * 0.18) : (0.82 + open * 0.18);
        const coreAlpha = stable * (0.82 + breath * 0.10 + entryPulse * 0.18);
        const cx = s.x;
        const cy = s.y - 36;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(PORTAL_VISUAL_SCALE, PORTAL_VISUAL_SCALE);
        ctx.translate(-s.x, -s.y);

        // Anchored ground light and runic circle. This is intentionally kept in
        // the portal system so the visual follows the portal lifecycle exactly.
        ctx.globalCompositeOperation = 'screen';
        const groundGlow = ctx.createRadialGradient(cx, s.y + 5, 4, cx, s.y + 5, 60);
        groundGlow.addColorStop(0, `rgba(255,244,196,${0.38 * stable})`);
        groundGlow.addColorStop(0.38, `rgba(118,216,255,${0.26 * stable})`);
        groundGlow.addColorStop(0.76, `rgba(69,92,255,${0.13 * stable})`);
        groundGlow.addColorStop(1, 'rgba(15,20,70,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = groundGlow;
        ctx.beginPath();
        ctx.ellipse(cx, s.y + 7, 46 * corona, 18 * corona, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.18 * stable;
        ctx.fillStyle = 'rgba(10, 18, 42, 0.90)';
        ctx.beginPath();
        ctx.ellipse(cx, s.y + 8, 39, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ground runes: precise segmented marks that brighten during opening and linger on collapse.
        ctx.save();
        ctx.translate(cx, s.y + 6);
        ctx.scale(1, 0.36);
        const runeGlow = 0.44 + (1 - open) * 0.22 + (collapsing ? (1 - collapseT) * 0.18 : 0);
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI * 2 / 16 + t * 0.18;
          const active = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 0.71);
          ctx.save();
          ctx.rotate(a);
          ctx.translate(31, 0);
          ctx.globalAlpha = stable * runeGlow * active;
          ctx.strokeStyle = i % 4 === 0 ? 'rgba(255,233,162,0.95)' : 'rgba(142,228,255,0.88)';
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(-3.2, -2.3);
          ctx.lineTo(0, 2.6);
          ctx.lineTo(3.2, -2.3);
          if (i % 3 === 0) {
            ctx.moveTo(-2.2, 0.2);
            ctx.lineTo(2.2, 0.2);
          }
          ctx.stroke();
          ctx.restore();
        }
        ctx.globalAlpha = 0.36 * stable;
        ctx.strokeStyle = 'rgba(255,239,181,0.92)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, 35, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Portal interior: layered calm tunnel with warm safe-haven hints.
        ctx.globalCompositeOperation = 'screen';
        const interior = ctx.createRadialGradient(cx, cy, 2, cx, cy + 1, 54);
        interior.addColorStop(0, `rgba(255,255,247,${0.88 * coreAlpha})`);
        interior.addColorStop(0.18, `rgba(185,233,255,${0.72 * coreAlpha})`);
        interior.addColorStop(0.44, `rgba(96,180,255,${0.46 * coreAlpha})`);
        interior.addColorStop(0.70, `rgba(92,115,255,${0.28 * coreAlpha})`);
        interior.addColorStop(1, 'rgba(40,40,140,0)');
        ctx.fillStyle = interior;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 25 * squash * corona, 48 * stretch * corona, 0, 0, Math.PI * 2);
        ctx.fill();

        // Slow middle-layer silhouettes and safe-haven warm lights inside the gateway.
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, 21 * squash, 42 * stretch, 0, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < 5; i++) {
          const px = cx + Math.sin(t * 0.42 + i * 1.8) * (6 + i * 2.1);
          const py = cy + 8 + Math.cos(t * 0.31 + i) * 9 + i * 3;
          ctx.globalAlpha = 0.08 * stable * (1 - collapseT);
          ctx.fillStyle = i % 2 ? 'rgba(255,218,128,0.75)' : 'rgba(255,246,194,0.65)';
          ctx.fillRect(px - 5, py - 8 - i, 10, 16 + i * 1.6);
        }
        ctx.globalAlpha = 0.16 * stable;
        ctx.fillStyle = 'rgba(255,235,164,0.80)';
        ctx.beginPath();
        ctx.ellipse(cx + Math.sin(t * 0.24) * 3, cy + 22, 10, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Braided crystalline ring. Multiple phase-offset loops create the woven frame while keeping the same footprint.
        ctx.globalCompositeOperation = 'source-over';
        for (let strand = 0; strand < 5; strand++) {
          const strandPhase = t * (0.66 + strand * 0.045) + strand * Math.PI * 0.42;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.sin(strandPhase) * 0.015);
          ctx.scale(squash, stretch);
          ctx.globalAlpha = stable * (0.56 - strand * 0.035);
          ctx.strokeStyle = strand % 2 === 0 ? 'rgba(109,219,255,0.92)' : 'rgba(255,219,132,0.82)';
          ctx.lineWidth = 4.7 - strand * 0.42;
          ctx.beginPath();
          for (let step = 0; step <= 80; step++) {
            const a = step / 80 * Math.PI * 2;
            const weave = Math.sin(a * 6 + strandPhase) * (1.2 + strand * 0.18);
            const rx = 29 + weave;
            const ry = 50 + Math.cos(a * 4 + strandPhase) * 1.3;
            const x = Math.cos(a) * rx;
            const y = Math.sin(a) * ry;
            if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        // Crisp outer rim light and crystalline facets on the ring surface.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(squash, stretch);
        ctx.globalAlpha = stable * (0.84 + fastPulse * 0.10);
        ctx.strokeStyle = 'rgba(237,251,255,0.96)';
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.ellipse(0, 0, 31.5, 52.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 18; i++) {
          const a = i * Math.PI * 2 / 18 + t * 0.085;
          const rx = 31.6 + Math.sin(i * 1.7) * 1.1;
          const ry = 52.2 + Math.cos(i * 1.1) * 1.3;
          const x = Math.cos(a) * rx;
          const y = Math.sin(a) * ry;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a + Math.PI * 0.5);
          ctx.globalAlpha = stable * (0.28 + 0.24 * Math.sin(t * 1.9 + i));
          ctx.fillStyle = i % 3 === 0 ? 'rgba(255,238,164,0.82)' : 'rgba(165,236,255,0.78)';
          ctx.beginPath();
          ctx.moveTo(0, -3.8);
          ctx.lineTo(2.8, 0.2);
          ctx.lineTo(0.4, 4.2);
          ctx.lineTo(-2.8, 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();

        // Interior spiral ribbons: foreground faster, mid-ground slower, center nearly steady.
        ctx.globalCompositeOperation = 'screen';
        for (let layer = 0; layer < 3; layer++) {
          const count = layer === 0 ? 8 : (layer === 1 ? 6 : 4);
          const speed = layer === 0 ? 3.2 : (layer === 1 ? 1.35 : 0.42);
          const alpha = layer === 0 ? 0.38 : (layer === 1 ? 0.28 : 0.18);
          for (let i = 0; i < count; i++) {
            const a = t * speed + i * Math.PI * 2 / count + layer * 0.55;
            const r0 = 5 + layer * 4 + Math.sin(t + i) * 1.4;
            const r1 = 24 - layer * 3;
            ctx.globalAlpha = stable * alpha * (0.75 + entryPulse * 0.60);
            ctx.strokeStyle = (i + layer) % 3 === 0 ? 'rgba(255,224,139,0.86)' : 'rgba(162,236,255,0.86)';
            ctx.lineWidth = layer === 0 ? 1.7 : 1.15;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r0 * squash, cy + Math.sin(a) * r0 * 1.42 * stretch);
            ctx.bezierCurveTo(
              cx + Math.cos(a + 0.85) * (r1 * 0.56) * squash,
              cy + Math.sin(a + 0.85) * (r1 * 0.95) * stretch,
              cx + Math.cos(a + 1.80) * (r1 * 0.82) * squash,
              cy + Math.sin(a + 1.80) * (r1 * 1.30) * stretch,
              cx + Math.cos(a + 2.85) * r1 * squash,
              cy + Math.sin(a + 2.85) * (r1 * 1.72) * stretch
            );
            ctx.stroke();
          }
        }

        // Orbiting runes: readable, deliberate, clockwork motion around the ring.
        ctx.globalCompositeOperation = 'source-over';
        const runeCount = 10;
        for (let i = 0; i < runeCount; i++) {
          const a = i * Math.PI * 2 / runeCount + t * 0.62;
          const x = cx + Math.cos(a) * 37 * squash;
          const y = cy + Math.sin(a) * 59 * stretch;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a + Math.PI * 0.5);
          ctx.globalAlpha = stable * (0.42 + 0.28 * Math.sin(t * 1.6 + i * 0.9));
          ctx.strokeStyle = i % 2 ? 'rgba(255,226,150,0.94)' : 'rgba(185,242,255,0.92)';
          ctx.lineWidth = 1.05;
          const size = 3.4 + (i % 3) * 0.5;
          ctx.beginPath();
          ctx.moveTo(-size, -size * 0.55);
          ctx.lineTo(0, -size);
          ctx.lineTo(size, -size * 0.55);
          ctx.moveTo(0, -size);
          ctx.lineTo(0, size);
          ctx.moveTo(-size * 0.70, size * 0.20);
          ctx.lineTo(size * 0.70, size * 0.20);
          ctx.stroke();
          ctx.restore();
        }

        // Lazy outward motes and occasional micro-flashes.
        ctx.globalCompositeOperation = 'screen';
        const moteCount = 46;
        for (let i = 0; i < moteCount; i++) {
          const phase = (i / moteCount + t * (0.055 + (i % 5) * 0.007)) % 1;
          const a = i * 2.39996323 + phase * Math.PI * 0.36;
          const r = 18 + phase * (28 + (i % 7) * 3.2);
          const x = cx + Math.cos(a) * r * squash;
          const y = cy + Math.sin(a) * r * 1.35 * stretch - phase * 11;
          const fade = Math.sin(phase * Math.PI);
          const flash = (i % 17 === 0) ? (0.5 + 0.5 * Math.sin(t * 8.0 + i)) : 0;
          ctx.globalAlpha = stable * (0.20 + fade * 0.35 + flash * 0.25);
          ctx.fillStyle = i % 4 === 0 ? '#ffffff' : (i % 4 === 1 ? '#9beaff' : (i % 4 === 2 ? '#ffdf8d' : '#c9f4ff'));
          const m = 1.2 + (i % 4) * 0.35 + flash * 1.4;
          ctx.fillRect(x - m * 0.5, y - m * 0.5, m, m);
        }

        // Entry ripple / collapse contraction overlays.
        if (entryPulse > 0.01) {
          ctx.globalCompositeOperation = 'screen';
          for (let i = 0; i < 3; i++) {
            const rp = clamp(entryPulse - i * 0.18, 0, 1);
            if (rp <= 0) continue;
            ctx.globalAlpha = (1 - rp) * 0.52 * stable;
            ctx.strokeStyle = i % 2 ? 'rgba(255,229,155,0.95)' : 'rgba(189,244,255,0.95)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(cx, cy, (8 + rp * 35) * squash, (15 + rp * 56) * stretch, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (collapsing) {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = stable * (0.30 + collapseT * 0.28);
          ctx.strokeStyle = 'rgba(255,252,230,0.94)';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.ellipse(cx, cy, (31 - collapseT * 18) * squash, (52 - collapseT * 34) * stretch, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      };

      Game.prototype.renderPortalTransientFx = function(ctx) {
        const runtime = this.ensurePortalRuntime();
        const zoneKey = this.portalLocationZoneKey?.() || 'overworld';
        if (runtime.entryRipple && runtime.entryRipple.zoneKey === zoneKey) {
          const p = clamp(runtime.entryRipple.t / Math.max(0.001, runtime.entryRipple.life), 0, 1);
          this.renderPortalVortexAt?.(ctx, runtime.entryRipple, performance.now(), { entryPulse: p });
        }
        if (runtime.collapseFx && runtime.collapseFx.zoneKey === zoneKey) {
          this.renderPortalVortexAt?.(ctx, runtime.collapseFx, performance.now(), { collapse: true, t: runtime.collapseFx.t, life: runtime.collapseFx.life });
        }
      };

      Game.prototype.renderPortalFlash = function(ctx) {
        const runtime = this.ensurePortalRuntime();
        const flash = runtime.flash;
        if (!flash || !ctx) return;
        const p = Math.max(0, Math.min(1, flash.t / Math.max(0.001, flash.life)));
        ctx.save();
        this.resetCanvasTransform?.();
        ctx.globalAlpha = (1 - p) * 0.28;
        ctx.fillStyle = flash.color || '#8fcfff';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.restore();
      };

      Game.prototype.renderPortalRuntime = function(ctx) {
        const entry = this.portalActiveEntry?.();
        if (entry) this.renderPortalVortexAt?.(ctx, entry);
        this.renderPortalTransientFx?.(ctx);
        this.renderPortalFlash?.(ctx);
      };
    }
  };
})();
