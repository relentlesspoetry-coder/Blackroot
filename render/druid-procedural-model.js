(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const Base = DR.render.HumanoidBaseRenderer;
  const Anim = DR.render.HumanoidAnimationSystem;
  const TAU = Math.PI * 2;

  const COLORS = {
    outline: '#111711',
    shadow: 'rgba(0,0,0,0.38)',
    skin: '#d9a070',
    skinShadow: '#996747',
    hair: '#342818',
    hairHi: '#6c4b2a',
    cloth: '#365a34',
    clothDark: '#172619',
    clothHi: '#6f8f4e',
    moss: '#263d25',
    mossHi: '#86b85a',
    leaf: '#78b957',
    leafDark: '#2c5c34',
    leafHi: '#b7df72',
    bark: '#624125',
    barkDark: '#2b1d14',
    barkHi: '#9a6b3b',
    vine: '#395f2e',
    flower: '#d9b15b',
    glow: '#8cff8a',
    glowBlue: '#8af8d8',
    trim: '#c8e68e',
    boot: '#251a12',
    bootHi: '#5c4328',
    belt: '#51341f',
    bone: '#d5c49d',
    boneDark: '#73654a',
    fur: '#7a5634',
    furHi: '#b2875c',
    mud: '#3c2d1f',
    woad: '#6ca7a6'
  };

  function applyDruidAnimationIdentity(pose) {
    const p = { ...pose };
    const pulse = Math.sin((p.t || 0) * 2.1 + (p.seed || 0));
    p.torsoBob *= 0.78;
    p.headBob *= 0.82;
    p.capeSway *= 0.85;
    if (p.action === 'cast') {
      p.armSwing *= 0.58;
      p.torsoBob -= 0.8 + p.castPulse * 0.6;
      p.rootedCast = 1;
    }
    if (p.action === 'meditate') {
      p.headBob += pulse * 0.18;
      p.natureMeditatePulse = 1;
    }
    return p;
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!Base || !Anim) return false;

    const pose = applyDruidAnimationIdentity(Anim.buildPose(actor, nowMs));
    const hooks = buildDruidHooks(actor, pose);
    const rig = Base.draw(ctx, actor, {
      pose,
      palette: druidPalette(actor),
      hooks,
      debugFacing: !!actor.debugFacing
    }, nowMs);

    const source = actor.sourceEntity || actor;
    if (source) {
      source._humanoidFacingName = pose.direction.name;
      source._lastHumanoidFacingName = pose.direction.name;
      source._druidDetailPass = 'druid-high-detail-v0.14.08-primal-regalia';
      source._nameplateAnchor = {
        x: Math.round(actor.screenX ?? actor.x ?? 0) + (rig?.anchors?.head?.x || 0),
        y: Math.round(actor.screenY ?? actor.y ?? 0) + (rig?.anchors?.head?.top || -90) - 7
      };
    }
    return true;
  }

  function druidPalette(actor = {}) {
    const actorPalette = actor.palette || actor.visualPalette || {};
    return {
      outline: actorPalette.outline || COLORS.outline,
      shadow: actorPalette.shadow || COLORS.shadow,
      skin: actor.skinTone || actorPalette.skin || COLORS.skin,
      skinShadow: actorPalette.skinShadow || COLORS.skinShadow,
      hair: actor.hairColor || actorPalette.hair || COLORS.hair,
      hairHi: actorPalette.hairHi || COLORS.hairHi,
      cloth: actor.clothesPrimary || actorPalette.cloth || COLORS.cloth,
      clothDark: actorPalette.clothDark || COLORS.clothDark,
      clothHi: actor.clothesSecondary || actorPalette.clothHi || COLORS.clothHi,
      accent: actorPalette.accent || COLORS.leaf,
      accentDark: actorPalette.accentDark || COLORS.leafDark,
      boot: actorPalette.boot || COLORS.boot,
      bootHi: actorPalette.bootHi || COLORS.bootHi,
      belt: actorPalette.belt || COLORS.belt,
      glow: actorPalette.glow || COLORS.glow
    };
  }

  function buildDruidHooks(actor, pose) {
    return {
      back(ctx, rig, palette) {
        drawBackHair(ctx, rig, palette);
        if (!['fishing','swim'].includes(pose.action) && staffLayer(rig) === 'back') drawStaff(ctx, rig, palette, 'back');
        drawBackTotem(ctx, rig, palette);
      },
      backCape(ctx, rig, palette) {
        drawLeafMantleBack(ctx, rig, palette);
        drawDruidBackMantleDetails(ctx, rig, palette);
      },
      torsoOverlay(ctx, rig, palette) {
        drawMossRobe(ctx, rig, palette);
        drawDruidHideRobeDetails(ctx, rig, palette);
      },
      chest(ctx, rig, palette) {
        drawShoulderLeaves(ctx, rig, palette);
        drawVineSash(ctx, rig, palette);
        drawBarkBelt(ctx, rig, palette);
        drawLeafTabard(ctx, rig, palette);
        drawDruidBeltAndPouchDetails(ctx, rig, palette);
      },
      hair(ctx, rig, palette) {
        if (Base.drawDefaultHair) Base.drawDefaultHair(ctx, rig, palette);
        else drawDruidHair(ctx, rig, palette);
        drawLeafCrown(ctx, rig, palette);
        drawDruidHeadAndFaceDetails(ctx, rig, palette);
      },
      mid(ctx, rig, palette) {
        if (pose.action === 'cast') drawHandGlow(ctx, rig, palette, false);
        drawWristWraps(ctx, rig, palette);
        drawDruidArmGrowthDetails(ctx, rig, palette);
      },
      front(ctx, rig, palette) {
        if (pose.action === 'fishing') {
          drawFishingRod(ctx, rig, palette);
          return;
        }
        if (pose.action !== 'swim' && staffLayer(rig) === 'front') drawStaff(ctx, rig, palette, 'front');
        if (pose.action === 'cast') drawHandGlow(ctx, rig, palette, true);
      },
      effects(ctx, rig, palette) {
        if (pose.action === 'cast') drawNatureCastEffects(ctx, rig, palette);
        if (pose.action === 'attack') drawThornSwipe(ctx, rig, palette);
        if (pose.action === 'meditate') drawMeditationNatureAura(ctx, rig, palette);
        if (pose.action === 'hit') drawLeafBurst(ctx, rig, palette, 0.32);
        if (pose.action === 'death') drawDeathLeaves(ctx, rig, palette);
      }
    };
  }

  function staffLayer(rig) {
    if (rig.pose.action === 'cast' || rig.pose.action === 'attack') return 'front';
    return rig.dir.backVisible ? 'back' : 'front';
  }

  function poly(ctx, pts, fill, stroke = COLORS.outline, width = 2) {
    Base.poly(ctx, pts, fill, stroke, width);
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
    // tip. Without this the druid's custom rod recorded no tip, so the line detached
    // and fell back to a world-space guess (mirrors drawClassFishingRig).
    if (source && typeof source === 'object') source.fishingRodTipLocal = { x: tip.x, y: tip.y };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COLORS.barkDark || '#4b2e19';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = COLORS.mossHi || '#d5d8a6';
    ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(main.x, main.y); ctx.quadraticCurveTo(mid.x, mid.y - 2, tip.x, tip.y); ctx.stroke();
    ctx.fillStyle = COLORS.bark || '#8a6236'; ctx.beginPath(); ctx.arc(main.x - side * 6, main.y + 5, 6 + Math.abs(reel), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawLeafMantleBack(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const side = d.capeSide || 0;
    const sway = p.capeSway * 0.45;
    const topW = 20 * (d.shoulderScale || 1);
    const hemW = p.action === 'meditate' ? 34 : 27;
    const g = ctx.createLinearGradient(-28, a.chest.y - 18, 28, a.pelvis.y + 42);
    g.addColorStop(0, COLORS.leafHi);
    g.addColorStop(0.22, COLORS.leaf);
    g.addColorStop(0.58, COLORS.cloth);
    g.addColorStop(1, COLORS.clothDark);
    poly(ctx, [
      { x: a.chest.x - topW - side * 4, y: a.chest.y - 14 },
      { x: a.chest.x + topW - side * 4, y: a.chest.y - 14 },
      { x: a.pelvis.x + hemW - side * 6 + sway, y: a.pelvis.y + 39 },
      { x: a.pelvis.x + 8 + side * 5, y: a.pelvis.y + 51 },
      { x: a.pelvis.x - hemW - side * 6 - sway, y: a.pelvis.y + 39 }
    ], g, palette.outline, 2);

    ctx.save();
    ctx.globalAlpha = 0.68;
    for (let i = -2; i <= 2; i++) {
      drawLeaf(ctx, a.chest.x + i * 9 - side * 4 + Math.sin(i) * 2, a.chest.y + 2 + Math.abs(i) * 3, 0.7, i * 0.28, COLORS.leafHi, COLORS.leafDark);
    }
    ctx.restore();
  }

  function drawMossRobe(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const skew = d.torsoSkew * 0.18;
    const sway = p.clothSway * 0.38;
    const g = ctx.createLinearGradient(-22, a.chest.y - 8, 22, a.pelvis.y + 38);
    g.addColorStop(0, '#668c48');
    g.addColorStop(0.34, palette.cloth);
    g.addColorStop(0.68, COLORS.moss);
    g.addColorStop(1, COLORS.clothDark);
    poly(ctx, [
      { x: a.chest.x - 16 + skew, y: a.chest.y - 4 },
      { x: a.chest.x + 16 + skew, y: a.chest.y - 4 },
      { x: a.pelvis.x + 19 + sway, y: a.pelvis.y + 34 },
      { x: a.pelvis.x + 7, y: a.pelvis.y + 44 },
      { x: a.pelvis.x - 7, y: a.pelvis.y + 44 },
      { x: a.pelvis.x - 19 - sway, y: a.pelvis.y + 34 }
    ], g, palette.outline, 1.8);

    ctx.save();
    ctx.strokeStyle = 'rgba(198,230,142,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(a.chest.x + i * 7 + skew, a.chest.y - 1);
      ctx.quadraticCurveTo(a.pelvis.x + i * 4 + sway * 0.2, a.pelvis.y + 12, a.pelvis.x + i * 8, a.pelvis.y + 35);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShoulderLeaves(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const w = 28 * (d.shoulderScale || 1);
    const y = a.chest.y - 15;
    const skew = d.torsoSkew * 0.2;
    const g = ctx.createLinearGradient(-w, y - 6, w, y + 9);
    g.addColorStop(0, COLORS.leafHi);
    g.addColorStop(0.46, COLORS.leaf);
    g.addColorStop(1, COLORS.leafDark);
    poly(ctx, [
      { x: a.chest.x - w + skew, y },
      { x: a.chest.x - 10 + skew, y: y - 6 },
      { x: a.chest.x + 10 + skew, y: y - 6 },
      { x: a.chest.x + w + skew, y },
      { x: a.chest.x + w - 7 + skew, y: y + 10 },
      { x: a.chest.x - w + 7 + skew, y: y + 10 }
    ], g, palette.outline, 2);

    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = -2; i <= 2; i++) drawLeaf(ctx, a.chest.x + i * 8 + skew, y + 2 + Math.abs(i), 0.38, i * 0.2, COLORS.trim, COLORS.leafDark);
    ctx.restore();
  }

  function drawVineSash(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const side = d.side || 1;
    const sway = rig.pose.clothSway * 0.25;
    const x1 = a.chest.x - side * 13;
    const y1 = a.chest.y - 8;
    const x2 = a.pelvis.x + side * (10 + sway);
    const y2 = a.pelvis.y + 21;
    ctx.save();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(a.chest.x - side * 8, a.chest.y + 8, a.pelvis.x + side * 3, a.pelvis.y + 4, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.vine;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(a.chest.x - side * 8, a.chest.y + 8, a.pelvis.x + side * 3, a.pelvis.y + 4, x2, y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.leafHi;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x1 + side * 1.5, y1 + 1);
    ctx.bezierCurveTo(a.chest.x - side * 4, a.chest.y + 8, a.pelvis.x + side * 5, a.pelvis.y + 6, x2 + side * 1.5, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBarkBelt(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const w = 17 * (d.torsoScaleX || 1);
    const y = a.belt.y;
    Base.roundRect(ctx, a.belt.x - w, y - 3, w * 2, 7, 3, COLORS.bark, palette.outline, 1.5);
    Base.roundRect(ctx, a.belt.x - 4, y - 5, 8, 10, 2, COLORS.leafDark, COLORS.barkDark, 1.2);
    ctx.fillStyle = COLORS.trim;
    ctx.fillRect(a.belt.x - 1, y - 1, 2, 2);

    const pouchX = a.belt.x + (d.side || 1) * 16;
    Base.roundRect(ctx, pouchX - 4, y + 1, 8, 9, 2, '#5c3b24', palette.outline, 1);
    drawLeaf(ctx, pouchX + 2, y + 2, 0.28, 0.2, COLORS.leafHi, COLORS.leafDark);
  }

  function drawLeafTabard(ctx, rig, palette) {
    if (rig.dir.backVisible) return;
    const a = rig.anchors;
    const p = rig.pose;
    const sway = p.clothSway * 0.28;
    const g = ctx.createLinearGradient(a.chest.x, a.chest.y - 6, a.pelvis.x, a.pelvis.y + 35);
    g.addColorStop(0, COLORS.leafHi);
    g.addColorStop(0.42, COLORS.leaf);
    g.addColorStop(1, COLORS.leafDark);
    poly(ctx, [
      { x: a.chest.x - 8, y: a.chest.y + 1 },
      { x: a.chest.x + 9, y: a.chest.y + 1 },
      { x: a.pelvis.x + 7 + sway, y: a.pelvis.y + 30 },
      { x: a.pelvis.x, y: a.pelvis.y + 38 },
      { x: a.pelvis.x - 8 - sway, y: a.pelvis.y + 30 }
    ], g, palette.outline, 1.4);
    ctx.save();
    ctx.strokeStyle = 'rgba(230,255,160,0.62)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.chest.x, a.chest.y + 4);
    ctx.lineTo(a.pelvis.x, a.pelvis.y + 34);
    ctx.moveTo(a.chest.x - 4, a.chest.y + 10);
    ctx.lineTo(a.pelvis.x + 5, a.pelvis.y + 24);
    ctx.moveTo(a.chest.x + 4, a.chest.y + 10);
    ctx.lineTo(a.pelvis.x - 5, a.pelvis.y + 24);
    ctx.stroke();
    ctx.restore();
  }

  function drawDruidHair(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    if (d.backVisible) {
      const g = ctx.createLinearGradient(h.x - 12, h.y - 19, h.x + 12, h.y + 9);
      g.addColorStop(0, COLORS.hairHi);
      g.addColorStop(0.58, COLORS.hair);
      g.addColorStop(1, '#1a100b');
      poly(ctx, [
        { x: h.x - h.rx - 3, y: h.y - 4 },
        { x: h.x - h.rx + 2, y: h.y - 15 },
        { x: h.x - 4, y: h.y - 20 },
        { x: h.x + h.rx - 1, y: h.y - 15 },
        { x: h.x + h.rx + 3, y: h.y - 3 },
        { x: h.x + h.rx * 0.5, y: h.y + 10 },
        { x: h.x - h.rx * 0.55, y: h.y + 10 }
      ], g, palette.outline, 1.8);
      return;
    }

    const s = d.side || 1;
    const g = ctx.createLinearGradient(h.x - 13, h.y - 18, h.x + 14, h.y + 3);
    g.addColorStop(0, COLORS.hairHi);
    g.addColorStop(0.56, COLORS.hair);
    g.addColorStop(1, '#1b100d');
    poly(ctx, [
      { x: h.x - h.rx - 2, y: h.y - 1 },
      { x: h.x - h.rx + 2, y: h.y - 13 },
      { x: h.x - 2 * s, y: h.y - 20 },
      { x: h.x + h.rx + 2, y: h.y - 8 },
      { x: h.x + h.rx * 0.6, y: h.y + 2 },
      { x: h.x + 3 * s, y: h.y - 4 },
      { x: h.x - h.rx * 0.55, y: h.y + 4 }
    ], g, palette.outline, 1.8);

    ctx.fillStyle = 'rgba(70,105,44,0.75)';
    ctx.beginPath();
    ctx.arc(h.x - s * 4, h.y - 15, 2.4, 0, TAU);
    ctx.fill();
  }

  function drawBackHair(ctx, rig, palette) {
    if (!rig.dir.backVisible) return;
    const h = rig.anchors.head;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = COLORS.hairHi;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(h.x - h.rx * 0.6, h.y - 8);
    ctx.quadraticCurveTo(h.x, h.y + 3, h.x + h.rx * 0.6, h.y - 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawLeafCrown(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const y = h.y - 15.5;
    const sideBias = d.side || 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    Base.line(ctx, h.x - 10, y + 2, h.x + 10, y + 2, COLORS.vine, 2.2, 0.92);
    Base.line(ctx, h.x - 8, y + 1, h.x - 16 + sideBias * 0.8, y - 12, COLORS.outline, 3.2, 0.92);
    Base.line(ctx, h.x + 8, y + 1, h.x + 16 + sideBias * 0.8, y - 12, COLORS.outline, 3.2, 0.92);
    Base.line(ctx, h.x - 8, y + 1, h.x - 16 + sideBias * 0.8, y - 12, COLORS.bone, 1.7, 0.95);
    Base.line(ctx, h.x + 8, y + 1, h.x + 16 + sideBias * 0.8, y - 12, COLORS.bone, 1.7, 0.95);
    for (const dir of [-1, 1]) {
      const rootX = h.x + dir * 11 + sideBias * 0.6;
      Base.line(ctx, rootX, y - 6, rootX + dir * 5, y - 14, COLORS.bone, 1.2, 0.9);
      Base.line(ctx, rootX + dir * 2, y - 10, rootX + dir * 8, y - 17, COLORS.bone, 1.0, 0.82);
      drawLeaf(ctx, rootX - dir * 1, y - 3, 0.24, dir * 0.6, COLORS.leafHi, COLORS.leafDark);
    }
    for (let i = -2; i <= 2; i++) {
      const x = h.x + i * 4 + sideBias * 0.8;
      drawLeaf(ctx, x, y + Math.abs(i) * 0.8, 0.28 + (i === 0 ? 0.06 : 0), i * 0.35, i === 0 ? COLORS.flower : COLORS.leafHi, COLORS.leafDark);
    }
    if (!d.backVisible) {
      ctx.fillStyle = COLORS.flower;
      ctx.beginPath();
      ctx.arc(h.x + sideBias * 5, y + 1, 1.5, 0, TAU);
      ctx.fill();
      Base.line(ctx, h.x - 5, h.y - 1, h.x + 5, h.y - 1, COLORS.woad, 1.3, 0.58);
    }
    ctx.restore();
  }

  function drawWristWraps(ctx, rig, palette) {
    const arms = rig.anchors.arms;
    ctx.save();
    ctx.strokeStyle = COLORS.vine;
    ctx.lineWidth = 2.2;
    for (const arm of [arms.near, arms.far]) {
      ctx.beginPath();
      ctx.moveTo(arm.hand.x - 3, arm.hand.y - 5);
      ctx.lineTo(arm.hand.x + 3, arm.hand.y - 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBackTotem(ctx, rig, palette) {
    if (!rig.dir.backVisible || rig.pose.action === 'cast' || rig.pose.action === 'attack') return;
    const a = rig.anchors;
    const side = rig.dir.side || 1;
    ctx.save();
    ctx.translate(a.back.x + side * 14, a.back.y + 6);
    ctx.rotate(side * 0.22);
    Base.roundRect(ctx, -4, -12, 8, 22, 3, COLORS.bark, palette.outline, 1.3);
    drawLeaf(ctx, 0, -14, 0.34, 0, COLORS.leafHi, COLORS.leafDark);
    ctx.fillStyle = COLORS.glow;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, -2, 2.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawStaff(ctx, rig, palette, layer) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const near = a.mainHand || a.arms.near.hand;
    const side = d.side || (d.nearSide || 1);
    const casting = p.action === 'cast';
    const attacking = p.action === 'attack';
    let baseX;
    let baseY;
    let topX;
    let topY;

    if (casting || attacking) {
      const hand = near;
      baseX = hand.x - side * (casting ? 5 : 9);
      baseY = hand.y + 25;
      topX = hand.x + side * (casting ? 8 : 18 + p.attackCurve * 6);
      topY = hand.y - (casting ? 46 + p.castPulse * 7 : 34 + p.attackCurve * 14);
    } else if (d.backVisible) {
      baseX = a.back.x - side * 18;
      baseY = a.pelvis.y + 36;
      topX = a.back.x + side * 7;
      topY = a.chest.y - 32;
    } else {
      baseX = a.offHand.x - side * 3;
      baseY = a.offHand.y + 26;
      topX = a.offHand.x + side * 11;
      topY = a.offHand.y - 36;
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = layer === 'back' ? 5.4 : 6.4;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(topX, topY);
    ctx.stroke();
    ctx.strokeStyle = COLORS.bark;
    ctx.lineWidth = layer === 'back' ? 3.3 : 4.2;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(topX, topY);
    ctx.stroke();
    ctx.strokeStyle = COLORS.barkHi;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(baseX + side * 1, baseY - 3);
    ctx.lineTo(topX + side * 1, topY + 4);
    ctx.stroke();

    drawStaffHead(ctx, topX, topY, side, p, palette);
    ctx.restore();
  }

  function drawStaffHead(ctx, x, y, side, pose, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * 0.15);
    Base.line(ctx, -7, 3, 7, -8, COLORS.outline, 4.6, 1);
    Base.line(ctx, -7, 3, 7, -8, COLORS.vine, 2.7, 1);
    Base.line(ctx, -3, 0, -8, -9, COLORS.outline, 3.0, 0.95);
    Base.line(ctx, 4, -5, 11, -14, COLORS.outline, 3.0, 0.95);
    Base.line(ctx, -3, 0, -8, -9, COLORS.barkHi, 1.5, 0.95);
    Base.line(ctx, 4, -5, 11, -14, COLORS.barkHi, 1.5, 0.95);
    Base.roundRect(ctx, -4.5, -8.5, 9, 8, 3, COLORS.bark, COLORS.outline, 1.0);
    drawLeaf(ctx, -8, -2, 0.42, -0.55, COLORS.leafHi, COLORS.leafDark);
    drawLeaf(ctx, 7, -8, 0.42, 0.65, COLORS.leafHi, COLORS.leafDark);
    drawLeaf(ctx, 1, -15, 0.30, 0.1, COLORS.flower, COLORS.leafDark);
    Base.line(ctx, -5, 4, -10, 12, COLORS.belt, 0.9, 0.7);
    Base.line(ctx, 5, 1, 11, 9, COLORS.belt, 0.9, 0.7);
    drawBoneCharm(ctx, -11, 13, 0.42, palette);
    drawBoneCharm(ctx, 12, 10, 0.34, palette);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = pose.action === 'cast' ? 0.5 + pose.castPulse * 0.4 : 0.45;
    ctx.fillStyle = COLORS.glow;
    ctx.beginPath();
    ctx.arc(0, -4, pose.action === 'cast' ? 5 + pose.castPulse * 2 : 3.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }


  function drawBoneCharm(ctx, x, y, scale, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale || 1, scale || 1);
    Base.roundRect(ctx, -3, -5, 6, 10, 2, COLORS.bone, palette.outline, 1.2);
    ctx.fillStyle = COLORS.boneDark;
    ctx.beginPath(); ctx.arc(-1.4, -1.4, 0.9, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(1.4, -1.4, 0.9, 0, TAU); ctx.fill();
    Base.line(ctx, -2, 3, 2, 3, COLORS.boneDark, 0.8, 0.9);
    ctx.restore();
  }

  function drawTinyFungus(ctx, x, y, scale, palette) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale || 1, scale || 1);
    Base.line(ctx, 0, 5, 0, 0, COLORS.trim, 1.2, 0.7);
    ctx.fillStyle = COLORS.flower;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, -1, 4, 2.2, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawDruidBackMantleDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const side = d.capeSide || 0;
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < 7; i++) {
      const x = a.chest.x - 24 + i * 8 - side * 3;
      const y = a.chest.y - 4 + (i % 2) * 3;
      drawLeaf(ctx, x, y, 0.34 + (i % 3) * 0.03, i * 0.32, i % 2 ? COLORS.mossHi : COLORS.leafHi, COLORS.leafDark);
    }
    Base.line(ctx, a.chest.x - 18, a.chest.y + 7, a.pelvis.x - 10 - p.capeSway * 0.12, a.pelvis.y + 31, COLORS.furHi, 1.0, 0.44);
    Base.line(ctx, a.chest.x + 16, a.chest.y + 7, a.pelvis.x + 10 + p.capeSway * 0.12, a.pelvis.y + 32, COLORS.furHi, 1.0, 0.38);
    drawTinyFungus(ctx, a.chest.x + 16, a.chest.y + 2, 0.42, palette);
    ctx.restore();
  }

  function drawDruidHideRobeDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const sway = p.clothSway * 0.18;
    ctx.save();
    ctx.globalAlpha = 0.82;
    Base.line(ctx, a.chest.x - 12, a.chest.y + 0, a.pelvis.x - 16 - sway, a.pelvis.y + 32, COLORS.furHi, 0.95, 0.45);
    Base.line(ctx, a.chest.x + 13, a.chest.y + 1, a.pelvis.x + 14 + sway, a.pelvis.y + 30, COLORS.furHi, 0.95, 0.38);
    for (let i = 0; i < 5; i++) {
      const x = a.chest.x - 13 + i * 7 + (d.side || 0) * 0.8;
      Base.line(ctx, x, a.chest.y + 5, x + (i - 2) * 0.6, a.pelvis.y + 26, COLORS.vine, 0.75, 0.42);
    }
    for (let i = -1; i <= 1; i++) drawLeaf(ctx, a.pelvis.x + i * 8, a.pelvis.y + 32 + Math.abs(i) * 2, 0.22, i * 0.4, COLORS.leafDark, COLORS.outline);
    ctx.restore();
  }

  function drawDruidBeltAndPouchDetails(ctx, rig, palette) {
    const a = rig.anchors;
    const d = rig.dir;
    const side = d.side || 1;
    const y = a.belt.y + 3;
    ctx.save();
    Base.line(ctx, a.belt.x - 14, y + 6, a.belt.x - 11, y + 17, COLORS.belt, 0.9, 0.7);
    drawBoneCharm(ctx, a.belt.x - 11, y + 20, 0.34, palette);
    Base.roundRect(ctx, a.belt.x + side * 21 - 5, y + 3, 10, 12, 2, COLORS.fur, palette.outline, 1.0);
    drawLeaf(ctx, a.belt.x + side * 21 + 1, y + 6, 0.22, 0.4, COLORS.leafHi, COLORS.leafDark);
    Base.line(ctx, a.belt.x + side * 6, y + 7, a.belt.x + side * 15, y + 18, COLORS.vine, 1.1, 0.62);
    ctx.restore();
  }

  function drawDruidHeadAndFaceDetails(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const side = d.side || 0;
    if (d.backVisible) return;
    ctx.save();
    Base.line(ctx, h.x - 8, h.y - 2, h.x + 8, h.y - 3, COLORS.woad, 1.2, 0.58);
    Base.line(ctx, h.x - 6 + side * 1, h.y + 3, h.x - 1 + side * 2, h.y + 8, COLORS.woad, 0.85, 0.46);
    Base.line(ctx, h.x + 3 + side * 1, h.y + 2, h.x + 7 + side * 2, h.y + 6, COLORS.woad, 0.85, 0.42);
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = i === 0 ? COLORS.bone : COLORS.flower;
      ctx.beginPath(); ctx.arc(h.x + side * 9 + i * 2, h.y + 8 + Math.abs(i), 0.85, 0, TAU); ctx.fill();
    }
    drawTinyFungus(ctx, h.x - 9 + side * 1, h.y - 11, 0.24, palette);
    ctx.restore();
  }

  function drawDruidArmGrowthDetails(ctx, rig, palette) {
    const arms = rig.anchors.arms;
    ctx.save();
    for (const arm of [arms.near, arms.far]) {
      if (!arm?.hand) continue;
      Base.line(ctx, arm.hand.x - 4, arm.hand.y - 12, arm.hand.x + 1, arm.hand.y - 4, COLORS.barkHi, 0.9, 0.48);
      drawLeaf(ctx, arm.hand.x - 2, arm.hand.y - 9, 0.20, -0.4, COLORS.leafHi, COLORS.leafDark);
      Base.line(ctx, arm.hand.x + 2, arm.hand.y - 6, arm.hand.x + 5, arm.hand.y - 1, COLORS.vine, 0.8, 0.42);
    }
    ctx.restore();
  }

  function drawHandGlow(ctx, rig, palette, front) {
    const hand = front ? rig.anchors.mainHand : rig.anchors.offHand;
    const p = rig.pose;
    if (!hand) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = front ? 0.56 : 0.32;
    const g = ctx.createRadialGradient(hand.x, hand.y, 1, hand.x, hand.y, 14 + p.castPulse * 5);
    g.addColorStop(0, 'rgba(199,255,142,0.9)');
    g.addColorStop(0.55, 'rgba(110,255,115,0.28)');
    g.addColorStop(1, 'rgba(110,255,115,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 14 + p.castPulse * 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawNatureCastEffects(ctx, rig, palette) {
    const a = rig.anchors;
    const p = rig.pose;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.42 + p.castPulse * 0.25;
    ctx.strokeStyle = COLORS.glow;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const phase = p.t * 2.8 + i * 1.6;
      const rx = 19 + i * 4;
      ctx.beginPath();
      ctx.ellipse(a.chest.x, a.chest.y + 7, rx, 7 + i * 1.3, phase * 0.3, 0, TAU);
      ctx.stroke();
    }

    for (let i = 0; i < 6; i++) {
      const phase = p.t * 3.2 + i * 1.1;
      const x = Math.cos(phase) * (18 + i * 2);
      const y = -12 - (phase * 13 % 54);
      drawLeaf(ctx, x, y, 0.28 + i * 0.015, phase, COLORS.leafHi, 'rgba(70,120,54,0.9)');
    }
    ctx.restore();
  }

  function drawThornSwipe(ctx, rig, palette) {
    const p = rig.pose;
    const alpha = p.attackCurve * 0.52;
    if (alpha <= 0.02) return;
    const side = rig.dir.side || rig.dir.nearSide || 1;
    const hand = rig.anchors.mainHand;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.leafHi;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(hand.x + side * 7, hand.y - 7, 21 + p.attackCurve * 8, side > 0 ? -1.3 : Math.PI + 1.3, side > 0 ? 0.75 : Math.PI - 0.75);
    ctx.stroke();
    ctx.strokeStyle = COLORS.glow;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
      const a = (side > 0 ? -0.95 : Math.PI + 0.95) + i * 0.32 * side;
      const x = hand.x + Math.cos(a) * (18 + p.attackCurve * 8);
      const y = hand.y - 7 + Math.sin(a) * (14 + p.attackCurve * 5);
      Base.line(ctx, x, y, x + side * 4, y - 6, COLORS.glow, 1.2, alpha);
    }
    ctx.restore();
  }

  function drawMeditationNatureAura(ctx, rig, palette) {
    const p = rig.pose;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = p.meditatePulse || 1;
    const g = ctx.createRadialGradient(0, 6, 3, 0, 6, 45 * pulse);
    g.addColorStop(0, 'rgba(178,255,128,0.50)');
    g.addColorStop(0.44, 'rgba(96,210,94,0.22)');
    g.addColorStop(1, 'rgba(96,210,94,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.ellipse(0, 8, 40, 15, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(190,255,145,0.72)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) {
      const phase = p.t * 2.0 + i * 1.15;
      const x = Math.cos(phase) * (15 + i * 1.8);
      const y = -8 - (phase * 12 % 60);
      drawLeaf(ctx, x, y, 0.25 + i * 0.02, phase, COLORS.leafHi, COLORS.leafDark);
    }
    ctx.restore();
  }

  function drawLeafBurst(ctx, rig, palette, alpha = 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8 + rig.pose.t;
      drawLeaf(ctx, Math.cos(angle) * 22, -34 + Math.sin(angle) * 10, 0.24, angle, COLORS.leafHi, COLORS.leafDark);
    }
    ctx.restore();
  }

  function drawDeathLeaves(ctx, rig, palette) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#1a2414';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(-21 + i * 8, 8 + Math.sin(i) * 2, 5, 2, 0, 0, TAU);
      ctx.fill();
      drawLeaf(ctx, -20 + i * 8, 5 + Math.cos(i) * 3, 0.25, i * 0.6, COLORS.leafDark, COLORS.outline);
    }
    ctx.restore();
  }

  function drawLeaf(ctx, x, y, scale, rot, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(scale || 1, scale || 1);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke || COLORS.leafDark;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.bezierCurveTo(8, -5, 8, 6, 0, 10);
    ctx.bezierCurveTo(-8, 6, -8, -5, 0, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238,255,180,0.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 7);
    ctx.moveTo(0, -1);
    ctx.lineTo(4, -4);
    ctx.moveTo(0, 2);
    ctx.lineTo(-4, -1);
    ctx.stroke();
    ctx.restore();
  }

  DR.render.DruidProceduralModel = { draw };
  window.DruidProceduralModel = DR.render.DruidProceduralModel;
})();
