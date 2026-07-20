// Dream Realms runtime puzzle system
// Modular Pass 39: keys, locks, switches, doors, clear-room gates, and puzzle state persistence.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.puzzle-runtime.v1';

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const nowMs = () => Date.now();

  function defaultState() {
    return {
      version: 1,
      solvedPuzzles: {},
      switchProgress: {},
      collectedKeys: {},
      openedLocks: {},
      openedDoors: {},
      failedPuzzles: {},
      lastInteractionKey: null
    };
  }

  function normalizeState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;
    state.solvedPuzzles = raw.solvedPuzzles && typeof raw.solvedPuzzles === 'object' ? raw.solvedPuzzles : {};
    state.switchProgress = raw.switchProgress && typeof raw.switchProgress === 'object' ? raw.switchProgress : {};
    state.collectedKeys = raw.collectedKeys && typeof raw.collectedKeys === 'object' ? raw.collectedKeys : {};
    state.openedLocks = raw.openedLocks && typeof raw.openedLocks === 'object' ? raw.openedLocks : {};
    state.openedDoors = raw.openedDoors && typeof raw.openedDoors === 'object' ? raw.openedDoors : {};
    state.failedPuzzles = raw.failedPuzzles && typeof raw.failedPuzzles === 'object' ? raw.failedPuzzles : {};
    state.lastInteractionKey = raw.lastInteractionKey || null;
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
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_err) {}
  }

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function zoneKey(game) {
    if (game.currentZone === 'dungeon') return game.activeDungeon?.id || game.dungeonRuntimeState?.active?.dungeonId || 'dungeon';
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function markerZoneKey(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function puzzleDef(game, puzzleId) {
    return game.editorPuzzles?.[puzzleId] || DR.PUZZLE_BY_ID?.[puzzleId] || null;
  }

  function nodeType(node) {
    return node?.type || node?.markerKind || node?.kind || '';
  }

  function isPuzzleNode(node) {
    const type = nodeType(node);
    return type === 'puzzleSwitch' || type === 'puzzleKey' || type === 'puzzleLock' || type === 'puzzleDoor'
      || ['puzzle', 'key', 'lock', 'door'].includes(node?.markerKind);
  }

  function tileDistanceToPlayer(game, node) {
    if (!game.player || !node) return Infinity;
    const x = safeNumber(node.x, 0);
    const y = safeNumber(node.y, 0);
    return Math.hypot((Math.floor(x) + 0.5) - game.player.x, (Math.floor(y) + 0.5) - game.player.y);
  }

  function objectKey(game, node) {
    const x = Math.floor(safeNumber(node?.x, 0));
    const y = Math.floor(safeNumber(node?.y, 0));
    return `${zoneKey(game)}:${x},${y}:${node?.id || node?.markerKind || node?.type || 'puzzle'}`;
  }

  function puzzleInstanceKey(game, node) {
    if (node?.puzzleInstanceId) return node.puzzleInstanceId;
    if (node?.puzzleId) return `${zoneKey(game)}:${node.puzzleId}`;
    if (node?.dungeonId) return `${zoneKey(game)}:${node.dungeonId}:${node.markerKind || node.type || 'puzzle'}`;
    return objectKey(game, node);
  }

  function doorId(node) {
    return node?.doorId || node?.linkedDoorId || node?.successOpens?.[0] || node?.id || null;
  }

  function keyId(node) {
    return node?.keyId || node?.id || null;
  }

  function lockId(node) {
    return node?.lockId || node?.id || null;
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('puzzleSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'puzzleSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Puzzles</h3>
      <div class="small" data-puzzle-status>No puzzle object nearby.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-puzzle-range style="background:linear-gradient(90deg,#fff08a,#75d069)"></div></div>
      <div class="small" data-puzzle-meta>E: keys / locks / switches / doors</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  registerDreamRealmsSystem({
    id: 'puzzleRuntime',
    name: 'Runtime Puzzle System',

    install(game) {
      const runtime = {
        id: 'puzzleRuntime',
        name: 'Runtime Puzzle System',
        game,
        state: normalizeState(game.pendingPuzzleRuntimeState || readLocalState()),
        panel: ensurePanel(),
        nearbyNode: null,
        statusTick: 0,
        clearRoomTick: 0,

        init() {
          game.puzzleSystem = this;
          game.puzzleRuntimeState = this.state;
          this.bindInput();
          this.applyCurrentZonePuzzleState();
          this.refreshPanel();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'interact') : String(event.key || '').toLowerCase() === 'e')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            const node = this.findNearbyPuzzleNode();
            if (!node) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.interact(node);
          }, true);
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(raw) {
          this.state = normalizeState(raw || defaultState());
          game.puzzleRuntimeState = this.state;
          this.applyCurrentZonePuzzleState();
          this.refreshPanel();
        },

        saveState() {
          game.puzzleRuntimeState = this.state;
          writeLocalState(this.state);
          if (game.worldSaveDirty !== undefined) game.worldSaveDirty = true;
        },

        onGameEvent(eventName) {
          if (eventName === 'player-started') {
            this.state = normalizeState(game.pendingPuzzleRuntimeState || this.state || readLocalState());
            game.puzzleRuntimeState = this.state;
            this.applyCurrentZonePuzzleState();
            this.refreshPanel();
          }
          if (eventName === 'zone-entered' || eventName === 'dungeon-entered') {
            this.applyCurrentZonePuzzleState();
            this.refreshPanel();
          }
          if (eventName === 'enemy-killed') {
            this.tryResolveClearRoomDoors();
          }
        },

        currentMarkerGrid() {
          if (game.currentZone === 'dungeon') return {};
          return game.editorDungeonMarkers?.[markerZoneKey(game)] || {};
        },

        markerToRuntimeNode(marker) {
          if (!marker || marker.enabled === false || marker.runtimeConsumed || !isPuzzleNode(marker)) return null;
          const copy = { ...marker };
          copy.type = ({ puzzle: 'puzzleSwitch', key: 'puzzleKey', lock: 'puzzleLock', door: 'puzzleDoor' })[marker.markerKind] || copy.type || marker.markerKind;
          copy.name = copy.name || ({ puzzle: 'Puzzle Switch', key: 'Puzzle Key', lock: 'Puzzle Lock', door: 'Puzzle Door' })[marker.markerKind] || 'Puzzle Node';
          copy.interactionRange = safeNumber(copy.interactionRange, 2.1);
          copy.puzzleInstanceId = copy.puzzleInstanceId || (copy.puzzleId ? `${markerZoneKey(game)}:${copy.puzzleId}` : `${markerZoneKey(game)}:${copy.id}`);
          if (marker.markerKind === 'door') copy.doorId = copy.doorId || copy.linkedDoorId || copy.id;
          if (marker.markerKind === 'key') copy.keyId = copy.keyId || copy.id;
          if (marker.markerKind === 'lock') copy.lockId = copy.lockId || copy.id;
          return copy;
        },

        getDungeonObjectAt(x, y) {
          const obj = game.objects?.[y]?.[x];
          if (!obj || !isPuzzleNode(obj)) return null;
          return { ...obj, x, y };
        },

        findNearbyDungeonNode(range = 2.25) {
          if (game.currentZone !== 'dungeon' || !game.player) return null;
          const px = Math.floor(game.player.x);
          const py = Math.floor(game.player.y);
          let best = null;
          let bestD = range;
          for (let y = py - 4; y <= py + 4; y++) {
            for (let x = px - 4; x <= px + 4; x++) {
              const node = this.getDungeonObjectAt(x, y);
              if (!node) continue;
              const d = tileDistanceToPlayer(game, node);
              if (d <= safeNumber(node.interactionRange, range) && d < bestD) {
                best = node;
                bestD = d;
              }
            }
          }
          return best;
        },

        findNearbyWorldMarker(range = 2.25) {
          if (game.currentZone === 'dungeon' || !game.player) return null;
          let best = null;
          let bestD = range;
          for (const marker of Object.values(this.currentMarkerGrid())) {
            const node = this.markerToRuntimeNode(marker);
            if (!node) continue;
            const d = tileDistanceToPlayer(game, node);
            if (d <= safeNumber(node.interactionRange, range) && d < bestD) {
              best = node;
              bestD = d;
            }
          }
          return best;
        },

        findNearbyPuzzleNode() {
          return this.findNearbyDungeonNode() || this.findNearbyWorldMarker();
        },

        interact(node) {
          const type = nodeType(node);
          this.state.lastInteractionKey = objectKey(game, node);
          if (type === 'puzzleKey') return this.collectKey(node);
          if (type === 'puzzleLock') return this.openLock(node);
          if (type === 'puzzleDoor') return this.inspectDoor(node);
          if (type === 'puzzleSwitch') return this.activateSwitch(node);
          return false;
        },

        collectKey(node) {
          const id = keyId(node);
          if (!id) return false;
          if (this.state.collectedKeys[id]) {
            game.log?.(`${node.name || 'Puzzle key'} is already collected.`);
            return false;
          }
          this.state.collectedKeys[id] = {
            collectedAt: nowMs(),
            zoneId: zoneKey(game),
            dungeonId: node.dungeonId || null,
            floor: node.floor || null,
            linkedDoorId: node.linkedDoorId || node.doorId || null
          };
          this.removeRuntimeNode(node);
          this.saveState();
          game.log?.(`Collected ${node.name || 'puzzle key'}.`);
          game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, node.color || '#75d069', 20);
          this.refreshPanel();
          return true;
        },

        hasKeyForDoor(targetDoorId, targetKeyId = null) {
          if (targetKeyId && this.state.collectedKeys[targetKeyId]) return true;
          if (!targetDoorId) return false;
          return Object.values(this.state.collectedKeys || {}).some(entry => entry?.linkedDoorId === targetDoorId);
        },

        openLock(node) {
          const targetLockId = lockId(node);
          const targetDoorId = doorId(node);
          const targetKeyId = node.keyId || null;
          if (targetLockId && this.state.openedLocks[targetLockId]) {
            game.log?.(`${node.name || 'Puzzle lock'} is already open.`);
            return false;
          }
          if (!this.hasKeyForDoor(targetDoorId, targetKeyId)) {
            game.log?.(`${node.name || 'Puzzle lock'} needs a matching key.`);
            game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, '#e65d4f', 16);
            return false;
          }
          if (targetLockId) this.state.openedLocks[targetLockId] = { openedAt: nowMs(), doorId: targetDoorId || null };
          if (targetDoorId) this.openDoor(targetDoorId, `Unlocked ${node.name || 'puzzle lock'}.`);
          this.removeRuntimeNode(node);
          this.saveState();
          game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, '#fff08a', 22);
          this.refreshPanel();
          return true;
        },

        inspectDoor(node) {
          const id = doorId(node);
          if (id && this.state.openedDoors[id]) {
            game.log?.(`${node.name || 'Puzzle door'} is open.`);
            return true;
          }
          const puzzle = puzzleDef(game, node.puzzleId) || node;
          const kind = puzzle.puzzleType || node.puzzleType || 'puzzle';
          if (kind === 'kill_and_unlock') {
            const remaining = this.countEnemiesInDoorRoom(node);
            game.log?.(`${node.name || 'Puzzle door'} is sealed. Clear the room to open it. ${remaining} enemies remain.`);
          } else if (node.keyId || node.lockId) {
            game.log?.(`${node.name || 'Puzzle door'} is locked. Find the key and open the lock.`);
          } else {
            game.log?.(`${node.name || 'Puzzle door'} is sealed by ${puzzle.name || 'a puzzle'}.`);
          }
          game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, '#e65d4f', 14);
          return false;
        },

        activateSwitch(node) {
          const instanceKey = puzzleInstanceKey(game, node);
          const puzzle = puzzleDef(game, node.puzzleId) || node;
          const puzzleType = puzzle.puzzleType || node.puzzleType || 'sequence';
          if (this.state.solvedPuzzles[instanceKey]) {
            game.log?.(`${puzzle.name || node.name || 'Puzzle'} is already solved.`);
            return false;
          }
          const progress = this.state.switchProgress[instanceKey] || { progress: 0, activeSwitches: {}, order: [], failures: 0 };
          const switchId = node.switchId || node.id || objectKey(game, node);
          if (progress.activeSwitches[switchId]) {
            game.log?.(`${node.name || 'Switch'} is already active.`);
            return false;
          }
          if (puzzleType === 'sequence') {
            const expected = Math.floor(safeNumber(progress.progress, 0));
            const actual = Math.floor(safeNumber(node.sequenceIndex, 0));
            if (actual !== expected) {
              progress.failures = Math.floor(safeNumber(progress.failures, 0)) + 1;
              this.state.failedPuzzles[instanceKey] = { failedAt: nowMs(), failures: progress.failures, puzzleId: node.puzzleId || null };
              if (puzzle.resetOnFail !== false) {
                progress.progress = 0;
                progress.activeSwitches = {};
                progress.order = [];
                this.resetSwitchObjects(instanceKey);
              }
              this.state.switchProgress[instanceKey] = progress;
              this.saveState();
              game.log?.(`${puzzle.name || 'Puzzle'} failed. Sequence reset.`);
              game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, '#e65d4f', 18);
              this.spawnFailureEnemies(puzzle, node);
              return false;
            }
          }
          progress.activeSwitches[switchId] = nowMs();
          progress.order.push(switchId);
          progress.progress = Math.floor(safeNumber(progress.progress, 0)) + 1;
          this.state.switchProgress[instanceKey] = progress;
          this.markNodeActivated(node);
          const required = Math.max(1, Math.floor(safeNumber(node.requiredSwitches, puzzle.requiredSwitches || node.totalSwitches || 1)));
          game.log?.(`${node.name || 'Switch'} activated (${Math.min(progress.progress, required)}/${required}).`);
          game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, node.color || puzzle.color || '#fff08a', 18);
          if (progress.progress >= required) this.solvePuzzle(instanceKey, puzzle, node);
          else this.saveState();
          this.refreshPanel();
          return true;
        },

        solvePuzzle(instanceKey, puzzle, sourceNode) {
          if (this.state.solvedPuzzles[instanceKey]) return false;
          this.state.solvedPuzzles[instanceKey] = {
            solvedAt: nowMs(),
            puzzleId: puzzle.id || sourceNode?.puzzleId || null,
            dungeonId: sourceNode?.dungeonId || puzzle.dungeonId || null,
            floor: sourceNode?.floor || game.activeDungeon?.floor || null
          };
          const doors = new Set(Array.isArray(puzzle.successOpens) ? puzzle.successOpens : []);
          if (sourceNode?.doorId) doors.add(sourceNode.doorId);
          if (sourceNode?.linkedDoorId) doors.add(sourceNode.linkedDoorId);
          for (const id of doors) this.openDoor(id, null, false);
          this.openGeneratedDoorsForPuzzle(instanceKey, sourceNode?.puzzleId || puzzle.id);
          this.saveState();
          game.log?.(`${puzzle.name || 'Puzzle'} solved. Door seals released.`);
          game.spawnRing?.(safeNumber(sourceNode?.x, game.player?.x || 0) + 0.5, safeNumber(sourceNode?.y, game.player?.y || 0) + 0.5, puzzle.color || '#75d069', 28);
          game.notifyExternalSystems?.('puzzle-solved', { puzzle, puzzleInstanceId: instanceKey, sourceNode });
          return true;
        },

        openDoor(id, logText = null, persist = true) {
          if (!id) return false;
          if (!this.state.openedDoors[id]) this.state.openedDoors[id] = { openedAt: nowMs(), zoneId: zoneKey(game) };
          this.applyCurrentZonePuzzleState();
          if (persist) this.saveState();
          if (logText) game.log?.(logText);
          return true;
        },

        openGeneratedDoorsForPuzzle(instanceKey, puzzleId) {
          this.scanCurrentPuzzleNodes(node => {
            if (nodeType(node) !== 'puzzleDoor') return;
            if (node.puzzleInstanceId === instanceKey || (puzzleId && node.puzzleId === puzzleId)) {
              const id = doorId(node);
              if (id && !this.state.openedDoors[id]) this.state.openedDoors[id] = { openedAt: nowMs(), zoneId: zoneKey(game) };
            }
          });
          this.applyCurrentZonePuzzleState();
        },

        resetSwitchObjects(instanceKey) {
          this.scanCurrentPuzzleNodes(node => {
            if (nodeType(node) !== 'puzzleSwitch') return;
            if (puzzleInstanceKey(game, node) !== instanceKey) return;
            const target = this.objectAtNode(node);
            if (target) target.activated = false;
          });
        },

        markNodeActivated(node) {
          const target = this.objectAtNode(node);
          if (target) target.activated = true;
        },

        objectAtNode(node) {
          if (game.currentZone !== 'dungeon') return null;
          const x = Math.floor(safeNumber(node.x, 0));
          const y = Math.floor(safeNumber(node.y, 0));
          return game.objects?.[y]?.[x] || null;
        },

        removeRuntimeNode(node) {
          const x = Math.floor(safeNumber(node.x, 0));
          const y = Math.floor(safeNumber(node.y, 0));
          if (game.currentZone === 'dungeon') {
            if (game.objects?.[y]?.[x]) game.objects[y][x] = null;
            return;
          }
          const grid = this.currentMarkerGrid();
          const key = `${x},${y}`;
          if (grid[key]) grid[key].runtimeConsumed = true;
        },

        spawnFailureEnemies(puzzle, node) {
          const spawnIds = Array.isArray(puzzle.failureSpawns) ? puzzle.failureSpawns : [];
          if (!spawnIds.length || !game.mobSpawnSystem) return;
          game.log?.(`${puzzle.name || 'Puzzle'} failure echoes through the dungeon.`);
        },

        countEnemiesInDoorRoom(node) {
          if (!node?.roomBounds || !Array.isArray(game.dungeonEnemies)) return (game.dungeonEnemies || []).filter(enemy => enemy?.alive).length;
          const { x, y, radius } = node.roomBounds;
          const cx = safeNumber(x, 0);
          const cy = safeNumber(y, 0);
          const r = Math.max(1, safeNumber(radius, 10));
          return game.dungeonEnemies.filter(enemy => enemy?.alive && Math.hypot(enemy.x - cx, enemy.y - cy) <= r).length;
        },

        tryResolveClearRoomDoors() {
          let changed = false;
          this.scanCurrentPuzzleNodes(node => {
            if (nodeType(node) !== 'puzzleDoor') return;
            const puzzle = puzzleDef(game, node.puzzleId) || node;
            const puzzleType = puzzle.puzzleType || node.puzzleType || '';
            const id = doorId(node);
            if (puzzleType !== 'kill_and_unlock' || !id || this.state.openedDoors[id]) return;
            const remaining = this.countEnemiesInDoorRoom(node);
            if (remaining <= 0) {
              this.state.openedDoors[id] = { openedAt: nowMs(), zoneId: zoneKey(game), reason: 'clear_room' };
              const instanceKey = puzzleInstanceKey(game, node);
              this.state.solvedPuzzles[instanceKey] = { solvedAt: nowMs(), puzzleId: node.puzzleId || puzzle.id || null, reason: 'clear_room' };
              changed = true;
              game.log?.(`${node.name || puzzle.name || 'Puzzle gate'} opened after the room was cleared.`);
              game.spawnRing?.(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, node.color || puzzle.color || '#75d069', 26);
            }
          });
          if (changed) {
            this.applyCurrentZonePuzzleState();
            this.saveState();
          }
          return changed;
        },

        scanCurrentPuzzleNodes(visitor) {
          if (game.currentZone === 'dungeon') {
            for (let y = 0; y < (game.objects?.length || 0); y++) {
              const row = game.objects[y];
              if (!Array.isArray(row)) continue;
              for (let x = 0; x < row.length; x++) {
                const obj = row[x];
                if (!obj || !isPuzzleNode(obj)) continue;
                visitor({ ...obj, x, y });
              }
            }
            return;
          }
          for (const marker of Object.values(this.currentMarkerGrid())) {
            const node = this.markerToRuntimeNode(marker);
            if (node) visitor(node);
          }
        },

        applyCurrentZonePuzzleState() {
          if (!game.map) return;
          this.scanCurrentPuzzleNodes(node => {
            const type = nodeType(node);
            if (type === 'puzzleSwitch') {
              const instanceKey = puzzleInstanceKey(game, node);
              const progress = this.state.switchProgress[instanceKey];
              const active = progress?.activeSwitches?.[node.switchId || node.id || objectKey(game, node)] || this.state.solvedPuzzles[instanceKey];
              const target = this.objectAtNode(node);
              if (target) target.activated = Boolean(active);
            }
            if (type === 'puzzleDoor') {
              const id = doorId(node);
              const opened = Boolean(id && this.state.openedDoors[id]);
              const x = Math.floor(safeNumber(node.x, 0));
              const y = Math.floor(safeNumber(node.y, 0));
              if (game.map?.[y]?.[x]) game.map[y][x].blocked = !opened;
              const target = this.objectAtNode(node);
              if (target) target.opened = opened;
            }
          });
          game.mapDirty = true;
        },

        update(dt) {
          if (!game.started || !game.player) return;
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.18;
            this.nearbyNode = this.findNearbyPuzzleNode();
            this.applyCurrentZonePuzzleState();
            this.refreshPanel();
          }
          this.clearRoomTick -= dt;
          if (this.clearRoomTick <= 0) {
            this.clearRoomTick = 0.55;
            this.tryResolveClearRoomDoors();
          }
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-puzzle-status]');
          const fill = this.panel.querySelector('[data-puzzle-range]');
          const meta = this.panel.querySelector('[data-puzzle-meta]');
          if (!status || !fill || !meta) return;
          const node = this.nearbyNode || this.findNearbyPuzzleNode();
          if (!node) {
            status.textContent = 'No puzzle object nearby.';
            fill.style.width = '0%';
          } else {
            const d = tileDistanceToPlayer(game, node);
            const type = nodeType(node);
            const action = type === 'puzzleKey' ? 'Collect key' : type === 'puzzleLock' ? 'Open lock' : type === 'puzzleDoor' ? 'Inspect door' : 'Activate switch';
            status.textContent = `E: ${action} · ${node.name || node.puzzleName || 'Puzzle node'}`;
            fill.style.width = `${Math.floor((1 - clamp(d, 0, 2.25) / 2.25) * 100)}%`;
          }
          const solved = Object.keys(this.state.solvedPuzzles || {}).length;
          const doors = Object.keys(this.state.openedDoors || {}).length;
          meta.textContent = `${solved} puzzle${solved === 1 ? '' : 's'} solved · ${doors} door${doors === 1 ? '' : 's'} opened`;
        },

        render() {
          if (!game.started || !game.player || game.currentZone === 'dungeon') return;
          const ctx = DR.runtime?.ctx;
          if (!ctx || typeof game.worldToScreen !== 'function') return;
          for (const marker of Object.values(this.currentMarkerGrid())) {
            const node = this.markerToRuntimeNode(marker);
            if (!node || (marker.markerKind || '') === 'entrance') continue;
            if (Math.hypot(safeNumber(node.x) + 0.5 - game.player.x, safeNumber(node.y) + 0.5 - game.player.y) > 42) continue;
            const elev = game.map?.[Math.floor(safeNumber(node.y))]?.[Math.floor(safeNumber(node.x))]?.elev || 0;
            const s = game.worldToScreen(safeNumber(node.x) + 0.5, safeNumber(node.y) + 0.5, elev);
            this.drawMarkerGlyph(ctx, s, node);
          }
        },

        drawMarkerGlyph(ctx, s, node) {
          const color = node.color || '#fff08a';
          const label = node.label || (nodeType(node) === 'puzzleKey' ? 'K' : nodeType(node) === 'puzzleLock' ? 'L' : nodeType(node) === 'puzzleDoor' ? 'D' : 'P');
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.fillStyle = 'rgba(0,0,0,0.36)';
          ctx.beginPath();
          ctx.ellipse(0, 12, 23, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(0, -9, 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#f8ecd0';
          ctx.font = '11px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, 0, -5);
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillText('E', 0, 24);
          ctx.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
