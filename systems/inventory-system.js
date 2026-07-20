// Dream Realms external inventory and equipment runtime system
// Pass 46 QoL: six-slot bag bar, 12-slot starter bag, money display, and capacity-safe item placement.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  DR.InventorySystem = {
    install(Game) {
      const ui = DR.ui;
      const { CONFIG, RARITIES, EQUIP_SLOTS, SLOT_LABELS, CLASSES } = DR;
      const { clamp } = DR.utils;
      const COPPER_PER_SILVER = 100;
      const COPPER_PER_GOLD = 10000;
      const COPPER_PER_PLATINUM = 1000000;

      Game.prototype.ensureBagSystem = function() {
        const slotCount = CONFIG.BAG_SLOT_COUNT || 6;
        if (!Array.isArray(this.bags)) this.bags = [];
        const starterSlots = CONFIG.STARTER_BAG_SLOTS || CONFIG.BAG_SIZE || 12;
        if (!this.bags[0]) {
          this.bags[0] = { id: 'bag_starter_satchel', kind: 'bag', name: 'Starter Satchel', slots: starterSlots, rarity: RARITIES[1] || RARITIES[0], value: 0, starter: true, locked: true, description: 'Your main starting bag. Holds money and 12 item slots.' };
        }
        this.bags[0].slots = Math.max(starterSlots, Math.floor(Number(this.bags[0].slots) || starterSlots));
        this.bags[0].starter = true;
        this.bags[0].locked = true;
        while (this.bags.length < slotCount) this.bags.push(null);
        if (this.bags.length > slotCount) this.bags.length = slotCount;
        return this.bags;
      };

      Game.prototype.getBagCapacity = function() {
        return this.ensureBagSystem().reduce((sum, bag) => sum + Math.max(0, Math.floor(Number(bag?.slots) || 0)), 0);
      };

      Game.prototype.getBagSections = function() {
        let start = 0;
        return this.ensureBagSystem().map((bag, index) => {
          const slots = Math.max(0, Math.floor(Number(bag?.slots) || 0));
          const section = { index, bag, start, slots };
          start += slots;
          return section;
        });
      };

      Game.prototype.isBagItem = function(item) {
        return item && ((item.kind || item.type) === 'bag' || Number(item.slots || item.bagSlots || item.stats?.slots) > 0);
      };

      Game.prototype.normalizeBagItem = function(item) {
        if (!item) return null;
        const rarity = item.rarity || RARITIES.find(r => r.key === (item.rarityKey || 'white')) || RARITIES[1] || RARITIES[0];
        return {
          id: item.id || this.itemSerial++,
          itemId: item.itemId || item.sourceItemId || item.id || item.name,
          kind: 'bag',
          type: 'bag',
          name: item.name || 'Adventurer Bag',
          slots: Math.max(4, Math.floor(Number(item.slots || item.bagSlots || item.stats?.slots) || 8)),
          rarity,
          rarityKey: rarity.key,
          value: Math.max(1, Math.floor(Number(item.value) || 8)),
          description: item.description || 'An equippable bag that increases carried item slots.'
        };
      };

      Game.prototype.totalCopper = function() {
        if (!this.player) return 0;
        if (!Number.isFinite(Number(this.player.coinCopper))) this.player.coinCopper = Math.max(0, Math.floor(Number(this.player.gold) || 0) * COPPER_PER_GOLD);
        return Math.max(0, Math.floor(Number(this.player.coinCopper) || 0));
      };

      Game.prototype.moneyBreakdown = function() {
        let copper = this.totalCopper();
        const platinum = Math.floor(copper / COPPER_PER_PLATINUM);
        copper -= platinum * COPPER_PER_PLATINUM;
        const gold = Math.floor(copper / COPPER_PER_GOLD);
        copper -= gold * COPPER_PER_GOLD;
        const silver = Math.floor(copper / COPPER_PER_SILVER);
        copper -= silver * COPPER_PER_SILVER;
        return { copper, silver, gold, platinum };
      };

      Game.prototype.moneyText = function() {
        const m = this.moneyBreakdown();
        return `(C):${m.copper} (S):${m.silver} (G):${m.gold} (P):${m.platinum}`;
      };

      Game.prototype.addCopper = function(amount) {
        if (!this.player) return;
        this.player.coinCopper = Math.max(0, this.totalCopper() + Math.floor(Number(amount) || 0));
      };

      Game.prototype.addGold = function(amount) {
        this.addCopper((Math.floor(Number(amount) || 0)) * COPPER_PER_GOLD);
      };

      Game.prototype.spendGold = function(amount) {
        if (!this.player) return false;
        return this.spendCopper((Math.max(0, Math.floor(Number(amount) || 0))) * COPPER_PER_GOLD);
      };

      // V0.18.99: the whole economy runs on the real currency (100 copper = 1 silver, 100 silver =
      // 1 gold, 100 gold = 1 platinum) rather than a flat "gold" abstraction. COPPER is the internal
      // unit; every price/reward/cost is converted to copper at its source and displayed through
      // formatCopper, so all four denominations actually appear. Authored money values (item
      // sellValue, quest rewards, training/merc costs) are on the SILVER scale - see addSilver.
      Game.prototype.spendCopper = function(amount) {
        if (!this.player) return false;
        const cost = Math.max(0, Math.floor(Number(amount) || 0));
        if (this.totalCopper() < cost) return false;
        this.player.coinCopper = this.totalCopper() - cost;
        return true;
      };

      Game.prototype.addSilver = function(amount) {
        this.addCopper((Math.floor(Number(amount) || 0)) * COPPER_PER_SILVER);
      };

      Game.prototype.spendSilver = function(amount) {
        return this.spendCopper((Math.max(0, Math.floor(Number(amount) || 0))) * COPPER_PER_SILVER);
      };

      // Convert an authored silver-scale money value into copper.
      Game.prototype.silverToCopper = function(amount) {
        return Math.max(0, Math.floor(Number(amount) || 0)) * COPPER_PER_SILVER;
      };

      Game.prototype.toggleBag = function(force) {
        const wasOpen = !!this.bagOpen;
        this.bagOpen = typeof force === 'boolean' ? force : !this.bagOpen;
        ui.bagPanel.style.display = this.bagOpen ? 'block' : 'none';
        if (this.started && wasOpen !== this.bagOpen) this.playAudioEvent?.(this.bagOpen ? 'bag_open' : 'ui_close');
        if (this.bagOpen) this.renderBag();
      };

      Game.prototype.addItem = function(item) {
        if (!item) return false;
        this.ensureBagSystem();
        if (this.isBagItem(item)) item = this.normalizeBagItem(item);
        const capacity = this.getBagCapacity();
        if (this.inventory.length >= capacity) {
          // V0.18.98: the bags-full overflow auto-sell must pay exactly what selling to a vendor pays -
          // same formula AND same unit. It previously credited addGold(item.value): the item's FULL
          // value, in GOLD, bypassing the sell formula entirely - about 26,000-36,000x more than a
          // deliberate vendor sale (vendorSellInventoryIndex credits addCopper(itemSellValue(item))).
          // That made overflowing your bags a gold faucet and made selling gear the worse choice.
          const value = Math.max(1, Math.floor(Number(this.itemSellValue?.(item) ?? item.value ?? 1)));
          if (this.addCopper) this.addCopper(value);
          else this.addGold?.(value);
          this.log(`Bags full. ${item.name} sold for ${this.formatCopper ? this.formatCopper(value) : `${value}c`}.`);
          return false;
        }
        this.inventory.push(item);
        if (this.started) this.playAudioEvent?.('loot_item', { volume: 0.24, cooldown: 0.08 });
        this.notifyExternalSystems?.('item-gained', { itemId: item.itemId || item.id, name: item.name, qty: item.stack || 1, item });
        this.bagDirty = true;
        if (this.bagOpen) this.renderBag();
        return true;
      };


      Game.prototype.classStarterGearIds = function(className = this.player?.className) {
        const starterGear = {
          Paladin: [
            'item_starter_v01689_paladin_oath_mace',
            'item_starter_v01689_paladin_lantern_shield',
            'item_starter_v01689_paladin_dull_mail',
            'item_starter_v01689_paladin_squire_greaves',
            'item_starter_v01689_paladin_oathwalker_boots'
          ],
          Warden: [
            'item_starter_v01689_warden_root_mallet',
            'item_starter_v01689_warden_barkguard',
            'item_starter_v01689_warden_thornhide_vest',
            'item_starter_v01689_warden_rootfiber_leggings',
            'item_starter_v01689_warden_mossbound_boots'
          ],
          Fighter: [
            'item_starter_v01689_fighter_rustcleaver',
            'item_starter_v01689_fighter_bruisers_token',
            'item_starter_v01689_fighter_split_leather_vest',
            'item_starter_v01689_fighter_bruiser_pants',
            'item_starter_v01689_fighter_stride_boots'
          ],
          Rogue: [
            'item_starter_v01689_rogue_gutter_dagger',
            'item_starter_v01689_rogue_sleeve_shiv',
            'item_starter_v01689_rogue_shadowpatched_jerkin',
            'item_starter_v01689_rogue_cutpurse_pants',
            'item_starter_v01689_rogue_softfall_boots'
          ],
          Ranger: [
            'item_starter_v01689_ranger_greenwood_bow',
            'item_starter_v01689_ranger_frayed_quiver',
            'item_starter_v01689_ranger_trailhide_jerkin',
            'item_starter_v01689_ranger_pathfinder_pants',
            'item_starter_v01689_ranger_miretrail_boots'
          ],
          Assassin: [
            'item_starter_v01689_assassin_hand_crossbow',
            'item_starter_v01689_assassin_throwing_fangs',
            'item_starter_v01689_assassin_nightpad_vest',
            'item_starter_v01689_assassin_silent_trousers',
            'item_starter_v01689_assassin_ghoststep_boots'
          ],
          Wizard: [
            'item_starter_v01689_wizard_splinter_wand',
            'item_starter_v01689_wizard_chipped_orb',
            'item_starter_v01689_wizard_threadbare_robe',
            'item_starter_v01689_wizard_inkmarked_trousers',
            'item_starter_v01689_wizard_softstep_slippers'
          ],
          Shaman: [
            'item_starter_v01689_shaman_raincaller_rod',
            'item_starter_v01689_shaman_pebble_totem',
            'item_starter_v01689_shaman_stormhide_wrap',
            'item_starter_v01689_shaman_riverwoven_leggings',
            'item_starter_v01689_shaman_mudsole_boots'
          ],
          Summoner: [
            'item_starter_v01689_summoner_binder_rod',
            'item_starter_v01689_summoner_pact_grimoire',
            'item_starter_v01689_summoner_teal_initiate_robe',
            'item_starter_v01689_summoner_boundcloth_pants',
            'item_starter_v01689_summoner_circle_sandals'
          ],
          Necromancer: [
            'item_starter_v01689_necromancer_bonepin_wand',
            'item_starter_v01689_necromancer_chalk_skull',
            'item_starter_v01689_necromancer_gravecloth_robe',
            'item_starter_v01689_necromancer_bonewrap_leggings',
            'item_starter_v01689_necromancer_gravedust_boots'
          ],
          Cleric: [
            'item_starter_v01689_cleric_bell_mace',
            'item_starter_v01689_cleric_wooden_prayer_icon',
            'item_starter_v01689_cleric_plain_chain_vest',
            'item_starter_v01689_cleric_field_chain_leggings',
            'item_starter_v01689_cleric_candlewax_boots'
          ],
          Druid: [
            'item_starter_v01689_druid_crooked_branch_staff',
            'item_starter_v01689_druid_seedling_totem',
            'item_starter_v01689_druid_leafmend_robe',
            'item_starter_v01689_druid_barkwoven_leggings',
            'item_starter_v01689_druid_dewmoss_sandals'
          ],
          Bard: [
            'item_starter_v01689_bard_camp_songblade',
            'item_starter_v01689_bard_weathered_lute',
            'item_starter_v01689_bard_minstrel_vest',
            'item_starter_v01689_bard_travel_tights',
            'item_starter_v01689_bard_stageworn_boots'
          ],
          Enchanter: [
            'item_starter_v01689_enchanter_rune_wand',
            'item_starter_v01689_enchanter_clouded_orb',
            'item_starter_v01689_enchanter_faded_silk_robe',
            'item_starter_v01689_enchanter_runecloth_trousers',
            'item_starter_v01689_enchanter_quietmind_slippers'
          ]
        };
        return starterGear[className] ? [...starterGear[className]] : [];
      };

      Game.prototype.createStarterEquipmentItem = function(itemId) {
        const item = this.createRuntimeItemInstance?.(itemId, 1, { rarityKey: 'white', level: 1, sourceLevel: 1 });
        if (item) {
          item.starter = true;
          item.bound = true;
          item.description = item.description || 'Basic starter equipment.';
          return item;
        }
        const result = this.grantEditorItem?.(itemId, 1, { rarityKey: 'white', level: 1, sourceLevel: 1 });
        if (!result?.ok) return null;
        const idx = (this.inventory || []).findIndex(invItem => String(invItem?.itemId || invItem?.sourceItemId || invItem?.id || '') === itemId);
        if (idx < 0) return null;
        const fallback = this.inventory.splice(idx, 1)[0];
        if (fallback) {
          fallback.starter = true;
          fallback.bound = true;
        }
        return fallback || null;
      };


      Game.prototype.hasAnyClassStarterGear = function(className = this.player?.className) {
        const ids = new Set(this.classStarterGearIds?.(className) || []);
        if (!ids.size) return false;
        const matches = item => {
          const id = String(item?.itemId || item?.sourceItemId || item?.id || '');
          return ids.has(id);
        };
        if (Object.values(this.equipment || {}).some(matches)) return true;
        if ((this.inventory || []).some(matches)) return true;
        for (const bag of this.bags || []) {
          if ((bag?.items || []).some(matches)) return true;
        }
        return false;
      };

      Game.prototype.grantClassStartingGear = function(className = this.player?.className) {
        if (!this.player) return false;
        if (!this.classStartingGearGranted && this.hasAnyClassStarterGear?.(className)) {
          this.classStartingGearGranted = true;
        }
        if (this.classStartingGearGranted) return false;
        const ids = this.classStarterGearIds(className);
        if (!ids.length) return false;
        this.ensureBagSystem?.();
        this.ensureEquipmentSlots?.();
        let equipped = 0;
        let stored = 0;
        for (const itemId of ids) {
          const item = this.createStarterEquipmentItem(itemId);
          if (!item) continue;
          const slot = this.resolveEquipmentSlotForItem?.(item, true) || this.canonicalEquipmentSlot?.(item.slot) || item.slot;
          if (slot && this.equipment && Object.prototype.hasOwnProperty.call(this.equipment, slot) && !this.equipment[slot]) {
            item.slot = slot;
            this.equipment[slot] = item;
            equipped++;
          } else if (this.addItem?.(item)) {
            stored++;
          }
        }
        this.classStartingGearGranted = true;
        this.recalculatePlayerStats?.();
        this.bagDirty = true;
        this.renderBag?.();
        this.updateUI?.();
        if (equipped || stored) this.log?.(`Starting gear equipped for ${className}.`);
        return equipped > 0 || stored > 0;
      };


      Game.prototype.isMaterialItem = function(item) {
        return item && ['material', 'resource', 'quest', 'currency'].includes(item.kind || item.type || '');
      };

      Game.prototype.isConsumableItem = function(item) {
        return item && (item.kind === 'consumable' || item.type === 'consumable');
      };

      Game.prototype.addMaterialItem = function(data) {
        if (!data || !data.name) return false;
        const rarity = RARITIES.find(r => r.key === (data.rarityKey || 'white')) || RARITIES[1];
        const stack = Math.max(1, Math.floor(data.stack || 1));
        const existing = this.inventory.find(item => this.isMaterialItem(item) && item.name === data.name && item.rarity.key === rarity.key);
        if (existing) {
          existing.stack = (existing.stack || 1) + stack;
          this.notifyExternalSystems?.('item-gained', { itemId: data.id || data.itemId || data.name, name: data.name, qty: stack, item: existing });
          this.bagDirty = true;
          if (this.bagOpen) this.renderBag();
          return true;
        }
        return this.addItem({
          id: this.itemSerial++,
          itemId: data.id || data.itemId || data.name,
          kind: 'material',
          name: data.name,
          baseName: data.name,
          category: data.category || 'Material',
          rarity,
          stats: {},
          level: data.level || 1,
          stack,
          value: Math.max(1, Math.floor(data.value || 1)),
          description: data.description || 'A useful crafting material.',
          classes: [],
          slot: 'material'
        });
      };

      Game.prototype.itemStatsText = function(item) {
        if (this.isMaterialItem(item)) return item.description || item.category || 'Material';
        if (this.isConsumableItem(item)) {
          const effect = item.useEffect || item.stats || {};
          const parts = [];
          const hp = effect.hp ?? effect.heal ?? item.stats?.hp;
          const mana = effect.mana ?? effect.restoreMana ?? item.stats?.mana;
          if (hp) parts.push(`Restores ${hp} HP`);
          if (mana) parts.push(`Restores ${mana} Mana`);
          return parts.join(' · ') || item.description || 'Consumable';
        }
        const labels = {
          hp: 'HP', mana: 'Mana', attack: 'Damage', defense: 'Defense', armor: 'Armor', speed: 'Speed',
          strength: 'STR', dexterity: 'DEX', stamina: 'STA', intelligence: 'INT', wisdom: 'WIS',
          cdr: 'CDR Rating', cooldownReduction: 'CDR Rating', crit: 'Crit Rating', critChance: 'Crit Rating',
          magicCrit: 'Magic Crit Rating', magicCritChance: 'Magic Crit Rating', critDamage: 'Crit Dmg Rating',
          magicCritDamage: 'Magic Crit Dmg Rating', spellPower: 'Spell Power', magicPower: 'Magic Power',
          healingPower: 'Healing Power', physicalPower: 'Physical Power', damagePower: 'Damage Power',
          damagePct: 'Damage %', physicalDamagePct: 'Physical Damage %', magicDamagePct: 'Magic Damage %', healingPct: 'Healing %'
        };
        const stats = { ...(item.stats || {}) };
        if (item.armor && !stats.armor) stats.armor = item.armor;
        return Object.entries(stats)
          .filter(([, value]) => Number(value) !== 0)
          .map(([stat, value]) => {
            const label = labels[stat] || stat.toUpperCase();
            const amount = stat === 'speed' ? Number(value).toFixed(2) : (Number.isInteger(Number(value)) ? Math.round(Number(value)) : Number(value).toFixed(1));
            return `${label} ${value > 0 ? '+' : ''}${amount}`;
          })
          .join(' · ');
      };

      Game.prototype.canEquip = function(item) {
        if (!item || this.isMaterialItem(item) || this.isConsumableItem(item) || !this.player) return false;
        const classes = this.itemAllowedClasses?.(item) || Object.keys(CLASSES || {});
        const slot = this.resolveEquipmentSlotForItem?.(item, false) || this.canonicalEquipmentSlot?.(item.slot) || item.slot;
        if (!(DR.EQUIP_SLOTS || []).includes(slot)) return false;
        if ((item.levelRequirement || item.level || 1) > this.player.level) return false;
        const classAllowed = classes.includes(this.player.className) || classes.length === Object.keys(CLASSES || {}).length;
        if (!classAllowed) return false;
        if (slot === 'offhand' && String(this.player.className || '').toLowerCase() === 'rogue') return this.isRogueDualWieldWeapon?.(item) || String(item.type || '').toLowerCase() !== 'weapon';
        return true;
      };

      Game.prototype.equipInventoryItem = function(index) {
        const item = this.inventory[index];
        if (!item) return;
        if (this.isBagItem(item)) return this.equipBagFromInventory(index);
        if (this.isConsumableItem(item)) return this.useInventoryItem?.(index);
        if (this.isMaterialItem(item)) return this.log(`${item.name} is a material.`);
        if (!this.canEquip(item)) return this.log(`${item.name} cannot be equipped by ${this.player.className}.`);
        const targetSlot = this.resolveEquipmentSlotForItem?.(item, true) || item.slot;
        if (!targetSlot || !(DR.EQUIP_SLOTS || []).includes(targetSlot)) return this.log(`${item.name} has no valid equipment slot.`);
        const old = this.equipment[targetSlot];
        item.slot = targetSlot;
        this.equipment[targetSlot] = item;
        this.inventory.splice(index, 1);
        if (old) this.inventory.push(old);
        this.recalculatePlayerStats();
        if (this.player) this.player.gearVisualChangedAt = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        this.bagDirty = true;
        this.renderBag();
        this.updateUI();
        this.playAudioEvent?.('item_equip', { volume: 0.38 });
        this.log(`Equipped ${item.name}.`);
      };

      Game.prototype.equipBagFromInventory = function(index) {
        this.ensureBagSystem();
        const item = this.normalizeBagItem(this.inventory[index]);
        if (!item) return false;
        const empty = this.bags.findIndex((bag, slot) => slot > 0 && !bag);
        if (empty < 0) {
          this.log('All bag slots are occupied. Unequip a bag first.');
          return false;
        }
        this.inventory.splice(index, 1);
        this.bags[empty] = item;
        this.bagDirty = true;
        this.renderBag();
        this.playAudioEvent?.('item_equip', { volume: 0.34 });
        this.log(`Equipped ${item.name} in bag slot ${empty + 1}.`);
        return true;
      };

      Game.prototype.unequipBagSlot = function(slot) {
        this.ensureBagSystem();
        const index = Math.floor(Number(slot));
        if (index <= 0) return this.log('The starter satchel cannot be removed.');
        const bag = this.bags[index];
        if (!bag) return;
        const removedSlots = Math.max(0, Math.floor(Number(bag.slots) || 0));
        const remainingCapacity = this.getBagCapacity() - removedSlots;
        if (this.inventory.length + 1 > remainingCapacity) {
          this.log(`Cannot unequip ${bag.name}. Move or sell items first.`);
          return false;
        }
        this.bags[index] = null;
        this.inventory.push(this.normalizeBagItem(bag));
        this.bagDirty = true;
        this.renderBag();
        this.log(`Unequipped ${bag.name}.`);
        return true;
      };

      Game.prototype.unequipSlot = function(slot) {
        const item = this.equipment[slot];
        if (!item) return;
        if (this.inventory.length >= this.getBagCapacity()) return this.log('Bags are full. Cannot unequip.');
        this.equipment[slot] = null;
        this.inventory.push(item);
        this.recalculatePlayerStats();
        if (this.player) this.player.gearVisualChangedAt = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
        this.renderBag();
        this.updateUI();
        this.playAudioEvent?.('item_equip', { volume: 0.24, rate: 0.86 });
        this.log(`Unequipped ${item.name}.`);
      };

      Game.prototype.normalizeItemStats = function(item) {
        const source = item?.stats && typeof item.stats === 'object' ? item.stats : {};
        const stats = DR.StatSystem?.cleanStats ? DR.StatSystem.cleanStats(source) : { ...source };
        if (item?.armor && !stats.armor) stats.armor = Number(item.armor) || 0;
        return stats;
      };

      Game.prototype.equipmentComparisonStats = function(item) {
        if (!item) return {};
        const stats = { ...(this.normalizeItemStats?.(item) || {}) };
        const damage = item.damage && typeof item.damage === 'object' ? item.damage : null;
        const set = (key, value) => {
          const number = Number(value);
          if (Number.isFinite(number) && number !== 0 && !Number.isFinite(Number(stats[key]))) stats[key] = number;
        };
        set('damage', typeof item.damage === 'number' ? item.damage : null);
        set('minDamage', item.minDamage ?? item.damageMin ?? damage?.min);
        set('maxDamage', item.maxDamage ?? item.damageMax ?? damage?.max);
        set('attackPower', item.attackPower);
        set('spellPower', item.spellPower);
        set('healingPower', item.healingPower);
        return stats;
      };

      Game.prototype.scoreEquipmentItem = function(item, playerClass = this.player?.className) {
        if (!item) return 0;
        const stats = this.equipmentComparisonStats?.(item) || {};
        const classKey = String(playerClass || '').toLowerCase();
        const attributeWeights = {
          fighter: { strength: 1.0, dexterity: 0.55, intelligence: 0.15, wisdom: 0.25 },
          rogue: { strength: 0.65, dexterity: 1.0, intelligence: 0.15, wisdom: 0.20 },
          cleric: { strength: 0.20, dexterity: 0.20, intelligence: 0.72, wisdom: 1.0 },
          druid: { strength: 0.25, dexterity: 0.30, intelligence: 0.82, wisdom: 0.92 },
          bard: { strength: 0.30, dexterity: 0.68, intelligence: 0.45, wisdom: 0.68 },
          summoner: { strength: 0.10, dexterity: 0.20, intelligence: 1.0, wisdom: 0.58 },
          necromancer: { strength: 0.10, dexterity: 0.18, intelligence: 1.0, wisdom: 0.52 },
          enchanter: { strength: 0.10, dexterity: 0.18, intelligence: 1.0, wisdom: 0.72 }
        };
        const attributes = attributeWeights[classKey] || { strength: 0.65, dexterity: 0.65, intelligence: 0.65, wisdom: 0.65 };
        const weights = {
          armor: 0.70, damage: 1.0, minDamage: 0.50, maxDamage: 0.50, attack: 0.90,
          strength: attributes.strength, dexterity: attributes.dexterity, intelligence: attributes.intelligence, wisdom: attributes.wisdom,
          stamina: 0.80, spirit: 0.65, hp: 0.08, maxHp: 0.08, mana: 0.06, maxMana: 0.06,
          attackPower: 0.80, physicalPower: 0.80, spellPower: 0.80, magicPower: 0.80, healingPower: 0.80,
          crit: 0.90, critChance: 0.90, magicCrit: 0.90, magicCritChance: 0.90, haste: 0.80, speed: 2.0,
          defense: 0.70, resist: 0.45, fireResist: 0.40, coldResist: 0.40, frostResist: 0.40,
          poisonResist: 0.40, shadowResist: 0.40, natureResist: 0.40, cdr: 0.75, cooldownReduction: 0.75
        };
        return Object.entries(stats).reduce((score, [key, value]) => score + (Number(value) || 0) * (weights[key] || 0), 0);
      };

      Game.prototype.compareItemToEquipped = function(item) {
        if (!item || this.isMaterialItem?.(item) || this.isConsumableItem?.(item) || this.isBagItem?.(item)) return null;
        this.ensureEquipmentSlots?.();
        const rawSlot = String(item.slot || item.equipSlot || '').toLowerCase();
        const canonical = this.canonicalEquipmentSlot?.(rawSlot) || rawSlot;
        if (!(DR.EQUIP_SLOTS || []).includes(canonical)) return null;
        const dualSlots = ['ring', 'ring1', 'ring2'].includes(rawSlot) || ['ring1', 'ring2'].includes(canonical)
          ? ['ring1', 'ring2']
          : (['earring', 'earring1', 'earring2'].includes(rawSlot) || ['earring1', 'earring2'].includes(canonical)
            ? ['earring1', 'earring2']
            : (this.isRogueDualWieldWeapon?.(item) && ['weapon', 'offhand'].includes(canonical) ? ['weapon', 'offhand'] : [canonical]));
        const candidates = dualSlots.map(slot => ({ slot, item: this.equipment?.[slot] || null }));
        if (candidates.length === 1 && candidates[0].item === item) return null;
        const comparison = candidates.find(entry => !entry.item)
          || candidates.filter(entry => entry.item !== item).sort((a, b) => this.scoreEquipmentItem?.(a.item) - this.scoreEquipmentItem?.(b.item))[0]
          || candidates[0];
        const equipped = comparison?.item || null;
        const nextStats = this.equipmentComparisonStats?.(item) || {};
        const oldStats = this.equipmentComparisonStats?.(equipped) || {};
        const statKeys = [...new Set([...Object.keys(nextStats), ...Object.keys(oldStats)])].filter(key => Number(nextStats[key] || 0) !== Number(oldStats[key] || 0));
        const labels = {
          hp: 'Health', maxHp: 'Health', mana: 'Mana', maxMana: 'Mana', attack: 'Damage', damage: 'Damage', minDamage: 'Min Damage', maxDamage: 'Max Damage',
          armor: 'Armor', defense: 'Defense', strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence', wisdom: 'Wisdom', stamina: 'Stamina', spirit: 'Spirit',
          attackPower: 'Attack Power', physicalPower: 'Physical Power', spellPower: 'Spell Power', magicPower: 'Magic Power', healingPower: 'Healing Power',
          crit: 'Crit', critChance: 'Crit', magicCrit: 'Magic Crit', magicCritChance: 'Magic Crit', haste: 'Haste', speed: 'Speed', resist: 'Resist',
          fireResist: 'Fire Resist', coldResist: 'Cold Resist', frostResist: 'Frost Resist', poisonResist: 'Poison Resist', shadowResist: 'Shadow Resist', natureResist: 'Nature Resist'
        };
        const deltas = statKeys.map(key => {
          const delta = Number(nextStats[key] || 0) - Number(oldStats[key] || 0);
          const value = Math.abs(delta) < 1 && !Number.isInteger(delta) ? delta.toFixed(2) : String(Math.round(delta));
          return { key, delta, text: `${labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}: ${delta > 0 ? '+' : ''}${value}` };
        });
        const nextScore = this.scoreEquipmentItem?.(item) || 0;
        const oldScore = this.scoreEquipmentItem?.(equipped) || 0;
        const scoreDelta = nextScore - oldScore;
        const overall = !equipped ? 'No equipped item' : scoreDelta > 0.05 ? 'Upgrade' : scoreDelta < -0.05 ? 'Downgrade' : 'Sidegrade';
        return { slot: comparison.slot, equipped, deltas, nextScore, oldScore, scoreDelta, overall, dualSlot: dualSlots.length > 1 };
      };

      Game.prototype.canonicalEquipmentSlot = function(slot) {
        const raw = String(slot || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const aliases = {
          ring: 'ring1', ring_1: 'ring1', ring_l: 'ring1', ring_left: 'ring1', ring_2: 'ring2', ring_r: 'ring2', ring_right: 'ring2',
          earring: 'earring1', earring_1: 'earring1', earring_l: 'earring1', earring_left: 'earring1', earring_2: 'earring2', earring_r: 'earring2', earring_right: 'earring2',
          shoulder: 'shoulders', pauldron: 'shoulders', pauldrons: 'shoulders', mantle: 'shoulders',
          helm: 'head', helmet: 'head', hood: 'head', body: 'chest', torso: 'chest', robe: 'chest',
          glove: 'hands', gloves: 'hands', boot: 'feet', boots: 'feet', cloak: 'cape', back: 'cape', necklace: 'amulet', neck: 'amulet', trinket: 'charm', relic: 'charm', waist: 'belt', belt: 'belt', sash: 'belt',
          mainhand: 'weapon', main_hand: 'weapon', off_hand: 'offhand', offhand_weapon: 'offhand', shield: 'offhand', focus: 'offhand'
        };
        return aliases[raw] || raw;
      };

      Game.prototype.itemAllowedClasses = function(item) {
        const all = Object.keys(CLASSES || {});
        if (!item) return all;
        if (Array.isArray(item.classes) && item.classes.length) return item.classes;
        if (Array.isArray(item.classRestrictions) && item.classRestrictions.length) return item.classRestrictions;
        if (Array.isArray(item.allowedClasses) && item.allowedClasses.length) return item.allowedClasses;
        return all;
      };

      Game.prototype.weaponFamilyForItem = function(item) {
        if (!item) return '';
        const tokens = [];
        const add = value => {
          if (Array.isArray(value)) value.forEach(add);
          else if (value != null) tokens.push(String(value).toLowerCase());
        };
        add(item.weaponType);
        add(item.weaponFamily);
        add(item.subtype);
        add(item.category);
        add(item.icon?.family);
        add(item.tags);
        add(item.name);
        add(item.id);
        const joined = tokens.join(' ').replace(/[_-]+/g, ' ');
        if (/\b(dagger|knife|stiletto|dirk|fangblade|fang)\b/.test(joined)) return 'dagger';
        if (/\b(fist|knuckle|cestus|claw|handwrap|hand wrap|punch|katars?|gauntlet)\b/.test(joined)) return 'fist';
        if (/\b(sword|shortsword|short sword|rapier|sabre|saber|scimitar|blade|cutlass)\b/.test(joined)) return 'sword';
        if (/\b(staff|wand|scepter|mace|hammer|axe|bow|crossbow|polearm|greatsword|greataxe|shield|focus|orb|totem|symbol)\b/.test(joined)) return joined.match(/\b(staff|wand|scepter|mace|hammer|axe|bow|crossbow|polearm|greatsword|greataxe|shield|focus|orb|totem|symbol)\b/)?.[1] || '';
        return '';
      };

      Game.prototype.isRogueDualWieldWeapon = function(item, actor = this.player) {
        const className = String(actor?.className || actor?.playerClass || '').toLowerCase();
        if (className !== 'rogue' || !item) return false;
        const type = String(item.type || '').toLowerCase();
        const slot = this.canonicalEquipmentSlot?.(item.slot || item.equipSlot || '') || '';
        const weaponish = type === 'weapon' || slot === 'weapon' || !!item.damage || !!item.minDamage || !!item.maxDamage;
        if (!weaponish) return false;
        const tokenText = [item.weaponType, item.weaponFamily, item.subtype, item.category, item.tags, item.name, item.id].flat().join(' ').toLowerCase();
        if (item.twoHanded || item.hands === 2 || /\b(two handed|two-handed|2h|greatsword|greataxe|polearm|staff|bow|crossbow)\b/.test(tokenText)) return false;
        return ['dagger', 'sword', 'fist'].includes(this.weaponFamilyForItem?.(item));
      };

      Game.prototype.getRogueDualWieldOffhandWeapon = function(actor = this.player) {
        if (String(actor?.className || '').toLowerCase() !== 'rogue') return null;
        const item = actor?.equipment?.offhand || actor?.gear?.offhand || null;
        return this.isRogueDualWieldWeapon?.(item, actor) ? item : null;
      };

      Game.prototype.ensureEquipmentSlots = function() {
        this.equipment = this.equipment && typeof this.equipment === 'object' && !Array.isArray(this.equipment) ? this.equipment : {};
        for (const slot of DR.EQUIP_SLOTS || []) {
          if (!Object.prototype.hasOwnProperty.call(this.equipment, slot)) this.equipment[slot] = null;
        }
        const moveAlias = (from, targets) => {
          const item = this.equipment?.[from];
          if (!item) return;
          for (const target of targets) {
            if ((DR.EQUIP_SLOTS || []).includes(target) && !this.equipment[target]) {
              item.slot = target;
              this.equipment[target] = item;
              delete this.equipment[from];
              return;
            }
          }
        };
        for (const from of Object.keys(this.equipment)) {
          if ((DR.EQUIP_SLOTS || []).includes(from)) continue;
          if (from === 'ring') moveAlias(from, ['ring1', 'ring2']);
          else if (from === 'earring') moveAlias(from, ['earring1', 'earring2']);
          else {
            const target = this.canonicalEquipmentSlot?.(from);
            if (target && target !== from) moveAlias(from, [target]);
          }
        }
        return this.equipment;
      };

      Game.prototype.resolveEquipmentSlotForItem = function(item, preferEmpty = true) {
        const raw = String(item?.slot || item?.equipSlot || '').toLowerCase();
        const normalized = this.canonicalEquipmentSlot?.(raw) || raw;
        const slots = DR.EQUIP_SLOTS || [];
        this.ensureEquipmentSlots?.();
        if (['ring', 'ring1', 'ring2'].includes(raw) || ['ring1', 'ring2'].includes(normalized)) {
          if (preferEmpty) {
            if (normalized === 'ring2' && !this.equipment?.ring2) return 'ring2';
            if (normalized === 'ring1' && !this.equipment?.ring1) return 'ring1';
            if (!this.equipment?.ring1) return 'ring1';
            if (!this.equipment?.ring2) return 'ring2';
          }
          return slots.includes(normalized) ? normalized : 'ring1';
        }
        if (['earring', 'earring1', 'earring2'].includes(raw) || ['earring1', 'earring2'].includes(normalized)) {
          if (preferEmpty) {
            if (normalized === 'earring2' && !this.equipment?.earring2) return 'earring2';
            if (normalized === 'earring1' && !this.equipment?.earring1) return 'earring1';
            if (!this.equipment?.earring1) return 'earring1';
            if (!this.equipment?.earring2) return 'earring2';
          }
          return slots.includes(normalized) ? normalized : 'earring1';
        }
        if (this.isRogueDualWieldWeapon?.(item) && ['weapon', 'offhand'].includes(normalized)) {
          if (normalized === 'offhand') return 'offhand';
          if (preferEmpty) {
            if (!this.equipment?.weapon) return 'weapon';
            if (!this.equipment?.offhand) return 'offhand';
          }
          return 'weapon';
        }
        return slots.includes(normalized) ? normalized : '';
      };

      Game.prototype.gearVisualColor = function(slot) {
        const item = this.equipment?.[slot];
        return item ? (item.visualColor || item.rarity?.color || item.icon?.color || '#cfdac8') : null;
      };

      Game.prototype.paperDollStyle = function() {
        this.ensureEquipmentSlots?.();
        const cls = CLASSES?.[this.player?.className] || {};
        const styles = [];
        const set = (key, value) => { if (value) styles.push(`${key}:${value}`); };
        set('--pd-head', this.gearVisualColor('head') || cls.color || '#8e8570');
        set('--pd-shoulders', this.gearVisualColor('shoulders') || '#3f5a35');
        set('--pd-chest', this.gearVisualColor('chest') || this.player?.clothesPrimary || cls.color || '#5f8550');
        set('--pd-hands', this.gearVisualColor('hands') || '#6f6756');
        set('--pd-legs', this.gearVisualColor('legs') || this.player?.clothesSecondary || '#4b4338');
        set('--pd-feet', this.gearVisualColor('feet') || '#2a2119');
        set('--pd-cape', this.gearVisualColor('cape') || '#1f2b24');
        set('--pd-belt', this.gearVisualColor('belt') || '#8f6b42');
        set('--pd-amulet', this.gearVisualColor('amulet') || '#d7bf74');
        set('--pd-earring1', this.gearVisualColor('earring1') || '#d6d0b4');
        set('--pd-earring2', this.gearVisualColor('earring2') || '#d6d0b4');
        set('--pd-ring1', this.gearVisualColor('ring1') || '#d1c479');
        set('--pd-ring2', this.gearVisualColor('ring2') || '#d1c479');
        set('--pd-weapon', this.gearVisualColor('weapon') || '#cfdac8');
        set('--pd-offhand', this.gearVisualColor('offhand') || '#5d4433');
        set('--pd-charm', this.gearVisualColor('charm') || '#83d873');
        return styles.join(';');
      };

      Game.prototype.paperDollMarkup = function() {
        this.ensureEquipmentSlots?.();
        const cls = this.player?.className || 'Fighter';
        const visual = DR.classBackgroundVisualSpec?.(cls) || null;
        const classBg = visual?.backgroundCss || (DR.creatorClassBackgroundImagePath?.(cls) ? `url('${DR.creatorClassBackgroundImagePath(cls)}')` : '');
        const classEmblem = visual?.emblemCss || (DR.classEmblemImagePath?.(cls) ? `url('${DR.classEmblemImagePath(cls)}')` : '');
        const classColor = visual?.color || '#d8ad57';
        const style = [
          this.paperDollStyle?.() || '',
          classBg ? `--pd-class-bg:${classBg}` : '',
          classBg ? `--pd-class-bg-image:${classBg}` : '',
          classBg ? `--party-class-bg:${classBg}` : '',
          classBg ? `--party-class-bg-image:${classBg}` : '',
          classEmblem ? `--pd-class-emblem:${classEmblem}` : '',
          classEmblem ? `--party-class-emblem-bg:${classEmblem}` : '',
          `--pd-class-color:${classColor}`,
          `--party-class-color:${classColor}`
        ].filter(Boolean).join(';');
        return `<div class="paperDollPreview fullGearPaperDoll classModelPaperDoll characterModelViewport classBackgroundSurface" style="${escapeHtml(style)}" data-paper-doll-slots="${(DR.EQUIP_SLOTS || []).length}" data-paper-doll-class="${escapeHtml(cls)}" data-class-background-key="${escapeHtml(visual?.key || String(cls).toLowerCase())}">
          <div class="paperDollClassBackdrop" aria-hidden="true"><span></span></div>
          <canvas class="paperDollClassCanvas" data-paper-doll-class-model aria-label="${escapeHtml(cls)} equipped class model preview" style="position:absolute;inset:0;width:100%;height:100%;display:block;filter:drop-shadow(0 10px 10px rgba(0,0,0,0.52));"></canvas>
        </div>`;
      };

      Game.prototype.renderPaperDollClassModel = function(rootNode = document) {
        const canvas = rootNode?.querySelector?.('[data-paper-doll-class-model]');
        if (!canvas || !canvas.getContext || !this.player) return false;
        const host = canvas.parentElement;
        const bounds = host?.getBoundingClientRect?.() || canvas.getBoundingClientRect?.() || { width: 168, height: 246 };
        const dpr = Math.max(1, Math.min(2, Number(window.devicePixelRatio) || 1));
        const cssWidth = Math.max(160, Math.round(bounds.width || 168));
        const cssHeight = Math.max(260, Math.round(bounds.height || 246));
        const targetWidth = Math.max(160, Math.round(cssWidth * dpr));
        const targetHeight = Math.max(260, Math.round(cssHeight * dpr));
        if (canvas.width !== targetWidth) canvas.width = targetWidth;
        if (canvas.height !== targetHeight) canvas.height = targetHeight;
        const context = canvas.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.scale(dpr, dpr);
        const w = cssWidth;
        const h = cssHeight;
        const cls = String(this.player.className || 'Fighter');
        DR.drawClassBackgroundPanelBackdrop?.(context, cls, w, h, {
          coverAlpha: 0.82
        }, this);
        context.imageSmoothingEnabled = false;
        const key = cls.toLowerCase();
        const model = key === 'bard'
          ? (DR.render?.BardProceduralModel || window.BardProceduralModel)
          : key === 'druid'
            ? (DR.render?.DruidProceduralModel || window.DruidProceduralModel)
            : (DR.render?.ClassIdentityProceduralModel || window.ClassIdentityProceduralModel);
        if (!model?.draw) return false;
        const actor = {
          ...this.player,
          sourceEntity: null,
          equipment: this.equipment || {},
          visualEquipment: this.equipment || {},
          gearVisualChangedAt: this.player?.gearVisualChangedAt || 0,
          kind: 'player',
          className: cls,
          playerClass: cls,
          classId: cls,
          screenX: 0,
          screenY: 0,
          facingName: 'south',
          facingX: 0,
          facingY: 1,
          isPreview: true,
          isMoving: false,
          action: 'idle',
          meditating: false,
          fishing: false,
          attackAnim: 0,
          spellCastAnim: 0,
          hitAnim: 0,
          deathProgress: 0,
          alive: true
        };
        context.save();
        try {
          // V0.16.48 fit pass: the ornate sheet stage is wide but can become
          // vertically constrained on common 900-1080p desktops. The previous
          // presentation scale was still too aggressive for tall hats, robes,
          // offhands, and pet-class weapons. Fit by a conservative body envelope and
          // lift the foot anchor onto the pedestal band so the full equipped model
          // remains visible without changing gameplay renderers.
          const classScaleBoosts = {
            bard: 3.02,
            cleric: 2.96,
            druid: 2.98,
            enchanter: 2.98,
            fighter: 2.92,
            necromancer: 2.96,
            rogue: 2.98,
            summoner: 2.96,
            paladin: 2.90,
            warden: 2.92,
            ranger: 2.96,
            assassin: 2.98,
            wizard: 2.98,
            shaman: 2.98
          };
          const targetScale = classScaleBoosts[key] || 2.96;
          const headAndPropReserve = Math.max(96, h * 0.145);
          const heightScale = Math.max(1.95, Math.min(3.12, (h - headAndPropReserve) / 168));
          const widthScale = Math.max(1.95, Math.min(3.08, w / 104));
          const scale = Math.max(1.95, Math.min(targetScale, heightScale, widthScale));
          const footPadding = Math.max(58, Math.round(h * 0.105));
          const verticalNudge = Math.round(h * 0.015);
          context.translate(w / 2, h - footPadding - verticalNudge);
          context.scale(scale, scale);
          model.draw(context, actor, performance.now());
          return true;
        } catch (err) {
          this.recordRuntimeSystemFault?.({ id: 'paper-doll-class-model' }, 'render', err);
          return false;
        } finally {
          context.restore();
        }
      };

      Game.prototype.equipmentIconLabel = function(item, slot) {
        if (!item) return SLOT_LABELS[slot] || slot;
        const name = String(item.name || '').toLowerCase();
        if (slot === 'weapon') {
          if (name.includes('dagger') || name.includes('fang')) return 'Dagger';
          if (name.includes('staff') || name.includes('wand')) return 'Staff';
          if (name.includes('mace')) return 'Mace';
          if (name.includes('cleaver') || name.includes('axe')) return 'Axe';
          return 'Blade';
        }
        if (slot === 'offhand') {
          if (String(item.type || '').toLowerCase() === 'weapon' || item.damage || item.minDamage || item.maxDamage) {
            const family = this.weaponFamilyForItem?.(item);
            if (family === 'dagger') return 'Off-hand Dagger';
            if (family === 'sword') return 'Off-hand Sword';
            if (family === 'fist') return 'Off-hand Fist';
            return 'Off-hand Weapon';
          }
          return name.includes('shield') ? 'Shield' : 'Focus';
        }
        return SLOT_LABELS[slot] || slot;
      };

      Game.prototype.recalculatePlayerStats = function() {
        if (!this.player) return;
        const hpRatio = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
        const mpRatio = this.player.maxMana > 0 ? this.player.mana / this.player.maxMana : 1;
        const totals = DR.StatSystem?.cleanStats?.({}) || { hp: 0, mana: 0, attack: 0, defense: 0, speed: 0 };
        const add = stats => {
          if (!stats || typeof stats !== 'object') return;
          if (DR.StatSystem?.addStats) DR.StatSystem.addStats(totals, stats);
          else for (const [stat, value] of Object.entries(stats)) totals[stat] = (totals[stat] || 0) + Number(value || 0);
        };
        const training = this.npcTrainingBonuses && typeof this.npcTrainingBonuses === 'object' ? this.npcTrainingBonuses : null;
        if (training) add(training);
        // V0.17.69 Talents: talent stat ranks feed the same aggregator as gear
        // and trainer bonuses, so crit/cdr/armor DR are applied once by
        // computePlayerDerived - talents get no special-case math.
        add(this.talentStatBonuses?.() || null);
        this.ensureEquipmentSlots?.();
        for (const item of Object.values(this.equipment || {})) {
          if (!item) continue;
          add(item.stats || {});
          if (item.armor && !item.stats?.armor) totals.armor = (totals.armor || 0) + Number(item.armor || 0);
        }

        // V0.20.41 (Roadmap Item 8): armour proficiency adds bonus armour derived from equipped pieces
        // and the player's skill level in each armour type. Added to the same aggregator as gear, so it
        // flows through computePlayerDerived once and is recomputed on every equip - never written into
        // any item's base armour.
        const armorProfBonus = this.armorProficiencyDefenseBonus?.() || 0;
        if (armorProfBonus > 0) totals.armor = (totals.armor || 0) + armorProfBonus;

        // V0.18.89 (Roadmap Item 14 - stat pipeline): armour SET bonuses are a first-class stat
        // source. For each fully-equipped set, add its bonus.stats to the same aggregator as gear,
        // so set stats flow through computePlayerDerived exactly once. Because this whole function
        // re-runs on every equip/unequip, a set bonus is added once and removed immediately when a
        // piece comes off - it is never written into base stats. (bonus.xpPercent / bonus.
        // meditationSpeedPercent stay live-checked at their own hooks and are not stats.)
        const armorSets = DR.ARMOR_SETS || {};
        for (const setId of Object.keys(armorSets)) {
          const set = armorSets[setId];
          if (set?.bonus?.stats && this.hasFullArmorSet?.(setId)) add(set.bonus.stats);
        }

        const classDef = DR.CLASSES?.[this.player.className];
        const derived = DR.StatSystem?.computePlayerDerived?.(this.player.className, this.player.level || 1, {
          maxHp: this.player.baseMaxHp ?? this.player.maxHp,
          maxMana: this.player.baseMaxMana ?? this.player.maxMana,
          attack: this.player.baseAttack ?? this.player.attack,
          defense: this.player.baseDefense ?? this.player.defense,
          speed: this.player.baseSpeed ?? this.player.speed,
          // Phase 8a: optional, opt-in fields - absent on every class today,
          // so these stay 0 (fully inert) until a class descriptor sets them.
          magicResist: this.player.baseMagicResist ?? classDef?.magicResist ?? 0,
          hpRegen: classDef?.hpRegenPerSecond ?? 0,
          manaRegen: classDef?.manaRegenPerSecond ?? 0
        }, totals, DR.getRaceDefinition?.(this.player.raceId)?.statMods || {});

        if (derived) {
          this.player.attributes = { ...derived.attributes };
          this.player.statRatings = { ...derived.totals };
          this.player.derivedStats = { ...derived };
          this.player.maxHp = derived.maxHp;
          this.player.maxMana = derived.maxMana;
          this.player.attack = derived.attack;
          this.player.defense = derived.defense;
          this.player.speed = derived.speed;
          this.player.armor = derived.armorRating;
          this.player.armorReduction = derived.armorReduction;
          this.player.magicResistRating = derived.magicResistRating;
          this.player.magicResistReduction = derived.magicResistReduction;
          this.player.poisonResistRating = derived.poisonResistRating;
          this.player.poisonResistReduction = derived.poisonResistReduction;
          this.player.hpRegen = derived.hpRegen;
          this.player.manaRegen = derived.manaRegen;
          this.player.cooldownReduction = derived.cooldownReduction;
          this.player.critChance = derived.critChance;
          this.player.magicCritChance = derived.magicCritChance;
          this.player.critDamageMultiplier = derived.critDamageMultiplier;
          this.player.magicCritDamageMultiplier = derived.magicCritDamageMultiplier;
          this.player.physicalDamageMultiplier = derived.physicalDamageMultiplier;
          this.player.magicDamageMultiplier = derived.magicDamageMultiplier;
          this.player.healingMultiplier = derived.healingMultiplier;
        } else {
          this.player.maxHp = this.player.baseMaxHp + Math.floor(totals.hp || 0);
          this.player.maxMana = this.player.baseMaxMana + Math.floor(totals.mana || 0);
          this.player.attack = this.player.baseAttack + Math.floor(totals.attack || 0);
          this.player.defense = this.player.baseDefense + Math.floor(totals.defense || 0);
          this.player.speed = this.player.baseSpeed + (totals.speed || 0);
        }

        this.player.hp = clamp(Math.floor(this.player.maxHp * hpRatio), 1, this.player.maxHp);
        this.player.mana = clamp(Math.floor(this.player.maxMana * mpRatio), 0, this.player.maxMana);
        this.recalculatePlayerGearScore?.(this.player);
      };

      // V0.18.90 (Roadmap Item 14 - inspectable stat pipeline): return the per-source raw stat
      // contributions that recalculatePlayerStats aggregates, in the SAME order and from the SAME
      // sources, so the character sheet can show where each stat comes from. This does NOT recompute
      // anything - it mirrors the aggregator's inputs (trainer -> talents -> equipment -> set) and
      // reports the already-derived final values for reference. Read-only; safe to call any time.
      Game.prototype.getPlayerStatBreakdown = function() {
        const p = this.player;
        if (!p) return null;
        const addTo = (target, stats) => {
          if (!stats || typeof stats !== 'object') return;
          for (const [k, v] of Object.entries(stats)) {
            const n = Number(v || 0);
            if (n) target[k] = (target[k] || 0) + n;
          }
        };
        const sources = { trainer: {}, talents: {}, equipment: {}, set: {} };
        const training = this.npcTrainingBonuses;
        if (training && typeof training === 'object') addTo(sources.trainer, training);
        addTo(sources.talents, this.talentStatBonuses?.() || null);
        for (const item of Object.values(this.equipment || {})) {
          if (!item) continue;
          addTo(sources.equipment, item.stats || {});
          if (item.armor && !item.stats?.armor) sources.equipment.armor = (sources.equipment.armor || 0) + Number(item.armor || 0);
        }
        const armorSets = DR.ARMOR_SETS || {};
        for (const setId of Object.keys(armorSets)) {
          const set = armorSets[setId];
          if (set?.bonus?.stats && this.hasFullArmorSet?.(setId)) addTo(sources.set, set.bonus.stats);
        }
        const final = {
          attack: p.attack, hp: p.maxHp, mana: p.maxMana,
          defense: p.defense, armor: p.armor ?? p.defense, speed: p.speed
        };
        return { sources, final };
      };

      // V0.18.91 (Roadmap Item 14/22 - stat pipeline regression harness): an isolated self-check of
      // the stat pipeline's invariants. It runs on a SCRATCH player + equipment (saving/restoring the
      // real game state) and is fully wrapped in try/catch, so it can never disturb or break the game.
      // Asserts: recalc is idempotent (no bonus is written into base stats), equip adds a contribution
      // once, unequip removes it, and a full-set stat bonus is applied and drops when a piece is
      // removed. Returns { ok, total, failed, checks }. Advisory only.
      Game.prototype.runStatPipelineSelfTest = function() {
        const checks = [];
        const assert = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || '' });
        const savedPlayer = this.player;
        const savedEquip = this.equipment;
        try {
          const cls = (DR.CLASSES && Object.keys(DR.CLASSES)[0]) || 'Fighter';
          const mk = () => ({ className: cls, level: 5, raceId: 'human', baseMaxHp: 200, baseMaxMana: 100, baseAttack: 20, baseDefense: 10, baseSpeed: 1.0, hp: 200, maxHp: 200, mana: 100, maxMana: 100 });
          const emptyEquip = () => Object.fromEntries((DR.EQUIP_SLOTS || ['head', 'chest', 'legs', 'feet', 'weapon']).map(s => [s, null]));

          // 1. Idempotency: recalc twice on the same inputs must NOT change the result (no base pollution).
          this.player = mk(); this.equipment = emptyEquip();
          this.recalculatePlayerStats(); const baseHp = this.player.maxHp;
          this.recalculatePlayerStats(); const baseHp2 = this.player.maxHp;
          assert('baseline recalc is idempotent', baseHp === baseHp2, `${baseHp} vs ${baseHp2}`);

          // 2/3. Equip adds a contribution once (no double-count on re-recalc); unequip removes it.
          const chestItem = this.createRuntimeItemInstance?.('item_wanderer_garb', 1);
          if (chestItem) {
            this.player = mk(); this.equipment = emptyEquip(); this.equipment.chest = chestItem;
            this.recalculatePlayerStats(); const eqHp = this.player.maxHp;
            this.recalculatePlayerStats(); const eqHp2 = this.player.maxHp;
            assert('equipping increases the stat', eqHp > baseHp, `${eqHp} > ${baseHp}`);
            assert('equip contribution is not double-counted', eqHp === eqHp2, `${eqHp} vs ${eqHp2}`);
            this.equipment.chest = null; this.recalculatePlayerStats();
            assert('unequipping removes the contribution', this.player.maxHp === baseHp, `${this.player.maxHp} vs ${baseHp}`);
          } else {
            assert('test item available', false, 'createRuntimeItemInstance returned null');
          }

          // 4. Set bonus: full set applies its stat aura, and it drops when a piece is removed.
          const set = DR.ARMOR_SETS?.dark_woods_wanderer;
          if (set && typeof this.hasFullArmorSet === 'function') {
            const slotMap = { item_wanderer_hood: 'head', item_wanderer_garb: 'chest', item_wanderer_leggings: 'legs', item_wanderer_boots: 'feet' };
            this.player = mk(); this.equipment = emptyEquip();
            set.pieceIds.forEach(id => { this.equipment[slotMap[id]] = this.createRuntimeItemInstance(id, 1); });
            this.recalculatePlayerStats();
            const fullHp = this.player.maxHp;
            assert('full set is detected', this.hasFullArmorSet('dark_woods_wanderer') === true, '');
            // toggle the set stat aura off (same equipment) to isolate its contribution
            const savedStats = set.bonus.stats; set.bonus.stats = null;
            this.player = mk(); this.recalculatePlayerStats();
            const noAuraHp = this.player.maxHp;
            set.bonus.stats = savedStats;
            assert('set stat bonus is applied through the pipeline', fullHp > noAuraHp, `${fullHp} > ${noAuraHp}`);
            this.equipment.feet = null;
            assert('set bonus drops when a piece is removed', this.hasFullArmorSet('dark_woods_wanderer') === false, '');
          }

          // 8. Save/load safety: round-tripping equipment through JSON (as a save does) must reproduce
          // identical stats - no loss, no duplicated modifiers. (Roadmap: "save/load cannot duplicate
          // modifiers.")
          const saveItem = this.createRuntimeItemInstance?.('item_wanderer_garb', 1);
          if (saveItem) {
            this.player = mk(); this.equipment = emptyEquip(); this.equipment.chest = saveItem;
            this.recalculatePlayerStats(); const preSaveHp = this.player.maxHp;
            const roundTripped = JSON.parse(JSON.stringify(this.equipment));
            this.player = mk(); this.equipment = roundTripped;
            this.recalculatePlayerStats(); const postLoadHp = this.player.maxHp;
            assert('save/load round-trip does not change stats', preSaveHp === postLoadHp, `${preSaveHp} vs ${postLoadHp}`);
          }

          // 9. Attribute-alias regression guard (V0.18.93): an item written with a display-name
          // attribute ('intellect' etc.) must still raise the real attribute. Guards the dead-stat fix.
          const aliasItem = this.createRuntimeItemInstance?.('item_head_runespun_cowl', 1);
          if (aliasItem && aliasItem.stats && aliasItem.stats.intellect) {
            this.player = mk(); this.equipment = emptyEquip(); this.recalculatePlayerStats();
            const beforeInt = this.player.attributes && this.player.attributes.intelligence || 0;
            this.player = mk(); this.equipment = emptyEquip(); this.equipment.head = aliasItem; this.recalculatePlayerStats();
            const afterInt = this.player.attributes && this.player.attributes.intelligence || 0;
            assert("attribute-name aliases apply (item 'intellect' -> intelligence)", afterInt > beforeInt, `${beforeInt} -> ${afterInt}`);
          }

          // 10. Aggregation is additive: two stat items in different slots stack.
          const itemA = this.createRuntimeItemInstance?.('item_wanderer_garb', 1);
          const itemB = this.createRuntimeItemInstance?.('item_wanderer_leggings', 1);
          if (itemA && itemB) {
            this.player = mk(); this.equipment = emptyEquip(); this.equipment.chest = itemA;
            this.recalculatePlayerStats(); const oneHp = this.player.maxHp;
            this.player = mk(); this.equipment = emptyEquip(); this.equipment.chest = itemA; this.equipment.legs = itemB;
            this.recalculatePlayerStats(); const twoHp = this.player.maxHp;
            assert('two stat items stack additively', twoHp > oneHp, `${twoHp} > ${oneHp}`);
          }

          // 11. Death/respawn: the real respawn stat path must restore full HP and NOT duplicate
          // modifiers. restoreActorAfterRespawn only mutates the passed actor, so it is safe to run on
          // the scratch player. (Roadmap: "death and respawn cannot duplicate modifiers.")
          if (typeof this.restoreActorAfterRespawn === 'function') {
            const gearItem = this.createRuntimeItemInstance?.('item_wanderer_garb', 1);
            this.player = mk(); this.equipment = emptyEquip(); if (gearItem) this.equipment.chest = gearItem;
            this.recalculatePlayerStats(); const liveMaxHp = this.player.maxHp;
            this.player.hp = 1; // simulate near-death
            this.restoreActorAfterRespawn(this.player);
            assert('respawn does not duplicate stat modifiers', this.player.maxHp === liveMaxHp, `${this.player.maxHp} vs ${liveMaxHp}`);
            assert('respawn restores full HP', this.player.hp === this.player.maxHp, `${this.player.hp}/${this.player.maxHp}`);
          }

          // 12. Character level growth: a higher level yields higher derived stats (level is a stat
          // source), and recalc at that level is still idempotent.
          this.player = mk(); this.player.level = 5; this.equipment = emptyEquip();
          this.recalculatePlayerStats(); const lowLvlHp = this.player.maxHp;
          this.player = mk(); this.player.level = 15; this.equipment = emptyEquip();
          this.recalculatePlayerStats(); const highLvlHp = this.player.maxHp;
          assert('higher level yields higher max HP', highLvlHp > lowLvlHp, `L15 ${highLvlHp} > L5 ${lowLvlHp}`);

          // 13. Current-HP RATIO is preserved when gear changes: equipping a +maxHp item while at ~50%
          // HP keeps you at ~50% of the new (higher) max, not reset to full or left at the old value.
          const hpItem = this.createRuntimeItemInstance?.('item_wanderer_garb', 1);
          if (hpItem) {
            this.player = mk(); this.equipment = emptyEquip(); this.recalculatePlayerStats();
            const maxA = this.player.maxHp;
            this.player.hp = Math.floor(maxA * 0.5); // sit at ~50%
            this.equipment.chest = hpItem; this.recalculatePlayerStats();
            const ratioAfter = this.player.hp / this.player.maxHp;
            assert('current-HP ratio is preserved across a gear change', Math.abs(ratioAfter - 0.5) < 0.05 && this.player.maxHp > maxA, `ratio ${ratioAfter.toFixed(2)}, max ${maxA} -> ${this.player.maxHp}`);
          }

          // 14. poisonResist (V0.18.96) flows through the pipeline: a poisonResist item gives the
          // player a positive, capped poison-damage reduction.
          const prItem = this.createRuntimeItemInstance?.('item_silk_web_antivenom_charm', 1);
          if (prItem && prItem.stats && prItem.stats.poisonResist) {
            this.player = mk(); this.equipment = emptyEquip(); this.recalculatePlayerStats();
            const beforePr = this.player.poisonResistReduction || 0;
            this.player = mk(); this.equipment = emptyEquip(); this.equipment.amulet = prItem; this.recalculatePlayerStats();
            const afterPr = this.player.poisonResistReduction || 0;
            assert('poisonResist stat produces a capped poison-damage reduction', afterPr > beforePr && afterPr <= 0.75, `${beforePr} -> ${afterPr.toFixed(3)}`);
          }
        } catch (e) {
          assert('self-test ran without crashing', false, String((e && e.message) || e));
        } finally {
          this.player = savedPlayer;
          this.equipment = savedEquip;
        }
        const failed = checks.filter(c => !c.ok);
        const report = { ok: failed.length === 0, total: checks.length, failed: failed.length, checks };
        this._statPipelineSelfTest = report;
        return report;
      };

      // V0.18.93 (Roadmap Item 22 - data integrity): flag item stats that use an unknown key (a typo
      // that would silently do nothing), and validate armour-set integrity. 'intellect' is accepted as
      // the established alias for the 'intelligence' attribute (see core/stats.js mergeAttributes).
      Game.prototype.validateItemData = function() {
        const issues = [];
        // Valid item-stat keys = canonical STAT_KEYS (now includes poisonResist, implemented V0.18.96)
        // + accepted attribute aliases (intellect/spirit/agility/... folded into their attributes) +
        // legitimate non-combat item fields (bag 'slots'). Any other key is a typo -> dead stat.
        const validKeys = new Set([
          ...(DR.STAT_KEYS || []),
          ...Object.keys(DR.ATTRIBUTE_ALIASES || {}),
          'slots'
        ]);
        const items = DR.ITEM_BY_ID || {};
        for (const id of Object.keys(items)) {
          const it = items[id];
          if (it && it.stats && typeof it.stats === 'object') {
            for (const k of Object.keys(it.stats)) {
              if (!validKeys.has(k)) issues.push({ kind: 'invalid-stat-key', id, detail: k });
            }
          }
        }
        const sets = DR.ARMOR_SETS || {};
        for (const setId of Object.keys(sets)) {
          const set = sets[setId];
          for (const pid of (set.pieceIds || [])) {
            if (!items[pid]) issues.push({ kind: 'set-missing-piece', id: setId, detail: pid });
          }
          if (set.bonus && set.bonus.stats) {
            for (const k of Object.keys(set.bonus.stats)) {
              if (!validKeys.has(k)) issues.push({ kind: 'set-invalid-stat-key', id: setId, detail: k });
            }
          }
        }
        return { ok: issues.length === 0, total: Object.keys(items).length, issues };
      };

      // V0.19.1 (Roadmap Item 1 - quest dialogue): enforce the roadmap's dialogue quality rule -
      // "No fourth-wall language, developer terminology, UI terminology, or character-breaking
      // objective summaries inside spoken dialogue." SPOKEN fields (what an NPC says aloud) must stay
      // in character; control hints belong in system text and the quest journal, not in an NPC's mouth.
      // The objective summary (task labels) is deliberately NOT scanned - per the roadmap it is a
      // separate, unambiguous record and may state conditions plainly.
      Game.prototype.validateQuestDialogue = function() {
        const quests = DR.QUEST_BY_ID || {};
        // Every field an NPC "says" out loud, including the V0.19.2 failure and post-completion states.
        const SPOKEN = ['offerText', 'inProgressText', 'completedText', 'beforeOfferText', 'failureText', 'postCompletionText', 'lockedText'];
        // UI / fourth-wall / developer terminology that must never appear in spoken dialogue.
        const BANNED = /\b(press\s+[a-z0-9]+\b|click|hotkey|keybind|hud\b|ui\b|menu\b|button|left-click|right-click|f\d\b|tab key|esc\b|respawn|hitpoints|hp bar|xp\b|debug|placeholder|todo)\b/i;
        // Raw map coordinates - "(100,100)" - are developer terminology too: an NPC does not speak in
        // grid references. (Found in quest_fourth_member's escort line, which the word list missed.)
        const COORDS = /\(\s*-?\d{1,4}\s*,\s*-?\d{1,4}\s*\)/;
        // V0.20.42 (Roadmap Item 1, state 3 - "must remain in character rather than repeating raw
        // objective text"): a parenthetical seconds-count - "(300s)" - is a timer notation, not
        // speech. The BANNED/COORDS lists missed it (it slipped into quest_the_long_root's spoken
        // in-progress line); a defend's hold timer already shows on the HUD, so it never belonged in
        // dialogue. Tight enough not to fire on ordinary prose.
        const DEVNOTE = /\(\s*\d+\s*s\s*\)/i;
        const issues = [];
        for (const id of Object.keys(quests)) {
          const q = quests[id];
          if (!q) continue;
          for (const field of SPOKEN) {
            const text = q[field];
            if (typeof text !== 'string' || !text) continue;
            const hit = text.match(BANNED) || text.match(COORDS) || text.match(DEVNOTE);
            if (hit) issues.push({ id, field, term: hit[0], text });
          }
        }
        return { ok: issues.length === 0, totalQuests: Object.keys(quests).length, issues };
      };

      // V0.19.6 (Roadmap Item 6 - spell visuals must match behaviour): the roadmap's rule is "the
      // visuals must match what the ability actually does", and its own first example is "a cone attack
      // must visibly use the real cone dimensions". These checks are the auditable half of that: a
      // spell that CLAIMS a shape in its name/description must carry the data the targeting and VFX
      // need, or it silently does something else (Fan of Knives said "cone" and hit a full circle).
      Game.prototype.validateSpellShapes = function() {
        const spells = DR.SPELL_BY_ID || {};
        const num = v => Number(v) || 0;
        const issues = [];
        for (const id of Object.keys(spells)) {
          const s = spells[id];
          if (!s) continue;
          const text = `${s.name || ''} ${s.category || ''} ${s.description || ''}`;
          const isArea = /area/i.test(s.target || '') || /^aoe/i.test(s.kind || '');
          // Claims a cone but carries no cone dimensions -> targeting falls back to a full circle.
          if (/\b(cone|arc)\b/i.test(text) && !(num(s.coneDegrees) > 0)) {
            issues.push({ id, kind: 'cone-without-dimensions', detail: 'describes a cone/arc but declares no coneDegrees' });
          }
          // An area spell with no radius cannot draw or resolve its own area.
          if (isArea && !(num(s.radius) > 0)) {
            issues.push({ id, kind: 'area-without-radius', detail: 'area spell declares no radius' });
          }
          // A damage-over-time visual has to persist at a real cadence.
          if (num(s.tickDamage) > 0 && !(num(s.tickRate) > 0)) {
            issues.push({ id, kind: 'dot-without-tickrate', detail: 'tickDamage with no tickRate' });
          }
          // Every spell needs a cast animation to communicate the cast at all.
          if (!s.animation || !s.animation.cast) {
            issues.push({ id, kind: 'no-cast-animation', detail: 'no animation.cast' });
          }
          // V0.19.7: a cone must not out-reach the arc it draws. The VFX takes its distance from the
          // same radius the hit test uses, so a cone declaring a range SHORTER than its radius would
          // kill past where its blades land - the mismatch that shipped in V0.19.6 (range 3 / radius 3.2).
          if (num(s.coneDegrees) > 0 && num(s.range) > 0 && num(s.range) < num(s.radius)) {
            issues.push({ id, kind: 'cone-range-under-radius', detail: `cone range ${s.range} is shorter than radius ${s.radius}` });
          }
          // V0.20.1: an authored vfxStyle must be one the renderer actually draws. Unlike the code-literal
          // styles (which tools/check-vfx-styles.js covers statically), these live in data, so a data
          // validator is the right instrument. Not a tautology: DR.SLASH_STYLES is declared in
          // render/effects-renderer.js beside the branches, and requested here by data/spells.js.
          if (s.vfxStyle) {
            const known = DR.SLASH_STYLES || [];
            if (!known.includes(s.vfxStyle)) {
              issues.push({ id, kind: 'unknown-vfx-style', detail: `vfxStyle "${s.vfxStyle}" is not drawn by any renderer branch` });
            }
          }
        }
        return { ok: issues.length === 0, totalSpells: Object.keys(spells).length, issues };
      };


      // V0.18.97 (Roadmap Item 11 - economy); unit fix V0.18.98; currency rework V0.18.99.
      // Authored item values are on the SILVER scale; all money is handled in COPPER:
      //   BUY  - event-system.js itemPrice = sellValue x 2 silver -> copper.
      //   SELL - itemSellValue returns copper; vendorSellInventoryIndex credits it via addCopper.
      // (V0.18.97's first version of this audit compared buy-as-gold against sell-as-copper and
      // wrongly reported a healthy ~2x spread; both sides are copper now.)
      // (1) SAFETY - no arbitrage: buy cost must exceed sell-back, or players could farm gold by
      //     buying and re-selling.
      // (2) SPREAD - buy:sell-back should be a sane multiple. A huge ratio means selling gear is
      //     worthless to the player and points at a unit/scale mismatch (advisory).
      // (3) COHERENCE - the value ladder: median sell value must ascend by rarity tier, so "rare items
      //     feel valuable" (roadmap Item 11). Rarity keys are canonicalised first because the game
      //     treats yellow/gold/orange as one Legendary tier.
      // Read-only and advisory-safe; never throws.
      Game.prototype.auditEconomy = function() {
        const items = DR.ITEM_BY_ID || {};
        const TIER = {
          grey: 0, gray: 0, poor: 0, white: 1, common: 1, green: 2, uncommon: 2, blue: 3, rare: 3,
          purple: 4, epic: 4, yellow: 5, gold: 5, orange: 5, legendary: 5, red: 6, mythic: 6
        };
        const TIER_NAME = ['junk', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        const arbitrage = [];
        const zeroValue = [];
        const byTier = {};
        let tightest = null;
        let widest = null;
        // How many times the sell-back a buy may cost before we call the spread out of scale. A normal
        // shop markup is a few x; orders of magnitude means a unit/scale mismatch.
        const SANE_SPREAD = 20;
        const outOfScale = [];
        for (const id of Object.keys(items)) {
          const it = items[id];
          if (!it) continue;
          const sv = Number(it.sellValue ?? it.value ?? 0);
          const lvl = Number(it.levelRequirement || it.level || 1);
          // Quest items legitimately carry no sell value (e.g. a crypt key) - they are not tradeable.
          if (!(sv > 0)) {
            if (String(it.type || '') !== 'quest') zeroValue.push({ id, type: it.type || '?' });
            continue;
          }
          // Both sides are COPPER (V0.18.99): buy = silver x2 -> copper; itemSellValue returns copper.
          const buyCopper = Math.max(1, Math.floor(sv * 2)) * COPPER_PER_SILVER;
          const sellBackCopper = this.itemSellValue ? this.itemSellValue({ ...it, level: lvl }) : 0;
          if (sellBackCopper >= buyCopper) arbitrage.push({ id, buyCopper, sellBackCopper });
          else if (sellBackCopper > 0) {
            const ratio = buyCopper / sellBackCopper;
            if (!tightest || ratio < tightest.ratio) tightest = { id, ratio: Math.round(ratio), buyCopper, sellBackCopper };
            if (!widest || ratio > widest.ratio) widest = { id, ratio: Math.round(ratio), buyCopper, sellBackCopper };
            if (ratio > SANE_SPREAD) outOfScale.push({ id, ratio: Math.round(ratio) });
          }
          const tier = TIER[String(it.rarity || 'white').toLowerCase()] ?? 1;
          (byTier[tier] = byTier[tier] || []).push(sv);
        }
        const ladder = [];
        for (const t of Object.keys(byTier).map(Number).sort((a, b) => a - b)) {
          const v = byTier[t].sort((a, b) => a - b);
          ladder.push({ tier: TIER_NAME[t] || String(t), count: v.length, min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1] });
        }
        // Advisory: a tier whose median does not exceed the tier below it means rarity is not paying off.
        const ladderInversions = [];
        for (let i = 1; i < ladder.length; i++) {
          if (ladder[i].median <= ladder[i - 1].median) {
            ladderInversions.push(`${ladder[i].tier} median ${ladder[i].median} <= ${ladder[i - 1].tier} median ${ladder[i - 1].median}`);
          }
        }
        return {
          // Arbitrage / zero-value are hard failures. The spread being out of scale is a BALANCE
          // finding (advisory) - it needs a design decision, not a silent code change.
          ok: arbitrage.length === 0 && zeroValue.length === 0,
          totalItems: Object.keys(items).length,
          arbitrage, zeroValue, ladder, ladderInversions,
          tightestBuySellRatio: tightest,
          widestBuySellRatio: widest,
          outOfScaleCount: outOfScale.length,
          outOfScaleSample: outOfScale.slice(0, 5),
          saneSpreadThreshold: SANE_SPREAD,
          formula: {
            buyCopper: 'sellValue(silver) x 2 x COPPER_PER_SILVER (itemPrice -> spendCopper)',
            sellBackCopper: 'sellValue(silver) x rarityMult x (1 + (level-1) x 0.08) x 0.35 x COPPER_PER_SILVER (itemSellValue -> addCopper)'
          }
        };
      };

      // V0.18.92 (Roadmap Item 22 - automated validation & regression): one consolidated release-time
      // validation report. Aggregates the registry's cached boot validation (descriptor references,
      // compiler errors, item obtainability) with the stat-pipeline regression self-test, and decides
      // one overall pass/fail. Descriptor WARNINGS are advisory (the game continues; they belong to
      // the quest-data pass), so only COMPILER ERRORS and a failed self-test are hard failures. Safe:
      // reads the registry's cached report and runs the isolated self-test; never throws.
      Game.prototype.runValidationSuite = function() {
        const sections = {};
        try {
          // Re-run the registry validation FRESH here rather than reading the cached boot report.
          // The boot-time runBootValidation (data/default-zones.js) fires before all source data
          // (loot tables, shop lists, crafting outputs) is registered, so its obtainability count is
          // premature (undercounts sources). This suite runs late (after init), so a fresh run is
          // accurate - and it re-caches the corrected report for anything else reading getReport().
          sections.registry = DR.Registry?.runBootValidation?.() || DR.Registry?.getReport?.() || null;
        } catch (e) { sections.registry = { ok: false, error: String((e && e.message) || e) }; }
        try {
          sections.statPipeline = this.runStatPipelineSelfTest?.() || null;
        } catch (e) { sections.statPipeline = { ok: false, error: String((e && e.message) || e) }; }
        try {
          sections.dataIntegrity = this.validateItemData?.() || null;
        } catch (e) { sections.dataIntegrity = { ok: false, error: String((e && e.message) || e) }; }
        try {
          sections.economy = this.auditEconomy?.() || null;
        } catch (e) { sections.economy = { ok: false, error: String((e && e.message) || e) }; }
        try {
          sections.questDialogue = this.validateQuestDialogue?.() || null;
        } catch (e) { sections.questDialogue = { ok: false, error: String((e && e.message) || e) }; }
        try {
          sections.spellShapes = this.validateSpellShapes?.() || null;
        } catch (e) { sections.spellShapes = { ok: false, error: String((e && e.message) || e) }; }

        const reg = sections.registry || {};
        const compilerErrorCount = reg.compilerErrors
          ? Object.values(reg.compilerErrors).reduce((sum, list) => sum + (list ? list.length : 0), 0) : 0;
        const warningCount = Array.isArray(reg.warnings) ? reg.warnings.length : 0;
        const obtain = reg.obtainability || null;
        const statOk = !(sections.statPipeline && sections.statPipeline.ok === false);
        const dataIssueCount = sections.dataIntegrity && Array.isArray(sections.dataIntegrity.issues) ? sections.dataIntegrity.issues.length : 0;
        const dataOk = !(sections.dataIntegrity && (sections.dataIntegrity.ok === false || sections.dataIntegrity.error));
        // Economy: arbitrage / unexpected zero-value items are hard failures (an exploit or a data
        // bug). Ladder inversions are advisory balance notes, not release blockers.
        const eco = sections.economy || {};
        const economyIssueCount = (Array.isArray(eco.arbitrage) ? eco.arbitrage.length : 0) + (Array.isArray(eco.zeroValue) ? eco.zeroValue.length : 0);
        const economyOk = !(sections.economy && (sections.economy.ok === false || sections.economy.error));
        const dialogueIssueCount = sections.questDialogue && Array.isArray(sections.questDialogue.issues) ? sections.questDialogue.issues.length : 0;
        const dialogueOk = !(sections.questDialogue && (sections.questDialogue.ok === false || sections.questDialogue.error));
        const spellIssueCount = sections.spellShapes && Array.isArray(sections.spellShapes.issues) ? sections.spellShapes.issues.length : 0;
        const spellsOk = !(sections.spellShapes && (sections.spellShapes.ok === false || sections.spellShapes.error));
        const registryHardFail = Boolean(reg.error) || compilerErrorCount > 0;

        // V0.20.66 (Roadmap Item 7 + Item 12): every taming bait must be OBTAINABLE. The first mount
        // pass chose baits on theme alone and two of them (item_thornberry, item_queens_silkroot) had
        // no acquisition source anywhere in the game, which silently made three of the ten beasts
        // impossible to tame. Nothing caught it, because the existing loot check runs the other way -
        // it verifies loot references resolve to items, not that an item can be reached. This closes
        // that direction for baits specifically, so the failure cannot ship again unnoticed.
        const mountBaitIssues = [];
        try {
          const defs = DR.MOUNT_DEFINITIONS || [];
          if (defs.length) {
            const reachable = JSON.stringify(DR.LOOT_TABLES || {}) + JSON.stringify(DR.LOOT || {})
              + JSON.stringify(DR.SHOP_ITEM_LISTS || {})
              + JSON.stringify((DR.CRAFTING_RECIPES || []).map(r => r?.output?.itemId || r?.outputId || r?.result || r?.itemId));
            for (const def of defs) {
              // V0.20.70: vendor mounts have no taming block by design - they are bought, not tamed.
              if (!def?.taming) continue;
              const bait = def?.taming?.bait;
              if (!bait) { mountBaitIssues.push(`${def?.id || '?'}: no bait defined`); continue; }
              if (!DR.ITEM_BY_ID?.[bait]) { mountBaitIssues.push(`${def.id}: bait ${bait} is not a real item`); continue; }
              if (!reachable.includes(bait)) mountBaitIssues.push(`${def.id}: bait ${bait} has no loot/vendor/craft source`);
            }
          }
        } catch (err) { mountBaitIssues.push(`bait check failed: ${err?.message || err}`); }
        sections.mountBaits = { ok: mountBaitIssues.length === 0, issues: mountBaitIssues };

        // V0.20.97: authored art atlases. A rejected atlas fails silently at RENDER time - the sprite
        // simply never appears - so it is checked here, at boot, where the reason is still visible.
        // With no atlases registered this reports "none" and is not a failure: the game is procedural
        // today and that is the expected state until authored art arrives.
        try {
          sections.authoredAtlas = this.authoredAtlasReport?.() || null;
        } catch (e) { sections.authoredAtlas = { ok: false, error: String((e && e.message) || e) }; }
        const atlasErrorCount = Number(sections.authoredAtlas?.errors) || 0;

        const ok = statOk && dataOk && economyOk && dialogueOk && spellsOk && !registryHardFail
          && mountBaitIssues.length === 0 && atlasErrorCount === 0;

        const report = {
          ok,
          summary: {
            registryWarnings: warningCount,
            compilerErrors: compilerErrorCount,
            itemsSourced: obtain ? `${obtain.sourced}/${obtain.total}` : 'n/a',
            statPipeline: sections.statPipeline ? `${sections.statPipeline.total - sections.statPipeline.failed}/${sections.statPipeline.total}` : 'n/a',
            dataIssues: dataIssueCount,
            economyIssues: economyIssueCount,
            economyLadderNotes: Array.isArray(eco.ladderInversions) ? eco.ladderInversions.length : 0,
            dialogueIssues: dialogueIssueCount,
            spellShapeIssues: spellIssueCount,
            mountBaitIssues: mountBaitIssues.length,
            authoredAtlases: sections.authoredAtlas
              ? `${sections.authoredAtlas.atlases || 0} atlas(es), ${sections.authoredAtlas.frames || 0} frame(s)` : 'n/a',
            authoredAtlasErrors: atlasErrorCount
          },
          sections,
          checkedAt: Date.now()
        };
        this._validationSuite = report;
        return report;
      };

      Game.prototype.itemClassRequirementText = function(item) {
        const all = Object.keys(CLASSES || {});
        const classes = this.itemAllowedClasses?.(item) || all;
        const isAll = classes.length >= all.length && all.every(cls => classes.includes(cls));
        return isAll ? 'All Classes' : classes.join(', ');
      };

      Game.prototype.canUseItemClass = function(item) {
        if (!this.player || !item) return true;
        const all = Object.keys(CLASSES || {});
        const classes = this.itemAllowedClasses?.(item) || all;
        return classes.includes(this.player.className) || classes.length >= all.length;
      };
      Game.prototype.itemIconDebugLogOnce = function(kind, key, message) {
        if (!(this.debugOverlayOpen || this.debugMode || this.devMode || DR.CONFIG?.DEBUG)) return;
        const bucketName = `_${kind || 'itemIcon'}IconLogKeys`;
        if (!this[bucketName]) this[bucketName] = new Set();
        const stableKey = String(key || 'unknown');
        if (this[bucketName].has(stableKey)) return;
        this[bucketName].add(stableKey);
        console.warn(`[ItemIcon] ${message}`);
      };

      Game.prototype.normalizeItemLookupName = function(value) {
        return String(value || '')
          .toLowerCase()
          .replace(/&amp;/g, '&')
          .replace(/['’`]/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
          .replace(/\s+/g, ' ');
      };

      // V0.17.20: inventory/bag saves can contain runtime rarity-prefixed
      // names (for example "Plain Briar-Silver Earring") while canonical
      // item data keeps the stable base item name ("Briar-Silver Earring").
      // Keep this in the item-icon owner so bag slots, equipment cards,
      // tooltips, loot, vendors, and rewards all share the same hydration path.
      Game.prototype.itemIconLookupNameAliases = function(value) {
        const base = this.normalizeItemLookupName?.(value) || '';
        if (!base) return [];
        const aliases = [base];
        const runtimePrefixes = [
          // Runtime loot rarity prefixes only. Do not strip canonical words such
          // as Basic, Worn, or Crude because those are real base item names.
          'plain', 'cracked', 'common', 'uncommon', 'rare', 'epic',
          'grey', 'gray', 'poor', 'white', 'green', 'blue', 'purple'
        ];
        for (const prefix of runtimePrefixes) {
          if (base.startsWith(`${prefix} `)) {
            const stripped = base.slice(prefix.length + 1).trim();
            if (stripped && !aliases.includes(stripped)) aliases.push(stripped);
          }
        }
        return aliases;
      };

      Game.prototype.resolveCanonicalItemDef = function(itemOrId) {
        const editorItems = this.editorItems && typeof this.editorItems === 'object' ? this.editorItems : null;
        const lookupById = id => {
          const key = String(id || '').trim();
          if (!key) return null;
          return editorItems?.[key] || DR.ITEM_BY_ID?.[key] || null;
        };
        if (!itemOrId) return null;
        if (typeof itemOrId === 'string') {
          const direct = lookupById(itemOrId);
          if (direct) return direct;
          const wantedName = this.normalizeItemLookupName?.(itemOrId) || '';
          if (!wantedName) return null;
          const sources = [editorItems, DR.ITEM_BY_ID].filter(Boolean);
          for (const source of sources) {
            for (const item of Object.values(source)) {
              if ((this.normalizeItemLookupName?.(item?.name) || '') === wantedName) return item;
            }
          }
          return null;
        }

        const candidates = [];
        const pushCandidate = value => {
          const key = String(value || '').trim();
          if (key && !candidates.includes(key)) candidates.push(key);
        };
        // Prefer canonical stable IDs. Runtime item.id is often a numeric serial
        // and must never outrank itemId/sourceItemId for icon lookup.
        pushCandidate(itemOrId.itemId);
        pushCandidate(itemOrId.sourceItemId);
        pushCandidate(itemOrId.baseItemId);
        pushCandidate(itemOrId.templateId);
        pushCandidate(itemOrId.definitionId);
        pushCandidate(itemOrId.canonicalId);
        pushCandidate(itemOrId.itemDefId);
        pushCandidate(itemOrId.baseId);
        if (typeof itemOrId.id === 'string' && lookupById(itemOrId.id)) pushCandidate(itemOrId.id);

        for (const candidate of candidates) {
          const found = lookupById(candidate);
          if (found) return found;
        }

        const wantedAliases = [];
        const pushNameAliases = value => {
          for (const alias of this.itemIconLookupNameAliases?.(value) || []) {
            if (alias && !wantedAliases.includes(alias)) wantedAliases.push(alias);
          }
        };
        pushNameAliases(itemOrId.name);
        pushNameAliases(itemOrId.baseName);
        pushNameAliases(itemOrId.itemName);
        pushNameAliases(itemOrId.displayName);
        pushNameAliases(itemOrId.sourceName);
        pushNameAliases(itemOrId.templateName);
        if (wantedAliases.length) {
          const sources = [editorItems, DR.ITEM_BY_ID].filter(Boolean);
          for (const source of sources) {
            for (const item of Object.values(source)) {
              const canonicalAliases = this.itemIconLookupNameAliases?.(item?.name) || [];
              if (canonicalAliases.some(alias => wantedAliases.includes(alias))) return item;
            }
          }
        }
        this.itemIconDebugLogOnce?.('missingCanonical', itemOrId.itemId || itemOrId.sourceItemId || itemOrId.id || itemOrId.name, `Saved/runtime item could not resolve canonical definition: ${itemOrId.itemId || itemOrId.sourceItemId || itemOrId.id || itemOrId.name || 'unknown'}`);
        return null;
      };

      Game.prototype.normalizeItemIconKey = function(value) {
        return String(value || '')
          .replace(/^assets\/item-icons\//, '')
          .replace(/\.png$/i, '')
          .replace(/^item_/, '')
          .trim();
      };

      Game.prototype.resolveItemIconKey = function(itemOrId) {
        const item = itemOrId && typeof itemOrId === 'object' ? itemOrId : null;
        const canonical = this.resolveCanonicalItemDef?.(itemOrId) || null;
        const directIcon = item?.icon;
        const iconCandidates = [];
        const pushIconCandidate = value => {
          const key = this.normalizeItemIconKey?.(value) || '';
          if (key && !iconCandidates.includes(key)) iconCandidates.push(key);
        };

        // Prefer concrete uploaded-asset keys and canonical definitions before
        // generic family/glyph values copied onto saved runtime item instances.
        pushIconCandidate(item?.iconKey);
        pushIconCandidate(canonical?.iconKey);

        const idCandidates = [];
        const pushIdCandidate = value => {
          const key = String(value || '').trim();
          if (key && !idCandidates.includes(key)) idCandidates.push(key);
        };
        pushIdCandidate(canonical?.id);
        pushIdCandidate(item?.itemId);
        pushIdCandidate(item?.sourceItemId);
        pushIdCandidate(item?.baseItemId);
        pushIdCandidate(item?.templateId);
        pushIdCandidate(item?.definitionId);
        pushIdCandidate(item?.canonicalId);
        pushIdCandidate(item?.itemDefId);
        pushIdCandidate(item?.baseId);
        if (typeof item?.id === 'string') pushIdCandidate(item.id);
        for (const id of idCandidates) pushIconCandidate(DR.ITEM_ICON_KEYS_BY_ID?.[id]);

        if (typeof directIcon === 'string') pushIconCandidate(directIcon);
        pushIconCandidate(directIcon?.iconKey);
        pushIconCandidate(directIcon?.key);
        pushIconCandidate(directIcon?.assetId);
        if (typeof canonical?.icon === 'string') pushIconCandidate(canonical.icon);
        pushIconCandidate(canonical?.icon?.iconKey);
        pushIconCandidate(canonical?.icon?.key);
        pushIconCandidate(canonical?.icon?.assetId);

        let iconKey = '';
        let hasAsset = false;
        for (const candidate of iconCandidates) {
          if (!candidate) continue;
          if (!DR.ITEM_ICON_ASSET_KEYS || DR.ITEM_ICON_ASSET_KEYS[candidate]) {
            iconKey = candidate;
            hasAsset = true;
            break;
          }
          if (!iconKey) iconKey = candidate;
        }

        if (iconKey && !hasAsset) {
          this.itemIconDebugLogOnce?.('missingAsset', iconKey, `Missing icon asset: ${iconKey} for ${canonical?.id || item?.itemId || item?.name || 'unknown item'}`);
        } else if (!iconKey && (canonical || item)) {
          this.itemIconDebugLogOnce?.('missingMapping', canonical?.id || item?.itemId || item?.sourceItemId || item?.id || item?.name, `Missing item icon mapping: ${canonical?.id || item?.itemId || item?.sourceItemId || item?.id || item?.name || 'unknown item'}`);
        }
        return { iconKey, hasAsset, canonical };
      };

      Game.prototype.itemIconDescriptor = function(item) {
        const resolved = this.resolveItemIconKey?.(item) || { iconKey: '', hasAsset: false, canonical: null };
        const canonical = resolved.canonical || null;
        const raw = item?.icon && typeof item.icon === 'object'
          ? item.icon
          : (canonical?.icon && typeof canonical.icon === 'object' ? canonical.icon : null);
        const name = String(item?.name || canonical?.name || '').toLowerCase();
        const slot = String(item?.slot || item?.equipSlot || canonical?.slot || canonical?.equipSlot || '').toLowerCase();
        const category = String(item?.category || item?.kind || item?.type || canonical?.type || '').toLowerCase();
        const tags = Array.isArray(item?.tags) ? item.tags.map(tag => String(tag || '').toLowerCase()).join(' ') : '';
        const rarityColor = item?.rarity?.color || item?.icon?.color || raw?.color || '#cfdac8';
        const rawFamily = String(raw?.family || '').toLowerCase();
        const rawGlyph = raw?.glyph || '';
        const withRaw = (glyph, color, family) => ({ glyph: rawGlyph || glyph, color: raw?.color || color || rarityColor, family });
        if (resolved.iconKey && resolved.hasAsset) {
          return {
            glyph: rawGlyph || '◇',
            color: raw?.color || rarityColor,
            family: rawFamily || 'item',
            iconKey: resolved.iconKey,
            imagePath: `assets/item-icons/${resolved.iconKey}.png`,
            source: 'asset'
          };
        }
        if (this.isBagItem(item) || category.includes('bag') || slot.includes('bag') || name.includes('pack') || name.includes('pouch') || name.includes('satchel')) return withRaw('▤', '#c2c6a8', 'bag');
        if (rawFamily && ['robe','legs','boots','wand','skull','crystal','book','grimoire','focus','shield','helm','staff','dagger','fist','ring','amulet','earring','cloak','shoulders','armor','weapon','tool','crossbow'].includes(rawFamily)) {
          return { glyph: rawGlyph || '?', color: raw?.color || rarityColor, family: rawFamily === 'grimoire' ? 'book' : rawFamily };
        }
        if (category.includes('quest') || item?.questItem || item?.protected) return withRaw('!', '#ffd86b', 'quest');
        if (category.includes('currency') || name.includes('coin') || name.includes('silver') || name.includes('gold')) return withRaw('¤', '#e4b85c', 'currency');
        if (category.includes('material') || category.includes('resource') || slot.includes('material')) {
          if (name.includes('fish') || name.includes('eel') || name.includes('trout') || name.includes('minnow')) return withRaw('><>', '#69c7db', 'fish');
          if (name.includes('ore') || name.includes('vein')) return withRaw('◆', '#b88962', 'ore');
          if (name.includes('bar') || name.includes('ingot')) return withRaw('▰', '#d1a05f', 'bar');
          if (name.includes('mushroom') || name.includes('cap')) return withRaw('♣', '#c486d8', 'mushroom');
          if (name.includes('leaf') || name.includes('moss') || name.includes('herb') || name.includes('root') || name.includes('vine')) return withRaw('♧', '#75d069', 'herb');
          if (name.includes('silk') || name.includes('web')) return withRaw('✣', '#ddd7bd', 'silk');
          return withRaw('◆', '#b9c27b', 'material');
        }
        if (name.includes('potion') || name.includes('elixir') || name.includes('vial')) return withRaw('⚗', '#d86bd8', 'potion');
        if (category.includes('consumable') || slot.includes('consumable') || name.includes('stew') || name.includes('ration') || name.includes('broth') || name.includes('skewer')) return withRaw('●', '#d8a45d', 'food');
        if (name.includes('dagger') || name.includes('fang')) return withRaw('⌁', rarityColor, 'dagger');
        if (name.includes('fist') || name.includes('claw') || name.includes('knuckle') || name.includes('cestus')) return withRaw('✊', rarityColor, 'fist');
        if (name.includes('crossbow')) return withRaw('➶', rarityColor, 'crossbow');
        if (slot.includes('weapon') || name.includes('sword') || name.includes('blade') || name.includes('axe') || name.includes('mace')) return withRaw('⚔', rarityColor, 'weapon');
        if (name.includes('bow')) return withRaw('弓', rarityColor, 'bow');
        if (name.includes('staff') || name.includes('rod') || name.includes('wand') || name.includes('scepter')) return withRaw('杖', rarityColor, name.includes('wand') ? 'wand' : 'staff');
        if (slot.includes('shield') || name.includes('shield') || name.includes('bulwark')) return withRaw('▣', rarityColor, 'shield');
        if (slot.includes('shoulder') || name.includes('pauldron') || name.includes('mantle')) return withRaw('▱', rarityColor, 'shoulders');
        if (slot.includes('cape') || name.includes('cape') || name.includes('cloak')) return withRaw('⌁', rarityColor, 'cloak');
        if (slot.includes('belt') || name.includes('belt') || name.includes('sash') || name.includes('waist')) return withRaw('═', rarityColor, 'belt');
        if (name.includes('robe')) return withRaw('▥', rarityColor, 'robe');
        if (slot.includes('legs') || name.includes('pants') || name.includes('wraps') || name.includes('leggings') || name.includes('trousers')) return withRaw('▥', rarityColor, 'legs');
        if (slot.includes('feet') || name.includes('boots') || name.includes('sandals') || name.includes('shoes')) return withRaw('▰', rarityColor, 'boots');
        if (slot.includes('chest') || slot.includes('hands') || name.includes('mail') || name.includes('vest') || name.includes('armor')) return withRaw('▥', rarityColor, 'armor');
        if (slot.includes('head') || name.includes('helm') || name.includes('hood')) return withRaw('⌂', rarityColor, 'helm');
        if (slot.includes('earring') || name.includes('earring')) return withRaw('◦', rarityColor, 'earring');
        if (slot.includes('amulet') || name.includes('amulet') || name.includes('necklace')) return withRaw('◎', rarityColor, 'amulet');
        if (slot.includes('ring') || name.includes('ring') || name.includes('signet') || name.includes('band')) return withRaw('◈', rarityColor, 'ring');
        if (name.includes('skull')) return withRaw('☠', rarityColor, 'skull');
        if (name.includes('shard') || rawFamily === 'crystal') return withRaw('◆', rarityColor, 'crystal');
        if (slot.includes('offhand') || name.includes('orb') || name.includes('totem') || name.includes('focus') || name.includes('symbol')) return withRaw('✦', rarityColor, 'focus');
        return raw ? { glyph: rawGlyph || '◇', color: raw?.color || rarityColor, family: rawFamily || 'item' } : { glyph: '◇', color: rarityColor, family: 'item' };
      };

      Game.prototype.itemIconHtml = function(item, className = 'inventoryIcon') {
        const icon = this.itemIconDescriptor(item);
        const family = String(icon.family || 'item').toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'item';
        const color = icon.color || item?.rarity?.color || '#cfdac8';
        const glyph = icon.glyph || '?';
        const imagePath = String(icon.imagePath || '');
        const image = imagePath
          ? `<img class="itemIconImageAsset" src="${escapeHtml(imagePath)}" alt="" loading="eager" decoding="async" draggable="false" onerror="var p=this.closest && this.closest('.itemImageIcon'); if(p)p.classList.add('itemImageIconFailed'); this.style.display='none';">`
          : '';
        return `<div class="${escapeHtml(className)} generatedItemIcon${image ? ' itemImageIcon uploadedItemIcon' : ''} icon-${escapeHtml(family)}" style="--icon-color:${escapeHtml(color)}" data-icon-family="${escapeHtml(family)}"${icon.iconKey ? ` data-item-icon-key="${escapeHtml(icon.iconKey)}" data-icon-source="uploaded"` : ''}>${image}<span class="iconCore"></span><span class="iconGlyph">${escapeHtml(glyph)}</span></div>`;
      };

      Game.prototype.itemRarityInfo = function(item) {
        const raw = item?.rarity;
        const key = String(raw?.key || item?.rarityKey || item?.rarityId || item?.rarity || item?.quality || 'white').toLowerCase();
        const rarity = raw && typeof raw === 'object'
          ? raw
          : (RARITIES || []).find(r => String(r.key || r.name || '').toLowerCase() === key || String(r.label || '').toLowerCase() === key) || null;
        const canonical = {
          grey: { label: 'Grey / Poor', color: '#8b928a' }, gray: { label: 'Grey / Poor', color: '#8b928a' }, poor: { label: 'Grey / Poor', color: '#8b928a' },
          white: { label: 'White / Common', color: '#d8ded1' }, common: { label: 'White / Common', color: '#d8ded1' },
          green: { label: 'Green / Uncommon', color: '#54c86f' }, uncommon: { label: 'Green / Uncommon', color: '#54c86f' },
          blue: { label: 'Blue / Rare', color: '#5ea2ff' }, rare: { label: 'Blue / Rare', color: '#5ea2ff' },
          purple: { label: 'Purple / Epic', color: '#b777ff' }, epic: { label: 'Purple / Epic', color: '#b777ff' },
          yellow: { label: 'Yellow / Legendary', color: '#e5bd5b' }, gold: { label: 'Yellow / Legendary', color: '#e5bd5b' }, orange: { label: 'Yellow / Legendary', color: '#f08a36' }, legendary: { label: 'Yellow / Legendary', color: '#e5bd5b' },
          red: { label: 'Red / Mythic', color: '#ff4f4f' }
        };
        const fallback = canonical[key] || null;
        return {
          key: rarity?.key || key || 'white',
          label: fallback?.label || rarity?.displayName || rarity?.name || rarity?.label || 'White / Common',
          color: rarity?.color || fallback?.color || item?.icon?.color || '#d8ded1'
        };
      };

      Game.prototype.itemTypeLabel = function(item) {
        if (!item) return 'Miscellaneous';
        const type = String(item.type || item.kind || item.category || '').toLowerCase();
        const slot = String(item.slot || item.equipSlot || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        if (this.isBagItem?.(item) || type === 'bag' || slot === 'bag') return 'Bag';
        if (item.questItem || item.protected || type.includes('quest')) return 'Quest Item';
        if (this.isConsumableItem?.(item) || type.includes('consumable') || name.includes('potion') || name.includes('elixir')) return 'Consumable';
        if (this.isMaterialItem?.(item) || type.includes('material') || type.includes('resource') || slot === 'material') return 'Crafting Material';
        if (type.includes('weapon') || slot === 'weapon' || item.damage || item.damageMin || item.minDamage) return 'Weapon';
        if (type.includes('armor') || ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'cape', 'belt'].includes(slot) || Number(item.armor || item.stats?.armor || 0) > 0) return 'Armor';
        if (['offhand', 'ring', 'ring1', 'ring2', 'amulet', 'earring1', 'earring2', 'belt', 'charm'].includes(slot) || type.includes('accessory')) return 'Accessory';
        return type ? type.replace(/(^|[_\s-])\w/g, ch => ch.toUpperCase()).replace(/[_-]+/g, ' ') : 'Miscellaneous';
      };

      Game.prototype.itemSlotLabel = function(item) {
        if (!item) return '';
        const slot = String(item.slot || item.equipSlot || '').toLowerCase();
        if (this.isBagItem?.(item) || slot === 'bag') return 'Bag Slot';
        return SLOT_LABELS[slot] || (slot ? slot.replace(/(^|[_\s-])\w/g, ch => ch.toUpperCase()).replace(/[_-]+/g, ' ') : '');
      };

      Game.prototype.itemStatTooltipLines = function(item) {
        const labels = {
          hp: 'Health', maxHp: 'Health', health: 'Health', mana: 'Mana', maxMana: 'Mana', attack: 'Damage', damage: 'Damage', defense: 'Defense', armor: 'Armor',
          speed: 'Speed', strength: 'Strength', str: 'Strength', dexterity: 'Agility', dex: 'Agility', agility: 'Agility', stamina: 'Stamina', sta: 'Stamina',
          intelligence: 'Intellect', intellect: 'Intellect', int: 'Intellect', wisdom: 'Spirit', spirit: 'Spirit', wis: 'Spirit',
          cdr: 'Cooldown Reduction', cooldownReduction: 'Cooldown Reduction', crit: 'Crit', critChance: 'Crit', magicCrit: 'Magic Crit', magicCritChance: 'Magic Crit',
          haste: 'Haste', critDamage: 'Crit Damage', spellPower: 'Spell Power', magicPower: 'Magic Power', healingPower: 'Healing Power', physicalPower: 'Physical Power',
          fireResist: 'Fire Resist', frostResist: 'Frost Resist', shadowResist: 'Shadow Resist', natureResist: 'Nature Resist', poisonResist: 'Poison Resist', resist: 'Resist'
        };
        const skip = new Set(['slots', 'bagSlots']);
        const stats = { ...(item?.stats || {}) };
        if (item?.armor && !stats.armor) stats.armor = item.armor;
        const lines = [];
        for (const [stat, rawValue] of Object.entries(stats)) {
          if (skip.has(stat)) continue;
          const value = Number(rawValue);
          if (!Number.isFinite(value) || value === 0) continue;
          const isPct = /pct|percent|chance|haste|crit|cooldownreduction/i.test(stat) && Math.abs(value) <= 1;
          const amount = isPct ? `${value > 0 ? '+' : ''}${Math.round(value * 100)}%` : `${value > 0 ? '+' : ''}${Number.isInteger(value) ? Math.round(value) : value.toFixed(1)}`;
          lines.push({ text: `${amount} ${labels[stat] || stat.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}`, kind: value < 0 ? 'negative' : 'stat' });
        }
        return lines;
      };

      Game.prototype.describeItemEffect = function(effect, prefix = '') {
        if (!effect) return [];
        if (typeof effect === 'string') return [prefix ? `${prefix}: ${effect}` : effect];
        if (Array.isArray(effect)) return effect.flatMap(entry => this.describeItemEffect?.(entry, prefix) || []);
        if (typeof effect !== 'object') return [];
        const parts = [];
        const heal = effect.hp ?? effect.heal ?? effect.health ?? effect.restoreHealth;
        const mana = effect.mana ?? effect.restoreMana;
        const duration = effect.duration || effect.durationSeconds;
        if (heal) parts.push(`Restores ${Math.abs(Math.round(Number(heal)))} health`);
        if (mana) parts.push(`Restores ${Math.abs(Math.round(Number(mana)))} mana`);
        if (effect.damage) parts.push(`Deals ${effect.damage} damage`);
        if (effect.buff) parts.push(`Applies ${effect.buff}`);
        if (effect.spellId) parts.push(`Triggers spell ${effect.spellId}`);
        if (duration) parts.push(`Duration ${duration}s`);
        for (const [key, value] of Object.entries(effect)) {
          if (['hp','heal','health','restoreHealth','mana','restoreMana','damage','buff','spellId','duration','durationSeconds'].includes(key)) continue;
          if (value == null || typeof value === 'object') continue;
          parts.push(`${key.replace(/([A-Z])/g, ' $1')}: ${value}`);
        }
        const text = parts.join(' · ');
        return text ? [prefix ? `${prefix}: ${text}` : text] : [];
      };

      Game.prototype.buildItemTooltip = function(item, context = {}) {
        if (!item) return null;
        const rarity = this.itemRarityInfo?.(item) || { label: 'White / Common', color: '#d8ded1', key: 'white' };
        const type = this.itemTypeLabel?.(item) || 'Miscellaneous';
        const slot = this.itemSlotLabel?.(item) || '';
        const sections = [];
        const addSection = (title, lines) => {
          const clean = (lines || []).filter(line => line && String(line.text ?? line).trim()).map(line => typeof line === 'string' ? { text: line, kind: 'line' } : line);
          if (clean.length) sections.push({ title, lines: clean });
        };

        const reqLines = [];
        const requiredLevel = item.requiredLevel ?? item.levelRequirement ?? item.levelReq;
        if (Number(requiredLevel) > 1) reqLines.push({ text: `Requires Level ${Math.floor(Number(requiredLevel))}`, kind: (this.player?.level || 1) >= Number(requiredLevel) ? 'requirement' : 'negative' });
        const classText = (this.isMaterialItem?.(item) || this.isConsumableItem?.(item) || this.isBagItem?.(item)) ? 'All Classes' : this.itemClassRequirementText?.(item);
        if (classText && classText !== 'All Classes') reqLines.push({ text: `Classes: ${classText}`, kind: this.canUseItemClass?.(item) ? 'requirement' : 'negative' });
        if (item.requiredStat) reqLines.push({ text: `Requires ${item.requiredStat}`, kind: 'requirement' });
        if (item.requiredQuestState) reqLines.push({ text: `Requires Quest: ${item.requiredQuestState}`, kind: 'requirement' });

        const weaponLines = [];
        const dmg = item.damage && typeof item.damage === 'object' ? item.damage : null;
        const min = item.damageMin ?? item.minDamage ?? dmg?.min;
        const max = item.damageMax ?? item.maxDamage ?? dmg?.max;
        const weaponSpeed = item.attackSpeed ?? item.weaponSpeed ?? dmg?.speed;
        if (Number.isFinite(Number(min)) && Number.isFinite(Number(max))) weaponLines.push(`Damage: ${Math.round(Number(min))}–${Math.round(Number(max))}`);
        if (Number.isFinite(Number(weaponSpeed)) && Number(weaponSpeed) > 0) weaponLines.push(`Speed: ${Number(weaponSpeed).toFixed(1)}`);
        if (Number.isFinite(Number(min)) && Number.isFinite(Number(max)) && Number.isFinite(Number(weaponSpeed)) && Number(weaponSpeed) > 0) weaponLines.push(`DPS: ${(((Number(min) + Number(max)) * 0.5) / Number(weaponSpeed)).toFixed(1)}`);
        const weaponType = item.weaponType || item.subtype || item.tags?.find?.(tag => /sword|axe|mace|staff|bow|dagger|fist|claw|knuckle/i.test(tag));
        if (weaponType && type === 'Weapon') weaponLines.push(`Weapon Type: ${String(weaponType).replace(/[_-]+/g, ' ')}`);
        addSection(type === 'Weapon' ? 'Weapon' : '', weaponLines);

        const armorLines = [];
        const armor = item.armor ?? item.stats?.armor;
        if (Number(armor) > 0 && type !== 'Weapon') armorLines.push(`Armor: ${Math.round(Number(armor))}`);
        if (item.armorType) armorLines.push(`Type: ${item.armorType}`);
        addSection(type === 'Armor' ? 'Armor' : '', armorLines);

        if (this.isBagItem?.(item) || type === 'Bag') {
          const slots = Math.max(0, Math.floor(Number(item.slots || item.bagSlots || item.stats?.slots) || 0));
          addSection('Bag', [`Slots: ${slots}`, item.bagType ? `Bag Type: ${item.bagType}` : '']);
        }

        addSection('Stats', this.itemStatTooltipLines?.(item) || []);
        const comparison = context.compare === false ? null : this.compareItemToEquipped?.(item);
        if (comparison) {
          const slotLabel = SLOT_LABELS[comparison.slot] || comparison.slot;
          const comparisonLines = comparison.equipped
            ? [{ text: `Compared to: ${comparison.equipped.name || 'Equipped item'} in ${slotLabel}`, kind: 'comparison' }]
            : [{ text: `Compared to: Empty ${slotLabel}`, kind: 'comparison' }];
          comparisonLines.push(...comparison.deltas.map(delta => ({ text: delta.text, kind: delta.delta > 0 ? 'upgrade' : 'downgrade' })));
          const suffix = comparison.dualSlot && comparison.equipped ? ` over ${slotLabel}` : '';
          comparisonLines.push({ text: `Overall: ${comparison.overall}${suffix}`, kind: comparison.overall === 'Upgrade' || comparison.overall === 'No equipped item' ? 'upgrade' : comparison.overall === 'Downgrade' ? 'downgrade' : 'sidegrade' });
          addSection('Equipment Comparison', comparisonLines);
        }
        addSection('Requirements', reqLines);

        const effectLines = [];
        effectLines.push(...(this.describeItemEffect?.(item.useEffect, 'Use') || []));
        effectLines.push(...(this.describeItemEffect?.(item.passiveEffect, 'Passive') || []));
        effectLines.push(...(this.describeItemEffect?.(item.procEffect, 'Proc') || []));
        effectLines.push(...(this.describeItemEffect?.(item.effects, 'Effect') || []));
        effectLines.push(...(this.describeItemEffect?.(item.setBonus, 'Set Bonus') || []));
        addSection('Effects', effectLines.map(text => ({ text, kind: 'effect' })));

        const stack = item.maxStack || item.stackSize ? `Stack: ${Math.max(1, Math.floor(Number(item.stack || item.quantity || item.qty || 1) || 1))} / ${Math.max(1, Math.floor(Number(item.maxStack || item.stackSize || item.stack || 1) || 1))}` : '';
        const sellValue = this.itemSellValue?.(item) ?? item.sellValue ?? item.value ?? 0;
        const valueText = Number(sellValue) > 0 ? `Sell Price: ${this.formatCopper ? this.formatCopper(sellValue) : `${sellValue}c`}` : '';
        addSection('', [stack, valueText ? { text: valueText, kind: 'value' } : '']);

        const flavor = item.flavorText || item.flavor || item.description || '';
        return {
          name: item.name || item.baseName || item.itemId || 'Item',
          rarity,
          type,
          slot,
          meta: `${rarity.label} ${type}`,
          subMeta: slot && !['Crafting Material', 'Consumable', 'Quest Item'].includes(type) ? slot : '',
          icon: this.itemIconHtml?.(item, 'tooltipIcon') || '',
          sections,
          flavor,
          warning: reqLines.some(line => line.kind === 'negative') ? 'Cannot use: requirement not met.' : ''
        };
      };

      Game.prototype.ensureItemTooltipElement = function() {
        let tip = document.getElementById('itemTooltip');
        if (!tip) {
          tip = document.createElement('div');
          tip.id = 'itemTooltip';
          tip.setAttribute('role', 'tooltip');
          tip.style.display = 'none';
          document.body.appendChild(tip);
        }
        return tip;
      };

      Game.prototype.itemTooltipHtml = function(item, context = {}) {
        const tip = this.buildItemTooltip?.(item, context);
        if (!tip) return '';
        const lineClass = kind => kind === 'stat' ? 'tooltipStat' : kind === 'negative' || kind === 'downgrade' ? 'tooltipNegative' : kind === 'upgrade' ? 'tooltipUpgrade' : kind === 'sidegrade' ? 'tooltipSidegrade' : kind === 'comparison' ? 'tooltipComparison' : kind === 'requirement' ? 'tooltipRequirement' : kind === 'effect' ? 'tooltipEffect' : kind === 'value' ? 'tooltipValue' : 'tooltipLine';
        const sections = tip.sections.map(section => `
          <div class="tooltipSection">
            ${section.title ? `<div class="tooltipSectionTitle">${escapeHtml(section.title)}</div>` : ''}
            ${section.lines.map(line => `<div class="${lineClass(line.kind)}">${escapeHtml(line.text)}</div>`).join('')}
          </div>`).join('');
        return `
          <div class="tooltipHeader" style="--rarity-color:${escapeHtml(tip.rarity.color)}">
            ${tip.icon}
            <div>
              <div class="tooltipName" style="color:${escapeHtml(tip.rarity.color)}">${escapeHtml(tip.name)}</div>
              <div class="tooltipMeta">${escapeHtml(tip.meta)}</div>
              ${tip.subMeta ? `<div class="tooltipSubMeta">${escapeHtml(tip.subMeta)}</div>` : ''}
            </div>
          </div>
          <div class="tooltipDivider"></div>
          ${sections || '<div class="tooltipSection"><div class="muted">No additional item data.</div></div>'}
          ${tip.flavor ? `<div class="tooltipFlavor">${escapeHtml(tip.flavor)}</div>` : ''}
          ${tip.warning ? `<div class="tooltipWarning">${escapeHtml(tip.warning)}</div>` : ''}
        `;
      };


      Game.prototype.showHtmlTooltip = function(html, eventOrX, y = null) {
        if (!html || this.dragState?.item || this.draggedItem) return false;
        const tip = this.ensureItemTooltipElement();
        tip.innerHTML = String(html);
        tip.style.display = 'block';
        tip.classList.add('visible');
        const point = this.tooltipPointFromEvent?.(eventOrX, y) || { x: 0, y: 0 };
        this.positionTooltipWithinViewport?.(tip, point.x, point.y);
        this.activeItemTooltipItem = null;
        return true;
      };

      Game.prototype.tooltipPointFromEvent = function(eventOrX, y = null) {
        if (typeof eventOrX === 'number') return { x: eventOrX, y: Number(y) || 0 };
        const event = eventOrX || {};
        const touch = event.touches?.[0] || event.changedTouches?.[0] || null;
        return {
          x: Number(touch?.clientX ?? event.clientX ?? window.innerWidth * 0.5) || 0,
          y: Number(touch?.clientY ?? event.clientY ?? window.innerHeight * 0.5) || 0
        };
      };

      Game.prototype.positionTooltipWithinViewport = function(tooltip, x, y) {
        if (!tooltip) return;
        const pad = 12;
        const offset = 18;
        const w = tooltip.offsetWidth || 320;
        const h = tooltip.offsetHeight || 180;
        let left = Number(x) + offset;
        let top = Number(y) + 14;
        if (left + w + pad > window.innerWidth) left = Number(x) - w - offset;
        if (top + h + pad > window.innerHeight) top = Number(y) - h - offset;
        left = Math.max(pad, Math.min(left, Math.max(pad, window.innerWidth - w - pad)));
        top = Math.max(pad, Math.min(top, Math.max(pad, window.innerHeight - h - pad)));
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
      };

      Game.prototype.showItemTooltip = function(item, eventOrX, y = null, context = {}) {
        if (!item || this.dragState?.item || this.draggedItem) return false;
        const tip = this.ensureItemTooltipElement();
        tip.innerHTML = this.itemTooltipHtml(item, context);
        tip.style.display = 'block';
        tip.classList.add('visible');
        const point = this.tooltipPointFromEvent?.(eventOrX, y) || { x: 0, y: 0 };
        this.positionTooltipWithinViewport?.(tip, point.x, point.y);
        this.activeItemTooltipItem = item;
        return true;
      };

      Game.prototype.moveItemTooltip = function(eventOrX, y = null) {
        const tip = document.getElementById('itemTooltip');
        if (!tip || tip.style.display === 'none') return;
        const point = this.tooltipPointFromEvent?.(eventOrX, y) || { x: 0, y: 0 };
        this.positionTooltipWithinViewport?.(tip, point.x, point.y);
      };

      Game.prototype.hideItemTooltip = function() {
        const tip = document.getElementById('itemTooltip');
        if (tip) {
          tip.classList.remove('visible');
          tip.style.display = 'none';
        }
        this.activeItemTooltipItem = null;
      };

      Game.prototype.bindItemTooltips = function(root, resolveItem, context = {}) {
        if (!root || typeof resolveItem !== 'function') return;
        const selector = [
          '[data-tooltip-index]', '[data-tooltip-slot]', '[data-tooltip-bag-slot]', '[data-tooltip-item-id]',
          '[data-tooltip-corpse-loot-index]', '[data-tooltip-shop-buy]', '[data-tooltip-shop-sell]', '[data-item-tooltip]'
        ].join(',');
        root.querySelectorAll(selector).forEach(node => {
          if (node.dataset.itemTooltipBound === '1') return;
          node.dataset.itemTooltipBound = '1';
          if (node.hasAttribute('title')) {
            node.dataset.nativeTitle = node.getAttribute('title') || '';
            node.removeAttribute('title');
          }
          let longPressTimer = null;
          const clearLongPress = () => { if (longPressTimer) window.clearTimeout(longPressTimer); longPressTimer = null; };
          const show = event => {
            const item = resolveItem(node);
            if (item) this.showItemTooltip(item, event, null, context);
          };
          node.addEventListener('mouseenter', show);
          node.addEventListener('mousemove', event => this.moveItemTooltip(event));
          node.addEventListener('mouseleave', () => { clearLongPress(); this.hideItemTooltip(); });
          node.addEventListener('dragstart', () => { clearLongPress(); this.hideItemTooltip(); });
          node.addEventListener('touchstart', event => {
            clearLongPress();
            longPressTimer = window.setTimeout(() => show(event), 430);
          }, { passive: true });
          node.addEventListener('touchmove', clearLongPress, { passive: true });
          node.addEventListener('touchend', clearLongPress, { passive: true });
          node.addEventListener('touchcancel', clearLongPress, { passive: true });
        });
        if (!this.itemTooltipGlobalDismissBound) {
          this.itemTooltipGlobalDismissBound = true;
          document.addEventListener('pointerdown', event => {
            if (!event.target?.closest?.('[data-tooltip-index],[data-tooltip-slot],[data-tooltip-bag-slot],[data-tooltip-item-id],[data-tooltip-corpse-loot-index],[data-tooltip-shop-buy],[data-tooltip-shop-sell],[data-item-tooltip]')) this.hideItemTooltip?.();
          }, true);
        }
      };

      Game.prototype.itemTooltip = function(item) {
        const built = this.buildItemTooltip?.(item) || null;
        if (!built) return '';
        const lines = [built.name, built.meta, built.subMeta].filter(Boolean);
        for (const section of built.sections || []) {
          if (section.title) lines.push(section.title);
          for (const line of section.lines || []) lines.push(line.text || String(line));
        }
        if (built.flavor) lines.push(built.flavor);
        if (built.warning) lines.push(built.warning);
        return lines.join('\n');
      };

      Game.prototype.bagBarIconHtml = function(bag, className = 'bagIcon') {
        const safeClass = escapeHtml(className);
        if (!bag) {
          return `<div class="${safeClass} emptyBagIcon bagArt bagArt-empty" aria-hidden="true"><span class="bagIconStrap"></span><span class="bagIconBody"></span><span class="bagIconFlap"></span><span class="bagIconLatch"></span></div>`;
        }
        const name = String(bag.name || bag.id || '').toLowerCase();
        const slots = Math.floor(Number(bag.slots || bag.bagSlots || bag.stats?.slots) || 0);
        const quality = String(bag.rarityKey || bag.rarity?.label || '').toLowerCase();
        const bagKind = name.includes('pouch') || slots <= 4 ? 'pouch'
          : name.includes('pack') || slots >= 10 ? 'backpack'
          : name.includes('satchel') ? 'satchel'
          : 'bag';
        const qualityClass = quality.includes('purple') || quality.includes('epic') || quality.includes('royal') ? 'quality-epic'
          : quality.includes('blue') || quality.includes('rare') ? 'quality-rare'
          : quality.includes('green') || quality.includes('uncommon') ? 'quality-uncommon'
          : quality.includes('grey') || quality.includes('gray') || quality.includes('worn') ? 'quality-worn'
          : 'quality-common';
        const color = bag.visualColor || bag.rarity?.color || bag.icon?.color || '#cfdac8';
        const accent = bag.icon?.accent || (bagKind === 'backpack' ? '#d8a35f' : bagKind === 'pouch' ? '#c99a65' : '#f0d18a');
        return `<div class="${safeClass} equippedBagIcon generatedItemIcon icon-bag bagArt bagArt-${escapeHtml(bagKind)} ${escapeHtml(qualityClass)}" style="--icon-color:${escapeHtml(color)};--icon-accent:${escapeHtml(accent)}" data-icon-family="bag" data-bag-art="${escapeHtml(bagKind)}" aria-hidden="true"><span class="bagIconStrap"></span><span class="bagIconBody"></span><span class="bagIconFlap"></span><span class="bagIconPocket"></span><span class="bagIconLatch"></span></div>`;
      };

      Game.prototype.bagBarRenderSignature = function() {
        this.ensureBagSystem?.();
        return (this.bags || []).map((bag, i) => bag
          ? [i, bag.id || bag.name || 'bag', bag.name || '', bag.slots || 0, bag.locked ? 1 : 0, bag.rarityKey || bag.rarity?.label || '', bag.icon?.color || bag.rarity?.color || ''].join(':')
          : `${i}:empty`
        ).join('|');
      };

      Game.prototype.bagWindowRenderSignature = function() {
        this.ensureBagSystem?.();
        const money = this.moneyBreakdown?.() || { copper: 0, silver: 0, gold: 0, platinum: 0 };
        const inv = (this.inventory || []).map((item, i) => item
          ? [i, item.instanceId || item.uid || item.id || item.name || 'item', item.name || '', item.stack || 1, item.maxStack || 0, item.rarityKey || item.rarity?.label || '', item.requiredClass || item.className || '', item.requiredLevel || 0].join(':')
          : `${i}:empty`
        ).join('|');
        const bags = this.bagBarRenderSignature?.() || '';
        return [this.player?.className || '', this.player?.level || 1, this.getBagCapacity?.() || 0, money.copper || 0, money.silver || 0, money.gold || 0, money.platinum || 0, bags, inv].join('~');
      };
      Game.prototype.bagItemSlotSummaryLines = function(item) {
        if (!item) return [];
        const lines = [];
        const stats = this.equipmentComparisonStats?.(item) || this.normalizeItemStats?.(item) || item.stats || {};
        const pushNumber = (label, value) => {
          const n = Number(value);
          if (!Number.isFinite(n) || n === 0 || lines.length >= 2) return;
          lines.push(`${label} ${n > 0 ? '+' : ''}${Number.isInteger(n) ? n : n.toFixed(1)}`);
        };
        const damage = item.damage && typeof item.damage === 'object' ? item.damage : null;
        if (damage && (Number.isFinite(Number(damage.min)) || Number.isFinite(Number(damage.max)))) lines.push(`Damage ${Number(damage.min || 0)}-${Number(damage.max || 0)}`);
        else if (Number.isFinite(Number(item.minDamage)) || Number.isFinite(Number(item.maxDamage))) lines.push(`Damage ${Number(item.minDamage || 0)}-${Number(item.maxDamage || 0)}`);
        pushNumber('Armor', stats.armor ?? item.armor);
        pushNumber('HP', stats.hp ?? stats.maxHp);
        pushNumber('Mana', stats.mana ?? stats.maxMana);
        pushNumber('Atk', stats.attack ?? stats.damage);
        pushNumber('Def', stats.defense);
        pushNumber('STR', stats.strength);
        pushNumber('DEX', stats.dexterity);
        pushNumber('STA', stats.stamina);
        pushNumber('INT', stats.intelligence);
        pushNumber('WIS', stats.wisdom);
        if (!lines.length && this.isBagItem?.(item)) {
          const slots = Math.max(0, Math.floor(Number(item.slots || item.bagSlots || item.stats?.slots) || 0));
          if (slots) lines.push(`${slots} bag slots`);
        }
        if (!lines.length && (item.useEffect || item.consumable || String(item.type || '').toLowerCase().includes('consum'))) lines.push('Use item');
        return lines.slice(0, 2);
      };

      Game.prototype.renderBagBar = function() {
        if (!ui.bagBar || !this.player) return;
        this.ensureBagSystem();
        const signature = this.bagBarRenderSignature?.() || '';
        if (!this.bagDirty && ui.bagBar.dataset.signature === signature) return;
        ui.bagBar.dataset.signature = signature;
        ui.bagBar.innerHTML = this.bags.map((bag, i) => {
          if (!bag) return `<div class="bagEquipSlot emptyBagSlot" data-bag-slot="${i}" title="Empty bag slot"><span class="slotLabel">${i + 1}</span>${this.bagBarIconHtml?.(null, 'bagIcon') || ''}<span class="itemMeta">Empty</span></div>`;
          const color = bag.rarity?.color || bag.icon?.color || '#cfdac8';
          const icon = this.bagBarIconHtml?.(bag, 'bagIcon') || this.itemIconHtml(bag, 'bagIcon');
          const title = `${bag.name}\n${bag.slots} slots${bag.locked ? '\nStarter bag cannot be removed.' : '\nRight-click to unequip.'}`;
          return `<div class="bagEquipSlot itemSlot ${bag.locked ? 'lockedBag' : ''}" data-bag-slot="${i}" data-tooltip-bag-slot="${i}" data-drag-item="bagSlot" style="--rarity-color:${escapeHtml(color)};border-color:${escapeHtml(color)}" title="${escapeHtml(title)}"><span class="slotLabel">${i + 1}</span>${icon}<span class="itemMeta">${bag.slots}</span></div>`;
        }).join('');
        ui.bagBar.querySelectorAll('[data-bag-slot]').forEach(node => {
          node.addEventListener('click', () => this.toggleBag(true));
          node.addEventListener('contextmenu', e => { e.preventDefault(); this.unequipBagSlot(Number(node.dataset.bagSlot)); });
          node.addEventListener('dblclick', () => this.unequipBagSlot(Number(node.dataset.bagSlot)));
        });
        this.bindItemTooltips?.(ui.bagBar, node => this.bags?.[Number(node.dataset.tooltipBagSlot)] || null);
        this.bindItemDragHandlers?.(ui.bagBar, node => ({ item: this.bags?.[Number(node.dataset.bagSlot)] || null, sourceSlot: Number(node.dataset.bagSlot), source: 'bagSlot' }));
      };

      Game.prototype.renderBag = function() {
        if (!this.player) return;
        this.ensureBagSystem();
        this.renderBagBar?.();
        const capacity = this.getBagCapacity();
        const m = this.moneyBreakdown();
        const signature = this.bagWindowRenderSignature?.() || '';
        if (!this.bagDirty && ui.bagGrid?.dataset.signature === signature) {
          if (ui.bagMeta) {
            const meta = `${this.inventory.length} / ${capacity} slots`;
            if (ui.bagMeta.textContent !== meta) ui.bagMeta.textContent = meta;
          }
          return;
        }
        if (ui.bagGrid) ui.bagGrid.dataset.signature = signature;
        if (ui.bagMeta) ui.bagMeta.textContent = `${this.inventory.length} / ${capacity} slots`;
        const moneyHtml = `<div class="bagMoneyLine"><span>🟤 ${m.copper}C</span><span>⚪ ${m.silver}S</span><span>🟡 ${m.gold}G</span><span>🟣 ${m.platinum}P</span></div>`;

        ui.bagGrid.innerHTML = this.getBagSections().map(section => {
          if (!section.bag || section.slots <= 0) return '';
          const cells = Array.from({ length: section.slots }, (_, offset) => {
            const i = section.start + offset;
            const item = this.inventory[i];
            if (!item) return `<div class="bagSlot"><span class="slotLabel">${offset + 1}</span></div>`;
            const isBag = this.isBagItem(item);
            const isMaterial = this.isMaterialItem(item);
            const isConsumable = this.isConsumableItem(item);
            const canClass = isMaterial || isConsumable || isBag || this.canUseItemClass(item);
            const canEquipNow = isMaterial || isConsumable || isBag ? true : this.canEquip(item);
            const stackText = item.maxStack ? `${item.stack || 1}/${item.maxStack}` : `${item.stack || 1}`;
            const rarityColor = item.rarity?.color || '#cfdac8';
            const icon = this.itemIconHtml(item, 'inventoryIcon bagSlotItemIcon');
            const req = (!isMaterial && !isConsumable && !isBag) ? `<div class="classReqLine ${canClass && canEquipNow ? '' : 'cannotUse'}">${escapeHtml(this.itemClassRequirementText(item))}</div>` : '';
            const qty = (item.stack || 1) > 1 || item.maxStack ? `<span class="stackBadge">${escapeHtml(stackText)}</span>` : '';
            const statLines = this.bagItemSlotSummaryLines?.(item) || [];
            const statHtml = statLines.length ? `<div class="bagCardStats">${statLines.map(line => `<span>${escapeHtml(line)}</span>`).join('')}</div>` : '';
            return `<div class="bagSlot itemSlot" data-index="${i}" data-tooltip-index="${i}" data-drag-item="inventory" style="--rarity-color:${escapeHtml(rarityColor)};--icon-color:${escapeHtml(rarityColor)}" title="${escapeHtml(this.itemTooltip(item))}">${icon}${qty}<span class="itemName">${escapeHtml(item.name)}</span><span class="itemMeta">${escapeHtml(item.rarity?.label || item.rarityKey || 'Common')}</span>${req}${statHtml}</div>`;
          }).join('');
          const bag = section.bag;
          const color = bag.rarity?.color || '#cfdac8';
          return `<section class="bagWindow" style="--rarity-color:${escapeHtml(color)}"><div class="bagWindowTitle"><div style="display:flex;align-items:center;gap:8px">${this.itemIconHtml(bag, 'bagIcon')}<div><div class="bagWindowName">${escapeHtml(bag.name)}</div><div class="small">Slots: ${section.slots}</div></div></div></div>${section.index === 0 ? moneyHtml : ''}<div class="bagItemGrid">${cells}</div></section>`;
        }).join('');

        ui.bagGrid.querySelectorAll('[data-index]').forEach(node => {
          node.addEventListener('contextmenu', e => {
            e.preventDefault();
            this.equipInventoryItem(Number(node.dataset.index));
          });
          node.addEventListener('dblclick', () => this.useInventoryItem ? this.useInventoryItem(Number(node.dataset.index)) : this.equipInventoryItem(Number(node.dataset.index)));
          // Phase 9/10 (Intersect parity): click a bag item while the bank
          // or an active trade window is open to deposit/offer it. Owned by
          // systems/bank-system.js (depositItemToBank) and systems/trade-
          // system.js (addItemToTradeOffer) respectively - this is just the
          // input forward, matching the existing pattern where contextmenu/
          // dblclick above already call into other owning functions.
          node.addEventListener('click', () => {
            if (this.bankOpen) this.depositItemToBank?.(Number(node.dataset.index));
            else if (this.activeTrade && !this.activeTrade.executed) this.addItemToTradeOffer?.(Number(node.dataset.index));
          });
        });
        this.bindItemTooltips?.(ui.bagGrid, node => this.inventory?.[Number(node.dataset.tooltipIndex)] || null);
        this.bindItemDragHandlers?.(ui.bagGrid, node => ({ item: this.inventory?.[Number(node.dataset.index)] || null, sourceSlot: Number(node.dataset.index), source: 'inventory' }));
        this.bagDirty = false;
      };

      Game.prototype.cloneItemForWorldDrop = function(item) {
        if (!item) return null;
        try { return JSON.parse(JSON.stringify(item)); }
        catch (_err) { return { ...item }; }
      };

      Game.prototype.isItemDropProtected = function(item, source = null) {
        if (!item) return true;
        const kind = String(item.kind || item.type || item.category || '').toLowerCase();
        if ((kind === 'quest' || item.questItem || item.quest || item.requiredQuestState) && item.droppable !== true && item.allowDrop !== true) return true;
        return Boolean(
          item.systemLocked || item.locked || item.protected || item.soulbound || item.bound ||
          item.noDrop || item.lockedNoDrop || item.neverDrop || item.starter ||
          (source === 'bagSlot' && (item.locked || item.starter))
        );
      };

      Game.prototype.canDropEquippedBagSlot = function(bagIndex) {
        this.ensureBagSystem?.();
        const index = Math.floor(Number(bagIndex));
        const bag = this.bags?.[index];
        if (!bag || bag.locked || bag.starter || this.isItemDropProtected?.(bag, 'bagSlot')) return false;
        const capacityWithout = (this.bags || []).reduce((sum, candidate, i) => {
          if (i === index || !candidate) return sum;
          return sum + Math.max(0, Math.floor(Number(candidate.slots) || 0));
        }, 0);
        const used = Array.isArray(this.inventory) ? this.inventory.filter(Boolean).length : 0;
        if (used > capacityWithout) {
          this.log?.(`${bag.name || 'That bag'} must be empty before you drop it.`, 'System');
          return false;
        }
        return true;
      };

      Game.prototype.beginItemDrag = function(item, sourceSlot, sourceContainer, options = {}) {
        if (!item) return false;
        const source = String(sourceContainer || options.source || 'inventory');
        if (this.isItemDropProtected?.(item, source)) {
          this.log?.(`${item.name || 'That item'} cannot be dropped.`, 'System');
          return false;
        }
        if (source === 'bagSlot' && !this.canDropEquippedBagSlot?.(sourceSlot)) return false;
        this.hideItemTooltip?.();
        this.currentItemDrag = {
          item,
          source,
          sourceSlot,
          sourceContainer: sourceContainer || source,
          startedAt: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
          transactionId: `item-drag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          committed: false
        };
        this.draggedItem = item;
        return true;
      };

      Game.prototype.cancelItemDrag = function() {
        this.currentItemDrag = null;
        this.draggedItem = null;
        this.dragState = null;
        return true;
      };

      Game.prototype.removeDraggedItemFromSource = function(drag = this.currentItemDrag) {
        if (!drag?.item) return false;
        const source = String(drag.source || drag.sourceContainer || 'inventory');
        if (source === 'inventory') {
          const index = Math.floor(Number(drag.sourceSlot));
          if (!Array.isArray(this.inventory) || this.inventory[index] !== drag.item) return false;
          this.inventory.splice(index, 1);
          return true;
        }
        if (source === 'bagSlot') {
          const index = Math.floor(Number(drag.sourceSlot));
          if (!Array.isArray(this.bags) || this.bags[index] !== drag.item) return false;
          if (!this.canDropEquippedBagSlot?.(index)) return false;
          this.bags[index] = null;
          return true;
        }
        return false;
      };

      Game.prototype.isValidGroundDropTile = function(x, y) {
        const tx = Math.floor(Number(x));
        const ty = Math.floor(Number(y));
        const dropBoundsSize = this.activeMapSize?.() || CONFIG.MAP_SIZE;
        if (!Number.isFinite(tx) || !Number.isFinite(ty) || tx < 0 || ty < 0 || tx >= dropBoundsSize || ty >= dropBoundsSize) return false;
        const tile = this.map?.[ty]?.[tx];
        if (!tile || tile.blocked || tile.solid || tile.collision) return false;
        const waterType = (TILE && TILE.WATER) || DR.TILE?.WATER;
        // TILE TYPE IS THE AUTHORITY ON WHETHER A TILE IS WATER, not waterDepth.
        //
        // This used to also reject on `waterDepth > 0.2`, which was an OR, so tile type never gated
        // it. 37 non-water tiles in the overworld carry stale waterDepth (33 STONE and 4 DIRT on the
        // raised shelf around x 70-86, y 66-70 - a terrain-generation leftover), and every one of
        // them silently refused item drops. Measured by clearing waterDepth alone and re-testing:
        // 36 of the 37 flipped from "cannot drop" to "can drop", so this was live, not theoretical.
        //
        // Removing the depth clause is safe rather than merely narrower: every genuinely wet tile in
        // the world IS type WATER (1455 overworld + 130 cave), and a WATER tile is rejected on the
        // line below regardless of its depth - so the clause could only ever have fired on tiles that
        // were NOT water. Swimming, fishing and terrain rendering already test type this way.
        if (tile.type === waterType) return false;
        if (this.hasBlockingObjectAt?.(tx, ty, this.player)) return false;
        const attr = this.editorAttributes?.[this.currentZone === 'cave' ? (this.getActiveCaveZoneKey?.() || this.currentCave?.id || 'mossfang_cave') : 'dark_woods']?.[`${tx},${ty}`] || {};
        if (attr.blocked || attr.solid || attr.collision || attr.collisionOnly || attr.noItemDrop) return false;
        return true;
      };

      Game.prototype.findClosestValidGroundDropTile = function(targetX, targetY, radius = 5) {
        const px = Number(this.player?.x ?? targetX);
        const py = Number(this.player?.y ?? targetY);
        const tx = Number.isFinite(Number(targetX)) ? Number(targetX) : px;
        const ty = Number.isFinite(Number(targetY)) ? Number(targetY) : py;
        const searchRadius = Math.max(1, Math.min(8, Math.floor(Number(radius) || 5)));
        let best = null;
        let bestScore = Infinity;
        const cx = Math.floor(tx);
        const cy = Math.floor(ty);
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            const x = cx + dx + 0.5;
            const y = cy + dy + 0.5;
            if (!this.isValidGroundDropTile?.(x, y)) continue;
            const playerDistance = Math.hypot(x - px, y - py);
            if (playerDistance > searchRadius + 1.5) continue;
            const targetDistance = Math.hypot(x - tx, y - ty);
            const score = targetDistance + playerDistance * 0.12;
            if (score < bestScore) { best = { x, y }; bestScore = score; }
          }
        }
        if (!best && this.isValidGroundDropTile?.(px, py)) best = { x: Math.floor(px) + 0.5, y: Math.floor(py) + 0.5 };
        return best;
      };

      Game.prototype.dropDraggedItemToWorld = function(worldX, worldY) {
        const drag = this.currentItemDrag;
        if (!drag?.item || !this.player || drag.committed) return false;
        if (this.isItemDropProtected?.(drag.item, drag.source)) {
          this.cancelItemDrag?.();
          return false;
        }
        const location = this.findClosestValidGroundDropTile?.(worldX, worldY, 5) || this.findClosestValidGroundDropTile?.(this.player.x, this.player.y, 5);
        if (!location) {
          this.log?.('No valid ground tile nearby. Item returned to your bag.', 'System');
          this.cancelItemDrag?.();
          return false;
        }
        const droppedItem = this.cloneItemForWorldDrop?.(drag.item) || { ...drag.item };
        const ground = this.createTemporaryGroundItem?.(droppedItem, location.x, location.y, {
          source: 'player-drop',
          ownerId: this.player.id || this.player.name || 'player',
          despawnMs: 45000
        });
        if (!ground) {
          this.log?.('Item drop failed. Item remains in your bag.', 'System');
          this.cancelItemDrag?.();
          return false;
        }
        if (!this.removeDraggedItemFromSource?.(drag)) {
          this.removeTemporaryGroundItem?.(ground);
          this.log?.('Item drop cancelled. Item remains in your bag.', 'System');
          this.cancelItemDrag?.();
          return false;
        }
        drag.committed = true;
        this.playAudioEvent?.('loot_item', { x: location.x, y: location.y, volume: 0.18, cooldown: 0.12 });
        this.log?.(`Dropped ${droppedItem.name || 'item'} on the ground.`, 'System');
        this.cancelItemDrag?.();
        this.bagDirty = true;
        this.renderBagBar?.();
        if (this.bagOpen) this.renderBag?.();
        this.updateUI?.();
        return true;
      };

      Game.prototype.ensureWorldItemDropHandlers = function() {
        const dropCanvas = window.canvas || DR.runtime?.canvas || document.getElementById('game');
        if (!dropCanvas || this.worldItemDropHandlersBound) return;
        this.worldItemDropHandlersBound = true;
        dropCanvas.addEventListener('dragover', event => {
          if (!this.currentItemDrag?.item) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        });
        dropCanvas.addEventListener('dragenter', event => {
          if (this.currentItemDrag?.item) event.preventDefault();
        });
        dropCanvas.addEventListener('drop', event => {
          if (!this.currentItemDrag?.item) return;
          event.preventDefault();
          const rect = dropCanvas.getBoundingClientRect();
          const sx = event.clientX - rect.left;
          const sy = event.clientY - rect.top;
          const world = this.safeScreenToWorld ? this.safeScreenToWorld(sx, sy) : this.screenToWorld?.(sx, sy);
          if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) {
            this.cancelItemDrag?.();
            return;
          }
          this.dropDraggedItemToWorld?.(world.x, world.y);
        });
        document.addEventListener('dragend', () => {
          if (this.currentItemDrag?.item) this.cancelItemDrag?.();
        }, true);
      };

      Game.prototype.bindItemDragHandlers = function(root, resolveDrag, context = {}) {
        if (!root || typeof resolveDrag !== 'function') return;
        this.ensureWorldItemDropHandlers?.();
        root.querySelectorAll('[data-drag-item]').forEach(node => {
          if (node.dataset.itemDragBound === '1') return;
          node.dataset.itemDragBound = '1';
          node.setAttribute('draggable', 'true');
          node.addEventListener('dragstart', event => {
            const data = resolveDrag(node) || null;
            if (!data?.item || !this.beginItemDrag?.(data.item, data.sourceSlot, data.source, context)) {
              event.preventDefault();
              return false;
            }
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', data.item.name || data.item.itemId || 'item');
            }
            node.classList.add('draggingItemSlot');
            this.hideItemTooltip?.();
            return true;
          });
          node.addEventListener('dragend', () => {
            node.classList.remove('draggingItemSlot');
          });
        });
      };

      // Returns the vendor sell-back price in COPPER. Authored item values (sellValue/value) are on the
      // SILVER scale, so the silver->copper conversion happens here (V0.18.99). Every consumer -
      // vendorSellInventoryIndex's addCopper, the item tooltip's formatCopper, the bags-full overflow,
      // and auditEconomy - already works in copper, so they are all correct off this one conversion.
      Game.prototype.itemSellValue = function(item) {
      if (!item) return 0;
      const base = Number(item.value ?? item.sellValue ?? item.price ?? item.baseValue ?? 1);
      const rarityMult = item.rarity?.sellMultiplier ?? item.rarityMultiplier ?? 1;
      const levelMult = 1 + Math.max(0, Number(item.level || item.requiredLevel || 1) - 1) * 0.08;
      return Math.max(1, Math.floor(base * rarityMult * levelMult * 0.35 * COPPER_PER_SILVER));
    };

    Game.prototype.formatCopper = function(copper) {
      copper = Math.max(0, Math.floor(Number(copper) || 0));
      const platinum = Math.floor(copper / 1000000);
      copper %= 1000000;
      const gold = Math.floor(copper / 10000);
      copper %= 10000;
      const silver = Math.floor(copper / 100);
      copper %= 100;
      return `${copper}C ${silver}S ${gold}G ${platinum}P`;
    };

    Game.prototype.openVendorSellWindow = function(vendor = null) {
      // V0.13.8: the sell list is owned by event-system's shop window.
      // This compatibility entrypoint must not create a second confirmation/sell panel.
      this.activeVendor = vendor || this.activeVendor || { name: 'Vendor' };
      this.vendorOpen = true;
      const legacyPanel = document.getElementById('vendorPanel');
      if (legacyPanel) legacyPanel.remove();

      const shop = this.eventSystem;
      if (shop?.activeShop) {
        shop.activeShopTab = 'sell';
        shop.renderShop?.();
        return true;
      }

      if (shop?.openShop && vendor) {
        const shopNode = {
          ...vendor,
          name: vendor.name || 'Vendor',
          shopId: vendor.shopId || 'shop_camp_basic_goods',
          category: 'shop',
          type: 'shop_event'
        };
        const opened = shop.openShop(shopNode);
        if (opened) {
          shop.activeShopTab = 'sell';
          shop.renderShop?.();
          return true;
        }
      }

      this.log?.('No active vendor shop is available.', 'System');
      return false;
    };

    Game.prototype.closeVendorSellWindow = function() {
      this.vendorOpen = false;
      const panel = document.getElementById('vendorPanel');
      if (panel) panel.remove();
    };

    Game.prototype.isItemSellProtected = function(item) {
      if (!item) return true;
      // V0.12.93: merchants buy everything the player carries in bags.
      // Bound/starter/class-restricted/quest-tagged inventory items are still
      // valid vendor trash unless an item is explicitly engine-locked. Equipped
      // gear is not enumerated here, so the player cannot accidentally sell
      // currently worn items through the bag vendor list.
      return Boolean(item.systemLocked || item.lockedNoSell || item.neverSell);
    };

    Game.prototype.vendorItemQuantity = function(item) {
      return Math.max(1, Math.floor(Number(item?.qty ?? item?.quantity ?? item?.stack ?? 1) || 1));
    };

    Game.prototype.collectVendorSellRows = function() {
      const rows = [];
      const inventory = Array.isArray(this.inventory) ? this.inventory : [];
      inventory.forEach((item, inventoryIndex) => {
        if (!item || this.isItemSellProtected?.(item)) return;
        const qty = this.vendorItemQuantity(item);
        rows.push({
          source: 'inventory',
          inventoryIndex,
          item,
          qty,
          value: this.itemSellValue(item)
        });
      });

      // Backward compatibility for any older save/build that stored contents
      // directly inside bag slot arrays instead of the canonical inventory list.
      const equippedBags = this.bags?.equipped || [];
      equippedBags.forEach((bag, bagIndex) => {
        const slots = bag?.slots || [];
        if (!Array.isArray(slots)) return;
        slots.forEach((slot, slotIndex) => {
          const item = slot?.item || slot;
          if (!item || this.isItemSellProtected?.(item)) return;
          rows.push({ source: 'bagSlot', bagIndex, slotIndex, item, qty: Math.max(1, Number(slot.qty ?? item.qty ?? item.quantity ?? item.stack ?? 1)), value: this.itemSellValue(item) });
        });
      });
      return rows;
    };

    Game.prototype.vendorSellRow = function(row) {
      if (!row) return false;
      if (row.source === 'inventory') return this.vendorSellInventoryIndex(row.inventoryIndex);
      if (row.source === 'bagSlot') {
        const bag = this.bags?.equipped?.[row.bagIndex];
        return this.vendorSellItem(bag, row.slotIndex);
      }
      return false;
    };

    Game.prototype.vendorSellInventoryIndex = function(index) {
      const inventory = Array.isArray(this.inventory) ? this.inventory : [];
      const item = inventory[index];
      if (!item) return false;
      if (this.isItemSellProtected?.(item)) {
        this.log?.(`${item.name || 'That item'} cannot be sold.`, 'System');
        return false;
      }
      const qty = this.vendorItemQuantity(item);
      const sellQty = 1;
      const value = this.itemSellValue(item) * sellQty;
      if (this.addCopper) this.addCopper(value);
      else {
        this.player = this.player || {};
        this.player.coinCopper = Math.max(0, Number(this.player.coinCopper) || 0) + value;
      }

      if (qty > 1) {
        item.qty = qty - sellQty;
        item.quantity = item.qty;
        item.stack = item.qty;
      } else {
        inventory.splice(index, 1);
      }

      this.normalizeMoney?.();
      this.bagDirty = true;
      this.updateHud?.();
      this.updateUI?.();
      this.renderBagBar?.();
      this.renderOpenBagWindows?.();
      if (this.bagOpen) this.renderBag?.();
      this.renderVendorSellWindow?.();
      this.eventSystem?.renderShop?.();
      this.log?.(`Sold ${item.name || 'item'} for ${this.formatCopper(value)}.`, 'System');
      this.saveCharacterState?.({ reason: 'vendor-sell', silent: true });
      return true;
    };

    Game.prototype.vendorSellItem = function(container, slotIndex) {
      const slot = container?.slots?.[slotIndex] || container?.[slotIndex];
      const item = slot?.item || slot;
      if (!item) return false;
      if (this.isItemSellProtected?.(item)) {
        this.log?.(`${item.name || 'That item'} cannot be sold.`, 'System');
        return false;
      }
      const qty = Math.max(1, Number(slot.qty ?? item.qty ?? item.quantity ?? item.stack ?? 1));
      const sellQty = 1;
      const value = this.itemSellValue(item) * sellQty;
      if (this.addCopper) this.addCopper(value);
      else {
        this.player = this.player || {};
        this.player.coinCopper = Math.max(0, Number(this.player.coinCopper) || 0) + value;
      }
      const clearSlot = () => {
        if (Array.isArray(container?.slots)) container.slots[slotIndex] = null;
        else if (Array.isArray(container)) container[slotIndex] = null;
      };
      if (slot.item) {
        slot.qty = qty - sellQty;
        if (slot.qty <= 0) clearSlot();
      } else if (item.qty || item.quantity || item.stack) {
        item.qty = qty - sellQty;
        item.quantity = item.qty;
        item.stack = item.qty;
        if (item.qty <= 0) clearSlot();
      } else {
        clearSlot();
      }
      this.normalizeMoney?.();
      this.bagDirty = true;
      this.updateHud?.();
      this.updateUI?.();
      this.renderBagBar?.();
      this.renderOpenBagWindows?.();
      if (this.bagOpen) this.renderBag?.();
      this.renderVendorSellWindow?.();
      this.eventSystem?.renderShop?.();
      this.log?.(`Sold ${item.name || 'item'} for ${this.formatCopper(value)}.`, 'System');
      this.saveCharacterState?.({ reason: 'vendor-sell', silent: true });
      return true;
    };

    Game.prototype.renderVendorSellWindow = function() {
      // V0.13.8: compatibility no-op for older callers. Selling is rendered
      // inside the existing shop window so one Sell click performs one sale.
      const legacyPanel = document.getElementById('vendorPanel');
      if (legacyPanel) legacyPanel.remove();
      if (this.eventSystem?.activeShop) {
        this.eventSystem.activeShopTab = 'sell';
        this.eventSystem.renderShop?.();
        return true;
      }
      return false;
    };

    }
  };
})();
