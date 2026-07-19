// Dream Realms V0.15.47: DPS meter Add-Ons settings category and no-scroll party display.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.systems = DR.systems || {};

  const STORAGE_PREFIX = 'dreamRealmsDpsMeter';
  const WINDOW_OPTIONS = Object.freeze([10, 30, 0]);
  const CLASS_COLORS = Object.freeze({
    fighter: '#d96f4c', warrior: '#d96f4c', rogue: '#d8d86c', bard: '#d06fd9',
    druid: '#77d66a', cleric: '#e8df9c', summoner: '#69c8e8', enchanter: '#b98cff',
    necromancer: '#9ed48c', mercenary: '#70a5ff', pet: '#c6d8a8', player: '#dfe8ff', bot: '#88d6ff'
  });

  function nowMs() { try { return performance.now(); } catch (_err) { return Date.now ? Date.now() : 0; } }
  function num(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max, fallback = min) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function storageGet(key, fallback = '') { try { const v = window.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; } }
  function storageSet(key, value) { try { window.localStorage?.setItem?.(key, String(value)); } catch (_err) {} }
  function storageJson(key, fallback) { try { const raw = window.localStorage?.getItem?.(key); return raw ? JSON.parse(raw) : fallback; } catch (_err) { return fallback; } }
  function writeJson(key, value) { try { window.localStorage?.setItem?.(key, JSON.stringify(value)); } catch (_err) {} }
  function actorAlive(actor) { return !!(actor && actor.alive !== false); }
  function cleanName(name, fallback = 'Unknown') { return String(name || fallback).replace(/\s+\((You|Bot|Merc|Pet)\)$/i, '').trim() || fallback; }
  function classKey(className) { return String(className || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'player'; }
  function classColor(className, type = '') { return CLASS_COLORS[classKey(className)] || CLASS_COLORS[String(type || '').toLowerCase()] || CLASS_COLORS.player; }
  function windowLabel(seconds) { return Number(seconds) <= 0 ? 'Current Fight' : `Last ${Math.round(seconds)}s`; }
  function formatNumber(value) { return Math.round(num(value, 0)).toLocaleString(); }
  function formatDps(value) { return Math.round(num(value, 0)).toLocaleString(); }

  function eventTargetKey(target) {
    if (!target) return 'unknown-target';
    return `target:${target.id || target.name || 'unknown'}`;
  }

  class DpsMeterSystem {
    constructor(game) {
      this.game = game;
      const cfg = this.settings();
      this.visible = storageGet(`${STORAGE_PREFIX}:visible`, cfg.dpsMeterDefaultVisible ? '1' : '0') === '1';
      const storedWindow = Number(storageGet(`${STORAGE_PREFIX}:windowSeconds`, cfg.dpsMeterDefaultWindowSeconds || 10));
      this.windowSeconds = WINDOW_OPTIONS.includes(storedWindow) ? storedWindow : 10;
      this.events = [];
      this.totalByOwner = new Map();
      this.totalByTarget = new Map();
      this.fightStartedAt = 0;
      this.lastDamageAt = 0;
      this.dirty = true;
      this.lastRenderAt = 0;
      this.panel = null;
      this.lastSnapshot = { rows: [], targets: [], overallTotal: 0 };
      this.applyStoredWindowGeometry();
      this.injectStyles();
      if (this.visible) this.ensurePanel();
    }

    settings() { return this.game?.performanceSettings?.() || DR.CONFIG?.PERFORMANCE || {}; }

    applyStoredWindowGeometry() {
      const geo = storageJson(`${STORAGE_PREFIX}:geometry`, null);
      this.geometry = geo && typeof geo === 'object' ? geo : { right: 18, bottom: 112, width: 360, height: 180 };
    }

    persistGeometry() {
      const panel = this.panel;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 720;
      this.geometry = {
        left: Math.max(0, Math.round(rect.left)),
        top: Math.max(0, Math.round(rect.top)),
        width: Math.max(280, Math.round(rect.width)),
        height: Math.max(118, Math.round(rect.height)),
        right: Math.max(0, Math.round(vw - rect.right)),
        bottom: Math.max(0, Math.round(vh - rect.bottom))
      };
      writeJson(`${STORAGE_PREFIX}:geometry`, this.geometry);
    }

    injectStyles() {
      if (document.getElementById('dpsMeterStyles')) return;
      const style = document.createElement('style');
      style.id = 'dpsMeterStyles';
      style.textContent = `
        #dpsMeterWindow { position: fixed; z-index: 54; min-width: 320px; min-height: 118px; resize: both; overflow: hidden; box-sizing: border-box; }
        #dpsMeterWindow .dpsBody { height: auto; max-height: none; overflow: visible; padding: 6px 8px 8px; box-sizing: border-box; }
        #dpsMeterWindow .dpsHeader { display:flex; align-items:center; justify-content:space-between; gap:8px; cursor: move; user-select:none; min-height:28px; }
        #dpsMeterWindow .dpsHeaderTitle { font-weight:700; letter-spacing:.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        #dpsMeterWindow .dpsControls { display:flex; flex-wrap:nowrap; gap:5px; margin-bottom:5px; align-items:center; white-space:nowrap; }
        #dpsMeterWindow .dpsControls button, #dpsMeterWindow .dpsControls select { font-size:11px; padding:2px 5px; }
        #dpsMeterWindow .dpsRows { display:block; }
        #dpsMeterWindow .dpsRow { border:1px solid rgba(255,255,255,.12); background:rgba(3,8,14,.56); border-radius:6px; padding:4px 6px; margin:3px 0; min-height:22px; }
        #dpsMeterWindow .dpsRow.topDps { border-color:rgba(255,216,106,.85); box-shadow:0 0 9px rgba(255,216,106,.16) inset; }
        #dpsMeterWindow .dpsRowMain { display:grid; grid-template-columns:minmax(0, 1fr) auto auto; align-items:center; gap:6px; line-height:1.2; }
        #dpsMeterWindow .dpsRankName { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        #dpsMeterWindow .dpsValue, #dpsMeterWindow .dpsTotal { font-weight:700; white-space:nowrap; }
        #dpsMeterWindow .dpsTotal { opacity:.86; font-size:11px; }
        #dpsMeterWindow .dpsBreakdown, #dpsMeterWindow .dpsTargets, #dpsMeterWindow .dpsMeta { font-size:10.5px; opacity:.82; margin-top:2px; line-height:1.25; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        #dpsMeterWindow .dpsBar { height:3px; border-radius:999px; background:rgba(255,255,255,.12); overflow:hidden; margin-top:3px; }
        #dpsMeterWindow .dpsBarFill { height:100%; width:0%; background:currentColor; opacity:.85; }
        #dpsMeterWindow.dpsCompact { font-size:11px; }
        #dpsMeterWindow.dpsCompact .dpsHeader { min-height:24px; }
        #dpsMeterWindow.dpsCompact .dpsControls { margin-bottom:3px; gap:3px; }
        #dpsMeterWindow.dpsCompact .dpsControls button, #dpsMeterWindow.dpsCompact .dpsControls select { font-size:10px; padding:1px 4px; }
        #dpsMeterWindow.dpsCompact .dpsRow { padding:2px 5px; margin:2px 0; min-height:18px; }
        #dpsMeterWindow.dpsCompact .dpsBreakdown, #dpsMeterWindow.dpsCompact .dpsTargets, #dpsMeterWindow.dpsCompact .dpsMeta, #dpsMeterWindow.dpsCompact .dpsBar { display:none; }
        #dpsMeterWindow.dpsTiny { font-size:10px; }
        #dpsMeterWindow.dpsTiny .dpsRow { padding:1px 4px; margin:1px 0; min-height:16px; }
        .settingsRow .dpsWindowButton.active { color:#f3df9a; border-color:#d6b35a; }
      `;
      document.head.appendChild(style);
    }

    ensurePanel() {
      if (this.panel && document.body.contains(this.panel)) return this.panel;
      this.injectStyles();
      let panel = document.getElementById('dpsMeterWindow');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'dpsMeterWindow';
        panel.className = 'panel gameWindow dpsMeterPanel';
        panel.dataset.uiWindowId = 'dpsMeterWindow';
        panel.innerHTML = `<div class="panelTitle dpsHeader" data-window-drag-handle><span class="dpsHeaderTitle">DPS Meter</span><button type="button" data-dps-close>Close</button></div><div class="dpsBody" data-dps-body></div>`;
        document.body.appendChild(panel);
        panel.querySelector('[data-dps-close]')?.addEventListener('click', () => this.setVisible(false));
        const saveGeo = () => this.persistGeometry();
        panel.addEventListener('pointerup', saveGeo);
        panel.addEventListener('mouseup', saveGeo);
        panel.addEventListener('resize', saveGeo);
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.persistGeometry()) : null;
        try { observer?.observe(panel); } catch (_err) {}
      }
      this.panel = panel;
      const geo = this.geometry || {};
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 720;
      const width = clamp(geo.width, 280, Math.max(280, vw - 16), 360);
      const height = clamp(geo.height, 118, Math.max(118, vh - 16), 180);
      const left = Number.isFinite(Number(geo.left)) ? clamp(geo.left, 0, Math.max(0, vw - width), Math.max(12, vw - width - 18)) : Math.max(12, vw - width - num(geo.right, 18));
      const top = Number.isFinite(Number(geo.top)) ? clamp(geo.top, 0, Math.max(0, vh - height), Math.max(12, vh - height - num(geo.bottom, 112))) : Math.max(12, vh - height - num(geo.bottom, 112));
      panel.style.width = `${Math.round(width)}px`;
      panel.style.height = `${Math.round(height)}px`;
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.display = this.visible ? 'block' : 'none';
      this.game?.installMovableUiWindows?.();
      this.render(true);
      return panel;
    }

    fitPanelToRows(snapshot) {
      if (!this.panel || !snapshot || this.settings().dpsMeterAutoFitHeight === false) return;
      const panel = this.panel;
      const rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
      const rowCount = rows.length || 1;
      const vh = window.innerHeight || 720;
      const vw = window.innerWidth || 1280;
      const maxRatio = clamp(this.settings().dpsMeterMaxScreenHeightRatio ?? 0.92, 0.45, 0.98, 0.92);
      const maxHeight = Math.max(118, Math.floor(vh * maxRatio));
      const compact = rowCount > 5 || (panel.getBoundingClientRect().height || 0) > maxHeight;
      const tiny = rowCount > 9;
      panel.classList.toggle('dpsCompact', compact);
      panel.classList.toggle('dpsTiny', tiny);
      const headerHeight = tiny ? 24 : (compact ? 26 : 30);
      const controlsHeight = tiny ? 20 : (compact ? 22 : 26);
      const rowHeight = tiny ? 18 : (compact ? 22 : 31);
      const metaHeight = tiny ? 12 : (compact ? 16 : 38);
      const desiredHeight = clamp(headerHeight + controlsHeight + rowCount * rowHeight + metaHeight + 18, 118, maxHeight, 180);
      const desiredWidth = clamp(this.geometry?.width || panel.getBoundingClientRect().width || 360, 320, Math.max(320, vw - 16), 360);
      panel.style.width = `${Math.round(desiredWidth)}px`;
      panel.style.height = `${Math.round(desiredHeight)}px`;
      const rect = panel.getBoundingClientRect();
      if (rect.bottom > vh - 8) panel.style.top = `${Math.max(8, Math.round(vh - desiredHeight - 8))}px`;
      if (rect.right > vw - 8) panel.style.left = `${Math.max(8, Math.round(vw - desiredWidth - 8))}px`;
    }

    setVisible(visible) {
      this.visible = !!visible;
      storageSet(`${STORAGE_PREFIX}:visible`, this.visible ? '1' : '0');
      const panel = this.ensurePanel();
      if (panel) panel.style.display = this.visible ? 'block' : 'none';
      this.dirty = true;
      if (this.visible) this.render(true);
      this.game?.renderSettingsPanel?.();
      return this.visible;
    }

    toggleVisible() { return this.setVisible(!this.visible); }

    setWindowSeconds(seconds) {
      const n = Number(seconds);
      this.windowSeconds = WINDOW_OPTIONS.includes(n) ? n : 10;
      storageSet(`${STORAGE_PREFIX}:windowSeconds`, this.windowSeconds);
      this.dirty = true;
      this.render(true);
      this.game?.renderSettingsPanel?.();
      return this.windowSeconds;
    }

    reset(reason = 'manual reset') {
      this.events.length = 0;
      this.totalByOwner.clear();
      this.totalByTarget.clear();
      this.fightStartedAt = 0;
      this.lastDamageAt = 0;
      this.lastSnapshot = { rows: [], targets: [], overallTotal: 0, reason };
      this.dirty = true;
      this.render(true);
      return true;
    }

    actorKey(actor, forcedType = '') {
      const type = String(forcedType || actor?.kind || 'player').toLowerCase();
      if (actor === this.game?.player || type === 'player' && !actor?.remoteId) return `player:${this.game?.localPeerId || actor?.id || 'local'}`;
      if (type === 'bot') return `bot:${actor?.botId || actor?.remoteId || actor?.id || actor?.name || 'bot'}`;
      if (type === 'remote') return `player:${actor?.remoteId || actor?.id || actor?.name || 'remote'}`;
      return `${type}:${actor?.id || actor?.botId || actor?.remoteId || actor?.name || 'unknown'}`;
    }

    findPetOwner(source) {
      if (!source) return null;
      if (source.owner) return source.owner;
      if (source === this.game?.pet) return this.game?.player || null;
      for (const bot of this.game?.botPlayers || []) if (bot?.botPet === source || String(bot?.botPetId || '') === String(source.id || source.name || '')) return bot;
      return this.game?.player || null;
    }

    findMercOwner(source) {
      if (!source) return null;
      if (source.owner) return source.owner;
      if (source === this.game?.merc) return this.game?.player || null;
      return this.game?.player || null;
    }


    actorIsEligibleForDps(actor, ownerKind = '') {
      if (!actor) return false;
      if (actor === this.game?.player) return actor.alive !== false;
      const kind = String(ownerKind || actor.kind || '').toLowerCase();
      if (actor.alive === false || actor.hidden === true || actor.renderable === false || actor.botState === 'dismissed' || actor.botState === 'despawned') return false;
      const currentZone = String(this.game?.currentZone || 'overworld');
      const zone = String(actor.zone || currentZone);
      if (zone !== currentZone) return false;
      const x = Number(actor.x);
      const y = Number(actor.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (kind === 'bot' && typeof this.game?.isBotValidForDps === 'function') return this.game.isBotValidForDps(actor) === true;
      const size = Math.max(1, Math.floor(Number(this.game?.activeMapSize?.() || DR.CONFIG?.MAP_SIZE || 200)));
      if (x < 0.5 || y < 0.5 || x > size - 1.5 || y > size - 1.5) return false;
      return true;
    }

    forgetContributorKey(key, reason = 'stale contributor') {
      if (!key) return false;
      const normalized = String(key);
      let changed = false;
      if (this.totalByOwner.delete(normalized)) changed = true;
      const before = this.events.length;
      this.events = this.events.filter(event => String(event.ownerKey) !== normalized);
      if (this.events.length !== before) changed = true;
      if (changed) {
        this.dirty = true;
        this.lastSnapshot = { rows: [], targets: [], overallTotal: 0, reason };
      }
      return changed;
    }

    forgetContributorForActor(actor, reason = 'actor removed') {
      if (!actor) return false;
      const ids = new Set();
      const kind = String(actor.kind || '').toLowerCase();
      ids.add(this.actorKey(actor, kind || 'bot'));
      if (actor.botId) ids.add(`bot:${actor.botId}`);
      if (actor.remoteId) ids.add(`${kind || 'bot'}:${actor.remoteId}`);
      if (actor.id) ids.add(`${kind || 'bot'}:${actor.id}`);
      if (actor.name) ids.add(`${kind || 'bot'}:${actor.name}`);
      let changed = false;
      for (const key of ids) if (this.forgetContributorKey(key, reason)) changed = true;
      return changed;
    }

    pruneInvalidContributors(reason = 'dps prune') {
      let changed = false;
      for (const [key, entry] of Array.from(this.totalByOwner.entries())) {
        if (!this.actorIsEligibleForDps(entry.actor, entry.ownerKind)) {
          this.totalByOwner.delete(key);
          changed = true;
        }
      }
      const before = this.events.length;
      this.events = this.events.filter(event => this.totalByOwner.has(event.ownerKey));
      if (this.events.length !== before) changed = true;
      if (changed) {
        this.dirty = true;
        this.lastSnapshot = { rows: [], targets: [], overallTotal: 0, reason };
      }
      return changed;
    }

    contributorFor(source, options = {}) {
      if (!source || String(source.kind || '').toLowerCase() === 'enemy') return null;
      const kind = String(source.kind || 'player').toLowerCase();
      let owner = source;
      let contribution = options.isPeriodic ? 'dot' : 'direct';
      if (kind === 'pet') { owner = this.findPetOwner(source); contribution = 'pet'; }
      else if (kind === 'merc') { owner = this.findMercOwner(source); contribution = 'merc'; }
      else if (options.isPeriodic) contribution = 'dot';
      if (!owner) return null;
      const ownerKind = owner === this.game?.player ? 'player' : String(owner.kind || 'player').toLowerCase();
      if (!['player', 'bot', 'remote'].includes(ownerKind) && owner !== this.game?.player) return null;
      if (!this.actorIsEligibleForDps(owner, ownerKind)) return null;
      const key = this.actorKey(owner, ownerKind);
      const className = owner.className || owner.roleLabel || owner.roleKey || (ownerKind === 'bot' ? 'Bot' : 'Player');
      const isLocal = owner === this.game?.player;
      return {
        key,
        owner,
        ownerKind,
        contribution,
        name: isLocal ? 'You' : cleanName(owner.name, ownerKind === 'bot' ? 'Bot' : 'Player'),
        className,
        role: owner.roleLabel || owner.roleKey || '',
        color: classColor(className, ownerKind)
      };
    }

    recordDamageEvent(event = {}) {
      if (this.settings().enableDpsMeter === false) return 0;
      const amount = Math.max(0, Math.floor(num(event.amount ?? event.damage, 0)));
      if (amount <= 0) return 0;
      const target = event.target || null;
      const source = event.source || null;
      const contributor = this.contributorFor(source, event);
      if (!contributor) return 0;
      const t = nowMs();
      if (!this.fightStartedAt) this.fightStartedAt = t;
      this.lastDamageAt = t;
      const targetKey = eventTargetKey(target);
      const targetName = cleanName(target?.name || target?.baseType?.name, 'Target');
      const targetEntry = this.totalByTarget.get(targetKey) || { key: targetKey, name: targetName, total: 0, boss: !!(target?.dungeonBoss || target?.boss || target?.elite), lastAt: t };
      targetEntry.total += amount;
      targetEntry.lastAt = t;
      if (targetName) targetEntry.name = targetName;
      this.totalByTarget.set(targetKey, targetEntry);
      const ownerEntry = this.totalByOwner.get(contributor.key) || {
        key: contributor.key,
        actor: contributor.owner,
        name: contributor.name,
        className: contributor.className,
        ownerKind: contributor.ownerKind,
        color: contributor.color,
        total: 0,
        direct: 0,
        dot: 0,
        pet: 0,
        merc: 0,
        targets: new Map(),
        lastAt: t
      };
      ownerEntry.actor = contributor.owner;
      ownerEntry.name = contributor.name;
      ownerEntry.className = contributor.className;
      ownerEntry.color = contributor.color;
      ownerEntry.total += amount;
      ownerEntry[contributor.contribution] = (ownerEntry[contributor.contribution] || 0) + amount;
      ownerEntry.lastAt = t;
      ownerEntry.targets.set(targetKey, (ownerEntry.targets.get(targetKey) || 0) + amount);
      this.totalByOwner.set(contributor.key, ownerEntry);
      this.events.push({ t, amount, ownerKey: contributor.key, contribution: contributor.contribution, targetKey, damageType: event.damageType || '', crit: !!event.isCrit });
      this.trimHistory(t);
      this.dirty = true;
      return amount;
    }

    trimHistory(t = nowMs()) {
      const maxSeconds = Math.max(60, num(this.settings().dpsMeterMaxHistorySeconds, 900));
      const oldest = t - maxSeconds * 1000;
      if (this.windowSeconds <= 0) return;
      while (this.events.length && this.events[0].t < oldest) this.events.shift();
    }

    partyRowsBase() {
      const rows = new Map();
      const roster = this.game?.getPartyRoster?.({ includePet: false }) || [];
      for (const member of roster) {
        if (!member || member.type === 'merc' || member.type === 'pet') continue;
        const actor = member.entity || null;
        const type = member.type === 'bot' ? 'bot' : (member.local ? 'player' : 'remote');
        if (actor && !this.actorIsEligibleForDps(actor, type)) continue;
        if (!actor && !member.local) continue;
        const key = actor ? this.actorKey(actor, type) : (member.local ? this.actorKey(this.game?.player, 'player') : `player:${member.id}`);
        const className = member.className || actor?.className || (type === 'bot' ? 'Bot' : 'Player');
        rows.set(key, {
          key,
          actor: actor || (member.local ? this.game?.player : null),
          name: member.local ? 'You' : cleanName(member.name, type === 'bot' ? 'Bot' : 'Player'),
          className,
          ownerKind: type,
          color: classColor(className, type),
          total: 0, direct: 0, dot: 0, pet: 0, merc: 0, dps: 0, windowDamage: 0, threatPercent: null
        });
      }
      if (!rows.size && this.game?.player) {
        const p = this.game.player;
        const key = this.actorKey(p, 'player');
        rows.set(key, { key, actor: p, name: 'You', className: p.className || 'Player', ownerKind: 'player', color: classColor(p.className, 'player'), total: 0, direct: 0, dot: 0, pet: 0, merc: 0, dps: 0, windowDamage: 0, threatPercent: null });
      }
      return rows;
    }

    calculateSnapshot() {
      const t = nowMs();
      this.pruneInvalidContributors?.('snapshot validation');
      const rows = this.partyRowsBase();
      for (const [key, entry] of this.totalByOwner.entries()) {
        if (!this.actorIsEligibleForDps(entry.actor, entry.ownerKind)) continue;
        const base = rows.get(key) || { key, actor: entry.actor, name: entry.name, className: entry.className, ownerKind: entry.ownerKind, color: entry.color, total: 0, direct: 0, dot: 0, pet: 0, merc: 0, dps: 0, windowDamage: 0, threatPercent: null };
        base.actor = entry.actor || base.actor;
        base.name = entry.name || base.name;
        base.className = entry.className || base.className;
        base.color = entry.color || base.color;
        base.total = entry.total || 0;
        base.direct = entry.direct || 0;
        base.dot = entry.dot || 0;
        base.pet = entry.pet || 0;
        base.merc = entry.merc || 0;
        rows.set(key, base);
      }
      const durationSinceStart = this.fightStartedAt ? Math.max(1, (t - this.fightStartedAt) / 1000) : 1;
      const denom = this.windowSeconds <= 0 ? durationSinceStart : Math.max(1, Math.min(this.windowSeconds, durationSinceStart));
      const oldest = this.windowSeconds <= 0 ? 0 : t - this.windowSeconds * 1000;
      for (const event of this.events) {
        if (event.t < oldest) continue;
        const row = rows.get(event.ownerKey);
        if (row) row.windowDamage = (row.windowDamage || 0) + event.amount;
      }
      const target = this.game?.getOffensiveTarget?.() || (this.game?.player?.targetId ? (this.game?.enemies || []).find(e => String(e.id) === String(this.game.player.targetId)) : null);
      for (const row of rows.values()) {
        row.dps = (row.windowDamage || 0) / denom;
        if (target && row.actor && this.settings().dpsMeterShowThreat !== false) {
          const threat = this.game?.getPlayerThreatInfoForEnemy?.(target, row.actor);
          if (threat && threat.hasThreat) row.threatPercent = Math.round(num(threat.percent, 0) * 100);
        }
      }
      const sorted = Array.from(rows.values()).sort((a, b) => (b.dps - a.dps) || (b.total - a.total) || String(a.name).localeCompare(String(b.name)));
      const targets = Array.from(this.totalByTarget.values()).sort((a, b) => b.total - a.total).slice(0, 4);
      const overallTotal = Array.from(this.totalByOwner.values()).reduce((sum, row) => sum + (row.total || 0), 0);
      const isParty = (this.game?.getPartyRoster?.({ includePet: false }) || []).filter(m => m && !['merc','pet'].includes(String(m.type))).length > 1;
      return { rows: sorted, targets, overallTotal, isParty, label: windowLabel(this.windowSeconds), denominatorSeconds: denom, updatedAt: t };
    }

    render(force = false) {
      if (!this.visible && !force) return;
      const panel = this.ensurePanel();
      if (!panel) return;
      const t = nowMs();
      const interval = Math.max(250, num(this.settings().dpsMeterUpdateIntervalMs, 1000));
      if (!force && !this.dirty && t - this.lastRenderAt < interval) return;
      this.lastRenderAt = t;
      this.dirty = false;
      const snap = this.calculateSnapshot();
      this.lastSnapshot = snap;
      const body = panel.querySelector('[data-dps-body]');
      const title = panel.querySelector('.dpsHeaderTitle');
      if (title) title.textContent = `DPS Meter (${snap.label})`;
      const maxDps = Math.max(1, ...snap.rows.map(r => r.dps || 0));
      const rowsHtml = snap.rows.length ? snap.rows.map((row, index) => {
        const pct = clamp((row.dps || 0) / maxDps * 100, 0, 100, 0);
        const threatText = row.threatPercent != null ? ` · Threat ${row.threatPercent}%` : '';
        const breakdown = this.settings().dpsMeterShowBreakdown === false ? '' : `<div class="dpsBreakdown">Direct ${formatNumber(row.direct)} · DoT ${formatNumber(row.dot)} · Pet ${formatNumber(row.pet)} · Merc ${formatNumber(row.merc)}${threatText}</div>`;
        return `<div class="dpsRow ${index === 0 && row.dps > 0 ? 'topDps' : ''}" style="color:${esc(row.color)}" title="Direct ${formatNumber(row.direct)} · DoT ${formatNumber(row.dot)} · Pet ${formatNumber(row.pet)} · Merc ${formatNumber(row.merc)}${threatText}"><div class="dpsRowMain"><div class="dpsRankName">${index + 1}. ${esc(row.name)} <span class="small">(${esc(row.className || 'Adventurer')})</span></div><div class="dpsValue">${formatDps(row.dps)} DPS</div><div class="dpsTotal">Total ${formatNumber(row.total)}</div></div>${breakdown}<div class="dpsBar"><div class="dpsBarFill" style="width:${pct.toFixed(1)}%"></div></div></div>`;
      }).join('') : '<div class="small">No damage recorded yet.</div>';
      const targetsHtml = snap.targets.length ? `<div class="dpsTargets"><strong>Targets:</strong> ${snap.targets.map(t => `${esc(t.name)} ${formatNumber(t.total)}`).join(' · ')}</div>` : '<div class="dpsTargets">Targets: none</div>';
      if (body) body.innerHTML = `
        <div class="dpsControls">
          <select data-dps-window>
            <option value="10" ${this.windowSeconds === 10 ? 'selected' : ''}>Last 10s</option>
            <option value="30" ${this.windowSeconds === 30 ? 'selected' : ''}>Last 30s</option>
            <option value="0" ${this.windowSeconds === 0 ? 'selected' : ''}>Current Fight</option>
          </select>
          <button type="button" data-dps-reset>Reset</button>
          <button type="button" data-dps-hide>Hide</button>
          <span class="small">${snap.isParty ? 'Party comparison' : 'Solo damage'}</span>
        </div>
        <div class="dpsRows">${rowsHtml}</div>
        ${targetsHtml}
        <div class="dpsMeta">Overall total: ${formatNumber(snap.overallTotal)} · Ctrl+D toggles meter.</div>`;
      this.fitPanelToRows(snap);
      body?.querySelector('[data-dps-window]')?.addEventListener('change', event => this.setWindowSeconds(Number(event.target.value)));
      body?.querySelector('[data-dps-reset]')?.addEventListener('click', () => this.reset('manual reset'));
      body?.querySelector('[data-dps-hide]')?.addEventListener('click', () => this.setVisible(false));
    }

    update() { if (this.visible) this.render(false); }
  }

  function settingsBlock(game) {
    const sys = game?.ensureDpsMeterSystem?.();
    const visible = !!sys?.visible;
    const win = Number(sys?.windowSeconds ?? 10);
    const snap = sys?.lastSnapshot || { overallTotal: 0, rows: [] };
    return `
      <div data-dps-settings-block="1">
      <div class="settingsSubsectionTitle" data-dps-settings-title>DPS Meter</div>
      <div class="small" style="margin-bottom:8px">Tracks direct damage, DoT ticks, pet damage, mercenary damage, per-target totals, and party DPS ranking. Ctrl+D toggles the window.</div>
      <div class="settingsRow"><span>DPS Meter</span><button class="toggleBtn ${visible ? 'active' : ''}" data-dps-settings-toggle="1">${visible ? 'On' : 'Off'}</button></div>
      <div class="settingsRow"><span>DPS Window</span><span><button class="toggleBtn dpsWindowButton ${win === 10 ? 'active' : ''}" data-dps-settings-window="10">10s</button> <button class="toggleBtn dpsWindowButton ${win === 30 ? 'active' : ''}" data-dps-settings-window="30">30s</button> <button class="toggleBtn dpsWindowButton ${win === 0 ? 'active' : ''}" data-dps-settings-window="0">Fight</button></span></div>
      <div class="settingsRow"><span>Totals</span><span>${formatNumber(snap.overallTotal || 0)} damage · ${(snap.rows || []).length} tracked row(s)</span></div>
      <div class="settingsRow" style="gap:6px; flex-wrap:wrap"><button class="toggleBtn" data-dps-settings-reset="1">Reset DPS Totals</button><button class="toggleBtn" data-dps-settings-popout="1">Open Meter</button></div>
      </div>`;
  }

  function appendSettingsBlock(game, list) {
    if (!list) return;
    let block = list.querySelector('[data-dps-settings-block]');
    if (!block) {
      block = document.createElement('div');
      block.dataset.dpsSettingsBlock = '1';
      block.innerHTML = settingsBlock(game);
      list.appendChild(block);
    }
    if (block.__drDpsSettingsBound) return;
    block.__drDpsSettingsBound = true;
    block.querySelector('[data-dps-settings-toggle]')?.addEventListener('click', () => game.toggleDpsMeter?.());
    block.querySelectorAll('[data-dps-settings-window]').forEach(btn => btn.addEventListener('click', () => game.setDpsMeterWindow?.(Number(btn.dataset.dpsSettingsWindow))));
    block.querySelector('[data-dps-settings-reset]')?.addEventListener('click', () => game.resetDpsMeter?.('settings reset'));
    block.querySelector('[data-dps-settings-popout]')?.addEventListener('click', () => game.showDpsMeter?.());
  }

  function install(Game) {
    if (!Game || !Game.prototype || Game.prototype.__drDpsMeterSystemInstalled) return;
    Game.prototype.__drDpsMeterSystemInstalled = true;

    Game.prototype.ensureDpsMeterSystem = function() {
      if (!this.dpsMeterSystem) this.dpsMeterSystem = new DpsMeterSystem(this);
      return this.dpsMeterSystem;
    };
    Game.prototype.recordDamageEvent = function(event = {}) { return this.ensureDpsMeterSystem?.().recordDamageEvent?.(event) || 0; };
    Game.prototype.forgetDpsContributorForActor = function(actor, reason = 'actor removed') { return this.ensureDpsMeterSystem?.().forgetContributorForActor?.(actor, reason) || false; };
    Game.prototype.pruneInvalidDpsContributors = function(reason = 'manual prune') { return this.ensureDpsMeterSystem?.().pruneInvalidContributors?.(reason) || false; };
    Game.prototype.resetDpsMeter = function(reason = 'manual reset') { return this.ensureDpsMeterSystem?.().reset?.(reason) || false; };
    Game.prototype.toggleDpsMeter = function() { const visible = this.ensureDpsMeterSystem?.().toggleVisible?.(); this.logSystem?.(`DPS Meter: ${visible ? 'On' : 'Off'}.`); return visible; };
    Game.prototype.showDpsMeter = function() { this.ensureDpsMeterSystem?.().setVisible?.(true); return true; };
    Game.prototype.setDpsMeterWindow = function(seconds = 10) { this.ensureDpsMeterSystem?.().setWindowSeconds?.(seconds); return true; };
    Game.prototype.getDpsMeterSnapshot = function() { return this.ensureDpsMeterSystem?.().calculateSnapshot?.() || null; };

    const originalUpdate = Game.prototype.update;
    if (typeof originalUpdate === 'function' && !originalUpdate.__drDpsMeterWrapped) {
      const wrappedUpdate = function(...args) {
        const result = originalUpdate.apply(this, args);
        try { this.ensureDpsMeterSystem?.().update?.(); } catch (err) { this.recordRuntimeSystemFault?.({ id: 'dps-meter-system' }, 'update', err); }
        return result;
      };
      wrappedUpdate.__drDpsMeterWrapped = true;
      Game.prototype.update = wrappedUpdate;
    }

    const previousAddOnsSettingsHtml = Game.prototype.addOnsSettingsHtml;
    Game.prototype.addOnsSettingsHtml = function(escapeHtml) {
      const previous = typeof previousAddOnsSettingsHtml === 'function' ? previousAddOnsSettingsHtml.call(this, escapeHtml) : '';
      return `${previous || ''}${settingsBlock(this)}`;
    };

    const previousBindAddOnsSettings = Game.prototype.bindAddOnsSettings;
    Game.prototype.bindAddOnsSettings = function(list) {
      if (typeof previousBindAddOnsSettings === 'function') previousBindAddOnsSettings.call(this, list);
      appendSettingsBlock(this, list);
    };

    window.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || String(event.key || '').toLowerCase() !== 'd') return;
      const target = event.target;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const game = window.DarkWoodsGame;
      if (!game?.toggleDpsMeter) return;
      event.preventDefault();
      game.toggleDpsMeter();
    }, true);
  }

  DR.DpsMeterSystem = { install, DpsMeterSystem };
})();
