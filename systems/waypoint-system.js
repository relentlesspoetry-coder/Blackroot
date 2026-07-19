// Dream Realms waypoint system
// V0.17.50 Phase 11 (Wisps + Waypoint Integration): the game's first waypoint
// system. Nothing pre-existing implements fast-travel/waypoints anywhere in
// the codebase (confirmed by audit) - systems/save-system.js and
// core/character-model.js already persist a `player.unlockedWaypoints` array
// as dormant, additive schema scaffolding (explicitly commented as "no
// owning system exists yet" in core/character-model.js), so this file is
// that owning system, not a duplicate of one.
//
// Scope is deliberately narrow, per the phase's own rule against building
// "unrelated travel systems": this only handles discovering/attuning a
// waypoint and persisting that to the existing player.unlockedWaypoints
// array. With exactly one waypoint in the game so far, a fast-travel
// menu/teleport UI would have nowhere meaningful to travel between yet, so
// that is intentionally left for whenever a second waypoint exists.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  // V0.20.80: a SECOND waypoint now exists, which is the condition this file's own header set for
  // building fast travel ("with exactly one waypoint in the game so far, a fast-travel menu would
  // have nowhere meaningful to travel between yet"). Travel is added below.
  const WAYPOINT_DEFINITIONS = [
    { id: 'stone_hedge_waypoint', zoneId: 'dark_woods', x: 210, y: 250, name: 'Stone Hedge Waypoint',
      zoneName: 'Dark Woods', levelMin: 1, levelMax: 10 },
    { id: 'ashenfall_city_waypoint', zoneId: 'ashen_valley', x: 225, y: 232, name: 'Ashenfall City Waypoint',
      zoneName: 'Ashen Valley', levelMin: 10, levelMax: 20 },
    // V0.20.87: Dead Lantern Camp. Named per the spec's own example list (5.11, "Dark Woods - Dead
    // Lantern Waypoint"). Placed beside the south-east road out of camp rather than inside the hub:
    // the camp already carries 60 props in a 26x26 box, and the waypoint needs clear ground around it
    // both to read as a landmark and to be a gathering spot (5.3).
    { id: 'dead_lantern_waypoint', zoneId: 'dark_woods', x: 106, y: 105, name: 'Dead Lantern Waypoint',
      zoneName: 'Dark Woods', levelMin: 1, levelMax: 10 }
  ];

  const WAYPOINT_BY_ID = Object.fromEntries(WAYPOINT_DEFINITIONS.map(w => [w.id, w]));

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function isWaypointObject(obj) {
    return !!obj && (obj.type === 'waypoint' || obj.interactionType === 'waypoint');
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
  }

  registerDreamRealmsSystem({
    id: 'waypoints',
    name: 'Waypoints',

    install(game) {
      const runtime = {
        id: 'waypoints',
        name: 'Waypoints',
        game,

        init() {
          game.waypointSystem = this;
          game.toggleWaypointPanel = force => this.togglePanel(force);
          game.renderWaypointPanel = () => this.renderPanel();
          this.bindInput();
          this.purgeLegacyWaypointAuras();
        },

        panelOpen: false,

        definitions() {
          return WAYPOINT_DEFINITIONS;
        },

        // ---------------------------------------------------------------------------------
        // Travel panel (V0.20.90). Diablo-style: interacting with a waypoint opens the list of
        // every waypoint, with the ones this character has discovered selectable and the rest
        // shown but locked. Built as a `panel gameWindow` section filled by innerHTML, which is
        // the idiom the mount/skills panels already use - not a new UI framework.
        // ---------------------------------------------------------------------------------
        togglePanel(force) {
          this.panelOpen = typeof force === 'boolean' ? force : !this.panelOpen;
          const el = document.getElementById('waypointPanel');
          if (el) el.style.display = this.panelOpen ? 'block' : 'none';
          if (this.panelOpen) this.renderPanel();
          return this.panelOpen;
        },

        closePanel() { this.togglePanel(false); },

        renderPanel() {
          const el = document.getElementById('waypointPanel');
          if (!el || !this.panelOpen) return;
          const here = this.findNearbyWaypoint(3.0);
          const standingOn = here?.obj?.waypointId || null;
          const known = WAYPOINT_DEFINITIONS.filter(d => this.isAttuned(d.id)).length;

          // Grouped by zone, the way Diablo groups by act - with two zones it already helps, and it
          // is the structure the zone list needs anyway as more regions land.
          const zones = [];
          for (const def of WAYPOINT_DEFINITIONS) {
            let z = zones.find(q => q.id === def.zoneId);
            if (!z) { z = { id: def.zoneId, name: def.zoneName || def.zoneId, defs: [] }; zones.push(z); }
            z.defs.push(def);
          }

          const body = zones.map(z => {
            const rows = z.defs.map(def => {
              const attuned = this.isAttuned(def.id);
              const isHere = def.id === standingOn;
              const reason = attuned ? this.travelBlockedReason(def.id) : 'Not yet discovered.';
              const canGo = attuned && !reason;
              const cls = ['waypointRow', attuned ? 'known' : 'locked', isHere ? 'current' : ''].filter(Boolean).join(' ');
              const status = isHere ? 'You are here'
                : attuned ? (reason ? escapeHtml(reason) : 'Travel')
                : 'Undiscovered';
              return `
                <div class="${cls}">
                  <div class="waypointRowMain">
                    <div class="waypointName">${escapeHtml(attuned ? def.name : '???')}</div>
                    <div class="waypointMeta">${escapeHtml(z.name)} &middot; Level ${def.levelMin}-${def.levelMax}</div>
                  </div>
                  <button class="waypointGo" data-waypoint="${escapeHtml(def.id)}" ${canGo ? '' : 'disabled'}>${status}</button>
                </div>`;
            }).join('');
            return `<div class="waypointZone"><div class="waypointZoneName">${escapeHtml(z.name)}</div>${rows}</div>`;
          }).join('');

          el.innerHTML = `
            <h3>Waypoints</h3>
            <div class="waypointSummary">
              Discovered <strong>${known}</strong> of ${WAYPOINT_DEFINITIONS.length}
              ${standingOn ? `&middot; At <strong>${escapeHtml(WAYPOINT_BY_ID[standingOn]?.name || '')}</strong>` : ''}
            </div>
            <div class="waypointHint">Travel is free. You can only travel to waypoints you have found yourself.</div>
            <div class="waypointList">${body}</div>
            <div class="waypointFooter"><button class="waypointClose">Close</button></div>`;

          el.querySelectorAll('[data-waypoint]').forEach(btn => {
            btn.addEventListener('click', ev => {
              ev.preventDefault();
              const id = btn.getAttribute('data-waypoint');
              const res = this.travelTo(id);
              if (res?.ok) this.closePanel();
              else this.renderPanel();
            });
          });
          el.querySelector('.waypointClose')?.addEventListener('click', ev => {
            ev.preventDefault();
            this.closePanel();
          });
        },

        isAttuned(waypointId) {
          return Array.isArray(game.player?.unlockedWaypoints) && game.player.unlockedWaypoints.includes(waypointId);
        },

        findNearbyWaypoint(range = 2.2) {
          if (!game.player || !Array.isArray(game.objects)) return null;
          const px = game.player.x, py = game.player.y;
          const minY = Math.max(0, Math.floor(py - range) - 1);
          const maxY = Math.min(game.objects.length - 1, Math.ceil(py + range) + 1);
          let best = null, bestDist = Infinity;
          for (let y = minY; y <= maxY; y++) {
            const row = game.objects[y];
            if (!Array.isArray(row)) continue;
            const minX = Math.max(0, Math.floor(px - range) - 1);
            const maxX = Math.min(row.length - 1, Math.ceil(px + range) + 1);
            for (let x = minX; x <= maxX; x++) {
              const obj = row[x];
              if (!isWaypointObject(obj)) continue;
              const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
              if (d <= range && d < bestDist) { best = { obj, x, y, dist: d }; bestDist = d; }
            }
          }
          return best;
        },

        tryAttuneWaypoint() {
          const nearby = this.findNearbyWaypoint();
          if (!nearby) return false;
          const { obj } = nearby;
          const waypointId = obj.waypointId || 'stone_hedge_waypoint';
          if (!Array.isArray(game.player.unlockedWaypoints)) game.player.unlockedWaypoints = [];
          if (game.player.unlockedWaypoints.includes(waypointId)) {
            game.log?.(`${obj.name || 'This waypoint'} is already attuned.`, 'World');
            return true;
          }
          game.player.unlockedWaypoints.push(waypointId);
          obj.attuned = true;
          game.worldSaveDirty = true;
          game.log?.(`${obj.name || 'Waypoint'} attuned.`, 'World');
          return true;
        },

        // --- Fast travel (V0.20.80) --------------------------------------------------------
        // Discovery stays personal and is already persisted in player.unlockedWaypoints; this only
        // reads it. Per the spec, a destination must be DISCOVERED by this character - there is no
        // remote unlock and no party inheritance.
        travelTargets() {
          const here = game.activeOverworldZoneId;
          return WAYPOINT_DEFINITIONS.map(def => ({
            id: def.id,
            name: def.name,
            zoneId: def.zoneId,
            zoneName: def.zoneName,
            levels: `${def.levelMin}-${def.levelMax}`,
            discovered: this.isAttuned(def.id),
            current: def.zoneId === here
          }));
        },

        // Every refusal returns a specific reason. The spec calls for this, and a silent failure
        // here would strand the player at a waypoint with no feedback.
        travelBlockedReason(waypointId) {
          const def = WAYPOINT_BY_ID[waypointId];
          if (!def) return 'That destination does not exist.';
          const player = game.player;
          if (!player || player.alive === false) return 'You cannot travel while dead.';
          if (!this.isAttuned(waypointId)) return 'You have not discovered that waypoint yet.';
          // V0.20.87: refuse only if you are standing AT this waypoint, not merely in its zone.
          // Dark Woods now holds two, and a zone-level check made them unable to reach each other.
          const here = this.findNearbyWaypoint(3.0);
          if (here && here.obj?.waypointId === waypointId) return 'You are already at that waypoint.';
          if (game.isEntityInCombat?.(player) || player.inCombat) return 'You cannot travel while in combat.';
          if (player.swimming || player.underwater) return 'You cannot travel while swimming.';
          if (game.tamingSystem?.isActive?.()) return 'You cannot travel during a taming attempt.';
          if ((game.currentZone || 'overworld') === 'dungeon') return 'You cannot travel from inside a dungeon.';
          if (!this.findNearbyWaypoint()) return 'You must be standing at a waypoint to travel.';
          return null;
        },

        travelTo(waypointId) {
          const reason = this.travelBlockedReason(waypointId);
          if (reason) {
            game.log?.(reason, 'World');
            return { ok: false, reason };
          }
          const def = WAYPOINT_BY_ID[waypointId];
          const result = game.travelToOverworldZone?.(def.zoneId, {
            arrival: { x: def.x, y: def.y },
            allowSameZone: true
          });
          if (!result?.ok) {
            const why = result?.reason || 'Travel failed.';
            game.log?.(why, 'World');
            return { ok: false, reason: why };
          }
          game.log?.(`You travel to ${def.name}.`, 'World');
          return { ok: true, waypointId, zoneId: def.zoneId };
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'interact') : String(event.key || '').toLowerCase() === 'e')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            if (!this.findNearbyWaypoint()) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            // V0.20.90: interacting attunes on first touch (discovery must still be earned by
            // standing here - spec 5.5 forbids remote unlock), then opens the travel list. An
            // already-attuned waypoint goes straight to the list, which is the Diablo behaviour.
            this.tryAttuneWaypoint();
            this.togglePanel(true);
          });

          // Escape closes it, matching every other panel in the game.
          window.addEventListener('keydown', event => {
            if (!this.panelOpen) return;
            if (String(event.key || '') !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.closePanel();
          });
        },

        serializeState() {
          return null;
        },

        importState() {},

        // V0.20.89: the 'waypointAura' effect is GONE. It existed (V0.17.51) to give the old flat
        // grey disc a pulsing glow, ring and motes. The V0.20.88 waypoint draws all of that itself,
        // and because effects render AFTER world objects the aura sat on top of the new dais as a
        // pale blob - which is exactly what was reported.
        //
        // Its one behaviour worth keeping was V0.17.56's night brightening; that moved into
        // drawWaypoint, so waypoints still read as beacons after dark.
        //
        // This purges any aura still in game.effects, so a session that was already running (or a
        // world carrying one) loses it rather than keeping an orphan forever - the effects hold
        // life: 1e9 and would otherwise never expire.
        purgeLegacyWaypointAuras() {
          if (!Array.isArray(game.effects)) return 0;
          let removed = 0;
          for (let i = game.effects.length - 1; i >= 0; i--) {
            if (game.effects[i]?.type === 'waypointAura') { game.effects.splice(i, 1); removed++; }
          }
          if (this._auraEffectMap) this._auraEffectMap.clear();
          return removed;
        },

        update(dt) {
          // Cheap periodic sweep rather than every frame, matching the old refresh cadence. Anything
          // that re-adds a legacy aura (an old save, a stale system) gets it cleaned up rather than
          // leaving a permanent blob on the dais.
          this._auraRefreshTimer = Math.max(0, Number(this._auraRefreshTimer || 0) - (Number(dt) || 0));
          if (this._auraRefreshTimer > 0) return;
          this._auraRefreshTimer = 1.0;
          this.purgeLegacyWaypointAuras();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
