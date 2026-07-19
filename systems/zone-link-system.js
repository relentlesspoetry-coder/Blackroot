// Blackroot zone links (Roadmap Item 26, Ashen Valley Phase 1b).
//
// V0.20.81: the WALKED routes between overworld zones, as opposed to waypoint fast travel.
//
// Why this exists: fast travel alone left Ashen Valley unreachable in normal play. Travelling to a
// waypoint requires having discovered it, discovering it requires standing next to it, and standing
// next to it required already being in the zone - a closed loop only `debug.travelZone()` could break.
// Shipping a region no player can enter is worse than not shipping it, so this is the road.
//
// Ownership: data/default-zones.js owns WHERE links are (DR.ZONE_LINKS), the two world generators own
// placing the objects, core/overworld-zone-registry.js owns the actual zone change, and this file owns
// only the interaction. Deliberately mirrors the waypoint system's shape - same nearby-object scan,
// same interact-key binding - rather than inventing a second interaction idiom.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function isZoneLinkObject(obj) {
    return !!obj && (obj.type === 'zoneLink' || obj.interactionType === 'zoneLink');
  }

  registerDreamRealmsSystem({
    id: 'zoneLinks',
    name: 'Zone Links',

    install(game) {
      const runtime = {
        id: 'zoneLinks',
        name: 'Zone Links',
        game,

        init() {
          game.zoneLinkSystem = this;
          this.bindInput();
        },

        definitions() { return DR.ZONE_LINKS || []; },

        byId(id) { return (DR.ZONE_LINKS || []).find(l => l.id === id) || null; },

        findNearbyLink(range = 2.4) {
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
              if (!isZoneLinkObject(obj)) continue;
              const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
              if (d <= range && d < bestDist) { best = { obj, x, y, dist: d }; bestDist = d; }
            }
          }
          return best;
        },

        // Every refusal names its reason, for the same reason the waypoint path does: a silent no at a
        // road crossing reads as a broken game.
        blockedReason(link) {
          if (!link) return 'There is no road here.';
          const player = game.player;
          if (!player || player.alive === false) return 'You cannot travel while dead.';
          if (game.isEntityInCombat?.(player) || player.inCombat) return 'You cannot travel while in combat.';
          if (player.swimming || player.underwater) return 'You cannot travel while swimming.';
          if ((game.currentZone || 'overworld') !== 'overworld') return 'You must be above ground to travel.';
          const need = Number(link.requiredLevel) || 0;
          if (need > 0 && (Number(player.level) || 1) < need) return `You must be level ${need} to take this road.`;
          return null;
        },

        useLink(linkId) {
          const link = this.byId(linkId);
          const reason = this.blockedReason(link);
          if (reason) {
            game.log?.(reason, 'World');
            return { ok: false, reason };
          }
          const result = game.travelToOverworldZone?.(link.toZone, {
            arrival: { x: link.toX, y: link.toY }
          });
          if (!result?.ok) {
            const why = result?.reason || 'The road leads nowhere.';
            game.log?.(why, 'World');
            return { ok: false, reason: why };
          }
          return { ok: true, linkId, zoneId: link.toZone };
        },

        tryUseNearbyLink() {
          const nearby = this.findNearbyLink();
          if (!nearby) return false;
          const id = nearby.obj.zoneLinkId;
          this.useLink(id);
          return true;
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'interact') : String(event.key || '').toLowerCase() === 'e')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            if (!this.findNearbyLink()) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.tryUseNearbyLink();
          });
        },

        // V0.20.82: WALKING the road takes you through. A zone border you have to press a key at reads
        // as a signpost, not a way out - and the request was for a path that exits the woods.
        //
        // Two guards against the corridor-loop failure the spec's validation list calls out ("no
        // immediate retrigger", "no portal loop"):
        //   1. zoneTransitionCooldown, which game.js already ticks down and travelToOverworldZone sets
        //      on arrival, and which the cave system uses for exactly this purpose.
        //   2. arrival points are authored ~10 tiles short of the opposite crossing, so the player
        //      never lands on the tile that would send them back.
        // The E interaction is kept as well, since a player may approach and want to choose.
        update() {
          if (!game.started || game.paused) return;
          const player = game.player;
          if (!player || player.alive === false) return;
          if ((game.currentZone || 'overworld') !== 'overworld') return;
          if ((Number(game.zoneTransitionCooldown) || 0) > 0) return;
          const nearby = this.findNearbyLink(0.85);
          if (!nearby) return;
          if (this.blockedReason(this.byId(nearby.obj.zoneLinkId))) return;
          this.useLink(nearby.obj.zoneLinkId);
        }
      };
      // The framework does NOT call init() on external systems - installExternalSystems only stores
      // the returned runtime. Each system inits itself here; waypoint-system.js does the same at the
      // end of its own install. Omitting this registered the system successfully and left it inert,
      // with no error anywhere: game.zoneLinkSystem was simply never assigned.
      runtime.init();
      return runtime;
    }
  });
})();
