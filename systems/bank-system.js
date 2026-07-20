// Dream Realms bank system
// Phase 9 (Intersect parity): personal, per-character item storage - a
// second container alongside this.inventory/this.bags, with the same item
// shape and the same save-system ownership pattern (see systems/save-
// system.js: applyCharacterState / buildCharacterSaveData).
// Scope (see docs/PHASE_7_CLASS_STAT_INVENTORY_AUDIT.txt): local per-
// character storage only. No cross-character or guild-shared bank yet, and
// the storage window is opened from the permanent Dead Lantern camp Stash
// chest. Storage remains local and per-character by design.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const BANK_CAPACITY = 48;

  DR.BankSystem = {
    CAPACITY: BANK_CAPACITY,
    install(Game) {
      const ui = DR.ui;

      Game.prototype.ensureBankSystem = function() {
        if (!Array.isArray(this.bank)) this.bank = [];
        return this.bank;
      };

      Game.prototype.getBankCapacity = function() {
        return BANK_CAPACITY;
      };

      Game.prototype.toggleBank = function(force) {
        if (!ui?.bankPanel) return false;
        this.ensureBankSystem();
        const wasOpen = !!this.bankOpen;
        this.bankOpen = typeof force === 'boolean' ? force : !this.bankOpen;
        ui.bankPanel.style.display = this.bankOpen ? 'block' : 'none';
        if (this.started && wasOpen !== this.bankOpen) this.playAudioEvent?.(this.bankOpen ? 'bag_open' : 'ui_close');
        if (this.bankOpen) this.renderBank();
        return this.bankOpen;
      };

      Game.prototype.closeBank = function() {
        this.toggleBank(false);
      };


      Game.prototype.openStashFromWorldChest = function(node = null) {
        this.ensureBankSystem();
        const opened = this.toggleBank(true);
        if (!opened) return false;
        const x = Number(node?.x);
        const y = Number(node?.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          this.playAudioEvent?.('chest_open', { x: x + 0.5, y: y + 0.5, volume: 0.42, cooldown: 0.28 });
          this.spawnRing?.(x + 0.5, y + 0.5, '#d8ad57', 24);
        } else {
          this.playAudioEvent?.('bag_open');
        }
        this.log?.(`Opened ${node?.name || 'Stash'}.`, 'System');
        return true;
      };

      Game.prototype.depositItemToBank = function(inventoryIndex) {
        const item = this.inventory?.[inventoryIndex];
        if (!item) return false;
        // Reuses the existing drop-protection check (soulbound/locked/
        // starter/quest-tagged items) rather than introducing a parallel
        // "can bank" flag no content sets - see Phase 7 audit's note that
        // canBank/canDrop are the same underlying protection concept here.
        if (this.isItemDropProtected?.(item)) {
          this.log?.(`${item.name} cannot be banked.`, 'System');
          return false;
        }
        this.ensureBankSystem();
        if (this.bank.length >= this.getBankCapacity()) {
          this.log?.('Stash is full.', 'System');
          return false;
        }
        this.inventory.splice(inventoryIndex, 1);
        this.bank.push(item);
        this.bagDirty = true;
        this.bankDirty = true;
        if (this.bagOpen) this.renderBag?.();
        this.renderBank();
        this.updateUI?.();
        return true;
      };

      Game.prototype.withdrawItemFromBank = function(bankIndex) {
        this.ensureBankSystem();
        const item = this.bank[bankIndex];
        if (!item) return false;
        const capacity = this.getBagCapacity ? this.getBagCapacity() : (DR.CONFIG?.BAG_SIZE || 36);
        if ((this.inventory || []).length >= capacity) {
          this.log?.('Bags are full.', 'System');
          return false;
        }
        this.bank.splice(bankIndex, 1);
        this.inventory.push(item);
        this.bagDirty = true;
        this.bankDirty = true;
        if (this.bagOpen) this.renderBag?.();
        this.renderBank();
        this.updateUI?.();
        return true;
      };

      Game.prototype.renderBank = function() {
        if (!ui?.bankGrid) return;
        this.ensureBankSystem();
        const capacity = this.getBankCapacity();
        if (ui.bankMeta) ui.bankMeta.textContent = `${this.bank.length} / ${capacity} slots`;
        const cells = Array.from({ length: capacity }, (_, i) => {
          const item = this.bank[i];
          if (!item) return `<div class="bagSlot"><span class="slotLabel">${i + 1}</span></div>`;
          const stackText = item.maxStack ? `${item.stack || 1}/${item.maxStack}` : `${item.stack || 1}`;
          const rarityColor = item.rarity?.color || '#cfdac8';
          const icon = this.itemIconHtml ? this.itemIconHtml(item, 'inventoryIcon') : '';
          const qty = (item.stack || 1) > 1 || item.maxStack ? `<span class="stackBadge">${escapeHtml(stackText)}</span>` : '';
          const tooltip = this.itemTooltip ? this.itemTooltip(item) : (item.name || '');
          return `<div class="bagSlot itemSlot" data-bank-index="${i}" data-tooltip-index="${i}" style="--rarity-color:${escapeHtml(rarityColor)};--icon-color:${escapeHtml(rarityColor)}" title="${escapeHtml(tooltip)}">${icon}${qty}<span class="itemName">${escapeHtml(item.name || '')}</span></div>`;
        }).join('');
        ui.bankGrid.innerHTML = cells;
        ui.bankGrid.querySelectorAll('[data-bank-index]').forEach(node => {
          node.addEventListener('click', () => this.withdrawItemFromBank(Number(node.dataset.bankIndex)));
        });
        this.bindItemTooltips?.(ui.bankGrid, node => this.bank?.[Number(node.dataset.tooltipIndex)] || null);
        this.bankDirty = false;
      };

      // Save-system integration point: called from systems/save-system.js
      // buildCharacterSaveData / applyCharacterState, the same two places
      // that own itemCooldowns persistence.
      Game.prototype.serializeBankState = function() {
        this.ensureBankSystem();
        return this.bank.map(item => {
          try { return JSON.parse(JSON.stringify(item)); }
          catch (_err) { return null; }
        }).filter(Boolean);
      };

      Game.prototype.importBankState = function(data) {
        this.bank = Array.isArray(data)
          ? data.slice(0, BANK_CAPACITY).filter(item => item && typeof item === 'object')
          : [];
      };
    }
  };
})();
