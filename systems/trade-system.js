// Dream Realms local player-to-player trade system
// Phase 10 (Intersect parity): request/accept/offer/confirm/execute trade
// flow between two local BroadcastChannel peers, modeled on the existing
// party-invite request/accept pattern (systems/party-system.js) and reusing
// the same shared transport (Game.prototype.broadcastMultiplayer, owned by
// systems/multiplayer-system.js) rather than inventing a second one.
//
// Scope (see docs/PHASE_7_CLASS_STAT_INVENTORY_AUDIT.txt): this project has
// no authoritative server anywhere (confirmed in the Phase 0 audit) - every
// existing multiplayer feature (party rewards, combat pings) is trust-on-
// receipt between tabs. This trade system follows the same trust model: it
// does not attempt server-style validation that doesn't exist elsewhere in
// the project. To stay safe within that model it:
//   - never locks/removes an offered item from inventory until BOTH sides
//     have confirmed, so cancelling (or one tab closing) at any point before
//     that is always a true no-op;
//   - re-validates at confirm time (by stable item id) that every item you
//     offered still exists in your own inventory, so using/dropping/
//     equipping an offered item mid-negotiation fails the trade safely
//     instead of duplicating or losing anything;
//   - only ever executes a given tradeId's exchange once (the `executed`
//     flag), guarding against a duplicate tradeConfirm broadcast.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  const TRADE_RADIUS = 8;
  const TRADE_OFFER_MAX = 24;

  DR.TradeSystem = {
    install(Game) {
      const ui = DR.ui;
      const { dist } = DR.utils;

      Game.prototype.ensureTradeSystem = function() {
        if (!(this.tradeInvites instanceof Map)) this.tradeInvites = new Map();
        if (!(this.outgoingTradeRequests instanceof Map)) this.outgoingTradeRequests = new Map();
      };

      Game.prototype.requestTrade = function(peerId) {
        this.ensureTradeSystem();
        const peer = this.remotePlayers?.get(peerId);
        if (!peer) { this.log?.('That player is no longer nearby.'); return false; }
        if (peer.zone !== this.currentZone) { this.log?.(`${peer.name} is in another zone.`); return false; }
        if (dist(peer, this.player) > TRADE_RADIUS) { this.log?.(`${peer.name} is too far away to trade.`); return false; }
        if (this.activeTrade) { this.log?.('Finish or cancel your current trade first.'); return false; }
        const tradeId = `trade:${this.localPeerId}:${Date.now()}`;
        this.outgoingTradeRequests.set(peerId, tradeId);
        this.broadcastMultiplayer?.({ type: 'tradeRequest', targetId: peerId, tradeId, fromName: this.player?.name || 'Player' });
        this.log?.(`Trade request sent to ${peer.name}.`);
        return true;
      };

      Game.prototype.receiveTradeRequest = function(message) {
        this.ensureTradeSystem();
        if (message.targetId !== this.localPeerId) return;
        if (this.activeTrade) {
          this.broadcastMultiplayer?.({ type: 'tradeDecline', targetId: message.senderId, tradeId: message.tradeId, reason: 'busy' });
          return;
        }
        this.tradeInvites.set(message.tradeId, { id: message.tradeId, fromId: message.senderId, fromName: message.fromName || 'Player', receivedAt: Date.now() });
        this.log?.(`${message.fromName || 'A player'} wants to trade.`);
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
      };

      Game.prototype.acceptTradeInvite = function(tradeId) {
        this.ensureTradeSystem();
        const invite = this.tradeInvites.get(tradeId);
        if (!invite) return false;
        this.tradeInvites.delete(tradeId);
        if (this.activeTrade) { this.log?.('Finish or cancel your current trade first.'); return false; }
        this.activeTrade = {
          tradeId, peerId: invite.fromId, peerName: invite.fromName,
          myOffer: [], theirOffer: [], myConfirmed: false, theirConfirmed: false, executed: false
        };
        this.broadcastMultiplayer?.({ type: 'tradeAccept', targetId: invite.fromId, tradeId });
        this.openTradeWindow();
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        return true;
      };

      Game.prototype.declineTradeInvite = function(tradeId) {
        this.ensureTradeSystem();
        const invite = this.tradeInvites.get(tradeId);
        if (!invite) return false;
        this.tradeInvites.delete(tradeId);
        this.broadcastMultiplayer?.({ type: 'tradeDecline', targetId: invite.fromId, tradeId });
        this.partyPanelDirty = true;
        this.renderPartyPanel?.();
        return true;
      };

      Game.prototype.tradeInviteRows = function() {
        this.ensureTradeSystem();
        return Array.from(this.tradeInvites.values()).map(invite => (
          `<div class="partyRow partyInviteRow"><div><strong>${escapeHtml(invite.fromName)}</strong><div class="small">Trade request</div></div><span><button data-party-action="acceptTrade" data-invite-id="${escapeHtml(invite.id)}">Accept</button> <button data-party-action="declineTrade" data-invite-id="${escapeHtml(invite.id)}">Decline</button></span></div>`
        ));
      };

      Game.prototype.receiveTradeAccept = function(message) {
        this.ensureTradeSystem();
        if (message.targetId !== this.localPeerId) return;
        const matchedPeerId = this.outgoingTradeRequests.get(message.senderId) === message.tradeId ? message.senderId : null;
        if (!matchedPeerId) return;
        this.outgoingTradeRequests.delete(matchedPeerId);
        if (this.activeTrade) return;
        const peer = this.remotePlayers?.get(matchedPeerId);
        this.activeTrade = {
          tradeId: message.tradeId, peerId: matchedPeerId, peerName: peer?.name || 'Player',
          myOffer: [], theirOffer: [], myConfirmed: false, theirConfirmed: false, executed: false
        };
        this.log?.(`${peer?.name || 'Player'} accepted your trade request.`);
        this.openTradeWindow();
      };

      Game.prototype.receiveTradeDecline = function(message) {
        this.ensureTradeSystem();
        if (message.targetId !== this.localPeerId) return;
        if (this.outgoingTradeRequests.get(message.senderId) === message.tradeId) this.outgoingTradeRequests.delete(message.senderId);
        const peer = this.remotePlayers?.get(message.senderId);
        this.log?.(`${peer?.name || 'Player'} declined the trade.`);
      };

      Game.prototype.addItemToTradeOffer = function(inventoryIndex) {
        const trade = this.activeTrade;
        if (!trade || trade.executed) return false;
        const item = this.inventory?.[inventoryIndex];
        if (!item) return false;
        if (this.isItemDropProtected?.(item)) {
          this.log?.(`${item.name} cannot be traded.`, 'System');
          return false;
        }
        if (trade.myOffer.length >= TRADE_OFFER_MAX) {
          this.log?.('Trade offer is full.', 'System');
          return false;
        }
        if (trade.myOffer.some(entry => entry.id === item.id)) return false;
        const snapshot = this.cloneItemForWorldDrop ? this.cloneItemForWorldDrop(item) : JSON.parse(JSON.stringify(item));
        trade.myOffer.push(snapshot);
        trade.myConfirmed = false;
        trade.theirConfirmed = false;
        this.broadcastTradeOffer();
        this.renderTradeWindow();
        return true;
      };

      Game.prototype.removeItemFromTradeOffer = function(offerIndex) {
        const trade = this.activeTrade;
        if (!trade || trade.executed || !trade.myOffer[offerIndex]) return false;
        trade.myOffer.splice(offerIndex, 1);
        trade.myConfirmed = false;
        trade.theirConfirmed = false;
        this.broadcastTradeOffer();
        this.renderTradeWindow();
        return true;
      };

      Game.prototype.broadcastTradeOffer = function() {
        const trade = this.activeTrade;
        if (!trade) return;
        this.broadcastMultiplayer?.({ type: 'tradeUpdate', targetId: trade.peerId, tradeId: trade.tradeId, offer: trade.myOffer });
      };

      Game.prototype.receiveTradeUpdate = function(message) {
        const trade = this.activeTrade;
        if (!trade || trade.executed || trade.tradeId !== message.tradeId || message.senderId !== trade.peerId) return;
        trade.theirOffer = Array.isArray(message.offer) ? message.offer.slice(0, TRADE_OFFER_MAX) : [];
        trade.theirConfirmed = false;
        trade.myConfirmed = false;
        this.renderTradeWindow();
      };

      Game.prototype.confirmTradeOffer = function() {
        const trade = this.activeTrade;
        if (!trade || trade.executed) return false;
        trade.myConfirmed = true;
        this.broadcastMultiplayer?.({ type: 'tradeConfirm', targetId: trade.peerId, tradeId: trade.tradeId });
        this.renderTradeWindow();
        this.tryExecuteTrade();
        return true;
      };

      Game.prototype.receiveTradeConfirm = function(message) {
        const trade = this.activeTrade;
        if (!trade || trade.executed || trade.tradeId !== message.tradeId || message.senderId !== trade.peerId) return;
        trade.theirConfirmed = true;
        this.renderTradeWindow();
        this.tryExecuteTrade();
      };

      Game.prototype.tryExecuteTrade = function() {
        const trade = this.activeTrade;
        if (!trade || trade.executed || !trade.myConfirmed || !trade.theirConfirmed) return false;
        trade.executed = true;
        const capacity = this.getBagCapacity ? this.getBagCapacity() : (DR.CONFIG?.BAG_SIZE || 36);
        const myIndices = trade.myOffer.map(entry => (this.inventory || []).findIndex(item => item && item.id === entry.id));
        if (myIndices.some(index => index === -1)) {
          this.log?.('Trade failed: an offered item is no longer available.', 'System');
          this.cancelTrade('item-missing');
          return false;
        }
        const projectedCount = (this.inventory.length - myIndices.length) + trade.theirOffer.length;
        if (projectedCount > capacity) {
          this.log?.('Trade failed: not enough bag space.', 'System');
          this.cancelTrade('no-space');
          return false;
        }
        [...myIndices].sort((a, b) => b - a).forEach(index => this.inventory.splice(index, 1));
        for (const entry of trade.theirOffer) {
          const clone = JSON.parse(JSON.stringify(entry));
          clone.id = this.itemSerial++;
          this.inventory.push(clone);
        }
        this.log?.(`Trade with ${trade.peerName} complete.`, 'System');
        this.bagDirty = true;
        if (this.bagOpen) this.renderBag?.();
        this.updateUI?.();
        this.closeTradeWindow();
        this.activeTrade = null;
        return true;
      };

      Game.prototype.cancelTrade = function(reason = 'cancelled') {
        const trade = this.activeTrade;
        if (!trade) return false;
        if (!trade.executed) this.broadcastMultiplayer?.({ type: 'tradeCancel', targetId: trade.peerId, tradeId: trade.tradeId, reason });
        this.activeTrade = null;
        this.closeTradeWindow();
        this.log?.('Trade cancelled.', 'System');
        return true;
      };

      Game.prototype.receiveTradeCancel = function(message) {
        const trade = this.activeTrade;
        if (!trade || trade.tradeId !== message.tradeId || message.senderId !== trade.peerId) return;
        const peerName = trade.peerName || 'Player';
        this.activeTrade = null;
        this.closeTradeWindow();
        this.log?.(`${peerName} cancelled the trade.`, 'System');
      };

      Game.prototype.openTradeWindow = function() {
        if (!ui?.tradePanel) return;
        ui.tradePanel.style.display = 'block';
        this.renderTradeWindow();
      };

      Game.prototype.closeTradeWindow = function() {
        if (ui?.tradePanel) ui.tradePanel.style.display = 'none';
      };

      Game.prototype.renderTradeWindow = function() {
        const trade = this.activeTrade;
        if (!ui?.tradePanel) return;
        if (!trade) { this.closeTradeWindow(); return; }
        if (ui.tradePeerName) ui.tradePeerName.textContent = `Trading with ${trade.peerName || 'Player'}`;
        const renderSide = (items, removable) => (items.length ? items.map((item, index) => {
          const icon = this.itemIconHtml ? this.itemIconHtml(item, 'inventoryIcon') : '';
          const stackText = item.maxStack ? `${item.stack || 1}/${item.maxStack}` : `${item.stack || 1}`;
          const removeBtn = removable ? `<button data-trade-remove-index="${index}" title="Remove from offer">x</button>` : '';
          return `<div class="bagSlot itemSlot">${icon}<span class="itemName">${escapeHtml(item.name || '')}</span><span class="stackBadge">${escapeHtml(stackText)}</span>${removeBtn}</div>`;
        }).join('') : '<div class="small">No items offered.</div>');
        if (ui.tradeMyOffer) ui.tradeMyOffer.innerHTML = renderSide(trade.myOffer, true);
        if (ui.tradeTheirOffer) ui.tradeTheirOffer.innerHTML = renderSide(trade.theirOffer, false);
        if (ui.tradeMyStatus) ui.tradeMyStatus.textContent = trade.myConfirmed ? 'You: Confirmed' : 'You: Not confirmed';
        if (ui.tradeTheirStatus) ui.tradeTheirStatus.textContent = trade.theirConfirmed ? `${trade.peerName}: Confirmed` : `${trade.peerName}: Not confirmed`;
        ui.tradeMyOffer?.querySelectorAll('[data-trade-remove-index]').forEach(btn => {
          btn.addEventListener('click', () => this.removeItemFromTradeOffer(Number(btn.dataset.tradeRemoveIndex)));
        });
      };
    }
  };
})();
