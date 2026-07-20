// Dream Realms runtime resource gathering system
// V0.11.9: profession-loop resource nodes with tool checks, skill gates, XP curves, depletion, and respawns.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.resource-runtime.v2';
  const LEGACY_STORAGE_KEY = 'dream-realms.resource-runtime.v1';

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const normalizeId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const nowMs = () => Date.now();

  const SKILL_NAMES = ['Gathering', 'Mining', 'Fishing'];
  const TOOL_ALIASES = {
    pickaxe: ['item_crude_pickaxe', 'item_mine_relic_pick'],
    fishing_rod: ['item_worn_fishing_rod', 'item_basic_fishing_rod'],
    herbalist_knife: ['item_herbalist_knife'],
    sickle: ['item_herbalist_knife']
  };

  function defaultSkill(name) {
    return { name, level: 1, xp: 0, totalXp: 0, harvests: 0, failures: 0, rareFinds: 0 };
  }

  function defaultState() {
    return {
      version: 2,
      depletedNodes: {},
      skills: Object.fromEntries(SKILL_NAMES.map(name => [name, defaultSkill(name)])),
      discovered: {},
      lastNodeKey: null,
      lastResult: null
    };
  }

  // Phase 19 (Profession EXP Tables): the Dark Woods tier-1 profession curve.
  // These are the exact per-level "EXP required for next level" values from the
  // master plan (index 0 = level 1 -> 2). Their cumulative totals match the plan's
  // "Total EXP Required" column exactly (250/475/800/1275/1950/2900/4200/5950 to
  // reach levels 3..10). The plan's Gathering and Fishing tables are identical, so
  // one shared table preserves the pre-existing single-curve design and is reused
  // by fishing-system.js via DR.Professions. Level 10 is the Dark Woods tier
  // ceiling; beyond the table we continue at the final step (finite, so displays
  // and future higher-tier content keep working) rather than a brittle hard cap.
  const PROFESSION_XP_TABLE = [100, 150, 225, 325, 475, 675, 950, 1300, 1750];
  const PROFESSION_TIER_MAX_LEVEL = 10;
  function nextLevelXpFor(level) {
    const lvl = Math.max(1, Math.floor(safeNumber(level, 1)));
    const idx = Math.min(lvl, PROFESSION_XP_TABLE.length) - 1;
    return PROFESSION_XP_TABLE[idx];
  }

  // First-time discovery bonus by resource level tier (master plan): L1-2 +15,
  // L4-5 +30 (covers L3 too), L6-7 +50, L8+ +75. Shared with fishing-system.js.
  function firstDiscoveryBonusForLevel(level) {
    const req = Math.max(1, Math.floor(safeNumber(level, 1)));
    if (req >= 8) return 75;
    if (req >= 6) return 50;
    if (req >= 3) return 30;
    return 15;
  }

  // Single shared owner for the profession EXP curve + discovery bonus, so the
  // separate fishing system reuses the exact same math instead of duplicating it.
  DR.Professions = Object.freeze({
    XP_TABLE: PROFESSION_XP_TABLE.slice(),
    maxLevel: PROFESSION_TIER_MAX_LEVEL,
    nextLevelXp: nextLevelXpFor,
    firstDiscoveryBonusForLevel
  });

  function normalizeSkill(name, raw) {
    const base = defaultSkill(name);
    if (!raw || typeof raw !== 'object') return base;
    base.level = Math.max(1, Math.floor(safeNumber(raw.level, 1)));
    base.xp = Math.max(0, Math.floor(safeNumber(raw.xp, 0)));
    base.totalXp = Math.max(base.xp, Math.floor(safeNumber(raw.totalXp, raw.xp || 0)));
    base.harvests = Math.max(0, Math.floor(safeNumber(raw.harvests, 0)));
    base.failures = Math.max(0, Math.floor(safeNumber(raw.failures, 0)));
    base.rareFinds = Math.max(0, Math.floor(safeNumber(raw.rareFinds, 0)));
    return base;
  }

  function normalizeState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;
    state.depletedNodes = raw.depletedNodes && typeof raw.depletedNodes === 'object' ? raw.depletedNodes : {};
    state.discovered = raw.discovered && typeof raw.discovered === 'object' ? raw.discovered : {};
    const rawSkills = raw.skills && typeof raw.skills === 'object' ? raw.skills : {};
    for (const name of SKILL_NAMES) state.skills[name] = normalizeSkill(name, rawSkills[name]);
    state.lastNodeKey = raw.lastNodeKey || null;
    state.lastResult = raw.lastResult && typeof raw.lastResult === 'object' ? raw.lastResult : null;
    return state;
  }

  function readLocalState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY) || window.localStorage?.getItem(LEGACY_STORAGE_KEY);
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
    // Phase 21: dungeons get their own floor-specific resource grid so the
    // gathering system (which already runs in every zone) resolves the right
    // nodes inside Silk Web Cavern instead of the overworld dark_woods grid.
    // Any dungeon returns a dungeon-specific key, so overworld nodes never leak
    // into a dungeon; only Silk Web floors are actually seeded (see
    // Game.prototype.ensureSilkWebCavernHerbs). The floor is part of the key so
    // per-floor nodes/depletion don't collide.
    if (game.currentZone === 'dungeon') {
      const id = game.activeDungeon?.id || game.dungeonSystem?.state?.active?.dungeonId || 'dungeon';
      const floor = Math.max(1, Math.floor(safeNumber(game.activeDungeon?.floor ?? game.dungeonSystem?.state?.active?.floor, 1)));
      return `${id}:F${floor}`;
    }
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function nodeKey(game, node) {
    return `${zoneKey(game)}:${Math.floor(safeNumber(node?.x, 0))},${Math.floor(safeNumber(node?.y, 0))}:${node?.type || node?.id || 'resource'}`;
  }

  function resourceDef(game, node) {
    return game.editorResourceTypes?.[node?.type || node?.id]
      || DR.RESOURCE_BY_ID?.[node?.type || node?.id]
      || node
      || null;
  }

  function resourceCategory(game, node) {
    const def = resourceDef(game, node);
    return String(node?.category || def?.category || 'resource').toLowerCase();
  }

  function defaultResourceNode(type, x, y, zoneId, extra = {}) {
    const def = DR.RESOURCE_BY_ID?.[type] || {};
    return Object.assign({
      id: `${type}_${zoneId}_${x}_${y}`,
      type,
      name: def.name || type,
      category: def.category || 'resource',
      profession: def.profession || null,
      skill: def.skill || null,
      tool: def.tool || null,
      levelRequired: def.levelRequired || 1,
      gatherTimeSeconds: def.gatherTimeSeconds || null,
      xpReward: def.xpReward || null,
      color: def.color || '#89d66f',
      label: def.label || 'R',
      x,
      y,
      zoneId,
      respawnSeconds: def.respawnSeconds || 180,
      drops: cloneJson(def.drops || []),
      rareDrops: cloneJson(def.rareDrops || []),
      lootTableId: def.lootTableId || null,
      note: def.note || 'Default seeded profession resource node.'
    }, extra);
  }

  function isGatherableResource(game, node) {
    const category = resourceCategory(game, node);
    return node && category !== 'chest';
  }

  function shadeColor(hex, amount = 0) {
    const raw = String(hex || '#89d66f').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0').slice(0, 6);
    const n = Number.parseInt(full, 16);
    if (!Number.isFinite(n)) return hex || '#89d66f';
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }

  function fillLeaf(ctx, x, y, w, h, rot, fill, stroke, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.55);
    ctx.bezierCurveTo(w * 0.65, -h * 0.24, w * 0.65, h * 0.33, 0, h * 0.55);
    ctx.bezierCurveTo(-w * 0.65, h * 0.33, -w * 0.65, -h * 0.24, 0, -h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shadeColor(fill, -35);
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.42);
    ctx.lineTo(0, h * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  function drawHerbResourceNode(ctx, s, def = {}, node = {}, state = {}) {
    const color = def.color || node.color || '#75d069';
    const depleted = Boolean(state.depleted);
    const locked = Boolean(state.locked);
    const alpha = depleted ? 0.36 : locked ? 0.58 : 0.96;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(s.x + 1, s.y + 9, 18, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const base = depleted ? '#6b6b59' : color;
    const dark = shadeColor(base, -45);
    const light = shadeColor(base, 24);
    const seed = Math.abs(Math.floor((Number(node.x) || 0) * 17 + (Number(node.y) || 0) * 31));
    for (let i = 0; i < 7; i++) {
      const t = (i - 3) / 3;
      const x = s.x + t * 9 + ((seed + i) % 3 - 1) * 0.8;
      const h = 13 + ((seed + i * 7) % 5);
      ctx.strokeStyle = i % 2 ? dark : shadeColor(base, -25);
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 7);
      ctx.quadraticCurveTo(s.x + t * 5, s.y - h * 0.35, x, s.y - h);
      ctx.stroke();
      fillLeaf(ctx, x + t * 2, s.y - h + 3, 5.4, 11, t * 0.62, i % 2 ? light : base, dark, 0.96);
    }
    // Mooncap/silkcap style nodes keep their mushroom identity while replacing the old flat marker circle.
    if (/mooncap|cap|mushroom|fung/i.test(`${def.id || node.type || ''} ${def.name || node.name || ''}`)) {
      const cap = depleted ? '#8b8088' : (def.color || '#b894ff');
      for (let i = 0; i < 3; i++) {
        const x = s.x - 7 + i * 7;
        const h = 10 + i * 2;
        ctx.fillStyle = '#d8d0bd';
        ctx.fillRect(x - 1.3, s.y + 4 - h, 2.6, h);
        ctx.fillStyle = i === 1 ? shadeColor(cap, 20) : cap;
        ctx.beginPath();
        ctx.ellipse(x, s.y + 3 - h, 6, 3.4, 0, Math.PI, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawMiningResourceNode(ctx, s, def = {}, node = {}, state = {}) {
    const color = state.depleted ? '#6b6259' : (def.color || node.color || '#b8a078');
    ctx.save();
    ctx.globalAlpha = state.depleted ? 0.38 : state.locked ? 0.58 : 0.92;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(s.x + 1, s.y + 10, 21, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(color, -55);
    ctx.lineWidth = 1.4;
    const rocks = [
      [s.x - 12, s.y + 5, 9, 10], [s.x - 2, s.y + 2, 13, 14], [s.x + 11, s.y + 7, 8, 9]
    ];
    for (const [x, y, w, h] of rocks) {
      ctx.fillStyle = shadeColor(color, (x < s.x ? -18 : 6));
      ctx.beginPath();
      ctx.moveTo(x - w, y + h * 0.2);
      ctx.lineTo(x - w * 0.25, y - h);
      ctx.lineTo(x + w * 0.85, y - h * 0.55);
      ctx.lineTo(x + w, y + h * 0.38);
      ctx.lineTo(x, y + h * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = shadeColor(color, 44);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(s.x - 5, s.y - 6);
    ctx.lineTo(s.x + 5, s.y + 1);
    ctx.moveTo(s.x + 1, s.y - 10);
    ctx.lineTo(s.x + 10, s.y - 4);
    ctx.stroke();
    ctx.restore();
  }

  function drawResourceNodeProp(ctx, s, def = {}, node = {}, state = {}) {
    const category = String(node.category || def.category || '').toLowerCase();
    if (category === 'mining' || /^ore_/.test(String(node.type || node.id || ''))) return drawMiningResourceNode(ctx, s, def, node, state);
    return drawHerbResourceNode(ctx, s, def, node, state);
  }

  function skillForResource(game, node) {
    const def = resourceDef(game, node);
    const category = resourceCategory(game, node);
    const explicit = String(node?.skill || def?.skill || '').trim();
    if (explicit) return explicit;
    if (category === 'mining') return 'Mining';
    if (category === 'fishing') return 'Fishing';
    return 'Gathering';
  }

  function requiredLevel(game, node) {
    const def = resourceDef(game, node);
    return Math.max(1, Math.floor(safeNumber(node?.levelRequired ?? node?.requiredLevel ?? def?.levelRequired ?? def?.requiredLevel, 1)));
  }

  function tableForResource(game, node) {
    const def = resourceDef(game, node);
    const category = resourceCategory(game, node);
    if (node?.lootTableId) return node.lootTableId;
    if (def?.lootTableId) return def.lootTableId;
    // Phase 20: a node that authors its own drops and has no explicit loot table
    // should yield exactly those drops (via resolveDirectDrops), not the generic
    // per-category fallback table (which just drops gloomleaf/copper regardless
    // of the node). This is what makes the zone-exclusive herbs yield their own
    // item, and it also corrects existing nodes whose declared drops differed
    // from the generic fallback (e.g. a Mooncap or Darkstone node no longer
    // mis-yields gloomleaf/copper).
    const hasDirectDrops = (Array.isArray(node?.drops) && node.drops.length > 0) || (Array.isArray(def?.drops) && def.drops.length > 0);
    if (hasDirectDrops) return null;
    if (category === 'mining') return 'loot_mining_copper';
    if (category === 'fishing') return 'loot_fishing_blackwater';
    if (category === 'herb') return 'loot_gathering_herbs';
    return null;
  }

  function harvestSeconds(game, node) {
    const def = resourceDef(game, node);
    const explicit = safeNumber(node?.gatherTimeSeconds ?? node?.gatherTime ?? def?.gatherTimeSeconds ?? def?.gatherTime, NaN);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const category = resourceCategory(game, node);
    if (category === 'mining') return 2.35;
    if (category === 'fishing') return 2.75;
    if (category === 'herb') return 1.25;
    return 1.7;
  }

  function xpForResource(game, node, result) {
    const def = resourceDef(game, node);
    const explicit = safeNumber(node?.xpReward ?? def?.xpReward, NaN);
    const category = resourceCategory(game, node);
    const base = Number.isFinite(explicit) && explicit > 0 ? explicit : (category === 'mining' ? 14 : category === 'fishing' ? 12 : category === 'herb' ? 8 : 9);
    const itemCount = Array.isArray(result?.items) ? result.items.reduce((sum, item) => sum + Math.max(1, Math.floor(safeNumber(item.quantity, 1))), 0) : 1;
    return Math.floor(base + Math.min(12, itemCount * 2));
  }

  // Phase 19: first-time discovery bonus for a node. An explicit firstDiscoveryXp
  // on the node/def wins; otherwise it is derived from the node's required level
  // tier (master plan). Callers gate this to the first successful harvest of each
  // resource id via state.discovered.
  function firstDiscoveryBonus(game, node) {
    const def = resourceDef(game, node);
    const explicit = safeNumber(node?.firstDiscoveryXp ?? def?.firstDiscoveryXp, NaN);
    if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
    return firstDiscoveryBonusForLevel(requiredLevel(game, node));
  }

  // Phase 19: rare-node bonus EXP, data-driven via a rareNodeXpBonus field on the
  // node/def (e.g. Blackroot Herb +20, Queen's Silkroot +30 when Phases 20-21 add
  // them). Zero for ordinary nodes.
  function rareNodeXpBonus(game, node) {
    const def = resourceDef(game, node);
    return Math.max(0, Math.floor(safeNumber(node?.rareNodeXpBonus ?? def?.rareNodeXpBonus, 0)));
  }

  function hasInventoryItem(game, ids, nameMatcher = null) {
    const inv = Array.isArray(game.inventory) ? game.inventory : [];
    const idSet = new Set(ids.map(id => String(id).toLowerCase()));
    return inv.some(item => {
      const id = String(item.itemId || item.sourceItemId || item.id || '').toLowerCase();
      const name = String(item.name || item.baseName || '').toLowerCase();
      return idSet.has(id) || (nameMatcher && nameMatcher(name));
    });
  }

  function hasToolForResource(game, node) {
    const def = resourceDef(game, node);
    const required = String(node?.tool || def?.tool || '').toLowerCase();
    if (!required || required === 'hands' || required === 'none' || required.includes('hands')) return true;
    if (required.includes('pickaxe')) return hasInventoryItem(game, TOOL_ALIASES.pickaxe, name => name.includes('pickaxe') || name.includes('relic pick'));
    if (required.includes('fishing rod')) return hasInventoryItem(game, TOOL_ALIASES.fishing_rod, name => name.includes('fishing rod'));
    if (required.includes('herbalist knife') || required.includes('sickle')) return hasInventoryItem(game, TOOL_ALIASES.herbalist_knife, name => name.includes('herbalist knife') || name.includes('sickle'));
    return hasInventoryItem(game, [], name => name.includes(required));
  }

  function toolNameForResource(game, node) {
    const def = resourceDef(game, node);
    return node?.tool || def?.tool || 'proper tool';
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('resourceGatheringPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'resourceGatheringPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Resources</h3>
      <div class="small" data-resource-status>Press G near placed resource nodes.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-resource-progress style="background:linear-gradient(90deg,#3d6b42,#89d66f)"></div></div>
      <div class="small" data-resource-meta>Gathering 1 · Mining 1 · Fishing 1</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  function ensureHarvestBar() {
    let bar = document.getElementById('resourceHarvestCastBar');
    if (bar) return bar;
    bar = document.createElement('section');
    bar.id = 'resourceHarvestCastBar';
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = `
      <div class="harvestCastFrame">
        <div class="harvestCastHeader"><span data-harvest-title>Gathering</span><span data-harvest-time>0.0s</span></div>
        <div class="harvestCastMeter"><div data-harvest-fill></div></div>
        <div class="harvestCastHint" data-harvest-hint>Do not move or take damage.</div>
      </div>`;
    Object.assign(bar.style, {
      position: 'fixed',
      left: '50%',
      bottom: '118px',
      transform: 'translateX(-50%)',
      width: 'min(420px, calc(100vw - 36px))',
      zIndex: '90',
      pointerEvents: 'none',
      display: 'none'
    });
    const frame = bar.querySelector('.harvestCastFrame');
    Object.assign(frame.style, {
      border: '1px solid rgba(228,214,142,0.62)',
      borderRadius: '12px',
      padding: '10px 12px 11px',
      background: 'linear-gradient(180deg, rgba(9,20,15,0.96), rgba(2,8,6,0.94))',
      boxShadow: '0 14px 28px rgba(0,0,0,0.48), inset 0 0 22px rgba(143,255,197,0.06)',
      color: '#f2e7b2',
      fontFamily: 'Georgia, serif'
    });
    const header = bar.querySelector('.harvestCastHeader');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'center',
      fontSize: '13px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: '7px'
    });
    const meter = bar.querySelector('.harvestCastMeter');
    Object.assign(meter.style, {
      height: '16px',
      borderRadius: '999px',
      overflow: 'hidden',
      background: 'rgba(0,0,0,0.58)',
      border: '1px solid rgba(255,238,167,0.28)',
      boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.55)'
    });
    const fill = bar.querySelector('[data-harvest-fill]');
    Object.assign(fill.style, {
      height: '100%',
      width: '0%',
      borderRadius: '999px',
      background: 'linear-gradient(90deg, #3f8659, #89e88a, #e5f8a7)',
      boxShadow: '0 0 12px rgba(143,255,164,0.42)',
      transition: 'width 80ms linear'
    });
    const hint = bar.querySelector('.harvestCastHint');
    Object.assign(hint.style, {
      marginTop: '6px',
      fontSize: '11px',
      color: '#c9d7ba',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      opacity: '0.88'
    });
    document.body.appendChild(bar);
    return bar;
  }

  function resolveDropItemId(game, drop) {
    const raw = drop?.itemId || drop?.item || drop?.id || drop?.name;
    if (!raw) return null;
    if (game.editorItems?.[raw] || DR.ITEM_BY_ID?.[raw]) return raw;
    const clean = normalizeId(raw);
    const byClean = Object.values(game.editorItems || DR.ITEM_BY_ID || {}).find(item => normalizeId(item?.name || item?.id) === clean || normalizeId(item?.id) === clean);
    return byClean?.id || null;
  }

  registerDreamRealmsSystem({
    id: 'runtimeResources',
    name: 'Runtime Resource Gathering',

    install(game) {
      const runtime = {
        id: 'runtimeResources',
        name: 'Runtime Resource Gathering',
        game,
        state: normalizeState(game.pendingResourceRuntimeState || readLocalState()),
        panel: ensurePanel(),
        harvestBar: ensureHarvestBar(),
        nearbyNode: null,
        active: null,
        completionToast: null,
        statusTick: 0,
        status: 'Press G near placed resource nodes.',

        init() {
          game.resourceGatheringSystem = this;
          game.resourceRuntimeState = this.state;
          this.bindInput();
          this.ensureDefaultResourceNodes();
          this.refreshPanel();
        },

        bindInput() {
          if (this.inputBound) return;
          this.inputBound = true;
          window.addEventListener('keydown', event => {
            if (isTypingTarget(event) || event.repeat) return;
            if (!(game.isActionKey ? game.isActionKey(event, 'gather') : String(event.key || '').toLowerCase() === 'g')) return;
            if (!game.started || game.paused || !game.player || !game.player.alive) return;
            event.preventDefault();
            if (this.active) this.cancelHarvest('Gathering cancelled.');
            else this.startNearestHarvest();
          });
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(raw) {
          this.state = normalizeState(raw || defaultState());
          game.resourceRuntimeState = this.state;
          this.active = null;
          this.refreshPanel();
        },

        saveState() {
          game.resourceRuntimeState = this.state;
          writeLocalState(this.state);
        },

        currentResourceGrid() {
          const key = zoneKey(game);
          if (!game.editorResources) game.editorResources = { dark_woods: {}, mossfang_cave: {} };
          if (!game.editorResources.dark_woods) game.editorResources.dark_woods = {};
          if (!game.editorResources.mossfang_cave) game.editorResources.mossfang_cave = {};
          if (!game.editorResources[key]) game.editorResources[key] = {};
          return game.editorResources[key];
        },

        ensureDefaultResourceNodes() {
          if (!game.editorResources) game.editorResources = { dark_woods: {}, mossfang_cave: {} };
          const placements = [
            defaultResourceNode('herb_gloomleaf', 91, 116, 'dark_woods'),
            defaultResourceNode('herb_bitterleaf', 96, 119, 'dark_woods'),
            defaultResourceNode('herb_gloomleaf', 118, 103, 'dark_woods'),
            defaultResourceNode('herb_mooncap', 130, 76, 'dark_woods'),
            defaultResourceNode('ore_copper', 139, 86, 'dark_woods')
          ];
          let added = 0;
          for (const node of placements) {
            if (!game.editorResources[node.zoneId]) game.editorResources[node.zoneId] = {};
            const grid = game.editorResources[node.zoneId];
            const key = `${Math.floor(node.x)},${Math.floor(node.y)}`;
            if (!grid[key]) {
              grid[key] = node;
              added++;
            }
          }
          const pruned = this.removeLegacyRuntimeResourceSeeds();
          if (added || pruned) game.worldSaveDirty = true;
          return added;
        },


        removeLegacyRuntimeResourceSeeds() {
          let pruned = 0;
          const resources = game.editorResources || {};
          for (const [zoneId, grid] of Object.entries(resources)) {
            if (!grid || typeof grid !== 'object') continue;
            for (const [key, node] of Object.entries(grid)) {
              const type = String(node?.type || node?.resourceId || node?.id || '').toLowerCase();
              const category = String(node?.category || '').toLowerCase();
              const generatedCaveSeed = zoneId !== 'dark_woods' && node?.note === 'Default seeded profession resource node.';
              const retiredFishingNode = category === 'fishing' || type.startsWith('fish_') || String(node?.lootTableId || '').includes('fishing');
              if (!generatedCaveSeed && !retiredFishingNode) continue;
              delete grid[key];
              pruned++;
            }
          }
          return pruned;
        },

        allResourceNodes() {
          return Object.values(this.currentResourceGrid()).filter(node => isGatherableResource(game, node));
        },

        skill(name) {
          const key = SKILL_NAMES.includes(name) ? name : 'Gathering';
          if (!this.state.skills[key]) this.state.skills[key] = defaultSkill(key);
          return this.state.skills[key];
        },

        distanceToNode(node) {
          if (!game.player || !node) return Infinity;
          const x = safeNumber(node.x, NaN);
          const y = safeNumber(node.y, NaN);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
          return Math.hypot((x + 0.5) - game.player.x, (y + 0.5) - game.player.y);
        },

        remainingSeconds(node) {
          const record = this.state.depletedNodes[nodeKey(game, node)];
          if (!record) return 0;
          return Math.max(0, Math.ceil((safeNumber(record.respawnAt, 0) - nowMs()) / 1000));
        },

        isAvailable(node) {
          return this.remainingSeconds(node) <= 0;
        },

        findNearbyResource(range = 2.05) {
          let best = null;
          let bestD = range;
          for (const node of this.allResourceNodes()) {
            const d = this.distanceToNode(node);
            if (d < bestD) {
              best = node;
              bestD = d;
            }
          }
          return best;
        },

        findResourceAt(tileX, tileY, radius = 0) {
          const tx = Math.floor(safeNumber(tileX, NaN));
          const ty = Math.floor(safeNumber(tileY, NaN));
          if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
          let best = null;
          let bestD = Infinity;
          for (const node of this.allResourceNodes()) {
            const nx = Math.floor(safeNumber(node.x, NaN));
            const ny = Math.floor(safeNumber(node.y, NaN));
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
            const d = Math.hypot(nx - tx, ny - ty);
            if (d <= radius && d < bestD) { best = node; bestD = d; }
          }
          return best;
        },

        startNearestHarvest() {
          const node = this.findNearbyResource();
          if (!node) {
            this.status = 'No placed resource node nearby.';
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          return this.startHarvestNode(node);
        },

        startHarvestAtWorld(tileX, tileY, preferredNode = null) {
          const tx = Math.floor(safeNumber(tileX, NaN));
          const ty = Math.floor(safeNumber(tileY, NaN));
          const node = preferredNode || this.findResourceAt(tx, ty, 2);
          if (!node) {
            this.status = 'No valid resource selected.';
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          return this.startHarvestNode(node);
        },

        startHarvestNode(node) {
          if (!node) {
            this.status = 'No resource selected.';
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          if (this.distanceToNode(node) > 2.95) {
            this.status = 'Move closer to that resource.';
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          if (!this.isAvailable(node)) {
            const remaining = this.remainingSeconds(node);
            this.status = `${node.name || resourceDef(game, node)?.name || 'Resource'} respawns in ${remaining}s.`;
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          const skillName = skillForResource(game, node);
          const skill = this.skill(skillName);
          const req = requiredLevel(game, node);
          if (skill.level < req) {
            this.status = `${node.name || resourceDef(game, node)?.name || 'Resource'}: Requires ${skillName} Level ${req}.`;
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          if (!hasToolForResource(game, node)) {
            const tool = toolNameForResource(game, node);
            this.status = `${node.name || resourceDef(game, node)?.name || 'Resource'} requires ${tool}.`;
            game.log(this.status);
            this.refreshPanel();
            return false;
          }
          if (game.player?.meditating) game.player.meditating = false;
          game.cancelPlayerEmote?.('action');
          game.fishingSystem?.cancelForMovement?.();
          const def = resourceDef(game, node);
          const category = resourceCategory(game, node);
          const total = harvestSeconds(game, node);
          this.active = {
            node,
            key: nodeKey(game, node),
            def: cloneJson(def || node),
            category,
            skill: skillName,
            requiredLevel: req,
            startedAt: nowMs(),
            timer: total,
            total,
            startX: safeNumber(game.player?.x, 0),
            startY: safeNumber(game.player?.y, 0),
            startHp: safeNumber(game.player?.hp, 0),
            lastHp: safeNumber(game.player?.hp, 0),
            progress: 0
          };
          const verb = category === 'mining' ? 'Mining' : category === 'fishing' ? 'Fishing' : 'Gathering';
          this.status = `${verb} ${node.name || def?.name || 'resource'}...`;
          game.clearClickMoveTarget?.();
          game.player?.setFacingFromDelta?.((safeNumber(node.x, 0) + 0.5) - game.player.x, (safeNumber(node.y, 0) + 0.5) - game.player.y);
          this.setPlayerGatheringPose(node, 0);
          if (category === 'fishing') game.fishingSystem?.startFishingFromResource?.(node);
          game.log(this.status);
          this.refreshPanel();
          return true;
        },

        cancelHarvest(message) {
          const wasFishing = this.active?.category === 'fishing';
          this.active = null;
          this.clearPlayerGatheringPose();
          if (wasFishing) game.fishingSystem?.clearPlayerFishingPose?.();
          this.status = message || 'Gathering cancelled.';
          game.log(this.status);
          this.refreshPanel();
        },

        cancelForMovement() {
          if (!this.active) return false;
          this.cancelHarvest('Gathering cancelled by movement.');
          return true;
        },

        cancelForDamage() {
          if (!this.active) return false;
          this.cancelHarvest('Gathering cancelled by damage.');
          return true;
        },

        setPlayerGatheringPose(node, progress = 0) {
          const p = game.player;
          if (!p) return;
          const targetX = safeNumber(node?.x, p.x) + 0.5;
          const targetY = safeNumber(node?.y, p.y) + 0.5;
          p.gathering = true;
          p.gatheringTargetX = targetX;
          p.gatheringTargetY = targetY;
          p.gatheringProgress = Math.max(0, Math.min(1, progress));
          p.gatheringKind = this.active?.category || resourceCategory(game, node);
          p.gatheringAnim = 1;
          p.action = 'gathering';
          p.isMoving = false;
          p.moveBlend = 0;
          p.setFacingFromDelta?.(targetX - p.x, targetY - p.y);
        },

        setPlayerGatheringCompletePose(node, active) {
          const p = game.player;
          if (!p || !node || !active) return;
          const category = active.category || resourceCategory(game, node);
          if (category === 'fishing' || category === 'mining') {
            this.clearPlayerGatheringPose();
            return;
          }
          const targetX = safeNumber(node?.x, p.x) + 0.5;
          const targetY = safeNumber(node?.y, p.y) + 0.5;
          p.gathering = true;
          p.gatheringAnim = 1;
          p.gatheringProgress = 1;
          p.gatheringKind = category;
          p.gatheringCompleteTimer = 0.34;
          p.gatheringTargetX = targetX;
          p.gatheringTargetY = targetY;
          p.action = 'gathering';
          p.isMoving = false;
          p.moveBlend = 0;
          p.setFacingFromDelta?.(targetX - p.x, targetY - p.y);
        },

        updateGatheringCompletePose(dt) {
          const p = game.player;
          if (!p?.gatheringCompleteTimer) return;
          p.gatheringCompleteTimer = Math.max(0, safeNumber(p.gatheringCompleteTimer, 0) - Math.max(0, safeNumber(dt, 0)));
          if (p.gatheringCompleteTimer <= 0) this.clearPlayerGatheringPose();
        },

        clearPlayerGatheringPose() {
          const p = game.player;
          if (!p) return;
          p.gathering = false;
          p.gatheringAnim = 0;
          p.gatheringProgress = 0;
          p.gatheringKind = null;
          p.gatheringTargetX = null;
          p.gatheringTargetY = null;
          p.gatheringCompleteTimer = 0;
          if (String(p.action || '').toLowerCase() === 'gathering') p.action = 'idle';
        },

        resolveDirectDrops(node) {
          const def = resourceDef(game, node) || node;
          const summary = [];
          const items = [];
          const drops = Array.isArray(node.drops) && node.drops.length ? node.drops : (Array.isArray(def.drops) ? def.drops : []);
          for (const drop of drops) {
            const itemId = resolveDropItemId(game, drop);
            if (!itemId) continue;
            const min = Math.max(0, Math.floor(safeNumber(drop.min, 1)));
            const max = Math.max(min, Math.floor(safeNumber(drop.max, min || 1)));
            const qty = randInt(min, max);
            if (qty <= 0) continue;
            const result = game.grantEditorItem?.(itemId, qty, { rarityKey: 'white' }) || { ok: false };
            if (result.ok) {
              summary.push(`${result.name} x${result.quantity}`);
              items.push({ itemId, name: result.name, quantity: result.quantity, rarityKey: 'white' });
            }
          }

          const rareDrops = Array.isArray(node.rareDrops) && node.rareDrops.length ? node.rareDrops : (Array.isArray(def.rareDrops) ? def.rareDrops : []);
          for (const drop of rareDrops) {
            const chance = safeNumber(drop.chance, 0);
            if (Math.random() > chance) continue;
            const itemId = resolveDropItemId(game, drop);
            if (!itemId) continue;
            const result = game.grantEditorItem?.(itemId, 1, { rarityKey: 'green' }) || { ok: false };
            if (result.ok) {
              summary.push(`${result.name} x${result.quantity}`);
              items.push({ itemId, name: result.name, quantity: result.quantity, rarityKey: 'green', rare: true });
            }
          }

          return {
            tableId: null,
            tableName: 'Direct Resource Drops',
            gold: 0,
            items,
            summary: summary.length ? summary.join(', ') : 'nothing'
          };
        },

        completeHarvest() {
          const active = this.active;
          if (!active) return false;
          const node = active.node;
          this.active = null;

          if (!node || !this.isAvailable(node)) {
            this.clearPlayerGatheringPose();
            this.status = 'That resource is depleted.';
            this.refreshPanel();
            return false;
          }

          const skill = this.skill(active.skill);
          const skillAdvantage = Math.max(0, skill.level - active.requiredLevel);
          const baseChance = active.category === 'fishing' ? 0.78 : active.category === 'mining' ? 0.84 : 0.88;
          const successChance = Math.min(0.98, baseChance + skillAdvantage * 0.035);
          if (Math.random() > successChance) {
            this.clearPlayerGatheringPose();
            if (active.category === 'fishing') game.fishingSystem?.clearPlayerFishingPose?.();
            skill.failures += 1;
            this.gainSkillXp(active.skill, Math.max(2, Math.floor(xpForResource(game, node, null) * 0.25)), { items: [] }, false);
            this.status = `${node.name || active.def?.name || 'Resource'} attempt failed.`;
            this.completionToast = { timer: 0.75, message: this.status, success: false };
            game.log(this.status);
            this.saveState();
            this.refreshPanel();
            return false;
          }

          const def = resourceDef(game, node);
          const tableId = tableForResource(game, node);
          let result = null;
          if (tableId && typeof game.rollEditorLootTable === 'function') {
            result = game.rollEditorLootTable(tableId, {
              kind: 'resourceNode',
              nodeKey: active.key,
              resourceId: node.type || node.id,
              name: node.name || def?.name || 'Resource Node',
              level: skill.level,
              zoneId: zoneKey(game),
              category: active.category,
              skill: active.skill
            }, { fallbackTableId: tableId, fallbackGenerated: false });
          }
          if (!result || !Array.isArray(result.items) || !result.items.length) {
            result = this.resolveDirectDrops(node);
          }

          // Phase 24: respawn uses the plan's per-resource min-max range when the
          // def provides one (randomized so a rare node's respawn is not a fixed,
          // predictable interval that is easier to farm); falls back to the single
          // respawnSeconds. respawnAt is an absolute wall-clock timestamp, so it
          // survives reloads, zone/floor transitions, and off-screen/return - the
          // node stays depleted until real time passes, never resetting on re-entry.
          const rMin = safeNumber(node.respawnSecondsMin ?? def?.respawnSecondsMin, NaN);
          const rMax = safeNumber(node.respawnSecondsMax ?? def?.respawnSecondsMax, NaN);
          const respawnSeconds = (Number.isFinite(rMin) && Number.isFinite(rMax) && rMin > 0 && rMax >= rMin)
            ? randInt(Math.floor(rMin), Math.floor(rMax))
            : Math.max(10, Math.floor(safeNumber(node.respawnSeconds || def?.respawnSeconds, 180)));
          this.state.depletedNodes[active.key] = {
            depletedAt: nowMs(),
            respawnAt: nowMs() + respawnSeconds * 1000,
            zoneId: zoneKey(game),
            x: Math.floor(safeNumber(node.x, 0)),
            y: Math.floor(safeNumber(node.y, 0)),
            resourceId: node.type || node.id || null,
            skill: active.skill,
            result: cloneJson(result)
          };
          this.state.lastNodeKey = active.key;
          this.state.lastResult = {
            at: nowMs(),
            resourceId: node.type || node.id || null,
            resourceName: node.name || def?.name || 'Resource',
            skill: active.skill,
            result: cloneJson(result)
          };

          let xp = xpForResource(game, node, result);
          // Phase 19: first-time discovery bonus (once per resource id) + rare-node bonus.
          let bonusNote = '';
          const resId = String(node.type || node.id || def?.id || '').toLowerCase();
          if (!this.state.discovered) this.state.discovered = {};
          if (resId && !this.state.discovered[resId]) {
            this.state.discovered[resId] = nowMs();
            const firstBonus = firstDiscoveryBonus(game, node);
            if (firstBonus > 0) { xp += firstBonus; bonusNote += ` First discovery! +${firstBonus} EXP.`; }
          }
          const rareBonus = rareNodeXpBonus(game, node);
          if (rareBonus > 0) { xp += rareBonus; bonusNote += ` Rare node +${rareBonus} EXP.`; }
          this.gainSkillXp(active.skill, xp, result, true);
          this.saveState();
          game.notifyExternalSystems?.('resource-gathered', {
            resourceId: node.type || node.id,
            resourceName: node.name || def?.name,
            category: active.category,
            skill: active.skill,
            zoneId: zoneKey(game),
            x: Math.floor(safeNumber(node.x, 0)),
            y: Math.floor(safeNumber(node.y, 0)),
            result: cloneJson(result)
          });
          game.spawnRing?.((safeNumber(node.x, 0)) + 0.5, (safeNumber(node.y, 0)) + 0.5, def?.color || '#89d66f', 16);
          if (active.category === 'fishing') {
            this.clearPlayerGatheringPose();
            game.fishingSystem?.clearPlayerFishingPose?.();
          } else if (active.category === 'mining') {
            this.clearPlayerGatheringPose();
          } else {
            this.setPlayerGatheringCompletePose(node, active);
          }
          // Phase 25: include the total profession EXP gained in the success
          // feedback (bonusNote still breaks out first-discovery/rare bonuses).
          this.status = `${node.name || def?.name || 'Resource'} gathered: ${result.summary}. +${xp} ${active.skill} EXP.${bonusNote}`;
          this.completionToast = { timer: 0.85, message: this.status, success: true };
          game.log(this.status);
          this.refreshPanel();
          game.renderSkillsPanel?.();
          game.professionSystem?.render?.();
          return true;
        },

        gainSkillXp(skillName, amount, result, success = true) {
          const name = SKILL_NAMES.includes(skillName) ? skillName : 'Gathering';
          const skill = this.skill(name);
          const xp = Math.max(1, Math.floor(safeNumber(amount, 1)));
          skill.xp += xp;
          skill.totalXp += xp;
          if (success) skill.harvests += 1;
          if ((result?.items || []).some(item => ['blue', 'purple', 'gold', 'orange', 'red'].includes(item.rarityKey))) skill.rareFinds += 1;
          let needed = this.nextLevelXp(skill.level);
          while (skill.xp >= needed) {
            skill.xp -= needed;
            skill.level += 1;
            game.log(`${name} level ${skill.level}.`);
            needed = this.nextLevelXp(skill.level);
          }
        },

        nextLevelXp(level) {
          return nextLevelXpFor(level);
        },

        update(dt) {
          if (!game.started || !game.player) return;
          if (!this.panel) this.panel = ensurePanel();
          if (!this.harvestBar) this.harvestBar = ensureHarvestBar();
          if (!this.active) this.updateGatheringCompletePose(dt);
          if (this.active) {
            const active = this.active;
            active.timer -= dt;
            const node = active.node;
            const progress = Math.max(0, Math.min(1, 1 - active.timer / Math.max(0.001, active.total)));
            active.progress = progress;
            this.setPlayerGatheringPose(node, progress);
            if (active.category === 'fishing') game.fishingSystem?.setPlayerFishingPose?.({ x: safeNumber(node?.x, game.player.x) + 0.5, y: safeNumber(node?.y, game.player.y) + 0.5 }, active.timer <= 0.7 ? 'reeling' : 'waiting');
            const movedFromStart = Math.hypot(game.player.x - active.startX, game.player.y - active.startY) > 0.035;
            const movedTooFar = !node || this.distanceToNode(node) > 2.95;
            const hpNow = safeNumber(game.player.hp, active.lastHp);
            const tookDamage = hpNow < Math.min(active.lastHp, active.startHp) - 0.01;
            active.lastHp = hpNow;
            if (movedFromStart || movedTooFar || tookDamage || !game.player.alive || game.player.meditating) {
              this.cancelHarvest(tookDamage ? 'Gathering cancelled by damage.' : 'Gathering cancelled by movement.');
              return;
            }
            this.refreshHarvestBar();
            if (active.timer <= 0) {
              this.completeHarvest();
              return;
            }
          }
          if (this.completionToast) {
            this.completionToast.timer = Math.max(0, safeNumber(this.completionToast.timer, 0) - dt);
            if (this.completionToast.timer <= 0) this.completionToast = null;
            this.refreshHarvestBar();
          }
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.18;
            this.nearbyNode = this.findNearbyResource();
            this.pruneRespawnedNodes();
            this.refreshPanel();
          }
        },

        pruneRespawnedNodes() {
          const now = nowMs();
          let changed = false;
          for (const [key, record] of Object.entries(this.state.depletedNodes || {})) {
            if (safeNumber(record?.respawnAt, 0) <= now) {
              delete this.state.depletedNodes[key];
              changed = true;
            }
          }
          if (changed) this.saveState();
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-resource-status]');
          const progress = this.panel.querySelector('[data-resource-progress]');
          const meta = this.panel.querySelector('[data-resource-meta]');
          if (!status || !progress || !meta) return;
          if (this.active) {
            const pct = Math.max(0, Math.min(100, (1 - this.active.timer / this.active.total) * 100));
            status.textContent = `${this.status} ${Math.ceil(this.active.timer)}s`;
            progress.style.width = `${pct}%`;
          } else if (this.nearbyNode) {
            const def = resourceDef(game, this.nearbyNode);
            const remaining = this.remainingSeconds(this.nearbyNode);
            const skillName = skillForResource(game, this.nearbyNode);
            const req = requiredLevel(game, this.nearbyNode);
            const nodeName = this.nearbyNode.name || def?.name || 'Resource';
            // Phase 25: when the player's profession level is below the node's
            // requirement, the panel shows the plan's "Requires <Skill> Level X"
            // instead of the gather prompt, so an uncollectible node reads clearly.
            const underLevel = this.skill(skillName).level < req;
            status.textContent = remaining > 0
              ? `${nodeName} depleted · ${remaining}s`
              : (underLevel
                ? `${nodeName} · Requires ${skillName} Level ${req}`
                : `${nodeName} nearby · ${skillName} Lv ${req} · G to gather`);
            progress.style.width = remaining > 0 ? '0%' : `${Math.max(8, Math.min(100, (1 - this.distanceToNode(this.nearbyNode) / 2.05) * 100))}%`;
          } else {
            status.textContent = this.status || 'No resource node nearby.';
            progress.style.width = '0%';
          }
          const g = this.skill('Gathering');
          const m = this.skill('Mining');
          const f = this.skill('Fishing');
          meta.textContent = `Gathering ${g.level} (${g.xp}/${this.nextLevelXp(g.level)}) · Mining ${m.level} (${m.xp}/${this.nextLevelXp(m.level)}) · Fishing ${f.level} (${f.xp}/${this.nextLevelXp(f.level)})`;
          this.refreshHarvestBar();
        },

        refreshHarvestBar() {
          if (!this.harvestBar) this.harvestBar = ensureHarvestBar();
          const bar = this.harvestBar;
          if (!bar) return;
          const title = bar.querySelector('[data-harvest-title]');
          const time = bar.querySelector('[data-harvest-time]');
          const fill = bar.querySelector('[data-harvest-fill]');
          const hint = bar.querySelector('[data-harvest-hint]');
          if (this.active) {
            const pct = Math.max(0, Math.min(1, 1 - this.active.timer / Math.max(0.001, this.active.total)));
            const node = this.active.node;
            const def = resourceDef(game, node);
            const verb = this.active.category === 'mining' ? 'Mining' : this.active.category === 'fishing' ? 'Fishing' : 'Harvesting';
            if (title) title.textContent = `${verb}: ${node?.name || def?.name || 'Resource'}`;
            if (time) time.textContent = `${Math.max(0, this.active.timer).toFixed(1)}s`;
            if (fill) {
              fill.style.width = `${Math.round(pct * 100)}%`;
              fill.style.background = this.active.category === 'mining'
                ? 'linear-gradient(90deg, #6f5e48, #d3b16a, #fff0a2)'
                : this.active.category === 'fishing'
                  ? 'linear-gradient(90deg, #3f7891, #70d8e6, #dffbff)'
                  : 'linear-gradient(90deg, #3f8659, #89e88a, #e5f8a7)';
            }
            if (hint) hint.textContent = 'Moving or taking damage cancels harvesting.';
            bar.style.display = 'block';
            return;
          }
          if (this.completionToast) {
            if (title) title.textContent = this.completionToast.success ? 'Harvest Complete' : 'Harvest Failed';
            if (time) time.textContent = '';
            if (fill) {
              fill.style.width = '100%';
              fill.style.background = this.completionToast.success
                ? 'linear-gradient(90deg, #4f8f55, #c5f49b, #fff5a8)'
                : 'linear-gradient(90deg, #734a3b, #d88466, #ffd0a8)';
            }
            if (hint) hint.textContent = this.completionToast.message || '';
            bar.style.display = 'block';
            return;
          }
          bar.style.display = 'none';
        },

        renderGroundLayer(context) {
          if (!game.started || !game.player) return;
          const nodes = this.allResourceNodes();
          if (!nodes.length) return;
          const px = game.player.x;
          const py = game.player.y;
          context.save();
          context.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          for (const node of nodes) {
            const x = Math.floor(safeNumber(node.x, 0));
            const y = Math.floor(safeNumber(node.y, 0));
            if (Math.hypot(x + 0.5 - px, y + 0.5 - py) > 34) continue;
            const tile = game.map?.[y]?.[x];
            if (!tile) continue;
            const def = resourceDef(game, node) || node;
            const remaining = this.remainingSeconds(node);
            const depleted = remaining > 0;
            const req = requiredLevel(game, node);
            const skill = this.skill(skillForResource(game, node));
            const locked = skill.level < req;
            const s = game.worldToScreen(x + 0.5, y + 0.5, tile.elev + 0.08);
            drawResourceNodeProp(context, s, def, node, { depleted, locked });
          }
          // V0.14.27: no floating harvest marker circles; the actual herb/ore prop is the visual target.
          context.restore();
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
