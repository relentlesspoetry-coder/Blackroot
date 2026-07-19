// Dream Realms runtime chest system
// Modular Pass 33: makes editor resource chest spawns openable runtime loot containers.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.chest-runtime.v1';

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  function defaultState() {
    return { openedChests: {}, lastChestKey: null, version: 1 };
  }

  function normalizeState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;
    state.openedChests = raw.openedChests && typeof raw.openedChests === 'object' ? raw.openedChests : {};
    state.lastChestKey = raw.lastChestKey || null;
    state.version = 1;
    return state;
  }

  function readLocalState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (_err) {
      return defaultState();
    }
  }

  function writeLocalState(state) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_err) {}
  }

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function zoneKey(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function nodeKey(game, node) {
    return `${zoneKey(game)}:${Math.floor(Number(node.x) || 0)},${Math.floor(Number(node.y) || 0)}:${node.type || node.id || 'chest'}`;
  }

  function resourceDef(game, node) {
    return game.editorResourceTypes?.[node.type || node.id] || DR.RESOURCE_BY_ID?.[node.type || node.id] || node || null;
  }

  function isChestNode(game, node) {
    if (!node) return false;
    const def = resourceDef(game, node);
    return node.category === 'chest' || def?.category === 'chest' || /^chest_/i.test(node.type || node.id || '');
  }

  function isStashChestObject(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const type = String(obj.type || obj.id || '').toLowerCase();
    return type === 'stashchest' || obj.stashAccess === true || obj.interactionType === 'stash';
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('chestSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'chestSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Stash / Chests</h3>
      <div class="small" data-chest-status>No stash or chest nearby.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-chest-range style="background:linear-gradient(90deg,#8d672e,#f0c56c)"></div></div>
      <div class="small" data-chest-meta>E: Open Stash or nearby resource chests</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  registerDreamRealmsSystem({
    id: 'runtimeChests',
    name: 'Runtime Chests / Loot Tables',

    install(game) {
      const runtime = {
        id: 'runtimeChests',
        name: 'Runtime Chests / Loot Tables',
        game,
        state: normalizeState(game.pendingChestRuntimeState || readLocalState()),
        panel: ensurePanel(),
        nearbyChest: null,
        statusTick: 0,

        init() {
          game.chestSystem = this;
          game.chestRuntimeState = this.state;
          this.bindInput();
          this.refreshPanel();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'interact') : String(event.key || '').toLowerCase() === 'e')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            const stash = this.findNearbyStashChest();
            if (stash) {
              event.preventDefault();
              event.stopImmediatePropagation();
              this.openStashChest(stash);
              return;
            }
            const node = this.findNearbyChest();
            if (!node) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.openChest(node);
          });
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(raw) {
          this.state = normalizeState(raw);
          game.chestRuntimeState = this.state;
          this.refreshPanel();
        },

        saveState() {
          writeLocalState(this.state);
          game.chestRuntimeState = this.state;
        },

        currentChestGrid() {
          return game.editorResources?.[zoneKey(game)] || {};
        },

        allChestNodes() {
          const grid = this.currentChestGrid();
          return Object.values(grid).filter(node => isChestNode(game, node));
        },

        distanceToNode(node) {
          if (!game.player || !node) return Infinity;
          const x = Number(node.x);
          const y = Number(node.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
          return Math.hypot((x + 0.5) - game.player.x, (y + 0.5) - game.player.y);
        },

        findNearbyChest(range = 1.9) {
          let best = null;
          let bestD = range;
          for (const node of this.allChestNodes()) {
            const d = this.distanceToNode(node);
            if (d < bestD) {
              best = node;
              bestD = d;
            }
          }
          return best;
        },


        findNearbyStashChest(range = 2.35) {
          if (!game.player || !Array.isArray(game.objects)) return null;
          const px = Math.floor(Number(game.player.x) || 0);
          const py = Math.floor(Number(game.player.y) || 0);
          let best = null;
          let bestD = Math.max(0.1, Number(range) || 2.35);
          for (let y = py - 3; y <= py + 3; y++) {
            const row = game.objects[y];
            if (!row) continue;
            for (let x = px - 3; x <= px + 3; x++) {
              const obj = row[x];
              if (!isStashChestObject(obj)) continue;
              const d = Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y);
              if (d < bestD) {
                bestD = d;
                best = { ...obj, x, y, name: obj.name || 'Camp Stash' };
              }
            }
          }
          return best;
        },

        openStashChest(node) {
          if (!node) return false;
          if (game.openStashFromWorldChest) return game.openStashFromWorldChest(node);
          return game.toggleBank?.(true) === true;
        },

        resolveTableId(node) {
          if (node.lootTableId) return node.lootTableId;
          const def = resourceDef(game, node);
          if (def?.lootTableId) return def.lootTableId;
          if ((node.type || node.id) === 'chest_dungeon') return 'loot_dungeon_chest';
          return 'loot_common_chest';
        },

        openChest(node) {
          const key = nodeKey(game, node);
          const def = resourceDef(game, node);
          if (this.state.openedChests[key]) {
            game.playAudioEvent?.('ui_error', { x: Number(node.x) + 0.5, y: Number(node.y) + 0.5, volume: 0.18 });
            game.log(`${node.name || def?.name || 'Chest'} is empty.`);
            return false;
          }
          const tableId = this.resolveTableId(node);
          const result = game.rollEditorLootTable
            ? game.rollEditorLootTable(tableId, { kind: 'resourceChest', key, name: node.name || def?.name || 'Chest', level: game.player?.level || 1, zoneId: zoneKey(game) }, { fallbackTableId: tableId })
            : { tableId, gold: 0, items: [], summary: 'nothing' };
          this.state.openedChests[key] = {
            openedAt: Date.now(),
            zoneId: zoneKey(game),
            x: Math.floor(Number(node.x) || 0),
            y: Math.floor(Number(node.y) || 0),
            resourceId: node.type || node.id || null,
            lootTableId: result.tableId || tableId,
            result
          };
          this.state.lastChestKey = key;
          this.saveState();
          game.playAudioEvent?.('chest_open', { x: (Number(node.x) || 0) + 0.5, y: (Number(node.y) || 0) + 0.5 });
          game.spawnRing?.((Number(node.x) || 0) + 0.5, (Number(node.y) || 0) + 0.5, '#f0c56c', 24);
          game.log(`${node.name || def?.name || 'Chest'} opened: ${result.summary}.`);
          game.maybeQueuePartyBanter?.('chestOpened', { priority: 1 });
          this.refreshPanel();
          return true;
        },

        update(dt) {
          if (!game.started || !game.player) return;
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.18;
            this.nearbyStash = this.findNearbyStashChest();
            this.nearbyChest = this.nearbyStash ? null : this.findNearbyChest();
            this.refreshPanel();
          }
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-chest-status]');
          const range = this.panel.querySelector('[data-chest-range]');
          const meta = this.panel.querySelector('[data-chest-meta]');
          const opened = Object.keys(this.state.openedChests || {}).length;
          if (!status || !range || !meta) return;
          const stash = this.nearbyStash;
          const node = this.nearbyChest;
          if (stash) {
            const d = this.distanceToNode(stash);
            // V0.20.10: the stash object AUTHORS `interactLabel: 'Open Stash'` and this line hardcoded
            // the same words, so the field was dead - written on 4 objects across world-system.js and
            // read by nothing in the codebase. It says the same thing today, which is exactly why it
            // was never noticed; the point is that a stash which authors a different label now gets it.
            status.textContent = `${stash.name || 'Camp Stash'} nearby · E: ${stash.interactLabel || 'Open Stash'}`;
            range.style.width = `${Math.max(0, Math.min(100, (1 - d / 2.35) * 100))}%`;
          } else if (!node) {
            status.textContent = 'No stash or chest nearby.';
            range.style.width = '0%';
          } else {
            const key = nodeKey(game, node);
            const d = this.distanceToNode(node);
            const def = resourceDef(game, node);
            const openedText = this.state.openedChests[key] ? 'opened' : 'closed';
            status.textContent = `${node.name || def?.name || 'Chest'} nearby · ${openedText}`;
            range.style.width = `${Math.max(0, Math.min(100, (1 - d / 1.9) * 100))}%`;
          }
          meta.textContent = `Opened ${opened} resource chests · E opens stash/chest`;
        },

        render(context) {
          if (!game.started || !game.player) return;
          const nodes = this.allChestNodes();
          if (!nodes.length) return;
          const px = game.player.x;
          const py = game.player.y;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const node of nodes) {
            const x = Math.floor(Number(node.x) || 0);
            const y = Math.floor(Number(node.y) || 0);
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > 34) continue;
            const tile = game.map?.[y]?.[x];
            if (!tile) continue;
            const def = resourceDef(game, node);
            const opened = Boolean(this.state.openedChests[nodeKey(game, node)]);
            const s = game.worldToScreen(x, y, tile.elev + 0.22);
            context.globalAlpha = opened ? 0.42 : 0.9;
            context.fillStyle = opened ? '#6d5940' : (def?.color || '#d8ad57');
            context.beginPath();
            if (typeof context.roundRect === 'function') context.roundRect(s.x - 8, s.y - 30, 16, 16, 4);
            else context.rect(s.x - 8, s.y - 30, 16, 16);
            context.fill();
            context.globalAlpha = 1;
            if (!window.DreamRealms?.SUPPRESS_WORLD_FLOATING_TEXT) {
              context.fillStyle = opened ? '#2b241d' : '#07100d';
              context.fillText(opened ? '✓' : (def?.label || 'T'), s.x, s.y - 22.5);
            }
          }
          context.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
