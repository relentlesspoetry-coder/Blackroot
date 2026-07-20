(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;
  const OUTLINE = '#110d13';
  const WEB = 'rgba(232,214,255,0.82)';

  const ROLE_PROFILES = {
    skitterer: { body:'#b9a0cf', shell:'#6e547f', accent:'#eee0ff', eye:'#f7f0ff', legs:1.16, abdomen:0.74, thorax:0.86, stance:0.95, fang:1.00, sacs:false, spines:2, silk:false },
    stalker: { body:'#8d5579', shell:'#3a263f', accent:'#d8a7d8', eye:'#ffb6df', legs:1.06, abdomen:0.88, thorax:1.05, stance:1.08, fang:1.45, sacs:false, spines:5, silk:false },
    venom: { body:'#6f8d52', shell:'#263b25', accent:'#a9ff75', eye:'#d7ff96', legs:0.98, abdomen:1.22, thorax:0.94, stance:0.98, fang:1.18, sacs:true, poison:true, spines:2, silk:false },
    cocoon: { body:'#c8bed9', shell:'#6a5b76', accent:'#fff1ff', eye:'#f4e4ff', legs:0.90, abdomen:1.12, thorax:1.04, stance:0.88, fang:0.95, sacs:false, spines:1, silk:true },
    guard: { body:'#7e6f98', shell:'#352a4d', accent:'#d1bfff', eye:'#d1bfff', legs:0.94, abdomen:1.08, thorax:1.20, stance:1.24, fang:0.90, sacs:false, spines:7, armor:true },
    spinner: { body:'#b881d8', shell:'#513269', accent:'#f0c6ff', eye:'#f8e1ff', legs:0.98, abdomen:1.03, thorax:0.88, stance:0.96, fang:0.82, sacs:false, spines:2, silk:true, spinnerets:true },
    widow: { body:'#ddd2f2', shell:'#625371', accent:'#baff93', eye:'#f0ffd8', legs:1.28, abdomen:1.06, thorax:0.78, stance:0.88, fang:1.08, sacs:true, widow:true, spines:2 },
    hatchery: { body:'#a28bbb', shell:'#4c3f62', accent:'#efd8ff', eye:'#fff0be', legs:0.92, abdomen:1.34, thorax:1.26, stance:1.25, fang:0.92, sacs:false, spines:5, armor:true, eggGuard:true },
    binder: { body:'#b7a8cc', shell:'#574866', accent:'#f5e9ff', eye:'#f0d9ff', legs:1.02, abdomen:1.00, thorax:0.96, stance:0.94, fang:0.82, sacs:false, spines:2, silk:true, cuffs:true },
    burster: { body:'#7fab56', shell:'#2d482a', accent:'#c6ff71', eye:'#efff9a', legs:0.92, abdomen:1.42, thorax:0.88, stance:0.88, fang:0.80, sacs:true, poison:true, cracked:true, spines:0 },
    royal_guard: { body:'#916fd0', shell:'#2f214d', accent:'#f0d080', eye:'#ffe9a8', legs:0.98, abdomen:1.12, thorax:1.35, stance:1.32, fang:1.05, armor:true, crest:true, spines:8, royal:true },
    reaver: { body:'#c25f9e', shell:'#402342', accent:'#ffb9ef', eye:'#ffd6ff', legs:1.18, abdomen:0.92, thorax:1.06, stance:1.16, fang:1.32, scythes:true, spines:4, royal:true },
    oracle: { body:'#5f9a72', shell:'#24372d', accent:'#a9f7d0', eye:'#caffdf', legs:1.02, abdomen:1.10, thorax:0.88, stance:0.92, fang:0.82, sacs:true, oracle:true, spines:3, royal:true },
    horror: { body:'#7b624f', shell:'#2d211c', accent:'#d19c63', eye:'#ffbc7e', legs:0.88, abdomen:1.48, thorax:1.42, stance:1.42, fang:1.35, armor:true, jagged:true, spines:10 },
    loom: { body:'#cc78bd', shell:'#4c2b57', accent:'#ffd3f5', eye:'#ffe2ff', legs:1.10, abdomen:1.18, thorax:0.96, stance:1.02, fang:0.85, silk:true, spinnerets:true, ornate:true, royal:true },
    skirr: { body:'#9d71bf', shell:'#2a1d3f', accent:'#ffce7d', eye:'#fff0a8', legs:1.18, abdomen:1.48, thorax:1.52, stance:1.46, fang:1.62, armor:true, brood:true, broodwarden:true, spines:14, bossScale:1.24, spinnerets:true, silk:true, crown:true, scarred:true, fungus:true },
    velyra: { body:'#d7c6ef', shell:'#533d70', accent:'#b4ff9b', eye:'#edffd8', legs:1.38, abdomen:1.26, thorax:1.02, stance:1.05, fang:1.18, sacs:true, widow:true, oracle:true, bossScale:1.22 },
    queen: { body:'#bf6ec8', shell:'#211530', accent:'#ffd980', eye:'#fff0af', legs:1.32, abdomen:1.58, thorax:1.48, stance:1.50, fang:1.55, armor:true, royal:true, queen:true, crest:true, ornate:true, spinnerets:true, spines:12, bossScale:1.42 },
    default: { body:'#9e82bf', shell:'#4b3b5f', accent:'#d8c8f2', eye:'#fff1ff', legs:1.0, abdomen:1.0, thorax:1.0, stance:1.0, fang:1.0, spines:3 }
  };

  function canDraw(enemy) {
    if (!enemy || enemy.kind !== 'enemy') return false;
    const text = String([enemy.rendererId, enemy.spiderRole, enemy.name, enemy.baseType?.name, enemy.bossId, enemy.aiProfile, enemy.baseType?.aiProfile, enemy.family, enemy.baseType?.family].filter(Boolean).join(' ')).toLowerCase();
    return !!(enemy.silkWebCavern || enemy.spiderFamily || text.includes('spider') || text.includes('widow') || text.includes('skirr') || text.includes('velyra') || text.includes('arakh'));
  }

  function roleFor(enemy) {
    const text = String([enemy.spiderRole, enemy.bossId, enemy.name, enemy.baseType?.name, enemy.aiProfile, enemy.baseType?.aiProfile].filter(Boolean).join(' ')).toLowerCase();
    if (text.includes('queen') || text.includes('arakh')) return 'queen';
    if (text.includes('velyra') || text.includes('matron')) return 'velyra';
    if (text.includes('skirr') || text.includes('broodwarden')) return 'skirr';
    if (text.includes('threadjaw') || text.includes('hollowfang')) return 'stalker';
    if (text.includes('old venomsac') || text.includes('venomsac')) return 'venom';
    if (text.includes('cocoon tender')) return 'hatchery';
    if (text.includes('pale spinner')) return 'spinner';
    if (text.includes('chitinmaw')) return 'horror';
    if (text.includes('venom-eye') || text.includes('venom eye')) return 'oracle';
    if (text.includes('egg-heart') || text.includes('egg heart')) return 'hatchery';
    if (text.includes('widow of the loom')) return 'loom';
    if (text.includes('skitter')) return 'skitterer';
    if (text.includes('silkfang') || text.includes('stalker')) return 'stalker';
    if (text.includes('venom sac') || text.includes('poison_caster')) return 'venom';
    if (text.includes('cocoon crawler') || text.includes('rooter')) return 'cocoon';
    if (text.includes('webguard') || text.includes('guard')) return 'guard';
    if (text.includes('brood spinner') || text.includes('ranged_web')) return 'spinner';
    if (text.includes('pale cave widow') || text.includes('widow')) return 'widow';
    if (text.includes('hatchery')) return 'hatchery';
    if (text.includes('binder')) return 'binder';
    if (text.includes('burster')) return 'burster';
    if (text.includes('royal webguard')) return 'royal_guard';
    if (text.includes('reaver')) return 'reaver';
    if (text.includes('oracle')) return 'oracle';
    if (text.includes('horror') || text.includes('chitin')) return 'horror';
    if (text.includes('loom')) return 'loom';
    return 'default';
  }

  function facingProfile(actor) {
    const name = String(actor.facingName || actor._humanoidSheetDirection || '').toLowerCase();
    if (name.includes('north')) return { view:'back', side:name.includes('west') ? -1 : 1, face:false };
    if (name.includes('south')) return { view:'front', side:name.includes('west') ? -1 : 1, face:true };
    if (name.includes('west')) return { view:'side', side:-1, face:true };
    if (name.includes('east')) return { view:'side', side:1, face:true };
    const fx = Number(actor.facingX || 1), fy = Number(actor.facingY || 0);
    if (fy < -0.35) return { view:'back', side:fx < 0 ? -1 : 1, face:false };
    if (fy > 0.35) return { view:'front', side:fx < 0 ? -1 : 1, face:true };
    return { view:'side', side:fx < 0 ? -1 : 1, face:true };
  }

  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function ellipse(ctx, x, y, rx, ry, rot, fill, stroke = OUTLINE, lw = 2) {
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.stroke();
  }

  function poly(ctx, pts, fill, stroke = OUTLINE, lw = 2) {
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function line(ctx, x1, y1, x2, y2, color, lw = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function dot(ctx, x, y, r, fill, stroke = null, lw = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  }

  function qcurve(ctx, sx, sy, cx, cy, ex, ey, color, lw = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    ctx.restore();
  }

  function deterministicNoise(seed) {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawSetae(ctx, x1, y1, x2, y2, normal, count, color, scale = 1, alpha = 0.45, seed = 0) {
    const nx = normal[0], ny = normal[1];
    for (let i = 1; i <= count; i++) {
      const f = i / (count + 1);
      const bx = x1 + (x2 - x1) * f;
      const by = y1 + (y2 - y1) * f;
      const n = deterministicNoise(seed + i * 3.7) - 0.5;
      const len = (2.5 + deterministicNoise(seed + i * 5.1) * 3.8) * scale;
      line(ctx, bx, by, bx + (nx + n * 0.22) * len, by + (ny - Math.abs(n) * 0.18) * len, color, 0.55 * scale, alpha);
    }
  }

  function drawChitinPlateLines(ctx, x, y, rx, ry, p, pose, abdomen = false) {
    ctx.save();
    ctx.strokeStyle = shade(p.accent, abdomen ? -20 : -32);
    ctx.lineWidth = abdomen ? 0.8 : 0.9;
    ctx.globalAlpha = abdomen ? 0.46 : 0.35;
    const rings = abdomen ? 5 : 4;
    for (let i = 0; i < rings; i++) {
      const rr = (i + 1) / (rings + 2);
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(i * 1.7 + pose.time) * 0.6, y + i * 1.2, rx * (1 - rr * 0.18), ry * (0.18 + rr * 0.18), 0.05 * i, 0.1 * Math.PI, 0.92 * Math.PI);
      ctx.stroke();
    }
    if (!abdomen) {
      line(ctx, x - 1, y - ry * 0.62, x + 1, y + ry * 0.35, shade(p.accent, -36), 0.8, 0.38);
      for (let i = -2; i <= 2; i++) {
        qcurve(ctx, x, y - 2, x + i * 6, y - 7, x + i * 10, y - 12, shade(p.accent, -36), 0.5, 0.24);
      }
    }
    ctx.restore();
  }

  function drawCarapaceDamage(ctx, x, y, p, pose, boss = false) {
    ctx.save();
    ctx.strokeStyle = shade(p.accent, boss ? 10 : -14);
    ctx.lineWidth = boss ? 1.1 : 0.85;
    ctx.globalAlpha = 0.42;
    const side = boss ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + side * 6, y - 9);
    ctx.lineTo(x + side * 10, y - 4);
    ctx.lineTo(x + side * 7, y + 1);
    ctx.lineTo(x + side * 13, y + 5);
    ctx.stroke();
    ctx.globalAlpha = 0.20;
    for (let i = 0; i < 7; i++) {
      const px = x - 14 + i * 5 + deterministicNoise(i + pose.time) * 0.7;
      const py = y - 10 + deterministicNoise(i * 4.3) * 19;
      dot(ctx, px, py, 0.45, shade(p.shell, 38), null, 0, 0.9);
    }
    ctx.restore();
  }

  function drawLeg(ctx, sx, sy, ex, ey, joint, p, back = false, blade = false, index = 0, sign = 1) {
    ctx.save();
    ctx.globalAlpha = back ? 0.58 : 1;
    const seed = (index + 1) * 17 + sign * 3;
    const midA = [(sx + joint[0]) / 2, (sy + joint[1]) / 2];
    const midB = [(joint[0] + ex) / 2, (joint[1] + ey) / 2];
    const points = [
      [sx, sy],
      [sx + (midA[0] - sx) * 0.55, sy + (midA[1] - sy) * 0.48 - 2],
      midA,
      [joint[0], joint[1]],
      midB,
      [ex - sign * 8, ey - 2],
      [ex, ey]
    ];
    const segmentWidths = blade ? [8, 7.2, 6.8, 6, 5.2, 4.2] : [7, 6.3, 5.8, 5.1, 4.4, 3.6];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      line(ctx, a[0], a[1], b[0], b[1], OUTLINE, segmentWidths[i] + 1.8, 1);
      line(ctx, a[0], a[1], b[0], b[1], p.shell, segmentWidths[i], 1);
      line(ctx, a[0] + sign * 0.9, a[1] - 0.5, b[0] + sign * 0.9, b[1] - 0.5, shade(p.shell, 42), Math.max(0.55, segmentWidths[i] * 0.18), back ? 0.35 : 0.48);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.max(1, Math.hypot(dx, dy));
      const normal = [-dy / len * sign, dx / len * sign];
      drawSetae(ctx, a[0], a[1], b[0], b[1], normal, i < 2 ? 2 : 3, shade(p.accent, -26), i > 3 ? 0.85 : 0.65, back ? 0.20 : 0.36, seed + i);
      if (!back && Number(p.spines || 0) >= 8 && i > 0 && i < points.length - 2) {
        const barbCount = p.broodwarden ? 3 : 2;
        for (let bidx = 1; bidx <= barbCount; bidx++) {
          const ff = bidx / (barbCount + 1);
          const bx = a[0] + dx * ff;
          const by = a[1] + dy * ff;
          const blen = (p.broodwarden ? 5.8 : 3.8) * (1 - i * 0.055);
          poly(ctx, [[bx, by], [bx + normal[0] * blen + sign * 1.2, by + normal[1] * blen - 1.1], [bx + normal[0] * 1.6 - sign * 1.4, by + normal[1] * 1.6 + 1.4]], shade(p.shell, p.broodwarden ? 20 : 8), OUTLINE, 0.55);
        }
      }
    }
    for (let i = 1; i < points.length - 1; i++) {
      const q = points[i];
      ellipse(ctx, q[0], q[1], Math.max(1.9, segmentWidths[Math.min(i, segmentWidths.length - 1)] * 0.43), Math.max(1.4, segmentWidths[Math.min(i, segmentWidths.length - 1)] * 0.33), 0, shade(p.shell, -36), OUTLINE, 0.8);
      line(ctx, q[0] - sign * 2.6, q[1], q[0] + sign * 2.6, q[1], shade(p.accent, -34), 0.55, 0.5);
    }
    const claw = blade ? p.accent : '#1a1518';
    poly(ctx, [[ex, ey], [ex + sign * 5.5, ey - 2.2], [ex + sign * 3.6, ey + 3.6]], claw, OUTLINE, 0.9);
    poly(ctx, [[ex - sign * 1.6, ey + 0.6], [ex + sign * 3.4, ey + 4.3], [ex - sign * 2.4, ey + 4.6]], shade(claw, 22), OUTLINE, 0.65);
    if (blade) {
      poly(ctx, [[ex-4,ey-2],[ex+8,ey+4],[ex+1,ey+11]], p.accent, OUTLINE, 1.4);
    }
    ctx.restore();
  }

  function drawLegSet(ctx, dir, pose, p, dead = false) {
    const side = dir.side || 1;
    const walk = dead ? 0 : Math.sin(pose.step) * 3.2;
    const stance = p.stance || 1;
    const legScale = p.legs || 1;
    const spread = 18 * stance;
    const rows = [
      { y:-18, len:38, lift:-18, back:true },
      { y:-10, len:44, lift:-7, back:false },
      { y:0, len:41, lift:9, back:false },
      { y:8, len:34, lift:20, back:true }
    ];
    for (const sign of [-1, 1]) {
      const visible = sign === side ? 1 : 0.82;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const sway = (i % 2 ? -walk : walk) * sign;
        const sx = sign * (10 + i * 1.5);
        const sy = r.y;
        const ex = sign * (spread + r.len * legScale * visible) + sway;
        const ey = r.y + r.lift * legScale + Math.abs(walk) * (i % 2 ? 0.08 : -0.05);
        const joint = [sign * (22 + i * 5) + sway * 0.4, r.y + r.lift * 0.35 - 11];
        drawLeg(ctx, sx, sy, ex, ey, joint, p, r.back || sign !== side, !!(p.scythes && i <= 1 && sign === side), i, sign);
      }
    }
  }

  function drawEyes(ctx, dir, p, x, y, boss = false) {
    if (!dir.face) return;
    const principal = boss ? 2.75 : 2.25;
    const small = boss ? 1.65 : 1.35;
    const rowA = [[-6.2,-0.4,principal], [6.1,0.2,principal], [-12.5,1.8,small], [12.8,2.1,small]];
    const rowB = [[-8.6,-5.6,small], [0.2,-6.6,small * 0.95], [8.8,-5.3,small], [15.2,-2.6,small * 0.85]];
    const all = rowA.concat(rowB);
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      const ex = x + e[0] + (deterministicNoise(i * 11.5) - 0.5) * 0.6;
      const ey = y + e[1] + (deterministicNoise(i * 7.2) - 0.5) * 0.5;
      dot(ctx, ex, ey, e[2] + 1.05, OUTLINE, null, 0, 0.92);
      dot(ctx, ex, ey, e[2], '#08070a', null, 0, 1);
      dot(ctx, ex - e[2] * 0.24, ey - e[2] * 0.28, Math.max(0.5, e[2] * 0.42), p.eye || p.accent, null, 0, 0.95);
      dot(ctx, ex + e[2] * 0.34, ey + e[2] * 0.2, Math.max(0.25, e[2] * 0.16), '#ffffff', null, 0, 0.55);
    }
    drawSetae(ctx, x - 12, y - 9, x + 12, y - 8, [0, -1], 7, shade(p.accent, -16), 0.5, 0.34, 88);
  }

  function drawCheliceraeAndPedipalps(ctx, dir, p, pose) {
    if (!dir.face) return;
    const f = p.fang || 1;
    for (const sign of [-1, 1]) {
      ellipse(ctx, sign * 7, -34, 5.0, 6.4, sign * 0.12, shade(p.shell, -18), OUTLINE, 1.2);
      ellipse(ctx, sign * 8.8, -29, 3.5, 4.8, sign * 0.18, shade(p.shell, -34), OUTLINE, 1.0);
      poly(ctx, [[sign*5.3,-27.2],[sign*9.2,-27.6],[sign*(6.4 + f*1.2),-17.6 - f*4.0]], '#eadfd6', OUTLINE, 1.2);
      line(ctx, sign * 7.1, -25.6, sign * (6.4 + f*0.9), -19.8 - f*3.0, shade('#eadfd6', -42), 0.65, 0.65);
      if (p.broodwarden) {
        qcurve(ctx, sign * 6.7, -26.8, sign * (7.8 + f * 0.5), -23.5 - f * 1.5, sign * (7.1 + f), -18.8 - f * 4.4, 'rgba(159,255,93,0.86)', 0.72, 0.72);
        dot(ctx, sign * (6.7 + f * 1.3), -17.8 - f * 4.0, 1.05, 'rgba(181,255,91,0.94)', null, 0, 0.82);
        line(ctx, sign * 4.9, -28.4, sign * 9.8, -25.2, shade(p.shell, 34), 0.7, 0.5);
      }
      qcurve(ctx, sign * 16, -33, sign * 23, -31 + Math.sin(pose.time * 2 + sign) * 1.5, sign * 28, -24, OUTLINE, 4.8, 0.9);
      qcurve(ctx, sign * 16, -33, sign * 23, -31 + Math.sin(pose.time * 2 + sign) * 1.5, sign * 28, -24, shade(p.shell, 12), 2.9, 0.95);
      dot(ctx, sign * 29.5, -23.5, 2.4, shade(p.accent, -14), OUTLINE, 0.8, 0.92);
      drawSetae(ctx, sign * 20, -31, sign * 30, -24, [sign * 0.45, -0.5], 4, shade(p.accent, -18), 0.45, 0.42, 103 + sign);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -27, 4.0, 2.8, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawSpinnerets(ctx, dir, p, pose, abdomenX, abdomenY) {
    const tailY = abdomenY + 14 * (p.abdomen || 1);
    const tailX = abdomenX - (dir.view === 'side' ? dir.side * 10 : 0);
    const alpha = p.spinnerets || p.silk || p.queen || p.ornate ? 0.95 : 0.62;
    ctx.save();
    ctx.globalAlpha *= alpha;
    const count = p.broodwarden ? 3 : 2;
    for (let i = -count; i <= count; i++) {
      const scale = p.broodwarden ? (i === 0 ? 1.26 : Math.abs(i) === 1 ? 0.94 : 0.68) : (i === 0 ? 1.0 : 0.72);
      ellipse(ctx, tailX + i * (p.broodwarden ? 3.1 : 2.8), tailY + Math.abs(i) * 0.8, 2.1 * scale, 4.1 * scale, i * 0.12, shade(p.shell, -18), OUTLINE, 0.7);
      dot(ctx, tailX + i * (p.broodwarden ? 3.1 : 2.8), tailY + 3.8 * scale + Math.abs(i) * 0.8, p.broodwarden ? 0.62 : 0.45, WEB, null, 0, 0.8);
    }
    if (p.silk || p.spinnerets || p.ornate || p.queen) {
      ctx.strokeStyle = WEB;
      ctx.lineWidth = p.ornate ? 1.1 : 0.75;
      ctx.globalAlpha *= 0.72;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(tailX + i * 2, tailY + 5);
        ctx.quadraticCurveTo(tailX + i * 4 + Math.sin(pose.time * 2 + i) * 2, tailY + 15 + i * 2, tailX + i * 13, tailY + 29 + Math.cos(pose.time + i) * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawAbdomenSurface(ctx, x, y, rx, ry, p, pose) {
    drawChitinPlateLines(ctx, x, y, rx, ry, p, pose, true);
    const seedBase = 200;
    for (let i = 0; i < 28; i++) {
      const a = deterministicNoise(seedBase + i * 2.1) * TAU;
      const rr = 0.22 + deterministicNoise(seedBase + i * 4.3) * 0.72;
      const px = x + Math.cos(a) * rx * rr;
      const py = y + Math.sin(a) * ry * rr;
      dot(ctx, px, py, 0.42 + deterministicNoise(i) * 0.35, shade(p.body, deterministicNoise(i * 6) > 0.5 ? 22 : -22), null, 0, 0.34);
    }
    if (p.widow || p.poison || p.queen) {
      const mark = p.poison ? p.accent : p.widow ? '#aaff79' : '#ffd980';
      ctx.save();
      ctx.globalAlpha = 0.48 + Math.sin(pose.time * 2.2) * 0.08;
      poly(ctx, [[x - 5, y - 4], [x, y - 11], [x + 5, y - 4], [x + 3, y + 5], [x - 3, y + 5]], mark, OUTLINE, 0.7);
      ctx.restore();
    }
  }


  function drawBroodling(ctx, x, y, scale, angle, p, seed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ellipse(ctx, 0, 0, 3.5, 2.4, 0, shade(p.shell, 28), OUTLINE, 0.65);
    ellipse(ctx, -3.4, -0.2, 2.3, 1.8, 0, shade(p.body, 16), OUTLINE, 0.55);
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const yy = -2.2 + i * 1.45;
        const len = 5.2 - i * 0.35;
        qcurve(ctx, sign * 0.6, yy, sign * 3.2, yy - 2 + i * 0.8, sign * len, yy + (i - 1.5) * 1.1, shade(p.shell, 12), 0.7, 0.9);
      }
    }
    dot(ctx, 4.0, -0.8, 0.48, p.eye, null, 0, 0.9);
    dot(ctx, 4.0, 0.8, 0.42, p.eye, null, 0, 0.82);
    ctx.restore();
  }

  function drawSkirrBossDetails(ctx, p, pose, dead) {
    if (dead) return;
    const pulse = 0.5 + Math.sin(pose.time * 2.15) * 0.5;

    // Crown/hourglass boss marking and raised dorsal keel on the cephalothorax.
    ctx.save();
    ctx.globalAlpha = 0.62;
    poly(ctx, [[-10,-35],[-3,-45],[0,-38],[4,-46],[11,-35],[6,-29],[-6,-29]], 'rgba(255,206,125,0.72)', OUTLINE, 0.75);
    line(ctx, 0, -47, 0, -13, 'rgba(255,226,154,0.62)', 1.4, 0.76);
    for (let i = -2; i <= 2; i++) {
      qcurve(ctx, i * 6, -36, i * 8, -27, i * 5, -17, shade(p.accent, -14), 0.62, 0.45);
    }
    ctx.restore();

    // Reinforced leg sockets and scarred armor plates.
    ctx.save();
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const sx = sign * (15 + i * 3.0);
        const sy = -32 + i * 9.0;
        ellipse(ctx, sx, sy, 4.6 - i * 0.25, 3.1, sign * 0.25, shade(p.shell, -18), OUTLINE, 0.65);
        line(ctx, sx - sign * 3.2, sy - 1.2, sx + sign * 3.3, sy + 1.1, shade(p.accent, -30), 0.5, 0.48);
      }
    }
    ctx.globalAlpha = 0.55;
    const scar = shade(p.accent, 18);
    qcurve(ctx, 9, -31, 16, -25, 7, -17, scar, 1.0, 0.62);
    qcurve(ctx, -18, -22, -9, -18, -15, -10, scar, 0.85, 0.52);
    line(ctx, 4, -39, 13, -38, shade(p.shell, 46), 0.7, 0.42);
    line(ctx, 5, -36, 17, -34, shade(p.shell, 46), 0.6, 0.34);
    ctx.restore();

    // Bloated brood chamber: stretched abdominal wall, internal egg silhouettes, and silk-wrapped brood bundles.
    ctx.save();
    ctx.globalAlpha = 0.34 + pulse * 0.13;
    const eggFill = 'rgba(246,225,171,0.48)';
    for (let i = 0; i < 9; i++) {
      const a = -2.7 + i * 0.68;
      const rx = 5.4 + deterministicNoise(700 + i) * 2.5;
      const ry = 7.0 + deterministicNoise(740 + i) * 3.0;
      const ex = Math.cos(a) * (17 + deterministicNoise(780 + i) * 12);
      const ey = 4 + Math.sin(a) * (8 + deterministicNoise(820 + i) * 6);
      ellipse(ctx, ex, ey, rx, ry, 0.18 * Math.sin(a), eggFill, 'rgba(42,29,63,0.55)', 0.45);
    }
    ctx.globalAlpha = 0.44;
    for (let i = -5; i <= 5; i++) {
      qcurve(ctx, i * 6, -8, i * 7 + Math.sin(pose.time + i) * 0.8, 6, i * 5, 21, 'rgba(255,229,186,0.38)', 0.55, 0.72);
    }
    ctx.globalAlpha = 0.78;
    for (let i = 0; i < 5; i++) {
      const x = -25 + i * 12;
      ellipse(ctx, x, 28 + (i % 2) * 3, 5.8, 7.6, i * 0.22, '#ead7ef', OUTLINE, 0.75);
      qcurve(ctx, x - 5, 28 + (i % 2) * 3, x, 22 + i % 2, x + 6, 29 + (i % 2) * 3, WEB, 0.7, 0.55);
    }
    ctx.restore();

    // Riding broodlings: readable horror detail without changing the boss silhouette.
    drawBroodling(ctx, -15, -3, 0.72, -0.35, p, 1);
    drawBroodling(ctx, 13, 6, 0.58, 0.42, p, 2);
    drawBroodling(ctx, 4, -16, 0.50, 0.05, p, 3);
    drawBroodling(ctx, -28, 11, 0.46, -0.82, p, 4);

    // Lair trophies, mineral dust, fungus patches and old prey debris embedded in the chitin.
    ctx.save();
    ctx.globalAlpha = 0.78;
    poly(ctx, [[-30,-8],[-25,-11],[-21,-7],[-24,-4]], 'rgba(162,164,154,0.74)', OUTLINE, 0.55);
    line(ctx, -29, -8, -22, -5, 'rgba(218,220,210,0.5)', 0.55, 0.55);
    poly(ctx, [[24,-17],[31,-15],[27,-10]], '#ddd2c0', OUTLINE, 0.55);
    dot(ctx, 22, 17, 1.55, '#d8a84e', '#5f431b', 0.45, 0.75);
    const fungus = 'rgba(137,255,170,0.62)';
    for (let i = 0; i < 6; i++) {
      const fx = -19 + deterministicNoise(900 + i) * 42;
      const fy = -22 + deterministicNoise(950 + i) * 40;
      dot(ctx, fx, fy, 1.0 + deterministicNoise(980 + i) * 0.9, fungus, 'rgba(47,90,57,0.58)', 0.35, 0.48 + pulse * 0.16);
    }
    ctx.restore();
  }

  function drawRoleDetails(ctx, role, p, pose, dead) {
    const pulse = dead ? 0 : 0.5 + Math.sin(pose.time * 3.2) * 0.5;
    if (p.silk || p.spinnerets || p.ornate) {
      ctx.strokeStyle = WEB; ctx.lineWidth = p.ornate ? 2 : 1.3; ctx.globalAlpha = p.ornate ? 0.72 : 0.55;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.moveTo(i * 8, -7); ctx.quadraticCurveTo(i * 7 + Math.sin(pose.time + i) * 4, -28, i * 11, -48); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (p.sacs) {
      const sac = p.poison ? '#a6ff68' : p.accent;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * TAU;
        ctx.globalAlpha = 0.68 + pulse * 0.22;
        ellipse(ctx, Math.cos(a) * 18, 7 + Math.sin(a) * 7, 4.5, 6, 0, sac, OUTLINE, 1.1);
        line(ctx, Math.cos(a) * 18 - 2, 7 + Math.sin(a) * 7, Math.cos(a) * 18 + 2, 7 + Math.sin(a) * 7 + 3, shade(sac, -34), 0.55, 0.5);
      }
      ctx.globalAlpha = 1;
    }
    if (p.cracked) {
      ctx.strokeStyle = '#d7ff72'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7 + pulse * 0.2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-14+i*7, -1+i%2*5); ctx.lineTo(-9+i*7, 13+i%3*2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (p.armor || p.royal || p.jagged) {
      for (let i = -3; i <= 3; i++) {
        poly(ctx, [[i*8-5,-20],[i*8+2,-30],[i*8+8,-20]], p.royal ? '#d0a34d' : shade(p.shell, 16), OUTLINE, 1.1);
        line(ctx, i*8-3, -21, i*8+3, -25, p.royal ? '#ffde8a' : shade(p.shell, 38), 0.7, 0.56);
      }
    }
    if (p.crest || p.queen) {
      const crest = p.queen ? '#ffd980' : p.accent;
      poly(ctx, [[-14,-44],[-5,-61],[0,-48],[6,-62],[15,-44]], crest, OUTLINE, 2);
      line(ctx, -8, -47, 9, -48, shade(crest, -34), 0.8, 0.55);
    }
    if (p.oracle) {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.28 + pulse * 0.18;
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -19, 36, 13, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -34, 9, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (p.brood || p.eggGuard) {
      ctx.fillStyle = '#ead7ef'; ctx.globalAlpha = 0.72;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-22 + i * 14, 22 + (i%2)*3, 5, 7, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (role === 'skirr' || p.broodwarden) {
      drawSkirrBossDetails(ctx, p, pose, dead);
    }
  }


  function drawSpiderWebCastDetail(ctx, dir, p, pose, abdomenX, abdomenY, dead) {
    const cast = Math.max(0, Math.min(1, Number(pose.webCast || 0)));
    if (dead || cast <= 0.01) return;
    const pulse = 0.72 + Math.sin(pose.time * 34) * 0.14;
    const tailY = abdomenY + 17 * (p.abdomen || 1);
    const tailX = abdomenX - (dir.view === 'side' ? dir.side * 11 : 0);
    ctx.save();
    ctx.globalAlpha = Math.min(0.88, cast * 0.92);
    ctx.strokeStyle = 'rgba(242,244,255,0.88)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = -3; i <= 3; i++) {
      const spread = i * 3.2;
      const endX = tailX + spread + Math.sin(pose.time * 26 + i) * 2.4;
      const endY = tailY + 16 + Math.abs(i) * 1.8;
      ctx.lineWidth = (i === 0 ? 1.25 : 0.72) * pulse;
      ctx.beginPath();
      ctx.moveTo(tailX + i * 1.5, tailY);
      ctx.quadraticCurveTo(tailX + i * 4.4, tailY + 6 + cast * 4, endX, endY);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(238,243,255,0.48)';
    ctx.beginPath();
    ctx.ellipse(tailX, tailY + 8, 10 * cast, 5.5 * cast, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    dot(ctx, tailX, tailY + 8, 2.4 + cast * 1.6, 'rgba(245,248,255,0.92)', 'rgba(150,150,170,0.72)', 0.55, 0.95);
    ctx.restore();
  }

  function draw(ctx, actor, nowMs = performance.now()) {
    if (!ctx || !actor) return false;
    const role = roleFor(actor);
    const p = ROLE_PROFILES[role] || ROLE_PROFILES.default;
    const dir = facingProfile(actor);
    const dead = actor.alive === false || actor.dead === true;
    const baseScale = Number(actor.modelScale || actor.scale || 1);
    const bossScale = Number(p.bossScale || 1) * (actor.dungeonBoss ? 1.12 : actor.dungeonMiniBoss ? 1.04 : 1);
    const moving = !dead && (actor.isMoving || Math.abs(actor.vx || 0) + Math.abs(actor.vy || 0) > 0.01 || Number(actor.moveBlend || 0) > 0.05);
    const t = nowMs / 1000;
    const webCast = dead ? 0 : Math.max(0, Math.min(1, Number(actor.spiderWebCastAnim || 0) / 0.85));
    const pose = {
      time:t,
      step:t * (moving ? 8.5 : 1.5),
      bob: moving ? -Math.abs(Math.sin(t*8.5))*1.2 : Math.sin(t*2.0)*0.35,
      webCast
    };

    ctx.save();
    ctx.translate(Math.round(actor.screenX || 0), Math.round((actor.screenY || 0) + pose.bob - webCast * 3.8));
    ctx.scale(baseScale * bossScale, baseScale * bossScale * (dead ? 0.82 : 1));
    if (dead) ctx.rotate(-0.28 * (dir.side || 1));

    const shadow = ctx.createRadialGradient(0, 8, 3, 0, 8, actor.dungeonBoss ? 58 : actor.dungeonMiniBoss ? 46 : 36);
    shadow.addColorStop(0, 'rgba(0,0,0,0.42)'); shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(0, 10, actor.dungeonBoss ? 56 : 38, actor.dungeonBoss ? 16 : 11, 0, 0, TAU); ctx.fill();

    drawLegSet(ctx, dir, pose, p, dead);

    const bodyGlow = (p.poison || p.oracle || p.queen) && !dead;
    if (bodyGlow) {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = p.queen ? 0.24 : 0.18;
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.ellipse(0, -8, 44, 33, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }

    const abdomenX = dir.view === 'side' ? -dir.side * 12 : 0;
    const thoraxX = dir.view === 'side' ? dir.side * 11 : 0;
    const abdomenY = 2 - webCast * 7.5 + Math.sin(t * 36) * webCast * 1.25;
    const thoraxY = -22 + webCast * 2.6;
    const abdomenRx = 23 * (p.abdomen || 1);
    const abdomenRy = 18 * (p.abdomen || 1);
    ellipse(ctx, abdomenX, abdomenY, abdomenRx, abdomenRy, -0.12 * dir.side, p.body, OUTLINE, 2.2);
    drawAbdomenSurface(ctx, abdomenX, abdomenY, abdomenRx, abdomenRy, p, pose);
    drawSpinnerets(ctx, dir, p, pose, abdomenX, abdomenY);
    drawSpiderWebCastDetail(ctx, dir, p, pose, abdomenX, abdomenY, dead);

    const grad = ctx.createLinearGradient(-20, -28, 24, 6);
    grad.addColorStop(0, shade(p.shell, 48)); grad.addColorStop(0.38, shade(p.shell, 10)); grad.addColorStop(0.62, p.shell); grad.addColorStop(1, shade(p.shell, -38));
    const thoraxRx = 21 * (p.thorax || 1);
    const thoraxRy = 16 * (p.thorax || 1);
    ellipse(ctx, thoraxX, thoraxY, thoraxRx, thoraxRy, 0.08 * dir.side, grad, OUTLINE, 2.2);
    drawChitinPlateLines(ctx, thoraxX, thoraxY, thoraxRx, thoraxRy, p, pose, false);
    drawCarapaceDamage(ctx, thoraxX, thoraxY, p, pose, actor.dungeonBoss || actor.dungeonMiniBoss);
    ellipse(ctx, dir.side * 6, -39, 16 * (p.thorax || 1), 11, 0.05 * dir.side, shade(p.shell, 18), OUTLINE, 2);
    drawSetae(ctx, -13 + dir.side * 6, -45, 13 + dir.side * 6, -45, [0, -1], 8, shade(p.accent, -22), 0.52, 0.38, 301);

    // Mandibles, pedipalps, fangs and role-defining front silhouette.
    drawCheliceraeAndPedipalps(ctx, dir, p, pose);
    if (dir.face && (p.scythes || p.jagged || p.queen)) {
      poly(ctx, [[-20,-31],[-34,-49],[-28,-20]], p.accent, OUTLINE, 1.5);
      poly(ctx, [[20,-31],[34,-49],[28,-20]], p.accent, OUTLINE, 1.5);
    }

    drawEyes(ctx, dir, p, dir.view === 'side' ? dir.side * 9 : 0, -43, actor.dungeonBoss || actor.dungeonMiniBoss);
    drawRoleDetails(ctx, role, p, pose, dead);

    // Webbing, prey residue and environmental trace detail.
    if (p.silk || p.spinnerets || p.ornate || role === 'default') {
      ctx.save();
      ctx.strokeStyle = WEB;
      ctx.lineWidth = 0.65;
      ctx.globalAlpha = p.ornate ? 0.42 : 0.25;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-24 + i * 8, -3 + Math.abs(i));
        ctx.quadraticCurveTo(-7 + i * 2, -7 - i * 2, 18 + i * 4, 3 + Math.sin(pose.time + i) * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const sx = -27 + i * 7;
      const sy = -14 + deterministicNoise(410 + i) * 30;
      dot(ctx, sx, sy, 0.38, deterministicNoise(i) > 0.55 ? shade(p.accent, -42) : 'rgba(226,216,190,0.58)', null, 0, 0.35);
    }

    if (actor.dungeonBoss || actor.dungeonMiniBoss) {
      ctx.fillStyle = actor.dungeonBoss ? '#ffd980' : '#f0c6ff';
      ctx.font = actor.dungeonBoss ? 'bold 9px ui-monospace, monospace' : 'bold 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(actor.dungeonBoss ? 'BOSS' : 'ELITE', 0, 30);
    }

    ctx.restore();
    actor._nameplateAnchor = { x: actor.screenX || 0, y: (actor.screenY || 0) - (actor.dungeonBoss ? 96 : actor.dungeonMiniBoss ? 82 : 66) * baseScale * bossScale };
    return true;
  }

  const api = { canDraw, draw, roleFor, profiles: ROLE_PROFILES };
  DR.render.SilkWebSpiderProceduralModel = api;
  window.SilkWebSpiderProceduralModel = api;
})();
