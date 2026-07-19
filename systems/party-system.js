// Dream Realms party runtime system
// V0.13.4 owner: local party roster, companion zone transitions, bot/merc-party inclusion, combat integration helpers, role-aware companion positioning, reward sharing, invites, party HUD, and party panel rendering.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const BotRoles = DR.BotRoles || {};
  const { clamp, dist } = DR.utils;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const PARTY_INVITE_RADIUS = 18;
  const PARTY_CONTEXT_PICK_RADIUS = 1.85;
  const PARTY_XP_RADIUS = 24;
  const PARTY_HEAL_RADIUS = 16;
  const PARTY_ASSIST_HINT_MS = 5200;
  const PARTY_MAX_SIZE = Math.max(2, Math.floor(Number(DR.MAX_PARTY_SIZE) || 6));

  function safePct(current, max) {
    const cap = Math.max(0, Number(max) || 0);
    if (cap <= 0) return 0;
    return clamp((Number(current) || 0) / cap, 0, 1) * 100;
  }

  function rounded(value) {
    return Math.max(0, Math.ceil(Number(value) || 0));
  }

  function partyHealthTextMarkup(label, value) {
    const clean = String(label ?? '').trim().replace(/:+$/, '') || 'Value';
    return `<span class="partyHealthLabel">${escapeHtml(`${clean}:`)}</span><span class="partyHealthValue">${escapeHtml(value)}</span>`;
  }

  function actorAlive(actor) {
    return Boolean(actor && actor.alive !== false && Number.isFinite(Number(actor.x)) && Number.isFinite(Number(actor.y)));
  }

  function actorHpRatio(actor) {
    const maxHp = Math.max(1, Number(actor?.maxHp) || 1);
    return clamp((Number(actor?.hp) || 0) / maxHp, 0, 1);
  }

  function actorId(actor, fallback = '') {
    return String(actor?.remoteId || actor?.id || actor?.kind || fallback || 'actor');
  }

  function aliveLabel(member) {
    if (member.alive === false) return 'Downed';
    if (member.meditating) return 'Meditating';
    if (member.commandState) return String(member.commandState).replace(/-/g, ' ');
    if (member.command) return String(member.command).replace(/-/g, ' ');
    return 'Ready';
  }

  DR.PartySystem = {
    install(Game) {
      const ui = DR.ui;

      Game.prototype.normalizePartyState = function() {
        if (!(this.partyMembers instanceof Set)) this.partyMembers = new Set(Array.isArray(this.partyMembers) ? this.partyMembers : []);
        if (!this.localPeerId) this.localPeerId = `dw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        this.partyMembers.add(this.localPeerId);
        if (!this.partyLeaderId) this.partyLeaderId = this.localPeerId;
        if (!(this.partyInvites instanceof Map)) this.partyInvites = new Map();
        const seen = new Set();
        this.partyMemberOrder = (Array.isArray(this.partyMemberOrder) ? this.partyMemberOrder : [])
          .map(String)
          .filter(id => id && id !== String(this.localPeerId) && !seen.has(id) && seen.add(id));
      };

      Game.prototype.ensureLocalParty = function() {
        this.normalizePartyState?.();
        if (!this.partyId) {
          this.partyId = `party-${this.localPeerId}-${Date.now().toString(36)}`;
          this.partyLeaderId = this.localPeerId;
          this.partyMembers = new Set([this.localPeerId]);
        }
        return this.partyId;
      };


      Game.prototype.partyMaxSize = function() {
        return PARTY_MAX_SIZE;
      };

      Game.prototype.rememberPartyMemberOrder = function(id) {
        this.normalizePartyState?.();
        const normalized = String(id || '');
        if (!normalized || normalized === String(this.localPeerId)) return false;
        if (!this.partyMemberOrder.includes(normalized)) this.partyMemberOrder.push(normalized);
        return true;
      };

      Game.prototype.forgetPartyMemberOrder = function(id) {
        const normalized = String(id || '');
        this.partyMemberOrder = (this.partyMemberOrder || []).filter(entry => String(entry) !== normalized);
      };

      Game.prototype.partyMemberConsumesSlot = function(memberOrType) {
        const raw = typeof memberOrType === 'string'
          ? memberOrType
          : (memberOrType?.type || memberOrType?.kind || memberOrType?.entity?.kind || '');
        const type = String(raw || '').toLowerCase();
        // V0.14.62: party capacity is reserved for real player characters and
        // bot party members only. Mercenaries and pets are auxiliary followers;
        // they may appear in party/companion UI, combat helpers, and save state,
        // but never consume an invite/member slot.
        return type !== 'merc' && type !== 'pet';
      };

      Game.prototype.partyCapacityCount = function(options = {}) {
        this.normalizePartyState?.();
        const localId = String(this.localPeerId || 'local');
        const botPartyIds = new Set();
        for (const id of this.botPartyMembers || []) if (id) botPartyIds.add(String(id));
        for (const bot of this.botPlayers || []) {
          const id = String(bot?.botId || bot?.remoteId || bot?.id || '');
          if (id && this.isBotInParty?.(bot)) botPartyIds.add(id);
        }

        let count = 1; // player/local leader always consumes one party slot
        for (const id of this.partyMembers || []) {
          const normalized = String(id || '');
          if (!normalized || normalized === localId) continue;
          if (normalized === 'merc' || normalized === 'pet') continue;
          if (botPartyIds.has(normalized) || normalized.startsWith('bot-')) continue;
          count += 1;
        }
        count += botPartyIds.size;
        if (options.includeCandidate === true) count += Math.max(1, Math.floor(Number(options.candidateCount) || 1));
        return count;
      };

      Game.prototype.partyRemainingSlots = function(options = {}) {
        return Math.max(0, this.partyMaxSize?.() - this.partyCapacityCount?.(options));
      };

      Game.prototype.partyHasRoomFor = function(count = 1) {
        const needed = Math.max(1, Math.floor(Number(count) || 1));
        return (this.partyRemainingSlots?.() || 0) >= needed;
      };

      Game.prototype.partyFullMessage = function(options = {}) {
        const max = this.partyMaxSize?.() || PARTY_MAX_SIZE;
        const count = Math.min(max, this.partyCapacityCount?.() || 1);
        const label = options.label || 'Party';
        return `${label} member slots are full (${count}/${max}). Mercenaries and pets do not consume slots.`;
      };

      Game.prototype.isPartyLeader = function(peerId = this.localPeerId) {
        this.normalizePartyState?.();
        return !this.partyId || this.partyLeaderId === peerId;
      };

      Game.prototype.partyMemberClassLabel = function(member) {
        if (!member) return 'Unknown';
        if (member.type === 'merc' || member.kind === 'merc') return member.roleLabel || member.roleKey || 'Mercenary';
        if (member.type === 'pet' || member.kind === 'pet') return member.roleLabel || member.petType || 'Pet';
        if (member.type === 'bot' || member.kind === 'bot') return member.entity?.botTypeLabel || member.entity?.displayTypeLabel || (member.className ? `${member.className} Bot` : (member.role || 'Bot Player'));
        return member.className || 'Player';
      };

      Game.prototype.partyMemberIcon = function(member) {
        const type = String(member?.type || member?.kind || '').toLowerCase();
        if (type === 'merc') return this.mercRoleIcon?.(member.entity || member) || '◆';
        if (type === 'pet') return '🐾';
        const cls = String(member?.className || '').toLowerCase();
        return ({ fighter: '⚔', druid: '♧', summoner: '✹', cleric: '✚', bard: '♫', rogue: '🗡', enchanter: '✦', necromancer: '☠' })[cls] || '●';
      };

      Game.prototype.partySnapshotForActor = function(actor, options = {}) {
        if (!actor) return null;
        const type = options.type || actor.kind || 'player';
        const id = options.id || actor.remoteId || actor.id || type;
        return {
          id,
          type,
          consumesPartySlot: this.partyMemberConsumesSlot?.(type) !== false,
          entity: actor,
          name: options.name || actor.name || 'Unknown',
          className: options.className || actor.className || actor.roleLabel || actor.roleKey || '',
          roleKey: actor.roleKey || '',
          roleLabel: actor.roleLabel || '',
          level: Math.max(1, Math.floor(Number(actor.level) || 1)),
          hp: rounded(actor.hp),
          maxHp: Math.max(1, rounded(actor.maxHp || actor.hp || 1)),
          mana: rounded(actor.mana),
          maxMana: Math.max(0, rounded(actor.maxMana || 0)),
          alive: actor.alive !== false,
          meditating: Boolean(actor.meditating),
          command: actor.command || '',
          commandState: actor.commandState || actor.botState || '',
          currentActivityLabel: actor.currentActivityLabel || '',
          currentTargetName: actor.currentTargetName || actor.botCurrentTargetName || '',
          lastCastName: actor.botLastCastName || actor.lastCastName || '',
          botState: actor.botState || '',
          xp: Math.max(0, Math.floor(Number(actor.xp || 0))),
          nextXp: Math.max(0, Math.floor(Number(actor.nextXp || 0))),
          gold: Math.max(0, Math.floor(Number(actor.gold || 0))),
          leader: options.leader === true,
          local: options.local === true,
          distance: Number.isFinite(Number(options.distance)) ? Number(options.distance) : null,
          zone: actor.zone || this.currentZone || 'dark_woods'
        };
      };

      Game.prototype.getPartyRoster = function(options = {}) {
        if (!this.player) return [];
        this.normalizePartyState?.();
        const botRosterIds = new Set((this.botPlayers || [])
          .map(bot => String(bot?.botId || bot?.remoteId || bot?.id || ''))
          .filter(Boolean));
        for (const id of this.botPartyMembers || []) botRosterIds.add(String(id));
        const roster = [];
        roster.push(this.partySnapshotForActor(this.player, {
          id: this.localPeerId,
          type: 'player',
          local: true,
          leader: this.partyLeaderId === this.localPeerId,
          name: `${this.player.name || 'You'}${options.panel ? ' (You)' : ''}`
        }));

        if (this.partyMercIncluded && this.merc) {
          roster.push(this.partySnapshotForActor(this.merc, {
            id: 'merc',
            type: 'merc',
            leader: false,
            name: `${this.merc.name || 'Mercenary'}${options.panel ? ' (Merc)' : ''}`
          }));
        }

        if (options.includePet && this.pet) {
          roster.push(this.partySnapshotForActor(this.pet, { id: 'pet', type: 'pet', name: this.pet.name || 'Pet' }));
        }

        for (const bot of this.botPlayers || []) {
          if (this.isBotInParty?.(bot)) {
            const botId = bot.botId || bot.remoteId;
            roster.push(this.partySnapshotForActor(bot, {
              id: botId,
              type: 'bot',
              leader: String(this.partyLeaderId || '') === String(botId),
              name: `${bot.name || 'Bot'}`
            }));
          }
        }

        for (const id of this.partyMembers || []) {
          const normalizedId = String(id);
          if (normalizedId === this.localPeerId) continue;
          if (botRosterIds.has(normalizedId) || normalizedId.startsWith('bot-')) continue;
          const peer = this.remotePlayers?.get(normalizedId);
          if (peer) {
            roster.push(this.partySnapshotForActor(peer, {
              id,
              type: 'player',
              leader: this.partyLeaderId === id,
              distance: this.player ? dist(peer, this.player) : null
            }));
          } else if (this.partyId) {
            roster.push({
              id,
              type: 'player',
              name: `Player ${String(id).slice(-5)}`,
              className: 'Offline',
              level: 1,
              hp: 0,
              maxHp: 1,
              mana: 0,
              maxMana: 0,
              alive: false,
              meditating: false,
              command: '',
              commandState: 'offline',
              leader: this.partyLeaderId === id,
              local: false,
              distance: null,
              zone: this.currentZone || 'dark_woods'
            });
          }
        }

        const valid = roster.filter(Boolean);
        const local = valid.find(member => member.local || String(member.id) === String(this.localPeerId)) || valid[0];
        const order = new Map((this.partyMemberOrder || []).map((id, index) => [String(id), index]));
        const companions = valid
          .filter(member => member !== local)
          .sort((a, b) => {
            const ai = order.has(String(a.id)) ? order.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
            const bi = order.has(String(b.id)) ? order.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
            return (ai - bi) || String(a.id).localeCompare(String(b.id));
          });
        return [local, ...companions].filter(Boolean);
      };

      Game.prototype.partyRosterSignature = function(roster = this.getPartyRoster?.() || []) {
        return JSON.stringify(roster.map(member => [
          member.id, member.type, member.name, member.className || member.roleLabel || member.roleKey || '', member.level,
          member.hp, member.maxHp, member.mana, member.maxMana, member.alive === false ? 0 : 1,
          member.meditating ? 1 : 0, member.command || '', member.commandState || '', member.leader ? 1 : 0
        ]));
      };


      Game.prototype.serializePartyState = function() {
        this.normalizePartyState?.();
        const botIds = new Set();
        for (const bot of this.botPlayers || []) {
          const id = String(bot?.botId || bot?.remoteId || bot?.id || '');
          if (id && this.isBotInParty?.(bot)) botIds.add(id);
        }
        for (const id of this.botPartyMembers || []) if (id) botIds.add(String(id));
        const localId = String(this.localPeerId || 'local');
        const remoteMemberIds = Array.from(this.partyMembers || [])
          .map(String)
          .filter(id => id && id !== localId && !botIds.has(id) && !id.startsWith('bot-') && id !== 'merc' && id !== 'pet');
        const hasActivePartyRuntime = Boolean(this.partyId || botIds.size || remoteMemberIds.length || this.partyMercIncluded);
        if (!hasActivePartyRuntime) return null;
        return {
          version: 4,
          maxPartySize: PARTY_MAX_SIZE,
          partyId: this.partyId || null,
          partyLeaderId: this.partyLeaderId || this.localPeerId || null,
          partyMercIncluded: Boolean(this.partyMercIncluded),
          partyOrder: (this.getPartyRoster?.() || []).slice(1).map(member => String(member.id)),
          partyMembers: [localId, ...remoteMemberIds].filter(Boolean)
        };
      };

      Game.prototype.restorePartyState = function(state) {
        this.normalizePartyState?.();
        if (!state || typeof state !== 'object') return false;
        this.partyId = state.partyId || null;
        this.partyLeaderId = state.partyLeaderId || this.localPeerId;
        this.partyMercIncluded = Boolean(state.partyMercIncluded && this.merc);
        const savedMembers = Array.isArray(state.partyMembers)
          ? state.partyMembers.filter(Boolean).map(String).filter(id => !id.startsWith('bot-'))
          : [];
        this.partyMembers = new Set([this.localPeerId, ...savedMembers]);
        const savedOrder = Array.isArray(state.partyOrder) ? state.partyOrder.filter(Boolean).map(String) : [];
        const validBotIds = new Set((this.botPlayers || []).map(bot => String(bot?.botId || bot?.remoteId || bot?.id || '')).filter(Boolean));
        for (const id of Array.from(this.botPartyMembers || [])) if (!validBotIds.has(String(id))) this.botPartyMembers.delete(id);
        const auxiliaryIds = this.partyMercIncluded && this.merc ? ['merc'] : [];
        const slotIds = [
          ...Array.from(this.botPartyMembers || []).map(String).filter(id => validBotIds.has(id)),
          ...savedMembers.filter(id => id !== String(this.localPeerId))
        ];
        const activeIds = [...auxiliaryIds, ...slotIds];
        const orderedIds = [...savedOrder, ...activeIds].filter((id, index, list) => activeIds.includes(id) && list.indexOf(id) === index);
        const orderedSlotIds = [...savedOrder, ...slotIds].filter((id, index, list) => slotIds.includes(id) && list.indexOf(id) === index);
        const keepSlotIds = new Set(orderedSlotIds.slice(0, Math.max(0, PARTY_MAX_SIZE - 1)));
        const keepAuxiliaryIds = new Set(auxiliaryIds);
        const keepIds = new Set([...keepAuxiliaryIds, ...keepSlotIds]);
        const removedIds = orderedSlotIds.filter(id => !keepSlotIds.has(id));
        for (const bot of this.botPlayers || []) {
          const id = String(bot?.botId || bot?.remoteId || bot?.id || '');
          if (!id || !this.botPartyMembers?.has?.(id) || keepSlotIds.has(id)) continue;
          this.botPartyMembers.delete(id);
          bot.partyId = null;
          bot.command = 'autonomous';
          bot.botState = bot.alive === false ? 'downed' : 'questing';
          bot.currentActivityLabel = bot.alive === false ? 'Downed' : 'Questing';
          if (this.player?.targetId === bot.id) this.player.targetId = null;
        }
        for (const id of savedMembers) {
          if (id === String(this.localPeerId) || keepSlotIds.has(id)) continue;
          const remote = this.remotePlayers?.get?.(id);
          if (remote && this.player?.targetId === remote.id) this.player.targetId = null;
          this.partyMembers.delete(id);
        }
        this.partyMemberOrder = orderedIds.filter(id => keepIds.has(id));
        if (removedIds.length) this.logParty?.(`Saved party exceeded ${PARTY_MAX_SIZE} player/bot slots. Kept the player and first ${PARTY_MAX_SIZE - 1} valid slot members; ${removedIds.length} extra member${removedIds.length === 1 ? '' : 's'} safely left the active party. Mercenaries remain auxiliary followers.`);
        if (!this.partyId || (this.partyMembers.size <= 1 && !(this.botPartyMembers && this.botPartyMembers.size))) {
          this.partyId = null;
          this.partyLeaderId = this.localPeerId;
          this.partyMembers = new Set([this.localPeerId]);
        }
        this.partyPanelDirty = true;
        this.renderPartyHud?.({ force: true });
        return true;
      };

      Game.prototype.isPartyMemberId = function(id) {
        this.normalizePartyState?.();
        if (!id) return false;
        return this.partyMembers?.has(String(id)) || String(id) === this.localPeerId || (String(id) === 'merc' && this.partyMercIncluded) || this.botPartyMembers?.has?.(String(id));
      };

      Game.prototype.isPartyActor = function(actor) {
        if (!actor) return false;
        if (actor === this.player) return true;
        if (actor === this.merc) return Boolean(this.partyMercIncluded);
        if (actor === this.pet) return true;
        if (actor.kind === 'bot') return this.isBotInParty?.(actor) || false;
        const id = actor.remoteId || actor.id;
        return Boolean(id && this.partyMembers?.has(String(id)));
      };

      Game.prototype.findPartyMemberById = function(memberId) {
        const id = String(memberId || '');
        if (!id) return null;
        const member = (this.getPartyRoster?.() || []).find(entry => String(entry.id) === id);
        return member || null;
      };

      Game.prototype.selectPartyMember = function(memberId) {
        const member = this.findPartyMemberById?.(memberId);
        const actor = member?.entity || null;
        if (!member || !actor || !this.player) return false;
        this.player.targetId = actor.id;
        this.player.autoAttack = false;
        this.player.autoAttackToggle = false;
        this.player.autoAttackAutoEngaged = false;
            this.clearPlayerAutoAttackVisualState?.(this.player);
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.updateUI?.();
        this.renderPartyHud?.({ force: true });
        return true;
      };

      Game.prototype.handlePartyMemberContextAction = function(memberId, action) {
        const member = this.findPartyMemberById?.(memberId);
        const actor = member?.entity || null;
        const command = String(action || '').toLowerCase();
        if (!member || !actor || !['bot', 'merc'].includes(String(member.type))) return false;
        if (command === 'inspect') return member.type === 'bot' ? this.inspectBotPlayer?.(actor) === true : this.toggleMercGearWindow?.() !== false;
        if (command === 'talk' && member.type === 'bot') {
          const line = this.botSocialLineFor?.(actor, this.isEntityInCombat?.(actor) ? 'combatStart' : 'generic') || actor.lastSocialLine || 'Ready.';
          return this.queueBotSpeech?.(actor, line, { eventType: 'talk', priority: 3, force: true }) === true;
        }
        if (command === 'remove') {
          if (this.player?.targetId === actor.id) this.player.targetId = null;
          this.forgetPartyMemberOrder?.(memberId);
          return member.type === 'bot' ? this.removeBotFromParty?.(actor) === true : this.removeMercFromParty?.() !== false;
        }
        return false;
      };


      Game.prototype.companionFormationOffset = function(kind, index = 0) {
        const base = {
          merc: { x: 1.18, y: 0.72 },
          pet: { x: -0.95, y: 0.88 },
          partyBot: { x: -1.35, y: -0.24 },
          remote: { x: 0.95, y: -1.12 }
        }[kind] || { x: 0.75, y: 0.75 };
        const ring = 0.22 + Math.floor(Math.max(0, index) / 4) * 0.24;
        const angle = Math.max(0, index) * 2.39996323;
        return { x: base.x + Math.cos(angle) * ring, y: base.y + Math.sin(angle) * ring };
      };

      Game.prototype.resetCompanionTransitionState = function(actor, zone, reason = 'zone-transition') {
        if (!actor) return actor;
        const previousZone = actor.zone;
        actor.zone = zone;
        actor.target = null;
        actor.attackTarget = null;
        actor.targetEnemy = null;
        actor.combatTarget = null;
        actor.lastTargetId = null;
        actor.vx = 0;
        actor.vy = 0;
        actor.moveBlend = 0;
        actor.roamTarget = null;
        actor.pathTarget = null;
        actor._pathRoute = [];
        actor._pathIndex = 0;
        actor.stuckTimer = 0;
        actor.zoneTransitionReason = reason;
        actor.zoneTransitionGrace = 1.25;
        actor.lastStableX = Number.isFinite(Number(actor.x)) ? Number(actor.x) : 0;
        actor.lastStableY = Number.isFinite(Number(actor.y)) ? Number(actor.y) : 0;
        if (actor.kind === 'bot') {
          actor.squadId = null;
          actor.dungeonIntent = null;
          actor.dungeonRunTimer = 0;
          actor.isInsideSimulatedDungeon = false;
          actor.temporarilyBusy = false;
          actor.objectiveEnemyId = null;
          actor.adventureTargetId = null;
          actor.botState = zone === 'dungeon' ? 'following-dungeon-party' : (zone === 'cave' ? 'following-cave-party' : 'following-party');
          actor.currentActivityLabel = zone === 'dungeon' ? 'In Dungeon Party' : (zone === 'cave' ? 'In Cave Party' : 'Following Party');
          actor.command = 'party';
        }
        if (actor.kind === 'merc') {
          actor.commandState = actor.commandState || actor.command || 'follow';
          actor.currentActivityLabel = zone === 'dungeon' ? 'Following in Dungeon' : (zone === 'cave' ? 'Following in Cave' : 'Following');
        }
        if (actor.kind === 'pet') actor.command = actor.command || 'follow';
        if (actor.kind === 'bot' && previousZone && previousZone !== zone) {
          const eventType = zone === 'dungeon' ? 'enterDungeon' : zone === 'cave' ? 'enterCave' : null;
          if (eventType) this.maybeQueuePartyBanter?.(eventType, { priority: 3, preferredClass: actor.className });
        }
        return actor;
      };

      Game.prototype.placeCompanionNearPlayer = function(actor, offset, options = {}) {
        if (!actor || !this.player) return false;
        const mapSize = DR.CONFIG?.MAP_SIZE || window.CONFIG?.MAP_SIZE || 200;
        let targetX = clamp((Number(this.player.x) || 0) + (Number(offset?.x) || 0), 1, mapSize - 2);
        let targetY = clamp((Number(this.player.y) || 0) + (Number(offset?.y) || 0), 1, mapSize - 2);
        if ((options.zone || this.currentZone) === 'dungeon' && this.dungeonSystem?.findActorPlacementNear) {
          const valid = this.dungeonSystem.findActorPlacementNear(targetX, targetY, { radius: 10, actorId: actor.botId || actor.id || actor.name, ignoreActor: actor, minActorSpacing: 1.1 });
          if (valid) { targetX = valid.x; targetY = valid.y; this.dungeonSystem.reserveActorPlacement?.(valid); }
        }
        const snap = options.snap !== false;
        const far = !Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y)) || dist(actor, this.player) > (options.maxDistance || 8.0);
        if (snap || far) {
          actor.x = targetX;
          actor.y = targetY;
        } else {
          actor.x += (targetX - actor.x) * 0.35;
          actor.y += (targetY - actor.y) * 0.35;
        }
        actor.lastStableX = actor.x;
        actor.lastStableY = actor.y;
        return true;
      };

      Game.prototype.syncPartyCompanionsToPlayerZone = function(options = {}) {
        if (!this.player) return 0;
        const zone = options.zone || this.currentZone || 'overworld';
        const reason = options.reason || 'zone-transition';
        const snap = options.snap !== false;
        let moved = 0;
        const actors = [];
        // Mercenaries are hired active companions even when they are not formally
        // flagged as a party slot. Cave/dungeon transitions must move the active
        // merc with the player or the merc remains bound to the overworld and
        // disappears from the active-zone ally list.
        if (this.merc && this.merc.alive !== false) actors.push({ kind: 'merc', actor: this.merc });
        if (this.pet && this.pet.alive !== false) actors.push({ kind: 'pet', actor: this.pet });
        const partyBots = Array.isArray(this.botPlayers)
          ? this.botPlayers.filter(bot => bot && bot.alive !== false && this.isBotInParty?.(bot))
              .sort((a, b) => String(a.botId || a.remoteId || a.name).localeCompare(String(b.botId || b.remoteId || b.name)))
          : [];
        partyBots.forEach(bot => actors.push({ kind: 'partyBot', actor: bot }));
        actors.forEach((entry, index) => {
          const dungeonStagingOffset = zone === 'dungeon'
            ? this.dungeonEntranceStaging?.partySpawnOffsets?.[index + 1]
            : null;
          const offset = dungeonStagingOffset || (entry.kind === 'partyBot'
            ? (this.partyBotFormationOffset?.(entry.actor, index) || this.companionFormationOffset?.(entry.kind, index))
            : this.companionFormationOffset?.(entry.kind, index));
          const previousZone = entry.actor.zone || this.currentZone || 'overworld';
          this.placeCompanionNearPlayer?.(entry.actor, offset, { zone, snap: snap || previousZone !== zone, maxDistance: 8.0 });
          this.resetCompanionTransitionState?.(entry.actor, zone, reason);
          moved += 1;
        });
        this.ensureActiveZoneAllies?.(zone);
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        this.renderPartyHud?.({ force: true });
        return moved;
      };

      Game.prototype.reconcileLoadedCompanionZones = function(options = {}) {
        if (!this.player) return 0;
        const zone = options.zone || this.player.zone || this.currentZone || 'dark_woods';
        let count = 0;
        const syncOne = actor => {
          if (!actor || actor.alive === false) return;
          actor.zone = zone;
          if (!Number.isFinite(Number(actor.x)) || !Number.isFinite(Number(actor.y))) {
            actor.x = this.player.x + 0.75 + count * 0.32;
            actor.y = this.player.y + 0.75 + count * 0.28;
          }
          if (!Array.isArray(this.entities)) this.entities = [];
          if (!this.entities.includes(actor)) this.entities.push(actor);
          count++;
        };
        if (this.partyMercIncluded && this.merc) syncOne(this.merc);
        if (this.pet) syncOne(this.pet);
        for (const bot of this.botPlayers || []) if (this.isBotInParty?.(bot)) syncOne(bot);
        if (count > 0) {
          this.partyPanelDirty = true;
          this.botHudDirty = true;
        }
        return count;
      };

      Game.prototype.activeZoneAllies = function(zone = this.currentZone || 'overworld') {
        const allies = [];
        const push = actor => {
          if (!actor) return;
          const kind = String(actor.kind || '');
          const keepVisibleDeathActor = actor.alive === false
            && ['player', 'bot', 'merc', 'remote'].includes(kind)
            && actor.hidden !== true
            && actor.visible !== false
            && actor.renderable !== false;
          if (actor.alive === false && !keepVisibleDeathActor) return;
          const actorZone = actor.zone || (actor === this.player ? zone : 'overworld');
          if (actorZone !== zone) return;
          if (!allies.includes(actor)) allies.push(actor);
        };
        if (this.player) {
          this.player.zone = zone;
          push(this.player);
        }
        push(this.merc);
        push(this.pet);
        if (Array.isArray(this.botPlayers)) {
          for (const bot of this.botPlayers) if (this.isBotInParty?.(bot) || (bot.zone || 'overworld') === zone) push(bot);
        }
        if (this.remotePlayers?.values) {
          for (const peer of this.remotePlayers.values()) push(peer?.entity || peer);
        }
        return allies;
      };

      Game.prototype.ensureActiveZoneAllies = function(zone = this.currentZone || 'overworld') {
        if (!Array.isArray(this.entities)) this.entities = [];
        const allies = this.activeZoneAllies?.(zone) || [];
        for (const ally of allies) if (!this.entities.includes(ally)) this.entities.push(ally);
        return allies.length;
      };


      Game.prototype.updateCompanionTransitionGrace = function(dt) {
        const actors = [this.merc, this.pet, ...(Array.isArray(this.botPlayers) ? this.botPlayers : [])].filter(Boolean);
        let dirty = false;
        for (const actor of actors) {
          if (!(Number(actor.zoneTransitionGrace) > 0)) continue;
          actor.zoneTransitionGrace = Math.max(0, Number(actor.zoneTransitionGrace || 0) - Math.max(0, Number(dt || 0)));
          if (actor.zoneTransitionGrace <= 0) {
            actor.zoneTransitionReason = '';
            dirty = true;
          }
        }
        if (dirty) {
          this.partyPanelDirty = true;
          this.botHudDirty = true;
        }
      };

      Game.prototype.getPartyCombatMembers = function(options = {}) {
        if (!this.player) return [];
        this.normalizePartyState?.();
        const includeRemote = options.includeRemote !== false;
        const includePet = options.includePet !== false;
        const sameZoneOnly = options.sameZoneOnly !== false;
        const maxRange = Number.isFinite(Number(options.range)) ? Number(options.range) : Infinity;
        const anchor = options.anchor || this.player;
        const members = [];
        const push = (actor, id, type) => {
          if (!actorAlive(actor)) return;
          if (sameZoneOnly && actor.zone && this.currentZone && actor.zone !== this.currentZone) return;
          if (anchor && Number.isFinite(maxRange) && dist(actor, anchor) > maxRange) return;
          members.push({ id: id || actorId(actor, type), type, actor });
        };
        push(this.player, this.localPeerId, 'player');
        if (this.partyMercIncluded) push(this.merc, 'merc', 'merc');
        if (includePet) push(this.pet, 'pet', 'pet');
        for (const bot of this.botPlayers || []) {
          if (this.isBotInParty?.(bot)) push(bot, bot.botId || bot.remoteId, 'bot');
        }
        if (includeRemote) {
          for (const id of this.partyMembers || []) {
            if (id === this.localPeerId) continue;
            const peer = this.remotePlayers?.get(id);
            push(peer, id, 'player');
          }
        }
        return members;
      };

      // Party EXP Bond Bonus: active non-player, slot-consuming party
      // members only (bots + remote human players). Mercenaries and pets
      // are explicitly non-slot-consuming auxiliary followers elsewhere in
      // this file (see partyMemberConsumesSlot) and do not count here.
      Game.prototype.getActiveExpBonusPartyMemberCount = function() {
        const members = this.getPartyCombatMembers?.({ includeRemote: true, includePet: false }) || [];
        const nonPlayerSlotMembers = members.filter(entry => entry.actor !== this.player && entry.type !== 'merc');
        return Math.min(5, nonPlayerSlotMembers.length);
      };

      Game.prototype.getPartyHealingCandidates = function(healer = null, options = {}) {
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : PARTY_HEAL_RADIUS;
        const anchor = healer || this.player;
        const members = this.getPartyCombatMembers?.({ includeRemote: true, includePet: true, anchor, range }) || [];
        const currentThreats = new Set((this.enemies || []).map(enemy => this.pickEnemyTarget?.(enemy)).filter(Boolean));
        const healOrder = entry => {
          if (entry.actor === this.player) return 0;
          if (entry.actor === healer) return 1;
          if (entry.type === 'player') return 2;
          if (entry.type === 'bot') return 3;
          if (entry.type === 'merc') return 4;
          if (entry.type === 'pet') return 5;
          return 6;
        };
        return members
          .filter(entry => entry.actor && entry.actor.alive !== false && entry.actor.maxHp > 0)
          .map(entry => {
            const actor = entry.actor;
            const ratio = actorHpRatio(actor);
            const order = healOrder(entry);
            const emergency = ratio <= 0.34;
            let priority = ratio + order * (emergency ? 0.010 : 0.020);
            if (currentThreats.has(actor)) priority -= 0.075;
            return { ...entry, ratio, priority, healOrder: order };
          })
          .sort((a, b) => (a.priority - b.priority) || (a.healOrder - b.healOrder) || (a.ratio - b.ratio));
      };

      Game.prototype.resolvePartyAssistTarget = function(actor = this.player, options = {}) {
        const maxRange = Number.isFinite(Number(options.range)) ? Number(options.range) : 10.5;
        const preferPlayerTarget = options.preferPlayerTarget !== false;
        const playerTarget = preferPlayerTarget ? this.getOffensiveTarget?.() : null;
        const allowUnengagedPlayerTarget = options.allowUnengagedPlayerTarget === true;
        const playerTargetEngaged = playerTarget && this.isHostileTarget?.(playerTarget) && (
          allowUnengagedPlayerTarget ||
          this.player?.autoAttack ||
          (this.player?.combatCooldown || 0) > 0 ||
          playerTarget.aggro ||
          playerTarget.hp < playerTarget.maxHp ||
          (playerTarget.combatCooldown || 0) > 0
        );
        if (playerTarget && playerTarget.alive && this.isHostileTarget?.(playerTarget) && playerTargetEngaged && (!actor || dist(actor, playerTarget) <= maxRange + 4)) return playerTarget;

        let best = null;
        let bestScore = Infinity;
        const members = this.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor: actor || this.player, range: Math.max(14, maxRange + 6) }) || [];
        for (const enemy of (this.queryEnemiesNearEntity?.(actor || this.player, maxRange + 8) || this.enemies || [])) {
          if (!actorAlive(enemy)) continue;
          let score = Infinity;
          for (const entry of members) {
            const ally = entry.actor;
            const targeted = this.pickEnemyTarget?.(enemy) === ally && (enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0);
            const allyEngaged = ally === this.player && ally.targetId === enemy.id && (ally.autoAttack || (ally.combatCooldown || 0) > 0 || enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0);
            const hostile = enemy.aggro || enemy.hp < enemy.maxHp || (enemy.combatCooldown || 0) > 0 || targeted || allyEngaged;
            if (!hostile) continue;
            const dActor = actor ? dist(actor, enemy) : dist(this.player, enemy);
            if (dActor > maxRange + 4.5) continue;
            const dAlly = dist(ally, enemy);
            const entryScore = dActor + (targeted ? -3.0 : 0) + (allyEngaged ? -2.4 : 0) + (enemy.elite ? -1.0 : 0) + Math.min(4, dAlly * 0.25);
            score = Math.min(score, entryScore);
          }
          if (score < bestScore) { best = enemy; bestScore = score; }
        }
        if (best) return best;

        const hint = this.partyAssistTargetHint;
        if (hint && performance.now() < Number(hint.expiresAt || 0)) {
          let hinted = null;
          let hintedScore = Infinity;
          for (const enemy of (this.queryEnemiesNearPoint?.(hint.x, hint.y, Math.max(6, maxRange + 4)) || this.enemies || [])) {
            if (!actorAlive(enemy)) continue;
            const nameMatch = hint.name && String(enemy.name || '').toLowerCase() === String(hint.name).toLowerCase();
            const dHint = Math.hypot((Number(enemy.x) || 0) - (Number(hint.x) || 0), (Number(enemy.y) || 0) - (Number(hint.y) || 0));
            const dActor = actor ? dist(actor, enemy) : dist(this.player, enemy);
            if (dHint > 4.0 || dActor > maxRange + 4) continue;
            const score = dActor + dHint * 0.5 + (nameMatch ? -1.5 : 0);
            if (score < hintedScore) { hinted = enemy; hintedScore = score; }
          }
          if (hinted) return hinted;
        }
        return null;
      };


      Game.prototype.companionCombatRole = function(actor) {
        if (!actor) return 'dps';
        if (actor.kind === 'pet') return actor.hoveringPet ? 'ranged-pet' : 'melee-pet';
        const rawRole = actor.role || actor.roleKey || actor.className || actor.kind || '';
        const role = String(rawRole).toLowerCase();
        if (BotRoles.isTankRole?.(rawRole) || role.includes('guardian') || role.includes('tank') || role.includes('paladin') || role.includes('warden')) return 'tank';
        if (BotRoles.isMeleeDpsRole?.(rawRole) || role.includes('rogue') || role.includes('scout') || role.includes('melee')) return 'melee';
        if (BotRoles.isHealingSupportRole?.(rawRole) || role.includes('cleric') || role.includes('healer')) return 'healer';
        if (BotRoles.isRangedRole?.(rawRole) || role.includes('adept') || role.includes('enchanter') || role.includes('summoner') || role.includes('necromancer') || role.includes('caster') || role.includes('support')) return 'ranged';
        return 'dps';
      };

      Game.prototype.getCompanionCombatActors = function(target = null, options = {}) {
        const anchor = target || this.player;
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : 18;
        const members = this.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor, range }) || [];
        const actors = [];
        const push = actor => {
          if (!actor || actor.alive === false) return;
          if (actor === this.player && options.includePlayer === false) return;
          if (actor.kind === 'remote') return;
          if (!actors.includes(actor)) actors.push(actor);
        };
        for (const entry of members) push(entry.actor);
        return actors;
      };

      Game.prototype.companionCombatIndex = function(actor, target = null) {
        const actors = this.getCompanionCombatActors?.(target, { includePlayer: false, range: 22 }) || [];
        const roleWeight = entry => {
          const role = this.companionCombatRole?.(entry) || 'dps';
          if (role === 'tank') return 0;
          if (role === 'melee' || role === 'melee-pet') return 1;
          if (role === 'ranged' || role === 'ranged-pet') return 2;
          if (role === 'healer') return 3;
          return 4;
        };
        actors.sort((a, b) => roleWeight(a) - roleWeight(b) || String(a.name || a.id || '').localeCompare(String(b.name || b.id || '')));
        return Math.max(0, actors.indexOf(actor));
      };

      Game.prototype.companionCombatAnchor = function(actor, target, options = {}) {
        if (!actor || !target) return null;
        const role = this.companionCombatRole?.(actor) || 'dps';
        const index = this.companionCombatIndex?.(actor, target) || 0;
        const preferredRange = Number.isFinite(Number(options.preferredRange)) ? Number(options.preferredRange) : 1.35;
        const owner = this.player || actor;
        let ox = Number(owner.x || actor.x || 0) - Number(target.x || 0);
        let oy = Number(owner.y || actor.y || 0) - Number(target.y || 0);
        let olen = Math.hypot(ox, oy);
        if (olen < 0.01) { ox = 1; oy = 0; olen = 1; }
        ox /= olen; oy /= olen;
        const px = -oy;
        const py = ox;
        const side = index % 2 === 0 ? 1 : -1;
        const ring = Math.floor(index / 2);
        let range = preferredRange;
        let lateral = side * (0.40 + ring * 0.34);
        let forwardScale = 1;
        if (role === 'tank') { range = Math.max(1.08, preferredRange * 0.86); lateral = side * 0.18; forwardScale = 1.0; }
        else if (role === 'melee' || role === 'melee-pet') { range = Math.max(1.18, preferredRange); lateral = side * (0.82 + ring * 0.28); forwardScale = 0.72; }
        else if (role === 'ranged' || role === 'ranged-pet') { range = Math.max(4.6, preferredRange); lateral = side * (1.15 + ring * 0.34); forwardScale = 1.08; }
        else if (role === 'healer') { range = Math.max(5.2, preferredRange); lateral = side * (1.55 + ring * 0.28); forwardScale = 1.22; }
        const x = target.x + ox * range * forwardScale + px * lateral;
        const y = target.y + oy * range * forwardScale + py * lateral;
        return { x, y, role, index, range };
      };

      Game.prototype.applyCompanionSeparation = function(actor, options = {}) {
        if (!actor) return false;
        const range = Number.isFinite(Number(options.range)) ? Number(options.range) : 0.54;
        const strength = Number.isFinite(Number(options.strength)) ? Number(options.strength) : 0.24;
        const allies = this.getCompanionCombatActors?.(actor, { includePlayer: false, range: 4.0 }) || [];
        let dx = 0, dy = 0, count = 0;
        for (const ally of allies) {
          if (!ally || ally === actor || ally.alive === false) continue;
          const d = dist(actor, ally);
          if (d <= 0.001 || d >= range) continue;
          dx += (actor.x - ally.x) / d * (range - d);
          dy += (actor.y - ally.y) / d * (range - d);
          count += 1;
        }
        if (!count) return false;
        const tx = actor.x + dx * strength;
        const ty = actor.y + dy * strength;
        if (this.isWalkable?.(tx, ty, actor)) {
          actor.x = tx;
          actor.y = ty;
          return true;
        }
        return false;
      };

      Game.prototype.markPartyCombatEngaged = function(enemy, source = this.player, options = {}) {
        if (!enemy || enemy.kind !== 'enemy') return false;
        if (!this.isPartyActor?.(source)) return false;
        const members = this.getPartyCombatMembers?.({ includeRemote: false, includePet: true, anchor: enemy, range: 16 }) || [];
        for (const entry of members) {
          const actor = entry.actor;
          if (!actor || actor.kind === 'remote') continue;
          actor.combatCooldown = Math.max(actor.combatCooldown || 0, options.cooldown || 5.25);
          if ((actor.kind === 'merc' || actor.kind === 'bot') && this.actorIsMeditating?.(actor)) this.cancelMeditation?.(actor, 'party combat', { silent: true });
        }
        enemy.partyTaggedBy = enemy.partyTaggedBy || {};
        enemy.partyTaggedBy[this.localPeerId || 'local'] = performance.now();
        enemy.partyId = this.partyId || null;
        this.broadcastPartyAssistTarget?.(enemy, source);
        return true;
      };

      Game.prototype.partyEligibleXpRecipients = function(enemy) {
        const recipients = [];
        const botRosterIds = new Set((this.botPlayers || []).map(bot => String(bot?.botId || bot?.remoteId || bot?.id || '')).filter(Boolean));
        const inRange = actor => actor && actorAlive(actor) && (!enemy || dist(actor, enemy) <= PARTY_XP_RADIUS);
        if (inRange(this.player)) recipients.push({ id: this.localPeerId, type: 'player', actor: this.player, weight: 1, partyEligible: true });
        if (inRange(this.merc)) {
          const included = Boolean(this.partyMercIncluded);
          recipients.push({ id: 'merc', type: 'merc', actor: this.merc, weight: 0.72, partyIncluded: included, partyEligible: included });
        }
        for (const bot of this.botPlayers || []) {
          if (!inRange(bot)) continue;
          const included = Boolean(this.isBotInParty?.(bot));
          recipients.push({ id: bot.botId || bot.remoteId, type: 'bot', actor: bot, weight: 0.88, partyIncluded: included, partyEligible: included });
        }
        for (const id of this.partyMembers || []) {
          const normalizedId = String(id);
          if (normalizedId === this.localPeerId) continue;
          if (botRosterIds.has(normalizedId) || normalizedId.startsWith('bot-')) continue;
          const peer = this.remotePlayers?.get(normalizedId);
          if (inRange(peer)) recipients.push({ id, type: 'remote', actor: peer, weight: 1, partyEligible: true });
        }
        return recipients;
      };

      Game.prototype.awardPartyEnemyXp = function(baseXp, enemy, source = null) {
        const xp = Math.max(0, Math.floor(Number(baseXp) || 0));
        if (xp <= 0 || !this.player) return { playerXp: 0, mercXp: 0, botXp: 0, remoteXp: 0, recipientCount: 0, logText: '+0 XP' };
        const creditedSource = source?.kind === 'pet' && source.owner?.kind === 'bot' ? source.owner : source;
        if (creditedSource?.kind === 'bot' && !this.isBotInParty?.(creditedSource)) {
          const botXp = Math.max(1, Math.floor(xp * 0.90));
          this.awardBotXp?.(creditedSource, botXp, enemy);
          this.partyPanelDirty = true;
          return { playerXp: 0, mercXp: 0, botXp, remoteXp: 0, recipientCount: 1, botSourceHandled: true, logText: `${creditedSource.name || 'Bot'} gained ${botXp} XP` };
        }
        const recipients = this.partyEligibleXpRecipients?.(enemy) || [{ id: this.localPeerId, type: 'player', actor: this.player, weight: 1 }];
        const realRecipients = recipients.filter(entry => entry.type !== 'pet');
        const splitRecipients = realRecipients.filter(entry => (entry.type !== 'merc' && entry.type !== 'bot') || entry.partyIncluded);
        const count = Math.max(1, splitRecipients.length || 1);
        const shareMultiplier = count <= 1 ? 1 : count === 2 ? 0.72 : count === 3 ? 0.58 : 0.50;
        const playerEntry = realRecipients.find(entry => entry.type === 'player' && entry.actor === this.player);
        const playerXp = playerEntry ? Math.max(1, Math.floor(xp * shareMultiplier * playerEntry.weight)) : 0;
        const raceAdjustedPlayerXp = playerXp > 0 ? (this.player.raceId === 'human' ? Math.max(1, Math.floor(playerXp * 1.02)) : playerXp) : 0;
        const playerXpAward = raceAdjustedPlayerXp > 0 ? this.awardPlayerXp(raceAdjustedPlayerXp) : null;
        let mercXp = 0;
        const mercEntry = realRecipients.find(entry => entry.type === 'merc');
        if (mercEntry && this.awardMercXp) {
          mercXp = Math.max(1, Math.floor(xp * (mercEntry.partyIncluded ? shareMultiplier : 1) * mercEntry.weight));
          this.awardMercXp(mercXp, enemy);
        }
        const botEntries = realRecipients.filter(entry => entry.type === 'bot' && entry.partyIncluded);
        let botXp = 0;
        for (const botEntry of botEntries) {
          const share = Math.max(1, Math.floor(xp * shareMultiplier * botEntry.weight));
          if (this.awardBotXp?.(botEntry.actor, share, enemy)) botXp += share;
        }
        const remoteRecipients = realRecipients.filter(entry => entry.type === 'remote');
        const remoteXp = remoteRecipients.length ? Math.max(1, Math.floor(xp * shareMultiplier)) : 0;
        if (remoteRecipients.length && this.broadcastMultiplayer) {
          this.broadcastMultiplayer({
            type: 'partyReward',
            partyId: this.partyId,
            rewardId: `reward-${enemy?.id || enemy?.name || 'enemy'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            enemyName: enemy?.name || 'Enemy',
            xp: remoteXp,
            eligibleIds: remoteRecipients.map(entry => entry.id),
            sourceName: creditedSource?.name || this.player?.name || 'Party'
          });
        }
        const awardedPlayerXp = playerXpAward?.amount ?? playerXp;
        const shareSuffix = count > 1 ? ` (${count}-member party share)` : '';
        const bondSuffix = playerXpAward?.partyBonusPercent > 0 ? ` (Party Bond Bonus: +${Math.round(playerXpAward.partyBonusPercent * 100)}%)` : '';
        const logText = `+${awardedPlayerXp} XP${shareSuffix}${bondSuffix}`;
        this.partyPanelDirty = true;
        this.renderPartyHud?.();
        return { playerXp: awardedPlayerXp, mercXp, botXp, remoteXp, recipientCount: count, logText };
      };

      Game.prototype.receivePartyReward = function(message) {
        if (!message || message.partyId !== this.partyId || !this.player) return;
        if (Array.isArray(message.eligibleIds) && !message.eligibleIds.includes(this.localPeerId)) return;
        this.partyRewardLedger = this.partyRewardLedger || new Set();
        if (this.partyRewardLedger.has(message.rewardId)) return;
        this.partyRewardLedger.add(message.rewardId);
        const xp = Math.max(0, Math.floor(Number(message.xp) || 0));
        if (xp <= 0) return;
        const raceAdjustedXp = this.player.raceId === 'human' ? Math.max(1, Math.floor(xp * 1.02)) : xp;
        const award = this.awardPlayerXp(raceAdjustedXp);
        const bondSuffix = award.partyBonusPercent > 0 ? ` (Party Bond Bonus: +${Math.round(award.partyBonusPercent * 100)}%)` : '';
        this.logCombat?.(`${message.enemyName || 'Enemy'} defeated by party. +${award.amount} shared XP${bondSuffix}.`);
        this.checkLevelUp?.();
        this.partyPanelDirty = true;
        this.renderPartyHud?.();
      };

      Game.prototype.partyLootPolicyForEnemy = function(enemy, source = null) {
        const recipients = this.partyEligibleXpRecipients?.(enemy) || [];
        const eligibleIds = recipients
          .filter(entry => (entry.type !== 'merc' || entry.partyIncluded) && (entry.type !== 'bot' || entry.partyIncluded))
          .map(entry => entry.id)
          .filter(Boolean);
        const partyLoot = Boolean(this.partyId && eligibleIds.length > 1);
        return {
          version: 1,
          partyId: partyLoot ? this.partyId : null,
          partyLoot,
          eligibleIds,
          killedBy: actorId(source || this.player, 'player'),
          rule: partyLoot ? 'party-round-robin-local' : 'solo'
        };
      };

      Game.prototype.tagCorpseLootForParty = function(enemy, lootResult, source = null) {
        if (!enemy?.corpseLoot) return null;
        const policy = this.partyLootPolicyForEnemy?.(enemy, source) || null;
        enemy.corpseLoot.party = policy;
        if (lootResult && typeof lootResult === 'object') lootResult.party = policy;
        return policy;
      };

      Game.prototype.broadcastPartyAssistTarget = function(enemy, source = null) {
        if (!this.partyId || !enemy || !this.broadcastMultiplayer) return false;
        const now = performance.now();
        if (this.lastPartyAssistBroadcastAt && now - this.lastPartyAssistBroadcastAt < 850) return false;
        this.lastPartyAssistBroadcastAt = now;
        this.broadcastMultiplayer({
          type: 'partyCombatPing',
          partyId: this.partyId,
          targetName: enemy.name || 'Enemy',
          targetLevel: enemy.level || 1,
          x: enemy.x,
          y: enemy.y,
          sourceName: source?.name || this.player?.name || 'Party'
        });
        return true;
      };

      Game.prototype.receivePartyCombatPing = function(message) {
        if (!message || message.partyId !== this.partyId) return;
        this.partyAssistTargetHint = {
          name: message.targetName || '',
          level: Math.max(1, Math.floor(Number(message.targetLevel) || 1)),
          x: Number(message.x) || 0,
          y: Number(message.y) || 0,
          sourceName: message.sourceName || 'Party',
          expiresAt: performance.now() + PARTY_ASSIST_HINT_MS
        };
        this.partyPanelDirty = true;
      };

      Game.prototype.partyInviteClassName = function(invite) {
        const raw = String(invite?.leaderClassName || invite?.fromClassName || invite?.className || '').replace(/\s+party\s*$/i, '').trim();
        return raw || (invite?.kind === 'bot_party' ? 'Bot' : 'Adventurer');
      };

      Game.prototype.pruneExpiredPartyInvites = function() {
        if (!(this.partyInvites instanceof Map)) return 0;
        const now = performance.now();
        let removed = 0;
        for (const [id, invite] of this.partyInvites.entries()) {
          if (Number(invite?.expiresAt || 0) > 0 && Number(invite.expiresAt) <= now) {
            this.partyInvites.delete(id);
            removed += 1;
          }
        }
        if (removed > 0) this.partyPanelDirty = true;
        return removed;
      };

      Game.prototype.ensurePartyInvitePopup = function() {
        let popup = ui.partyInvitePopup || document.getElementById('partyInvitePopup');
        if (!popup) {
          popup = document.createElement('section');
          popup.id = 'partyInvitePopup';
          popup.className = 'partyInvitePopup';
          popup.style.display = 'none';
          popup.innerHTML = '<div class="partyInvitePopupTitle">Party Invite</div><div id="partyInvitePopupList"></div>';
          document.body.appendChild(popup);
        }
        ui.partyInvitePopup = popup;
        ui.partyInvitePopupList = popup.querySelector('#partyInvitePopupList');
        if (popup.dataset.partyInviteBound === '1') return popup;
        popup.dataset.partyInviteBound = '1';
        popup.addEventListener('pointerdown', event => {
          if (event.target.closest('.partyInvitePopupCard')) event.stopPropagation();
        });
        popup.addEventListener('click', event => {
          const button = event.target.closest('button[data-party-invite-action]');
          if (!button) return;
          event.preventDefault();
          event.stopPropagation();
          const inviteId = button.dataset.inviteId || '';
          if (button.dataset.partyInviteAction === 'accept') this.acceptPartyInvite?.(inviteId);
          else if (button.dataset.partyInviteAction === 'decline') this.declinePartyInvite?.(inviteId);
        });
        return popup;
      };

      Game.prototype.renderPartyInvitePopup = function() {
        this.normalizePartyState?.();
        this.pruneExpiredPartyInvites?.();
        const popup = this.ensurePartyInvitePopup?.();
        const list = ui.partyInvitePopupList || popup?.querySelector?.('#partyInvitePopupList');
        if (!popup || !list) return;
        const now = performance.now();
        const invites = Array.from(this.partyInvites?.values?.() || [])
          .filter(invite => !Number(invite?.expiresAt || 0) || Number(invite.expiresAt) > now)
          .sort((a, b) => Number(b.receivedAt || 0) - Number(a.receivedAt || 0));
        if (!invites.length) {
          popup.style.display = 'none';
          list.innerHTML = '';
          return;
        }
        popup.style.display = 'block';
        list.innerHTML = invites.map(invite => {
          const className = this.partyInviteClassName?.(invite) || 'Adventurer';
          const level = Math.max(1, Math.floor(Number(invite.fromLevel || invite.leaderLevel || invite.level || 1)));
          const memberCount = Array.isArray(invite.botMemberIds) ? invite.botMemberIds.length : 0;
          const typeLabel = invite.kind === 'bot_party' ? 'Bot Party Invite' : 'Party Invite';
          const memberLine = invite.kind === 'bot_party'
            ? `${memberCount || 1} bot member${(memberCount || 1) === 1 ? '' : 's'} ready`
            : `${escapeHtml(className)} party invite`;
          const emblem = DR.classEmblemMarkup?.(className, { size: 30, className: 'partyInviteClassEmblem', title: `${className} emblem` }) || `<span class="partyInviteFallbackIcon">${escapeHtml(this.partyMemberIcon?.({ className }) || '●')}</span>`;
          return `<div class="partyInvitePopupCard" data-invite-id="${escapeHtml(invite.id)}">
            <div class="partyInvitePopupHeader">
              <span class="partyInvitePopupIcon">${emblem}</span>
              <div class="partyInvitePopupIdentity">
                <strong>${escapeHtml(invite.fromName || 'Bot Leader')}</strong>
                <span>Level ${level} ${escapeHtml(className)} · ${escapeHtml(typeLabel)}</span>
              </div>
            </div>
            <div class="partyInvitePopupDetail">${memberLine}</div>
            <div class="partyInvitePopupActions">
              <button type="button" data-party-invite-action="accept" data-invite-id="${escapeHtml(invite.id)}">Accept</button>
              <button type="button" data-party-invite-action="decline" data-invite-id="${escapeHtml(invite.id)}">Decline</button>
            </div>
          </div>`;
        }).join('');
      };

      Game.prototype.invitePeer = function(peerId) {
        this.normalizePartyState?.();
        const peer = this.remotePlayers?.get(peerId);
        if (!peer) return this.logParty?.('That player is no longer nearby.');
        if (peer.zone !== this.currentZone) return this.logParty?.(`${peer.name} is in another zone.`);
        if (dist(peer, this.player) > PARTY_INVITE_RADIUS) return this.logParty?.(`${peer.name} is too far away to invite.`);
        if (this.partyMembers.has(peerId)) return this.logParty?.(`${peer.name} is already in your party.`);
        if (!this.partyHasRoomFor?.(1)) return this.logParty?.(this.partyFullMessage?.() || 'Party is full.');
        this.ensureLocalParty();
        this.broadcastMultiplayer?.({
          type: 'partyInvite',
          targetId: peerId,
          partyId: this.partyId,
          partyLeaderId: this.partyLeaderId,
          fromName: this.player?.name || 'Player',
          fromClassName: this.player?.className || 'Adventurer',
          fromLevel: Math.max(1, Math.floor(Number(this.player?.level) || 1)),
          partyMembers: Array.from(this.partyMembers)
        });
        peer.pendingPartyInvite = true;
        this.playAudioEvent?.('ui_select', { volume: 0.18, cooldown: 0.1 });
        this.logParty?.(`Party invite sent to ${peer.name}.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
      };

      Game.prototype.receivePartyInvite = function(message) {
        this.normalizePartyState?.();
        if (message.targetId !== this.localPeerId) return;
        const inviteId = `${message.senderId}:${message.partyId}`;
        this.partyInvites.set(inviteId, {
          id: inviteId,
          fromId: message.senderId,
          fromName: message.fromName || 'Player',
          fromClassName: message.fromClassName || 'Adventurer',
          fromLevel: Math.max(1, Math.floor(Number(message.fromLevel) || 1)),
          partyId: message.partyId,
          partyLeaderId: message.partyLeaderId || message.senderId,
          partyMembers: new Set([...(message.partyMembers || []), message.senderId]),
          receivedAt: performance.now()
        });
        this.playAudioEvent?.('ui_select', { volume: 0.22, cooldown: 0.1 });
        this.logParty?.(`${message.fromName || 'A player'} invited you to a party.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyInvitePopup?.();
      };

      Game.prototype.acceptPartyInvite = function(inviteId) {
        this.normalizePartyState?.();
        const invite = this.partyInvites.get(inviteId);
        if (!invite) { this.renderPartyInvitePopup?.(); return; }
        if (Number(invite.expiresAt || 0) > 0 && Number(invite.expiresAt) <= performance.now()) {
          this.partyInvites.delete(inviteId);
          this.logParty?.(`${invite.fromName || 'That party'}'s invite expired.`);
          this.partyPanelDirty = true;
          this.renderPartyPanel?.();
          this.renderPartyInvitePopup?.();
          return;
        }
        if (invite.kind === 'bot_party') {
          const joined = this.acceptBotPartyInvite?.(invite) === true;
          this.partyInvites.delete(inviteId);
          if (joined) this.playAudioEvent?.('ui_select', { volume: 0.24, cooldown: 0.1 });
          this.partyPanelDirty = true;
          this.renderPartyPanel?.();
          this.renderPartyInvitePopup?.();
          this.renderPartyHud?.({ force: true });
          return;
        }
        const incomingMembers = new Set([...invite.partyMembers, this.localPeerId]);
        const max = this.partyMaxSize?.() || PARTY_MAX_SIZE;
        const localBotSlots = this.botPartyMembers?.size || 0;
        if (incomingMembers.size + localBotSlots > max) {
          this.partyInvites.delete(inviteId);
          this.logParty?.(`Cannot join ${invite.fromName}'s party. Player/bot party slots are full (${incomingMembers.size + localBotSlots}/${max}). Mercenaries and pets do not consume slots.`);
          this.partyPanelDirty = true;
          this.renderPartyPanel?.();
          this.renderPartyInvitePopup?.();
          return;
        }
        this.partyId = invite.partyId;
        this.partyLeaderId = invite.partyLeaderId;
        this.partyMembers = incomingMembers;
        for (const id of incomingMembers) this.rememberPartyMemberOrder?.(id);
        this.partyInvites.delete(inviteId);
        this.broadcastMultiplayer?.({ type: 'partyAccept', targetId: invite.fromId, partyId: this.partyId, acceptedBy: this.localPeerId });
        this.broadcastPartyUpdate?.();
        this.broadcastLocalPeerState?.(true);
        this.playAudioEvent?.('ui_select', { volume: 0.24, cooldown: 0.1 });
        this.logParty?.(`Joined ${invite.fromName}'s party.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyInvitePopup?.();
        this.renderPartyHud?.({ force: true });
      };

      Game.prototype.declinePartyInvite = function(inviteId) {
        this.normalizePartyState?.();
        const invite = this.partyInvites.get(inviteId);
        if (!invite) { this.renderPartyInvitePopup?.(); return; }
        this.partyInvites.delete(inviteId);
        this.playAudioEvent?.('ui_close', { volume: 0.14, cooldown: 0.1 });
        this.logParty?.(`Declined ${invite.fromName}'s party invite.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyInvitePopup?.();
      };

      Game.prototype.receivePartyAccept = function(message) {
        this.normalizePartyState?.();
        if (message.targetId !== this.localPeerId || message.partyId !== this.partyId) return;
        const peer = this.remotePlayers?.get(message.acceptedBy);
        if (!this.partyHasRoomFor?.(1)) {
          if (peer) peer.pendingPartyInvite = false;
          this.logParty?.(this.partyFullMessage?.() || 'Party is full.');
          this.partyPanelDirty = true;
          this.renderPartyPanel?.();
          return;
        }
        this.partyMembers.add(message.acceptedBy);
        this.rememberPartyMemberOrder?.(message.acceptedBy);
        if (peer) peer.pendingPartyInvite = false;
        this.broadcastPartyUpdate?.();
        this.broadcastLocalPeerState?.(true);
        this.playAudioEvent?.('ui_select', { volume: 0.2, cooldown: 0.1 });
        this.logParty?.(`${peer?.name || 'A player'} joined your party.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
      };

      Game.prototype.broadcastPartyUpdate = function() {
        this.normalizePartyState?.();
        if (!this.partyId) return;
        this.broadcastMultiplayer?.({
          type: 'partyUpdate',
          partyId: this.partyId,
          partyLeaderId: this.partyLeaderId,
          partyMembers: Array.from(this.partyMembers)
        });
      };

      Game.prototype.receivePartyUpdate = function(message) {
        this.normalizePartyState?.();
        if (!Array.isArray(message.partyMembers) || !message.partyMembers.includes(this.localPeerId)) return;
        const previousRemoteIds = new Set(Array.from(this.partyMembers || []).map(String).filter(id => id !== String(this.localPeerId)));
        this.partyId = message.partyId;
        this.partyLeaderId = message.partyLeaderId || message.partyMembers[0] || this.localPeerId;
        const localId = String(this.localPeerId);
        const occupiedBotSlots = this.botPartyMembers?.size || 0;
        const remoteLimit = Math.max(0, PARTY_MAX_SIZE - 1 - occupiedBotSlots);
        const remoteIds = message.partyMembers.map(String).filter(id => id && id !== localId).slice(0, remoteLimit);
        this.partyMembers = new Set([localId, ...remoteIds]);
        this.partyMembers.add(this.localPeerId);
        for (const id of remoteIds) this.rememberPartyMemberOrder?.(id);
        for (const id of previousRemoteIds) {
          if (this.partyMembers.has(id)) continue;
          this.forgetPartyMemberOrder?.(id);
          const remote = this.remotePlayers?.get?.(id);
          if (remote && this.player?.targetId === remote.id) this.player.targetId = null;
        }
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
      };

      Game.prototype.clearLocalPartyRuntimeState = function(options = {}) {
        this.normalizePartyState?.();
        const localId = String(this.localPeerId || 'local');
        const previousBotIds = Array.from(this.botPartyMembers || []).map(String);
        const previousTargetIds = new Set(previousBotIds);
        if (this.partyMercIncluded) previousTargetIds.add('merc');
        this.partyId = null;
        this.partyLeaderId = this.localPeerId || localId;
        this.partyMembers = new Set([this.localPeerId || localId]);
        this.partyMercIncluded = false;
        this.partyMemberOrder = [];
        if (this.partyInvites instanceof Map) this.partyInvites.clear();
        if (this.botPartyInvites instanceof Map) this.botPartyInvites.clear();
        if (this.botPartyMembers instanceof Set) this.botPartyMembers.clear();
        else this.botPartyMembers = new Set();
        for (const bot of this.botPlayers || []) {
          const id = String(bot?.botId || bot?.remoteId || bot?.id || '');
          if (!id || !previousBotIds.includes(id)) continue;
          bot.partyId = null;
          bot.partyLeaderId = null;
          bot.command = 'autonomous';
          bot.botState = bot.alive === false ? 'downed' : 'questing';
          bot.currentActivityLabel = bot.alive === false ? 'Downed' : 'Questing';
          if (this.player?.targetId === bot.id) this.player.targetId = null;
        }
        if (this.player && this.player.targetId === this.merc?.id) this.player.targetId = null;
        this.partyPanelDirty = true;
        this.botHudDirty = true;
        if (!options.noRender) {
          this.renderPartyPanel?.();
          this.renderPartyInvitePopup?.();
          this.renderPartyHud?.({ force: true });
          this.updateUI?.();
        }
        return { previousBotIds, previousTargetIds: Array.from(previousTargetIds) };
      };

      Game.prototype.cleanupPartyForSessionEnd = function(options = {}) {
        this.normalizePartyState?.();
        const reason = options.reason || 'session-end';
        const localId = String(this.localPeerId || 'local');
        const members = Array.from(this.partyMembers || []).map(String);
        const remoteMembers = members.filter(id => id && id !== localId);
        const botMembers = Array.from(this.botPartyMembers || []).map(String).filter(Boolean);
        const hadInvites = (this.partyInvites instanceof Map && this.partyInvites.size > 0) || (this.botPartyInvites instanceof Map && this.botPartyInvites.size > 0);
        const hadParty = Boolean(this.partyId || remoteMembers.length || botMembers.length || this.partyMercIncluded || hadInvites);
        if (!hadParty) {
          this.clearLocalPartyRuntimeState?.({ noRender: true });
          return false;
        }

        const partyId = this.partyId;
        const wasLeader = !partyId || String(this.partyLeaderId || localId) === localId;
        const playerName = this.player?.name || 'Player';
        if (partyId && !options.skipBroadcast) {
          if (wasLeader) {
            this.broadcastMultiplayer?.({
              type: 'partyDisband',
              partyId,
              leaderId: localId,
              leaderName: playerName,
              reason
            });
          } else {
            this.broadcastMultiplayer?.({
              type: 'partyLeave',
              partyId,
              leaverId: localId,
              leaverName: playerName,
              reason
            });
          }
        }

        this.clearLocalPartyRuntimeState?.({ noRender: options.silent || options.fromBeforeUnload });
        if (!options.silent && !options.fromBeforeUnload) {
          this.logParty?.(wasLeader ? 'Party disbanded on logout/exit.' : 'Left party on logout/exit.');
          this.log?.(wasLeader ? 'Party disbanded for this session.' : 'You left your party for this session.', 'System');
        }
        return true;
      };

      Game.prototype.receivePartyDisband = function(message) {
        this.normalizePartyState?.();
        if (!message || message.partyId !== this.partyId) return false;
        const leaderName = message.leaderName || 'Party leader';
        this.clearLocalPartyRuntimeState?.();
        this.logParty?.(`${leaderName} disbanded the party.`);
        return true;
      };

      Game.prototype.leaveParty = function() {
        this.normalizePartyState?.();
        if (!this.partyId) return;
        const leavingPartyId = this.partyId;
        this.broadcastMultiplayer?.({ type: 'partyLeave', partyId: leavingPartyId, leaverId: this.localPeerId });
        this.partyId = null;
        this.partyLeaderId = this.localPeerId;
        this.partyMembers = new Set([this.localPeerId]);
        if (this.merc) this.partyMercIncluded = true;
        this.playAudioEvent?.('ui_close', { volume: 0.16, cooldown: 0.1 });
        this.logParty?.(this.merc ? 'Left party. Mercenary remains an auxiliary follower.' : 'Left party.');
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
      };

      Game.prototype.receivePartyLeave = function(message) {
        this.normalizePartyState?.();
        if (message.partyId !== this.partyId) return;
        const leaverId = String(message.leaverId || '');
        const leaverWasLeader = leaverId && String(this.partyLeaderId || '') === leaverId;
        if (message.disband === true || leaverWasLeader) {
          const leaderName = message.leaverName || 'Party leader';
          this.clearLocalPartyRuntimeState?.();
          this.logParty?.(`${leaderName} left. Party disbanded.`);
          return;
        }
        this.partyMembers.delete(leaverId);
        this.forgetPartyMemberOrder?.(leaverId);
        if (this.partyMembers.size <= 1) {
          this.clearLocalPartyRuntimeState?.();
          this.logParty?.('Party disbanded.');
        } else {
          this.logParty?.(`${message.leaverName || 'A party member'} left.`);
          this.partyPanelDirty = true;
          this.renderPartyPanel?.();
          this.renderPartyHud?.({ force: true });
        }
      };

      Game.prototype.copyPeerId = function() {
        const text = this.localPeerId;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
        this.logParty?.(`Peer ID: ${text}`);
      };

      Game.prototype.inviteMercToParty = function() {
        if (!this.merc) return this.logParty?.('Hire a mercenary first.');
        this.ensureLocalParty();
        this.partyMercIncluded = true;
        this.rememberPartyMemberOrder?.('merc');
        this.partyPanelDirty = true;
        this.playAudioEvent?.('merc_command', { actor: this.merc, volume: 0.25, cooldown: 0.1 });
        this.logParty?.(`${this.merc.name} added as an auxiliary follower. Mercenaries do not consume party slots.`);
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
        this.updateUI?.();
      };

      Game.prototype.removeMercFromParty = function() {
        if (!this.partyMercIncluded) return;
        this.partyMercIncluded = false;
        this.forgetPartyMemberOrder?.('merc');
        if (this.player && this.player.targetId === this.merc?.id) this.player.targetId = null;
        this.partyPanelDirty = true;
        this.playAudioEvent?.('ui_close', { volume: 0.15, cooldown: 0.1 });
        this.logParty?.('Mercenary removed from auxiliary follower roster.');
        this.renderPartyPanel?.();
        this.renderPartyHud?.({ force: true });
        this.updateUI?.();
      };

      Game.prototype.hasVisiblePartyHud = function() {
        if (!this.player) return false;
        return (this.getPartyRoster?.() || []).length > 1;
      };

      Game.prototype.renderPartyHud = function(options = {}) {
        // V0.12.83: the always-visible party frame is owned by the unified player HUD.
        // Keep the legacy floating Party HUD suppressed so party status does not duplicate the player HUD.
        if (ui.partyHud) ui.partyHud.style.display = 'none';
        if (ui.partyHudMeta) ui.partyHudMeta.textContent = 'Merged into player HUD';
        if (ui.partyHudMembers) {
          ui.partyHudMembers.innerHTML = '';
          ui.partyHudMembers.dataset.signature = '';
        }
        this.renderUnifiedCompanionHud?.(options);
      };

      Game.prototype.renderPartyPanel = function() {
        if (!ui.partyMembers || !this.player) return;
        this.normalizePartyState?.();
        this.pruneExpiredPartyInvites?.();
        const nearby = this.nearbyRemotePeers?.() || [];
        const syncText = this.multiplayerAvailable
          ? `Peer sync active · ${this.remotePlayers?.size || 0} tracked peer${(this.remotePlayers?.size || 0) === 1 ? '' : 's'} · ID ${String(this.localPeerId).slice(-7)}`
          : 'BroadcastChannel unavailable in this browser.';
        if (ui.multiplayerStatus) ui.multiplayerStatus.textContent = syncText;

        const rows = (this.getPartyRoster?.({ panel: true }) || []).map(member => this.partyMemberRow(member, member.local));
        const partyMax = this.partyMaxSize?.() || PARTY_MAX_SIZE;
        const capacityCount = this.partyCapacityCount?.() || rows.length;
        if (!this.partyId && rows.length === 1) rows.push(`<div class="small partyEmptyState">No party yet. Invite a nearby player or class bot. Party slots: ${capacityCount}/${partyMax}. Mercenaries and pets are auxiliary followers.</div>`);
        else rows.push(`<div class="partyRow partyControlRow"><div class="small">Party active · ${capacityCount}/${partyMax} player/bot slots used</div><button data-party-action="leave">Leave</button></div>`);
        ui.partyMembers.innerHTML = rows.join('');

        const nearbyRows = nearby
          .filter(peer => !this.partyMembers.has(peer.remoteId))
          .map(peer => `<div class="partyRow partyInviteRow"><div><strong>${escapeHtml(peer.name)}</strong><div class="small">Level ${Math.max(1, Math.floor(Number(peer.level) || 1))} ${escapeHtml(peer.className || 'Player')} · ${dist(peer, this.player).toFixed(1)} tiles${peer.pendingPartyInvite ? ' · invite sent' : ''}</div></div><span><button data-party-action="invite" data-peer-id="${escapeHtml(peer.remoteId)}" ${peer.pendingPartyInvite ? 'disabled' : ''}>Invite</button> <button data-party-action="trade" data-peer-id="${escapeHtml(peer.remoteId)}" ${this.activeTrade ? 'disabled' : ''}>Trade</button></span></div>`);
        if (ui.nearbyPlayers) ui.nearbyPlayers.innerHTML = nearbyRows.length ? nearbyRows.join('') : '<div class="small partyEmptyState">No nearby synced players. Open another tab/window with this file to test local multiplayer.</div>';

        if (ui.partyMercControls) {
          if (!this.merc) ui.partyMercControls.innerHTML = '<div class="small partyEmptyState">No active mercenary.</div>';
          else if (this.partyMercIncluded) ui.partyMercControls.innerHTML = `<div class="partyRow partyInviteRow"><div><strong>${escapeHtml(this.merc.name)}</strong><div class="small">Level ${this.merc.level} ${escapeHtml(this.merc.roleLabel || this.merc.roleKey || 'Mercenary')} · ${this.merc.alive ? 'active' : 'downed'}</div></div><button data-party-action="removeMerc">Remove Companion</button></div>`;
          else ui.partyMercControls.innerHTML = `<div class="partyRow partyInviteRow"><div><strong>${escapeHtml(this.merc.name)}</strong><div class="small">Level ${this.merc.level} ${escapeHtml(this.merc.roleLabel || this.merc.roleKey || 'Mercenary')}</div></div><button data-party-action="inviteMerc">Add Companion</button></div>`;
        }

        const inviteRows = Array.from(this.partyInvites.values()).map(invite => {
          const className = this.partyInviteClassName?.(invite) || 'Adventurer';
          const level = Math.max(1, Math.floor(Number(invite.fromLevel || invite.leaderLevel || 1)));
          const detail = invite.kind === 'bot_party'
            ? `Level ${level} ${escapeHtml(className)} · ${Math.max(1, Array.isArray(invite.botMemberIds) ? invite.botMemberIds.length : 1)} bot member${Array.isArray(invite.botMemberIds) && invite.botMemberIds.length === 1 ? '' : 's'}`
            : `Level ${level} ${escapeHtml(className)} party invite`;
          const emblem = DR.classEmblemMarkup?.(className, { size: 22, className: 'partyInlineInviteClassEmblem', title: `${className} emblem` }) || `<span class="partyInlineFallbackIcon">${escapeHtml(this.partyMemberIcon?.({ className }) || '●')}</span>`;
          return `<div class="partyRow partyInviteRow"><div class="partyInviteInlineIdentity"><span class="partyInviteInlineIcon">${emblem}</span><div><strong>${escapeHtml(invite.fromName)}</strong><div class="small">${detail}</div></div></div><span><button data-party-action="accept" data-invite-id="${escapeHtml(invite.id)}">Accept</button> <button data-party-action="decline" data-invite-id="${escapeHtml(invite.id)}">Decline</button></span></div>`;
        });
        // Phase 10 (Intersect parity): trade requests reuse this same invite
        // list rather than a second popup system. Owned/rendered by
        // systems/trade-system.js (tradeInviteRows) - this is only the
        // embed point, matching how partyInviteClassName above is already a
        // cross-reference into shared helpers.
        const tradeRows = this.tradeInviteRows?.() || [];
        const allInviteRows = [...inviteRows, ...tradeRows];
        if (ui.partyInvites) ui.partyInvites.innerHTML = allInviteRows.length ? allInviteRows.join('') : '<div class="small partyEmptyState">No pending invites.</div>';
        this.renderPartyInvitePopup?.();
        this.partyPanelDirty = false;
      };

      Game.prototype.partyCompanionCommandDefs = function(member = null) {
        const type = String(member?.type || member?.kind || '').toLowerCase();
        if (!['merc', 'bot'].includes(type)) return [];
        const base = [
          ['follow', 'Follow'],
          ['guard', 'Guard'],
          ['assist', 'Assist'],
          ['passive', 'Passive'],
          ['attack', 'Attack']
        ];
        if (type === 'merc') return base.filter(entry => ['follow', 'guard', 'assist', 'passive', 'attack'].includes(entry[0]));
        return base;
      };

      Game.prototype.partyCompanionActiveCommand = function(member = null) {
        const actor = member?.entity || null;
        const type = String(member?.type || actor?.kind || '').toLowerCase();
        if (type === 'bot') return String(actor?.botPartyCommand || actor?.commandState || actor?.command || member?.command || 'follow').toLowerCase().replace(/^party$/, 'follow');
        return String(actor?.command || member?.command || actor?.commandState || member?.commandState || 'assist').toLowerCase();
      };

      Game.prototype.partyCompanionCommandControls = function(member = null) {
        const actor = member?.entity || null;
        if (!member || !actor || !['merc', 'bot'].includes(String(member.type || '').toLowerCase())) return '';
        const defs = this.partyCompanionCommandDefs?.(member) || [];
        if (!defs.length) return '';
        const active = this.partyCompanionActiveCommand?.(member) || '';
        const id = escapeHtml(String(member.id || actor.botId || actor.remoteId || actor.id || ''));
        const buttons = defs.map(([value, label]) => {
          const selected = active === value || (value === 'follow' && active === 'party');
          return `<button type="button" data-party-action="companionCommand" data-party-member-id="${id}" data-command="${escapeHtml(value)}" class="${selected ? 'active' : ''}" aria-pressed="${selected ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
        }).join('');
        return `<div class="partyCompanionCommands" role="group" aria-label="Companion commands">${buttons}</div>`;
      };

      Game.prototype.handlePartyCompanionCommand = function(memberId, command) {
        const member = this.findPartyMemberById?.(memberId);
        const actor = member?.entity || null;
        const value = String(command || '').toLowerCase();
        if (!member || !actor || !['merc', 'bot'].includes(String(member.type || '').toLowerCase())) return false;
        if (member.type === 'merc') return this.setMercCommand?.(value) !== false;
        if (member.type === 'bot') return this.setBotCompanionCommand?.(actor, value, { source: 'party-panel' }) === true;
        return false;
      };

      Game.prototype.partyMemberRow = function(member, isLocal) {
        const cls = this.partyMemberClassLabel?.(member) || 'Member';
        const icon = this.partyMemberIcon?.(member) || '●';
        const className = member?.className || member?.entity?.className || (member?.type === 'pet' ? (member?.entity?.petType === 'undead' ? 'Necromancer' : 'Summoner') : cls);
        const portrait = DR.classEmblemMarkup?.(className, { size: 24, className: 'partyListClassEmblem', title: `${className} emblem` }) || `<span>${escapeHtml(icon)}</span>`;
        const hpPct = safePct(member.hp, member.maxHp);
        const mpPct = safePct(member.mana, member.maxMana);
        const transitionZone = member.entity?.zoneTransitionGrace > 0 ? String(member.entity?.zone || member.zone || '') : '';
        const state = transitionZone === 'dungeon' ? 'Entering Dungeon' : (transitionZone === 'cave' ? 'Entering Cave' : (transitionZone === 'overworld' ? 'Following' : aliveLabel(member)));
        const auxiliary = this.partyMemberConsumesSlot?.(member) === false;
        const leader = auxiliary ? 'Auxiliary' : (member.leader ? 'Leader' : (isLocal ? 'You' : 'Member'));
        const resourceLabel = this.actorResourceLabel?.(member) || 'Mana';
        const resourceKind = this.actorResourceBarKind?.(member) || 'mp';
        const manaLine = member.maxMana > 0 ? `<div class="partyHealth partyMana ${escapeHtml(resourceKind)}"><div style="width:${mpPct.toFixed(1)}%"></div><span>${partyHealthTextMarkup(resourceLabel, `${rounded(member.mana)}/${rounded(member.maxMana)}`)}</span></div>` : '';
        const slotNote = auxiliary ? ' · no party slot' : '';
        const commands = this.partyCompanionCommandControls?.(member) || '';
        const partyCardStyle = DR.partyClassCardStyle?.(className || cls) || '';
        const partyClassKey = DR.classEmblemMeta?.(className || cls)?.key || String(className || cls || 'member').toLowerCase();
        return `<div class="partyRow partyMemberListRow ${member.alive === false ? 'downed' : ''} ${auxiliary ? 'auxiliary' : ''}" data-party-class="${escapeHtml(partyClassKey)}" style="${partyCardStyle}"><div class="partyClassBackdrop" aria-hidden="true"></div><div class="partyListIdentity"><span class="partyListPortrait">${portrait}</span><div><strong>${escapeHtml(member.name)} - ${escapeHtml(cls)} - Level ${member.level}</strong><div class="small">${escapeHtml(leader)} · ${escapeHtml(state)}${escapeHtml(slotNote)}</div><div class="partyHealth"><div style="width:${hpPct.toFixed(1)}%"></div><span>${partyHealthTextMarkup('HP', `${rounded(member.hp)}/${rounded(member.maxHp)}`)}</span></div>${manaLine}${commands}</div></div></div>`;
      };

      Game.prototype.partyContextActionsAtWorld = function(world) {
        if (!world || !this.player) return [];
        const actions = [];
        const point = { x: Number(world.x), y: Number(world.y) };
        const nearbyPeer = Array.from(this.remotePlayers?.values?.() || [])
          .filter(peer => peer.zone === this.currentZone && dist(peer, point) <= PARTY_CONTEXT_PICK_RADIUS)
          .sort((a, b) => dist(a, point) - dist(b, point))[0];
        if (nearbyPeer) {
          const inParty = this.partyMembers?.has(nearbyPeer.remoteId);
          actions.push({
            title: nearbyPeer.name || 'Player',
            label: inParty ? 'Open Party Panel' : `Invite ${nearbyPeer.name || 'Player'} to Party`,
            run: () => inParty ? this.togglePartyPanel?.(true) : this.invitePeer?.(nearbyPeer.remoteId)
          });
        }
        if (this.merc && dist(this.merc, point) <= PARTY_CONTEXT_PICK_RADIUS) {
          actions.push({
            title: this.merc.name || 'Mercenary',
            label: this.partyMercIncluded ? 'Remove Merc Companion' : 'Add Merc Companion',
            run: () => this.partyMercIncluded ? this.removeMercFromParty?.() : this.inviteMercToParty?.()
          });
        }
        return actions;
      };
    }
  };
})();
