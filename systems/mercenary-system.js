// Dream Realms mercenary hiring/runtime system
// V0.12.79 owner: mercenary hiring, commands, progression, recovery/revive, equipment rules, and guarded gear UI helpers.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const MERC_ROLES = DR.MERC_ROLES || window.MERC_ROLES;
  const { Mercenary } = DR.entities || window;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  DR.MercenarySystem = {
    install(Game) {
      Game.prototype.markMercUiDirty = function(options = {}) {
        this.mercPanelDirty = true;
        this.mercCommandDirty = options.commands !== false;
        this.mercGearDirty = options.gear !== false;
      };

      Game.prototype.mercNamePool = function(roleKey = '') {
        const pools = {
          guardian: ['Brann', 'Corven', 'Hale', 'Torr', 'Dain', 'Marek', 'Odran', 'Brom'],
          cleric: ['Liora', 'Maelle', 'Sera', 'Anwen', 'Elian', 'Rowan', 'Mirra', 'Caela'],
          adept: ['Ilyr', 'Selene', 'Varro', 'Nyra', 'Orris', 'Thalen', 'Vey', 'Calder'],
          scout: ['Vexa', 'Kest', 'Rusk', 'Nell', 'Mara', 'Jory', 'Ash', 'Tavia']
        };
        return pools[String(roleKey || '').toLowerCase()] || ['Rowan', 'Marek', 'Sera', 'Vexa', 'Ilyr'];
      };

      Game.prototype.formatMercDisplayName = function(merc) {
        if (!merc) return 'Mercenary';
        const role = merc.roleLabel || MERC_ROLES?.[merc.roleKey]?.label || 'Mercenary';
        const base = merc.displayBaseName || merc.baseName || String(merc.name || role).split(' - ')[0] || 'Hireling';
        return `${base} - ${role} - Lvl ${Math.max(1, Math.floor(Number(merc.level) || 1))}`;
      };

      Game.prototype.assignMercRandomName = function(merc) {
        if (!merc) return merc;
        const pool = this.mercNamePool?.(merc.roleKey) || ['Rowan'];
        merc.displayBaseName = merc.displayBaseName || pool[Math.floor(Math.random() * pool.length)] || 'Rowan';
        merc.name = this.formatMercDisplayName?.(merc) || merc.name;
        return merc;
      };

      Game.prototype.mercContractButtonsHtml = function() {
        return Object.entries(MERC_ROLES || {}).map(([key, role]) => `<button data-npc-action="hire-merc:${escapeHtml(key)}"><strong>${escapeHtml(role.label)}</strong><span class="small">${escapeHtml(role.desc || 'Mercenary')} · ${Math.floor(Number(role.cost) || 0)}g</span></button>`).join('');
      };

      Game.prototype.mercContractClassName = function(roleKey, role = null) {
        const key = String(roleKey || '').toLowerCase();
        return String(role?.className || ({ guardian: 'Fighter', cleric: 'Cleric', adept: 'Enchanter', scout: 'Rogue' })[key] || 'Fighter');
      };

      Game.prototype.mercContractHash = function(text) {
        let h = 2166136261;
        const s = String(text || 'mercenary-contract');
        for (let i = 0; i < s.length; i++) {
          h ^= s.charCodeAt(i);
          h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
      };

      Game.prototype.refreshMercHiringRoster = function(force = false) {
        const playerLevel = Math.max(1, Math.floor(Number(this.player?.level) || 1));
        const seedBase = `${this.localPeerId || 'local'}:${playerLevel}`;
        if (!force && Array.isArray(this.mercHiringRoster) && this.mercHiringRosterLevel === playerLevel) return this.mercHiringRoster;
        this.mercHiringRosterLevel = playerLevel;
        this.mercHiringRoster = Object.entries(MERC_ROLES || {}).map(([key, role], index) => {
          const pool = this.mercNamePool?.(key) || ['Rowan'];
          const hash = this.mercContractHash?.(`${seedBase}:${key}:${index}`) || index;
          const name = pool[Math.abs(hash) % pool.length] || 'Rowan';
          const level = Math.max(1, Math.min(60, playerLevel + (index % 2 === 0 ? 0 : Math.max(0, Math.floor(playerLevel / 8)))));
          const cost = Math.max(1, Math.floor(Number(role.cost) || 0));
          return {
            roleKey: key,
            name,
            className: this.mercContractClassName?.(key, role) || 'Fighter',
            roleLabel: role.label || 'Mercenary',
            archetype: this.mercRoleArchetype?.({ roleKey: key, roleLabel: role.label }) || role.desc || 'Mercenary',
            level,
            cost,
            color: role.color || '#c2ec9e',
            desc: role.desc || 'Mercenary'
          };
        });
        return this.mercHiringRoster;
      };

      Game.prototype.getMercHiringContract = function(roleKey) {
        const key = String(roleKey || '').toLowerCase();
        return (this.refreshMercHiringRoster?.() || []).find(contract => String(contract.roleKey).toLowerCase() === key) || null;
      };

      Game.prototype.mercenaryHiringPanelHtml = function(options = {}) {
        const roster = this.refreshMercHiringRoster?.() || [];
        const gold = Math.max(0, Math.floor(Number(this.player?.gold) || 0));
        const partyMax = this.partyMaxSize?.() || window.DreamRealms?.MAX_PARTY_SIZE || 6;
        const partyCount = this.partyCapacityCount?.() || 1;
        const activeMerc = this.merc || null;
        const intro = options.compact ? 'Standard contracts available.' : 'Looking for capable swords, magic, or stealth? My mercenaries never disappoint... for a price.';
        const activeCard = activeMerc ? `<div class="mercHireCard active"><div class="mercHireIcon">${escapeHtml(this.mercRoleIcon?.(activeMerc) || '◆')}</div><div class="mercHireInfo"><strong>${escapeHtml(activeMerc.name || 'Mercenary')}</strong><span>Active ${escapeHtml(activeMerc.roleLabel || activeMerc.roleKey || 'Mercenary')} · Level ${Math.max(1, Math.floor(Number(activeMerc.level) || 1))}</span><small>Auxiliary follower · no party slot · ${activeMerc.alive === false ? 'downed' : 'ready'}</small></div><button data-npc-action="dismiss-merc">Dismiss</button></div>` : '';
        const cards = roster.map(contract => {
          const canAfford = gold >= contract.cost;
          const disabled = activeMerc || !canAfford;
          const partyText = 'auxiliary follower; no party slot';
          const buttonText = !canAfford ? 'Need Gold' : (activeMerc ? 'Already Hired' : 'Hire');
          return `<div class="mercHireCard ${disabled ? 'mercHireDisabled' : ''}"><div class="mercHireIcon">${escapeHtml(this.mercRoleIcon?.({ roleKey: contract.roleKey }) || '◆')}</div><div class="mercHireInfo"><strong>${escapeHtml(contract.name)} · ${escapeHtml(contract.roleLabel)}</strong><span>${escapeHtml(contract.className)} · Level ${contract.level} · ${escapeHtml(contract.archetype)}</span><small>${contract.cost}g · ${escapeHtml(partyText)}</small></div><button data-npc-action="hire-merc:${escapeHtml(contract.roleKey)}" ${disabled ? 'disabled' : ''}>${escapeHtml(buttonText)}</button></div>`;
        }).join('');
        return `<div class="mercHiringPanel"><div class="mercHiringIntro">${escapeHtml(intro)}</div><div class="mercHiringMeta"><span>Gold: ${gold}g</span><span>Party slots: ${partyCount}/${partyMax}</span><span>Mercenaries and pets are auxiliary followers.</span></div>${activeCard}<div class="sheetPanelTitle">Available Mercenaries</div><div class="mercHiringGrid">${cards}</div></div>`;
      };

      Game.prototype.hireMerc = function(roleKey, options = {}) {
        if (!this.started) return false;
        if (this.merc) return this.log('Dismiss your current mercenary first.');
        const role = MERC_ROLES[roleKey];
        if (!role) return this.log('Unknown mercenary contract.');
        const contract = options.contract || this.getMercHiringContract?.(roleKey) || null;
        // V0.18.99: mercenary contracts are authored on the SILVER scale and paid from the real
        // currency (copper), not the flat gold abstraction.
        const cost = Math.max(1, Math.floor(Number(contract?.cost ?? role.cost) || 0));
        const costCopper = this.silverToCopper ? this.silverToCopper(cost) : cost * 100;
        const costText = this.formatCopper ? this.formatCopper(costCopper) : `${cost}s`;
        if (this.spendCopper ? !this.spendCopper(costCopper) : this.player.gold < cost) return this.log(`Need ${costText} to hire ${role.label}.`);
        if (!this.spendCopper) this.player.gold -= cost;

        this.merc = new Mercenary(roleKey, this.player.x + 1.2, this.player.y + 1.2, this.player);
        if (contract?.name) this.merc.displayBaseName = String(contract.name).slice(0, 24);
        this.merc.contractClassName = contract?.className || this.mercContractClassName?.(roleKey, role) || null;
        this.merc.hireCost = cost;
        this.merc.level = Math.max(1, Math.floor(Number(contract?.level) || this.player.level || 1));
        this.assignMercRandomName?.(this.merc);
        this.merc.recalculateFromLevel?.();
        this.merc.hp = this.merc.maxHp;
        this.merc.mana = this.merc.maxMana;
        this.merc.zone = this.currentZone || this.player.zone || 'overworld';
        this.entities.push(this.merc);
        this.merc.command = 'assist';
        this.merc.commandState = 'assist';
        this.merc.reviveTimer = 0;
        this.playAudioEvent?.('merc_hire', { actor: this.merc });

        this.ensureLocalParty?.();
        this.partyMercIncluded = true;
        this.rememberPartyMemberOrder?.('merc');
        this.logParty?.(`${this.merc.name} joined as an auxiliary follower. Mercenaries do not consume party slots.`);
        this.log(`${this.merc.name} hired for ${cost}g.`);
        this.characterSaveDirty = true;
        this.partyPanelDirty = true;
        this.markMercUiDirty?.();
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
        this.updateUI?.();
        return true;
      };

      Game.prototype.handleMercCommandAction = function(action) {
        const value = String(action || '').toLowerCase();
        if (value === 'dismiss') return this.dismissMerc?.();
        if (value === 'gear' || value === 'stats') return this.toggleMercGearWindow?.();
        if (value === 'revive' || value === 'recover') return this.reviveMercenary?.(this.merc, { reason: 'manual' });
        return this.setMercCommand?.(value);
      };

      Game.prototype.setMercCommand = function(command) {
        if (!this.merc) return this.log('No active mercenary.');
        // "Rest" is a Meditation-phase alias for the pre-existing 'meditate'
        // command (same single command owner, no second command system).
        // "Stand" is its own distinct command - it stops meditation and
        // holds position without resuming auto-rest or following.
        const normalized = command === 'rest' ? 'meditate' : command;
        const allowed = new Set(['follow', 'assist', 'guard', 'passive', 'attack', 'meditate', 'stand']);
        if (!allowed.has(normalized)) return;
        if (!this.merc.alive) {
          this.log(`${this.merc.name} is downed and cannot follow commands until revived.`);
          this.playAudioEvent?.('ui_error', { volume: 0.18 });
          return;
        }
        this.merc.command = normalized;
        this.merc.commandState = normalized;
        if (normalized !== 'meditate') this.cancelMeditation?.(this.merc, 'command changed', { silent: true });
        if (normalized === 'meditate') this.merc.commandState = 'waiting-to-meditate';
        if (normalized === 'stand') this.merc.commandState = 'standing';
        this.playAudioEvent?.('merc_command', { actor: this.merc, volume: normalized === 'meditate' ? 0.22 : 0.27 });
        this.log(`${this.merc.name} command: ${normalized}.`);
        this.characterSaveDirty = true;
        this.partyPanelDirty = true;
        this.markMercUiDirty?.({ gear: false });
        this.updateUI?.();
      };



      Game.prototype.describeMercCommandState = function(merc = this.merc) {
        if (!merc) return 'No active mercenary';
        if (!merc.alive) {
          const seconds = Math.max(0, Math.ceil(Number(merc.reviveTimer || 0)));
          return seconds > 0 ? `Downed · revive in ${seconds}s` : 'Downed · awaiting safe revive';
        }
        if (merc.meditating) return merc.command === 'meditate' ? 'Meditating to full' : 'Resting to full';
        const command = String(merc.command || 'assist');
        const state = String(merc.commandState || command).replace(/-/g, ' ');
        const action = merc.lastRoleAction ? ` · ${merc.lastRoleAction}` : '';
        return `${command} · ${state}${action}`;
      };

      Game.prototype.mercRoleIcon = function(merc = this.merc) {
        const key = String(merc?.roleKey || '').toLowerCase();
        return ({ guardian: '🛡', cleric: '✚', adept: '✦', scout: '🗡' })[key] || '◆';
      };

      Game.prototype.mercRoleArchetype = function(merc = this.merc) {
        const key = String(merc?.roleKey || '').toLowerCase();
        return ({ guardian: 'Tank', cleric: 'Healer', adept: 'Ranged DPS', scout: 'Melee DPS' })[key] || 'Mercenary';
      };

      Game.prototype.mercProgressionSummary = function(merc = this.merc) {
        if (!merc) return { level: 0, xp: 0, nextXp: 0, pct: 0 };
        const xp = Math.max(0, Math.floor(Number(merc.xp) || 0));
        const nextXp = Math.max(1, Math.floor(Number(merc.nextXp) || 1));
        return { level: Math.max(1, Math.floor(Number(merc.level) || 1)), xp, nextXp, pct: Math.max(0, Math.min(100, Math.round((xp / nextXp) * 100))) };
      };

      Game.prototype.mercStateBadgeClass = function(merc = this.merc) {
        if (!merc) return '';
        if (!merc.alive) return 'downed';
        if (merc.meditating || String(merc.commandState || '').includes('rest')) return 'recovering';
        return '';
      };

      Game.prototype.mercStatsSnapshot = function(merc = this.merc) {
        if (!merc) return [];
        return [
          ['ATK', Math.floor(Number(merc.getStat?.('attack') ?? merc.attack) || 0)],
          ['DEF', Math.floor(Number(merc.getStat?.('defense') ?? merc.defense) || 0)],
          ['RNG', Number(merc.getStat?.('range') || merc.range || merc.behavior?.().combatRange || 1).toFixed(1)],
          ['SPD', Number(merc.getStat?.('speed') ?? merc.speed ?? 0).toFixed(1)],
          ['GEAR', Math.floor(Number(this.mercGearScore?.(merc) || 0))]
        ];
      };

      Game.prototype.mercEquipmentSlots = function() {
        return ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'trinket'];
      };

      Game.prototype.mercEquipmentSlotLabels = function() {
        return {
          mainHand: 'Main Hand', offHand: 'Off Hand', head: 'Head', chest: 'Chest',
          legs: 'Legs', feet: 'Feet', trinket: 'Trinket'
        };
      };

      Game.prototype.mercAllowedClassPool = function(merc = this.merc) {
        const key = String(merc?.roleKey || '').toLowerCase();
        if (key === 'guardian') return ['Paladin', 'Warden'];
        if (key === 'cleric') return ['Cleric', 'Druid'];
        if (key === 'adept') return ['Wizard', 'Shaman', 'Summoner', 'Enchanter', 'Necromancer'];
        if (key === 'scout') return ['Ranger', 'Assassin', 'Rogue', 'Bard', 'Fighter'];
        return Object.keys(DR.CLASSES || {});
      };

      Game.prototype.mercSlotForItem = function(item) {
        const slot = String(item?.slot || '').toLowerCase();
        const type = String(item?.type || item?.kind || '').toLowerCase();
        if (slot === 'weapon' || slot === 'mainhand' || type === 'weapon') return 'mainHand';
        if (slot === 'offhand' || slot === 'shield' || slot === 'focus') return 'offHand';
        if (slot === 'head' || slot === 'helm') return 'head';
        if (slot === 'chest' || slot === 'body' || slot === 'armor') return 'chest';
        if (slot === 'legs' || slot === 'pants') return 'legs';
        if (slot === 'feet' || slot === 'boots') return 'feet';
        if (['amulet', 'ring1', 'ring2', 'earring1', 'earring2', 'charm', 'trinket', 'cape', 'hands', 'shoulders'].includes(slot) || type === 'accessory') return 'trinket';
        return null;
      };

      Game.prototype.mercGearStats = function(item) {
        const stats = { ...(item?.stats || {}) };
        const direct = ['hp', 'mana', 'attack', 'defense', 'armor', 'speed', 'range', 'healingPower', 'spellPower', 'physicalPower'];
        for (const key of direct) {
          if (item?.[key] != null && stats[key] == null) stats[key] = Number(item[key]) || 0;
        }
        if (item?.armor && !stats.armor) stats.armor = Number(item.armor) || 0;
        return stats;
      };

      Game.prototype.mercGearStatText = function(item) {
        if (!item) return 'Empty';
        const labels = { hp: 'HP', mana: 'Mana', attack: 'ATK', defense: 'DEF', armor: 'ARM', speed: 'SPD', range: 'RNG', healingPower: 'Heal', spellPower: 'Spell', physicalPower: 'Power' };
        const stats = this.mercGearStats?.(item) || {};
        const parts = [];
        for (const key of ['attack', 'defense', 'armor', 'hp', 'mana', 'speed', 'range', 'healingPower', 'spellPower', 'physicalPower']) {
          const value = Number(stats[key] || 0);
          if (!value) continue;
          const amount = key === 'speed' || key === 'range' ? value.toFixed(2) : Math.round(value);
          parts.push(`${labels[key] || key} ${value > 0 ? '+' : ''}${amount}`);
        }
        return parts.join(' · ') || 'No combat stats';
      };

      Game.prototype.mercGearScore = function(merc = this.merc) {
        if (!merc) return 0;
        let score = 0;
        for (const item of Object.values(merc.equipment || {})) {
          if (!item) continue;
          const s = this.mercGearStats?.(item) || {};
          score += Number(s.attack || 0) * 2.5;
          score += (Number(s.defense || 0) + Number(s.armor || 0)) * 2.2;
          score += Number(s.hp || 0) * 0.18;
          score += Number(s.mana || 0) * 0.14;
          score += Number(s.speed || 0) * 16;
          score += Number(s.range || 0) * 8;
          score += Number(s.healingPower || 0) * 1.6;
          score += Number(s.spellPower || 0) * 1.7;
          score += Number(s.physicalPower || 0) * 1.7;
        }
        return Math.max(0, Math.round(score));
      };

      Game.prototype.canMercEquipItem = function(item, merc = this.merc) {
        if (!item || !merc || merc.kind !== 'merc') return { ok: false, reason: 'No mercenary.' };
        if (this.isBagItem?.(item)) return { ok: false, reason: 'Bags cannot be assigned to mercs.' };
        if (this.isConsumableItem?.(item)) return { ok: false, reason: 'Consumables cannot be assigned to mercs.' };
        if (this.isMaterialItem?.(item)) return { ok: false, reason: 'Materials cannot be assigned to mercs.' };
        const mercSlot = this.mercSlotForItem?.(item);
        if (!mercSlot || !this.mercEquipmentSlots?.().includes(mercSlot)) return { ok: false, reason: 'No compatible merc gear slot.' };
        const reqLevel = Math.max(1, Math.floor(Number(item.levelRequirement || item.level || item.sourceLevel || 1) || 1));
        if (reqLevel > Math.max(1, merc.level || 1)) return { ok: false, reason: `Requires merc level ${reqLevel}.` };
        const allowedClasses = Array.isArray(item.classes) ? item.classes : (Array.isArray(item.classRestrictions) ? item.classRestrictions : Object.keys(DR.CLASSES || {}));
        const classPool = this.mercAllowedClassPool?.(merc) || [];
        const allClassCount = Object.keys(DR.CLASSES || {}).length;
        const classOpen = !allowedClasses.length || allowedClasses.length >= allClassCount || allowedClasses.some(name => classPool.includes(name));
        if (!classOpen) return { ok: false, reason: `${merc.roleLabel || merc.name} cannot use that class gear.` };
        const name = String(item.name || '').toLowerCase();
        const role = String(merc.roleKey || '').toLowerCase();
        if (mercSlot === 'offHand' && role === 'scout' && name.includes('shield')) return { ok: false, reason: 'Blade Scouts use light offhands, not shields.' };
        if (mercSlot === 'mainHand' && role === 'guardian' && (name.includes('wand') || name.includes('staff') || name.includes('scepter'))) return { ok: false, reason: 'Guardians need martial weapons.' };
        if (mercSlot === 'mainHand' && role === 'adept' && (name.includes('greatsword') || name.includes('axe'))) return { ok: false, reason: 'Arcane Adepts need caster weapons.' };
        return { ok: true, slot: mercSlot, reason: 'Compatible.' };
      };

      Game.prototype.compatibleMercInventoryItems = function(merc = this.merc) {
        return (this.inventory || []).map((item, index) => ({ item, index, result: this.canMercEquipItem?.(item, merc) || { ok: false } })).filter(entry => entry.item && entry.result.ok);
      };

      Game.prototype.equipMercInventoryItem = function(index, merc = this.merc) {
        if (!merc || !merc.alive) return this.log('No active mercenary.');
        const item = this.inventory?.[index];
        const result = this.canMercEquipItem?.(item, merc);
        if (!result?.ok) return this.log(result?.reason || 'That item cannot be assigned to this mercenary.');
        merc.equipment = merc.equipment || {};
        const old = merc.equipment[result.slot] || null;
        merc.equipment[result.slot] = item;
        this.inventory.splice(index, 1);
        if (old) this.inventory.push(old);
        merc.recalculateFromLevel?.();
        merc.hp = Math.min(merc.maxHp, Math.max(1, merc.hp || 1));
        merc.mana = Math.min(merc.maxMana || 0, Math.max(0, merc.mana || 0));
        this.characterSaveDirty = true;
        this.bagDirty = true;
        this.partyPanelDirty = true;
        this.markMercUiDirty?.({ commands: false });
        this.playAudioEvent?.('item_equip', { actor: merc, volume: 0.33 });
        this.spawnStatusPulse?.(merc, '#c2ec9e', 'Gear');
        this.log(`${merc.name} equipped ${item.name}.`);
        this.renderBag?.();
        this.renderMercGearWindow?.();
        this.updateUI?.();
        return true;
      };

      Game.prototype.unequipMercSlot = function(slot, merc = this.merc) {
        if (!merc || !merc.equipment) return false;
        const key = String(slot || '');
        if (!this.mercEquipmentSlots?.().includes(key)) return false;
        const item = merc.equipment[key];
        if (!item) return false;
        if ((this.inventory || []).length >= (this.getBagCapacity?.() || 0)) return this.log('Bags are full. Cannot remove merc gear.');
        merc.equipment[key] = null;
        this.inventory.push(item);
        merc.recalculateFromLevel?.();
        merc.hp = Math.min(merc.maxHp, Math.max(1, merc.hp || 1));
        merc.mana = Math.min(merc.maxMana || 0, Math.max(0, merc.mana || 0));
        this.characterSaveDirty = true;
        this.bagDirty = true;
        this.partyPanelDirty = true;
        this.markMercUiDirty?.({ commands: false });
        this.playAudioEvent?.('item_equip', { actor: merc, volume: 0.24, rate: 0.86 });
        this.log(`Removed ${item.name} from ${merc.name}.`);
        this.renderBag?.();
        this.renderMercGearWindow?.();
        this.updateUI?.();
        return true;
      };

      Game.prototype.serializeMercenaryState = function(merc = this.merc) {
        if (!merc || merc.kind !== 'merc') return null;
        return {
          version: 2,
          active: true,
          roleKey: merc.roleKey,
          name: merc.name,
          displayBaseName: merc.displayBaseName || String(merc.name || '').split(' - ')[0] || '',
          level: Math.max(1, Math.floor(Number(merc.level) || 1)),
          xp: Math.max(0, Math.floor(Number(merc.xp) || 0)),
          nextXp: Math.max(1, Math.floor(Number(merc.nextXp) || 85)),
          hp: Math.max(0, Math.floor(Number(merc.hp) || 0)),
          mana: Math.max(0, Math.floor(Number(merc.mana) || 0)),
          alive: merc.alive !== false,
          x: Number.isFinite(Number(merc.x)) ? Number(merc.x) : null,
          y: Number.isFinite(Number(merc.y)) ? Number(merc.y) : null,
          zone: merc.zone || this.currentZone || this.player?.zone || 'overworld',
          command: merc.command || 'assist',
          commandState: merc.commandState || merc.command || 'assist',
          reviveTimer: Math.max(0, Number(merc.reviveTimer || 0)),
          equipment: merc.equipment || null,
          inventory: merc.inventory || []
        };
      };

      Game.prototype.restoreMercenaryState = function(state) {
        if (!state || !state.active || !this.player || !MERC_ROLES?.[state.roleKey]) return false;
        if (this.merc) this.entities = this.entities.filter(entity => entity !== this.merc);
        const sx = Number.isFinite(Number(state.x)) ? Number(state.x) : this.player.x + 1.1;
        const sy = Number.isFinite(Number(state.y)) ? Number(state.y) : this.player.y + 0.85;
        const merc = new Mercenary(state.roleKey, sx, sy, this.player);
        merc.zone = state.zone || this.currentZone || this.player.zone || 'overworld';
        merc.displayBaseName = String(state.displayBaseName || state.name || merc.name).split(' - ')[0].slice(0, 22);
        merc.level = Math.max(1, Math.floor(Number(state.level) || this.player.level || 1));
        merc.xp = Math.max(0, Math.floor(Number(state.xp) || 0));
        merc.nextXp = Math.max(1, Math.floor(Number(state.nextXp) || 85));
        if (state.equipment && typeof state.equipment === 'object' && !Array.isArray(state.equipment)) merc.equipment = state.equipment;
        merc.inventory = Array.isArray(state.inventory) ? state.inventory.filter(Boolean) : [];
        merc.name = this.formatMercDisplayName?.(merc) || String(state.name || merc.name).slice(0, 48);
        merc.recalculateFromLevel?.();
        merc.hp = Math.max(0, Math.min(merc.maxHp, Math.floor(Number(state.hp) || merc.maxHp)));
        merc.mana = Math.max(0, Math.min(merc.maxMana || 0, Math.floor(Number(state.mana) || merc.maxMana || 0)));
        merc.alive = state.alive !== false;
        merc.command = String(state.command || 'assist');
        merc.commandState = String(state.commandState || merc.command || 'assist');
        merc.reviveTimer = Math.max(0, Number(state.reviveTimer || 0));
        if (!merc.alive) {
          merc.hp = 0;
          merc.commandState = 'downed';
          merc.reviveTimer = Math.max(merc.reviveTimer, 3.5);
        }
        this.merc = merc;
        if (!Array.isArray(this.entities)) this.entities = [];
        if (!this.entities.includes(merc)) this.entities.push(merc);
        this.syncPartyCompanionsToPlayerZone?.({ zone: this.currentZone || merc.zone || 'overworld', snap: false, reason: 'merc-restore' });
        this.partyPanelDirty = true;
        this.updateUI?.();
        return true;
      };

      Game.prototype.reviveMercenary = function(merc = this.merc, options = {}) {
        if (!merc || merc.kind !== 'merc') return false;
        if (merc.alive) return true;
        if (!this.player || !this.player.alive) return false;
        merc.alive = true;
        merc.deadTimer = 0;
        merc.reviveTimer = 0;
        merc.recalculateFromLevel?.();
        merc.hp = Math.max(1, Math.floor(Number(merc.maxHp || 1)));
        merc.mana = Math.max(0, Math.floor((merc.maxMana || 0) * 0.42));
        merc.x = this.player.x + 1.15;
        merc.y = this.player.y + 0.85;
        merc.combatCooldown = 0;
        merc.attackTimer = this.getAutoAttackIntervalSeconds?.(merc, { source: 'mercenary-revive-auto-reset' }) || 2.5;
        merc.healTimer = 1.6;
        merc.command = merc.command === 'passive' ? 'passive' : 'assist';
        merc.commandState = 'revived';
        merc.meditating = false;
        merc.moveBlend = 0;
        merc.vx = 0;
        merc.vy = 0;
        this.spawnRing?.(merc.x, merc.y, '#c2ec9e', 20);
        this.spawnStatusPulse?.(merc, '#c2ec9e', 'Revived');
        this.playAudioEvent?.('merc_command', { actor: merc, volume: 0.34, cooldown: 0.2 });
        if (!options.silent) this.logCombat?.(`${merc.name} recovers and rejoins you.`);
        this.partyPanelDirty = true;
        this.markMercUiDirty?.();
        this.updateUI?.();
        return true;
      };

      Game.prototype.markMercenaryDowned = function(merc = this.merc) {
        if (!merc || merc.kind !== 'merc') return false;
        merc.alive = false;
        merc.hp = 0;
        merc.meditating = false;
        merc.commandState = 'downed';
        merc.reviveTimer = Math.max(6.5, Number(merc.reviveDelay || 9.5));
        merc.combatCooldown = 0;
        merc.attackTimer = 0;
        merc.vx = 0;
        merc.vy = 0;
        this.spawnCorpseBurst?.(merc.x, merc.y);
        this.spawnRing?.(merc.x, merc.y, '#c2ec9e', 16);
        this.playSfx?.('enemy_die', { x: merc.x, y: merc.y, volume: 0.28, rate: 0.78, cooldown: 0.1 });
        this.logCombat?.(`${merc.name} is downed. They will recover when combat ends.`);
        this.partyPanelDirty = true;
        this.markMercUiDirty?.();
        return true;
      };

      Game.prototype.dismissMerc = function(options = {}) {
        if (!this.merc) return this.log('No active mercenary.');
        const dismissed = this.merc;
        this.log(`${this.merc.name} contract ended.`);
        this.entities = this.entities.filter(e => e !== this.merc);
        this.merc = null;
        this.mercGearOpen = false;
        this.partyMercIncluded = false;
        this.forgetPartyMemberOrder?.('merc');
        if (this.player?.targetId === dismissed.id) this.player.targetId = null;
        this.characterSaveDirty = true;
        this.partyPanelDirty = true;
        this.markMercUiDirty?.();
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
        this.updateUI?.();
        return true;
      };

      Game.prototype.awardMercXp = function(amount, defeatedEnemy = null) {
        if (!this.merc || !this.merc.alive) return;
        const xp = Math.max(0, Math.floor(Number(amount) || 0));
        if (xp <= 0) return;
        this.merc.xp = Math.max(0, Math.floor(Number(this.merc.xp) || 0)) + xp;
        this.merc.nextXp = Math.max(60, Math.floor(Number(this.merc.nextXp) || 85));
        this.merc.totalXpEarned = Math.max(0, Math.floor(Number(this.merc.totalXpEarned) || 0)) + xp;
        this.merc.lastXpGain = xp;
        this.merc.lastXpSource = defeatedEnemy?.name || '';
        this.merc.lastXpAt = performance.now();
        let levels = 0;
        while (this.merc.xp >= this.merc.nextXp) {
          this.merc.xp -= this.merc.nextXp;
          this.merc.level += 1;
          this.merc.nextXp = Math.floor(this.merc.nextXp * 1.32 + 35);
          this.merc.recalculateFromLevel?.();
          this.merc.name = this.formatMercDisplayName?.(this.merc) || this.merc.name;
          this.merc.hp = this.merc.maxHp;
          this.merc.mana = this.merc.maxMana;
          levels += 1;
        }
        if (levels > 0) {
          this.merc.levelUpPulse = 1;
          this.spawnRing?.(this.merc.x, this.merc.y, '#c2ec9e', 24 + levels * 3);
          this.spawnStatusPulse?.(this.merc, '#c2ec9e', `Level ${this.merc.level}`);
          this.playAudioEvent?.('level_up', { actor: this.merc, volume: 0.34, cooldown: 0.2 });
          this.logCombat?.(`${this.merc.name} reached level ${this.merc.level}.`);
        }
        this.characterSaveDirty = true;
        this.partyPanelDirty = true;
        this.markMercUiDirty?.({ gear: levels > 0, commands: false });
        this.updateUI?.();
      };

      Game.prototype.toggleMercGearWindow = function() {
        if (!this.merc || !this.merc.alive) return this.log('No active mercenary.');
        this.mercGearOpen = !this.mercGearOpen;
        this.mercGearDirty = true;
        this.renderMercGearWindow?.({ force: true });
        this.updateUI?.();
      };

      Game.prototype.renderMercGearWindow = function(options = {}) {
        const panel = document.getElementById('mercGearWindow');
        if (!panel) return;
        if (!this.merc || !this.merc.alive || !this.mercGearOpen) {
          panel.style.display = 'none';
          panel.dataset.mercGearSignature = '';
          this.mercGearDirty = false;
          return;
        }
        const merc = this.merc;
        const slots = this.mercEquipmentSlots?.() || ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet', 'trinket'];
        const labels = this.mercEquipmentSlotLabels?.() || {};
        const compatible = this.compatibleMercInventoryItems?.(merc) || [];
        const roleIcon = this.mercRoleIcon?.(merc) || '◆';
        const roleName = this.mercRoleArchetype?.(merc) || merc.roleLabel || 'Mercenary';
        const score = this.mercGearScore?.(merc) || 0;
        const signature = JSON.stringify({
          merc: merc.id || merc.name || '',
          role: merc.roleKey || merc.roleLabel || '',
          level: Math.floor(merc.level || 1),
          score,
          stats: [merc.maxHp || 0, merc.maxMana || 0, merc.attack || 0, merc.defense || 0],
          equipment: slots.map(slot => {
            const item = merc.equipment?.[slot];
            return item ? [slot, item.id || item.name || '', item.rarity?.id || item.rarity?.name || item.rarity || '', item.levelRequirement || item.level || 1].join(':') : `${slot}:empty`;
          }),
          compatible: compatible.map(entry => {
            const item = entry.item;
            return [entry.index, item?.id || item?.name || '', item?.rarity?.id || item?.rarity?.name || item?.rarity || '', item?.levelRequirement || item?.level || 1].join(':');
          })
        });
        if (!options.force && !this.mercGearDirty && panel.dataset.mercGearSignature === signature) {
          panel.style.display = 'block';
          return;
        }
        const slotCard = slot => {
          const item = merc.equipment?.[slot] || null;
          const color = item?.rarity?.color || item?.color || '#c2ec9e';
          const statText = this.mercGearStatText?.(item) || 'Empty';
          const icon = item ? (this.itemIconHtml?.(item, 'mercGearIcon generatedIcon') || `<div class="mercGearIcon generatedIcon">${escapeHtml(item.icon?.glyph || '◆')}</div>`) : '<div class="mercGearIcon empty">+</div>';
          return `<div class="mercGearSlot itemSlot" data-item-tooltip="1" data-merc-slot="${escapeHtml(slot)}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}">
            <div class="mercGearSlotHead"><span>${escapeHtml(labels[slot] || slot)}</span>${item ? `<button data-merc-unequip="${escapeHtml(slot)}">Remove</button>` : ''}</div>
            <div class="mercGearItemLine">${icon}<div>${item ? `<strong>${escapeHtml(item.name)}</strong><span class="small">${escapeHtml(statText)}</span>` : '<strong>Empty</strong><span class="small">Equip compatible bag gear below.</span>'}</div></div>
          </div>`;
        };
        const inventoryCard = entry => {
          const item = entry.item;
          const slot = entry.result.slot;
          const color = item?.rarity?.color || item?.color || '#cfdac8';
          const statText = this.mercGearStatText?.(item) || 'No combat stats';
          const icon = this.itemIconHtml?.(item, 'mercGearIcon generatedIcon') || `<div class="mercGearIcon generatedIcon">${escapeHtml(item.icon?.glyph || '◆')}</div>`;
          return `<button class="mercInventoryItem itemSlot" data-item-tooltip="1" data-merc-equip-index="${entry.index}" style="--rarity-color:${escapeHtml(color)};--icon-color:${escapeHtml(color)}">
            ${icon}<span><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(labels[slot] || slot)} · ${escapeHtml(statText)}</em></span>
          </button>`;
        };
        panel.innerHTML = `
          <div class="title-row">
            <div>
              <div class="name">${escapeHtml(merc.name)} Gear</div>
              <div class="small">${escapeHtml(roleIcon)} ${escapeHtml(roleName)} · Level ${Math.floor(merc.level || 1)} · Gear Score ${score}</div>
            </div>
            <button id="closeMercGearBtn">Close</button>
          </div>
          <div class="mercGearSummary">
            <span>ATK ${Math.floor(Number(merc.getStat?.('attack') ?? merc.attack) || 0)}</span>
            <span>DEF ${Math.floor(Number(merc.getStat?.('defense') ?? merc.defense) || 0)}</span>
            <span>HP ${Math.ceil(merc.maxHp || 0)}</span>
            <span>Mana ${Math.ceil(merc.maxMana || 0)}</span>
          </div>
          <div class="mercGearGrid">${slots.map(slotCard).join('')}</div>
          <div class="mercInventorySection">
            <div class="sheetPanelTitle">Compatible Bag Gear</div>
            ${compatible.length ? `<div class="mercInventoryList">${compatible.map(inventoryCard).join('')}</div>` : '<div class="small emptyMercGearList">No compatible equipment in bags. Loot or craft gear, then open this window again.</div>'}
          </div>
        `;
        panel.style.display = 'block';
        panel.dataset.mercGearSignature = signature;
        this.mercGearDirty = false;
        panel.querySelector('#closeMercGearBtn')?.addEventListener('click', () => {
          this.mercGearOpen = false;
          this.mercGearDirty = true;
          this.renderMercGearWindow({ force: true });
          this.updateUI?.();
        });
        panel.querySelectorAll('[data-merc-equip-index]').forEach(btn => btn.addEventListener('click', () => this.equipMercInventoryItem?.(Number(btn.dataset.mercEquipIndex))));
        panel.querySelectorAll('[data-merc-unequip]').forEach(btn => btn.addEventListener('click', () => this.unequipMercSlot?.(btn.dataset.mercUnequip)));
        this.bindItemTooltips?.(panel, node => {
          const equipIndex = node.closest?.('[data-merc-equip-index]')?.dataset?.mercEquipIndex;
          if (equipIndex != null) return this.inventory?.[Number(equipIndex)] || null;
          const slot = node.closest?.('[data-merc-slot]')?.dataset?.mercSlot;
          return slot ? merc.equipment?.[slot] || null : null;
        });
      };
    }
  };
})();
