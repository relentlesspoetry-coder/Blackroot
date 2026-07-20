// Dream Realms runtime loot system
// Modular Pass 40: centralizes runtime loot-table rolling for mobs, event chests, resources, dungeon elites, and bosses.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  const cloneJson = value => JSON.parse(JSON.stringify(value ?? null));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const normalizeId = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function chancePass(chance) {
    return Math.random() * 100 <= Math.max(0, safeNumber(chance, 0));
  }

  DR.LootSystem = {
    install(Game) {
      const {
        RARITIES,
        CLASSES,
        CLASS_ARCHETYPES,
        LOOT_BASES,
        AFFIXES
      } = DR;
      const { clamp } = DR.utils;

      Game.prototype.runtimeRarity = function(key, fallbackKey = 'white') {
        return (RARITIES || []).find(r => r.key === key) || (RARITIES || []).find(r => r.key === fallbackKey) || (RARITIES || [])[0] || { key: 'white', label: 'Common', color: '#d8ded1', stat: 1, affixes: 0 };
      };

      Game.prototype.chooseRarity = function(forceCommon = false) {
        if (forceCommon) return this.runtimeRarity('white');
        const total = (RARITIES || []).reduce((sum, r) => sum + safeNumber(r.weight, 0), 0);
        let roll = Math.random() * Math.max(1, total);
        for (const rarity of RARITIES || []) {
          roll -= safeNumber(rarity.weight, 0);
          if (roll <= 0) return rarity;
        }
        return this.runtimeRarity('grey');
      };

      Game.prototype.chooseLootTableRarity = function(weights, fallbackKey = 'white') {
        if (!weights || typeof weights !== 'object') return this.runtimeRarity(fallbackKey);
        const entries = Object.entries(weights).filter(([, value]) => safeNumber(value, 0) > 0);
        const total = entries.reduce((sum, [, value]) => sum + safeNumber(value, 0), 0);
        if (total <= 0) return this.runtimeRarity(fallbackKey);
        let roll = Math.random() * total;
        for (const [key, value] of entries) {
          roll -= safeNumber(value, 0);
          if (roll <= 0) return this.runtimeRarity(key, fallbackKey);
        }
        return this.runtimeRarity(fallbackKey);
      };

      Game.prototype.getEditorItemDraft = function(itemId) {
        return this.editorItems?.[itemId] || DR.ITEM_BY_ID?.[itemId] || null;
      };

      Game.prototype.getLootTableById = function(tableId, fallbackId = 'loot_common_chest') {
        if (tableId && typeof tableId === 'object') return tableId;
        const normalized = tableId === 'common_chest' ? 'loot_common_chest' : tableId;
        return this.editorLootTables?.[normalized] || DR.LOOT_TABLE_BY_ID?.[normalized] || this.editorLootTables?.[fallbackId] || DR.LOOT_TABLE_BY_ID?.[fallbackId] || null;
      };

      Game.prototype.resolveLootTableIdForEnemy = function(enemy) {
        const explicit = enemy?.lootTableId || enemy?.baseType?.lootTableId || enemy?.baseType?.lootTable;
        if (explicit) return explicit;

        const baseName = enemy?.baseType?.name || enemy?.name || '';
        const normalized = normalizeId(baseName);
        const mobDefs = this.editorMobDefinitions || DR.MOB_DRAFT_BY_ID || {};
        for (const draft of Object.values(mobDefs)) {
          if (!draft) continue;
          if (normalizeId(draft.name) === normalized && draft.lootTableId) return draft.lootTableId;
        }

        if (enemy?.dungeonBoss && enemy?.bossId) return enemy.lootTableId || `loot_${enemy.bossId}`;
        if (enemy?.dungeonElite || this.currentZone === 'dungeon') return enemy?.lootTableId || 'loot_dungeon_elite_mobs';
        if (this.currentZone === 'cave') return this.currentCave?.lootTableId || enemy?.caveLootTableId || enemy?.lootTableId || 'loot_mossfang_cave_mobs';
        if (/widow|spider|mossfang|cave/i.test(baseName)) return 'loot_mossfang_cave_mobs';
        return 'loot_dark_woods_common_mobs';
      };

      Game.prototype.generateLoot = function(source, forceCommon = false) {
        const rarity = this.chooseRarity(forceCommon);
        const className = this.player?.className || 'Fighter';
        const pool = (LOOT_BASES || []).filter(base => base.classes.includes(className) || base.classes.length === Object.keys(CLASSES || {}).length);
        const base = pool[randInt(0, Math.max(0, pool.length - 1))] || (LOOT_BASES || [])[0] || { name: 'Old Charm', slot: 'charm', classes: Object.keys(CLASSES || {}), stats: { hp: 1 } };
        const level = clamp((source?.level || this.player?.level || 1) + randInt(-1, 1), 1, 20);
        const stats = {};
        const levelScale = 1 + level * 0.08;
        for (const [stat, value] of Object.entries(base.stats || {})) {
          const raw = value * rarity.stat * levelScale;
          stats[stat] = stat === 'speed' ? Number(raw.toFixed(2)) : Math.max(1, Math.floor(raw));
        }

        const affixNames = [];
        const used = new Set();
        for (let i = 0; i < rarity.affixes; i++) {
          const affix = (AFFIXES || [])[randInt(0, Math.max(0, (AFFIXES || []).length - 1))];
          if (!affix || used.has(affix.name)) continue;
          used.add(affix.name);
          affixNames.push(affix.name);
          for (const [stat, value] of Object.entries(affix.stats || {})) {
            const scaled = stat === 'speed' ? Number((value * rarity.stat).toFixed(2)) : Math.max(1, Math.floor(value * rarity.stat * levelScale));
            stats[stat] = (stats[stat] || 0) + scaled;
          }
        }

        const prefix = rarity.key === 'grey' ? 'Cracked' : rarity.key === 'white' ? 'Plain' : affixNames.length ? affixNames[0] : rarity.label;
        const suffix = affixNames.length > 1 ? ` of ${affixNames.slice(1).join(' and ')}` : '';
        return {
          id: this.itemSerial++,
          itemId: base.itemId || normalizeId(base.name),
          name: `${prefix} ${base.name}${suffix}`,
          baseName: base.name,
          slot: base.slot,
          classes: base.classes,
          rarity,
          stats,
          level,
          value: Math.max(1, Math.floor((level * 3 + Object.values(stats).reduce((a, b) => a + Math.abs(b), 0)) * rarity.stat))
        };
      };

      Game.prototype.createRuntimeItemFromDraft = function(draft, qty = 1, options = {}) {
        if (!draft) return null;
        if (typeof this.createRuntimeItemInstance === 'function') {
          return this.createRuntimeItemInstance(draft.id || draft, qty, options);
        }

        const stack = Math.max(1, Math.floor(safeNumber(qty, 1)));
        const materialLike = ['resource', 'quest', 'currency', 'consumable'].includes(draft.type) || draft.slot === 'none' || draft.slot === 'material';
        const rarity = materialLike
          ? this.runtimeRarity(options.rarityKey || draft.rarity || 'white')
          : (options.rarity || this.runtimeRarity(options.rarityKey || draft.rarity || 'white'));

        if (materialLike) {
          return {
            id: this.itemSerial++,
            itemId: draft.id,
            sourceItemId: draft.id,
            kind: draft.type === 'consumable' ? 'consumable' : 'material',
            name: draft.name || draft.id,
            baseName: draft.name || draft.id,
            category: draft.type || 'Resource',
            rarity,
            rarityKey: rarity.key,
            stats: cloneJson(draft.stats || {}) || {},
            level: draft.levelRequirement || 1,
            stack,
            maxStack: Math.max(1, Math.floor(safeNumber(draft.stackSize, 99))),
            value: draft.sellValue || draft.value || 1,
            description: draft.description || 'A resource from a loot table.',
            icon: cloneJson(draft.icon || null),
            questItem: draft.type === 'quest' || Boolean(draft.questItem),
            protected: Boolean(draft.protected || draft.noSell || draft.soulbound),
            soulbound: Boolean(draft.soulbound),
            bound: Boolean(draft.bound),
            classes: [],
            slot: draft.type === 'consumable' ? 'consumable' : 'material'
          };
        }

        const level = Math.max(1, Math.floor(safeNumber(draft.levelRequirement, 1)));
        const statScale = Math.max(0.2, rarity.stat || 1);
        const stats = {};
        for (const [stat, value] of Object.entries(draft.stats || {})) {
          const raw = safeNumber(value, 0) * statScale;
          stats[stat] = stat === 'speed' ? Number(raw.toFixed(2)) : Math.max(1, Math.floor(raw));
        }
        return {
          id: this.itemSerial++,
          itemId: draft.id,
          sourceItemId: draft.id,
          kind: 'equipment',
          name: rarity.key === (draft.rarity || 'white') ? (draft.name || draft.id) : `${rarity.label} ${draft.name || draft.id}`,
          baseName: draft.name || draft.id,
          slot: this.normalizeItemDraftSlot?.(draft.slot, draft.type) || draft.slot || 'charm',
          classes: Array.isArray(draft.classRestrictions) ? draft.classRestrictions : Object.keys(CLASSES || {}),
          rarity,
          rarityKey: rarity.key,
          stats,
          level,
          levelRequirement: level,
          value: Math.max(1, Math.floor(safeNumber(draft.sellValue || draft.value, 1) * statScale)),
          description: draft.description || 'An item from a loot table.',
          icon: cloneJson(draft.icon || null),
          questItem: draft.type === 'quest' || Boolean(draft.questItem),
          protected: Boolean(draft.protected || draft.noSell || draft.soulbound),
          soulbound: Boolean(draft.soulbound),
          bound: Boolean(draft.bound)
        };
      };

      Game.prototype.grantRuntimeItem = function(itemOrPack) {
        if (!itemOrPack) return false;
        if (itemOrPack.material) return this.addMaterialItem?.(itemOrPack.data) || false;
        if (this.shouldStartLootRollForItem?.(itemOrPack, { source: this.activeCorpseLootEnemy || this.player })) {
          const sessionId = this.beginLootRollForItem?.(itemOrPack, { source: this.activeCorpseLootEnemy || this.player });
          return Boolean(sessionId);
        }
        if (typeof this.addCompiledItem === 'function') return this.addCompiledItem(itemOrPack);
        return this.addItem?.(itemOrPack) || false;
      };

      Game.prototype.grantEditorItem = function(itemId, qty = 1, options = {}) {
        const draft = this.getEditorItemDraft(itemId);
        if (!draft) return { ok: false, name: itemId || 'Unknown Item', quantity: qty, itemId };
        const compiled = this.getCompiledItem?.(itemId) || null;
        const kind = compiled?.runtimeKind || null;
        const count = Math.max(1, Math.floor(qty || 1));

        if (kind && kind !== 'equipment') {
          const item = this.createRuntimeItemInstance?.(itemId, count, options) || this.createRuntimeItemFromDraft(draft, count, options);
          const ok = this.grantRuntimeItem(item);
          return { ok, name: compiled?.name || draft.name || itemId, quantity: count, itemId, rarityKey: item?.rarity?.key || options.rarityKey || compiled?.rarityKey || draft.rarity || 'white' };
        }

        const isEquipment = kind === 'equipment'
          || (!['resource', 'quest', 'currency', 'consumable'].includes(String(draft.type || '').toLowerCase()) && !['none', 'material'].includes(String(draft.slot || '').toLowerCase()));
        if (!isEquipment) {
          const item = this.createRuntimeItemFromDraft(draft, count, options);
          const ok = this.grantRuntimeItem(item);
          return { ok, name: draft.name || itemId, quantity: count, itemId };
        }

        let added = 0;
        let lastItem = null;
        for (let i = 0; i < count; i++) {
          const item = this.createRuntimeItemInstance?.(itemId, 1, options) || this.createRuntimeItemFromDraft(draft, 1, options);
          if (this.grantRuntimeItem(item)) {
            added++;
            lastItem = item;
          }
        }
        return {
          ok: added > 0,
          name: lastItem?.name || compiled?.name || draft.name || itemId,
          quantity: added || count,
          itemId,
          rarityKey: lastItem?.rarity?.key || options.rarityKey || compiled?.rarityKey || draft.rarity || 'white'
        };
      };

      Game.prototype.rollEditorLootTable = function(tableOrId, source = {}, options = {}) {
        const table = this.getLootTableById(tableOrId, options.fallbackTableId || 'loot_common_chest');
        const granted = [];
        const items = [];
        let gold = 0;
        const grant = options.grant !== false;
        const sourceLevel = Math.max(1, Math.floor(safeNumber(source.level || this.player?.level, 1)));

        if (table?.gold) {
          const min = Math.max(0, Math.floor(safeNumber(table.gold.min, 0)));
          const max = Math.max(min, Math.floor(safeNumber(table.gold.max, min)));
          gold = randInt(min, max);
          if (grant && gold > 0 && this.player) this.addGold ? this.addGold(gold) : (this.player.gold += gold);
        }

        for (const entry of table?.entries || []) {
          if (!chancePass(entry.chance ?? entry.dropChance ?? 0)) continue;
          const minQty = Math.max(1, Math.floor(safeNumber(entry.min ?? entry.minQuantity, 1)));
          const maxQty = Math.max(minQty, Math.floor(safeNumber(entry.max ?? entry.maxQuantity, minQty)));
          const qty = randInt(minQty, maxQty);
          const rarity = this.chooseLootTableRarity(table?.rarityWeights, this.getEditorItemDraft(entry.itemId)?.rarity || 'white');
          let result;
          if (grant) {
            result = this.grantEditorItem(entry.itemId, qty, { rarity, rarityKey: rarity.key, sourceLevel });
          } else {
            const draft = this.getEditorItemDraft(entry.itemId);
            const runtimeItem = this.createRuntimeItemInstance?.(entry.itemId, qty, { rarity, rarityKey: rarity.key, sourceLevel })
              || this.createRuntimeItemFromDraft(draft, qty, { rarity, rarityKey: rarity.key, sourceLevel });
            result = { ok: Boolean(runtimeItem), name: runtimeItem?.name || draft?.name || entry.itemId, quantity: qty, itemId: entry.itemId, rarityKey: rarity.key, item: runtimeItem };
          }
          if (result.ok) {
            const rarityTag = rarity?.key && rarity.key !== 'white' ? ` [${rarity.label || rarity.key}]` : '';
            granted.push(`${result.name} x${result.quantity}${rarityTag}`);
            items.push({ itemId: entry.itemId, name: result.name, quantity: result.quantity, rarityKey: rarity.key, item: result.item || null });
          }
        }

        const guaranteedPool = Array.isArray(table?.guaranteedPool) ? table.guaranteedPool.filter(Boolean) : [];
        const guaranteedCount = Math.max(0, Math.floor(safeNumber(table?.guaranteedCount, guaranteedPool.length ? 1 : 0)));
        const usedGuaranteed = new Set();
        for (let gi = 0; gi < guaranteedCount && guaranteedPool.length; gi++) {
          const available = guaranteedPool.filter(id => !usedGuaranteed.has(id));
          const guaranteedId = available.length ? available[randInt(0, available.length - 1)] : guaranteedPool[randInt(0, guaranteedPool.length - 1)];
          usedGuaranteed.add(guaranteedId);
          const rarity = this.chooseLootTableRarity(table?.rarityWeights, this.getEditorItemDraft(guaranteedId)?.rarity || 'blue');
          let result;
          if (grant) {
            result = this.grantEditorItem(guaranteedId, 1, { rarity, rarityKey: rarity.key, sourceLevel, guaranteed: true });
          } else {
            const draft = this.getEditorItemDraft(guaranteedId);
            const runtimeItem = this.createRuntimeItemInstance?.(guaranteedId, 1, { rarity, rarityKey: rarity.key, sourceLevel, guaranteed: true })
              || this.createRuntimeItemFromDraft(draft, 1, { rarity, rarityKey: rarity.key, sourceLevel, guaranteed: true });
            result = { ok: Boolean(runtimeItem), name: runtimeItem?.name || draft?.name || guaranteedId, quantity: 1, itemId: guaranteedId, rarityKey: rarity.key, item: runtimeItem };
          }
          if (result.ok) {
            const rarityTag = rarity?.key && rarity.key !== 'white' ? ` [${rarity.label || rarity.key}]` : '';
            granted.push(`${result.name} x${result.quantity}${rarityTag}`);
            items.push({ itemId: guaranteedId, name: result.name, quantity: 1, rarityKey: rarity.key, guaranteed: true, item: result.item || null });
          }
        }

        const rareChance = Math.max(0, safeNumber(table?.rareChance ?? table?.rarePoolChance, table?.rarePool?.length ? 7 : 0));
        if (Array.isArray(table?.rarePool) && table.rarePool.length && chancePass(rareChance)) {
          const rareId = table.rarePool[randInt(0, table.rarePool.length - 1)];
          const rarity = this.chooseLootTableRarity(table?.rarityWeights, this.getEditorItemDraft(rareId)?.rarity || 'blue');
          let result;
          if (grant) {
            result = this.grantEditorItem(rareId, 1, { rarity, rarityKey: rarity.key, sourceLevel });
          } else {
            const draft = this.getEditorItemDraft(rareId);
            const runtimeItem = this.createRuntimeItemInstance?.(rareId, 1, { rarity, rarityKey: rarity.key, sourceLevel })
              || this.createRuntimeItemFromDraft(draft, 1, { rarity, rarityKey: rarity.key, sourceLevel });
            result = { ok: Boolean(runtimeItem), name: runtimeItem?.name || draft?.name || rareId, quantity: 1, itemId: rareId, rarityKey: rarity.key, item: runtimeItem };
          }
          if (result.ok) {
            const rarityTag = rarity?.key && rarity.key !== 'white' ? ` [${rarity.label || rarity.key}]` : '';
            granted.push(`${result.name} x${result.quantity}${rarityTag}`);
            items.push({ itemId: rareId, name: result.name, quantity: result.quantity, rarityKey: rarity.key, rare: true, item: result.item || null });
          }
        }

        if (!items.length && options.fallbackGenerated !== false) {
          const item = this.generateLoot({ level: sourceLevel, name: table?.name || source.name || 'Loot Table' }, false);
          if (!grant || this.addItem?.(item)) {
            granted.push(item.name);
            items.push({ itemId: item.itemId || item.id, name: item.name, quantity: 1, rarityKey: item.rarity?.key || 'white', generated: true, item: grant ? null : item });
          }
        }

        if (grant && this.updateUI) this.updateUI();
        const parts = [];
        if (gold > 0) parts.push(`${gold}g`);
        parts.push(...granted);
        return {
          tableId: table?.id || String(tableOrId || ''),
          tableName: table?.name || String(tableOrId || 'Loot Table'),
          source: cloneJson(source),
          gold,
          items,
          itemSummary: granted,
          summary: parts.length ? parts.join(', ') : 'nothing'
        };
      };


      Game.prototype.lootRollRarityRank = function(item) {
        const key = String(item?.rarityKey || item?.rarity?.key || item?.rarity || '').toLowerCase();
        const ranks = { grey: 0, gray: 0, trash: 0, white: 1, common: 1, green: 2, uncommon: 2, blue: 3, rare: 3, purple: 4, epic: 4, gold: 5, legendary: 5, orange: 5 };
        return ranks[key] ?? 1;
      };

      Game.prototype.isLootRollGearItem = function(item) {
        if (!item || this.isMaterialItem?.(item) || this.isConsumableItem?.(item)) return false;
        const slot = this.resolveEquipmentSlotForItem?.(item, false) || this.canonicalEquipmentSlot?.(item.slot || item.equipSlot || '') || item.slot || item.equipSlot || '';
        const slotKey = String(slot || '').toLowerCase();
        if ((DR.EQUIP_SLOTS || []).includes(slotKey)) return true;
        const kind = String(item.kind || item.type || '').toLowerCase();
        return kind === 'equipment' || kind === 'weapon' || kind === 'armor' || Boolean(item.damage || item.armor || item.twoHanded);
      };

      Game.prototype.shouldStartLootRollForItem = function(item, options = {}) {
        if (!item || item._lootRollBypass || item.lootRollAwarded || item.lootRollSessionId) return false;
        if (options.force === true) return true;
        if (!this.isLootRollGearItem?.(item)) return false;
        if ((this.lootRollRarityRank?.(item) || 0) <= 1) return false;
        const participants = this.getLootRollParticipants?.(options.source || null) || [];
        return participants.length > 1;
      };

      Game.prototype.getLootRollParticipants = function(source = null) {
        const participants = [];
        const add = (id, type, actor, local = false) => {
          if (!actor || actor.kind === 'pet') return;
          const key = String(id || actor.id || actor.botId || actor.remoteId || type || participants.length);
          if (participants.some(entry => String(entry.id) === key)) return;
          participants.push({ id: key, type, actor, local: Boolean(local), name: actor.name || (local ? 'You' : type) });
        };
        if (this.player) add(this.localPeerId || 'player', 'player', this.player, true);
        const roster = this.getPartyCombatMembers?.({ includeRemote: false, includePet: false, sameZoneOnly: false, anchor: source || this.player, range: Infinity }) || [];
        for (const entry of roster) {
          if (!entry?.actor || entry.type === 'pet') continue;
          if (entry.actor === this.player || entry.type === 'player') continue;
          if (entry.type === 'merc' && !this.partyMercIncluded) continue;
          if (entry.type === 'bot' && this.isBotInParty?.(entry.actor) !== true) continue;
          add(entry.id || entry.actor.id || entry.actor.botId || entry.type, entry.type, entry.actor, false);
        }
        if (this.partyMercIncluded && this.merc) add('merc', 'merc', this.merc, false);
        for (const bot of this.botPlayers || []) if (this.isBotInParty?.(bot)) add(bot.botId || bot.remoteId || bot.id, 'bot', bot, false);
        return participants.filter(Boolean);
      };

      Game.prototype.classRoleForGearEvaluation = function(actor) {
        if (!actor) return 'dps';
        const explicit = String(actor.role || actor.roleKey || '').toLowerCase();
        if (/guardian|tank/.test(explicit)) return 'tank';
        if (/cleric|healer|druid/.test(explicit)) return 'healer';
        if (/support|bard/.test(explicit)) return 'support';
        const cls = String(actor.className || actor.class || actor.playerClass || '').toLowerCase();
        if (cls === 'paladin' || cls === 'warden') return 'tank';
        if (cls === 'cleric' || cls === 'druid') return 'healer';
        if (cls === 'bard' || cls === 'enchanter') return 'support';
        if (cls === 'wizard' || cls === 'shaman' || cls === 'summoner' || cls === 'necromancer') return 'caster';
        if (cls === 'ranger' || cls === 'assassin') return 'physicalRanged';
        return 'melee';
      };

      Game.prototype.scoreLootRollItemForActor = function(actor, item) {
        if (!actor || !item) return 0;
        const role = this.classRoleForGearEvaluation?.(actor) || 'dps';
        const cls = String(actor.className || actor.class || actor.playerClass || '').toLowerCase();
        const stats = this.equipmentComparisonStats?.(item) || this.normalizeItemStats?.(item) || item.stats || {};
        const weightsByRole = {
          tank: { armor: 2.1, defense: 2.0, hp: 0.20, stamina: 1.2, attack: 0.7, damage: 0.55, minDamage: 0.30, maxDamage: 0.30, mana: 0.05, wisdom: 0.45, intelligence: 0.25, speed: 4 },
          melee: { attack: 1.7, damage: 1.3, minDamage: 0.7, maxDamage: 0.7, strength: 1.0, dexterity: 0.8, physicalPower: 1.2, crit: 0.9, speed: 6, defense: 0.35, hp: 0.08 },
          physicalRanged: { attack: 1.6, damage: 1.2, minDamage: 0.65, maxDamage: 0.65, dexterity: 1.15, physicalPower: 1.15, focus: 0.45, crit: 0.95, speed: 5.5, defense: 0.25, hp: 0.07 },
          caster: { spellPower: 1.5, magicPower: 1.45, intelligence: 1.25, wisdom: 0.65, mana: 0.20, maxMana: 0.20, attack: 0.35, damage: 0.45, crit: 0.75, magicCrit: 0.95, defense: 0.25, hp: 0.07 },
          healer: { healingPower: 1.65, wisdom: 1.25, intelligence: 0.75, mana: 0.24, maxMana: 0.24, defense: 0.55, armor: 0.55, hp: 0.12, spellPower: 0.55, attack: 0.25 },
          support: { mana: 0.22, maxMana: 0.22, wisdom: 0.95, intelligence: 0.85, attack: 0.65, spellPower: 0.70, healingPower: 0.70, defense: 0.45, speed: 4.5, hp: 0.10 }
        };
        const weights = weightsByRole[role] || weightsByRole.melee;
        let score = 0;
        for (const [key, raw] of Object.entries(stats || {})) score += (Number(raw) || 0) * (weights[key] ?? 0.12);
        const damage = item.damage && typeof item.damage === 'object' ? item.damage : null;
        if (damage) score += ((Number(damage.min || 0) + Number(damage.max || 0)) / 2) * (role === 'caster' || role === 'healer' ? 0.45 : 1.25);
        if (item.armor) score += Number(item.armor || 0) * (role === 'tank' ? 1.5 : 0.45);
        score += (this.lootRollRarityRank?.(item) || 1) * 2.5;
        score += Math.max(0, Number(item.level || item.levelRequirement || item.sourceLevel || 1)) * 0.20;
        const family = this.weaponFamilyForItem?.(item) || String(item.icon?.family || '').toLowerCase();
        const slot = String(item.slot || item.equipSlot || '').toLowerCase();
        const wrong = () => { score -= 100; };
        if (cls === 'fighter' && (family === 'staff' || family === 'wand' || family === 'bow' || family === 'crossbow' || /shield|focus|orb|totem|symbol/.test(family))) wrong();
        if (cls === 'rogue' && !['dagger', 'sword', 'fist', ''].includes(family) && (slot === 'weapon' || slot === 'offhand')) wrong();
        if (cls === 'assassin' && ['staff', 'wand', 'shield', 'greatsword', 'greataxe', 'mace', 'hammer'].includes(family)) wrong();
        if (cls === 'ranger' && ['staff', 'wand', 'shield', 'greatsword', 'greataxe', 'mace', 'hammer'].includes(family)) wrong();
        if ((cls === 'wizard' || cls === 'enchanter' || cls === 'summoner' || cls === 'necromancer' || cls === 'shaman' || cls === 'druid') && ['greatsword', 'greataxe', 'axe', 'shield', 'crossbow'].includes(family)) wrong();
        if (cls === 'cleric' && ['greatsword', 'greataxe', 'crossbow', 'bow'].includes(family)) wrong();
        if (cls === 'paladin' && ['wand', 'staff', 'bow', 'crossbow'].includes(family)) wrong();
        return Number(score.toFixed(2));
      };

      Game.prototype.evaluateGearUpgrade = function(entity, item) {
        const result = { canEquip: false, slot: '', currentItem: null, scoreCurrent: 0, scoreCandidate: 0, upgradeScore: 0, shouldNeed: false, reason: 'Not evaluated.' };
        if (!entity || !item || !this.isLootRollGearItem?.(item)) { result.reason = 'Not equippable gear.'; return result; }
        const type = entity === this.player ? 'player' : entity.kind === 'merc' ? 'merc' : entity.kind === 'bot' ? 'bot' : 'actor';
        if (type === 'player') {
          result.canEquip = this.canEquip?.(item) === true;
          result.slot = this.resolveEquipmentSlotForItem?.(item, false) || this.canonicalEquipmentSlot?.(item.slot || item.equipSlot || '') || item.slot || '';
          result.currentItem = this.equipment?.[result.slot] || null;
        } else if (type === 'merc') {
          const compat = this.canMercEquipItem?.(item, entity) || { ok: false, reason: 'Cannot equip.' };
          result.canEquip = compat.ok === true;
          result.slot = compat.slot || this.mercSlotForItem?.(item) || '';
          result.currentItem = entity.equipment?.[result.slot] || null;
          if (!result.canEquip) result.reason = compat.reason || 'Mercenary cannot equip.';
        } else if (type === 'bot') {
          this.normalizeBotInventory?.(entity);
          result.slot = this.resolveEquipmentSlotForItem?.(item, false) || this.canonicalEquipmentSlot?.(item.slot || item.equipSlot || '') || item.slot || item.equipSlot || '';
          result.canEquip = this.botCanUseItem?.(entity, item) === true;
          result.currentItem = entity.botEquipment?.[result.slot] || null;
          if (!result.canEquip) result.reason = 'Bot cannot equip that item.';
        } else {
          result.slot = this.canonicalEquipmentSlot?.(item.slot || item.equipSlot || '') || item.slot || '';
          result.canEquip = false;
        }
        result.scoreCandidate = this.scoreLootRollItemForActor?.(entity, item) || 0;
        result.scoreCurrent = result.currentItem ? (this.scoreLootRollItemForActor?.(entity, result.currentItem) || 0) : 0;
        result.upgradeScore = Number((result.scoreCandidate - result.scoreCurrent).toFixed(2));
        if (!result.canEquip) return result;
        if (result.scoreCandidate < -25) { result.reason = 'Class or role inappropriate.'; return result; }
        result.shouldNeed = result.upgradeScore > 0.25;
        result.reason = result.shouldNeed ? `Upgrade +${result.upgradeScore.toFixed(1)}.` : `Not an upgrade (${result.upgradeScore.toFixed(1)}).`;
        return result;
      };

      Game.prototype.ensureLootRollPanel = function() {
        let panel = document.getElementById('lootRollPanel');
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'lootRollPanel';
        panel.className = 'lootRollPanel';
        panel.style.cssText = [
          'position:fixed','left:50%','bottom:128px','transform:translateX(-50%)','z-index:12060','width:min(430px,calc(100vw - 36px))',
          'display:none','flex-direction:column','gap:10px','pointer-events:auto','box-sizing:border-box'
        ].join(';');
        document.body.appendChild(panel);
        const submitFromEvent = event => {
          const btn = event.target?.closest?.('[data-loot-roll-choice]');
          if (!btn || !panel.contains(btn)) return;
          event.preventDefault?.();
          event.stopPropagation?.();
          if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
          this.handleLootRollPanelChoice?.(btn.dataset.lootRollSession, btn.dataset.lootRollChoice);
        };
        panel.addEventListener('click', submitFromEvent);
        panel.addEventListener('pointerup', submitFromEvent);
        return panel;
      };

      Game.prototype.localLootRollParticipant = function(session) {
        return (session?.participants || []).find(entry => entry && entry.local) || null;
      };

      Game.prototype.playerLootRollPromptPending = function(session) {
        if (!session || session.state !== 'rolling' || !session.playerEligible) return false;
        const participant = this.localLootRollParticipant?.(session);
        return Boolean(participant && !participant.responded && !participant.promptDismissed);
      };

      Game.prototype.handleLootRollPanelChoice = function(sessionId, choice) {
        const submitted = this.submitLootRollChoice?.(String(sessionId || ''), String(choice || ''));
        return Boolean(submitted);
      };

      Game.prototype.renderLootRollPanel = function() {
        const panel = this.ensureLootRollPanel?.();
        if (!panel) return;
        const sessions = (this.lootRollSessions || []).filter(session => this.playerLootRollPromptPending?.(session));
        const session = sessions[0] || null;
        panel.style.display = session ? 'flex' : 'none';
        if (!session) { panel.innerHTML = ''; return; }
        const item = session.item || {};
        const evalResult = this.evaluateGearUpgrade?.(this.player, item) || { canEquip: false, reason: '' };
        const remaining = Math.max(0, Math.ceil(Number(session.remaining || 0)));
        const color = item.rarity?.color || item.icon?.color || '#9ee07c';
        const stats = this.itemStatsText?.(item) || '';
        const comparison = evalResult.canEquip ? `${evalResult.currentItem ? 'Current: ' + escapeHtml(evalResult.currentItem.name || 'equipped') + ' · ' : ''}${evalResult.reason || ''}` : (evalResult.reason || 'Cannot equip; Greed or Pass only.');
        const needDisabled = evalResult.canEquip ? '' : 'disabled aria-disabled="true" title="Cannot Need: item is not usable by your character"';
        panel.innerHTML = `<div class="lootRollCard" data-loot-roll-session="${escapeHtml(session.id)}" style="background:linear-gradient(135deg,rgba(10,12,10,.97),rgba(26,22,14,.95));border:1px solid ${escapeHtml(color)};box-shadow:0 14px 34px rgba(0,0,0,.48);border-radius:12px;padding:11px;color:#f3ead0;pointer-events:auto">
          <div style="display:flex;gap:10px;align-items:flex-start">
            <div class="inventoryIcon" style="--icon-color:${escapeHtml(color)};--rarity-color:${escapeHtml(color)}">${this.itemIconHtml?.(item, 'inventoryIcon') || ''}</div>
            <div style="min-width:0;flex:1">
              <div style="font-weight:800;color:${escapeHtml(color)}">${escapeHtml(item.name || 'Loot')}</div>
              <div class="small">${escapeHtml(item.slot || item.equipSlot || 'gear')} · ${escapeHtml(item.type || item.kind || 'equipment')} · ${remaining}s</div>
              <div class="small" style="margin-top:4px;color:#d7c8a8">${escapeHtml(stats)}</div>
              <div class="small" style="margin-top:4px;color:#b9c9a6">${comparison}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px">
            <button type="button" ${needDisabled} data-loot-roll-session="${escapeHtml(session.id)}" data-loot-roll-choice="need">Need</button>
            <button type="button" data-loot-roll-session="${escapeHtml(session.id)}" data-loot-roll-choice="greed">Greed</button>
            <button type="button" data-loot-roll-session="${escapeHtml(session.id)}" data-loot-roll-choice="pass">Pass</button>
          </div>
          ${sessions.length > 1 ? `<div class="small" style="margin-top:7px;color:#b79d6e;text-align:center">${sessions.length - 1} more roll${sessions.length - 1 === 1 ? '' : 's'} queued</div>` : ''}
        </div>`;
      };

      Game.prototype.beginLootRollForItem = function(item, context = {}) {
        if (!item) return null;
        this.lootRollSessions = Array.isArray(this.lootRollSessions) ? this.lootRollSessions : [];
        if (item.lootRollSessionId && this.lootRollSessions.some(session => session.id === item.lootRollSessionId && session.state === 'rolling')) return item.lootRollSessionId;
        const participants = this.getLootRollParticipants?.(context.source || context.enemy || this.player) || [];
        if (participants.length <= 1) return null;
        const now = performance.now?.() || Date.now();
        const id = `loot_roll_${Math.floor(now)}_${Math.floor(Math.random() * 100000)}`;
        const session = {
          id, item, source: context.source || null, createdAt: now, t: 0, timer: Number(context.timer || 30), remaining: Number(context.timer || 30), state: 'rolling',
          participants: participants.map(entry => ({ id: entry.id, type: entry.type, actor: entry.actor, name: entry.name || entry.actor?.name || entry.type, local: entry.local, responded: false, choice: null, roll: null, delay: entry.local ? 0 : 0.5 + Math.random() * 1.5 })),
          playerEligible: participants.some(entry => entry.local), resolutionLog: []
        };
        item.lootRollSessionId = id;
        this.lootRollSessions.push(session);
        const rarity = item.rarity?.label || item.rarityKey || 'loot';
        this.log?.(`${item.name || 'Loot'} dropped. Roll Need/Greed/Pass.`, 'Loot');
        this.renderLootRollPanel?.();
        return id;
      };

      Game.prototype.submitLootRollChoice = function(sessionId, choice) {
        const normalizedId = String(sessionId || '');
        const session = (this.lootRollSessions || []).find(entry => String(entry?.id || '') === normalizedId && entry.state === 'rolling');
        if (!session) return false;
        const participant = this.localLootRollParticipant?.(session) || session.participants.find(entry => entry.local);
        if (!participant || participant.responded || participant.promptDismissed) return false;
        const normalized = String(choice || '').toLowerCase();
        if (!['need', 'greed', 'pass'].includes(normalized)) return false;
        if (normalized === 'need') {
          const evalResult = this.evaluateGearUpgrade?.(this.player, session.item);
          if (!evalResult?.canEquip) {
            this.log?.(`Cannot Need ${session.item?.name || 'item'}: ${evalResult?.reason || 'not usable'}.`, 'Loot');
            return false;
          }
        }
        participant.choice = normalized;
        participant.roll = normalized === 'pass' ? null : randInt(1, 100);
        participant.responded = true;
        participant.promptDismissed = true;
        session.playerPromptDismissedAt = performance.now?.() || Date.now();
        this.log?.(`${participant.name || 'You'} ${normalized === 'pass' ? 'passed' : `rolled ${normalized[0].toUpperCase() + normalized.slice(1)} ${participant.roll}`} on ${session.item?.name || 'loot'}.`, 'Loot');
        this.renderLootRollPanel?.();
        this.maybeResolveLootRollSession?.(session);
        return true;
      };

      Game.prototype.updateLootRollSessions = function(dt = 0) {
        if (!Array.isArray(this.lootRollSessions) || !this.lootRollSessions.length) return;
        for (const session of this.lootRollSessions) {
          if (!session || session.state !== 'rolling') continue;
          session.t = Math.max(0, Number(session.t || 0) + Number(dt || 0));
          session.remaining = Math.max(0, Number(session.timer || 30) - session.t);
          for (const participant of session.participants || []) {
            if (participant.responded || participant.local) continue;
            participant.delay = Math.max(0, Number(participant.delay || 0) - Number(dt || 0));
            if (participant.delay > 0) continue;
            const evaluation = this.evaluateGearUpgrade?.(participant.actor, session.item) || { shouldNeed: false, reason: 'No need.' };
            participant.choice = evaluation.shouldNeed ? 'need' : 'pass';
            participant.roll = participant.choice === 'need' ? randInt(1, 100) : null;
            participant.responded = true;
            this.log?.(`${participant.name || 'Companion'} ${participant.choice === 'need' ? `rolled Need ${participant.roll}` : 'passed'} on ${session.item?.name || 'loot'}${evaluation.reason ? ` (${evaluation.reason})` : ''}.`, 'Loot');
          }
          if (session.remaining <= 0) {
            for (const participant of session.participants || []) {
              if (participant.responded) continue;
              participant.choice = 'pass';
              participant.roll = null;
              participant.responded = true;
              this.log?.(`${participant.name || 'Participant'} auto-passed on ${session.item?.name || 'loot'}.`, 'Loot');
            }
          }
          this.maybeResolveLootRollSession?.(session);
        }
        this.lootRollSessions = this.lootRollSessions.filter(session => session && (session.state === 'rolling' || (performance.now?.() || Date.now()) - Number(session.resolvedAt || 0) < 4500));
        this.renderLootRollPanel?.();
      };

      Game.prototype.maybeResolveLootRollSession = function(session) {
        if (!session || session.state !== 'rolling') return false;
        if ((session.participants || []).some(entry => !entry.responded)) return false;
        return this.resolveLootRollSession?.(session) || false;
      };

      Game.prototype.resolveLootRollSession = function(session) {
        if (!session || session.state !== 'rolling') return false;
        const candidatesByChoice = choice => (session.participants || []).filter(entry => entry.choice === choice && Number.isFinite(Number(entry.roll)));
        let tier = 'need';
        let candidates = candidatesByChoice('need');
        if (!candidates.length) { tier = 'greed'; candidates = candidatesByChoice('greed'); }
        if (!candidates.length) {
          session.state = 'resolved';
          session.resolvedAt = performance.now?.() || Date.now();
          if (session.item) delete session.item.lootRollSessionId;
          this.log?.(`No one rolled on ${session.item?.name || 'loot'}.`, 'Loot');
          this.renderLootRollPanel?.();
          return true;
        }
        let top = Math.max(...candidates.map(entry => Number(entry.roll || 0)));
        let tied = candidates.filter(entry => Number(entry.roll || 0) === top);
        let safety = 0;
        while (tied.length > 1 && safety < 5) {
          this.log?.(`Tie on ${session.item?.name || 'loot'} at ${top}; rerolling tied ${tier} rolls.`, 'Loot');
          for (const entry of tied) entry.roll = randInt(1, 100);
          top = Math.max(...tied.map(entry => Number(entry.roll || 0)));
          tied = tied.filter(entry => Number(entry.roll || 0) === top);
          safety++;
        }
        const winner = tied[0] || candidates.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
        session.state = 'resolved';
        session.resolvedAt = performance.now?.() || Date.now();
        this.log?.(`${winner.name || 'Winner'} won ${session.item?.name || 'loot'} with ${tier[0].toUpperCase() + tier.slice(1)} ${winner.roll}.`, 'Loot');
        this.awardLootRollItemToParticipant?.(winner, session.item, tier, session);
        if (session.item) {
          session.item.lootRollAwarded = true;
          delete session.item.lootRollSessionId;
        }
        this.renderLootRollPanel?.();
        return true;
      };

      Game.prototype.awardLootRollItemToParticipant = function(winner, item, tier = 'greed', session = null) {
        if (!winner || !item) return false;
        item._lootRollBypass = true;
        if (winner.local || winner.type === 'player' || winner.actor === this.player) {
          const ok = this.grantRuntimeItem?.(item) || false;
          delete item._lootRollBypass;
          if (ok) this.log?.(`You received ${item.name || 'loot'}.`, 'Loot');
          else {
            this.createTemporaryGroundItem?.(item, this.player?.x || 0, this.player?.y || 0, { despawnMs: 90000, source: 'loot-roll-overflow' });
            this.log?.(`Bags full. ${item.name || 'loot'} was placed on the ground.`, 'Loot');
          }
          this.updateUI?.();
          return ok;
        }
        delete item._lootRollBypass;
        const actor = winner.actor;
        if (winner.type === 'bot' && actor) {
          this.normalizeBotInventory?.(actor);
          const evaluation = this.evaluateGearUpgrade?.(actor, item) || {};
          if (tier === 'need' && evaluation.canEquip && evaluation.slot) {
            const old = actor.botEquipment?.[evaluation.slot] || null;
            actor.botEquipment[evaluation.slot] = item;
            if (old) actor.botInventory.push(old);
            this.recalculateBotGearScore?.(actor);
            actor.gearVisualChangedAt = performance.now?.() || Date.now();
            this.log?.(`${actor.name || 'Bot'} equipped ${item.name || 'loot'}.`, 'Loot');
          } else {
            actor.botInventory.push(item);
            this.log?.(`${actor.name || 'Bot'} received ${item.name || 'loot'}.`, 'Loot');
          }
          this.botHudDirty = true;
          this.partyPanelDirty = true;
          return true;
        }
        if (winner.type === 'merc' && actor) {
          actor.equipment = actor.equipment || {};
          actor.inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
          const evaluation = this.evaluateGearUpgrade?.(actor, item) || {};
          if (tier === 'need' && evaluation.canEquip && evaluation.slot) {
            const old = actor.equipment[evaluation.slot] || null;
            actor.equipment[evaluation.slot] = item;
            if (old) actor.inventory.push(old);
            actor.recalculateFromLevel?.();
            actor.hp = Math.min(actor.maxHp || actor.hp || 1, Math.max(1, actor.hp || 1));
            actor.mana = Math.min(actor.maxMana || actor.mana || 0, Math.max(0, actor.mana || 0));
            actor.gearVisualChangedAt = performance.now?.() || Date.now();
            this.log?.(`${actor.name || 'Mercenary'} equipped ${item.name || 'loot'}.`, 'Loot');
          } else {
            actor.inventory.push(item);
            this.log?.(`${actor.name || 'Mercenary'} received ${item.name || 'loot'}.`, 'Loot');
          }
          this.characterSaveDirty = true;
          this.partyPanelDirty = true;
          this.markMercUiDirty?.({ commands: false });
          return true;
        }
        return false;
      };

      Game.prototype.auditSilkWebCavernLootTables = function() {
        const ids = [
          'loot_silk_web_cavern_elites',
          'loot_silk_web_cavern_minibosses',
          'loot_boss_broodwarden_skirr',
          'loot_boss_matron_velyra',
          'loot_boss_queen_arakhzel',
          'loot_silk_web_cavern_final'
        ];
        const missing = [];
        const guaranteed = [];
        for (const id of ids) {
          const table = this.getLootTableById?.(id, null) || DR.LOOT_TABLE_BY_ID?.[id];
          if (!table) { missing.push(id); continue; }
          for (const entry of table.entries || []) if (!this.getEditorItemDraft?.(entry.itemId)) missing.push(`${id}:${entry.itemId}`);
          for (const itemId of table.rarePool || []) if (!this.getEditorItemDraft?.(itemId)) missing.push(`${id}:${itemId}`);
          for (const itemId of table.guaranteedPool || []) {
            guaranteed.push(`${id}:${itemId}`);
            if (!this.getEditorItemDraft?.(itemId)) missing.push(`${id}:${itemId}`);
          }
        }
        return { checked: ids.length, missing, guaranteedCount: guaranteed.length, ok: missing.length === 0 };
      };

      Game.prototype.rollEnemyLoot = function(enemy) {
        const tableId = this.resolveLootTableIdForEnemy(enemy);
        const fallbackId = this.currentZone === 'dungeon'
          ? (enemy?.dungeonBoss ? 'loot_dungeon_chest' : 'loot_dungeon_elite_mobs')
          : this.currentZone === 'cave'
            ? (this.currentCave?.lootTableId || enemy?.lootTableId || 'loot_mossfang_cave_mobs')
            : 'loot_dark_woods_common_mobs';
        const table = this.getLootTableById(tableId, fallbackId);
        const zoneId = this.currentZone === 'dungeon'
          ? (enemy?.dungeonId || 'dungeon')
          : this.currentZone === 'cave'
            ? (this.getActiveCaveZoneKey?.() || this.currentCave?.id || 'mossfang_cave')
            : 'dark_woods';
        const rolls = Math.max(1, Math.floor(safeNumber(enemy?.lootRolls, 1)));
        const currency = this.rollCurrencyDropForMob?.(enemy) || { totalCopper: 0, copper: 0, silver: 0, gold: 0, platinum: 0 };
        const combined = {
          tableId: table?.id || String(tableId || ''),
          tableName: table?.name || String(tableId || 'Loot Table'),
          source: {
            kind: enemy?.dungeonBoss ? 'boss' : enemy?.dungeonElite ? 'dungeonElite' : 'enemy',
            enemyId: enemy?.id,
            bossId: enemy?.bossId || null,
            name: enemy?.baseType?.name || enemy?.name || 'Enemy',
            level: enemy?.level || this.player?.level || 1,
            zoneId
          },
          gold: 0,
          currencyCopper: currency.totalCopper,
          currency,
          items: [],
          itemSummary: []
        };
        for (let i = 0; i < rolls; i++) {
          const result = this.rollEditorLootTable(table, combined.source, {
            fallbackTableId: fallbackId,
            fallbackGenerated: i === 0 || Boolean(enemy?.dungeonBoss),
            grant: false
          });
          combined.items.push(...(result?.items || []));
          combined.itemSummary.push(...(result?.itemSummary || []));
        }
        const family = String(enemy?.baseType?.family || enemy?.family || enemy?.baseType?.kind || '').toLowerCase();
        const scavengerEligible = /beast|humanoid|bandit|goblin|animal|wolf|boar|rat|spider/.test(family + ' ' + String(enemy?.baseType?.name || enemy?.name || '').toLowerCase());
        if (this.player?.raceId === 'ratkin' && scavengerEligible && Math.random() < 0.05) {
          const bonusCopper = Math.max(3, Math.floor(4 + safeNumber(enemy?.level, 1) * 3 + Math.random() * 9));
          combined.currencyCopper += bonusCopper;
          combined.currency = this.splitCopperValueIntoCurrency?.(combined.currencyCopper) || combined.currency;
          combined.itemSummary.push(`Scavenger's Eye: ${this.formatCopper?.(bonusCopper) || `${bonusCopper}C`}`);
        }
        const parts = [];
        if (combined.currencyCopper > 0) parts.push(this.formatCopper?.(combined.currencyCopper) || `${combined.currencyCopper}C`);
        parts.push(...combined.itemSummary);
        combined.summary = parts.length ? parts.join(', ') : 'nothing';
        return combined;
      };

      Game.prototype.splitCopperValueIntoCurrency = function(totalCopper) {
        let remaining = Math.max(0, Math.floor(safeNumber(totalCopper, 0)));
        const platinum = Math.floor(remaining / 1000000);
        remaining -= platinum * 1000000;
        const gold = Math.floor(remaining / 10000);
        remaining -= gold * 10000;
        const silver = Math.floor(remaining / 100);
        const copper = remaining - silver * 100;
        return { totalCopper: Math.max(0, Math.floor(safeNumber(totalCopper, 0))), copper, silver, gold, platinum };
      };

      Game.prototype.rollCurrencyDropForMob = function(mob, options = {}) {
        const random = typeof options.random === 'function' ? options.random : Math.random;
        const level = Math.max(1, Math.floor(safeNumber(mob?.level, 1)));
        const baseType = mob?.baseType || {};
        const rank = mob?.dungeonBoss || mob?.boss || baseType.boss ? 'boss'
          : mob?.named || baseType.named ? 'named'
            : mob?.rare || baseType.rare ? 'rare'
              : mob?.elite || mob?.dungeonElite || baseType.elite ? 'elite'
                : 'normal';
        let min;
        let max;
        if (level <= 2) {
          min = 3 + level * 4;
          max = min + level * 6;
        } else if (level <= 5) {
          min = level * 10;
          max = level * 25 + 10;
        } else if (level <= 8) {
          min = level * 18;
          max = level * 40;
        } else {
          min = level * 24;
          max = level * 55;
        }
        const multiplier = { normal: 1, elite: 1.8, rare: 2.5, named: 3.5, boss: 5 }[rank] || 1;
        let totalCopper = Math.floor((min + Math.floor(random() * (Math.max(min, max) - min + 1))) * multiplier);
        const silverChance = level <= 2 ? 0.04 : level <= 5 ? 0.12 + level * 0.04 : 0;
        if (silverChance > 0 && random() < silverChance) totalCopper += 100;
        const goldChanceBase = { normal: 0, elite: 0.018, rare: 0.035, named: 0.055, boss: 0.09 }[rank] || 0;
        if (level >= 6 && random() < goldChanceBase * Math.max(1, level - 5)) totalCopper += 10000;
        if (level >= 20 && ['named', 'boss'].includes(rank) && random() < (rank === 'boss' ? 0.025 : 0.008)) totalCopper += 1000000;
        return { ...this.splitCopperValueIntoCurrency(totalCopper), level, rank };
      };


      Game.prototype.corpseLootZoneKey = function(enemy = null) {
        if (enemy?.corpseLootZoneId) return enemy.corpseLootZoneId;
        if (this.currentZone === 'cave') return this.getActiveCaveZoneKey?.() || this.currentCave?.id || 'mossfang_cave';
        if (this.currentZone === 'dungeon') return this.activeDungeon?.id || enemy?.dungeonId || 'dungeon';
        return 'dark_woods';
      };

      Game.prototype.normalizeCorpseLootBag = function(enemy) {
        const loot = enemy?.corpseLoot;
        if (!loot) return null;
        if (!Number.isFinite(Number(loot.currencyCopper))) loot.currencyCopper = Math.max(0, Math.floor(safeNumber(loot.gold, 0) * 10000));
        loot.currencyCopper = Math.max(0, Math.floor(safeNumber(loot.currencyCopper, 0)));
        loot.currency = this.splitCopperValueIntoCurrency?.(loot.currencyCopper) || null;
        loot.gold = 0;
        loot.items = Array.isArray(loot.items) ? loot.items.filter(Boolean).map(entry => ({ ...entry, taken: Boolean(entry.taken) })) : [];
        loot.groupedCorpseCount = Math.max(1, Math.floor(safeNumber(loot.groupedCorpseCount, 1)));
        loot.groupedCorpseNames = Array.isArray(loot.groupedCorpseNames) ? loot.groupedCorpseNames.filter(Boolean).slice(0, 20) : [];
        if (!loot.groupedCorpseNames.length && enemy?.name) loot.groupedCorpseNames.push(enemy.name);
        return loot;
      };

      Game.prototype.mergeCorpseLootIntoBag = function(bagEnemy, sourceEnemy) {
        const bagLoot = this.normalizeCorpseLootBag?.(bagEnemy);
        const sourceLoot = this.normalizeCorpseLootBag?.(sourceEnemy);
        if (!bagLoot || !sourceLoot || sourceLoot.looted) return false;
        const sourceName = sourceEnemy?.name || sourceEnemy?.baseType?.name || 'Enemy';
        bagLoot.currencyCopper = Math.max(0, Math.floor(safeNumber(bagLoot.currencyCopper, 0) + safeNumber(sourceLoot.currencyCopper, 0)));
        bagLoot.currency = this.splitCopperValueIntoCurrency?.(bagLoot.currencyCopper) || null;
        for (const entry of sourceLoot.items || []) {
          if (!entry || entry.taken) continue;
          this.appendCorpseLootEntryToBag?.(bagLoot, entry, sourceName);
        }
        const previousCount = Math.max(1, Math.floor(safeNumber(bagLoot.groupedCorpseCount, 1)));
        const addedCount = Math.max(1, Math.floor(safeNumber(sourceLoot.groupedCorpseCount, 1)));
        bagLoot.groupedCorpseCount = previousCount + addedCount;
        const names = new Set(Array.isArray(bagLoot.groupedCorpseNames) ? bagLoot.groupedCorpseNames : []);
        names.add(sourceName);
        for (const name of sourceLoot.groupedCorpseNames || []) if (name) names.add(name);
        bagLoot.groupedCorpseNames = Array.from(names).slice(0, 20);
        bagLoot.summary = this.summarizeCorpseLootBag?.(bagEnemy) || bagLoot.summary || 'group loot';
        bagLoot.groupLootBag = true;
        const total = Math.max(1, bagLoot.groupedCorpseCount);
        bagEnemy.x = ((Number(bagEnemy.x || 0) * previousCount) + (Number(sourceEnemy.x || bagEnemy.x || 0) * addedCount)) / total;
        bagEnemy.y = ((Number(bagEnemy.y || 0) * previousCount) + (Number(sourceEnemy.y || bagEnemy.y || 0) * addedCount)) / total;
        bagEnemy.name = `Corpse Bag (${bagLoot.groupedCorpseCount})`;
        bagEnemy.corpseLootSummary = bagLoot.summary;
        sourceLoot.currencyCopper = 0;
        sourceLoot.currency = this.splitCopperValueIntoCurrency?.(0) || null;
        sourceLoot.gold = 0;
        sourceLoot.items = [];
        sourceLoot.looted = true;
        sourceEnemy.corpseLooted = true;
        sourceEnemy.corpseLootInteractPending = false;
        sourceEnemy.corpseLootSummary = `Merged into ${bagEnemy.name}`;
        sourceEnemy.groupLootMergedInto = bagEnemy.id || bagEnemy.name || 'corpse-bag';
        this.lootableCorpses = (this.lootableCorpses || []).filter(corpse => corpse !== sourceEnemy);
        return true;
      };

      Game.prototype.summarizeCorpseLootBag = function(enemy) {
        const loot = enemy?.corpseLoot;
        if (!loot) return 'nothing';
        const entries = this.corpseLootEntries?.(enemy) || [];
        const parts = [];
        const currencyCopper = Math.floor(safeNumber(loot.currencyCopper, 0));
        if (currencyCopper > 0) parts.push(this.formatCopper?.(currencyCopper) || `${currencyCopper}C`);
        const itemNames = entries.slice(0, 4).map(entry => {
          const qty = Math.max(1, Math.floor(safeNumber(entry.quantity || entry.item?.stack || entry.item?.quantity || 1, 1)));
          const label = entry.item?.name || entry.name || entry.itemId || 'item';
          return qty > 1 ? `${label} x${qty}` : label;
        });
        parts.push(...itemNames);
        if (entries.length > itemNames.length) parts.push(`+${entries.length - itemNames.length} more`);
        return parts.length ? parts.join(', ') : 'nothing';
      };

      Game.prototype.corpseLootEntryKey = function(entry) {
        if (!entry) return '';
        const item = entry.item || {};
        const itemId = entry.itemId || item.itemId || item.sourceItemId || item.id || entry.name || item.name || '';
        const rarity = entry.rarityKey || item.rarityKey || item.rarity?.key || 'white';
        const generated = entry.generated || item.generated || item.kind === 'equipment' || item.slot || item.damage || item.stats && Object.keys(item.stats).length > 0;
        return generated ? '' : `${String(itemId)}::${String(rarity)}`;
      };

      Game.prototype.isCorpseLootEntryStackable = function(entry) {
        if (!entry) return false;
        const item = entry.item || {};
        if (entry.generated || item.kind === 'equipment' || item.slot && !['none', 'material', 'consumable'].includes(String(item.slot).toLowerCase())) return false;
        const maxStack = Math.max(1, Math.floor(safeNumber(item.maxStack || entry.maxStack, 1)));
        if (maxStack > 1) return true;
        const draft = this.getEditorItemDraft?.(entry.itemId || item.itemId || item.sourceItemId);
        if (draft && Math.max(1, Math.floor(safeNumber(draft.stackSize, 1))) > 1) return true;
        const kind = String(item.kind || item.category || draft?.type || '').toLowerCase();
        return /resource|material|consumable|currency|fish|ore|herb|silk|hide|pelt/.test(kind);
      };

      Game.prototype.appendCorpseLootEntryToBag = function(bagLoot, entry, sourceName = '') {
        if (!bagLoot || !entry || entry.taken) return false;
        bagLoot.items = Array.isArray(bagLoot.items) ? bagLoot.items : [];
        const next = { ...entry, taken: false, sourceName: sourceName || entry.sourceName || '' };
        const qty = Math.max(1, Math.floor(safeNumber(next.quantity || next.item?.stack || next.item?.quantity || 1, 1)));
        next.quantity = qty;
        if (next.item && typeof next.item === 'object') {
          next.item = { ...next.item };
          if (Math.max(1, Math.floor(safeNumber(next.item.maxStack, 1))) > 1 || this.isCorpseLootEntryStackable?.(next)) {
            next.item.stack = Math.max(qty, Math.floor(safeNumber(next.item.stack || next.item.quantity || qty, qty)));
            next.item.quantity = next.item.stack;
          }
        }
        const key = this.corpseLootEntryKey?.(next);
        if (key && this.isCorpseLootEntryStackable?.(next)) {
          const existing = bagLoot.items.find(item => !item.taken && this.corpseLootEntryKey?.(item) === key && this.isCorpseLootEntryStackable?.(item));
          if (existing) {
            const mergedQty = Math.max(1, Math.floor(safeNumber(existing.quantity || existing.item?.stack || existing.item?.quantity || 1, 1))) + qty;
            existing.quantity = mergedQty;
            if (existing.item && typeof existing.item === 'object') {
              existing.item.stack = mergedQty;
              existing.item.quantity = mergedQty;
            }
            if (sourceName) existing.sourceName = existing.sourceName && existing.sourceName !== sourceName ? `${existing.sourceName}, ${sourceName}` : sourceName;
            return true;
          }
        }
        bagLoot.items.push(next);
        return true;
      };

      Game.prototype.shouldMergeCorpseLootBags = function(bagEnemy, sourceEnemy, radius) {
        if (!bagEnemy || !sourceEnemy || bagEnemy === sourceEnemy) return false;
        if (this.corpseLootZoneKey?.(bagEnemy) !== this.corpseLootZoneKey?.(sourceEnemy)) return false;
        const dCorpse = Math.hypot(Number(bagEnemy.x || 0) - Number(sourceEnemy.x || 0), Number(bagEnemy.y || 0) - Number(sourceEnemy.y || 0));
        if (dCorpse <= radius) return true;
        if (!this.player) return false;
        const dBagPlayer = Math.hypot(Number(bagEnemy.x || 0) - Number(this.player.x || 0), Number(bagEnemy.y || 0) - Number(this.player.y || 0));
        const dSourcePlayer = Math.hypot(Number(sourceEnemy.x || 0) - Number(this.player.x || 0), Number(sourceEnemy.y || 0) - Number(this.player.y || 0));
        return dBagPlayer <= radius && dSourcePlayer <= radius;
      };

      Game.prototype.findGroupLootBagForCorpse = function(enemy) {
        if (!enemy || !enemy.corpseLoot || enemy.corpseLoot.looted) return null;
        const zone = this.corpseLootZoneKey?.(enemy);
        const now = performance.now?.() || Date.now();
        const radius = Math.max(6, Number(this.groupLootBagRadius || 10.5));
        let best = null;
        let bestScore = Infinity;
        for (const corpse of this.pruneLootableCorpses?.() || []) {
          if (!corpse || corpse === enemy || corpse.alive || !this.corpseLootHasItems?.(corpse)) continue;
          if (this.corpseLootZoneKey?.(corpse) !== zone) continue;
          const age = now - safeNumber(corpse.corpseLootCreatedAt, now);
          if (age > 180000) continue;
          if (!this.shouldMergeCorpseLootBags?.(corpse, enemy, radius)) continue;
          const dCorpse = Math.hypot(Number(corpse.x || 0) - Number(enemy.x || 0), Number(corpse.y || 0) - Number(enemy.y || 0));
          const dBagPlayer = this.player ? Math.hypot(Number(corpse.x || 0) - Number(this.player.x || 0), Number(corpse.y || 0) - Number(this.player.y || 0)) : Infinity;
          const dSourcePlayer = this.player ? Math.hypot(Number(enemy.x || 0) - Number(this.player.x || 0), Number(enemy.y || 0) - Number(this.player.y || 0)) : Infinity;
          const score = Math.min(dCorpse, Math.max(dBagPlayer, dSourcePlayer)) + (corpse.corpseLoot?.groupLootBag ? -2.0 : 0);
          if (score < bestScore) { best = corpse; bestScore = score; }
        }
        return best;
      };

      Game.prototype.registerLootableCorpse = function(enemy, lootResult = null) {
        if (!enemy || enemy.kind !== 'enemy') return false;
        this.lootableCorpses = Array.isArray(this.lootableCorpses) ? this.lootableCorpses : [];
        enemy.corpseLootInteractPending = true;
        enemy.corpseLootCreatedAt = performance.now?.() || Date.now();
        enemy.corpseLootZoneId = this.corpseLootZoneKey?.(enemy);
        enemy.corpseLootSummary = lootResult?.summary || enemy.corpseLoot?.summary || 'loot';
        enemy.isLootCorpse = true;
        enemy.blocksMovement = false;
        enemy.collisionRadius = 0;
        this.normalizeCorpseLootBag?.(enemy);
        const groupBag = this.findGroupLootBagForCorpse?.(enemy);
        if (groupBag && this.mergeCorpseLootIntoBag?.(groupBag, enemy)) {
          this.log?.(`${enemy.name || 'Enemy'} loot merged into ${groupBag.name || 'Corpse Bag'}.`, 'System');
          if (this.activeCorpseLootEnemy === groupBag) this.renderCorpseLootWindow?.();
          return true;
        }
        if (!this.lootableCorpses.includes(enemy)) this.lootableCorpses.push(enemy);
        if (enemy.corpseLoot) {
          enemy.corpseLoot.groupedCorpseCount = Math.max(1, Math.floor(safeNumber(enemy.corpseLoot.groupedCorpseCount, 1)));
          enemy.corpseLoot.groupedCorpseNames = enemy.corpseLoot.groupedCorpseNames?.length ? enemy.corpseLoot.groupedCorpseNames : [enemy.name || enemy.baseType?.name || 'Enemy'];
          enemy.corpseLoot.groupLootBag = Boolean(enemy.corpseLoot.groupedCorpseCount > 1);
        }
        return true;
      };

      Game.prototype.pruneLootableCorpses = function() {
        this.lootableCorpses = (Array.isArray(this.lootableCorpses) ? this.lootableCorpses : []).filter(enemy => enemy && !enemy.alive && this.corpseLootHasItems?.(enemy));
        return this.lootableCorpses;
      };

      Game.prototype.createTemporaryGroundItem = function(item, worldX, worldY, options = {}) {
        if (!item || !Number.isFinite(Number(worldX)) || !Number.isFinite(Number(worldY))) return null;
        const now = performance.now?.() || Date.now();
        const qty = Math.max(1, Math.floor(safeNumber(item.stack || item.quantity || item.qty || options.quantity, 1)));
        if (qty > 1) {
          item.stack = qty;
          item.quantity = qty;
          item.qty = qty;
        }
        const rarity = item.rarity || RARITIES?.find?.(r => r.key === (item.rarityKey || 'white')) || null;
        if (rarity && !item.rarity) item.rarity = rarity;
        const ground = {
          id: `ground_drop_${Math.floor(now)}_${Math.floor(Math.random() * 100000)}`,
          kind: 'enemy',
          baseType: { name: 'Dropped Item', family: 'ground_loot' },
          name: item.name || 'Dropped Item',
          x: Number(worldX),
          y: Number(worldY),
          z: 0,
          level: item.level || this.player?.level || 1,
          alive: false,
          hp: 0,
          maxHp: 1,
          temporaryGroundItem: true,
          playerDropped: options.source === 'player-drop',
          noSelfRespawn: true,
          corpseVisualExpired: true,
          isLootCorpse: true,
          blocksMovement: false,
          collisionRadius: 0,
          corpseLootCreatedAt: now,
          corpseLootZoneId: this.corpseLootZoneKey?.() || (this.currentZone === 'cave' ? 'cave' : this.currentZone === 'dungeon' ? 'dungeon' : 'dark_woods'),
          despawnAt: now + Math.max(1000, Number(options.despawnMs || 45000)),
          corpseLootSummary: item.name || 'Dropped Item',
          corpseLootInteractPending: true,
          corpseLoot: {
            tableId: 'player_drop',
            tableName: 'Player Drop',
            gold: 0,
            items: [{ item, itemId: item.itemId || item.sourceItemId || item.id || item.name, name: item.name, quantity: qty, rarityKey: item.rarityKey || item.rarity?.key || 'white', taken: false, playerDropped: true }],
            summary: item.name || 'Dropped Item',
            looted: false,
            groupedCorpseCount: 1,
            groupedCorpseNames: [item.name || 'Dropped Item'],
            playerDropped: true,
            groupLootBag: false
          }
        };
        this.enemies = Array.isArray(this.enemies) ? this.enemies : [];
        this.entities = Array.isArray(this.entities) ? this.entities : [];
        this.lootableCorpses = Array.isArray(this.lootableCorpses) ? this.lootableCorpses : [];
        this.enemies.push(ground);
        if (!this.entities.includes(ground)) this.entities.push(ground);
        this.lootableCorpses.push(ground);
        return ground;
      };

      Game.prototype.removeTemporaryGroundItem = function(ground) {
        if (!ground) return false;
        this.enemies = (Array.isArray(this.enemies) ? this.enemies : []).filter(entry => entry !== ground);
        this.entities = (Array.isArray(this.entities) ? this.entities : []).filter(entry => entry !== ground);
        this.lootableCorpses = (Array.isArray(this.lootableCorpses) ? this.lootableCorpses : []).filter(entry => entry !== ground);
        if (this.activeCorpseLootEnemy === ground) this.closeCorpseLootWindow?.();
        return true;
      };

      Game.prototype.updateGroundLoot = function(nowMs = performance.now?.() || Date.now()) {
        const now = Number(nowMs) || (performance.now?.() || Date.now());
        const drops = (Array.isArray(this.enemies) ? this.enemies : []).filter(enemy => enemy?.temporaryGroundItem);
        for (const drop of drops) {
          if (drop.corpseLoot?.looted || drop.corpseLooted || !this.corpseLootHasItems?.(drop) || Number(drop.despawnAt || 0) <= now) {
            this.removeTemporaryGroundItem?.(drop);
          }
        }
      };

      Game.prototype.tryPickupTemporaryGroundItem = function(ground) {
        if (!ground?.temporaryGroundItem || !this.player) return false;
        const entries = this.corpseLootEntries?.(ground) || [];
        const entry = entries[0];
        const item = entry?.item;
        if (!item) return false;
        const capacity = this.getBagCapacity?.() || (DR.CONFIG?.BAG_SIZE) || 12;
        const used = Array.isArray(this.inventory) ? this.inventory.filter(Boolean).length : 0;
        if (used >= capacity) {
          this.log?.('Your bags are full.', 'System');
          return false;
        }
        if (!this.grantRuntimeItem?.(item)) {
          this.log?.('Your bags are full.', 'System');
          return false;
        }
        entry.taken = true;
        ground.corpseLoot.looted = true;
        ground.corpseLooted = true;
        this.playAudioEvent?.('loot_item', { x: ground.x, y: ground.y, volume: 0.34 });
        this.log?.(`Picked up ${item.name || 'item'}.`, 'System');
        this.removeTemporaryGroundItem?.(ground);
        this.updateUI?.();
        if (this.bagOpen) this.renderBag?.();
        return true;
      };

      Game.prototype.pickTemporaryGroundItemAtScreen = function(sx, sy) {
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
        let best = null;
        let bestScore = Infinity;
        for (const drop of this.enemies || []) {
          if (!drop?.temporaryGroundItem || !this.corpseLootHasItems?.(drop)) continue;
          const tile = this.tileAt?.(drop.x, drop.y) || { elev: 0 };
          const screen = this.worldToScreen(drop.x, drop.y, tile.elev || 0);
          const dx = sx - screen.x;
          const dy = sy - (screen.y - 18);
          const score = (dx * dx) / (36 * 36) + (dy * dy) / (30 * 30);
          if (score <= 1 && score < bestScore) { best = drop; bestScore = score; }
        }
        return best;
      };

      Game.prototype.updateGroundLootHoverAtScreen = function(clientX, clientY, sx, sy) {
        if (this.currentItemDrag?.item || this.draggedItem) return false;
        const drop = this.pickTemporaryGroundItemAtScreen?.(sx, sy);
        if (!drop) {
          if (this.activeGroundLootTooltip) {
            this.activeGroundLootTooltip = null;
            this.hideItemTooltip?.();
          }
          return false;
        }
        const entry = this.corpseLootEntries?.(drop)?.[0];
        const item = entry?.item;
        if (!item) return false;
        this.activeGroundLootTooltip = drop;
        this.showItemTooltip?.(item, Number(clientX) || 0, Number(clientY) || 0, { source: 'ground-loot' });
        return true;
      };

      Game.prototype.updateCorpseCleanup = function(dt = 0) {
        this.updateGroundLoot?.();
        const visualSeconds = Math.max(5, Number(this.corpseVisualDespawnSeconds || 45));
        for (const enemy of this.enemies || []) {
          if (!enemy || enemy.alive || enemy.kind !== 'enemy') continue;
          const deadTime = Math.max(0, Number(enemy.deadTimer || 0));
          if (deadTime >= visualSeconds) {
            enemy.corpseVisualExpired = true;
            enemy.corpseLootInteractPending = this.corpseLootHasItems?.(enemy) || false;
          }
          if (enemy.corpseLoot?.looted || enemy.corpseLooted) {
            enemy.corpseLoot = null;
            enemy.corpseLootInteractPending = false;
          }
        }
        this.pruneLootableCorpses?.();
        if (this.activeCorpseLootEnemy && !this.corpseLootHasItems?.(this.activeCorpseLootEnemy)) this.closeCorpseLootWindow?.();
      };

      Game.prototype.corpseLootEntries = function(enemy) {
        const loot = enemy?.corpseLoot;
        if (!loot || loot.looted) return [];
        return Array.isArray(loot.items) ? loot.items.filter(entry => entry && !entry.taken && (entry.item || entry.itemId || entry.name)) : [];
      };

      Game.prototype.corpseLootHasItems = function(enemy) {
        const loot = enemy?.corpseLoot;
        if (!loot || loot.looted) return false;
        return safeNumber(loot.currencyCopper, safeNumber(loot.gold, 0) * 10000) > 0 || this.corpseLootEntries(enemy).length > 0;
      };

      Game.prototype.closeCorpseLootWindow = function() {
        this.activeCorpseLootEnemy = null;
        const panel = document.getElementById('corpseLootPanel');
        if (panel) panel.remove();
      };

      Game.prototype.centerCorpseLootWindow = function(panel) {
        if (!panel) return;
        panel.style.display = 'block';
        panel.hidden = false;
        panel.style.position = 'fixed';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.width = 'min(420px, calc(100vw - 30px))';
        panel.style.maxHeight = 'min(620px, calc(100vh - 120px))';
        panel.style.overflow = 'auto';
        panel.style.zIndex = '140';
      };

      Game.prototype.ensureCorpseLootWindow = function() {
        let panel = document.getElementById('corpseLootPanel');
        if (panel) {
          this.centerCorpseLootWindow(panel);
          return panel;
        }
        panel = document.createElement('section');
        panel.id = 'corpseLootPanel';
        panel.className = 'panel gameWindow corpseLootPanel';
        panel.style.cssText = [
          'display:block',
          'position:fixed',
          'left:50%',
          'top:50%',
          'right:auto',
          'bottom:auto',
          'transform:translate(-50%,-50%)',
          'width:min(420px,calc(100vw - 30px))',
          'max-height:min(620px,calc(100vh - 120px))',
          'overflow:auto',
          'z-index:140',
          'padding:12px'
        ].join(';');
        panel.hidden = false;
        document.body.appendChild(panel);
        panel.addEventListener('click', event => {
          const close = event.target.closest('[data-corpse-close]');
          if (close) { this.closeCorpseLootWindow(); return; }
          const takeAll = event.target.closest('[data-corpse-take-all]');
          if (takeAll) { this.takeAllCorpseLoot(); return; }
          const itemBtn = event.target.closest('[data-corpse-loot-index]');
          if (itemBtn) this.takeCorpseLootItem(Number(itemBtn.dataset.corpseLootIndex));
          const goldBtn = event.target.closest('[data-corpse-loot-gold]');
          if (goldBtn) this.takeCorpseLootGold();
        });
        return panel;
      };

      Game.prototype.openCorpseLootWindow = function(enemy, options = {}) {
        const silent = !!options.silent;
        const maxDistance = Number.isFinite(options.maxDistance) ? options.maxDistance : 2.4;
        const ignoreDistance = !!options.ignoreDistance;
        if (!enemy || enemy.alive || !this.corpseLootHasItems(enemy)) {
          if (!silent) this.log?.('Nothing to loot.', 'System');
          return false;
        }
        if (!ignoreDistance && this.player && Math.hypot((enemy.x || 0) - this.player.x, (enemy.y || 0) - this.player.y) > maxDistance) {
          if (!silent) this.log?.('Move closer to loot the corpse.', 'System');
          return false;
        }
        enemy.corpseLootAutoOpenPending = false;
        enemy.corpseLootAutoOpened = true;
        this.activeCorpseLootEnemy = enemy;
        this.renderCorpseLootWindow();
        this.playAudioEvent?.('ui_open', { x: enemy.x, y: enemy.y, volume: 0.25, cooldown: 0.16 });
        const panel = document.getElementById('corpseLootPanel');
        if (panel) {
          this.centerCorpseLootWindow?.(panel);
          panel.classList.add('open');
          panel.focus?.();
        }
        return true;
      };

      Game.prototype.tryOpenCorpseLootOnDeath = function(enemy) {
        if (!enemy || enemy.alive || !this.corpseLootHasItems?.(enemy)) return false;
        enemy.corpseLootInteractPending = true;
        enemy.corpseLootAutoOpenPending = false;
        enemy.corpseLootAutoOpened = false;
        this.registerLootableCorpse?.(enemy, enemy.corpseLoot || null);
        return false;
      };

      Game.prototype.updateCorpseLootAutoOpen = function() {
        // V0.12.45 intentionally disables death-time auto opening.
        // Corpse bags are opened by pressing the Interact key near a lootable corpse.
      };

      Game.prototype.nearestLootableCorpse = function(range = 4.5) {
        if (!this.player) return null;
        let best = null;
        let bestD = Math.max(0.1, Number(range) || 4.5);
        const candidates = [];
        const seen = new Set();
        for (const enemy of this.pruneLootableCorpses?.() || []) {
          if (enemy && !seen.has(enemy)) { seen.add(enemy); candidates.push(enemy); }
        }
        for (const enemy of this.enemies || []) {
          if (enemy && !seen.has(enemy)) { seen.add(enemy); candidates.push(enemy); }
        }
        for (const enemy of candidates) {
          if (!enemy || enemy.alive || !this.corpseLootHasItems?.(enemy)) continue;
          const d = Math.hypot((enemy.x || 0) - this.player.x, (enemy.y || 0) - this.player.y);
          if (d <= bestD) {
            best = enemy;
            bestD = d;
          }
        }
        return best;
      };

      Game.prototype.tryInteractCorpseLoot = function(options = {}) {
        if (!this.started || this.paused || !this.player || !this.player.alive) return false;
        const range = Number.isFinite(options.range) ? options.range : 4.5;
        const corpse = this.nearestLootableCorpse?.(range);
        if (!corpse) {
          if (!options.silent) this.log?.('No lootable corpse nearby. Stand on or next to a corpse with a currency loot marker and press E.', 'System');
          return false;
        }
        const opened = this.openCorpseLootWindow?.(corpse, { silent: !!options.silent, maxDistance: range }) || false;
        if (opened) this.log?.(`Opened Corpse Loot: ${corpse.name || 'corpse'}.`, 'System');
        return opened;
      };

      Game.prototype.renderCorpseLootWindow = function() {
        const enemy = this.activeCorpseLootEnemy;
        if (!enemy || !this.corpseLootHasItems(enemy)) {
          this.closeCorpseLootWindow();
          return;
        }
        const panel = this.ensureCorpseLootWindow();
        const loot = enemy.corpseLoot || {};
        const entries = this.corpseLootEntries(enemy);
        const currencyCopper = safeNumber(loot.currencyCopper, safeNumber(loot.gold, 0) * 10000);
        const itemCells = entries.map((entry, i) => {
          const item = entry.item || { name: entry.name || entry.itemId || 'Item', itemId: entry.itemId, rarityKey: entry.rarityKey, stack: entry.quantity || 1 };
          const qty = Math.max(1, Math.floor(safeNumber(entry.quantity || item.stack || item.quantity || 1, 1)));
          const icon = this.itemIconHtml?.(item, 'inventoryIcon') || '';
          return `<button class="corpseLootSlot itemSlot" data-corpse-loot-index="${i}" data-tooltip-corpse-loot-index="${i}" draggable="true" style="--rarity-color:${escapeHtml(item.rarity?.color || item.icon?.color || '#cfdac8')};--icon-color:${escapeHtml(item.rarity?.color || item.icon?.color || '#cfdac8')}">
            ${icon}
            <span class="corpseLootName">${escapeHtml(item.name || entry.name || 'Item')}</span>
            <span class="corpseLootQty">${qty > 1 ? `x${qty}` : ''}</span>
          </button>`;
        }).join('');
        const groupedCount = Math.max(1, Math.floor(safeNumber(loot.groupedCorpseCount, 1)));
        const bagTitle = groupedCount > 1 ? `Group Corpse Bag (${groupedCount})` : 'Corpse Loot';
        const sourceText = groupedCount > 1
          ? `${groupedCount} corpses gathered together · ${escapeHtml((loot.groupedCorpseNames || []).slice(0, 3).join(', ') || 'group loot')}${(loot.groupedCorpseNames || []).length > 3 ? '…' : ''}`
          : escapeHtml(enemy.name || enemy.baseType?.name || 'Defeated Enemy');
        panel.innerHTML = `
          <div class="windowHeader">
            <div>
              <div class="name">${escapeHtml(bagTitle)}</div>
              <div class="small">${sourceText}</div>
            </div>
            <button data-corpse-close>Close</button>
          </div>
          <div class="small" style="margin:6px 0 10px">Corpse bag opened with E. Nearby kills merge into this one bag. Click items or Take All to move drops into your bags.</div>
          ${currencyCopper > 0 ? `<button class="corpseGoldRow" data-corpse-loot-gold>Take ${escapeHtml(this.formatCopper?.(currencyCopper) || `${currencyCopper}C`)}</button>` : ''}
          <div class="corpseLootGrid">${itemCells || '<div class="small">No items remain.</div>'}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:10px"><button data-corpse-take-all>Take All</button></div>
        `;
        this.bindItemTooltips?.(panel, node => {
          const idx = Number(node.dataset.tooltipCorpseLootIndex);
          const entry = this.corpseLootEntries?.(this.activeCorpseLootEnemy)?.[idx];
          return entry?.item || (entry ? { name: entry.name || entry.itemId || 'Item', itemId: entry.itemId, rarityKey: entry.rarityKey, stack: entry.quantity || 1 } : null);
        }, { source: 'corpse-loot' });
      };

      // Phase 4 (NPC AI/Spawn/Leash/Loot Ownership): systems/party-system.js
      // has tagged corpseLoot.party (eligibleIds/partyLoot/rule) on every
      // kill since an earlier pass, and already logs "corpse loot is
      // party-tagged for N eligible members" - but nothing ever actually
      // checked that tag before this. Any client could take a corpse's
      // loot regardless of party membership. This is the single choke
      // point both take functions below call before mutating loot, so the
      // tag is now enforced, not just labeled. Solo kills (the overwhelming
      // majority of play) always have partyLoot===false and are untouched
      // by this check - it only activates for genuine multi-member party
      // kills (rule: 'party-round-robin-local').
      Game.prototype.isCorpseLootEligibleForLocalPlayer = function(enemy) {
        const policy = enemy?.corpseLoot?.party;
        if (!policy?.partyLoot) return true;
        const eligibleIds = Array.isArray(policy.eligibleIds) ? policy.eligibleIds : null;
        if (!eligibleIds || !eligibleIds.length) return true;
        return eligibleIds.includes(this.localPeerId);
      };

      Game.prototype.takeCorpseLootGold = function() {
        const enemy = this.activeCorpseLootEnemy;
        const loot = enemy?.corpseLoot;
        if (!loot) return false;
        if (!this.isCorpseLootEligibleForLocalPlayer?.(enemy)) {
          this.log?.('This loot is reserved for the party that defeated it.', 'System');
          return false;
        }
        const currencyCopper = Math.floor(safeNumber(loot.currencyCopper, safeNumber(loot.gold, 0) * 10000));
        if (currencyCopper <= 0) return false;
        this.addCopper ? this.addCopper(currencyCopper) : (this.player.coinCopper = Math.max(0, Number(this.player.coinCopper || 0) + currencyCopper));
        loot.currencyCopper = 0;
        loot.currency = this.splitCopperValueIntoCurrency?.(0) || null;
        loot.gold = 0;
        this.playAudioEvent?.('coin_pickup', { x: enemy.x, y: enemy.y, volume: 0.36 });
        this.log?.(`Looted ${this.formatCopper?.(currencyCopper) || `${currencyCopper}C`} from ${enemy.name || 'corpse'}.`, 'System');
        this.updateUI?.();
        this.finishCorpseLootIfEmpty(enemy);
        this.renderCorpseLootWindow?.();
        return true;
      };

      Game.prototype.takeCorpseLootItem = function(visibleIndex) {
        const enemy = this.activeCorpseLootEnemy;
        if (!this.isCorpseLootEligibleForLocalPlayer?.(enemy)) {
          this.log?.('This loot is reserved for the party that defeated it.', 'System');
          return false;
        }
        const entries = this.corpseLootEntries(enemy);
        const entry = entries[visibleIndex];
        if (!entry) return false;
        let item = entry.item;
        if (!item && entry.itemId) {
          const draft = this.getEditorItemDraft?.(entry.itemId);
          item = this.createRuntimeItemInstance?.(entry.itemId, entry.quantity || 1, { rarityKey: entry.rarityKey || 'white' })
            || this.createRuntimeItemFromDraft?.(draft, entry.quantity || 1, { rarityKey: entry.rarityKey || 'white' });
        }
        if (!item) return false;
        if (!this.grantRuntimeItem?.(item)) {
          this.log?.('Your bags are full.', 'System');
          return false;
        }
        entry.taken = true;
        this.playAudioEvent?.('loot_item', { x: enemy.x, y: enemy.y, volume: 0.34 });
        this.log?.(`Looted ${item.name || entry.name || 'item'}.`, 'System');
        this.notifyExternalSystems?.('item-looted', {
          itemId: item.itemId || item.id || entry.itemId || null, name: item.name || entry.name || 'item',
          qty: entry.quantity || 1, sourceId: enemy?.id ?? null
        });
        this.updateUI?.();
        this.finishCorpseLootIfEmpty(enemy);
        this.renderCorpseLootWindow?.();
        return true;
      };

      Game.prototype.takeAllCorpseLoot = function() {
        this.takeCorpseLootGold?.();
        let progressed = true;
        while (progressed) {
          const before = this.corpseLootEntries(this.activeCorpseLootEnemy).length;
          if (!before) break;
          this.takeCorpseLootItem(0);
          const after = this.corpseLootEntries(this.activeCorpseLootEnemy).length;
          progressed = after < before;
        }
      };

      Game.prototype.finishCorpseLootIfEmpty = function(enemy) {
        const loot = enemy?.corpseLoot;
        if (!loot) return false;
        if (safeNumber(loot.currencyCopper, safeNumber(loot.gold, 0) * 10000) <= 0 && this.corpseLootEntries(enemy).length === 0) {
          loot.looted = true;
          enemy.corpseLooted = true;
          this.lootableCorpses = (this.lootableCorpses || []).filter(corpse => corpse !== enemy);
          this.closeCorpseLootWindow();
          return true;
        }
        return false;
      };

      Game.prototype.pickCorpseAtScreen = function(sx, sy) {
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
        let best = null;
        let bestScore = Infinity;
        for (const enemy of this.enemies || []) {
          if (!enemy || enemy.alive || !this.corpseLootHasItems?.(enemy)) continue;
          const screen = this.worldToScreen(enemy.x, enemy.y, ((this.tileAt?.(enemy.x, enemy.y) || { elev: 0 }).elev || 0) + (enemy.z || 0));
          if (!screen) continue;
          const dx = sx - screen.x;
          const dy = sy - (screen.y - 8);
          const score = (dx * dx) / (42 * 42) + (dy * dy) / (28 * 28);
          if (score <= 1 && score < bestScore) {
            best = enemy;
            bestScore = score;
          }
        }
        return best;
      };
    }
  };
})();
