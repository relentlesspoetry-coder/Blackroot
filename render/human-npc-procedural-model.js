(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const HumanNpcProceduralModel = (() => {
    const TAU = Math.PI * 2;

    const COLORS = {
      outline: '#15110e',
      skin: '#e5b184',
      skinDark: '#a66f4c',
      cheek: 'rgba(116,62,43,0.22)',
      brow: '#241610',
      hairDark: '#2b1a12',
      hairBrown: '#5a321f',
      leather: '#5a3822',
      leatherDark: '#2d1d14',
      leatherHi: '#9c6840',
      metal: '#c6ccd0',
      metalMid: '#8f999f',
      metalDark: '#596168',
      clothWhite: '#e7dfcf',
      clothCream: '#d8d1b4',
      clothTan: '#b98954',
      clothBrown: '#6d4329',
      clothGreen: '#355c38',
      clothPurple: '#603c88',
      clothBlue: '#3b6b8f',
      clothRed: '#7a2f2f',
      dirt: '#7d5630',
      gold: '#d3a944',
      shadow: 'rgba(0,0,0,0.34)',
      ink: '#1d1611',
    };

    const HUMAN_DIRECTIONS = {
      east:      { name: 'east',      view: 'side',          side:  1, face: true,  back: false, headX:  4, faceW: 10, torsoSkew:  7 },
      southeast: { name: 'southeast', view: 'frontDiagonal', side:  1, face: true,  back: false, headX:  3, faceW: 15, torsoSkew:  4 },
      south:     { name: 'south',     view: 'front',         side:  0, face: true,  back: false, headX:  0, faceW: 20, torsoSkew:  0 },
      southwest: { name: 'southwest', view: 'frontDiagonal', side: -1, face: true,  back: false, headX: -3, faceW: 15, torsoSkew: -4 },
      west:      { name: 'west',      view: 'side',          side: -1, face: true,  back: false, headX: -4, faceW: 10, torsoSkew: -7 },
      northwest: { name: 'northwest', view: 'backDiagonal',  side: -1, face: false, back: true,  headX: -3, faceW:  0, torsoSkew: -4 },
      north:     { name: 'north',     view: 'back',          side:  0, face: false, back: true,  headX:  0, faceW:  0, torsoSkew:  0 },
      northeast: { name: 'northeast', view: 'backDiagonal',  side:  1, face: false, back: true,  headX:  3, faceW:  0, torsoSkew:  4 },
    };

    const ROLE_STYLE = {
      merchant: {
        roleId: 'merchant',
        hair: COLORS.hairBrown,
        skin: COLORS.skin,
        inner: '#7b4d2d',
        main: '#5b3824',
        outer: '#7a5132',
        trim: COLORS.gold,
        pants: '#3b2a1e',
        boots: '#241812',
        glove: '#6b4228',
        stance: 10,
        headY: -76,
        personality: 'shrewd',
      },
      cook: {
        roleId: 'cook',
        hair: COLORS.hairBrown,
        skin: COLORS.skin,
        inner: '#d49a5e',
        main: '#9a6035',
        outer: COLORS.clothWhite,
        trim: '#ead7b7',
        pants: '#3a2a1d',
        boots: '#251a13',
        glove: '#d9c7a9',
        stance: 8,
        headY: -76,
        personality: 'kind',
      },
      field_cleric: {
        roleId: 'field_cleric',
        hair: COLORS.hairBrown,
        skin: COLORS.skin,
        inner: '#b8ad88',
        main: '#d8d1b4',
        outer: '#efe7c9',
        trim: COLORS.gold,
        pants: '#5d563d',
        boots: '#35271d',
        glove: '#efe7c9',
        stance: 6,
        headY: -78,
        personality: 'calm',
      },
      miner: {
        roleId: 'miner',
        hair: COLORS.hairDark,
        skin: COLORS.skin,
        inner: '#8a5a31',
        main: COLORS.clothBrown,
        outer: '#4d3322',
        trim: COLORS.metal,
        pants: '#242426',
        boots: '#1d1712',
        glove: '#2e251d',
        stance: 11,
        headY: -74,
        personality: 'tired',
      },
      merc_recruiter: {
        roleId: 'merc_recruiter',
        hair: COLORS.hairDark,
        skin: COLORS.skin,
        inner: '#5b3a24',
        main: '#4a3826',
        outer: '#6b4a2e',
        trim: '#c2a46d',
        pants: '#30261c',
        boots: '#1d130d',
        glove: '#3a2618',
        stance: 7,
        headY: -77,
        personality: 'stern',
      },
      guard: {
        roleId: 'guard',
        hair: COLORS.hairDark,
        skin: COLORS.skin,
        inner: '#2d3a32',
        main: '#4f5e53',
        outer: COLORS.metalMid,
        trim: COLORS.metal,
        pants: '#26322b',
        boots: '#151915',
        glove: COLORS.metalDark,
        stance: 11,
        headY: -76,
        personality: 'stern',
      },
      villager: {
        roleId: 'villager',
        hair: COLORS.hairBrown,
        skin: COLORS.skin,
        inner: '#a7794f',
        main: COLORS.clothTan,
        outer: '#785132',
        trim: COLORS.leather,
        pants: '#4a3825',
        boots: '#241812',
        glove: '#734a2e',
        stance: 8,
        headY: -75,
        personality: 'neutral',
      },
    };

    function draw(ctx, npc, nowMs = performance.now()) {
      const x = Number.isFinite(npc.screenX) ? npc.screenX : (Number(npc.x) || 0);
      const y = Number.isFinite(npc.screenY) ? npc.screenY : (Number(npc.y) || 0);
      const roleId = resolveNpcRole(npc);
      const dir = resolveHumanDirection(npc);
      const pose = buildHumanPose(npc, nowMs);

      ctx.save();
      ctx.translate(Math.round(x), Math.round(y + pose.bob));

      drawNpcShadow(ctx, roleId);

      switch (roleId) {
        case 'merchant':
          drawMerchantNpc(ctx, dir, pose);
          break;
        case 'cook':
          drawCookNpc(ctx, dir, pose);
          break;
        case 'field_cleric':
          drawFieldClericNpc(ctx, dir, pose);
          break;
        case 'miner':
          drawMinerNpc(ctx, dir, pose);
          break;
        case 'merc_recruiter':
          drawMercRecruiterNpc(ctx, dir, pose);
          break;
        case 'guard':
          drawGuardNpc(ctx, dir, pose);
          break;
        default:
          drawVillagerNpc(ctx, dir, pose);
          break;
      }

      ctx.restore();

      npc._nameplateAnchor = {
        x,
        y: y - 92 + pose.bob,
      };
    }

    function resolveNpcRole(npc) {
      const raw = String(
        npc.visualRole ||
        npc.npcRole ||
        npc.role ||
        npc.job ||
        npc.type ||
        npc.name ||
        ''
      ).toLowerCase().replace(/[-\s]+/g, '_');

      if (raw.includes('merchant') || raw.includes('vendor') || raw.includes('trader')) return 'merchant';
      if (raw.includes('cook') || raw.includes('chef')) return 'cook';
      if (raw.includes('field_cleric') || raw.includes('cleric') || raw.includes('healer') || raw.includes('priest')) return 'field_cleric';
      if (raw.includes('miner') || raw.includes('smith') || raw.includes('labor')) return 'miner';
      if (raw.includes('merc') || raw.includes('recruiter') || raw.includes('contract')) return 'merc_recruiter';
      if (raw.includes('guard') || raw.includes('warden') || raw.includes('fighter') || raw.includes('watch')) return 'guard';
      return 'villager';
    }

    function resolveHumanDirection(npc) {
      const named = String(npc.visualFacingName || npc.facingName || npc.direction || '').toLowerCase();
      if (HUMAN_DIRECTIONS[named]) return HUMAN_DIRECTIONS[named];

      const x = Math.sign(Number(npc.facingX ?? npc.vx ?? 0));
      const y = Math.sign(Number(npc.facingY ?? npc.vy ?? 0));

      if (x > 0 && y === 0) return HUMAN_DIRECTIONS.east;
      if (x > 0 && y > 0) return HUMAN_DIRECTIONS.southeast;
      if (x === 0 && y > 0) return HUMAN_DIRECTIONS.south;
      if (x < 0 && y > 0) return HUMAN_DIRECTIONS.southwest;
      if (x < 0 && y === 0) return HUMAN_DIRECTIONS.west;
      if (x < 0 && y < 0) return HUMAN_DIRECTIONS.northwest;
      if (x === 0 && y < 0) return HUMAN_DIRECTIONS.north;
      if (x > 0 && y < 0) return HUMAN_DIRECTIONS.northeast;
      return HUMAN_DIRECTIONS.south;
    }

    function buildHumanPose(npc, nowMs) {
      const moving = Boolean(
        npc.isMoving ??
        npc.moving ??
        ((Math.abs(Number(npc.vx) || 0) + Math.abs(Number(npc.vy) || 0)) > 0.01)
      );
      const t = nowMs / 1000;
      const step = moving ? t * 8.0 : t * 1.7;
      return {
        t,
        step,
        moving,
        bob: moving ? -Math.abs(Math.sin(step)) * 1.8 : Math.sin(t * 2.0) * 0.45,
        breathe: Math.sin(t * 2.0) * 0.65,
        armSwing: moving ? Math.sin(step) * 5 : Math.sin(t * 1.6) * 0.8,
        legSwing: moving ? Math.sin(step) * 4 : 0,
        clothSwing: moving ? Math.sin(step) * 2.8 : Math.sin(t * 1.4) * 0.8,
      };
    }

    function drawNpcShadow(ctx, roleId) {
      const rx = roleId === 'merchant' ? 34 : roleId === 'guard' ? 31 : 28;
      const ry = roleId === 'merchant' ? 10 : 9;
      const g = ctx.createRadialGradient(0, -2, 2, 0, -2, rx);
      g.addColorStop(0, COLORS.shadow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -2, rx, ry, 0, 0, TAU);
      ctx.fill();
    }

    function drawMerchantNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.merchant;
      drawMerchantPack(ctx, dir, pose, s);
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 1.12 });
      drawMerchantCoatBody(ctx, dir, pose, s);
      drawMerchantPouchBelt(ctx, dir, pose, s);
      drawLayeredArm(ctx, -14, -52, -25, -35 + pose.armSwing * 0.55, s.outer, s.trim, true, s);
      drawLayeredArm(ctx, 14, -52, 25, -35 - pose.armSwing * 0.55, s.outer, s.trim, false, s);
      drawCoinMedallion(ctx, dir, pose, s);
      drawTradeSatchel(ctx, dir, pose, s);
      drawMerchantHandProps(ctx, dir, pose, s);
      drawHumanHead(ctx, dir, pose, s);
      drawMerchantCap(ctx, dir, pose, s);
    }

    function drawCookNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.cook;
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 1.0 });
      drawCookBody(ctx, dir, pose, s);
      drawCookTowel(ctx, dir, pose, s);
      drawLayeredArm(ctx, -15, -53, -25, -35 + pose.armSwing * 0.5, s.inner, COLORS.clothWhite, true, s, { rolled: true });
      drawLayeredArm(ctx, 15, -53, 27, -34 - pose.armSwing * 0.5, s.inner, COLORS.clothWhite, false, s, { rolled: true });
      drawCookPan(ctx, dir, pose, s);
      drawHumanHead(ctx, dir, pose, s);
      drawChefCap(ctx, dir, pose, s);
    }

    function drawFieldClericNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.field_cleric;
      drawClericStaff(ctx, dir, pose, s);
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 0.92, hiddenByRobe: true });
      drawClericRobeBody(ctx, dir, pose, s);
      drawWideSleeveArm(ctx, -16, -53, -25, -35 + pose.armSwing * 0.25, s.outer, s.trim, true, s);
      drawWideSleeveArm(ctx, 16, -53, 24, -35 - pose.armSwing * 0.25, s.outer, s.trim, false, s);
      drawHolyBookOrSymbol(ctx, dir, pose, s);
      drawHumanHead(ctx, dir, pose, s);
      drawClericHairAndShoulderCloth(ctx, dir, pose, s);
    }

    function drawMinerNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.miner;
      drawPickaxeBackOrHand(ctx, dir, pose, s, true);
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 1.2 });
      drawMinerWorkBody(ctx, dir, pose, s);
      drawLayeredArm(ctx, -15, -52, -27, -34 + pose.armSwing * 0.7, s.main, s.trim, true, s, { gloves: true });
      drawLayeredArm(ctx, 15, -52, 27, -34 - pose.armSwing * 0.7, s.main, s.trim, false, s, { gloves: true });
      drawPickaxeBackOrHand(ctx, dir, pose, s, false);
      drawHumanHead(ctx, dir, pose, s);
      drawMinerHelmet(ctx, dir, pose, s);
      drawDust(ctx);
    }

    function drawMercRecruiterNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.merc_recruiter;
      drawRecruiterSatchel(ctx, dir, pose, s);
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 1.0 });
      drawRecruiterCoatBody(ctx, dir, pose, s);
      drawLayeredArm(ctx, -15, -53, -24, -35 + pose.armSwing * 0.25, s.main, s.trim, true, s);
      drawLayeredArm(ctx, 15, -53, 25, -35 - pose.armSwing * 0.25, s.main, s.trim, false, s);
      drawContractBoard(ctx, dir, pose, s);
      drawHumanHead(ctx, dir, pose, s);
      drawRecruiterHeadBand(ctx, dir, pose, s);
    }

    function drawGuardNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.guard;
      drawGuardSpear(ctx, dir, pose, s);
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 1.12 });
      drawGuardArmorBody(ctx, dir, pose, s);
      drawGuardShoulders(ctx, dir, pose, s);
      drawArmoredArm(ctx, -16, -51, -25, -33 + pose.armSwing * 0.28, s, true);
      drawArmoredArm(ctx, 16, -51, 25, -33 - pose.armSwing * 0.28, s, false);
      drawGuardShield(ctx, dir, pose, s);
      drawHumanHead(ctx, dir, pose, s);
      drawGuardHelmet(ctx, dir, pose, s);
    }

    function drawVillagerNpc(ctx, dir, pose) {
      const s = ROLE_STYLE.villager;
      drawHumanLegs(ctx, dir, pose, s, { stance: s.stance, bootScale: 1.0 });
      drawVillagerLayeredBody(ctx, dir, pose, s);
      drawLayeredArm(ctx, -14, -52, -23, -35 + pose.armSwing * 0.45, s.main, s.trim, true, s);
      drawLayeredArm(ctx, 14, -52, 23, -35 - pose.armSwing * 0.45, s.main, s.trim, false, s);
      drawHumanHead(ctx, dir, pose, s);
      drawSimpleHair(ctx, dir, pose, s);
    }

    function drawHumanLegs(ctx, dir, pose, s, options = {}) {
      const stance = options.stance ?? 8;
      const scale = options.bootScale ?? 1;
      const swing = pose.legSwing;
      const frontX = dir.side >= 0 ? stance : -stance;
      const backX = dir.side >= 0 ? -stance : stance;
      const alpha = options.hiddenByRobe ? 0.45 : 0.82;

      drawLeg(ctx, backX, -27, s.pants, swing * 0.22, alpha, scale);
      drawLeg(ctx, frontX, -27, s.pants, -swing * 0.22, 1, scale);
      drawBoot(ctx, backX, 2, dir.side >= 0 ? -1 : 1, s.boots, scale, alpha);
      drawBoot(ctx, frontX, 2, dir.side >= 0 ? 1 : -1, s.boots, scale, 1);
    }

    function drawLeg(ctx, x, y, color, swing, alpha, scale) {
      ctx.save();
      ctx.globalAlpha = alpha;
      poly(ctx, [
        [x - 5 * scale, y],
        [x + 5 * scale, y],
        [x + 6 * scale + swing, y + 20],
        [x + 3 * scale + swing, y + 31],
        [x - 5 * scale + swing, y + 31],
        [x - 6 * scale + swing, y + 20],
      ], color, COLORS.outline, 2);
      ctx.restore();
    }

    function drawBoot(ctx, x, y, footDir, color, scale, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      poly(ctx, [
        [x - 6 * scale, y - 3],
        [x + 5 * scale, y - 3],
        [x + 10 * footDir * scale, y + 2],
        [x + 4 * footDir * scale, y + 6],
        [x - 7 * scale, y + 5],
      ], color, COLORS.outline, 2);
      ctx.restore();
    }

    function drawMerchantPack(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const bx = dir.view === 'front' ? 21 : -side * 22;
      const by = -48;
      poly(ctx, [
        [bx - 13, by - 13], [bx + 10, by - 15], [bx + 15, by + 15], [bx + 9, by + 29], [bx - 14, by + 26], [bx - 17, by - 1],
      ], COLORS.leatherDark, COLORS.outline, 2.5);
      poly(ctx, [
        [bx - 10, by - 8], [bx + 9, by - 10], [bx + 11, by + 10], [bx + 6, by + 22], [bx - 9, by + 20], [bx - 12, by + 2],
      ], COLORS.leather, COLORS.outline, 1.5);
      strokeLine(ctx, bx - 8, by + 3, bx + 8, by + 2, COLORS.leatherHi, 2);
      drawStrap(ctx, bx - 8, by - 5, bx + 7, by + 21, COLORS.leatherHi, 3);
    }

    function drawMerchantCoatBody(ctx, dir, pose, s) {
      const skew = dir.torsoSkew;
      const b = pose.breathe;
      const sway = pose.clothSwing;
      const coat = gradient(ctx, -22, -62, 22, -10, lighten(s.outer, 0.12), s.outer, darken(s.outer, 0.22));
      poly(ctx, [
        [-20 - Math.max(0, -skew * 0.28), -59 + b],
        [19 + Math.max(0, skew * 0.28), -59 + b],
        [23 + skew * 0.15, -36],
        [17 + sway * 0.25, -10],
        [5, -19],
        [-5, -9],
        [-17 + sway * 0.15, -33],
      ], coat, COLORS.outline, 2.5);
      poly(ctx, [
        [-11 + skew * 0.1, -55 + b], [11 + skew * 0.1, -55 + b], [8 + skew * 0.08, -25], [0, -18], [-8 + skew * 0.08, -25],
      ], s.inner, COLORS.outline, 1.5);
      drawTrimLine(ctx, -16, -54 + b, -3, -19, s.trim, 2);
      drawTrimLine(ctx, 16, -54 + b, 3, -19, s.trim, 2);
      if (dir.face) drawSmallButtons(ctx, 0 + skew * 0.06, -47, 4, s.trim);
    }

    function drawMerchantPouchBelt(ctx, dir, pose, s) {
      drawBelt(ctx, -19, -29, 38, 8, COLORS.leatherDark, s.trim);
      drawBeltPouch(ctx, -15, -27, 8, 10, COLORS.leather, s.trim);
      drawBeltPouch(ctx, 14, -27, 10, 12, COLORS.leather, s.trim);
    }

    function drawTradeSatchel(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? -22 : 22;
      drawStrap(ctx, -10 * side, -56, x, -24, COLORS.leatherDark, 3);
      poly(ctx, [[x - 10, -31], [x + 9, -31], [x + 11, -13], [x - 9, -12]], COLORS.leather, COLORS.outline, 2);
      strokeLine(ctx, x - 6, -22, x + 6, -22, s.trim, 1.5);
    }

    function drawMerchantHandProps(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? 27 : -27;
      const y = -35 - pose.armSwing * 0.55;
      drawHand(ctx, x, y, s.skin);
      drawCoinPurse(ctx, x, y + 4, s);
      const otherX = -x;
      drawHand(ctx, otherX, -35 + pose.armSwing * 0.55, s.skin);
    }

    function drawCoinMedallion(ctx, dir, pose, s) {
      if (!dir.face) return;
      strokeLine(ctx, -6, -55 + pose.breathe, 0, -43, COLORS.leatherDark, 1.5);
      strokeLine(ctx, 6, -55 + pose.breathe, 0, -43, COLORS.leatherDark, 1.5);
      circle(ctx, 0, -40, 5.5, s.trim, COLORS.outline, 1.5);
      strokeLine(ctx, -2, -40, 2, -40, COLORS.outline, 1);
    }

    function drawCoinPurse(ctx, x, y, s) {
      circle(ctx, x, y, 7, s.trim, COLORS.outline, 2);
      ctx.fillStyle = COLORS.outline;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x, y + 0.5);
    }

    function drawCookBody(ctx, dir, pose, s) {
      const b = pose.breathe;
      const skew = dir.torsoSkew;
      const shirt = gradient(ctx, -17, -58, 17, -23, lighten(s.inner, 0.14), s.inner, darken(s.inner, 0.2));
      poly(ctx, [
        [-17, -57 + b], [17, -57 + b], [15 + skew * 0.18, -33], [10, -22], [-10, -22], [-15 + skew * 0.18, -33],
      ], shirt, COLORS.outline, 2);
      const apron = gradient(ctx, -15, -55, 15, -3, '#f3ead8', COLORS.clothWhite, '#c7bca8');
      poly(ctx, [
        [-11, -52 + b], [11, -52 + b], [15 + skew * 0.1, -19], [9 + pose.clothSwing * 0.25, -3], [-8 + pose.clothSwing * 0.1, -3], [-15, -19],
      ], apron, COLORS.outline, 2);
      for (let i = -1; i <= 1; i++) {
        drawTrimLine(ctx, i * 5, -47 + b, i * 4, -7, 'rgba(0,0,0,0.18)', 1.5);
      }
      drawBelt(ctx, -16, -27, 32, 7, COLORS.leather, '#d8c8a7');
    }

    function drawCookTowel(ctx, dir, pose, s) {
      const x = dir.side >= 0 ? -19 : 19;
      poly(ctx, [[x, -25], [x + 8, -23], [x + 6, -4], [x - 2, -7]], COLORS.clothWhite, COLORS.outline, 1.5);
      drawTrimLine(ctx, x + 2, -14, x + 7, -13, '#c9bda7', 1);
    }

    function drawCookPan(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? 31 : -31;
      const y = -35 - pose.armSwing * 0.5;
      drawHand(ctx, x - side * 7, y + 3, s.skin);
      ctx.save();
      ctx.rotate(side * 0.05);
      ctx.strokeStyle = COLORS.leatherDark;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - side * 9, y + 3);
      ctx.lineTo(x - side * 27, y + 11);
      ctx.stroke();
      const pan = gradient(ctx, x - 13, y - 9, x + 13, y + 8, '#7d8589', COLORS.metalDark, '#1d2225');
      ctx.fillStyle = pan;
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 10, -0.08 * side, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawHand(ctx, -x + side * 4, -35 + pose.armSwing * 0.5, s.skin);
    }

    function drawClericStaff(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? -27 : 27;
      strokeLine(ctx, x, -7, x + side * 7, -83, COLORS.leather, 5, 'round');
      circle(ctx, x + side * 7, -85, 7, COLORS.clothWhite, COLORS.outline, 2);
      drawTrimLine(ctx, x + side * 2, -79, x + side * 12, -79, s.trim, 2);
      drawTrimLine(ctx, x + side * 7, -84, x + side * 7, -74, s.trim, 2);
    }

    function drawClericRobeBody(ctx, dir, pose, s) {
      const skew = dir.torsoSkew;
      const b = pose.breathe;
      const sway = pose.clothSwing;
      const robe = gradient(ctx, -22, -61, 22, 0, '#f2ead0', s.main, '#958966');
      poly(ctx, [
        [-18, -59 + b], [18, -59 + b], [22 + skew * 0.18, -32], [18 + sway * 0.35, -2], [6, -11], [0, -4], [-7, -11], [-18 + sway * 0.15, -31],
      ], robe, COLORS.outline, 2.5);
      poly(ctx, [[-16, -58 + b], [16, -58 + b], [12, -45], [0, -42], [-12, -45]], '#efe7c9', COLORS.outline, 1.5);
      const stole = dir.face ? s.trim : '#b89a4b';
      poly(ctx, [[-7, -56 + b], [-1, -55 + b], [-2, -7], [-8, -10]], stole, COLORS.outline, 1.2);
      poly(ctx, [[7, -56 + b], [1, -55 + b], [2, -7], [8, -10]], stole, COLORS.outline, 1.2);
      if (dir.face) {
        drawHolyCross(ctx, 0, -32, '#fff7d7', COLORS.outline, 1.2);
        drawTrimLine(ctx, -18, -17, 18, -17, '#e8d99c', 1.2);
        drawTrimLine(ctx, -14, -4, 14, -4, '#e8d99c', 1.2);
      }
    }

    function drawHolyBookOrSymbol(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? 24 : -24;
      const y = -35 - pose.armSwing * 0.25;
      drawHand(ctx, x, y, s.skin);
      poly(ctx, [[x - 9, y - 8], [x + 9, y - 7], [x + 8, y + 8], [x - 9, y + 7]], '#5d3f25', COLORS.outline, 1.5);
      poly(ctx, [[x - 6, y - 5], [x + 6, y - 4], [x + 5, y + 5], [x - 6, y + 5]], '#f4e5b8', null, 0);
      drawHolyCross(ctx, x, y + 1, s.trim, COLORS.outline, 1);
      drawHand(ctx, -x, -35 + pose.armSwing * 0.25, s.skin);
    }

    function drawMinerWorkBody(ctx, dir, pose, s) {
      const b = pose.breathe;
      const skew = dir.torsoSkew;
      const shirt = gradient(ctx, -18, -58, 18, -22, lighten(s.main, 0.1), s.main, darken(s.main, 0.25));
      poly(ctx, [[-18, -56 + b], [17, -57 + b], [16 + skew * 0.15, -31], [8, -20], [-10, -21], [-17 + skew * 0.15, -32]], shirt, COLORS.outline, 2.4);
      drawStrap(ctx, -13, -55 + b, 8, -22, COLORS.leatherDark, 4);
      drawStrap(ctx, 13, -55 + b, -8, -22, COLORS.leatherDark, 4);
      drawBelt(ctx, -18, -28, 36, 8, COLORS.leatherDark, COLORS.metal);
      drawBeltPouch(ctx, 14, -27, 8, 9, '#3a2a1f', COLORS.metal);
      for (let i = 0; i < 5; i++) {
        circle(ctx, -13 + i * 6, -36 + (i % 2), 1.2, 'rgba(235,198,139,0.35)', null, 0);
      }
    }

    function drawPickaxeBackOrHand(ctx, dir, pose, s, backLayer) {
      const side = dir.side || 1;
      if (backLayer) {
        const x = side >= 0 ? -24 : 24;
        strokeLine(ctx, x, -9, x - side * 9, -72, COLORS.leather, 4, 'round');
        strokeLine(ctx, x - side * 23, -75, x + side * 6, -69, COLORS.metal, 5, 'round');
        return;
      }
      const x = side >= 0 ? 28 : -28;
      const y = -34 - pose.armSwing * 0.7;
      drawHand(ctx, x, y, s.skin);
      drawHand(ctx, -x, -34 + pose.armSwing * 0.7, s.skin);
    }

    function drawRecruiterSatchel(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? -23 : 23;
      drawStrap(ctx, 10 * side, -57, x, -22, COLORS.leatherDark, 3);
      poly(ctx, [[x - 10, -29], [x + 9, -28], [x + 10, -10], [x - 9, -10]], '#4c2736', COLORS.outline, 2);
      strokeLine(ctx, x - 6, -19, x + 6, -19, s.trim, 1.5);
    }

    function drawRecruiterCoatBody(ctx, dir, pose, s) {
      const b = pose.breathe;
      const skew = dir.torsoSkew;
      const coat = gradient(ctx, -19, -60, 19, -4, lighten(s.main, 0.16), s.main, darken(s.main, 0.28));
      poly(ctx, [[-18, -59 + b], [18, -59 + b], [21 + skew * 0.1, -30], [14 + pose.clothSwing * 0.25, -4], [4, -11], [0, -3], [-5, -11], [-16, -31]], coat, COLORS.outline, 2.4);
      poly(ctx, [[-12, -55 + b], [12, -55 + b], [8, -35], [0, -30], [-8, -35]], '#3e254e', COLORS.outline, 1.5);
      drawTrimLine(ctx, -16, -55 + b, -2, -5, s.trim, 2);
      drawTrimLine(ctx, 16, -55 + b, 2, -5, s.trim, 2);
      drawBelt(ctx, -17, -27, 34, 7, COLORS.leatherDark, s.trim);
      if (dir.face) drawSmallButtons(ctx, 0, -47, 3, s.trim);
    }

    function drawContractBoard(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? 28 : -28;
      const y = -35 - pose.armSwing * 0.25;
      drawHand(ctx, x - side * 3, y, s.skin);
      const boardX = x + side * 3;
      poly(ctx, [[boardX - 10, y - 15], [boardX + 11, y - 14], [boardX + 12, y + 13], [boardX - 9, y + 12]], '#6a4324', COLORS.outline, 2);
      poly(ctx, [[boardX - 7, y - 11], [boardX + 8, y - 10], [boardX + 9, y + 9], [boardX - 7, y + 8]], '#ead8ad', COLORS.outline, 1);
      strokeLine(ctx, boardX - 4, y - 4, boardX + 5, y - 4, COLORS.brow, 1);
      strokeLine(ctx, boardX - 4, y + 1, boardX + 4, y + 1, COLORS.brow, 1);
      drawHand(ctx, -x, -35 + pose.armSwing * 0.25, s.skin);
    }

    function drawGuardSpear(ctx, dir, pose, s) {
      const side = dir.side || 1;
      const x = side >= 0 ? -28 : 28;
      strokeLine(ctx, x, -3, x + side * 7, -86, COLORS.metalDark, 4, 'round');
      poly(ctx, [[x + side * 7, -97], [x + side * 15, -84], [x + side * 7, -76], [x - side * 1, -84]], COLORS.metal, COLORS.outline, 1.8);
    }

    function drawGuardArmorBody(ctx, dir, pose, s) {
      const b = pose.breathe;
      const skew = dir.torsoSkew;
      const under = gradient(ctx, -19, -58, 19, -21, lighten(s.inner, 0.1), s.inner, darken(s.inner, 0.2));
      poly(ctx, [[-18, -57 + b], [18, -57 + b], [17 + skew * 0.12, -32], [10, -21], [-10, -21], [-17 + skew * 0.12, -32]], under, COLORS.outline, 2);
      const armor = gradient(ctx, -17, -56, 17, -25, COLORS.metal, COLORS.metalMid, COLORS.metalDark);
      poly(ctx, [[-16, -55 + b], [16, -55 + b], [13, -33], [5, -24], [-5, -24], [-13, -33]], armor, COLORS.outline, 2.4);
      drawTrimLine(ctx, -9, -50 + b, 8, -36, 'rgba(255,255,255,0.5)', 2);
      drawBelt(ctx, -18, -27, 36, 7, COLORS.leatherDark, COLORS.metal);
    }

    function drawGuardShoulders(ctx, dir, pose, s) {
      const b = pose.breathe;
      poly(ctx, [[-24, -54 + b], [-13, -61 + b], [-6, -55 + b], [-14, -48 + b]], COLORS.metalDark, COLORS.outline, 2);
      poly(ctx, [[24, -54 + b], [13, -61 + b], [6, -55 + b], [14, -48 + b]], COLORS.metalDark, COLORS.outline, 2);
    }

    function drawGuardShield(ctx, dir, pose, s) {
      if (dir.back) return;
      const side = dir.side || 1;
      const x = side >= 0 ? 27 : -27;
      const y = -33 - pose.armSwing * 0.2;
      poly(ctx, [[x, y - 15], [x + side * 12, y - 8], [x + side * 9, y + 10], [x, y + 17], [x - side * 9, y + 10], [x - side * 12, y - 8]], '#425246', COLORS.outline, 2.2);
      drawTrimLine(ctx, x, y - 12, x, y + 12, COLORS.metal, 2);
      drawTrimLine(ctx, x - side * 7, y - 4, x + side * 7, y - 4, COLORS.metal, 2);
    }

    function drawVillagerLayeredBody(ctx, dir, pose, s) {
      const b = pose.breathe;
      const skew = dir.torsoSkew;
      poly(ctx, [[-16, -57 + b], [16, -57 + b], [15 + skew * 0.1, -32], [8, -21], [-8, -21], [-15 + skew * 0.1, -32]], s.inner, COLORS.outline, 2);
      poly(ctx, [[-14, -54 + b], [-2, -52 + b], [-3, -24], [-12, -27]], s.outer, COLORS.outline, 1.5);
      poly(ctx, [[14, -54 + b], [2, -52 + b], [3, -24], [12, -27]], s.outer, COLORS.outline, 1.5);
      drawBelt(ctx, -16, -27, 32, 7, COLORS.leatherDark, s.trim);
      if (dir.face) drawSmallButtons(ctx, 0, -44, 3, COLORS.leatherHi);
    }

    function drawLayeredArm(ctx, sx, sy, hx, hy, sleeve, cuff, back, s, opts = {}) {
      ctx.save();
      ctx.globalAlpha = back ? 0.82 : 1;
      const ex = sx + (hx - sx) * 0.52;
      const ey = sy + (hy - sy) * 0.45 + 2;
      strokeSegment(ctx, sx, sy, ex, ey, COLORS.outline, 10, 'round');
      strokeSegment(ctx, sx, sy, ex, ey, sleeve, 7, 'round');
      strokeSegment(ctx, ex, ey, hx, hy, COLORS.outline, 9, 'round');
      strokeSegment(ctx, ex, ey, hx, hy, darken(sleeve, 0.12), 6, 'round');
      circle(ctx, ex, ey, 4.2, cuff, COLORS.outline, 1);
      if (opts.rolled) circle(ctx, ex, ey, 4.8, COLORS.clothWhite, COLORS.outline, 1);
      if (opts.gloves) drawHand(ctx, hx, hy, s.glove);
      ctx.restore();
    }

    function drawWideSleeveArm(ctx, sx, sy, hx, hy, sleeve, trim, back, s) {
      ctx.save();
      ctx.globalAlpha = back ? 0.82 : 1;
      strokeSegment(ctx, sx, sy, hx, hy, COLORS.outline, 13, 'round');
      strokeSegment(ctx, sx, sy, hx, hy, sleeve, 10, 'round');
      poly(ctx, [[hx - 6, hy - 5], [hx + 7, hy - 4], [hx + 8, hy + 6], [hx - 7, hy + 6]], sleeve, COLORS.outline, 1.5);
      drawTrimLine(ctx, hx - 6, hy + 3, hx + 6, hy + 3, trim, 2);
      ctx.restore();
    }

    function drawArmoredArm(ctx, sx, sy, hx, hy, s, back) {
      ctx.save();
      ctx.globalAlpha = back ? 0.85 : 1;
      strokeSegment(ctx, sx, sy, hx, hy, COLORS.outline, 11, 'round');
      strokeSegment(ctx, sx, sy, hx, hy, COLORS.metalDark, 8, 'round');
      circle(ctx, sx, sy, 5.8, COLORS.metal, COLORS.outline, 1.3);
      circle(ctx, hx, hy, 4.4, s.glove, COLORS.outline, 1.2);
      ctx.restore();
    }

    function drawHumanHead(ctx, dir, pose, s) {
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      if (!dir.face) {
        const backHair = gradient(ctx, hx - 14, y - 23, hx + 15, y + 14, lighten(s.hair, 0.18), s.hair, darken(s.hair, 0.25));
        poly(ctx, [[hx - 13, y - 11], [hx + 13, y - 11], [hx + 16, y + 4], [hx + 7, y + 16], [hx - 7, y + 16], [hx - 16, y + 4]], backHair, COLORS.outline, 2);
        return;
      }
      const half = dir.faceW * 0.5;
      poly(ctx, [[hx - half, y - 10], [hx + half, y - 10], [hx + half + 2, y + 2], [hx + half * 0.45, y + 13], [hx - half * 0.45, y + 13], [hx - half - 2, y + 2]], s.skin, COLORS.outline, 2);
      ctx.fillStyle = COLORS.cheek;
      ctx.beginPath();
      ctx.ellipse(hx + half * 0.42, y + 6, Math.max(2, half * 0.32), 3, 0, 0, TAU);
      ctx.fill();
      drawFaceDetails(ctx, hx, y, dir, s);
    }

    function drawFaceDetails(ctx, hx, y, dir, s) {
      const persona = s.personality;
      ctx.strokeStyle = COLORS.brow;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      if (dir.view === 'side') {
        const eyeX = dir.side > 0 ? hx + 1 : hx - 6;
        const slope = persona === 'stern' || persona === 'shrewd' ? -1 : 0;
        strokeLine(ctx, eyeX - 1, y - 4 + slope, eyeX + 5, y - 3 - slope, COLORS.brow, 1.3, 'round');
        rect(ctx, eyeX, y - 1, 5, 2, COLORS.ink, null, 0);
        strokeLine(ctx, hx + dir.side * 1, y + 1, hx + dir.side * 4, y + 4, COLORS.skinDark, 1.2, 'round');
      } else {
        const browLift = persona === 'kind' || persona === 'calm' ? 0.5 : -0.5;
        strokeLine(ctx, hx - 9, y - 4 + browLift, hx - 3, y - 4 - browLift, COLORS.brow, 1.4, 'round');
        strokeLine(ctx, hx + 3, y - 4 - browLift, hx + 9, y - 4 + browLift, COLORS.brow, 1.4, 'round');
        rect(ctx, hx - 8, y - 1, 5, 2, COLORS.ink, null, 0);
        rect(ctx, hx + 3, y - 1, 5, 2, COLORS.ink, null, 0);
        strokeLine(ctx, hx, y + 1, hx - 1, y + 5, COLORS.skinDark, 1.2, 'round');
      }
      const mouthY = y + 8;
      const mouthW = persona === 'stern' ? 5 : persona === 'kind' ? 7 : 6;
      strokeLine(ctx, hx - mouthW * 0.5, mouthY, hx + mouthW * 0.5, mouthY + (persona === 'kind' ? 1 : 0), '#6b3f2e', 1.4, 'round');
    }

    function drawSimpleHair(ctx, dir, pose, s) {
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      const hair = gradient(ctx, hx - 13, y - 24, hx + 14, y + 2, lighten(s.hair, 0.25), s.hair, darken(s.hair, 0.25));
      poly(ctx, [[hx - 14, y - 4], [hx - 9, y - 18], [hx, y - 25], [hx + 11, y - 18], [hx + 15, y - 5], [hx + 8, y - 9], [hx, y - 13], [hx - 8, y - 9]], hair, COLORS.outline, 2);
    }

    function drawMerchantCap(ctx, dir, pose, s) {
      drawSimpleHair(ctx, dir, pose, s);
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      poly(ctx, [[hx - 15, y - 10], [hx - 8, y - 22], [hx + 9, y - 22], [hx + 16, y - 10], [hx + 8, y - 6], [hx - 8, y - 6]], s.outer, COLORS.outline, 2);
      circle(ctx, hx, y - 15, 3.5, s.trim, COLORS.outline, 1);
    }

    function drawChefCap(ctx, dir, pose, s) {
      drawSimpleHair(ctx, dir, pose, s);
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      rect(ctx, hx - 10, y - 20, 20, 9, COLORS.clothWhite, COLORS.outline, 2);
      circle(ctx, hx - 10, y - 23, 7, COLORS.clothWhite, COLORS.outline, 1.5);
      circle(ctx, hx, y - 27, 9, COLORS.clothWhite, COLORS.outline, 1.5);
      circle(ctx, hx + 10, y - 23, 7, COLORS.clothWhite, COLORS.outline, 1.5);
      strokeLine(ctx, hx - 8, y - 17, hx + 8, y - 17, '#cdbfa9', 1.2);
    }

    function drawClericHairAndShoulderCloth(ctx, dir, pose, s) {
      drawSimpleHair(ctx, dir, pose, s);
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      poly(ctx, [[hx - 15, y + 11], [hx + 15, y + 11], [hx + 13, y + 18], [hx - 13, y + 18]], '#efe7c9', COLORS.outline, 1.5);
      drawTrimLine(ctx, hx - 12, y + 17, hx + 12, y + 17, s.trim, 1.5);
    }

    function drawMinerHelmet(ctx, dir, pose, s) {
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      drawSimpleHair(ctx, dir, pose, s);
      const helmet = gradient(ctx, hx - 15, y - 23, hx + 15, y - 8, '#766a4f', '#4d4737', '#292721');
      poly(ctx, [[hx - 15, y - 9], [hx - 9, y - 21], [hx + 1, y - 25], [hx + 11, y - 21], [hx + 16, y - 9], [hx + 8, y - 7], [hx - 8, y - 7]], helmet, COLORS.outline, 2);
      rect(ctx, hx - 4, y - 22, 8, 6, COLORS.metal, COLORS.outline, 1.2);
    }

    function drawRecruiterHeadBand(ctx, dir, pose, s) {
      drawSimpleHair(ctx, dir, pose, s);
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      strokeLine(ctx, hx - 14, y - 12, hx + 14, y - 12, s.trim, 3, 'round');
      circle(ctx, hx + 9, y - 12, 3, s.trim, COLORS.outline, 1);
    }

    function drawGuardHelmet(ctx, dir, pose, s) {
      const hx = dir.headX;
      const y = s.headY + pose.breathe;
      const helmet = gradient(ctx, hx - 16, y - 25, hx + 17, y - 4, COLORS.metal, COLORS.metalDark, '#2f363a');
      poly(ctx, [[hx - 16, y - 5], [hx - 11, y - 20], [hx + 1, y - 27], [hx + 14, y - 18], [hx + 17, y - 4], [hx + 10, y - 8], [hx, y - 13], [hx - 10, y - 8]], helmet, COLORS.outline, 2);
      if (dir.face) {
        rect(ctx, hx - 11, y - 6, 22, 4, COLORS.metalDark, COLORS.outline, 1);
      }
    }

    function drawDust(ctx) {
      circle(ctx, -17, -39, 1.2, 'rgba(211,168,96,0.35)', null, 0);
      circle(ctx, 12, -44, 1.1, 'rgba(211,168,96,0.3)', null, 0);
      circle(ctx, 5, -24, 1.2, 'rgba(211,168,96,0.28)', null, 0);
    }

    function drawBelt(ctx, x, y, w, h, fill, buckle) {
      rect(ctx, x, y, w, h, fill, COLORS.outline, 2);
      rect(ctx, -4, y - 1, 8, h + 2, buckle, COLORS.outline, 1.2);
    }

    function drawBeltPouch(ctx, x, y, w, h, fill, trim) {
      poly(ctx, [[x - w * 0.5, y], [x + w * 0.5, y], [x + w * 0.45, y + h], [x - w * 0.45, y + h]], fill, COLORS.outline, 1.5);
      strokeLine(ctx, x - w * 0.35, y + 3, x + w * 0.35, y + 3, trim, 1);
    }

    function drawHand(ctx, x, y, fill = COLORS.skin) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 4.5, 5, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    function drawHolyCross(ctx, x, y, fill, stroke, lineWidth) {
      rect(ctx, x - 1.5, y - 6, 3, 12, fill, stroke, lineWidth);
      rect(ctx, x - 5, y - 2, 10, 3, fill, stroke, lineWidth);
    }

    function drawSmallButtons(ctx, x, y, count, fill) {
      for (let i = 0; i < count; i++) circle(ctx, x, y + i * 6, 1.8, fill, COLORS.outline, 0.8);
    }

    function drawStrap(ctx, x1, y1, x2, y2, color, width) {
      strokeLine(ctx, x1, y1, x2, y2, COLORS.outline, width + 2, 'round');
      strokeLine(ctx, x1, y1, x2, y2, color, width, 'round');
    }

    function drawTrimLine(ctx, x1, y1, x2, y2, color, width = 1.5) {
      strokeLine(ctx, x1, y1, x2, y2, color, width, 'round');
    }

    function strokeSegment(ctx, x1, y1, x2, y2, color, width, cap = 'butt') {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = cap;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 2, x2, y2);
      ctx.stroke();
    }

    function strokeLine(ctx, x1, y1, x2, y2, color, width = 1, cap = 'butt') {
      if (!color || width <= 0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = cap;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function rect(ctx, x, y, w, h, fill, stroke = COLORS.outline, lineWidth = 1) {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
      }
      if (stroke && lineWidth > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, w, h);
      }
    }

    function circle(ctx, x, y, r, fill, stroke = COLORS.outline, lineWidth = 1) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke && lineWidth > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    function poly(ctx, pts, fill, stroke = COLORS.outline, lineWidth = 2) {
      if (!pts || pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke && lineWidth > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    function gradient(ctx, x1, y1, x2, y2, a, b, c) {
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, a);
      g.addColorStop(0.55, b);
      g.addColorStop(1, c);
      return g;
    }

    function lighten(hex, amount) {
      return shiftColor(hex, Math.round(255 * amount));
    }

    function darken(hex, amount) {
      return shiftColor(hex, -Math.round(255 * amount));
    }

    function shiftColor(hex, amt) {
      const clean = String(hex).replace('#', '');
      if (clean.length !== 6) return hex;
      const n = parseInt(clean, 16);
      let r = (n >> 16) + amt;
      let g = ((n >> 8) & 255) + amt;
      let b = (n & 255) + amt;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return `rgb(${r},${g},${b})`;
    }

    return { draw, resolveNpcRole, resolveHumanDirection };
  })();

  DR.render.HumanNpcProceduralModel = HumanNpcProceduralModel;
  window.HumanNpcProceduralModel = HumanNpcProceduralModel;
})();
