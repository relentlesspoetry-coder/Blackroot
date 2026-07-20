(() => {
  'use strict';
  const DR = window.DreamRealms = window.DreamRealms || {};

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function randInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function seededNoise(x, y, seed = 1337) {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967295;
  }

  function smoothNoise(x, y, scale, seed) {
    const fx = x / scale;
    const fy = y / scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = seededNoise(x0, y0, seed);
    const b = seededNoise(x0 + 1, y0, seed);
    const c = seededNoise(x0, y0 + 1, seed);
    const d = seededNoise(x0 + 1, y0 + 1, seed);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }

  function pct(v, max) {
    if (max <= 0) return '0%';
    return `${clamp((v / max) * 100, 0, 100).toFixed(1)}%`;
  }

  function colorShade(color, amt) {
    let r, g, b;
    if (String(color).startsWith('rgb')) {
      const parts = String(color).match(/\d+(?:\.\d+)?/g)?.map(Number) || [0, 0, 0];
      [r, g, b] = parts;
    } else {
      const h = String(color).replace('#', '');
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
    r = clamp((r || 0) + amt, 0, 255);
    g = clamp((g || 0) + amt, 0, 255);
    b = clamp((b || 0) + amt, 0, 255);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  const BOT_ROLE_ALIASES = Object.freeze({
    tank: 'tank',
    guardian: 'tank',
    paladin: 'tank',
    warden: 'tank',
    fighter: 'meleeDps',
    healer: 'healer',
    cleric: 'healer',
    support: 'support',
    casterdps: 'casterDps',
    caster_dps: 'casterDps',
    ranged: 'casterDps',
    ranged_dps: 'casterDps',
    physicalrangeddps: 'physicalRangedDps',
    physical_ranged_dps: 'physicalRangedDps',
    ranger: 'physicalRangedDps',
    assassin: 'physicalRangedDps',
    wizard: 'casterDps',
    shaman: 'casterDps',
    meleedps: 'meleeDps',
    melee_dps: 'meleeDps',
    melee: 'meleeDps',
    rogue: 'meleeDps',
    hybrid_healer_damage: 'hybrid_healer_damage',
    hybridhealerdamage: 'hybrid_healer_damage',
    support_control: 'support_control',
    supportcontrol: 'support_control',
    control_support: 'control_support',
    controlsupport: 'control_support',
    pet_caster: 'pet_caster',
    petcaster: 'pet_caster',
    pet_dot_caster: 'pet_dot_caster',
    petdotcaster: 'pet_dot_caster',
    necromancer: 'pet_dot_caster',
    summoner: 'pet_caster',
    enchanter: 'control_support',
    bard: 'support_control',
    druid: 'hybrid_healer_damage',
    basic_assist: 'basic_assist',
    basicassist: 'basic_assist'
  });

  function canonicalBotRole(role) {
    const raw = String(role || '').trim();
    if (!raw) return 'basic_assist';
    const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const noUnderscore = compact.replace(/_/g, '');
    return BOT_ROLE_ALIASES[compact] || BOT_ROLE_ALIASES[noUnderscore] || raw;
  }

  function botRoleIn(role, roles) {
    const canonical = canonicalBotRole(role);
    return roles.includes(canonical);
  }

  function isBotTankRole(role) {
    return botRoleIn(role, ['tank']);
  }

  function isBotMeleeDpsRole(role) {
    return botRoleIn(role, ['meleeDps']);
  }

  function isBotPrimaryHealerRole(role) {
    return botRoleIn(role, ['healer']);
  }

  function isBotHealingSupportRole(role) {
    return botRoleIn(role, ['healer', 'support', 'support_control', 'hybrid_healer_damage']);
  }

  function isBotSupportRole(role) {
    return botRoleIn(role, ['healer', 'support', 'support_control', 'control_support', 'hybrid_healer_damage']);
  }

  function isBotControlRole(role) {
    return botRoleIn(role, ['support_control', 'control_support', 'casterDps']);
  }

  function isBotCasterDpsRole(role) {
    return botRoleIn(role, ['casterDps', 'pet_caster', 'pet_dot_caster', 'control_support']);
  }

  function isBotRangedRole(role) {
    return botRoleIn(role, ['healer', 'support', 'casterDps', 'physicalRangedDps', 'hybrid_healer_damage', 'support_control', 'control_support', 'pet_caster', 'pet_dot_caster']);
  }

  function botPartyFormationRole(role) {
    const canonical = canonicalBotRole(role);
    if (isBotTankRole(canonical)) return 'tank';
    if (isBotMeleeDpsRole(canonical)) return 'meleeDps';
    if (isBotHealingSupportRole(canonical)) return 'healer';
    if (isBotSupportRole(canonical) || isBotRangedRole(canonical)) return 'rangedDps';
    return 'meleeDps';
  }

  function botGearWeightRole(role) {
    const canonical = canonicalBotRole(role);
    if (isBotTankRole(canonical)) return 'tank';
    if (isBotPrimaryHealerRole(canonical) || canonical === 'hybrid_healer_damage') return 'healer';
    if (canonical === 'support_control' || canonical === 'control_support' || canonical === 'support') return 'support';
    if (canonical === 'physicalRangedDps') return 'physicalRangedDps';
    if (isBotRangedRole(canonical)) return 'casterDps';
    if (isBotMeleeDpsRole(canonical)) return 'meleeDps';
    return 'meleeDps';
  }

  DR.BotRoles = Object.freeze({
    canonical: canonicalBotRole,
    isTankRole: isBotTankRole,
    isMeleeDpsRole: isBotMeleeDpsRole,
    isPrimaryHealerRole: isBotPrimaryHealerRole,
    isHealingSupportRole: isBotHealingSupportRole,
    isSupportRole: isBotSupportRole,
    isControlRole: isBotControlRole,
    isCasterDpsRole: isBotCasterDpsRole,
    isRangedRole: isBotRangedRole,
    partyFormationRole: botPartyFormationRole,
    gearWeightRole: botGearWeightRole
  });


  DR.utils = Object.freeze({
    clamp,
    lerp,
    dist,
    randInt,
    seededNoise,
    smoothNoise,
    pct,
    colorShade
  });
})();
