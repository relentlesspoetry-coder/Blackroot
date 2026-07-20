(function() {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};
  DR.render = DR.render || {};

  const DIRS = Object.freeze({
    north: { side: 0, front: 0, back: 1, diag: 0 },
    northeast: { side: 0.7, front: 0, back: 0.65, diag: 1 },
    east: { side: 1, front: 0, back: 0, diag: 0 },
    southeast: { side: 0.7, front: 0.72, back: 0, diag: 1 },
    south: { side: 0, front: 1, back: 0, diag: 0 },
    southwest: { side: -0.7, front: 0.72, back: 0, diag: 1 },
    west: { side: -1, front: 0, back: 0, diag: 0 },
    northwest: { side: -0.7, front: 0, back: 0.65, diag: 1 }
  });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(Number(v)) ? Number(v) : 0));

  function colorShade(hex, amt) {
    const src = String(hex || '#000000').replace('#', '');
    const full = src.length === 3 ? src.split('').map(ch => ch + ch).join('') : src.padEnd(6, '0').slice(0, 6);
    const vals = [0, 2, 4].map(i => clamp(parseInt(full.slice(i, i + 2), 16) + amt, 0, 255));
    return '#' + vals.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }

  function normalizeFacing(name) {
    const key = String(name || 'south').toLowerCase().replace(/[\s_\-]/g, '');
    const map = {
      n: 'north', north: 'north', up: 'north', back: 'north',
      ne: 'northeast', northeast: 'northeast', upright: 'northeast',
      e: 'east', east: 'east', right: 'east',
      se: 'southeast', southeast: 'southeast', downright: 'southeast',
      s: 'south', south: 'south', down: 'south', front: 'south',
      sw: 'southwest', southwest: 'southwest', downleft: 'southwest',
      w: 'west', west: 'west', left: 'west',
      nw: 'northwest', northwest: 'northwest', upleft: 'northwest'
    };
    return map[key] || 'south';
  }

  function speciesOf(actor) {
    const petType = String(actor?.petType || '').toLowerCase();
    const model = String(actor?.visualModel || actor?.petVisualModel || '').toLowerCase();
    const klass = String(actor?.className || '').toLowerCase();
    const name = String(actor?.name || '').toLowerCase();
    if (petType === 'undead' || model.includes('bone') || klass === 'necromancer' || name.includes('bone') || name.includes('skeleton')) return 'necro';
    return 'summonerShard';
  }

  function path(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function poly(ctx, points, fill, stroke = null, width = 1.4, alpha = 1) {
    if (!points || points.length < 3) return;
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    path(ctx, points);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
    ctx.restore();
  }

  function ellipse(ctx, x, y, rx, ry, fill, alpha = 1, stroke = null, width = 1.3, rot = 0) {
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
    ctx.restore();
  }

  function line(ctx, x1, y1, x2, y2, stroke, width = 2.5, alpha = 1) {
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }

  function glow(ctx, x, y, radius, color, alpha = 0.35) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrystalShard(ctx, cx, cy, w, h, fill, stroke, lean = 0, alpha = 1) {
    const pts = [
      { x: cx, y: cy - h * 0.62 },
      { x: cx + w * 0.38 + lean, y: cy - h * 0.23 },
      { x: cx + w * 0.24 + lean * 0.4, y: cy + h * 0.28 },
      { x: cx + w * 0.03, y: cy + h * 0.66 },
      { x: cx - w * 0.26 + lean * 0.2, y: cy + h * 0.30 },
      { x: cx - w * 0.42 + lean, y: cy - h * 0.18 }
    ];
    poly(ctx, pts, fill, stroke, 1.5, alpha);
    poly(ctx, [
      { x: cx, y: cy - h * 0.55 },
      { x: cx + w * 0.16 + lean * 0.25, y: cy - h * 0.17 },
      { x: cx + w * 0.04, y: cy + h * 0.52 },
      { x: cx - w * 0.13 + lean * 0.15, y: cy - h * 0.03 }
    ], colorShade(fill, 30), null, 1, alpha * 0.62);
    poly(ctx, [
      { x: cx + w * 0.03, y: cy - h * 0.58 },
      { x: cx + w * 0.32 + lean, y: cy - h * 0.23 },
      { x: cx + w * 0.09, y: cy - h * 0.06 }
    ], '#d9fbff', null, 1, alpha * 0.35);

    // V0.14.14: extra crystal facet geometry/detail while preserving the original shard footprint.
    line(ctx, cx, cy - h * 0.58, cx + w * 0.05 + lean * 0.10, cy + h * 0.56, '#d9fbff', 0.65, alpha * 0.28);
    line(ctx, cx - w * 0.38 + lean, cy - h * 0.16, cx + w * 0.18 + lean * 0.16, cy + h * 0.24, '#7ee8ff', 0.55, alpha * 0.24);
    line(ctx, cx + w * 0.34 + lean, cy - h * 0.20, cx - w * 0.08, cy + h * 0.12, '#083d94', 0.65, alpha * 0.24);
    for (let i = 0; i < 4; i++) {
      const yy = cy - h * 0.34 + i * h * 0.18;
      const x1 = cx - w * (0.19 + i * 0.022) + lean * 0.20;
      const x2 = cx + w * (0.16 - i * 0.018) + lean * 0.12;
      line(ctx, x1, yy, x2, yy + h * 0.035, '#b9f7ff', 0.42, alpha * 0.12);
    }
    // Small edge chips and mineral inclusions.
    poly(ctx, [
      { x: cx + w * 0.30 + lean * 0.8, y: cy - h * 0.24 },
      { x: cx + w * 0.40 + lean, y: cy - h * 0.18 },
      { x: cx + w * 0.28 + lean * 0.5, y: cy - h * 0.10 }
    ], '#061f5a', null, 1, alpha * 0.18);
    ellipse(ctx, cx - w * 0.10, cy - h * 0.15, Math.max(0.7, w * 0.035), Math.max(0.6, h * 0.014), '#001b4e', alpha * 0.22);
    ellipse(ctx, cx + w * 0.10, cy + h * 0.06, Math.max(0.55, w * 0.028), Math.max(0.45, h * 0.012), '#ffd889', alpha * 0.18);
  }

  function drawAzureShardInternalDetail(ctx, s, colors) {
    const pulse = s.pulse || 0;
    const time = s.time || 0;
    const { core, high, mid, deep, tether } = colors;
    // Internal luminous core and pressure-vessel growth rings.
    glow(ctx, 0, 0, 30 + pulse * 8, core, 0.18 + pulse * 0.08);
    ellipse(ctx, 0, 2, 8 + pulse * 1.5, 14 + pulse * 2.8, core, 0.48 + pulse * 0.18);
    ellipse(ctx, 0, 2, 13, 21, null, 0.55, '#aaf8ff', 0.65);
    ellipse(ctx, 0, 2, 19, 29, null, 0.34, '#47caff', 0.55);

    // Nerve-like energy veins routed along facet lines.
    const veinAlpha = 0.34 + pulse * 0.16;
    line(ctx, 0, 1, -8, -21, high, 0.8, veinAlpha);
    line(ctx, 0, 1, 10, -14, high, 0.7, veinAlpha * 0.85);
    line(ctx, 0, 3, 7, 26, high, 0.75, veinAlpha * 0.82);
    line(ctx, 0, 3, -9, 20, high, 0.6, veinAlpha * 0.70);
    line(ctx, -8, -21, -13, -29, tether, 0.45, veinAlpha * 0.65);
    line(ctx, 10, -14, 15, -22, tether, 0.45, veinAlpha * 0.55);

    // Frozen fracture planes and conchoidal break readables.
    line(ctx, -10, -27, -3, -17, '#dfffff', 0.58, 0.25);
    line(ctx, -3, -17, -9, -8, '#dfffff', 0.48, 0.20);
    line(ctx, 11, 9, 3, 18, '#052766', 0.65, 0.25);
    line(ctx, 3, 18, 9, 29, '#052766', 0.52, 0.20);
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.32;
      line(ctx, 10 + Math.cos(a) * 2.5, 18 + Math.sin(a) * 1.8, 19 + Math.cos(a) * 7, 20 + Math.sin(a) * 5, '#9ff0ff', 0.38, 0.13);
    }

    // Phantom inclusions / internal motes.
    for (let i = 0; i < 6; i++) {
      const a = time * (0.9 + i * 0.06) + i * 1.37;
      const rx = 6 + (i % 3) * 4;
      const ry = 11 + (i % 2) * 9;
      const mx = Math.cos(a) * rx;
      const my = 2 + Math.sin(a * 1.25) * ry;
      ellipse(ctx, mx, my, 1.05 + (i % 2) * 0.35, 1.05 + ((i + 1) % 2) * 0.35, i === 2 ? '#f7e6a3' : core, 0.26 + pulse * 0.10);
    }

    // Floating geometric containment mark bound over the crystal, not a redesign of the body.
    ctx.save();
    ctx.rotate(time * 0.28);
    ellipse(ctx, 0, 2, 22, 7, null, 0.25, '#dffcff', 0.55);
    line(ctx, -17, -2, 17, 6, '#e9ffff', 0.4, 0.18);
    line(ctx, -14, 7, 14, -3, '#e9ffff', 0.4, 0.14);
    ctx.restore();

    // Micro crystal growth clusters along the lower-left and upper-right ridges.
    for (let i = 0; i < 4; i++) {
      drawCrystalShard(ctx, -15 - i * 1.2, -8 + i * 10, 2.2 + i * 0.25, 6 + i * 0.6, mid, '#7de4ff', -0.6, 0.26);
      drawCrystalShard(ctx, 14 + i * 0.8, -25 + i * 6, 2.0 + i * 0.22, 5.6 + i * 0.5, high, '#9bf1ff', 0.5, 0.22);
    }

    // Edge corona at the terminations.
    glow(ctx, 0, -43, 12 + pulse * 3, high, 0.08 + pulse * 0.04);
    glow(ctx, 1, 44, 10 + pulse * 2, mid, 0.06 + pulse * 0.035);
    line(ctx, -2, -38, 2, -38, '#ffffff', 0.8, 0.22);
    line(ctx, -2, 42, 3, 42, '#dfffff', 0.7, 0.18);
  }

  function drawAzureMiniShardDetail(ctx, x, y, w, h, fill, stroke, lean, alpha, time, i) {
    drawCrystalShard(ctx, x, y, w, h, fill, stroke, lean, alpha);
    const p = Math.sin(time * 2.1 + i * 0.93) * 0.5 + 0.5;
    glow(ctx, x, y, Math.max(6, h * 0.75), '#80e6ff', alpha * (0.035 + p * 0.025));
    line(ctx, x, y - h * 0.32, x + lean * 0.55, y + h * 0.30, '#e8ffff', 0.45, alpha * 0.22);
    ellipse(ctx, x + w * 0.10, y, Math.max(0.7, w * 0.10), Math.max(0.9, h * 0.035), '#eaffff', alpha * 0.18);
  }

  function runeRing(ctx, x, y, rx, ry, color, time, alpha = 0.72) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = time * 1.9 + i * Math.PI / 5;
      const px = x + Math.cos(a) * (rx + 4);
      const py = y + Math.sin(a) * (ry + 2);
      ellipse(ctx, px, py, 2.1, 2.1, color, 0.95);
    }
    ctx.restore();
  }

  function drawBoneChip(ctx, x, y, r, fill, stroke, rot = 0, alpha = 1) {
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    poly(ctx, [
      { x: -r * 0.75, y: -r * 0.18 },
      { x: -r * 0.26, y: -r * 0.72 },
      { x: r * 0.62, y: -r * 0.52 },
      { x: r * 0.84, y: r * 0.08 },
      { x: r * 0.22, y: r * 0.70 },
      { x: -r * 0.64, y: r * 0.46 }
    ], fill, stroke, 0.8);
    ctx.restore();
  }

  function drawShortBoneSegment(ctx, x1, y1, x2, y2, fill, stroke, width = 3.2, alpha = 1) {
    line(ctx, x1, y1, x2, y2, stroke, width + 1.3, alpha * 0.72);
    line(ctx, x1, y1, x2, y2, fill, width, alpha);
    ellipse(ctx, x1, y1, width * 0.54, width * 0.48, fill, alpha, stroke, 0.55);
    ellipse(ctx, x2, y2, width * 0.54, width * 0.48, fill, alpha, stroke, 0.55);
  }

  function drawWireWrap(ctx, x1, y1, x2, y2, color, wraps = 4, width = 0.9, alpha = 0.85) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 0; i < wraps; i++) {
      const t = (i + 0.5) / wraps;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      line(ctx, cx - nx * 2.5, cy - ny * 2.5, cx + nx * 2.5, cy + ny * 2.5, color, width, alpha);
    }
  }

  function drawRuneSlash(ctx, x, y, scale, color, alpha = 0.72, rot = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    line(ctx, -3 * scale, -2 * scale, 3 * scale, 2 * scale, color, 0.75 * scale, 1);
    line(ctx, 0, -4 * scale, 0, 4 * scale, color, 0.65 * scale, 0.85);
    line(ctx, -2 * scale, 2.5 * scale, 2 * scale, 2.5 * scale, color, 0.55 * scale, 0.75);
    ctx.restore();
  }

  function drawBoneCracks(ctx, x, y, scale, color, alpha = 0.55, mirror = 1) {
    line(ctx, x, y, x + mirror * 4 * scale, y + 3 * scale, color, 0.75, alpha);
    line(ctx, x + mirror * 3.3 * scale, y + 2.4 * scale, x + mirror * 1.4 * scale, y + 6.2 * scale, color, 0.55, alpha * 0.8);
    line(ctx, x + mirror * 3.5 * scale, y + 2.4 * scale, x + mirror * 6.4 * scale, y + 4.8 * scale, color, 0.55, alpha * 0.72);
  }

  function drawFingerBones(ctx, x, y, side, bone, boneHi, boneDark, glowColor, time, alpha = 1) {
    const spread = [-7, -3, 1.5, 5.5];
    for (let i = 0; i < spread.length; i++) {
      const yy = y + spread[i] * 0.28;
      const base = x + side * (1 + i * 0.45);
      const l1 = 4.3 + (i % 2) * 1.2;
      const l2 = 3.5 + ((i + 1) % 2) * 0.9;
      const a = side * (0.18 + (i - 1.5) * 0.075);
      drawShortBoneSegment(ctx, base, yy, base + side * l1, yy + i - 2, bone, boneDark, 1.5, alpha);
      drawShortBoneSegment(ctx, base + side * l1, yy + i - 2, base + side * (l1 + l2), yy + i - 0.6, boneHi, boneDark, 1.25, alpha * 0.95);
      line(ctx, base + side * (l1 + l2), yy + i - 0.6, base + side * (l1 + l2 + 2.8), yy + i - 1.4, boneDark, 1.2, alpha * 0.8);
      if (i === 1) drawWireWrap(ctx, base + side * 1, yy - 1.5, base + side * (l1 + 1.0), yy + i - 2.2, '#9a5f33', 2, 0.55, alpha * 0.65);
    }
    line(ctx, x - side * 1.6, y + 0.5, x + side * 10, y + 0.5 + Math.sin(time * 2.2) * 0.5, glowColor, 0.7, 0.28 * alpha);
  }

  function drawNecroSoulMote(ctx, x, y, color, time, i, alpha = 1) {
    const bob = Math.sin(time * 2.1 + i * 1.7) * 0.8;
    glow(ctx, x, y + bob, 6.5, color, 0.08 * alpha);
    ellipse(ctx, x, y + bob, 1.6, 2.4, color, 0.32 * alpha, null, 0, 0.15);
  }

  function drawBoneServantSkullDetail(ctx, baseX, skullY, side, front, colors, s) {
    const { boneHi, boneMid, boneDark, voidColor, glowGreen, copper } = colors;
    // Cranial sutures, healed fracture, and donor-bone variation.
    line(ctx, baseX - 7 + side * 1.5, skullY - 10, baseX - 3 + side * 1.5, skullY - 7, boneDark, 0.75, 0.52);
    line(ctx, baseX - 3 + side * 1.5, skullY - 7, baseX + 1 + side * 1.5, skullY - 10, boneDark, 0.65, 0.44);
    line(ctx, baseX + 1 + side * 1.5, skullY - 10, baseX + 5 + side * 1.5, skullY - 7, boneDark, 0.65, 0.42);
    drawBoneCracks(ctx, baseX - 7 + side * 1.5, skullY - 4, 0.72, boneDark, 0.48, -1);
    ellipse(ctx, baseX - 7 + side * 1.5, skullY - 4, 2.2, 1.5, boneMid, 0.35, boneDark, 0.45, -0.3);
    // Brow ridge and cheek planes.
    line(ctx, baseX - 9 + side * 2, skullY - 6, baseX + 8 + side * 2, skullY - 6, boneHi, 1.0, 0.35);
    line(ctx, baseX - 7 + side * 2, skullY + 5, baseX - 2 + side * 2, skullY + 9, boneDark, 0.7, 0.48);
    line(ctx, baseX + 7 + side * 2, skullY + 5, baseX + 2 + side * 2, skullY + 9, boneDark, 0.7, 0.48);
    // Slack jaw wire and uneven teeth.
    line(ctx, baseX - 10 + side * 1.5, skullY + 7, baseX - 12 + side * 1.2, skullY + 12, copper, 0.8, 0.76);
    line(ctx, baseX + 10 + side * 1.5, skullY + 7, baseX + 12 + side * 1.2, skullY + 12, copper, 0.8, 0.76);
    for (let i = -3; i <= 3; i++) {
      if (i === 1) continue;
      const h = i === -2 ? 3.2 : 2.0 + ((i + 4) % 2) * 0.55;
      line(ctx, baseX + i * 2.1 + side * 1.5, skullY + 12.5, baseX + i * 2.1 + side * 1.5, skullY + 12.5 + h, boneHi, 0.65, 0.68);
    }
    drawRuneSlash(ctx, baseX + side * 4.2, skullY - 13.0, 0.55, glowGreen, 0.36 + s.pulse * 0.12, side * 0.16);
    glow(ctx, baseX + side * 2, skullY - 1, 13 + s.pulse * 3, glowGreen, 0.045);
    // One deeper socket so the skull reads asymmetrical.
    ellipse(ctx, baseX + 5 + side * 2, skullY - 2, 2.0 + front * 0.3, 2.6, voidColor, 0.58);
  }

  function drawBoneServantRibDetail(ctx, baseX, chestY, pelvisY, colors, s, back) {
    const { bone, boneHi, boneMid, boneDark, clothDark, metal, copper, glowGreen } = colors;
    // More anatomical spine read: individual vertebrae and scoliotic stress marks.
    for (let i = 0; i < 7; i++) {
      const yy = chestY - 12 + i * 6;
      const off = Math.sin(i * 1.15) * 1.2;
      ellipse(ctx, baseX + off, yy, 2.6, 2.0, i % 2 ? boneMid : bone, 0.92, boneDark, 0.45);
      line(ctx, baseX + off, yy + 1.8, baseX + off, yy + 4.2, boneDark, 0.55, 0.45);
    }
    // Mismatched ribs, including missing/short ribs.
    for (let i = 0; i < 5; i++) {
      const yy = chestY - 10 + i * 5.8;
      const leftSpan = 13.5 - i * 1.0 + (i === 1 ? 3.5 : 0);
      const rightSpan = 13.0 - i * 1.15 - (i === 3 ? 4.5 : 0);
      if (i !== 4) line(ctx, baseX - 1, yy, baseX - leftSpan, yy + 4.5, i === 1 ? boneMid : boneHi, 1.35, back > 0.6 ? 0.45 : 0.62);
      if (i !== 2) line(ctx, baseX + 1, yy + 0.3, baseX + rightSpan, yy + 4.8, i === 3 ? boneMid : boneHi, 1.35, back > 0.6 ? 0.45 : 0.62);
      if (i === 2) drawBoneChip(ctx, baseX + 11, yy + 6, 2.2, boneMid, boneDark, 0.2, 0.75);
    }
    // Partial sternum, leather straps, staples, and drilled wire holes.
    line(ctx, baseX, chestY - 7, baseX, chestY + 18, boneMid, 1.6, 0.78);
    drawWireWrap(ctx, baseX - 14, chestY - 2, baseX + 14, chestY + 1, copper, 6, 0.65, 0.76);
    drawWireWrap(ctx, baseX - 12, chestY + 11, baseX + 12, chestY + 14, clothDark, 5, 1.05, 0.68);
    for (let i = -1; i <= 1; i++) {
      line(ctx, baseX + i * 4.8, chestY + 1, baseX + i * 4.8, chestY + 5, metal, 0.7, 0.62);
    }
    drawRuneSlash(ctx, baseX, chestY + 10, 0.8, glowGreen, 0.46 + s.pulse * 0.12, 0);
    drawNecroSoulMote(ctx, baseX - 7, chestY + 5, glowGreen, s.time, 0, 0.9);
    drawNecroSoulMote(ctx, baseX + 7, chestY + 1, glowGreen, s.time, 1, 0.7);
    // Faint cobweb and grave dust caught inside the rib cage.
    line(ctx, baseX - 10, chestY + 4, baseX + 2, chestY + 15, '#d8d8c8', 0.45, 0.16);
    line(ctx, baseX - 8, chestY + 12, baseX + 9, chestY + 4, '#d8d8c8', 0.45, 0.12);
    ellipse(ctx, baseX, pelvisY - 2, 11.5, 3.2, '#2b2016', 0.18);
  }

  function drawBoneServantPelvisDetail(ctx, baseX, pelvisY, colors, s) {
    const { bone, boneHi, boneMid, boneDark, metal, copper, glowGreen, clothDark } = colors;
    ellipse(ctx, baseX - 7.5, pelvisY + 1.5, 5.3, 6.5, boneMid, 0.72, boneDark, 0.65, -0.2);
    ellipse(ctx, baseX + 6.5, pelvisY + 2.2, 4.2, 5.8, bone, 0.68, boneDark, 0.65, 0.25);
    line(ctx, baseX - 10, pelvisY + 6, baseX + 10, pelvisY + 7, metal, 1.1, 0.75);
    drawWireWrap(ctx, baseX - 12, pelvisY - 1, baseX + 12, pelvisY + 1, copper, 6, 0.72, 0.75);
    drawRuneSlash(ctx, baseX + 1, pelvisY + 3, 0.65, glowGreen, 0.34 + s.pulse * 0.12, 0.15);
    line(ctx, baseX - 4, pelvisY + 7, baseX - 7, pelvisY + 11, boneDark, 0.55, 0.45);
    line(ctx, baseX + 7, pelvisY - 1, baseX + 10, pelvisY - 4, boneDark, 0.55, 0.35);
    ellipse(ctx, baseX, pelvisY + 10, 3.2, 2.3, clothDark, 0.35);
  }

  function drawBoneServantLegDetail(ctx, lKneeX, rKneeX, lFootX, rFootX, pelvisY, groundY, baseX, side, colors, s) {
    const { bone, boneHi, boneMid, boneDark, metal, copper, glowGreen } = colors;
    // Parallel fibulae, patellae, splints, drilled straps and toe phalanges.
    line(ctx, baseX - 9, pelvisY + 8, lKneeX - 3, pelvisY + 24, boneMid, 1.25, 0.66);
    line(ctx, baseX + 9, pelvisY + 7, rKneeX + 3, pelvisY + 21, boneMid, 1.25, 0.66);
    ellipse(ctx, lKneeX, pelvisY + 25, 3.9, 3.2, boneHi, 0.94, boneDark, 0.6);
    ellipse(ctx, rKneeX, pelvisY + 22, 3.6, 3.1, boneMid, 0.94, boneDark, 0.6);
    drawWireWrap(ctx, lKneeX - 4, pelvisY + 24, lKneeX + 4, pelvisY + 26, copper, 4, 0.7, 0.7);
    drawWireWrap(ctx, rKneeX - 4, pelvisY + 21, rKneeX + 4, pelvisY + 23, copper, 4, 0.7, 0.7);
    line(ctx, lKneeX - 2, pelvisY + 33, lFootX - 2, groundY - 3, boneMid, 1.2, 0.62);
    line(ctx, rKneeX + 2, pelvisY + 31, rFootX + 2, groundY - 3, boneMid, 1.2, 0.62);
    line(ctx, lKneeX + 2, pelvisY + 40, lKneeX + 7, pelvisY + 43, metal, 1.1, 0.62);
    drawWireWrap(ctx, lKneeX + 1, pelvisY + 38, lKneeX + 7, pelvisY + 43, copper, 3, 0.62, 0.75);
    for (const [fx, toeSide] of [[lFootX, -1], [rFootX, 1]]) {
      for (let i = 0; i < 4; i++) {
        const tx = fx + toeSide * (i * 2.0 - 1.0);
        line(ctx, fx, groundY - 1, tx, groundY + 3 + (i % 2), i === 2 ? boneHi : bone, 1.15, 0.82);
      }
      drawBoneChip(ctx, fx + toeSide * 6, groundY + 2.5, 1.8, boneMid, boneDark, 0.1 * toeSide, 0.72);
    }
    line(ctx, baseX, pelvisY + 6, baseX + side * 2, groundY - 12, glowGreen, 0.65, 0.15 + s.pulse * 0.06);
  }


  function drawNecroDecayWisp(ctx, x, y, side, color, time, i, alpha = 1) {
    const wave = Math.sin(time * 1.65 + i * 1.31);
    const lift = 10 + i * 5.5;
    const dx = side * (4 + i * 1.4 + wave * 1.8);
    line(ctx, x, y, x + dx, y - lift, color, 0.62, alpha * (0.18 - i * 0.018));
    ellipse(ctx, x + dx, y - lift, 1.4 + i * 0.08, 2.8 + i * 0.16, color, alpha * (0.12 - i * 0.012), null, 0, wave * 0.35);
  }

  function drawNecroRustedPlate(ctx, cx, cy, w, h, rot, colors, alpha = 1) {
    const { rust, metal, ironDark, verdigris } = colors;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    poly(ctx, [
      { x: -w * 0.50, y: -h * 0.46 }, { x: w * 0.36, y: -h * 0.52 },
      { x: w * 0.48, y: -h * 0.07 }, { x: w * 0.22, y: h * 0.44 },
      { x: -w * 0.42, y: h * 0.34 }, { x: -w * 0.56, y: -h * 0.08 }
    ], metal, ironDark, 1.0, alpha);
    line(ctx, -w * 0.35, -h * 0.24, w * 0.25, -h * 0.30, rust, 0.75, alpha * 0.78);
    line(ctx, -w * 0.30, h * 0.14, w * 0.18, h * 0.10, '#30251e', 0.65, alpha * 0.65);
    drawBoneCracks(ctx, -w * 0.03, -h * 0.03, 0.78, ironDark, alpha * 0.62, 1);
    ellipse(ctx, -w * 0.20, -h * 0.02, w * 0.08, h * 0.045, rust, alpha * 0.55, null, 0, -0.2);
    ellipse(ctx, w * 0.18, h * 0.12, w * 0.06, h * 0.035, verdigris, alpha * 0.35, null, 0, 0.4);
    line(ctx, w * 0.40, -h * 0.07, w * 0.52, -h * 0.14, ironDark, 0.8, alpha * 0.8);
    ctx.restore();
  }

  function drawNecroBrokenHelmet(ctx, baseX, skullY, side, front, colors, s) {
    const { ironDark, metal, rust, verdigris } = colors;
    const x = baseX + side * 0.8;
    poly(ctx, [
      { x: x - 13, y: skullY - 15 }, { x: x + 10, y: skullY - 18 },
      { x: x + 13, y: skullY - 8 }, { x: x + 7, y: skullY - 4 },
      { x: x - 13, y: skullY - 6 }
    ], ironDark, '#14100e', 1.0, 0.92);
    poly(ctx, [
      { x: x - 8, y: skullY - 16 }, { x: x + 7, y: skullY - 17 },
      { x: x + 10, y: skullY - 12 }, { x: x - 3, y: skullY - 11 }
    ], metal, null, 1, 0.35);
    line(ctx, x - 12, skullY - 8, x + 12, skullY - 9, rust, 1.0, 0.75);
    drawBoneCracks(ctx, x + side * 5, skullY - 13, 0.72, '#120c0a', 0.78, side);
    ellipse(ctx, x + side * 7, skullY - 11, 3.0, 2.3, '#0b0706', 0.9, rust, 0.5, 0.2);
    ellipse(ctx, x - side * 6, skullY - 15, 2.2, 1.2, verdigris, 0.36, null, 0, -0.3);
    line(ctx, x - 9, skullY - 5, x - 3, skullY - 3, rust, 0.55, 0.55);
    line(ctx, x + 4, skullY - 5, x + 11, skullY - 4, rust, 0.55, 0.45);
  }

  function drawNecroShatteredShield(ctx, cx, cy, side, colors, alpha = 1) {
    const { woodDark, wood, metal, rust, ironDark, verdigris } = colors;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(side * -0.18);
    poly(ctx, [
      { x: -8, y: -14 }, { x: 5, y: -12 }, { x: 10, y: -2 },
      { x: 6, y: 11 }, { x: -2, y: 16 }, { x: -11, y: 5 }
    ], woodDark, ironDark, 1.0, alpha * 0.88);
    poly(ctx, [
      { x: -7, y: -12 }, { x: 0, y: -11 }, { x: -1, y: 12 }, { x: -9, y: 4 }
    ], wood, null, 1, alpha * 0.44);
    line(ctx, -8, -11, 8, -7, metal, 0.9, alpha * 0.65);
    line(ctx, -9, 4, 5, 12, metal, 0.9, alpha * 0.58);
    line(ctx, 2, -10, 1, 13, rust, 0.75, alpha * 0.75);
    line(ctx, -5, -5, 8, -1, '#170f0b', 0.8, alpha * 0.82);
    line(ctx, 5, -1, 11, -8, '#170f0b', 0.65, alpha * 0.7);
    drawBoneCracks(ctx, -3, 2, 0.8, '#120b08', alpha * 0.72, 1);
    ellipse(ctx, 5, -5, 2.0, 1.2, verdigris, alpha * 0.34, null, 0, 0.25);
    ctx.restore();
  }

  function drawNecroRuinedCleaver(ctx, handX, handY, side, colors, s) {
    const { ironDark, metal, rust, edge, clothDark, glowGreen } = colors;
    const attackLift = s.attack * 7;
    const tipX = handX + side * (33 + s.attack * 14);
    const tipY = handY - 26 - attackLift;
    const baseX = handX + side * 5;
    const baseY = handY + 5;
    line(ctx, baseX - side * 2, baseY + 3, handX + side * 7, handY - 2, clothDark, 4.0, 0.92);
    drawWireWrap(ctx, baseX - side * 2, baseY + 3, handX + side * 7, handY - 2, rust, 4, 0.62, 0.72);
    line(ctx, handX + side * 4, handY + 1, handX - side * 5, handY + 5, ironDark, 1.7, 0.92);
    poly(ctx, [
      { x: handX + side * 6, y: handY - 2 },
      { x: tipX - side * 6, y: tipY - 3 },
      { x: tipX + side * 4, y: tipY + 4 },
      { x: handX + side * 12, y: handY + 9 }
    ], ironDark, '#171514', 1.0, 0.98);
    poly(ctx, [
      { x: handX + side * 10, y: handY - 3 },
      { x: tipX - side * 5, y: tipY - 2 },
      { x: tipX + side * 1, y: tipY + 2 },
      { x: handX + side * 13, y: handY + 5 }
    ], metal, null, 1, 0.42);
    line(ctx, handX + side * 13, handY + 5, tipX + side * 1, tipY + 2, edge, 0.95, 0.72);
    line(ctx, handX + side * 15, handY + 1, tipX - side * 5, tipY - 2, rust, 0.75, 0.58);
    drawBoneCracks(ctx, handX + side * 22, handY - 10 - attackLift * 0.4, 0.65, rust, 0.55, side);
    if (s.attack > 0.02) {
      line(ctx, handX + side * 11, handY - 3, tipX + side * 8, tipY - 4, edge, 2.2, 0.5 + s.attack * 0.18);
      glow(ctx, tipX + side * 7, tipY - 5, 14, glowGreen, 0.11 + s.attack * 0.13);
    }
  }

  function drawNecroMummifiedPatch(ctx, cx, cy, w, h, rot, colors, alpha = 1) {
    const { flesh, fleshDark, sinew } = colors;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    poly(ctx, [
      { x: -w * 0.48, y: -h * 0.20 }, { x: w * 0.34, y: -h * 0.45 },
      { x: w * 0.52, y: h * 0.15 }, { x: w * 0.06, y: h * 0.48 },
      { x: -w * 0.42, y: h * 0.25 }
    ], flesh, fleshDark, 0.6, alpha * 0.65);
    line(ctx, -w * 0.30, -h * 0.02, w * 0.25, -h * 0.14, sinew, 0.5, alpha * 0.5);
    line(ctx, -w * 0.20, h * 0.16, w * 0.34, h * 0.08, fleshDark, 0.45, alpha * 0.44);
    line(ctx, w * 0.02, -h * 0.32, w * 0.08, h * 0.35, '#2a1a14', 0.42, alpha * 0.36);
    ctx.restore();
  }

  const PetIdentityProceduralModel = {
    canDraw(actor) {
      return !!actor && actor.kind === 'pet';
    },

    resolveProfile(actor) {
      return speciesOf(actor);
    },

    buildState(actor, timeMs) {
      const time = timeMs * 0.001;
      const move = clamp(actor.moveBlend || ((Math.abs(actor.vx || 0) + Math.abs(actor.vy || 0)) > 0.01 ? 1 : 0), 0, 1);
      const phase = Number.isFinite(actor.walkCycle) ? actor.walkCycle : time * 6.2;
      const attack = clamp(actor.attackAnim || 0, 0, 1);
      const hit = clamp(actor.hitAnim || actor.hitReaction || actor.damageAnim || 0, 0, 1);
      const death = clamp(actor.deathProgress || (!actor.alive ? 1 : 0), 0, 1);
      const summon = clamp(actor.spawnFx || actor.summonFx || 0, 0, 1);
      const dirName = normalizeFacing(actor.facingName);
      const dir = DIRS[dirName] || DIRS.south;
      const hover = Math.sin(time * 2.35 + (actor.id || 0) * 0.11);
      const pulse = Math.sin(time * 5.2 + (actor.id || 0) * 0.07) * 0.5 + 0.5;
      return {
        time, move, phase, attack, hit, death, summon, dirName, dir, hover, pulse,
        walk: Math.sin(phase),
        bounce: move > 0.08 ? Math.abs(Math.sin(phase)) * 3.8 : hover * 1.7,
        recoilX: hit * -dir.side * 5,
        recoilY: hit * -5,
        lift: summon * 12
      };
    },

    draw(ctx, actor, timeMs) {
      const state = this.buildState(actor, timeMs);
      if (this.resolveProfile(actor) === 'necro') this.drawNecroBoneServant(ctx, actor, state);
      else this.drawSummonerFloatingShard(ctx, actor, state);
    },

    drawSummonerFloatingShard(ctx, actor, s) {
      const x = Number(actor.screenX || 0);
      const y = Number(actor.screenY || 0);
      const side = s.dir.side || 0;
      const sign = side || 1;
      const cx = x + side * 4 + s.recoilX;
      const cy = y - 47 - s.bounce - s.lift + s.recoilY;
      const tilt = side * (0.22 + s.move * 0.15) + Math.sin(s.time * 2.1) * 0.05 + s.attack * sign * 0.25;
      const fade = Math.max(0.18, 1 - s.death * 0.76);
      const main = '#1787ff';
      const deep = '#0a2f91';
      const mid = '#35b8ff';
      const high = '#c8f8ff';
      const core = '#e7fdff';
      const tether = '#7ee8ff';
      const shardColors = { main, deep, mid, high, core, tether };
      actor._petIdentityRenderer = 'azure-shard-familiar-high-detail-v0.14.14-crystalline-entity';

      ctx.save();
      if (s.death > 0) {
        ctx.globalAlpha = fade;
        ctx.translate(x, y);
        ctx.rotate(sign * s.death * 0.85);
        ctx.translate(-x, -y);
      }

      // Explicit hover shadow: no legs, no feet, no animal body.
      ellipse(ctx, x, y + 5, 25 + s.pulse * 5, 6.5, '#0b3275', 0.17);
      glow(ctx, cx, cy, 54 + s.pulse * 8, '#79d9ff', 0.20 + s.pulse * 0.05);
      glow(ctx, cx, cy + 18, 72, '#2a99ff', 0.08);

      // V0.14.46: Azure Shard keeps body/orbit/summon animation, but no longer draws
      // a ground-plane rune ring under the body; that read as a duplicate target indicator.
      if (s.summon > 0.01) {
        glow(ctx, cx, cy, 70, '#dcfbff', 0.10 + s.summon * 0.22);
        for (let i = 0; i < 8; i++) {
          const a = s.time * 2.4 + i * Math.PI / 4;
          drawAzureMiniShardDetail(ctx, x + Math.cos(a) * (16 + s.summon * 21), cy + Math.sin(a) * (10 + s.summon * 9), 5, 16, high, '#68d9ff', Math.sin(a) * 1.5, 0.30 + s.summon * 0.32, s.time, i);
        }
      }

      // Ghost tail / spectral mist below the shard, plus planar cold haze.
      for (let i = 0; i < 7; i++) {
        const a = s.time * 1.35 + i * 0.95;
        const mx = cx + Math.cos(a) * (9 + i * 1.2) - side * i * 1.4;
        const my = cy + 24 + i * 5.5 + Math.sin(a) * 2.2;
        ellipse(ctx, mx, my, 10 - i * 0.8, 4.2 + i * 0.25, '#8feaff', Math.max(0.035, 0.17 - i * 0.017));
      }
      for (let i = 0; i < 5; i++) {
        const a = s.time * 1.7 + i * 1.33;
        line(ctx, cx + Math.cos(a) * 11, cy + Math.sin(a) * 14, cx + Math.cos(a + 0.8) * 23, cy + Math.sin(a + 0.8) * 24, '#aef5ff', 0.65, 0.06 + s.pulse * 0.03);
      }
      // V0.14.46: removed animated ground-plane caustic strokes under the Azure Shard.

      // Large unmistakable central vertical shard.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      drawCrystalShard(ctx, 0, 0, 30, 68, main, '#a8f1ff', 0, 0.98);
      drawCrystalShard(ctx, -5, -1, 14, 57, mid, null, 0, 0.52);
      poly(ctx, [
        { x: 1, y: -39 }, { x: 14, y: -13 }, { x: 7, y: 33 }, { x: 0, y: 8 }
      ], deep, null, 1, 0.46);
      poly(ctx, [
        { x: -4, y: -33 }, { x: 6, y: -8 }, { x: -1, y: 26 }, { x: -11, y: -7 }
      ], high, null, 1, 0.27);
      drawAzureShardInternalDetail(ctx, s, shardColors);
      ctx.restore();

      // Orbiting shards are separate from body, making the silhouette non-creature.
      // V0.14.14 adds individual miniature-crystal detail and faint tether geometry.
      for (let i = 0; i < 6; i++) {
        const a = s.time * (1.85 + i * 0.09) + i * Math.PI * 0.4;
        const depth = Math.sin(a) * 0.5 + 0.5;
        const ox = cx + Math.cos(a) * (28 + i * 2.2);
        const oy = cy + Math.sin(a) * (12 + i * 0.85) - 2;
        const alpha = 0.34 + depth * 0.38;
        line(ctx, cx + Math.cos(a) * 8, cy + Math.sin(a) * 5, ox, oy, tether, 0.45, 0.09 + depth * 0.07);
        drawAzureMiniShardDetail(ctx, ox, oy, 6 + depth * 3, 18 + depth * 7, depth > 0.55 ? high : mid, '#78dcff', side * 1.5, alpha, s.time, i + 10);
        if (i % 2 === 0) glow(ctx, ox, oy, 11 + depth * 8, high, 0.045 + depth * 0.025);
      }

      // Blue-white core and attack flare.
      glow(ctx, cx, cy + 3, 22 + s.pulse * 5 + s.attack * 13, core, 0.22 + s.attack * 0.16);
      ellipse(ctx, cx, cy + 4, 6 + s.attack * 3, 11 + s.attack * 4, core, 0.78);
      if (s.attack > 0.02) {
        const bx = cx + sign * (29 + s.attack * 20);
        line(ctx, cx + sign * 8, cy + 3, bx, cy - 5, '#dfffff', 3.6, 0.88);
        glow(ctx, bx, cy - 5, 22 + s.attack * 9, '#f3ffff', 0.26 + s.attack * 0.16);
        ellipse(ctx, bx, cy - 5, 9 + s.attack * 5, 4 + s.attack * 2, '#f3ffff', 0.52);
      }
      if (s.hit > 0.02) {
        ellipse(ctx, cx, cy, 36, 44, '#ffffff', 0.12 * s.hit, '#ddfbff', 1.8);
        for (let i = 0; i < 6; i++) {
          const a = s.time * 4 + i * 1.05;
          line(ctx, cx, cy, cx + Math.cos(a) * 23, cy + Math.sin(a) * 23, '#ffffff', 1.6, 0.24 * s.hit);
        }
      }

      if (actor.debugFacing) {
        ctx.fillStyle = '#dffaff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(actor._humanoidSheetDirection || actor.facingName || 'S'), x, y - 90);
      }

      ctx.restore();
      actor._nameplateAnchor = { x, y: y - 88 - s.lift * 0.25 };
    },

    drawNecroBoneServant(ctx, actor, s) {
      const x = Number(actor.screenX || 0);
      const y = Number(actor.screenY || 0);
      const sideRaw = s.dir.side || 1;
      const side = sideRaw === 0 ? 1 : sideRaw;
      const front = s.dir.front || 0;
      const back = s.dir.back || 0;
      const baseX = x + side * 2 + s.recoilX;
      const groundY = y + 3;
      const stride = Math.sin(s.phase) * s.move;
      const drag = Math.max(0, s.move) * (0.45 + back * 0.15);
      const pelvisY = y - 22 - Math.abs(stride) * 1.25 - s.lift + s.recoilY;
      const chestY = pelvisY - 31 - s.attack * 3;
      const skullY = chestY - 31 - s.attack * 2;
      const collapse = s.death;
      const bone = '#d7ccb0';
      const boneHi = '#f0ead1';
      const boneMid = '#a99b7f';
      const boneDark = '#6f634e';
      const voidColor = '#120d0b';
      const cloth = '#3a2a23';
      const clothDark = '#1a120f';
      const metal = '#55585b';
      const ironDark = '#242527';
      const rust = '#8d4a25';
      const verdigris = '#4d8d73';
      const copper = '#a06031';
      const flesh = '#6b3f31';
      const fleshDark = '#2a1712';
      const sinew = '#b07a55';
      const wood = '#5d3826';
      const woodDark = '#261611';
      const edge = '#d6d0b8';
      const glowGreen = '#a7ff77';
      const colors = { bone, boneHi, boneMid, boneDark, voidColor, cloth, clothDark, metal, ironDark, rust, verdigris, copper, flesh, fleshDark, sinew, wood, woodDark, edge, glowGreen };
      actor._petIdentityRenderer = 'necromancer-pet-skeleton-v0.16.83-decayed-bound-warrior';

      ctx.save();
      if (collapse > 0) {
        ctx.globalAlpha = Math.max(0.24, 1 - collapse * 0.58);
        ctx.translate(x, y);
        ctx.rotate(side * collapse * 1.08);
        ctx.translate(-x, -y);
      }

      ellipse(ctx, x, y + 6, 21, 5.8, '#130e0b', 0.32);
      glow(ctx, baseX, chestY - 2, 31 + s.pulse * 5, glowGreen, 0.09 + s.pulse * 0.04);

      if (s.summon > 0.01) {
        runeRing(ctx, x, y + 3, 24 + s.summon * 10, 7 + s.summon * 2, glowGreen, s.time, 0.46 + s.summon * 0.24);
        for (let i = 0; i < 8; i++) {
          const a = s.time * 2.1 + i * Math.PI / 4;
          const bx = x + Math.cos(a) * (13 + s.summon * 12);
          const by = y - 22 + Math.sin(a) * 9;
          ellipse(ctx, bx, by, 3.1, 7.8, i % 2 ? boneMid : boneHi, 0.16 + s.summon * 0.23, boneDark, 0.75, a);
        }
      }

      // Grave shroud, hood scraps, and wisps behind the skeleton. The 8-direction
      // rig is preserved; only silhouette detail changes here.
      poly(ctx, [
        { x: baseX - 15, y: chestY - 10 }, { x: baseX + 12, y: chestY - 11 },
        { x: baseX + 17, y: pelvisY + 18 }, { x: baseX + 7, y: pelvisY + 12 },
        { x: baseX + 1, y: pelvisY + 30 }, { x: baseX - 7, y: pelvisY + 18 },
        { x: baseX - 15, y: pelvisY + 28 }, { x: baseX - 18, y: pelvisY + 4 }
      ], back > 0.1 ? clothDark : '#241914', '#100b09', 1.0, 0.92);
      for (let i = 0; i < 5; i++) drawNecroDecayWisp(ctx, baseX + side * (2 + i), chestY + 6 + i * 2.2, side, glowGreen, s.time, i, 0.75);

      // Far/left arm: mostly skeletal, wired together, with ruined shield prop.
      const farShoulderX = baseX - side * 10;
      const farElbowX = baseX - side * (20 + stride * 3);
      const farHandX = baseX - side * (25 + stride * 2);
      const farShoulderY = chestY + 0;
      line(ctx, farShoulderX, farShoulderY, farElbowX, chestY + 18, boneDark, 4.2, 0.86);
      line(ctx, farElbowX, chestY + 18, farHandX, pelvisY + 14, boneMid, 3.5, 0.84);
      ellipse(ctx, farShoulderX, farShoulderY, 4.6, 3.4, boneMid, 0.82, boneDark, 0.7);
      ellipse(ctx, farElbowX, chestY + 18, 3.2, 2.7, boneDark, 0.9, copper, 0.55);
      drawWireWrap(ctx, farShoulderX - side * 1.2, chestY + 4, farElbowX + side * 1.2, chestY + 16, copper, 6, 0.58, 0.76);
      drawWireWrap(ctx, farElbowX - side * 1.5, chestY + 17, farHandX + side * 1.5, pelvisY + 12, '#3b261c', 4, 0.82, 0.56);
      drawNecroShatteredShield(ctx, farElbowX - side * 2, chestY + 22, -side, colors, back > 0.55 ? 0.48 : 0.92);
      drawFingerBones(ctx, farHandX, pelvisY + 14, -side, boneMid, bone, boneDark, glowGreen, s.time, 0.58);

      // Lower body keeps original footprint but gains femur/shin/greave detail and a dragging gait.
      const lKneeX = baseX - 7 + stride * 6;
      const rKneeX = baseX + 7 - stride * 6;
      const lFootX = baseX - 13 + stride * 9 - side * drag * 2;
      const rFootX = baseX + 13 - stride * 8 + side * drag;
      line(ctx, baseX - 6, pelvisY + 5, lKneeX, pelvisY + 25, boneDark, 5.0);
      line(ctx, lKneeX, pelvisY + 25, lFootX, groundY, bone, 4.3);
      line(ctx, baseX + 6, pelvisY + 5, rKneeX, pelvisY + 22, boneDark, 5.0);
      line(ctx, rKneeX, pelvisY + 22, rFootX, groundY, bone, 4.3);
      drawBoneServantLegDetail(ctx, lKneeX, rKneeX, lFootX, rFootX, pelvisY, groundY, baseX, side, colors, s);
      drawNecroMummifiedPatch(ctx, rKneeX + side * 1.5, pelvisY + 35, 8, 18, side * 0.18, colors, 0.74);
      drawNecroRustedPlate(ctx, lKneeX - side * 1.5, pelvisY + 40, 8, 20, side * 0.04, colors, 0.72);
      drawBoneCracks(ctx, baseX - 10, pelvisY + 16, 0.8, boneDark, 0.5, -side);
      ellipse(ctx, lFootX - side * 2, groundY + 1, 7, 3, voidColor, 0.95);
      ellipse(ctx, rFootX + side * 2, groundY + 1, 7, 3, voidColor, 0.95);
      line(ctx, lFootX + side * 5, groundY + 2, lFootX + side * 9, groundY + 4, rust, 1.0, 0.76);

      // Exposed pelvis, mail belt, ragged fauld and broken chain trophies.
      poly(ctx, [
        { x: baseX - 12, y: pelvisY - 5 }, { x: baseX + 11, y: pelvisY - 5 },
        { x: baseX + 9, y: pelvisY + 10 }, { x: baseX - 9, y: pelvisY + 10 }
      ], boneDark, '#514837', 1.2);
      drawBoneServantPelvisDetail(ctx, baseX, pelvisY, colors, s);
      for (let i = -2; i <= 2; i++) ellipse(ctx, baseX + i * 4.5, pelvisY + 7.5 + (i % 2), 2.2, 1.5, metal, 0.55, ironDark, 0.45);
      poly(ctx, [
        { x: baseX - 7, y: pelvisY + 4 }, { x: baseX + 8, y: pelvisY + 4 },
        { x: baseX + 11, y: pelvisY + 24 }, { x: baseX + 3, y: pelvisY + 18 },
        { x: baseX - 5, y: pelvisY + 31 }, { x: baseX - 9, y: pelvisY + 15 }
      ], cloth, clothDark, 1.0, 0.95);
      line(ctx, baseX - 10, pelvisY + 8, baseX - 20, pelvisY + 18, rust, 1.0, 0.62);
      ellipse(ctx, baseX - 21, pelvisY + 19, 2.1, 1.4, metal, 0.55, ironDark, 0.4);

      // Hunched cervical spine, ribcage, breastplate fragment and central binding rune.
      line(ctx, baseX - side * 1.5, skullY + 15, baseX, chestY - 11, boneDark, 3.3, 0.9);
      for (let i = 0; i < 5; i++) ellipse(ctx, baseX - side * (1.5 - i * 0.15), skullY + 17 + i * 4.3, 2.5, 1.7, i % 2 ? boneMid : bone, 0.9, boneDark, 0.42);
      line(ctx, baseX, chestY - 11, baseX, pelvisY - 1, boneDark, 4.6);
      for (let i = 0; i < 4; i++) {
        const yy = chestY - 7 + i * 6;
        const span = 14 - i * 1.25;
        line(ctx, baseX - 1, yy, baseX - span, yy + 5, boneHi, 2.4, back > 0.6 ? 0.52 : 0.92);
        line(ctx, baseX + 1, yy, baseX + span, yy + 5, boneHi, 2.4, back > 0.6 ? 0.52 : 0.92);
      }
      drawBoneServantRibDetail(ctx, baseX, chestY, pelvisY, colors, s, back);
      drawNecroMummifiedPatch(ctx, baseX - side * 4, chestY + 4, 13, 20, side * -0.12, colors, 0.78);
      // Three protruding broken ribs on the left side.
      for (let i = 0; i < 3; i++) {
        const yy = chestY - 2 + i * 5;
        line(ctx, baseX - side * (12 + i), yy, baseX - side * (21 + i * 2), yy + 3, boneHi, 1.8, 0.86);
        drawBoneChip(ctx, baseX - side * (22 + i * 2), yy + 3, 1.8, boneHi, boneDark, side * 0.2, 0.78);
      }
      ellipse(ctx, baseX, chestY + 10, 5.8, 5.8, glowGreen, 0.32 + s.pulse * 0.13);
      drawRuneSlash(ctx, baseX, chestY + 10, 0.95, glowGreen, 0.5 + s.pulse * 0.14, 0);
      drawNecroRustedPlate(ctx, baseX + side * 9, chestY - 4, 18, 26, side * 0.08, colors, back > 0.65 ? 0.46 : 0.9);
      line(ctx, baseX - side * 13, chestY - 15, baseX + side * 13, pelvisY + 10, '#201511', 3.2, 0.82);
      drawWireWrap(ctx, baseX - side * 13, chestY - 15, baseX + side * 13, pelvisY + 10, rust, 6, 0.55, 0.48);
      poly(ctx, [
        { x: baseX + side * 13, y: pelvisY + 7 }, { x: baseX + side * 18, y: pelvisY + 10 },
        { x: baseX + side * 13, y: pelvisY + 28 }, { x: baseX + side * 9, y: pelvisY + 25 }
      ], ironDark, rust, 0.9, 0.64);

      // Asymmetrical skull with broken helmet, hanging jaw, one empty socket, one glowing socket.
      if (back > 0.62) {
        ellipse(ctx, baseX + side * 0.6, skullY - 1, 13.5, 15.2, bone, 1, '#716956', 1.7);
        drawNecroBrokenHelmet(ctx, baseX, skullY, side, front, colors, s);
        drawBoneCracks(ctx, baseX - side * 3, skullY - 7, 0.8, boneDark, 0.48, -side);
        line(ctx, baseX - 8, skullY + 8, baseX + 8, skullY + 9, boneDark, 0.9, 0.56);
      } else {
        ellipse(ctx, baseX + side * 1.5, skullY, 14 + front * 1.5, 15.5, bone, 1, '#716956', 1.8);
        poly(ctx, [
          { x: baseX - 10 + side * 1.5, y: skullY + 4 }, { x: baseX + 9 + side * 1.5, y: skullY + 4 },
          { x: baseX + 7 + side * 1.5, y: skullY + 18 }, { x: baseX - 7 + side * 1.5, y: skullY + 17 }
        ], colorShade(bone, -9), '#716956', 1.1);
        const emptyEyeX = baseX - side * 5 + side * 2;
        const glowEyeX = baseX + side * 5 + side * 2;
        ellipse(ctx, emptyEyeX, skullY - 2, 3.8, 4.6, voidColor, 1);
        ellipse(ctx, glowEyeX, skullY - 2, 3.3, 4.2, voidColor, 1);
        glow(ctx, glowEyeX, skullY - 2, 9 + s.pulse * 2, glowGreen, 0.22 + s.pulse * 0.08);
        ellipse(ctx, glowEyeX, skullY - 2, 1.5, 2.2, glowGreen, 0.84);
        poly(ctx, [
          { x: baseX + side * 2, y: skullY + 3 }, { x: baseX - 1 + side * 2, y: skullY + 8 },
          { x: baseX + 4 + side * 2, y: skullY + 8 }
        ], voidColor);
        line(ctx, baseX - 7, skullY + 13, baseX + 7, skullY + 14, boneDark, 1.5, 0.82);
        // Uneven teeth and one odd gold tooth.
        for (let i = -3; i <= 3; i++) {
          const toothColor = i === 2 ? '#d7a84c' : (i === -1 ? boneMid : boneHi);
          line(ctx, baseX + i * 2.0 + side * 1.5, skullY + 14, baseX + i * 2.0 + side * 1.5, skullY + 16.3 + ((i + 4) % 2), toothColor, 0.62, 0.76);
        }
        // Fracture, staple, scalp strip and hair.
        drawBoneCracks(ctx, baseX - side * 6, skullY - 9, 0.95, boneDark, 0.58, -side);
        line(ctx, baseX - side * 5, skullY - 8, baseX - side * 1, skullY - 6, rust, 0.8, 0.8);
        drawNecroMummifiedPatch(ctx, baseX - side * 3, skullY - 12, 8, 6, side * 0.1, colors, 0.62);
        for (let i = 0; i < 4; i++) line(ctx, baseX - side * (2 + i), skullY - 15 + i, baseX - side * (5 + i * 1.2), skullY - 24 + i * 2.2, '#11100d', 0.85, 0.55 - i * 0.08);
        drawBoneServantSkullDetail(ctx, baseX, skullY, side, front, colors, s);
        drawNecroBrokenHelmet(ctx, baseX, skullY, side, front, colors, s);
      }
      drawRuneSlash(ctx, baseX + side * 5, skullY - 12.5, 0.55, glowGreen, 0.35 + s.pulse * 0.14, side * 0.14);

      // Near/right arm: more mummified, bracered, with fused grip on a rusted cleaver sword.
      const shoulderX = baseX + side * 11;
      const shoulderY = chestY - 2;
      const elbowX = baseX + side * (21 + s.attack * 8);
      const elbowY = chestY + 15 - s.attack * 4;
      const handX = baseX + side * (27 + s.attack * 16);
      const handY = pelvisY + 1 - s.attack * 10;
      line(ctx, shoulderX, shoulderY, elbowX, elbowY, bone, 4.7);
      line(ctx, elbowX, elbowY, handX, handY, bone, 4.1);
      drawNecroMummifiedPatch(ctx, shoulderX + side * 5, shoulderY + 8, 10, 20, side * 0.20, colors, 0.9);
      drawNecroRustedPlate(ctx, elbowX + side * 2, elbowY + 6, 9, 14, side * 0.18, colors, 0.72);
      ellipse(ctx, shoulderX, shoulderY, 4.4, 3.3, boneHi, 0.88, boneDark, 0.65);
      ellipse(ctx, elbowX, elbowY, 3.5, 2.8, boneMid, 0.94, boneDark, 0.6);
      drawWireWrap(ctx, shoulderX, shoulderY + 2, elbowX, elbowY - 1, copper, 5, 0.62, 0.72);
      drawWireWrap(ctx, elbowX - side * 2, elbowY + 1, handX - side * 2, handY - 1, clothDark, 5, 0.92, 0.62);
      drawFingerBones(ctx, handX - side * 1.5, handY + 2, side, bone, boneHi, boneDark, glowGreen, s.time, 0.88);
      drawNecroRuinedCleaver(ctx, handX, handY, side, colors, s);
      drawNecroDecayWisp(ctx, handX + side * 8, handY - 2, side, glowGreen, s.time, 8, 0.65);

      if (s.hit > 0.02) {
        ellipse(ctx, baseX, chestY + 1, 31, 39, '#ffffff', 0.10 * s.hit, '#e7ffd4', 1.8);
        for (let i = 0; i < 4; i++) {
          const a = s.time * 4.4 + i * 1.37;
          line(ctx, baseX, chestY, baseX + Math.cos(a) * 18, chestY + Math.sin(a) * 24, '#e7ffd4', 1.0, 0.16 * s.hit);
        }
      }

      if (actor.debugFacing) {
        ctx.fillStyle = '#efffd2';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(actor._humanoidSheetDirection || actor.facingName || 'S'), x, y - 83);
      }

      ctx.restore();
      // V0.16.85: the high-detail Necromancer skeleton extends above the old anchor.
      // Anchor from the calculated skull top plus fixed clearance so the full
      // nameplate/HP stack sits above the helmet/skull without touching it.
      const skeletonTopY = skullY - 28;
      actor._nameplateAnchor = { x, y: Math.round(skeletonTopY - 16 - s.lift * 0.15) };
    },
  };

  DR.render.PetIdentityProceduralModel = PetIdentityProceduralModel;
  window.PetIdentityProceduralModel = PetIdentityProceduralModel;
})();
