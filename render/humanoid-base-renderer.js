(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const Anim = DR.render.HumanoidAnimationSystem;
  const TAU = Math.PI * 2;

  const DEFAULT_PALETTE = {
    outline: '#141016',
    shadow: 'rgba(0,0,0,0.36)',
    skin: '#d49a70',
    skinShadow: '#a86b4d',
    hair: '#3a261e',
    hairHi: '#65412d',
    cloth: '#4b4d5d',
    clothDark: '#252836',
    clothHi: '#74798a',
    accent: '#d7b766',
    accentDark: '#7a5a23',
    boot: '#231914',
    bootHi: '#604029',
    belt: '#5a3824',
    metal: '#b8b7aa',
    glow: '#b5f6ff'
  };

  function mergePalette(palette = {}) {
    return { ...DEFAULT_PALETTE, ...palette };
  }

  const ROW_LAYER_PROFILES = Object.freeze({
    0: { backArmLayering: true, farArmAfterTorso: false, nearArmAfterTorso: false, backArmAlpha: 0.16 },
    1: { backArmLayering: false, farArmAfterTorso: true, nearArmAfterTorso: true, backArmAlpha: 0.8 },
    2: { backArmLayering: false, farArmAfterTorso: true, nearArmAfterTorso: true, backArmAlpha: 0.78 },
    3: { backArmLayering: false, farArmAfterTorso: true, nearArmAfterTorso: true, backArmAlpha: 0.78 },
    4: { backArmLayering: true, farArmAfterTorso: false, nearArmAfterTorso: false, backArmAlpha: 0.26 },
    5: { backArmLayering: false, farArmAfterTorso: true, nearArmAfterTorso: true, backArmAlpha: 0.8 },
    6: { backArmLayering: true, farArmAfterTorso: false, nearArmAfterTorso: false, backArmAlpha: 0.26 },
    7: { backArmLayering: false, farArmAfterTorso: true, nearArmAfterTorso: true, backArmAlpha: 0.8 }
  });

  function getRowLayerProfile(direction) {
    return ROW_LAYER_PROFILES[Number(direction?.row)] || ROW_LAYER_PROFILES[1];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function poly(ctx, pts, fill, stroke = DEFAULT_PALETTE.outline, lineWidth = 2) {
    if (!pts || pts.length < 3) return;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    if (lineWidth > 0) ctx.stroke();
  }

  function roundRect(ctx, x, y, w, h, r = 4, fill = '#fff', stroke = DEFAULT_PALETTE.outline, lw = 1.5) {
    const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
    const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
    const safeW = Number.isFinite(Number(w)) ? Number(w) : 0;
    const safeH = Number.isFinite(Number(h)) ? Number(h) : 0;
    const safeR = Math.max(0, Math.min(Math.abs(Number(r) || 0), Math.abs(safeW) * 0.5, Math.abs(safeH) * 0.5));
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();

    // V0.14.04: Some browser/canvas targets expose Canvas 2D without ctx.roundRect
    // on the active render surface. Rogue V0.14.03 added more leather pouch/buckle
    // geometry, which made this path hot and could abort the whole frame. Fall back
    // to a manual rounded-rect path so one unsupported canvas method cannot black-screen rendering.
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(safeX, safeY, safeW, safeH, safeR);
    } else {
      const x0 = safeX;
      const y0 = safeY;
      const x1 = safeX + safeW;
      const y1 = safeY + safeH;
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1);
      const top = Math.min(y0, y1);
      const bottom = Math.max(y0, y1);
      const rr = Math.min(safeR, (right - left) * 0.5, (bottom - top) * 0.5);
      ctx.moveTo(left + rr, top);
      ctx.lineTo(right - rr, top);
      ctx.quadraticCurveTo(right, top, right, top + rr);
      ctx.lineTo(right, bottom - rr);
      ctx.quadraticCurveTo(right, bottom, right - rr, bottom);
      ctx.lineTo(left + rr, bottom);
      ctx.quadraticCurveTo(left, bottom, left, bottom - rr);
      ctx.lineTo(left, top + rr);
      ctx.quadraticCurveTo(left, top, left + rr, top);
      ctx.closePath();
    }
    ctx.fill();
    if (lw > 0) ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke = DEFAULT_PALETTE.outline, lw = 1.5) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    ctx.fill();
    if (lw > 0) ctx.stroke();
  }

  function line(ctx, x1, y1, x2, y2, color, width = 3, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function limb(ctx, a, b, palette, opts = {}) {
    const width = opts.width || 6;
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    line(ctx, a.x, a.y, b.x, b.y, palette.outline, width + 3, alpha);
    line(ctx, a.x, a.y, b.x, b.y, opts.fill || palette.cloth, width, alpha);
  }

  function resolvePalette(actor, options = {}) {
    const p = options.palette || {};
    const actorPalette = actor.palette || actor.visualPalette || {};
    return mergePalette({
      skin: actor.skinTone || actorPalette.skin || p.skin,
      hair: actor.hairColor || actorPalette.hair || p.hair,
      cloth: actor.clothesPrimary || actorPalette.cloth || p.cloth,
      clothDark: actorPalette.clothDark || p.clothDark,
      clothHi: actor.clothesSecondary || actorPalette.clothHi || p.clothHi,
      accent: actorPalette.accent || p.accent,
      accentDark: actorPalette.accentDark || p.accentDark,
      belt: actorPalette.belt || p.belt,
      boot: actorPalette.boot || p.boot,
      bootHi: actorPalette.bootHi || p.bootHi,
      glow: actorPalette.glow || p.glow,
      outline: actorPalette.outline || p.outline
    });
  }

  // FOOT-DROP NOTE, recorded because the obvious fix is wrong.
  //
  // This rig places the feet +38 units below its root (pelvis.y -10, buildLeg foot.y = hip.y + 48),
  // and callers put that root on the tile's ground point - so humanoids draw BELOW where the game
  // places them. Measured in-world: the player's body band ran to +48 draw px past its ground
  // anchor, about 1.3 tiles of apparent displacement toward the camera. That is why the swim state
  // engages before a character looks wet, why contact shadows sit at the hips, and the root cause of
  // the roots-at-waist VFX bug.
  //
  // SUBTRACTING IT HERE DOES NOT FIX IT. The player and the class actors do not render through this
  // module at all - they go drawBardClassModel -> drawCachedModelOrFallback -> drawScaledModelSafely
  // - so a shift here moves only whatever still uses this path and desynchronises it from everything
  // else. Nor is the offset shared: a quadruped enemy measured +21 against the humanoid's +48, so a
  // single constant applied at the shared wrapper would misplace mobs by ~27px. Any real fix has to
  // be per-model-family with a per-family measurement.

  function buildRig(actor = {}, pose = Anim.buildPose(actor), options = {}) {
    const d = pose.direction;
    const scaleX = d.torsoScaleX || 1;
    const shoulderW = 28 * (d.shoulderScale || 1);
    const hipW = 16 * scaleX;
    const side = d.side || 0;
    const skew = d.torsoSkew || 0;
    const recoilX = -side * pose.recoil;
    const death = pose.deathProgress || 0;

    const root = { x: 0, y: 0 };
    let bodyTilt = side * 0.04 + pose.lean * 0.006;
    let bodyDrop = 0;
    let collapseRot = 0;
    if (pose.action === 'death') {
      collapseRot = (side || 1) * (Math.PI * 0.43 * death);
      bodyDrop = 24 * death;
      bodyTilt += collapseRot;
    }

    const pelvis = { x: recoilX + skew * 0.05, y: -10 + bodyDrop };
    const chest = { x: recoilX + skew * 0.16 + pose.lean * 0.25, y: -42 + pose.torsoBob + bodyDrop * 0.7 };
    const neck = { x: chest.x + d.headTurn * 0.14, y: -62 + pose.headBob + bodyDrop * 0.45 };
    const head = {
      x: chest.x + d.headTurn * 0.6,
      y: -75 + pose.headBob + bodyDrop * 0.3,
      rx: 11.5 * (d.headScaleX || 1),
      ry: 14,
      top: -90 + pose.headBob + bodyDrop * 0.3,
      bottom: -62 + pose.headBob + bodyDrop * 0.3
    };

    if (pose.action === 'meditate') {
      const med = pose.meditatePulse || 1;
      const medPelvis = { x: 0, y: -6 };
      const medChest = { x: 0, y: -36 + pose.torsoBob };
      const medNeck = { x: d.headTurn * 0.07, y: -55 + pose.headBob };
      const medHead = {
        x: d.headTurn * 0.35,
        y: -68 + pose.headBob + 1.5,
        rx: 11.2 * (d.headScaleX || 1),
        ry: 13.2,
        top: -82 + pose.headBob,
        bottom: -55 + pose.headBob
      };
      return buildMeditationRig(actor, pose, d, { root, pelvis: medPelvis, chest: medChest, neck: medNeck, head: medHead, med });
    }

    if (pose.action === 'swim') {
      return buildSwimmingRig(actor, pose, d, { root, pelvis, chest, neck, head });
    }

    if (pose.action === 'sit') {
      return buildSittingEmoteRig(actor, pose, d, { root, pelvis, chest, neck, head });
    }

    // V0.20.69: riding sits alongside sit/swim as its own rig rather than being patched into the
    // walking rig, so every class inherits a seated rider from one place.
    if (pose.action === 'ride') {
      return buildRidingRig(actor, pose, d, { root, pelvis, chest, neck, head });
    }

    const source = actor.sourceEntity || actor;
    const gatheringKind = String(source.gatheringKind || actor.gatheringKind || '').toLowerCase();
    const herbGathering = pose.action === 'gathering' && gatheringKind !== 'mining' && gatheringKind !== 'fishing';
    if (herbGathering) {
      // V0.14.50: herb gathering owns a true kneel/bend silhouette instead of only moving the hands.
      const reachSide = d.side || d.nearSide || 1;
      const cut = Number(pose.gatherCutPhase || 0);
      const completionLift = Number(pose.gatherCompleteHold || 0);
      const bend = 1 - completionLift * 0.42;
      pelvis.y += 8 * bend;
      chest.x += reachSide * (5.5 + cut * 1.8) * bend;
      chest.y += 17 * bend;
      neck.x += reachSide * (6.5 + cut) * bend;
      neck.y += 19 * bend;
      head.x += reachSide * (7.2 + cut * 1.5) * bend;
      head.y += 20 * bend;
      head.top += 20 * bend;
      head.bottom += 20 * bend;
      bodyTilt += reachSide * 0.13 * bend;
    }

    const leftSign = -1;
    const rightSign = 1;
    const nearSign = d.nearSide || 1;
    const farSign = d.farSide || -1;
    const armSwingNear = pose.armSwing * nearSign;
    const armSwingFar = -pose.armSwing * nearSign;
    const strideNear = pose.legSwing * nearSign;
    const strideFar = -pose.legSwing * nearSign;

    const shoulders = {
      left: { x: chest.x - shoulderW / 2 + skew * 0.18, y: chest.y - 7 + pose.shoulderCounter },
      right: { x: chest.x + shoulderW / 2 + skew * 0.18, y: chest.y - 7 - pose.shoulderCounter }
    };
    const hips = {
      left: { x: pelvis.x - hipW / 2, y: pelvis.y },
      right: { x: pelvis.x + hipW / 2, y: pelvis.y }
    };

    const sideCompress = d.view === 'side' ? 0.5 : 1;
    const leftArm = buildArm(shoulders.left, leftSign, leftSign === nearSign ? armSwingNear : armSwingFar, pose, d, sideCompress);
    const rightArm = buildArm(shoulders.right, rightSign, rightSign === nearSign ? armSwingNear : armSwingFar, pose, d, sideCompress);
    applyBackFacingArmOcclusion(leftArm, rightArm, chest, pose, d);
    const leftLeg = buildLeg(hips.left, leftSign, leftSign === nearSign ? strideNear : strideFar, pose, d, sideCompress, leftSign === nearSign ? pose.footLift : pose.footLiftAlt);
    const rightLeg = buildLeg(hips.right, rightSign, rightSign === nearSign ? strideNear : strideFar, pose, d, sideCompress, rightSign === nearSign ? pose.footLift : pose.footLiftAlt);

    // Auto-attack arm posing is now melee-only. Ranged weapon classes keep their
    // normal bow/crossbow hand anchors from the class/paperdoll weapon owner; otherwise
    // the shared melee swing displaces the hand as if it were the weapon tip and creates
    // the reported stretched-arm/white-stick attack regression.
    if (pose.action === 'attack' && !isRangedAutoAttackPose(actor, pose)) {
      const style = String(autoAttackRenderClassId(actor, pose)).toLowerCase();
      const phase = Math.max(0, Math.min(1, Number(pose.autoAttackPhase || (1 - Number(pose.attack || 0)) || 0)));
      const raise = phase < 0.35 ? (1 - Math.pow(1 - phase / 0.35, 3)) : (phase < 0.68 ? 1 : Math.max(0, 1 - Math.pow((phase - 0.68) / 0.32, 0.72)));
      const strike = phase < 0.35 ? 0 : phase < 0.58 ? (1 - Math.pow(1 - ((phase - 0.35) / 0.23), 3)) : 1;
      const impactHold = phase >= 0.58 && phase <= 0.68 ? Math.sin(((phase - 0.58) / 0.10) * Math.PI) : 0;
      const recover = phase > 0.68 ? (1 - Math.pow(1 - ((phase - 0.68) / 0.32), 2)) : 0;
      const heavy = style === 'fighter' || style === 'warden';
      const quick = style === 'rogue' || style === 'bard';
      const controlled = style === 'paladin';
      const hand = nearSign < 0 ? leftArm.hand : rightArm.hand;
      const elbow = nearSign < 0 ? leftArm.elbow : rightArm.elbow;
      const shoulder = nearSign < 0 ? leftArm.shoulder : rightArm.shoulder;
      const offHand = nearSign < 0 ? rightArm.hand : leftArm.hand;
      const windupBack = raise * (1 - strike * 0.48) * (1 - recover * 0.5);
      const lift = (quick ? 15 : heavy ? 28 : controlled ? 23 : 20) * raise * (1 - recover * 0.42);
      const reach = (quick ? 13 : heavy ? 22 : controlled ? 17 : 16) * strike * (1 - recover * 0.28);
      const chop = (quick ? 15 : heavy ? 24 : controlled ? 20 : 18) * strike;
      const follow = impactHold * (quick ? 4 : heavy ? 7 : controlled ? 5 : 5);
      chest.x += nearSign * ((quick ? 3.0 : heavy ? 7.0 : controlled ? 4.8 : 4.2) * strike - (quick ? 2.2 : heavy ? 6.4 : controlled ? 4.4 : 3.8) * windupBack - recover * 1.3);
      chest.y += windupBack * (heavy ? 2.8 : controlled ? 1.9 : quick ? 1.2 : 1.6) + impactHold * (heavy ? 1.6 : 0.7) - raise * (heavy ? 1.4 : 0.6);
      bodyTilt += nearSign * ((quick ? 0.10 : heavy ? 0.19 : controlled ? 0.13 : 0.12) * strike - (quick ? 0.07 : heavy ? 0.15 : controlled ? 0.10 : 0.09) * windupBack - 0.035 * recover);
      shoulder.y -= raise * (quick ? 2 : heavy ? 5 : controlled ? 4 : 3);
      elbow.x += nearSign * (-windupBack * (quick ? 5 : heavy ? 10 : controlled ? 8 : 7) + strike * (quick ? 7 : heavy ? 12 : controlled ? 10 : 9));
      elbow.y += -raise * (quick ? 8 : heavy ? 15 : controlled ? 12 : 11) + strike * (quick ? 9 : heavy ? 15 : controlled ? 12 : 11) + follow * 0.25;
      hand.x += nearSign * (2 - windupBack * (quick ? 6 : heavy ? 13 : controlled ? 10 : 9) + reach + impactHold * (quick ? 2.5 : 5) - recover * (quick ? 4 : 6));
      hand.y += -5 - lift + chop + follow - recover * (quick ? 2 : 3);
      if (style === 'rogue') {
        offHand.x -= nearSign * (9 + strike * 14 - recover * 5);
        offHand.y += 2 + strike * 8 - raise * 5;
      } else if (style === 'bard') {
        offHand.x -= nearSign * (7 + strike * 7);
        offHand.y -= 3 + raise * 7 - strike * 8;
      } else if (style === 'paladin') {
        offHand.x -= nearSign * (3 + strike * 2);
        offHand.y += raise * 1.0 + impactHold * 1.5;
      } else {
        offHand.x -= nearSign * (5 + strike * 7);
        offHand.y += strike * 3 - raise * 2.5;
      }
      clampAttackArmProportions(nearSign < 0 ? leftArm : rightArm, style);
      clampAttackArmProportions(nearSign < 0 ? rightArm : leftArm, style);
    }
    if (pose.action === 'cast') {
      const style = meditationClassId(actor);
      const nearArm = nearSign < 0 ? leftArm : rightArm;
      const farArm = nearSign < 0 ? rightArm : leftArm;
      const casterPulse = Math.max(0, Math.min(1, Number(pose.autoAttackPulse || pose.castPulse || 0)));
      if (style === 'necromancer') {
        nearArm.hand.x = chest.x + nearSign * (16 + casterPulse * 4);
        nearArm.hand.y = chest.y - 31 - casterPulse * 8;
        nearArm.elbow.x = chest.x + nearSign * 17;
        nearArm.elbow.y = chest.y - 11;
        farArm.hand.x = chest.x - nearSign * (16 + casterPulse * 3);
        farArm.hand.y = chest.y - 27 - casterPulse * 6;
        farArm.elbow.x = chest.x - nearSign * 17;
        farArm.elbow.y = chest.y - 9;
      } else if (style === 'cleric') {
        nearArm.hand.x = chest.x + nearSign * (9 + pose.handTremor);
        nearArm.hand.y = chest.y - 27 - casterPulse * 8;
        farArm.hand.x = chest.x - nearSign * (8 + pose.handTremor);
        farArm.hand.y = chest.y - 22 - casterPulse * 5;
        nearArm.elbow.x = chest.x + nearSign * 15; nearArm.elbow.y = chest.y - 7;
        farArm.elbow.x = chest.x - nearSign * 14; farArm.elbow.y = chest.y - 5;
      } else if (style === 'druid') {
        nearArm.hand.x = chest.x + nearSign * (18 + casterPulse * 7);
        nearArm.hand.y = chest.y - 14 - casterPulse * 5;
        farArm.hand.x = chest.x - nearSign * (12 + casterPulse * 4);
        farArm.hand.y = chest.y - 2 + casterPulse * 3;
        nearArm.elbow.x = chest.x + nearSign * 18; nearArm.elbow.y = chest.y - 2;
        farArm.elbow.x = chest.x - nearSign * 14; farArm.elbow.y = chest.y + 4;
      } else if (style === 'summoner') {
        nearArm.hand.x = chest.x + nearSign * (17 + casterPulse * 6);
        nearArm.hand.y = chest.y - 22 - casterPulse * 7;
        farArm.hand.x = chest.x - nearSign * (15 + casterPulse * 3);
        farArm.hand.y = chest.y - 5 + casterPulse * 2;
        nearArm.elbow.x = chest.x + nearSign * 19; nearArm.elbow.y = chest.y - 7;
        farArm.elbow.x = chest.x - nearSign * 16; farArm.elbow.y = chest.y + 2;
      } else {
        nearArm.hand.x = chest.x + nearSign * (18 + pose.handTremor + casterPulse * 5);
        nearArm.hand.y = chest.y - 24 - casterPulse * 9;
        nearArm.elbow.x = chest.x + nearSign * 20;
        nearArm.elbow.y = chest.y - 9;
        farArm.hand.x = chest.x - nearSign * (13 + casterPulse * 3);
        farArm.hand.y = chest.y - 10 + casterPulse * 2;
        farArm.elbow.x = chest.x - nearSign * 15;
        farArm.elbow.y = chest.y - 1;
      }
    }
    if (pose.action === 'fishing') {
      const source = actor.sourceEntity || actor;
      const action = String(source.fishingAction || actor.fishingAction || 'waiting');
      const castPct = action === 'casting' ? Math.max(0, Math.min(1, 1 - Number(source.fishingCastTimer || actor.fishingCastTimer || 0) / 0.62)) : 1;
      const reel = action === 'reeling' ? Math.sin((pose.t || 0) * 15) : 0;
      const nearArm = nearSign < 0 ? leftArm : rightArm;
      const farArm = nearSign < 0 ? rightArm : leftArm;
      nearArm.elbow.x = chest.x + nearSign * (17 + castPct * 4);
      nearArm.elbow.y = chest.y + 5 - castPct * 4;
      nearArm.hand.x = chest.x + nearSign * (24 + castPct * 4);
      nearArm.hand.y = chest.y + 22 - castPct * 10 + reel * 1.2;
      farArm.elbow.x = chest.x + nearSign * 5;
      farArm.elbow.y = chest.y + 10;
      farArm.hand.x = chest.x + nearSign * (10 + castPct * 2);
      farArm.hand.y = chest.y + 25 - castPct * 5 + reel * 0.8;
    }

    if (pose.action === 'gathering') {
      const source = actor.sourceEntity || actor;
      const progress = Math.max(0, Math.min(1, Number(pose.gatherProgress || 0)));
      const kind = String(source.gatheringKind || actor.gatheringKind || '').toLowerCase();
      const nearArm = nearSign < 0 ? leftArm : rightArm;
      const farArm = nearSign < 0 ? rightArm : leftArm;
      if (kind !== 'mining' && kind !== 'fishing') {
        const complete = Math.max(0, Math.min(1, Number(pose.gatherCompleteHold || 0)));
        const cut = Math.max(0, Math.min(1, Number(pose.gatherCutPhase || 0)));
        const impact = Math.max(0, Math.min(1, Number(pose.gatherCutImpact || 0)));
        const reachY = 11 - complete * 18;
        const gatherX = nearSign * (12 + progress * 4 + cut * 2);
        const gatherY = 4 + impact * 2;

        nearArm.elbow.x = chest.x + nearSign * (12 + cut * 4);
        nearArm.elbow.y = chest.y + 21 + impact * 2;
        nearArm.hand.x = complete > 0 ? chest.x + nearSign * (14 + complete * 4) : gatherX + nearSign * (2 + cut * 4);
        nearArm.hand.y = complete > 0 ? reachY : gatherY;
        farArm.elbow.x = chest.x - nearSign * (5 + progress * 2);
        farArm.elbow.y = chest.y + 24;
        farArm.hand.x = complete > 0 ? chest.x - nearSign * 4 : gatherX - nearSign * (7 + impact * 2);
        farArm.hand.y = complete > 0 ? reachY + 2 : gatherY + 3 - cut * 2;

        const nearLeg = nearSign < 0 ? leftLeg : rightLeg;
        const farLeg = nearSign < 0 ? rightLeg : leftLeg;
        nearLeg.knee.x = nearLeg.hip.x + nearSign * 5;
        nearLeg.knee.y = 8;
        nearLeg.foot.x = nearLeg.hip.x + nearSign * 18;
        nearLeg.foot.y = 18;
        farLeg.knee.x = farLeg.hip.x - nearSign * 9;
        farLeg.knee.y = 6;
        farLeg.foot.x = farLeg.hip.x - nearSign * 20;
        farLeg.foot.y = 9;
      } else if (kind === 'mining') {
        // V0.14.47: mining owns a real pickaxe-swing body pose instead of the generic herb-harvest reach.
        const cycle = ((pose.t || 0) * 1.85) % 1;
        const windup = Math.sin(cycle * Math.PI);
        const impact = cycle > 0.54 && cycle < 0.72 ? Math.sin(((cycle - 0.54) / 0.18) * Math.PI) : 0;
        const lift = 1 - Math.min(1, cycle / 0.58);
        const down = cycle >= 0.44 ? Math.min(1, (cycle - 0.44) / 0.34) : 0;
        nearArm.elbow.x = chest.x + nearSign * (16 + windup * 6 - down * 5);
        nearArm.elbow.y = chest.y - 2 + lift * -11 + down * 21;
        nearArm.hand.x = chest.x + nearSign * (20 + windup * 10 + down * 6);
        nearArm.hand.y = chest.y - 18 + lift * -12 + down * 51 + impact * 3;
        farArm.elbow.x = chest.x - nearSign * (10 + windup * 2);
        farArm.elbow.y = chest.y + 7 + down * 9;
        farArm.hand.x = chest.x - nearSign * (11 - down * 9);
        farArm.hand.y = chest.y - 7 + down * 38 + impact * 2;
      } else if (kind === 'fishing') {
        // Fishing pose is owned above by the fishing action branch. Keep this path inert.
      }
    }

    if (pose.action === 'dance') {
      const style = meditationClassId(actor);
      const dance = Math.sin((pose.danceCycle || 0) * TAU);
      const bounce = Math.abs(Math.cos((pose.danceCycle || 0) * TAU));
      const nearArm = nearSign < 0 ? leftArm : rightArm;
      const farArm = nearSign < 0 ? rightArm : leftArm;
      const nearLeg = nearSign < 0 ? leftLeg : rightLeg;
      const farLeg = nearSign < 0 ? rightLeg : leftLeg;
      pelvis.y -= bounce * 2.0;
      chest.x += side * dance * (style === 'rogue' ? 6 : 3.2);
      chest.y -= bounce * 2.4;
      head.x += side * dance * 2.5;
      head.y -= bounce * 1.4;
      head.top -= bounce * 1.4;
      head.bottom -= bounce * 1.4;
      bodyTilt += side * dance * 0.055;

      if (style === 'fighter') {
        nearArm.elbow.x = chest.x + nearSign * (18 + bounce * 5); nearArm.elbow.y = chest.y - 5 - bounce * 10;
        nearArm.hand.x = chest.x + nearSign * (24 + bounce * 6); nearArm.hand.y = chest.y - 21 - bounce * 8;
        farArm.elbow.x = chest.x - nearSign * (15 + bounce * 3); farArm.elbow.y = chest.y + 4 + dance * 4;
        farArm.hand.x = chest.x - nearSign * (20 + bounce * 4); farArm.hand.y = chest.y + 20 + dance * 5;
      } else if (style === 'rogue') {
        chest.y += 4; head.y += 2; head.top += 2; head.bottom += 2;
        nearArm.hand.x = chest.x + nearSign * (30 + dance * 7); nearArm.hand.y = chest.y + 8 - bounce * 9;
        farArm.hand.x = chest.x - nearSign * (24 - dance * 4); farArm.hand.y = chest.y + 19 + bounce * 3;
      } else if (style === 'cleric') {
        nearArm.hand.x = chest.x + nearSign * (9 + dance * 3); nearArm.hand.y = chest.y - 21 + bounce * 5;
        farArm.hand.x = chest.x - nearSign * (9 - dance * 3); farArm.hand.y = chest.y - 21 - bounce * 5;
      } else if (style === 'enchanter') {
        pelvis.y -= 5 + bounce * 2; chest.y -= 5 + bounce * 2; head.y -= 5; head.top -= 5; head.bottom -= 5;
        nearArm.hand.x = chest.x + nearSign * (27 + dance * 5); nearArm.hand.y = chest.y - 19 + dance * 7;
        farArm.hand.x = chest.x - nearSign * (27 - dance * 5); farArm.hand.y = chest.y - 19 - dance * 7;
      } else if (style === 'summoner') {
        nearArm.hand.x = chest.x + nearSign * (22 + dance * 4); nearArm.hand.y = chest.y - 14 - bounce * 7;
        farArm.hand.x = chest.x - nearSign * (22 - dance * 4); farArm.hand.y = chest.y - 5 + bounce * 5;
      } else if (style === 'necromancer') {
        chest.y += 2 + dance * 1.2; head.x -= side * dance * 1.5;
        nearArm.hand.x = chest.x + nearSign * (17 + bounce * 4); nearArm.hand.y = chest.y + 24 + dance * 3;
        farArm.hand.x = chest.x - nearSign * (20 + bounce * 5); farArm.hand.y = chest.y - 8 - bounce * 5;
      } else if (style === 'bard') {
        nearArm.hand.x = chest.x + nearSign * (20 + dance * 5); nearArm.hand.y = chest.y - 2 - bounce * 8;
        farArm.hand.x = chest.x - nearSign * (16 - dance * 3); farArm.hand.y = chest.y + 15 + dance * 3;
      } else if (style === 'druid') {
        chest.x += side * dance * 1.5;
        nearArm.hand.x = chest.x + nearSign * (25 + dance * 4); nearArm.hand.y = chest.y - 11 + dance * 8;
        farArm.hand.x = chest.x - nearSign * (25 - dance * 4); farArm.hand.y = chest.y - 11 - dance * 8;
      }
      nearLeg.knee.y += bounce * 3; nearLeg.foot.y -= bounce * 4;
      farLeg.knee.y += Math.max(0, -dance) * 2; farLeg.foot.x -= nearSign * dance * 4;
    }

    const anchors = {
      root, pelvis, chest, neck, head,
      shoulders, hips,
      arms: { left: leftArm, right: rightArm, near: nearSign < 0 ? leftArm : rightArm, far: nearSign < 0 ? rightArm : leftArm },
      legs: { left: leftLeg, right: rightLeg, near: nearSign < 0 ? leftLeg : rightLeg, far: nearSign < 0 ? rightLeg : leftLeg },
      hair: { x: head.x, y: head.y - 9 },
      face: { x: head.x + d.faceOffsetX, y: head.y + 2 },
      back: { x: chest.x - (d.capeSide || 0) * 5, y: chest.y + 7 },
      cape: { x: chest.x - (d.capeSide || 0) * 7, y: chest.y + 7 + pose.capeSway * 0.2 },
      mainHand: nearSign < 0 ? leftArm.hand : rightArm.hand,
      offHand: nearSign < 0 ? rightArm.hand : leftArm.hand,
      chestArmor: { x: chest.x, y: chest.y + 7 },
      belt: { x: pelvis.x, y: pelvis.y - 12 },
      sash: { x: chest.x, y: chest.y + 7 },
      instrument: { x: chest.x - nearSign * 19, y: chest.y + 8, side: -nearSign, layer: d.backVisible ? 'back' : 'front' },
      ground: { x: 0, y: 0 },
      direction: d,
      bodyTilt,
      collapseRot,
      bodyDrop
    };

    return { actor, pose, dir: d, anchors, options, rowProfile: getRowLayerProfile(d) };
  }

  function buildSittingEmoteRig(actor, pose, d, base) {
    const style = meditationClassId(actor);
    const side = d.side || d.nearSide || 1;
    const nearSign = d.nearSide || 1;
    const loop = Number(pose.sitCycle || 0);
    const sway = Math.sin(loop * TAU) * 0.7;
    const pulse = Number(pose.emotePulse || 0);
    const lift = style === 'enchanter' ? -7 - pulse * 2.2 : 0;

    const pelvis = { x: 0, y: 3 + lift };
    const chest = { x: side * sway * (style === 'rogue' ? 1.6 : 0.8), y: -34 + lift + sway * 0.2 };
    const neck = { x: chest.x + d.headTurn * 0.07, y: -53 + lift };
    const head = {
      x: chest.x + d.headTurn * 0.35,
      y: -67 + lift + sway * 0.25,
      rx: 11.2 * (d.headScaleX || 1),
      ry: 13.2,
      top: -81 + lift + sway * 0.25,
      bottom: -54 + lift + sway * 0.25
    };

    const shoulderW = 25 * (d.shoulderScale || 1);
    const hipW = 16 * (d.torsoScaleX || 1);
    const shoulders = {
      left: { x: chest.x - shoulderW / 2, y: chest.y - 6 },
      right: { x: chest.x + shoulderW / 2, y: chest.y - 6 }
    };
    const hips = {
      left: { x: pelvis.x - hipW / 2, y: pelvis.y + 1 },
      right: { x: pelvis.x + hipW / 2, y: pelvis.y + 1 }
    };
    const leftArm = { shoulder: shoulders.left, elbow: { x: chest.x - 17, y: chest.y + 12 }, hand: { x: -17, y: -2 + lift }, sign: -1, emoteStyle: style };
    const rightArm = { shoulder: shoulders.right, elbow: { x: chest.x + 17, y: chest.y + 12 }, hand: { x: 17, y: -2 + lift }, sign: 1, emoteStyle: style };
    const leftLeg = { hip: hips.left, knee: { x: -21, y: 7 + lift }, foot: { x: -30, y: 18 + lift }, sign: -1, sitting: true, emoteStyle: style };
    const rightLeg = { hip: hips.right, knee: { x: 21, y: 8 + lift }, foot: { x: 30, y: 19 + lift }, sign: 1, sitting: true, emoteStyle: style };

    if (style === 'fighter') {
      leftLeg.knee = { x: -18, y: 1 }; leftLeg.foot = { x: -25, y: 15 };
      rightLeg.knee = { x: 14, y: -8 }; rightLeg.foot = { x: 22, y: 17 };
      rightArm.hand = { x: 19, y: -8 }; leftArm.hand = { x: -18, y: 6 };
    } else if (style === 'rogue') {
      pelvis.y += 6; chest.y += 7; neck.y += 6; head.y += 6; head.top += 6; head.bottom += 6;
      leftLeg.foot = { x: -20, y: 16 }; rightLeg.foot = { x: 24, y: 9 };
      leftArm.hand = { x: -7, y: 4 }; rightArm.hand = { x: 20, y: 2 };
    } else if (style === 'cleric') {
      leftArm.hand = { x: -8, y: -12 }; rightArm.hand = { x: 8, y: -12 };
    } else if (style === 'enchanter') {
      leftLeg.foot = { x: -18, y: 8 + lift }; rightLeg.foot = { x: 18, y: 8 + lift };
      leftArm.hand = { x: -24, y: -16 + lift }; rightArm.hand = { x: 24, y: -16 + lift };
    } else if (style === 'summoner') {
      leftArm.hand = { x: -20, y: -6 }; rightArm.hand = { x: 20, y: -6 };
    } else if (style === 'necromancer') {
      chest.y += 5; head.y += 4; head.top += 4; head.bottom += 4;
      leftArm.hand = { x: -14, y: 5 }; rightArm.hand = { x: 13, y: 7 };
    } else if (style === 'bard') {
      leftArm.hand = { x: -18, y: -4 }; rightArm.hand = { x: 16, y: -3 };
    } else if (style === 'druid') {
      leftLeg.foot = { x: -24, y: 17 }; rightLeg.foot = { x: 24, y: 17 };
      leftArm.hand = { x: -15, y: 0 }; rightArm.hand = { x: 15, y: 0 };
    }

    const instrument = style === 'bard'
      ? { x: 0, y: -11 + lift, side: side || 1, layer: 'front', sittingLap: true }
      : { x: chest.x - nearSign * 17, y: chest.y + 10, side: -nearSign, layer: 'front' };
    const anchors = {
      root: base.root || { x: 0, y: 0 }, pelvis, chest, neck, head,
      shoulders, hips,
      arms: { left: leftArm, right: rightArm, near: nearSign < 0 ? leftArm : rightArm, far: nearSign < 0 ? rightArm : leftArm },
      legs: { left: leftLeg, right: rightLeg, near: nearSign < 0 ? leftLeg : rightLeg, far: nearSign < 0 ? rightLeg : leftLeg },
      hair: { x: head.x, y: head.y - 9 },
      face: { x: head.x + d.faceOffsetX, y: head.y + 2 },
      back: { x: chest.x - (d.capeSide || 0) * 5, y: chest.y + 7 },
      cape: { x: chest.x - (d.capeSide || 0) * 7, y: chest.y + 7 + pose.capeSway * 0.12 },
      mainHand: nearSign < 0 ? leftArm.hand : rightArm.hand,
      offHand: nearSign < 0 ? rightArm.hand : leftArm.hand,
      chestArmor: { x: chest.x, y: chest.y + 7 },
      belt: { x: pelvis.x, y: pelvis.y - 12 },
      sash: { x: chest.x, y: chest.y + 7 },
      instrument,
      ground: { x: 0, y: 0 },
      direction: d,
      bodyTilt: style === 'rogue' ? side * 0.08 : style === 'necromancer' ? -side * 0.04 : 0,
      collapseRot: 0,
      bodyDrop: lift,
      emoteStyle: style
    };
    return { actor, pose: { ...pose, emoteStyle: style }, dir: d, anchors, options: {}, rowProfile: getRowLayerProfile(d) };
  }

  // V0.20.69 (Roadmap Item 7.G): the RIDING rig. Built on the same anchor contract as the sitting and
  // swimming rigs, which is what makes every class model - bespoke Paladin/Fighter included - draw a
  // seated rider without fourteen separate edits.
  //
  // The difference from sitting: a seated character folds its legs FORWARD, while a rider's thighs go
  // out across the animal's back and the shins hang straight DOWN its flanks. That silhouette is the
  // whole reason a rider reads as riding rather than standing on top of the mount.
  function buildRidingRig(actor, pose, d, base) {
    const side = d.side || d.nearSide || 1;
    const nearSign = d.nearSide || 1;
    const gait = Number(pose.rideGait || 0);
    const moving = !!pose.rideMoving;
    // Lean forward slightly at speed, the way a rider does.
    const lean = moving ? 1.8 : 0.6;

    // V0.20.73: prefer the camera-projected view published by the renderer. d.view is COMPASS-based
    // and disagrees with what is actually on screen - world 'south' projects to a side view here.
    // V0.20.74: resolved up here because the ARMS need it too, not just the legs.
    const camView = String((actor?.sourceEntity || actor)?._cameraView || '');
    // V0.20.78: `frontOn` is gone - front and back now share one seat, so only side-on differs.
    const sideOn = camView ? camView === 'side' : d.view === 'side';

    const pelvis = { x: 0, y: 2 + gait };
    const chest = { x: side * lean * 0.5, y: -33 + gait + Math.sin(pose.t * 8.5) * 0.5 };
    const neck = { x: chest.x + d.headTurn * 0.07, y: -52 + gait };
    const head = {
      x: chest.x + d.headTurn * 0.35,
      y: -66 + gait,
      rx: 11.2 * (d.headScaleX || 1),
      ry: 13.2,
      top: -80 + gait,
      bottom: -53 + gait
    };

    // V0.20.76: side-on you should see roughly HALF the body, not the full chest with an arm on each
    // edge (reported). V0.20.74 moved both HANDS to the near side but left the torso at full breadth,
    // so the chest still read face-on and the far arm still hung off the far edge. Compressing the
    // shoulder and hip spans is what actually turns the body side-on: it pulls the far shoulder behind
    // the near one so the far arm tucks against the torso instead of framing it. The standing rig
    // already does exactly this via its own `sideCompress`; the riding rig simply never did.
    const sideNarrow = sideOn ? 0.46 : 1;
    const shoulderW = 25 * (d.shoulderScale || 1) * sideNarrow;
    const hipW = 16 * (d.torsoScaleX || 1) * sideNarrow;
    const shoulders = {
      left: { x: chest.x - shoulderW / 2, y: chest.y - 6 },
      right: { x: chest.x + shoulderW / 2, y: chest.y - 6 }
    };
    const hips = {
      left: { x: pelvis.x - hipW / 2, y: pelvis.y + 1 },
      right: { x: pelvis.x + hipW / 2, y: pelvis.y + 1 }
    };
    // Hands forward and low, as though holding reins - and rising a little with the gait.
    const reinY = -8 + gait * 0.5;
    let leftArm, rightArm;
    if (sideOn) {
      // V0.20.74: SIDE-ON, the far arm is across the rider's own body and behind the torso - only the
      // near arm reads. Splaying both left and right made the character look like it was facing the
      // camera while the body was side-on (reported alongside the same problem in the legs).
      const nearArm = { shoulder: shoulders.right, elbow: { x: chest.x + nearSign * 12, y: chest.y + 14 }, hand: { x: nearSign * 13, y: reinY }, sign: nearSign };
      const farArm = { shoulder: shoulders.left, elbow: { x: chest.x + nearSign * 5, y: chest.y + 12 }, hand: { x: nearSign * 5, y: reinY - 2 }, sign: -nearSign, farSideArm: true };
      leftArm = nearSign < 0 ? nearArm : farArm;
      rightArm = nearSign < 0 ? farArm : nearArm;
    } else {
      leftArm = { shoulder: shoulders.left, elbow: { x: chest.x - 15, y: chest.y + 14 }, hand: { x: -11 + side * 3, y: reinY }, sign: -1 };
      rightArm = { shoulder: shoulders.right, elbow: { x: chest.x + 15, y: chest.y + 14 }, hand: { x: 11 + side * 3, y: reinY }, sign: 1 };
    }
    // Thigh out across the barrel, shin hanging down the flank. `riding` lets leg detail renderers
    // that care (boots, wraps) know they are drawing a bent leg rather than a standing one.
    //
    // V0.20.72: facing the CAMERA, the animal's head sits between the rider's knees, and the renderer
    // cuts that area out of the rider so the head shows. The legs must therefore straddle WIDER than
    // the head, or they would be inside the cut-out and vanish with it. Side and rear views keep the
    // narrower straddle, where no cut is made and a wide splay would just look bow-legged.

    let leftLeg, rightLeg;
    if (sideOn) {
      // V0.20.73: SIDE-ON, a rider shows ONE leg. The far leg is on the other side of the animal and
      // is hidden by its body. Drawing both splayed left and right read as sitting sideways on the
      // beast (reported). Both legs are therefore placed on the NEAR side, the far one tucked slightly
      // behind and higher so it reads as the far leg glimpsed past the barrel rather than a second
      // leg sticking out the wrong way.
      const nearX = nearSign * 9;
      const farX = nearSign * 3;
      const nearLeg = { hip: hips.right, knee: { x: nearX + nearSign * 5, y: 11 + gait }, foot: { x: nearX + nearSign * 7, y: 29 + gait }, sign: nearSign, riding: true };
      const farLeg = { hip: hips.left, knee: { x: farX + nearSign * 4, y: 8 + gait }, foot: { x: farX + nearSign * 5, y: 25 + gait }, sign: -nearSign, riding: true, farSideLeg: true };
      leftLeg = nearSign < 0 ? nearLeg : farLeg;
      rightLeg = nearSign < 0 ? farLeg : nearLeg;
    } else {
      // The animal's own mass sits between the rider's knees and is redrawn over them: its HEAD from
      // the front, its TAIL and hindquarters from behind. Either way the legs must straddle WIDER than
      // that mass, or they sit inside the redrawn band and vanish under it.
      //
      // V0.20.78: the rear seat now uses the SAME splay as the front (reported: "their legs should have
      // the same position as the front view"). It was narrower - 17/19 - back when the rear band was a
      // shallow 14px strip that stopped at the knee; now that the band runs down past the legs so the
      // tail can lap them, a narrow seat would be swallowed by it.
      const kneeOut = 27;
      const footOut = 31;
      leftLeg = { hip: hips.left, knee: { x: -kneeOut, y: 10 + gait }, foot: { x: -footOut, y: 28 + gait }, sign: -1, riding: true };
      rightLeg = { hip: hips.right, knee: { x: kneeOut, y: 10 + gait }, foot: { x: footOut, y: 28 + gait }, sign: 1, riding: true };
    }

    const anchors = {
      root: base.root || { x: 0, y: 0 }, pelvis, chest, neck, head,
      shoulders, hips,
      arms: { left: leftArm, right: rightArm, near: nearSign < 0 ? leftArm : rightArm, far: nearSign < 0 ? rightArm : leftArm },
      legs: { left: leftLeg, right: rightLeg, near: nearSign < 0 ? leftLeg : rightLeg, far: nearSign < 0 ? rightLeg : leftLeg },
      hair: { x: head.x, y: head.y - 9 },
      face: { x: head.x + d.faceOffsetX, y: head.y + 2 },
      back: { x: chest.x - (d.capeSide || 0) * 5, y: chest.y + 7 },
      cape: { x: chest.x - (d.capeSide || 0) * 7, y: chest.y + 7 + (pose.capeSway || 0) * 0.18 },
      mainHand: nearSign < 0 ? leftArm.hand : rightArm.hand,
      offHand: nearSign < 0 ? rightArm.hand : leftArm.hand,
      chestArmor: { x: chest.x, y: chest.y + 7 },
      belt: { x: pelvis.x, y: pelvis.y - 12 },
      sash: { x: chest.x, y: chest.y + 7 },
      instrument: { x: chest.x - nearSign * 17, y: chest.y + 10, side: -nearSign, layer: 'front' },
      ground: { x: 0, y: 0 },
      direction: d,
      bodyTilt: side * (moving ? 0.05 : 0.02),
      collapseRot: 0,
      bodyDrop: 0,
      riding: true
    };
    return { actor, pose, dir: d, anchors, options: {}, rowProfile: getRowLayerProfile(d) };
  }

  function buildSwimmingRig(actor, pose, d, base) {
    const style = meditationClassId(actor);
    const side = d.side || d.nearSide || 1;
    const nearSign = d.nearSide || 1;
    const swimMove = Math.max(0, Math.min(1, Number(pose.swimMovement || 0)));
    const moving = swimMove > 0.10;
    const stroke = Number(pose.swimStroke || 0);
    const kick = Number(pose.swimKick || 0);
    const bob = Number(pose.swimBob || 0);
    const classPulse = Math.sin((pose.t || 0) * 2.2 + (pose.seed || 0));
    const submerge = Math.max(0.42, Math.min(0.68, Number(pose.swimSubmerge || 0.52)));

    const pelvis = { x: base.pelvis.x + side * swimMove * 1.4, y: -1 + bob * 0.75 + submerge * 9 };
    const chest = { x: base.chest.x + side * swimMove * 2.5, y: -37 + bob * 0.95 + submerge * 5 };
    const neck = { x: chest.x + d.headTurn * 0.10, y: -56 + bob * 0.65 + submerge * 2.5 };
    const head = {
      ...base.head,
      x: chest.x + d.headTurn * 0.42,
      y: -70 + bob * 0.65 + submerge * 1.3,
      top: -84 + bob * 0.65 + submerge * 1.3,
      bottom: -56 + bob * 0.65 + submerge * 1.3
    };

    const shoulderW = 27 * (d.shoulderScale || 1);
    const hipW = 13 * (d.torsoScaleX || 1);
    const shoulders = {
      left: { x: chest.x - shoulderW / 2 + d.torsoSkew * 0.12, y: chest.y - 5 - stroke * 0.8 },
      right: { x: chest.x + shoulderW / 2 + d.torsoSkew * 0.12, y: chest.y - 5 + stroke * 0.8 }
    };
    const hips = {
      left: { x: pelvis.x - hipW / 2, y: pelvis.y + 2 },
      right: { x: pelvis.x + hipW / 2, y: pelvis.y + 2 }
    };

    let leftArm = {
      shoulder: shoulders.left,
      elbow: { x: chest.x - 23 - nearSign * swimMove * 2, y: chest.y + 3 + stroke * (moving ? 7 : 2) },
      hand: { x: chest.x - 30 - nearSign * swimMove * 4, y: -13 + stroke * (moving ? 8 : 2) + bob * 0.5 },
      sign: -1,
      swimming: true
    };
    let rightArm = {
      shoulder: shoulders.right,
      elbow: { x: chest.x + 23 - nearSign * swimMove * 2, y: chest.y + 3 - stroke * (moving ? 7 : 2) },
      hand: { x: chest.x + 30 - nearSign * swimMove * 4, y: -13 - stroke * (moving ? 8 : 2) + bob * 0.5 },
      sign: 1,
      swimming: true
    };

    if (style === 'fighter') {
      // Fighter: heavy breaststroke, broad shoulders, hard paddles.
      leftArm.elbow.y += 2; rightArm.elbow.y += 2;
      leftArm.hand.x -= 5 + swimMove * 3; rightArm.hand.x += 5 + swimMove * 3;
      chest.y += moving ? -1 : 1;
    } else if (style === 'rogue') {
      // Rogue: low quiet sidestroke with hands close to the surface.
      chest.y += 3; head.y += 2; head.top += 2; head.bottom += 2;
      leftArm.hand.y += 5; rightArm.hand.y += 5;
      leftArm.hand.x *= 0.82; rightArm.hand.x *= 0.82;
    } else if (style === 'cleric') {
      // Cleric: controlled tread with prayer-palms parting the water.
      leftArm.hand = { x: chest.x - 18 + classPulse, y: -21 + stroke * 2.5 };
      rightArm.hand = { x: chest.x + 18 + classPulse, y: -21 - stroke * 2.5 };
    } else if (style === 'enchanter') {
      // Enchanter: magical float, knees tucked and hands shaping buoyant rings.
      pelvis.y -= 4 + classPulse * 0.8;
      chest.y -= 4 + classPulse * 0.8;
      neck.y -= 4 + classPulse * 0.8;
      head.y -= 4 + classPulse * 0.8; head.top -= 4 + classPulse * 0.8; head.bottom -= 4 + classPulse * 0.8;
      leftArm.hand = { x: chest.x - 24, y: -26 + stroke * 1.5 };
      rightArm.hand = { x: chest.x + 24, y: -26 - stroke * 1.5 };
    } else if (style === 'summoner') {
      // Summoner: ritual buoyancy, both hands pulling a small current circle.
      leftArm.hand = { x: chest.x - 22 + stroke * 2, y: -18 + Math.abs(stroke) * 3 };
      rightArm.hand = { x: chest.x + 22 + stroke * 2, y: -18 + Math.abs(stroke) * 3 };
    } else if (style === 'necromancer') {
      // Necromancer: hunched, eerie tread with hands clawed over the waterline.
      chest.y += 5; neck.y += 5; head.y += 6; head.top += 6; head.bottom += 6;
      leftArm.hand = { x: chest.x - 16 - Math.abs(stroke) * 4, y: -10 + stroke * 2 };
      rightArm.hand = { x: chest.x + 16 + Math.abs(stroke) * 4, y: -10 - stroke * 2 };
    } else if (style === 'druid') {
      // Druid: floating nature-tread with gentle sweeping hands.
      leftArm.hand = { x: chest.x - 26 + stroke * 2, y: -17 + classPulse * 1.2 };
      rightArm.hand = { x: chest.x + 26 + stroke * 2, y: -17 - classPulse * 1.2 };
    } else if (style === 'bard') {
      // Bard: rhythmic side paddle; instrument is kept above the water by the renderer hooks.
      leftArm.hand = { x: chest.x - 24 + stroke * 3, y: -14 + stroke * 2 };
      rightArm.hand = { x: chest.x + 20 + stroke * 2, y: -16 - stroke * 1.7 };
    }

    const leftLeg = {
      hip: hips.left,
      knee: { x: hips.left.x - 7 + side * swimMove * 3, y: 10 + kick * 1.4 },
      foot: { x: hips.left.x - 13 + side * swimMove * 6, y: 21 + kick * 3.2 },
      sign: -1,
      swimming: true
    };
    const rightLeg = {
      hip: hips.right,
      knee: { x: hips.right.x + 7 + side * swimMove * 3, y: 10 - kick * 1.4 },
      foot: { x: hips.right.x + 13 + side * swimMove * 6, y: 21 - kick * 3.2 },
      sign: 1,
      swimming: true
    };

    const anchors = {
      ...base,
      pelvis,
      chest,
      neck,
      head,
      shoulders,
      hips,
      arms: { left: leftArm, right: rightArm, near: d.nearSide < 0 ? leftArm : rightArm, far: d.nearSide < 0 ? rightArm : leftArm },
      legs: { left: leftLeg, right: rightLeg, near: d.nearSide < 0 ? leftLeg : rightLeg, far: d.nearSide < 0 ? rightLeg : leftLeg },
      hair: { x: head.x, y: head.y - 9 },
      face: { x: head.x + d.faceOffsetX * 0.72, y: head.y + 2 },
      back: { x: chest.x - (d.capeSide || 0) * 3, y: chest.y + 7 },
      cape: { x: chest.x - (d.capeSide || 0) * 4, y: chest.y + 8 + pose.capeSway * 0.15 },
      mainHand: d.nearSide < 0 ? leftArm.hand : rightArm.hand,
      offHand: d.nearSide < 0 ? rightArm.hand : leftArm.hand,
      chestArmor: { x: chest.x, y: chest.y + 7 },
      belt: { x: pelvis.x, y: pelvis.y - 10 },
      sash: { x: chest.x, y: chest.y + 7 },
      instrument: { x: chest.x - nearSign * 16, y: chest.y + 11, side: -nearSign, layer: 'front', swimmingStowed: true },
      ground: { x: 0, y: 0 },
      direction: d,
      bodyTilt: side * (moving ? 0.12 : 0.04),
      collapseRot: 0,
      bodyDrop: 0,
      swimmingStyle: style,
      waterlineY: -1 + bob * 0.25,
      swimSubmerge: submerge
    };
    return { actor, pose: { ...pose, swimmingStyle: style }, dir: d, anchors, options: {}, rowProfile: getRowLayerProfile(d) };
  }

  function autoAttackRenderClassId(actor = {}, pose = {}) {
    const raw = String(
      pose.autoAttackVisualClass || actor.className || actor.playerClass || actor.classId || actor.role || actor.type ||
      actor.sourceEntity?.className || actor.sourceEntity?.playerClass || actor.sourceEntity?.classId || ''
    ).toLowerCase().replace(/[\s_\-]/g, '');
    if (raw.includes('assassin')) return 'assassin';
    if (raw.includes('ranger') || raw.includes('hunter') || raw.includes('archer')) return 'ranger';
    if (raw.includes('warden')) return 'warden';
    if (raw.includes('paladin')) return 'paladin';
    if (raw.includes('fighter') || raw.includes('warrior')) return 'fighter';
    if (raw.includes('rogue')) return 'rogue';
    if (raw.includes('bard')) return 'bard';
    return meditationClassId(actor);
  }

  function isRangedAutoAttackPose(actor = {}, pose = {}) {
    const visualType = String(pose.autoAttackVisualType || actor.autoAttackVisualType || '').toLowerCase();
    const visualRole = String(pose.autoAttackVisualRole || actor.autoAttackVisualRole || '').toLowerCase();
    const cls = autoAttackRenderClassId(actor, pose);
    return visualType === 'rangedweapon' || visualRole === 'rangedweapon' || cls === 'ranger' || cls === 'assassin';
  }

  function limitArmSegment(anchor, point, maxDistance) {
    const dx = Number(point.x || 0) - Number(anchor.x || 0);
    const dy = Number(point.y || 0) - Number(anchor.y || 0);
    const len = Math.hypot(dx, dy);
    if (!len || len <= maxDistance) return;
    const ratio = maxDistance / len;
    point.x = anchor.x + dx * ratio;
    point.y = anchor.y + dy * ratio;
  }

  function clampAttackArmProportions(arm, style = '') {
    if (!arm?.shoulder || !arm?.elbow || !arm?.hand) return;
    const cls = String(style || '').toLowerCase();
    const heavy = cls === 'fighter' || cls === 'warden';
    const quick = cls === 'rogue' || cls === 'bard';
    const upper = quick ? 23 : heavy ? 29 : 26;
    const lower = quick ? 29 : heavy ? 35 : 32;
    limitArmSegment(arm.shoulder, arm.elbow, upper);
    limitArmSegment(arm.elbow, arm.hand, lower);
  }

  function meditationClassId(actor = {}) {
    const source = actor.sourceEntity || actor;
    const raw = String(actor.className || actor.playerClass || actor.classId || actor.role || actor.type || source.className || source.playerClass || source.classId || source.role || source.type || '').toLowerCase().replace(/[\s_\-]/g, '');
    const role = String(actor.roleKey || source.roleKey || '').toLowerCase().replace(/[\s_\-]/g, '');
    if (raw.includes('bard')) return 'bard';
    if (raw.includes('druid')) return 'druid';
    if (raw.includes('warden')) return 'warden';
    if (raw.includes('ranger') || raw.includes('hunter') || raw.includes('archer')) return 'ranger';
    if (raw.includes('assassin')) return 'assassin';
    if (raw.includes('wizard') || raw.includes('mage')) return 'wizard';
    if (raw.includes('shaman')) return 'shaman';
    if (raw.includes('fighter') || raw.includes('warrior') || raw.includes('guardian') || raw.includes('tank') || role === 'guardian') return 'fighter';
    if (raw.includes('rogue') || raw.includes('scout') || role === 'scout') return 'rogue';
    if (raw.includes('cleric') || raw.includes('priest') || raw.includes('healer') || role === 'cleric' || role === 'fieldcleric') return 'cleric';
    if (raw.includes('enchanter') || raw.includes('mesmer') || raw.includes('illusion')) return 'enchanter';
    if (raw.includes('summoner') || raw.includes('adept') || role === 'adept') return 'summoner';
    if (raw.includes('necromancer') || raw.includes('necro')) return 'necromancer';
    return 'default';
  }

  function buildMeditationRig(actor, pose, d, base) {
    const style = meditationClassId(actor);
    const side = d.side || d.nearSide || 1;
    const nearSign = d.nearSide || 1;
    const wave = Math.sin((pose.t || 0) * 2.4 + (pose.seed || 0));
    const loop = Number(pose.meditateLoop || 0);
    const loopWave = Math.sin(loop * TAU);
    const progressPulse = Math.sin(Number(pose.meditationProgress || 0) * TAU);
    const chest = { ...base.chest };
    const pelvis = { ...base.pelvis };
    const neck = { ...base.neck };
    const head = { ...base.head };

    let leftHand = { x: -15 + side * 2, y: -21 + wave * 0.5 };
    let rightHand = { x: 15 + side * 2, y: -21 - wave * 0.5 };
    let leftElbow = { x: -19, y: -30 };
    let rightElbow = { x: 19, y: -30 };
    let leftKnee = { x: -24, y: 4 };
    let rightKnee = { x: 24, y: 4 };
    let leftFoot = { x: -6, y: 9 };
    let rightFoot = { x: 6, y: 9 };
    let leftHip = { x: pelvis.x - 8, y: pelvis.y };
    let rightHip = { x: pelvis.x + 8, y: pelvis.y };
    let shoulderDrop = 0;
    let lift = 0;
    let instrument = { x: d.backVisible ? 18 * (d.side || 1) : -21 * (d.side || 1 || 1), y: -35, side: d.side || 1, layer: d.backVisible ? 'back' : 'front' };

    if (style === 'bard') {
      // Bard: seated performance meditation. The lute sits in the lap and both hands keep a slow strum loop.
      chest.y -= 1.5;
      head.y -= 1;
      const strum = Math.sin(loop * TAU * 2) * 2.2;
      leftHand = { x: -13 + side * 1.5, y: -17 + strum * 0.35 };
      rightHand = { x: 14 + side * 1.5, y: -13 - strum };
      leftElbow = { x: -21, y: -25 };
      rightElbow = { x: 22, y: -23 };
      leftKnee = { x: -28, y: 5 };
      rightKnee = { x: 28, y: 6 };
      leftFoot = { x: -13, y: 12 };
      rightFoot = { x: 13, y: 12 };
      instrument = { x: 0, y: -13, side: side || 1, layer: 'front', meditationLap: true };
    } else if (style === 'druid') {
      // Druid: exaggerated lotus on conjured earth, hands settled on the knees.
      pelvis.y += 2;
      chest.y += 3 + wave * 0.35;
      neck.y += 1;
      head.y += 1 + wave * 0.28;
      head.top += 1;
      head.bottom += 1;
      leftHand = { x: -25, y: -8 + progressPulse * 0.55 };
      rightHand = { x: 25, y: -8 - progressPulse * 0.55 };
      leftElbow = { x: -27, y: -23 };
      rightElbow = { x: 27, y: -23 };
      leftKnee = { x: -33, y: 7 };
      rightKnee = { x: 33, y: 7 };
      leftFoot = { x: -9, y: 15 };
      rightFoot = { x: 9, y: 15 };
    } else if (style === 'rogue') {
      // Rogue: one-knee shadow crouch, knife hand loose and the off hand touching the smoke ring.
      pelvis.y += 4;
      chest.y += 9;
      neck.y += 10;
      head.y += 11;
      head.top += 11;
      head.bottom += 11;
      shoulderDrop = 6;
      leftHand = { x: -27 + side * 3, y: 0 + loopWave * 0.6 };
      rightHand = { x: 22 + side * 3, y: -10 - loopWave * 0.8 };
      leftElbow = { x: -20, y: -15 };
      rightElbow = { x: 18, y: -20 };
      leftKnee = { x: -25, y: 3 };
      rightKnee = { x: 26, y: 7 };
      leftFoot = { x: -34, y: 13 };
      rightFoot = { x: 8, y: 16 };
    } else if (style === 'cleric') {
      // Cleric: kneeling prayer posture with clasped hands and a raised head.
      pelvis.y += 3;
      chest.y -= 2;
      head.y -= 3;
      head.top -= 3;
      head.bottom -= 3;
      leftHand = { x: -4 + side, y: -31 + wave * 0.3 };
      rightHand = { x: 4 + side, y: -31 - wave * 0.3 };
      leftElbow = { x: -16, y: -25 };
      rightElbow = { x: 16, y: -25 };
      leftKnee = { x: -12, y: 2 };
      rightKnee = { x: 13, y: 2 };
      leftFoot = { x: -23, y: 13 };
      rightFoot = { x: 22, y: 13 };
    } else if (style === 'enchanter') {
      // Enchanter: upright levitation, one palm offering power while the other writes glyphs.
      lift = -13 - Math.sin((pose.t || 0) * 1.7 + (pose.seed || 0)) * 2.0;
      pelvis.y += lift;
      chest.y += lift - 7;
      neck.y += lift - 6;
      head.y += lift - 6;
      head.top += lift - 6;
      head.bottom += lift - 6;
      leftHand = { x: -30 + side * 3, y: -43 + loopWave * 1.3 + lift * 0.12 };
      rightHand = { x: 32 + side * 2, y: -22 - loopWave * 1.0 + lift * 0.18 };
      leftElbow = { x: -25, y: -44 + lift * 0.14 };
      rightElbow = { x: 23, y: -33 + lift * 0.14 };
      leftKnee = { x: -15, y: 0 + lift * 0.45 };
      rightKnee = { x: 16, y: 0 + lift * 0.45 };
      leftFoot = { x: -7, y: 11 + lift * 0.45 };
      rightFoot = { x: 7, y: 11 + lift * 0.45 };
    } else if (style === 'summoner') {
      // Summoner: kneeling over an open tome, one hand on the page and one hand tracing a sigil.
      pelvis.y += 4;
      chest.y += 2;
      leftHand = { x: -14 + side * 1.5, y: 0 + Math.sin(loop * TAU) * 0.6 };
      rightHand = { x: 25 + side * 2, y: -30 - Math.sin(loop * TAU) * 2.0 };
      leftElbow = { x: -22, y: -17 };
      rightElbow = { x: 22, y: -32 };
      leftKnee = { x: -22, y: 4 };
      rightKnee = { x: 26, y: 7 };
      leftFoot = { x: -29, y: 15 };
      rightFoot = { x: 8, y: 15 };
    } else if (style === 'necromancer') {
      // Necromancer: standing death rite, head tilted back and both hands raised into soul smoke.
      pelvis.y -= 2;
      chest.y -= 9;
      neck.y -= 10;
      head.y -= 11;
      head.top -= 11;
      head.bottom -= 11;
      shoulderDrop = -2;
      leftHand = { x: -23 + side * 2, y: -62 + wave * 1.2 };
      rightHand = { x: 23 + side * 2, y: -60 - wave * 1.2 };
      leftElbow = { x: -28, y: -46 };
      rightElbow = { x: 28, y: -46 };
      leftKnee = { x: -12, y: 16 };
      rightKnee = { x: 12, y: 16 };
      leftFoot = { x: -18, y: 33 };
      rightFoot = { x: 18, y: 33 };
    } else if (style === 'fighter') {
      // Fighter: one-knee weapon oath, head bowed beside a blade stabbed into the earth.
      pelvis.y += 4;
      chest.y += 5;
      neck.y += 4;
      head.y += 5;
      head.top += 5;
      head.bottom += 5;
      leftHand = { x: -9 + side * 3, y: -7 };
      rightHand = { x: 18 + side * 3, y: -16 };
      leftElbow = { x: -18, y: -19 };
      rightElbow = { x: 22, y: -23 };
      leftKnee = { x: -18, y: 3 };
      rightKnee = { x: 26, y: 8 };
      leftFoot = { x: -28, y: 15 };
      rightFoot = { x: 5, y: 16 };
    }

    const leftArm = { shoulder: { x: chest.x - 13, y: chest.y - 3 + shoulderDrop }, elbow: leftElbow, hand: leftHand, meditationStyle: style };
    const rightArm = { shoulder: { x: chest.x + 13, y: chest.y - 3 + shoulderDrop }, elbow: rightElbow, hand: rightHand, meditationStyle: style };
    const leftLeg = { hip: leftHip, knee: leftKnee, foot: leftFoot, meditating: true, meditationStyle: style };
    const rightLeg = { hip: rightHip, knee: rightKnee, foot: rightFoot, meditating: true, meditationStyle: style };

    const anchors = {
      ...base,
      pelvis,
      chest,
      neck,
      head,
      shoulders: { left: leftArm.shoulder, right: rightArm.shoulder },
      hips: { left: leftLeg.hip, right: rightLeg.hip },
      arms: { left: leftArm, right: rightArm, near: d.nearSide < 0 ? leftArm : rightArm, far: d.nearSide < 0 ? rightArm : leftArm },
      legs: { left: leftLeg, right: rightLeg, near: d.nearSide < 0 ? leftLeg : rightLeg, far: d.nearSide < 0 ? rightLeg : leftLeg },
      hair: { x: head.x, y: head.y - 9 },
      face: { x: head.x + d.faceOffsetX * 0.45, y: head.y + 2 },
      back: { x: chest.x, y: chest.y + 9 },
      cape: { x: chest.x, y: chest.y + 8 },
      mainHand: d.nearSide < 0 ? leftHand : rightHand,
      offHand: d.nearSide < 0 ? rightHand : leftHand,
      chestArmor: { x: chest.x, y: chest.y + 8 },
      belt: { x: pelvis.x, y: pelvis.y - 14 },
      sash: { x: chest.x, y: chest.y + 5 },
      instrument,
      ground: { x: 0, y: 0 },
      direction: d,
      bodyTilt: style === 'rogue' ? side * 0.09 : style === 'necromancer' ? -side * 0.04 : 0,
      collapseRot: 0,
      bodyDrop: lift,
      meditationStyle: style
    };
    return { actor, pose: { ...pose, meditationStyle: style }, dir: d, anchors, rowProfile: getRowLayerProfile(d) };
  }

  function applyBackFacingArmOcclusion(leftArm, rightArm, chest, pose, d) {
    const mode = d.armOcclusion || 'front';
    if (!d.backVisible || mode === 'front') return;

    const nearArm = d.nearSide < 0 ? leftArm : rightArm;
    const farArm = d.nearSide < 0 ? rightArm : leftArm;
    const tuckArm = (arm, strength, sideBias = 0, elbowDrop = 16) => {
      const sx = arm.shoulder.x;
      arm.elbow.x = sx * (1 - strength) + chest.x * strength + sideBias;
      arm.elbow.y = arm.shoulder.y + elbowDrop + Math.abs(pose.armSwing || 0) * 0.05;
      arm.hand.x = arm.elbow.x * 0.84 + chest.x * 0.16;
      arm.hand.y = arm.elbow.y + 8;
      arm.occludedByBack = true;
      arm.showHand = false;
      arm.showForearm = false;
    };

    if (mode === 'fullBackBody') {
      tuckArm(leftArm, 0.92, -1.2, 12);
      tuckArm(rightArm, 0.92, 1.2, 12);
      leftArm.hiddenBehindTorso = true;
      rightArm.hiddenBehindTorso = true;
      leftArm.visibleBackSegment = false;
      rightArm.visibleBackSegment = false;
      return;
    }

    // Back diagonals: fully hide the near arm and only let the far shoulder/upper-arm
    // silhouette peek from behind the torso. Hands stay hidden.
    tuckArm(nearArm, 0.95, 0, 12);
    nearArm.hiddenBehindTorso = true;
    nearArm.visibleBackSegment = false;
    tuckArm(farArm, 0.60, (d.side || 0) * -2.2, 13);
    farArm.visibleBackSegment = true;
    farArm.hiddenBehindTorso = false;
  }

  function shouldUseBackArmLayering(rig) {
    return !!getRowLayerProfile(rig.dir).backArmLayering && rig.pose.action !== 'meditate';
  }

  function buildArm(shoulder, sign, swing, pose, d, sideCompress) {
    const sideBias = d.side || 0;
    const elbow = {
      x: shoulder.x + sign * (8 * sideCompress) + sideBias * 2,
      y: shoulder.y + 20 + swing * 0.25
    };
    const hand = {
      x: shoulder.x + sign * (13 * sideCompress) - swing * 0.22 + d.handBiasX * 0.18,
      y: shoulder.y + 39 + Math.abs(swing) * 0.35
    };
    return { shoulder, elbow, hand, sign };
  }

  function buildLeg(hip, sign, swing, pose, d, sideCompress, lift) {
    const knee = {
      x: hip.x + sign * (5 * sideCompress) + swing * 0.2,
      y: hip.y + 23 - lift * 0.6
    };
    const foot = {
      x: hip.x + sign * (7 * sideCompress) + swing * 0.55,
      y: hip.y + 48 - lift
    };
    return { hip, knee, foot, sign, lift };
  }


  function swimClipInfo(rig) {
    const pose = rig?.pose || {};
    if (String(pose.action || '').toLowerCase() !== 'swim') return null;
    const anchors = rig?.anchors || {};
    const blend = clamp(Number(pose.swimBlend ?? rig?.actor?.swimBlend ?? 1), 0, 1);
    const eased = 1 - Math.pow(1 - blend, 2);
    const waterlineY = Number.isFinite(Number(anchors.waterlineY)) ? Number(anchors.waterlineY) : -1;
    const leftFoot = Number(anchors.legs?.left?.foot?.y);
    const rightFoot = Number(anchors.legs?.right?.foot?.y);
    const lowestFoot = Math.max(Number.isFinite(leftFoot) ? leftFoot : 56, Number.isFinite(rightFoot) ? rightFoot : 56);
    const transitionStart = Math.max(34, lowestFoot + 8);
    const clipY = transitionStart + (waterlineY + 0.5 - transitionStart) * eased;
    return { clipY, waterlineY, blend };
  }

  function drawWithSwimmingClip(ctx, rig, drawBody) {
    const clip = swimClipInfo(rig);
    if (!clip || clip.blend <= 0.01) {
      drawBody();
      return;
    }
    ctx.save();
    ctx.beginPath();
    // Canvas 2D equivalent of a water-surface clipping plane: the model body is
    // rendered only above the animated waterline. Nameplates and health bars are
    // drawn by EntityRenderer later, outside this local model clip.
    ctx.rect(-180, -220, 360, 220 + clip.clipY);
    ctx.clip();
    drawBody();
    ctx.restore();
  }

  function drawPaperdollLayer(ctx, rig, layer, arg = null) {
    const renderer = DR.render?.PaperdollEquipmentRenderer;
    if (!renderer?.drawBodyLayer || !renderer.hasAny?.(rig?.actor)) return;
    renderer.drawBodyLayer(ctx, rig, layer, arg);
  }

  function draw(ctx, actor, options = {}, nowMs = performance.now()) {
    const pose = options.pose || Anim.buildPose(actor, nowMs);
    const rig = buildRig(actor, pose, options);
    const palette = resolvePalette(actor, options);
    const x = Math.round(actor.screenX ?? actor.x ?? 0);
    const y = Math.round(actor.screenY ?? actor.y ?? 0);
    const hooks = options.hooks || {};

    // V0.18.36: the rig's `ground` anchor is authored at the body origin (y+0),
    // but the legs actually draw the feet well below it (foot.y ~= +38 at scale 1).
    // Publish the TRUE rendered foot line (the lower of the two legs' feet) so
    // ground-anchored VFX - the rotling root-entangle snare - attach at the feet
    // instead of the hips. _lastGroundAnchor has no other consumers.
    const legNearFootY = Number(rig.anchors?.legs?.near?.foot?.y);
    const legFarFootY = Number(rig.anchors?.legs?.far?.foot?.y);
    const footLine = [legNearFootY, legFarFootY].filter(Number.isFinite);
    const groundOffsetY = footLine.length ? Math.max(...footLine) : (rig.anchors?.ground?.y || 0);
    const groundAnchor = {
      x,
      y,
      groundY: y + groundOffsetY
    };

    ctx.save();
    try {
      ctx.translate(x, y + (options.yOffset || 0));
      if (pose.action === 'death') {
        ctx.translate(0, 14 * pose.deathProgress);
        ctx.rotate((rig.dir.side || 1) * 0.28 * pose.deathProgress);
      }

      drawShadow(ctx, rig, palette, hooks);
      drawSharedMeditationAura(ctx, rig, palette);
      drawSharedEmoteEffects(ctx, rig, palette, 'underlay');
      drawSharedSwimmingUnderlay(ctx, rig, palette);

      const layerProfile = rig.rowProfile || getRowLayerProfile(rig.dir);

      drawWithSwimmingClip(ctx, rig, () => {
        if (hooks.beforeBody) hooks.beforeBody(ctx, rig, palette);
        if (hooks.back) hooks.back(ctx, rig, palette);
        drawPaperdollLayer(ctx, rig, 'back', 'back');
        // Back-facing pass: only actually draws when weaponDepthLayer(rig)
        // resolves to 'back' (see paperdoll-equipment-renderer.js), so the
        // held weapon/offhand render before the torso/cloak below and are
        // correctly occluded instead of pasting on top of a back-facing body.
        drawPaperdollLayer(ctx, rig, 'weapon', 'back');
        drawPaperdollLayer(ctx, rig, 'offhand', 'back');
        drawBackLayers(ctx, rig, palette, hooks);
        drawLegs(ctx, rig, palette);
        drawPaperdollLayer(ctx, rig, 'legs');
        if (layerProfile.backArmLayering) drawBackOccludedArms(ctx, rig, palette);
        if (!layerProfile.backArmLayering && layerProfile.farArmAfterTorso === false) { drawArms(ctx, rig, palette, 'far'); drawPaperdollLayer(ctx, rig, 'arm', 'far'); }
        drawTorso(ctx, rig, palette, hooks);
        drawPaperdollLayer(ctx, rig, 'torso');
        // Back-facing cape pass: the same paperdoll back-slot renderer now
        // draws only for north/northeast/northwest rows here, over the back
        // torso, while front/side capes remain in the original behind-body pass.
        drawPaperdollLayer(ctx, rig, 'back', 'front');
        if (hooks.chest) hooks.chest(ctx, rig, palette);
        if (!layerProfile.backArmLayering && layerProfile.farArmAfterTorso !== false) { drawArms(ctx, rig, palette, 'far'); drawPaperdollLayer(ctx, rig, 'arm', 'far'); }
        if (hooks.mid) hooks.mid(ctx, rig, palette);
        drawPaperdollLayer(ctx, rig, 'offhand', 'front');
        drawHead(ctx, rig, palette, hooks);
        drawPaperdollLayer(ctx, rig, 'head');
        if (!layerProfile.backArmLayering && layerProfile.nearArmAfterTorso !== false) { drawArms(ctx, rig, palette, 'near'); drawPaperdollLayer(ctx, rig, 'arm', 'near'); }
        drawPaperdollLayer(ctx, rig, 'weapon', 'front');
        drawSharedAutoAttackOverlay(ctx, rig, palette);
        if (hooks.front) hooks.front(ctx, rig, palette);
        // Back facing: the cape drapes over all the back-worn gear now (belt
        // pouches, quiver, instrument, weapons) instead of them showing through
        // it. Front/side facings already drew it behind the body in drawBackLayers.
        if (rig.dir.backVisible) drawBackCapeLayer(ctx, rig, palette, hooks);
        if (hooks.effects) hooks.effects(ctx, rig, palette);
        drawSharedEmoteEffects(ctx, rig, palette, 'overlay');
      });
      drawSharedSwimmingSurfaceOverlay(ctx, rig, palette);
      if (options.debugFacing) drawDebugFacing(ctx, rig);
    } finally {
      ctx.restore();
      if (actor) actor._lastGroundAnchor = groundAnchor;
      const source = actor?.sourceEntity;
      if (source) source._lastGroundAnchor = groundAnchor;
    }
    return { ...rig, palette, screen: { x, y } };
  }


  function autoAttackClassTheme(style, palette) {
    const cls = String(style || '').toLowerCase().replace(/[\s_\-]/g, '');
    const fallback = palette.glow || palette.accent || '#ffd36a';
    const themes = {
      druid: { glow: '#66f27a', edge: '#b9ff8f', spark: '#e9ffd1' },
      necromancer: { glow: '#8b4dff', edge: '#1a071f', spark: '#d6a8ff' },
      cleric: { glow: '#fff0a8', edge: '#fff8df', spark: '#ffd86b' },
      summoner: { glow: '#67d8ff', edge: '#ffb45f', spark: '#d9fff7' },
      enchanter: { glow: '#d38cff', edge: '#7ff0ff', spark: '#fff0ff' },
      bard: { glow: '#ffd36a', edge: '#fff3a8', spark: '#ffe8a0' },
      rogue: { glow: '#9b6aff', edge: '#62ff9f', spark: '#c7fff0' },
      fighter: { glow: '#ffb15e', edge: '#fff0a8', spark: '#ffd36a' }
    };
    return themes[cls] || { glow: fallback, edge: palette.accent || fallback, spark: '#ffffff' };
  }

  function drawCasterAutoAttackOverlay(ctx, rig, palette, theme) {
    const pose = rig.pose || {};
    const a = rig.anchors || {};
    const hand = a.mainHand || a.arms?.near?.hand || { x: 0, y: -22 };
    const off = a.offHand || a.arms?.far?.hand || { x: 0, y: -18 };
    const side = rig.dir?.nearSide || rig.dir?.side || 1;
    const phase = Math.max(0, Math.min(1, Number(pose.autoAttackPhase || 0)));
    const pulse = Math.max(0, Math.min(1, Number(pose.autoAttackPulse || 0)));
    const style = String(pose.autoAttackVisualClass || meditationClassId(rig.actor)).toLowerCase();
    const build = phase < 0.70 ? phase / 0.70 : 1;
    const release = phase >= 0.70 ? Math.min(1, (phase - 0.70) / 0.30) : 0;
    const cx = hand.x + side * (6 + build * 5);
    const cy = hand.y - 5 - pulse * 7;
    const radius = 6 + pulse * 8 + build * 3;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.20 + pulse * 0.50;
    ctx.fillStyle = theme.glow;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.38 + pulse * 0.18;
    ctx.strokeStyle = theme.edge;
    ctx.lineWidth = style === 'cleric' ? 2.2 : 1.55;
    for (let ring = 0; ring < 2; ring++) {
      const r = radius + 7 + ring * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, phase * TAU * (ring ? -1 : 1), phase * TAU * (ring ? -1 : 1) + Math.PI * (1.08 + build * 0.46));
      ctx.stroke();
    }
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = theme.spark;
    const moteCount = style === 'summoner' ? 7 : style === 'enchanter' ? 6 : 5;
    for (let i = 0; i < moteCount; i++) {
      const angle = phase * TAU * (style === 'enchanter' ? -1.4 : 1.25) + i * TAU / moteCount;
      const rx = radius + 10 + (i % 2) * 5;
      const ry = rx * (style === 'cleric' ? 0.82 : 0.56);
      const mx = cx + Math.cos(angle) * rx;
      const my = cy + Math.sin(angle) * ry;
      if (style === 'druid') ellipse(ctx, mx, my, 2.8, 1.25, angle, theme.spark, null, 0);
      else if (style === 'necromancer') ellipse(ctx, mx, my, 1.4, 3.2, angle, theme.spark, null, 0);
      else if (style === 'cleric') { line(ctx, mx - 2, my, mx + 2, my, theme.spark, 1.2, 0.8); line(ctx, mx, my - 2, mx, my + 2, theme.spark, 1.2, 0.8); }
      else { ctx.beginPath(); ctx.arc(mx, my, 1.4 + (i % 2) * 0.7, 0, TAU); ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    line(ctx, off.x, off.y, cx, cy, theme.glow, 1.5, 0.52);
    line(ctx, hand.x, hand.y, cx, cy, theme.edge, 1.1, 0.46);
    if (release > 0.02) {
      const trail = 22 + release * 34;
      const tx = cx + side * trail;
      const ty = cy - 5 + Math.sin(release * Math.PI) * 4;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.52 * (1 - release * 0.35);
      line(ctx, cx, cy, tx, ty, theme.glow, 3.8 - release * 1.5, 0.65);
      ctx.fillStyle = theme.edge;
      ctx.beginPath(); ctx.arc(tx, ty, 3.5 + (1 - release) * 3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawMeleeAutoAttackOverlay(ctx, rig, palette, theme) {
    const pose = rig.pose || {};
    const a = rig.anchors || {};
    const hand = a.mainHand || a.arms?.near?.hand || { x: 0, y: -22 };
    const side = rig.dir?.nearSide || rig.dir?.side || 1;
    const phase = Math.max(0, Math.min(1, Number(pose.autoAttackPhase || 0)));
    const style = String(autoAttackRenderClassId(rig.actor, pose)).toLowerCase();
    const raise = phase < 0.35 ? (1 - Math.pow(1 - phase / 0.35, 3)) : (phase < 0.68 ? 1 : Math.max(0, 1 - Math.pow((phase - 0.68) / 0.32, 0.72)));
    const strike = phase < 0.35 ? 0 : phase < 0.58 ? (1 - Math.pow(1 - ((phase - 0.35) / 0.23), 3)) : 1;
    const impact = phase >= 0.56 && phase <= 0.70 ? Math.sin(((phase - 0.56) / 0.14) * Math.PI) : 0;
    const recover = phase > 0.68 ? (1 - Math.pow(1 - ((phase - 0.68) / 0.32), 2)) : 0;
    const heavy = style === 'fighter' || style === 'warden';
    const quick = style === 'rogue' || style === 'bard';
    const disciplined = style === 'paladin';
    const rootX = hand.x;
    const rootY = hand.y - (quick ? 1 : 3);
    const trailAlpha = Math.max(0, Math.min(1, (strike * 0.86 + impact * 0.58) * (1 - recover * 0.78)));
    const arcRadius = quick ? 24 : heavy ? 40 : disciplined ? 33 : 30;
    const centerX = rootX + side * (quick ? 9 : heavy ? 13 : 11);
    const centerY = rootY - (quick ? 6 : heavy ? 12 : 10);
    const startA = side > 0 ? -2.45 + strike * 0.18 : Math.PI + 2.45 - strike * 0.18;
    const endA = side > 0 ? 0.62 + strike * 0.64 : Math.PI - 0.62 - strike * 0.64;

    // V0.16.91: this overlay is only motion/impact affordance. The real weapon is
    // rendered by the shared paperdoll/class held-weapon owner before this call.
    // Do not draw a fallback sword/rod here; that was the attack-only white-stick bug.
    if (trailAlpha > 0.04) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.10 + trailAlpha * (quick ? 0.28 : heavy ? 0.34 : 0.30);
      ctx.strokeStyle = quick ? theme.edge : theme.glow;
      ctx.lineWidth = quick ? 1.5 : heavy ? 2.6 : disciplined ? 2.1 : 1.9;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, arcRadius, arcRadius * 0.58, side * 0.05, startA, endA, side < 0);
      ctx.stroke();
      ctx.globalAlpha = 0.08 + trailAlpha * 0.18;
      ctx.strokeStyle = theme.spark;
      ctx.lineWidth = quick ? 0.9 : 1.2;
      ctx.beginPath();
      ctx.ellipse(centerX + side * 2, centerY - 1, arcRadius + 4, arcRadius * 0.58 + 2, side * 0.04, startA + side * 0.10, endA + side * 0.12, side < 0);
      ctx.stroke();
      ctx.restore();
    }

    if (impact > 0.08) {
      const ix = hand.x + side * (quick ? 15 : heavy ? 24 : disciplined ? 20 : 18);
      const iy = hand.y + (quick ? 9 : heavy ? 16 : disciplined ? 13 : 12);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.24 * impact;
      ctx.strokeStyle = theme.glow;
      ctx.lineWidth = heavy ? 2.2 : 1.6;
      ctx.beginPath();
      ctx.ellipse(ix, iy, heavy ? 10 : 8, heavy ? 5 : 4, side * -0.2, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.34 * impact;
      ctx.fillStyle = theme.spark;
      for (let i = 0; i < (heavy ? 4 : 3); i++) {
        const sx = ix + side * (3 + i * 3);
        const sy = iy - 2 + (i - 1) * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 2) * 0.45, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawSharedAutoAttackOverlay(ctx, rig, palette) {
    const pose = rig.pose || {};
    if (!pose.autoAttackVisualActive) return;
    if (pose.action !== 'attack' && pose.action !== 'cast') return;
    const style = String(autoAttackRenderClassId(rig.actor, pose)).toLowerCase();
    // Ranged weapons use their own class/paperdoll held-weapon presentation. The
    // shared melee overlay is trail-only now, but it still must not run for bows or
    // crossbows because their attack pose is not a melee chop.
    if (isRangedAutoAttackPose(rig.actor, pose)) return;
    const theme = autoAttackClassTheme(style, palette);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pose.action === 'cast' || pose.autoAttackVisualType === 'caster') drawCasterAutoAttackOverlay(ctx, rig, palette, theme);
    else drawMeleeAutoAttackOverlay(ctx, rig, palette, theme);
    ctx.restore();
  }

  function drawSharedEmoteEffects(ctx, rig, palette, layer = 'overlay') {
    const action = rig.pose?.action;
    if (action !== 'dance' && action !== 'sit') return;
    const style = rig.anchors?.emoteStyle || rig.pose?.emoteStyle || meditationClassId(rig.actor || {});
    const t = rig.pose.t || 0;
    const pulse = Number(rig.pose.emotePulse || 0);
    const dance = Math.sin(Number(rig.pose.danceCycle || 0) * TAU);
    const color = style === 'druid' ? '#9df07b'
      : style === 'cleric' ? '#ffeaa0'
      : style === 'enchanter' ? '#c79cff'
      : style === 'summoner' ? '#ffb568'
      : style === 'necromancer' ? '#72e1c8'
      : style === 'bard' ? '#ffd275'
      : style === 'rogue' ? '#9fb7d3'
      : '#ffd680';
    ctx.save();
    if (layer === 'underlay') {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = action === 'dance' ? 0.16 + pulse * 0.10 : 0.10 + pulse * 0.04;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, 9, action === 'dance' ? 38 + pulse * 5 : 30 + pulse * 2, action === 'dance' ? 13 + pulse * 2 : 8, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (action === 'dance') {
      for (let i = 0; i < 5; i++) {
        const a = t * (1.6 + i * 0.15) + i * 1.25;
        const r = 26 + i * 4 + pulse * 3;
        const x = Math.cos(a) * r + dance * 4;
        const y = -46 + Math.sin(a * 1.23) * 13;
        ctx.globalAlpha = 0.18 + (i % 2) * 0.08;
        if (style === 'bard') {
          ctx.font = `${10 + (i % 2)}px serif`;
          ctx.fillText(i % 2 ? '♪' : '♫', x, y);
        } else if (style === 'druid') {
          ctx.beginPath(); ctx.ellipse(x, y, 3.5, 1.7, a, 0, TAU); ctx.fill();
        } else if (style === 'cleric') {
          line(ctx, x - 3, y, x + 3, y, color, 1.1, 0.44); line(ctx, x, y - 3, x, y + 3, color, 1.1, 0.44);
        } else {
          ctx.beginPath(); ctx.arc(x, y, 1.8 + (i % 2) * 0.8, 0, TAU); ctx.fill();
        }
      }
    } else {
      ctx.globalAlpha = 0.16 + pulse * 0.08;
      ctx.beginPath();
      ctx.ellipse(0, 2, style === 'enchanter' ? 34 : 26, style === 'enchanter' ? 10 : 7, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.12 + i * 0.04;
        ctx.beginPath();
        ctx.arc((i - 1) * 10 + Math.sin(t + i) * 2, -27 - i * 4, 1.6 + i * 0.3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSharedMeditationAura(ctx, rig, palette) {
    if (rig.pose.action !== 'meditate') return;
    const style = rig.anchors?.meditationStyle || rig.pose.meditationStyle || meditationClassId(rig.actor || {});
    const t = rig.pose.t || 0;
    const loop = Number(rig.pose.meditateLoop || 0);
    const progress = Math.max(0, Math.min(1, Number(rig.pose.meditationProgress || 0)));
    const pulse = rig.pose.meditatePulse || 1;
    const glow = palette.glow || '#8fe8ff';
    const auraAlpha = meditationAlpha(rig);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = auraAlpha;

    if (style === 'rogue') {
      drawRogueMeditationAura(ctx, t, loop, progress, palette, glow, rig);
    } else if (style === 'cleric') {
      drawClericMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'enchanter') {
      drawEnchanterMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'summoner') {
      drawSummonerMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'necromancer') {
      drawNecromancerMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'bard') {
      drawBardMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'druid') {
      drawDruidMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'fighter') {
      drawFighterMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'warden') {
      drawWardenMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'ranger') {
      drawRangerMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'assassin') {
      drawAssassinMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'wizard') {
      drawWizardMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else if (style === 'shaman') {
      drawShamanMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse);
    } else {
      drawDefaultMeditationAura(ctx, t, pulse, glow);
    }

    const ascendLevel = Math.max(1, Math.min(20, Number(rig.pose.meditationLevel) || 1));
    if (ascendLevel >= 20) {
      drawMeditationAscensionRing(ctx, style, t, auraAlpha);
      drawRotatingEllipseRing(ctx, 16, 58, 16, glow, t, { count: 2, dash: [22, 10], speed: -0.45, width: 1.6, alpha: 0.5 * auraAlpha });
    } else if (ascendLevel >= 15) {
      drawRotatingEllipseRing(ctx, 16, 54, 15, glow, t, { count: 2, dash: [18, 12], speed: 0.5, width: 1.4, alpha: 0.4 * auraAlpha });
    } else if (ascendLevel >= 5) {
      drawRotatingEllipseRing(ctx, 16, 51, 14, glow, t, { count: 1, dash: [24, 14], speed: 0.35, width: 1.1, alpha: 0.3 * auraAlpha });
    }

    ctx.restore();
  }

  const ASCENSION_RING_ICONS = Object.freeze({
    fighter: ['#e4d9b0', '#c23b3b', '#8c8a76'],
    paladin: ['#f3d46b', '#ffe9a8', '#d7ae70'],
    bard: ['#ffe58b', '#ffd8f0'],
    necromancer: ['#cba8ff', '#7bd6c4'],
    enchanter: ['#dca4ff', '#9ff7ff', '#e6b6ff'],
    summoner: ['#85d7ff', '#ff8952', '#a6ff93'],
    rogue: ['#9fa4aa', '#6affe1'],
    cleric: ['#fff7cf', '#a8d8ff'],
    druid: ['#9df07b', '#e0b86a', '#8fcf70', '#c9a06a'],
    warden: ['#8fcf70', '#c9a06a', '#5b6f4a'],
    ranger: ['#9be07a', '#e8dcae'],
    assassin: ['#c23b3b', '#5a4a55'],
    wizard: ['#6fa8ff', '#b98bff', '#ffffff'],
    shaman: ['#59c9b2', '#8a6a3a', '#c9d9ff']
  });

  function drawMeditationAscensionRing(ctx, style, t, alpha) {
    const icons = ASCENSION_RING_ICONS[style] || ASCENSION_RING_ICONS.fighter;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const count = icons.length;
    const orbitR = 46;
    for (let i = 0; i < count; i++) {
      const a = t * 0.62 + i * (TAU / count);
      const x = Math.cos(a) * orbitR;
      const y = -44 + Math.sin(a) * 15;
      ctx.globalAlpha = 0.72 * alpha;
      ctx.fillStyle = icons[i % icons.length];
      ctx.beginPath();
      ctx.ellipse(x, y, 4.2, 6.4, a, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.4 * alpha;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWardenMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 16, 'rgba(74,53,36,0.55)', 'rgba(143,207,112,0.40)', 74, 24, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 16, 49, 13, 'rgba(143,207,112,0.78)', t, { count: 3, dash: [14, 10], speed: 0.55, width: 2.6, alpha: 0.82 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Roots creeping across the ground toward the seated warden.
    for (let i = -3; i <= 3; i++) {
      const x0 = i * 12;
      const y0 = 24;
      const x1 = i * 15 + Math.sin(t * 0.9 + i) * 3;
      const y1 = 10 - Math.abs(i) * 0.6;
      ctx.globalAlpha = 0.5 * alpha;
      ctx.strokeStyle = 'rgba(90,64,40,0.85)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, y0 - 6, x1, y1);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const a = t * 0.5 + i * TAU / 10;
      const x = Math.cos(a) * (30 + (i % 3) * 4);
      const y = 6 + Math.sin(a) * 10;
      ctx.globalAlpha = (0.22 + (i % 3) * 0.05) * alpha;
      ctx.fillStyle = i % 2 ? '#c9a06a' : '#8fcf70';
      ctx.beginPath();
      ctx.arc(x, y, 2.0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRangerMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 15, 'rgba(119,184,95,0.42)', 'rgba(232,220,174,0.40)', 72, 22, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 15, 46, 12, 'rgba(155,224,122,0.80)', t, { count: 3, dash: [9, 8], speed: 1.05, width: 2.2, alpha: 0.8 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 11; i++) {
      const a = t * 1.0 + i * 0.6;
      const x = Math.cos(a) * (16 + (i % 4) * 5);
      const y = -6 - ((t * 15 + i * 7) % 60);
      ctx.globalAlpha = (0.3 + (i % 3) * 0.06) * alpha;
      ctx.fillStyle = i % 2 ? '#9be07a' : '#e8dcae';
      poly(ctx, [
        { x, y: y - 4 }, { x: x + 2.6, y: y + 1 }, { x, y: y + 4 }, { x: x - 2.6, y: y + 1 }
      ], ctx.fillStyle, 'rgba(255,255,255,0.4)', 0.5);
    }
    const side = rig.dir?.side || 1;
    line(ctx, side * 14, -32, side * 14, 6, '#6b5334', 2.2, 0.62 * alpha);
    line(ctx, side * 6, -14, side * 22, -14, '#e8dcae', 1.2, 0.58 * alpha);
    ctx.restore();
  }

  function drawAssassinMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 15, 'rgba(20,16,24,0.78)', 'rgba(194,59,59,0.34)', 66, 20, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 15, 45, 11, 'rgba(194,59,59,0.72)', t, { count: 3, dash: [6, 11], speed: -1.15, width: 2.1, alpha: 0.78 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 10; i++) {
      const a = t * 0.85 + i * TAU / 10;
      const x = Math.cos(a) * (20 + (i % 3) * 4);
      const y = 10 + Math.sin(a) * (4 + (i % 2) * 3);
      ctx.globalAlpha = (0.16 + (i % 3) * 0.04) * alpha;
      ctx.fillStyle = i % 2 ? 'rgba(60,52,58,0.7)' : 'rgba(194,59,59,0.5)';
      ctx.beginPath();
      ctx.ellipse(x, y, 8, 2.4, a, 0, TAU);
      ctx.fill();
    }
    const side = rig.dir?.side || 1;
    line(ctx, side * 17, -30, side * 12, 18, '#141018', 4.4, 0.74 * alpha);
    line(ctx, side * 17, -30, side * 12, 18, '#c23b3b', 1.6, 0.82 * alpha);
    ctx.restore();
  }

  function drawWizardMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 17, 'rgba(111,168,255,0.36)', 'rgba(185,139,255,0.36)', 74, 23, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 17, 49, 13, 'rgba(185,139,255,0.82)', t, { count: 4, dash: [11, 6], speed: 1.2, width: 2.3, alpha: 0.82 * alpha });
    drawGroundGlyphs(ctx, 17, 8, 'rgba(150,200,255,0.85)', t, 44, 11, 0.8 * alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const colors = ['#ff8952', '#85d7ff', '#b98bff', '#ffffff'];
    for (let i = 0; i < 12; i++) {
      const a = t * (1.0 + (i % 4) * 0.15) + i * TAU / 12;
      const rx = 30 + (i % 3) * 6;
      const x = Math.cos(a) * rx;
      const y = -4 + Math.sin(a) * (14 + (i % 2) * 5);
      ctx.globalAlpha = 0.5 * alpha;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, 1.9 + (i % 3) * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShamanMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 16, 'rgba(89,201,178,0.42)', 'rgba(138,106,58,0.36)', 74, 23, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 16, 48, 13, 'rgba(89,201,178,0.78)', t, { count: 3, dash: [13, 9], speed: 0.65, width: 2.4, alpha: 0.8 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Storm-crackle lines rising from an earth/spirit totem stake.
    const side = rig.dir?.side || 1;
    line(ctx, side * 15, -30, side * 15, 14, '#5b4326', 2.6, 0.7 * alpha);
    for (let i = 0; i < 4; i++) {
      const y0 = -30 + i * 8;
      ctx.globalAlpha = (0.4 - i * 0.06) * alpha;
      ctx.strokeStyle = 'rgba(158,231,255,0.85)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(side * 15 - 4, y0);
      ctx.lineTo(side * 15 + 3, y0 + 3 + Math.sin(t * 3 + i) * 2);
      ctx.lineTo(side * 15 - 2, y0 + 6);
      ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const a = t * 0.8 + i * TAU / 9;
      const x = Math.cos(a) * (26 + (i % 3) * 5);
      const y = 8 + Math.sin(a) * 9;
      ctx.globalAlpha = (0.24 + (i % 3) * 0.05) * alpha;
      ctx.fillStyle = i % 2 ? '#59c9b2' : '#8a6a3a';
      ctx.beginPath();
      ctx.arc(x, y, 2.0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSharedSwimmingUnderlay(ctx, rig, palette) {
    if (rig.pose.action !== 'swim') return;
    const t = rig.pose.t || 0;
    const move = Math.max(0, Math.min(1, Number(rig.pose.swimMovement || 0)));
    const y = Number(rig.anchors.waterlineY ?? -1);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.20 + move * 0.16;
    const g = ctx.createRadialGradient(0, y + 4, 2, 0, y + 4, 48 + move * 12);
    g.addColorStop(0, 'rgba(196,248,255,0.28)');
    g.addColorStop(0.45, 'rgba(72,176,205,0.16)');
    g.addColorStop(1, 'rgba(19,72,95,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, y + 6, 42 + Math.sin(t * 3.1) * 3 + move * 7, 14 + Math.sin(t * 2.3) * 1.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawSharedSwimmingSurfaceOverlay(ctx, rig, palette) {
    if (rig.pose.action !== 'swim') return;
    const style = rig.anchors?.swimmingStyle || 'default';
    const t = rig.pose.t || 0;
    const move = Math.max(0, Math.min(1, Number(rig.pose.swimMovement || 0)));
    const y = Number(rig.anchors.waterlineY ?? -1);
    const stroke = Number(rig.pose.swimStroke || 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.78;
    const g = ctx.createLinearGradient(-44, y - 8, 44, y + 14);
    g.addColorStop(0, 'rgba(26,92,122,0.72)');
    g.addColorStop(0.46, 'rgba(72,171,198,0.74)');
    g.addColorStop(1, 'rgba(17,66,93,0.72)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, y + 4, 33 + move * 9, 8.5 + move * 2, 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(210,255,255,0.82)';
    ctx.lineWidth = 1.15;
    for (let i = 0; i < 3; i++) {
      const phase = t * (2.0 + i * 0.35) + i * 1.7;
      ctx.beginPath();
      ctx.ellipse(Math.sin(phase) * (5 + i * 6) + stroke * 3, y + 1 + i * 3, 20 + i * 7 + move * 6, 3.5 + i * 0.7, 0.04 * Math.sin(phase), 0, TAU);
      ctx.stroke();
    }

    const accent = style === 'druid' ? 'rgba(163,239,141,0.60)'
      : style === 'enchanter' ? 'rgba(194,158,255,0.62)'
      : style === 'cleric' ? 'rgba(255,238,163,0.58)'
      : style === 'necromancer' ? 'rgba(126,225,201,0.44)'
      : style === 'summoner' ? 'rgba(255,183,104,0.50)'
      : style === 'bard' ? 'rgba(255,216,128,0.50)'
      : style === 'rogue' ? 'rgba(147,179,208,0.42)'
      : 'rgba(210,241,255,0.50)';
    ctx.globalAlpha = 0.34 + move * 0.18;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.ellipse(0, y + 4, 44 + Math.sin(t * 2.0) * 3, 12 + Math.cos(t * 1.7) * 1.2, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawDefaultMeditationAura(ctx, t, pulse, glow) {
    const g = ctx.createRadialGradient(0, 8, 3, 0, 8, 74 * pulse);
    g.addColorStop(0, 'rgba(230,255,255,0.55)');
    g.addColorStop(0.20, 'rgba(150,235,255,0.36)');
    g.addColorStop(0.55, 'rgba(72,158,255,0.22)');
    g.addColorStop(1, 'rgba(25,80,180,0)');
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 11, 64 + Math.sin(t * 2.1) * 4, 25 + Math.sin(t * 1.7) * 2, 0, 0, TAU);
    ctx.fill();
    for (let ring = 0; ring < 4; ring++) {
      const phase = (t * (0.9 + ring * 0.12) + ring * 0.33) % TAU;
      ctx.globalAlpha = 0.44 - ring * 0.07;
      ctx.strokeStyle = ring % 2 ? 'rgba(175,235,255,0.86)' : glow;
      ctx.lineWidth = 2.2 - ring * 0.28;
      ctx.setLineDash(ring % 2 ? [10, 7] : [16, 9]);
      ctx.lineDashOffset = -phase * 18;
      ctx.beginPath();
      ctx.ellipse(0, 13 + ring * 2, 32 + ring * 11 + Math.sin(t * 2 + ring) * 2.5, 11 + ring * 3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 14; i++) drawRisingMote(ctx, t, i, glow, '#e9fbff', 1.0);
  }

  function drawRisingMote(ctx, t, i, colorA, colorB, scale = 1) {
    const phase = t * (1.15 + (i % 4) * 0.18) + i * 0.72;
    const rise = (phase * 20) % 78;
    const orbit = (13 + (i % 5) * 5) * scale;
    const x = Math.cos(phase) * orbit;
    const y = 9 - rise;
    const r = (1.5 + (i % 3) * 0.75) * scale;
    const a = Math.max(0, 0.58 - rise / 115);
    ctx.globalAlpha = a;
    ctx.fillStyle = i % 2 ? colorA : colorB;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function drawClassGroundGlow(ctx, y, color, alpha, rx, ry, progress = 0) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, y, rx + progress * 6, ry + progress * 1.5, 0, 0, TAU);
    ctx.fill();
  }

  function meditationAlpha(rig) {
    const p = rig?.pose || {};
    return Math.max(0, Math.min(1, Number(p.meditationAuraAlpha ?? 1)));
  }

  function pulseScale(t, speed = 2.4, amount = 0.08) {
    return 1 + Math.sin(t * speed) * amount;
  }

  function drawAuraDisc(ctx, y, outerColor, innerColor, rx, ry, t, alpha = 1) {
    const scale = pulseScale(t, 2.5, 0.08);
    const g = ctx.createRadialGradient(0, y, 3, 0, y, rx * 1.55 * scale);
    g.addColorStop(0, innerColor);
    g.addColorStop(0.36, outerColor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, y, rx * scale, ry * scale, 0, 0, TAU);
    ctx.fill();
  }

  function drawRotatingEllipseRing(ctx, y, rx, ry, color, t, opts = {}) {
    const count = opts.count || 1;
    const dash = opts.dash || null;
    const speed = opts.speed || 1;
    const width = opts.width || 2;
    const alpha = opts.alpha == null ? 0.65 : opts.alpha;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = Math.max(0, alpha - i * 0.08);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.6, width - i * 0.2);
      if (dash) {
        ctx.setLineDash(dash);
        ctx.lineDashOffset = -(t * 18 * speed + i * 11);
      }
      ctx.beginPath();
      ctx.ellipse(0, y + i * 1.8, rx + i * 8 + Math.sin(t * 1.7 + i) * 2, ry + i * 2.2, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGroundGlyphs(ctx, y, count, color, t, rx, ry, alpha = 0.75) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const a = t * 0.82 + i * TAU / count;
      const x = Math.cos(a) * rx;
      const gy = y + Math.sin(a) * ry;
      ctx.globalAlpha = alpha * (0.65 + Math.sin(t * 3 + i) * 0.25);
      ctx.beginPath();
      ctx.moveTo(x - 3, gy);
      ctx.lineTo(x + 3, gy);
      ctx.moveTo(x, gy - 3);
      ctx.lineTo(x, gy + 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, gy, 1.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMeditationSparkField(ctx, t, count, colorA, colorB, topY, bottomY, rx, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < count; i++) {
      const phase = ((t * (0.32 + (i % 5) * 0.035)) + i * 0.061) % 1;
      const x = Math.sin(t * (1.2 + (i % 3) * 0.27) + i * 2.07) * (8 + (i % 6) * rx / 6);
      const y = bottomY - phase * (bottomY - topY);
      const r = 1.1 + (i % 4) * 0.45;
      ctx.globalAlpha = alpha * (0.13 + Math.sin(phase * Math.PI) * 0.32);
      ctx.fillStyle = i % 2 ? colorA : colorB;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLeafShape(ctx, x, y, rot, color, alpha, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.8 * scale, 1.8 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(235,255,205,0.55)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-3.5 * scale, 0);
    ctx.lineTo(3.8 * scale, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawMusicNoteGlyph(ctx, x, y, color, alpha, scale = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.25 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + 5 * scale, 2.7 * scale, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 2.5 * scale, y + 4 * scale);
    ctx.lineTo(x + 2.5 * scale, y - 9 * scale);
    ctx.lineTo(x + 9 * scale, y - 7 * scale);
    ctx.stroke();
    ctx.restore();
  }

  function drawTinySkeletalHand(ctx, x, y, side, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.lineCap = 'round';
    line(ctx, x, y + 8, x + side * 1, y, color, 1.8, alpha);
    for (let i = 0; i < 4; i++) {
      const spread = (i - 1.5) * 2.2;
      line(ctx, x + side * 1, y + 1, x + side * (3 + i * 2), y - 8 + Math.abs(spread), color, 1.05, alpha * 0.9);
    }
    ctx.restore();
  }

  function drawFighterMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 16, 'rgba(255,139,56,0.40)', 'rgba(255,230,138,0.55)', 72, 24, t, 0.98 * alpha);
    drawRotatingEllipseRing(ctx, 16, 48, 13, 'rgba(255,186,74,0.86)', t, { count: 3, dash: [16, 9], speed: 0.7, width: 2.8, alpha: 0.86 * alpha });
    ctx.save();
    ctx.globalAlpha = 0.62 * alpha;
    ctx.strokeStyle = 'rgba(255,112,54,0.82)';
    ctx.lineWidth = 1.25;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 13, 9 + Math.abs(i) * 0.7);
      ctx.lineTo(i * 17 + Math.sin(t * 1.7 + i) * 3, 22 + Math.abs(i) * 1.1);
      ctx.stroke();
    }
    const side = rig.dir.side || 1;
    line(ctx, side * 16, -34, side * 11, 21, '#15100d', 5.3, 0.78 * alpha);
    line(ctx, side * 16, -34, side * 11, 21, '#d7d2bf', 2.8, 0.88 * alpha);
    line(ctx, side * 9, -7, side * 23, -7, 'rgba(255,198,98,0.72)', 2.2, 0.82 * alpha);
    drawMeditationSparkField(ctx, t, 16, '#ffc15b', '#fff0b2', -44, 20, 44, 0.82 * alpha);
    ctx.restore();
  }

  function drawRogueMeditationAura(ctx, t, loop, progress, palette, glow, rig = null) {
    const alpha = meditationAlpha(rig) || 1;
    drawAuraDisc(ctx, 15, 'rgba(39,16,57,0.72)', 'rgba(112,255,109,0.28)', 62, 18, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 15, 44, 10, 'rgba(150,75,255,0.68)', t, { count: 3, dash: [7, 12], speed: 1.4, width: 2.2, alpha: 0.78 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 12; i++) {
      const a = t * 0.95 + i * TAU / 12;
      const x = Math.cos(a) * (23 + (i % 4) * 4);
      const y = 12 + Math.sin(a) * (5 + (i % 3));
      ctx.globalAlpha = (0.20 + (i % 4) * 0.025) * alpha;
      ctx.fillStyle = i % 3 ? 'rgba(71,36,98,0.78)' : 'rgba(118,255,93,0.48)';
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 2.2, a, 0, TAU);
      ctx.fill();
    }
    line(ctx, 18, -12, 36, 3, '#d7e6e3', 2.1, 0.56 * alpha);
    line(ctx, 20, -10, 34, 3, 'rgba(84,255,119,0.92)', 0.9, 0.58 * alpha);
    ctx.restore();
  }

  function drawClericMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 14, 'rgba(255,224,116,0.48)', 'rgba(255,255,240,0.72)', 72, 24, t, 0.98 * alpha);
    drawRotatingEllipseRing(ctx, 14, 48, 13, 'rgba(255,246,189,0.92)', t, { count: 3, dash: [18, 9], speed: 0.55, width: 2.6, alpha: 0.84 * alpha });
    const h = rig.anchors.head || { x: 0, y: -68 };
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const beam = ctx.createLinearGradient(0, -128, 0, 20);
    beam.addColorStop(0, 'rgba(255,255,246,0.00)');
    beam.addColorStop(0.25, 'rgba(255,255,240,0.30)');
    beam.addColorStop(0.72, 'rgba(255,231,122,0.18)');
    beam.addColorStop(1, 'rgba(255,231,122,0.00)');
    ctx.globalAlpha = 0.82 * alpha;
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-23, -128);
    ctx.lineTo(23, -128);
    ctx.lineTo(34, 22);
    ctx.lineTo(-34, 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,230,0.96)';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.82 * alpha;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y - 20, 17 + Math.sin(t * 1.9) * 1.5, 4.2, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const x = -32 + i * 8;
      const y = -10 - ((t * 14 + i * 9) % 58);
      ctx.globalAlpha = 0.22 * alpha;
      ctx.fillStyle = '#fff7cf';
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(t + i) * 3, y, 3.0, 6.0, 0.25 * Math.sin(i), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnchanterMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 19, 'rgba(183,92,255,0.38)', 'rgba(120,255,238,0.34)', 70, 21, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 19, 48, 12, 'rgba(216,165,255,0.88)', t, { count: 4, dash: [5, 5], speed: 1.35, width: 2.2, alpha: 0.82 * alpha });
    drawGroundGlyphs(ctx, 19, 10, 'rgba(255,225,255,0.92)', t, 45, 10, 0.82 * alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      const a = -t * 1.1 + i * TAU / 7;
      const x = Math.cos(a) * (24 + (i % 2) * 8);
      const y = -34 + Math.sin(a) * 12;
      ctx.globalAlpha = (0.42 + Math.sin(t * 2 + i) * 0.12) * alpha;
      ctx.fillStyle = i % 2 ? '#dca4ff' : '#9ff7ff';
      poly(ctx, [
        { x, y: y - 5 }, { x: x + 4, y }, { x, y: y + 5 }, { x: x - 4, y }
      ], ctx.fillStyle, 'rgba(255,255,255,0.62)', 0.6);
    }
    drawMeditationSparkField(ctx, t, 18, '#e6b6ff', '#adfff7', -72, 4, 48, 0.82 * alpha);
    ctx.restore();
  }

  function drawSummonerMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 15, 'rgba(85,255,231,0.33)', 'rgba(255,144,78,0.44)', 76, 23, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 15, 50, 14, 'rgba(99,255,226,0.88)', t, { count: 3, dash: [12, 6], speed: -1.0, width: 2.7, alpha: 0.85 * alpha });
    drawGroundGlyphs(ctx, 15, 5, 'rgba(255,214,130,0.92)', t, 47, 13, 0.92 * alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Tome on the ground before the kneeling summoner.
    ctx.globalAlpha = 0.96 * alpha;
    roundRect(ctx, -17, 3, 14, 9, 2, 'rgba(49,31,24,0.92)', 'rgba(255,216,138,0.70)', 1.0);
    roundRect(ctx, 3, 3, 14, 9, 2, 'rgba(58,36,28,0.92)', 'rgba(255,216,138,0.70)', 1.0);
    line(ctx, 0, 4, 0, 12, 'rgba(255,232,150,0.72)', 1.0, 0.85 * alpha);
    const colors = ['#ff8952', '#85d7ff', '#fff2ac', '#a6ff93'];
    for (let i = 0; i < 12; i++) {
      const a = t * (1.1 + i % 4 * 0.18) + i * TAU / 12;
      const rx = 38 + (i % 3) * 5;
      const x = Math.cos(a) * rx;
      const y = 2 + Math.sin(a) * (12 + (i % 2) * 5);
      ctx.globalAlpha = 0.58 * alpha;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, 2.0 + (i % 3) * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNecromancerMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 16, 'rgba(30,0,44,0.82)', 'rgba(120,44,174,0.42)', 75, 23, t, 0.98 * alpha);
    drawRotatingEllipseRing(ctx, 16, 51, 14, 'rgba(160,74,255,0.74)', t, { count: 4, dash: [10, 13], speed: 0.9, width: 2.4, alpha: 0.84 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 8; i++) {
      const x = -34 + i * 9.8;
      const rise = Math.sin(t * 2.4 + i) * 4;
      drawTinySkeletalHand(ctx, x, 15 - rise, i % 2 ? 1 : -1, 'rgba(197,168,255,0.78)', 0.50 * alpha);
    }
    for (let i = 0; i < 12; i++) {
      const a = t * 0.72 + i * 0.78;
      const x = Math.cos(a) * (10 + i * 2.4);
      const y = -4 + Math.sin(a * 1.3) * 19 - ((t * 5 + i * 3) % 30);
      ctx.globalAlpha = (0.14 + (i % 3) * 0.05) * alpha;
      ctx.fillStyle = i % 2 ? '#b17aff' : '#4b193f';
      ctx.beginPath();
      ctx.ellipse(x, y, 3.0, 7.0, Math.sin(a), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBardMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 15, 'rgba(255,194,76,0.42)', 'rgba(255,240,165,0.55)', 70, 22, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 15, 48, 12, 'rgba(255,229,139,0.86)', t, { count: 4, dash: [20, 8, 4, 8], speed: 0.8, width: 2.2, alpha: 0.82 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Small conjured stool/rock under the seated bard.
    ctx.globalAlpha = 0.72 * alpha;
    roundRect(ctx, -14, 2, 28, 8, 4, 'rgba(101,69,36,0.72)', 'rgba(255,222,130,0.54)', 1.0);
    for (let i = 0; i < 13; i++) {
      const a = t * 1.55 + i * 0.67;
      const x = Math.cos(a) * (18 + (i % 5) * 4);
      const y = -10 - ((t * 17 + i * 8) % 66);
      drawMusicNoteGlyph(ctx, x, y, i % 2 ? '#ffe58b' : '#fff8cf', (0.34 + (i % 3) * 0.05) * alpha, 0.85 + (i % 3) * 0.08);
    }
    ctx.restore();
  }

  function drawDruidMeditationAura(ctx, rig, t, loop, progress, palette, glow, pulse) {
    const alpha = meditationAlpha(rig);
    drawAuraDisc(ctx, 15, 'rgba(84,245,88,0.44)', 'rgba(219,255,146,0.42)', 78, 24, t, 0.96 * alpha);
    drawRotatingEllipseRing(ctx, 15, 50, 14, 'rgba(154,255,116,0.86)', t, { count: 4, dash: [14, 8], speed: 0.65, width: 2.4, alpha: 0.84 * alpha });
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Conjured earth patch.
    ctx.globalAlpha = 0.74 * alpha;
    ctx.fillStyle = 'rgba(71,55,31,0.68)';
    ctx.beginPath();
    ctx.ellipse(0, 17, 36, 9, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 16; i++) {
      const a = t * 0.75 + i * TAU / 16;
      const x = Math.cos(a) * (27 + (i % 3) * 6);
      const y = 13 + Math.sin(a) * (6 + (i % 2) * 2);
      drawLeafShape(ctx, x, y, a + Math.PI * 0.5, i % 2 ? '#a8ff7b' : '#61df62', 0.45 * alpha, 0.9);
    }
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = (0.45 + Math.sin(t * 2 + i) * 0.16) * alpha;
      ctx.fillStyle = i % 2 ? '#f0ff9e' : '#9dff75';
      ctx.beginPath();
      ctx.arc(Math.sin(t * 1.3 + i) * 34, -5 - ((t * 10 + i * 11) % 44), 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShadow(ctx, rig, palette, hooks) {
    if (hooks.shadow) return hooks.shadow(ctx, rig, palette);
    const dead = rig.pose.action === 'death';
    const swim = rig.pose.action === 'swim';
    ctx.save();
    ctx.fillStyle = swim ? 'rgba(0,31,44,0.22)' : palette.shadow;
    ctx.beginPath();
    ctx.ellipse(0, dead ? 9 : (swim ? 8 : 3), dead ? 31 : (swim ? 31 : 23), dead ? 8 : (swim ? 10 : 7), 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // The cape / back garment (class hook, or a default cloth cape when a class
  // has none). Drawn at a facing-dependent depth by the main sequence: behind the
  // body for front/side facings, and LATE - over the back-worn gear - when facing
  // away, so belt pouches, quivers, instruments and weapons don't show through it.
  function drawBackCapeLayer(ctx, rig, palette, hooks) {
    if (hooks.backCape) { hooks.backCape(ctx, rig, palette); return; }
    if (rig.pose.action === 'swim') return; // swimming hides rear cloth under the waterline
    const a = rig.anchors;
    const sway = rig.pose.capeSway * 0.25;
    const side = rig.dir.capeSide || 0;
    const g = ctx.createLinearGradient(-20, -56, 22, 2);
    g.addColorStop(0, palette.clothHi);
    g.addColorStop(0.5, palette.cloth);
    g.addColorStop(1, palette.clothDark);
    poly(ctx, [
      { x: a.chest.x - 18 - side * 4, y: a.chest.y - 7 },
      { x: a.chest.x + 18 - side * 4, y: a.chest.y - 7 },
      { x: a.pelvis.x + 19 - side * 3 + sway, y: a.pelvis.y + 39 },
      { x: a.pelvis.x - 18 - side * 3 - sway, y: a.pelvis.y + 39 }
    ], g, palette.outline, 2);
  }

  function drawBackLayers(ctx, rig, palette, hooks) {
    // Front/side: cape hangs behind the body (here). Back facing: the cape is
    // drawn late (after the gear) by the main sequence instead. Back props
    // (quivers/stowed weapons) always stay behind the cape.
    if (!rig.dir.backVisible) drawBackCapeLayer(ctx, rig, palette, hooks);
    if (hooks.backProp) hooks.backProp(ctx, rig, palette);
  }

  function drawLegs(ctx, rig, palette) {
    const legs = rig.anchors.legs;
    const farFirst = [legs.far, legs.near];
    if (rig.pose.action === 'meditate') return drawMeditationLegs(ctx, rig, palette);
    if (rig.pose.action === 'swim') return drawSwimmingLegs(ctx, rig, palette);
    for (const l of farFirst) {
      const back = l === legs.far;
      limb(ctx, l.hip, l.knee, palette, { fill: back ? palette.clothDark : palette.cloth, width: 7, alpha: back ? 0.82 : 1 });
      limb(ctx, l.knee, l.foot, palette, { fill: back ? palette.clothDark : palette.clothHi, width: 6, alpha: back ? 0.82 : 1 });
      ellipse(ctx, l.foot.x + l.sign * 2, l.foot.y + 2, 7.5, 4.2, 0.08 * l.sign, back ? palette.boot : palette.bootHi, palette.outline, 1.5);
    }
  }

  function drawSwimmingLegs(ctx, rig, palette) {
    const legs = rig.anchors.legs;
    const waterline = Number(rig.anchors.waterlineY ?? -1);
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (const l of [legs.far, legs.near]) {
      limb(ctx, l.hip, l.knee, palette, { fill: palette.clothDark, width: 6.5, alpha: 0.20 });
      limb(ctx, l.knee, l.foot, palette, { fill: palette.clothHi, width: 5.5, alpha: 0.16 });
    }
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = 'rgba(185,242,255,0.72)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, waterline + 6, 24 + (rig.pose.swimMovement || 0) * 8, 5.8, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawMeditationLegs(ctx, rig, palette) {
    const legs = rig.anchors.legs;
    for (const l of [legs.far, legs.near]) {
      ctx.save();
      ctx.globalAlpha = l === legs.far ? 0.82 : 1;
      limb(ctx, l.hip, l.knee, palette, { fill: palette.clothDark, width: 8, alpha: ctx.globalAlpha });
      limb(ctx, l.knee, l.foot, palette, { fill: palette.clothHi, width: 8, alpha: ctx.globalAlpha });
      ellipse(ctx, l.foot.x, l.foot.y, 10, 4, 0.08 * l.sign, palette.boot, palette.outline, 1.5);
      ctx.restore();
    }
  }

  function drawTorso(ctx, rig, palette, hooks) {
    const a = rig.anchors;
    const d = rig.dir;
    const p = rig.pose;
    const chest = a.chest;
    const pelvis = a.pelvis;
    const sw = 22 * (d.shoulderScale || 1);
    const hw = 14 * (d.torsoScaleX || 1);
    const skew = d.torsoSkew * 0.28;
    const g = ctx.createLinearGradient(-sw, chest.y - 16, sw, pelvis.y + 18);
    g.addColorStop(0, palette.clothHi);
    g.addColorStop(0.42, palette.cloth);
    g.addColorStop(1, palette.clothDark);
    poly(ctx, [
      { x: chest.x - sw + skew, y: chest.y - 12 },
      { x: chest.x + sw + skew, y: chest.y - 12 },
      { x: pelvis.x + hw, y: pelvis.y + 21 },
      { x: pelvis.x + hw * 0.55, y: pelvis.y + 33 },
      { x: pelvis.x - hw * 0.55, y: pelvis.y + 33 },
      { x: pelvis.x - hw, y: pelvis.y + 21 }
    ], g, palette.outline, 2);

    if (p.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = p.hitFlash * 0.45;
      poly(ctx, [
        { x: chest.x - sw + skew, y: chest.y - 12 },
        { x: chest.x + sw + skew, y: chest.y - 12 },
        { x: pelvis.x + hw, y: pelvis.y + 23 },
        { x: pelvis.x - hw, y: pelvis.y + 23 }
      ], '#ffffff', '#ffffff', 0);
      ctx.restore();
    }

    if (hooks.torsoOverlay) hooks.torsoOverlay(ctx, rig, palette);
  }


  function drawBackOccludedArms(ctx, rig, palette) {
    const arms = rig.anchors.arms;
    const mode = rig.dir.armOcclusion || 'backBiased';
    const ordered = mode === 'fullBackBody' ? [arms.far, arms.near] : [arms.far];
    const alpha = rig.rowProfile?.backArmAlpha ?? (mode === 'fullBackBody' ? 0.16 : 0.26);
    for (const arm of ordered) {
      if (!arm || arm.hiddenBehindTorso || !arm.visibleBackSegment) continue;
      limb(ctx, arm.shoulder, arm.elbow, palette, { fill: palette.clothDark, width: 5.0, alpha });
      if (arm.showForearm) {
        limb(ctx, arm.elbow, arm.hand, palette, { fill: palette.clothDark, width: 4.0, alpha: alpha * 0.7 });
      }
    }
  }

  function drawArms(ctx, rig, palette, which) {
    const arms = rig.anchors.arms;
    const targets = which === 'far' ? [arms.far] : [arms.near];
    if (rig.pose.action === 'meditate' && which === 'far') return;
    for (const arm of targets) {
      if (!arm || arm.hiddenBehindTorso) continue;
      const back = arm === arms.far;
      limb(ctx, arm.shoulder, arm.elbow, palette, { fill: back ? palette.clothDark : palette.cloth, width: 6.5, alpha: back ? 0.78 : 1 });
      if (arm.showForearm !== false) {
        limb(ctx, arm.elbow, arm.hand, palette, { fill: back ? palette.clothDark : palette.clothHi, width: 5.6, alpha: back ? 0.78 : 1 });
      }
      if (arm.showHand !== false) {
        ellipse(ctx, arm.hand.x, arm.hand.y, 4.7, 5.1, 0, palette.skin, palette.outline, 1.4);
      }
    }
    if (rig.pose.action === 'meditate' && which === 'near') {
      const far = arms.far;
      if (!far || far.hiddenBehindTorso) return;
      limb(ctx, far.shoulder, far.elbow, palette, { fill: palette.clothDark, width: 6.5, alpha: 0.78 });
      limb(ctx, far.elbow, far.hand, palette, { fill: palette.clothDark, width: 5.6, alpha: 0.78 });
      ellipse(ctx, far.hand.x, far.hand.y, 4.7, 5.1, 0, palette.skin, palette.outline, 1.4);
    }
  }

  function drawHead(ctx, rig, palette, hooks) {
    const a = rig.anchors;
    const h = a.head;
    const d = rig.dir;
    const neckFill = d.backVisible ? palette.clothDark : palette.skinShadow;
    roundRect(ctx, a.neck.x - 3.5, a.neck.y - 4, 7, 10, 2, neckFill, palette.outline, 1.2);

    if (hooks.backHair && d.backVisible) hooks.backHair(ctx, rig, palette);

    const headFill = d.backVisible ? palette.hair : palette.skin;
    ellipse(ctx, h.x, h.y, h.rx, h.ry, 0.02 * (d.side || 0), headFill, palette.outline, 2);

    if (d.backVisible) {
      ctx.strokeStyle = palette.hairHi;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(h.x - h.rx * 0.5, h.y - 8);
      ctx.quadraticCurveTo(h.x, h.y + 2, h.x + h.rx * 0.5, h.y - 8);
      ctx.stroke();
    } else {
      drawFace(ctx, rig, palette);
    }

    if (hooks.hair) hooks.hair(ctx, rig, palette);
    else drawDefaultHair(ctx, rig, palette);
  }

  function drawFace(ctx, rig, palette) {
    const h = rig.anchors.head;
    const d = rig.dir;
    const actor = rig.actor || {};
    const faceStyle = String(actor.faceStyle || 'balanced').toLowerCase();
    const eyeColor = actor.eyeColor || actor.visualPalette?.eye || '#8ec9ff';
    const brow = faceStyle === 'stern' || faceStyle === 'sharp' ? '#24150f' : '#2b1b14';
    const mouth = faceStyle === 'tattooed' ? '#8fd7e8' : '#6e3f32';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (d.view === 'side') {
      const s = d.side || 1;
      const eyeX = h.x + s * 3;
      const eyeY = h.y - (faceStyle === 'stern' ? 3 : 2);
      ctx.fillStyle = '#120d0b';
      ctx.fillRect(eyeX - (s < 0 ? 4 : 0), eyeY - 1, 5, 4);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(eyeX - (s < 0 ? 3 : -1), eyeY, 3, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillRect(eyeX + (s < 0 ? -1 : 2), eyeY, 1, 1);
      line(ctx, h.x + s * 1, h.y + 2, h.x + s * 6, h.y + 4, palette.skinShadow || '#8d5b42', 1.15, 0.68);
      ctx.strokeStyle = mouth;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(h.x + s * 2, h.y + 8);
      ctx.lineTo(h.x + s * 8, h.y + 7);
      ctx.stroke();
      if (faceStyle === 'scarred') line(ctx, h.x + s * 2, h.y - 9, h.x + s * 7, h.y + 6, '#9e3b2d', 1.2, 0.9);
      ctx.restore();
      return;
    }
    const eyeY = h.y - (faceStyle === 'stern' ? 3 : 2);
    const eyeH = faceStyle === 'soft' ? 3 : 4;
    ctx.fillStyle = '#120d0b';
    ctx.fillRect(h.x - 8, eyeY - 1, 7, eyeH);
    ctx.fillRect(h.x + 1, eyeY - 1, 7, eyeH);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(h.x - 6, eyeY, 3, 2);
    ctx.fillRect(h.x + 3, eyeY, 3, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(h.x - 4, eyeY, 1, 1);
    ctx.fillRect(h.x + 5, eyeY, 1, 1);
    if (faceStyle === 'stern' || faceStyle === 'sharp') {
      line(ctx, h.x - 9, h.y - 8, h.x - 2, h.y - 6, brow, 1.35, 0.9);
      line(ctx, h.x + 2, h.y - 6, h.x + 9, h.y - 8, brow, 1.35, 0.9);
    } else {
      line(ctx, h.x - 8, h.y - 8, h.x - 2, h.y - 8, brow, 0.9, 0.42);
      line(ctx, h.x + 2, h.y - 8, h.x + 8, h.y - 8, brow, 0.9, 0.42);
    }
    ctx.strokeStyle = palette.skinShadow || '#a86b4d';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(h.x + (faceStyle === 'sharp' ? 1 : 0), h.y + 1);
    ctx.lineTo(h.x - 1, h.y + 5);
    ctx.lineTo(h.x + 2, h.y + 5);
    ctx.stroke();
    ctx.strokeStyle = mouth;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(h.x - (faceStyle === 'soft' ? 3 : 4), h.y + 10);
    ctx.quadraticCurveTo(h.x, h.y + (faceStyle === 'stern' ? 10 : 11), h.x + (faceStyle === 'soft' ? 3 : 4), h.y + 10);
    ctx.stroke();
    if (faceStyle === 'scarred') line(ctx, h.x - 8, h.y - 10, h.x + 6, h.y + 8, '#9e3b2d', 1.2, 0.9);
    else if (faceStyle === 'tattooed') {
      ctx.strokeStyle = '#45a9c4'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(h.x + 9, h.y + 1, 4, 0.2, Math.PI * 1.45); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDefaultHair(ctx, rig, palette) {
    if (DR.Hairstyles?.drawHumanoid?.(ctx, rig, palette)) return;
    const h = rig.anchors.head;
    const d = rig.dir;
    const actor = rig.actor || {};
    const hairStyle = String(actor.hairStyle || 'short').toLowerCase();
    const s = d.side || 1;
    const g = ctx.createLinearGradient(h.x - 13, h.y - 17, h.x + 14, h.y + 2);
    g.addColorStop(0, palette.hairHi);
    g.addColorStop(0.62, palette.hair);
    g.addColorStop(1, '#1b100d');
    if (rig.dir.backVisible) {
      if (hairStyle === 'long' || hairStyle === 'loosewaves') {
        poly(ctx, [
          { x: h.x - h.rx - 2, y: h.y - 11 }, { x: h.x + h.rx + 2, y: h.y - 11 },
          { x: h.x + h.rx + 1, y: h.y + 20 }, { x: h.x - h.rx - 1, y: h.y + 20 }
        ], g, palette.outline, 1.4);
      }
      return;
    }
    if (hairStyle === 'long') {
      poly(ctx, [
        { x: h.x - h.rx - 2, y: h.y - 12 }, { x: h.x + h.rx + 2, y: h.y - 12 },
        { x: h.x + h.rx + 1, y: h.y + 18 }, { x: h.x - h.rx - 1, y: h.y + 18 }
      ], g, palette.outline, 1.7);
      return;
    }
    if (hairStyle === 'ponytail') {
      poly(ctx, [
        { x: h.x - h.rx - 1, y: h.y - 7 }, { x: h.x + h.rx + 1, y: h.y - 9 },
        { x: h.x + h.rx * 0.7, y: h.y + 1 }, { x: h.x - h.rx * 0.65, y: h.y + 3 }
      ], g, palette.outline, 1.6);
      ellipse(ctx, h.x + 16 * s, h.y - 1, 5, 15, -0.15 * s, palette.hair, palette.outline, 1.2);
      return;
    }
    if (hairStyle === 'braid') {
      poly(ctx, [
        { x: h.x - h.rx - 1, y: h.y - 7 }, { x: h.x + h.rx + 1, y: h.y - 9 },
        { x: h.x + h.rx * 0.65, y: h.y + 1 }, { x: h.x - h.rx * 0.65, y: h.y + 3 }
      ], g, palette.outline, 1.6);
      line(ctx, h.x + 13 * s, h.y + 1, h.x + 15 * s, h.y + 25, palette.hair, 5, 0.86);
      line(ctx, h.x + 13 * s, h.y + 5, h.x + 15 * s, h.y + 24, palette.hairHi, 1.2, 0.42);
      return;
    }
    if (hairStyle === 'twinbraids') {
      poly(ctx, [
        { x: h.x - h.rx - 1, y: h.y - 8 }, { x: h.x + h.rx + 1, y: h.y - 8 },
        { x: h.x + h.rx * 0.65, y: h.y + 1 }, { x: h.x - h.rx * 0.65, y: h.y + 1 }
      ], g, palette.outline, 1.5);
      line(ctx, h.x - 12, h.y + 0, h.x - 15, h.y + 23, palette.hair, 4.5, 0.84);
      line(ctx, h.x + 12, h.y + 0, h.x + 15, h.y + 23, palette.hair, 4.5, 0.84);
      return;
    }
    if (hairStyle === 'shaved' || hairStyle === 'undercut') {
      ellipse(ctx, h.x, h.y - 7, h.rx - 1, 4.5, 0, palette.hair, palette.outline, 1.1);
      if (hairStyle === 'undercut') line(ctx, h.x - 2 * s, h.y - 15, h.x + 9 * s, h.y - 11, palette.hairHi, 4, 0.7);
      return;
    }
    if (hairStyle === 'pixie') {
      poly(ctx, [
        { x: h.x - h.rx - 2, y: h.y - 2 }, { x: h.x - h.rx + 2, y: h.y - 13 },
        { x: h.x - 1 * s, y: h.y - 19 }, { x: h.x + h.rx + 2, y: h.y - 10 },
        { x: h.x + h.rx * 0.45, y: h.y - 1 }, { x: h.x - h.rx * 0.65, y: h.y + 2 }
      ], g, palette.outline, 1.6);
      return;
    }
    if (hairStyle === 'curls') {
      for (let i = -2; i <= 2; i++) ellipse(ctx, h.x + i * 5, h.y - 9 + (i % 2) * 1.5, 4.8, 5.4, 0, i === 0 ? palette.hairHi : palette.hair, palette.outline, 0.8);
      return;
    }
    if (hairStyle === 'mohawk') {
      line(ctx, h.x, h.y - 20, h.x + 1 * s, h.y - 3, palette.hair, 6, 0.9);
      line(ctx, h.x + 1 * s, h.y - 18, h.x + 2 * s, h.y - 6, palette.hairHi, 1.5, 0.5);
      return;
    }
    if (hairStyle === 'bun' || hairStyle === 'topknot') {
      poly(ctx, [
        { x: h.x - h.rx - 2, y: h.y - 1 }, { x: h.x - h.rx + 2, y: h.y - 13 },
        { x: h.x - 3 * s, y: h.y - 19 }, { x: h.x + h.rx + 2, y: h.y - 8 },
        { x: h.x + h.rx * 0.5, y: h.y + 1 }, { x: h.x + 2 * s, y: h.y - 3 },
        { x: h.x - h.rx * 0.55, y: h.y + 4 }
      ], g, palette.outline, 1.6);
      ellipse(ctx, h.x + (hairStyle === 'bun' ? 14 * s : 0), h.y + (hairStyle === 'bun' ? -2 : -22), 6, 6, 0, palette.hair, palette.outline, 1.1);
      return;
    }
    if (hairStyle === 'loosewaves') {
      poly(ctx, [
        { x: h.x - h.rx - 3, y: h.y - 12 }, { x: h.x + h.rx + 3, y: h.y - 11 },
        { x: h.x + h.rx + 1, y: h.y + 17 }, { x: h.x + 2 * s, y: h.y + 8 },
        { x: h.x - h.rx - 2, y: h.y + 18 }
      ], g, palette.outline, 1.7);
      line(ctx, h.x - h.rx + 1, h.y - 1, h.x - h.rx - 2, h.y + 16, palette.hairHi, 1.3, 0.45);
      return;
    }
    poly(ctx, [
      { x: h.x - h.rx - 2, y: h.y - 1 },
      { x: h.x - h.rx + 2, y: h.y - 13 },
      { x: h.x - 3 * s, y: h.y - 19 },
      { x: h.x + h.rx + 2, y: h.y - 8 },
      { x: h.x + h.rx * 0.5, y: h.y + 1 },
      { x: h.x + 2 * s, y: h.y - 3 },
      { x: h.x - h.rx * 0.55, y: h.y + 4 }
    ], g, palette.outline, 1.8);
  }

  function drawDebugFacing(ctx, rig) {
    const text = `${rig.pose.shortDirection || rig.dir.short || '?'} [${rig.pose.directionWorldShort || rig.dir.worldShort || '?'}]`;
    const y = (rig.anchors.head.top || -92) - 16;
    ctx.save();
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(-w / 2, y - 7, w, 13);
    ctx.strokeStyle = 'rgba(130,220,255,0.76)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2, y - 7, w, 13);
    ctx.fillStyle = '#d9fbff';
    ctx.fillText(text, 0, y);
    ctx.restore();
  }

  DR.render.HumanoidBaseRenderer = {
    draw,
    buildRig,
    resolvePalette,
    poly,
    roundRect,
    ellipse,
    line,
    limb,
    shouldUseBackArmLayering,
    drawSharedMeditationAura,
    drawSharedSwimmingUnderlay,
    drawSharedSwimmingSurfaceOverlay,
    swimClipInfo,
    drawWithSwimmingClip,
    drawDefaultHair,
    getRowLayerProfile,
    ROW_LAYER_PROFILES,
    DEFAULT_PALETTE
  };
})();
