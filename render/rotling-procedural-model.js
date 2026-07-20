(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;
  const ACTIONS = Object.freeze(['idle', 'walk', 'attack', 'hit', 'death', 'lunge', 'spit', 'swipe', 'claw', 'corruptionCast', 'sporeBurst']);
  const DIRECTIONS = Object.freeze(['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']);

  const PALETTES = Object.freeze({
    rotling: {
      outline: '#10150a', shadow: 'rgba(0,0,0,0.34)', aura: 'rgba(157,211,77,0.22)',
      deep: '#1a2510', dark: '#34441f', body: '#5f7939', torso: '#6e8642', light: '#8fac5b', hi: '#c1d77a',
      fungus: '#d6c58c', fungusDark: '#847447', pustule: '#b7d15b', maw: '#21140f', tooth: '#d9cf9c', eye: '#dfff89', thorn: '#3d2a17', root: '#4b301b', rot: '#768539'
    },
    elderRotling: {
      outline: '#0d1108', shadow: 'rgba(0,0,0,0.39)', aura: 'rgba(189,232,89,0.28)',
      deep: '#121c0c', dark: '#2c3a19', body: '#536f2e', torso: '#6d863e', light: '#9bb861', hi: '#d5e889',
      fungus: '#e1d5a3', fungusDark: '#9a884f', pustule: '#d4ee69', maw: '#1a0e0b', tooth: '#eee2b1', eye: '#f1ff95', thorn: '#32200f', root: '#513017', rot: '#7e9440'
    },
    sporeCrown: {
      outline: '#0c0f08', shadow: 'rgba(0,0,0,0.42)', aura: 'rgba(210,255,122,0.32)',
      deep: '#10170b', dark: '#243415', body: '#617837', torso: '#7d934a', light: '#a9bf65', hi: '#ecdf9f',
      fungus: '#f2ddb1', fungusDark: '#aa885a', pustule: '#edff7a', maw: '#160c09', tooth: '#fff0c0', eye: '#fbffb0', thorn: '#26170d', root: '#5b3518', rot: '#9aa750'
    }
  });

  const DIRECTION_PROFILES = Object.freeze({
    east:      { view: 'side',  side:  1, face: true,  back: false, headX: 19, headY: -49, torsoX: -3,  torsoY: -30, leadArm: 1.0, rearAlpha: 0.78, lean:  1 },
    southeast: { view: 'diag',  side:  1, face: true,  back: false, headX: 15, headY: -50, torsoX: -2,  torsoY: -31, leadArm: 0.72, rearAlpha: 0.88, lean:  0.65 },
    south:     { view: 'front', side:  1, face: true,  back: false, headX: 0,  headY: -51, torsoX: 0,   torsoY: -31, leadArm: 0.35, rearAlpha: 0.92, lean:  0 },
    southwest: { view: 'diag',  side: -1, face: true,  back: false, headX: -15, headY: -50, torsoX: 2,  torsoY: -31, leadArm: 0.72, rearAlpha: 0.88, lean: -0.65 },
    west:      { view: 'side',  side: -1, face: true,  back: false, headX: -19, headY: -49, torsoX: 3,  torsoY: -30, leadArm: 1.0, rearAlpha: 0.78, lean: -1 },
    northwest: { view: 'diag',  side: -1, face: false, back: true,  headX: -11, headY: -51, torsoX: 3,  torsoY: -31, leadArm: 0.55, rearAlpha: 0.72, lean: -0.45 },
    north:     { view: 'back',  side:  1, face: false, back: true,  headX: 0,  headY: -52, torsoX: 0,   torsoY: -31, leadArm: 0.20, rearAlpha: 0.66, lean:  0 },
    northeast: { view: 'diag',  side:  1, face: false, back: true,  headX: 11, headY: -51, torsoX: -3, torsoY: -31, leadArm: 0.55, rearAlpha: 0.72, lean:  0.45 }
  });

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function norm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function withAlpha(ctx, alpha, fn) { ctx.save(); ctx.globalAlpha *= alpha; try { fn(); } finally { ctx.restore(); } }
  function mixPalette(base, override) { return Object.freeze({ ...PALETTES.rotling, ...(base || {}), ...(override || {}) }); }
  function rgba(color, alpha = 1) {
    const a = clamp(Number(alpha), 0, 1);
    if (typeof color !== 'string' || !color.trim()) return `rgba(255,255,255,${a})`;
    const raw = color.trim();
    if (raw.startsWith('rgba(')) {
      const parts = raw.slice(5, -1).split(',').map(v => v.trim());
      if (parts.length >= 3) return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
    }
    if (raw.startsWith('rgb(')) {
      const parts = raw.slice(4, -1).split(',').map(v => v.trim());
      if (parts.length >= 3) return `rgba(${parts[0]},${parts[1]},${parts[2]},${a})`;
    }
    const hex = raw[0] === '#' ? raw.slice(1) : raw;
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return raw;
  }


  function poly(ctx, pts, fill, stroke, lw = 2, alpha = 1) {
    if (!pts || pts.length < 3) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke || fill;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    if (stroke && lw > 0) ctx.stroke();
    ctx.restore();
  }

  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke, lw = 2, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke || fill;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    ctx.fill();
    if (stroke && lw > 0) ctx.stroke();
    ctx.restore();
  }

  function circle(ctx, x, y, r, fill, stroke, lw = 1.2, alpha = 1) { ellipse(ctx, x, y, r, r, 0, fill, stroke, lw, alpha); }

  function strokePath(ctx, pts, color, width, outline, alpha = 1) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (outline && width > 1) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = width + 2.2;
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

  function resolveFacingName(actor) {
    const explicit = String(actor?.facingName || actor?._humanoidSheetDirection || '').toLowerCase().replace(/[\s_\-]/g, '');
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

  function resolveRotlingVisualKey(actor) {
    const explicit = actor?.rotlingVisualKey || actor?.mobVisualKey || actor?.baseType?.mobVisualKey || actor?.visualKey || actor?.baseType?.visualKey;
    const key = norm(explicit);
    if (key.includes('elder') || key.includes('elite')) return 'rotlingElder';
    if (key.includes('spore') || key.includes('crown') || key.includes('named')) return 'sporeCrownRotling';
    if (key.includes('rotling') || key.includes('rootling') || key.includes('rot')) return 'rotling';
    const text = norm([actor?.name, actor?.baseType?.name, actor?.rendererId, actor?.baseType?.rendererId, actor?.family, actor?.baseType?.family, actor?.aiProfile, actor?.baseType?.aiProfile, actor?.threatTag, actor?.baseType?.threatTag].filter(Boolean).join(' '));
    if (text.includes('spore') || text.includes('crown') || text.includes('named')) return 'sporeCrownRotling';
    if (text.includes('elder') || text.includes('elite') || text.includes('rare')) return 'rotlingElder';
    return 'rotling';
  }

  function resolveVariant(actor, visualKey) {
    const rarityText = norm([actor?.rarity, actor?.rank, actor?.threatTag, actor?.baseType?.threatTag].filter(Boolean).join(' '));
    const isNamed = !!(actor?.isNamed || actor?.named || actor?.rareNameplate || actor?.baseType?.named || visualKey === 'sporeCrownRotling' || rarityText.includes('named'));
    const isRare = !!(isNamed || actor?.isRare || actor?.rare || visualKey === 'rotlingElder' || rarityText.includes('rare'));
    const isElite = !!(isRare || actor?.isElite || actor?.elite || actor?.baseType?.elite || visualKey === 'rotlingElder' || visualKey === 'sporeCrownRotling' || rarityText.includes('elite'));
    return Object.freeze({ isNamed, isRare, isElite, visualKey, accentBoost: isNamed ? 2 : isElite ? 1 : 0 });
  }

  function resolvePalette(actor, variant) {
    const key = norm(actor?.rotlingPalette || actor?.paletteKey || actor?.palette || actor?.baseType?.palette || variant.visualKey);
    let base = PALETTES.rotling;
    if (variant.visualKey === 'sporeCrownRotling' || key.includes('spore') || key.includes('crown')) base = PALETTES.sporeCrown;
    else if (variant.visualKey === 'rotlingElder' || key.includes('elder') || (variant.isElite && !variant.isNamed)) base = PALETTES.elderRotling;
    return mixPalette(base, actor?.visualPalette || actor?.rotlingPaletteOverride || null);
  }

  function canDraw(actor) {
    if (!actor) return false;
    const text = norm([actor.rendererId, actor.baseType?.rendererId, actor.mobType, actor.species, actor.type, actor.name, actor.baseType?.name, actor.family, actor.baseType?.family, actor.mobVisualKey, actor.baseType?.mobVisualKey].filter(Boolean).join(' '));
    return actor.rendererId === 'rotling' || actor.baseType?.rendererId === 'rotling' || text.includes('rotling') || text.includes('rootling') || text.includes('rotroot');
  }

  function buildPose(actor, nowMs) {
    const t = nowMs / 1000;
    const raw = norm(actor?.action || actor?.state || '');
    const dead = actor?.alive === false || actor?.dead === true || raw === 'death' || raw === 'dead' || num(actor?.hp, 1) <= 0;
    const moving = !dead && !!(actor?.isMoving || actor?.moving || num(actor?.moveBlend, 0) > 0.05 || Math.abs(num(actor?.vx, 0)) + Math.abs(num(actor?.vy, 0)) > 0.01);
    const attackAnim = clamp(num(actor?.attackAnim, 0), 0, 1);
    const castAnim = clamp(num(actor?.spellCastAnim || actor?.castAnim, 0), 0, 1);
    const hitAnim = clamp(num(actor?.hitAnim || actor?.hitReaction || actor?.damageAnim, 0), 0, 1);
    const special = !dead && (raw === 'spit' || raw === 'sporeburst' || raw === 'corruptioncast' || raw === 'cast' || castAnim > 0.02);
    const attacking = !dead && (actor?.isAttacking || attackAnim > 0.02 || raw === 'attack' || raw === 'lunge' || raw === 'swipe' || raw === 'claw');
    const hit = !dead && (hitAnim > 0.02 || raw === 'hit');
    const step = moving ? t * 7.2 : t * 1.55;
    const pulse = Math.sin(t * 2.1);
    const twitch = Math.sin(t * 9.5 + 0.7) * Math.max(0, Math.sin(t * 1.7));
    const attackPulse = attacking ? (attackAnim ? Math.sin((1 - attackAnim) * Math.PI) : Math.sin((t * 6.0 % 1) * Math.PI)) : 0;
    const castPulse = special ? (castAnim || (0.5 + Math.sin(t * 5.2) * 0.5)) : 0;
    return Object.freeze({
      t, dead, moving, attacking, special, hit,
      action: dead ? 'death' : hit ? 'hit' : special ? 'corruptionCast' : attacking ? 'attack' : moving ? 'walk' : 'idle',
      step, pulse, twitch,
      bob: dead ? 0 : moving ? -Math.abs(Math.sin(step)) * 0.85 : Math.sin(t * 1.7) * 0.45,
      breathe: dead ? 0 : pulse * 1.2,
      hunch: dead ? 0 : Math.sin(t * 1.3 + 0.6) * 0.9,
      legA: moving ? Math.sin(step) : 0,
      legB: moving ? Math.sin(step + Math.PI) : 0,
      clawOpen: attackPulse,
      jaw: attackPulse * 4.2 + castPulse * 2.0,
      lunge: attackPulse * 9.0,
      castPulse,
      hitAmt: hit ? (hitAnim || 0.75) : 0
    });
  }

  function drawShadow(ctx, p, variant) {
    ellipse(ctx, 0, 8, variant.isNamed ? 38 : variant.isElite ? 34 : 30, variant.isNamed ? 10 : 8, 0, p.shadow, null, 0, 1);
  }

  function drawCorruptionPresence(ctx, p, pose, variant) {
    if (!variant.isRare && !variant.isElite && pose.action !== 'corruptionCast') return;
    const pulse = 0.5 + Math.sin(pose.t * 2.8) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = pose.action === 'corruptionCast' ? 0.20 + pulse * 0.10 : variant.isNamed ? 0.16 + pulse * 0.06 : 0.09 + pulse * 0.04;
    ctx.strokeStyle = variant.isNamed ? p.hi : p.pustule;
    ctx.lineWidth = variant.isNamed ? 2.6 : 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 6, variant.isNamed ? 38 : 31, variant.isNamed ? 11 : 8, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawFungalGrowth(ctx, x, y, r, p, variant, alpha = 1) {
    circle(ctx, x, y, r, p.fungus, p.outline, 0.9, alpha);
    withAlpha(ctx, 0.38 * alpha, () => circle(ctx, x + r * 0.25, y - r * 0.25, Math.max(1.1, r * 0.35), p.hi, null, 0, 1));
    if (variant.isElite && r > 2.8) circle(ctx, x - r * 0.1, y + r * 0.15, Math.max(0.8, r * 0.22), p.pustule, null, 0, 0.85);
  }

  function drawThorn(ctx, x, y, len, side, p, alpha = 1) {
    poly(ctx, [[x, y], [x + side * len * 0.34, y - len], [x + side * len * 0.82, y + len * 0.08]], p.thorn, p.outline, 0.9, alpha);
  }

  function drawSapBead(ctx, x, y, r, p, alpha = 1) {
    circle(ctx, x, y, r, p.fungus, p.outline, 0.45, alpha);
    withAlpha(ctx, 0.55 * alpha, () => circle(ctx, x + r * 0.2, y - r * 0.25, Math.max(0.3, r * 0.35), p.hi, null, 0, 1));
  }

  function drawLeafEar(ctx, x, y, side, p, alpha = 1) {
    poly(ctx, [[x, y], [x + 5 * side, y - 10], [x + 1.5 * side, y - 15], [x - 3 * side, y - 8]], p.body, p.outline, 0.8, alpha);
    withAlpha(ctx, 0.55 * alpha, () => {
      strokePath(ctx, [[x - 0.5 * side, y - 1], [x + 1.2 * side, y - 7], [x + 0.5 * side, y - 12]], p.light, 0.9, null, 1);
      strokePath(ctx, [[x + 0.8 * side, y - 7], [x + 3.8 * side, y - 10]], p.light, 0.7, null, 0.9);
    });
  }

  function drawRootWhiskers(ctx, x, y, side, p, alpha = 1) {
    withAlpha(ctx, alpha, () => {
      strokePath(ctx, [[x, y], [x + 8 * side, y + 1], [x + 13 * side, y + 6]], p.root, 1.0, p.outline, 0.9);
      strokePath(ctx, [[x - 1 * side, y + 2], [x + 7 * side, y + 5], [x + 10 * side, y + 10]], p.dark, 0.9, p.outline, 0.82);
      circle(ctx, x + 13 * side, y + 6, 0.8, p.light, null, 0, 0.85);
      circle(ctx, x + 10 * side, y + 10, 0.65, p.rot, null, 0, 0.72);
    });
  }

  function drawBackGrowths(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const lift = pose.breathe * 0.25 + pose.twitch * 0.45;
    const crowns = variant.isNamed ? 6 : variant.isElite ? 5 : 4;
    for (let i = 0; i < crowns; i++) {
      const local = i - (crowns - 1) / 2;
      const x = local * 8 - side * 4;
      const y = -58 + Math.abs(local) * 3 + lift;
      if (i % 2 === 0) drawThorn(ctx, x, y, 11 + variant.accentBoost, side || 1, p, 0.92);
      else drawFungalGrowth(ctx, x, y - 5, 3.0 + variant.accentBoost * 0.6, p, variant, 0.95);
    }
  }

  function drawLegPair(ctx, x, y, bend, p, rear, alpha = 1) {
    withAlpha(ctx, alpha, () => {
      const trunk = rear ? p.dark : p.root;
      strokePath(ctx, [[x, y], [x + bend * 4, y + 18], [x + bend * 9, y + 24]], trunk, 5.4, p.outline, 1);
      strokePath(ctx, [[x - 1.2, y + 2], [x + bend * 2.2, y + 14], [x + bend * 7.5, y + 22]], p.light, 1.0, null, 0.72);
      strokePath(ctx, [[x + 1.4, y + 3], [x + bend * 5.1, y + 16], [x + bend * 9.4, y + 23.2]], p.deep, 0.9, null, 0.68);
      ellipse(ctx, x + bend * 10, y + 25, 6.0, 3.1, 0.05 * bend, p.deep, p.outline, 1.0, 1);
      for (const t of [-1.5, 0.2, 1.8]) {
        strokePath(ctx, [[x + bend * 11.5, y + 24.6], [x + bend * (13.2 + t), y + 22.6 + t * 0.35]], p.thorn, 0.95, p.outline, 0.86);
      }
      strokePath(ctx, [[x + bend * 9.2, y + 26.0], [x + bend * 6.8, y + 28.7]], p.light, 0.75, null, 0.66);
      strokePath(ctx, [[x + bend * 10.8, y + 26.2], [x + bend * 9.0, y + 29.8]], p.light, 0.75, null, 0.66);
      withAlpha(ctx, 0.45, () => ellipse(ctx, x + bend * 11, y + 23.5, 1.4, 0.6, 0, p.light, null, 0, 1));
    });
  }

  function drawLimbs(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const walkA = pose.legA;
    const walkB = pose.legB;
    const frontReach = pose.lunge * 0.45;
    const rearAlpha = prof.rearAlpha || 0.8;
    drawLegPair(ctx, -15, -9 + walkA * 1.1, -0.6 + walkA * 0.22, p, true, rearAlpha);
    drawLegPair(ctx, 12, -8 + walkB * 1.0, 0.7 + walkB * 0.22, p, false, 1);
    strokePath(ctx, [[-14 * side, -31], [(-31 - frontReach) * side, -16 + walkB * 1.0], [(-37 - frontReach) * side, -6]], p.root, 6.0, p.outline, 0.88);
    strokePath(ctx, [[-13 * side, -30], [(-24 - frontReach * 0.35) * side, -17], [(-33 - frontReach * 0.6) * side, -9]], p.light, 1.15, null, 0.64);
    strokePath(ctx, [[-15 * side, -28], [(-28 - frontReach * 0.45) * side, -11], [(-34 - frontReach * 0.7) * side, -2]], p.deep, 0.95, null, 0.58);
    strokePath(ctx, [[14 * side, -32], [(34 + frontReach) * side, -19 + walkA * 1.0], [(44 + frontReach + pose.clawOpen * 3) * side, -7]], p.dark, 6.4, p.outline, 1);
    strokePath(ctx, [[12.5 * side, -30], [(29 + frontReach * 0.55) * side, -21], [(40 + frontReach) * side, -10]], p.light, 1.15, null, 0.66);
    strokePath(ctx, [[15.5 * side, -29], [(31 + frontReach * 0.45) * side, -17], [(43 + frontReach * 1.1) * side, -6]], p.deep, 0.95, null, 0.60);
    for (const claw of [-2, 0, 2]) {
      strokePath(ctx, [[(44 + frontReach) * side, -7], [(50 + frontReach + claw) * side, -3 + claw * 0.2]], p.thorn, 1.8, p.outline, 0.88);
    }
    strokePath(ctx, [[(42 + frontReach) * side, -6], [(37 + frontReach * 0.8) * side, -1]], p.light, 0.8, null, 0.64);
    strokePath(ctx, [[(44 + frontReach) * side, -5], [(43 + frontReach * 0.8) * side, 0]], p.light, 0.8, null, 0.64);
    if (variant.isElite) strokePath(ctx, [[18 * side, -27], [(37 + frontReach) * side, -33], [(49 + frontReach) * side, -27]], p.pustule, 2.4, p.outline, 0.72);
  }

  function drawBody(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const elite = variant.isNamed ? 1.16 : variant.isElite ? 1.08 : 1;
    const wobble = pose.breathe + pose.hunch;
    const torsoX = prof.torsoX + side * pose.lunge * 0.18;
    const torsoY = prof.torsoY + wobble * 0.35;
    poly(ctx, [
      [-24 * elite, -42 + wobble * 0.2],
      [-7 * elite, -53 + pose.twitch * 0.7],
      [19 * elite, -45 + wobble * 0.3],
      [25 * elite, -21],
      [9 * elite, -4],
      [-18 * elite, -6],
      [-29 * elite, -20]
    ], p.deep, p.outline, 2.0, 1);
    ellipse(ctx, torsoX - 5 * side, torsoY - 1, 27 * elite, 30 * elite, 0.08 * side, p.body, p.outline, 2.2, 1);
    ellipse(ctx, torsoX + 5 * side, torsoY - 6, 20 * elite, 26 * elite, -0.16 * side, p.torso, p.outline, 1.6, 0.96);
    ellipse(ctx, torsoX + 10 * side, torsoY - 21, 11 * elite, 9 * elite, -0.22 * side, p.light, null, 0, 0.42);
    poly(ctx, [[-9 * elite, -45], [6 * elite, -49], [18 * elite, -42], [12 * elite, -35], [-2 * elite, -36]], rgba(p.dark, 0.78), rgba(p.outline,0.38), 0.8, 0.68);
    poly(ctx, [[-21 * elite, -20], [-13 * elite, -28], [-4 * elite, -25], [-8 * elite, -16], [-18 * elite, -13]], rgba(p.rot, 0.78), rgba(p.outline,0.34), 0.7, 0.52);
    poly(ctx, [[8 * elite, -33], [17 * elite, -38], [22 * elite, -28], [16 * elite, -21], [8 * elite, -25]], rgba(p.body, 0.78), rgba(p.outline,0.3), 0.7, 0.50);
    withAlpha(ctx, 0.42, () => {
      strokePath(ctx, [[-18 * side, -37], [-8 * side, -26], [-16 * side, -13]], p.dark, 2.0, null, 1);
      strokePath(ctx, [[7 * side, -45], [16 * side, -33], [11 * side, -17]], p.light, 1.6, null, 1);
      strokePath(ctx, [[-23 * side, -28], [-12 * side, -16], [2 * side, -11], [16 * side, -15]], p.light, 1.0, null, 0.62);
      strokePath(ctx, [[-2 * side, -49], [4 * side, -40], [7 * side, -30]], p.light, 0.95, null, 0.58);
      ellipse(ctx, -10 * side, -17, 7.5, 4.5, 0.1 * side, p.rot, null, 0, 0.7);
    });
    ellipse(ctx, -11 * side, -18, 5.1, 3.2, 0.1 * side, rgba(0,0,0,0.22), rgba(p.outline,0.3), 0.5, 0.78);
    strokePath(ctx, [[-14 * side, -18], [-10 * side, -13], [-6 * side, -17]], rgba(p.deep, 0.72), 0.8, null, 0.66);
    drawBackGrowths(ctx, prof, p, pose, variant);
    drawFungalGrowth(ctx, -20 * side, -31, 3.5, p, variant, 0.78);
    drawFungalGrowth(ctx, 14 * side, -25, 2.5, p, variant, 0.7);
    drawFungalGrowth(ctx, 4 * side, -47, 2.1, p, variant, 0.62);
    drawSapBead(ctx, -5 * side, -8, 1.1, p, 0.82);
    drawSapBead(ctx, 17 * side, -22, 0.95, p, 0.72);
    strokePath(ctx, [[-6 * side, -33], [0 * side, -27], [8 * side, -24]], p.fungus, 0.7, null, 0.66);
    strokePath(ctx, [[6 * side, -28], [13 * side, -24], [17 * side, -17]], p.fungus, 0.7, null, 0.58);
    if (variant.isNamed) {
      drawFungalGrowth(ctx, -5 * side, -53, 4.4, p, variant, 0.95);
      strokePath(ctx, [[-24 * side, -21], [-38 * side, -13], [-44 * side, -17]], p.thorn, 3.0, p.outline, 0.84);
    }
  }

  function drawMaw(ctx, x, y, side, p, pose, visible) {
    const jaw = pose.jaw;
    const mawAlpha = visible ? 1 : 0.55;
    poly(ctx, [[x - 11 * side, y - 4], [x + (10 + jaw) * side, y - 2], [x + (8 + jaw) * side, y + 8], [x - 9 * side, y + 7]], p.maw, p.outline, 1.4, mawAlpha);
    for (let i = -1; i <= 1; i++) {
      const tx = x + (4 + i * 5 + jaw * 0.25) * side;
      poly(ctx, [[tx, y + 1], [tx + 2.4 * side, y + 6], [tx - 1.8 * side, y + 5]], p.tooth, p.outline, 0.6, mawAlpha * 0.9);
    }
    for (let i = -1; i <= 1; i++) {
      const tx = x + (1 + i * 4 + jaw * 0.16) * side;
      poly(ctx, [[tx, y - 1], [tx + 1.4 * side, y + 3], [tx - 1.0 * side, y + 2]], p.thorn, p.outline, 0.45, mawAlpha * 0.86);
    }
    strokePath(ctx, [[x - 6 * side, y + 2], [x + 1 * side, y + 5], [x + 8 * side, y + 4]], p.root, 0.9, null, mawAlpha * 0.48);
    if (jaw > 0.9) {
      strokePath(ctx, [[x + 3 * side, y + 2], [x + (8 + jaw * 0.5) * side, y + 8]], p.fungus, 0.7, null, mawAlpha * 0.62);
      strokePath(ctx, [[x + 1 * side, y + 3], [x + (5 + jaw * 0.35) * side, y + 7]], p.fungus, 0.6, null, mawAlpha * 0.54);
      strokePath(ctx, [[x - 2 * side, y + 4], [x + (1 + jaw * 0.3) * side, y + 9], [x + (5 + jaw * 0.4) * side, y + 11]], p.rot, 1.0, null, mawAlpha * 0.82);
      drawSapBead(ctx, x + (4 + jaw * 0.2) * side, y + 9, 0.8, p, mawAlpha * 0.92);
    }
  }

  function drawHead(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const elite = variant.isNamed ? 1.14 : variant.isElite ? 1.07 : 1;
    const x = prof.headX + side * pose.lunge * 0.52;
    const y = prof.headY + pose.breathe * 0.25 + pose.twitch * 0.4;
    const faceVisible = prof.face !== false;
    const headRot = -0.12 * side + pose.clawOpen * 0.08 * side;
    ellipse(ctx, x - 4 * side, y + 4, 20 * elite, 17 * elite, headRot, p.dark, p.outline, 2.0, 1);
    ellipse(ctx, x + 5 * side, y + 2, 18 * elite, 14 * elite, -0.2 * side, p.light, p.outline, 1.5, faceVisible ? 1 : 0.78);
    ellipse(ctx, x + 14 * side, y + 8 + pose.jaw * 0.22, 10 * elite, 7.5 * elite, -0.1 * side, p.torso, p.outline, 1.1, faceVisible ? 0.96 : 0.62);
    poly(ctx, [[x - 4 * side, y - 9], [x + 2 * side, y - 15], [x + 10 * side, y - 10], [x + 6 * side, y - 4]], rgba(p.deep, 0.66), rgba(p.outline,0.3), 0.6, 0.72);
    poly(ctx, [[x + 9 * side, y + 2], [x + 18 * side, y + 4], [x + 20 * side, y + 10], [x + 10 * side, y + 11], [x + 6 * side, y + 7]], rgba(p.body, 0.70), rgba(p.outline,0.28), 0.6, 0.62);
    drawMaw(ctx, x + 12 * side, y + 8, side, p, pose, faceVisible);
    ellipse(ctx, x + 7 * side, y - 2, variant.isNamed ? 4.4 : 3.8, variant.isNamed ? 3.9 : 3.2, 0, rgba(0,0,0,0.18), rgba(p.outline,0.25), 0.4, faceVisible ? 0.95 : 0.48);
    circle(ctx, x + 7 * side, y - 2, variant.isNamed ? 3.1 : 2.5, p.eye, p.outline, 0.8, faceVisible ? 1 : 0.55);
    withAlpha(ctx, faceVisible ? 0.50 : 0.22, () => circle(ctx, x + 7.8 * side, y - 2.8, 0.85, p.hi, null, 0, 1));
    circle(ctx, x - 3 * side, y - 4, 1.8, p.eye, p.outline, 0.7, faceVisible && prof.view === 'front' ? 0.85 : 0.38);
    strokePath(ctx, [[x - 1 * side, y - 1], [x + 3 * side, y - 5], [x + 8 * side, y - 2]], p.root, 1.0, null, 0.66);
    strokePath(ctx, [[x + 1 * side, y + 2], [x + 6 * side, y + 4], [x + 12 * side, y + 5]], p.light, 0.9, null, 0.52);
    drawRootWhiskers(ctx, x + 12 * side, y + 5, side, p, faceVisible ? 1 : 0.55);
    drawLeafEar(ctx, x - 8 * side, y - 8, -side, p, 0.86);
    drawThorn(ctx, x - 9 * side, y - 12, 10 + variant.accentBoost * 2, -side, p, 0.9);
    drawFungalGrowth(ctx, x - 2 * side, y - 13, 3.0 + variant.accentBoost * 0.5, p, variant, 0.9);
    if (variant.isElite) {
      drawFungalGrowth(ctx, x + 5 * side, y - 14, 3.2, p, variant, 0.92);
      strokePath(ctx, [[x - 14 * side, y + 14], [x - 2 * side, y + 19], [x + 13 * side, y + 17]], p.pustule, 2.0, p.outline, 0.62);
    }
  }

  function drawSporeCast(ctx, prof, p, pose, variant) {
    if (pose.action !== 'corruptionCast') return;
    const side = prof.side || 1;
    withAlpha(ctx, 0.40 + pose.castPulse * 0.18, () => {
      for (let i = 0; i < 5; i++) {
        const phase = pose.t * 2.7 + i * 1.31;
        const x = (24 + Math.sin(phase) * 8 + i * 3) * side;
        const y = -50 + Math.cos(phase * 0.7) * 12 - i * 3;
        circle(ctx, x, y, 2.0 + (i % 2), i % 2 ? p.fungus : p.pustule, null, 0, 1);
      }
    });
  }

  function drawDeath(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const elite = variant.isNamed ? 1.15 : variant.isElite ? 1.07 : 1;
    drawShadow(ctx, p, variant);
    withAlpha(ctx, 0.88, () => {
      strokePath(ctx, [[-24, 4], [-39, 14], [-48, 11]], p.root, 5, p.outline, 1);
      strokePath(ctx, [[18, 3], [35, 15], [47, 13]], p.dark, 5, p.outline, 1);
      ellipse(ctx, -2, -3, 31 * elite, 12.5 * elite, 0.08 * side, p.deep, p.outline, 2.0, 1);
      ellipse(ctx, 4 * side, -8, 25 * elite, 11 * elite, -0.03 * side, p.body, p.outline, 1.5, 0.92);
      for (let i = -2; i <= 2; i++) {
        const x = i * 9;
        drawFungalGrowth(ctx, x, -17 + Math.abs(i) * 2, 2.3 + (i % 2 ? 0.3 : 0.8), p, variant, 0.74);
      }
      ellipse(ctx, 28 * side, -9, 18 * elite, 9.5 * elite, 0.18 * side, p.dark, p.outline, 1.8, 1);
      drawMaw(ctx, 34 * side, -6, side, p, { jaw: 2.3 }, true);
      circle(ctx, 30 * side, -12, 1.6, p.eye, p.outline, 0.5, 0.55);
      strokePath(ctx, [[-19 * side, -10], [-33 * side, -15], [-39 * side, -10]], p.thorn, 2.6, p.outline, 0.7);
    });
  }

  function drawLocal(ctx, actor, nowMs = performance.now()) {
    const visualKey = resolveRotlingVisualKey(actor);
    const variant = resolveVariant(actor, visualKey);
    const p = resolvePalette(actor, variant);
    const pose = buildPose(actor, nowMs);
    const facingName = resolveFacingName(actor);
    const prof = DIRECTION_PROFILES[facingName] || DIRECTION_PROFILES.south;
    const scale = clamp(num(actor?.visualScale || actor?.modelScale, 1), 0.55, 2.25) * (variant.isNamed ? 1.10 : variant.isElite ? 1.06 : 1);

    ctx.save();
    ctx.scale(scale, scale);
    if (pose.hit) ctx.translate(-(prof.side || 1) * pose.hitAmt * 4.5, -pose.hitAmt * 2.2);
    if (pose.dead) {
      drawDeath(ctx, prof, p, pose, variant);
      ctx.restore();
      return true;
    }

    drawShadow(ctx, p, variant);
    drawCorruptionPresence(ctx, p, pose, variant);
    ctx.translate((prof.lean || 0) * pose.lunge * 0.3, pose.bob);
    drawLimbs(ctx, prof, p, pose, variant);
    drawBody(ctx, prof, p, pose, variant);
    drawHead(ctx, prof, p, pose, variant);
    drawSporeCast(ctx, prof, p, pose, variant);
    ctx.restore();
    return true;
  }

  function anchorHeight(actor) {
    const visualKey = resolveRotlingVisualKey(actor);
    const variant = resolveVariant(actor, visualKey);
    const scale = clamp(num(actor?.visualScale || actor?.modelScale, 1), 0.55, 2.25) * (variant.isNamed ? 1.10 : variant.isElite ? 1.06 : 1);
    if (actor?.alive === false || actor?.dead === true) return 48 * scale;
    return (variant.isNamed ? 91 : variant.isElite ? 84 : 78) * scale;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!ctx || !actor || !canDraw(actor)) return false;
    const x = num(actor.screenX, 0);
    const y = num(actor.screenY, 0);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const ok = drawLocal(ctx, actor, nowMs);
    ctx.restore();
    actor._rotlingVisualKey = resolveRotlingVisualKey(actor);
    actor._rotlingAction = buildPose(actor, nowMs).action;
    actor._rotlingDedicatedRenderer = true;
    actor._rotlingDetailPass = 'rotling-high-detail-v0.14.00-rgba-runtime-fix';
    actor._nameplateAnchor = { x, y: y - anchorHeight(actor) };
    return ok;
  }

  DR.render.RotlingProceduralModel = Object.freeze({
    canDraw,
    draw,
    drawLocal,
    anchorHeight,
    resolveRotlingVisualKey,
    supportedActions: () => ACTIONS.slice(),
    supportedDirections: () => DIRECTIONS.slice()
  });
  window.RotlingProceduralModel = DR.render.RotlingProceduralModel;
})();
