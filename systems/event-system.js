// Dream Realms runtime dialogue / event execution system
// Modular Pass 32: consumes editor event markers at runtime.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const STORAGE_KEY = 'dream-realms.event-runtime.v1';

  // V0.18.74: vendor stock is now shared DATA (exposed on DR) instead of being buried inside the
  // shopItemIds() method, so the item-obtainability audit (core/registry.js) can see that a
  // vendor item is reachable. The camp general store now also stocks the basic gathering tools and
  // starter bags a new character needs (closes obtainability gaps the audit flagged).
  const SHOP_ITEM_LISTS = {
    shop_camp_basic_goods: [
      'item_gloomleaf', 'item_darkwater_fish', 'item_copper_ore', 'item_gloomforged_blade',
      'item_blackroot_staff', 'item_ironbark_shield',
      'item_crude_pickaxe', 'item_worn_fishing_rod', 'item_basic_fishing_rod', 'item_herbalist_knife',
      'item_worn_hatchet', 'item_linen_pouch', 'item_travelers_pack',
      // V0.18.75: basic belts sold at the camp general store (Roadmap Item 4 B).
      'item_belt_frayed_rope', 'item_belt_studded_leather', 'item_belt_hunters_cord',
      'item_belt_woven_reed_sash', 'item_belt_travelers', 'item_belt_mendcloth',
      'item_belt_foragers_toolbelt', 'item_belt_apprentice_cord',
      // V0.18.76: small/field bags sold at the camp general store (Roadmap Item 4 D).
      'item_bag_barkweave_pouch', 'item_bag_trappers_satchel', 'item_bag_gloomhide_pack',
      // V0.18.77: basic chest pieces sold at the camp general store (Roadmap Item 4 A).
      'item_chest_homespun_robe', 'item_chest_tanned_jerkin', 'item_chest_iron_breastplate',
      // V0.18.78: basic legs pieces sold at the camp general store (Roadmap Item 4 A).
      'item_legs_homespun_leggings', 'item_legs_tanned_leggings', 'item_legs_iron_greaves',
      'item_head_homespun_hood', 'item_head_tanned_cap', 'item_head_iron_helm',
      'item_shoulders_homespun_mantle', 'item_shoulders_tanned_spaulders', 'item_shoulders_iron_pauldrons',
      'item_hands_homespun_gloves', 'item_hands_tanned_gloves', 'item_hands_iron_gauntlets',
      'item_feet_homespun_slippers', 'item_feet_tanned_boots', 'item_feet_iron_sabatons',
      'item_cape_traveler_cloak', 'item_cape_tanned_cloak', 'item_cape_field_cloak',
      'item_weapon_gloomiron_sword', 'item_weapon_briar_dagger', 'item_weapon_oaken_staff',
      'item_offhand_bark_buckler', 'item_offhand_apprentice_orb', 'item_offhand_ironbound_shield',
      'item_amulet_woodcharm_pendant', 'item_ring_copper_band', 'item_earring_briar_stud',
      // V0.20.70 (Roadmap Item 7): the starter mount. Every other mount must be TAMED, and the
      // easiest tameable beast needs level 3 plus bait - so a new character had no route to a mount
      // at all. Sold here rather than given, so it stays a goal rather than a handout.
      'item_drovers_whistle'
    ],
    trainer_goods: ['item_gloomleaf_wraps', 'item_roasted_darkwater_fish', 'item_mossfang_charm'],
    herbalist: ['item_gloomleaf', 'item_darkwater_fish', 'item_gloomleaf_wraps', 'item_roasted_darkwater_fish', 'item_herbalist_knife'],
    blacksmith: ['item_copper_ore', 'item_copper_bar', 'item_gloomforged_blade', 'item_ironbark_shield', 'item_crude_pickaxe']
  };
  DR.SHOP_ITEM_LISTS = SHOP_ITEM_LISTS;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function defaultState() {
    return {
      openedChests: {},
      activatedEvents: {},
      lastEventKey: null,
      // Phase 5 (Event/Quest/Condition/Variable Parity): global named
      // variable slots (numeric/string) and per-event-instance self-switch
      // flags (RPG-Maker/Intersect-style A-D booleans, keyed by the same
      // stable eventKey() already used for activatedEvents). Both start
      // empty and are only ever written by the new setVariable/
      // setSelfSwitch event commands below - no existing save/event
      // produces any entries, so this is purely additive.
      variables: {},
      selfSwitches: {},
      version: 1
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    base.openedChests = raw.openedChests && typeof raw.openedChests === 'object' ? raw.openedChests : {};
    base.activatedEvents = raw.activatedEvents && typeof raw.activatedEvents === 'object' ? raw.activatedEvents : {};
    base.variables = raw.variables && typeof raw.variables === 'object' && !Array.isArray(raw.variables) ? raw.variables : {};
    base.selfSwitches = raw.selfSwitches && typeof raw.selfSwitches === 'object' && !Array.isArray(raw.selfSwitches) ? raw.selfSwitches : {};
    base.lastEventKey = raw.lastEventKey || null;
    return base;
  }

  function readLocalState() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
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
    return game.currentZone === 'cave' ? (game.getActiveCaveZoneKey?.() || game.currentCave?.id || 'mossfang_cave') : 'dark_woods';
  }

  function eventKey(game, node) {
    const key = zoneKey(game);
    return `${key}:${Math.floor(Number(node.x) || 0)},${Math.floor(Number(node.y) || 0)}:${node.id || node.type || node.category || 'event'}`;
  }

  function distanceToPlayer(game, node) {
    if (!game.player || !node) return Infinity;
    const x = Number(node.x);
    const y = Number(node.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Infinity;
    return Math.hypot((x + 0.5) - game.player.x, (y + 0.5) - game.player.y);
  }


  function setWindowAnchor(runtime, node) {
    const runtimeGame = runtime.game;
    runtime.windowAnchor = runtimeGame?.player && node ? {
      playerX: runtimeGame.player.x,
      playerY: runtimeGame.player.y,
      nodeX: Number(node.x),
      nodeY: Number(node.y),
      nodeName: node.name || node.id || node.type || 'event'
    } : null;
  }

  function interactionWindowInvalid(runtime, node, maxRange = 3.2) {
    const runtimeGame = runtime.game;
    if (!runtimeGame?.player || !node) return true;
    const anchor = runtime.windowAnchor;
    if (anchor && Math.hypot(runtimeGame.player.x - anchor.playerX, runtimeGame.player.y - anchor.playerY) > 0.08) return true;
    return distanceToPlayer(runtimeGame, node) > maxRange;
  }

  function allEventNodes(game) {
    const grid = game.editorEvents?.[zoneKey(game)];
    if (!grid || typeof grid !== 'object') return [];
    return Object.values(grid).filter(node => node && node.enabled !== false);
  }

  function eventDefinition(node) {
    return DR.EVENT_BY_ID?.[node.type] || DR.EVENT_BY_ID?.[node.id] || null;
  }

  function categoryOf(node) {
    const def = eventDefinition(node);
    return node.category || def?.category || node.type || node.id || 'generic';
  }

  function commandList(node) {
    const def = eventDefinition(node);
    const commands = Array.isArray(node.commands) && node.commands.length ? node.commands : (Array.isArray(def?.commands) ? def.commands : []);
    return cloneJson(commands) || [];
  }

  function ensurePanel() {
    const host = document.getElementById('externalSystemsHud');
    if (!host) return null;
    let panel = document.getElementById('eventSystemPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'eventSystemPanel';
    panel.className = 'systemPanel';
    panel.innerHTML = `
      <h3>Events</h3>
      <div class="small" data-event-status>No event nearby.</div>
      <div class="systemMeter"><div class="systemMeterFill" data-event-range style="background:linear-gradient(90deg,#d8ad57,#fff08a)"></div></div>
      <div class="small" data-event-meta>E: Interact · Touch warps auto-fire</div>
    `;
    host.appendChild(panel);
    return panel;
  }

  function ensureDialogueWindow(runtime) {
    let panel = document.getElementById('eventDialoguePanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'eventDialoguePanel';
    panel.className = 'panel gameWindow';
    panel.style.display = 'none';
    panel.style.left = '50%';
    panel.style.bottom = '26px';
    panel.style.top = 'auto';
    panel.style.right = 'auto';
    panel.style.transform = 'translateX(-50%)';
    panel.style.width = 'min(680px, calc(100vw - 28px))';
    panel.innerHTML = `
      <div class="windowHeader">
        <div>
          <div class="name" data-dialogue-title>Dialogue</div>
          <div class="small" data-dialogue-subtitle>Runtime Event</div>
        </div>
        <button data-dialogue-close>Close</button>
      </div>
      <div data-dialogue-body class="small" style="font-size:14px; line-height:1.55; color:#f7ead1"></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-dialogue-close]')?.addEventListener('click', () => runtime.closeDialogue());
    return panel;
  }

  function ensureShopWindow(runtime) {
    let panel = document.getElementById('eventShopPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'eventShopPanel';
    panel.className = 'panel gameWindow';
    panel.style.display = 'none';
    panel.style.right = '284px';
    panel.style.top = '84px';
    panel.style.width = 'min(560px, calc(100vw - 26px))';
    panel.style.maxHeight = 'min(680px, calc(100vh - 118px))';
    panel.style.overflow = 'auto';
    panel.innerHTML = `
      <div class="windowHeader">
        <div>
          <div class="name" data-shop-title>Shop</div>
          <div class="small" data-shop-subtitle>Runtime Event Shop</div>
        </div>
        <button data-shop-close>Close</button>
      </div>
      <div class="small" data-shop-meta></div>
      <div class="shopTabs" style="display:flex;gap:8px;margin:10px 0">
        <button data-shop-tab="buy" type="button">Buy</button>
        <button data-shop-tab="sell" type="button">Sell</button>
      </div>
      <div data-shop-body></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-shop-close]')?.addEventListener('click', () => runtime.closeShop());
    panel.addEventListener('click', event => {
      const tab = event.target.closest('button[data-shop-tab]');
      if (tab) { runtime.activeShopTab = tab.dataset.shopTab === 'sell' ? 'sell' : 'buy'; runtime.renderShop(); return; }
      const sellButton = event.target.closest('button[data-shop-sell]');
      if (sellButton) { runtime.sellShopItem(Number(sellButton.dataset.shopSell)); return; }
      const button = event.target.closest('button[data-shop-buy]');
      if (!button) return;
      runtime.buyShopItem(button.dataset.shopBuy);
    });
    return panel;
  }

  function rarityDef(game, key) {
    return (DR.RARITIES || []).find(r => r.key === key) || (DR.RARITIES || [])[1] || { key: 'white', label: 'Normal', color: '#d8ded1', stat: 1 };
  }

  function itemDraft(game, itemId) {
    return game.editorItems?.[itemId] || DR.ITEM_BY_ID?.[itemId] || null;
  }

  function itemDisplayName(game, itemId) {
    return itemDraft(game, itemId)?.name || itemId || 'Unknown Item';
  }

  function inventoryItemFromDraft(game, draft, qty = 1) {
    if (!draft) return null;
    const rarity = rarityDef(game, draft.rarity || 'white');
    const stack = Math.max(1, Math.floor(Number(qty) || 1));
    const materialLike = ['resource', 'quest', 'currency', 'consumable'].includes(draft.type) || draft.slot === 'none' || draft.slot === 'material';
    if (materialLike) {
      return {
        material: true,
        data: {
          id: draft.id,
          itemId: draft.id,
          name: draft.name || draft.id,
          category: draft.type || 'Resource',
          rarityKey: rarity.key,
          value: draft.sellValue || draft.value || 1,
          stack,
          description: draft.description || 'An item from a runtime event.'
        }
      };
    }
    return {
      id: game.itemSerial++,
      itemId: draft.id,
      name: draft.name || draft.id,
      baseName: draft.name || draft.id,
      slot: draft.slot || 'charm',
      classes: Array.isArray(draft.classRestrictions) ? draft.classRestrictions : Object.keys(DR.CLASSES || {}),
      rarity,
      stats: cloneJson(draft.stats || {}) || {},
      level: Math.max(1, Number(draft.levelRequirement) || 1),
      value: Math.max(1, Number(draft.sellValue || draft.value || 1) || 1),
      description: draft.description || 'An item from a runtime event.'
    };
  }

  registerDreamRealmsSystem({
    id: 'eventRuntime',
    name: 'Runtime Event System',

    install(game) {
      const runtime = {
        id: 'eventRuntime',
        name: 'Runtime Event System',
        game,
        state: normalizeState(game.pendingEventRuntimeState || readLocalState()),
        panel: ensurePanel(),
        dialoguePanel: null,
        shopPanel: null,
        activeShop: null,
        nearbyEvent: null,
        touchCooldown: 0,
        statusTick: 0,

        init() {
          game.eventSystem = this;
          game.eventRuntimeState = this.state;
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
            const node = this.findNearbyInteractiveEvent();
            if (!node) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.interactWithEvent(node);
          });
        },

        serializeState() {
          return cloneJson(this.state);
        },

        importState(state) {
          this.state = normalizeState(state || defaultState());
          game.eventRuntimeState = this.state;
          this.saveState();
          this.refreshPanel();
        },

        saveState() {
          game.eventRuntimeState = this.state;
          writeLocalState(this.state);
          if (game.worldSaveDirty !== undefined) game.worldSaveDirty = true;
        },

        // Phase 5 (Event/Quest/Condition/Variable Parity): global named
        // variables (Intersect/RPG-Maker "Control Variables" equivalent).
        // Values are numbers or strings; missing variables read as 0.
        getEventVariable(name, fallback = 0) {
          if (!name) return fallback;
          const value = this.state.variables[name];
          return value === undefined ? fallback : value;
        },

        setEventVariable(name, value) {
          if (!name) return false;
          this.state.variables[name] = value;
          this.saveState();
          return true;
        },

        // Self-switches: per-event-instance boolean flags (A-D, matching
        // the RPG-Maker/Intersect convention), keyed by the same stable
        // eventKey() already used for activatedEvents so each placed node
        // gets its own independent set of switches.
        getEventSelfSwitch(node, letter = 'A') {
          const key = eventKey(game, node);
          const bucket = this.state.selfSwitches[key];
          return Boolean(bucket && bucket[String(letter || 'A').toUpperCase()]);
        },

        setEventSelfSwitch(node, letter = 'A', value = true) {
          const key = eventKey(game, node);
          const bucket = this.state.selfSwitches[key] || (this.state.selfSwitches[key] = {});
          bucket[String(letter || 'A').toUpperCase()] = Boolean(value);
          this.saveState();
          return true;
        },

        // Single condition evaluator, reused by event-command gating below
        // and (optionally, via game.eventSystem.evaluateEventCondition)
        // by systems/quest-system.js's isQuestAvailable for an optional
        // quest.requiredConditions field. `node` is only needed for the
        // 'selfSwitch' type; every other type ignores it.
        evaluateEventCondition(condition, node = null) {
          if (!condition || typeof condition !== 'object') return true;
          const type = condition.type;
          if (type === 'variable') {
            const current = this.getEventVariable(condition.name);
            const target = condition.value;
            const op = condition.op || '==';
            const numericCurrent = Number(current);
            const numericTarget = Number(target);
            const bothNumeric = Number.isFinite(numericCurrent) && Number.isFinite(numericTarget);
            const a = bothNumeric ? numericCurrent : current;
            const b = bothNumeric ? numericTarget : target;
            if (op === '!=') return a !== b;
            if (op === '>=') return a >= b;
            if (op === '<=') return a <= b;
            if (op === '>') return a > b;
            if (op === '<') return a < b;
            return a === b;
          }
          if (type === 'selfSwitch') return this.getEventSelfSwitch(node, condition.key || 'A') === (condition.value !== false);
          if (type === 'questAvailable') return Boolean(game.questSystem?.isQuestAvailable?.(condition.questId));
          if (type === 'questCompleted') return Boolean(game.questSystem?.state?.completed?.[condition.questId]);
          if (type === 'level') return Number(game.player?.level || 1) >= Number(condition.min || 1);
          if (type === 'itemOwned') {
            const required = Math.max(1, Math.floor(Number(condition.quantity) || 1));
            const owned = (game.inventory || []).reduce((sum, item) => item?.itemId === condition.itemId ? sum + Math.max(1, Math.floor(Number(item.stack) || 1)) : sum, 0);
            return owned >= required;
          }
          return true;
        },

        evaluateEventConditions(conditions, node = null) {
          if (!Array.isArray(conditions) || !conditions.length) return true;
          return conditions.every(condition => this.evaluateEventCondition(condition, node));
        },

        onGameEvent(eventName, payload = {}) {
          if (eventName === 'player-started') {
            this.state = normalizeState(game.pendingEventRuntimeState || this.state || readLocalState());
            this.saveState();
            this.refreshPanel();
          }
        },

        findNearbyInteractiveEvent() {
          if (!game.player) return null;
          const candidates = allEventNodes(game)
            .map(node => ({ node, d: distanceToPlayer(game, node), category: categoryOf(node) }))
            .filter(entry => entry.d <= 2.65 && entry.category !== 'warp_touch_only')
            .sort((a, b) => a.d - b.d);
          return candidates[0]?.node || null;
        },

        findNearbyTouchWarp() {
          if (!game.player) return null;
          const candidates = allEventNodes(game)
            .map(node => ({ node, d: distanceToPlayer(game, node), category: categoryOf(node) }))
            .filter(entry => entry.d <= 0.9 && (entry.category === 'warp' || entry.node.trigger === 'touch' || entry.node.type === 'warp_event' || entry.node.id === 'warp_event'))
            .sort((a, b) => a.d - b.d);
          return candidates[0]?.node || null;
        },

        update(dt) {
          if (!this.panel) this.panel = ensurePanel();
          this.closeTransientWindowsIfInvalid?.();
          this.touchCooldown = Math.max(0, this.touchCooldown - dt);
          this.statusTick -= dt;
          if (this.statusTick <= 0) {
            this.statusTick = 0.2;
            this.nearbyEvent = this.findNearbyInteractiveEvent();
            this.refreshPanel();
          }
          if (this.touchCooldown <= 0) {
            const warp = this.findNearbyTouchWarp();
            if (warp) {
              this.touchCooldown = 1.2;
              this.executeWarp(warp, { auto: true });
            }
          }
        },

        closeTransientWindowsIfInvalid() {
          if (this.activeShop?.node && this.shopPanel?.style?.display !== 'none' && interactionWindowInvalid(this, this.activeShop.node, 3.25)) {
            this.closeShop();
            game.closeVendorSellWindow?.();
            game.log?.('Vendor window closed: you moved away.', 'System');
          }
          if (this.activeDialogueNode && this.dialoguePanel?.style?.display !== 'none' && interactionWindowInvalid(this, this.activeDialogueNode, 3.25)) {
            this.closeDialogue();
            game.log?.('Dialogue closed: you moved away.', 'System');
          }
        },

        refreshPanel() {
          if (!this.panel) return;
          const status = this.panel.querySelector('[data-event-status]');
          const fill = this.panel.querySelector('[data-event-range]');
          const meta = this.panel.querySelector('[data-event-meta]');
          const node = this.nearbyEvent || this.findNearbyInteractiveEvent();
          if (status) status.textContent = node ? `E: ${node.name || eventDefinition(node)?.name || 'Event'}` : 'No event nearby.';
          if (fill) {
            const d = node ? clamp(distanceToPlayer(game, node), 0, 2.65) : 2.65;
            fill.style.width = node ? `${Math.floor((1 - d / 2.65) * 100)}%` : '0%';
          }
          if (meta) {
            const opened = Object.keys(this.state.openedChests || {}).length;
            const activated = Object.keys(this.state.activatedEvents || {}).length;
            meta.textContent = `E: Interact · Opened ${opened} · Events ${activated}`;
          }
        },

        interactWithEvent(node) {
          if (!node || node.enabled === false) return false;
          const category = categoryOf(node);
          const key = eventKey(game, node);
          this.state.lastEventKey = key;
          this.state.activatedEvents[key] = Date.now();
          this.saveState();
          game.notifyExternalSystems?.('event-triggered', { event: node, eventKey: key, category });

          if (category === 'quest' || node.questId) return this.executeQuestHook(node);
          if (category === 'dialogue' || node.type === 'dialogue' || node.id === 'dialogue') return this.showDialogue(node);
          if (category === 'chest' || node.type === 'chest_event' || node.id === 'chest_event') return this.openChest(node);
          if (category === 'shop' || node.type === 'shop_event' || node.id === 'shop_event') return this.openShop(node);
          if (category === 'warp' || node.type === 'warp_event' || node.id === 'warp_event') return this.executeWarp(node);

          const commands = commandList(node);
          if (commands.length) {
            // Phase 5 (Event/Quest/Condition/Variable Parity): node.conditions
            // gates the generic command-list fallback only - NOT the quest/
            // dialogue/chest/shop/warp category shortcuts above, which
            // return earlier and never reach here. This is deliberate:
            // today the only node type that ever sets `conditions` is the
            // quest-hook editor tool (`conditions: [{type:'questAvailable',...}]`),
            // and those nodes always take the `category === 'quest'` branch
            // above, so this check is a no-op for all current content - a
            // quest-hook's "is this quest currently available" condition
            // would be the WRONG thing to gate a marker's entire
            // interactivity on anyway (it would block re-interacting with
            // an already-active or already-completed quest hook, which
            // executeQuestHook's own logic below correctly still handles).
            // This only activates for future generic/custom events that
            // declare real conditions and reach this fallback path.
            if (!this.evaluateEventConditions(node.conditions, node)) return false;
            return this.executeCommands(node, commands);
          }
          return this.showDialogue({ ...node, dialogueText: node.note || 'The marker hums quietly, but no command is attached yet.' });
        },

        executeCommands(node, commands) {
          let handled = false;
          for (const command of commands) {
            if (!command || typeof command !== 'object') continue;
            if (command.type === 'showText') {
              this.showDialogue({ ...node, dialogueText: command.text || node.note || '...' });
              handled = true;
            } else if (command.type === 'openChest') {
              this.openChest({ ...node, lootTableId: command.lootTable || command.lootTableId || node.lootTableId });
              handled = true;
            } else if (command.type === 'openShop') {
              this.openShop({ ...node, shopId: command.shopId || node.shopId });
              handled = true;
            } else if (command.type === 'warp') {
              this.executeWarp({ ...node, targetZone: command.targetZone || node.targetZone, targetX: command.targetX, targetY: command.targetY });
              handled = true;
            } else if (command.type === 'questHook') {
              this.executeQuestHook({ ...node, questId: command.questId || node.questId });
              handled = true;
            } else if (command.type === 'setVariable') {
              // Phase 5 (Event/Quest/Condition/Variable Parity): new command,
              // no existing event data uses it yet.
              const current = Number(this.getEventVariable(command.name, 0)) || 0;
              const amount = Number(command.value) || 0;
              const op = command.op || 'set';
              const next = op === 'add' ? current + amount : op === 'sub' ? current - amount : (command.value ?? current);
              this.setEventVariable(command.name, next);
              handled = true;
            } else if (command.type === 'setSelfSwitch') {
              // Phase 5 (Event/Quest/Condition/Variable Parity): new command,
              // no existing event data uses it yet.
              this.setEventSelfSwitch(node, command.key || 'A', command.value !== false);
              handled = true;
            }
          }
          if (!handled) this.showDialogue({ ...node, dialogueText: 'This event has commands, but no runtime handler supports them yet.' });
          return handled;
        },

        executeQuestHook(node) {
          const questId = node.questId || commandList(node).find(cmd => cmd.questId)?.questId;
          if (!questId) {
            game.log(`${node.name || 'Quest Hook'}: no quest assigned.`);
            return false;
          }
          if (!game.questSystem?.chooseQuestFromSource) {
            game.log(`${node.name || 'Quest Hook'}: quest runtime is unavailable.`);
            return false;
          }
          const sourceName = node.questName || node.name || 'Quest Hook';
          // Phase 5 (Event/Quest/Condition/Variable Parity): this used to
          // reimplement a subset of quest-system.js's chooseQuestFromSource
          // priority logic inline, but was missing the "locked" case
          // (prerequisite/level not met) - a player interacting with a
          // quest-hook for a quest they can't yet accept would incorrectly
          // be told "You have already completed this quest." Reusing the
          // same shared function quest-system.js's own interact() already
          // calls fixes that message and removes the duplicate
          // implementation, without changing the complete/accept/progress
          // outcomes, which are unchanged.
          const pick = game.questSystem.chooseQuestFromSource({ name: sourceName, questIds: [questId] });
          if (!pick) {
            game.log(`${sourceName}: no quest assigned.`);
            return false;
          }
          const quest = game.questSystem.questById?.(questId);
          if (pick.mode === 'complete') return game.questSystem.completeQuest(questId, sourceName);
          if (pick.mode === 'accept') return game.questSystem.acceptQuest(questId, sourceName);
          if (pick.mode === 'progress') {
            const active = game.questSystem.state?.active?.[questId];
            game.log(`${sourceName}: ${active?.inProgressText || quest?.inProgressText || 'Keep working on the objective.'}`);
            return true;
          }
          if (pick.mode === 'locked') {
            game.log(`${sourceName}: ${game.questSystem.unavailableQuestReason?.(questId) || 'That quest is locked.'}`);
            return true;
          }
          // V0.19.2 (Roadmap Item 1, state 8): post-completion dialogue reflects the changed world;
          // completedText (the turn-in line) is the fallback.
          game.log(`${sourceName}: ${quest?.postCompletionText || quest?.completedText || 'You have already completed this quest.'}`);
          return true;
        },

        showDialogue(node) {
          this.dialoguePanel = ensureDialogueWindow(this);
          const title = this.dialoguePanel.querySelector('[data-dialogue-title]');
          const subtitle = this.dialoguePanel.querySelector('[data-dialogue-subtitle]');
          const body = this.dialoguePanel.querySelector('[data-dialogue-body]');
          const commands = commandList(node);
          const text = node.dialogueText
            || commands.find(cmd => cmd.type === 'showText')?.text
            || node.note
            || 'The air feels strange here.';
          if (title) title.textContent = node.name || eventDefinition(node)?.name || 'Dialogue';
          if (subtitle) subtitle.textContent = `${zoneKey(game)} · ${Math.floor(node.x)},${Math.floor(node.y)}`;
          if (body) body.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
          this.activeDialogueNode = node;
          setWindowAnchor(this, node);
          this.dialoguePanel.style.display = 'block';
          game.log(`${node.name || 'Dialogue'} opened.`);
          return true;
        },

        closeDialogue() {
          if (this.dialoguePanel) this.dialoguePanel.style.display = 'none';
          this.activeDialogueNode = null;
        },

        openChest(node) {
          const key = eventKey(game, node);
          if (this.state.openedChests[key]) {
            game.log(`${node.name || 'Chest'} is empty.`);
            return false;
          }
          const tableId = node.lootTableId || commandList(node).find(cmd => cmd.lootTable || cmd.lootTableId)?.lootTable || 'loot_common_chest';
          const table = game.getLootTableById?.(tableId, 'loot_common_chest') || game.editorLootTables?.[tableId] || DR.LOOT_TABLE_BY_ID?.[tableId] || DR.LOOT_TABLE_BY_ID?.loot_common_chest;
          const result = game.rollEditorLootTable
            ? game.rollEditorLootTable(table, { kind: 'eventChest', key, name: node.name || 'Chest', level: game.player?.level || 1 }, { fallbackTableId: 'loot_common_chest' })
            : this.rollLootTable(table, node);
          this.state.openedChests[key] = { openedAt: Date.now(), lootTableId: table?.id || tableId, result };
          this.saveState();
          game.spawnRing?.(node.x + 0.5, node.y + 0.5, '#d8ad57', 22);
          game.log(`${node.name || 'Chest'} opened: ${result.summary}.`);
          game.maybeQueuePartyBanter?.('chestOpened', { priority: 1 });
          return true;
        },

        rollLootTable(table, node) {
          if (game.rollEditorLootTable) {
            return game.rollEditorLootTable(table, { kind: 'eventChest', name: node?.name || 'Chest', level: game.player?.level || 1 }, { fallbackTableId: 'loot_common_chest' });
          }
          const granted = [];
          let gold = 0;
          if (table?.gold) {
            const min = Math.max(0, Math.floor(Number(table.gold.min) || 0));
            const max = Math.max(min, Math.floor(Number(table.gold.max) || min));
            gold = randInt(min, max);
            // V0.18.99: authored chest money is on the SILVER scale (see addSilver).
            if (gold > 0 && game.player) {
              if (game.addSilver) game.addSilver(gold);
              else if (game.addGold) game.addGold(gold);
              else game.player.gold += gold;
            }
          }
          for (const entry of table?.entries || []) {
            const chance = Number(entry.chance) || 0;
            if (Math.random() * 100 > chance) continue;
            const qty = randInt(Math.max(1, Number(entry.min) || 1), Math.max(1, Number(entry.max) || Number(entry.min) || 1));
            if (this.grantItem(entry.itemId, qty)) granted.push(`${itemDisplayName(game, entry.itemId)} x${qty}`);
          }
          const rareChance = table?.rarePool?.length ? 7 : 0;
          if (rareChance && Math.random() * 100 <= rareChance) {
            const id = table.rarePool[randInt(0, table.rarePool.length - 1)];
            if (this.grantItem(id, 1)) granted.push(`${itemDisplayName(game, id)} x1`);
          }
          if (!granted.length && !gold && game.generateLoot) {
            const item = game.generateLoot({ level: game.player?.level || 1, name: table?.name || 'Event Chest' }, false);
            if (game.addItem(item)) granted.push(item.name);
          }
          if (game.updateUI) game.updateUI();
          const parts = [];
          if (gold > 0) parts.push(`${gold}g`);
          parts.push(...granted);
          return { gold, items: granted, summary: parts.length ? parts.join(', ') : 'nothing' };
        },

        grantItem(itemId, qty = 1) {
          if (game.grantEditorItem) return Boolean(game.grantEditorItem(itemId, qty).ok);
          const draft = itemDraft(game, itemId);
          if (!draft) return false;
          const item = inventoryItemFromDraft(game, draft, qty);
          if (!item) return false;
          if (item.material) return game.addMaterialItem?.(item.data) || false;
          return game.addItem?.(item) || false;
        },

        shopItemIds(shopId) {
          const defaults = SHOP_ITEM_LISTS.shop_camp_basic_goods;
          const list = (shopId === 'general_goods' ? SHOP_ITEM_LISTS.shop_camp_basic_goods : SHOP_ITEM_LISTS[shopId]) || defaults;
          return list.filter(id => itemDraft(game, id));
        },

        openShop(node) {
          this.shopPanel = ensureShopWindow(this);
          this.activeShop = {
            id: node.shopId || commandList(node).find(cmd => cmd.shopId)?.shopId || 'general_goods',
            name: node.name || 'Event Shop',
            node
          };
          this.activeShopTab = 'buy';
          setWindowAnchor(this, node);
          this.renderShop();
          this.shopPanel.style.display = 'block';
          game.log(`${this.activeShop.name} opened.`);
          return true;
        },

        closeShop() {
          if (this.shopPanel) this.shopPanel.style.display = 'none';
          const legacySellPanel = document.getElementById('vendorPanel');
          if (legacySellPanel) legacySellPanel.remove();
          this.activeShop = null;
          this.activeShopTab = 'buy';
        },

        // V0.18.99: returns the shop BUY price in COPPER. Authored item values are on the SILVER scale
        // and the shop takes a x2 margin, so silver->copper (x100) is applied here. Previously this
        // returned a raw number that was then spent via spendGold() (x10,000) - a 100x overcharge that
        // made a basic hood cost ~950 level-8 kills.
        itemPrice(draft) {
          const silver = Math.max(1, Math.floor(Number(draft.sellValue || draft.value || 1) * 2));
          return game.silverToCopper ? game.silverToCopper(silver) : silver * 100;
        },

        shopSellRows() {
          return game.collectVendorSellRows?.() || [];
        },

        renderShop() {
          if (!this.shopPanel || !this.activeShop) return;
          const legacySellPanel = document.getElementById('vendorPanel');
          if (legacySellPanel) legacySellPanel.remove();
          const title = this.shopPanel.querySelector('[data-shop-title]');
          const subtitle = this.shopPanel.querySelector('[data-shop-subtitle]');
          const meta = this.shopPanel.querySelector('[data-shop-meta]');
          const body = this.shopPanel.querySelector('[data-shop-body]');
          const tab = this.activeShopTab === 'sell' ? 'sell' : 'buy';
          if (title) title.textContent = this.activeShop.name;
          if (subtitle) subtitle.textContent = `Shop ID: ${this.activeShop.id}`;
          if (meta) meta.textContent = `${game.moneyText ? game.moneyText() : `${game.player?.gold || 0}g`} · ${tab === 'buy' ? 'Buy vendor goods.' : 'Sell bag items with one click.'}`;
          this.shopPanel.querySelectorAll('[data-shop-tab]').forEach(btn => {
            const active = btn.dataset.shopTab === tab;
            btn.classList.toggle('active', active);
            btn.style.borderColor = active ? '#d8b36a' : '';
            btn.style.boxShadow = active ? '0 0 0 1px rgba(255,222,134,0.32) inset' : '';
          });
          if (!body) return;
          if (tab === 'sell') {
            const rows = this.shopSellRows();
            body.innerHTML = rows.length ? rows.map((row, i) => `
              <article class="systemPanel itemSlot" data-tooltip-shop-sell="${i}" style="margin-top:8px;--rarity-color:${escapeHtml(row.item?.rarity?.color || row.item?.icon?.color || '#cfdac8')};--icon-color:${escapeHtml(row.item?.rarity?.color || row.item?.icon?.color || '#cfdac8')}">
                <div style="display:grid;grid-template-columns:42px 1fr auto auto;gap:10px;align-items:center">
                  ${game.itemIconHtml?.(row.item, 'inventoryIcon') || ''}
                  <div>
                    <h3>${escapeHtml(row.item.name || 'Item')}</h3>
                    <div class="small">Qty ${row.qty} · ${escapeHtml(row.item.rarity?.label || row.item.rarity?.key || row.item.rarity || 'Common')}</div>
                  </div>
                  <div class="small">${game.formatCopper ? game.formatCopper(row.value) : `${row.value}c`}</div>
                  <button data-shop-sell="${i}">Sell</button>
                </div>
              </article>
            `).join('') : '<div class="small">No sellable items in your equipped bags.</div>';
            this.cachedShopSellRows = rows;
            game.bindItemTooltips?.(body, node => this.cachedShopSellRows?.[Number(node.dataset.tooltipShopSell)]?.item || null, { source: 'vendor-sell' });
            return;
          }
          const rows = this.shopItemIds(this.activeShop.id).map(id => {
            const draft = itemDraft(game, id);
            const compiled = game.getCompiledItem?.(id) || null;
            if (!draft && !compiled) return '';
            const display = compiled || draft;
            // V0.18.99: price is COPPER; compare against copper directly (was `price * 10000`).
            const price = this.itemPrice(display);
            const canBuy = game.totalCopper ? game.totalCopper() >= price : (game.player?.gold || 0) * 10000 >= price;
            return `
              <article class="systemPanel itemSlot" data-tooltip-shop-buy="${escapeHtml(id)}" style="margin-top:8px;--rarity-color:${escapeHtml(display.rarity?.color || display.icon?.color || '#cfdac8')};--icon-color:${escapeHtml(display.rarity?.color || display.icon?.color || '#cfdac8')}">
                <div style="display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:start">
                  ${game.itemIconHtml?.(display, 'inventoryIcon') || ''}
                  <div>
                    <h3>${escapeHtml(display.name || id)}</h3>
                    <div class="small">${escapeHtml(display.type || 'item')} · ${escapeHtml(display.rarityKey || display.rarity || 'white')} · ${escapeHtml(game.formatCopper ? game.formatCopper(price) : `${price}c`)}</div>
                    <div class="small" style="margin-top:6px">${escapeHtml(display.description || 'No description.')}</div>
                  </div>
                  <button data-shop-buy="${escapeHtml(id)}" ${canBuy ? '' : 'disabled'}>Buy</button>
                </div>
              </article>
            `;
          }).join('');
          body.innerHTML = rows || '<div class="small">This shop has no valid editor item drafts.</div>';
          game.bindItemTooltips?.(body, node => {
            const id = node.dataset.tooltipShopBuy;
            return id ? (game.getCompiledItem?.(id) || itemDraft(game, id) || null) : null;
          }, { source: 'vendor-buy' });
        },

        sellShopItem(rowIndex) {
          if (!this.activeShop || interactionWindowInvalid(this, this.activeShop.node, 3.25)) {
            this.closeShop();
            game.log('Vendor is too far away.', 'System');
            return false;
          }
          const row = (this.cachedShopSellRows || this.shopSellRows())[rowIndex];
          if (!row) return false;
          const ok = game.vendorSellRow?.(row) || false;
          this.renderShop();
          return ok;
        },

        buyShopItem(itemId) {
          if (!this.activeShop || interactionWindowInvalid(this, this.activeShop.node, 3.25)) {
            this.closeShop();
            game.log('Vendor is too far away.', 'System');
            return false;
          }
          const draft = itemDraft(game, itemId);
          const compiled = game.getCompiledItem?.(itemId) || null;
          if ((!draft && !compiled) || !game.player) return false;
          // V0.18.99: price is COPPER - pay with spendCopper and report via formatCopper.
          const price = this.itemPrice(draft || compiled);
          const canPay = game.spendCopper ? game.totalCopper() >= price : (game.player.gold || 0) * 10000 >= price;
          if (!canPay) {
            game.log('Not enough money.');
            return false;
          }
          const result = game.grantEditorItem?.(itemId, 1, { rarityKey: compiled?.rarityKey || draft?.rarity || 'white' }) || { ok: false };
          if (!result.ok) return false;
          if (game.spendCopper) game.spendCopper(price);
          else game.player.gold -= Math.ceil(price / 10000);
          game.updateUI?.();
          this.renderShop();
          game.log(`Bought ${compiled?.name || draft?.name || itemId} for ${game.formatCopper ? game.formatCopper(price) : `${price}c`}.`);
          return true;
        },

        executeWarp(node, options = {}) {
          if (!game.player) return false;
          const targetZone = String(node.targetZone || commandList(node).find(cmd => cmd.targetZone)?.targetZone || '').toLowerCase();
          const targetX = Number(node.targetX ?? commandList(node).find(cmd => cmd.targetX !== undefined)?.targetX);
          const targetY = Number(node.targetY ?? commandList(node).find(cmd => cmd.targetY !== undefined)?.targetY);
          const hasTargetXY = Number.isFinite(targetX) && Number.isFinite(targetY);

          if ((targetZone === 'mossfang_cave' || targetZone === 'cave') && game.currentZone !== 'cave') {
            game.enterCave?.({ x: Math.floor(game.player.x), y: Math.floor(game.player.y), radius: 1, name: node.name || 'Event Warp' });
            return true;
          }
          if ((targetZone === 'dark_woods' || targetZone === 'overworld') && game.currentZone === 'cave') {
            game.exitCave?.();
            return true;
          }

          if (hasTargetXY) {
            game.player.x = clamp(targetX, 1, (DR.CONFIG?.MAP_SIZE || 200) - 2);
            game.player.y = clamp(targetY, 1, (DR.CONFIG?.MAP_SIZE || 200) - 2);
            if (game.merc) { game.merc.x = game.player.x + 1.1; game.merc.y = game.player.y + 0.8; }
            if (game.pet) { game.pet.x = game.player.x - 0.8; game.pet.y = game.player.y + 0.8; }
            game.camera.x = game.player.x;
            game.camera.y = game.player.y;
            game.mapDirty = true;
            game.spawnRing?.(game.player.x, game.player.y, '#fff08a', 28);
            game.log(`Warped to ${Math.floor(game.player.x)}, ${Math.floor(game.player.y)}.`);
            return true;
          }

          const spawn = game.editorSpawnPoints?.[zoneKey(game)] || { x: DR.CONFIG?.START_X || 100, y: DR.CONFIG?.START_Y || 100 };
          game.player.x = Number(spawn.x) || (DR.CONFIG?.START_X || 100);
          game.player.y = Number(spawn.y) || (DR.CONFIG?.START_Y || 100);
          if (game.merc) { game.merc.x = game.player.x + 1.1; game.merc.y = game.player.y + 0.8; }
          if (game.pet) { game.pet.x = game.player.x - 0.8; game.pet.y = game.player.y + 0.8; }
          game.camera.x = game.player.x;
          game.camera.y = game.player.y;
          game.mapDirty = true;
          if (!options.auto) game.log('Warped to zone spawn point.');
          game.spawnRing?.(game.player.x, game.player.y, '#fff08a', 28);
          return true;
        }
      };

      runtime.init();
      return runtime;
    }
  });
})();
