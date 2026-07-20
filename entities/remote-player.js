(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.entities = DR.entities || {};
  const { CONFIG, CLASSES } = DR;
  const { Entity } = DR.entities;
  const { lerp } = DR.utils;

class RemotePlayer extends Entity {
    constructor(peer) {
      super(peer.name || 'Remote Player', peer.x || CONFIG.START_X + 0.5, peer.y || CONFIG.START_Y + 0.5, {
        hp: peer.maxHp || 100,
        mana: peer.maxMana || 0,
        attack: 0,
        defense: 0,
        speed: CONFIG.BASE_MOVE_SPEED,
        color: CLASSES[peer.className]?.color || '#eef8dc',
        kind: 'remote'
      });
      this.remoteId = peer.id;
      this.className = peer.className || 'Fighter';
      this.level = peer.level || 1;
      this.targetX = this.x;
      this.targetY = this.y;
      this.zone = peer.zone || 'overworld';
      this.lastSeen = performance.now();
      this.partyId = peer.partyId || null;
      this.applyState(peer);
    }
  
    applyState(peer) {
      this.name = peer.name || this.name;
      this.className = peer.className || this.className;
      this.level = peer.level || this.level;
      this.targetX = Number.isFinite(peer.x) ? peer.x : this.targetX;
      this.targetY = Number.isFinite(peer.y) ? peer.y : this.targetY;
      this.zone = peer.zone || this.zone;
      this.z = Number.isFinite(peer.z) ? Math.max(0, peer.z) : this.z;
      this.vz = Number.isFinite(peer.vz) ? peer.vz : this.vz;
      this.hp = peer.hp ?? this.hp;
      this.maxHp = peer.maxHp ?? this.maxHp;
      this.mana = peer.mana ?? this.mana;
      this.maxMana = peer.maxMana ?? this.maxMana;
      this.meditating = !!peer.meditating;
      this.partyId = peer.partyId || null;
      if (Number.isFinite(peer.facingX) && Number.isFinite(peer.facingY)) this.setFacingFromDelta(peer.facingX, peer.facingY);
      this.lastSeen = performance.now();
    }
  
    update(game, dt) {
      this.updateBase(dt);
      const ox = this.x;
      const oy = this.y;
      this.x = lerp(this.x, this.targetX, Math.min(1, dt * 12));
      this.y = lerp(this.y, this.targetY, Math.min(1, dt * 12));
      const dx = this.x - ox;
      const dy = this.y - oy;
      const d = Math.hypot(dx, dy);
      if (d > 0.0002) {
        this.moveBlend = Math.min(1, Math.max(this.moveBlend || 0, 0.85));
        this.walkCycle = (this.walkCycle || 0) + d * 30;
        this.setFacingFromDelta(dx, dy);
      }
    }
  }
  

  DR.entities.RemotePlayer = RemotePlayer;
  DR.RemotePlayer = RemotePlayer;
})();
