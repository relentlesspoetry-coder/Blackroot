// Dream Realms swimming / underwater exploration runtime system
// V0.12.3: full 5-12 block water depth, vertical swimming, breath, and depth visibility.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  // V0.17.47 Phase 8 (Hidden Tree Cave Exterior + Interior): the
  // 'underwater_cave_blind_pool' entrance (zoneId 'mossfang_cave', leading to
  // the 2-floor 'dungeon_blind_pool_depths') was removed. Hidden Tree Cave's
  // design rule explicitly forbids a second dungeon inside it, and this
  // entry force-carved a water pocket into that exact cave every session via
  // ensureEntrances()/ensureWaterPocket(), independent of and invisible to
  // systems/cave-system.js's own generic (non-dungeon) floor generator. This
  // orphans dungeon_blind_pool_depths (data/dungeons.js) and its boss
  // boss_silk_mother (data/enemies.js) - both left fully intact, not deleted,
  // pending a future decision on whether to re-attach them elsewhere. See
  // docs/V0.17.47_DARK_WOODS_360_EXPANSION_PHASE8_HIDDEN_TREE_CAVE.md.
  const UNDERWATER_ENTRANCES = [
    {
      id: 'underwater_cave_blackwater_grotto',
      zoneId: 'dark_woods',
      x: 73,
      y: 83,
      dungeonId: 'dungeon_blackwater_grotto',
      name: 'Blackwater Grotto',
      description: 'A drowned stone opening hidden under the river current.'
    },
    {
      id: 'underwater_cave_sunken_root_halls',
      zoneId: 'dark_woods',
      x: 126,
      y: 88,
      dungeonId: 'dungeon_sunken_root_halls',
      name: 'Sunken Root Halls',
      description: 'A submerged root tunnel leading under Dark Woods.'
    }
  ];

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function zoneKey(game) {
    if (game.currentZone === 'cave') return game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave';
    if (game.currentZone === 'dungeon') return 'dungeon';
    return 'dark_woods';
  }

  function activeTile(game, x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    return game.map?.[ty]?.[tx] || null;
  }

  function waterDepthAt(game, x, y) {
    const tile = activeTile(game, x, y);
    if (!tile || tile.type !== DR.TILE?.WATER) return 0;
    const depth = safeNumber(tile.waterDepth, 5);
    return clamp(depth, 5, 12);
  }

  function isWaterAt(game, x, y) {
    return waterDepthAt(game, x, y) > 0;
  }

  const SWIM_RENDER_DEPTH_MIN = 1;

  function applySwimmingRenderState(game, entity, dt, options = {}) {
    if (!game || !entity || entity.alive === false) return false;
    const depth = waterDepthAt(game, entity.x, entity.y);
    const swimming = depth >= SWIM_RENDER_DEPTH_MIN;
    const moveMagnitude = Math.hypot(safeNumber(entity.vx, 0), safeNumber(entity.vy, 0));
    const moveBlend = safeNumber(entity.moveBlend, 0);
    const swimMovement = swimming ? clamp(moveMagnitude * 0.08 + moveBlend, 0, 1) : 0;
    const previousTransition = safeNumber(entity._swimTransition, safeNumber(entity.swimBlend, 0));
    const transition = clamp(previousTransition + (swimming ? dt * 5.2 : -dt * 6.5), 0, 1);

    entity._swimTransition = transition;
    entity.inWater = depth > 0;
    entity.waterDepthMax = depth;
    entity.swimming = swimming;
    entity.swimBlend = transition;
    entity.swimMovement = swimMovement;
    entity.swimSubmerge = swimming ? (entity.underwater ? 0.66 : 0.52) : 0;
    entity.swimAnim = safeNumber(entity.swimAnim, 0) + (swimming ? dt * (0.55 + swimMovement * 2.25) : 0);
    entity.swimState = swimming ? (swimMovement > 0.10 ? 'swimming' : 'treading') : 'land';

    if (!swimming && options.resetDepth !== false) {
      entity.underwater = false;
      entity.isUnderwater = false;
      entity.swimDepth = 0;
    }
    return swimming;
  }

  function ensureWaterPocket(game, zoneId, cx, cy, radius = 3) {
    const map = zoneId !== 'dark_woods' ? game.caveMap : game.overworldMap;
    const objects = zoneId !== 'dark_woods' ? game.caveObjects : game.overworldObjects;
    const TILE = DR.TILE || {};
    if (!map || !objects) return;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (!map[y]?.[x]) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d > radius) continue;
        const centerFactor = Math.max(0, 1 - d / Math.max(1, radius));
        const depth = clamp(Math.round(5 + centerFactor * 6 + radius * 0.25), 5, 12);
        map[y][x].type = TILE.WATER;
        map[y][x].blocked = false;
        map[y][x].elev = 0;
        map[y][x].waterDepth = Math.max(safeNumber(map[y][x].waterDepth, 0), depth);
        map[y][x].waterSurfaceElev = 0;
        map[y][x].waterBottomElev = -map[y][x].waterDepth;
        if (objects[y]) objects[y][x] = null;
      }
    }
  }

  function nearestEntrance(game, range = 2.85) {
    const zone = zoneKey(game);
    if (zone === 'dungeon' || !game.player) return null;
    let best = null;
    let bestD = range;
    for (const entrance of UNDERWATER_ENTRANCES) {
      if (entrance.zoneId !== zone) continue;
      const d = Math.hypot((entrance.x + 0.5) - game.player.x, (entrance.y + 0.5) - game.player.y);
      if (d < bestD) {
        best = entrance;
        bestD = d;
      }
    }
    return best;
  }

  registerDreamRealmsSystem({
    id: 'swimming',
    name: 'Swimming / Underwater Exploration',

    install(game) {
      const runtime = {
        id: 'swimming',
        name: 'Swimming / Underwater Exploration',
        game,
        wasSwimming: false,
        underwaterHintTimer: 0,
        oxygenMax: 45,
        oxygen: 45,
        drownTick: 0,
        swimTransition: 0,
        normalizedMaps: new WeakSet(),
        entrancePocketsEnsured: new Set(),
        bubbles: [],

        init() {
          game.swimmingSystem = this;
          game.isSwimmingTile = (x, y) => isWaterAt(game, x, y);
          game.waterDepthAt = (x, y) => waterDepthAt(game, x, y);
          this.bindInput();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || !game.started || game.paused || !game.player) return;
            const key = String(event.key || '').toLowerCase();
            const swimming = isWaterAt(game, game.player.x, game.player.y);
            if ((game.isActionKey ? game.isActionKey(event, 'dive') : key === 'u') && swimming) {
              event.preventDefault();
              game.keys?.add(game.bindingForAction?.('dive') || 'u');
              game.player.swimming = true;
              game.player.underwater = safeNumber(game.player.swimDepth, 0) > 0.25;
              return;
            }
            if ((game.isActionKey ? game.isActionKey(event, 'ascend') : (event.code === 'Space' || event.key === ' ')) && swimming) {
              event.preventDefault();
              event.stopImmediatePropagation();
              game.keys?.add(game.bindingForAction?.('ascend') || 'space');
              return;
            }
            if (game.isActionKey ? game.isActionKey(event, 'interact') : key === 'e') {
              const entrance = nearestEntrance(game);
              if (!entrance || !game.player.underwater) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              this.enterUnderwaterDungeon(entrance);
            }
          }, true);
        },

        ensureEntrances() {
          const activeZone = zoneKey(game);
          const key = `${activeZone}:f${game.currentCaveFloor || 0}`;
          if (this.entrancePocketsEnsured.has(key)) return;
          this.entrancePocketsEnsured.add(key);
          for (const entrance of UNDERWATER_ENTRANCES) {
            if (entrance.zoneId !== activeZone) continue;
            ensureWaterPocket(game, entrance.zoneId, entrance.x, entrance.y, 2.8);
          }
          DR.normalizeWaterDepthsForMap?.(game.map);
          if (game.map) this.normalizedMaps.add(game.map);
        },

        normalizeActiveMap() {
          const map = game.map;
          if (!map || this.normalizedMaps.has(map)) return;
          DR.normalizeWaterDepthsForMap?.(map);
          this.normalizedMaps.add(map);
        },

        maxDepthAtPlayer() {
          return waterDepthAt(game, game.player?.x || 0, game.player?.y || 0);
        },

        enterUnderwaterDungeon(entrance) {
          const dungeonSystem = game.systemLookup?.dungeonRuntime || game.dungeonSystem || null;
          const dungeon = game.editorDungeons?.[entrance.dungeonId] || DR.DUNGEON_BY_ID?.[entrance.dungeonId];
          if (!dungeonSystem || typeof dungeonSystem.enterDungeon !== 'function' || !dungeon) {
            game.log?.(`${entrance.name} will become an underwater dungeon entrance once dungeon runtime is available.`);
            return false;
          }
          const marker = {
            id: entrance.id,
            dungeonId: entrance.dungeonId,
            dungeonName: dungeon.name || entrance.name,
            x: entrance.x,
            y: entrance.y,
            zoneKey: entrance.zoneId,
            interactionRange: 3.0
          };
          game.player.underwater = false;
          game.player.swimDepth = 0;
          game.log?.(`You swim through the hidden entrance to ${dungeon.name || entrance.name}.`);
          return dungeonSystem.enterDungeon(marker);
        },

        updateDepthControls(dt, maxDepth) {
          const player = game.player;
          const descend = game.keys?.has('u');
          const ascend = game.keys?.has(' ');
          const previous = safeNumber(player.swimDepth, 0);
          let next = previous;
          if (descend) next += dt * 4.2;
          if (ascend) next -= dt * 5.2;
          // When neither vertical key is held, preserve the current depth so players can explore
          // horizontally at that layer instead of snapping back to the surface.
          next = clamp(next, 0, Math.max(0, maxDepth - 0.35));
          player.swimDepth = next;
          player.underwater = next > 0.35;
          player.isUnderwater = player.underwater;
          player.waterDepthMax = maxDepth;
          player.z = player.underwater ? -next : 0;
          if (previous <= 0.35 && next > 0.35) game.log?.(`You dive underwater. Depth ${next.toFixed(1)} / ${maxDepth.toFixed(0)} blocks. Hold U to descend, Space to ascend.`);
          if (previous > 0.35 && next <= 0.35) game.log?.('You surface from the water.');
        },

        updateOxygen(dt) {
          const player = game.player;
          if (!player) return;
          const amphibious = player.raceId === 'bogling';
          if (player.underwater) {
            if (amphibious) {
              this.oxygen = this.oxygenMax;
              player.oxygen = this.oxygenMax;
              player.oxygenMax = this.oxygenMax;
              this.drownTick = 0;
              return;
            }
            const maxDepth = Math.max(1, safeNumber(player.waterDepthMax, 5));
            const depthRatio = clamp(safeNumber(player.swimDepth, 0) / maxDepth, 0, 1);
            const drain = dt * (1 + depthRatio * 0.55);
            this.oxygen = Math.max(0, this.oxygen - drain);
            player.oxygen = this.oxygen;
            player.oxygenMax = this.oxygenMax;
            if (this.oxygen <= 0) {
              this.drownTick -= dt;
              if (this.drownTick <= 0) {
                this.drownTick = 1.0;
                player.hp = Math.max(1, Math.floor((player.hp || 1) - Math.max(3, player.maxHp * 0.04)));
                game.resourceGatheringSystem?.cancelForDamage?.();
                game.log?.('You are out of breath. Surface now.');
              }
            }
          } else {
            this.oxygen = Math.min(this.oxygenMax, this.oxygen + dt * 12);
            this.drownTick = 0;
            player.oxygen = this.oxygen;
            player.oxygenMax = this.oxygenMax;
          }
        },

        updateAuxiliarySwimStates(dt) {
          const actors = new Set();
          for (const actor of [game.merc, game.pet, ...(Array.isArray(game.botPlayers) ? game.botPlayers : [])]) {
            if (actor) actors.add(actor);
          }
          const friendly = typeof game.friendlyTargetActors === 'function' ? game.friendlyTargetActors({ includePlayer: false }) : [];
          for (const actor of friendly || []) if (actor && actor !== game.player) actors.add(actor);
          for (const actor of actors) {
            applySwimmingRenderState(game, actor, dt, { resetDepth: true });
          }
          // V0.18.3: enemies swim too now, so give nearby (rendered) mobs the same swim
          // render state (submerge + stroke) instead of walking on top of the water.
          // Limited to a radius around the player - off-screen mobs never draw.
          const enemies = Array.isArray(game.enemies) ? game.enemies : null;
          const player = game.player;
          if (enemies && player) {
            const px = player.x, py = player.y, R2 = 44 * 44;
            for (let i = 0; i < enemies.length; i++) {
              const e = enemies[i];
              if (!e || e.alive === false) continue;
              const dx = e.x - px, dy = e.y - py;
              if (dx * dx + dy * dy > R2) continue;
              applySwimmingRenderState(game, e, dt, { resetDepth: true });
            }
          }
        },

        update(dt) {
          if (!game.started || !game.player) return;
          this.normalizeActiveMap();
          this.ensureEntrances();
          const player = game.player;
          const maxDepth = this.maxDepthAtPlayer();
          const swimming = maxDepth > 0;
          const previousSwimming = !!player.swimming;
          const moveMagnitude = Math.hypot(Number(player.vx) || 0, Number(player.vy) || 0);
          const moveBlend = safeNumber(player.moveBlend, 0);
          const swimMovement = swimming ? clamp(moveMagnitude * 0.08 + moveBlend, 0, 1) : 0;
          this.swimTransition = clamp(this.swimTransition + (swimming ? dt * 5.2 : -dt * 6.5), 0, 1);

          player.swimming = swimming;
          player.inWater = swimming;
          player.swimBlend = this.swimTransition;
          player.swimMovement = swimMovement;
          player.swimSubmerge = swimming ? (player.underwater ? 0.66 : 0.52) : 0;
          player.swimAnim = safeNumber(player.swimAnim, 0) + (swimming ? dt * (0.55 + swimMovement * 2.25) : 0);
          player.swimState = swimming ? (swimMovement > 0.10 ? 'swimming' : 'treading') : 'land';

          if (!swimming) {
            if (player.underwater || safeNumber(player.swimDepth, 0) > 0) game.log?.('You leave the water and surface.');
            player.underwater = false;
            player.isUnderwater = false;
            player.swimDepth = 0;
            player.waterDepthMax = 0;
            player.z = Math.max(0, player.z || 0);
          } else {
            this.updateDepthControls(dt, maxDepth);
            player.swimSubmerge = player.underwater ? 0.66 : 0.52;
          }

          if (swimming !== this.wasSwimming) {
            this.wasSwimming = swimming;
            if (swimming && !previousSwimming) game.log?.(`You begin swimming in ${maxDepth.toFixed(0)} block-deep water. Hold U to dive; hold Space to ascend.`);
          }

          this.updateAuxiliarySwimStates(dt);

          this.updateOxygen(dt);

          this.underwaterHintTimer -= dt;
          const entrance = nearestEntrance(game);
          if (entrance && swimming && this.underwaterHintTimer <= 0) {
            this.underwaterHintTimer = 5.5;
            game.log?.(game.player.underwater
              ? `${entrance.name} is below you. Press E to swim inside.`
              : 'You see bubbles rising from a hidden underwater opening. Hold U to dive.');
          }
        },

        render(context) {
          if (!game.started || !game.player) return;
          const now = performance.now() * 0.001;
          const zone = zoneKey(game);
          const depth = safeNumber(game.player.swimDepth, 0);
          const maxDepth = Math.max(1, safeNumber(game.player.waterDepthMax, 5));
          const depthRatio = clamp(depth / maxDepth, 0, 1);
          context.save();

          for (const entrance of UNDERWATER_ENTRANCES) {
            if (entrance.zoneId !== zone) continue;
            const tile = game.map?.[entrance.y]?.[entrance.x];
            if (!tile) continue;
            const s = game.worldToScreen(entrance.x + 0.5, entrance.y + 0.5, tile.elev + 0.12);
            const near = game.player && Math.hypot((entrance.x + 0.5) - game.player.x, (entrance.y + 0.5) - game.player.y) < 6;
            context.globalAlpha = near ? 0.78 : 0.38;
            context.strokeStyle = game.player?.underwater ? '#b8f4ff' : '#78d7ff';
            context.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
              const r = 9 + i * 7 + Math.sin(now * 2.3 + i) * 1.5;
              context.beginPath();
              context.ellipse(s.x, s.y + i * 2, r, r * 0.38, 0, 0, Math.PI * 2);
              context.stroke();
            }
            for (let i = 0; i < 5; i++) {
              const rise = ((now * 18 + i * 11) % 34);
              const ox = Math.sin(now * 1.5 + i * 1.7) * 9;
              context.globalAlpha = 0.58 - rise / 80;
              context.fillStyle = '#d4faff';
              context.beginPath();
              context.arc(s.x + ox, s.y - rise, 2 + (i % 2), 0, Math.PI * 2);
              context.fill();
            }
          }

          if (game.player.swimming) {
            const tile = game.tileAt(game.player.x, game.player.y);
            const s = game.worldToScreen(game.player.x, game.player.y, safeNumber(tile.elev, 0) + 0.10);
            const movement = clamp(safeNumber(game.player.swimMovement, 0), 0, 1);
            const stroke = Math.sin(safeNumber(game.player.swimAnim, now) * Math.PI * 2);
            const bob = Math.sin(now * (movement > 0.1 ? 4.2 : 2.1));
            context.globalAlpha = game.player.underwater ? 0.46 - depthRatio * 0.18 : 0.38 + movement * 0.16;
            context.fillStyle = game.player.underwater ? '#164e68' : '#58b8d0';
            context.beginPath();
            context.ellipse(s.x, s.y + 4 + bob * 1.7, 31 + movement * 10, 10 + movement * 2.5, 0, 0, Math.PI * 2);
            context.fill();
            context.globalAlpha = game.player.underwater ? 0.20 : 0.46;
            context.strokeStyle = '#cdfbff';
            context.lineWidth = 1.25;
            for (let i = 0; i < 3; i++) {
              context.beginPath();
              context.ellipse(s.x + stroke * (4 + i * 2), s.y + 1 + i * 4, 20 + i * 7 + movement * 8, 3.5 + i * 0.7, Math.sin(now + i) * 0.04, 0, Math.PI * 2);
              context.stroke();
            }
          }

          if (game.player.underwater) {
            const alpha = 0.18 + depthRatio * 0.36;
            context.globalAlpha = alpha;
            context.fillStyle = depthRatio > 0.65 ? '#061521' : '#185f7d';
            context.fillRect(-4000, -4000, 8000, 8000);

            context.globalAlpha = 0.18 + depthRatio * 0.22;
            const g = context.createLinearGradient(0, 0, 0, window.innerHeight || 720);
            g.addColorStop(0, 'rgba(188,241,255,0.12)');
            g.addColorStop(0.45, 'rgba(16,72,96,0.24)');
            g.addColorStop(1, 'rgba(0,7,14,0.62)');
            context.fillStyle = g;
            context.fillRect(0, 0, window.innerWidth || 1280, window.innerHeight || 720);

            context.globalAlpha = 0.86;
            context.fillStyle = '#d8f8ff';
            context.font = '12px monospace';
            context.fillText(`Depth ${depth.toFixed(1)} / ${maxDepth.toFixed(0)} blocks`, 18, (window.innerHeight || 720) - 78);
            context.fillText(`Breath ${Math.ceil(this.oxygen)} / ${this.oxygenMax}`, 18, (window.innerHeight || 720) - 60);
          }

          context.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
