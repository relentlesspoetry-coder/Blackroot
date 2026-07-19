// Dream Realms V0.14.16 Spirit Healer high-detail procedural renderer
// Owns the sacred spirit NPC silhouette, idle hover, wing layering, halo shimmer, respawn anchor, and holy aura.
(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const TAU = Math.PI * 2;

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) * 0.5, Math.abs(h) * 0.5));
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, rr);
      return;
    }
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
  }

  function fillEllipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    ctx.fill();
  }

  function strokeEllipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    ctx.stroke();
  }

  function line(ctx, x1, y1, x2, y2, color, width = 1, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
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

  function diamond(ctx, x, y, r, fill, stroke, lw = 0.75) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.82, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.82, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function makeAuraGradient(ctx, x, y, inner, outer, pulse) {
    const g = ctx.createRadialGradient(x, y, inner, x, y, outer);
    g.addColorStop(0, `rgba(255,255,238,${0.56 + pulse * 0.12})`);
    g.addColorStop(0.28, `rgba(224,244,255,${0.30 + pulse * 0.07})`);
    g.addColorStop(0.64, `rgba(170,220,255,${0.12 + pulse * 0.05})`);
    g.addColorStop(1, 'rgba(120,180,255,0)');
    return g;
  }

  function drawSacredGroundGlyph(ctx, x, baseY, scale, time, pulse, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.28 + pulse * 0.12;
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 0.85 * scale;
    strokeEllipse(ctx, x, baseY - 4 * scale, 16 * scale, 5.2 * scale, 0);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + time * 0.12;
      const r = 14 * scale;
      const gx = x + Math.cos(a) * r;
      const gy = baseY - 4 * scale + Math.sin(a) * r * 0.32;
      diamond(ctx, gx, gy, 1.15 * scale, i % 2 ? 'rgba(214,248,255,0.72)' : 'rgba(255,246,180,0.76)', 'rgba(255,255,255,0.45)', 0.45 * scale);
    }
    ctx.globalAlpha = 0.18 + pulse * 0.08;
    for (let i = 0; i < 5; i++) {
      const a = time * 0.35 + i * TAU / 5;
      line(ctx, x, baseY - 4 * scale, x + Math.cos(a) * 22 * scale, baseY - 4 * scale + Math.sin(a) * 7 * scale, 'rgba(225,250,255,0.75)', 0.7 * scale, 1);
    }
    ctx.restore();
  }

  function drawFloorAura(ctx, x, baseY, scale, time, pulse, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.44 + pulse * 0.13;
    const ground = ctx.createRadialGradient(x, baseY - 3 * scale, 4 * scale, x, baseY - 3 * scale, 42 * scale);
    ground.addColorStop(0, 'rgba(255,250,198,0.55)');
    ground.addColorStop(0.42, 'rgba(160,230,255,0.24)');
    ground.addColorStop(1, 'rgba(90,150,255,0)');
    ctx.fillStyle = ground;
    fillEllipse(ctx, x, baseY - 3 * scale, 38 * scale, 13.5 * scale, 0);

    ctx.globalAlpha = 0.60 + pulse * 0.12;
    ctx.strokeStyle = 'rgba(255,238,166,0.72)';
    ctx.lineWidth = 1.5 * scale;
    strokeEllipse(ctx, x, baseY - 4 * scale, 27 * scale, 8.6 * scale, 0);

    ctx.globalAlpha = 0.30 + pulse * 0.10;
    ctx.strokeStyle = 'rgba(210,248,255,0.65)';
    ctx.lineWidth = 1 * scale;
    for (let i = 0; i < 6; i++) {
      const a = time * 0.45 + i * TAU / 6;
      const r1 = 12 * scale;
      const r2 = 23 * scale;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r1, baseY - 4 * scale + Math.sin(a) * r1 * 0.34);
      ctx.lineTo(x + Math.cos(a) * r2, baseY - 4 * scale + Math.sin(a) * r2 * 0.34);
      ctx.stroke();
    }
    drawSacredGroundGlyph(ctx, x, baseY, scale, time, pulse, palette);
    ctx.restore();
  }

  function drawRespawnAnchor(ctx, x, baseY, scale, time, pulse, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ax = x + 30 * scale;
    const ay = baseY - 16 * scale + Math.sin(time * 1.1) * 0.8 * scale;

    ctx.globalAlpha = 0.16 + pulse * 0.05;
    ctx.strokeStyle = 'rgba(215,248,255,0.72)';
    ctx.lineWidth = 0.75 * scale;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.95 + i * Math.PI * 0.18 + Math.sin(time * 0.5 + i) * 0.04;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + Math.cos(a) * 15 * scale, ay + Math.sin(a) * 9 * scale, ax + Math.cos(a) * 30 * scale, ay + Math.sin(a) * 16 * scale);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.58 + pulse * 0.14;
    const g = ctx.createRadialGradient(ax, ay, 1 * scale, ax, ay, 18 * scale);
    g.addColorStop(0, 'rgba(255,255,235,0.90)');
    g.addColorStop(0.45, 'rgba(170,235,255,0.36)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    fillEllipse(ctx, ax, ay, 13 * scale, 18 * scale, 0);

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = 'rgba(248,255,255,0.70)';
    ctx.lineWidth = 1.0 * scale;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 13 * scale);
    ctx.lineTo(ax + 7 * scale, ay - 1 * scale);
    ctx.lineTo(ax, ay + 13 * scale);
    ctx.lineTo(ax - 7 * scale, ay - 1 * scale);
    ctx.closePath();
    ctx.stroke();
    diamond(ctx, ax, ay, 4.2 * scale, 'rgba(255,255,224,0.78)', 'rgba(246,255,255,0.58)', 0.8 * scale);

    ctx.globalAlpha = 0.42 + pulse * 0.12;
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 0.7 * scale;
    strokeEllipse(ctx, ax, ay + 9 * scale, 11 * scale, 4.2 * scale, 0);
    ctx.restore();
  }

  function drawBackAura(ctx, x, y, scale, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.60 + pulse * 0.09;
    ctx.fillStyle = makeAuraGradient(ctx, x, y - 42 * scale, 4 * scale, 70 * scale, pulse);
    ctx.beginPath();
    ctx.arc(x, y - 42 * scale, 70 * scale, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.20 + pulse * 0.05;
    ctx.strokeStyle = 'rgba(255,250,200,0.72)';
    ctx.lineWidth = 2 * scale;
    strokeEllipse(ctx, x, y - 39 * scale, 46 * scale, 60 * scale, 0);
    ctx.restore();
  }

  function drawFeather(ctx, x, y, side, scale, len, width, rot, fill, stroke, alpha, quill = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.68 * scale;
    ctx.beginPath();
    ctx.moveTo(0, -width * 0.22);
    ctx.quadraticCurveTo(side * len * 0.42, -width * 1.45, side * len, 0);
    ctx.quadraticCurveTo(side * len * 0.46, width * 1.36, 0, width * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (quill) {
      line(ctx, 0, 0, side * len * 0.86, 0, 'rgba(255,255,245,0.70)', 0.55 * scale, 0.85);
      for (let i = 1; i <= 3; i++) {
        const p = i / 4;
        const qx = side * len * p;
        line(ctx, qx, 0, qx - side * len * 0.10, -width * (0.34 + p * 0.34), 'rgba(240,255,255,0.38)', 0.35 * scale, 0.55);
        line(ctx, qx, 0, qx - side * len * 0.10, width * (0.34 + p * 0.30), 'rgba(240,255,255,0.32)', 0.35 * scale, 0.50);
      }
    }
    ctx.restore();
  }

  function drawWing(ctx, x, y, side, scale, time, flap, palette) {
    const open = 1 + flap * 0.075;
    const lift = flap * 3.0 * scale;
    const rootX = x + side * 10 * scale;
    const rootY = y - 51 * scale + lift * 0.3;
    const tipX = x + side * (52 * open) * scale;
    const lowerTipY = y - 18 * scale + lift * 0.55;

    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.fillStyle = palette.wingShadow;
    ctx.strokeStyle = palette.wingStroke;
    ctx.lineWidth = 1.35 * scale;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.bezierCurveTo(x + side * 25 * scale, y - 82 * scale - lift, tipX, y - 64 * scale - lift, tipX + side * 4 * scale, y - 35 * scale);
    ctx.bezierCurveTo(x + side * 43 * scale, lowerTipY, x + side * 17 * scale, y - 18 * scale, rootX - side * 2 * scale, y - 32 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Long primary feathers.
    ctx.globalAlpha = 0.96;
    for (let i = 0; i < 8; i++) {
      const p = i / 7;
      const featherX = rootX + side * (10 + p * 39 * open) * scale;
      const featherY = y - (62 - p * 38) * scale - lift * (0.90 - p * 0.55);
      const featherLen = (30 - i * 1.95) * scale;
      const featherWidth = (5.9 - i * 0.25) * scale;
      const rot = side * (0.78 - p * 0.62 + flap * 0.04);
      const shade = i % 2 === 0 ? palette.wingFeather : palette.wingFeatherAlt;
      drawFeather(ctx, featherX, featherY, side, scale, featherLen, featherWidth, rot, shade, 'rgba(246,255,255,0.50)', 0.80 + p * 0.10, true);
    }

    // Smaller covert feathers layered near wing root.
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5; i++) {
        const p = i / 4;
        const fx = rootX + side * (6 + p * 25) * scale;
        const fy = rootY + (5 + row * 5 + p * 12) * scale - lift * 0.15;
        const rot = side * (0.35 - p * 0.18 + row * 0.05);
        drawFeather(ctx, fx, fy, side, scale, (11 - row * 1.2) * scale, (3.2 - row * 0.25) * scale, rot, row % 2 ? 'rgba(232,250,255,0.46)' : 'rgba(255,255,248,0.50)', 'rgba(255,255,255,0.30)', 0.55, true);
      }
    }

    ctx.globalAlpha = 0.54;
    ctx.strokeStyle = 'rgba(255,255,238,0.72)';
    ctx.lineWidth = 1.1 * scale;
    for (let i = 0; i < 5; i++) {
      const p = i / 4;
      ctx.beginPath();
      ctx.moveTo(rootX + side * 4 * scale, rootY + (i - 2) * 3 * scale);
      ctx.quadraticCurveTo(
        x + side * (24 + p * 10) * scale,
        y - (61 - p * 26) * scale - lift * (0.6 - p * 0.2),
        x + side * (40 + p * 7) * scale,
        y - (49 - p * 31) * scale
      );
      ctx.stroke();
    }

    // Dissolving feather-tip motes.
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const p = i / 3;
      const phase = time * 0.65 + i * 1.7 + (side < 0 ? 2.1 : 0.4);
      ctx.globalAlpha = 0.18 + 0.10 * Math.sin(phase);
      ctx.fillStyle = i % 2 ? 'rgba(225,250,255,0.76)' : 'rgba(255,246,190,0.76)';
      fillEllipse(ctx, x + side * (48 + p * 9) * scale, y - (55 - p * 40) * scale + Math.sin(phase) * 3 * scale, (1.1 + p * 0.4) * scale, (1.1 + p * 0.35) * scale, 0);
    }
    ctx.restore();
  }

  function drawRobe(ctx, x, y, scale, time, drift, palette) {
    ctx.save();
    const sway = Math.sin(time * 1.35) * 1.5 * scale;

    ctx.globalAlpha = 0.36;
    ctx.fillStyle = 'rgba(72,150,190,0.34)';
    ctx.beginPath();
    ctx.moveTo(x - 15 * scale, y - 42 * scale);
    ctx.bezierCurveTo(x - 34 * scale + sway, y - 16 * scale, x - 24 * scale, y + 8 * scale, x - 4 * scale, y + 18 * scale);
    ctx.bezierCurveTo(x - 12 * scale, y + 5 * scale, x - 11 * scale, y - 21 * scale, x - 15 * scale, y - 42 * scale);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 15 * scale, y - 42 * scale);
    ctx.bezierCurveTo(x + 34 * scale + sway, y - 16 * scale, x + 24 * scale, y + 8 * scale, x + 4 * scale, y + 18 * scale);
    ctx.bezierCurveTo(x + 12 * scale, y + 5 * scale, x + 11 * scale, y - 21 * scale, x + 15 * scale, y - 42 * scale);
    ctx.fill();

    ctx.globalAlpha = 0.98;
    const robe = ctx.createLinearGradient(x, y - 62 * scale, x, y + 22 * scale);
    robe.addColorStop(0, palette.robeLight);
    robe.addColorStop(0.42, palette.robeMid);
    robe.addColorStop(1, palette.robeTransparent);
    ctx.fillStyle = robe;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.3 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 17 * scale, y - 51 * scale);
    ctx.bezierCurveTo(x - 24 * scale + sway, y - 31 * scale, x - 22 * scale, y - 4 * scale, x - 4 * scale, y + 20 * scale + drift * 0.22);
    ctx.bezierCurveTo(x - 1 * scale, y + 25 * scale, x + 1 * scale, y + 25 * scale, x + 4 * scale, y + 20 * scale + drift * 0.22);
    ctx.bezierCurveTo(x + 22 * scale, y - 4 * scale, x + 24 * scale + sway, y - 31 * scale, x + 17 * scale, y - 51 * scale);
    ctx.bezierCurveTo(x + 9 * scale, y - 58 * scale, x - 9 * scale, y - 58 * scale, x - 17 * scale, y - 51 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // V-neck, sash and moving constellation embroidery.
    ctx.globalAlpha = 0.74;
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 1.25 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 6 * scale, y - 51 * scale);
    ctx.bezierCurveTo(x - 8 * scale, y - 24 * scale, x - 6 * scale, y - 1 * scale, x - 2 * scale, y + 14 * scale);
    ctx.moveTo(x + 6 * scale, y - 51 * scale);
    ctx.bezierCurveTo(x + 8 * scale, y - 24 * scale, x + 6 * scale, y - 1 * scale, x + 2 * scale, y + 14 * scale);
    ctx.stroke();

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.42 + Math.sin(time * 1.4) * 0.05;
    ctx.strokeStyle = 'rgba(255,246,175,0.72)';
    ctx.lineWidth = 1.15 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 17 * scale, y - 24 * scale);
    ctx.quadraticCurveTo(x, y - 18 * scale + Math.sin(time * 1.2) * 0.8 * scale, x + 17 * scale, y - 25 * scale);
    ctx.stroke();
    line(ctx, x + 8 * scale, y - 22 * scale, x + 22 * scale + sway, y - 3 * scale, 'rgba(255,246,175,0.58)', 0.9 * scale, 0.8);
    line(ctx, x + 11 * scale, y - 22 * scale, x + 17 * scale + sway * 0.5, y + 10 * scale, 'rgba(225,250,255,0.46)', 0.7 * scale, 0.7);

    ctx.globalAlpha = 0.30 + Math.sin(time * 1.6) * 0.06;
    ctx.fillStyle = palette.coreGlow;
    fillEllipse(ctx, x, y - 29 * scale, 9 * scale, 24 * scale, 0);

    ctx.globalAlpha = 0.34;
    for (let i = 0; i < 9; i++) {
      const sx = x + ((i * 13) % 26 - 13) * scale + Math.sin(time * 0.4 + i) * 0.8 * scale;
      const sy = y - (41 - (i % 5) * 11) * scale;
      const r = (0.75 + (i % 3) * 0.22) * scale;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,246,188,0.74)' : 'rgba(220,250,255,0.58)';
      fillEllipse(ctx, sx, sy, r, r, 0);
    }

    // Hem dissolution.
    for (let i = 0; i < 5; i++) {
      const hx = x + (-14 + i * 7) * scale;
      const hy = y + (16 + Math.sin(time * 1.1 + i) * 3) * scale;
      ctx.globalAlpha = 0.18 + i * 0.025;
      ctx.fillStyle = 'rgba(215,248,255,0.70)';
      fillEllipse(ctx, hx, hy, (1.2 + i * 0.08) * scale, (1.0 + i * 0.08) * scale, 0);
    }
    ctx.restore();
  }

  function drawArmsAndSleeves(ctx, x, y, scale, time, palette) {
    const drift = Math.sin(time * 1.2) * 1.2 * scale;
    ctx.save();
    ctx.globalAlpha = 0.90;
    ctx.fillStyle = palette.sleeve;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1 * scale;

    ctx.beginPath();
    ctx.moveTo(x - 14 * scale, y - 43 * scale);
    ctx.bezierCurveTo(x - 32 * scale, y - 32 * scale + drift, x - 30 * scale, y - 17 * scale, x - 18 * scale, y - 16 * scale);
    ctx.bezierCurveTo(x - 22 * scale, y - 26 * scale, x - 19 * scale, y - 35 * scale, x - 10 * scale, y - 43 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 14 * scale, y - 43 * scale);
    ctx.bezierCurveTo(x + 32 * scale, y - 32 * scale - drift, x + 30 * scale, y - 17 * scale, x + 18 * scale, y - 16 * scale);
    ctx.bezierCurveTo(x + 22 * scale, y - 26 * scale, x + 19 * scale, y - 35 * scale, x + 10 * scale, y - 43 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Translucent forearm lines and bracelets.
    ctx.globalAlpha = 0.40;
    line(ctx, x - 16 * scale, y - 35 * scale, x - 21 * scale, y - 18 * scale + drift * 0.5, 'rgba(255,255,255,0.70)', 0.55 * scale, 1);
    line(ctx, x + 16 * scale, y - 35 * scale, x + 21 * scale, y - 18 * scale - drift * 0.5, 'rgba(255,255,255,0.70)', 0.55 * scale, 1);
    strokeEllipse(ctx, x - 20 * scale, y - 20 * scale + drift * 0.5, 4.2 * scale, 1.5 * scale, -0.18);
    strokeEllipse(ctx, x + 20 * scale, y - 20 * scale - drift * 0.5, 4.2 * scale, 1.5 * scale, 0.18);

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = 'rgba(255,248,190,0.66)';
    fillEllipse(ctx, x - 20 * scale, y - 18 * scale + drift * 0.5, 5.0 * scale, 4.3 * scale, 0);
    fillEllipse(ctx, x + 20 * scale, y - 18 * scale - drift * 0.5, 5.0 * scale, 4.3 * scale, 0);
    ctx.globalAlpha = 0.34;
    line(ctx, x - 23 * scale, y - 16 * scale + drift * 0.5, x - 29 * scale, y - 8 * scale + Math.sin(time * 1.1) * scale, palette.gold, 0.75 * scale, 1);
    line(ctx, x + 23 * scale, y - 16 * scale - drift * 0.5, x + 29 * scale, y - 8 * scale + Math.cos(time * 1.1) * scale, palette.gold, 0.75 * scale, 1);
    ctx.restore();
  }

  function drawHairWisps(ctx, x, y, scale, time, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(238,252,255,0.56)';
    ctx.lineWidth = 0.75 * scale;
    for (let i = 0; i < 7; i++) {
      const side = i < 3 ? -1 : (i > 3 ? 1 : 0);
      const off = (i - 3) * 2.1 * scale;
      const phase = time * 0.9 + i * 0.8;
      ctx.globalAlpha = 0.38 + (i % 2) * 0.08;
      ctx.beginPath();
      ctx.moveTo(x + off, y - 75 * scale);
      ctx.bezierCurveTo(
        x + off + side * (5 + Math.sin(phase) * 2) * scale,
        y - 61 * scale,
        x + off + side * (7 + Math.cos(phase) * 2) * scale,
        y - 50 * scale,
        x + off + side * (4 + Math.sin(phase * 0.7) * 2) * scale,
        y - 43 * scale
      );
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      fillEllipse(ctx, x + off + side * 6 * scale, y - 43 * scale + Math.sin(phase) * scale, 1.0 * scale, 1.0 * scale, 0);
    }
    ctx.restore();
  }

  function drawHeadAndHalo(ctx, x, y, scale, time, pulse, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const hy = y - 82 * scale + Math.sin(time * 1.5) * 0.8 * scale;
    ctx.globalAlpha = 0.76 + pulse * 0.09;
    ctx.strokeStyle = 'rgba(255,241,166,0.95)';
    ctx.lineWidth = 2.6 * scale;
    strokeEllipse(ctx, x, hy, 16 * scale, 5.0 * scale, 0);
    ctx.globalAlpha = 0.31 + pulse * 0.08;
    ctx.strokeStyle = 'rgba(238,255,255,0.78)';
    ctx.lineWidth = 1.1 * scale;
    strokeEllipse(ctx, x, y - 82 * scale, 24 * scale, 7.6 * scale, 0);
    ctx.globalAlpha = 0.22 + pulse * 0.06;
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    for (let i = 0; i < 4; i++) {
      const a = time * 0.38 + i * TAU / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 11 * scale, hy + Math.sin(a) * 3.2 * scale);
      ctx.lineTo(x + Math.cos(a) * 19 * scale, hy + Math.sin(a) * 5.7 * scale);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const a = time * 0.6 + i * TAU / 5;
      diamond(ctx, x + Math.cos(a) * 18 * scale, hy + Math.sin(a) * 5.2 * scale, 1.0 * scale, 'rgba(255,246,188,0.80)', null, 0);
    }
    ctx.restore();

    drawHairWisps(ctx, x, y, scale, time, palette);

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = 'rgba(192,224,232,0.82)';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.ellipse(x, y - 67 * scale, 9.5 * scale, 11.5 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Luminous eyes, soft smile, and brow crown points.
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.68 + pulse * 0.10;
    ctx.fillStyle = 'rgba(255,255,240,0.82)';
    fillEllipse(ctx, x - 3.2 * scale, y - 67.5 * scale, 1.55 * scale, 1.95 * scale, 0);
    fillEllipse(ctx, x + 3.2 * scale, y - 67.5 * scale, 1.55 * scale, 1.95 * scale, 0);
    ctx.globalAlpha = 0.32;
    fillEllipse(ctx, x - 3.2 * scale, y - 66.7 * scale, 4.2 * scale, 3.2 * scale, 0);
    fillEllipse(ctx, x + 3.2 * scale, y - 66.7 * scale, 4.2 * scale, 3.2 * scale, 0);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.60;
    ctx.strokeStyle = 'rgba(188,216,226,0.60)';
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.moveTo(x - 2.8 * scale, y - 62.5 * scale);
    ctx.quadraticCurveTo(x, y - 60.7 * scale, x + 2.8 * scale, y - 62.5 * scale);
    ctx.stroke();

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.44 + pulse * 0.12;
    ctx.fillStyle = palette.coreGlow;
    fillEllipse(ctx, x, y - 67 * scale, 14.5 * scale, 16.5 * scale, 0);
    ctx.globalAlpha = 0.50;
    diamond(ctx, x, y - 77.5 * scale, 1.6 * scale, 'rgba(255,246,190,0.86)', null, 0);
    diamond(ctx, x - 5.2 * scale, y - 75.5 * scale, 1.0 * scale, 'rgba(224,250,255,0.72)', null, 0);
    diamond(ctx, x + 5.2 * scale, y - 75.5 * scale, 1.0 * scale, 'rgba(224,250,255,0.72)', null, 0);
    ctx.restore();
  }

  function drawHolyMotes(ctx, x, y, scale, time, pulse) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 13; i++) {
      const phase = time * (0.34 + i * 0.029) + i * 1.721;
      const radius = (16 + (i % 5) * 8) * scale;
      const mx = x + Math.cos(phase) * radius;
      const my = y - (34 + (i % 4) * 13) * scale + Math.sin(phase * 1.7) * 5 * scale;
      const alpha = 0.16 + 0.18 * (0.5 + 0.5 * Math.sin(phase * 2.1)) + pulse * 0.04;
      ctx.globalAlpha = clamp(alpha, 0.10, 0.46);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,248,188,0.86)' : 'rgba(210,248,255,0.78)';
      fillEllipse(ctx, mx, my, (1.25 + (i % 3) * 0.35) * scale, (1.25 + (i % 2) * 0.32) * scale, 0);
    }
    ctx.restore();
  }

  function drawSpiritAttendants(ctx, x, y, scale, time, pulse, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const phase = time * (0.34 + i * 0.06) + i * 1.37;
      const rx = (25 + i * 5) * scale;
      const ry = (12 + (i % 3) * 5) * scale;
      const mx = x + Math.cos(phase) * rx;
      const my = y - (48 + (i % 2) * 13) * scale + Math.sin(phase) * ry;
      ctx.globalAlpha = 0.24 + pulse * 0.06;
      ctx.fillStyle = i % 2 ? 'rgba(210,248,255,0.62)' : 'rgba(255,244,190,0.62)';
      fillEllipse(ctx, mx, my, 3.2 * scale, 4.1 * scale, Math.sin(phase) * 0.4);
      ctx.globalAlpha = 0.34;
      fillEllipse(ctx, mx, my - 1.0 * scale, 1.2 * scale, 1.2 * scale, 0);
      line(ctx, mx, my + 2 * scale, mx - Math.cos(phase) * 5 * scale, my + 7 * scale, 'rgba(220,250,255,0.35)', 0.65 * scale, 1);
    }
    ctx.restore();
  }

  function draw(ctx, actor = {}, now = 0) {
    if (!ctx || !actor) return false;
    const x = safeNumber(actor.screenX, null);
    const baseY = safeNumber(actor.screenY, null);
    if (!Number.isFinite(x) || !Number.isFinite(baseY)) return false;

    const time = safeNumber(now, (typeof performance !== 'undefined' ? performance.now() : Date.now())) * 0.001;
    const close = !!actor.close;
    const visualScale = clamp(safeNumber(actor.visualScale, 1), 0.72, 1.32) * (close ? 1.04 : 1.0);
    const bob = Math.sin(time * 1.35) * 4.0 * visualScale;
    const drift = Math.sin(time * 1.82 + 0.7) * 2.0 * visualScale;
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.18);
    const flap = Math.sin(time * 1.05);
    const y = baseY - 3 * visualScale + bob;

    const palette = {
      outline: 'rgba(138,176,190,0.54)',
      gold: 'rgba(255,232,150,0.88)',
      coreGlow: 'rgba(222,252,255,0.88)',
      robeLight: 'rgba(255,255,248,0.95)',
      robeMid: 'rgba(222,246,255,0.74)',
      robeTransparent: 'rgba(176,222,245,0.20)',
      sleeve: 'rgba(238,252,255,0.78)',
      wingShadow: 'rgba(210,238,246,0.44)',
      wingStroke: 'rgba(242,255,255,0.56)',
      wingFeather: 'rgba(250,255,255,0.68)',
      wingFeatherAlt: 'rgba(222,246,255,0.56)'
    };

    ctx.save();
    drawFloorAura(ctx, x, baseY, visualScale, time, pulse, palette);
    drawRespawnAnchor(ctx, x, baseY, visualScale, time, pulse, palette);
    drawBackAura(ctx, x, y, visualScale, pulse);
    drawWing(ctx, x, y, -1, visualScale, time, flap, palette);
    drawWing(ctx, x, y, 1, visualScale, time, -flap, palette);
    drawRobe(ctx, x, y, visualScale, time, drift, palette);
    drawArmsAndSleeves(ctx, x, y, visualScale, time, palette);
    drawHeadAndHalo(ctx, x, y, visualScale, time, pulse, palette);
    drawSpiritAttendants(ctx, x, y, visualScale, time, pulse, palette);
    drawHolyMotes(ctx, x, y, visualScale, time, pulse);
    ctx.restore();

    const anchor = {
      x,
      y: y - 96 * visualScale
    };
    actor._nameplateAnchor = anchor;
    actor._spiritHealerDedicatedRenderer = true;
    actor._spiritHealerRendererVersion = 'spirit-healer-high-detail-v0.14.16';
    if (actor.sourceEntity && typeof actor.sourceEntity === 'object') {
      actor.sourceEntity._nameplateAnchor = anchor;
      actor.sourceEntity._spiritHealerDedicatedRenderer = true;
      actor.sourceEntity._spiritHealerRendererVersion = 'spirit-healer-high-detail-v0.14.16';
    }
    return true;
  }

  const api = Object.freeze({ draw });
  DR.render.SpiritHealerProceduralModel = api;
  window.SpiritHealerProceduralModel = api;
})();
