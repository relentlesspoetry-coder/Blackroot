// Dream Realms item editor runtime compiler
// Modular Pass 42: editor item drafts compile into usable runtime inventory, equipment, consumables, and loot/crafting/vendor outputs.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const normalizeId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const titleCaseFromId = value => String(value || '')
    .replace(/^item_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());

  const TYPE_ALIASES = {
    material: 'resource',
    crafting: 'resource',
    reagent: 'resource',
    food: 'consumable',
    potion: 'consumable',
    equip: 'equipment',
    equipment: 'equipment',
    armour: 'armor',
    trinket: 'accessory'
  };

  const SLOT_ALIASES = {
    none: 'none',
    no_slot: 'none',
    material: 'material',
    resource: 'material',
    consumable: 'consumable',
    mainhand: 'weapon',
    main_hand: 'weapon',
    off_hand: 'offhand',
    shield: 'offhand',
    body: 'chest',
    torso: 'chest',
    robe: 'chest',
    helm: 'head',
    helmet: 'head',
    shoulders: 'shoulders',
    shoulder: 'shoulders',
    pauldrons: 'shoulders',
    pauldron: 'shoulders',
    mantle: 'shoulders',
    gloves: 'hands',
    hand: 'hands',
    pants: 'legs',
    leg: 'legs',
    boots: 'feet',
    boot: 'feet',
    ring: 'ring1',
    ring1: 'ring1',
    ring_1: 'ring1',
    ring_l: 'ring1',
    ring_left: 'ring1',
    ring2: 'ring2',
    ring_2: 'ring2',
    ring_r: 'ring2',
    ring_right: 'ring2',
    earring: 'earring1',
    earring1: 'earring1',
    earring_1: 'earring1',
    earring_l: 'earring1',
    earring_left: 'earring1',
    earring2: 'earring2',
    earring_2: 'earring2',
    earring_r: 'earring2',
    earring_right: 'earring2',
    necklace: 'amulet',
    neck: 'amulet',
    cape: 'cape',
    cloak: 'cape',
    back: 'cape',
    trinket: 'charm',
    relic: 'charm',
    waist: 'belt',
    belt: 'belt',
    sash: 'belt'
  };

  function rarityByKey(key, fallbackKey = 'white') {
    return (DR.RARITIES || []).find(r => r.key === key)
      || (DR.RARITIES || []).find(r => r.key === fallbackKey)
      || (DR.RARITIES || [])[0]
      || { key: fallbackKey, label: titleCaseFromId(fallbackKey), color: '#d8ded1', stat: 1, affixes: 0 };
  }

  function normalizeType(type) {
    const raw = normalizeId(type || 'resource');
    return TYPE_ALIASES[raw] || raw || 'resource';
  }

  function normalizeSlot(slot, type) {
    const raw = normalizeId(slot || 'none');
    const mapped = SLOT_ALIASES[raw] || raw;
    const equipSlots = new Set(DR.EQUIP_SLOTS || []);
    if (equipSlots.has(mapped)) return mapped;
    const normalizedType = normalizeType(type);
    if (normalizedType === 'weapon') return 'weapon';
    if (normalizedType === 'armor') return 'chest';
    if (normalizedType === 'accessory') return 'charm';
    if (normalizedType === 'consumable') return 'consumable';
    if (normalizedType === 'quest') return 'quest';
    if (normalizedType === 'currency') return 'currency';
    return mapped === 'material' ? 'material' : 'none';
  }

  function runtimeKindFor(type, slot) {
    if (type === 'consumable') return 'consumable';
    if (type === 'quest') return 'quest';
    if (type === 'currency') return 'currency';
    if (type === 'resource' || type === 'material') return 'material';
    if ((DR.EQUIP_SLOTS || []).includes(slot) || ['weapon', 'armor', 'accessory', 'equipment'].includes(type)) return 'equipment';
    return 'material';
  }

  function normalizeStats(stats) {
    const out = {};
    for (const [key, value] of Object.entries(stats || {})) {
      const n = safeNumber(value, 0);
      if (!n) continue;
      out[key] = key === 'speed' ? Number(n.toFixed(2)) : Math.floor(n);
    }
    return out;
  }

  function scaleStats(stats, scale) {
    const out = {};
    for (const [key, value] of Object.entries(stats || {})) {
      const raw = safeNumber(value, 0) * scale;
      if (!raw) continue;
      out[key] = key === 'speed' ? Number(raw.toFixed(2)) : Math.max(1, Math.floor(raw));
    }
    return out;
  }

  function normalizeUseEffect(draft, runtimeKind) {
    const explicit = draft.useEffect || draft.consumeEffect || draft.effect || null;
    const effect = explicit && typeof explicit === 'object' ? cloneJson(explicit) : {};
    if (runtimeKind === 'consumable') {
      const stats = draft.stats || {};
      if (effect.hp == null && effect.heal == null && stats.hp) effect.hp = Math.max(1, Math.floor(safeNumber(stats.hp, 0)));
      if (effect.mana == null && effect.restoreMana == null && stats.mana) effect.mana = Math.max(1, Math.floor(safeNumber(stats.mana, 0)));
    }
    return effect;
  }

  function compileOne(game, draft, errors) {
    if (!draft || typeof draft !== 'object') return null;
    const id = String(draft.id || '').trim();
    if (!id) {
      errors.push('Item draft missing id.');
      return null;
    }

    const type = normalizeType(draft.type || 'resource');
    const slot = normalizeSlot(draft.slot, type);
    const runtimeKind = runtimeKindFor(type, slot);
    const rarityKey = rarityByKey(draft.rarity || 'white').key;
    const stackSize = runtimeKind === 'equipment'
      ? 1
      : Math.max(1, Math.floor(safeNumber(draft.stackSize ?? draft.maxStack ?? draft.stack, runtimeKind === 'currency' ? 999 : 99)));
    const allClasses = Object.keys(DR.CLASSES || {});
    const classes = Array.isArray(draft.classRestrictions) && draft.classRestrictions.length
      ? [...new Set(draft.classRestrictions.map(value => String(value || '').trim()).filter(Boolean))]
      : allClasses;

    if (runtimeKind === 'equipment' && !(DR.EQUIP_SLOTS || []).includes(slot)) {
      errors.push(`${id}: invalid equipment slot "${draft.slot || slot}".`);
    }

    return {
      id,
      sourceId: id,
      name: String(draft.name || titleCaseFromId(id)).trim(),
      baseName: String(draft.name || titleCaseFromId(id)).trim(),
      type,
      slot: runtimeKind === 'equipment' ? slot : (runtimeKind === 'consumable' ? 'consumable' : runtimeKind),
      draftSlot: draft.slot || 'none',
      runtimeKind,
      rarityKey,
      rarity: rarityByKey(rarityKey),
      levelRequirement: Math.max(1, Math.floor(safeNumber(draft.levelRequirement ?? draft.level, 1))),
      classes,
      stats: normalizeStats(draft.stats || {}),
      damage: draft.damage ? cloneJson(draft.damage) : null,
      armor: Math.max(0, Math.floor(safeNumber(draft.armor, 0))),
      sellValue: Math.max(0, Math.floor(safeNumber(draft.sellValue ?? draft.value, 1))),
      value: Math.max(1, Math.floor(safeNumber(draft.sellValue ?? draft.value, 1))),
      stackSize,
      maxStack: stackSize,
      icon: cloneJson(draft.icon || {}),
      description: String(draft.description || ''),
      editorNote: String(draft.editorNote || ''),
      useEffect: normalizeUseEffect(draft, runtimeKind),
      questItem: type === 'quest' || Boolean(draft.questItem),
      protected: Boolean(draft.protected || draft.noSell || draft.soulbound),
      soulbound: Boolean(draft.soulbound),
      bound: Boolean(draft.bound),
      // Phase 8b (Intersect parity): explicit two-handed flag, consumed by
      // isRogueDualWieldWeapon (systems/inventory-system.js) ahead of its
      // existing name-regex fallback, which stays in place for legacy data.
      twoHanded: Boolean(draft.twoHanded || draft.hands === 2),
      // Phase 8b: optional consumable-use cooldown and an existing-spell
      // reference a consumable can trigger. Both are 0/null (fully inert)
      // unless a draft explicitly sets them.
      cooldownMs: Math.max(0, Math.floor(safeNumber(draft.cooldownMs, 0))),
      cooldownGroup: draft.cooldownGroup ? String(draft.cooldownGroup).trim() : null,
      castsSpellId: draft.castsSpellId ? String(draft.castsSpellId).trim() : null,
      // V0.18.70 (Roadmap Item 3 E / 13 / 8): carry the effect-policy category and the armour type
      // through compilation. effectCategory was being dropped, so a consumable's shared cooldown
      // group (DR.effectPolicy.cooldownGroupFor) never resolved at runtime and the crafting panel
      // could not tell a potion from a meal. armorType is forward-looking for armour proficiency.
      effectCategory: draft.effectCategory ? String(draft.effectCategory).trim() : null,
      armorType: draft.armorType ? String(draft.armorType).trim() : null,
      compiledAt: Date.now()
    };
  }

  DR.ItemCompilerSystem = {
    install(Game) {
      Game.prototype.markItemCatalogDirty = function(reason = '') {
        this.itemCatalogDirty = true;
        this.itemCompilerDirtyReason = reason;
      };

      Game.prototype.rebuildRuntimeItemCatalog = function() {
        const source = this.editorItems && typeof this.editorItems === 'object' ? this.editorItems : (DR.ITEM_BY_ID || {});
        const compiled = {};
        const errors = [];
        for (const draft of Object.values(source)) {
          const item = compileOne(this, draft, errors);
          if (item) compiled[item.id] = item;
        }
        this.compiledItems = compiled;
        this.compiledItemById = compiled;
        this.itemCompilerErrors = errors;
        this.itemCatalogDirty = false;
        DR.Registry?.recordCompilerErrors?.('item', errors);
        return compiled;
      };

      Game.prototype.ensureRuntimeItemCatalog = function() {
        if (!this.compiledItemById || this.itemCatalogDirty) this.rebuildRuntimeItemCatalog();
        return this.compiledItemById || {};
      };

      Game.prototype.getCompiledItem = function(itemId) {
        if (!itemId) return null;
        const catalog = this.ensureRuntimeItemCatalog();
        return catalog[itemId] || null;
      };

      Game.prototype.compileItemDraftForRuntime = function(draft) {
        const errors = [];
        return compileOne(this, draft, errors);
      };

      Game.prototype.normalizeItemDraftSlot = function(slot, type) {
        return normalizeSlot(slot, type);
      };

      Game.prototype.createRuntimeItemInstance = function(itemOrId, qty = 1, options = {}) {
        const compiled = typeof itemOrId === 'string'
          ? this.getCompiledItem(itemOrId)
          : compileOne(this, itemOrId, []);
        if (!compiled) return null;

        const rarityKey = options.rarity?.key || options.rarityKey || compiled.rarityKey || 'white';
        const rarity = this.runtimeRarity?.(rarityKey, compiled.rarityKey || 'white') || rarityByKey(rarityKey, compiled.rarityKey || 'white');
        const baseRarity = compiled.rarityKey || 'white';
        const statScale = compiled.runtimeKind === 'equipment' ? Math.max(0.2, safeNumber(rarity.stat, 1)) : 1;
        const stack = Math.max(1, Math.floor(safeNumber(qty, 1)));
        const name = compiled.runtimeKind === 'equipment' && rarity.key !== baseRarity
          ? `${rarity.label} ${compiled.name}`
          : compiled.name;

        if (compiled.runtimeKind === 'equipment') {
          return {
            id: this.itemSerial++,
            itemId: compiled.id,
            sourceItemId: compiled.id,
            kind: 'equipment',
            name,
            baseName: compiled.baseName || compiled.name,
            type: compiled.type,
            slot: compiled.slot,
            classes: [...compiled.classes],
            rarity,
            rarityKey: rarity.key,
            stats: scaleStats(compiled.stats, statScale),
            damage: compiled.damage ? cloneJson(compiled.damage) : null,
            armor: Math.max(0, Math.floor(compiled.armor * statScale)),
            armorType: compiled.armorType || null,
            twoHanded: Boolean(compiled.twoHanded),
            level: Math.max(1, Math.floor(safeNumber(options.level ?? options.sourceLevel ?? compiled.levelRequirement, compiled.levelRequirement))),
            levelRequirement: compiled.levelRequirement,
            value: Math.max(1, Math.floor(compiled.value * statScale)),
            description: compiled.description,
            icon: cloneJson(compiled.icon || {}),
            questItem: Boolean(compiled.questItem),
            protected: Boolean(compiled.protected),
            soulbound: Boolean(compiled.soulbound),
            bound: Boolean(compiled.bound),
            compiled: true
          };
        }

        return {
          id: this.itemSerial++,
          itemId: compiled.id,
          sourceItemId: compiled.id,
          kind: compiled.runtimeKind,
          name: compiled.name,
          baseName: compiled.baseName || compiled.name,
          category: compiled.type === 'resource' ? 'Resource' : titleCaseFromId(compiled.type),
          type: compiled.type,
          slot: compiled.slot,
          rarity,
          rarityKey: rarity.key,
          stats: cloneJson(compiled.stats || {}),
          level: compiled.levelRequirement,
          levelRequirement: compiled.levelRequirement,
          stack,
          maxStack: compiled.stackSize,
          value: compiled.value,
          description: compiled.description,
          icon: cloneJson(compiled.icon || {}),
          questItem: Boolean(compiled.questItem),
          protected: Boolean(compiled.protected),
          soulbound: Boolean(compiled.soulbound),
          bound: Boolean(compiled.bound),
          useEffect: cloneJson(compiled.useEffect || {}),
          cooldownMs: compiled.cooldownMs || 0,
          cooldownGroup: compiled.cooldownGroup || null,
          castsSpellId: compiled.castsSpellId || null,
          // V0.18.70: carry the effect-policy category onto the instance so the consumable-use
          // cooldown routing (item.effectCategory -> shared cooldown group) actually resolves.
          effectCategory: compiled.effectCategory || null,
          slots: compiled.runtimeKind === 'bag' ? Math.max(4, Math.floor(safeNumber(compiled.bagSlots || compiled.stats?.slots || compiled.stackSize || 8, 8))) : undefined,
          bagSlots: compiled.runtimeKind === 'bag' ? Math.max(4, Math.floor(safeNumber(compiled.bagSlots || compiled.stats?.slots || compiled.stackSize || 8, 8))) : undefined,
          compiled: true
        };
      };

      Game.prototype.runtimeStackKey = function(item) {
        if (!item) return '';
        return [item.itemId || item.sourceItemId || item.name, item.kind || 'item', item.rarity?.key || item.rarityKey || 'white'].join('|');
      };

      Game.prototype.isRuntimeStackItem = function(item) {
        return item && ['material', 'resource', 'consumable', 'quest', 'currency'].includes(item.kind || item.type || '');
      };

      Game.prototype.addCompiledItem = function(item) {
        if (!item) return false;
        if (!this.isRuntimeStackItem?.(item)) return this.addItem?.(item) || false;

        const maxStack = Math.max(1, Math.floor(safeNumber(item.maxStack || item.stackSize || 99, 99)));
        let remaining = Math.max(1, Math.floor(safeNumber(item.stack, 1)));
        const key = this.runtimeStackKey(item);

        for (const existing of this.inventory || []) {
          if (!this.isRuntimeStackItem?.(existing)) continue;
          if (this.runtimeStackKey(existing) !== key) continue;
          const current = Math.max(1, Math.floor(safeNumber(existing.stack, 1)));
          const space = Math.max(0, Math.max(maxStack, current) - current);
          if (!space) continue;
          const moved = Math.min(space, remaining);
          existing.stack = current + moved;
          existing.maxStack = Math.max(maxStack, existing.maxStack || 0);
          remaining -= moved;
          this.notifyExternalSystems?.('item-gained', { itemId: item.itemId, name: item.name, qty: moved, item: existing });
          if (remaining <= 0) break;
        }

        while (remaining > 0) {
          if ((this.inventory || []).length >= (this.getBagCapacity ? this.getBagCapacity() : (DR.CONFIG?.BAG_SIZE || 36))) {
            if (this.player) this.addGold ? this.addGold(Math.max(1, item.value || 1) * remaining) : (this.player.gold += Math.max(1, item.value || 1) * remaining);
            this.log?.(`Bags full. ${item.name} overflow sold.`);
            break;
          }
          const moved = Math.min(maxStack, remaining);
          const copy = cloneJson(item);
          copy.id = this.itemSerial++;
          copy.stack = moved;
          copy.maxStack = maxStack;
          this.inventory.push(copy);
          this.notifyExternalSystems?.('item-gained', { itemId: copy.itemId, name: copy.name, qty: moved, item: copy });
          remaining -= moved;
        }

        this.bagDirty = true;
        if (this.bagOpen) this.renderBag?.();
        return true;
      };

      Game.prototype.useInventoryItem = function(index) {
        const item = this.inventory?.[index];
        if (!item) return false;
        if ((item.kind || '') !== 'consumable') return this.equipInventoryItem?.(index) || false;
        if (!this.player || !this.player.alive) return false;
        // Phase 8b (Intersect parity): optional per-item/cooldown-group use
        // throttle. cooldownMs is 0 for every item shipped today, so this
        // check is a no-op unless a future item explicitly opts in.
        // V0.18.66 (Roadmap Item 13): a categorized consumable (item.effectCategory, e.g. a future
        // food or potion) shares its category's cooldown group from the central effect policy, so
        // copies/stacks can't bypass the cooldown. Inert for current items (none set effectCategory
        // today), and an explicit item.cooldownGroup still wins.
        const effectPolicy = window.DreamRealms?.effectPolicy;
        const cooldownKey = item.cooldownGroup || (item.effectCategory && effectPolicy?.cooldownGroupFor?.(item.effectCategory)) || item.itemId;
        if (item.cooldownMs > 0 && cooldownKey) {
          const remaining = Number(this.player.itemCooldowns?.[cooldownKey] || 0);
          if (remaining > 0) {
            this.log?.(`${item.name} is still recovering (${remaining.toFixed(1)}s).`);
            return false;
          }
        }
        const effect = item.useEffect || {};
        const hp = Math.max(0, Math.floor(safeNumber(effect.hp ?? effect.heal ?? item.stats?.hp, 0)));
        const mana = Math.max(0, Math.floor(safeNumber(effect.mana ?? effect.restoreMana ?? item.stats?.mana, 0)));
        // V0.18.67 (Roadmap Item 3): a consumable can grant a temporary buff (foods, buff potions).
        // This was defined in item data but never applied - the food buffs were dead. The buff
        // carries its own effectCategory (e.g. 'food'), so DR.effectPolicy governs its concurrency
        // and stacking: eating a second food replaces the first food buff rather than stacking.
        const buff = effect.buff && typeof effect.buff === 'object' ? effect.buff : null;
        // Phase 8b: optional cast-an-existing-spell-on-use. Scoped to self/
        // friendly spells only this phase - an item referencing an offensive
        // spell is refused with a clear message instead of guessing a
        // target, since hostile-target validation (resolveHostileSpellTarget,
        // systems/combat-system.js) expects a UI-selected target and item use
        // has none. No shipped item sets castsSpellId today, so this whole
        // branch is inert until content opts in.
        let spell = null;
        if (item.castsSpellId) {
          spell = this.getCompiledSpellById?.(item.castsSpellId) || null;
          if (!spell) {
            this.log?.(`${item.name} references an unknown spell.`);
          } else if (this.isOffensiveSpellKind?.(spell.kind) || spell.requiresTarget) {
            this.log?.(`${item.name} cannot be used this way yet.`);
            spell = null;
          } else if (this.isSilenced?.(this.player)) {
            this.log?.(`You cannot use ${item.name} while silenced.`);
            return false;
          } else if (this.isActionLocked?.(this.player)) {
            this.log?.('You cannot act while stunned.');
            return false;
          }
        }
        // V0.20.70 (Roadmap Item 7): a consumable can unlock a mount. Routed through
        // mountSystem.unlockMount so a bought mount is recorded, saved and displayed exactly like a
        // tamed one - there is no second ownership path to keep in sync.
        const mountId = String(effect.unlocksMountId || '');
        if (mountId) {
          const sys = this.mountSystem;
          const def = window.DreamRealms?.MOUNT_BY_ID?.[mountId];
          if (!sys || !def) { this.log?.(`${item.name} does not seem to call anything.`); return false; }
          if (sys.isUnlocked(mountId)) { this.log?.(`You already have a ${def.name}.`); return false; }
          sys.unlockMount(mountId, { source: 'Dead Lantern Camp', method: 'Bought from the quartermaster', level: this.player?.level || 1 });
          this.log?.(`${def.name} is yours. Press the mount key to ride.`);
          return true;
        }
        if (!hp && !mana && !spell && !buff) {
          this.log?.(`${item.name} has no usable effect yet.`);
          return false;
        }
        let changed = false;
        if (hp && this.healEntity) changed = Boolean(this.healEntity(this.player, hp, false)) || changed;
        if (mana && this.restoreMana) changed = Boolean(this.restoreMana(this.player, mana)) || changed;
        if (spell) {
          this.resolveClassSpell?.(spell, { target: this.player, targetId: this.player.id });
          changed = true;
        }
        if (buff && this.applyStatusEffect) {
          const buffEffect = Object.assign({}, buff);
          buffEffect.id = buff.id || (item.itemId ? `${item.itemId}_buff` : 'consumable_buff');
          buffEffect.name = buff.name || `${item.name} Buff`;
          buffEffect.type = buff.type || 'buff';
          buffEffect.duration = Math.max(1, safeNumber(buff.duration, 60));
          buffEffect.effectCategory = buff.effectCategory || item.effectCategory || null;
          buffEffect.color = buff.color || (item.icon && item.icon.color) || '#8fe47d';
          changed = Boolean(this.applyStatusEffect(this.player, buffEffect, this.player)) || changed;
        }
        if (!changed) {
          this.log?.(`${item.name} had no effect.`);
          return false;
        }
        item.stack = Math.max(0, Math.floor(safeNumber(item.stack, 1)) - 1);
        if (item.stack <= 0) this.inventory.splice(index, 1);
        if (item.cooldownMs > 0 && cooldownKey) {
          if (!this.player.itemCooldowns) this.player.itemCooldowns = {};
          this.player.itemCooldowns[cooldownKey] = item.cooldownMs / 1000;
        }
        this.spawnRing?.(this.player.x, this.player.y, '#78d0a0', 12);
        this.log?.(`Used ${item.name}.`);
        this.bagDirty = true;
        if (this.bagOpen) this.renderBag?.();
        this.updateUI?.();
        return true;
      };
    }
  };
})();
