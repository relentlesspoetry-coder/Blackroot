// Blackroot overworld zone registry (Roadmap Item 26 / Ashen Valley, Phase 1).
//
// V0.20.80: THE GAME PREVIOUSLY HAD EXACTLY ONE OVERWORLD. `game.overworldMap`,
// `game.overworldObjects` and `game.overworldEnemies` were plain fields holding Dark Woods, and
// portal-system.js literally restores the overworld with `this.map = this.overworldMap`. A second
// walkable region therefore had nowhere to live.
//
// WHY ACCESSORS RATHER THAN A RENAME: those three names have ~70 call sites across 20+ files, but only
// EIGHT of them are writes. Renaming to a keyed collection would have meant touching all 70 - exactly
// the cascade-patching this project forbids. Instead the three names become accessor properties that
// read and write the ACTIVE zone's slot. Every existing read keeps working unchanged, every existing
// write lands in the active zone, and switching zones is a single assignment here.
//
// OWNERSHIP: this module owns only the STORAGE and which zone is active. It does not generate terrain
// (world-system.js), decide zone metadata (data/default-zones.js), move the player (travel), or
// serialize (world-serializer/save-system). Item 9: one source of truth for "which overworld am I on".
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const DEFAULT_ZONE_ID = 'dark_woods';

  function emptySlot(zoneId) {
    return { id: zoneId, map: null, objects: null, enemies: [], generated: false, size: 0 };
  }

  DR.OverworldZoneRegistry = {
    install(Game) {
      const proto = Game.prototype;

      // The store itself is created lazily so a Game constructed before this system installs (or a
      // save loaded mid-boot) still gets a valid slot rather than throwing on first access.
      function store(game) {
        if (!game._overworldZoneStore) {
          game._overworldZoneStore = Object.create(null);
          game._activeOverworldZoneId = game._activeOverworldZoneId || DEFAULT_ZONE_ID;
        }
        return game._overworldZoneStore;
      }

      function slot(game, zoneId) {
        const id = String(zoneId || game._activeOverworldZoneId || DEFAULT_ZONE_ID);
        const s = store(game);
        if (!s[id]) s[id] = emptySlot(id);
        return s[id];
      }

      proto.overworldZoneSlot = function(zoneId) { return slot(this, zoneId); };
      proto.overworldZoneIds = function() { return Object.keys(store(this)); };

      // The active overworld zone id. Note this is NOT `currentZone`, which is the coarse
      // overworld/cave/dungeon mode - a player standing in a cave still belongs to an overworld zone,
      // and that is the zone they return to.
      Object.defineProperty(proto, 'activeOverworldZoneId', {
        configurable: true,
        get() { store(this); return this._activeOverworldZoneId || DEFAULT_ZONE_ID; },
        set(value) {
          const id = String(value || DEFAULT_ZONE_ID);
          store(this);
          this._activeOverworldZoneId = id;
          slot(this, id);
        }
      });

      // The three legacy names, now views onto the active slot. Defined on the PROTOTYPE so the
      // existing `this.overworldMap = null` style assignments in constructors still work - they hit
      // the setter rather than shadowing it with an own-property. (That own-property shadowing trap
      // is the same one that broke ctx patching during the V0.20.4x profiling work.)
      const view = (key, fallback) => ({
        configurable: true,
        get() { const s = slot(this); return s[key] !== undefined && s[key] !== null ? s[key] : fallback; },
        set(value) { slot(this)[key] = value; }
      });

      Object.defineProperty(proto, 'overworldMap', view('map', null));
      Object.defineProperty(proto, 'overworldObjects', view('objects', null));
      Object.defineProperty(proto, 'overworldEnemies', {
        configurable: true,
        get() {
          const s = slot(this);
          if (!Array.isArray(s.enemies)) s.enemies = [];
          return s.enemies;
        },
        set(value) { slot(this).enemies = Array.isArray(value) ? value : []; }
      });

      // Records a generated overworld into a named slot. Used by the generator so Dark Woods and
      // Ashen Valley are stored identically rather than one being "the" overworld and the other a
      // special case.
      proto.storeOverworldZone = function(zoneId, map, objects, options = {}) {
        const s = slot(this, zoneId);
        s.map = map;
        s.objects = objects;
        s.generated = true;
        s.size = Array.isArray(map) ? map.length : 0;
        if (Array.isArray(options.enemies)) s.enemies = options.enemies;
        return s;
      };

      proto.isOverworldZoneGenerated = function(zoneId) { return !!slot(this, zoneId).generated; };

      // Generates a zone on first use rather than at boot. Ashen Valley is 450x450 = 202,500 tiles;
      // building it during startup would tax every player including those who never travel there,
      // and this project has spent many versions fighting for frame time. Generation is idempotent -
      // a zone already marked generated is returned as-is.
      proto.ensureOverworldZoneGenerated = function(zoneId) {
        const id = String(zoneId || DEFAULT_ZONE_ID);
        const s = slot(this, id);
        if (s.generated) return true;
        const generators = {
          ashen_valley: 'generateAshenValleyMap'
        };
        const fn = generators[id];
        if (!fn || typeof this[fn] !== 'function') return false;
        try {
          this[fn]();
        } catch (err) {
          console.warn(`[Blackroot] overworld zone '${id}' failed to generate:`, err);
          return false;
        }
        return !!slot(this, id).generated;
      };

      // Makes `zoneId` the active overworld and, when the player is actually standing on the
      // overworld, swaps the live map/objects to match. Deliberately does NOT move the player - the
      // travel path owns arrival position, because "which map is loaded" and "where the player
      // stands" fail differently and must not be entangled.
      proto.setActiveOverworldZone = function(zoneId, options = {}) {
        const id = String(zoneId || DEFAULT_ZONE_ID);
        const s = slot(this, id);
        if (!s.generated && options.requireGenerated !== false) return false;
        this.activeOverworldZoneId = id;
        if ((this.currentZone || 'overworld') === 'overworld') {
          this.map = s.map;
          this.objects = s.objects;
          this.setActiveEnemySet?.(s.enemies || []);
          this.mapDirty = true;
          // V0.20.85: REBUILD it, do not merely null it. drawMinimap early-returns on a null
          // staticMinimap, so nulling it without rebuilding leaves the mini-map permanently black -
          // and because resetCharacterOwnedState calls this function, that happened to EVERY new
          // character, with no travel required. Every other map-swapping path in the codebase
          // (portal-system, combat-system, save-system, world-serializer) rebuilds here; this one
          // quietly did not. The `|| this.staticMinimap` keeps the previous image if a rebuild fails
          // rather than blanking the HUD, which is the same idiom portal-system uses.
          this.staticMinimap = this.buildStaticMinimap?.() || this.staticMinimap;
        }
        // V0.20.84: refresh the HUD zone line here rather than relying on the minimap draw. Measured:
        // drawMinimap ran ZERO times across 10 render() calls - it only fires on certain HUD events -
        // so hooking it left the label showing the previous zone. A zone change is the only thing that
        // can change this text, so driving it from the zone change is both correct and free.
        this.syncMinimapZoneLine?.();
        return true;
      };

      // The zone descriptor from data/default-zones.js for the active (or given) zone, so callers do
      // not each re-derive it and drift.
      proto.overworldZoneDef = function(zoneId) {
        const id = String(zoneId || this.activeOverworldZoneId);
        return DR.DEFAULT_WORLD?.zones?.[id] || null;
      };

      // Zone-aware subregion lookup, using the same 'box'/'ring' contract Dark Woods established.
      //
      // Deliberately a NEW function rather than repointing Game.prototype.getDarkWoodsRegionAt: that
      // one names dark_woods explicitly and is read by mob spawning and terrain rendering, so making
      // it follow the active zone would silently change Dark Woods behaviour as a side effect of
      // adding a zone. Later phases can migrate those callers on purpose.
      proto.overworldRegionAt = function(x, y, zoneId) {
        const id = String(zoneId || this.activeOverworldZoneId);
        const regions = DR.DEFAULT_WORLD?.zones?.[id]?.regions;
        if (!Array.isArray(regions)) return null;
        for (const region of regions) {
          if (region.shape === 'box') {
            if (x >= region.x1 && x <= region.x2 && y >= region.y1 && y <= region.y2) return region;
          } else if (region.shape === 'ring') {
            const d = Math.hypot(x - region.cx, y - region.cy);
            if (d >= region.rMin && d < region.rMax) return region;
          }
        }
        return null;
      };

      proto.overworldRegionLevelRange = function(x, y, zoneId) {
        const region = this.overworldRegionAt(x, y, zoneId);
        const def = this.overworldZoneDef(zoneId);
        if (!region) return { levelMin: def?.levelMin ?? 1, levelMax: def?.levelMax ?? 10 };
        return { levelMin: region.levelMin, levelMax: region.levelMax };
      };

      // Where the player lands when arriving in a zone. Per-zone rather than a geometric centre,
      // which on Dark Woods lands in unremarkable forest 80 tiles from anything.
      proto.overworldZoneArrival = function(zoneId) {
        const id = String(zoneId || this.activeOverworldZoneId);
        if (id === 'ashen_valley' && typeof this.ashenValleyArrivalPoint === 'function') {
          return this.ashenValleyArrivalPoint();
        }
        if (id === 'dark_woods') {
          // The Stone Hedge waypoint, which is the zone's only waypoint and its natural travel anchor.
          return { x: 210, y: 250 };
        }
        const def = DR.DEFAULT_WORLD?.zones?.[id];
        return { x: Math.floor((def?.width || 200) / 2), y: Math.floor((def?.height || 200) / 2) };
      };

      // Outward spiral for a walkable tile near a target. Shared by every arrival path so "safe
      // landing" is defined once rather than re-implemented per zone.
      proto.nearestWalkableOverworldTile = function(x, y, zoneId, maxRadius = 48) {
        const map = slot(this, zoneId).map;
        if (!Array.isArray(map)) return null;
        const ok = (px, py) => {
          const t = map[Math.floor(py)]?.[Math.floor(px)];
          return !!t && !t.blocked && !(t.waterDepth > 0);
        };
        const cx = Math.round(x), cy = Math.round(y);
        if (ok(cx, cy)) return { x: cx, y: cy };
        for (let r = 1; r <= maxRadius; r++) {
          for (let a = 0; a < 24; a++) {
            const ang = (a / 24) * Math.PI * 2;
            const px = Math.round(cx + Math.cos(ang) * r);
            const py = Math.round(cy + Math.sin(ang) * r);
            if (ok(px, py)) return { x: px, y: py };
          }
        }
        return null;
      };

      // Moves the player to another overworld zone. This is the ONE place a zone change happens, so
      // the cave/dungeon exit, arrival placement and follower handling cannot drift apart the way
      // three separate movement paths did before V0.20.47.
      //
      // Returns { ok, reason } - a refusal always carries a reason the caller can show, because a
      // silent failure here strands the player with no explanation.
      proto.travelToOverworldZone = function(zoneId, options = {}) {
        const id = String(zoneId || '');
        const def = DR.DEFAULT_WORLD?.zones?.[id];
        if (!def) return { ok: false, reason: 'That place does not exist.' };
        // V0.20.87: same-zone travel is legitimate once a zone has more than one waypoint - Dark Woods
        // now has two. Refusing purely on "same zone" would have made Dead Lantern and Stone Hedge
        // unable to reach each other. Callers that mean "do not move me within this zone" pass no
        // allowSameZone, and still get the old refusal.
        const sameZone = id === this.activeOverworldZoneId && (this.currentZone || 'overworld') === 'overworld';
        if (sameZone && options.allowSameZone !== true) {
          return { ok: false, reason: 'You are already there.' };
        }
        const player = this.player;
        if (!player || player.alive === false) return { ok: false, reason: 'You cannot travel right now.' };
        if (options.ignoreCombat !== true && (this.isEntityInCombat?.(player) || player.inCombat)) {
          return { ok: false, reason: 'You cannot travel while in combat.' };
        }
        if (!this.ensureOverworldZoneGenerated(id)) {
          return { ok: false, reason: 'That region is not ready yet.' };
        }

        // Leave any cave/dungeon first so the player never arrives holding a cave map.
        this.currentZone = 'overworld';
        if (!this.setActiveOverworldZone(id)) return { ok: false, reason: 'That region is not ready yet.' };

        const arrival = (typeof options.arrival === 'object' && options.arrival) || this.overworldZoneArrival(id);

        // Never drop the player on a blocked or deep-water tile. The arrival helpers already prefer
        // walkable ground, but a saved/edited world could have changed the tile underneath them, and
        // an arrival inside geometry is unrecoverable without a second travel.
        const safe = this.nearestWalkableOverworldTile(arrival.x, arrival.y, id) || arrival;
        player.x = safe.x + 0.5;
        player.y = safe.y + 0.5;
        player.vx = 0; player.vy = 0; player.moveBlend = 0;
        player.zone = 'overworld';
        this.clearClickMoveTarget?.();
        this.cancelPlayerEmote?.('zone-travel');
        this.fishingSystem?.cancelFishing?.('Travel interrupted fishing.');
        this.resourceGatheringSystem?.cancelGathering?.('Travel interrupted gathering.');
        // Same cooldown the portal path uses, so an arrival cannot immediately re-trigger a transition.
        this.zoneTransitionCooldown = Math.max(Number(this.zoneTransitionCooldown) || 0, 0.35);
        this.mapDirty = true;
        // "You arrive in Dark Woods" reads wrong when you never left it, which same-zone waypoint
        // travel now makes possible.
        if (!sameZone) this.log?.(`You arrive in ${def.name}.`);
        return { ok: true, zoneId: id, x: player.x, y: player.y, zoneName: def.name };
      };
    }
  };
})();
