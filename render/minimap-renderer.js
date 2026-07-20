(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.MinimapRenderer = {
    install(Game) {
      Object.assign(Game.prototype, {

      // ============================================================
      // V0.17.91 Fog of War (core). Per-zone explored-tile tracking
      // (packed 1-bit/tile), reveal-on-move, permanent persistence,
      // reachable-tile exploration %, and fog compositing on the
      // minimap + world map with soft (feathered) edges.
      // ============================================================
      fogZoneKey() {
        const zone = this.currentZone || 'overworld';
        if (zone === 'cave') return `cave:${this.getActiveCaveZoneKey?.() || this.currentCave?.id || 'mossfang_cave'}:${this.currentCaveFloor || 0}`;
        if (zone === 'dungeon') return `dungeon:${this.activeDungeon?.id || this.dungeonSystem?.state?.active?.id || this.dungeonSystem?.state?.active?.dungeonId || 'dungeon'}:${this.activeDungeon?.floor || this.dungeonSystem?.state?.active?.floor || 0}`;
        // V0.20.83: was a hardcoded 'dark_woods', so Ashen Valley wrote into DARK WOODS' exploration
        // memory - and at Dark Woods' 360 size against a 450 map. That is why the new zone opened as
        // "Dark Woods - Explored 0.2%" with a single tiny revealed circle: it was reading another
        // zone's fog buffer, sized wrong. Exploration is per overworld zone.
        return String(this.activeOverworldZoneId || 'dark_woods');
      },

      ensureFogZone(key, size) {
        this.fog = this.fog || { zones: {}, discovered: {} };
        if (!this.fog.zones) this.fog.zones = {};
        if (!this.fog.discovered) this.fog.discovered = {};
        let z = this.fog.zones[key];
        if (!z || z.size !== size) {
          z = { size, bits: new Uint8Array(Math.ceil(size * size / 8)), revealed: 0, reachableTotal: 0, overlayDirty: true, overlay: null };
          this.fog.zones[key] = z;
        }
        return z;
      },

      // One-time flood fill from the camp/player over non-water land, so the
      // exploration % denominator is the reachable landmass (100% is achievable),
      // not the whole 360x360 (most of which you can never stand on).
      ensureFogReachable(z) {
        if (z.reachableTotal) return z.reachableTotal;
        const TILE = window.DreamRealms.TILE || {};
        const size = z.size;
        if (!Array.isArray(this.map) || this.map.length !== size) return 0;
        const blocked = (x, y) => {
          if (x < 0 || y < 0 || x >= size || y >= size) return true;
          const t = this.map[y]?.[x]?.type;
          return t === TILE.WATER || t === TILE.CAVE_WALL;
        };
        const seen = new Uint8Array(size * size);
        const stack = [];
        const seed = (x, y) => { if (blocked(x, y)) return; const i = y * size + x; if (seen[i]) return; seen[i] = 1; stack.push(i); };
        const sx = Math.floor(this.player?.x || (window.DreamRealms.CONFIG?.START_X || 100));
        const sy = Math.floor(this.player?.y || (window.DreamRealms.CONFIG?.START_Y || 100));
        seed(sx, sy);
        // fall back to a small scan for a walkable seed if the exact tile is blocked
        if (!stack.length) { for (let r = 1; r < 12 && !stack.length; r++) { for (let a = 0; a < 8; a++) { seed(sx + Math.round(Math.cos(a) * r), sy + Math.round(Math.sin(a) * r)); } } }
        let count = 0;
        while (stack.length) {
          const i = stack.pop(); count++;
          const x = i % size, y = (i / size) | 0;
          seed(x - 1, y); seed(x + 1, y); seed(x, y - 1); seed(x, y + 1);
        }
        z.reachableTotal = count || (size * size);
        return z.reachableTotal;
      },

      fogTileExplored(z, tx, ty) {
        if (!z || tx < 0 || ty < 0 || tx >= z.size || ty >= z.size) return false;
        const i = ty * z.size + tx;
        return (z.bits[i >> 3] & (1 << (i & 7))) !== 0;
      },

      fogSetTile(z, tx, ty) {
        if (tx < 0 || ty < 0 || tx >= z.size || ty >= z.size) return false;
        const i = ty * z.size + tx;
        const byte = i >> 3, mask = 1 << (i & 7);
        if (z.bits[byte] & mask) return false;
        z.bits[byte] |= mask;
        z.revealed++;
        return true;
      },

      fogRevealAt(px, py, radius) {
        const size = (this.activeMapSize?.()) || (this.map?.length) || 200;
        if (!Array.isArray(this.map) || this.map.length !== size) return null;
        const z = this.ensureFogZone(this.fogZoneKey(), size);
        const R = Math.max(1, Math.floor(radius || 7));
        const cx = Math.floor(px), cy = Math.floor(py);
        const R2 = (R + 0.5) * (R + 0.5);
        let changed = false;
        for (let dy = -R; dy <= R; dy++) {
          const yy = cy + dy; if (yy < 0 || yy >= size) continue;
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > R2) continue;
            if (this.fogSetTile(z, cx + dx, yy)) changed = true;
          }
        }
        if (changed) { z.overlayDirty = true; this._fogPersistDirty = true; }
        return z;
      },

      fogUpdate(dt) {
        if (!this.started || !this.player) return;
        if (!this._fogLoaded) { this._fogLoaded = true; this.loadFogLocal?.(); }
        this.fogRevealAt(this.player.x, this.player.y, this.fogRevealRadius || 10);
        this._fogSlow = (this._fogSlow || 0) + (dt || 0);
        if (this._fogSlow >= 0.5) { this._fogSlow = 0; this.checkLandmarkDiscovery?.(); }
        this._fogPersistTick = (this._fogPersistTick || 0) + (dt || 0);
        if (this._fogPersistDirty && this._fogPersistTick >= 2.5) { this._fogPersistTick = 0; this._fogPersistDirty = false; this.persistFogLocal?.(); }
      },

      fogExplorationPercent(key) {
        const z = this.fog?.zones?.[key || this.fogZoneKey()];
        if (!z) return 0;
        const total = Math.max(1, this.ensureFogReachable(z) || z.reachableTotal || (z.size * z.size));
        return Math.max(0, Math.min(100, (z.revealed / total) * 100));
      },

      // Build a tile-resolution overlay: unexplored = opaque dark, explored =
      // transparent. Drawn scaled with imageSmoothing on -> feathered edges.
      buildFogOverlay(z) {
        if (!z.overlay) z.overlay = document.createElement('canvas');
        const cv = z.overlay;
        if (cv.width !== z.size) { cv.width = z.size; cv.height = z.size; }
        const c = cv.getContext('2d');
        const img = c.createImageData(z.size, z.size);
        const d = img.data;
        const bits = z.bits;
        for (let i = 0, n = z.size * z.size; i < n; i++) {
          const explored = (bits[i >> 3] & (1 << (i & 7))) !== 0;
          const o = i * 4;
          // V0.18.3: unexplored is now FULLY opaque so the world map is black until
          // discovered (was 236 -> terrain faintly showed through). The minimap keeps its
          // softer look via a reduced composite alpha in compositeFogMinimap.
          d[o] = 3; d[o + 1] = 5; d[o + 2] = 4; d[o + 3] = explored ? 0 : 255;
        }
        c.putImageData(img, 0, 0);
        z.overlayDirty = false;
        return cv;
      },

      fogOverlayFor(key, size) {
        if (!Array.isArray(this.map)) return null;
        const z = this.ensureFogZone(key || this.fogZoneKey(), size || (this.activeMapSize?.() || this.map.length));
        if (z.overlayDirty || !z.overlay) this.buildFogOverlay(z);
        return z;
      },

      // Composite fog over the minimap (which draws the whole zone scaled to WxH).
      compositeFogMinimap(mmctx, w, h) {
        const z = this.fogOverlayFor();
        if (!z || !z.overlay) return;
        mmctx.save();
        mmctx.imageSmoothingEnabled = true;
        mmctx.globalAlpha = 0.92; // keep the minimap's softer fog; the world map stays fully black
        mmctx.drawImage(z.overlay, 0, 0, z.size, z.size, 0, 0, w, h);
        mmctx.restore();
      },

      // Composite fog over the world map's transformed sub-view.
      compositeFogWorldMap(c, surface, sx, sy, viewSize, ox, oy, size, dpr) {
        const z = this.fogOverlayFor(null, surface.tileSize ? Math.round(surface.width / surface.tileSize) : (this.activeMapSize?.() || this.map?.length));
        if (!z || !z.overlay) return;
        const scale = z.size / surface.width;
        c.save();
        c.imageSmoothingEnabled = true;
        c.drawImage(z.overlay, sx * scale, sy * scale, viewSize * scale, viewSize * scale, ox, oy, size, size);
        c.restore();
      },

      fogMarkerVisible(marker) {
        if (!marker) return false;
        if (marker.type === 'player' || marker.type === 'partyMember' || marker.alwaysShow) return true;
        const z = this.fog?.zones?.[this.fogZoneKey()];
        if (!z) return false;
        return this.fogTileExplored(z, Math.floor(Number(marker.x)), Math.floor(Number(marker.y)));
      },

      checkLandmarkDiscovery() {
        const z = this.fog?.zones?.[this.fogZoneKey()];
        if (!z) return;
        // Only true LANDMARKS/POIs raise the "Landmark Discovered" banner + XP.
        // NPCs/vendors/trainers just appear as map icons (via fogMarkerVisible)
        // when their tile is revealed - no banner spam.
        const LANDMARK_TYPES = new Set(['town', 'camp', 'landmark', 'caveEntrance', 'dungeonEntrance', 'cave', 'dungeon', 'shrine', 'boss', 'spiritHealer', 'waypoint']);
        const markers = this.collectZoneMapMarkers?.() || [];
        for (const m of markers) {
          if (!m || !m.label || !LANDMARK_TYPES.has(m.type)) continue;
          if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) continue;
          if (!this.fogTileExplored(z, Math.floor(m.x), Math.floor(m.y))) continue;
          const id = `${this.fogZoneKey()}|${m.label}|${Math.round(m.x)},${Math.round(m.y)}`;
          if (this.fog.discovered[id]) continue;
          this.fog.discovered[id] = Date.now();
          this._fogPersistDirty = true;
          this.log?.(`Landmark Discovered: ${m.label}. (Map Updated)`);
          this.spawnRing?.(Number(m.x), Number(m.y), '#ffe08a', 26);
          this.awardPlayerXp?.(Math.max(10, Math.floor((this.player?.level || 1) * 8)));
        }
      },

      // ---- persistence (localStorage per character + save-system) ----
      _fogB64(u8) { let s = ''; const chunk = 0x8000; for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk)); return btoa(s); },
      _fogFromB64(b64) { try { const s = atob(b64); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; } catch (_e) { return null; } },
      _fogStorageKey() { return `dream-realms.fog.v1:${this.player?.characterId || 'default'}`; },

      serializeFogState() {
        if (!this.fog) return null;
        const zones = {};
        for (const [key, z] of Object.entries(this.fog.zones || {})) {
          zones[key] = { size: z.size, revealed: z.revealed, reachableTotal: z.reachableTotal || 0, bits: this._fogB64(z.bits) };
        }
        return { zones, discovered: this.fog.discovered || {} };
      },

      restoreFogState(data) {
        if (!data || typeof data !== 'object') return;
        this.fog = { zones: {}, discovered: data.discovered && typeof data.discovered === 'object' ? { ...data.discovered } : {} };
        for (const [key, s] of Object.entries(data.zones || {})) {
          const size = Number(s.size) || 0; if (!size) continue;
          const bits = this._fogFromB64(s.bits) || new Uint8Array(Math.ceil(size * size / 8));
          this.fog.zones[key] = { size, bits, revealed: Number(s.revealed) || 0, reachableTotal: Number(s.reachableTotal) || 0, overlayDirty: true, overlay: null };
        }
      },

      persistFogLocal() {
        try { window.localStorage?.setItem(this._fogStorageKey(), JSON.stringify(this.serializeFogState())); } catch (_e) {}
      },

      loadFogLocal() {
        try {
          const raw = window.localStorage?.getItem(this._fogStorageKey());
          if (raw) this.restoreFogState(JSON.parse(raw));
        } catch (_e) {}
        if (!this.fog) this.fog = { zones: {}, discovered: {} };
      },

