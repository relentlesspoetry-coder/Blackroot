// Dream Realms status effect runtime system.
// V0.14.84 owner: buffs, debuffs, DoTs, HoTs, status tray icon generation, and status tooltip rendering.
(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  const clamp = DR.utils?.clamp || ((v, min, max) => Math.max(min, Math.min(max, v)));

  const STATUS_SAVE_VERSION = 1;
  const HOSTILE_TYPES = new Set(['debuff', 'dot', 'control']);
  const CONTROL_TAGS = new Set(['stun', 'root', 'silence', 'slow']);

  // V0.20.27 (Roadmap Item 19): a control effect is either typed 'control' or carries a control tag
  // (a slow can ship as a 'debuff' with a 'slow' tag). Both are subject to controlResistancePct.
  function isControlEffect(e) {
    if (!e) return false;
    if (e.type === 'control') return true;
    const tags = e.tags;
    if (Array.isArray(tags)) for (const t of tags) if (CONTROL_TAGS.has(String(t).toLowerCase())) return true;
    return false;
  }

  // V0.20.30 (Roadmap Item 19): a target's BASE control resistance. An explicit data value (on the
  // entity or its baseType) always wins - a designer can tune any single enemy. Otherwise it falls
  // back to a tier default, so bosses shrug off chain-CC and normal mobs are unaffected, WITHOUT
  // touching every enemy's data. Players have none of these flags, so their base stays 0 and only
  // their buffs contribute - the V0.20.27 behaviour, unchanged.
  function baseControlResistance(target) {
    const explicit = safeNumber(target.controlResistancePct ?? target.baseType?.controlResistancePct, NaN);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const rank = String(target.rank || target.baseType?.rank || '').toLowerCase();
    if (target.dungeonBoss || target.baseType?.dungeonBoss || /(^|[^i])\bboss\b/.test(rank)) return 0.55;
    if (target.dungeonMiniBoss || target.baseType?.dungeonMiniBoss || /mini-?boss/.test(rank)) return 0.40;
    if (target.elite === true || target.baseType?.elite === true || /elite/.test(rank)) return 0.20;
    return 0;
  }

  // Aggregate control resistance for a target: the tier/explicit base (above) plus every active buff's
  // controlResistancePct. Capped at 0.9 - resistance shortens control, it never fully immunizes here.
  function controlResistanceOf(target) {
    if (!target) return 0;
    let r = baseControlResistance(target);
    if (Array.isArray(target.buffs)) {
      for (const b of target.buffs) {
        if (b && safeNumber(b.remaining, 0) > 0) r += safeNumber(b.controlResistancePct, 0);
      }
    }
    return Math.max(0, Math.min(0.9, r));
  }
  const STAT_LABELS = {
    attack: 'attack', defense: 'defense', hp: 'maximum health', mana: 'maximum mana', spirit: 'spirit',
    stamina: 'stamina', strength: 'strength', dexterity: 'dexterity', intellect: 'intellect', wisdom: 'wisdom',
    speed: 'speed', haste: 'haste', crit: 'critical strike', critChance: 'critical strike', healPower: 'healing power',
    resist: 'resistance', armor: 'armor'
  };

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  // V0.20.46 (perf): slug does two regex replaces plus several string allocations, and is called on hot
  // paths with the SAME constant literals ('stun', 'root', 'silence', ...) hundreds of times a frame.
  // The inputs are a tiny fixed vocabulary, so memoise them. Bounded so a pathological caller passing
  // unique strings cannot grow it without limit.
  const SLUG_CACHE = new Map();
  function slug(value) {
    const raw = typeof value === 'string' ? value : String(value || 'status');
    const hit = SLUG_CACHE.get(raw);
    if (hit !== undefined) return hit;
    const out = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'status';
    if (SLUG_CACHE.size < 512) SLUG_CACHE.set(raw, out);
    return out;
  }

  function alive(entity) {
    return Boolean(entity && entity.alive !== false && Number.isFinite(Number(entity.x)) && Number.isFinite(Number(entity.y)));
  }

  function actorList(game) {
    const actors = [];
    if (Array.isArray(game?.enemies)) actors.push(...game.enemies);
    for (const actor of [game?.player, game?.merc, game?.pet]) if (actor) actors.push(actor);
    if (Array.isArray(game?.botPlayers)) actors.push(...game.botPlayers);
    if (game?.remotePlayers instanceof Map) {
      for (const actor of game.remotePlayers.values()) if (actor) actors.push(actor);
    }
    return actors.filter(alive);
  }

  function normalizeMods(mods) {
    const out = {};
    if (!mods || typeof mods !== 'object' || Array.isArray(mods)) return out;
    for (const [key, value] of Object.entries(mods)) {
      const n = Number(value);
      if (Number.isFinite(n) && n !== 0) out[key] = n;
    }
    return out;
  }

  function normalizeTags(effect = {}) {
    const tags = new Set();
    const raw = effect.tags;
    if (Array.isArray(raw)) raw.forEach(tag => tags.add(slug(tag)));
    else if (typeof raw === 'string') raw.split(/[\s,]+/).forEach(tag => tag && tags.add(slug(tag)));

    const id = slug(effect.id || effect.name);
    const name = String(effect.name || '').toLowerCase();
    if (id.includes('stun') || name.includes('stun')) tags.add('stun');
    if (id.includes('root') || id.includes('snare') || name.includes('root') || name.includes('snare')) tags.add('root');
    if (id.includes('silence') || name.includes('silence')) tags.add('silence');
    if (id.includes('slow') || id.includes('lullaby') || name.includes('slow')) tags.add('slow');
    if (id.includes('poison') || id.includes('venom') || name.includes('poison') || name.includes('venom')) tags.add('poison');
    if (id.includes('curse') || id.includes('hex') || name.includes('curse') || name.includes('hex')) tags.add('curse');
    if (id.includes('burn') || id.includes('fire') || name.includes('burn') || name.includes('fire')) tags.add('burn');
    if (id.includes('frost') || id.includes('ice') || name.includes('frost') || name.includes('ice')) tags.add('frost');
    if (id.includes('bleed') || id.includes('rupture') || name.includes('bleed') || name.includes('rupture')) tags.add('bleed');
    if (id.includes('armor') || id.includes('ward') || id.includes('shield') || name.includes('armor') || name.includes('ward') || name.includes('shield')) tags.add('ward');
    if (id.includes('invuln') || name.includes('invuln')) tags.add('invulnerable');
    if (id.includes('song') || id.includes('anthem') || id.includes('ballad') || id.includes('verse') || name.includes('song') || name.includes('anthem') || name.includes('ballad') || name.includes('verse')) tags.add('song');
    if (id.includes('pet') || id.includes('servant') || id.includes('familiar') || name.includes('pet') || name.includes('servant') || name.includes('familiar')) tags.add('pet');
    if (safeNumber(effect.periodicDamage ?? effect.tickDamage, 0) > 0) tags.add('dot');
    if (effect.hostile === true || HOSTILE_TYPES.has(String(effect.type || effect.kind || '').toLowerCase())) tags.add('debuff');
    return Array.from(tags);
  }

  function statLabel(key) {
    return STAT_LABELS[key] || String(key || '').replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().toLowerCase() || 'stat';
  }

  function describeMods(mods) {
    const entries = Object.entries(mods || {}).filter(([, value]) => Number(value) !== 0);
    if (!entries.length) return '';
    return entries.map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${statLabel(key)}`).join(', ');
  }

  function describeModSentence(mods) {
    const entries = Object.entries(mods || {}).filter(([, value]) => Number(value) !== 0);
    if (!entries.length) return '';
    return entries.map(([key, value]) => {
      const label = statLabel(key);
      return value > 0 ? `Increases ${label} by ${Math.abs(value)}` : `Reduces ${label} by ${Math.abs(value)}`;
    }).join('. ') + '.';
  }

  function buildEffectDescription(effect) {
    const explicit = String(effect?.description || effect?.text || '').trim();
    if (explicit) return explicit;
    const parts = [];
    const modSentence = describeModSentence(effect?.mods);
    if (modSentence) parts.push(modSentence);
    if (safeNumber(effect?.periodicDamage, 0) > 0) {
      parts.push(`Deals ${Math.round(effect.periodicDamage * Math.max(1, safeNumber(effect?.stacks, 1)))} ${effect.damageType || 'magic'} damage every ${Math.max(0.2, safeNumber(effect.tickRate, 1)).toFixed(1).replace(/\.0$/, '')}s.`);
    }
    if (safeNumber(effect?.periodicHealing, 0) > 0) {
      parts.push(`Restores ${Math.round(effect.periodicHealing * Math.max(1, safeNumber(effect?.stacks, 1)))} health every ${Math.max(0.2, safeNumber(effect.tickRate, 1)).toFixed(1).replace(/\.0$/, '')}s.`);
    }
    if (safeNumber(effect?.periodicMana, 0) > 0) {
      parts.push(`Restores ${Math.round(effect.periodicMana * Math.max(1, safeNumber(effect?.stacks, 1)))} mana every ${Math.max(0.2, safeNumber(effect.tickRate, 1)).toFixed(1).replace(/\.0$/, '')}s.`);
    }
    if (!parts.length) {
      if (effect?.hostile) return 'Negative status effect.';
      if (String(effect?.type || '').toLowerCase() === 'hot') return 'Healing over time effect.';
      return 'Positive status effect.';
    }
    return parts.join(' ');
  }

  function statusTheme(effect) {
    const id = String(effect?.id || effect?.name || '').toLowerCase();
    const tags = Array.isArray(effect?.tags) ? effect.tags : [];
    const type = String(effect?.type || '').toLowerCase();
    const has = token => id.includes(token) || tags.includes(token);
    if (has('poison') || has('venom') || has('rot')) return { family: 'status_poison', glyph: '☠', color: '#76d36b' };
    if (has('curse') || has('hex') || has('shadow') || has('dark') || has('doom')) return { family: 'status_curse', glyph: '✦', color: '#b278ff' };
    if (has('bleed') || has('rupture') || has('wound')) return { family: 'status_bleed', glyph: '✹', color: '#ff7171' };
    if (has('burn') || has('fire')) return { family: 'status_burn', glyph: '✷', color: '#ff9b57' };
    if (has('frost') || has('ice') || has('chill')) return { family: 'status_frost', glyph: '❄', color: '#94e0ff' };
    if (has('root')) return { family: 'status_root', glyph: '⌘', color: '#83c96c' };
    if (has('slow')) return { family: 'status_slow', glyph: '⌁', color: '#8fb7ff' };
    if (has('stun')) return { family: 'status_stun', glyph: '✦', color: '#f0d66e' };
    if (has('silence')) return { family: 'status_silence', glyph: '◌', color: '#d1c4ff' };
    if (has('ward') || has('shield') || has('armor')) return { family: 'status_ward', glyph: '▣', color: '#d2c6a0' };
    if (has('song') || has('anthem') || has('ballad') || has('verse')) return { family: 'status_song', glyph: '♫', color: '#ffd571' };
    if (has('pet') || has('servant') || has('familiar') || has('bone')) return { family: 'status_pet', glyph: '☠', color: '#d7dfba' };
    if (type === 'hot' || safeNumber(effect?.periodicHealing, 0) > 0 || has('heal') || has('regen') || has('restor')) return { family: 'status_heal', glyph: '✚', color: '#79e0a1' };
    if (has('mana') || has('clarity') || has('focus') || has('mind') || has('spirit')) return { family: 'status_mana', glyph: '✦', color: '#73b8ff' };
    if (!effect?.hostile && (has('speed') || has('haste') || has('nimble') || has('quick'))) return { family: 'status_haste', glyph: '➤', color: '#ffe176' };
    if (effect?.hostile || type === 'debuff' || type === 'dot' || type === 'control') return { family: 'status_debuff', glyph: '▾', color: effect?.color || '#d98f68' };
    return { family: 'status_buff', glyph: '▲', color: effect?.color || '#8fe47d' };
  }

  function iconFor(effect) {
    return statusTheme(effect).glyph;
  }

  function normalizeSpellIconDescriptor(icon = null) {
    if (!icon || typeof icon !== 'object') return null;
    return {
      family: String(icon.family || 'spell_generic')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_') || 'spell_generic',
      glyph: String(icon.glyph || ''),
      color: String(icon.color || '#d8ded1'),
      accent: String(icon.accent || icon.color || '#d8ded1'),
      imagePath: String(icon.imagePath || '')
    };
  }

  // A status effect created from a class spell (systems/spell-system.js
  // Game.prototype.decorateStatusEffectFromSpell) already carries its own
  // spellIconDescriptor - that is the fast path below. The fallback search
  // is only needed for effects normalized before that metadata existed
  // (e.g. an older save) that still identify their source spell by id/name.
  // This never duplicates DR.SpellIcons' resolution logic - it only looks
  // the already-compiled spellbook up and asks DR.SpellIcons to describe it.
  function spellIconDescriptorForStatus(effect = {}) {
    const direct = normalizeSpellIconDescriptor(
      effect.spellIconDescriptor ||
      effect.iconDescriptor ||
      effect.icon
    );
    if (direct) return direct;

    const spellBook = DR.CLASS_SPELL_BOOK || {};
    const spellIcons = DR.SpellIcons;
    if (!spellIcons?.descriptorForSpell) return null;

    const wantedId = String(effect.sourceSpellId || '').toLowerCase();
    const wantedName = String(effect.sourceSpellName || effect.name || '').toLowerCase();
    const wantedClass = String(effect.sourceClass || '').toLowerCase();
    if (!wantedId && !wantedName) return null;

    for (const [className, spells] of Object.entries(spellBook)) {
      if (wantedClass && className.toLowerCase() !== wantedClass) continue;
      for (const spell of spells || []) {
        const spellId = String(
          spell.id ||
          spell.spellId ||
          spell.paladinSpellId ||
          spell.wardenSpellId ||
          spell.fighterSpellId ||
          spell.rogueSpellId ||
          spell.rangerSpellId ||
          spell.assassinSpellId ||
          spell.wizardSpellId ||
          spell.shamanSpellId ||
          spell.summonerSpellId ||
          spell.necroSpellId ||
          spell.necromancerSpellId ||
          spell.clericSpellId ||
          spell.druidSpellId ||
          spell.bardSpellId ||
          spell.enchanterSpellId ||
          ''
        ).toLowerCase();

        const spellName = String(spell.name || '').toLowerCase();
        const buffName = String(spell.buffName || '').toLowerCase();
        const debuffName = String(spell.debuffName || '').toLowerCase();

        const idMatch = wantedId && spellId && wantedId === spellId;
        const nameMatch = wantedName && (
          wantedName === spellName ||
          wantedName === buffName ||
          wantedName === debuffName
        );

        if (idMatch || nameMatch) {
          return normalizeSpellIconDescriptor(spellIcons.descriptorForSpell(spell, className));
        }
      }
    }
    return null;
  }

  function iconHtmlFor(effect) {
    const spellIcon = spellIconDescriptorForStatus(effect);
    const icon = spellIcon || statusTheme(effect);
    const family = String(icon.family || 'status_buff').toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'status_buff';
    const color = icon.color || effect?.color || '#cfe7aa';
    const accent = icon.accent || color;
    const glyph = icon.glyph || iconFor(effect);
    const imagePath = icon.imagePath ? String(icon.imagePath) : '';

    if (imagePath) {
      return `<div class="statusIcon generatedItemIcon spellImageIcon icon-${escapeHtml(family)}" style="--icon-color:${escapeHtml(color)};--icon-accent:${escapeHtml(accent)}" data-icon-family="${escapeHtml(family)}" data-icon-image="1"><img class="spellIconImageAsset" src="${escapeHtml(imagePath)}" alt="${escapeHtml(effect?.name || 'Status icon')}" draggable="false"><span class="iconCore"></span><span class="iconGlyph">${escapeHtml(glyph)}</span></div>`;
    }
    return `<div class="statusIcon generatedItemIcon icon-${escapeHtml(family)}" style="--icon-color:${escapeHtml(color)}" data-icon-family="${escapeHtml(family)}"><span class="iconCore"></span><span class="iconGlyph">${escapeHtml(glyph)}</span></div>`;
  }

  function statusCardColor(effect) {
    const spellIcon = spellIconDescriptorForStatus(effect);
    return (spellIcon || statusTheme(effect)).color || effect?.color || '#cfe7aa';
  }

  function formatStatusDuration(seconds) {
    const value = Math.max(0, safeNumber(seconds, 0));
    if (value >= 60) {
      const mins = Math.floor(value / 60);
      const secs = Math.round(value - mins * 60);
      return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
    }
    return value.toFixed(1).replace(/\.0$/, '') + 's';
  }

  function formatStatusTimerLabel(seconds) {
    const value = Math.max(0, safeNumber(seconds, 0));
    const totalSeconds = Math.ceil(value);
    if (totalSeconds >= 3600) {
      const hours = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      return `${hours}:${String(mins).padStart(2, '0')}h`;
    }
    if (totalSeconds >= 60) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    return `${totalSeconds}s`;
  }

  function tooltipFor(effect) {
    const seconds = formatStatusDuration(effect?.remaining);
    const stacks = safeNumber(effect?.stacks, 1) > 1 ? ` x${effect.stacks}` : '';
    const type = String(effect?.hostile ? (effect?.type || 'debuff') : (effect?.type || 'buff')).replace(/^./, ch => ch.toUpperCase());
    const parts = [`${effect?.name || 'Status'}${stacks}`, type, `${seconds} remaining`, buildEffectDescription(effect)];
    const source = effect?.sourceName && effect.sourceName !== 'Unknown' ? effect.sourceName : '';
    if (source) parts.push(`Source: ${source}`);
    return parts.filter(Boolean).join(' · ');
  }

  function tooltipHtmlFor(effect) {
    const seconds = formatStatusDuration(effect?.remaining);
    const duration = formatStatusDuration(Math.max(0.1, safeNumber(effect?.duration, 0)));
    const type = String(effect?.hostile ? (effect?.type || 'debuff') : (effect?.type || 'buff')).replace(/^./, ch => ch.toUpperCase());
    const modLine = describeMods(effect?.mods);
    const icon = iconHtmlFor(effect).replace('statusIcon ', 'statusTooltipIcon ');
    const stacks = safeNumber(effect?.stacks, 1) > 1 ? `<div class="statusTooltipMeta">Stacks: ${Math.floor(effect.stacks)} / ${Math.max(1, Math.floor(effect.maxStacks || effect.stacks || 1))}</div>` : '';
    const source = effect?.sourceName && effect.sourceName !== 'Unknown' ? effect.sourceName : 'Unknown';
    const tagLine = Array.isArray(effect?.tags) && effect.tags.length ? effect.tags.join(', ') : '';
    const tickBits = [];
    if (safeNumber(effect?.periodicDamage, 0) > 0) tickBits.push(`Tick Damage: ${Math.round(effect.periodicDamage * Math.max(1, safeNumber(effect?.stacks, 1)))}`);
    if (safeNumber(effect?.periodicHealing, 0) > 0) tickBits.push(`Tick Healing: ${Math.round(effect.periodicHealing * Math.max(1, safeNumber(effect?.stacks, 1)))}`);
    if (safeNumber(effect?.periodicMana, 0) > 0) tickBits.push(`Tick Mana: ${Math.round(effect.periodicMana * Math.max(1, safeNumber(effect?.stacks, 1)))}`);
    if (safeNumber(effect?.tickRate, 0) > 0 && tickBits.length) tickBits.push(`Tick Rate: ${Math.max(0.2, safeNumber(effect.tickRate, 1)).toFixed(1).replace(/\.0$/, '')}s`);
    const tickBlock = tickBits.length ? `<div class="tooltipSection"><div class="tooltipSectionTitle">Periodic</div>${tickBits.map(line => `<div class="tooltipEffect">${escapeHtml(line)}</div>`).join('')}</div>` : '';
    return `
      <div class="statusTooltipCard ${escapeHtml(effect?.hostile ? 'debuff' : 'buff')}" style="--status-tooltip-color:${escapeHtml(statusCardColor(effect))}">
        <div class="tooltipHeader statusTooltipHeader" style="--rarity-color:${escapeHtml(statusCardColor(effect))}">
          ${icon}
          <div>
            <div class="tooltipName statusTooltipName">${escapeHtml(effect?.name || 'Status Effect')}</div>
            <div class="tooltipMeta">${escapeHtml(type)}</div>
            <div class="tooltipSubMeta">${escapeHtml(seconds)} remaining · ${escapeHtml(duration)} total</div>
            ${stacks}
          </div>
        </div>
        <div class="tooltipDivider"></div>
        <div class="tooltipSection">
          <div class="tooltipSectionTitle">Description</div>
          <div class="tooltipEffect">${escapeHtml(buildEffectDescription(effect))}</div>
        </div>
        ${modLine ? `<div class="tooltipSection"><div class="tooltipSectionTitle">Effect</div><div class="tooltipStat">${escapeHtml(modLine)}</div></div>` : ''}
        ${tickBlock}
        <div class="tooltipSection">
          <div class="tooltipSectionTitle">Source</div>
          <div class="tooltipLine">${escapeHtml(source)}</div>
        </div>
        ${tagLine ? `<div class="tooltipSection"><div class="tooltipSectionTitle">Tags</div><div class="tooltipLine">${escapeHtml(tagLine)}</div></div>` : ''}
      </div>`;
  }

  function normalizeEffect(effect = {}, source = null) {
    const name = String(effect.name || effect.id || 'Status Effect').slice(0, 40);
    const id = slug(effect.id || effect.statusId || name);
    const duration = Math.max(0.1, safeNumber(effect.duration ?? effect.remaining, 1));
    const tickRate = Math.max(0.2, safeNumber(effect.tickRate ?? effect.tickIntervalSeconds, 0));
    const periodicDamage = Math.max(0, safeNumber(effect.periodicDamage ?? effect.tickDamage, 0));
    const periodicHealing = Math.max(0, safeNumber(effect.periodicHealing ?? effect.tickHealing, 0));
    const periodicMana = Math.max(0, safeNumber(effect.periodicMana ?? effect.tickMana, 0));
    const mods = normalizeMods(effect.mods || effect.statModifiers);
    const tags = normalizeTags({ ...effect, id, name });
    let type = String(effect.type || effect.kind || '').toLowerCase();
    if (!type) {
      if (periodicDamage > 0) type = 'dot';
      else if (periodicHealing > 0 || periodicMana > 0) type = 'hot';
      else if (tags.some(tag => CONTROL_TAGS.has(tag))) type = 'control';
      else type = Object.values(mods).some(v => v < 0) ? 'debuff' : 'buff';
    }
    const maxStacks = Math.max(1, Math.min(20, Math.floor(safeNumber(effect.maxStacks, 1))));
    const stacks = Math.max(1, Math.min(maxStacks, Math.floor(safeNumber(effect.stacks, 1))));
    const theme = statusTheme({ ...effect, id, name, tags, type, hostile: effect.hostile != null ? Boolean(effect.hostile) : HOSTILE_TYPES.has(type), periodicDamage, periodicHealing, periodicMana });

    const normalized = {
      version: STATUS_SAVE_VERSION,
      id,
      name,
      type,
      remaining: Math.min(duration, Math.max(0.1, safeNumber(effect.remaining, duration))),
      duration,
      tickRate,
      tickTimer: tickRate > 0 ? Math.max(0, safeNumber(effect.tickTimer, tickRate)) : 0,
      stacks,
      maxStacks,
      mods,
      periodicDamage,
      periodicHealing,
      periodicMana,
      damageType: String(effect.damageType || (type === 'dot' ? 'magic' : 'physical')).toLowerCase(),
      canCrit: effect.canCrit === true,
      color: effect.color || theme.color || (type === 'buff' || type === 'hot' ? '#8fe47d' : '#d98f68'),
      description: String(effect.description || effect.text || '').trim(),
      sourceId: effect.sourceId ?? source?.id ?? null,
      sourceKind: effect.sourceKind || source?.kind || null,
      sourceName: effect.sourceName || source?.name || 'Unknown',
      hostile: effect.hostile != null ? Boolean(effect.hostile) : HOSTILE_TYPES.has(type),
      cleanseType: slug(effect.cleanseType || (tags.includes('poison') ? 'poison' : '')),
      isCurable: effect.isCurable !== false,
      clearsOnDeath: effect.clearsOnDeath !== false && (effect.hostile != null ? Boolean(effect.hostile) : HOSTILE_TYPES.has(type)),
      tags,
      drainHealPct: safeNumber(effect.drainHealPct, 0),
      necromancerDot: effect.necromancerDot === true,
      necromancerDrain: effect.necromancerDrain === true,
      sourceClass: effect.sourceClass || null,
      sourceSpellId: effect.sourceSpellId || null,
      sourceSpellName: effect.sourceSpellName || null,
      spellIconDescriptor: normalizeSpellIconDescriptor(effect.spellIconDescriptor || effect.iconDescriptor || effect.icon),
      dotDamageMultiplier: safeNumber(effect.dotDamageMultiplier, 0),
      drainHealingMultiplier: safeNumber(effect.drainHealingMultiplier, 0),
      petDamageMultiplier: safeNumber(effect.petDamageMultiplier, 0),
      allyHealingReceivedMultiplier: safeNumber(effect.allyHealingReceivedMultiplier, 0),
      physicalDamageTakenMultiplier: safeNumber(effect.physicalDamageTakenMultiplier, 0),
      healingReceivedMultiplier: safeNumber(effect.healingReceivedMultiplier, 0),
      damageTakenMultiplier: safeNumber(effect.damageTakenMultiplier, 0),
      damageDoneMultiplier: safeNumber(effect.damageDoneMultiplier, 0),
      threatGenerationMultiplier: safeNumber(effect.threatGenerationMultiplier, 0),
      magicDamageTakenMultiplier: safeNumber(effect.magicDamageTakenMultiplier, 0),
      consumeOnHit: effect.consumeOnHit === true,
      damageRedirectPct: safeNumber(effect.damageRedirectPct, 0),
      redirectActorId: effect.redirectActorId ?? null,
      flatThreatPerRedirect: safeNumber(effect.flatThreatPerRedirect, 0),
      reflectPreventedPct: safeNumber(effect.reflectPreventedPct, 0),
      reflectCap: safeNumber(effect.reflectCap, 0),
      necromancySpellDamageMultiplier: safeNumber(effect.necromancySpellDamageMultiplier, 0),
      absorbRemaining: Math.max(0, safeNumber(effect.absorbRemaining, 0)),
      lethalSave: effect.lethalSave === true,
      healingMultiplier: safeNumber(effect.healingMultiplier, 0),
      holyDamageMultiplier: safeNumber(effect.holyDamageMultiplier, 0),
      wardMultiplier: safeNumber(effect.wardMultiplier, 0),
      majorSong: effect.majorSong === true,
      // V0.18.66 (Roadmap Item 13): carry the effect-policy category through normalization so a
      // categorized effect (food/potion/etc) stays recognizable to DR.effectPolicy.categoryOf
      // after it is normalized and stored. null for everything that doesn't opt in.
      effectCategory: (effect.effectCategory && String(effect.effectCategory)) || null,
      moveSpeedMultiplier: safeNumber(effect.moveSpeedMultiplier, 0),
      // V0.20.27 (Roadmap Item 19 "crowd-control resistance"): authored on 3 player buffs (Unstoppable
      // Footwork, Spirit Walk, Blink) but NOT in this whitelist, so normalization STRIPPED it - the
      // buffs carried no resistance to read. Preserved here, then consumed in applyToEntity.
      controlResistancePct: safeNumber(effect.controlResistancePct, 0),
      dotAmpPct: safeNumber(effect.dotAmpPct, 0),
      drainAmpPct: safeNumber(effect.drainAmpPct, 0),
      petDamageBonusPct: safeNumber(effect.petDamageBonusPct, 0),
      nextDotBonusPct: safeNumber(effect.nextDotBonusPct, 0),
      appliedAt: safeNumber(effect.appliedAt, (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()))
    };
    if (!normalized.description) normalized.description = buildEffectDescription(normalized);
    return normalized;
  }

  function findSource(game, sourceId) {
    if (sourceId == null || !game) return null;
    const actors = actorList(game);
    return actors.find(actor => actor.id === sourceId) || null;
  }

  function activeSilkWebDungeon(game) {
    if (!game || game.currentZone !== 'dungeon') return false;
    const active = game.dungeonSystem?.state?.active || game.activeDungeon || null;
    return String(active?.dungeonId || active?.id || '') === 'silk_web_cavern';
  }

  function isPoisonLikeEffect(effect = {}) {
    const text = `${effect.id || ''} ${effect.statusId || ''} ${effect.name || ''} ${effect.type || ''} ${effect.kind || ''} ${effect.cleanseType || ''}`.toLowerCase();
    const tags = Array.isArray(effect.tags) ? effect.tags.map(tag => String(tag).toLowerCase()) : [];
    return text.includes('poison') || text.includes('venom') || tags.includes('poison') || tags.includes('venom');
  }

  function isFriendlySilkPoisonTarget(game, target = null) {
    if (!target) return false;
    if (target === game?.player) return true;
    const kind = String(target.kind || '').toLowerCase();
    return kind === 'bot' || kind === 'merc' || kind === 'pet' || kind === 'player' || kind === 'remoteplayer' || kind === 'remote_player';
  }

  function isAllowedSilkPoisonSource(source = null, effect = {}) {
    const sourceType = String(source?.type || source?.kind || effect.sourceKind || '').toLowerCase();
    const sourceId = String(source?.id || source?.objectId || effect.sourceId || '').toLowerCase();
    const sourceName = String(source?.name || effect.sourceName || '').toLowerCase();
    const sourceHazard = String(source?.hazardKind || effect.hazardKind || '').toLowerCase();

    if (sourceType === 'venomsack' || sourceType === 'venom_sack' || sourceHazard === 'venom_sack' || sourceId.includes('venom_sack')) return true;

    const sourceIsEnemy = sourceType === 'enemy' || effect.sourceKind === 'enemy';
    const sourceIsSilkSpider = Boolean(source?.silkWebCavern || source?.spiderFamily || source?.baseType?.spiderFamily || source?.baseType?.family === 'silk_web_miniboss' || source?.baseType?.family === 'silk_web_boss')
      || /spider|silk|web|venom|brood|matron|queen|skirr|arakh|velyra|widow|old venomsac|venom-eye/.test(sourceName);
    const sourceIsEliteOrBoss = Boolean(source?.elite || source?.dungeonElite || source?.dungeonMiniBoss || source?.dungeonBoss || source?.boss || source?.named || source?.baseType?.elite || source?.baseType?.named)
      || /boss|miniboss|queen|matron|broodwarden|old venomsac|widow|venom-eye/.test(sourceId + ' ' + sourceName);
    return sourceIsEnemy && sourceIsSilkSpider && sourceIsEliteOrBoss;
  }

  function activeRootControlEffect(entity) {
    const effects = Array.isArray(entity?.buffs) ? entity.buffs : [];
    return effects.find(effect => safeNumber(effect?.remaining, 0) > 0 && Array.isArray(effect?.tags) && effect.tags.includes('root')) || null;
  }

  function rootVfxActorKindAllowed(actor) {
    const kind = String(actor?.kind || '').toLowerCase();
    // Player-facing control feedback is required for player/bot/merc/pet targets;
    // enemies are allowed as well for future player roots, but dead/corpse actors are excluded.
    return !!actor && actor.alive !== false && kind !== 'corpse';
  }

  function retireRootEntangleVfx(game, actor) {
    const current = actor?._rootEntangleVfx || null;
    if (current && Array.isArray(game?.effects) && game.effects.includes(current)) {
      current.releasing = true;
      current.statusRemaining = 0;
      current.life = Math.min(safeNumber(current.life, 0), safeNumber(current.t, 0) + 0.22);
    }
    if (actor) actor._rootEntangleVfx = null;
  }

  function syncRootEntangleVfx(game, actor) {
    if (!game || !actor || !rootVfxActorKindAllowed(actor)) return;
    const rootEffect = activeRootControlEffect(actor);
    if (!rootEffect) {
      retireRootEntangleVfx(game, actor);
      return;
    }
    const effects = Array.isArray(game.effects) ? game.effects : null;
    const current = actor._rootEntangleVfx;
    if (current && effects?.includes(current)) {
      current.x = safeNumber(actor.x, current.x);
      current.y = safeNumber(actor.y, current.y);
      current.followId = actor.id || current.followId || null;
      current.statusRemaining = safeNumber(rootEffect.remaining, 0);
      current.statusDuration = Math.max(safeNumber(rootEffect.duration, rootEffect.remaining), safeNumber(rootEffect.remaining, 0), 0.2);
      current.color = rootEffect.color || current.color || '#91bd68';
      current.color2 = current.color2 || '#b6dc72';
      current.life = Math.max(safeNumber(current.life, 0), safeNumber(current.t, 0) + Math.max(0.24, Math.min(8, current.statusRemaining + 0.20)));
      current.releasing = false;
      return;
    }
    const effect = game.obtainRuntimeEffect?.('rotlingRootEntangle') || { type: 'rotlingRootEntangle' };
    effect.type = 'rotlingRootEntangle';
    effect.x = safeNumber(actor.x, 0);
    effect.y = safeNumber(actor.y, 0);
    effect.x2 = effect.x;
    effect.y2 = effect.y;
    effect.followId = actor.id || null;
    effect.targetId = actor.id || null;
    effect.targetKind = actor.kind || '';
    effect.color = rootEffect.color || '#91bd68';
    effect.color2 = '#b6dc72';
    effect.kind = 'rotling-root-entangle';
    effect.style = 'root-entangle';
    effect.school = 'nature';
    effect.seed = safeNumber(rootEffect.seed, 0) || game.nextEffectSeed?.(actor.id || actor.x + actor.y) || 1;
    effect.t = 0;
    effect.statusRemaining = safeNumber(rootEffect.remaining, 0);
    effect.statusDuration = Math.max(safeNumber(rootEffect.duration, rootEffect.remaining), safeNumber(rootEffect.remaining, 0), 0.2);
    effect.life = Math.max(0.45, Math.min(8.5, effect.statusRemaining + 0.25));
    effect.releasing = false;
    actor._rootEntangleVfx = game.addEffect?.(effect) || effect;
  }

  function sortedTrayEffects(entity) {
    const effects = Array.isArray(entity?.buffs) ? entity.buffs.filter(effect => safeNumber(effect?.remaining, 0) > 0) : [];
    return effects.sort((a, b) => {
      const hostility = Number(Boolean(a?.hostile)) - Number(Boolean(b?.hostile));
      if (hostility) return hostility;
      const appliedDelta = safeNumber(b?.appliedAt, 0) - safeNumber(a?.appliedAt, 0);
      if (appliedDelta) return appliedDelta;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  }

  DR.StatusEffects = {
    STATUS_SAVE_VERSION,
    normalizeEffect,
    iconFor,
    tooltipFor,
    tooltipHtmlFor,
    iconHtmlFor,

    applyToEntity(target, effect, source = null, game = null) {
      if (!target || target.alive === false) return null;
      if (!Array.isArray(target.buffs)) target.buffs = [];
      const normalized = normalizeEffect(effect, source);
      // V0.20.27 (Roadmap Item 19): the single crowd-control-resistance gate, at the one point every
      // status effect passes through. A control effect's duration is scaled by (1 - the target's
      // aggregate controlResistancePct), summed from the target's active buffs plus an optional base
      // field on the entity/baseType (so a boss can be given CC resistance in data). Capped at 0.9 so
      // this path shortens control but never grants full immunity - that would be a separate explicit
      // flag. Non-control effects are untouched. Applied before both the refresh and new-push paths.
      if (isControlEffect(normalized)) {
        const resist = controlResistanceOf(target);
        if (resist > 0) {
          const factor = Math.max(0.1, 1 - resist);
          normalized.duration = Math.max(0.1, safeNumber(normalized.duration, 0) * factor);
          normalized.remaining = Math.min(safeNumber(normalized.remaining, normalized.duration), normalized.duration);
        }
      }
      const existing = target.buffs.find(buff => buff.id === normalized.id);
      if (existing) {
        const nextStacks = Math.min(existing.maxStacks || 1, safeNumber(existing.stacks, 1) + 1);
        Object.assign(existing, normalized, {
          stacks: nextStacks,
          remaining: Math.max(safeNumber(existing.remaining, 0), normalized.duration),
          tickTimer: normalized.tickRate > 0 ? Math.min(safeNumber(existing.tickTimer, normalized.tickRate), normalized.tickRate) : 0
        });
        existing.description = buildEffectDescription(existing);
        if (game?.spawnStatusPulse) game.spawnStatusPulse(target, existing.color || normalized.color, existing.name);
        return existing;
      }
      normalized.description = buildEffectDescription(normalized);
      // V0.18.66 (Roadmap Item 13): the effect policy is the single automatic concurrency
      // enforcement point for NEW effects. For a categorized effect (bard major songs now;
      // food/potions later) it drops the oldest of that category to make room, or denies the
      // incoming outright when the policy says overflow=rejectNew. Uncategorized effects
      // (categoryOf -> null) are left completely untouched, so every existing effect behaves
      // exactly as before.
      const effectPolicy = window.DreamRealms?.effectPolicy;
      if (effectPolicy?.enforceConcurrency) {
        const category = effectPolicy.categoryOf(normalized);
        if (category && effectPolicy.enforceConcurrency(target, category, { sourceId: normalized.sourceId ?? null, incomingId: normalized.id }) === -1) {
          return null;
        }
      }
      target.buffs.push(normalized);
      if (game?.spawnStatusPulse) game.spawnStatusPulse(target, normalized.color, normalized.name);
      if (normalized.hostile && target.kind === 'enemy' && source && ['player', 'merc', 'pet'].includes(source.kind)) {
        game?.addThreat?.(target, source, 4 + safeNumber(normalized.periodicDamage, 0), { reason: 'status-apply', statusId: normalized.id });
      }
      return normalized;
    },

    removeFromEntity(target, statusIdOrName) {
      if (!target || !Array.isArray(target.buffs)) return false;
      const key = slug(statusIdOrName);
      const before = target.buffs.length;
      target.buffs = target.buffs.filter(effect => effect.id !== key && slug(effect.name) !== key);
      return target.buffs.length !== before;
    },

    cleanseFromEntity(target, options = {}) {
      if (!target || !Array.isArray(target.buffs)) return [];
      const tags = new Set((options.tags || []).map(slug));
      const cleanseTypes = new Set((options.cleanseTypes || options.types || []).map(slug));
      const removed = [];
      target.buffs = target.buffs.filter(effect => {
        if (!effect || effect.isCurable === false) return true;
        const effectTags = Array.isArray(effect.tags) ? effect.tags.map(slug) : [];
        const tagMatch = tags.size > 0 && effectTags.some(tag => tags.has(tag));
        const typeMatch = cleanseTypes.size > 0 && cleanseTypes.has(slug(effect.cleanseType));
        if (!tagMatch && !typeMatch) return true;
        removed.push(effect);
        return false;
      });
      return removed;
    },

    clearDeathEffects(entity) {
      if (!entity || !Array.isArray(entity.buffs)) return [];
      const removed = entity.buffs.filter(effect => effect?.clearsOnDeath !== false && (effect?.hostile || effect?.tags?.some?.(tag => ['poison', 'dot', 'debuff', 'root', 'slow', 'stun'].includes(tag))));
      entity.buffs = entity.buffs.filter(effect => !removed.includes(effect));
      return removed;
    },

    // V0.20.46 (perf): these ran slug() - two regex replaces plus string allocations - even when the
    // entity had NO buffs at all, because the guard checked isArray but never length. Measured on a live
    // camp frame: 517 hasTag calls, 100% of them against an empty buffs array, costing ~27ms/frame (the
    // single largest cost in the whole update). Checking length first makes the overwhelmingly common
    // "nothing is affecting this entity" case free. Behaviour is identical - an empty buffs list could
    // never have matched a tag anyway.
    hasTag(entity, tag) {
      const buffs = entity && entity.buffs;
      if (!Array.isArray(buffs) || buffs.length === 0) return false;
      const key = slug(tag);
      return buffs.some(effect => effect.remaining > 0 && Array.isArray(effect.tags) && effect.tags.includes(key));
    },

    hasCurableTag(entity, tag) {
      const buffs = entity && entity.buffs;
      if (!Array.isArray(buffs) || buffs.length === 0) return false;
      const key = slug(tag);
      return buffs.some(effect => effect.remaining > 0 && effect.isCurable !== false && Array.isArray(effect.tags) && effect.tags.includes(key));
    },

    statusSpeedScalar(entity) {
      const buffsForSpeed = entity && entity.buffs;
      if (!Array.isArray(buffsForSpeed) || buffsForSpeed.length === 0) return 1;
      let scalar = 1;
      for (const effect of entity.buffs) {
        if (effect.remaining <= 0) continue;
        if (effect.tags?.includes?.('slow')) scalar *= (effect.moveSpeedMultiplier > 0 ? effect.moveSpeedMultiplier : 0.72);
        if (effect.moveSpeedMultiplier > 0 && !effect.tags?.includes?.('slow')) scalar *= effect.moveSpeedMultiplier;
        if (effect.tags?.includes?.('root') || effect.tags?.includes?.('stun')) scalar = 0;
      }
      return clamp(scalar, 0, 1.35);
    },

    updateGame(game, dt) {
      const safeDt = Math.max(0, Math.min(0.25, safeNumber(dt, 0)));
      if (safeDt <= 0) return;
      for (const actor of actorList(game)) {
        this.updateEntity(game, actor, safeDt);
        syncRootEntangleVfx(game, actor);
      }
    },

    updateEntity(game, actor, dt) {
      if (!actor || !Array.isArray(actor.buffs) || !actor.buffs.length) return;
      for (let i = actor.buffs.length - 1; i >= 0; i--) {
        const effect = actor.buffs[i];
        effect.remaining = Math.max(0, safeNumber(effect.remaining, 0) - dt);
        if (effect.tickRate > 0 && (effect.periodicDamage > 0 || effect.periodicHealing > 0 || effect.periodicMana > 0) && actor.alive) {
          effect.tickTimer = Math.max(0, safeNumber(effect.tickTimer, effect.tickRate) - dt);
          if (effect.tickTimer <= 0) {
            effect.tickTimer = Math.max(0.2, safeNumber(effect.tickRate, 1.0));
            const stacks = Math.max(1, safeNumber(effect.stacks, 1));
            const foundSource = findSource(game, effect.sourceId);
            const sourceKind = String(effect.sourceKind || '').toLowerCase();
            const source = foundSource || (effect.hostile
              ? { kind: sourceKind === 'enemy' ? 'enemy' : 'environment', name: effect.sourceName || 'Hostile Effect' }
              : actor);
            if (effect.periodicDamage > 0) {
              let multiplier = 1;
              if (effect.necromancerDot || effect.necromancerDrain) {
                const mark = actor.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'necro_plague_mark');
                if (mark) {
                  if (effect.necromancerDrain) multiplier *= 1 + safeNumber(mark.drainAmpPct, 0.18);
                  else if (effect.necromancerDot) multiplier *= 1 + safeNumber(mark.dotAmpPct, 0.18);
                }
                const lich = source?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'necro_lich_form');
                if (lich && effect.necromancerDot) multiplier *= safeNumber(lich.dotDamageMultiplier, 1.20);
              }
              let amount = Math.max(1, Math.floor(effect.periodicDamage * stacks * multiplier));
              // V0.18.96: poison resist reduces incoming poison/venom DoT damage on the victim.
              if (isPoisonLikeEffect(effect)) {
                const poisonReduction = DR.StatSystem?.poisonResistReductionFor?.(actor) || 0;
                if (poisonReduction > 0) amount = Math.max(1, Math.floor(amount * (1 - poisonReduction)));
              }
              game.damageEntity?.(actor, amount, source, effect.color || '#d98f68', {
                canCrit: Boolean(effect.canCrit),
                isPeriodic: true,
                damageType: effect.damageType || 'magic',
                statusId: effect.id
              });
              if (effect.id === 'assassin_poison_payload') game.spawnAssassinPoisonPulseVfx?.(actor, { color: effect.color || '#78e268', intensity: Math.max(1, safeNumber(effect.stacks, 1) * 0.25) });
              if (effect.drainHealPct > 0 && source && source.alive !== false) {
                const lich = source?.buffs?.find?.(buff => buff && buff.remaining > 0 && buff.id === 'necro_lich_form');
                const healMultiplier = lich ? safeNumber(lich.drainHealingMultiplier, 1.25) : 1;
                const healAmount = Math.max(1, Math.floor(amount * safeNumber(effect.drainHealPct, 0) * healMultiplier));
                game.healEntity?.(source, healAmount, true, source, { canCrit: false, isPeriodic: true, statusId: effect.id });
              }
            }
            if (effect.periodicHealing > 0 && actor.alive) {
              const amount = Math.max(1, Math.floor(effect.periodicHealing * stacks));
              game.healEntity?.(actor, amount, true, source, { canCrit: Boolean(effect.canCrit), isPeriodic: true, statusId: effect.id });
            }
            if (effect.periodicMana > 0 && actor.alive) {
              const amount = Math.max(1, Math.floor(effect.periodicMana * stacks));
              game.restoreMana?.(actor, amount);
            }
            effect.description = buildEffectDescription(effect);
            game.spawnStatusPulse?.(actor, effect.color || '#d98f68', effect.name || 'Status');
          }
        }
        if (effect.remaining <= 0 || actor.alive === false) {
          if (effect.id === 'assassin_marked_for_death') game.spawnAssassinMarkRemovedVfx?.(actor, actor.alive === false ? 'death' : 'expired', findSource(game, effect.sourceId));
          actor.buffs.splice(i, 1);
        }
      }
    },

    serializeEntity(entity) {
      if (!entity || !Array.isArray(entity.buffs)) return [];
      return entity.buffs
        .filter(effect => effect && safeNumber(effect.remaining, 0) > 0)
        .map(effect => normalizeEffect(effect, { id: effect.sourceId, kind: effect.sourceKind, name: effect.sourceName }));
    },

    importEntity(entity, effects) {
      if (!entity) return false;
      entity.buffs = Array.isArray(effects) ? effects.map(effect => normalizeEffect(effect)).filter(effect => effect.remaining > 0) : [];
      return true;
    },

    renderTray(entity, limit = 8, options = {}) {
      const requestedHostility = typeof options.hostile === 'boolean' ? options.hostile : null;
      const effects = sortedTrayEffects(entity).filter(effect => requestedHostility === null || Boolean(effect.hostile) === requestedHostility);
      const visible = effects.slice(0, limit);
      // V0.20.38 (Roadmap Item 20): opt-in colourblind valence marker - a shape (not a colour) telling
      // beneficial from harmful. Read from the live uiPrefs; trays re-render each tick, so toggling is
      // instant. Family glyphs are always shown regardless of this.
      const cbMarkers = !!(window.DarkWoodsGame && window.DarkWoodsGame.uiPrefs && window.DarkWoodsGame.uiPrefs.colorblindStatusMarkers);
      const html = visible.map(effect => {
        const cls = effect.hostile ? 'debuff' : 'buff';
        const valence = cbMarkers ? `<span class="statusValence ${cls}" aria-hidden="true">${effect.hostile ? '▼' : '▲'}</span>` : '';
        const stacks = safeNumber(effect.stacks, 1) > 1 ? `<span class="statusStack">${Math.floor(effect.stacks)}</span>` : '';
        const pct = clamp(safeNumber(effect.remaining, 0) / Math.max(0.1, safeNumber(effect.duration, 1)), 0, 1);
        const tipHtml = escapeHtml(tooltipHtmlFor(effect));
        const label = escapeHtml(`${effect.hostile ? 'Debuff' : 'Buff'}: ${tooltipFor(effect)}`);
        const progressPct = (pct * 100).toFixed(2).replace(/\.00$/, '');
        const timerLabel = escapeHtml(formatStatusTimerLabel(effect.remaining));
        return `<span class="statusPip ${cls}" tabindex="0" aria-label="${label}" data-status-tooltip-html="${tipHtml}" style="--status-color:${effect.color || '#cfe7aa'};--status-left:${Math.round(pct * 100)}%;--status-progress:${progressPct}%">${iconHtmlFor(effect)}${stacks}${valence}<span class="statusTime" aria-hidden="true">${timerLabel}</span></span>`;
      }).join('');
      if (effects.length <= limit) return html;
      const extra = effects.length - limit;
      return `${html}<span class="statusPip statusMore" tabindex="0" aria-label="${extra} more active effects"><span>+${extra}</span></span>`;
    }
  };

  DR.StatusEffectSystem = {
    install(Game) {
      Game.prototype.applyStatusEffect = function(target, effect, source = null) {
        const actualSource = source || this.player;
        const hostile = effect?.hostile === true
          || HOSTILE_TYPES.has(String(effect?.type || effect?.kind || '').toLowerCase())
          || safeNumber(effect?.periodicDamage ?? effect?.tickDamage, 0) > 0
          || Object.values(effect?.mods || effect?.statModifiers || {}).some(value => Number(value) < 0);
        if (hostile && this.isFriendlyFireBlocked?.(actualSource, target, { effect, status: true })) {
          if (actualSource === this.player) this.logCombat?.('Cannot attack friendly target.');
          return null;
        }
        if (hostile && this.isFriendlyCombatActor?.(actualSource) && !this.isHostileTarget?.(target)) {
          if (actualSource === this.player) this.logCombat?.('Cannot attack friendly target.');
          return null;
        }
        if (activeSilkWebDungeon(this) && isFriendlySilkPoisonTarget(this, target) && isPoisonLikeEffect(effect) && !isAllowedSilkPoisonSource(actualSource, effect)) {
          const name = String(effect?.name || effect?.id || 'poison effect');
          if (!this._silkEnvironmentalPoisonBlockLogAt || (this.runtimeNowMs?.() || Date.now()) - this._silkEnvironmentalPoisonBlockLogAt > 1200) {
            this._silkEnvironmentalPoisonBlockLogAt = this.runtimeNowMs?.() || Date.now();
            console.warn(`[Dream Realms] Blocked non-combat Silk Web Cavern poison source: ${name}`);
          }
          return null;
        }
        return DR.StatusEffects.applyToEntity(target, effect, actualSource, this);
      };

      Game.prototype.removeStatusEffect = function(target, statusIdOrName) {
        return DR.StatusEffects.removeFromEntity(target, statusIdOrName);
      };

      Game.prototype.cleanseStatusEffects = function(target, options = {}) {
        return DR.StatusEffects.cleanseFromEntity(target, options);
      };

      Game.prototype.clearDeathStatusEffects = function(target) {
        return DR.StatusEffects.clearDeathEffects(target);
      };

      Game.prototype.updateStatusEffects = function(dt) {
        DR.StatusEffects.updateGame(this, dt);
      };

      Game.prototype.hasStatusTag = function(entity, tag) {
        return DR.StatusEffects.hasTag(entity, tag);
      };

      Game.prototype.hasCurableStatusTag = function(entity, tag) {
        return DR.StatusEffects.hasCurableTag(entity, tag);
      };

      Game.prototype.statusSpeedScalar = function(entity) {
        return DR.StatusEffects.statusSpeedScalar(entity);
      };

      // Phase 3 (Combat/Spell Parity): status contracts. The 'stun' and
      // 'silence' tags have existed in CONTROL_TAGS/normalizeTags/status
      // icon theming since earlier passes, but nothing actually applied
      // them or checked for them - root/stun only ever zeroed movement via
      // statusSpeedScalar above. These three helpers are the first real
      // consumers of those tags for action-gating (see
      // systems/spell-system.js canCastClassSpell and
      // systems/combat-system.js playerAttack) and of a new 'invulnerable'
      // tag for damage-gating (see systems/combat-system.js damageEntity).
      // No shipped status effect currently applies 'stun', 'silence', or
      // 'invulnerable', so these are inert for existing content until a
      // future status opts in.
      Game.prototype.isSilenced = function(entity) {
        return DR.StatusEffects.hasTag(entity, 'silence');
      };

      Game.prototype.isActionLocked = function(entity) {
        return DR.StatusEffects.hasTag(entity, 'stun');
      };

      Game.prototype.isInvulnerable = function(entity) {
        return DR.StatusEffects.hasTag(entity, 'invulnerable');
      };

      Game.prototype.serializeEntityStatuses = function(entity) {
        return DR.StatusEffects.serializeEntity(entity);
      };

      Game.prototype.importEntityStatuses = function(entity, effects) {
        return DR.StatusEffects.importEntity(entity, effects);
      };

      Game.prototype.bindStatusTrayTooltips = function(root) {
        if (!root || root.dataset.statusTooltipBound === '1') return;
        root.dataset.statusTooltipBound = '1';
        let touchTimer = null;
        const clearTouch = () => { if (touchTimer) window.clearTimeout(touchTimer); touchTimer = null; };
        const nodeFor = event => event?.target?.closest?.('[data-status-tooltip-html]');
        const show = (node, event) => {
          if (!node) return;
          const html = String(node.dataset.statusTooltipHtml || '');
          if (!html) return;
          this.showHtmlTooltip?.(html, event);
        };
        root.addEventListener('mouseover', event => {
          const node = nodeFor(event);
          if (!node || !root.contains(node)) return;
          show(node, event);
        });
        root.addEventListener('mousemove', event => {
          if (!nodeFor(event)) return;
          this.moveItemTooltip?.(event);
        });
        root.addEventListener('mouseout', event => {
          const fromNode = nodeFor(event);
          const toNode = event.relatedTarget?.closest?.('[data-status-tooltip-html]');
          if (fromNode && fromNode !== toNode) this.hideItemTooltip?.();
        });
        root.addEventListener('focusin', event => {
          const node = nodeFor(event);
          if (!node) return;
          const rect = node.getBoundingClientRect();
          show(node, { clientX: rect.right, clientY: rect.top });
        });
        root.addEventListener('focusout', () => this.hideItemTooltip?.());
        root.addEventListener('dragstart', () => this.hideItemTooltip?.());
        root.addEventListener('touchstart', event => {
          const node = nodeFor(event);
          if (!node) return;
          clearTouch();
          touchTimer = window.setTimeout(() => show(node, event), 430);
        }, { passive: true });
        root.addEventListener('touchmove', clearTouch, { passive: true });
        root.addEventListener('touchend', clearTouch, { passive: true });
        root.addEventListener('touchcancel', clearTouch, { passive: true });
      };
    }
  };
})();
