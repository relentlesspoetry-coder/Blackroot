// Dream Realms runtime crafting system
// Modular Pass 35: makes editor recipe drafts and placed crafting stations usable at runtime.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.crafting-runtime.v2';
  const LEGACY_STORAGE_KEY = 'dream-realms.crafting-runtime.v1';

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const nowMs = () => Date.now();
  const normalizeId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const titleCaseFromId = value => String(value || 'item')
    .replace(/^item_/, '')
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  function isTypingTarget(event) {
    const el = event.target;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function defaultSkill(profession) {
    return {
      id: profession.id,
      name: profession.name || profession.id,
      level: 1,
      xp: 0,
      crafts: 0,
      failures: 0,
      rareCrafts: 0
    };
  }

  function professionList(game) {
    const defs = Object.values(game.editorProfessions || DR.PROFESSION_BY_ID || {});
    return defs.length ? defs : Object.values(DR.PROFESSION_BY_ID || {});
  }

  function defaultState(game) {
    const skills = {};
    for (const profession of professionList(game)) skills[profession.id] = defaultSkill(profession);
    for (const id of ['cooking', 'blacksmithing', 'tailoring']) {
      if (!skills[id]) skills[id] = defaultSkill({ id, name: id.charAt(0).toUpperCase() + id.slice(1) });
    }
    return {
      version: 2,
      skills,
      unlockedRecipes: {},
      craftedCounts: {},
      lastStationKey: null,
      lastRecipeId: null,
      lastResult: null
    };
  }

  function normalizeSkill(profession, raw) {
    const skill = defaultSkill(profession);
    if (!raw || typeof raw !== 'object') return skill;
    skill.level = Math.max(1, Math.floor(safeNumber(raw.level, 1)));
    skill.xp = Math.max(0, Math.floor(safeNumber(raw.xp, 0)));
    skill.crafts = Math.max(0, Math.floor(safeNumber(raw.crafts, 0)));
    skill.failures = Math.max(0, Math.floor(safeNumber(raw.failures, 0)));
    skill.rareCrafts = Math.max(0, Math.floor(safeNumber(raw.rareCrafts, 0)));
    return skill;
  }

  function normalizeState(game, raw) {
    const state = defaultState(game);
    if (!raw || typeof raw !== 'object') return state;
    const rawSkills = raw.skills && typeof raw.skills === 'object' ? raw.skills : {};
    const defs = professionList(game);
    for (const profession of defs) {
      state.skills[profession.id] = normalizeSkill(profession, rawSkills[profession.id]);
    }
    state.unlockedRecipes = raw.unlockedRecipes && typeof raw.unlockedRecipes === 'object' ? raw.unlockedRecipes : {};
    state.craftedCounts = raw.craftedCounts && typeof raw.craftedCounts === 'object' ? raw.craftedCounts : {};
    state.lastStationKey = raw.lastStationKey || null;
    state.lastRecipeId = raw.lastRecipeId || null;
    state.lastResult = raw.lastResult && typeof raw.lastResult === 'object' ? raw.lastResult : null;
    return state;
  }

  function readLocalState(game) {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY) || window.localStorage?.getItem(LEGACY_STORAGE_KEY);
      return raw ? normalizeState(game, JSON.parse(raw)) : defaultState(game);
    } catch (_err) {
      return defaultState(game);
    }
  }

  function writeLocalState(state) {
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_err) {}
  }

  function zoneKey(game) {
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function inventoryKey(item) {
    return String(item?.itemId || item?.id || item?.baseName || item?.name || '').trim();
  }

  function inventoryMatches(item, itemId) {
    if (!item || !itemId) return false;
    const target = String(itemId);
    const cleanTarget = normalizeId(itemId);
    return inventoryKey(item) === target
      || normalizeId(inventoryKey(item)) === cleanTarget
      || normalizeId(item.name) === cleanTarget
      || normalizeId(item.baseName) === cleanTarget;
  }

  function itemStack(item) {
    return Math.max(1, Math.floor(safeNumber(item?.stack, 1)));
  }


  function isEquipmentDraft(draft) {
    if (!draft || typeof draft !== 'object') return false;
    const type = String(draft.type || '').toLowerCase();
    const slot = String(draft.slot || '').toLowerCase();
    return !['resource', 'quest', 'currency', 'consumable'].includes(type) && slot && slot !== 'none' && slot !== 'material';
  }

  function runtimeRarity(game, key, fallbackKey = 'white') {
    return game.runtimeRarity?.(key, fallbackKey)
      || (DR.RARITIES || []).find(rarity => rarity.key === key)
      || (DR.RARITIES || []).find(rarity => rarity.key === fallbackKey)
      || { key: fallbackKey, label: titleCaseFromId(fallbackKey), color: '#d8ded1', stat: 1, affixes: 0 };
  }

  function recipePrerequisites(recipe) {
    const ids = [];
    const push = value => {
      if (!value) return;
      if (Array.isArray(value)) value.forEach(push);
      else ids.push(String(value));
    };
    push(recipe?.requiredRecipeId);
    push(recipe?.requiresRecipeId);
    push(recipe?.requiredRecipes);
    push(recipe?.requiresRecipes);
    push(recipe?.unlockPrerequisites);
    return [...new Set(ids.filter(Boolean))];
  }

  function scaleStats(stats, scale, bonuses = {}) {
    const out = {};
    for (const [stat, value] of Object.entries(stats || {})) {
      const raw = safeNumber(value, 0) * scale;
      out[stat] = stat === 'speed' ? Number(raw.toFixed(2)) : Math.max(1, Math.floor(raw));
    }
    for (const [stat, value] of Object.entries(bonuses || {})) {
      const raw = safeNumber(value, 0);
      out[stat] = stat === 'speed' ? Number(((out[stat] || 0) + raw).toFixed(2)) : Math.max(1, Math.floor((out[stat] || 0) + raw));
    }
    return out;
  }

  function createCraftedEquipment(game, draft, output, recipe) {
    const variant = normalizeId(output.variant || 'crafted');
    const rarity = runtimeRarity(game, output.rarityKey || draft.rarity || 'white', draft.rarity || 'white');
    const baseScale = safeNumber(output.statScale, variant === 'refined' ? 1.18 : 1.10);
    const rarityScale = Math.max(0.5, safeNumber(rarity.stat, 1));
    const scale = Math.max(0.5, baseScale * rarityScale);
    const name = output.name || `${titleCaseFromId(output.variant)} ${draft.name || titleCaseFromId(draft.id)}`;
    return {
      id: game.itemSerial++,
      itemId: `${draft.id}_${variant}`,
      name,
      baseName: draft.name || draft.id,
      slot: game.normalizeItemDraftSlot?.(draft.slot, draft.type) || draft.slot || 'charm',
      classes: Array.isArray(draft.classRestrictions) ? [...draft.classRestrictions] : Object.keys(DR.CLASSES || {}),
      rarity,
      stats: scaleStats(draft.stats || {}, scale, output.stats || output.bonusStats || {}),
      level: Math.max(1, Math.floor(safeNumber(output.levelRequirement ?? draft.levelRequirement, 1))),
      value: Math.max(1, Math.floor(safeNumber(output.sellValue ?? draft.sellValue ?? draft.value, 1) * Math.max(1, baseScale))),
      description: output.description || `${name} crafted from ${draft.name || titleCaseFromId(draft.id)}.`,
      crafted: true,
      craftedVariant: output.variant || variant,
      sourceRecipeId: recipe?.id || null,
      compiled: true
    };
  }

  function stationList(game) {
    const defs = Object.values(game.editorCraftingStations || DR.CRAFTING_STATION_BY_ID || {});
    return defs.length ? defs : Object.values(DR.CRAFTING_STATION_BY_ID || {});
  }

  function recipeList(game) {
    const defs = Object.values(game.editorRecipes || DR.CRAFTING_RECIPE_BY_ID || {});
    return defs.length ? defs : Object.values(DR.CRAFTING_RECIPE_BY_ID || {});
  }

  function stationForObject(game, obj) {
    if (!obj) return null;
    const stations = stationList(game);
    const explicit = obj.stationId || obj.craftingStationId || obj.station;
    if (explicit) return game.editorCraftingStations?.[explicit] || DR.CRAFTING_STATION_BY_ID?.[explicit] || null;
    const type = String(obj.type || obj.objectType || obj.kind || '').trim();
    return stations.find(station => String(station.objectType || '') === type) || null;
  }

  function stationKey(game, station, x, y) {
    return `${zoneKey(game)}:${Math.floor(x)},${Math.floor(y)}:${station?.id || 'station'}`;
  }

  function ensurePanel(runtime) {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('craftingRuntimePanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'craftingRuntimePanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Crafting</h3>
      <div class="small" data-crafting-status>Press C near a crafting station.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-crafting-progress style="background:linear-gradient(90deg,#8a5b34,#f0bd70)"></div></div>
      <div class="small" data-crafting-meta>Cooking 1 · Smithing 1 · Tailoring 1</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  // V0.18.73: one-time stylesheet for a cleaner crafting window (cards, icons, material chips,
  // tab pills). Scoped under #craftingWindow so it can't leak into other UI.
  function ensureCraftingStyles() {
    if (document.getElementById('dr-crafting-styles')) return;
    const style = document.createElement('style');
    style.id = 'dr-crafting-styles';
    style.textContent = `
      #craftingWindow{position:fixed;z-index:18;width:min(440px,calc(100vw - 36px));max-height:calc(100vh - 120px);
        overflow:auto;display:none;padding:0;color:#e9e2cd;font-family:Inter,system-ui,sans-serif;
        background:linear-gradient(180deg,rgba(20,17,12,.97),rgba(11,9,6,.97));border:1px solid rgba(240,189,112,.28);
        border-radius:14px;box-shadow:0 22px 60px rgba(0,0,0,.55);backdrop-filter:blur(12px);}
      #craftingWindow .crHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;
        padding:14px 16px 12px;border-bottom:1px solid rgba(240,189,112,.16);position:sticky;top:0;
        background:linear-gradient(180deg,rgba(28,22,14,.98),rgba(20,16,10,.9));border-radius:14px 14px 0 0;cursor:grab;}
      #craftingWindow .crTitle{font:800 16px/1.1 Inter,system-ui;color:#f4d79a;letter-spacing:.2px;}
      #craftingWindow .crSub{font-size:11px;color:#b7ab8f;margin-top:3px;text-transform:capitalize;}
      #craftingWindow .crClose{padding:6px 12px;border-radius:8px;border:1px solid rgba(216,222,209,.25);
        background:rgba(255,255,255,.06);color:#e9e2cd;cursor:pointer;font:600 12px Inter;}
      #craftingWindow .crClose:hover{background:rgba(255,255,255,.12);}
      #craftingWindow .crBody{padding:12px 14px 16px;}
      #craftingWindow .crTabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;}
      #craftingWindow .crTab{padding:5px 12px;border-radius:999px;border:1px solid rgba(216,222,209,.24);
        background:rgba(255,255,255,.05);color:#d9d2bd;font:600 12px Inter;cursor:pointer;transition:.12s;}
      #craftingWindow .crTab:hover{background:rgba(255,255,255,.1);border-color:rgba(240,189,112,.4);}
      #craftingWindow .crTab.on{background:linear-gradient(180deg,#f6cd82,#e7b45f);color:#2a1e0c;border-color:#f0bd70;}
      #craftingWindow .crTab .crN{opacity:.6;font-weight:700;margin-left:3px;}
      #craftingWindow .crTab.on .crN{opacity:.75;}
      #craftingWindow .crGroup{margin:12px 0 4px;color:#f0bd70;font:700 11px Inter;letter-spacing:.6px;
        text-transform:uppercase;border-bottom:1px solid rgba(240,189,112,.2);padding-bottom:4px;}
      #craftingWindow .crCard{display:flex;gap:11px;padding:11px 12px;margin:8px 0;border-radius:11px;
        border:1px solid rgba(216,222,209,.13);background:rgba(255,255,255,.035);transition:.12s;}
      #craftingWindow .crCard:hover{background:rgba(255,255,255,.06);border-color:rgba(240,189,112,.28);}
      #craftingWindow .crIcon{width:42px;height:42px;flex:0 0 42px;border-radius:9px;display:grid;place-items:center;
        font-size:21px;border:1px solid rgba(0,0,0,.35);box-shadow:inset 0 1px 2px rgba(255,255,255,.18);}
      #craftingWindow .crMain{flex:1;min-width:0;}
      #craftingWindow .crName{font:700 14px Inter;color:#f3e7c8;}
      #craftingWindow .crEffect{color:#a9c6e8;font-size:12px;margin-top:2px;}
      #craftingWindow .crMats{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}
      #craftingWindow .crMat{font:600 11px Inter;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.06);color:#cfc9b6;}
      #craftingWindow .crMat.ok{color:#bce7a4;background:rgba(120,190,90,.14);}
      #craftingWindow .crMat.miss{color:#eb9a84;background:rgba(200,80,60,.15);}
      #craftingWindow .crFoot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:9px;}
      #craftingWindow .crMeta{font-size:11px;color:#9a9080;}
      #craftingWindow .crMeta.bad{color:#e2a184;}
      #craftingWindow .crBtn{padding:7px 18px;border-radius:9px;border:1px solid #6d9048;font:700 13px Inter;cursor:pointer;
        background:linear-gradient(180deg,#5a7d38,#456029);color:#f0ffe0;flex:0 0 auto;transition:.12s;}
      #craftingWindow .crBtn:hover:not(:disabled){filter:brightness(1.12);}
      #craftingWindow .crBtn:disabled{opacity:.4;cursor:default;filter:grayscale(.5);}
      #craftingWindow .crEmpty{color:#9a9080;font-size:12px;padding:10px 2px;}
    `;
    document.head.appendChild(style);
  }

  function ensureWindow(runtime) {
    let panel = document.getElementById('craftingWindow');
    if (panel) return panel;
    ensureCraftingStyles();
    panel = document.createElement('section');
    panel.id = 'craftingWindow';
    panel.className = 'panel gameWindow craftingWindowPanel';
    panel.innerHTML = `
      <div class="crHead windowHeader" data-window-drag-handle>
        <div>
          <div class="crTitle name">Crafting Station</div>
          <div class="crSub" data-crafting-window-station>No station selected.</div>
        </div>
        <button type="button" class="crClose" data-crafting-close>Close</button>
      </div>
      <div class="crBody" data-crafting-window-body>No recipes.</div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-crafting-close]')?.addEventListener('click', () => runtime.toggleWindow(false));
    panel.addEventListener('click', event => {
      // V0.18.72: category tab - filter the recipe list to the clicked category.
      const catBtn = event.target.closest('button[data-craft-cat]');
      if (catBtn) {
        runtime.selectedCraftCategory = catBtn.dataset.craftCat;
        runtime.refreshWindow();
        return;
      }
      const button = event.target.closest('button[data-craft-recipe]');
      if (!button) return;
      runtime.startCraft(button.dataset.craftRecipe);
    });
    return panel;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
  }

  window.registerDreamRealmsSystem({
    id: 'runtimeCrafting',
    name: 'Runtime Crafting',

    install(game) {
      const runtime = {
        id: 'runtimeCrafting',
        name: 'Runtime Crafting',
        game,
        state: normalizeState(game, game.pendingCraftingRuntimeState || readLocalState(game)),
        panel: null,
        windowPanel: null,
        nearbyStation: null,
        active: null,
        statusTick: 0,
        status: 'Press C near a crafting station.',
        open: false,

        init() {
          game.craftingSystem = this;
          game.craftingRuntimeState = this.state;
          this.panel = ensurePanel(this);
          this.windowPanel = ensureWindow(this);
          this.bindInput();
          this.refreshPanel();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'crafting') : String(event.key || '').toLowerCase() === 'j')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            event.preventDefault();
            this.toggleCraftingNearPlayer();
          });
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(raw) {
          this.state = normalizeState(game, raw || defaultState(game));
          game.craftingRuntimeState = this.state;
          this.active = null;
          this.refreshPanel();
          this.refreshWindow();
        },

        saveState() {
          game.craftingRuntimeState = this.state;
          writeLocalState(this.state);
        },

        skillFor(recipe) {
          const professionId = recipe?.profession || this.stationById(recipe?.stationId)?.profession || 'cooking';
          if (!this.state.skills[professionId]) {
            const prof = game.editorProfessions?.[professionId] || DR.PROFESSION_BY_ID?.[professionId] || { id: professionId, name: titleCaseFromId(professionId) };
            this.state.skills[professionId] = defaultSkill(prof);
          }
          return this.state.skills[professionId];
        },

        stationById(stationId) {
          return game.editorCraftingStations?.[stationId] || DR.CRAFTING_STATION_BY_ID?.[stationId] || null;
        },

        recipeById(recipeId) {
          return game.editorRecipes?.[recipeId] || DR.CRAFTING_RECIPE_BY_ID?.[recipeId] || null;
        },

        stationRecipes(station) {
          if (!station) return [];
          return recipeList(game)
            .filter(recipe => recipe && (recipe.stationId === station.id || recipe.profession === station.profession))
            .sort((a, b) => safeNumber(a.tier, 1) - safeNumber(b.tier, 1) || String(a.name || a.id).localeCompare(String(b.name || b.id)));
        },

        currentObjectGrid() {
          return game.objects || [];
        },

        findNearbyStation(range = 2.65) {
          if (!game.player) return null;
          const px = game.player.x;
          const py = game.player.y;
          const minX = Math.max(0, Math.floor(px - range));
          const maxX = Math.min((DR.CONFIG?.MAP_SIZE || 200) - 1, Math.ceil(px + range));
          const minY = Math.max(0, Math.floor(py - range));
          const maxY = Math.min((DR.CONFIG?.MAP_SIZE || 200) - 1, Math.ceil(py + range));
          let best = null;
          let bestD = range;
          const objects = this.currentObjectGrid();
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const obj = objects[y]?.[x];
              const station = stationForObject(game, obj);
              if (!station) continue;
              const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
              if (d <= bestD) {
                best = { station, obj, x, y, key: stationKey(game, station, x, y), distance: d };
                bestD = d;
              }
            }
          }
          return best;
        },

        toggleCraftingNearPlayer() {
          if (this.active) {
            this.cancelCraft('Crafting cancelled.');
            return false;
          }
          const nearby = this.findNearbyStation();
          if (!nearby) {
            this.status = 'No crafting station nearby.';
            game.log(this.status);
            this.toggleWindow(false);
            this.refreshPanel();
            return false;
          }
          this.nearbyStation = nearby;
          this.toggleWindow(!this.open, nearby);
          return true;
        },

        toggleWindow(force, stationRef = null) {
          this.open = typeof force === 'boolean' ? force : !this.open;
          if (stationRef) this.nearbyStation = stationRef;
          if (!this.windowPanel) this.windowPanel = ensureWindow(this);
          if (this.windowPanel) {
            this.windowPanel.style.display = this.open ? 'block' : 'none';
            if (this.open) game.applyUiWindowStoredPosition?.(this.windowPanel);
          }
          this.refreshWindow();
        },

        inventoryCount(itemId) {
          let total = 0;
          for (const item of game.inventory || []) {
            if (!inventoryMatches(item, itemId)) continue;
            total += itemStack(item);
          }
          return total;
        },

        hasInputs(recipe) {
          for (const input of recipe?.inputs || []) {
            if (this.inventoryCount(input.itemId) < Math.max(1, Math.floor(safeNumber(input.quantity, 1)))) return false;
          }
          return true;
        },


        isRecipeUnlocked(recipe) {
          if (!recipe?.id) return false;
          if (this.state.unlockedRecipes?.[recipe.id] === true) return true;
          const required = recipePrerequisites(recipe);
          if (required.length) {
            return required.every(id => this.state.unlockedRecipes?.[id] === true || safeNumber(this.state.craftedCounts?.[id], 0) > 0);
          }
          if (recipe.unlockedByDefault === true) return true;
          return safeNumber(recipe.tier, 1) <= 1;
        },

        recipeUnlockReason(recipe) {
          const required = recipePrerequisites(recipe);
          if (required.length) {
            const missing = required.filter(id => this.state.unlockedRecipes?.[id] !== true && safeNumber(this.state.craftedCounts?.[id], 0) <= 0);
            if (missing.length) return `Locked. Requires ${missing.map(id => this.recipeById(id)?.name || id).join(', ')}.`;
          }
          return 'Locked recipe.';
        },

        consumeInputs(recipe) {
          for (const input of recipe?.inputs || []) {
            let remaining = Math.max(1, Math.floor(safeNumber(input.quantity, 1)));
            for (let i = (game.inventory || []).length - 1; i >= 0 && remaining > 0; i--) {
              const item = game.inventory[i];
              if (!inventoryMatches(item, input.itemId)) continue;
              const stack = itemStack(item);
              if (game.isMaterialItem?.(item) || stack > 1) {
                const used = Math.min(stack, remaining);
                item.stack = stack - used;
                remaining -= used;
                if (item.stack <= 0) game.inventory.splice(i, 1);
              } else {
                game.inventory.splice(i, 1);
                remaining -= 1;
              }
            }
            if (remaining > 0) return false;
          }
          game.bagDirty = true;
          if (game.bagOpen) game.renderBag?.();
          return true;
        },

        canCraft(recipe, stationRef = this.nearbyStation) {
          if (!recipe) return { ok: false, reason: 'Missing recipe.' };
          if (!stationRef?.station) return { ok: false, reason: 'No station nearby.' };
          if (recipe.stationId && recipe.stationId !== stationRef.station.id) return { ok: false, reason: `Requires ${this.stationById(recipe.stationId)?.name || recipe.stationId}.` };
          if (!this.isRecipeUnlocked(recipe)) return { ok: false, reason: this.recipeUnlockReason(recipe) };
          const skill = this.skillFor(recipe);
          if (skill.level < Math.max(1, Math.floor(safeNumber(recipe.levelRequirement, 1)))) return { ok: false, reason: `Requires ${skill.name} ${recipe.levelRequirement}.` };
          if (!this.hasInputs(recipe)) return { ok: false, reason: 'Missing ingredients.' };
          return { ok: true, reason: 'Ready.' };
        },

        startCraft(recipeId) {
          const recipe = this.recipeById(recipeId);
          const stationRef = this.nearbyStation || this.findNearbyStation();
          const check = this.canCraft(recipe, stationRef);
          if (!check.ok) {
            this.status = check.reason;
            game.log(`Crafting: ${check.reason}`);
            this.refreshPanel();
            this.refreshWindow();
            return false;
          }
          if (game.player?.meditating) game.player.meditating = false;
          this.nearbyStation = stationRef;
          const seconds = Math.max(0.75, safeNumber(recipe.craftTimeSeconds, 4));
          this.active = {
            recipeId: recipe.id,
            recipe: cloneJson(recipe),
            station: cloneJson(stationRef.station),
            stationKey: stationRef.key,
            startedAt: nowMs(),
            timer: seconds,
            total: seconds,
            x: stationRef.x,
            y: stationRef.y
          };
          this.status = `Crafting ${recipe.name || recipe.id}...`;
          game.log(this.status);
          this.toggleWindow(false);
          this.refreshPanel();
          return true;
        },

        cancelCraft(message) {
          this.active = null;
          this.status = message || 'Crafting cancelled.';
          game.log(this.status);
          this.refreshPanel();
        },

        outputName(output, recipe) {
          const draft = game.getEditorItemDraft?.(output.itemId) || game.editorItems?.[output.itemId] || DR.ITEM_BY_ID?.[output.itemId];
          if (output.variant) {
            if (recipe?.outputs?.length === 1) return recipe.name || `${titleCaseFromId(output.variant)} ${draft?.name || titleCaseFromId(output.itemId)}`;
            return `${titleCaseFromId(output.variant)} ${draft?.name || titleCaseFromId(output.itemId)}`;
          }
          return draft?.name || titleCaseFromId(output.itemId);
        },

        grantOutput(output, recipe) {
          const qty = Math.max(1, Math.floor(safeNumber(output.quantity, 1)));
          const draft = game.getEditorItemDraft?.(output.itemId) || null;
          const rarityKey = output.rarityKey || draft?.rarity || 'white';

          if (draft && output.variant && isEquipmentDraft(draft)) {
            let added = 0;
            let lastItem = null;
            for (let i = 0; i < qty; i++) {
              const item = createCraftedEquipment(game, draft, output, recipe);
              if (game.addItem?.(item)) {
                added++;
                lastItem = item;
              }
            }
            return { ok: added > 0, itemId: `${output.itemId}_${normalizeId(output.variant)}`, name: lastItem?.name || this.outputName(output, recipe), quantity: added || qty, rarityKey };
          }

          if (draft && !output.variant) {
            const result = game.grantEditorItem?.(output.itemId, qty, { rarityKey }) || { ok: false };
            return result.ok ? { ok: true, itemId: output.itemId, name: result.name, quantity: result.quantity, rarityKey } : { ok: false, itemId: output.itemId, name: draft.name || output.itemId, quantity: qty, rarityKey };
          }

          const name = this.outputName(output, recipe);
          const id = output.variant ? `${output.itemId}_${normalizeId(output.variant)}` : output.itemId;
          const sourceDraft = draft || {};
          const added = game.addMaterialItem?.({
            id,
            itemId: id,
            name,
            category: output.variant ? 'Crafted' : (sourceDraft.type || 'Crafted'),
            rarityKey,
            value: Math.max(1, Math.floor(safeNumber(sourceDraft.sellValue || sourceDraft.value, 2) * (output.variant ? 2 : 1))),
            stack: qty,
            description: output.variant
              ? `${name} crafted from ${sourceDraft.name || titleCaseFromId(output.itemId)}.`
              : `A crafted ${name}.`
          });
          return { ok: Boolean(added), itemId: id, name, quantity: qty, rarityKey };
        },

        completeCraft() {
          const active = this.active;
          if (!active) return false;
          const recipe = this.recipeById(active.recipeId) || active.recipe;
          this.active = null;

          const stationRef = this.findNearbyStation(3.2);
          if (!stationRef || stationRef.key !== active.stationKey) {
            this.status = 'Crafting failed: station is no longer nearby.';
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          const check = this.canCraft(recipe, stationRef);
          if (!check.ok) {
            this.status = `Crafting failed: ${check.reason}`;
            game.log(this.status);
            this.refreshPanel();
            this.refreshWindow();
            return false;
          }

          if (!this.consumeInputs(recipe)) {
            this.status = 'Crafting failed: missing ingredients.';
            game.log(this.status);
            this.refreshPanel();
            return false;
          }

          const successChance = Math.max(0, Math.min(1, safeNumber(recipe.successChance, 1)));
          const success = Math.random() <= successChance;
          const skill = this.skillFor(recipe);
          const result = {
            at: nowMs(),
            recipeId: recipe.id,
            recipeName: recipe.name || recipe.id,
            stationId: stationRef.station.id,
            stationName: stationRef.station.name || stationRef.station.id,
            profession: recipe.profession || stationRef.station.profession || skill.id,
            success,
            outputs: []
          };

          if (success) {
            for (const output of recipe.outputs || []) {
              const granted = this.grantOutput(output, recipe);
              if (granted.ok) result.outputs.push(granted);
            }
            this.gainCraftXp(skill.id, recipe.xp || 8, true, result);
            game.notifyExternalSystems?.('item-crafted', cloneJson(result));
            game.spawnRing?.(stationRef.x + 0.5, stationRef.y + 0.5, stationRef.station.color || '#f0bd70', 18);
            this.status = `${recipe.name || recipe.id} crafted: ${result.outputs.map(out => `${out.name} x${out.quantity}`).join(', ') || 'no output'}.`;
          } else {
            result.reason = 'Recipe failed its success roll.';
            this.gainCraftXp(skill.id, Math.max(1, Math.floor(safeNumber(recipe.xp, 8) * 0.25)), false, result);
            this.status = `${recipe.name || recipe.id} failed. Ingredients were consumed.`;
          }

          this.state.lastStationKey = stationRef.key;
          this.state.lastRecipeId = recipe.id;
          this.state.lastResult = cloneJson(result);
          this.state.craftedCounts[recipe.id] = Math.max(0, Math.floor(safeNumber(this.state.craftedCounts[recipe.id], 0))) + (success ? 1 : 0);
          if (success) {
            this.state.unlockedRecipes[recipe.id] = true;
            for (const unlockId of recipe.unlocks || []) this.state.unlockedRecipes[unlockId] = true;
          }
          this.saveState();
          if (game.bagOpen) game.renderBag?.();
          game.updateUI?.();
          game.log(this.status);
          this.refreshPanel();
          this.refreshWindow();
          return true;
        },

        gainCraftXp(professionId, amount, success, result) {
          const prof = game.editorProfessions?.[professionId] || DR.PROFESSION_BY_ID?.[professionId] || { id: professionId, name: titleCaseFromId(professionId) };
          if (!this.state.skills[professionId]) this.state.skills[professionId] = defaultSkill(prof);
          const skill = this.state.skills[professionId];
          skill.xp += Math.max(1, Math.floor(safeNumber(amount, 1)));
          if (success) skill.crafts += 1;
          else skill.failures += 1;
          if ((result?.outputs || []).some(out => /rare|blue|purple|gold|orange|red/i.test(out.rarityKey || ''))) skill.rareCrafts += 1;
          let needed = this.nextLevelXp(skill.level);
          while (skill.xp >= needed) {
            skill.xp -= needed;
            skill.level += 1;
            game.log(`${skill.name || prof.name || professionId} level ${skill.level}.`);
            needed = this.nextLevelXp(skill.level);
          }
        },

        nextLevelXp(level) {
          return Math.max(60, Math.floor(100 * Math.pow(Math.max(1, Math.floor(level)), 1.45)));
        },

        update(dt) {
          if (!game.started || !game.player) return;
          if (!this.panel) this.panel = ensurePanel(this);
          if (!this.windowPanel) this.windowPanel = ensureWindow(this);
          if (this.active) {
            this.active.timer -= dt;
            const d = Math.hypot(this.active.x + 0.5 - game.player.x, this.active.y + 0.5 - game.player.y);
            if (d > 3.2 || !game.player.alive || game.player.meditating) {
              this.cancelCraft('Crafting cancelled.');
              return;
            }
            if (this.active.timer <= 0) {
              this.completeCraft();
              return;
            }
          }
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.20;
            this.nearbyStation = this.findNearbyStation();
            this.refreshPanel();
            if (this.open) this.refreshWindow();
          }
        },

        recipeInputText(recipe) {
          return (recipe.inputs || []).map(input => {
            const draft = game.getEditorItemDraft?.(input.itemId) || {};
            const have = this.inventoryCount(input.itemId);
            const need = Math.max(1, Math.floor(safeNumber(input.quantity, 1)));
            return `${draft.name || titleCaseFromId(input.itemId)} ${have}/${need}`;
          }).join(' · ') || 'No inputs';
        },

        recipeOutputText(recipe) {
          return (recipe.outputs || []).map(output => `${this.outputName(output, recipe)} x${Math.max(1, Math.floor(safeNumber(output.quantity, 1)))}`).join(' · ') || 'No outputs';
        },

        // V0.18.70 (Roadmap Item 3 E): resolve the recipe's primary output item so the panel can
        // show what it makes (stats or consumable effect) and group recipes by kind.
        recipeOutputDraft(recipe) {
          const outId = recipe?.outputs?.[0]?.itemId;
          if (!outId) return null;
          return game.getCompiledItem?.(outId) || game.getEditorItemDraft?.(outId) || DR.ITEM_BY_ID?.[outId] || null;
        },

        recipeCategory(recipe) {
          const it = this.recipeOutputDraft(recipe);
          if (!it) return 'Other';
          if (it.type === 'armor' || (safeNumber(it.armor, 0) > 0 && it.slot && it.slot !== 'none')) return 'Armor';
          if (it.type === 'weapon') return 'Weapons';
          const ue = it.useEffect || {};
          const ec = it.effectCategory || ue.buff?.effectCategory || '';
          if (ec === 'potion_heal') return 'Health Potions';
          if (ec === 'potion_mana') return 'Mana Potions';
          if (ec === 'potion_buff') return 'Buff Potions';
          if (it.type === 'consumable' || it.kind === 'consumable') {
            const name = String(it.name || '').toLowerCase();
            if (/fish|minnow|eel|carp|catfish|trout|perch|roe/.test(name)) return 'Cooked Fish';
            if (/meat|roast|steak|jerky|skewer|haunch|rib|sausage/.test(name)) return 'Cooked Meat';
            return 'Meals';
          }
          return 'Materials';
        },

        recipeEffectText(recipe) {
          const it = this.recipeOutputDraft(recipe);
          if (!it) return '';
          const parts = [];
          if (it.type === 'armor' || (safeNumber(it.armor, 0) > 0 && it.slot && it.slot !== 'none')) {
            if (safeNumber(it.armor, 0) > 0) parts.push(`Armor +${Math.round(it.armor)}`);
            for (const [stat, v] of Object.entries(it.stats || {})) {
              if (safeNumber(v, 0)) parts.push(`+${v} ${stat}`);
            }
            return parts.join(' · ');
          }
          const ue = it.useEffect || {};
          if (safeNumber(ue.hp ?? ue.heal, 0) > 0) parts.push(`Restores ${Math.round(safeNumber(ue.hp ?? ue.heal, 0))} HP`);
          if (safeNumber(ue.mana ?? ue.restoreMana, 0) > 0) parts.push(`Restores ${Math.round(safeNumber(ue.mana ?? ue.restoreMana, 0))} MP`);
          if (ue.buff && typeof ue.buff === 'object') {
            let s = `Buff: ${ue.buff.name || 'effect'}`;
            const dur = safeNumber(ue.buff.duration, 0);
            if (dur) s += ` (${dur}s)`;
            parts.push(s);
          }
          const cd = safeNumber(it.cooldownMs, 0);
          if (cd > 0) parts.push(`Cooldown ${Math.round(cd / 1000)}s`);
          return parts.join(' · ');
        },

        refreshWindow() {
          if (!this.windowPanel) return;
          const stationLine = this.windowPanel.querySelector('[data-crafting-window-station]');
          const body = this.windowPanel.querySelector('[data-crafting-window-body]');
          if (!stationLine || !body) return;
          const stationRef = this.nearbyStation || this.findNearbyStation();
          if (!stationRef) {
            stationLine.textContent = 'No station nearby.';
            body.innerHTML = '<div class="crEmpty">Stand near a Campfire, Forge, Loom, or other crafting station and press C.</div>';
            return;
          }
          stationLine.textContent = `${stationRef.station.name || stationRef.station.id} · ${stationRef.station.profession || 'crafting'} · ${zoneKey(game)}`;
          const recipes = this.stationRecipes(stationRef.station);
          if (!recipes.length) {
            body.innerHTML = '<div class="crEmpty">No recipes assigned to this station.</div>';
            return;
          }
          // V0.18.70 (Roadmap Item 3 E): group recipes by kind (Armor / Cooked Fish / Meals /
          // Health/Mana/Buff Potions / ...) with headers, and show each result's stats or
          // consumable effect (heal/mana/buff/cooldown) so the panel says what you're making.
          const CATEGORY_ORDER = ['Armor', 'Weapons', 'Cooked Meat', 'Cooked Fish', 'Meals', 'Health Potions', 'Mana Potions', 'Buff Potions', 'Materials', 'Other'];
          const groups = new Map();
          for (const recipe of recipes) {
            const cat = this.recipeCategory(recipe);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(recipe);
          }
          const cats = [...groups.keys()].sort((a, b) => {
            const ia = CATEGORY_ORDER.indexOf(a); const ib = CATEGORY_ORDER.indexOf(b);
            return ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)) || a.localeCompare(b);
          });
          // V0.18.73: cleaner card layout - an item icon, the result name + effect, colour-coded
          // material chips (green when you have enough, red when short), and a clear Craft button.
          const iconHtml = it => {
            const ic = (it && it.icon) || {};
            const glyph = ic.glyph ? escapeHtml(String(ic.glyph)) : '▪';
            const color = /^#[0-9a-f]{3,8}$/i.test(String(ic.color || '')) ? ic.color : '#8a7a58';
            return `<div class="crIcon" style="background:${color};color:#1c1508;">${glyph}</div>`;
          };
          const matChips = recipe => ((recipe.inputs || []).map(input => {
            const draft = game.getEditorItemDraft?.(input.itemId) || game.getCompiledItem?.(input.itemId) || {};
            const need = Math.max(1, Math.floor(safeNumber(input.quantity, 1)));
            const have = this.inventoryCount(input.itemId);
            return `<span class="crMat ${have >= need ? 'ok' : 'miss'}">${escapeHtml(draft.name || titleCaseFromId(input.itemId))} ${have}/${need}</span>`;
          }).join('')) || `<span class="crMat">No materials</span>`;
          const renderRecipe = recipe => {
            const check = this.canCraft(recipe, stationRef);
            const skill = this.skillFor(recipe);
            const unlocked = this.isRecipeUnlocked(recipe);
            const disabled = check.ok && !this.active ? '' : 'disabled';
            const lockText = unlocked ? ' · locked' : '';
            const effect = this.recipeEffectText(recipe);
            const reason = check.ok ? '' : `${escapeHtml(check.reason)} · `;
            return `
              <div class="crCard">
                ${iconHtml(this.recipeOutputDraft(recipe))}
                <div class="crMain">
                  <div class="crName">${escapeHtml(recipe.name || recipe.id)}</div>
                  ${effect ? `<div class="crEffect">${escapeHtml(effect)}</div>` : ''}
                  <div class="crMats">${matChips(recipe)}</div>
                  <div class="crFoot">
                    <span class="crMeta ${check.ok ? '' : 'bad'}">${reason}${escapeHtml(skill.name || recipe.profession)} ${skill.level} · ${safeNumber(recipe.craftTimeSeconds, 4)}s${lockText}</span>
                    <button type="button" class="crBtn" data-craft-recipe="${escapeHtml(recipe.id)}" ${disabled}>Craft</button>
                  </div>
                </div>
              </div>
            `;
          };
          // V0.18.72: category TAB buttons. Click a category to see only its recipes. An "All"
          // tab keeps the full grouped list. The selected tab persists across re-renders/crafts.
          const tabs = ['All', ...cats];
          if (!tabs.includes(this.selectedCraftCategory)) this.selectedCraftCategory = cats[0] || 'All';
          const active = this.selectedCraftCategory;
          const tabBar = `<div class="crTabs">` + tabs.map(cat => {
            const count = cat === 'All' ? recipes.length : (groups.get(cat) || []).length;
            return `<button type="button" class="crTab${cat === active ? ' on' : ''}" data-craft-cat="${escapeHtml(cat)}">${escapeHtml(cat)}<span class="crN">${count}</span></button>`;
          }).join('') + `</div>`;
          const shown = active === 'All' ? cats : (groups.has(active) ? [active] : cats);
          const list = shown.map(cat => {
            const header = active === 'All' ? `<div class="crGroup">${escapeHtml(cat)}</div>` : '';
            return header + (groups.get(cat) || []).map(renderRecipe).join('');
          }).join('');
          body.innerHTML = tabBar + (list || `<div class="crEmpty">No recipes in this category.</div>`);
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-crafting-status]');
          const progress = this.panel.querySelector('[data-crafting-progress]');
          const meta = this.panel.querySelector('[data-crafting-meta]');
          if (!status || !progress || !meta) return;
          if (this.active) {
            const pct = Math.max(0, Math.min(100, (1 - this.active.timer / this.active.total) * 100));
            status.textContent = `${this.status} ${Math.ceil(this.active.timer)}s`;
            progress.style.width = `${pct}%`;
          } else if (this.nearbyStation) {
            status.textContent = `${this.nearbyStation.station.name || this.nearbyStation.station.id} nearby · C to craft`;
            progress.style.width = `${Math.max(8, Math.min(100, (1 - this.nearbyStation.distance / 2.65) * 100))}%`;
          } else {
            status.textContent = this.status || 'No crafting station nearby.';
            progress.style.width = '0%';
          }
          const cooking = this.state.skills.cooking || defaultSkill({ id: 'cooking', name: 'Cooking' });
          const smith = this.state.skills.blacksmithing || defaultSkill({ id: 'blacksmithing', name: 'Blacksmithing' });
          const tailoring = this.state.skills.tailoring || defaultSkill({ id: 'tailoring', name: 'Tailoring' });
          meta.textContent = `Cooking ${cooking.level} (${cooking.xp}/${this.nextLevelXp(cooking.level)}) · Smithing ${smith.level} (${smith.xp}/${this.nextLevelXp(smith.level)}) · Tailoring ${tailoring.level} (${tailoring.xp}/${this.nextLevelXp(tailoring.level)})`;
        },

        render(context) {
          if (!game.started || !game.player) return;
          const objects = this.currentObjectGrid();
          if (!Array.isArray(objects)) return;
          const px = game.player.x;
          const py = game.player.y;
          context.save();
          context.font = '9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (let y = Math.max(0, Math.floor(py - 32)); y <= Math.min((DR.CONFIG?.MAP_SIZE || 200) - 1, Math.ceil(py + 32)); y++) {
            for (let x = Math.max(0, Math.floor(px - 32)); x <= Math.min((DR.CONFIG?.MAP_SIZE || 200) - 1, Math.ceil(px + 32)); x++) {
              const obj = objects[y]?.[x];
              const station = stationForObject(game, obj);
              if (!station) continue;
              const tile = game.map?.[y]?.[x];
              if (!tile) continue;
              // V0.14.27: remove floating crafting-station marker circles.
              // The station prop art itself is the visual target; interaction logic remains unchanged.
            }
          }
          // V0.14.27: active crafting progress is shown in the UI panel, not as a floating world circle.
          context.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