dungeonNavigationMarkers() {
      if (this.currentZone !== 'dungeon') return [];
      const out = [];
      const push = (x, y, kind, label, color, radius = 3.5) => {
        const nx = Number(x);
        const ny = Number(y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
        out.push({ x: nx + 0.5, y: ny + 0.5, kind, label, color, radius });
      };
      const objects = this.objects || this.dungeonObjects || [];
      for (let y = 0; y < objects.length; y++) {
        const row = objects[y] || [];
        for (let x = 0; x < row.length; x++) {
          const obj = row[x];
          if (!obj) continue;
          switch (obj.type) {
            case 'dungeonExit': push(x, y, 'exit', 'EXIT', '#f0dca0', 4.2); break;
            case 'dungeonStairs': push(x, y, 'stairs', obj.nextFloor ? `F${obj.nextFloor}` : 'DOWN', '#8df0bc', 4.2); break;
            case 'dungeonTreasure': push(x, y, 'treasure', 'LOOT', '#d8ad57', 4.6); break;
            case 'webGate': push(x, y, 'gate', obj.opened ? 'OPEN' : 'GATE', obj.opened ? '#9f8cb5' : '#d68cff', 4.4); break;
            case 'webAnchor': push(x, y, 'anchor', obj.opened || obj.severed ? 'CUT' : 'ANCHOR', obj.opened || obj.severed ? '#816199' : '#f0c6ff', 3.6); break;
            case 'silkCocoon':
              if (obj.cocoonType === 'survivor') push(x, y, 'cocoon', 'COCOON', obj.opened ? '#9f8cb5' : '#d8c8f2', 3.2);
              break;
            default:
              break;
          }
        }
      }
      const enemies = this.enemies || this.dungeonEnemies || [];
      for (const enemy of enemies) {
        if (!enemy || enemy.alive === false) continue;
        if (enemy.dungeonBoss) push(Math.floor(enemy.x), Math.floor(enemy.y), 'boss', 'BOSS', '#ff6f6f', 5.2);
        else if (enemy.dungeonMiniBoss) push(Math.floor(enemy.x), Math.floor(enemy.y), 'miniboss', 'MINI', '#ffb86a', 4.5);
      }
      const seen = new Set();
      return out.filter((marker) => {
        const key = `${marker.kind}:${Math.floor(marker.x)}:${Math.floor(marker.y)}:${marker.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    drawDungeonRoomMapOverlay(c, ox, oy, sx, sy, dpr, compact = false) {
      if (this.currentZone !== 'dungeon') return;
      const rooms = this.dungeonRooms || [];
      const roomById = new Map(rooms.map(room => [room.id || room.name || `${room.x},${room.y}`, room]));
      const links = this.dungeonLayoutLinks || this.dungeonNavigation?.links || [];
      c.save();
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const link of links) {
        const a = roomById.get(link.from || link[0]);
        const b = roomById.get(link.to || link[1]);
        if (!a || !b) continue;
        c.globalAlpha = compact ? 0.42 : 0.58;
        c.strokeStyle = this.currentZone === 'dungeon' ? 'rgba(216,200,242,0.72)' : 'rgba(216,200,242,0.5)';
        c.lineWidth = Math.max(1.5, (compact ? 1.8 : 2.8) * dpr);
        c.beginPath();
        c.moveTo(ox + a.x * sx, oy + a.y * sy);
        c.lineTo(ox + b.x * sx, oy + b.y * sy);
        c.stroke();
      }
      c.restore();
      const kindColor = {
        safe_entry: '#f0dca0',
        combat: '#a777c9',
        egg_room: '#d8c8f2',
        web_choke: '#8df0bc',
        puzzle: '#d68cff',
        boss: '#ff6f6f',
        treasure: '#d8ad57'
      };
      c.save();
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      for (const room of rooms) {
        const x = ox + (room.x - room.w * 0.5) * sx;
        const y = oy + (room.y - room.h * 0.5) * sy;
        const w = Math.max(2, room.w * sx);
        const h = Math.max(2, room.h * sy);
        const color = room.mapColor || kindColor[room.kind] || '#d6e4cf';
        c.globalAlpha = compact ? 0.18 : 0.22;
        c.fillStyle = color;
        c.fillRect(x, y, w, h);
        c.globalAlpha = compact ? 0.55 : 0.78;
        c.strokeStyle = color;
        c.lineWidth = Math.max(1, compact ? 0.8 * dpr : 1.2 * dpr);
        c.strokeRect(x, y, w, h);
        if (!compact && room.name) {
          c.globalAlpha = 0.95;
          c.fillStyle = '#f4dfae';
          c.font = `${Math.max(8, 9 * dpr)}px ui-monospace, monospace`;
          const label = String(room.name).replace(/ Chamber$/i, '').replace(/ Crossing$/i, '');
          c.fillText(label, ox + room.x * sx, oy + room.y * sy);
        }
      }
      c.globalAlpha = 1;
      c.restore();
    },

    drawDungeonNavigationMapMarkers(c, ox, oy, sx, sy, dpr, compact = false) {
      if (this.currentZone !== 'dungeon') return;
      const markers = this.dungeonNavigationMarkers?.() || [];
      c.save();
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      for (const marker of markers) {
        const px = ox + marker.x * sx;
        const py = oy + marker.y * sy;
        const r = Math.max(2, (marker.radius || 3.5) * (compact ? 0.55 : 1) * dpr);
        c.fillStyle = marker.color || '#d6e4cf';
        c.strokeStyle = 'rgba(10,8,8,0.85)';
        c.lineWidth = Math.max(1, 1.2 * dpr);
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        if (!compact) {
          c.fillStyle = '#f8ecd0';
          c.font = `${Math.max(8, 8.5 * dpr)}px ui-monospace, monospace`;
          c.fillText(marker.label || marker.kind, px, py - r - 8 * dpr);
        }
      }
      c.restore();
    },

    mapCompanionMarkers() {
      const out = [];
      const zone = this.currentZone || 'overworld';
      const push = (actor, kind) => {
        if (!actor || actor === this.player) return;
        if (actor.alive === false) return;
        const actorZone = actor.zone || zone;
        if (actorZone !== zone) return;
        const x = Number(actor.x);
        const y = Number(actor.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        out.push({ x, y, kind, name: actor.name || kind });
      };
      push(this.merc, 'merc');
      push(this.pet, 'pet');
      for (const bot of this.botPlayers || []) push(bot, 'bot');
      for (const bot of this.botPartyMembers || []) push(bot, 'bot');
      const seen = new Set();
      return out.filter((m) => {
        const key = `${m.kind}:${m.name}:${m.x.toFixed(2)}:${m.y.toFixed(2)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

zoneMapKey() {
      const map = this.map || [];
      const w = map[0]?.length || 0;
      const h = map.length || 0;
      const zone = this.currentZone || 'overworld';
      const cave = this.currentCave?.id || this.currentCave?.name || '';
      const caveFloor = this.currentCaveFloor || 0;
      const dungeon = this.activeDungeon?.id || this.dungeonSystem?.state?.active?.id || this.dungeonSystem?.state?.active?.dungeonId || '';
      const dungeonFloor = this.activeDungeon?.floor || this.dungeonSystem?.state?.active?.floor || 0;
      const dirty = this.mapDirty ? 'dirty' : 'clean';
      return `${zone}:${cave}:${caveFloor}:${dungeon}:${dungeonFloor}:${w}x${h}:${dirty}`;
    },

    ensureZoneMapCache() {
      if (!this.zoneMapCache || !(this.zoneMapCache instanceof Map)) this.zoneMapCache = new Map();
      return this.zoneMapCache;
    },

    normalizeMapViewState(surface = null) {
      const size = Math.max(1, Math.min(surface?.width || 1, surface?.height || 1));
      if (!this.mapView || typeof this.mapView !== 'object') {
        this.mapView = { zoom: 1, centerX: size * 0.5, centerY: size * 0.5, dragging: false, hoverMarker: null, bound: false };
      }
      const view = this.mapView;
      view.zoom = Math.max(0.5, Math.min(4, Number(view.zoom) || 1));
      if (!Number.isFinite(view.centerX)) view.centerX = size * 0.5;
      if (!Number.isFinite(view.centerY)) view.centerY = size * 0.5;
      if (!Number.isFinite(view.lastSurfaceSize) || view.lastSurfaceSize !== size) {
        view.centerX = Math.max(0, Math.min(size, view.centerX));
        view.centerY = Math.max(0, Math.min(size, view.centerY));
        view.lastSurfaceSize = size;
      }
      return view;
    },

    activeMapDimensions() {
      const map = this.map || [];
      return { width: map[0]?.length || 0, height: map.length || 0 };
    },

    mapZoneLabel() {
      if (this.currentZone === 'dungeon') {
        const active = this.activeDungeon || this.dungeonSystem?.state?.active || {};
        const meta = this.dungeonFloorMeta || {};
        return `${active.name || active.dungeonName || 'Silk Web Cavern'} · F${active.floor || 1}/${active.floors || 1}${meta.name ? ` · ${meta.name}` : ''}`;
      }
      if (this.currentZone === 'cave') {
        const caveName = this.currentCave?.name || 'Cave';
        const floor = Math.max(1, Math.floor(this.currentCaveFloor || 1));
        const floors = Math.max(1, Math.floor(this.currentCave?.floors || this.currentCaveFloors || 1));
        return `${caveName} · F${floor}/${floors}`;
      }
      // V0.20.83: was a hardcoded 'Dark Woods', so standing in Ashen Valley showed the wrong zone name
      // across the whole map panel. Reads the active overworld zone's authored name instead.
      const zoneId = this.activeOverworldZoneId || 'dark_woods';
      return window.DreamRealms?.DEFAULT_WORLD?.zones?.[zoneId]?.name || 'Dark Woods';
    },

    // V0.20.84: the HUD's zone line under the mini-map was STATIC HTML that nothing ever updated -
    // it had read "Blackroot / Dark Woods - 200x200" since before Dark Woods was resized to 360, so it
    // was wrong about the size for many versions and wrong about the zone as soon as a second one
    // existed. Now derived from the live zone.
    //
    // Guarded by a cached string so it only touches the DOM when the text actually changes: this runs
    // from drawMinimap, i.e. every frame, and this project has spent many versions fighting for frame
    // time. A per-frame DOM write for an unchanged label would be pure waste.
    syncMinimapZoneLine() {
      const el = document.getElementById('minimapZoneLine');
      if (!el) return;
      // Deliberately the literal product name, NOT DR.DEFAULT_WORLD.worldName - that field still reads
      // 'Dream Realms' because it is part of the persisted save schema, and using it here would regress
      // the HUD branding to the old name.
      const world = 'Blackroot';
      const zoneName = this.mapZoneLabel?.() || 'Dark Woods';
      const w = this.map?.[0]?.length || this.map?.length || 0;
      const h = this.map?.length || 0;
      const text = `${world} / ${zoneName} · ${w}×${h}`;
      if (this._minimapZoneLineText === text) return;
      this._minimapZoneLineText = text;
      el.textContent = text;
    },

    mapColorForTile(tile, x, y) {
      const DR = window.DreamRealms || {};
      const TILE = DR.TILE || {};
      const def = DR.TILE_DEF?.[tile?.type] || {};
      const base = def.top || '#31432a';
      const shadeHex = (hex, amount) => {
        const value = String(hex || '#000000').replace('#', '');
        if (value.length < 6) return hex || '#000000';
        const n = parseInt(value.slice(0, 6), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let b = n & 255;
        r = Math.max(0, Math.min(255, Math.round(r + amount)));
        g = Math.max(0, Math.min(255, Math.round(g + amount)));
        b = Math.max(0, Math.min(255, Math.round(b + amount)));
        return `rgb(${r},${g},${b})`;
      };
      const elev = Number(tile?.elev) || 0;
      const noise = (((x * 928371 + y * 364479) & 15) - 7) * 1.6;
      if (tile?.type === TILE.WATER) return shadeHex(base, noise - 8);
      if (tile?.blocked && tile?.type !== TILE.CAVE_WALL) return shadeHex(base, noise - 18);
      return shadeHex(base, noise + elev * 5);
    },

    buildDetailedZoneMapSurface() {
      const DR = window.DreamRealms || {};
      const TILE = DR.TILE || {};
      const map = this.map || [];
      const objects = this.objects || [];
      const width = map[0]?.length || DR.CONFIG?.MAP_SIZE || 200;
      const height = map.length || DR.CONFIG?.MAP_SIZE || 200;
      const pixelsPerTile = width > 220 || height > 220 ? 3 : 4;
      const off = document.createElement('canvas');
      off.width = Math.max(1, width * pixelsPerTile);
      off.height = Math.max(1, height * pixelsPerTile);
      const c = off.getContext('2d', { alpha: false });
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#061008';
      c.fillRect(0, 0, off.width, off.height);

      for (let y = 0; y < height; y++) {
        const row = map[y] || [];
        for (let x = 0; x < width; x++) {
          const tile = row[x];
          if (!tile) continue;
          c.fillStyle = this.mapColorForTile(tile, x, y);
          c.fillRect(x * pixelsPerTile, y * pixelsPerTile, pixelsPerTile, pixelsPerTile);
        }
      }

      // Material adjacency passes: light shore/road/camp edges generated from real tile data.
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const tile = map[y]?.[x];
          if (!tile) continue;
          const px = x * pixelsPerTile;
          const py = y * pixelsPerTile;
          const n = map[y - 1]?.[x];
          const s = map[y + 1]?.[x];
          const e = map[y]?.[x + 1];
          const w = map[y]?.[x - 1];
          const nearWater = [n, s, e, w].some(t => t?.type === TILE.WATER);
          const isWater = tile.type === TILE.WATER;
          if (!isWater && nearWater) {
            c.fillStyle = 'rgba(202,188,128,0.55)';
            if (n?.type === TILE.WATER) c.fillRect(px, py, pixelsPerTile, 1);
            if (s?.type === TILE.WATER) c.fillRect(px, py + pixelsPerTile - 1, pixelsPerTile, 1);
            if (w?.type === TILE.WATER) c.fillRect(px, py, 1, pixelsPerTile);
            if (e?.type === TILE.WATER) c.fillRect(px + pixelsPerTile - 1, py, 1, pixelsPerTile);
          }
          if (tile.type === TILE.DIRT || tile.type === TILE.CAMP || tile.type === TILE.RUIN || tile.type === TILE.STONE) {
            c.fillStyle = tile.type === TILE.CAMP ? 'rgba(235,188,112,0.34)' : 'rgba(224,181,106,0.24)';
            c.fillRect(px, py, pixelsPerTile, pixelsPerTile);
          }
          const elev = Number(tile.elev) || 0;
          const lowerNeighbor = [n, s, e, w].some(t => t && (Number(t.elev) || 0) < elev);
          if (lowerNeighbor || tile.blocked) {
            c.fillStyle = tile.type === TILE.CAVE_WALL ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.16)';
            c.fillRect(px, py, pixelsPerTile, pixelsPerTile);
          }
        }
      }

      const objectColors = {
        cave: '#8df0bc', dungeonGate: '#a987ff', dungeonEntrance: '#a987ff', caveEntrance: '#8df0bc',
        townHouse: '#b9b09a', shop: '#d8ad57', vendorStall: '#d8ad57', campStall: '#d8ad57',
        largeCampTent: '#c59a63', tent: '#c59a63', fire: '#ffb35e', mercpost: '#83b7ff',
        forge: '#d0b070', loom: '#d8c8f2', well: '#8fb3c7', ruinWall: '#aaa48b', ruinPillar: '#aaa48b',
        evilTree: '#5dd174', rootArch: '#5d9b45', mineSupport: '#b88a5e', crystalNode: '#83d8ff',
        glowMushroom: '#9f8cff', lanternPost: '#f0dca0', caveWeb: '#d8c8f2', bones: '#e3dcc7', oreNode: '#b9b09a'
      };
      for (let y = 0; y < height; y++) {
        const row = objects[y] || [];
        for (let x = 0; x < width; x++) {
          const obj = row[x];
          if (!obj) continue;
          const color = objectColors[obj.type] || null;
          if (!color) continue;
          const cx = x * pixelsPerTile + pixelsPerTile * 0.5;
          const cy = y * pixelsPerTile + pixelsPerTile * 0.5;
          const r = Math.max(1.2, pixelsPerTile * (obj.landmark ? 1.2 : 0.72));
          c.fillStyle = color;
          c.fillRect(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), Math.max(1, Math.round(r)), Math.max(1, Math.round(r)));
        }
      }

      return { canvas: off, width: off.width, height: off.height, pixelsPerTile, mapWidth: width, mapHeight: height };
    },

    getOrBuildDetailedZoneMapSurface() {
      const cache = this.ensureZoneMapCache();
      const key = this.zoneMapKey();
      const cached = cache.get(key);
      if (cached?.surface && !this.mapDirty) return cached.surface;
      const surface = this.buildDetailedZoneMapSurface();
      cache.clear();
      cache.set(key, { surface });
      this.mapDirty = false;
      return surface;
    },

    currentNpcZoneKey() {
      if (this.currentZone === 'dungeon') {
        const active = this.activeDungeon || this.dungeonSystem?.state?.active || {};
        const dungeonId = active.id || active.dungeonId || 'silk_web_cavern';
        const floor = active.floor || this.currentDungeonFloor || 1;
        return `${dungeonId}_floor${floor}`;
      }
      if (this.currentZone === 'cave') return this.currentCave?.id || 'mossfang_cave';
      return 'dark_woods';
    },

    collectZoneMapMarkers(surface) {
      const markers = [];
      const add = (x, y, type, label, color, priority = 1) => {
        const nx = Number(x);
        const ny = Number(y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
        markers.push({ x: nx, y: ny, type, label: label || type, color, priority });
      };
      const zoneKey = this.currentNpcZoneKey?.() || 'dark_woods';
      const npcGrid = this.editorNpcs?.[zoneKey] || {};
      for (const node of Object.values(npcGrid)) {
        if (!node) continue;
        if (node._asleep) continue; // V0.20.44: sleeping NPCs are tucked in tents; keep them off the minimap
        const role = String(node.role || node.npcRole || node.visualRole || '').toLowerCase();
        const tags = Array.isArray(node.vendorTags) ? node.vendorTags.join(' ').toLowerCase() : '';
        if (role.includes('spirit') || tags.includes('spirit') || node.rendererId === 'spiritHealer') add(node.x, node.y, 'spiritHealer', node.name || 'Spirit Healer', '#d8f6ff', 5);
        else if (Array.isArray(node.questIds) && node.questIds.length) add(node.x, node.y, 'questGiver', node.name || 'Quest', '#ffd966', 4);
        else if (node.trainerClass || role.includes('trainer')) add(node.x, node.y, 'trainer', node.name || node.trainerClass || 'Trainer', '#c991ff', 3);
        else if (node.vendor || node.shopId || tags.includes('shop') || tags.includes('food') || tags.includes('tools')) add(node.x, node.y, 'vendor', node.name || 'Vendor', '#d8ad57', 3);
        else add(node.x, node.y, 'npc', node.name || 'NPC', '#d6e4cf', 1);
      }

      if (this.currentZone !== 'cave' && this.currentZone !== 'dungeon') {
        add(window.DreamRealms?.CONFIG?.START_X || 100, window.DreamRealms?.CONFIG?.START_Y || 100, 'town', 'Dead Lantern Town', '#e0b95d', 5);
        add(80, 116, 'camp', 'Lanternfall Hamlet', '#d0b070', 3);
        add(123, 113, 'camp', 'Briar Watch', '#d0b070', 3);
        add(150, 88, 'landmark', 'Gloomheart Tree', '#76d16b', 3);
        add(137, 68, 'landmark', 'Old Ruins', '#b9b09a', 3);
        add(160, 124, 'landmark', 'Crystal Lake', '#83d8ff', 2);
        for (const cave of this.caveEntrances || []) {
          const id = String(cave.caveId || cave.id || cave.name || '').toLowerCase();
          const dungeon = id.includes('silk') || String(cave.name || '').toLowerCase().includes('silk');
          add(cave.x, cave.y, dungeon ? 'dungeonEntrance' : 'caveEntrance', cave.name || (dungeon ? 'Silk Web Cavern' : 'Cave'), dungeon ? '#a987ff' : '#8df0bc', dungeon ? 5 : 4);
        }
      }

      const objects = this.objects || [];
      for (let y = 0; y < objects.length; y++) {
        const row = objects[y] || [];
        for (let x = 0; x < row.length; x++) {
          const obj = row[x];
          if (!obj) continue;
          if (obj.type === 'caveExit') add(x, y, 'exit', 'Exit', '#f0dca0', 4);
          else if (obj.type === 'caveStairsDown' || obj.type === 'caveStairsUp' || obj.type === 'dungeonStairs') add(x, y, 'stairs', obj.type.includes('Down') ? 'Down' : 'Up', '#8df0bc', 4);
          else if (obj.type === 'dungeonGate' || obj.type === 'dungeonEntrance') add(x, y, 'dungeonEntrance', obj.name || 'Dungeon', '#a987ff', 5);
          else if (obj.type === 'cave') add(x, y, 'caveEntrance', obj.name || 'Cave', '#8df0bc', 4);
        }
      }

      if (this.currentZone === 'dungeon') {
        for (const marker of this.dungeonNavigationMarkers?.() || []) add(marker.x, marker.y, marker.kind, marker.label, marker.color, 4);
      }

      if (this.player) add(this.player.x, this.player.y, 'player', 'You', '#ffe08a', 10);
      for (const ally of this.mapCompanionMarkers?.() || []) add(ally.x, ally.y, 'partyMember', ally.name || 'Party', '#3ea6ff', 8);
      return markers.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    },

    mapSourceToCanvas(marker, surface, area, view) {
      const mapW = Math.max(1, surface.mapWidth || 1);
      const mapH = Math.max(1, surface.mapHeight || 1);
      const sourceX = (Number(marker.x) / mapW) * surface.width;
      const sourceY = (Number(marker.y) / mapH) * surface.height;
      const viewSize = Math.min(surface.width, surface.height) / Math.max(0.5, view.zoom || 1);
      const half = viewSize * 0.5;
      const cx = Math.max(half, Math.min(surface.width - half, view.centerX));
      const cy = Math.max(half, Math.min(surface.height - half, view.centerY));
      return {
        x: area.x + ((sourceX - (cx - half)) / viewSize) * area.size,
        y: area.y + ((sourceY - (cy - half)) / viewSize) * area.size
      };
    },

    clampMapViewToSurface(surface) {
      const view = this.normalizeMapViewState(surface);
      const viewSize = Math.min(surface.width, surface.height) / Math.max(0.5, view.zoom || 1);
      const half = viewSize * 0.5;
      view.centerX = Math.max(half, Math.min(surface.width - half, view.centerX));
      view.centerY = Math.max(half, Math.min(surface.height - half, view.centerY));
      return view;
    },

    recenterWorldMap() {
      const surface = this.getOrBuildDetailedZoneMapSurface?.();
      const view = this.normalizeMapViewState(surface);
      const w = Math.max(1, surface?.mapWidth || this.map?.[0]?.length || 1);
      const h = Math.max(1, surface?.mapHeight || this.map?.length || 1);
      if (this.player) {
        view.centerX = (this.player.x / w) * surface.width;
        view.centerY = (this.player.y / h) * surface.height;
      } else {
        view.centerX = surface.width * 0.5;
        view.centerY = surface.height * 0.5;
      }
      this.clampMapViewToSurface(surface);
      this.drawWorldMap?.();
    },

    zoomWorldMap(delta, canvasX = null, canvasY = null) {
      const surface = this.getOrBuildDetailedZoneMapSurface?.();
      const view = this.clampMapViewToSurface(surface);
      const oldZoom = view.zoom;
      const newZoom = Math.max(0.5, Math.min(4, oldZoom * (delta > 0 ? 1.18 : 1 / 1.18)));
      if (Math.abs(newZoom - oldZoom) < 0.001) return;
      const metrics = this.currentMapDrawMetrics || null;
      if (metrics && Number.isFinite(canvasX) && Number.isFinite(canvasY)) {
        const oldViewSize = Math.min(surface.width, surface.height) / oldZoom;
        const newViewSize = Math.min(surface.width, surface.height) / newZoom;
        const oldHalf = oldViewSize * 0.5;
        const localX = Math.max(0, Math.min(1, (canvasX - metrics.area.x) / metrics.area.size));
        const localY = Math.max(0, Math.min(1, (canvasY - metrics.area.y) / metrics.area.size));
        const sourceX = (view.centerX - oldHalf) + localX * oldViewSize;
        const sourceY = (view.centerY - oldHalf) + localY * oldViewSize;
        view.centerX = sourceX - (localX - 0.5) * newViewSize;
        view.centerY = sourceY - (localY - 0.5) * newViewSize;
      }
      view.zoom = newZoom;
      this.clampMapViewToSurface(surface);
      this.drawWorldMap?.();
    },

    ensureMapUiBindings() {
      const ui = window.DreamRealms?.runtime?.ui || {};
      const canvasMap = ui.worldMap || document.getElementById('worldMap');
      if (!canvasMap || canvasMap.dataset.mapUiBound === '1') return;
      canvasMap.dataset.mapUiBound = '1';
      const toCanvasPoint = (event) => {
        const rect = canvasMap.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        return { x: (event.clientX - rect.left) * dpr, y: (event.clientY - rect.top) * dpr };
      };
      canvasMap.addEventListener('wheel', event => {
        if (!this.mapOpen) return;
        event.preventDefault();
        const p = toCanvasPoint(event);
        this.zoomWorldMap?.(event.deltaY < 0 ? 1 : -1, p.x, p.y);
      }, { passive: false });
      canvasMap.addEventListener('mousedown', event => {
        if (!this.mapOpen || event.button !== 0) return;
        const view = this.normalizeMapViewState(this.getOrBuildDetailedZoneMapSurface?.());
        const p = toCanvasPoint(event);
        view.dragging = true;
        view.dragStartX = p.x;
        view.dragStartY = p.y;
        view.dragCenterX = view.centerX;
        view.dragCenterY = view.centerY;
        event.preventDefault();
      });
      window.addEventListener('mousemove', event => {
        if (!this.mapOpen || !this.mapView?.dragging) return;
        const surface = this.getOrBuildDetailedZoneMapSurface?.();
        const metrics = this.currentMapDrawMetrics || null;
        if (!surface || !metrics) return;
        const p = toCanvasPoint(event);
        const viewSize = Math.min(surface.width, surface.height) / Math.max(0.5, this.mapView.zoom || 1);
        const sourcePerPixel = viewSize / Math.max(1, metrics.area.size);
        this.mapView.centerX = this.mapView.dragCenterX - (p.x - this.mapView.dragStartX) * sourcePerPixel;
        this.mapView.centerY = this.mapView.dragCenterY - (p.y - this.mapView.dragStartY) * sourcePerPixel;
        this.clampMapViewToSurface(surface);
        this.drawWorldMap?.();
      });
      window.addEventListener('mouseup', () => { if (this.mapView) this.mapView.dragging = false; });
      canvasMap.addEventListener('mousemove', event => {
        if (!this.mapOpen) return;
        const p = toCanvasPoint(event);
        const metrics = this.currentMapDrawMetrics;
        const markers = metrics?.markers || [];
        let best = null;
        let bestD = Infinity;
        for (const marker of markers) {
          const dx = marker.screenX - p.x;
          const dy = marker.screenY - p.y;
          const d = dx * dx + dy * dy;
          const radius = marker.hitRadius || 10;
          if (d <= radius * radius && d < bestD) { best = marker; bestD = d; }
        }
        if ((this.mapView.hoverMarker?.label || '') !== (best?.label || '')) {
          this.mapView.hoverMarker = best;
          this.drawWorldMap?.();
        }
      });
      canvasMap.addEventListener('mouseleave', () => {
        if (this.mapView?.hoverMarker) {
          this.mapView.hoverMarker = null;
          this.drawWorldMap?.();
        }
      });
      const bindButton = (id, fn) => {
        const btn = document.getElementById(id);
        if (!btn || btn.dataset.mapUiBound === '1') return;
        btn.dataset.mapUiBound = '1';
        btn.addEventListener('click', event => { event.preventDefault(); fn(); });
      };
      bindButton('mapZoomInBtn', () => this.zoomWorldMap?.(1));
      bindButton('mapZoomOutBtn', () => this.zoomWorldMap?.(-1));
      bindButton('mapRecenterBtn', () => this.recenterWorldMap?.());
    },

drawWorldMap() {
      const DR = window.DreamRealms;
      const { CONFIG } = DR;
      const { ui } = DR.runtime || {};
      const canvasMap = ui.worldMap;
      if (!canvasMap) return;
      this.ensureMapUiBindings?.();
      const c = canvasMap.getContext('2d', { alpha: false });
      const rect = canvasMap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvasMap.width !== w || canvasMap.height !== h) {
        canvasMap.width = w;
        canvasMap.height = h;
      }
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#050806';
      c.fillRect(0, 0, w, h);
      const surface = this.getOrBuildDetailedZoneMapSurface?.();
      if (!surface?.canvas) return;
      const view = this.clampMapViewToSurface(surface);
      if (!view.initializedForZone || view.zoneKey !== this.zoneMapKey?.()) {
        view.zoneKey = this.zoneMapKey?.();
        view.initializedForZone = true;
        this.recenterWorldMap?.();
        return;
      }
      const mapInset = 14 * dpr;
      const titleH = 34 * dpr;
      const size = Math.max(1, Math.min(w - mapInset * 2, h - mapInset * 2 - titleH));
      const ox = (w - size) * 0.5;
      const oy = titleH + Math.max(mapInset, (h - titleH - size) * 0.5);
      const viewSize = Math.min(surface.width, surface.height) / Math.max(0.5, view.zoom || 1);
      const half = viewSize * 0.5;
      const sx = Math.max(0, Math.min(surface.width - viewSize, view.centerX - half));
      const sy = Math.max(0, Math.min(surface.height - viewSize, view.centerY - half));

      c.fillStyle = 'rgba(13,18,12,0.94)';
      c.fillRect(ox - 4 * dpr, oy - 4 * dpr, size + 8 * dpr, size + 8 * dpr);
      c.drawImage(surface.canvas, sx, sy, viewSize, viewSize, ox, oy, size, size);
      this.compositeFogWorldMap?.(c, surface, sx, sy, viewSize, ox, oy, size, dpr);
      if (this.currentZone === 'dungeon') {
        // Keep existing dungeon navigation overlays; they are drawn over the zone-data cache and use the same transformed view.
        const dungeonMarkers = this.dungeonNavigationMarkers?.() || [];
        for (const marker of dungeonMarkers) {
          const screen = this.mapSourceToCanvas(marker, surface, { x: ox, y: oy, size }, view);
          if (screen.x < ox || screen.y < oy || screen.x > ox + size || screen.y > oy + size) continue;
          c.fillStyle = marker.color || '#d6e4cf';
          c.strokeStyle = 'rgba(10,8,8,0.85)';
          c.lineWidth = Math.max(1, 1.1 * dpr);
          c.beginPath();
          c.arc(screen.x, screen.y, Math.max(3, 4 * dpr), 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      }
      c.strokeStyle = 'rgba(235,220,170,0.62)';
      c.lineWidth = 2 * dpr;
      c.strokeRect(ox, oy, size, size);

      const markers = this.collectZoneMapMarkers?.(surface) || [];
      const drawnMarkers = [];
      const drawMarker = (marker) => {
        // V0.17.91 fog: only show icons for places the player has discovered.
        if (this.fogMarkerVisible && !this.fogMarkerVisible(marker)) return;
        const screen = this.mapSourceToCanvas(marker, surface, { x: ox, y: oy, size }, view);
        if (screen.x < ox - 12 * dpr || screen.y < oy - 12 * dpr || screen.x > ox + size + 12 * dpr || screen.y > oy + size + 12 * dpr) return;
        const type = marker.type;
        const radius = type === 'player' ? 6.5 * dpr : type === 'partyMember' ? 4.8 * dpr : 4.2 * dpr;
        c.save();
        c.fillStyle = marker.color || '#d6e4cf';
        c.strokeStyle = type === 'player' ? 'rgba(255,255,255,0.95)' : 'rgba(8,10,8,0.86)';
        c.lineWidth = Math.max(1, 1.3 * dpr);
        if (type === 'player') {
          c.beginPath();
          c.moveTo(screen.x, screen.y - radius);
          c.lineTo(screen.x + radius * 0.8, screen.y + radius * 0.85);
          c.lineTo(screen.x, screen.y + radius * 0.45);
          c.lineTo(screen.x - radius * 0.8, screen.y + radius * 0.85);
          c.closePath();
          c.fill(); c.stroke();
        } else if (type === 'dungeonEntrance' || type === 'caveEntrance' || type === 'exit' || type === 'stairs') {
          c.beginPath();
          c.rect(screen.x - radius, screen.y - radius, radius * 2, radius * 2);
          c.fill(); c.stroke();
        } else if (type === 'questGiver') {
          c.font = `${Math.max(10, 12 * dpr)}px ui-monospace, monospace`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.strokeStyle = 'rgba(0,0,0,0.85)';
          c.lineWidth = Math.max(2, 2.6 * dpr);
          c.strokeText('!', screen.x, screen.y);
          c.fillText('!', screen.x, screen.y);
        } else {
          c.beginPath();
          c.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
          c.fill(); c.stroke();
        }
        c.restore();
        drawnMarkers.push({ ...marker, screenX: screen.x, screenY: screen.y, hitRadius: Math.max(10 * dpr, radius * 1.8) });
      };
      for (const marker of markers) drawMarker(marker);

      c.fillStyle = '#f4dfae';
      c.font = `${Math.max(12, 14 * dpr)}px ui-monospace, monospace`;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      const explored = this.fogExplorationPercent ? this.fogExplorationPercent() : 0;
      c.fillText(`${this.mapZoneLabel?.() || 'Zone Map'} · Explored ${explored.toFixed(1)}% · ${Math.round((view.zoom || 1) * 100)}%`, ox, 8 * dpr);
      c.fillStyle = '#aebca3';
      c.font = `${Math.max(9, 10 * dpr)}px ui-monospace, monospace`;
      c.fillText('Wheel/+/- zoom · drag pan · Center returns to player', ox, 23 * dpr);

      const hover = this.mapView?.hoverMarker;
      if (hover) {
        const label = `${hover.label || hover.type}`;
        const px = Math.max(ox + 8 * dpr, Math.min(ox + size - 180 * dpr, hover.screenX + 12 * dpr));
        const py = Math.max(oy + 8 * dpr, Math.min(oy + size - 34 * dpr, hover.screenY + 12 * dpr));
        c.font = `${Math.max(10, 11 * dpr)}px ui-monospace, monospace`;
        const tw = Math.min(size - 16 * dpr, c.measureText(label).width + 18 * dpr);
        c.fillStyle = 'rgba(6,8,6,0.92)';
        c.strokeStyle = 'rgba(235,220,170,0.48)';
        c.lineWidth = Math.max(1, dpr);
        c.fillRect(px, py, tw, 24 * dpr);
        c.strokeRect(px, py, tw, 24 * dpr);
        c.fillStyle = '#f8ecd0';
        c.textBaseline = 'middle';
        c.fillText(label, px + 8 * dpr, py + 12 * dpr);
      }
      this.currentMapDrawMetrics = { area: { x: ox, y: oy, size }, markers: drawnMarkers };
    },

buildStaticMinimap() {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  const size = this.map?.length || CONFIG.MAP_SIZE;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const c = off.getContext('2d');
  const image = c.createImageData(size, size);
  const colors = {
    [TILE.DEEP_GRASS]: [93, 127, 56],
    [TILE.DARK_GRASS]: [111, 147, 69],
    [TILE.FOREST_FLOOR]: [123, 97, 61],
    [TILE.DIRT]: [169, 120, 70],
    [TILE.WATER]: [44, 108, 120],
    [TILE.STONE]: [140, 138, 118],
    [TILE.UNDERBRUSH]: [78, 120, 50],
    [TILE.RUIN]: [137, 133, 110],
    [TILE.CAMP]: [180, 132, 76],
    [TILE.CAVE_FLOOR]: [92, 78, 58],
    [TILE.CAVE_WALL]: [42, 36, 30]
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const col = colors[this.map[y][x].type];
      image.data[idx] = col[0];
      image.data[idx + 1] = col[1];
      image.data[idx + 2] = col[2];
      image.data[idx + 3] = 255;
    }
  }
  c.putImageData(image, 0, 0);
  return off;
},

drawMinimap() {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  this.syncMinimapZoneLine?.();
  if (!this.staticMinimap) return;
  mmctx.clearRect(0, 0, minimap.width, minimap.height);
  mmctx.drawImage(this.staticMinimap, 0, 0, minimap.width, minimap.height);
  this.compositeFogMinimap?.(mmctx, minimap.width, minimap.height);
  const drawSize = this.map?.length || CONFIG.MAP_SIZE;
  const sx = minimap.width / drawSize;
  const sy = minimap.height / drawSize;
  if (this.currentZone === 'dungeon') {
    this.drawDungeonRoomMapOverlay?.(mmctx, 0, 0, sx, sy, 1, true);
    this.drawDungeonNavigationMapMarkers?.(mmctx, 0, 0, sx, sy, 1, true);
  }
  if (!this.player) return;

  const px = this.player.x * sx;
  const py = this.player.y * sy;

  mmctx.strokeStyle = 'rgba(255,255,255,0.5)';
  mmctx.strokeRect(px - 18, py - 18, 36, 36);

  mmctx.fillStyle = '#ffe08a';
  mmctx.fillRect(px - 2, py - 2, 4, 4);

  for (const ally of this.mapCompanionMarkers?.() || []) {
    mmctx.save();
    mmctx.fillStyle = '#3ea6ff';
    mmctx.strokeStyle = 'rgba(230,245,255,0.78)';
    mmctx.lineWidth = 1;
    mmctx.beginPath();
    mmctx.arc(ally.x * sx, ally.y * sy, 3.2, 0, Math.PI * 2);
    mmctx.fill();
    mmctx.stroke();
    mmctx.restore();
  }

  mmctx.fillStyle = '#d4665a';
  const enemyMarkerRangeSq = 16 * 16;
  const playerX = this.player.x;
  const playerY = this.player.y;
  for (const e of this.enemies) {
    if (!e.alive) continue;
    const dx = e.x - playerX;
    const dy = e.y - playerY;
    if (dx * dx + dy * dy < enemyMarkerRangeSq) {
      mmctx.fillRect(e.x * sx, e.y * sy, 2, 2);
    }
  }
}
      });
    }
  };
})();
