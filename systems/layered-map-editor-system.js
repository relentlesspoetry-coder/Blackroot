// Dream Realms layered map editor and sparse layered-map runtime.
(function () {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const LAYERS = ['ground1','ground2','ground3','ground4','water1','water2','water3','water4','mask1','mask2','mask3','mask4','fringe1','fringe2','fringe3','fringe4'];
  const LOWER_LAYERS = LAYERS.slice(0, 12);
  const FRINGE_LAYERS = LAYERS.slice(12);
  const HISTORY_LIMIT = 100;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const keyOf = (x, y) => `${x},${y}`;
  const tileSignature = tile => tile ? `${tile.tilesetId}|${tile.sourceX}|${tile.sourceY}|${tile.sourceWidth}|${tile.sourceHeight}|${tile.tileId ?? ''}` : '';
  const cleanId = value => String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();

  function emptyMap(id, name, width, height, tileSize) {
    return {
      version: 1, mapId: id, displayName: name, width, height, tileSize,
      tilesets: [], layers: Object.fromEntries(LAYERS.map(layer => [layer, {}])),
      attributes: { blocked: {}, npcAvoid: {}, warps: {}, animations: {} },
      metadata: { zoneLevelRange: null, musicId: '', ambientId: '', weather: null, spawnRules: null, playerSpawn: null }
    };
  }

  function normalizeMap(raw, fallback) {
    if (!raw || typeof raw !== 'object') throw new Error('Map JSON must be an object.');
    const width = Math.floor(Number(raw.width));
    const height = Math.floor(Number(raw.height));
    const tileSize = Math.floor(Number(raw.tileSize || 32));
    if (!cleanId(raw.mapId) || width < 1 || height < 1 || width > 1024 || height > 1024 || tileSize < 8 || tileSize > 256) {
      throw new Error('Invalid map id, dimensions, or tile size.');
    }
    const out = emptyMap(cleanId(raw.mapId), String(raw.displayName || raw.mapId), width, height, tileSize);
    out.tilesets = Array.isArray(raw.tilesets) ? raw.tilesets.filter(t => t && t.id && t.src).map(t => ({
      id: cleanId(t.id), name: String(t.name || t.id), src: String(t.src),
      tileWidth: Math.max(1, Math.floor(Number(t.tileWidth || tileSize))), tileHeight: Math.max(1, Math.floor(Number(t.tileHeight || tileSize)))
    })) : clone(fallback?.tilesets || []);
    for (const layer of LAYERS) {
      const source = raw.layers?.[layer];
      if (!source) continue;
      if (Array.isArray(source)) {
        for (const entry of source) if (entry && Number.isInteger(entry.x) && Number.isInteger(entry.y) && entry.tile) out.layers[layer][keyOf(entry.x, entry.y)] = clone(entry.tile);
      } else if (typeof source === 'object') {
        for (const [key, tile] of Object.entries(source)) if (/^\d+,\d+$/.test(key) && tile) out.layers[layer][key] = clone(tile);
      }
    }
    for (const name of ['blocked','npcAvoid','warps','animations']) {
      const source = raw.attributes?.[name];
      if (Array.isArray(source)) {
        for (const entry of source) if (entry && Number.isInteger(entry.x) && Number.isInteger(entry.y)) out.attributes[name][keyOf(entry.x, entry.y)] = clone(entry.value ?? true);
      } else if (source && typeof source === 'object') out.attributes[name] = clone(source);
    }
    out.metadata = Object.assign(out.metadata, clone(raw.metadata || {}));
    return out;
  }

  window.DreamRealmsSystems = window.DreamRealmsSystems || [];
  window.DreamRealmsSystems.push({
    id: 'layered-map-editor',
    install(game) {
      const runtime = {
        id: 'layered-map-editor', game, maps: {}, images: new Map(), active: false,
        state: {
          enabled: false, activeTool: 'pencil', activeLayer: 'ground1', selectedTileset: '', selectedTile: null,
          selectedTileRegion: null, selectedAttributeMode: '', brushSize: 1, gridEnabled: true, attributeOverlayEnabled: true,
          layerVisibility: Object.fromEntries(LAYERS.map(x => [x, true])), layerLocks: Object.fromEntries(LAYERS.map(x => [x, false])),
          soloLayer: '', selection: null, clipboard: null, undoStack: [], redoStack: [], dirty: false, hover: null,
          dragStart: null, dragLastKey: '', transaction: null, pastePreview: false, showTopPicker: false
        },
        panel: null, status: null, sheetCanvas: null, selectedPreview: null,

        init() {
          this.ensureMaps();
          this.installGameQueries();
          this.buildUi();
          this.bindInput();
          this.refresh();
          game.layeredMapEditor = this;
        },

        zoneKey() {
          if (game.currentZone === 'cave') return game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave';
          // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
          // this had no branch for game.currentZone === 'dungeon', so every
          // layered-map attribute lookup while inside a dungeon (including
          // Game.prototype.isWalkable's layeredMapCanEnter check,
          // systems/collision-system.js:70) silently fell through to
          // 'dark_woods' and checked THAT zone's painted Blocked/NPC Avoid
          // tiles at the numerically-same (x,y) coordinates - a wrong-zone
          // data lookup, not merely a missing one. No layered map exists
          // for any dungeon id (this.maps only ever has dark_woods/
          // mossfang_cave, see ensureMaps below), so returning the actual
          // dungeon id here makes layeredMapAttributeAt correctly find no
          // map and return null - a real no-op, not an unrelated zone's
          // paint data. Dungeon walkability is unaffected either way: it
          // is already independently enforced by
          // systems/dungeon-system.js's own tile.blocked/reachable-tile
          // checks, which never consulted the layered map to begin with.
          if (game.currentZone === 'dungeon') return DR.Ids?.currentZoneId?.(game) || 'dungeon';
          return 'dark_woods';
        },

        ensureMaps() {
          const size = game.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || 200;
          for (const [id, name] of [['dark_woods','Dark Woods'],['mossfang_cave','Mossfang Cave']]) {
            if (!this.maps[id]) this.maps[id] = emptyMap(id, name, size, size, 32);
          }
          this.ensureBuiltinTileset();
        },

        ensureBuiltinTileset() {
          const defs = Object.entries(DR.TILE_DEF || {});
          const canvas = document.createElement('canvas');
          const tile = 32;
          const cols = 8;
          canvas.width = cols * tile;
          canvas.height = Math.max(tile, Math.ceil(Math.max(1, defs.length) / cols) * tile);
          const ctx = canvas.getContext('2d');
          ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          defs.forEach(([id, def], index) => {
            const x = (index % cols) * tile, y = Math.floor(index / cols) * tile;
            ctx.fillStyle = def.color || def.base || `hsl(${index * 47 % 360} 30% 38%)`; ctx.fillRect(x, y, tile, tile);
            ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.strokeRect(x + .5, y + .5, tile - 1, tile - 1);
            ctx.fillStyle = '#fff'; ctx.fillText(String(def.name || id).slice(0, 5), x + 16, y + 16);
          });
          const src = canvas.toDataURL('image/png');
          const tileset = { id: 'legacy_terrain', name: 'Legacy Terrain', src, tileWidth: tile, tileHeight: tile };
          this.images.set(tileset.id, canvas);
          for (const map of Object.values(this.maps)) if (!map.tilesets.some(t => t.id === tileset.id)) map.tilesets.unshift(clone(tileset));
          this.state.selectedTileset ||= tileset.id;
          this.state.selectedTile ||= { tilesetId: tileset.id, sourceX: 0, sourceY: 0, sourceWidth: tile, sourceHeight: tile, tileId: 0 };
        },

        currentMap() {
          const key = this.zoneKey();
          if (!this.maps[key]) {
            const size = game.activeMapSize?.() || game.map?.length || 200;
            this.maps[key] = emptyMap(key, key.replace(/_/g, ' '), size, size, 32);
            this.ensureBuiltinTileset();
          }
          return this.maps[key];
        },

        installGameQueries() {
          game.layeredMapAttributeAt = (x, y, zone = this.zoneKey()) => {
            const map = this.maps[zone]; const key = keyOf(Math.floor(x), Math.floor(y));
            const legacyAttr = game.editorAttributes?.[zone]?.[key];
            return map ? { blocked: !!map.attributes.blocked[key], npcAvoid: !!map.attributes.npcAvoid[key] || !!legacyAttr?.npcAvoid, warp: map.attributes.warps[key] || null, animation: map.attributes.animations[key] || null } : null;
          };
          game.layeredMapCanEnter = (x, y, actor) => {
            const attr = game.layeredMapAttributeAt(x, y);
            if (!attr || attr.blocked) return !attr?.blocked;
            const kind = String(actor?.kind || '').toLowerCase();
            const aiKinds = new Set(['enemy','npc','bot','pet','merc','companion','mob']);
            return !(attr.npcAvoid && aiKinds.has(kind));
          };
          game.serializeLayeredMaps = () => clone(this.maps);
          game.applyLayeredMaps = maps => this.importMaps(maps);
        },

        injectStyles() {
          if (document.getElementById('layered-map-editor-styles')) return;
          const style = document.createElement('style'); style.id = 'layered-map-editor-styles';
          style.textContent = `
            .lme{position:fixed;inset:68px 12px 36px auto;width:410px;z-index:70;display:none;background:rgba(12,13,11,.97);color:#e9ddbf;border:1px solid #a98648;border-radius:10px;box-shadow:0 12px 38px #000a;font:12px Georgia;overflow:hidden}.lme.active{display:flex;flex-direction:column}
            .lme.embedded{position:static;inset:auto;width:100%;max-height:none;display:flex;z-index:auto;border:0;box-shadow:none;background:transparent}.lme.embedded header{display:none}.lme.embedded .lme-body{padding:0;overflow:visible}.lme.embedded .lme-layers{grid-template-columns:repeat(2,minmax(0,1fr))}
            .lme header{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;background:#302617}.lme header strong{color:#f0ce83}.lme button,.lme select,.lme input{font:11px sans-serif}.lme button{padding:6px 8px;background:#30291d;color:#ead9b3;border:1px solid #665333;border-radius:5px;cursor:pointer}.lme button.active{background:#805d28;border-color:#f0c66b;color:#fff}.lme button:disabled{opacity:.4}.lme-body{padding:8px;overflow:auto}.lme-row{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:7px}.lme-group{padding:7px;border:1px solid #433923;border-radius:7px;margin-bottom:7px}.lme-group>label{display:block;color:#c6a969;margin-bottom:5px}.lme-layers{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.lme-layer{display:grid;grid-template-columns:1fr auto auto auto;gap:2px}.lme-layer button{padding:4px 3px}.lme-sheet{width:100%;height:190px;overflow:auto;background:#080908;border:1px solid #4d412b}.lme-sheet canvas{display:block;image-rendering:pixelated;cursor:crosshair}.lme-status{position:fixed;left:12px;right:12px;bottom:7px;z-index:71;display:none;padding:5px 9px;background:#111e;color:#e6d4aa;border:1px solid #6b5837;font:11px monospace}.lme-status.active{display:block}.lme input,.lme select{box-sizing:border-box;background:#10110e;color:#eee0be;border:1px solid #5d4b2d;padding:5px}.lme-wide{width:100%}.lme-modal{display:none;padding:8px;border:1px solid #967441;background:#17140e;border-radius:7px}.lme-modal.active{display:block}.lme-fields{display:grid;grid-template-columns:100px 1fr;gap:5px;align-items:center}
          `;
          document.head.appendChild(style);
        },

        buildUi() {
          this.injectStyles();
          const panel = document.createElement('aside'); panel.className = 'lme'; panel.innerHTML = `
            <header><strong>Layered Map Editor</strong><button data-action="exit" title="Exit editor and run client">Run Client</button></header>
            <div class="lme-body">
              <div class="lme-group"><label>File</label><div class="lme-row">
                <button data-action="save">Save World</button><button data-action="load">Load World</button><button data-action="importTileset">Import Tileset</button><button data-action="export">Export Layered Map</button><button data-action="import">Import Layered Map</button><button data-action="screenshot">Screenshot</button>
              </div></div>
              <div class="lme-group"><label>Edit / Tools</label><div class="lme-row" data-tools></div><div class="lme-row">
                <button data-action="undo">Undo</button><button data-action="redo">Redo</button><button data-action="cut">Cut</button><button data-action="copy">Copy</button><button data-action="paste">Paste</button><button data-action="flipH">Flip H</button><button data-action="flipV">Flip V</button><button data-action="clearLayer" title="Clear every tile on the active layer">Clear Layer</button>
              </div></div>
              <div class="lme-group"><label>Layers</label><div class="lme-layers" data-layers></div></div>
              <div class="lme-group"><label>Tileset</label><select class="lme-wide" data-tileset></select><div class="lme-sheet"><canvas data-sheet></canvas></div><div data-preview></div></div>
              <div class="lme-group"><label>Attributes</label><div class="lme-row" data-attributes></div></div>
              <div class="lme-group"><label>View</label><div class="lme-row"><button data-action="grid">Grid</button><button data-action="attrs">Attribute Overlay</button><button data-action="zoomIn">Zoom +</button><button data-action="zoomOut">Zoom −</button></div></div>
              <div class="lme-modal" data-warp-modal><strong>Warp</strong><div class="lme-fields"><label>Target map</label><select data-warp-map></select><label>Target X</label><input type="number" data-warp-x><label>Target Y</label><input type="number" data-warp-y><label>Facing</label><select data-warp-facing><option>south</option><option>north</option><option>east</option><option>west</option></select></div><div class="lme-row"><button data-action="saveWarp">Apply Warp</button><button data-action="cancelModal">Cancel</button></div></div>
              <div class="lme-modal" data-animation-modal><strong>Animation</strong><div class="lme-fields"><label>Animation ID</label><input data-animation-id><label>Speed</label><input type="number" min="0.05" step="0.05" data-animation-speed><label>Offset X</label><input type="number" data-animation-x><label>Offset Y</label><input type="number" data-animation-y><label>Layer</label><select data-animation-layer>${LAYERS.map(layer=>`<option value="${layer}">${layer}</option>`).join('')}</select></div><div class="lme-row"><button data-action="saveAnimation">Apply Animation</button><button data-action="cancelModal">Cancel</button></div></div>
            </div>`;
          document.body.appendChild(panel); this.panel = panel; this.sheetCanvas = panel.querySelector('[data-sheet]'); this.selectedPreview = panel.querySelector('[data-preview]');
          const status = document.createElement('div'); status.className = 'lme-status'; document.body.appendChild(status); this.status = status;
          const tools = [['pencil','Pencil (B)'],['select','Select (M)'],['rectangle','Rectangle (R)'],['fill','Bucket (F)'],['eraser','Eraser (E)'],['eyedropper','Picker (I)']];
          panel.querySelector('[data-tools]').innerHTML = tools.map(([id,label]) => `<button data-tool="${id}" title="${label}">${label}</button>`).join('');
          panel.querySelector('[data-layers]').innerHTML = LAYERS.map(layer => `<div class="lme-layer"><button data-layer="${layer}">${layer.replace(/(\d)/,' $1')}</button><button data-visible="${layer}" title="Show/hide">◉</button><button data-lock="${layer}" title="Lock">🔓</button><button data-solo="${layer}" title="Solo layer">S</button></div>`).join('');
          const attrs = [['paintBlocked','Blocked +'],['eraseBlocked','Blocked −'],['paintNpcAvoid','NPC Avoid +'],['eraseNpcAvoid','NPC Avoid −'],['warp','Warp'],['removeWarp','Warp −'],['animation','Animation'],['removeAnimation','Animation −']];
          panel.querySelector('[data-attributes]').innerHTML = attrs.map(([id,label]) => `<button data-attribute="${id}">${label}</button>`).join('');
          panel.addEventListener('pointerdown', e => e.stopPropagation());
          panel.addEventListener('click', e => this.handleUiClick(e));
          panel.querySelector('[data-tileset]').addEventListener('change', e => { this.state.selectedTileset = e.target.value; this.drawSheet(); });
          this.sheetCanvas.addEventListener('pointerdown', e => { this.sheetSelectionStart = this.sheetCell(e); this.selectSheetRegion(this.sheetSelectionStart, this.sheetSelectionStart); this.sheetCanvas.setPointerCapture?.(e.pointerId); });
          this.sheetCanvas.addEventListener('pointermove', e => { if (this.sheetSelectionStart) this.selectSheetRegion(this.sheetSelectionStart, this.sheetCell(e)); });
          this.sheetCanvas.addEventListener('pointerup', e => { if (this.sheetSelectionStart) this.selectSheetRegion(this.sheetSelectionStart, this.sheetCell(e)); this.sheetSelectionStart = null; this.sheetCanvas.releasePointerCapture?.(e.pointerId); });
        },

        handleUiClick(e) {
          const tool = e.target.closest('[data-tool]')?.dataset.tool;
          if (tool) { this.state.activeTool = tool; this.state.selectedAttributeMode = ''; this.refresh(); return; }
          const layer = e.target.closest('[data-layer]')?.dataset.layer;
          if (layer) { this.state.activeLayer = layer; this.refresh(); return; }
          const visible = e.target.closest('[data-visible]')?.dataset.visible;
          if (visible) { this.state.layerVisibility[visible] = !this.state.layerVisibility[visible]; this.refresh(); return; }
          const lock = e.target.closest('[data-lock]')?.dataset.lock;
          if (lock) { this.state.layerLocks[lock] = !this.state.layerLocks[lock]; this.refresh(); return; }
          const solo = e.target.closest('[data-solo]')?.dataset.solo;
          if (solo) { this.state.soloLayer = this.state.soloLayer === solo ? '' : solo; this.refresh(); return; }
          const attr = e.target.closest('[data-attribute]')?.dataset.attribute;
          if (attr) { this.state.selectedAttributeMode = attr; this.state.activeTool = 'attribute'; this.refresh(); return; }
          const action = e.target.closest('[data-action]')?.dataset.action;
          if (action === 'saveWarp') { this.saveWarpDialog(); return; }
          if (action === 'saveAnimation') { this.saveAnimationDialog(); return; }
          if (action === 'cancelModal') { this.closeDialogs(); return; }
          if (action && typeof this[`action_${action}`] === 'function') this[`action_${action}`]();
        },

        toggle(force) {
          const shell = game.systemLookup?.['editor-shell'];
          if (!shell) return;
          const enable = typeof force === 'boolean' ? force : !(shell.active && shell.tab === 'layeredMap');
          if (enable) { shell.tab = 'layeredMap'; shell.tool = ''; shell.toggle(true); shell.refreshPanel?.(); shell.syncLayeredMapEditor?.(); }
          else shell.toggle(false);
        },

        setEnabledFromEditor(enabled) { this.setActiveFromEditor(enabled); },
        setActiveFromEditor(enabled) {
          this.active = Boolean(enabled); this.state.enabled = this.active;
          this.panel?.classList.toggle('active', this.active);
          this.status?.classList.toggle('active', this.active);
          if (this.active) { game.keys?.clear?.(); game.clearClickMoveTarget?.(); }
          else this.cancelOperation();
          this.refreshEditorTabUi();
        },
        buildEditorTabUi(container) {
          if (!container || !this.panel) return false;
          this.panel.classList.add('embedded');
          if (this.panel.parentNode !== container) container.appendChild(this.panel);
          this.panel.classList.toggle('active', this.active);
          this.refreshEditorTabUi();
          return true;
        },
        refreshEditorTabUi() { this.refresh(); },
        handleEditorCanvasPointerMove(e) {
          if (!this.active) return;
          this.state.hover = this.pointerCell(e);
          if (this.state.dragStart && ['pencil','eraser','attribute'].includes(this.state.activeTool)) this.applyAt(this.state.hover.x, this.state.hover.y, true);
          this.refreshStatus(); e.preventDefault(); e.stopImmediatePropagation();
        },
        handleEditorCanvasPointerDown(e) {
          if (!this.active || e.button !== 0) return;
          const cell = this.pointerCell(e); this.state.hover = cell; this.state.dragStart = cell; this.state.dragLastKey = '';
          if (['pencil','eraser','attribute'].includes(this.state.activeTool)) this.applyAt(cell.x, cell.y, true);
          else if (['fill','eyedropper'].includes(this.state.activeTool)) this.applyAt(cell.x, cell.y, false);
          e.preventDefault(); e.stopImmediatePropagation();
        },
        handleEditorCanvasPointerUp(e) {
          if (!this.active || !this.state.dragStart) return;
          const end = this.state.hover || this.state.dragStart;
          if (this.state.activeTool === 'rectangle') this.rectangle(this.state.dragStart, end);
          else if (this.state.activeTool === 'select') this.state.selection = this.bounds(this.state.dragStart, end);
          else if (this.state.activeTool === 'paste') this.pasteAt(end.x, end.y);
          this.commitTransaction(); this.state.dragStart = null; this.state.dragLastKey = ''; this.refresh();
          e.preventDefault(); e.stopImmediatePropagation();
        },

        bindInput() {
          const canvas = game.canvas || DR.runtime?.canvas;
          window.addEventListener('keydown', e => {
            if (e.key === 'F9') { e.preventDefault(); e.stopImmediatePropagation(); this.toggle(); return; }
            if (!this.active) return;
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
            const key = String(e.key || '').toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;
            const actions = ctrl ? { s:'save',z:'undo',y:'redo',x:'cut',c:'copy',v:'paste' } : { b:'tool_pencil',m:'tool_select',r:'tool_rectangle',f:'tool_fill',e:'tool_eraser',i:'tool_eyedropper',g:'grid',a:'attrs' };
            if (/^[1-4]$/.test(key)) {
              const group = e.ctrlKey ? 'fringe' : e.altKey ? 'mask' : e.shiftKey ? 'water' : 'ground'; this.state.activeLayer = `${group}${key}`; this.refresh();
            } else if (key === 'escape') this.cancelOperation();
            else if (actions[key]) {
              const action = actions[key];
              if (action.startsWith('tool_')) { this.state.activeTool = action.slice(5); this.state.selectedAttributeMode = ''; this.refresh(); }
              else if (action === 'save') this.action_save();
              else this[`action_${action}`]?.();
            } else return;
            e.preventDefault(); e.stopImmediatePropagation();
          }, true);
          window.addEventListener('keyup', e => { if (this.active) { game.keys?.delete?.(game.normalizeInputKeyFromEvent?.(e) || e.key); e.stopImmediatePropagation(); } }, true);
          if (!canvas) return;
          canvas.addEventListener('pointermove', e => this.handleEditorCanvasPointerMove(e), true);
          canvas.addEventListener('pointerdown', e => this.handleEditorCanvasPointerDown(e), true);
          window.addEventListener('pointerup', e => this.handleEditorCanvasPointerUp(e), true);
          canvas.addEventListener('contextmenu', e => { if (this.active) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
          canvas.addEventListener('wheel', e => { if (this.active && !this.panel.contains(e.target)) e.stopImmediatePropagation(); }, true);
        },

        pointerCell(e) {
          const rect = game.canvas.getBoundingClientRect();
          const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top;
          const viewport = game.getViewportMetrics?.();
          const logicalWidth = Number(viewport?.width) || rect.width;
          const logicalHeight = Number(viewport?.height) || rect.height;
          const world = game.screenToWorld(cssX * logicalWidth / Math.max(1, rect.width), cssY * logicalHeight / Math.max(1, rect.height));
          const map = this.currentMap(); return { x: Math.max(0, Math.min(map.width - 1, Math.floor(world.x))), y: Math.max(0, Math.min(map.height - 1, Math.floor(world.y))) };
        },
        bounds(a,b) { return { x1:Math.min(a.x,b.x), y1:Math.min(a.y,b.y), x2:Math.max(a.x,b.x), y2:Math.max(a.y,b.y) }; },
        beginTransaction(label) { if (!this.state.transaction) this.state.transaction = { label, changes: new Map() }; },
        record(kind, bucket, key, before, after) {
          this.beginTransaction(kind); const id = `${kind}:${bucket}:${key}`; const tx = this.state.transaction;
          if (!tx.changes.has(id)) tx.changes.set(id, { kind, bucket, key, before:clone(before), after:clone(after) }); else tx.changes.get(id).after = clone(after);
        },
        commitTransaction() {
          const tx = this.state.transaction; this.state.transaction = null;
          if (!tx || !tx.changes.size) return;
          this.state.undoStack.push({ label:tx.label, changes:Array.from(tx.changes.values()) });
          if (this.state.undoStack.length > HISTORY_LIMIT) this.state.undoStack.shift();
          this.state.redoStack.length = 0; this.state.dirty = true; game.worldSaveDirty = true; this.invalidateRuntime();
        },
        setLayer(layer, key, tile) {
          const map = this.currentMap(), bucket = map.layers[layer], before = bucket[key];
          if (tileSignature(before) === tileSignature(tile)) return false;
          this.record('layer', layer, key, before, tile); if (tile) bucket[key] = clone(tile); else delete bucket[key]; return true;
        },
        setAttribute(bucketName, key, value) {
          const bucket = this.currentMap().attributes[bucketName], before = bucket[key];
          if (JSON.stringify(before) === JSON.stringify(value)) return false;
          this.record('attribute', bucketName, key, before, value); if (value != null && value !== false) bucket[key] = clone(value); else delete bucket[key]; return true;
        },

        applyAt(x,y,drag) {
          const map = this.currentMap(); if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
          const key = keyOf(x,y); if (drag && this.state.dragLastKey === key) return; this.state.dragLastKey = key;
          const layer = this.state.activeLayer;
          if (this.state.activeTool === 'pencil') { if (!this.state.layerLocks[layer] && this.state.selectedTile) this.paintSelectedRegion(x,y); }
          else if (this.state.activeTool === 'eraser') { if (!this.state.layerLocks[layer]) this.setLayer(layer,key,null); }
          else if (this.state.activeTool === 'fill') this.bucketFill(x,y);
          else if (this.state.activeTool === 'eyedropper') { const tile = map.layers[layer][key]; if (tile) { this.state.selectedTile = clone(tile); this.state.selectedTileRegion = {tilesetId:tile.tilesetId,sourceX:tile.sourceX,sourceY:tile.sourceY,sourceWidth:tile.sourceWidth,sourceHeight:tile.sourceHeight,tileWidth:tile.sourceWidth,tileHeight:tile.sourceHeight,columns:1,rows:1}; this.state.selectedTileset = tile.tilesetId; this.state.activeTool = 'pencil'; } }
          else if (this.state.activeTool === 'attribute') this.applyAttribute(x,y);
          if (!drag) this.commitTransaction(); this.refresh();
        },

        applyAttribute(x,y) {
          const key = keyOf(x,y), mode = this.state.selectedAttributeMode;
          if (mode === 'paintBlocked') this.setAttribute('blocked',key,true);
          else if (mode === 'eraseBlocked') this.setAttribute('blocked',key,null);
          else if (mode === 'paintNpcAvoid') this.setAttribute('npcAvoid',key,true);
          else if (mode === 'eraseNpcAvoid') this.setAttribute('npcAvoid',key,null);
          else if (mode === 'removeWarp') this.setAttribute('warps',key,null);
          else if (mode === 'removeAnimation') this.setAttribute('animations',key,null);
          else if (mode === 'warp') this.openWarpDialog(x,y);
          else if (mode === 'animation') this.openAnimationDialog(x,y);
        },
        closeDialogs(){this.pendingAttributeCell=null;this.panel.querySelector('[data-warp-modal]')?.classList.remove('active');this.panel.querySelector('[data-animation-modal]')?.classList.remove('active');},
        openWarpDialog(x,y){this.closeDialogs();const old=this.currentMap().attributes.warps[keyOf(x,y)]||{},modal=this.panel.querySelector('[data-warp-modal]'),mapSelect=modal.querySelector('[data-warp-map]');this.pendingAttributeCell={x,y,type:'warp'};mapSelect.innerHTML=Object.values(this.maps).map(map=>`<option value="${map.mapId}">${map.displayName}</option>`).join('');mapSelect.value=old.targetMap||this.zoneKey();modal.querySelector('[data-warp-x]').value=old.targetX??x;modal.querySelector('[data-warp-y]').value=old.targetY??y;modal.querySelector('[data-warp-facing]').value=old.targetFacing||'south';modal.classList.add('active');},
        saveWarpDialog(){const cell=this.pendingAttributeCell,modal=this.panel.querySelector('[data-warp-modal]');if(!cell||cell.type!=='warp')return;const targetMap=cleanId(modal.querySelector('[data-warp-map]').value),target=this.maps[targetMap],targetX=Math.floor(Number(modal.querySelector('[data-warp-x]').value)),targetY=Math.floor(Number(modal.querySelector('[data-warp-y]').value));if(!target||targetX<0||targetY<0||targetX>=target.width||targetY>=target.height){game.log?.('Layered map warp target is invalid or outside map bounds.');return;}
          // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity):
          // this previously had no self-loop guard - a warp could target
          // its own exact tile on its own map, which would trap a player
          // in a zero-distance teleport loop. Bounds/target-exists
          // validation above is unchanged.
          if(targetMap===this.zoneKey()&&targetX===cell.x&&targetY===cell.y){game.log?.('Warp cannot target its own tile - choose a different destination.');return;}
          this.setAttribute('warps',keyOf(cell.x,cell.y),{targetMap,targetX,targetY,targetFacing:modal.querySelector('[data-warp-facing]').value||'south',enabled:true});this.commitTransaction();this.closeDialogs();this.refresh();},
        openAnimationDialog(x,y){this.closeDialogs();const old=this.currentMap().attributes.animations[keyOf(x,y)]||{},modal=this.panel.querySelector('[data-animation-modal]');this.pendingAttributeCell={x,y,type:'animation'};modal.querySelector('[data-animation-id]').value=old.animationId||'waterRipple01';modal.querySelector('[data-animation-speed]').value=old.speed||1;modal.querySelector('[data-animation-x]').value=old.offsetX||0;modal.querySelector('[data-animation-y]').value=old.offsetY||0;modal.querySelector('[data-animation-layer]').value=old.layer||'mask1';modal.classList.add('active');},
        saveAnimationDialog(){const cell=this.pendingAttributeCell,modal=this.panel.querySelector('[data-animation-modal]');if(!cell||cell.type!=='animation')return;const animationId=String(modal.querySelector('[data-animation-id]').value||'').trim();if(!animationId){game.log?.('Animation id is required.');return;}this.setAttribute('animations',keyOf(cell.x,cell.y),{animationId,speed:Math.max(.05,Number(modal.querySelector('[data-animation-speed]').value)||1),loop:true,offsetX:Number(modal.querySelector('[data-animation-x]').value)||0,offsetY:Number(modal.querySelector('[data-animation-y]').value)||0,layer:modal.querySelector('[data-animation-layer]').value||'mask1'});this.commitTransaction();this.closeDialogs();this.refresh();},

        rectangle(a,b) {
          const layer=this.state.activeLayer; if (this.state.layerLocks[layer] || !this.state.selectedTile) return;
          this.beginTransaction('Rectangle fill'); const r=this.bounds(a,b),region=this.state.selectedTileRegion||{columns:1,rows:1};
          for(let y=r.y1;y<=r.y2;y++) for(let x=r.x1;x<=r.x2;x++) this.setLayer(layer,keyOf(x,y),this.tileFromSelectedRegion((x-r.x1)%region.columns,(y-r.y1)%region.rows));
        },
        tileFromSelectedRegion(column=0,row=0) {
          const base=this.state.selectedTile,region=this.state.selectedTileRegion||base;if(!base||!region)return null;
          const tw=region.tileWidth||base.sourceWidth,th=region.tileHeight||base.sourceHeight;
          return {tilesetId:region.tilesetId,sourceX:region.sourceX+column*tw,sourceY:region.sourceY+row*th,sourceWidth:tw,sourceHeight:th,tileWidth:tw,tileHeight:th,tileId:null};
        },
        paintSelectedRegion(x,y) {
          const map=this.currentMap(),layer=this.state.activeLayer,region=this.state.selectedTileRegion||{columns:1,rows:1};
          for(let row=0;row<region.rows;row++)for(let column=0;column<region.columns;column++){
            const tx=x+column,ty=y+row;if(tx<0||ty<0||tx>=map.width||ty>=map.height)continue;
            this.setLayer(layer,keyOf(tx,ty),this.tileFromSelectedRegion(column,row));
          }
        },
        bucketFill(x,y) {
          const map=this.currentMap(),layer=this.state.activeLayer; if(this.state.layerLocks[layer]||!this.state.selectedTile)return;
          const bucket=map.layers[layer], target=tileSignature(bucket[keyOf(x,y)]), replacement=tileSignature(this.state.selectedTile); if(target===replacement)return;
          this.beginTransaction('Bucket fill'); const seen=new Set(), queue=[[x,y]],max=map.width*map.height; let head=0,inspected=0;
          while(head<queue.length&&inspected<max){const [cx,cy]=queue[head++],key=keyOf(cx,cy);if(seen.has(key)||cx<0||cy<0||cx>=map.width||cy>=map.height)continue;seen.add(key);inspected++;if(tileSignature(bucket[key])!==target)continue;this.setLayer(layer,key,this.state.selectedTile);queue.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);}
        },

        selectedRegionData() {
          const r=this.state.selection;if(!r)return null;const data={width:r.x2-r.x1+1,height:r.y2-r.y1+1,layers:Object.fromEntries(LAYERS.map(l=>[l,{}])),attributes:{blocked:{},npcAvoid:{},warps:{},animations:{}}},map=this.currentMap();
          for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++){const src=keyOf(x,y),dst=keyOf(x-r.x1,y-r.y1);for(const l of LAYERS)if(map.layers[l][src])data.layers[l][dst]=clone(map.layers[l][src]);for(const a of Object.keys(data.attributes))if(map.attributes[a][src])data.attributes[a][dst]=clone(map.attributes[a][src]);}return data;
        },
        action_copy(){this.state.clipboard=this.selectedRegionData();this.refresh();},
        action_cut(){const data=this.selectedRegionData();if(!data)return;this.state.clipboard=data;const r=this.state.selection;this.beginTransaction('Cut');for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++){const k=keyOf(x,y);for(const l of LAYERS)if(!this.state.layerLocks[l])this.setLayer(l,k,null);for(const a of ['blocked','npcAvoid','warps','animations'])this.setAttribute(a,k,null);}this.commitTransaction();this.refresh();},
        action_paste(){if(this.state.clipboard){this.state.activeTool='paste';this.state.pastePreview=true;this.refresh();}},
        // Phase 6 (Map/Layer/Attribute/Warp/Resource/Crafting Parity): new
        // "Clear Layer" tool tool - previously the only way to remove tiles
        // was per-cell erase or overwriting a selection; there was no way
        // to wipe an entire layer in one action. Respects the same
        // per-layer lock flag action_cut already honors, and goes through
        // the transaction system so it is a single undoable step.
        action_clearLayer(){const layer=this.state.activeLayer;if(!layer||this.state.layerLocks[layer])return;const keys=Object.keys(this.currentMap().layers[layer]||{});if(!keys.length)return;this.beginTransaction('Clear Layer');for(const k of keys)this.setLayer(layer,k,null);this.commitTransaction();this.refresh();},
        pasteAt(x,y){const c=this.state.clipboard;if(!c)return;this.beginTransaction('Paste');for(let dy=0;dy<c.height;dy++)for(let dx=0;dx<c.width;dx++){const dst=keyOf(x+dx,y+dy),src=keyOf(dx,dy);if(x+dx>=this.currentMap().width||y+dy>=this.currentMap().height)continue;for(const l of LAYERS)if(!this.state.layerLocks[l]&&c.layers[l][src])this.setLayer(l,dst,c.layers[l][src]);for(const a of Object.keys(c.attributes))if(c.attributes[a][src])this.setAttribute(a,dst,c.attributes[a][src]);}this.state.pastePreview=false;this.state.activeTool='select';},
        flipClipboard(horizontal){const c=this.state.clipboard;if(!c)return;const out=clone(c);for(const l of LAYERS)out.layers[l]={};for(const a of Object.keys(out.attributes))out.attributes[a]={};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const nx=horizontal?c.width-1-x:x,ny=horizontal?y:c.height-1-y,src=keyOf(x,y),dst=keyOf(nx,ny);for(const l of LAYERS)if(c.layers[l][src])out.layers[l][dst]=clone(c.layers[l][src]);for(const a of Object.keys(c.attributes))if(c.attributes[a][src])out.attributes[a][dst]=clone(c.attributes[a][src]);}this.state.clipboard=out;this.refresh();},
        action_flipH(){this.flipClipboard(true);}, action_flipV(){this.flipClipboard(false);},

        applyHistory(entry, undo) { const map=this.currentMap(); for(const ch of entry.changes){const bucket=ch.kind==='layer'?map.layers[ch.bucket]:map.attributes[ch.bucket],value=undo?ch.before:ch.after;if(value==null)delete bucket[ch.key];else bucket[ch.key]=clone(value);}this.state.dirty=true;this.invalidateRuntime(); },
        action_undo(){const e=this.state.undoStack.pop();if(!e)return;this.applyHistory(e,true);this.state.redoStack.push(e);this.refresh();},
        action_redo(){const e=this.state.redoStack.pop();if(!e)return;this.applyHistory(e,false);this.state.undoStack.push(e);this.refresh();},
        action_grid(){this.state.gridEnabled=!this.state.gridEnabled;this.refresh();}, action_attrs(){this.state.attributeOverlayEnabled=!this.state.attributeOverlayEnabled;this.refresh();},
        action_zoomIn(){game.camera.targetZoom=Math.min(DR.CONFIG?.CAMERA_MAX_ZOOM||2,(game.camera.targetZoom||1)+.1);}, action_zoomOut(){game.camera.targetZoom=Math.max(DR.CONFIG?.CAMERA_MIN_ZOOM||.5,(game.camera.targetZoom||1)-.1);},
        action_exit(){game.systemLookup?.['editor-shell']?.toggle?.(false);},

        action_save(){game.saveWorldState?.();this.markWorldSaved();},
        action_load(){game.loadSavedWorldState?.({silent:false,resetEntities:true});},
        download(name,text,type='application/json'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);},
        action_export(){this.download(`${this.currentMap().mapId}.map.json`,JSON.stringify(this.currentMap(),null,2));},
        action_import(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const map=normalizeMap(JSON.parse(await input.files[0].text()),this.currentMap());this.maps[map.mapId]=map;this.state.dirty=true;game.worldSaveDirty=true;this.refresh();game.log?.(`Imported layered map: ${map.displayName}. Save World to persist it.`);}catch(err){game.log?.(`Map import failed: ${err.message}`);}};input.click();},
        action_importTileset(){const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const id=cleanId(file.name.replace(/\.[^.]+$/,''))||`tileset_${Date.now()}`,map=this.currentMap(),tileSize=map.tileSize||32;const set={id,name:file.name,src:String(reader.result),tileWidth:tileSize,tileHeight:tileSize};const at=map.tilesets.findIndex(t=>t.id===id);if(at>=0)map.tilesets[at]=set;else map.tilesets.push(set);this.images.delete(id);this.state.selectedTileset=id;this.state.dirty=true;game.worldSaveDirty=true;this.loadImage(set);this.refresh();};reader.readAsDataURL(file);};input.click();},
        action_screenshot(){try{game.canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${this.currentMap().mapId}-view.png`;a.click();URL.revokeObjectURL(url);},'image/png');}catch(err){game.log?.(`Screenshot failed: ${err.message}`);}},

        importMaps(raw) { if(!raw||typeof raw!=='object')return false;const next={};for(const [id,map] of Object.entries(raw)){try{next[id]=normalizeMap(map,this.maps[id]);}catch(err){console.warn(`[Dream Realms] Ignored malformed layered map ${id}:`,err.message);}}this.maps=next;this.images.clear();this.ensureMaps();this.state.undoStack.length=0;this.state.redoStack.length=0;this.state.dirty=false;return true; },
        markWorldSaved(){this.state.dirty=false;this.refresh();},
        invalidateRuntime(){game.mapDirty=true;game._pathWorkerGridVersion=(Number(game._pathWorkerGridVersion)||0)+1;game.invalidateTerrainChunks?.('layered map edit');},
        cancelOperation(){this.state.dragStart=null;this.state.dragLastKey='';this.state.transaction=null;this.state.pastePreview=false;if(this.state.activeTool==='paste')this.state.activeTool='select';this.refresh();},

        sheetCell(e){const rect=this.sheetCanvas.getBoundingClientRect(),set=this.currentMap().tilesets.find(t=>t.id===this.state.selectedTileset);if(!set)return{x:0,y:0};return{x:Math.max(0,Math.floor((e.clientX-rect.left)*(this.sheetCanvas.width/Math.max(1,rect.width))/set.tileWidth)),y:Math.max(0,Math.floor((e.clientY-rect.top)*(this.sheetCanvas.height/Math.max(1,rect.height))/set.tileHeight))};},
        selectSheetRegion(a,b){const set=this.currentMap().tilesets.find(t=>t.id===this.state.selectedTileset);if(!set)return;const x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y),columns=x2-x1+1,rows=y2-y1+1;this.state.selectedTileRegion={tilesetId:set.id,sourceX:x1*set.tileWidth,sourceY:y1*set.tileHeight,sourceWidth:columns*set.tileWidth,sourceHeight:rows*set.tileHeight,tileWidth:set.tileWidth,tileHeight:set.tileHeight,columns,rows};this.state.selectedTile={tilesetId:set.id,sourceX:x1*set.tileWidth,sourceY:y1*set.tileHeight,sourceWidth:set.tileWidth,sourceHeight:set.tileHeight,tileWidth:set.tileWidth,tileHeight:set.tileHeight,tileId:y1*Math.max(1,Math.floor(this.sheetCanvas.width/set.tileWidth))+x1};this.refresh();},
        loadImage(set){if(this.images.has(set.id))return;const img=new Image();img.onload=()=>{this.images.set(set.id,img);if(this.state.selectedTileset===set.id)this.drawSheet();};img.onerror=()=>game.log?.(`Tileset failed to load: ${set.src}`);img.src=set.src;},
        drawSheet(){const set=this.currentMap().tilesets.find(t=>t.id===this.state.selectedTileset);if(!set)return;this.loadImage(set);const img=this.images.get(set.id);if(!img)return;this.sheetCanvas.width=img.width;this.sheetCanvas.height=img.height;const c=this.sheetCanvas.getContext('2d');c.clearRect(0,0,img.width,img.height);c.drawImage(img,0,0);c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=1;for(let x=0;x<=img.width;x+=set.tileWidth){c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,img.height);c.stroke();}for(let y=0;y<=img.height;y+=set.tileHeight){c.beginPath();c.moveTo(0,y+.5);c.lineTo(img.width,y+.5);c.stroke();}const t=this.state.selectedTileRegion||this.state.selectedTile;if(t?.tilesetId===set.id){c.strokeStyle='#ffd36c';c.lineWidth=2;c.strokeRect(t.sourceX+1,t.sourceY+1,t.sourceWidth-2,t.sourceHeight-2);}},

        refresh(){if(!this.panel)return;const map=this.currentMap(),s=this.state;this.panel.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===s.activeTool));this.panel.querySelectorAll('[data-layer]').forEach(b=>b.classList.toggle('active',b.dataset.layer===s.activeLayer));this.panel.querySelectorAll('[data-visible]').forEach(b=>{b.classList.toggle('active',s.layerVisibility[b.dataset.visible]);b.textContent=s.layerVisibility[b.dataset.visible]?'◉':'○';});this.panel.querySelectorAll('[data-lock]').forEach(b=>{b.classList.toggle('active',s.layerLocks[b.dataset.lock]);b.textContent=s.layerLocks[b.dataset.lock]?'🔒':'🔓';});this.panel.querySelectorAll('[data-solo]').forEach(b=>b.classList.toggle('active',b.dataset.solo===s.soloLayer));this.panel.querySelectorAll('[data-attribute]').forEach(b=>b.classList.toggle('active',b.dataset.attribute===s.selectedAttributeMode));this.panel.querySelector('[data-action="grid"]').classList.toggle('active',s.gridEnabled);this.panel.querySelector('[data-action="attrs"]').classList.toggle('active',s.attributeOverlayEnabled);const select=this.panel.querySelector('[data-tileset]');select.innerHTML=map.tilesets.map(t=>`<option value="${t.id}">${t.name||t.id}</option>`).join('');select.value=s.selectedTileset;const t=s.selectedTileRegion||s.selectedTile;if(this.selectedPreview)this.selectedPreview.textContent=t?`Selected: ${t.tilesetId} [${t.sourceX}, ${t.sourceY}] ${t.columns||1}×${t.rows||1} tiles (${t.sourceWidth}×${t.sourceHeight}px)`:'No tile selected';this.drawSheet();this.refreshStatus();},
        refreshStatus(){if(!this.status)return;const s=this.state,m=this.currentMap(),h=s.hover,a=h?game.layeredMapAttributeAt(h.x,h.y):null,region=s.selectedTileRegion,attributeText=a?[a.blocked&&'Blocked',a.npcAvoid&&'NPC Avoid',a.warp&&`Warp→${a.warp.targetMap}:${a.warp.targetX},${a.warp.targetY}`,a.animation&&`Animation:${a.animation.animationId}`].filter(Boolean).join(', ')||'No attributes':'';this.status.textContent=`${m.mapId} / ${m.displayName}${s.dirty?' *':''} | ${s.activeLayer} | ${s.activeTool}${s.selectedAttributeMode?'/'+s.selectedAttributeMode:''} | ${h?`${h.x},${h.y}`:'—'} | Brush ${region?`${region.columns}×${region.rows}`:'1×1'} | ${attributeText} | Undo ${s.undoStack.length} Redo ${s.redoStack.length}`;},

        tileImage(tile){const set=this.currentMap().tilesets.find(t=>t.id===tile?.tilesetId);if(set)this.loadImage(set);return set?this.images.get(set.id):null;},
        drawTileRef(ctx,x,y,tile,alpha=1){const img=this.tileImage(tile);if(!img)return;const base=game.map?.[y]?.[x],elev=Number(base?.elev)||0,n=game.worldToScreen(x-.5,y-.5,elev+.012),e=game.worldToScreen(x+.5,y-.5,elev+.012),so=game.worldToScreen(x+.5,y+.5,elev+.012),w=game.worldToScreen(x-.5,y+.5,elev+.012);ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(e.x,e.y);ctx.lineTo(so.x,so.y);ctx.lineTo(w.x,w.y);ctx.closePath();ctx.clip();const minX=Math.min(n.x,e.x,so.x,w.x),maxX=Math.max(n.x,e.x,so.x,w.x),minY=Math.min(n.y,e.y,so.y,w.y),maxY=Math.max(n.y,e.y,so.y,w.y);ctx.drawImage(img,tile.sourceX,tile.sourceY,tile.sourceWidth,tile.sourceHeight,minX,minY,maxX-minX,maxY-minY);ctx.restore();},
        visibleBounds(){const p=game.player||{x:0,y:0},pad=game.worldRenderPadTiles?.()||35,m=this.currentMap();return{x1:Math.max(0,Math.floor(p.x-pad)),y1:Math.max(0,Math.floor(p.y-pad)),x2:Math.min(m.width-1,Math.ceil(p.x+pad)),y2:Math.min(m.height-1,Math.ceil(p.y+pad))};},
        renderLayers(ctx,layers){const map=this.currentMap(),b=this.visibleBounds(),s=this.state;for(const layer of layers){if(!s.layerVisibility[layer]||(s.soloLayer&&s.soloLayer!==layer))continue;for(const [key,tile] of Object.entries(map.layers[layer])){const [x,y]=key.split(',').map(Number);if(x<b.x1||x>b.x2||y<b.y1||y>b.y2)continue;this.drawTileRef(ctx,x,y,tile);}}this.renderAnimations(ctx,layers,b);},
        renderAnimations(ctx,layers,b){const map=this.currentMap(),now=performance.now()/1000,s=this.state;for(const [key,a] of Object.entries(map.attributes.animations)){const layer=a?.layer||'mask1';if(!a||!layers.includes(layer)||!s.layerVisibility[layer]||(s.soloLayer&&s.soloLayer!==layer))continue;const [x,y]=key.split(',').map(Number);if(x<b.x1||x>b.x2||y<b.y1||y>b.y2)continue;const base=game.map?.[y]?.[x],p=game.worldToScreen(x,y,(base?.elev||0)+.2),phase=(now*(Number(a.speed)||1))%(Math.PI*2);ctx.save();ctx.strokeStyle=`rgba(100,210,255,${.55+Math.sin(phase)*.25})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x+(a.offsetX||0),p.y+(a.offsetY||0),10+Math.sin(phase)*3,5+Math.sin(phase)*1.5,0,0,Math.PI*2);ctx.stroke();ctx.restore();}},
        renderUnderEntities(ctx){this.renderLayers(ctx,LOWER_LAYERS);}, renderFringe(ctx){this.renderLayers(ctx,FRINGE_LAYERS);},
        renderOverlays(ctx){if(!this.active)return;const b=this.visibleBounds(),s=this.state,map=this.currentMap();ctx.save();if(s.gridEnabled){ctx.strokeStyle='rgba(235,211,150,.28)';ctx.lineWidth=1;for(let y=b.y1;y<=b.y2;y++)for(let x=b.x1;x<=b.x2;x++)this.strokeCell(ctx,x,y);}if(s.attributeOverlayEnabled){for(const [k]of Object.entries(map.attributes.blocked))this.fillCellKey(ctx,k,'rgba(230,60,55,.32)',b);for(const [k]of Object.entries(map.attributes.npcAvoid))this.fillCellKey(ctx,k,'rgba(240,170,45,.30)',b);for(const [k]of Object.entries(map.attributes.warps))this.marker(ctx,k,'W','#a880ff',b);for(const [k]of Object.entries(map.attributes.animations))this.marker(ctx,k,'A','#62d9ee',b);}if(s.hover){this.strokeCell(ctx,s.hover.x,s.hover.y,'#ffe083',2);if(s.activeTool==='paste'&&s.clipboard){for(let y=0;y<s.clipboard.height;y++)for(let x=0;x<s.clipboard.width;x++)this.strokeCell(ctx,s.hover.x+x,s.hover.y+y,'#71e2a0',1);}}if(s.dragStart&&s.hover&&['rectangle','select'].includes(s.activeTool)){const r=this.bounds(s.dragStart,s.hover);for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++)this.strokeCell(ctx,x,y,'#ffbc57',1);}if(s.selection){const r=s.selection;for(let y=r.y1;y<=r.y2;y++)for(let x=r.x1;x<=r.x2;x++)if(x===r.x1||x===r.x2||y===r.y1||y===r.y2)this.strokeCell(ctx,x,y,'#70cfff',1);}ctx.restore();},
        cellPoints(x,y){const e=Number(game.map?.[y]?.[x]?.elev)||0;return[game.worldToScreen(x-.5,y-.5,e+.03),game.worldToScreen(x+.5,y-.5,e+.03),game.worldToScreen(x+.5,y+.5,e+.03),game.worldToScreen(x-.5,y+.5,e+.03)];},
        strokeCell(ctx,x,y,color='rgba(255,255,255,.25)',width=1){const p=this.cellPoints(x,y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.stroke();},
        fillCellKey(ctx,key,color,b){const[x,y]=key.split(',').map(Number);if(x<b.x1||x>b.x2||y<b.y1||y>b.y2)return;const p=this.cellPoints(x,y);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();},
        marker(ctx,key,label,color,b){const[x,y]=key.split(',').map(Number);if(x<b.x1||x>b.x2||y<b.y1||y>b.y2)return;const p=game.worldToScreen(x,y,(game.map?.[y]?.[x]?.elev||0)+.18);ctx.fillStyle=color;ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(label,p.x,p.y);},
        update(dt){
          if(this.active){game.keys?.clear?.();game.clearClickMoveTarget?.();return;}
          this.warpCooldown=Math.max(0,Number(this.warpCooldown||0)-(Number(dt)||0));
          const p=game.player;if(!p||this.warpCooldown>0)return;
          const key=keyOf(Math.floor(p.x),Math.floor(p.y)),warp=this.currentMap().attributes.warps[key];
          if(!warp||warp.enabled===false)return;
          const target=this.maps[warp.targetMap];
          if(!target||warp.targetX<0||warp.targetY<0||warp.targetX>=target.width||warp.targetY>=target.height){const warningKey=`${this.zoneKey()}:${key}`;this.invalidWarpWarnings=this.invalidWarpWarnings||new Set();if(!this.invalidWarpWarnings.has(warningKey)){this.invalidWarpWarnings.add(warningKey);console.warn(`[Dream Realms] Invalid layered-map warp at ${warningKey}.`);}this.warpCooldown=1;return;}
          if(warp.targetMap==='dark_woods'&&game.currentZone!=='overworld'){game.currentZone='overworld';game.map=game.overworldMap;game.objects=game.overworldObjects;game.setActiveEnemySet?.(game.overworldEnemies);}
          else if(warp.targetMap==='mossfang_cave'&&game.currentZone!=='cave'){game.currentZone='cave';game.map=game.caveMap;game.objects=game.caveObjects;game.setActiveEnemySet?.(game.caveEnemies);}
          else if(warp.targetMap!==this.zoneKey()){console.warn(`[Dream Realms] Layered-map warp target "${warp.targetMap}" has no active runtime world.`);this.warpCooldown=1;return;}
          p.x=warp.targetX+.5;p.y=warp.targetY+.5;p.facing=warp.targetFacing||p.facing;game.clearClickMoveTarget?.();game.syncPartyCompanionsToPlayerZone?.({zone:game.currentZone,snap:true,reason:'layered-map-warp'});game.mapDirty=true;this.warpCooldown=.9;
        }, render(){},
        onGameEvent(name){if(name==='player-started')this.ensureMaps();}
      };
      runtime.init(); return runtime;
    }
  });
})();
