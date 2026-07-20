(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;
  const ACTIONS = Object.freeze(['idle', 'walk', 'charge', 'attack', 'hit', 'death', 'specialAttack']);
  const DIRECTIONS = Object.freeze(['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']);

  // V0.13.92: High-detail Boar graphical refinement pass. This stays procedural Canvas 2D,
  // but adds modeled-detail equivalents: muscle contour bands, skin folds, bristle tufts,
  // tusk/hoof growth rings, scars, osteoderms, mud buildup, and facial surface detail.

  const PALETTES = Object.freeze({
    mudTusker: {
      outline: '#160f0a', shadow: 'rgba(0,0,0,0.36)',
      deep: '#2a1c12', dark: '#553821', body: '#8e6540', shoulder: '#a57749', light: '#be8f5a', hi: '#e1c18d',
      snout: '#6f452b', nose: '#17100b', tusk: '#eadfc6', hoof: '#21150d', eye: '#1a1009', bristle: '#21150d', mud: '#4a2d19', scar: '#b46c55', moss: '#687543'
    },
    bristleback: {
      outline: '#130d09', shadow: 'rgba(0,0,0,0.40)',
      deep: '#1f140d', dark: '#482d1b', body: '#765230', shoulder: '#986a3e', light: '#b78655', hi: '#e0b780',
      snout: '#5d3823', nose: '#130d09', tusk: '#f0dfbe', hoof: '#1c120c', eye: '#ffd08a', bristle: '#130d09', mud: '#3e2416', scar: '#c57b5a', moss: '#586c3a'
    },
    oldTusk: {
      outline: '#120c08', shadow: 'rgba(0,0,0,0.44)',
      deep: '#26170d', dark: '#684227', body: '#a37543', shoulder: '#bd884f', light: '#d0a064', hi: '#eed097',
      snout: '#7a4a2a', nose: '#16100a', tusk: '#fff2d6', hoof: '#24160d', eye: '#ffcf7a', bristle: '#2a190e', mud: '#5a341d', scar: '#d38b69', moss: '#6f8345', bark: '#443018'
    }
  });

  const DIRECTION_PROFILES = Object.freeze({
    east:      { view: 'side',  side:  1, headX: 37, headY: -34, rearX: -32, bodyTilt: -0.04, rearAlpha: 1.00 },
    southeast: { view: 'diag',  side:  1, headX: 27, headY: -34, rearX: -27, bodyTilt: -0.025, rearAlpha: 0.95 },
    south:     { view: 'front', side:  1, headX: 0,  headY: -35, rearX: 0,   bodyTilt: 0.00, rearAlpha: 0.82 },
    southwest: { view: 'diag',  side: -1, headX: -27, headY: -34, rearX: 27, bodyTilt: 0.025, rearAlpha: 0.95 },
    west:      { view: 'side',  side: -1, headX: -37, headY: -34, rearX: 32, bodyTilt: 0.04, rearAlpha: 1.00 },
    northwest: { view: 'diag',  side: -1, headX: -23, headY: -36, rearX: 31, bodyTilt: 0.025, rearAlpha: 0.88 },
    north:     { view: 'back',  side:  1, headX: 0,  headY: -37, rearX: 0,   bodyTilt: 0.00, rearAlpha: 0.76 },
    northeast: { view: 'diag',  side:  1, headX: 23, headY: -36, rearX: -31, bodyTilt: -0.025, rearAlpha: 0.88 }
  });

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function norm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function withAlpha(ctx, alpha, fn) { ctx.save(); ctx.globalAlpha *= alpha; try { fn(); } finally { ctx.restore(); } }
  function rgba(hex, alpha) {
    const raw = String(hex || '#ffffff').replace('#', '');
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw.padEnd(6, 'f').slice(0, 6);
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  function mixPalette(base, override) { return Object.freeze({ ...PALETTES.mudTusker, ...(base || {}), ...(override || {}) }); }

  function poly(ctx, pts, fill, stroke, lw = 2, alpha = 1) {
    if (!pts || pts.length < 3) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
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
  function circle(ctx, x, y, r, fill, stroke, lw = 1.25, alpha = 1) { ellipse(ctx, x, y, r, r, 0, fill, stroke, lw, alpha); }

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

  function resolveBoarVisualKey(actor) {
    const explicit = actor?.boarVisualKey || actor?.mobVisualKey || actor?.baseType?.mobVisualKey || actor?.visualKey || actor?.baseType?.visualKey;
    const key = norm(explicit);
    if (key.includes('oldtusk') || key.includes('briarback')) return 'oldTuskBriarback';
    if (key.includes('bristle') || key.includes('elite')) return 'bristlebackBoar';
    if (key.includes('briar') || key.includes('boar')) return 'briarBoar';
    const text = norm([actor?.name, actor?.baseType?.name, actor?.rendererId, actor?.baseType?.rendererId, actor?.family, actor?.baseType?.family, actor?.aiProfile, actor?.baseType?.aiProfile].filter(Boolean).join(' '));
    if (text.includes('oldtusk') || text.includes('briarback')) return 'oldTuskBriarback';
    if (text.includes('elite') || text.includes('rare')) return 'bristlebackBoar';
    return 'briarBoar';
  }

  function resolveVariant(actor, visualKey) {
    const rarityText = norm([actor?.rarity, actor?.rank, actor?.threatTag, actor?.baseType?.threatTag].filter(Boolean).join(' '));
    const isNamed = !!(actor?.isNamed || actor?.named || actor?.rareNameplate || actor?.baseType?.named || visualKey === 'oldTuskBriarback' || rarityText.includes('named'));
    const isRare = !!(isNamed || actor?.isRare || actor?.rare || rarityText.includes('rare'));
    const isElite = !!(isRare || actor?.isElite || actor?.elite || actor?.baseType?.elite || visualKey === 'bristlebackBoar' || visualKey === 'oldTuskBriarback' || rarityText.includes('elite'));
    return Object.freeze({ isNamed, isRare, isElite, visualKey });
  }

  function resolvePalette(actor, variant) {
    const key = norm(actor?.boarPalette || actor?.paletteKey || actor?.palette || actor?.baseType?.palette || variant.visualKey);
    let base = PALETTES.mudTusker;
    if (variant.visualKey === 'oldTuskBriarback' || key.includes('oldtusk')) base = PALETTES.oldTusk;
    else if (variant.visualKey === 'bristlebackBoar' || key.includes('bristle') || (variant.isElite && !variant.isNamed)) base = PALETTES.bristleback;
    return mixPalette(base, actor?.visualPalette || actor?.boarPaletteOverride || null);
  }

  function canDraw(actor) {
    if (!actor) return false;
    const text = norm([actor.rendererId, actor.baseType?.rendererId, actor.mobType, actor.species, actor.type, actor.name, actor.baseType?.name, actor.family, actor.baseType?.family, actor.mobVisualKey, actor.baseType?.mobVisualKey].filter(Boolean).join(' '));
    return actor.rendererId === 'boar' || actor.baseType?.rendererId === 'boar' || text.includes('boar') || text.includes('tusk') || text.includes('briarback');
  }

  function buildPose(actor, nowMs) {
    const t = nowMs / 1000;
    const raw = norm(actor?.action || actor?.state || '');
    const dead = actor?.alive === false || actor?.dead === true || raw === 'death' || raw === 'dead' || num(actor?.hp, 1) <= 0;
    const moving = !dead && !!(actor?.isMoving || actor?.moving || num(actor?.moveBlend, 0) > 0.05 || Math.abs(num(actor?.vx, 0)) + Math.abs(num(actor?.vy, 0)) > 0.01);
    const attackAnim = clamp(num(actor?.attackAnim, 0), 0, 1);
    const hitAnim = clamp(num(actor?.hitAnim || actor?.hitReaction || actor?.damageAnim, 0), 0, 1);
    const charging = !dead && (raw === 'charge' || raw === 'specialattack' || actor?.isCharging || actor?.baseType?.aiProfile === 'charger');
    const attacking = !dead && (actor?.isAttacking || attackAnim > 0.02 || raw === 'attack' || charging);
    const hit = !dead && (hitAnim > 0.02 || raw === 'hit');
    const step = moving ? t * 8.0 : t * 1.55;
    const walkSin = Math.sin(step);
    const attackPulse = attacking ? (attackAnim ? Math.sin((1 - attackAnim) * Math.PI) : Math.sin((t * 6.4 % 1) * Math.PI)) : 0;
    const chargeBias = charging ? 1 : 0;
    return Object.freeze({
      t, dead, moving, attacking, charging, hit,
      action: dead ? 'death' : hit ? 'hit' : charging ? 'charge' : attacking ? 'attack' : moving ? 'walk' : 'idle',
      step, walkSin,
      bob: dead ? 0 : moving ? -Math.abs(walkSin) * 1.0 : Math.sin(t * 1.45) * 0.36,
      breathe: dead ? 0 : Math.sin(t * 1.7) * 1.25,
      shoulder: moving ? Math.sin(step + 0.25) * 2.0 : Math.sin(t * 1.45) * 0.8,
      headBob: moving ? Math.sin(step + 0.9) * 1.65 : Math.sin(t * 1.2) * 0.65,
      legA: moving ? Math.sin(step) : 0,
      legB: moving ? Math.sin(step + Math.PI) : 0,
      bristle: dead ? 0 : Math.sin(t * 2.4) * 0.7,
      ear: dead ? 0 : (Math.sin(t * 3.7) > 0.86 ? 1.6 : 0),
      attack: attackPulse,
      lunge: attackPulse * (charging ? 12.5 : 8.0),
      headDrop: chargeBias * 6 + attackPulse * (charging ? 4.5 : 1.8),
      hitAmt: hit ? (hitAnim || 0.75) : 0
    });
  }

  function drawShadow(ctx, p, variant) {
    ellipse(ctx, 0, 8, variant.isNamed ? 55 : variant.isElite ? 50 : 45, variant.isNamed ? 14 : 12, 0, p.shadow, null, 0, 1);
  }

  function drawElitePresence(ctx, p, pose, variant) {
    if (!variant.isRare && !variant.isElite) return;
    const pulse = 0.5 + Math.sin(pose.t * 2.6) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = variant.isNamed ? 0.19 + pulse * 0.07 : 0.10 + pulse * 0.04;
    ctx.strokeStyle = variant.isNamed ? p.hi : p.tusk;
    ctx.lineWidth = variant.isNamed ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(0, 7, variant.isNamed ? 56 : 48, variant.isNamed ? 13 : 11, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawHoof(ctx, x, y, p, alpha = 1) {
    // Keratin hoof: split cleft, layered growth bands, chipped contact edge.
    ellipse(ctx, x, y, 6.8, 3.3, 0, p.hoof, p.outline, 1.25, alpha);
    withAlpha(ctx, 0.42 * alpha, () => {
      strokePath(ctx, [[x, y - 2.7], [x, y + 2.3]], rgba(p.deep, 0.95), 0.85, null, 1);
      strokePath(ctx, [[x - 4.4, y - 1.4], [x + 4.2, y - 1.2]], rgba(p.light, 0.80), 0.55, null, 1);
      strokePath(ctx, [[x - 5.0, y + 0.8], [x - 1.2, y + 1.6], [x + 2.2, y + 1.2], [x + 5.1, y + 0.4]], rgba(p.mud, 0.9), 0.9, null, 0.92);
      ctx.fillStyle = p.light;
      ctx.beginPath();
      ctx.ellipse(x + 1.5, y - 1.2, 1.2, 0.6, 0, 0, TAU);
      ctx.fill();
      for (let i = -1; i <= 1; i++) {
        circle(ctx, x + i * 3.0, y + 2.0 + (i === 0 ? 0.4 : 0), 0.55, p.outline, null, 0, 0.45);
      }
    });
  }

  function drawLegs(ctx, prof, p, pose, variant) {
    const sideView = prof.view === 'side' || prof.view === 'diag';
    const eliteBulk = variant.isNamed ? 1.16 : variant.isElite ? 1.09 : 1;
    const positions = sideView
      ? [
          { x: -32, swing: pose.legB, rear: true,  scale: 0.92 },
          { x: -14, swing: pose.legA, rear: false, scale: 1.02 },
          { x: 13,  swing: pose.legA, rear: true,  scale: 1.05 },
          { x: 31,  swing: pose.legB, rear: false, scale: 1.16 }
        ]
      : [
          { x: -20, swing: pose.legB, rear: true,  scale: 0.92 },
          { x: -7,  swing: pose.legA, rear: false, scale: 1.06 },
          { x: 7,   swing: pose.legA, rear: true,  scale: 1.00 },
          { x: 20,  swing: pose.legB, rear: false, scale: 1.14 }
        ];

    for (const leg of positions) {
      const alpha = leg.rear ? 0.58 : 1;
      const legW = (variant.isElite ? 7.5 : 6.5) * leg.scale * eliteBulk;
      const planted = Math.max(0, -leg.swing);
      const drive = pose.charging ? 1.4 : 1;
      const kneeX = leg.x + leg.swing * (sideView ? 2.6 : 1.5) * drive;
      const kneeY = -9 + Math.abs(leg.swing) * 1.55;
      const ankleX = leg.x + leg.swing * (sideView ? 4.0 : 2.3) * drive;
      const ankleY = 8 - Math.max(0, leg.swing) * 1.1 + planted * 0.6;
      const hoofX = leg.x + leg.swing * (sideView ? 5.0 : 2.8) * drive;
      const hoofY = 18 - Math.max(0, leg.swing) * 2.0;

      strokePath(ctx, [[leg.x, -23], [kneeX, kneeY]], leg.rear ? p.deep : p.dark, legW, p.outline, alpha);
      strokePath(ctx, [[kneeX, kneeY], [ankleX, ankleY], [hoofX, hoofY]], leg.rear ? p.dark : p.body, legW * 0.82, p.outline, alpha);
      withAlpha(ctx, 0.30 * alpha, () => {
        strokePath(ctx, [[leg.x + 1.5, -20], [kneeX + 1.0, -4], [ankleX, 7]], p.light, Math.max(1.0, legW * 0.22), null, 1);
      });
      drawHoof(ctx, hoofX, hoofY + 1, p, alpha);
      drawHighPolyBoarLegDetail(ctx, leg.x, kneeX, kneeY, ankleX, ankleY, hoofX, hoofY, legW, p, alpha, leg.rear, variant);
    }

    if (!sideView) {
      withAlpha(ctx, 0.42, () => {
        ellipse(ctx, -19, -15, 8, 13, -0.08, p.deep, p.outline, 0.8, 1);
        ellipse(ctx, 19, -15, 8, 13, 0.08, p.deep, p.outline, 0.8, 1);
      });
    }
  }

  function drawBristles(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const count = variant.isNamed ? 11 : variant.isElite ? 10 : 8;
    const frontBack = prof.view === 'front' || prof.view === 'back';
    const start = frontBack ? -28 : -42;
    const spacing = frontBack ? 7 : 9;
    for (let i = 0; i < count; i++) {
      const spineT = i / Math.max(1, count - 1);
      const x = (start + i * spacing) * (frontBack ? 1 : side);
      const arch = Math.sin(spineT * Math.PI) * 5.5;
      const baseY = -38 - arch + Math.sin(i * 1.7 + pose.t * 1.35) * 0.55 + pose.bristle;
      const h = (variant.isNamed ? 17 : variant.isElite ? 15 : 12) + arch * 0.55;
      poly(ctx, [[x - 4.8, baseY + 4], [x + 0.5, baseY - h], [x + 6.2, baseY + 3]], p.bristle, p.outline, 0.9, 0.98);
      if ((variant.isElite || variant.isNamed) && i % 2 === 0) {
        withAlpha(ctx, 0.34, () => {
          strokePath(ctx, [[x + 0.5, baseY - h + 3], [x + 2.2, baseY - 1]], p.hi, 0.9, null, 1);
        });
      }
    }
  }


  function drawHighPolyBoarLegDetail(ctx, hipX, kneeX, kneeY, ankleX, ankleY, hoofX, hoofY, legW, p, alpha, rear, variant) {
    const veinAlpha = rear ? 0.18 : 0.34;
    withAlpha(ctx, alpha, () => {
      // Tendons and cuticle rolls at the hoof transition.
      strokePath(ctx, [[kneeX - 1.2, kneeY + 1], [ankleX - 0.8, ankleY + 2], [hoofX - 1.0, hoofY - 3]], rgba(p.light, 0.82), Math.max(0.75, legW * 0.13), null, veinAlpha);
      strokePath(ctx, [[kneeX + 1.4, kneeY + 2], [ankleX + 1.1, ankleY + 4], [hoofX + 1.6, hoofY - 2]], rgba(p.deep, 0.88), Math.max(0.70, legW * 0.11), null, veinAlpha);
      strokePath(ctx, [[hoofX - 5.3, hoofY - 4], [hoofX + 4.6, hoofY - 4]], rgba(p.snout, 0.70), 0.95, null, 0.38);
      // Mud-caked lower legs with cracked dried buildup.
      ellipse(ctx, ankleX - 1.4, ankleY + 3.8, 3.4, 2.1, -0.15, p.mud, null, 0, rear ? 0.28 : 0.52);
      ellipse(ctx, hoofX + 2.2, hoofY - 0.3, 2.6, 1.3, 0.2, p.mud, null, 0, rear ? 0.22 : 0.45);
      if (!rear) {
        for (let i = 0; i < 3; i++) {
          const fy = kneeY + 5 + i * 5;
          strokePath(ctx, [[kneeX - 4.0, fy], [kneeX + 2.7, fy + 0.7]], rgba(p.bristle, 0.55), 0.55, null, 0.42);
        }
      }
      if (variant.isElite || variant.isNamed) {
        circle(ctx, kneeX + 2.5, kneeY - 1.0, 1.1, rgba(p.moss, 0.84), p.outline, 0.35, rear ? 0.32 : 0.55);
      }
    });
  }

  function drawHighPolyBoarBodyDetail(ctx, prof, p, pose, variant, dims) {
    const side = prof.side || 1;
    const sideView = dims.sideView;
    const backLike = dims.backLike;
    const bulk = variant.isNamed ? 1.18 : variant.isElite ? 1.10 : 1;
    const foldAlpha = backLike ? 0.32 : 0.48;
    withAlpha(ctx, 1, () => {
      // Anatomical contour bands: shoulder hump, rib cage, flank, haunch.
      if (sideView) {
        strokePath(ctx, [[-38 * side, -30], [-22 * side, -36], [-4 * side, -38], [18 * side, -34], [38 * side, -27]], rgba(p.hi, 0.46), 1.05, null, 0.80);
        strokePath(ctx, [[5 * side, -41], [16 * side, -31], [19 * side, -17], [13 * side, -7]], rgba(p.deep, 0.78), 1.45, null, 0.70);
        strokePath(ctx, [[-35 * side, -18], [-20 * side, -11], [-1 * side, -8], [20 * side, -13], [35 * side, -20]], rgba(p.deep, 0.66), 1.25, null, 0.64);
        strokePath(ctx, [[-42 * side, -18], [-34 * side, -7], [-17 * side, -3]], rgba(p.light, 0.34), 1.0, null, 0.52);
        // Hindquarter muscle and rump roll.
        strokePath(ctx, [[-41 * side, -30], [-49 * side, -20], [-43 * side, -9], [-30 * side, -4]], rgba(p.deep, 0.75), 1.2, null, 0.60);
        strokePath(ctx, [[-29 * side, -33], [-25 * side, -21], [-28 * side, -9]], rgba(p.light, 0.42), 0.9, null, 0.45);
      } else {
        strokePath(ctx, [[-25, -35], [-10, -43], [8, -43], [25, -35]], rgba(p.hi, 0.42), 1.05, null, 0.70);
        strokePath(ctx, [[-28, -23], [-12, -13], [0, -9], [12, -13], [28, -23]], rgba(p.deep, 0.68), 1.2, null, 0.62);
        strokePath(ctx, [[-17, -37], [-11, -25], [-13, -11]], rgba(p.deep, 0.66), 0.95, null, 0.52);
        strokePath(ctx, [[17, -37], [11, -25], [13, -11]], rgba(p.deep, 0.66), 0.95, null, 0.52);
      }

      // Thick hide folds concentrated at neck/shoulder and joints.
      for (let i = 0; i < 5; i++) {
        const y = -42 + i * 5.2;
        const x0 = sideView ? (13 - i * 1.3) * side : -20 + i * 2.5;
        const x1 = sideView ? (39 - i * 1.7) * side : 20 - i * 2.5;
        strokePath(ctx, [[x0, y], [(x0 + x1) / 2, y + 2.0 + Math.sin(i + pose.t) * 0.3], [x1, y + 0.5]], rgba(i % 2 ? p.deep : p.snout, 0.58), 0.72, null, foldAlpha);
      }

      // Osteoderms / calcified nodules along flanks and upper legs.
      const noduleCount = variant.isNamed ? 13 : variant.isElite ? 11 : 8;
      for (let i = 0; i < noduleCount; i++) {
        const t = i / Math.max(1, noduleCount - 1);
        const nx = sideView ? (-31 + t * 63) * side : -18 + (i % 5) * 9;
        const ny = sideView ? (-33 + Math.sin(t * Math.PI) * 4 + (i % 2) * 4) : (-31 + Math.floor(i / 5) * 8 + (i % 2));
        const r = (variant.isNamed ? 1.45 : 1.15) + (i % 3) * 0.24;
        circle(ctx, nx, ny, r, rgba(p.mud, 0.88), p.outline, 0.32, variant.isNamed ? 0.62 : 0.42);
        if (i % 4 === 0) circle(ctx, nx + 1.0, ny - 0.7, 0.42, rgba(p.hi, 0.78), null, 0, 0.55);
      }

      // Pebbled hide, scars, ticks, embedded seed pods. Deterministic positions.
      const spots = sideView
        ? [[-31,-21],[-19,-29],[-6,-17],[7,-31],[20,-24],[31,-14],[-38,-10],[13,-10]]
        : [[-18,-24],[-7,-33],[8,-31],[19,-21],[-14,-10],[13,-12],[0,-20]];
      for (let i = 0; i < spots.length; i++) {
        const sx = (sideView ? spots[i][0] * side : spots[i][0]);
        const sy = spots[i][1];
        circle(ctx, sx, sy, 0.72 + (i % 2) * 0.28, rgba(i % 3 === 0 ? p.scar : p.deep, 0.68), null, 0, 0.44);
        if (i % 5 === 0) circle(ctx, sx + 2.2, sy - 1.1, 0.95, rgba(p.outline, 0.80), rgba(p.hi, 0.35), 0.25, 0.44);
      }
      // Healed gashes across shoulder/flank.
      strokePath(ctx, [[-27 * side, -27], [-16 * side, -22], [-8 * side, -27]], p.scar, 1.35, rgba(p.outline, 0.65), 0.72);
      strokePath(ctx, [[-20 * side, -19], [-9 * side, -16], [2 * side, -21]], rgba(p.scar, 0.86), 1.0, null, 0.52);
      if (variant.isElite || variant.isNamed) {
        strokePath(ctx, [[22 * side, -36], [33 * side, -29], [38 * side, -21]], p.scar, 1.5, rgba(p.outline, 0.70), 0.68);
      }
    });
  }

  function drawHighPolyBoarFurAndSurfacePass(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const sideView = prof.view === 'side' || prof.view === 'diag';
    withAlpha(ctx, 1, () => {
      // Directional bristle clumps and silhouette breakup along jawline, elbow, fetlocks, tail flow.
      const tuftCount = variant.isNamed ? 8 : variant.isElite ? 7 : 6;
      for (let i = 0; i < tuftCount; i++) {
        const x = sideView ? (-39 + i * 12) * side : (-22 + i * 8);
        const y = sideView ? -39 - Math.sin(i / Math.max(1, tuftCount - 1) * Math.PI) * 5 : -41 - Math.sin(i) * 2;
        strokePath(ctx, [[x, y], [x - 3.5 * side, y - 8 - (i % 3)]], p.bristle, 1.35, p.outline, 0.60);
        strokePath(ctx, [[x + 2 * side, y + 1], [x - 0.5 * side, y - 6]], rgba(p.hi, 0.55), 0.55, null, 0.38);
      }
      for (const k of [-1, 1]) {
        const ex = sideView ? (12 + k * 11) * side : k * 16;
        strokePath(ctx, [[ex, -6], [ex - 3 * side, 1], [ex - 7 * side, 5]], p.bristle, 1.2, null, 0.44);
        strokePath(ctx, [[ex + 4 * side, -5], [ex + 1 * side, 2], [ex - 2 * side, 6]], p.bristle, 1.0, null, 0.35);
      }
      // Dried mud crust along underbelly.
      for (let i = 0; i < 7; i++) {
        const x = sideView ? (-32 + i * 11) * side : (-20 + i * 7);
        const y = -5 + (i % 2) * 1.4;
        ellipse(ctx, x, y, 3.2 + (i % 3) * 0.7, 1.2 + (i % 2) * 0.5, 0.1 * side, p.mud, null, 0, 0.36);
      }
    });
  }

  function drawHighPolyBoarHeadDetail(ctx, hx, hy, side, p, pose, variant, sideView, front) {
    withAlpha(ctx, 1, () => {
      // Brow overhang and deep-set eye sockets.
      const browA = sideView
        ? [[hx - 8 * side, hy - 11], [hx + 5 * side, hy - 14], [hx + 16 * side, hy - 8], [hx + 3 * side, hy - 5]]
        : [[hx - 15, hy - 12], [hx - 4, hy - 16], [hx + 4, hy - 16], [hx + 15, hy - 12], [hx + 8, hy - 7], [hx - 8, hy - 7]];
      poly(ctx, browA, rgba(p.deep, 0.48), null, 0, 0.82);
      // Nasal ridges, nostril folds, pore clusters.
      if (sideView) {
        strokePath(ctx, [[hx + 5 * side, hy - 2], [hx + 20 * side, hy - 1], [hx + 32 * side, hy + 3]], rgba(p.light, 0.62), 1.0, null, 0.66);
        strokePath(ctx, [[hx + 8 * side, hy + 6], [hx + 25 * side, hy + 8], [hx + 36 * side, hy + 6]], rgba(p.deep, 0.72), 1.0, null, 0.62);
        ellipse(ctx, hx + 35 * side, hy + 6.2, 2.4, 1.2, -0.1 * side, p.deep, null, 0, 0.76);
        for (let i = 0; i < 7; i++) circle(ctx, hx + (21 + (i % 4) * 4) * side, hy + (i % 3) * 2 - 1, 0.48, rgba(p.deep, 0.78), null, 0, 0.45);
      } else {
        strokePath(ctx, [[hx - 13, hy - 1], [hx - 3, hy - 3], [hx + 3, hy - 3], [hx + 13, hy - 1]], rgba(p.light, 0.56), 0.95, null, 0.62);
        strokePath(ctx, [[hx - 12, hy + 7], [hx, hy + 10], [hx + 12, hy + 7]], rgba(p.deep, 0.76), 1.05, null, 0.64);
        ellipse(ctx, hx - 5.0, hy + 5.2, 1.7, 0.9, 0, p.deep, null, 0, 0.70);
        ellipse(ctx, hx + 5.0, hy + 5.2, 1.7, 0.9, 0, p.deep, null, 0, 0.70);
      }
      // Cheek/jaw muscle and skin fold networks.
      strokePath(ctx, [[hx - 12 * side, hy + 2], [hx + 2 * side, hy + 10], [hx + 15 * side, hy + 9]], rgba(p.light, 0.42), 1.0, null, 0.56);
      for (let i = 0; i < 4; i++) {
        const yy = hy + 9 + i * 2.4;
        strokePath(ctx, [[hx - (sideView ? 5 : 10) * side, yy], [hx + (sideView ? 15 : 10) * side, yy + Math.sin(i) * 0.9]], rgba(p.deep, 0.46), 0.65, null, 0.50);
      }
      // Torn ear edge / inner cartilage tufts are drawn after base ear indirectly near ear anchors.
      const earBase = sideView ? 10 : 14;
      strokePath(ctx, [[hx - earBase * side, hy - 14], [hx - (earBase + 2) * side, hy - 20], [hx - (earBase - 3) * side, hy - 16]], rgba(p.hi, 0.42), 0.65, null, 0.44);
      strokePath(ctx, [[hx + earBase * side, hy - 13], [hx + (earBase + 2) * side, hy - 19], [hx + (earBase - 3) * side, hy - 16]], rgba(p.hi, 0.34), 0.65, null, 0.34);
      if (variant.isNamed) {
        circle(ctx, hx - 7 * side, hy + 1, 1.2, rgba(p.moss, 0.80), p.outline, 0.3, 0.62);
      }
    });
  }

  function drawHighPolyBoarTuskDetail(ctx, hx, hy, side, p, pose, variant, sideView) {
    const tuskLen = variant.isNamed ? 31 : variant.isElite ? 25 : 20;
    const attack = pose.attack * 3;
    withAlpha(ctx, 0.88, () => {
      if (sideView) {
        for (let i = 0; i < 4; i++) {
          const k = i / 4;
          const x = hx + (20 + attack + tuskLen * k) * side;
          const y = hy + 2 - tuskLen * 0.36 * k;
          strokePath(ctx, [[x - 1.3 * side, y + 1.4], [x + 2.4 * side, y - 0.2]], rgba(i % 2 ? p.deep : p.hi, 0.68), 0.55, null, 0.62);
        }
        strokePath(ctx, [[hx + (22 + attack) * side, hy + 4], [hx + (24 + tuskLen * 0.82) * side, hy - 8]], rgba(p.deep, 0.56), 0.7, null, 0.55);
        circle(ctx, hx + (21 + attack) * side, hy + 7, 1.3, rgba(p.scar, 0.65), null, 0, 0.62);
      } else {
        for (const s of [-1, 1]) {
          strokePath(ctx, [[hx + s * 12, hy + 6], [hx + s * 19, hy + 11]], rgba(p.hi, 0.62), 0.55, null, 0.62);
          strokePath(ctx, [[hx + s * 14, hy + 8], [hx + s * 21, hy + 13]], rgba(p.deep, 0.46), 0.52, null, 0.52);
          circle(ctx, hx + s * 10.5, hy + 7.2, 1.2, rgba(p.scar, 0.60), null, 0, 0.54);
        }
      }
    });
  }

  function drawBody(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const sideView = prof.view === 'side' || prof.view === 'diag';
    const frontLike = prof.view === 'front';
    const backLike = prof.view === 'back';
    const namedBulk = variant.isNamed ? 1.12 : variant.isElite ? 1.06 : 1;
    const bodyW = sideView ? (82 * namedBulk) : (48 * namedBulk);
    const bodyH = sideView ? (25 * namedBulk) : (33 * namedBulk);
    const shoulderW = sideView ? (55 * namedBulk) : (55 * namedBulk);
    const shoulderH = sideView ? (39 * namedBulk) : (40 * namedBulk);
    const rearW = sideView ? (30 * namedBulk) : (37 * namedBulk);
    const rearH = sideView ? (21 * namedBulk) : (25 * namedBulk);
    const breathing = pose.breathe;

    if (backLike) {
      const rearBackContour = [[-32, -18], [-24, -29], [-9, -36], [10, -36], [25, -28], [32, -16], [24, -5], [7, 1], [-10, 1], [-26, -6]];
      const shoulderBackContour = [[-40, -30], [-30, -44], [-10, -51], [12, -50], [31, -43], [40, -30], [30, -11], [11, -4], [-12, -4], [-31, -12]];
      poly(ctx, rearBackContour, p.deep, p.outline, 2.2, prof.rearAlpha);
      poly(ctx, shoulderBackContour, p.body, p.outline, 2.5, 0.98);
      withAlpha(ctx, 0.32, () => {
        poly(ctx, [[-23, -17], [-10, -10], [11, -10], [24, -17], [9, -5], [-9, -5]], rgba(p.deep, 0.92), null, 0, 1);
      });
    } else {
      const rearMass = sideView
        ? [[-57 * side, -18], [-45 * side, -29], [-34 * side, -33], [-21 * side, -28], [-12 * side, -18], [-15 * side, -5], [-30 * side, 2], [-46 * side, -2]]
        : [[-28, -20], [-21, -31], [-8, -36], [10, -35], [22, -28], [26, -16], [20, -4], [7, 2], [-10, 2], [-23, -5]];
      const bellyMass = sideView
        ? [[-46 * side, -16], [-29 * side, -33], [-7 * side, -41], [20 * side, -41], [42 * side, -32], [51 * side, -17], [38 * side, -2], [7 * side, 2], [-26 * side, 0]]
        : [[-31, -17], [-23, -33], [-8, -42], [11, -42], [27, -33], [33, -18], [29, -5], [12, 3], [-13, 3], [-31, -5]];
      const chestMass = sideView
        ? [[-1 * side, -45], [17 * side, -52], [39 * side, -47], [52 * side, -33], [53 * side, -17], [39 * side, -4], [17 * side, -7], [2 * side, -18], [-5 * side, -32]]
        : [[-23, -41], [-11, -51], [11, -51], [25, -42], [33, -26], [28, -8], [11, -3], [-11, -3], [-28, -8], [-34, -26]];
      poly(ctx, rearMass, p.dark, p.outline, 2.1, prof.rearAlpha);
      poly(ctx, bellyMass, p.body, p.outline, 2.35, 1);
      poly(ctx, chestMass, p.shoulder, p.outline, 2.6, 1);

      // V0.13.92: the giant circular body primitives are removed.
      // Mass is now built from overlapping contour planes so the boar no longer reads as stacked circles.
      const bodyContour = sideView
        ? [[-46 * side, -17], [-34 * side, -32], [-12 * side, -41], [15 * side, -43], [42 * side, -34], [48 * side, -18], [34 * side, -4], [2 * side, 1], [-32 * side, -2]]
        : [[-27, -34], [-12, -44], [12, -44], [30, -32], [29, -9], [14, 3], [-14, 3], [-30, -9]];
      poly(ctx, bodyContour, rgba(p.body, 0.34), null, 0, 0.95);

      const backLine = sideView
        ? [[-45 * side, -34], [-29 * side, -43], [-6 * side, -48], [20 * side, -44], [43 * side, -34]]
        : [[-24, -39], [-8, -48], [10, -48], [27, -39], [15, -34], [-17, -34]];
      poly(ctx, backLine, rgba(p.dark, 0.62), null, 0, 0.98);

      const chestPlane = sideView
        ? [[13 * side, -49], [41 * side, -41], [50 * side, -22], [31 * side, -7], [7 * side, -15]]
        : [[-24, -42], [24, -42], [33, -22], [17, -6], [-17, -6], [-33, -22]];
      poly(ctx, chestPlane, rgba(p.light, 0.28), null, 0, 0.93);

      const bellyPlane = sideView
        ? [[-38 * side, -10], [-16 * side, -3], [13 * side, -7], [36 * side, -16], [28 * side, -5], [2 * side, 2], [-31 * side, 1]]
        : [[-23, -7], [23, -7], [15, 4], [-15, 4]];
      poly(ctx, bellyPlane, rgba(p.deep, 0.28), null, 0, 0.92);
    }

    withAlpha(ctx, 0.42, () => {
      const centerPlane = sideView
        ? [[-26 * side, -14], [-9 * side, -23], [13 * side, -23], [27 * side, -14], [16 * side, -4], [-13 * side, -4]]
        : [[-16, -15], [-6, -23], [7, -23], [18, -15], [8, -5], [-8, -5]];
      poly(ctx, centerPlane, rgba(p.deep, 0.56), null, 0, 1);
      strokePath(ctx, [[-31 * side, -31], [-10 * side, -40], [12 * side, -38], [31 * side, -31]], p.light, 2.0, null, 1);
      strokePath(ctx, [[-29 * side, -17], [-7 * side, -11], [19 * side, -16], [31 * side, -22]], p.deep, 2.0, null, 0.86);
      strokePath(ctx, [[14 * side, -39], [22 * side, -27], [19 * side, -13]], rgba(p.deep, 0.9), 1.6, null, 0.82);
    });

    drawHighPolyBoarBodyDetail(ctx, prof, p, pose, variant, { sideView, frontLike, backLike, bodyW, bodyH, shoulderW, shoulderH, namedBulk });
    drawBristles(ctx, prof, p, pose, variant);
    drawHighPolyBoarFurAndSurfacePass(ctx, prof, p, pose, variant);

    // Mud/bark marks are body-local, deterministic, and cheap. They give the hide
    // broken planes without turning the model into noisy fur.
    withAlpha(ctx, 0.52, () => {
      ellipse(ctx, -18 * side, -23, 7, 3.2, -0.3 * side, p.mud, null, 0, 1);
      ellipse(ctx, 3 * side, -15, 5.5, 2.6, 0.2 * side, p.mud, null, 0, 0.85);
      ellipse(ctx, 28 * side, -26, 4.8, 2.3, -0.1 * side, p.mud, null, 0, 0.76);
    });

    if (variant.isNamed) {
      poly(ctx, [[5 * side, -49], [18 * side, -55], [31 * side, -43], [21 * side, -36], [6 * side, -40]], p.bark || p.mud, p.outline, 1.3, 0.94);
      poly(ctx, [[-25 * side, -41], [-11 * side, -49], [3 * side, -38], [-10 * side, -32]], p.moss, p.outline, 1.1, 0.90);
      strokePath(ctx, [[-36 * side, -18], [-17 * side, -9], [2 * side, -15]], p.scar, 2.2, p.outline, 0.82);
    } else if (variant.isElite) {
      strokePath(ctx, [[-31 * side, -39], [-9 * side, -45], [22 * side, -39]], p.hi, 2.0, p.outline, 0.64);
      poly(ctx, [[21 * side, -46], [32 * side, -50], [40 * side, -39], [28 * side, -34]], p.mud, p.outline, 1.0, 0.78);
    }
  }

  function drawHead(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    const sideView = prof.view === 'side' || prof.view === 'diag';
    const front = prof.view === 'front';
    const back = prof.view === 'back';
    const lunge = pose.lunge * (front ? 0 : side);
    const hx = prof.headX + lunge;
    const hy = prof.headY + pose.headBob * 0.22 + pose.headDrop;
    const headW = variant.isNamed ? 34 : variant.isElite ? 31 : 28;
    const headH = variant.isNamed ? 22 : variant.isElite ? 20.5 : 18.5;

    if (back) {
      const skullBack = [[hx - 17, hy + 2], [hx - 14, hy - 10], [hx - 6, hy - 17], [hx + 6, hy - 17], [hx + 15, hy - 10], [hx + 18, hy + 2], [hx + 11, hy + 10], [hx - 10, hy + 10]];
      poly(ctx, skullBack, p.dark, p.outline, 2.1, 0.80);
      poly(ctx, [[hx - 10, hy - 7], [hx - 16, hy - 19 - pose.ear], [hx - 7, hy - 14]], p.dark, p.outline, 1.2, 0.92);
      poly(ctx, [[hx + 10, hy - 7], [hx + 16, hy - 18 - pose.ear], [hx + 7, hy - 14]], p.dark, p.outline, 1.2, 0.92);
      withAlpha(ctx, 0.30, () => strokePath(ctx, [[hx - 15, hy + 4], [hx, hy + 10], [hx + 15, hy + 4]], p.deep, 1.6, null, 1));
      return;
    }

    const neckX = sideView ? (hx - 18 * side) : hx;
    strokePath(ctx, [[neckX - 9 * side, hy + 15], [hx - 6 * side, hy + 8], [hx + 9 * side, hy + 14]], p.dark, variant.isElite ? 14 : 12, p.outline, 1);

    if (sideView) {
      // V0.13.94: reshape the live boar side head into a more readable boar skull profile.
      // The previous head was too blocky and abrupt at the snout/forehead transition.
      const skull = [[hx - 24 * side, hy + 4], [hx - 25 * side, hy - 6], [hx - 20 * side, hy - 16], [hx - 11 * side, hy - 22], [hx + 1 * side, hy - 24], [hx + 13 * side, hy - 21], [hx + 22 * side, hy - 14], [hx + 27 * side, hy - 5], [hx + 26 * side, hy + 3], [hx + 18 * side, hy + 9], [hx + 2 * side, hy + 11], [hx - 15 * side, hy + 10]];
      const jaw = [[hx - 11 * side, hy + 7], [hx - 1 * side, hy + 13], [hx + 13 * side, hy + 14], [hx + 22 * side, hy + 11], [hx + 17 * side, hy + 17], [hx + 3 * side, hy + 19], [hx - 9 * side, hy + 15], [hx - 14 * side, hy + 10]];
      const snout = [[hx + 14 * side, hy - 3], [hx + 24 * side, hy - 7], [hx + 35 * side, hy - 6], [hx + 42 * side, hy - 2], [hx + 45 * side, hy + 3], [hx + 43 * side, hy + 9], [hx + 35 * side, hy + 13], [hx + 22 * side, hy + 12], [hx + 14 * side, hy + 7], [hx + 11 * side, hy + 1]];
      const nose = [[hx + 34 * side, hy + 0], [hx + 40 * side, hy + 1], [hx + 43 * side, hy + 5], [hx + 40 * side, hy + 9], [hx + 34 * side, hy + 8], [hx + 31 * side, hy + 4]];
      poly(ctx, skull, p.dark, p.outline, 2.2, 1);
      poly(ctx, jaw, p.deep, p.outline, 1.4, 0.98);
      poly(ctx, snout, p.snout, p.outline, 2.0, 1);
      poly(ctx, nose, p.nose, p.outline, 1.3, 1);
      poly(ctx, [[hx - 7 * side, hy - 3], [hx + 5 * side, hy + 6], [hx + 17 * side, hy + 6], [hx + 10 * side, hy + 14], [hx - 8 * side, hy + 11]], rgba(p.light, 0.22), null, 0, 0.86);
    } else {
      const skull = [[hx - 19, hy + 4], [hx - 16, hy - 10], [hx - 9, hy - 18], [hx, hy - 21], [hx + 10, hy - 18], [hx + 17, hy - 10], [hx + 19, hy + 4], [hx + 14, hy + 11], [hx, hy + 14], [hx - 14, hy + 11]];
      const jaw = [[hx - 18, hy + 2], [hx - 11, hy + 13], [hx, hy + 17], [hx + 11, hy + 13], [hx + 18, hy + 2], [hx + 11, hy + 17], [hx - 11, hy + 17]];
      const snout = [[hx - 12, hy - 1], [hx - 7, hy + 6], [hx, hy + 9], [hx + 8, hy + 6], [hx + 12, hy - 1], [hx + 8, hy - 7], [hx, hy - 9], [hx - 8, hy - 7]];
      const nose = [[hx - 6, hy + 1], [hx - 3, hy + 5], [hx + 3, hy + 5], [hx + 6, hy + 1], [hx + 3, hy - 2], [hx - 3, hy - 2]];
      poly(ctx, skull, p.dark, p.outline, 2.2, 1);
      poly(ctx, jaw, p.deep, p.outline, 1.4, 0.98);
      poly(ctx, snout, p.snout, p.outline, 2.0, 1);
      poly(ctx, nose, p.nose, p.outline, 1.3, 1);
      poly(ctx, [[hx - 17, hy - 1], [hx - 7, hy + 10], [hx, hy + 14], [hx + 7, hy + 10], [hx + 17, hy - 1], [hx + 10, hy + 16], [hx - 10, hy + 16]], rgba(p.light, 0.22), null, 0, 0.86);
    }
    drawHighPolyBoarHeadDetail(ctx, hx, hy, side, p, pose, variant, sideView, front);

    const earSpread = sideView ? 8 : 14;
    poly(ctx, [[hx - earSpread * side, hy - 13], [hx - (earSpread + 5) * side, hy - 25 - pose.ear], [hx - (earSpread - 5) * side, hy - 17]], p.dark, p.outline, 1.2, 1);
    poly(ctx, [[hx + earSpread * side, hy - 12], [hx + (earSpread + 6) * side, hy - 23 - pose.ear], [hx + (earSpread - 4) * side, hy - 16]], p.body, p.outline, 1.2, sideView ? 0.76 : 1);
    withAlpha(ctx, 0.35, () => {
      poly(ctx, [[hx - earSpread * side, hy - 15], [hx - (earSpread + 3) * side, hy - 21], [hx - (earSpread - 4) * side, hy - 17]], p.scar, null, 0, 1);
      if (!sideView) poly(ctx, [[hx + earSpread, hy - 14], [hx + earSpread + 3, hy - 20], [hx + earSpread - 4, hy - 17]], p.scar, null, 0, 0.8);
    });

    const eyeX = hx + (sideView ? 4.0 * side : -6.5);
    circle(ctx, eyeX, hy - 6.5, variant.isNamed ? 2.7 : 2.25, p.eye, p.outline, 0.7, 1);
    if (!sideView) circle(ctx, hx + 6.5, hy - 6.5, variant.isNamed ? 2.7 : 2.25, p.eye, p.outline, 0.7, 1);

    drawTusks(ctx, hx, hy, side, p, pose, variant, sideView);
    drawHighPolyBoarTuskDetail(ctx, hx, hy, side, p, pose, variant, sideView);
    withAlpha(ctx, 0.42, () => {
      strokePath(ctx, [[hx - 13 * side, hy + 10], [hx + 7 * side, hy + 13], [hx + 23 * side, hy + 6]], p.light, 1.5, null, 1);
      strokePath(ctx, [[hx + (sideView ? 14 * side : -8), hy + 7], [hx + (sideView ? 25 * side : 8), hy + 7]], p.deep, 1.2, null, 0.85);
      circle(ctx, hx + (sideView ? 37 * side : -4), hy + 3.5, 1.0, p.hi, null, 0, 0.75);
      if (!sideView) circle(ctx, hx + 4, hy + 3, 1.0, p.hi, null, 0, 0.75);
    });

    if (variant.isNamed) {
      strokePath(ctx, [[hx - 9 * side, hy - 10], [hx + 2 * side, hy - 1], [hx + 14 * side, hy - 7]], p.scar, 2.3, p.outline, 0.84);
    }
  }

  function drawTusks(ctx, hx, hy, side, p, pose, variant, sideView) {
    const tuskLen = variant.isNamed ? 31 : variant.isElite ? 25 : 20;
    const attack = pose.attack * 3;
    if (sideView) {
      const baseA = hx + (17 + attack) * side;
      const baseB = hx + (24 + attack) * side;
      poly(ctx, [[baseA, hy + 4], [hx + (20 + tuskLen) * side, hy - 9], [baseB, hy + 10]], p.tusk, p.outline, 1.35, 1);
      poly(ctx, [[hx + (13 + attack) * side, hy + 8], [hx + (13 + tuskLen * 0.84) * side, hy + 21], [hx + (20 + attack) * side, hy + 10]], p.tusk, p.outline, 1.25, 0.97);
      if (variant.isNamed) {
        poly(ctx, [[hx + (15 + attack) * side, hy + 5], [hx + (19 + tuskLen * 1.20) * side, hy - 12], [hx + (24 + attack) * side, hy + 8]], p.tusk, p.outline, 1.45, 1);
      }
      withAlpha(ctx, 0.50, () => {
        strokePath(ctx, [[hx + 20 * side, hy + 2], [hx + (21 + tuskLen * 0.62) * side, hy - 6]], p.hi, 1.0, null, 1);
        strokePath(ctx, [[hx + 15 * side, hy + 10], [hx + (14 + tuskLen * 0.48) * side, hy + 17]], p.hi, 0.9, null, 0.85);
      });
    } else {
      poly(ctx, [[hx - 10, hy + 8], [hx - 23, hy + 15], [hx - 12, hy + 1]], p.tusk, p.outline, 1.25, 1);
      poly(ctx, [[hx + 10, hy + 8], [hx + 23, hy + 15], [hx + 12, hy + 1]], p.tusk, p.outline, 1.25, 1);
      if (variant.isNamed) {
        poly(ctx, [[hx - 11, hy + 7], [hx - 29, hy + 10], [hx - 13, hy - 1]], p.tusk, p.outline, 1.35, 1);
        poly(ctx, [[hx + 9, hy + 8], [hx + 31, hy + 18], [hx + 12, hy + 1]], p.tusk, p.outline, 1.35, 1);
      }
      withAlpha(ctx, 0.48, () => {
        strokePath(ctx, [[hx - 10, hy + 5], [hx - 18, hy + 10]], p.hi, 0.95, null, 1);
        strokePath(ctx, [[hx + 10, hy + 5], [hx + 18, hy + 10]], p.hi, 0.95, null, 1);
      });
    }
  }

  function drawTail(ctx, prof, p, pose, variant) {
    const side = prof.side || 1;
    if (prof.view === 'front') return;
    const baseX = (prof.view === 'back' ? 18 : -43 * side);
    const baseY = -24 + Math.sin(pose.t * 1.2) * 0.4;
    strokePath(ctx, [[baseX, baseY], [baseX - 7 * side, baseY - 7], [baseX - 2 * side, baseY - 11]], p.dark, variant.isElite ? 5.4 : 4.4, p.outline, prof.view === 'back' ? 0.8 : 1);
  }

  function drawCorpseBristles(ctx, side, p, variant) {
    const count = variant.isNamed ? 10 : variant.isElite ? 9 : 7;
    const startX = -42 * side;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const x = startX + (84 * t) * side;
      const baseY = -8 - Math.sin(t * Math.PI) * 5.2;
      const h = (variant.isNamed ? 11 : variant.isElite ? 9 : 7) + Math.sin(t * Math.PI) * 3;
      poly(ctx, [[x - 4 * side, baseY + 3], [x + 1 * side, baseY - h], [x + 6 * side, baseY + 3]], p.bristle, p.outline, 0.85, 0.94);
    }
  }

  function drawCorpseLegs(ctx, side, p, variant) {
    const w = variant.isNamed ? 7.0 : variant.isElite ? 6.6 : 6.0;
    strokePath(ctx, [[-28 * side, 7], [-43 * side, 17], [-35 * side, 20]], p.deep, w, p.outline, 0.88);
    strokePath(ctx, [[-8 * side, 8], [-17 * side, 18], [-8 * side, 20]], p.dark, w * 0.92, p.outline, 0.82);
    strokePath(ctx, [[16 * side, 7], [29 * side, 17], [39 * side, 18]], p.deep, w, p.outline, 0.86);
    strokePath(ctx, [[33 * side, 5], [43 * side, 14], [52 * side, 15]], p.dark, w * 0.88, p.outline, 0.76);
    drawHoof(ctx, -36 * side, 20, p, 0.82);
    drawHoof(ctx, -8 * side, 21, p, 0.74);
    drawHoof(ctx, 39 * side, 19, p, 0.78);
    drawHoof(ctx, 52 * side, 16, p, 0.68);
  }

  function drawDeath(ctx, prof, p, pose, variant) {
    const side = (prof.side || 1);
    drawShadow(ctx, p, variant);

    // Death is an explicit corpse model, not a live body with idle/walk transforms.
    // This prevents detached bristles, floating legs, and mixed live/dead layering.
    withAlpha(ctx, 0.32, () => {
      ellipse(ctx, -3 * side, 18, variant.isNamed ? 58 : 50, variant.isNamed ? 10 : 8.5, -0.04 * side, p.shadow, null, 0, 1);
      ellipse(ctx, 18 * side, 17, variant.isNamed ? 28 : 24, variant.isNamed ? 6 : 5, -0.08 * side, p.mud, null, 0, 1);
    });

    drawCorpseLegs(ctx, side, p, variant);
    ellipse(ctx, -11 * side, 2, variant.isNamed ? 58 : 50, variant.isNamed ? 20 : 17.5, -0.08 * side, p.dark, p.outline, 2.4, 1);
    ellipse(ctx, 18 * side, -1, variant.isNamed ? 36 : 31, variant.isNamed ? 20 : 17, -0.12 * side, p.body, p.outline, 2.2, 0.98);
    ellipse(ctx, 33 * side, 2, variant.isNamed ? 29 : 25, variant.isNamed ? 15 : 13, -0.16 * side, p.dark, p.outline, 2.0, 1);
    ellipse(ctx, 51 * side, 5, variant.isNamed ? 17 : 14, 8.2, -0.14 * side, p.snout, p.outline, 1.5, 1);
    ellipse(ctx, 63 * side, 6, variant.isNamed ? 7.5 : 6.3, 4.2, -0.12 * side, p.nose, p.outline, 1.0, 1);

    drawCorpseBristles(ctx, side, p, variant);
    drawTusks(ctx, 34 * side, 2, side, p, Object.freeze({ attack: 0 }), variant, true);

    withAlpha(ctx, 0.50, () => {
      strokePath(ctx, [[-39 * side, -2], [-16 * side, 8], [7 * side, 4]], p.light, 1.8, null, 0.9);
      strokePath(ctx, [[11 * side, 10], [33 * side, 12], [51 * side, 6]], p.deep, 1.7, null, 0.9);
      if (variant.isNamed) {
        strokePath(ctx, [[14 * side, -10], [30 * side, -4], [45 * side, 1]], p.scar, 2.0, p.outline, 0.76);
        poly(ctx, [[-18 * side, -13], [-4 * side, -19], [10 * side, -9], [-4 * side, -5]], p.moss, p.outline, 1.0, 0.78);
      }
    });
  }

  function drawLocal(ctx, actor, nowMs = performance.now()) {
    const visualKey = resolveBoarVisualKey(actor);
    const variant = resolveVariant(actor, visualKey);
    const p = resolvePalette(actor, variant);
    const pose = buildPose(actor, nowMs);
    const facingName = resolveFacingName(actor);
    const prof = DIRECTION_PROFILES[facingName] || DIRECTION_PROFILES.south;
    const scale = clamp(num(actor?.visualScale || actor?.modelScale, 1), 0.55, 2.4) * (variant.isNamed ? 1.08 : variant.isElite ? 1.04 : 1);

    ctx.save();
    ctx.scale(scale, scale);
    if (pose.hit) ctx.translate(-(prof.side || 1) * pose.hitAmt * 5.5, -pose.hitAmt * 2.0);
    if (pose.action === 'charge') ctx.translate((prof.side || 1) * 2.5, 1.0);
    if (pose.dead) {
      drawDeath(ctx, prof, p, pose, variant);
      ctx.restore();
      return true;
    }

    drawShadow(ctx, p, variant);
    drawElitePresence(ctx, p, pose, variant);
    ctx.translate(0, pose.bob);
    drawTail(ctx, prof, p, pose, variant);
    drawLegs(ctx, prof, p, pose, variant);
    drawBody(ctx, prof, p, pose, variant);
    drawHead(ctx, prof, p, pose, variant);
    if (pose.action === 'charge') {
      withAlpha(ctx, 0.44, () => {
        strokePath(ctx, [[-38 * prof.side, 10], [-53 * prof.side, 14]], p.mud, 3.5, null, 1);
        strokePath(ctx, [[-25 * prof.side, 15], [-39 * prof.side, 20]], p.mud, 3.2, null, 0.8);
      });
    }
    ctx.restore();
    return true;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!ctx || !actor || !canDraw(actor)) return false;
    const x = num(actor.screenX, 0);
    const y = num(actor.screenY, 0);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const ok = drawLocal(ctx, actor, nowMs);
    ctx.restore();
    actor._boarVisualKey = resolveBoarVisualKey(actor);
    actor._boarAction = buildPose(actor, nowMs).action;
    actor._boarDedicatedRenderer = true;
    actor._boarRendererDetailPass = 'boar-high-detail-v0.13.94-head-profile-refine';
    actor._nameplateAnchor = {
      x,
      y: y - anchorHeight(actor)
    };
    return ok;
  }

  function anchorHeight(actor) {
    const visualKey = resolveBoarVisualKey(actor);
    const variant = resolveVariant(actor, visualKey);
    const scale = clamp(num(actor?.visualScale || actor?.modelScale, 1), 0.55, 2.4) * (variant.isNamed ? 1.08 : variant.isElite ? 1.04 : 1);
    if (actor?.alive === false || actor?.dead === true) return 52 * scale;
    return (variant.isNamed ? 96 : variant.isElite ? 90 : 84) * scale;
  }

  DR.render.BoarProceduralModel = Object.freeze({
    canDraw,
    draw,
    drawLocal,
    anchorHeight,
    resolveBoarVisualKey,
    supportedActions: () => ACTIONS.slice(),
    supportedDirections: () => DIRECTIONS.slice()
  });
  window.BoarProceduralModel = DR.render.BoarProceduralModel;
})();
