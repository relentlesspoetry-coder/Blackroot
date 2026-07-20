(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const Base = DR.render.HumanoidBaseRenderer;
  const Anim = DR.render.HumanoidAnimationSystem;
  const TAU = Math.PI * 2;

  const COLORS = {
    outline: '#151018',
    shadow: 'rgba(0,0,0,0.36)',
    skin: '#e1aa80',
    skinShadow: '#ad7150',
    hair: '#342117',
    hairHi: '#70462b',
    cloth: '#4a2d65',
    clothDark: '#21162e',
    clothHi: '#7f57a6',
    accent: '#e2b64d',
    accentDark: '#7d5b21',
    bardRed: '#8b3147',
    bardRedHi: '#d05d72',
    boot: '#241912',
    bootHi: '#5c3b26',
    belt: '#5b3824',
    luteWood: '#8f5a2f',
    luteWoodDark: '#4f2e18',
    luteHi: '#bd7a3d',
    string: '#f0dca8',
    glow: '#ffe58b',
    trim: '#fff1a7',
    shirt: '#efe0c8',
    shirtShadow: '#b89573',
    vest: '#29415a',
    vestDark: '#162437',
    leather: '#6b442a',
    metal: '#b9aa85',
    parchment: '#d7bd87',
    ink: '#2b1b16',
    featherBlue: '#4fa7b6',
    bead: '#6cc0d1',
    ribbon: '#3b76a6'
  };

  function rgba(hex, alpha) {
    if (String(hex || '').startsWith('rgba')) return hex;
    const m = String(hex || '').replace('#', '');
    if (m.length !== 6) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, Number(alpha) || 0))})`;
  }

  function withAlpha(ctx, alpha, fn) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    try { fn(); } finally { ctx.restore(); }
  }

  function applyBardAnimationIdentity(pose) {
    const p = { ...pose };
    const pulse = Math.sin((p.t || 0) * 3.4 + (p.seed || 0));
    p.torsoBob += pulse * 0.26;
    p.headBob += pulse * 0.18;
    if (p.action === 'cast') {
      p.armSwing *= 0.62;
      p.capeSway *= 1.18;
      p.instrumentStrum = 1;
    } else if (p.action === 'attack') {
      p.armSwing *= 1.18;
      p.instrumentStrum = 0.65;
    } else {
      p.instrumentStrum = 0.22;
    }
    return p;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!Base || !Anim) return false;

    const pose = applyBardAnimationIdentity(Anim.buildPose(actor, nowMs));
    const hooks = buildBardHooks(actor, pose);
    const rig = Base.draw(ctx, actor, {
      pose,
      palette: bardPalette(actor),
      hooks,
      debugFacing: !!actor.debugFacing
    }, nowMs);

    const source = actor.sourceEntity || actor;
    if (source) {
      source._humanoidFacingName = pose.direction.name;
      source._nameplateAnchor = {
        x: Math.round(actor.screenX ?? actor.x ?? 0) + (rig?.anchors?.head?.x || 0),
        y: Math.round(actor.screenY ?? actor.y ?? 0) + (rig?.anchors?.head?.top || -90) - 7
      };
    }
    return true;
  }

  function bardPalette(actor = {}) {
    return {
      outline: COLORS.outline,
      shadow: COLORS.shadow,
      skin: actor.skinTone || COLORS.skin,
      skinShadow: COLORS.skinShadow,
      hair: actor.hairColor || COLORS.hair,
      hairHi: actor.hairHighlight || COLORS.hairHi,
      cloth: actor.clothesPrimary || COLORS.cloth,
      clothDark: COLORS.clothDark,
      clothHi: actor.clothesSecondary || COLORS.clothHi,
      accent: COLORS.accent,
      accentDark: COLORS.accentDark,
      belt: COLORS.belt,
      boot: COLORS.boot,
      bootHi: COLORS.bootHi,
      glow: COLORS.glow
    };
  }

  function hasEquippedInstrument(actor) {
    return !!DR.render?.PaperdollEquipmentRenderer?.hasEquippedWeapon?.(actor);
  }

  function buildBardHooks(actor, pose) {
    const hideDefaultLute = hasEquippedInstrument(actor);
    return {
      back(ctx, rig, palette) {
        drawBackHair(ctx, rig, palette);
        if (!hideDefaultLute && !['fishing','swim'].includes(pose.action) && instrumentLayer(rig) === 'back') drawInstrument(ctx, rig, palette, 'back');
      },
      backCape(ctx, rig, palette) {
        // Facing-dependent cape depth (behind the body for front/side, draped over
        // the back gear when facing away) is handled centrally by the humanoid
        // base renderer for every class, so this just draws the cape.
        drawCape(ctx, rig, palette);
      },
      torsoOverlay(ctx, rig, palette) {
        drawLayeredTunicAndVest(ctx, rig, palette);
        drawLongCoat(ctx, rig, palette);
        drawGarmentSurfaceDetail(ctx, rig, palette);
      },
      chest(ctx, rig, palette) {
        drawShoulderMantle(ctx, rig, palette);
        drawTravelBrooch(ctx, rig, palette);
        drawSash(ctx, rig, palette);
        drawBelt(ctx, rig, palette);
        drawBeltGear(ctx, rig, palette);
        drawBardTrim(ctx, rig, palette);
      },
      hair(ctx, rig, palette) {
        if (Base.drawDefaultHair) Base.drawDefaultHair(ctx, rig, palette);
        else drawHair(ctx, rig, palette);
        drawBardHat(ctx, rig, palette);
        drawHighPolyHairAndFaceDetail(ctx, rig, palette);
        drawFeather(ctx, rig, palette);
      },
      mid(ctx, rig, palette) {
        if (pose.action === 'cast') drawCastHandGlow(ctx, rig, palette, false);
      },
      front(ctx, rig, palette) {
        drawBootAndTrouserDetail(ctx, rig, palette);
        drawPerformerHandAccessories(ctx, rig, palette);
        if (pose.action === 'fishing') {
          drawFishingRod(ctx, rig, palette);
          return;
        }
        if (!hideDefaultLute && pose.action !== 'swim' && instrumentLayer(rig) === 'front') drawInstrument(ctx, rig, palette, 'front');
        if (pose.action === 'cast') drawCastHandGlow(ctx, rig, palette, true);
      },
      effects(ctx, rig, palette) {
        if (pose.action === 'cast') drawMusicNotes(ctx, rig, palette);
        if (pose.action === 'attack') drawSongPulse(ctx, rig, palette);
        if (pose.action === 'meditate') drawMeditationEffects(ctx, rig, palette);
        if (pose.action === 'death') drawDeathDust(ctx, rig, palette);
      }
    };
  }

  function instrumentLayer(rig) {
    if (rig.pose.action === 'cast' || rig.pose.action === 'attack') return 'front';
    return rig.dir.backVisible ? 'back' : 'front';
  }

  function poly(ctx, pts, fill, stroke = COLORS.outline, width = 2) {
    Base.poly(ctx, pts, fill, stroke, width);
  }


  function drawLayeredTunicAndVest(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    if (d.backVisible) return;
    const skew = d.torsoSkew * 0.18;
    const sx = d.torsoScaleX || 1;
    const chestY = a.chest.y - 10;
    const shirtGrad = ctx.createLinearGradient(-18, chestY - 8, 18, a.pelvis.y + 20);
    shirtGrad.addColorStop(0, COLORS.shirt);
    shirtGrad.addColorStop(1, COLORS.shirtShadow);
    poly(ctx, [
      { x: a.chest.x - 13 * sx + skew, y: chestY },
      { x: a.chest.x + 13 * sx + skew, y: chestY },
      { x: a.pelvis.x + 10 * sx, y: a.pelvis.y + 19 },
      { x: a.pelvis.x - 10 * sx, y: a.pelvis.y + 19 }
    ], shirtGrad, rgba(palette.outline, 0.72), 1.0);

    const vestGrad = ctx.createLinearGradient(-17, chestY - 5, 17, a.pelvis.y + 24);
    vestGrad.addColorStop(0, COLORS.vest);
    vestGrad.addColorStop(1, COLORS.vestDark);
    poly(ctx, [
      { x: a.chest.x - 17 * sx + skew, y: chestY - 2 },
      { x: a.chest.x - 3 * sx + skew, y: chestY + 5 },
      { x: a.pelvis.x - 2 * sx, y: a.pelvis.y + 23 },
      { x: a.pelvis.x - 16 * sx, y: a.pelvis.y + 18 }
    ], vestGrad, palette.outline, 1.2);
    poly(ctx, [
      { x: a.chest.x + 17 * sx + skew, y: chestY - 2 },
      { x: a.chest.x + 4 * sx + skew, y: chestY + 5 },
      { x: a.pelvis.x + 3 * sx, y: a.pelvis.y + 23 },
      { x: a.pelvis.x + 16 * sx, y: a.pelvis.y + 18 }
    ], vestGrad, palette.outline, 1.2);

    ctx.save();
    ctx.strokeStyle = rgba(COLORS.trim, 0.72);
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const y = chestY + 3 + i * 5;
      Base.line(ctx, a.chest.x - 13 * sx + skew, y, a.chest.x - 6 * sx + skew * 0.5, y + 1.5, rgba(COLORS.trim, 0.70), 0.75, 1);
      Base.line(ctx, a.chest.x + 13 * sx + skew, y, a.chest.x + 6 * sx + skew * 0.5, y + 1.5, rgba(COLORS.trim, 0.70), 0.75, 1);
    }
    ctx.fillStyle = COLORS.metal;
    for (const by of [chestY + 7, chestY + 13, chestY + 19]) {
      ctx.beginPath(); ctx.arc(a.chest.x + skew * 0.3, by, 1.35, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawGarmentSurfaceDetail(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const sx = d.torsoScaleX || 1;
    const skew = d.torsoSkew * 0.15;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      const y = a.chest.y - 2 + i * 7;
      const off = (i % 2 ? 2 : -2) * sx;
      Base.line(ctx, a.chest.x - 15 * sx + skew, y, a.chest.x + 15 * sx + skew + off, y + 2.4, rgba('#f4e4ba', 0.16), 0.55, 1);
    }
    Base.line(ctx, a.chest.x - 11 * sx + skew, a.pelvis.y + 30, a.pelvis.x - 3 * sx, a.pelvis.y + 40, rgba(COLORS.trim, 0.45), 0.9, 1);
    Base.line(ctx, a.chest.x + 12 * sx + skew, a.pelvis.y + 27, a.pelvis.x + 11 * sx, a.pelvis.y + 37, rgba(COLORS.trim, 0.35), 0.75, 1);
    ctx.strokeStyle = rgba(COLORS.shirt, 0.40);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(a.chest.x - 8 * sx + skew, a.chest.y - 11);
    ctx.quadraticCurveTo(a.chest.x - 2 * sx, a.chest.y - 2, a.chest.x - 6 * sx, a.chest.y + 8);
    ctx.moveTo(a.chest.x + 8 * sx + skew, a.chest.y - 11);
    ctx.quadraticCurveTo(a.chest.x + 2 * sx, a.chest.y - 2, a.chest.x + 6 * sx, a.chest.y + 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawTravelBrooch(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const side = d.capeSide || d.side || 1;
    const x = a.chest.x - side * 14;
    const y = a.chest.y - 14;
    ctx.save();
    ctx.fillStyle = COLORS.metal;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(x, y, 4.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = COLORS.accentDark;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y + 1.8);
    ctx.lineTo(x - 1.5, y - 2.4);
    ctx.quadraticCurveTo(x + 3.2, y - 2.0, x + 1.5, y + 1.3);
    ctx.stroke();
    ctx.restore();
  }

  function drawBeltGear(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const side = d.side || 1;
    const y = a.belt.y;
    const sx = d.torsoScaleX || 1;
    const left = a.belt.x - side * 23 * sx;
    const right = a.belt.x + side * 24 * sx;
    Base.roundRect(ctx, left - 5, y + 3, 10, 11, 3, COLORS.leather, palette.outline, 1.0);
    Base.line(ctx, left - 3, y + 6, left + 3, y + 6, COLORS.metal, 0.9, 0.85);
    Base.roundRect(ctx, right - 4, y + 4, 8, 13, 3, '#4d2d1c', palette.outline, 1.0);
    Base.line(ctx, right, y + 4, right + side * 2, y + 16, COLORS.parchment, 1.2, 0.88);
    Base.line(ctx, a.belt.x + side * 10, y + 4, a.belt.x + side * 17, y + 20, '#2b1c14', 3.0, 1);
    Base.line(ctx, a.belt.x + side * 10, y + 4, a.belt.x + side * 17, y + 20, '#8d7142', 1.1, 0.9);
    withAlpha(ctx, 0.86, () => {
      ctx.fillStyle = COLORS.ribbon;
      ctx.beginPath();
      ctx.moveTo(a.belt.x - side * 6, y + 5);
      ctx.lineTo(a.belt.x - side * 12, y + 20);
      ctx.lineTo(a.belt.x - side * 5, y + 17);
      ctx.fill();
    });
  }

  function drawBardHat(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const side = d.side || 1;
    const brimY = h.y - 14;
    const brimW = h.rx + (d.view === 'side' ? 9 : 17);
    const brimH = d.backVisible ? 4.5 : 5.5;
    const crownGrad = ctx.createLinearGradient(h.x - 16, brimY - 16, h.x + 15, brimY + 5);
    crownGrad.addColorStop(0, '#6b442a');
    crownGrad.addColorStop(0.55, '#3d2519');
    crownGrad.addColorStop(1, '#1d130e');
    Base.ellipse(ctx, h.x + side * 1.5, brimY, brimW, brimH, side * 0.08, '#3b2419', palette.outline, 1.5);
    poly(ctx, [
      { x: h.x - h.rx * 0.70, y: brimY - 2 },
      { x: h.x - h.rx * 0.42, y: brimY - 14 },
      { x: h.x + h.rx * 0.50, y: brimY - 15 },
      { x: h.x + h.rx * 0.82, y: brimY - 2 },
      { x: h.x + h.rx * 0.50, y: brimY + 2 },
      { x: h.x - h.rx * 0.55, y: brimY + 1 }
    ], crownGrad, palette.outline, 1.4);
    Base.line(ctx, h.x - h.rx * 0.60, brimY - 3, h.x + h.rx * 0.75, brimY - 2, COLORS.accentDark, 2.0, 0.95);
    ctx.fillStyle = COLORS.metal;
    ctx.fillRect(h.x + side * 3, brimY - 4, 3, 3);
  }

  function drawHighPolyHairAndFaceDetail(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const side = d.side || 1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (!d.backVisible) {
      // Smile lines, crow's feet, cheek line, and late-night under-eye crease.
      Base.line(ctx, h.x - 5 * side, h.y + 4, h.x + 4 * side, h.y + 6, rgba('#6e3f32', 0.70), 0.85, 1);
      Base.line(ctx, h.x + 7 * side, h.y - 1, h.x + 11 * side, h.y - 3, rgba('#5d3426', 0.45), 0.7, 1);
      Base.line(ctx, h.x + 6 * side, h.y + 2, h.x + 10 * side, h.y + 4, rgba('#5d3426', 0.35), 0.65, 1);
      Base.line(ctx, h.x - 3 * side, h.y + 1, h.x + 1 * side, h.y + 3, rgba('#8a5d49', 0.42), 0.8, 1);
      // Earring / charm on near ear.
      ctx.strokeStyle = COLORS.metal;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(h.x - side * (h.rx + 2), h.y + 1, 1.7, 0, TAU); ctx.stroke();
      ctx.fillStyle = COLORS.bead; ctx.beginPath(); ctx.arc(h.x - side * (h.rx + 2), h.y + 4.2, 1.0, 0, TAU); ctx.fill();
    }
    // Loose curls, braid beads, and flyaway silhouette strands.
    for (let i = 0; i < 5; i++) {
      const x = h.x - side * (h.rx + 2 + i * 1.2);
      const y = h.y - 5 + i * 4;
      ctx.strokeStyle = i % 2 ? COLORS.hairHi : COLORS.hair;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - side * 4, y + 4, x - side * 1.5, y + 8);
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath(); ctx.arc(h.x - side * (h.rx + 5), h.y + 7, 1.25, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawPerformerHandAccessories(ctx, rig, palette) {
    const a = rig.anchors;
    const hands = [a.mainHand, a.offHand].filter(Boolean);
    ctx.save();
    for (const hand of hands) {
      Base.line(ctx, hand.x - 3, hand.y - 1, hand.x + 3, hand.y - 1, COLORS.metal, 0.8, 0.78);
      Base.line(ctx, hand.x - 4, hand.y + 3, hand.x + 4, hand.y + 3, COLORS.accentDark, 1.0, 0.72);
      withAlpha(ctx, 0.36, () => {
        ctx.fillStyle = COLORS.shirt;
        ctx.beginPath(); ctx.arc(hand.x + 1, hand.y - 3, 1.0, 0, TAU); ctx.fill();
      });
    }
    ctx.restore();
  }

  function drawBootAndTrouserDetail(ctx, rig, palette) {
    const legs = rig.anchors.legs;
    if (!legs) return;
    ctx.save();
    for (const l of [legs.far, legs.near]) {
      if (!l || !l.foot) continue;
      const alpha = l === legs.far ? 0.45 : 0.86;
      Base.line(ctx, l.knee.x, l.knee.y + 3, l.foot.x - l.sign * 1, l.foot.y - 3, rgba(COLORS.shirt, 0.26), 0.75, alpha);
      Base.line(ctx, l.foot.x - 5 * l.sign, l.foot.y - 2, l.foot.x + 4 * l.sign, l.foot.y - 1, COLORS.accentDark, 0.85, alpha);
      Base.line(ctx, l.foot.x - 4, l.foot.y + 4, l.foot.x + 5, l.foot.y + 4, rgba('#c19a67', 0.55), 0.8, alpha);
      ctx.fillStyle = rgba(COLORS.metal, alpha);
      ctx.beginPath(); ctx.arc(l.foot.x + l.sign * 3, l.foot.y - 2, 0.9, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFishingRod(ctx, rig, palette) {
    const a = rig.anchors;
    const p = rig.pose || {};
    const actor = rig.actor || {};
    const source = actor.sourceEntity || actor;
    const side = p.direction?.side || rig.dir?.nearSide || 1;
    const action = String(source.fishingAction || actor.fishingAction || 'waiting');
    const castPct = action === 'casting' ? Math.max(0, Math.min(1, 1 - Number(source.fishingCastTimer || actor.fishingCastTimer || 0) / 0.62)) : 1;
    const reel = action === 'reeling' ? Math.sin((p.t || 0) * 15) : 0;
    const main = a.mainHand || { x: 22 * side, y: -18 };
    const off = a.offHand || { x: 8 * side, y: -10 };
    const tip = { x: main.x + side * (74 + castPct * 24), y: main.y - 63 - castPct * 14 + (action === 'reeling' ? -6 + reel * 3 : Math.sin((p.t || 0) * 3.2) * 1.6) };
    const mid = { x: main.x + side * (38 + castPct * 15), y: main.y - 31 - castPct * 8 };
    const butt = { x: off.x - side * 9, y: off.y + 12 };
    // Expose the live rod-tip offset (model space, relative to the foot anchor) so
    // entity-renderer publishes the fishing-line screen anchor at the visible pole
    // tip. Without this the bard's custom rod recorded no tip, so the line detached
    // and fell back to a world-space guess (mirrors drawClassFishingRig).
    if (source && typeof source === 'object') source.fishingRodTipLocal = { x: tip.x, y: tip.y };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.luteWoodDark;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = COLORS.string;
    ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(main.x, main.y); ctx.quadraticCurveTo(mid.x, mid.y - 2, tip.x, tip.y); ctx.stroke();
    ctx.fillStyle = COLORS.luteWood; ctx.beginPath(); ctx.arc(main.x - side * 6, main.y + 5, 6 + Math.abs(reel), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawCape(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const side = d.capeSide || 0;
    const sway = p.capeSway * 0.34;
    const topW = 18 * (d.shoulderScale || 1);
    const hemW = p.action === 'meditate' ? 32 : 24;
    const g = ctx.createLinearGradient(-26, a.chest.y - 18, 26, a.pelvis.y + 36);
    g.addColorStop(0, '#8a5eb0');
    g.addColorStop(0.45, '#4a2d65');
    g.addColorStop(1, '#1c1326');
    poly(ctx, [
      { x: a.chest.x - topW - side * 5, y: a.chest.y - 12 },
      { x: a.chest.x + topW - side * 5, y: a.chest.y - 12 },
      { x: a.pelvis.x + hemW - side * 6 + sway, y: a.pelvis.y + 40 },
      { x: a.pelvis.x + 4 + side * 8, y: a.pelvis.y + 50 },
      { x: a.pelvis.x - hemW - side * 6 - sway, y: a.pelvis.y + 40 }
    ], g, palette.outline, 2);

    ctx.save();
    ctx.globalAlpha = 0.4;
    Base.line(ctx, a.chest.x - side * 2, a.chest.y - 4, a.pelvis.x - side * 4 + sway * 0.45, a.pelvis.y + 35, '#b68ad9', 1.2, 0.55);
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    Base.line(ctx, a.pelvis.x - hemW - side * 5 - sway, a.pelvis.y + 39, a.pelvis.x + hemW - side * 6 + sway, a.pelvis.y + 39, rgba(COLORS.trim, 0.52), 1.0, 1);
    for (let i = -2; i <= 2; i++) {
      const tx = a.pelvis.x + i * 9 - side * 4 + sway * 0.2;
      Base.line(ctx, tx, a.pelvis.y + 39, tx + Math.sin(i) * 1.5, a.pelvis.y + 45, rgba(COLORS.bardRedHi, 0.55), 0.75, 1);
    }
    ctx.restore();
  }

  function drawLongCoat(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const skew = d.torsoSkew * 0.18;
    const g = ctx.createLinearGradient(-20, a.chest.y - 7, 20, a.pelvis.y + 36);
    g.addColorStop(0, '#8a5bb5');
    g.addColorStop(0.48, '#4a2d65');
    g.addColorStop(1, '#24162f');
    const sway = p.clothSway * 0.35;
    poly(ctx, [
      { x: a.chest.x - 16 + skew, y: a.chest.y - 3 },
      { x: a.chest.x + 16 + skew, y: a.chest.y - 3 },
      { x: a.pelvis.x + 18 + sway, y: a.pelvis.y + 34 },
      { x: a.pelvis.x + 5, y: a.pelvis.y + 44 },
      { x: a.pelvis.x - 6, y: a.pelvis.y + 44 },
      { x: a.pelvis.x - 18 - sway, y: a.pelvis.y + 34 }
    ], g, palette.outline, 1.8);

    ctx.strokeStyle = 'rgba(255,231,154,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a.chest.x - 3 + skew, a.chest.y);
    ctx.lineTo(a.pelvis.x - 5 - sway * 0.2, a.pelvis.y + 36);
    ctx.moveTo(a.chest.x + 7 + skew, a.chest.y + 1);
    ctx.lineTo(a.pelvis.x + 9 + sway * 0.2, a.pelvis.y + 33);
    ctx.stroke();
  }

  function drawShoulderMantle(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const w = 28 * (d.shoulderScale || 1);
    const skew = d.torsoSkew * 0.22;
    const y = a.chest.y - 15;
    const g = ctx.createLinearGradient(-w, y - 5, w, y + 8);
    g.addColorStop(0, '#b7475b');
    g.addColorStop(0.52, COLORS.bardRed);
    g.addColorStop(1, '#561d2c');
    poly(ctx, [
      { x: a.chest.x - w + skew, y },
      { x: a.chest.x - 8 + skew, y: y - 5 },
      { x: a.chest.x + 9 + skew, y: y - 5 },
      { x: a.chest.x + w + skew, y },
      { x: a.chest.x + w - 6 + skew, y: y + 9 },
      { x: a.chest.x - w + 6 + skew, y: y + 9 }
    ], g, palette.outline, 2);

    ctx.fillStyle = COLORS.trim;
    ctx.globalAlpha = 0.85;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(a.chest.x + i * 9 + skew, y + 2, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSash(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const side = d.side || 1;
    const sway = rig.pose.clothSway * 0.25;
    const x1 = a.chest.x - side * 13;
    const y1 = a.chest.y - 8;
    const x2 = a.pelvis.x + side * (10 + sway);
    const y2 = a.pelvis.y + 20;
    ctx.save();
    ctx.strokeStyle = COLORS.accentDark;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.trim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x1 + side * 2, y1 + 1);
    ctx.lineTo(x2 + side * 2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBelt(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const w = 17 * (d.torsoScaleX || 1);
    const y = a.belt.y;
    Base.roundRect(ctx, a.belt.x - w, y - 3, w * 2, 7, 3, COLORS.belt, palette.outline, 1.5);
    Base.roundRect(ctx, a.belt.x - 4, y - 5, 8, 10, 2, COLORS.accent, COLORS.accentDark, 1.2);
    ctx.save();
    ctx.strokeStyle = COLORS.accentDark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a.belt.x - 2.2, y + 2.8);
    ctx.lineTo(a.belt.x - 2.2, y - 2.8);
    ctx.moveTo(a.belt.x + 2.2, y + 2.8);
    ctx.lineTo(a.belt.x + 2.2, y - 2.8);
    ctx.quadraticCurveTo(a.belt.x, y - 4.2, a.belt.x - 2.2, y - 2.8);
    ctx.quadraticCurveTo(a.belt.x, y + 4.2, a.belt.x + 2.2, y + 2.8);
    ctx.stroke();
    ctx.restore();

    const pouchX = a.belt.x + (d.side || 1) * 17;
    Base.roundRect(ctx, pouchX - 4, y + 1, 8, 9, 2, '#6b442a', palette.outline, 1);
    ctx.fillStyle = COLORS.trim;
    ctx.fillRect(pouchX - 1, y + 3, 2, 2);
    Base.line(ctx, pouchX - 3, y + 7, pouchX + 3, y + 7, rgba('#c99b65', 0.55), 0.6, 1);
  }

  function drawBardTrim(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,231,154,0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(a.chest.x - 12 * (d.torsoScaleX || 1), a.chest.y + 13);
    ctx.quadraticCurveTo(a.chest.x, a.chest.y + 17, a.chest.x + 12 * (d.torsoScaleX || 1), a.chest.y + 13);
    ctx.stroke();
    ctx.fillStyle = COLORS.trim;
    for (const off of [-9, 0, 9]) {
      ctx.beginPath();
      ctx.arc(a.chest.x + off * (d.torsoScaleX || 1), a.chest.y + 4, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function localPoint(point, rot, sx = 1) {
    const x = point.x * sx;
    const y = point.y;
    return {
      x: x * Math.cos(rot) - y * Math.sin(rot),
      y: x * Math.sin(rot) + y * Math.cos(rot)
    };
  }

  function bardInstrumentPlacement(rig, layer) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose || {};
    const side = d.side || (String(d.name || '').includes('west') ? -1 : 1) || 1;
    const nearSide = d.nearSide || side || 1;
    const sx = d.view === 'side' ? 0.78 : 1.0;
    const main = a.mainHand || { x: nearSide * 14, y: -19 };
    const off = a.offHand || { x: -nearSide * 10, y: -19 };
    const bodyGrip = { x: -1, y: 7 };
    const neckGrip = { x: 14, y: -20 };
    const localAngle = Math.atan2(neckGrip.y - bodyGrip.y, (neckGrip.x - bodyGrip.x) * sx);
    let targetBody = main;
    let targetNeck = off;

    if (p.action === 'attack') {
      targetBody = { x: main.x - nearSide * (5 + p.attackCurve * 3), y: main.y + 5 + p.attackCurve * 2 };
      targetNeck = { x: off.x + nearSide * 4, y: off.y - 3 };
    } else if (p.action === 'cast') {
      targetBody = { x: main.x - nearSide * (6 + p.castPulse * 2), y: main.y + 8 };
      targetNeck = { x: off.x + nearSide * 3, y: off.y - 3 - p.castPulse * 2 };
    } else if (p.action === 'gathering') {
      // Keep the lute out of the shoulder slot while the harvest pose owns the hands.
      // It remains attached low to the off-hand/hip side instead of floating behind the head.
      targetBody = { x: off.x + nearSide * 5, y: off.y + 7 };
      targetNeck = { x: main.x - nearSide * 4, y: main.y - 2 };
    } else if (p.action === 'meditate') {
      targetBody = { x: main.x - nearSide * 5, y: main.y + 7 + Math.sin((p.t || 0) * 2.2) * 0.4 };
      targetNeck = { x: off.x + nearSide * 4, y: off.y - 4 };
    } else {
      const walkLift = p.action === 'walk' ? Math.sin(p.walkCycle || 0) * 1.2 : 0;
      targetBody = { x: main.x - nearSide * 4, y: main.y + 6 + walkLift };
      targetNeck = { x: off.x + nearSide * 5, y: off.y - 5 + walkLift * 0.35 };
    }

    let rot = Math.atan2(targetNeck.y - targetBody.y, targetNeck.x - targetBody.x) - localAngle;
    if (!Number.isFinite(rot)) rot = -nearSide * 0.35;
    const lp = localPoint(bodyGrip, rot, sx);
    return {
      x: targetBody.x - lp.x,
      y: targetBody.y - lp.y,
      rot,
      sx,
      bodyGrip,
      neckGrip,
      main,
      off,
      layer,
      alpha: layer === 'back' ? 0.84 : 1,
      side: nearSide
    };
  }

  function drawLuteGripFingers(ctx, rig, palette, placement) {
    if (!placement || !rig?.anchors) return;
    const hands = [rig.anchors.mainHand, rig.anchors.offHand].filter(Boolean);
    ctx.save();
    for (const hand of hands) {
      const toward = hand === rig.anchors.mainHand ? placement.side : -placement.side;
      Base.line(ctx, hand.x - toward * 3, hand.y - 1, hand.x + toward * 3, hand.y - 1, rgba(palette.skinShadow || COLORS.skinShadow, 0.72), 1.4, 0.9);
      Base.line(ctx, hand.x - toward * 2, hand.y + 1.5, hand.x + toward * 3, hand.y + 2, rgba(palette.skin || COLORS.skin, 0.82), 1.1, 0.9);
    }
    ctx.restore();
  }

  function drawInstrument(ctx, rig, palette, layer) {
    const placement = bardInstrumentPlacement(rig, layer);

    ctx.save();
    ctx.globalAlpha *= placement.alpha;
    ctx.translate(placement.x, placement.y);
    ctx.rotate(placement.rot);
    ctx.scale(placement.sx, 1);

    const body = ctx.createRadialGradient(-2, -2, 2, 0, 0, 18);
    body.addColorStop(0, COLORS.luteHi);
    body.addColorStop(0.56, COLORS.luteWood);
    body.addColorStop(1, COLORS.luteWoodDark);
    Base.ellipse(ctx, 0, 1, 12.5, 16.5, 0.18, body, palette.outline, 2);
    ctx.fillStyle = '#241309';
    ctx.beginPath();
    ctx.arc(1, 1, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = COLORS.trim;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(1, 1, 6.2, 0, TAU); ctx.stroke();
    for (let r = 0; r < 8; r++) {
      const a0 = r * TAU / 8;
      Base.line(ctx, 1 + Math.cos(a0) * 4.7, 1 + Math.sin(a0) * 4.7, 1 + Math.cos(a0) * 6.1, 1 + Math.sin(a0) * 6.1, rgba(COLORS.trim, 0.55), 0.5, 1);
    }
    Base.line(ctx, -8, 12, 7, 13, rgba(COLORS.luteWoodDark, 0.72), 2.5, 0.95);
    Base.line(ctx, -8, 12, 7, 13, rgba(COLORS.luteHi, 0.65), 0.9, 0.95);

    Base.line(ctx, 8, -12, 28, -34, COLORS.luteWoodDark, 7, 1);
    Base.line(ctx, 8, -12, 28, -34, COLORS.luteWood, 4, 1);
    Base.roundRect(ctx, 24, -40, 10, 8, 2, COLORS.luteWood, palette.outline, 1.5);
    for (const peg of [[23,-39],[35,-38],[23,-34],[35,-33]]) {
      ctx.fillStyle = COLORS.metal;
      ctx.beginPath(); ctx.ellipse(peg[0], peg[1], 2.2, 1.4, 0.2, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = rgba(COLORS.accent, 0.7);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(28, -32); ctx.lineTo(32, -26); ctx.lineTo(32, -20);
    ctx.stroke();
    ctx.fillStyle = COLORS.bardRedHi;
    ctx.beginPath(); ctx.ellipse(32, -17, 2.0, 3.0, 0.1, 0, TAU); ctx.fill();

    ctx.strokeStyle = COLORS.string;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i, 11);
      ctx.lineTo(28 + i * 0.45, -34);
      ctx.stroke();
    }
    ctx.restore();

    if (layer !== 'back') drawLuteGripFingers(ctx, rig, palette, placement);
  }

  function drawHair(ctx, rig, palette) {
    if (Base.drawDefaultHair) { Base.drawDefaultHair(ctx, rig, palette); return; }
    if (rig.dir.backVisible) return;
    const h = rig.anchors.head;
    const d = rig.dir;
    const side = d.side || 1;
    const g = ctx.createLinearGradient(h.x - 15, h.y - 18, h.x + 16, h.y + 4);
    g.addColorStop(0, COLORS.hairHi);
    g.addColorStop(0.62, COLORS.hair);
    g.addColorStop(1, '#1b0f0a');
    poly(ctx, [
      { x: h.x - h.rx - 3, y: h.y - 1 },
      { x: h.x - h.rx + 1, y: h.y - 15 },
      { x: h.x - 2 * side, y: h.y - 22 },
      { x: h.x + h.rx + 4, y: h.y - 10 },
      { x: h.x + h.rx * 0.55, y: h.y + 1 },
      { x: h.x + 1 * side, y: h.y - 4 },
      { x: h.x - h.rx * 0.55, y: h.y + 5 }
    ], g, palette.outline, 1.8);

    ctx.strokeStyle = 'rgba(255,225,160,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(h.x - 6, h.y - 14);
    ctx.lineTo(h.x - 4, h.y + 4);
    ctx.moveTo(h.x + 5, h.y - 12);
    ctx.lineTo(h.x + 7, h.y + 2);
    ctx.stroke();
  }

  function drawBackHair(ctx, rig, palette) {
    if (!rig.dir.backVisible) return;
    const h = rig.anchors.head;
    Base.ellipse(ctx, h.x, h.y - 1, h.rx + 1, h.ry + 2, 0.02 * (rig.dir.side || 0), COLORS.hair, palette.outline, 2);
    ctx.strokeStyle = COLORS.hairHi;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(h.x - h.rx * 0.55, h.y - 10);
    ctx.quadraticCurveTo(h.x - 4, h.y + 0, h.x - 5, h.y + 12);
    ctx.moveTo(h.x + h.rx * 0.55, h.y - 10);
    ctx.quadraticCurveTo(h.x + 4, h.y + 0, h.x + 5, h.y + 12);
    ctx.stroke();
  }

  function drawFeather(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const side = d.side || 1;
    const sway = rig.pose.clothSway * 0.35;
    const baseX = h.x + side * (h.rx * 0.55);
    const baseY = h.y - 13;
    ctx.save();
    ctx.strokeStyle = COLORS.accentDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + side * (12 + Math.abs(sway)), baseY - 16, baseX + side * (24 + Math.abs(sway)), baseY - 9);
    ctx.stroke();
    ctx.fillStyle = COLORS.featherBlue;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(baseX + side * (23 + Math.abs(sway)), baseY - 10, 5, 10, side * 0.9, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(COLORS.trim, 0.55);
    ctx.lineWidth = 0.7;
    for (let i = -3; i <= 3; i++) {
      Base.line(ctx, baseX + side * (23 + Math.abs(sway)), baseY - 10 + i * 2, baseX + side * (29 + Math.abs(sway) + Math.abs(i) * 0.7), baseY - 10 + i * 1.4, rgba(COLORS.trim, 0.45), 0.55, 1);
    }
    ctx.restore();
  }

  function drawCastHandGlow(ctx, rig, palette, front) {
    const hand = front ? rig.anchors.mainHand : rig.anchors.offHand;
    const alpha = front ? 0.45 : 0.22;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha + rig.pose.castPulse * 0.25;
    const g = ctx.createRadialGradient(hand.x, hand.y, 2, hand.x, hand.y, 18);
    g.addColorStop(0, '#fff7b5');
    g.addColorStop(0.45, 'rgba(255,219,104,0.48)');
    g.addColorStop(1, 'rgba(255,219,104,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 18, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMusicNotes(ctx, rig, palette) {
    const d = rig.dir;
    const side = d.side || 1;
    const p = rig.pose;
    ctx.save();
    ctx.globalAlpha = 0.48 + p.castPulse * 0.38;
    ctx.strokeStyle = COLORS.trim;
    ctx.lineWidth = 2;
    const start = rig.anchors.head;
    drawNote(ctx, start.x + side * 28, start.y - 9 + Math.sin(p.t * 4) * 2, 1);
    drawNote(ctx, start.x + side * 41, start.y - 26 + Math.sin(p.t * 4 + 1) * 2, 0.82);
    drawNote(ctx, start.x - side * 27, start.y - 21 + Math.sin(p.t * 4 + 2) * 2, 0.72);
    ctx.restore();
  }

  function drawNote(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -13);
    ctx.lineTo(8, -11);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-2, 1, 4, 3, -0.4, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawSongPulse(ctx, rig, palette) {
    const a = rig.anchors.chest;
    const alpha = rig.pose.attackCurve * 0.32;
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.trim;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, 22 + i * 9 + rig.pose.attackCurve * 8, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMeditationEffects(ctx, rig, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.28;
    const g = ctx.createRadialGradient(0, 5, 4, 0, 5, 42 * rig.pose.meditatePulse);
    g.addColorStop(0, 'rgba(122,219,255,0.55)');
    g.addColorStop(0.5, 'rgba(81,151,255,0.18)');
    g.addColorStop(1, 'rgba(81,151,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 7, 38, 15, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(180,238,255,0.75)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const phase = rig.pose.t * 2.4 + i * 1.25;
      const x = Math.cos(phase) * (17 + i * 1.6);
      const y = -16 - (phase * 14 % 58);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDeathDust(ctx, rig, palette) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#26170f';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-18 + i * 9, 8 + Math.sin(i) * 2, 5, 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  DR.render.BardProceduralModel = { draw };
  window.BardProceduralModel = DR.render.BardProceduralModel;
})();
