// Dream Realms local multiplayer runtime system
// Extracted from the V0.10.3 stable modular baseline without changing runtime behavior.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const { dist } = DR.utils;
  const CONFIG = DR.CONFIG;

  DR.MultiplayerSystem = {
    install(Game) {
      Game.prototype.setupMultiplayer = function() {
        this.multiplayerAvailable = typeof BroadcastChannel !== 'undefined';
        if (this.multiplayerAvailable) {
          this.peerChannel = new BroadcastChannel('dark-woods-rpg-v010-local-peers');
          this.peerChannel.onmessage = event => this.receiveMultiplayerMessage(event.data);
        }

        const announcePresence = () => this.broadcastLocalPeerState(true);
        window.addEventListener('focus', announcePresence);
        window.addEventListener('pageshow', announcePresence);
        document.addEventListener('visibilitychange', () => {
          announcePresence();
        });
        const handlePageExit = () => {
          if (this.pageExitCleanupSent) return;
          this.pageExitCleanupSent = true;
          if (typeof this.cleanupPartyForSessionEnd === 'function') {
            this.cleanupPartyForSessionEnd({ reason: 'browser-close', fromBeforeUnload: true, silent: true });
            try {
              if (this.started && this.player && typeof this.saveCharacterState === 'function') {
                this.saveCharacterState({ manual: true, silent: true, reason: 'browser-close' });
              } else if (typeof this.saveAccountsState === 'function') {
                this.saveAccountsState({ reason: 'browser-close', skipFolderWrite: true, silent: true });
              }
            } catch (_err) {}
          } else {
            this.broadcastMultiplayer({ type: 'leave' });
          }
          this.broadcastMultiplayer({ type: 'leave' });
        };
        window.addEventListener('beforeunload', handlePageExit);
        window.addEventListener('pagehide', handlePageExit);
      };

      Game.prototype.broadcastMultiplayer = function(payload) {
        if (!this.peerChannel) return;
        this.peerChannel.postMessage({
          protocol: 'dark-woods-local-v1',
          senderId: this.localPeerId,
          sentAt: Date.now(),
          ...payload
        });
      };

      Game.prototype.updateMultiplayer = function(dt) {
        if (!this.started || !this.player) return;

        this.multiplayerTimer -= dt;
        if (this.multiplayerTimer <= 0) {
          this.broadcastLocalPeerState();
          this.multiplayerTimer = CONFIG.MULTIPLAYER_SYNC_INTERVAL;
        }

        this.multiplayerPruneTimer -= dt;
        if (this.multiplayerPruneTimer <= 0) {
          this.pruneRemotePlayers();
          this.multiplayerPruneTimer = CONFIG.MULTIPLAYER_PRUNE_INTERVAL;
        }

        if (this.partyPanelDirty && this.partyOpen) this.renderPartyPanel();
      };

      Game.prototype.broadcastLocalPeerState = function(force = false) {
        if (!this.started || !this.player) return;
        this.broadcastMultiplayer({ type: 'state', force, peer: this.getLocalPeerState() });
      };

      Game.prototype.getLocalPeerState = function() {
        return {
          id: this.localPeerId,
          name: this.player.name,
          className: this.player.className,
          level: this.player.level,
          x: this.player.x,
          y: this.player.y,
          z: this.player.z || 0,
          vz: this.player.vz || 0,
          zone: this.currentZone,
          hp: this.player.hp,
          maxHp: this.player.maxHp,
          mana: this.player.mana,
          maxMana: this.player.maxMana,
          facingX: this.player.facingX,
          facingY: this.player.facingY,
          meditating: this.player.meditating,
          partyId: this.partyId,
          partyMembers: Array.from(this.partyMembers),
          partyLeaderId: this.partyLeaderId
        };
      };

      Game.prototype.receiveMultiplayerMessage = function(message) {
        if (!message || message.protocol !== 'dark-woods-local-v1' || message.senderId === this.localPeerId) return;
        if (message.type === 'state' && message.peer) this.receivePeerState(message.peer);
        else if (message.type === 'leave') this.removeRemotePeer(message.senderId);
        else if (message.type === 'partyInvite') this.receivePartyInvite(message);
        else if (message.type === 'partyAccept') this.receivePartyAccept(message);
        else if (message.type === 'partyUpdate') this.receivePartyUpdate(message);
        else if (message.type === 'partyLeave') this.receivePartyLeave(message);
        else if (message.type === 'partyDisband') this.receivePartyDisband?.(message);
        else if (message.type === 'partyCombatPing') this.receivePartyCombatPing?.(message);
        else if (message.type === 'partyReward') this.receivePartyReward?.(message);
        // Phase 10 (Intersect parity): local player-to-player trade, owned
        // by systems/trade-system.js - same dispatch pattern as the party
        // message types above.
        else if (message.type === 'tradeRequest') this.receiveTradeRequest?.(message);
        else if (message.type === 'tradeAccept') this.receiveTradeAccept?.(message);
        else if (message.type === 'tradeDecline') this.receiveTradeDecline?.(message);
        else if (message.type === 'tradeUpdate') this.receiveTradeUpdate?.(message);
        else if (message.type === 'tradeConfirm') this.receiveTradeConfirm?.(message);
        else if (message.type === 'tradeCancel') this.receiveTradeCancel?.(message);
      };

      Game.prototype.receivePeerState = function(peer) {
        if (!peer || !peer.id || peer.id === this.localPeerId) return;
        let remote = this.remotePlayers.get(peer.id);
        if (!remote) {
          remote = new RemotePlayer(peer);
          this.remotePlayers.set(peer.id, remote);
          this.entities.push(remote);
          this.log(`${remote.name} appeared nearby.`);
        } else {
          remote.applyState(peer);
          if (!this.entities.includes(remote)) this.entities.push(remote);
        }
        this.partyPanelDirty = true;
      };

      Game.prototype.pruneRemotePlayers = function() {
        const now = performance.now();
        for (const [id, peer] of this.remotePlayers) {
          if (now - peer.lastSeen > CONFIG.MULTIPLAYER_STALE_MS) this.removeRemotePeer(id);
        }
      };

      Game.prototype.removeRemotePeer = function(peerId) {
        const peer = this.remotePlayers.get(peerId);
        if (!peer) return;
        const normalizedId = String(peerId || '');
        const wasPartyLeader = normalizedId && String(this.partyLeaderId || '') === normalizedId && this.partyId && this.partyMembers?.has?.(normalizedId);
        this.remotePlayers.delete(peerId);
        this.entities = this.entities.filter(e => e !== peer);
        if (wasPartyLeader) {
          this.clearLocalPartyRuntimeState?.();
          this.logParty?.(`${peer.name || 'Party leader'} disconnected. Party disbanded.`);
          return;
        }
        this.partyMembers.delete(peerId);
        this.forgetPartyMemberOrder?.(peerId);
        this.partyPanelDirty = true;
      };

      Game.prototype.nearbyRemotePeers = function(radius = 16) {
        if (!this.player) return [];
        return Array.from(this.remotePlayers.values())
          .filter(peer => peer.zone === this.currentZone && dist(peer, this.player) <= radius)
          .sort((a, b) => dist(a, this.player) - dist(b, this.player));
      };
    }
  };
})();
