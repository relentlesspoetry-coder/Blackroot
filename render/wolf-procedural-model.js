(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;
  const ACTIONS = Object.freeze(['idle', 'walk', 'attack', 'hit', 'death', 'charge', 'leap', 'howl']);
  const DIRECTIONS = Object.freeze(['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']);

  const BASE_PALETTES = Object.freeze({
    gloom: {
      outline: '#0b1112', shadow: 'rgba(0,0,0,0.34)', aura: 'rgba(136,205,202,0.28)',
      deep: '#111b1e', dark: '#243338', body: '#435456', shoulder: '#5b6b69', light: '#7c8f87', hi: '#b6c8b8',
      muzzle: '#a99a85', nose: '#07090a', paw: '#0d1315', eye: '#9fffe5', scar: '#b97062', ridge: '#1b2b30'
    },
    caveGloom: {
      outline: '#090f12', shadow: 'rgba(0,0,0,0.38)', aura: 'rgba(127,205,230,0.30)',
      deep: '#0f171c', dark: '#23303a', body: '#3f5158', shoulder: '#61747a', light: '#829aa0', hi: '#c0d5d9',
      muzzle: '#b3aa9a', nose: '#07090a', paw: '#0a1114', eye: '#b9efff', scar: '#9c6f67', ridge: '#152630'
    },
    mossfang: {
      outline: '#10110d', shadow: 'rgba(0,0,0,0.35)', aura: 'rgba(255,230,155,0.30)',
      deep: '#263227', dark: '#4b5d4d', body: '#7f8e78', shoulder: '#a1ad91', light: '#c2cfac', hi: '#efe2bc',
      muzzle: '#e1d3b2', nose: '#15120d', paw: '#1b2117', eye: '#fff0a6', scar: '#a44f42', ridge: '#384536'
    },
    // V0.20.71: a true black wolf - the camp's broke-in riding wolf. Added here, in the module that
    // owns wolf colouring, rather than as a one-off tint at the mount layer, so it is a real coat the
    // renderer knows about and the sprite baker can bake like any other.
    black: {
      outline: '#050607', shadow: 'rgba(0,0,0,0.46)', aura: 'rgba(120,140,160,0.22)',
      deep: '#08090b', dark: '#121417', body: '#1c2024', shoulder: '#2b3036', light: '#3d444c', hi: '#5d666f',
      muzzle: '#6e6a63', nose: '#040405', paw: '#070809', eye: '#e8c98a', scar: '#7d5a52', ridge: '#0d1013'
    },
    dire: {
      outline: '#080b0d', shadow: 'rgba(0,0,0,0.42)', aura: 'rgba(180,210,255,0.28)',
      deep: '#0a1014', dark: '#16212a', body: '#2e3b44', shoulder: '#53616b', light: '#7d909b', hi: '#c5d5d7',
      muzzle: '#b7b1a3', nose: '#050608', paw: '#080d10', eye: '#d5f7ff', scar: '#b65e52', ridge: '#0c171d'
    }
  });

  const DIRECTION_PROFILES = Object.freeze({
    east:      { view: 'side', side:  1, face: true,  back: false, headX: 42, headY: -50, tailX: -47, tailY: -42, bodyTilt: -0.06, neckLean:  1 },
    southeast: { view: 'diag', side:  1, face: true,  back: false, headX: 34, headY: -52, tailX: -40, tailY: -43, bodyTilt: -0.035, neckLean:  0.75 },
    south:     { view: 'front', side: 1, face: true,  back: false, headX: 0,  headY: -54, tailX: 0,   tailY: -43, bodyTilt: 0, neckLean: 0 },
    southwest: { view: 'diag', side: -1, face: true,  back: false, headX: -34, headY: -52, tailX: 40,  tailY: -43, bodyTilt: 0.035, neckLean: -0.75 },
    west:      { view: 'side', side: -1, face: true,  back: false, headX: -42, headY: -50, tailX: 47,  tailY: -42, bodyTilt: 0.06, neckLean: -1 },
    northwest: { view: 'diag', side: -1, face: false, back: true,  headX: -28, headY: -53, tailX: 38,  tailY: -40, bodyTilt: 0.035, neckLean: -0.45 },
    north:     { view: 'back', side: 1, face: false, back: true,  headX: 0,  headY: -55, tailX: 0,   tailY: -37, bodyTilt: 0, neckLean: 0 },
    northeast: { view: 'diag', side:  1, face: false, back: true,  headX: 28, headY: -53, tailX: -38, tailY: -40, bodyTilt: -0.035, neckLean: 0.45 }
  });

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function norm(v) { return String(v || '').toLowerCase().replace(/[\s_\-]/g, ''); }
  function rgba(hex, alpha) {
    const raw = String(hex || '#ffffff').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw.padEnd(6, 'f').slice(0, 6);
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  function mixPalette(base, override) { return Object.freeze({ ...BASE_PALETTES.gloom, ...(base || {}), ...(override || {}) }); }

  function resolveFacingName(actor) {
    const explicit = String(actor?.facingName || actor?._humanoidSheetDirection || '').toLowerCase().replace(/[\s_]/g, '');
    if (DIRECTION_PROFILES[explicit]) return explicit;
    const fx = Math.sign(num(actor?.facingX, 0));
    const fy = Math.sign(num(actor?.facingY, 0));
    if (fx > 0 && fy === 0) return 'east';
    if (fx > 0 && fy > 0) return 'southeast';
    if (fx === 0 && fy > 0) return 'south';
    if (fx < 0 && fy > 0) return 'southwest';
    if (fx < 0 && fy === 0) return 'west';
    if (fx < 0 && fy < 0) return 'northwest';
    if (fx === 0 && fy < 0) return 'north';
    if (fx > 0 && fy < 0) return 'northeast';
    return 'south';
  }

  function resolveWolfVisualKey(actor) {
    const explicit = actor?.wolfVisualKey || actor?.mobVisualKey || actor?.baseType?.mobVisualKey || actor?.visualKey || actor?.baseType?.visualKey;
    const key = norm(explicit);
    if (key.includes('mossfang')) return 'mossfangAlpha';
    if (key.includes('cave')) return 'caveGloomWolf';
    if (key.includes('dire')) return 'direGloomWolf';
    if (key.includes('gloom') || key.includes('wolf')) return 'gloomWolf';
    const text = norm([actor?.name, actor?.baseType?.name, actor?.rendererId, actor?.baseType?.rendererId, actor?.family, actor?.baseType?.family, actor?.aiProfile, actor?.baseType?.aiProfile].filter(Boolean).join(' '));
    if (text.includes('mossfang') || text.includes('alpha')) return 'mossfangAlpha';
    if (text.includes('cave')) return 'caveGloomWolf';
    if (text.includes('dire')) return 'direGloomWolf';
    return 'gloomWolf';
  }

  function resolveVariant(actor, visualKey) {
    const rarityText = norm([actor?.rarity, actor?.rank, actor?.threatTag, actor?.baseType?.threatTag].filter(Boolean).join(' '));
    const isNamed = !!(actor?.isNamed || actor?.named || actor?.rareNameplate || actor?.baseType?.named || rarityText.includes('named') || visualKey === 'mossfangAlpha');
    const isRare = !!(isNamed || actor?.isRare || actor?.rare || rarityText.includes('rare'));
    const isElite = !!(isRare || actor?.isElite || actor?.elite || actor?.baseType?.elite || rarityText.includes('elite') || visualKey === 'direGloomWolf' || visualKey === 'mossfangAlpha');
    return Object.freeze({ isNamed, isRare, isElite, visualKey });
  }

  // V0.20.71: lower-cased index so a palette can be selected BY NAME. Previously this function was a
  // hardcoded if-chain (mossfang / cave / dire / else gloom) that never consulted BASE_PALETTES, which
  // meant any coat added to that map was unreachable - a new 'black' palette silently rendered as
  // gloom. Same failure shape as the atlas inferModelId chain: a lookup table that the lookup ignores.
  const PALETTE_BY_LOWER_KEY = Object.freeze(Object.fromEntries(
    Object.keys(BASE_PALETTES).map(k => [k.toLowerCase(), BASE_PALETTES[k]])
  ));

  function resolvePalette(actor, variant) {
    const key = norm(actor?.wolfPalette || actor?.paletteKey || actor?.palette || actor?.baseType?.palette || variant.visualKey);
    // Exact name wins, so every entry in BASE_PALETTES is selectable and new coats need no code change.
    let base = PALETTE_BY_LOWER_KEY[key] || null;
    if (!base) {
      base = BASE_PALETTES.gloom;
      if (key.includes('mossfang') || variant.visualKey === 'mossfangAlpha') base = BASE_PALETTES.mossfang;
      else if (key.includes('cave')) base = BASE_PALETTES.caveGloom;
      else if (key.includes('dire') || (variant.isElite && !variant.isNamed)) base = BASE_PALETTES.dire;
    }
    const actorPalette = actor?.visualPalette || actor?.wolfPaletteOverride || null;
    return mixPalette(base, actorPalette);
  }

  function canDraw(actor) {
    if (!actor) return false;
    const text = norm([actor.rendererId, actor.baseType?.rendererId, actor.mobType, actor.species, actor.type, actor.name, actor.baseType?.name, actor.family, actor.baseType?.family].filter(Boolean).join(' '));
    return text.includes('wolf') || text.includes('mossfang') || actor.rendererId === 'wolf' || actor.baseType?.rendererId === 'wolf';
  }

  function buildPose(actor, nowMs) {
    const t = nowMs / 1000;
    const rawAction = norm(actor?.action || actor?.state || '');
    const dead = actor?.alive === false || actor?.dead === true || rawAction === 'death' || rawAction === 'dead' || num(actor?.hp, 1) <= 0;
    const moving = !dead && !!(actor?.isMoving || actor?.moving || num(actor?.moveBlend, 0) > 0.05 || Math.abs(num(actor?.vx, 0)) + Math.abs(num(actor?.vy, 0)) > 0.01);
    const attackAnim = clamp(num(actor?.attackAnim, 0), 0, 1);
    const hitAnim = clamp(num(actor?.hitAnim || actor?.hitReaction || actor?.damageAnim, 0), 0, 1);
    const attacking = !dead && (actor?.isAttacking || attackAnim > 0.02 || rawAction === 'attack' || rawAction === 'charge' || rawAction === 'leap' || rawAction === 'rangedattack');
    const howling = !dead && (rawAction === 'howl' || rawAction === 'cast');
    const hit = !dead && (hitAnim > 0.02 || rawAction === 'hit');
    const step = moving ? t * 9.2 : t * 1.35;
    const walkSin = Math.sin(step);
    const attackPulse = attacking ? (attackAnim ? Math.sin((1 - attackAnim) * Math.PI) : Math.sin((t * 7.5 % 1) * Math.PI)) : 0;
    const hitPulse = hit ? (hitAnim || 0.7) : 0;
    return Object.freeze({
      t, dead, moving, attacking, howling, hit,
      action: dead ? 'death' : attacking ? 'attack' : howling ? 'howl' : hit ? 'hit' : moving ? 'walk' : 'idle',
      step, walkSin,
      bob: dead ? 0 : moving ? -Math.abs(walkSin) * 1.55 : Math.sin(t * 2.0) * 0.55,
      breathe: dead ? 0 : Math.sin(t * 2.15) * 1.15,
      shoulder: moving ? Math.sin(step + 0.4) * 1.8 : Math.sin(t * 1.9) * 0.75,
      hip: moving ? Math.sin(step + Math.PI) * 1.4 : Math.sin(t * 1.4) * 0.35,
      headBob: moving ? Math.sin(step + 0.7) * 2.1 : Math.sin(t * 1.7) * 0.8,
      legA: moving ? Math.sin(step) : 0,
      legB: moving ? Math.sin(step + Math.PI) : 0,
      tail: dead ? 0 : moving ? Math.sin(step * 0.72) * 0.18 : Math.sin(t * 1.28) * 0.075,
      ear: dead ? 0 : (Math.sin(t * 4.2) > 0.82 ? 2 : 0),
      attack: attackPulse,
      lunge: attackPulse * (rawAction === 'charge' || rawAction === 'leap' ? 12 : 8),
      hitAmt: hitPulse,
      howl: howling ? Math.sin((t * 2.7 % 1) * Math.PI) : 0
    });
  }

  function withAlpha(ctx, alpha, fn) { ctx.save(); ctx.globalAlpha *= alpha; fn(); ctx.restore(); }
  function poly(ctx, pts, fill, stroke, lw = 2) {
    if (!pts || pts.length < 3) return;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke, lw = 2, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    ctx.fill();
    if (stroke && lw > 0) ctx.stroke();
    ctx.restore();
  }
  function strokePath(ctx, pts, color, width, outline, alpha = 1) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (outline && width > 1) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = width + 2.25;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();
  }
  function paw(ctx, x, y, sx, p, alpha = 1) {
    ellipse(ctx, x + sx * 1.5, y + 0.4, 8.4, 4.2, 0.04 * sx, p.paw, p.outline, 1.35, alpha);
    withAlpha(ctx, 0.92 * alpha, () => {
      ellipse(ctx, x + sx * 1.1, y + 0.5, 3.0, 1.9, 0.02 * sx, rgba(p.deep, 0.9), null, 0, 1);
      const toeXs = [x - 3.2 * sx, x - 0.8 * sx, x + 1.7 * sx, x + 4.1 * sx];
      for (let i = 0; i < toeXs.length; i++) {
        ellipse(ctx, toeXs[i], y - 1.0 + (i % 2 ? 0.25 : 0), 1.65, 1.15, 0, rgba(p.deep, 0.95), null, 0, 1);
        strokePath(ctx, [[toeXs[i] + 0.65 * sx, y - 1.4], [toeXs[i] + 2.1 * sx, y - 2.7]], rgba(p.hi, 0.72), 0.95, null, 0.95);
      }
      ellipse(ctx, x - 3.8 * sx, y - 3.4, 1.15, 0.85, 0.1, rgba(p.deep, 0.82), null, 0, 0.78);
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.ellipse(x + sx * 4.9, y - 1.2, 1.25, 0.72, 0, 0, TAU);
      ctx.fill();
    });
  }

  function drawGroundShadow(ctx, p, variant) {
    const alpha = variant.isElite ? 0.42 : 0.34;
    ellipse(ctx, 0, 7, variant.isNamed ? 51 : variant.isElite ? 47 : 42, variant.isNamed ? 14 : 12, 0, p.shadow, null, 0, alpha);
  }

  function drawElitePresence(ctx, p, pose, variant) {
    if (!variant.isElite && !variant.isRare) return;
    const pulse = 0.5 + Math.sin(pose.t * 3.0) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = variant.isNamed ? 0.24 + pulse * 0.08 : 0.12 + pulse * 0.06;
    ctx.strokeStyle = variant.isNamed ? p.hi : p.eye;
    ctx.lineWidth = variant.isNamed ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 5, variant.isNamed ? 54 : 46, variant.isNamed ? 13 : 11, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawTail(ctx, prof, p, pose, variant) {
    const s = prof.side || 1;
    const wag = pose.tail * s;
    const length = variant.isElite ? 38 : 34;
    const thick = variant.isElite ? 8.5 : 7;
    ctx.save();
    ctx.translate(prof.tailX, prof.tailY + pose.hip * 0.35);
    ctx.rotate((-0.32 * s) + wag);
    strokePath(ctx, [[0, 0], [-length * s * 0.52, -7], [-length * s, -2]], p.deep, thick + 3, p.outline, 0.98);
    strokePath(ctx, [[-length * s * 0.18, -2], [-length * s * 0.72, -10], [-length * s * 1.04, -7]], p.dark, thick, p.outline, 0.95);
    strokePath(ctx, [[-length * s * 0.68, -11], [-length * s * 1.14, -15], [-length * s * 1.25, -8]], p.light, Math.max(3.2, thick - 2), p.outline, 0.82);
    const tuftBaseX = -length * s * 1.02;
    const tuftBaseY = -8;
    poly(ctx, [[tuftBaseX - 2 * s, tuftBaseY + 3], [tuftBaseX - 10 * s, tuftBaseY - 3], [tuftBaseX - 4 * s, tuftBaseY + 7]], p.dark, p.outline, 0.9);
    poly(ctx, [[tuftBaseX + 1 * s, tuftBaseY + 2], [tuftBaseX - 7 * s, tuftBaseY - 9], [tuftBaseX - 1 * s, tuftBaseY + 6]], p.body, p.outline, 0.9);
    poly(ctx, [[tuftBaseX + 4 * s, tuftBaseY + 2], [tuftBaseX - 2 * s, tuftBaseY - 11], [tuftBaseX + 4 * s, tuftBaseY + 5]], p.light, rgba(p.outline, 0.74), 0.8);
    ctx.restore();
  }

  function drawBodyMass(ctx, prof, p, pose, variant) {
    const s = prof.side || 1;
    const sideView = prof.view === 'side' || prof.view === 'diag';
    const width = sideView ? (variant.isElite ? 74 : 68) : (variant.isElite ? 48 : 42);
    const height = sideView ? (variant.isElite ? 28 : 25) : (variant.isElite ? 34 : 30);
    const chestX = sideView ? 19 * s : 0;
    const hipX = sideView ? -23 * s : 0;
    const bodyY = -33 + pose.breathe * 0.15;

    ellipse(ctx, hipX, bodyY + pose.hip * 0.28, width * 0.47, height * 0.72, prof.bodyTilt, p.dark, p.outline, 2.2);
    ellipse(ctx, chestX, bodyY - 4 + pose.shoulder * 0.28, width * 0.42, height * 0.86, prof.bodyTilt * 0.7, p.shoulder, p.outline, 2.25);
    ellipse(ctx, sideView ? -2 * s : 0, bodyY - 6, width * 0.46, height * 0.56, prof.bodyTilt * 0.4, p.body, rgba(p.outline, 0.72), 1.55);

    if (sideView) {
      const brisket = [[10 * s, -31], [24 * s, -37], [35 * s, -29], [38 * s, -16], [28 * s, -5], [16 * s, -11]];
      const flank = [[-22 * s, -23], [-10 * s, -14], [7 * s, -13], [16 * s, -21], [6 * s, -3], [-13 * s, -4], [-25 * s, -10]];
      const haunch = [[-38 * s, -29], [-25 * s, -38], [-10 * s, -34], [-7 * s, -20], [-17 * s, -9], [-34 * s, -12], [-42 * s, -21]];
      poly(ctx, brisket, rgba(p.hi, 0.20), null, 0);
      poly(ctx, flank, rgba(p.deep, 0.22), null, 0);
      poly(ctx, haunch, rgba(p.dark, 0.20), null, 0);
      strokePath(ctx, [[-29 * s, -24], [-16 * s, -17], [2 * s, -17], [18 * s, -22]], rgba(p.deep, 0.58), 1.7, null, 0.88);
      strokePath(ctx, [[15 * s, -40], [24 * s, -31], [27 * s, -18]], rgba(p.hi, 0.52), 1.25, null, 0.7);
      strokePath(ctx, [[-30 * s, -29], [-24 * s, -39], [-12 * s, -42]], rgba(p.hi, 0.34), 1.15, null, 0.58);
      for (let i = 0; i < 5; i++) {
        const fx = (-32 + i * 15) * s;
        const fy = -17 - (i % 2) * 2;
        poly(ctx, [[fx - 5 * s, fy], [fx - 1 * s, fy + 5], [fx + 6 * s, fy + 1]], rgba(p.deep, 0.30), 'rgba(0,0,0,0)', 0);
      }
    } else {
      poly(ctx, [[-17, -28], [-8, -38], [0, -35], [9, -38], [18, -28], [13, -11], [0, -8], [-13, -11]], rgba(p.hi, 0.16), null, 0);
      strokePath(ctx, [[-13, -24], [-6, -16], [0, -14], [6, -16], [13, -24]], rgba(p.deep, 0.52), 1.35, null, 0.82);
    }

    const ridgeY = -51 + pose.shoulder * 0.15;
    if (sideView) {
      const pts = [
        [-33 * s, ridgeY + 5], [-24 * s, ridgeY - 4], [-16 * s, ridgeY + 2], [-8 * s, ridgeY - 6],
        [2 * s, ridgeY - 2], [12 * s, ridgeY - 7], [25 * s, ridgeY + 2]
      ];
      for (let i = 0; i < pts.length - 2; i += 2) poly(ctx, [pts[i], pts[i + 1], pts[i + 2]], p.ridge, rgba(p.outline, 0.52), 0.9);
      strokePath(ctx, [[-31 * s, ridgeY + 3], [-9 * s, ridgeY - 4], [18 * s, ridgeY - 2], [33 * s, ridgeY + 4]], rgba(p.hi, 0.5), 2, null, 0.45);
      const crest = [[-32 * s, ridgeY + 5], [-27 * s, ridgeY - 3], [-21 * s, ridgeY + 4], [-14 * s, ridgeY - 5], [-7 * s, ridgeY + 3], [1 * s, ridgeY - 6], [10 * s, ridgeY + 1], [20 * s, ridgeY - 4], [28 * s, ridgeY + 4]];
      for (let i = 0; i < crest.length - 2; i += 2) poly(ctx, [crest[i], crest[i + 1], crest[i + 2]], rgba(p.hi, 0.20), 'rgba(0,0,0,0)', 0);
    } else {
      poly(ctx, [[-15, ridgeY + 4], [-7, ridgeY - 5], [0, ridgeY + 2], [8, ridgeY - 5], [16, ridgeY + 4]], p.ridge, rgba(p.outline, 0.5), 1);
    }

    withAlpha(ctx, 0.22, () => {
      ctx.fillStyle = p.deep;
      ctx.beginPath();
      ctx.ellipse(sideView ? -6 * s : 0, -24, width * 0.42, 7, prof.bodyTilt, 0, TAU);
      ctx.fill();
    });
  }

  function drawNeckAndChest(ctx, prof, p, pose, variant) {
    const s = prof.side || 1;
    const neckBaseX = prof.view === 'front' || prof.view === 'back' ? 0 : 25 * s;
    const y = -51 + pose.headBob * 0.18;
    const ruff = variant.isElite ? 1.14 : 1;
    poly(ctx, [
      [neckBaseX - 18 * ruff, y + 4], [neckBaseX - 8 * ruff, y - 13], [neckBaseX + 10 * ruff, y - 13],
      [neckBaseX + 22 * ruff, y + 3], [neckBaseX + 15 * ruff, y + 20], [neckBaseX - 3 * ruff, y + 18], [neckBaseX - 22 * ruff, y + 12]
    ], p.deep, p.outline, 2.1);
    poly(ctx, [
      [neckBaseX - 9 * ruff, y + 1], [neckBaseX - 2 * ruff, y + 18], [neckBaseX + 4 * ruff, y + 3],
      [neckBaseX + 11 * ruff, y + 20], [neckBaseX + 14 * ruff, y - 1]
    ], p.hi, rgba(p.outline, 0.7), 1.2);
    const tufts = [
      [[neckBaseX - 21 * ruff, y + 10], [neckBaseX - 27 * ruff, y + 18], [neckBaseX - 16 * ruff, y + 17]],
      [[neckBaseX - 9 * ruff, y + 17], [neckBaseX - 13 * ruff, y + 27], [neckBaseX - 4 * ruff, y + 22]],
      [[neckBaseX + 2 * ruff, y + 16], [neckBaseX + 0 * ruff, y + 28], [neckBaseX + 8 * ruff, y + 20]],
      [[neckBaseX + 12 * ruff, y + 11], [neckBaseX + 14 * ruff, y + 25], [neckBaseX + 20 * ruff, y + 15]]
    ];
    for (const pts of tufts) poly(ctx, pts, p.light, rgba(p.outline, 0.55), 0.9);
    strokePath(ctx, [[neckBaseX - 3 * ruff, y - 8], [neckBaseX + 4 * ruff, y + 1], [neckBaseX + 9 * ruff, y + 12]], rgba(p.hi, 0.62), 1.2, null, 0.7);
  }

  function drawLeg(ctx, x, hipY, swing, layerAlpha, p, type, variant) {
    const kneeShift = swing * (type === 'front' ? 4.2 : 3.2);
    const lowerShift = swing * (type === 'front' ? 5.2 : 4.0);
    const upper = type === 'front' ? p.shoulder : p.dark;
    const lower = type === 'front' ? p.dark : p.deep;
    withAlpha(ctx, layerAlpha, () => {
      poly(ctx, [[x - 5, hipY], [x + 5, hipY + 1], [x + 6 + kneeShift, hipY + 17], [x, hipY + 23], [x - 6 + kneeShift, hipY + 16]], upper, p.outline, 1.7);
      poly(ctx, [[x - 4 + kneeShift, hipY + 16], [x + 4 + kneeShift, hipY + 16], [x + 4 + lowerShift, hipY + 36], [x - 4 + lowerShift, hipY + 36]], lower, p.outline, 1.65);
      paw(ctx, x + lowerShift, hipY + 39, Math.sign(lowerShift || x || 1), p, 1);
    });
    if (variant.isElite && type === 'front') {
      withAlpha(ctx, 0.42, () => strokePath(ctx, [[x - 2, hipY + 4], [x + kneeShift, hipY + 20]], p.hi, 1.2, null, 1));
    }
  }

  function drawLegs(ctx, prof, p, pose, variant) {
    const sideView = prof.view === 'side' || prof.view === 'diag';
    const s = prof.side || 1;
    const amp = pose.moving ? 1 : 0.16;
    const a = pose.legA * amp;
    const b = pose.legB * amp;
    if (sideView) {
      drawLeg(ctx, -25 * s, -25 + pose.hip * 0.2, a, prof.view === 'diag' ? 0.7 : 0.78, p, 'rear', variant);
      drawLeg(ctx, -7 * s, -27, b, 0.9, p, 'rear', variant);
      drawLeg(ctx, 14 * s, -30 + pose.shoulder * 0.2, b, 0.84, p, 'front', variant);
      drawLeg(ctx, 29 * s, -31 + pose.shoulder * 0.2, a, 1.0, p, 'front', variant);
    } else {
      drawLeg(ctx, -19, -26, a, prof.view === 'back' ? 0.72 : 1, p, prof.view === 'back' ? 'rear' : 'front', variant);
      drawLeg(ctx, -6, -28, b, 0.9, p, prof.view === 'back' ? 'rear' : 'front', variant);
      drawLeg(ctx, 7, -28, a, 0.9, p, prof.view === 'back' ? 'rear' : 'front', variant);
      drawLeg(ctx, 20, -26, b, prof.view === 'back' ? 1 : 0.72, p, prof.view === 'back' ? 'rear' : 'front', variant);
    }
  }

  function drawEar(ctx, x, y, dir, p, pose, variant) {
    const twitch = pose.ear * (dir > 0 ? 0.8 : 1);
    const h = variant.isElite ? 19 : 16;
    poly(ctx, [[x, y - h - twitch], [x + dir * 9, y + 5], [x - dir * 6, y + 4]], p.dark, p.outline, 1.7);
    poly(ctx, [[x, y - h + 5 - twitch], [x + dir * 4, y + 1], [x - dir * 2.5, y + 1]], rgba(p.hi, 0.34), 'rgba(0,0,0,0)', 0);
  }

  function drawHead(ctx, prof, p, pose, variant) {
    const s = prof.side || 1;
    const hx = prof.headX + s * pose.lunge + s * pose.hitAmt * -4;
    const hy = prof.headY + pose.headBob - pose.howl * 4;
    const view = prof.view;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate((prof.neckLean || 0) * 0.08 + (pose.attacking ? -0.1 * s : 0) + pose.howl * -0.18 * s);

    if (prof.back) {
      ellipse(ctx, 0, 0, variant.isElite ? 18 : 16, variant.isElite ? 22 : 20, 0.02 * s, p.dark, p.outline, 2.0);
      drawEar(ctx, -8, -10, -1, p, pose, variant);
      drawEar(ctx, 8, -10, 1, p, pose, variant);
      strokePath(ctx, [[0, -13], [0, 12]], rgba(p.hi, 0.42), 2, null, 0.6);
      ctx.restore();
      return;
    }

    const skullW = variant.isElite ? 20 : 18;
    ellipse(ctx, 0, 0, skullW, variant.isElite ? 21 : 19, -0.04 * s, p.body, p.outline, 2.0);
    drawEar(ctx, -9, -11, -1, p, pose, variant);
    drawEar(ctx, 9, -11, 1, p, pose, variant);

    if (view === 'side') {
      poly(ctx, [[5 * s, -6], [16 * s, -9], [28 * s, -7], [37 * s, 0], [39 * s, 7], [31 * s, 12], [17 * s, 13], [7 * s, 10]], p.muzzle, p.outline, 1.8);
      poly(ctx, [[9 * s, 8], [19 * s, 10], [30 * s, 10], [24 * s, 15], [11 * s, 14]], rgba(p.deep, 0.72), rgba(p.outline,0.62), 0.9);
      ellipse(ctx, 36 * s, 4, 4.0, 4.4, 0, p.nose, null, 0, 1);
      withAlpha(ctx, 0.45, () => {
        strokePath(ctx, [[34 * s, 1], [38 * s, 2]], rgba(p.hi, 0.78), 0.9, null, 0.9);
        strokePath(ctx, [[36 * s, 4], [36 * s, 8]], rgba(p.deep, 0.72), 0.9, null, 0.9);
      });
      ellipse(ctx, 8 * s, -6, 2.8, 3.6, 0, variant.isElite ? p.eye : rgba(p.eye, 0.7), null, 0, 1);
      strokePath(ctx, [[3 * s, -11], [10 * s, -9]], rgba(p.outline, 0.82), 1.8, null, 1);
      strokePath(ctx, [[12 * s, 9], [28 * s, 10]], p.outline, 1.7, null, 1);
      strokePath(ctx, [[12 * s, 8], [19 * s, 13], [27 * s, 12]], rgba(p.deep,0.88), 1.2, null, 0.85);
      strokePath(ctx, [[29 * s, 5], [39 * s, 0]], rgba(p.outline,0.7), 1.2, null, 0.72);
      if (pose.attacking) {
        ellipse(ctx, 24 * s, 11, 7.4, 3.8, 0, '#080607', null, 0, 1);
        poly(ctx, [[29 * s, 8], [32 * s, 14], [24 * s, 10]], '#f2ead4', 'rgba(0,0,0,0)', 0);
        poly(ctx, [[22 * s, 10], [25 * s, 15], [18 * s, 11]], '#eadfc8', 'rgba(0,0,0,0)', 0);
      } else {
        poly(ctx, [[24 * s, 10], [27 * s, 13], [21 * s, 11]], '#eadfc8', 'rgba(0,0,0,0)', 0);
      }
      withAlpha(ctx, 0.78, () => {
        strokePath(ctx, [[26 * s, 4], [35 * s, 1]], rgba(p.hi, 0.82), 0.7, null, 0.95);
        strokePath(ctx, [[24 * s, 5], [33 * s, 8]], rgba(p.hi, 0.58), 0.7, null, 0.72);
        strokePath(ctx, [[22 * s, 6], [32 * s, 13]], rgba(p.hi, 0.48), 0.7, null, 0.58);
      });
    } else {
      poly(ctx, [[-10, -2], [10, -2], [15 * s, 7], [6, 15], [-6, 15], [-15 * s, 7]], p.muzzle, p.outline, 1.6);
      poly(ctx, [[-6, 9], [0, 13], [7, 9], [5, 15], [-5, 15]], rgba(p.deep,0.66), rgba(p.outline,0.55), 0.8);
      ellipse(ctx, 4 * s, 6, 4.2, 3.2, 0, p.nose, null, 0, 1);
      withAlpha(ctx, 0.48, () => {
        strokePath(ctx, [[4 * s, 3], [4 * s, 8]], rgba(p.deep, 0.72), 0.9, null, 0.9);
      });
      ellipse(ctx, -6, -6, 2.6, 3.0, 0, variant.isElite ? p.eye : rgba(p.eye, 0.7), null, 0, 1);
      ellipse(ctx, 7, -6, 2.6, 3.0, 0, variant.isElite ? p.eye : rgba(p.eye, 0.7), null, 0, 1);
      strokePath(ctx, [[-12, -10], [-4, -8]], rgba(p.outline, 0.78), 2.1, null, 1);
      strokePath(ctx, [[4, -8], [12, -10]], rgba(p.outline, 0.78), 2.1, null, 1);
      if (pose.attacking) {
        ellipse(ctx, 3 * s, 12, 7, 3.5, 0, '#080607', null, 0, 1);
        poly(ctx, [[-5, 10], [-2, 16], [0, 11]], '#eadfc8', 'rgba(0,0,0,0)', 0);
        poly(ctx, [[6, 10], [3, 16], [1, 11]], '#eadfc8', 'rgba(0,0,0,0)', 0);
      } else {
        poly(ctx, [[-4, 11], [-2, 14], [0, 11]], '#eadfc8', 'rgba(0,0,0,0)', 0);
        poly(ctx, [[5, 11], [3, 14], [1, 11]], '#eadfc8', 'rgba(0,0,0,0)', 0);
      }
    }

    strokePath(ctx, [[-12, -10], [-4, -8]], rgba(p.outline, 0.78), 2.1, null, 1);
    strokePath(ctx, [[4, -8], [12, -10]], rgba(p.outline, 0.78), 2.1, null, 1);
    withAlpha(ctx, 0.36, () => {
      strokePath(ctx, [[-10 * s, 5], [-17 * s, 4]], rgba(p.hi,0.72), 0.75, null, 0.9);
      strokePath(ctx, [[-10 * s, 7], [-18 * s, 9]], rgba(p.hi,0.58), 0.75, null, 0.85);
      strokePath(ctx, [[10 * s, 6], [17 * s, 4]], rgba(p.hi,0.56), 0.7, null, 0.72);
    });

    if (variant.isNamed) {
      strokePath(ctx, [[-7 * s, 4], [4 * s, 12], [12 * s, 9]], p.scar, 2, null, 0.86);
    }
    ctx.restore();
  }

  function drawFurDetail(ctx, prof, p, pose, variant) {
    const s = prof.side || 1;
    const sideView = prof.view === 'side' || prof.view === 'diag';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(p.hi, 0.35);
    ctx.lineWidth = 1.6;
    if (sideView) {
      for (let i = 0; i < 6; i++) {
        const x = (-30 + i * 11) * s;
        const y = -40 - (i % 2) * 3 + Math.sin(pose.t * 1.5 + i) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8 * s, y + 3);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(p.deep, 0.55);
      ctx.lineWidth = variant.isElite ? 2.4 : 1.8;
      ctx.beginPath();
      ctx.moveTo(-34 * s, -28);
      ctx.lineTo(-18 * s, -25);
      ctx.moveTo(8 * s, -29);
      ctx.lineTo(27 * s, -25);
      ctx.stroke();
      strokePath(ctx, [[14 * s, -50], [26 * s, -46], [31 * s, -39]], rgba(p.hi,0.46), 1.1, null, 0.65);
      strokePath(ctx, [[19 * s, -12], [6 * s, -3], [-8 * s, -2]], rgba(p.deep,0.52), 1.1, null, 0.65);
      strokePath(ctx, [[24 * s, -55], [29 * s, -66]], rgba(p.scar,0.8), 1.1, null, 0.72);
      strokePath(ctx, [[28 * s, -53], [34 * s, -63]], rgba(p.scar,0.8), 1.1, null, 0.72);
    } else {
      ctx.strokeStyle = rgba(p.hi, 0.32);
      ctx.beginPath();
      ctx.moveTo(-15, -38);
      ctx.lineTo(-7, -31);
      ctx.moveTo(15, -38);
      ctx.lineTo(7, -31);
      ctx.stroke();
      strokePath(ctx, [[-10, -46], [-4, -40], [0, -37], [4, -40], [10, -46]], rgba(p.deep,0.4), 1.2, null, 0.66);
    }
    if (variant.isRare || variant.isElite) {
      strokePath(ctx, [[-16 * s, -48], [-3 * s, -55], [13 * s, -50]], variant.isNamed ? p.hi : p.eye, 2.0, null, variant.isNamed ? 0.72 : 0.45);
    }
    ctx.restore();
  }

  function drawCorpse(ctx, prof, p, pose, variant) {
    const s = prof.side || 1;
    drawGroundShadow(ctx, p, variant);
    ctx.save();
    ctx.rotate(-0.05 * s);
    ellipse(ctx, -7 * s, -18, variant.isElite ? 46 : 40, variant.isElite ? 17 : 15, -0.05 * s, p.dark, p.outline, 2.2);
    ellipse(ctx, 28 * s, -24, variant.isElite ? 21 : 18, variant.isElite ? 12 : 10, -0.12 * s, p.body, p.outline, 1.9);
    strokePath(ctx, [[-34 * s, -23], [-56 * s, -26], [-69 * s, -20]], p.deep, variant.isElite ? 8 : 6, p.outline, 0.88);
    strokePath(ctx, [[-12 * s, -6], [-2 * s, 2]], p.deep, 6, p.outline, 0.82);
    strokePath(ctx, [[12 * s, -7], [25 * s, 1]], p.deep, 6, p.outline, 0.82);
    drawEar(ctx, 30 * s, -36, s, p, { ear: 0 }, variant);
    if (variant.isNamed) strokePath(ctx, [[22 * s, -28], [35 * s, -25], [42 * s, -21]], p.scar, 2, null, 0.75);
    ctx.restore();
  }

  function drawLocal(ctx, actor, nowMs = performance.now()) {
    if (!ctx || !actor) return false;
    const visualKey = resolveWolfVisualKey(actor);
    const variant = resolveVariant(actor, visualKey);
    const p = resolvePalette(actor, variant);
    const prof = DIRECTION_PROFILES[resolveFacingName(actor)] || DIRECTION_PROFILES.south;
    const pose = buildPose(actor, nowMs);

    ctx.save();
    if (pose.dead) {
      drawCorpse(ctx, prof, p, pose, variant);
      ctx.restore();
      return true;
    }

    ctx.translate((prof.side || 1) * (pose.lunge - pose.hitAmt * 3), pose.bob);
    drawGroundShadow(ctx, p, variant);
    drawElitePresence(ctx, p, pose, variant);
    drawTail(ctx, prof, p, pose, variant);
    drawLegs(ctx, prof, p, pose, variant);
    drawBodyMass(ctx, prof, p, pose, variant);
    drawNeckAndChest(ctx, prof, p, pose, variant);
    drawHead(ctx, prof, p, pose, variant);
    drawFurDetail(ctx, prof, p, pose, variant);

    if (pose.howling) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.20 + pose.howl * 0.18;
      ctx.strokeStyle = p.eye;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(prof.headX, prof.headY - 6, 34 + pose.howl * 8, 14 + pose.howl * 4, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!ctx || !actor) return false;
    const x = num(actor.screenX ?? actor.x, 0);
    const y = num(actor.screenY ?? actor.y, 0);
    const scale = clamp(num(actor.visualScale ?? actor.modelScale ?? actor.baseType?.visualScale, 1), 0.62, 1.85);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    const ok = drawLocal(ctx, actor, nowMs);
    ctx.restore();

    const visualKey = resolveWolfVisualKey(actor);
    const variant = resolveVariant(actor, visualKey);
    actor._nameplateAnchor = {
      x,
      y: y - (variant.isNamed ? 108 : variant.isElite ? 101 : 91) * scale
    };
    actor._wolfVisualKey = visualKey;
    actor._wolfDedicatedRenderer = true;
    actor._wolfAction = buildPose(actor, nowMs).action;
    actor._wolfDetailPass = 'wolf-high-detail-v0.13.95';
    return ok;
  }

  function anchorHeight(actor) {
    const variant = resolveVariant(actor, resolveWolfVisualKey(actor));
    const scale = clamp(num(actor?.visualScale ?? actor?.modelScale ?? actor?.baseType?.visualScale, 1), 0.62, 1.85);
    return (variant.isNamed ? 108 : variant.isElite ? 101 : 91) * scale;
  }

  const WolfProceduralModel = Object.freeze({
    canDraw,
    draw,
    drawLocal,
    anchorHeight,
    resolveWolfVisualKey,
    supportedActions: () => ACTIONS.slice(),
    supportedDirections: () => DIRECTIONS.slice(),
    palettes: BASE_PALETTES
  });

  DR.render.WolfProceduralModel = WolfProceduralModel;
  window.WolfProceduralModel = WolfProceduralModel;
})();
