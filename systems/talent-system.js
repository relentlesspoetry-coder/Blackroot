// Dream Realms Talent System v1 (V0.17.69)
// Owns player.talents state, compiles declarative DR.TALENT_TREES nodes into
// derived stat/spell/combat/proc effects, and renders the talent panel.
//
// Design contract (see spec):
//  - Talents empower EXISTING class spells + add flat stats + runtime combat
//    multipliers + passive capstone procs. No new castable abilities.
//  - Points are DERIVED from level: total = clamp(level - 4, 0, 16). Unforgeable.
//  - Only the local player's spells/combat are affected. Bots/mercs/pets are
//    never given talent state (pets receive petDamage mods applied at the owner).
//  - All hot-path reads (talentModifier from damageEntity) use pre-folded
//    scalar buckets, never a 294-node scan.
(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  const MAX_POINTS = 16;
  const TIER_GATES = { 1: 0, 2: 3, 3: 6, 4: 9, 5: 12 };
  const RESPEC_BASE_COPPER = 250;
  const RESPEC_CAP_COPPER = 64000;
  const RESPEC_FREE_THRESHOLD = 3;          // free while <= this many points spent
  const RESPEC_DECAY_MS = 7 * 24 * 60 * 60 * 1000;
  // Balance-rail clamps applied in talentModifier() as the last line of defence.
  const MOD_CLAMP = {
    damageDone: { max: 2.0 }, dotDamage: { max: 2.0 }, petDamage: { max: 2.0 },
    damageTaken: { min: 0.40 }, healingDone: { max: 2.5 },
    healingReceived: { max: 2.0 }, threatDone: { max: 6.0 }, absorbPower: { max: 2.5 }
  };

  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  function specsForClass(className) {
    const tree = className ? DR.TALENT_TREES?.[className] : null;
    return Array.isArray(tree?.specs) ? tree.specs : [];
  }

  function fmtNum(v) {
    const r = Math.round(v * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(/\.0$/, '');
  }
  function fmtPct(v) {
    const r = Math.round(v * 1000) / 10;
    return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
  }
  function renderDesc(desc, vals, rank) {
    if (!desc) return '';
    const v = Array.isArray(vals) ? vals : [];
    return String(desc)
      .replace(/%%(\d)/g, (_, d) => fmtPct((v[d - 1] || 0) * rank))
      .replace(/%(\d)/g, (_, d) => fmtNum((v[d - 1] || 0) * rank));
  }

  // --- spell matching + field patching (used by applyTalentSpellMods) --------
  function spellMatches(spell, match) {
    if (!spell || !match) return false;
    if (match.all === true) return true;
    if (Array.isArray(match.names)) return match.names.includes(spell.name);
    if (match.kind) return spell.kind === match.kind;
    if (Array.isArray(match.kinds)) return match.kinds.includes(spell.kind);
    if (match.damageType) return spell.damageType === match.damageType;
    if (match.tag) return Array.isArray(spell.tags) && spell.tags.includes(match.tag);
    return false;
  }
  function numAt(obj, path) {
    if (!obj) return null;
    if (path.indexOf('.') < 0) { const n = Number(obj[path]); return Number.isFinite(n) ? n : null; }
    let cur = obj;
    for (const key of path.split('.')) { if (cur == null) return null; cur = cur[key]; }
    const n = Number(cur);
    return Number.isFinite(n) ? n : null;
  }
  function setAt(obj, path, value) {
    if (path.indexOf('.') < 0) { obj[path] = value; return; }
    const keys = path.split('.'); let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...(cur[keys[i]] || {}) }; cur = cur[keys[i]]; }
    cur[keys[keys.length - 1]] = value;
  }

  function ensureTalentState(player) {
    if (!player) return null;
    const cls = player.className;
    let t = player.talents;
    if (!t || typeof t !== 'object' || t.className !== cls) {
      t = { version: 1, className: cls, spent: {}, respecCount: 0, lastRespecAt: 0 };
      player.talents = t;
    }
    if (!t.spent || typeof t.spent !== 'object') t.spent = {};
    for (const spec of specsForClass(cls)) {
      if (!t.spent[spec.id] || typeof t.spent[spec.id] !== 'object') t.spent[spec.id] = {};
    }
    return t;
  }

  function treePointsFor(t, spec) {
    const bag = t?.spent?.[spec.id] || {};
    let sum = 0;
    for (const k in bag) sum += Math.max(0, Math.floor(Number(bag[k]) || 0));
    return sum;
  }

  // V0.17.80: spec-NAME-themed background silhouettes (replaces the old spell-icon
  // watermark). Each motif is a single vector drawn in the spec's own colour; a
  // keyword map turns each spec's name into a theme (bones for Bonecaller, a skull
  // for Plaguebinder/Soulreaper, a flame for Pyromancer, a moon for Mooncaller, ...).
  const THEME_SVG = {
    skull: "<path fill='%C%' fill-rule='evenodd' d='M50 15C31 15 20 29 20 47c0 8 3 13 5 18 1 3 4 5 8 5v9c0 3 2 5 5 5s5-2 5-5v-5h4v5c0 3 2 5 5 5s5-2 5-5v-9c4 0 7-2 8-5 2-5 5-10 5-18C80 29 69 15 50 15zM37 40c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9zM63 40c4 0 7 4 7 9s-3 9-7 9-7-4-7-9 3-9 7-9zM50 57l-6 11h12z'/>",
    bone: "<g fill='%C%'><g transform='rotate(45 50 50)'><rect x='45' y='16' width='10' height='68' rx='5'/><circle cx='44' cy='16' r='6'/><circle cx='56' cy='16' r='6'/><circle cx='44' cy='84' r='6'/><circle cx='56' cy='84' r='6'/></g><g transform='rotate(-45 50 50)'><rect x='45' y='16' width='10' height='68' rx='5'/><circle cx='44' cy='16' r='6'/><circle cx='56' cy='16' r='6'/><circle cx='44' cy='84' r='6'/><circle cx='56' cy='84' r='6'/></g></g>",
    flame: "<path fill='%C%' d='M53 12c5 15 21 19 21 38 0 16-11 26-24 26S26 66 26 50c0-10 5-17 10-23 0 7 3 11 8 11-6-10-3-19 9-26z'/>",
    ice: "<g fill='none' stroke='%C%' stroke-width='4' stroke-linecap='round'><line x1='50' y1='14' x2='50' y2='86'/><line x1='22' y1='30' x2='78' y2='70'/><line x1='78' y1='30' x2='22' y2='70'/><g stroke-width='3'><path d='M50 24l-7 6M50 24l7 6M50 76l-7-6M50 76l7-6M26 33l-1 9M26 33l8 3M74 67l1-9M74 67l-8-3M74 33l1 9M74 33l-8 3M26 67l-1-9M26 67l8-3'/></g></g>",
    bolt: "<path fill='%C%' d='M58 12L28 56h16l-9 32 34-48H54l9-28z'/>",
    mountain: "<g fill='%C%'><path d='M8 84L40 30l14 24 10-14 28 44z'/></g><path fill='#000' fill-opacity='0.35' d='M40 30l8 14-8 12-8-8z'/>",
    thorn: "<g fill='%C%'><path d='M52 86C50 60 44 40 62 16c-3 14 1 20 1 20-11 7-8 22-11 50z'/><path d='M60 38l16-6-13 13z'/><path d='M50 56l-16-5 14 11z'/><path d='M62 26l14-3-13 11z'/><path d='M46 72l-14 2 12-8z'/></g>",
    leaf: "<path fill='%C%' d='M50 86C28 72 22 44 50 14c28 30 22 58 0 72z'/><path fill='#000' fill-opacity='0.35' d='M49 80V24h2v56z'/>",
    moon: "<path fill='%C%' d='M64 18a34 34 0 100 64 27 27 0 110-64z'/><g fill='%C%'><path d='M28 30l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z'/><path d='M26 62l1.8 4.5 4.5 1.8-4.5 1.8-1.8 4.5-1.8-4.5-4.5-1.8 4.5-1.8z'/></g>",
    blade: "<g fill='%C%'><path d='M50 10l6 48H44z'/><rect x='36' y='58' width='28' height='6' rx='3'/><rect x='46' y='64' width='8' height='20' rx='2'/><circle cx='50' cy='87' r='5'/></g>",
    drop: "<g fill='%C%'><path d='M50 16c-13 21-17 30-17 40a17 17 0 1034 0c0-10-4-19-17-40z'/><path d='M70 58c-5 8-6 10-6 14a6 6 0 1012 0c0-4-1-6-6-14z'/></g>",
    claw: "<g fill='%C%'><path d='M26 18c15 11 23 32 21 60-7-2-11-6-13-11-6-16-8-35-8-49z'/><path d='M46 16c13 13 17 36 13 62-7-2-10-6-12-11-4-16-3-38-1-51z'/><path d='M66 20c9 15 9 38 2 60-7-3-9-8-10-13-2-16 2-34 8-47z'/></g>",
    arrow: "<g fill='%C%'><path d='M50 10l11 18h-7v42h-8V28h-7z'/><path d='M39 76l11 13 11-13-11 6z'/></g>",
    gear: "<path fill='%C%' fill-rule='evenodd' d='M50 16l5 9 10-2 1 10 9 4-5 9 6 8-8 6 1 10-10 2-4 9-9-4-8 6-7-7-10 2-2-10-9-4 4-9-5-9 9-4-1-10 10 0 3-10 9 3zM50 38a12 12 0 100 24 12 12 0 100-24z'/>",
    rune: "<g fill='none' stroke='%C%' stroke-width='4'><circle cx='50' cy='50' r='30'/></g><path fill='%C%' d='M50 32l16 30H34z'/><g stroke='%C%' stroke-width='3'><path d='M50 12v10M50 78v10M12 50h10M78 50h10'/></g>",
    eye: "<g fill='none' stroke='%C%' stroke-width='6' stroke-linejoin='round'><path d='M16 50c14-22 54-22 68 0-14 22-54 22-68 0z'/></g><circle cx='50' cy='50' r='12' fill='%C%'/><circle cx='50' cy='50' r='4' fill='#000'/>",
    note: "<g fill='%C%'><ellipse cx='36' cy='73' rx='9' ry='7' transform='rotate(-18 36 73)'/><ellipse cx='66' cy='67' rx='9' ry='7' transform='rotate(-18 66 67)'/><path d='M43 31h4v40h-4zM73 25h4v40h-4z'/><path d='M43 31l34-6v9l-34 6z'/></g>",
    shield: "<path fill='%C%' d='M50 12l30 9v23c0 21-15 34-30 42-15-8-30-21-30-42V21z'/><path fill='#000' fill-opacity='0.32' d='M49 20v60h2V20z'/>",
    radiant: "<g fill='%C%'><circle cx='50' cy='50' r='16'/><path d='M50 6l4 20h-8zM50 94l4-20h-8zM6 50l20 4v-8zM94 50l-20 4v-8zM19 19l16 13-6 6zM81 19l-16 13 6 6zM19 81l16-13-6-6zM81 81l-16-13 6-6z'/></g>"
  };
  function specTheme(spec) {
    // Match the spec NAME only - the id embeds the class name ("warden" -> "ward")
    // and the role embeds flavour words ("stagger" -> "stag", "anti-undead") that
    // would mis-theme specs.
    const n = String(spec.name || '').toLowerCase();
    const has = (...ws) => ws.some(w => n.includes(w));
    if (has('bone', 'skeleton')) return 'bone';
    if (has('plague', 'rot', 'disease', 'pestilen', 'blight')) return 'skull';
    if (has('soul', 'reaper', 'wraith', 'undead', 'drain', 'death')) return 'skull';
    if (has('venom', 'poison', 'toxic')) return 'drop';
    if (has('spirit', 'ghost')) return 'flame';
    if (has('pyro', 'flame', 'fire', 'inferno', 'ember', 'burn', 'ash', 'combust')) return 'flame';
    if (has('frost', 'ice', 'cold', 'glaci', 'chill', 'winter')) return 'ice';
    if (has('storm', 'lightning', 'thunder', 'spark', 'tempest', 'skybreak')) return 'bolt';
    if (has('earth', 'stone', 'mountain', 'rock', 'granite', 'quake', 'boulder')) return 'mountain';
    if (has('thorn', 'briar', 'bramble')) return 'thorn';
    if (has('moon', 'lunar', 'crescent', 'starfall')) return 'moon';
    if (has('shield', 'bulwark', 'bastion', 'sanctif', 'oath', 'aegis', 'protect', 'ward')) return 'shield';
    if (has('light', 'radiant', 'divine', 'holy', 'judic', 'exorc', 'bearer', 'mercy', 'dawn', 'sun')) return 'radiant';
    if (has('life', 'bloom', 'grove', 'wild', 'verdant', 'nature', 'vine', 'pack', 'stag', 'mend', 'regrow', 'leaf', 'root')) return 'leaf';
    if (has('beast', 'stalker', 'fang', 'claw', 'swarm', 'predator', 'hunt')) return 'claw';
    if (has('trap', 'mechan', 'device', 'spring', 'snare', 'box')) return 'gear';
    if (has('bolt', 'crossbow', 'arrow', 'deadeye', 'marks', 'pierc', 'archer', 'aim', 'shot')) return 'arrow';
    if (has('rune', 'glyph', 'arcan', 'planar', 'mana', 'inscri', 'seal', 'binder', 'summon', 'elemental')) return 'rune';
    if (has('mesmer', 'illusion', 'mind', 'charm', 'phantom', 'mirror', 'dream')) return 'eye';
    if (has('song', 'chant', 'minstrel', 'dirge', 'ballad', 'harmon', 'rhythm', 'note', 'melod', 'verse', 'hymn', 'music')) return 'note';
    if (has('blade', 'sword', 'dagger', 'duel', 'strike', 'breaker', 'berserk', 'weapon', 'master', 'knife', 'cut', 'execut', 'slash', 'night')) return 'blade';
    return 'rune';
  }
  function themeSilhouetteSvg(spec) {
    const key = specTheme(spec);
    return `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>${(THEME_SVG[key] || THEME_SVG.rune).replace(/%C%/g, spec.color || '#caa')}</svg>`;
  }

  DR.TalentSystem = {
    install(Game) {
      // ---- point economy (all null-safe) -------------------------------------
      Game.prototype.talentPointsTotal = function() {
        const lvl = Math.floor(Number(this.player?.level) || 1);
        return Math.max(0, Math.min(MAX_POINTS, lvl - 4));
      };
      Game.prototype.talentPointsSpent = function() {
        const t = this.player?.talents;
        if (!t) return 0;
        let sum = 0;
        for (const spec of specsForClass(this.player.className)) sum += treePointsFor(t, spec);
        return sum;
      };
      Game.prototype.talentPointsAvailable = function() {
        return Math.max(0, this.talentPointsTotal() - this.talentPointsSpent());
      };
      Game.prototype.talentTreePoints = function(specId) {
        const t = this.player?.talents; if (!t) return 0;
        return treePointsFor(t, { id: specId });
      };
      Game.prototype.talentTierUnlocked = function(specId, tier) {
        return this.talentTreePoints(specId) >= (TIER_GATES[tier] || 0);
      };

      Game.prototype.talentNodeLookup = function(specId, nodeId) {
        for (const spec of specsForClass(this.player?.className)) {
          if (spec.id !== specId) continue;
          return spec.nodes.find(n => n.id === nodeId) || null;
        }
        return null;
      };

      Game.prototype.canSpendTalent = function(specId, nodeId) {
        if (!this.player) return { ok: false, reason: 'No character.' };
        if (this.talentPointsAvailable() <= 0) return { ok: false, reason: 'No talent points available.' };
        const node = this.talentNodeLookup(specId, nodeId);
        if (!node) return { ok: false, reason: 'Unknown talent.' };
        const t = ensureTalentState(this.player);
        const cur = Math.floor(Number(t.spent[specId]?.[nodeId]) || 0);
        if (cur >= node.maxRank) return { ok: false, reason: `${node.name} is already at max rank.` };
        if (!this.talentTierUnlocked(specId, node.tier)) {
          return { ok: false, reason: `Requires ${TIER_GATES[node.tier]} points in this tree.` };
        }
        return { ok: true, reason: '' };
      };

      Game.prototype.spendTalentPoint = function(specId, nodeId) {
        const c = this.canSpendTalent(specId, nodeId);
        if (!c.ok) { this.log?.(c.reason, 'System'); return false; }
        const t = ensureTalentState(this.player);
        t.spent[specId] = t.spent[specId] || {};
        t.spent[specId][nodeId] = (Math.floor(Number(t.spent[specId][nodeId]) || 0)) + 1;
        this.rebuildTalentEffects();
        this.playSfx?.('ui_click', { volume: 0.3 });
        if (this._talentPanelOpen) this.renderTalentPanel?.();
        return true;
      };

      // Right-click refund. Free, but may not orphan a higher-tier investment.
      Game.prototype._talentWouldOrphan = function(specId, nodeId) {
        const t = ensureTalentState(this.player);
        const spec = specsForClass(this.player.className).find(s => s.id === specId);
        if (!spec) return false;
        const newTreePoints = treePointsFor(t, spec) - 1;
        for (const node of spec.nodes) {
          const rank = Math.floor(Number(t.spent[specId]?.[node.id]) || 0);
          const adjusted = node.id === nodeId ? rank - 1 : rank;
          if (adjusted > 0 && (TIER_GATES[node.tier] || 0) > newTreePoints) return true;
        }
        return false;
      };
      Game.prototype.refundTalentPoint = function(specId, nodeId) {
        const t = ensureTalentState(this.player);
        const cur = Math.floor(Number(t.spent[specId]?.[nodeId]) || 0);
        if (cur <= 0) return false;
        if (this._talentWouldOrphan(specId, nodeId)) {
          this.log?.('Cannot refund: it would lock a higher talent you have points in.', 'System');
          return false;
        }
        t.spent[specId][nodeId] = cur - 1;
        if (t.spent[specId][nodeId] <= 0) delete t.spent[specId][nodeId];
        this.rebuildTalentEffects();
        if (this._talentPanelOpen) this.renderTalentPanel?.();
        return true;
      };

      // ---- respec (the gold sink) --------------------------------------------
      Game.prototype.talentRespecCost = function() {
        const t = this.player?.talents;
        const spent = this.talentPointsSpent();
        if (spent <= RESPEC_FREE_THRESHOLD) return 0;
        const decays = t?.lastRespecAt ? Math.floor((Date.now() - t.lastRespecAt) / RESPEC_DECAY_MS) : 0;
        const effCount = Math.max(0, (Math.floor(Number(t?.respecCount) || 0)) - decays);
        return Math.min(RESPEC_CAP_COPPER, RESPEC_BASE_COPPER * Math.pow(2, effCount));
      };
      Game.prototype.respecTalents = function(options = {}) {
        if (!this.player) return false;
        const t = ensureTalentState(this.player);
        const spent = this.talentPointsSpent();
        if (spent === 0) return true;
        const cost = options.free === true ? 0 : this.talentRespecCost();
        if (cost > 0) {
          if ((this.totalCopper?.() ?? 0) < cost) {
            this.log?.(`Respec costs ${this.formatCopper ? this.formatCopper(cost) : cost + 'c'} - not enough coin.`, 'System');
            return false;
          }
          this.addCopper?.(-cost);
          const decays = t.lastRespecAt ? Math.floor((Date.now() - t.lastRespecAt) / RESPEC_DECAY_MS) : 0;
          t.respecCount = Math.max(0, (Math.floor(Number(t.respecCount) || 0)) - decays) + 1;
        }
        t.lastRespecAt = Date.now();
        for (const spec of specsForClass(this.player.className)) t.spent[spec.id] = {};
        this.rebuildTalentEffects();
        this.log?.(cost > 0 ? `Talents reset for ${this.formatCopper ? this.formatCopper(cost) : cost + 'c'}.` : 'Talents reset.', 'System');
        if (this._talentPanelOpen) this.renderTalentPanel?.();
        return true;
      };

      // ---- normalize / migrate (called on load) ------------------------------
      Game.prototype.normalizeTalentState = function(player = this.player) {
        if (!player) return;
        const cls = player.className;
        let t = player.talents;
        if (!t || typeof t !== 'object') { player.talents = null; return; }
        if (t.className && t.className !== cls) {           // class change => wipe
          player.talents = { version: 1, className: cls, spent: {}, respecCount: 0, lastRespecAt: 0 };
          return;
        }
        t = ensureTalentState(player);
        const specs = specsForClass(cls);
        const specIds = new Set(specs.map(s => s.id));
        for (const sid of Object.keys(t.spent)) if (!specIds.has(sid)) delete t.spent[sid];
        for (const spec of specs) {
          const bag = t.spent[spec.id] = t.spent[spec.id] || {};
          const byId = {}; spec.nodes.forEach(n => byId[n.id] = n);
          for (const nid of Object.keys(bag)) {
            const node = byId[nid];
            if (!node) { delete bag[nid]; continue; }
            bag[nid] = Math.max(0, Math.min(node.maxRank, Math.floor(Number(bag[nid]) || 0)));
            if (bag[nid] === 0) delete bag[nid];
          }
        }
        // Drop any rank whose tier gate is no longer satisfied (rebalance-safe).
        let changed = true;
        while (changed) {
          changed = false;
          for (const spec of specs) {
            const tp = treePointsFor(t, spec);
            const byId = {}; spec.nodes.forEach(n => byId[n.id] = n);
            for (const nid of Object.keys(t.spent[spec.id] || {})) {
              const node = byId[nid];
              if (node && (TIER_GATES[node.tier] || 0) > tp) { delete t.spent[spec.id][nid]; changed = true; }
            }
          }
        }
        // Over budget for the character's level => refund the lot.
        const total = Math.max(0, Math.min(MAX_POINTS, (Math.floor(Number(player.level) || 1)) - 4));
        let spent = 0; for (const spec of specs) spent += treePointsFor(t, spec);
        if (spent > total) {
          for (const spec of specs) t.spent[spec.id] = {};
          this.log?.('Talents reset: available points changed.', 'System');
        }
      };

      // ---- the compile step --------------------------------------------------
      Game.prototype.rebuildTalentEffects = function() {
        const p = this.player;
        if (!p) return;
        ensureTalentState(p);
        const stats = {};
        const flat = {};          // unconditional multiplicative mod scalars
        const cond = {};          // conditional mods bucketed by mod name
        const spellMods = [];
        const procs = [];
        const flags = {};

        for (const spec of specsForClass(p.className)) {
          const bag = p.talents.spent[spec.id] || {};
          for (const node of spec.nodes) {
            const rank = Math.floor(Number(bag[node.id]) || 0);
            if (rank <= 0) continue;
            for (const eff of node.effects || []) {
              if (eff.k === 'stat') {
                stats[eff.stat] = (stats[eff.stat] || 0) + eff.per * rank;
              } else if (eff.k === 'spell') {
                spellMods.push({ match: eff.match, field: eff.field, op: eff.op, value: eff.per * rank });
              } else if (eff.k === 'mod') {
                if (eff.op === 'mul' && !eff.when) {
                  flat[eff.mod] = (flat[eff.mod] ?? 1) * (1 + eff.per * rank);
                } else {
                  (cond[eff.mod] = cond[eff.mod] || []).push({ op: eff.op, per: eff.per * rank, when: eff.when || null });
                }
              } else if (eff.k === 'proc') {
                procs.push(eff.proc);
              } else if (eff.k === 'flag') {
                flags[eff.flag] = true;
              }
            }
          }
        }

        // Spec title = tree with most points (min 5); ties -> first in order.
        let bestSpec = null, bestPts = 4;
        for (const spec of specsForClass(p.className)) {
          const pts = treePointsFor(p.talents, spec);
          if (pts >= 5 && pts > bestPts) { bestPts = pts; bestSpec = spec.id; }
        }

        p.talentStats = stats;
        p.talentModsFlat = flat;
        p.talentMods = cond;
        p.talentSpellMods = spellMods;
        p.talentProcs = procs;
        p.talentFlags = flags;
        p.talentSpec = bestSpec;
        p.talentProcState = p.talentProcState || {};
        p.talentDynamicMods = p.talentDynamicMods || [];
        p.talentRevision = (p.talentRevision || 0) + 1;
        this._talentSpellCache = null;

        this.recalculatePlayerStats?.();
        this.markSpellBookDirty?.('talents');
      };

      Game.prototype.talentStatBonuses = function() {
        return this.player?.talentStats || null;
      };
      Game.prototype.talentSpellMods = function() {
        return this.player?.talentSpellMods || [];
      };

      // ---- spell-book patch (player class only, index-preserving, memoized) ---
      Game.prototype.applyTalentSpellMods = function(spells) {
        if (!Array.isArray(spells) || !spells.length) return spells;
        const mods = this.player?.talentSpellMods;
        if (!mods || !mods.length) return spells;
        const rev = this.player.talentRevision || 0;
        const cache = this._talentSpellCache;
        if (cache && cache.src === spells && cache.rev === rev) return cache.out;

        const out = spells.slice();
        for (let i = 0; i < out.length; i++) {
          const base = spells[i];
          if (!base) continue;
          let clone = null;
          for (const m of mods) {
            if (!spellMatches(base, m.match)) continue;
            const cur = numAt(clone || base, m.field);
            if (cur == null) continue;
            if (!clone) clone = { ...base };
            let next = m.op === 'mul' ? cur * (1 + m.value) : cur + m.value;
            const baseVal = numAt(base, m.field) ?? cur;
            if (m.field === 'cost' || m.field === 'cooldown' || m.field === 'castTime') {
              // Balance rail 2: cost/cooldown/cast never below 25% of base (all ops,
              // so stacked -flat reductions can't drive a cooldown to near-zero).
              next = Math.max(baseVal * 0.25, next);
            } else if (m.op === 'mul') {
              const lo = Math.min(baseVal * 0.25, baseVal * 4), hi = Math.max(baseVal * 0.25, baseVal * 4);
              next = Math.min(hi, Math.max(lo, next));
            }
            setAt(clone, m.field, next);
          }
          if (clone) out[i] = clone;
        }
        this._talentSpellCache = { src: spells, rev, out };
        return out;
      };

      // ---- runtime combat multipliers ---------------------------------------
      Game.prototype._talentWhenMatches = function(when, ctx) {
        if (!when) return true;
        const p = this.player;
        const hpRatio = (e) => (e && e.maxHp > 0 ? e.hp / e.maxHp : 1);
        if (when.selfHpBelow != null && !(hpRatio(p) < when.selfHpBelow)) return false;
        if (when.selfHpAbove != null && !(hpRatio(p) > when.selfHpAbove)) return false;
        if (when.targetHpBelow != null && !(hpRatio(ctx?.target) < when.targetHpBelow)) return false;
        if (when.targetHpAbove != null && !(hpRatio(ctx?.target) > when.targetHpAbove)) return false;
        if (when.damageType != null) {
          const dt = ctx?.damageType;
          if (Array.isArray(when.damageType)) { if (!when.damageType.includes(dt)) return false; }
          else if (dt !== when.damageType) return false;
        }
        if (when.spellKind != null) {
          const k = ctx?.spell?.kind;
          if (Array.isArray(when.spellKind)) { if (!when.spellKind.includes(k)) return false; }
          else if (k !== when.spellKind) return false;
        }
        if (when.periodic === true && ctx?.periodic !== true) return false;
        if (when.autoAttack === true && ctx?.autoAttack !== true) return false;
        if (when.targetFamily != null) {
          const t = ctx?.target;
          const fam = t?.family || t?.baseType?.family || t?.raceId || t?.baseType?.raceId || '';
          if (String(fam) !== String(when.targetFamily)) return false;
        }
        if (when.hasPet === true && !(this.pet && this.pet.alive)) return false;
        if (when.inCombat === true && !(p && (p.combatCooldown || 0) > 0)) return false;
        return true;
      };

      Game.prototype.talentModifier = function(mod, ctx) {
        const p = this.player;
        if (!p) return 1;
        let m = p.talentModsFlat?.[mod] ?? 1;
        const cond = p.talentMods?.[mod];
        if (cond) {
          for (const c of cond) {
            if (!this._talentWhenMatches(c.when, ctx)) continue;
            m = c.op === 'mul' ? m * (1 + c.per) : m + c.per;
          }
        }
        const dyn = p.talentDynamicMods;
        if (dyn && dyn.length) {
          const now = performance.now();
          for (const d of dyn) {
            if (d.mod !== mod || now > d.until) continue;
            if (!this._talentWhenMatches(d.when, ctx)) continue;
            m = d.op === 'mul' ? m * d.value : m + d.value;
          }
        }
        const clamp = MOD_CLAMP[mod];
        if (clamp) { if (clamp.max != null) m = Math.min(m, clamp.max); if (clamp.min != null) m = Math.max(m, clamp.min); }
        return m;
      };

      Game.prototype.talentOutgoingMultiplier = function(target, damageType, options = {}) {
        const ctx = { target, source: this.player, damageType, spell: options.spell || null, periodic: options.isPeriodic === true, autoAttack: options.autoAttack === true };
        let m = this.talentModifier('damageDone', ctx);
        if (ctx.periodic) m *= this.talentModifier('dotDamage', ctx);
        return m;
      };
      Game.prototype.talentIncomingMultiplier = function(source, damageType, options = {}) {
        return this.talentModifier('damageTaken', { target: this.player, source, damageType, spell: options.spell || null, periodic: options.isPeriodic === true, autoAttack: options.autoAttack === true });
      };
      Game.prototype.talentHealingMultiplier = function(target, options = {}) {
        return this.talentModifier('healingDone', { target, source: this.player, spell: options.spell || null, periodic: options.isPeriodic === true });
      };
      Game.prototype.talentHealingReceivedMultiplier = function(options = {}) {
        return this.talentModifier('healingReceived', { target: this.player, source: options.source || null });
      };
      Game.prototype.talentThreatMultiplier = function() {
        return this.talentModifier('threatDone', { target: null, source: this.player });
      };
      // Pet/summon damage is owned by the player's talents (petDamage mods).
      Game.prototype.talentPetMultiplier = function(pet) {
        return this.talentModifier('petDamage', { source: pet || this.pet });
      };

      // ---- capstone procs ----------------------------------------------------
      Game.prototype.fireTalentProc = function(trigger, ctx = {}) {
        const p = this.player;
        const procs = p?.talentProcs;
        if (!procs || !procs.length) return;
        // Reentrancy guard (balance rail: a proc's own effect must not trigger
        // another proc - no infinite onKill->onKill / onHealCast->onHealCast chains).
        if (this._inTalentProc) return;
        const state = p.talentProcState = p.talentProcState || {};
        const now = performance.now();
        const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
        for (const proc of procs) {
          if (proc.trigger !== trigger) continue;
          if (trigger === 'lowHealth') {
            const armedKey = '_armed_' + proc.id;
            if (hpRatio > (proc.threshold ?? 0.25)) { state[armedKey] = true; continue; }
            if (!state[armedKey]) continue;      // edge-trigger: only fire on downward crossing
            state[armedKey] = false;
          }
          const slot = state[proc.id] = state[proc.id] || { readyAt: 0 };
          if (now < slot.readyAt) continue;
          if ((proc.chance ?? 1) < 1 && Math.random() > proc.chance) continue;
          slot.readyAt = now + (proc.icd || 5) * 1000;
          this._inTalentProc = true;
          try { this.applyTalentProcEffects(proc, ctx); } finally { this._inTalentProc = false; }
          this.spawnRing?.(p.x, p.y, proc.color || '#ffffff', 30);
          this.spawnStatusPulse?.(p, proc.color || '#ffffff', proc.name || 'Talent');
          this.logCombat?.(proc.log || `${proc.name || 'Talent'}!`);
        }
      };

      Game.prototype.applyTalentProcEffects = function(proc, ctx) {
        const p = this.player;
        const selfRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
        // Faithful-capstone helpers (V0.17.77): real AoE / DoT / cooldown mechanics.
        const enemiesNear = (center, radius, max) => {
          if (!center || !Array.isArray(this.entities)) return [];
          const cx = center.x, cy = center.y, r = radius || 5; const out = [];
          for (const en of this.entities) {
            if (!en || en.kind !== 'enemy' || en.alive === false) continue;
            if (Math.hypot((en.x || 0) - cx, (en.y || 0) - cy) <= r) { out.push(en); if (out.length >= (max || 8)) break; }
          }
          return out;
        };
        const hit = (tgt, amt, dtype) => { if (tgt && tgt.alive !== false && tgt !== p) this.damageEntity?.(tgt, Math.max(1, Math.floor(amt)), p, proc.color || '#ffffff', { damageType: dtype || 'holy', talentProc: true, canCrit: false }); };
        const atk = mult => (p.attack || 1) * (mult || 1);
        for (const e of proc.effects || []) {
          if (e.type === 'status') {
            this.applyStatusEffect?.(p, { ...e.status }, p);
          } else if (e.type === 'dynamicMod') {
            const list = p.talentDynamicMods = (p.talentDynamicMods || []).filter(d => performance.now() <= d.until);
            list.push({ mod: e.mod, op: e.op, value: e.value, when: e.when || null, until: performance.now() + (e.duration || 0) * 1000 });
          } else if (e.type === 'healPct') {
            let pct = e.pct; if (e.doubleBelowSelfHp && selfRatio < e.doubleBelowSelfHp) pct *= 2;
            this.healEntity?.(p, Math.floor(p.maxHp * pct), true, p, { talentProc: true });
          } else if (e.type === 'manaPct') {
            let pct = e.pct; if (e.doubleBelowSelfHp && selfRatio < e.doubleBelowSelfHp) pct *= 2;
            if (p.maxMana > 0) this.restoreMana?.(p, Math.floor(p.maxMana * pct));
          } else if (e.type === 'damageTarget') {
            hit(ctx?.target || ctx?.source, atk(e.pctOfAttack), e.damageType);   // onDamageTaken retaliates the attacker
          } else if (e.type === 'damageAoe') {
            const center = ctx?.target || p;
            for (const f of enemiesNear(center, e.radius || 5, e.maxTargets || 6)) { hit(f, atk(e.pctOfAttack), e.damageType); this.spawnRing?.(f.x, f.y, proc.color || '#ffffff', 16); }
          } else if (e.type === 'chainStrike') {
            const pool = enemiesNear(p, e.radius || 8, 24);
            for (let i = 0; i < (e.count || 5); i++) { const f = pool.length ? pool[Math.floor(Math.random() * pool.length)] : ctx?.target; if (f) { hit(f, atk(e.pctOfAttack), e.damageType); this.spawnRing?.(f.x, f.y, proc.color || '#ffffff', 14); } }
          } else if (e.type === 'detonateDots') {
            const tgt = ctx?.target;
            if (tgt && Array.isArray(tgt.buffs)) {
              const mine = tgt.buffs.filter(b => b && b.remaining > 0 && b.sourceId === p.id && Number(b.periodicDamage || b.tickDamage || 0) > 0);
              let sum = 0;
              for (const b of mine) { const per = Number(b.periodicDamage || b.tickDamage || 0) * Math.max(1, Number(b.stacks || 1)); const ticks = Math.max(1, Math.floor(Number(b.remaining || 0) / Math.max(0.2, Number(b.tickRate || 1)))); sum += per * ticks; }
              if (sum > 0) hit(tgt, sum * (e.pctOfRemaining || 1), e.damageType || 'shadow');
              if (e.spread && mine.length) for (const f of enemiesNear(tgt, e.radius || 6, 6)) { if (f === tgt) continue; for (const b of mine) this.applyStatusEffect?.(f, { ...b, remaining: b.duration || b.remaining }, p); }
            }
          } else if (e.type === 'applyStatusAoe') {
            const center = ctx?.target || p;
            for (const f of enemiesNear(center, e.radius || 5, e.maxTargets || 8)) this.applyStatusEffect?.(f, { ...e.status }, p);
          } else if (e.type === 'resetCooldowns') {
            const book = this.getClassSpells(p.className) || [];
            for (const nm of e.spells || []) { const i = book.findIndex(s => s && s.name === nm); if (i >= 0 && Array.isArray(p.spellCooldowns)) p.spellCooldowns[i] = 0; }
          } else if (e.type === 'refreshDots') {
            for (const f of enemiesNear(p, e.radius || 8, 12)) { if (!Array.isArray(f.buffs)) continue; for (const b of f.buffs) if (b && b.sourceId === p.id && Number(b.periodicDamage || 0) > 0) b.remaining = Math.max(Number(b.remaining || 0), Number(b.duration || b.remaining || 0)); }
          } else if (e.type === 'summonMinions') {
            // Faithful summon capstones (Planebinder gate, Bonecaller corpse-raise).
            this.spawnSummonerTemporarySummons?.({ petType: e.petType || 'shard', color: e.color || proc.color || '#9ff7ed', tempMinionDuration: e.duration || 15, tempMinionAttackLimit: e.attackLimit || 20, petAttackMin: e.attackMin || 10, petAttackMax: e.attackMax || 16, petAttackSpeed: e.attackSpeed || 1.6 }, ctx?.target || null, e.count || 3);
          }
        }
      };

      Game.prototype.flashTalentPointPip = function() {
        this._talentPipPulse = performance.now();
        const el = document.getElementById('talentPointPip');
        if (el) { el.style.display = 'inline-block'; el.classList.add('talPipPulse'); }
      };

      // ---- panel -------------------------------------------------------------
      function ensureTalentWindow(game) {
        let panel = document.getElementById('talentPanel');
        if (panel) return panel;
        if (!document.getElementById('talentPanelStyles')) {
          const style = document.createElement('style');
          style.id = 'talentPanelStyles';
          style.textContent = `
            #talentPanel { width: min(940px, calc(100vw - 26px)); max-height: calc(100vh - 40px); overflow: auto; }
            #talentPanel .talCols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 12px; }
            #talentPanel .talCol { position: relative; overflow: hidden; border: 1px solid #4b4636; border-radius: 10px; padding: 8px 6px 12px; background: rgba(20,18,12,0.55); box-shadow: inset 0 0 44px -12px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(0,0,0,0.4); }
            #talentPanel .talColEmblem { position: absolute; left: 50%; bottom: -3%; transform: translateX(-50%); width: 96%; max-width: 300px; aspect-ratio: 1; opacity: 0.13; filter: blur(0.5px); pointer-events: none; z-index: 0; }
            #talentPanel .talColEmblem svg { width: 100%; height: 100%; display: block; }
            #talentPanel .talColHead, #talentPanel .talColBar, #talentPanel .talTier { position: relative; z-index: 1; }
            #talentPanel .talColHead { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; font-weight: 700; letter-spacing: .04em; padding: 3px 6px 6px; border-bottom: 1px solid rgba(255,255,255,0.12); margin-bottom: 2px; text-shadow: 0 1px 3px rgba(0,0,0,0.95); }
            #talentPanel .talTileName { text-shadow: 0 1px 3px rgba(0,0,0,0.95); }
            #talentPanel .talColRole { font-size: 10px; font-weight: 400; color: #9c927a; letter-spacing: .02em; margin-top: 2px; }
            #talentPanel .talColPts { font-size: 12px; color: #d9cfa8; font-variant-numeric: tabular-nums; white-space: nowrap; }
            #talentPanel .talColBar { position: relative; height: 6px; border-radius: 3px; background: rgba(0,0,0,0.45); margin: 4px 4px 2px; }
            #talentPanel .talColBarFill { height: 100%; border-radius: 3px; transition: width .15s; box-shadow: 0 0 6px -2px currentColor; }
            #talentPanel .talColBarTick { position: absolute; top: -2px; width: 2px; height: 10px; background: #cfc4a4; opacity: .55; border-radius: 1px; }
            #talentPanel .talTier { position: relative; z-index: 1; padding: 2px 0 0; }
            #talentPanel .talTierTiles { position: relative; display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; }
            /* Route: one continuous spine per column (JS-positioned through the node
               centres) glowing up to the reached tier, plus a horizontal rung joining
               sibling nodes. */
            #talentPanel .talSpine, #talentPanel .talSpineFill { position: absolute; width: 3px; transform: translateX(-50%); border-radius: 2px; z-index: 0; pointer-events: none; display: none; }
            #talentPanel .talSpine { background: rgba(120,110,80,0.26); }
            #talentPanel .talSpineFill { background: var(--spec, #d6b35a); box-shadow: 0 0 8px -1px var(--spec, #d6b35a); }
            #talentPanel .talTierRung { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); height: 3px; background: rgba(120,110,80,0.26); border-radius: 2px; z-index: 0; }
            #talentPanel .talTierRung.active { background: var(--spec, #d6b35a); box-shadow: 0 0 6px -1px var(--spec, #d6b35a); }
            #talentPanel .talTile { position: relative; z-index: 1; width: 70px; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; user-select: none; }
            #talentPanel .talTileIcon { position: relative; width: 60px; height: 60px; border-radius: 11px; border: 2px solid #5a533f; box-shadow: inset 0 0 0 1px rgba(0,0,0,.5); transition: transform .08s, border-color .1s, box-shadow .1s; }
            #talentPanel .talTileIcon .generatedItemIcon { width: 100%; height: 100%; border-radius: 7px; }
            #talentPanel .talTile:hover .talTileIcon { transform: translateY(-2px) scale(1.06); }
            #talentPanel .talTile.talAvail .talTileIcon { border-color: #d6b35a; box-shadow: 0 0 9px -1px #d6b35a, inset 0 0 0 1px rgba(0,0,0,.5); }
            #talentPanel .talTile.talInvested .talTileIcon { border-color: var(--spec, #d6b35a); box-shadow: 0 0 7px -2px var(--spec, #d6b35a); }
            #talentPanel .talTile.talMax .talTileIcon { border-color: #8fe47d; box-shadow: 0 0 9px -1px #8fe47d; }
            #talentPanel .talTile.talLocked { cursor: not-allowed; }
            #talentPanel .talTile.talLocked .talTileIcon { border-color: #3a352a; filter: grayscale(.7) brightness(.55); }
            #talentPanel .talTile.talCap .talTileIcon { width: 66px; height: 66px; border-radius: 50%; border-color: var(--spec, #ffd76a); box-shadow: 0 0 13px -1px var(--spec, #ffd76a); }
            #talentPanel .talTile.talCap .talTileIcon .generatedItemIcon { border-radius: 50%; }
            #talentPanel .talTileRank { position: absolute; right: -4px; bottom: -4px; min-width: 20px; text-align: center; font-size: 11px; font-weight: 700; padding: 0 4px; border-radius: 8px; background: #12100c; border: 1px solid #5a533f; color: #f7ead1; font-variant-numeric: tabular-nums; }
            #talentPanel .talTile.talMax .talTileRank { color: #8fe47d; border-color: #8fe47d; }
            #talentPanel .talTile.talInvested .talTileRank { border-color: var(--spec, #5a533f); }
            #talentPanel .talTileStar { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); font-size: 13px; color: var(--spec, #ffd76a); text-shadow: 0 0 4px rgba(0,0,0,.85); z-index: 2; }
            #talentPanel .talTileName { font-size: 11px; line-height: 1.0; text-align: center; color: #cfc4a4; min-height: 22px; display: flex; align-items: center; justify-content: center; overflow-wrap: anywhere; }
            #talentPanel .talTile.talLocked .talTileName { color: #7a7460; }
            #talentPanel .talHint { font-size: 11px; color: #9c927a; margin-top: 10px; }
            #talentTooltip { position: fixed; z-index: 100000; display: none; max-width: 288px; padding: 9px 12px; border-radius: 8px; background: linear-gradient(180deg, rgba(24,20,14,0.98), rgba(11,9,6,0.98)); border: 1px solid #5a533f; border-left: 3px solid #d6b35a; box-shadow: 0 10px 26px -6px rgba(0,0,0,0.88); pointer-events: none; }
            #talentTooltip .ttName { font-weight: 700; font-size: 14px; letter-spacing: .02em; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
            #talentTooltip .ttRank { font-size: 11px; color: #b3a988; margin: 1px 0 6px; }
            #talentTooltip .ttDesc { font-size: 12.5px; color: #eaddc0; line-height: 1.42; }
            #talentTooltip .ttNext { font-size: 12px; margin-top: 6px; line-height: 1.42; }
            #talentTooltip .ttGate { font-size: 11px; color: #d98a6a; margin-top: 6px; }
          `;
          document.head.appendChild(style);
        }
        panel = document.createElement('section');
        panel.id = 'talentPanel';
        panel.className = 'panel gameWindow';
        panel.style.display = 'none';
        // Centre horizontally and clamp to the viewport so the (near-full-width)
        // panel always fits on screen; sit high so the tall tree fits vertically.
        panel.style.right = 'max(13px, calc(50vw - 470px))';
        panel.style.top = '28px';
        panel.innerHTML = `
          <div class="windowHeader">
            <div>
              <div class="name" data-talent-title>Talents</div>
              <div class="small" data-talent-subtitle></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button type="button" data-talent-respec>Respec</button>
              <button type="button" data-talent-close>Close</button>
            </div>
          </div>
          <div class="small" data-talent-meta></div>
          <div class="talCols" data-talent-cols></div>
          <div class="talHint">Click a spell icon to invest a point &middot; right-click to refund.</div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('[data-talent-close]')?.addEventListener('click', () => game.toggleTalentPanel(false));
        panel.querySelector('[data-talent-respec]')?.addEventListener('click', () => game.respecTalents({}));
        panel.addEventListener('click', event => {
          const node = event.target.closest('[data-tnode]');
          if (node && !node.classList.contains('talLocked')) game.spendTalentPoint(node.dataset.tspec, node.dataset.tnode);
        });
        panel.addEventListener('contextmenu', event => {
          const node = event.target.closest('[data-tnode]');
          if (node) { event.preventDefault(); game.refundTalentPoint(node.dataset.tspec, node.dataset.tnode); }
        });
        // Styled hover tooltip.
        const tip = document.getElementById('talentTooltip') || (() => { const d = document.createElement('div'); d.id = 'talentTooltip'; document.body.appendChild(d); return d; })();
        const placeTip = event => {
          const r = tip.getBoundingClientRect(); const pad = 12;
          let x = event.clientX + 16, y = event.clientY + 18;
          if (x + r.width > window.innerWidth - pad) x = event.clientX - r.width - 16;
          if (y + r.height > window.innerHeight - pad) y = window.innerHeight - r.height - pad;
          tip.style.left = Math.max(pad, x) + 'px'; tip.style.top = Math.max(pad, y) + 'px';
        };
        panel.addEventListener('mouseover', event => {
          const tile = event.target.closest?.('.talTile');
          if (!tile) return;
          const html = game.talentTileTooltipHtml(tile.dataset.tspec, tile.dataset.tnode);
          if (!html) { tip.style.display = 'none'; return; }
          tip.innerHTML = html;
          tip.style.borderLeftColor = tile.style.getPropertyValue('--spec') || '#d6b35a';
          tip.style.display = 'block';
          placeTip(event);
        });
        panel.addEventListener('mousemove', event => { if (tip.style.display === 'block' && event.target.closest?.('.talTile')) placeTip(event); });
        panel.addEventListener('mouseout', event => { const to = event.relatedTarget; if (!to || !to.closest?.('.talTile')) tip.style.display = 'none'; });
        return panel;
      }

      // V0.17.81: styled hover tooltip content (replaces the plain native title).
      Game.prototype.talentTileTooltipHtml = function(specId, nodeId) {
        const spec = specsForClass(this.player?.className).find(s => s.id === specId);
        const node = spec?.nodes.find(n => n.id === nodeId);
        if (!spec || !node) return '';
        const rank = Math.floor(Number(this.player.talents?.spent?.[specId]?.[nodeId]) || 0);
        const gate = TIER_GATES[node.tier] || 0;
        const unlocked = treePointsFor(this.player.talents, spec) >= gate;
        const cur = renderDesc(node.desc, node.vals, Math.max(1, rank));
        const nextTxt = rank > 0 && rank < node.maxRank ? renderDesc(node.desc, node.vals, rank + 1) : '';
        let html = `<div class="ttName" style="color:${spec.color}">${node.capstone ? '★ ' : ''}${escapeHtml(node.name)}</div>`;
        html += `<div class="ttRank">Rank ${rank} / ${node.maxRank}${node.capstone ? ' · Capstone' : ''}</div>`;
        html += `<div class="ttDesc">${escapeHtml(cur)}</div>`;
        if (nextTxt) html += `<div class="ttNext" style="color:${spec.color}">Next rank: ${escapeHtml(nextTxt)}</div>`;
        if (!unlocked) html += `<div class="ttGate">Requires ${gate} points in ${escapeHtml(spec.name)}</div>`;
        return html;
      };

      Game.prototype.renderTalentPanel = function() {
        const panel = document.getElementById('talentPanel');
        if (!panel || !this.player) return;
        ensureTalentState(this.player);
        const specs = specsForClass(this.player.className);
        const t = this.player.talents;
        const avail = this.talentPointsAvailable();
        const total = this.talentPointsTotal();

        const activeSpec = this.player.talentSpec ? specs.find(s => s.id === this.player.talentSpec) : null;
        const title = panel.querySelector('[data-talent-title]');
        const subtitle = panel.querySelector('[data-talent-subtitle]');
        if (title) title.textContent = `${this.player.className} Talents`;
        if (subtitle) {
          subtitle.textContent = activeSpec ? `${activeSpec.name} — ${activeSpec.role}` : 'Untrained';
          subtitle.style.color = activeSpec ? activeSpec.color : '#b3a988';
        }
        const meta = panel.querySelector('[data-talent-meta]');
        if (meta) meta.textContent = `Points: ${avail} unspent / ${total} total`;
        const respecBtn = panel.querySelector('[data-talent-respec]');
        if (respecBtn) {
          const cost = this.talentRespecCost();
          respecBtn.textContent = cost > 0 ? `Respec (${this.formatCopper ? this.formatCopper(cost) : cost + 'c'})` : 'Respec (free)';
          respecBtn.disabled = this.talentPointsSpent() === 0;
        }

        const cols = panel.querySelector('[data-talent-cols]');
        if (!cols) return;
        // Each node borrows a real spell icon: the spell it empowers, else a
        // spec spell chosen by a stable hash of the node id (so tiles vary).
        const spells = this.getClassSpells(this.player.className) || [];
        const spellByName = {}; spells.forEach(s => { if (s && s.name) spellByName[s.name] = s; });
        const iconFor = (node, spec) => {
          if (node.icon && spellByName[node.icon]) return spellByName[node.icon];
          for (const e of node.effects || []) {
            if (e.k === 'spell' && e.match && Array.isArray(e.match.names)) {
              for (const nm of e.match.names) if (spellByName[nm]) return spellByName[nm];
            }
          }
          const emp = spec.empowers || [];
          if (emp.length) {
            let h = 0; for (const ch of String(node.id)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
            for (let k = 0; k < emp.length; k++) { const s = spellByName[emp[(h + k) % emp.length]]; if (s) return s; }
          }
          return null;
        };
        // V0.17.78: per-spec themed column background. Driven by the spec's colour
        // + a stable hash of its id (so every spec reads distinct), with a painterly
        // grain and vignette. If a spec sets `bg` (an image url/path) it is layered
        // in under a tinted veil - so hand-painted scene art drops straight in.
        const hexToRgb = hex => { let h = String(hex || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
        const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";
        const specBackground = (spec, bgUrl) => {
          const [r, g, b] = hexToRgb(spec.color);
          let h = 0; for (const c of String(spec.id)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
          const gx = 30 + (h % 40), ang = 150 + (h % 55);
          const glow = `rgba(${r},${g},${b},0.30)`;
          const themed = `radial-gradient(120% 62% at ${gx}% -8%, ${glow}, rgba(${r},${g},${b},0) 70%), linear-gradient(${ang}deg, rgba(${r},${g},${b},0.13) 0%, rgba(11,10,7,0.97) 58%, rgba(6,5,3,1) 100%), #0b0a07`;
          // Painted art (if any) sits under a tinted veil, with the procedural theme
          // BENEATH as fallback - so a missing / slow / broken image never regresses.
          if (bgUrl) return `${NOISE}, linear-gradient(rgba(9,8,6,0.28), rgba(6,5,4,0.70)), url('${bgUrl}') center/cover no-repeat, ${themed}`;
          return `${NOISE}, ${themed}`;
        };
        cols.innerHTML = specs.map(spec => {
          const treePts = treePointsFor(t, spec);
          const emblemHtml = themeSilhouetteSvg(spec);
          const body = [1, 2, 3, 4, 5].map(tier => {
            const nodes = spec.nodes.filter(n => n.tier === tier);
            if (!nodes.length) return '';
            const gate = TIER_GATES[tier] || 0;
            const unlocked = treePts >= gate;
            const tiles = nodes.map(node => {
              const rank = Math.floor(Number(t.spent[spec.id]?.[node.id]) || 0);
              const maxed = rank >= node.maxRank;
              const canSpend = unlocked && !maxed && avail > 0;
              const cls = ['talTile'];
              if (!unlocked) cls.push('talLocked');
              if (rank > 0) cls.push('talInvested');
              if (maxed) cls.push('talMax');
              if (node.capstone) cls.push('talCap');
              if (canSpend) cls.push('talAvail');
              const spell = iconFor(node, spec);
              const iconHtml = this.spellIconHtml(spell || { name: node.name, kind: 'buff', color: spec.color }, 'talentSpellIcon');
              return `<div class="${cls.join(' ')}" data-tspec="${spec.id}" data-tnode="${node.id}" style="--spec:${spec.color}">`
                + `<div class="talTileIcon">${node.capstone ? '<span class="talTileStar">★</span>' : ''}${iconHtml}<span class="talTileRank">${rank}/${node.maxRank}</span></div>`
                + `<span class="talTileName">${escapeHtml(node.name)}</span></div>`;
            }).join('');
            // Horizontal rung joining sibling nodes in this tier; the continuous
            // vertical route spine is positioned in JS (below) through the node
            // centres. Both glow once the tier is reached, dim while locked.
            const rung = nodes.length > 1 ? `<div class="talTierRung${unlocked ? ' active' : ''}" style="width:${(nodes.length - 1) * 100}px"></div>` : '';
            return `<div class="talTier${unlocked ? ' reached' : ''}" style="--spec:${spec.color}"><div class="talTierTiles">${rung}${tiles}</div></div>`;
          }).join('');
          const barPct = Math.min(100, (treePts / 18) * 100);
          const bar = `<div class="talColBar"><div class="talColBarFill" style="width:${barPct}%;color:${spec.color};background:${spec.color}"></div><div class="talColBarTick" style="left:${(TIER_GATES[5] / 18) * 100}%" title="Capstone at ${TIER_GATES[5]} points"></div></div>`;
          return `<div class="talCol" style="--spec:${spec.color}"><div class="talColEmblem">${emblemHtml}</div><div class="talSpine"></div><div class="talSpineFill"></div><div class="talColHead" style="color:${spec.color}"><div>${escapeHtml(spec.name)}<div class="talColRole">${escapeHtml(spec.role || '')}</div></div><span class="talColPts">${treePts} pts</span></div>${bar}${body}</div>`;
        }).join('');
        // Apply the themed backgrounds via JS (the SVG-noise data URI contains
        // quotes that would break an inline style="" attribute).
        // Per-spec painted-art auto-discovery: probe assets/talents/<specId>.png once
        // per session. If present it is used (an explicit data `spec.bg` wins); if
        // missing, the procedural theme shows and the result is cached so we don't
        // re-probe. Pure drop-in: add a PNG named after the spec id, reopen the panel.
        this._talentBgCache = this._talentBgCache || {};
        cols.querySelectorAll('.talCol').forEach((el, i) => {
          const sp = specs[i]; if (!sp) return;
          if (!sp.bg && this._talentBgCache[sp.id] === undefined) {
            this._talentBgCache[sp.id] = false;
            const url = `assets/talents/${sp.id}.png`;
            const img = new Image();
            img.onload = () => { this._talentBgCache[sp.id] = url; if (this._talentPanelOpen) this.renderTalentPanel(); };
            img.src = url;
          }
          const bgUrl = sp.bg || this._talentBgCache[sp.id] || null;
          el.style.background = specBackground(sp, bgUrl);
          el.style.borderColor = `rgba(${hexToRgb(sp.color).join(',')},0.45)`;
          // When real painted art exists, hide the procedural themed silhouette (the art is the theme).
          const emb = el.querySelector('.talColEmblem'); if (emb) emb.style.display = bgUrl ? 'none' : '';
          // Route spine: one continuous vertical line through every tier's node
          // centre, glowing from the top down to the last reached tier.
          const spine = el.querySelector('.talSpine'); const fill = el.querySelector('.talSpineFill');
          const tierEls = [...el.querySelectorAll('.talTier')];
          if (spine && fill && tierEls.length >= 2) {
            const cr = el.getBoundingClientRect();
            const centres = tierEls.map(te => {
              const icon = te.querySelector('.talTileIcon'); const tiles = te.querySelector('.talTierTiles');
              if (!icon || !tiles) return null;
              const ir = icon.getBoundingClientRect(), tr = tiles.getBoundingClientRect();
              return { x: tr.left + tr.width / 2 - cr.left, y: ir.top + ir.height / 2 - cr.top, reached: te.classList.contains('reached') };
            }).filter(Boolean);
            if (centres.length >= 2) {
              const top = centres[0].y, bot = centres[centres.length - 1].y, x = centres[0].x;
              let reachedY = top; for (const c of centres) if (c.reached) reachedY = c.y;
              spine.style.left = fill.style.left = x + 'px';
              spine.style.top = fill.style.top = top + 'px';
              spine.style.height = (bot - top) + 'px'; spine.style.display = 'block';
              fill.style.height = Math.max(0, reachedY - top) + 'px'; fill.style.display = reachedY > top ? 'block' : 'none';
            }
          }
        });
      };

      Game.prototype.toggleTalentPanel = function(force) {
        const panel = ensureTalentWindow(this);
        const open = typeof force === 'boolean' ? force : panel.style.display === 'none';
        this._talentPanelOpen = open;
        panel.style.display = open ? 'block' : 'none';
        if (open) { ensureTalentState(this.player); this.rebuildTalentEffects?.(); this.renderTalentPanel(); }
        else { const tt = document.getElementById('talentTooltip'); if (tt) tt.style.display = 'none'; }
      };

      // Runtime handle (spec: game.talentSystem / id 'talent-trees').
      Game.prototype.ensureTalentRuntime = function() {
        if (this.talentSystem) return this.talentSystem;
        this.talentSystem = { id: 'talent-trees', name: 'Talent Trees' };
        return this.talentSystem;
      };
    }
  };
})();
